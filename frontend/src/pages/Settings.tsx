import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Settings as SettingsIcon, Share2, Mail, ChevronLeft, Loader2, Trash2, User } from 'lucide-react';
import { Link } from 'react-router-dom';
import { fileService } from '@/services';
import { toast } from 'sonner';

export default function Settings() {
    const { t } = useTranslation();
    const [shareEmail, setShareEmail] = useState('');
    const [isSharing, setIsSharing] = useState(false);
    const [permissions, setPermissions] = useState<any[]>([]);
    const [isLoadingPermissions, setIsLoadingPermissions] = useState(false);
    const [deletingPermissionId, setDeletingPermissionId] = useState<string | null>(null);

    const fetchPermissions = async () => {
        setIsLoadingPermissions(true);
        try {
            const data = await fileService.getRootFolderPermissions();
            setPermissions(data);
        } catch (error) {
            console.error('Failed to fetch permissions:', error);
            // Don't show error toast on initial load to avoid clutter, just log it
        } finally {
            setIsLoadingPermissions(false);
        }
    };

    useEffect(() => {
        fetchPermissions();
    }, []);

    const handleShare = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!shareEmail.trim()) return;

        setIsSharing(true);
        const toastId = toast.loading('Đang chia sẻ thư mục...');
        try {
            await fileService.shareRootFolder(shareEmail.trim());
            toast.success(`Đã chia sẻ thành công với ${shareEmail}`, { id: toastId });
            setShareEmail('');
            fetchPermissions();
        } catch (error: any) {
            console.error('Share failed:', error);
            toast.error(error.message || 'Chia sẻ thất bại. Vui lòng kiểm tra lại email.', { id: toastId });
        } finally {
            setIsSharing(false);
        }
    };

    const handleRemovePermission = async (permissionId: string, email: string) => {
        // In a real app, maybe use a custom modal. For now, window.confirm is fine or just rely on the undo capability?
        // Actually, let's just do it directly with a loading state on the button
        setDeletingPermissionId(permissionId);
        const toastId = toast.loading(`Đang xóa quyền của ${email}...`);
        try {
            await fileService.removeRootFolderPermission(permissionId);
            toast.success(`Đã xóa quyền của ${email}`, { id: toastId });
            await fetchPermissions();
        } catch (error: any) {
            console.error('Remove permission failed:', error);
            toast.error(error.message || 'Xóa quyền thất bại', { id: toastId });
        } finally {
            setDeletingPermissionId(null);
        }
    };

    return (
        <div className="min-h-screen bg-[#f0f0f0] font-bold">
            <header className="border-b-4 border-black bg-white sticky top-0 z-10">
                <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <Link to="/dashboard">
                            <Button variant="outline" size="icon" className="bg-white border-2 border-black shadow-nb-sm">
                                <ChevronLeft className="w-5 h-5" />
                            </Button>
                        </Link>
                        <div className="w-10 h-10 sm:w-12 sm:h-12 bg-[hsl(var(--primary))] border-2 border-black flex items-center justify-center shadow-nb-sm shrink-0">
                            <SettingsIcon className="w-5 h-5 sm:w-6 sm:h-6 text-black" />
                        </div>
                        <div>
                            <h1 className="font-black text-lg sm:text-2xl uppercase tracking-tighter">{t('dashboard.settings.title')}</h1>
                        </div>
                    </div>
                </div>
            </header>

            <main className="max-w-3xl mx-auto px-4 py-8">
                <Card className="bg-white shadow-nb border-4 border-black">
                    <CardHeader className="border-b-4 border-black bg-[hsl(var(--primary))]">
                        <CardTitle className="text-xl font-black uppercase flex items-center gap-2">
                            <Share2 className="w-5 h-5" />
                            {t('dashboard.settings.share.title')}
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="p-8">
                        <div className="space-y-6">
                            <div className="bg-blue-50 border-2 border-blue-200 p-4 font-medium text-blue-800 text-sm">
                                <p><strong>{t('dashboard.settings.share.note')}:</strong> {t('dashboard.settings.share.description')}</p>
                                <p className="mt-2 text-xs opacity-80">{t('dashboard.settings.share.details')}</p>
                            </div>

                            <form onSubmit={handleShare} className="space-y-4">
                                <div className="space-y-2">
                                    <label className="text-sm font-black uppercase flex items-center gap-2">
                                        <Mail className="w-4 h-4" />
                                        {t('dashboard.settings.share.emailLabel')}
                                    </label>
                                    <div className="flex flex-col sm:flex-row gap-3">
                                        <input
                                            type="email"
                                            value={shareEmail}
                                            onChange={(e) => setShareEmail(e.target.value)}
                                            placeholder="example@gmail.com"
                                            className="flex-grow p-4 border-4 border-black shadow-nb-sm focus:outline-none focus:ring-2 focus:ring-[hsl(var(--primary))] font-bold"
                                            required
                                            disabled={isSharing}
                                        />
                                        <Button
                                            type="submit"
                                            disabled={isSharing}
                                            className="bg-[hsl(var(--secondary))] border-4 border-black h-auto py-4 px-8 shadow-nb font-black uppercase text-black hover:bg-[hsl(var(--secondary)/0.8)] disabled:opacity-50"
                                        >
                                            {isSharing ? (
                                                <Loader2 className="w-5 h-5 animate-spin" />
                                            ) : (
                                                t('dashboard.settings.share.submit')
                                            )}
                                        </Button>
                                    </div>
                                </div>
                            </form>
                        </div>

                        <div className="mt-8 pt-8 border-t-4 border-black">
                            <h3 className="font-black uppercase text-lg mb-4 flex items-center gap-2">
                                <User className="w-5 h-5" />
                                {t('dashboard.settings.share.sharedList')}
                            </h3>

                            {isLoadingPermissions ? (
                                <div className="flex justify-center py-4">
                                    <Loader2 className="w-6 h-6 animate-spin" />
                                </div>
                            ) : permissions.length === 0 ? (
                                <p className="text-gray-500 italic text-sm">{t('dashboard.settings.share.noShares')}</p>
                            ) : (
                                <div className="space-y-3">
                                    {permissions.map((perm) => (
                                        <div key={perm.id} className="flex items-center justify-between p-3 border-2 border-black bg-white shadow-nb-sm">
                                            <div className="flex flex-col">
                                                <span className="font-bold text-sm">{perm.displayName || perm.emailAddress}</span>
                                                <span className="text-xs text-gray-500">{perm.emailAddress} • <span className="uppercase font-black bg-gray-200 px-1 text-[10px]">{perm.role}</span></span>
                                            </div>

                                            {perm.role !== 'owner' && (
                                                <Button
                                                    variant="outline"
                                                    size="icon"
                                                    onClick={() => handleRemovePermission(perm.id, perm.displayName || perm.emailAddress)}
                                                    disabled={deletingPermissionId === perm.id}
                                                    className="w-8 h-8 hover:bg-[hsl(var(--destructive))] hover:text-white border-2 border-black shadow-nb-sm"
                                                    title={t('dashboard.settings.share.remove')}
                                                >
                                                    {deletingPermissionId === perm.id ? (
                                                        <Loader2 className="w-4 h-4 animate-spin" />
                                                    ) : (
                                                        <Trash2 className="w-4 h-4" />
                                                    )}
                                                </Button>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </CardContent>
                </Card>
            </main>
        </div>
    );
}
