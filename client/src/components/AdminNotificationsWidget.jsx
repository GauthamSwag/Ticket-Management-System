import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useSocket } from '../context/SocketContext';
import {
  getNotifications,
  markNotificationAsRead,
  markAllNotificationsAsRead,
  deleteNotification,
} from '../services/api';
import {
  Bell,
  AlertTriangle,
  AlertCircle,
  Clock,
  CheckCircle2,
  UserCheck,
  MessageSquare,
  Ticket,
  CheckCheck,
  Check,
  Trash2,
  ArrowRight,
  ExternalLink,
  RefreshCw,
  Sparkles,
  Shield,
  Radio,
} from 'lucide-react';

const formatTimeAgo = (dateStr) => {
  if (!dateStr) return '';
  const diffMs = Date.now() - new Date(dateStr).getTime();
  const diffSecs = Math.floor(diffMs / 1000);
  const diffMins = Math.floor(diffSecs / 60);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffSecs < 60) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays === 1) return 'Yesterday';
  return `${diffDays}d ago`;
};

const getNotificationMeta = (type) => {
  switch (type) {
    case 'SLA_BREACH':
      return {
        icon: <AlertTriangle size={17} color="#ef4444" />,
        badgeText: 'SLA BREACH',
        bg: 'rgba(239, 68, 68, 0.12)',
        borderColor: 'rgba(239, 68, 68, 0.28)',
        textColor: '#ef4444',
      };
    case 'SLA_WARNING':
      return {
        icon: <Clock size={17} color="#f59e0b" />,
        badgeText: 'SLA WARNING',
        bg: 'rgba(245, 158, 11, 0.12)',
        borderColor: 'rgba(245, 158, 11, 0.28)',
        textColor: '#f59e0b',
      };
    case 'TICKET_CREATED':
      return {
        icon: <Sparkles size={17} color="#6366f1" />,
        badgeText: 'NEW TICKET',
        bg: 'rgba(99, 102, 241, 0.12)',
        borderColor: 'rgba(99, 102, 241, 0.28)',
        textColor: '#818cf8',
      };
    case 'TICKET_ASSIGNED':
      return {
        icon: <UserCheck size={17} color="#a855f7" />,
        badgeText: 'ASSIGNMENT',
        bg: 'rgba(168, 85, 247, 0.12)',
        borderColor: 'rgba(168, 85, 247, 0.28)',
        textColor: '#c084fc',
      };
    case 'TICKET_STATUS_CHANGED':
      return {
        icon: <CheckCircle2 size={17} color="#06b6d4" />,
        badgeText: 'STATUS UPDATE',
        bg: 'rgba(6, 182, 212, 0.12)',
        borderColor: 'rgba(6, 182, 212, 0.28)',
        textColor: '#22d3ee',
      };
    case 'TICKET_PRIORITY_CHANGED':
      return {
        icon: <AlertCircle size={17} color="#f97316" />,
        badgeText: 'ESCALATION',
        bg: 'rgba(249, 115, 22, 0.12)',
        borderColor: 'rgba(249, 115, 22, 0.28)',
        textColor: '#fb923c',
      };
    case 'TICKET_COMMENT':
      return {
        icon: <MessageSquare size={17} color="#14b8a6" />,
        badgeText: 'COMMENT',
        bg: 'rgba(20, 184, 166, 0.12)',
        borderColor: 'rgba(20, 184, 166, 0.28)',
        textColor: '#2dd4bf',
      };
    default:
      return {
        icon: <Bell size={17} color="var(--primary)" />,
        badgeText: 'SYSTEM ALERT',
        bg: 'rgba(99, 102, 241, 0.12)',
        borderColor: 'rgba(99, 102, 241, 0.28)',
        textColor: '#818cf8',
      };
  }
};

