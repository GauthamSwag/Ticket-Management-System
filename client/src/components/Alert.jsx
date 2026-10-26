import React from 'react';
import { AlertCircle, CheckCircle2, Info, X } from 'lucide-react';

const Alert = ({ type = 'error', message, onClose }) => {
  if (!message) return null;

  const icons = {
    error: <AlertCircle size={18} className="text-danger" style={{ flexShrink: 0 }} />,
    success: <CheckCircle2 size={18} className="text-success" style={{ flexShrink: 0 }} />,
    info: <Info size={18} className="text-info" style={{ flexShrink: 0 }} />,
  };

  return (
    <div className={`alert alert-${type}`}>
      {icons[type] || icons.info}
      <div style={{ flex: 1 }}>{message}</div>
      {onClose && (
        <button
          onClick={onClose}
          style={{
            background: 'none',
            border: 'none',
            color: 'inherit',
            cursor: 'pointer',
            padding: 0,
            display: 'flex',
          }}
          aria-label="Close notification"
        >
          <X size={16} />
        </button>
      )}
    </div>
  );
};

export default Alert;
