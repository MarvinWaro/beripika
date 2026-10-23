import { Building2, Loader2, Search, X } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface SearchInstitutionCardProps {
    searchTerm: string;
    onSearchTermChange: (value: string) => void;
    isSearching: boolean;
    onSearch: () => void;
    searchMessage: string | null;
    searchMessageType: 'warning' | 'error' | null;
    institutionsCount: number;
    onClear: () => void;
}

export default function SearchInstitutionCard({
    searchTerm,
    onSearchTermChange,
    isSearching,
    onSearch,
    searchMessage,
    searchMessageType,
    institutionsCount,
    onClear,
}: SearchInstitutionCardProps) {
    return (
        <div className="rounded-(--radius-hero) bg-card p-6 text-card-foreground shadow-[0_24px_64px_-24px_rgb(0_0_0/0.55)] ring-1 ring-black/5 sm:p-8 dark:ring-white/10">
            <div className="mb-6 flex items-center gap-3">
                <div className="grid size-11 place-items-center rounded-full bg-blue-50 text-primary dark:bg-blue-500/15">
                    <Building2 className="size-5" />
                </div>
                <div>
                    <h2 className="text-lg font-semibold">
                        Find an institution
                    </h2>
                    <p className="text-sm text-muted-foreground">
                        Search by school name or HEI code
                    </p>
                </div>
            </div>

            <form
                role="search"
                aria-label="Institution lookup"
                onSubmit={(event) => {
                    event.preventDefault();
                    onSearch();
                }}
                className="flex flex-col gap-3"
            >
                <label htmlFor="institution-search" className="relative block">
                    <span className="sr-only">Institution code or name</span>
                    <Search className="pointer-events-none absolute top-1/2 left-5 size-5 -translate-y-1/2 text-muted-foreground" />
                    <input
                        id="institution-search"
                        type="text"
                        aria-describedby={
                            searchMessage
                                ? 'institution-search-message'
                                : undefined
                        }
                        aria-invalid={searchMessageType === 'error'}
                        autoComplete="off"
                        placeholder="e.g. Notre Dame or 12001"
                        value={searchTerm}
                        onChange={(e) => onSearchTermChange(e.target.value)}
                        disabled={isSearching}
                        className="h-14 w-full rounded-(--radius-button) border border-transparent bg-muted pr-5 pl-13 text-base outline-none transition placeholder:text-muted-foreground focus:border-primary focus:bg-background focus:ring-4 focus:ring-primary/15 disabled:opacity-60"
                    />
                </label>

                <Button
                    type="submit"
                    size="lg"
                    className="h-14 w-full"
                    disabled={isSearching}
                >
                    {isSearching ? (
                        <>
                            <Loader2 className="size-5 animate-spin" />
                            Searching…
                        </>
                    ) : (
                        'Search'
                    )}
                </Button>

                {searchMessage && (
                    <div
                        id="institution-search-message"
                        role={searchMessageType === 'error' ? 'alert' : 'status'}
                        aria-live="polite"
                        className={`rounded-(--radius-card) px-4 py-3 text-sm ${
                            searchMessageType === 'error'
                                ? 'bg-red-50 text-red-700 dark:bg-red-500/10 dark:text-red-300'
                                : 'bg-amber-50 text-amber-800 dark:bg-amber-500/10 dark:text-amber-200'
                        }`}
                    >
                        {searchMessage}
                    </div>
                )}
            </form>

            {institutionsCount > 0 && (
                <div
                    role="status"
                    aria-live="polite"
                    className="mt-4 flex items-center justify-between rounded-(--radius-button) bg-muted py-1.5 pr-1.5 pl-4"
                >
                    <span className="text-sm font-medium">
                        <span className="num text-success">●</span>{' '}
                        {institutionsCount} institution
                        {institutionsCount !== 1 ? 's' : ''} found
                    </span>
                    <Button
                        type="button"
                        onClick={onClear}
                        variant="ghost"
                        size="sm"
                    >
                        <X className="size-3.5" />
                        Clear
                    </Button>
                </div>
            )}
        </div>
    );
}
