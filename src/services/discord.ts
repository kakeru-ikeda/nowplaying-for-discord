import DiscordRPC from 'discord-rpc';
import { NowPlayingInfo, DiscordActivity } from '../types';
import { config } from '../utils/config';

export class DiscordService {
  private client: DiscordRPC.Client;
  private isConnected = false;
  private currentTrack: string | null = null;

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

      const activity: DiscordActivity = {
        details: nowPlaying.track,
        state: `by ${nowPlaying.artist}`,
        startTimestamp: Date.now(),
        largeImageKey: nowPlaying.imageUrl || 'music',
        largeImageText: nowPlaying.album || 'Music',
        smallImageKey: 'lastfm',
        smallImageText: 'Last.fm',
      };

      await this.client.setActivity(activity);
      this.currentTrack = trackId;
      
      console.log(`🎵 Discord ステータス更新: ${nowPlaying.artist} - ${nowPlaying.track}`);
    } catch (error) {
      console.error('❌ Discord ステータス更新エラー:', error);
    }
  }

  async clearActivity(): Promise<void> {
    if (!this.isConnected) return;

    try {
      await this.client.clearActivity();
      this.currentTrack = null;
      console.log('🔇 Discord ステータスをクリアしました');
    } catch (error) {
      console.error('❌ Discord ステータスクリアエラー:', error);
    }
  }

  disconnect(): void {
    if (this.isConnected) {
      this.client.destroy();
      this.isConnected = false;
      console.log('🔌 Discord RPCから切断しました');
    }
  }
}
