import React, { useState, useEffect } from 'react';
import Login from './components/Login';
import FileManager from './components/FileManager';
import { CheckAuth, Logout, CheckForUpdates, OpenReleaseURL } from '../wailsjs/go/main/App';
import { EventsOn } from '../wailsjs/runtime/runtime';
import './index.css';

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [showReset, setShowReset] = useState(false);
  const [showExitConfirm, setShowExitConfirm] = useState(false);
  const [updateInfo, setUpdateInfo] = useState<{
    has_update: boolean;
    latest_version: string;
    update_url: string;
    release_notes: string;
  } | null>(null);
  const [showUpdateModal, setShowUpdateModal] = useState(false);
  const lang = localStorage.getItem('lang') || 'id';

  useEffect(() => {
    const offExitPrompt = EventsOn('app:request-exit-confirm', () => {
      setShowExitConfirm(true);
    });

    // Show reset button if loading takes more than 4 seconds
    const timer = setTimeout(() => {
      setShowReset(true);
    }, 4000);

    CheckAuth()
      .then(auth => setIsAuthenticated(auth))
      .catch(e => console.error('Auth check failed:', e))
      .finally(() => {
        clearTimeout(timer);
        setIsLoading(false);
      });

    const checkUpdates = () => {
      CheckForUpdates()
        .then(info => {
          if (info && info.has_update) {
            setUpdateInfo(info);
            setShowUpdateModal(true);
          }
        })
        .catch(e => console.error('Failed to check for updates:', e));
    };

    checkUpdates();

    const offCheckUpdates = EventsOn('menu:check-updates', () => {
      checkUpdates();
    });

    // Check for updates every 2 hours
    const updateInterval = setInterval(checkUpdates, 2 * 60 * 60 * 1000);

    return () => {
      clearTimeout(timer);
      clearInterval(updateInterval);
      if (typeof offExitPrompt === 'function') offExitPrompt();
      if (typeof offCheckUpdates === 'function') offCheckUpdates();
    };
  }, []);

  const handleForceReset = async () => {
    try {
      setIsLoading(true);
      setShowReset(false);
      // Wait for Logout() with a maximum timeout of 3 seconds.
      // If the backend is deadlocked or sluggish, still force the frontend redirect.
      await Promise.race([
        Logout(),
        new Promise((_, reject) => setTimeout(() => reject(new Error('Logout backend timeout')), 3000))
      ]).catch(e => console.warn('Logout warning or timeout:', e));

      localStorage.clear();
      setIsAuthenticated(false);
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoading(false);
    }
  };

  const renderContent = () => {
    if (isLoading) {
      const loadingText = lang === 'id' ? 'Menghubungkan ke Telegram...' : 'Connecting to Telegram...';
      const issueText = lang === 'id' ? 'Koneksi lambat atau sesi bermasalah?' : 'Slow connection or session issue?';
      const resetBtnText = lang === 'id' ? 'Reset Sesi / Masuk Ulang' : 'Reset Session / Relogin';

      return (
        <div style={{
          display:'flex', flexDirection:'column', alignItems:'center',
          justifyContent:'center', width:'100%', height:'100vh', gap:20,
          background:'var(--surface)',
        }}>
          <img
            src="/logo-drive.png"
            onError={(e) => { (e.target as HTMLImageElement).src = '/icon.webp'; }}
            alt="Awd TeleDrive" style={{ width:64, height:64, objectFit:'contain', borderRadius:12 }}
          />
          <div style={{
            width:36, height:36, borderRadius:'50%',
            border:'3px solid var(--primary-container)',
            borderTopColor:'var(--primary)',
            animation:'spin 0.8s linear infinite'
          }}/>
          <span style={{ color:'var(--on-surface-variant)', fontSize:14 }}>{loadingText}</span>
          
          {showReset && (
            <div style={{ marginTop: 20, display:'flex', flexDirection:'column', alignItems:'center', gap:10, animation:'fadeIn .3s ease' }}>
              <span style={{ fontSize:12, color:'var(--md-error, #b3261e)', textAlign:'center', maxWidth:280 }}>
                {issueText}
              </span>
              <button onClick={handleForceReset}
                style={{
                  background:'transparent', border:'1px solid var(--outline, #74777f)',
                  color:'var(--primary, #0b57d0)', padding:'8px 16px', borderRadius:100,
                  fontSize:13, fontWeight:500, cursor:'pointer', transition:'all .2s',
                  fontFamily:'Google Sans, sans-serif'
                }}
                onMouseEnter={e => { e.currentTarget.style.background='rgba(11,87,208,0.08)'; e.currentTarget.style.borderColor='var(--primary)'; }}
                onMouseLeave={e => { e.currentTarget.style.background='transparent'; e.currentTarget.style.borderColor='var(--outline)'; }}
              >
                {resetBtnText}
              </button>
            </div>
          )}

          <style>{`
            @keyframes spin { to { transform: rotate(360deg); } }
            @keyframes fadeIn { from { opacity:0; transform:translateY(5px); } to { opacity:1; transform:translateY(0); } }
          `}</style>
        </div>
      );
    }

    if (!isAuthenticated) {
      return <Login onLoginSuccess={() => setIsAuthenticated(true)} />;
    }

    return <FileManager onLogout={() => setIsAuthenticated(false)} />;
  };

  return (
    <>
      {renderContent()}
      
      {showExitConfirm && (
        <div style={{ 
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, 
          backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', 
          justifyContent: 'center', zIndex: 9999, animation: 'fadeIn 0.2s ease'
        }}>
          <div style={{ 
            backgroundColor: 'var(--surface, #fff)', width: '312px', padding: '24px', 
            borderRadius: '28px', textAlign: 'center', boxShadow: '0 4px 6px rgba(0,0,0,0.1)' 
          }}>
            <h3 style={{ marginBottom: '16px', fontSize: '24px', fontWeight: '400', color: 'var(--on-surface, #1d1b20)', marginTop: 0 }}>
              Konfirmasi Tutup
            </h3>
            <p style={{ fontSize: '14px', lineHeight: '1.5', color: 'var(--on-surface-variant, #49454f)', marginBottom: '24px', marginTop: 0 }}>
              Apakah Anda yakin ingin menutup aplikasi Awd TeleDrive?
            </p>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
              <button 
                onClick={() => setShowExitConfirm(false)}
                style={{ 
                  background: 'transparent', border: 'none', color: 'var(--primary, #0b57d0)', 
                  padding: '10px 16px', borderRadius: '100px', cursor: 'pointer', fontWeight: 500,
                  fontSize: '14px'
                }}
              >
                Batal
              </button>
              <button 
                onClick={() => { (window as any).go.main.App.QuitApp(); }}
                style={{ 
                  background: '#b3261e', border: 'none', color: '#fff', 
                  padding: '10px 16px', borderRadius: '100px', cursor: 'pointer', fontWeight: 500,
                  fontSize: '14px'
                }}
              >
                Ya, Tutup
              </button>
            </div>
          </div>
        </div>
      )}

      {showUpdateModal && updateInfo && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center',
          justifyContent: 'center', zIndex: 9999, animation: 'fadeIn 0.25s ease',
          backdropFilter: 'blur(4px)'
        }}>
          <div style={{
            backgroundColor: 'var(--surface, #fff)', width: '420px', padding: '28px',
            borderRadius: '28px', textAlign: 'left', boxShadow: '0 8px 30px rgba(0,0,0,0.15)',
            border: '1px solid var(--outline-variant, #e1e2ec)',
            fontFamily: 'Google Sans, Roboto, sans-serif',
            display: 'flex', flexDirection: 'column', gap: '16px'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div style={{
                background: 'var(--primary-container, #d3e3fd)',
                borderRadius: '12px', padding: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center'
              }}>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--primary, #0b57d0)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                  <polyline points="7 10 12 15 17 10" />
                  <line x1="12" y1="15" x2="12" y2="3" />
                </svg>
              </div>
              <h3 style={{ margin: 0, fontSize: '20px', fontWeight: '500', color: 'var(--on-surface, #1d1b20)' }}>
                {lang === 'id' ? 'Pembaruan Tersedia' : 'Update Available'}
              </h3>
            </div>

            <p style={{ fontSize: '14px', lineHeight: '1.6', color: 'var(--on-surface-variant, #49454f)', margin: 0 }}>
              {lang === 'id' 
                ? `Versi baru (${updateInfo.latest_version}) telah dirilis. Versi Anda saat ini adalah 1.1.0.`
                : `A new version (${updateInfo.latest_version}) is available. Your current version is 1.1.0.`}
            </p>

            {updateInfo.release_notes && (
              <div style={{
                backgroundColor: 'var(--surface-container-low, #f7f9fc)',
                borderRadius: '16px', padding: '12px 16px', fontSize: '13px',
                color: 'var(--on-surface-variant, #49454f)', maxHeight: '160px',
                overflowY: 'auto', border: '1px solid var(--outline-variant, #e1e2ec)',
                whiteSpace: 'pre-wrap', lineHeight: '1.5'
              }}>
                <strong style={{ display: 'block', marginBottom: '6px', color: 'var(--on-surface, #1d1b20)' }}>
                  {lang === 'id' ? 'Catatan Rilis:' : 'Release Notes:'}
                </strong>
                {updateInfo.release_notes}
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '8px' }}>
              <button
                onClick={() => setShowUpdateModal(false)}
                style={{
                  background: 'transparent', border: 'none', color: 'var(--primary, #0b57d0)',
                  padding: '10px 20px', borderRadius: '100px', cursor: 'pointer', fontWeight: 500,
                  fontSize: '14px', transition: 'background-color 0.2s'
                }}
                onMouseEnter={e => e.currentTarget.style.backgroundColor = 'rgba(11,87,208,0.08)'}
                onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}
              >
                {lang === 'id' ? 'Nanti Saja' : 'Later'}
              </button>
              <button
                onClick={() => {
                  OpenReleaseURL(updateInfo.update_url);
                  setShowUpdateModal(false);
                }}
                style={{
                  background: 'var(--primary, #0b57d0)', border: 'none', color: 'var(--on-primary, #fff)',
                  padding: '10px 20px', borderRadius: '100px', cursor: 'pointer', fontWeight: 500,
                  fontSize: '14px', display: 'flex', alignItems: 'center', gap: '8px',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.1)', transition: 'filter 0.2s'
                }}
                onMouseEnter={e => e.currentTarget.style.filter = 'brightness(0.9)'}
                onMouseLeave={e => e.currentTarget.style.filter = 'none'}
              >
                {lang === 'id' ? 'Perbarui Sekarang' : 'Update Now'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

export default App;
