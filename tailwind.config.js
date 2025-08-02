/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        'tokyo-blue': '#003366',
        'tokyo-green': '#008844',
        'tokyo-red': '#cc3333',
        'tokyo-gray': '#666666',
      },
      fontFamily: {
        'noto-sans': ['Noto Sans JP', 'sans-serif'],
      },
    },
  },
  plugins: [],
  darkMode: 'class',
}