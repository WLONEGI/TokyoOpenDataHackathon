import { NextRequest, NextResponse } from 'next/server';
import { log, generateRequestId } from '@/lib/logger';
import { isProduction } from '@/lib/config';

export function middleware(request: NextRequest) {
  const requestId = generateRequestId();
  const response = NextResponse.next();

  // Security Headers
  const securityHeaders = {
    // Prevent MIME type sniffing
    'X-Content-Type-Options': 'nosniff',
    
    // Prevent clickjacking
    'X-Frame-Options': 'DENY',
    
    // Enable XSS protection
    'X-XSS-Protection': '1; mode=block',
    
    // Referrer policy
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    
    // Content Security Policy
    'Content-Security-Policy': isProduction() 
      ? "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self' data:; connect-src 'self' https://generativelanguage.googleapis.com; media-src 'self'; object-src 'none'; base-uri 'self'; form-action 'self';"
      : "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self' data:; connect-src 'self' https://generativelanguage.googleapis.com ws: wss:; media-src 'self'; object-src 'none'; base-uri 'self'; form-action 'self';",
    
    // Permissions Policy (formerly Feature Policy)
    'Permissions-Policy': 'microphone=*, camera=(), geolocation=(), payment=(), usb=(), interest-cohort=()',
    
    // Strict Transport Security (HTTPS only)
    ...(isProduction() && {
      'Strict-Transport-Security': 'max-age=31536000; includeSubDomains; preload'
    }),
  };

  // Apply security headers
  Object.entries(securityHeaders).forEach(([key, value]) => {
    if (value) {
      response.headers.set(key, value);
    }
  });

  // CORS headers for API routes
  if (request.nextUrl.pathname.startsWith('/api/')) {
    const allowedOrigin = isProduction() 
      ? (process.env.ALLOWED_ORIGIN || 'https://tokyo-ai-chat.vercel.app') 
      : '*';
    response.headers.set('Access-Control-Allow-Origin', allowedOrigin);
    response.headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    response.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');
    response.headers.set('Access-Control-Max-Age', '86400'); // 24 hours
  }

  // Rate limiting headers (these would be set by actual rate limiting logic)
  if (request.nextUrl.pathname.startsWith('/api/chat')) {
    response.headers.set('X-RateLimit-Limit', '100');
    response.headers.set('X-RateLimit-Window', '900'); // 15 minutes
  }

  // Request ID for tracing
  response.headers.set('X-Request-ID', requestId);

  // Performance and monitoring headers
  response.headers.set('X-Powered-By', 'Tokyo Open Data AI Assistant');
  
  if (isProduction()) {
    // Remove default Next.js headers in production
    response.headers.delete('X-Powered-By');
    response.headers.set('Server', 'Tokyo-AI');
  }

  // Log security-sensitive requests
  if (request.nextUrl.pathname.startsWith('/api/')) {
    const clientIP = request.headers.get('x-forwarded-for') || 
                    request.headers.get('x-real-ip') || 
                    'unknown';
    
    log.security('API request received', {
      method: request.method,
      path: request.nextUrl.pathname,
      clientIP,
      userAgent: request.headers.get('user-agent')?.substring(0, 200),
      referer: request.headers.get('referer'),
    }, requestId);
  }

  return response;
}

// Handle preflight OPTIONS requests
export async function handleOptions(request: NextRequest) {
  const response = new NextResponse(null, { status: 200 });
  
  // CORS preflight headers
  const allowedOrigin = isProduction() 
    ? (process.env.ALLOWED_ORIGIN || 'https://tokyo-ai-chat.vercel.app') 
    : '*';
  response.headers.set('Access-Control-Allow-Origin', allowedOrigin);
  response.headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  response.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');
  response.headers.set('Access-Control-Max-Age', '86400');
  
  return response;
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public files with extensions
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};