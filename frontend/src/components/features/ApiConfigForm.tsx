import React from 'react';
import { Key, Hash, HelpCircle } from 'lucide-react';
import FieldInput from '../ui/FieldInput';
import { BrowserOpenURL } from '../../../wailsjs/runtime/runtime';

interface ApiConfigFormProps {
  apiId: string;
  setApiId: (v: string) => void;
  apiHash: string;
  setApiHash: (v: string) => void;
  fieldErrors?: Record<string, string>;
  onApply?: () => void;
  applyLabel?: string;
}

export default function ApiConfigForm({
  apiId,
  setApiId,
  apiHash,
  setApiHash,
  fieldErrors = {},
  onApply,
  applyLabel
}: ApiConfigFormProps) {
  const lang = localStorage.getItem('lang') || 'id';

  const handleOpenGuide = () => {
    BrowserOpenURL('https://my.telegram.org/apps');
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <FieldInput
        icon={Hash}
        type="text"
        label="API ID"
        placeholder="12345678"
        value={apiId}
        onChange={e => setApiId(e.target.value)}
        error={fieldErrors.apiId}
      />
      <FieldInput
        icon={Key}
        type="text"
        label="API Hash"
        placeholder="a1b2c3d4e5f6..."
        value={apiHash}
        onChange={e => setApiHash(e.target.value)}
        error={fieldErrors.apiHash}
      />

      <div style={{
        marginTop: 6,
        padding: '12px 14px',
        borderRadius: 8,
        background: 'var(--md-surface-container-high, #e7ecf3)',
        border: '1px solid var(--md-outline-variant, #c4c7cf)',
        fontSize: '11.5px',
        color: 'var(--md-on-surface, #1a1c1e)',
        opacity: 0.85,
        lineHeight: '1.5',
      }}>
        <div style={{ fontWeight: 600, color: 'var(--primary, #0b57d0)', marginBottom: 6, display: 'flex', alignItems: 'center', gap: 5 }}>
          <HelpCircle size={14} />
          <span>{lang === 'id' ? 'Panduan Mendapatkan API ID & Hash:' : 'How to get API ID & Hash:'}</span>
        </div>
        <ol style={{ paddingLeft: 16, margin: '0 0 4px 0', display: 'flex', flexDirection: 'column', gap: 4 }}>
          <li>
            {lang === 'id' 
              ? 'Buka dan masuk (login) di ' 
              : 'Go to and login at '}
            <span 
              onClick={handleOpenGuide}
              style={{ color: 'var(--primary, #0b57d0)', textDecoration: 'underline', cursor: 'pointer', fontWeight: 600 }}
            >
              my.telegram.org
            </span>
          </li>
          <li>
            {lang === 'id'
              ? 'Pilih menu "API development tools"'
              : 'Select the "API development tools" menu'}
          </li>
          <li>
            {lang === 'id'
              ? 'Isi formulir pembuatan aplikasi baru untuk mendapatkan API ID & API Hash Anda.'
              : 'Fill in the form to register a new application and get your API ID & API Hash.'}
          </li>
        </ol>
      </div>

      {onApply && applyLabel && (
        <button
          type="button"
          onClick={onApply}
          style={{
            background: 'var(--primary, #0b57d0)',
            color: 'white',
            border: 'none',
            borderRadius: 8,
            padding: '8px',
            fontSize: 12,
            fontWeight: 500,
            cursor: 'pointer',
            fontFamily: 'inherit',
            transition: 'background 0.2s',
            marginTop: 4
          }}
          onMouseEnter={e => e.currentTarget.style.filter = 'brightness(1.1)'}
          onMouseLeave={e => e.currentTarget.style.filter = 'none'}
        >
          {applyLabel}
        </button>
      )}
    </div>
  );
}
