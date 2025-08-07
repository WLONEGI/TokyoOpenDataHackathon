'use client';

import { Message } from '@/types';
import { Volume2, User, Sparkles, Check, CheckCheck, Clock, AlertCircle } from 'lucide-react';
import MarkdownRenderer from '@/components/ui/MarkdownRenderer';
import { useI18n } from '@/lib/i18n/I18nProvider';

interface MessageBubbleProps {
  message: Message;
  onPlayAudio?: (audioUrl: string) => void;
}

export default function MessageBubble({ message, onPlayAudio }: MessageBubbleProps) {
  const { t, language } = useI18n();
  const isUser = message.role === 'user';
  
  // Get message status from metadata or default to 'sent'
  const messageStatus = message.metadata?.status || 'sent';
  
  const handlePlayAudio = () => {
    if (message.audioUrl && onPlayAudio) {
      onPlayAudio(message.audioUrl);
    }
  };

  const formatTimestamp = (timestamp: Date, language: string = 'ja') => {
    const locales = {
      ja: 'ja-JP',
      en: 'en-US',
      zh: 'zh-CN',
      ko: 'ko-KR'
    };
    
    return new Intl.DateTimeFormat(locales[language as keyof typeof locales] || 'ja-JP', {
      hour: '2-digit',
      minute: '2-digit',
    }).format(timestamp);
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'sending':
        return <Clock className="w-3 h-3 animate-spin" />;
      case 'sent':
        return <Check className="w-3 h-3" />;
      case 'delivered':
        return <CheckCheck className="w-3 h-3" />;
      case 'failed':
        return <AlertCircle className="w-3 h-3 text-error" />;
      default:
        return <Check className="w-3 h-3" />;
    }
  };

  const getStatusLabel = (status: string) => {
    return t.messageStatus[status as keyof typeof t.messageStatus] || t.messageStatus.sent;
  };

  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'} animate-slide-up`}>
      <div className={`flex items-start space-x-3 max-w-2xl ${isUser ? 'flex-row-reverse space-x-reverse' : ''}`}>
        {/* Avatar */}
        {!isUser && (
          <div className="w-8 h-8 bg-gradient-to-br from-tokyo-400 to-tokyo-600 rounded-full flex items-center justify-center flex-shrink-0 shadow-sm">
            <Sparkles className="w-4 h-4 text-white" />
          </div>
        )}
        
        {isUser && (
          <div className="w-8 h-8 bg-primary-900 dark:bg-primary-100 rounded-full flex items-center justify-center flex-shrink-0 shadow-sm">
            <User className="w-4 h-4 text-white dark:text-primary-900" />
          </div>
        )}
        
        {/* Message content */}
        <div className={`${isUser ? 'message-bubble-user' : 'message-bubble-assistant'} animate-fade-in`}>
          <div className="text-sm md:text-base">
            {isUser ? (
              // User messages display as plain text
              <div className="whitespace-pre-wrap leading-relaxed">{message.content}</div>
            ) : (
              // AI messages render markdown with beautiful formatting
              <MarkdownRenderer content={message.content} />
            )}
          </div>
          
          {/* Message footer */}
          <div className={`flex items-center justify-between mt-3 text-xs ${
            isUser ? 'text-white/70 dark:text-primary-900/70' : 'text-primary-500 dark:text-primary-400'
          }`}>
            <div className="flex items-center space-x-2">
              <span>{formatTimestamp(message.timestamp, language)}</span>
              {/* Delivery status for user messages */}
              {isUser && (
                <div className="flex items-center space-x-1" title={getStatusLabel(messageStatus)}>
                  {getStatusIcon(messageStatus)}
                </div>
              )}
            </div>
            
            {/* Audio playback button */}
            {message.audioUrl && (
              <button
                onClick={handlePlayAudio}
                className={`ml-3 p-1.5 rounded-lg transition-all duration-200 ${
                  isUser 
                    ? 'hover:bg-white/20 dark:hover:bg-primary-900/20 text-white/80 dark:text-primary-900/80 hover:text-white dark:hover:text-primary-900' 
                    : 'hover:bg-primary-100 dark:hover:bg-primary-700 text-primary-500 dark:text-primary-400 hover:text-primary-700 dark:hover:text-primary-200'
                }`}
                title={t.chat.playAudio}
              >
                <Volume2 className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
          
          {/* Sources indicator for assistant messages */}
          {!isUser && message.metadata?.sources && message.metadata.sources.length > 0 && (
            <div className="mt-3 pt-3 border-t border-primary-100">
              <div className="text-xs text-primary-500 mb-2">
                {t.chat.sources}
              </div>
              <div className="space-y-1">
                {message.metadata.sources.slice(0, 2).map((source: any, index: number) => (
                  <div key={index} className="text-xs text-primary-600 bg-primary-50 px-2 py-1 rounded-lg">
                    {source.title}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}