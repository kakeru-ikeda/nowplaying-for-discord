import express from 'express';
import cors from 'cors';
import path from 'path';
import { createServer } from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import { LastFmService } from './lastfm';
import { NowPlayingInfo, MusicReport } from '../types';
import {
    HealthCheckResponse,
    ApiErrorCode,
    WebSocketMessage,
    NowPlayingWebSocketMessage,
    ReportUpdateWebSocketMessage,
    ConnectionStatusWebSocketMessage,
    ServerStats,
    ReportPeriod
} from '../schemas/api';
import {
    validateReportQueryParams,
    validateClientWebSocketMessage,
    createSuccessResponse,
    createErrorResponse,
    createWebSocketMessage,
    RateLimiter,
} from '../schemas/validation';

/**
 * WebサーバーとWebSocketサーバーを統合したサービス
 * フロントエンド向けにLast.fm情報を再提供
 */
export class WebServerService {
    private app: express.Application;
    private server: any;
    private wss!: WebSocketServer;
    private lastFmService: LastFmService;
    private currentNowPlaying: NowPlayingInfo | null = null;
    private connectedClients: Set<WebSocket> = new Set();
    private readonly port: number;
    private rateLimiter: RateLimiter;
    private serverStats: ServerStats;
    private startTime: number;

    constructor(port: number = 3001) {
        this.port = port;
        this.lastFmService = new LastFmService();
        this.app = express();
        this.rateLimiter = new RateLimiter(100, 60000); // 1分間に100リクエスト
        this.startTime = Date.now();
        this.serverStats = {
            uptime: 0,
            totalRequests: 0,
            activeConnections: 0,
            lastfmApiCalls: 0,
            reportsGenerated: 0,
            memoryUsage: {
                used: 0,
                total: 0,
                percentage: 0
            }
        };
        this.setupExpress();
        this.server = createServer(this.app);
        this.setupWebSocket();
    }

    /**
     * Expressサーバーの設定
     */
    private setupExpress(): void {
        // CORS設定
        this.app.use(cors({
            origin: true, // 開発時は全てのオリジンを許可
            credentials: true
        }));

        this.app.use(express.json());

        // レート制限とリクエスト統計のミドルウェア
        this.app.use((req: any, res: any, next: any) => {
            const clientId = req.ip || 'unknown';

            // レート制限チェック
            if (!this.rateLimiter.checkRateLimit(clientId)) {
                const stats = this.rateLimiter.getClientStats(clientId);
                return res.status(429).json(createErrorResponse(
                    'Rate limit exceeded',
                    ApiErrorCode.INVALID_REQUEST,
                    { remainingRequests: stats.remainingRequests, resetTime: stats.resetTime }
                ));
            }

            // リクエスト統計更新
            this.serverStats.totalRequests++;
            this.updateServerStats();

            next();
        });

        // 静的ファイル配信（テスト用HTMLなど）
        const publicPath = path.join(__dirname, '../../public');
        this.app.use(express.static(publicPath));        // ヘルスチェックエンドポイント
        this.app.get('/health', (req: express.Request, res: express.Response<HealthCheckResponse>) => {
            const memoryUsage = process.memoryUsage();
            const response: HealthCheckResponse = {
                status: 'ok',
                timestamp: new Date().toISOString(),
                uptime: Date.now() - this.startTime,
                version: process.env.npm_package_version,
                services: {
                    lastfm: true, // TODO: 実際のLast.fm接続状態をチェック
                    discord: true, // TODO: 実際のDiscord接続状態をチェック
                    websocket: this.wss !== undefined
                }
            };
            res.json(response);
        });

        // サーバー統計情報エンドポイント
        this.app.get('/api/stats', (req: express.Request, res: express.Response) => {
            this.updateServerStats();
            res.json(createSuccessResponse(this.serverStats));
        });

        // 現在再生中の楽曲情報取得
        this.app.get('/api/now-playing', async (req: express.Request, res: express.Response): Promise<any> => {
            try {
                const nowPlaying = await this.lastFmService.getNowPlaying();
                this.serverStats.lastfmApiCalls++;

                const response = createSuccessResponse(nowPlaying);
                return res.json(response);
            } catch (error) {
                console.error('❌ NowPlaying情報取得エラー:', error);
                const errorResponse = createErrorResponse(
                    'Failed to fetch now playing info',
                    ApiErrorCode.LASTFM_API_ERROR,
                    { originalError: (error as Error).message }
                );
                return res.status(500).json(errorResponse);
            }
        });

        // 音楽レポート取得エンドポイント（統合）
        this.app.get('/api/reports/:period', async (req: express.Request, res: express.Response): Promise<any> => {
            try {
                const period = req.params.period as ReportPeriod;

                // パラメータバリデーション
                const queryValidation = validateReportQueryParams({
                    period,
                    ...req.query
                });

                if (!queryValidation.success) {
                    const errorResponse = createErrorResponse(
                        queryValidation.error || 'Invalid query parameters',
                        ApiErrorCode.INVALID_REQUEST
                    );
                    return res.status(400).json(errorResponse);
                }

                if (!['daily', 'weekly', 'monthly'].includes(period)) {
                    const errorResponse = createErrorResponse(
                        'Invalid period. Must be daily, weekly, or monthly',
                        ApiErrorCode.INVALID_REQUEST
                    );
                    return res.status(400).json(errorResponse);
                }

                const report = await this.lastFmService.generateMusicReportForApi(period);
                this.serverStats.reportsGenerated++;
                this.serverStats.lastReportTime = new Date().toISOString();

                const response = createSuccessResponse(report);
                res.json(response);
            } catch (error) {
                console.error(`❌ ${req.params.period}レポート取得エラー:`, error);
                const errorResponse = createErrorResponse(
                    `Failed to generate ${req.params.period} report`,
                    ApiErrorCode.REPORT_GENERATION_FAILED,
                    { originalError: (error as Error).message }
                );
                res.status(500).json(errorResponse);
            }
        });
    }

