import React from 'react';
import { Cloud, Folder, Trash2, FileText, Check, AlertCircle } from 'lucide-react';
import { fmtBytes } from '../../utils/format';
import FieldInput from '../ui/FieldInput';
import { BtnFill, BtnTonal } from '../ui/Button';
import {
  StopAutoBackup, StartAutoBackup, SaveSyncSettings, AddSyncTask,
  RemoveSyncTask, ToggleSyncTask, OpenDirectoryDialog
} from '../../../wailsjs/go/main/App';

interface SyncManagerProps {
  lang: string;
  t: any;
  backupActive: boolean;
  setBackupActive: (b: boolean) => void;
  syncTasks: any[];
  loadSettings: () => Promise<void>;
  syncMode: string;
  setSyncMode: (m: string) => void;
  syncIntervalVal: number;
  setSyncIntervalVal: (i: number) => void;
  newBackupFolder: string;
  setNewBackupFolder: (f: string) => void;
  newBackupDest: string;
  setNewBackupDest: (d: string) => void;
  availableFolders: any[];
  currentFolder: any;
  syncActivities: Record<string, { name: string; action: string; status: string; size: number; time: number }>;
  addToast: (msg: string, type?: string) => void;
  showConfirm: (title: string, message: string, onConfirm: () => void, danger?: boolean) => void;
  closeConfirm: () => void;
}

