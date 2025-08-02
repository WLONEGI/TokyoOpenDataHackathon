'use client';

import { useEffect, useState } from 'react';

interface VoiceVisualizerProps {
  isRecording: boolean;
  audioLevel: number;
  isProcessing?: boolean;
  className?: string;
}

export default function VoiceVisualizer({
  isRecording,
  audioLevel,
  isProcessing = false,
  className = '',
}: VoiceVisualizerProps) {
  const [bars, setBars] = useState<number[]>(Array(5).fill(0));

  // 音声レベルに基づいてバーの高さを更新
  useEffect(() => {
    if (!isRecording && !isProcessing) {
      setBars(Array(5).fill(0));
      return;
    }

    if (isProcessing) {
      // 処理中は規則的なアニメーション
      const interval = setInterval(() => {
        setBars(prev => prev.map((_, index) => {
          const phase = (Date.now() / 200 + index * 0.5) % (Math.PI * 2);
          return Math.sin(phase) * 0.5 + 0.5;
        }));
      }, 50);

      return () => clearInterval(interval);
    }

    if (isRecording) {
      // 録音中は音声レベルに応じてバーの高さを調整
      const newBars = bars.map((_, index) => {
        // 中央のバーが最も高く、両端に向かって低くなる
        const centerDistance = Math.abs(index - 2) / 2;
        const heightMultiplier = 1 - centerDistance * 0.3;
        
        // ランダムな要素を追加してより自然な見た目に
        const randomFactor = 0.8 + Math.random() * 0.4;
        
        return Math.min(audioLevel * heightMultiplier * randomFactor, 1);
      });

      setBars(newBars);
    }
  }, [isRecording, audioLevel, isProcessing, bars]);

  return (
    <div className={`flex items-center justify-center space-x-2 h-16 ${className}`}>
      {bars.map((height, index) => (
        <div
          key={index}
          className={`
            w-3 rounded-full transition-all duration-100 
            ${isRecording 
              ? 'bg-red-500' 
              : isProcessing 
                ? 'bg-blue-500' 
                : 'bg-gray-300'
            }
          `}
          style={{
            height: `${Math.max(height * 48 + 4, 4)}px`, // 最小4px、最大52px
            transformOrigin: 'bottom',
          }}
        />
      ))}
    </div>
  );
}