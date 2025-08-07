'use client';

import { useState, useCallback, useRef } from 'react';
import { SupportedLanguage } from '@/types';

interface ThinkingStep {
  step: string;
  status: 'started' | 'completed' | 'failed';
  message: string;
  timestamp: number;
  data?: any;
}

interface StreamingState {
  isStreaming: boolean;
  steps: ThinkingStep[];
  finalResult: {
    content: string;
    sources: any[];
    confidence: number;
    processingTime: number;
  } | null;
  error: string | null;
}

export const useChatStreaming = () => {
  const [streamingState, setStreamingState] = useState<StreamingState>({
    isStreaming: false,
    steps: [],
    finalResult: null,
    error: null
  });

  const eventSourceRef = useRef<EventSource | null>(null);

  const startStreaming = useCallback(async (
    message: string,
    sessionId: string,
    language: SupportedLanguage = 'ja'
  ) => {
    // Reset state
    setStreamingState({
      isStreaming: true,
      steps: [],
      finalResult: null,
      error: null
    });

    try {
      // Send initial request to start streaming
      const response = await fetch('/api/chat/stream', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message,
          sessionId,
          language
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      // Create EventSource for SSE
      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      
      if (!reader) {
        throw new Error('No response body reader available');
      }

      // Read the stream
      while (true) {
        const { done, value } = await reader.read();
        
        if (done) {
          break;
        }

        const chunk = decoder.decode(value);
        const lines = chunk.split('\n');

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(6));
              
              if (data.type === 'step') {
                setStreamingState(prev => ({
                  ...prev,
                  steps: [...prev.steps, {
                    step: data.step,
                    status: data.status,
                    message: data.message,
                    timestamp: data.timestamp,
                    data: data.data
                  }]
                }));
              } else if (data.type === 'result') {
                setStreamingState(prev => ({
                  ...prev,
                  finalResult: {
                    content: data.content,
                    sources: data.sources || [],
                    confidence: data.confidence,
                    processingTime: data.processingTime
                  }
                }));
              } else if (data.type === 'done') {
                setStreamingState(prev => ({
                  ...prev,
                  isStreaming: false
                }));
                break;
              } else if (data.type === 'error') {
                setStreamingState(prev => ({
                  ...prev,
                  error: data.message || 'エラーが発生しました',
                  isStreaming: false
                }));
                break;
              }
            } catch (parseError) {
              console.warn('Failed to parse SSE data:', parseError);
            }
          }
        }
      }

    } catch (error) {
      console.error('Streaming error:', error);
      setStreamingState(prev => ({
        ...prev,
        error: error instanceof Error ? error.message : 'ストリーミングエラーが発生しました',
        isStreaming: false
      }));
    }
  }, []);

  const stopStreaming = useCallback(() => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }
    
    setStreamingState(prev => ({
      ...prev,
      isStreaming: false
    }));
  }, []);

  const clearStreamingState = useCallback(() => {
    setStreamingState({
      isStreaming: false,
      steps: [],
      finalResult: null,
      error: null
    });
  }, []);

  return {
    streamingState,
    startStreaming,
    stopStreaming,
    clearStreamingState
  };
};