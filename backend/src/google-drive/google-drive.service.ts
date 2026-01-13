import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { google, drive_v3 } from 'googleapis';
import axios from 'axios';
import { Readable } from 'stream';

@Injectable()
export class GoogleDriveService implements OnModuleInit {
    private drive: drive_v3.Drive | undefined;
    private auth: any | undefined;
    private readonly logger = new Logger(GoogleDriveService.name);

    constructor(private configService: ConfigService) { }

    async onModuleInit() {
        await this.initializeDrive();
    }

    private async initializeDrive() {
        const clientId = this.configService.get<string>('GOOGLE_CLIENT_ID');
        const clientSecret = this.configService.get<string>('GOOGLE_CLIENT_SECRET');
        const refreshToken = this.configService.get<string>('GOOGLE_REFRESH_TOKEN');

        if (!clientId || !clientSecret || !refreshToken) {
            this.logger.warn('Google Drive OAuth2 credentials not configured. File operations will fail.');
            return;
        }

        try {
            const oauth2Client = new google.auth.OAuth2(
                clientId,
                clientSecret,
                'https://developers.google.com/oauthplayground'
            );

            oauth2Client.setCredentials({
                refresh_token: refreshToken,
            });

            this.auth = oauth2Client;
            this.drive = google.drive({ version: 'v3', auth: oauth2Client });
            this.logger.log('Google Drive service initialized successfully with OAuth2');
        } catch (error) {
            this.logger.error('Failed to initialize Google Drive service with OAuth2', error);
        }
    }

    async createUserFolder(userId: string, userEmail: string): Promise<string> {
        const rootFolderId = this.configService.get<string>('GOOGLE_DRIVE_ROOT_FOLDER_ID');

        const folderMetadata = {
            name: `user_${userId}_${userEmail}`,
            mimeType: 'application/vnd.google-apps.folder',
            parents: rootFolderId ? [rootFolderId] : undefined,
        };

        if (!this.drive) {
            throw new Error('Google Drive service not initialized');
        }

        const folder = await this.drive.files.create({
            requestBody: folderMetadata,
            fields: 'id',
        });

        if (!folder.data.id) {
            throw new Error('Failed to create folder');
        }

        this.logger.log(`Created folder for user ${userId}: ${folder.data.id}`);
        return folder.data.id;
    }

    async uploadFile(
        file: Express.Multer.File,
        folderId: string,
        fileName: string,
    ): Promise<{ id: string; name: string; size: number; mimeType: string }> {
        if (!this.drive) {
            throw new Error('Google Drive service not initialized');
        }

        const fileMetadata = {
            name: fileName,
            parents: [folderId],
        };

        const media = {
            mimeType: file.mimetype,
            body: Readable.from(file.buffer),
        };

        const response = await this.drive.files.create({
            requestBody: fileMetadata,
            media: media,
            fields: 'id, name, size, mimeType, thumbnailLink, webViewLink',
        });

        if (!response.data.id || !response.data.name || !response.data.mimeType) {
            throw new Error('Failed to upload file');
        }

        this.logger.log(`Uploaded file: ${response.data.name} (${response.data.id})`);

        return {
            id: response.data.id,
            name: response.data.name,
            size: parseInt(response.data.size || '0') || file.size,
            mimeType: response.data.mimeType,
        };
    }

    async downloadFile(fileId: string): Promise<{ stream: Readable; mimeType: string; name: string }> {
        if (!this.drive) {
            throw new Error('Google Drive service not initialized');
        }

        const fileMetadata = await this.drive.files.get({
            fileId,
            fields: 'name, mimeType',
        });

        const response = await this.drive.files.get(
            { fileId, alt: 'media' },
            { responseType: 'stream' },
        );

        return {
            stream: response.data as Readable,
            mimeType: fileMetadata.data.mimeType || 'application/octet-stream',
            name: fileMetadata.data.name || 'unknown',
        };
    }

    async deleteFile(fileId: string): Promise<void> {
        if (!this.drive) {
            throw new Error('Google Drive service not initialized');
        }
        await this.drive.files.delete({ fileId });
        this.logger.log(`Deleted file: ${fileId}`);
    }

    async getFileInfo(fileId: string): Promise<drive_v3.Schema$File> {
        if (!this.drive) {
            throw new Error('Google Drive service not initialized');
        }
        const response = await this.drive.files.get({
            fileId,
            fields: 'id, name, size, mimeType, createdTime, thumbnailLink, webViewLink',
        });

        return response.data;
    }

    async getAccessToken(): Promise<string> {
        if (!this.auth) {
            throw new Error('Google Drive service not initialized');
        }
        const accessToken = await this.auth.getAccessToken();
        return accessToken.token || '';
    }

    async initiateResumableUpload(
        folderId: string,
        fileName: string,
        mimeType: string,
        fileSize: number,
        origin?: string,
    ): Promise<string> {
        if (!this.auth || !this.drive) {
            throw new Error('Google Drive service not initialized');
        }

        try {
            const accessToken = await this.getAccessToken();
            this.logger.log(`Initiating resumable upload for ${fileName} (${fileSize} bytes) from origin: ${origin}`);

            const url = 'https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable';
            const headers: any = {
                Authorization: `Bearer ${accessToken}`,
                'Content-Type': 'application/json; charset=UTF-8',
                'X-Upload-Content-Type': mimeType,
                'X-Upload-Content-Length': fileSize.toString(),
            };

            if (origin) {
                headers['Origin'] = origin;
            }

            const response = await axios.post(url, {
                name: fileName,
                parents: [folderId],
            }, {
                headers,
                validateStatus: (status) => status >= 200 && status < 300,
            });

            this.logger.log(`Google response status: ${response.status}`);
            this.logger.log(`Google response headers: ${JSON.stringify(response.headers)}`);

            const sessionUrl = response.headers.location;
            if (!sessionUrl) {
                this.logger.error('No Location header in Google Drive response');
                throw new Error('No session URL returned from Google Drive');
            }

            return sessionUrl;
        } catch (error) {
            if (axios.isAxiosError(error)) {
                this.logger.error(`Google API Error (${error.response?.status}): ${JSON.stringify(error.response?.data)}`);
            }
            this.logger.error(`Failed to initiate resumable upload: ${error.message}`, error.stack);
            throw error;
        }
    }

    isInitialized(): boolean {
        return !!this.drive;
    }
}
