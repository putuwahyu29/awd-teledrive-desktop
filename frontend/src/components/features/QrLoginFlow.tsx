import React from 'react';
import { Key, ChevronDown, ChevronUp } from 'lucide-react';
import FieldInput from '../ui/FieldInput';
import { SubmitBtn } from '../ui/Button';
import ApiConfigForm from './ApiConfigForm';

interface QrLoginFlowProps {
  t: any;
  lang: string;
  isApiConfigured: boolean;
  apiId: string;
  setApiId: (v: string) => void;
  apiHash: string;
  setApiHash: (v: string) => void;
  fieldErrors: Record<string, string>;
  qrLoading: boolean;
  qrCodeUrl: string;
  secondsLeft: number;
  showApiConfig: boolean;
  setShowApiConfig: React.Dispatch<React.SetStateAction<boolean>>;
  handleSaveApiAndStartQR: (e: React.FormEvent) => void;
  handleRefreshQR: () => void;
  handleSaveApiAndApplyQR: () => void;
}

export default function QrLoginFlow({
  t,
  lang,
  isApiConfigured,
  apiId,
  setApiId,
  apiHash,
  setApiHash,
  fieldErrors,
  qrLoading,
  qrCodeUrl,
  secondsLeft,
  showApiConfig,
  setShowApiConfig,
  handleSaveApiAndStartQR,
  handleRefreshQR,
  handleSaveApiAndApplyQR
}: QrLoginFlowProps) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16, width: '100%' }}>
      <div style={{ textAlign: 'center' }}>
        <h2 style={{ fontFamily: 'Google Sans, sans-serif', fontSize: 22, fontWeight: 500, color: 'var(--md-on-surface)', marginBottom: 4 }}>
          {t.qrTitle}
        </h2>
        <p style={{ color: 'var(--md-on-surface)', opacity: 0.8, fontSize: 13.5, lineHeight: 1.5, margin: 0 }}>
          {t.qrDesc}
        </p>
      </div>

      {!isApiConfigured ? (
        <form onSubmit={handleSaveApiAndStartQR} style={{ display: 'flex', flexDirection: 'column', gap: 14, width: '100%' }} noValidate>
          <p style={{ fontSize: 13, color: 'var(--md-on-surface)', opacity: 0.8, textAlign: 'center', lineHeight: 1.5, margin: 0 }}>
            {t.qrWarn}
          </p>
          <ApiConfigForm
            apiId={apiId}
            setApiId={setApiId}
            apiHash={apiHash}
            setApiHash={setApiHash}
            fieldErrors={fieldErrors}
          />
          <SubmitBtn 
            loading={qrLoading} 
            label={t.qrSave} 
            loadingLabel={t.btnSending} 
            disabled={!apiId.trim() || apiHash.trim().length < 10} 
          />
        </form>
      ) : qrLoading ? (
        <div style={{ width: 220, height: 220, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--md-surface)', borderRadius: 16 }}>
          <div style={{ width: 40, height: 40, border: '3px solid var(--md-primary-container, #d3e3fd)', borderTopColor: 'var(--md-primary, #0b57d0)', borderRadius: '50%', animation: 'spin .8s linear infinite' }} />
        </div>
      ) : qrCodeUrl ? (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16, width: '100%' }}>
          <div style={{ position: 'relative' }}>
            <div style={{
              padding: 10, background: '#ffffff', borderRadius: 16,
              border: '1.5px solid var(--md-outline-variant, #c4c7cf)', boxShadow: '0 4px 12px rgba(0,0,0,.05)',
              opacity: secondsLeft === 0 ? 0.2 : 1, transition: 'opacity .3s',
            }}>
              <img
                src={qrCodeUrl}
                alt="Telegram QR Login"
                style={{ width: 200, height: 200, display: 'block', borderRadius: 8 }}
              />
            </div>

            {secondsLeft === 0 && (
              <div style={{
                position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column',
                alignItems: 'center', justifyContent: 'center', gap: 10,
              }}>
                <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--md-on-surface)' }}>{t.qrExpired}</span>
                <button
                  onClick={handleRefreshQR}
                  style={{
                    background: 'var(--md-primary, #0b57d0)', color: 'var(--md-on-primary, #ffffff)', border: 'none',
                    borderRadius: 100, padding: '8px 16px', fontSize: 13, fontWeight: 500, cursor: 'pointer',
                  }}
                >
                  {t.qrUpdate}
                </button>
              </div>
            )}
          </div>

          {secondsLeft > 0 && (
            <span style={{ fontSize: 12, color: 'var(--md-on-surface)', opacity: 0.8 }}>
              {t.qrExpiring} <strong style={{ color: 'var(--md-primary, #0b57d0)' }}>{secondsLeft} {t.sec}</strong>
            </span>
          )}
          
          {/* Collapsible API config link inside QR login for convenience */}
          <div style={{ border: '1px solid var(--md-outline-variant, #c4c7cf)', borderRadius: 10, overflow: 'hidden', width: '100%', marginTop: 8 }}>
            <button
              type="button"
              onClick={() => setShowApiConfig(v => !v)}
              style={{
                width: '100%', padding: '10px 14px', background: 'transparent', border: 'none', cursor: 'pointer',
                display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: 'var(--md-on-surface)', opacity: 0.8, fontSize: 12.5,
              }}
            >
              <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <Key size={13} /> {t.apiEdit}
              </span>
              {showApiConfig ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
            </button>
            {showApiConfig && (
              <div style={{ padding: '12px', borderTop: '1px solid var(--md-outline-variant, #c4c7cf)', background: 'var(--md-surface, #f0f4f9)' }}>
                <ApiConfigForm
                  apiId={apiId}
                  setApiId={setApiId}
                  apiHash={apiHash}
                  setApiHash={setApiHash}
                  fieldErrors={fieldErrors}
                  onApply={handleSaveApiAndApplyQR}
                  applyLabel={t.apiApply}
                />
              </div>
            )}
          </div>
        </div>
      ) : (
        <div style={{ width: 220, height: 220, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--md-surface)', borderRadius: 16 }}>
          <button
            onClick={handleRefreshQR}
            style={{
              background: 'var(--md-primary, #0b57d0)', color: 'var(--md-on-primary, #ffffff)', border: 'none',
              borderRadius: 100, padding: '10px 20px', fontSize: 13, fontWeight: 500, cursor: 'pointer',
            }}
          >
            {t.qrStart}
          </button>
        </div>
      )}
    </div>
  );
}