export default function SyncManager({
  lang,
  t,
  backupActive,
  setBackupActive,
  syncTasks,
  loadSettings,
  syncMode,
  setSyncMode,
  syncIntervalVal,
  setSyncIntervalVal,
  newBackupFolder,
  setNewBackupFolder,
  newBackupDest,
  setNewBackupDest,
  availableFolders,
  currentFolder,
  syncActivities,
  addToast,
  showConfirm,
  closeConfirm
}: SyncManagerProps) {

  const doAddSyncTask = async () => {
    if (!newBackupFolder) {
      addToast(lang === 'id' ? 'Pilih folder lokal terlebih dahulu' : 'Select a local folder first', 'error');
      return;
    }
    if (!newBackupDest) {
      addToast(lang === 'id' ? 'Isi ID Folder tujuan' : 'Enter Destination Folder ID', 'error');
      return;
    }
    try {
      const r = await AddSyncTask(newBackupFolder, newBackupDest);
      if (r.success) {
        addToast(lang === 'id' ? 'Tugas sinkronisasi ditambahkan ✓' : 'Sync task added ✓');
        setNewBackupFolder('');
        setNewBackupDest('');
        await loadSettings();
      } else {
        addToast(r.error || 'Failed', 'error');
      }
    } catch (e) {
      addToast(String(e), 'error');
    }
  };

  const doRemoveSyncTask = async (id: string) => {
    try {
      const r = await RemoveSyncTask(id);
      if (r.success) {
        addToast(lang === 'id' ? 'Tugas sinkronisasi dihapus' : 'Sync task removed');
        await loadSettings();
      } else {
        addToast(r.error || 'Failed', 'error');
      }
    } catch (e) {
      addToast(String(e), 'error');
    }
  };

  const doToggleSyncTask = async (id: string, enabled: boolean) => {
    try {
      const r = await ToggleSyncTask(id, enabled);
      if (r.success) {
        await loadSettings();
      } else {
        addToast(r.error || 'Failed', 'error');
      }
    } catch (e) {
      addToast(String(e), 'error');
    }
  };

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(380px, 1fr))', gap: 28, minHeight: '100%', color: 'var(--md-on-surface)', alignItems: 'start' }}>
      {/* Left Pane: Config & Task Manager */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
        {/* Header status card */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '16px 20px', borderRadius: 16,
          background: backupActive ? 'rgba(24,128,56,0.08)' : 'var(--md-surface-container-high)',
          border: `1.5px solid ${backupActive ? '#188038' : 'var(--md-outline-variant)'}`,
        }}>
          <div>
            <h3 style={{ fontSize: 15, fontWeight: 700, color: 'var(--md-on-surface)' }}>
              {lang === 'id' ? 'Status Sinkronisasi' : 'Sync Status'}
            </h3>
            <p style={{ fontSize: 13, color: 'var(--md-on-surface-variant)', marginTop: 2 }}>
              {backupActive ? (lang === 'id' ? 'Penyelarasan aktif berjalan' : 'Background sync is running') : (lang === 'id' ? 'Penyelarasan tidak aktif' : 'Sync is disabled')}
            </p>
          </div>
          <button
            onClick={async () => {
              if (backupActive) {
                await StopAutoBackup();
                setBackupActive(false);
                addToast(t.backupStopped);
              } else {
                if (syncTasks.length === 0) {
                  addToast(lang === 'id' ? 'Tambahkan folder sinkronisasi terlebih dahulu' : 'Add a sync folder first', 'error');
                  return;
                }
                const r = await StartAutoBackup("", "");
                if (r.success) {
                  setBackupActive(true);
                  addToast(t.autoBackupStarted);
                } else {
                  addToast(r.error || 'Failed', 'error');
                }
              }
            }}
            style={{
              padding: '8px 22px', borderRadius: 100, border: 'none', cursor: 'pointer',
              fontSize: 13, fontWeight: 600, fontFamily: 'Google Sans,sans-serif',
              background: backupActive ? 'var(--md-error)' : 'var(--md-primary)',
              color: backupActive ? 'var(--md-on-error)' : 'var(--md-on-primary)',
              transition: 'all .15s',
              boxShadow: '0 2px 6px rgba(0,0,0,.1)',
            }}
            onMouseEnter={e => e.currentTarget.style.opacity = '0.9'}
            onMouseLeave={e => e.currentTarget.style.opacity = '1'}
          >
            {backupActive ? t.stopBackupBtn.replace('⏹ ', '') : t.startAutoBackupBtn.replace('▶ ', '')}
          </button>
        </div>

        {/* Sync Options Card */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16, padding: 20, borderRadius: 16, background: 'var(--md-surface-container-low)', border: '1px solid var(--md-outline-variant)' }}>
          <h4 style={{ fontSize: 14, fontWeight: 700, color: 'var(--md-on-surface-variant)', borderBottom: '1px solid var(--md-outline-variant)', paddingBottom: 8, margin: 0 }}>
            {lang === 'id' ? 'Konfigurasi Utama' : 'General Configuration'}
          </h4>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--md-on-surface-variant)' }}>{t.syncMode}</span>
            <select
              value={syncMode}
              onChange={e => setSyncMode(e.target.value)}
              style={{
                padding: '10px 14px', borderRadius: 8, border: '1.5px solid var(--md-outline)',
                background: 'var(--md-surface-container)', color: 'var(--md-on-surface)',
                fontSize: 13, outline: 'none', cursor: 'pointer', width: '100%',
              }}
            >
              <option value="one-way">{t.oneWay}</option>
              <option value="two-way">{t.twoWay}</option>
            </select>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 4 }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--md-on-surface-variant)' }}>{t.syncInterval}</span>
            <input
              type="number" min="10" max="3600" step="10"
              value={syncIntervalVal}
              onChange={e => setSyncIntervalVal(Number(e.target.value))}
              style={{
                padding: '10px 14px', borderRadius: 8, border: '1.5px solid var(--md-outline)',
                background: 'var(--md-surface-container)', color: 'var(--md-on-surface)',
                fontSize: 13, outline: 'none', width: '100%', boxSizing: 'border-box'
              }}
            />
          </div>

          <button
            onClick={async () => {
              const r = await SaveSyncSettings(syncMode, syncIntervalVal);
              if (r.success) addToast(t.syncSettingsSaved);
              else addToast(r.error || 'Error', 'error');
            }}
            style={{
              width: '100%', padding: '11px', borderRadius: 100,
              border: 'none', background: 'var(--md-primary)',
              color: 'var(--md-on-primary)', fontFamily: 'Google Sans,sans-serif',
              fontSize: 13, fontWeight: 600, cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
              transition: 'filter .15s', marginTop: 12,
            }}
            onMouseEnter={e => e.currentTarget.style.filter = 'brightness(1.1)'}
            onMouseLeave={e => e.currentTarget.style.filter = 'none'}
          >
            {t.saveSettings}
          </button>
        </div>

        {/* Sync Task Mappings Card */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16, padding: 20, borderRadius: 16, background: 'var(--md-surface-container-low)', border: '1px solid var(--md-outline-variant)' }}>
          <h4 style={{ fontSize: 14, fontWeight: 700, color: 'var(--md-on-surface-variant)', borderBottom: '1px solid var(--md-outline-variant)', paddingBottom: 8, margin: 0 }}>
            {lang === 'id' ? 'Daftar Folder Sinkronisasi' : 'Synced Folders'}
          </h4>
          
          {syncTasks.length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, maxHeight: 220, overflowY: 'auto', paddingRight: 4 }}>
              {syncTasks.map(task => (
                <div 
                  key={task.id} 
                  style={{
                    display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px',
                    border: '1px solid var(--md-outline-variant)', borderRadius: 12,
                    background: 'var(--md-surface-container-lowest)'
                  }}
                >
                  <div style={{
                    width: 36, height: 36, borderRadius: '50%', background: 'var(--md-secondary-container)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--md-primary)',
                    flexShrink: 0
                  }}>
                    <Folder size={18}/>
                  </div>
                  <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 4 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: 'var(--md-on-surface)' }}>
                      <span style={{ fontWeight: 600, color: 'var(--md-primary)', flexShrink: 0 }}>{lang === 'id' ? 'Lokal :' : 'Local :'}</span>
                      <span style={{ textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }} title={task.localPath}>
                        {task.localPath.split('\\').pop().split('/').pop() || task.localPath}
                      </span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: 'var(--md-on-surface)' }}>
                      <span style={{ fontWeight: 600, color: '#188038', flexShrink: 0 }}>Cloud :</span>
                      <span style={{ textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
                        {availableFolders.find(f => String(f.id) === String(task.destChatId))?.name || task.destChatId}
                      </span>
                    </div>
                  </div>
                  {/* Toggle */}
                  <button
                    onClick={() => {
                      if (task.enabled) {
                        showConfirm(
                          lang === 'id' ? 'Nonaktifkan Sinkronisasi?' : 'Disable Sync?',
                          lang === 'id' ? 'Anda yakin ingin menjeda sinkronisasi untuk folder ini? Proses unggah atau unduh untuk folder ini akan dihentikan sementara.' : 'Are you sure you want to pause syncing for this folder? Uploads and downloads for this folder will be suspended.',
                          () => {
                            closeConfirm();
                            doToggleSyncTask(task.id, false);
                          },
                          false
                        );
                      } else {
                        doToggleSyncTask(task.id, true);
                      }
                    }}
                    style={{
                      width: 34, height: 20, borderRadius: 10, border: 'none', cursor: 'pointer',
                      background: task.enabled ? 'var(--md-primary)' : 'var(--md-outline)',
                      position: 'relative', transition: 'background .2s', flexShrink: 0,
                    }}
                  >
                    <div style={{
                      width: 14, height: 14, borderRadius: '50%', background: 'white',
                      position: 'absolute', top: 3, left: task.enabled ? 17 : 3,
                      transition: 'left .2s', boxShadow: '0 1px 3px rgba(0,0,0,.2)',
                    }}/>
                  </button>
                  {/* Delete */}
                  <button
                    onClick={() => {
                      showConfirm(
                        lang === 'id' ? 'Hapus Folder Sinkronisasi' : 'Remove Sync Folder',
                        lang === 'id' ? 'Anda yakin ingin menghapus folder ini dari daftar sinkronisasi?' : 'Are you sure you want to remove this folder from sync?',
                        () => {
                          closeConfirm();
                          doRemoveSyncTask(task.id);
                        },
                        true
                      );
                    }}
                    style={{
                      border: 'none', background: 'transparent', color: 'var(--md-error)',
                      cursor: 'pointer', padding: 4, borderRadius: '50%', display: 'flex',
                      alignItems: 'center', justifyContent: 'center', transition: 'background .15s',
                    }}
                    onMouseEnter={e => e.currentTarget.style.background = 'rgba(179,38,30,0.08)'}
                    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                  >
                    <Trash2 size={16}/>
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <p style={{ fontSize: 13, color: 'var(--md-on-surface-variant)', textAlign: 'center', margin: '12px 0', fontStyle: 'italic' }}>
              {lang === 'id' ? 'Belum ada folder sinkronisasi' : 'No sync folders configured'}
            </p>
          )}
        </div>

        {/* Add sync task card */}
        <div style={{ border: '1px dashed var(--md-outline-variant)', borderRadius: 16, padding: 20, background: 'var(--md-surface-container-lowest)', display: 'flex', flexDirection: 'column', gap: 14 }}>
          <h4 style={{ fontSize: 14, fontWeight: 700, color: 'var(--md-on-surface)', margin: 0 }}>
            {lang === 'id' ? 'Tambah Folder Sinkronisasi Baru' : 'Add New Sync Folder'}
          </h4>
          <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end' }}>
            <div style={{ flex: 1 }}>
              <FieldInput 
                label={lang === 'id' ? 'Folder Lokal' : 'Local Folder'} 
                value={newBackupFolder} 
                onChange={() => {}} 
                placeholder={lang === 'id' ? 'Pilih folder lokal' : 'Select local folder'} 
                readOnly
              />
            </div>
            <BtnTonal 
              onClick={async () => { 
                const d = await OpenDirectoryDialog(); 
                if (d) setNewBackupFolder(d); 
              }} 
              style={{ height: 40, whiteSpace: 'nowrap' }}
            >
              Browse
            </BtnTonal>
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4, flex: 1 }}>
              <label style={{ fontSize: 12, fontWeight: 500, color: 'var(--md-on-surface-variant)' }}>
                {lang === 'id' ? 'Folder Tujuan (Cloud)' : 'Destination Folder (Cloud)'}
              </label>
              <select
                value={newBackupDest}
                onChange={e => setNewBackupDest(e.target.value)}
                style={{
                  width: '100%', padding: '10px 12px', borderRadius: 8, border: '1.5px solid var(--md-outline)',
                  background: 'var(--md-surface-container)', color: 'var(--md-on-surface)',
                  fontSize: 13, outline: 'none', cursor: 'pointer', height: 40,
                }}
              >
                <option value="">{lang === 'id' ? '-- Pilih Folder --' : '-- Select Folder --'}</option>
                {availableFolders.map(f => (
                  <option key={f.id} value={f.id}>{f.name}</option>
                ))}
              </select>
            </div>
            {currentFolder && (
              <BtnTonal onClick={() => setNewBackupDest(String(currentFolder.id))} style={{ height: 40, whiteSpace: 'nowrap' }}>
                {lang === 'id' ? 'Gunakan Aktif' : 'Use Active'}
              </BtnTonal>
            )}
          </div>
          <BtnFill onClick={doAddSyncTask} style={{ width: '100%', marginTop: 4, height: 40 }}>
            {lang === 'id' ? 'Tambah ke Sinkronisasi' : 'Add to Sync'}
          </BtnFill>
        </div>
      </div>

      {/* Right Pane: Sync Activity */}
      <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: 'var(--md-surface-container-low)', borderRadius: 16, border: '1px solid var(--md-outline-variant)', padding: 20, overflow: 'hidden' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 4 }}>
          <Cloud size={24} color={Object.values(syncActivities).some(x => x.status === 'uploading') ? 'var(--md-primary)' : '#188038'} />
          <span style={{ fontSize: 18, fontWeight: 700, fontFamily: 'Google Sans,sans-serif' }}>
            {lang === 'id' ? 'Aktivitas Penyelarasan' : 'Sync Activity'}
          </span>
        </div>
        <div style={{ fontSize: 13, color: 'var(--md-on-surface-variant)', marginLeft: 36, marginBottom: 20 }}>
          {Object.values(syncActivities).some(x => x.status === 'uploading') 
            ? t.backupRunning
            : t.syncedJustNow}
        </div>
        
        {Object.keys(syncActivities).length > 0 && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 90px 70px', gap: 12, padding: '0 16px 12px 16px', borderBottom: '1px solid var(--md-outline-variant)', fontSize: 13, fontWeight: 600, color: 'var(--md-on-surface-variant)' }}>
            <span>{t.name}</span>
            <span>{t.fileSize}</span>
            <span style={{ textAlign: 'right' }}>{t.status}</span>
          </div>
        )}
        
        {Object.keys(syncActivities).length === 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', flex: 1, gap: 16, marginTop: 40 }}>
            <Cloud size={64} color="var(--md-primary)" style={{ opacity: 0.4 }} />
            <p style={{ fontSize: 14, color: 'var(--md-on-surface-variant)', textAlign: 'center', maxWidth: 280, lineHeight: 1.5 }}>
              {t.syncEmpty}
            </p>
          </div>
        ) : (
          <div style={{ overflowY: 'auto', paddingRight: 4, flex: 1, marginTop: 8 }}>
            {Object.values(syncActivities).sort((a, b) => b.time - a.time).map(act => (
              <div 
                key={act.name} 
                style={{ display: 'grid', gridTemplateColumns: '1fr 90px 70px', gap: 12, alignItems: 'center', padding: '12px 16px', borderBottom: '1px solid var(--md-outline-variant)' }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, overflow: 'hidden' }}>
                  <FileText size={20} color="var(--md-on-surface-variant)" style={{ flexShrink: 0 }} />
                  <div style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                    <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--md-on-surface)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{act.name}</span>
                    <span style={{ fontSize: 11, color: 'var(--md-on-surface-variant)' }}>
                      {act.action === 'download'
                        ? (act.status === 'uploading' ? (lang === 'id' ? 'Mengunduh...' : 'Downloading...') : act.status === 'success' ? (lang === 'id' ? 'Berhasil diunduh' : 'Download successful') : (lang === 'id' ? 'Gagal mengunduh' : 'Download failed'))
                        : (act.status === 'uploading' ? t.uploadingStatus : act.status === 'success' ? t.uploadSuccess : t.uploadFailedStatus)
                      }
                    </span>
                  </div>
                </div>
                <div style={{ fontSize: 13, color: 'var(--md-on-surface-variant)' }}>{act.size > 0 ? fmtBytes(act.size) : '–'}</div>
                <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center' }}>
                  {act.status === 'uploading' ? (
                     <div style={{ width: 16, height: 16, borderRadius: '50%', border: '2px solid var(--md-primary)', borderTopColor: 'transparent', animation: 'spin 1s linear infinite' }}/>
                  ) : act.status === 'success' ? (
                     <Check size={18} color="#188038" strokeWidth={2.5} />
                  ) : (
                     <AlertCircle size={18} color="var(--md-error)" strokeWidth={2.5} />
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
