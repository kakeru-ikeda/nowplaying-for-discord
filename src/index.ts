import { LastFmService } from './services/lastfm';
import { DiscordRPCService } from './services/discord-rpc';
import { DiscordBotService } from './services/discord-bot';
import { SchedulerService } from './services/scheduler';
import { config, validateEnvironment } from './utils/config';

class MusicStatusApp {
  private lastFmService: LastFmService;
  private discordRPCService: DiscordRPCService;
  private discordBotService: DiscordBotService;
  private schedulerService: SchedulerService;
  private intervalId: NodeJS.Timeout | null = null;
  private lastTrackInfo: string | null = null; // 重複通知防止用

  constructor() {
    this.lastFmService = new LastFmService();
    this.discordRPCService = new DiscordRPCService();
    this.discordBotService = new DiscordBotService();
    this.schedulerService = new SchedulerService(this.lastFmService, this.discordBotService);
  }

  async start(): Promise<void> {
    try {
      console.log('🚀 Music Status App を開始しています...');
      console.log(`📊 設定情報:`);
      console.log(`  - Last.fm ユーザー: ${config.lastfm.username}`);
      console.log(`  - 更新間隔: ${config.updateInterval / 1000}秒`);
      console.log(`  - ナウプレイング通知: ${config.discord.nowPlayingChannelId ? '有効' : '無効'}`);
      console.log(`  - レポート通知: ${config.discord.reportChannelId ? '有効' : '無効'}`);

      // 環境変数の検証
      validateEnvironment();

      // Discord RPC接続
      await this.discordRPCService.connect();

      // Discord Bot接続
      await this.discordBotService.connect();

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
      console.log('🧪 テスト用コマンド:');
      console.log('  - 日次レポートテスト: process.kill(process.pid, "SIGUSR1")');
      console.log('  - 週次レポートテスト: process.kill(process.pid, "SIGUSR2")');

      // 終了処理の設定
      process.on('SIGINT', () => this.shutdown());
      process.on('SIGTERM', () => this.shutdown());

      // テスト用のシグナルハンドラー
      process.on('SIGUSR1', async () => {
        console.log('🧪 日次レポートテストを実行中...');
        await this.schedulerService.sendTestReport('daily');
      });

      process.on('SIGUSR2', async () => {
        console.log('🧪 週次レポートテストを実行中...');
        await this.schedulerService.sendTestReport('weekly');
      });

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
          this.lastTrackInfo = currentTrackInfo;
          console.log(`🎵 新しい楽曲: ${currentTrackInfo}`);
        }
      } else if (nowPlaying && !nowPlaying.isPlaying) {
        // 楽曲が停止された場合：Discordステータスをクリア
        await this.discordRPCService.clearActivity();

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

  private shutdown(): void {
    console.log('\n🛑 アプリを終了しています...');

    if (this.intervalId) {
      clearInterval(this.intervalId);
    }

    this.schedulerService.stop();
    this.discordRPCService.disconnect();
    this.discordBotService.disconnect();

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
