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
        this.jobs = [cacheJob, cleanupJob];

        console.log('✅ スケジューラーが開始されました');
        console.log('🔄 キャッシュ同期: 15分ごと');
        console.log('🧹 キャッシュクリーンアップ: 毎日2時');
    }

    stop(): void {
        console.log('⏰ スケジューラーを停止しています...');
        this.jobs.forEach(job => job.destroy());
        this.jobs = [];
        console.log('✅ スケジューラーが停止されました');
    }
}