    /**
     * サーバー統計情報を更新
     */
    private updateServerStats(): void {
        const memoryUsage = process.memoryUsage();
        this.serverStats.uptime = Date.now() - this.startTime;
        this.serverStats.activeConnections = this.connectedClients.size;
        this.serverStats.memoryUsage = {
            used: memoryUsage.heapUsed,
            total: memoryUsage.heapTotal,
            percentage: Math.round((memoryUsage.heapUsed / memoryUsage.heapTotal) * 100)
        };
    }

    /**
     * WebSocketサーバーの設定
     */
    private setupWebSocket(): void {
        this.wss = new WebSocketServer({ server: this.server });

        this.wss.on('connection', (ws: WebSocket, req) => {
            const clientIp = req.socket.remoteAddress;
            console.log(`🔌 WebSocket接続: ${clientIp}`);

            this.connectedClients.add(ws);

            // 接続時に現在の楽曲情報を送信
            if (this.currentNowPlaying) {
                const nowPlayingMessage: NowPlayingWebSocketMessage = createWebSocketMessage(
                    'now-playing',
                    this.currentNowPlaying
                ) as NowPlayingWebSocketMessage;
                this.sendToClient(ws, nowPlayingMessage);
            }

            // 接続状況を送信
            const connectionMessage: ConnectionStatusWebSocketMessage = createWebSocketMessage(
                'connection-status',
                {
                    status: 'connected' as const,
                    clientCount: this.connectedClients.size,
                    clientId: clientIp
                }
            ) as ConnectionStatusWebSocketMessage;
            this.sendToClient(ws, connectionMessage);

            // 切断時の処理
            ws.on('close', () => {
                console.log(`🔌 WebSocket切断: ${clientIp}`);
                this.connectedClients.delete(ws);
            });

            // エラー処理
            ws.on('error', (error) => {
                console.error(`❌ WebSocketエラー (${clientIp}):`, error);
                this.connectedClients.delete(ws);
            });

            // メッセージ受信処理（バリデーション付き）
            ws.on('message', (message) => {
                try {
                    const rawData = JSON.parse(message.toString());
                    console.log(`📨 WebSocketメッセージ受信:`, rawData);

                    // クライアントメッセージのバリデーション
                    const validation = validateClientWebSocketMessage(rawData);
                    if (!validation.success) {
                        const errorMessage = createWebSocketMessage(
                            'error',
                            {
                                code: ApiErrorCode.WEBSOCKET_MESSAGE_INVALID,
                                message: validation.error || 'Invalid message format',
                                details: rawData
                            }
                        );
                        this.sendToClient(ws, errorMessage);
                        return;
                    }

                    const data = validation.data;

                    // pingメッセージへの応答
                    if (data.type === 'ping') {
                        const pongMessage = createWebSocketMessage(
                            'pong',
                            { originalTimestamp: data.timestamp }
                        );
                        this.sendToClient(ws, pongMessage);
                    }
                } catch (error) {
                    console.error('❌ WebSocketメッセージ解析エラー:', error);
                    const errorMessage = createWebSocketMessage(
                        'error',
                        {
                            code: ApiErrorCode.WEBSOCKET_MESSAGE_INVALID,
                            message: 'Failed to parse message',
                            details: { originalError: (error as Error).message }
                        }
                    );
                    this.sendToClient(ws, errorMessage);
                }
            });
        });
    }

