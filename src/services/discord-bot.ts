import { Client, GatewayIntentBits, TextChannel, EmbedBuilder, AttachmentBuilder } from 'discord.js';
import { config } from '../utils/config';
import { NowPlayingInfo, MusicReport } from '../types';

export class DiscordBotService {
  private client: Client;
  private isConnected = false;

  constructor() {
    this.client = new Client({
      intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
      ],
    });

    this.setupEventHandlers();
  }

  private setupEventHandlers(): void {
    this.client.on('ready', () => {
      console.log(`🤖 Discord Bot としてログインしました: ${this.client.user?.tag}`);
      this.isConnected = true;
    });

    this.client.on('error', (error) => {
      console.error('❌ Discord Bot エラー:', error);
    });

    this.client.on('disconnect', () => {
      console.log('🔌 Discord Bot が切断されました');
      this.isConnected = false;
    });
  }

  async connect(): Promise<void> {
    try {
      await this.client.login(config.discord.botToken);
      console.log('✅ Discord Bot に接続しました');
    } catch (error) {
      console.error('❌ Discord Bot 接続エラー:', error);
      throw error;
    }
  }

  async disconnect(): Promise<void> {
    if (this.isConnected) {
      await this.client.destroy();
      this.isConnected = false;
      console.log('👋 Discord Bot を切断しました');
    }
  }

  async sendNowPlayingNotification(nowPlaying: NowPlayingInfo): Promise<void> {
    if (!this.isConnected) {
      console.warn('⚠️ Discord Bot が接続されていません');
      return;
    }

    try {
      const channel = await this.client.channels.fetch(config.discord.nowPlayingChannelId) as TextChannel;
      if (!channel) {
        console.error('❌ ナウプレイングチャンネルが見つかりません');
        return;
      }

      const embed = new EmbedBuilder()
        .setTitle('🎵  Now Playing')
        .addFields(
          { name: '🎶  楽曲', value: nowPlaying.track, inline: true },
          { name: '🎤  アーティスト', value: nowPlaying.artist, inline: true }
        )
        .setColor(0x1DB954) // Spotify緑色
        .setTimestamp();

      if (nowPlaying.album) {
        embed.addFields({ name: '💿  アルバム', value: nowPlaying.album, inline: false });
      }

      if (nowPlaying.imageUrl) {
        embed.setThumbnail(nowPlaying.imageUrl);
      }

      await channel.send({ embeds: [embed] });
      console.log('📢 ナウプレイング通知を送信しました');
    } catch (error) {
      console.error('❌ ナウプレイング通知送信エラー:', error);
    }
  }
}
