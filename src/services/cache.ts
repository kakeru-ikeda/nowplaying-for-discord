import { DatabaseService, CachedTrack } from './database';
import { LastFmService } from './lastfm';
import { RecentTrackInfo } from '../types';

export class CacheService {
  private dbService: DatabaseService;
  private lastFmService: LastFmService;
  private isInitialized = false;
  private syncInProgress = false;

  constructor(dbService: DatabaseService, lastFmService: LastFmService) {
    this.dbService = dbService;
    this.lastFmService = lastFmService;
  }

  async initialize(): Promise<void> {
    if (this.isInitialized) return;

    console.log('🔄 キャッシュサービスを初期化中...');
    
    await this.dbService.initialize();
    await this.initializeCache();
    
    this.isInitialized = true;
    console.log('✅ キャッシュサービスの初期化が完了しました');
  }

  private async initializeCache(): Promise<void> {
    const lastSync = await this.dbService.getLastSyncTime();
    
    if (!lastSync) {
      console.log('📥 初回起動：過去30日間のデータを取得中...');
      await this.performInitialSync();
    } else {
      console.log(`📊 最終同期時刻: ${lastSync.toLocaleString('ja-JP')}`);
      await this.syncRecentTracks();
    }
  }

  private async performInitialSync(): Promise<void> {
    if (this.syncInProgress) {
      console.log('⏳ 同期が既に進行中です');
      return;
    }

    this.syncInProgress = true;
    
    try {
      const syncId = await this.dbService.addSyncHistory({
        syncType: 'initial',
        startTime: new Date(),
        tracksAdded: 0,
        tracksUpdated: 0,
        status: 'running',
        apiCallsMade: 0,
        createdAt: new Date()
      });

      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      const now = new Date();
      
      console.log(`📅 期間: ${thirtyDaysAgo.toLocaleDateString('ja-JP')} - ${now.toLocaleDateString('ja-JP')}`);
      
      let currentDate = new Date(thirtyDaysAgo);
      let totalTracks = 0;
      let apiCalls = 0;
      
      while (currentDate <= now) {
        const nextDate = new Date(currentDate);
        nextDate.setDate(nextDate.getDate() + 1);
        nextDate.setHours(0, 0, 0, 0);
        
        const endDate = nextDate > now ? now : nextDate;
        
        try {
          const tracks = await this.lastFmService.getAllRecentTracks(currentDate, endDate, -1);
          apiCalls++;
          
          if (tracks.length > 0) {
            const cachedTracks = tracks.map(track => this.convertToCachedTrack(track));
            const inserted = await this.dbService.insertTracks(cachedTracks);
            totalTracks += inserted;
            
            console.log(`📊 ${currentDate.toLocaleDateString('ja-JP')}: ${inserted}件追加 (累計: ${totalTracks}件)`);
          }
          
          // API制限対策
          await this.sleep(250);
          
        } catch (error) {
          console.error(`❌ ${currentDate.toLocaleDateString('ja-JP')} のデータ取得エラー:`, error);
        }
        
        currentDate = nextDate;
      }
      
      await this.dbService.updateLastSyncTime(now);
      await this.dbService.updateSyncHistory(syncId, {
        endTime: new Date(),
        tracksAdded: totalTracks,
        status: 'success',
        apiCallsMade: apiCalls
      });
      
      console.log(`✅ 初期同期完了: ${totalTracks}件のトラックを保存しました`);
      
    } catch (error) {
      console.error('❌ 初期同期エラー:', error);
      throw error;
    } finally {
      this.syncInProgress = false;
    }
  }

  async syncRecentTracks(): Promise<void> {
    if (this.syncInProgress) {
      console.log('⏳ 同期が既に進行中です');
      return;
    }

    this.syncInProgress = true;
    
    try {
      const lastSync = await this.dbService.getLastSyncTime();
      const now = new Date();
      
      if (!lastSync) {
        await this.performInitialSync();
        return;
      }
      
      const syncId = await this.dbService.addSyncHistory({
        syncType: 'incremental',
        startTime: new Date(),
        tracksAdded: 0,
        tracksUpdated: 0,
        status: 'running',
        apiCallsMade: 0,
        createdAt: new Date()
      });
      
      console.log('🔄 差分同期を実行中...');
      
      const newTracks = await this.lastFmService.getAllRecentTracks(lastSync, now, -1);
      const cachedTracks = newTracks.map(track => this.convertToCachedTrack(track));
      
      const inserted = await this.dbService.insertTracks(cachedTracks);
      await this.dbService.updateLastSyncTime(now);
      
      await this.dbService.updateSyncHistory(syncId, {
        endTime: new Date(),
        tracksAdded: inserted,
        status: 'success',
        apiCallsMade: 1
      });
      
      console.log(`✅ 差分同期完了: ${inserted}件の新しいトラックを追加しました`);
      
    } catch (error) {
      console.error('❌ 差分同期エラー:', error);
    } finally {
      this.syncInProgress = false;
    }
  }

