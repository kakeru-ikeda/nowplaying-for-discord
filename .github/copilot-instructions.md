<!-- Use this file to provide workspace-specific custom instructions to Copilot. For more details, visit https://code.visualstudio.com/docs/copilot/copilot-customization#_use-a-githubcopilotinstructionsmd-file -->

# Discord Last.fm Now Playing Bot

このプロジェクトは、Last.fm APIを使用してDiscordのリッチプレゼンスに現在再生中の楽曲を表示し、Discord Botでチャンネル通知と統計レポートを送信するTypeScriptアプリケーションです。

## AIコーディングガイドライン

- **ユーザビリティの優先**: AIが提案するコードは必要最低限の機能に留め、ユーザビリティを重視する。ユーザー要求以上の無駄な機能追加は避ける。

## プロジェクト構成

- **TypeScript**: 型安全性を重視
- **Discord RPC**: Discordリッチプレゼンス機能
- **Discord Bot**: チャンネル通知・統計レポート機能
- **Last.fm API**: 楽曲情報・統計データの取得
- **Chart.js + Canvas**: グラフ生成・画像合成
- **Node.js**: サーバーサイド実行環境
- **node-cron**: 定期実行スケジューリング

## コーディング規約

- **型定義**: すべての関数とオブジェクトに適切な型を定義
- **エラーハンドリング**: try-catchブロックを使用し、適切なログ出力
- **非同期処理**: async/awaitを使用
- **環境変数**: 機密情報は.envファイルで管理
- **ログ**: 絵文字を使用した分かりやすいログメッセージ

## API制限への配慮

- Last.fm API: 15秒間隔でポーリング（1分間に4リクエスト）
- 同一楽曲の重複更新・通知防止
- タイムアウト設定（10秒）
- Discord Bot API制限への配慮

## 主要機能

1. Last.fm APIからのナウプレイング情報取得
2. Last.fm APIからのユーザー統計情報取得（プロフィール・No.1アーティスト・No.1トラック）
3. Last.fm APIからの再生履歴取得（直近指定件数・期間指定・ページネーション対応）
4. Discord Rich Presenceの更新
5. Discord Botチャンネル通知（楽曲変更時）
6. 自動統計レポート送信（日次・週次・月次）
7. 視覚的グラフレポート生成（4種類のグラフを1枚の白背景画像に統合）
8. 実際の聴取データに基づく推移グラフ
9. 環境変数の検証
10. 優雅な終了処理
11. WebサーバーAPI・WebSocket機能
12. レート制限機能

## サービス構成

- **LastFmService**: Last.fm API連携（楽曲情報・統計データ取得・聴取推移データ取得）
- **DiscordRPCService**: Discord Rich Presence管理
- **DiscordBotService**: Discord Bot通知・レポート送信
- **SchedulerService**: 定期レポートスケジューリング
- **ChartService**: グラフ生成・画像合成（Chart.js + Canvas）
- **WebServerService**: Webサーバー・WebSocket・API提供（踏み台サーバー機能）
- **CacheService**: SQLiteベースのキャッシュシステム

## Discord Bot機能詳細

### ナウプレイング通知
- 楽曲変更時にチャンネルへEmbedメッセージ送信
- アーティスト、楽曲名、アルバム、画像を表示
- 重複通知防止機能

### 統計レポート
- **日次レポート**: 毎日0時実行
- **週次レポート**: 毎週日曜日0時実行
- **月次レポート**: 毎月1日0時実行
- Last.fm APIから以下のデータを取得:
  - トップトラック（Top 5）
  - トップアーティスト（Top 5）
  - トップアルバム（Top 3）
  - 実際の聴取推移データ（期間別楽曲数）

### 視覚的レポート生成
- **統合画像**: 4種類のグラフを1枚の白背景画像（1600x1400px）に統合
- **グラフ種類**:
  1. トップトラック棒グラフ（上位10曲のプレイ数）
  2. トップアーティスト円グラフ（上位8アーティストの聴取比率）
  3. 聴取推移線グラフ（実際のLast.fmデータに基づく時系列推移）
  4. 統計サマリー棒グラフ（総楽曲数、アーティスト数、アルバム数）
- **デザイン**: Last.fmブランドカラー使用、日本語対応、高解像度

### 環境変数
- `DISCORD_BOT_TOKEN`: Discord Botトークン
- `DISCORD_NOW_PLAYING_CHANNEL_ID`: ナウプレイング通知チャンネルID
- `DISCORD_REPORT_CHANNEL_ID`: レポート送信チャンネルID
- `CACHE_DB_PATH`: データベースファイルパス
- `CACHE_RETENTION_DAYS`: データ保持期間（日数）
- `INITIAL_SYNC_DAYS`: 初回同期対象期間（日数）

## 踏み台サーバー機能（WebServerService）

### CORS設定管理
- **設定ファイル**: `src/config/cors.json` - 環境別のCORSオリジン設定
- **設定モジュール**: `src/config/cors.ts` - CORS設定の読み込み・検証・管理
- **動的インポート**: require()を使用した循環依存回避設計
- **フォールバック機能**: 設定ファイル読み込み失敗時のデフォルト設定適用
- **環境対応**: development/production環境別の柔軟なオリジン管理

