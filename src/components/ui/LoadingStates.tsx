'use client'

import { Loader2, Sparkles } from 'lucide-react'
import { useI18n } from '@/lib/i18n/I18nProvider'

interface LoadingSpinnerProps {
  size?: 'sm' | 'md' | 'lg'
  className?: string
}

export function LoadingSpinner({ size = 'md', className = '' }: LoadingSpinnerProps) {
  const sizeClasses = {
    sm: 'w-4 h-4',
    md: 'w-6 h-6',
    lg: 'w-8 h-8'
  }

  return (
    <Loader2 className={`animate-spin ${sizeClasses[size]} ${className}`} />
  )
}

interface LoadingOverlayProps {
  isLoading: boolean
  message?: string
  children: React.ReactNode
}

export function LoadingOverlay({ isLoading, message = '読み込み中...', children }: LoadingOverlayProps) {
  if (!isLoading) return <>{children}</>

  return (
    <div className="relative">
      {children}
      <div className="absolute inset-0 bg-white/80 dark:bg-primary-900/80 backdrop-blur-sm flex items-center justify-center z-10 rounded-xl">
        <div className="text-center">
          <LoadingSpinner size="lg" className="text-accent-600 mx-auto mb-3" />
          <p className="text-sm text-primary-600 dark:text-primary-300 font-medium">{message}</p>
        </div>
      </div>
    </div>
  )
}

interface SkeletonProps {
  className?: string
  lines?: number
}

export function Skeleton({ className = '', lines = 1 }: SkeletonProps) {
  return (
    <div className={`animate-pulse ${className}`}>
      {Array.from({ length: lines }).map((_, i) => (
        <div 
          key={i}
          className={`bg-primary-200 dark:bg-primary-700 rounded ${
            i === lines - 1 ? 'w-3/4' : 'w-full'
          } ${lines > 1 ? 'h-4 mb-2' : 'h-4'}`}
        />
      ))}
    </div>
  )
}

interface MessageSkeletonProps {
  isUser?: boolean
}

export function MessageSkeleton({ isUser = false }: MessageSkeletonProps) {
  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'} animate-slide-up`}>
      <div className={`flex items-start space-x-3 max-w-2xl ${isUser ? 'flex-row-reverse space-x-reverse' : ''}`}>
        {/* Avatar skeleton */}
        <div className="w-8 h-8 bg-primary-200 dark:bg-primary-700 rounded-full animate-pulse flex-shrink-0" />
        
        {/* Message bubble skeleton */}
        <div className={`${isUser ? 'message-bubble-user' : 'message-bubble-assistant'}`}>
          <Skeleton lines={3} />
        </div>
      </div>
    </div>
  )
}

interface TypingIndicatorProps {
  name?: string
}

export function TypingIndicator({ name = 'AI' }: TypingIndicatorProps) {
  const { t } = useI18n();
  return (
    <div className="flex justify-start animate-slide-up">
      <div className="flex items-start space-x-3 max-w-2xl">
        {/* AI Avatar with subtle pulse */}
        <div className="w-8 h-8 bg-gradient-to-br from-tokyo-400 to-tokyo-600 rounded-full flex items-center justify-center flex-shrink-0 shadow-sm animate-pulse-subtle">
          <Sparkles className="w-4 h-4 text-white" />
        </div>
        
        {/* Enhanced typing bubble */}
        <div className="message-bubble-assistant relative overflow-hidden">
          {/* Animated background gradient */}
          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-primary-50/50 to-transparent animate-pulse opacity-50" />
          
          <div className="relative flex items-center space-x-3">
            {/* Enhanced typing dots */}
            <div className="typing-indicator">
              <div className="typing-dot bg-tokyo-500" />
              <div className="typing-dot bg-tokyo-400" />
              <div className="typing-dot bg-tokyo-600" />
            </div>
            
            {/* Typing text with fade animation */}
            <div className="flex flex-col">
              <span className="text-xs text-primary-600 dark:text-primary-300 font-medium animate-pulse">
                {t.chat.aiThinking}
              </span>
              <span className="text-xs text-primary-400 dark:text-primary-500 mt-0.5">
                {t.chat.preparingResponse}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

interface EmptyStateProps {
  icon?: React.ReactNode
  title: string
  description: string
  action?: React.ReactNode
}

export function EmptyState({ icon, title, description, action }: EmptyStateProps) {
  return (
    <div className="empty-state">
      <div className="empty-state-content">
        {icon && (
          <div className="w-16 h-16 bg-primary-100 dark:bg-primary-800 rounded-2xl flex items-center justify-center mx-auto mb-6">
            {icon}
          </div>
        )}
        <h2 className="empty-state-title">{title}</h2>
        <p className="empty-state-description">{description}</p>
        {action && (
          <div className="mt-6">
            {action}
          </div>
        )}
      </div>
    </div>
  )
}