export interface UploadItem {
    id: string;
    file: File;
    fileName: string;
    status: 'pending' | 'uploading' | 'completed' | 'error' | 'paused';
    progress: number;
    error?: string;
    sessionUrl?: string;
    uniqueFileName?: string;
    parentId?: string;
}

import { create } from 'zustand';
import { persist, type PersistStorage, type StorageValue } from 'zustand/middleware';
import { get, set, del } from 'idb-keyval';

interface UploadState {
    queue: UploadItem[];
    concurrency: number;
    isHydrated: boolean;
    setHydrated: () => void;
    addFiles: (files: File[], parentId?: string) => void;
    updateProgress: (id: string, progress: number) => void;
    updateStatus: (id: string, status: UploadItem['status'], error?: string) => void;
    updateSession: (id: string, sessionUrl: string, uniqueFileName: string) => void;
    removeFile: (id: string) => void;
    clearCompleted: () => void;
    resumeFile: (id: string, file: File) => void;
    retryFile: (id: string) => void;
    clearQueue: () => void;
}

// Custom storage for IndexedDB that supports File objects by bypassing JSON.stringify
const idbPersistStorage: PersistStorage<any> = {
    getItem: async (name: string): Promise<StorageValue<any> | null> => {
        const val = await get(name);
        return val || null;
    },
    setItem: async (name: string, value: StorageValue<any>): Promise<void> => {
        await set(name, value);
    },
    removeItem: async (name: string): Promise<void> => {
        await del(name);
    },
};

export const useUploadStore = create<UploadState>()(
    persist(
        (set) => ({
            queue: [],
            concurrency: 3,
            isHydrated: false,
            setHydrated: () => set({ isHydrated: true }),
            addFiles: (files: File[], parentId?: string) => set((state: UploadState) => ({
                queue: [
                    ...state.queue,
                    ...files.map((file) => ({
                        id: Math.random().toString(36).substring(7),
                        file: file,
                        fileName: file.name,
                        status: 'pending' as const,
                        progress: 0,
                        parentId,
                    })),
                ],
            })),
            updateProgress: (id: string, progress: number) => set((state: UploadState) => ({
                queue: state.queue.map((item) =>
                    item.id === id ? { ...item, progress } : item
                ),
            })),
            updateStatus: (id: string, status: UploadItem['status'], error?: string) => set((state: UploadState) => ({
                queue: state.queue.map((item) =>
                    item.id === id ? { ...item, status, error } : item
                ),
            })),
            updateSession: (id: string, sessionUrl: string, uniqueFileName: string) => set((state: UploadState) => ({
                queue: state.queue.map((item) =>
                    item.id === id ? { ...item, sessionUrl, uniqueFileName } : item
                ),
            })),
            removeFile: (id: string) => set((state: UploadState) => ({
                queue: state.queue.filter((item) => item.id !== id),
            })),
            clearCompleted: () => set((state: UploadState) => ({
                queue: state.queue.filter((item) => item.status !== 'completed'),
            })),
            resumeFile: (id: string, file: File) => set((state: UploadState) => ({
                queue: state.queue.map((item) =>
                    item.id === id ? { ...item, file, status: 'pending' as const, error: undefined } : item
                ),
            })),
            retryFile: (id: string) => set((state: UploadState) => ({
                queue: state.queue.map((item) =>
                    item.id === id ? { ...item, status: 'pending' as const, error: undefined } : item
                ),
            })),
            clearQueue: () => set({ queue: [] }),
        }),
        {
            name: 'upload-storage',
            storage: idbPersistStorage,
            onRehydrateStorage: (state) => {
                return () => state?.setHydrated();
            },
            partialize: (state) => ({
                queue: state.queue,
                concurrency: state.concurrency,
            }),
        }
    )
);
