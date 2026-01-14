import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";

import { Badge } from '@/components/ui/badge';
import { feedbackService, type Feedback } from '@/services';
import { Loader2, Send, MessageSquare, User, ShieldCheck, Plus, List } from 'lucide-react';
import { format } from 'date-fns';
import { toast } from 'sonner';

interface FeedbackUnifiedModalProps {
    isOpen: boolean;
    onClose: () => void;
    initialTab?: 'history' | 'new';
    refreshTrigger: number;
    onFeedbackSent: () => void;
}

export function FeedbackUnifiedModal({
    isOpen,
    onClose,
    initialTab = 'history',
    refreshTrigger,
    onFeedbackSent
}: FeedbackUnifiedModalProps) {
    const { t } = useTranslation();
    const [activeTab, setActiveTab] = useState<'history' | 'new'>(initialTab);
    const [feedbacks, setFeedbacks] = useState<Feedback[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [content, setContent] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [page, setPage] = useState(1);
    const [pagination, setPagination] = useState({ total: 0, totalPages: 1 });

    useEffect(() => {
        if (isOpen) {
            loadFeedbacks(page);
            setActiveTab(initialTab);
        }
    }, [isOpen, refreshTrigger, initialTab, page]);

    const loadFeedbacks = async (pageToLoad: number) => {
        setIsLoading(true);
        try {
            const data = await feedbackService.getMyFeedback(pageToLoad, 5);
            setFeedbacks(data.feedbacks);
            setPagination({ total: data.total, totalPages: data.totalPages });
        } catch (error) {
            console.error('Failed to load feedback:', error);
        } finally {
            setIsLoading(false);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!content.trim()) return;

        setIsSubmitting(true);
        try {
            await feedbackService.create(content.trim());
            toast.success(t('feedback.submitSuccess'));
            setContent('');
            onFeedbackSent();
            setActiveTab('history'); // Switch to history after sending
            loadFeedbacks(page);
        } catch (error) {
            console.error('Failed to submit feedback:', error);
            toast.error(t('feedback.submitFailed'));
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="sm:max-w-[550px] w-[95vw] max-h-[90vh] border-4 border-black shadow-nb flex flex-col p-0 gap-0 overflow-hidden bg-white">
                <DialogHeader className="border-b-4 border-black p-6 bg-[hsl(var(--secondary))] shrink-0">
                    <DialogTitle className="text-2xl font-black uppercase flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <MessageSquare className="w-6 h-6" />
                            {t('feedback.title')}
                        </div>
                    </DialogTitle>
                    <div className="flex gap-2 mt-4">
                        <Button
                            variant="outline"
                            onClick={() => setActiveTab('history')}
                            className={`flex-1 border-2 border-black font-bold uppercase transition-all ${activeTab === 'history'
                                ? 'bg-[hsl(var(--primary))] text-black'
                                : 'bg-white text-black hover:bg-gray-50'
                                }`}
                        >
                            <List className="w-4 h-4 mr-2" />
                            {t('feedback.history')}
                        </Button>
                        <Button
                            variant="outline"
                            onClick={() => setActiveTab('new')}
                            className={`flex-1 border-2 border-black font-bold uppercase transition-all ${activeTab === 'new'
                                ? 'bg-[hsl(var(--primary))] text-black'
                                : 'bg-white text-black hover:bg-gray-50'
                                }`}
                        >
                            <Plus className="w-4 h-4 mr-2" />
                            {t('feedback.new')}
                        </Button>
                    </div>
                </DialogHeader>

                <div className="flex-1 min-h-0 overflow-hidden relative bg-white flex flex-col">
                    {activeTab === 'history' ? (
                        <div className="flex flex-col flex-1 min-h-0">
                            <div className="flex-1 w-full min-h-0 overflow-y-auto">
                                <div className="p-6">
                                    {isLoading ? (
                                        <div className="flex justify-center py-8">
                                            <Loader2 className="w-8 h-8 animate-spin" />
                                        </div>
                                    ) : feedbacks.length === 0 ? (
                                        <div className="text-center py-12">
                                            <div className="w-16 h-16 bg-gray-100 rounded-none flex items-center justify-center mx-auto mb-4 border-2 border-black">
                                                <MessageSquare className="w-8 h-8 text-gray-400" />
                                            </div>
                                            <p className="text-gray-500 font-medium italic">{t('feedback.noHistory')}</p>
                                            <Button
                                                variant="link"
                                                onClick={() => setActiveTab('new')}
                                                className="mt-2 text-[hsl(var(--primary))] font-bold uppercase underline"
                                            >
                                                {t('feedback.createFirst')}
                                            </Button>
                                        </div>
                                    ) : (
                                        <div className="space-y-6">
                                            {feedbacks.map((item) => (
                                                <div key={item._id} className="border-2 border-black p-4 bg-white shadow-nb-sm">
                                                    <div className="flex justify-between items-start mb-3">
                                                        <Badge className={`uppercase font-bold border border-black ${item.isReplied ? 'bg-green-400 text-black' : 'bg-gray-200 text-black'}`}>
                                                            {item.isReplied ? t('feedback.status.replied') : t('feedback.status.pending')}
                                                        </Badge>
                                                        <span className="text-[10px] font-bold opacity-50 uppercase">
                                                            {format(new Date(item.createdAt), 'MMM dd, yyyy')}
                                                        </span>
                                                    </div>
                                                    <div className="flex gap-3 mb-4">
                                                        <div className="w-8 h-8 rounded-none border-2 border-black bg-gray-100 flex items-center justify-center shrink-0">
                                                            <User className="w-4 h-4" />
                                                        </div>
                                                        <div className="bg-gray-50 p-3 border-2 border-black flex-1">
                                                            <p className="text-sm font-bold leading-relaxed">{item.content}</p>
                                                        </div>
                                                    </div>
                                                    {item.reply && (
                                                        <div className="flex gap-3 pl-8">
                                                            <div className="w-8 h-8 rounded-none border-2 border-black bg-[hsl(var(--primary))] flex items-center justify-center shrink-0">
                                                                <ShieldCheck className="w-4 h-4" />
                                                            </div>
                                                            <div className="bg-[hsl(var(--primary)/0.1)] p-3 border-2 border-black flex-1">
                                                                <p className="text-[10px] font-black text-black mb-1 uppercase tracking-wider">Admin Reply</p>
                                                                <p className="text-sm font-bold leading-relaxed">{item.reply}</p>
                                                            </div>
                                                        </div>
                                                    )}
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Pagination Controls - Fixed at bottom */}
                            {feedbacks.length > 0 && (
                                <div className="flex items-center justify-between p-4 border-t-4 border-black bg-white shrink-0 z-10">
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => setPage(p => Math.max(1, p - 1))}
                                        disabled={page === 1}
                                        className="border-2 border-black font-bold uppercase text-[10px] h-8 shadow-nb-sm hover:translate-y-0.5 hover:shadow-none transition-all"
                                    >
                                        {t('common.previous')}
                                    </Button>
                                    <span className="text-[10px] font-black uppercase">
                                        {page} / {pagination.totalPages}
                                    </span>
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => setPage(p => Math.min(pagination.totalPages, p + 1))}
                                        disabled={page === pagination.totalPages}
                                        className="border-2 border-black font-bold uppercase text-[10px] h-8 shadow-nb-sm hover:translate-y-0.5 hover:shadow-none transition-all"
                                    >
                                        {t('common.next')}
                                    </Button>
                                </div>
                            )}
                        </div>
                    ) : (
                        <div className="flex flex-col flex-1 min-h-0">
                            <div className="flex-1 w-full min-h-0 overflow-y-auto">
                                <form id="feedback-form" onSubmit={handleSubmit} className="p-6 min-h-full flex flex-col gap-4">
                                    <div className="space-y-2 flex-1">
                                        <label className="text-sm font-bold uppercase tracking-wide">{t('feedback.message')}</label>
                                        <Textarea
                                            placeholder={t('feedback.placeholder')}
                                            value={content}
                                            onChange={(e) => setContent(e.target.value)}
                                            className="border-2 border-black resize-none h-full min-h-[150px] p-4 text-base focus-visible:ring-black"
                                            required
                                        />
                                        <p className="text-xs text-gray-500 text-right">{content.length} characters</p>
                                    </div>
                                </form>
                            </div>

                            {/* Sticky Footer for New Feedback */}
                            <div className="flex justify-end gap-3 p-4 border-t-4 border-black bg-white shrink-0 z-10">
                                <Button
                                    type="button"
                                    variant="outline"
                                    onClick={() => setActiveTab('history')}
                                    disabled={isSubmitting}
                                    className="border-2 border-black font-bold uppercase"
                                >
                                    {t('common.cancel')}
                                </Button>
                                <Button
                                    type="submit"
                                    form="feedback-form"
                                    disabled={isSubmitting || !content.trim()}
                                    className="border-2 border-black shadow-nb-sm font-black uppercase bg-[hsl(var(--primary))] text-black hover:translate-y-0.5 hover:shadow-none transition-all px-8"
                                >
                                    {isSubmitting ? (
                                        <Loader2 className="w-4 h-4 animate-spin mr-2" />
                                    ) : (
                                        <Send className="w-4 h-4 mr-2" />
                                    )}
                                    {t('feedback.send')}
                                </Button>
                            </div>
                        </div>
                    )}
                </div>
            </DialogContent>
        </Dialog>
    );
}
