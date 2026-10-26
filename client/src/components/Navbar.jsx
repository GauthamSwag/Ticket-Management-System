import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import NotificationBell from './NotificationBell';
import {
  Ticket,
  LogOut,
  User,
  Shield,
  LifeBuoy,
  LayoutDashboard,
  BarChart3,
  Clock,
  PlusCircle,
  Users,
  UserCheck,
  Menu,
  X,
  Bell,
} from 'lucide-react';

const Navbar = () => {
  const { user, isAuthenticated, logout, isAdmin } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(() => {
    if (typeof window !== 'undefined') {
      return window.innerWidth <= 992;
    }
    return false;
  });

  // Track window resize to ensure single NotificationBell mounting
  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth <= 992);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Close mobile drawer on route navigation
  useEffect(() => {
    setMobileOpen(false);
  }, [location.pathname]);

  const handleLogout = () => {
    setMobileOpen(false);
    logout();
    navigate('/login');
  };

  const getRoleBadge = (role) => {
    switch (role) {
      case 'admin':
        return (
          <span className="badge-role badge-role-admin">
            <Shield size={12} /> Admin
          </span>
        );
      case 'agent':
        return (
          <span className="badge-role badge-role-agent">
            <LifeBuoy size={12} /> Agent
          </span>
        );
      default:
        return (
          <span className="badge-role badge-role-user">
            <User size={12} /> User
          </span>
        );
    }
  };

  return (
    <>
      <nav className="navbar">
        <div className="container nav-container">
          {/* Brand Logo */}
          <Link to="/" className="brand" onClick={() => setMobileOpen(false)}>
            <div className="brand-icon">
              <Ticket size={20} />
            </div>
            <span>TicketFlow</span>
          </Link>

          {/* Desktop Navigation Links */}
          <ul className="nav-links">
            {isAuthenticated ? (
              <>
                <li>
                  <Link
                    to="/dashboard"
                    className={`nav-link ${location.pathname === '/dashboard' ? 'active' : ''}`}
                    style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}
                  >
                    <LayoutDashboard size={16} /> Dashboard
                  </Link>
                </li>
                <li>
                  <Link
                    to="/tickets"
                    className={`nav-link ${location.pathname === '/tickets' ? 'active' : ''}`}
                    style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}
                  >
                    <Ticket size={16} /> Tickets
                  </Link>
                </li>
                {isAdmin && (
                  <>
                    <li>
                      <Link
                        to="/admin/users"
                        className={`nav-link ${location.pathname === '/admin/users' ? 'active' : ''}`}
                        style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}
                      >
                        <Users size={16} /> Users
                      </Link>
                    </li>
                    <li>
                      <Link
                        to="/admin/agents"
                        className={`nav-link ${location.pathname === '/admin/agents' ? 'active' : ''}`}
                        style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}
                      >
                        <UserCheck size={16} /> Agents
                      </Link>
                    </li>
                    <li>
                      <Link
                        to="/analytics"
                        className={`nav-link ${location.pathname === '/analytics' ? 'active' : ''}`}
                        style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}
                      >
                        <BarChart3 size={16} /> Analytics
                      </Link>
                    </li>
                    <li>
                      <Link
                        to="/admin/sla"
                        className={`nav-link ${location.pathname === '/admin/sla' ? 'active' : ''}`}
                        style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}
                      >
                        <Clock size={16} /> SLA Rules
                      </Link>
                    </li>
                  </>
                )}
                <li>
                  <Link
                    to="/profile"
                    className={`nav-link ${location.pathname === '/profile' ? 'active' : ''}`}
                    style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}
                  >
                    <User size={16} /> Profile
                  </Link>
                </li>
                <li>
                  <Link
                    to="/tickets/create"
                    className="btn btn-primary btn-sm"
                    style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}
                  >
                    <PlusCircle size={14} /> New Ticket
                  </Link>
                </li>

                {/* Notification Bell (desktop) */}
                {!isMobile && (
                  <li>
                    <NotificationBell />
                  </li>
                )}

                {/* User Identity Pill */}
                <li className="user-menu-pill">
                  <div className="user-avatar-circle">
                    {user?.name?.charAt(0).toUpperCase() || 'U'}
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', maxWidth: '120px' }}>
                    <span
                      style={{
                        fontSize: '0.8rem',
                        fontWeight: 600,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                      title={user?.name}
                    >
                      {user?.name}
                    </span>
                    {getRoleBadge(user?.role)}
                  </div>
                </li>

                {/* Logout Button */}
                <li>
                  <button
                    onClick={handleLogout}
                    className="btn btn-secondary btn-sm"
                    title="Sign out"
                    style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}
                  >
                    <LogOut size={14} />
                    <span>Logout</span>
                  </button>
                </li>
              </>
            ) : (
              <>
                <li>
                  <Link
                    to="/login"
                    className={`nav-link ${location.pathname === '/login' ? 'active' : ''}`}
                  >
                    Sign In
                  </Link>
                </li>
                <li>
                  <Link to="/register" className="btn btn-primary btn-sm">
                    Register
                  </Link>
                </li>
              </>
            )}
          </ul>

          {/* Mobile Right Controls: Bell + Hamburger (Hidden on desktop > 992px) */}
          <div className="nav-mobile-controls">
            {isAuthenticated && isMobile && (
              <div className="mobile-bell-container">
                <NotificationBell />
              </div>
            )}

            <button
              className="nav-hamburger-btn"
              id="nav-mobile-toggle-btn"
              onClick={() => setMobileOpen((o) => !o)}
              aria-label={mobileOpen ? 'Close navigation menu' : 'Open navigation menu'}
              title="Navigation Menu"
            >
              {mobileOpen ? <X size={20} /> : <Menu size={20} />}
            </button>
          </div>
        </div>
      </nav>

      {/* Mobile Drawer Menu */}
      {mobileOpen && (
        <div className="nav-mobile-drawer" id="nav-mobile-drawer">
          {isAuthenticated ? (
            <>
              {/* User Identity Header */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.85rem',
                  padding: '1rem',
                  background: 'rgba(255, 255, 255, 0.04)',
                  borderRadius: 'var(--radius-md)',
                  border: '1px solid var(--border-color)',
                  marginBottom: '1.25rem',
                }}
              >
                <div
                  style={{
                    width: '42px',
                    height: '42px',
                    borderRadius: '50%',
                    background: 'var(--primary-gradient)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontWeight: 800,
                    color: '#ffffff',
                    fontSize: '1.1rem',
                  }}
                >
                  {user?.name?.charAt(0).toUpperCase() || 'U'}
                </div>
                <div>
                  <div style={{ fontWeight: 700, fontSize: '0.95rem', color: '#ffffff' }}>
                    {user?.name}
                  </div>
                  <div style={{ marginTop: '0.2rem' }}>{getRoleBadge(user?.role)}</div>
                </div>
              </div>

              {/* Navigation Links */}
              <ul className="nav-mobile-links">
                <li>
                  <Link
                    to="/dashboard"
                    className={`nav-link ${location.pathname === '/dashboard' ? 'active' : ''}`}
                    onClick={() => setMobileOpen(false)}
                  >
                    <LayoutDashboard size={18} /> Dashboard
                  </Link>
                </li>
                <li>
                  <Link
                    to="/tickets"
                    className={`nav-link ${location.pathname === '/tickets' ? 'active' : ''}`}
                    onClick={() => setMobileOpen(false)}
                  >
                    <Ticket size={18} /> Tickets
                  </Link>
                </li>
                {isAdmin && (
                  <>
                    <li>
                      <Link
                        to="/admin/users"
                        className={`nav-link ${location.pathname === '/admin/users' ? 'active' : ''}`}
                        onClick={() => setMobileOpen(false)}
                      >
                        <Users size={18} /> User Management
                      </Link>
                    </li>
                    <li>
                      <Link
                        to="/admin/agents"
                        className={`nav-link ${location.pathname === '/admin/agents' ? 'active' : ''}`}
                        onClick={() => setMobileOpen(false)}
                      >
                        <UserCheck size={18} /> Agent Workload
                      </Link>
                    </li>
                    <li>
                      <Link
                        to="/analytics"
                        className={`nav-link ${location.pathname === '/analytics' ? 'active' : ''}`}
                        onClick={() => setMobileOpen(false)}
                      >
                        <BarChart3 size={18} /> Analytics & Trends
                      </Link>
                    </li>
                    <li>
                      <Link
                        to="/admin/sla"
                        className={`nav-link ${location.pathname === '/admin/sla' ? 'active' : ''}`}
                        onClick={() => setMobileOpen(false)}
                      >
                        <Clock size={18} /> SLA Configuration
                      </Link>
                    </li>
                  </>
                )}
                <li>
                  <Link
                    to="/notifications"
                    className={`nav-link ${location.pathname === '/notifications' ? 'active' : ''}`}
                    onClick={() => setMobileOpen(false)}
                  >
                    <Bell size={18} /> Notifications
                  </Link>
                </li>
                <li>
                  <Link
                    to="/profile"
                    className={`nav-link ${location.pathname === '/profile' ? 'active' : ''}`}
                    onClick={() => setMobileOpen(false)}
                  >
                    <User size={18} /> Profile & Settings
                  </Link>
                </li>
              </ul>

              {/* Action Buttons */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                <Link
                  to="/tickets/create"
                  className="btn btn-primary"
                  onClick={() => setMobileOpen(false)}
                  style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}
                >
                  <PlusCircle size={16} /> Create New Ticket
                </Link>

                <button
                  type="button"
                  onClick={handleLogout}
                  className="btn btn-secondary"
                  style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', color: '#f87171' }}
                >
                  <LogOut size={16} /> Logout
                </button>
              </div>
            </>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginTop: '1rem' }}>
              <Link
                to="/login"
                className="btn btn-secondary"
                onClick={() => setMobileOpen(false)}
              >
                Sign In
              </Link>
              <Link
                to="/register"
                className="btn btn-primary"
                onClick={() => setMobileOpen(false)}
              >
                Create Account
              </Link>
            </div>
          )}
        </div>
      )}
    </>
  );
};

export default Navbar;
