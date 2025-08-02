'use client';

import { useState, useRef, useEffect } from 'react';
import { Send, RotateCcw } from 'lucide-react';
import { useLanguage } from '@/lib/context/LanguageContext';
import { useSession } from '@/lib/context/SessionContext';
import { ChatMessage, ChatRequest, ChatResponse, MessageType } from '@/types';
import MessageBubble from './MessageBubble';
import LoadingDots from '../ui/LoadingDots';

export default function ChatInterface() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputText, setInputText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  
  const { t, currentLanguage } = useLanguage();
  const { sessionId } = useSession();

  // メッセージリストの最下部にスクロール
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // 初期メッセージ
  useEffect(() => {
    if (messages.length === 0) {
      const welcomeMessage: ChatMessage = {
        id: 'welcome',
        type: 'assistant',
        content: currentLanguage === 'ja' 
          ? 'こんにちは！東京都の子育て支援に関する情報をお手伝いします。保育園、手当、予防接種など、何でもお気軽にお聞きください。'
          : 'Hello! I\'m here to help you with information about childcare support in Tokyo. Feel free to ask about nurseries, allowances, vaccinations, or anything else.',
        timestamp: new Date().toISOString(),
      };
      setMessages([welcomeMessage]);
    }
  }, [currentLanguage, messages.length]);

  // メッセージ送信
  const sendMessage = async (text: string) => {
    if (!text.trim() || isLoading || !sessionId) return;

    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      type: 'user',
      content: text.trim(),
      timestamp: new Date().toISOString(),
    };

    setMessages(prev => [...prev, userMessage]);
    setInputText('');
    setIsLoading(true);
    setError(null);

    try {
      const request: ChatRequest = {
        message: text.trim(),
        sessionId,
        language: currentLanguage,
        options: {
          includeAudio: false, // テキストモードでは音声なし
          responseLength: 'normal',
        },
      };

      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Session-ID': sessionId,
        },
        body: JSON.stringify(request),
      });

      if (!response.ok) {
        throw new Error(`API Error: ${response.status}`);
      }

      const { data }: { data: ChatResponse } = await response.json();

      const assistantMessage: ChatMessage = {
        id: Date.now().toString() + '_assistant',
        type: 'assistant',
        content: data.content,
        timestamp: new Date().toISOString(),
        metadata: {
          sources: data.sources,
          confidence: data.metadata.confidence,
          processingTime: data.metadata.processingTime,
          language: data.metadata.language,
        },
      };

      setMessages(prev => [...prev, assistantMessage]);

    } catch (err) {
      console.error('Chat error:', err);
      setError(err instanceof Error ? err.message : t('errorGeneral', 'エラーが発生しました'));
      
      // エラーメッセージを表示
      const errorMessage: ChatMessage = {
        id: Date.now().toString() + '_error',
        type: 'assistant',
        content: t('errorGeneral', 'エラーが発生しました。もう一度お試しください。'),
        timestamp: new Date().toISOString(),
      };
      
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  // エンターキーでの送信
  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage(inputText);
    }
  };

  // チャットリセット
  const resetChat = () => {
    setMessages([]);
    setError(null);
    setInputText('');
    
    // 初期メッセージを再追加
    setTimeout(() => {
      const welcomeMessage: ChatMessage = {
        id: 'welcome_new',
        type: 'assistant',
        content: currentLanguage === 'ja' 
          ? 'チャットをリセットしました。新しい質問をお聞かせください。'
          : 'Chat has been reset. Please feel free to ask a new question.',
        timestamp: new Date().toISOString(),
      };
      setMessages([welcomeMessage]);
    }, 100);
  };

  return (
    <div className="flex flex-col h-[600px] bg-white rounded-lg shadow-lg border border-gray-200">
      {/* チャットヘッダー */}
      <div className="flex items-center justify-between p-4 border-b border-gray-200 bg-gray-50 rounded-t-lg">
        <h3 className="font-semibold text-gray-900 font-japanese">
          {t('textMode', 'テキストチャット')}
        </h3>
        <button
          onClick={resetChat}
          className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-200 rounded-lg transition-colors"
          title={t('reset', 'リセット')}
        >
          <RotateCcw className="w-4 h-4" />
        </button>
      </div>

      {/* メッセージリスト */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((message) => (
          <MessageBubble key={message.id} message={message} />
        ))}
        
        {isLoading && (
          <div className="flex justify-start">
            <div className="message-bubble message-assistant flex items-center space-x-2">
              <LoadingDots />
              <span className="text-sm text-gray-600 font-japanese">
                {t('thinking', '考えています...')}
              </span>
            </div>
          </div>
        )}
        
        <div ref={messagesEndRef} />
      </div>

      {/* エラー表示 */}
      {error && (
        <div className="px-4 py-2 bg-red-50 border-t border-red-200">
          <p className="text-sm text-red-600 font-japanese">{error}</p>
        </div>
      )}

      {/* 入力エリア */}
      <div className="p-4 border-t border-gray-200 bg-gray-50 rounded-b-lg">
        <div className="flex space-x-2">
          <input
            ref={inputRef}
            type="text"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder={t('typeMessage', 'メッセージを入力してください...')}
            className="flex-1 input font-japanese"
            disabled={isLoading}
            maxLength={1000}
          />
          <button
            onClick={() => sendMessage(inputText)}
            disabled={!inputText.trim() || isLoading}
            className="btn-primary p-3 disabled:opacity-50 disabled:cursor-not-allowed"
            title={t('send', '送信')}
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
        
        {/* 文字数カウンター */}
        <div className="flex justify-between items-center mt-2 text-xs text-gray-500">
          <span></span>
          <span>{inputText.length}/1000</span>
        </div>
      </div>
    </div>
  );
}