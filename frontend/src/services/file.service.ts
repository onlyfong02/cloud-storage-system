import axios from 'axios';
import api from './api';

export interface FileMetadata {
    _id: string;
    driveFileId: string;
    ownerId: string;
    originalName: string;
    fileName: string;
    size: number;
    mimeType: string;
    createdAt: string;
    thumbnailLink?: string;
    webViewLink?: string;
}

export const fileService = {
    getFiles: async (page: number = 1, limit: number = 10): Promise<{ files: FileMetadata[]; total: number }> => {
        const response = await api.get('/files', {
            params: { page, limit },
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

    uploadFile: async (file: File, onProgress?: (progress: number) => void): Promise<FileMetadata> => {
        try {
            // Step 1: Create upload session
            const sessionResponse = await api.post('/files/upload/session', {
                fileName: file.name,
                size: file.size,
                mimeType: file.type || 'application/octet-stream',
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

    deleteFile: async (fileId: string): Promise<void> => {
        await api.delete(`/files/${fileId}`);
    },
};
