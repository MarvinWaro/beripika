import { Check, ChevronsUpDown } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
    Command,
    CommandEmpty,
    CommandGroup,
    CommandInput,
    CommandItem,
    CommandList,
} from '@/components/ui/command';
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from '@/components/ui/popover';
import { cn } from '@/lib/utils';

export interface FilterOption {
    value: string;
    label: string;
}

interface Props {
    /** Accessible name of the filter, e.g. "Institution". */
    label: string;
    /** Text shown when no value is selected, e.g. "All institutions". */
    allLabel: string;
    searchPlaceholder: string;
    emptyText: string;
    options: FilterOption[];
    value: string | null;
    onChange: (value: string | null) => void;
    className?: string;
}

/** Searchable single-select for long filter lists (shadcn Popover + Command). */
export default function FilterCombobox({
    label,
    allLabel,
    searchPlaceholder,
    emptyText,
    options,
    value,
    onChange,
    className,
}: Props) {
    const [open, setOpen] = useState(false);
    const current =
        options.find((option) => option.value === value)?.label ??
        value ??
        allLabel;

    const select = (next: string | null) => {
        setOpen(false);
        if (next !== value) onChange(next);
    };

    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
                <Button
                    type="button"
                    variant="outline"
                    role="combobox"
                    aria-expanded={open}
                    aria-label={`${label}: ${current}`}
                    className={cn(
                        'h-10 justify-between font-normal',
                        className,
                    )}
                >
                    <span className="truncate">{current}</span>
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
            </PopoverTrigger>
            <PopoverContent
                className="w-80 max-w-[calc(100vw-2rem)] p-0"
                align="start"
            >
                <Command>
                    <CommandInput placeholder={searchPlaceholder} />
                    <CommandList>
                        <CommandEmpty>{emptyText}</CommandEmpty>
                        <CommandGroup>
                            <CommandItem
                                value={`__all__ ${allLabel}`}
                                onSelect={() => select(null)}
                                className="gap-2"
                            >
                                <Check
                                    className={cn(
                                        'h-4 w-4 shrink-0',
                                        value !== null && 'opacity-0',
                                    )}
                                />
                                {allLabel}
                            </CommandItem>
                            {options.map((option) => (
                                <CommandItem
                                    key={option.value}
                                    value={option.label}
                                    onSelect={() => select(option.value)}
                                    className="gap-2"
                                >
                                    <Check
                                        className={cn(
                                            'h-4 w-4 shrink-0',
                                            value !== option.value &&
                                                'opacity-0',
                                        )}
                                    />
                                    <span className="whitespace-normal">
                                        {option.label}
                                    </span>
                                </CommandItem>
                            ))}
                        </CommandGroup>
                    </CommandList>
                </Command>
            </PopoverContent>
        </Popover>
    );
}
