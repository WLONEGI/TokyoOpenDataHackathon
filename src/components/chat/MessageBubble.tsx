'use client';

import { useState } from 'react';
import { Volume2, ExternalLink, Clock, Star } from 'lucide-react';
import { ChatMessage } from '@/types';
import { useLanguage } from '@/lib/context/LanguageContext';

interface MessageBubbleProps {
  message: ChatMessage;
  onAudioPlay?: () => void;
}

export default function MessageBubble({ message, onAudioPlay }: MessageBubbleProps) {
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);
  const { t, currentLanguage } = useLanguage();

  // 音声再生
  const playAudio = async () => {
    if (!message.audioUrl || isPlayingAudio) return;

    try {
      setIsPlayingAudio(true);
      onAudioPlay?.();

      const audio = new Audio(message.audioUrl);
      audio.onended = () => setIsPlayingAudio(false);
      audio.onerror = () => setIsPlayingAudio(false);
      
      await audio.play();
    } catch (error) {
      console.error('Audio play error:', error);
      setIsPlayingAudio(false);
    }
  };

  // 信頼度のアイコン
  const getConfidenceIcon = (confidence?: number) => {
    if (!confidence) return null;
    
    const stars = Math.round(confidence * 5);
    return (
      <div className="flex items-center space-x-1" title={`信頼度: ${Math.round(confidence * 100)}%`}>
        {[...Array(5)].map((_, i) => (
          <Star
            key={i}
            className={`w-3 h-3 ${
              i < stars ? 'text-yellow-400 fill-current' : 'text-gray-300'
            }`}
          />
        ))}
      </div>
    );
  };

  // 処理時間のフォーマット
  const formatProcessingTime = (time?: number) => {
    if (!time) return '';
    return time < 1000 ? `${time}ms` : `${(time / 1000).toFixed(1)}s`;
  };

  return (
    <div className={`flex ${message.type === 'user' ? 'justify-end' : 'justify-start'}`}>
      <div className="max-w-[80%] sm:max-w-[70%]">
        {/* メッセージバブル */}
        <div
          className={`message-bubble ${
            message.type === 'user' ? 'message-user' : 'message-assistant'
          }`}
        >
          {/* ユーザーアイコン */}
          {message.type === 'assistant' && (
            <div className="flex items-start space-x-2 mb-2">
              <div className="w-6 h-6 bg-tokyo-500 rounded-full flex items-center justify-center text-white text-xs font-bold">
                AI
              </div>
              <span className="text-xs text-gray-600">
                {t('aiAssistant', 'AIアシスタント')}
              </span>
            </div>
          )}

          {/* メッセージ内容 */}
          <div className="font-japanese whitespace-pre-wrap">
            {message.content}
          </div>

          {/* 音声再生ボタン */}
          {message.audioUrl && (
            <button
              onClick={playAudio}
              disabled={isPlayingAudio}
              className="mt-2 flex items-center space-x-1 text-sm text-blue-600 hover:text-blue-800 disabled:opacity-50"
            >
              <Volume2 className={`w-4 h-4 ${isPlayingAudio ? 'animate-pulse' : ''}`} />
              <span>
                {isPlayingAudio 
                  ? t('playing', '再生中...')
                  : t('playAudio', '音声を再生')
                }
              </span>
            </button>
          )}

          {/* データソース */}
          {message.metadata?.sources && message.metadata.sources.length > 0 && (
            <div className="mt-3 pt-2 border-t border-gray-200">
              <p className="text-xs text-gray-600 mb-2 font-japanese">
                {t('dataSources', '参考情報')}:
              </p>
              <div className="space-y-1">
                {message.metadata.sources.map((source, index) => (
                  <div key={source.id || index} className="text-xs">
                    <div className="flex items-center justify-between">
                      <span className="font-medium text-gray-700 font-japanese">
                        {source.title}
                      </span>
                      <span className="text-gray-500 ml-2">
                        {Math.round(source.score * 100)}%
                      </span>
                    </div>
                    {source.url && (
                      <a
                        href={source.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center space-x-1 text-blue-600 hover:text-blue-800 mt-1"
                      >
                        <ExternalLink className="w-3 h-3" />
                        <span>{t('viewDetails', '詳細を見る')}</span>
                      </a>
                    )}
                    <span className="text-gray-500 text-xs">
                      {source.category}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* メッセージメタデータ */}
        <div className={`flex items-center space-x-2 mt-1 text-xs text-gray-500 ${
          message.type === 'user' ? 'justify-end' : 'justify-start'
        }`}>
          {/* タイムスタンプ */}
          <span>
            {new Date(message.timestamp).toLocaleTimeString(
              currentLanguage === 'ja' ? 'ja-JP' : 'en-US',
              {
                hour: '2-digit',
                minute: '2-digit',
              }
            )}
          </span>

          {/* AIメッセージの追加情報 */}
          {message.type === 'assistant' && message.metadata && (
            <>
              {/* 処理時間 */}
              {message.metadata.processingTime && (
                <div className="flex items-center space-x-1">
                  <Clock className="w-3 h-3" />
                  <span>{formatProcessingTime(message.metadata.processingTime)}</span>
                </div>
              )}

              {/* 信頼度 */}
              {message.metadata.confidence && (
                getConfidenceIcon(message.metadata.confidence)
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}