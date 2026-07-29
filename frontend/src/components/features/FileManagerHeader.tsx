import React, { useState } from 'react';
import { 
  Menu, Search, X, ArrowUpDown, Check, Download, FolderOutput, 
  Star, Trash2, List, LayoutGrid, Sun, Moon, Settings as SettingsIcon, LogOut, RotateCw 
} from 'lucide-react';
import { Logout } from '../../../wailsjs/go/main/App';

interface FileManagerHeaderProps {
  sidebarCollapsed: boolean;
  setSidebarCollapsed: (v: boolean | ((p: boolean) => boolean)) => void;
  searchQuery: string;
  setSearchQuery: (q: string) => void;
  doSearch: (e: React.KeyboardEvent<HTMLInputElement>) => void;
  activeMenu: string;
  navTo: (menu: string, folder?: any) => void;
  t: any;
  lang: string;
  sortBy: string;
  setSortBy: (s: string) => void;
  sortAsc: boolean;
  setSortAsc: (a: boolean) => void;
  selected: string[];
  setSelected: (s: string[]) => void;
  files: any[];
  doDownload: (file: any) => Promise<void>;
  setShowMove: (v: any) => void;
  doToggleStarSelected: () => Promise<void>;
  doDeleteSelected: () => void;
  viewMode: 'grid' | 'list';
  setViewMode: (v: 'grid' | 'list' | ((p: 'grid' | 'list') => 'grid' | 'list')) => void;
  dark: boolean;
  setDark: (v: boolean | ((p: boolean) => boolean)) => void;
  setShowSettings: (v: boolean) => void;
  showConfirm: (title: string, message: string, onConfirm: () => void, danger?: boolean) => void;
  closeConfirm: () => void;
  onLogout: () => void;
  onRefresh?: () => void;
  isRefreshing?: boolean;
}

