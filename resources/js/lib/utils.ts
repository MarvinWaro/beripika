import type { InertiaLinkProps } from '@inertiajs/react';
import { clsx } from 'clsx';
import type { ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs));
}

export function toUrl(url: NonNullable<InertiaLinkProps['href']>): string {
    return typeof url === 'string' ? url : url.url;
}

/** Delay calls to `fn` until `wait` ms have passed without another call. */
export function debounce<A extends unknown[]>(
    fn: (...args: A) => void,
    wait = 300,
): ((...args: A) => void) & { cancel: () => void } {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const debounced = (...args: A) => {
        if (timer) clearTimeout(timer);
        timer = setTimeout(() => fn(...args), wait);
    };
    debounced.cancel = () => timer && clearTimeout(timer);
    return debounced;
}
