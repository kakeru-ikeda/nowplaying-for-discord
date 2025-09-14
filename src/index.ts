import { LastFmService } from './services/lastfm';
import { DiscordRPCService } from './services/discord-rpc';
import { DiscordBotService } from './services/discord-bot';
import { SchedulerService } from './services/scheduler';
import { WebServerService } from './services/web-server';
import { CacheService } from './services/cache';
import { DatabaseService } from './services/database';
import { config, validateEnvironment } from './utils/config';
import { SpotifyService } from './services/spotify';

class MusicStatusApp {
  private lastFmService: LastFmService;
  private spotifyService: SpotifyService;
  private discordRPCService: DiscordRPCService;
  private discordBotService: DiscordBotService;
  private schedulerService: SchedulerService;
  private webServerService: WebServerService;
  private cacheService: CacheService;
  private databaseService: DatabaseService;
  private intervalId: NodeJS.Timeout | null = null;
  private lastTrackInfo: string | null = null; // 重複通知防止用

  constructor() {
    // データベースサービスの初期化
    this.databaseService = new DatabaseService();

    // Spotifyサービスの初期化
    this.spotifyService = new SpotifyService(this.databaseService);

    // サービスの初期化（データベースサービスを渡す）
    this.lastFmService = new LastFmService(this.databaseService);
    this.discordRPCService = new DiscordRPCService(this.spotifyService);
    this.discordBotService = new DiscordBotService();

    // キャッシュサービスの初期化
    this.cacheService = new CacheService(this.databaseService, this.lastFmService);

    // スケジューラサービスの初期化（キャッシュサービスとデータベースサービスを含む）
    this.schedulerService = new SchedulerService(this.lastFmService, this.discordBotService, this.cacheService);

    // Webサーバーサービスの初期化
    this.webServerService = new WebServerService(
      config.webServer.port,
      this.lastFmService,
      this.cacheService,
      this.databaseService,
      this.spotifyService
    );
  }

  async start(): Promise<void> {
    try {
      console.log('🚀 Music Status App を起動しています...');

      // 環境変数の検証
      validateEnvironment();

      // データベースとキャッシュシステムの初期化
      console.log('💾 データベースとキャッシュシステムを初期化しています...');
      await this.databaseService.initialize();
      await this.cacheService.initialize();

      // 既存の初期化処理...
      console.log('🎵 Last.fm サービスを初期化しています...');

      console.log(`📊 設定情報:`);
      console.log(`  - Last.fm ユーザー: ${config.lastfm.username}`);
      console.log(`  - 更新間隔: ${config.updateInterval / 1000}秒`);
      console.log(`  - ナウプレイング通知: ${config.discord.nowPlayingChannelId ? '有効' : '無効'}`);
      console.log(`  - Webサーバーポート: ${config.webServer.port}`);
      console.log(`  - CORS: ${config.webServer.enableCors ? '有効' : '無効'}`);

      // Discord RPC接続
      await this.discordRPCService.connect();

      // Discord Bot接続
      await this.discordBotService.connect();

      // Webサーバー開始
      await this.webServerService.start();

      // スケジューラー開始
      this.schedulerService.start();

      // 初回実行
      await this.updateStatus();

      // 定期実行の開始
      this.intervalId = setInterval(async () => {
        await this.updateStatus();
      }, config.updateInterval);

      console.log(`✅ アプリが開始されました`);
      console.log('💡 終了するには Ctrl+C を押してください');
      console.log('🌐 テストクライアント: http://localhost:' + config.webServer.port + '/test-client.html');

      // 終了処理の設定
      process.on('SIGINT', () => this.shutdown());
      process.on('SIGTERM', () => this.shutdown());

    } catch (error) {
      console.error('❌ アプリ開始エラー:', error);
      process.exit(1);
    }
  }

