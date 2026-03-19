import express from 'express';
import cors from 'cors';
import path from 'path';
import fs from 'fs';
import { createServer } from 'http';
import { createServer as createHttpsServer } from 'https';
import { WebSocketServer, WebSocket } from 'ws';
import helmet from 'helmet';
import compression from 'compression';
import { config } from '../utils/config';
import { LastFmService } from './lastfm';
import { CacheService } from './cache';
import { DatabaseService } from './database';
import { 
    NowPlayingInfo, 
    DailyStatsItem, 
    WeeklyStatsItem, 
    MonthlyStatsItem 
} from '../types';
import {
    HealthCheckResponse,
    ApiErrorCode,
    WebSocketMessage,
    NowPlayingWebSocketMessage,
    ReportUpdateWebSocketMessage,
    ConnectionStatusWebSocketMessage,
    ServerStats,
    ReportPeriod,
    WeekDailyStatsApiResponse,
    MonthWeeklyStatsApiResponse,
    YearMonthlyStatsApiResponse,
} from '../schemas/api';
import {
    validateClientWebSocketMessage,
    createSuccessResponse,
    createErrorResponse,
    createWebSocketMessage,
    RateLimiter,
    validatePeriodRange,
} from '../schemas/validation';

// 汎用mkcert自動更新サブモジュールをインポート
const MkcertAutoRenewer = require('../../mkcert-auto-renewer/src/index.js');

/**
 * WebサーバーとWebSocketサーバーを統合したサービス
 * HTTP/HTTPS両対応、フロントエンド向けにLast.fm情報を再提供
 */
export class WebServerService {
    private app: express.Application;
    private httpServer: any;
    private httpsServer: any;
    private wss!: WebSocketServer;
    private lastFmService: LastFmService;
    private cacheService: CacheService;
    private databaseService: DatabaseService;
    private currentNowPlaying: NowPlayingInfo | null = null;
    private connectedClients: Set<WebSocket> = new Set();
    private readonly httpPort: number;
    private readonly httpsPort: number;
    private httpsEnabled: boolean;
    private rateLimiter: RateLimiter;
    private serverStats: ServerStats;
    private startTime: number;
    private mkcertRenewer: any; // MkcertAutoRenewer インスタンス

    constructor(port: number = 3001, lastFmService?: LastFmService, cacheService?: CacheService, databaseService?: DatabaseService) {
        this.httpPort = port;
        this.httpsPort = config.webServer.https.port;
        this.httpsEnabled = config.webServer.https.enabled;
        this.lastFmService = lastFmService || new LastFmService();
        this.databaseService = databaseService || new DatabaseService(config.cache.dbPath);
        this.cacheService = cacheService || new CacheService(this.databaseService, this.lastFmService);
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
        // setupServers()をstart()メソッドで呼ぶように変更
        this.setupWebSocket();
        
        // 汎用mkcert自動更新システムを初期化
        if (this.httpsEnabled) {
            const certDir = path.dirname(config.webServer.https.certPath);
            const certBaseName = path.basename(config.webServer.https.certPath, '.pem');
            
            // HTTPS_DOMAINS環境変数からドメインリストを取得
            const domainsList = process.env.HTTPS_DOMAINS?.split(',').map(d => d.trim()) || ['localhost', '127.0.0.1', '::1'];
            
            this.mkcertRenewer = new MkcertAutoRenewer({
                certPath: certDir,
                keyPath: certDir,
                certName: certBaseName,
                domains: domainsList
            });
            
            // 証明書変更イベントをリッスン
            this.mkcertRenewer.on('certificate-changed', () => {
                console.log('🔄 証明書が更新されました。再起動を推奨します。');
            });
            
            this.mkcertRenewer.on('generated', (info: any) => {
                console.log('✅ 証明書が生成されました:', info.certFile);
            });
        }
    }

