'use client';

import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { Session, UserPreferences, Language } from '@/types';

interface SessionContextType {
  sessionId: string | null;
  session: Session | null;
  preferences: UserPreferences;
  isLoading: boolean;
  error: string | null;
  createSession: (preferences?: Partial<UserPreferences>) => Promise<void>;
  updatePreferences: (preferences: Partial<UserPreferences>) => Promise<void>;
  clearSession: () => void;
}

const defaultPreferences: UserPreferences = {
  voiceEnabled: true,
  language: 'ja',
  responseLength: 'normal',
};

const SessionContext = createContext<SessionContextType | undefined>(undefined);

export function SessionProvider({ children }: { children: React.ReactNode }) {
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [preferences, setPreferences] = useState<UserPreferences>(defaultPreferences);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // セッション作成
  const createSession = useCallback(async (initialPreferences?: Partial<UserPreferences>) => {
    setIsLoading(true);
    setError(null);
    
    try {
      const requestPreferences = {
        ...defaultPreferences,
        ...initialPreferences,
      };
      
      const response = await fetch('/api/session', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          preferences: requestPreferences,
        }),
      });
      
      if (!response.ok) {
        throw new Error(`セッション作成に失敗しました: ${response.status}`);
      }
      
      const { data } = await response.json();
      
      setSessionId(data.sessionId);
      setSession({
        id: data.sessionId,
        language: data.language,
        createdAt: new Date().toISOString(),
        lastAccessedAt: new Date().toISOString(),
        expiresAt: data.expiresAt,
        preferences: data.preferences,
      });
      setPreferences(data.preferences);
      
      // ローカルストレージに保存
      localStorage.setItem('sessionId', data.sessionId);
      localStorage.setItem('preferences', JSON.stringify(data.preferences));
      
    } catch (err) {
      console.error('Session creation error:', err);
      setError(err instanceof Error ? err.message : 'セッション作成に失敗しました');
    } finally {
      setIsLoading(false);
    }
  }, []);

  // 設定更新
  const updatePreferences = useCallback(async (newPreferences: Partial<UserPreferences>) => {
    if (!sessionId) return;
    
    const updatedPreferences = {
      ...preferences,
      ...newPreferences,
    };
    
    try {
      // 楽観的更新
      setPreferences(updatedPreferences);
      localStorage.setItem('preferences', JSON.stringify(updatedPreferences));
      
      // サーバー更新（非同期）
      const response = await fetch(`/api/session/${sessionId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'X-Session-ID': sessionId,
        },
        body: JSON.stringify({
          preferences: updatedPreferences,
        }),
      });
      
      if (!response.ok) {
        // エラー時はロールバック
        setPreferences(preferences);
        localStorage.setItem('preferences', JSON.stringify(preferences));
        throw new Error('設定の更新に失敗しました');
      }
      
    } catch (err) {
      console.error('Preferences update error:', err);
      setError(err instanceof Error ? err.message : '設定の更新に失敗しました');
    }
  }, [sessionId, preferences]);

  // セッションクリア
  const clearSession = useCallback(() => {
    setSessionId(null);
    setSession(null);
    setPreferences(defaultPreferences);
    setError(null);
    
    localStorage.removeItem('sessionId');
    localStorage.removeItem('preferences');
  }, []);

  // 既存セッションの復元を試行
  const restoreSession = useCallback(async () => {
    const savedSessionId = localStorage.getItem('sessionId');
    const savedPreferences = localStorage.getItem('preferences');
    
    if (!savedSessionId) {
      // 新しいセッションを作成
      await createSession();
      return;
    }
    
    setIsLoading(true);
    
    try {
      // セッションの有効性を確認
      const response = await fetch(`/api/session/${savedSessionId}`, {
        headers: {
          'X-Session-ID': savedSessionId,
        },
      });
      
      if (response.ok) {
        const { data } = await response.json();
        
        setSessionId(savedSessionId);
        setSession(data);
        setPreferences(data.preferences);
        
        // 保存された設定を使用
        if (savedPreferences) {
          try {
            const parsedPreferences = JSON.parse(savedPreferences);
            setPreferences({
              ...defaultPreferences,
              ...parsedPreferences,
            });
          } catch (e) {
            console.warn('Invalid saved preferences, using defaults');
          }
        }
      } else {
        // セッション無効の場合は新規作成
        clearSession();
        await createSession();
      }
    } catch (err) {
      console.error('Session restoration error:', err);
      // エラー時は新規セッション作成
      clearSession();
      await createSession();
    } finally {
      setIsLoading(false);
    }
  }, [createSession, clearSession]);

  // 初期化時にセッション復元を試行
  useEffect(() => {
    restoreSession();
  }, [restoreSession]);

  // セッション期限チェック
  useEffect(() => {
    if (!session) return;
    
    const checkExpiration = () => {
      const now = new Date();
      const expiresAt = new Date(session.expiresAt);
      
      if (now >= expiresAt) {
        console.log('Session expired, creating new session');
        clearSession();
        createSession();
      }
    };
    
    // 5分ごとにチェック
    const interval = setInterval(checkExpiration, 5 * 60 * 1000);
    
    return () => clearInterval(interval);
  }, [session, clearSession, createSession]);

  const value: SessionContextType = {
    sessionId,
    session,
    preferences,
    isLoading,
    error,
    createSession,
    updatePreferences,
    clearSession,
  };

  return (
    <SessionContext.Provider value={value}>
      {children}
    </SessionContext.Provider>
  );
}

export function useSession() {
  const context = useContext(SessionContext);
  if (context === undefined) {
    throw new Error('useSession must be used within a SessionProvider');
  }
  return context;
}