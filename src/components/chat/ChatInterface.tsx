'use client';

import { useState, useRef, useEffect } from 'react';
import { Send, Mic, MicOff, Settings, Globe, RotateCcw } from 'lucide-react';
import { useChat } from '@/lib/hooks/useChat';
import MessageBubble from './MessageBubble';

export default function ChatInterface() {
  const [inputText, setInputText] = useState('');
  const [showSettings, setShowSettings] = useState(false);
  const [showLanguageSelect, setShowLanguageSelect] = useState(false);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);

  const {
    messages,
    isLoading,
    isRecording,
    language,
    sendMessage,
    startRecording,
    stopRecording,
    clearChat,
    setLanguage,
  } = useChat({
    language: 'ja',
    enableVoice: true,
  });

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Auto-focus input on load
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const handleSendMessage = async () => {
    if (!inputText.trim() || isLoading) return;
    
    const messageText = inputText.trim();
    setInputText('');
    
    await sendMessage(messageText);
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const handleVoiceToggle = async () => {
    if (isRecording) {
      await stopRecording();
    } else {
      await startRecording();
    }
  };

  const handlePlayAudio = (audioUrl: string) => {
    if (audioRef.current) {
      audioRef.current.src = audioUrl;
      audioRef.current.play();
    }
  };

  const getLanguageLabel = (lang: string) => {
    const labels = {
      ja: '日本語',
      en: 'English',
      zh: '中文',
      ko: '한국어'
    };
    return labels[lang as keyof typeof labels] || '日本語';
  };

  const getWelcomeMessage = () => {
    const messages = {
      ja: 'こんにちは！東京都の子育て支援情報についてお答えします。保育園、学童保育、子育て支援制度などについてお気軽にお聞きください。',
      en: 'Hello! I can help you with childcare support information in Tokyo. Feel free to ask about nursery schools, after-school care, childcare support systems, and more.',
      zh: '您好！我可以为您提供东京都的育儿支援信息。请随时询问保育园、学童保育、育儿支援制度等相关问题。',
      ko: '안녕하세요! 도쿄도의 육아 지원 정보에 대해 답변해 드립니다. 보육원, 학동보육, 육아지원제도 등에 대해 언제든지 문의해 주세요.'
    };
    return messages[language as keyof typeof messages] || messages.ja;
  };

  return (
    <div className="flex flex-col h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-tokyo-blue text-white p-4 shadow-md">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 bg-white rounded-full flex items-center justify-center">
              <span className="text-tokyo-blue font-bold text-sm">都</span>
            </div>
            <div>
              <h1 className="font-bold text-lg">東京都AI音声対話</h1>
              <p className="text-sm text-blue-100">子育て支援情報アシスタント</p>
            </div>
          </div>
          
          <div className="flex items-center space-x-2">
            {/* Language Selector */}
            <div className="relative">
              <button
                onClick={() => setShowLanguageSelect(!showLanguageSelect)}
                className="flex items-center space-x-1 px-3 py-1 rounded-md bg-white bg-opacity-20 hover:bg-opacity-30 transition-colors"
              >
                <Globe className="w-4 h-4" />
                <span className="text-sm">{getLanguageLabel(language)}</span>
              </button>
              
              {showLanguageSelect && (
                <div className="absolute top-full right-0 mt-2 bg-white rounded-md shadow-lg border z-50 min-w-32">
                  {['ja', 'en'].map((lang) => (
                    <button
                      key={lang}
                      onClick={async () => {
                        await setLanguage(lang as 'ja' | 'en');
                        setShowLanguageSelect(false);
                      }}
                      className={`block w-full text-left px-4 py-2 text-sm hover:bg-gray-100 ${
                        language === lang ? 'bg-gray-100 font-medium' : ''
                      } ${lang === 'ja' ? 'rounded-t-md' : ''} ${lang === 'en' ? 'rounded-b-md' : ''}`}
                    >
                      {getLanguageLabel(lang)}
                    </button>
                  ))}
                </div>
              )}
            </div>
            
            {/* Clear Chat Button */}
            <button
              onClick={async () => await clearChat()}
              className="p-2 rounded-md bg-white bg-opacity-20 hover:bg-opacity-30 transition-colors"
              title="チャットをクリア"
            >
              <RotateCcw className="w-4 h-4" />
            </button>
          </div>
        </div>
      </header>

      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 && (
          <div className="text-center py-8">
            <div className="max-w-md mx-auto bg-white rounded-lg p-6 border">
              <h2 className="text-lg font-semibold text-gray-800 mb-2">
                {language === 'ja' ? 'ようこそ！' : 'Welcome!'}
              </h2>
              <p className="text-gray-600 text-sm leading-relaxed">
                {getWelcomeMessage()}
              </p>
            </div>
          </div>
        )}
        
        {messages.map((message) => (
          <MessageBubble
            key={message.id}
            message={message}
            onPlayAudio={handlePlayAudio}
          />
        ))}
        
        {isLoading && (
          <div className="flex justify-start">
            <div className="bg-white border border-gray-200 rounded-lg px-4 py-2 max-w-xs">
              <div className="flex items-center space-x-2">
                <div className="flex space-x-1">
                  <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></div>
                  <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
                  <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                </div>
                <span className="text-sm text-gray-500">
                  {language === 'ja' ? '入力中...' : 'Typing...'}
                </span>
              </div>
            </div>
          </div>
        )}
        
        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <div className="border-t bg-white p-4">
        <div className="flex items-end space-x-2">
          <div className="flex-1">
            <textarea
              ref={inputRef}
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder={
                language === 'ja' 
                  ? 'メッセージを入力してください...' 
                  : 'Enter your message...'
              }
              className="w-full p-3 border border-gray-300 rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-tokyo-blue focus:border-transparent"
              rows={1}
              disabled={isLoading}
            />
          </div>
          
          {/* Voice Input Button */}
          <button
            onClick={handleVoiceToggle}
            disabled={isLoading}
            className={`p-3 rounded-lg transition-colors duration-200 ${
              isRecording
                ? 'bg-red-500 text-white voice-recording'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            } ${isLoading ? 'opacity-50 cursor-not-allowed' : ''}`}
            title={isRecording ? '録音停止' : '音声入力'}
          >
            {isRecording ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
          </button>
          
          {/* Send Button */}
          <button
            onClick={handleSendMessage}
            disabled={!inputText.trim() || isLoading}
            className={`p-3 rounded-lg transition-colors duration-200 ${
              inputText.trim() && !isLoading
                ? 'bg-tokyo-blue text-white hover:bg-blue-700'
                : 'bg-gray-100 text-gray-400 cursor-not-allowed'
            }`}
            title="送信"
          >
            <Send className="w-5 h-5" />
          </button>
        </div>
        
        {/* Voice Recording Indicator */}
        {isRecording && (
          <div className="flex items-center justify-center mt-2 space-x-2">
            <div className="voice-visualizer">
              {[...Array(5)].map((_, i) => (
                <div
                  key={i}
                  className="voice-bar"
                  style={{ animationDelay: `${i * 0.1}s` }}
                />
              ))}
            </div>
            <span className="text-sm text-red-500">
              {language === 'ja' ? '録音中...' : 'Recording...'}
            </span>
          </div>
        )}
      </div>
      
      {/* Hidden audio element for playback */}
      <audio ref={audioRef} style={{ display: 'none' }} />
    </div>
  );
}