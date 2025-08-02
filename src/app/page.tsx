'use client';

import { useState, useEffect } from 'react';
import { Mic, MessageSquare, Settings, HelpCircle } from 'lucide-react';
import dynamic from 'next/dynamic';
import ChatInterface from '@/components/chat/ChatInterface';
import VoiceRecorder from '@/components/voice/VoiceRecorder';
import LanguageSelector from '@/components/ui/LanguageSelector';
import { useLanguage } from '@/lib/context/LanguageContext';
import { useSession } from '@/lib/context/SessionContext';

// 音声機能は動的インポートでクライアントサイドのみ
const VoiceInterface = dynamic(
  () => import('@/components/voice/VoiceInterface'),
  { 
    ssr: false,
    loading: () => (
      <div className="flex items-center justify-center p-8">
        <div className="loading-dots">
          <div className="loading-dot"></div>
          <div className="loading-dot"></div>
          <div className="loading-dot"></div>
        </div>
      </div>
    )
  }
);

export default function HomePage() {
  const [activeMode, setActiveMode] = useState<'voice' | 'text'>('voice');
  const [isClient, setIsClient] = useState(false);
  const { currentLanguage, t } = useLanguage();
  const { sessionId, isLoading: sessionLoading } = useSession();

  useEffect(() => {
    setIsClient(true);
  }, []);

  const exampleQuestions = [
    {
      ja: '近くの保育園を教えてください',
      en: 'Tell me about nearby nurseries'
    },
    {
      ja: '児童手当の申請方法は？',
      en: 'How to apply for child allowance?'
    },
    {
      ja: '予防接種のスケジュールについて',
      en: 'About vaccination schedule'
    },
    {
      ja: '子育て相談窓口はありますか？',
      en: 'Are there childcare consultation services?'
    }
  ];

  if (!isClient) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="loading-dots">
          <div className="loading-dot"></div>
          <div className="loading-dot"></div>
          <div className="loading-dot"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      {/* ヘッダー */}
      <div className="bg-white shadow-sm">
        <div className="center-container py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <div className="w-8 h-8 bg-tokyo-500 rounded-lg flex items-center justify-center">
                <MessageSquare className="w-5 h-5 text-white" />
              </div>
              <h1 className="text-xl font-bold text-gray-900 font-japanese">
                {t('appTitle', '東京都AI音声アシスタント')}
              </h1>
            </div>
            <div className="flex items-center space-x-2">
              <LanguageSelector />
              <button className="p-2 text-gray-500 hover:text-gray-700 rounded-lg hover:bg-gray-100">
                <Settings className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* メインコンテンツ */}
      <div className="center-container py-8">
        {/* 説明セクション */}
        <div className="text-center mb-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-4 font-japanese">
            {t('welcomeTitle', '子育て支援情報をお気軽にお尋ねください')}
          </h2>
          <p className="text-gray-600 max-w-2xl mx-auto font-japanese">
            {t('welcomeDescription', 
              '東京都の子育て・育児に関する情報を、音声またはテキストで簡単に検索できます。保育園、手当、予防接種など、お困りのことがあればお気軽にお聞きください。'
            )}
          </p>
        </div>

        {/* モード切り替え */}
        <div className="flex justify-center mb-8">
          <div className="bg-white rounded-lg p-1 shadow-md">
            <div className="flex space-x-1">
              <button
                onClick={() => setActiveMode('voice')}
                className={`flex items-center space-x-2 px-4 py-2 rounded-md transition-colors ${
                  activeMode === 'voice'
                    ? 'bg-tokyo-500 text-white'
                    : 'text-gray-600 hover:bg-gray-100'
                }`}
              >
                <Mic className="w-4 h-4" />
                <span className="font-japanese">
                  {t('voiceMode', '音声入力')}
                </span>
              </button>
              <button
                onClick={() => setActiveMode('text')}
                className={`flex items-center space-x-2 px-4 py-2 rounded-md transition-colors ${
                  activeMode === 'text'
                    ? 'bg-tokyo-500 text-white'
                    : 'text-gray-600 hover:bg-gray-100'
                }`}
              >
                <MessageSquare className="w-4 h-4" />
                <span className="font-japanese">
                  {t('textMode', 'テキスト入力')}
                </span>
              </button>
            </div>
          </div>
        </div>

        {/* インターフェース */}
        <div className="max-w-4xl mx-auto">
          {activeMode === 'voice' ? (
            <VoiceInterface />
          ) : (
            <ChatInterface />
          )}
        </div>

        {/* よくある質問 */}
        <div className="mt-12">
          <h3 className="text-lg font-semibold text-gray-900 mb-6 text-center font-japanese">
            {t('exampleQuestions', 'よくある質問')}
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-4xl mx-auto">
            {exampleQuestions.map((question, index) => (
              <button
                key={index}
                onClick={() => {
                  // TODO: 質問を自動入力する機能
                  console.log('Selected question:', question[currentLanguage]);
                }}
                className="card card-padding text-left hover:shadow-lg transition-shadow duration-200 group"
              >
                <div className="flex items-start space-x-3">
                  <HelpCircle className="w-5 h-5 text-tokyo-500 mt-0.5 group-hover:text-tokyo-600" />
                  <span className="text-gray-700 group-hover:text-gray-900 font-japanese">
                    {question[currentLanguage]}
                  </span>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* 注意事項 */}
        <div className="mt-12 max-w-2xl mx-auto">
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
            <div className="flex items-start space-x-3">
              <div className="w-5 h-5 text-yellow-600 mt-0.5">
                ⚠️
              </div>
              <div className="text-sm text-yellow-800 font-japanese">
                <p className="font-semibold mb-2">
                  {t('noticeTitle', 'ご利用にあたって')}
                </p>
                <ul className="space-y-1 text-xs">
                  <li>
                    {t('notice1', 'このサービスはMVP版です。提供される情報は参考程度にご利用ください。')}
                  </li>
                  <li>
                    {t('notice2', '正確な情報については、各区市町村の窓口にお問い合わせください。')}
                  </li>
                  <li>
                    {t('notice3', '音声データは一時的に処理されますが、個人情報として保存されることはありません。')}
                  </li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}