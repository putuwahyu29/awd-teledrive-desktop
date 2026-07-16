import React, { useState, useEffect, useMemo } from 'react';
import {
  Folder, Lock, Key, Image as ImageIcon, Video,
  Search, Download, Info, Play, X, ChevronLeft, ChevronRight, RefreshCw, AlertCircle, Grid, List
} from 'lucide-react';
import {
  ScanTelephotoGroups, ImportTelephotoBackup, PreviewTelephotoFile, DownloadTelephotoFile, GetTelephotoThumbnail, ReadCachedImageBase64
} from '../../wailsjs/go/main/App';

interface TelephotoMediaItem {
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

interface TelephotoGroup {
  id: string;
  title: string;
  hasBackup: boolean;
  accessHash: number;
}

// Helpers
function fmtBytes(b: number, d = 1) {
  if (!+b) return '0 B';
  const k = 1024, s = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(b) / Math.log(k));
  return `${parseFloat((b / Math.pow(k, i)).toFixed(d))} ${s[i]}`;
}

function formatDate(timestamp: number) {
  const d = new Date(timestamp * 1000);
  return d.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });
}

export default function TelephotoGallery() {

  const [groups, setGroups] = useState<TelephotoGroup[]>([]);
  const [hoveredGroup, setHoveredGroup] = useState<string | null>(null);
  const [selectedGroup, setSelectedGroup] = useState<TelephotoGroup | null>(null);
  const [password, setPassword] = useState(() => {
    return localStorage.getItem('tp_master_password') || '';
  });
  const [rememberPassword, setRememberPassword] = useState(true);
  const [showPasswordInput, setShowPasswordInput] = useState(false);

  const [loadingGroups, setLoadingGroups] = useState(false);
  const [loadingBackup, setLoadingBackup] = useState(false);
  const [mediaItems, setMediaItems] = useState<TelephotoMediaItem[]>([]);
  const [error, setError] = useState<string | null>(null);

  // Filter and Search states
  const [activeFilter, setActiveFilter] = useState<'all' | 'image' | 'video' | 'favorite'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');

  // Preview state
  const [previewItem, setPreviewItem] = useState<TelephotoMediaItem | null>(null);
  const [previewSrc, setPreviewSrc] = useState<string | null>(null);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [showInfoPanel, setShowInfoPanel] = useState(false);

  // Direct base64 thumbnail cache
  const [thumbCache, setThumbCache] = useState<Record<string, string>>({});

  // Scan groups on mount
  useEffect(() => {
    fetchGroups();
  }, []);

  const fetchGroups = async () => {
    setLoadingGroups(true);
    setError(null);
    try {
      const res = await ScanTelephotoGroups();
      setGroups(res || []);
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
      const res = await ImportTelephotoBackup(groupId, pw);
      if (res && res.length > 0) {
        // Sort items by timestamp descending (newest first)
        const sorted = [...res].sort((a, b) => b.timestamp - a.timestamp);
        setMediaItems(sorted);
        
        // If there are encrypted files and no password has been entered yet, ask for it
        const hasEncrypted = sorted.some(item => item.isEncrypted);
        if (hasEncrypted && !pw) {
          setShowPasswordInput(true);
        }
        return true;
      } else {
        setError("Folder tidak memiliki data backup telephoto.");
        return false;
      }
    } catch (err) {
      setError(String(err));
      // If the backup file itself is encrypted, show password prompt
      if (String(err).includes("password") || String(err).includes("decrypt")) {
        setShowPasswordInput(true);
      }
      return false;
    } finally {
      setLoadingBackup(false);
    }
  };

  const handleSelectGroup = async (group: TelephotoGroup) => {
    setSelectedGroup(group);
    setMediaItems([]);
    setError(null);
    await loadBackup(group.id, password);
  };

  // Save/remember password configuration
  const handleSavePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (rememberPassword) {
      localStorage.setItem('tp_master_password', password);
    } else {
      localStorage.removeItem('tp_master_password');
    }
    setShowPasswordInput(false);
    if (selectedGroup) {
      await loadBackup(selectedGroup.id, password);
    }
  };

  // Filtered and searched items
  const filteredItems = useMemo(() => {
    return mediaItems.filter(item => {
      const matchesFilter =
        activeFilter === 'all' ||
        (activeFilter === 'image' && !item.isVideo) ||
        (activeFilter === 'video' && item.isVideo) ||
        (activeFilter === 'favorite' && item.isFavorite);

      const matchesSearch =
        item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (item.cameraModel && item.cameraModel.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (item.bucketName && item.bucketName.toLowerCase().includes(searchQuery.toLowerCase()));

      return matchesFilter && matchesSearch;
    });
  }, [mediaItems, activeFilter, searchQuery]);

  // Group items by date for Photos Grid layout
  const groupedItems = useMemo(() => {
    const groups: Record<string, TelephotoMediaItem[]> = {};
    filteredItems.forEach(item => {
      const dateStr = formatDate(item.timestamp);
      if (!groups[dateStr]) groups[dateStr] = [];
      groups[dateStr].push(item);
    });
    return groups;
  }, [filteredItems]);

  // Load thumbnail on demand
  const loadThumbnail = async (msgId: number, fileName: string, isEncrypted: boolean) => {
    if (thumbCache[msgId]) return;
    try {
      const d = await GetTelephotoThumbnail(selectedGroup?.id || '', String(msgId), fileName, isEncrypted);
      if (d) {
        setThumbCache(p => ({ ...p, [msgId]: d }));
      }
    } catch (e) {
      console.error(e);
    }
  };

  // Handle open preview
  const handleOpenPreview = async (item: TelephotoMediaItem) => {
    console.log("[Telephoto] Opening preview for item:", item);
    setPreviewItem(item);
    setPreviewSrc(null);
    setLoadingPreview(true);
    setPreviewError(null);

    try {
      // Step 1: Ensure file is decrypted and cached on disk
      const res = await PreviewTelephotoFile(
        selectedGroup?.id || '',
        String(item.telegramMessageId),
        item.name,
        item.isEncrypted,
        password
      );

      console.log("[Telephoto] PreviewTelephotoFile result:", res);

      if (res.success) {
        // Step 2: Read full image base64 for lightbox (one image at a time is fine)
        let finalUrl = '';
        if (!item.isVideo) {
          finalUrl = await ReadCachedImageBase64(String(item.telegramMessageId), item.name);
          console.log("[Telephoto] Loaded full image base64 for lightbox");
        }
        
        if (!finalUrl && res.filePath) {
          // Fallback to local URL for videos or large files
          const normalizedPath = res.filePath.replace(/\\/g, '/');
          const cleanPath = normalizedPath.startsWith('/') ? normalizedPath.slice(1) : normalizedPath;
          finalUrl = '/' + cleanPath.split('/').map(encodeURIComponent).join('/');
          console.log("[Telephoto] Loading local URL:", finalUrl);
        }
        
        const ext = item.name.split('.').pop().toLowerCase();

        if (['heic', 'heif'].includes(ext) && finalUrl.startsWith('data:')) {
          try {
            console.log("[Telephoto] HEIC file detected. Converting to JPEG...");
            const fetchRes = await fetch(finalUrl);
            const blob = await fetchRes.blob();
            const heic2any = (await import('heic2any')).default;
            const converted = await heic2any({ blob, toType: "image/jpeg" });
            finalUrl = URL.createObjectURL(Array.isArray(converted) ? converted[0] : converted);
            console.log("[Telephoto] HEIC converted successfully!");
          } catch (err) {
            console.error("[Telephoto] HEIC conversion failed:", err);
          }
        }

        setPreviewSrc(finalUrl);

        // Step 3: Get small thumbnail for grid cache (don't store full image in thumbCache)
        if (!thumbCache[item.telegramMessageId]) {
          try {
            const thumbData = await GetTelephotoThumbnail(
              selectedGroup?.id || '',
              String(item.telegramMessageId),
              item.name,
              item.isEncrypted
            );
            if (thumbData) {
              setThumbCache(p => ({ ...p, [item.telegramMessageId]: thumbData }));
            }
          } catch (e) {
            // ignore thumbnail error
          }
        }
      } else {
        setPreviewError(res.error || "Gagal memuat file");
      }
    } catch (err) {
      console.error("[Telephoto] Preview error:", err);
      setPreviewError(String(err));
    } finally {
      setLoadingPreview(false);
    }
  };

  const handleDownload = async (item: TelephotoMediaItem) => {
    try {
      const res = await DownloadTelephotoFile(
        selectedGroup?.id || '',
        String(item.telegramMessageId),
        item.name,
        item.size,
        item.isEncrypted,
        password
      );
      if (res.success) {
        alert(`Berhasil mengunduh ke: ${res.filePath}`);
      } else if (res.error !== 'cancelled') {
        alert(`Gagal mengunduh: ${res.error}`);
      }
    } catch (e) {
      alert(`Error mengunduh: ${e}`);
    }
  };

  const previewList = filteredItems;
  const currentPreviewIndex = previewItem ? previewList.findIndex(x => x.localId === previewItem.localId) : -1;

  const handlePrev = () => {
    if (currentPreviewIndex > 0) {
      handleOpenPreview(previewList[currentPreviewIndex - 1]);
    }
  };

  const handleNext = () => {
    if (currentPreviewIndex < previewList.length - 1) {
      handleOpenPreview(previewList[currentPreviewIndex + 1]);
    }
  };

  // Load thumbnails for visible elements
  useEffect(() => {
    if (selectedGroup && filteredItems.length > 0) {
      // Load first 150 items' thumbnails dynamically
      filteredItems.slice(0, 150).forEach(item => {
        loadThumbnail(item.telegramMessageId, item.name, item.isEncrypted);
      });
    }
  }, [filteredItems, selectedGroup]);

  // Lazy background decryptor for visible encrypted images in the grid
  useEffect(() => {
    if (!selectedGroup || !password || filteredItems.length === 0) return;

    let active = true;
    
    // Find the first 10 encrypted images that are not yet decrypted in the thumbnail cache
    const itemsToDecrypt = filteredItems
      .filter(item => item.isEncrypted && !item.isVideo && !thumbCache[item.telegramMessageId])
      .slice(0, 10);

    console.log("[Telephoto] Background decryptor triggered. Items to decrypt:", itemsToDecrypt.length);

    if (itemsToDecrypt.length === 0) return;

    const decryptNext = async (index: number) => {
      if (!active || index >= itemsToDecrypt.length) return;
      const item = itemsToDecrypt[index];
      
      console.log(`[Telephoto] Background decrypting item [${index + 1}/${itemsToDecrypt.length}]: ${item.name}`);

      try {
        // Step 1: Decrypt and cache the file on disk
        const res = await PreviewTelephotoFile(
          selectedGroup.id,
          String(item.telegramMessageId),
          item.name,
          item.isEncrypted,
          password
        );

        if (res.success && active) {
          // Step 2: Get small 200px thumbnail (not the full image!)
          const thumbData = await GetTelephotoThumbnail(
            selectedGroup.id,
            String(item.telegramMessageId),
            item.name,
            item.isEncrypted
          );
          
          if (thumbData && active) {
            console.log(`[Telephoto] Background decrypt success for: ${item.name}`);
            setThumbCache(p => ({ ...p, [item.telegramMessageId]: thumbData }));
          }
        } else if (!res.success) {
          console.warn(`[Telephoto] Background decrypt failed for ${item.name}:`, res.error);
        }
      } catch (err) {
        console.error("[Telephoto] Background decrypt error:", err);
      }

      // Small delay between background downloads to keep UI responsive
      setTimeout(() => {
        decryptNext(index + 1);
      }, 500);
    };

    // Start background queue
    decryptNext(0);

    return () => {
      active = false;
    };
  }, [filteredItems, selectedGroup, password]);

  if (!selectedGroup) {
    return (
      <div style={styles.container}>
        {loadingGroups ? (
          <div style={styles.centered}>
            <RefreshCw size={36} style={styles.spin} />
            <span style={{ marginTop: 12, color: 'var(--md-on-surface-variant)' }}>Memindai folder...</span>
          </div>
        ) : (
          <div style={styles.groupGrid}>
            {groups.length === 0 ? (
              <div style={styles.emptyState}>
                <AlertCircle size={48} color="var(--md-outline)" />
                <h3>Tidak ada folder ditemukan</h3>
                <p>Pastikan Anda sudah membuat folder di Galeri Aman.</p>
                <button onClick={fetchGroups} style={styles.btnPrimary}>Coba Lagi</button>
              </div>
            ) : (
              groups.map(group => {
                const isHov = hoveredGroup === group.id;
                return (
                  <div
                    key={group.id}
                    onClick={() => handleSelectGroup(group)}
                    onMouseEnter={() => setHoveredGroup(group.id)}
                    onMouseLeave={() => setHoveredGroup(null)}
                    style={{
                      ...styles.groupCard,
                      border: isHov ? '1.5px solid var(--md-primary)' : '1px solid var(--md-outline-variant)',
                      background: isHov ? 'var(--md-surface-container-high)' : 'var(--md-surface-container)',
                      transform: isHov ? 'translateY(-3px)' : 'none',
                      boxShadow: isHov ? '0 10px 25px rgba(0,0,0,0.12)' : 'none',
                      transition: 'all 0.25s cubic-bezier(0.2, 0, 0, 1)',
                    }}
                  >
                    <div style={{
                      ...styles.groupAvatar,
                      background: isHov ? 'var(--md-primary-container)' : 'var(--md-secondary-container)',
                      transition: 'all 0.25s',
                    }}>
                      <Folder size={28} color={isHov ? 'var(--md-on-primary-container)' : 'var(--md-primary)'} />
                    </div>
                    <div style={styles.groupInfo}>
                      <h3 style={styles.groupTitle}>{group.title}</h3>
                      <span style={styles.groupMeta}>
                        ID: {group.id} {group.hasBackup && ' • Backup Terdeteksi'}
                      </span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        )}

        {error && (
          <div style={styles.errorBox}>
            <AlertCircle size={20} />
            <span>{error}</span>
          </div>
        )}
      </div>
    );
  }

  return (
    <div style={styles.container}>
      {/* Top Navbar */}
      <div style={styles.navBar}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flex: '1 1 300px', minWidth: 0 }}>
          <button
            onClick={() => setSelectedGroup(null)}
            style={styles.btnBack}
            onMouseEnter={e => e.currentTarget.style.background = 'var(--md-surface-container-highest)'}
            onMouseLeave={e => e.currentTarget.style.background = 'var(--md-surface-container-high)'}
            title="Kembali"
          >
            <ChevronLeft size={20} />
          </button>
          <div style={{ minWidth: 0, flex: 1 }}>
            <h2 style={styles.navGroupTitle} title={selectedGroup.title}>{selectedGroup.title}</h2>
            <span style={styles.navGroupSubtitle}>{filteredItems.length} media ditemukan</span>
          </div>
        </div>

        {/* Action Controls */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', flex: '1 1 auto', justifyContent: 'flex-end' }}>
          {/* Master Password Toggle */}
          <button
            onClick={() => setShowPasswordInput(true)}
            style={{
              ...styles.btnTonal,
              borderColor: password ? 'var(--md-primary)' : 'var(--md-outline)',
            }}
          >
            <Key size={16} /> {password ? 'Password Diset' : 'Masukkan Password'}
          </button>

          {/* Search bar */}
          <div style={styles.searchContainer}>
            <Search size={18} style={styles.searchIcon} />
            <input
              type="text"
              placeholder="Cari foto, kamera, album..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              style={styles.searchInput}
            />
            {searchQuery && (
              <button onClick={() => setSearchQuery('')} style={styles.searchClear}>
                ✕
              </button>
            )}
          </div>
        </div>
      </div>


      {/* Categories Toolbar */}
      <div style={styles.toolbar}>
        <div style={styles.filters}>
          {(['all', 'image', 'video'] as const).map(f => (
            <button
              key={f}
              onClick={() => setActiveFilter(f)}
              style={{
                ...styles.filterBtn,
                background: activeFilter === f ? 'var(--md-secondary-container)' : 'transparent',
                color: activeFilter === f ? 'var(--md-on-secondary-container)' : 'var(--md-on-surface-variant)',
                fontWeight: activeFilter === f ? 600 : 500,
              }}
            >
              {f === 'all' && 'Semua'}
              {f === 'image' && 'Gambar'}
              {f === 'video' && 'Video'}
            </button>
          ))}
        </div>

        <div style={{ display: 'flex', gap: 8 }}>
          <button
            onClick={() => setViewMode('grid')}
            style={{
              ...styles.iconBtn,
              background: viewMode === 'grid' ? 'var(--md-surface-container-high)' : 'transparent',
            }}
          >
            <Grid size={18} />
          </button>
          <button
            onClick={() => setViewMode('list')}
            style={{
              ...styles.iconBtn,
              background: viewMode === 'list' ? 'var(--md-surface-container-high)' : 'transparent',
            }}
          >
            <List size={18} />
          </button>
        </div>
      </div>

      {/* Main Content Area */}
      {loadingBackup ? (
        <div style={styles.centered}>
          <RefreshCw size={36} style={styles.spin} />
          <span style={{ marginTop: 12 }}>Mengunduh backup metadata...</span>
        </div>
      ) : filteredItems.length === 0 ? (
        <div style={styles.centered}>
          <ImageIcon size={48} color="var(--md-outline)" />
          <p style={{ marginTop: 12, color: 'var(--md-on-surface-variant)' }}>Tidak ada media yang cocok dengan filter.</p>
        </div>
      ) : viewMode === 'grid' ? (
        // Google Photos Date-Grouped Grid Layout
        <div style={styles.galleryContent}>
          {Object.keys(groupedItems).map(dateStr => (
            <div key={dateStr} style={styles.dateGroup}>
              <h3 style={styles.dateHeader}>{dateStr}</h3>
              <div style={styles.grid}>
                {groupedItems[dateStr].map(item => {
                  const thumb = thumbCache[item.telegramMessageId];
                  return (
                    <div
                      key={item.localId}
                      onClick={() => handleOpenPreview(item)}
                      style={{
                        ...styles.mediaCard,
                        transition: 'all 0.25s cubic-bezier(0.2, 0.8, 0.2, 1)',
                      }}
                      onMouseEnter={e => {
                        e.currentTarget.style.transform = 'scale(1.03) translateY(-3px)';
                        e.currentTarget.style.boxShadow = '0 12px 28px rgba(0,0,0,0.16)';
                        e.currentTarget.style.borderColor = 'var(--md-primary)';
                      }}
                      onMouseLeave={e => {
                        e.currentTarget.style.transform = 'none';
                        e.currentTarget.style.boxShadow = 'none';
                        e.currentTarget.style.borderColor = 'var(--md-outline-variant)';
                      }}
                    >
                      {/* Image / Thumbnail Container */}
                      <div style={styles.thumbnailWrapper}>
                        {thumb ? (
                          <img
                            src={thumb}
                            alt={item.name}
                            style={styles.thumbnailImage}
                            onError={() => {
                              console.error(`[Telephoto] Failed to load grid image: ${item.name}. URL: ${thumb}`);
                            }}
                          />
                        ) : (
                          <div style={styles.thumbnailPlaceholder}>
                            {item.isVideo ? <Video size={36} strokeWidth={1.5} /> : <ImageIcon size={36} strokeWidth={1.5} />}
                            {item.isEncrypted && (
                              <span style={{ fontSize: 10, color: 'var(--md-on-surface-variant)', fontWeight: 500 }}>
                                Terenkripsi
                              </span>
                            )}
                          </div>
                        )}

                        {/* Top Overlay: Lock / Encrypted status */}
                        {item.isEncrypted && (
                          <div style={styles.lockBadge} title="Terenkripsi">
                            <Lock size={12} color="#fff" />
                          </div>
                        )}

                        {/* Bottom Overlay: Video duration / Icon */}
                        {item.isVideo && (
                          <div style={styles.videoBadge}>
                            <Play size={10} fill="#fff" color="#fff" />
                            <span style={{ fontSize: 10, fontWeight: 600 }}>VIDEO</span>
                          </div>
                        )}
                      </div>

                      {/* Info bottom text */}
                      <div style={styles.mediaCardFooter}>
                        <span style={styles.mediaCardTitle} title={item.name}>
                          {item.name}
                        </span>
                        <span style={styles.mediaCardSize}>{fmtBytes(item.size)}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      ) : (
        // List View Mode
        <div style={styles.listContainer}>
          <table style={styles.table}>
            <thead>
              <tr style={styles.tableHeader}>
                <th style={styles.th}>Nama</th>
                <th style={styles.th}>Tipe</th>
                <th style={styles.th}>Ukuran</th>
                <th style={styles.th}>Tanggal</th>
                <th style={styles.th}>Enkripsi</th>
              </tr>
            </thead>
            <tbody>
              {filteredItems.map(item => (
                <tr
                  key={item.localId}
                  onClick={() => handleOpenPreview(item)}
                  style={styles.tableRow}
                  onMouseEnter={e => e.currentTarget.style.background = 'var(--md-surface-container-high)'}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                >
                  <td style={styles.td}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, maxWidth: '280px', minWidth: 0 }}>
                      {item.isVideo ? <Video size={16} /> : <ImageIcon size={16} />}
                      <span style={{
                        fontWeight: 500,
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                      }} title={item.name}>
                        {item.name}
                      </span>
                    </div>
                  </td>
                  <td style={styles.td}>{item.mimeType}</td>
                  <td style={styles.td}>{fmtBytes(item.size)}</td>
                  <td style={styles.td}>{formatDate(item.timestamp)}</td>
                  <td style={styles.td}>{item.isEncrypted ? 'Ya' : 'Tidak'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Password Prompt Modal */}
      {showPasswordInput && (
        <div style={styles.modalOverlay}>
          <form onSubmit={handleSavePassword} style={styles.passwordModal}>
            <div style={styles.modalHeader}>
              <h3 style={{ margin: 0 }}>Master Password</h3>
              <button type="button" onClick={() => setShowPasswordInput(false)} style={styles.btnClose}>✕</button>
            </div>
            <p style={{ fontSize: 13, color: 'var(--md-on-surface-variant)' }}>
              Pustaka ini berisi file terenkripsi. Masukkan password galeri aman Anda untuk dekripsi media.
            </p>
            <input
              type="password"
              placeholder="Masukkan Master Password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              style={styles.inputField}
              autoFocus
              required
            />
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, margin: '12px 0', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={rememberPassword}
                onChange={e => setRememberPassword(e.target.checked)}
              />
              Ingat password di perangkat ini
            </label>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 16 }}>
              <button type="button" onClick={() => setShowPasswordInput(false)} style={styles.btnTonal}>Batal</button>
              <button type="submit" style={styles.btnPrimary}>Simpan</button>
            </div>
          </form>
        </div>
      )}

      {/* Lightbox / Preview Modal Overlay */}
      {previewItem && (
        <div style={styles.lightboxOverlay} onClick={(e) => { if (e.target === e.currentTarget) setPreviewItem(null); }}>
          {/* Main Content Area */}
          <div style={styles.lightboxContent} onClick={e => e.stopPropagation()}>
            {/* Header controls */}
            <div style={styles.lightboxHeader}>
              <span style={styles.lightboxFileName}>{previewItem.name}</span>
              <div style={{ display: 'flex', gap: 8 }}>
                <button
                  onClick={() => handleDownload(previewItem)}
                  style={styles.lightboxActionBtn}
                  onMouseEnter={e => e.currentTarget.style.background = 'rgba(255, 255, 255, 0.2)'}
                  onMouseLeave={e => e.currentTarget.style.background = 'rgba(255, 255, 255, 0.1)'}
                  title="Download"
                >
                  <Download size={18} />
                </button>
                <button
                  onClick={() => setShowInfoPanel(!showInfoPanel)}
                  style={styles.lightboxActionBtn}
                  onMouseEnter={e => e.currentTarget.style.background = 'rgba(255, 255, 255, 0.2)'}
                  onMouseLeave={e => e.currentTarget.style.background = 'rgba(255, 255, 255, 0.1)'}
                  title="Info EXIF"
                >
                  <Info size={18} />
                </button>
                <button
                  onClick={() => setPreviewItem(null)}
                  style={styles.lightboxActionBtn}
                  onMouseEnter={e => e.currentTarget.style.background = 'rgba(255, 255, 255, 0.2)'}
                  onMouseLeave={e => e.currentTarget.style.background = 'rgba(255, 255, 255, 0.1)'}
                  title="Tutup"
                >
                  <X size={18} />
                </button>
              </div>
            </div>

            {/* Media Container */}
            <div style={styles.lightboxBody}>
              {loadingPreview ? (
                <div style={styles.lightboxCentered}>
                  <RefreshCw size={36} style={styles.spin} />
                  <span style={{ marginTop: 12, color: '#aaa' }}>Mendekripsi file...</span>
                </div>
              ) : previewError ? (
                <div style={styles.lightboxCentered}>
                  <AlertCircle size={48} color="red" />
                  <span style={{ marginTop: 12, color: 'red' }}>{previewError}</span>
                  <button onClick={() => { setShowPasswordInput(true); setPreviewError(null); }} style={{ ...styles.btnPrimary, marginTop: 16 }}>Set Master Password</button>
                </div>
              ) : previewSrc ? (
                previewItem.isVideo ? (
                  <video src={previewSrc} controls autoPlay style={styles.lightboxVideo} />
                ) : (
                  <img
                    src={previewSrc}
                    alt={previewItem.name}
                    style={styles.lightboxImage}
                    onError={() => {
                      console.error(`[Telephoto] Failed to load lightbox image: ${previewItem.name}. URL: ${previewSrc}`);
                    }}
                  />
                )
              ) : null}

              {/* Navigation arrows */}
              {currentPreviewIndex > 0 && (
                <button
                  onClick={handlePrev}
                  style={{ ...styles.navArrow, left: 24 }}
                  onMouseEnter={e => e.currentTarget.style.background = 'rgba(255, 255, 255, 0.2)'}
                  onMouseLeave={e => e.currentTarget.style.background = 'rgba(255, 255, 255, 0.1)'}
                >
                  <ChevronLeft size={28} />
                </button>
              )}
              {currentPreviewIndex < previewList.length - 1 && (
                <button
                  onClick={handleNext}
                  style={{ ...styles.navArrow, right: 24 }}
                  onMouseEnter={e => e.currentTarget.style.background = 'rgba(255, 255, 255, 0.2)'}
                  onMouseLeave={e => e.currentTarget.style.background = 'rgba(255, 255, 255, 0.1)'}
                >
                  <ChevronRight size={28} />
                </button>
              )}
            </div>
          </div>

          {/* EXIF Info Panel Sidebar */}
          {showInfoPanel && (
            <div style={styles.infoPanel} onClick={e => e.stopPropagation()}>
              <div style={styles.infoPanelHeader}>
                <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 600 }}>Detail Media</h3>
                <button onClick={() => setShowInfoPanel(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '18px', color: 'rgba(255, 255, 255, 0.65)', padding: 4 }}>✕</button>
              </div>
              <div style={styles.infoPanelContent}>
                <div style={styles.infoRow}>
                  <span style={styles.infoLabel}>Nama File</span>
                  <span style={styles.infoVal}>{previewItem.name}</span>
                </div>
                <div style={styles.infoRow}>
                  <span style={styles.infoLabel}>Ukuran</span>
                  <span style={styles.infoVal}>{fmtBytes(previewItem.size)}</span>
                </div>
                <div style={styles.infoRow}>
                  <span style={styles.infoLabel}>MIME Type</span>
                  <span style={styles.infoVal}>{previewItem.mimeType}</span>
                </div>
                <div style={styles.infoRow}>
                  <span style={styles.infoLabel}>Tanggal</span>
                  <span style={styles.infoVal}>{formatDate(previewItem.timestamp)}</span>
                </div>
                <div style={styles.infoRow}>
                  <span style={styles.infoLabel}>Enkripsi</span>
                  <span style={styles.infoVal}>{previewItem.isEncrypted ? 'Terenkripsi (AES-GCM)' : 'Plain'}</span>
                </div>
                {previewItem.cameraModel && (
                  <div style={styles.infoRow}>
                    <span style={styles.infoLabel}>Kamera</span>
                    <span style={styles.infoVal}>{previewItem.cameraModel}</span>
                  </div>
                )}
                {previewItem.resolution && (
                  <div style={styles.infoRow}>
                    <span style={styles.infoLabel}>Resolusi</span>
                    <span style={styles.infoVal}>{previewItem.resolution}</span>
                  </div>
                )}
                {previewItem.bucketName && (
                  <div style={styles.infoRow}>
                    <span style={styles.infoLabel}>Album</span>
                    <span style={styles.infoVal}>{previewItem.bucketName}</span>
                  </div>
                )}
                {previewItem.latitude !== 0 && previewItem.longitude !== 0 && (
                  <div style={styles.infoRow}>
                    <span style={styles.infoLabel}>Koordinat GPS</span>
                    <span style={styles.infoVal}>{previewItem.latitude.toFixed(6)}, {previewItem.longitude.toFixed(6)}</span>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// Styling Object
const styles: Record<string, React.CSSProperties> = {
  container: {
    padding: '8px 0 0 0',
    height: '100%',
    display: 'flex',
    flexDirection: 'column',
    overflowY: 'auto',
    background: 'transparent',
    color: 'var(--md-on-surface)',
    fontFamily: 'Google Sans, sans-serif',
  },
  header: {
    marginBottom: '24px',
  },
  title: {
    fontSize: '28px',
    fontWeight: 'bold',
    marginBottom: '8px',
  },
  subtitle: {
    color: 'var(--md-on-surface-variant)',
    fontSize: '14px',
  },
  centered: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '60px 20px',
    flex: 1,
  },
  spin: {
    animation: 'spin 1.5s linear infinite',
  },
  groupGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
    gap: '16px',
    marginTop: '16px',
  },
  groupCard: {
    background: 'var(--md-surface-container)',
    borderRadius: '16px',
    padding: '16px',
    display: 'flex',
    alignItems: 'center',
    gap: '16px',
    cursor: 'pointer',
    border: '1px solid var(--md-outline-variant)',
    transition: 'all 0.2s',
  },
  groupAvatar: {
    width: '48px',
    height: '48px',
    borderRadius: '12px',
    background: 'var(--md-secondary-container)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  groupInfo: {
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
  },
  groupTitle: {
    margin: 0,
    fontSize: '16px',
    fontWeight: 600,
  },
  groupMeta: {
    fontSize: '12px',
    color: 'var(--md-on-surface-variant)',
  },
  emptyState: {
    gridColumn: '1 / -1',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    padding: '40px',
    textAlign: 'center',
    gap: '12px',
  },
  btnPrimary: {
    background: 'var(--md-primary)',
    color: 'var(--md-on-primary)',
    border: 'none',
    borderRadius: '100px',
    padding: '10px 24px',
    fontSize: '14px',
    fontWeight: 500,
    cursor: 'pointer',
    fontFamily: 'Google Sans, sans-serif',
  },
  btnTonal: {
    background: 'transparent',
    color: 'var(--md-primary)',
    border: '1.5px solid var(--md-outline-variant)',
    borderRadius: '100px',
    padding: '10px 20px',
    fontSize: '14px',
    fontWeight: 500,
    cursor: 'pointer',
    fontFamily: 'Google Sans, sans-serif',
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  },
  errorBox: {
    marginTop: '20px',
    padding: '12px 16px',
    background: 'var(--md-error-container)',
    color: 'var(--md-on-error-container)',
    borderRadius: '12px',
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
  },
  navBar: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: '16px',
    paddingBottom: '16px',
    borderBottom: '1px solid var(--md-outline-variant)',
    marginBottom: '16px',
  },
  btnBack: {
    background: 'var(--md-surface-container-high)',
    border: 'none',
    width: '36px',
    height: '36px',
    borderRadius: '50%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
    color: 'var(--md-primary)',
    transition: 'all 0.2s',
  },
  navGroupTitle: {
    margin: 0,
    fontSize: '20px',
    fontWeight: 'bold',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },
  navGroupSubtitle: {
    fontSize: '12px',
    color: 'var(--md-on-surface-variant)',
  },
  searchContainer: {
    position: 'relative',
    display: 'flex',
    alignItems: 'center',
    flex: '1 1 auto',
    maxWidth: '260px',
    minWidth: '150px',
  },
  searchIcon: {
    position: 'absolute',
    left: '12px',
    color: 'var(--md-on-surface-variant)',
  },
  searchInput: {
    padding: '10px 36px',
    borderRadius: '100px',
    border: '1.5px solid var(--md-outline)',
    background: 'transparent',
    color: 'var(--md-on-surface)',
    fontSize: '14px',
    width: '100%',
    outline: 'none',
  },
  searchClear: {
    position: 'absolute',
    right: '12px',
    background: 'none',
    border: 'none',
    color: 'var(--md-on-surface-variant)',
    cursor: 'pointer',
    padding: 0,
  },
  toolbar: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: '12px',
    marginBottom: '16px',
  },
  filters: {
    display: 'flex',
    gap: '8px',
    flexWrap: 'wrap',
  },
  filterBtn: {
    border: 'none',
    padding: '8px 16px',
    borderRadius: '100px',
    cursor: 'pointer',
    fontSize: '13px',
    transition: 'all 0.15s',
  },
  iconBtn: {
    border: 'none',
    width: '36px',
    height: '36px',
    borderRadius: '8px',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: 'var(--md-on-surface)',
  },
  galleryContent: {
    display: 'flex',
    flexDirection: 'column',
    gap: '24px',
  },
  dateGroup: {
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
  },
  dateHeader: {
    margin: 0,
    fontSize: '15px',
    fontWeight: 600,
    color: 'var(--md-on-surface)',
  },
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))',
    gap: '8px',
  },
  mediaCard: {
    background: 'var(--md-surface-container-low)',
    borderRadius: '12px',
    overflow: 'hidden',
    border: '1px solid var(--md-outline-variant)',
    cursor: 'pointer',
    transition: 'transform 0.15s, box-shadow 0.15s',
    display: 'flex',
    flexDirection: 'column',
  },
  thumbnailWrapper: {
    position: 'relative',
    width: '100%',
    paddingTop: '100%',
    background: 'var(--md-surface-container-highest)',
    overflow: 'hidden',
  },
  thumbnailImage: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: '100%',
    height: '100%',
    objectFit: 'cover',
  },
  thumbnailPlaceholder: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: '100%',
    height: '100%',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '6px',
  },
  lockBadge: {
    position: 'absolute',
    top: '8px',
    right: '8px',
    background: 'rgba(0,0,0,0.5)',
    borderRadius: '50%',
    width: '20px',
    height: '20px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    backdropFilter: 'blur(4px)',
  },
  videoBadge: {
    position: 'absolute',
    bottom: '8px',
    left: '8px',
    background: 'rgba(0,0,0,0.6)',
    color: '#fff',
    borderRadius: '4px',
    padding: '2px 6px',
    display: 'flex',
    alignItems: 'center',
    gap: '4px',
  },
  mediaCardFooter: {
    padding: '8px',
    display: 'flex',
    flexDirection: 'column',
    gap: '2px',
  },
  mediaCardTitle: {
    fontSize: '11px',
    fontWeight: 500,
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },
  mediaCardSize: {
    fontSize: '10px',
    color: 'var(--md-on-surface-variant)',
  },
  listContainer: {
    background: 'var(--md-surface-container-low)',
    borderRadius: '16px',
    border: '1px solid var(--md-outline-variant)',
    overflow: 'hidden',
  },
  table: {
    width: '100%',
    borderCollapse: 'collapse',
  },
  tableHeader: {
    background: 'var(--md-surface-container-high)',
  },
  th: {
    padding: '12px 16px',
    textAlign: 'left',
    color: 'var(--md-on-surface-variant)',
    fontSize: '12px',
    fontWeight: 600,
    whiteSpace: 'nowrap',
  },
  td: {
    padding: '12px 16px',
    color: 'var(--md-on-surface)',
    fontSize: '13px',
    whiteSpace: 'nowrap',
  },
  tableRow: {
    borderBottom: '1px solid var(--md-outline-variant)',
    cursor: 'pointer',
    transition: 'background 0.15s',
  },
  modalOverlay: {
    position: 'fixed',
    inset: 0,
    background: 'rgba(0,0,0,0.5)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 9999,
    backdropFilter: 'blur(4px)',
  },
  passwordModal: {
    background: 'var(--md-surface-container)',
    borderRadius: '24px',
    padding: '24px',
    width: '100%',
    maxWidth: '400px',
    border: '1px solid var(--md-outline-variant)',
    boxShadow: '0 8px 32px rgba(0,0,0,0.24)',
  },
  modalHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '12px',
  },
  btnClose: {
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    fontSize: '16px',
    color: 'var(--md-on-surface-variant)',
  },
  inputField: {
    width: '100%',
    padding: '12px 16px',
    borderRadius: '8px',
    border: '1.5px solid var(--md-outline)',
    background: 'transparent',
    color: 'var(--md-on-surface)',
    fontSize: '14px',
    outline: 'none',
    marginTop: '12px',
  },
  lightboxOverlay: {
    position: 'fixed',
    inset: 0,
    background: 'rgba(10, 11, 14, 0.85)',
    backdropFilter: 'blur(20px)',
    display: 'flex',
    flexDirection: 'row',
    zIndex: 99999,
  },
  lightboxContent: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    position: 'relative',
    overflow: 'hidden',
  },
  lightboxHeader: {
    height: '64px',
    minHeight: '64px',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '0 24px',
    background: 'rgba(0, 0, 0, 0.4)',
    borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
    color: '#fff',
    zIndex: 10,
  },
  lightboxFileName: {
    fontSize: '15px',
    fontWeight: 500,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
    marginRight: '16px',
    flex: 1,
    color: 'rgba(255, 255, 255, 0.9)',
  },
  lightboxActionBtn: {
    background: 'rgba(255, 255, 255, 0.1)',
    border: 'none',
    color: '#fff',
    cursor: 'pointer',
    width: '40px',
    height: '40px',
    borderRadius: '50%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    transition: 'all 0.2s ease',
    outline: 'none',
  },
  lightboxBody: {
    flex: 1,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    padding: '24px',
    overflow: 'hidden',
  },
  lightboxImage: {
    maxWidth: '100%',
    maxHeight: '100%',
    objectFit: 'contain',
    borderRadius: '4px',
    boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
  },
  lightboxVideo: {
    maxWidth: '100%',
    maxHeight: '100%',
    borderRadius: '4px',
  },
  lightboxCentered: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
  },
  navArrow: {
    position: 'absolute',
    top: '50%',
    transform: 'translateY(-50%)',
    background: 'rgba(255, 255, 255, 0.1)',
    backdropFilter: 'blur(10px)',
    border: 'none',
    color: '#fff',
    width: '56px',
    height: '56px',
    borderRadius: '50%',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    transition: 'all 0.25s ease',
    zIndex: 5,
  },
  infoPanel: {
    width: '320px',
    height: '100%',
    background: 'rgba(20, 22, 28, 0.96)',
    backdropFilter: 'blur(20px)',
    borderLeft: '1px solid rgba(255, 255, 255, 0.1)',
    display: 'flex',
    flexDirection: 'column',
    zIndex: 20,
    color: '#fff',
  },
  infoPanelHeader: {
    height: '64px',
    minHeight: '64px',
    padding: '0 20px',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
  },
  infoPanelContent: {
    padding: '20px',
    display: 'flex',
    flexDirection: 'column',
    gap: '16px',
    overflowY: 'auto',
  },
  infoRow: {
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
  },
  infoLabel: {
    fontSize: '11px',
    color: 'rgba(255, 255, 255, 0.45)',
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
  },
  infoVal: {
    fontSize: '14px',
    fontWeight: 500,
    color: 'rgba(255, 255, 255, 0.9)',
    wordBreak: 'break-all',
  },
};
