import axios, { AxiosResponse } from 'axios';
import { config } from '../utils/config';
import {
  SpotifyTrack,
  SpotifyArtist,
  SpotifySearchResponse,
  SpotifyTokenResponse,
  SpotifyCurrentlyPlaying,
  SpotifyPlaybackState,
  ImageMatchResult,
  SpotifyApiError
} from '../types/spotify';
import { MatchingUtils } from '../utils/matching';
import { DatabaseService } from './database';
import { ImageDetectionUtils } from '../utils/image-detection';

export class SpotifyService {
  private accessToken: string | null = null;
  private userAccessToken: string | null = null; // ユーザー認証用
  private tokenExpiresAt: number = 0;
  private userTokenExpiresAt: number = 0;
  private readonly baseUrl = 'https://api.spotify.com/v1';
  private readonly tokenUrl = 'https://accounts.spotify.com/api/token';
  private dbService: DatabaseService | null = null;

  constructor(dbService?: DatabaseService) {
    this.dbService = dbService || null;

    if (!config.spotify.enabled) {
      console.log('🎵 Spotify統合は無効です');
      return;
    }

    if (!config.spotify.clientId || !config.spotify.clientSecret) {
      console.warn('⚠️ Spotify認証情報が設定されていません');
      return;
    }

    console.log('🎵 Spotify統合が有効です');
  }

  /**
   * Spotify統合が有効かチェック
   */
  isEnabled(): boolean {
    return config.spotify.enabled &&
      !!config.spotify.clientId &&
      !!config.spotify.clientSecret;
  }

  /**
   * ユーザー認証が設定されているかチェック
   */
  isUserAuthEnabled(): boolean {
    return this.isEnabled() && !!config.spotify.refreshToken;
  }

