'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { Send, Mic, MicOff, Globe, RotateCcw, Sparkles, Volume2, VolumeX, Brain } from 'lucide-react';
import { useChat } from '@/lib/hooks/useChat';
import { useChatStreaming } from '@/lib/hooks/useChatStreaming';
import MessageBubble from './MessageBubble';
import { ThemeToggleSimple } from '@/components/ui/ThemeToggle';
import { useToast } from '@/components/ui/Toast';
import { TypingIndicator, LoadingOverlay } from '@/components/ui/LoadingStates';
import { I18nProvider, useI18n } from '@/lib/i18n/I18nProvider';
import { LocationButton } from '@/components/ui/LocationButton';
import { ThinkingProcess } from '@/components/ui/ThinkingProcess';

function ChatInterfaceInner() {
  const { t, language, setLanguage } = useI18n();
  
  // Track language changes in the inner component
  useEffect(() => {
    console.log('ChatInterfaceInner: Language changed to:', language, 'Title:', t.nav.title);
  }, [language, t.nav.title]);
  const [inputText, setInputText] = useState('');
  const [showLanguageSelect, setShowLanguageSelect] = useState(false);
  const [enableSpeech, setEnableSpeech] = useState(true);
  const [thinkingMode, setThinkingMode] = useState(false);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const toast = useToast();

  const {
    messages,
    isLoading,
    isRecording,
    transcript,
    finalTranscript,
    interimTranscript,
    speechRecognitionSupported,
    location,
    locationError,
    locationLoading,
    locationPermission,
    sendMessage,
    startRecording,
    stopRecording,
    clearChat,
    setLanguage: setChatLanguage,
    cancelSpeech,
    isSpeaking,
    speechSupported,
    resetTranscript,
    requestLocation,
    clearLocation,
  } = useChat({
    language: language,
    enableVoice: true,
    enableLocation: true,
  });

  // Streaming functionality
  const {
    streamingState,
    startStreaming,
    stopStreaming,
    clearStreamingState
  } = useChatStreaming();

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Auto-focus input on load and setup keyboard shortcuts
  useEffect(() => {
    inputRef.current?.focus();

    // Keyboard shortcuts
    const handleKeyDown = (e: KeyboardEvent) => {
      // Focus input field with '/' key
      if (e.key === '/' && e.target !== inputRef.current) {
        e.preventDefault();
        inputRef.current?.focus();
      }
      
      // Clear chat with Ctrl+K or Cmd+K
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        clearChat();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [clearChat]);

  const handleSendMessage = async () => {
    if (!inputText.trim() || isLoading || streamingState.isStreaming) return;
    
    const messageText = inputText.trim();
    setInputText('');
    
    try {
      if (thinkingMode) {
        // 思考モード: ストリーミングAPIを使用
        // セッションIDを取得 (useChatフックから)
        const sessionId = messages.length > 0 ? 'default-session' : 'default-session'; // 実際の実装では適切なセッションIDを取得
        await startStreaming(messageText, sessionId, language);
      } else {
        // 通常モード: 既存のsendMessage使用
        await sendMessage(messageText, enableSpeech);
      }
    } catch (error) {
      console.error('Failed to send message:', error);
      toast.error(
        t.errors.messageFailed,
        t.errors.messageFailedDescription
      );
      // メッセージを入力フィールドに戻す
      setInputText(messageText);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const handleVoiceToggle = async () => {
    try {
      if (isRecording) {
        await stopRecording();
      } else {
        await startRecording();
        toast.info(t.success.voiceRecordingStarted, t.success.voiceRecordingStartedDescription);
      }
    } catch (error) {
      console.error('Voice recording error:', error);
      toast.error(
        t.errors.voiceRecordingError,
        t.errors.voiceRecordingErrorDescription
      );
    }
  };


  const getLanguageLabel = (lang: string) => {
    const labels = {
      ja: '日本語',
      en: 'English',
      zh: '中文',
      ko: '한국어',
    };
    return labels[lang as keyof typeof labels] || '日本語';
  };

  return (
    <div className="flex flex-col h-screen bg-primary-50 dark:bg-primary-900">
      {/* Modern Header */}
      <header 
        className="bg-white dark:bg-primary-800 border-b border-primary-100 dark:border-primary-700 px-6 py-4"
        role="banner"
        aria-label={t.a11y.applicationHeader}
      >
        <div className="flex items-center justify-between max-w-6xl mx-auto">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-gradient-to-br from-tokyo-500 to-tokyo-700 rounded-xl flex items-center justify-center shadow-sm">
              <Sparkles className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="font-semibold text-primary-900 dark:text-primary-100 text-lg">{t.nav.title}</h1>
              <p className="text-sm text-primary-600 dark:text-primary-300">
                {t.nav.subtitle}
              </p>
            </div>
          </div>
          
          <div className="flex items-center space-x-2">
            {/* Location Button */}
            <LocationButton
              location={location}
              loading={locationLoading}
              error={locationError}
              permission={locationPermission}
              onRequestLocation={requestLocation}
              onClearLocation={clearLocation}
              className="h-9"
            />
            
            {/* Language Selector */}
            <div className="relative">
              <button
                onClick={() => setShowLanguageSelect(!showLanguageSelect)}
                className="btn-ghost flex items-center space-x-2"
              >
                <Globe className="w-4 h-4" />
                <span className="text-sm">{getLanguageLabel(language)}</span>
              </button>
              
              {showLanguageSelect && (
                <div className="absolute top-full right-0 mt-2 bg-white dark:bg-primary-800 rounded-xl shadow-lg border border-primary-100 dark:border-primary-700 z-50 min-w-36 overflow-hidden">
                  {['ja', 'en', 'zh', 'ko'].map((lang) => (
                    <button
                      key={lang}
                      onClick={async () => {
                        try {
                          const newLang = lang as 'ja' | 'en' | 'zh' | 'ko';
                          console.log('Language change from', language, 'to', newLang);
                          
                          // I18nProviderの言語を更新
                          setLanguage(newLang);
                          
                          // チャットサービスの言語も更新
                          await setChatLanguage(newLang);
                          
                          setShowLanguageSelect(false);
                        } catch (error) {
                          console.error('Language change error:', error);
                          toast.error(t.errors.languageChangeFailed);
                        }
                      }}
                      className={`block w-full text-left px-4 py-3 text-sm hover:bg-primary-50 dark:hover:bg-primary-700 transition-colors ${
                        language === lang ? 'bg-primary-50 dark:bg-primary-700 font-medium text-primary-900 dark:text-primary-100' : 'text-primary-600 dark:text-primary-300'
                      }`}
                    >
                      {getLanguageLabel(lang)}
                    </button>
                  ))}
                </div>
              )}
            </div>
            
            {/* Speech Toggle Button */}
            {speechSupported && (
              <button
                onClick={() => {
                  if (isSpeaking()) {
                    cancelSpeech();
                  }
                  setEnableSpeech(!enableSpeech);
                }}
                className={`btn-ghost ${enableSpeech ? 'text-tokyo-600' : 'text-primary-400'}`}
                title={enableSpeech ? t.nav.disableSpeech : t.nav.enableSpeech}
              >
                {enableSpeech ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
              </button>
            )}
            
            {/* Thinking Mode Toggle */}
            <button
              onClick={() => setThinkingMode(!thinkingMode)}
              className={`btn-ghost ${thinkingMode ? 'text-tokyo-600' : ''}`}
              title={thinkingMode ? '思考モードをOFF' : '思考モードをON'}
            >
              <Brain className={`w-4 h-4 ${thinkingMode ? 'text-tokyo-600' : ''}`} />
            </button>

            {/* Theme Toggle */}
            <ThemeToggleSimple />
            
            {/* Clear Chat Button */}
            <button
              onClick={async () => {
                try {
                  await clearChat();
                  clearStreamingState(); // ストリーミング状態もクリア
                  // 通知を表示しない
                } catch (error) {
                  console.error('Clear chat error:', error);
                  toast.error(t.errors.clearChatFailed);
                }
              }}
              className="btn-ghost"
              title={t.nav.clearChat}
            >
              <RotateCcw className="w-4 h-4" />
            </button>
          </div>
        </div>
      </header>

      {/* Messages Area */}
      <main 
        className="flex-1 overflow-y-auto px-6 py-8 custom-scrollbar"
        role="main"
        aria-label={t.a11y.chatMessages}
        aria-live="polite"
        aria-relevant="additions"
      >
        <div className="max-w-4xl mx-auto space-y-6">
          {messages.length === 0 && (
            <div className="empty-state">
              <div className="empty-state-content">
                <div className="w-16 h-16 bg-gradient-to-br from-tokyo-400 to-tokyo-600 rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-soft">
                  <Sparkles className="w-8 h-8 text-white" />
                </div>
                <h2 className="empty-state-title">
                  {t.chat.welcomeTitle}
                </h2>
                <p className="empty-state-description">
                  {t.chat.welcomeMessage}
                </p>
              </div>
            </div>
          )}
          
          {/* 思考過程の表示 (ストリーミング中) */}
          {thinkingMode && streamingState.isStreaming && (
            <ThinkingProcess
              visible={true}
              steps={streamingState.steps}
              onComplete={() => {
                // ストリーミング完了時の処理
                if (streamingState.finalResult) {
                  // 最終結果をメッセージとして追加する処理が必要
                  console.log('Streaming completed:', streamingState.finalResult);
                }
              }}
            />
          )}

          {messages.map((message) => (
            <MessageBubble
              key={message.id}
              message={message}
            />
          ))}
          
          {isLoading && (
            <TypingIndicator name="AI" />
          )}
          
          <div ref={messagesEndRef} />
        </div>
      </main>

      {/* Modern Input Area */}
      <div className="bg-white dark:bg-primary-800 border-t border-primary-100 dark:border-primary-700 px-6 py-4">
        <div className="max-w-4xl mx-auto">
          {/* Voice Recording Indicator */}
          {isRecording && (
            <div className="mb-4">
              <div className="voice-indicator">
                <div className="voice-waveform">
                  <div className="voice-bar"></div>
                  <div className="voice-bar"></div>
                  <div className="voice-bar"></div>
                  <div className="voice-bar"></div>
                  <div className="voice-bar"></div>
                </div>
                <span className="text-sm font-medium">
                  {t.chat.recording}
                </span>
              </div>
              
              {/* Real-time Transcription Display */}
              {speechRecognitionSupported && (
                <div className="mt-3 p-3 bg-primary-50 dark:bg-primary-800 rounded-lg border-l-4 border-tokyo-500">
                  <div className="text-sm text-primary-600 dark:text-primary-300 mb-2">
                    リアルタイム文字起こし:
                  </div>
                  <div className="text-base text-primary-900 dark:text-primary-100 min-h-6">
                    {finalTranscript && (
                      <span className="text-primary-900 dark:text-primary-100">
                        {finalTranscript}
                      </span>
                    )}
                    {interimTranscript && (
                      <span className="text-primary-500 dark:text-primary-400 italic">
                        {interimTranscript}
                      </span>
                    )}
                    {!finalTranscript && !interimTranscript && (
                      <span className="text-primary-400 dark:text-primary-500">
                        話してください...
                      </span>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
          
          <div className="flex items-end space-x-3">
              <div className="flex-1">
                <textarea
                ref={inputRef}
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder={t.chat.inputPlaceholder}
                className="input-modern resize-none h-12 min-h-12 max-h-32"
                rows={1}
                disabled={false}
                aria-label={t.a11y.messageInputField}
                aria-describedby="input-help"
                aria-invalid={false}
                style={{
                  height: 'auto',
                  minHeight: '3rem',
                }}
                onInput={(e) => {
                  const target = e.target as HTMLTextAreaElement;
                  target.style.height = 'auto';
                  target.style.height = `${Math.min(target.scrollHeight, 128)}px`;
                }}
              />
            </div>
            
            {/* Voice Input Button */}
            <button
              onClick={handleVoiceToggle}
              disabled={false}
              className={`w-12 h-12 rounded-xl flex items-center justify-center transition-all duration-200 ${
                isRecording
                  ? 'bg-error text-white shadow-lg animate-pulse-subtle'
                  : 'bg-primary-100 text-primary-600 hover:bg-primary-200'
              } ${isLoading ? 'opacity-50 cursor-not-allowed' : ''}`}
              aria-label={isRecording ? t.chat.stopVoiceInput : t.chat.startVoiceInput}
              aria-pressed={isRecording}
              type="button"
            >
              {isRecording ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
            </button>
            
            {/* Send Button */}
            <button
              onClick={handleSendMessage}
              disabled={!inputText.trim()}
              className={`w-12 h-12 rounded-xl flex items-center justify-center transition-all duration-200 ${
                inputText.trim()
                  ? 'bg-primary-900 text-white hover:bg-primary-800 shadow-sm'
                  : 'bg-primary-100 text-primary-400 cursor-not-allowed'
              }`}
              aria-label={t.chat.sendMessage}
              type="submit"
              aria-disabled={!inputText.trim()}
            >
              <Send className="w-5 h-5" />
            </button>
            </div>
        </div>
      </div>
      
      {/* Hidden audio element for playback */}
      <audio ref={audioRef} style={{ display: 'none' }} />
    </div>
  );
}

export default function ChatInterface() {
  const [currentLanguage, setCurrentLanguage] = useState<'ja' | 'en' | 'zh' | 'ko'>('ja');

  const handleLanguageChange = useCallback((language: 'ja' | 'en' | 'zh' | 'ko') => {
    console.log('ChatInterface: Language change handler called with:', language);
    setCurrentLanguage(language);
    console.log('ChatInterface: State updated to:', language);
  }, []);

  useEffect(() => {
    console.log('ChatInterface: Current language state changed to:', currentLanguage);
  }, [currentLanguage]);

  return (
    <I18nProvider language={currentLanguage} onLanguageChange={handleLanguageChange}>
      <ChatInterfaceInner />
    </I18nProvider>
  );
}