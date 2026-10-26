import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { ShieldAlert } from 'lucide-react';

const ProtectedRoute = ({ children, allowedRoles }) => {
  const { user, isAuthenticated, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '60vh',
          gap: '1rem',
        }}
      >
        <div className="spinner" style={{ width: '36px', height: '36px', borderWidth: '3px' }}></div>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>Verifying session...</p>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // Check role authorization if restricted
  if (allowedRoles && !allowedRoles.includes(user?.role)) {
    return (
      <div className="container" style={{ padding: '4rem 1.5rem', textAlign: 'center' }}>
        <div className="card" style={{ maxWidth: '500px', margin: '0 auto', textAlign: 'center' }}>
          <div
            style={{
              width: '56px',
              height: '56px',
              borderRadius: '50%',
              background: 'rgba(239, 68, 68, 0.15)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 1.5rem',
              color: '#ef4444',
            }}
          >
            <ShieldAlert size={28} />
          </div>
          <h2 style={{ marginBottom: '0.5rem' }}>Access Restricted</h2>
          <p style={{ color: 'var(--text-muted)', marginBottom: '1.5rem', fontSize: '0.925rem' }}>
            Your account role (<strong>{user?.role}</strong>) does not have permission to view this section.
          </p>
          <a href="/dashboard" className="btn btn-primary btn-sm">
            Return to Dashboard
          </a>
        </div>
      </div>
    );
  }

  return children;
};

export default ProtectedRoute;
