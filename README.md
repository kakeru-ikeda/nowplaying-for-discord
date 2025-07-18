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
│   ├── config/
│   │   ├── cors.ts           # CORS設定管理モジュール
│   │   └── cors.json         # CORS設定ファイル
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

### CORS設定

Webサーバーでは、`src/config/cors.json`ファイルでCORSの詳細設定を管理しています。

**設定ファイル**: `src/config/cors.json`

```json
{
  "development": [
    {
      "protocol": "http",
      "hostname": "localhost",
      "port": 3000
    },
    {
      "protocol": "https",
      "hostname": "localhost",
      "port": 8443
    }
  ],
  "production": [
    {
      "protocol": "https",
      "hostname": "yourdomain.com"
    }
  ],
  "credentials": true
}
```

**設定項目**:
- `development`: 開発環境で許可するオリジンリスト
- `production`: 本番環境で許可するオリジンリスト
- `credentials`: Cookie送信の許可設定

**デフォルト対応ドメイン**:
- `localhost` (HTTP/HTTPS)
- `127.0.0.1` (HTTP/HTTPS)
- カスタムポート: 3000, 3001, 6001, 8000, 8443, 8444

CORS設定ファイルが見つからない場合は、自動的にデフォルト設定が適用されます。

### API エンドポイント

- `GET /health` - ヘルスチェック・接続状況確認
- `GET /api/now-playing` - 現在再生中の楽曲情報
- `GET /api/user-stats` - ユーザー統計情報（プロフィール・No.1アーティスト・No.1トラック）
- `GET /api/recent-tracks` - 直近の再生履歴取得（件数指定・期間指定・ページネーション対応）
- `GET /api/reports/daily` - 日次音楽レポート（グラフなし・ページネーション対応）
- `GET /api/reports/weekly` - 週次音楽レポート（グラフなし・ページネーション対応）
- `GET /api/reports/monthly` - 月次音楽レポート（グラフなし・ページネーション対応）

## 📊 統計エンドポイント

### 詳細統計取得API（期間指定対応）

3つの統計エンドポイントが利用可能で、それぞれ期間指定と単一日付指定の両方をサポートしています：

#### 1. 週間日別統計 (`/api/stats/week-daily`)
- **機能**: 指定期間内の各日の再生数を取得
- **期間制限**: 最大7日間まで
- **使用例**:
  ```
  GET /api/stats/week-daily?from=2025-07-14&to=2025-07-20
  GET /api/stats/week-daily?date=2025-07-15
  ```

#### 2. 月間週別統計 (`/api/stats/month-weekly`)
- **機能**: 指定期間内の各週の再生数を取得
- **期間制限**: 同一月内のみ
- **使用例**:
  ```
  GET /api/stats/month-weekly?from=2025-07-01&to=2025-07-31
  GET /api/stats/month-weekly?date=2025-07-15
  ```

#### 3. 年間月別統計 (`/api/stats/year-monthly`)
- **機能**: 指定期間内の各月の再生数を取得
- **期間制限**: 同一年内のみ
- **使用例**:
  ```
  GET /api/stats/year-monthly?from=2025-01-01&to=2025-12-31
  GET /api/stats/year-monthly?year=2025
  ```

### パラメータ仕様

#### 期間指定モード
- **`from`**: 期間開始日（YYYY-MM-DD形式）
- **`to`**: 期間終了日（YYYY-MM-DD形式）
- **制約**: from/toは両方必須、期間タイプ別の制限あり

#### 単一日付モード（下位互換性維持）
- **`date`**: 基準日（YYYY-MM-DD形式）- 週間・月間統計用
- **`year`**: 対象年（YYYY形式）- 年間統計用

#### バリデーション
- 期間指定と単一日付の併用は不可
- 各統計タイプごとに適切な期間制限を適用
- 不正な期間指定時は400エラーとエラーメッセージを返却

### レスポンス形式

すべての統計APIは以下のメタデータを含みます：
- **`from`**: 実際の期間開始日
- **`to`**: 実際の期間終了日
- **`isRangeMode`**: 期間指定モードかどうか
- **`referenceDate`**: 基準日（単一日付モード時のみ）

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
HTTP_PORT=3001          # HTTPサーバーポート（デフォルト: 3001）
HTTPS_PORT=8443         # HTTPSサーバーポート（デフォルト: 8443）
WEB_SERVER_CORS=true    # CORS有効/無効（デフォルト: true）

# CORS詳細設定は src/config/cors.json で管理
# 環境別のオリジン許可設定をJSONファイルで定義
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
環境変数 `HTTPS_DOMAINS` を利用して拡張可能

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

### CORS エラー
- `src/config/cors.json`ファイルが正しい形式で存在することを確認
- 開発環境では自動的にlocalhostドメインが許可される
- 本番環境では`cors.json`の`production`配列に適切なドメインを設定
- ブラウザの開発者ツールでCORSエラーの詳細を確認

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

## 📊 音楽レポートAPI

