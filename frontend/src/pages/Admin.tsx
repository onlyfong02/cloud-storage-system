import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/contexts/AuthContext';
import { adminService, type SystemStats, type User } from '@/services';
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
    ArrowLeft,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { LanguageSwitcher } from '@/components/LanguageSwitcher';

const QUOTA_OPTIONS = [
    { label: '1 GB', value: 1073741824 },
    { label: '5 GB', value: 5368709120 },
    { label: '10 GB', value: 10737418240 },
    { label: '50 GB', value: 53687091200 },
    { label: '100 GB', value: 107374182400 },
];

export default function AdminPage() {
    const { t } = useTranslation();
    const { user: currentUser } = useAuth();
    const [users, setUsers] = useState<User[]>([]);
    const [stats, setStats] = useState<SystemStats | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [page, setPage] = useState(1);
    const [pagination, setPagination] = useState({ total: 0, totalPages: 1 });
    const [updatingId, setUpdatingId] = useState<string | null>(null);

    const loadData = useCallback(async () => {
        setIsLoading(true);
        try {
            const [usersData, statsData] = await Promise.all([
                adminService.getUsers(page, 10, search),
                adminService.getSystemStats(),
            ]);
            setUsers(usersData.users);
            setPagination(usersData.pagination);
            setStats(statsData);
        } catch (error) {
            console.error('Failed to load data:', error);
        } finally {
            setIsLoading(false);
        }
    }, [page, search]);

    useEffect(() => {
        loadData();
    }, [loadData]);

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
                <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 bg-[hsl(var(--primary))] border-2 border-black flex items-center justify-center shadow-nb-sm">
                            <Cloud className="w-6 h-6 text-black" />
                        </div>
                        <div>
                            <h1 className="font-black text-2xl uppercase tracking-tighter text-black">{t('admin.panel')}</h1>
                            <p className="text-sm text-black font-medium">{t('admin.subtitle')}</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-3">
                        <LanguageSwitcher />
                        <Link to="/dashboard">
                            <Button variant="outline" size="sm" className="bg-white">
                                <ArrowLeft className="w-4 h-4 mr-2" />
                                {t('admin.back')}
                            </Button>
                        </Link>
                    </div>
                </div>
            </header>

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
                                    className="pl-12 h-12 bg-white border-2 border-black"
                                />
                            </div>
                            <Button type="submit" className="h-12 px-8">{t('admin.search.submit')}</Button>
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
                                                    <td className="py-4 px-4 text-sm font-bold">
                                                        {formatBytes(user.usedStorage)} / {formatBytes(user.maxStorage)}
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
            </main>
        </div>
    );
}
