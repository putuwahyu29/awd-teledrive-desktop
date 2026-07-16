import React from 'react';
import { Key, Hash } from 'lucide-react';
import FieldInput from '../ui/FieldInput';

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
