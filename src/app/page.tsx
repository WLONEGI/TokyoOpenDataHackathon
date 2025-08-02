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
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-tokyo-blue mx-auto mb-4"></div>
          <p className="text-gray-600">読み込み中...</p>
        </div>
      </div>
    );
  }

  return (
    <main className="min-h-screen bg-gray-50">
      <ChatInterface />
      <PWAInstaller />
    </main>
  );
}