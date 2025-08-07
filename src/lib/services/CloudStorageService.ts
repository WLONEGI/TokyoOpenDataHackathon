// Google Cloud Storage Service for file management and data persistence
import { config } from '@/lib/config';
import { log } from '@/lib/logger';
import { OpenDataItem, SupportedLanguage } from '@/types';

interface CloudStorageConfig {
  projectId: string;
  bucketName: string;
  location: string;
}

interface StorageFile {
  id: string;
  name: string;
  size: number;
  contentType: string;
  lastModified: Date;
  url: string;
  metadata?: Record<string, any>;
}

interface UploadOptions {
  fileName: string;
  contentType: string;
  metadata?: Record<string, any>;
  publicRead?: boolean;
}

export class CloudStorageService {
  private config: CloudStorageConfig;
  private isInitialized = false;
  private accessToken: string | null = null;
  private tokenExpiry: number = 0;

  constructor() {
    this.config = {
      projectId: config.gcpProjectId || '',
      bucketName: process.env.GCP_STORAGE_BUCKET || 'tokyo-ai-assistant-data',
      location: config.gcpRegion || 'us-central1',
    };
  }

  async initialize(): Promise<void> {
    try {
      if (this.isInitialized) {
        return;
      }

      // Validate configuration
      if (!this.config.projectId) {
        throw new Error('GCP Project ID is required for Cloud Storage');
      }

      // Get access token for authentication
      await this.refreshAccessToken();

      // Verify bucket exists or create it
      await this.ensureBucketExists();

      this.isInitialized = true;
      log.info('Cloud Storage service initialized', {
        projectId: this.config.projectId,
        bucketName: this.config.bucketName,
        location: this.config.location,
      });

    } catch (error) {
      log.error('Failed to initialize Cloud Storage', error as Error);
      throw error;
    }
  }

  private async refreshAccessToken(): Promise<void> {
    try {
      // In production, this would use Google Cloud Authentication
      // For now, we'll simulate the token acquisition
      if (process.env.NODE_ENV === 'production') {
        // This would use Google Auth Library in real implementation
        // const auth = new GoogleAuth({
        //   scopes: ['https://www.googleapis.com/auth/cloud-platform']
        // });
        // const authClient = await auth.getClient();
        // const token = await authClient.getAccessToken();
        // this.accessToken = token.token;
        // this.tokenExpiry = Date.now() + (token.expires_in * 1000);
        
        // For demo purposes, we'll use a placeholder
        this.accessToken = 'placeholder-token';
        this.tokenExpiry = Date.now() + (3600 * 1000); // 1 hour
      } else {
        // Development mode - use placeholder
        this.accessToken = 'dev-mode-token';
        this.tokenExpiry = Date.now() + (3600 * 1000);
      }

      log.debug('Cloud Storage access token refreshed');
    } catch (error) {
      log.error('Failed to refresh Cloud Storage access token', error as Error);
      throw error;
    }
  }

  private async ensureValidToken(): Promise<void> {
    if (!this.accessToken || Date.now() >= this.tokenExpiry - 300000) { // Refresh 5 minutes before expiry
      await this.refreshAccessToken();
    }
  }

