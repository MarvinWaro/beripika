import { Check, ChevronsUpDown, RotateCcw } from 'lucide-react';
import { useState } from 'react';
import type {
    DashboardFilters,
    DashboardOptions,
} from '@/components/dashboard/types';
import { Button } from '@/components/ui/button';
import {
    Command,
    CommandEmpty,
    CommandInput,
    CommandItem,
    CommandList,
} from '@/components/ui/command';
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from '@/components/ui/popover';

/** Institution + graduation-year scope for every chart on the dashboard. */
export default function FilterBar({
    filters,
    options,
    loading,
    onChange,
}: {
    filters: DashboardFilters;
    options: DashboardOptions;
    loading: boolean;
    onChange: (changes: Partial<DashboardFilters>) => void;
}) {
    const [pickerOpen, setPickerOpen] = useState(false);
    const institution = options.institutions.find(
        (item) => item.code === filters.institution,
    );

    return (
        <div className="flex flex-wrap items-end gap-3 rounded-xl border bg-card p-4">
            <div className="min-w-0 flex-1 basis-64">
                <label
                    className="mb-2 block text-sm font-medium"
                    id="institution-label"
                >
                    Institution
                </label>
                <Popover open={pickerOpen} onOpenChange={setPickerOpen}>
                    <PopoverTrigger asChild>
                        <Button
                            variant="outline"
                            role="combobox"
                            aria-labelledby="institution-label"
                            aria-expanded={pickerOpen}
                            className="w-full justify-between"
                        >
                            <span className="truncate">
                                {institution?.name ?? 'All institutions'}
                            </span>
                            <ChevronsUpDown className="ml-2 size-4 shrink-0" />
                        </Button>
                    </PopoverTrigger>
                    <PopoverContent
                        className="w-[var(--radix-popover-trigger-width)] max-w-[calc(100vw-2rem)] p-0"
                        align="start"
                    >
                        <Command>
                            <CommandInput placeholder="Search school name or HEI code..." />
                            <CommandList>
                                <CommandEmpty>
                                    No institutions found.
                                </CommandEmpty>
                                {[
                                    { code: '', name: 'All institutions' },
                                    ...options.institutions,
                                ].map((item, keyIndex) => (
                                    <CommandItem
                                        key={`${item.code}-${keyIndex}`}
                                        value={item.name + ' ' + item.code}
                                        onSelect={() => {
                                            setPickerOpen(false);
                                            onChange({
                                                institution: item.code || null,
                                            });
                                        }}
                                    >
                                        <Check
                                            className={
                                                filters.institution ===
                                                (item.code || null)
                                                    ? 'size-4 shrink-0'
                                                    : 'size-4 shrink-0 opacity-0'
                                            }
                                        />
                                        <span className="break-words">
                                            {item.name}
                                            {item.code && (
                                                <span className="ml-2 text-muted-foreground">
                                                    {item.code}
                                                </span>
                                            )}
                                        </span>
                                    </CommandItem>
                                ))}
                            </CommandList>
                        </Command>
                    </PopoverContent>
                </Popover>
            </div>
            <div>
                <label
                    htmlFor="graduation-year"
                    className="mb-2 block text-sm font-medium"
                >
                    Graduation year
                </label>
                <select
                    id="graduation-year"
                    value={filters.year ?? ''}
                    onChange={(event) =>
                        onChange({
                            year: event.target.value
                                ? Number(event.target.value)
                                : null,
                        })
                    }
                    className="h-9 rounded-md border bg-background px-3 text-sm focus-visible:outline-2 focus-visible:outline-ring"
                >
                    <option value="">All years</option>
                    {options.years.map((year) => (
                        <option key={year} value={year}>
                            {year}
                        </option>
                    ))}
                </select>
            </div>
            <Button
                variant="ghost"
                onClick={() => onChange({ year: null, institution: null })}
                disabled={!filters.year && !filters.institution && !loading}
            >
                <RotateCcw className="size-4" />
                Reset filters
            </Button>
        </div>
    );
}
