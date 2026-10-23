// resources/js/components/welcome/landing-motion.tsx
//
// Lightweight motion for the public landing page only. No animation libraries:
// static SVG + CSS keyframes (GPU-composited transforms/opacity), one
// IntersectionObserver per revealed block, and a single rAF loop per counter.
// Everything is disabled under `prefers-reduced-motion` (see app.css).

import { CheckCircle2, FileCheck2, RefreshCw } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

/* ───────── Topographic contours background ───────── */

// Contour rings are computed once at module load (deterministic, ~2 KB of path data).
function ring(cx: number, cy: number, r: number, seed: number): string {
    const steps = 40;
    const pts: [number, number][] = [];
    for (let i = 0; i < steps; i++) {
        const t = (i / steps) * Math.PI * 2;
        const wobble = 1 + 0.16 * Math.sin(3 * t + seed) + 0.07 * Math.sin(5 * t + seed * 1.7);
        pts.push([cx + Math.cos(t) * r * wobble * 1.35, cy + Math.sin(t) * r * wobble]);
    }
    // Smooth closed curve through midpoints (quadratic Béziers).
    const mid = (a: [number, number], b: [number, number]) => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
    const start = mid(pts[steps - 1], pts[0]);
    let d = `M${start[0].toFixed(1)} ${start[1].toFixed(1)}`;
    for (let i = 0; i < steps; i++) {
        const p = pts[i];
        const m = mid(p, pts[(i + 1) % steps]);
        d += `Q${p[0].toFixed(1)} ${p[1].toFixed(1)} ${m[0].toFixed(1)} ${m[1].toFixed(1)}`;
    }

    return d + 'Z';
}

const CONTOURS: string[] = [
    { x: 980, y: 140, rings: 9, seed: 0.4 },
    { x: 260, y: 520, rings: 7, seed: 2.1 },
    { x: 700, y: 430, rings: 5, seed: 4.3 },
].flatMap(({ x, y, rings, seed }) =>
    Array.from({ length: rings }, (_, i) => ring(x, y, 34 + i * 30, seed + i * 0.35)),
);

/** `still` renders the same contours without the drift (used on sign-in screens). */
export function TopoBackground({ className, still = false }: { className?: string; still?: boolean }) {
    return (
        <div aria-hidden className={cn('landing-topo pointer-events-none absolute inset-0 overflow-hidden', className)}>
            <svg
                className={cn('landing-topo-layer h-[120%] w-[120%] -translate-x-[8%] -translate-y-[8%]', still && 'is-still')}
                viewBox="0 0 1200 640"
                preserveAspectRatio="xMidYMid slice"
                fill="none"
                stroke="currentColor"
            >
                {CONTOURS.map((d, i) => (
                    <path key={i} d={d} strokeWidth={i % 4 === 0 ? 1.2 : 0.7} vectorEffect="non-scaling-stroke" />
                ))}
            </svg>
        </div>
    );
}

/* ───────── Split headline reveal ───────── */

export function RevealHeadline({ lines, className }: { lines: string[]; className?: string }) {
    return (
        <h1 className={className} aria-label={lines.join(' ')}>
            {lines.map((line, i) => (
                <span key={i} aria-hidden className="block overflow-hidden pb-[0.08em]">
                    <span className="landing-rise inline-block" style={{ animationDelay: `${120 + i * 110}ms` }}>
                        {line}
                    </span>
                </span>
            ))}
        </h1>
    );
}

/* ───────── Floating verification chips ───────── */

const CHIPS: { icon: ReactNode; title: string; text: string; className: string; delay: string }[] = [
    {
        icon: <CheckCircle2 className="size-4 text-success" />,
        title: 'GR / COPC verified',
        text: 'Permit status shown per program',
        className: '-top-14 left-0',
        delay: '0s',
    },
    {
        icon: <FileCheck2 className="size-4 text-primary" />,
        title: 'Permit document on file',
        text: 'Open the PDF in one click',
        className: '-top-7 -right-6',
        delay: '-2s',
    },
    {
        icon: <RefreshCw className="size-4 text-warning" />,
        title: 'Live from the CHED portal',
        text: 'Region XII records',
        className: '-bottom-12 right-10',
        delay: '-4s',
    },
];

/** Decorative only — describes features, never shows sample permit data. */
export function FloatingChips() {
    return (
        <div aria-hidden className="pointer-events-none absolute inset-0 hidden xl:block">
            {CHIPS.map((chip) => (
                <div
                    key={chip.title}
                    className={cn(
                        'landing-float absolute flex items-center gap-2.5 rounded-(--radius-card) bg-white/95 px-3.5 py-2.5 text-gray-950 shadow-[0_12px_32px_-8px_rgb(0_0_0/0.5)] ring-1 ring-black/5',
                        chip.className,
                    )}
                    style={{ animationDelay: `0.7s, ${chip.delay}` }}
                >
                    {chip.icon}
                    <div className="leading-tight">
                        <p className="text-xs font-semibold">{chip.title}</p>
                        <p className="text-[11px] text-gray-500">{chip.text}</p>
                    </div>
                </div>
            ))}
        </div>
    );
}

/* ───────── Count up ───────── */

const prefersReducedMotion = () =>
    typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/** Counts from 0 to `value` once it is known and on screen (~1.1 s, ease-out). */
export function CountUp({ value, suffix = '' }: { value: number | null; suffix?: string }) {
    const ref = useRef<HTMLSpanElement>(null);
    const [shown, setShown] = useState<number | null>(null);

    useEffect(() => {
        if (value === null || !ref.current) return;
        if (prefersReducedMotion()) {
            setShown(value);

            return;
        }
        let frame = 0;
        const observer = new IntersectionObserver(([entry]) => {
            if (!entry.isIntersecting) return;
            observer.disconnect();
            const start = performance.now();
            const tick = (now: number) => {
                const p = Math.min(1, (now - start) / 1100);
                setShown(Math.round(value * (1 - Math.pow(1 - p, 3))));
                if (p < 1) frame = requestAnimationFrame(tick);
            };
            frame = requestAnimationFrame(tick);
        });
        observer.observe(ref.current);

        return () => {
            observer.disconnect();
            cancelAnimationFrame(frame);
        };
    }, [value]);

    return (
        <span ref={ref} className="num tabular-nums">
            {shown === null ? '—' : shown.toLocaleString()}
            {shown !== null && suffix}
        </span>
    );
}

/* ───────── Scroll reveal ───────── */

/** Fades + lifts its children the first time they scroll into view. */
export function Reveal({ children, className }: { children: ReactNode; className?: string }) {
    const ref = useRef<HTMLDivElement>(null);
    const [visible, setVisible] = useState(false);

    useEffect(() => {
        const el = ref.current;
        if (!el) return;
        if (prefersReducedMotion() || !('IntersectionObserver' in window)) {
            setVisible(true);

            return;
        }
        const observer = new IntersectionObserver(
            ([entry]) => {
                if (entry.isIntersecting) {
                    setVisible(true);
                    observer.disconnect();
                }
            },
            { rootMargin: '0px 0px -10% 0px' },
        );
        observer.observe(el);

        return () => observer.disconnect();
    }, []);

    return (
        <div ref={ref} className={cn('landing-reveal', visible && 'is-visible', className)}>
            {children}
        </div>
    );
}