  private async ensureBucketExists(): Promise<void> {
    try {
      await this.ensureValidToken();

      // Check if bucket exists
      const bucketUrl = `https://storage.googleapis.com/storage/v1/b/${this.config.bucketName}`;
      
      const response = await fetch(bucketUrl, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${this.accessToken}`,
        },
      });

      if (response.status === 404) {
        // Bucket doesn't exist, create it
        await this.createBucket();
      } else if (!response.ok) {
        throw new Error(`Failed to check bucket existence: ${response.status}`);
      }

      log.debug('Bucket verified or created', { bucketName: this.config.bucketName });
    } catch (error) {
      log.error('Failed to ensure bucket exists', error as Error);
      // In demo mode, we'll continue without throwing
      if (process.env.NODE_ENV !== 'development') {
        throw error;
      }
    }
  }

  private async createBucket(): Promise<void> {
    try {
      const createUrl = `https://storage.googleapis.com/storage/v1/b?project=${this.config.projectId}`;
      
      const bucketConfig = {
        name: this.config.bucketName,
        location: this.config.location,
        storageClass: 'STANDARD',
        lifecycle: {
          rule: [
            {
              action: { type: 'Delete' },
              condition: { age: 365 } // Auto-delete after 1 year
            }
          ]
        },
        cors: [
          {
            origin: ['*'],
            method: ['GET', 'POST', 'PUT', 'DELETE'],
            responseHeader: ['Content-Type'],
          }
        ]
      };

      const response = await fetch(createUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(bucketConfig),
      });

      if (!response.ok) {
        throw new Error(`Failed to create bucket: ${response.status}`);
      }

      log.info('Bucket created successfully', { bucketName: this.config.bucketName });
    } catch (error) {
      log.error('Failed to create bucket', error as Error);
      throw error;
    }
  }

