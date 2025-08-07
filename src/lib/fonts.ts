import { Inter, Noto_Sans_JP } from 'next/font/google'

// Inter font for Latin characters
export const inter = Inter({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-inter',
  preload: true,
  fallback: [
    'system-ui',
    '-apple-system',
    'BlinkMacSystemFont',
    'Segoe UI',
    'Roboto',
    'Helvetica Neue',
    'Arial',
    'sans-serif'
  ]
})

// Noto Sans JP for Japanese characters
export const notoSansJP = Noto_Sans_JP({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-noto-sans-jp',
  preload: true,
  weight: ['300', '400', '500', '600', '700'],
  fallback: [
    'Hiragino Kaku Gothic ProN',
    'ヒラギノ角ゴ ProN W3',
    'Meiryo',
    'メイリオ',
    'sans-serif'
  ]
})

// Font class names for use in components
export const fontClassNames = `${inter.variable} ${notoSansJP.variable}`