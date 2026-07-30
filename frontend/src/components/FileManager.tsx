import React, { useState, useEffect, useRef } from 'react';
import {
  Folder, Trash2, ChevronRight, List, Info, 
  FolderOutput, X, Check, AlertCircle, Monitor, Power, 
  RefreshCw, RotateCw, Eye, EyeOff, Copy, Link, Link2Off, Menu, MoreVertical, Pencil, Send,
  Download, Star, Share2, FolderPlus, Upload
} from 'lucide-react';
import {
  GetFiles, UploadFile, DownloadFile, DeleteFile,
  CreateFolder, GetTotalSize,
  SearchFiles, GetMediaFiles, GetStarredFiles, ToggleStar,
  MoveFile, ClearCache,
  IsStartupEnabled, SetStartup, SetMinimizeToTray, QuitApp,
  RenameFolder, RenameFile,
  OpenMultiFileDialog, UploadMultipleFiles,
  GetFilesPage,
  GetShareLink,
  AddRecentFile, ClearRecentFiles, GetRecentFiles,
  GetSettings, ExportManifest, ImportManifest,
  GetStorageStats,
  CreateWebShare, GetWebShares, DeleteWebShare, GetLocalIPAddress, GetWebServerPort, GetTunnelPublicUrl, IsTunnelRunning,
} from '../../wailsjs/go/main/App';
import { EventsOn, OnFileDrop, OnFileDropOff } from '../../wailsjs/runtime/runtime';

import PreviewModal from './PreviewModal';
import WebShareManagement from './WebShareManagement';
import SecureFolder from './SecureFolder';
import VirtualDriveManagement from './VirtualDriveManagement';
import SettingsManagement from './SettingsManagement';

// Import refactored modules
import { fmtBytes } from '../utils/format';
import { applyTheme } from '../utils/theme';
import { FileManagerTranslations } from '../locales/translation';

import Modal from './ui/Modal';
import ConfirmDialog from './ui/ConfirmDialog';
import FieldInput from './ui/FieldInput';
import { BtnFill, BtnTonal } from './ui/Button';
import { FileTypeIcon, ThumbImg } from './ui/FileTypeIcon';

import FileManagerSidebar from './features/FileManagerSidebar';
import FileManagerHeader from './features/FileManagerHeader';
import StorageAnalytics from './features/StorageAnalytics';
import SyncManager from './features/SyncManager';
import RecentActivity from './features/RecentActivity';
import ChangelogView from './features/ChangelogView';

