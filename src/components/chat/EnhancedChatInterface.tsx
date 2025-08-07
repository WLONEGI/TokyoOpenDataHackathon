'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { Send, Mic, MicOff, Globe, RotateCcw, Sparkles, Volume2, VolumeX, Upload, BarChart3, Settings } from 'lucide-react';
import { useChat } from '@/lib/hooks/useChat';
import MessageBubble from './MessageBubble';
import { ThemeToggleSimple } from '@/components/ui/ThemeToggle';
import { useToast } from '@/components/ui/Toast';
import { LoadingOverlay } from '@/components/ui/LoadingStates';
import { I18nProvider, useI18n } from '@/lib/i18n/I18nProvider';
import SearchSuggestions from '@/components/ui/SearchSuggestions';
import { TypingIndicator, MultiStageTypingIndicator } from '@/components/ui/TypingIndicator';
import FileUploader from '@/components/ui/FileUploader';
import Dashboard from '@/components/ui/Dashboard';

function EnhancedChatInterfaceInner() {
  const { t, language, setLanguage } = useI18n();
  
  const [inputText, setInputText] = useState('');
  const [showLanguageSelect, setShowLanguageSelect] = useState(false);
  const [enableSpeech, setEnableSpeech] = useState(true);
  const [showDashboard, setShowDashboard] = useState(false);
  const [showFileUploader, setShowFileUploader] = useState(false);
  const [showAdvancedInput, setShowAdvancedInput] = useState(false);
  const [processingStage, setProcessingStage] = useState(-1);
  
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
    sendMessage,
    startRecording,
    stopRecording,
    clearChat,
    setLanguage: setChatLanguage,
    cancelSpeech,
    isSpeaking,
    speechSupported,
    resetTranscript,
  } = useChat({
    language: language,
    enableVoice: true,
  });

  // Processing stages for multi-stage typing indicator
  const processingStages = [
    {
      id: 'analyzing',
      message: 'ユーザーの質問を分析中...',
      icon: <Sparkles className="w-3 h-3" />
    },
    {
      id: 'searching',
      message: '東京オープンデータを検索中...',
      icon: <BarChart3 className="w-3 h-3" />
    },
    {
      id: 'integrating',
      message: '情報を統合中...',
      icon: <Settings className="w-3 h-3" />
    },
    {
      id: 'generating',
      message: '回答を生成中...',
      icon: <Sparkles className="w-3 h-3" />
    }
  ];

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Auto-focus input on load and setup keyboard shortcuts
  useEffect(() => {
    inputRef.current?.focus();

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

      // Toggle dashboard with Ctrl+D or Cmd+D
      if ((e.ctrlKey || e.metaKey) && e.key === 'd') {
        e.preventDefault();
        setShowDashboard(!showDashboard);
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [clearChat, showDashboard]);

  // Simulate processing stages when loading
  useEffect(() => {
    if (isLoading) {
      let stage = 0;
      setProcessingStage(0);
      
      const interval = setInterval(() => {
        stage++;
        if (stage < processingStages.length) {
          setProcessingStage(stage);
        } else {
          clearInterval(interval);
        }
      }, 1500);

      return () => {
        clearInterval(interval);
        setProcessingStage(-1);
      };
    } else {
      setProcessingStage(-1);
    }
  }, [isLoading, processingStages.length]);

  const handleSendMessage = async () => {
    if (!inputText.trim() || isLoading) return;
    
    const messageText = inputText.trim();
    setInputText('');
    
    try {
      await sendMessage(messageText, enableSpeech);
    } catch (error) {
      console.error('Failed to send message:', error);
      toast.error(
        t.errors.messageFailed,
        t.errors.messageFailedDescription
      );
      setInputText(messageText);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const handleSuggestionSelect = (suggestion: string) => {
    setInputText(suggestion);
    inputRef.current?.focus();
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

  const handleFileUpload = async (files: File[]) => {
    try {
      // Process uploaded files
      for (const file of files) {
        if (file.type.startsWith('image/')) {
          toast.success('画像をアップロードしました', `${file.name} を分析中...`);
        } else if (file.type === 'application/pdf') {
          toast.success('PDFをアップロードしました', `${file.name} を解析中...`);
        } else {
          toast.success('ファイルをアップロードしました', `${file.name} を処理中...`);
        }
      }
    } catch (error) {
      console.error('File upload error:', error);
      toast.error('ファイルアップロードエラー', 'ファイルの処理に失敗しました');
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

  if (showDashboard) {
    return (
      <div className="flex flex-col h-screen bg-primary-50 dark:bg-primary-900">
        {/* Dashboard Header */}
        <header className="bg-white dark:bg-primary-800 border-b border-primary-100 dark:border-primary-700 px-6 py-4">
          <div className="flex items-center justify-between max-w-6xl mx-auto">
            <div className="flex items-center space-x-3">
              <button
                onClick={() => setShowDashboard(false)}
                className="btn-ghost"
              >
                ← チャットに戻る
              </button>
            </div>
            <ThemeToggleSimple />
          </div>
        </header>

        {/* Dashboard Content */}
        <main className="flex-1 overflow-y-auto px-6 py-8">
          <div className="max-w-7xl mx-auto">
            <Dashboard />
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen bg-primary-50 dark:bg-primary-900">
      {/* Enhanced Header */}
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
            {/* Dashboard Toggle */}
            <button
              onClick={() => setShowDashboard(true)}
              className="btn-ghost"
              title="ダッシュボードを表示"
            >
              <BarChart3 className="w-4 h-4" />
            </button>

            {/* File Upload Toggle */}
            <button
              onClick={() => setShowFileUploader(!showFileUploader)}
              className="btn-ghost"
              title="ファイルアップロード"
            >
              <Upload className="w-4 h-4" />
            </button>

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
                          setLanguage(newLang);
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
            
            {/* Theme Toggle */}
            <ThemeToggleSimple />
            
            {/* Clear Chat Button */}
            <button
              onClick={async () => {
                try {
                  await clearChat();
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

      {/* File Uploader */}
      {showFileUploader && (
        <div className="border-b border-primary-100 dark:border-primary-700 bg-white dark:bg-primary-800">
          <div className="max-w-4xl mx-auto px-6 py-4">
            <FileUploader
              onFileUpload={handleFileUpload}
              onFileRemove={(fileId) => console.log('File removed:', fileId)}
              className="max-w-2xl"
            />
          </div>
        </div>
      )}

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
          
          {messages.map((message) => (
            <MessageBubble
              key={message.id}
              message={message}
            />
          ))}
          
          {/* Enhanced Loading States */}
          {isLoading && (
            <div className="space-y-4">
              {processingStage >= 0 ? (
                <MultiStageTypingIndicator
                  stages={processingStages}
                  currentStage={processingStage}
                />
              ) : (
                <TypingIndicator name="AI" />
              )}
            </div>
          )}
          
          <div ref={messagesEndRef} />
        </div>
      </main>

      {/* Enhanced Input Area */}
      <div className="bg-white dark:bg-primary-800 border-t border-primary-100 dark:border-primary-700 px-6 py-4">
        <div className="max-w-4xl mx-auto space-y-4">
          {/* Search Suggestions */}
          {!isLoading && messages.length === 0 && (
            <SearchSuggestions
              query={inputText}
              onSuggestionSelect={handleSuggestionSelect}
              onQueryChange={setInputText}
              placeholder={t.chat.inputPlaceholder}
              disabled={isLoading}
            />
          )}

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
          
          {/* Standard Input for Chat Mode */}
          {messages.length > 0 && (
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
                  disabled={isLoading}
                  aria-label={t.a11y.messageInputField}
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
                disabled={isLoading}
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
                disabled={!inputText.trim() || isLoading}
                className={`w-12 h-12 rounded-xl flex items-center justify-center transition-all duration-200 ${
                  inputText.trim() && !isLoading
                    ? 'bg-primary-900 text-white hover:bg-primary-800 shadow-sm'
                    : 'bg-primary-100 text-primary-400 cursor-not-allowed'
                }`}
                aria-label={t.chat.sendMessage}
                type="submit"
                aria-disabled={!inputText.trim() || isLoading}
              >
                <Send className="w-5 h-5" />
              </button>
            </div>
          )}
        </div>
      </div>
      
      {/* Hidden audio element for playback */}
      <audio ref={audioRef} style={{ display: 'none' }} />
    </div>
  );
}

export default function EnhancedChatInterface() {
  const [currentLanguage, setCurrentLanguage] = useState<'ja' | 'en' | 'zh' | 'ko'>('ja');

  const handleLanguageChange = useCallback((language: 'ja' | 'en' | 'zh' | 'ko') => {
    setCurrentLanguage(language);
  }, []);

  return (
    <I18nProvider language={currentLanguage} onLanguageChange={handleLanguageChange}>
      <EnhancedChatInterfaceInner />
    </I18nProvider>
  );
}