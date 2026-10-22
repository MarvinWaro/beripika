import { TriangleAlert } from 'lucide-react';

export default function Notice() {
    return (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 p-4 dark:border-red-900/30 dark:bg-red-900/10">
            <div className="flex items-start gap-3">
                <TriangleAlert className="mt-0.5 h-5 w-5 flex-shrink-0 text-red-600 dark:text-red-500" />
                <div className="text-sm">
                    <h4 className="font-bold uppercase tracking-wide text-red-900 dark:text-red-400">
                        Urgent Notification!
                    </h4>
                    <p className="mt-1 text-red-800 dark:text-red-500">
                        The status of programs and permits is currently under validation and subject to continuous updates. Status may be updated from time to time.
                    </p>
                </div>
            </div>
        </div>
    );
}