  async getTracksFromCache(
    from: Date, 
    to: Date, 
    limit: number = 50, 
    page: number = 1
  ): Promise<{ tracks: RecentTrackInfo[], total: number }> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    try {
      // データ範囲の確認
      const dataRange = await this.dbService.getDataRange();
      
      // 不足データの検出と補完
      await this.ensureDataCompleteness(from, to, dataRange);
      
      // キャッシュからデータを取得
      const offset = (page - 1) * limit;
      const cachedTracks = await this.dbService.getTracksByDateRange(from, to, limit, offset);
      const total = await this.dbService.getTrackCount(from, to);
      
      const tracks = cachedTracks.map(track => this.convertToRecentTrackInfo(track));
      
      console.log(`📊 キャッシュから取得: ${tracks.length}件 (総数: ${total}件)`);
      
      return { tracks, total };
      
    } catch (error) {
      console.error('❌ キャッシュ取得エラー、Last.fm APIにフォールバック:', error);
      
      // フォールバック: 直接API呼び出し
      const tracks = await this.lastFmService.getRecentTracks({
        from,
        to,
        limit,
        page
      });
      
      return { tracks, total: tracks.length };
    }
  }

  async getTracksForStats(from: Date, to: Date): Promise<RecentTrackInfo[]> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    try {
      // データ範囲の確認
      const dataRange = await this.dbService.getDataRange();
      
      // 不足データの検出と補完
      await this.ensureDataCompleteness(from, to, dataRange);
      
      // キャッシュからデータを取得
      const cachedTracks = await this.dbService.getTracksForStats(from, to);
      const tracks = cachedTracks.map(track => this.convertToRecentTrackInfo(track));
      
      console.log(`📊 統計用キャッシュから取得: ${tracks.length}件`);
      
      return tracks;
      
    } catch (error) {
      console.error('❌ 統計用キャッシュ取得エラー、Last.fm APIにフォールバック:', error);
      
      // フォールバック: 直接API呼び出し
      return await this.lastFmService.getAllRecentTracks(from, to, -1);
    }
  }

  private async ensureDataCompleteness(
    from: Date, 
    to: Date, 
    dataRange: { earliest: Date | null, latest: Date | null }
  ): Promise<void> {
    const missingRanges: { from: Date, to: Date }[] = [];
    
    // 開始日より前のデータが不足している場合
    if (!dataRange.earliest || from < dataRange.earliest) {
      missingRanges.push({
        from: from,
        to: dataRange.earliest ? new Date(dataRange.earliest.getTime() - 1) : to
      });
    }
    
    // 終了日より後のデータが不足している場合
    if (!dataRange.latest || to > dataRange.latest) {
      missingRanges.push({
        from: dataRange.latest ? new Date(dataRange.latest.getTime() + 1) : from,
        to: to
      });
    }
    
    // 不足データを取得
    for (const range of missingRanges) {
      try {
        // 範囲が小さい場合のみ取得（1週間以内）
        const rangeDays = Math.ceil((range.to.getTime() - range.from.getTime()) / (24 * 60 * 60 * 1000));
        if (rangeDays > 7) {
          console.log(`⚠️ 不足データの範囲が大きすぎるため、差分同期をスキップします: ${rangeDays}日間`);
          continue;
        }
        
        console.log(`🔄 不足データを取得中: ${range.from.toLocaleDateString('ja-JP')} - ${range.to.toLocaleDateString('ja-JP')}`);
        
        const tracks = await this.lastFmService.getAllRecentTracks(range.from, range.to, -1);
        const cachedTracks = tracks.map(track => this.convertToCachedTrack(track));
        
        const inserted = await this.dbService.insertTracks(cachedTracks);
        console.log(`✅ 不足データ取得完了: ${inserted}件`);
        
      } catch (error) {
        console.error('❌ 不足データ取得エラー:', error);
      }
    }
  }

  private convertToCachedTrack(track: RecentTrackInfo): CachedTrack {
    const playedAt = track.playedAt || new Date();
    return {
      artist: track.artist,
      trackName: track.track,
      album: track.album,
      imageUrl: track.imageUrl,
      trackUrl: track.url,
      playedAt: playedAt,
      isPlaying: track.isPlaying,
      scrobbleDate: playedAt.toISOString().split('T')[0],
      createdAt: new Date(),
      updatedAt: new Date()
    };
  }

  private convertToRecentTrackInfo(track: CachedTrack): RecentTrackInfo {
    return {
      artist: track.artist,
      track: track.trackName,
      album: track.album,
      imageUrl: track.imageUrl,
      url: track.trackUrl,
      playedAt: track.playedAt,
      isPlaying: track.isPlaying
    };
  }

  async getCacheStats(): Promise<{
    totalTracks: number;
    uniqueArtists: number;
    uniqueAlbums: number;
    dateRange: { earliest: Date | null; latest: Date | null };
    lastSync: Date | null;
  }> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    const stats = await this.dbService.getTrackStats();
    const lastSync = await this.dbService.getLastSyncTime();

    return {
      ...stats,
      lastSync
    };
  }

  async cleanupOldData(daysToKeep: number = 90): Promise<number> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    console.log(`🧹 ${daysToKeep}日より古いデータをクリーンアップ中...`);
    const deleted = await this.dbService.cleanupOldData(daysToKeep);
    console.log(`✅ ${deleted}件の古いデータを削除しました`);
    
    return deleted;
  }

  async vacuum(): Promise<void> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    console.log('🗜️ データベースをバキューム中...');
    await this.dbService.vacuum();
    console.log('✅ データベースのバキュームが完了しました');
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  async close(): Promise<void> {
    await this.dbService.close();
    this.isInitialized = false;
  }
}
