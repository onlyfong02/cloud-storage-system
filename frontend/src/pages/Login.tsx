import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Cloud, Eye, EyeOff, Loader2, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';
import { LanguageSwitcher } from '@/components/LanguageSwitcher';

export default function LoginPage() {
    const { t } = useTranslation();
    const navigate = useNavigate();
    const { login } = useAuth();
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [error, setError] = useState('');
    const [isLoading, setIsLoading] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setIsLoading(true);

        try {
            await login({ email, password });
            toast.success(t('auth.login.success'));
            navigate('/dashboard');
        } catch (err: unknown) {
            const error = err as { response?: { data?: { message?: string } } };
            const backendMessage = error.response?.data?.message;
            let displayMessage = t('auth.login.failed');

            if (backendMessage === 'Incorrect email or password') {
                displayMessage = t('auth.login.invalidCredentials');
            } else if (backendMessage) {
                displayMessage = backendMessage;
            }

            setError(displayMessage);
            toast.error(displayMessage);
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
                    <div className="mx-auto w-16 h-16 bg-[hsl(var(--primary))] border-2 border-black flex items-center justify-center shadow-nb-sm">
                        <Cloud className="w-8 h-8 text-black" />
                    </div>
                    <div className="space-y-1">
                        <CardTitle className="text-3xl font-black uppercase tracking-tighter">{t('auth.login.title')}</CardTitle>
                        <CardDescription className="text-black font-bold">{t('auth.login.subtitle')}</CardDescription>
                    </div>
                </CardHeader>
                <CardContent>
                    <form onSubmit={handleSubmit} className="space-y-6">
                        {error && (
                            <div className="p-4 border-4 border-black bg-[#ff5c5c] text-black font-black shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] animate-shake flex items-start gap-4">
                                <div className="bg-white border-2 border-black p-1 shrink-0 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
                                    <AlertCircle className="w-5 h-5 text-black" />
                                </div>
                                <div className="flex-1">
                                    <div className="text-xs uppercase tracking-widest mb-0.5 font-black opacity-90">Attention Required</div>
                                    <div className="text-sm leading-tight">{error}</div>
                                </div>
                            </div>
                        )}
                        <div className="space-y-2">
                            <label className="text-sm font-black uppercase tracking-wide">{t('auth.login.email')}</label>
                            <Input
                                type="email"
                                placeholder="you@example.com"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                required
                            />
                        </div>

                        <div className="space-y-2">
                            <label className="text-sm font-black uppercase tracking-wide">{t('auth.login.password')}</label>
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

                        <Button type="submit" className="w-full text-lg h-12" disabled={isLoading}>
                            {isLoading ? (
                                <>
                                    <Loader2 className="w-5 h-5 mr-3 animate-spin" />
                                    {t('auth.login.processing')}
                                </>
                            ) : (
                                t('auth.login.submit')
                            )}
                        </Button>
                    </form>

                    <div className="mt-8 text-center">
                        <span className="text-black font-medium">{t('auth.login.noAccount')} </span>
                        <Link to="/register" className="text-black underline font-black hover:bg-[hsl(var(--primary))] p-1">
                            {t('auth.login.registerNow')}
                        </Link>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
