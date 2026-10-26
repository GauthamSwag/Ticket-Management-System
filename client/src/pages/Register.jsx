import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import Alert from '../components/Alert';
import { User, Mail, Lock, Building, Shield, ArrowRight } from 'lucide-react';

const Register = () => {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    confirmPassword: '',
    role: 'user',
    department: 'General',
    phone: '',
  });

  const [errorMsg, setErrorMsg] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { register } = useAuth();
  const navigate = useNavigate();

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMsg('');

    if (!formData.name || !formData.email || !formData.password) {
      setErrorMsg('Please complete all required fields.');
      return;
    }

    if (formData.password.length < 6) {
      setErrorMsg('Password must be at least 6 characters long.');
      return;
    }

    if (formData.password !== formData.confirmPassword) {
      setErrorMsg('Passwords do not match. Please verify.');
      return;
    }

    setIsSubmitting(true);
    const result = await register({
      name: formData.name,
      email: formData.email,
      password: formData.password,
      role: formData.role,
      department: formData.department,
      phone: formData.phone,
    });
    setIsSubmitting(false);

    if (result.success) {
      navigate('/dashboard');
    } else {
      setErrorMsg(result.message);
    }
  };

  return (
    <div className="auth-wrapper" style={{ padding: '3.5rem 1rem' }}>
      <div className="card auth-card" style={{ maxWidth: '520px' }}>
        <div className="auth-header">
          <h1>Create an Account</h1>
          <p>Register to manage, submit, or resolve support tickets</p>
        </div>

        {errorMsg && <Alert type="error" message={errorMsg} onClose={() => setErrorMsg('')} />}

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label" htmlFor="name">
              Full Name *
            </label>
            <div className="input-wrapper">
              <User size={18} className="input-icon" />
              <input
                id="name"
                name="name"
                type="text"
                className="form-input has-icon"
                placeholder="e.g. Alex Morgan"
                value={formData.name}
                onChange={handleChange}
                required
              />
            </div>
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="email">
              Email Address *
            </label>
            <div className="input-wrapper">
              <Mail size={18} className="input-icon" />
              <input
                id="email"
                name="email"
                type="email"
                className="form-input has-icon"
                placeholder="name@company.com"
                value={formData.email}
                onChange={handleChange}
                required
                autoComplete="email"
              />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            <div className="form-group">
              <label className="form-label" htmlFor="role">
                Account Role *
              </label>
              <select
                id="role"
                name="role"
                className="form-select"
                value={formData.role}
                onChange={handleChange}
              >
                <option value="user">User (Customer)</option>
                <option value="agent">Support Agent</option>
                <option value="admin">Administrator</option>
              </select>
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="department">
                Department
              </label>
              <input
                id="department"
                name="department"
                type="text"
                className="form-input"
                placeholder="e.g. IT, Billing"
                value={formData.department}
                onChange={handleChange}
              />
            </div>
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="password">
              Password * (min 6 characters)
            </label>
            <div className="input-wrapper">
              <Lock size={18} className="input-icon" />
              <input
                id="password"
                name="password"
                type="password"
                className="form-input has-icon"
                placeholder="••••••••"
                value={formData.password}
                onChange={handleChange}
                required
                autoComplete="new-password"
              />
            </div>
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="confirmPassword">
              Confirm Password *
            </label>
            <div className="input-wrapper">
              <Lock size={18} className="input-icon" />
              <input
                id="confirmPassword"
                name="confirmPassword"
                type="password"
                className="form-input has-icon"
                placeholder="••••••••"
                value={formData.confirmPassword}
                onChange={handleChange}
                required
                autoComplete="new-password"
              />
            </div>
          </div>

          <button
            type="submit"
            className="btn btn-primary btn-full"
            disabled={isSubmitting}
            style={{ marginTop: '0.75rem' }}
          >
            {isSubmitting ? (
              <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span className="spinner" /> Creating Account...
              </span>
            ) : (
              <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                Complete Registration <ArrowRight size={16} />
              </span>
            )}
          </button>
        </form>

        <div style={{ marginTop: '1.5rem', textAlign: 'center', fontSize: '0.9rem', color: 'var(--text-muted)' }}>
          Already have an account?{' '}
          <Link to="/login" style={{ color: 'var(--primary)', fontWeight: 600 }}>
            Sign In
          </Link>
        </div>
      </div>
    </div>
  );
};

export default Register;
