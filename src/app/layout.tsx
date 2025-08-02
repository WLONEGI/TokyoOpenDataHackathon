import type { Metadata } from 'next';
import { Inter, Noto_Sans_JP } from 'next/font/google';
import './globals.css';
import { LanguageProvider } from '@/lib/context/LanguageContext';
import { SessionProvider } from '@/lib/context/SessionContext';

const inter = Inter({ 
  subsets: ['latin'],
  variable: '--font-inter',
});

const notoSansJP = Noto_Sans_JP({ 
  subsets: ['latin'],
  variable: '--font-noto-sans-jp',
  weight: ['300', '400', '500', '700'],
});

export const metadata: Metadata = {
  title: '東京都AI音声アシスタント',
  description: '東京都の子育て支援情報を音声で簡単に検索・相談できるAIアシスタント',
  keywords: ['東京都', '子育て', '音声アシスタント', 'AI', '行政サービス'],
  authors: [{ name: '東京都' }],
  viewport: 'width=device-width, initial-scale=1',
  themeColor: '#0ea5e9',
  manifest: '/manifest.json',
  icons: {
    icon: '/favicon.ico',
    apple: '/apple-touch-icon.png',
  },
  openGraph: {
    title: '東京都AI音声アシスタント',
    description: '東京都の子育て支援情報を音声で簡単に検索・相談できるAIアシスタント',
    url: 'https://tokyo-ai-chat.metro.tokyo.lg.jp',
    siteName: '東京都AI音声アシスタント',
    images: [
      {
        url: '/og-image.png',
        width: 1200,
        height: 630,
        alt: '東京都AI音声アシスタント',
      },
    ],
    locale: 'ja_JP',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: '東京都AI音声アシスタント',
    description: '東京都の子育て支援情報を音声で簡単に検索・相談できるAIアシスタント',
    images: ['/og-image.png'],
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ja" className={`${inter.variable} ${notoSansJP.variable}`}>
      <head>
        <link rel="preconnect" href="https://generativelanguage.googleapis.com" />
        <link rel="dns-prefetch" href="//storage.googleapis.com" />
      </head>
      <body className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 font-sans antialiased">
        <SessionProvider>
          <LanguageProvider>
            <div className="flex flex-col min-h-screen">
              <header className="bg-white shadow-sm border-b border-gray-200">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                  <div className="flex justify-between items-center h-16">
                    <div className="flex items-center">
                      <h1 className="text-xl font-bold text-gray-900">
                        東京都AI音声アシスタント
                      </h1>
                    </div>
                    <div className="flex items-center space-x-4">
                      <span className="text-sm text-gray-500">MVP版</span>
                    </div>
                  </div>
                </div>
              </header>
              
              <main className="flex-1">
                {children}
              </main>
              
              <footer className="bg-white border-t border-gray-200 py-8">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                  <div className="text-center text-sm text-gray-500">
                    <p>© 2025 東京都. All rights reserved.</p>
                    <p className="mt-1">
                      子育て支援情報を音声で簡単に検索・相談できるAIアシスタント
                    </p>
                  </div>
                </div>
              </footer>
            </div>
          </LanguageProvider>
        </SessionProvider>
      </body>
    </html>
  );
}