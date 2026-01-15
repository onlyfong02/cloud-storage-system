import axios from 'axios';
import api from './api';

export interface FileMetadata {
    id: string;
    driveFileId: string;
    ownerId: string;
    originalName: string;
    fileName: string;
    size: number;
    mimeType: string;
    createdAt: string;
    thumbnailLink?: string;
    webViewLink?: string;
    parentId?: string;
}

export const fileService = {
    getFiles: async (page: number = 1, limit: number = 10, parentId?: string): Promise<{ files: FileMetadata[]; total: number }> => {
        const response = await api.get('/files', {
            params: { page, limit, parentId },
        });
        return response.data;
    },

    getStats: async (): Promise<{
        total: number;
        images: number;
        imagesSize: number;
        videos: number;
        videosSize: number;
        audios: number;
        audiosSize: number;
        documents: number;
        documentsSize: number;
        others: number;
        othersSize: number;
    }> => {
        const response = await api.get('/files/stats');
        return response.data;
    },

    uploadFile: async (file: File, parentId?: string, onProgress?: (progress: number) => void): Promise<FileMetadata> => {
        try {
            // Step 1: Create upload session
            const sessionResponse = await api.post('/files/upload/session', {
                fileName: file.name,
                size: file.size,
                mimeType: file.type || 'application/octet-stream',
                parentId,
            });

            const { sessionUrl, uniqueFileName } = sessionResponse.data;

            // Step 2: Upload directly to Google Drive
            const response = await axios.put(sessionUrl, file, {
                headers: {
                    'Content-Type': file.type || 'application/octet-stream',
                },
                onUploadProgress: (progressEvent) => {
                    if (progressEvent.total && onProgress) {
                        const progress = Math.round((progressEvent.loaded * 100) / progressEvent.total);
                        onProgress(progress);
                    }
                },
            });

            console.log('Google upload response status:', response.status);
            console.log('Google upload response data:', response.data);

            let driveFile = response.data;

            // If Google returns a string, try to parse it
            if (typeof driveFile === 'string' && driveFile.trim().startsWith('{')) {
                try {
                    driveFile = JSON.parse(driveFile);
                } catch (e) {
                    console.error('Failed to parse Google response as JSON:', e);
                }
            }

            const driveFileId = driveFile?.id;

            if (!driveFileId) {
                console.error('No ID in Google response. Full response:', response);
                throw new Error('Google Drive không trả về ID file sau khi tải lên. Vui lòng kiểm tra lại quyền truy cập.');
            }

            // Step 3: Complete upload in backend
            const completeResponse = await api.post('/files/upload/complete', {
                driveFileId: driveFileId,
                originalName: file.name,
                fileName: uniqueFileName,
                size: file.size,
                mimeType: file.type || 'application/octet-stream',
                parentId,
            });

            return completeResponse.data;
        } catch (error: any) {
            console.error('Upload flow error:', error);
            if (axios.isAxiosError(error)) {
                const message = error.response?.data?.message || error.message;
                throw new Error(`Lỗi tải lên: ${message}`);
            }
            throw error;
        }
    },

    downloadFile: async (fileId: string, fileName: string): Promise<void> => {
        const response = await api.get(`/files/${fileId}/download`, {
            responseType: 'blob',
        });

        const url = window.URL.createObjectURL(new Blob([response.data]));
        const link = document.createElement('a');
        link.href = url;
        link.setAttribute('download', fileName);
        document.body.appendChild(link);
        link.click();
        link.remove();
        window.URL.revokeObjectURL(url);
    },

    downloadFileChunked: async (fileId: string, fileName: string, totalSize: number, onProgress?: (progress: number) => void): Promise<void> => {
        const CHUNK_SIZE = 2 * 1024 * 1024; // 2MB chunks
        const chunks: Blob[] = [];
        let downloadedBytes = 0;

        for (let start = 0; start < totalSize; start += CHUNK_SIZE) {
            const end = Math.min(start + CHUNK_SIZE - 1, totalSize - 1);
            const range = `bytes=${start}-${end}`;

            const response = await api.get(`/files/${fileId}/download`, {
                headers: {
                    Range: range,
                },
                responseType: 'blob',
            });

            chunks.push(response.data);
            downloadedBytes += (end - start) + 1;

            if (onProgress) {
                onProgress(Math.round((downloadedBytes / totalSize) * 100));
            }
        }

        const finalBlob = new Blob(chunks);
        const url = window.URL.createObjectURL(finalBlob);
        const link = document.createElement('a');
        link.href = url;
        link.setAttribute('download', fileName);
        document.body.appendChild(link);
        link.click();
        link.remove();
        window.URL.revokeObjectURL(url);
    },

    deleteFile: async (fileId: string): Promise<void> => {
        await api.delete(`/files/${fileId}`);
    },

    createFolder: async (name: string, parentId?: string): Promise<FileMetadata> => {
        const response = await api.post('/files/folder', { name, parentId });
        return response.data;
    },

    moveFile: async (fileId: string, targetFolderId?: string): Promise<FileMetadata> => {
        const response = await api.post(`/files/${fileId}/move`, { targetFolderId });
        return response.data;
    },
    shareRootFolder: async (email: string): Promise<void> => {
        await api.post('/files/share', { email });
    },
    getRootFolderPermissions: async (): Promise<any[]> => {
        const response = await api.get('/files/share/permissions');
        return response.data;
    },
    removeRootFolderPermission: async (permissionId: string): Promise<void> => {
        await api.delete(`/files/share/permissions/${permissionId}`);
    },

    /**
     * Get a signed URL for secure file preview/download
     * The signed URL is valid for 5 minutes and doesn't expose the JWT token
     */
    getSignedUrl: async (fileId: string, type: 'view' | 'download' = 'view'): Promise<{ url: string; expiresAt: string }> => {
        const response = await api.get(`/files/${fileId}/signed-url`, {
            params: { type },
        });
        return response.data;
    },
};
