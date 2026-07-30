import React, { useState, useEffect, useMemo } from 'react';
import {
  Folder, Lock, Key, Image as ImageIcon, Video, Music, Archive, FileText,
  Search, Download, Info, Play, X, ChevronLeft, ChevronRight, RefreshCw, AlertCircle, Grid, List,
  ShieldCheck, Eye, FileCode, Check, Copy, File, Unlock, ArrowLeft, Plus, Upload, FolderPlus, Edit3, Trash2
} from 'lucide-react';
import {
  ScanSecureFolderGroups, ImportSecureFolderBackup, PreviewSecureFolderFile, DownloadSecureFolderFile, GetSecureFolderThumbnail, ReadCachedImageBase64, ClearSecureFolderCache, UploadSecureFolderFile, OpenMultiFileDialog, CreateSecureFolderGroup, RenameSecureFolderGroup, DeleteSecureFolderGroup,
  ScanTelephotoGroups, ImportTelephotoBackup, PreviewTelephotoFile, DownloadTelephotoFile, GetTelephotoThumbnail, ClearTelephotoCache
} from '../../wailsjs/go/main/App';
import { fileColor } from '../utils/fileHelpers';

interface SecureFolderItem {
  localId: number;
  localUri: string;
  telegramFileId: string;
  telegramMessageId: number;
  syncStatus: string;
  timestamp: number;
  mimeType: string;
  size: number;
  name: string;
  isVideo: boolean;
  isFavorite: boolean;
  isEncrypted: boolean;
  latitude: number;
  longitude: number;
  bucketName: string;
  cameraModel: string;
  resolution: string;
}

interface SecureFolderGroup {
  id: string;
  title: string;
  hasBackup: boolean;
  accessHash: number;
}

// Formatters & Helpers
function fmtBytes(b: number, d = 1) {
  if (!+b) return '0 B';
  const k = 1024, s = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(b) / Math.log(k));
  return `${parseFloat((b / Math.pow(k, i)).toFixed(d))} ${s[i]}`;
}

function formatDate(timestamp: number) {
  if (!timestamp) return '-';
  const d = new Date(timestamp * 1000);
  return d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
}

function getRealExt(name: string): string {
  let clean = name || '';
  if (clean.toLowerCase().startsWith('enc_')) {
    clean = clean.slice(4);
  }
  return clean.split('.').pop()?.toLowerCase() || '';
}

function getCleanFileName(name: string): string {
  let clean = name || '';
  if (clean.toLowerCase().startsWith('enc_')) {
    clean = clean.slice(4);
  }
  return clean;
}

function getFileCategory(name: string, isVideo: boolean): 'document' | 'media' | 'archive' | 'code' | 'other' {
  const ext = getRealExt(name);
  if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'heic', 'heif', 'mp4', 'webm', 'ogg', 'mov', 'mkv', 'mp3', 'wav', 'flac', 'aac', 'm4a'].includes(ext) || isVideo) {
    return 'media';
  }
  if (['pdf', 'doc', 'docx', 'txt', 'xls', 'xlsx', 'ppt', 'pptx', 'csv', 'md', 'rtf'].includes(ext)) {
    return 'document';
  }
  if (['zip', 'rar', 'tar', 'gz', '7z'].includes(ext)) {
    return 'archive';
  }
  if (['json', 'xml', 'py', 'js', 'ts', 'html', 'css', 'cpp', 'c', 'go', 'rs', 'java', 'sql', 'sh', 'bat', 'yml', 'yaml'].includes(ext)) {
    return 'code';
  }
  return 'other';
}

function SecureFileTypeIcon({ name, isVideo, size = 32 }: { name: string; isVideo?: boolean; size?: number }) {
  const ext = getRealExt(name);
  const color = fileColor(getCleanFileName(name));
  
  if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'heic', 'heif'].includes(ext)) return <ImageIcon size={size} color={color} />;
  if (['mp4', 'webm', 'ogg', 'mov', 'mkv'].includes(ext) || isVideo) return <Video size={size} color={color} />;
  if (['mp3', 'wav', 'flac', 'aac', 'm4a'].includes(ext)) return <Music size={size} color={color} />;
  if (['zip', 'rar', 'tar', 'gz', '7z'].includes(ext)) return <Archive size={size} color={color} />;
  if (['json', 'xml', 'py', 'js', 'ts', 'html', 'css', 'cpp', 'c', 'go', 'rs', 'java', 'sql', 'sh', 'bat', 'yml', 'yaml'].includes(ext)) return <FileCode size={size} color={color} />;
  if (['pdf', 'doc', 'docx', 'txt', 'xls', 'xlsx', 'ppt', 'pptx', 'csv', 'md'].includes(ext)) return <FileText size={size} color={color} />;
  return <File size={size} color={color} />;
}

