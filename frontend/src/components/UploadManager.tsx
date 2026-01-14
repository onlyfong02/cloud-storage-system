import { useEffect, useRef } from 'react';
import { useUploadStore, type UploadItem } from '@/store/useUploadStore';
import axios from 'axios';
import api from '@/services/api';
import { useAuth } from '@/contexts/AuthContext';

export function UploadManager() {
    const { user } = useAuth();
    const { queue, updateProgress, updateStatus, updateSession, concurrency, isHydrated, clearQueue } = useUploadStore();
    const processingRef = useRef<Set<string>>(new Set());
    const abortControllersRef = useRef<Map<string, AbortController>>(new Map());
    const initialReviveDone = useRef(false);

    // Clear queue on logout
    useEffect(() => {
        if (!user && isHydrated && queue.length > 0) {
            console.log('[UploadManager] User logged out, clearing upload queue and aborting active uploads');
            // Abort all active uploads
            abortControllersRef.current.forEach((controller) => controller.abort());
            abortControllersRef.current.clear();
            processingRef.current.clear();
            clearQueue();
        }
    }, [user, isHydrated, queue.length, clearQueue]);

    // Reset stuck uploading/paused items once after hydration
    useEffect(() => {
        if (isHydrated && !initialReviveDone.current) {
            queue.forEach(item => {
                if (item.status === 'uploading' || item.status === 'paused') {
                    updateStatus(item.id, item.file ? 'pending' : 'paused');
                }
            });
            initialReviveDone.current = true;
        }
    }, [isHydrated, queue, updateStatus]);

    useEffect(() => {
        const processQueue = async () => {
            const pending = queue.filter(item => item.status === 'pending');
            const activeProcessing = processingRef.current.size;

            console.log(`[UploadManager] Status: ${pending.length} pending, ${activeProcessing} active (concurrency: ${concurrency})`);

            if (activeProcessing < concurrency && pending.length > 0) {
                const availableSlots = concurrency - activeProcessing;
                const nextItems = pending.filter(item => !processingRef.current.has(item.id));

                if (nextItems.length > 0) {
                    console.log(`[UploadManager] Starting ${Math.min(availableSlots, nextItems.length)} new uploads...`);
                    nextItems.slice(0, availableSlots).forEach(item => {
                        processingRef.current.add(item.id);
                        startUpload(item);
                    });
                }
            }
        };

        processQueue();
    }, [queue, concurrency]);

    const CHUNK_SIZE = 2 * 1024 * 1024; // 2MB (must be multiple of 256KB)

    const startUpload = async (item: UploadItem, retryCount = 0) => {
        if (!item.file) {
            updateStatus(item.id, 'paused');
            return;
        }
        updateStatus(item.id, 'uploading');

        const controller = new AbortController();
        abortControllersRef.current.set(item.id, controller);

        try {
            let sessionUrl = item.sessionUrl;
            let uniqueFileName = item.uniqueFileName;
            let startByte = 0;

            // 1. Check if we have an existing session and where we left off
            if (sessionUrl) {
                try {
                    const statusResponse = await axios.put(sessionUrl, null, {
                        headers: {
                            'Content-Range': `bytes */${item.file.size}`,
                        },
                        validateStatus: (status) => status === 308 || status === 200 || status === 201,
                        signal: controller.signal,
                    });

                    if (statusResponse.status === 308) {
                        const range = statusResponse.headers.range;
                        if (range) {
                            startByte = parseInt(range.split('-')[1]) + 1;
                        }
                    } else if (statusResponse.status === 200 || statusResponse.status === 201) {
                        updateProgress(item.id, 100);
                        updateStatus(item.id, 'completed');
                        return;
                    }
                } catch (e) {
                    sessionUrl = undefined;
                }
            }

            // 2. If no session, create one
            if (!sessionUrl) {
                const sessionResponse = await api.post('/files/upload/session', {
                    fileName: item.file.name,
                    size: item.file.size,
                    mimeType: item.file.type || 'application/octet-stream',
                    parentId: item.parentId,
                }, { signal: controller.signal });
                sessionUrl = sessionResponse.data.sessionUrl;
                uniqueFileName = sessionResponse.data.uniqueFileName;
                updateSession(item.id, sessionUrl!, uniqueFileName!);
            }

            // 3. Upload in chunks
            while (startByte < item.file.size) {
                const endByte = Math.min(startByte + CHUNK_SIZE, item.file.size);
                const chunk = item.file.slice(startByte, endByte);

                try {
                    const uploadResponse = await axios.put(sessionUrl!, chunk, {
                        headers: {
                            'Content-Type': item.file.type || 'application/octet-stream',
                            'Content-Range': `bytes ${startByte}-${endByte - 1}/${item.file.size}`,
                        },
                        timeout: 60000, // 60 seconds timeout per chunk
                        signal: controller.signal,
                        onUploadProgress: (progressEvent) => {
                            const loaded = startByte + (progressEvent.loaded || 0);
                            const progress = Math.min(Math.round((loaded * 100) / item.file.size), 99);
                            updateProgress(item.id, progress);
                        },
                    });

                    if (uploadResponse.status === 200 || uploadResponse.status === 201) {
                        // Upload complete
                        const driveFileId = uploadResponse.data?.id;
                        if (!driveFileId) throw new Error('Missing Drive File ID');

                        await api.post('/files/upload/complete', {
                            driveFileId,
                            originalName: item.file.name,
                            fileName: uniqueFileName,
                            size: item.file.size,
                            mimeType: item.file.type || 'application/octet-stream',
                            parentId: item.parentId,
                        }, { signal: controller.signal });

                        updateProgress(item.id, 100);
                        updateStatus(item.id, 'completed');
                        return;
                    }
                } catch (error: any) {
                    // Google returns 308 if the upload is not complete
                    if (error.response?.status === 308) {
                        const range = error.response.headers.range;
                        if (range) {
                            startByte = parseInt(range.split('-')[1]) + 1;
                            continue; // Move to next chunk
                        }
                    }
                    throw error; // Let the outer catch handle real errors
                }

                // If we reach here without return or throw, something is wrong
                // Normal flow should continue via 'continue' or 'return'
                startByte = endByte;
            }
        } catch (error: any) {
            if (axios.isCancel(error)) {
                console.log(`[UploadManager] Upload aborted for ${item.id}`);
                return;
            }
            console.error('Upload manager error:', error);

            // Auto-retry logic for network errors (status 0 or 5xx)
            const isNetworkError = !error.response || (error.response.status >= 500);
            if (isNetworkError && retryCount < 3) {
                const delay = Math.pow(2, retryCount) * 2000;
                updateStatus(item.id, 'uploading', `Retrying in ${delay / 1000}s...`);
                setTimeout(() => {
                    startUpload(item, retryCount + 1);
                }, delay);
                return;
            }

            updateStatus(item.id, 'error', error.message || 'Upload failed');
        } finally {
            abortControllersRef.current.delete(item.id);
            if (retryCount === 0 || !queue.find(i => i.id === item.id && i.status === 'uploading')) {
                processingRef.current.delete(item.id);
            }
        }
    };

    return null;
}
