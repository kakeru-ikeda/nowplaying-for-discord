# Discord Last.fm Now Playing

Last.fm APIを使用してDiscordのリッチプレゼンスに現在再生中の楽曲を表示し、Discord Botでチャンネル通知と統計レポートを送信するTypeScriptアプリケーションです。

## 🎵 機能

- ✅ **リアルタイム楽曲情報取得**: Last.fm APIから現在再生中の楽曲情報を取得
- ✅ **ユーザー統計情報**: プロフィール・No.1アーティスト・No.1トラックの統合情報
- ✅ **再生履歴取得**: 直近何件の再生履歴を期間指定・ページネーション対応で取得
- ✅ **Discord Rich Presence更新**: 楽曲情報をDiscordのリッチプレゼンスとして表示
- ✅ **Discord Bot通知**: 楽曲が変わった時にチャンネルへ通知
- ✅ **自動レポート生成**: 日次/週次/月次の音楽統計レポートを自動送信
- ✅ **視覚的レポート**: 4種類のグラフを1枚の白背景画像に統合
- ✅ **Webサーバー & WebSocket**: フロントエンド向けのAPI・リアルタイム配信機能
- ✅ **レート制限機能**: API呼び出し制限とクライアント管理
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
│   │   ├── chart.ts          # グラフ生成サービス
│   │   └── web-server.ts     # Webサーバー・WebSocket・API
│   ├── schemas/
│   │   ├── api.ts            # APIスキーマ・型定義
│   │   ├── openapi.yaml      # OpenAPI仕様書
│   │   └── validation.ts     # バリデーション・ユーティリティ
│   └── utils/
│       └── config.ts         # 設定管理
├── public/
│   └── test-client.html      # Webクライアントテストページ
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
- `GET /api/user-stats` - ユーザー統計情報（プロフィール・No.1アーティスト・No.1トラック）
- `GET /api/recent-tracks` - 直近の再生履歴取得（件数指定・期間指定・ページネーション対応）
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
HTTP_PORT=3001          # サーバーポート（デフォルト: 3001）
WEB_SERVER_CORS=true          # CORS有効/無効（デフォルト: true）
```

## 🔒 HTTPS設定

### 証明書の自動管理システム

このプロジェクトでは、`mkcert-auto-renewer`サブモジュールを使用して、証明書の自動生成・更新・監視を行います。

**主な機能：**
- 🔄 証明書の自動生成・更新
- 📁 証明書ファイルの変更監視
- 🌍 クロスプラットフォーム対応（Windows、macOS、Linux）
- 📅 定期的な証明書更新スケジュール
- 🔧 Express.js/Node.js統合

### 証明書の生成

開発環境でHTTPS通信を有効にするために、`mkcert`を使用してローカル証明書を生成します：

```bash
# 証明書生成スクリプトの実行（推奨）
npm run cert:generate

# または手動で証明書を生成
npm run cert:create

# サブモジュールを使用したCLI生成
cd lib/mkcert-auto-renewer && npm run generate
```

### HTTPS有効化

環境変数でHTTPS機能を有効にします：

```bash
# .envファイルに追加
HTTPS_ENABLED=true
HTTPS_PORT=8443
HTTPS_KEY_PATH=./localhost+3-key.pem
HTTPS_CERT_PATH=./localhost+3.pem

# 証明書自動更新設定
AUTO_RENEWAL=true
CERT_WARNING_DAYS=10
CERT_CRON_PATTERN="0 2 * * 0"
HTTPS_DOMAINS=localhost,127.0.0.1,::1
```

### HTTPSサーバー起動

```bash
# 開発モード（HTTPS）
npm run dev:https

# 本番モード（HTTPS）
npm run start:https

