import express from 'express';
import cors from 'cors';
import path from 'path';
import { createServer } from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import { LastFmService } from './lastfm';
import { NowPlayingInfo, MusicReport } from '../types';
import { config } from '../utils/config';

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

    constructor(port: number = 3001) {
        this.port = port;
        this.lastFmService = new LastFmService();
        this.app = express();
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

        // 静的ファイル配信（テスト用HTMLなど）
        const publicPath = path.join(__dirname, '../../public');
        this.app.use(express.static(publicPath));    // ヘルスチェックエンドポイント
        this.app.get('/health', (req: any, res: any) => {
            res.json({
                status: 'ok',
                timestamp: new Date().toISOString(),
                service: 'Last.fm Bridge Server',
                connectedClients: this.connectedClients.size
            });
        });

        // 現在再生中の楽曲情報取得
        this.app.get('/api/now-playing', async (req: any, res: any) => {
            try {
                const nowPlaying = await this.lastFmService.getNowPlaying();
                res.json({
                    success: true,
                    data: nowPlaying,
                    timestamp: new Date().toISOString()
                });
            } catch (error) {
                console.error('❌ NowPlaying情報取得エラー:', error);
                res.status(500).json({
                    success: false,
                    error: 'Failed to fetch now playing info',
                    timestamp: new Date().toISOString()
                });
            }
        });

        // 音楽レポート取得エンドポイント（日次）
        this.app.get('/api/reports/daily', async (req: any, res: any) => {
            try {
                const report = await this.lastFmService.generateMusicReportForApi('daily');
                res.json({
                    success: true,
                    data: report,
                    timestamp: new Date().toISOString()
                });
            } catch (error) {
                console.error('❌ 日次レポート取得エラー:', error);
                res.status(500).json({
                    success: false,
                    error: 'Failed to generate daily report',
                    timestamp: new Date().toISOString()
                });
            }
        });

        // 音楽レポート取得エンドポイント（週次）
        this.app.get('/api/reports/weekly', async (req: any, res: any) => {
            try {
                const report = await this.lastFmService.generateMusicReportForApi('weekly');
                res.json({
                    success: true,
                    data: report,
                    timestamp: new Date().toISOString()
                });
            } catch (error) {
                console.error('❌ 週次レポート取得エラー:', error);
                res.status(500).json({
                    success: false,
                    error: 'Failed to generate weekly report',
                    timestamp: new Date().toISOString()
                });
            }
        });

        // 音楽レポート取得エンドポイント（月次）
        this.app.get('/api/reports/monthly', async (req: any, res: any) => {
            try {
                const report = await this.lastFmService.generateMusicReportForApi('monthly');
                res.json({
                    success: true,
                    data: report,
                    timestamp: new Date().toISOString()
                });
            } catch (error) {
                console.error('❌ 月次レポート取得エラー:', error);
                res.status(500).json({
                    success: false,
                    error: 'Failed to generate monthly report',
                    timestamp: new Date().toISOString()
                });
            }
        });
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
                this.sendToClient(ws, {
                    type: 'now-playing',
                    data: this.currentNowPlaying,
                    timestamp: new Date().toISOString()
                });
            }

            // 接続状況を送信
            this.sendToClient(ws, {
                type: 'connection-status',
                data: {
                    connected: true,
                    clientCount: this.connectedClients.size
                },
                timestamp: new Date().toISOString()
            });

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

            // メッセージ受信処理（必要に応じて拡張）
            ws.on('message', (message) => {
                try {
                    const data = JSON.parse(message.toString());
                    console.log(`📨 WebSocketメッセージ受信:`, data);

                    // pingメッセージへの応答
                    if (data.type === 'ping') {
                        this.sendToClient(ws, {
                            type: 'pong',
                            timestamp: new Date().toISOString()
                        });
                    }
                } catch (error) {
                    console.error('❌ WebSocketメッセージ解析エラー:', error);
                }
            });
        });
    }

    /**
     * 特定のクライアントにメッセージを送信
     */
    private sendToClient(ws: WebSocket, message: any): void {
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

            this.broadcast({
                type: 'now-playing',
                data: nowPlaying,
                timestamp: new Date().toISOString()
            });

            console.log(`📡 NowPlaying情報をブロードキャスト: ${this.connectedClients.size}クライアント`);
        }
    }

    /**
     * レポート更新通知をブロードキャスト
     */
    public notifyReportUpdate(period: 'daily' | 'weekly' | 'monthly'): void {
        this.broadcast({
            type: 'report-updated',
            data: {
                period,
                message: `${period}レポートが更新されました`
            },
            timestamp: new Date().toISOString()
        });

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
                console.log(`   GET /api/reports/daily - 日次レポート`);
                console.log(`   GET /api/reports/weekly - 週次レポート`);
                console.log(`   GET /api/reports/monthly - 月次レポート`);
                console.log(`   GET /health - ヘルスチェック`);
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
