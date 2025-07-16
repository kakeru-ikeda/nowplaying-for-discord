import sqlite3 from 'sqlite3';
import { Database } from 'sqlite3';
import path from 'path';
import fs from 'fs';

export interface CachedTrack {
  id?: number;
  artist: string;
  trackName: string;
  album?: string;
  imageUrl?: string;
  trackUrl?: string;
  playedAt: Date;
  isPlaying: boolean;
  scrobbleDate: string; // YYYY-MM-DD
  createdAt: Date;
  updatedAt: Date;
}

export interface CacheMetadata {
  id?: number;
  keyName: string;
  lastSyncTimestamp: Date;
  earliestDataTimestamp?: Date;
  latestDataTimestamp?: Date;
  totalTracks: number;
  syncStatus: 'pending' | 'syncing' | 'complete' | 'error';
  createdAt: Date;
  updatedAt: Date;
}

export interface SyncHistoryRecord {
  id?: number;
  syncType: 'initial' | 'incremental' | 'full';
  startTime: Date;
  endTime?: Date;
  tracksAdded: number;
  tracksUpdated: number;
  status: 'running' | 'success' | 'failed';
  errorMessage?: string;
  apiCallsMade: number;
  createdAt: Date;
}

export interface SpotifyImageCache {
  id?: number;
  searchKey: string;  // "artist:::track" or "artist" の形式
  searchType: 'track' | 'artist';
  spotifyId: string;
  imageUrl: string;
  imageWidth: number;
  imageHeight: number;
  spotifyUrl: string;
  matchScore: number;
  quality: 'low' | 'medium' | 'high';
  createdAt: Date;
  updatedAt: Date;
  expiresAt: Date;
}

export class DatabaseService {
  private db!: Database;
  private readonly dbPath: string;
  private isInitialized = false;

