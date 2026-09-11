import React from 'react';
import { AlertCircle, CheckCircle2, Info, AlertTriangle, X } from 'lucide-react';

interface AlertProps {
  type?: 'error' | 'success' | 'warning' | 'info';
  message: string;
  details?: { field: string; message: string }[];
  onClose?: () => void;
}

export const Alert: React.FC<AlertProps> = ({
  type = 'info',
  message,
  details,
  onClose,
}) => {
  if (!message) return null;

  const icons = {
    error: <AlertCircle className="alert-icon" size={20} />,
    success: <CheckCircle2 className="alert-icon" size={20} />,
    warning: <AlertTriangle className="alert-icon" size={20} />,
    info: <Info className="alert-icon" size={20} />,
  };

  return (
    <div className={`alert alert-${type}`} role="alert">
      <div className="alert-content">
        <div className="alert-header">
          {icons[type]}
          <span className="alert-message">{message}</span>
        </div>
        {details && details.length > 0 && (
          <ul className="alert-details-list">
            {details.map((d, i) => (
              <li key={i}>
                <strong>{d.field}</strong>: {d.message}
              </li>
            ))}
          </ul>
        )}
      </div>
      {onClose && (
        <button type="button" className="alert-close" onClick={onClose} aria-label="Dismiss alert">
          <X size={16} />
        </button>
      )}
    </div>
  );
};
