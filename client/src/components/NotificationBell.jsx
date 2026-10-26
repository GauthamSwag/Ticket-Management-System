import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSocket } from '../context/SocketContext';
import {
  getNotifications,
  getUnreadNotificationCount,
  markNotificationAsRead,
  markAllNotificationsAsRead,
  deleteNotification,
} from '../services/api';
import {
  Bell,
  CheckCheck,
  Trash2,
  Ticket as TicketIcon,
  MessageSquare,
  UserCheck,
  Paperclip,
  AlertCircle,
  Loader2,
} from 'lucide-react';

const formatTimeAgo = (dateStr) => {
  const diffMs = Date.now() - new Date(dateStr).getTime();
  const diffSecs = Math.floor(diffMs / 1000);
  const diffMins = Math.floor(diffSecs / 60);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffSecs < 60) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  return `${diffDays}d ago`;
};

const getNotificationIcon = (type) => {
  switch (type) {
    case 'TICKET_ASSIGNED':
      return <UserCheck size={16} color="#a855f7" />;
    case 'TICKET_STATUS_CHANGED':
      return <TicketIcon size={16} color="#06b6d4" />;
    case 'TICKET_PRIORITY_CHANGED':
      return <AlertCircle size={16} color="#f59e0b" />;
    case 'TICKET_COMMENT':
      return <MessageSquare size={16} color="#14b8a6" />;
    case 'TICKET_ATTACHMENT':
      return <Paperclip size={16} color="#ec4899" />;
    default:
      return <Bell size={16} color="var(--primary)" />;
  }
};

