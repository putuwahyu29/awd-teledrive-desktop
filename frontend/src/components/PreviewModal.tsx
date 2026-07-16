import React, { useState, useEffect } from 'react';
import { X, Download, FileText, Loader, Image as ImageIcon, Video, Music, AlertCircle, ChevronLeft, ChevronRight, Shuffle, Repeat, RefreshCw, List, ZoomIn, ZoomOut, Maximize2 } from 'lucide-react';
import { PreviewFile, DownloadFile, GetWebServerPort } from '../../wailsjs/go/main/App';
import { TransformWrapper, TransformComponent } from 'react-zoom-pan-pinch';
import AudioPlayer from './ui/AudioPlayer';

const PdfViewer = React.lazy(() => import('./ui/PdfViewer'));
const CodeViewer = React.lazy(() => import('./ui/CodeViewer'));

class ErrorBoundary extends React.Component<{ children: React.ReactNode }, { hasError: boolean; error: any }> {
  constructor(props: { children: React.ReactNode }) { super(props); this.state = { hasError: false, error: null }; }
  static getDerivedStateFromError(error: any) { return { hasError: true, error }; }
  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding:20, background:'#fff', color:'red', zIndex:9999, position:'absolute', inset:0 }}>
          <h2>Error</h2>
          <pre>{this.state.error?.toString()}</pre>
        </div>
      );
    }
    return this.props.children;
  }
}

const NavBtn = ({ direction, onClick, isSmallScreen }) => (
  <button
    onClick={(e) => { e.stopPropagation(); onClick(); }}
    style={{
      position: 'absolute', top: '50%', transform: 'translateY(-50%)',
      [direction]: isSmallScreen ? 6 : 12, 
      width: isSmallScreen ? 40 : 56, 
      height: isSmallScreen ? 40 : 56, 
      borderRadius: '50%', border: 'none',
      background: 'rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.87)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      cursor: 'pointer', transition: 'background .2s', zIndex: 2005,
      backdropFilter: 'blur(4px)',
    }}
    onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.2)'}
    onMouseLeave={e => e.currentTarget.style.background = 'rgba(255,255,255,0.1)'}
  >
    {direction === 'left' ? <ChevronLeft size={isSmallScreen ? 24 : 32} /> : <ChevronRight size={isSmallScreen ? 24 : 32} />}
  </button>
);

const IconBtn = ({ children, onClick, title, active = false }) => (
  <button
    onClick={onClick}
    title={title}
    style={{
      width: 40, height: 40, borderRadius: '50%', border: 'none',
      background: active ? 'rgba(11,87,208,0.3)' : 'transparent',
      color: active ? '#a8c7fa' : 'rgba(255,255,255,0.87)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      cursor: 'pointer', transition: 'background .15s', flexShrink: 0,
    }}
    onMouseEnter={e => e.currentTarget.style.background = active ? 'rgba(11,87,208,0.4)' : 'rgba(255,255,255,0.12)'}
    onMouseLeave={e => e.currentTarget.style.background = active ? 'rgba(11,87,208,0.3)' : 'transparent'}
  >
    {children}
  </button>
);

