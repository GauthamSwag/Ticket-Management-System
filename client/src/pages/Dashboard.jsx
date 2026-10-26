import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useSocket } from '../context/SocketContext';
import { getDashboardData } from '../services/api';
import Alert from '../components/Alert';
import TicketTable from '../components/TicketTable';
import { DashboardSkeleton } from '../components/SkeletonLoader';
import StatusChart from '../components/analytics/StatusChart';
import PriorityChart from '../components/analytics/PriorityChart';
import CategoryChart from '../components/analytics/CategoryChart';
import TicketTrendChart from '../components/analytics/TicketTrendChart';
import AdminNotificationsWidget from '../components/AdminNotificationsWidget';
import {
  Shield,
  LifeBuoy,
  User,
  Ticket,
  Clock,
  UserCheck,
  Activity,
  CheckCircle2,
  Lock,
  AlertTriangle,
  Users,
  Plus,
  ArrowRight,
  BarChart3,
  RefreshCw,
  Sliders,
  Inbox,
  Sparkles,
} from 'lucide-react';

const Dashboard = () => {
  const { user, isAdmin, isAgent, isUser } = useAuth();
  const { socket } = useSocket();

  const [dashboardData, setDashboardData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const fetchDashboard = useCallback(async (isManual = false) => {
    try {
      if (isManual) setRefreshing(true);
      setErrorMsg('');
      const data = await getDashboardData();
      if (data && data.success) {
        setDashboardData(data);
      }
    } catch (err) {
      console.error('Failed to load dashboard data:', err.message);
      setErrorMsg(err.response?.data?.message || err.message || 'Failed to fetch dashboard statistics.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  // Initial load
  useEffect(() => {
    setLoading(true);
    fetchDashboard();
  }, [fetchDashboard]);

  // Real-time synchronization via Socket.IO with debouncing
  useEffect(() => {
    if (!socket) return;

    let debounceTimer = null;
    const handleRealtimeUpdate = () => {
      if (debounceTimer) clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        fetchDashboard();
      }, 300);
    };

    socket.on('ticket:created', handleRealtimeUpdate);
    socket.on('ticket:statusChanged', handleRealtimeUpdate);
    socket.on('ticket:priorityChanged', handleRealtimeUpdate);
    socket.on('ticket:assigned', handleRealtimeUpdate);
    socket.on('ticket:updated', handleRealtimeUpdate);
    socket.on('ticket:deleted', handleRealtimeUpdate);
    socket.on('sla:warning', handleRealtimeUpdate);
    socket.on('sla:breached', handleRealtimeUpdate);

    return () => {
      if (debounceTimer) clearTimeout(debounceTimer);
      socket.off('ticket:created', handleRealtimeUpdate);
      socket.off('ticket:statusChanged', handleRealtimeUpdate);
      socket.off('ticket:priorityChanged', handleRealtimeUpdate);
      socket.off('ticket:assigned', handleRealtimeUpdate);
      socket.off('ticket:updated', handleRealtimeUpdate);
      socket.off('ticket:deleted', handleRealtimeUpdate);
      socket.off('sla:warning', handleRealtimeUpdate);
      socket.off('sla:breached', handleRealtimeUpdate);
    };
  }, [socket, fetchDashboard]);

  const getRoleBadge = (role) => {
    switch (role) {
      case 'admin':
        return (
          <span className="badge-role badge-role-admin">
            <Shield size={12} /> Administrator
          </span>
        );
      case 'agent':
        return (
          <span className="badge-role badge-role-agent">
            <LifeBuoy size={12} /> Support Agent
          </span>
        );
      default:
        return (
          <span className="badge-role badge-role-user">
            <User size={12} /> Customer
          </span>
        );
    }
  };

  const stats = dashboardData?.stats || {};
  const recentTickets = dashboardData?.recentTickets || [];
  const charts = dashboardData?.charts || {};

  return (
    <div className="container" style={{ paddingBottom: '4rem' }}>
      {/* Top Welcome Header */}
      <div className="dashboard-header" style={{ marginBottom: '1.75rem', gap: '1rem', flexWrap: 'wrap' }}>
        <div className="user-welcome" style={{ maxWidth: '100%', minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.4rem', flexWrap: 'wrap' }}>
            <h1 style={{ fontSize: 'clamp(1.35rem, 3.5vw, 1.75rem)', fontWeight: 800, wordBreak: 'break-word' }}>
              Welcome back, {user?.name}
            </h1>
            {getRoleBadge(user?.role)}
          </div>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.95rem', wordBreak: 'break-word' }}>
            {isAdmin
              ? 'Administrator Command Center • Global Ticket Management & Platform Intelligence'
              : isAgent
              ? 'Support Agent Desk • Assigned Queue Pipeline & Active Incident Resolutions'
              : 'Customer Support Portal • Track Your Open Requests & Submit Inquiries'}
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', flexWrap: 'wrap' }}>
          <button
            onClick={() => fetchDashboard(true)}
            className="btn btn-secondary btn-sm"
            disabled={refreshing}
            title="Refresh dashboard metrics"
            style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}
          >
            <RefreshCw size={14} className={refreshing ? 'spinning' : ''} />
            <span>{refreshing ? 'Updating...' : 'Sync'}</span>
          </button>

          {isAdmin && (
            <>
              <Link to="/admin/sla" className="btn btn-secondary btn-sm" style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                <Sliders size={14} /> SLA Rules
              </Link>
              <Link to="/analytics" className="btn btn-secondary btn-sm" style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                <BarChart3 size={14} /> Analytics
              </Link>
            </>
          )}

          <Link to="/tickets" className="btn btn-secondary btn-sm">
            {isUser ? 'My Tickets' : isAgent ? 'Assigned Tickets' : 'All Tickets'}
          </Link>

          <Link to="/tickets/create" className="btn btn-primary btn-sm" style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
            <Plus size={14} /> New Ticket
          </Link>
        </div>
      </div>

      {errorMsg && (
        <Alert type="error" message={errorMsg} onClose={() => setErrorMsg('')} />
      )}

      {loading ? (
        <DashboardSkeleton />
      ) : (
        <>
          {/* ========================================================================= */}
          {/* 1. USER VIEW */}
          {/* ========================================================================= */}
          {user?.role === 'user' && (
            <div>
              {/* User Metric Cards (5 Cards) */}
              <div
                className="stats-grid"
                style={{
                  gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 180px), 1fr))',
                  gap: '1rem',
                  marginBottom: '2rem',
                }}
              >
                <div className="stat-card">
                  <div className="stat-icon" style={{ background: 'rgba(99, 102, 241, 0.15)', color: '#6366f1' }}>
                    <Ticket size={22} />
                  </div>
                  <div>
                    <div className="stat-value">{stats.totalTickets ?? 0}</div>
                    <div className="stat-label">Total Tickets Created</div>
                  </div>
                </div>

                <div className="stat-card">
                  <div className="stat-icon" style={{ background: 'rgba(56, 189, 248, 0.15)', color: '#38bdf8' }}>
                    <Clock size={22} />
                  </div>
                  <div>
                    <div className="stat-value">{stats.openTickets ?? 0}</div>
                    <div className="stat-label">Open Tickets</div>
                  </div>
                </div>

                <div className="stat-card">
                  <div className="stat-icon" style={{ background: 'rgba(245, 158, 11, 0.15)', color: '#f59e0b' }}>
                    <Activity size={22} />
                  </div>
                  <div>
                    <div className="stat-value">{stats.inProgressTickets ?? 0}</div>
                    <div className="stat-label">In Progress</div>
                  </div>
                </div>

                <div className="stat-card">
                  <div className="stat-icon" style={{ background: 'rgba(16, 185, 129, 0.15)', color: '#10b981' }}>
                    <CheckCircle2 size={22} />
                  </div>
                  <div>
                    <div className="stat-value">{stats.resolvedTickets ?? 0}</div>
                    <div className="stat-label">Resolved Tickets</div>
                  </div>
                </div>

                <div className="stat-card">
                  <div className="stat-icon" style={{ background: 'rgba(100, 116, 139, 0.15)', color: '#94a3b8' }}>
                    <Lock size={22} />
                  </div>
                  <div>
                    <div className="stat-value">{stats.closedTickets ?? 0}</div>
                    <div className="stat-label">Closed Tickets</div>
                  </div>
                </div>
              </div>

              {/* User Recent Tickets */}
              <div className="card" style={{ marginBottom: '2rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem' }}>
                  <div>
                    <h2 style={{ fontSize: '1.2rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-main)' }}>
                      <Inbox size={18} color="var(--primary)" />
                      My Recent Tickets
                    </h2>
                    <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                      Tickets you have submitted and their current resolution statuses
                    </p>
                  </div>

                  {stats.totalTickets > 0 && (
                    <Link
                      to="/tickets"
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.35rem',
                        fontSize: '0.85rem',
                        color: 'var(--primary)',
                        fontWeight: 600,
                      }}
                    >
                      View all ({stats.totalTickets}) <ArrowRight size={14} />
                    </Link>
                  )}
                </div>

                {recentTickets.length > 0 ? (
                  <TicketTable tickets={recentTickets} />
                ) : (
                  <div style={{ textAlign: 'center', padding: '3.5rem 1rem' }}>
                    <div style={{ color: 'var(--text-muted)', marginBottom: '1rem', fontSize: '0.95rem' }}>
                      You haven't submitted any support requests yet.
                    </div>
                    <Link to="/tickets/create" className="btn btn-primary btn-sm" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}>
                      <Plus size={14} /> Create Your First Ticket
                    </Link>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ========================================================================= */}
          {/* 2. AGENT VIEW */}
          {/* ========================================================================= */}
          {user?.role === 'agent' && (
            <div>
              {/* Agent Metric Cards (5 Cards) */}
              <div
                className="stats-grid"
                style={{
                  gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 180px), 1fr))',
                  gap: '1rem',
                  marginBottom: '2rem',
                }}
              >
                <div className="stat-card">
                  <div className="stat-icon" style={{ background: 'rgba(168, 85, 247, 0.15)', color: '#a855f7' }}>
                    <LifeBuoy size={22} />
                  </div>
                  <div>
                    <div className="stat-value">{stats.assignedTickets ?? 0}</div>
                    <div className="stat-label">Assigned Tickets</div>
                  </div>
                </div>

                <div className="stat-card">
                  <div className="stat-icon" style={{ background: 'rgba(56, 189, 248, 0.15)', color: '#38bdf8' }}>
                    <Clock size={22} />
                  </div>
                  <div>
                    <div className="stat-value">{stats.openAssigned ?? 0}</div>
                    <div className="stat-label">Open Assigned</div>
                  </div>
                </div>

                <div className="stat-card">
                  <div className="stat-icon" style={{ background: 'rgba(6, 182, 212, 0.15)', color: '#06b6d4' }}>
                    <Activity size={22} />
                  </div>
                  <div>
                    <div className="stat-value">{stats.inProgressAssigned ?? 0}</div>
                    <div className="stat-label">In Progress</div>
                  </div>
                </div>

                <div className="stat-card">
                  <div className="stat-icon" style={{ background: 'rgba(16, 185, 129, 0.15)', color: '#10b981' }}>
                    <CheckCircle2 size={22} />
                  </div>
                  <div>
                    <div className="stat-value">{stats.resolvedAssigned ?? 0}</div>
                    <div className="stat-label">Resolved Assigned</div>
                  </div>
                </div>

                <div className="stat-card">
                  <div className="stat-icon" style={{ background: 'rgba(239, 68, 68, 0.15)', color: '#ef4444' }}>
                    <AlertTriangle size={22} />
                  </div>
                  <div>
                    <div className="stat-value">{stats.highCriticalAssigned ?? 0}</div>
                    <div className="stat-label">High / Critical Priority</div>
                  </div>
                </div>
              </div>

              {/* Agent Recent Queue Tickets */}
              <div className="card" style={{ marginBottom: '2rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem' }}>
                  <div>
                    <h2 style={{ fontSize: '1.2rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-main)' }}>
                      <UserCheck size={18} color="var(--primary)" />
                      Recently Assigned &amp; Active Queue
                    </h2>
                    <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                      Incidents assigned to you requiring investigation, communication, or resolution
                    </p>
                  </div>

                  {stats.assignedTickets > 0 && (
                    <Link
                      to="/tickets"
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.35rem',
                        fontSize: '0.85rem',
                        color: 'var(--primary)',
                        fontWeight: 600,
                      }}
                    >
                      View queue ({stats.assignedTickets}) <ArrowRight size={14} />
                    </Link>
                  )}
                </div>

                {recentTickets.length > 0 ? (
                  <TicketTable tickets={recentTickets} />
                ) : (
                  <div style={{ textAlign: 'center', padding: '3.5rem 1rem' }}>
                    <div style={{ color: 'var(--text-muted)', fontSize: '0.95rem' }}>
                      Your assigned queue is completely clear. No active tickets require immediate triage.
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ========================================================================= */}
          {/* 3. ADMIN VIEW */}
          {/* ========================================================================= */}
          {user?.role === 'admin' && (
            <div>
              {/* Admin System-Wide Metric Cards (8 Cards) */}
              <div
                className="stats-grid"
                style={{
                  gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 170px), 1fr))',
                  gap: '1rem',
                  marginBottom: '2rem',
                }}
              >
                <div className="stat-card">
                  <div className="stat-icon" style={{ background: 'rgba(99, 102, 241, 0.15)', color: '#6366f1' }}>
                    <Ticket size={22} />
                  </div>
                  <div>
                    <div className="stat-value">{stats.totalTickets ?? 0}</div>
                    <div className="stat-label">Total Tickets</div>
                  </div>
                </div>

                <div className="stat-card">
                  <div className="stat-icon" style={{ background: 'rgba(16, 185, 129, 0.15)', color: '#10b981' }}>
                    <Users size={22} />
                  </div>
                  <div>
                    <div className="stat-value">{stats.totalUsers ?? 0}</div>
                    <div className="stat-label">Registered Users</div>
                  </div>
                </div>

                <div className="stat-card">
                  <div className="stat-icon" style={{ background: 'rgba(168, 85, 247, 0.15)', color: '#a855f7' }}>
                    <LifeBuoy size={22} />
                  </div>
                  <div>
                    <div className="stat-value">{stats.totalAgents ?? 0}</div>
                    <div className="stat-label">Support Agents</div>
                  </div>
                </div>

                <div className="stat-card">
                  <div className="stat-icon" style={{ background: 'rgba(56, 189, 248, 0.15)', color: '#38bdf8' }}>
                    <Clock size={22} />
                  </div>
                  <div>
                    <div className="stat-value">{stats.openTickets ?? 0}</div>
                    <div className="stat-label">Open Tickets</div>
                  </div>
                </div>

                <div className="stat-card">
                  <div className="stat-icon" style={{ background: 'rgba(147, 51, 234, 0.15)', color: '#a855f7' }}>
                    <UserCheck size={22} />
                  </div>
                  <div>
                    <div className="stat-value">{stats.assignedTickets ?? 0}</div>
                    <div className="stat-label">Assigned Tickets</div>
                  </div>
                </div>

                <div className="stat-card">
                  <div className="stat-icon" style={{ background: 'rgba(6, 182, 212, 0.15)', color: '#06b6d4' }}>
                    <Activity size={22} />
                  </div>
                  <div>
                    <div className="stat-value">{stats.inProgressTickets ?? 0}</div>
                    <div className="stat-label">In Progress</div>
                  </div>
                </div>

                <div className="stat-card">
                  <div className="stat-icon" style={{ background: 'rgba(16, 185, 129, 0.15)', color: '#10b981' }}>
                    <CheckCircle2 size={22} />
                  </div>
                  <div>
                    <div className="stat-value">{stats.resolvedTickets ?? 0}</div>
                    <div className="stat-label">Resolved Tickets</div>
                  </div>
                </div>

                <div className="stat-card">
                  <div className="stat-icon" style={{ background: 'rgba(239, 68, 68, 0.15)', color: '#ef4444' }}>
                    <AlertTriangle size={22} />
                  </div>
                  <div>
                    <div className="stat-value">{stats.highCriticalTickets ?? 0}</div>
                    <div className="stat-label">High / Critical</div>
                  </div>
                </div>
              </div>

              {/* Real-time Administrative Notifications & System Alert Center */}
              <AdminNotificationsWidget
                initialNotifications={dashboardData?.recentNotifications}
                initialUnreadCount={dashboardData?.unreadNotificationCount}
              />

              {/* Admin Data Visualizations Section (Recharts 2x2 Grid) */}
              <div style={{ marginBottom: '2.5rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem' }}>
                  <div>
                    <h2 style={{ fontSize: '1.25rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-main)' }}>
                      <BarChart3 size={18} color="var(--primary)" />
                      Executive Analytics &amp; Visualizations
                    </h2>
                    <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                      Server-side aggregated distribution, priority breakdown, and 30-day activity trends
                    </p>
                  </div>
                  <Link
                    to="/analytics"
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.35rem',
                      fontSize: '0.85rem',
                      color: 'var(--primary)',
                      fontWeight: 600,
                    }}
                  >
                    Full Analytics &amp; SLA Dashboard <ArrowRight size={14} />
                  </Link>
                </div>

                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 320px), 1fr))',
                    gap: '1.5rem',
                  }}
                >
                  <StatusChart data={charts.statusDistribution || []} loading={false} />
                  <PriorityChart data={charts.priorityDistribution || []} loading={false} />
                  <CategoryChart data={charts.categoryDistribution || []} loading={false} />
                  <TicketTrendChart data={charts.creationTrends || []} loading={false} />
                </div>
              </div>

              {/* Admin Global Recent Tickets */}
              <div className="card" style={{ marginBottom: '2rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem' }}>
                  <div>
                    <h2 style={{ fontSize: '1.2rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-main)' }}>
                      <Ticket size={18} color="var(--primary)" />
                      Recent Platform Tickets
                    </h2>
                    <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                      Global incoming incidents across all customer accounts and departments
                    </p>
                  </div>

                  {stats.totalTickets > 0 && (
                    <Link
                      to="/tickets"
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.35rem',
                        fontSize: '0.85rem',
                        color: 'var(--primary)',
                        fontWeight: 600,
                      }}
                    >
                      View all ({stats.totalTickets}) <ArrowRight size={14} />
                    </Link>
                  )}
                </div>

                {recentTickets.length > 0 ? (
                  <TicketTable tickets={recentTickets} />
                ) : (
                  <div style={{ textAlign: 'center', padding: '3.5rem 1rem' }}>
                    <div style={{ color: 'var(--text-muted)', fontSize: '0.95rem' }}>
                      No tickets recorded in the platform database.
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default Dashboard;
