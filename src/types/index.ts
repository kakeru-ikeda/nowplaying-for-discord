export interface LastFmTrack {
  name: string;
  artist: {
    '#text': string;
    mbid?: string;
  };
  album?: {
    '#text': string;
    mbid?: string;
  };
  image?: Array<{
    '#text': string;
    size: 'small' | 'medium' | 'large' | 'extralarge';
  }>;
  '@attr'?: {
    nowplaying?: string;
  };
  url?: string;
  date?: {
    uts: string;
    '#text': string;
  };
}

export interface LastFmRecentTracksResponse {
  recenttracks: {
    track: LastFmTrack[];
    '@attr': {
      user: string;
      totalPages: string;
      page: string;
      perPage: string;
      total: string;
    };
  };
}

export interface DiscordActivity {
  details?: string;
  state?: string;
  startTimestamp?: number;
  endTimestamp?: number;
  largeImageKey?: string;
  largeImageText?: string;
  smallImageKey?: string;
  smallImageText?: string;
  instance?: boolean;
  type?: number; // アクティビティタイプ（0: PLAYING, 1: STREAMING, 2: LISTENING, 3: WATCHING, 5: COMPETING）
}

export interface NowPlayingInfo {
  artist: string;
  track: string;
  album?: string;
  imageUrl?: string;
  isPlaying: boolean;
  // Spotify統合用の新規フィールド
  imageSource?: 'lastfm' | 'spotify';
  imageQuality?: 'low' | 'medium' | 'high';
  spotifyMatchScore?: number;
  spotifyId?: string;
  spotifyUrl?: string;
}

// Discord Bot関連の型定義
export interface LastFmTopTrack {
  name: string;
  playcount: string;
  artist: {
    name: string;
    mbid?: string;
    url?: string;
  };
  image?: Array<{
    '#text': string;
    size: 'small' | 'medium' | 'large' | 'extralarge';
  }>;
  url?: string;
}

export interface LastFmTopArtist {
  name: string;
  playcount: string;
  mbid?: string;
  url?: string;
  image?: Array<{
    '#text': string;
    size: 'small' | 'medium' | 'large' | 'extralarge';
  }>;
}

export interface LastFmTopAlbum {
  name: string;
  playcount: string;
  artist: {
    name: string;
    mbid?: string;
    url?: string;
  };
  image?: Array<{
    '#text': string;
    size: 'small' | 'medium' | 'large' | 'extralarge';
  }>;
  url?: string;
}

export interface LastFmTopTracksResponse {
  toptracks: {
    track: LastFmTopTrack[];
    '@attr': {
      user: string;
      totalPages: string;
      page: string;
      perPage: string;
      total: string;
    };
  };
}

export interface LastFmTopArtistsResponse {
  topartists: {
    artist: LastFmTopArtist[];
    '@attr': {
      user: string;
      totalPages: string;
      page: string;
      perPage: string;
      total: string;
    };
  };
}

export interface LastFmTopAlbumsResponse {
  topalbums: {
    album: LastFmTopAlbum[];
    '@attr': {
      user: string;
      totalPages: string;
      page: string;
      perPage: string;
      total: string;
    };
  };
}

// 聴取推移データの型定義
export interface ListeningTrendData {
  date: string;
  scrobbles: number;
  label: string;
}

export interface MusicReport {
  period: 'daily' | 'weekly' | 'monthly';
  topTracks: LastFmTopTrack[];
  topArtists: LastFmTopArtist[];
  topAlbums: LastFmTopAlbum[];
  totalScrobbles?: number;
  username: string;
  dateRange: {
    start: string;
    end: string;
  };
  // 聴取推移データを追加
  listeningTrends?: ListeningTrendData[];
  // レポートの詳細日付情報を追加
  reportDate?: {
    startDate: string;
    endDate: string;
    targetDate: string | null;
  };
}

// ユーザー統計情報の型定義
export interface UserStats {
  profile: {
    username: string;
    realName?: string;
    url: string;
    country?: string;
    registeredDate: string;
    totalPlayCount: number;
    profileImage?: string;
  };
  topArtist: {
    name: string;
    playCount: number;
    url: string;
    image?: string;
  } | null;
  topTrack: {
    name: string;
    artist: string;
    playCount: number;
    url: string;
    image?: string;
  } | null;
  generatedAt: string;
}

export interface RecentTrackInfo {
  artist: string;
  track: string;
  album?: string;
  imageUrl?: string;
  isPlaying: boolean;
  playedAt?: Date; // 再生日時（現在再生中の場合はundefined）
  url?: string;
  // Spotify統合用の新規フィールド
  imageSource?: 'lastfm' | 'spotify';
  imageQuality?: 'low' | 'medium' | 'high';
  spotifyMatchScore?: number;
  spotifyId?: string;
  spotifyUrl?: string;
}

export interface RecentTracksOptions {
  limit?: number; // 取得件数（デフォルト50、最大200）
  page?: number; // ページ番号（デフォルト1）
  from?: Date; // 開始日時
  to?: Date; // 終了日時
  disableSpotifyIntegration?: boolean; // Spotify統合を無効化（キャッシュ処理用）
}

// 週の各日の再生数統計
export interface DailyStatsItem {
  date: string;         // ISO形式の日付 (YYYY-MM-DD)
  scrobbles: number;    // その日の再生数
  dayOfWeek: number;    // 曜日 (0: 日曜日, 1: 月曜日, ... 6: 土曜日)
  label: string;        // 表示用ラベル (例: '7月10日(水)')
}

// 月の各週の再生数統計
export interface WeeklyStatsItem {
  startDate: string;    // 週の開始日 (YYYY-MM-DD)
  endDate: string;      // 週の終了日 (YYYY-MM-DD)
  scrobbles: number;    // その週の再生数
  weekNumber: number;   // 月内の週番号 (1から始まる)
  label: string;        // 表示用ラベル (例: '7/1-7/7')
}

// 年の各月の再生数統計
export interface MonthlyStatsItem {
  year: number;         // 年
  month: number;        // 月 (1-12)
  scrobbles: number;    // その月の再生数
  startDate: string;    // 月の開始日 (YYYY-MM-DD)
  endDate: string;      // 月の終了日 (YYYY-MM-DD)
  label: string;        // 表示用ラベル (例: '7月')
}
