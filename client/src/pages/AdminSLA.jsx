import React, { useState, useEffect } from 'react';
import { getSLAs, updateSLA } from '../services/api';
import Alert from '../components/Alert';
import { Timer, Edit2, Check, X, Shield, Clock, AlertTriangle, ArrowLeft } from 'lucide-react';
import { Link } from 'react-router-dom';

const AdminSLA = () => {
  const [slas, setSlas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [alert, setAlert] = useState({ type: '', message: '' });

  // Edit state
  const [editingPriority, setEditingPriority] = useState(null);
  const [editForm, setEditForm] = useState({
    responseTimeHours: '',
    resolutionTimeHours: '',
  });
  const [saving, setSaving] = useState(false);

  const fetchSLAs = async () => {
    setLoading(true);
    try {
      const res = await getSLAs();
      if (res && res.success) {
        setSlas(res.slas);
      }
    } catch (err) {
      setAlert({
        type: 'error',
        message: err.response?.data?.message || 'Failed to retrieve SLA configurations.',
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSLAs();
  }, []);

  const startEdit = (sla) => {
    setEditingPriority(sla.priority);
    setEditForm({
      responseTimeHours: sla.responseTimeHours,
      resolutionTimeHours: sla.resolutionTimeHours,
    });
    setAlert({ type: '', message: '' });
  };

  const cancelEdit = () => {
    setEditingPriority(null);
    setEditForm({ responseTimeHours: '', resolutionTimeHours: '' });
  };

  const handleSave = async (priority) => {
    const respHours = parseFloat(editForm.responseTimeHours);
    const resolHours = parseFloat(editForm.resolutionTimeHours);

    if (isNaN(respHours) || respHours <= 0) {
      setAlert({ type: 'error', message: 'Response target must be a positive number of hours.' });
      return;
    }
    if (isNaN(resolHours) || resolHours <= 0) {
      setAlert({ type: 'error', message: 'Resolution target must be a positive number of hours.' });
      return;
    }

    setSaving(true);
    setAlert({ type: '', message: '' });
    try {
      const res = await updateSLA(priority, {
        responseTimeHours: respHours,
        resolutionTimeHours: resolHours,
      });

      if (res && res.success) {
        setAlert({ type: 'success', message: `SLA targets for '${priority}' priority updated successfully!` });
        setEditingPriority(null);
        fetchSLAs();
      }
    } catch (err) {
      setAlert({
        type: 'error',
        message: err.response?.data?.message || 'Failed to update SLA configuration.',
      });
    } finally {
      setSaving(false);
    }
  };

  const getPriorityColor = (prio) => {
    switch (prio) {
      case 'Critical': return '#ef4444';
      case 'High': return '#f59e0b';
      case 'Medium': return '#38bdf8';
      case 'Low': return '#10b981';
      default: return '#94a3b8';
    }
  };

  return (
    <div className="container" style={{ padding: '2.5rem 1.5rem 5rem', maxWidth: '880px' }}>
      {/* Header */}
      <div style={{ marginBottom: '2rem' }}>
        <Link
          to="/analytics"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.4rem',
            color: 'var(--text-muted)',
            fontSize: '0.875rem',
            marginBottom: '1rem',
          }}
        >
          <ArrowLeft size={14} /> Back to Analytics
        </Link>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.5rem' }}>
          <div style={{ background: 'rgba(99, 102, 241, 0.15)', color: '#6366f1', padding: '0.6rem', borderRadius: '10px' }}>
            <Timer size={24} />
          </div>
          <div>
            <h1 style={{ fontSize: '1.75rem', margin: 0 }}>Service Level Agreement (SLA) Management</h1>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', margin: '0.25rem 0 0' }}>
              Configure response and resolution thresholds per priority tier. Background monitor enforces these targets every minute.
            </p>
          </div>
        </div>
      </div>

      {alert.message && (
        <Alert
          type={alert.type}
          message={alert.message}
          onClose={() => setAlert({ type: '', message: '' })}
        />
      )}

      {/* SLA Cards Grid */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: '4rem 1rem' }}>
          <div className="spinner" style={{ margin: '0 auto 1rem', width: '36px', height: '36px' }} />
          <p style={{ color: 'var(--text-muted)' }}>Loading SLA policies...</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {slas.map((sla) => {
            const isEditingThis = editingPriority === sla.priority;
            const prioColor = getPriorityColor(sla.priority);

            return (
              <div
                key={sla._id || sla.priority}
                className="card"
                style={{
                  borderLeft: `5px solid ${prioColor}`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  flexWrap: 'wrap',
                  gap: '1.25rem',
                  padding: '1.25rem 1.5rem',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem', minWidth: '180px' }}>
                  <div
                    style={{
                      background: `rgba(${sla.priority === 'Critical' ? '239, 68, 68' : sla.priority === 'High' ? '245, 158, 11' : sla.priority === 'Medium' ? '56, 189, 248' : '16, 185, 129'}, 0.15)`,
                      color: prioColor,
                      padding: '0.4rem 0.8rem',
                      borderRadius: 'var(--radius-sm)',
                      fontWeight: 700,
                      fontSize: '0.9rem',
                    }}
                  >
                    {sla.priority}
                  </div>
                  <div>
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-dim)' }}>SLA TIER</div>
                    <div style={{ fontWeight: 600, fontSize: '0.95rem' }}>{sla.priority} Priority Policy</div>
                  </div>
                </div>

                {isEditingThis ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
                    <div>
                      <label style={{ fontSize: '0.75rem', color: 'var(--text-dim)', display: 'block' }}>
                        Response (Hours)
                      </label>
                      <input
                        type="number"
                        step="0.5"
                        min="0.1"
                        className="form-input"
                        value={editForm.responseTimeHours}
                        onChange={(e) => setEditForm({ ...editForm, responseTimeHours: e.target.value })}
                        style={{ width: '110px', padding: '0.4rem 0.6rem', fontSize: '0.85rem' }}
                      />
                    </div>
                    <div>
                      <label style={{ fontSize: '0.75rem', color: 'var(--text-dim)', display: 'block' }}>
                        Resolution (Hours)
                      </label>
                      <input
                        type="number"
                        step="0.5"
                        min="0.1"
                        className="form-input"
                        value={editForm.resolutionTimeHours}
                        onChange={(e) => setEditForm({ ...editForm, resolutionTimeHours: e.target.value })}
                        style={{ width: '110px', padding: '0.4rem 0.6rem', fontSize: '0.85rem' }}
                      />
                    </div>
                    <div style={{ display: 'flex', gap: '0.4rem', marginTop: '1rem' }}>
                      <button
                        className="btn btn-primary btn-sm"
                        onClick={() => handleSave(sla.priority)}
                        disabled={saving}
                        style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}
                      >
                        <Check size={14} /> Save
                      </button>
                      <button
                        className="btn btn-secondary btn-sm"
                        onClick={cancelEdit}
                        disabled={saving}
                      >
                        <X size={14} />
                      </button>
                    </div>
                  </div>
                ) : (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '2.5rem', flexWrap: 'wrap' }}>
                    <div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-dim)' }}>RESPONSE TARGET</div>
                      <div style={{ fontWeight: 600, fontSize: '0.95rem', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                        <Clock size={14} color="#38bdf8" />
                        {sla.responseTimeHours} {sla.responseTimeHours === 1 ? 'Hour' : 'Hours'}
                      </div>
                    </div>

                    <div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-dim)' }}>RESOLUTION TARGET</div>
                      <div style={{ fontWeight: 600, fontSize: '0.95rem', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                        <Timer size={14} color="#f59e0b" />
                        {sla.resolutionTimeHours} {sla.resolutionTimeHours === 1 ? 'Hour' : 'Hours'}
                      </div>
                    </div>

                    <div>
                      <button
                        className="btn btn-secondary btn-sm"
                        onClick={() => startEdit(sla)}
                        style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}
                      >
                        <Edit2 size={13} /> Edit Targets
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Technical SLA Information Box */}
      <div
        style={{
          marginTop: '2.5rem',
          padding: '1.25rem 1.5rem',
          background: 'rgba(255, 255, 255, 0.02)',
          borderRadius: 'var(--radius-md)',
          border: '1px solid var(--border-color)',
        }}
      >
        <h3 style={{ fontSize: '1rem', color: '#a5b4fc', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
          <Shield size={16} /> SLA Automation Architecture
        </h3>
        <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', lineHeight: '1.6', margin: 0 }}>
          SLA deadlines are atomically calculated at ticket creation time based on priority tier. The backend SLA daemon continuously evaluates active tickets. Breaches automatically transition ticket compliance status, log immutable audit history entries, dispatch persistent notifications, and send email alerts according to user notification preferences.
        </p>
      </div>
    </div>
  );
};

export default AdminSLA;
