'use client'

import React, { Component, ReactNode } from 'react'
import { AlertTriangle, RefreshCw } from 'lucide-react'

interface Props {
  children: ReactNode
  fallback?: ReactNode
}

interface State {
  hasError: boolean
  error?: Error
  errorInfo?: any
}

export default class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false
  }

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  public componentDidCatch(error: Error, errorInfo: any) {
    console.error('ErrorBoundary caught an error:', error, errorInfo)
    this.setState({
      error,
      errorInfo
    })

    // ここで analytics やエラー報告サービスに送信できます
    // trackError(error, errorInfo)
  }

  public render() {
    if (this.state.hasError) {
      // カスタムフォールバック UI が提供されている場合はそれを使用
      if (this.props.fallback) {
        return this.props.fallback
      }

      // デフォルトのエラー UI
      return (
        <div className="min-h-screen bg-primary-50 dark:bg-primary-900 flex items-center justify-center p-6">
          <div className="max-w-md mx-auto text-center">
            <div className="w-16 h-16 bg-red-100 dark:bg-red-900/20 rounded-full flex items-center justify-center mx-auto mb-6">
              <AlertTriangle className="w-8 h-8 text-red-600 dark:text-red-400" />
            </div>
            
            <h1 className="text-xl font-semibold text-primary-900 dark:text-primary-100 mb-3">
              エラーが発生しました
            </h1>
            
            <p className="text-primary-600 dark:text-primary-300 mb-6 leading-relaxed">
              申し訳ございません。予期しないエラーが発生しました。ページを再読み込みしてお試しください。
            </p>

            <div className="space-y-3">
              <button
                onClick={() => window.location.reload()}
                className="w-full btn-primary flex items-center justify-center space-x-2"
              >
                <RefreshCw className="w-4 h-4" />
                <span>ページを再読み込み</span>
              </button>
              
              <button
                onClick={() => {
                  this.setState({ hasError: false, error: undefined, errorInfo: undefined })
                }}
                className="w-full btn-secondary"
              >
                再試行
              </button>
            </div>

            {process.env.NODE_ENV === 'development' && this.state.error && (
              <details className="mt-6 text-left">
                <summary className="text-sm text-primary-500 dark:text-primary-400 cursor-pointer hover:text-primary-700 dark:hover:text-primary-200">
                  開発者情報
                </summary>
                <pre className="mt-2 p-3 bg-primary-100 dark:bg-primary-800 rounded-lg text-xs text-primary-800 dark:text-primary-200 overflow-auto">
                  {this.state.error.toString()}
                  {this.state.errorInfo && this.state.errorInfo.componentStack}
                </pre>
              </details>
            )}
          </div>
        </div>
      )
    }

    return this.props.children
  }
}

// Functional error boundary hook for React components
export function useErrorHandler() {
  return (error: Error, errorInfo?: any) => {
    console.error('Error caught by error handler:', error, errorInfo)
    // ここでエラー報告サービスに送信
    // trackError(error, errorInfo)
  }
}