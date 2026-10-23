export type * from './auth';
export type * from './navigation';
export type * from './permissions';
export type * from './ui';

import type { Auth } from './auth';

/** Props shared with every page by HandleInertiaRequests. */
export type SharedData = {
    name: string;
    auth: Auth;
    flash: { success?: string | null; error?: string | null };
    sidebarOpen: boolean;
    [key: string]: unknown;
};