# 監視モード（HTTPS）
npm run watch:https
```

### 証明書の自動更新

システムには以下の自動更新機能が組み込まれています：

- **自動生成**: 証明書が存在しない場合、起動時に自動生成
- **有効期限チェック**: 起動時に証明書の有効期限を確認
- **自動更新**: 有効期限が近づいた場合（デフォルト10日前）に自動更新
- **定期更新**: 設定したスケジュール（デフォルト毎週日曜日 2:00 AM）で定期チェック
- **ファイル監視**: 証明書ファイルの変更を監視し、変更時に通知

### 手動証明書管理

サブモジュールのCLIを使用して手動管理も可能です：

```bash
# 証明書の有効期限チェック
cd lib/mkcert-auto-renewer && npm run check

# 証明書の手動生成
cd lib/mkcert-auto-renewer && npm run generate

# 証明書ファイルの監視
cd lib/mkcert-auto-renewer && npm run monitor

# 自動更新スケジュール開始
cd lib/mkcert-auto-renewer && npm run schedule
```

### アクセス方法

#### HTTP（デフォルト）
- **WebUI**: http://localhost:3001
- **API**: http://localhost:3001/api/*
- **WebSocket**: ws://localhost:3001

#### HTTPS（推奨）
- **WebUI**: https://localhost:8443
- **API**: https://localhost:8443/api/*  
- **WebSocket**: wss://localhost:8443

対応ドメイン：
- `localhost`
- `127.0.0.1`
- `192.168.40.99`（ローカルネットワーク）

### セキュリティ機能

- **Helmet**: HTTPセキュリティヘッダー
- **CORS**: クロスオリジン制御
- **Content Security Policy**: XSS対策
- **Gzip圧縮**: パフォーマンス向上
- **SSL/TLS**: 暗号化通信
- **自動証明書更新**: 期限切れ防止

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

#### 📻 再生履歴取得API

新しく追加された再生履歴取得機能では、Last.fm APIの`user.getRecentTracks`を活用して、指定した件数の直近の再生履歴を取得できます。

**基本的な使用例:**

```bash
# 直近10件の再生履歴を取得
curl "http://localhost:3001/api/recent-tracks?limit=10"

# 期間指定で取得（昨日の再生履歴）
curl "http://localhost:3001/api/recent-tracks?from=2025-07-05T00:00:00.000Z&to=2025-07-05T23:59:59.999Z"

# ページネーション（2ページ目を取得）
curl "http://localhost:3001/api/recent-tracks?page=2&limit=50"
```

**JavaScript/TypeScript での使用例:**

```javascript
// 直近20件の再生履歴を取得
const response = await fetch('/api/recent-tracks?limit=20');
const data = await response.json();

if (data.success) {
  console.log(`${data.data.tracks.length}件の再生履歴を取得`);
  data.data.tracks.forEach(track => {
    console.log(`${track.artist} - ${track.track} (${track.isPlaying ? '再生中' : track.playedAt})`);
  });
}

// 期間指定で全データを取得
const fromDate = '2025-07-01T00:00:00.000Z';
const toDate = '2025-07-06T23:59:59.999Z';
const periodicResponse = await fetch(
  `/api/recent-tracks?from=${fromDate}&to=${toDate}&limit=200`
);
```

**パラメータ仕様:**
- `limit`: 取得件数（1-200、デフォルト50）
- `page`: ページ番号（1以上、デフォルト1）
- `from`: 開始日時（ISO 8601形式）
- `to`: 終了日時（ISO 8601形式）

**レスポンス例:**
```json
{
  "success": true,
  "data": {
    "tracks": [
      {
        "artist": "Artist Name",
        "track": "Song Title",
        "album": "Album Name",
        "imageUrl": "https://...",
        "isPlaying": false,
        "playedAt": "2025-07-06T10:25:00.000Z",
        "url": "https://www.last.fm/music/..."
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 50,
      "total": 10
    },
    "period": {
      "from": "2025-07-01T00:00:00.000Z",
      "to": "2025-07-06T23:59:59.999Z"
    }
  },
  "timestamp": "2025-07-06T10:30:00.000Z"
}
```

**注意事項:**
- レート制限: 1分間に100リクエストまで
- 現在再生中のトラックは`isPlaying: true`で、`playedAt`は`null`
- エラー時は適切なHTTPステータスコードとエラーメッセージを返す
