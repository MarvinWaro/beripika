import { useSyncExternalStore } from 'react';

/** Visual style preset. Carbon is the default; see docs/DESIGN.md. */
export type UiStyle = 'carbon' | 'coinbase';

export const UI_STYLES: { value: UiStyle; label: string; description: string }[] = [
    { value: 'carbon', label: 'Carbon', description: 'Square, structured, IBM Plex' },
    { value: 'coinbase', label: 'Coinbase', description: 'Rounded pills, Inter, editorial' },
];

const DEFAULT_STYLE: UiStyle =
    (import.meta.env.VITE_UI_STYLE as UiStyle | undefined) === 'coinbase'
        ? 'coinbase'
        : 'carbon';

const listeners = new Set<() => void>();
let current: UiStyle = DEFAULT_STYLE;

const read = (): UiStyle => {
    if (typeof window === 'undefined') return DEFAULT_STYLE;
    try {
        const stored = localStorage.getItem('ui_style');
        return stored === 'coinbase' || stored === 'carbon' ? stored : DEFAULT_STYLE;
    } catch {
        return DEFAULT_STYLE;
    }
};

const apply = (style: UiStyle): void => {
    if (typeof document === 'undefined') return;
    document.documentElement.classList.toggle('theme-coinbase', style === 'coinbase');
};

export function initializeUiStyle(): void {
    current = read();
    apply(current);
}

export function useUiStyle() {
    const style = useSyncExternalStore(
        (cb) => {
            listeners.add(cb);
            return () => listeners.delete(cb);
        },
        () => current,
        () => DEFAULT_STYLE,
    );

    const updateStyle = (next: UiStyle): void => {
        current = next;
        try {
            localStorage.setItem('ui_style', next);
        } catch {
            // storage unavailable — still apply for this page view
        }
        document.cookie = `ui_style=${next};path=/;max-age=${365 * 86400};SameSite=Lax`;
        apply(next);
        listeners.forEach((l) => l());
    };

    return { style, updateStyle } as const;
}
