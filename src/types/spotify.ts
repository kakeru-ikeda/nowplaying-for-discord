/**
 * Spotify API関連の型定義
 */

export interface SpotifyImage {
  url: string;
  width: number;
  height: number;
}

export interface SpotifyTrack {
  id: string;
  name: string;
  artists: Array<{
    id: string;
    name: string;
    external_urls: {
      spotify: string;
    };
  }>;
  album: {
    id: string;
    name: string;
    images: SpotifyImage[];
    release_date: string;
    total_tracks: number;
  };
  popularity: number;
  external_urls: {
    spotify: string;
  };
  preview_url?: string;
}

export interface SpotifyArtist {
  id: string;
  name: string;
  images: SpotifyImage[];
  popularity: number;
  followers: {
    total: number;
  };
  genres: string[];
  external_urls: {
    spotify: string;
  };
}

export interface SpotifyAlbum {
  id: string;
  name: string;
  artists: Array<{
    id: string;
    name: string;
    external_urls: {
      spotify: string;
    };
  }>;
  images: SpotifyImage[];
  release_date: string;
  total_tracks: number;
  album_type: string;
  external_urls: {
    spotify: string;
  };
}

export interface SpotifySearchResponse {
  tracks?: {
    items: SpotifyTrack[];
    total: number;
    limit: number;
    offset: number;
  };
  artists?: {
    items: SpotifyArtist[];
    total: number;
    limit: number;
    offset: number;
  };
  albums?: {
    items: SpotifyAlbum[];
    total: number;
    limit: number;
    offset: number;
  };
}

export interface SpotifyTokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
  scope?: string;
}

export interface SpotifyCurrentlyPlaying {
  is_playing: boolean;
  currently_playing_type: 'track' | 'episode' | 'ad' | 'unknown';
  item?: SpotifyTrack;
  context?: {
    type: string;
    href: string;
    external_urls: {
      spotify: string;
    };
  };
  timestamp: number;
  progress_ms?: number;
}

export interface SpotifyPlaybackState {
  device: {
    id: string;
    is_active: boolean;
    is_private_session: boolean;
    is_restricted: boolean;
    name: string;
    type: string;
    volume_percent: number;
  };
  repeat_state: 'off' | 'track' | 'context';
  shuffle_state: boolean;
  context?: {
    type: string;
    href: string;
    external_urls: {
      spotify: string;
    };
  };
  timestamp: number;
  progress_ms?: number;
  is_playing: boolean;
  item?: SpotifyTrack;
  currently_playing_type: 'track' | 'episode' | 'ad' | 'unknown';
  actions: {
    interrupting_playback?: boolean;
    pausing?: boolean;
    resuming?: boolean;
    seeking?: boolean;
    skipping_next?: boolean;
    skipping_prev?: boolean;
    toggling_repeat_context?: boolean;
    toggling_shuffle?: boolean;
    toggling_repeat_track?: boolean;
    transferring_playback?: boolean;
  };
}

export interface ImageMatchResult {
  source: 'lastfm' | 'spotify';
  url: string;
  width?: number;
  height?: number;
  matchScore: number;
  quality: 'low' | 'medium' | 'high';
  spotifyId?: string;
  spotifyUrl?: string;
}

export interface SpotifyApiError {
  error: {
    status: number;
    message: string;
  };
}
