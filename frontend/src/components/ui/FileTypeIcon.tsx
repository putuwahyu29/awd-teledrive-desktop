import React, { useState, useEffect } from 'react';
import { Folder, Image as ImageIcon, Video, Music, Archive, FileText, RefreshCw, Play, Film } from 'lucide-react';
import { GetThumbnail } from '../../../wailsjs/go/main/App';
import { fileColor } from '../../utils/fileHelpers';

interface FileTypeIconProps {
  file: {
    type?: string;
    name?: string;
  };
  size?: number;
}

export function FileTypeIcon({ file, size = 32 }: FileTypeIconProps) {
  if (file.type === 'folder') return <Folder size={size} fill="#fbbc04" color="#f9a825"/>;
  const e = (file.name || '').split('.').pop()?.toLowerCase() || '';
  const c = fileColor(file.name || '');
  if (['jpg','jpeg','png','gif','webp','heic','heif'].includes(e)) return <ImageIcon size={size} color={c}/>;
  if (['mp4','webm','ogg','mov','mkv'].includes(e))        return <Video size={size} color={c}/>;
  if (['mp3','wav','flac','aac','m4a'].includes(e))              return <Music size={size} color={c}/>;
  if (['zip','rar','tar','gz','7z'].includes(e))          return <Archive size={size} color={c}/>;
  return <FileText size={size} color={c}/>;
}

interface ThumbImgProps {
  chatId: string;
  fileId: string;
  isVideo: boolean;
  ext: string;
}

export function ThumbImg({ chatId, fileId, isVideo, ext }: ThumbImgProps) {
  const [src, setSrc] = useState<string | null>(null);
  const [errStr, setErrStr] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  
  useEffect(() => {
    let alive = true;
    setIsLoading(true);
    GetThumbnail(chatId, fileId).then(async d => { 
      if (!alive || !d) { if (alive) setIsLoading(false); return; }
      if (['heic', 'heif'].includes(ext)) {
        try {
          let blob;
          if (d.startsWith('data:')) {
            const b64 = d.split(',')[1];
            const byteString = atob(b64);
            const ab = new ArrayBuffer(byteString.length);
            const ia = new Uint8Array(ab);
            for (let i = 0; i < byteString.length; i++) ia[i] = byteString.charCodeAt(i);
            blob = new Blob([ab], { type: 'image/heic' });
          } else {
            const res = await fetch(d);
            let b = await res.blob();
            blob = new Blob([b], { type: 'image/heic' });
          }
          const heic2any = (await import('heic2any')).default;
          const converted = await heic2any({ blob, toType: "image/jpeg" });
          const url = URL.createObjectURL(Array.isArray(converted) ? converted[0] : converted);
          if (alive) { setSrc(url); setIsLoading(false); }
        } catch(e) {
          if (alive) { setErrStr(String(e)); setSrc(d); setIsLoading(false); }
        }
      } else {
        if (alive) { setSrc(d); setIsLoading(false); }
      }
    }).catch(() => { if (alive) setIsLoading(false); });
    return () => { alive = false; };
  }, [chatId, fileId, ext]);
  
  return (
    <div style={{ width: '100%', height: '100%', position: 'relative', background: 'var(--md-surface-variant)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      {isLoading && !src && (
        <div style={{ position: 'absolute', zIndex: 5, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
          <RefreshCw size={24} color="var(--md-outline)" style={{ animation: 'spin 1.2s linear infinite' }} />
          {['heic','heif'].includes(ext) && <span style={{ fontSize: 10, color: 'var(--md-outline)', fontWeight: 500, fontFamily: 'Google Sans, sans-serif' }}>Memuat...</span>}
        </div>
      )}
      {errStr && <div style={{ fontSize: 10, color: 'red', position: 'absolute', zIndex: 10 }}>{errStr}</div>}
      
      {!isLoading && !src && !errStr && (
        <div style={{ 
          position: 'absolute', inset: 0, 
          background: 'linear-gradient(135deg, var(--md-surface-container-highest) 0%, var(--md-surface-container) 100%)',
          display: 'flex', alignItems: 'center', justifyContent: 'center' 
        }}>
           {isVideo ? <Film size={64} color="var(--md-outline-variant)" opacity={0.2} /> : <ImageIcon size={64} color="var(--md-outline-variant)" opacity={0.2} />}
        </div>
      )}

      {src && !errStr && <img src={src} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', position: 'relative', zIndex: 2 }}/>}
      {isVideo && (
        <div style={{
          position: 'absolute', inset: 0, zIndex: 3,
          background: src ? 'rgba(0,0,0,0.2)' : 'transparent',
          display: 'flex', alignItems: 'center', justifyContent: 'center'
        }}>
          <div style={{
            width: 32, height: 32, borderRadius: '50%',
            background: src ? 'rgba(255,255,255,0.25)' : 'rgba(0,0,0,0.08)', backdropFilter: 'blur(4px)',
            display: 'flex', alignItems: 'center', justifyContent: 'center'
          }}>
            <Play size={16} color={src ? "#fff" : "var(--md-on-surface-variant)"} fill={src ? "#fff" : "var(--md-on-surface-variant)"} style={{ marginLeft: 2 }} />
          </div>
        </div>
      )}
    </div>
  );
}
