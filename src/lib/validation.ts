import { securityConfig } from './config';

// Input validation utilities
export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  sanitized?: any;
}

export interface ChatRequestValidationResult {
  isValid: boolean;
  errors: string[];
  sanitized?: {
    message: string;
    sessionId: string;
    language: string;
    useVoice: boolean;
    inputType?: 'text' | 'voice';
    location?: {
      latitude: number;
      longitude: number;
      accuracy?: number;
      timestamp?: Date;
    };
    requestedScope?: {
      timeRange?: 'today' | 'this_week' | 'this_month' | 'next_month' | 'any';
      locationRange?: 'nearby' | 'walking_distance' | 'cycling_distance' | 'city_wide' | 'any';
    };
  };
}

// Text sanitization and validation
export const validateAndSanitizeText = (input: string, fieldName: string = 'text'): ValidationResult => {
  const errors: string[] = [];
  
  // Check if input exists
  if (!input || typeof input !== 'string') {
    return { isValid: false, errors: [`${fieldName} is required and must be a string`] };
  }
  
  // Trim whitespace
  let sanitized = input.trim();
  
  // Check length
  if (sanitized.length === 0) {
    errors.push(`${fieldName} cannot be empty`);
  }
  
  if (sanitized.length > securityConfig.validation.maxMessageLength) {
    errors.push(`${fieldName} exceeds maximum length of ${securityConfig.validation.maxMessageLength} characters`);
  }
  
  // Remove dangerous characters and patterns
  // Remove control characters except newline, tab, and carriage return
  sanitized = sanitized.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');
  
  // Enhanced XSS protection
  const xssPatterns = [
    // Script tags (various forms)
    /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi,
    /<\/script>/gi,
    /<script[^>]*>/gi,
    
    // Javascript protocols
    /javascript:/gi,
    /vbscript:/gi,
    /data:text\/html/gi,
    
    // Event handlers
    /on\w+\s*=/gi,
    
    // HTML tags that can execute JavaScript
    /<iframe\b[^>]*>/gi,
    /<object\b[^>]*>/gi,
    /<embed\b[^>]*>/gi,
    /<link\b[^>]*>/gi,
    /<meta\b[^>]*>/gi,
    /<form\b[^>]*>/gi,
    
    // Style with expression
    /style\s*=.*expression\s*\(/gi,
    
    // HTML entities that might be used for XSS
    /&\#x?[0-9a-f]+;?/gi,
  ];
  
  let hadXssContent = false;
  xssPatterns.forEach(pattern => {
    if (pattern.test(sanitized)) {
      hadXssContent = true;
      sanitized = sanitized.replace(pattern, '');
    }
  });
  
  if (hadXssContent) {
    errors.push(`${fieldName} contained potentially malicious content that was removed`);
  }
  
  // Enhanced SQL injection protection
  const sqlPatterns = [
    // SQL keywords
    /(\b(SELECT|INSERT|UPDATE|DELETE|DROP|CREATE|ALTER|EXEC|EXECUTE|UNION|TRUNCATE|GRANT|REVOKE)\b)/gi,
    
    // SQL comments and terminators
    /(--|\/\*|\*\/|;)/g,
    
    // SQL injection patterns
    /(\b(OR|AND)\s+\w+\s*=\s*\w+)/gi,
    /(\b(OR|AND)\s+1\s*=\s*1)/gi,
    /(\b(OR|AND)\s+\w+\s*(LIKE|IN|IS))/gi,
    
    // Union-based injection
    /UNION\s+SELECT/gi,
    
    // Information schema access
    /information_schema/gi,
    
    // System functions
    /(LOAD_FILE|INTO\s+OUTFILE|INTO\s+DUMPFILE)/gi,
    
    // Hex encoding patterns
    /0x[0-9a-f]+/gi,
  ];
  
  let hadSqlContent = false;
  sqlPatterns.forEach(pattern => {
    if (pattern.test(sanitized)) {
      hadSqlContent = true;
    }
  });
  
  if (hadSqlContent) {
    errors.push(`${fieldName} contains potentially dangerous SQL patterns`);
  }
  
  // Path traversal protection
  const pathTraversalPatterns = [
    /\.\.\//g,
    /\.\.\\/g,
    /%2e%2e%2f/gi,
    /%2e%2e%5c/gi,
    /\.\.%2f/gi,
    /\.\.%5c/gi,
  ];
  
  let hadPathTraversal = false;
  pathTraversalPatterns.forEach(pattern => {
    if (pattern.test(sanitized)) {
      hadPathTraversal = true;
    }
  });
  
  if (hadPathTraversal) {
    errors.push(`${fieldName} contains path traversal patterns`);
  }
  
  // LDAP injection protection
  const ldapPatterns = [
    /[()\\*\x00]/g,
  ];
  
  let hadLdapContent = false;
  ldapPatterns.forEach(pattern => {
    if (pattern.test(sanitized)) {
      hadLdapContent = true;
    }
  });
  
  if (hadLdapContent) {
    errors.push(`${fieldName} contains LDAP injection patterns`);
  }
  
  // Check for excessive repetition (potential spam)
  const repeatedPattern = /(.)\1{20,}/;
  if (repeatedPattern.test(sanitized)) {
    errors.push(`${fieldName} contains excessive character repetition`);
  }
  
  // Final safety check: ensure no null bytes or excessive whitespace
  sanitized = sanitized.replace(/\0/g, '');
  sanitized = sanitized.replace(/\s{10,}/g, ' '); // Replace excessive whitespace
  
  // Check for encoded attacks
  const encodedPatterns = [
    /%3c/gi, // <
    /%3e/gi, // >
    /%22/gi, // "
    /%27/gi, // '
    /%28/gi, // (
    /%29/gi, // )
    /%3b/gi, // ;
  ];
  
  let hadEncodedAttack = false;
  encodedPatterns.forEach(pattern => {
    if (pattern.test(sanitized)) {
      hadEncodedAttack = true;
    }
  });
  
  if (hadEncodedAttack) {
    errors.push(`${fieldName} contains URL-encoded potentially dangerous content`);
  }
  
  return {
    isValid: errors.length === 0,
    errors,
    sanitized: errors.length === 0 ? sanitized : undefined,
  };
};

// Additional sanitization for HTML content (if needed)
export const sanitizeHtmlContent = (input: string): string => {
  if (!input) return '';
  
  // Basic HTML entity encoding for dangerous characters
  const htmlEntities: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#x27;',
    '/': '&#x2F;',
  };
  
  return input.replace(/[&<>"'/]/g, (char) => htmlEntities[char] || char);
};

// Session ID validation
export const validateSessionId = (sessionId: string): ValidationResult => {
  const errors: string[] = [];
  
  if (!sessionId || typeof sessionId !== 'string') {
    return { isValid: false, errors: ['Session ID is required'] };
  }
  
  // Check format (UUID v4 format)
  const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  if (!uuidPattern.test(sessionId)) {
    errors.push('Invalid session ID format');
  }
  
  return {
    isValid: errors.length === 0,
    errors,
    sanitized: sessionId,
  };
};

// Language validation
export const validateLanguage = (language: string): ValidationResult => {
  const supportedLanguages = ['ja', 'en', 'zh', 'ko'];
  const errors: string[] = [];
  
  if (!language || typeof language !== 'string') {
    return { isValid: false, errors: ['Language is required'] };
  }
  
  const sanitized = language.toLowerCase().trim();
  
  if (!supportedLanguages.includes(sanitized)) {
    errors.push(`Unsupported language: ${language}. Supported languages: ${supportedLanguages.join(', ')}`);
  }
  
  return {
    isValid: errors.length === 0,
    errors,
    sanitized: errors.length === 0 ? sanitized : undefined,
  };
};

// Audio file validation
export const validateAudioFile = (file: { size: number; type: string; data: string }): ValidationResult => {
  const errors: string[] = [];
  
  // Check file size
  if (file.size > securityConfig.validation.maxFileSize) {
    errors.push(`File size exceeds maximum limit of ${securityConfig.validation.maxFileSize / 1024 / 1024}MB`);
  }
  
  // Check MIME type
  if (!securityConfig.validation.allowedAudioTypes.includes(file.type)) {
    errors.push(`Unsupported audio format: ${file.type}. Allowed formats: ${securityConfig.validation.allowedAudioTypes.join(', ')}`);
  }
  
  // Validate base64 data
  try {
    const base64Pattern = /^[A-Za-z0-9+/]*={0,2}$/;
    if (!base64Pattern.test(file.data)) {
      errors.push('Invalid audio data format');
    }
  } catch {
    errors.push('Invalid audio data');
  }
  
  return {
    isValid: errors.length === 0,
    errors,
  };
};

// Request body validation for chat endpoint
export const validateChatRequest = (body: any): ChatRequestValidationResult => {
  const errors: string[] = [];
  
  if (!body || typeof body !== 'object') {
    return { isValid: false, errors: ['Request body is required'] };
  }
  
  // Validate message
  const messageValidation = validateAndSanitizeText(body.message, 'message');
  if (!messageValidation.isValid) {
    errors.push(...messageValidation.errors);
  }
  
  // Validate session ID
  const sessionValidation = validateSessionId(body.sessionId);
  if (!sessionValidation.isValid) {
    errors.push(...sessionValidation.errors);
  }
  
  // Validate language (optional)
  let languageValidation;
  if (body.language) {
    languageValidation = validateLanguage(body.language);
    if (!languageValidation.isValid) {
      errors.push(...languageValidation.errors);
    }
  }
  
  // Validate boolean fields
  if (body.useVoice !== undefined && typeof body.useVoice !== 'boolean') {
    errors.push('useVoice must be a boolean');
  }
  
  // Validate inputType (optional)
  if (body.inputType !== undefined && !['text', 'voice'].includes(body.inputType)) {
    errors.push('inputType must be either "text" or "voice"');
  }
  
  // Validate location (optional)
  let locationValidation;
  if (body.location) {
    locationValidation = validateLocation(body.location);
    if (!locationValidation.isValid) {
      errors.push(...locationValidation.errors);
    }
  }
  
  // Validate requestedScope (optional)
  let scopeValidation;
  if (body.requestedScope) {
    scopeValidation = validateRequestedScope(body.requestedScope);
    if (!scopeValidation.isValid) {
      errors.push(...scopeValidation.errors);
    }
  }
  
  return {
    isValid: errors.length === 0,
    errors,
    sanitized: errors.length === 0 && messageValidation.sanitized && sessionValidation.sanitized ? {
      message: messageValidation.sanitized,
      sessionId: sessionValidation.sanitized,
      language: body.language ? (languageValidation?.sanitized || 'ja') : 'ja',
      useVoice: Boolean(body.useVoice),
      inputType: (body.inputType as 'text' | 'voice') || 'text',
      location: locationValidation?.sanitized as {
        latitude: number;
        longitude: number;
        accuracy?: number;
        timestamp?: Date;
      } | undefined,
      requestedScope: scopeValidation?.sanitized as {
        timeRange?: 'today' | 'this_week' | 'this_month' | 'next_month' | 'any';
        locationRange?: 'nearby' | 'walking_distance' | 'cycling_distance' | 'city_wide' | 'any';
      } | undefined,
    } : undefined,
  };
};

// Rate limiting check (simple in-memory implementation)
const rateLimitStore = new Map<string, { count: number; resetTime: number }>();

export const checkRateLimit = (identifier: string): { allowed: boolean; retryAfter?: number } => {
  const now = Date.now();
  const windowMs = securityConfig.rateLimiting.windowMs;
  const maxRequests = securityConfig.rateLimiting.maxRequests;
  
  const current = rateLimitStore.get(identifier);
  
  if (!current || now > current.resetTime) {
    // First request or window expired
    rateLimitStore.set(identifier, {
      count: 1,
      resetTime: now + windowMs,
    });
    return { allowed: true };
  }
  
  if (current.count >= maxRequests) {
    return {
      allowed: false,
      retryAfter: Math.ceil((current.resetTime - now) / 1000),
    };
  }
  
  // Increment counter
  current.count++;
  rateLimitStore.set(identifier, current);
  
  return { allowed: true };
};

// Location validation
export const validateLocation = (location: any): ValidationResult => {
  const errors: string[] = [];
  
  if (!location || typeof location !== 'object') {
    return { isValid: false, errors: ['Location must be an object'] };
  }
  
  // Validate latitude
  if (typeof location.latitude !== 'number') {
    errors.push('Latitude must be a number');
  } else if (location.latitude < -90 || location.latitude > 90) {
    errors.push('Latitude must be between -90 and 90 degrees');
  }
  
  // Validate longitude
  if (typeof location.longitude !== 'number') {
    errors.push('Longitude must be a number');
  } else if (location.longitude < -180 || location.longitude > 180) {
    errors.push('Longitude must be between -180 and 180 degrees');
  }
  
  // Validate accuracy (optional)
  if (location.accuracy !== undefined && (typeof location.accuracy !== 'number' || location.accuracy < 0)) {
    errors.push('Accuracy must be a positive number');
  }
  
  // Validate timestamp (optional)
  if (location.timestamp !== undefined) {
    try {
      new Date(location.timestamp);
    } catch {
      errors.push('Invalid timestamp format');
    }
  }
  
  return {
    isValid: errors.length === 0,
    errors,
    sanitized: errors.length === 0 ? {
      latitude: location.latitude,
      longitude: location.longitude,
      accuracy: location.accuracy,
      timestamp: location.timestamp ? new Date(location.timestamp) : undefined
    } : undefined,
  };
};

// Requested scope validation
export const validateRequestedScope = (scope: any): ValidationResult => {
  const errors: string[] = [];
  
  if (!scope || typeof scope !== 'object') {
    return { isValid: true, errors: [] }; // Optional field
  }
  
  const validTimeRanges = ['today', 'this_week', 'this_month', 'next_month', 'any'];
  const validLocationRanges = ['nearby', 'walking_distance', 'cycling_distance', 'city_wide', 'any'];
  
  // Validate timeRange (optional)
  if (scope.timeRange !== undefined && !validTimeRanges.includes(scope.timeRange)) {
    errors.push(`Invalid timeRange. Must be one of: ${validTimeRanges.join(', ')}`);
  }
  
  // Validate locationRange (optional)
  if (scope.locationRange !== undefined && !validLocationRanges.includes(scope.locationRange)) {
    errors.push(`Invalid locationRange. Must be one of: ${validLocationRanges.join(', ')}`);
  }
  
  return {
    isValid: errors.length === 0,
    errors,
    sanitized: errors.length === 0 ? {
      timeRange: scope.timeRange,
      locationRange: scope.locationRange
    } : undefined,
  };
};

// Cleanup expired rate limit entries (should be called periodically)
export const cleanupRateLimit = (): void => {
  const now = Date.now();
  for (const [key, value] of rateLimitStore.entries()) {
    if (now > value.resetTime) {
      rateLimitStore.delete(key);
    }
  }
};