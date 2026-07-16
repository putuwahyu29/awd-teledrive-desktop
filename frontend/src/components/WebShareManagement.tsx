   import React, { useState, useEffect } from 'react';
import { Share2, Trash2, Copy, ShieldAlert, Wifi, Globe, Lock, Unlock, RefreshCw, Eye, EyeOff } from 'lucide-react';
import { GetWebShares, DeleteWebShare, GetLocalIPAddress, TogglePublicTunnel, GetTunnelPublicUrl, IsTunnelRunning, GetWebServerPort } from '../../wailsjs/go/main/App';
import { EventsOn } from '../../wailsjs/runtime/runtime';

function WebShareManagement({ lang, addToast }) {
  const [shares, setShares] = useState([]);
  const [localIp, setLocalIp] = useState('127.0.0.1');
  const [port, setPort] = useState(0);
  const [publicUrl, setPublicUrl] = useState('');
  const [isTunneling, setIsTunneling] = useState(false);
  const [tunnelStatus, setTunnelStatus] = useState('disconnected'); // disconnected, downloading, connecting, connected, failed
  const [showDisclaimer, setShowDisclaimer] = useState(true);
  const [acceptedDisclaimer, setAcceptedDisclaimer] = useState(false);
  const [loading, setLoading] = useState(false);
  const [revealedPassIds, setRevealedPassIds] = useState([]);
  const [deleteConfirmId, setDeleteConfirmId] = useState(null);

  const fetchShares = async () => {
    try {
      const items = await GetWebShares();
      setShares(items || []);
    } catch (e) {
      console.error(e);
    }
  };

  const initServerInfo = async () => {
    try {
      const ip = await GetLocalIPAddress();
      const p = await GetWebServerPort();
      const running = await IsTunnelRunning();
      const pub = await GetTunnelPublicUrl();

      setLocalIp(ip);
      setPort(p);
      setIsTunneling(running);
      setPublicUrl(pub);
      if (running && pub) {
        setTunnelStatus('connected');
      }
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    fetchShares();
    initServerInfo();

    // Listen to background tunnel updates
    const onTunnelStatus = (status) => {
      setTunnelStatus(status);
      if (status === 'connected') {
        GetTunnelPublicUrl().then(url => setPublicUrl(url));
        setIsTunneling(true);
      } else if (status === 'disconnected' || status === 'failed') {
        setIsTunneling(false);
        setPublicUrl('');
      }
    };

    EventsOn('tunnel:status', onTunnelStatus);
  }, []);

  const handleDelete = (id) => {
    setDeleteConfirmId(id);
  };

  const confirmDelete = async () => {
    if (!deleteConfirmId) return;
    const targetId = deleteConfirmId;
    setDeleteConfirmId(null);
    try {
      const ok = await DeleteWebShare(targetId);
      if (ok) {
        addToast(lang === 'id' ? 'Link berbagi berhasil dihapus' : 'Share link deleted successfully');
        fetchShares();
      }
    } catch (e) {
      addToast(String(e), 'error');
    }
  };

  const toggleRevealPass = (id) => {
    setRevealedPassIds(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  const handleToggleTunnel = async () => {
    if (!acceptedDisclaimer && !isTunneling) {
      addToast(lang === 'id' ? 'Anda harus menyetujui pernyataan disclaimer terlebih dahulu' : 'You must accept the disclaimer first', 'error');
      return;
    }

    setLoading(true);
    try {
      if (isTunneling) {
        await TogglePublicTunnel(false);
        setIsTunneling(false);
        setPublicUrl('');
        setTunnelStatus('disconnected');
        addToast(lang === 'id' ? 'Tunnel publik dimatikan' : 'Public tunnel disabled');
      } else {
        setTunnelStatus('connecting');
        const url = await TogglePublicTunnel(true);
        if (url) {
          setPublicUrl(url);
          setIsTunneling(true);
          setTunnelStatus('connected');
          addToast(lang === 'id' ? 'Tunnel publik berhasil diaktifkan!' : 'Public tunnel enabled successfully!');
        }
      }
    } catch (e) {
      addToast(String(e), 'error');
      setTunnelStatus('failed');
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = (text, type) => {
    navigator.clipboard.writeText(text);
    addToast(lang === 'id' ? `${type} disalin ke clipboard ✓` : `${type} copied to clipboard ✓`);
  };

  const getShareLink = (item, isPub = false) => {
    const host = isPub ? publicUrl : `http://${localIp}:${port}`;
    return `${host}/share/${item.id}`;
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24, color: 'var(--md-on-surface)', maxWidth: 1000, margin: '0 auto', width: '100%', padding: '10px 0' }}>
      
      {/* Top Banner Status */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 20 }}>
        {/* Local Address card */}
        <div style={{
          padding: 20, borderRadius: 16, background: 'var(--md-surface-container-high)',
          border: '1.5px solid var(--md-outline-variant)', display: 'flex', alignItems: 'center', gap: 16
        }}>
          <div style={{
            width: 48, height: 48, borderRadius: '50%', background: 'rgba(52,168,83,0.12)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#34a853'
          }}>
            <Wifi size={24}/>
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--md-on-surface-variant)' }}>
              {lang === 'id' ? 'Alamat Jaringan Lokal' : 'Local Network Address'}
            </span>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4 }}>
              <span style={{ fontSize: 15, fontWeight: 700, fontFamily: 'monospace', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
                http://{localIp}:{port}
              </span>
              <button
                onClick={() => copyToClipboard(`http://${localIp}:${port}`, 'IP Lokal')}
                style={{ background: 'transparent', border: 'none', cursor: 'pointer', padding: 4, display: 'flex', color: 'var(--md-primary)' }}
              >
                <Copy size={16}/>
              </button>
            </div>
          </div>
        </div>

        {/* Public Address Tunnel Card */}
        <div style={{
          padding: 20, borderRadius: 16, background: 'var(--md-surface-container-high)',
          border: `1.5px solid ${isTunneling ? '#1a73e8' : 'var(--md-outline-variant)'}`,
          display: 'flex', alignItems: 'center', gap: 16
        }}>
          <div style={{
            width: 48, height: 48, borderRadius: '50%',
            background: isTunneling ? 'rgba(26,115,232,0.12)' : 'rgba(128,128,128,0.12)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', color: isTunneling ? '#1a73e8' : '#7f8c8d'
          }}>
            <Globe size={24}/>
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--md-on-surface-variant)' }}>
              {lang === 'id' ? 'Alamat Publik (Cloudflare)' : 'Public Address (Cloudflare)'}
            </span>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4 }}>
              {isTunneling ? (
                <>
                  <span style={{ fontSize: 14, fontWeight: 700, textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap', color: 'var(--md-primary)' }}>
                    {publicUrl || (lang === 'id' ? 'Menginisialisasi...' : 'Initializing...')}
                  </span>
                  {publicUrl && (
                    <button
                      onClick={() => copyToClipboard(publicUrl, 'URL Publik')}
                      style={{ background: 'transparent', border: 'none', cursor: 'pointer', padding: 4, display: 'flex', color: 'var(--md-primary)' }}
                    >
                      <Copy size={16}/>
                    </button>
                  )}
                </>
              ) : (
                <span style={{ fontSize: 13, color: 'var(--md-on-surface-variant)' }}>
                  {lang === 'id' ? 'Tidak aktif' : 'Inactive'}
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Safety Disclaimer Panel */}
      {!isTunneling && showDisclaimer && (
        <div style={{
          padding: 24, borderRadius: 20, background: 'rgba(234,67,53,0.06)',
          border: '1.5px solid rgba(234,67,53,0.3)', display: 'flex', flexDirection: 'column', gap: 16
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, color: '#ea4335' }}>
            <ShieldAlert size={26}/>
            <h3 style={{ fontSize: 16, fontWeight: 700, margin: 0 }}>
              {lang === 'id' ? 'Pernyataan Keamanan Berbagi Publik' : 'Public Sharing Security Disclaimer'}
            </h3>
          </div>
          <div style={{ fontSize: 13, lineHeight: 1.6, color: 'var(--md-on-surface-variant)' }}>
            {lang === 'id' ? (
              <ul style={{ margin: 0, paddingLeft: 20 }}>
                <li>Mengaktifkan tunnel publik (Cloudflare) membolehkan siapa saja yang memiliki link untuk mengakses/mengunduh berkas yang Anda bagikan secara langsung melalui internet.</li>
                <li>Komputer Anda <b>harus tetap menyala</b> dan aplikasi TeleDrive Desktop harus aktif agar link web sharing dapat terus diakses oleh orang lain.</li>
                <li>Proses unduhan pengunjung akan menggunakan <b>bandwidth upload internet rumah Anda</b>, kecepatan bergantung pada kualitas ISP Anda.</li>
                <li>Sangat disarankan menyetel <b>Password Proteksi</b> untuk dokumen yang sensitif.</li>
              </ul>
            ) : (
              <ul style={{ margin: 0, paddingLeft: 20 }}>
                <li>Enabling public tunnel (Cloudflare) allows anyone with the link to access/download shared items directly from the internet.</li>
                <li>Your computer <b>must remain turned on</b> and TeleDrive Desktop must be running for the sharing link to be accessible.</li>
                <li>Download speed for visitors depends entirely on your <b>home internet upload bandwidth</b>.</li>
                <li>It is highly recommended to set a <b>Password Protection</b> for sensitive documents.</li>
              </ul>
            )}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 8 }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={acceptedDisclaimer}
                onChange={e => setAcceptedDisclaimer(e.target.checked)}
                style={{ width: 18, height: 18, cursor: 'pointer' }}
              />
              {lang === 'id' ? 'Saya memahami dan menyetujui konsekuensi keamanan di atas' : 'I understand and agree to the security consequences above'}
            </label>
          </div>
        </div>
      )}

      {/* Control Action Panel */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '16px 24px', borderRadius: 16, background: 'var(--md-surface-container-high)',
        border: '1px solid var(--md-outline-variant)'
      }}>
        <div>
          <h3 style={{ fontSize: 15, fontWeight: 700, margin: 0 }}>
            {lang === 'id' ? 'Tunnel Publik Cloudflare' : 'Cloudflare Public Tunnel'}
          </h3>
          <p style={{ fontSize: 12, color: 'var(--md-on-surface-variant)', marginTop: 4 }}>
            {tunnelStatus === 'downloading' && (lang === 'id' ? 'Mengunduh cloudflared runner... Mohon tunggu' : 'Downloading cloudflared runner... Please wait')}
            {tunnelStatus === 'connecting' && (lang === 'id' ? 'Menghubungkan tunnel ke Cloudflare...' : 'Connecting tunnel to Cloudflare...')}
            {tunnelStatus === 'connected' && (lang === 'id' ? 'Tunnel aktif berjalan ✓' : 'Tunnel is running successfully ✓')}
            {tunnelStatus === 'disconnected' && (lang === 'id' ? 'Tunnel publik tidak aktif' : 'Public tunnel is disabled')}
            {tunnelStatus === 'failed' && (lang === 'id' ? 'Gagal menghubungkan tunnel. Silakan coba lagi.' : 'Tunnel connection failed. Please retry.')}
          </p>
        </div>
        <button
          onClick={handleToggleTunnel}
          disabled={loading || (tunnelStatus === 'downloading' || tunnelStatus === 'connecting')}
          style={{
            padding: '10px 24px', borderRadius: 100, border: 'none',
            background: isTunneling ? 'var(--md-error)' : 'var(--md-primary)',
            color: isTunneling ? 'var(--md-on-error)' : 'var(--md-on-primary)', fontSize: 13, fontWeight: 700, cursor: 'pointer',
            display: 'flex', alignItems: 'center', gap: 8, transition: 'filter .15s'
          }}
          onMouseEnter={e => e.currentTarget.style.filter = 'brightness(1.15)'}
          onMouseLeave={e => e.currentTarget.style.filter = 'none'}
        >
          {loading ? <RefreshCw size={15} style={{ animation: 'spin 1s linear infinite' }}/> : null}
          {isTunneling ? (lang === 'id' ? 'Matikan Publik' : 'Disable Public') : (lang === 'id' ? 'Aktifkan Publik' : 'Enable Public')}
        </button>
      </div>

      {/* Shared Items Table */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <h3 style={{ fontSize: 18, fontWeight: 600, fontFamily: 'Google Sans,sans-serif' }}>
          {lang === 'id' ? 'Manajemen Web Sharing' : 'Web Share Management'}
        </h3>
        
        {shares.length === 0 ? (
          <div style={{
            padding: 48, borderRadius: 16, border: '1.5px dashed var(--md-outline-variant)',
            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, textAlign: 'center'
          }}>
            <Share2 size={44} color="var(--md-outline-variant)"/>
            <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--md-on-surface-variant)' }}>
              {lang === 'id' ? 'Belum ada file atau folder yang dibagikan' : 'No files or folders are currently shared'}
            </span>
            <span style={{ fontSize: 12, color: 'var(--md-on-surface-variant)' }}>
              {lang === 'id' ? 'Klik kanan pada file atau folder lalu pilih "Bagikan ke Web" untuk memulainya.' : 'Right-click on any file or folder and select "Share to Web" to start.'}
            </span>
          </div>
        ) : (
          <div style={{ border: '1px solid var(--md-outline-variant)', borderRadius: 16, overflow: 'hidden', background: 'var(--md-surface-container-low)' }}>
            {/* Header */}
            <div style={{
              display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr 1.5fr 60px', gap: 16,
              padding: '12px 20px', background: 'var(--md-surface-container-high)',
              borderBottom: '1px solid var(--md-outline-variant)', fontSize: 13, fontWeight: 700,
              color: 'var(--md-on-surface-variant)'
            }}>
              <span>{lang === 'id' ? 'Nama Berkas' : 'Item Name'}</span>
              <span>{lang === 'id' ? 'Tipe' : 'Type'}</span>
              <span>{lang === 'id' ? 'Total Akses' : 'Views'}</span>
              <span>{lang === 'id' ? 'Proteksi' : 'Security'}</span>
              <span>{lang === 'id' ? 'Salin Tautan' : 'Copy Link'}</span>
              <span style={{ textAlign: 'center' }}>{lang === 'id' ? 'Aksi' : 'Action'}</span>
            </div>

            {/* List Rows */}
            {shares.map(item => (
              <div
                key={item.id}
                style={{
                  display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr 1.5fr 60px', gap: 16,
                  padding: '16px 20px', borderBottom: '1px solid var(--md-outline-variant)',
                  alignItems: 'center', fontSize: 13, color: 'var(--md-on-surface)'
                }}
              >
                <span style={{ fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={item.name}>
                  {item.name}
                </span>
                <span style={{ textTransform: 'capitalize', color: 'var(--md-on-surface-variant)' }}>
                  {item.type}
                </span>
                <span style={{ fontWeight: 700 }}>
                  {item.accessCount} x
                </span>
                <span>
                  {item.password ? (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#f1c40f' }}>
                      <Lock size={15}/>
                      <span style={{ fontSize: 12, fontFamily: 'monospace' }}>
                        {revealedPassIds.includes(item.id) ? item.password : '••••••'}
                      </span>
                      <button
                        onClick={() => toggleRevealPass(item.id)}
                        style={{
                          background: 'transparent', border: 'none', cursor: 'pointer',
                          display: 'inline-flex', padding: 2, color: 'var(--md-on-surface-variant)',
                          transition: 'color .15s',
                        }}
                        onMouseEnter={e => e.currentTarget.style.color = 'var(--md-primary)'}
                        onMouseLeave={e => e.currentTarget.style.color = 'var(--md-on-surface-variant)'}
                      >
                        {revealedPassIds.includes(item.id) ? <EyeOff size={14}/> : <Eye size={14}/>}
                      </button>
                    </div>
                  ) : (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--md-on-surface-variant)' }}>
                      <Unlock size={15}/> Public
                    </div>
                  )}
                </span>
                
                {/* Copy Buttons */}
                <div style={{ display: 'flex', gap: 8 }}>
                  <button
                    onClick={() => copyToClipboard(getShareLink(item, false), 'Link Lokal')}
                    title={lang === 'id' ? 'Salin Link Jaringan Lokal' : 'Copy Local Network Link'}
                    style={{
                      padding: '4px 8px', borderRadius: 6, border: '1px solid var(--md-outline-variant)',
                      background: 'transparent', color: 'var(--md-primary)', fontSize: 11, fontWeight: 700,
                      cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4
                    }}
                  >
                    Lokal
                  </button>
                  <button
                    onClick={() => {
                      if (!isTunneling) {
                        addToast(lang === 'id' ? 'Aktifkan tunnel publik terlebih dahulu' : 'Enable public tunnel first', 'error');
                        return;
                      }
                      copyToClipboard(getShareLink(item, true), 'Link Publik');
                    }}
                    title={lang === 'id' ? 'Salin Link Internet Publik' : 'Copy Public Internet Link'}
                    disabled={!isTunneling}
                    style={{
                      padding: '4px 8px', borderRadius: 6, border: '1px solid var(--md-outline-variant)',
                      background: isTunneling ? 'var(--md-primary-container)' : 'transparent',
                      color: isTunneling ? 'var(--md-on-primary-container)' : 'var(--md-on-surface-variant)',
                      opacity: isTunneling ? 1 : 0.45,
                      fontSize: 11, fontWeight: 700,
                      cursor: isTunneling ? 'pointer' : 'default', display: 'flex', alignItems: 'center', gap: 4
                    }}
                  >
                    Publik
                  </button>
                </div>

                {/* Delete button */}
                <div style={{ display: 'flex', justifyContent: 'center' }}>
                  <button
                    onClick={() => handleDelete(item.id)}
                    style={{
                      background: 'transparent', border: 'none', cursor: 'pointer',
                      color: 'var(--md-error)', padding: 6, borderRadius: '50%',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      transition: 'background .15s'
                    }}
                    onMouseEnter={e => e.currentTarget.style.background = 'rgba(234,67,53,0.1)'}
                    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                  >
                    <Trash2 size={16}/>
                  </button>
                </div>

              </div>
            ))}
          </div>
        )}
      </div>

      {/* Custom Confirmation Modal */}
      {deleteConfirmId !== null && (
        <div style={{
          position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh',
          background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(8px)', zIndex: 9999,
          display: 'flex', alignItems: 'center', justifyContent: 'center'
        }}>
          <div style={{
            background: 'var(--md-surface-container-high)', border: '1px solid var(--md-outline-variant)',
            borderRadius: 24, padding: '32px 24px', width: '90%', maxWidth: 400,
            boxShadow: '0 16px 48px rgba(0,0,0,0.3)', textAlign: 'center',
            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16,
            animation: 'modalPop 0.2s ease-out'
          }}>
            <style>{`
              @keyframes modalPop {
                from { transform: scale(0.95); opacity: 0; }
                to { transform: scale(1); opacity: 1; }
              }
            `}</style>
            <div style={{
              width: 56, height: 56, borderRadius: '50%', background: 'rgba(239, 68, 68, 0.1)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#ef4444'
            }}>
              <ShieldAlert size={28} />
            </div>
            <h3 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: 'var(--md-on-surface)' }}>
              {lang === 'id' ? 'Hentikan Berbagi?' : 'Stop Sharing?'}
            </h3>
            <p style={{ margin: 0, fontSize: 14, color: 'var(--md-on-surface-variant)', lineHeight: 1.5 }}>
              {lang === 'id' 
                ? 'Apakah Anda yakin ingin menghentikan berbagi link ini? Pengunjung tidak akan bisa lagi mengakses berkas ini.' 
                : 'Are you sure you want to stop sharing this link? Visitors will no longer be able to access this file.'}
            </p>
            <div style={{ display: 'flex', width: '100%', gap: 12, marginTop: 8 }}>
              <button
                onClick={() => setDeleteConfirmId(null)}
                style={{
                  flex: 1, padding: '12px', borderRadius: 100, border: '1px solid var(--md-outline-variant)',
                  background: 'transparent', color: 'var(--md-on-surface)', fontSize: 14, fontWeight: 600,
                  cursor: 'pointer', transition: 'background .15s'
                }}
                onMouseOver={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.05)'}
                onMouseOut={(e) => e.currentTarget.style.background = 'transparent'}
              >
                {lang === 'id' ? 'Batal' : 'Cancel'}
              </button>
              <button
                onClick={confirmDelete}
                style={{
                  flex: 1, padding: '12px', borderRadius: 100, border: 'none',
                  background: '#ef4444', color: '#ffffff', fontSize: 14, fontWeight: 600,
                  cursor: 'pointer', transition: 'filter .15s'
                }}
                onMouseOver={(e) => e.currentTarget.style.filter = 'brightness(1.1)'}
                onMouseOut={(e) => e.currentTarget.style.filter = 'none'}
              >
                {lang === 'id' ? 'Hentikan' : 'Stop Sharing'}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}

export default WebShareManagement;