export default function FileManagerHeader({
  sidebarCollapsed,
  setSidebarCollapsed,
  searchQuery,
  setSearchQuery,
  doSearch,
  activeMenu,
  navTo,
  t,
  lang,
  sortBy,
  setSortBy,
  sortAsc,
  setSortAsc,
  selected,
  setSelected,
  files,
  doDownload,
  setShowMove,
  doToggleStarSelected,
  doDeleteSelected,
  viewMode,
  setViewMode,
  dark,
  setDark,
  setShowSettings,
  showConfirm,
  closeConfirm,
  onLogout,
  onRefresh,
  isRefreshing
}: FileManagerHeaderProps) {
  const [sortOpen, setSortOpen] = useState(false);

  const SORT_OPTS = [
    { key: 'name', label: t.name },
    { key: 'size', label: t.size },
  ];

  return (
    <header 
      style={{
        display: 'flex', alignItems: 'center', gap: 12, padding: '8px 20px',
        background: 'var(--md-surface)',
        borderBottom: '1px solid var(--md-outline-variant)',
        flexShrink: 0, zIndex: 100, height: 64,
      }}
      onClick={() => setSortOpen(false)}
    >
      {/* Hamburger menu button */}
      <button
        onClick={(e) => { e.stopPropagation(); setSidebarCollapsed(c => !c); }}
        style={{
          border: 'none', background: 'transparent', color: 'var(--md-on-surface-variant)',
          cursor: 'pointer', width: 40, height: 40, borderRadius: '50%',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          transition: 'background 0.15s', marginRight: 8, flexShrink: 0
        }}
        onMouseEnter={e => e.currentTarget.style.background = 'var(--md-surface-container-high)'}
        onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
        title={sidebarCollapsed ? (lang === 'id' ? 'Tampilkan Sidebar' : 'Expand Sidebar') : (lang === 'id' ? 'Sembunyikan Sidebar' : 'Collapse Sidebar')}
      >
        <Menu size={20} />
      </button>

      {/* Search */}
      <div
        style={{
          flex: 1, maxWidth: 720,
          background: 'var(--md-surface-container-high)',
          border: '1px solid var(--md-outline-variant)',
          borderRadius: 28, display: 'flex', alignItems: 'center', height: 46, padding: '0 20px', gap: 12,
          transition: 'border-color .15s, box-shadow .15s',
        }}
        onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--md-outline)'; }}
        onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--md-outline-variant)'; }}
        onClick={e => e.stopPropagation()}
      >
        <Search size={18} color="var(--md-on-surface-variant)" style={{ flexShrink: 0 }}/>
        <input
          placeholder={t.search} 
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          onKeyDown={doSearch}
          style={{ flex: 1, background: 'none', border: 'none', outline: 'none', fontSize: 15, color: 'var(--md-on-surface)', fontFamily: 'Google Sans,sans-serif' }}
        />
        {searchQuery.length > 0 && (
          <button 
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setSearchQuery('');
              if (activeMenu === 'search') {
                navTo('drive');
              }
            }}
            style={{
              background: 'transparent', border: 'none', cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: 'var(--md-on-surface-variant)', padding: 4, borderRadius: '50%'
            }}
            onMouseEnter={e => e.currentTarget.style.background = 'var(--md-surface-variant)'}
            onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
            title={t.clearSearch}
          >
            <X size={18} />
          </button>
        )}
      </div>

      {/* Sort dropdown */}
      <div style={{ position: 'relative' }} onClick={e => e.stopPropagation()}>
        <button 
          onClick={() => setSortOpen(o => !o)}
          style={{ 
            display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', border: '1.5px solid var(--md-outline-variant)',
            borderRadius: 100, background: 'transparent', color: 'var(--md-on-surface-variant)',
            fontFamily: 'Google Sans,sans-serif', fontSize: 13, fontWeight: 500, cursor: 'pointer',
            transition: 'border-color .15s', whiteSpace: 'nowrap',
          }}
          onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--md-outline)'}
          onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--md-outline-variant)'}
        >
          <ArrowUpDown size={14}/>
          {SORT_OPTS.find(o => o.key === sortBy)?.label}
          {sortAsc ? ' ↑' : ' ↓'}
        </button>
        {sortOpen && (
          <div 
            style={{ 
              position: 'absolute', top: 42, right: 0, zIndex: 600,
              background: 'var(--md-surface-container-lowest)', borderRadius: 8,
              boxShadow: '0 4px 20px rgba(0,0,0,.14)', border: '1px solid var(--md-outline-variant)',
              minWidth: 150, overflow: 'hidden', animation: 'gdAnim .14s ease',
            }}
          >
            {SORT_OPTS.map(opt => (
              <div 
                key={opt.key} 
                onClick={() => { setSortBy(opt.key); setSortOpen(false); }}
                style={{ 
                  display: 'flex', alignItems: 'center', gap: 10, padding: '10px 16px',
                  cursor: 'pointer', fontSize: 13, color: 'var(--md-on-surface)',
                  background: sortBy === opt.key ? 'var(--md-secondary-container)' : 'transparent',
                  fontWeight: sortBy === opt.key ? 600 : 400,
                }}
                onMouseEnter={e => { if (sortBy !== opt.key) e.currentTarget.style.background = 'var(--md-surface-container-high)'; }}
                onMouseLeave={e => { if (sortBy !== opt.key) e.currentTarget.style.background = 'transparent'; }}
              >
                {sortBy === opt.key && <Check size={13} color="var(--md-primary)" strokeWidth={3}/>} {opt.label}
              </div>
            ))}
            <div style={{ borderTop: '1px solid var(--md-outline-variant)', padding: '6px 0' }}>
              <div 
                onClick={() => { setSortAsc(true); setSortOpen(false); }}
                style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 16px', cursor: 'pointer', fontSize: 13, color: 'var(--md-on-surface)' }}
                onMouseEnter={e => e.currentTarget.style.background = 'var(--md-surface-container-high)'}
                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
              >
                {sortAsc && <Check size={13} color="var(--md-primary)" strokeWidth={3}/>} A → Z / Smallest
              </div>
              <div 
                onClick={() => { setSortAsc(false); setSortOpen(false); }}
                style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 16px', cursor: 'pointer', fontSize: 13, color: 'var(--md-on-surface)' }}
                onMouseEnter={e => e.currentTarget.style.background = 'var(--md-surface-container-high)'}
                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
              >
                {!sortAsc && <Check size={13} color="var(--md-primary)" strokeWidth={3}/>} Z → A / Largest
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Action icons */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 2, marginLeft: 'auto' }} onClick={e => e.stopPropagation()}>
        {selected.length > 0 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '0 10px 0 14px', marginRight: 8, background: 'var(--md-secondary-container)', borderRadius: 100, height: 36 }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--md-on-secondary-container)', marginRight: 4 }}>
              {selected.length} {t.selected}
            </span>
            {[
              { 
                id: 'download', 
                icon: <Download size={17}/>, 
                action: async () => { 
                  for (const fid of selected) { 
                    const f = files.find(x => String(x.id) === String(fid)); 
                    if (f && f.type !== 'folder') await doDownload(f); 
                  } 
                } 
              },
              { id: 'move', icon: <FolderOutput size={17}/>, action: () => setShowMove('bulk') },
              { id: 'star', icon: <Star size={17}/>, action: doToggleStarSelected },
              { id: 'delete', icon: <Trash2 size={17}/>, action: doDeleteSelected, danger: true },
              { id: 'close', icon: <X size={17}/>, action: () => setSelected([]) },
            ].filter(a => !(a.id === 'move' && files.some(f => selected.includes(f.id) && f.type === 'folder'))).map((a, i) => (
              <button 
                key={i} 
                onClick={a.action} 
                style={{
                  width: 32, height: 32, borderRadius: '50%', border: 'none', cursor: 'pointer',
                  background: 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: a.danger ? 'var(--md-error)' : 'var(--md-on-secondary-container)',
                  transition: 'background .15s',
                }}
                onMouseEnter={e => e.currentTarget.style.background = 'rgba(0,0,0,.08)'}
                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
              >
                {a.icon}
              </button>
            ))}
          </div>
        )}
        {(() => {
          const showLayoutToggle = ['drive', 'starred', 'recent'].includes(activeMenu);
          const headerButtons = [
            ...(onRefresh ? [{ 
              icon: <RotateCw size={19} style={isRefreshing ? { animation: 'spin 1s linear infinite' } : {}} />, 
              action: onRefresh, 
              title: lang === 'id' ? 'Sinkronkan / Refresh Data' : 'Sync / Refresh Data' 
            }] : []),
            ...(showLayoutToggle ? [{ icon: viewMode === 'grid' ? <List size={20}/> : <LayoutGrid size={20}/>, action: () => setViewMode(v => v === 'grid' ? 'list' : 'grid'), title: viewMode === 'grid' ? 'List View' : 'Grid View' }] : []),
            { icon: dark ? <Sun size={20}/> : <Moon size={20}/>, action: () => setDark(d => !d), title: dark ? 'Light Mode' : 'Dark Mode' },
            { icon: <SettingsIcon size={20}/>, action: () => navTo('settings'), title: t.settings },
            {
              icon: <LogOut size={20}/>,
              action: () => showConfirm(
                t.logOutTelegram,
                t.logOutConfirm,
                async () => {
                  closeConfirm();
                  await Logout();
                  localStorage.clear();
                  onLogout();
                },
                true
              )
            },
          ];
          return headerButtons.map((btn, i) => (
            <button 
              key={i} 
              onClick={btn.action} 
              title={(btn as any).title}
              style={{
                width: 40, height: 40, borderRadius: '50%', border: 'none', cursor: 'pointer',
                background: 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: 'var(--md-on-surface-variant)', transition: 'background .15s',
              }}
              onMouseEnter={e => e.currentTarget.style.background = 'var(--md-surface-container-high)'}
              onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
            >
              {btn.icon}
            </button>
          ));
        })()}
      </div>
    </header>
  );
}
