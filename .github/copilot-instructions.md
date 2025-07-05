<!-- Use this file to provide workspace-specific custom instructions to Copilot. For more details, visit https://code.visualstudio.com/docs/copilot/copilot-customization#_use-a-githubcopilotinstructionsmd-file -->

# Discord Last.fm Now Playing Bot

このプロジェクトは、Last.fm APIを使用してDiscordのリッチプレゼンスに現在再生中の楽曲を表示し、Discord Botでチャンネル通知と統計レポートを送信するTypeScriptアプリケーションです。

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
2. Discord Rich Presenceの更新
3. Discord Botチャンネル通知（楽曲変更時）
4. 自動統計レポート送信（日次・週次・月次）
5. 視覚的グラフレポート生成（4種類のグラフを1枚の白背景画像に統合）
6. 実際の聴取データに基づく推移グラフ
7. 環境変数の検証
8. 優雅な終了処理

## サービス構成

- **LastFmService**: Last.fm API連携（楽曲情報・統計データ取得・聴取推移データ取得）
- **DiscordRPCService**: Discord Rich Presence管理
- **DiscordBotService**: Discord Bot通知・レポート送信
- **SchedulerService**: 定期レポートスケジューリング
- **ChartService**: グラフ生成・画像合成（Chart.js + Canvas）

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

## 技術仕様詳細

### Last.fm API活用
- **聴取推移データ取得**: `user.getrecenttracks`メソッドで期間指定データを取得
- **UNIXタイムスタンプ**: `from`/`to`パラメータで正確な期間データを取得
- **エラーハンドリング**: API制限やネットワークエラー時はフォールバックデータを使用
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
