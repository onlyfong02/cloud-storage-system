import { useUploadStore } from '@/store/useUploadStore';
import { useTranslation } from 'react-i18next';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { X, ChevronDown, ChevronUp, Loader2, CheckCircle2, AlertCircle, PauseCircle, PlayCircle, RefreshCw } from 'lucide-react';
import { useState } from 'react';

export function UploadQueue() {
    const { t } = useTranslation();
    const { queue, removeFile, clearCompleted, resumeFile, retryFile } = useUploadStore();
    const [isExpanded, setIsExpanded] = useState(true);
    const [resumingId, setResumingId] = useState<string | null>(null);

    if (queue.length === 0) return null;

    const activeCount = queue.filter(item => item.status === 'uploading' || item.status === 'pending').length;
    const totalCount = queue.length;
    const totalProgress = Math.round(
        queue.reduce((acc, item) => acc + item.progress, 0) / totalCount
    );

    const handleResumeClick = (id: string) => {
        const item = queue.find(i => i.id === id);
        if (item?.file) {
            retryFile(id);
        } else {
            setResumingId(id);
            const input = document.getElementById('resume-file-input') as HTMLInputElement;
            if (input) input.click();
        }
    };

    const handleFileResume = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file && resumingId) {
            resumeFile(resumingId, file);
            setResumingId(null);
        }
        e.target.value = '';
    };

    return (
        <div className="fixed bottom-6 right-6 w-96 z-50 animate-in slide-in-from-bottom-5">
            <input
                type="file"
                id="resume-file-input"
                className="hidden"
                onChange={handleFileResume}
            />
            <Card className="border-4 border-black shadow-nb overflow-hidden">
                <CardHeader className="p-4 border-b-4 border-black bg-[hsl(var(--primary))] flex flex-row items-center justify-between space-y-0">
                    <CardTitle className="text-sm font-black uppercase tracking-tight">
                        {t('dashboard.files.uploads.title', { count: queue.length })}
                        {activeCount > 0 && ` (${activeCount} ${t('dashboard.files.uploads.remaining')})`}
                    </CardTitle>
                    <div className="flex items-center gap-2">
                        <Button
                            variant="outline"
                            size="icon"
                            className="h-8 w-8 bg-white border-2 border-black shadow-nb-sm hover:translate-y-0.5 hover:shadow-none transition-all"
                            onClick={() => setIsExpanded(!isExpanded)}
                        >
                            {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
                        </Button>
                        <Button
                            variant="outline"
                            size="icon"
                            className="h-8 w-8 bg-white border-2 border-black shadow-nb-sm hover:translate-y-0.5 hover:shadow-none transition-all"
                            onClick={clearCompleted}
                            title={t('dashboard.files.uploads.clear')}
                        >
                            <X className="w-4 h-4" />
                        </Button>
                    </div>
                </CardHeader>

                {/* Aggregate Progress Bar */}
                {activeCount > 0 && (
                    <div className="h-6 bg-white border-b-2 border-black relative overflow-hidden group">
                        <div
                            className="absolute top-0 left-0 h-full bg-[hsl(var(--accent))] transition-all duration-500 ease-out"
                            style={{ width: `${totalProgress}%` }}
                        />
                        <div className="absolute inset-0 flex items-center justify-center">
                            <span className="text-xs font-black uppercase text-black">
                                {t('dashboard.files.uploads.overall')}: {totalProgress}%
                            </span>
                        </div>
                    </div>
                )}
                {isExpanded && (
                    <CardContent className="p-0 max-h-[400px] overflow-y-auto">
                        <div className="divide-y-2 divide-black/10">
                            {queue.map((item) => (
                                <div key={item.id} className="p-4 bg-white hover:bg-gray-50 transition-colors">
                                    <div className="flex items-center justify-between mb-2">
                                        <div className="flex items-center gap-3 overflow-hidden">
                                            {item.status === 'uploading' && <Loader2 className="w-4 h-4 animate-spin shrink-0" />}
                                            {item.status === 'completed' && <CheckCircle2 className="w-4 h-4 text-green-600 shrink-0" />}
                                            {item.status === 'error' && <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />}
                                            {item.status === 'pending' && <Loader2 className="w-4 h-4 opacity-30 shrink-0" />}
                                            {item.status === 'paused' && <PauseCircle className="w-4 h-4 opacity-50 shrink-0" />}

                                            <span className="text-xs font-bold truncate uppercase tracking-tight">
                                                {item.fileName}
                                            </span>
                                        </div>
                                        <div className="flex items-center gap-1">
                                            {item.status === 'paused' && (
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    className="h-6 w-6 text-blue-600"
                                                    onClick={() => handleResumeClick(item.id)}
                                                    title={t('dashboard.files.uploads.resume')}
                                                >
                                                    <PlayCircle className="w-3 h-3" />
                                                </Button>
                                            )}
                                            {item.status === 'error' && (
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    className="h-6 w-6 text-orange-600"
                                                    onClick={() => retryFile(item.id)}
                                                    title={t('dashboard.files.uploads.retry')}
                                                >
                                                    <RefreshCw className="w-3 h-3" />
                                                </Button>
                                            )}
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                className="h-6 w-6 shrink-0"
                                                onClick={() => removeFile(item.id)}
                                            >
                                                <X className="w-3 h-3" />
                                            </Button>
                                        </div>
                                    </div>

                                    <div className="relative h-6 border-2 border-black bg-white overflow-hidden shadow-nb-sm">
                                        <div
                                            className="absolute top-0 left-0 h-full bg-[hsl(var(--primary))] transition-all duration-300"
                                            style={{ width: `${item.progress}%` }}
                                        />
                                        <div className="absolute inset-0 flex items-center justify-center">
                                            <span className="text-xs font-black uppercase text-black">
                                                {item.progress}%
                                            </span>
                                        </div>
                                    </div>

                                    {item.error && (
                                        <p className="text-[10px] text-red-600 font-bold mt-1 uppercase truncate">
                                            {item.error}
                                        </p>
                                    )}
                                </div>
                            ))}
                        </div>
                    </CardContent>
                )}
            </Card>
        </div>
    );
}
