import React, { useState, useEffect } from 'react';
import { getTicketHistory } from '../services/api';
import {
  History,
  PlusCircle,
  RefreshCw,
  AlertTriangle,
  UserCheck,
  Edit3,
  MessageSquare,
  Paperclip,
  Trash2,
  Clock,
  Loader2,
  ArrowRight,
} from 'lucide-react';

const getActionDetails = (action) => {
  switch (action) {
    case 'TICKET_CREATED':
      return {
        label: 'Ticket Created',
        icon: <PlusCircle size={15} color="#10b981" />,
        bgColor: 'rgba(16, 185, 129, 0.15)',
        borderColor: '#10b981',
      };
    case 'STATUS_CHANGED':
      return {
        label: 'Status Changed',
        icon: <RefreshCw size={15} color="#06b6d4" />,
        bgColor: 'rgba(6, 182, 212, 0.15)',
        borderColor: '#06b6d4',
      };
    case 'PRIORITY_CHANGED':
      return {
        label: 'Priority Changed',
        icon: <AlertTriangle size={15} color="#f59e0b" />,
        bgColor: 'rgba(245, 158, 11, 0.15)',
        borderColor: '#f59e0b',
      };
    case 'TICKET_ASSIGNED':
    case 'TICKET_REASSIGNED':
      return {
        label: action === 'TICKET_ASSIGNED' ? 'Ticket Assigned' : 'Ticket Reassigned',
        icon: <UserCheck size={15} color="#a855f7" />,
        bgColor: 'rgba(168, 85, 247, 0.15)',
        borderColor: '#a855f7',
      };
    case 'TICKET_UPDATED':
      return {
        label: 'Details Updated',
        icon: <Edit3 size={15} color="#6366f1" />,
        bgColor: 'rgba(99, 102, 241, 0.15)',
        borderColor: '#6366f1',
      };
    case 'COMMENT_ADDED':
      return {
        label: 'Comment Added',
        icon: <MessageSquare size={15} color="#14b8a6" />,
        bgColor: 'rgba(20, 184, 166, 0.15)',
        borderColor: '#14b8a6',
      };
    case 'COMMENT_DELETED':
      return {
        label: 'Comment Deleted',
        icon: <Trash2 size={15} color="#f43f5e" />,
        bgColor: 'rgba(244, 63, 94, 0.15)',
        borderColor: '#f43f5e',
      };
    case 'ATTACHMENT_ADDED':
      return {
        label: 'File Attached',
        icon: <Paperclip size={15} color="#ec4899" />,
        bgColor: 'rgba(236, 72, 153, 0.15)',
        borderColor: '#ec4899',
      };
    case 'ATTACHMENT_DELETED':
      return {
        label: 'Attachment Removed',
        icon: <Trash2 size={15} color="#f43f5e" />,
        bgColor: 'rgba(244, 63, 94, 0.15)',
        borderColor: '#f43f5e',
      };
    default:
      return {
        label: action.replace(/_/g, ' '),
        icon: <Clock size={15} color="#94a3b8" />,
        bgColor: 'rgba(148, 163, 184, 0.15)',
        borderColor: '#94a3b8',
      };
  }
};

