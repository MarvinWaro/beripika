import type { ProgramSnapshot } from '@/types/programs';
import axios from 'axios';
import { useCallback, useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';

const REFRESH_INTERVAL = 5 * 60 * 1000;

export function useProgramRefresh(
    code: string | null,
    initial: ProgramSnapshot,
) {
    const [snapshot, setSnapshot] = useState(initial);
    const [refreshing, setRefreshing] = useState(false);
    const request = useRef<AbortController | null>(null);
    const lastAttempt = useRef(Date.now());

    useEffect(() => {
        setSnapshot(initial);
    }, [initial]);

    const refresh = useCallback(
        async (manual = true) => {
            if (!code || request.current) return;
            if (!navigator.onLine) {
                if (manual)
                    setSnapshot((previous) => ({
                        ...previous,
                        stale: true,
                        error: 'You are offline. Reconnect to refresh from the portal.',
                    }));
                return;
            }
            const controller = new AbortController();
            request.current = controller;
            lastAttempt.current = Date.now();
            setRefreshing(true);
            try {
                const response = await axios.post<
                    ProgramSnapshot & { instCode: string }
                >(
                    '/programs/refresh',
                    { instCode: code },
                    { signal: controller.signal },
                );
                if (
                    controller.signal.aborted ||
                    response.data.instCode !== code
                )
                    return;
                setSnapshot(response.data);
                if (manual) toast.success('Programs refreshed from portal');
            } catch (error: unknown) {
                if (controller.signal.aborted) return;
                const message = axios.isAxiosError<{
                    error?: string;
                    message?: string;
                }>(error)
                    ? (error.response?.data.error ??
                      error.response?.data.message)
                    : null;
                setSnapshot((previous) => ({
                    ...previous,
                    stale: true,
                    error:
                        message ??
                        'Could not refresh programs. Please try again.',
                }));
                if (manual) toast.error('Programs could not be refreshed');
            } finally {
                if (request.current === controller) {
                    request.current = null;
                    if (!controller.signal.aborted) setRefreshing(false);
                }
            }
        },
        [code],
    );

    useEffect(() => {
        const check = () => {
            if (
                document.visibilityState === 'visible' &&
                navigator.onLine &&
                Date.now() - lastAttempt.current >= REFRESH_INTERVAL
            ) {
                void refresh(false);
            }
        };
        const timer = window.setInterval(check, REFRESH_INTERVAL);
        document.addEventListener('visibilitychange', check);
        window.addEventListener('online', check);
        return () => {
            window.clearInterval(timer);
            document.removeEventListener('visibilitychange', check);
            window.removeEventListener('online', check);
            request.current?.abort();
            request.current = null;
        };
    }, [refresh]);

    return { snapshot, refreshing, refresh };
}
