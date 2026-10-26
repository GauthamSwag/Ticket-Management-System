import React from 'react';
import {
  Ticket,
  AlertCircle,
  UserCheck,
  Clock,
  CheckCircle2,
  Lock,
  AlertTriangle,
  UserX,
} from 'lucide-react';

const OverviewCards = ({ overview = {}, loading = false }) => {
  const cards = [
    {
      title: 'Total Tickets',
      value: overview.totalTickets || 0,
      icon: <Ticket size={22} color="var(--primary)" />,
      bg: 'rgba(99, 102, 241, 0.12)',
      border: 'rgba(99, 102, 241, 0.25)',
    },
    {
      title: 'Open',
      value: overview.openTickets || 0,
      icon: <AlertCircle size={22} color="#3b82f6" />,
      bg: 'rgba(59, 130, 246, 0.12)',
      border: 'rgba(59, 130, 246, 0.25)',
    },
    {
      title: 'Assigned',
      value: overview.assignedTickets || 0,
      icon: <UserCheck size={22} color="#a855f7" />,
      bg: 'rgba(168, 85, 247, 0.12)',
      border: 'rgba(168, 85, 247, 0.25)',
    },
    {
      title: 'In Progress',
      value: overview.inProgressTickets || 0,
      icon: <Clock size={22} color="#06b6d4" />,
      bg: 'rgba(6, 182, 212, 0.12)',
      border: 'rgba(6, 182, 212, 0.25)',
    },
    {
      title: 'Resolved',
      value: overview.resolvedTickets || 0,
      icon: <CheckCircle2 size={22} color="#10b981" />,
      bg: 'rgba(16, 185, 129, 0.12)',
      border: 'rgba(16, 185, 129, 0.25)',
    },
    {
      title: 'Closed',
      value: overview.closedTickets || 0,
      icon: <Lock size={22} color="#94a3b8" />,
      bg: 'rgba(148, 163, 184, 0.12)',
      border: 'rgba(148, 163, 184, 0.25)',
    },
    {
      title: 'Critical Priority',
      value: overview.criticalTickets || 0,
      icon: <AlertTriangle size={22} color="#ef4444" />,
      bg: 'rgba(239, 68, 68, 0.12)',
      border: 'rgba(239, 68, 68, 0.25)',
    },
    {
      title: 'Unassigned',
      value: overview.unassignedTickets || 0,
      icon: <UserX size={22} color="#f59e0b" />,
      bg: 'rgba(245, 158, 11, 0.12)',
      border: 'rgba(245, 158, 11, 0.25)',
    },
  ];

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
        gap: '1rem',
        marginBottom: '2rem',
      }}
    >
      {cards.map((card, idx) => (
        <div
          key={idx}
          style={{
            background: 'var(--bg-card)',
            border: `1px solid ${card.border}`,
            borderRadius: 'var(--radius-md)',
            padding: '1.25rem',
            display: 'flex',
            alignItems: 'center',
            gap: '1rem',
            backdropFilter: 'blur(12px)',
            transition: 'transform 0.2s ease, box-shadow 0.2s ease',
          }}
          onMouseEnter={(e) => (e.currentTarget.style.transform = 'translateY(-2px)')}
          onMouseLeave={(e) => (e.currentTarget.style.transform = 'none')}
        >
          <div
            style={{
              width: '46px',
              height: '46px',
              borderRadius: 'var(--radius-md)',
              background: card.bg,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            {card.icon}
          </div>
          <div>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-dim)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              {card.title}
            </div>
            <div style={{ fontSize: '1.75rem', fontWeight: 800, color: 'var(--text-main)', lineHeight: 1.2, marginTop: '0.2rem' }}>
              {loading ? '...' : card.value}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
};

export default OverviewCards;
