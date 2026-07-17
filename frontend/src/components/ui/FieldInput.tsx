import React, { useState } from 'react';
import { Eye, EyeOff, AlertCircle } from 'lucide-react';

interface FieldInputProps {
  label?: string;
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  helper?: string;
  placeholder?: string;
  autofocus?: boolean;
  readOnly?: boolean;
  type?: string;
  icon?: React.ComponentType<{ size: number }>;
  error?: string;
}

export default function FieldInput({
  label,
  value,
  onChange,
  helper = '',
  placeholder = '',
  autofocus = false,
  readOnly = false,
  type = 'text',
  icon: Icon,
  error
}: FieldInputProps) {
  const [showPass, setShowPass] = useState(false);
  const [focused, setFocused] = useState(false);
  const isPassword = type === 'password';
  const currentType = isPassword ? (showPass ? 'text' : 'password') : type;
  const hasError = !!error;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4, width: '100%' }}>
      {label && (
        <label 
          style={{ 
            fontSize: 12, 
            fontWeight: 500, 
            color: hasError ? 'var(--md-error)' : focused ? 'var(--md-primary)' : 'var(--md-on-surface)',
            opacity: focused || hasError ? 1 : 0.75
          }}
        >
          {label}
        </label>
      )}
      <div style={{ position: 'relative', display: 'flex', alignItems: 'center', width: '100%' }}>
        {Icon && (
          <div style={{
            position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)',
            color: hasError ? 'var(--md-error)' : focused ? 'var(--md-primary)' : 'var(--md-on-surface-variant)',
            pointerEvents: 'none', transition: 'color .15s',
            display: 'flex', alignItems: 'center'
          }}>
            <Icon size={17} />
          </div>
        )}
        <input 
          value={value} 
          onChange={onChange} 
          placeholder={placeholder} 
          readOnly={readOnly} 
          autoFocus={autofocus} 
          type={currentType}
          onFocus={e => {
            setFocused(true);
            if (!readOnly) {
              e.target.style.borderColor = hasError ? 'var(--md-error)' : 'var(--md-primary)';
              e.target.style.boxShadow = hasError 
                ? '0 0 0 2px rgba(179,38,30,.16)' 
                : '0 0 0 2px rgba(11,87,208,.16)';
            }
          }}
          onBlur={e => {
            setFocused(false);
            e.target.style.borderColor = hasError ? 'var(--md-error)' : 'var(--md-outline)';
            e.target.style.boxShadow = 'none';
          }}
          style={{ 
            width: '100%', 
            padding: Icon ? '13px 16px 13px 42px' : '13px 16px', 
            borderRadius: 8,
            border: `1.5px solid ${hasError ? 'var(--md-error)' : 'var(--md-outline)'}`, 
            background: 'transparent',
            color: 'var(--md-on-surface)', 
            fontSize: 15, 
            fontFamily: 'Roboto,sans-serif', 
            outline: 'none',
            boxSizing: 'border-box',
            transition: 'border-color .15s, box-shadow .15s'
          }}
        />
        {isPassword && (
          <button
            type="button"
            onClick={() => setShowPass(!showPass)}
            style={{
              position: 'absolute', right: 12, background: 'transparent', border: 'none', cursor: 'pointer',
              color: 'var(--md-on-surface-variant)', display: 'flex', alignItems: 'center', justifyContent: 'center'
            }}
          >
            {showPass ? <EyeOff size={20} /> : <Eye size={20} />}
          </button>
        )}
      </div>
      {(helper || error) && (
        <span 
          style={{ 
            fontSize: 12, 
            color: hasError ? 'var(--md-error)' : 'var(--md-on-surface-variant)',
            display: 'flex', alignItems: 'center', gap: 4
          }}
        >
          {hasError && <AlertCircle size={12} />}
          {error || helper}
        </span>
      )}
    </div>
  );
}
