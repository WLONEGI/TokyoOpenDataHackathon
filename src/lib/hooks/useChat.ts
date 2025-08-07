'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { Message, ChatSession } from '@/types';
import { v4 as uuidv4 } from 'uuid';
import axios from 'axios';
import { useSpeechSynthesis } from '@/lib/services/SpeechService';
import { useSpeechRecognition } from './useSpeechRecognition';
import { useGeolocation } from './useGeolocation';
import { Coordinates } from '@/lib/services/GeospatialContextService';

export interface UseChatProps {
  language?: 'ja' | 'en' | 'zh' | 'ko';
  enableVoice?: boolean;
  enableLocation?: boolean;
}

export interface UseChatReturn {
  messages: Message[];
  isLoading: boolean;
  isRecording: boolean;
  sessionId: string | null;
  language: string;
  transcript: string;
  finalTranscript: string;
  interimTranscript: string;
  speechRecognitionSupported: boolean;
  location: Coordinates | null;
  locationError: string | null;
  locationLoading: boolean;
  locationPermission: PermissionState | null;
  sendMessage: (content: string, withVoice?: boolean) => Promise<void>;
  sendVoiceMessage: (audioBlob: Blob) => Promise<void>;
  startRecording: () => Promise<void>;
  stopRecording: () => Promise<void>;
  clearChat: () => Promise<void>;
  setLanguage: (lang: 'ja' | 'en' | 'zh' | 'ko') => Promise<void>;
  cancelSpeech: () => void;
  isSpeaking: () => boolean;
  speechSupported: boolean;
  resetTranscript: () => void;
  setLocation: (coords: Coordinates | null) => void;
  requestLocation: () => void;
  clearLocation: () => void;
}

