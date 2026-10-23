// resources/js/components/welcome/permit-dialog.tsx
//
// Permit viewer shown as a right-side drawer (full screen on phones).
// The program list stays visible beside it, and choosing another program
// simply swaps the document. Props are unchanged so every page that uses
// <PermitDialog> keeps working.

import axios from 'axios';
import {
    AlertCircle,
    Check,
    ChevronLeft,
    ChevronRight,
    Copy,
    Download,
    ExternalLink,
    FileText,
    FileWarning,
    Loader2,
    Maximize2,
    School,
    X,
    ZoomIn,
    ZoomOut,
} from 'lucide-react';
import workerSrc from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Document, Page, pdfjs } from 'react-pdf';
import 'react-pdf/dist/Page/AnnotationLayer.css';
import 'react-pdf/dist/Page/TextLayer.css';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
    Sheet,
    SheetContent,
    SheetDescription,
    SheetHeader,
    SheetTitle,
} from '@/components/ui/sheet';
import { cn } from '@/lib/utils';

// Bundle the PDF.js worker with the app instead of loading it from a CDN.
pdfjs.GlobalWorkerOptions.workerSrc = workerSrc;

interface ProgramInstitution {
    code: string;
    name: string;
    type: string;
}

interface Program {
    id: number | null;
    name: string;
    major: string | null;
    copNumber: string | null;
    grNumber: string | null;
    institution?: ProgramInstitution | undefined;
    permitPdfUrl?: string | null;
}

interface PermitDialogProps {
    open: boolean;
    program: Program | null;
    onOpenChange: (open: boolean) => void;
}

const ZOOM_STEPS = [0.75, 1, 1.25, 1.5, 2];

