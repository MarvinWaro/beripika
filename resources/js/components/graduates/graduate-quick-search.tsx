import { Loader2, Search } from 'lucide-react';
import { useEffect, useState } from 'react';
import GraduateDetailsDialog from '@/components/graduates/graduate-details-dialog';
import { Badge } from '@/components/ui/badge';
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
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';

interface SearchResult {
    id: number;
    name: string;
    so_number: string | null;
    program: string;
    institution: string;
    year_graduated: string | null;
}

type Status = 'idle' | 'loading' | 'done' | 'error';

const MIN_QUERY_LENGTH = 2;
const DEBOUNCE_MS = 300;
/** DashboardController::searchGraduates returns at most this many matches. */
const MAX_RESULTS = 10;

const isMac =
    typeof navigator !== 'undefined' &&
    /Mac|iPhone|iPad/.test(navigator.userAgent);

/**
 * Header search for graduate records, available on every page (Ctrl/⌘ + K).
 * Results come from the server (no client-side filtering); choosing one opens the full record.
 */
export default function GraduateQuickSearch() {
    const [open, setOpen] = useState(false);
    const [query, setQuery] = useState('');
    const [results, setResults] = useState<SearchResult[]>([]);
    const [status, setStatus] = useState<Status>('idle');
    const [selectedId, setSelectedId] = useState<number | null>(null);

    useEffect(() => {
        const onKeyDown = (event: KeyboardEvent) => {
            if (
                event.key.toLowerCase() === 'k' &&
                (event.ctrlKey || event.metaKey)
            ) {
                event.preventDefault();
                setOpen((value) => !value);
            }
        };
        document.addEventListener('keydown', onKeyDown);
        return () => document.removeEventListener('keydown', onKeyDown);
    }, []);

    useEffect(() => {
        const term = query.trim();
        if (!open || term.length < MIN_QUERY_LENGTH) {
            setResults([]);
            setStatus('idle');
            return;
        }
        const controller = new AbortController();
        setStatus('loading');
        // Debounced; each new keystroke cancels the previous request.
        const timer = setTimeout(() => {
            fetch(`/dashboard/search?q=${encodeURIComponent(term)}`, {
                headers: { Accept: 'application/json' },
                signal: controller.signal,
            })
                .then((response) => {
                    if (!response.ok) throw new Error(String(response.status));
                    return response.json() as Promise<SearchResult[]>;
                })
                .then((data) => {
                    setResults(data);
                    setStatus('done');
                })
                .catch(() => {
                    if (!controller.signal.aborted) setStatus('error');
                });
        }, DEBOUNCE_MS);
        return () => {
            clearTimeout(timer);
            controller.abort();
        };
    }, [query, open]);

    const choose = (id: number) => {
        setOpen(false);
        setSelectedId(id);
    };

    return (
        <>
            <Button
                variant="outline"
                onClick={() => setOpen(true)}
                aria-label="Search graduates"
                aria-keyshortcuts={isMac ? 'Meta+K' : 'Control+K'}
                className="h-9 gap-2 px-2.5 font-normal text-muted-foreground sm:w-64 sm:justify-between sm:px-3"
            >
                <span className="flex items-center gap-2">
                    <Search className="size-4" aria-hidden="true" />
                    <span className="hidden sm:inline">Search graduates…</span>
                </span>
                <kbd className="pointer-events-none hidden rounded border bg-muted px-1.5 py-0.5 font-mono text-[10px] font-medium sm:inline">
                    {isMac ? '⌘ K' : 'Ctrl K'}
                </kbd>
            </Button>

            <Dialog open={open} onOpenChange={setOpen}>
                <DialogContent className="top-[15%] translate-y-0 overflow-hidden p-0 sm:max-w-xl">
                    <DialogHeader className="sr-only">
                        <DialogTitle>Search graduates</DialogTitle>
                        <DialogDescription>
                            Search all graduate records by name, SO number or
                            program.
                        </DialogDescription>
                    </DialogHeader>
                    <Command
                        shouldFilter={false}
                        className="**:data-[slot=command-input-wrapper]:h-12 [&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:font-medium [&_[cmdk-group-heading]]:text-muted-foreground [&_[cmdk-input]]:h-12"
                    >
                        <CommandInput
                            value={query}
                            onValueChange={setQuery}
                            placeholder="Name, SO number or program…"
                        />
                        <CommandList className="max-h-[60vh]">
                            {status === 'idle' && (
                                <p className="py-6 text-center text-sm text-muted-foreground">
                                    Type at least {MIN_QUERY_LENGTH} characters.
                                </p>
                            )}
                            {status === 'loading' && results.length === 0 && (
                                <p
                                    role="status"
                                    className="flex items-center justify-center gap-2 py-6 text-sm text-muted-foreground"
                                >
                                    <Loader2 className="size-4 animate-spin motion-reduce:animate-none" />
                                    Searching…
                                </p>
                            )}
                            {status === 'error' && (
                                <p
                                    role="alert"
                                    className="py-6 text-center text-sm text-muted-foreground"
                                >
                                    Search failed. Check your connection and try
                                    again.
                                </p>
                            )}
                            {status === 'done' && (
                                <CommandEmpty>
                                    No graduates found for “{query.trim()}”.
                                </CommandEmpty>
                            )}
                            {results.length > 0 && (
                                <CommandGroup heading="Graduates">
                                    {results.map((result) => (
                                        <CommandItem
                                            key={result.id}
                                            value={String(result.id)}
                                            onSelect={() => choose(result.id)}
                                            className="flex items-start justify-between gap-3 py-3"
                                        >
                                            <div className="min-w-0">
                                                <p className="truncate font-medium">
                                                    {result.name}
                                                </p>
                                                <p className="truncate text-xs text-muted-foreground">
                                                    {result.program}
                                                </p>
                                                <p className="truncate text-xs text-muted-foreground">
                                                    {result.institution}
                                                </p>
                                            </div>
                                            <div className="flex shrink-0 flex-col items-end gap-1">
                                                {result.so_number && (
                                                    <Badge
                                                        variant="outline"
                                                        className="font-mono text-xs"
                                                    >
                                                        {result.so_number}
                                                    </Badge>
                                                )}
                                                {result.year_graduated && (
                                                    <span className="text-xs text-muted-foreground">
                                                        {result.year_graduated}
                                                    </span>
                                                )}
                                            </div>
                                        </CommandItem>
                                    ))}
                                </CommandGroup>
                            )}
                        </CommandList>
                        <p className="border-t px-3 py-2 text-xs text-muted-foreground">
                            {results.length >= MAX_RESULTS
                                ? `Showing the first ${MAX_RESULTS} matches; type more to narrow down, or use Graduates for filters.`
                                : 'Enter to open a record · Esc to close'}
                        </p>
                    </Command>
                </DialogContent>
            </Dialog>

            <GraduateDetailsDialog
                graduateId={selectedId}
                onClose={() => setSelectedId(null)}
            />
        </>
    );
}
