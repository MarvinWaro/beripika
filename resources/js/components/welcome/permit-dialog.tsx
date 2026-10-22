// resources/js/components/welcome/permit-dialog.tsx

import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { GraduationCap, School, AlertCircle, Loader2, Maximize2, ChevronLeft, ChevronRight, X, FileText, FileWarning, ExternalLink } from 'lucide-react';
import { useState, useEffect, useRef, useCallback } from 'react';
import { Document, Page, pdfjs } from 'react-pdf';
import axios from 'axios';

// Import CSS styles for react-pdf
import 'react-pdf/dist/Page/AnnotationLayer.css';
import 'react-pdf/dist/Page/TextLayer.css';

// Configure PDF.js worker
pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

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

export default function PermitDialog({
    open,
    program,
    onOpenChange,
}: PermitDialogProps) {
    const [blobUrl, setBlobUrl] = useState<string | null>(null);
    const [isLoadingBlob, setIsLoadingBlob] = useState(false);
    const [blobError, setBlobError] = useState<string | null>(null);
    const [directUrl, setDirectUrl] = useState<string | null>(null);
    const [numPages, setNumPages] = useState<number | null>(null);
    const [pageNumber, setPageNumber] = useState(1);
    const [isFullscreen, setIsFullscreen] = useState(false);
    const [pdfWidth, setPdfWidth] = useState(600);
    const [pdfRenderFailed, setPdfRenderFailed] = useState(false);

    const permitUrl = program?.permitPdfUrl ?? null;

    const hasCopNumber = !!program?.copNumber;
    const hasGrNumber = !!program?.grNumber;
    const hasPermitNumber = hasCopNumber || hasGrNumber;
    const hasPermitFile = !!permitUrl;

    const permitNumberLabel = hasCopNumber
        ? 'COPC Number'
        : hasGrNumber
        ? 'GR Number'
        : 'Permit Number';

    const permitNumberValue = hasCopNumber
        ? program?.copNumber
        : hasGrNumber
        ? program?.grNumber
        : null;

    // Helper: Match the badge logic from ProgramsList
    const getBadgeStyle = (hasPdf: boolean) => {
        if (hasPdf) {
            // Green: Has Permit + PDF
            return "border-green-200 bg-green-50 text-green-700 dark:border-green-700 dark:bg-green-900/30 dark:text-green-300";
        }
        // Purple: Has Permit but No PDF
        return "border-purple-200 bg-purple-50 text-purple-700 dark:border-purple-700 dark:bg-purple-900/30 dark:text-purple-300";
    };

    // Calculate PDF width based on window size
    useEffect(() => {
        const calculateWidth = () => {
            if (isFullscreen) {
                setPdfWidth(Math.min(window.innerWidth * 0.85, 1400));
            } else {
                setPdfWidth(Math.min(window.innerWidth * 0.6, 900));
            }
        };

        calculateWidth();
        window.addEventListener('resize', calculateWidth);
        return () => window.removeEventListener('resize', calculateWidth);
    }, [isFullscreen]);

    // Fetch PDF and create blob URL using Axios
    useEffect(() => {
        if (!open || !permitUrl) {
            return;
        }

        setIsLoadingBlob(true);
        setBlobError(null);
        setDirectUrl(null);
        setPageNumber(1);
        setPdfRenderFailed(false);

        const csrfToken = document.querySelector('meta[name="csrf-token"]')?.getAttribute('content') || '';

        axios.post('/api/permit-pdf-proxy', { url: permitUrl }, {
            responseType: 'blob',
            headers: {
                'X-CSRF-TOKEN': csrfToken
            }
        })
        .then(response => {
            // Check if the response is actually JSON (error) instead of a PDF blob
            if (response.data.type === 'application/json') {
                // Proxy returned JSON error — read it to get direct_url
                response.data.text().then((text: string) => {
                    try {
                        const json = JSON.parse(text);
                        setDirectUrl(json.direct_url || permitUrl);
                    } catch {
                        setDirectUrl(permitUrl);
                    }
                    setBlobError('proxy_failed');
                    setIsLoadingBlob(false);
                });
                return;
            }

            const url = URL.createObjectURL(response.data);
            setBlobUrl(url);
            setIsLoadingBlob(false);
        })
        .catch(error => {
            console.error('Error fetching PDF:', error);

            // Try to extract direct_url from error response
            const errorData = error.response?.data;
            if (errorData instanceof Blob) {
                errorData.text().then((text: string) => {
                    try {
                        const json = JSON.parse(text);
                        setDirectUrl(json.direct_url || permitUrl);
                    } catch {
                        setDirectUrl(permitUrl);
                    }
                    setBlobError('proxy_failed');
                    setIsLoadingBlob(false);
                });
            } else {
                setDirectUrl(permitUrl);
                setBlobError('proxy_failed');
                setIsLoadingBlob(false);
            }
        });

        return () => {
            if (blobUrl) {
                URL.revokeObjectURL(blobUrl);
                setBlobUrl(null);
            }
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [open, permitUrl]);

    // Also cleanup when dialog closes explicitly
    useEffect(() => {
        if (!open && blobUrl) {
            URL.revokeObjectURL(blobUrl);
            setBlobUrl(null);
            setNumPages(null);
            setPageNumber(1);
            setIsFullscreen(false);
            setDirectUrl(null);
            setBlobError(null);
            setPdfRenderFailed(false);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [open]);

    // Handle ESC key to close fullscreen
    useEffect(() => {
        const handleEscape = (e: KeyboardEvent) => {
            if (e.key === 'Escape' && isFullscreen) {
                setIsFullscreen(false);
            }
        };

        if (isFullscreen) {
            document.addEventListener('keydown', handleEscape);
            document.body.style.overflow = 'hidden';
        } else {
            document.body.style.overflow = '';
        }

        return () => {
            document.removeEventListener('keydown', handleEscape);
            document.body.style.overflow = '';
        };
    }, [isFullscreen]);

    function onDocumentLoadSuccess({ numPages }: { numPages: number }) {
        setNumPages(numPages);
    }

    function goToPrevPage() {
        setPageNumber(prev => Math.max(prev - 1, 1));
    }

    function goToNextPage() {
        setPageNumber(prev => Math.min(prev + 1, numPages || 1));
    }

    function toggleFullscreen() {
        setIsFullscreen(!isFullscreen);
    }

    function openInNewTab() {
        if (blobUrl) {
            window.open(blobUrl, '_blank', 'noopener');
        } else if (directUrl || permitUrl) {
            window.open(directUrl || permitUrl!, '_blank', 'noopener,noreferrer');
        }
    }

    function onPageRenderError() {
        setPdfRenderFailed(true);
    }

    // Ref for the container that holds the react-pdf Page canvas
    const pageContainerRef = useRef<HTMLDivElement>(null);

    // After react-pdf renders "successfully", check if the canvas is actually blank
    const onPageRenderSuccess = useCallback(() => {
        // Give the canvas a moment to fully paint
        setTimeout(() => {
            const container = pageContainerRef.current;
            if (!container) return;

            const canvas = container.querySelector('canvas');
            if (!canvas) return;

            try {
                const ctx = canvas.getContext('2d');
                if (!ctx) return;

                // Sample pixels from several spots across the canvas
                const w = canvas.width;
                const h = canvas.height;
                if (w === 0 || h === 0) {
                    setPdfRenderFailed(true);
                    return;
                }

                const samplePoints = [
                    { x: Math.floor(w * 0.25), y: Math.floor(h * 0.25) },
                    { x: Math.floor(w * 0.5), y: Math.floor(h * 0.5) },
                    { x: Math.floor(w * 0.75), y: Math.floor(h * 0.75) },
                    { x: Math.floor(w * 0.5), y: Math.floor(h * 0.25) },
                    { x: Math.floor(w * 0.25), y: Math.floor(h * 0.75) },
                ];

                let allBlank = true;
                for (const pt of samplePoints) {
                    const pixel = ctx.getImageData(pt.x, pt.y, 1, 1).data;
                    // Check if pixel is white (255,255,255) or transparent (alpha=0)
                    const isWhite = pixel[0] >= 250 && pixel[1] >= 250 && pixel[2] >= 250 && pixel[3] > 200;
                    const isTransparent = pixel[3] === 0;
                    if (!isWhite && !isTransparent) {
                        allBlank = false;
                        break;
                    }
                }

                if (allBlank) {
                    setPdfRenderFailed(true);
                }
            } catch {
                // Canvas access can fail due to CORS — treat as render failure
                setPdfRenderFailed(true);
            }
        }, 300);
    }, []);

    // Fullscreen PDF Viewer
    if (isFullscreen && hasPermitFile) {
        return (
            <div className="fixed inset-0 z-[100] flex flex-col bg-black/95">
                <div className="flex-shrink-0 flex items-center justify-between bg-black/60 px-6 py-4 backdrop-blur-sm">
                    <div className="text-white">
                        <h3 className="text-lg font-semibold">{program?.name}</h3>
                        {permitNumberValue && (
                            <p className="text-sm text-gray-300">
                                {permitNumberLabel}: <span className="font-mono">{permitNumberValue}</span>
                            </p>
                        )}
                    </div>
                    <div className="flex items-center gap-2">
                        <Button
                            onClick={openInNewTab}
                            variant="secondary"
                            size="sm"
                            className="gap-2 bg-white/10 text-white hover:bg-white/20"
                        >
                            <ExternalLink className="h-4 w-4" />
                            Open in New Tab
                        </Button>
                        <Button
                            onClick={() => setIsFullscreen(false)}
                            variant="ghost"
                            size="icon"
                            className="text-white hover:bg-white/10"
                        >
                            <X className="h-6 w-6" />
                        </Button>
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto">
                    {blobUrl && !pdfRenderFailed ? (
                        <div ref={pageContainerRef} className="flex min-h-full items-start justify-center py-8">
                            <Document
                                file={blobUrl}
                                onLoadSuccess={onDocumentLoadSuccess}
                                loading={
                                    <div className="flex min-h-[500px] items-center justify-center">
                                        <Loader2 className="h-12 w-12 animate-spin text-white" />
                                    </div>
                                }
                                error={
                                    <div className="flex min-h-[500px] flex-col items-center justify-center p-8">
                                        <AlertCircle className="mb-4 h-12 w-12 text-amber-500" />
                                        <p className="text-sm font-semibold text-white">Unable to render PDF</p>
                                        <Button
                                            size="sm"
                                            onClick={openInNewTab}
                                            variant="secondary"
                                            className="mt-4 gap-2"
                                        >
                                            <ExternalLink className="h-4 w-4" />
                                            Open in New Tab
                                        </Button>
                                    </div>
                                }
                            >
                                <Page
                                    pageNumber={pageNumber}
                                    renderTextLayer={true}
                                    renderAnnotationLayer={true}
                                    className="shadow-2xl"
                                    width={pdfWidth}
                                    onRenderError={onPageRenderError}
                                    onRenderSuccess={onPageRenderSuccess}
                                />
                            </Document>
                        </div>
                    ) : blobUrl && pdfRenderFailed ? (
                        <div className="flex min-h-full flex-col items-center justify-center py-16">
                            <div className="mb-6 rounded-full bg-white/10 p-5">
                                <FileText className="h-10 w-10 text-white" />
                            </div>
                            <p className="text-base font-semibold text-white">Preview not available</p>
                            <p className="mt-2 mb-6 max-w-sm text-center text-sm text-gray-400">
                                This document cannot be previewed inline, but you can view it directly in your browser.
                            </p>
                            <Button
                                onClick={openInNewTab}
                                variant="secondary"
                                className="gap-2"
                            >
                                <ExternalLink className="h-4 w-4" />
                                Open Permit in New Tab
                            </Button>
                        </div>
                    ) : null}
                </div>

                {numPages && numPages > 1 && (
                    <div className="flex-shrink-0 flex items-center justify-center gap-4 bg-black/60 px-6 py-4 backdrop-blur-sm">
                        <Button
                            onClick={goToPrevPage}
                            disabled={pageNumber <= 1}
                            variant="secondary"
                            size="sm"
                            className="bg-white/10 text-white hover:bg-white/20"
                        >
                            <ChevronLeft className="mr-1 h-4 w-4" />
                            Previous
                        </Button>
                        <span className="text-sm font-medium text-white">
                            Page {pageNumber} of {numPages}
                        </span>
                        <Button
                            onClick={goToNextPage}
                            disabled={pageNumber >= numPages}
                            variant="secondary"
                            size="sm"
                            className="bg-white/10 text-white hover:bg-white/20"
                        >
                            Next
                            <ChevronRight className="ml-1 h-4 w-4" />
                        </Button>
                    </div>
                )}
            </div>
        );
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-[95vw] w-[1200px] max-h-[90vh] overflow-hidden flex flex-col">
                {program && (
                    <>
                        <DialogHeader className="flex-shrink-0">
                            <DialogTitle className="flex items-center justify-between gap-3">
                                <div className="flex items-center gap-3">
                                    <div className="rounded-lg bg-purple-100 p-3 dark:bg-purple-900/40">
                                        <GraduationCap className="h-6 w-6 text-purple-600 dark:text-purple-400" />
                                    </div>
                                    <span className="text-sm font-semibold leading-snug sm:text-base">
                                        {program.name}
                                    </span>
                                </div>
                                {hasPermitFile && blobUrl && (
                                    <Button
                                        onClick={toggleFullscreen}
                                        variant="outline"
                                        size="sm"
                                        className="gap-2"
                                    >
                                        <Maximize2 className="h-4 w-4" />
                                        <span className="hidden sm:inline">Fullscreen</span>
                                    </Button>
                                )}
                            </DialogTitle>
                        </DialogHeader>

                        <div className="flex-1 overflow-y-auto mt-4 space-y-6 pr-2">
                            {/* Program summary */}
                            <div className="rounded-lg bg-gray-50 p-4 dark:bg-gray-800/60">
                                {program.major && (
                                    <p className="text-xs sm:text-sm text-gray-700 dark:text-gray-300">
                                        <span className="font-medium">Major:</span> {program.major}
                                    </p>
                                )}
                                <div className="mt-3 flex flex-wrap items-center gap-3">
                                    {/* Updated Badges to match ProgramList logic */}
                                    {program.copNumber && (
                                        <Badge variant="outline" className={`text-[11px] ${getBadgeStyle(hasPermitFile)}`}>
                                            <span className="font-medium">No:</span>
                                            <span className="ml-1 font-mono">{program.copNumber}</span>
                                        </Badge>
                                    )}
                                    {program.grNumber && (
                                        <Badge variant="outline" className={`text-[11px] ${getBadgeStyle(hasPermitFile)}`}>
                                            <span className="font-medium">No:</span>
                                            <span className="ml-1 font-mono">{program.grNumber}</span>
                                        </Badge>
                                    )}
                                    {!hasPermitNumber && hasPermitFile && (
                                        <Badge variant="outline" className={`text-[11px] ${getBadgeStyle(true)}`}>
                                            <FileText className="mr-1 h-3 w-3" /> Document linked
                                        </Badge>
                                    )}
                                    {!hasPermitNumber && !hasPermitFile && (
                                        <Badge
                                            variant="outline"
                                            className="border-red-200 bg-red-50 text-[11px] text-red-600 dark:border-red-900/50 dark:bg-red-900/20 dark:text-red-400"
                                        >
                                            <AlertCircle className="mr-1 h-3 w-3" />
                                            <span className="font-bold">CHECK WITH CHED</span>
                                        </Badge>
                                    )}

                                    {program.institution && (
                                        <div className="flex items-center gap-1.5 text-xs sm:text-sm text-gray-600 dark:text-gray-400">
                                            <School className="h-4 w-4" />
                                            <span>{program.institution.name}</span>
                                            <Badge variant={program.institution.type === 'public' ? 'default' : 'secondary'} className="ml-2 text-[11px] dark:bg-gray-700 dark:text-gray-200">
                                                {program.institution.type === 'public' ? 'Public' : 'Private'}
                                            </Badge>
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Permit area */}
                            {hasPermitFile ? (
                                // GREEN SCENARIO (Implicitly handled by showing PDF)
                                <div className="rounded-lg border-2 border-green-200 bg-white dark:border-green-900 dark:bg-gray-900">
                                    <div className="border-b border-green-200 bg-green-50 px-6 py-4 dark:border-green-900 dark:bg-green-900/10">
                                        <div className="flex items-start justify-between">
                                            <div>
                                                <h4 className="text-lg font-bold text-green-900 dark:text-green-100 flex items-center gap-2">
                                                    <FileText className="h-5 w-5" /> Permit Document
                                                </h4>
                                                {permitNumberValue && (
                                                    <p className="mt-1 text-sm text-green-700 dark:text-green-300">
                                                        {permitNumberLabel}: <span className="font-mono font-semibold">{permitNumberValue}</span>
                                                    </p>
                                                )}
                                                {!permitNumberValue && (
                                                    <p className="mt-1 text-sm text-green-700 dark:text-green-300">
                                                        Permit number not recorded
                                                    </p>
                                                )}
                                            </div>
                                            {blobUrl && (
                                                <Button
                                                    onClick={openInNewTab}
                                                    variant="outline"
                                                    size="sm"
                                                    className="gap-2 border-green-300 text-green-700 hover:bg-green-100 dark:border-green-700 dark:text-green-300 dark:hover:bg-green-900/30"
                                                >
                                                    <ExternalLink className="h-4 w-4" />
                                                    <span className="hidden sm:inline">Open in New Tab</span>
                                                </Button>
                                            )}
                                        </div>
                                    </div>

                                    <div className="relative bg-gray-100 dark:bg-gray-950">
                                        {isLoadingBlob ? (
                                            <div className="flex min-h-[500px] flex-col items-center justify-center p-8">
                                                <Loader2 className="mb-4 h-12 w-12 animate-spin text-green-600 dark:text-green-400" />
                                                <p className="text-sm text-gray-600 dark:text-gray-400">Loading PDF preview...</p>
                                            </div>
                                        ) : blobError ? (
                                            <div className="flex min-h-[500px] flex-col items-center justify-center p-8">
                                                <AlertCircle className="mb-4 h-12 w-12 text-amber-500 dark:text-amber-400" />
                                                <p className="text-sm font-semibold text-gray-700 dark:text-gray-300">
                                                    Unable to preview PDF inline
                                                </p>
                                                <p className="mt-1 mb-4 max-w-xs text-center text-xs text-gray-500 dark:text-gray-400">
                                                    The document is available on the portal but cannot be previewed here. You can view it directly in a new tab.
                                                </p>
                                                {(directUrl || permitUrl) && (
                                                    <Button
                                                        onClick={() => window.open(directUrl || permitUrl!, '_blank', 'noopener,noreferrer')}
                                                        className="gap-2"
                                                    >
                                                        <ExternalLink className="h-4 w-4" />
                                                        Open Permit in New Tab
                                                    </Button>
                                                )}
                                            </div>
                                        ) : blobUrl && !pdfRenderFailed ? (
                                            <div className="relative flex justify-center p-6">
                                                <div ref={pageContainerRef} className="relative group cursor-pointer" onClick={toggleFullscreen}>
                                                    <Document
                                                        file={blobUrl}
                                                        onLoadSuccess={onDocumentLoadSuccess}
                                                        loading={
                                                            <div className="flex min-h-[500px] items-center justify-center">
                                                                <Loader2 className="h-8 w-8 animate-spin text-green-600 dark:text-green-400" />
                                                            </div>
                                                        }
                                                        error={
                                                            <div className="flex min-h-[500px] flex-col items-center justify-center p-8">
                                                                <AlertCircle className="mb-4 h-12 w-12 text-amber-500 dark:text-amber-400" />
                                                                <p className="text-sm font-semibold text-gray-700 dark:text-gray-300">Unable to render PDF</p>
                                                                <p className="mt-1 mb-4 text-xs text-gray-500 dark:text-gray-400">You can still view it directly.</p>
                                                                <Button
                                                                    size="sm"
                                                                    onClick={(e) => { e.stopPropagation(); openInNewTab(); }}
                                                                    className="gap-2"
                                                                >
                                                                    <ExternalLink className="h-4 w-4" />
                                                                    Open in New Tab
                                                                </Button>
                                                            </div>
                                                        }
                                                    >
                                                        <Page
                                                            pageNumber={pageNumber}
                                                            renderTextLayer={true}
                                                            renderAnnotationLayer={true}
                                                            className="shadow-lg transition-opacity duration-200 group-hover:opacity-90"
                                                            width={280}
                                                            onRenderError={onPageRenderError}
                                                            onRenderSuccess={onPageRenderSuccess}
                                                        />
                                                    </Document>

                                                    <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-black/10 rounded-sm">
                                                        <div className="bg-black/70 text-white px-4 py-2 rounded-md flex items-center gap-2 backdrop-blur-sm">
                                                            <Maximize2 className="h-4 w-4" />
                                                            <span className="text-sm font-medium">Click to Enlarge</span>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        ) : blobUrl && pdfRenderFailed ? (
                                            <div className="flex min-h-[300px] flex-col items-center justify-center p-8">
                                                <div className="mb-4 rounded-full bg-green-100 p-4 dark:bg-green-900/30">
                                                    <FileText className="h-8 w-8 text-green-600 dark:text-green-400" />
                                                </div>
                                                <p className="text-sm font-semibold text-gray-700 dark:text-gray-300">
                                                    Preview not available
                                                </p>
                                                <p className="mt-1 mb-4 max-w-xs text-center text-xs text-gray-500 dark:text-gray-400">
                                                    This document cannot be previewed inline, but you can view it directly in your browser.
                                                </p>
                                                <Button
                                                    onClick={openInNewTab}
                                                    className="gap-2"
                                                >
                                                    <ExternalLink className="h-4 w-4" />
                                                    Open Permit in New Tab
                                                </Button>
                                            </div>
                                        ) : null}
                                    </div>

                                    {numPages && numPages > 1 && (
                                        <div className="border-t border-gray-200 bg-gray-50 px-6 py-3 dark:border-gray-700 dark:bg-gray-800">
                                            <div className="flex items-center justify-between">
                                                <Button onClick={goToPrevPage} disabled={pageNumber <= 1} variant="outline" size="sm">
                                                    <ChevronLeft className="mr-1 h-4 w-4" /> Previous
                                                </Button>
                                                <p className="text-sm text-gray-700 dark:text-gray-300">Page {pageNumber} of {numPages}</p>
                                                <Button onClick={goToNextPage} disabled={pageNumber >= numPages} variant="outline" size="sm">
                                                    Next <ChevronRight className="ml-1 h-4 w-4" />
                                                </Button>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            ) : hasPermitNumber ? (
                                // PURPLE SCENARIO: Has Number, No PDF
                                <div className="relative min-h-[420px] overflow-hidden rounded-lg border-2 border-dashed border-purple-300 bg-purple-50/50 dark:border-purple-700 dark:bg-purple-900/10">
                                    <div className="absolute inset-0 bg-gradient-to-br from-purple-500/5 to-purple-100/10" />
                                    <div className="relative flex h-full flex-col items-center justify-center p-8 text-center">
                                        <div className="mb-6 rounded-full bg-purple-100 p-4 dark:bg-purple-900/40">
                                            <FileWarning className="h-8 w-8 text-purple-600 dark:text-purple-400" />
                                        </div>
                                        <h4 className="mb-2 text-xl font-bold text-purple-900 dark:text-purple-200">Permit Number Recorded</h4>
                                        <p className="mb-2 text-sm text-purple-700 dark:text-purple-300">
                                            {permitNumberLabel}: <span className="font-mono font-semibold">{permitNumberValue}</span>
                                        </p>
                                        <p className="mb-6 max-w-md text-xs text-purple-600 dark:text-purple-400">
                                            A permit number is recorded for this program, but the digital copy (PDF) has not yet been uploaded to the registry.
                                        </p>
                                    </div>
                                </div>
                            ) : (
                                // RED SCENARIO: No Number, No PDF (Check with CHED)
                                <div className="relative min-h-[420px] overflow-hidden rounded-lg border-2 border-dashed border-red-300 bg-red-50/50 dark:border-red-800 dark:bg-red-900/10">
                                     <div className="absolute inset-0 bg-gradient-to-br from-red-500/5 to-red-100/10" />
                                    <div className="relative flex h-full flex-col items-center justify-center p-8 text-center">
                                        <div className="mb-6 animate-pulse rounded-full bg-red-100 p-6 dark:bg-red-900/30">
                                            <AlertCircle className="h-14 w-14 text-red-600 dark:text-red-400" />
                                        </div>
                                        <h4 className="mb-2 text-xl font-bold text-red-900 dark:text-red-200">CHECK WITH CHED</h4>
                                        <p className="mb-6 max-w-md text-sm text-red-600 dark:text-red-400">
                                            No permit number is currently recorded for this program in the registry. Please contact CHED for verification.
                                        </p>
                                    </div>
                                </div>
                            )}
                        </div>
                    </>
                )}
            </DialogContent>
        </Dialog>
    );
}
