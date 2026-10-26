import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  getNotifications,
  markNotificationAsRead,
  markAllNotificationsAsRead,
  deleteNotification,
} from '../services/api';
import { useSocket } from '../context/SocketContext';
import Alert from '../components/Alert';
import { TableSkeleton } from '../components/SkeletonLoader';
import EmptyState from '../components/EmptyState';
import {
  Bell,
  CheckCheck,
  Check,
  Trash2,
  Ticket as TicketIcon,
  MessageSquare,
  UserCheck,
  Paperclip,
  AlertCircle,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  Filter,
  Inbox,
  ExternalLink,
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

const getNotificationIcon = (type) => {
  switch (type) {
    case 'TICKET_ASSIGNED':
      return <UserCheck size={18} color="#a855f7" />;
    case 'TICKET_STATUS_CHANGED':
      return <TicketIcon size={18} color="#06b6d4" />;
    case 'TICKET_PRIORITY_CHANGED':
      return <AlertCircle size={18} color="#f59e0b" />;
    case 'TICKET_COMMENT':
      return <MessageSquare size={18} color="#14b8a6" />;
    case 'TICKET_ATTACHMENT':
      return <Paperclip size={18} color="#ec4899" />;
    case 'TICKET_CREATED':
      return <TicketIcon size={18} color="#6366f1" />;
    default:
      return <Bell size={18} color="var(--primary)" />;
  }
};

const Notifications = () => {
  const navigate = useNavigate();
  const { socket } = useSocket();

  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [alert, setAlert] = useState({ type: '', message: '' });

  // Filters & Pagination State
  const [statusFilter, setStatusFilter] = useState('all'); // 'all', 'unread', 'read'
  const [page, setPage] = useState(1);
  const [limit] = useState(10);
  const [pagination, setPagination] = useState({
    totalItems: 0,
    totalPages: 1,
    currentPage: 1,
    hasNextPage: false,
    hasPreviousPage: false,
  });
  const [unreadCount, setUnreadCount] = useState(0);

  // Fetch Notifications from Server
  const fetchNotificationsList = useCallback(async () => {
    setLoading(true);
    try {
      const params = {
        page,
        limit,
      };

      if (statusFilter === 'unread') {
        params.isRead = 'false';
      } else if (statusFilter === 'read') {
        params.isRead = 'true';
      }

      const res = await getNotifications(params);
      if (res && res.success) {
        setNotifications(res.notifications || []);
        if (typeof res.unreadCount === 'number') {
          setUnreadCount(res.unreadCount);
        }
        if (res.pagination) {
          setPagination(res.pagination);
        } else {
          setPagination({
            totalItems: res.total || res.notifications.length,
            totalPages: Math.ceil((res.total || res.notifications.length) / limit) || 1,
            currentPage: page,
            hasNextPage: page < Math.ceil((res.total || res.notifications.length) / limit),
            hasPreviousPage: page > 1,
          });
        }
      }
    } catch (err) {
      console.error('Failed to fetch notifications:', err);
      setAlert({
        type: 'danger',
        message: err.response?.data?.message || 'Failed to load notifications list.',
      });
    } finally {
      setLoading(false);
    }
  }, [page, limit, statusFilter]);

  useEffect(() => {
    fetchNotificationsList();
  }, [fetchNotificationsList]);

  // Cross-component sync listener
  useEffect(() => {
    const handleSync = (e) => {
      if (e?.detail?.source === 'NotificationsPage') return;
      fetchNotificationsList();
    };
    window.addEventListener('notifications:sync', handleSync);
    return () => window.removeEventListener('notifications:sync', handleSync);
  }, [fetchNotificationsList]);

  // Real-time socket listener
  useEffect(() => {
    if (!socket) return;

    const handleNewNotification = (payload) => {
      const newNotif = payload?.data || payload;
      if (!newNotif || !newNotif._id) return;

      setNotifications((prev) => {
        if (prev.some((n) => n._id === newNotif._id)) return prev;
        if (!newNotif.isRead) {
          setUnreadCount((c) => c + 1);
          setPagination((p) => ({
            ...p,
            totalItems: p.totalItems + 1,
          }));
        }
        return [newNotif, ...prev];
      });
    };

    socket.on('notification:new', handleNewNotification);

    return () => {
      socket.off('notification:new', handleNewNotification);
    };
  }, [socket]);

  // Handle Mark Single Notification as Read and Navigate to Ticket
  const handleItemClick = async (notif) => {
    if (!notif.isRead) {
      try {
        await markNotificationAsRead(notif._id);
        setNotifications((prev) =>
          prev.map((n) => (n._id === notif._id ? { ...n, isRead: true } : n))
        );
        setUnreadCount((c) => Math.max(0, c - 1));
        window.dispatchEvent(
          new CustomEvent('notifications:sync', { detail: { source: 'NotificationsPage' } })
        );
      } catch (err) {
        console.error('Error marking notification as read:', err);
      }
    }

    if (notif.ticket) {
      const ticketIdVal = notif.ticket._id || notif.ticket;
      navigate(`/tickets/${ticketIdVal}`);
    }
  };

  // Mark single as read via button
  const handleMarkAsRead = async (e, id) => {
    e.stopPropagation();
    try {
      await markNotificationAsRead(id);
      setNotifications((prev) =>
        prev.map((n) => (n._id === id ? { ...n, isRead: true } : n))
      );
      setUnreadCount((c) => Math.max(0, c - 1));
      window.dispatchEvent(
        new CustomEvent('notifications:sync', { detail: { source: 'NotificationsPage' } })
      );
      setAlert({ type: 'success', message: 'Notification marked as read.' });
    } catch (err) {
      console.error('Failed to mark notification as read:', err);
      setAlert({ type: 'danger', message: 'Failed to mark notification as read.' });
    }
  };

  // Mark all notifications as read
  const handleMarkAllRead = async () => {
    try {
      await markAllNotificationsAsRead();
      setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
      setUnreadCount(0);
      window.dispatchEvent(
        new CustomEvent('notifications:sync', { detail: { source: 'NotificationsPage' } })
      );
      setAlert({ type: 'success', message: 'All notifications marked as read.' });
    } catch (err) {
      console.error('Failed to mark all as read:', err);
      setAlert({ type: 'danger', message: 'Failed to mark all as read.' });
    }
  };

  // Delete notification
  const handleDeleteNotification = async (e, id) => {
    e.stopPropagation();
    try {
      await deleteNotification(id);
      setNotifications((prev) => prev.filter((n) => n._id !== id));
      window.dispatchEvent(
        new CustomEvent('notifications:sync', { detail: { source: 'NotificationsPage' } })
      );
      setAlert({ type: 'success', message: 'Notification deleted.' });
      fetchNotificationsList();
    } catch (err) {
      console.error('Failed to delete notification:', err);
      setAlert({ type: 'danger', message: 'Failed to delete notification.' });
    }
  };

  return (
    <div className="container" style={{ padding: '2rem 1rem', maxWidth: '1000px', margin: '0 auto' }}>
      {/* Page Header */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          flexWrap: 'wrap',
          gap: '1rem',
          marginBottom: '1.75rem',
        }}
      >
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.35rem' }}>
            <div
              style={{
                width: '36px',
                height: '36px',
                borderRadius: 'var(--radius-sm)',
                background: 'rgba(99, 102, 241, 0.15)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--primary)',
              }}
            >
              <Bell size={20} />
            </div>
            <h1 style={{ fontSize: '1.75rem', fontWeight: 800, margin: 0, letterSpacing: '-0.02em' }}>
              Notification Center
            </h1>
          </div>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', margin: 0 }}>
            Stay updated with real-time alerts, assignment notices, comments, and SLA updates.
          </p>
        </div>

        {/* Global Actions */}
        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={fetchNotificationsList}
            disabled={loading}
            title="Refresh notifications"
            id="refresh-notifications-btn"
            style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.85rem' }}
          >
            <RefreshCw size={14} className={loading ? 'spin' : ''} />
            Refresh
          </button>

          {unreadCount > 0 && (
            <button
              type="button"
              className="btn btn-primary"
              id="mark-all-notifications-page-btn"
              onClick={handleMarkAllRead}
              style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', fontSize: '0.85rem' }}
            >
              <CheckCheck size={16} />
              Mark all as read ({unreadCount})
            </button>
          )}
        </div>
      </div>

      {/* Alert banner */}
      {alert.message && (
        <Alert
          type={alert.type}
          message={alert.message}
          onClose={() => setAlert({ type: '', message: '' })}
        />
      )}

      {/* Filter Tabs & Stats Bar */}
      <div
        className="card"
        style={{
          padding: '0.85rem 1.25rem',
          marginBottom: '1.5rem',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '1rem',
        }}
      >
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
          <Filter size={15} style={{ color: 'var(--text-dim)', marginRight: '0.25rem' }} />
          <button
            type="button"
            id="filter-all-btn"
            onClick={() => {
              setStatusFilter('all');
              setPage(1);
            }}
            style={{
              background: statusFilter === 'all' ? 'var(--primary)' : 'rgba(255, 255, 255, 0.05)',
              color: statusFilter === 'all' ? '#ffffff' : 'var(--text-muted)',
              border: '1px solid ' + (statusFilter === 'all' ? 'var(--primary)' : 'var(--border-color)'),
              padding: '0.35rem 0.85rem',
              borderRadius: 'var(--radius-full)',
              fontSize: '0.82rem',
              fontWeight: 600,
              cursor: 'pointer',
              transition: 'all 0.15s ease',
            }}
          >
            All
          </button>
          <button
            type="button"
            id="filter-unread-btn"
            onClick={() => {
              setStatusFilter('unread');
              setPage(1);
            }}
            style={{
              background: statusFilter === 'unread' ? 'var(--primary)' : 'rgba(255, 255, 255, 0.05)',
              color: statusFilter === 'unread' ? '#ffffff' : 'var(--text-muted)',
              border: '1px solid ' + (statusFilter === 'unread' ? 'var(--primary)' : 'var(--border-color)'),
              padding: '0.35rem 0.85rem',
              borderRadius: 'var(--radius-full)',
              fontSize: '0.82rem',
              fontWeight: 600,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '0.35rem',
              transition: 'all 0.15s ease',
            }}
          >
            Unread
            {unreadCount > 0 && (
              <span
                style={{
                  background: statusFilter === 'unread' ? 'rgba(255, 255, 255, 0.25)' : 'var(--danger)',
                  color: '#ffffff',
                  fontSize: '0.7rem',
                  fontWeight: 700,
                  padding: '0 5px',
                  borderRadius: '10px',
                }}
              >
                {unreadCount}
              </span>
            )}
          </button>
          <button
            type="button"
            id="filter-read-btn"
            onClick={() => {
              setStatusFilter('read');
              setPage(1);
            }}
            style={{
              background: statusFilter === 'read' ? 'var(--primary)' : 'rgba(255, 255, 255, 0.05)',
              color: statusFilter === 'read' ? '#ffffff' : 'var(--text-muted)',
              border: '1px solid ' + (statusFilter === 'read' ? 'var(--primary)' : 'var(--border-color)'),
              padding: '0.35rem 0.85rem',
              borderRadius: 'var(--radius-full)',
              fontSize: '0.82rem',
              fontWeight: 600,
              cursor: 'pointer',
              transition: 'all 0.15s ease',
            }}
          >
            Read
          </button>
        </div>

        <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
          Showing{' '}
          <strong style={{ color: 'var(--text-main)' }}>
            {notifications.length > 0 ? (page - 1) * limit + 1 : 0} -{' '}
            {Math.min(page * limit, pagination.totalItems)}
          </strong>{' '}
          of <strong style={{ color: 'var(--text-main)' }}>{pagination.totalItems}</strong> notifications
        </div>
      </div>

      {/* Notifications List Container */}
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        {loading ? (
          <div style={{ padding: '1rem' }}>
            <TableSkeleton rows={5} cols={3} />
          </div>
        ) : notifications.length === 0 ? (
          <EmptyState
            icon={<Inbox size={32} />}
            title={statusFilter === 'unread' ? 'No unread notifications' : 'No notifications found'}
            description={
              statusFilter === 'unread'
                ? "You are completely caught up! There are no unread notifications at this time."
                : 'When tickets are created, assigned, or updated, real-time alerts will appear here.'
            }
            actionText={statusFilter === 'unread' ? 'View All Notifications' : undefined}
            onAction={statusFilter === 'unread' ? () => setStatusFilter('all') : undefined}
          />
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {notifications.map((n) => {
              const hasTicket = Boolean(n.ticket);
              const ticketIdCode = n.ticket?.ticketId || (typeof n.ticket === 'string' ? n.ticket : null);

              return (
                <div
                  key={n._id}
                  onClick={() => handleItemClick(n)}
                  className="notification-list-item"
                  style={{
                    padding: '1.15rem 1.35rem',
                    borderBottom: '1px solid rgba(255, 255, 255, 0.05)',
                    background: n.isRead ? 'transparent' : 'rgba(99, 102, 241, 0.08)',
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: '1rem',
                    cursor: hasTicket ? 'pointer' : 'default',
                    transition: 'all 0.15s ease',
                    position: 'relative',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = n.isRead
                      ? 'rgba(255, 255, 255, 0.03)'
                      : 'rgba(99, 102, 241, 0.12)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = n.isRead
                      ? 'transparent'
                      : 'rgba(99, 102, 241, 0.08)';
                  }}
                >
                  {/* Distinct Unread Indicator Dot */}
                  {!n.isRead && (
                    <span
                      title="Unread notification"
                      style={{
                        position: 'absolute',
                        left: '8px',
                        top: '22px',
                        width: '8px',
                        height: '8px',
                        borderRadius: '50%',
                        background: 'var(--primary)',
                        boxShadow: '0 0 8px var(--primary)',
                      }}
                    />
                  )}

                  {/* Icon Box */}
                  <div
                    style={{
                      width: '38px',
                      height: '38px',
                      borderRadius: 'var(--radius-sm)',
                      background: n.isRead ? 'rgba(255, 255, 255, 0.04)' : 'rgba(99, 102, 241, 0.15)',
                      border: '1px solid ' + (n.isRead ? 'rgba(255, 255, 255, 0.08)' : 'rgba(99, 102, 241, 0.25)'),
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0,
                    }}
                  >
                    {getNotificationIcon(n.type)}
                  </div>

                  {/* Main Details */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: '0.75rem',
                        marginBottom: '0.25rem',
                      }}
                    >
                      <h4
                        style={{
                          fontSize: '0.92rem',
                          fontWeight: n.isRead ? 600 : 700,
                          color: n.isRead ? 'var(--text-main)' : '#ffffff',
                          margin: 0,
                          lineHeight: 1.3,
                        }}
                      >
                        {n.title}
                      </h4>
                      <span
                        style={{
                          fontSize: '0.75rem',
                          color: 'var(--text-dim)',
                          flexShrink: 0,
                        }}
                        title={new Date(n.createdAt).toLocaleString()}
                      >
                        {formatTimeAgo(n.createdAt)}
                      </span>
                    </div>

                    <p
                      style={{
                        fontSize: '0.85rem',
                        color: 'var(--text-muted)',
                        lineHeight: 1.45,
                        margin: 0,
                        wordBreak: 'break-word',
                      }}
                    >
                      {n.message}
                    </p>

                    {/* Metadata & Ticket Link */}
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        flexWrap: 'wrap',
                        gap: '0.65rem',
                        marginTop: '0.6rem',
                      }}
                    >
                      {ticketIdCode && (
                        <span
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '0.3rem',
                            fontFamily: 'monospace',
                            fontSize: '0.75rem',
                            fontWeight: 700,
                            color: 'var(--primary)',
                            background: 'rgba(99, 102, 241, 0.12)',
                            border: '1px solid rgba(99, 102, 241, 0.25)',
                            padding: '0.15rem 0.5rem',
                            borderRadius: '4px',
                          }}
                        >
                          <TicketIcon size={12} />
                          {ticketIdCode}
                          {hasTicket && <ExternalLink size={10} style={{ opacity: 0.7 }} />}
                        </span>
                      )}

                      <span
                        style={{
                          fontSize: '0.72rem',
                          color: 'var(--text-dim)',
                          textTransform: 'uppercase',
                          letterSpacing: '0.04em',
                          fontWeight: 600,
                        }}
                      >
                        {n.type?.replace(/_/g, ' ')}
                      </span>
                    </div>
                  </div>

                  {/* Actions (Mark read, Delete) */}
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.35rem',
                      flexShrink: 0,
                      marginLeft: '0.5rem',
                    }}
                  >
                    {!n.isRead && (
                      <button
                        type="button"
                        onClick={(e) => handleMarkAsRead(e, n._id)}
                        title="Mark as read"
                        style={{
                          background: 'rgba(255, 255, 255, 0.05)',
                          border: '1px solid var(--border-color)',
                          color: 'var(--text-muted)',
                          padding: '0.35rem',
                          borderRadius: 'var(--radius-sm)',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          transition: 'all 0.15s ease',
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.color = 'var(--primary)';
                          e.currentTarget.style.borderColor = 'var(--primary)';
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.color = 'var(--text-muted)';
                          e.currentTarget.style.borderColor = 'var(--border-color)';
                        }}
                      >
                        <Check size={14} />
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={(e) => handleDeleteNotification(e, n._id)}
                      title="Delete notification"
                      style={{
                        background: 'rgba(255, 255, 255, 0.05)',
                        border: '1px solid var(--border-color)',
                        color: 'var(--text-dim)',
                        padding: '0.35rem',
                        borderRadius: 'var(--radius-sm)',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        transition: 'all 0.15s ease',
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.color = 'var(--danger)';
                        e.currentTarget.style.borderColor = 'var(--danger)';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.color = 'var(--text-dim)';
                        e.currentTarget.style.borderColor = 'var(--border-color)';
                      }}
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Pagination Footer */}
        {pagination.totalPages > 1 && (
          <div
            style={{
              padding: '0.85rem 1.25rem',
              borderTop: '1px solid var(--border-color)',
              background: 'rgba(255, 255, 255, 0.02)',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: '0.75rem',
            }}
          >
            <span style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
              Page <strong>{pagination.currentPage}</strong> of{' '}
              <strong>{pagination.totalPages}</strong>
            </span>

            <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
              <button
                type="button"
                className="btn btn-secondary"
                id="pagination-prev-btn"
                disabled={!pagination.hasPreviousPage || loading}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                style={{
                  padding: '0.35rem 0.75rem',
                  fontSize: '0.82rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.25rem',
                }}
              >
                <ChevronLeft size={14} /> Previous
              </button>

              <button
                type="button"
                className="btn btn-secondary"
                id="pagination-next-btn"
                disabled={!pagination.hasNextPage || loading}
                onClick={() => setPage((p) => p + 1)}
                style={{
                  padding: '0.35rem 0.75rem',
                  fontSize: '0.82rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.25rem',
                }}
              >
                Next <ChevronRight size={14} />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Notifications;
