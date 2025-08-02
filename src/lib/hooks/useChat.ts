'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { Message, ChatSession } from '@/types';
import { v4 as uuidv4 } from 'uuid';
import axios from 'axios';

export interface UseChatProps {
  language?: 'ja' | 'en' | 'zh' | 'ko';
  enableVoice?: boolean;
}

export interface UseChatReturn {
  messages: Message[];
  isLoading: boolean;
  isRecording: boolean;
  sessionId: string | null;
  language: string;
  sendMessage: (content: string) => Promise<void>;
  sendVoiceMessage: (audioBlob: Blob) => Promise<void>;
  startRecording: () => Promise<void>;
  stopRecording: () => Promise<void>;
  clearChat: () => Promise<void>;
  setLanguage: (lang: 'ja' | 'en' | 'zh' | 'ko') => Promise<void>;
}

export function useChat({ language = 'ja', enableVoice = true }: UseChatProps = {}): UseChatReturn {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [currentLanguage, setCurrentLanguage] = useState(language);
  
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  // Initialize session
  const initializeSession = useCallback(async () => {
    try {
      const response = await axios.post('/api/session', {
        language: currentLanguage
      });
      
      if (response.data.success) {
        setSessionId(response.data.data.sessionId);
      }
    } catch (error) {
      console.error('Failed to initialize session:', error);
    }
  }, [currentLanguage]);

  // Initialize session on first load
  useEffect(() => {
    initializeSession();
  }, [initializeSession]);

  const addMessage = useCallback((message: Omit<Message, 'id' | 'timestamp'>) => {
    const newMessage: Message = {
      ...message,
      id: uuidv4(),
      timestamp: new Date(),
    };
    setMessages(prev => [...prev, newMessage]);
    return newMessage;
  }, []);

  const sendMessage = useCallback(async (content: string) => {
    if (!content.trim() || !sessionId) return;

    // Add user message
    addMessage({
      role: 'user',
      content: content.trim(),
    });

    setIsLoading(true);

    try {
      const response = await axios.post('/api/chat', {
        message: content.trim(),
        sessionId,
        language: currentLanguage,
        useVoice: false
      });

      if (response.data.success) {
        const { response: aiResponse, sources } = response.data.data;
        
        addMessage({
          role: 'assistant',
          content: aiResponse,
        });
      } else {
        addMessage({
          role: 'assistant',
          content: '申し訳ございませんが、エラーが発生しました。もう一度お試しください。',
        });
      }
    } catch (error) {
      console.error('Failed to send message:', error);
      addMessage({
        role: 'assistant',
        content: 'サービスに接続できませんでした。インターネット接続を確認してから、もう一度お試しください。',
      });
    } finally {
      setIsLoading(false);
    }
  }, [sessionId, currentLanguage, addMessage]);

  const sendVoiceMessage = useCallback(async (audioBlob: Blob) => {
    if (!sessionId) return;

    setIsLoading(true);

    try {
      // Convert audio to base64
      const reader = new FileReader();
      reader.onloadend = async () => {
        try {
          const base64Audio = (reader.result as string).split(',')[1];
          
          // First, transcribe the audio
          const voiceResponse = await axios.post('/api/voice/recognize', {
            audioData: base64Audio,
            mimeType: audioBlob.type,
            sessionId,
            language: currentLanguage
          });

          if (voiceResponse.data.success) {
            const transcribedText = voiceResponse.data.data.text;
            
            // Add transcribed message as user message
            addMessage({
              role: 'user',
              content: transcribedText,
            });

            // Send the transcribed text for AI response
            await sendMessage(transcribedText);
          } else {
            addMessage({
              role: 'assistant',
              content: '音声を認識できませんでした。もう一度お試しください。',
            });
          }
        } catch (error) {
          console.error('Voice processing error:', error);
          addMessage({
            role: 'assistant',
            content: '音声処理中にエラーが発生しました。',
          });
        } finally {
          setIsLoading(false);
        }
      };
      reader.readAsDataURL(audioBlob);
    } catch (error) {
      console.error('Failed to process voice message:', error);
      setIsLoading(false);
    }
  }, [sessionId, currentLanguage, addMessage, sendMessage]);

  const startRecording = useCallback(async () => {
    if (!enableVoice || !navigator.mediaDevices) {
      console.error('Voice recording not supported');
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      
      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: 'audio/webm;codecs=opus'
      });
      
      audioChunksRef.current = [];
      
      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        sendVoiceMessage(audioBlob);
        
        // Stop all tracks
        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorderRef.current = mediaRecorder;
      mediaRecorder.start();
      setIsRecording(true);
    } catch (error) {
      console.error('Failed to start recording:', error);
    }
  }, [enableVoice, sendVoiceMessage]);

  const stopRecording = useCallback(async () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  }, [isRecording]);

  const clearChat = useCallback(async () => {
    setMessages([]);
    // Initialize new session
    await initializeSession();
  }, [initializeSession]);

  const setLanguage = useCallback(async (lang: 'ja' | 'en' | 'zh' | 'ko') => {
    setCurrentLanguage(lang);
    // Re-initialize session with new language
    await initializeSession();
  }, [initializeSession]);

  return {
    messages,
    isLoading,
    isRecording,
    sessionId,
    language: currentLanguage,
    sendMessage,
    sendVoiceMessage,
    startRecording,
    stopRecording,
    clearChat,
    setLanguage,
  };
}