const SecureFolder: React.FC = () => {
  const [groups, setGroups] = useState<SecureFolderGroup[]>([]);
  const [selectedGroup, setSelectedGroup] = useState<SecureFolderGroup | null>(null);
  const [password, setPassword] = useState(() => localStorage.getItem('sf_master_password') || localStorage.getItem('tp_master_password') || '');
  const [rememberPassword, setRememberPassword] = useState(true);
  const [showPasswordInput, setShowPasswordInput] = useState(false);

  const [loadingGroups, setLoadingGroups] = useState(false);
  const [loadingBackup, setLoadingBackup] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [mediaItems, setMediaItems] = useState<SecureFolderItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  const handleUploadFiles = async () => {
    if (!selectedGroup) {
      showToast("Pilih lokasi folder/grup backup terlebih dahulu.");
      return;
    }
    if (!password) {
      setShowPasswordInput(true);
      showToast("Masukkan Master Password terlebih dahulu untuk enkripsi file.");
      return;
    }

    try {
      const filePaths = await OpenMultiFileDialog();
      if (!filePaths || filePaths.length === 0) return;

      setUploading(true);
      showToast(`Mengenkripsi (AES-256-GCM) & mengunggah ${filePaths.length} file...`);

      let okCount = 0;
      for (const filePath of filePaths) {
        const res = await UploadSecureFolderFile(selectedGroup.id, filePath, password);
        if (res && res.success) {
          okCount++;
        } else {
          showToast(`Gagal mengunggah: ${res?.error || 'Unknown error'}`);
        }
      }

      if (okCount > 0) {
        showToast(`Berhasil mengunggah ${okCount} file terenkripsi ✓`);
        await loadBackup(selectedGroup.id, password);
      }
    } catch (e) {
      showToast(`Error mengunggah file: ${e}`);
    } finally {
      setUploading(false);
    }
  };
  // Create New Group Modal State
  const [showCreateGroupModal, setShowCreateGroupModal] = useState(false);
  const [newGroupName, setNewGroupName] = useState('');
  const [creatingGroup, setCreatingGroup] = useState(false);

  // Edit & Delete Group Modal State
  const [showRenameModal, setShowRenameModal] = useState(false);
  const [renameGroupTarget, setRenameGroupTarget] = useState<SecureFolderGroup | null>(null);
  const [newRenameTitle, setNewRenameTitle] = useState('');
  const [isRenaming, setIsRenaming] = useState(false);

  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteGroupTarget, setDeleteGroupTarget] = useState<SecureFolderGroup | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const handleRenameGroup = async () => {
    if (!renameGroupTarget || !newRenameTitle.trim()) return;
    setIsRenaming(true);
    try {
      const res = await RenameSecureFolderGroup(renameGroupTarget.id, newRenameTitle.trim());
      if (res && res.success) {
        showToast("Berhasil mengubah nama Folder Aman ✓");
        setShowRenameModal(false);
        if (selectedGroup?.id === renameGroupTarget.id) {
          setSelectedGroup({ ...selectedGroup, title: newRenameTitle.trim() });
        }
        await fetchGroups();
      } else {
        showToast(`Gagal mengubah nama: ${res?.error || 'Unknown error'}`);
      }
    } catch (err) {
      showToast(`Error: ${err}`);
    } finally {
      setIsRenaming(false);
    }
  };

  const handleDeleteGroup = async () => {
    if (!deleteGroupTarget) return;
    setIsDeleting(true);
    try {
      const res = await DeleteSecureFolderGroup(deleteGroupTarget.id);
      if (res && res.success) {
        showToast("Berhasil menghapus Folder Aman ✓");
        setShowDeleteModal(false);
        if (selectedGroup?.id === deleteGroupTarget.id) {
          setSelectedGroup(null);
        }
        await fetchGroups();
      } else {
        showToast(`Gagal menghapus folder: ${res?.error || 'Unknown error'}`);
      }
    } catch (err) {
      showToast(`Error: ${err}`);
    } finally {
      setIsDeleting(false);
    }
  };

  const handleCreateGroup = async () => {
    if (!newGroupName.trim()) {
      showToast("Masukkan nama folder aman terlebih dahulu.");
      return;
    }
    setCreatingGroup(true);
    try {
      const res = await CreateSecureFolderGroup(newGroupName.trim(), password);
      if (res && res.success && res.group) {
        showToast(`Folder Aman "${res.group.title}" berhasil dibuat! ✓`);
        setNewGroupName('');
        setShowCreateGroupModal(false);
        const updatedGroups = await ScanSecureFolderGroups();
        setGroups(updatedGroups);
        const created = updatedGroups.find(g => g.id === res.group.id) || {
          id: res.group.id,
          title: res.group.title,
          accessHash: res.group.accessHash,
          hasBackup: true
        };
        setSelectedGroup(created);
        await loadBackup(created.id, password);
      } else {
        showToast(`Gagal membuat folder: ${res?.error || 'Unknown error'}`);
      }
    } catch (e) {
      showToast(`Error membuat folder: ${e}`);
    } finally {
      setCreatingGroup(false);
    }
  };

  // Filter, View & Search states
  const [activeCategory, setActiveCategory] = useState<'all' | 'document' | 'media' | 'archive' | 'other'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');

  // Preview state
  const [previewItem, setPreviewItem] = useState<SecureFolderItem | null>(null);
  const [previewSrc, setPreviewSrc] = useState<string | null>(null);
  const [textContent, setTextContent] = useState<string | null>(null);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [infoModalItem, setInfoModalItem] = useState<SecureFolderItem | null>(null);
  const [copiedText, setCopiedText] = useState(false);

  // Direct thumbnail cache
  const [thumbCache, setThumbCache] = useState<Record<string, string>>({});

  // Helper bindings for Go Wails methods
  const doScanGroups = ScanSecureFolderGroups || ScanTelephotoGroups;
  const doImportBackup = ImportSecureFolderBackup || ImportTelephotoBackup;
  const doPreviewFile = PreviewSecureFolderFile || PreviewTelephotoFile;
  const doDownloadFile = DownloadSecureFolderFile || DownloadTelephotoFile;
  const doGetThumbnail = GetSecureFolderThumbnail || GetTelephotoThumbnail;
  const doClearCache = ClearSecureFolderCache || ClearTelephotoCache;

  useEffect(() => {
    fetchGroups();
  }, []);

  const showToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(null), 3500);
  };

  const fetchGroups = async () => {
    setLoadingGroups(true);
    setError(null);
    try {
      const res = await doScanGroups();
      const uniqueRes: SecureFolderGroup[] = [];
      const seenId = new Set<string>();
      const seenTitle = new Set<string>();

      (res || []).forEach(g => {
        const cleanTitle = (g.title || '').trim().toLowerCase();
        if (!g.id || seenId.has(g.id)) return;
        if (cleanTitle && seenTitle.has(cleanTitle)) {
          const existing = uniqueRes.find(x => x.title.trim().toLowerCase() === cleanTitle);
          if (existing && g.hasBackup) {
            existing.hasBackup = true;
          }
          return;
        }
        seenId.add(g.id);
        if (cleanTitle) seenTitle.add(cleanTitle);
        uniqueRes.push(g);
      });

      setGroups(uniqueRes);
      // Keep selectedGroup null initially so user sees the folder list view first
    } catch (err) {
      setError(String(err));
    } finally {
      setLoadingGroups(false);
    }
  };

  const loadBackup = async (groupId: string, pw: string) => {
    setLoadingBackup(true);
    setError(null);
    try {
      const res = await doImportBackup(groupId, pw);
      if (res && res.length > 0) {
        // Sort items by timestamp descending (newest first)
        const sorted = [...res].sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
        setMediaItems(sorted);
        return true;
      } else {
        setMediaItems([]);
        setError("Belum ada file di dalam folder ini.");
        return false;
      }
    } catch (err) {
      setError(String(err));
      setMediaItems([]);
      return false;
    } finally {
      setLoadingBackup(false);
    }
  };

  const handleSelectGroup = async (group: SecureFolderGroup) => {
    setSelectedGroup(group);
    setMediaItems([]);
    setError(null);
    await loadBackup(group.id, password);
  };

  const handleSavePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (rememberPassword) {
      localStorage.setItem('sf_master_password', password);
      localStorage.setItem('tp_master_password', password);
    } else {
      localStorage.removeItem('sf_master_password');
      localStorage.removeItem('tp_master_password');
    }
    setShowPasswordInput(false);
    showToast("Master Password diperbarui ✓");
    if (selectedGroup) {
      await loadBackup(selectedGroup.id, password);
    }
  };

  const handleClearCache = async () => {
    try {
      const res = await doClearCache();
      if (res && res.success) {
        setThumbCache({});
        showToast("Cache dekripsi berhasil dibersihkan ✓");
      } else {
        showToast("Gagal membersihkan cache: " + (res?.error || 'Unknown error'));
      }
    } catch (e) {
      showToast("Error cleaning cache: " + e);
    }
  };

  // Filter items strictly by search and category
  const filteredItems = useMemo(() => {
    return mediaItems.filter(item => {
      // Must be encrypted
      const isEnc = item.isEncrypted || item.name.toLowerCase().startsWith('enc_');
      if (!isEnc) return false;

      const cat = getFileCategory(item.name, item.isVideo);
      const matchesCategory =
        activeCategory === 'all' ||
        (activeCategory === 'document' && cat === 'document') ||
        (activeCategory === 'media' && cat === 'media') ||
        (activeCategory === 'archive' && (cat === 'archive' || cat === 'code')) ||
        (activeCategory === 'other' && cat === 'other');

      const cleanName = getCleanFileName(item.name);
      const matchesSearch =
        cleanName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.name.toLowerCase().includes(searchQuery.toLowerCase());

      return matchesCategory && matchesSearch;
    });
  }, [mediaItems, activeCategory, searchQuery]);

  // Load thumbnail for images/videos
  const loadThumbnail = async (msgId: number, fileName: string, isEncrypted: boolean) => {
    if (thumbCache[msgId]) return;
    const cat = getFileCategory(fileName, false);
    if (cat !== 'media') return;
    try {
      const d = await doGetThumbnail(selectedGroup?.id || '', String(msgId), fileName, isEncrypted);
      if (d) {
        setThumbCache(p => ({ ...p, [msgId]: d }));
      }
    } catch (e) {
      console.error(e);
    }
  };

  // Handle open preview (supports photos, videos, text files, and doc info)
  const handleOpenPreview = async (item: SecureFolderItem) => {
    setPreviewItem(item);
    setPreviewSrc(null);
    setTextContent(null);
    setLoadingPreview(true);
    setPreviewError(null);

    try {
      const res = await doPreviewFile(
        selectedGroup?.id || '',
        String(item.telegramMessageId),
        item.name,
        item.isEncrypted || true,
        password
      );

      if (res.success) {
        let finalUrl = '';
        const cat = getFileCategory(item.name, item.isVideo);
        
        if (cat === 'media' && !item.isVideo) {
          finalUrl = await ReadCachedImageBase64(String(item.telegramMessageId), item.name);
        }
        
        if (!finalUrl && res.filePath) {
          const normalizedPath = res.filePath.replace(/\\/g, '/');
          const cleanPath = normalizedPath.startsWith('/') ? normalizedPath.slice(1) : normalizedPath;
          finalUrl = '/' + cleanPath.split('/').map(encodeURIComponent).join('/');
        }
        
        const ext = getRealExt(item.name);

        if (['heic', 'heif'].includes(ext) && finalUrl.startsWith('data:')) {
          try {
            const fetchRes = await fetch(finalUrl);
            const blob = await fetchRes.blob();
            const heic2any = (await import('heic2any')).default;
            const converted = await heic2any({ blob, toType: "image/jpeg" });
            finalUrl = URL.createObjectURL(Array.isArray(converted) ? converted[0] : converted);
          } catch (err) {
            console.error("HEIC conversion error:", err);
          }
        }

        setPreviewSrc(finalUrl);

        // If file is text or code, fetch readable text content
        if (['txt', 'json', 'md', 'log', 'csv', 'py', 'js', 'ts', 'html', 'css', 'cpp', 'c', 'go', 'rs', 'java', 'sql', 'sh', 'yml', 'yaml'].includes(ext) && finalUrl) {
          try {
            const txtRes = await fetch(finalUrl);
            const txt = await txtRes.text();
            setTextContent(txt);
          } catch (e) {
            console.error("Failed to read text content:", e);
          }
        }
      } else {
        setPreviewError(res.error || "Gagal mendekripsi file");
      }
    } catch (err) {
      setPreviewError(String(err));
    } finally {
      setLoadingPreview(false);
    }
  };

  const handleDownload = async (item: SecureFolderItem) => {
    try {
      showToast(`Mengunduh ${getCleanFileName(item.name)}...`);
      const res = await doDownloadFile(
        selectedGroup?.id || '',
        String(item.telegramMessageId),
        item.name,
        item.size,
        item.isEncrypted || true,
        password
      );
      if (res.success) {
        showToast(`Berhasil disimpan ke: ${res.filePath} ✓`);
      } else if (res.error !== 'cancelled') {
        showToast(`Gagal mengunduh: ${res.error}`);
      }
    } catch (e) {
      showToast(`Error mengunduh: ${e}`);
    }
  };

  const previewList = filteredItems;
  const currentPreviewIndex = previewItem ? previewList.findIndex(x => x.localId === previewItem.localId) : -1;

  const handlePrev = () => {
    if (currentPreviewIndex > 0) handleOpenPreview(previewList[currentPreviewIndex - 1]);
  };

  const handleNext = () => {
    if (currentPreviewIndex < previewList.length - 1) handleOpenPreview(previewList[currentPreviewIndex + 1]);
  };

  // Load thumbnails for visible elements
  useEffect(() => {
    if (selectedGroup && filteredItems.length > 0) {
      filteredItems.slice(0, 80).forEach(item => {
        loadThumbnail(item.telegramMessageId, item.name, item.isEncrypted || true);
      });
    }
  }, [filteredItems, selectedGroup]);

  // ===================================================================
  // RENDER
  // ===================================================================
  return (
    <div style={{ fontFamily: 'Google Sans, sans-serif', color: 'var(--md-on-surface)', width: '100%', boxSizing: 'border-box' }}>

      {/* Toast */}
      {toastMsg && (
        <div style={{
          position: 'fixed', bottom: 24, right: 24, zIndex: 9999,
          background: 'var(--md-inverse-surface)', color: 'var(--md-inverse-on-surface)',
          padding: '12px 20px', borderRadius: 12, boxShadow: '0 8px 24px rgba(0,0,0,0.2)',
          fontSize: 13, fontWeight: 500, display: 'flex', alignItems: 'center', gap: 10,
          animation: 'fadeIn 0.2s ease-out'
        }}>
          <ShieldCheck size={16} color="#4ade80" />
          {toastMsg}
        </div>
      )}

      {/* ============================================================= */}
      {/* LEVEL 1: FOLDER LIST                                          */}
      {/* ============================================================= */}
      {!selectedGroup ? (
        <div>
          {/* Toolbar - Sticky Edge-to-edge */}
          <div style={{
            position: 'sticky', top: -20, zIndex: 50,
            background: 'var(--md-surface)',
            marginTop: -20, marginLeft: -24, marginRight: -24,
            paddingTop: 16, paddingLeft: 24, paddingRight: 24, paddingBottom: 14,
            borderBottom: '1px solid var(--md-outline-variant)', marginBottom: 20,
            display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12,
            boxShadow: '0 4px 12px rgba(0,0,0,0.12)'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <button
                onClick={() => setShowCreateGroupModal(true)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 8, padding: '9px 20px', borderRadius: 100,
                  border: 'none', background: 'var(--md-primary)', color: 'var(--md-on-primary)',
                  fontSize: 14, fontWeight: 600, cursor: 'pointer',
                  boxShadow: '0 2px 8px rgba(0,0,0,0.12)'
                }}
              >
                <Plus size={18} /> Buat Folder Baru
              </button>
              <button
                onClick={() => setShowPasswordInput(true)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 6, padding: '9px 16px', borderRadius: 100,
                  border: password ? '1.5px solid #22c55e' : '1.5px solid var(--md-outline)',
                  background: password ? 'rgba(34,197,94,0.08)' : 'transparent',
                  color: password ? '#16a34a' : 'var(--md-on-surface-variant)',
                  fontSize: 14, fontWeight: 500, cursor: 'pointer'
                }}
              >
                {password ? <Unlock size={15} color="#16a34a"/> : <Lock size={15}/>}
                {password ? 'Master Password Aktif' : 'Atur Password'}
              </button>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <button
                onClick={fetchGroups} disabled={loadingGroups}
                style={{
                  width: 38, height: 38, borderRadius: '50%', border: '1px solid var(--md-outline-variant)',
                  background: 'transparent', color: 'var(--md-on-surface-variant)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer'
                }}
                title="Refresh"
              >
                <RefreshCw size={16} style={loadingGroups ? { animation: 'spin 1s linear infinite' } : {}} />
              </button>
              <div style={{ display: 'flex', border: '1px solid var(--md-outline-variant)', borderRadius: 100, padding: 3, background: 'var(--md-surface-container-low)' }}>
                <button onClick={() => setViewMode('grid')} style={{ border: 'none', background: viewMode === 'grid' ? 'var(--md-secondary-container)' : 'transparent', color: viewMode === 'grid' ? 'var(--md-on-secondary-container)' : 'var(--md-on-surface-variant)', padding: '6px 12px', borderRadius: 100, cursor: 'pointer', display: 'flex', alignItems: 'center' }} title="Grid"><Grid size={16} /></button>
                <button onClick={() => setViewMode('list')} style={{ border: 'none', background: viewMode === 'list' ? 'var(--md-secondary-container)' : 'transparent', color: viewMode === 'list' ? 'var(--md-on-secondary-container)' : 'var(--md-on-surface-variant)', padding: '6px 12px', borderRadius: 100, cursor: 'pointer', display: 'flex', alignItems: 'center' }} title="List"><List size={16} /></button>
              </div>
            </div>
          </div>

          {/* Loading / Empty / Folder List */}
          {loadingGroups ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '48px 0', justifyContent: 'center', color: 'var(--md-on-surface-variant)', fontSize: 14 }}>
              <RefreshCw size={18} style={{ animation: 'spin 1s linear infinite' }} /> Memindai folder aman...
            </div>
          ) : groups.length === 0 ? (
            <div style={{
              background: 'var(--md-surface-container-low)', borderRadius: 16, border: '1.5px dashed var(--md-outline-variant)',
              padding: '64px 24px', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16
            }}>
              <div style={{ width: 64, height: 64, borderRadius: '50%', background: 'rgba(59,130,246,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <FolderPlus size={32} color="var(--md-primary)" />
              </div>
              <div style={{ fontSize: 18, fontWeight: 600, color: 'var(--md-on-surface)' }}>Belum Ada Folder Aman</div>
              <p style={{ fontSize: 14, color: 'var(--md-on-surface-variant)', margin: 0, maxWidth: 400, lineHeight: 1.5 }}>
                Buat folder aman pertama Anda untuk mulai menyimpan berkas terenkripsi (AES-256-GCM).
              </p>
              <button onClick={() => setShowCreateGroupModal(true)} style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '12px 24px', borderRadius: 100, border: 'none', background: 'var(--md-primary)', color: 'var(--md-on-primary)', fontSize: 14, fontWeight: 600, cursor: 'pointer', marginTop: 4 }}>
                <FolderPlus size={18} /> Buat Folder Aman
              </button>
            </div>
          ) : viewMode === 'grid' ? (
            /* GRID VIEW - Folder cards */
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 14 }}>
              {groups.map(group => (
                <div key={group.id} onClick={() => handleSelectGroup(group)}
                  style={{
                    background: 'var(--md-surface-container)', borderRadius: 14,
                    border: '1px solid var(--md-outline-variant)', padding: '16px 18px',
                    cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 14,
                    transition: 'all 0.2s ease'
                  }}
                  onMouseEnter={e => { e.currentTarget.style.background = 'var(--md-surface-container-high)'; e.currentTarget.style.borderColor = 'var(--md-primary)'; e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 6px 16px rgba(0,0,0,0.08)'; }}
                  onMouseLeave={e => { e.currentTarget.style.background = 'var(--md-surface-container)'; e.currentTarget.style.borderColor = 'var(--md-outline-variant)'; e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = 'none'; }}
                >
                  <Folder size={26} color="var(--md-primary)" fill="rgba(59,130,246,0.15)" />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--md-on-surface)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{group.title}</div>
                    <div style={{ fontSize: 12, color: 'var(--md-on-surface-variant)', marginTop: 2 }}>Folder Aman{group.hasBackup ? ' • Backup ✓' : ''}</div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <button onClick={e => { e.stopPropagation(); setRenameGroupTarget(group); setNewRenameTitle(group.title); setShowRenameModal(true); }} style={{ width: 32, height: 32, borderRadius: '50%', border: 'none', background: 'transparent', color: 'var(--md-on-surface-variant)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }} title="Ubah Nama"><Edit3 size={15} /></button>
                    <button onClick={e => { e.stopPropagation(); setDeleteGroupTarget(group); setShowDeleteModal(true); }} style={{ width: 32, height: 32, borderRadius: '50%', border: 'none', background: 'transparent', color: '#ef4444', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }} title="Hapus"><Trash2 size={15} /></button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            /* LIST VIEW - Folder rows */
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {groups.map(group => (
                <div key={group.id} onClick={() => handleSelectGroup(group)}
                  style={{
                    background: 'var(--md-surface-container)', borderRadius: 12,
                    border: '1px solid var(--md-outline-variant)', padding: '14px 20px',
                    cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    transition: 'all 0.15s ease'
                  }}
                  onMouseEnter={e => { e.currentTarget.style.background = 'var(--md-surface-container-high)'; }}
                  onMouseLeave={e => { e.currentTarget.style.background = 'var(--md-surface-container)'; }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                    <Folder size={24} color="var(--md-primary)" fill="rgba(59,130,246,0.15)" />
                    <div>
                      <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--md-on-surface)' }}>{group.title}</div>
                      <div style={{ fontSize: 12, color: 'var(--md-on-surface-variant)' }}>Folder Aman{group.hasBackup ? ' • Backup ✓' : ''}</div>
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <button onClick={e => { e.stopPropagation(); setRenameGroupTarget(group); setNewRenameTitle(group.title); setShowRenameModal(true); }} style={{ width: 34, height: 34, borderRadius: '50%', border: 'none', background: 'transparent', color: 'var(--md-on-surface-variant)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }} title="Ubah Nama"><Edit3 size={16} /></button>
                    <button onClick={e => { e.stopPropagation(); setDeleteGroupTarget(group); setShowDeleteModal(true); }} style={{ width: 34, height: 34, borderRadius: '50%', border: 'none', background: 'transparent', color: '#ef4444', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }} title="Hapus"><Trash2 size={16} /></button>
                    <ChevronRight size={18} color="var(--md-on-surface-variant)" />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : (
        /* ============================================================= */
        /* LEVEL 2: INSIDE FOLDER - Files                                */
        /* ============================================================= */
        <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
          {/* Sticky Toolbar - Edge to edge, solid background, zero overflow */}
          <div style={{
            position: 'sticky', top: -20, zIndex: 50,
            background: 'var(--md-surface)',
            marginTop: -20, marginLeft: -24, marginRight: -24,
            paddingTop: 18, paddingLeft: 24, paddingRight: 24, paddingBottom: 14,
            borderBottom: '1px solid var(--md-outline-variant)', marginBottom: 18,
            boxShadow: '0 4px 12px rgba(0,0,0,0.12)'
          }}>
            {/* Row 1: Breadcrumb + Actions */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <button onClick={() => setSelectedGroup(null)} style={{
                  display: 'flex', alignItems: 'center', gap: 6, padding: '7px 14px', borderRadius: 100,
                  border: '1px solid var(--md-outline-variant)', background: 'transparent',
                  color: 'var(--md-on-surface-variant)', fontSize: 13, fontWeight: 500, cursor: 'pointer'
                }}>
                  <ArrowLeft size={16} /> Kembali
                </button>
                <ChevronRight size={16} color="var(--md-on-surface-variant)" />
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Folder size={20} color="var(--md-primary)" fill="rgba(59,130,246,0.15)" />
                  <span style={{ fontSize: 17, fontWeight: 700, color: 'var(--md-on-surface)' }}>{selectedGroup.title}</span>
                </div>
                <button onClick={() => { setRenameGroupTarget(selectedGroup); setNewRenameTitle(selectedGroup.title); setShowRenameModal(true); }} style={{ width: 30, height: 30, borderRadius: '50%', border: 'none', background: 'transparent', color: 'var(--md-on-surface-variant)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }} title="Ubah Nama"><Edit3 size={15} /></button>
                <button onClick={() => { setDeleteGroupTarget(selectedGroup); setShowDeleteModal(true); }} style={{ width: 30, height: 30, borderRadius: '50%', border: 'none', background: 'transparent', color: '#ef4444', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }} title="Hapus"><Trash2 size={15} /></button>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                <button onClick={handleUploadFiles} disabled={uploading || loadingBackup}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 8, padding: '8px 18px', borderRadius: 100,
                    border: 'none', background: 'var(--md-primary)', color: 'var(--md-on-primary)',
                    fontSize: 13, fontWeight: 600, cursor: 'pointer', opacity: (uploading || loadingBackup) ? 0.6 : 1
                  }}
                >
                  {uploading ? <RefreshCw size={15} style={{ animation: 'spin 1s linear infinite' }} /> : <Upload size={15} />}
                  {uploading ? 'Mengunggah...' : 'Unggah'}
                </button>
                <button onClick={() => setShowPasswordInput(true)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', borderRadius: 100,
                    border: password ? '1.5px solid #22c55e' : '1.5px solid var(--md-outline)',
                    background: password ? 'rgba(34,197,94,0.08)' : 'transparent',
                    color: password ? '#16a34a' : 'var(--md-on-surface-variant)',
                    fontSize: 13, fontWeight: 500, cursor: 'pointer'
                  }}
                >
                  {password ? <Unlock size={14} color="#16a34a"/> : <Lock size={14}/>}
                  {password ? 'Master Password' : 'Atur Password'}
                </button>
                <button onClick={handleClearCache} style={{
                  padding: '8px 14px', borderRadius: 100, border: '1px solid var(--md-outline-variant)',
                  background: 'transparent', color: 'var(--md-on-surface-variant)', fontSize: 13,
                  fontWeight: 500, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6
                }}>
                  <RefreshCw size={14} /> Hapus Cache
                </button>
                <button onClick={() => loadBackup(selectedGroup.id, password)} disabled={loadingBackup} style={{
                  width: 36, height: 36, borderRadius: '50%', border: '1px solid var(--md-outline-variant)',
                  background: 'transparent', color: 'var(--md-on-surface-variant)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer'
                }} title="Refresh">
                  <RefreshCw size={15} style={loadingBackup ? { animation: 'spin 1s linear infinite' } : {}} />
                </button>
                <div style={{ display: 'flex', border: '1px solid var(--md-outline-variant)', borderRadius: 100, padding: 3, background: 'var(--md-surface-container-low)' }}>
                  <button onClick={() => setViewMode('grid')} style={{ border: 'none', background: viewMode === 'grid' ? 'var(--md-secondary-container)' : 'transparent', color: viewMode === 'grid' ? 'var(--md-on-secondary-container)' : 'var(--md-on-surface-variant)', padding: '6px 12px', borderRadius: 100, cursor: 'pointer', display: 'flex', alignItems: 'center' }}><Grid size={16} /></button>
                  <button onClick={() => setViewMode('list')} style={{ border: 'none', background: viewMode === 'list' ? 'var(--md-secondary-container)' : 'transparent', color: viewMode === 'list' ? 'var(--md-on-secondary-container)' : 'var(--md-on-surface-variant)', padding: '6px 12px', borderRadius: 100, cursor: 'pointer', display: 'flex', alignItems: 'center' }}><List size={16} /></button>
                </div>
              </div>
            </div>

            {/* Row 2: Search + Category Filter */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 12, flexWrap: 'wrap' }}>
              <div style={{ position: 'relative', flex: 1, minWidth: 200 }}>
                <Search size={16} style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: 'var(--md-on-surface-variant)' }} />
                <input
                  type="text" placeholder={`Cari berkas di ${selectedGroup.title}...`}
                  value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
                  style={{
                    width: '100%', padding: '9px 16px 9px 40px', borderRadius: 100,
                    border: '1px solid var(--md-outline-variant)', background: 'var(--md-surface-container-high)',
                    color: 'var(--md-on-surface)', fontSize: 13, outline: 'none', fontFamily: 'Google Sans, sans-serif', boxSizing: 'border-box'
                  }}
                />
                {searchQuery && <X size={15} onClick={() => setSearchQuery('')} style={{ position: 'absolute', right: 14, top: '50%', transform: 'translateY(-50%)', cursor: 'pointer', color: 'var(--md-on-surface-variant)' }} />}
              </div>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {[
                  { id: 'all', label: 'Semua File' },
                  { id: 'document', label: 'Dokumen' },
                  { id: 'media', label: 'Foto & Video' },
                  { id: 'archive', label: 'Arsip & Kode' },
                  { id: 'other', label: 'Lainnya' },
                ].map(cat => {
                  const isActive = activeCategory === cat.id;
                  return (
                    <button key={cat.id} onClick={() => setActiveCategory(cat.id as any)}
                      style={{
                        padding: '7px 16px', borderRadius: 100,
                        border: isActive ? 'none' : '1px solid var(--md-outline-variant)',
                        background: isActive ? 'var(--md-primary)' : 'transparent',
                        color: isActive ? 'var(--md-on-primary)' : 'var(--md-on-surface-variant)',
                        fontSize: 13, fontWeight: 500, cursor: 'pointer'
                      }}
                    >
                      {cat.label}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Error Banner */}
          {error && (
            <div style={{
              background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)',
              color: '#ef4444', borderRadius: 12, padding: '12px 18px', marginBottom: 16,
              display: 'flex', alignItems: 'center', gap: 12, fontSize: 14
            }}>
              <AlertCircle size={18} />
              <span style={{ flex: 1 }}>{error}</span>
              <button onClick={() => setShowPasswordInput(true)} style={{
                background: '#ef4444', color: '#fff', border: 'none', padding: '6px 14px',
                borderRadius: 100, fontSize: 13, fontWeight: 600, cursor: 'pointer',
                display: 'flex', alignItems: 'center', gap: 6
              }}>
                <Key size={14} /> Masukkan Password
              </button>
            </div>
          )}

          {/* Loading State */}
          {loadingBackup && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '64px 0', justifyContent: 'center', color: 'var(--md-on-surface-variant)', fontSize: 15 }}>
              <RefreshCw size={20} style={{ animation: 'spin 1s linear infinite' }} /> Memuat berkas terenkripsi...
            </div>
          )}

          {/* Upload Progress */}
          {uploading && (
            <div style={{
              background: 'rgba(59,130,246,0.08)', border: '1px solid rgba(59,130,246,0.2)',
              borderRadius: 12, padding: '12px 18px', marginBottom: 16,
              display: 'flex', alignItems: 'center', gap: 12, fontSize: 14, color: 'var(--md-primary)'
            }}>
              <RefreshCw size={18} style={{ animation: 'spin 1s linear infinite' }} />
              <span>Mengenkripsi (AES-256-GCM) & mengunggah berkas...</span>
            </div>
          )}

          {/* File Count Header */}
          {!loadingBackup && filteredItems.length > 0 && (
            <div style={{ fontSize: 13, color: 'var(--md-on-surface-variant)', marginBottom: 14, fontWeight: 600, letterSpacing: '0.4px' }}>
              {filteredItems.length} BERKAS TERENKRIPSI
            </div>
          )}

          {/* Empty State / No Files Found */}
          {!loadingBackup && filteredItems.length === 0 && (
            <div style={{
              display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
              padding: '64px 24px', textAlign: 'center', background: 'var(--md-surface-container-low)',
              borderRadius: 16, border: '1.5px dashed var(--md-outline-variant)', marginTop: 8, gap: 14
            }}>
              <div style={{
                width: 64, height: 64, borderRadius: '50%', background: 'rgba(59,130,246,0.1)',
                display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--md-primary)'
              }}>
                {mediaItems.length === 0 ? <Folder size={32} /> : <Search size={32} />}
              </div>
              <div style={{ textAlign: 'center' }}>
                <h3 style={{ fontSize: 17, fontWeight: 600, color: 'var(--md-on-surface)', margin: '0 0 6px 0' }}>
                  {mediaItems.length === 0 ? 'Folder Aman Ini Masih Kosong' : 'Tidak Ada Berkas Ditemukan'}
                </h3>
                <p style={{ fontSize: 14, color: 'var(--md-on-surface-variant)', margin: 0, maxWidth: 420, lineHeight: 1.5 }}>
                  {mediaItems.length === 0
                    ? 'Belum ada berkas terenkripsi di dalam folder ini. Klik tombol unggah untuk mulai menambahkan berkas.'
                    : `Tidak ada berkas yang sesuai dengan kriteria ${activeCategory !== 'all' ? `kategori "${activeCategory}"` : ''} ${searchQuery ? `atau pencarian "${searchQuery}"` : ''}.`}
                </p>
              </div>

              {mediaItems.length > 0 ? (
                <button
                  onClick={() => { setActiveCategory('all'); setSearchQuery(''); }}
                  style={{
                    display: 'inline-flex', alignItems: 'center', gap: 8, padding: '9px 20px', borderRadius: 100,
                    border: '1px solid var(--md-outline-variant)', background: 'transparent',
                    color: 'var(--md-primary)', fontSize: 13, fontWeight: 600, cursor: 'pointer', marginTop: 4
                  }}
                >
                  <RefreshCw size={14} /> Reset Filter & Pencarian
                </button>
              ) : (
                <button
                  onClick={handleUploadFiles}
                  disabled={uploading}
                  style={{
                    display: 'inline-flex', alignItems: 'center', gap: 8, padding: '10px 22px', borderRadius: 100,
                    border: 'none', background: 'var(--md-primary)', color: 'var(--md-on-primary)',
                    fontSize: 14, fontWeight: 600, cursor: 'pointer', marginTop: 4
                  }}
                >
                  <Upload size={16} /> Unggah Berkas Pertama
                </button>
              )}
            </div>
          )}

          {/* GRID VIEW - File cards */}
          {!loadingBackup && filteredItems.length > 0 && viewMode === 'grid' && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 16 }}>
              {filteredItems.map((item, idx) => {
                const ext = getRealExt(item.name).toUpperCase();
                const cleanName = getCleanFileName(item.name);
                const thumbKey = item.telegramMessageId;
                const thumb = thumbCache[thumbKey];
                return (
                  <div key={item.localId || idx}
                    onClick={() => handleOpenPreview(item)}
                    style={{
                      background: 'var(--md-surface-container)', borderRadius: 14,
                      border: '1px solid var(--md-outline-variant)', overflow: 'hidden',
                      cursor: 'pointer', transition: 'all 0.2s cubic-bezier(0.2, 0, 0, 1)'
                    }}
                    onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--md-primary)'; e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 6px 16px rgba(0,0,0,0.1)'; }}
                    onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--md-outline-variant)'; e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = 'none'; }}
                  >
                    {/* Thumbnail Area */}
                    <div style={{
                      height: 150, display: 'flex', alignItems: 'center', justifyContent: 'center',
                      background: 'var(--md-surface-container-high)', position: 'relative', overflow: 'hidden'
                    }}>
                      {thumb ? (
                        <img src={thumb.startsWith('data:') ? thumb : `data:image/jpeg;base64,${thumb}`} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      ) : (
                        <SecureFileTypeIcon name={item.name} isVideo={item.isVideo} size={44} />
                      )}
                      <span style={{ position: 'absolute', top: 8, left: 8, background: 'rgba(0,0,0,0.65)', color: '#4ade80', fontSize: 10, fontWeight: 700, padding: '3px 8px', borderRadius: 8, backdropFilter: 'blur(4px)' }}>🔒 AES-256</span>
                    </div>
                    {/* Info Area */}
                    <div style={{ padding: '14px 16px' }}>
                      <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--md-on-surface)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{cleanName}</div>
                      <div style={{ fontSize: 12, color: 'var(--md-on-surface-variant)', marginTop: 4, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <span>{ext} • {fmtBytes(item.size)}</span>
                        <div style={{ display: 'flex', gap: 4 }}>
                          <button onClick={e => { e.stopPropagation(); handleDownload(item); }} style={{ padding: '5px 10px', borderRadius: 100, border: '1px solid var(--md-outline-variant)', background: 'transparent', color: 'var(--md-on-surface-variant)', fontSize: 12, fontWeight: 500, display: 'flex', alignItems: 'center', gap: 4, cursor: 'pointer' }} title="Unduh"><Download size={13} /> Unduh</button>
                          <button onClick={e => { e.stopPropagation(); setInfoModalItem(item); }} style={{ width: 28, height: 28, borderRadius: '50%', border: 'none', background: 'transparent', color: 'var(--md-on-surface-variant)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }} title="Info"><Info size={14} /></button>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* LIST VIEW - File rows */}
          {!loadingBackup && filteredItems.length > 0 && viewMode === 'list' && (
            <div style={{ border: '1px solid var(--md-outline-variant)', borderRadius: 16, overflow: 'hidden', background: 'var(--md-surface-container-low)' }}>
              {/* Header Row */}
              <div style={{
                display: 'grid', gridTemplateColumns: '1fr 100px 110px 90px', gap: 12,
                padding: '12px 20px', fontSize: 12, fontWeight: 700,
                color: 'var(--md-on-surface-variant)', textTransform: 'uppercase',
                letterSpacing: '0.5px', borderBottom: '1px solid var(--md-outline-variant)',
                background: 'var(--md-surface-container-low)'
              }}>
                <span>Nama</span><span>Ukuran</span><span>Tanggal</span><span style={{ textAlign: 'right' }}>Aksi</span>
              </div>
              {filteredItems.map((item, idx) => {
                const cleanName = getCleanFileName(item.name);
                return (
                  <div key={item.localId || idx} onClick={() => handleOpenPreview(item)}
                    style={{
                      display: 'grid', gridTemplateColumns: '1fr 100px 110px 90px', gap: 12,
                      padding: '12px 20px', alignItems: 'center', cursor: 'pointer',
                      borderBottom: idx < filteredItems.length - 1 ? '1px solid var(--md-outline-variant)' : 'none',
                      transition: 'background 0.15s ease', fontSize: 14
                    }}
                    onMouseEnter={e => e.currentTarget.style.background = 'var(--md-surface-container-high)'}
                    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
                      <SecureFileTypeIcon name={item.name} isVideo={item.isVideo} size={24} />
                      <span style={{ fontWeight: 500, color: 'var(--md-on-surface)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{cleanName}</span>
                    </div>
                    <span style={{ fontSize: 13, color: 'var(--md-on-surface-variant)' }}>{fmtBytes(item.size)}</span>
                    <span style={{ fontSize: 13, color: 'var(--md-on-surface-variant)' }}>{formatDate(item.timestamp)}</span>
                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 4 }}>
                      <button onClick={e => { e.stopPropagation(); handleDownload(item); }} style={{ width: 30, height: 30, borderRadius: '50%', border: 'none', background: 'transparent', color: 'var(--md-on-surface-variant)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }} title="Unduh"><Download size={15} /></button>
                      <button onClick={e => { e.stopPropagation(); setInfoModalItem(item); }} style={{ width: 30, height: 30, borderRadius: '50%', border: 'none', background: 'transparent', color: 'var(--md-on-surface-variant)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }} title="Info"><Info size={15} /></button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ============================================================= */}
      {/* MODALS                                                        */}
      {/* ============================================================= */}

      {/* MASTER PASSWORD MODAL */}
      {showPasswordInput && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 10000, background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
          <div style={{ background: 'var(--md-surface)', border: '1px solid var(--md-outline-variant)', borderRadius: 20, padding: 24, width: '100%', maxWidth: 400, boxShadow: '0 16px 32px rgba(0,0,0,0.25)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
              <div style={{ width: 40, height: 40, borderRadius: 10, background: 'linear-gradient(135deg, #3b82f6, #1d4ed8)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Key size={20} color="#fff" /></div>
              <div>
                <h3 style={{ fontSize: 16, fontWeight: 700, margin: 0, color: 'var(--md-on-surface)' }}>Master Password</h3>
                <span style={{ fontSize: 11, color: 'var(--md-on-surface-variant)' }}>Enkripsi AES-256-GCM</span>
              </div>
              <div style={{ flex: 1 }} />
              <button onClick={() => setShowPasswordInput(false)} style={{ background: 'transparent', border: 'none', color: 'var(--md-on-surface-variant)', cursor: 'pointer' }}><X size={18} /></button>
            </div>
            <form onSubmit={handleSavePassword}>
              <input type="password" placeholder="Masukkan Master Password..." value={password} onChange={e => setPassword(e.target.value)} autoFocus
                style={{ width: '100%', padding: '10px 14px', borderRadius: 10, border: '1.5px solid var(--md-outline)', background: 'var(--md-surface-container-high)', color: 'var(--md-on-surface)', fontSize: 14, outline: 'none', fontFamily: 'Google Sans, sans-serif', marginBottom: 12, boxSizing: 'border-box' }}
              />
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: 'var(--md-on-surface-variant)', marginBottom: 16, cursor: 'pointer' }}>
                <input type="checkbox" checked={rememberPassword} onChange={e => setRememberPassword(e.target.checked)} style={{ accentColor: 'var(--md-primary)' }} />
                Simpan password di perangkat ini
              </label>
              <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                <button type="button" onClick={() => setShowPasswordInput(false)} style={{ padding: '8px 18px', borderRadius: 100, border: '1px solid var(--md-outline-variant)', background: 'transparent', color: 'var(--md-on-surface-variant)', fontSize: 13, fontWeight: 500, cursor: 'pointer' }}>Batal</button>
                <button type="submit" disabled={!password} style={{ padding: '8px 20px', borderRadius: 100, border: 'none', background: 'var(--md-primary)', color: 'var(--md-on-primary)', fontSize: 13, fontWeight: 600, cursor: 'pointer', opacity: !password ? 0.5 : 1 }}>Simpan</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* INFO MODAL */}
      {infoModalItem && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 10000, background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
          <div style={{ background: 'var(--md-surface)', border: '1px solid var(--md-outline-variant)', borderRadius: 20, padding: 24, width: '100%', maxWidth: 420, boxShadow: '0 16px 32px rgba(0,0,0,0.25)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
              <h3 style={{ fontSize: 16, fontWeight: 700, margin: 0, color: 'var(--md-on-surface)' }}>Detail File</h3>
              <button onClick={() => setInfoModalItem(null)} style={{ background: 'transparent', border: 'none', color: 'var(--md-on-surface-variant)', cursor: 'pointer' }}><X size={18} /></button>
            </div>
            {[
              ['Nama Asli', getCleanFileName(infoModalItem.name)],
              ['Nama Terenkripsi', infoModalItem.name],
              ['Ukuran', fmtBytes(infoModalItem.size)],
              ['Tanggal', formatDate(infoModalItem.timestamp)],
              ['Tipe', infoModalItem.mimeType || getRealExt(infoModalItem.name).toUpperCase()],
              ['Telegram Message ID', String(infoModalItem.telegramMessageId)],
              ['Enkripsi', 'AES-256-GCM (Client-Side)'],
            ].map(([label, value]) => (
              <div key={label} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid var(--md-outline-variant)', fontSize: 13 }}>
                <span style={{ color: 'var(--md-on-surface-variant)', fontWeight: 500 }}>{label}</span>
                <span style={{ color: 'var(--md-on-surface)', fontWeight: 600, maxWidth: '60%', textAlign: 'right', wordBreak: 'break-all' }}>{value}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* PREVIEW MODAL */}
      {previewItem && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 10000, background: 'rgba(0,0,0,0.92)', display: 'flex', flexDirection: 'column' }}>
          {/* Preview Header */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 20px', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <button onClick={() => setPreviewItem(null)} style={{ background: 'none', border: 'none', color: '#ffffff', cursor: 'pointer', display: 'flex' }}><ArrowLeft size={20} /></button>
              <div>
                <div style={{ fontSize: 14, fontWeight: 600, color: '#ffffff' }}>{getCleanFileName(previewItem.name)}</div>
                <div style={{ fontSize: 11, color: '#4ade80', fontWeight: 600 }}>[AES-256-GCM Terdekripsi]</div>
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <button onClick={() => handleDownload(previewItem)} style={{
                display: 'flex', alignItems: 'center', gap: 6, padding: '7px 14px', borderRadius: 100,
                border: 'none', background: 'var(--md-primary)', color: 'var(--md-on-primary)',
                fontSize: 13, fontWeight: 600, cursor: 'pointer'
              }}>
                <Download size={14} /> Simpan
              </button>
              <button onClick={() => setPreviewItem(null)} style={{
                background: 'rgba(255,255,255,0.1)', border: 'none', color: '#ffffff',
                width: 34, height: 34, borderRadius: '50%', display: 'flex', alignItems: 'center',
                justifyContent: 'center', cursor: 'pointer'
              }}><X size={18} /></button>
            </div>
          </div>

          {/* Preview Body */}
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative', overflow: 'hidden', padding: 20 }}>
            {/* Prev / Next Navigation */}
            {currentPreviewIndex > 0 && (
              <button onClick={handlePrev} style={{
                position: 'absolute', left: 16, top: '50%', transform: 'translateY(-50%)',
                width: 44, height: 44, borderRadius: '50%', border: 'none',
                background: 'rgba(255,255,255,0.1)', color: '#fff', cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2
              }}><ChevronLeft size={24} /></button>
            )}
            {currentPreviewIndex < previewList.length - 1 && (
              <button onClick={handleNext} style={{
                position: 'absolute', right: 16, top: '50%', transform: 'translateY(-50%)',
                width: 44, height: 44, borderRadius: '50%', border: 'none',
                background: 'rgba(255,255,255,0.1)', color: '#fff', cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2
              }}><ChevronRight size={24} /></button>
            )}

            {loadingPreview ? (
              <div style={{ color: '#fff', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
                <RefreshCw size={28} style={{ animation: 'spin 1s linear infinite' }} />
                <span style={{ fontSize: 14 }}>Mendekripsi file...</span>
              </div>
            ) : previewError ? (
              <div style={{ color: '#ef4444', textAlign: 'center' }}>
                <AlertCircle size={32} />
                <p style={{ fontSize: 14, marginTop: 8 }}>{previewError}</p>
              </div>
            ) : previewSrc ? (() => {
              const ext = getRealExt(previewItem.name);
              if (['jpg','jpeg','png','gif','webp','heic','heif','bmp','svg'].includes(ext)) {
                return <img src={previewSrc} alt="" style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain', borderRadius: 8 }} />;
              }
              if (['mp4','webm','ogg','mov','mkv'].includes(ext) || previewItem.isVideo) {
                return <video src={previewSrc} controls autoPlay style={{ maxWidth: '100%', maxHeight: '100%', borderRadius: 8 }} />;
              }
              if (['mp3','wav','flac','aac','m4a'].includes(ext)) {
                return (
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }}>
                    <Music size={64} color="#4ade80" />
                    <audio src={previewSrc} controls autoPlay style={{ width: 320 }} />
                  </div>
                );
              }
              if (textContent !== null) {
                return <pre style={{ color: '#e2e8f0', background: 'rgba(0,0,0,0.5)', padding: 20, borderRadius: 12, maxWidth: '100%', maxHeight: '80vh', overflow: 'auto', fontSize: 13, lineHeight: 1.6, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{textContent}</pre>;
              }
              return (
                <div style={{ color: '#94a3b8', textAlign: 'center' }}>
                  <File size={48} />
                  <p style={{ fontSize: 14, marginTop: 12 }}>Pratinjau tidak tersedia untuk tipe file ini.</p>
                </div>
              );
            })() : null}
          </div>
        </div>
      )}

      {/* CREATE FOLDER MODAL */}
      {showCreateGroupModal && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 10000, background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
          <div style={{ background: 'var(--md-surface)', border: '1px solid var(--md-outline-variant)', borderRadius: 20, padding: 24, width: '100%', maxWidth: 400, boxShadow: '0 16px 32px rgba(0,0,0,0.25)', display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <h3 style={{ fontSize: 16, fontWeight: 700, margin: 0, color: 'var(--md-on-surface)' }}>Buat Folder Aman Baru</h3>
              <button onClick={() => setShowCreateGroupModal(false)} style={{ background: 'transparent', border: 'none', color: 'var(--md-on-surface-variant)', cursor: 'pointer' }}><X size={18} /></button>
            </div>
            <p style={{ fontSize: 13, color: 'var(--md-on-surface-variant)', margin: 0, lineHeight: 1.5 }}>Grup Privat baru akan dibuat di Telegram untuk menyimpan berkas terenkripsi.</p>
            <input type="text" placeholder="Nama Folder Aman..." value={newGroupName} onChange={e => setNewGroupName(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleCreateGroup()} autoFocus
              style={{ padding: '10px 14px', borderRadius: 10, border: '1.5px solid var(--md-outline)', background: 'var(--md-surface-container-high)', color: 'var(--md-on-surface)', fontSize: 14, outline: 'none', fontFamily: 'Google Sans, sans-serif' }}
            />
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button onClick={() => setShowCreateGroupModal(false)} style={{ padding: '8px 18px', borderRadius: 100, border: '1px solid var(--md-outline-variant)', background: 'transparent', color: 'var(--md-on-surface-variant)', fontSize: 13, fontWeight: 500, cursor: 'pointer' }}>Batal</button>
              <button onClick={handleCreateGroup} disabled={creatingGroup || !newGroupName.trim()} style={{
                padding: '8px 20px', borderRadius: 100, border: 'none',
                background: 'var(--md-primary)', color: 'var(--md-on-primary)',
                fontSize: 13, fontWeight: 600, cursor: 'pointer',
                opacity: (creatingGroup || !newGroupName.trim()) ? 0.5 : 1,
                display: 'flex', alignItems: 'center', gap: 6
              }}>
                {creatingGroup ? <RefreshCw size={14} style={{ animation: 'spin 1s linear infinite' }} /> : <FolderPlus size={14} />}
                {creatingGroup ? 'Membuat...' : 'Buat Folder'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* RENAME MODAL */}
      {showRenameModal && renameGroupTarget && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 10000, background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
          <div style={{ background: 'var(--md-surface)', border: '1px solid var(--md-outline-variant)', borderRadius: 20, padding: 24, width: '100%', maxWidth: 400, boxShadow: '0 16px 32px rgba(0,0,0,0.25)', display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <h3 style={{ fontSize: 16, fontWeight: 700, margin: 0, color: 'var(--md-on-surface)' }}>Ubah Nama Folder</h3>
              <button onClick={() => setShowRenameModal(false)} style={{ background: 'transparent', border: 'none', color: 'var(--md-on-surface-variant)', cursor: 'pointer' }}><X size={18} /></button>
            </div>
            <input type="text" value={newRenameTitle} onChange={e => setNewRenameTitle(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleRenameGroup()} autoFocus
              style={{ padding: '10px 14px', borderRadius: 10, border: '1.5px solid var(--md-outline)', background: 'var(--md-surface-container-high)', color: 'var(--md-on-surface)', fontSize: 14, outline: 'none', fontFamily: 'Google Sans, sans-serif' }}
            />
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button onClick={() => setShowRenameModal(false)} style={{ padding: '8px 18px', borderRadius: 100, border: '1px solid var(--md-outline-variant)', background: 'transparent', color: 'var(--md-on-surface-variant)', fontSize: 13, fontWeight: 500, cursor: 'pointer' }}>Batal</button>
              <button onClick={handleRenameGroup} disabled={isRenaming || !newRenameTitle.trim()} style={{
                padding: '8px 20px', borderRadius: 100, border: 'none',
                background: 'var(--md-primary)', color: 'var(--md-on-primary)',
                fontSize: 13, fontWeight: 600, cursor: 'pointer',
                opacity: (isRenaming || !newRenameTitle.trim()) ? 0.5 : 1,
                display: 'flex', alignItems: 'center', gap: 6
              }}>
                {isRenaming ? <RefreshCw size={14} style={{ animation: 'spin 1s linear infinite' }} /> : <Check size={14} />}
                {isRenaming ? 'Menyimpan...' : 'Simpan'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* DELETE MODAL */}
      {showDeleteModal && deleteGroupTarget && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 10000, background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
          <div style={{ background: 'var(--md-surface)', border: '1px solid var(--md-outline-variant)', borderRadius: 20, padding: 24, width: '100%', maxWidth: 400, boxShadow: '0 16px 32px rgba(0,0,0,0.25)', display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <Trash2 size={20} color="#ef4444" />
                <h3 style={{ fontSize: 16, fontWeight: 700, margin: 0, color: 'var(--md-on-surface)' }}>Hapus Folder Aman?</h3>
              </div>
              <button onClick={() => setShowDeleteModal(false)} style={{ background: 'transparent', border: 'none', color: 'var(--md-on-surface-variant)', cursor: 'pointer' }}><X size={18} /></button>
            </div>
            <p style={{ fontSize: 13, color: 'var(--md-on-surface)', margin: 0, lineHeight: 1.5 }}>
              Folder <b>"{deleteGroupTarget.title}"</b> dan seluruh berkas di dalamnya akan dihapus permanen dari Telegram.
            </p>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button onClick={() => setShowDeleteModal(false)} style={{ padding: '8px 18px', borderRadius: 100, border: '1px solid var(--md-outline-variant)', background: 'transparent', color: 'var(--md-on-surface-variant)', fontSize: 13, fontWeight: 500, cursor: 'pointer' }}>Batal</button>
              <button onClick={handleDeleteGroup} disabled={isDeleting} style={{
                padding: '8px 20px', borderRadius: 100, border: 'none',
                background: '#ef4444', color: '#ffffff', fontSize: 13, fontWeight: 600, cursor: 'pointer',
                opacity: isDeleting ? 0.5 : 1, display: 'flex', alignItems: 'center', gap: 6
              }}>
                {isDeleting ? <RefreshCw size={14} style={{ animation: 'spin 1s linear infinite' }} /> : <Trash2 size={14} />}
                {isDeleting ? 'Menghapus...' : 'Ya, Hapus'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SecureFolder;
