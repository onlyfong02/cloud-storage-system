import { useState, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import {
    MessageSquare,
    Settings,
    LogOut,
    Languages,
    ChevronDown,
    User as UserIcon,
    ShieldCheck,
    LayoutGrid
} from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';

interface UserMenuProps {
    user: any;
    onLogout: () => void;
    onOpenFeedback: () => void;
    hasUnreadFeedback: boolean;
}

export function UserMenu({ user, onLogout, onOpenFeedback, hasUnreadFeedback }: UserMenuProps) {
    const { t, i18n } = useTranslation();
    const [isOpen, setIsOpen] = useState(false);
    const menuRef = useRef<HTMLDivElement>(null);
    const location = useLocation();
    const isAdminPage = location.pathname.startsWith('/admin');

    const toggleLanguage = (e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        const nextLang = i18n.language === 'vi' ? 'en' : 'vi';
        i18n.changeLanguage(nextLang);
    };

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    return (
        <div className="relative" ref={menuRef}>
            <div className="flex items-center border-2 border-black bg-white shadow-nb-sm h-8 sm:h-9 px-3 gap-3">
                <span className="hidden xs:inline text-[10px] font-black uppercase opacity-60 tracking-widest whitespace-nowrap border-r-2 border-black/10 pr-3 h-full flex items-center">
                    {t('dashboard.menu.label')}
                </span>
                <button
                    onClick={() => setIsOpen(!isOpen)}
                    className="flex items-center gap-2 font-black uppercase text-[10px] sm:text-xs hover:opacity-70 transition-opacity h-full"
                >
                    <UserIcon className="w-3 h-3 sm:w-4 sm:h-4 text-[hsl(var(--primary))]" />
                    <span className="truncate max-w-[80px] sm:max-w-none">
                        {user?.email?.split('@')[0]}
                    </span>
                    <ChevronDown className={`w-3 h-3 sm:w-4 h-4 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
                </button>
            </div>

            {isOpen && (
                <div className="absolute right-0 mt-2 w-56 bg-white border-4 border-black shadow-nb z-50 animate-in fade-in zoom-in-95 duration-100 overflow-hidden">
                    <div className="divide-y-2 divide-black">
                        {/* Language Toggle - Inline inside menu */}
                        <button
                            onClick={toggleLanguage}
                            className="w-full flex items-center justify-between p-3 hover:bg-[hsl(var(--primary))] transition-colors group"
                        >
                            <div className="flex items-center gap-2">
                                <Languages className="w-4 h-4" />
                                <span className="font-bold text-xs uppercase">{t('dashboard.language')}</span>
                            </div>
                            <span className="bg-black text-white text-[10px] px-1.5 py-0.5 font-black uppercase">
                                {i18n.language === 'vi' ? 'VI' : 'EN'}
                            </span>
                        </button>

                        {/* Feedback */}
                        <button
                            onClick={() => {
                                onOpenFeedback();
                                setIsOpen(false);
                            }}
                            className="w-full flex items-center justify-between p-3 hover:bg-yellow-100 transition-colors group"
                        >
                            <div className="flex items-center gap-2">
                                <MessageSquare className="w-4 h-4" />
                                <span className="font-bold text-xs uppercase">{t('feedback.title')}</span>
                            </div>
                            {hasUnreadFeedback && (
                                <span className="w-2 h-2 bg-red-500 rounded-full border border-black animate-pulse" />
                            )}
                        </button>

                        {/* Navigation Context: Admin vs Dashboard */}
                        {user?.role === 'ADMIN' && (
                            isAdminPage ? (
                                <Link
                                    to="/dashboard"
                                    className="w-full flex items-center gap-2 p-3 hover:bg-[hsl(var(--primary))] transition-colors group"
                                    onClick={() => setIsOpen(false)}
                                >
                                    <LayoutGrid className="w-4 h-4" />
                                    <span className="font-bold text-xs uppercase">{t('dashboard.menu.dashboard')}</span>
                                </Link>
                            ) : (
                                <Link
                                    to="/admin"
                                    className="w-full flex items-center gap-2 p-3 hover:bg-[hsl(var(--secondary))] transition-colors group"
                                    onClick={() => setIsOpen(false)}
                                >
                                    <ShieldCheck className="w-4 h-4" />
                                    <span className="font-bold text-xs uppercase">{t('dashboard.admin')}</span>
                                </Link>
                            )
                        )}

                        {/* Settings (for normal users) */}
                        {user?.role !== 'ADMIN' && (
                            <Link
                                to="/settings"
                                className="w-full flex items-center gap-2 p-3 hover:bg-[hsl(var(--secondary))] transition-colors group"
                                onClick={() => setIsOpen(false)}
                            >
                                <Settings className="w-4 h-4" />
                                <span className="font-bold text-xs uppercase">{t('dashboard.settings.title')}</span>
                            </Link>
                        )}

                        {/* About Me */}
                        <Link
                            to="/about"
                            className="w-full flex items-center gap-2 p-3 hover:bg-[hsl(var(--primary))] transition-colors group"
                            onClick={() => setIsOpen(false)}
                        >
                            <UserIcon className="w-4 h-4" />
                            <span className="font-bold text-xs uppercase">{t('dashboard.about')}</span>
                        </Link>

                        {/* Logout */}
                        <button
                            onClick={() => {
                                onLogout();
                                setIsOpen(false);
                            }}
                            className="w-full flex items-center gap-2 p-3 hover:bg-[hsl(var(--accent))] transition-colors group text-black"
                        >
                            <LogOut className="w-4 h-4" />
                            <span className="font-bold text-xs uppercase">{t('dashboard.logout')}</span>
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
