import React, { createContext, useContext, useState, useCallback } from 'react';
import { CheckCircle2, AlertCircle, AlertTriangle, Info, X } from 'lucide-react';

const ToastContext = createContext(null);

export const ToastProvider = ({ children }) => {
  const [toasts, setToasts] = useState([]);

  const removeToast = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const addToast = useCallback((message, type = 'info', duration = 4000) => {
    const id = Date.now().toString() + Math.random().toString(36).substring(2, 6);
    const newToast = { id, message, type, duration };

    setToasts((prev) => [...prev, newToast]);

    if (duration > 0) {
      setTimeout(() => {
        removeToast(id);
      }, duration);
    }
  }, [removeToast]);

  const toast = {
    success: (msg, duration) => addToast(msg, 'success', duration),
    error: (msg, duration) => addToast(msg, 'error', duration),
    warning: (msg, duration) => addToast(msg, 'warning', duration),
    info: (msg, duration) => addToast(msg, 'info', duration),
  };

  const getToastIcon = (type) => {
    switch (type) {
      case 'success':
        return <CheckCircle2 size={18} color="var(--success)" style={{ flexShrink: 0, marginTop: '2px' }} />;
      case 'error':
        return <AlertCircle size={18} color="var(--danger)" style={{ flexShrink: 0, marginTop: '2px' }} />;
      case 'warning':
        return <AlertTriangle size={18} color="var(--warning)" style={{ flexShrink: 0, marginTop: '2px' }} />;
      default:
        return <Info size={18} color="var(--primary)" style={{ flexShrink: 0, marginTop: '2px' }} />;
    }
  };

  return (
    <ToastContext.Provider value={{ toast, addToast, removeToast }}>
      {children}
      {/* Global Floating Toast Container */}
      <div className="toast-container" aria-live="polite">
        {toasts.map((t) => (
          <div key={t.id} className={`toast-item toast-${t.type}`}>
            {getToastIcon(t.type)}
            <div style={{ flex: 1, minWidth: 0 }}>
              <p
                style={{
                  fontSize: '0.875rem',
                  fontWeight: 500,
                  lineHeight: 1.4,
                  margin: 0,
                  wordBreak: 'break-word',
                  color: '#ffffff',
                }}
              >
                {t.message}
              </p>
            </div>
            <button
              type="button"
              onClick={() => removeToast(t.id)}
              style={{
                background: 'none',
                border: 'none',
                color: 'var(--text-dim)',
                cursor: 'pointer',
                padding: '2px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                borderRadius: '4px',
                transition: 'color 0.15s ease',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.color = '#ffffff')}
              onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--text-dim)')}
              aria-label="Dismiss toast"
            >
              <X size={15} />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
};

export const useToast = () => {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
};

export default ToastContext;
