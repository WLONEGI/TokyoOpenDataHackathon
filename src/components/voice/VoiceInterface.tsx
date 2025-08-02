'use client';

import { useState, useRef, useEffect } from 'react';
import { Mic, MicOff, Volume2, VolumeX } from 'lucide-react';
import { useLanguage } from '@/lib/context/LanguageContext';
import { useSession } from '@/lib/context/SessionContext';
import VoiceRecorder from './VoiceRecorder';
import VoiceVisualizer from './VoiceVisualizer';
import LoadingDots from '../ui/LoadingDots';

export default function VoiceInterface() {
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [response, setResponse] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [audioLevel, setAudioLevel] = useState(0);
  const [isPlayingResponse, setIsPlayingResponse] = useState(false);
  const [isVoiceEnabled, setIsVoiceEnabled] = useState(true);

  const audioRef = useRef<HTMLAudioElement>(null);
  const { t, currentLanguage } = useLanguage();
  const { sessionId } = useSession();

  // マイク権限チェック
  useEffect(() => {
    const checkMicrophonePermission = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        stream.getTracks().forEach(track => track.stop());
      } catch (err) {
        setError(t('errorMicrophone', 'マイクへのアクセスが許可されていません'));
      }
    };

    checkMicrophonePermission();
  }, [t]);

  // 録音完了ハンドラー
  const handleRecordingComplete = async (audioBlob: Blob) => {
    if (!sessionId) {
      setError('セッションが初期化されていません');
      return;
    }

    setIsProcessing(true);
    setError(null);

    try {
      // 音声認識
      const formData = new FormData();
      formData.append('audio', audioBlob, 'recording.webm');
      formData.append('language', currentLanguage);
      formData.append('sessionId', sessionId);

      const recognitionResponse = await fetch('/api/voice/recognize', {
        method: 'POST',
        headers: {
          'X-Session-ID': sessionId,
        },
        body: formData,
      });

      if (!recognitionResponse.ok) {
        throw new Error(`音声認識に失敗しました: ${recognitionResponse.status}`);
      }

      const { data: recognitionData } = await recognitionResponse.json();
      setTranscript(recognitionData.transcript);

      // チャット処理
      const chatResponse = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Session-ID': sessionId,
        },
        body: JSON.stringify({
          message: recognitionData.transcript,
          sessionId,
          language: currentLanguage,
          options: {
            includeAudio: isVoiceEnabled,
            responseLength: 'normal',
          },
        }),
      });

      if (!chatResponse.ok) {
        throw new Error(`チャット処理に失敗しました: ${chatResponse.status}`);
      }

      const { data: chatData } = await chatResponse.json();
      setResponse(chatData.content);

      // 音声レスポンスの再生
      if (isVoiceEnabled && chatData.audioUrl) {
        await playResponseAudio(chatData.audioUrl);
      }

    } catch (err) {
      console.error('Voice processing error:', err);
      setError(err instanceof Error ? err.message : t('errorProcessing', '音声処理中にエラーが発生しました'));
    } finally {
      setIsProcessing(false);
    }
  };

  // 音声レスポンス再生
  const playResponseAudio = async (audioUrl: string) => {
    try {
      setIsPlayingResponse(true);
      
      if (audioRef.current) {
        audioRef.current.src = audioUrl;
        audioRef.current.onended = () => setIsPlayingResponse(false);
        audioRef.current.onerror = () => setIsPlayingResponse(false);
        await audioRef.current.play();
      }
    } catch (err) {
      console.error('Audio playback error:', err);
      setIsPlayingResponse(false);
    }
  };

  // リセット
  const resetConversation = () => {
    setTranscript('');
    setResponse('');
    setError(null);
    setIsPlayingResponse(false);
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    }
  };

  return (
    <div className="flex flex-col items-center space-y-6 max-w-2xl mx-auto p-6">
      {/* 音声設定 */}
      <div className="flex items-center space-x-4">
        <button
          onClick={() => setIsVoiceEnabled(!isVoiceEnabled)}
          className={`flex items-center space-x-2 px-3 py-1 rounded-lg text-sm transition-colors ${
            isVoiceEnabled
              ? 'bg-green-100 text-green-800 border border-green-200'
              : 'bg-gray-100 text-gray-600 border border-gray-200'
          }`}
        >
          {isVoiceEnabled ? (
            <>
              <Volume2 className="w-4 h-4" />
              <span className="font-japanese">{t('voiceEnabled', '音声有効')}</span>
            </>
          ) : (
            <>
              <VolumeX className="w-4 h-4" />
              <span className="font-japanese">{t('voiceDisabled', '音声無効')}</span>
            </>
          )}
        </button>
      </div>

      {/* メイン音声インターフェース */}
      <div className="w-full max-w-md">
        <VoiceRecorder
          onRecordingComplete={handleRecordingComplete}
          onRecordingStateChange={setIsRecording}
          onAudioLevelChange={setAudioLevel}
          isEnabled={!isProcessing}
        />
      </div>

      {/* 音声可視化 */}
      {(isRecording || isProcessing) && (
        <div className="w-full max-w-md">
          <VoiceVisualizer
            isRecording={isRecording}
            audioLevel={audioLevel}
            isProcessing={isProcessing}
          />
        </div>
      )}

      {/* ステータス表示 */}
      <div className="text-center space-y-2">
        {isRecording && (
          <p className="text-lg font-medium text-red-600 font-japanese">
            {t('recording', '録音中...')}
          </p>
        )}
        
        {isProcessing && (
          <div className="flex items-center justify-center space-x-2">
            <LoadingDots />
            <p className="text-lg font-medium text-blue-600 font-japanese">
              {t('processing', '処理中...')}
            </p>
          </div>
        )}
        
        {isPlayingResponse && (
          <p className="text-lg font-medium text-green-600 font-japanese">
            {t('playingResponse', '応答を再生中...')}
          </p>
        )}

        {!isRecording && !isProcessing && !isPlayingResponse && (
          <p className="text-gray-600 font-japanese">
            {t('tapToSpeak', 'マイクボタンをタップして話してください')}
          </p>
        )}
      </div>

      {/* 認識結果表示 */}
      {transcript && (
        <div className="w-full">
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <h3 className="font-semibold text-blue-900 mb-2 font-japanese">
              {t('yourMessage', 'あなたの質問')}:
            </h3>
            <p className="text-blue-800 font-japanese">{transcript}</p>
          </div>
        </div>
      )}

      {/* AI応答表示 */}
      {response && (
        <div className="w-full">
          <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
            <div className="flex items-center justify-between mb-2">
              <h3 className="font-semibold text-gray-900 font-japanese">
                {t('aiResponse', 'AI回答')}:
              </h3>
              {isVoiceEnabled && (
                <div className="flex items-center space-x-1 text-sm text-gray-600">
                  <Volume2 className="w-4 h-4" />
                  <span>{t('withVoice', '音声付き')}</span>
                </div>
              )}
            </div>
            <p className="text-gray-800 font-japanese whitespace-pre-wrap">{response}</p>
          </div>
        </div>
      )}

      {/* エラー表示 */}
      {error && (
        <div className="w-full">
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <p className="text-red-800 font-japanese">{error}</p>
            <button
              onClick={() => setError(null)}
              className="mt-2 text-sm text-red-600 hover:text-red-800 font-japanese"
            >
              {t('dismiss', '閉じる')}
            </button>
          </div>
        </div>
      )}

      {/* リセットボタン */}
      {(transcript || response) && (
        <button
          onClick={resetConversation}
          className="btn-secondary font-japanese"
        >
          {t('newQuestion', '新しい質問')}
        </button>
      )}

      {/* 音声再生用 */}
      <audio ref={audioRef} style={{ display: 'none' }} />
    </div>
  );
}