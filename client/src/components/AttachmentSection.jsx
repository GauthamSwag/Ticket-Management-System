import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { useSocket } from '../context/SocketContext';
import { getAttachments, uploadAttachment, downloadAttachment, deleteAttachment } from '../services/api';
import {
  Paperclip,
  Upload,
  Download,
  Trash2,
  File,
  FileText,
  Image as ImageIcon,
  Table as TableIcon,
  Loader2,
  AlertCircle,
  CheckCircle2,
} from 'lucide-react';

const ALLOWED_EXTENSIONS = ['jpg', 'jpeg', 'png', 'webp', 'pdf', 'doc', 'docx', 'xls', 'xlsx'];
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

const formatBytes = (bytes) => {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

const getFileIcon = (mimeType, originalName = '') => {
  const ext = originalName.split('.').pop().toLowerCase();
  if (mimeType?.startsWith('image/') || ['jpg', 'jpeg', 'png', 'webp'].includes(ext)) {
    return <ImageIcon size={20} color="#38bdf8" />;
  }
  if (mimeType?.includes('pdf') || ext === 'pdf') {
    return <FileText size={20} color="#f87171" />;
  }
  if (
    mimeType?.includes('excel') ||
    mimeType?.includes('spreadsheet') ||
    ['xls', 'xlsx'].includes(ext)
  ) {
    return <TableIcon size={20} color="#34d399" />;
  }
  if (mimeType?.includes('word') || ['doc', 'docx'].includes(ext)) {
    return <FileText size={20} color="#818cf8" />;
  }
  return <File size={20} color="#94a3b8" />;
};

const AttachmentSection = ({ ticketId, onActivityChange }) => {
  const { user, isAdmin } = useAuth();
  const { socket } = useSocket();
  const fileInputRef = useRef(null);

  const [attachments, setAttachments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedFile, setSelectedFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [downloadingId, setDownloadingId] = useState(null);
  const [deletingId, setDeletingId] = useState(null);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  const fetchAttachmentsList = async () => {
    try {
      const res = await getAttachments(ticketId);
      if (res && res.success) {
        setAttachments(res.attachments);
      }
    } catch (err) {
      console.error('Failed to load attachments:', err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (ticketId) {
      fetchAttachmentsList();
    }
  }, [ticketId]);

  // Real-time socket listener for incoming & deleted attachments
  useEffect(() => {
    if (!socket || !ticketId) return;

    const handleAttachmentAdded = (payload) => {
      const incoming = payload.data || payload;
      if (incoming && incoming._id) {
        setAttachments((prev) => {
          if (prev.some((a) => a._id === incoming._id)) return prev;
          return [incoming, ...prev];
        });
        if (onActivityChange) onActivityChange();
      }
    };

    const handleAttachmentDeleted = (payload) => {
      const delId = payload.data?.attachmentId || payload.attachmentId;
      if (delId) {
        setAttachments((prev) => prev.filter((a) => a._id !== delId));
        if (onActivityChange) onActivityChange();
      }
    };

    socket.on('attachment:added', handleAttachmentAdded);
    socket.on('attachment:deleted', handleAttachmentDeleted);

    return () => {
      socket.off('attachment:added', handleAttachmentAdded);
      socket.off('attachment:deleted', handleAttachmentDeleted);
    };
  }, [socket, ticketId]);

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    setError('');
    setSuccessMsg('');

    if (!file) {
      setSelectedFile(null);
      return;
    }

    const ext = file.name.split('.').pop().toLowerCase();
    if (!ALLOWED_EXTENSIONS.includes(ext)) {
      setError(`Invalid file format (.${ext}). Allowed: ${ALLOWED_EXTENSIONS.join(', ')}`);
      setSelectedFile(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    if (file.size > MAX_FILE_SIZE) {
      setError(`File size (${formatBytes(file.size)}) exceeds the 10MB maximum limit.`);
      setSelectedFile(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    setSelectedFile(file);
  };

  const handleUpload = async (e) => {
    e.preventDefault();
    if (!selectedFile || uploading) return;

    setUploading(true);
    setError('');
    setSuccessMsg('');

    try {
      const res = await uploadAttachment(ticketId, selectedFile);
      if (res && res.success) {
        setAttachments((prev) => [res.attachment, ...prev]);
        setSelectedFile(null);
        if (fileInputRef.current) fileInputRef.current.value = '';
        setSuccessMsg(`"${res.attachment.originalName}" uploaded successfully.`);
        if (onActivityChange) onActivityChange();
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to upload attachment.');
    } finally {
      setUploading(false);
    }
  };

  const handleDownload = async (attachment) => {
    setDownloadingId(attachment._id);
    setError('');
    try {
      await downloadAttachment(ticketId, attachment._id, attachment.originalName);
    } catch (err) {
      setError('Failed to download file. Please try again.');
    } finally {
      setDownloadingId(null);
    }
  };

  const handleDelete = async (attachmentId) => {
    if (!window.confirm('Are you sure you want to delete this file attachment?')) return;

    setDeletingId(attachmentId);
    setError('');
    setSuccessMsg('');

    try {
      const res = await deleteAttachment(ticketId, attachmentId);
      if (res && res.success) {
        setAttachments((prev) => prev.filter((a) => a._id !== attachmentId));
        setSuccessMsg('Attachment removed successfully.');
        if (onActivityChange) onActivityChange();
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to delete attachment.');
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="card" style={{ marginTop: '1.5rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem' }}>
        <h3 style={{ fontSize: '1.15rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Paperclip size={18} color="var(--primary)" />
          File Attachments
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
            {attachments.length}
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

      {successMsg && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            padding: '0.75rem 1rem',
            background: 'var(--success-bg)',
            border: '1px solid var(--success)',
            borderRadius: 'var(--radius-sm)',
            color: '#6ee7b7',
            fontSize: '0.85rem',
            marginBottom: '1rem',
          }}
        >
          <CheckCircle2 size={16} />
          <span>{successMsg}</span>
        </div>
      )}

      {/* File Upload Zone */}
      <form
        onSubmit={handleUpload}
        style={{
          background: 'rgba(255, 255, 255, 0.02)',
          border: '1px dashed var(--border-color)',
          borderRadius: 'var(--radius-md)',
          padding: '1.25rem',
          marginBottom: '1.5rem',
          display: 'flex',
          flexDirection: 'column',
          gap: '0.75rem',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.75rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileChange}
              accept=".jpg,.jpeg,.png,.webp,.pdf,.doc,.docx,.xls,.xlsx"
              style={{ display: 'none' }}
              id="ticket-file-input"
            />
            <label
              htmlFor="ticket-file-input"
              className="btn btn-secondary btn-sm"
              style={{ cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '0.4rem', margin: 0 }}
            >
              <Upload size={14} /> Choose File
            </label>

            {selectedFile ? (
              <span style={{ fontSize: '0.85rem', color: 'var(--text-main)', fontWeight: 500 }}>
                {selectedFile.name} ({formatBytes(selectedFile.size)})
              </span>
            ) : (
              <span style={{ fontSize: '0.8rem', color: 'var(--text-dim)' }}>
                Max 10MB (PDF, DOC/DOCX, XLS/XLSX, PNG, JPG, WEBP)
              </span>
            )}
          </div>

          <button
            type="submit"
            className="btn btn-primary btn-sm"
            disabled={!selectedFile || uploading}
            style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}
          >
            {uploading ? (
              <>
                <Loader2 size={14} className="spin" /> Uploading...
              </>
            ) : (
              <>
                <Upload size={14} /> Upload File
              </>
            )}
          </button>
        </div>
      </form>

      {/* Attachments List */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: '1.5rem 0', color: 'var(--text-muted)' }}>
          <Loader2 size={20} className="spin" style={{ margin: '0 auto 0.5rem' }} />
          <p style={{ fontSize: '0.85rem' }}>Loading attachments...</p>
        </div>
      ) : attachments.length === 0 ? (
        <div
          style={{
            textAlign: 'center',
            padding: '2rem 1rem',
            background: 'rgba(255, 255, 255, 0.015)',
            borderRadius: 'var(--radius-md)',
            color: 'var(--text-muted)',
          }}
        >
          <Paperclip size={28} style={{ opacity: 0.3, marginBottom: '0.5rem' }} />
          <p style={{ fontSize: '0.875rem', fontWeight: 500 }}>No attachments yet</p>
          <p style={{ fontSize: '0.8rem', color: 'var(--text-dim)', marginTop: '0.2rem' }}>
            Upload screenshots, logs, or specification documents to help diagnose this ticket.
          </p>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '0.85rem' }}>
          {attachments.map((att) => {
            const isUploader = user && att.uploadedBy && (user._id === att.uploadedBy._id || user._id === att.uploadedBy);
            const canDeleteAttachment = isUploader || isAdmin;
            const uploaderName = att.uploadedBy?.name || 'User';

            return (
              <div
                key={att._id}
                style={{
                  background: 'rgba(255, 255, 255, 0.025)',
                  border: '1px solid var(--border-color)',
                  borderRadius: 'var(--radius-md)',
                  padding: '0.9rem 1rem',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '0.75rem',
                  transition: 'background 0.2s',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', minWidth: 0 }}>
                  <div
                    style={{
                      width: '36px',
                      height: '36px',
                      borderRadius: 'var(--radius-sm)',
                      background: 'rgba(255, 255, 255, 0.04)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0,
                    }}
                  >
                    {getFileIcon(att.mimeType, att.originalName)}
                  </div>
                  <div style={{ minWidth: 0 }}>
                    <p
                      title={att.originalName}
                      style={{
                        fontSize: '0.85rem',
                        fontWeight: 600,
                        color: 'var(--text-main)',
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                      }}
                    >
                      {att.originalName}
                    </p>
                    <p style={{ fontSize: '0.75rem', color: 'var(--text-dim)', marginTop: '0.15rem' }}>
                      {formatBytes(att.size)} &bull; {uploaderName}
                    </p>
                  </div>
                </div>

                {/* Actions: Download & Delete */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexShrink: 0 }}>
                  <button
                    type="button"
                    onClick={() => handleDownload(att)}
                    disabled={downloadingId === att._id}
                    title="Download file"
                    style={{
                      background: 'rgba(255, 255, 255, 0.05)',
                      border: '1px solid var(--border-color)',
                      color: 'var(--primary)',
                      cursor: 'pointer',
                      padding: '0.35rem 0.5rem',
                      borderRadius: 'var(--radius-sm)',
                      display: 'flex',
                      alignItems: 'center',
                      fontSize: '0.8rem',
                      transition: 'all 0.2s',
                    }}
                  >
                    {downloadingId === att._id ? (
                      <Loader2 size={14} className="spin" />
                    ) : (
                      <Download size={14} />
                    )}
                  </button>

                  {canDeleteAttachment && (
                    <button
                      type="button"
                      onClick={() => handleDelete(att._id)}
                      disabled={deletingId === att._id}
                      title="Delete attachment"
                      style={{
                        background: 'none',
                        border: 'none',
                        color: 'var(--text-dim)',
                        cursor: 'pointer',
                        padding: '0.35rem',
                        borderRadius: 'var(--radius-sm)',
                        display: 'flex',
                        alignItems: 'center',
                        transition: 'color 0.2s',
                      }}
                      onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--danger)')}
                      onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--text-dim)')}
                    >
                      {deletingId === att._id ? (
                        <Loader2 size={14} className="spin" />
                      ) : (
                        <Trash2 size={14} />
                      )}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default AttachmentSection;
