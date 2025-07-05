<!-- Use this file to provide workspace-specific custom instructions to Copilot. For more details, visit https://code.visualstudio.com/docs/copilot/copilot-customization#_use-a-githubcopilotinstructionsmd-file -->

# Discord Last.fm Now Playing Bot

このプロジェクトは、Last.fm APIを使用してDiscordのリッチプレゼンスに現在再生中の楽曲を表示するTypeScriptアプリケーションです。

## プロジェクト構成

- **TypeScript**: 型安全性を重視
- **Discord RPC**: Discordリッチプレゼンス機能
- **Last.fm API**: 楽曲情報の取得
- **Node.js**: サーバーサイド実行環境

## コーディング規約

- **型定義**: すべての関数とオブジェクトに適切な型を定義
- **エラーハンドリング**: try-catchブロックを使用し、適切なログ出力
- **非同期処理**: async/awaitを使用
- **環境変数**: 機密情報は.envファイルで管理
- **ログ**: 絵文字を使用した分かりやすいログメッセージ

## API制限への配慮

- Last.fm API: 1分間に5リクエストまで（15秒間隔でポーリング）
- 同一楽曲の重複更新防止
- タイムアウト設定（10秒）

## 主要機能

1. Last.fm APIからのナウプレイング情報取得
2. Discord Rich Presenceの更新
3. 環境変数の検証
4. 優雅な終了処理

## AIコーディングガイドライン

- **ドキュメントリファレンスの更新**: 新しいAPIや機能追加時にREADME.mdを更新
- **Copilot手順書の更新**: 機能追加や変更時に`.github/copilot-instructions.md`を更新
- **MCPサーバーの活用**: MCPサーバーを使用して、Copilotの提案をより適切にするための情報を提供 (https://github.com/kakeru-ikeda/nowplaying-for-discord)
