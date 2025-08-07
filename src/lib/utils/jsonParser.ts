/**
 * JSON解析ユーティリティ
 * Gemini APIが返すマークダウン形式のJSONを適切に解析
 */

export function parseJsonFromResponse(response: string): any {
  try {
    // 1. 直接JSON解析を試行
    return JSON.parse(response);
  } catch (firstError) {
    try {
      // 2. マークダウンのコードブロックを除去（改良版）
      let cleanedResponse = response
        .replace(/```json\s*/gi, '')
        .replace(/```\s*/g, '')
        .replace(/^[\s\n\r]+|[\s\n\r]+$/g, '') // 前後の空白・改行除去
        .trim();
      
      return JSON.parse(cleanedResponse);
    } catch (secondError) {
      try {
        // 3. より積極的なクリーニング
        let normalizedResponse = response
          .replace(/```json\s*/gi, '')
          .replace(/```\s*/g, '')
          .replace(/^\s*[\r\n]+/gm, '') // 空行除去
          .replace(/\s+$/gm, '') // 行末空白除去
          .replace(/([^\\])`/g, '$1') // エスケープされていないバッククォートを除去
          .trim();
        
        return JSON.parse(normalizedResponse);
      } catch (thirdError) {
        try {
          // 4. 最も外側の {} を探してバランスの取れたJSONを抽出
          const jsonStart = response.indexOf('{');
          if (jsonStart !== -1) {
            let braceCount = 0;
            let jsonEnd = jsonStart;
            
            for (let i = jsonStart; i < response.length; i++) {
              if (response[i] === '{') braceCount++;
              if (response[i] === '}') braceCount--;
              if (braceCount === 0) {
                jsonEnd = i;
                break;
              }
            }
            
            if (braceCount === 0) {
              const extractedJson = response.substring(jsonStart, jsonEnd + 1);
              return JSON.parse(extractedJson);
            }
          }
          
          // 5. 配列の場合も同様に処理
          const arrayStart = response.indexOf('[');
          if (arrayStart !== -1) {
            let bracketCount = 0;
            let arrayEnd = arrayStart;
            
            for (let i = arrayStart; i < response.length; i++) {
              if (response[i] === '[') bracketCount++;
              if (response[i] === ']') bracketCount--;
              if (bracketCount === 0) {
                arrayEnd = i;
                break;
              }
            }
            
            if (bracketCount === 0) {
              const extractedArray = response.substring(arrayStart, arrayEnd + 1);
              return JSON.parse(extractedArray);
            }
          }
          
          throw new Error('No valid JSON found in response');
        } catch (fourthError) {
          // 5. より詳細なエラー情報を提供
          console.error('Failed to parse JSON response:', {
            originalResponse: response.substring(0, 1000) + (response.length > 1000 ? '...' : ''),
            responseLength: response.length,
            hasJsonStart: response.includes('{'),
            hasArrayStart: response.includes('['),
            hasCodeBlock: response.includes('```'),
            errors: [
              (firstError as Error).message,
              (secondError as Error).message,
              (thirdError as Error).message,
              (fourthError as Error).message
            ]
          });
          
          // 6. 最後の手段：基本的な値を返す
          return {
            error: 'JSON parsing failed',
            originalResponse: response.substring(0, 500) + (response.length > 500 ? '...' : ''),
            fallbackUsed: true
          };
        }
      }
    }
  }
}

/**
 * JSON解析の安全なラッパー
 * デフォルト値を提供し、エラーを適切に処理
 */
export function safeJsonParse<T>(response: string, defaultValue: T): T {
  try {
    const parsed = parseJsonFromResponse(response);
    
    // フォールバックが使用された場合はデフォルト値を返す
    if (parsed && parsed.fallbackUsed) {
      return defaultValue;
    }
    
    return parsed as T;
  } catch (error) {
    console.warn('Safe JSON parse failed, using default value:', error);
    return defaultValue;
  }
}

/**
 * 特定のフィールドに対するフォールバック値を持つ安全な解析
 */
export function parseWithFallbacks<T>(
  response: string,
  fallbacks: Partial<T>
): T {
  try {
    const parsed = parseJsonFromResponse(response);
    
    // 解析されたオブジェクトとフォールバックをマージ
    return {
      ...fallbacks,
      ...parsed
    } as T;
  } catch (error) {
    console.warn('JSON parse with fallbacks failed, using fallback values:', error);
    return fallbacks as T;
  }
}

/**
 * 配列を期待する場合の安全な解析
 */
export function parseArraySafely<T>(response: string, defaultArray: T[] = []): T[] {
  try {
    const parsed = parseJsonFromResponse(response);
    
    if (Array.isArray(parsed)) {
      return parsed;
    }
    
    // オブジェクトの場合、値が配列かチェック
    if (typeof parsed === 'object' && parsed !== null) {
      for (const value of Object.values(parsed)) {
        if (Array.isArray(value)) {
          return value;
        }
      }
    }
    
    return defaultArray;
  } catch (error) {
    console.warn('Array parsing failed, using default array:', error);
    return defaultArray;
  }
}

/**
 * レスポンスにJSONが含まれているかチェック
 */
export function containsJson(response: string): boolean {
  // JSON開始文字の存在をチェック
  const hasJsonStart = response.includes('{') || response.includes('[');
  
  // マークダウンコードブロックの存在をチェック
  const hasCodeBlock = response.includes('```json') || response.includes('```');
  
  return hasJsonStart || hasCodeBlock;
}

/**
 * デバッグ用：解析失敗時の詳細情報を提供
 */
export function debugJsonParse(response: string): {
  success: boolean;
  parsed?: any;
  errors: string[];
  cleanedResponse: string;
} {
  const errors: string[] = [];
  let parsed: any = null;
  let success = false;
  
  const cleanedResponse = response
    .replace(/```json\s*/gi, '')
    .replace(/```\s*/g, '')
    .trim();
  
  try {
    parsed = JSON.parse(response);
    success = true;
  } catch (error) {
    errors.push(`Direct parse: ${(error as Error).message}`);
  }
  
  if (!success) {
    try {
      parsed = JSON.parse(cleanedResponse);
      success = true;
    } catch (error) {
      errors.push(`Cleaned parse: ${(error as Error).message}`);
    }
  }
  
  return {
    success,
    parsed,
    errors,
    cleanedResponse
  };
}