'use client'

import { Moon, Sun, Monitor } from 'lucide-react'
import { useTheme } from '@/components/providers/ThemeProvider'

const themes = [
  { value: 'light', label: 'ライト', icon: Sun },
  { value: 'dark', label: 'ダーク', icon: Moon },
  { value: 'system', label: 'システム', icon: Monitor },
] as const

export function ThemeToggle() {
  const { theme, setTheme } = useTheme()

  return (
    <div className="relative">
      <div className="flex items-center bg-primary-100 dark:bg-primary-800 rounded-xl p-1">
        {themes.map(({ value, label, icon: Icon }) => {
          const isActive = theme === value
          return (
            <button
              key={value}
              onClick={() => setTheme(value)}
              className={`
                flex items-center space-x-2 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-200
                ${isActive 
                  ? 'bg-white dark:bg-primary-700 text-primary-900 dark:text-white shadow-sm' 
                  : 'text-primary-600 dark:text-primary-300 hover:text-primary-900 dark:hover:text-white hover:bg-white/50 dark:hover:bg-primary-700/50'
                }
              `}
              aria-label={`${label}モードに切り替え`}
            >
              <Icon className="w-4 h-4" />
              <span className="hidden sm:inline">{label}</span>
            </button>
          )
        })}
      </div>
    </div>
  )
}

export function ThemeToggleSimple() {
  const { actualTheme, setTheme } = useTheme()

  const toggleTheme = () => {
    setTheme(actualTheme === 'light' ? 'dark' : 'light')
  }

  return (
    <button
      onClick={toggleTheme}
      className="p-2 rounded-lg bg-primary-100 dark:bg-primary-800 text-primary-600 dark:text-primary-300 hover:text-primary-900 dark:hover:text-white hover:bg-primary-200 dark:hover:bg-primary-700 transition-all duration-200"
      aria-label={`${actualTheme === 'light' ? 'ダーク' : 'ライト'}モードに切り替え`}
    >
      {actualTheme === 'light' ? (
        <Moon className="w-5 h-5" />
      ) : (
        <Sun className="w-5 h-5" />
      )}
    </button>
  )
}