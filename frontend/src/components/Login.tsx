import React, { useState, useEffect } from 'react';
import { 
  SendCode, Login, GetAPICredentials, SetAPICredentials, StartQRLogin, CancelQRLogin 
} from '../../wailsjs/go/main/App';
import { EventsOn, EventsOff } from '../../wailsjs/runtime/runtime';
import { CheckCircle, AlertCircle, Sun, Moon } from 'lucide-react';

import { LoginTranslations } from '../locales/translation';
import PhoneLoginFlow from './features/PhoneLoginFlow';
import QrLoginFlow from './features/QrLoginFlow';
import { applyTheme } from '../utils/theme';

/* ── CSS variables (mirror FileManager theme) ────────────────────────────── */
const lightVars = {
  '--primary': '#0b57d0', '--on-primary': '#ffffff',
  '--primary-container': '#d3e3fd', '--on-primary-container': '#041e49',
  '--surface': '#f0f4f9', '--surface-container-lowest': '#ffffff',
  '--on-surface': '#1a1c1e', '--on-surface-variant': '#44474f',
  '--outline': '#74777f', '--outline-variant': '#c4c7cf',
  '--error': '#b3261e', '--error-container': '#f9dedc',
  '--on-error-container': '#410e0b',
};

function applyVars(vars: Record<string, string>) {
  Object.entries(vars).forEach(([k, v]) => document.documentElement.style.setProperty(k, v));
}

interface LoginPageProps {
  onLoginSuccess: () => void;
}

