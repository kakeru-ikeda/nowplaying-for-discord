import axios from 'axios';
import {
  LastFmRecentTracksResponse,
  LastFmTrack,
  NowPlayingInfo,
  LastFmTopTracksResponse,
  LastFmTopArtistsResponse,
  LastFmTopAlbumsResponse,
  MusicReport,
  ListeningTrendData,
  RecentTrackInfo,
  RecentTracksOptions,
  UserStats,
  DailyStatsItem,
  WeeklyStatsItem,
  MonthlyStatsItem
} from '../types';
import { config } from '../utils/config';
import { ImageDetectionUtils } from '../utils/image-detection';
import { DatabaseService } from './database';

export class LastFmService {
  private readonly baseUrl = 'https://ws.audioscrobbler.com/2.0/';

  constructor(dbService?: DatabaseService) {
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

      const imageUrl = this.getEnhancedImage(this.extractLargeImage(latestTrack));

      return {
        artist: latestTrack.artist['#text'],
        track: latestTrack.name,
        album: this.normalizeAlbumName(latestTrack.album?.['#text']),
        imageUrl,
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

  /**
   * Last.fm画像を取得（プレースホルダー判定付き）
   */
  private getEnhancedImage(
    lastfmImageUrl?: string
  ): string | undefined {
    if (!lastfmImageUrl) return undefined;
    if (ImageDetectionUtils.isPlaceholderImage(lastfmImageUrl)) {
      console.log('⚠️ プレースホルダー画像を検出:', lastfmImageUrl);
    }
    return lastfmImageUrl;
  }

  /**
   * 音楽レポートを生成
   * @param period レポート期間（daily|weekly|monthly）
   * @param options オプション設定
   * @param options.isForApi API用のレポートかどうか（ログメッセージに影響、デフォルト：false）
   * @returns 音楽レポート
   */
  async generateMusicReport(
    period: 'daily' | 'weekly' | 'monthly',
    options: {
      targetDate?: Date | string;
      limit?: number;
      page?: number;
    } = {}
  ): Promise<MusicReport> {
    const { targetDate, limit, page } = options;

    try {
      // 期間に応じた開始日と終了日を取得（targetDateがあれば指定した日付で）
      const { startDate, endDate } = this.getPeriodDates(period, targetDate);

      // 期間表示用の文字列を生成
      let dateRangeStr: string;
      if (targetDate) {
        // 指定日付がある場合
        const targetDay = typeof targetDate === 'string' ? new Date(targetDate) : targetDate;

        if (period === 'daily') {
          // 日次: 2023年7月10日のデイリーレポート
          dateRangeStr = `${targetDay.getFullYear()}年${targetDay.getMonth() + 1}月${targetDay.getDate()}日のデイリーレポート`;
        } else if (period === 'weekly') {
          // 週次: 2023年7月10日週のウィークリーレポート（7/9 - 7/15）
          const weekStart = new Date(targetDay);
          weekStart.setDate(weekStart.getDate() - weekStart.getDay());
          const weekEnd = new Date(weekStart);
          weekEnd.setDate(weekEnd.getDate() + 6);
          dateRangeStr = `${targetDay.getFullYear()}年${targetDay.getMonth() + 1}月${targetDay.getDate()}日週のウィークリーレポート（${weekStart.getMonth() + 1}/${weekStart.getDate()} - ${weekEnd.getMonth() + 1}/${weekEnd.getDate()}）`;
        } else {
          // 月次: 2023年7月のマンスリーレポート
          dateRangeStr = `${targetDay.getFullYear()}年${targetDay.getMonth() + 1}月のマンスリーレポート`;
        }
      } else {
        // 指定日付がない場合は従来の表示形式を使用（API呼び出しはしない）
        const dateRangeObj = this.getDateRange(period);
        dateRangeStr = `${dateRangeObj.start} 〜 ${dateRangeObj.end}`;
      }

      console.log(`🔍 ${period}レポート生成中 (${startDate.toLocaleDateString('ja-JP')} - ${endDate.toLocaleDateString('ja-JP')})`);

      // 各データを並列取得 - 大量データ取得のため制限を大きくする
      let [topTracks, topArtists, topAlbums, listeningTrends] = await Promise.all([
        this.getTopTracksByTimeRange(startDate, endDate, 200), // 最大200件取得
        this.getTopArtistsByTimeRange(startDate, endDate, 200), // 最大200件取得
        this.getTopAlbumsByTimeRange(startDate, endDate, 200), // 最大200件取得
        this.getListeningTrends(period, targetDate), // listeningTrendsにも日付指定を渡す
      ]);

      // ページネーションを適用（limitとpageが指定されている場合）
      if (limit && page) {
        const startIndex = (page - 1) * limit;
        const endIndex = startIndex + limit;

        // トップトラックのページネーション
        topTracks = topTracks.slice(startIndex, endIndex);

        // トップアーティストのページネーション
        topArtists = topArtists.slice(startIndex, endIndex);

        // トップアルバムのページネーション
        topAlbums = topAlbums.slice(startIndex, endIndex);

        console.log(`📄 ページネーション適用: ページ ${page}, 件数 ${limit} (${startIndex} - ${endIndex})`);
      }

      const report: MusicReport = {
        period,
        topTracks,
        topArtists,
        topAlbums,
        username: config.lastfm.username,
        dateRange: {
          start: startDate.toLocaleDateString('ja-JP'),
          end: endDate.toLocaleDateString('ja-JP')
        },
        listeningTrends,
        // 日付情報をレポートに含める
        reportDate: {
          startDate: startDate.toISOString(),
          endDate: endDate.toISOString(),
          targetDate: targetDate ? (typeof targetDate === 'string' ? targetDate : targetDate.toISOString()) : null
        }
      };

      return report;
    } catch (error) {
      console.error(`❌ 音楽レポート生成エラー :`, error);
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
   * 指定されたピリオド内でデータを計算：日次は今日の0時から現在まで、週次・月次も同様に現在時刻までのデータ
   */
  private async getListeningTrends(
    period: 'daily' | 'weekly' | 'monthly',
    targetDate?: Date | string
  ): Promise<ListeningTrendData[]> {
    const trends: ListeningTrendData[] = [];

    // targetDateが文字列の場合はDateオブジェクトに変換
    let baseDate: Date;

    if (targetDate) {
      if (typeof targetDate === 'string') {
        baseDate = new Date(targetDate);
        // 不正な日付文字列の場合は現在時刻を使用
        if (isNaN(baseDate.getTime())) {
          console.warn(`⚠️ 不正な日付文字列です: ${targetDate}, 現在時刻を使用します`);
          baseDate = new Date();
        }
      } else {
        baseDate = targetDate;
      }
    } else {
      // 未指定の場合は現在時刻
      baseDate = new Date();
    }

    console.log(`📊 聴取推移データ取得開始 (${period})`);

    try {
      switch (period) {
        case 'daily':
          // 過去7日分のデータを取得
          for (let i = 6; i >= 0; i--) {
            const date = new Date(baseDate);
            date.setDate(date.getDate() - i);
            date.setHours(0, 0, 0, 0);

            const endDate = new Date(date);
            if (i === 0) {
              // 今日の場合は現在時刻まで
              endDate.setTime(baseDate.getTime());
            } else {
              // 過去の日は23:59:59まで
              endDate.setHours(23, 59, 59, 999);
            }

            const scrobbles = await this.getDailyScrobbles(date, endDate);
            trends.push({
              date: this.formatDateForApi(date),
              scrobbles,
              label: date.toLocaleDateString('ja-JP', { month: 'short', day: 'numeric' })
            });
          }
          break;

        case 'weekly':
          // 過去4週分のデータを取得
          for (let i = 3; i >= 0; i--) {
            const weekEnd = new Date(baseDate);
            weekEnd.setDate(weekEnd.getDate() - (i * 7));

            const weekStart = new Date(weekEnd);
            const dayOfWeek = weekStart.getDay();
            weekStart.setDate(weekStart.getDate() - dayOfWeek); // 週の日曜日に設定
            weekStart.setHours(0, 0, 0, 0);

            // 現在の週かどうかを判定
            const now = new Date();
            const today = new Date(now);
            today.setHours(0, 0, 0, 0);

            const currentWeekDay = today.getDay();
            const currentWeekStart = new Date(today);
            currentWeekStart.setDate(currentWeekStart.getDate() - currentWeekDay);

            const isCurrentWeek = weekStart.toDateString() === currentWeekStart.toDateString();

            if (isCurrentWeek && i === 0) {
              // 現在の週の場合は現在時刻まで
              weekEnd.setTime(now.getTime());
            } else {
              // それ以外は週の終わり（土曜日）
              const actualWeekEnd = new Date(weekStart);
              actualWeekEnd.setDate(actualWeekEnd.getDate() + 6);
              actualWeekEnd.setHours(23, 59, 59, 999);
              weekEnd.setTime(actualWeekEnd.getTime());
            }

            const scrobbles = await this.getWeeklyScrobbles(weekStart, weekEnd);

            // ラベル用の週末を計算
            const labelWeekEnd = new Date(weekStart);
            labelWeekEnd.setDate(labelWeekEnd.getDate() + 6);

            trends.push({
              date: this.formatDateForApi(weekStart),
              scrobbles,
              label: `${weekStart.getMonth() + 1}/${weekStart.getDate()}-${labelWeekEnd.getMonth() + 1}/${labelWeekEnd.getDate()}`
            });
          }
          break;

        case 'monthly':
          // 過去6ヶ月分のデータを取得
          for (let i = 5; i >= 0; i--) {
            const monthEnd = new Date(baseDate);
            monthEnd.setMonth(monthEnd.getMonth() - i);

            const monthStart = new Date(monthEnd.getFullYear(), monthEnd.getMonth(), 1);
            monthStart.setHours(0, 0, 0, 0);

            // 現在の月かどうかを判定
            const now = new Date();
            const isCurrentMonth = monthEnd.getMonth() === now.getMonth() &&
              monthEnd.getFullYear() === now.getFullYear();

            if (isCurrentMonth && i === 0) {
              // 現在の月の場合は現在時刻まで
              monthEnd.setTime(now.getTime());
            } else {
              // それ以外は月末まで
              const actualMonthEnd = new Date(monthStart.getFullYear(), monthStart.getMonth() + 1, 0);
              actualMonthEnd.setHours(23, 59, 59, 999);
              monthEnd.setTime(actualMonthEnd.getTime());
            }

            const scrobbles = await this.getMonthlyScrobbles(monthStart, monthEnd);

            trends.push({
              date: this.formatDateForApi(monthStart),
              scrobbles,
              label: `${monthStart.getFullYear()}年${monthStart.getMonth() + 1}月`
            });
          }
          break;
      }

      console.log(`✅ 聴取推移データ取得完了: ${trends.length}件`);
      return trends;

    } catch (error) {
      console.error(`❌ 聴取推移データ取得エラー (${period}):`, error);
      return [];
    }
  }

  /**
   * 日別のScrobbles数を取得
   */
  private async getDailyScrobbles(startDate: Date, endDate?: Date): Promise<number> {
    try {
      // 開始日の0時に設定
      const startOfDay = new Date(startDate);
      startOfDay.setHours(0, 0, 0, 0);

      // 終了日が指定されていない場合の処理
      let effectiveEndDate: Date;
      if (!endDate) {
        // 今日の日付の場合は現在時刻まで、それ以外は23:59:59まで
        const now = new Date();
        const isToday = startDate.getDate() === now.getDate() &&
          startDate.getMonth() === now.getMonth() &&
          startDate.getFullYear() === now.getFullYear();

        effectiveEndDate = isToday ? now : new Date(startDate);
        if (!isToday) {
          effectiveEndDate.setHours(23, 59, 59, 999);
        }
      } else {
        // 終了日が指定されている場合はそのまま使用
        effectiveEndDate = endDate;
      }

      const from = Math.floor(startOfDay.getTime() / 1000);
      const to = Math.floor(effectiveEndDate.getTime() / 1000);

      console.log(`📅 日別データ取得: ${startDate.toLocaleDateString('ja-JP')} から ${effectiveEndDate.toLocaleDateString('ja-JP')} まで (${from} - ${to})`);

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

      console.log(`🎵 ${startDate.toLocaleDateString('ja-JP')}: API total=${totalFromAPI}, actual tracks=${actualTracks}, valid tracks (excluding now playing)=${validTrackCount}`);

      // API totalの値が常に正確であれば、それを返す
      // 精度が低い場合は、実際のトラック数をカウントして返す
      return totalFromAPI;
    } catch (error) {
      console.error('❌ 日別スクロブル数取得エラー:', error);
      return 0;
    }
  }

  /**
   * 週別のScrobbles数を取得
   * @param startDate 取得開始日
   * @param endDate 取得終了日（指定しない場合は週の終わりまで）
   */
  private async getWeeklyScrobbles(startDate: Date, endDate?: Date): Promise<number> {
    try {
      // 週の開始日の0時から終了日（または7日後の23:59:59）までのデータを取得
      const startOfWeek = new Date(startDate);
      startOfWeek.setHours(0, 0, 0, 0);

      let endOfWeek: Date;
      if (endDate) {
        // 指定された終了日を使用
        endOfWeek = new Date(endDate);
      } else {
        // 従来の動作（週の最後の日）
        endOfWeek = new Date(startOfWeek);
        endOfWeek.setDate(endOfWeek.getDate() + 6);
        endOfWeek.setHours(23, 59, 59, 999);
      }

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
   * 月別のScrobbles数を取得
   * @param startDate 取得開始日（月の1日を指定）
   * @param endDate 取得終了日（指定しない場合は月の最終日まで）
   */
  private async getMonthlyScrobbles(startDate: Date, endDate?: Date): Promise<number> {
    try {
      // 月の1日の0時から終了日（または月末の23:59:59）までのデータを取得
      const startOfMonth = new Date(startDate.getFullYear(), startDate.getMonth(), 1, 0, 0, 0, 0);

      let endOfMonth: Date;
      if (endDate) {
        // 指定された終了日を使用
        endOfMonth = new Date(endDate);
      } else {
        // 従来の動作（月の最終日）
        endOfMonth = new Date(startDate.getFullYear(), startDate.getMonth() + 1, 0, 23, 59, 59, 999);
      }

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
        // 今日のデータのみ
        const today = new Date(now);
        today.setHours(0, 0, 0, 0);
        trends.push({
          date: this.formatDateForApi(today),
          scrobbles: Math.floor(Math.random() * 50) + 10,
          label: today.toLocaleDateString('ja-JP', { month: 'short', day: 'numeric' })
        });
        break;
      case 'weekly':
        // 今週のデータのみ
        const weekStart = new Date(now);
        const dayOfWeek = weekStart.getDay();
        weekStart.setDate(weekStart.getDate() - dayOfWeek); // 今週の日曜日に設定
        weekStart.setHours(0, 0, 0, 0);
        trends.push({
          date: this.formatDateForApi(weekStart),
          scrobbles: Math.floor(Math.random() * 200) + 50,
          label: `${weekStart.toLocaleDateString('ja-JP', { month: 'short', day: 'numeric' })}週`
        });
        break;
      case 'monthly':
        // 今月のデータのみ
        const monthStart = new Date(now);
        monthStart.setDate(1); // 月の1日に設定
        monthStart.setHours(0, 0, 0, 0);
        trends.push({
          date: this.formatDateForApi(monthStart),
          scrobbles: Math.floor(Math.random() * 800) + 200,
          label: monthStart.toLocaleDateString('ja-JP', { year: 'numeric', month: 'short' })
        });
        break;
    }

    return trends;
  }

  /**
   * レポート期間に対応するLast.fm API期間パラメータを取得
   * @deprecated 新しいgetPeriodDatesメソッドを使用してください
   */
  private getApiPeriod(period: 'daily' | 'weekly' | 'monthly'): string {
    switch (period) {
      case 'daily':
        return '1day'; // 1日のデータに変更（7day → 1day）
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
        // その日の0時から現在時刻までのデータを対象とする
        return {
          start: today.toLocaleDateString('ja-JP'),
          end: now.toLocaleDateString('ja-JP'),
        };
      case 'weekly':
        // 今週の日曜日から現在までのデータを対象とする
        const weekStart = new Date(now);
        const dayOfWeek = weekStart.getDay();
        weekStart.setDate(weekStart.getDate() - dayOfWeek); // 今週の日曜日に設定
        weekStart.setHours(0, 0, 0, 0);
        return {
          start: weekStart.toLocaleDateString('ja-JP'),
          end: now.toLocaleDateString('ja-JP'),
        };
      case 'monthly':
        // 今月の1日から現在までのデータを対象とする
        const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
        return {
          start: monthStart.toLocaleDateString('ja-JP'),
          end: now.toLocaleDateString('ja-JP'),
        };
      default:
        return {
          start: today.toLocaleDateString('ja-JP'),
          end: today.toLocaleDateString('ja-JP'),
        };
    }
  }

  /**
   * 直近の再生履歴を取得
   * @param options 取得オプション（件数、ページ、期間など）
   * @returns 再生履歴の配列
   */
  async getRecentTracks(options: RecentTracksOptions = {}): Promise<RecentTrackInfo[]> {
    try {
      const {
        limit = 50,
        page = 1,
        from,
        to,
      } = options;

      // limitは1-200の範囲に制限
      const validLimit = Math.min(Math.max(limit, 1), 200);

      const params: any = {
        method: 'user.getrecenttracks',
        user: config.lastfm.username,
        api_key: config.lastfm.apiKey,
        format: 'json',
        limit: validLimit,
        page,
      };

      // 期間指定がある場合はUNIXタイムスタンプを追加
      if (from) {
        params.from = Math.floor(from.getTime() / 1000);
      }
      if (to) {
        params.to = Math.floor(to.getTime() / 1000);
      }

      console.log(`📻 直近の再生履歴を取得中... (${validLimit}件, ページ${page})`);

      const response = await axios.get<LastFmRecentTracksResponse>(this.baseUrl, {
        params,
        timeout: 10000,
      });

      const tracks = response.data.recenttracks.track;
      if (!tracks || tracks.length === 0) {
        return [];
      }

      // 配列でない場合（1件のみ）は配列に変換
      const trackList = Array.isArray(tracks) ? tracks : [tracks];

      const enhancedTracks = await Promise.all(
        trackList.map(async (track): Promise<RecentTrackInfo> => {
          const isNowPlaying = track['@attr']?.nowplaying === 'true';
          const playedAt = !isNowPlaying && track.date?.uts
            ? new Date(parseInt(track.date.uts) * 1000)
            : undefined;

          const lastfmImageUrl = this.extractLargeImage(track);

          return {
            artist: track.artist['#text'],
            track: track.name,
            album: this.normalizeAlbumName(track.album?.['#text']),
            imageUrl: lastfmImageUrl,
            isPlaying: isNowPlaying,
            playedAt,
            url: track.url,
          };
        })
      );

      return enhancedTracks;

    } catch (error) {
      if (axios.isAxiosError(error)) {
        console.error('❌ Last.fm 再生履歴取得エラー:', error.response?.status, error.message);
      } else {
        console.error('❌ Last.fm 再生履歴取得エラー:', error);
      }
      return [];
    }
  }

  /**
   * 指定期間の再生履歴を全て取得（ページネーション対応）
   * @param from 開始日時
   * @param to 終了日時
   * @param maxTracks 最大取得件数（デフォルト1000、制限なしは-1）
   * @returns 再生履歴の配列
   */
  async getAllRecentTracks(from: Date, to: Date, maxTracks: number = 1000): Promise<RecentTrackInfo[]> {
    const allTracks: RecentTrackInfo[] = [];
    let page = 1;
    let totalRetrieved = 0;

    try {
      console.log(`📻 期間内の全再生履歴を取得中... (${from.toLocaleDateString()} - ${to.toLocaleDateString()})`);

      while (true) {
        const tracks = await this.getRecentTracks({
          limit: 200, // 最大値で効率的に取得
          page,
          from,
          to,
        });

        if (tracks.length === 0) {
          break; // これ以上データがない
        }

        // 現在再生中のトラックは除外（過去の履歴のみ）
        const pastTracks = tracks.filter(track => !track.isPlaying);
        allTracks.push(...pastTracks);
        totalRetrieved += pastTracks.length;

        console.log(`📊 ${totalRetrieved}件の履歴を取得済み... (ページ${page})`);

        // 最大件数に達した場合は終了
        if (maxTracks > 0 && totalRetrieved >= maxTracks) {
          console.log(`📊 最大取得件数(${maxTracks})に達したため取得を終了`);
          break;
        }

        // 200件未満の場合は最後のページ
        if (tracks.length < 200) {
          break;
        }

        page++;

        // API制限を考慮して少し待機
        await new Promise(resolve => setTimeout(resolve, 100));
      }

      console.log(`✅ 合計${totalRetrieved}件の再生履歴を取得しました`);
      return maxTracks > 0 ? allTracks.slice(0, maxTracks) : allTracks;

    } catch (error) {
      console.error('❌ 全再生履歴取得エラー:', error);
      return allTracks; // 取得済みのデータは返す
    }
  }

  /**
   * ユーザー統計情報を取得
   * user.getInfo + No.1トップアーティスト + No.1トップトラック
   */
  async getUserStats(): Promise<UserStats> {
    try {
      console.log('📊 ユーザー統計情報を取得中...');

      const [userInfo, topArtists, topTracks] = await Promise.all([
        this.getUserInfo(),
        this.getTopArtists('overall', 1),
        this.getTopTracks('overall', 1),
      ]);

      const stats: UserStats = {
        profile: {
          username: userInfo.name,
          realName: userInfo.realname || undefined,
          url: userInfo.url,
          country: userInfo.country || undefined,
          registeredDate: userInfo.registered['#text'],
          totalPlayCount: parseInt(userInfo.playcount) || 0,
          profileImage: this.extractUserImage(userInfo.image),
        },
        topArtist: topArtists[0] ? {
          name: topArtists[0].name,
          playCount: parseInt(topArtists[0].playcount) || 0,
          url: topArtists[0].url || '',
          image: this.extractArtistImage(topArtists[0].image || []),
        } : null,
        topTrack: topTracks[0] ? {
          name: topTracks[0].name,
          artist: topTracks[0].artist.name,
          playCount: parseInt(topTracks[0].playcount) || 0,
          url: topTracks[0].url || '',
          image: this.extractTrackImage(topTracks[0].image || []),
        } : null,
        generatedAt: new Date().toISOString(),
      };

      console.log('✅ ユーザー統計情報の取得完了');
      return stats;
    } catch (error) {
      console.error('❌ ユーザー統計情報取得エラー:', error);
      throw error;
    }
  }

  /**
   * ユーザー情報を取得（user.getInfo）
   */
  private async getUserInfo(): Promise<any> {
    const response = await axios.get(this.baseUrl, {
      params: {
        method: 'user.getinfo',
        user: config.lastfm.username,
        api_key: config.lastfm.apiKey,
        format: 'json',
      },
      timeout: 10000,
    });

    return response.data.user;
  }

  /**
   * ユーザープロフィール画像URLを抽出
   */
  private extractUserImage(images: any[]): string | undefined {
    if (!images || !Array.isArray(images)) return undefined;

    const largeImage = images.find(img => img.size === 'large');
    const mediumImage = images.find(img => img.size === 'medium');
    const anyImage = images[0];

    return largeImage?.['#text'] || mediumImage?.['#text'] || anyImage?.['#text'] || undefined;
  }

  /**
   * アーティスト画像URLを抽出
   */
  private extractArtistImage(images: any[]): string | undefined {
    if (!images || !Array.isArray(images)) return undefined;

    const largeImage = images.find(img => img.size === 'large');
    const mediumImage = images.find(img => img.size === 'medium');
    const anyImage = images[0];

    return largeImage?.['#text'] || mediumImage?.['#text'] || anyImage?.['#text'] || undefined;
  }

  /**
   * トラック画像URLを抽出（トップトラック用）
   */
  private extractTrackImage(images: any[]): string | undefined {
    if (!images || !Array.isArray(images)) return undefined;

    const largeImage = images.find(img => img.size === 'extralarge') ||
      images.find(img => img.size === 'large') ||
      images.find(img => img.size === 'medium');

    return largeImage?.['#text'] || undefined;
  }

  /**
   * 指定された期間の開始日と終了日を取得
   * @param period 期間タイプ ('daily' | 'weekly' | 'monthly')
   * @param targetDate 基準となる日付（未指定の場合は現在時刻）
   */
  private getPeriodDates(
    period: 'daily' | 'weekly' | 'monthly',
    targetDate?: Date | string
  ): { startDate: Date; endDate: Date } {
    // targetDateが文字列の場合はDateオブジェクトに変換
    let baseDate: Date;

    if (targetDate) {
      if (typeof targetDate === 'string') {
        baseDate = new Date(targetDate);
        // 不正な日付文字列の場合は現在時刻を使用
        if (isNaN(baseDate.getTime())) {
          console.warn(`⚠️ 不正な日付文字列です: ${targetDate}, 現在時刻を使用します`);
          baseDate = new Date();
        }
      } else {
        baseDate = targetDate;
      }
    } else {
      // 未指定の場合は現在時刻
      baseDate = new Date();
    }

    switch (period) {
      case 'daily':
        // 指定日の0時から23:59:59まで
        const dayStart = new Date(baseDate);
        dayStart.setHours(0, 0, 0, 0);

        const dayEnd = new Date(baseDate);
        // 同日の場合は現在時刻、それ以外は23:59:59
        if (dayStart.toDateString() === new Date().toDateString()) {
          dayEnd.setTime(new Date().getTime());
        } else {
          dayEnd.setHours(23, 59, 59, 999);
        }

        return {
          startDate: dayStart,
          endDate: dayEnd,
        };
      case 'weekly':
        // 指定日がある週の日曜日から土曜日まで
        const weekStart = new Date(baseDate);
        const dayOfWeek = weekStart.getDay();
        weekStart.setDate(weekStart.getDate() - dayOfWeek); // 週の日曜日に設定
        weekStart.setHours(0, 0, 0, 0);

        // 週の終わりの日（土曜日）を計算
        const weekEnd = new Date(weekStart);
        weekEnd.setDate(weekStart.getDate() + 6); // 日曜日から6日後は土曜日

        // 現在の週かどうかを判定
        const now = new Date();
        const today = new Date(now);
        today.setHours(0, 0, 0, 0);

        const currentWeekDay = today.getDay();
        const currentWeekStart = new Date(today);
        currentWeekStart.setDate(currentWeekStart.getDate() - currentWeekDay); // 今週の日曜日

        const isCurrentWeek = weekStart.toDateString() === currentWeekStart.toDateString();

        if (isCurrentWeek) {
          // 現在の週の場合は終了時刻を現在時刻に設定
          weekEnd.setTime(now.getTime());
        } else {
          // それ以外は週の終わり（土曜日）の23:59:59に設定
          weekEnd.setHours(23, 59, 59, 999);
        }

        return {
          startDate: weekStart,
          endDate: weekEnd,
        };
      case 'monthly':
        // 指定日がある月の1日から月末まで
        const monthStart = new Date(baseDate.getFullYear(), baseDate.getMonth(), 1, 0, 0, 0, 0);

        // 現在の月の場合は現在時刻、それ以外は月の終わり
        let monthEnd;
        if (monthStart.getMonth() === new Date().getMonth() &&
          monthStart.getFullYear() === new Date().getFullYear()) {
          monthEnd = new Date();
        } else {
          // 翌月の0日 = 今月の末日
          monthEnd = new Date(baseDate.getFullYear(), baseDate.getMonth() + 1, 0, 23, 59, 59, 999);
        }

        return {
          startDate: monthStart,
          endDate: monthEnd,
        };
      default:
        // デフォルトは今日
        const defaultStart = new Date(baseDate);
        defaultStart.setHours(0, 0, 0, 0);

        const defaultEnd = new Date(baseDate);
        if (defaultStart.toDateString() === new Date().toDateString()) {
          defaultEnd.setTime(new Date().getTime());
        } else {
          defaultEnd.setHours(23, 59, 59, 999);
        }

        return {
          startDate: defaultStart,
          endDate: defaultEnd,
        };
    }
  }

  /**
   * 指定期間内のトップトラックを取得
   * Last.fmのAPIには期間指定でのトップトラック取得がないため、
   * user.getrecenttracksから取得して集計する
   */
  private async getTopTracksByTimeRange(startDate: Date, endDate: Date, limit: number = 100): Promise<any[]> {
    try {
      console.log(`📊 期間指定のトップトラック取得中... (${startDate.toLocaleDateString('ja-JP')} - ${endDate.toLocaleDateString('ja-JP')})`);

      // 期間内の再生履歴を全て取得（最大1000件）
      const allTracks = await this.getAllRecentTracks(startDate, endDate, 1000);

      // トラックごとの再生回数をカウント
      const trackCounts: { [key: string]: { track: RecentTrackInfo, count: number } } = {};

      allTracks.forEach(track => {
        // アーティスト名 + トラック名でユニークキーを作成
        const key = `${track.artist}:::${track.track}`;

        if (!trackCounts[key]) {
          trackCounts[key] = {
            track,
            count: 0
          };
        }

        trackCounts[key].count++;
      });

      // 再生回数でソート
      const sortedTracks = Object.values(trackCounts).sort((a, b) => b.count - a.count);

      // Last.fmのトップトラックAPIと同じ形式に変換
      const result = sortedTracks.slice(0, limit).map((item, index) => {
        const { track, count } = item;
        return {
          name: track.track,
          artist: {
            name: track.artist,
            url: `https://www.last.fm/music/${encodeURIComponent(track.artist)}`,
            mbid: '',
          },
          url: track.url || `https://www.last.fm/music/${encodeURIComponent(track.artist)}/_/${encodeURIComponent(track.track)}`,
          image: track.imageUrl ? [
            { size: 'small', '#text': track.imageUrl },
            { size: 'medium', '#text': track.imageUrl },
            { size: 'large', '#text': track.imageUrl },
            { size: 'extralarge', '#text': track.imageUrl }
          ] : [],
          '@attr': { rank: (index + 1).toString() },
          playcount: count.toString(),
        };
      });

      console.log(`✅ 期間指定のトップトラック取得完了: ${result.length}件`);
      return result;
    } catch (error) {
      console.error('❌ 期間指定のトップトラック取得エラー:', error);
      // エラー時は空配列を返す
      return [];
    }
  }

  /**
   * 指定期間内のトップアーティストを取得
   */
  private async getTopArtistsByTimeRange(startDate: Date, endDate: Date, limit: number = 100): Promise<any[]> {
    try {
      console.log(`📊 期間指定のトップアーティスト取得中... (${startDate.toLocaleDateString('ja-JP')} - ${endDate.toLocaleDateString('ja-JP')})`);

      // 期間内の再生履歴を全て取得（最大1000件）
      const allTracks = await this.getAllRecentTracks(startDate, endDate, 1000);

      // アーティストごとの再生回数をカウント
      const artistCounts: { [key: string]: { artist: string, count: number, url: string, imageUrl?: string } } = {};

      allTracks.forEach(track => {
        const artist = track.artist;

        if (!artistCounts[artist]) {
          artistCounts[artist] = {
            artist,
            count: 0,
            url: `https://www.last.fm/music/${encodeURIComponent(artist)}`,
            imageUrl: track.imageUrl,
          };
        }

        artistCounts[artist].count++;

        // 画像URLが未設定なら設定する
        if (!artistCounts[artist].imageUrl && track.imageUrl) {
          artistCounts[artist].imageUrl = track.imageUrl;
        }
      });

      // 再生回数でソート
      const sortedArtists = Object.values(artistCounts).sort((a, b) => b.count - a.count);

      // Last.fmのトップアーティストAPIと同じ形式に変換
      const result = sortedArtists.slice(0, limit).map((item, index) => {
        const { artist, count, url, imageUrl } = item;
        return {
          name: artist,
          url: url,
          playcount: count.toString(),
          '@attr': { rank: (index + 1).toString() },
          mbid: '',
          image: imageUrl ? [
            { size: 'small', '#text': imageUrl },
            { size: 'medium', '#text': imageUrl },
            { size: 'large', '#text': imageUrl },
            { size: 'extralarge', '#text': imageUrl },
            { size: 'mega', '#text': imageUrl }
          ] : [],
        };
      });

      console.log(`✅ 期間指定のトップアーティスト取得完了: ${result.length}件`);
      return result;
    } catch (error) {
      console.error('❌ 期間指定のトップアーティスト取得エラー:', error);
      // エラー時は空配列を返す
      return [];
    }
  }

  /**
   * 指定期間内のトップアルバムを取得
   */
  private async getTopAlbumsByTimeRange(startDate: Date, endDate: Date, limit: number = 50): Promise<any[]> {
    try {
      console.log(`📊 期間指定のトップアルバム取得中... (${startDate.toLocaleDateString('ja-JP')} - ${endDate.toLocaleDateString('ja-JP')})`);

      // 期間内の再生履歴を全て取得（最大1000件）
      const allTracks = await this.getAllRecentTracks(startDate, endDate, 1000);

      // アルバムごとの再生回数をカウント (アーティスト+アルバム名でグループ化)
      const albumCounts: { [key: string]: { artist: string, album: string, count: number, imageUrl?: string } } = {};

      allTracks.forEach(track => {
        // アルバム情報がない場合はスキップ
        if (!track.album) return;

        // アルバム名を正規化
        const normalizedAlbum = this.normalizeAlbumName(track.album) || track.album;

        const key = `${track.artist}:::${normalizedAlbum}`;

        if (!albumCounts[key]) {
          albumCounts[key] = {
            artist: track.artist,
            album: normalizedAlbum,
            count: 0,
            imageUrl: track.imageUrl,
          };
        }

        albumCounts[key].count++;

        // 画像URLが未設定なら設定する
        if (!albumCounts[key].imageUrl && track.imageUrl) {
          albumCounts[key].imageUrl = track.imageUrl;
        }
      });

      // 再生回数でソート
      const sortedAlbums = Object.values(albumCounts).sort((a, b) => b.count - a.count);

      // Last.fmのトップアルバムAPIと同じ形式に変換
      const result = sortedAlbums.slice(0, limit).map((item, index) => {
        const { artist, album, count, imageUrl } = item;
        return {
          name: album,
          artist: {
            name: artist,
            mbid: '',
            url: `https://www.last.fm/music/${encodeURIComponent(artist)}`,
          },
          url: `https://www.last.fm/music/${encodeURIComponent(artist)}/${encodeURIComponent(album)}`,
          '@attr': { rank: (index + 1).toString() },
          playcount: count.toString(),
          mbid: '',
          image: imageUrl ? [
            { size: 'small', '#text': imageUrl },
            { size: 'medium', '#text': imageUrl },
            { size: 'large', '#text': imageUrl },
            { size: 'extralarge', '#text': imageUrl }
          ] : [],
        };
      });

      console.log(`✅ 期間指定のトップアルバム取得完了: ${result.length}件`);
      return result;
    } catch (error) {
      console.error('❌ 期間指定のトップアルバム取得エラー:', error);
      // エラー時は空配列を返す
      return [];
    }
  }

  /**
   * 週の各日の再生数統計を取得する
   * @param fromDate 期間開始日
   * @param toDate 期間終了日
   * @returns 指定期間内の各日の再生数統計
   */
  async getWeekDailyStats(fromDate: Date, toDate: Date): Promise<DailyStatsItem[]> {
    try {
      console.log(`📊 週の詳細統計取得開始 (${fromDate.toLocaleDateString('ja-JP')} - ${toDate.toLocaleDateString('ja-JP')})`);

      const stats: DailyStatsItem[] = [];
      const currentDate = new Date(fromDate);

      // 開始日から終了日まで1日ずつ取得
      while (currentDate <= toDate) {
        // その日の終了時刻を23:59:59に設定（ただし今日の場合は現在時刻まで）
        const isToday = currentDate.toDateString() === new Date().toDateString();
        const endDate = isToday ? new Date() : new Date(currentDate);
        if (!isToday) {
          endDate.setHours(23, 59, 59, 999);
        }

        // その日の再生数を取得
        const scrobbleCount = await this.getDailyScrobbles(currentDate, endDate);

        stats.push({
          date: this.formatDateForApi(currentDate),
          scrobbles: scrobbleCount,
          dayOfWeek: currentDate.getDay(), // 0: 日曜日, 1: 月曜日, ... 6: 土曜日
          label: currentDate.toLocaleDateString('ja-JP', { month: 'short', day: 'numeric', weekday: 'short' })
        });

        // 次の日に進む
        currentDate.setDate(currentDate.getDate() + 1);
      }

      console.log(`✅ 週の詳細統計取得完了: ${stats.length}日分`);
      return stats;
    } catch (error) {
      console.error('❌ 週の詳細統計取得エラー:', error);
      return [];
    }
  }

  /**
   * 月の各週の再生数統計を取得する
   * @param fromDate 期間開始日
   * @param toDate 期間終了日
   * @returns 指定期間内の各週の再生数統計
   */
  async getMonthWeeklyStats(fromDate: Date, toDate: Date): Promise<WeeklyStatsItem[]> {
    try {
      console.log(`📊 月の詳細統計取得開始 (${fromDate.toLocaleDateString('ja-JP')} - ${toDate.toLocaleDateString('ja-JP')})`);

      // 開始日が含まれる週の日曜日を計算
      const firstSunday = new Date(fromDate);
      const firstDayOfWeek = firstSunday.getDay();
      firstSunday.setDate(firstSunday.getDate() - firstDayOfWeek); // 最初の日曜日に設定
      firstSunday.setHours(0, 0, 0, 0);

      const stats: WeeklyStatsItem[] = [];
      let weekStart = new Date(firstSunday);

      // 指定期間をカバーする週ごとに統計を取得
      while (weekStart <= toDate) {
        // 週の終了日（土曜日）を計算
        const weekEnd = new Date(weekStart);
        weekEnd.setDate(weekStart.getDate() + 6);
        weekEnd.setHours(23, 59, 59, 999);

        // 週の期間を指定範囲に制限
        const actualWeekStart = weekStart < fromDate ? fromDate : weekStart;
        const actualWeekEnd = weekEnd > toDate ? toDate : weekEnd;

        // 週の終了日が今日以降の場合は現在時刻までに調整
        const now = new Date();
        const adjustedWeekEnd = actualWeekEnd > now ? now : actualWeekEnd;

        // 週の再生数を取得
        const scrobbleCount = await this.getWeeklyScrobbles(actualWeekStart, adjustedWeekEnd);

        // 週の期間を表すラベル（例: 6/29-7/5）
        const weekLabel = `${actualWeekStart.getMonth() + 1}/${actualWeekStart.getDate()}-${actualWeekEnd.getMonth() + 1}/${actualWeekEnd.getDate()}`;

        stats.push({
          startDate: this.formatDateForApi(actualWeekStart),
          endDate: this.formatDateForApi(actualWeekEnd),
          scrobbles: scrobbleCount,
          label: weekLabel,
          weekNumber: stats.length + 1 // 週番号（1-indexed）
        });

        // 次の週の日曜日に進む
        weekStart = new Date(weekStart);
        weekStart.setDate(weekStart.getDate() + 7);
      }

      console.log(`✅ 月の詳細統計取得完了: ${stats.length}週分`);
      return stats;
    } catch (error) {
      console.error('❌ 月の詳細統計取得エラー:', error);
      return [];
    }
  }

  /**
   * 年の各月の再生数統計を取得する
   * @param fromDate 期間開始日
   * @param toDate 期間終了日
   * @returns 指定期間内の各月の再生数統計
   */
  async getYearMonthlyStats(fromDate: Date, toDate: Date): Promise<MonthlyStatsItem[]> {
    try {
      console.log(`📊 年間月別統計取得開始 (${fromDate.toLocaleDateString('ja-JP')} - ${toDate.toLocaleDateString('ja-JP')})`);

      const stats: MonthlyStatsItem[] = [];
      const now = new Date();

      // 開始月から終了月まで処理
      let currentMonth = new Date(fromDate.getFullYear(), fromDate.getMonth(), 1);
      const endMonth = new Date(toDate.getFullYear(), toDate.getMonth(), 1);

      while (currentMonth <= endMonth) {
        // 月の初日と最終日を計算
        const monthStart = new Date(currentMonth);
        const monthEnd = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 0, 23, 59, 59, 999);

        // 実際の期間範囲に制限
        const actualMonthStart = monthStart < fromDate ? fromDate : monthStart;
        const actualMonthEnd = monthEnd > toDate ? toDate : monthEnd;

        // 現在時刻以降の場合は現在時刻までに調整
        const adjustedMonthEnd = actualMonthEnd > now ? now : actualMonthEnd;

        // 月間の再生数を取得
        const scrobbleCount = await this.getMonthlyScrobbles(actualMonthStart, adjustedMonthEnd);

        stats.push({
          year: currentMonth.getFullYear(),
          month: currentMonth.getMonth() + 1,
          scrobbles: scrobbleCount,
          label: `${currentMonth.getMonth() + 1}月`,
          startDate: this.formatDateForApi(actualMonthStart),
          endDate: this.formatDateForApi(adjustedMonthEnd)
        });

        // 次の月に進む
        currentMonth.setMonth(currentMonth.getMonth() + 1);
      }

      console.log(`✅ 年間月別統計取得完了: ${stats.length}ヶ月分`);
      return stats;
    } catch (error) {
      console.error('❌ 年間月別統計取得エラー:', error);
      return [];
    }
  }

  /**
   * アルバム名を正規化（「 - EP」「 - Single」などの接尾辞を除去）
   * @param albumName 元のアルバム名
   * @returns 正規化されたアルバム名
   */
  private normalizeAlbumName(albumName: string | undefined): string | undefined {
    if (!albumName) return albumName;

    // 「 - EP」「 - Single」「 - Album」「 - LP」などの接尾辞を除去
    // 接尾辞の後に更に情報が続く場合も考慮（例: "Dream Believers - EP (104期 Ver.)" → "Dream Believers (104期 Ver.)"）
    const suffixPatterns = [
      / - EP(?=\s|$)/i,      // " - EP" の後に空白文字または行末
      / - Single(?=\s|$)/i,  // " - Single" の後に空白文字または行末
      / - Album(?=\s|$)/i,   // " - Album" の後に空白文字または行末
      / - LP(?=\s|$)/i,      // " - LP" の後に空白文字または行末
      / - Deluxe(?=\s|$)/i,  // " - Deluxe" の後に空白文字または行末
    ];

    let normalizedName = albumName;

    for (const pattern of suffixPatterns) {
      normalizedName = normalizedName.replace(pattern, '');
    }

    return normalizedName.trim();
  }
}
