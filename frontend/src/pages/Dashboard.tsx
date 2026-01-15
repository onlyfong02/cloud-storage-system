import { useState, useEffect, useCallback, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/contexts/AuthContext';
import { fileService, authService, feedbackService, type FileMetadata, type Feedback } from '@/services';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { formatBytes, formatDate, getFileIcon } from '@/lib/utils';
import {
    Cloud,
    Upload,
    Download,
    Trash2,
    HardDrive,
    FileIcon,
    Loader2,
    RefreshCw,
    LayoutGrid,
    List,
    Eye,
    X,
    FolderPlus,
    Folder,
    MoveVertical,
    ChevronRight,
    FileText,
    ExternalLink,
} from 'lucide-react';
import { toast } from 'sonner';
import { UserMenu } from '@/components/UserMenu';
import { useUploadStore } from '@/store/useUploadStore';
import { UploadQueue } from '@/components/UploadQueue';
import { FeedbackUnifiedModal } from '@/components/FeedbackUnifiedModal';

export default function Dashboard() {
    const { t } = useTranslation();
    const { user, logout } = useAuth();
    const [files, setFiles] = useState<FileMetadata[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [currentPage, setCurrentPage] = useState(1);
    const [totalFiles, setTotalFiles] = useState(0);
    const [storageInfo, setStorageInfo] = useState<{
        maxStorage: number;
        usedStorage: number;
        usagePercentage: number;
    } | null>(null);
    const { addFiles, queue } = useUploadStore();
    const [deletingId, setDeletingId] = useState<string | null>(null);
    const [downloadingId, setDownloadingId] = useState<string | null>(null);
    const [viewMode, setViewMode] = useState<'list' | 'grid'>('grid');
    const [pageSize, setPageSize] = useState(12);
    const [isDragging, setIsDragging] = useState(false);
    const [previewFile, setPreviewFile] = useState<FileMetadata | null>(null);
    const [previewUrl, setPreviewUrl] = useState<string | null>(null);
    const [fileStats, setFileStats] = useState<{
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
    } | null>(null);
    const [isCreateFolderModalOpen, setIsCreateFolderModalOpen] = useState(false);
    const [newFolderName, setNewFolderName] = useState('');
    const [isCreatingFolder, setIsCreatingFolder] = useState(false);
    const [currentFolder, setCurrentFolder] = useState<FileMetadata | null>(null);
    const [folderPath, setFolderPath] = useState<FileMetadata[]>([]);
    const [isMoveModalOpen, setIsMoveModalOpen] = useState(false);
    const [movingFile, setMovingFile] = useState<FileMetadata | null>(null);
    const [moveTargetFolders, setMoveTargetFolders] = useState<FileMetadata[]>([]);
    const [moveCurrentFolder, setMoveCurrentFolder] = useState<FileMetadata | null>(null);
    const [moveFolderPath, setMoveFolderPath] = useState<FileMetadata[]>([]);
    const [isMoving, setIsMoving] = useState(false);
    const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
    const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
    const [fileToDelete, setFileToDelete] = useState<FileMetadata | null>(null);
    const [isFeedbackOpen, setIsFeedbackOpen] = useState(false);
    const [feedbackRefreshTrigger, setFeedbackRefreshTrigger] = useState(0);
    const [hasUnreadFeedback, setHasUnreadFeedback] = useState(false);

    useEffect(() => {
        checkFeedbackStatus();
    }, [feedbackRefreshTrigger]);

    const checkFeedbackStatus = async () => {
        try {
            const data = await feedbackService.getMyFeedback(1, 100); // Check recent feedbacks
            const lastChecked = localStorage.getItem('lastCheckedFeedback');
            const hasNewReplies = data.feedbacks.some((f: Feedback) =>
                f.isReplied && (!lastChecked || new Date(f.updatedAt) > new Date(lastChecked))
            );
            setHasUnreadFeedback(hasNewReplies);
        } catch (error) {
            console.error('Failed to check feedback:', error);
        }
    };

    const handleOpenFeedback = () => {
        setIsFeedbackOpen(true);
        // Mark as read (update timestamp)
        localStorage.setItem('lastCheckedFeedback', new Date().toISOString());
        setHasUnreadFeedback(false);
    };

    const getStorageStatus = (percentage: number) => {
        if (percentage < 50) return { label: t('dashboard.storage.status.good'), color: 'bg-green-500', textColor: 'text-green-600' };
        if (percentage < 80) return { label: t('dashboard.storage.status.moderate'), color: 'bg-yellow-500', textColor: 'text-yellow-600' };
        return { label: t('dashboard.storage.status.full'), color: 'bg-red-500', textColor: 'text-red-600' };
    };

    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(true);
    };

    const handleDragLeave = (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(false);
    };

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(false);
        const droppedFiles = Array.from(e.dataTransfer.files);
        if (droppedFiles.length > 0) {
            addFiles(droppedFiles, currentFolder?.id);
            toast.success(t('dashboard.files.uploads.added', { count: droppedFiles.length }));
        }
    };
    const limit = pageSize;

    const loadData = useCallback(async () => {
        setIsLoading(true);
        try {
            const [paginatedFiles, storage, stats] = await Promise.all([
                fileService.getFiles(currentPage, limit, currentFolder?.id),
                authService.getStorageInfo(),
                fileService.getStats(),
            ]);
            setFiles(paginatedFiles.files);
            setTotalFiles(paginatedFiles.total);
            setStorageInfo(storage);
            setFileStats(stats);
        } catch (error) {
            console.error('Failed to load data:', error);
        } finally {
            setIsLoading(false);
        }
    }, [currentPage, limit, currentFolder]);

    const handleViewModeChange = (mode: 'list' | 'grid') => {
        setViewMode(mode);
        setPageSize(mode === 'grid' ? 12 : 10);
        setCurrentPage(1);
    };

    // Refresh when uploads complete
    const lastCompletedCount = useRef(queue.filter(item => item.status === 'completed').length);
    useEffect(() => {
        const completedCount = queue.filter(item => item.status === 'completed').length;
        if (completedCount > lastCompletedCount.current) {
            loadData();
        }
        lastCompletedCount.current = completedCount;
    }, [queue, loadData]);

    useEffect(() => {
        loadData();
    }, [loadData]);

    useEffect(() => {
        if (previewFile || isUploadModalOpen || isCreateFolderModalOpen || isMoveModalOpen || isDeleteModalOpen) {
            document.body.style.overflow = 'hidden';
        } else {
            document.body.style.overflow = 'unset';
        }
        return () => {
            document.body.style.overflow = 'unset';
        };
    }, [previewFile, isUploadModalOpen, isCreateFolderModalOpen, isMoveModalOpen, isDeleteModalOpen]);

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const selectedFiles = Array.from(e.target.files || []);
        if (selectedFiles.length === 0) return;

        addFiles(selectedFiles, currentFolder?.id);
        toast.success(t('dashboard.files.uploads.added', { count: selectedFiles.length }));
        e.target.value = '';
    };

    const handleFolderClick = (folder: FileMetadata) => {
        setCurrentFolder(folder);
        setFolderPath(prev => [...prev, folder]);
        setCurrentPage(1);
    };

    const navigateToFolder = (folder: FileMetadata | null, index: number = -1) => {
        if (folder === null) {
            setCurrentFolder(null);
            setFolderPath([]);
        } else {
            setCurrentFolder(folder);
            setFolderPath(prev => prev.slice(0, index + 1));
        }
        setCurrentPage(1);
    };

    const handleDownload = async (file: FileMetadata) => {
        if (file.mimeType === 'application/vnd.google-apps.folder') {
            return;
        }

        setDownloadingId(file.id);
        try {
            const baseUrl = import.meta.env.VITE_API_URL || '';
            const token = localStorage.getItem('accessToken');
            const downloadUrl = `${baseUrl}/files/${file.id}/download?token=${token}`;

            // Create a temporary link and click it to trigger native browser download
            const link = document.createElement('a');
            link.href = downloadUrl;
            link.setAttribute('download', file.originalName);
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);

            toast.info(t('dashboard.files.downloadSuccess'));
        } finally {
            // Small delay to show the loading state
            setTimeout(() => setDownloadingId(null), 1000);
        }
    };

    const handlePreview = async (file: FileMetadata) => {
        if (file.mimeType === 'application/vnd.google-apps.folder') {
            return;
        }

        if (file.webViewLink) {
            try {
                // Get signed URL for secure preview
                const { url } = await fileService.getSignedUrl(file.id, 'view');
                // Backend returns URL like /api/files/:id/signed-view, so use base URL without /api
                const baseUrl = (import.meta.env.VITE_API_URL || '').replace(/\/api$/, '');
                const fullUrl = `${baseUrl}${url}`;
                setPreviewUrl(fullUrl);
                setPreviewFile(file);
            } catch (error) {
                console.error('Failed to get signed URL:', error);
                toast.error(t('dashboard.files.previewUnavailable'));
            }
        } else {
            toast.error(t('dashboard.files.previewUnavailable'));
        }
    };

    const handleCreateFolder = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newFolderName.trim()) return;

        setIsCreatingFolder(true);
        try {
            await fileService.createFolder(newFolderName.trim(), currentFolder?.id);
            toast.success(t('dashboard.folders.create.success'));
            setIsCreateFolderModalOpen(false);
            setNewFolderName('');
            loadData();
        } catch (error) {
            console.error('Failed to create folder:', error);
            toast.error(t('dashboard.folders.create.failed'));
        } finally {
            setIsCreatingFolder(false);
        }
    };

    const handleDelete = (file: FileMetadata) => {
        setFileToDelete(file);
        setIsDeleteModalOpen(true);
    };

    const handleConfirmDelete = async () => {
        if (!fileToDelete) return;

        const file = fileToDelete;
        setIsDeleteModalOpen(false);
        setFileToDelete(null);

        setDeletingId(file.id);
        const toastId = toast.loading(t('dashboard.files.deleting', { name: file.originalName }));
        try {
            await fileService.deleteFile(file.id);
            toast.success(t('dashboard.files.deleteSuccess', { name: file.originalName }), { id: toastId });
            await loadData();
        } catch (error) {
            console.error('Delete failed:', error);
            toast.error(t('dashboard.files.deleteFailed'), { id: toastId });
        } finally {
            setDeletingId(null);
        }
    };

    const handleOpenMove = async (file: FileMetadata) => {
        setMovingFile(file);
        setIsMoveModalOpen(true);
        setMoveCurrentFolder(null);
        setMoveFolderPath([]);
        await loadMoveFolders(null);
    };

    const loadMoveFolders = async (parentId: string | null) => {
        try {
            const result = await fileService.getFiles(1, 100, parentId || undefined);
            // Only show folders, and exclude the folder being moved (if it's a folder)
            const folders = result.files.filter(f =>
                f.mimeType === 'application/vnd.google-apps.folder' &&
                f.id !== movingFile?.id
            );
            setMoveTargetFolders(folders);
        } catch (error) {
            console.error('Failed to load move targets:', error);
        }
    };

    const handleMoveConfirm = async () => {
        if (!movingFile) return;

        // Prevent moving to current parent
        if (movingFile.parentId === (moveCurrentFolder?.id || null)) {
            setIsMoveModalOpen(false);
            return;
        }

        setIsMoving(true);
        const toastId = toast.loading(t('dashboard.folders.move.moving'));
        try {
            await fileService.moveFile(movingFile.id, moveCurrentFolder?.id);
            toast.success(t('dashboard.folders.move.success'), { id: toastId });
            setIsMoveModalOpen(false);
            await loadData();
        } catch (error) {
            console.error('Move failed:', error);
            toast.error(t('dashboard.folders.move.failed'), { id: toastId });
        } finally {
            setIsMoving(false);
        }
    };

    const navigateMoveFolder = async (folder: FileMetadata | null, index: number = -1) => {
        if (folder === null) {
            setMoveCurrentFolder(null);
            setMoveFolderPath([]);
            await loadMoveFolders(null);
        } else {
            setMoveCurrentFolder(folder);
            setMoveFolderPath(prev => prev.slice(0, index + 1));
            await loadMoveFolders(folder.id);
        }
    };

    const handleMoveFolderClick = async (folder: FileMetadata) => {
        setMoveCurrentFolder(folder);
        setMoveFolderPath(prev => [...prev, folder]);
        await loadMoveFolders(folder.id);
    };

    const totalPages = Math.ceil(totalFiles / limit);

    return (
        <div className="min-h-screen bg-[#f0f0f0] font-bold">
            {/* Header */}
            <header className="border-b-4 border-black bg-white sticky top-0 z-10">
                <div className="max-w-7xl mx-auto px-4 py-4 flex flex-col sm:flex-row items-center sm:items-center justify-between gap-4">
                    <div className="flex items-center gap-4 w-full sm:w-auto">
                        <div className="w-10 h-10 sm:w-12 sm:h-12 bg-[hsl(var(--primary))] border-2 border-black flex items-center justify-center shadow-nb-sm shrink-0 overflow-hidden">
                            <img src="/logo.png" alt="Logo" className="w-full h-full object-cover grayscale brightness-200 contrast-200" />
                        </div>
                        <div className="min-w-0">
                            <h1 className="font-black text-lg sm:text-2xl uppercase tracking-tighter truncate">The Backdrive</h1>
                            <p className="text-[10px] sm:text-sm text-black font-medium truncate opacity-60">{user?.email}</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
                        <UserMenu
                            user={user}
                            onLogout={logout}
                            onOpenFeedback={handleOpenFeedback}
                            hasUnreadFeedback={hasUnreadFeedback}
                        />
                    </div>
                </div>
            </header>

            <main className="max-w-7xl mx-auto px-4 py-8">
                {/* Storage Info */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-8">
                    <Card className="col-span-1 md:col-span-2 bg-white">
                        <CardHeader className="flex flex-row items-center justify-between pb-2">
                            <CardTitle className="text-xl font-black uppercase flex items-center gap-2">
                                <HardDrive className="w-5 h-5" />
                                {t('dashboard.storage.title')}
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            {storageInfo && (
                                <div className="space-y-6">
                                    <div>
                                        <div className="flex items-center justify-between mb-2">
                                            <div className="flex items-center gap-2">
                                                <div className={`w-3 h-3 rounded-full border-2 border-black ${getStorageStatus(storageInfo.usagePercentage).color}`} />
                                                <span className="text-[10px] font-black uppercase tracking-widest">{getStorageStatus(storageInfo.usagePercentage).label}</span>
                                            </div>
                                            <span className="text-[10px] font-black opacity-40 uppercase tracking-widest">{t('dashboard.storage.title')}</span>
                                        </div>
                                        <div className="h-4 bg-gray-100 border-2 border-black overflow-hidden shadow-nb-sm">
                                            <div
                                                className="h-full bg-[hsl(var(--secondary))] border-r-2 border-black transition-all duration-500"
                                                style={{ width: `${Math.min(storageInfo.usagePercentage, 100)}%` }}
                                            />
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-2 gap-x-6 gap-y-4">
                                        <div className="space-y-1">
                                            <div className="flex justify-between text-[8px] font-black uppercase opacity-60">
                                                <span>{t('dashboard.stats.images')}</span>
                                                <span>{formatBytes(fileStats?.imagesSize || 0)}</span>
                                            </div>
                                            <div className="h-1 bg-gray-100 border-black border overflow-hidden">
                                                <div className="h-full bg-blue-400" style={{ width: `${fileStats && storageInfo ? (fileStats.imagesSize / storageInfo.maxStorage) * 100 : 0}%` }} />
                                            </div>
                                        </div>
                                        <div className="space-y-1">
                                            <div className="flex justify-between text-[8px] font-black uppercase opacity-60">
                                                <span>{t('dashboard.stats.videos')}</span>
                                                <span>{formatBytes(fileStats?.videosSize || 0)}</span>
                                            </div>
                                            <div className="h-1 bg-gray-100 border-black border overflow-hidden">
                                                <div className="h-full bg-purple-400" style={{ width: `${fileStats && storageInfo ? (fileStats.videosSize / storageInfo.maxStorage) * 100 : 0}%` }} />
                                            </div>
                                        </div>
                                        <div className="space-y-1">
                                            <div className="flex justify-between text-[8px] font-black uppercase opacity-60">
                                                <span>{t('dashboard.stats.audios')}</span>
                                                <span>{formatBytes(fileStats?.audiosSize || 0)}</span>
                                            </div>
                                            <div className="h-1 bg-gray-100 border-black border overflow-hidden">
                                                <div className="h-full bg-yellow-400" style={{ width: `${fileStats && storageInfo ? (fileStats.audiosSize / storageInfo.maxStorage) * 100 : 0}%` }} />
                                            </div>
                                        </div>
                                        <div className="space-y-1">
                                            <div className="flex justify-between text-[8px] font-black uppercase opacity-60">
                                                <span>{t('dashboard.stats.others')}</span>
                                                <span>{formatBytes((fileStats?.othersSize || 0) + (fileStats?.documentsSize || 0))}</span>
                                            </div>
                                            <div className="h-1 bg-gray-100 border-black border overflow-hidden">
                                                <div className="h-full bg-gray-400" style={{ width: `${fileStats && storageInfo ? ((fileStats.othersSize + fileStats.documentsSize) / storageInfo.maxStorage) * 100 : 0}%` }} />
                                            </div>
                                        </div>
                                    </div>

                                    <div className="flex justify-between text-[10px] font-black uppercase">
                                        <div className="flex flex-col">
                                            <span className="opacity-40">{t('dashboard.storage.used_short')}</span>
                                            <span className="text-sm">{formatBytes(Math.min(storageInfo.usedStorage, storageInfo.maxStorage))}</span>
                                        </div>
                                        <div className="flex flex-col items-end">
                                            <span className="opacity-40">{t('dashboard.storage.total_short')}</span>
                                            <span className="text-sm">{formatBytes(storageInfo.maxStorage)}</span>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </CardContent>
                    </Card>

                    <Card className="bg-[hsl(var(--primary))]">
                        <CardHeader className="pb-2">
                            <CardTitle className="text-xl font-black uppercase flex items-center gap-2">
                                <FileIcon className="w-5 h-5" />
                                {t('dashboard.stats.totalFiles')}
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="flex items-baseline gap-2 mb-4">
                                <span className="text-5xl font-black tracking-tighter">{fileStats?.total || 0}</span>
                                <span className="text-sm font-bold uppercase opacity-60">Files</span>
                            </div>
                            {fileStats && (
                                <div className="grid grid-cols-2 gap-2 text-[10px] font-black uppercase">
                                    <div className="bg-white/50 border-2 border-black p-1.5 flex justify-between shadow-nb-sm">
                                        <span>{t('dashboard.stats.images')}</span>
                                        <span>{fileStats.images}</span>
                                    </div>
                                    <div className="bg-white/50 border-2 border-black p-1.5 flex justify-between shadow-nb-sm">
                                        <span>{t('dashboard.stats.videos')}</span>
                                        <span>{fileStats.videos}</span>
                                    </div>
                                    <div className="bg-white/50 border-2 border-black p-1.5 flex justify-between shadow-nb-sm">
                                        <span>{t('dashboard.stats.audios')}</span>
                                        <span>{fileStats.audios}</span>
                                    </div>
                                    <div className="bg-white/50 border-2 border-black p-1.5 flex justify-between shadow-nb-sm">
                                        <span>{t('dashboard.stats.others')}</span>
                                        <span>{fileStats.documents + fileStats.others}</span>
                                    </div>
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </div>

                {/* Files List */}
                <Card className="bg-white flex flex-col max-h-[700px] overflow-hidden shadow-nb sticky top-[96px]">
                    <div className="px-4 py-2 bg-gray-50 border-b-2 border-black flex items-center flex-wrap gap-2 w-full min-w-0 flex-shrink-0">
                        <button
                            onClick={() => navigateToFolder(null)}
                            className={`text-[10px] uppercase font-black tracking-widest px-2 py-1 border-2 border-black shadow-nb-sm transition-all active:translate-x-[2px] active:translate-y-[2px] active:shadow-none flex-shrink-0 ${!currentFolder ? 'bg-[hsl(var(--primary))]' : 'bg-white hover:bg-gray-100'}`}
                        >
                            ROOT
                        </button>
                        {folderPath.map((folder, index) => (
                            <div key={folder.id} className="flex items-center gap-2 flex-shrink-0">
                                <span className="text-black font-black">/</span>
                                <button
                                    onClick={() => navigateToFolder(folder, index)}
                                    className={`text-[10px] uppercase font-black tracking-widest px-2 py-1 border-2 border-black shadow-nb-sm transition-all active:translate-x-[2px] active:translate-y-[2px] active:shadow-none truncate max-w-[80px] sx:max-w-[120px] sm:max-w-[200px] ${index === folderPath.length - 1 ? 'bg-[hsl(var(--primary))]' : 'bg-white hover:bg-gray-100'}`}
                                    title={folder.originalName}
                                >
                                    {folder.originalName}
                                </button>
                            </div>
                        ))}
                    </div>
                    <CardHeader className="border-b-2 border-black flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 sticky top-0 z-20 bg-white p-4 w-full min-w-0 flex-shrink-0">
                        <CardTitle className="text-xl sm:text-2xl font-black truncate w-full sm:flex-1 min-w-0" title={currentFolder ? currentFolder.originalName : t('dashboard.files.title')}>
                            {currentFolder ? currentFolder.originalName : t('dashboard.files.title')}
                        </CardTitle>
                        <div className="flex items-center flex-wrap gap-2 w-full sm:w-auto justify-end sm:justify-end py-1">
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={loadData}
                                disabled={isLoading}
                                className="bg-white hover:bg-black/5 h-8 text-[10px] sm:h-9 sm:text-sm flex-none sm:flex-none border-2 border-black shadow-nb-sm font-black uppercase whitespace-nowrap"
                            >
                                <RefreshCw className={`w-3 h-3 sm:w-4 sm:h-4 mr-0 sm:mr-2 ${isLoading ? 'animate-spin' : ''}`} />
                                <span className="hidden sm:inline">{t('dashboard.actions.refresh')}</span>
                            </Button>
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setIsUploadModalOpen(true)}
                                className="bg-[hsl(var(--primary))] hover:bg-[hsl(var(--primary)/0.8)] h-8 text-[10px] sm:h-9 sm:text-sm flex-none sm:flex-none border-2 border-black shadow-nb-sm font-black uppercase text-black"
                            >
                                <Upload className="w-3 h-3 sm:w-4 sm:h-4 mr-0 sm:mr-2" />
                                <span className="hidden sm:inline">{t('dashboard.actions.upload')}</span>
                            </Button>
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setIsCreateFolderModalOpen(true)}
                                className="bg-[hsl(var(--secondary))] hover:bg-[hsl(var(--secondary)/0.8)] h-8 text-[10px] sm:h-9 sm:text-sm flex-none sm:flex-none border-2 border-black shadow-nb-sm font-black uppercase text-black"
                            >
                                <FolderPlus className="w-3 h-3 sm:w-4 sm:h-4 mr-0 sm:mr-2" />
                                <span className="hidden md:inline">{t('dashboard.actions.newFolder')}</span>
                                <span className="hidden sm:inline md:hidden">NEW</span>
                            </Button>
                            <div className="hidden sm:block w-[2px] h-6 bg-black/20 mx-1" />
                            <div className="flex items-center gap-2">
                                <Button
                                    variant="outline"
                                    size="icon"
                                    onClick={() => handleViewModeChange('grid')}
                                    className={`w-8 h-8 sm:w-9 sm:h-9 ${viewMode === 'grid' ? 'bg-[hsl(var(--primary))]' : 'bg-white'}`}
                                >
                                    <LayoutGrid className="w-4 h-4 sm:w-5 sm:h-5" />
                                </Button>
                                <Button
                                    variant="outline"
                                    size="icon"
                                    onClick={() => handleViewModeChange('list')}
                                    className={`w-8 h-8 sm:w-9 sm:h-9 ${viewMode === 'list' ? 'bg-[hsl(var(--primary))]' : 'bg-white'}`}
                                >
                                    <List className="w-4 h-4 sm:w-5 sm:h-5" />
                                </Button>
                            </div>
                        </div>
                    </CardHeader>
                    <CardContent className="pt-6 overflow-y-auto flex-grow">
                        {isLoading ? (
                            <div className="flex items-center justify-center py-20">
                                <Loader2 className="w-12 h-12 animate-spin text-black" />
                            </div>
                        ) : files.length === 0 ? (
                            <div className="text-center py-20 border-2 border-dashed border-black bg-gray-50">
                                <Cloud className="w-20 h-20 mx-auto mb-6 opacity-30" />
                                <p className="text-xl font-black uppercase tracking-tighter text-gray-400">{t('dashboard.files.empty')}</p>
                            </div>
                        ) : (
                            <div>
                                <div className={viewMode === 'grid' ? 'grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-6' : 'grid grid-cols-1 gap-4'}>
                                    {files.map((file, index) => (
                                        viewMode === 'list' ? (
                                            <div
                                                key={file.id || `file-${index}`}
                                                className={`flex items-center justify-between p-5 border-2 border-black bg-white hover:bg-[hsl(var(--primary)/0.1)] transition-all shadow-nb-sm hover:translate-x-[-2px] hover:translate-y-[-2px] hover:shadow-nb ${file.mimeType === 'application/vnd.google-apps.folder' ? 'cursor-pointer' : ''}`}
                                                onClick={() => file.mimeType === 'application/vnd.google-apps.folder' && handleFolderClick(file)}
                                            >
                                                <div className="flex items-center gap-5 min-w-0">
                                                    <span className="text-4xl bg-[hsl(var(--secondary)/0.2)] border-2 border-black p-2 shadow-nb-sm flex-shrink-0">
                                                        {file.mimeType === 'application/vnd.google-apps.folder' ? (
                                                            <Folder className="w-10 h-10 text-[hsl(var(--primary))]" />
                                                        ) : (
                                                            getFileIcon(file.mimeType)
                                                        )}
                                                    </span>
                                                    <div className="min-w-0">
                                                        <p className="font-black text-lg tracking-tight truncate" title={file.originalName}>
                                                            {file.originalName}
                                                        </p>
                                                        <p className="text-sm font-bold opacity-60">
                                                            {file.mimeType === 'application/vnd.google-apps.folder' ? 'Folder' : `${formatBytes(file.size)} • ${formatDate(file.createdAt)}`}
                                                        </p>
                                                    </div>
                                                </div>
                                                <div className="flex items-center gap-3">
                                                    {file.mimeType !== 'application/vnd.google-apps.folder' && (
                                                        <>
                                                            <Button
                                                                variant="outline"
                                                                size="icon"
                                                                onClick={() => handlePreview(file)}
                                                                title={t('dashboard.files.preview')}
                                                                className="bg-white hover:bg-[hsl(var(--primary))]"
                                                            >
                                                                <Eye className="w-5 h-5 text-black" />
                                                            </Button>
                                                            <Button
                                                                variant="outline"
                                                                size="icon"
                                                                onClick={() => handleDownload(file)}
                                                                disabled={downloadingId === file.id}
                                                                title={t('dashboard.files.download')}
                                                                className="bg-white hover:bg-[hsl(var(--secondary))]"
                                                            >
                                                                {downloadingId === file.id ? (
                                                                    <Loader2 className="w-5 h-5 animate-spin text-black" />
                                                                ) : (
                                                                    <Download className="w-5 h-5 text-black" />
                                                                )}
                                                            </Button>
                                                        </>
                                                    )}
                                                    <Button
                                                        variant="outline"
                                                        size="icon"
                                                        onClick={() => handleDelete(file)}
                                                        disabled={deletingId === file.id}
                                                        title={t('dashboard.files.delete')}
                                                        className="bg-white hover:bg-[hsl(var(--destructive))] group"
                                                    >
                                                        {deletingId === file.id ? (
                                                            <Loader2 className="w-5 h-5 animate-spin text-black" />
                                                        ) : (
                                                            <Trash2 className="w-5 h-5 text-black group-hover:text-white" />
                                                        )}
                                                    </Button>
                                                    <Button
                                                        variant="outline"
                                                        size="icon"
                                                        onClick={() => handleOpenMove(file)}
                                                        title={t('dashboard.files.move')}
                                                        className="bg-white hover:bg-[hsl(var(--primary))]"
                                                    >
                                                        <MoveVertical className="w-5 h-5 text-black" />
                                                    </Button>
                                                </div>
                                            </div>
                                        ) : (
                                            <div
                                                key={file.id || `file-${index}`}
                                                className={`group/card border-2 border-black bg-white shadow-nb-sm hover:shadow-nb hover:translate-x-[-4px] hover:translate-y-[-4px] transition-all overflow-hidden flex flex-col ${file.mimeType === 'application/vnd.google-apps.folder' ? 'cursor-pointer' : ''}`}
                                                onClick={(e) => {
                                                    // Don't trigger if an action button was clicked
                                                    if ((e.target as HTMLElement).closest('button')) return;
                                                    if (file.mimeType === 'application/vnd.google-apps.folder') {
                                                        handleFolderClick(file);
                                                    }
                                                }}
                                            >
                                                <div className="h-40 bg-[hsl(var(--secondary)/0.1)] border-b-2 border-black flex items-center justify-center text-6xl group-hover/card:bg-[hsl(var(--primary)/0.2)] transition-colors relative overflow-hidden">
                                                    {file.mimeType === 'application/vnd.google-apps.folder' ? (
                                                        <Folder className="w-20 h-20 text-[hsl(var(--primary))]" />
                                                    ) : file.mimeType.startsWith('image/') ? (
                                                        <img
                                                            src={`${import.meta.env.VITE_API_URL || '/api'}/files/${file.id}/thumbnail?token=${localStorage.getItem('accessToken')}`}
                                                            alt={file.originalName}
                                                            className="w-full h-full object-cover"
                                                            onError={(e) => {
                                                                (e.target as HTMLImageElement).style.display = 'none';
                                                                (e.target as HTMLImageElement).parentElement?.classList.add('flex');
                                                            }}
                                                        />
                                                    ) : (
                                                        getFileIcon(file.mimeType)
                                                    )}
                                                    {/* Action Overlay - Always visible on mobile, hover on desktop */}
                                                    <div className="absolute inset-0 bg-black/40 md:opacity-0 group-hover/card:opacity-100 transition-opacity flex items-center justify-center gap-2">
                                                        {file.mimeType !== 'application/vnd.google-apps.folder' && (
                                                            <>
                                                                <Button
                                                                    variant="outline"
                                                                    size="icon"
                                                                    onClick={() => handlePreview(file)}
                                                                    className="bg-white hover:bg-[hsl(var(--primary))] border-2 border-black shadow-nb-sm scale-90 group-hover/card:scale-100 transition-transform"
                                                                >
                                                                    <Eye className="w-5 h-5 text-black" />
                                                                </Button>
                                                                <Button
                                                                    variant="outline"
                                                                    size="icon"
                                                                    onClick={() => handleDownload(file)}
                                                                    disabled={downloadingId === file.id}
                                                                    className="bg-white hover:bg-[hsl(var(--secondary))] border-2 border-black shadow-nb-sm scale-90 group-hover/card:scale-100 transition-transform"
                                                                >
                                                                    {downloadingId === file.id ? (
                                                                        <Loader2 className="w-5 h-5 animate-spin text-black" />
                                                                    ) : (
                                                                        <Download className="w-5 h-5 text-black" />
                                                                    )}
                                                                </Button>
                                                            </>
                                                        )}
                                                        <Button
                                                            variant="outline"
                                                            size="icon"
                                                            onClick={() => handleDelete(file)}
                                                            disabled={deletingId === file.id}
                                                            className="bg-white hover:bg-[hsl(var(--destructive))] border-2 border-black shadow-nb-sm scale-90 group-hover/card:scale-100 transition-transform group/del"
                                                        >
                                                            {deletingId === file.id ? (
                                                                <Loader2 className="w-5 h-5 animate-spin text-black" />
                                                            ) : (
                                                                <Trash2 className="w-5 h-5 text-black group-hover:text-white" />
                                                            )}
                                                        </Button>
                                                        <Button
                                                            variant="outline"
                                                            size="icon"
                                                            onClick={() => handleOpenMove(file)}
                                                            className="bg-white hover:bg-[hsl(var(--primary))] border-2 border-black shadow-nb-sm scale-90 group-hover/card:scale-100 transition-transform"
                                                        >
                                                            <MoveVertical className="w-5 h-5 text-black" />
                                                        </Button>
                                                    </div>
                                                </div>
                                                <div className="p-4 flex-grow flex flex-col bg-white min-w-0">
                                                    <p className="font-black text-sm tracking-tight mb-1 truncate" title={file.originalName}>
                                                        {file.originalName}
                                                    </p>
                                                    <p className="text-[10px] font-bold opacity-60 uppercase">
                                                        {file.mimeType === 'application/vnd.google-apps.folder' ? 'Folder' : `${formatBytes(file.size)} • ${formatDate(file.createdAt)}`}
                                                    </p>
                                                </div>
                                            </div>
                                        )
                                    ))}
                                </div>
                            </div>
                        )}
                    </CardContent>

                    {/* Sticky Pagination Controls */}
                    <div className="sticky bottom-0 bg-white border-t-2 border-black p-6 font-black uppercase tracking-tight z-20 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.1)]">
                        <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
                            <div className="flex items-center gap-4">
                                <p className="text-sm">
                                    {t('dashboard.files.pagination', { count: files.length, total: totalFiles })}
                                </p>
                                <select
                                    className="bg-white border-2 border-black px-2 py-1 text-xs font-black shadow-nb-sm outline-none cursor-pointer"
                                    value={pageSize}
                                    onChange={(e) => {
                                        setPageSize(Number(e.target.value));
                                        setCurrentPage(1);
                                    }}
                                >
                                    {viewMode === 'grid' ? (
                                        <>
                                            <option value={12}>12 {t('dashboard.files.perPage')}</option>
                                            <option value={24}>24 {t('dashboard.files.perPage')}</option>
                                            <option value={48}>48 {t('dashboard.files.perPage')}</option>
                                        </>
                                    ) : (
                                        <>
                                            <option value={10}>10 {t('dashboard.files.perPage')}</option>
                                            <option value={20}>20 {t('dashboard.files.perPage')}</option>
                                            <option value={50}>50 {t('dashboard.files.perPage')}</option>
                                        </>
                                    )}
                                </select>
                            </div>

                            {totalPages > 1 && (
                                <div className="flex items-center gap-2">
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        disabled={currentPage === 1}
                                        onClick={() => setCurrentPage(prev => prev - 1)}
                                        className="bg-white"
                                    >
                                        Prev
                                    </Button>
                                    <div className="flex items-center bg-[hsl(var(--primary))] border-2 border-black px-4 py-1.5 shadow-nb-sm">
                                        {t('dashboard.files.page', { current: currentPage, total: totalPages })}
                                    </div>
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        disabled={currentPage === totalPages}
                                        onClick={() => setCurrentPage(prev => prev + 1)}
                                        className="bg-white"
                                    >
                                        Next
                                    </Button>
                                </div>
                            )}
                        </div>
                    </div>
                </Card>
            </main >
            <UploadQueue />

            {/* Preview Modal */}
            {
                previewFile && (
                    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 p-4 animate-in fade-in duration-200">
                        <Card className="w-full max-w-5xl bg-white shadow-nb border-4 border-black animate-in zoom-in-95 duration-200 overflow-hidden">
                            <CardHeader className="border-b-4 border-black flex flex-row items-center justify-between p-4 bg-[hsl(var(--primary))]">
                                <CardTitle className="text-xl font-black truncate pr-4">
                                    {previewFile.originalName}
                                </CardTitle>
                                <Button
                                    variant="outline"
                                    size="icon"
                                    onClick={() => { setPreviewFile(null); setPreviewUrl(null); }}
                                    className="bg-white border-2 border-black hover:bg-[hsl(var(--accent))] shadow-nb-sm flex-shrink-0"
                                >
                                    <X className="w-5 h-5" />
                                </Button>
                            </CardHeader>
                            <CardContent className="p-0 bg-gray-100 h-[60vh] md:h-[70vh] relative overflow-hidden">
                                {(() => {
                                    // Use the signed URL that was fetched in handlePreview
                                    const fileUrl = previewUrl || '';

                                    if (previewFile.mimeType.startsWith('image/')) {
                                        return <ZoomableImage src={fileUrl} alt={previewFile.originalName} />;
                                    } else if (previewFile.mimeType.startsWith('video/')) {
                                        return (
                                            <div className="w-full h-full flex items-center justify-center bg-black">
                                                <video
                                                    controls
                                                    autoPlay
                                                    className="max-w-full max-h-full"
                                                    src={fileUrl}
                                                >
                                                    Your browser does not support the video tag.
                                                </video>
                                            </div>
                                        );
                                    } else if (previewFile.mimeType.startsWith('audio/')) {
                                        return (
                                            <div className="w-full h-full flex items-center justify-center bg-gray-100">
                                                <audio controls autoPlay src={fileUrl} className="w-full max-w-md" />
                                            </div>
                                        );
                                    } else if (previewFile.mimeType === 'application/pdf') {
                                        return (
                                            <iframe
                                                src={fileUrl}
                                                className="w-full h-full border-none"
                                                title={previewFile.originalName}
                                            />
                                        );
                                    } else {
                                        return (
                                            <div className="w-full h-full flex flex-col items-center justify-center text-center p-8 gap-4">
                                                <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center border-2 border-black shadow-nb-sm">
                                                    <FileText className="w-10 h-10 text-gray-400" />
                                                </div>
                                                <div>
                                                    <p className="font-bold text-lg">{t('dashboard.files.previewUnavailable')}</p>
                                                    <p className="text-sm opacity-60">
                                                        {previewFile.mimeType.includes('google-apps')
                                                            ? "Google Docs cannot be embedded due to security policies."
                                                            : "This file type cannot be previewed directly."}
                                                    </p>
                                                </div>
                                                {previewFile.webViewLink && (
                                                    <Button
                                                        onClick={() => window.open(previewFile.webViewLink, '_blank')}
                                                        className="bg-[hsl(var(--primary))] border-2 border-black shadow-nb-sm text-black font-black uppercase"
                                                    >
                                                        {t('dashboard.files.openInNewTab')} <ExternalLink className="w-4 h-4 ml-2" />
                                                    </Button>
                                                )}
                                            </div>
                                        );
                                    }
                                })()}
                            </CardContent>
                            <div className="p-4 border-t-4 border-black bg-white flex justify-between items-center font-black uppercase text-sm">
                                <div className="hidden sm:block">
                                    {formatBytes(previewFile.size)} • {formatDate(previewFile.createdAt)}
                                </div>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => handleDownload(previewFile)}
                                    disabled={downloadingId === previewFile.id}
                                    className="bg-[hsl(var(--secondary))] border-2 border-black shadow-nb-sm"
                                >
                                    {downloadingId === previewFile.id ? (
                                        <Loader2 className="w-4 h-4 animate-spin mr-2" />
                                    ) : (
                                        <Download className="w-4 h-4 mr-2" />
                                    )}
                                    {t('dashboard.files.download')}
                                </Button>
                            </div>
                        </Card>
                    </div>
                )
            }

            {/* Create Folder Modal */}
            {isCreateFolderModalOpen && (
                <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/60 p-4 animate-in fade-in duration-200">
                    <Card className="w-full max-w-md bg-white shadow-nb border-4 border-black animate-in zoom-in-95 duration-200">
                        <CardHeader className="border-b-4 border-black bg-[hsl(var(--secondary))] flex flex-row items-center justify-between">
                            <CardTitle className="text-xl font-black uppercase text-black">
                                {t('dashboard.folders.create.title')}
                            </CardTitle>
                            <Button
                                variant="outline"
                                size="icon"
                                onClick={() => {
                                    setIsCreateFolderModalOpen(false);
                                    setNewFolderName('');
                                }}
                                className="h-8 w-8 bg-white border-2 border-black shadow-nb-sm hover:translate-y-0.5 hover:shadow-none transition-all"
                            >
                                <X className="w-4 h-4" />
                            </Button>
                        </CardHeader>
                        <form onSubmit={handleCreateFolder}>
                            <CardContent className="p-6">
                                <div className="space-y-4">
                                    <label className="block text-sm font-black uppercase">
                                        {t('dashboard.folders.create.placeholder')}
                                    </label>
                                    <input
                                        autoFocus
                                        type="text"
                                        value={newFolderName}
                                        onChange={(e) => setNewFolderName(e.target.value)}
                                        className="w-full p-3 border-2 border-black shadow-nb-sm focus:outline-none focus:ring-2 focus:ring-[hsl(var(--primary))] font-bold"
                                        placeholder={t('dashboard.folders.create.placeholder')}
                                        disabled={isCreatingFolder}
                                    />
                                </div>
                            </CardContent>
                            <div className="p-4 border-t-4 border-black bg-white flex justify-end gap-3">
                                <Button
                                    type="button"
                                    variant="outline"
                                    onClick={() => {
                                        setIsCreateFolderModalOpen(false);
                                        setNewFolderName('');
                                    }}
                                    disabled={isCreatingFolder}
                                    className="bg-white border-2 border-black shadow-nb-sm font-black uppercase"
                                >
                                    {t('dashboard.folders.create.cancel')}
                                </Button>
                                <Button
                                    type="submit"
                                    disabled={isCreatingFolder || !newFolderName.trim()}
                                    className="bg-[hsl(var(--primary))] border-2 border-black shadow-nb-sm font-black uppercase text-black hover:bg-[hsl(var(--primary)/0.8)]"
                                >
                                    {isCreatingFolder ? (
                                        <Loader2 className="w-4 h-4 animate-spin mr-2" />
                                    ) : (
                                        <FolderPlus className="w-4 h-4 mr-2" />
                                    )}
                                    {t('dashboard.folders.create.submit')}
                                </Button>
                            </div>
                        </form>
                    </Card>
                </div>
            )}

            {/* Move Modal */}
            {isMoveModalOpen && movingFile && (
                <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/60 p-4 animate-in fade-in duration-200">
                    <Card className="w-full max-w-md bg-white shadow-nb border-4 border-black animate-in zoom-in-95 duration-200 overflow-hidden flex flex-col max-h-[80vh]">
                        <CardHeader className="border-b-4 border-black bg-[hsl(var(--primary))] flex flex-row items-center justify-between">
                            <CardTitle className="text-xl font-black uppercase text-black flex items-center gap-2">
                                <MoveVertical className="w-5 h-5" />
                                {t('dashboard.folders.move.title')}
                            </CardTitle>
                            <Button
                                variant="outline"
                                size="icon"
                                onClick={() => setIsMoveModalOpen(false)}
                                className="h-8 w-8 bg-white border-2 border-black shadow-nb-sm hover:translate-y-0.5 hover:shadow-none transition-all"
                            >
                                <X className="w-4 h-4" />
                            </Button>
                        </CardHeader>

                        <div className="px-4 py-2 bg-gray-50 border-b-2 border-black flex items-center gap-2 overflow-x-auto no-scrollbar">
                            <button
                                onClick={() => navigateMoveFolder(null)}
                                className={`text-[10px] uppercase font-black tracking-widest px-2 py-1 border-2 border-black shadow-nb-sm transition-all ${!moveCurrentFolder ? 'bg-[hsl(var(--secondary))]' : 'bg-white hover:bg-gray-100'}`}
                            >
                                ROOT
                            </button>
                            {moveFolderPath.map((folder, index) => (
                                <div key={folder.id} className="flex items-center gap-2">
                                    <span className="text-black font-black">/</span>
                                    <button
                                        onClick={() => navigateMoveFolder(folder, index)}
                                        className={`text-[10px] uppercase font-black tracking-widest px-2 py-1 border-2 border-black shadow-nb-sm transition-all whitespace-nowrap ${index === moveFolderPath.length - 1 ? 'bg-[hsl(var(--secondary))]' : 'bg-white hover:bg-gray-100'}`}
                                    >
                                        {folder.originalName}
                                    </button>
                                </div>
                            ))}
                        </div>

                        <CardContent className="p-0 overflow-y-auto flex-grow bg-white">
                            <div className="divide-y-2 divide-black/10">
                                {moveTargetFolders.length === 0 ? (
                                    <div className="p-8 text-center opacity-40 font-black uppercase text-xs">
                                        {t('dashboard.files.empty')}
                                    </div>
                                ) : (
                                    moveTargetFolders.map((folder) => (
                                        <div
                                            key={folder.id}
                                            onClick={() => handleMoveFolderClick(folder)}
                                            className="p-4 flex items-center gap-3 cursor-pointer hover:bg-[hsl(var(--primary)/0.1)] transition-colors group"
                                        >
                                            <Folder className="w-5 h-5 text-[hsl(var(--primary))]" />
                                            <span className="font-bold flex-grow truncate">{folder.originalName}</span>
                                            <ChevronRight className="w-4 h-4 opacity-0 group-hover:opacity-100 transition-opacity" />
                                        </div>
                                    ))
                                )}
                            </div>
                        </CardContent>

                        <div className="p-4 border-t-4 border-black bg-white flex flex-col gap-3">
                            <p className="text-[10px] font-black uppercase opacity-60">
                                Moving: <span className="text-black opacity-100">{movingFile.originalName}</span>
                            </p>
                            <div className="flex justify-end gap-3">
                                <Button
                                    variant="outline"
                                    onClick={() => setIsMoveModalOpen(false)}
                                    disabled={isMoving}
                                    className="bg-white border-2 border-black shadow-nb-sm font-black uppercase"
                                >
                                    {t('dashboard.folders.move.cancel')}
                                </Button>
                                <Button
                                    onClick={handleMoveConfirm}
                                    disabled={isMoving || (movingFile.parentId === (moveCurrentFolder?.id || null))}
                                    className="bg-[hsl(var(--secondary))] border-2 border-black shadow-nb-sm font-black uppercase flex-grow sm:flex-none"
                                >
                                    {isMoving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <MoveVertical className="w-4 h-4 mr-2" />}
                                    {t('dashboard.folders.move.moveHere')}
                                </Button>
                            </div>
                        </div>
                    </Card>
                </div>
            )}

            {/* Upload Modal */}
            {isUploadModalOpen && (
                <div className="fixed inset-0 z-[130] flex items-center justify-center bg-black/60 p-4 animate-in fade-in duration-200">
                    <Card className="w-full max-w-2xl bg-white shadow-nb border-4 border-black animate-in zoom-in-95 duration-200">
                        <CardHeader className="border-b-4 border-black bg-[hsl(var(--primary))] flex flex-row items-center justify-between">
                            <CardTitle className="text-xl font-black uppercase text-black flex items-center gap-2">
                                <Upload className="w-5 h-5" />
                                {t('dashboard.actions.uploadTitle')}
                            </CardTitle>
                            <Button
                                variant="outline"
                                size="icon"
                                onClick={() => setIsUploadModalOpen(false)}
                                className="h-8 w-8 bg-white border-2 border-black shadow-nb-sm hover:translate-y-0.5 hover:shadow-none transition-all"
                            >
                                <X className="w-4 h-4" />
                            </Button>
                        </CardHeader>
                        <CardContent className="p-8">
                            <div
                                className={`border-4 border-dashed transition-all cursor-pointer shadow-nb-sm hover:shadow-nb p-12 text-center rounded-none relative ${isDragging ? 'border-[hsl(var(--primary))] bg-[hsl(var(--primary)/0.1)]' : 'border-black bg-white'
                                    }`}
                                onDragOver={handleDragOver}
                                onDragLeave={handleDragLeave}
                                onDrop={(e) => {
                                    handleDrop(e);
                                    setIsUploadModalOpen(false);
                                }}
                            >
                                <input
                                    type="file"
                                    id="modal-file-upload"
                                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                                    onChange={(e) => {
                                        handleFileUpload(e);
                                        setIsUploadModalOpen(false);
                                    }}
                                    multiple
                                />
                                <div className="flex flex-col items-center justify-center">
                                    <div className="w-16 h-16 bg-[hsl(var(--secondary))] border-2 border-black flex items-center justify-center shadow-nb-sm mb-4">
                                        <Upload className="w-8 h-8 text-black" />
                                    </div>
                                    <h3 className="text-2xl font-black uppercase tracking-tighter mb-2">
                                        {t('dashboard.actions.upload')}
                                    </h3>
                                    <p className="text-xs font-bold opacity-60 uppercase tracking-widest max-w-[200px] mx-auto">
                                        {t('dashboard.actions.uploadHint')}
                                    </p>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            )}

            {/* Delete Confirmation Modal */}
            {isDeleteModalOpen && fileToDelete && (
                <div className="fixed inset-0 z-[140] flex items-center justify-center bg-black/60 p-4 animate-in fade-in duration-200">
                    <Card className="w-full max-w-md bg-white shadow-nb border-4 border-black animate-in zoom-in-95 duration-200">
                        <CardHeader className="border-b-4 border-black bg-[hsl(var(--accent))] flex flex-row items-center justify-between">
                            <CardTitle className="text-xl font-black uppercase text-black flex items-center gap-2">
                                <Trash2 className="w-5 h-5" />
                                {t('dashboard.files.delete')}
                            </CardTitle>
                            <Button
                                variant="outline"
                                size="icon"
                                onClick={() => {
                                    setIsDeleteModalOpen(false);
                                    setFileToDelete(null);
                                }}
                                className="h-8 w-8 bg-white border-2 border-black shadow-nb-sm hover:translate-y-0.5 hover:shadow-none transition-all"
                            >
                                <X className="w-4 h-4" />
                            </Button>
                        </CardHeader>
                        <CardContent className="p-8 text-center">
                            <div className="w-16 h-16 bg-[hsl(var(--accent)/0.1)] border-2 border-black flex items-center justify-center shadow-nb-sm mb-6 mx-auto rounded-none">
                                <Trash2 className="w-8 h-8 text-[hsl(var(--accent))]" />
                            </div>
                            <p className="font-bold text-lg leading-tight uppercase tracking-tight">
                                {t('dashboard.files.deleteConfirm', { name: fileToDelete.originalName })}
                            </p>
                            <p className="text-xs font-bold opacity-40 uppercase mt-4 tracking-widest px-4">
                                Thao tác này không thể hoàn tác. File sẽ bị xóa vĩnh viễn khỏi Google Drive.
                            </p>
                        </CardContent>
                        <div className="p-4 border-t-4 border-black bg-white flex justify-end gap-3">
                            <Button
                                variant="outline"
                                onClick={() => {
                                    setIsDeleteModalOpen(false);
                                    setFileToDelete(null);
                                }}
                                className="bg-white border-2 border-black shadow-nb-sm font-black uppercase"
                            >
                                {t('dashboard.folders.create.cancel')}
                            </Button>
                            <Button
                                onClick={handleConfirmDelete}
                                className="bg-[hsl(var(--accent))] border-2 border-black shadow-nb-sm font-black uppercase text-black hover:bg-[hsl(var(--accent)/0.8)]"
                            >
                                {t('dashboard.files.delete')}
                            </Button>
                        </div>
                    </Card>
                </div>
            )}
            {/* Feedback Components */}
            <FeedbackUnifiedModal
                isOpen={isFeedbackOpen}
                onClose={() => setIsFeedbackOpen(false)}
                refreshTrigger={feedbackRefreshTrigger}
                onFeedbackSent={() => setFeedbackRefreshTrigger(prev => prev + 1)}
            />
        </div>
    );
}

function ZoomableImage({ src, alt }: { src: string; alt: string }) {
    const [scale, setScale] = useState(1);
    const [position, setPosition] = useState({ x: 0, y: 0 });
    const [isDragging, setIsDragging] = useState(false);
    const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
    const containerRef = useRef<HTMLDivElement>(null);

    const handleWheel = (e: React.WheelEvent) => {
        const delta = e.deltaY;
        const scaleChange = delta > 0 ? 0.9 : 1.1;
        const newScale = Math.min(Math.max(scale * scaleChange, 0.5), 10);
        setScale(newScale);
    };

    const handleMouseDown = (e: React.MouseEvent) => {
        if (scale > 1) {
            setIsDragging(true);
            setDragStart({ x: e.clientX - position.x, y: e.clientY - position.y });
        }
    };

    const handleMouseMove = (e: React.MouseEvent) => {
        if (isDragging) {
            setPosition({
                x: e.clientX - dragStart.x,
                y: e.clientY - dragStart.y
            });
        }
    };

    const handleMouseUp = () => {
        setIsDragging(false);
    };

    return (
        <div
            ref={containerRef}
            className="w-full h-full flex items-center justify-center cursor-move overflow-hidden bg-black/5"
            onWheel={handleWheel}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
        >
            <img
                src={src}
                alt={alt}
                draggable={false}
                className="max-w-full max-h-full transition-transform duration-200 ease-out select-none shadow-lg"
                style={{
                    transform: `translate(${position.x}px, ${position.y}px) scale(${scale})`,
                }}
            />
        </div>
    );
}