export default function LoginPage({ onLoginSuccess }: LoginPageProps) {
  const [loginMethod, setLoginMethod] = useState('phone'); // 'phone' or 'qr'
  const [lang, setLang] = useState(localStorage.getItem('lang') || 'id');
  const t = LoginTranslations[lang as 'en' | 'id'] || LoginTranslations.id;

  // Format disclaimer into label and content parts for premium styling
  const disclaimerText = t.disclaimer || '';
  const colonIndex = disclaimerText.indexOf(':');
  const disclaimerTitle = colonIndex !== -1 ? disclaimerText.substring(0, colonIndex + 1) : 'Disclaimer:';
  const disclaimerBody = colonIndex !== -1 ? disclaimerText.substring(colonIndex + 1) : disclaimerText;

  const [dark, setDark] = useState(() => {
    try {
      const savedDark = localStorage.getItem('td_dark');
      return savedDark !== null ? JSON.parse(savedDark) : false;
    } catch {
      return false;
    }
  });

  const toggleTheme = () => {
    const nextDark = !dark;
    setDark(nextDark);
    localStorage.setItem('td_dark', JSON.stringify(nextDark));
    applyTheme(nextDark);
  };
  
  const toggleLang = () => {
    const newLang = lang === 'id' ? 'en' : 'id';
    setLang(newLang);
    localStorage.setItem('lang', newLang);
  };

  // Phone Login State
  const [step, setStep] = useState(1);
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [apiId, setApiId] = useState('');
  const [apiHash, setApiHash] = useState('');
  const [showApiConfig, setShowApiConfig] = useState(false);
  const [loading, setLoading] = useState(false);
  const [globalError, setGlobalError] = useState('');
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  // QR Login State
  const [qrCodeUrl, setQrCodeUrl] = useState('');
  const [qrExpires, setQrExpires] = useState(0);
  const [qrLoading, setQrLoading] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(0);

  // Check if API config is present to allow QR code auth
  const isApiConfigured = apiId.trim().length > 0 && apiHash.trim().length >= 10;

  useEffect(() => {
    applyTheme(dark);
    // Load saved credentials
    GetAPICredentials().then(cfg => {
      if (cfg.api_id) setApiId(cfg.api_id);
      if (cfg.api_hash) setApiHash(cfg.api_hash);
      // Auto-open API panel if credentials not configured yet
      if (!cfg.api_id || !cfg.api_hash) setShowApiConfig(true);
    }).catch(() => { setShowApiConfig(true); });
  }, []);

  const clearErrors = () => { setGlobalError(''); setFieldErrors({}); };

  /* ── QR Login Event Listeners ───────────────────────────────────── */
  useEffect(() => {
    if (loginMethod !== 'qr') {
      CancelQRLogin();
      return;
    }

    clearErrors();
    setQrCodeUrl('');

    if (!isApiConfigured) {
      setQrLoading(false);
      return;
    }

    setQrLoading(true);

    // Listen to events emitted by Wails backend
    EventsOn('qr_token', (data: any) => {
      setQrCodeUrl(data.url);
      setQrExpires(data.expires);
      setQrLoading(false);
    });

    EventsOn('auth_success', () => {
      setQrLoading(false);
      onLoginSuccess();
    });

    EventsOn('auth_error', (errMsg: string) => {
      setQrLoading(false);
      setGlobalError(errMsg);
    });

    EventsOn('auth_password_required', () => {
      setQrLoading(false);
      setLoginMethod('phone');
      setStep(3);
    });

    // Start QR Login loop, ensuring API config is synchronized with Go backend first
    const initQR = async () => {
      try {
        if (apiId.trim() && apiHash.trim()) {
          const res = await SetAPICredentials(apiId.trim(), apiHash.trim());
          if (!res.success) {
            setGlobalError(res.error || 'Gagal menyimpan API credentials');
            setQrLoading(false);
            return;
          }
        }
        await StartQRLogin();
      } catch (err) {
        setGlobalError(String(err));
        setQrLoading(false);
      }
    };
    initQR();

    return () => {
      EventsOff('qr_token');
      EventsOff('auth_success');
      EventsOff('auth_error');
      EventsOff('auth_password_required');
      CancelQRLogin();
    };
  }, [loginMethod, isApiConfigured]);

  // Countdown timer for QR expiration
  useEffect(() => {
    if (!qrExpires) return;
    const updateTimer = () => {
      const now = Math.floor(Date.now() / 1000);
      const diff = qrExpires - now;
      setSecondsLeft(diff > 0 ? diff : 0);
    };

    updateTimer();
    const interval = setInterval(updateTimer, 1000);
    return () => clearInterval(interval);
  }, [qrExpires]);

  const handleRefreshQR = async () => {
    clearErrors();
    setQrCodeUrl('');
    setQrLoading(true);
    try {
      if (apiId.trim() && apiHash.trim()) {
        const res = await SetAPICredentials(apiId.trim(), apiHash.trim());
        if (!res.success) {
          setGlobalError(res.error || 'Gagal menyimpan API credentials');
          setQrLoading(false);
          return;
        }
      }
      await StartQRLogin();
    } catch (err) {
      setGlobalError(String(err));
      setQrLoading(false);
    }
  };

  /* ── Validation (only runs on submit, shows inline errors) ──── */
  const validateStep1 = () => {
    const errs: Record<string, string> = {};
    if (!apiId.trim()) errs.apiId = 'API ID wajib diisi';
    else if (!/^\d+$/.test(apiId.trim())) errs.apiId = 'API ID harus berupa angka';
    if (!apiHash.trim()) errs.apiHash = 'API Hash wajib diisi';
    else if (apiHash.trim().length < 10) errs.apiHash = 'API Hash terlalu pendek';
    if (!phone.trim()) errs.phone = 'Nomor telepon wajib diisi';
    else if (!/^\+?\d{7,15}$/.test(phone.replace(/\s/g, ''))) errs.phone = 'Format nomor telepon tidak valid (contoh: +628123456789)';
    setFieldErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const validateStep2 = () => {
    const errs: Record<string, string> = {};
    if (!code.trim()) errs.code = 'Kode verifikasi wajib diisi';
    else if (!/^\d{4,6}$/.test(code.trim())) errs.code = 'Kode harus 4-6 digit angka';
    setFieldErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const validateStep3 = () => {
    if (!password.trim()) {
      setFieldErrors({ password: 'Password verifikasi wajib diisi' });
      return false;
    }
    return true;
  };

  /* ── Handlers ───────────────────────────────────────────────────── */
  const handleSendCode = async (e: React.FormEvent) => {
    e.preventDefault();
    clearErrors();
    if (!validateStep1()) return;
    setLoading(true);
    try {
      const saveRes = await SetAPICredentials(apiId.trim(), apiHash.trim());
      if (!saveRes.success) { setGlobalError(saveRes.error || 'Gagal menyimpan API credentials'); return; }
      const res = await SendCode(phone.trim());
      if (res.success) setStep(2);
      else setGlobalError(res.error || 'Gagal mengirim kode');
    } catch (err) { setGlobalError(String(err)); }
    finally { setLoading(false); }
  };

  const handleVerifyCode = async (e: React.FormEvent) => {
    e.preventDefault();
    clearErrors();
    if (!validateStep2()) return;
    setLoading(true);
    try {
      const res = await Login(code.trim(), '');
      if (res.success) onLoginSuccess();
      else if (res.error === 'PASSWORD_REQUIRED') setStep(3);
      else setGlobalError(res.error || 'Verifikasi gagal');
    } catch (err) { setGlobalError(String(err)); }
    finally { setLoading(false); }
  };

  const handlePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    clearErrors();
    if (!validateStep3()) return;
    setLoading(true);
    try {
      const res = await Login('', password.trim());
      if (res.success) onLoginSuccess();
      else setGlobalError(res.error || 'Password salah');
    } catch (err) { setGlobalError(String(err)); }
    finally { setLoading(false); }
  };

  const handleSaveApiAndStartQR = async (e: React.FormEvent) => {
    e.preventDefault();
    clearErrors();
    const errs: Record<string, string> = {};
    if (!apiId.trim()) errs.apiId = 'API ID wajib diisi';
    else if (!/^\d+$/.test(apiId.trim())) errs.apiId = 'API ID harus berupa angka';
    if (!apiHash.trim()) errs.apiHash = 'API Hash wajib diisi';
    else if (apiHash.trim().length < 10) errs.apiHash = 'API Hash terlalu pendek';
    setFieldErrors(errs);
    if (Object.keys(errs).length > 0) return;

    setQrLoading(true);
    try {
      const saveRes = await SetAPICredentials(apiId.trim(), apiHash.trim());
      if (!saveRes.success) { 
        setGlobalError(saveRes.error || 'Gagal menyimpan API credentials'); 
        setQrLoading(false); 
        return; 
      }
      await StartQRLogin();
    } catch (err) {
      setGlobalError(String(err));
      setQrLoading(false);
    }
  };

  const handleSaveApiAndApplyQR = async () => {
    clearErrors();
    const saveRes = await SetAPICredentials(apiId.trim(), apiHash.trim());
    if (saveRes.success) {
      setShowApiConfig(false);
      handleRefreshQR();
    } else {
      setGlobalError(saveRes.error);
    }
  };

  return (
    <div className="login-container">
      <div className="top-actions">
        <button onClick={toggleTheme} className="theme-toggle-btn" title={dark ? 'Mode Terang' : 'Mode Gelap'}>
          {dark ? <Sun size={16} /> : <Moon size={16} />}
        </button>
        <button onClick={toggleLang} className="lang-toggle-btn">
          {lang === 'id' ? 'EN' : 'ID'}
        </button>
      </div>

      {/* ── Left Banner ──────────────────────────────────────────────── */}
      <div className="login-left-banner">
        <div className="banner-circle-1" />
        <div className="banner-circle-2" />

        <div className="banner-content">
          <img
            src="/icon.webp"
            alt="Awd TeleDrive"
            className="banner-logo"
          />

          <h1 className="banner-title">
            {t.appTitle}
          </h1>
          <p className="banner-desc">
            {t.appDesc}
          </p>

          {[
            t.feature1,
            t.feature2,
            t.feature3,
          ].map((f, i) => (
            <div key={i} className="banner-feature-item">
              <div className="banner-feature-icon">
                <CheckCircle size={14} className="banner-feature-svg" />
              </div>
              <span className="banner-feature-text">{f}</span>
            </div>
          ))}
        </div>

        <div className="banner-disclaimer">
          <AlertCircle size={16} className="banner-disclaimer-icon" style={{ flexShrink: 0, marginTop: 2 }} />
          <span>
            <strong className="banner-disclaimer-title">{disclaimerTitle}</strong>{disclaimerBody}
          </span>
        </div>
      </div>

      {/* ── Right Form ───────────────────────────────────────────────── */}
      <div className="login-right-section">
        <div className="login-card">
          {/* Tabs header */}
          <div style={{ display: 'flex', background: 'var(--md-surface)', borderRadius: 12, padding: 4, gap: 4 }}>
            <button
              onClick={() => { setLoginMethod('phone'); clearErrors(); }}
              style={{
                flex: 1, padding: '10px', borderRadius: 8, border: 'none', cursor: 'pointer',
                fontFamily: 'Google Sans, sans-serif', fontSize: 13, fontWeight: 500,
                background: loginMethod === 'phone' ? 'var(--md-primary-container)' : 'transparent',
                color: loginMethod === 'phone' ? 'var(--md-on-primary-container)' : 'var(--md-on-surface)',
                opacity: loginMethod === 'phone' ? 1 : 0.6,
                boxShadow: loginMethod === 'phone' ? '0 1px 3px rgba(0,0,0,.15)' : 'none',
                transition: 'all .15s',
              }}
            >
              {t.tabPhone}
            </button>
            <button
              onClick={() => { setLoginMethod('qr'); clearErrors(); }}
              style={{
                flex: 1, padding: '10px', borderRadius: 8, border: 'none', cursor: 'pointer',
                fontFamily: 'Google Sans, sans-serif', fontSize: 13, fontWeight: 500,
                background: loginMethod === 'qr' ? 'var(--md-primary-container)' : 'transparent',
                color: loginMethod === 'qr' ? 'var(--md-on-primary-container)' : 'var(--md-on-surface)',
                opacity: loginMethod === 'qr' ? 1 : 0.6,
                boxShadow: loginMethod === 'qr' ? '0 1px 3px rgba(0,0,0,.15)' : 'none',
                transition: 'all .15s',
              }}
            >
              {t.tabQr}
            </button>
          </div>

          {/* Global error */}
          {globalError && (
            <div style={{
              background: 'var(--md-error-container)', color: 'var(--md-on-error-container)',
              borderRadius: 10, padding: '10px 14px', fontSize: 13,
              border: '1px solid var(--md-error)', lineHeight: 1.5,
              display: 'flex', alignItems: 'flex-start', gap: 8,
            }}>
              <AlertCircle size={15} style={{ marginTop: 1, flexShrink: 0 }} />
              {globalError}
            </div>
          )}

          {/* METHOD 1: Phone Login */}
          {loginMethod === 'phone' && (
            <PhoneLoginFlow
              step={step}
              setStep={setStep}
              t={t}
              lang={lang}
              phone={phone}
              setPhone={setPhone}
              code={code}
              setCode={setCode}
              password={password}
              setPassword={setPassword}
              apiId={apiId}
              setApiId={setApiId}
              apiHash={apiHash}
              setApiHash={setApiHash}
              showApiConfig={showApiConfig}
              setShowApiConfig={setShowApiConfig}
              loading={loading}
              fieldErrors={fieldErrors}
              clearErrors={clearErrors}
              handleSendCode={handleSendCode}
              handleVerifyCode={handleVerifyCode}
              handlePassword={handlePassword}
              isApiConfigured={isApiConfigured}
            />
          )}

          {/* METHOD 2: QR Login */}
          {loginMethod === 'qr' && (
            <QrLoginFlow
              t={t}
              lang={lang}
              isApiConfigured={isApiConfigured}
              apiId={apiId}
              setApiId={setApiId}
              apiHash={apiHash}
              setApiHash={setApiHash}
              fieldErrors={fieldErrors}
              qrLoading={qrLoading}
              qrCodeUrl={qrCodeUrl}
              secondsLeft={secondsLeft}
              showApiConfig={showApiConfig}
              setShowApiConfig={setShowApiConfig}
              handleSaveApiAndStartQR={handleSaveApiAndStartQR}
              handleRefreshQR={handleRefreshQR}
              handleSaveApiAndApplyQR={handleSaveApiAndApplyQR}
            />
          )}

          <div style={{ fontSize: 12, color: 'var(--md-on-surface-variant)', textAlign: 'center', lineHeight: 1.6, marginTop: -4 }}>
            <p style={{ margin: 0 }}>{t.footerText}</p>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes slideUp { from { opacity: 0; transform: translateY(16px); } to { opacity: 1; transform: translateY(0); } }
        * { box-sizing: border-box; }

        .login-container {
          display: flex;
          width: 100%;
          height: 100vh;
          background: var(--md-surface);
          color: var(--md-on-surface);
          font-family: Roboto, sans-serif;
          position: relative;
        }

        .top-actions {
          position: absolute;
          top: 24px;
          right: 24px;
          z-index: 10;
          display: flex;
          align-items: center;
          gap: 12px;
        }

        .theme-toggle-btn {
          background: var(--md-surface-container-lowest);
          border: 1px solid var(--md-outline-variant);
          color: var(--md-on-surface);
          padding: 0;
          border-radius: 50%;
          cursor: pointer;
          width: 38px;
          height: 38px;
          display: flex;
          align-items: center;
          justify-content: center;
          box-shadow: 0 2px 8px rgba(0,0,0,0.05);
          transition: background 0.2s, border-color 0.2s, color 0.2s;
          outline: none;
        }
        .theme-toggle-btn:hover {
          background: var(--md-surface-container-low);
          border-color: var(--md-outline);
          color: var(--md-primary);
        }

        .lang-toggle-btn {
          background: var(--md-surface-container-lowest);
          border: 1px solid var(--md-outline-variant);
          color: var(--md-on-surface);
          padding: 0 16px;
          border-radius: 100px;
          cursor: pointer;
          height: 38px;
          font-size: 13px;
          font-weight: 600;
          box-shadow: 0 2px 8px rgba(0,0,0,0.05);
          transition: background 0.2s, border-color 0.2s;
          outline: none;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .lang-toggle-btn:hover {
          background: var(--md-surface-container-low);
          border-color: var(--md-outline);
        }

        .login-left-banner {
          flex: 1;
          background: var(--md-primary-container);
          display: flex;
          flex-direction: column;
          justify-content: space-between;
          padding: 64px;
          position: relative;
          overflow: hidden;
          border-right: 1px solid var(--md-outline-variant);
        }

        .banner-circle-1 {
          position: absolute;
          width: 600px;
          height: 600px;
          border-radius: 50%;
          background: radial-gradient(circle, rgba(11,87,208,0.2) 0%, rgba(11,87,208,0) 70%);
          filter: blur(80px);
          top: -150px;
          left: -150px;
          pointer-events: none;
        }

        .banner-circle-2 {
          position: absolute;
          width: 500px;
          height: 500px;
          border-radius: 50%;
          background: radial-gradient(circle, rgba(30,136,229,0.18) 0%, rgba(30,136,229,0) 70%);
          filter: blur(80px);
          bottom: -100px;
          right: -100px;
          pointer-events: none;
        }

        .banner-content {
          position: relative;
          z-index: 1;
          max-width: 480px;
          animation: fadeIn 0.8s ease-out;
        }

        .banner-logo {
          width: 72px;
          height: 72px;
          border-radius: 16px;
          margin-bottom: 28px;
          box-shadow: 0 12px 32px rgba(11, 87, 208, 0.16);
          object-fit: contain;
          transition: transform 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275);
        }
        .banner-logo:hover {
          transform: scale(1.08) rotate(3deg);
        }

        .banner-title {
          font-family: 'Google Sans', sans-serif;
          font-size: 2.6rem;
          font-weight: 600;
          color: var(--md-on-primary-container);
          margin-bottom: 16px;
          line-height: 1.2;
        }

        .banner-desc {
          font-size: 1rem;
          color: var(--md-on-primary-container);
          opacity: 0.8;
          line-height: 1.7;
          margin-bottom: 40px;
        }

        .banner-feature-item {
          display: flex;
          align-items: center;
          gap: 12px;
          margin-bottom: 14px;
          transition: transform 0.25s cubic-bezier(0.2, 0.8, 0.2, 1);
        }
        .banner-feature-item:hover {
          transform: translateX(8px);
        }

        .banner-feature-icon {
          width: 26px;
          height: 26px;
          border-radius: 50%;
          flex-shrink: 0;
          background: rgba(11,87,208,.12);
          display: flex;
          align-items: center;
          justify-content: center;
          transition: background 0.25s ease;
        }
        .banner-feature-item:hover .banner-feature-icon {
          background: var(--md-primary);
        }

        .banner-feature-svg {
          color: var(--md-on-primary-container);
          transition: color 0.25s ease;
        }
        .banner-feature-item:hover .banner-feature-svg {
          color: var(--md-on-primary) !important;
        }

        .banner-feature-text {
          font-size: 13.5px;
          color: var(--md-on-primary-container);
          opacity: 0.85;
          transition: opacity 0.25s ease;
        }
        .banner-feature-item:hover .banner-feature-text {
          opacity: 1;
        }

        .banner-disclaimer {
          position: relative;
          z-index: 1;
          margin-top: 24px;
          padding: 14px 18px;
          border-radius: 14px;
          background: var(--md-surface-variant);
          border: 1px solid var(--md-outline-variant);
          font-size: 12px;
          color: var(--md-on-primary-container);
          line-height: 1.6;
          display: flex;
          gap: 10px;
          align-items: flex-start;
          box-shadow: 0 4px 20px rgba(0, 0, 0, 0.02);
          transition: border-color 0.3s ease, box-shadow 0.3s ease, background 0.3s ease;
        }
        .banner-disclaimer:hover {
          background: var(--md-surface-container-high);
          border-color: rgba(11, 87, 208, 0.3);
          box-shadow: 0 8px 30px rgba(11, 87, 208, 0.06);
        }

        .banner-disclaimer-icon {
          color: var(--md-primary);
          transition: transform 0.3s ease;
        }
        .banner-disclaimer:hover .banner-disclaimer-icon {
          transform: scale(1.1) rotate(5deg);
        }

        .banner-disclaimer-title {
          font-weight: 600;
          color: var(--md-primary);
          margin-right: 4px;
        }

        .login-right-section {
          flex: 1;
          display: flex;
          padding: 32px;
          overflow-y: auto;
        }

        .login-card {
          background: var(--md-surface-container-lowest);
          color: var(--md-on-surface);
          border-radius: 24px;
          width: 100%;
          max-width: 440px;
          margin: auto;
          box-shadow: 0 2px 20px rgba(0,0,0,.08);
          padding: 36px 40px;
          border: 1px solid var(--md-outline-variant);
          display: flex;
          flex-direction: column;
          gap: 20px;
          animation: slideUp 0.6s ease-out;
        }

        @media (max-width: 900px) {
          .login-left-banner {
            display: none;
          }
          .login-right-section {
            flex: 1;
            width: 100%;
            padding: 24px;
          }
        }

        @media (max-width: 480px) {
          .login-right-section {
            padding: 16px;
          }
          .login-card {
            padding: 24px 20px;
            border-radius: 16px;
            gap: 16px;
          }
        }

        @media (max-height: 640px) {
          .login-right-section {
            padding: 16px;
          }
          .login-card {
            padding: 20px 24px;
            gap: 14px;
          }
          .login-left-banner {
            padding: 32px;
          }
          .banner-title {
            font-size: 2rem;
            margin-bottom: 8px;
          }
          .banner-desc {
            margin-bottom: 20px;
          }
        }
      `}</style>
    </div>
  );
}
