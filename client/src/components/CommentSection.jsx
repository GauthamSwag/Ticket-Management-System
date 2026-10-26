import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useSocket } from '../context/SocketContext';
import { getComments, createComment, deleteComment } from '../services/api';
import { MessageSquare, Send, Trash2, User, Loader2, AlertCircle } from 'lucide-react';

const CommentSection = ({ ticketId, onActivityChange }) => {
  const { user, isAdmin } = useAuth();
  const { socket } = useSocket();
  const [comments, setComments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [newComment, setNewComment] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [deletingId, setDeletingId] = useState(null);
  const [error, setError] = useState('');

  const fetchComments = async () => {
    try {
      const res = await getComments(ticketId);
      if (res && res.success) {
        setComments(res.comments);
      }
    } catch (err) {
      console.error('Failed to load comments:', err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (ticketId) {
      fetchComments();
    }
  }, [ticketId]);

  // Real-time socket listener for incoming & deleted comments
  useEffect(() => {
    if (!socket || !ticketId) return;

    const handleCommentCreated = (payload) => {
      const incoming = payload.data || payload;
      if (incoming && incoming._id) {
        setComments((prev) => {
          if (prev.some((c) => c._id === incoming._id)) return prev;
          return [...prev, incoming];
        });
        if (onActivityChange) onActivityChange();
      }
    };

    const handleCommentDeleted = (payload) => {
      const delId = payload.data?.commentId || payload.commentId;
      if (delId) {
        setComments((prev) => prev.filter((c) => c._id !== delId));
        if (onActivityChange) onActivityChange();
      }
    };

    socket.on('comment:created', handleCommentCreated);
    socket.on('comment:deleted', handleCommentDeleted);

    return () => {
      socket.off('comment:created', handleCommentCreated);
      socket.off('comment:deleted', handleCommentDeleted);
    };
  }, [socket, ticketId]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!newComment.trim() || submitting) return;

    setSubmitting(true);
    setError('');

    try {
      const res = await createComment(ticketId, newComment.trim());
      if (res && res.success) {
        setComments((prev) => [...prev, res.comment]);
        setNewComment('');
        if (onActivityChange) onActivityChange();
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to submit comment.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (commentId) => {
    if (!window.confirm('Are you sure you want to delete this comment?')) return;

    setDeletingId(commentId);
    setError('');

    try {
      const res = await deleteComment(ticketId, commentId);
      if (res && res.success) {
        setComments((prev) => prev.filter((c) => c._id !== commentId));
        if (onActivityChange) onActivityChange();
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to delete comment.');
    } finally {
      setDeletingId(null);
    }
  };

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
          <MessageSquare size={18} color="var(--primary)" />
          Discussion & Comments
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
            {comments.length}
          </span>
        </h3>
      </div>

      {error && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            padding: '0.75rem 1rem',
            background: 'var(--danger-bg)',
            border: '1px solid var(--danger)',
            borderRadius: 'var(--radius-sm)',
            color: '#fca5a5',
            fontSize: '0.85rem',
            marginBottom: '1rem',
          }}
        >
          <AlertCircle size={16} />
          <span>{error}</span>
        </div>
      )}

      {/* Comments List */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: '2rem 0', color: 'var(--text-muted)' }}>
          <Loader2 size={24} className="spin" style={{ margin: '0 auto 0.5rem' }} />
          <p style={{ fontSize: '0.875rem' }}>Loading conversation...</p>
        </div>
      ) : comments.length === 0 ? (
        <div
          style={{
            textAlign: 'center',
            padding: '2.5rem 1rem',
            background: 'rgba(255, 255, 255, 0.02)',
            borderRadius: 'var(--radius-md)',
            border: '1px dashed var(--border-color)',
            color: 'var(--text-muted)',
            marginBottom: '1.5rem',
          }}
        >
          <MessageSquare size={32} style={{ opacity: 0.3, marginBottom: '0.5rem' }} />
          <p style={{ fontSize: '0.9rem', fontWeight: 500 }}>No comments yet</p>
          <p style={{ fontSize: '0.8rem', color: 'var(--text-dim)', marginTop: '0.25rem' }}>
            Be the first to share an update, diagnosis, or question.
          </p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginBottom: '1.75rem' }}>
          {comments.map((comment) => {
            const isAuthor = user && comment.user && (user._id === comment.user._id || user._id === comment.user);
            const canDeleteComment = isAuthor || isAdmin;
            const authorRole = comment.user?.role || 'user';
            const authorName = comment.user?.name || 'User';
            const initial = authorName.charAt(0).toUpperCase();

            return (
              <div
                key={comment._id}
                className="comment-item"
                style={{
                  background: 'rgba(255, 255, 255, 0.025)',
                  border: '1px solid var(--border-color)',
                  borderRadius: 'var(--radius-md)',
                  padding: '1.1rem',
                  display: 'flex',
                  gap: '1rem',
                }}
              >
                {/* Author Avatar */}
                <div
                  style={{
                    width: '36px',
                    height: '36px',
                    borderRadius: '50%',
                    background:
                      authorRole === 'admin'
                        ? 'linear-gradient(135deg, #a855f7, #6366f1)'
                        : authorRole === 'agent'
                        ? 'linear-gradient(135deg, #06b6d4, #3b82f6)'
                        : 'linear-gradient(135deg, #10b981, #059669)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontWeight: 700,
                    fontSize: '0.9rem',
                    color: '#ffffff',
                    flexShrink: 0,
                    boxShadow: 'var(--shadow-sm)',
                  }}
                >
                  {initial}
                </div>

                {/* Comment Content */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      flexWrap: 'wrap',
                      gap: '0.5rem',
                      marginBottom: '0.4rem',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                      <span style={{ fontWeight: 600, fontSize: '0.9rem', color: 'var(--text-main)' }}>
                        {authorName}
                      </span>
                      <span className={`badge ${getRoleBadgeClass(authorRole)}`} style={{ textTransform: 'capitalize' }}>
                        {authorRole}
                      </span>
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-dim)' }}>
                        {new Date(comment.createdAt).toLocaleString(undefined, {
                          month: 'short',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </span>
                    </div>

                    {canDeleteComment && (
                      <button
                        type="button"
                        onClick={() => handleDelete(comment._id)}
                        disabled={deletingId === comment._id}
                        title="Delete comment"
                        style={{
                          background: 'none',
                          border: 'none',
                          color: 'var(--text-dim)',
                          cursor: 'pointer',
                          padding: '0.2rem',
                          borderRadius: '4px',
                          display: 'flex',
                          alignItems: 'center',
                          transition: 'color 0.2s',
                        }}
                        onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--danger)')}
                        onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--text-dim)')}
                      >
                        {deletingId === comment._id ? (
                          <Loader2 size={14} className="spin" />
                        ) : (
                          <Trash2 size={14} />
                        )}
                      </button>
                    )}
                  </div>

                  <p
                    style={{
                      fontSize: '0.88rem',
                      lineHeight: 1.6,
                      color: '#d1d5db',
                      whiteSpace: 'pre-wrap',
                      wordBreak: 'break-word',
                    }}
                  >
                    {comment.message}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Add Comment Input Form */}
      <form onSubmit={handleSubmit} style={{ marginTop: '1rem' }}>
        <div style={{ position: 'relative' }}>
          <textarea
            className="form-input"
            rows={3}
            placeholder="Type your reply or comment here..."
            value={newComment}
            onChange={(e) => setNewComment(e.target.value)}
            maxLength={2000}
            required
            style={{
              resize: 'vertical',
              paddingRight: '4rem',
              fontSize: '0.9rem',
              lineHeight: 1.5,
              background: 'rgba(17, 24, 39, 0.85)',
            }}
          />
        </div>

        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginTop: '0.75rem',
          }}
        >
          <span style={{ fontSize: '0.75rem', color: 'var(--text-dim)' }}>
            {newComment.length} / 2000 characters
          </span>

          <button
            type="submit"
            className="btn btn-primary btn-sm"
            disabled={submitting || !newComment.trim()}
            style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}
          >
            {submitting ? (
              <>
                <Loader2 size={14} className="spin" /> Posting...
              </>
            ) : (
              <>
                <Send size={14} /> Post Comment
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
};

export default CommentSection;
