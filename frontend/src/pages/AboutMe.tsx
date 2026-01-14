import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ChevronLeft, Github, Facebook, Code2, Coffee, Gamepad2, Music, Cat, MoonStar } from 'lucide-react';
import { Link } from 'react-router-dom';

export default function AboutMe() {
    const { t } = useTranslation();

    const hobbies = [
        { key: 'sleep', icon: <MoonStar className="w-3 h-3" />, color: 'bg-purple-100' },
        { key: 'matcha', icon: <span className="text-xs">🍵</span>, color: 'bg-green-100' },
        { key: 'cat', icon: <Cat className="w-3 h-3" />, color: 'bg-orange-100' },
        { key: 'strawberry', icon: <span className="text-xs">🍓</span>, color: 'bg-red-100' },
        { key: 'game', icon: <Gamepad2 className="w-3 h-3" />, color: 'bg-blue-100' },
        { key: 'music', icon: <Music className="w-3 h-3" />, color: 'bg-pink-100' },
        { key: 'sushi', icon: <span className="text-xs">🍣</span>, color: 'bg-yellow-100' },
    ];

    return (
        <div className="min-h-screen bg-[#f0f0f0] font-bold">
            <header className="border-b-4 border-black bg-white sticky top-0 z-10">
                <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <Link to="/dashboard">
                            <Button variant="outline" size="icon" className="bg-white border-2 border-black">
                                <ChevronLeft className="w-5 h-5" />
                            </Button>
                        </Link>
                        <div className="w-10 h-10 sm:w-12 sm:h-12 bg-[hsl(var(--primary))] border-2 border-black flex items-center justify-center shadow-nb-sm shrink-0">
                            <Coffee className="w-5 h-5 sm:w-6 sm:h-6 text-black" />
                        </div>
                        <div>
                            <h1 className="font-black text-lg sm:text-2xl uppercase tracking-tighter">{t('dashboard.about')}</h1>
                        </div>
                    </div>
                </div>
            </header>

            <main className="max-w-3xl mx-auto px-4 py-8">
                <Card className="bg-white shadow-nb border-4 border-black">
                    <CardHeader className="border-b-4 border-black bg-[hsl(var(--primary))]">
                        <CardTitle className="text-xl font-black uppercase flex items-center gap-2">
                            <Coffee className="w-5 h-5" />
                            {t('aboutPage.title')}
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="p-0">
                        <div className="flex flex-col md:flex-row">
                            {/* Profile Section */}
                            <div className="md:w-1/3 bg-gray-50 p-8 border-b-4 md:border-b-0 md:border-r-4 border-black flex flex-col items-center text-center">
                                <div className="w-40 h-40 bg-black rounded-full overflow-hidden border-4 border-black shadow-nb mb-6 relative group">
                                    <img
                                        src="./public/about_me_img.jpg"
                                        alt="Fong Nguyen"
                                        className="w-full h-full object-cover grayscale group-hover:grayscale-0 transition-all duration-300"
                                    />
                                </div>
                                <h2 className="text-2xl font-black uppercase mb-2">Fong Nguyen</h2>
                                <p className="font-bold opacity-60 mb-6 uppercase tracking-widest text-sm">{t('aboutPage.role')}</p>

                                <div className="flex gap-4">
                                    <a href="https://github.com/onlyfong02" target="_blank" rel="noopener noreferrer" className="p-2 bg-white border-2 border-black shadow-nb-sm hover:translate-y-0.5 hover:shadow-none transition-all">
                                        <Github className="w-5 h-5" />
                                    </a>
                                    <a href="https://www.facebook.com/onlyfong02" target="_blank" rel="noopener noreferrer" className="p-2 bg-white border-2 border-black shadow-nb-sm hover:translate-y-0.5 hover:shadow-none transition-all">
                                        <Facebook className="w-5 h-5" />
                                    </a>
                                    <a href="https://www.tiktok.com/@ng2r.fozgg" target="_blank" rel="noopener noreferrer" className="p-2 bg-white border-2 border-black shadow-nb-sm hover:translate-y-0.5 hover:shadow-none transition-all">
                                        <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                                            <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-5.2 1.74 2.89 2.89 0 0 1 2.31-4.64 2.93 2.93 0 0 1 .88.13V9.4a6.84 6.84 0 0 0-1-.05A6.33 6.33 0 0 0 5 20.1a6.34 6.34 0 0 0 10.86-4.43v-7a8.16 8.16 0 0 0 4.77 1.52v-3.4a4.85 4.85 0 0 1-1-.1z" />
                                        </svg>
                                    </a>
                                </div>
                            </div>

                            {/* Content Section */}
                            <div className="md:w-2/3 p-8">
                                <div className="prose prose-neutral max-w-none">
                                    <div className="mb-8">
                                        <h3 className="text-xl font-black uppercase mb-4 flex items-center gap-2">
                                            <Code2 className="w-5 h-5" />
                                            {t('aboutPage.profileInfo')}
                                        </h3>
                                        <p className="font-medium text-gray-600 leading-relaxed mb-4 whitespace-pre-line">
                                            {t('aboutPage.description')}
                                        </p>

                                        <h4 className="text-sm font-black uppercase mb-3 mt-6">{t('aboutPage.hobbies.title')}</h4>
                                        <div className="flex flex-wrap gap-2 mb-6">
                                            {hobbies.map((hobby) => (
                                                <div key={hobby.key} className={`flex items-center gap-2 px-3 py-1 ${hobby.color} border-2 border-black shadow-nb-sm`}>
                                                    {hobby.icon}
                                                    <span className="text-[10px] font-black uppercase">
                                                        {t(`aboutPage.hobbies.${hobby.key}`)}
                                                    </span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>

                                    <div>
                                        <h3 className="text-xl font-black uppercase mb-4">{t('aboutPage.philosophy')}</h3>
                                        <div className="bg-[#f0f0f0] p-4 border-l-4 border-black italic font-serif">
                                            "{t('aboutPage.quote')}"
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </main>
        </div>
    );
}


