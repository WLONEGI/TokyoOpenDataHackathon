import { 
  validateAndSanitizeText, 
  validateSessionId, 
  validateLanguage, 
  validateChatRequest,
  checkRateLimit,
  cleanupRateLimit 
} from '../validation';

describe('Validation Utils', () => {
  describe('validateAndSanitizeText', () => {
    test('should validate normal text', () => {
      const result = validateAndSanitizeText('Hello world');
      expect(result.isValid).toBe(true);
      expect(result.sanitized).toBe('Hello world');
      expect(result.errors).toHaveLength(0);
    });

    test('should reject empty text', () => {
      const result = validateAndSanitizeText('   ');
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('text cannot be empty');
    });

    test('should reject text that is too long', () => {
      const longText = 'a'.repeat(2001);
      const result = validateAndSanitizeText(longText);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('text exceeds maximum length of 2000 characters');
    });

    test('should sanitize XSS attempts', () => {
      const maliciousText = '<script>alert("xss")</script>Hello';
      const result = validateAndSanitizeText(maliciousText);
      expect(result.isValid).toBe(true);
      expect(result.sanitized).not.toContain('<script>');
      expect(result.sanitized).toContain('Hello');
    });

    test('should detect potential SQL injection', () => {
      const sqlText = "'; DROP TABLE users; --";
      const result = validateAndSanitizeText(sqlText);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('text contains potentially dangerous content');
    });

    test('should reject excessive character repetition', () => {
      const spamText = 'a'.repeat(25);
      const result = validateAndSanitizeText(spamText);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('text contains excessive character repetition');
    });
  });

  describe('validateSessionId', () => {
    test('should validate correct UUID v4', () => {
      const validUuid = '550e8400-e29b-41d4-a716-446655440000';
      const result = validateSessionId(validUuid);
      expect(result.isValid).toBe(true);
      expect(result.sanitized).toBe(validUuid);
    });

    test('should reject invalid UUID format', () => {
      const invalidUuid = 'not-a-uuid';
      const result = validateSessionId(invalidUuid);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Invalid session ID format');
    });

    test('should reject empty session ID', () => {
      const result = validateSessionId('');
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Session ID is required');
    });
  });

  describe('validateLanguage', () => {
    test('should validate supported languages', () => {
      const supportedLanguages = ['ja', 'en', 'zh', 'ko'];
      
      supportedLanguages.forEach(lang => {
        const result = validateLanguage(lang);
        expect(result.isValid).toBe(true);
        expect(result.sanitized).toBe(lang);
      });
    });

    test('should handle case insensitive input', () => {
      const result = validateLanguage('EN');
      expect(result.isValid).toBe(true);
      expect(result.sanitized).toBe('en');
    });

    test('should reject unsupported language', () => {
      const result = validateLanguage('fr');
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Unsupported language: fr. Supported languages: ja, en, zh, ko');
    });
  });

  describe('validateChatRequest', () => {
    const validRequest = {
      message: 'Hello, how are you?',
      sessionId: '550e8400-e29b-41d4-a716-446655440000',
      language: 'en',
      useVoice: false
    };

    test('should validate complete request', () => {
      const result = validateChatRequest(validRequest);
      expect(result.isValid).toBe(true);
      expect(result.sanitized).toMatchObject({
        message: 'Hello, how are you?',
        sessionId: '550e8400-e29b-41d4-a716-446655440000',
        language: 'en',
        useVoice: false
      });
    });

    test('should use default language when not provided', () => {
      const { language, ...requestWithoutLang } = validRequest;
      
      const result = validateChatRequest(requestWithoutLang);
      expect(result.isValid).toBe(true);
      expect(result.sanitized?.language).toBe('ja');
    });

    test('should reject invalid message', () => {
      const invalidRequest = { ...validRequest, message: '' };
      const result = validateChatRequest(invalidRequest);
      expect(result.isValid).toBe(false);
      expect(result.errors.some(error => error.includes('message'))).toBe(true);
    });

    test('should reject invalid session ID', () => {
      const invalidRequest = { ...validRequest, sessionId: 'invalid' };
      const result = validateChatRequest(invalidRequest);
      expect(result.isValid).toBe(false);
      expect(result.errors.some(error => error.includes('session'))).toBe(true);
    });

    test('should validate boolean useVoice field', () => {
      const invalidRequest = { ...validRequest, useVoice: 'true' as any };
      const result = validateChatRequest(invalidRequest);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('useVoice must be a boolean');
    });
  });

  describe('checkRateLimit', () => {
    beforeEach(() => {
      cleanupRateLimit();
    });

    test('should allow first request', () => {
      const result = checkRateLimit('test-ip');
      expect(result.allowed).toBe(true);
      expect(result.retryAfter).toBeUndefined();
    });

    test('should track multiple requests', () => {
      // Make multiple requests
      for (let i = 0; i < 5; i++) {
        const result = checkRateLimit('test-ip');
        expect(result.allowed).toBe(true);
      }
    });

    test('should block after rate limit exceeded', () => {
      // Exceed rate limit (assuming limit is 100 for development)
      for (let i = 0; i < 1001; i++) {
        checkRateLimit('test-ip');
      }
      
      const result = checkRateLimit('test-ip');
      expect(result.allowed).toBe(false);
      expect(result.retryAfter).toBeGreaterThan(0);
    });

    test('should allow different IPs independently', () => {
      // Exceed limit for one IP
      for (let i = 0; i < 1001; i++) {
        checkRateLimit('test-ip-1');
      }
      
      const blockedResult = checkRateLimit('test-ip-1');
      expect(blockedResult.allowed).toBe(false);
      
      // Different IP should still be allowed
      const allowedResult = checkRateLimit('test-ip-2');
      expect(allowedResult.allowed).toBe(true);
    });
  });
});