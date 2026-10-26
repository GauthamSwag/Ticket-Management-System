import axios from 'axios';

const api = axios.create({
  baseURL: '/api',
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request Interceptor: Attach JWT token if present
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('ticket_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response Interceptor: Handle global errors like 401 Unauthorized
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response && error.response.status === 401) {
      // If token expired or invalid, clear stored auth data
      if (localStorage.getItem('ticket_token')) {
        localStorage.removeItem('ticket_token');
        localStorage.removeItem('ticket_user');
        // If not already on login page, redirect
        if (!window.location.pathname.includes('/login')) {
          window.location.href = '/login?session=expired';
        }
      }
    }
    return Promise.reject(error);
  }
);

export default api;

// Ticket API service functions
export const createTicket = async (ticketData) => {
  const res = await api.post('/tickets', ticketData);
  return res.data;
};

export const getTickets = async (params = {}) => {
  const res = await api.get('/tickets', { params });
  return res.data;
};

export const getTicket = async (id) => {
  const res = await api.get(`/tickets/${id}`);
  return res.data;
};

export const updateTicket = async (id, ticketData) => {
  const res = await api.put(`/tickets/${id}`, ticketData);
  return res.data;
};

export const deleteTicket = async (id) => {
  const res = await api.delete(`/tickets/${id}`);
  return res.data;
};

export const assignTicket = async (id, agentId) => {
  const res = await api.put(`/tickets/${id}/assign`, { agentId });
  return res.data;
};

export const updateTicketStatus = async (id, status) => {
  const res = await api.put(`/tickets/${id}/status`, { status });
  return res.data;
};

export const updateTicketPriority = async (id, priority) => {
  const res = await api.put(`/tickets/${id}/priority`, { priority });
  return res.data;
};

export const getAgents = async () => {
  const res = await api.get('/auth/users', { params: { role: 'agent', isActive: 'true' } });
  return res.data;
};

// =========================================================================
// Phase 3: Comments, Attachments & Audit History API Functions
// =========================================================================

// Comments
export const createComment = async (ticketId, message) => {
  const res = await api.post(`/tickets/${ticketId}/comments`, { message });
  return res.data;
};

export const getComments = async (ticketId) => {
  const res = await api.get(`/tickets/${ticketId}/comments`);
  return res.data;
};

export const deleteComment = async (ticketId, commentId) => {
  const res = await api.delete(`/tickets/${ticketId}/comments/${commentId}`);
  return res.data;
};

// Audit History
export const getTicketHistory = async (ticketId) => {
  const res = await api.get(`/tickets/${ticketId}/history`);
  return res.data;
};

// Attachments
export const uploadAttachment = async (ticketId, file) => {
  const formData = new FormData();
  formData.append('file', file);
  const res = await api.post(`/tickets/${ticketId}/attachments`, formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
  });
  return res.data;
};

export const getAttachments = async (ticketId) => {
  const res = await api.get(`/tickets/${ticketId}/attachments`);
  return res.data;
};

export const downloadAttachment = async (ticketId, attachmentId, originalName) => {
  const res = await api.get(`/tickets/${ticketId}/attachments/${attachmentId}`, {
    responseType: 'blob',
  });
  // Trigger browser download
  const blobUrl = window.URL.createObjectURL(new Blob([res.data]));
  const link = document.createElement('a');
  link.href = blobUrl;
  link.setAttribute('download', originalName || 'attachment');
  document.body.appendChild(link);
  link.click();
  link.parentNode.removeChild(link);
  window.URL.revokeObjectURL(blobUrl);
};

export const deleteAttachment = async (ticketId, attachmentId) => {
  const res = await api.delete(`/tickets/${ticketId}/attachments/${attachmentId}`);
  return res.data;
};

// =========================================================================
// Phase 4: Notifications & Analytics API Functions
// =========================================================================

// Notifications
export const getNotifications = async (params = {}) => {
  const res = await api.get('/notifications', { params });
  return res.data;
};

export const getUnreadNotificationCount = async () => {
  const res = await api.get('/notifications/unread-count');
  return res.data;
};

export const markNotificationAsRead = async (id) => {
  const res = await api.put(`/notifications/${id}/read`);
  return res.data;
};

export const markAllNotificationsAsRead = async () => {
  const res = await api.put('/notifications/read-all');
  return res.data;
};

export const deleteNotification = async (id) => {
  const res = await api.delete(`/notifications/${id}`);
  return res.data;
};

// Analytics (Admin Only)
export const getAnalyticsOverview = async () => {
  const res = await api.get('/analytics/overview');
  return res.data;
};

export const getAnalyticsStatus = async () => {
  const res = await api.get('/analytics/status');
  return res.data;
};

export const getAnalyticsPriority = async () => {
  const res = await api.get('/analytics/priority');
  return res.data;
};

export const getAnalyticsCategory = async () => {
  const res = await api.get('/analytics/category');
  return res.data;
};

export const getAnalyticsAgents = async () => {
  const res = await api.get('/analytics/agents');
  return res.data;
};

export const getAnalyticsTrends = async (params = {}) => {
  const res = await api.get('/analytics/trends', { params });
  return res.data;
};

// =========================================================================
// Phase 5: SLA Management, AI Classification & SLA Analytics
// =========================================================================

// SLA Configuration
export const getSLAs = async () => {
  const res = await api.get('/sla');
  return res.data;
};

export const updateSLA = async (priority, data) => {
  const res = await api.put(`/sla/${priority}`, data);
  return res.data;
};

// AI Classification
export const classifyTicket = async (id) => {
  const res = await api.post(`/tickets/${id}/classify`);
  return res.data;
};

// SLA Analytics (Admin Only)
export const getSLAOverview = async () => {
  const res = await api.get('/analytics/sla/overview');
  return res.data;
};

export const getSLAPriority = async () => {
  const res = await api.get('/analytics/sla/priority');
  return res.data;
};

export const getSLAAgents = async () => {
  const res = await api.get('/analytics/sla/agents');
  return res.data;
};

export const getSLATrends = async (params = {}) => {
  const res = await api.get('/analytics/sla/trends', { params });
  return res.data;
};

// User Profile & Preferences
export const updateProfile = async (profileData) => {
  const res = await api.put('/auth/profile', profileData);
  return res.data;
};

// =========================================================================
// Phase 6: Role-Specific Dashboard
// =========================================================================
export const getDashboardData = async () => {
  const res = await api.get('/analytics/dashboard');
  return res.data;
};

// =========================================================================
// Phase 8: Admin User & Agent Management API Functions
// =========================================================================
export const getUsers = async (params = {}) => {
  const res = await api.get('/auth/users', { params });
  return res.data;
};

export const updateUserRole = async (userId, role) => {
  const res = await api.put(`/auth/users/${userId}/role`, { role });
  return res.data;
};

export const updateUserStatus = async (userId, isActive) => {
  const res = await api.put(`/auth/users/${userId}/status`, { isActive });
  return res.data;
};



