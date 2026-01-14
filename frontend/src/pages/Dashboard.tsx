import { useState, useEffect, useCallback, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/contexts/AuthContext';
import { fileService, authService, type FileMetadata } from '@/services';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { formatBytes, formatDate, getFileIcon } from '@/lib/utils';
import {
    Cloud,
    Upload,
    Download,
    Trash2,
    LogOut,
    HardDrive,
    FileIcon,
    Loader2,
    RefreshCw,
    Settings,
    LayoutGrid,
    List,
    Eye,
    X,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import { LanguageSwitcher } from '@/components/LanguageSwitcher';
import { useUploadStore } from '@/store/useUploadStore';
import { UploadQueue } from '@/components/UploadQueue';

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
    const [viewMode, setViewMode] = useState<'list' | 'grid'>('grid');
    const [pageSize, setPageSize] = useState(12);
    const [isDragging, setIsDragging] = useState(false);
    const [previewFile, setPreviewFile] = useState<FileMetadata | null>(null);
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
            addFiles(droppedFiles);
            toast.success(t('dashboard.files.uploads.added', { count: droppedFiles.length }));
        }
    };
    const limit = pageSize;

    const loadData = useCallback(async () => {
        setIsLoading(true);
        try {
            const [paginatedFiles, storage, stats] = await Promise.all([
                fileService.getFiles(currentPage, limit),
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
    }, [currentPage, limit]);

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

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const selectedFiles = Array.from(e.target.files || []);
        if (selectedFiles.length === 0) return;

        addFiles(selectedFiles);
        toast.success(t('dashboard.files.uploads.added', { count: selectedFiles.length }));
        e.target.value = '';
    };

    const handleDownload = async (file: FileMetadata) => {
        const toastId = toast.loading(t('dashboard.files.downloading', { name: file.originalName }));
        try {
            await fileService.downloadFile(file._id, file.originalName);
            toast.success(t('dashboard.files.downloadSuccess'), { id: toastId });
        } catch (error) {
            console.error('Download failed:', error);
            toast.error(t('dashboard.files.downloadFailed'), { id: toastId });
        }
    };

    const handlePreview = (file: FileMetadata) => {
        if (file.webViewLink) {
            setPreviewFile(file);
        } else {
            toast.error(t('dashboard.files.previewUnavailable'));
        }
    };

    const handleDelete = async (file: FileMetadata) => {
        if (!confirm(t('dashboard.files.deleteConfirm', { name: file.originalName }))) return;

        setDeletingId(file._id);
        const toastId = toast.loading(t('dashboard.files.deleting', { name: file.originalName }));
        try {
            await fileService.deleteFile(file._id);
            toast.success(t('dashboard.files.deleteSuccess', { name: file.originalName }), { id: toastId });
            await loadData();
        } catch (error) {
            console.error('Delete failed:', error);
            toast.error(t('dashboard.files.deleteFailed'), { id: toastId });
        } finally {
            setDeletingId(null);
        }
    };

    const totalPages = Math.ceil(totalFiles / limit);

    return (
        <div className="min-h-screen bg-[#f0f0f0] font-bold">
            {/* Header */}
            <header className="border-b-4 border-black bg-white sticky top-0 z-10">
                <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 bg-[hsl(var(--primary))] border-2 border-black flex items-center justify-center shadow-nb-sm">
                            <Cloud className="w-6 h-6 text-black" />
                        </div>
                        <div>
                            <h1 className="font-black text-2xl uppercase tracking-tighter">Fong's Cloud Storage</h1>
                            <p className="text-sm text-black font-medium">{user?.email}</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-3">
                        <LanguageSwitcher />
                        {user?.role === 'ADMIN' && (
                            <Link to="/admin">
                                <Button variant="outline" size="sm" className="bg-[hsl(var(--secondary))]">
                                    <Settings className="w-4 h-4 mr-2" />
                                    {t('dashboard.admin')}
                                </Button>
                            </Link>
                        )}
                        <Button variant="outline" size="sm" onClick={logout} className="bg-[hsl(var(--accent))]">
                            <LogOut className="w-4 h-4 mr-2" />
                            {t('dashboard.logout')}
                        </Button>
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
                                <span className="text-5xl font-black tracking-tighter">{totalFiles}</span>
                                <span className="text-sm font-bold uppercase opacity-60">Files</span>
                            </div>
                            {fileStats && (
                                <div className="grid grid-cols-2 gap-2 text-[10px] font-black uppercase">
                                    <div className="bg-white/50 border-2 border-black p-1.5 flex justify-between">
                                        <span>{t('dashboard.stats.images')}</span>
                                        <span>{fileStats.images}</span>
                                    </div>
                                    <div className="bg-white/50 border-2 border-black p-1.5 flex justify-between">
                                        <span>{t('dashboard.stats.videos')}</span>
                                        <span>{fileStats.videos}</span>
                                    </div>
                                    <div className="bg-white/50 border-2 border-black p-1.5 flex justify-between">
                                        <span>{t('dashboard.stats.audios')}</span>
                                        <span>{fileStats.audios}</span>
                                    </div>
                                    <div className="bg-white/50 border-2 border-black p-1.5 flex justify-between">
                                        <span>{t('dashboard.stats.others')}</span>
                                        <span>{fileStats.documents + fileStats.others}</span>
                                    </div>
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </div>

                {/* Upload Section (Dropzone) */}
                <Card
                    className={`mb-8 border-4 border-dashed transition-all cursor-pointer shadow-nb hover:translate-x-[-2px] hover:translate-y-[-2px] hover:shadow-nb-lg ${isDragging ? 'border-[hsl(var(--primary))] bg-[hsl(var(--primary)/0.1)]' : 'border-black bg-white'
                        }`}
                    onDragOver={handleDragOver}
                    onDragLeave={handleDragLeave}
                    onDrop={handleDrop}
                >
                    <CardContent className="py-12">
                        <input
                            type="file"
                            id="file-upload"
                            className="hidden"
                            onChange={handleFileUpload}
                            multiple
                        />
                        <label htmlFor="file-upload" className="flex flex-col items-center justify-center cursor-pointer w-full">
                            <div className="w-20 h-20 bg-[hsl(var(--primary))] border-2 border-black flex items-center justify-center shadow-nb-sm mb-6">
                                <Upload className="w-10 h-10 text-black" />
                            </div>
                            <h3 className="text-3xl font-black uppercase tracking-tighter mb-2">
                                {t('dashboard.actions.upload')}
                            </h3>
                            <p className="text-sm font-bold opacity-60 uppercase tracking-widest">
                                {t('dashboard.actions.uploadHint')}
                            </p>
                        </label>
                    </CardContent>
                </Card>

                {/* Files List */}
                <Card className="bg-white flex flex-col max-h-[700px] overflow-hidden shadow-nb sticky top-[96px]">
                    <CardHeader className="border-b-2 border-black flex flex-row items-center justify-between sticky top-0 z-20 bg-white">
                        <CardTitle className="text-2xl font-black uppercase">{t('dashboard.files.title')}</CardTitle>
                        <div className="flex items-center gap-2">
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={loadData}
                                disabled={isLoading}
                                className="bg-white hover:bg-[hsl(var(--primary)/0.2)]"
                            >
                                <RefreshCw className={`w-4 h-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
                                {t('dashboard.actions.refresh')}
                            </Button>
                            <div className="w-[2px] h-6 bg-black/20 mx-1" />
                            <Button
                                variant="outline"
                                size="icon"
                                onClick={() => handleViewModeChange('grid')}
                                className={viewMode === 'grid' ? 'bg-[hsl(var(--primary))]' : 'bg-white'}
                            >
                                <LayoutGrid className="w-5 h-5" />
                            </Button>
                            <Button
                                variant="outline"
                                size="icon"
                                onClick={() => handleViewModeChange('list')}
                                className={viewMode === 'list' ? 'bg-[hsl(var(--primary))]' : 'bg-white'}
                            >
                                <List className="w-5 h-5" />
                            </Button>
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
                                                key={file._id || `file-${index}`}
                                                className="flex items-center justify-between p-5 border-2 border-black bg-white hover:bg-[hsl(var(--primary)/0.1)] transition-all shadow-nb-sm hover:translate-x-[-2px] hover:translate-y-[-2px] hover:shadow-nb"
                                            >
                                                <div className="flex items-center gap-5">
                                                    <span className="text-4xl bg-[hsl(var(--secondary)/0.2)] border-2 border-black p-2 shadow-nb-sm">{getFileIcon(file.mimeType)}</span>
                                                    <div>
                                                        <p className="font-black text-lg uppercase tracking-tight">{file.originalName}</p>
                                                        <p className="text-sm font-bold opacity-60">
                                                            {formatBytes(file.size)} • {formatDate(file.createdAt)}
                                                        </p>
                                                    </div>
                                                </div>
                                                <div className="flex items-center gap-3">
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
                                                        title={t('dashboard.files.download')}
                                                        className="bg-white hover:bg-[hsl(var(--secondary))]"
                                                    >
                                                        <Download className="w-5 h-5 text-black" />
                                                    </Button>
                                                    <Button
                                                        variant="outline"
                                                        size="icon"
                                                        onClick={() => handleDelete(file)}
                                                        disabled={deletingId === file._id}
                                                        title={t('dashboard.files.delete')}
                                                        className="bg-white hover:bg-[hsl(var(--destructive))] group"
                                                    >
                                                        {deletingId === file._id ? (
                                                            <Loader2 className="w-5 h-5 animate-spin text-black" />
                                                        ) : (
                                                            <Trash2 className="w-5 h-5 text-black group-hover:text-white" />
                                                        )}
                                                    </Button>
                                                </div>
                                            </div>
                                        ) : (
                                            <div
                                                key={file._id || `file-${index}`}
                                                className="group/card border-2 border-black bg-white shadow-nb-sm hover:shadow-nb hover:translate-x-[-4px] hover:translate-y-[-4px] transition-all overflow-hidden flex flex-col"
                                            >
                                                <div className="h-40 bg-[hsl(var(--secondary)/0.1)] border-b-2 border-black flex items-center justify-center text-6xl group-hover/card:bg-[hsl(var(--primary)/0.2)] transition-colors relative overflow-hidden">
                                                    {file.thumbnailLink ? (
                                                        <img
                                                            src={file.thumbnailLink}
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
                                                            className="bg-white hover:bg-[hsl(var(--secondary))] border-2 border-black shadow-nb-sm scale-90 group-hover/card:scale-100 transition-transform"
                                                        >
                                                            <Download className="w-5 h-5 text-black" />
                                                        </Button>
                                                        <Button
                                                            variant="outline"
                                                            size="icon"
                                                            onClick={() => handleDelete(file)}
                                                            disabled={deletingId === file._id}
                                                            className="bg-white hover:bg-[hsl(var(--destructive))] border-2 border-black shadow-nb-sm scale-90 group-hover/card:scale-100 transition-transform group/del"
                                                        >
                                                            {deletingId === file._id ? (
                                                                <Loader2 className="w-5 h-5 animate-spin text-black" />
                                                            ) : (
                                                                <Trash2 className="w-5 h-5 text-black group-hover/del:text-white" />
                                                            )}
                                                        </Button>
                                                    </div>
                                                </div>
                                                <div className="p-4 flex-grow flex flex-col bg-white">
                                                    <p className="font-black text-sm uppercase tracking-tight mb-1 truncate" title={file.originalName}>
                                                        {file.originalName}
                                                    </p>
                                                    <p className="text-[10px] font-bold opacity-60 uppercase">
                                                        {formatBytes(file.size)} • {formatDate(file.createdAt)}
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
            </main>
            <UploadQueue />

            {/* Preview Modal */}
            {previewFile && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 p-4 animate-in fade-in duration-200">
                    <Card className="w-full max-w-5xl bg-white shadow-nb border-4 border-black animate-in zoom-in-95 duration-200 overflow-hidden">
                        <CardHeader className="border-b-4 border-black flex flex-row items-center justify-between p-4 bg-[hsl(var(--primary))]">
                            <CardTitle className="text-xl font-black uppercase truncate pr-4">
                                {previewFile.originalName}
                            </CardTitle>
                            <Button
                                variant="outline"
                                size="icon"
                                onClick={() => setPreviewFile(null)}
                                className="bg-white border-2 border-black hover:bg-[hsl(var(--accent))] shadow-nb-sm flex-shrink-0"
                            >
                                <X className="w-5 h-5" />
                            </Button>
                        </CardHeader>
                        <CardContent className="p-0 bg-gray-100 h-[60vh] md:h-[70vh] relative">
                            {previewFile.webViewLink && (
                                <iframe
                                    src={previewFile.webViewLink.replace('/view?usp=drivesdk', '/preview').replace('/view', '/preview')}
                                    className="w-full h-full border-none"
                                    allow="autoplay"
                                    allowFullScreen
                                />
                            )}
                        </CardContent>
                        <div className="p-4 border-t-4 border-black bg-white flex justify-between items-center font-black uppercase text-sm">
                            <div className="hidden sm:block">
                                {formatBytes(previewFile.size)} • {formatDate(previewFile.createdAt)}
                            </div>
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleDownload(previewFile)}
                                className="bg-[hsl(var(--secondary))] border-2 border-black shadow-nb-sm"
                            >
                                <Download className="w-4 h-4 mr-2" />
                                {t('dashboard.files.download')}
                            </Button>
                        </div>
                    </Card>
                </div>
            )}
        </div>
    );
}
