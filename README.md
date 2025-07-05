# Discord Last.fm Now Playing

Last.fm APIを使用してDiscordのリッチプレゼンスに現在再生中の楽曲を表示し、Discord Botでチャンネル通知と統計レポートを送信するTypeScriptアプリケーションです。

## 🎵 機能

- ✅ **リアルタイム楽曲情報取得**: Last.fm APIから現在再生中の楽曲情報を取得
- ✅ **Discord Rich Presence更新**: 楽曲情報をDiscordのリッチプレゼンスとして表示
- ✅ **Discord Bot通知**: 楽曲が変わった時にチャンネルへ通知
- ✅ **自動レポート生成**: 日次/週次/月次の音楽統計レポートを自動送信
- ✅ **視覚的レポート**: 4種類のグラフを1枚の白背景画像に統合
- ✅ **Webサーバー & WebSocket**: フロントエンド向けのAPI・リアルタイム配信機能
- ✅ **自動更新システム**: 設定した間隔で自動的に情報を更新
- ✅ **型安全性**: TypeScriptによる完全な型サポート
- ✅ **エラーハンドリング**: 堅牢なエラー処理とロギング
- ✅ **環境変数管理**: 安全な設定管理

## 📋 必要な準備

### 1. Last.fm API キーの取得

1. [Last.fm API](https://www.last.fm/api/account/create)にアクセス
2. アカウントを作成（既存アカウントでログイン）
3. API申請フォーム入力：
   - **Application name**: 任意（例：Discord Music Status）
   - **Application description**: 任意の説明
   - **Callback URL**: `http://localhost:3000/callback`（ダミーでOK）
   - **Application homepage**: 任意
4. API Keyをメモ

### 2. Discord Developer Portal での設定

1. [Discord Developer Portal](https://discord.com/developers/applications)にアクセス
2. "New Application"をクリック
3. アプリケーション名を入力（例：「Music Status」）
4. Application IDをメモ

### 3. Discord User IDの取得

1. Discordで開発者モードを有効化
2. 自分のプロフィールを右クリック
3. "IDをコピー"をクリック

### 4. Discord Bot の作成と設定

1. [Discord Developer Portal](https://discord.com/developers/applications)で前に作成したアプリケーションを選択
2. 左メニューから「Bot」を選択
3. 「Reset Token」をクリックしてBotトークンを生成・コピー
4. 「Privileged Gateway Intents」で必要に応じて権限を設定（基本は不要）

### 5. Discord Bot をサーバーに招待

1. 左メニューから「OAuth2」→「URL Generator」を選択
2. 「SCOPES」で「bot」を選択
3. 「BOT PERMISSIONS」で以下を選択：
   - Send Messages
   - Embed Links
   - Attach Files
   - Read Message History
4. 生成されたURLからBotをサーバーに招待

### 6. Discord チャンネルIDの取得

1. Discordで開発者モードを有効化
2. 通知用チャンネルを右クリック→「IDをコピー」
3. レポート用チャンネルを右クリック→「IDをコピー」

## 🚀 セットアップ

### 1. 依存関係のインストール

```bash
npm install
```

### 2. 環境変数の設定

`.env.example`をコピーして`.env`ファイルを作成：

```bash
cp .env.example .env
```

`.env`ファイルを編集し、取得した情報を設定：

```env
LASTFM_API_KEY=your_lastfm_api_key_here
LASTFM_USERNAME=your_lastfm_username_here
DISCORD_CLIENT_ID=your_discord_application_id_here
DISCORD_USER_ID=your_discord_user_id_here
DISCORD_BOT_TOKEN=your_discord_bot_token_here
DISCORD_NOW_PLAYING_CHANNEL_ID=your_nowplaying_channel_id_here
DISCORD_REPORT_CHANNEL_ID=your_report_channel_id_here
UPDATE_INTERVAL=15000
```

### 3. ビルド

```bash
npm run build
```

## 💻 使用方法

### 開発モード（TypeScript直接実行）
```bash
npm run dev
```

### 本番モード（ビルド後実行）
```bash
npm start
```

### 開発時の監視モード
```bash
npm run watch
```

## 📁 プロジェクト構成

```
discord-lastfm-nowplaying/
├── src/
│   ├── index.ts              # メインアプリケーション
│   ├── types/
│   │   └── index.ts          # 型定義
│   ├── services/
│   │   ├── lastfm.ts         # Last.fm API クライアント
│   │   ├── discord-rpc.ts    # Discord Rich Presence クライアント
│   │   ├── discord-bot.ts    # Discord Bot クライアント
│   │   ├── scheduler.ts      # レポートスケジューラー
│   │   └── chart.ts          # グラフ生成サービス
│   └── utils/
│       └── config.ts         # 設定管理
├── dist/                     # ビルド出力
├── .env.example              # 環境変数テンプレート
├── .env                      # 環境変数（gitignore対象）
├── package.json
├── tsconfig.json
└── README.md
```

## ⚙️ 設定

### 更新間隔
`UPDATE_INTERVAL`環境変数で更新間隔をミリ秒で設定できます（デフォルト: 15秒）

### API制限への対応
- Last.fm API: 15秒間隔でポーリング（1分間に4リクエスト）
- 同一楽曲の重複更新・通知防止
- タイムアウト設定（10秒）

### Discord Bot 機能
- **ナウプレイング通知**: 楽曲が変わった時に指定チャンネルに通知
- **自動レポート**: 
  - 日次レポート: 毎日0時
  - 週次レポート: 毎週日曜日0時  
  - 月次レポート: 毎月1日0時

### 📊 レポートテスト機能

アプリ起動後、別のターミナルで以下のコマンドを実行してレポート機能をテストできます：

#### 汎用コマンド
```bash
# 日次レポートテスト
kill -USR1 $(pgrep -f "nowplaying-for-discord")

# 週次レポートテスト  
kill -USR2 $(pgrep -f "nowplaying-for-discord")
```

#### 📈 統合レポート画像について

レポートには以下の4つのグラフが1枚の白背景画像として統合されて送信されます：

1. **トップトラック棒グラフ** - 最も聴いた楽曲の上位10曲をランキング表示
2. **トップアーティスト円グラフ** - お気に入りアーティストの聴取比率をドーナツグラフで表示
3. **聴取推移線グラフ** - 期間中の音楽聴取トレンドを時系列で表示
4. **統計サマリー棒グラフ** - 総楽曲数、アーティスト数、アルバム数の統計情報

画像サイズ: 1600x1400ピクセル（高解像度）
背景: 白色で見やすく、Last.fmブランドカラーのアクセント付き

## 🌐 WebサーバーAPI機能

このアプリケーションは、フロントエンド開発者向けにWebサーバー機能を提供します。

### API エンドポイント

- `GET /health` - ヘルスチェック・接続状況確認
- `GET /api/now-playing` - 現在再生中の楽曲情報
- `GET /api/reports/daily` - 日次音楽レポート
- `GET /api/reports/weekly` - 週次音楽レポート
- `GET /api/reports/monthly` - 月次音楽レポート

### WebSocket リアルタイム配信

WebSocketサーバー（`ws://localhost:3001`）を通じて以下の情報をリアルタイムで配信：

- **NowPlaying情報**: 楽曲変更時の即座通知
- **レポート更新**: 定期レポート生成完了通知
- **接続状況**: クライアント接続数・ステータス

### テストクライアント

アプリケーション起動後、`http://localhost:3001/test-client.html` でテスト用のWebクライアントを利用できます。

### 設定

`.env` ファイルで以下の設定が可能：

```bash
# Webサーバー設定
WEB_SERVER_PORT=3001          # サーバーポート（デフォルト: 3001）
WEB_SERVER_CORS=true          # CORS有効/無効（デフォルト: true）
```

## 🔧 トラブルシューティング

### Discord Rich Presenceが表示されない
- Discordクライアントが起動していることを確認
- Discord Application IDが正しいことを確認
- Discordの設定で「ゲームアクティビティを表示する」が有効になっていることを確認

### Discord Bot通知が送信されない
- Bot Tokenが正しいことを確認
- BotがサーバーにJoinしていることを確認
- チャンネルIDが正しいことを確認
- Botに必要な権限（Send Messages, Embed Links等）があることを確認

### Last.fm API エラー
- API Keyが正しいことを確認
- ユーザー名が正しいことを確認
- Last.fmでScrobblingが有効になっていることを確認

### レポートが生成されない
- Last.fm APIからデータが取得できているか確認
- 十分な再生履歴があるか確認（新規アカウントでは少ない可能性）

### 環境変数エラー
- `.env`ファイルが存在することを確認
- 必須の環境変数がすべて設定されていることを確認

## 📝 ライセンス

ISC
