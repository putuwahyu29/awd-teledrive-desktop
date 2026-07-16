import React from 'react';
import { 
  Clock, Upload, Download, Image as ImageIcon, Pencil, Trash2, FileText 
} from 'lucide-react';

interface RecentActivityProps {
  recentFiles: any[];
  t: any;
  lang: string;
}

export default function RecentActivity({ recentFiles, t, lang }: RecentActivityProps) {
  const actionLabels: Record<string, string> = { 
    upload: t.actionUpload, 
    download: t.actionDownload, 
    preview: t.actionPreview, 
    rename: t.actionRename, 
    delete: t.actionDelete 
  };

  const actionColors: Record<string, string> = { 
    upload: '#188038', 
    download: 'var(--md-primary)', 
    preview: 'var(--md-on-surface-variant)', 
    rename: '#f9a825', 
    delete: 'var(--md-error)' 
  };

  const actionIcons: Record<string, React.ReactNode> = { 
    upload: <Upload size={18}/>, 
    download: <Download size={18}/>, 
    preview: <ImageIcon size={18}/>, 
    rename: <Pencil size={18}/>, 
    delete: <Trash2 size={18}/> 
  };

  const timeAgo = (ts: number) => {
    const diff = Math.floor(Date.now() / 1000 - ts);
    if (diff < 60) return `${diff}s`;
    if (diff < 3600) return `${Math.floor(diff / 60)}m`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h`;
    return `${Math.floor(diff / 86400)}d`;
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', color: 'var(--md-on-surface)' }}>
      {recentFiles.length === 0 ? (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', flex: 1, gap: 16, marginTop: 40 }}>
          <Clock size={80} color="var(--md-primary)" style={{ opacity: 0.5 }} />
          <p style={{ fontSize: 15, color: 'var(--md-on-surface)', textAlign: 'center', maxWidth: 300, lineHeight: 1.5 }}>
            {t.noRecentActivity}
          </p>
        </div>
      ) : (
        <div style={{ overflowY: 'auto', paddingRight: 4 }}>
          {recentFiles.map((item, idx) => {
            const action = item.action as string;
            return (
              <div 
                key={idx} 
                style={{
                  display: 'flex', alignItems: 'center', gap: 16, padding: '14px 16px',
                  borderBottom: idx < recentFiles.length - 1 ? '1px solid var(--md-outline-variant)' : 'none',
                }}
              >
                <div style={{
                  width: 40, height: 40, borderRadius: '50%', flexShrink: 0,
                  background: 'var(--md-surface-container-high)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: actionColors[action] || 'var(--md-on-surface-variant)',
                }}>
                  {actionIcons[action] || <FileText size={18}/>}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--md-on-surface)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {item.file?.name || 'Unknown'}
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--md-on-surface-variant)', marginTop: 2 }}>
                    {actionLabels[action] || action}
                  </div>
                </div>
                <span style={{ fontSize: 12, color: 'var(--md-on-surface-variant)', flexShrink: 0 }}>
                  {timeAgo(item.time)}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