音楽レポートAPIは、日次・週次・月次の音楽統計情報を提供します。ページネーション機能により、大量のデータを効率的に取得できます。

### レポートエンドポイント

```bash
# 日次レポート（トップ10のトラック・アーティスト・アルバム）
curl "http://localhost:3001/api/reports/daily?limit=10&page=1"

# 週次レポート（トップ20のトラック・アーティスト・アルバム）
curl "http://localhost:3001/api/reports/weekly?limit=20&page=1"

# 月次レポート（トップ50のトラック・アーティスト・アルバム）
curl "http://localhost:3001/api/reports/monthly?limit=50&page=1"

# 特定の日付でのレポート取得
curl "http://localhost:3001/api/reports/daily?date=2025-07-10&limit=20&page=1"

# 特定の週のレポート取得（指定した日が含まれる週）
curl "http://localhost:3001/api/reports/weekly?date=2025-07-10&limit=30&page=1"

# 特定の月のレポート取得（指定した日が含まれる月）
curl "http://localhost:3001/api/reports/monthly?date=2025-07-10&limit=50&page=1"
```

### パラメータ仕様

- `limit`: 取得件数（1-200、デフォルト50）
- `page`: ページ番号（1以上、デフォルト1）
- `date`: 対象日付（ISO 8601形式またはYYYY-MM-DD形式、未指定の場合は現在時刻）

### レスポンス例

```json
{
  "success": true,
  "data": {
    "period": "daily",
    "dateRange": {
      "start": "2025-07-15T00:00:00.000Z",
      "end": "2025-07-15T23:59:59.999Z"
    },
    "tracks": [
      {
        "name": "Track Name",
        "artist": { "name": "Artist Name" },
        "playcount": "15"
      }
    ],
    "artists": [
      {
        "name": "Artist Name",
        "playcount": "25"
      }
    ],
    "albums": [
      {
        "name": "Album Name",
        "artist": { "name": "Artist Name" },
        "playcount": "20"
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 50,
      "total": 25
    }
  }
}
```

### サービス層の改善

**2025年7月15日 - LastFmServiceデータ取得上限の調整**

レポートAPIで10件制限の問題を解決するため、以下のメソッドのデフォルト値を調整しました：

- `getTopTracksByTimeRange`: 10件 → **100件**
- `getTopArtistsByTimeRange`: 10件 → **100件**  
- `getTopAlbumsByTimeRange`: 5件 → **50件**

これにより、月次レポートでも期待される件数のデータが取得できるようになりました。

**技術的詳細:**
- Last.fm APIの`user.getrecenttracks`から期間指定でデータを取得
- 取得した再生履歴を集計してトップリストを生成
- ページネーション機能により、フロントエンドで適切に分割表示
- エラー時は空配列を返してサービス継続性を保証
- `date`パラメータで特定の日付を基準とした期間設定が可能
  - 日次: 指定日の0時から23時59分59秒まで
  - 週次: 指定日を含む週の日曜日から土曜日まで
  - 月次: 指定日を含む月の1日から月末まで

**注意事項:**
- `date`パラメータの形式: ISO 8601形式（`2025-07-10T12:00:00.000Z`）またはYYYY-MM-DD形式（`2025-07-10`）
- 未指定の場合は現在時刻を基準とした期間が適用される
- 期間の境界は日本時間ではなくUTC時間で処理される

### 期間指定機能（統計API）
- **バリデーション**: `validatePeriodRange`関数による包括的な期間検証
- **期間制約**: 統計タイプ別の適切な期間制限（week-daily: 7日間、month-weekly: 同一月、year-monthly: 同一年）
- **エラーハンドリング**: 制約違反時の詳細なエラーメッセージとHTTPステータスコード
- **下位互換性**: 既存のdate/yearパラメータを完全サポート
- **レスポンス統一**: 全統計APIで一貫したメタデータ形式を提供

## 📊 キャッシュシステム

このアプリケーションは、Last.fm APIからのデータ取得を効率化するための高度なキャッシュシステムを搭載しています。

### キャッシュの特徴

- **📦 SQLiteベースのローカルキャッシュ**: 再生履歴データを永続化
- **🔄 初回同期**: 過去30日間の再生履歴を自動取得
- **⚡ 差分同期**: 最終同期時刻からの新しいデータのみを取得
- **🔍 不足データの自動補完**: API呼び出し時に必要な期間のデータを自動取得
- **📊 統計計算の高速化**: キャッシュデータを使用した高速な統計レポート生成
- **🧹 自動データクリーンアップ**: 古いデータの自動削除機能

### データベーススキーマ

#### tracks テーブル
- `id`: 主キー
- `artist`: アーティスト名
- `trackName`: 楽曲名
- `album`: アルバム名
- `imageUrl`: カバー画像URL
- `trackUrl`: Last.fm URL
- `playedAt`: 再生時刻
- `isPlaying`: 現在再生中フラグ
- `scrobbleDate`: 再生日（YYYY-MM-DD形式）
- `createdAt`: 作成日時
- `updatedAt`: 更新日時

