// resources/js/components/footer.tsx

import { Link } from '@inertiajs/react';

const PARTNERS = [
    {
        src: '/assets/img/web/ched.png',
        alt: 'Commission on Higher Education',
        label: 'CHED',
    },
    {
        src: '/assets/img/web/prc.png',
        alt: 'Professional Regulation Commission',
        label: 'PRC',
    },
    {
        src: '/assets/img/web/bagong-pilipinas.png',
        alt: 'Bagong Pilipinas',
        label: 'Bagong Pilipinas',
    },
    // Dark mode swaps in a copy whose dark-blue wordmark is white, so it stays readable.
    {
        src: '/assets/img/web/achieve.png',
        darkSrc: '/assets/img/web/achieve-dark.png',
        alt: 'ACHIEVE',
        label: 'ACHIEVE',
    },
] as const;

const LINKS = [
    { href: '#institution-search', label: 'Search institutions' },
    { href: '#hei-map-title', label: 'HEI map' },
    { href: '/login', label: 'Staff sign in' },
];

export default function Footer() {
    const year = new Date().getFullYear();

    return (
        <footer className="mt-16 w-full border-t bg-muted/40">
            <div className="mx-auto grid max-w-7xl gap-10 px-4 py-12 sm:px-6 lg:grid-cols-12 lg:px-8">
                {/* Brand */}
                <div className="lg:col-span-5">
                    <div className="flex items-center gap-3">
                        <img
                            src="/assets/img/web/ched.png"
                            alt=""
                            className="size-11 object-contain"
                        />
                        <div className="leading-tight">
                            <p className="font-semibold">Beripika</p>
                            <p className="text-sm text-muted-foreground">
                                Programs and Permits Registry
                            </p>
                        </div>
                    </div>
                    <p className="mt-4 max-w-md text-sm leading-relaxed text-muted-foreground">
                        Verify that higher education institutions in Region XII
                        and their programs hold a valid Government Recognition
                        (GR) or Certificate of Program Compliance (COPC).
                        Records come from the CHED Regional Office XII portal.
                    </p>
                </div>

                {/* Links */}
                <nav aria-label="Footer" className="lg:col-span-2">
                    <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                        Explore
                    </p>
                    <ul className="mt-3 space-y-2 text-sm">
                        {LINKS.map((link) => (
                            <li key={link.href}>
                                {link.href.startsWith('/') ? (
                                    <Link
                                        href={link.href}
                                        viewTransition
                                        className="text-foreground/80 transition-colors hover:text-primary"
                                    >
                                        {link.label}
                                    </Link>
                                ) : (
                                    <a
                                        href={link.href}
                                        className="text-foreground/80 transition-colors hover:text-primary"
                                    >
                                        {link.label}
                                    </a>
                                )}
                            </li>
                        ))}
                    </ul>
                </nav>

                {/* Partner logos */}
                <div className="lg:col-span-5">
                    <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                        In partnership with
                    </p>
                    <ul className="mt-4 grid grid-cols-4 gap-4 sm:max-w-md">
                        {PARTNERS.map((partner) => (
                            <li
                                key={partner.label}
                                className="flex flex-col items-center gap-2 text-center"
                            >
                                <span className="grid size-16 place-items-center sm:size-[4.5rem]">
                                    <img
                                        src={partner.src}
                                        alt={partner.alt}
                                        title={partner.alt}
                                        loading="lazy"
                                        className={
                                            'size-full object-contain' +
                                            ('darkSrc' in partner
                                                ? ' dark:hidden'
                                                : '')
                                        }
                                    />
                                    {'darkSrc' in partner && (
                                        <img
                                            src={partner.darkSrc}
                                            alt={partner.alt}
                                            title={partner.alt}
                                            loading="lazy"
                                            className="hidden size-full object-contain dark:block"
                                        />
                                    )}
                                </span>
                                <span className="text-[11px] leading-tight text-muted-foreground">
                                    {partner.label}
                                </span>
                            </li>
                        ))}
                    </ul>
                </div>
            </div>

            <div className="border-t">
                <div className="mx-auto flex max-w-7xl flex-col gap-2 px-4 py-5 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between sm:px-6 lg:px-8">
                    <p>
                        © {year} Commission on Higher Education, Regional Office
                        XII. All rights reserved.
                    </p>
                    <p>Republic of the Philippines</p>
                </div>
            </div>
        </footer>
    );
}
