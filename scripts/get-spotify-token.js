#!/usr/bin/env node

/**
 * Spotify Refresh Token取得スクリプト（ローカルサーバー版）
 * 
 * 使用方法:
 * 1. .envファイルにSPOTIFY_CLIENT_IDとSPOTIFY_CLIENT_SECRETを設定
 * 2. npm run spotify:auth を実行
 * 3. 表示されるURLにアクセスして認証
 * 4. 自動的にトークンが取得されます
 */

const https = require('https');
const http = require('http');
const url = require('url');
const open = require('child_process').spawn;
require('dotenv').config();

const CLIENT_ID = process.env.SPOTIFY_CLIENT_ID;
const CLIENT_SECRET = process.env.SPOTIFY_CLIENT_SECRET;
const REDIRECT_URI = 'http://127.0.0.1:8888/callback';
const SCOPES = 'user-read-currently-playing user-read-playback-state';
const PORT = 8888;

if (!CLIENT_ID || !CLIENT_SECRET) {
    console.error('❌ エラー: SPOTIFY_CLIENT_IDとSPOTIFY_CLIENT_SECRETを.envファイルに設定してください');
    process.exit(1);
}

console.log('🎵 Spotify Refresh Token取得ツール（自動化版）\n');
console.log('🔧 設定情報:');
console.log(`   Client ID: ${CLIENT_ID}`);
console.log(`   Redirect URI: ${REDIRECT_URI}`);
console.log(`   必要なスコープ: ${SCOPES}\n`);

// ローカルサーバーを起動
const server = http.createServer((req, res) => {
    const parsedUrl = url.parse(req.url, true);

    if (parsedUrl.pathname === '/callback') {
        const authCode = parsedUrl.query.code;
        const error = parsedUrl.query.error;

        if (error) {
            console.error('❌ 認証エラー:', error);
            res.writeHead(400, { 'Content-Type': 'text/html; charset=utf-8' });
            res.end(`
        <html>
          <body style="font-family: Arial, sans-serif; padding: 20px;">
            <h2>❌ 認証エラー</h2>
            <p>エラー: ${error}</p>
            <p>このタブを閉じて、ターミナルを確認してください。</p>
          </body>
        </html>
      `);
            server.close();
            return;
        }

        if (authCode) {
            console.log('✅ 認証コードを受信しました');

            // 成功ページを表示
            res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
            res.end(`
        <html>
          <body style="font-family: Arial, sans-serif; padding: 20px; text-align: center;">
            <h2>🎉 認証成功！</h2>
            <p>Spotify認証が正常に完了しました。</p>
            <p>このタブを閉じて、ターミナルを確認してください。</p>
            <script>
              setTimeout(() => {
                window.close();
              }, 3000);
            </script>
          </body>
        </html>
      `);

            // トークンを取得
            getTokens(authCode);
        } else {
            res.writeHead(400, { 'Content-Type': 'text/html; charset=utf-8' });
            res.end(`
        <html>
          <body style="font-family: Arial, sans-serif; padding: 20px;">
            <h2>❌ エラー</h2>
            <p>認証コードが見つかりません。</p>
            <p>このタブを閉じて、再度お試しください。</p>
          </body>
        </html>
      `);
        }
    } else {
        res.writeHead(404, { 'Content-Type': 'text/plain' });
        res.end('Not Found');
    }
});

// サーバー開始
server.listen(PORT, () => {
    console.log(`🌐 ローカルサーバーを起動しました: http://localhost:${PORT}`);

    // 認証URLを生成
    const authUrl = `https://accounts.spotify.com/authorize?` +
        `response_type=code&` +
        `client_id=${CLIENT_ID}&` +
        `scope=${encodeURIComponent(SCOPES)}&` +
        `redirect_uri=${encodeURIComponent(REDIRECT_URI)}&` +
        `state=spotify-token-script`;

    console.log('\n📋 Spotify Developer Dashboardの設定:');
    console.log('1. https://developer.spotify.com/dashboard にアクセス');
    console.log('2. アプリを選択 > Settings > Edit Settings');
    console.log('3. Redirect URIs に以下を追加:');
    console.log(`   ${REDIRECT_URI}`);
    console.log('4. 保存\n');

    console.log('🚀 認証を開始します...');
    console.log('ブラウザが自動で開かない場合は、以下のURLにアクセスしてください:\n');
    console.log(authUrl);
    console.log();

    // ブラウザを自動で開く（クロスプラットフォーム対応）
    const platform = process.platform;
    let cmd;

    if (platform === 'darwin') {
        cmd = 'open';
    } else if (platform === 'win32') {
        cmd = 'start';
    } else {
        cmd = 'xdg-open';
    }

    try {
        const child = open(cmd, [authUrl], {
            stdio: 'ignore',
            detached: true
        });
        child.unref();
        console.log('🌐 ブラウザで認証ページを開いています...');
    } catch (error) {
        console.log('⚠️ ブラウザの自動起動に失敗しました。上記URLを手動でコピーしてください。');
    }
});

