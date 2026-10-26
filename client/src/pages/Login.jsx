import React, { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import Alert from '../components/Alert';
import { Mail, Lock, Eye, EyeOff, Shield, LifeBuoy, User, ArrowRight } from 'lucide-react';

const Login = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  // If user came from a protected route
  const from = location.state?.from?.pathname || '/dashboard';

  // Demo account quick filler
  const fillDemoAccount = (role) => {
    switch (role) {
      case 'admin':
        setEmail('admin@example.com');
        setPassword('password123');
        break;
      case 'agent':
        setEmail('agent@example.com');
        setPassword('password123');
        break;
      case 'user':
        setEmail('user@example.com');
        setPassword('password123');
        break;
      default:
        break;
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMsg('');

    if (!email || !password) {
      setErrorMsg('Please enter both email and password.');
      return;
    }

    setIsSubmitting(true);
    const result = await login(email, password);
    setIsSubmitting(false);

    if (result.success) {
      navigate(from, { replace: true });
    } else {
      setErrorMsg(result.message);
    }
  };

  return (
    <div className="auth-wrapper">
      <div className="card auth-card">
        <div className="auth-header">
          <h1>Welcome Back</h1>
          <p>Sign in to access your TicketFlow workspace</p>
        </div>

        {errorMsg && <Alert type="error" message={errorMsg} onClose={() => setErrorMsg('')} />}

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label" htmlFor="email">
              Email Address
            </label>
            <div className="input-wrapper">
              <Mail size={18} className="input-icon" />
              <input
                id="email"
                type="email"
                className="form-input has-icon"
                placeholder="name@company.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
              />
            </div>
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="password">
              Password
            </label>
            <div className="input-wrapper">
              <Lock size={18} className="input-icon" />
              <input
                id="password"
                type={showPassword ? 'text' : 'password'}
                className="form-input has-icon"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete="current-password"
                style={{ paddingRight: '2.5rem' }}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                style={{
                  position: 'absolute',
                  right: '0.85rem',
                  background: 'none',
                  border: 'none',
                  color: 'var(--text-dim)',
                  cursor: 'pointer',
                  display: 'flex',
                }}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            className="btn btn-primary btn-full"
            disabled={isSubmitting}
            style={{ marginTop: '0.5rem' }}
          >
            {isSubmitting ? (
              <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span className="spinner" /> Authenticating...
              </span>
            ) : (
              <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                Sign In <ArrowRight size={16} />
              </span>
            )}
          </button>
        </form>

        {/* 1-Click Demo Accounts */}
        <div className="demo-role-selector">
          <div className="demo-role-title">
            <span>Quick Demo Credentials</span>
            <span style={{ fontSize: '0.7rem', color: 'var(--primary)' }}>Click to autofill</span>
          </div>
          <div className="demo-buttons">
            <button
              type="button"
              className="btn-role-tab"
              onClick={() => fillDemoAccount('admin')}
            >
              <Shield size={12} style={{ verticalAlign: 'middle', marginRight: '4px' }} />
              Admin
            </button>
            <button
              type="button"
              className="btn-role-tab"
              onClick={() => fillDemoAccount('agent')}
            >
              <LifeBuoy size={12} style={{ verticalAlign: 'middle', marginRight: '4px' }} />
              Agent
            </button>
            <button
              type="button"
              className="btn-role-tab"
              onClick={() => fillDemoAccount('user')}
            >
              <User size={12} style={{ verticalAlign: 'middle', marginRight: '4px' }} />
              User
            </button>
          </div>
        </div>

        <div style={{ marginTop: '1.5rem', textAlign: 'center', fontSize: '0.9rem', color: 'var(--text-muted)' }}>
          Don't have an account?{' '}
          <Link to="/register" style={{ color: 'var(--primary)', fontWeight: 600 }}>
            Create an account
          </Link>
        </div>
      </div>
    </div>
  );
};

export default Login;