const TicketHistory = ({ ticketId, refreshKey }) => {
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchHistory = async () => {
    try {
      const res = await getTicketHistory(ticketId);
      if (res && res.success) {
        setHistory(res.history);
      }
    } catch (err) {
      console.error('Failed to load ticket history:', err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (ticketId) {
      fetchHistory();
    }
  }, [ticketId, refreshKey]);

  const getRoleBadgeClass = (role) => {
    switch (role) {
      case 'admin':
        return 'badge-admin';
      case 'agent':
        return 'badge-agent';
      default:
        return 'badge-user';
    }
  };

  return (
    <div className="card" style={{ marginTop: '1.5rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem' }}>
        <h3 style={{ fontSize: '1.15rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <History size={18} color="var(--primary)" />
          Activity & Audit History
          <span
            style={{
              fontSize: '0.8rem',
              fontWeight: 600,
              background: 'rgba(99, 102, 241, 0.15)',
              color: 'var(--primary)',
              padding: '0.15rem 0.55rem',
              borderRadius: 'var(--radius-full)',
            }}
          >
            {history.length}
          </span>
        </h3>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '1.75rem 0', color: 'var(--text-muted)' }}>
          <Loader2 size={20} className="spin" style={{ margin: '0 auto 0.5rem' }} />
          <p style={{ fontSize: '0.85rem' }}>Loading activity audit trail...</p>
        </div>
      ) : history.length === 0 ? (
        <div
          style={{
            textAlign: 'center',
            padding: '2rem 1rem',
            background: 'rgba(255, 255, 255, 0.015)',
            borderRadius: 'var(--radius-md)',
            color: 'var(--text-muted)',
          }}
        >
          <History size={28} style={{ opacity: 0.3, marginBottom: '0.5rem' }} />
          <p style={{ fontSize: '0.875rem', fontWeight: 500 }}>No audit records found</p>
        </div>
      ) : (
        <div className="timeline-container" style={{ position: 'relative', paddingLeft: '1.5rem', marginTop: '0.5rem' }}>
          {/* Vertical Timeline Guide Line */}
          <div
            style={{
              position: 'absolute',
              top: '12px',
              bottom: '12px',
              left: '11px',
              width: '2px',
              background: 'rgba(255, 255, 255, 0.08)',
            }}
          />

          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            {history.map((item, index) => {
              const meta = getActionDetails(item.action);
              const actorName = item.performedBy?.name || 'System';
              const actorRole = item.performedBy?.role || 'system';

              return (
                <div key={item._id || index} style={{ position: 'relative', display: 'flex', gap: '1rem' }}>
                  {/* Timeline Node Icon */}
                  <div
                    style={{
                      position: 'absolute',
                      left: '-1.5rem',
                      top: '2px',
                      width: '24px',
                      height: '24px',
                      borderRadius: '50%',
                      background: meta.bgColor,
                      border: `1.5px solid ${meta.borderColor}`,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      zIndex: 1,
                      boxShadow: '0 0 10px rgba(0,0,0,0.5)',
                    }}
                  >
                    {meta.icon}
                  </div>

                  {/* Activity Details Card */}
                  <div
                    style={{
                      flex: 1,
                      background: 'rgba(255, 255, 255, 0.02)',
                      border: '1px solid var(--border-color)',
                      borderRadius: 'var(--radius-md)',
                      padding: '0.75rem 1rem',
                    }}
                  >
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        flexWrap: 'wrap',
                        gap: '0.5rem',
                        marginBottom: '0.35rem',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                        <span style={{ fontWeight: 600, fontSize: '0.88rem', color: 'var(--text-main)' }}>
                          {meta.label}
                        </span>
                        <span className={`badge ${getRoleBadgeClass(actorRole)}`} style={{ textTransform: 'capitalize' }}>
                          {actorRole}
                        </span>
                        <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                          by <strong>{actorName}</strong>
                        </span>
                      </div>

                      <span style={{ fontSize: '0.75rem', color: 'var(--text-dim)' }}>
                        {new Date(item.timestamp || item.createdAt).toLocaleString(undefined, {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </span>
                    </div>

                    {/* Transition / Detail Content */}
                    {(item.oldValue || item.newValue) && (
                      <div
                        style={{
                          fontSize: '0.8rem',
                          color: '#d1d5db',
                          background: 'rgba(0, 0, 0, 0.25)',
                          padding: '0.4rem 0.65rem',
                          borderRadius: 'var(--radius-sm)',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '0.5rem',
                          marginTop: '0.25rem',
                        }}
                      >
                        {item.oldValue && (
                          <span style={{ color: 'var(--text-dim)', textDecoration: 'line-through' }}>
                            {item.oldValue}
                          </span>
                        )}
                        {item.oldValue && item.newValue && <ArrowRight size={12} color="var(--primary)" />}
                        {item.newValue && (
                          <span style={{ fontWeight: 600, color: '#38bdf8' }}>
                            {item.newValue}
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

export default TicketHistory;
