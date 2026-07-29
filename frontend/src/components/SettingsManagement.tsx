import React, { useState } from 'react';
import { 
  HardDrive, RefreshCw, Monitor, 
  Globe, Download, Upload, Sliders
} from 'lucide-react';
import VirtualDriveManagement from './VirtualDriveManagement';
import SyncManager from './features/SyncManager';
import { SetStartup, SetMinimizeToTray, ClearCache, ExportManifest, ImportManifest } from '../../wailsjs/go/main/App';

interface SettingsManagementProps {
  lang: string;
  setLang: (v: string) => void;
  t: any;
  startupEnabled: boolean;
  setStartupEnabled: (v: boolean) => void;
  minimizeToTray: boolean;
  setMinimizeToTray: (v: boolean) => void;
  addToast: (msg: string, type?: 'info' | 'error') => void;
  fetchFiles: () => void;
  initialTab?: string;
  // SyncManager & Dialog Props
  backupActive: boolean;
  setBackupActive: (v: boolean) => void;
  syncTasks: any[];
  loadSettings: () => Promise<void>;
  syncMode: string;
  setSyncMode: (v: string) => void;
  syncIntervalVal: number;
  setSyncIntervalVal: (v: number) => void;
  newBackupFolder: string;
  setNewBackupFolder: (v: string) => void;
  newBackupDest: string;
  setNewBackupDest: (v: string) => void;
  availableFolders: any[];
  currentFolder: any;
  syncActivities: Record<string, any>;
  showConfirm: (title: string, message: string, onConfirm: () => void, isDangerous?: boolean) => void;
  closeConfirm: () => void;
}