### WebサーバーAPI
- **ポート**: 3001（設定可能）
- **CORS**: 全オリジン許可（開発時）
- **静的ファイル配信**: `public/`ディレクトリ
- **ヘルスチェック**: `GET /health`

### APIエンドポイント
- **`GET /api/now-playing`**: 現在再生中の楽曲情報
- **`GET /api/user-stats`**: ユーザー統計情報（プロフィール・No.1アーティスト・No.1トラック）
- **`GET /api/recent-tracks`**: 直近の再生履歴取得（件数指定・期間指定・ページネーション対応）
- **`GET /api/reports/daily`**: 日次音楽レポート（グラフなし・ページネーション対応）
- **`GET /api/reports/weekly`**: 週次音楽レポート（グラフなし・ページネーション対応）
- **`GET /api/reports/monthly`**: 月次音楽レポート（グラフなし・ページネーション対応）

### 詳細統計API機能
- **`GET /api/stats/week-daily`**: 週間日別統計取得（期間指定対応）
- **`GET /api/stats/month-weekly`**: 月間週別統計取得（期間指定対応）
- **`GET /api/stats/year-monthly`**: 年間月別統計取得（期間指定対応）

### 期間指定機能詳細
- **期間指定モード**: from/toパラメータによる柔軟な期間設定
- **単一日付モード**: 従来のdate/yearパラメータによる自動期間計算
- **バリデーション**: 期間タイプ別の制約チェック（week-daily: 7日間、month-weekly: 同一月、year-monthly: 同一年）
- **下位互換性**: 既存のAPIパラメータを完全サポート

### WebSocket機能
- **リアルタイム通信**: `ws://localhost:3001`
- **ナウプレイング更新**: 楽曲変更時に接続中のクライアントに自動送信
- **接続管理**: クライアント接続数の監視・ログ出力
- **初期データ送信**: 接続時に現在の楽曲情報を送信

### テスト用クライアント
- **テストページ**: `http://localhost:3001/test-client.html`
- **WebSocket接続テスト**: リアルタイム楽曲情報表示
- **API動作確認**: 各エンドポイントの動作テスト

### APIスキーマとバリデーション
- **TypeScriptスキーマ**: `src/schemas/api.ts` - 全APIとWebSocketメッセージの型定義
- **OpenAPIドキュメント**: `src/schemas/openapi.yaml` - REST API仕様とWebSocket仕様書
- **バリデーション機能**: `src/schemas/validation.ts` - ランタイムバリデーションとユーティリティ
- **レート制限**: リクエスト制限とクライアント管理機能
- **エラーハンドリング**: 統一されたエラーレスポンス形式

## 技術仕様詳細

### Last.fm API活用
- **ナウプレイング取得**: `user.getrecenttracks`メソッドで現在再生中の楽曲を取得
- **ユーザー統計取得**: `user.getinfo`、`user.gettopartists`、`user.gettoptracks`でユーザー統計情報を取得
- **再生履歴取得**: `user.getrecenttracks`メソッドで指定件数・期間の履歴を取得
- **聴取推移データ取得**: `user.getrecenttracks`メソッドで期間指定データを取得
- **UNIXタイムスタンプ**: `from`/`to`パラメータで正確な期間データを取得
- **ページネーション**: `limit`/`page`パラメータで大量データの効率的取得
- **エラーハンドリング**: API制限やネットワークエラー時はフォールバックデータを使用
- **レート制限対応**: 1-200件の制限内での最適化されたリクエスト
- **データ取得頻度**: 
  - 日次: 過去7日間の日別楽曲数
  - 週次: 過去4週間の週別楽曲数
  - 月次: 過去6ヶ月の月別楽曲数

### グラフ生成技術
- **Chart.js**: 高品質なグラフライブラリ
- **chartjs-node-canvas**: Node.js環境でのCanvas描画
- **Canvas API**: 複数グラフの1枚画像結合
- **画像形式**: PNG形式、白背景、高解像度（1600x1400px）
- **レイアウト**: 2x2グリッド配置、ヘッダー情報付き

### Discord Bot機能
- **Embed**: リッチなメッセージ表示
- **AttachmentBuilder**: 画像ファイル添付
- **ファイル管理**: タイムスタンプ付きファイル名で重複回避

## AIコーディングガイドライン