  constructor(dbPath: string = './data/cache.db') {
    this.dbPath = path.resolve(dbPath);
    
    // データディレクトリの確認・作成
    const dataDir = path.dirname(this.dbPath);
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }
  }

  async initialize(): Promise<void> {
    if (this.isInitialized) return;

    return new Promise((resolve, reject) => {
      this.db = new sqlite3.Database(this.dbPath, (err) => {
        if (err) {
          console.error('❌ データベース接続エラー:', err);
          reject(err);
        } else {
          console.log('✅ データベースに接続しました:', this.dbPath);
          this.createTables().then(() => {
            this.isInitialized = true;
            resolve();
          }).catch(reject);
        }
      });
    });
  }

  private async createTables(): Promise<void> {
    const createTracksTable = `
      CREATE TABLE IF NOT EXISTS tracks (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        artist TEXT NOT NULL,
        track_name TEXT NOT NULL,
        album TEXT,
        image_url TEXT,
        track_url TEXT,
        played_at INTEGER NOT NULL,
        is_playing BOOLEAN DEFAULT 0,
        scrobble_date TEXT NOT NULL,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL,
        UNIQUE(artist, track_name, played_at)
      )
    `;

    const createMetadataTable = `
      CREATE TABLE IF NOT EXISTS cache_metadata (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        key_name TEXT UNIQUE NOT NULL,
        last_sync_timestamp INTEGER NOT NULL,
        earliest_data_timestamp INTEGER,
        latest_data_timestamp INTEGER,
        total_tracks INTEGER DEFAULT 0,
        sync_status TEXT DEFAULT 'pending',
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      )
    `;

    const createSyncHistoryTable = `
      CREATE TABLE IF NOT EXISTS sync_history (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        sync_type TEXT NOT NULL,
        start_time INTEGER NOT NULL,
        end_time INTEGER,
        tracks_added INTEGER DEFAULT 0,
        tracks_updated INTEGER DEFAULT 0,
        status TEXT DEFAULT 'running',
        error_message TEXT,
        api_calls_made INTEGER DEFAULT 0,
        created_at INTEGER NOT NULL
      )
    `;

    const createSpotifyImageCacheTable = `
      CREATE TABLE IF NOT EXISTS spotify_image_cache (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        search_key TEXT NOT NULL,
        search_type TEXT NOT NULL,
        spotify_id TEXT NOT NULL,
        image_url TEXT NOT NULL,
        image_width INTEGER NOT NULL,
        image_height INTEGER NOT NULL,
        spotify_url TEXT NOT NULL,
        match_score REAL NOT NULL,
        quality TEXT NOT NULL,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL,
        expires_at INTEGER NOT NULL,
        UNIQUE(search_key, search_type, spotify_id)
      )
    `;

    await this.runQuery(createTracksTable);
    await this.runQuery(createMetadataTable);
    await this.runQuery(createSyncHistoryTable);
    await this.runQuery(createSpotifyImageCacheTable);
    await this.createIndexes();
  }

  private async createIndexes(): Promise<void> {
    const indexes = [
      'CREATE INDEX IF NOT EXISTS idx_tracks_played_at ON tracks(played_at)',
      'CREATE INDEX IF NOT EXISTS idx_tracks_scrobble_date ON tracks(scrobble_date)',
      'CREATE INDEX IF NOT EXISTS idx_tracks_artist ON tracks(artist)',
      'CREATE INDEX IF NOT EXISTS idx_tracks_artist_track ON tracks(artist, track_name)',
      'CREATE INDEX IF NOT EXISTS idx_tracks_date_artist ON tracks(scrobble_date, artist)',
      'CREATE INDEX IF NOT EXISTS idx_tracks_date_played_at ON tracks(scrobble_date, played_at)',
      'CREATE INDEX IF NOT EXISTS idx_tracks_album ON tracks(album)',
      'CREATE INDEX IF NOT EXISTS idx_tracks_date_range ON tracks(scrobble_date, played_at)',
      'CREATE INDEX IF NOT EXISTS idx_spotify_cache_search_key ON spotify_image_cache(search_key)',
      'CREATE INDEX IF NOT EXISTS idx_spotify_cache_search_type ON spotify_image_cache(search_type)',
      'CREATE INDEX IF NOT EXISTS idx_spotify_cache_expires_at ON spotify_image_cache(expires_at)',
      'CREATE INDEX IF NOT EXISTS idx_spotify_cache_key_type ON spotify_image_cache(search_key, search_type)'
    ];

    for (const index of indexes) {
      await this.runQuery(index);
    }
  }

  async insertTrack(track: CachedTrack): Promise<number> {
    const query = `
      INSERT OR REPLACE INTO tracks (
        artist, track_name, album, image_url, track_url, 
        played_at, is_playing, scrobble_date, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    const now = Date.now();
    const params = [
      track.artist,
      track.trackName,
      track.album || null,
      track.imageUrl || null,
      track.trackUrl || null,
      Math.floor(track.playedAt.getTime() / 1000),
      track.isPlaying ? 1 : 0,
      track.scrobbleDate,
      now,
      now
    ];

    return new Promise((resolve, reject) => {
      this.db.run(query, params, function(err) {
        if (err) {
          reject(err);
        } else {
          resolve(this.lastID);
        }
      });
    });
  }

  async insertTracks(tracks: CachedTrack[]): Promise<number> {
    return new Promise((resolve, reject) => {
      this.db.serialize(() => {
        this.db.run('BEGIN TRANSACTION');
        
        const query = `
          INSERT OR REPLACE INTO tracks (
            artist, track_name, album, image_url, track_url, 
            played_at, is_playing, scrobble_date, created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `;

        const stmt = this.db.prepare(query);
        const now = Date.now();
        let inserted = 0;

        for (const track of tracks) {
          const params = [
            track.artist,
            track.trackName,
            track.album || null,
            track.imageUrl || null,
            track.trackUrl || null,
            Math.floor(track.playedAt.getTime() / 1000),
            track.isPlaying ? 1 : 0,
            track.scrobbleDate,
            now,
            now
          ];

          stmt.run(params, function(err) {
            if (err) {
              console.warn('⚠️ トラック挿入エラー (スキップ):', err.message);
            } else {
              inserted++;
            }
          });
        }

        stmt.finalize(() => {
          this.db.run('COMMIT', (err) => {
            if (err) {
              reject(err);
            } else {
              resolve(inserted);
            }
          });
        });
      });
    });
  }

  async getTracksByDateRange(
    from: Date, 
    to: Date, 
    limit: number = 50, 
    offset: number = 0
  ): Promise<CachedTrack[]> {
    const query = `
      SELECT * FROM tracks 
      WHERE played_at BETWEEN ? AND ? AND is_playing = 0
      ORDER BY played_at DESC
      LIMIT ? OFFSET ?
    `;

    const params = [
      Math.floor(from.getTime() / 1000),
      Math.floor(to.getTime() / 1000),
      limit,
      offset
    ];

    return new Promise((resolve, reject) => {
      this.db.all(query, params, (err, rows: any[]) => {
        if (err) {
          reject(err);
        } else {
          const tracks = rows.map(row => ({
            id: row.id,
            artist: row.artist,
            trackName: row.track_name,
            album: row.album,
            imageUrl: row.image_url,
            trackUrl: row.track_url,
            playedAt: new Date(row.played_at * 1000),
            isPlaying: row.is_playing === 1,
            scrobbleDate: row.scrobble_date,
            createdAt: new Date(row.created_at),
            updatedAt: new Date(row.updated_at)
          }));
          resolve(tracks);
        }
      });
    });
  }

  async getTrackCount(from: Date, to: Date): Promise<number> {
    const query = `
      SELECT COUNT(*) as count FROM tracks 
      WHERE played_at BETWEEN ? AND ? AND is_playing = 0
    `;

    const params = [
      Math.floor(from.getTime() / 1000),
      Math.floor(to.getTime() / 1000)
    ];

    return new Promise((resolve, reject) => {
      this.db.get(query, params, (err, row: any) => {
        if (err) {
          reject(err);
        } else {
          resolve(row.count || 0);
        }
      });
    });
  }

  async getTracksForStats(from: Date, to: Date): Promise<CachedTrack[]> {
    const query = `
      SELECT * FROM tracks 
      WHERE played_at BETWEEN ? AND ? AND is_playing = 0
      ORDER BY played_at DESC
    `;

    const params = [
      Math.floor(from.getTime() / 1000),
      Math.floor(to.getTime() / 1000)
    ];

    return new Promise((resolve, reject) => {
      this.db.all(query, params, (err, rows: any[]) => {
        if (err) {
          reject(err);
        } else {
          const tracks = rows.map(row => ({
            id: row.id,
            artist: row.artist,
            trackName: row.track_name,
            album: row.album,
            imageUrl: row.image_url,
            trackUrl: row.track_url,
            playedAt: new Date(row.played_at * 1000),
            isPlaying: row.is_playing === 1,
            scrobbleDate: row.scrobble_date,
            createdAt: new Date(row.created_at),
            updatedAt: new Date(row.updated_at)
          }));
          resolve(tracks);
        }
      });
    });
  }

  async getLastSyncTime(): Promise<Date | null> {
    const query = `
      SELECT last_sync_timestamp FROM cache_metadata 
      WHERE key_name = 'last_sync' 
      ORDER BY updated_at DESC 
      LIMIT 1
    `;

    return new Promise((resolve, reject) => {
      this.db.get(query, [], (err, row: any) => {
        if (err) {
          reject(err);
        } else {
          resolve(row ? new Date(row.last_sync_timestamp * 1000) : null);
        }
      });
    });
  }

  async updateLastSyncTime(timestamp: Date): Promise<void> {
    const query = `
      INSERT OR REPLACE INTO cache_metadata (
        key_name, last_sync_timestamp, created_at, updated_at
      ) VALUES (?, ?, ?, ?)
    `;

    const now = Date.now();
    const params = [
      'last_sync',
      Math.floor(timestamp.getTime() / 1000),
      now,
      now
    ];

    await this.runQuery(query, params);
  }

  async getDataRange(): Promise<{ earliest: Date | null, latest: Date | null }> {
    const query = `
      SELECT 
        MIN(played_at) as earliest,
        MAX(played_at) as latest
      FROM tracks 
      WHERE is_playing = 0
    `;

    return new Promise((resolve, reject) => {
      this.db.get(query, [], (err, row: any) => {
        if (err) {
          reject(err);
        } else {
          resolve({
            earliest: row.earliest ? new Date(row.earliest * 1000) : null,
            latest: row.latest ? new Date(row.latest * 1000) : null
          });
        }
      });
    });
  }

  async getTrackStats(): Promise<{
    totalTracks: number;
    uniqueArtists: number;
    uniqueAlbums: number;
    dateRange: { earliest: Date | null; latest: Date | null };
  }> {
    const statsQuery = `
      SELECT 
        COUNT(*) as totalTracks,
        COUNT(DISTINCT artist) as uniqueArtists,
        COUNT(DISTINCT album) as uniqueAlbums,
        MIN(played_at) as earliest,
        MAX(played_at) as latest
      FROM tracks 
      WHERE is_playing = 0
    `;

    return new Promise((resolve, reject) => {
      this.db.get(statsQuery, [], (err, row: any) => {
        if (err) {
          reject(err);
        } else {
          resolve({
            totalTracks: row.totalTracks || 0,
            uniqueArtists: row.uniqueArtists || 0,
            uniqueAlbums: row.uniqueAlbums || 0,
            dateRange: {
              earliest: row.earliest ? new Date(row.earliest * 1000) : null,
              latest: row.latest ? new Date(row.latest * 1000) : null
            }
          });
        }
      });
    });
  }

  async addSyncHistory(record: SyncHistoryRecord): Promise<number> {
    const query = `
      INSERT INTO sync_history (
        sync_type, start_time, end_time, tracks_added, tracks_updated,
        status, error_message, api_calls_made, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    const params = [
      record.syncType,
      Math.floor(record.startTime.getTime() / 1000),
      record.endTime ? Math.floor(record.endTime.getTime() / 1000) : null,
      record.tracksAdded,
      record.tracksUpdated,
      record.status,
      record.errorMessage || null,
      record.apiCallsMade,
      Date.now()
    ];

    return new Promise((resolve, reject) => {
      this.db.run(query, params, function(err) {
        if (err) {
          reject(err);
        } else {
          resolve(this.lastID);
        }
      });
    });
  }

  async updateSyncHistory(id: number, updates: Partial<SyncHistoryRecord>): Promise<void> {
    const fields = [];
    const params = [];

    if (updates.endTime) {
      fields.push('end_time = ?');
      params.push(Math.floor(updates.endTime.getTime() / 1000));
    }
    if (updates.tracksAdded !== undefined) {
      fields.push('tracks_added = ?');
      params.push(updates.tracksAdded);
    }
    if (updates.tracksUpdated !== undefined) {
      fields.push('tracks_updated = ?');
      params.push(updates.tracksUpdated);
    }
    if (updates.status) {
      fields.push('status = ?');
      params.push(updates.status);
    }
    if (updates.errorMessage) {
      fields.push('error_message = ?');
      params.push(updates.errorMessage);
    }
    if (updates.apiCallsMade !== undefined) {
      fields.push('api_calls_made = ?');
      params.push(updates.apiCallsMade);
    }

    if (fields.length === 0) return;

    const query = `UPDATE sync_history SET ${fields.join(', ')} WHERE id = ?`;
    params.push(id);

    await this.runQuery(query, params);
  }

  async cleanupOldData(daysToKeep: number = 90): Promise<number> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);

    const query = `
      DELETE FROM tracks 
      WHERE played_at < ? AND is_playing = 0
    `;

    const params = [Math.floor(cutoffDate.getTime() / 1000)];

    return new Promise((resolve, reject) => {
      this.db.run(query, params, function(err) {
        if (err) {
          reject(err);
        } else {
          resolve(this.changes);
        }
      });
    });
  }

  async vacuum(): Promise<void> {
    await this.runQuery('VACUUM');
  }

  private async runQuery(query: string, params: any[] = []): Promise<{ lastID?: number; changes?: number }> {
    return new Promise((resolve, reject) => {
      this.db.run(query, params, function(err) {
        if (err) {
          reject(err);
        } else {
          resolve({ lastID: this.lastID, changes: this.changes });
        }
      });
    });
  }

  private async getQuery(query: string, params: any[] = []): Promise<any> {
    return new Promise((resolve, reject) => {
      this.db.get(query, params, (err, row) => {
        if (err) {
          reject(err);
        } else {
          resolve(row);
        }
      });
    });
  }

  private async getAllQuery(query: string, params: any[] = []): Promise<any[]> {
    return new Promise((resolve, reject) => {
      this.db.all(query, params, (err, rows) => {
        if (err) {
          reject(err);
        } else {
          resolve(rows || []);
        }
      });
    });
  }

  async close(): Promise<void> {
    if (!this.db) return;

    return new Promise((resolve) => {
      this.db.close((err) => {
        if (err) {
          console.error('❌ データベース切断エラー:', err);
        } else {
          console.log('✅ データベース接続を終了しました');
        }
        resolve();
      });
    });
  }

  // Spotify画像キャッシュ関連メソッド
  async getSpotifyImageCache(searchKey: string, searchType: 'track' | 'artist'): Promise<SpotifyImageCache | null> {
    const query = `
      SELECT * FROM spotify_image_cache 
      WHERE search_key = ? AND search_type = ? AND expires_at > ?
      ORDER BY match_score DESC, created_at DESC
      LIMIT 1
    `;
    
    const now = Math.floor(Date.now() / 1000);
    const row = await this.getQuery(query, [searchKey, searchType, now]);
    
    if (!row) return null;
    
    return {
      id: row.id,
      searchKey: row.search_key,
      searchType: row.search_type as 'track' | 'artist',
      spotifyId: row.spotify_id,
      imageUrl: row.image_url,
      imageWidth: row.image_width,
      imageHeight: row.image_height,
      spotifyUrl: row.spotify_url,
      matchScore: row.match_score,
      quality: row.quality as 'low' | 'medium' | 'high',
      createdAt: new Date(row.created_at * 1000),
      updatedAt: new Date(row.updated_at * 1000),
      expiresAt: new Date(row.expires_at * 1000)
    };
  }

  async insertSpotifyImageCache(cache: SpotifyImageCache): Promise<number> {
    const query = `
      INSERT OR REPLACE INTO spotify_image_cache (
        search_key, search_type, spotify_id, image_url, image_width, 
        image_height, spotify_url, match_score, quality, created_at, 
        updated_at, expires_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;
    
    const now = Math.floor(Date.now() / 1000);
    const expiresAt = Math.floor(cache.expiresAt.getTime() / 1000);
    
    const result = await this.runQuery(query, [
      cache.searchKey,
      cache.searchType,
      cache.spotifyId,
      cache.imageUrl,
      cache.imageWidth,
      cache.imageHeight,
      cache.spotifyUrl,
      cache.matchScore,
      cache.quality,
      now,
      now,
      expiresAt
    ]);
    
    return result.lastID || 0;
  }

  async cleanupExpiredSpotifyImageCache(): Promise<number> {
    const query = `DELETE FROM spotify_image_cache WHERE expires_at < ?`;
    const now = Math.floor(Date.now() / 1000);
    
    const result = await this.runQuery(query, [now]);
    const deletedCount = result.changes || 0;
    
    if (deletedCount > 0) {
      console.log(`🧹 期限切れのSpotify画像キャッシュを${deletedCount}件削除しました`);
    }
    
    return deletedCount;
  }

  async getSpotifyImageCacheStats(): Promise<{
    totalCached: number;
    trackCached: number;
    artistCached: number;
    expiredCount: number;
  }> {
    const now = Math.floor(Date.now() / 1000);
    
    const [totalResult, trackResult, artistResult, expiredResult] = await Promise.all([
      this.getQuery('SELECT COUNT(*) as count FROM spotify_image_cache WHERE expires_at > ?', [now]),
      this.getQuery('SELECT COUNT(*) as count FROM spotify_image_cache WHERE search_type = ? AND expires_at > ?', ['track', now]),
      this.getQuery('SELECT COUNT(*) as count FROM spotify_image_cache WHERE search_type = ? AND expires_at > ?', ['artist', now]),
      this.getQuery('SELECT COUNT(*) as count FROM spotify_image_cache WHERE expires_at <= ?', [now])
    ]);
    
    return {
      totalCached: totalResult?.count || 0,
      trackCached: trackResult?.count || 0,
      artistCached: artistResult?.count || 0,
      expiredCount: expiredResult?.count || 0
    };
  }
}
