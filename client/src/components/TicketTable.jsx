import React from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { StatusBadge, PriorityBadge, CategoryBadge } from './TicketBadge';
import { UserCheck, Calendar, ArrowRight } from 'lucide-react';

const TicketTable = ({ tickets }) => {
  const navigate = useNavigate();

  if (!tickets || tickets.length === 0) {
    return null;
  }

  return (
    <div className="ticket-table-container">
      <table className="ticket-table">
        <thead>
          <tr>
            <th>Ticket ID</th>
            <th>Title & Category</th>
            <th>Priority</th>
            <th>Status</th>
            <th>Assigned Agent</th>
            <th>Created</th>
            <th style={{ textAlign: 'right' }}>Action</th>
          </tr>
        </thead>
        <tbody>
          {tickets.map((ticket) => (
            <tr
              key={ticket._id}
              onClick={() => navigate(`/tickets/${ticket._id}`)}
              title="Click to view ticket details"
              style={{ cursor: 'pointer' }}
              className="ticket-table-row"
            >
              <td style={{ whiteSpace: 'nowrap' }}>
                <Link
                  to={`/tickets/${ticket._id}`}
                  onClick={(e) => e.stopPropagation()}
                  className="ticket-id-link"
                  style={{
                    fontFamily: 'monospace',
                    fontWeight: 700,
                    color: 'var(--primary)',
                    background: 'rgba(99, 102, 241, 0.1)',
                    padding: '0.25rem 0.55rem',
                    borderRadius: 'var(--radius-sm)',
                    fontSize: '0.85rem',
                    textDecoration: 'none',
                    display: 'inline-block',
                  }}
                >
                  {ticket.ticketId}
                </Link>
              </td>
              <td>
                <div style={{ fontWeight: 600, color: 'var(--text-main)', marginBottom: '0.25rem' }}>
                  {ticket.title}
                </div>
                <div>
                  <CategoryBadge category={ticket.category} />
                </div>
              </td>
              <td style={{ whiteSpace: 'nowrap' }}>
                <PriorityBadge priority={ticket.priority} />
              </td>
              <td style={{ whiteSpace: 'nowrap' }}>
                <StatusBadge status={ticket.status} />
              </td>
              <td style={{ whiteSpace: 'nowrap' }}>
                {ticket.assignedTo ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.875rem' }}>
                    <div
                      style={{
                        width: '22px',
                        height: '22px',
                        borderRadius: '50%',
                        background: 'var(--role-agent-bg)',
                        color: '#67e8f9',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '0.7rem',
                        fontWeight: 700,
                      }}
                    >
                      {ticket.assignedTo.name?.charAt(0).toUpperCase()}
                    </div>
                    <span>{ticket.assignedTo.name}</span>
                  </div>
                ) : (
                  <span style={{ color: 'var(--text-dim)', fontStyle: 'italic', fontSize: '0.85rem' }}>
                    Unassigned
                  </span>
                )}
              </td>
              <td style={{ whiteSpace: 'nowrap', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                  <Calendar size={13} style={{ opacity: 0.6 }} />
                  <span>{new Date(ticket.createdAt).toLocaleDateString()}</span>
                </div>
              </td>
              <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                <Link
                  to={`/tickets/${ticket._id}`}
                  className="btn btn-secondary btn-sm"
                  onClick={(e) => e.stopPropagation()}
                  style={{ padding: '0.3rem 0.65rem', display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}
                >
                  <span>View</span>
                  <ArrowRight size={13} />
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default TicketTable;
