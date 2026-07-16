import React from 'react';
import { Cloud, Image as ImageIcon, Video, Music, FileText, Archive, Info } from 'lucide-react';
import { fmtBytes } from '../../utils/format';

interface StorageAnalyticsProps {
  storageStats: {
    total: number;
    images: number;
    videos: number;
    audio: number;
    documents: number;
    archives: number;
    others: number;
  } | null;
  t: any;
  lang: string;
}

export default function StorageAnalytics({ storageStats, t, lang }: StorageAnalyticsProps) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24, color: 'var(--md-on-surface)', maxWidth: 800, margin: '0 auto', width: '100%', padding: '10px 0' }}>
      <div>
        <h3 style={{ fontSize: 24, fontWeight: 400, fontFamily: 'Google Sans,sans-serif', marginBottom: 4 }}>
          {t.analyticsHeader}
        </h3>
        <p style={{ fontSize: 14, color: 'var(--md-on-surface-variant)' }}>
          {lang === 'id' ? 'Analisis pembagian jenis file pada akun Telegram Anda' : 'Detailed breakdown of space usage on your Telegram account'}
        </p>
      </div>

      {storageStats ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 28 }}>
          {/* Total storage box */}
          <div style={{
            padding: '24px', borderRadius: 20, background: 'var(--md-surface-container-high)',
            border: '1px solid var(--md-outline-variant)', display: 'flex', alignItems: 'center', gap: 20
          }}>
            <div style={{
              width: 56, height: 56, borderRadius: '50%', background: 'var(--md-secondary-container)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--md-primary)'
            }}>
              <Cloud size={28}/>
            </div>
            <div>
              <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--md-on-surface-variant)' }}>
                {lang === 'id' ? 'Total Penyimpanan Digunakan' : 'Total Space Used'}
              </span>
              <h2 style={{ fontSize: 32, fontWeight: 700, margin: '4px 0 0 0', color: 'var(--md-on-surface)' }}>
                {fmtBytes(storageStats.total)}
              </h2>
            </div>
          </div>

          {/* Segmented bar chart */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div style={{
              height: 18, width: '100%', borderRadius: 9, overflow: 'hidden',
              background: 'var(--md-surface-variant)', display: 'flex'
            }}>
              {[
                { val: storageStats.images, col: '#4285f4' },
                { val: storageStats.videos, col: '#ea4335' },
                { val: storageStats.audio, col: '#34a853' },
                { val: storageStats.documents, col: '#fabc05' },
                { val: storageStats.archives, col: '#a0c3ff' },
                { val: storageStats.others, col: '#9aa0a6' }
              ].map((item, idx) => {
                const pct = storageStats.total > 0 ? (item.val / storageStats.total) * 100 : 0;
                if (pct <= 0) return null;
                return (
                  <div 
                    key={idx} 
                    style={{
                      width: `${pct}%`, height: '100%', background: item.col,
                      transition: 'width .6s ease',
                    }} 
                    title={`${pct.toFixed(1)}%`} 
                  />
                );
              })}
            </div>
          </div>

          {/* Categories detail */}
          <div style={{
            display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16
          }}>
            {[
              { key: 'images', name: t.catImages, size: storageStats.images, col: '#4285f4', icon: <ImageIcon size={18}/> },
              { key: 'videos', name: t.catVideos, size: storageStats.videos, col: '#ea4335', icon: <Video size={18}/> },
              { key: 'audio', name: t.catAudio, size: storageStats.audio, col: '#34a853', icon: <Music size={18}/> },
              { key: 'documents', name: t.catDocuments, size: storageStats.documents, col: '#fabc05', icon: <FileText size={18}/> },
              { key: 'archives', name: t.catArchives, size: storageStats.archives, col: '#a0c3ff', icon: <Archive size={18}/> },
              { key: 'others', name: t.catOthers, size: storageStats.others, col: '#9aa0a6', icon: <Info size={18}/> }
            ].map(cat => {
              const pct = storageStats.total > 0 ? (cat.size / storageStats.total) * 100 : 0;
              return (
                <div 
                  key={cat.key} 
                  style={{
                    padding: '16px', borderRadius: 16, border: '1px solid var(--md-outline-variant)',
                    background: 'var(--md-surface-container-low)', display: 'flex', gap: 12, alignItems: 'center'
                  }}
                >
                  <div style={{
                    width: 38, height: 38, borderRadius: 10, background: 'var(--md-surface-container-lowest)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', color: cat.col, flexShrink: 0
                  }}>
                    {cat.icon}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--md-on-surface)' }}>{cat.name}</span>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 4 }}>
                      <span style={{ fontSize: 12, color: 'var(--md-on-surface-variant)' }}>{fmtBytes(cat.size)}</span>
                      <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--md-on-surface-variant)', background: 'var(--md-surface-container-highest)', padding: '2px 6px', borderRadius: 10 }}>
                        {pct.toFixed(1)}%
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, marginTop: 40 }}>
          <div style={{ width: 32, height: 32, borderRadius: '50%', border: '3px solid var(--md-primary)', borderTopColor: 'transparent', animation: 'spin 1s linear infinite' }} />
          <p style={{ fontSize: 14, color: 'var(--md-on-surface-variant)' }}>
            {lang === 'id' ? 'Menganalisis penggunaan penyimpanan...' : 'Analyzing storage usage...'}
          </p>
        </div>
      )}
    </div>
  );
}
