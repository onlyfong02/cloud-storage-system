import { useTranslation } from 'react-i18next';
import { Button } from './ui/button';
import { Languages } from 'lucide-react';

export function LanguageSwitcher() {
    const { i18n } = useTranslation();

    const toggleLanguage = () => {
        const nextLang = i18n.language === 'vi' ? 'en' : 'vi';
        i18n.changeLanguage(nextLang);
    };

    return (
        <Button
            variant="outline"
            size="sm"
            onClick={toggleLanguage}
            className="flex items-center gap-2 bg-white border-2 border-black hover:bg-[hsl(var(--primary))] shadow-nb-sm"
            title={i18n.language === 'vi' ? 'Switch to English' : 'Chuyển sang Tiếng Việt'}
        >
            <Languages className="w-4 h-4" />
            <span className="uppercase font-black text-xs">
                {i18n.language === 'vi' ? 'EN' : 'VI'}
            </span>
        </Button>
    );
}
