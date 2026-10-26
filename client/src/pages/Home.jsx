import React from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
  Ticket,
  Shield,
  LifeBuoy,
  Users,
  CheckCircle2,
  ArrowRight,
  Database,
  Lock,
  Cpu,
  Layers,
} from 'lucide-react';

const Home = () => {
  const { isAuthenticated } = useAuth();

  return (
    <div className="container" style={{ padding: '4rem 1.5rem 6rem' }}>
      {/* Hero Section */}
      <div style={{ textAlign: 'center', maxWidth: '820px', margin: '0 auto 5rem' }}>
        <div
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.5rem',
            padding: '0.4rem 1rem',
            borderRadius: 'var(--radius-full)',
            background: 'rgba(99, 102, 241, 0.12)',
            border: '1px solid rgba(99, 102, 241, 0.3)',
            color: '#a5b4fc',
            fontSize: '0.85rem',
            fontWeight: 600,
            marginBottom: '1.5rem',
          }}
        >
          <Cpu size={14} /> Full Stack MERN Architecture &bull; Production Ready
        </div>

        <h1
          style={{
            fontSize: 'clamp(2.5rem, 5vw, 3.75rem)',
            lineHeight: 1.15,
            marginBottom: '1.5rem',
            background: 'linear-gradient(to right, #ffffff, #cbd5e1)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
          }}
        >
          Enterprise Ticket Management System
        </h1>

        <p
          style={{
            fontSize: '1.15rem',
            color: 'var(--text-muted)',
            lineHeight: 1.7,
            marginBottom: '2.5rem',
          }}
        >
          Streamlined support workflows, granular role-based authorization, and high-performance issue resolution engineered with MongoDB, Express, React, and Node.js.
        </p>

        <div style={{ display: 'flex', justifyContent: 'center', gap: '1rem', flexWrap: 'wrap' }}>
          {isAuthenticated ? (
            <Link to="/dashboard" className="btn btn-primary" style={{ padding: '0.85rem 1.75rem', fontSize: '1rem' }}>
              Open Dashboard <ArrowRight size={18} />
            </Link>
          ) : (
            <>
              <Link to="/login" className="btn btn-primary" style={{ padding: '0.85rem 1.75rem', fontSize: '1rem' }}>
                Sign In to Portal <ArrowRight size={18} />
              </Link>
              <Link to="/register" className="btn btn-secondary" style={{ padding: '0.85rem 1.75rem', fontSize: '1rem' }}>
                Create Account
              </Link>
            </>
          )}
        </div>
      </div>

      {/* Role Ecosystem Section */}
      <div style={{ marginBottom: '5rem' }}>
        <div style={{ textAlign: 'center', marginBottom: '3rem' }}>
          <h2 style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>Role-Based Access Hierarchy</h2>
          <p style={{ color: 'var(--text-muted)' }}>Three specialized roles engineered with strict server-side access control</p>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '2rem' }}>
          {/* User Card */}
          <div className="card" style={{ display: 'flex', flexDirection: 'column' }}>
            <div
              style={{
                width: '48px',
                height: '48px',
                borderRadius: 'var(--radius-md)',
                background: 'rgba(16, 185, 129, 0.15)',
                color: '#10b981',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: '1.25rem',
              }}
            >
              <Users size={24} />
            </div>
            <h3 style={{ fontSize: '1.3rem', marginBottom: '0.5rem' }}>User (Customer)</h3>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: '1.5rem', flex: 1 }}>
              Submit technical and billing requests, track real-time resolution stages, interact via comments, and review personal ticket history.
            </p>
            <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '1rem', fontSize: '0.85rem', color: '#6ee7b7' }}>
              ✓ Create Tickets &bull; Track Status &bull; Comment
            </div>
          </div>

          {/* Support Agent Card */}
          <div className="card" style={{ display: 'flex', flexDirection: 'column' }}>
            <div
              style={{
                width: '48px',
                height: '48px',
                borderRadius: 'var(--radius-md)',
                background: 'rgba(6, 182, 212, 0.15)',
                color: '#06b6d4',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: '1.25rem',
              }}
            >
              <LifeBuoy size={24} />
            </div>
            <h3 style={{ fontSize: '1.3rem', marginBottom: '0.5rem' }}>Support Agent</h3>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: '1.5rem', flex: 1 }}>
              Manage assigned queue, adjust incident severity and priorities, update resolution states (Open &rarr; In Progress &rarr; Resolved), and communicate with users.
            </p>
            <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '1rem', fontSize: '0.85rem', color: '#67e8f9' }}>
              ✓ Assigned Queue &bull; Status Transitions &bull; Internal Resolution
            </div>
          </div>

          {/* Administrator Card */}
          <div className="card" style={{ display: 'flex', flexDirection: 'column' }}>
            <div
              style={{
                width: '48px',
                height: '48px',
                borderRadius: 'var(--radius-md)',
                background: 'rgba(168, 85, 247, 0.15)',
                color: '#a855f7',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: '1.25rem',
              }}
            >
              <Shield size={24} />
            </div>
            <h3 style={{ fontSize: '1.3rem', marginBottom: '0.5rem' }}>Administrator</h3>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: '1.5rem', flex: 1 }}>
              Complete system governance: manage user accounts, assign support staff, configure ticket categories, monitor SLA compliance, and view global analytics.
            </p>
            <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '1rem', fontSize: '0.85rem', color: '#d8b4fe' }}>
              ✓ User Management &bull; System Audits &bull; Global Metrics
            </div>
          </div>
        </div>
      </div>

      {/* Tech Stack Banner */}
      <div
        className="card"
        style={{
          background: 'linear-gradient(135deg, rgba(17, 24, 39, 0.95), rgba(30, 27, 75, 0.6))',
          borderColor: 'rgba(99, 102, 241, 0.25)',
        }}
      >
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '2rem', textAlign: 'center' }}>
          <div>
            <div style={{ fontSize: '1.25rem', fontWeight: 700, color: '#60a5fa', marginBottom: '0.25rem' }}>React 18 + Vite</div>
            <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Ultra-fast client SPA with React Router & Context</div>
          </div>
          <div>
            <div style={{ fontSize: '1.25rem', fontWeight: 700, color: '#4ade80', marginBottom: '0.25rem' }}>Node + Express</div>
            <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>RESTful API with modular controllers & middleware</div>
          </div>
          <div>
            <div style={{ fontSize: '1.25rem', fontWeight: 700, color: '#34d399', marginBottom: '0.25rem' }}>MongoDB & Mongoose</div>
            <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Document store with schema validation & indexing</div>
          </div>
          <div>
            <div style={{ fontSize: '1.25rem', fontWeight: 700, color: '#c084fc', marginBottom: '0.25rem' }}>JWT & Bcrypt</div>
            <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Cryptographic authentication & 10-round salted hashing</div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Home;
