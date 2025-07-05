import { LastFmService } from './services/lastfm';
import { DiscordService } from './services/discord';
import { config, validateEnvironment } from './utils/config';

class MusicStatusApp {
  private lastFmService: LastFmService;
  private discordService: DiscordService;
  private intervalId: NodeJS.Timeout | null = null;

  constructor() {
    this.lastFmService = new LastFmService();
    this.discordService = new DiscordService();
  }

  async start(): Promise<void> {
    try {
      console.log('🚀 Music Status App を開始しています...');
      console.log(`📊 設定情報:`);
      console.log(`  - Last.fm ユーザー: ${config.lastfm.username}`);
      console.log(`  - 更新間隔: ${config.updateInterval / 1000}秒`);
      
      // 環境変数の検証
      validateEnvironment();
      
      // Discord RPC接続
      await this.discordService.connect();
      
      // 初回実行
      await this.updateStatus();
      
      // 定期実行の開始
      this.intervalId = setInterval(async () => {
        await this.updateStatus();
      }, config.updateInterval);

      console.log(`✅ アプリが開始されました`);
      console.log('💡 終了するには Ctrl+C を押してください');
      
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
      
      if (nowPlaying) {
        await this.discordService.updateActivity(nowPlaying);
      } else {
        console.log('⚠️ 楽曲情報を取得できませんでした');
      }
    } catch (error) {
      console.error('❌ ステータス更新エラー:', error);
    }
  }

  private shutdown(): void {
    console.log('\n🛑 アプリを終了しています...');
    
    if (this.intervalId) {
      clearInterval(this.intervalId);
    }
    
    this.discordService.disconnect();
    
    console.log('👋 アプリが正常に終了しました');
    process.exit(0);
  }
}

// アプリケーション開始
const app = new MusicStatusApp();
app.start().catch((error) => {
  console.error('❌ アプリケーション開始に失敗しました:', error);
  process.exit(1);
});
