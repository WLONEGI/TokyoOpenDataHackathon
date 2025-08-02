/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    appDir: true,
  },
  images: {
    domains: ['storage.googleapis.com'],
    formats: ['image/webp', 'image/avif'],
  },
  env: {
    GEMINI_API_KEY: process.env.GEMINI_API_KEY,
    REDIS_URL: process.env.REDIS_URL,
    GCP_PROJECT_ID: process.env.GCP_PROJECT_ID,
  },
  async headers() {
    return [
      {
        source: '/api/:path*',
        headers: [
          {
            key: 'Access-Control-Allow-Origin',
            value: process.env.NODE_ENV === 'production' 
              ? 'https://tokyo-ai-chat.metro.tokyo.lg.jp' 
              : '*',
          },
          {
            key: 'Access-Control-Allow-Methods',
            value: 'GET, POST, PUT, DELETE, OPTIONS',
          },
          {
            key: 'Access-Control-Allow-Headers',
            value: 'Content-Type, Authorization, X-Session-ID',
          },
        ],
      },
    ];
  },
  webpack: (config, { dev, isServer }) => {
    // 音声処理のためのWeb Audio API対応
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        path: false,
        crypto: false,
      };
    }
    
    return config;
  },
};

module.exports = nextConfig;