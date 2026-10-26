import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';
import Alert from '../components/Alert';
import { User, Mail, Building, Phone, Lock, Save, ShieldCheck, Bell } from 'lucide-react';

const Profile = () => {
  const { user, updateUser } = useAuth();

  const [name, setName] = useState(user?.name || '');
  const [department, setDepartment] = useState(user?.department || '');
  const [phone, setPhone] = useState(user?.phone || '');

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const [prefs, setPrefs] = useState({
    emailEnabled: user?.notificationPreferences?.emailEnabled ?? true,
    assignmentEmails: user?.notificationPreferences?.assignmentEmails ?? true,
    statusChangeEmails: user?.notificationPreferences?.statusChangeEmails ?? true,
    slaEmails: user?.notificationPreferences?.slaEmails ?? true,
  });

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [alert, setAlert] = useState({ type: '', message: '' });

  const handleProfileUpdate = async (e) => {
    e.preventDefault();
    setAlert({ type: '', message: '' });

    if (newPassword) {
      if (!currentPassword) {
        setAlert({ type: 'error', message: 'Current password is required to change password.' });
        return;
      }
      if (newPassword.length < 6) {
        setAlert({ type: 'error', message: 'New password must be at least 6 characters long.' });
        return;
      }
      if (newPassword !== confirmPassword) {
        setAlert({ type: 'error', message: 'New passwords do not match.' });
        return;
      }
    }

    setIsSubmitting(true);
    try {
      const payload = {
        name,
        department,
        phone,
        notificationPreferences: prefs,
      };

      if (newPassword) {
        payload.currentPassword = currentPassword;
        payload.newPassword = newPassword;
      }

      const res = await api.put('/auth/profile', payload);

      if (res.data && res.data.success) {
        updateUser(res.data.user);
        setAlert({ type: 'success', message: 'Profile and notification preferences updated successfully!' });
        setCurrentPassword('');
        setNewPassword('');
        setConfirmPassword('');
      }
    } catch (err) {
      setAlert({
        type: 'error',
        message: err.response?.data?.message || 'Failed to update profile.',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="container" style={{ padding: '2.5rem 1.5rem 4rem', maxWidth: '780px' }}>
      <div style={{ marginBottom: '2rem' }}>
        <h1 style={{ fontSize: '1.85rem', marginBottom: '0.35rem' }}>Account Profile</h1>
        <p style={{ color: 'var(--text-muted)' }}>Manage your personal details, department, and security settings</p>
      </div>

      {alert.message && (
        <Alert
          type={alert.type}
          message={alert.message}
          onClose={() => setAlert({ type: '', message: '' })}
        />
      )}

      <div className="card">
        <form onSubmit={handleProfileUpdate}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem', marginBottom: '2rem', paddingBottom: '1.5rem', borderBottom: '1px solid var(--border-color)' }}>
            <div
              style={{
                width: '64px',
                height: '64px',
                borderRadius: '50%',
                background: 'var(--primary-gradient)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '1.5rem',
                fontWeight: 700,
                color: 'white',
              }}
            >
              {user?.name?.charAt(0).toUpperCase()}
            </div>
            <div>
              <div style={{ fontSize: '1.2rem', fontWeight: 700 }}>{user?.name}</div>
              <div style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>{user?.email}</div>
              <div style={{ marginTop: '0.35rem' }}>
                <span className={`badge-role badge-role-${user?.role}`}>
                  <ShieldCheck size={12} /> {user?.role?.toUpperCase()}
                </span>
              </div>
            </div>
          </div>

          <h2 style={{ fontSize: '1.1rem', marginBottom: '1.25rem' }}>General Information</h2>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            <div className="form-group">
              <label className="form-label" htmlFor="name">
                Full Name
              </label>
              <div className="input-wrapper">
                <User size={18} className="input-icon" />
                <input
                  id="name"
                  type="text"
                  className="form-input has-icon"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                />
              </div>
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="email">
                Email Address (Read-only)
              </label>
              <div className="input-wrapper">
                <Mail size={18} className="input-icon" />
                <input
                  id="email"
                  type="email"
                  className="form-input has-icon"
                  value={user?.email || ''}
                  disabled
                  style={{ opacity: 0.7, cursor: 'not-allowed' }}
                />
              </div>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            <div className="form-group">
              <label className="form-label" htmlFor="department">
                Department
              </label>
              <div className="input-wrapper">
                <Building size={18} className="input-icon" />
                <input
                  id="department"
                  type="text"
                  className="form-input has-icon"
                  value={department}
                  onChange={(e) => setDepartment(e.target.value)}
                />
              </div>
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="phone">
                Phone Number
              </label>
              <div className="input-wrapper">
                <Phone size={18} className="input-icon" />
                <input
                  id="phone"
                  type="text"
                  className="form-input has-icon"
                  placeholder="+1-555-0199"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                />
              </div>
            </div>
          </div>

          <h2 style={{ fontSize: '1.1rem', margin: '1.75rem 0 1.25rem', paddingTop: '1.5rem', borderTop: '1px solid var(--border-color)' }}>
            Security & Password Change
          </h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginBottom: '1.25rem' }}>
            Leave blank if you do not wish to update your password.
          </p>

          <div className="form-group">
            <label className="form-label" htmlFor="currentPassword">
              Current Password
            </label>
            <div className="input-wrapper">
              <Lock size={18} className="input-icon" />
              <input
                id="currentPassword"
                type="password"
                className="form-input has-icon"
                placeholder="••••••••"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
              />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            <div className="form-group">
              <label className="form-label" htmlFor="newPassword">
                New Password (min 6 chars)
              </label>
              <div className="input-wrapper">
                <Lock size={18} className="input-icon" />
                <input
                  id="newPassword"
                  type="password"
                  className="form-input has-icon"
                  placeholder="••••••••"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                />
              </div>
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="confirmPassword">
                Confirm New Password
              </label>
              <div className="input-wrapper">
                <Lock size={18} className="input-icon" />
                <input
                  id="confirmPassword"
                  type="password"
                  className="form-input has-icon"
                  placeholder="••••••••"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                />
              </div>
            </div>
          </div>

          <h2 style={{ fontSize: '1.1rem', margin: '2rem 0 0.5rem', paddingTop: '1.5rem', borderTop: '1px solid var(--border-color)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Bell size={18} color="var(--primary)" />
            Notification &amp; Email Preferences
          </h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginBottom: '1.25rem' }}>
            Configure real-time automated dispatch rules for your account.
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem', background: 'rgba(255, 255, 255, 0.02)', padding: '1.25rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', cursor: 'pointer', fontSize: '0.925rem' }}>
              <input
                type="checkbox"
                checked={prefs.emailEnabled}
                onChange={(e) => setPrefs({ ...prefs, emailEnabled: e.target.checked })}
                style={{ width: '18px', height: '18px', accentColor: 'var(--primary)', cursor: 'pointer' }}
              />
              <div>
                <strong>Global Email Delivery Enabled</strong>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Allow TicketFlow to send email alerts to {user?.email}</div>
              </div>
            </label>

            <label style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', cursor: 'pointer', fontSize: '0.925rem', opacity: prefs.emailEnabled ? 1 : 0.5 }}>
              <input
                type="checkbox"
                checked={prefs.assignmentEmails}
                disabled={!prefs.emailEnabled}
                onChange={(e) => setPrefs({ ...prefs, assignmentEmails: e.target.checked })}
                style={{ width: '18px', height: '18px', accentColor: 'var(--primary)', cursor: 'pointer' }}
              />
              <div>
                <strong>Ticket Assignment Notifications</strong>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Receive email when a ticket is assigned or reassigned to you</div>
              </div>
            </label>

            <label style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', cursor: 'pointer', fontSize: '0.925rem', opacity: prefs.emailEnabled ? 1 : 0.5 }}>
              <input
                type="checkbox"
                checked={prefs.statusChangeEmails}
                disabled={!prefs.emailEnabled}
                onChange={(e) => setPrefs({ ...prefs, statusChangeEmails: e.target.checked })}
                style={{ width: '18px', height: '18px', accentColor: 'var(--primary)', cursor: 'pointer' }}
              />
              <div>
                <strong>Ticket Status Change Alerts</strong>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Receive email when ticket workflow status is transitioned</div>
              </div>
            </label>

            <label style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', cursor: 'pointer', fontSize: '0.925rem', opacity: prefs.emailEnabled ? 1 : 0.5 }}>
              <input
                type="checkbox"
                checked={prefs.slaEmails}
                disabled={!prefs.emailEnabled}
                onChange={(e) => setPrefs({ ...prefs, slaEmails: e.target.checked })}
                style={{ width: '18px', height: '18px', accentColor: 'var(--primary)', cursor: 'pointer' }}
              />
              <div>
                <strong>SLA Deadline Warnings &amp; Breaches</strong>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Receive urgent alerts for approaching targets or SLA breaches</div>
              </div>
            </label>
          </div>

          <div style={{ marginTop: '2rem', display: 'flex', justifyContent: 'flex-end' }}>
            <button type="submit" className="btn btn-primary" disabled={isSubmitting}>
              {isSubmitting ? (
                <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <span className="spinner" /> Saving Changes...
                </span>
              ) : (
                <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <Save size={16} /> Save Profile &amp; Preferences
                </span>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default Profile;