export default function SettingsManagement({
  lang,
  setLang,
  t,
  startupEnabled,
  setStartupEnabled,
  minimizeToTray,
  setMinimizeToTray,
  addToast,
  fetchFiles,
  initialTab = 'general',
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
  showConfirm,
  closeConfirm
}: SettingsManagementProps) {
  const [activeTab, setActiveTab] = useState(initialTab);

  return (
    <div style={{ maxWidth: 960, margin: '0 auto', paddingBottom: 40 }}>
      {/* Header Title & Subtitle */}
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, margin: 0, color: 'var(--md-on-surface)' }}>
          {lang === 'id' ? 'Pengaturan Aplikasi' : 'Application Settings'}
        </h1>
        <p style={{ fontSize: 13, color: 'var(--md-on-surface-variant)', margin: '4px 0 0' }}>
          {lang === 'id' 
            ? 'Kelola preferensi umum, mount virtual drive letter, dan sinkronisasi otomatis.' 
            : 'Manage general preferences, virtual drive letter mounting, and background sync.'}
        </p>
      </div>

      {/* Tabs Navigation */}
      <div style={{
        display: 'flex', gap: 8, marginBottom: 24, borderBottom: '1px solid var(--md-outline-variant)',
        paddingBottom: 2
      }}>
        {[
          { key: 'general', icon: <Sliders size={18} />, label: lang === 'id' ? 'Umum & Sistem' : 'General & System' },
          { key: 'mountdrive', icon: <HardDrive size={18} />, label: lang === 'id' ? 'Mount Virtual Drive' : 'Mount Virtual Drive' },
          { key: 'sync', icon: <RefreshCw size={18} />, label: lang === 'id' ? 'Sinkronisasi Otomatis' : 'Auto Sync' },
        ].map(tab => {
          const isActive = activeTab === tab.key;
          return (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              style={{
                display: 'flex', alignItems: 'center', gap: 8, padding: '10px 18px',
                borderRadius: '12px 12px 0 0', border: 'none', cursor: 'pointer',
                fontFamily: 'Google Sans, sans-serif', fontSize: 14, fontWeight: isActive ? 600 : 500,
                background: isActive ? 'var(--md-secondary-container, #d3e3fd)' : 'transparent',
                color: isActive ? 'var(--md-on-secondary-container, #041e49)' : 'var(--md-on-surface-variant)',
                borderBottom: isActive ? '3px solid var(--md-primary, #3b82f6)' : '3px solid transparent',
                transition: 'all 0.15s ease'
              }}
            >
              {tab.icon}
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Tab 1: General Settings */}
      {activeTab === 'general' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          {/* Language Selection */}
          <div style={{
            background: 'var(--md-surface-container-low, #f0f4f9)',
            border: '1px solid var(--md-outline-variant, #c4c6d0)',
            borderRadius: 16, padding: 20
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <h3 style={{ fontSize: 15, fontWeight: 600, margin: 0, color: 'var(--md-on-surface)', display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Globe size={18} /> {t.language}
                </h3>
                <p style={{ fontSize: 12, color: 'var(--md-on-surface-variant)', margin: '4px 0 0' }}>
                  {lang === 'id' ? 'Pilih bahasa tampilan antarmuka TeleDrive.' : 'Select TeleDrive UI display language.'}
                </p>
              </div>
              <select
                value={lang}
                onChange={e => setLang(e.target.value)}
                style={{
                  padding: '8px 16px', borderRadius: 10, border: '1px solid var(--md-outline-variant)',
                  background: 'var(--md-surface, #fff)', color: 'var(--md-on-surface)', fontSize: 14, outline: 'none', cursor: 'pointer'
                }}
              >
                <option value="id">Bahasa Indonesia</option>
                <option value="en">English</option>
              </select>
            </div>
          </div>

          {/* System Options */}
          <div style={{
            background: 'var(--md-surface-container-low, #f0f4f9)',
            border: '1px solid var(--md-outline-variant, #c4c6d0)',
            borderRadius: 16, padding: 20
          }}>
            <h3 style={{ fontSize: 15, fontWeight: 600, margin: '0 0 16px 0', color: 'var(--md-on-surface)', display: 'flex', alignItems: 'center', gap: 8 }}>
              <Monitor size={18} /> {t.system}
            </h3>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <div>
                <p style={{ fontSize: 14, fontWeight: 500, color: 'var(--md-on-surface)', margin: 0 }}>
                  {t.startWithWindows}
                </p>
                <p style={{ fontSize: 12, color: 'var(--md-on-surface-variant)', margin: '2px 0 0' }}>
                  {t.launchOnLogin}
                </p>
              </div>
              <button
                onClick={async () => {
                  const next = !startupEnabled;
                  const r = await SetStartup(next);
                  if (r.success) {
                    setStartupEnabled(next);
                    addToast(next ? t.startupEnabled : t.startupDisabled);
                  } else {
                    addToast(r.error || 'Gagal', 'error');
                  }
                }}
                style={{
                  width: 48, height: 26, borderRadius: 13, border: 'none', cursor: 'pointer',
                  background: startupEnabled ? 'var(--md-primary, #3b82f6)' : 'var(--md-surface-variant, #e1e2ec)',
                  position: 'relative', flexShrink: 0, transition: 'background .2s'
                }}
              >
                <div style={{
                  width: 20, height: 20, borderRadius: '50%', background: 'white',
                  position: 'absolute', top: 3, left: startupEnabled ? 25 : 3,
                  transition: 'left .2s', boxShadow: '0 1px 4px rgba(0,0,0,.2)'
                }} />
              </button>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <p style={{ fontSize: 14, fontWeight: 500, color: 'var(--md-on-surface)', margin: 0 }}>
                  {t.minimizeToTray}
                </p>
                <p style={{ fontSize: 12, color: 'var(--md-on-surface-variant)', margin: '2px 0 0' }}>
                  {t.minimizeToTrayDesc}
                </p>
              </div>
              <button
                onClick={async () => {
                  const next = !minimizeToTray;
                  setMinimizeToTray(next);
                  await SetMinimizeToTray(next);
                  addToast(next ? t.minimizeEnabled : t.minimizeDisabled);
                }}
                style={{
                  width: 48, height: 26, borderRadius: 13, border: 'none', cursor: 'pointer',
                  background: minimizeToTray ? 'var(--md-primary, #3b82f6)' : 'var(--md-surface-variant, #e1e2ec)',
                  position: 'relative', flexShrink: 0, transition: 'background .2s'
                }}
              >
                <div style={{
                  width: 20, height: 20, borderRadius: '50%', background: 'white',
                  position: 'absolute', top: 3, left: minimizeToTray ? 25 : 3,
                  transition: 'left .2s', boxShadow: '0 1px 4px rgba(0,0,0,.2)'
                }} />
              </button>
            </div>
          </div>

          {/* Cache Cleaning with Dangerous Action Confirmation */}
          <div style={{
            background: 'var(--md-surface-container-low, #f0f4f9)',
            border: '1px solid var(--md-outline-variant, #c4c6d0)',
            borderRadius: 16, padding: 20
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <h3 style={{ fontSize: 15, fontWeight: 600, margin: 0, color: 'var(--md-on-surface)' }}>
                  {t.clearCache}
                </h3>
                <p style={{ fontSize: 12, color: 'var(--md-on-surface-variant)', margin: '4px 0 0' }}>
                  {t.clearThumbCache}
                </p>
              </div>
              <button
                onClick={() => {
                  showConfirm(
                    t.clearCacheConfirmTitle || (lang === 'id' ? 'Bersihkan Cache' : 'Clear Cache'),
                    t.clearCacheConfirmMsg || (lang === 'id' ? 'Apakah Anda yakin ingin membersihkan cache thumbnail dan berkas lokal?' : 'Clear local cache files and thumbnails?'),
                    async () => {
                      closeConfirm();
                      try {
                        const r = await ClearCache();
                        addToast(r.message || t.cacheCleared);
                      } catch (e) {
                        addToast(String(e), 'error');
                      }
                    },
                    true
                  );
                }}
                style={{
                  display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px', borderRadius: 100,
                  border: '1px solid var(--md-outline-variant)', background: 'var(--md-surface, #fff)',
                  color: 'var(--md-on-surface)', fontSize: 13, fontWeight: 500, cursor: 'pointer'
                }}
              >
                <RefreshCw size={14} /> {t.clearCacheBtn}
              </button>
            </div>
          </div>

          {/* Metadata Backup with Dangerous Action Confirmation */}
          <div style={{
            background: 'var(--md-surface-container-low, #f0f4f9)',
            border: '1px solid var(--md-outline-variant, #c4c6d0)',
            borderRadius: 16, padding: 20
          }}>
            <div style={{ marginBottom: 14 }}>
              <h3 style={{ fontSize: 15, fontWeight: 600, margin: 0, color: 'var(--md-on-surface)' }}>
                {lang === 'id' ? 'Cadangan Metadata' : 'Metadata Backup'}
              </h3>
              <p style={{ fontSize: 12, color: 'var(--md-on-surface-variant)', margin: '4px 0 0' }}>
                {lang === 'id'
                  ? 'Ekspor atau impor struktur folder & pemetaan file (.json).'
                  : 'Export or import folder structure & file mappings (.json).'}
              </p>
            </div>
            <div style={{ display: 'flex', gap: 12 }}>
              <button
                onClick={async () => {
                  try {
                    const r = await ExportManifest();
                    if (r && r.success) {
                      addToast(lang === 'id' ? 'Cadangan Metadata berhasil diekspor!' : 'Metadata backup exported successfully!');
                    } else if (r && r.error && r.error !== 'Batal menyimpan file') {
                      addToast(r.error, 'error');
                    }
                  } catch (e) {
                    addToast(String(e), 'error');
                  }
                }}
                style={{
                  flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                  padding: '10px 16px', borderRadius: 12, border: '1px solid var(--md-outline-variant)',
                  background: 'var(--md-surface, #fff)', color: 'var(--md-on-surface)',
                  fontSize: 13, fontWeight: 600, cursor: 'pointer'
                }}
              >
                <Download size={16} /> {lang === 'id' ? 'Ekspor Cadangan' : 'Export Backup'}
              </button>

              <button
                onClick={() => {
                  showConfirm(
                    t.importBackupConfirmTitle || (lang === 'id' ? 'Pulihkan Cadangan Metadata' : 'Restore Metadata Backup'),
                    t.importBackupConfirmMsg || (lang === 'id' ? 'Memulihkan cadangan metadata akan memperbarui struktur folder dan pemetaan berkas. Lanjutkan?' : 'Importing metadata will update your folder structure. Continue?'),
                    async () => {
                      closeConfirm();
                      try {
                        const r = await ImportManifest();
                        if (r && r.success) {
                          addToast(lang === 'id' ? 'Cadangan Metadata berhasil dipulihkan!' : 'Metadata backup restored successfully!');
                          fetchFiles();
                        } else if (r && r.error && r.error !== 'Batal memilih file') {
                          addToast(r.error, 'error');
                        }
                      } catch (e) {
                        addToast(String(e), 'error');
                      }
                    },
                    true
                  );
                }}
                style={{
                  flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                  padding: '10px 16px', borderRadius: 12, border: '1px solid var(--md-outline-variant)',
                  background: 'var(--md-surface, #fff)', color: 'var(--md-on-surface)',
                  fontSize: 13, fontWeight: 600, cursor: 'pointer'
                }}
              >
                <Upload size={16} /> {lang === 'id' ? 'Impor Cadangan' : 'Import Backup'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Tab 2: Virtual Drive Mount */}
      {activeTab === 'mountdrive' && (
        <VirtualDriveManagement lang={lang} t={t} showConfirm={showConfirm} closeConfirm={closeConfirm} />
      )}

      {/* Tab 3: Sync Manager */}
      {activeTab === 'sync' && (
        <SyncManager
          lang={lang}
          t={t}
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
          addToast={addToast}
          showConfirm={showConfirm}
          closeConfirm={closeConfirm}
        />
      )}
    </div>
  );
}
