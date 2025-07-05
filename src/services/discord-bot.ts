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

  async sendMusicReport(report: MusicReport): Promise<void> {
    if (!this.isConnected) {
      console.warn('⚠️ Discord Bot が接続されていません');
      return;
    }

    try {
      const channel = await this.client.channels.fetch(config.discord.reportChannelId) as TextChannel;
      if (!channel) {
        console.error('❌ レポートチャンネルが見つかりません');
        return;
      }

      const periodEmoji = {
        daily: '📅',
        weekly: '📊',
        monthly: '📈'
      };

      const periodName = {
        daily: '日次',
        weekly: '週次',
        monthly: '月次'
      };

      const embed = new EmbedBuilder()
        .setTitle(`${periodEmoji[report.period]} ${periodName[report.period]}音楽レポート`)
        .setDescription(`**${report.username}** さんの音楽統計`)
        .addFields(
          { name: '📅 期間', value: `${report.dateRange.start} 〜 ${report.dateRange.end}`, inline: false }
        )
        .setColor(0xD60000) // Last.fm赤色
        .setTimestamp();

      // トップトラック
      if (report.topTracks.length > 0) {
        const topTracksText = report.topTracks
          .slice(0, 5)
          .map((track, index) => `${index + 1}. **${track.name}** - ${track.artist.name} (${track.playcount}回)`)
          .join('\n');
        embed.addFields({ name: '🎵 トップトラック', value: topTracksText, inline: false });
      }

      // トップアーティスト
      if (report.topArtists.length > 0) {
        const topArtistsText = report.topArtists
          .slice(0, 5)
          .map((artist, index) => `${index + 1}. **${artist.name}** (${artist.playcount}回)`)
          .join('\n');
        embed.addFields({ name: '🎤 トップアーティスト', value: topArtistsText, inline: false });
      }

      // トップアルバム
      if (report.topAlbums.length > 0) {
        const topAlbumsText = report.topAlbums
          .slice(0, 3)
          .map((album, index) => `${index + 1}. **${album.name}** - ${album.artist.name} (${album.playcount}回)`)
          .join('\n');
        embed.addFields({ name: '💿 トップアルバム', value: topAlbumsText, inline: false });
      }

      if (report.totalScrobbles) {
        embed.addFields({ name: '📊 総再生回数', value: `${report.totalScrobbles}回`, inline: true });
      }

      // グラフ画像の添付（結合画像のみ）
      const attachments: AttachmentBuilder[] = [];

      if (report.charts?.combined) {
        console.log('🎨 統合レポート画像を添付中...');

        attachments.push(new AttachmentBuilder(report.charts.combined, {
          name: `music-report-${report.period}-${Date.now()}.png`,
          description: '音楽統計レポート'
        }));
      }

      // メッセージ送信（グラフ画像付き）
      const messagePayload: any = { embeds: [embed] };
      if (attachments.length > 0) {
        messagePayload.files = attachments;
        embed.setFooter({ text: '📊 統合レポート画像を生成しました' });
      }

      await channel.send(messagePayload);
      console.log(`📊 ${periodName[report.period]}レポート${attachments.length > 0 ? '（統合グラフ付き）' : ''}を送信しました`);
    } catch (error) {
      console.error('❌ レポート送信エラー:', error);
    }
  }
}
