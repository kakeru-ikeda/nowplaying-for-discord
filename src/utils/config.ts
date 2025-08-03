import dotenv from 'dotenv';

dotenv.config();

export const config = {
  lastfm: {
    apiKey: process.env.LASTFM_API_KEY!,
    username: process.env.LASTFM_USERNAME!,
  },
  discord: {
    clientId: process.env.DISCORD_CLIENT_ID!,
    userId: process.env.DISCORD_USER_ID!,
    botToken: process.env.DISCORD_BOT_TOKEN!,
    nowPlayingChannelId: process.env.DISCORD_NOW_PLAYING_CHANNEL_ID!,
  },
  spotify: {
    clientId: process.env.SPOTIFY_CLIENT_ID || '',
    clientSecret: process.env.SPOTIFY_CLIENT_SECRET || '',
    enabled: process.env.SPOTIFY_ENABLED === 'true',
    cacheExpiryDays: parseInt(process.env.SPOTIFY_CACHE_EXPIRY_DAYS || '7'),
    matchThreshold: parseFloat(process.env.SPOTIFY_MATCH_THRESHOLD || '0.3'),
    requestTimeout: parseInt(process.env.SPOTIFY_REQUEST_TIMEOUT || '10000'),
  },
  webServer: {
    port: parseInt(process.env.HTTP_PORT || '3001'),
    enableCors: process.env.WEB_SERVER_CORS !== 'false',
    https: {
      enabled: process.env.HTTPS_ENABLED === 'true',
      port: parseInt(process.env.HTTPS_PORT || '8443'),
      keyPath: process.env.HTTPS_KEY_PATH || './localhost+3-key.pem',
      certPath: process.env.HTTPS_CERT_PATH || './localhost+3.pem',
    },
  },
  cache: {
    dbPath: process.env.CACHE_DB_PATH || './data/cache.db',
    initialHistoryDays: parseInt(process.env.CACHE_INITIAL_HISTORY_DAYS || '30'),
    syncIntervalMinutes: parseInt(process.env.CACHE_SYNC_INTERVAL_MINUTES || '15'),
    maxTracks: parseInt(process.env.CACHE_MAX_TRACKS || '100000'),
    cleanupIntervalHours: parseInt(process.env.CACHE_CLEANUP_INTERVAL_HOURS || '24')
  },
  updateInterval: parseInt(process.env.UPDATE_INTERVAL || '15000'),
};

// 必須環境変数のチェック
const requiredEnvVars = [
  'LASTFM_API_KEY',
  'LASTFM_USERNAME',
  'DISCORD_CLIENT_ID',
  'DISCORD_USER_ID',
  'DISCORD_BOT_TOKEN',
  'DISCORD_NOW_PLAYING_CHANNEL_ID',
];

export function validateEnvironment(): void {
  const missing: string[] = [];

  for (const envVar of requiredEnvVars) {
    if (!process.env[envVar]) {
      missing.push(envVar);
    }
  }

  if (missing.length > 0) {
    console.error('❌ 以下の環境変数が設定されていません:');
    missing.forEach(var_ => console.error(`  - ${var_}`));
    console.error('\n.envファイルを作成し、必要な値を設定してください。');
    process.exit(1);
  }
}