    /**
     * 特定のクライアントにメッセージを送信
     */
    private sendToClient(ws: WebSocket, message: WebSocketMessage | any): void {
        if (ws.readyState === WebSocket.OPEN) {
            try {
                ws.send(JSON.stringify(message));
            } catch (error) {
                console.error('❌ WebSocketメッセージ送信エラー:', error);
            }
        }
    }

    /**
     * 全クライアントにメッセージをブロードキャスト
     */
    private broadcast(message: any): void {
        const messageStr = JSON.stringify(message);

        this.connectedClients.forEach((ws) => {
            if (ws.readyState === WebSocket.OPEN) {
                try {
                    ws.send(messageStr);
                } catch (error) {
                    console.error('❌ ブロードキャストエラー:', error);
                    this.connectedClients.delete(ws);
                }
            } else {
                this.connectedClients.delete(ws);
            }
        });
    }

    /**
     * NowPlaying情報を更新してブロードキャスト
     */
    public updateNowPlaying(nowPlaying: NowPlayingInfo): void {
        // 情報が変更された場合のみブロードキャスト
        const hasChanged = JSON.stringify(this.currentNowPlaying) !== JSON.stringify(nowPlaying);

        if (hasChanged) {
            this.currentNowPlaying = nowPlaying;

            const message: NowPlayingWebSocketMessage = {
                type: 'now-playing',
                data: nowPlaying,
                timestamp: new Date().toISOString()
            };

            this.broadcast(message);
            console.log(`📡 NowPlaying情報をブロードキャスト: ${this.connectedClients.size}クライアント`);
        }
    }

    /**
     * レポート更新通知をブロードキャスト
     */
    public notifyReportUpdate(period: ReportPeriod): void {
        const message: ReportUpdateWebSocketMessage = {
            type: 'report-update',
            data: {
                period,
                status: 'completed',
                message: `${period}レポートが更新されました`
            },
            timestamp: new Date().toISOString()
        };

        this.broadcast(message);
        console.log(`📊 ${period}レポート更新通知をブロードキャスト`);
    }

    /**
     * サーバーを起動
     */
    public start(): Promise<void> {
        return new Promise((resolve) => {
            this.server.listen(this.port, () => {
                console.log(`🚀 Webサーバーが起動しました: http://localhost:${this.port}`);
                console.log(`🔌 WebSocketサーバーが起動しました: ws://localhost:${this.port}`);
                console.log(`📊 APIエンドポイント:`);
                console.log(`   GET /api/now-playing - 現在再生中の楽曲`);
                console.log(`   GET /api/reports/{period} - 音楽レポート (daily/weekly/monthly)`);
                console.log(`   GET /api/stats - サーバー統計情報`);
                console.log(`   GET /health - ヘルスチェック`);
                console.log(`📈 機能:`);
                console.log(`   ✅ 型安全なAPIスキーマ`);
                console.log(`   ✅ ランタイムバリデーション`);
                console.log(`   ✅ レート制限 (100リクエスト/分)`);
                console.log(`   ✅ WebSocket型チェック`);
                resolve();
            });
        });
    }

    /**
     * サーバーを停止
     */
    public stop(): Promise<void> {
        return new Promise((resolve) => {
            // WebSocket接続を全て閉じる
            this.connectedClients.forEach((ws) => {
                ws.close();
            });
            this.connectedClients.clear();

            this.wss.close(() => {
                this.server.close(() => {
                    console.log('🛑 Webサーバーが停止しました');
                    resolve();
                });
            });
        });
    }

    /**
     * 接続クライアント数を取得
     */
    public getConnectedClientCount(): number {
        return this.connectedClients.size;
    }
}
