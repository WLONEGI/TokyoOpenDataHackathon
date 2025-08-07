'use client';

import { useState, useEffect } from 'react';
import { 
  BarChart3, 
  TrendingUp, 
  Users, 
  MessageSquare, 
  Clock, 
  MapPin,
  Globe,
  Activity,
  Database,
  Zap,
  Target,
  Award
} from 'lucide-react';

interface MetricCard {
  id: string;
  title: string;
  value: string | number;
  previousValue?: string | number;
  change?: number;
  changeType?: 'increase' | 'decrease' | 'neutral';
  icon: React.ReactNode;
  color: 'blue' | 'green' | 'yellow' | 'purple' | 'red' | 'indigo';
  description?: string;
}

interface DashboardProps {
  metrics?: MetricCard[];
  className?: string;
  showCharts?: boolean;
  showActivity?: boolean;
}

const DEFAULT_METRICS: MetricCard[] = [
  {
    id: 'total-queries',
    title: '総問い合わせ数',
    value: '1,247',
    previousValue: '1,180',
    change: 5.7,
    changeType: 'increase',
    icon: <MessageSquare className="w-6 h-6" />,
    color: 'blue',
    description: '今月の総問い合わせ数'
  },
  {
    id: 'active-users',
    title: 'アクティブユーザー',
    value: '324',
    previousValue: '298',
    change: 8.7,
    changeType: 'increase',
    icon: <Users className="w-6 h-6" />,
    color: 'green',
    description: '過去30日間のアクティブユーザー'
  },
  {
    id: 'avg-response-time',
    title: '平均応答時間',
    value: '2.3s',
    previousValue: '2.8s',
    change: -17.9,
    changeType: 'decrease',
    icon: <Clock className="w-6 h-6" />,
    color: 'yellow',
    description: 'AI応答の平均時間'
  },
  {
    id: 'satisfaction-rate',
    title: '満足度',
    value: '94.2%',
    previousValue: '91.8%',
    change: 2.6,
    changeType: 'increase',
    icon: <Award className="w-6 h-6" />,
    color: 'purple',
    description: 'ユーザー満足度スコア'
  },
  {
    id: 'data-sources',
    title: '連携データソース',
    value: '42',
    previousValue: '39',
    change: 7.7,
    changeType: 'increase',
    icon: <Database className="w-6 h-6" />,
    color: 'indigo',
    description: '東京オープンデータAPI連携数'
  },
  {
    id: 'success-rate',
    title: 'API成功率',
    value: '99.7%',
    previousValue: '99.5%',
    change: 0.2,
    changeType: 'increase',
    icon: <Target className="w-6 h-6" />,
    color: 'green',
    description: 'API呼び出し成功率'
  }
];

const RECENT_ACTIVITY = [
  {
    id: '1',
    type: 'query',
    message: '新規問い合わせ: 保育園の申込み方法について',
    timestamp: '2分前',
    location: '渋谷区',
    status: 'completed'
  },
  {
    id: '2',
    type: 'user',
    message: '新規ユーザー登録',
    timestamp: '5分前',
    location: '新宿区',
    status: 'active'
  },
  {
    id: '3',
    type: 'data',
    message: '東京オープンデータ同期完了',
    timestamp: '10分前',
    location: 'システム',
    status: 'completed'
  },
  {
    id: '4',
    type: 'error',
    message: 'API レート制限に達しました',
    timestamp: '15分前',
    location: '品川区',
    status: 'resolved'
  },
  {
    id: '5',
    type: 'query',
    message: '位置情報検索: 近くの子育て支援センター',
    timestamp: '18分前',
    location: '世田谷区',
    status: 'completed'
  }
];

