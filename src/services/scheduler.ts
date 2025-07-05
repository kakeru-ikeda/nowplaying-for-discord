import * as cron from 'node-cron';
import { LastFmService } from './lastfm';
import { DiscordBotService } from './discord-bot';

export class SchedulerService {
  private lastFmService: LastFmService;
  private discordBotService: DiscordBotService;
  private jobs: cron.ScheduledTask[] = [];

  constructor(lastFmService: LastFmService, discordBotService: DiscordBotService) {
    this.lastFmService = lastFmService;
    this.discordBotService = discordBotService;
  }

  start(): void {
    console.log('⏰ スケジューラーを開始しています...');

    // 毎日0時に日次レポート送信（テスト用に毎分実行に変更可能）
    const dailyJob = cron.schedule('0 0 * * *', async () => {
      console.log('📅 日次レポートを生成中...');
      try {
        const report = await this.lastFmService.generateMusicReport('daily');
        await this.discordBotService.sendMusicReport(report);
      } catch (error) {
        console.error('❌ 日次レポート送信エラー:', error);
      }
    }, {
      timezone: 'Asia/Tokyo'
    });

    // 毎週日曜日0時に週次レポート送信
    const weeklyJob = cron.schedule('0 0 * * 0', async () => {
      console.log('📊 週次レポートを生成中...');
      try {
        const report = await this.lastFmService.generateMusicReport('weekly');
        await this.discordBotService.sendMusicReport(report);
      } catch (error) {
        console.error('❌ 週次レポート送信エラー:', error);
      }
    }, {
      timezone: 'Asia/Tokyo'
    });

    // 毎月1日0時に月次レポート送信
    const monthlyJob = cron.schedule('0 0 1 * *', async () => {
      console.log('📈 月次レポートを生成中...');
      try {
        const report = await this.lastFmService.generateMusicReport('monthly');
        await this.discordBotService.sendMusicReport(report);
      } catch (error) {
        console.error('❌ 月次レポート送信エラー:', error);
      }
    }, {
      timezone: 'Asia/Tokyo'
    });

    // ジョブを開始（自動的に開始される）
    this.jobs = [dailyJob, weeklyJob, monthlyJob];

    console.log('✅ スケジューラーが開始されました');
    console.log('📅 日次レポート: 毎日0時');
    console.log('📊 週次レポート: 毎週日曜日0時');
    console.log('📈 月次レポート: 毎月1日0時');
  }

  stop(): void {
    console.log('⏰ スケジューラーを停止しています...');
    this.jobs.forEach(job => job.destroy());
    this.jobs = [];
    console.log('✅ スケジューラーが停止されました');
  }

  // テスト用のメソッド
  async sendTestReport(period: 'daily' | 'weekly' | 'monthly'): Promise<void> {
    console.log(`🧪 テスト用${period}レポートを送信中...`);
    try {
      const report = await this.lastFmService.generateMusicReport(period);
      await this.discordBotService.sendMusicReport(report);
      console.log(`✅ テスト用${period}レポートを送信しました`);
    } catch (error) {
      console.error(`❌ テスト用${period}レポート送信エラー:`, error);
    }
  }
}