  private async updateStatus(): Promise<void> {
    try {
      const nowPlaying = await this.lastFmService.getNowPlaying();

      if (nowPlaying && nowPlaying.isPlaying) {
        await this.discordRPCService.updateActivity(nowPlaying);

        // ナウプレイング通知（重複防止）
        const currentTrackInfo = `${nowPlaying.artist} - ${nowPlaying.track}`;
        if (this.lastTrackInfo !== currentTrackInfo) {
          await this.discordBotService.sendNowPlayingNotification(nowPlaying);
          // WebSocketクライアントにもブロードキャスト
          this.webServerService.updateNowPlaying(nowPlaying);
          this.lastTrackInfo = currentTrackInfo;
          console.log(`🎵 新しい楽曲: ${currentTrackInfo}`);
        }
      } else if (nowPlaying && !nowPlaying.isPlaying) {
        // 楽曲が停止された場合：Discordステータスをクリア
        await this.discordRPCService.clearActivity();

        // WebSocketクライアントにも停止情報をブロードキャスト
        this.webServerService.updateNowPlaying(nowPlaying);

        // 重複通知防止をリセット（次の楽曲再生時に通知するため）
        if (this.lastTrackInfo !== null) {
          this.lastTrackInfo = null;
          console.log('⏹️ 楽曲再生停止：Discordステータスをクリアしました');
        }
      } else {
        // nowPlayingがnullの場合（API取得失敗等）
        console.log('⚠️ 楽曲情報を取得できませんでした');
      }
    } catch (error) {
      console.error('❌ ステータス更新エラー:', error);
    }
  }

  private async shutdown(): Promise<void> {
    console.log('\n🛑 アプリを終了しています...');

    try {
      // 定期実行を停止
      if (this.intervalId) {
        clearInterval(this.intervalId);
        console.log('⏱️ 定期実行タイマーを停止しました');
      }

      // 各サービスの停止を並列実行（タイムアウト付き）
      const stopPromises = [
        this.stopWithTimeout('📅 スケジューラーサービス', () => this.schedulerService.stop(), 5000),
        this.stopWithTimeout('🌐 Webサーバーサービス', () => this.webServerService.stop(), 10000),
        this.stopWithTimeout('🎮 Discord RPCサービス', () => this.discordRPCService.disconnect(), 3000),
        this.stopWithTimeout('🤖 Discord Botサービス', () => this.discordBotService.disconnect(), 3000),
      ];

      // 全てのサービス停止を待機（並列実行）
      await Promise.allSettled(stopPromises);

      console.log('✅ 全てのサービスが正常に停止しました');
      console.log('👋 アプリが正常に終了しました');

      // 少し待ってから確実に終了
      setTimeout(() => {
        process.exit(0);
      }, 500);

    } catch (error) {
      console.error('❌ 終了処理中にエラーが発生しました:', error);
      setTimeout(() => {
        process.exit(1);
      }, 500);
    }
  }

  /**
   * タイムアウト付きでサービスを停止
   */
  private async stopWithTimeout(serviceName: string, stopFunction: () => Promise<void> | void, timeout: number): Promise<void> {
    return new Promise((resolve) => {
      console.log(`${serviceName}を停止中...`);

      const timeoutId = setTimeout(() => {
        console.warn(`⚠️ ${serviceName}の停止がタイムアウトしました`);
        resolve();
      }, timeout);

      try {
        const result = stopFunction();
        if (result instanceof Promise) {
          result
            .then(() => {
              clearTimeout(timeoutId);
              resolve();
            })
            .catch((error) => {
              console.warn(`⚠️ ${serviceName}の停止中にエラー:`, error);
              clearTimeout(timeoutId);
              resolve();
            });
        } else {
          clearTimeout(timeoutId);
          resolve();
        }
      } catch (error) {
        console.warn(`⚠️ ${serviceName}の停止中にエラー:`, error);
        clearTimeout(timeoutId);
        resolve();
      }
    });
  }
}

// アプリケーション開始
const app = new MusicStatusApp();
app.start().catch((error) => {
  console.error('❌ アプリケーション開始に失敗しました:', error);
  process.exit(1);
});
