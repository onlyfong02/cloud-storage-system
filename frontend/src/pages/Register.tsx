import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Eye, EyeOff, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { LanguageSwitcher } from '@/components/LanguageSwitcher';
import logoImg from '@/assets/logo.png';

export default function RegisterPage() {
    const { t } = useTranslation();
    const navigate = useNavigate();
    const { register } = useAuth();
    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [error, setError] = useState('');
    const [isLoading, setIsLoading] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');

        if (password !== confirmPassword) {
            setError(t('auth.register.passwordMismatch'));
            return;
        }

        if (password.length < 6) {
            setError(t('auth.register.passwordTooShort'));
            return;
        }

        setIsLoading(true);

        try {
            await register({ name, email, password });
            toast.success(t('auth.register.success'));
            navigate('/dashboard');
        } catch (err: unknown) {
            const error = err as { response?: { data?: { message?: string } } };
            const message = error.response?.data?.message || t('auth.register.failed');
            setError(message);
            toast.error(message);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-[#f0f0f0] p-4 relative">
            <div className="absolute top-4 right-4">
                <LanguageSwitcher />
            </div>
            <Card className="w-full max-w-md animate-fade-in">
                <CardHeader className="text-center space-y-6">
                    <div className="mx-auto w-16 h-16 bg-[hsl(var(--primary))] border-2 border-black flex items-center justify-center shadow-nb-sm overflow-hidden">
                        <img src={logoImg} alt="Logo" className="w-full h-full object-cover grayscale brightness-200 contrast-200" />
                    </div>
                    <div className="space-y-1">
                        <CardTitle className="text-3xl font-black uppercase tracking-tighter">{t('auth.register.title')}</CardTitle>
                        <CardDescription className="text-black font-bold">{t('auth.register.subtitle')}</CardDescription>
                    </div>
                </CardHeader>
                <CardContent>
                    <form onSubmit={handleSubmit} className="space-y-5">
                        {error && (
                            <div className="p-3 border-2 border-black bg-white text-destructive font-bold shadow-nb-sm animate-shake">
                                {error}
                            </div>
                        )}

                        <div className="space-y-2">
                            <label className="text-sm font-black uppercase tracking-wide">{t('auth.register.name')}</label>
                            <Input
                                type="text"
                                placeholder={t('auth.register.namePlaceholder')}
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                required
                            />
                        </div>

                        <div className="space-y-2">
                            <label className="text-sm font-black uppercase tracking-wide">{t('auth.register.email')}</label>
                            <Input
                                type="email"
                                placeholder="you@example.com"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                required
                            />
                        </div>

                        <div className="space-y-2">
                            <label className="text-sm font-black uppercase tracking-wide">{t('auth.register.password')}</label>
                            <div className="relative">
                                <Input
                                    type={showPassword ? 'text' : 'password'}
                                    placeholder="••••••••"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    required
                                />
                                <button
                                    type="button"
                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-black hover:text-gray-600"
                                    onClick={() => setShowPassword(!showPassword)}
                                >
                                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                </button>
                            </div>
                        </div>

                        <div className="space-y-2">
                            <label className="text-sm font-black uppercase tracking-wide">{t('auth.register.confirmPassword')}</label>
                            <Input
                                type="password"
                                placeholder="••••••••"
                                value={confirmPassword}
                                onChange={(e) => setConfirmPassword(e.target.value)}
                                required
                            />
                        </div>

                        <Button type="submit" className="w-full text-lg h-12 mt-2" disabled={isLoading}>
                            {isLoading ? (
                                <>
                                    <Loader2 className="w-5 h-5 mr-3 animate-spin" />
                                    {t('auth.register.processing')}
                                </>
                            ) : (
                                t('auth.register.submit')
                            )}
                        </Button>
                    </form>

                    <div className="mt-8 text-center">
                        <span className="text-black font-medium">{t('auth.register.hasAccount')} </span>
                        <Link to="/login" className="text-black underline font-black hover:bg-[hsl(var(--primary))] p-1">
                            {t('auth.register.loginNow')}
                        </Link>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
