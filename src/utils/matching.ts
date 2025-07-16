/**
 * Spotify検索結果とのマッチング精度計算
 */
export class MatchingUtils {
  /**
   * 文字列類似度計算（レーベンシュタイン距離）
   * @param str1 比較文字列1
   * @param str2 比較文字列2
   * @returns 類似度（0-1）
   */
  static calculateSimilarity(str1: string, str2: string): number {
    if (!str1 || !str2) return 0;
    
    const matrix: number[][] = [];
    const len1 = str1.length;
    const len2 = str2.length;

    // 空文字列の場合の処理
    if (len1 === 0) return len2 === 0 ? 1 : 0;
    if (len2 === 0) return 0;

    // 行列の初期化
    for (let i = 0; i <= len2; i++) {
      matrix[i] = [i];
    }

    for (let j = 0; j <= len1; j++) {
      matrix[0][j] = j;
    }

    // 動的プログラミングでレーベンシュタイン距離を計算
    for (let i = 1; i <= len2; i++) {
      for (let j = 1; j <= len1; j++) {
        if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
          matrix[i][j] = matrix[i - 1][j - 1];
        } else {
          matrix[i][j] = Math.min(
            matrix[i - 1][j - 1] + 1, // 置換
            matrix[i][j - 1] + 1,     // 挿入
            matrix[i - 1][j] + 1      // 削除
          );
        }
      }
    }

    const maxLength = Math.max(len1, len2);
    return maxLength === 0 ? 1 : (maxLength - matrix[len2][len1]) / maxLength;
  }

  /**
   * 文字列の正規化（マッチング用）
   * @param str 正規化対象の文字列
   * @returns 正規化された文字列
   */
  static normalizeString(str: string): string {
    return str
      .toLowerCase()
      .normalize('NFD')        // Unicode正規化
      .replace(/[\u0300-\u036f]/g, '') // 結合文字除去
      .replace(/[^\w\s\u3040-\u309f\u30a0-\u30ff\u4e00-\u9faf]/g, '') // 英数字、ひらがな、カタカナ、漢字のみ残す
      .replace(/\s+/g, ' ')    // 連続空白を単一空白に
      .trim();
  }

  /**
   * 楽曲マッチング精度計算（楽曲名重視の単純マッチング）
   * @param spotifyTrack Spotify楽曲情報
   * @param targetTrack 対象楽曲名
   * @param targetArtist 対象アーティスト名
   * @param targetAlbum 対象アルバム名（オプション）
   * @returns マッチング精度（0-1）
   */
  static calculateTrackMatchScore(
    spotifyTrack: any,
    targetTrack: string,
    targetArtist: string,
    targetAlbum?: string
  ): number {
    // 楽曲名の類似度を主要な判定基準とする
    const trackScore = this.calculateSimilarity(
      this.normalizeString(spotifyTrack.name),
      this.normalizeString(targetTrack)
    );
    
    // アーティスト名の類似度も参考にする
    const artistScore = Math.max(
      ...spotifyTrack.artists.map((artist: any) => 
        this.calculateSimilarity(
          this.normalizeString(artist.name),
          this.normalizeString(targetArtist)
        )
      )
    );
    
    // 楽曲名マッチングを最重要視（80%）、アーティスト名は参考程度（20%）
    const finalScore = (trackScore * 0.8) + (artistScore * 0.2);
    
    return finalScore;
  }

  /**
   * アーティストマッチング精度計算
   * @param spotifyArtist Spotifyアーティスト情報
   * @param targetArtist 対象アーティスト名
   * @returns マッチング精度（0-1）
   */
  static calculateArtistMatchScore(
    spotifyArtist: any,
    targetArtist: string
  ): number {
    return this.calculateSimilarity(
      this.normalizeString(spotifyArtist.name),
      this.normalizeString(targetArtist)
    );
  }

  /**
   * 複数の候補から最適なマッチを選択（最上位スコアを採用）
   * @param candidates 候補の配列
   * @param scoreCalculator スコア計算関数
   * @param threshold 最低スコア閾値（デフォルト: 0.1）
   * @returns 最適なマッチ、またはnull
   */
  static findBestMatch<T>(
    candidates: T[],
    scoreCalculator: (candidate: T) => number,
    threshold: number = 0.1
  ): { match: T; score: number } | null {
    if (candidates.length === 0) return null;

    let bestMatch: T | null = null;
    let bestScore = 0;

    // 単純に最高スコアを取得
    for (const candidate of candidates) {
      const score = scoreCalculator(candidate);
      if (score > bestScore) {
        bestScore = score;
        bestMatch = candidate;
      }
    }

    // 最低閾値を満たしている場合のみ返す
    return bestMatch && bestScore >= threshold ? { match: bestMatch, score: bestScore } : null;
  }
}
