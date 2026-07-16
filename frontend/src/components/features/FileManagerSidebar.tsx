import React, { useState } from 'react';
import { 
  Plus, Home, Star, Image as ImageIcon, Camera, RefreshCw, 
  Clock, Share2, Cloud, Upload, FolderPlus 
} from 'lucide-react';
import { fmtBytes } from '../../utils/format';

interface FileManagerSidebarProps {
  sidebarCollapsed: boolean;
  setSidebarCollapsed: (v: boolean | ((p: boolean) => boolean)) => void;
  activeMenu: string;
  currentFolder: any;
  navTo: (menu: string, folder?: any) => void;
  t: any;
  lang: string;
  totalSize: number;
  doUpload: () => void;
  setShowNewFolder: (v: boolean) => void;
  onStorageClick: () => void;
}

export default function FileManagerSidebar({
  sidebarCollapsed,
  setSidebarCollapsed,
  activeMenu,
  currentFolder,
  navTo,
  t,
  lang,
  totalSize,
  doUpload,
  setShowNewFolder,
  onStorageClick
}: FileManagerSidebarProps) {
  const [newMenuOpen, setNewMenuOpen] = useState(false);

  const usedPct = 0; // The original code uses usedPct = 0;

  return (
    <aside 
      style={{
        width: sidebarCollapsed ? 72 : 256, flexShrink: 0, display: 'flex', flexDirection: 'column',
        padding: sidebarCollapsed ? '12px 6px 20px' : '12px 12px 20px', background: 'var(--md-surface)',
        borderRight: '1px solid var(--md-outline-variant)',
        transition: 'width 0.25s cubic-bezier(0.2, 0, 0, 1), padding 0.25s cubic-bezier(0.2, 0, 0, 1)',
        alignItems: sidebarCollapsed ? 'center' : 'stretch',
        overflow: 'visible'
      }}
    >
      {/* Logo */}
      <div 
        style={{ 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: sidebarCollapsed ? 'center' : 'flex-start',
          gap: 8, 
          padding: sidebarCollapsed ? '4px 0 16px 0' : '4px 4px 16px 4px',
          width: '100%'
        }}
      >
        <img src="/icon.webp" alt="" style={{ width: 36, height: 36, objectFit: 'contain', borderRadius: 8 }}/>
        {!sidebarCollapsed && (
          <span style={{ fontFamily: 'Google Sans,sans-serif', fontSize: 18, fontWeight: 600, color: 'var(--md-on-surface)', whiteSpace: 'nowrap' }}>
            Awd TeleDrive
          </span>
        )}
      </div>

      {/* New button */}
      <div 
        style={{ position: 'relative', marginBottom: 12, width: sidebarCollapsed ? 'auto' : '100%' }} 
        onClick={e => e.stopPropagation()}
      >
        <button
          onClick={() => setNewMenuOpen(o => !o)}
          style={{
            display: 'flex', alignItems: 'center', justifyContent: sidebarCollapsed ? 'center' : 'flex-start', gap: sidebarCollapsed ? 0 : 12,
            background: 'var(--md-surface-container-high)',
            color: 'var(--md-on-surface)', 
            borderRadius: sidebarCollapsed ? '50%' : 16,
            border: 'none',
            width: sidebarCollapsed ? 48 : 'auto',
            height: sidebarCollapsed ? 48 : 'auto',
            padding: sidebarCollapsed ? 0 : '16px 28px 16px 20px',
            fontFamily: 'Google Sans,sans-serif', fontSize: 14, fontWeight: 600,
            cursor: 'pointer',
            boxShadow: '0 1px 3px rgba(0,0,0,0.1), 0 1px 2px rgba(0,0,0,0.06)',
            transition: 'all .25s cubic-bezier(0.2, 0, 0, 1)',
            margin: sidebarCollapsed ? '0 auto' : '0',
          }}
          onMouseEnter={e => { 
            e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.15), 0 2px 4px rgba(0,0,0,0.1)'; 
            e.currentTarget.style.background = 'var(--md-surface-container-highest)'; 
            if (!sidebarCollapsed) e.currentTarget.style.transform = 'translateY(-1px)';
          }}
          onMouseLeave={e => { 
            e.currentTarget.style.boxShadow = '0 1px 3px rgba(0,0,0,0.1), 0 1px 2px rgba(0,0,0,0.06)'; 
            e.currentTarget.style.background = 'var(--md-surface-container-high)'; 
            if (!sidebarCollapsed) e.currentTarget.style.transform = 'none';
          }}
          title={sidebarCollapsed ? t.new : undefined}
        >
          <Plus size={22} strokeWidth={2.5}/> {!sidebarCollapsed && t.new}
        </button>

        {newMenuOpen && (
          <div 
            style={{
              position: 'absolute', 
              top: 64, 
              left: sidebarCollapsed ? 56 : 0, 
              zIndex: 600,
              background: 'var(--md-surface-container-lowest)',
              borderRadius: 16, boxShadow: '0 8px 32px rgba(0,0,0,.16)',
              border: '1px solid var(--md-outline-variant)', minWidth: 220,
              overflow: 'hidden', animation: 'gdAnim .2s cubic-bezier(0.2, 0, 0, 1)',
            }}
          >
            {[
              { icon: <Upload size={18}/>, label: t.uploadFile, action: () => { setNewMenuOpen(false); doUpload(); } },
              ...(activeMenu === 'drive' && currentFolder === null
                ? [{ icon: <FolderPlus size={18}/>, label: t.newFolder, action: () => { setNewMenuOpen(false); setShowNewFolder(true); } }]
                : []),
            ].map((item, i) => (
              <div 
                key={i} 
                onClick={item.action}
                style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 20px', cursor: 'pointer', fontSize: 14, color: 'var(--md-on-surface)', transition: 'background .15s' }}
                onMouseEnter={e => e.currentTarget.style.background = 'var(--md-surface-container-high)'}
                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
              >
                <span style={{ color: 'var(--md-on-surface-variant)', display: 'flex' }}>{item.icon}</span> {item.label}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Nav items */}
      <nav style={{ display: 'flex', flexDirection: 'column', gap: 4, marginTop: 4, width: '100%' }}>
        {[
          { key: 'drive',   icon: <Home size={20}/>,      label: t.myDrive, action: () => navTo('drive', null) },
          { key: 'starred', icon: <Star size={20}/>,      label: t.starred, action: () => navTo('starred') },
          { key: 'media',   icon: <ImageIcon size={20}/>, label: t.media,   action: () => navTo('media') },
          { key: 'telephoto', icon: <Camera size={20}/>,   label: t.telephoto,   action: () => navTo('telephoto') },
          { key: 'sync',    icon: <RefreshCw size={20}/>, label: t.syncActivity, action: () => navTo('sync') },
          { key: 'recent',  icon: <Clock size={20}/>,     label: t.recent,       action: () => navTo('recent') },
          { key: 'webshare', icon: <Share2 size={20}/>,     label: t.webShare,     action: () => navTo('webshare') },
        ].map(item => {
          const isActive = activeMenu === item.key;
          return (
            <div 
              key={item.key} 
              onClick={item.action}
              title={sidebarCollapsed ? item.label : undefined}
              style={{
                display: 'flex', alignItems: 'center', 
                justifyContent: sidebarCollapsed ? 'center' : 'flex-start',
                gap: sidebarCollapsed ? 0 : 16, 
                padding: sidebarCollapsed ? 0 : '0 24px',
                width: sidebarCollapsed ? 48 : 'auto',
                height: 48, 
                borderRadius: sidebarCollapsed ? '50%' : 24, 
                cursor: 'pointer',
                fontFamily: 'Google Sans,sans-serif', fontSize: 14,
                fontWeight: isActive ? 600 : 500,
                background: isActive ? 'var(--md-secondary-container)' : 'transparent',
                color: isActive ? 'var(--md-on-secondary-container)' : 'var(--md-on-surface-variant)',
                transition: 'all .2s cubic-bezier(0.2, 0, 0, 1)',
                margin: sidebarCollapsed ? '0 auto' : '0',
              }}
              onMouseEnter={e => { if (!isActive) e.currentTarget.style.background = 'var(--md-surface-container-high)'; }}
              onMouseLeave={e => { if (!isActive) e.currentTarget.style.background = 'transparent'; }}
            >
              <span style={{ display: 'flex', alignItems: 'center' }}>{item.icon}</span> 
              {!sidebarCollapsed && item.label}
            </div>
          );
        })}
      </nav>

      {/* Storage */}
      <div style={{ marginTop: 'auto', padding: '16px 0 0', borderTop: '1px solid var(--md-outline-variant)', width: '100%' }}>
        {sidebarCollapsed ? (
          <div 
            onClick={onStorageClick}
            title={lang === 'id' ? `Penyimpanan: ${fmtBytes(totalSize)} dari Tidak Terbatas digunakan` : `Storage: ${fmtBytes(totalSize)} of Unlimited used`}
            style={{
              width: 48,
              height: 48,
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              background: activeMenu === 'analytics' ? 'var(--md-secondary-container)' : 'transparent',
              color: activeMenu === 'analytics' ? 'var(--md-on-secondary-container)' : 'var(--md-on-surface-variant)',
              transition: 'background .2s',
              margin: '0 auto',
            }}
            onMouseEnter={e => { if (activeMenu !== 'analytics') e.currentTarget.style.background = 'var(--md-surface-container-high)'; }}
            onMouseLeave={e => { if (activeMenu !== 'analytics') e.currentTarget.style.background = 'transparent'; }}
          >
            <Cloud size={20} />
          </div>
        ) : (
          <div 
            onClick={onStorageClick}
            style={{ 
              padding: '12px 16px',
              cursor: 'pointer', 
              borderRadius: '12px', 
              transition: 'background .2s',
              background: activeMenu === 'analytics' ? 'var(--md-secondary-container)' : 'transparent',
              color: activeMenu === 'analytics' ? 'var(--md-on-secondary-container)' : 'inherit',
            }}
            onMouseEnter={e => { if (activeMenu !== 'analytics') e.currentTarget.style.background = 'var(--md-surface-container-high)'; }}
            onMouseLeave={e => { if (activeMenu !== 'analytics') e.currentTarget.style.background = 'transparent'; }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
              <Cloud size={16} color={activeMenu === 'analytics' ? 'var(--md-on-secondary-container)' : 'var(--md-on-surface-variant)'}/>
              <span style={{ fontSize: 13, fontWeight: 500, color: activeMenu === 'analytics' ? 'var(--md-on-secondary-container)' : 'var(--md-on-surface)' }}>{t.storage}</span>
            </div>
            <span style={{ fontSize: 12, color: activeMenu === 'analytics' ? 'var(--md-on-secondary-container)' : 'var(--md-on-surface-variant)', opacity: activeMenu === 'analytics' ? 0.8 : 1 }}>
              {lang === 'id' 
                ? `${fmtBytes(totalSize)} dari Tidak Terbatas digunakan` 
                : `${fmtBytes(totalSize)} of Unlimited used`}
            </span>
          </div>
        )}
      </div>
    </aside>
  );
}
