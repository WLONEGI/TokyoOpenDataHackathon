import { SessionData, Message } from '@/types';

export class SessionManager {
  private static instance: SessionManager;
  private sessions: Map<string, SessionData> = new Map();
  private messages: Map<string, Message[]> = new Map();

  private constructor() {}

  static getInstance(): SessionManager {
    if (!SessionManager.instance) {
      SessionManager.instance = new SessionManager();
    }
    return SessionManager.instance;
  }

  createSession(sessionId: string, language: 'ja' | 'en' | 'zh' | 'ko' = 'ja'): SessionData {
    const session: SessionData = {
      id: sessionId,
      language,
      createdAt: new Date(),
      lastActivity: new Date(),
      messageCount: 0,
    };

    this.sessions.set(sessionId, session);
    this.messages.set(sessionId, []);

    return session;
  }

  getSession(sessionId: string): SessionData | undefined {
    return this.sessions.get(sessionId);
  }

  updateSession(sessionId: string, updates: Partial<SessionData>): SessionData | undefined {
    const session = this.sessions.get(sessionId);
    if (!session) {
      return undefined;
    }

    const updatedSession: SessionData = {
      ...session,
      ...updates,
      lastActivity: new Date(),
    };

    this.sessions.set(sessionId, updatedSession);
    return updatedSession;
  }

  deleteSession(sessionId: string): boolean {
    const sessionDeleted = this.sessions.delete(sessionId);
    const messagesDeleted = this.messages.delete(sessionId);
    return sessionDeleted || messagesDeleted;
  }

  addMessage(sessionId: string, message: Message): boolean {
    const session = this.sessions.get(sessionId);
    if (!session) {
      return false;
    }

    let sessionMessages = this.messages.get(sessionId) || [];
    sessionMessages.push(message);
    this.messages.set(sessionId, sessionMessages);

    // Update session
    this.updateSession(sessionId, {
      messageCount: sessionMessages.length,
    });

    return true;
  }

  getMessages(sessionId: string): Message[] {
    return this.messages.get(sessionId) || [];
  }

  clearMessages(sessionId: string): boolean {
    const session = this.sessions.get(sessionId);
    if (!session) {
      return false;
    }

    this.messages.set(sessionId, []);
    this.updateSession(sessionId, {
      messageCount: 0,
    });

    return true;
  }

  getAllSessions(): SessionData[] {
    return Array.from(this.sessions.values());
  }

  getSessionCount(): number {
    return this.sessions.size;
  }

  cleanupExpiredSessions(maxAge: number = 3600000): number {
    let cleanedCount = 0;
    const now = new Date();

    for (const [sessionId, session] of Array.from(this.sessions.entries())) {
      const age = now.getTime() - session.lastActivity.getTime();
      if (age > maxAge) {
        this.deleteSession(sessionId);
        cleanedCount++;
      }
    }

    return cleanedCount;
  }

  getSessionStats(): {
    totalSessions: number;
    totalMessages: number;
    avgMessagesPerSession: number;
    languageDistribution: Record<string, number>;
  } {
    const sessions = Array.from(this.sessions.values());
    const totalMessages = Array.from(this.messages.values())
      .reduce((total, msgs) => total + msgs.length, 0);

    const languageDistribution: Record<string, number> = {};
    sessions.forEach(session => {
      languageDistribution[session.language] = 
        (languageDistribution[session.language] || 0) + 1;
    });

    return {
      totalSessions: sessions.length,
      totalMessages,
      avgMessagesPerSession: sessions.length > 0 ? totalMessages / sessions.length : 0,
      languageDistribution,
    };
  }

  exportSessionData(sessionId: string): {
    session: SessionData;
    messages: Message[];
  } | undefined {
    const session = this.sessions.get(sessionId);
    const messages = this.messages.get(sessionId);

    if (!session) {
      return undefined;
    }

    return {
      session,
      messages: messages || [],
    };
  }

  importSessionData(data: {
    session: SessionData;
    messages: Message[];
  }): boolean {
    try {
      this.sessions.set(data.session.id, data.session);
      this.messages.set(data.session.id, data.messages);
      return true;
    } catch (error) {
      console.error('Failed to import session data:', error);
      return false;
    }
  }
}