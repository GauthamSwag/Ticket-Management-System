import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useSocket } from '../context/SocketContext';
import { useToast } from '../context/ToastContext';
import {
  getTicket,
  updateTicket,
  deleteTicket,
  assignTicket,
  updateTicketStatus,
  updateTicketPriority,
  getAgents,
  classifyTicket,
} from '../services/api';
import { StatusBadge, PriorityBadge, CategoryBadge } from '../components/TicketBadge';
import Alert from '../components/Alert';
import CommentSection from '../components/CommentSection';
import AttachmentSection from '../components/AttachmentSection';
import TicketHistory from '../components/TicketHistory';
import { TicketDetailsSkeleton } from '../components/SkeletonLoader';
import {
  ArrowLeft,
  Calendar,
  Clock,
  User,
  Shield,
  LifeBuoy,
  Edit,
  Trash2,
  CheckCircle2,
  UserCheck,
  AlertTriangle,
  Save,
  X,
  Lock,
  MessageSquare,
  Paperclip,
  History,
  Timer,
  Sparkles,
  AlertOctagon,
  Tag,
  Check,
} from 'lucide-react';

const PRIORITIES = ['Low', 'Medium', 'High', 'Critical'];

const TicketDetails = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user, isAdmin, isAgent, isUser } = useAuth();
  const { toast } = useToast();

  const [ticket, setTicket] = useState(null);
  const [agents, setAgents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [alert, setAlert] = useState({ type: '', message: '' });

  // Action states
  const [isEditing, setIsEditing] = useState(false);
  const [editTitle, setEditTitle] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [selectedAgentId, setSelectedAgentId] = useState('');
  const [isSubmittingAction, setIsSubmittingAction] = useState(false);

  // AI Classification states
  const [aiLoading, setAiLoading] = useState(false);
  const [aiSuggestion, setAiSuggestion] = useState(null);
  const [aiNotice, setAiNotice] = useState('');

  const { socket, joinTicketRoom, leaveTicketRoom } = useSocket();

  // Tab navigation states
  const [activeTab, setActiveTab] = useState('comments');
  const [historyRefreshKey, setHistoryRefreshKey] = useState(0);

  const triggerHistoryRefresh = () => {
    setHistoryRefreshKey((k) => k + 1);
  };

  const fetchTicketDetails = async () => {
    setLoading(true);
    try {
      const res = await getTicket(id);
      if (res && res.success) {
        setTicket(res.ticket);
        setEditTitle(res.ticket.title);
        setEditDescription(res.ticket.description);
        setSelectedAgentId(res.ticket.assignedTo?._id || '');
      }
    } catch (err) {
      setAlert({
        type: 'error',
        message: err.response?.data?.message || 'Failed to retrieve ticket details.',
      });
    } finally {
      setLoading(false);
    }
  };

  // Initial load
  useEffect(() => {
    fetchTicketDetails();

    if (isAdmin) {
      const fetchAgentsList = async () => {
        try {
          const res = await getAgents();
          if (res && res.success) {
            setAgents(res.users);
          }
        } catch (err) {
          console.error('Failed to load agents list:', err.message);
        }
      };
      fetchAgentsList();
    }
  }, [id, isAdmin]);

  // Real-time Socket.IO room subscription & event listeners
  useEffect(() => {
    if (!ticket?._id) return;

    joinTicketRoom(ticket._id);

    if (!socket) return;

    const handleStatusChanged = (payload) => {
      const updatedTicket = payload.data?.ticket || payload.ticket;
      if (updatedTicket) {
        setTicket(updatedTicket);
        toast.info(`Status updated to ${updatedTicket.status}`);
      }
      triggerHistoryRefresh();
    };

    const handlePriorityChanged = (payload) => {
      const updatedTicket = payload.data?.ticket || payload.ticket;
      if (updatedTicket) {
        setTicket(updatedTicket);
        toast.info(`Priority updated to ${updatedTicket.priority}`);
      }
      triggerHistoryRefresh();
    };

    const handleAssigned = (payload) => {
      const updatedTicket = payload.data?.ticket || payload.ticket;
      if (updatedTicket) {
        setTicket(updatedTicket);
        setSelectedAgentId(updatedTicket.assignedTo?._id || '');
        toast.info(`Ticket assigned to ${updatedTicket.assignedTo?.name || 'Agent'}`);
      }
      triggerHistoryRefresh();
    };

    const handleUpdated = (payload) => {
      const updatedTicket = payload.data?.ticket || payload.ticket;
      if (updatedTicket) {
        setTicket(updatedTicket);
      }
      triggerHistoryRefresh();
    };

    const handleHistoryUpdated = () => {
      triggerHistoryRefresh();
    };

    const handleSlaWarning = (payload) => {
      toast.warning(`SLA Warning: Ticket ${payload.ticketId || ticket.ticketId} is approaching its deadline!`);
      fetchTicketDetails();
    };

    const handleSlaBreached = (payload) => {
      toast.error(`SLA Target Breached for ticket ${payload.ticketId || ticket.ticketId}!`);
      fetchTicketDetails();
    };

    socket.on('ticket:statusChanged', handleStatusChanged);
    socket.on('ticket:priorityChanged', handlePriorityChanged);
    socket.on('ticket:assigned', handleAssigned);
    socket.on('ticket:updated', handleUpdated);
    socket.on('ticket:historyUpdated', handleHistoryUpdated);
    socket.on('sla:warning', handleSlaWarning);
    socket.on('sla:breached', handleSlaBreached);

    return () => {
      leaveTicketRoom(ticket._id);
      socket.off('ticket:statusChanged', handleStatusChanged);
      socket.off('ticket:priorityChanged', handlePriorityChanged);
      socket.off('ticket:assigned', handleAssigned);
      socket.off('ticket:updated', handleUpdated);
      socket.off('ticket:historyUpdated', handleHistoryUpdated);
      socket.off('sla:warning', handleSlaWarning);
      socket.off('sla:breached', handleSlaBreached);
    };
  }, [ticket?._id, socket]);

  // Handle AI Classification
  const handleClassify = async () => {
    setAiLoading(true);
    setAiNotice('');
    try {
      const res = await classifyTicket(ticket._id);
      if (res && res.success) {
        if (res.available && res.suggestion) {
          setAiSuggestion(res.suggestion);
          toast.success('AI Triage recommendation generated!');
        } else {
          setAiNotice(res.message || 'AI Classification is currently disabled in system configuration.');
        }
      }
    } catch (err) {
      setAiNotice(err.response?.data?.message || 'Failed to request AI classification.');
      toast.error('AI Triage request failed.');
    } finally {
      setAiLoading(false);
    }
  };

  // Handle Edit Save
  const handleSaveEdit = async (e) => {
    e.preventDefault();
    setAlert({ type: '', message: '' });

    if (!editTitle.trim() || !editDescription.trim()) {
      setAlert({ type: 'error', message: 'Title and description cannot be empty.' });
      return;
    }

    setIsSubmittingAction(true);
    try {
      const res = await updateTicket(ticket._id, {
        title: editTitle.trim(),
        description: editDescription.trim(),
      });
      if (res && res.success) {
        setTicket(res.ticket);
        setIsEditing(false);
        toast.success('Ticket updated successfully.');
        triggerHistoryRefresh();
      }
    } catch (err) {
      setAlert({
        type: 'error',
        message: err.response?.data?.message || 'Failed to update ticket.',
      });
      toast.error(err.response?.data?.message || 'Failed to update ticket.');
    } finally {
      setIsSubmittingAction(false);
    }
  };

  // Handle Ticket Assignment (Admin only)
  const handleAssignAgent = async () => {
    if (!selectedAgentId) return;
    setAlert({ type: '', message: '' });
    setIsSubmittingAction(true);

    try {
      const res = await assignTicket(ticket._id, selectedAgentId);
      if (res && res.success) {
        setTicket(res.ticket);
        toast.success(res.message);
        triggerHistoryRefresh();
      }
    } catch (err) {
      setAlert({
        type: 'error',
        message: err.response?.data?.message || 'Failed to assign ticket.',
      });
      toast.error(err.response?.data?.message || 'Failed to assign ticket.');
    } finally {
      setIsSubmittingAction(false);
    }
  };

  // Handle Status Workflow Transition
  const handleStatusChange = async (newStatus) => {
    setAlert({ type: '', message: '' });
    setIsSubmittingAction(true);

    try {
      const res = await updateTicketStatus(ticket._id, newStatus);
      if (res && res.success) {
        setTicket(res.ticket);
        toast.success(`Status changed to ${newStatus}`);
        triggerHistoryRefresh();
      }
    } catch (err) {
      setAlert({
        type: 'error',
        message: err.response?.data?.message || 'Status transition rejected.',
      });
      toast.error(err.response?.data?.message || 'Status transition rejected.');
    } finally {
      setIsSubmittingAction(false);
    }
  };

  // Handle Priority Adjustment
  const handlePriorityChange = async (newPriority) => {
    setAlert({ type: '', message: '' });
    setIsSubmittingAction(true);

    try {
      const res = await updateTicketPriority(ticket._id, newPriority);
      if (res && res.success) {
        setTicket(res.ticket);
        toast.success(`Priority updated to ${newPriority}`);
        triggerHistoryRefresh();
      }
    } catch (err) {
      setAlert({
        type: 'error',
        message: err.response?.data?.message || 'Failed to change priority.',
      });
      toast.error(err.response?.data?.message || 'Failed to change priority.');
    } finally {
      setIsSubmittingAction(false);
    }
  };

  // Handle Ticket Deletion
  const handleDeleteTicket = async () => {
    if (!window.confirm('Are you sure you want to permanently delete this support ticket?')) {
      return;
    }

    setAlert({ type: '', message: '' });
    setIsSubmittingAction(true);

    try {
      const res = await deleteTicket(ticket._id);
      if (res && res.success) {
        toast.success('Ticket deleted successfully.');
        navigate('/tickets');
      }
    } catch (err) {
      setAlert({
        type: 'error',
        message: err.response?.data?.message || 'Failed to delete ticket.',
      });
      toast.error(err.response?.data?.message || 'Failed to delete ticket.');
      setIsSubmittingAction(false);
    }
  };

  if (loading) {
    return (
      <div className="container" style={{ padding: '2.5rem 1.5rem 5rem', maxWidth: '1360px' }}>
        <TicketDetailsSkeleton />
      </div>
    );
  }

  if (!ticket) {
    return (
      <div className="container" style={{ padding: '4rem 1.5rem', textAlign: 'center' }}>
        <Alert type="error" message={alert.message || 'Ticket not found.'} />
        <Link to="/tickets" className="btn btn-primary" style={{ display: 'inline-flex', marginTop: '1rem' }}>
          <ArrowLeft size={16} /> Return to Tickets
        </Link>
      </div>
    );
  }

  // Permission conditions
  const isCreator = ticket.createdBy && ticket.createdBy._id === user?._id;
  const isAssignedAgent = ticket.assignedTo && ticket.assignedTo._id === user?._id;
  const canEditDetails = (isCreator && ticket.status === 'Open') || (isAgent && isAssignedAgent) || isAdmin;
  const canDelete = (isCreator && ticket.status === 'Open') || isAdmin;

  return (
    <div className="container" style={{ padding: '2rem 1.5rem 5rem', maxWidth: '1360px' }}>
      {/* Top Breadcrumb & Return Link */}
      <div style={{ marginBottom: '1.25rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Link
          to="/tickets"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.4rem',
            color: 'var(--text-muted)',
            fontSize: '0.875rem',
            fontWeight: 500,
          }}
        >
          <ArrowLeft size={15} /> Back to Tickets
        </Link>
      </div>

      {alert.message && (
        <Alert
          type={alert.type}
          message={alert.message}
          onClose={() => setAlert({ type: '', message: '' })}
        />
      )}

      {/* 2-Column Responsive Layout (Main 70% / Sidebar 30%) */}
      <div className="ticket-details-layout">
        {/* ========================================================================= */}
        {/* LEFT COLUMN: MAIN CONTENT (70%)                                           */}
        {/* ========================================================================= */}
        <div className="ticket-main-col">
          {/* Main Ticket Card: Header + Title + Description */}
          <div className="card" style={{ padding: '1.75rem' }}>
            {/* Header: ID, Badges, Action toolbar */}
            <div
              style={{
                display: 'flex',
                alignItems: 'flex-start',
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                gap: '1rem',
                marginBottom: '1rem',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '0.65rem' }}>
                <span
                  style={{
                    fontFamily: 'monospace',
                    fontSize: '1.05rem',
                    fontWeight: 800,
                    color: 'var(--primary)',
                    background: 'rgba(99, 102, 241, 0.12)',
                    border: '1px solid rgba(99, 102, 241, 0.25)',
                    padding: '0.2rem 0.65rem',
                    borderRadius: 'var(--radius-sm)',
                    letterSpacing: '0.04em',
                  }}
                >
                  {ticket.ticketId}
                </span>
                <StatusBadge status={ticket.status} />
                <PriorityBadge priority={ticket.priority} />
                <CategoryBadge category={ticket.category} />
              </div>

              {/* Edit / Delete Actions */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                {!isEditing && canEditDetails && (
                  <button
                    className="btn btn-secondary btn-sm"
                    onClick={() => setIsEditing(true)}
                    style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}
                    id="edit-ticket-btn"
                  >
                    <Edit size={14} /> Edit
                  </button>
                )}

                {canDelete && (
                  <button
                    className="btn btn-danger btn-sm"
                    onClick={handleDeleteTicket}
                    disabled={isSubmittingAction}
                    style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}
                    id="delete-ticket-btn"
                  >
                    <Trash2 size={14} /> Delete
                  </button>
                )}
              </div>
            </div>

            {/* Title */}
            {!isEditing ? (
              <h1 style={{ fontSize: '1.75rem', lineHeight: 1.3, marginBottom: '1.25rem', color: '#ffffff' }}>
                {ticket.title}
              </h1>
            ) : null}

            {/* Editing Form */}
            {isEditing && (
              <form onSubmit={handleSaveEdit} style={{ marginTop: '0.75rem', marginBottom: '1.25rem' }}>
                <div className="form-group">
                  <label className="form-label">Ticket Title</label>
                  <input
                    type="text"
                    className="form-input"
                    value={editTitle}
                    onChange={(e) => setEditTitle(e.target.value)}
                    maxLength={150}
                    required
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Detailed Description</label>
                  <textarea
                    rows={6}
                    className="form-input"
                    value={editDescription}
                    onChange={(e) => setEditDescription(e.target.value)}
                    required
                    style={{ resize: 'vertical' }}
                  />
                </div>

                <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    onClick={() => {
                      setIsEditing(false);
                      setEditTitle(ticket.title);
                      setEditDescription(ticket.description);
                    }}
                  >
                    <X size={14} /> Cancel
                  </button>
                  <button
                    type="submit"
                    className="btn btn-primary btn-sm"
                    disabled={isSubmittingAction}
                  >
                    <Save size={14} /> Save Changes
                  </button>
                </div>
              </form>
            )}

            {/* Description Display */}
            {!isEditing && (
              <div>
                <div className="ticket-meta-item-label" style={{ marginBottom: '0.5rem' }}>
                  Incident Description
                </div>
                <div
                  className="ticket-description-box"
                  style={{
                    background: 'rgba(255, 255, 255, 0.02)',
                    border: '1px solid var(--border-color)',
                    borderRadius: 'var(--radius-md)',
                    padding: '1.25rem 1.5rem',
                    lineHeight: 1.65,
                    fontSize: '0.95rem',
                    color: '#e2e8f0',
                    margin: 0,
                  }}
                >
                  {ticket.description}
                </div>
              </div>
            )}
          </div>

          {/* Discussion, Attachments & Timeline Tabs */}
          <div className="card" style={{ padding: '1.5rem' }}>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                borderBottom: '1px solid var(--border-color)',
                paddingBottom: '0.75rem',
                marginBottom: '1.25rem',
                overflowX: 'auto',
              }}
            >
              <button
                type="button"
                className="tab-nav-btn"
                onClick={() => setActiveTab('comments')}
                style={{
                  background: activeTab === 'comments' ? 'rgba(99, 102, 241, 0.15)' : 'none',
                  color: activeTab === 'comments' ? 'var(--primary)' : 'var(--text-muted)',
                  border: 'none',
                  padding: '0.45rem 0.85rem',
                  borderRadius: 'var(--radius-sm)',
                  fontWeight: 600,
                  fontSize: '0.85rem',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.4rem',
                  transition: 'all 0.15s ease',
                }}
              >
                <MessageSquare size={16} /> Comments &amp; Discussion
              </button>

              <button
                type="button"
                className="tab-nav-btn"
                onClick={() => setActiveTab('attachments')}
                style={{
                  background: activeTab === 'attachments' ? 'rgba(99, 102, 241, 0.15)' : 'none',
                  color: activeTab === 'attachments' ? 'var(--primary)' : 'var(--text-muted)',
                  border: 'none',
                  padding: '0.45rem 0.85rem',
                  borderRadius: 'var(--radius-sm)',
                  fontWeight: 600,
                  fontSize: '0.85rem',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.4rem',
                  transition: 'all 0.15s ease',
                }}
              >
                <Paperclip size={16} /> File Attachments
              </button>

              <button
                type="button"
                className="tab-nav-btn"
                onClick={() => setActiveTab('history')}
                style={{
                  background: activeTab === 'history' ? 'rgba(99, 102, 241, 0.15)' : 'none',
                  color: activeTab === 'history' ? 'var(--primary)' : 'var(--text-muted)',
                  border: 'none',
                  padding: '0.45rem 0.85rem',
                  borderRadius: 'var(--radius-sm)',
                  fontWeight: 600,
                  fontSize: '0.85rem',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.4rem',
                  transition: 'all 0.15s ease',
                }}
              >
                <History size={16} /> Activity &amp; Audit History
              </button>
            </div>

            {/* Tab Panes */}
            <div>
              {activeTab === 'comments' && (
                <CommentSection
                  ticketId={ticket._id}
                  ticketStatus={ticket.status}
                  onCommentAdded={triggerHistoryRefresh}
                />
              )}

              {activeTab === 'attachments' && (
                <AttachmentSection
                  ticketId={ticket._id}
                  ticketStatus={ticket.status}
                  onAttachmentChanged={triggerHistoryRefresh}
                />
              )}

              {activeTab === 'history' && (
                <TicketHistory ticketId={ticket._id} refreshTrigger={historyRefreshKey} />
              )}
            </div>
          </div>
        </div>

        {/* ========================================================================= */}
        {/* RIGHT COLUMN: SIDEBAR METADATA & ACTIONS (30%)                            */}
        {/* ========================================================================= */}
        <div className="ticket-sidebar-col">
          {/* 1. Status & Lifecycle Transition Card */}
          {(isAdmin || (isAgent && isAssignedAgent)) && (
            <div className="card" style={{ padding: '1.25rem' }}>
              <h3 style={{ fontSize: '0.9rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-dim)', marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <CheckCircle2 size={16} color="#10b981" />
                Workflow Actions
              </h3>
              <p style={{ fontSize: '0.825rem', color: 'var(--text-muted)', marginBottom: '1rem' }}>
                Current Status: <strong style={{ color: '#ffffff' }}>{ticket.status}</strong>
              </p>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                {ticket.status === 'Open' && (
                  <button
                    className="btn btn-secondary btn-sm"
                    onClick={() => handleStatusChange('In Progress')}
                    disabled={isSubmittingAction}
                    style={{ width: '100%', justifyContent: 'center' }}
                  >
                    Mark In Progress
                  </button>
                )}

                {ticket.status === 'Assigned' && (
                  <button
                    className="btn btn-primary btn-sm"
                    onClick={() => handleStatusChange('In Progress')}
                    disabled={isSubmittingAction}
                    style={{ width: '100%', justifyContent: 'center' }}
                  >
                    Start Working &rarr; In Progress
                  </button>
                )}

                {ticket.status === 'In Progress' && (
                  <button
                    className="btn btn-primary btn-sm"
                    onClick={() => handleStatusChange('Resolved')}
                    disabled={isSubmittingAction}
                    style={{ background: 'var(--success)', width: '100%', justifyContent: 'center' }}
                  >
                    <CheckCircle2 size={14} /> Mark as Resolved
                  </button>
                )}

                {ticket.status === 'Resolved' && (
                  <>
                    <button
                      className="btn btn-secondary btn-sm"
                      onClick={() => handleStatusChange('Closed')}
                      disabled={isSubmittingAction}
                      style={{ width: '100%', justifyContent: 'center' }}
                    >
                      <Lock size={14} /> Close Ticket
                    </button>
                    <button
                      className="btn btn-secondary btn-sm"
                      onClick={() => handleStatusChange('In Progress')}
                      disabled={isSubmittingAction}
                      style={{ width: '100%', justifyContent: 'center' }}
                    >
                      Reopen Incident
                    </button>
                  </>
                )}

                {ticket.status === 'Closed' && isAdmin && (
                  <button
                    className="btn btn-secondary btn-sm"
                    onClick={() => handleStatusChange('In Progress')}
                    disabled={isSubmittingAction}
                    style={{ width: '100%', justifyContent: 'center' }}
                  >
                    Admin Reopen Ticket
                  </button>
                )}
              </div>
            </div>
          )}

          {/* 2. Personnel & Assignment Card */}
          <div className="card" style={{ padding: '1.25rem' }}>
            <h3 style={{ fontSize: '0.9rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-dim)', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <User size={16} color="var(--primary)" />
              People &amp; Assignment
            </h3>

            {/* Created By */}
            <div style={{ marginBottom: '1.25rem' }}>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-dim)', marginBottom: '0.35rem', fontWeight: 600 }}>
                SUBMITTED BY
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: 'rgba(99, 102, 241, 0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--primary)', fontWeight: 700, fontSize: '0.85rem' }}>
                  {ticket.createdBy?.name?.charAt(0) || 'U'}
                </div>
                <div>
                  <div style={{ fontWeight: 600, fontSize: '0.875rem', color: 'var(--text-main)' }}>
                    {ticket.createdBy?.name || 'Unknown'}
                  </div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-dim)' }}>
                    {ticket.createdBy?.email} &bull; {ticket.createdBy?.department || 'User'}
                  </div>
                </div>
              </div>
            </div>

            {/* Assigned Agent */}
            <div style={{ marginBottom: isAdmin ? '1.25rem' : '0' }}>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-dim)', marginBottom: '0.35rem', fontWeight: 600 }}>
                ASSIGNED AGENT
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: ticket.assignedTo ? 'rgba(6, 182, 212, 0.15)' : 'rgba(255, 255, 255, 0.05)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: ticket.assignedTo ? '#06b6d4' : 'var(--text-dim)', fontWeight: 700, fontSize: '0.85rem' }}>
                  {ticket.assignedTo ? ticket.assignedTo.name?.charAt(0) : '?'}
                </div>
                <div>
                  <div style={{ fontWeight: 600, fontSize: '0.875rem', color: ticket.assignedTo ? 'var(--text-main)' : 'var(--text-dim)' }}>
                    {ticket.assignedTo ? ticket.assignedTo.name : 'Awaiting Assignment'}
                  </div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-dim)' }}>
                    {ticket.assignedTo ? `${ticket.assignedTo.email} • ${ticket.assignedTo.department}` : 'No agent assigned yet'}
                  </div>
                </div>
              </div>
            </div>

            {/* Admin Assignment Control */}
            {isAdmin && (
              <div style={{ paddingTop: '1rem', borderTop: '1px solid var(--border-color)' }}>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-dim)', marginBottom: '0.45rem', fontWeight: 600 }}>
                  REASSIGN SUPPORT AGENT
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  <select
                    className="form-select"
                    value={selectedAgentId}
                    onChange={(e) => setSelectedAgentId(e.target.value)}
                    style={{ fontSize: '0.825rem', padding: '0.45rem 0.65rem' }}
                    id="agent-assignment-select"
                  >
                    <option value="">-- Select Support Agent --</option>
                    {agents.map((ag) => (
                      <option key={ag._id} value={ag._id}>
                        {ag.name} ({ag.department})
                      </option>
                    ))}
                  </select>
                  <button
                    className="btn btn-secondary btn-sm"
                    onClick={handleAssignAgent}
                    disabled={!selectedAgentId || isSubmittingAction}
                    style={{ justifyContent: 'center' }}
                    id="confirm-assignment-btn"
                  >
                    {isSubmittingAction ? 'Assigning...' : 'Confirm Assignment'}
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* 3. SLA Monitor & Targets Card */}
          <div className="card" style={{ padding: '1.25rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
              <h3 style={{ fontSize: '0.9rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-dim)', margin: 0, display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <Timer size={16} color="var(--primary)" />
                SLA Deadlines
              </h3>
              <span
                style={{
                  fontSize: '0.7rem',
                  fontWeight: 700,
                  padding: '0.15rem 0.45rem',
                  borderRadius: 'var(--radius-sm)',
                  background: ticket.sla?.responseBreached || ticket.sla?.resolutionBreached ? 'rgba(239, 68, 68, 0.15)' : 'rgba(16, 185, 129, 0.15)',
                  color: ticket.sla?.responseBreached || ticket.sla?.resolutionBreached ? '#ef4444' : '#10b981',
                }}
              >
                {ticket.sla?.responseBreached || ticket.sla?.resolutionBreached ? 'Breached' : 'Compliant'}
              </span>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
              {/* Response Target */}
              <div style={{ background: 'rgba(255, 255, 255, 0.02)', padding: '0.75rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-color)' }}>
                <div style={{ fontSize: '0.7rem', color: 'var(--text-dim)', fontWeight: 600 }}>FIRST RESPONSE TARGET</div>
                <div style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-main)', marginTop: '0.15rem' }}>
                  {ticket.sla?.responseDueAt ? new Date(ticket.sla.responseDueAt).toLocaleString() : 'Standard SLA'}
                </div>
                <div style={{ fontSize: '0.75rem', marginTop: '0.25rem', color: ticket.sla?.firstRespondedAt ? '#34d399' : ticket.sla?.responseBreached ? '#ef4444' : '#38bdf8' }}>
                  {ticket.sla?.firstRespondedAt
                    ? `✓ Responded ${new Date(ticket.sla.firstRespondedAt).toLocaleTimeString()}`
                    : ticket.sla?.responseBreached
                    ? '⚠️ Target Missed'
                    : 'Awaiting Staff Response'}
                </div>
              </div>

              {/* Resolution Target */}
              <div style={{ background: 'rgba(255, 255, 255, 0.02)', padding: '0.75rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-color)' }}>
                <div style={{ fontSize: '0.7rem', color: 'var(--text-dim)', fontWeight: 600 }}>RESOLUTION TARGET</div>
                <div style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-main)', marginTop: '0.15rem' }}>
                  {ticket.sla?.resolutionDueAt ? new Date(ticket.sla.resolutionDueAt).toLocaleString() : 'Standard SLA'}
                </div>
                <div style={{ fontSize: '0.75rem', marginTop: '0.25rem', color: ticket.status === 'Resolved' || ticket.status === 'Closed' ? '#34d399' : ticket.sla?.resolutionBreached ? '#ef4444' : '#f59e0b' }}>
                  {ticket.status === 'Resolved' || ticket.status === 'Closed'
                    ? '✓ Incident Resolved'
                    : ticket.sla?.resolutionBreached
                    ? '⚠️ Target Breached'
                    : 'Target Active'}
                </div>
              </div>
            </div>
          </div>

          {/* 4. Priority Management & AI Triage Card */}
          {(isAdmin || (isAgent && isAssignedAgent)) && (
            <div className="card" style={{ padding: '1.25rem' }}>
              <h3 style={{ fontSize: '0.9rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-dim)', marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <AlertTriangle size={16} color="#f59e0b" />
                Priority &amp; AI Triage
              </h3>

              {/* Priority Buttons */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '0.4rem', marginBottom: '1rem' }}>
                {PRIORITIES.map((p) => (
                  <button
                    key={p}
                    type="button"
                    className={`btn btn-sm ${ticket.priority === p ? 'btn-primary' : 'btn-secondary'}`}
                    onClick={() => handlePriorityChange(p)}
                    disabled={ticket.priority === p || isSubmittingAction}
                    style={{ fontSize: '0.8rem', padding: '0.35rem 0.5rem' }}
                  >
                    {p}
                  </button>
                ))}
              </div>

              {/* AI Triage Trigger */}
              <div style={{ paddingTop: '0.75rem', borderTop: '1px solid var(--border-color)' }}>
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={handleClassify}
                  disabled={aiLoading}
                  style={{ width: '100%', justifyContent: 'center', fontSize: '0.8rem' }}
                  id="ai-classify-btn"
                >
                  <Sparkles size={14} color="#a855f7" className={aiLoading ? 'spin' : ''} />
                  {aiLoading ? 'Analyzing...' : 'Analyze with AI'}
                </button>

                {aiSuggestion && (
                  <div style={{ marginTop: '0.75rem', padding: '0.65rem', background: 'rgba(0, 0, 0, 0.25)', borderRadius: 'var(--radius-sm)', fontSize: '0.75rem' }}>
                    <div style={{ color: '#38bdf8', fontWeight: 700, marginBottom: '0.25rem' }}>
                      {(aiSuggestion.confidence * 100).toFixed(0)}% Confidence Match
                    </div>
                    <div>Category: <strong style={{ color: '#a855f7' }}>{aiSuggestion.category}</strong></div>
                    <div>Priority: <strong style={{ color: '#f59e0b' }}>{aiSuggestion.priority}</strong></div>
                  </div>
                )}
                {aiNotice && (
                  <div style={{ marginTop: '0.5rem', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                    {aiNotice}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* 5. Ticket Timestamps Card */}
          <div className="card" style={{ padding: '1.25rem' }}>
            <h3 style={{ fontSize: '0.9rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-dim)', marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <Clock size={16} color="var(--text-dim)" />
              Timeline
            </h3>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem', fontSize: '0.8rem' }}>
              <div>
                <span style={{ color: 'var(--text-dim)' }}>Submitted: </span>
                <span style={{ color: 'var(--text-main)', fontWeight: 500 }}>
                  {new Date(ticket.createdAt).toLocaleString()}
                </span>
              </div>
              <div>
                <span style={{ color: 'var(--text-dim)' }}>Updated: </span>
                <span style={{ color: 'var(--text-main)', fontWeight: 500 }}>
                  {new Date(ticket.updatedAt).toLocaleString()}
                </span>
              </div>
              {ticket.resolvedAt && (
                <div>
                  <span style={{ color: 'var(--text-dim)' }}>Resolved: </span>
                  <span style={{ color: '#34d399', fontWeight: 600 }}>
                    {new Date(ticket.resolvedAt).toLocaleString()}
                  </span>
                </div>
              )}
              {ticket.closedAt && (
                <div>
                  <span style={{ color: 'var(--text-dim)' }}>Closed: </span>
                  <span style={{ color: 'var(--text-muted)', fontWeight: 500 }}>
                    {new Date(ticket.closedAt).toLocaleString()}
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TicketDetails;
