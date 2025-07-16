/**
 * Last.fm画像のプレースホルダー判定ユーティリティ
 */
export class ImageDetectionUtils {
  // 既知のプレースホルダーハッシュ
  private static readonly PLACEHOLDER_HASHES = [
    '2a96cbd8b46e442fc41c2b86b821562f', // 一般的なプレースホルダー
    '4128a6eb29f94943c9d206c08e625904', // アーティスト用
    'c6f59c1e5e7240a4c0d427abd71f3dbb', // アルバム用
  ];

  /**
   * プレースホルダー画像かどうかを判定
   * @param imageUrl 画像URL
   * @returns プレースホルダーの場合true
   */
  static isPlaceholderImage(imageUrl: string): boolean {
    if (!imageUrl) return true;
    
    // Last.fm CDN URLかチェック
    if (imageUrl.includes('lastfm.freetls.fastly.net')) {
      // ハッシュ部分を抽出（32文字の16進数）
      const hashMatch = imageUrl.match(/\/([a-f0-9]{32})\./);
      if (hashMatch) {
        const hash = hashMatch[1];
        return this.PLACEHOLDER_HASHES.includes(hash);
      }
    }
    
    return false;
  }

  /**
   * 画像品質を評価
   * @param imageUrl 画像URL
   * @returns 品質レベル
   */
  static async assessImageQuality(imageUrl: string): Promise<'low' | 'medium' | 'high'> {
    if (!imageUrl || this.isPlaceholderImage(imageUrl)) {
      return 'low';
    }

    try {
      // HEAD リクエストでファイルサイズを取得
      const response = await fetch(imageUrl, { 
        method: 'HEAD',
        // @ts-ignore - Node.js環境でのtimeout
        timeout: 3000
      });
      
      const contentLength = response.headers.get('content-length');
      
      if (contentLength) {
        const size = parseInt(contentLength);
        if (size < 5000) return 'low';        // 5KB未満
        if (size < 50000) return 'medium';    // 50KB未満
        return 'high';                        // 50KB以上
      }
    } catch (error) {
      console.warn('⚠️ 画像品質評価エラー:', error);
    }

    return 'medium'; // デフォルト
  }

  /**
   * 画像解像度を推定
   * @param imageUrl 画像URL
   * @returns 推定解像度
   */
  static estimateResolution(imageUrl: string): { width: number; height: number } | null {
    if (!imageUrl) return null;

    // Last.fm URLから解像度を抽出
    const resolutionMatch = imageUrl.match(/\/(\d+)x(\d+)\//);
    if (resolutionMatch) {
      return {
        width: parseInt(resolutionMatch[1]),
        height: parseInt(resolutionMatch[2])
      };
    }

    return null;
  }
}
