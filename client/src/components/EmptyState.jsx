import React from 'react';
import { Link } from 'react-router-dom';
import { Inbox } from 'lucide-react';

const EmptyState = ({
  icon,
  title = 'No items found',
  description = 'There are no records matching your current criteria.',
  actionText,
  actionLink,
  onAction,
  secondaryActionText,
  onSecondaryAction,
}) => {
  return (
    <div
      className="card"
      style={{
        textAlign: 'center',
        padding: '4rem 1.5rem',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        backdropFilter: 'blur(16px)',
      }}
    >
      <div
        style={{
          width: '64px',
          height: '64px',
          borderRadius: '50%',
          background: 'rgba(99, 102, 241, 0.12)',
          border: '1px solid rgba(99, 102, 241, 0.25)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: '1.25rem',
          color: 'var(--primary)',
        }}
      >
        {icon || <Inbox size={30} />}
      </div>

      <h3
        style={{
          fontSize: '1.25rem',
          fontWeight: 700,
          color: 'var(--text-main)',
          marginBottom: '0.45rem',
          letterSpacing: '-0.01em',
        }}
      >
        {title}
      </h3>

      <p
        style={{
          fontSize: '0.9rem',
          color: 'var(--text-muted)',
          maxWidth: '440px',
          margin: '0 auto 1.75rem',
          lineHeight: 1.5,
        }}
      >
        {description}
      </p>

      {(actionText || secondaryActionText) && (
        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap', justifyContent: 'center' }}>
          {secondaryActionText && onSecondaryAction && (
            <button
              type="button"
              className="btn btn-secondary"
              onClick={onSecondaryAction}
            >
              {secondaryActionText}
            </button>
          )}

          {actionText && actionLink && (
            <Link to={actionLink} className="btn btn-primary">
              {actionText}
            </Link>
          )}

          {actionText && onAction && !actionLink && (
            <button type="button" className="btn btn-primary" onClick={onAction}>
              {actionText}
            </button>
          )}
        </div>
      )}
    </div>
  );
};

export default EmptyState;
