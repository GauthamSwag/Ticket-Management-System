import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { createTicket } from '../services/api';
import { useToast } from '../context/ToastContext';
import Alert from '../components/Alert';
import {
  Ticket,
  FileText,
  Tag,
  AlertTriangle,
  ArrowRight,
  ArrowLeft,
  CheckCircle,
} from 'lucide-react';

const CATEGORIES = [
  'Technical Issue',
  'Account Issue',
  'Billing',
  'Software',
  'Hardware',
  'Network',
  'Other',
];

const PRIORITIES = ['Low', 'Medium', 'High', 'Critical'];

const CreateTicket = () => {
  const navigate = useNavigate();
  const { toast } = useToast();

  const [formData, setFormData] = useState({
    title: '',
    description: '',
    category: 'Technical Issue',
    priority: 'Medium',
  });

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');

    if (!formData.title.trim()) {
      setErrorMsg('Please enter a descriptive ticket title.');
      toast.warning('Please enter a descriptive ticket title.');
      return;
    }

    if (formData.title.trim().length > 150) {
      setErrorMsg('Title cannot exceed 150 characters.');
      toast.warning('Title cannot exceed 150 characters.');
      return;
    }

    if (!formData.description.trim()) {
      setErrorMsg('Please provide a detailed description of the incident.');
      toast.warning('Please provide a detailed description of the incident.');
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await createTicket({
        title: formData.title.trim(),
        description: formData.description.trim(),
        category: formData.category,
        priority: formData.priority,
      });

      if (res && res.success) {
        setSuccessMsg(`Ticket created successfully! Assigned ID: ${res.ticket.ticketId}`);
        toast.success(`Ticket created successfully! Assigned ID: ${res.ticket.ticketId}`);
        setTimeout(() => {
          navigate(`/tickets/${res.ticket._id}`);
        }, 1000);
      }
    } catch (err) {
      const msg = err.response?.data?.message || 'Failed to submit ticket. Please try again.';
      setErrorMsg(msg);
      toast.error(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="container" style={{ padding: '2.5rem 1.5rem 5rem', maxWidth: '780px' }}>
      <div style={{ marginBottom: '2rem' }}>
        <Link
          to="/tickets"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.4rem',
            color: 'var(--text-muted)',
            fontSize: '0.85rem',
            marginBottom: '1rem',
          }}
        >
          <ArrowLeft size={14} /> Back to Tickets
        </Link>
        <h1 style={{ fontSize: '1.85rem', marginBottom: '0.35rem' }}>Create Support Ticket</h1>
        <p style={{ color: 'var(--text-muted)' }}>
          Submit a technical or operational incident request. Our support team will triage and resolve it.
        </p>
      </div>

      {errorMsg && <Alert type="error" message={errorMsg} onClose={() => setErrorMsg('')} />}
      {successMsg && <Alert type="success" message={successMsg} />}

      <div className="card">
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label" htmlFor="title">
              Ticket Title *
            </label>
            <div className="input-wrapper">
              <FileText size={18} className="input-icon" />
              <input
                id="title"
                name="title"
                type="text"
                className="form-input has-icon"
                placeholder="Brief summary of the issue (e.g. Cannot connect to database cluster)"
                value={formData.title}
                onChange={handleChange}
                maxLength={150}
                required
              />
            </div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-dim)', marginTop: '0.25rem', textAlign: 'right' }}>
              {formData.title.length}/150 characters
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1.25rem' }}>
            <div className="form-group">
              <label className="form-label" htmlFor="category">
                Incident Category *
              </label>
              <select
                id="category"
                name="category"
                className="form-select"
                value={formData.category}
                onChange={handleChange}
              >
                {CATEGORIES.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="priority">
                Urgency & Priority *
              </label>
              <select
                id="priority"
                name="priority"
                className="form-select"
                value={formData.priority}
                onChange={handleChange}
              >
                {PRIORITIES.map((pri) => (
                  <option key={pri} value={pri}>
                    {pri} Priority
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="description">
              Detailed Description *
            </label>
            <textarea
              id="description"
              name="description"
              rows={6}
              className="form-input"
              placeholder="Describe what occurred, steps to reproduce, expected vs actual behavior, error messages..."
              value={formData.description}
              onChange={handleChange}
              style={{ resize: 'vertical', fontFamily: 'inherit', lineHeight: '1.6' }}
              required
            />
          </div>

          <div style={{ marginTop: '2rem', display: 'flex', justifyContent: 'flex-end', gap: '1rem' }}>
            <Link to="/tickets" className="btn btn-secondary">
              Cancel
            </Link>
            <button type="submit" className="btn btn-primary" disabled={isSubmitting}>
              {isSubmitting ? (
                <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <span className="spinner" /> Submitting Incident...
                </span>
              ) : (
                <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  Submit Ticket <ArrowRight size={16} />
                </span>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default CreateTicket;