const NotificationBell = () => {
  const navigate = useNavigate();
  const { socket } = useSocket();
  const [isOpen, setIsOpen] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const dropdownRef = useRef(null);

  const fetchUnread = async () => {
    try {
      const res = await getUnreadNotificationCount();
      if (res && res.success) {
        setUnreadCount(res.count);
      }
    } catch (err) {
      console.error('Failed to fetch unread notification count:', err.message);
    }
  };

  const fetchList = async () => {
    if (notifications.length === 0) {
      setLoading(true);
    }
    try {
      const res = await getNotifications({ limit: 30 });
      if (res && res.success) {
        setNotifications(res.notifications || []);
        if (typeof res.unreadCount === 'number') {
          setUnreadCount(res.unreadCount);
        }
      }
    } catch (err) {
      console.error('Failed to load notifications list:', err.message);
    } finally {
      setLoading(false);
    }
  };

  // Initial load & cross-component sync
  useEffect(() => {
    fetchUnread();
    const handleSync = (e) => {
      if (e?.detail?.source === 'NotificationBell') return;
      fetchUnread();
    };
    window.addEventListener('notifications:sync', handleSync);
    return () => window.removeEventListener('notifications:sync', handleSync);
  }, []);

  // Real-time listener for incoming notification
  useEffect(() => {
    if (!socket) return;

    const handleNewNotification = (payload) => {
      const newNotif = payload?.data || payload;
      if (!newNotif || !newNotif._id) return;

      setNotifications((prev) => {
        if (prev.some((n) => n._id === newNotif._id)) return prev;
        if (!newNotif.isRead) {
          setUnreadCount((c) => c + 1);
        }
        return [newNotif, ...prev];
      });
    };

    socket.on('notification:new', handleNewNotification);

    return () => {
      socket.off('notification:new', handleNewNotification);
    };
  }, [socket]);

  // Handle outside click to close dropdown
  useEffect(() => {
    const handleOutsideClick = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleOutsideClick);
    }

    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
    };
  }, [isOpen]);

  const toggleDropdown = () => {
    if (!isOpen) {
      fetchList();
    }
    setIsOpen(!isOpen);
  };

  const handleNotificationClick = async (notif) => {
    if (!notif.isRead) {
      try {
        await markNotificationAsRead(notif._id);
        setNotifications((prev) =>
          prev.map((n) => (n._id === notif._id ? { ...n, isRead: true } : n))
        );
        setUnreadCount((c) => Math.max(0, c - 1));
        window.dispatchEvent(
          new CustomEvent('notifications:sync', { detail: { source: 'NotificationBell' } })
        );
      } catch (err) {
        console.error('Failed to mark notification read:', err.message);
      }
    }

    setIsOpen(false);
    if (notif.ticket) {
      const ticketIdVal = notif.ticket._id || notif.ticket;
      navigate(`/tickets/${ticketIdVal}`);
    }
  };

  const handleMarkAllRead = async (e) => {
    e.stopPropagation();
    try {
      await markAllNotificationsAsRead();
      setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
      setUnreadCount(0);
      window.dispatchEvent(
        new CustomEvent('notifications:sync', { detail: { source: 'NotificationBell' } })
      );
    } catch (err) {
      console.error('Failed to mark all notifications read:', err.message);
    }
  };

  const handleDelete = async (e, id) => {
    e.stopPropagation();
    try {
      await deleteNotification(id);
      setNotifications((prev) => prev.filter((n) => n._id !== id));
      fetchUnread();
      window.dispatchEvent(
        new CustomEvent('notifications:sync', { detail: { source: 'NotificationBell' } })
      );
    } catch (err) {
      console.error('Failed to delete notification:', err.message);
    }
  };

  return (
    <div style={{ position: 'relative' }} ref={dropdownRef}>
      {/* Bell Button */}
      <button
        type="button"
        id="notification-bell-btn"
        onClick={toggleDropdown}
        title="Notifications"
        style={{
          background: isOpen ? 'rgba(255, 255, 255, 0.08)' : 'transparent',
          border: '1px solid var(--border-color)',
          borderRadius: 'var(--radius-sm)',
          color: unreadCount > 0 ? 'var(--text-main)' : 'var(--text-muted)',
          padding: '0.45rem 0.6rem',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          gap: '0.4rem',
          position: 'relative',
          transition: 'all 0.2s',
        }}
      >
        <Bell size={18} />
        {unreadCount > 0 && (
          <span
            id="notification-badge"
            style={{
              background: 'var(--danger)',
              color: '#ffffff',
              fontSize: '0.7rem',
              fontWeight: 800,
              minWidth: '18px',
              height: '18px',
              padding: '0 4px',
              borderRadius: 'var(--radius-full)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 0 10px rgba(239, 68, 68, 0.5)',
            }}
          >
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {/* Notifications Dropdown Panel */}
      {isOpen && (
        <div
          id="notification-dropdown-panel"
          style={{
            position: 'absolute',
            right: 0,
            top: 'calc(100% + 8px)',
            width: '380px',
            maxWidth: '90vw',
            background: 'rgba(17, 24, 39, 0.98)',
            backdropFilter: 'blur(16px)',
            border: '1px solid rgba(255, 255, 255, 0.12)',
            borderRadius: 'var(--radius-md)',
            boxShadow: 'var(--shadow-lg)',
            zIndex: 1000,
            display: 'flex',
            flexDirection: 'column',
            maxHeight: '520px',
            overflow: 'hidden',
          }}
        >
          {/* Header */}
          <div
            style={{
              padding: '0.85rem 1rem',
              borderBottom: '1px solid var(--border-color)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              background: 'rgba(255, 255, 255, 0.02)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <span style={{ fontWeight: 700, fontSize: '0.9rem', color: 'var(--text-main)' }}>
                Notifications
              </span>
              {unreadCount > 0 && (
                <span
                  style={{
                    background: 'rgba(99, 102, 241, 0.15)',
                    color: 'var(--primary)',
                    fontSize: '0.75rem',
                    fontWeight: 700,
                    padding: '0.1rem 0.45rem',
                    borderRadius: 'var(--radius-full)',
                  }}
                >
                  {unreadCount} unread
                </span>
              )}
            </div>

            {unreadCount > 0 && (
              <button
                type="button"
                id="mark-all-read-btn"
                onClick={handleMarkAllRead}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'var(--primary)',
                  fontSize: '0.78rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.3rem',
                }}
              >
                <CheckCheck size={14} /> Mark all read
              </button>
            )}
          </div>

          {/* Notification List (Top 5 Recent) */}
          <div style={{ flex: 1, overflowY: 'auto' }}>
            {loading ? (
              <div style={{ textAlign: 'center', padding: '2rem 1rem', color: 'var(--text-muted)' }}>
                <Loader2 size={20} className="spin" style={{ margin: '0 auto 0.5rem' }} />
                <p style={{ fontSize: '0.85rem' }}>Loading notifications...</p>
              </div>
            ) : notifications.length === 0 ? (
              <div
                style={{
                  textAlign: 'center',
                  padding: '2.5rem 1rem',
                  color: 'var(--text-muted)',
                }}
              >
                <Bell size={28} style={{ opacity: 0.25, marginBottom: '0.5rem' }} />
                <p style={{ fontSize: '0.85rem', fontWeight: 500 }}>No notifications yet</p>
                <p style={{ fontSize: '0.75rem', color: 'var(--text-dim)', marginTop: '0.2rem' }}>
                  You will be notified about updates to your tickets here.
                </p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                {notifications.slice(0, 5).map((n) => (
                  <div
                    key={n._id}
                    onClick={() => handleNotificationClick(n)}
                    style={{
                      padding: '0.85rem 1rem',
                      borderBottom: '1px solid rgba(255, 255, 255, 0.04)',
                      background: n.isRead ? 'transparent' : 'rgba(99, 102, 241, 0.06)',
                      display: 'flex',
                      gap: '0.75rem',
                      cursor: 'pointer',
                      transition: 'background 0.15s ease',
                      position: 'relative',
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.04)')}
                    onMouseLeave={(e) =>
                      (e.currentTarget.style.backgroundColor = n.isRead
                        ? 'transparent'
                        : 'rgba(99, 102, 241, 0.06)')
                    }
                  >
                    {/* Status dot */}
                    {!n.isRead && (
                      <span
                        style={{
                          position: 'absolute',
                          left: '6px',
                          top: '18px',
                          width: '6px',
                          height: '6px',
                          borderRadius: '50%',
                          background: 'var(--primary)',
                        }}
                      />
                    )}

                    {/* Icon */}
                    <div
                      style={{
                        width: '30px',
                        height: '30px',
                        borderRadius: 'var(--radius-sm)',
                        background: 'rgba(255, 255, 255, 0.04)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0,
                      }}
                    >
                      {getNotificationIcon(n.type)}
                    </div>

                    {/* Info */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem' }}>
                        <p
                          style={{
                            fontSize: '0.82rem',
                            fontWeight: n.isRead ? 600 : 700,
                            color: n.isRead ? 'var(--text-main)' : '#ffffff',
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                          }}
                        >
                          {n.title}
                        </p>
                        <span style={{ fontSize: '0.7rem', color: 'var(--text-dim)', flexShrink: 0 }}>
                          {formatTimeAgo(n.createdAt)}
                        </span>
                      </div>

                      <p
                        style={{
                          fontSize: '0.78rem',
                          color: 'var(--text-muted)',
                          lineHeight: 1.4,
                          marginTop: '0.2rem',
                          wordBreak: 'break-word',
                        }}
                      >
                        {n.message}
                      </p>

                      {n.ticket?.ticketId && (
                        <span
                          style={{
                            display: 'inline-block',
                            marginTop: '0.35rem',
                            fontFamily: 'monospace',
                            fontSize: '0.7rem',
                            fontWeight: 700,
                            color: 'var(--primary)',
                            background: 'rgba(99, 102, 241, 0.1)',
                            padding: '0.1rem 0.4rem',
                            borderRadius: '3px',
                          }}
                        >
                          {n.ticket.ticketId}
                        </span>
                      )}
                    </div>

                    {/* Delete action */}
                    <button
                      type="button"
                      onClick={(e) => handleDelete(e, n._id)}
                      title="Delete notification"
                      style={{
                        background: 'none',
                        border: 'none',
                        color: 'var(--text-dim)',
                        cursor: 'pointer',
                        padding: '0.2rem',
                        alignSelf: 'flex-start',
                      }}
                      onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--danger)')}
                      onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--text-dim)')}
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Footer - View All Notifications */}
          <div
            style={{
              padding: '0.75rem 1rem',
              borderTop: '1px solid var(--border-color)',
              background: 'rgba(255, 255, 255, 0.02)',
              textAlign: 'center',
            }}
          >
            <button
              type="button"
              id="view-all-notifications-btn"
              onClick={() => {
                setIsOpen(false);
                navigate('/notifications');
              }}
              style={{
                background: 'none',
                border: 'none',
                color: 'var(--primary)',
                fontSize: '0.82rem',
                fontWeight: 600,
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.35rem',
                padding: '0.25rem 0.65rem',
                borderRadius: 'var(--radius-sm)',
                transition: 'all 0.15s ease',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.color = '#818cf8';
                e.currentTarget.style.background = 'rgba(99, 102, 241, 0.1)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.color = 'var(--primary)';
                e.currentTarget.style.background = 'none';
              }}
            >
              View All Notifications &rarr;
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default NotificationBell;