// エラーハンドリング
server.on('error', (error) => {
    if (error.code === 'EADDRINUSE') {
        console.error(`❌ ポート${PORT}は既に使用中です。他のアプリケーションを終了してから再度お試しください。`);
    } else {
        console.error('❌ サーバーエラー:', error);
    }
    process.exit(1);
});

function getTokens(authCode) {
    const credentials = Buffer.from(`${CLIENT_ID}:${CLIENT_SECRET}`).toString('base64');

    const postData = new URLSearchParams({
        grant_type: 'authorization_code',
        code: authCode,
        redirect_uri: REDIRECT_URI
    }).toString();

    const options = {
        hostname: 'accounts.spotify.com',
        port: 443,
        path: '/api/token',
        method: 'POST',
        headers: {
            'Authorization': `Basic ${credentials}`,
            'Content-Type': 'application/x-www-form-urlencoded',
            'Content-Length': Buffer.byteLength(postData)
        }
    };

    console.log('🔄 トークンを取得中...');

    const req = https.request(options, (res) => {
        let data = '';

        res.on('data', (chunk) => {
            data += chunk;
        });

        res.on('end', () => {
            try {
                const response = JSON.parse(data);

                if (response.error) {
                    console.error('❌ Spotify APIエラー:', response.error_description || response.error);
                    console.error('🔍 詳細情報:', {
                        error: response.error,
                        error_description: response.error_description,
                        client_id: CLIENT_ID,
                        redirect_uri: REDIRECT_URI
                    });

                    if (response.error === 'invalid_client') {
                        console.log('\n💡 解決方法:');
                        console.log('1. Spotify Developer Dashboard (https://developer.spotify.com/dashboard) にアクセス');
                        console.log('2. アプリを選択 > Settings をクリック');
                        console.log('3. Redirect URIs に以下を正確に追加:');
                        console.log(`   ${REDIRECT_URI}`);
                        console.log('4. 保存してから再度お試しください');
                    }

                    server.close();
                    return;
                }

                console.log('\n✅ トークンの取得に成功しました!\n');
                console.log('📋 以下の値を.envファイルに追加してください:\n');
                console.log(`SPOTIFY_REFRESH_TOKEN=${response.refresh_token}`);
                console.log(`# SPOTIFY_ACCESS_TOKEN=${response.access_token} (自動更新されるため設定不要)`);
                console.log(`# トークン有効期限: ${response.expires_in}秒\n`);

                console.log('🎯 .envファイルの完全な設定例:');
                console.log('SPOTIFY_ENABLED=true');
                console.log(`SPOTIFY_CLIENT_ID=${CLIENT_ID}`);
                console.log(`SPOTIFY_CLIENT_SECRET=${CLIENT_SECRET}`);
                console.log(`SPOTIFY_REFRESH_TOKEN=${response.refresh_token}`);

                server.close();
                console.log('\n🎉 完了！サーバーを停止しました。');
            } catch (error) {
                console.error('❌ レスポンス解析エラー:', error.message);
                console.error('レスポンス:', data);
                server.close();
            }
        });
    });

    req.on('error', (error) => {
        console.error('❌ リクエストエラー:', error.message);
        server.close();
    });

    req.write(postData);
    req.end();
}

// Ctrl+Cでの終了処理
process.on('SIGINT', () => {
    console.log('\n\n🛑 処理を中断しました');
    server.close(() => {
        console.log('� サーバーを停止しました');
        process.exit(0);
    });
});