    /**
     * Expressサーバーの設定
     */
    private setupExpress(): void {
        // セキュリティミドルウェア - 開発用にCSPを完全に無効化
        this.app.use(helmet({
            contentSecurityPolicy: false, // CSPを完全に無効化
            crossOriginEmbedderPolicy: false,
            crossOriginResourcePolicy: false,
        }));

        // Gzip圧縮
        this.app.use(compression());

        // CORS設定（動的インポートで循環依存を回避）
        const environment = process.env.NODE_ENV === 'production' ? 'production' : 'development';
        
        let corsOptions: any;
        try {
            const corsModule = require('../config/cors');
            corsOptions = corsModule.getExpressCorsOptions(environment);
        } catch (error) {
            console.warn('⚠️ CORS設定ファイルの読み込みに失敗しました。フォールバック設定を使用します:', error);
            // フォールバック設定
            const developmentOrigins = [
                'http://localhost:3000',
                'http://localhost:3001',
                'http://localhost:6001',
                'http://localhost:8000',
                'https://localhost:8000',
                'https://localhost:8443',
                'https://localhost:8444',
            ];
            
            corsOptions = {
                origin: environment === 'development' ? developmentOrigins : [],
                credentials: true
            };
        }
        
        console.log(`🌐 CORS設定を適用中... (環境: ${environment})`);
        console.log(`📋 許可されたオリジン:`, corsOptions.origin);
        
        this.app.use(cors(corsOptions));

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
        this.app.use(express.static(publicPath, {
            maxAge: '1d',
            etag: true,
            lastModified: true,
            setHeaders: (res, path) => {
                // キャッシュ設定
                if (path.endsWith('.js') || path.endsWith('.css')) {
                    res.setHeader('Cache-Control', 'public, max-age=31536000'); // 1年
                } else if (path.endsWith('.html')) {
                    res.setHeader('Cache-Control', 'no-cache');
                }
            }
        }));        // ヘルスチェックエンドポイント
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

        // 音楽レポート取得エンドポイント（統合）- ページネーション対応
        this.app.get('/api/reports/:period', async (req: express.Request, res: express.Response): Promise<any> => {
            try {
                const period = req.params.period as 'daily' | 'weekly' | 'monthly';
                // レート制限チェック
                if (!this.checkRateLimit(req, res)) {
                    return;
                }

                if (!['daily', 'weekly', 'monthly'].includes(period)) {
                    const errorResponse = createErrorResponse(
                        'Invalid period. Must be daily, weekly, or monthly',
                        ApiErrorCode.INVALID_REQUEST
                    );
                    return res.status(400).json(errorResponse);
                }
                
                // クエリパラメータを取得
                const targetDate = req.query.date as string | undefined;
                const limit = req.query.limit ? parseInt(req.query.limit as string) : 50;
                const page = req.query.page ? parseInt(req.query.page as string) : 1;
                
                // 日付のバリデーション（ISO 8601形式またはYYYY-MM-DD形式）
                if (targetDate && !/^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}:\d{2}(.\d+)?(Z|[+-]\d{2}:\d{2})?)?$/.test(targetDate)) {
                    const errorResponse = createErrorResponse(
                        'Invalid date format. Please use ISO 8601 format (YYYY-MM-DD or YYYY-MM-DDTHH:MM:SS.sssZ)',
                        ApiErrorCode.INVALID_REQUEST
                    );
                    return res.status(400).json(errorResponse);
                }

                // ページネーションパラメータのバリデーション
                if (limit < 1 || limit > 200) {
                    const errorResponse = createErrorResponse(
                        'Invalid limit. Must be between 1 and 200',
                        ApiErrorCode.INVALID_REQUEST
                    );
                    return res.status(400).json(errorResponse);
                }

                if (page < 1) {
                    const errorResponse = createErrorResponse(
                        'Invalid page. Must be 1 or greater',
                        ApiErrorCode.INVALID_REQUEST
                    );
                    return res.status(400).json(errorResponse);
                }
                
                console.log(`📊 ${period}レポートリクエスト受信${targetDate ? ` (指定日: ${targetDate})` : ''} - ページ: ${page}, 件数: ${limit}`);

                // 総件数取得用に一度全データを取得
                const fullReport = await this.lastFmService.generateMusicReport(period, { 
                    targetDate: targetDate
                });

                // ページネーション適用版を取得
                const report = await this.lastFmService.generateMusicReport(period, { 
                    targetDate: targetDate,
                    limit: limit,
                    page: page
                });
                
                this.serverStats.reportsGenerated++;
                this.serverStats.lastReportTime = new Date().toISOString();

                // ページネーション情報を含むレスポンス
                const totalTracks = fullReport.topTracks?.length || 0;
                const totalArtists = fullReport.topArtists?.length || 0;
                const totalAlbums = fullReport.topAlbums?.length || 0;
                
                const response = createSuccessResponse({
                    ...report,
                    pagination: {
                        page: page,
                        limit: limit,
                        totalTracks: totalTracks,
                        totalArtists: totalArtists,
                        totalAlbums: totalAlbums,
                        totalPagesForTracks: Math.ceil(totalTracks / limit),
                        totalPagesForArtists: Math.ceil(totalArtists / limit),
                        totalPagesForAlbums: Math.ceil(totalAlbums / limit)
                    }
                });
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

        // ユーザー統計情報取得エンドポイント
        this.app.get('/api/user-stats', async (req: express.Request, res: express.Response): Promise<any> => {
            try {
                const userStats = await this.lastFmService.getUserStats();
                this.serverStats.lastfmApiCalls++;

                const response = createSuccessResponse(userStats);
                return res.json(response);
            } catch (error) {
                console.error('❌ ユーザー統計情報取得エラー:', error);
                const errorResponse = createErrorResponse(
                    'Failed to fetch user statistics',
                    ApiErrorCode.LASTFM_API_ERROR,
                    { originalError: (error as Error).message }
                );
                return res.status(500).json(errorResponse);
            }
        });

        // 再生履歴取得エンドポイント
        this.app.get('/api/recent-tracks', async (req: express.Request, res: express.Response): Promise<any> => {
            try {
                const clientId = req.ip || req.socket.remoteAddress || 'unknown';
                if (!this.rateLimiter.checkRateLimit(clientId)) {
                    const errorResponse = createErrorResponse(
                        'Rate limit exceeded',
                        ApiErrorCode.RATE_LIMIT_EXCEEDED
                    );
                    return res.status(429).json(errorResponse);
                }

                // クエリパラメータを取得
                const limit = req.query.limit ? parseInt(req.query.limit as string) : 50;
                const page = req.query.page ? parseInt(req.query.page as string) : 1;
                const fromStr = req.query.from as string;
                const toStr = req.query.to as string;

                // 期間指定の解析
                let from: Date | undefined;
                let to: Date | undefined;

                if (fromStr) {
                    from = new Date(fromStr);
                    if (isNaN(from.getTime())) {
                        const errorResponse = createErrorResponse(
                            'Invalid from date format. Use ISO 8601 format (YYYY-MM-DDTHH:mm:ss.sssZ)',
                            ApiErrorCode.INVALID_REQUEST
                        );
                        return res.status(400).json(errorResponse);
                    }
                }

                if (toStr) {
                    to = new Date(toStr);
                    if (isNaN(to.getTime())) {
                        const errorResponse = createErrorResponse(
                            'Invalid to date format. Use ISO 8601 format (YYYY-MM-DDTHH:mm:ss.sssZ)',
                            ApiErrorCode.INVALID_REQUEST
                        );
                        return res.status(400).json(errorResponse);
                    }
                }

                // バリデーション
                if (limit < 1 || limit > 200) {
                    const errorResponse = createErrorResponse(
                        'Invalid limit. Must be between 1 and 200',
                        ApiErrorCode.INVALID_REQUEST
                    );
                    return res.status(400).json(errorResponse);
                }

                if (page < 1) {
                    const errorResponse = createErrorResponse(
                        'Invalid page. Must be 1 or greater',
                        ApiErrorCode.INVALID_REQUEST
                    );
                    return res.status(400).json(errorResponse);
                }

                // デフォルトの期間設定（指定がない場合は過去1週間）
                if (!from && !to) {
                    to = new Date();
                    from = new Date(to.getTime() - 7 * 24 * 60 * 60 * 1000);
                }

                // キャッシュからデータを取得
                const result = await this.cacheService.getTracksFromCache(
                    from || new Date(0),
                    to || new Date(),
                    limit,
                    page
                );

                const response = createSuccessResponse({
                    tracks: result.tracks,
                    pagination: {
                        page,
                        limit,
                        total: result.total,
                        totalPages: Math.ceil(result.total / limit)
                    },
                    period: {
                        from: from?.toISOString(),
                        to: to?.toISOString()
                    }
                });

                res.json(response);
            } catch (error) {
                console.error('❌ 再生履歴取得エラー:', error);
                const errorResponse = createErrorResponse(
                    'Failed to get recent tracks',
                    ApiErrorCode.LASTFM_API_ERROR,
                    { originalError: (error as Error).message }
                );
                res.status(500).json(errorResponse);
            }
        });
        
        // 週間詳細統計取得エンドポイント（週の各日の再生数）
        this.app.get('/api/stats/week-daily', async (req: express.Request, res: express.Response): Promise<any> => {
            try {
                // レート制限チェック
                if (!this.checkRateLimit(req, res)) {
                    return;
                }

                // パラメータの取得
                const { from, to, date } = req.query;
                const params = {
                    from: from as string | undefined,
                    to: to as string | undefined,
                    date: date as string | undefined
                };
                
                // 期間指定パラメータの検証
                let validatedRange;
                try {
                    validatedRange = validatePeriodRange(params, 'week-daily');
                } catch (validationError) {
                    const errorResponse = createErrorResponse(
                        (validationError as Error).message,
                        ApiErrorCode.INVALID_REQUEST
                    );
                    return res.status(400).json(errorResponse);
                }
                
                console.log(`📊 週間詳細統計リクエスト受信 (${validatedRange.from.toLocaleDateString('ja-JP')} - ${validatedRange.to.toLocaleDateString('ja-JP')})`);
                
                // 週の各日の再生数統計を取得
                const stats: DailyStatsItem[] = await this.lastFmService.getWeekDailyStats(validatedRange.from, validatedRange.to);
                
                // API呼び出しをカウント
                this.serverStats.lastfmApiCalls++;
                
                const response = createSuccessResponse<WeekDailyStatsApiResponse['data']>({
                    stats,
                    meta: {
                        total: stats.reduce((sum, day) => sum + day.scrobbles, 0),
                        period: 'week',
                        referenceDate: validatedRange.originalParams.date,
                        from: validatedRange.from.toISOString().split('T')[0],
                        to: validatedRange.to.toISOString().split('T')[0],
                        isRangeMode: validatedRange.isRangeMode
                    }
                });
                
                return res.json(response);
            } catch (error) {
                console.error('❌ 週間詳細統計取得エラー:', error);
                const errorResponse = createErrorResponse(
                    'Failed to fetch weekly detailed statistics',
                    ApiErrorCode.LASTFM_API_ERROR,
                    { originalError: (error as Error).message }
                );
                return res.status(500).json(errorResponse);
            }
        });
        
        // 月間詳細統計取得エンドポイント（月の各週の再生数）
        this.app.get('/api/stats/month-weekly', async (req: express.Request, res: express.Response): Promise<any> => {
            try {
                // レート制限チェック
                if (!this.checkRateLimit(req, res)) {
                    return;
                }

                // パラメータの取得
                const { from, to, date } = req.query;
                const params = {
                    from: from as string | undefined,
                    to: to as string | undefined,
                    date: date as string | undefined
                };
                
                // 期間指定パラメータの検証
                let validatedRange;
                try {
                    validatedRange = validatePeriodRange(params, 'month-weekly');
                } catch (validationError) {
                    const errorResponse = createErrorResponse(
                        (validationError as Error).message,
                        ApiErrorCode.INVALID_REQUEST
                    );
                    return res.status(400).json(errorResponse);
                }
                
                console.log(`📊 月間詳細統計リクエスト受信 (${validatedRange.from.toLocaleDateString('ja-JP')} - ${validatedRange.to.toLocaleDateString('ja-JP')})`);
                
                // 月の各週の再生数統計を取得
                const stats: WeeklyStatsItem[] = await this.lastFmService.getMonthWeeklyStats(validatedRange.from, validatedRange.to);
                
                // API呼び出しをカウント
                this.serverStats.lastfmApiCalls++;
                
                // 期間情報の取得
                const monthYear = validatedRange.from.getFullYear();
                const monthNum = validatedRange.from.getMonth() + 1;
                
                const response = createSuccessResponse<MonthWeeklyStatsApiResponse['data']>({
                    stats,
                    meta: {
                        total: stats.reduce((sum, week) => sum + week.scrobbles, 0),
                        period: 'month',
                        month: monthNum,
                        year: monthYear,
                        label: `${monthYear}年${monthNum}月`,
                        referenceDate: validatedRange.originalParams.date,
                        from: validatedRange.from.toISOString().split('T')[0],
                        to: validatedRange.to.toISOString().split('T')[0],
                        isRangeMode: validatedRange.isRangeMode
                    }
                });
                
                return res.json(response);
            } catch (error) {
                console.error('❌ 月間詳細統計取得エラー:', error);
                const errorResponse = createErrorResponse(
                    'Failed to fetch monthly detailed statistics',
                    ApiErrorCode.LASTFM_API_ERROR,
                    { originalError: (error as Error).message }
                );
                return res.status(500).json(errorResponse);
            }
        });
        
        // 年間詳細統計取得エンドポイント（年の各月の再生数）
        this.app.get('/api/stats/year-monthly', async (req: express.Request, res: express.Response): Promise<any> => {
            try {
                // レート制限チェック
                if (!this.checkRateLimit(req, res)) {
                    return;
                }

                // パラメータの取得
                const { from, to, year } = req.query;
                
                // 年パラメータが指定されている場合は、年の1/1〜12/31に変換
                let params;
                if (year) {
                    // 年のバリデーション
                    if (!/^\d{4}$/.test(year as string)) {
                        const errorResponse = createErrorResponse(
                            'Invalid year format. Please use YYYY format',
                            ApiErrorCode.INVALID_REQUEST
                        );
                        return res.status(400).json(errorResponse);
                    }
                    
                    const yearNum = parseInt(year as string);
                    params = {
                        from: `${yearNum}-01-01`,
                        to: `${yearNum}-12-31`,
                        date: undefined
                    };
                } else {
                    params = {
                        from: from as string | undefined,
                        to: to as string | undefined,
                        date: undefined
                    };
                }
                
                // 期間指定パラメータの検証
                let validatedRange;
                try {
                    validatedRange = validatePeriodRange(params, 'year-monthly');
                } catch (validationError) {
                    const errorResponse = createErrorResponse(
                        (validationError as Error).message,
                        ApiErrorCode.INVALID_REQUEST
                    );
                    return res.status(400).json(errorResponse);
                }
                
                console.log(`📊 年間詳細統計リクエスト受信 (${validatedRange.from.toLocaleDateString('ja-JP')} - ${validatedRange.to.toLocaleDateString('ja-JP')})`);
                
                // 年の各月の再生数統計を取得
                const stats: MonthlyStatsItem[] = await this.lastFmService.getYearMonthlyStats(validatedRange.from, validatedRange.to);
                
                // API呼び出しをカウント
                this.serverStats.lastfmApiCalls++;
                
                const yearNum = validatedRange.from.getFullYear();
                
                const response = createSuccessResponse<YearMonthlyStatsApiResponse['data']>({
                    stats,
                    meta: {
                        total: stats.reduce((sum, month) => sum + month.scrobbles, 0),
                        period: 'year',
                        year: yearNum,
                        label: `${yearNum}年`,
                        from: validatedRange.from.toISOString().split('T')[0],
                        to: validatedRange.to.toISOString().split('T')[0],
                        isRangeMode: validatedRange.isRangeMode || !!year
                    }
                });
                
                return res.json(response);
            } catch (error) {
                console.error('❌ 年間詳細統計取得エラー:', error);
                const errorResponse = createErrorResponse(
                    'Failed to fetch yearly detailed statistics',
                    ApiErrorCode.LASTFM_API_ERROR,
                    { originalError: (error as Error).message }
                );
                return res.status(500).json(errorResponse);
            }
        });
        
        // キャッシュ統計情報エンドポイント
        this.app.get('/api/cache/stats', async (req: express.Request, res: express.Response) => {
            try {
                const stats = await this.cacheService.getCacheStats();
                res.json(createSuccessResponse(stats));
            } catch (error) {
                console.error('❌ キャッシュ統計取得エラー:', error);
                const errorResponse = createErrorResponse(
                    'Failed to get cache statistics',
                    ApiErrorCode.LASTFM_API_ERROR,
                    { originalError: (error as Error).message }
                );
                res.status(500).json(errorResponse);
            }
        });

        // 手動キャッシュ同期エンドポイント
        this.app.post('/api/cache/sync', async (req: express.Request, res: express.Response) => {
            try {
                await this.cacheService.syncRecentTracks();
                res.json(createSuccessResponse({ message: 'Cache sync completed' }));
            } catch (error) {
                console.error('❌ 手動キャッシュ同期エラー:', error);
                const errorResponse = createErrorResponse(
                    'Failed to sync cache',
                    ApiErrorCode.LASTFM_API_ERROR,
                    { originalError: (error as Error).message }
                );
                res.status(500).json(errorResponse);
            }
        });

        // キャッシュクリーンアップエンドポイント
        this.app.delete('/api/cache/cleanup', async (req: express.Request, res: express.Response) => {
            try {
                const days = req.query.days ? parseInt(req.query.days as string) : 90;
                const deleted = await this.cacheService.cleanupOldData(days);
                res.json(createSuccessResponse({ message: `Deleted ${deleted} old records` }));
            } catch (error) {
                console.error('❌ キャッシュクリーンアップエラー:', error);
                const errorResponse = createErrorResponse(
                    'Failed to cleanup cache',
                    ApiErrorCode.LASTFM_API_ERROR,
                    { originalError: (error as Error).message }
                );
                res.status(500).json(errorResponse);
            }
        });

        // データベースバキュームエンドポイント
        this.app.post('/api/cache/vacuum', async (req: express.Request, res: express.Response) => {
            try {
                await this.cacheService.vacuum();
                res.json(createSuccessResponse({ message: 'Database vacuum completed' }));
            } catch (error) {
                console.error('❌ データベースバキュームエラー:', error);
                const errorResponse = createErrorResponse(
                    'Failed to vacuum database',
                    ApiErrorCode.LASTFM_API_ERROR,
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
     * HTTPおよびHTTPSサーバーの設定
     */
    private async setupServers(): Promise<void> {
        // HTTPサーバー
        this.httpServer = createServer(this.app);

        // HTTPSサーバー（証明書が利用可能な場合）
        if (this.httpsEnabled) {
            try {
                // mkcert自動更新システムを使用してHTTPS設定を取得
                if (this.mkcertRenewer) {
                    const httpsResult = await this.mkcertRenewer.getExpressHttpsOptions();
                    if (httpsResult.success) {
                        this.httpsServer = createHttpsServer(httpsResult.httpsOptions, this.app);
                        console.log('✅ mkcert証明書が読み込まれました（自動更新システム統合済み）');
                        console.log(`📁 証明書: ${httpsResult.certFile}`);
                        console.log(`🔑 秘密鍵: ${httpsResult.keyFile}`);
                    } else {
                        throw new Error(httpsResult.error);
                    }
                } else {
                    // フォールバック: 従来の方式
                    const httpsOptions = {
                        key: fs.readFileSync(config.webServer.https.keyPath),
                        cert: fs.readFileSync(config.webServer.https.certPath),
                    };
                    this.httpsServer = createHttpsServer(httpsOptions, this.app);
                    console.log('✅ HTTPS証明書が読み込まれました（従来方式）');
                }
            } catch (error) {
                console.warn('⚠️ HTTPS証明書の読み込みに失敗しました:', error);
                console.warn('⚠️ HTTPSサーバーを無効化します');
                this.httpsEnabled = false;
            }
        }
    }

    /**
     * WebSocketサーバーの設定
     */
    private setupWebSocket(): void {
        // WebSocketサーバーの初期化は後で行う（setupServers後）
    }

    /**
     * WebSocketサーバーを初期化
     */
    private initializeWebSocket(): void {
        // プライマリサーバー（HTTPSが有効な場合はHTTPS、そうでなければHTTP）
        const primaryServer = this.httpsEnabled && this.httpsServer ? this.httpsServer : this.httpServer;
        this.wss = new WebSocketServer({ server: primaryServer });

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
    public async start(): Promise<void> {
        // キャッシュサービスの初期化
        await this.cacheService.initialize();
        
        // mkcert自動更新システムを起動前に設定
        if (this.httpsEnabled && this.mkcertRenewer) {
            try {
                console.log('🔐 mkcert自動更新システムを初期化しています...');
                
                // 証明書が存在しない場合は生成
                const certExists = fs.existsSync(config.webServer.https.certPath) && 
                                  fs.existsSync(config.webServer.https.keyPath);
                
                if (!certExists) {
                    console.log('🔄 証明書が見つかりません。新しい証明書を生成します...');
                    // HTTPS_DOMAINS環境変数からドメインリストを取得
                    const domainsList = process.env.HTTPS_DOMAINS?.split(',').map(d => d.trim()) || ['localhost', '127.0.0.1', '::1'];
                    console.log(`🔐 証明書ドメイン: ${domainsList.join(', ')}`);
                    const result = await this.mkcertRenewer.generate(domainsList);
                    if (result.success) {
                        console.log('✅ 証明書が生成されました');
                        console.log(`📁 証明書: ${result.certFile}`);
                        console.log(`🔑 秘密鍵: ${result.keyFile}`);
                    } else {
                        console.warn('⚠️ 証明書の生成に失敗しました:', result.error);
                        this.httpsEnabled = false;
                    }
                } else {
                    // 証明書の有効性をチェック
                    console.log('🔍 証明書の有効性をチェックしています...');
                    const needsRenewal = await this.mkcertRenewer.needsRenewal();
                    
                    if (needsRenewal) {
                        console.log('🔄 証明書の更新が必要です。新しい証明書を生成します...');
                        // HTTPS_DOMAINS環境変数からドメインリストを取得
                        const domainsList = process.env.HTTPS_DOMAINS?.split(',').map(d => d.trim()) || ['localhost', '127.0.0.1', '::1'];
                        console.log(`🔐 証明書ドメイン: ${domainsList.join(', ')}`);
                        const result = await this.mkcertRenewer.generate(domainsList);
                        if (result.success) {
                            console.log('✅ 証明書が更新されました');
                        } else {
                            console.warn('⚠️ 証明書の更新に失敗しました');
                        }
                    }
                }
                
                // 自動更新スケジュールを設定（毎週日曜日 2:00 AM）
                await this.mkcertRenewer.scheduleAutoRenewal();
                console.log('📅 証明書の自動更新スケジュールを設定しました');
                
                // 証明書変更の監視を開始
                this.mkcertRenewer.startWatching((filePath: string) => {
                    console.log(`📝 証明書ファイル変更を検知: ${filePath}`);
                    console.log('💡 サーバーの再起動を推奨します');
                });
                
                console.log('🔐 mkcert自動更新システムが有効になりました');
            } catch (error) {
                console.warn('⚠️ mkcert自動更新システムの初期化に失敗:', error);
                console.warn('⚠️ 手動での証明書管理が必要です');
            }
        }

        // サーバーをセットアップ
        await this.setupServers();

        // WebSocketを初期化
        this.initializeWebSocket();

        return new Promise((resolve) => {
            let serversStarted = 0;
            const expectedServers = this.httpsEnabled ? 2 : 1;

            const checkAllStarted = () => {
                serversStarted++;
                if (serversStarted === expectedServers) {
                    resolve();
                }
            };

            // HTTPサーバーを起動
            this.httpServer.listen(this.httpPort, () => {
                console.log(`🚀 HTTPサーバーが起動しました: http://localhost:${this.httpPort}`);
                console.log(`🔌 WebSocketサーバーが起動しました: ws://localhost:${this.httpPort}`);
                checkAllStarted();
            });

            // HTTPSサーバーを起動（有効な場合）
            if (this.httpsEnabled && this.httpsServer) {
                this.httpsServer.listen(this.httpsPort, () => {
                    console.log(`🔒 HTTPSサーバーが起動しました: https://localhost:${this.httpsPort}`);
                    console.log(`🔐 WSS WebSocketサーバーが起動しました: wss://localhost:${this.httpsPort}`);
                    console.log(`🛡️ HTTPS enabled with SSL/TLS certificate`);
                    checkAllStarted();
                });
            }

            // APIエンドポイント情報を表示
            console.log(`📊 APIエンドポイント:`);
            console.log(`   GET /api/now-playing - 現在再生中の楽曲`);
            console.log(`   GET /api/user-stats - ユーザー統計情報`);
            console.log(`   GET /api/recent-tracks - 再生履歴取得 (ページネーション対応)`);
            console.log(`   GET /api/reports/{period} - 音楽レポート (daily/weekly/monthly) (ページネーション対応)`);
            console.log(`   GET /api/stats - サーバー統計情報`);
            console.log(`   GET /health - ヘルスチェック`);
            console.log(`📈 機能:`);
            console.log(`   ✅ 型安全なAPIスキーマ`);
            console.log(`   ✅ ランタイムバリデーション`);
            console.log(`   ✅ レート制限 (100リクエスト/分)`);
            console.log(`   ✅ ページネーション (limit/page)`);
            console.log(`   ✅ WebSocket型チェック`);
            console.log(`   ✅ HTTPS/WSS対応`);
            console.log(`   ✅ セキュリティヘッダー`);
            console.log(`   ✅ Gzip圧縮`);
            
            if (this.httpsEnabled && this.mkcertRenewer) {
                console.log(`   ✅ 証明書自動更新システム`);
                console.log(`   ✅ 証明書変更監視`);
                console.log(`   ✅ クロスプラットフォーム対応`);
            }
        });
    }

    /**
     * サーバーを停止
     */
    public stop(): Promise<void> {
        return new Promise((resolve) => {
            console.log('🛑 サーバーを停止しています...');
            
            // キャッシュサービスの終了
            this.cacheService.close().catch(err => {
                console.warn('⚠️ キャッシュサービス停止中にエラー:', err);
            });
            
            // mkcert自動更新システムのリソースクリーンアップ
            if (this.mkcertRenewer) {
                try {
                    this.mkcertRenewer.stopWatching();
                    this.mkcertRenewer.destroy();
                    console.log('🔐 mkcert自動更新システムが停止しました');
                } catch (error) {
                    console.warn('⚠️ mkcert自動更新システムの停止中にエラー:', error);
                }
            }

            // WebSocket接続を全て閉じる
            this.connectedClients.forEach((ws) => {
                try {
                    ws.close();
                } catch (error) {
                    console.warn('⚠️ WebSocket接続の切断中にエラー:', error);
                }
            });
            this.connectedClients.clear();

            let serversClosed = 0;
            const expectedServers = this.httpsEnabled && this.httpsServer ? 2 : 1;
            let resolved = false;

            const checkAllClosed = () => {
                serversClosed++;
                if (serversClosed === expectedServers && !resolved) {
                    resolved = true;
                    console.log('🛑 全てのサーバーが停止しました');
                    resolve();
                }
            };

            // タイムアウト処理（10秒後に強制終了）
            const timeout = setTimeout(() => {
                if (!resolved) {
                    resolved = true;
                    console.warn('⚠️ サーバー停止がタイムアウトしました。強制終了します。');
                    resolve();
                }
            }, 10000);

            // WebSocketサーバーを停止
            if (this.wss) {
                try {
                    this.wss.close(() => {
                        console.log('🛑 WebSocketサーバーが停止しました');
                        
                        // HTTPサーバーを停止
                        if (this.httpServer) {
                            this.httpServer.close((err: Error | undefined) => {
                                if (err) {
                                    console.warn('⚠️ HTTPサーバーの停止中にエラー:', err);
                                } else {
                                    console.log('🛑 HTTPサーバーが停止しました');
                                }
                                checkAllClosed();
                            });
                        } else {
                            checkAllClosed();
                        }

                        // HTTPSサーバーを停止（有効な場合）
                        if (this.httpsEnabled && this.httpsServer) {
                            this.httpsServer.close((err: Error | undefined) => {
                                if (err) {
                                    console.warn('⚠️ HTTPSサーバーの停止中にエラー:', err);
                                } else {
                                    console.log('🛑 HTTPSサーバーが停止しました');
                                }
                                checkAllClosed();
                            });
                        }
                    });
                } catch (error) {
                    console.warn('⚠️ WebSocketサーバーの停止中にエラー:', error);
                    checkAllClosed();
                }
            } else {
                // WebSocketサーバーが存在しない場合
                if (this.httpServer) {
                    this.httpServer.close((err: Error | undefined) => {
                        if (err) {
                            console.warn('⚠️ HTTPサーバーの停止中にエラー:', err);
                        } else {
                            console.log('🛑 HTTPサーバーが停止しました');
                        }
                        checkAllClosed();
                    });
                } else {
                    checkAllClosed();
                }

                if (this.httpsEnabled && this.httpsServer) {
                    this.httpsServer.close((err: Error | undefined) => {
                        if (err) {
                            console.warn('⚠️ HTTPSサーバーの停止中にエラー:', err);
                        } else {
                            console.log('🛑 HTTPSサーバーが停止しました');
                        }
                        checkAllClosed();
                    });
                }
            }

            // タイムアウトをクリア
            if (resolved) {
                clearTimeout(timeout);
            }
        });
    }

    /**
     * レート制限をチェックし、制限超過の場合はエラーレスポンスを返す
     * @param req リクエストオブジェクト
     * @param res レスポンスオブジェクト
     * @returns 制限内の場合はtrue、超過の場合はfalse
     */
    private checkRateLimit(req: express.Request, res: express.Response): boolean {
        // クライアントのIPアドレスを取得（X-Forwarded-Forヘッダーがあればそれを使用）
        const clientIp = req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'unknown';
        const clientId = clientIp.toString();
        
        // rateLimiterが初期化されていない場合は常に許可
        if (!this.rateLimiter) {
            return true;
        }
        
        // レート制限をチェック
        if (!this.rateLimiter.checkRateLimit(clientId)) {
            console.warn(`⚠️ レート制限超過: ${clientId} (${req.method} ${req.path})`);
            
            const stats = this.rateLimiter.getClientStats(clientId);
            const errorResponse = createErrorResponse(
                'Rate limit exceeded. Please try again later.',
                ApiErrorCode.RATE_LIMIT_EXCEEDED,
                { 
                  requestCount: stats.requestCount,
                  remainingRequests: stats.remainingRequests,
                  resetTime: stats.resetTime
                }
            );
            
            res.status(429).json(errorResponse);
            return false;
        }
        
        return true;
    }


}
