import DiscordRPC from 'discord-rpc';
import { NowPlayingInfo, DiscordActivity } from '../types';
import { config } from '../utils/config';
import { SpotifyService } from './spotify';

export class DiscordRPCService {
    private client: DiscordRPC.Client;
    private isConnected = false;
    private currentTrack: string | null = null;
    private isCleared = false; // ステータスがクリアされているかを追跡
    private spotifyService: SpotifyService;

    constructor(spotifyService?: SpotifyService) {
        this.client = new DiscordRPC.Client({ transport: 'ipc' });
        this.spotifyService = spotifyService || new SpotifyService();
    }

    async connect(): Promise<void> {
        try {
            await this.client.login({ clientId: config.discord.clientId });
            this.isConnected = true;
            console.log('✅ Discord RPCに接続しました');
        } catch (error) {
            console.error('❌ Discord RPC接続エラー:', error);
            throw error;
        }
    }

    async updateActivity(nowPlaying: NowPlayingInfo): Promise<void> {
        if (!this.isConnected) {
            console.warn('⚠️ Discord RPCが接続されていません');
            return;
        }

        try {
            if (!nowPlaying.isPlaying) {
                await this.clearActivity();
                return;
            }

            // Spotifyが再生中の場合は、Last.fmのRPCステータス更新をスキップ
            if (this.spotifyService.isUserAuthEnabled()) {
                const isSpotifyPlaying = await this.spotifyService.isSpotifyPlaying();
                if (isSpotifyPlaying) {
                    console.log('🎵 Spotify再生中のため、Last.fm RPCステータス更新をスキップします');
                    // Spotifyが再生中の場合はLast.fmのステータスをクリア
                    await this.clearActivity();
                    return;
                }
            }

            const trackId = `${nowPlaying.artist}-${nowPlaying.track}`;
            if (this.currentTrack === trackId) {
                return; // 同じ楽曲の場合は更新しない
            }

            const activity: DiscordActivity = {
                details: nowPlaying.track,
                state: `by ${nowPlaying.artist}`,
                startTimestamp: Date.now(),
                largeImageKey: nowPlaying.imageUrl || 'music',
                largeImageText: nowPlaying.album || 'Music',
                smallImageKey: 'lastfm',
                smallImageText: 'Last.fm',
                type: 2, // LISTENING アクティビティタイプを指定
            };

            await this.client.setActivity(activity);
            this.currentTrack = trackId;
            this.isCleared = false; // アクティビティが設定されたのでクリア状態を解除

            console.log(`🎵 Discord ステータス更新: ${nowPlaying.artist} - ${nowPlaying.track}`);
        } catch (error) {
            console.error('❌ Discord ステータス更新エラー:', error);
        }
    }

    async clearActivity(): Promise<void> {
        if (!this.isConnected) return;

        // 既にクリアされている場合はログを出力しない
        if (this.isCleared) return;

        try {
            await this.client.clearActivity();
            this.currentTrack = null;
            this.isCleared = true; // クリア状態を記録
            console.log('🔇 Discord ステータスをクリアしました');
        } catch (error) {
            console.error('❌ Discord ステータスクリアエラー:', error);
        }
    }

    disconnect(): void {
        if (this.isConnected) {
            this.client.destroy();
            this.isConnected = false;
            this.isCleared = false; // 切断時はクリア状態もリセット
            console.log('🔌 Discord RPCから切断しました');
        }
    }
}
