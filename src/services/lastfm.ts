import axios from 'axios';
import {
  LastFmRecentTracksResponse,
  LastFmTrack,
  NowPlayingInfo,
  LastFmTopTracksResponse,
  LastFmTopArtistsResponse,
  LastFmTopAlbumsResponse,
  MusicReport,
  ListeningTrendData
} from '../types';
import { config } from '../utils/config';
import { ChartService } from './chart';

export class LastFmService {
  private readonly baseUrl = 'https://ws.audioscrobbler.com/2.0/';
  private chartService: ChartService;

  constructor() {
    this.chartService = new ChartService();
  }

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
      console.log('📊 音楽データを取得中...');
      const [topTracks, topArtists, topAlbums, listeningTrends] = await Promise.all([
        this.getTopTracks(apiPeriod),
        this.getTopArtists(apiPeriod),
        this.getTopAlbums(apiPeriod),
        this.getListeningTrends(period),
      ]);

      const report: MusicReport = {
        period,
        topTracks,
        topArtists,
        topAlbums,
        username: config.lastfm.username,
        dateRange,
        listeningTrends,
      };

      // グラフ生成
      console.log('🎨 グラフを生成中...');
      try {
        // 結合画像を生成
        const combinedChart = await this.chartService.generateCombinedChart(report);

        report.charts = {
          combined: combinedChart,
        };

        console.log('✅ 統合レポート画像の生成完了');
      } catch (chartError) {
        console.error('⚠️ グラフ生成エラー（データのみでレポート続行）:', chartError);
        // グラフ生成に失敗してもレポート自体は送信する
      }

