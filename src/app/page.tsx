'use client';

import { useEffect, useState } from 'react';
import ChatInterface from '@/components/chat/ChatInterface';
import PWAInstaller from '@/components/ui/PWAInstaller';

export default function Home() {
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
  }, []);

  if (!isClient) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-primary-50">
        <div className="text-center">
          <div className="w-12 h-12 border-2 border-primary-300 border-t-primary-900 rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-primary-600 font-medium">読み込み中...</p>
        </div>
      </div>
    );
  }

  return (
    <main className="min-h-screen bg-primary-50">
      <ChatInterface />
      <PWAInstaller />
    </main>
  );
}