const AdminNotificationsWidget = ({ initialNotifications = [], initialUnreadCount = 0 }) => {
  const navigate = useNavigate();
  const { socket } = useSocket();

  const [notifications, setNotifications] = useState(initialNotifications);
  const [unreadCount, setUnreadCount] = useState(initialUnreadCount);
  const [activeFilter, setActiveFilter] = useState('all'); // 'all', 'unread', 'sla', 'tickets'
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [actionLoadingId, setActionLoadingId] = useState(null);
  const [markingAll, setMarkingAll] = useState(false);

  const hasLoadedOnceRef = useRef(Boolean(initialNotifications && initialNotifications.length > 0));

  // Sync initial props without clobbering local state or flickering
  useEffect(() => {
    if (!initialNotifications || initialNotifications.length === 0) return;

    setNotifications((prev) => {
      if (!prev || prev.length === 0) {
        hasLoadedOnceRef.current = true;
        return initialNotifications;
      }

      // Check for genuinely new notifications or modifications to avoid unnecessary re-renders
      const prevIds = new Set(prev.map((n) => n._id));
      const newItems = initialNotifications.filter((n) => !prevIds.has(n._id));

      let hasModifications = false;
      const merged = prev.map((item) => {
        const incoming = initialNotifications.find((n) => n._id === item._id);
        if (
          incoming &&
          (incoming.isRead !== item.isRead ||
            incoming.title !== item.title ||
            incoming.message !== item.message)
        ) {
          hasModifications = true;
          return { ...item, ...incoming };
        }
        return item;
      });

      if (newItems.length === 0 && !hasModifications) {
        return prev; // Maintain same reference to avoid re-renders
      }

      hasLoadedOnceRef.current = true;
      return [...newItems, ...merged];
    });
  }, [initialNotifications]);

  useEffect(() => {
    if (typeof initialUnreadCount === 'number') {
      setUnreadCount(initialUnreadCount);
    }
  }, [initialUnreadCount]);

  // Fetch from API with silent refresh support (prevents UI flickering)
  const fetchAdminNotifications = useCallback(async (isManual = false, isSilent = false) => {
    try {
      if (isManual) {
        setRefreshing(true);
      } else if (!isSilent && !hasLoadedOnceRef.current) {
        setLoading(true);
      }

      const res = await getNotifications({ limit: 25 });
      if (res && res.success) {
        hasLoadedOnceRef.current = true;
        const incoming = res.notifications || [];

        setNotifications((prev) => {
          if (!prev || prev.length === 0) return incoming;

          const prevIds = new Set(prev.map((n) => n._id));
          const newItems = incoming.filter((n) => !prevIds.has(n._id));

          let hasModifications = false;
          const merged = prev.map((item) => {
            const match = incoming.find((n) => n._id === item._id);
            if (
              match &&
              (match.isRead !== item.isRead ||
                match.title !== item.title ||
                match.message !== item.message)
            ) {
              hasModifications = true;
              return { ...item, ...match };
            }
            return item;
          });

          if (newItems.length === 0 && !hasModifications) {
            return prev;
          }

          return [...newItems, ...merged];
        });

        if (typeof res.unreadCount === 'number') {
          setUnreadCount(res.unreadCount);
        }
      }
    } catch (err) {
      console.error('Failed to fetch admin notifications:', err.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  // Fetch on mount only if no initial notifications provided and never loaded
  useEffect(() => {
    if (!hasLoadedOnceRef.current && (!initialNotifications || initialNotifications.length === 0)) {
      fetchAdminNotifications();
    }
  }, [fetchAdminNotifications, initialNotifications]);

  // Socket.IO real-time event listeners (clean updates without flickering)
  useEffect(() => {
    if (!socket) return;

    const handleNewNotification = (payload) => {
      const newNotif = payload?.data || payload;
      if (!newNotif || !newNotif._id) return;

      setNotifications((prev) => {
        // Prevent duplicate if already in state
        if (prev.some((n) => n._id === newNotif._id)) return prev;
        // Increment unread count only if newly added and unread
        if (!newNotif.isRead) {
          setUnreadCount((count) => count + 1);
        }
        return [newNotif, ...prev];
      });
    };

    const handleSlaSilentRefresh = () => {
      fetchAdminNotifications(false, true); // Silent background fetch without loader flash
    };

    socket.on('notification:new', handleNewNotification);
    socket.on('sla:breached', handleSlaSilentRefresh);
    socket.on('sla:warning', handleSlaSilentRefresh);

    return () => {
      socket.off('notification:new', handleNewNotification);
      socket.off('sla:breached', handleSlaSilentRefresh);
      socket.off('sla:warning', handleSlaSilentRefresh);
    };
  }, [socket, fetchAdminNotifications]);

  // Cross-component synchronization listener (updates silently when read/deleted elsewhere)
  useEffect(() => {
    const handleSync = (e) => {
      if (e?.detail?.source === 'AdminNotificationsWidget') return;
      fetchAdminNotifications(false, true);
    };

    window.addEventListener('notifications:sync', handleSync);
    return () => window.removeEventListener('notifications:sync', handleSync);
  }, [fetchAdminNotifications]);

  // Mark single as read
  const handleMarkAsRead = async (id, e) => {
    if (e) e.stopPropagation();
    try {
      setActionLoadingId(id);
      await markNotificationAsRead(id);
      setNotifications((prev) =>
        prev.map((n) => (n._id === id ? { ...n, isRead: true } : n))
      );
      setUnreadCount((c) => Math.max(0, c - 1));
      window.dispatchEvent(
        new CustomEvent('notifications:sync', { detail: { source: 'AdminNotificationsWidget' } })
      );
    } catch (err) {
      console.error('Failed to mark notification as read:', err.message);
    } finally {
      setActionLoadingId(null);
    }
  };

  // Mark all as read
  const handleMarkAllAsRead = async () => {
    try {
      setMarkingAll(true);
      await markAllNotificationsAsRead();
      setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
      setUnreadCount(0);
      window.dispatchEvent(
        new CustomEvent('notifications:sync', { detail: { source: 'AdminNotificationsWidget' } })
      );
    } catch (err) {
      console.error('Failed to mark all notifications as read:', err.message);
    } finally {
      setMarkingAll(false);
    }
  };

  // Delete notification
  const handleDelete = async (id, e) => {
    if (e) e.stopPropagation();
    try {
      setActionLoadingId(id);
      await deleteNotification(id);
      const target = notifications.find((n) => n._id === id);
      setNotifications((prev) => prev.filter((n) => n._id !== id));
      if (target && !target.isRead) {
        setUnreadCount((c) => Math.max(0, c - 1));
      }
      window.dispatchEvent(
        new CustomEvent('notifications:sync', { detail: { source: 'AdminNotificationsWidget' } })
      );
    } catch (err) {
      console.error('Failed to delete notification:', err.message);
    } finally {
      setActionLoadingId(null);
    }
  };

  // Click handler to open ticket details
  const handleCardClick = (notif) => {
    if (!notif.isRead) {
      handleMarkAsRead(notif._id);
    }
    const ticketId = notif.ticket?._id || notif.ticket;
    if (ticketId) {
      navigate(`/tickets/${ticketId}`);
    }
  };

  // Compute counts for filter tabs
  const counts = useMemo(() => {
    const unread = notifications.filter((n) => !n.isRead).length;
    const sla = notifications.filter(
      (n) => n.type === 'SLA_BREACH' || n.type === 'SLA_WARNING'
    ).length;
    const tickets = notifications.filter((n) =>
      n.type?.startsWith('TICKET_')
    ).length;
    return {
      all: notifications.length,
      unread,
      sla,
      tickets,
    };
  }, [notifications]);

  // SLA breach/warning alerts for attention ribbon
  const unreadSlaBreaches = useMemo(() => {
    return notifications.filter((n) => !n.isRead && n.type === 'SLA_BREACH');
  }, [notifications]);

  const unreadSlaWarnings = useMemo(() => {
    return notifications.filter((n) => !n.isRead && n.type === 'SLA_WARNING');
  }, [notifications]);

  // Filtered notifications
  const filteredNotifications = useMemo(() => {
    switch (activeFilter) {
      case 'unread':
        return notifications.filter((n) => !n.isRead);
      case 'sla':
        return notifications.filter(
          (n) => n.type === 'SLA_BREACH' || n.type === 'SLA_WARNING'
        );
      case 'tickets':
        return notifications.filter((n) => n.type?.startsWith('TICKET_'));
      default:
        return notifications;
    }
  }, [notifications, activeFilter]);

  return (
    <div className="card" style={{ marginBottom: '2.5rem', padding: '1.5rem' }}>
      {/* Executive Alert Banner for SLA Breaches / Warnings */}
      {(unreadSlaBreaches.length > 0 || unreadSlaWarnings.length > 0) && (
        <div
          style={{
            background:
              unreadSlaBreaches.length > 0
                ? 'linear-gradient(90deg, rgba(239, 68, 68, 0.16) 0%, rgba(245, 158, 11, 0.12) 100%)'
                : 'rgba(245, 158, 11, 0.12)',
            border: `1px solid ${
              unreadSlaBreaches.length > 0
                ? 'rgba(239, 68, 68, 0.35)'
                : 'rgba(245, 158, 11, 0.35)'
            }`,
            borderRadius: 'var(--radius-md)',
            padding: '0.85rem 1.15rem',
            marginBottom: '1.25rem',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '0.75rem',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <div
              style={{
                width: '32px',
                height: '32px',
                borderRadius: '8px',
                background:
                  unreadSlaBreaches.length > 0 ? '#ef4444' : '#f59e0b',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#fff',
                boxShadow:
                  unreadSlaBreaches.length > 0
                    ? '0 0 15px rgba(239, 68, 68, 0.5)'
                    : '0 0 15px rgba(245, 158, 11, 0.5)',
              }}
            >
              <AlertTriangle size={18} />
            </div>
            <div>
              <div style={{ fontWeight: 700, fontSize: '0.95rem', color: 'var(--text-main)' }}>
                {unreadSlaBreaches.length > 0
                  ? `Attention: ${unreadSlaBreaches.length} SLA Breach${
                      unreadSlaBreaches.length > 1 ? 'es' : ''
                    } & ${unreadSlaWarnings.length} SLA Warning${
                      unreadSlaWarnings.length !== 1 ? 's' : ''
                    } Require Executive Triage`
                  : `Notice: ${unreadSlaWarnings.length} SLA Resolution Warning${
                      unreadSlaWarnings.length > 1 ? 's' : ''
                    } Approaching Deadline`}
              </div>
              <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                High-priority incidents risk contractual breach penalties. Review and reassign queues promptly.
              </div>
            </div>
          </div>

          <button
            onClick={() => setActiveFilter('sla')}
            className="btn btn-secondary btn-sm"
            style={{
              borderColor:
                unreadSlaBreaches.length > 0
                  ? 'rgba(239, 68, 68, 0.4)'
                  : 'rgba(245, 158, 11, 0.4)',
              color: unreadSlaBreaches.length > 0 ? '#fca5a5' : '#fcd34d',
              fontSize: '0.8rem',
              padding: '0.35rem 0.75rem',
            }}
          >
            Filter SLA Alerts ({counts.sla})
          </button>
        </div>
      )}

      {/* Widget Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '1rem',
          marginBottom: '1.25rem',
          paddingBottom: '1rem',
          borderBottom: '1px solid var(--border-color)',
        }}
      >
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
            <div
              style={{
                width: '32px',
                height: '32px',
                borderRadius: '8px',
                background: 'rgba(99, 102, 241, 0.15)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--primary)',
                position: 'relative',
              }}
            >
              <Bell size={18} />
              {unreadCount > 0 && (
                <span
                  style={{
                    position: 'absolute',
                    top: '-2px',
                    right: '-2px',
                    width: '8px',
                    height: '8px',
                    borderRadius: '50%',
                    background: '#ef4444',
                    boxShadow: '0 0 8px #ef4444',
                  }}
                />
              )}
            </div>
            <h2
              style={{
                fontSize: '1.2rem',
                fontWeight: 700,
                color: 'var(--text-main)',
                margin: 0,
              }}
            >
              System &amp; Administrative Notifications
            </h2>
            {unreadCount > 0 ? (
              <span
                style={{
                  fontSize: '0.75rem',
                  fontWeight: 700,
                  padding: '0.2rem 0.55rem',
                  borderRadius: '999px',
                  background: 'rgba(99, 102, 241, 0.2)',
                  color: '#818cf8',
                  border: '1px solid rgba(99, 102, 241, 0.3)',
                }}
              >
                {unreadCount} Unread
              </span>
            ) : (
              <span
                style={{
                  fontSize: '0.75rem',
                  fontWeight: 600,
                  padding: '0.2rem 0.55rem',
                  borderRadius: '999px',
                  background: 'rgba(16, 185, 129, 0.15)',
                  color: '#34d399',
                  border: '1px solid rgba(16, 185, 129, 0.3)',
                }}
              >
                All Cleared
              </span>
            )}
          </div>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginTop: '0.25rem' }}>
            Live platform dispatches, SLA breach warnings, and incoming ticket alerts across all queues
          </p>
        </div>

        {/* Header Right Actions */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
          <button
            onClick={() => fetchAdminNotifications(true)}
            className="btn btn-secondary btn-sm"
            disabled={refreshing}
            title="Refresh notifications feed"
            style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}
          >
            <RefreshCw size={13} className={refreshing ? 'spinning' : ''} />
            <span>{refreshing ? 'Syncing...' : 'Sync'}</span>
          </button>

          {unreadCount > 0 && (
            <button
              onClick={handleMarkAllAsRead}
              className="btn btn-secondary btn-sm"
              disabled={markingAll}
              title="Mark all notifications as read"
              style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}
            >
              <CheckCheck size={14} color="#10b981" />
              <span>{markingAll ? 'Updating...' : 'Mark all read'}</span>
            </button>
          )}

          <Link
            to="/notifications"
            className="btn btn-secondary btn-sm"
            style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}
          >
            <span>Notification Center</span>
            <ExternalLink size={13} />
          </Link>
        </div>
      </div>

      {/* Filter Tabs */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem',
          marginBottom: '1.25rem',
          flexWrap: 'wrap',
        }}
      >
        <button
          onClick={() => setActiveFilter('all')}
          className={`btn btn-sm ${activeFilter === 'all' ? 'btn-primary' : 'btn-secondary'}`}
          style={{ fontSize: '0.8rem', padding: '0.3rem 0.75rem' }}
        >
          All Alerts ({counts.all})
        </button>
        <button
          onClick={() => setActiveFilter('unread')}
          className={`btn btn-sm ${activeFilter === 'unread' ? 'btn-primary' : 'btn-secondary'}`}
          style={{ fontSize: '0.8rem', padding: '0.3rem 0.75rem' }}
        >
          Unread ({counts.unread})
        </button>
        <button
          onClick={() => setActiveFilter('sla')}
          className={`btn btn-sm ${activeFilter === 'sla' ? 'btn-primary' : 'btn-secondary'}`}
          style={{
            fontSize: '0.8rem',
            padding: '0.3rem 0.75rem',
            borderColor: counts.sla > 0 ? 'rgba(239, 68, 68, 0.35)' : undefined,
          }}
        >
          SLA &amp; Critical ({counts.sla})
        </button>
        <button
          onClick={() => setActiveFilter('tickets')}
          className={`btn btn-sm ${activeFilter === 'tickets' ? 'btn-primary' : 'btn-secondary'}`}
          style={{ fontSize: '0.8rem', padding: '0.3rem 0.75rem' }}
        >
          Ticket Events ({counts.tickets})
        </button>
      </div>

      {/* Notifications List */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: '2.5rem 1rem', color: 'var(--text-muted)' }}>
          <RefreshCw size={24} className="spinning" style={{ margin: '0 auto 0.75rem' }} />
          <div>Loading administrative notifications...</div>
        </div>
      ) : filteredNotifications.length > 0 ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          {filteredNotifications.map((notif) => {
            const meta = getNotificationMeta(notif.type);
            const ticketObj = notif.ticket;

            return (
              <div
                key={notif._id}
                onClick={() => handleCardClick(notif)}
                style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  justifyContent: 'space-between',
                  padding: '0.95rem 1.15rem',
                  borderRadius: 'var(--radius-md)',
                  background: notif.isRead
                    ? 'rgba(255, 255, 255, 0.02)'
                    : 'rgba(99, 102, 241, 0.05)',
                  border: `1px solid ${
                    notif.isRead
                      ? 'var(--border-color)'
                      : 'rgba(99, 102, 241, 0.25)'
                  }`,
                  cursor: ticketObj ? 'pointer' : 'default',
                  transition: 'all 0.2s ease',
                  position: 'relative',
                  overflow: 'hidden',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = notif.isRead
                    ? 'rgba(255, 255, 255, 0.05)'
                    : 'rgba(99, 102, 241, 0.09)';
                  e.currentTarget.style.transform = 'translateY(-1px)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = notif.isRead
                    ? 'rgba(255, 255, 255, 0.02)'
                    : 'rgba(99, 102, 241, 0.05)';
                  e.currentTarget.style.transform = 'translateY(0)';
                }}
              >
                {/* Unread Accent Bar on Left */}
                {!notif.isRead && (
                  <div
                    style={{
                      position: 'absolute',
                      top: 0,
                      left: 0,
                      bottom: 0,
                      width: '4px',
                      background: meta.textColor,
                    }}
                  />
                )}

                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.9rem', flex: 1, minWidth: 0 }}>
                  {/* Category Icon Pill */}
                  <div
                    style={{
                      width: '36px',
                      height: '36px',
                      borderRadius: '10px',
                      background: meta.bg,
                      border: `1px solid ${meta.borderColor}`,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0,
                      marginTop: '0.15rem',
                    }}
                  >
                    {meta.icon}
                  </div>

                  {/* Body Content */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.5rem',
                        flexWrap: 'wrap',
                        marginBottom: '0.2rem',
                      }}
                    >
                      <span
                        style={{
                          fontSize: '0.68rem',
                          fontWeight: 700,
                          padding: '0.15rem 0.45rem',
                          borderRadius: '4px',
                          background: meta.bg,
                          color: meta.textColor,
                          border: `1px solid ${meta.borderColor}`,
                          letterSpacing: '0.04em',
                        }}
                      >
                        {meta.badgeText}
                      </span>

                      <h4
                        style={{
                          fontSize: '0.92rem',
                          fontWeight: notif.isRead ? 600 : 700,
                          color: notif.isRead ? 'var(--text-main)' : '#fff',
                          margin: 0,
                          wordBreak: 'break-word',
                        }}
                      >
                        {notif.title}
                      </h4>

                      {!notif.isRead && (
                        <span
                          style={{
                            width: '6px',
                            height: '6px',
                            borderRadius: '50%',
                            background: meta.textColor,
                            display: 'inline-block',
                          }}
                          title="Unread notification"
                        />
                      )}
                    </div>

                    <p
                      style={{
                        fontSize: '0.84rem',
                        color: 'var(--text-muted)',
                        margin: '0.25rem 0 0.5rem 0',
                        lineHeight: 1.45,
                        wordBreak: 'break-word',
                      }}
                    >
                      {notif.message}
                    </p>

                    {/* Metadata Footer: Ticket link + Time */}
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.75rem',
                        flexWrap: 'wrap',
                        fontSize: '0.78rem',
                      }}
                    >
                      <span style={{ color: 'var(--text-dim)', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                        <Clock size={12} />
                        {formatTimeAgo(notif.createdAt)}
                      </span>

                      {ticketObj && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap' }}>
                          <span
                            style={{
                              fontWeight: 700,
                              color: 'var(--primary)',
                              background: 'rgba(99, 102, 241, 0.1)',
                              padding: '0.15rem 0.45rem',
                              borderRadius: '4px',
                              border: '1px solid rgba(99, 102, 241, 0.25)',
                              fontSize: '0.75rem',
                            }}
                          >
                            {ticketObj.ticketId || 'TICKET'}
                          </span>

                          {ticketObj.priority && (
                            <span
                              style={{
                                fontSize: '0.72rem',
                                padding: '0.1rem 0.4rem',
                                borderRadius: '4px',
                                background:
                                  ticketObj.priority === 'Critical'
                                    ? 'rgba(239, 68, 68, 0.15)'
                                    : ticketObj.priority === 'High'
                                    ? 'rgba(245, 158, 11, 0.15)'
                                    : 'rgba(59, 130, 246, 0.15)',
                                color:
                                  ticketObj.priority === 'Critical'
                                    ? '#ef4444'
                                    : ticketObj.priority === 'High'
                                    ? '#f59e0b'
                                    : '#3b82f6',
                                fontWeight: 600,
                              }}
                            >
                              {ticketObj.priority}
                            </span>
                          )}

                          {ticketObj.status && (
                            <span
                              style={{
                                fontSize: '0.72rem',
                                padding: '0.1rem 0.4rem',
                                borderRadius: '4px',
                                background: 'rgba(255, 255, 255, 0.06)',
                                color: 'var(--text-muted)',
                              }}
                            >
                              {ticketObj.status}
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Right Item Actions */}
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.35rem',
                    marginLeft: '0.75rem',
                    flexShrink: 0,
                  }}
                  onClick={(e) => e.stopPropagation()}
                >
                  {!notif.isRead && (
                    <button
                      onClick={(e) => handleMarkAsRead(notif._id, e)}
                      disabled={actionLoadingId === notif._id}
                      className="btn btn-secondary btn-sm"
                      title="Mark as read"
                      style={{
                        padding: '0.3rem 0.45rem',
                        height: '28px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <Check size={13} color="#10b981" />
                    </button>
                  )}

                  <button
                    onClick={(e) => handleDelete(notif._id, e)}
                    disabled={actionLoadingId === notif._id}
                    className="btn btn-secondary btn-sm"
                    title="Dismiss alert"
                    style={{
                      padding: '0.3rem 0.45rem',
                      height: '28px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: 'var(--text-muted)',
                    }}
                  >
                    <Trash2 size={13} />
                  </button>

                  {ticketObj && (
                    <Link
                      to={`/tickets/${ticketObj._id || ticketObj}`}
                      className="btn btn-secondary btn-sm"
                      title="Inspect Ticket Details"
                      style={{
                        padding: '0.3rem 0.55rem',
                        height: '28px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.25rem',
                        fontSize: '0.78rem',
                      }}
                    >
                      <span>View</span>
                      <ArrowRight size={12} />
                    </Link>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div style={{ textAlign: 'center', padding: '3rem 1rem' }}>
          <div
            style={{
              width: '44px',
              height: '44px',
              borderRadius: '50%',
              background: 'rgba(16, 185, 129, 0.12)',
              color: '#10b981',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 0.75rem auto',
            }}
          >
            <CheckCircle2 size={22} />
          </div>
          <div style={{ fontWeight: 600, fontSize: '0.95rem', color: 'var(--text-main)', marginBottom: '0.25rem' }}>
            No alerts found in this view
          </div>
          <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', maxWidth: '400px', margin: '0 auto' }}>
            {activeFilter === 'unread'
              ? 'All current notifications have been read and triaged.'
              : activeFilter === 'sla'
              ? 'No active SLA breaches or deadline warnings on file.'
              : 'The administrative notifications queue is currently clear.'}
          </div>
        </div>
      )}

      {/* Footer navigation */}
      <div
        style={{
          marginTop: '1.25rem',
          paddingTop: '0.85rem',
          borderTop: '1px solid var(--border-color)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '0.5rem',
          fontSize: '0.85rem',
        }}
      >
        <span style={{ color: 'var(--text-dim)' }}>
          Showing {filteredNotifications.length} of {notifications.length} platform events
        </span>
        <Link
          to="/notifications"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.35rem',
            color: 'var(--primary)',
            fontWeight: 600,
          }}
        >
          View Full Notifications History <ArrowRight size={14} />
        </Link>
      </div>
    </div>
  );
};

export default AdminNotificationsWidget;