#### sync_history テーブル
- `id`: 主キー
- `syncType`: 同期タイプ（initial/incremental）
- `startTime`: 同期開始時刻
- `endTime`: 同期終了時刻
- `tracksAdded`: 追加された楽曲数
- `tracksUpdated`: 更新された楽曲数
- `apiCallsMade`: API呼び出し回数
- `status`: 同期ステータス（running/success/failed）
- `createdAt`: 作成日時

#### cache_config テーブル
- `key`: 設定キー
- `value`: 設定値
- `updatedAt`: 更新日時

### 初期化プロセス

1. **データベース初期化**: SQLiteデータベースファイルの作成とテーブル設定
2. **最終同期時刻の確認**: 前回の同期データがあるかチェック
3. **初回同期または差分同期**: 
   - 初回起動時: 過去30日間の全データを日別に取得
   - 通常起動時: 最終同期時刻からの差分データのみ取得

### 初回同期の流れ

```
🔄 初回同期プロセス
├── 📅 過去30日間の期間を設定
├── 🔁 日別データ取得ループ
│   ├── 📊 Last.fm API呼び出し
│   ├── 💾 データベースへの保存
│   ├── ⏱️ レート制限対応（250ms間隔）
│   └── 📈 進捗ログ出力
└── ✅ 同期完了・最終同期時刻更新
```

### 差分同期の流れ

```
🔄 差分同期プロセス
├── 📊 最終同期時刻の取得
├── 🆕 新しいデータの取得
├── 💾 データベースへの保存
└── ✅ 同期完了・最終同期時刻更新
```

### 不足データの自動補完

キャッシュからデータを取得する際、要求された期間のデータが不足している場合、自動的に補完を行います：

```typescript
// 例: 2025-07-01から2025-07-15のデータを要求
const result = await cacheService.getTracksFromCache(
  new Date('2025-07-01'),
  new Date('2025-07-15'),
  50, // limit
  1   // page
);
```

### API制限対応

- **レート制限**: Last.fm API制限に配慮した250ms間隔での呼び出し
- **エラー処理**: API呼び出し失敗時の適切なエラーハンドリング
- **フォールバック**: キャッシュエラー時の直接API呼び出し

### パフォーマンス最適化

- **インデックス**: `playedAt`、`scrobbleDate`、`artist`カラムにインデックス設定
- **バッチ処理**: 複数レコードの一括挿入によるパフォーマンス向上
- **重複除去**: 同一楽曲の重複保存防止
- **バキューム**: 定期的なデータベース最適化

### 統計情報の提供

```typescript
// キャッシュの統計情報を取得
const stats = await cacheService.getCacheStats();
console.log(stats);
// {
//   totalTracks: 1500,
//   uniqueArtists: 250,
//   uniqueAlbums: 300,
//   dateRange: { earliest: Date, latest: Date },
//   lastSync: Date
// }
```

### データクリーンアップ

```typescript
// 90日より古いデータを削除
const deletedCount = await cacheService.cleanupOldData(90);
console.log(`${deletedCount}件の古いデータを削除しました`);

// データベースの最適化
await cacheService.vacuum();
```

### 利用メソッド

#### getTracksFromCache
```typescript
const result = await cacheService.getTracksFromCache(
  from: Date,        // 開始日時
  to: Date,          // 終了日時
  limit: number,     // 取得件数
  page: number       // ページ番号
);
```

#### getTracksForStats
```typescript
const tracks = await cacheService.getTracksForStats(
  from: Date,        // 開始日時
  to: Date           // 終了日時
);
```

### ログ出力

キャッシュシステムは詳細なログを出力し、運用状況を監視できます：

```
🔄 キャッシュサービスを初期化中...
📥 初回起動：過去30日間のデータを取得中...
📅 期間: 2025/6/16 - 2025/7/16
📊 2025/6/16: 25件追加 (累計: 25件)
📊 2025/6/17: 30件追加 (累計: 55件)
...
✅ 初期同期完了: 1200件のトラックを保存しました
✅ キャッシュサービスの初期化が完了しました
```

### 設定オプション

キャッシュシステムの動作は環境変数で調整可能です：

```env
# データベースファイルパス
CACHE_DB_PATH=./data/cache.db

# データクリーンアップの保持期間（日数）
CACHE_RETENTION_DAYS=90

# 初回同期の対象期間（日数）
INITIAL_SYNC_DAYS=30
```

### エラーハンドリング

キャッシュシステムは堅牢なエラーハンドリングを提供：

- **API制限エラー**: 自動的にリトライ間隔を調整
- **データベースエラー**: 適切なロールバックとエラーログ
- **不足データエラー**: 自動的なデータ補完処理
- **フォールバック**: キャッシュ失敗時の直接API呼び出し

このキャッシュシステムにより、Last.fm APIの制限内で効率的にデータを管理し、高速な統計レポート生成とリアルタイム情報提供を実現しています。
