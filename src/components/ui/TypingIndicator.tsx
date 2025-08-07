'use client';

import { useEffect, useState } from 'react';
import { Bot, Sparkles } from 'lucide-react';

interface TypingIndicatorProps {
  name?: string;
  avatar?: string;
  isVisible?: boolean;
  message?: string;
  className?: string;
}

export function TypingIndicator({ 
  name = 'AI',
  avatar,
  isVisible = true,
  message,
  className = ''
}: TypingIndicatorProps) {
  const [dots, setDots] = useState('');
  const [currentMessage, setCurrentMessage] = useState('');

  // Animate dots
  useEffect(() => {
    if (!isVisible) return;

    const interval = setInterval(() => {
      setDots(prev => {
        if (prev.length >= 3) return '';
        return prev + '.';
      });
    }, 500);

    return () => clearInterval(interval);
  }, [isVisible]);

  // Animate message typing
  useEffect(() => {
    if (!message) {
      setCurrentMessage('');
      return;
    }

    let index = 0;
    const interval = setInterval(() => {
      if (index <= message.length) {
        setCurrentMessage(message.slice(0, index));
        index++;
      } else {
        clearInterval(interval);
      }
    }, 50);

    return () => clearInterval(interval);
  }, [message]);

  if (!isVisible) return null;

  return (
    <div className={`flex items-start space-x-3 ${className}`}>
      {/* Avatar */}
      <div className="flex-shrink-0">
        {avatar ? (
          <img
            src={avatar}
            alt={`${name} avatar`}
            className="w-8 h-8 rounded-full"
          />
        ) : (
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
            <Bot className="w-4 h-4 text-white" />
          </div>
        )}
      </div>

      {/* Typing Content */}
      <div className="flex-1 max-w-3xl">
        {/* Name and Status */}
        <div className="flex items-center space-x-2 mb-1">
          <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
            {name}
          </span>
          <div className="flex items-center space-x-1">
            <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
            <span className="text-xs text-green-600 dark:text-green-400">
              入力中
            </span>
          </div>
        </div>

        {/* Typing Bubble */}
        <div className="
          inline-block max-w-full
          bg-gray-100 dark:bg-gray-700
          rounded-2xl rounded-tl-md
          px-4 py-3
          relative
          animate-pulse-gentle
        ">
          {message ? (
            // Typing message animation
            <div className="space-y-2">
              <div className="text-gray-800 dark:text-gray-200">
                {currentMessage}
                <span className="inline-block w-2 h-4 bg-gray-400 ml-1 animate-blink">|</span>
              </div>
              {currentMessage.length < message.length && (
                <div className="flex items-center space-x-1 text-xs text-gray-500">
                  <Sparkles className="w-3 h-3 animate-spin" />
                  <span>AI が回答を生成中</span>
                </div>
              )}
            </div>
          ) : (
            // Default dots animation
            <div className="flex items-center space-x-1">
              <div className="flex space-x-1">
                <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></div>
                <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
                <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
              </div>
              <span className="ml-2 text-gray-500 dark:text-gray-400 text-sm">
                考え中{dots}
              </span>
            </div>
          )}
        </div>

        {/* Processing Status */}
        {!message && (
          <div className="mt-2 flex items-center space-x-2 text-xs text-gray-500 dark:text-gray-400">
            <div className="flex items-center space-x-1">
              <div className="w-1 h-1 bg-blue-500 rounded-full animate-pulse"></div>
              <span>情報を検索中</span>
            </div>
            <div className="flex items-center space-x-1">
              <div className="w-1 h-1 bg-green-500 rounded-full animate-pulse" style={{ animationDelay: '0.5s' }}></div>
              <span>データを分析中</span>
            </div>
            <div className="flex items-center space-x-1">
              <div className="w-1 h-1 bg-purple-500 rounded-full animate-pulse" style={{ animationDelay: '1s' }}></div>
              <span>回答を生成中</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// Enhanced typing indicator with multiple stages
interface MultiStageTypingIndicatorProps {
  stages: {
    id: string;
    message: string;
    duration?: number;
    icon?: React.ReactNode;
  }[];
  currentStage: number;
  className?: string;
}

export function MultiStageTypingIndicator({ 
  stages, 
  currentStage, 
  className = '' 
}: MultiStageTypingIndicatorProps) {
  const [visibleStages, setVisibleStages] = useState<number[]>([]);

  useEffect(() => {
    if (currentStage >= 0 && currentStage < stages.length) {
      setVisibleStages(prev => {
        if (!prev.includes(currentStage)) {
          return [...prev, currentStage];
        }
        return prev;
      });
    }
  }, [currentStage, stages.length]);

  return (
    <div className={`space-y-2 ${className}`}>
      {visibleStages.map(stageIndex => {
        const stage = stages[stageIndex];
        const isActive = stageIndex === currentStage;
        const isCompleted = stageIndex < currentStage;

        return (
          <div 
            key={stage.id}
            className={`
              flex items-center space-x-3 p-2 rounded-lg
              transition-all duration-300
              ${isActive ? 'bg-blue-50 dark:bg-blue-900/20' : ''}
              ${isCompleted ? 'opacity-60' : ''}
            `}
          >
            {/* Stage Icon */}
            <div className={`
              w-6 h-6 rounded-full flex items-center justify-center
              ${isActive ? 'bg-blue-500 text-white' : ''}
              ${isCompleted ? 'bg-green-500 text-white' : 'bg-gray-200 dark:bg-gray-700'}
            `}>
              {isCompleted ? (
                <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                </svg>
              ) : stage.icon ? (
                stage.icon
              ) : (
                <span className="text-xs">{stageIndex + 1}</span>
              )}
            </div>

            {/* Stage Message */}
            <div className="flex-1">
              <span className={`
                text-sm
                ${isActive ? 'text-blue-700 dark:text-blue-300 font-medium' : ''}
                ${isCompleted ? 'text-gray-500 dark:text-gray-400' : 'text-gray-700 dark:text-gray-300'}
              `}>
                {stage.message}
              </span>
              {isActive && (
                <span className="ml-2 inline-block w-2 h-4 bg-blue-500 animate-blink">|</span>
              )}
            </div>

            {/* Progress Indicator */}
            {isActive && (
              <div className="flex space-x-1">
                <div className="w-1 h-1 bg-blue-500 rounded-full animate-bounce"></div>
                <div className="w-1 h-1 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
                <div className="w-1 h-1 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// Add custom animations to CSS
const styles = `
  @keyframes animate-pulse-gentle {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.8; }
  }
  
  @keyframes animate-blink {
    0%, 50% { opacity: 1; }
    51%, 100% { opacity: 0; }
  }
  
  .animate-pulse-gentle {
    animation: animate-pulse-gentle 2s ease-in-out infinite;
  }
  
  .animate-blink {
    animation: animate-blink 1s ease-in-out infinite;
  }
`;

// Inject styles if not already present
if (typeof document !== 'undefined' && !document.getElementById('typing-indicator-styles')) {
  const styleSheet = document.createElement('style');
  styleSheet.id = 'typing-indicator-styles';
  styleSheet.textContent = styles;
  document.head.appendChild(styleSheet);
}

export default TypingIndicator;