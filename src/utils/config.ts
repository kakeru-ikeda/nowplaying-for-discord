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
    reportChannelId: process.env.DISCORD_REPORT_CHANNEL_ID!,
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
  'DISCORD_REPORT_CHANNEL_ID',
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