export function useChat({ language = 'ja', enableVoice = true, enableLocation = true }: UseChatProps = {}): UseChatReturn {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [currentLanguage, setCurrentLanguage] = useState(language);
  
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  
  // Speech synthesis hook
  const { speak, cancel, isSpeaking, isSupported: speechSupported } = useSpeechSynthesis();
  
  // Geolocation hook
  const {
    location,
    loading: locationLoading,
    error: locationError,
    permission: locationPermission,
    getCurrentPosition,
    clearLocation: clearLocationData
  } = useGeolocation({
    enableHighAccuracy: true,
    timeout: 10000,
    maximumAge: 300000, // 5分間キャッシュ
    autoStart: false
  });
  
  // Speech Recognition機能
  const languageMap = {
    'ja': 'ja-JP',
    'en': 'en-US',
    'zh': 'zh-CN',
    'ko': 'ko-KR'
  };
  
  const {
    isListening,
    transcript,
    finalTranscript,
    interimTranscript,
    isSupported: speechRecognitionSupported,
    startListening,
    stopListening,
    resetTranscript
  } = useSpeechRecognition({
    language: languageMap[currentLanguage as keyof typeof languageMap],
    continuous: true,
    interimResults: true,
    onResult: (text: string, isFinal: boolean) => {
      if (isFinal && text.trim()) {
        console.log('Final speech result:', text);
        // 最終的な音声認識結果が確定したら、AIに送信
        handleSpeechResultRef.current?.(text.trim());
      }
    },
    onError: (error: string) => {
      console.error('Speech recognition error:', error);
    }
  });

  // Initialize session
  const initializeSession = useCallback(async (forceNew = false) => {
    try {
      // Don't create a new session if one already exists, unless forced
      if (sessionId && !forceNew) {
        return sessionId;
      }

      console.log('Creating session:', { language: currentLanguage });
      
      const response = await axios.post('/api/session', {
        language: currentLanguage
      }, {
        timeout: 10000, // 10 second timeout
        headers: {
          'Content-Type': 'application/json',
        }
      });
      
      console.log('Session response:', {
        success: response.data.success,
        status: response.status,
        sessionId: response.data.data?.sessionId?.substring(0, 8) + '...'
      });
      
      if (response.data.success) {
        const newSessionId = response.data.data.sessionId;
        setSessionId(newSessionId);
        console.log('Session created successfully:', newSessionId.substring(0, 8) + '...');
        return newSessionId;
      }
    } catch (error) {
      console.error('Failed to initialize session:', error);
      console.error('Session init error details:', {
        message: (error as any)?.message,
        status: (error as any)?.response?.status,
        data: (error as any)?.response?.data,
        config: (error as any)?.config?.url
      });
    }
    return null;
  }, [currentLanguage, sessionId]);

  // Initialize session on first load only
  useEffect(() => {
    if (!sessionId) {
      console.log('Component mounted, initializing session...');
      initializeSession().then(newSessionId => {
        if (newSessionId) {
          console.log('Initial session created:', newSessionId.substring(0, 8) + '...');
        } else {
          console.error('Failed to create initial session');
        }
      });
    }
  }, [initializeSession, sessionId]);

  const addMessage = useCallback((message: Omit<Message, 'id' | 'timestamp'>) => {
    const newMessage: Message = {
      ...message,
      id: uuidv4(),
      timestamp: new Date(),
    };
    setMessages(prev => [...prev, newMessage]);
    return newMessage;
  }, []);

  // 音声認識結果を処理してAIに送信（後で定義される）
  const handleSpeechResultRef = useRef<((text: string) => Promise<void>) | null>(null);

  const sendMessage = useCallback(async (content: string, withVoice: boolean = false) => {
    if (!content.trim()) return;
    
    // If no session, try to initialize one
    let currentSessionId = sessionId;
    if (!currentSessionId) {
      console.log('No session found, initializing new session...');
      currentSessionId = await initializeSession();
      if (!currentSessionId) {
        console.error('Failed to initialize session, aborting message send');
        return; // Still no session after initialization
      }
      console.log('Session initialized for message send:', currentSessionId.substring(0, 8) + '...');
    }

    // Cancel any ongoing speech
    cancel();

    // Add user message
    addMessage({
      role: 'user',
      content: content.trim(),
    });

    setIsLoading(true);

    try {
      console.log('Sending chat request:', {
        url: '/api/chat',
        sessionId: currentSessionId,
        messageLength: content.trim().length,
        language: currentLanguage
      });
      
      const response = await axios.post('/api/chat', {
        message: content.trim(),
        sessionId: currentSessionId,
        language: currentLanguage,
        useVoice: withVoice && enableVoice && speechSupported,
        inputType: 'text',
        location: enableLocation && location ? {
          latitude: location.latitude,
          longitude: location.longitude,
          accuracy: location.accuracy,
          timestamp: location.timestamp
        } : undefined
      }, {
        timeout: 30000, // 30 second timeout for chat
        headers: {
          'Content-Type': 'application/json',
        }
      });
      
      console.log('Chat response received:', {
        success: response.data.success,
        status: response.status,
        hasData: !!response.data.data
      });

      if (response.data.success) {
        const { response: aiResponse, sources, shouldPlayAudio } = response.data.data;
        
        const assistantMessage = addMessage({
          role: 'assistant',
          content: aiResponse,
        });

        // テキスト入力時はshouldPlayAudioがfalseなので音声出力しない
        if (shouldPlayAudio && withVoice && speechSupported() && enableVoice) {
          try {
            await speak(aiResponse, { language: currentLanguage });
          } catch (error) {
            console.warn('Speech synthesis failed:', error);
          }
        }
      } else {
        const errorMessages = {
          ja: '申し訳ございませんが、エラーが発生しました。もう一度お試しください。',
          en: 'I apologize, but an error occurred. Please try again.',
          zh: '抱歉，出现了错误。请重试。',
          ko: '죄송합니다. 오류가 발생했습니다. 다시 시도해주세요.'
        };
        addMessage({
          role: 'assistant',
          content: errorMessages[currentLanguage as keyof typeof errorMessages] || errorMessages.ja,
        });
      }
    } catch (error) {
      console.error('Failed to send message:', error);
      console.error('Error details:', {
        message: (error as any)?.message,
        status: (error as any)?.response?.status,
        data: (error as any)?.response?.data,
        config: (error as any)?.config?.url
      });
      
      const connectionErrorMessages = {
        ja: 'サービスに接続できませんでした。インターネット接続を確認してから、もう一度お試しください。',
        en: 'Could not connect to the service. Please check your internet connection and try again.',
        zh: '无法连接到服务。请检查您的互联网连接后重试。',
        ko: '서비스에 연결할 수 없습니다. 인터넷 연결을 확인한 후 다시 시도해주세요.'
      };
      addMessage({
        role: 'assistant',
        content: connectionErrorMessages[currentLanguage as keyof typeof connectionErrorMessages] || connectionErrorMessages.ja,
      });
    } finally {
      setIsLoading(false);
    }
  }, [sessionId, currentLanguage, addMessage, cancel, speechSupported, enableVoice, speak, initializeSession]);

  // 音声認識結果を処理してAIに送信
  const handleSpeechResult = useCallback(async (recognizedText: string) => {
    try {
      // 音声入力として送信（音声+テキスト出力）
      await sendMessage(recognizedText, true);
    } catch (error) {
      console.error('Failed to process speech result:', error);
    }
  }, [sendMessage]);

  // handleSpeechResultRefを更新
  handleSpeechResultRef.current = handleSpeechResult;

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
            language: currentLanguage,
            location: enableLocation && location ? {
              latitude: location.latitude,
              longitude: location.longitude,
              accuracy: location.accuracy,
              timestamp: location.timestamp
            } : undefined
          });

          if (voiceResponse.data.success) {
            const { response: aiResponse, sources, shouldPlayAudio } = voiceResponse.data.data;
            
            // 音声入力の場合はトランスクリプトとAIレスポンスを追加
            addMessage({
              role: 'user',
              content: voiceResponse.data.data.text || '音声入力',
            });
            
            addMessage({
              role: 'assistant',
              content: aiResponse,
            });

            // 音声入力時はshouldPlayAudioがtrueなので音声出力あり
            if (shouldPlayAudio && enableVoice && speechSupported()) {
              try {
                await speak(aiResponse, { language: currentLanguage });
              } catch (error) {
                console.warn('Speech synthesis failed:', error);
              }
            }
          } else {
            const voiceErrorMessages = {
              ja: '音声を認識できませんでした。もう一度お試しください。',
              en: 'Could not recognize the voice. Please try again.',
              zh: '无法识别语音。请重试。',
              ko: '음성을 인식할 수 없습니다. 다시 시도해주세요.'
            };
            addMessage({
              role: 'assistant',
              content: voiceErrorMessages[currentLanguage as keyof typeof voiceErrorMessages] || voiceErrorMessages.ja,
            });
          }
        } catch (error) {
          console.error('Voice processing error:', error);
          const voiceProcessingErrorMessages = {
            ja: '音声処理中にエラーが発生しました。',
            en: 'An error occurred during voice processing.',
            zh: '语音处理过程中出现错误。',
            ko: '음성 처리 중 오류가 발생했습니다.'
          };
          addMessage({
            role: 'assistant',
            content: voiceProcessingErrorMessages[currentLanguage as keyof typeof voiceProcessingErrorMessages] || voiceProcessingErrorMessages.ja,
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
  }, [sessionId, currentLanguage, addMessage, enableVoice, speak, speechSupported]);

  const startRecording = useCallback(async () => {
    if (!enableVoice || !speechRecognitionSupported) {
      console.error('Speech recognition not supported');
      return;
    }

    try {
      resetTranscript();
      startListening();
      setIsRecording(true);
    } catch (error) {
      console.error('Failed to start speech recognition:', error);
    }
  }, [enableVoice, speechRecognitionSupported, startListening, resetTranscript]);

  const stopRecording = useCallback(async () => {
    if (isRecording) {
      stopListening();
      setIsRecording(false);
    }
  }, [isRecording, stopListening]);

  const clearChat = useCallback(async () => {
    setMessages([]);
    // Initialize new session
    await initializeSession(true);
  }, [initializeSession]);

  const setLanguage = useCallback(async (lang: 'ja' | 'en' | 'zh' | 'ko') => {
    setCurrentLanguage(lang);
    // Only re-initialize session if we have one already
    if (sessionId) {
      await initializeSession(true);
    }
  }, [initializeSession, sessionId]);

  const cancelSpeech = useCallback(() => {
    cancel();
  }, [cancel]);

  const checkIsSpeaking = useCallback(() => {
    return isSpeaking();
  }, [isSpeaking]);

  // Location management
  const setLocation = useCallback((coords: Coordinates | null) => {
    if (!coords) {
      clearLocationData();
    }
    // Note: location is managed by useGeolocation hook
  }, [clearLocationData]);

  const requestLocation = useCallback(() => {
    if (enableLocation) {
      getCurrentPosition();
    }
  }, [enableLocation, getCurrentPosition]);

  const clearLocation = useCallback(() => {
    clearLocationData();
  }, [clearLocationData]);

  return {
    messages,
    isLoading,
    isRecording,
    sessionId,
    language: currentLanguage,
    transcript,
    finalTranscript,
    interimTranscript,
    speechRecognitionSupported,
    location,
    locationError,
    locationLoading,
    locationPermission,
    sendMessage,
    sendVoiceMessage,
    startRecording,
    stopRecording,
    clearChat,
    setLanguage,
    cancelSpeech,
    isSpeaking: checkIsSpeaking,
    speechSupported: speechSupported(),
    resetTranscript,
    setLocation,
    requestLocation,
    clearLocation,
  };
}