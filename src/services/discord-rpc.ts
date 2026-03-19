import DiscordRPC from 'discord-rpc';
import { NowPlayingInfo, DiscordActivity } from '../types';
import { config } from '../utils/config';

export class DiscordRPCService {
    private client: DiscordRPC.Client;
    private isConnected = false;
    private currentTrack: string | null = null;
    private isCleared = false; // ステータスがクリアされているかを追跡

    constructor() {
        this.client = new DiscordRPC.Client({ transport: 'ipc' });
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

            const trackId = `${nowPlaying.artist}-${nowPlaying.track}`;
            if (this.currentTrack === trackId) {
                return; // 同じ楽曲の場合は更新しない
            }

            // discord-rpc の setActivity は type フィールドを送信しないため、
            // 内部の request メソッドを直接呼び出して type: 2 (LISTENING) を含める
            await (this.client as any).request('SET_ACTIVITY', {
                pid: process.pid,
                activity: {
                    name: nowPlaying.track, // メンバーリストに表示される名前を曲名に上書き
                    details: nowPlaying.track,
                    state: `by ${nowPlaying.artist}`,
                    timestamps: {
                        start: Date.now(),
                    },
                    assets: {
                        large_image: nowPlaying.imageUrl || 'music',
                        large_text: nowPlaying.album || 'Music',
                        small_image: 'lastfm',
                        small_text: nowPlaying.track,
                    },
                    type: 2, // LISTENING
                    instance: false,
                },
            });
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
