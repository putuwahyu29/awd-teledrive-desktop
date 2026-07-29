import React, { useState, useEffect } from 'react';
import { HardDrive, Wifi, Play, Square, ExternalLink } from 'lucide-react';
import {
  GetVirtualDriveStatus,
  MountVirtualDrive,
  UnmountVirtualDrive,
  StartNativeWebDAVServer,
  StopNativeWebDAVServer,
  SetAutoMountOnStartup,
  GetMountedVirtualDrives,
  GetLocalIPAddress
} from '../../wailsjs/go/main/App';

interface VirtualDriveManagementProps {
  lang: string;
  t?: any;
  showConfirm?: (title: string, message: string, onConfirm: () => void, isDangerous?: boolean) => void;
  closeConfirm?: () => void;
}

export default function VirtualDriveManagement({ lang, t, showConfirm, closeConfirm }: VirtualDriveManagementProps) {
  const [status, setStatus] = useState<any>(null);
  const [mountedDrives, setMountedDrives] = useState<any[]>([]);
  const [selectedLetter, setSelectedLetter] = useState('Z:');
  const [loading, setLoading] = useState(false);
  const [webdavPort, setWebdavPort] = useState(8085);
  const [webdavPass, setWebdavPass] = useState('');
  const [webdavUrl, setWebdavUrl] = useState('');
  const [localIp, setLocalIp] = useState('127.0.0.1');
  const [autoMount, setAutoMount] = useState(false);
  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  const fetchStatus = async () => {
    try {
      const st = await GetVirtualDriveStatus();
      setStatus(st);
      if (st.availableDrives && st.availableDrives.length > 0) {
        setSelectedLetter(st.availableDrives[0]);
      }
      setAutoMount(st.autoMountOnStart || false);
      if (st.autoMountLetter) {
        setSelectedLetter(st.autoMountLetter);
      }
      if (st.webdavPassword) {
        setWebdavPass(st.webdavPassword);
      }

      const mounted = await GetMountedVirtualDrives();
      setMountedDrives(mounted || []);

      const ip = await GetLocalIPAddress();
      setLocalIp(ip || '127.0.0.1');
      if (st.webdavRunning) {
        setWebdavUrl(`http://${ip || '127.0.0.1'}:${st.webdavServerPort || 8085}/`);
      }
    } catch (err) {
      console.error('Failed to get Virtual Drive status:', err);
    }
  };

  useEffect(() => {
    fetchStatus();
    const interval = setInterval(fetchStatus, 5000);
    return () => clearInterval(interval);
  }, []);

  const handleMount = async () => {
    setLoading(true);
    setMessage(null);
    try {
      await MountVirtualDrive('0', selectedLetter);
      setMessage({
        text: lang === 'id'
          ? `Drive ${selectedLetter} berhasil di-mount!`
          : `Drive ${selectedLetter} successfully mounted!`,
        type: 'success'
      });
      await fetchStatus();
    } catch (err: any) {
      setMessage({
        text: (lang === 'id' ? 'Gagal mount drive: ' : 'Failed to mount drive: ') + (err?.message || err),
        type: 'error'
      });
    } finally {
      setLoading(false);
    }
  };

  const executeUnmount = async (letter: string) => {
    setLoading(true);
    setMessage(null);
    try {
      await UnmountVirtualDrive(letter);
      setMessage({
        text: lang === 'id'
          ? `Drive ${letter} berhasil di-unmount.`
          : `Drive ${letter} successfully unmounted.`,
        type: 'success'
      });
      await fetchStatus();
    } catch (err: any) {
      setMessage({
        text: (lang === 'id' ? 'Gagal unmount: ' : 'Failed to unmount: ') + (err?.message || err),
        type: 'error'
      });
    } finally {
      setLoading(false);
    }
  };

  const handleUnmount = (letter: string) => {
    const title = t?.unmountConfirmTitle || (lang === 'id' ? 'Lepas Drive' : 'Unmount Drive');
    const msg = t?.unmountConfirmMsg ? t.unmountConfirmMsg(letter) : (lang === 'id' ? `Apakah Anda yakin ingin melepas Drive ${letter}?` : `Unmount drive ${letter}?`);

    if (showConfirm) {
      showConfirm(title, msg, () => {
        if (closeConfirm) closeConfirm();
        executeUnmount(letter);
      }, true);
    } else {
      executeUnmount(letter);
    }
  };

  const executeStartWebDAV = async () => {
    setLoading(true);
    setMessage(null);
    try {
      const url = await StartNativeWebDAVServer(webdavPort, webdavPass);
      setWebdavUrl(url);
      setMessage({
        text: (lang === 'id' ? 'Server WebDAV Wi-Fi berjalan pada: ' : 'WebDAV Wi-Fi Server running on: ') + url,
        type: 'success'
      });
      await fetchStatus();
    } catch (err: any) {
      setMessage({
        text: (lang === 'id' ? 'Gagal menjalankan WebDAV: ' : 'Failed to start WebDAV: ') + (err?.message || err),
        type: 'error'
      });
    } finally {
      setLoading(false);
    }
  };

  const executeStopWebDAV = async () => {
    setLoading(true);
    setMessage(null);
    try {
      await StopNativeWebDAVServer();
      setWebdavUrl('');
      setMessage({
        text: lang === 'id' ? 'Server WebDAV dihentikan.' : 'WebDAV Server stopped.',
        type: 'success'
      });
      await fetchStatus();
    } catch (err: any) {
      setMessage({
        text: (lang === 'id' ? 'Gagal menghentikan WebDAV: ' : 'Failed to stop WebDAV: ') + (err?.message || err),
        type: 'error'
      });
    } finally {
      setLoading(false);
    }
  };

  const handleToggleWebDAV = () => {
    if (status?.webdavRunning) {
      const title = t?.stopWebdavConfirmTitle || (lang === 'id' ? 'Hentikan Server WebDAV' : 'Stop WebDAV Server');
      const msg = t?.stopWebdavConfirmMsg || (lang === 'id' ? 'Apakah Anda yakin ingin menghentikan Server WebDAV Wi-Fi lokal?' : 'Stop local Wi-Fi WebDAV server?');

      if (showConfirm) {
        showConfirm(title, msg, () => {
          if (closeConfirm) closeConfirm();
          executeStopWebDAV();
        }, true);
      } else {
        executeStopWebDAV();
      }
    } else {
      executeStartWebDAV();
    }
  };

  const handleAutoMountToggle = async (enabled: boolean) => {
    setAutoMount(enabled);
    try {
      await SetAutoMountOnStartup(enabled, selectedLetter);
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div style={{ padding: '24px', maxWidth: 900, margin: '0 auto' }}>
      {/* Title */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
        <div style={{
          width: 44, height: 44, borderRadius: 14, background: 'var(--md-primary-container, #d3e3fd)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--md-on-primary-container, #041e49)'
        }}>
          <HardDrive size={24} />
        </div>
        <div>
          <h2 style={{ fontSize: 20, fontWeight: 700, margin: 0, color: 'var(--md-on-surface)' }}>
            {lang === 'id' ? 'Mount Virtual Drive & Akses Wi-Fi WebDAV' : 'Mount Virtual Drive & WebDAV Wi-Fi Access'}
          </h2>
          <p style={{ fontSize: 13, color: 'var(--md-on-surface-variant)', margin: '2px 0 0' }}>
            {lang === 'id'
              ? 'Petakan berkas Telegram sebagai Drive Letter Windows (Z:) atau bagikan ke perangkat HP/TV melalui jaringan lokal Wi-Fi.'
              : 'Map Telegram cloud files as a native Windows Drive Letter (Z:) or share via local Wi-Fi to phone/TV devices.'}
          </p>
        </div>
      </div>

      {message && (
        <div style={{
          padding: '12px 16px', borderRadius: 12, marginBottom: 20, fontSize: 14, fontWeight: 500,
          background: message.type === 'success' ? 'rgba(34, 197, 94, 0.12)' : 'rgba(239, 68, 68, 0.12)',
          color: message.type === 'success' ? '#16a34a' : '#dc2626',
          border: `1px solid ${message.type === 'success' ? 'rgba(34, 197, 94, 0.3)' : 'rgba(239, 68, 68, 0.3)'}`
        }}>
          {message.text}
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(380px, 1fr))', gap: 20 }}>
        {/* Card 1: Windows Drive Mount */}
        <div style={{
          background: 'var(--md-surface-container-low, #f0f4f9)',
          border: '1px solid var(--md-outline-variant, #c4c6d0)',
          borderRadius: 20, padding: 24
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
            <h3 style={{ fontSize: 16, fontWeight: 600, margin: 0, color: 'var(--md-on-surface)', display: 'flex', alignItems: 'center', gap: 8 }}>
              <HardDrive size={18} />
              {lang === 'id' ? 'Mount Drive Letter (Windows)' : 'Windows Drive Letter Mount'}
            </h3>
            {mountedDrives.length > 0 && (
              <span style={{
                fontSize: 12, fontWeight: 600, padding: '4px 10px', borderRadius: 20,
                background: 'rgba(34, 197, 94, 0.15)', color: '#16a34a'
              }}>
                ● {mountedDrives.length} {lang === 'id' ? 'Drive Aktif' : 'Active Drive'}
              </span>
            )}
          </div>

          <p style={{ fontSize: 13, color: 'var(--md-on-surface-variant)', lineHeight: 1.5, marginBottom: 20 }}>
            {lang === 'id'
              ? 'Buka file Telegram langsung dari File Explorer Windows tanpa perlu mengunduh terlebih dahulu.'
              : 'Access Telegram files directly inside Windows File Explorer without manually downloading them.'}
          </p>

          <div style={{ marginBottom: 16 }}>
            <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--md-on-surface-variant)', display: 'block', marginBottom: 6 }}>
              {lang === 'id' ? 'Pilih Drive Letter:' : 'Select Drive Letter:'}
            </label>
            <select
              value={selectedLetter}
              onChange={e => setSelectedLetter(e.target.value)}
              disabled={loading}
              style={{
                width: '100%', height: 44, borderRadius: 12, border: '1px solid var(--md-outline-variant)',
                background: 'var(--md-surface, #fff)', color: 'var(--md-on-surface)', fontSize: 15, padding: '0 12px', outline: 'none'
              }}
            >
              {status?.availableDrives?.map((d: string) => (
                <option key={d} value={d}>
                  Drive {d} {d === 'Z:' ? (lang === 'id' ? '(Rekomendasi)' : '(Recommended)') : ''}
                </option>
              ))}
            </select>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
            <input
              type="checkbox"
              id="autoMountCheck"
              checked={autoMount}
              onChange={e => handleAutoMountToggle(e.target.checked)}
              style={{ width: 18, height: 18, cursor: 'pointer' }}
            />
            <label htmlFor="autoMountCheck" style={{ fontSize: 13, color: 'var(--md-on-surface)', cursor: 'pointer' }}>
              {lang === 'id' ? 'Otomatis mount drive saat aplikasi dibuka' : 'Auto-mount drive letter on app launch'}
            </label>
          </div>

          <div style={{ display: 'flex', gap: 10 }}>
            <button
              onClick={handleMount}
              disabled={loading}
              style={{
                flex: 1, height: 44, borderRadius: 12, border: 'none',
                background: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)',
                color: '#fff', fontWeight: 600, fontSize: 14, cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                opacity: loading ? 0.7 : 1
              }}
            >
              <Play size={16} />
              {lang === 'id' ? 'Mount Drive Sekarang' : 'Mount Drive Now'}
            </button>
          </div>

          {/* Active Mounts List */}
          {mountedDrives.length > 0 && (
            <div style={{ marginTop: 20, paddingTop: 16, borderTop: '1px solid var(--md-outline-variant)' }}>
              <h4 style={{ fontSize: 13, fontWeight: 600, margin: '0 0 10px', color: 'var(--md-on-surface)' }}>
                {lang === 'id' ? 'Drive Terpasang saat ini:' : 'Currently Mounted Drives:'}
              </h4>
              {mountedDrives.map(m => (
                <div key={m.id} style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: '10px 14px', background: 'var(--md-surface, #fff)', borderRadius: 12,
                  border: '1px solid var(--md-outline-variant)', marginBottom: 8
                }}>
                  <div>
                    <span style={{ fontWeight: 700, color: 'var(--md-primary, #3b82f6)', fontSize: 15 }}>
                      Drive {m.driveLetter}
                    </span>
                    <span style={{ fontSize: 12, color: 'var(--md-on-surface-variant)', marginLeft: 8 }}>
                      ({m.targetName})
                    </span>
                  </div>
                  <button
                    onClick={() => handleUnmount(m.driveLetter)}
                    style={{
                      border: '1px solid #ef4444', background: 'rgba(239,68,68,0.1)', color: '#ef4444',
                      padding: '4px 12px', borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: 'pointer'
                    }}
                  >
                    Unmount
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Card 2: WebDAV Wi-Fi Share */}
        <div style={{
          background: 'var(--md-surface-container-low, #f0f4f9)',
          border: '1px solid var(--md-outline-variant, #c4c6d0)',
          borderRadius: 20, padding: 24
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
            <h3 style={{ fontSize: 16, fontWeight: 600, margin: 0, color: 'var(--md-on-surface)', display: 'flex', alignItems: 'center', gap: 8 }}>
              <Wifi size={18} />
              {lang === 'id' ? 'Server WebDAV Wi-Fi Lokal' : 'Local Wi-Fi WebDAV Server'}
            </h3>
            <span style={{
              fontSize: 12, fontWeight: 600, padding: '4px 10px', borderRadius: 20,
              background: status?.webdavRunning ? 'rgba(34, 197, 94, 0.15)' : 'rgba(148, 163, 184, 0.2)',
              color: status?.webdavRunning ? '#16a34a' : 'var(--md-on-surface-variant)'
            }}>
              ● {status?.webdavRunning ? (lang === 'id' ? 'Server Aktif' : 'Server Running') : (lang === 'id' ? 'Tidak Aktif' : 'Inactive')}
            </span>
          </div>

          <p style={{ fontSize: 13, color: 'var(--md-on-surface-variant)', lineHeight: 1.5, marginBottom: 20 }}>
            {lang === 'id'
              ? 'Nyalakan Server WebDAV untuk mengakses semua berkas cloud Telegram pada HP (iOS/Android), Smart TV, atau VLC lewat Wi-Fi.'
              : 'Enable WebDAV server to stream Telegram media on mobile devices (CX File Explorer, VLC) or Smart TVs over Wi-Fi.'}
          </p>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
            <div>
              <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--md-on-surface-variant)', display: 'block', marginBottom: 6 }}>
                Port Server:
              </label>
              <input
                type="number"
                value={webdavPort}
                onChange={e => setWebdavPort(Number(e.target.value))}
                disabled={status?.webdavRunning || loading}
                style={{
                  width: '100%', height: 44, borderRadius: 12, border: '1px solid var(--md-outline-variant)',
                  background: 'var(--md-surface, #fff)', color: 'var(--md-on-surface)', fontSize: 14, padding: '0 12px', outline: 'none'
                }}
              />
            </div>
            <div>
              <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--md-on-surface-variant)', display: 'block', marginBottom: 6 }}>
                {lang === 'id' ? 'Password / PIN:' : 'PIN Protection:'}
              </label>
              <input
                type="text"
                value={webdavPass}
                onChange={e => setWebdavPass(e.target.value)}
                placeholder="6-Digit PIN"
                disabled={status?.webdavRunning || loading}
                style={{
                  width: '100%', height: 44, borderRadius: 12, border: '1px solid var(--md-outline-variant)',
                  background: 'var(--md-surface, #fff)', color: 'var(--md-on-surface)', fontSize: 14, padding: '0 12px', outline: 'none'
                }}
              />
            </div>
          </div>

          <button
            onClick={handleToggleWebDAV}
            disabled={loading}
            style={{
              width: '100%', height: 44, borderRadius: 12, border: 'none',
              background: status?.webdavRunning ? '#ef4444' : 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
              color: '#fff', fontWeight: 600, fontSize: 14, cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              opacity: loading ? 0.7 : 1
            }}
          >
            {status?.webdavRunning ? <Square size={16} /> : <Play size={16} />}
            {status?.webdavRunning
              ? (lang === 'id' ? 'Hentikan Server WebDAV' : 'Stop WebDAV Server')
              : (lang === 'id' ? 'Jalankan Server WebDAV' : 'Start WebDAV Server')}
          </button>

          {status?.webdavRunning && (
            <div style={{ marginTop: 20, paddingTop: 16, borderTop: '1px solid var(--md-outline-variant)' }}>
              <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--md-on-surface-variant)', display: 'block', marginBottom: 6 }}>
                {lang === 'id' ? 'Alamat Akses Wi-Fi lokal:' : 'Local Wi-Fi Access URL:'}
              </label>
              <div style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '10px 14px', background: 'var(--md-surface, #fff)', borderRadius: 12,
                border: '1px solid var(--md-outline-variant)'
              }}>
                <span style={{ fontSize: 13, fontWeight: 600, color: '#3b82f6', fontFamily: 'monospace' }}>
                  http://{localIp}:{status?.webdavServerPort || webdavPort}/
                </span>
                <a
                  href={`http://${localIp}:${status?.webdavServerPort || webdavPort}/`}
                  target="_blank"
                  rel="noreferrer"
                  style={{ color: '#3b82f6', display: 'flex', alignItems: 'center', gap: 4, textDecoration: 'none', fontSize: 12, fontWeight: 600 }}
                >
                  <ExternalLink size={14} /> Open
                </a>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
