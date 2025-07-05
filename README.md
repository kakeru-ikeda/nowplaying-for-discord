# Discord Last.fm Now Playing

Last.fm APIを使用してDiscordのリッチプレゼンスに現在再生中の楽曲を表示するTypeScriptアプリケーションです。

## 🎵 機能

- ✅ **リアルタイム楽曲情報取得**: Last.fm APIから現在再生中の楽曲情報を取得
- ✅ **Discord Rich Presence更新**: 楽曲情報をDiscordのリッチプレゼンスとして表示
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
UPDATE_INTERVAL=30000
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
│   │   └── discord.ts        # Discord RPC クライアント
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
`UPDATE_INTERVAL`環境変数で更新間隔をミリ秒で設定できます（デフォルト: 30秒）

### API制限への対応
- Last.fm API: 15秒間隔でポーリング（1分間に4リクエスト）
- 同一楽曲の重複更新防止
- タイムアウト設定（10秒）

## 🔧 トラブルシューティング

### Discord Rich Presenceが表示されない
- Discordクライアントが起動していることを確認
- Discord Application IDが正しいことを確認
- Discordの設定で「ゲームアクティビティを表示する」が有効になっていることを確認

### Last.fm API エラー
- API Keyが正しいことを確認
- ユーザー名が正しいことを確認
- Last.fmでScrobblingが有効になっていることを確認

### 環境変数エラー
- `.env`ファイルが存在することを確認
- 必須の環境変数がすべて設定されていることを確認

## 📝 ライセンス

ISC

## 🤝 コントリビューション

プルリクエストや Issue の報告を歓迎します！
