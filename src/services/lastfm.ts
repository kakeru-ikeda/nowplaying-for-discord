import axios from 'axios';
import { 
  LastFmRecentTracksResponse, 
  LastFmTrack, 
  NowPlayingInfo,
  LastFmTopTracksResponse,
  LastFmTopArtistsResponse,
  LastFmTopAlbumsResponse,
  MusicReport
} from '../types';
import { config } from '../utils/config';

export class LastFmService {
  private readonly baseUrl = 'https://ws.audioscrobbler.com/2.0/';

  async getNowPlaying(): Promise<NowPlayingInfo | null> {
    try {
      const response = await axios.get<LastFmRecentTracksResponse>(this.baseUrl, {
        params: {
          method: 'user.getrecenttracks',
          user: config.lastfm.username,
          api_key: config.lastfm.apiKey,
          format: 'json',
          limit: 1,
        },
        timeout: 10000,
      });

      const tracks = response.data.recenttracks.track;
      if (!tracks || tracks.length === 0) {
        return null;
      }

      const latestTrack = tracks[0];
      const isNowPlaying = latestTrack['@attr']?.nowplaying === 'true';

      if (!isNowPlaying) {
        return {
          artist: '',
          track: '',
          isPlaying: false,
        };
      }

      return {
        artist: latestTrack.artist['#text'],
        track: latestTrack.name,
        album: latestTrack.album?.['#text'],
        imageUrl: this.extractLargeImage(latestTrack),
        isPlaying: true,
      };
    } catch (error) {
      if (axios.isAxiosError(error)) {
        console.error('❌ Last.fm API エラー:', error.response?.status, error.message);
      } else {
        console.error('❌ Last.fm API エラー:', error);
      }
      return null;
    }
  }

  private extractLargeImage(track: LastFmTrack): string | undefined {
    const images = track.image;
    if (!images || images.length === 0) return undefined;

    // 大きい画像を優先して取得
    const largeImage = images.find(img => img.size === 'extralarge') ||
                     images.find(img => img.size === 'large') ||
                     images.find(img => img.size === 'medium');

    return largeImage?.['#text'] || undefined;
  }

  // レポート機能のメソッド
  async generateMusicReport(period: 'daily' | 'weekly' | 'monthly'): Promise<MusicReport> {
    const apiPeriod = this.getApiPeriod(period);
    const dateRange = this.getDateRange(period);

    try {
      const [topTracks, topArtists, topAlbums] = await Promise.all([
        this.getTopTracks(apiPeriod),
        this.getTopArtists(apiPeriod),
        this.getTopAlbums(apiPeriod),
      ]);

      return {
        period,
        topTracks,
        topArtists,
        topAlbums,
        username: config.lastfm.username,
        dateRange,
      };
    } catch (error) {
      console.error('❌ 音楽レポート生成エラー:', error);
      throw error;
    }
  }

  private async getTopTracks(period: string, limit: number = 10) {
    const response = await axios.get<LastFmTopTracksResponse>(this.baseUrl, {
      params: {
        method: 'user.gettoptracks',
        user: config.lastfm.username,
        api_key: config.lastfm.apiKey,
        format: 'json',
        period,
        limit,
      },
      timeout: 10000,
    });

    return response.data.toptracks.track || [];
  }

  private async getTopArtists(period: string, limit: number = 10) {
    const response = await axios.get<LastFmTopArtistsResponse>(this.baseUrl, {
      params: {
        method: 'user.gettopartists',
        user: config.lastfm.username,
        api_key: config.lastfm.apiKey,
        format: 'json',
        period,
        limit,
      },
      timeout: 10000,
    });

    return response.data.topartists.artist || [];
  }

  private async getTopAlbums(period: string, limit: number = 5) {
    const response = await axios.get<LastFmTopAlbumsResponse>(this.baseUrl, {
      params: {
        method: 'user.gettopalbums',
        user: config.lastfm.username,
        api_key: config.lastfm.apiKey,
        format: 'json',
        period,
        limit,
      },
      timeout: 10000,
    });

    return response.data.topalbums.album || [];
  }

  private getApiPeriod(period: 'daily' | 'weekly' | 'monthly'): string {
    switch (period) {
      case 'daily':
        return '7day'; // Last.fmには1日期間がないため7日を使用
      case 'weekly':
        return '7day';
      case 'monthly':
        return '1month';
      default:
        return '7day';
    }
  }

  private getDateRange(period: 'daily' | 'weekly' | 'monthly'): { start: string; end: string } {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    switch (period) {
      case 'daily':
        const yesterday = new Date(today);
        yesterday.setDate(yesterday.getDate() - 1);
        return {
          start: yesterday.toLocaleDateString('ja-JP'),
          end: today.toLocaleDateString('ja-JP'),
        };
      case 'weekly':
        const weekStart = new Date(today);
        weekStart.setDate(weekStart.getDate() - 7);
        return {
          start: weekStart.toLocaleDateString('ja-JP'),
          end: today.toLocaleDateString('ja-JP'),
        };
      case 'monthly':
        const monthStart = new Date(today);
        monthStart.setMonth(monthStart.getMonth() - 1);
        return {
          start: monthStart.toLocaleDateString('ja-JP'),
          end: today.toLocaleDateString('ja-JP'),
        };
      default:
        return {
          start: today.toLocaleDateString('ja-JP'),
          end: today.toLocaleDateString('ja-JP'),
        };
    }
  }
}
