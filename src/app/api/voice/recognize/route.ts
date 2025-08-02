import { NextRequest, NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import RedisService from '@/lib/services/RedisService';
import GeminiService from '@/lib/services/GeminiService';
import { Language, VoiceRecognitionResponse } from '@/types';

// 音声認識 API
export async function POST(request: NextRequest) {
  const startTime = Date.now();
  const requestId = uuidv4();

  try {
    const sessionId = request.headers.get('X-Session-ID');
    
    if (!sessionId) {
      return NextResponse.json({
        success: false,
        error: {
          code: 'SESSION_INVALID',
          message: 'セッションIDが必要です',
        },
        timestamp: new Date().toISOString(),
        requestId,
      }, { status: 400 });
    }

    // レート制限チェック
    const rateLimit = await RedisService.checkRateLimit(`voice:${sessionId}`, 60, 30);
    if (!rateLimit.allowed) {
      return NextResponse.json({
        success: false,
        error: {
          code: 'RATE_LIMIT_EXCEEDED',
          message: '音声認識のリクエスト回数上限を超えました',
          details: {
            limit: 30,
            window: 60,
            retryAfter: rateLimit.resetTime - Math.floor(Date.now() / 1000),
          },
        },
        timestamp: new Date().toISOString(),
        requestId,
      }, {
        status: 429,
        headers: {
          'X-RateLimit-Limit': '30',
          'X-RateLimit-Remaining': rateLimit.remaining.toString(),
          'X-RateLimit-Reset': rateLimit.resetTime.toString(),
        },
      });
    }

    // フォームデータ解析
    const formData = await request.formData();
    const audioFile = formData.get('audio') as File;
    const language = (formData.get('language') as string) || 'ja';

    // バリデーション
    if (!audioFile) {
      return NextResponse.json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: '音声ファイルが必要です',
        },
        timestamp: new Date().toISOString(),
        requestId,
      }, { status: 400 });
    }

    // ファイルサイズチェック（10MB）
    if (audioFile.size > 10 * 1024 * 1024) {
      return NextResponse.json({
        success: false,
        error: {
          code: 'VOICE_FILE_TOO_LARGE',
          message: '音声ファイルが大きすぎます（最大10MB）',
          details: {
            maxSize: 10 * 1024 * 1024,
            actualSize: audioFile.size,
          },
        },
        timestamp: new Date().toISOString(),
        requestId,
      }, { status: 413 });
    }

    // サポートされている形式チェック
    const supportedFormats = ['audio/webm', 'audio/mp3', 'audio/wav', 'audio/m4a'];
    if (!supportedFormats.includes(audioFile.type)) {
      return NextResponse.json({
        success: false,
        error: {
          code: 'VOICE_FORMAT_UNSUPPORTED',
          message: 'サポートされていない音声形式です',
          details: {
            supportedFormats: ['webm', 'mp3', 'wav', 'm4a'],
            providedFormat: audioFile.type,
          },
        },
        timestamp: new Date().toISOString(),
        requestId,
      }, { status: 415 });
    }

    // 音声認識処理（模擬実装）
    const transcript = await performSpeechRecognition(audioFile, language as Language);
    
    // 認識結果の改善（Geminiを使用）
    const improvedTranscript = await GeminiService.improveTranscript(transcript, language as Language);

    // 音声の長さを計算（概算）
    const audioDuration = calculateAudioDuration(audioFile.size, audioFile.type);

    // 信頼度の計算（簡易版）
    const confidence = calculateRecognitionConfidence(transcript, improvedTranscript);

    const response: VoiceRecognitionResponse = {
      transcript: improvedTranscript,
      confidence,
      language: language as Language,
      duration: audioDuration,
      metadata: {
        processingTime: Date.now() - startTime,
        audioFormat: audioFile.type,
        sampleRate: 16000, // 仮定値
      },
    };

    return NextResponse.json({
      success: true,
      data: response,
      timestamp: new Date().toISOString(),
      requestId,
    });

  } catch (error) {
    console.error('Voice recognition error:', error);
    
    return NextResponse.json({
      success: false,
      error: {
        code: 'VOICE_RECOGNITION_FAILED',
        message: '音声認識処理に失敗しました',
        details: process.env.NODE_ENV === 'development' ? error.message : undefined,
      },
      timestamp: new Date().toISOString(),
      requestId,
    }, { status: 500 });
  }
}

