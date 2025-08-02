'use client';

import { Message } from '@/types';
import { Volume2, User, Bot } from 'lucide-react';

interface MessageBubbleProps {
  message: Message;
  onPlayAudio?: (audioUrl: string) => void;
}

export default function MessageBubble({ message, onPlayAudio }: MessageBubbleProps) {
  const isUser = message.role === 'user';
  
  const handlePlayAudio = () => {
    if (message.audioUrl && onPlayAudio) {
      onPlayAudio(message.audioUrl);
    }
  };

  const formatTimestamp = (timestamp: Date) => {
    return new Intl.DateTimeFormat('ja-JP', {
      hour: '2-digit',
      minute: '2-digit',
    }).format(timestamp);
  };

  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'} mb-4 message-enter`}>
      <div className={`flex items-start space-x-2 max-w-xs md:max-w-md lg:max-w-lg ${isUser ? 'flex-row-reverse space-x-reverse' : ''}`}>
        {/* Avatar */}
        <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
          isUser ? 'bg-tokyo-blue' : 'bg-gray-200'
        }`}>
          {isUser ? (
            <User className="w-4 h-4 text-white" />
          ) : (
            <Bot className="w-4 h-4 text-gray-600" />
          )}
        </div>
        
        {/* Message content */}
        <div className={`rounded-lg px-4 py-2 ${
          isUser 
            ? 'bg-tokyo-blue text-white' 
            : 'bg-white border border-gray-200 text-gray-800'
        }`}>
          <div className="text-sm md:text-base leading-relaxed whitespace-pre-wrap">
            {message.content}
          </div>
          
          {/* Message footer */}
          <div className={`flex items-center justify-between mt-2 text-xs ${
            isUser ? 'text-blue-100' : 'text-gray-500'
          }`}>
            <span>{formatTimestamp(message.timestamp)}</span>
            
            {/* Audio playback button */}
            {message.audioUrl && (
              <button
                onClick={handlePlayAudio}
                className={`ml-2 p-1 rounded hover:bg-opacity-20 ${
                  isUser ? 'hover:bg-white' : 'hover:bg-gray-300'
                } transition-colors duration-200`}
                title="音声を再生"
              >
                <Volume2 className="w-3 h-3" />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}