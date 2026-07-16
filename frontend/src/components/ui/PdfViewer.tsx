import React, { useState } from 'react';
import { Document, Page, pdfjs } from 'react-pdf';
import { ChevronLeft, ChevronRight, ZoomIn, ZoomOut, Maximize2, Loader2, AlertCircle } from 'lucide-react';

// Configure the PDF.js worker using CDN to guarantee compatibility with Vite and Wails
pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

interface PdfViewerProps {
  fileUrl: string;
}

export default function PdfViewer({ fileUrl }: PdfViewerProps) {
  const [numPages, setNumPages] = useState<number | null>(null);
  const [pageNumber, setPageNumber] = useState<number>(1);
  const [scale, setScale] = useState<number>(1.0);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  function onDocumentLoadSuccess({ numPages }: { numPages: number }) {
    setNumPages(numPages);
    setPageNumber(1);
    setLoading(false);
    setError(null);
  }

  function onDocumentLoadError(err: Error) {
    console.error("PDF load error:", err);
    setError(err.message || "Gagal memuat dokumen PDF");
    setLoading(false);
  }

  const changePage = (offset: number) => {
    setPageNumber(prev => Math.min(Math.max(1, prev + offset), numPages || 1));
  };

  const handleZoom = (factor: number) => {
    setScale(prev => Math.min(Math.max(0.5, prev + factor), 3.0));
  };

  return (
    <div style={{
      display: 'flex', flexDirection: 'column', width: '100%', height: '100%',
      background: '#1a1a1a', borderRadius: 12, overflow: 'hidden',
      boxShadow: '0 8px 32px rgba(0,0,0,0.4)', border: '1px solid rgba(255,255,255,0.08)'
    }}>
      {/* Custom Toolbar */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '10px 16px', background: 'rgba(30, 30, 30, 0.95)',
        borderBottom: '1px solid rgba(255,255,255,0.08)', zIndex: 10,
        gap: 12, flexWrap: 'wrap'
      }}>
        {/* Navigation */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <button
            onClick={() => changePage(-1)}
            disabled={pageNumber <= 1}
            style={{
              background: 'transparent', border: 'none', color: '#fff',
              cursor: pageNumber <= 1 ? 'not-allowed' : 'pointer', opacity: pageNumber <= 1 ? 0.3 : 0.8,
              padding: 6, borderRadius: '50%', display: 'flex', alignItems: 'center', transition: 'background 0.2s'
            }}
            onMouseEnter={e => { if (pageNumber > 1) e.currentTarget.style.background = 'rgba(255,255,255,0.1)'; }}
            onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
          >
            <ChevronLeft size={20} />
          </button>
          
          <span style={{ fontSize: 13, color: '#e0e0e0', fontWeight: 500, fontFamily: 'Google Sans,sans-serif' }}>
            Halaman {pageNumber} dari {numPages || '--'}
          </span>

          <button
            onClick={() => changePage(1)}
            disabled={pageNumber >= (numPages || 1)}
            style={{
              background: 'transparent', border: 'none', color: '#fff',
              cursor: pageNumber >= (numPages || 1) ? 'not-allowed' : 'pointer', opacity: pageNumber >= (numPages || 1) ? 0.3 : 0.8,
              padding: 6, borderRadius: '50%', display: 'flex', alignItems: 'center', transition: 'background 0.2s'
            }}
            onMouseEnter={e => { if (pageNumber < (numPages || 1)) e.currentTarget.style.background = 'rgba(255,255,255,0.1)'; }}
            onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
          >
            <ChevronRight size={20} />
          </button>
        </div>

        {/* Zoom & Layout controls */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button
            onClick={() => handleZoom(-0.2)}
            disabled={scale <= 0.5}
            style={{
              background: 'transparent', border: 'none', color: '#fff',
              cursor: 'pointer', opacity: scale <= 0.5 ? 0.4 : 0.85,
              padding: 6, borderRadius: '50%', display: 'flex', alignItems: 'center', transition: 'background 0.2s'
            }}
            onMouseEnter={e => { if (scale > 0.5) e.currentTarget.style.background = 'rgba(255,255,255,0.1)'; }}
            onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
            title="Perkecil Zoom"
          >
            <ZoomOut size={18} />
          </button>
          
          <span style={{ fontSize: 13, color: '#e0e0e0', minWidth: 44, textAlign: 'center', fontWeight: 500 }}>
            {Math.round(scale * 100)}%
          </span>

          <button
            onClick={() => handleZoom(0.2)}
            disabled={scale >= 3.0}
            style={{
              background: 'transparent', border: 'none', color: '#fff',
              cursor: 'pointer', opacity: scale >= 3.0 ? 0.4 : 0.85,
              padding: 6, borderRadius: '50%', display: 'flex', alignItems: 'center', transition: 'background 0.2s'
            }}
            onMouseEnter={e => { if (scale < 3.0) e.currentTarget.style.background = 'rgba(255,255,255,0.1)'; }}
            onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
            title="Perbesar Zoom"
          >
            <ZoomIn size={18} />
          </button>

          <button
            onClick={() => setScale(1.0)}
            style={{
              background: 'transparent', border: 'none', color: '#fff', opacity: 0.85,
              cursor: 'pointer', padding: 6, borderRadius: '50%', display: 'flex', alignItems: 'center', transition: 'background 0.2s'
            }}
            onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.1)'}
            onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
            title="Reset Zoom ke 100%"
          >
            <Maximize2 size={17} />
          </button>
        </div>
      </div>

      {/* PDF Pages Container */}
      <div style={{
        flex: 1, overflow: 'auto', display: 'flex', justifyContent: 'center',
        alignItems: 'flex-start', padding: 24, background: '#121212',
        position: 'relative'
      }}>
        {loading && (
          <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
            <Loader2 className="animate-spin" size={32} color="#0b57d0" />
            <span style={{ fontSize: 13, color: '#aaa' }}>Memuat PDF...</span>
          </div>
        )}

        {error && (
          <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, maxWidth: 300, textAlign: 'center' }}>
            <AlertCircle size={40} color="#b3261e" />
            <span style={{ fontSize: 14, color: '#ff8a80', fontWeight: 500 }}>{error}</span>
          </div>
        )}

        <Document
          file={fileUrl}
          onLoadSuccess={onDocumentLoadSuccess}
          onLoadError={onDocumentLoadError}
          loading=""
        >
          {!loading && !error && (
            <div style={{
              boxShadow: '0 4px 24px rgba(0,0,0,0.5)',
              borderRadius: 4, overflow: 'hidden', background: '#fff'
            }}>
              <Page
                pageNumber={pageNumber}
                scale={scale}
                renderTextLayer={false}
                renderAnnotationLayer={false}
                loading=""
              />
            </div>
          )}
        </Document>
      </div>

      <style>{`
        .animate-spin {
          animation: spin 1s linear infinite;
        }
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}