- **ドキュメントリファレンスの更新**: 新しいAPIや機能追加時にREADME.mdを更新
- **Copilot手順書の更新**: 機能追加や変更時に`.github/copilot-instructions.md`を更新
- **MCPサーバーの活用**: MCPサーバーを使用して、Copilotの提案をより適切にするための情報を提供 (https://github.com/kakeru-ikeda/nowplaying-for-discord)
- **グラフ機能開発時の注意点**:
  - Chart.jsの設定は日本語対応を考慮
  - 画像生成エラー時でもテキストレポートは継続送信
  - Last.fm APIのレート制限を考慮したデータ取得
  - Canvas描画時のメモリ効率を考慮
- **データ取得の設計方針**:
  - 実際のLast.fmデータを優先、エラー時はフォールバック
  - UNIXタイムスタンプを使用した正確な期間指定
  - API制限に配慮したバッチ処理設計
  - 現在再生中楽曲の除外処理（聴取推移データの正確性向上）
- **踏み台サーバー開発時の注意点**:
  - Express + WebSocketの統合アーキテクチャ
  - CORS設定は本番環境では適切に制限
  - `src/config/cors.json`での環境別オリジン管理
  - 動的インポート（require()）による循環依存回避
  - CORS設定読み込み失敗時のフォールバック機能
  - WebSocket接続の適切な管理とエラーハンドリング
  - API応答時間の最適化（グラフ生成なしのAPI用レポート）
  - 静的ファイル配信とテスト環境の提供
  - スキーマベース開発: TypeScript型定義を基にしたAPI設計
  - ランタイムバリデーション: 受信データの型安全性確保
  - エラーレスポンス統一: 一貫したエラー形式とコード体系
  - レート制限とパフォーマンス監視の実装
  - **再生履歴API開発時の注意点**:
  - Last.fm APIの`user.getrecenttracks`の制限（1-200件）を遵守
  - UNIXタイムスタンプでの正確な期間指定実装
  - ページネーション対応による大量データの効率的取得
  - 現在再生中楽曲の`isPlaying`フラグとplayedAtの適切な処理
  - レート制限（1分間100リクエスト）への対応
  - エラー時の空配列返却による安全なフォールバック処理
  - ISO 8601形式での日時パラメータバリデーション
  - WebSocket経由でのリアルタイム配信機能

### 統計API開発時の注意点
- **期間指定機能**: from/toパラメータによる柔軟な期間設定と既存date/yearパラメータの完全サポート
- **バリデーション**: `validatePeriodRange`関数による期間タイプ別制約チェック
- **エラーハンドリング**: 期間制約違反時の適切なHTTPステータスコードとエラーメッセージ
- **データ整合性**: 期間指定による正確な統計情報の提供とLast.fm APIの効率的活用
- **レスポンス形式**: 統一されたメタデータ形式（from/to/isRangeMode/referenceDate）
- **テストクライアント**: 期間指定モードの切り替えUI、便利なボタン（今日、今週、今月）
- **OpenAPI仕様**: 期間指定パラメータの完全なドキュメント化とエラーレスポンス例

## キャッシュシステム（CacheService）

### 概要
Last.fm APIからのデータ取得を効率化するSQLiteベースのキャッシュシステム。再生履歴データを永続化し、高速な統計レポート生成を実現。

### 構成要素
- **DatabaseService**: SQLiteデータベース管理（`src/services/database.ts`）
- **CacheService**: キャッシュロジック管理（`src/services/cache.ts`）
- **データベースファイル**: `data/cache.db`（SQLite）

### 主要機能
- **初回同期**: 過去30日間の再生履歴を日別に取得・保存
- **差分同期**: 最終同期時刻からの新しいデータのみを取得
- **不足データ補完**: API呼び出し時に必要な期間のデータを自動取得
- **統計計算高速化**: キャッシュデータを使用した高速レポート生成
- **自動クリーンアップ**: 古いデータの自動削除（デフォルト90日）

### テーブル設計
1. **tracks**: 再生履歴データ（アーティスト・楽曲・再生時刻等）
2. **sync_history**: 同期履歴（同期タイプ・開始/終了時刻・処理件数等）
3. **cache_config**: キャッシュ設定（最終同期時刻等）

### API制限対応
- **レート制限**: 250ms間隔でのAPI呼び出し
- **エラー処理**: API失敗時の適切なハンドリング
- **フォールバック**: キャッシュ失敗時の直接API呼び出し

### パフォーマンス最適化
- **インデックス**: `playedAt`、`scrobbleDate`、`artist`カラム
- **バッチ処理**: 複数レコードの一括挿入
- **重複除去**: 同一楽曲の重複保存防止
- **バキューム**: 定期的なデータベース最適化

### 開発時の注意点
- **初期化**: アプリケーション起動時に`initialize()`を必ず呼び出し
- **エラーハンドリング**: キャッシュエラー時のフォールバック処理を実装
- **データ整合性**: 同期プロセス中の重複実行防止
- **メモリ効率**: 大量データ処理時のメモリ使用量に注意
- **ログ出力**: 詳細な同期進捗ログで運用状況を監視
- **期間指定**: UNIXタイムスタンプを使用した正確な期間設定
- **トランザクション**: データベース操作の原子性確保

### 利用パターン
```typescript
// 統計用データ取得
const tracks = await cacheService.getTracksForStats(from, to);

// ページネーション対応データ取得
const result = await cacheService.getTracksFromCache(from, to, limit, page);

// キャッシュ統計情報取得
const stats = await cacheService.getCacheStats();
```
