import React from 'react';

interface ButtonProps {
  children: React.ReactNode;
  onClick?: (e: React.MouseEvent<HTMLButtonElement>) => void;
  style?: React.CSSProperties;
  type?: 'button' | 'reset' | 'submit';
  disabled?: boolean;
}

export function BtnFill({ children, onClick, style = {}, type = 'button', disabled = false }: ButtonProps) {
  return (
    <button 
      type={type} 
      onClick={onClick} 
      disabled={disabled}
      style={{
        background: 'var(--md-primary)', color: 'var(--md-on-primary)',
        border: 'none', borderRadius: 100, padding: '10px 24px',
        fontFamily: 'Google Sans,sans-serif', fontSize: 14, fontWeight: 500, cursor: 'pointer',
        opacity: disabled ? 0.6 : 1,
        pointerEvents: disabled ? 'none' : 'auto',
        ...style,
      }}
    >
      {children}
    </button>
  );
}

export function BtnTonal({ children, onClick, type = 'button', style = {}, disabled = false }: ButtonProps) {
  return (
    <button 
      type={type} 
      onClick={onClick} 
      disabled={disabled}
      style={{
        background: 'transparent', color: 'var(--md-primary)',
        border: 'none', borderRadius: 100, padding: '10px 20px',
        fontFamily: 'Google Sans,sans-serif', fontSize: 14, fontWeight: 500, cursor: 'pointer',
        transition: 'background .15s',
        opacity: disabled ? 0.6 : 1,
        pointerEvents: disabled ? 'none' : 'auto',
        ...style,
      }}
      onMouseEnter={e => {
        if (!disabled) e.currentTarget.style.background = 'var(--md-surface-container-highest)';
      }}
      onMouseLeave={e => {
        if (!disabled) e.currentTarget.style.background = 'transparent';
      }}
    >
      {children}
    </button>
  );
}

interface SubmitBtnProps {
  loading: boolean;
  label: string;
  loadingLabel: string;
  disabled?: boolean;
  style?: React.CSSProperties;
}

export function SubmitBtn({ loading, label, loadingLabel, disabled = false, style = {} }: SubmitBtnProps) {
  const isDisabled = loading || disabled;
  return (
    <button 
      type="submit" 
      disabled={isDisabled}
      style={{
        background: isDisabled ? 'var(--outline-variant, #c4c7cf)' : 'var(--primary, #0b57d0)',
        color: isDisabled ? 'var(--on-surface-variant, #44474f)' : 'var(--on-primary, #ffffff)',
        border: 'none', borderRadius: 100, padding: '13px',
        width: '100%', fontFamily: 'Google Sans, sans-serif',
        fontSize: 15, fontWeight: 500,
        cursor: isDisabled ? 'not-allowed' : 'pointer',
        transition: 'background .2s, color .2s',
        letterSpacing: '0.2px',
        opacity: disabled && !loading ? 0.6 : 1,
        ...style,
      }}
    >
      {loading ? (
        <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
          <span 
            style={{ 
              width: 16, height: 16, border: '2px solid currentColor', 
              borderTopColor: 'transparent', borderRadius: '50%', 
              display: 'inline-block', animation: 'spin .6s linear infinite' 
            }} 
          />
          {loadingLabel}
        </span>
      ) : label}
    </button>
  );
}
