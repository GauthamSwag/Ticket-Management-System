import React from 'react';
import { Link } from 'react-router-dom';
import { HelpCircle, ArrowLeft } from 'lucide-react';

const NotFound = () => {
  return (
    <div className="container" style={{ padding: '6rem 1.5rem', textAlign: 'center' }}>
      <div className="card" style={{ maxWidth: '480px', margin: '0 auto', textAlign: 'center' }}>
        <div
          style={{
            width: '64px',
            height: '64px',
            borderRadius: '50%',
            background: 'rgba(99, 102, 241, 0.15)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 1.5rem',
            color: '#6366f1',
          }}
        >
          <HelpCircle size={32} />
        </div>
        <h1 style={{ fontSize: '2.5rem', marginBottom: '0.5rem' }}>404</h1>
        <h2 style={{ fontSize: '1.25rem', marginBottom: '0.75rem' }}>Page Not Found</h2>
        <p style={{ color: 'var(--text-muted)', marginBottom: '1.75rem', fontSize: '0.925rem' }}>
          The page or route you requested does not exist or has been relocated.
        </p>
        <Link to="/" className="btn btn-primary" style={{ display: 'inline-flex' }}>
          <ArrowLeft size={16} /> Return to Home
        </Link>
      </div>
    </div>
  );
};

export default NotFound;
