import * as cron from 'node-cron';
import { LastFmService } from './lastfm';
import { DiscordBotService } from './discord-bot';
import { CacheService } from './cache';

export class SchedulerService {
    private lastFmService: LastFmService;
    private discordBotService: DiscordBotService;
    private cacheService: CacheService;
    private jobs: cron.ScheduledTask[] = [];

    constructor(
        lastFmService: LastFmService, 
        discordBotService: DiscordBotService,
        cacheService: CacheService,
    ) {
        this.lastFmService = lastFmService;
        this.discordBotService = discordBotService;
        this.cacheService = cacheService;
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

        // 15分ごとにキャッシュ同期
        const cacheJob = cron.schedule('*/15 * * * *', async () => {
            console.log('🔄 キャッシュ同期を実行中...');
            try {
                await this.cacheService.syncRecentTracks();
            } catch (error) {
                console.error('❌ キャッシュ同期エラー:', error);
            }
        });

        // 毎日2時にキャッシュクリーンアップ
        const cleanupJob = cron.schedule('0 2 * * *', async () => {
            console.log('🧹 古いキャッシュデータをクリーンアップ中...');
            try {
                await this.cacheService.cleanupOldData(90); // 90日より古いデータを削除
            } catch (error) {
                console.error('❌ キャッシュクリーンアップエラー:', error);
            }
        }, {
            timezone: 'Asia/Tokyo'
        });

        // ジョブを開始（自動的に開始される）
        this.jobs = [dailyJob, weeklyJob, monthlyJob, cacheJob, cleanupJob];

        console.log('✅ スケジューラーが開始されました');
        console.log('📅 日次レポート: 毎日0時');
        console.log('📊 週次レポート: 毎週日曜日0時');
        console.log('📈 月次レポート: 毎月1日0時');
        console.log('🔄 キャッシュ同期: 15分ごと');
        console.log('🧹 キャッシュクリーンアップ: 毎日2時');
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

    // グラフ機能のテスト用メソッド
    async sendTestChartReport(): Promise<void> {
        console.log('🎨 グラフ機能テスト用レポートを送信中...');
        try {
            const report = await this.lastFmService.generateMusicReport('weekly');
            if (report.charts) {
                console.log('✅ グラフが正常に生成されました');
                console.log(`📊 生成されたグラフ数: ${Object.keys(report.charts).length}`);
            } else {
                console.log('⚠️ グラフが生成されませんでした');
            }

            // 聴取推移データの確認
            if (report.listeningTrends) {
                console.log('📈 実際の聴取推移データを使用:');
                report.listeningTrends.forEach((trend, index) => {
                    console.log(`  ${index + 1}. ${trend.label}: ${trend.scrobbles}曲`);
                });
            } else {
                console.log('⚠️ 聴取推移データはフォールバック値を使用');
            }

            await this.discordBotService.sendMusicReport(report);
            console.log('✅ グラフ機能テスト用レポートを送信しました');
        } catch (error) {
            console.error('❌ グラフ機能テスト用レポート送信エラー:', error);
        }
    }
}