export default function PermitDialog({ open, program, onOpenChange }: PermitDialogProps) {
    const [blobUrl, setBlobUrl] = useState<string | null>(null);
    const [isLoadingBlob, setIsLoadingBlob] = useState(false);
    const [blobError, setBlobError] = useState<string | null>(null);
    const [directUrl, setDirectUrl] = useState<string | null>(null);
    const [numPages, setNumPages] = useState<number | null>(null);
    const [pageNumber, setPageNumber] = useState(1);
    const [zoomIndex, setZoomIndex] = useState(1); // 1 = fit width
    const [isFullscreen, setIsFullscreen] = useState(false);
    const [pdfRenderFailed, setPdfRenderFailed] = useState(false);
    const [copied, setCopied] = useState(false);
    const [viewerWidth, setViewerWidth] = useState(600);

    const viewerRef = useRef<HTMLDivElement>(null);
    const pageContainerRef = useRef<HTMLDivElement>(null);
    const blobRef = useRef<string | null>(null);

    const permitUrl = program?.permitPdfUrl ?? null;
    const hasCopNumber = !!program?.copNumber;
    const hasGrNumber = !!program?.grNumber;
    const hasPermitNumber = hasCopNumber || hasGrNumber;
    const hasPermitFile = !!permitUrl;
    const permitNumberLabel = hasCopNumber ? 'COPC Number' : hasGrNumber ? 'GR Number' : 'Permit Number';
    const permitNumberValue = hasCopNumber ? program?.copNumber : hasGrNumber ? program?.grNumber : null;
    const zoom = ZOOM_STEPS[zoomIndex];

    const releaseBlob = () => {
        if (blobRef.current) {
            URL.revokeObjectURL(blobRef.current);
            blobRef.current = null;
        }
        setBlobUrl(null);
    };

    // Measure the viewer so the page fits the drawer width (and reacts to resizing).
    useEffect(() => {
        const el = viewerRef.current;
        if (!el) return;
        const observer = new ResizeObserver(([entry]) => {
            setViewerWidth(Math.max(260, Math.floor(entry.contentRect.width) - 32));
        });
        observer.observe(el);

        return () => observer.disconnect();
    }, [open, isFullscreen, blobUrl]);

    // Fetch the PDF through the server proxy whenever the selected program changes.
    useEffect(() => {
        if (!open || !permitUrl) return;

        let cancelled = false;
        releaseBlob();
        setIsLoadingBlob(true);
        setBlobError(null);
        setDirectUrl(null);
        setNumPages(null);
        setPageNumber(1);
        setPdfRenderFailed(false);

        const fallback = (data?: unknown) => {
            const finish = (url: string | null) => {
                if (cancelled) return;
                setDirectUrl(url || permitUrl);
                setBlobError('proxy_failed');
                setIsLoadingBlob(false);
            };
            if (data instanceof Blob) {
                data.text()
                    .then((text) => {
                        try {
                            finish(JSON.parse(text).direct_url ?? null);
                        } catch {
                            finish(null);
                        }
                    })
                    .catch(() => finish(null));
            } else {
                finish(null);
            }
        };

        const csrfToken = document.querySelector('meta[name="csrf-token"]')?.getAttribute('content') || '';

        axios
            .post('/api/permit-pdf-proxy', { url: permitUrl }, { responseType: 'blob', headers: { 'X-CSRF-TOKEN': csrfToken } })
            .then((response) => {
                if (cancelled) return;
                if (response.data.type === 'application/json') {
                    fallback(response.data);

                    return;
                }
                const url = URL.createObjectURL(response.data);
                blobRef.current = url;
                setBlobUrl(url);
                setIsLoadingBlob(false);
            })
            .catch((error) => fallback(error.response?.data));

        return () => {
            cancelled = true;
        };
    }, [open, permitUrl]);

    // Reset everything when the drawer closes.
    useEffect(() => {
        if (!open) {
            releaseBlob();
            setNumPages(null);
            setPageNumber(1);
            setZoomIndex(1);
            setIsFullscreen(false);
            setDirectUrl(null);
            setBlobError(null);
            setPdfRenderFailed(false);
        }
    }, [open]);

    useEffect(() => () => releaseBlob(), []);

    // ESC closes fullscreen first.
    useEffect(() => {
        if (!isFullscreen) return;
        const onKey = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                e.stopPropagation();
                setIsFullscreen(false);
            }
        };
        document.addEventListener('keydown', onKey, true);
        document.body.style.overflow = 'hidden';

        return () => {
            document.removeEventListener('keydown', onKey, true);
            document.body.style.overflow = '';
        };
    }, [isFullscreen]);

    const openInNewTab = () => {
        const url = blobUrl || directUrl || permitUrl;
        if (url) window.open(url, '_blank', 'noopener,noreferrer');
    };

    const download = () => {
        if (!blobUrl) return;
        const a = document.createElement('a');
        a.href = blobUrl;
        a.download = `${(permitNumberValue || program?.name || 'permit').replace(/[^\w.-]+/g, '_')}.pdf`;
        a.click();
    };

    const copyNumber = async () => {
        if (!permitNumberValue) return;
        try {
            await navigator.clipboard.writeText(permitNumberValue);
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
        } catch {
            // clipboard blocked — ignore
        }
    };

    // After react-pdf reports success, make sure the canvas is not blank.
    const onPageRenderSuccess = useCallback(() => {
        setTimeout(() => {
            const canvas = pageContainerRef.current?.querySelector('canvas');
            if (!canvas) return;
            try {
                const ctx = canvas.getContext('2d');
                if (!ctx) return;
                const { width: w, height: h } = canvas;
                if (w === 0 || h === 0) {
                    setPdfRenderFailed(true);

                    return;
                }
                const points = [
                    [0.25, 0.25], [0.5, 0.5], [0.75, 0.75], [0.5, 0.25], [0.25, 0.75],
                ];
                const blank = points.every(([px, py]) => {
                    const [r, g, b, a] = ctx.getImageData(Math.floor(w * px), Math.floor(h * py), 1, 1).data;

                    return a === 0 || (r >= 250 && g >= 250 && b >= 250 && a > 200);
                });
                if (blank) setPdfRenderFailed(true);
            } catch {
                setPdfRenderFailed(true);
            }
        }, 300);
    }, []);

    const hasPreview = !!blobUrl && !pdfRenderFailed;
    const pageWidth = Math.round(viewerWidth * zoom);

    /* ───────── PDF viewer (shared by drawer and fullscreen) ───────── */
    const viewer = (dark: boolean) => (
        <div ref={viewerRef} className={cn('min-h-0 flex-1 overflow-auto', dark ? 'bg-black/95' : 'bg-muted')}>
            {isLoadingBlob ? (
                <CenteredState icon={<Loader2 className="size-10 animate-spin text-primary" />} title="Loading permit…" dark={dark} />
            ) : blobError ? (
                <CenteredState
                    icon={<AlertCircle className="size-10 text-amber-500" />}
                    title="Unable to preview PDF inline"
                    text="The document is on the CHED portal but can't be shown here. Open it directly instead."
                    dark={dark}
                    action={
                        (directUrl || permitUrl) && (
                            <Button onClick={() => window.open(directUrl || permitUrl!, '_blank', 'noopener,noreferrer')}>
                                <ExternalLink className="size-4" />
                                Open permit in new tab
                            </Button>
                        )
                    }
                />
            ) : hasPreview ? (
                <div ref={pageContainerRef} className="flex min-h-full justify-center p-4">
                    <Document
                        file={blobUrl}
                        onLoadSuccess={({ numPages: n }) => setNumPages(n)}
                        loading={<CenteredState icon={<Loader2 className="size-8 animate-spin text-primary" />} title="Rendering…" dark={dark} />}
                        error={
                            <CenteredState
                                icon={<AlertCircle className="size-10 text-amber-500" />}
                                title="Unable to render PDF"
                                dark={dark}
                                action={
                                    <Button size="sm" onClick={openInNewTab}>
                                        <ExternalLink className="size-4" />
                                        Open in new tab
                                    </Button>
                                }
                            />
                        }
                    >
                        <Page
                            pageNumber={pageNumber}
                            width={pageWidth}
                            renderTextLayer
                            renderAnnotationLayer
                            className="shadow-xl"
                            onRenderError={() => setPdfRenderFailed(true)}
                            onRenderSuccess={onPageRenderSuccess}
                        />
                    </Document>
                </div>
            ) : blobUrl && pdfRenderFailed ? (
                <CenteredState
                    icon={<FileText className="size-10 text-primary" />}
                    title="Preview not available"
                    text="This document can't be previewed here, but you can open it in your browser."
                    dark={dark}
                    action={
                        <Button onClick={openInNewTab}>
                            <ExternalLink className="size-4" />
                            Open permit in new tab
                        </Button>
                    }
                />
            ) : null}
        </div>
    );

    const toolbar = (dark: boolean) =>
        hasPreview && (
            <div className={cn('flex shrink-0 items-center justify-between gap-2 border-t px-4 py-2', dark ? 'border-white/10 bg-black/80 text-white' : 'bg-background')}>
                <div className="flex items-center gap-1">
                    <Button variant="ghost" size="icon" aria-label="Previous page" disabled={pageNumber <= 1} onClick={() => setPageNumber((p) => Math.max(1, p - 1))} className={dark ? 'text-white hover:bg-white/10' : ''}>
                        <ChevronLeft className="size-4" />
                    </Button>
                    <span className="num min-w-16 text-center text-xs">
                        {pageNumber} / {numPages ?? '–'}
                    </span>
                    <Button variant="ghost" size="icon" aria-label="Next page" disabled={!numPages || pageNumber >= numPages} onClick={() => setPageNumber((p) => Math.min(numPages ?? 1, p + 1))} className={dark ? 'text-white hover:bg-white/10' : ''}>
                        <ChevronRight className="size-4" />
                    </Button>
                </div>
                <div className="flex items-center gap-1">
                    <Button variant="ghost" size="icon" aria-label="Zoom out" disabled={zoomIndex === 0} onClick={() => setZoomIndex((z) => Math.max(0, z - 1))} className={dark ? 'text-white hover:bg-white/10' : ''}>
                        <ZoomOut className="size-4" />
                    </Button>
                    <button type="button" onClick={() => setZoomIndex(1)} className="num min-w-12 text-center text-xs hover:underline" title="Fit to width">
                        {Math.round(zoom * 100)}%
                    </button>
                    <Button variant="ghost" size="icon" aria-label="Zoom in" disabled={zoomIndex === ZOOM_STEPS.length - 1} onClick={() => setZoomIndex((z) => Math.min(ZOOM_STEPS.length - 1, z + 1))} className={dark ? 'text-white hover:bg-white/10' : ''}>
                        <ZoomIn className="size-4" />
                    </Button>
                </div>
            </div>
        );

    /* ───────── Fullscreen ───────── */
    if (isFullscreen && hasPermitFile) {
        return (
            <div className="fixed inset-0 z-[100] flex flex-col bg-black/95">
                <div className="flex shrink-0 items-center justify-between gap-4 bg-black/60 px-6 py-4 text-white backdrop-blur-sm">
                    <div className="min-w-0">
                        <h3 className="truncate text-lg font-semibold">{program?.name}</h3>
                        {permitNumberValue && (
                            <p className="text-sm break-words text-gray-300">
                                {permitNumberLabel}: <span className="num">{permitNumberValue}</span>
                            </p>
                        )}
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                        <Button onClick={openInNewTab} variant="secondary" size="sm" className="bg-white/10 text-white hover:bg-white/20">
                            <ExternalLink className="size-4" />
                            <span className="hidden sm:inline">Open in new tab</span>
                        </Button>
                        <Button onClick={() => setIsFullscreen(false)} variant="ghost" size="icon" aria-label="Exit fullscreen" className="text-white hover:bg-white/10">
                            <X className="size-6" />
                        </Button>
                    </div>
                </div>
                {viewer(true)}
                {toolbar(true)}
            </div>
        );
    }

    /* ───────── Drawer ───────── */
    return (
        <Sheet open={open} onOpenChange={onOpenChange}>
            <SheetContent side="right" className="w-full gap-0 p-0 sm:max-w-[min(760px,100vw)]">
                {program && (
                    <>
                        <SheetHeader className="shrink-0 gap-3 border-b px-5 pt-5 pb-4 pr-12">
                            <SheetTitle className="text-base leading-snug break-words">{program.name}</SheetTitle>
                            <SheetDescription asChild>
                                <div className="space-y-2">
                                    {program.institution && (
                                        <p className="flex flex-wrap items-center gap-1.5 text-sm text-muted-foreground">
                                            <School className="size-4 shrink-0" />
                                            <span className="break-words">{program.institution.name}</span>
                                            <Badge variant="secondary" className="text-[11px]">
                                                {program.institution.type === 'public' ? 'Public' : 'Private'}
                                            </Badge>
                                        </p>
                                    )}
                                    {program.major && (
                                        <p className="text-sm text-muted-foreground">
                                            <span className="font-medium text-foreground">Major:</span> {program.major}
                                        </p>
                                    )}
                                    <div className="flex flex-wrap items-center gap-2">
                                        {permitNumberValue ? (
                                            <span
                                                className={cn(
                                                    'inline-flex max-w-full items-start gap-1 rounded-(--radius-field) border px-2.5 py-1 text-xs',
                                                    hasPermitFile
                                                        ? 'border-green-200 bg-green-50 text-green-800 dark:border-green-800 dark:bg-green-900/30 dark:text-green-200'
                                                        : 'border-purple-200 bg-purple-50 text-purple-800 dark:border-purple-800 dark:bg-purple-900/30 dark:text-purple-200',
                                                )}
                                            >
                                                <span className="shrink-0 font-medium">{permitNumberLabel}:</span>
                                                <span className="num min-w-0 font-semibold break-words [overflow-wrap:anywhere]">{permitNumberValue}</span>
                                            </span>
                                        ) : hasPermitFile ? (
                                            <Badge variant="outline" className="text-[11px]">
                                                <FileText className="size-3" /> Document linked
                                            </Badge>
                                        ) : (
                                            <Badge variant="outline" className="border-red-200 bg-red-50 text-[11px] text-red-700 dark:border-red-900/50 dark:bg-red-900/20 dark:text-red-300">
                                                <AlertCircle className="size-3" /> CHECK WITH CHED
                                            </Badge>
                                        )}
                                    </div>
                                </div>
                            </SheetDescription>

                            {/* Actions */}
                            <div className="flex flex-wrap gap-2">
                                {permitNumberValue && (
                                    <Button variant="outline" size="sm" onClick={copyNumber}>
                                        {copied ? <Check className="size-4 text-green-600" /> : <Copy className="size-4" />}
                                        {copied ? 'Copied' : 'Copy number'}
                                    </Button>
                                )}
                                {hasPermitFile && (
                                    <Button variant="outline" size="sm" onClick={openInNewTab} disabled={isLoadingBlob}>
                                        <ExternalLink className="size-4" />
                                        Open in new tab
                                    </Button>
                                )}
                                {blobUrl && (
                                    <Button variant="outline" size="sm" onClick={download}>
                                        <Download className="size-4" />
                                        Download
                                    </Button>
                                )}
                                {hasPreview && (
                                    <Button variant="outline" size="sm" onClick={() => setIsFullscreen(true)}>
                                        <Maximize2 className="size-4" />
                                        Fullscreen
                                    </Button>
                                )}
                            </div>
                        </SheetHeader>

                        {hasPermitFile ? (
                            <>
                                {viewer(false)}
                                {toolbar(false)}
                            </>
                        ) : hasPermitNumber ? (
                            <div className="flex flex-1 items-center justify-center p-6">
                                <div className="max-w-md rounded-(--radius-card) border-2 border-dashed border-purple-300 bg-purple-50/50 p-8 text-center dark:border-purple-700 dark:bg-purple-900/10">
                                    <div className="mx-auto mb-5 w-fit rounded-full bg-purple-100 p-4 dark:bg-purple-900/40">
                                        <FileWarning className="size-8 text-purple-600 dark:text-purple-300" />
                                    </div>
                                    <h4 className="mb-2 text-lg font-semibold text-purple-900 dark:text-purple-100">Permit number recorded</h4>
                                    <p className="text-sm text-purple-700 dark:text-purple-300">
                                        A permit number is recorded for this program, but the digital copy (PDF) has not been
                                        uploaded to the registry yet.
                                    </p>
                                </div>
                            </div>
                        ) : (
                            <div className="flex flex-1 items-center justify-center p-6">
                                <div className="max-w-md rounded-(--radius-card) border-2 border-dashed border-red-300 bg-red-50/50 p-8 text-center dark:border-red-800 dark:bg-red-900/10">
                                    <div className="mx-auto mb-5 w-fit animate-pulse rounded-full bg-red-100 p-5 dark:bg-red-900/30">
                                        <AlertCircle className="size-12 text-red-600 dark:text-red-400" />
                                    </div>
                                    <h4 className="mb-2 text-lg font-semibold text-red-900 dark:text-red-100">CHECK WITH CHED</h4>
                                    <p className="text-sm text-red-700 dark:text-red-300">
                                        No permit number is currently recorded for this program. Please contact CHED for
                                        verification.
                                    </p>
                                </div>
                            </div>
                        )}
                    </>
                )}
            </SheetContent>
        </Sheet>
    );
}

function CenteredState({
    icon,
    title,
    text,
    action,
    dark,
}: {
    icon: React.ReactNode;
    title: string;
    text?: string;
    action?: React.ReactNode;
    dark: boolean;
}) {
    return (
        <div className="flex min-h-[420px] flex-col items-center justify-center gap-3 p-8 text-center">
            {icon}
            <p className={cn('text-sm font-semibold', dark ? 'text-white' : 'text-foreground')}>{title}</p>
            {text && <p className={cn('max-w-xs text-xs', dark ? 'text-gray-400' : 'text-muted-foreground')}>{text}</p>}
            {action && <div className="mt-2">{action}</div>}
        </div>
    );
}
