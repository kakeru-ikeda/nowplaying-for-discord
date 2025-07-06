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
}

export interface NowPlayingInfo {
  artist: string;
  track: string;
  album?: string;
  imageUrl?: string;
  isPlaying: boolean;
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
  // グラフ画像データを追加
  charts?: {
    topTracks?: Buffer;
    topArtists?: Buffer;
    listeningTrends?: Buffer;
    statsCard?: Buffer;
    combined?: Buffer; // 結合画像
  };
}

// WebServerサービス用の型定義
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  timestamp: string;
}

export interface WebSocketMessage {
  type: 'now-playing' | 'report-updated' | 'connection-status' | 'ping' | 'pong';
  data?: any;
  timestamp: string;
}

export interface HealthCheckResponse {
  status: 'ok' | 'error';
  timestamp: string;
  service: string;
  connectedClients: number;
}

export interface RecentTrackInfo {
  artist: string;
  track: string;
  album?: string;
  imageUrl?: string;
  isPlaying: boolean;
  playedAt?: Date; // 再生日時（現在再生中の場合はundefined）
  url?: string;
}

export interface RecentTracksOptions {
  limit?: number; // 取得件数（デフォルト50、最大200）
  page?: number; // ページ番号（デフォルト1）
  from?: Date; // 開始日時
  to?: Date; // 終了日時
}