// 音声認識処理（模擬実装）
async function performSpeechRecognition(audioFile: File, language: Language): Promise<string> {
  // TODO: 実際のGemini Live APIまたはGoogle Cloud Speech-to-Text APIの実装
  // 現在は模擬的な処理を行う
  
  await new Promise(resolve => setTimeout(resolve, 500)); // 処理時間を模擬
  
  // 模擬的な認識結果
  const mockTranscripts = {
    ja: [
      '近くの保育園を教えてください',
      '児童手当の申請方法を知りたいです',
      '予防接種のスケジュールについて教えて',
      '子育て相談窓口はありますか',
    ],
    en: [
      'Tell me about nearby nurseries',
      'I want to know how to apply for child allowance',
      'Please tell me about the vaccination schedule',
      'Are there childcare consultation services',
    ],
  };
  
  const transcripts = mockTranscripts[language] || mockTranscripts.ja;
  return transcripts[Math.floor(Math.random() * transcripts.length)];
}

// 音声の長さ計算（概算）
function calculateAudioDuration(fileSize: number, mimeType: string): number {
  // 概算値（実際にはメタデータから取得すべき）
  const bitrates = {
    'audio/webm': 32000, // 32 kbps
    'audio/mp3': 128000, // 128 kbps
    'audio/wav': 1411200, // 1411.2 kbps (16-bit, 44.1kHz stereo)
    'audio/m4a': 128000, // 128 kbps
  };
  
  const bitrate = bitrates[mimeType as keyof typeof bitrates] || 128000;
  const durationSeconds = (fileSize * 8) / bitrate;
  
  return Math.max(1, Math.min(60, durationSeconds)); // 1秒〜60秒の範囲
}

// 認識信頼度計算
function calculateRecognitionConfidence(original: string, improved: string): number {
  // 元の認識結果と改善後の結果の差異から信頼度を計算
  const similarity = calculateStringSimilarity(original, improved);
  
  // 基本信頼度
  let confidence = 0.8;
  
  // 改善度に基づく調整
  if (similarity > 0.9) {
    confidence += 0.1; // ほとんど変更なし = 高信頼度
  } else if (similarity < 0.5) {
    confidence -= 0.3; // 大幅変更 = 低信頼度
  }
  
  return Math.max(0.1, Math.min(1.0, confidence));
}

// 文字列類似度計算（簡易版）
function calculateStringSimilarity(str1: string, str2: string): number {
  const longer = str1.length > str2.length ? str1 : str2;
  const shorter = str1.length > str2.length ? str2 : str1;
  
  if (longer.length === 0) return 1.0;
  
  const distance = levenshteinDistance(longer, shorter);
  return (longer.length - distance) / longer.length;
}

// レーベンシュタイン距離計算
function levenshteinDistance(str1: string, str2: string): number {
  const matrix = Array(str2.length + 1).fill(null).map(() => Array(str1.length + 1).fill(null));
  
  for (let i = 0; i <= str1.length; i++) matrix[0][i] = i;
  for (let j = 0; j <= str2.length; j++) matrix[j][0] = j;
  
  for (let j = 1; j <= str2.length; j++) {
    for (let i = 1; i <= str1.length; i++) {
      const substitutionCost = str1[i - 1] === str2[j - 1] ? 0 : 1;
      matrix[j][i] = Math.min(
        matrix[j][i - 1] + 1, // deletion
        matrix[j - 1][i] + 1, // insertion
        matrix[j - 1][i - 1] + substitutionCost // substitution
      );
    }
  }
  
  return matrix[str2.length][str1.length];
}