import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/contexts/AuthContext';
import { adminService, feedbackService, type SystemStats, type User, type Feedback } from '@/services';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { formatBytes } from '@/lib/utils';
import {
    Cloud,
    Users,
    HardDrive,
    FileIcon,
    Loader2,
    Search,
    UserCheck,
    UserX,
    ChevronLeft,
    ChevronRight,
    Share2,
    Trash2,
    MessageSquare,
    Reply,
} from 'lucide-react';
import { format } from 'date-fns';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { UserMenu } from '@/components/UserMenu';
import { FeedbackUnifiedModal } from '@/components/FeedbackUnifiedModal';

const QUOTA_OPTIONS = [
    { label: '1 GB', value: 1073741824 },
    { label: '5 GB', value: 5368709120 },
    { label: '10 GB', value: 10737418240 },
    { label: '50 GB', value: 53687091200 },
    { label: '100 GB', value: 107374182400 },
];

export default function AdminPage() {
    const { t } = useTranslation();
    const { user: currentUser, logout } = useAuth();
    const [users, setUsers] = useState<User[]>([]);
    const [stats, setStats] = useState<SystemStats | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [page, setPage] = useState(1);
    const [pagination, setPagination] = useState({ total: 0, totalPages: 1 });
    const [updatingId, setUpdatingId] = useState<string | null>(null);
    const [permissions, setPermissions] = useState<any[]>([]);
    const [permissionPage, setPermissionPage] = useState(1);
    const [permissionPagination, setPermissionPagination] = useState({ total: 0, totalPages: 1 });
    const [deletingPermissionId, setDeletingPermissionId] = useState<string | null>(null);
    const [feedbacks, setFeedbacks] = useState<Feedback[]>([]);
    const [replyingId, setReplyingId] = useState<string | null>(null);
    const [feedbackPage, setFeedbackPage] = useState(1);
    const [feedbackPagination, setFeedbackPagination] = useState({ total: 0, totalPages: 1 });
    const [replyContent, setReplyContent] = useState('');

    const [hasUnreadFeedback, setHasUnreadFeedback] = useState(false);
    const [isFeedbackOpen, setIsFeedbackOpen] = useState(false);
    const [feedbackRefreshTrigger, setFeedbackRefreshTrigger] = useState(0);

    const checkFeedbackStatus = useCallback(async () => {
        try {
            const data = await feedbackService.getMyFeedback(1, 100);
            const lastChecked = localStorage.getItem('lastCheckedFeedback');
            const hasNewReplies = data.feedbacks.some((f: Feedback) =>
                f.isReplied && (!lastChecked || new Date(f.updatedAt) > new Date(lastChecked))
            );
            setHasUnreadFeedback(hasNewReplies);
        } catch (error) {
            console.error('Failed to check feedback:', error);
        }
    }, []);

    useEffect(() => {
        checkFeedbackStatus();
    }, [checkFeedbackStatus, feedbackRefreshTrigger]);

    const handleOpenFeedback = () => {
        setIsFeedbackOpen(true);
        localStorage.setItem('lastCheckedFeedback', new Date().toISOString());
        setHasUnreadFeedback(false);
    };

    const loadData = useCallback(async () => {
        setIsLoading(true);
        try {
            const [usersData, statsData, permissionsData] = await Promise.all([
                adminService.getUsers(page, 10, search),
                adminService.getSystemStats(),
                adminService.getAllSharedPermissions(permissionPage, 10),
            ]);
            setUsers(usersData.users);
            setPagination(usersData.pagination);
            setStats(statsData);
            setPermissions(permissionsData.permissions);
            setPermissionPagination({ total: permissionsData.total, totalPages: permissionsData.totalPages });

            // Fetch feedbacks
            const feedbackData = await feedbackService.getAllFeedback(feedbackPage, 10);
            setFeedbacks(feedbackData.feedbacks);
            setFeedbackPagination({ total: feedbackData.total, totalPages: feedbackData.totalPages });
        } catch (error) {
            console.error('Failed to load data:', error);
        } finally {
            setIsLoading(false);
        }
    }, [page, search, feedbackPage, permissionPage]);

    useEffect(() => {
        loadData();
    }, [loadData]);

    const handleLogout = () => {
        logout();
    };

    const handleSearch = (e: React.FormEvent) => {
        e.preventDefault();
        setPage(1);
        loadData();
    };

    const handleStatusChange = async (userId: string, newStatus: 'ACTIVE' | 'INACTIVE') => {
        if (userId === currentUser?.id) {
            alert(t('admin.users.actions.cannotLockSelf'));
            return;
        }
        setUpdatingId(userId);
        try {
            await adminService.updateUserStatus(userId, newStatus);
            await loadData();
        } catch (error) {
            console.error('Failed to update status:', error);
            alert(t('admin.users.actions.updateFailed'));
        } finally {
            setUpdatingId(null);
        }
    };

    const handleQuotaChange = async (userId: string, newQuota: number) => {
        setUpdatingId(userId);
        try {
            await adminService.updateUserQuota(userId, newQuota);
            await loadData();
        } catch (error: unknown) {
            const err = error as { response?: { data?: { message?: string } } };
            alert(err.response?.data?.message || t('admin.users.actions.updateFailed'));
        } finally {
            setUpdatingId(null);
        }
    };

    const handleRemovePermission = async (ownerId: string, permissionId: string, email: string) => {
        setDeletingPermissionId(permissionId);
        const toastId = toast.loading(`Removing access for ${email}...`);
        try {
            await adminService.removeSharedPermission(ownerId, permissionId);
            toast.success(`Access removed for ${email}`, { id: toastId });
            // Refresh permissions
            const permissionsData = await adminService.getAllSharedPermissions(permissionPage, 10);
            setPermissions(permissionsData.permissions);
            setPermissionPagination({ total: permissionsData.total, totalPages: permissionsData.totalPages });
        } catch (error: any) {
            console.error('Failed to remove permission:', error);
            toast.error(error.message || 'Failed to remove permission', { id: toastId });
        } finally {
            setDeletingPermissionId(null);
        }
    };

    const handleReplyFeedback = async (feedbackId: string) => {
        if (!replyContent.trim()) return;

        setUpdatingId(feedbackId);
        const toastId = toast.loading('Sending reply...');

        try {
            await feedbackService.reply(feedbackId, replyContent.trim());
            toast.success('Reply sent successfully', { id: toastId });
            setReplyContent('');
            setReplyingId(null);

            // Refresh feedbacks
            const updatedFeedbacks = await feedbackService.getAllFeedback(feedbackPage, 10);
            setFeedbacks(updatedFeedbacks.feedbacks);
            setFeedbackPagination({ total: updatedFeedbacks.total, totalPages: updatedFeedbacks.totalPages });
        } catch (error) {
            console.error('Failed to reply:', error);
            toast.error('Failed to send reply', { id: toastId });
        } finally {
            setUpdatingId(null);
        }
    };

    if (currentUser?.role !== 'ADMIN') {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <p className="text-[hsl(var(--muted-foreground))]">{t('admin.noAccess')}</p>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-[#f0f0f0] font-bold">
            {/* Header */}
            <header className="border-b-4 border-black bg-white sticky top-0 z-10">
                <div className="max-w-7xl mx-auto px-4 py-4 flex flex-col sm:flex-row items-center sm:items-center justify-between gap-4">
                    <div className="flex items-center gap-4 w-full sm:w-auto">
                        <div className="w-10 h-10 sm:w-12 sm:h-12 bg-[hsl(var(--primary))] border-2 border-black flex items-center justify-center shadow-nb-sm shrink-0">
                            <Cloud className="w-5 h-5 sm:w-6 sm:h-6 text-black" />
                        </div>
                        <div className="min-w-0">
                            <h1 className="font-black text-lg sm:text-2xl uppercase tracking-tighter truncate">{t('admin.panel')}</h1>
                            <p className="text-[10px] sm:text-sm text-black font-medium truncate opacity-60">{t('admin.subtitle')}</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
                        <UserMenu
                            user={currentUser}
                            onLogout={handleLogout}
                            onOpenFeedback={handleOpenFeedback}
                            hasUnreadFeedback={hasUnreadFeedback}
                        />
                    </div>
                </div>
            </header>

            <FeedbackUnifiedModal
                isOpen={isFeedbackOpen}
                onClose={() => setIsFeedbackOpen(false)}
                refreshTrigger={feedbackRefreshTrigger}
                onFeedbackSent={() => setFeedbackRefreshTrigger(prev => prev + 1)}
            />

            <main className="max-w-7xl mx-auto px-4 py-8">
                {/* Stats */}
                {stats && (
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
                        <Card className="bg-[hsl(var(--primary))]">
                            <CardHeader className="pb-2">
                                <CardTitle className="text-xs font-black uppercase tracking-widest text-black opacity-70">
                                    {t('admin.stats.totalUsers')}
                                </CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="flex items-center gap-3">
                                    <Users className="w-6 h-6 text-black" />
                                    <span className="text-3xl font-black tracking-tighter">{stats.users.total}</span>
                                </div>
                            </CardContent>
                        </Card>
                        <Card className="bg-[hsl(var(--success))]">
                            <CardHeader className="pb-2">
                                <CardTitle className="text-xs font-black uppercase tracking-widest text-black opacity-70">
                                    {t('admin.stats.activeUsers')}
                                </CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="flex items-center gap-3">
                                    <UserCheck className="w-6 h-6 text-black" />
                                    <span className="text-3xl font-black tracking-tighter">{stats.users.active}</span>
                                </div>
                            </CardContent>
                        </Card>
                        <Card className="bg-[hsl(var(--secondary))]">
                            <CardHeader className="pb-2">
                                <CardTitle className="text-xs font-black uppercase tracking-widest text-black opacity-70">
                                    {t('admin.stats.totalFiles')}
                                </CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="flex items-center gap-3">
                                    <FileIcon className="w-6 h-6 text-black" />
                                    <span className="text-3xl font-black tracking-tighter">{stats.files.total}</span>
                                </div>
                            </CardContent>
                        </Card>
                        <Card className="bg-[hsl(var(--accent))]">
                            <CardHeader className="pb-2">
                                <CardTitle className="text-xs font-black uppercase tracking-widest text-white opacity-90">
                                    {t('admin.stats.usedStorage')}
                                </CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="flex items-center gap-3 text-white">
                                    <HardDrive className="w-6 h-6" />
                                    <span className="text-2xl font-black tracking-tighter">{stats.storage.totalUsedFormatted}</span>
                                </div>
                            </CardContent>
                        </Card>
                    </div>
                )}

                {/* Search */}
                <Card className="mb-6 bg-white">
                    <CardContent className="pt-6">
                        <form onSubmit={handleSearch} className="flex gap-4">
                            <div className="relative flex-1">
                                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-black" />
                                <Input
                                    placeholder={t('admin.search.placeholder')}
                                    value={search}
                                    onChange={(e) => setSearch(e.target.value)}
                                    className="pl-12 h-12 bg-white border-2 border-black shadow-nb-sm"
                                />
                            </div>
                            <Button type="submit" className="h-12 px-8 shadow-nb-sm">{t('admin.search.submit')}</Button>
                        </form>
                    </CardContent>
                </Card>

                {/* Users Table */}
                <Card className="bg-white">
                    <CardHeader className="border-b-2 border-black">
                        <CardTitle className="text-2xl font-black uppercase">{t('admin.users.title')}</CardTitle>
                    </CardHeader>
                    <CardContent className="pt-6">
                        {isLoading ? (
                            <div className="flex items-center justify-center py-20">
                                <Loader2 className="w-12 h-12 animate-spin text-black" />
                            </div>
                        ) : (
                            <>
                                <div className="overflow-x-auto border-2 border-black mb-6">
                                    <table className="w-full">
                                        <thead>
                                            <tr className="bg-black text-white px-4">
                                                <th className="text-left py-4 px-4 font-black uppercase tracking-wider text-xs">{t('admin.users.table.user')}</th>
                                                <th className="text-left py-4 px-4 font-black uppercase tracking-wider text-xs">{t('admin.users.table.role')}</th>
                                                <th className="text-left py-4 px-4 font-black uppercase tracking-wider text-xs">{t('admin.users.table.status')}</th>
                                                <th className="text-left py-4 px-4 font-black uppercase tracking-wider text-xs">{t('admin.users.table.storage')}</th>
                                                <th className="text-left py-4 px-4 font-black uppercase tracking-wider text-xs">{t('admin.users.table.quota')}</th>
                                                <th className="text-left py-4 px-4 font-black uppercase tracking-wider text-xs">{t('admin.users.table.actions')}</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y-2 divide-black">
                                            {users.map((user) => (
                                                <tr
                                                    key={user.id}
                                                    className="hover:bg-[hsl(var(--primary)/0.05)] transition-colors"
                                                >
                                                    <td className="py-4 px-4">
                                                        <div>
                                                            <p className="font-black uppercase tracking-tight">{user.name}</p>
                                                            <p className="text-sm font-bold opacity-60">{user.email}</p>
                                                        </div>
                                                    </td>
                                                    <td className="py-4 px-4">
                                                        <span
                                                            className={`px-3 py-1 border-2 border-black font-black text-xs ${user.role === 'ADMIN'
                                                                ? 'bg-[hsl(var(--primary))] text-black'
                                                                : 'bg-white text-black'
                                                                }`}
                                                        >
                                                            {user.role}
                                                        </span>
                                                    </td>
                                                    <td className="py-4 px-4">
                                                        <span
                                                            className={`px-3 py-1 border-2 border-black font-black text-xs ${user.status === 'ACTIVE'
                                                                ? 'bg-[hsl(var(--success))] text-black'
                                                                : 'bg-[hsl(var(--destructive))] text-white'
                                                                }`}
                                                        >
                                                            {user.status}
                                                        </span>
                                                    </td>
                                                    <td className="py-4 px-4">
                                                        <div className="w-full space-y-1.5 min-w-[140px]">
                                                            <div className="flex justify-between text-[10px] font-black uppercase tracking-tight">
                                                                <span className="text-black">{formatBytes(user.usedStorage)}</span>
                                                                <span className="opacity-40">{formatBytes(user.maxStorage)}</span>
                                                            </div>
                                                            <div className="h-2 w-full border-2 border-black bg-white overflow-hidden p-[1px]">
                                                                <div
                                                                    className={`h-full transition-all duration-500 ${(user.usedStorage / user.maxStorage) > 0.9 ? 'bg-[hsl(var(--destructive))]' :
                                                                        (user.usedStorage / user.maxStorage) > 0.7 ? 'bg-[hsl(var(--warning))] font-black' :
                                                                            'bg-[hsl(var(--primary))]'
                                                                        }`}
                                                                    style={{ width: `${Math.min((user.usedStorage / user.maxStorage) * 100, 100)}%` }}
                                                                />
                                                            </div>
                                                        </div>
                                                    </td>
                                                    <td className="py-4 px-4">
                                                        <select
                                                            value={user.maxStorage}
                                                            onChange={(e) => handleQuotaChange(user.id, Number(e.target.value))}
                                                            disabled={updatingId === user.id}
                                                            className="border-2 border-black bg-white px-2 py-1 text-sm font-black shadow-nb-sm focus:outline-none"
                                                        >
                                                            {QUOTA_OPTIONS.map((option) => (
                                                                <option key={option.value} value={option.value}>
                                                                    {option.label}
                                                                </option>
                                                            ))}
                                                        </select>
                                                    </td>
                                                    <td className="py-4 px-4">
                                                        {updatingId === user.id ? (
                                                            <Loader2 className="w-5 h-5 animate-spin text-black" />
                                                        ) : (
                                                            <Button
                                                                variant={user.status === 'ACTIVE' ? 'destructive' : 'success'}
                                                                size="sm"
                                                                onClick={() =>
                                                                    handleStatusChange(
                                                                        user.id,
                                                                        user.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE'
                                                                    )
                                                                }
                                                                disabled={user.id === currentUser?.id}
                                                                className="font-black uppercase tracking-tighter"
                                                            >
                                                                {user.status === 'ACTIVE' ? (
                                                                    <>
                                                                        <UserX className="w-4 h-4 mr-2" />
                                                                        {t('admin.users.actions.lock')}
                                                                    </>
                                                                ) : (
                                                                    <>
                                                                        <UserCheck className="w-4 h-4 mr-2" />
                                                                        {t('admin.users.actions.unlock')}
                                                                    </>
                                                                )}
                                                            </Button>
                                                        )}
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>

                                {/* Pagination */}
                                <div className="flex items-center justify-between mt-8 pt-6 border-t-2 border-black">
                                    <p className="text-sm font-black uppercase tracking-tight">
                                        {t('admin.users.pagination', { count: users.length, total: pagination.total })}
                                    </p>
                                    <div className="flex items-center gap-4">
                                        <Button
                                            variant="outline"
                                            size="icon"
                                            onClick={() => setPage((p) => Math.max(1, p - 1))}
                                            disabled={page === 1}
                                            className="bg-white"
                                        >
                                            <ChevronLeft className="w-5 h-5" />
                                        </Button>
                                        <span className="text-sm font-black uppercase">
                                            {t('admin.users.page', { current: page, total: pagination.totalPages })}
                                        </span>
                                        <Button
                                            variant="outline"
                                            size="icon"
                                            onClick={() => setPage((p) => Math.min(pagination.totalPages, p + 1))}
                                            disabled={page === pagination.totalPages}
                                            className="bg-white"
                                        >
                                            <ChevronRight className="w-5 h-5" />
                                        </Button>
                                    </div>
                                </div>
                            </>
                        )}
                    </CardContent>
                </Card>

                {/* Shared Access Management */}
                <Card className="bg-white mt-8 border-4 border-black shadow-nb">
                    <CardHeader className="border-b-4 border-black bg-[hsl(var(--warning))]">
                        <CardTitle className="text-xl font-black uppercase flex items-center gap-2 text-black">
                            <Share2 className="w-5 h-5" />
                            {t('admin.permissions.title')}
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="pt-6">
                        {isLoading ? (
                            <div className="flex items-center justify-center py-10">
                                <Loader2 className="w-8 h-8 animate-spin text-black" />
                            </div>
                        ) : (
                            <>
                                {permissions.length === 0 ? (
                                    <p className="text-gray-500 italic text-center py-8 font-medium">{t('admin.permissions.noShares')}</p>
                                ) : (
                                    <div className="overflow-x-auto border-2 border-black">
                                        <table className="w-full">
                                            <thead>
                                                <tr className="bg-black text-white">
                                                    <th className="text-left py-3 px-4 font-black uppercase tracking-wider text-xs">{t('admin.permissions.table.owner')}</th>
                                                    <th className="text-left py-3 px-4 font-black uppercase tracking-wider text-xs">{t('admin.permissions.table.sharedWith')}</th>
                                                    <th className="text-left py-3 px-4 font-black uppercase tracking-wider text-xs">{t('admin.permissions.table.role')}</th>
                                                    <th className="text-left py-3 px-4 font-black uppercase tracking-wider text-xs">{t('admin.permissions.table.actions')}</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y-2 divide-black bg-white">
                                                {permissions.map((perm) => (
                                                    <tr key={`${perm.owner.id}-${perm.permissionId}`} className="hover:bg-gray-50 transition-colors">
                                                        <td className="py-3 px-4">
                                                            <div>
                                                                <p className="font-bold text-sm">{perm.owner.name}</p>
                                                                <p className="text-xs opacity-60">{perm.owner.email}</p>
                                                            </div>
                                                        </td>
                                                        <td className="py-3 px-4">
                                                            <div className="flex items-center gap-2">
                                                                <div className="w-6 h-6 rounded-full bg-blue-100 flex items-center justify-center border-2 border-black shadow-nb-sm">
                                                                    <span className="text-[10px] font-black text-blue-700">
                                                                        {(perm.email || '?')[0].toUpperCase()}
                                                                    </span>
                                                                </div>
                                                                <span className="font-bold text-sm">{perm.email}</span>
                                                            </div>
                                                        </td>
                                                        <td className="py-3 px-4">
                                                            <span className="inline-flex items-center px-2 py-0.5 border-2 border-black text-xs font-black uppercase bg-gray-100 shadow-nb-sm">
                                                                {perm.role}
                                                            </span>
                                                        </td>
                                                        <td className="py-3 px-4">
                                                            <Button
                                                                variant="destructive"
                                                                size="sm"
                                                                onClick={() => handleRemovePermission(perm.owner.id, perm.permissionId, perm.email)}
                                                                disabled={deletingPermissionId === perm.permissionId}
                                                                className="h-8 w-8 p-0 border-2 border-black shadow-nb-sm"
                                                                title={t('admin.permissions.actions.remove')}
                                                            >
                                                                {deletingPermissionId === perm.permissionId ? (
                                                                    <Loader2 className="w-4 h-4 animate-spin" />
                                                                ) : (
                                                                    <Trash2 className="w-4 h-4" />
                                                                )}
                                                            </Button>
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                )}

                                {/* Permissions Pagination */}
                                {permissions.length > 0 && (
                                    <div className="flex items-center justify-between p-4 border-t-2 border-black mt-4">
                                        <p className="text-sm font-black uppercase tracking-tight">
                                            {t('admin.permissions.pagination', { count: permissions.length, total: permissionPagination.total })}
                                        </p>
                                        <div className="flex items-center gap-4">
                                            <Button
                                                variant="outline"
                                                size="icon"
                                                onClick={() => setPermissionPage((p) => Math.max(1, p - 1))}
                                                disabled={permissionPage === 1}
                                                className="bg-white border-2 border-black h-8 w-8"
                                            >
                                                <ChevronLeft className="w-4 h-4" />
                                            </Button>
                                            <span className="text-sm font-black uppercase">
                                                {permissionPage} / {permissionPagination.totalPages}
                                            </span>
                                            <Button
                                                variant="outline"
                                                size="icon"
                                                onClick={() => setPermissionPage((p) => Math.min(permissionPagination.totalPages, p + 1))}
                                                disabled={permissionPage === permissionPagination.totalPages}
                                                className="bg-white border-2 border-black h-8 w-8"
                                            >
                                                <ChevronRight className="w-4 h-4" />
                                            </Button>
                                        </div>
                                    </div>
                                )}
                            </>
                        )}
                    </CardContent>
                </Card>

                {/* Feedback Management */}
                <Card className="bg-white mt-8 border-4 border-black shadow-nb">
                    <CardHeader className="bg-[hsl(var(--secondary))] border-b-4 border-black pb-4">
                        <CardTitle className="text-xl font-black uppercase flex items-center gap-2">
                            <MessageSquare className="w-5 h-5" />
                            {t('admin.feedback.title')}
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="p-0">
                        {feedbacks.length === 0 ? (
                            <div className="p-8 text-center text-gray-500 italic">
                                {t('admin.feedback.noFeedback')}
                            </div>
                        ) : (
                            <div className="divide-y-2 divide-gray-100">
                                {feedbacks.map((item) => (
                                    <div key={item._id} className="p-4 hover:bg-gray-50 transition-colors">
                                        <div className="flex justify-between items-start mb-2">
                                            <div className="flex items-center gap-2">
                                                <span className="font-black text-[10px] uppercase bg-blue-100 px-2 py-0.5 border-2 border-black shadow-nb-sm">
                                                    {item.user?.email || 'Unknown User'}
                                                </span>
                                                <span className="text-[10px] font-bold opacity-60 uppercase">
                                                    {format(new Date(item.createdAt), 'PPP p')}
                                                </span>
                                            </div>
                                            <div className={`text-[10px] font-black uppercase px-2 py-0.5 border-2 border-black shadow-nb-sm ${item.isReplied
                                                ? 'bg-[hsl(var(--success))] text-black'
                                                : 'bg-[hsl(var(--warning))] text-black'
                                                }`}>
                                                {item.isReplied ? t('feedback.status.replied') : t('feedback.status.pending')}
                                            </div>
                                        </div>

                                        <p className="text-sm mb-3 font-bold text-black bg-gray-50 p-2 border-2 border-black shadow-nb-sm">
                                            {item.content}
                                        </p>

                                        {item.isReplied ? (
                                            <div className="pl-4 border-l-4 border-black ml-1">
                                                <p className="text-[10px] font-black text-black uppercase mb-1 opacity-60">
                                                    {t('admin.feedback.yourReply')}
                                                </p>
                                                <p className="text-sm font-bold text-black">{item.reply}</p>
                                            </div>
                                        ) : (
                                            <div className="mt-2">
                                                {replyingId === item._id ? (
                                                    <div className="space-y-2">
                                                        <Textarea
                                                            value={replyContent}
                                                            onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setReplyContent(e.target.value)}
                                                            placeholder={t('admin.feedback.replyPlaceholder')}
                                                            className="min-h-[80px] border-2 border-black shadow-nb-sm"
                                                        />
                                                        <div className="flex gap-2 justify-end">
                                                            <Button
                                                                variant="outline"
                                                                size="sm"
                                                                onClick={() => {
                                                                    setReplyingId(null);
                                                                    setReplyContent('');
                                                                }}
                                                                className="h-8 text-[10px] font-black uppercase bg-white border-2 border-black shadow-nb-sm"
                                                            >
                                                                {t('common.cancel')}
                                                            </Button>
                                                            <Button
                                                                size="sm"
                                                                onClick={() => handleReplyFeedback(item._id)}
                                                                disabled={!replyContent.trim() || updatingId === item._id}
                                                                className="h-8 text-[10px] font-black uppercase border-2 border-black shadow-nb-sm"
                                                            >
                                                                {updatingId === item._id ? (
                                                                    <Loader2 className="w-3 h-3 animate-spin mr-1" />
                                                                ) : (
                                                                    <Reply className="w-3 h-3 mr-1" />
                                                                )}
                                                                {t('admin.feedback.sendReply')}
                                                            </Button>
                                                        </div>
                                                    </div>
                                                ) : (
                                                    <Button
                                                        variant="outline"
                                                        size="sm"
                                                        onClick={() => {
                                                            setReplyingId(item._id);
                                                            setReplyContent('');
                                                        }}
                                                        className="text-[10px] font-black uppercase h-8 border-2 border-black shadow-nb-sm"
                                                    >
                                                        <Reply className="w-3 h-3 mr-1" />
                                                        {t('admin.feedback.reply')}
                                                    </Button>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>
                        )}

                        {/* Feedback Pagination */}
                        {feedbacks.length > 0 && (
                            <div className="flex items-center justify-between p-4 border-t-2 border-black">
                                <p className="text-sm font-black uppercase tracking-tight">
                                    {t('admin.feedback.pagination', { count: feedbacks.length, total: feedbackPagination.total })}
                                </p>
                                <div className="flex items-center gap-4">
                                    <Button
                                        variant="outline"
                                        size="icon"
                                        onClick={() => setFeedbackPage((p) => Math.max(1, p - 1))}
                                        disabled={feedbackPage === 1}
                                        className="bg-white border-2 border-black h-8 w-8"
                                    >
                                        <ChevronLeft className="w-4 h-4" />
                                    </Button>
                                    <span className="text-sm font-black uppercase">
                                        {feedbackPage} / {feedbackPagination.totalPages}
                                    </span>
                                    <Button
                                        variant="outline"
                                        size="icon"
                                        onClick={() => setFeedbackPage((p) => Math.min(feedbackPagination.totalPages, p + 1))}
                                        disabled={feedbackPage === feedbackPagination.totalPages}
                                        className="bg-white border-2 border-black h-8 w-8"
                                    >
                                        <ChevronRight className="w-4 h-4" />
                                    </Button>
                                </div>
                            </div>
                        )}
                    </CardContent>
                </Card>
            </main>
        </div >
    );
}
