'use client';

import { useState, useEffect } from 'react';
import { Download, X } from 'lucide-react';

interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[];
  readonly userChoice: Promise<{
    outcome: 'accepted' | 'dismissed';
    platform: string;
  }>;
  prompt(): Promise<void>;
}

export default function PWAInstaller() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [showInstallButton, setShowInstallButton] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);

  useEffect(() => {
    // Check if running on iOS
    const iOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
    setIsIOS(iOS);

    // Check if running in standalone mode
    const standalone = window.matchMedia('(display-mode: standalone)').matches;
    setIsStandalone(standalone);

    // Listen for the beforeinstallprompt event
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      setShowInstallButton(true);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    // Check if app is already installed
    window.addEventListener('appinstalled', () => {
      setShowInstallButton(false);
      setDeferredPrompt(null);
    });

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, []);

  const handleInstallClick = async () => {
    if (!deferredPrompt) return;

    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    
    if (outcome === 'accepted') {
      console.log('User accepted the install prompt');
    } else {
      console.log('User dismissed the install prompt');
    }
    
    setDeferredPrompt(null);
    setShowInstallButton(false);
  };

  const handleDismiss = () => {
    setShowInstallButton(false);
  };

  // Don't show installer if already in standalone mode
  if (isStandalone) {
    return null;
  }

  // Show different UI for iOS devices
  if (isIOS && !isStandalone) {
    return (
      <div className="fixed bottom-4 left-4 right-4 bg-white border border-gray-200 rounded-lg shadow-lg p-4 z-50">
        <div className="flex items-start space-x-3">
          <div className="flex-shrink-0">
            <Download className="w-6 h-6 text-tokyo-blue" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="text-sm font-medium text-gray-900">
              ホーム画面に追加
            </h3>
            <p className="text-xs text-gray-500 mt-1">
              このアプリをホーム画面に追加するには、
              <span className="inline-block mx-1">
                <svg className="w-4 h-4 inline" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                  <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
                  <circle cx="9" cy="9" r="2"/>
                  <path d="M21 15l-3.086-3.086a2 2 0 00-2.828 0L6 21"/>
                </svg>
              </span>
              をタップして「ホーム画面に追加」を選択してください。
            </p>
          </div>
          <button
            onClick={handleDismiss}
            className="flex-shrink-0 p-1 text-gray-400 hover:text-gray-600"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>
    );
  }

  // Show install button for other browsers
  if (showInstallButton && deferredPrompt) {
    return (
      <div className="fixed bottom-4 right-4 z-50">
        <div className="bg-white border border-gray-200 rounded-lg shadow-lg p-4 max-w-sm">
          <div className="flex items-start space-x-3">
            <div className="flex-shrink-0">
              <Download className="w-6 h-6 text-tokyo-blue" />
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="text-sm font-medium text-gray-900">
                アプリをインストール
              </h3>
              <p className="text-xs text-gray-500 mt-1">
                このアプリをデバイスにインストールして、より快適にご利用いただけます。
              </p>
              <div className="flex space-x-2 mt-3">
                <button
                  onClick={handleInstallClick}
                  className="bg-tokyo-blue text-white px-3 py-1 rounded text-xs hover:bg-blue-700 transition-colors"
                >
                  インストール
                </button>
                <button
                  onClick={handleDismiss}
                  className="border border-gray-300 text-gray-700 px-3 py-1 rounded text-xs hover:bg-gray-50 transition-colors"
                >
                  後で
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return null;
}