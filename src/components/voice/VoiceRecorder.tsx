'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import { Mic, MicOff } from 'lucide-react';
import { useLanguage } from '@/lib/context/LanguageContext';

interface VoiceRecorderProps {
  onRecordingComplete?: (audioBlob: Blob) => void;
  onRecordingStateChange?: (isRecording: boolean) => void;
  onAudioLevelChange?: (level: number) => void;
  onTranscript?: (transcript: string) => void;
  isEnabled?: boolean;
  className?: string;
}

export default function VoiceRecorder({
  onRecordingComplete,
  onRecordingStateChange,
  onAudioLevelChange,
  onTranscript,
  isEnabled = true,
  className = '',
}: VoiceRecorderProps) {
  const [isRecording, setIsRecording] = useState(false);
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const [error, setError] = useState<string | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioStreamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  const { t } = useLanguage();

  // マイク権限の確認
  const checkMicrophonePermission = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          channelCount: 1,
          sampleRate: 16000,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        }
      });
      setHasPermission(true);
      setError(null);
      
      // テスト用ストリームを停止
      stream.getTracks().forEach(track => track.stop());
      
      return true;
    } catch (err) {
      console.error('Microphone permission error:', err);
      setHasPermission(false);
      setError(t('errorMicrophone', 'マイクへのアクセスが許可されていません'));
      return false;
    }
  }, [t]);

  // 音声レベル分析
  const analyzeAudioLevel = useCallback(() => {
    if (!analyserRef.current) return;

    const dataArray = new Uint8Array(analyserRef.current.frequencyBinCount);
    analyserRef.current.getByteFrequencyData(dataArray);

    // 音声レベルの計算
    const average = dataArray.reduce((sum, value) => sum + value, 0) / dataArray.length;
    const normalizedLevel = average / 255;
    
    onAudioLevelChange?.(normalizedLevel);

    if (isRecording) {
      animationFrameRef.current = requestAnimationFrame(analyzeAudioLevel);
    }
  }, [isRecording, onAudioLevelChange]);

  // 録音開始
  const startRecording = useCallback(async () => {
    if (!isEnabled) return;

    const hasPermissionResult = await checkMicrophonePermission();
    if (!hasPermissionResult) return;

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          channelCount: 1,
          sampleRate: 16000,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        }
      });

      audioStreamRef.current = stream;

      // 音声分析の設定
      audioContextRef.current = new AudioContext({ sampleRate: 16000 });
      const source = audioContextRef.current.createMediaStreamSource(stream);
      analyserRef.current = audioContextRef.current.createAnalyser();
      analyserRef.current.fftSize = 2048;
      source.connect(analyserRef.current);

      // MediaRecorderの設定
      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: 'audio/webm;codecs=opus',
      });

      chunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = () => {
        const audioBlob = new Blob(chunksRef.current, { type: 'audio/webm' });
        onRecordingComplete?.(audioBlob);
        cleanup();
      };

      mediaRecorder.onerror = (event) => {
        console.error('MediaRecorder error:', event);
        setError(t('errorRecording', '録音中にエラーが発生しました'));
        cleanup();
      };

      mediaRecorderRef.current = mediaRecorder;
      mediaRecorder.start();

      setIsRecording(true);
      onRecordingStateChange?.(true);
      setError(null);

      // 音声レベル分析開始
      analyzeAudioLevel();

    } catch (err) {
      console.error('Recording start error:', err);
      setError(t('errorRecording', '録音中にエラーが発生しました'));
      cleanup();
    }
  }, [isEnabled, checkMicrophonePermission, onRecordingComplete, onRecordingStateChange, t, analyzeAudioLevel]);

  // 録音停止
  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      onRecordingStateChange?.(false);
    }
  }, [isRecording, onRecordingStateChange]);

  // クリーンアップ
  const cleanup = useCallback(() => {
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }

    if (audioStreamRef.current) {
      audioStreamRef.current.getTracks().forEach(track => track.stop());
      audioStreamRef.current = null;
    }

    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }

    analyserRef.current = null;
    mediaRecorderRef.current = null;
  }, []);

  // 録音トグル
  const toggleRecording = useCallback(() => {
    if (isRecording) {
      stopRecording();
    } else {
      startRecording();
    }
  }, [isRecording, stopRecording, startRecording]);

  // コンポーネントのクリーンアップ
  useEffect(() => {
    return () => {
      cleanup();
    };
  }, [cleanup]);

  // 初期権限チェック
  useEffect(() => {
    checkMicrophonePermission();
  }, [checkMicrophonePermission]);

  return (
    <div className={`flex flex-col items-center space-y-4 ${className}`}>
      {/* メイン録音ボタン */}
      <button
        onClick={toggleRecording}
        disabled={!isEnabled || hasPermission === false}
        className={`
          w-24 h-24 rounded-full flex items-center justify-center text-white shadow-lg transform transition-all duration-200
          ${isRecording 
            ? 'bg-red-500 hover:bg-red-600 animate-pulse scale-110' 
            : 'bg-tokyo-500 hover:bg-tokyo-600 hover:scale-105'
          }
          ${(!isEnabled || hasPermission === false) 
            ? 'opacity-50 cursor-not-allowed' 
            : 'cursor-pointer'
          }
        `}
        aria-label={isRecording ? t('stopRecording', '録音停止') : t('startRecording', '録音開始')}
      >
        {isRecording ? (
          <MicOff className="w-10 h-10" />
        ) : (
          <Mic className="w-10 h-10" />
        )}
      </button>

      {/* ステータステキスト */}
      <div className="text-center">
        {hasPermission === false ? (
          <p className="text-red-600 text-sm font-japanese">
            {t('errorMicrophone', 'マイクへのアクセスが許可されていません')}
          </p>
        ) : isRecording ? (
          <p className="text-red-600 font-medium font-japanese">
            {t('recording', '録音中...')}
          </p>
        ) : (
          <p className="text-gray-600 text-sm font-japanese">
            {t('tapToSpeak', 'タップして話してください')}
          </p>
        )}
      </div>

      {/* エラー表示 */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3 max-w-md">
          <p className="text-red-800 text-sm font-japanese">{error}</p>
          <button
            onClick={() => setError(null)}
            className="mt-2 text-xs text-red-600 hover:text-red-800 font-japanese"
          >
            {t('dismiss', '閉じる')}
          </button>
        </div>
      )}

      {/* 権限要求ボタン */}
      {hasPermission === false && (
        <button
          onClick={checkMicrophonePermission}
          className="btn-primary text-sm font-japanese"
        >
          {t('requestPermission', 'マイク権限を許可')}
        </button>
      )}
    </div>
  );
}