function PreviewModal({ file, currentPath, onClose, onPrev, onNext, playlist = [], onSelectFile }) {
  const [loading, setLoading] = useState(true);
  const [content, setContent] = useState(null);
  const [error, setError] = useState(null);
  const [textContent, setTextContent] = useState('');
  const [webServerPort, setWebServerPort] = useState<number>(0);
  const [showPlaylist, setShowPlaylist] = useState(true);
  const [windowWidth, setWindowWidth] = useState(window.innerWidth);

  useEffect(() => {
    const handleResize = () => setWindowWidth(window.innerWidth);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const isSmallScreen = windowWidth < 768;
  
  useEffect(() => {
    GetWebServerPort().then(setWebServerPort);
  }, []);
  
  // Player control states
  const [autoplayNext, setAutoplayNext] = useState(true);
  const [shuffleMode, setShuffleMode] = useState(false);
  const [repeatMode, setRepeatMode] = useState(false);

  const ext = file.name.split('.').pop().toLowerCase();
  const isImage = ['jpg','jpeg','png','gif','webp','heic','heif','svg','bmp','ico'].includes(ext);
  const isVideo = ['mp4','webm','ogg','mov','mkv'].includes(ext);
  const isAudio = ['mp3','wav','flac','aac','m4a'].includes(ext);
  const isPdf   = ext === 'pdf';
  const isText  = ['txt','log','json','md','csv','js','jsx','ts','tsx','html','css','go','py','java','xml','yaml','yml','toml','ini','env','sh','bat','sql','rs','c','cpp','h','hpp','cfg','conf','properties'].includes(ext);
  const isMedia = isVideo || isAudio;

  const mediaPlaylist = playlist.filter(f => {
    const e = f.name.split('.').pop().toLowerCase();
    return ['mp4','webm','ogg','mov','mkv','mp3','wav','flac','aac','m4a'].includes(e);
  });

  useEffect(() => {
    setLoading(true);
    setContent(null);
    setError(null);
    setTextContent('');
    
    let active = true;
    let localBlobUrl = '';

    (async () => {
      try {
        const res = await PreviewFile(currentPath, file.id, file.name);
        if (!active) return;
        if (res.success) {
          let c = res.base64 || res.filePath;
          if (['heic', 'heif'].includes(ext)) {
            try {
              let blob;
              if (c.startsWith('data:')) {
                const b64 = c.split(',')[1];
                const byteString = atob(b64);
                const ab = new ArrayBuffer(byteString.length);
                const ia = new Uint8Array(ab);
                for (let i = 0; i < byteString.length; i++) ia[i] = byteString.charCodeAt(i);
                blob = new Blob([ab], { type: 'image/heic' });
              } else {
                const fileUrl = `/${c.split('\\').map(encodeURIComponent).join('/')}`;
                const r = await fetch(fileUrl);
                let b = await r.blob();
                blob = new Blob([b], { type: 'image/heic' });
              }
              const heic2any = (await import('heic2any')).default;
              const converted = await heic2any({ blob, toType: "image/jpeg" });
              c = URL.createObjectURL(Array.isArray(converted) ? converted[0] : converted);
            } catch (err) {
              console.error("HEIC conversion failed:", err);
            }
          }
          setContent(c);
        } else {
          setError(res.error || 'Failed to load preview');
        }
      } catch (err) {
        if (active) setError(String(err));
      } finally {
        if (active) setLoading(false);
      }
    })();

    return () => {
      active = false;
      if (localBlobUrl) {
        URL.revokeObjectURL(localBlobUrl);
      }
    };
  }, [file]);

  const getFileUrl = (path: string) => {
    if (!path) return '';
    if (path.startsWith('data:') || path.startsWith('blob:')) return path;
    
    // For PDF files, serve them through the dynamic web server to bypass webview2 same-origin restrictions
    if (path.toLowerCase().endsWith('.pdf') && webServerPort) {
      const filename = path.split('\\').pop()?.split('/').pop() || '';
      return `http://localhost:${webServerPort}/local-temp/${encodeURIComponent(filename)}`;
    }
    
    let p = path.replace(/\\/g, '/');
    if (p.match(/^[a-zA-Z]:/)) {
      p = 'local-file/' + p.replace(':', '');
    }
    return '/' + p.split('/').map(encodeURIComponent).join('/');
  };

  const fileUrl = getFileUrl(content);

  useEffect(() => {
    if (isText && content && !content.startsWith('data:')) {
      fetch(fileUrl)
        .then(r => r.text())
        .then(t => setTextContent(t))
        .catch(() => setTextContent('Failed to load text content.'));
    }
  }, [isText, content, fileUrl]);

  const handleDownload = async () => {
    await DownloadFile(currentPath, String(file.id), file.name, Number(file.size));
  };

  const handleMediaEnded = () => {
    const mediaEl = document.querySelector('audio, video') as HTMLMediaElement | null;
    if (repeatMode) {
      if (mediaEl) {
        mediaEl.currentTime = 0;
        mediaEl.play();
      }
      return;
    }
    if (shuffleMode && mediaPlaylist.length > 1) {
      const idx = Math.floor(Math.random() * mediaPlaylist.length);
      onSelectFile(mediaPlaylist[idx]);
      return;
    }
    if (autoplayNext && onNext) {
      onNext();
    }
  };

  // Keyboard navigation
  useEffect(() => {
    const handler = (e) => { 
      if (e.key === 'Escape') onClose(); 
      if (e.key === 'ArrowLeft' && onPrev) onPrev();
      if (e.key === 'ArrowRight' && onNext) onNext();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose, onPrev, onNext]);

  return (
    <ErrorBoundary>
      {/* Backdrop */}
      <div
        style={{
          position: 'fixed', inset: 0, zIndex: 2000,
          background: 'rgba(0,0,0,0.94)',
          display: 'flex', flexDirection: 'column',
        }}
        onClick={e => { if (e.target === e.currentTarget) onClose(); }}
      >
        {/* ── Top Bar ─────────────────────────────────────────────────────── */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '8px 12px', background: 'rgba(0,0,0,0.6)',
          backdropFilter: 'blur(8px)', flexShrink: 0,
          borderBottom: '1px solid rgba(255,255,255,0.08)',
          zIndex: 2001,
        }}>
          {/* Left: close + filename */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
            <IconBtn onClick={onClose} title="Close (Esc)">
              <X size={22} />
            </IconBtn>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0, color: 'rgba(255,255,255,0.87)' }}>
              {isImage ? <ImageIcon size={18} /> : isVideo ? <Video size={18} /> : isAudio ? <Music size={18} /> : <FileText size={18} />}
              <span style={{
                fontSize: 15, fontWeight: 500, fontFamily: 'Google Sans,sans-serif',
                whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                maxWidth: 480, color: 'rgba(255,255,255,0.87)'
              }}>
                {file.name}
              </span>
            </div>
          </div>

          {/* Right: actions */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 }}>
            {isMedia && (
              <>
                <IconBtn onClick={() => setShuffleMode(!shuffleMode)} active={shuffleMode} title="Shuffle">
                  <Shuffle size={18} />
                </IconBtn>
                <IconBtn onClick={() => setRepeatMode(!repeatMode)} active={repeatMode} title="Repeat One">
                  <Repeat size={18} />
                </IconBtn>
                <IconBtn onClick={() => setAutoplayNext(!autoplayNext)} active={autoplayNext} title="Autoplay Next">
                  <RefreshCw size={18} />
                </IconBtn>
                {mediaPlaylist.length > 1 && (
                  <IconBtn onClick={() => setShowPlaylist(!showPlaylist)} active={showPlaylist} title="Toggle Queue List">
                    <List size={20} />
                  </IconBtn>
                )}
              </>
            )}
            <IconBtn onClick={handleDownload} title="Download">
              <Download size={22} />
            </IconBtn>
          </div>
        </div>

        {/* ── Preview Content ──────────────────────────────────────────────── */}
        <div style={{
          flex: 1, display: 'flex', overflow: 'hidden', minHeight: 0, position: 'relative'
        }}>
          
          {/* Main preview container */}
          <div style={{
            flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
            padding: isSmallScreen ? '12px 16px' : '12px 64px', overflow: 'hidden', minHeight: 0, position: 'relative'
          }}>
            {onPrev && <NavBtn direction="left" onClick={onPrev} isSmallScreen={isSmallScreen} />}
            {onNext && <NavBtn direction="right" onClick={onNext} isSmallScreen={isSmallScreen} />}
            
            {loading ? (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }}>
                <div style={{
                  width: 48, height: 48, borderRadius: '50%',
                  border: '3px solid rgba(255,255,255,0.15)',
                  borderTopColor: 'rgba(255,255,255,0.8)',
                  animation: 'spin 0.8s linear infinite',
                }} />
                <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: 14 }}>Loading...</p>
              </div>
            ) : error ? (
              <div style={{
                background: 'rgba(255,255,255,0.05)', borderRadius: 16, padding: 40,
                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16,
                border: '1px solid rgba(255,255,255,0.1)', maxWidth: 400, textAlign: 'center',
              }}>
                <AlertCircle size={48} color="rgba(255,100,100,0.8)" />
                <p style={{ color: 'rgba(255,255,255,0.7)', fontSize: 15 }}>{error}</p>
                <button
                  onClick={handleDownload}
                  style={{
                    background: '#0b57d0', color: '#fff', border: 'none', borderRadius: 100,
                    padding: '10px 24px', fontSize: 14, fontWeight: 500, cursor: 'pointer',
                    fontFamily: 'Google Sans,sans-serif',
                  }}
                >
                  Download Instead
                </button>
              </div>
            ) : isImage ? (
              <TransformWrapper initialScale={1} minScale={0.5} maxScale={5}>
                {({ zoomIn, zoomOut, resetTransform }) => (
                  <div style={{ position: 'relative', width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <TransformComponent wrapperStyle={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <img
                        src={fileUrl} alt={file.name}
                        style={{
                          maxWidth: '100%', maxHeight: '100%', objectFit: 'contain',
                          borderRadius: 4, boxShadow: '0 8px 40px rgba(0,0,0,0.6)',
                          cursor: 'grab'
                        }}
                      />
                    </TransformComponent>
                    
                    {/* Floating Zoom Controls */}
                    <div style={{
                      position: 'absolute', bottom: 16, left: '50%', transform: 'translateX(-50%)',
                      background: 'rgba(30,30,30,0.85)', backdropFilter: 'blur(8px)',
                      borderRadius: 100, border: '1px solid rgba(255,255,255,0.08)',
                      padding: '6px 12px', display: 'flex', alignItems: 'center', gap: 10,
                      zIndex: 2006, boxShadow: '0 8px 24px rgba(0,0,0,0.4)'
                    }}>
                      <button
                        onClick={() => zoomOut(0.2)}
                        style={{ background: 'transparent', border: 'none', color: '#fff', cursor: 'pointer', display: 'flex', padding: 6, borderRadius: '50%' }}
                        onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.1)'}
                        onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                        title="Zoom Out"
                      >
                        <ZoomOut size={16} />
                      </button>
                      <button
                        onClick={() => resetTransform()}
                        style={{ background: 'transparent', border: 'none', color: '#fff', cursor: 'pointer', display: 'flex', padding: 6, borderRadius: '50%' }}
                        onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.1)'}
                        onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                        title="Fit / Reset"
                      >
                        <Maximize2 size={15} />
                      </button>
                      <button
                        onClick={() => zoomIn(0.2)}
                        style={{ background: 'transparent', border: 'none', color: '#fff', cursor: 'pointer', display: 'flex', padding: 6, borderRadius: '50%' }}
                        onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.1)'}
                        onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                        title="Zoom In"
                      >
                        <ZoomIn size={16} />
                      </button>
                    </div>
                  </div>
                )}
              </TransformWrapper>
            ) : isVideo ? (
              <video
                src={fileUrl} controls autoPlay
                onEnded={handleMediaEnded}
                style={{ maxWidth: '100%', maxHeight: '100%', borderRadius: 8, boxShadow: '0 8px 40px rgba(0,0,0,0.6)' }}
              />
            ) : isAudio ? (
              <AudioPlayer
                fileUrl={fileUrl}
                fileName={file.name}
                onEnded={handleMediaEnded}
              />
            ) : isPdf ? (
              <div style={{ width: '100%', maxWidth: 1080, height: '100%', display: 'flex' }}>
                <React.Suspense fallback={
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '100%', height: '100%', gap: 8, color: 'rgba(255,255,255,0.7)' }}>
                    <Loader style={{ animation: 'spin 1.2s linear infinite' }} size={24} />
                    <span>Loading PDF Viewer...</span>
                  </div>
                }>
                  <PdfViewer fileUrl={fileUrl} />
                </React.Suspense>
              </div>
            ) : isText ? (
              <div style={{ width: '100%', maxWidth: 1080, height: '100%' }}>
                <React.Suspense fallback={
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '100%', height: '100%', gap: 8, color: 'rgba(255,255,255,0.7)' }}>
                    <Loader style={{ animation: 'spin 1.2s linear infinite' }} size={24} />
                    <span>Loading Code Viewer...</span>
                  </div>
                }>
                  <CodeViewer content={textContent} fileName={file.name} />
                </React.Suspense>
              </div>
            ) : (
              <div style={{
                background: 'rgba(255,255,255,0.05)', borderRadius: 20, padding: 48,
                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16,
                border: '1px solid rgba(255,255,255,0.1)', textAlign: 'center',
              }}>
                <FileText size={64} color="rgba(255,255,255,0.3)" />
                <h2 style={{ fontSize: 20, fontWeight: 500, color: 'rgba(255,255,255,0.87)', margin: 0 }}>
                  No preview available
                </h2>
                <p style={{ fontSize: 14, color: 'rgba(255,255,255,0.5)', margin: 0 }}>
                  Preview is not supported for <b>.{ext}</b> files
                </p>
                <button
                  onClick={handleDownload}
                  style={{
                    marginTop: 8, background: '#0b57d0', color: '#fff', border: 'none',
                    borderRadius: 100, padding: '10px 28px', fontSize: 14, fontWeight: 500,
                    cursor: 'pointer', fontFamily: 'Google Sans,sans-serif',
                  }}
                >
                  <Download size={16} style={{ display: 'inline', marginRight: 8, verticalAlign: 'middle' }} />
                  Download
                </button>
              </div>
            )}
          </div>

          {/* Right Playlist Pane (Only for media files) */}
          {isMedia && mediaPlaylist.length > 0 && showPlaylist && !isSmallScreen && (
            <div style={{
              width: 320, background: 'rgba(0,0,0,0.5)', borderLeft: '1px solid rgba(255,255,255,0.08)',
              display: 'flex', flexDirection: 'column', flexShrink: 0, zIndex: 2002
            }}>
              <div style={{ padding: '16px 20px', borderBottom: '1px solid rgba(255,255,255,0.08)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: 14, fontWeight: 700, color: 'rgba(255,255,255,0.87)', fontFamily: 'Google Sans,sans-serif' }}>
                  Antrean Pemutaran ({mediaPlaylist.length})
                </span>
              </div>
              <div style={{ flex: 1, overflowY: 'auto', padding: '10px 0' }}>
                {mediaPlaylist.map((item, idx) => {
                  const isCurrent = item.id === file.id;
                  const itemExt = item.name.split('.').pop().toLowerCase();
                  const itemIsVideo = ['mp4','webm','ogg','mov','mkv'].includes(itemExt);
                  return (
                    <div
                      key={item.id}
                      onClick={() => onSelectFile(item)}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 12, padding: '12px 20px',
                        cursor: 'pointer', background: isCurrent ? 'rgba(11,87,208,0.2)' : 'transparent',
                        borderLeft: isCurrent ? '3px solid #a8c7fa' : '3px solid transparent',
                        transition: 'background .15s'
                      }}
                      onMouseEnter={e => { if(!isCurrent) e.currentTarget.style.background = 'rgba(255,255,255,0.04)'; }}
                      onMouseLeave={e => { if(!isCurrent) e.currentTarget.style.background = 'transparent'; }}
                    >
                      <div style={{
                        width: 32, height: 32, borderRadius: 6,
                        background: isCurrent ? 'rgba(11,87,208,0.3)' : 'rgba(255,255,255,0.06)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        color: isCurrent ? '#a8c7fa' : 'rgba(255,255,255,0.5)', flexShrink: 0
                      }}>
                        {itemIsVideo ? <Video size={16} /> : <Music size={16} />}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p style={{
                          fontSize: 13, fontWeight: isCurrent ? 600 : 400,
                          color: isCurrent ? '#a8c7fa' : 'rgba(255,255,255,0.87)',
                          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                          margin: 0
                        }}>
                          {item.name}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

        </div>
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </ErrorBoundary>
  );
}

export default PreviewModal;

