// resources/js/components/welcome/welcome-nav.tsx

import { Link } from '@inertiajs/react';
import { LogIn } from 'lucide-react';
import React from 'react';
import { login } from '@/routes';
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from '@/components/ui/tooltip';

interface WelcomeNavProps {
    ThemeIcon: React.ComponentType<React.SVGProps<SVGSVGElement>>;
    tooltip: string;
    onToggleTheme: () => void;
}

const WelcomeNav: React.FC<WelcomeNavProps> = ({
    ThemeIcon,
    tooltip,
    onToggleTheme,
}) => {
    return (
        <header className="sticky top-0 z-50 w-full border-b border-white/10 bg-gray-950/90 text-white backdrop-blur-md">
            <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
                <a href="/" className="flex min-w-0 items-center gap-3">
                    <img
                        src="/assets/img/web/ched.png"
                        alt="CHED logo"
                        className="vt-brand-seal size-10 shrink-0 object-contain"
                    />
                    <div className="min-w-0 leading-tight">
                        <div className="text-[15px] font-semibold tracking-tight">
                            Beripika
                        </div>
                        <div className="hidden text-xs text-gray-400 sm:block">
                            CHED Regional Office XII · Programs &amp; Permits
                            Registry
                        </div>
                    </div>
                </a>

                <div className="flex items-center gap-2">
                    <TooltipProvider delayDuration={0}>
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <button
                                    onClick={onToggleTheme}
                                    className="grid size-10 place-items-center rounded-full text-gray-300 transition hover:bg-white/10 hover:text-white"
                                    aria-label={tooltip}
                                >
                                    <ThemeIcon className="h-[18px] w-[18px]" />
                                </button>
                            </TooltipTrigger>
                            <TooltipContent>
                                <p>{tooltip}</p>
                            </TooltipContent>
                        </Tooltip>
                    </TooltipProvider>

                    <Link
                        href={login()}
                        viewTransition
                        className="inline-flex h-10 shrink-0 items-center gap-2 rounded-(--radius-button) bg-primary px-5 text-sm font-semibold text-white transition hover:bg-blue-500"
                    >
                        <LogIn className="h-4 w-4" />
                        Sign in
                    </Link>
                </div>
            </div>
        </header>
    );
};

export default WelcomeNav;