  /**
   * ユーザー認証トークンを取得（refresh tokenを使用）
   */
  private async getUserAccessToken(): Promise<string> {
    if (!this.isUserAuthEnabled()) {
      throw new Error('Spotify ユーザー認証が設定されていません');
    }

    // 既存のトークンが有効な場合は再利用
    if (this.userAccessToken && Date.now() < this.userTokenExpiresAt) {
      return this.userAccessToken;
    }

    try {
      const credentials = Buffer.from(
        `${config.spotify.clientId}:${config.spotify.clientSecret}`
      ).toString('base64');

      const response: AxiosResponse<SpotifyTokenResponse> = await axios.post(
        this.tokenUrl,
        new URLSearchParams({
          grant_type: 'refresh_token',
          refresh_token: config.spotify.refreshToken
        }),
        {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'Authorization': `Basic ${credentials}`
          },
          timeout: config.spotify.requestTimeout
        }
      );

      this.userAccessToken = response.data.access_token;
      // 1分前に期限切れ扱いにして安全マージンを確保
      this.userTokenExpiresAt = Date.now() + (response.data.expires_in * 1000) - 60000;

      console.log('🔐 Spotify ユーザー認証成功');
      return this.userAccessToken;
    } catch (error) {
      console.error('❌ Spotify ユーザー認証エラー:', error);
      throw new Error('Spotify ユーザー認証に失敗しました');
    }
  }

  /**
   * アクセストークンを取得
   */
  private async getAccessToken(): Promise<string> {
    if (!this.isEnabled()) {
      throw new Error('Spotify統合が無効です');
    }

    // 既存のトークンが有効な場合は再利用
    if (this.accessToken && Date.now() < this.tokenExpiresAt) {
      return this.accessToken;
    }

    try {
      const credentials = Buffer.from(
        `${config.spotify.clientId}:${config.spotify.clientSecret}`
      ).toString('base64');

      const response: AxiosResponse<SpotifyTokenResponse> = await axios.post(
        this.tokenUrl,
        'grant_type=client_credentials',
        {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'Authorization': `Basic ${credentials}`
          },
          timeout: config.spotify.requestTimeout
        }
      );

      this.accessToken = response.data.access_token;
      // 1分前に期限切れ扱いにして安全マージンを確保
      this.tokenExpiresAt = Date.now() + (response.data.expires_in * 1000) - 60000;

      console.log('🔐 Spotify認証成功');
      return this.accessToken;
    } catch (error) {
      console.error('❌ Spotify API認証エラー:', error);
      throw new Error('Spotify認証に失敗しました');
    }
  }

  /**
   * Spotify User API共通リクエストメソッド
   */
  private async makeUserRequest<T>(endpoint: string, params: Record<string, any> = {}): Promise<T> {
    if (!this.isUserAuthEnabled()) {
      throw new Error('Spotify ユーザー認証が設定されていません');
    }

    try {
      const token = await this.getUserAccessToken();
      const response: AxiosResponse<T> = await axios.get(`${this.baseUrl}${endpoint}`, {
        params: {
          ...params,
          market: 'JP' // 日本市場に限定
        },
        headers: {
          'Authorization': `Bearer ${token}`
        },
        timeout: config.spotify.requestTimeout
      });

      return response.data;
    } catch (error) {
      if (axios.isAxiosError(error) && error.response) {
        const spotifyError = error.response.data as SpotifyApiError;
        console.error('❌ Spotify User API エラー:', spotifyError.error?.message || error.message);
      } else {
        console.error('❌ Spotify User API リクエストエラー:', error);
      }
      throw error;
    }
  }

  /**
   * 現在の再生状態を取得（簡略版）
   */
  async getCurrentlyPlaying(): Promise<SpotifyCurrentlyPlaying | null> {
    if (!this.isUserAuthEnabled()) {
      return null;
    }

    try {
      const response = await this.makeUserRequest<SpotifyCurrentlyPlaying>(
        '/me/player/currently-playing'
      );
      return response;
    } catch (error) {
      if (axios.isAxiosError(error) && error.response?.status === 204) {
        // 204は何も再生していない状態
        return null;
      }
      console.error('❌ Spotify 現在の再生取得エラー:', error);
      return null;
    }
  }

  /**
   * プレイバック状態を取得（詳細版）
   */
  async getPlaybackState(): Promise<SpotifyPlaybackState | null> {
    if (!this.isUserAuthEnabled()) {
      return null;
    }

    try {
      const response = await this.makeUserRequest<SpotifyPlaybackState>('/me/player');
      return response;
    } catch (error) {
      if (axios.isAxiosError(error) && error.response?.status === 204) {
        // 204は何も再生していない状態
        return null;
      }
      console.error('❌ Spotify プレイバック状態取得エラー:', error);
      return null;
    }
  }

  /**
   * Spotifyで音楽が再生中かどうかをチェック
   */
  async isSpotifyPlaying(): Promise<boolean> {
    try {
      const currentlyPlaying = await this.getCurrentlyPlaying();
      return currentlyPlaying?.is_playing === true &&
        currentlyPlaying?.currently_playing_type === 'track';
    } catch (error) {
      console.error('❌ Spotify 再生状態チェックエラー:', error);
      return false;
    }
  }

  /**
   * Spotify API共通リクエストメソッド
   */
  private async makeRequest<T>(endpoint: string, params: Record<string, any>): Promise<T> {
    if (!this.isEnabled()) {
      throw new Error('Spotify統合が無効です');
    }

    try {
      const token = await this.getAccessToken();
      const response: AxiosResponse<T> = await axios.get(`${this.baseUrl}${endpoint}`, {
        params: {
          ...params,
          market: 'JP' // 日本市場に限定
        },
        headers: {
          'Authorization': `Bearer ${token}`
        },
        timeout: config.spotify.requestTimeout
      });

      return response.data;
    } catch (error) {
      if (axios.isAxiosError(error) && error.response) {
        const spotifyError = error.response.data as SpotifyApiError;
        console.error('❌ Spotify API エラー:', spotifyError.error?.message || error.message);
      } else {
        console.error('❌ Spotify API リクエストエラー:', error);
      }
      throw error;
    }
  }

  /**
   * 楽曲検索
   */
  async searchTracks(query: string, limit: number = 5): Promise<SpotifyTrack[]> {
    try {
      const response = await this.makeRequest<SpotifySearchResponse>('/search', {
        q: query,
        type: 'track',
        limit: Math.min(limit, 50) // Spotify APIの制限
      });

      return response.tracks?.items || [];
    } catch (error) {
      console.error('❌ Spotify楽曲検索エラー:', error);
      return [];
    }
  }

  /**
   * アーティスト検索
   */
  async searchArtists(query: string, limit: number = 5): Promise<SpotifyArtist[]> {
    try {
      const response = await this.makeRequest<SpotifySearchResponse>('/search', {
        q: query,
        type: 'artist',
        limit: Math.min(limit, 50)
      });

      return response.artists?.items || [];
    } catch (error) {
      console.error('❌ Spotifyアーティスト検索エラー:', error);
      return [];
    }
  }

  /**
   * 最適な楽曲マッチを検索
   */
  async findBestTrackMatch(
    trackName: string,
    artistName: string,
    albumName?: string
  ): Promise<SpotifyTrack | null> {
    console.log(`🔍 Spotifyでの楽曲検索: ${trackName} - ${artistName}${albumName ? ` (${albumName})` : ''}`);


    if (!this.isEnabled()) {
      return null;
    }

    try {
      // 検索クエリを構築
      let query = `track:"${trackName}" artist:"${artistName}"`;
      if (albumName) {
        query += ` album:"${albumName}"`;
      }

      const tracks = await this.searchTracks(query, 5);
      if (tracks.length === 0) {
        // より緩い検索を試行
        query = `"${trackName}" "${artistName}"`;
        const fallbackTracks = await this.searchTracks(query, 5);
        tracks.push(...fallbackTracks);
      }
      console.log(`🔍 検索結果: ${tracks.length}件`);


      if (tracks.length === 0) return null;

      // 最適なマッチを選択（より低い閾値を使用）
      const bestMatch = MatchingUtils.findBestMatch(
        tracks,
        (track) => MatchingUtils.calculateTrackMatchScore(track, trackName, artistName, albumName),
        0.1  // 低い閾値で幅広くマッチング
      );

      return bestMatch?.match || null;
    } catch (error) {
      console.error('❌ Spotify楽曲マッチング エラー:', error);
      return null;
    }
  }

  /**
   * 最適なアーティストマッチを検索
   */
  async findBestArtistMatch(artistName: string): Promise<SpotifyArtist | null> {
    if (!this.isEnabled()) {
      return null;
    }

    try {
      const query = `artist:"${artistName}"`;
      const artists = await this.searchArtists(query, 5);

      if (artists.length === 0) return null;

      const bestMatch = MatchingUtils.findBestMatch(
        artists,
        (artist) => MatchingUtils.calculateArtistMatchScore(artist, artistName),
        0.1  // 低い閾値で幅広くマッチング
      );

      return bestMatch?.match || null;
    } catch (error) {
      console.error('❌ Spotifyアーティストマッチング エラー:', error);
      return null;
    }
  }

  /**
   * 画像品質を評価
   */
  private assessImageQuality(width: number, height: number): 'low' | 'medium' | 'high' {
    const resolution = Math.min(width, height);
    if (resolution >= 300) return 'high';
    if (resolution >= 64) return 'medium';
    return 'low';
  }

  /**
   * アルバムアートを取得
   */
  async getAlbumArt(
    trackName: string,
    artistName: string,
    albumName?: string
  ): Promise<ImageMatchResult | null> {
    const track = await this.findBestTrackMatch(trackName, artistName, albumName);

    if (!track || !track.album.images.length) {
      return null;
    }

    // 最高解像度の画像を選択
    const image = track.album.images[0];
    const matchScore = MatchingUtils.calculateTrackMatchScore(
      track, trackName, artistName, albumName
    );

    console.log(`✅ Spotifyアルバムアートを取得: ${trackName} - ${artistName} (${albumName || '不明'})`);

    return {
      source: 'spotify',
      url: image.url,
      width: image.width,
      height: image.height,
      quality: this.assessImageQuality(image.width, image.height),
      matchScore,
      spotifyId: track.id,
      spotifyUrl: track.external_urls.spotify
    };
  }

  /**
   * アーティストアートを取得
   */
  async getArtistArt(artistName: string): Promise<ImageMatchResult | null> {
    const artist = await this.findBestArtistMatch(artistName);

    if (!artist || !artist.images.length) {
      return null;
    }

    // 最高解像度の画像を選択
    const image = artist.images[0];
    const matchScore = MatchingUtils.calculateArtistMatchScore(artist, artistName);

    return {
      source: 'spotify',
      url: image.url,
      width: image.width,
      height: image.height,
      quality: this.assessImageQuality(image.width, image.height),
      matchScore,
      spotifyId: artist.id,
      spotifyUrl: artist.external_urls.spotify
    };
  }

  /**
   * キャッシュを考慮したアルバムアート取得
   */
  async getAlbumArtWithCache(trackName: string, artistName: string, albumName?: string): Promise<ImageMatchResult | null> {
    if (!this.dbService) {
      return this.getAlbumArt(trackName, artistName, albumName);
    }

    const searchKey = `${artistName}:::${trackName}`;

    // キャッシュから取得を試行
    const cached = await this.dbService.getSpotifyImageCache(searchKey, 'track');
    if (cached) {
      console.log('📦 キャッシュからSpotify楽曲画像を取得:', cached.imageUrl);
      return {
        source: 'spotify',
        url: cached.imageUrl,
        width: cached.imageWidth,
        height: cached.imageHeight,
        quality: cached.quality,
        matchScore: cached.matchScore,
        spotifyId: cached.spotifyId,
        spotifyUrl: cached.spotifyUrl
      };
    }

    // キャッシュにない場合はAPIから取得
    const result = await this.getAlbumArt(trackName, artistName, albumName);
    if (result && result.spotifyId) {
      // キャッシュに保存
      const expiresAt = new Date(Date.now() + config.spotify.cacheExpiryDays * 24 * 60 * 60 * 1000);
      await this.dbService.insertSpotifyImageCache({
        searchKey,
        searchType: 'track',
        spotifyId: result.spotifyId,
        imageUrl: result.url,
        imageWidth: result.width || 0,
        imageHeight: result.height || 0,
        spotifyUrl: result.spotifyUrl || '',
        matchScore: result.matchScore,
        quality: result.quality,
        createdAt: new Date(),
        updatedAt: new Date(),
        expiresAt
      });
      console.log('💾 Spotify楽曲画像をキャッシュに保存:', result.url);
    }

    return result;
  }

  /**
   * キャッシュを考慮したアーティストアート取得
   */
  async getArtistArtWithCache(artistName: string): Promise<ImageMatchResult | null> {
    if (!this.dbService) {
      return this.getArtistArt(artistName);
    }

    const searchKey = artistName;

    // キャッシュから取得を試行
    const cached = await this.dbService.getSpotifyImageCache(searchKey, 'artist');
    if (cached) {
      console.log('📦 キャッシュからSpotifyアーティスト画像を取得:', cached.imageUrl);
      return {
        source: 'spotify',
        url: cached.imageUrl,
        width: cached.imageWidth,
        height: cached.imageHeight,
        quality: cached.quality,
        matchScore: cached.matchScore,
        spotifyId: cached.spotifyId,
        spotifyUrl: cached.spotifyUrl
      };
    }

    // キャッシュにない場合はAPIから取得
    const result = await this.getArtistArt(artistName);
    if (result && result.spotifyId) {
      // キャッシュに保存
      const expiresAt = new Date(Date.now() + config.spotify.cacheExpiryDays * 24 * 60 * 60 * 1000);
      await this.dbService.insertSpotifyImageCache({
        searchKey,
        searchType: 'artist',
        spotifyId: result.spotifyId,
        imageUrl: result.url,
        imageWidth: result.width || 0,
        imageHeight: result.height || 0,
        spotifyUrl: result.spotifyUrl || '',
        matchScore: result.matchScore,
        quality: result.quality,
        createdAt: new Date(),
        updatedAt: new Date(),
        expiresAt
      });
      console.log('💾 Spotifyアーティスト画像をキャッシュに保存:', result.url);
    }

    return result;
  }

  /**
   * キャッシュからのみ画像を取得（API呼び出しなし）
   */
  async getCachedImage(searchKey: string, searchType: 'track' | 'artist'): Promise<ImageMatchResult | null> {
    if (!this.dbService) {
      return null;
    }

    const cached = await this.dbService.getSpotifyImageCache(searchKey, searchType);
    console.log(`📦 キャッシュからSpotify ${searchType}画像を取得:`, cached ? cached.imageUrl : 'なし');

    if (cached) {
      return {
        source: 'spotify',
        url: cached.imageUrl,
        width: cached.imageWidth,
        height: cached.imageHeight,
        quality: cached.quality,
        matchScore: cached.matchScore,
        spotifyId: cached.spotifyId,
        spotifyUrl: cached.spotifyUrl
      };
    }

    return null;
  }

  /**
   * 接続テスト
   */
  async testConnection(): Promise<boolean> {
    if (!this.isEnabled()) {
      console.log('🎵 Spotify統合が無効のため接続テストをスキップ');
      return false;
    }

    try {
      await this.getAccessToken();
      console.log('✅ Spotify接続テスト成功');
      return true;
    } catch (error) {
      console.error('❌ Spotify接続テスト失敗:', error);
      return false;
    }
  }

  /**
   * Spotify画像キャッシュ統計を取得
   */
  async getSpotifyImageCacheStats(): Promise<{
    totalCached: number;
    trackCached: number;
    artistCached: number;
    expiredCount: number;
  } | null> {
    if (!this.dbService) {
      return null;
    }

    return await this.dbService.getSpotifyImageCacheStats();
  }

  /**
   * Spotify画像キャッシュ統計をログ出力
   */
  async logSpotifyImageCacheStats(): Promise<void> {
    const stats = await this.getSpotifyImageCacheStats();
    if (stats) {
      console.log('📊 Spotify画像キャッシュ統計:');
      console.log(`   総キャッシュ数: ${stats.totalCached}件`);
      console.log(`   楽曲画像: ${stats.trackCached}件`);
      console.log(`   アーティスト画像: ${stats.artistCached}件`);
      console.log(`   期限切れ: ${stats.expiredCount}件`);
    }
  }

  /**
   * キャッシュから取得したトラックのプレースホルダー画像をSpotify APIで補完
   */
  async enhanceTracksWithSpotifyImages(tracks: any[]): Promise<any[]> {
    if (!tracks || tracks.length === 0) {
      return tracks;
    }

    // プレースホルダー画像を含むトラックを特定
    const tracksNeedingEnhancement = tracks.filter(track =>
      !track.imageUrl || ImageDetectionUtils.isPlaceholderImage(track.imageUrl)
    );

    if (tracksNeedingEnhancement.length === 0) {
      console.log('📦 プレースホルダー画像は見つかりませんでした');
      return tracks;
    }

    console.log(`🖼️ プレースホルダー画像を補完中: ${tracksNeedingEnhancement.length}/${tracks.length}件`);

    // 各トラックを処理
    const enhancedTracks = await Promise.all(
      tracks.map(async (track) => {
        // プレースホルダー画像でない場合はそのまま返す
        if (track.imageUrl && !ImageDetectionUtils.isPlaceholderImage(track.imageUrl)) {
          return track;
        }

        // Spotify統合が無効の場合はそのまま返す
        if (!this.isEnabled()) {
          return track;
        }

        try {
          // まずキャッシュから確認
          const trackSearchKey = `${track.artist}:::${track.track}`;
          const cachedTrackImage = await this.getCachedImage(trackSearchKey, 'track');

          if (cachedTrackImage) {
            console.log('📦 キャッシュから楽曲画像を取得:', track.track);
            return {
              ...track,
              imageUrl: cachedTrackImage.url,
              imageSource: cachedTrackImage.source,
              imageQuality: cachedTrackImage.quality,
              spotifyMatchScore: cachedTrackImage.matchScore,
              spotifyId: cachedTrackImage.spotifyId,
              spotifyUrl: cachedTrackImage.spotifyUrl
            };
          }

          // キャッシュにない場合はアーティスト画像を試す
          const artistSearchKey = track.artist;
          const cachedArtistImage = await this.getCachedImage(artistSearchKey, 'artist');

          if (cachedArtistImage) {
            console.log('📦 キャッシュからアーティスト画像を取得:', track.artist);
            return {
              ...track,
              imageUrl: cachedArtistImage.url,
              imageSource: cachedArtistImage.source,
              imageQuality: cachedArtistImage.quality,
              spotifyMatchScore: cachedArtistImage.matchScore,
              spotifyId: cachedArtistImage.spotifyId,
              spotifyUrl: cachedArtistImage.spotifyUrl
            };
          }

          // キャッシュにもない場合はSpotify APIを呼び出し
          console.log(`🎵 プレースホルダー画像、Spotify APIを呼び出し: ${track.track} - ${track.artist}`);
          const imageResult = await this.getAlbumArtWithCache(
            track.track,
            track.artist,
            track.album
          );

          if (imageResult) {
            return {
              ...track,
              imageUrl: imageResult.url,
              imageSource: imageResult.source,
              imageQuality: imageResult.quality,
              spotifyMatchScore: imageResult.matchScore,
              spotifyId: imageResult.spotifyId,
              spotifyUrl: imageResult.spotifyUrl
            };
          }

          return track;
        } catch (error) {
          console.error(`❌ ${track.track}の画像取得エラー:`, error);
          return track;
        }
      })
    );

    const enhancedCount = enhancedTracks.filter(track =>
      track.imageUrl && !ImageDetectionUtils.isPlaceholderImage(track.imageUrl)
    ).length;

    console.log(`✅ 画像補完完了: ${enhancedCount}/${tracks.length}件が改善されました`);
    return enhancedTracks;
  }
}
