/**
 * CORS設定管理
 * 開発環境と本番環境で異なるオリジンを管理
 */

import fs from 'fs';
import path from 'path';

export interface CorsOrigin {
    protocol: 'http' | 'https';
    hostname: string;
    port?: number;
}

export interface CorsConfig {
    development: CorsOrigin[];
    production: CorsOrigin[];
    credentials: boolean;
}

/**
 * デフォルトのCORS設定
 */
export const defaultCorsConfig: CorsConfig = {
    development: [
        { protocol: 'http', hostname: 'localhost' },
        { protocol: 'http', hostname: 'localhost', port: 3000 },
        { protocol: 'http', hostname: 'localhost', port: 3001 },
        { protocol: 'http', hostname: 'localhost', port: 8000 },
        { protocol: 'https', hostname: 'localhost' },
        { protocol: 'https', hostname: 'localhost', port: 8000 },
        { protocol: 'https', hostname: 'localhost', port: 8443 },
        { protocol: 'https', hostname: 'localhost', port: 8444 },
    ],
    production: [
        // 本番環境のオリジンをここに追加
        // 例: { protocol: 'https', hostname: 'yourdomain.com' }
    ],
    credentials: true
};

/**
 * CorsOriginからURL文字列を生成
 */
export function corsOriginToUrl(origin: CorsOrigin): string {
    const port = origin.port ? `:${origin.port}` : '';
    return `${origin.protocol}://${origin.hostname}${port}`;
}

/**
 * 環境に応じたCORSオリジンリストを取得
 */
export function getCorsOrigins(environment: 'development' | 'production' = 'development'): string[] {
    try {
        const config = getActiveCorsConfig();
        const origins = config[environment];
        return origins.map(corsOriginToUrl);
    } catch (error) {
        console.warn('⚠️ CORS設定の取得に失敗しました。デフォルト設定を使用します:', error);
        // フォールバック：デフォルト設定を直接使用
        return defaultCorsConfig[environment].map(corsOriginToUrl);
    }
}

/**
 * Express CORS設定オブジェクトを取得
 */
export function getExpressCorsOptions(environment: 'development' | 'production' = 'development') {
    try {
        const config = getActiveCorsConfig();
        return {
            origin: getCorsOrigins(environment),
            credentials: config.credentials
        };
    } catch (error) {
        console.warn('⚠️ CORS設定の取得に失敗しました。デフォルト設定を使用します:', error);
        // フォールバック：デフォルト設定を直接使用
        const origins = defaultCorsConfig[environment].map(corsOriginToUrl);
        return {
            origin: origins,
            credentials: defaultCorsConfig.credentials
        };
    }
}

/**
 * JSONファイルからCORS設定を読み込み
 */
export function loadCorsConfigFromFile(filePath?: string): CorsConfig {
    const configPath = filePath || path.join(process.cwd(), 'src/config/cors.json');
    
    try {
        if (fs.existsSync(configPath)) {
            const fileContent = fs.readFileSync(configPath, 'utf-8');
            const parsedConfig = JSON.parse(fileContent) as CorsConfig;
            
            // 設定の妥当性をチェック
            if (validateCorsConfig(parsedConfig)) {
                console.log(`✅ CORS設定を読み込みました: ${configPath}`);
                return parsedConfig;
            } else {
                console.warn(`⚠️ CORS設定ファイルの形式が無効です: ${configPath}`);
                console.warn(`⚠️ デフォルト設定を使用します`);
            }
        } else {
            console.log(`ℹ️ CORS設定ファイルが見つかりません: ${configPath}`);
            console.log(`ℹ️ デフォルト設定を使用します`);
        }
    } catch (error) {
        console.error(`❌ CORS設定ファイルの読み込みに失敗しました: ${configPath}`, error);
        console.log(`ℹ️ デフォルト設定を使用します`);
    }
    
    return defaultCorsConfig;
}

/**
 * CORS設定の妥当性をチェック
 */
function validateCorsConfig(config: any): config is CorsConfig {
    if (!config || typeof config !== 'object') {
        return false;
    }
    
    if (!Array.isArray(config.development) || !Array.isArray(config.production)) {
        return false;
    }
    
    if (typeof config.credentials !== 'boolean') {
        return false;
    }
    
    // オリジン設定の妥当性をチェック
    const isValidOrigin = (origin: any): origin is CorsOrigin => {
        return (
            origin &&
            typeof origin === 'object' &&
            ['http', 'https'].includes(origin.protocol) &&
            typeof origin.hostname === 'string' &&
            origin.hostname.length > 0 &&
            (origin.port === undefined || (typeof origin.port === 'number' && origin.port > 0 && origin.port < 65536))
        );
    };
    
    const allOriginsValid = [
        ...config.development,
        ...config.production
    ].every(isValidOrigin);
    
    return allOriginsValid;
}

// アクティブな設定（実行時に読み込まれる）
let activeCorsConfig: CorsConfig | null = null;

/**
 * アクティブなCORS設定を取得（初回読み込み時にファイルから読み込み）
 */
export function getActiveCorsConfig(): CorsConfig {
    if (!activeCorsConfig) {
        activeCorsConfig = loadCorsConfigFromFile();
    }
    return activeCorsConfig;
}

/**
 * アクティブなCORS設定を更新
 */
export function setActiveCorsConfig(config: CorsConfig): void {
    activeCorsConfig = config;
}

