// ============================================
// Habit Build - API Middleware
// ============================================

import type { Env, DBUser } from './types';
import { getAuthToken, hashString, errorResponse } from './utils';

// Extend the request context with user info
export interface AuthenticatedContext {
  user: DBUser;
}

// Routes that don't require authentication
const PUBLIC_ROUTES = [
  '/api/auth/register',
  '/api/auth/recover',
];

// Allowed origins for CORS (add your production domain)
const ALLOWED_ORIGINS = [
  'https://habit-build.pages.dev',
  'http://localhost:4321',  // Astro dev server
  'http://localhost:8788',  // Wrangler pages dev
];

/**
 * Check if origin is allowed for CORS
 */
function isAllowedOrigin(origin: string | null): boolean {
  if (!origin) return false;
  return ALLOWED_ORIGINS.some(allowed => 
    origin === allowed || origin.endsWith('.habit-build.pages.dev')
  );
}

/**
 * Get CORS headers for a given origin
 */
function getCorsHeaders(origin: string | null): Record<string, string> {
  const headers: Record<string, string> = {};
  
  if (origin && isAllowedOrigin(origin)) {
    headers['Access-Control-Allow-Origin'] = origin;
    headers['Access-Control-Allow-Credentials'] = 'true';
  }
  
  headers['Access-Control-Allow-Methods'] = 'GET, POST, PUT, DELETE, OPTIONS';
  headers['Access-Control-Allow-Headers'] = 'Content-Type, Authorization';
  headers['Access-Control-Max-Age'] = '86400';
  
  return headers;
}

/**
 * Security headers to protect against common attacks
 */
function getSecurityHeaders(): Record<string, string> {
  return {
    // Prevent MIME type sniffing
    'X-Content-Type-Options': 'nosniff',
    // Prevent clickjacking
    'X-Frame-Options': 'DENY',
    // XSS protection (legacy, but still useful)
    'X-XSS-Protection': '1; mode=block',
    // Control referrer information
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    // Content Security Policy
    'Content-Security-Policy': "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data:; connect-src 'self'",
    // Strict Transport Security (HTTPS only)
    'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
    // Permissions Policy
    'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
  };
}

export const onRequest: PagesFunction<Env> = async (context) => {
  const { request, env, next } = context;
  const url = new URL(request.url);
  const origin = request.headers.get('Origin');
  
  // Handle CORS preflight
  if (request.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: {
        ...getCorsHeaders(origin),
      },
    });
  }
  
  // Skip auth for non-API routes and public routes
  if (!url.pathname.startsWith('/api/') || PUBLIC_ROUTES.includes(url.pathname)) {
    const response = await next();
    const newResponse = new Response(response.body, response);
    
    // Add security headers to all responses
    const securityHeaders = getSecurityHeaders();
    for (const [key, value] of Object.entries(securityHeaders)) {
      newResponse.headers.set(key, value);
    }
    
    // Add CORS headers if origin is allowed
    if (origin && isAllowedOrigin(origin)) {
      newResponse.headers.set('Access-Control-Allow-Origin', origin);
      newResponse.headers.set('Access-Control-Allow-Credentials', 'true');
    }
    
    return newResponse;
  }
  
  // Validate auth token
  const token = getAuthToken(request);
  if (!token) {
    return errorResponse('Authentication required', 401, 'AUTH_REQUIRED');
  }
  
  // Hash the token and look up user
  const tokenHash = await hashString(token);
  const user = await env.DB.prepare(
    'SELECT * FROM users WHERE auth_token_hash = ?'
  ).bind(tokenHash).first<DBUser>();
  
  if (!user) {
    return errorResponse('Invalid or expired token', 401, 'INVALID_TOKEN');
  }
  
  // Add user to context data
  context.data = { ...context.data, user };
  
  // Continue to the handler
  const response = await next();
  
  // Add CORS and security headers to response
  const newResponse = new Response(response.body, response);
  
  // Add security headers
  const securityHeaders = getSecurityHeaders();
  for (const [key, value] of Object.entries(securityHeaders)) {
    newResponse.headers.set(key, value);
  }
  
  // Add CORS headers if origin is allowed
  if (origin && isAllowedOrigin(origin)) {
    newResponse.headers.set('Access-Control-Allow-Origin', origin);
    newResponse.headers.set('Access-Control-Allow-Credentials', 'true');
  }
  
  return newResponse;
};
