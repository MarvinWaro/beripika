import { router } from '@inertiajs/react';
import { useEffect } from 'react';
import { toast } from 'sonner';
import type { SharedData } from '@/types';

/**
 * Shows `->with('success' | 'error', ...)` session messages from controllers as toasts.
 */
export function useSessionFlash(): void {
    useEffect(() => {
        return router.on('success', (event) => {
            const flash = (event.detail.page.props as unknown as SharedData).flash;
            if (flash?.success) {
                const sticky = flash.success.includes('password');
                toast.success(flash.success, sticky ? { duration: Infinity, closeButton: true } : undefined);
            }
            if (flash?.error) {
                toast.error(flash.error);
            }
        });
    }, []);
}