  async uploadFile(data: Buffer | string, options: UploadOptions): Promise<StorageFile> {
    try {
      if (!this.isInitialized) {
        await this.initialize();
      }

      await this.ensureValidToken();

      const uploadUrl = `https://storage.googleapis.com/upload/storage/v1/b/${this.config.bucketName}/o?uploadType=media&name=${encodeURIComponent(options.fileName)}`;

      const response = await fetch(uploadUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.accessToken}`,
          'Content-Type': options.contentType,
          ...(options.metadata && {
            'x-goog-meta-custom': JSON.stringify(options.metadata)
          }),
        },
        body: data,
      });

      if (!response.ok) {
        throw new Error(`Failed to upload file: ${response.status}`);
      }

      const fileInfo = await response.json();
      
      const storageFile: StorageFile = {
        id: fileInfo.id,
        name: fileInfo.name,
        size: parseInt(fileInfo.size),
        contentType: fileInfo.contentType,
        lastModified: new Date(fileInfo.timeCreated),
        url: `https://storage.googleapis.com/${this.config.bucketName}/${fileInfo.name}`,
        metadata: options.metadata,
      };

      log.info('File uploaded successfully', {
        fileName: options.fileName,
        size: storageFile.size,
        contentType: options.contentType,
      });

      return storageFile;
    } catch (error) {
      log.error('Failed to upload file', error as Error, {
        fileName: options.fileName,
        contentType: options.contentType,
      });
      throw error;
    }
  }

  async downloadFile(fileName: string): Promise<Buffer> {
    try {
      if (!this.isInitialized) {
        await this.initialize();
      }

      await this.ensureValidToken();

      const downloadUrl = `https://storage.googleapis.com/storage/v1/b/${this.config.bucketName}/o/${encodeURIComponent(fileName)}?alt=media`;

      const response = await fetch(downloadUrl, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${this.accessToken}`,
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to download file: ${response.status}`);
      }

      const arrayBuffer = await response.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);

      log.debug('File downloaded successfully', {
        fileName,
        size: buffer.length,
      });

      return buffer;
    } catch (error) {
      log.error('Failed to download file', error as Error, { fileName });
      throw error;
    }
  }

  async deleteFile(fileName: string): Promise<void> {
    try {
      if (!this.isInitialized) {
        await this.initialize();
      }

      await this.ensureValidToken();

      const deleteUrl = `https://storage.googleapis.com/storage/v1/b/${this.config.bucketName}/o/${encodeURIComponent(fileName)}`;

      const response = await fetch(deleteUrl, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${this.accessToken}`,
        },
      });

      if (!response.ok && response.status !== 404) {
        throw new Error(`Failed to delete file: ${response.status}`);
      }

      log.info('File deleted successfully', { fileName });
    } catch (error) {
      log.error('Failed to delete file', error as Error, { fileName });
      throw error;
    }
  }

  async listFiles(prefix?: string, limit: number = 100): Promise<StorageFile[]> {
    try {
      if (!this.isInitialized) {
        await this.initialize();
      }

      await this.ensureValidToken();

      let listUrl = `https://storage.googleapis.com/storage/v1/b/${this.config.bucketName}/o?maxResults=${limit}`;
      if (prefix) {
        listUrl += `&prefix=${encodeURIComponent(prefix)}`;
      }

      const response = await fetch(listUrl, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${this.accessToken}`,
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to list files: ${response.status}`);
      }

      const data = await response.json();
      const files: StorageFile[] = (data.items || []).map((item: any) => ({
        id: item.id,
        name: item.name,
        size: parseInt(item.size),
        contentType: item.contentType,
        lastModified: new Date(item.timeCreated),
        url: `https://storage.googleapis.com/${this.config.bucketName}/${item.name}`,
        metadata: item.metadata || {},
      }));

      log.debug('Files listed successfully', {
        count: files.length,
        prefix: prefix || 'all',
      });

      return files;
    } catch (error) {
      log.error('Failed to list files', error as Error, { prefix });
      return [];
    }
  }

  async backupOpenDataItems(items: OpenDataItem[], language: SupportedLanguage = 'ja'): Promise<StorageFile> {
    try {
      const backup = {
        timestamp: new Date().toISOString(),
        language,
        itemCount: items.length,
        items: items,
        version: '1.0',
      };

      const fileName = `backups/opendata-${language}-${Date.now()}.json`;
      const data = JSON.stringify(backup, null, 2);

      return await this.uploadFile(Buffer.from(data, 'utf-8'), {
        fileName,
        contentType: 'application/json',
        metadata: {
          type: 'opendata-backup',
          language,
          itemCount: items.length.toString(),
          version: '1.0',
        },
      });
    } catch (error) {
      log.error('Failed to backup OpenData items', error as Error, {
        itemCount: items.length,
        language,
      });
      throw error;
    }
  }

  async restoreOpenDataItems(backupFileName: string): Promise<OpenDataItem[]> {
    try {
      const data = await this.downloadFile(backupFileName);
      const backup = JSON.parse(data.toString('utf-8'));

      if (!backup.items || !Array.isArray(backup.items)) {
        throw new Error('Invalid backup format');
      }

      log.info('OpenData items restored from backup', {
        fileName: backupFileName,
        itemCount: backup.items.length,
        language: backup.language,
        timestamp: backup.timestamp,
      });

      return backup.items;
    } catch (error) {
      log.error('Failed to restore OpenData items', error as Error, {
        backupFileName,
      });
      throw error;
    }
  }

  async uploadUserFile(file: File, userId: string): Promise<StorageFile> {
    try {
      const fileName = `users/${userId}/${Date.now()}-${file.name}`;
      const arrayBuffer = await file.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);

      return await this.uploadFile(buffer, {
        fileName,
        contentType: file.type || 'application/octet-stream',
        metadata: {
          originalName: file.name,
          uploadedBy: userId,
          uploadDate: new Date().toISOString(),
        },
      });
    } catch (error) {
      log.error('Failed to upload user file', error as Error, {
        fileName: file.name,
        fileSize: file.size,
        userId,
      });
      throw error;
    }
  }

  getStats() {
    return {
      isInitialized: this.isInitialized,
      hasValidToken: !!this.accessToken && Date.now() < this.tokenExpiry,
      config: {
        projectId: this.config.projectId,
        bucketName: this.config.bucketName,
        location: this.config.location,
      },
      provider: 'Google Cloud Storage',
      capabilities: [
        'file_upload',
        'file_download',
        'file_listing',
        'backup_restore',
        'automatic_cleanup',
        'cors_enabled'
      ]
    };
  }

  async cleanup(): Promise<void> {
    this.isInitialized = false;
    this.accessToken = null;
    this.tokenExpiry = 0;
    log.info('Cloud Storage service cleaned up');
  }
}

// Export singleton instance
let cloudStorageInstance: CloudStorageService | null = null;

export const getCloudStorageService = (): CloudStorageService => {
  if (!cloudStorageInstance) {
    cloudStorageInstance = new CloudStorageService();
  }
  return cloudStorageInstance;
};