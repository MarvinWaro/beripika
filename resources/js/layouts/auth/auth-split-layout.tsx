import { Link } from '@inertiajs/react';
import { ShieldCheck } from 'lucide-react';
import { TopoBackground } from '@/components/welcome/landing-motion';
import { home } from '@/routes';
import type { AuthLayoutProps } from '@/types';

/**
 * Sign-in screens: dark brand panel (same contours as the landing hero, but still)
 * beside a plain, distraction-free form. On phones the panel becomes a slim header.
 */
export default function AuthSplitLayout({
    children,
    title,
    description,
}: AuthLayoutProps) {
    return (
        <div className="grid min-h-dvh bg-background lg:grid-cols-2">
            {/* Brand panel (desktop) */}
            <aside className="vt-brand-panel relative hidden overflow-hidden bg-gray-950 text-white lg:flex lg:flex-col lg:justify-between lg:p-12">
                <div
                    aria-hidden
                    className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,color-mix(in_srgb,var(--primary)_35%,transparent),transparent_60%)]"
                />
                <TopoBackground still />

                <Link
                    href={home()}
                    viewTransition
                    className="relative z-10 flex w-fit items-center gap-3"
                >
                    <img
                        src="/assets/img/web/ched.png"
                        alt="CHED logo"
                        className="vt-brand-seal size-11 object-contain"
                    />
                    <div className="leading-tight">
                        <p className="font-semibold">Beripika</p>
                        <p className="text-xs text-gray-400">
                            CHED Regional Office XII
                        </p>
                    </div>
                </Link>

                <div className="relative z-10 max-w-md">
                    <h2 className="text-display text-4xl xl:text-5xl">
                        Programs and Permits Registry
                    </h2>
                    <p className="mt-4 text-base leading-relaxed text-gray-400">
                        Sign in to manage Region XII institutions, programs,
                        permits and graduate records.
                    </p>
                </div>

                <p className="relative z-10 flex items-center gap-2 text-xs text-gray-400">
                    <ShieldCheck className="size-4 text-success" />
                    For authorized CHED staff and partner agencies only.
                </p>
            </aside>

            {/* Form side */}
            <main className="flex flex-col">
                {/* Slim brand header (phones / tablets) */}
                <header className="vt-brand-panel relative overflow-hidden bg-gray-950 px-6 py-4 text-white lg:hidden">
                    <TopoBackground still />
                    <Link
                        href={home()}
                        viewTransition
                        className="relative z-10 flex items-center gap-3"
                    >
                        <img
                            src="/assets/img/web/ched.png"
                            alt="CHED logo"
                            className="vt-brand-seal size-9 object-contain"
                        />
                        <div className="leading-tight">
                            <p className="text-sm font-semibold">Beripika</p>
                            <p className="text-[11px] text-gray-400">
                                CHED Regional Office XII
                            </p>
                        </div>
                    </Link>
                </header>

                <div className="flex flex-1 items-center justify-center px-6 py-10 sm:px-10">
                    <div className="w-full max-w-sm space-y-6">
                        <div className="space-y-2">
                            <h1 className="text-2xl font-semibold tracking-tight">
                                {title}
                            </h1>
                            {description && (
                                <p className="text-sm text-balance text-muted-foreground">
                                    {description}
                                </p>
                            )}
                        </div>
                        {children}
                    </div>
                </div>

                <p className="px-6 pb-6 text-center text-xs text-muted-foreground">
                    © {new Date().getFullYear()} Commission on Higher Education,
                    Regional Office XII
                </p>
            </main>
        </div>
    );
}
