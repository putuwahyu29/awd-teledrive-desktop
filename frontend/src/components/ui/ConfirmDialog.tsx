import React from 'react';
import { Trash2, AlertCircle } from 'lucide-react';

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  message: string;
  onConfirm: () => void;
  onCancel: () => void;
  danger?: boolean;
}

export default function ConfirmDialog({ open, title, message, onConfirm, onCancel, danger = false }: ConfirmDialogProps) {
  if (!open) return null;
  return (
    <div 
      style={{ 
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,.32)', zIndex: 5000,
        display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(10px)' 
      }}
      onClick={onCancel}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: 'var(--md-surface-container)', borderRadius: 28,
          width: 400, maxWidth: '92%', overflow: 'hidden',
          boxShadow: '0 12px 48px rgba(0,0,0,.28)', animation: 'gdAnim .18s ease',
        }}
      >
        {/* Icon */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '32px 32px 20px', gap: 16 }}>
          <div style={{
            width: 60, height: 60, borderRadius: '50%',
            background: danger ? 'rgba(179,38,30,.12)' : 'var(--md-secondary-container)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            {danger
              ? <Trash2 size={28} color="var(--md-error)"/>
              : <AlertCircle size={28} color="var(--md-primary)"/>
            }
          </div>
          <div style={{ textAlign: 'center' }}>
            <h2 style={{ fontFamily: 'Google Sans,sans-serif', fontSize: 20, fontWeight: 600, color: 'var(--md-on-surface)', marginBottom: 8 }}>
              {title}
            </h2>
            <p style={{ fontSize: 14, color: 'var(--md-on-surface-variant)', lineHeight: 1.6 }}>{message}</p>
          </div>
        </div>
        {/* Actions */}
        <div style={{ display: 'flex', padding: '8px 20px 24px', gap: 8, justifyContent: 'center' }}>
          <button 
            onClick={onCancel} 
            style={{
              flex: 1, padding: '12px 0', borderRadius: 100, border: '1.5px solid var(--md-outline-variant)',
              background: 'transparent', color: 'var(--md-on-surface)', fontFamily: 'Google Sans,sans-serif',
              fontSize: 14, fontWeight: 500, cursor: 'pointer', transition: 'all 0.2s cubic-bezier(0.2, 0, 0, 1)',
            }}
            onMouseEnter={e => {
              e.currentTarget.style.background = 'var(--md-surface-container-high)';
              e.currentTarget.style.transform = 'scale(1.02)';
            }}
            onMouseLeave={e => {
              e.currentTarget.style.background = 'transparent';
              e.currentTarget.style.transform = 'scale(1)';
            }}
          >
            Batal
          </button>
          <button 
            onClick={onConfirm} 
            style={{
              flex: 1, padding: '12px 0', borderRadius: 100, border: 'none',
              background: danger ? 'var(--md-error)' : 'var(--md-primary)',
              color: danger ? 'var(--md-on-error)' : 'var(--md-on-primary)',
              fontFamily: 'Google Sans,sans-serif', fontSize: 14, fontWeight: 600,
              cursor: 'pointer', transition: 'all 0.2s cubic-bezier(0.2, 0, 0, 1)',
            }}
            onMouseEnter={e => {
              e.currentTarget.style.opacity = '.88';
              e.currentTarget.style.transform = 'scale(1.02)';
            }}
            onMouseLeave={e => {
              e.currentTarget.style.opacity = '1';
              e.currentTarget.style.transform = 'scale(1)';
            }}
          >
            {danger ? 'Hapus' : 'OK'}
          </button>
        </div>
      </div>
    </div>
  );
}
