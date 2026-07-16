import React from 'react';

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  actions?: React.ReactNode;
  width?: number;
}

export default function Modal({ open, onClose, title, children, actions, width = 420 }: ModalProps) {
  if (!open) return null;
  return (
    <div 
      style={{ 
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,.32)', zIndex: 2000, 
        display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16,
        backdropFilter: 'blur(10px)'
      }}
      onClick={onClose}
    >
      <div 
        style={{
          background: 'var(--md-surface-container)', borderRadius: 28, width: '100%', maxWidth: width,
          maxHeight: 'calc(100vh - 48px)', display: 'flex', flexDirection: 'column',
          boxShadow: '0 8px 40px rgba(0,0,0,.2)', overflow: 'hidden', animation: 'gdAnim .2s ease',
        }}
        onClick={e => e.stopPropagation()}
      >
        <div style={{ padding: '24px 24px 12px', fontFamily: 'Google Sans,sans-serif', fontSize: 22, fontWeight: 500, color: 'var(--md-on-surface)', flexShrink: 0 }}>
          {title}
        </div>
        <div style={{ padding: '0 24px 8px', overflowY: 'auto', flex: 1, minHeight: 0 }}>{children}</div>
        {actions && (
          <div style={{ padding: '12px 16px', display: 'flex', justifyContent: 'flex-end', gap: 8, flexShrink: 0, borderTop: '1px solid var(--md-outline-variant)' }}>
            {actions}
          </div>
        )}
      </div>
    </div>
  );
}
