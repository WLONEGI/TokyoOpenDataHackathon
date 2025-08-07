import { CloudStorageService } from '../CloudStorageService';

jest.mock('@/lib/logger', () => ({
  log: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
  },
}));

// Mock fetch globally
global.fetch = jest.fn();

describe('CloudStorageService', () => {
  let service: CloudStorageService;
  const mockConfig = {
    projectId: 'test-project',
    keyFilename: 'test-key.json',
    bucketName: 'test-bucket',
  };

  beforeEach(() => {
    jest.clearAllMocks();
    service = new CloudStorageService(mockConfig);
    
    // Mock successful token response
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        access_token: 'mock-token',
        expires_in: 3600,
        token_type: 'Bearer',
      }),
    });
  });

  describe('initialization', () => {
    it('should initialize with config', () => {
      expect(service).toBeInstanceOf(CloudStorageService);
    });

    it('should throw error with invalid config', () => {
      expect(() => new CloudStorageService({} as any)).toThrow('Invalid CloudStorage configuration');
    });
  });

  describe('uploadFile', () => {
    const mockFile = new Uint8Array([1, 2, 3, 4]);
    const mockFileName = 'test-file.txt';

    it('should upload file successfully', async () => {
      // Mock bucket verification
      (global.fetch as jest.Mock)
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ access_token: 'mock-token' }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({}),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({
            name: mockFileName,
            bucket: mockConfig.bucketName,
            size: mockFile.length,
            timeCreated: new Date().toISOString(),
          }),
        });

      const result = await service.uploadFile(mockFile, mockFileName);

      expect(result.success).toBe(true);
      expect(result.fileName).toBe(mockFileName);
      expect(result.url).toContain(mockFileName);
    });

    it('should handle upload failure', async () => {
      (global.fetch as jest.Mock)
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ access_token: 'mock-token' }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({}),
        })
        .mockResolvedValueOnce({
          ok: false,
          status: 500,
          statusText: 'Internal Server Error',
        });

      const result = await service.uploadFile(mockFile, mockFileName);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Upload failed');
    });

    it('should handle network error', async () => {
      (global.fetch as jest.Mock).mockRejectedValue(new Error('Network error'));

      const result = await service.uploadFile(mockFile, mockFileName);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Network error');
    });
  });

  describe('downloadFile', () => {
    const mockFileName = 'test-file.txt';
    const mockFileContent = new Uint8Array([1, 2, 3, 4]);

    it('should download file successfully', async () => {
      (global.fetch as jest.Mock)
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ access_token: 'mock-token' }),
        })
        .mockResolvedValueOnce({
          ok: true,
          arrayBuffer: () => Promise.resolve(mockFileContent.buffer),
        });

      const result = await service.downloadFile(mockFileName);

      expect(result.success).toBe(true);
      expect(result.data).toEqual(mockFileContent);
    });

    it('should handle download failure', async () => {
      (global.fetch as jest.Mock)
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ access_token: 'mock-token' }),
        })
        .mockResolvedValueOnce({
          ok: false,
          status: 404,
          statusText: 'Not Found',
        });

      const result = await service.downloadFile(mockFileName);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Download failed');
    });
  });

  describe('deleteFile', () => {
    const mockFileName = 'test-file.txt';

    it('should delete file successfully', async () => {
      (global.fetch as jest.Mock)
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ access_token: 'mock-token' }),
        })
        .mockResolvedValueOnce({
          ok: true,
        });

      const result = await service.deleteFile(mockFileName);

      expect(result.success).toBe(true);
    });

    it('should handle delete failure', async () => {
      (global.fetch as jest.Mock)
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ access_token: 'mock-token' }),
        })
        .mockResolvedValueOnce({
          ok: false,
          status: 404,
          statusText: 'Not Found',
        });

      const result = await service.deleteFile(mockFileName);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Delete failed');
    });
  });

  describe('listFiles', () => {
    it('should list files successfully', async () => {
      const mockFiles = {
        items: [
          {
            name: 'file1.txt',
            size: '100',
            timeCreated: new Date().toISOString(),
          },
          {
            name: 'file2.txt',
            size: '200',
            timeCreated: new Date().toISOString(),
          },
        ],
      };

      (global.fetch as jest.Mock)
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ access_token: 'mock-token' }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(mockFiles),
        });

      const result = await service.listFiles();

      expect(result.success).toBe(true);
      expect(result.files).toHaveLength(2);
      expect(result.files?.[0].name).toBe('file1.txt');
    });

    it('should handle list failure', async () => {
      (global.fetch as jest.Mock)
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ access_token: 'mock-token' }),
        })
        .mockResolvedValueOnce({
          ok: false,
          status: 403,
          statusText: 'Forbidden',
        });

      const result = await service.listFiles();

      expect(result.success).toBe(false);
      expect(result.error).toContain('List failed');
    });
  });

  describe('token management', () => {
    it('should refresh token when expired', async () => {
      // First call - token expired
      (global.fetch as jest.Mock)
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({
            access_token: 'new-token',
            expires_in: 3600,
          }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ items: [] }),
        });

      await service.listFiles();

      expect(global.fetch).toHaveBeenCalledTimes(2);
    });

    it('should handle token refresh failure', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        status: 400,
        statusText: 'Bad Request',
      });

      const result = await service.uploadFile(new Uint8Array([1]), 'test.txt');

      expect(result.success).toBe(false);
      expect(result.error).toContain('Authentication failed');
    });
  });

  describe('metadata operations', () => {
    it('should upload file with metadata', async () => {
      const mockFile = new Uint8Array([1, 2, 3]);
      const mockMetadata = {
        contentType: 'text/plain',
        customMetadata: { purpose: 'test' },
      };

      (global.fetch as jest.Mock)
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ access_token: 'mock-token' }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({}),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({
            name: 'test.txt',
            contentType: 'text/plain',
            metadata: mockMetadata.customMetadata,
          }),
        });

      const result = await service.uploadFile(mockFile, 'test.txt', mockMetadata);

      expect(result.success).toBe(true);
    });
  });
});