import React from 'react';
import { Phone, KeyRound, Lock, Key, ChevronDown, ChevronUp } from 'lucide-react';
import FieldInput from '../ui/FieldInput';
import { SubmitBtn } from '../ui/Button';
import ApiConfigForm from './ApiConfigForm';

interface PhoneLoginFlowProps {
  step: number;
  setStep: (s: number) => void;
  t: any;
  lang: string;
  phone: string;
  setPhone: (p: string) => void;
  code: string;
  setCode: (c: string) => void;
  password: string;
  setPassword: (p: string) => void;
  apiId: string;
  setApiId: (v: string) => void;
  apiHash: string;
  setApiHash: (v: string) => void;
  showApiConfig: boolean;
  setShowApiConfig: React.Dispatch<React.SetStateAction<boolean>>;
  loading: boolean;
  fieldErrors: Record<string, string>;
  clearErrors: () => void;
  handleSendCode: (e: React.FormEvent) => void;
  handleVerifyCode: (e: React.FormEvent) => void;
  handlePassword: (e: React.FormEvent) => void;
  isApiConfigured: boolean;
}

export default function PhoneLoginFlow({
  step,
  setStep,
  t,
  lang,
  phone,
  setPhone,
  code,
  setCode,
  password,
  setPassword,
  apiId,
  setApiId,
  apiHash,
  setApiHash,
  showApiConfig,
  setShowApiConfig,
  loading,
  fieldErrors,
  clearErrors,
  handleSendCode,
  handleVerifyCode,
  handlePassword,
  isApiConfigured
}: PhoneLoginFlowProps) {
  const canSubmitStep1 = phone.trim().length >= 7 && apiId.trim().length > 0 && apiHash.trim().length >= 10;
  const canSubmitStep2 = code.trim().length >= 4;
  const canSubmitStep3 = password.trim().length > 0;
  const stepLabels = ['', t.stepL1, t.stepL2, t.stepL3];

  return (
    <>
      <div>
        <h2 style={{ fontFamily: 'Google Sans, sans-serif', fontSize: 22, fontWeight: 500, color: 'var(--on-surface)', marginBottom: 4 }}>
          {step === 1 ? t.loginPhone : step === 2 ? t.verifyOtp : t.verify2fa}
        </h2>
        <p style={{ color: 'var(--on-surface-variant)', fontSize: 13.5, margin: 0 }}>
          {step === 1 && t.descPhone}
          {step === 2 && t.descOtp}
          {step === 3 && t.desc2fa}
        </p>
      </div>

      {/* Step progress bar */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <div style={{ display: 'flex', gap: 5, alignItems: 'center' }}>
          {[1, 2, 3].map(s => (
            <div key={s} style={{ flex: 1, height: 3, borderRadius: 2, background: s <= step ? 'var(--primary, #0b57d0)' : 'var(--outline-variant, #c4c7cf)', transition: 'background .3s' }} />
          ))}
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          {[1, 2, 3].map(s => (
            <span key={s} style={{ fontSize: 10, color: s <= step ? 'var(--primary, #0b57d0)' : 'var(--on-surface-variant, #44474f)', fontWeight: s === step ? 600 : 400 }}>
              {stepLabels[s]}
            </span>
          ))}
        </div>
      </div>

      {step === 1 && (
        <form onSubmit={handleSendCode} style={{ display: 'flex', flexDirection: 'column', gap: 14 }} noValidate>
          <FieldInput
            icon={Phone} 
            type="tel" 
            label={t.phoneLabel}
            placeholder="+62 812 3456 7890"
            value={phone} 
            onChange={e => setPhone(e.target.value)}
            error={fieldErrors.phone} 
            autofocus
          />

          <div style={{ border: '1.5px solid var(--outline-variant, #c4c7cf)', borderRadius: 10, overflow: 'hidden' }}>
            <button
              type="button"
              onClick={() => setShowApiConfig(v => !v)}
              style={{
                width: '100%', padding: '11px 14px',
                background: showApiConfig ? 'var(--primary-container, #d3e3fd)' : 'transparent',
                border: 'none', cursor: 'pointer',
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                color: 'var(--on-surface)', fontSize: 13.5, fontWeight: 500,
                fontFamily: 'inherit'
              }}
            >
              <span style={{ display: 'flex', alignItems: 'center', gap: 8, color: isApiConfigured ? 'var(--primary, #0b57d0)' : 'var(--on-surface)' }}>
                <Key size={15} />
                {t.apiConfig}
                {isApiConfigured && <span style={{ fontSize: 10, background: 'var(--primary, #0b57d0)', color: 'white', padding: '1px 6px', borderRadius: 10, fontWeight: 600 }}>{t.apiSaved}</span>}
              </span>
              {showApiConfig ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
            </button>

            {showApiConfig && (
              <div style={{ padding: '14px', borderTop: '1px solid var(--outline-variant, #c4c7cf)', background: 'var(--surface, #f0f4f9)' }}>
                <ApiConfigForm
                  apiId={apiId}
                  setApiId={setApiId}
                  apiHash={apiHash}
                  setApiHash={setApiHash}
                  fieldErrors={fieldErrors}
                />
              </div>
            )}
          </div>

          <SubmitBtn loading={loading} label={t.btnSendOtp} loadingLabel={t.btnSending} disabled={!canSubmitStep1} />
        </form>
      )}

      {step === 2 && (
        <form onSubmit={handleVerifyCode} style={{ display: 'flex', flexDirection: 'column', gap: 14 }} noValidate>
          <FieldInput
            icon={KeyRound} 
            type="text" 
            label={t.stepL2}
            placeholder="12345"
            value={code} 
            onChange={e => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
            error={fieldErrors.code}
            autofocus
          />
          <SubmitBtn loading={loading} label={t.btnVerify} loadingLabel={t.btnVerifying} disabled={!canSubmitStep2} />
          <button 
            type="button" 
            onClick={() => { setStep(1); clearErrors(); }}
            style={{ background: 'none', border: 'none', color: 'var(--primary, #0b57d0)', fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' }}
          >
            {t.btnBack}
          </button>
        </form>
      )}

      {step === 3 && (
        <form onSubmit={handlePassword} style={{ display: 'flex', flexDirection: 'column', gap: 14 }} noValidate>
          <FieldInput
            icon={Lock} 
            type="password" 
            label="Cloud Password"
            placeholder="Cloud password Telegram"
            value={password} 
            onChange={e => setPassword(e.target.value)}
            error={fieldErrors.password}
            autofocus
          />
          <SubmitBtn loading={loading} label={t.btnSubmitLogin} loadingLabel={t.btnVerifying} disabled={!canSubmitStep3} />
        </form>
      )}
    </>
  );
}
