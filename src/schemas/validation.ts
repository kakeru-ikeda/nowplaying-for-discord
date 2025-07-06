/**
 * 踏み台サーバーAPIのバリデーションスキーマとユーティリティ関数
 */

import { ApiErrorCode } from './api';

// =============================================================================
// バリデーション関数
// =============================================================================

/**
 * 文字列かどうかをチェック
 */
function isString(value: any): value is string {
  return typeof value === 'string';
}

/**
 * 数値かどうかをチェック
 */
function isNumber(value: any): value is number {
  return typeof value === 'number' && !isNaN(value);
}

/**
 * ブール値かどうかをチェック
 */
function isBoolean(value: any): value is boolean {
  return typeof value === 'boolean';
}

/**
 * 配列かどうかをチェック
 */
function isArray(value: any): value is any[] {
  return Array.isArray(value);
}

/**
 * オブジェクトかどうかをチェック
 */
function isObject(value: any): value is Record<string, any> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

/**
 * URLかどうかをチェック
 */
function isValidUrl(value: string): boolean {
  try {
    new URL(value);
    return true;
  } catch {
    return false;
  }
}

/**
 * 日付形式（YYYY-MM-DD）かどうかをチェック
 */
function isValidDate(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

/**
 * ISO 8601形式の日時かどうかをチェック
 */
function isValidDateTime(value: string): boolean {
  const date = new Date(value);
  return !isNaN(date.getTime()) && value.includes('T');
}

/**
 * ナウプレイング情報をバリデート
 */
export function validateNowPlayingInfo(data: any): {
  success: boolean;
  data?: any;
  error?: string;
} {
  if (!isObject(data)) {
    return { success: false, error: 'Data must be an object' };
  }

  if (!isString(data.artist)) {
    return { success: false, error: 'artist must be a string' };
  }

  if (!isString(data.track)) {
    return { success: false, error: 'track must be a string' };
  }

  if (!isBoolean(data.isPlaying)) {
    return { success: false, error: 'isPlaying must be a boolean' };
  }

  if (data.album !== undefined && !isString(data.album)) {
    return { success: false, error: 'album must be a string if provided' };
  }

  if (data.imageUrl !== undefined && (!isString(data.imageUrl) || !isValidUrl(data.imageUrl))) {
    return { success: false, error: 'imageUrl must be a valid URL if provided' };
  }

  return { success: true, data };
}

/**
 * 聴取推移データをバリデート
 */
export function validateListeningTrendData(data: any): {
  success: boolean;
  data?: any;
  error?: string;
} {
  if (!isObject(data)) {
    return { success: false, error: 'Data must be an object' };
  }

  if (!isString(data.date) || !isValidDate(data.date)) {
    return { success: false, error: 'date must be in YYYY-MM-DD format' };
  }

  if (!isNumber(data.scrobbles) || data.scrobbles < 0 || !Number.isInteger(data.scrobbles)) {
    return { success: false, error: 'scrobbles must be a non-negative integer' };
  }

  if (!isString(data.label) || data.label.trim().length === 0) {
    return { success: false, error: 'label must be a non-empty string' };
  }

  return { success: true, data };
}

/**
 * 音楽レポートをバリデート
 */
export function validateMusicReport(data: any): {
  success: boolean;
  data?: any;
  error?: string;
} {
  if (!isObject(data)) {
    return { success: false, error: 'Data must be an object' };
  }

  if (!['daily', 'weekly', 'monthly'].includes(data.period)) {
    return { success: false, error: 'period must be daily, weekly, or monthly' };
  }

  if (!isArray(data.topTracks)) {
    return { success: false, error: 'topTracks must be an array' };
  }

  if (!isArray(data.topArtists)) {
    return { success: false, error: 'topArtists must be an array' };
  }

  if (!isArray(data.topAlbums)) {
    return { success: false, error: 'topAlbums must be an array' };
  }

  if (!isString(data.username) || data.username.trim().length === 0) {
    return { success: false, error: 'username must be a non-empty string' };
  }

  if (!isObject(data.dateRange) || !isString(data.dateRange.start) || !isString(data.dateRange.end)) {
    return { success: false, error: 'dateRange must have start and end string properties' };
  }

  if (!isArray(data.listeningTrends)) {
    return { success: false, error: 'listeningTrends must be an array' };
  }

  // 聴取推移データの各項目をバリデート
  for (let i = 0; i < data.listeningTrends.length; i++) {
    const trendValidation = validateListeningTrendData(data.listeningTrends[i]);
    if (!trendValidation.success) {
      return { 
        success: false, 
        error: `listeningTrends[${i}]: ${trendValidation.error}` 
      };
    }
  }

  return { success: true, data };
}

/**
 * WebSocketメッセージをバリデート
 */
export function validateWebSocketMessage(data: any): {
  success: boolean;
  data?: any;
  error?: string;
} {
  if (!isObject(data)) {
    return { success: false, error: 'Message must be an object' };
  }

  const validTypes = ['now-playing', 'report-update', 'connection-status', 'error', 'ping', 'pong'];
  if (!isString(data.type) || !validTypes.includes(data.type)) {
    return { success: false, error: `type must be one of: ${validTypes.join(', ')}` };
  }

  if (data.data === undefined) {
    return { success: false, error: 'data property is required' };
  }

  if (!isString(data.timestamp) || !isValidDateTime(data.timestamp)) {
    return { success: false, error: 'timestamp must be a valid ISO 8601 datetime' };
  }

  if (data.id !== undefined && !isString(data.id)) {
    return { success: false, error: 'id must be a string if provided' };
  }

  return { success: true, data };
}

/**
 * クライアントWebSocketメッセージをバリデート
 */
export function validateClientWebSocketMessage(data: any): {
  success: boolean;
  data?: any;
  error?: string;
} {
  if (!isObject(data)) {
    return { success: false, error: 'Message must be an object' };
  }

  const validTypes = ['subscribe', 'unsubscribe', 'ping', 'request-status'];
  if (!isString(data.type) || !validTypes.includes(data.type)) {
    return { success: false, error: `type must be one of: ${validTypes.join(', ')}` };
  }

  if (!isObject(data.data)) {
    return { success: false, error: 'data must be an object' };
  }

  if (data.data.topics !== undefined && !isArray(data.data.topics)) {
    return { success: false, error: 'data.topics must be an array if provided' };
  }

  if (data.data.clientInfo !== undefined && !isObject(data.data.clientInfo)) {
    return { success: false, error: 'data.clientInfo must be an object if provided' };
  }

  if (!isString(data.timestamp) || !isValidDateTime(data.timestamp)) {
    return { success: false, error: 'timestamp must be a valid ISO 8601 datetime' };
  }

  return { success: true, data };
}

/**
 * レポートクエリパラメータをバリデート
 */
export function validateReportQueryParams(data: any): {
  success: boolean;
  data?: any;
  error?: string;
} {
  if (!isObject(data)) {
    return { success: false, error: 'Query parameters must be an object' };
  }

  if (data.period !== undefined && !['daily', 'weekly', 'monthly'].includes(data.period)) {
    return { success: false, error: 'period must be daily, weekly, or monthly if provided' };
  }

  if (data.format !== undefined && !['json', 'summary'].includes(data.format)) {
    return { success: false, error: 'format must be json or summary if provided' };
  }

  if (data.includeCharts !== undefined && !isBoolean(data.includeCharts)) {
    return { success: false, error: 'includeCharts must be a boolean if provided' };
  }

  return { success: true, data };
}

// =============================================================================
// レスポンス生成ユーティリティ
// =============================================================================

/**
 * 成功レスポンスを生成
 */
export function createSuccessResponse<T>(data: T): {
  success: true;
  data: T;
  timestamp: string;
} {
  return {
    success: true,
    data,
    timestamp: new Date().toISOString(),
  };
}

/**
 * エラーレスポンスを生成
 */
export function createErrorResponse(
  error: string,
  code?: ApiErrorCode,
  details?: any
): {
  success: false;
  error: string;
  code?: ApiErrorCode;
  details?: any;
  timestamp: string;
} {
  return {
    success: false,
    error,
    code,
    details,
    timestamp: new Date().toISOString(),
  };
}

/**
 * WebSocketメッセージを生成
 */
export function createWebSocketMessage<T>(
  type: string,
  data: T,
  id?: string
): {
  type: string;
  data: T;
  timestamp: string;
  id?: string;
} {
  return {
    type,
    data,
    timestamp: new Date().toISOString(),
    ...(id && { id }),
  };
}

// =============================================================================
// サニタイゼーション関数
// =============================================================================

/**
 * HTMLエスケープ
 */
export function escapeHtml(text: string): string {
  const map: { [key: string]: string } = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;'
  };
  return text.replace(/[&<>"']/g, (m) => map[m]);
}

/**
 * SQLインジェクション対策（基本的なサニタイゼーション）
 */
export function sanitizeInput(input: string): string {
  return input
    .replace(/['"\\]/g, '') // クォートとバックスラッシュを除去
    .trim()
    .substring(0, 1000); // 最大1000文字に制限
}

/**
 * ファイル名をサニタイズ
 */
export function sanitizeFilename(filename: string): string {
  return filename
    .replace(/[^a-zA-Z0-9._-]/g, '_') // 安全でない文字をアンダースコアに置換
    .replace(/_{2,}/g, '_') // 連続するアンダースコアを一つに
    .substring(0, 255); // ファイル名の長さ制限
}

// =============================================================================
// パフォーマンス監視
// =============================================================================

/**
 * APIレスポンス時間を測定するデコレータ
 */
export function measureResponseTime() {
  return function (target: any, propertyName: string, descriptor: PropertyDescriptor) {
    const method = descriptor.value;
    
    descriptor.value = async function (...args: any[]) {
      const start = Date.now();
      try {
        const result = await method.apply(this, args);
        const duration = Date.now() - start;
        console.log(`⏱️ ${propertyName}: ${duration}ms`);
        return result;
      } catch (error) {
        const duration = Date.now() - start;
        console.log(`⏱️ ${propertyName} (エラー): ${duration}ms`);
        throw error;
      }
    };
  };
}

/**
 * レート制限チェック
 */
export class RateLimiter {
  private requests: Map<string, number[]> = new Map();
  
  constructor(
    private maxRequests: number = 100,
    private windowMs: number = 60000 // 1分
  ) {}
  
  /**
   * レート制限をチェック
   */
  checkRateLimit(clientId: string): boolean {
    const now = Date.now();
    const clientRequests = this.requests.get(clientId) || [];
    
    // ウィンドウ外のリクエストを削除
    const validRequests = clientRequests.filter(
      timestamp => now - timestamp < this.windowMs
    );
    
    if (validRequests.length >= this.maxRequests) {
      return false; // レート制限に引っかかった
    }
    
    validRequests.push(now);
    this.requests.set(clientId, validRequests);
    return true;
  }
  
  /**
   * クライアントの統計を取得
   */
  getClientStats(clientId: string): {
    requestCount: number;
    remainingRequests: number;
    resetTime: number;
  } {
    const now = Date.now();
    const clientRequests = this.requests.get(clientId) || [];
    const validRequests = clientRequests.filter(
      timestamp => now - timestamp < this.windowMs
    );
    
    return {
      requestCount: validRequests.length,
      remainingRequests: Math.max(0, this.maxRequests - validRequests.length),
      resetTime: validRequests.length > 0 ? 
        Math.min(...validRequests) + this.windowMs : 
        now + this.windowMs,
    };
  }
}
