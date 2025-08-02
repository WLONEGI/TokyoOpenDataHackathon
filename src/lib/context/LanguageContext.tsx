'use client';

import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { Language, Translation } from '@/types';

// 翻訳データ
const translations: Record<Language, Translation> = {
  ja: {
    // アプリ全般
    appTitle: '東京都AI音声アシスタント',
    welcomeTitle: '子育て支援情報をお気軽にお尋ねください',
    welcomeDescription: '東京都の子育て・育児に関する情報を、音声またはテキストで簡単に検索できます。保育園、手当、予防接種など、お困りのことがあればお気軽にお聞きください。',
    
    // 入力モード
    voiceMode: '音声入力',
    textMode: 'テキスト入力',
    
    // よくある質問
    exampleQuestions: 'よくある質問',
    
    // 音声関連
    startRecording: '録音開始',
    stopRecording: '録音停止',
    recording: '録音中...',
    processing: '処理中...',
    tapToSpeak: 'タップして話してください',
    listening: '聞いています...',
    recognizing: '認識中...',
    
    // チャット関連
    typeMessage: 'メッセージを入力してください...',
    send: '送信',
    thinking: '考えています...',
    retry: '再試行',
    
    // エラーメッセージ
    errorGeneral: 'エラーが発生しました',
    errorNetwork: 'ネットワークエラーが発生しました',
    errorMicrophone: 'マイクへのアクセスが許可されていません',
    errorRecording: '録音中にエラーが発生しました',
    errorProcessing: '音声処理中にエラーが発生しました',
    
    // 設定
    settings: '設定',
    language: '言語',
    voiceSettings: '音声設定',
    autoPlay: '自動再生',
    volume: '音量',
    speed: '話速',
    
    // 注意事項
    noticeTitle: 'ご利用にあたって',
    notice1: 'このサービスはMVP版です。提供される情報は参考程度にご利用ください。',
    notice2: '正確な情報については、各区市町村の窓口にお問い合わせください。',
    notice3: '音声データは一時的に処理されますが、個人情報として保存されることはありません。',
    
    // 共通
    close: '閉じる',
    cancel: 'キャンセル',
    confirm: '確認',
    loading: '読み込み中...',
    yes: 'はい',
    no: 'いいえ',
  },
  en: {
    // アプリ全般
    appTitle: 'Tokyo AI Voice Assistant',
    welcomeTitle: 'Ask about childcare support information',
    welcomeDescription: 'You can easily search for information about childcare and parenting in Tokyo using voice or text. Feel free to ask about nurseries, allowances, vaccinations, and any other concerns.',
    
    // 入力モード
    voiceMode: 'Voice Input',
    textMode: 'Text Input',
    
    // よくある質問
    exampleQuestions: 'Frequently Asked Questions',
    
    // 音声関連
    startRecording: 'Start Recording',
    stopRecording: 'Stop Recording',
    recording: 'Recording...',
    processing: 'Processing...',
    tapToSpeak: 'Tap to speak',
    listening: 'Listening...',
    recognizing: 'Recognizing...',
    
    // チャット関連
    typeMessage: 'Type your message...',
    send: 'Send',
    thinking: 'Thinking...',
    retry: 'Retry',
    
    // エラーメッセージ
    errorGeneral: 'An error occurred',
    errorNetwork: 'Network error occurred',
    errorMicrophone: 'Microphone access not permitted',
    errorRecording: 'Error occurred during recording',
    errorProcessing: 'Error occurred during voice processing',
    
    // 設定
    settings: 'Settings',
    language: 'Language',
    voiceSettings: 'Voice Settings',
    autoPlay: 'Auto Play',
    volume: 'Volume',
    speed: 'Speed',
    
    // 注意事項
    noticeTitle: 'Notice',
    notice1: 'This service is an MVP version. Please use the provided information for reference only.',
    notice2: 'For accurate information, please contact your local municipal office.',
    notice3: 'Voice data is processed temporarily but is not stored as personal information.',
    
    // 共通
    close: 'Close',
    cancel: 'Cancel',
    confirm: 'Confirm',
    loading: 'Loading...',
    yes: 'Yes',
    no: 'No',
  },
};

interface LanguageContextType {
  currentLanguage: Language;
  setLanguage: (language: Language) => void;
  t: (key: string, fallback?: string) => string;
  isRTL: boolean;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [currentLanguage, setCurrentLanguage] = useState<Language>('ja');

  // ブラウザの言語設定から初期言語を検出
  useEffect(() => {
    const detectLanguage = (): Language => {
      if (typeof window === 'undefined') return 'ja';
      
      const browserLang = navigator.language.toLowerCase();
      
      if (browserLang.startsWith('en')) return 'en';
      if (browserLang.startsWith('ja')) return 'ja';
      
      // デフォルトは日本語
      return 'ja';
    };
    
    const savedLanguage = localStorage.getItem('language') as Language;
    if (savedLanguage && ['ja', 'en'].includes(savedLanguage)) {
      setCurrentLanguage(savedLanguage);
    } else {
      const detectedLanguage = detectLanguage();
      setCurrentLanguage(detectedLanguage);
      localStorage.setItem('language', detectedLanguage);
    }
  }, []);

  const setLanguage = useCallback((language: Language) => {
    setCurrentLanguage(language);
    localStorage.setItem('language', language);
    
    // HTML lang属性を更新
    if (typeof document !== 'undefined') {
      document.documentElement.lang = language;
    }
  }, []);

  const t = useCallback((key: string, fallback?: string): string => {
    const keys = key.split('.');
    let value: any = translations[currentLanguage];
    
    for (const k of keys) {
      if (value && typeof value === 'object' && k in value) {
        value = value[k];
      } else {
        // フォールバック: 日本語の翻訳を試す
        if (currentLanguage !== 'ja') {
          let jaValue: any = translations.ja;
          for (const k of keys) {
            if (jaValue && typeof jaValue === 'object' && k in jaValue) {
              jaValue = jaValue[k];
            } else {
              jaValue = undefined;
              break;
            }
          }
          if (typeof jaValue === 'string') {
            return jaValue;
          }
        }
        
        // 最後のフォールバック
        return fallback || key;
      }
    }
    
    return typeof value === 'string' ? value : fallback || key;
  }, [currentLanguage]);

  const isRTL = false; // 日本語・英語はLTR

  const value: LanguageContextType = {
    currentLanguage,
    setLanguage,
    t,
    isRTL,
  };

  return (
    <LanguageContext.Provider value={value}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (context === undefined) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
}