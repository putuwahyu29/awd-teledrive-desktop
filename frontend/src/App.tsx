import React, { useState, useEffect } from 'react';
import Login from './components/Login';
import FileManager from './components/FileManager';
import { CheckAuth, Logout } from '../wailsjs/go/main/App';
import { EventsOn } from '../wailsjs/runtime/runtime';
import './index.css';

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [showReset, setShowReset] = useState(false);
  const [showExitConfirm, setShowExitConfirm] = useState(false);
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

    return () => {
      clearTimeout(timer);
      if (typeof offExitPrompt === 'function') offExitPrompt();
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
            src="/icon.webp"
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
    </>
  );
}

export default App;