export default function FileManager({ onLogout }: { onLogout: () => void }) {
  const saved = (k: string, fallback: any) => { 
    try { 
      const v = localStorage.getItem(k); 
      return v !== null ? JSON.parse(v) : fallback; 
    } catch { 
      return fallback; 
    } 
  };

  const [lang, setLangRaw] = useState(() => saved('td_lang', 'en'));
  const setLang = (v: string) => { setLangRaw(v); localStorage.setItem('td_lang', JSON.stringify(v)); };
  const t = FileManagerTranslations[lang as 'en' | 'id'] || FileManagerTranslations.en;

  const [dark, setDarkRaw] = useState(() => saved('td_dark', false));
  const setDark = (v: boolean | ((p: boolean) => boolean)) => {
    setDarkRaw(prev => {
      const newVal = typeof v === 'function' ? v(prev) : v;
      localStorage.setItem('td_dark', JSON.stringify(newVal));
      return newVal;
    });
  };

  const [activeMenu, setActiveMenu] = useState('drive');
  const [currentFolder, setCurrentFolder] = useState<any>(null);
  const [files, setFiles] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<string[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hovered, setHovered] = useState<string | null>(null);
  const [previewFile, setPreviewFile] = useState<any>(null);
  const [toasts, setToasts] = useState<any[]>([]);
  const [totalSize, setTotalSize] = useState(0);
  const [activeTransfers, setActiveTransfers] = useState<Record<string, { fileName: string; percent: number }>>({});
  const [syncActivities, setSyncActivities] = useState<Record<string, { name: string; action: string; status: string; size: number; time: number }>>({});
  const [isDragging, setIsDragging] = useState(false);

  const [showNewFolder, setShowNewFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [newFolderType, setNewFolderType] = useState<'virtual' | 'channel'>('virtual');
  const [showSettings, setShowSettings] = useState(false);
  const [showInfo, setShowInfo] = useState<any>(null);
  const [showMove, setShowMove] = useState<any>(null);
  const [moveDest, setMoveDest] = useState('');
  const [showRename, setShowRename] = useState<any>(null);
  const [renameValue, setRenameValue] = useState('');
  const [renaming, setRenaming] = useState(false);
  const [recentFiles, setRecentFiles] = useState<any[]>([]);
  const [syncMode, setSyncMode] = useState('one-way');
  const [syncIntervalVal, setSyncIntervalVal] = useState(60);
  const [syncTasks, setSyncTasks] = useState<any[]>([]);
  const [newBackupFolder, setNewBackupFolder] = useState('');
  const [newBackupDest, setNewBackupDest] = useState('');
  const [availableFolders, setAvailableFolders] = useState<any[]>([]);
  const [storageStats, setStorageStats] = useState<any>(null);
  const [filterSize, setFilterSize] = useState('all');
  const [filterDate, setFilterDate] = useState('all');
  const [showWebShareConfig, setShowWebShareConfig] = useState<any>(null);
  const [webSharePassword, setWebSharePassword] = useState('');
  const [showWebShareExists, setShowWebShareExists] = useState<any>(null);
  const [revealExistPassword, setRevealExistPassword] = useState(false);
  const [activeWebShares, setActiveWebShares] = useState<any[]>([]);
  const [telegramShareLink, setTelegramShareLink] = useState<any>(null);
  const [channelParticipants, setChannelParticipants] = useState<any[]>([]);
  const [loadingParticipants, setLoadingParticipants] = useState(false);
  const [activeSubmenuIndex, setActiveSubmenuIndex] = useState<number | null>(null);
  const [shareDirectFile, setShareDirectFile] = useState<any>(null);
  const [shareDirectPhone, setShareDirectPhone] = useState('');
  const [sendingDirectFile, setSendingDirectFile] = useState(false);
  
  const [sidebarCollapsed, setSidebarCollapsedRaw] = useState(() => saved('td_sidebarCollapsed', false));
  const setSidebarCollapsed = (v: boolean | ((p: boolean) => boolean)) => {
    setSidebarCollapsedRaw(prev => {
      const newVal = typeof v === 'function' ? v(prev) : v;
      localStorage.setItem('td_sidebarCollapsed', JSON.stringify(newVal));
      return newVal;
    });
  };

  const currentFolderRef = useRef(currentFolder);
  const tRef = useRef(t);

  useEffect(() => {
    currentFolderRef.current = currentFolder;
  }, [currentFolder]);

  useEffect(() => {
    tRef.current = t;
  }, [t]);

  const [minimizeToTray, setMinimizeToTrayRaw] = useState(() => saved('td_minimizeToTray', false));
  const setMinimizeToTray = (v: boolean) => { setMinimizeToTrayRaw(v); localStorage.setItem('td_minimizeToTray', JSON.stringify(v)); };
  const [backupFolder, setBackupFolderRaw] = useState(() => saved('td_backupFolder', ''));
  const setBackupFolder = (v: string) => { setBackupFolderRaw(v); localStorage.setItem('td_backupFolder', JSON.stringify(v)); };
  const [backupActive, setBackupActive] = useState(false);
  const [startupEnabled, setStartupEnabled] = useState(false);

  const [searchQuery, setSearchQuery] = useState('');
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [viewMode, setViewModeRaw] = useState<'grid' | 'list'>(() => saved('td_viewMode', 'grid'));
  const setViewMode = (v: 'grid' | 'list' | ((p: 'grid' | 'list') => 'grid' | 'list')) => {
    setViewModeRaw(prev => {
      const newVal = typeof v === 'function' ? v(prev) : v;
      localStorage.setItem('td_viewMode', JSON.stringify(newVal));
      return newVal;
    });
  };
  const [filterType, setFilterType] = useState('all');
  const [sortBy, setSortByRaw] = useState(() => saved('td_sortBy', 'name'));
  const setSortBy = (v: string) => { setSortByRaw(v); localStorage.setItem('td_sortBy', JSON.stringify(v)); };
  const [sortAsc, setSortAscRaw] = useState(() => saved('td_sortAsc', true));
  const setSortAsc = (v: boolean) => { setSortAscRaw(v); localStorage.setItem('td_sortAsc', JSON.stringify(v)); };

  const [starredIds, setStarredIds] = useState<Set<string>>(() => {
    try {
      return new Set(JSON.parse(localStorage.getItem('td_starred') || '[]'));
    } catch {
      return new Set();
    }
  });

  const addStar = (id: string) => setStarredIds(p => { const s = new Set(p); s.add(String(id)); localStorage.setItem('td_starred', JSON.stringify([...s])); return s; });
  const removeStar = (id: string) => setStarredIds(p => { const s = new Set(p); s.delete(String(id)); localStorage.setItem('td_starred', JSON.stringify([...s])); return s; });

  const [ctxMenu, setCtxMenu] = useState<{ file: any; x: number; y: number } | null>(null);
  const [confirmDlg, setConfirmDlg] = useState<{ title: string; message: string; onConfirm: () => void; danger?: boolean } | null>(null);

  const showConfirm = (title: string, message: string, onConfirm: () => void, danger = false) =>
    setConfirmDlg({ title, message, onConfirm, danger });
  const closeConfirm = () => setConfirmDlg(null);

  const fetchActiveWebShares = async () => {
    try {
      const items = await GetWebShares();
      setActiveWebShares(items || []);
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    fetchActiveWebShares();
  }, [activeMenu]);

  useEffect(() => {
    if (showMove) {
      if (window.go && window.go.main && window.go.main.App.GetFolders) {
        window.go.main.App.GetFolders().then(folders => setAvailableFolders(folders || []));
      }
    }
  }, [showMove]);

  /* theme */
  useEffect(() => { applyTheme(dark); }, [dark]);

  const refreshStorageStats = async () => {
    try {
      const s = await GetStorageStats();
      if (s) {
        setStorageStats(s);
        if (typeof s.total === 'number' && s.total >= 0) {
          setTotalSize(s.total);
        }
      }
    } catch (e) {
      GetTotalSize().then(sz => setTotalSize(sz)).catch(() => {});
    }
  };

  /* init */
  useEffect(() => {
    refreshStorageStats();
    fetchActiveWebShares();
    
    // Load Backend Settings
    window.go?.main?.App?.GetSettings?.().then((s: any) => {
      if (s) {
        setBackupActive(s.autoBackupEnabled || false);
        if (s.backupFolder) setBackupFolder(s.backupFolder);
        if (s.minimizeToTray !== undefined) {
          setMinimizeToTray(s.minimizeToTray);
        }
      }
    }).catch(() => {});

    // Disable default browser context menu globally
    const blockCtx = (e: MouseEvent) => e.preventDefault();
    document.addEventListener('contextmenu', blockCtx);

    const unsub = EventsOn('transfer:progress', (ev: any) => {
      setActiveTransfers(p => ({ ...p, [ev.fileName]: ev }));
    });
    const unsubSync = EventsOn('sync:activity', (ev: any) => {
      setSyncActivities(p => ({ ...p, [ev.name]: ev }));
    });
    const unsubNavigate = EventsOn('menu:navigate', (menu: string) => {
      setActiveMenu(menu);
      setCurrentFolder(null);
    });

    // Drag & drop from desktop via Wails OnFileDrop
    OnFileDrop((x: number, y: number, paths: string[]) => {
      if (!paths || paths.length === 0) return;
      setIsDragging(false);
      const dest = currentFolderRef.current ? String(currentFolderRef.current.id) : '';
      (async () => {
        if (paths.length === 1) {
          addToast(tRef.current.uploadingToast);
          const r = await UploadFile(paths[0], dest);
          if (r.success) {
            addToast(tRef.current.uploadCompleteToast);
            AddRecentFile({ id: '', name: paths[0].split('\\').pop()!.split('/').pop()!, type: 'file', size: 0, mimeType: '', parentId: dest, date: 0 }, 'upload');
            fetchFiles(); GetTotalSize().then(s => setTotalSize(s));
          }
          else addToast(r.error || tRef.current.uploadFailedToast, 'error');
        } else {
          addToast(tRef.current.uploadingItems(paths.length));
          const r = await UploadMultipleFiles(paths, dest);
          if (r.successCount > 0) addToast(tRef.current.uploadsComplete(r.successCount));
          if (r.failCount > 0) addToast(`${r.failCount} failed`, 'error');
          fetchFiles(); GetTotalSize().then(s => setTotalSize(s));
        }
      })();
    }, true);

    return () => {
      unsub && unsub();
      unsubSync && unsubSync();
      unsubNavigate && unsubNavigate();
      document.removeEventListener('contextmenu', blockCtx);
      OnFileDropOff();
    };
  }, []);

  /* load startup + sync settings from backend */
  const loadSettings = async () => {
    try {
      const s = await GetSettings();
      if (s.syncMode) setSyncMode(s.syncMode);
      if (s.syncInterval) setSyncIntervalVal(s.syncInterval);
      if (s.syncTasks) setSyncTasks(s.syncTasks);
      setBackupActive(s.autoBackupEnabled || false);
      if (s.backupFolder) setBackupFolder(s.backupFolder);
      if (s.minimizeToTray !== undefined) {
        setMinimizeToTray(s.minimizeToTray);
      }

      const rootItems = await GetFiles("");
      if (rootItems) {
        const folders = rootItems.filter(f => f.type === 'folder');
        setAvailableFolders(folders);
        if (folders.length > 0) {
          setNewBackupDest(p => p || String(folders[0].id));
        }
      }
    } catch (e) {}
  };

  const fetchRecentFiles = async () => {
    try {
      const items = await GetRecentFiles();
      setRecentFiles(items || []);
    } catch (e) {
      console.error("Failed to fetch recent files:", e);
    }
  };

  useEffect(() => {
    IsStartupEnabled().then(v => setStartupEnabled(!!v)).catch(() => {});
    loadSettings();
  }, []);

  useEffect(() => {
    if (activeMenu === 'recent') {
      fetchRecentFiles();
    }
  }, [activeMenu]);

  /* keyboard shortcuts */
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      // Don't trigger if any modal is open or typing in an input
      const tag = document.activeElement?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
      if (showNewFolder || showSettings || showMove || showRename || showInfo || confirmDlg) return;

      if (e.ctrlKey && e.key === 'u') { e.preventDefault(); doUpload(); }
      if (e.ctrlKey && e.key === 'n') {
        e.preventDefault();
        const isChannelFolder = currentFolder && (currentFolder.type === 'folder' || currentFolder.mimeType === 'folder') && currentFolder.mimeType !== 'virtual_folder' && !String(currentFolder.id || '').startsWith('vf_');
        if (!isChannelFolder) setShowNewFolder(true);
      }
      if (e.ctrlKey && e.key === 'f') {
        e.preventDefault();
        (document.querySelector('input[placeholder]') as HTMLElement | null)?.focus();
      }
      if (e.key === 'Delete' && selected.length > 0) { e.preventDefault(); doDeleteSelected(); }
      if (e.key === 'Backspace' && currentFolder) { e.preventDefault(); navTo('drive', null); }
      if (e.key === 'Escape') { setSelected([]); setCtxMenu(null); }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  });

  /* notification listener */
  useEffect(() => {
    const unsubNotif = EventsOn('notification', (ev: any) => {
      if (ev?.message) addToast(ev.message);
    });
    return () => { unsubNotif && unsubNotif(); };
  }, []);

  /* fetch */
  const fetchFiles = async () => {
    if (activeMenu === 'search' || activeMenu === 'sync' || activeMenu === 'recent' || activeMenu === 'telephoto' || activeMenu === 'secureFolder' || activeMenu === 'analytics' || activeMenu === 'webshare') return;
    setLoading(true);
    setHasMore(false);
    try {
      let r;
      if (activeMenu === 'starred') r = await GetStarredFiles();
      else if (activeMenu === 'media') {
        const rawMedia = (await GetMediaFiles()) || [];
        r = rawMedia.filter((f: any) => !f.name?.toLowerCase().startsWith('enc_'));
      }
      else if (activeMenu === 'drive') {
        const page = await GetFilesPage(currentFolder ? String(currentFolder.id) : '', 0);
        r = page.items || [];
        setHasMore(page.hasMore || false);
      }
      else r = await GetFiles(currentFolder ? String(currentFolder.id) : '');
      setFiles(r || []);
    } catch (e) { addToast(String(e), 'error'); }
    finally { setLoading(false); }
  };

  const handleRefresh = async () => {
    if (isRefreshing) return;
    setIsRefreshing(true);
    addToast(lang === 'id' ? 'Menyingkronkan data dengan Telegram...' : 'Syncing data with Telegram...');
    try {
      if ((window as any).go?.main?.App?.RefreshFiles) {
        await (window as any).go.main.App.RefreshFiles();
      }
      await fetchFiles();
      await refreshStorageStats();
      addToast(lang === 'id' ? 'Data berhasil disinkronkan dengan Telegram ✓' : 'Data successfully synced with Telegram ✓');
    } catch (e) {
      addToast(String(e), 'error');
    } finally {
      setIsRefreshing(false);
    }
  };

  const doShareLink = async (file: any) => {
    try {
      const r = await GetShareLink(String(file.id));
      if (r.success && r.link) {
        await navigator.clipboard.writeText(r.link);
        addToast(t.linkCopied);
      } else {
        addToast(r.error || t.shareFailed, 'error');
      }
    } catch (e) { addToast(String(e), 'error'); }
  };

  const loadMore = async () => {
    if (loadingMore || !hasMore || activeMenu !== 'drive') return;
    setLoadingMore(true);
    try {
      const nonFolderFiles = files.filter(f => f.type !== 'folder');
      const lastId = nonFolderFiles.length > 0 ? Number(nonFolderFiles[nonFolderFiles.length - 1].id) : 0;
      const page = await GetFilesPage(currentFolder ? String(currentFolder.id) : '', lastId);
      const newItems = (page.items || []).filter(f => f.type !== 'folder'); // folders already loaded
      setFiles(prev => [...prev, ...newItems]);
      setHasMore(page.hasMore || false);
    } catch (e) { addToast(String(e), 'error'); }
    finally { setLoadingMore(false); }
  };

  useEffect(() => { fetchFiles(); setSelected([]); }, [currentFolder, activeMenu]);

  /* toast */
  const addToast = (msg: string, type = 'info') => {
    const id = Date.now();
    setToasts(p => [...p, { id, msg, type }]);
    setTimeout(() => setToasts(p => p.filter(x => x.id !== id)), 3500);
  };

  /* actions */
  const doSearch = async (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key !== 'Enter' || !searchQuery.trim()) return;
    const q = searchQuery.trim().toLowerCase();
    
    // local search from current files
    const localMatches = files.filter(f => (f.name || '').toLowerCase().includes(q));
    
    setActiveMenu('search'); setLoading(true);
    try { 
      const globalMatches = (await SearchFiles(q)) || [];
      const all = [...localMatches];
      const seen = new Set(localMatches.map(f => String(f.id)));
      for (const f of globalMatches) {
        if (!seen.has(String(f.id))) {
          seen.add(String(f.id));
          all.push(f);
        }
      }
      setFiles(all);
    }
    catch (e) { addToast(String(e), 'error'); }
    finally { setLoading(false); }
  };

  const doUpload = async () => {
    const fps = await OpenMultiFileDialog();
    if (!fps || fps.length === 0) return;
    const dest = currentFolder ? String(currentFolder.id) : '';
    if (fps.length === 1) {
      addToast(t.uploadingToast);
      const r = await UploadFile(fps[0], dest);
      if (r.success) {
        addToast(t.uploadCompleteToast);
        AddRecentFile({ id: '', name: fps[0].split('\\').pop()!.split('/').pop()!, type: 'file', size: 0, mimeType: '', parentId: dest, date: 0 }, 'upload');
        fetchFiles(); GetTotalSize().then(s => setTotalSize(s));
      }
      else addToast(r.error || (t.uploadFailedToast), 'error');
    } else {
      addToast(t.uploadingItems(fps.length));
      const r = await UploadMultipleFiles(fps, dest);
      if (r.successCount > 0) addToast(t.uploadsComplete(r.successCount));
      if (r.failCount > 0) addToast(`${r.failCount} ${t.uploadFailedToast}`, 'error');
      fetchFiles(); GetTotalSize().then(s => setTotalSize(s));
    }
  };

  const doCreateFolder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newFolderName.trim()) return;
    try { 
      const dest = currentFolder ? String(currentFolder.id) : '';
      const folderTypeToUse = currentFolder !== null ? 'virtual' : newFolderType;
      const r = await CreateFolder(dest, newFolderName.trim(), folderTypeToUse); 
      if (r && r.error) {
        addToast(r.error, 'error');
        return;
      }
      addToast(t.folderCreatedToast); 
      setShowNewFolder(false); 
      setNewFolderName(''); 
      fetchFiles(); 
    }
    catch (e) { addToast(String(e), 'error'); }
  };

  const doToggleStar = async (file: any) => {
    const id = String(file.id);
    const wasStarred = starredIds.has(id);
    try {
      const s = await ToggleStar(file);
      if (s) { addStar(id); addToast('⭐ ' + (t.addedToStarred)); }
      else   { removeStar(id); addToast(t.removedFromStarred); }
      if (activeMenu === 'starred') fetchFiles();
    } catch (e) { addToast(String(e), 'error'); }
  };

  const doDelete = (file: any) => {
    showConfirm(
      t.deleteConfirmTitle(0, file.type === 'folder'),
      t.deleteConfirmMsg(file.name, 0, file.type === 'folder'),
      async () => {
        closeConfirm();
        const chatId = file.parentId || (currentFolder ? String(currentFolder.id) : '');
        const r = await DeleteFile(chatId, String(file.id));
        if (r.success) {
          AddRecentFile(file, 'delete');
          addToast(t.fileDeleted); fetchFiles(); GetTotalSize().then(s => setTotalSize(s));
        }
        else addToast(r.error || (t.deleteFailed), 'error');
      },
      true,
    );
  };

  const doDownload = async (file: any) => {
    const chatId = file.parentId || (currentFolder ? String(currentFolder.id) : '');
    addToast(t.downloading(file.name));
    if (file.type === 'folder' || file.isFolder) {
      if (window.go && window.go.main && window.go.main.App.DownloadFolder) {
        await window.go.main.App.DownloadFolder(String(file.id), file.name);
      }
    } else {
      await DownloadFile(chatId, String(file.id), file.name, Number(file.size));
    }
    AddRecentFile(file, 'download');
  };

  const doDeleteSelected = () => {
    showConfirm(
      t.deleteConfirmTitle(selected.length, false),
      t.deleteConfirmMsg('', selected.length, false),
      async () => {
        closeConfirm();
        let ok = 0;
        for (const fid of selected) {
          const f = files.find(x => String(x.id) === String(fid));
          if (!f) continue;
          const chatId = f.parentId || (currentFolder ? String(currentFolder.id) : '');
          const r = await DeleteFile(chatId, String(fid));
          if (r.success) ok++;
        }
        addToast(t.itemsDeleted(ok));
        setSelected([]); fetchFiles(); GetTotalSize().then(s => setTotalSize(s));
      },
      true,
    );
  };

  const doMoveFile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!showMove || !moveDest) return;
    const isBulk = showMove === 'bulk';
    const targets = isBulk ? [...selected] : [showMove.id];
    try {
      let okCount = 0;
      for (const fid of targets) {
        const fileObj = files.find(x => String(x.id) === String(fid));
        if (!fileObj) continue;
        
        if (fileObj.type === 'folder' || fileObj.isFolder) {
          if (window.go && window.go.main && window.go.main.App.MoveFolder) {
            const r = await window.go.main.App.MoveFolder(String(fileObj.id), moveDest);
            if (r.success) okCount++;
          }
        } else {
          const src = fileObj.parentId || (currentFolder ? String(currentFolder.id) : '');
          const r = await MoveFile(String(fileObj.id), src, moveDest);
          if (r.success) okCount++;
        }
      }
      if (okCount > 0) {
        addToast(lang === 'id' ? `Berhasil memindahkan ${okCount} item ✓` : `Successfully moved ${okCount} items ✓`);
        setShowMove(null);
        setSelected([]);
        fetchFiles();
      } else {
        addToast(lang === 'id' ? 'Gagal memindahkan item' : 'Failed to move items', 'error');
      }
    } catch (e) { addToast(String(e), 'error'); }
  };

  const doToggleStarSelected = async () => {
    if (selected.length === 0) return;
    try {
      let added = 0;
      let removed = 0;
      for (const fid of selected) {
        const f = files.find(x => String(x.id) === String(fid));
        if (!f) continue;
        const isStarred = starredIds.has(String(f.id));
        const s = await ToggleStar(f);
        if (s) {
          addStar(String(f.id));
          added++;
        } else {
          removeStar(String(f.id));
          removed++;
        }
      }
      if (added > 0 || removed > 0) {
        addToast(lang === 'id' ? `Berhasil memperbarui favorit ✓` : `Successfully updated stars ✓`);
        if (activeMenu === 'starred') fetchFiles();
      }
      setSelected([]);
    } catch (e) { addToast(String(e), 'error'); }
  };

  const doRename = async (e: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!showRename || !renameValue.trim()) return;
    const file = showRename;
    const newName = renameValue.trim();
    setRenaming(true);
    try {
      let r;
      if (file.type === 'folder') {
        r = await RenameFolder(String(file.id), newName);
      } else {
        addToast(t.renaming);
        const chatId = file.parentId || (currentFolder ? String(currentFolder.id) : '');
        r = await RenameFile(chatId, String(file.id), newName);
      }
      if (r.success) {
        addToast(t.renameSuccess);
        AddRecentFile({ ...file, name: newName }, 'rename');
        setShowRename(null);
        setRenameValue('');
        if (file.type === 'folder' && currentFolder && String(currentFolder.id) === String(file.id)) {
          setCurrentFolder({ ...currentFolder, name: newName });
        }
        fetchFiles();
      } else {
        addToast(r.error || t.renameFailed, 'error');
      }
    } catch (err) { addToast(String(err), 'error'); }
    finally { setRenaming(false); }
  };

  const toggleSel = (e: React.MouseEvent, id: string) => { 
    e.stopPropagation(); 
    setSelected(p => p.includes(id) ? p.filter(i => i !== id) : [...p, id]); 
  };

  const doCreateWebShare = async (e: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!showWebShareConfig) return;
    const file = showWebShareConfig;
    const parentId = file.parentId || (currentFolder ? String(currentFolder.id) : '');
    
    try {
      const res = await CreateWebShare(
        file.name,
        file.type,
        String(file.id),
        parentId,
        Number(file.size || 0),
        file.mimeType || '',
        webSharePassword
      );
      if (res && res.id) {
        addToast(lang === 'id' ? 'Link berbagi web sukses dibuat!' : 'Web share link created successfully!');
        setShowWebShareConfig(null);
        setWebSharePassword('');
        navTo('webshare');
      }
    } catch (err) {
      addToast(String(err), 'error');
    }
  };

  const handleOpenWebShare = async (file: any) => {
    try {
      const shares = await GetWebShares();
      const existing = (shares || []).find(s => String(s.telegramId) === String(file.id));
      if (existing) {
        const ip = await GetLocalIPAddress();
        const p = await GetWebServerPort();
        const pub = await GetTunnelPublicUrl();
        const running = await IsTunnelRunning();
        
        setShowWebShareExists({
          item: existing,
          localLink: `http://${ip}:${p}/share/${existing.id}`,
          publicLink: running && pub ? `${pub}/share/${existing.id}` : null
        });
      } else {
        setShowWebShareConfig(file);
        setWebSharePassword('');
      }
    } catch (err) {
      addToast(String(err), 'error');
    }
  };

  const handleShareTelegramChannel = async (file: any) => {
    try {
      if (window.go && window.go.main && window.go.main.App.GetFolderInviteLink) {
        addToast(lang === 'id' ? 'Membuat link undangan...' : 'Generating invite link...');
        const link = await window.go.main.App.GetFolderInviteLink(String(file.id));
        if (link) {
          setTelegramShareLink({ folderName: file.name, link });
          setLoadingParticipants(true);
          setChannelParticipants([]);
          try {
            if (window.go.main.App.GetChannelParticipants) {
              const res = await window.go.main.App.GetChannelParticipants(String(file.id));
              setChannelParticipants(res || []);
            }
          } catch (err) {
            console.error("Failed to load channel participants:", err);
          } finally {
            setLoadingParticipants(false);
          }
        } else {
          addToast(lang === 'id' ? 'Gagal mendapatkan link undangan' : 'Failed to get invite link', 'error');
        }
      } else {
        addToast(lang === 'id' ? 'Metode tidak didukung oleh backend' : 'Method not supported by backend', 'error');
      }
    } catch (e) {
      addToast(String(e), 'error');
    }
  };

  const handleSendDirectFile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!shareDirectPhone.trim()) {
      addToast(lang === 'id' ? 'Masukkan nomor telepon terlebih dahulu' : 'Please enter a phone number first', 'error');
      return;
    }
    setSendingDirectFile(true);
    try {
      const folderId = currentFolder ? String(currentFolder.id) : '0';
      const res = await window.go.main.App.SendFileDirectly(folderId, String(shareDirectFile.id), shareDirectPhone);
      if (res && res.success) {
        addToast(lang === 'id' ? 'File berhasil dikirim langsung!' : 'File sent directly successfully!');
        setShareDirectFile(null);
        setShareDirectPhone('');
      } else {
        addToast(res?.error || (lang === 'id' ? 'Gagal mengirim file' : 'Failed to send file'), 'error');
      }
    } catch (err) {
      addToast(String(err), 'error');
    } finally {
      setSendingDirectFile(false);
    }
  };

  const handleStopShareFromContext = (shareId: string) => {
    showConfirm(
      lang === 'id' ? 'Hentikan Berbagi?' : 'Stop Sharing?',
      lang === 'id' ? 'Apakah Anda yakin ingin menghentikan berbagi link ini? Pengunjung tidak akan bisa lagi mengakses berkas ini.' : 'Are you sure you want to stop sharing this link? Visitors will no longer be able to access this file.',
      async () => {
        closeConfirm();
        try {
          await DeleteWebShare(shareId);
          addToast(lang === 'id' ? 'Berbagi tautan berhasil dinonaktifkan' : 'Share link disabled successfully');
          fetchActiveWebShares();
        } catch (e) {
          addToast(String(e), 'error');
        }
      },
      true
    );
  };

  const toggleSelectAll = (itemsList: any[]) => {
    const fileIds = itemsList.map(f => f.id);
    const allSelected = fileIds.length > 0 && fileIds.every(id => selected.includes(id));
    if (allSelected) {
      setSelected(p => p.filter(id => !fileIds.includes(id)));
    } else {
      setSelected(p => [...new Set([...p, ...fileIds])]);
    }
  };

  const navTo = (menu: string, folder = null) => { 
    setActiveMenu(menu); 
    setCurrentFolder(folder); 
    setSelected([]); 
    setSearchQuery(''); 
  };

  /* filter + sort */
  let uniqueFiles = [];
  let seen = new Set();
  for (let f of files) {
    if (!seen.has(String(f.id))) {
      seen.add(String(f.id));
      uniqueFiles.push(f);
    }
  }
  let display = uniqueFiles;
  if (filterType !== 'all') {
    display = display.filter(f => {
      if (f.type === 'folder') return false;
      const e = (f.name || '').split('.').pop()?.toLowerCase() || '';
      if (filterType === 'image')    return ['jpg','jpeg','png','gif','webp','heic','heif'].includes(e);
      if (filterType === 'video')    return ['mp4','webm','ogg','mov','mkv'].includes(e);
      if (filterType === 'audio')    return ['mp3','wav','flac','aac','m4a'].includes(e);
      if (filterType === 'archive')  return ['zip','rar','tar','gz','7z'].includes(e);
      if (filterType === 'document') return !['jpg','jpeg','png','gif','webp','heic','heif','mp4','webm','ogg','mov','mkv','mp3','wav','flac','aac','m4a','zip','rar','tar','gz','7z'].includes(e);
      return true;
    });
  }
  
  if (filterSize !== 'all') {
    display = display.filter(f => {
      if (f.type === 'folder') return false;
      const sz = f.size || 0;
      if (filterSize === 'small')  return sz < 10 * 1024 * 1024;
      if (filterSize === 'medium') return sz >= 10 * 1024 * 1024 && sz < 100 * 1024 * 1024;
      if (filterSize === 'large')  return sz >= 100 * 1024 * 1024 && sz < 1024 * 1024 * 1024;
      if (filterSize === 'huge')   return sz >= 1024 * 1024 * 1024;
      return true;
    });
  }
  
  if (filterDate !== 'all') {
    const now = Math.floor(Date.now() / 1000);
    display = display.filter(f => {
      if (f.type === 'folder') return false;
      const age = now - (f.date || 0);
      if (filterDate === 'today') return age <= 86400;
      if (filterDate === 'week')  return age <= 86400 * 7;
      if (filterDate === 'month') return age <= 86400 * 30;
      return true;
    });
  }

  display.sort((a, b) => {
    const va = sortBy === 'size' ? (a.size || 0) : (a.name || '').toLowerCase();
    const vb = sortBy === 'size' ? (b.size || 0) : (b.name || '').toLowerCase();
    return sortAsc ? (va < vb ? -1 : va > vb ? 1 : 0) : (va > vb ? -1 : va < vb ? 1 : 0);
  });

  const folders = display.filter(f => f.type === 'folder');
  const items = display.filter(f => f.type !== 'folder');

  const FILTERS = [
    { key: 'all',      label: t.all },
    { key: 'document', label: t.documents },
    { key: 'image',    label: t.images },
    { key: 'video',    label: t.videos },
    { key: 'audio',    label: t.audio },
    { key: 'archive',  label: t.archives },
  ];

  /* context menu items for a file or empty space */
  const ctxItems = (file: any) => {
    if (!file) {
      const menuItems = [];
      const isChannelFolder = currentFolder && (currentFolder.type === 'folder' || currentFolder.mimeType === 'folder') && currentFolder.mimeType !== 'virtual_folder' && !String(currentFolder.id || '').startsWith('vf_');
      if (activeMenu === 'drive' && !isChannelFolder) {
        menuItems.push({ icon: <FolderPlus size={16}/>, label: t.newFolder, action: () => { setShowNewFolder(true); setCtxMenu(null); } });
      }
      menuItems.push({ icon: <Upload size={16}/>, label: t.uploadFile, action: () => { doUpload(); setCtxMenu(null); } });
      return menuItems;
    }
    const isStarred = activeMenu === 'starred' || starredIds.has(String(file.id));
    const existingShare = (activeWebShares || []).find(s => String(s.telegramId) === String(file.id));
    return [
      { icon: <Pencil size={16}/>,      label: t.rename,   action: () => { setShowRename(file); setRenameValue(file.name || ''); setCtxMenu(null); } },
      { icon: <Star size={16} fill={isStarred ? 'currentColor' : 'none'}/>, label: isStarred ? t.unstar : t.star, action: () => { doToggleStar(file); setCtxMenu(null); } },
      ...(file.type === 'folder'
        ? [{
            icon: <Share2 size={16}/>,
            label: lang === 'id' ? 'Bagikan' : 'Share',
            hasSubmenu: true,
            submenu: [
              existingShare 
                ? { icon: <Link2Off size={16}/>, label: lang === 'id' ? 'Berhenti Berbagi Web' : 'Stop Web Share', action: () => { handleStopShareFromContext(existingShare.id); setCtxMenu(null); } }
                : { icon: <Share2 size={16}/>, label: lang === 'id' ? 'Bagikan via Web' : 'Share via Web', action: () => { handleOpenWebShare(file); setCtxMenu(null); } },
              { icon: <Link size={16}/>, label: lang === 'id' ? 'Bagikan via Link' : 'Share via Link', action: () => { handleShareTelegramChannel(file); setCtxMenu(null); } }
            ]
          }]
        : [{
            icon: <Share2 size={16}/>,
            label: lang === 'id' ? 'Bagikan' : 'Share',
            hasSubmenu: true,
            submenu: [
              existingShare 
                ? { icon: <Link2Off size={16}/>, label: lang === 'id' ? 'Berhenti Berbagi Web' : 'Stop Web Share', action: () => { handleStopShareFromContext(existingShare.id); setCtxMenu(null); } }
                : { icon: <Share2 size={16}/>, label: lang === 'id' ? 'Bagikan via Web' : 'Share via Web', action: () => { handleOpenWebShare(file); setCtxMenu(null); } },
              { icon: <Send size={16}/>, label: lang === 'id' ? 'Bagikan File Langsung' : 'Share File Directly', action: () => { setShareDirectFile(file); setShareDirectPhone(''); setCtxMenu(null); } }
            ]
          }]
      ),
      { icon: <Info size={16}/>,        label: t.info(file.type === 'folder'),     action: () => { setShowInfo(file); setCtxMenu(null); } },
      { icon: <Download size={16}/>,    label: t.download, action: () => { doDownload(file); setCtxMenu(null); } },
      ...(currentFolder === null && file.type !== 'folder'
        ? [{ icon: <FolderOutput size={16}/>, label: t.move, action: () => { setShowMove(file); setCtxMenu(null); } }]
        : []),
      { icon: <Trash2 size={16}/>,      label: t.delete,   danger: true, action: () => { const f = file; setCtxMenu(null); doDelete(f); } },
    ];
  };

  const renderGridItem = (file: any) => {
    const isSel  = selected.includes(file.id);
    const isHov  = hovered === file.id;
    const ext    = (file.name || '').split('.').pop()?.toLowerCase() || '';
    const hasTh  = ['jpg','jpeg','png','gif','webp','mp4','webm','mov','heic','heif'].includes(ext);
    const isCtx  = ctxMenu?.file?.id === file.id;
    const showCb = isHov || isSel;
    return (
      <div
        key={file.id}
        onClick={() => setPreviewFile(file)}
        onContextMenu={e => { e.preventDefault(); e.stopPropagation(); setCtxMenu({ file, x: e.clientX, y: e.clientY }); }}
        onMouseEnter={() => setHovered(file.id)}
        onMouseLeave={() => setHovered(null)}
        style={{
          background: isSel ? 'var(--md-secondary-container)' : 'var(--md-surface-container-low)',
          border: `1.5px solid ${isSel ? 'var(--md-primary)' : isHov ? 'var(--md-outline)' : 'var(--md-outline-variant)'}`,
          borderRadius: 16, display: 'flex', flexDirection: 'column',
          cursor: 'pointer', height: 250, 
          transition: 'all .25s cubic-bezier(0.2, 0, 0, 1)',
          transform: isHov ? 'translateY(-2px)' : 'none',
          boxShadow: isHov ? '0 8px 24px rgba(0,0,0,.12)' : 'none',
        }}
      >
        <div style={{
          flex: 1, position: 'relative', borderRadius: '16px 16px 0 0',
          background: 'var(--md-surface-container-lowest)', overflow: 'hidden',
          borderBottom: '1px solid var(--md-outline-variant)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          {showCb && (
            <div
              onClick={e => toggleSel(e, file.id)}
              style={{
                position: 'absolute', top: 12, left: 12, zIndex: 3,
                width: 24, height: 24, borderRadius: 12,
                background: isSel ? 'var(--md-primary)' : 'var(--md-surface-container-low)',
                border: isSel ? '2px solid var(--md-primary)' : '1.5px solid var(--md-outline)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                cursor: 'pointer', transition: 'background .12s',
                boxShadow: '0 1px 4px rgba(0,0,0,.20)',
              }}
            >
              {isSel && <Check size={16} color="white" strokeWidth={3}/>}
            </div>
          )}

          {hasTh && file.parentId !== undefined && file.id
            ? <ThumbImg chatId={file.parentId} fileId={String(file.id)} isVideo={['mp4','webm','mov','ogg'].includes(ext)} ext={ext} />
            : <FileTypeIcon file={file} size={64}/>
          }
        </div>

        <div style={{ display: 'flex', alignItems: 'center', padding: '14px 12px 14px 16px', gap: 6 }}>
          <span style={{
            fontSize: 15, fontWeight: 500, flex: 1,
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            color: 'var(--md-on-surface)',
          }}>{file.name}</span>
          {(file.type === 'folder' || file.mimeType === 'virtual_folder') && (
            <span style={{
              fontSize: 10, fontWeight: 700, padding: '2px 6px', borderRadius: 6,
              background: (file.mimeType === 'virtual_folder' || String(file.id).startsWith('vf_')) ? 'rgba(251,188,4,0.15)' : 'rgba(59,130,246,0.15)',
              color: (file.mimeType === 'virtual_folder' || String(file.id).startsWith('vf_')) ? '#d97706' : '#3b82f6',
              border: (file.mimeType === 'virtual_folder' || String(file.id).startsWith('vf_')) ? '1px solid rgba(251,188,4,0.35)' : '1px solid rgba(59,130,246,0.3)',
              textTransform: 'uppercase', letterSpacing: 0.5, flexShrink: 0
            }}>
              {(file.mimeType === 'virtual_folder' || String(file.id).startsWith('vf_')) ? 'Virtual' : 'Channel'}
            </span>
          )}
          <button
            onClick={e => {
              e.stopPropagation();
              const r = e.currentTarget.getBoundingClientRect();
              setCtxMenu(isCtx ? null : { file, x: r.right, y: r.bottom + 6 });
            }}
            style={{
              flexShrink: 0, width: 28, height: 28, borderRadius: '50%',
              border: 'none', background: isCtx ? 'var(--md-surface-container-highest)' : 'transparent',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: 'pointer', color: 'var(--md-on-surface-variant)', transition: 'background .12s',
              opacity: (isHov || isCtx) ? 1 : 0.4,
            }}
            onMouseEnter={e => { e.currentTarget.style.background = 'var(--md-surface-container-highest)'; e.currentTarget.style.opacity = '1'; }}
            onMouseLeave={e => { if (!isCtx) { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.opacity = (isHov || isCtx) ? '1' : '0.4'; } }}
          >
            <MoreVertical size={15}/>
          </button>
        </div>
      </div>
    );
  };

  return (
    <div
      style={{ display: 'flex', height: '100vh', background: 'var(--md-surface)', color: 'var(--md-on-surface)', fontFamily: 'Roboto,sans-serif', overflow: 'hidden' }}
      onClick={() => { setCtxMenu(null); }}
    >
      {/* ── Transfer snackbar ──────────────────────────────────────────────── */}
      {Object.keys(activeTransfers).length > 0 && (
        <div style={{ position: 'fixed', bottom: 20, right: 20, width: 340, zIndex: 9990,
          background: 'var(--md-surface-container-lowest)', borderRadius: 8,
          boxShadow: '0 8px 32px rgba(0,0,0,.18), 0 2px 8px rgba(0,0,0,.08)', border: '1px solid var(--md-outline-variant)', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
          
          <div style={{ padding: '12px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--md-inverse-surface)', color: 'var(--md-inverse-on-surface)', fontSize: 14, fontWeight: 500 }}>
            <span>
              {Object.values(activeTransfers).every(tr => tr.percent >= 100)
                ? t.uploadsComplete(Object.keys(activeTransfers).length)
                : t.uploadingItems(Object.keys(activeTransfers).length)}
            </span>
            <button onClick={() => setActiveTransfers({})} style={{ background: 'transparent', border: 'none', cursor: 'pointer', display: 'flex', color: 'var(--md-inverse-on-surface)' }} title="Tutup">
              <X size={16}/>
            </button>
          </div>
          
          <div style={{ maxHeight: 300, overflowY: 'auto' }}>
            {Object.values(activeTransfers).map(tr => (
              <div key={tr.fileName} style={{ padding: '12px 16px', borderBottom: '1px solid var(--md-outline-variant)', display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ flex: 1, overflow: 'hidden' }}>
                  <div style={{ fontSize: 13, color: 'var(--md-on-surface)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', marginBottom: 4 }}>{tr.fileName}</div>
                  {tr.percent < 100 && (
                    <div style={{ height: 4, background: 'var(--md-surface-variant)', borderRadius: 2 }}>
                      <div style={{ width: `${tr.percent}%`, height: '100%', background: 'var(--md-primary)', borderRadius: 2, transition: 'width .2s' }}/>
                    </div>
                  )}
                </div>
                <div style={{ flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', width: 24, height: 24 }}>
                  {tr.percent >= 100 
                    ? <div style={{ width: 20, height: 20, borderRadius: '50%', background: '#188038', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Check size={14} color="#fff" strokeWidth={3}/></div>
                    : <div style={{ width: 20, height: 20, borderRadius: '50%', border: '2.5px solid var(--md-primary)', borderTopColor: 'transparent', animation: 'spin 1s linear infinite' }}/>}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* SIDEBAR */}
      <FileManagerSidebar
        sidebarCollapsed={sidebarCollapsed}
        setSidebarCollapsed={setSidebarCollapsed}
        activeMenu={activeMenu}
        currentFolder={currentFolder}
        navTo={navTo}
        t={t}
        lang={lang}
        totalSize={storageStats?.total ?? totalSize}
        doUpload={doUpload}
        setShowNewFolder={setShowNewFolder}
        onStorageClick={() => {
          navTo('analytics');
          refreshStorageStats();
        }}
      />

      {/* MAIN PANEL */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {/* Header */}
        <FileManagerHeader
          sidebarCollapsed={sidebarCollapsed}
          setSidebarCollapsed={setSidebarCollapsed}
          searchQuery={searchQuery}
          setSearchQuery={setSearchQuery}
          doSearch={doSearch}
          activeMenu={activeMenu}
          navTo={navTo}
          t={t}
          lang={lang}
          sortBy={sortBy}
          setSortBy={setSortBy}
          sortAsc={sortAsc}
          setSortAsc={setSortAsc}
          selected={selected}
          setSelected={setSelected}
          files={files}
          doDownload={doDownload}
          setShowMove={setShowMove}
          doToggleStarSelected={doToggleStarSelected}
          doDeleteSelected={doDeleteSelected}
          viewMode={viewMode}
          setViewMode={setViewMode}
          dark={dark}
          setDark={setDark}
          setShowSettings={setShowSettings}
          showConfirm={showConfirm}
          closeConfirm={closeConfirm}
          onLogout={onLogout}
          onRefresh={handleRefresh}
          isRefreshing={isRefreshing}
        />

        {/* Content Scroll Area */}
        <main
          style={{ 
            flex: 1, 
            overflowY: 'auto', 
            padding: '20px 24px', 
            position: 'relative',
            '--wails-drop-target': 'drop'
          } as React.CSSProperties}
          onDragOver={e => { e.preventDefault(); setIsDragging(true); }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={() => setIsDragging(false)}
          onContextMenu={e => {
            if (activeMenu !== 'drive') return;
            e.preventDefault();
            setCtxMenu({ file: null, x: e.clientX, y: e.clientY });
          }}
        >
          {/* Breadcrumb / Top Bar */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, fontFamily: 'Google Sans,sans-serif', width: '100%' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              {activeMenu === 'drive' ? (
                <>
                  <button onClick={() => navTo('drive', null)}
                    style={{ background: 'transparent', border: 'none', cursor: 'pointer', padding: '4px 8px', borderRadius: 8,
                      fontFamily: 'Google Sans,sans-serif', fontSize: 20, fontWeight: currentFolder ? 400 : 700,
                      color: currentFolder ? 'var(--md-on-surface-variant)' : 'var(--md-on-surface)',
                      transition: 'background .15s',
                    }}
                    onMouseEnter={e => { if (currentFolder) e.currentTarget.style.background = 'var(--md-surface-container-high)'; }}
                    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                  >{t.myDrive}</button>
                  {currentFolder && (
                    <>
                      <ChevronRight size={18} color="var(--md-on-surface-variant)"/>
                      <span style={{ fontSize: 20, fontWeight: 700, padding: '4px 8px', color: 'var(--md-on-surface)' }}>{currentFolder.name}</span>
                    </>
                  )}
                </>
              ) : (
                <h2 style={{ fontSize: 20, fontWeight: 700, color: 'var(--md-on-surface)', margin: 0 }}>
                  {activeMenu === 'starred' ? t.starred 
                    : activeMenu === 'media' ? t.media 
                    : activeMenu === 'sync' ? t.syncActivity 
                    : activeMenu === 'recent' ? t.recent 
                    : activeMenu === 'analytics' ? t.storageAnalytics 
                    : activeMenu === 'webshare' ? (lang === 'id' ? 'Berbagi Web' : 'Web Sharing') 
                    : activeMenu === 'mountdrive' ? (lang === 'id' ? 'Mount Virtual Drive' : 'Mount Virtual Drive')
                    : activeMenu === 'settings' ? (lang === 'id' ? 'Pengaturan' : 'Settings')
                    : (activeMenu === 'secureFolder' || activeMenu === 'telephoto') ? (lang === 'id' ? 'Folder Aman' : 'Secure Folder')
                    : t.searchResults}
                </h2>
              )}
              <button
                onClick={handleRefresh}
                disabled={isRefreshing}
                title={lang === 'id' ? 'Sinkronkan / Refresh Data' : 'Sync / Refresh Data'}
                style={{
                  background: 'transparent', border: 'none', cursor: isRefreshing ? 'not-allowed' : 'pointer', padding: 6, borderRadius: '50%',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: isRefreshing ? 0.6 : 1,
                  color: 'var(--md-on-surface-variant)', marginLeft: 6, transition: 'background .15s, opacity .15s',
                }}
                onMouseEnter={e => { if (!isRefreshing) e.currentTarget.style.background = 'var(--md-surface-container-high)'; }}
                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
              >
                <RotateCw size={17} style={isRefreshing ? { animation: 'spin 1s linear infinite' } : {}} />
              </button>
            </div>
            {activeMenu === 'recent' && recentFiles.length > 0 && (
              <button
                onClick={() => showConfirm(t.clearHistoryTitle, t.clearHistoryMsg, async () => { closeConfirm(); await ClearRecentFiles(); setRecentFiles([]); addToast(t.recentCleared); }, true)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px', borderRadius: 100,
                  border: '1px solid var(--md-outline-variant)', background: 'transparent',
                  color: 'var(--md-on-surface-variant)', fontSize: 13, fontWeight: 500, cursor: 'pointer',
                  transition: 'background .15s',
                }}
                onMouseEnter={e => e.currentTarget.style.background = 'var(--md-surface-container-high)'}
                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
              >
                <Trash2 size={14}/> {t.clearRecent}
              </button>
            )}
          </div>

          {activeMenu === 'analytics' ? (
            <StorageAnalytics storageStats={storageStats} t={t} lang={lang} />
          ) : (activeMenu === 'secureFolder' || activeMenu === 'telephoto') ? (
            <SecureFolder />
          ) : activeMenu === 'webshare' ? (
            <WebShareManagement lang={lang} addToast={addToast} />
          ) : activeMenu === 'changelog' ? (
            <ChangelogView lang={lang} />
          ) : activeMenu === 'recent' ? (
            <RecentActivity recentFiles={recentFiles} t={t} lang={lang} />
          ) : (activeMenu === 'settings' || activeMenu === 'sync' || activeMenu === 'mountdrive') ? (
            <SettingsManagement
              lang={lang}
              setLang={setLang}
              t={t}
              startupEnabled={startupEnabled}
              setStartupEnabled={setStartupEnabled}
              minimizeToTray={minimizeToTray}
              setMinimizeToTray={setMinimizeToTray}
              addToast={addToast}
              fetchFiles={fetchFiles}
              initialTab={activeMenu === 'sync' ? 'sync' : activeMenu === 'mountdrive' ? 'mountdrive' : 'general'}
              backupActive={backupActive}
              setBackupActive={setBackupActive}
              syncTasks={syncTasks}
              loadSettings={loadSettings}
              syncMode={syncMode}
              setSyncMode={setSyncMode}
              syncIntervalVal={syncIntervalVal}
              setSyncIntervalVal={setSyncIntervalVal}
              newBackupFolder={newBackupFolder}
              setNewBackupFolder={setNewBackupFolder}
              newBackupDest={newBackupDest}
              setNewBackupDest={setNewBackupDest}
              availableFolders={availableFolders}
              currentFolder={currentFolder}
              syncActivities={syncActivities}
              showConfirm={showConfirm}
              closeConfirm={closeConfirm}
            />
          ) : (
            <>
              {/* Filter chips */}
              {activeMenu !== 'media' && (
                <div style={{ display: 'flex', gap: 6, marginBottom: 18, flexWrap: 'wrap' }}>
                  {FILTERS.map(f => {
                    const isOn = filterType === f.key;
                    return (
                      <button key={f.key} onClick={() => setFilterType(f.key)}
                        style={{
                          display: 'flex', alignItems: 'center', gap: 5,
                          padding: isOn ? '5px 12px 5px 8px' : '5px 14px',
                          borderRadius: 100,
                          fontSize: 13, fontWeight: 500, cursor: 'pointer',
                          fontFamily: 'Google Sans,sans-serif', transition: 'all .15s',
                          border: isOn ? '1.5px solid var(--md-primary)' : '1px solid var(--md-outline-variant)',
                          background: isOn ? 'var(--md-secondary-container)' : 'transparent',
                          color: isOn ? 'var(--md-on-secondary-container)' : 'var(--md-on-surface-variant)',
                        }}
                        onMouseEnter={e => { if (!isOn) { e.currentTarget.style.background = 'var(--md-surface-container-high)'; e.currentTarget.style.borderColor = 'var(--md-outline)'; } }}
                        onMouseLeave={e => { if (!isOn) { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.borderColor = 'var(--md-outline-variant)'; } }}
                      >
                        {isOn && <Check size={13} strokeWidth={3}/>}
                        {f.label}
                      </button>
                    );
                  })}
                  {/* Advanced size filter and date filter select dropdowns */}
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                    <select
                      value={filterSize}
                      onChange={e => setFilterSize(e.target.value)}
                      style={{
                        padding: '5px 12px', borderRadius: 100, border: '1px solid var(--md-outline-variant)',
                        background: filterSize !== 'all' ? 'var(--md-secondary-container)' : 'transparent',
                        color: filterSize !== 'all' ? 'var(--md-on-secondary-container)' : 'var(--md-on-surface-variant)',
                        fontSize: 13, fontWeight: 500, outline: 'none', cursor: 'pointer', fontFamily: 'Google Sans,sans-serif'
                      }}
                    >
                      <option value="all">{lang === 'id' ? 'Semua Ukuran' : 'All Sizes'}</option>
                      <option value="small">&lt; 10 MB</option>
                      <option value="medium">10 MB - 100 MB</option>
                      <option value="large">100 MB - 1 GB</option>
                      <option value="huge">&gt; 1 GB</option>
                    </select>

                    <select
                      value={filterDate}
                      onChange={e => setFilterDate(e.target.value)}
                      style={{
                        padding: '5px 12px', borderRadius: 100, border: '1px solid var(--md-outline-variant)',
                        background: filterDate !== 'all' ? 'var(--md-secondary-container)' : 'transparent',
                        color: filterDate !== 'all' ? 'var(--md-on-secondary-container)' : 'var(--md-on-surface-variant)',
                        fontSize: 13, fontWeight: 500, outline: 'none', cursor: 'pointer', fontFamily: 'Google Sans,sans-serif'
                      }}
                    >
                      <option value="all">{lang === 'id' ? 'Kapan Saja' : 'Anytime'}</option>
                      <option value="today">{lang === 'id' ? 'Hari Ini' : 'Today'}</option>
                      <option value="week">{lang === 'id' ? '7 Hari Terakhir' : 'Last 7 Days'}</option>
                      <option value="month">{lang === 'id' ? '30 Hari Terakhir' : 'Last 30 Days'}</option>
                    </select>
                  </div>
                </div>
              )}

              {loading && files.length === 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, marginTop: 80 }}>
                  <div style={{ width: 40, height: 40, borderRadius: '50%', border: '3.5px solid var(--md-primary)', borderTopColor: 'transparent', animation: 'spin 1s linear infinite' }}/>
                  <span style={{ fontSize: 14, color: 'var(--md-on-surface-variant)' }}>Memuat berkas...</span>
                </div>
              ) : display.length === 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', marginTop: 80, gap: 16 }}>
                  <Folder size={80} color="var(--md-primary)" style={{ opacity: 0.4 }} />
                  <div style={{ textAlign: 'center' }}>
                    <h3 style={{ fontSize: 18, fontWeight: 600, color: 'var(--md-on-surface)', marginBottom: 6 }}>{t.empty}</h3>
                    <p style={{ fontSize: 14, color: 'var(--md-on-surface-variant)' }}>{t.emptyHint}</p>
                  </div>
                </div>
              ) : (
                <>
                  {/* FOLDERS */}
                  {folders.length > 0 && activeMenu !== 'media' && (
                    <section style={{ marginBottom: 28 }}>
                      <h3 style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.8px', color: 'var(--md-on-surface-variant)', marginBottom: 12 }}>
                        {t.folders}
                      </h3>
                      {viewMode === 'grid' ? (
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(220px,1fr))', gap: 12 }}>
                          {folders.map(folder => {
                            const isSel = selected.includes(folder.id);
                            const isHov = hovered === folder.id;
                            const showCb = isHov || isSel;
                            return (
                              <div
                                key={folder.id}
                                onClick={() => navTo('drive', folder)}
                                onContextMenu={e => { e.preventDefault(); e.stopPropagation(); setCtxMenu({ file: folder, x: e.clientX, y: e.clientY }); }}
                                onMouseEnter={() => setHovered(folder.id)}
                                onMouseLeave={() => setHovered(null)}
                                style={{
                                  display: 'flex', alignItems: 'center', gap: 14, padding: '12px 18px',
                                  border: `1.5px solid ${isSel ? 'var(--md-primary)' : isHov ? 'var(--md-outline)' : 'var(--md-outline-variant)'}`,
                                  background: isSel ? 'var(--md-secondary-container)' : isHov ? 'var(--md-surface-container-high)' : 'var(--md-surface-container-low)',
                                  borderRadius: 12,
                                  cursor: 'pointer',
                                  transition: 'all 0.25s cubic-bezier(0.2, 0, 0, 1)',
                                  transform: isHov ? 'translateY(-2px)' : 'none',
                                  boxShadow: isHov ? '0 6px 16px rgba(0,0,0,0.08)' : 'none',
                                }}
                              >
                                {showCb ? (
                                  <div onClick={e => toggleSel(e, folder.id)} style={{
                                    width: 24, height: 24, borderRadius: 6, flexShrink: 0,
                                    border: isSel ? '2px solid var(--md-primary)' : '1.5px solid var(--md-outline)',
                                    background: isSel ? 'var(--md-primary)' : 'var(--md-surface-container-low)',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
                                    transition: 'all 0.2s ease',
                                  }}>
                                    {isSel && <Check size={16} color="var(--md-on-primary)" strokeWidth={3}/>}
                                  </div>
                                ) : (
                                  <FileTypeIcon file={folder} size={26}/>
                                )}
                                <span style={{ fontSize: 16, fontWeight: 500, color: 'var(--md-on-surface)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{folder.name}</span>
                              </div>
                            );
                          })}
                        </div>
                      ) : (
                        /* Folder List View */
                        <div style={{ border: '1px solid var(--md-outline-variant)', borderRadius: 16, overflow: 'hidden', background: 'var(--md-surface-container-low)' }}>
                          <div style={{ display: 'grid', gridTemplateColumns: '30px 1fr 80px 36px',
                            alignItems: 'center', gap: 16, padding: '12px 24px',
                            borderBottom: '1px solid var(--md-outline-variant)',
                            background: 'var(--md-surface-container-low)',
                          }}>
                            <div
                              onClick={() => toggleSelectAll(folders)}
                              style={{
                                width: 22, height: 22, borderRadius: 6,
                                border: (folders.length > 0 && folders.every(f => selected.includes(f.id))) ? '2px solid var(--md-primary)' : '1.5px solid var(--md-outline)',
                                background: (folders.length > 0 && folders.every(f => selected.includes(f.id))) ? 'var(--md-primary)' : 'var(--md-surface-container-low)',
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                cursor: 'pointer', flexShrink: 0, transition: 'all 0.15s ease'
                              }}
                            >
                              {(folders.length > 0 && folders.every(f => selected.includes(f.id))) && <Check size={14} color="white" strokeWidth={3} />}
                            </div>
                            {['Name','Size',''].map((h, i) => (
                              <span key={i} style={{ fontSize: 13, fontWeight: 600, color: 'var(--md-on-surface-variant)', textTransform: 'uppercase', letterSpacing: '.5px' }}>
                                {h === 'Name' ? t.name : h === 'Size' ? t.size : h}
                              </span>
                            ))}
                          </div>
                          {folders.map((folder, idx) => {
                            const isSel = selected.includes(folder.id);
                            const isHov = hovered === folder.id;
                            const showCb = isHov || isSel;
                            const isCtx = ctxMenu?.file?.id === folder.id;
                            return (
                              <div
                                key={folder.id}
                                onClick={() => navTo('drive', folder)}
                                onContextMenu={e => { e.preventDefault(); e.stopPropagation(); setCtxMenu({ file: folder, x: e.clientX, y: e.clientY }); }}
                                onMouseEnter={() => setHovered(folder.id)}
                                onMouseLeave={() => setHovered(null)}
                                style={{
                                  display: 'grid', gridTemplateColumns: '30px 1fr 80px 36px',
                                  alignItems: 'center', gap: 16, padding: '14px 24px',
                                  borderBottom: idx < folders.length - 1 ? '1px solid var(--md-outline-variant)' : 'none',
                                  cursor: 'pointer',
                                  background: isSel ? 'var(--md-secondary-container)' : isHov ? 'var(--md-surface-container-high)' : 'transparent',
                                  borderRadius: isHov || isSel ? 12 : 0,
                                  margin: '2px 4px',
                                  transition: 'all .2s cubic-bezier(0.2, 0, 0, 1)',
                                }}
                              >
                                {showCb ? (
                                  <div onClick={e => toggleSel(e, folder.id)} style={{
                                    width: 26, height: 26, borderRadius: 4,
                                    border: isSel ? '2px solid var(--md-primary)' : '1.5px solid var(--md-outline)',
                                    background: isSel ? 'var(--md-primary)' : 'var(--md-surface-container-low)',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    cursor: 'pointer'
                                  }}>
                                    {isSel && <Check size={16} color="var(--md-on-primary)" strokeWidth={3}/>}
                                  </div>
                                ) : (
                                  <FileTypeIcon file={folder} size={26}/>
                                )}
                                <span style={{ fontSize: 16, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: 'var(--md-on-surface)' }}>{folder.name}</span>
                                <span style={{ fontSize: 14, color: 'var(--md-on-surface-variant)' }}>{folder.size > 0 ? fmtBytes(folder.size) : '0 B'}</span>
                                <button onClick={e => { e.stopPropagation(); const r = e.currentTarget.getBoundingClientRect(); setCtxMenu(isCtx ? null : { file: folder, x: r.right, y: r.bottom + 6 }); }}
                                  style={{ width: 26, height: 26, borderRadius: '50%', border: 'none', background: isCtx ? 'var(--md-surface-container-highest)' : 'transparent',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: 'var(--md-on-surface-variant)',
                                    opacity: (isHov || isCtx) ? 1 : 0, transition: 'opacity .15s, background .12s',
                                  }}
                                  onMouseEnter={e => e.currentTarget.style.background = 'var(--md-surface-container-highest)'}
                                  onMouseLeave={e => { if (!isCtx) e.currentTarget.style.background = 'transparent'; }}
                                >
                                  <MoreVertical size={14}/>
                                </button>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </section>
                  )}

                  {/* FILES */}
                  {items.length > 0 && (
                    <section>
                      {activeMenu === 'media' ? (
                        (() => {
                          const formatDateKey = (ts: number) => {
                            if (!ts) return lang === 'id' ? 'Tanggal Tidak Diketahui' : 'Unknown Date';
                            const d = new Date(ts * 1000);
                            return d.toLocaleDateString(lang === 'id' ? 'id-ID' : 'en-US', { day: 'numeric', month: 'long', year: 'numeric' });
                          };
                          const sorted = [...items].sort((a, b) => (b.date || 0) - (a.date || 0));
                          const groups: Record<string, any[]> = {};
                          sorted.forEach(f => {
                            const k = formatDateKey(f.date);
                            if (!groups[k]) groups[k] = [];
                            groups[k].push(f);
                          });
                          return Object.entries(groups).map(([dateLabel, groupItems]) => (
                            <div key={dateLabel} style={{ marginBottom: 32 }}>
                              <h3 style={{ fontSize: 15, fontWeight: 600, color: 'var(--md-on-surface)', marginBottom: 16 }}>
                                {dateLabel}
                              </h3>
                              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(260px,1fr))', gap: 16 }}>
                                {groupItems.map(renderGridItem)}
                              </div>
                            </div>
                          ));
                        })()
                      ) : (
                        <>
                          <h3 style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.8px', color: 'var(--md-on-surface-variant)', marginBottom: 10 }}>
                            {t.files}
                          </h3>
                          {viewMode === 'grid' ? (
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(260px,1fr))', gap: 16 }}>
                              {items.map(renderGridItem)}
                            </div>
                          ) : (
                            /* List view */
                            <div style={{ border: '1px solid var(--md-outline-variant)', borderRadius: 16, overflow: 'hidden', background: 'var(--md-surface-container-low)' }}>
                              <div style={{ display: 'grid', gridTemplateColumns: '30px 1fr 80px 36px',
                                alignItems: 'center', gap: 16, padding: '12px 24px',
                                borderBottom: '1px solid var(--md-outline-variant)',
                                background: 'var(--md-surface-container-low)',
                              }}>
                                <div
                                  onClick={() => toggleSelectAll(items)}
                                  style={{
                                    width: 22, height: 22, borderRadius: 6,
                                    border: (items.length > 0 && items.every(f => selected.includes(f.id))) ? '2px solid var(--md-primary)' : '1.5px solid var(--md-outline)',
                                    background: (items.length > 0 && items.every(f => selected.includes(f.id))) ? 'var(--md-primary)' : 'var(--md-surface-container-low)',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    cursor: 'pointer', flexShrink: 0, transition: 'all 0.15s ease'
                                  }}
                                >
                                  {(items.length > 0 && items.every(f => selected.includes(f.id))) && <Check size={14} color="white" strokeWidth={3} />}
                                </div>
                                {['Name','Size',''].map((h, i) => (
                                  <span key={i} style={{ fontSize: 13, fontWeight: 600, color: 'var(--md-on-surface-variant)', textTransform: 'uppercase', letterSpacing: '.5px' }}>
                                    {h === 'Name' ? t.name : h === 'Size' ? t.size : h}
                                  </span>
                                ))}
                              </div>
                              {items.map((file, idx) => {
                                const isSel = selected.includes(file.id);
                                const isHov = hovered === file.id;
                                const showCb = isHov || isSel;
                                const isCtx = ctxMenu?.file?.id === file.id;
                                return (
                                  <div
                                    key={file.id}
                                    onClick={() => setPreviewFile(file)}
                                    onContextMenu={e => { e.preventDefault(); e.stopPropagation(); setCtxMenu({ file, x: e.clientX, y: e.clientY }); }}
                                    onMouseEnter={() => setHovered(file.id)}
                                    onMouseLeave={() => setHovered(null)}
                                    style={{
                                      display: 'grid', gridTemplateColumns: '30px 1fr 80px 36px',
                                      alignItems: 'center', gap: 16, padding: '14px 24px',
                                      borderBottom: idx < items.length - 1 ? '1px solid var(--md-outline-variant)' : 'none',
                                      cursor: 'pointer',
                                      background: isSel ? 'var(--md-secondary-container)' : isHov ? 'var(--md-surface-container-high)' : 'transparent',
                                      borderRadius: isHov || isSel ? 12 : 0,
                                      margin: '2px 4px',
                                      transition: 'all .2s cubic-bezier(0.2, 0, 0, 1)',
                                    }}
                                  >
                                    {showCb ? (
                                      <div onClick={e => toggleSel(e, file.id)} style={{
                                        width: 26, height: 26, borderRadius: 4,
                                        border: isSel ? '2px solid var(--md-primary)' : '1.5px solid var(--md-outline)',
                                        background: isSel ? 'var(--md-primary)' : 'var(--md-surface-container-low)',
                                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                                        cursor: 'pointer'
                                      }}>
                                        {isSel && <Check size={16} color="var(--md-on-primary)" strokeWidth={3}/>}
                                      </div>
                                    ) : (
                                      <FileTypeIcon file={file} size={26}/>
                                    )}
                                    <span style={{ fontSize: 16, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: 'var(--md-on-surface)' }}>{file.name}</span>
                                    {(file.type === 'folder' || file.mimeType === 'virtual_folder') && (
                                      <span style={{
                                        fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 6,
                                        background: (file.mimeType === 'virtual_folder' || String(file.id).startsWith('vf_')) ? 'rgba(251,188,4,0.15)' : 'rgba(59,130,246,0.15)',
                                        color: (file.mimeType === 'virtual_folder' || String(file.id).startsWith('vf_')) ? '#d97706' : '#3b82f6',
                                        border: (file.mimeType === 'virtual_folder' || String(file.id).startsWith('vf_')) ? '1px solid rgba(251,188,4,0.35)' : '1px solid rgba(59,130,246,0.3)',
                                        textTransform: 'uppercase', letterSpacing: 0.5, marginRight: 8, flexShrink: 0
                                      }}>
                                        {(file.mimeType === 'virtual_folder' || String(file.id).startsWith('vf_')) ? 'Virtual' : 'Channel'}
                                      </span>
                                    )}
                                    <span style={{ fontSize: 14, color: 'var(--md-on-surface-variant)' }}>{fmtBytes(file.size)}</span>
                                    <button onClick={e => { e.stopPropagation(); const r = e.currentTarget.getBoundingClientRect(); setCtxMenu(isCtx ? null : { file, x: r.right, y: r.bottom + 6 }); }}
                                      style={{ width: 26, height: 26, borderRadius: '50%', border: 'none', background: isCtx ? 'var(--md-surface-container-highest)' : 'transparent',
                                        display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: 'var(--md-on-surface-variant)',
                                        opacity: (isHov || isCtx) ? 1 : 0, transition: 'opacity .15s, background .12s',
                                      }}
                                      onMouseEnter={e => e.currentTarget.style.background = 'var(--md-surface-container-highest)'}
                                      onMouseLeave={e => { if (!isCtx) e.currentTarget.style.background = 'transparent'; }}
                                    >
                                      <MoreVertical size={14}/>
                                    </button>
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </>
                      )}
                    </section>
                  )}
                </>
              )}
            </>
          )}

          {/* Load More button */}
          {hasMore && activeMenu === 'drive' && !loading && (
            <div style={{ display: 'flex', justifyContent: 'center', padding: '20px 0 8px' }}>
              <button
                onClick={loadMore}
                disabled={loadingMore}
                style={{
                  display: 'flex', alignItems: 'center', gap: 8,
                  padding: '10px 28px', borderRadius: 100,
                  border: '1.5px solid var(--md-outline-variant)',
                  background: 'transparent', color: 'var(--md-primary)',
                  fontFamily: 'Google Sans,sans-serif', fontSize: 14, fontWeight: 500,
                  cursor: loadingMore ? 'default' : 'pointer',
                  opacity: loadingMore ? 0.7 : 1,
                  transition: 'background .15s, border-color .15s',
                }}
                onMouseEnter={e => { if (!loadingMore) { e.currentTarget.style.background = 'rgba(11,87,208,.06)'; e.currentTarget.style.borderColor = 'var(--md-primary)'; } }}
                onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.borderColor = 'var(--md-outline-variant)'; }}
              >
                {loadingMore && <div style={{ width: 16, height: 16, borderRadius: '50%', border: '2px solid var(--md-primary)', borderTopColor: 'transparent', animation: 'spin .8s linear infinite' }}/>}
                {loadingMore ? t.loadingMore : t.loadMore}
              </button>
            </div>
          )}

          {/* Drag Overlay */}
          {isDragging && (
            <div style={{
              position: 'absolute', inset: 0, background: 'rgba(11,87,208,.07)', borderRadius: 0,
              display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
              gap: 16, color: 'var(--md-primary)', fontSize: 18, fontWeight: 500, pointerEvents: 'none',
              border: '3px dashed var(--md-primary)',
            }}>
              <Upload size={56}/><span>{t.dropToUpload}</span>
            </div>
          )}
        </main>
      </div>

      {/* Global Context Menu */}
      {ctxMenu && (
        <div
          onClick={e => e.stopPropagation()}
          onMouseLeave={() => setActiveSubmenuIndex(null)}
          style={{
            position: 'fixed',
            top: Math.min(ctxMenu.y, window.innerHeight - 340),
            left: Math.max(4, Math.min(ctxMenu.x - 192, window.innerWidth - 200)),
            zIndex: 4000,
            background: 'var(--md-surface-container-lowest)',
            borderRadius: 8, minWidth: 192,
            boxShadow: '0 2px 6px 2px rgba(0,0,0,.15), 0 1px 2px rgba(0,0,0,.3)',
            border: '1px solid var(--md-outline-variant)',
            animation: 'gdAnim .12s ease',
          }}
        >
          {ctxItems(ctxMenu.file).map((item: any, i: number) => (
            <div
              key={i} 
              onClick={(e) => {
                if (item.hasSubmenu) {
                  e.stopPropagation();
                } else if (item.action) {
                  item.action();
                }
              }}
              style={{
                display: 'flex', alignItems: 'center', gap: 14, padding: '12px 18px',
                cursor: 'pointer', fontSize: 14, fontFamily: 'Google Sans,sans-serif',
                color: item.danger ? 'var(--md-error)' : 'var(--md-on-surface)',
                borderTop: item.danger && i > 0 ? '1px solid var(--md-outline-variant)' : 'none',
                position: 'relative',
              }}
              onMouseEnter={e => {
                e.currentTarget.style.background = 'var(--md-surface-container-high)';
                if (item.hasSubmenu) {
                  setActiveSubmenuIndex(i);
                } else {
                  setActiveSubmenuIndex(null);
                }
              }}
              onMouseLeave={e => {
                e.currentTarget.style.background = 'transparent';
              }}
            >
              <span style={{ color: item.danger ? 'var(--md-error)' : 'var(--md-on-surface-variant)', display: 'flex' }}>{item.icon}</span>
              <span style={{ flex: 1 }}>{item.label}</span>
              {item.hasSubmenu && (
                <ChevronRight size={14} color="var(--md-on-surface-variant)" />
              )}

              {/* Submenu */}
              {item.hasSubmenu && activeSubmenuIndex === i && (
                <div
                  style={{
                    position: 'absolute',
                    top: 0,
                    ...(ctxMenu.x > window.innerWidth - 400 ? { right: '100%', marginRight: 4 } : { left: '100%', marginLeft: 4 }),
                    background: 'var(--md-surface-container-lowest)',
                    borderRadius: 8, minWidth: 192, overflow: 'hidden',
                    boxShadow: '0 2px 6px 2px rgba(0,0,0,.15), 0 1px 2px rgba(0,0,0,.3)',
                    border: '1px solid var(--md-outline-variant)',
                  }}
                  onClick={e => e.stopPropagation()}
                >
                  {item.submenu.map((sub: any, si: number) => (
                    <div
                      key={si}
                      onClick={() => {
                        sub.action();
                        setActiveSubmenuIndex(null);
                      }}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 14, padding: '12px 18px',
                        cursor: 'pointer', fontSize: 14, fontFamily: 'Google Sans,sans-serif',
                        color: 'var(--md-on-surface)',
                      }}
                      onMouseEnter={e => e.currentTarget.style.background = 'var(--md-surface-container-high)'}
                      onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                    >
                      <span style={{ color: 'var(--md-on-surface-variant)', display: 'flex' }}>{sub.icon}</span>
                      {sub.label}
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Modals */}
      <Modal open={showNewFolder} onClose={() => setShowNewFolder(false)} title={t.newFolder}
        actions={<><BtnTonal onClick={() => setShowNewFolder(false)}>{t.cancel}</BtnTonal><BtnFill onClick={doCreateFolder}>{t.create}</BtnFill></>}
      >
        <form onSubmit={doCreateFolder} style={{ paddingBottom: 8, display: 'flex', flexDirection: 'column', gap: 16 }}>
          <FieldInput label={t.folderName} value={newFolderName} onChange={e => setNewFolderName(e.target.value)} autofocus/>
          <div>
            <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--md-on-surface-variant)', display: 'block', marginBottom: 8 }}>
              {lang === 'id' ? 'Tipe Folder' : 'Folder Type'}
            </label>
            <div style={{ display: 'flex', gap: 8 }}>
              <div 
                onClick={() => setNewFolderType('virtual')}
                style={{
                  flex: 1,
                  padding: '10px 12px',
                  borderRadius: 8,
                  border: newFolderType === 'virtual' || currentFolder !== null ? '2px solid var(--md-primary, #00639b)' : '1px solid var(--md-outline-variant, #ccc)',
                  background: newFolderType === 'virtual' || currentFolder !== null ? 'var(--md-primary-container, #e0f2fe)' : 'transparent',
                  cursor: 'pointer',
                  fontSize: 13
                }}
              >
                <div style={{ fontWeight: 600, color: 'var(--md-on-surface, #1f2937)', display: 'flex', alignItems: 'center', gap: 4 }}>
                  📁 {lang === 'id' ? 'Folder Cloud' : 'Cloud Folder'}
                </div>
                <div style={{ fontSize: 11, opacity: 0.8, marginTop: 2, lineHeight: 1.3 }}>
                  {lang === 'id' ? 'Tersimpan di Pesan Tersimpan & mendukung sub-folder' : 'Stored in Saved Messages & supports sub-folders'}
                </div>
              </div>
              <div 
                onClick={() => {
                  if (currentFolder === null) setNewFolderType('channel');
                }}
                style={{
                  flex: 1,
                  padding: '10px 12px',
                  borderRadius: 8,
                  border: newFolderType === 'channel' && currentFolder === null ? '2px solid var(--md-primary, #00639b)' : '1px solid var(--md-outline-variant, #ccc)',
                  background: newFolderType === 'channel' && currentFolder === null ? 'var(--md-primary-container, #e0f2fe)' : 'transparent',
                  opacity: currentFolder !== null ? 0.4 : 1,
                  cursor: currentFolder !== null ? 'not-allowed' : 'pointer',
                  fontSize: 13
                }}
                title={currentFolder !== null ? (lang === 'id' ? 'Channel Terpisah hanya dapat dibuat di Root' : 'Dedicated Channel can only be created at Root') : ''}
              >
                <div style={{ fontWeight: 600, color: 'var(--md-on-surface, #1f2937)', display: 'flex', alignItems: 'center', gap: 4 }}>
                  📢 {lang === 'id' ? 'Channel Terpisah' : 'Dedicated Channel'}
                </div>
                <div style={{ fontSize: 11, opacity: 0.8, marginTop: 2, lineHeight: 1.3 }}>
                  {currentFolder !== null 
                    ? (lang === 'id' ? 'Hanya dapat dibuat di Root' : 'Only available at Root')
                    : (lang === 'id' ? 'Membuat Channel Telegram baru khusus' : 'Create a new separate Telegram Channel')}
                </div>
              </div>
            </div>
          </div>
        </form>
      </Modal>

      <Modal open={!!showRename} onClose={() => {}} title={showRename?.type === 'folder' ? t.renameFolder : t.renameFile}
        actions={<><BtnTonal onClick={() => { if (!renaming) { setShowRename(null); setRenameValue(''); } }}>{t.cancel}</BtnTonal><BtnFill onClick={doRename} style={{ opacity: renaming ? 0.6 : 1, pointerEvents: renaming ? 'none' : 'auto' }}>{renaming ? t.renaming : t.rename}</BtnFill></>}
      >
        <form onSubmit={doRename} style={{ paddingBottom: 8 }}>
          <FieldInput label={t.newNameLabel} value={renameValue} onChange={e => setRenameValue(e.target.value)} autofocus readOnly={renaming}/>
          {showRename?.type !== 'folder' && (
            <p style={{ fontSize: 12, color: 'var(--md-on-surface-variant)', marginTop: 8, lineHeight: 1.5 }}>
              {lang === 'id' ? 'File akan diunduh dan diunggah ulang dengan nama baru. Proses ini memerlukan waktu untuk file berukuran besar.' : 'The file will be downloaded and re-uploaded with the new name. This may take time for large files.'}
            </p>
          )}
        </form>
      </Modal>

      <Modal open={!!showMove} onClose={() => setShowMove(null)} title={showMove === 'bulk' ? (lang === 'id' ? 'Pindahkan Item Terpilih' : 'Move Selected Items') : t.move} width={400}
        actions={<><BtnTonal onClick={() => setShowMove(null)}>{t.cancel}</BtnTonal><BtnFill onClick={doMoveFile}>{t.move}</BtnFill></>}
      >
        <div style={{ paddingBottom: 8, display: 'flex', flexDirection: 'column', gap: 4 }}>
          <label style={{ fontSize: 12, fontWeight: 500, color: 'var(--md-on-surface-variant)' }}>
            {lang === 'id' ? 'Folder Tujuan' : 'Destination Folder'}
          </label>
          <select 
            value={moveDest} 
            onChange={e => setMoveDest(e.target.value)}
            style={{ width: '100%', padding: '13px 16px', borderRadius: 8,
              border: '1.5px solid var(--md-outline)', background: 'var(--md-surface)',
              color: 'var(--md-on-surface)', fontSize: 15, fontFamily: 'Roboto,sans-serif', outline: 'none', cursor: 'pointer' }}
          >
            <option value="" disabled>{lang === 'id' ? '-- Pilih Folder Tujuan --' : '-- Select Destination Folder --'}</option>
            {availableFolders.filter(f => showMove === 'bulk' || !showMove || String(f.id) !== String(showMove.id)).map(f => (
              <option key={f.id} value={f.id}>{f.name}</option>
            ))}
          </select>
        </div>
      </Modal>

      {/* Web Share Config Modal */}
      <Modal open={!!showWebShareConfig} onClose={() => setShowWebShareConfig(null)} title={t.shareToWeb}
        actions={<><BtnTonal onClick={() => setShowWebShareConfig(null)}>{t.cancel}</BtnTonal><BtnFill onClick={doCreateWebShare}>{t.generateLink}</BtnFill></>}
      >
        <form onSubmit={doCreateWebShare} style={{ paddingBottom: 8 }}>
          <p style={{ fontSize: 13, color: 'var(--md-on-surface-variant)', marginBottom: 16, lineHeight: 1.5 }}>
            {lang === 'id' ? 'Buat link unduhan web untuk file/folder ini agar dapat diunduh langsung dari browser.' : 'Create a web download link for this file/folder so it can be downloaded directly from any browser.'}
          </p>
          <FieldInput
            label={t.setPassword}
            type="password"
            value={webSharePassword}
            onChange={e => setWebSharePassword(e.target.value)}
            autofocus
            placeholder={lang === 'id' ? 'Biarkan kosong untuk tanpa sandi' : 'Leave empty for no password'}
          />
        </form>
      </Modal>

      {/* Web Share Exists Modal */}
      <Modal open={!!showWebShareExists} onClose={() => setShowWebShareExists(null)} title={lang === 'id' ? 'Kelola Tautan Berbagi Web' : 'Manage Web Share Link'} width={450}
        actions={
          <>
            <BtnTonal onClick={() => setShowWebShareExists(null)}>{lang === 'id' ? 'Tutup' : 'Close'}</BtnTonal>
            <button
              onClick={() => {
                if (!showWebShareExists) return;
                showConfirm(
                  lang === 'id' ? 'Hentikan Berbagi?' : 'Stop Sharing?',
                  lang === 'id' ? 'Apakah Anda yakin ingin menghentikan berbagi link ini? Pengunjung tidak akan bisa lagi mengakses berkas ini.' : 'Are you sure you want to stop sharing this link? Visitors will no longer be able to access this file.',
                  async () => {
                    closeConfirm();
                    try {
                      await DeleteWebShare(showWebShareExists.item.id);
                      addToast(lang === 'id' ? 'Berbagi tautan berhasil dinonaktifkan' : 'Share link disabled successfully');
                      setShowWebShareExists(null);
                    } catch (e) {
                      addToast(String(e), 'error');
                    }
                  },
                  true
                );
              }}
              style={{
                background: 'var(--md-error)', color: 'var(--md-on-error)',
                border: 'none', borderRadius: 100, padding: '10px 20px',
                fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'Google Sans,sans-serif'
              }}
            >
              {lang === 'id' ? 'Hentikan Berbagi' : 'Stop Sharing'}
            </button>
          </>
        }
      >
        {showWebShareExists && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 18, paddingBottom: 8 }}>
            <div>
              <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--md-on-surface-variant)' }}>
                {lang === 'id' ? 'Nama Berkas/Folder' : 'File/Folder Name'}
              </span>
              <p style={{ fontSize: 15, fontWeight: 700, color: 'var(--md-on-surface)', margin: '4px 0 0 0', wordBreak: 'break-all' }}>
                {showWebShareExists.item.name}
              </p>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--md-on-surface-variant)' }}>
                {lang === 'id' ? 'Tautan Jaringan Lokal' : 'Local Network Link'}
              </span>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'var(--md-surface-container)', padding: '10px 14px', borderRadius: 8, border: '1px solid var(--md-outline-variant)' }}>
                <span style={{ flex: 1, fontSize: 13, fontFamily: 'monospace', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {showWebShareExists.localLink}
                </span>
                <button
                  onClick={() => { navigator.clipboard.writeText(showWebShareExists.localLink); addToast(lang === 'id' ? 'Link disalin ✓' : 'Link copied ✓'); }}
                  style={{ background: 'transparent', border: 'none', cursor: 'pointer', display: 'flex', color: 'var(--md-primary)', padding: 2 }}
                >
                  <Copy size={16}/>
                </button>
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--md-on-surface-variant)' }}>
                {lang === 'id' ? 'Tautan Internet Publik (Cloudflare)' : 'Public Internet Link (Cloudflare)'}
              </span>
              {showWebShareExists.publicLink ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'var(--md-surface-container)', padding: '10px 14px', borderRadius: 8, border: '1px solid var(--md-outline-variant)' }}>
                  <span style={{ flex: 1, fontSize: 13, fontFamily: 'monospace', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {showWebShareExists.publicLink}
                  </span>
                  <button
                    onClick={() => { navigator.clipboard.writeText(showWebShareExists.publicLink); addToast(lang === 'id' ? 'Link disalin ✓' : 'Link copied ✓'); }}
                    style={{ background: 'transparent', border: 'none', cursor: 'pointer', display: 'flex', color: 'var(--md-primary)', padding: 2 }}
                  >
                    <Copy size={16}/>
                  </button>
                </div>
              ) : (
                <p style={{ fontSize: 13, color: 'var(--md-on-surface-variant)', margin: 0, fontStyle: 'italic' }}>
                  {lang === 'id' ? 'Akses publik belum diaktifkan. Aktifkan di menu Berbagi Web.' : 'Public access is disabled. Enable it in the Web Sharing menu.'}
                </p>
              )}
            </div>

            {showWebShareExists.item.password && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--md-on-surface-variant)' }}>
                  {lang === 'id' ? 'Sandi Proteksi Tautan' : 'Link Protection Password'}
                </span>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'var(--md-surface-container)', padding: '10px 14px', borderRadius: 8, border: '1px solid var(--md-outline-variant)' }}>
                  <span style={{ flex: 1, fontSize: 13, fontFamily: 'monospace', color: 'var(--md-on-surface)' }}>
                    {revealExistPassword ? showWebShareExists.item.password : '••••••••'}
                  </span>
                  <button
                    onClick={() => setRevealExistPassword(!revealExistPassword)}
                    style={{ background: 'transparent', border: 'none', cursor: 'pointer', display: 'flex', color: 'var(--md-on-surface-variant)', padding: 2 }}
                    title={revealExistPassword ? (lang === 'id' ? 'Sembunyikan Sandi' : 'Hide Password') : (lang === 'id' ? 'Tampilkan Sandi' : 'Show Password')}
                  >
                    {revealExistPassword ? <EyeOff size={16}/> : <Eye size={16}/>}
                  </button>
                  <button
                    onClick={() => { navigator.clipboard.writeText(showWebShareExists.item.password); addToast(lang === 'id' ? 'Sandi disalin ✓' : 'Password copied ✓'); }}
                    style={{ background: 'transparent', border: 'none', cursor: 'pointer', display: 'flex', color: 'var(--md-primary)', padding: 2 }}
                    title={lang === 'id' ? 'Salin Sandi' : 'Copy Password'}
                  >
                    <Copy size={16}/>
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </Modal>

      {/* Folder Share Invite Link Modal */}
      <Modal 
        open={!!telegramShareLink} 
        onClose={() => setTelegramShareLink(null)} 
        title={lang === 'id' ? 'Bagikan Folder' : 'Share Folder'} 
        width={450}
        actions={<BtnTonal onClick={() => setTelegramShareLink(null)}>{lang === 'id' ? 'Tutup' : 'Close'}</BtnTonal>}
      >
        {telegramShareLink && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16, paddingBottom: 8 }}>
            <p style={{ fontSize: 13, color: 'var(--md-on-surface-variant)', margin: 0, lineHeight: 1.5 }}>
              {lang === 'id' 
                ? `Berikut adalah link undangan private untuk folder "${telegramShareLink.folderName}":`
                : `Here is the private invite link for the folder "${telegramShareLink.folderName}":`}
            </p>
            <div style={{ 
              display: 'flex', 
              alignItems: 'center', 
              gap: 8, 
              background: 'var(--md-surface-container)', 
              padding: '10px 14px', 
              borderRadius: 8, 
              border: '1px solid var(--md-outline-variant)' 
            }}>
              <span style={{ 
                flex: 1, 
                fontSize: 13, 
                fontFamily: 'monospace', 
                overflow: 'hidden', 
                textOverflow: 'ellipsis', 
                whiteSpace: 'nowrap',
                color: 'var(--md-primary)'
              }}>
                {telegramShareLink.link}
              </span>
              <button
                onClick={() => { 
                  navigator.clipboard.writeText(telegramShareLink.link); 
                  addToast(lang === 'id' ? 'Link disalin ✓' : 'Link copied ✓'); 
                }}
                style={{ background: 'transparent', border: 'none', cursor: 'pointer', display: 'flex', color: 'var(--md-primary)', padding: 2 }}
                title={lang === 'id' ? 'Salin Link' : 'Copy Link'}
              >
                <Copy size={16}/>
              </button>
            </div>

            {/* Participants list */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 4 }}>
              <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--md-on-surface)' }}>
                {lang === 'id' ? 'Anggota yang Tergabung:' : 'Joined Members:'}
              </span>
              {loadingParticipants ? (
                <span style={{ fontSize: 12, color: 'var(--md-on-surface-variant)' }}>
                  {lang === 'id' ? 'Memuat anggota...' : 'Loading members...'}
                </span>
              ) : channelParticipants.length === 0 ? (
                <span style={{ fontSize: 12, color: 'var(--md-on-surface-variant)' }}>
                  {lang === 'id' ? 'Tidak ada anggota ditemukan.' : 'No members found.'}
                </span>
              ) : (
                <div style={{ 
                  display: 'flex', 
                  flexDirection: 'column', 
                  gap: 8, 
                  maxHeight: 180, 
                  overflowY: 'auto',
                  background: 'var(--md-surface-container-low)',
                  borderRadius: 8,
                  padding: '8px 12px',
                  border: '1px solid var(--md-outline-variant)'
                }}>
                  {channelParticipants.map((member: any) => (
                    <div 
                      key={member.id} 
                      style={{ 
                        display: 'flex', 
                        alignItems: 'center', 
                        justifyContent: 'space-between', 
                        padding: '6px 0',
                        borderBottom: '1px solid var(--md-outline-variant)'
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <div style={{ 
                          width: 28, 
                          height: 28, 
                          borderRadius: '50%', 
                          background: member.isSelf ? 'var(--md-primary-container)' : 'var(--md-surface-container-highest)', 
                          display: 'flex', 
                          alignItems: 'center', 
                          justifyContent: 'center',
                          fontSize: 12,
                          fontWeight: 'bold',
                          color: member.isSelf ? 'var(--md-on-primary-container)' : 'var(--md-on-surface)'
                        }}>
                          {member.name ? member.name.charAt(0).toUpperCase() : '?'}
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column' }}>
                          <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--md-on-surface)' }}>
                            {member.name} {member.isSelf && (
                              <span style={{ 
                                fontSize: 11, 
                                fontStyle: 'italic', 
                                color: 'var(--md-primary)',
                                marginLeft: 4
                              }}>
                                ({lang === 'id' ? 'Anda' : 'You'})
                              </span>
                            )}
                          </span>
                          {member.username && (
                            <span style={{ fontSize: 11, color: 'var(--md-on-surface-variant)' }}>
                              @{member.username}
                            </span>
                          )}
                        </div>
                      </div>
                      <span style={{ 
                        fontSize: 11, 
                        color: member.isSelf ? 'var(--md-primary)' : 'var(--md-on-surface-variant)',
                        fontWeight: member.isSelf ? 600 : 400
                      }}>
                        {member.isSelf ? (lang === 'id' ? 'Pemilik' : 'Owner') : (lang === 'id' ? 'Anggota' : 'Member')}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </Modal>

      {/* Bagikan File Langsung Modal */}
      <Modal
        open={!!shareDirectFile}
        onClose={() => setShareDirectFile(null)}
        title={lang === 'id' ? 'Bagikan File Langsung' : 'Share File Directly'}
        width={400}
        actions={
          <>
            <BtnTonal onClick={() => setShareDirectFile(null)} disabled={sendingDirectFile}>
              {lang === 'id' ? 'Batal' : 'Cancel'}
            </BtnTonal>
            <BtnFill onClick={handleSendDirectFile} disabled={sendingDirectFile}>
              {sendingDirectFile ? (lang === 'id' ? 'Mengirim...' : 'Sending...') : (lang === 'id' ? 'Kirim' : 'Send')}
            </BtnFill>
          </>
        }
      >
        {shareDirectFile && (
          <form onSubmit={handleSendDirectFile} style={{ display: 'flex', flexDirection: 'column', gap: 16, paddingBottom: 8 }}>
            <p style={{ fontSize: 13, color: 'var(--md-on-surface-variant)', margin: 0, lineHeight: 1.5 }}>
              {lang === 'id' 
                ? `Masukkan nomor telepon tujuan untuk mengirim berkas "${shareDirectFile.name}" secara langsung:`
                : `Enter the recipient's phone number to send the file "${shareDirectFile.name}" directly:`}
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--md-on-surface-variant)' }}>
                {lang === 'id' ? 'Nomor Telepon (Format Internasional)' : 'Phone Number (International Format)'}
              </span>
              <input
                type="tel"
                placeholder={lang === 'id' ? 'Contoh: +628123456789' : 'Example: +1234567890'}
                value={shareDirectPhone}
                onChange={e => setShareDirectPhone(e.target.value)}
                style={{
                  width: '100%',
                  padding: '10px 14px',
                  borderRadius: 8,
                  border: '1.5px solid var(--md-outline)',
                  background: 'transparent',
                  color: 'var(--md-on-surface)',
                  fontSize: '14px',
                  outline: 'none',
                }}
                disabled={sendingDirectFile}
                required
                autoFocus
              />
            </div>
          </form>
        )}
      </Modal>

      <Modal open={!!showInfo} onClose={() => setShowInfo(null)} title={t.info(showInfo?.type === 'folder')}
        actions={<BtnFill onClick={() => setShowInfo(null)}>OK</BtnFill>}
      >
        {showInfo && (
          <div style={{ paddingBottom: 8 }}>
            {[['Name',showInfo.name],['Size',fmtBytes(showInfo.size)],['Type',showInfo.type],['MIME',showInfo.mimeType]].map(([k,v]) => (
              <div key={k} style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0', borderBottom: '1px solid var(--md-surface-container-highest)', fontSize: 14 }}>
                <span style={{ color: 'var(--md-on-surface-variant)' }}>{k}</span>
                <strong style={{ textAlign: 'right', wordBreak: 'break-all', maxWidth: '60%', color: 'var(--md-on-surface)' }}>{String(v)}</strong>
              </div>
            ))}
          </div>
        )}
      </Modal>



      {previewFile && (() => {
        const previewableFiles = files.filter(f => f.type !== 'folder');
        const currentIndex = previewableFiles.findIndex(f => f.id === previewFile.id);
        const hasMultiple = previewableFiles.length > 1 && currentIndex !== -1;
        const handlePrev = hasMultiple ? () => setPreviewFile(previewableFiles[currentIndex > 0 ? currentIndex - 1 : previewableFiles.length - 1]) : null;
        const handleNext = hasMultiple ? () => setPreviewFile(previewableFiles[currentIndex < previewableFiles.length - 1 ? currentIndex + 1 : 0]) : null;
        return (
          <PreviewModal
            file={previewFile}
            onClose={() => setPreviewFile(null)}
            currentPath={currentFolder ? String(currentFolder.id) : (previewFile.parentId ? String(previewFile.parentId) : '')}
            onPrev={handlePrev}
            onNext={handleNext}
            playlist={previewableFiles}
            onSelectFile={(f) => setPreviewFile(f)}
          />
        );
      })()}

      {/* Confirm Dialog */}
      <ConfirmDialog
        open={!!confirmDlg}
        title={confirmDlg?.title || ''}
        message={confirmDlg?.message || ''}
        danger={confirmDlg?.danger}
        onConfirm={confirmDlg?.onConfirm || (() => {})}
        onCancel={closeConfirm}
      />

      {/* Toasts */}
      <div style={{ position: 'fixed', bottom: 20, left: '50%', transform: 'translateX(-50%)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, zIndex: 9000 }}>
        {toasts.map(toast => (
          <div key={toast.id} style={{
            display: 'flex', alignItems: 'center', gap: 10, padding: '12px 22px',
            background: toast.type === 'error' ? 'var(--md-error-container)' : 'var(--md-inverse-surface)',
            color: toast.type === 'error' ? 'var(--md-on-error-container)' : 'var(--md-inverse-on-surface)',
            borderRadius: 100, boxShadow: '0 4px 16px rgba(0,0,0,.2)',
            fontSize: 14, fontWeight: 500, fontFamily: 'Google Sans,sans-serif',
            whiteSpace: 'nowrap', animation: 'gdAnim .2s ease',
          }}>
            {toast.type === 'error' ? <AlertCircle size={16}/> : <Check size={16}/>}
            {toast.msg}
          </div>
        ))}
      </div>

      <style>{`
        @keyframes gdAnim { from{opacity:0;transform:translateY(8px)} to{opacity:1;transform:none} }
        @keyframes spin    { to{transform:rotate(360deg)} }
        *, *::before, *::after { box-sizing:border-box; margin:0; padding:0; }
        body { overflow:hidden; }
        ::-webkit-scrollbar       { width:8px; }
        ::-webkit-scrollbar-track { background:transparent; }
        ::-webkit-scrollbar-thumb { background:var(--md-outline-variant); border-radius:4px; }
        ::-webkit-scrollbar-thumb:hover { background:var(--md-outline); }
        select option { background:var(--md-surface-container); color:var(--md-on-surface); }
        input:focus, select:focus { border-color:var(--md-primary) !important; outline:none; }
        input[type=number]::-webkit-inner-spin-button,
        input[type=number]::-webkit-outer-spin-button { -webkit-appearance:none; margin:0; }
        input[type=number] { -moz-appearance:textfield; }
      `}</style>
    </div>
  );
}