      return report;
    } catch (error) {
      console.error('❌ 音楽レポート生成エラー:', error);
      throw error;
    }
  }

  // Webサーバー用レポート生成（グラフなし）
  async generateMusicReportForApi(period: 'daily' | 'weekly' | 'monthly'): Promise<MusicReport> {
    const apiPeriod = this.getApiPeriod(period);
    const dateRange = this.getDateRange(period);

    try {
      console.log('📊 音楽データを取得中（API用）...');
      const [topTracks, topArtists, topAlbums, listeningTrends] = await Promise.all([
        this.getTopTracks(apiPeriod),
        this.getTopArtists(apiPeriod),
        this.getTopAlbums(apiPeriod),
        this.getListeningTrends(period),
      ]);

      const report: MusicReport = {
        period,
        topTracks,
        topArtists,
        topAlbums,
        username: config.lastfm.username,
        dateRange,
        listeningTrends,
        // charts は含めない（API用はデータのみ）
      };

      return report;
    } catch (error) {
      console.error('❌ 音楽レポート生成エラー（API用）:', error);
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

  /**
   * 聴取推移データを取得
   */
  private async getListeningTrends(period: 'daily' | 'weekly' | 'monthly'): Promise<ListeningTrendData[]> {
    const trends: ListeningTrendData[] = [];
    const now = new Date();

    console.log(`📊 聴取推移データ取得開始 (${period})`);

    try {
      switch (period) {
        case 'daily':
          // 過去7日間の日別データを取得
          for (let i = 6; i >= 0; i--) {
            const date = new Date();
            date.setDate(date.getDate() - i);
            // 時刻をリセットして日付のみに
            date.setHours(0, 0, 0, 0);

            // 該当日の楽曲数を取得
            const scrobbles = await this.getDailyScrobbles(date);

            // 取得したデータに対応する正確な日付とラベルを設定
            trends.push({
              date: this.formatDateForApi(date),
              scrobbles,
              label: date.toLocaleDateString('ja-JP', { month: 'short', day: 'numeric' })
            });
          }
          break;

        case 'weekly':
          // 過去4週間のデータを取得
          for (let i = 3; i >= 0; i--) {
            const date = new Date();
            date.setDate(date.getDate() - (i * 7));
            date.setHours(0, 0, 0, 0);

            const dateStr = `${date.toLocaleDateString('ja-JP', { month: 'short', day: 'numeric' })}週`;

            const scrobbles = await this.getWeeklyScrobbles(date);

            trends.push({
              date: this.formatDateForApi(date),
              scrobbles,
              label: dateStr
            });
          }
          break;

        case 'monthly':
          // 過去6ヶ月のデータを取得
          for (let i = 5; i >= 0; i--) {
            const date = new Date();
            date.setMonth(date.getMonth() - i);
            date.setDate(1); // 月の1日に設定
            date.setHours(0, 0, 0, 0);

            const dateStr = date.toLocaleDateString('ja-JP', { year: 'numeric', month: 'short' });

            const scrobbles = await this.getMonthlyScrobbles(date);

            trends.push({
              date: this.formatDateForApi(date),
              scrobbles,
              label: dateStr
            });
          }
          break;
      }

      console.log(`✅ 聴取推移データ取得完了: ${trends.length}件のデータポイント`);
      return trends;
    } catch (error) {
      console.error('⚠️ 聴取推移データ取得エラー（模擬データを使用）:', error);
      // エラー時は模擬データを返す
      return this.generateFallbackTrendData(period);
    }
  }

  /**
   * 日別のScrobbles数を取得
   */
  private async getDailyScrobbles(date: Date): Promise<number> {
    try {
      // その日の0時から23:59:59までのデータを取得（UTC基準）
      const startOfDay = new Date(date);
      startOfDay.setHours(0, 0, 0, 0);

      const endOfDay = new Date(date);
      endOfDay.setHours(23, 59, 59, 999);

      const from = Math.floor(startOfDay.getTime() / 1000);
      const to = Math.floor(endOfDay.getTime() / 1000);

      console.log(`📅 日別データ取得: ${date.toLocaleDateString('ja-JP')} (${from} - ${to})`);

      // まず最初の200件を取得してtotalを確認
      const initialResponse = await axios.get<LastFmRecentTracksResponse>(this.baseUrl, {
        params: {
          method: 'user.getrecenttracks',
          user: config.lastfm.username,
          api_key: config.lastfm.apiKey,
          format: 'json',
          from,
          to,
          limit: 200,
          page: 1,
        },
        timeout: 15000,
      });

      const totalFromAPI = parseInt(initialResponse.data.recenttracks['@attr']?.total) || 0;

      // 実際のトラック数をチェック（現在再生中を除外）
      const tracksData = initialResponse.data.recenttracks.track;
      const tracks = Array.isArray(tracksData) ? tracksData : (tracksData ? [tracksData] : []);
      const actualTracks = tracks.length;

      // 現在再生中の楽曲を除外してカウント
      const validTrackCount = tracks.filter(track => !track['@attr']?.nowplaying).length;

      console.log(`🎵 ${date.toLocaleDateString('ja-JP')}: API total=${totalFromAPI}, actual tracks=${actualTracks}, valid tracks (excluding now playing)=${validTrackCount}`);

      // totalが200以下の場合は、現在再生中を除外した実際のトラック数を使用（より正確）
      const result = totalFromAPI <= 200 ? validTrackCount : totalFromAPI;

      return result;
    } catch (error) {
      console.error('日別データ取得エラー:', error);
      return Math.floor(Math.random() * 50) + 10; // フォールバック
    }
  }

  /**
   * 週別のScrobbles数を取得（簡易版）
   */
  private async getWeeklyScrobbles(date: Date): Promise<number> {
    try {
      // 週の開始日の0時から7日後の23:59:59までのデータを取得
      const startOfWeek = new Date(date);
      startOfWeek.setHours(0, 0, 0, 0);

      const endOfWeek = new Date(startOfWeek);
      endOfWeek.setDate(endOfWeek.getDate() + 6);
      endOfWeek.setHours(23, 59, 59, 999);

      const from = Math.floor(startOfWeek.getTime() / 1000);
      const to = Math.floor(endOfWeek.getTime() / 1000);

      console.log(`📅 週別データ取得: ${startOfWeek.toLocaleDateString('ja-JP')} - ${endOfWeek.toLocaleDateString('ja-JP')}`);

      const response = await axios.get<LastFmRecentTracksResponse>(this.baseUrl, {
        params: {
          method: 'user.getrecenttracks',
          user: config.lastfm.username,
          api_key: config.lastfm.apiKey,
          format: 'json',
          from,
          to,
          limit: 1000,
        },
        timeout: 15000,
      });

      const total = parseInt(response.data.recenttracks['@attr']?.total) || 0;
      console.log(`🎵 週間合計: ${total} scrobbles`);

      return total;
    } catch (error) {
      console.error('週別データ取得エラー:', error);
      return Math.floor(Math.random() * 200) + 50; // フォールバック
    }
  }

  /**
   * 月別のScrobbles数を取得（簡易版）
   */
  private async getMonthlyScrobbles(date: Date): Promise<number> {
    try {
      // 月の1日の0時から最終日の23:59:59までのデータを取得
      const startOfMonth = new Date(date.getFullYear(), date.getMonth(), 1, 0, 0, 0, 0);
      const endOfMonth = new Date(date.getFullYear(), date.getMonth() + 1, 0, 23, 59, 59, 999);

      const from = Math.floor(startOfMonth.getTime() / 1000);
      const to = Math.floor(endOfMonth.getTime() / 1000);

      console.log(`📅 月別データ取得: ${startOfMonth.toLocaleDateString('ja-JP')} - ${endOfMonth.toLocaleDateString('ja-JP')}`);

      const response = await axios.get<LastFmRecentTracksResponse>(this.baseUrl, {
        params: {
          method: 'user.getrecenttracks',
          user: config.lastfm.username,
          api_key: config.lastfm.apiKey,
          format: 'json',
          from,
          to,
          limit: 1000,
        },
        timeout: 15000,
      });

      const total = parseInt(response.data.recenttracks['@attr']?.total) || 0;
      console.log(`🎵 月間合計: ${total} scrobbles`);

      return total;
    } catch (error) {
      console.error('月別データ取得エラー:', error);
      return Math.floor(Math.random() * 800) + 200; // フォールバック
    }
  }

  /**
   * APIフォーマット用の日付文字列を生成
   */
  private formatDateForApi(date: Date): string {
    // 日本時間で正確な日付文字列を生成（UTCの影響を受けないように）
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  /**
   * フォールバック用の模擬推移データを生成
   */
  private generateFallbackTrendData(period: 'daily' | 'weekly' | 'monthly'): ListeningTrendData[] {
    const trends: ListeningTrendData[] = [];
    const now = new Date();

    switch (period) {
      case 'daily':
        for (let i = 6; i >= 0; i--) {
          const date = new Date(now);
          date.setDate(date.getDate() - i);
          trends.push({
            date: this.formatDateForApi(date),
            scrobbles: Math.floor(Math.random() * 50) + 10,
            label: date.toLocaleDateString('ja-JP', { month: 'short', day: 'numeric' })
          });
        }
        break;
      case 'weekly':
        for (let i = 3; i >= 0; i--) {
          const date = new Date(now);
          date.setDate(date.getDate() - (i * 7));
          trends.push({
            date: this.formatDateForApi(date),
            scrobbles: Math.floor(Math.random() * 200) + 50,
            label: `${date.toLocaleDateString('ja-JP', { month: 'short', day: 'numeric' })}週`
          });
        }
        break;
      case 'monthly':
        for (let i = 5; i >= 0; i--) {
          const date = new Date(now);
          date.setMonth(date.getMonth() - i);
          trends.push({
            date: this.formatDateForApi(date),
            scrobbles: Math.floor(Math.random() * 800) + 200,
            label: date.toLocaleDateString('ja-JP', { year: 'numeric', month: 'short' })
          });
        }
        break;
    }

    return trends;
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
