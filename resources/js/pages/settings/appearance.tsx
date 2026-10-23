import { Head } from '@inertiajs/react';
import AppearanceTabs from '@/components/appearance-tabs';
import { UI_STYLES, useUiStyle } from '@/hooks/use-ui-style';
import { cn } from '@/lib/utils';
import Heading from '@/components/heading';
import { edit as editAppearance } from '@/routes/appearance';

export default function Appearance() {
    const { style, updateStyle } = useUiStyle();

    return (
        <>
            <Head title="Appearance settings" />

            <h1 className="sr-only">Appearance settings</h1>

            <div className="space-y-6">
                <Heading
                    variant="small"
                    title="Appearance settings"
                    description="Update the appearance settings for your account"
                />
                <AppearanceTabs />

                <Heading
                    variant="small"
                    title="Interface style"
                    description="Choose the look of Beripika on this device"
                />
                <div className="grid max-w-xl gap-3 sm:grid-cols-2">
                    {UI_STYLES.map((option) => (
                        <button
                            key={option.value}
                            type="button"
                            onClick={() => updateStyle(option.value)}
                            aria-pressed={style === option.value}
                            className={cn(
                                'rounded-(--radius-card) border p-4 text-left transition-colors hover:bg-muted',
                                style === option.value &&
                                    'border-primary ring-1 ring-primary',
                            )}
                        >
                            <span className="block text-sm font-semibold">
                                {option.label}
                            </span>
                            <span className="mt-1 block text-xs text-muted-foreground">
                                {option.description}
                            </span>
                        </button>
                    ))}
                </div>
            </div>
        </>
    );
}

Appearance.layout = {
    breadcrumbs: [
        {
            title: 'Appearance settings',
            href: editAppearance(),
        },
    ],
};
