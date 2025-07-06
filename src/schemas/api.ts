/**
 * 踏み台サーバー（WebServerService）のAPIスキーマ定義
 * APIレスポンス、WebSocketメッセージ、リクエスト/レスポンスの型定義
 */

import { NowPlayingInfo, MusicReport } from '../types';

// =============================================================================
// 基本レスポンス型
// =============================================================================

/**
 * 基本APIレスポンス
 */
export interface BaseApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  timestamp: string;
}

/**
 * ヘルスチェックレスポンス
 */
export interface HealthCheckResponse {
  status: 'ok' | 'error';
  timestamp: string;
  uptime: number;
  version?: string;
  services?: {
    lastfm: boolean;
    discord: boolean;
    websocket: boolean;
  };
}

// =============================================================================
// ナウプレイング関連
// =============================================================================

/**
 * ナウプレイングAPIレスポンス
 */
export interface NowPlayingApiResponse extends BaseApiResponse<NowPlayingInfo> {}

// =============================================================================
// レポート関連
// =============================================================================

/**
 * 音楽レポートAPIレスポンス（グラフなし）
 */
export interface MusicReportApiResponse extends BaseApiResponse<MusicReport> {}

/**
 * レポート期間タイプ
 */
export type ReportPeriod = 'daily' | 'weekly' | 'monthly';

/**
 * レポートクエリパラメータ
 */
export interface ReportQueryParams {
  period?: ReportPeriod;
  format?: 'json' | 'summary';
  includeCharts?: boolean;
}

// =============================================================================
// WebSocket関連
// =============================================================================

/**
 * WebSocketメッセージの基本型
 */
export interface BaseWebSocketMessage<T = any> {
  type: string;
  data: T;
  timestamp: string;
  id?: string;
}

/**
 * WebSocketメッセージタイプ
 */
export type WebSocketMessageType = 
  | 'now-playing'
  | 'report-update'
  | 'connection-status'
  | 'error'
  | 'ping'
  | 'pong';

/**
 * ナウプレイング更新メッセージ
 */
export interface NowPlayingWebSocketMessage extends BaseWebSocketMessage<NowPlayingInfo> {
  type: 'now-playing';
}

/**
 * レポート更新通知メッセージ
 */
export interface ReportUpdateWebSocketMessage extends BaseWebSocketMessage<{
  period: ReportPeriod;
  status: 'generating' | 'completed' | 'failed';
  message?: string;
}> {
  type: 'report-update';
}

/**
 * 接続ステータスメッセージ
 */
export interface ConnectionStatusWebSocketMessage extends BaseWebSocketMessage<{
  status: 'connected' | 'disconnected';
  clientCount: number;
  clientId: string;
}> {
  type: 'connection-status';
}

/**
 * エラーメッセージ
 */
export interface ErrorWebSocketMessage extends BaseWebSocketMessage<{
  code: string;
  message: string;
  details?: any;
}> {
  type: 'error';
}

/**
 * Pingメッセージ
 */
export interface PingWebSocketMessage extends BaseWebSocketMessage<{}> {
  type: 'ping';
}

/**
 * Pongメッセージ
 */
export interface PongWebSocketMessage extends BaseWebSocketMessage<{
  originalTimestamp: string;
}> {
  type: 'pong';
}

/**
 * 全WebSocketメッセージの統合型
 */
export type WebSocketMessage = 
  | NowPlayingWebSocketMessage
  | ReportUpdateWebSocketMessage
  | ConnectionStatusWebSocketMessage
  | ErrorWebSocketMessage
  | PingWebSocketMessage
  | PongWebSocketMessage;

// =============================================================================
// クライアント→サーバー メッセージ
// =============================================================================

/**
 * クライアントからのWebSocketメッセージ
 */
export interface ClientWebSocketMessage extends BaseWebSocketMessage {
  type: 'subscribe' | 'unsubscribe' | 'ping' | 'request-status';
  data: {
    topics?: string[];
    clientInfo?: {
      userAgent?: string;
      platform?: string;
      version?: string;
    };
  };
}

// =============================================================================
// エラーコード定義
// =============================================================================

/**
 * APIエラーコード
 */
export enum ApiErrorCode {
  // 一般的なエラー
  INTERNAL_ERROR = 'INTERNAL_ERROR',
  INVALID_REQUEST = 'INVALID_REQUEST',
  
  // Last.fm関連エラー
  LASTFM_API_ERROR = 'LASTFM_API_ERROR',
  LASTFM_NOT_PLAYING = 'LASTFM_NOT_PLAYING',
  
  // レポート関連エラー
  REPORT_GENERATION_FAILED = 'REPORT_GENERATION_FAILED',
  CHART_GENERATION_FAILED = 'CHART_GENERATION_FAILED',
  
  // WebSocket関連エラー
  WEBSOCKET_CONNECTION_FAILED = 'WEBSOCKET_CONNECTION_FAILED',
  WEBSOCKET_MESSAGE_INVALID = 'WEBSOCKET_MESSAGE_INVALID',
}

/**
 * エラーレスポンス
 */
export interface ApiErrorResponse extends BaseApiResponse {
  success: false;
  error: string;
  code?: ApiErrorCode;
  details?: any;
}

// =============================================================================
// 統計情報
// =============================================================================

/**
 * サーバー統計情報
 */
export interface ServerStats {
  uptime: number;
  totalRequests: number;
  activeConnections: number;
  lastfmApiCalls: number;
  reportsGenerated: number;
  lastReportTime?: string;
  memoryUsage: {
    used: number;
    total: number;
    percentage: number;
  };
}

/**
 * 統計情報APIレスポンス
 */
export interface StatsApiResponse extends BaseApiResponse<ServerStats> {}

// =============================================================================
// 型ガード関数
// =============================================================================

/**
 * WebSocketメッセージの型ガード
 */
export function isWebSocketMessage(obj: any): obj is WebSocketMessage {
  return obj && 
    typeof obj.type === 'string' && 
    typeof obj.timestamp === 'string' &&
    obj.data !== undefined;
}

/**
 * ナウプレイングメッセージの型ガード
 */
export function isNowPlayingMessage(msg: WebSocketMessage): msg is NowPlayingWebSocketMessage {
  return msg.type === 'now-playing';
}

/**
 * レポート更新メッセージの型ガード
 */
export function isReportUpdateMessage(msg: WebSocketMessage): msg is ReportUpdateWebSocketMessage {
  return msg.type === 'report-update';
}

/**
 * エラーメッセージの型ガード
 */
export function isErrorMessage(msg: WebSocketMessage): msg is ErrorWebSocketMessage {
  return msg.type === 'error';
}
