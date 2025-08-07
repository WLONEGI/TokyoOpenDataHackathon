'use client';

import { useState, useEffect } from 'react';
import { CheckCircle, Clock, XCircle, Loader2 } from 'lucide-react';

interface ThinkingStep {
  step: string;
  status: 'started' | 'completed' | 'failed';
  message: string;
  timestamp: number;
  data?: any;
}

interface ThinkingProcessProps {
  visible: boolean;
  steps: ThinkingStep[];
  onComplete?: () => void;
}

const stepLabels = {
  'start': '処理開始',
  'cache-check': 'キャッシュ確認',
  'search-decision': '質問分析',
  'keyword-extraction': 'キーワード抽出',
  'data-search': 'データ検索',
  'response-generation': 'AI応答生成',
  'caching': 'キャッシュ保存',
  'complete': '処理完了',
  'error': 'エラー'
};

const StepIcon = ({ status }: { status: ThinkingStep['status'] }) => {
  switch (status) {
    case 'started':
      return <Loader2 className="w-4 h-4 animate-spin text-blue-500" />;
    case 'completed':
      return <CheckCircle className="w-4 h-4 text-green-500" />;
    case 'failed':
      return <XCircle className="w-4 h-4 text-red-500" />;
    default:
      return <Clock className="w-4 h-4 text-gray-400" />;
  }
};

export const ThinkingProcess = ({ visible, steps, onComplete }: ThinkingProcessProps) => {
  const [expandedSteps, setExpandedSteps] = useState<Set<string>>(new Set());

  useEffect(() => {
    const completeStep = steps.find(step => step.step === 'complete');
    if (completeStep && onComplete) {
      onComplete();
    }
  }, [steps, onComplete]);

  const toggleStepExpansion = (stepName: string) => {
    setExpandedSteps(prev => {
      const newSet = new Set(prev);
      if (newSet.has(stepName)) {
        newSet.delete(stepName);
      } else {
        newSet.add(stepName);
      }
      return newSet;
    });
  };

  if (!visible || steps.length === 0) {
    return null;
  }

  return (
    <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 mb-4 max-w-2xl">
      <div className="flex items-center gap-2 mb-3">
        <Loader2 className="w-4 h-4 animate-spin text-blue-500" />
        <span className="text-sm font-medium text-gray-700">思考過程</span>
      </div>
      
      <div className="space-y-2">
        {steps.map((step, index) => (
          <div
            key={`${step.step}-${index}`}
            className={`flex items-start gap-3 p-2 rounded cursor-pointer transition-colors ${
              step.data ? 'hover:bg-gray-100' : ''
            }`}
            onClick={() => step.data && toggleStepExpansion(`${step.step}-${index}`)}
          >
            <StepIcon status={step.status} />
            
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-gray-700">
                  {stepLabels[step.step as keyof typeof stepLabels] || step.step}
                </span>
                <span className="text-xs text-gray-500">
                  {step.timestamp}ms
                </span>
              </div>
              
              <p className="text-sm text-gray-600 mt-1">
                {step.message}
              </p>
              
              {/* 詳細データの表示 */}
              {step.data && expandedSteps.has(`${step.step}-${index}`) && (
                <div className="mt-2 p-2 bg-gray-100 rounded text-xs">
                  <pre className="whitespace-pre-wrap text-gray-600">
                    {JSON.stringify(step.data, null, 2)}
                  </pre>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
      
      {/* 進行状況バー */}
      <div className="mt-4">
        <div className="flex justify-between text-xs text-gray-500 mb-1">
          <span>進行状況</span>
          <span>{steps.filter(s => s.status === 'completed').length} / {steps.length}</span>
        </div>
        <div className="w-full bg-gray-200 rounded-full h-2">
          <div
            className="bg-blue-500 h-2 rounded-full transition-all duration-300"
            style={{
              width: steps.length > 0 ? `${(steps.filter(s => s.status === 'completed').length / Math.max(steps.length, 8)) * 100}%` : '0%'
            }}
          />
        </div>
      </div>
    </div>
  );
};

export default ThinkingProcess;