export function Dashboard({ 
  metrics = DEFAULT_METRICS, 
  className = '', 
  showCharts = true,
  showActivity = true 
}: DashboardProps) {
  const [selectedMetric, setSelectedMetric] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Simulate loading
    const timer = setTimeout(() => {
      setIsLoading(false);
    }, 1000);

    return () => clearTimeout(timer);
  }, []);

  const getColorClasses = (color: MetricCard['color']) => {
    const colors = {
      blue: 'bg-blue-500 text-white',
      green: 'bg-green-500 text-white',
      yellow: 'bg-yellow-500 text-white',
      purple: 'bg-purple-500 text-white',
      red: 'bg-red-500 text-white',
      indigo: 'bg-indigo-500 text-white'
    };
    return colors[color] || colors.blue;
  };

  const getChangeColor = (changeType: MetricCard['changeType']) => {
    switch (changeType) {
      case 'increase':
        return 'text-green-600 dark:text-green-400';
      case 'decrease':
        return 'text-red-600 dark:text-red-400';
      default:
        return 'text-gray-600 dark:text-gray-400';
    }
  };

  const getActivityIcon = (type: string) => {
    switch (type) {
      case 'query':
        return <MessageSquare className="w-4 h-4 text-blue-500" />;
      case 'user':
        return <Users className="w-4 h-4 text-green-500" />;
      case 'data':
        return <Database className="w-4 h-4 text-purple-500" />;
      case 'error':
        return <Activity className="w-4 h-4 text-red-500" />;
      default:
        return <Activity className="w-4 h-4 text-gray-500" />;
    }
  };

  const getActivityStatus = (status: string) => {
    const statusClasses = {
      completed: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
      active: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
      resolved: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
      error: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
    };
    return statusClasses[status as keyof typeof statusClasses] || statusClasses.active;
  };

  if (isLoading) {
    return (
      <div className={`space-y-6 ${className}`}>
        {/* Loading skeleton */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {Array.from({ length: 6 }).map((_, index) => (
            <div key={index} className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm animate-pulse">
              <div className="flex items-center justify-between mb-4">
                <div className="w-12 h-12 bg-gray-200 dark:bg-gray-700 rounded-lg"></div>
                <div className="w-16 h-4 bg-gray-200 dark:bg-gray-700 rounded"></div>
              </div>
              <div className="w-24 h-8 bg-gray-200 dark:bg-gray-700 rounded mb-2"></div>
              <div className="w-32 h-4 bg-gray-200 dark:bg-gray-700 rounded"></div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
            システムダッシュボード
          </h2>
          <p className="text-gray-600 dark:text-gray-400 mt-1">
            東京オープンデータAIチャットシステムの概要
          </p>
        </div>
        <div className="flex items-center space-x-2 text-sm text-gray-500 dark:text-gray-400">
          <Activity className="w-4 h-4" />
          <span>リアルタイム更新</span>
          <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
        </div>
      </div>

      {/* Metrics Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {metrics.map((metric) => (
          <div
            key={metric.id}
            className={`
              bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm border border-gray-200 dark:border-gray-700
              transition-all duration-200 cursor-pointer hover:shadow-md hover:scale-105
              ${selectedMetric === metric.id ? 'ring-2 ring-blue-500' : ''}
            `}
            onClick={() => setSelectedMetric(selectedMetric === metric.id ? null : metric.id)}
          >
            {/* Header */}
            <div className="flex items-center justify-between mb-4">
              <div className={`p-3 rounded-lg ${getColorClasses(metric.color)}`}>
                {metric.icon}
              </div>
              {metric.change !== undefined && (
                <div className={`flex items-center space-x-1 ${getChangeColor(metric.changeType)}`}>
                  <TrendingUp className={`w-4 h-4 ${metric.changeType === 'decrease' ? 'rotate-180' : ''}`} />
                  <span className="text-sm font-medium">
                    {metric.change > 0 ? '+' : ''}{metric.change}%
                  </span>
                </div>
              )}
            </div>

            {/* Value */}
            <div className="mb-2">
              <h3 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                {metric.value}
              </h3>
              <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
                {metric.title}
              </p>
            </div>

            {/* Description */}
            {metric.description && (
              <p className="text-xs text-gray-500 dark:text-gray-400">
                {metric.description}
              </p>
            )}

            {/* Previous Value */}
            {metric.previousValue && (
              <div className="mt-3 pt-3 border-t border-gray-100 dark:border-gray-700">
                <span className="text-xs text-gray-500 dark:text-gray-400">
                  前回: {metric.previousValue}
                </span>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Charts Section */}
      {showCharts && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Usage Chart */}
          <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm border border-gray-200 dark:border-gray-700">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                利用状況推移
              </h3>
              <BarChart3 className="w-5 h-5 text-gray-500" />
            </div>
            
            {/* Simple bar chart simulation */}
            <div className="space-y-3">
              {Array.from({ length: 7 }).map((_, index) => {
                const height = Math.random() * 60 + 20;
                const day = ['月', '火', '水', '木', '金', '土', '日'][index];
                return (
                  <div key={index} className="flex items-center space-x-3">
                    <span className="text-sm text-gray-500 dark:text-gray-400 w-6">
                      {day}
                    </span>
                    <div className="flex-1 bg-gray-100 dark:bg-gray-700 rounded-full h-6 relative">
                      <div
                        className="bg-gradient-to-r from-blue-500 to-purple-500 h-6 rounded-full flex items-center justify-end pr-2"
                        style={{ width: `${height}%` }}
                      >
                        <span className="text-xs text-white font-medium">
                          {Math.round(height)}%
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Geographic Distribution */}
          <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm border border-gray-200 dark:border-gray-700">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                地域別利用状況
              </h3>
              <MapPin className="w-5 h-5 text-gray-500" />
            </div>
            
            <div className="space-y-4">
              {[
                { region: '新宿区', count: 245, percentage: 85 },
                { region: '渋谷区', count: 198, percentage: 70 },
                { region: '港区', count: 156, percentage: 55 },
                { region: '世田谷区', count: 134, percentage: 48 },
                { region: '品川区', count: 89, percentage: 32 }
              ].map((item, index) => (
                <div key={index} className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <div className="w-3 h-3 bg-blue-500 rounded-full"></div>
                    <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                      {item.region}
                    </span>
                  </div>
                  <div className="flex items-center space-x-3">
                    <div className="w-20 bg-gray-100 dark:bg-gray-700 rounded-full h-2">
                      <div
                        className="bg-blue-500 h-2 rounded-full"
                        style={{ width: `${item.percentage}%` }}
                      ></div>
                    </div>
                    <span className="text-sm text-gray-500 dark:text-gray-400 w-12 text-right">
                      {item.count}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Activity Feed */}
      {showActivity && (
        <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm border border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
              最近のアクティビティ
            </h3>
            <Activity className="w-5 h-5 text-gray-500" />
          </div>

          <div className="space-y-4">
            {RECENT_ACTIVITY.map((activity) => (
              <div key={activity.id} className="flex items-start space-x-3 p-3 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
                <div className="flex-shrink-0 mt-0.5">
                  {getActivityIcon(activity.type)}
                </div>
                
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-gray-900 dark:text-gray-100">
                    {activity.message}
                  </p>
                  <div className="flex items-center space-x-2 mt-1">
                    <span className="text-xs text-gray-500 dark:text-gray-400">
                      {activity.timestamp}
                    </span>
                    <span className="text-xs text-gray-500 dark:text-gray-400">
                      •
                    </span>
                    <span className="text-xs text-gray-500 dark:text-gray-400">
                      {activity.location}
                    </span>
                  </div>
                </div>

                <div className="flex-shrink-0">
                  <span className={`
                    inline-flex px-2 py-1 text-xs font-medium rounded-full
                    ${getActivityStatus(activity.status)}
                  `}>
                    {activity.status}
                  </span>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-6 pt-4 border-t border-gray-100 dark:border-gray-700">
            <button className="w-full text-center text-sm text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 font-medium">
              すべてのアクティビティを表示
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default Dashboard;