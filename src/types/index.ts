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
}
