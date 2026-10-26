import React, { useState, useEffect, useCallback } from 'react';
import { getUsers, updateUserRole, updateUserStatus } from '../services/api';
import { useAuth } from '../context/AuthContext';
import Alert from '../components/Alert';
import {
  Users,
  Search,
  X,
  Shield,
  LifeBuoy,
  User,
  CheckCircle2,
  XCircle,
  ChevronLeft,
  ChevronRight,
  RefreshCw,
  Power,
  SlidersHorizontal,
} from 'lucide-react';

const UserManagement = () => {
  const { user: currentAdmin } = useAuth();

  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [alert, setAlert] = useState({ type: '', message: '' });

  // Filters & Pagination State
  const [searchInput, setSearchInput] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [sortOption, setSortOption] = useState('newest');
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const [pagination, setPagination] = useState({
    totalItems: 0,
    totalPages: 1,
    currentPage: 1,
    hasNextPage: false,
    hasPreviousPage: false,
  });

  // Action in-progress tracking
  const [updatingUserId, setUpdatingUserId] = useState(null);

  // Debounce search input (350ms)
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchInput);
      setPage(1); // Reset to page 1 on new search
    }, 350);
    return () => clearTimeout(timer);
  }, [searchInput]);

  // Fetch users from server
  const fetchUsersList = useCallback(async () => {
    setLoading(true);
    try {
      const params = {
        page,
        limit,
        sort: sortOption,
      };

      if (debouncedSearch.trim()) params.search = debouncedSearch.trim();
      if (roleFilter) params.role = roleFilter;
      if (statusFilter !== '') params.isActive = statusFilter;

      const res = await getUsers(params);
      if (res && res.success) {
        setUsers(res.users || []);
        if (res.pagination) {
          setPagination(res.pagination);
        }
      }
    } catch (err) {
      setAlert({
        type: 'error',
        message: err.response?.data?.message || 'Failed to retrieve user directory.',
      });
    } finally {
      setLoading(false);
    }
  }, [page, limit, debouncedSearch, roleFilter, statusFilter, sortOption]);

  useEffect(() => {
    fetchUsersList();
  }, [fetchUsersList]);

  // Handle Role Change
  const handleRoleChange = async (userId, targetUser, newRole) => {
    if (newRole === targetUser.role) return;

    if (currentAdmin?._id === userId && newRole !== 'admin') {
      setAlert({
        type: 'error',
        message: 'Administrators cannot demote their own account.',
      });
      return;
    }

    setUpdatingUserId(userId);
    setAlert({ type: '', message: '' });
    try {
      const res = await updateUserRole(userId, newRole);
      if (res && res.success) {
        setAlert({
          type: 'success',
          message: `Role for ${targetUser.name} updated to "${newRole}".`,
        });
        // Update user in local state immediately
        setUsers((prev) =>
          prev.map((u) => (u._id === userId ? { ...u, role: newRole } : u))
        );
      }
    } catch (err) {
      setAlert({
        type: 'error',
        message: err.response?.data?.message || 'Failed to update user role.',
      });
    } finally {
      setUpdatingUserId(null);
    }
  };

  // Handle Status Toggle (Active / Inactive)
  const handleStatusToggle = async (userId, targetUser) => {
    const nextStatus = !targetUser.isActive;

    if (currentAdmin?._id === userId && !nextStatus) {
      setAlert({
        type: 'error',
        message: 'Administrators cannot deactivate their own account.',
      });
      return;
    }

    setUpdatingUserId(userId);
    setAlert({ type: '', message: '' });
    try {
      const res = await updateUserStatus(userId, nextStatus);
      if (res && res.success) {
        setAlert({
          type: 'success',
          message: `Account for ${targetUser.name} has been ${nextStatus ? 'activated' : 'deactivated'}.`,
        });
        // Update user in local state immediately
        setUsers((prev) =>
          prev.map((u) => (u._id === userId ? { ...u, isActive: nextStatus } : u))
        );
      }
    } catch (err) {
      setAlert({
        type: 'error',
        message: err.response?.data?.message || 'Failed to toggle account status.',
      });
    } finally {
      setUpdatingUserId(null);
    }
  };

  const handleClearFilters = () => {
    setSearchInput('');
    setDebouncedSearch('');
    setRoleFilter('');
    setStatusFilter('');
    setSortOption('newest');
    setPage(1);
    setLimit(10);
  };

  const getRoleBadge = (role) => {
    switch (role) {
      case 'admin':
        return (
          <span className="badge-role badge-role-admin" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}>
            <Shield size={12} /> Admin
          </span>
        );
      case 'agent':
        return (
          <span className="badge-role badge-role-agent" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}>
            <LifeBuoy size={12} /> Agent
          </span>
        );
      default:
        return (
          <span className="badge-role badge-role-user" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}>
            <User size={12} /> User
          </span>
        );
    }
  };

  return (
    <div className="container" style={{ padding: '2rem 1rem' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1 style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', margin: 0, fontSize: '1.75rem' }}>
            <Users style={{ color: 'var(--primary-color)' }} /> User Management
          </h1>
          <p style={{ color: 'var(--text-muted)', margin: '0.35rem 0 0 0', fontSize: '0.9rem' }}>
            Search, assign roles, and manage access statuses across all platform accounts.
          </p>
        </div>

        <button
          onClick={fetchUsersList}
          className="btn btn-secondary btn-sm"
          style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}
          disabled={loading}
        >
          <RefreshCw size={14} className={loading ? 'spin' : ''} /> Refresh
        </button>
      </div>

      {alert.message && (
        <Alert
          type={alert.type}
          message={alert.message}
          onClose={() => setAlert({ type: '', message: '' })}
        />
      )}

      {/* Filter Control Bar */}
      <div className="card" style={{ padding: '1.25rem', marginBottom: '1.5rem' }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem', alignItems: 'flex-end' }}>
          {/* Search Box */}
          <div style={{ flex: '2 1 260px' }}>
            <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '0.4rem', color: 'var(--text-muted)' }}>
              Search Users
            </label>
            <div style={{ position: 'relative', width: '100%' }}>
              <Search
                size={16}
                style={{ position: 'absolute', left: '0.85rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }}
              />
              <input
                type="text"
                className="form-input"
                placeholder="Search by name, email, department..."
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                style={{ width: '100%', boxSizing: 'border-box', paddingLeft: '2.5rem', paddingRight: searchInput ? '2.5rem' : '0.85rem' }}
              />
              {searchInput && (
                <button
                  type="button"
                  onClick={() => setSearchInput('')}
                  style={{
                    position: 'absolute',
                    right: '0.85rem',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    background: 'none',
                    border: 'none',
                    color: 'var(--text-muted)',
                    cursor: 'pointer',
                  }}
                >
                  <X size={14} />
                </button>
              )}
            </div>
          </div>

          {/* Role Filter */}
          <div style={{ flex: '1 1 150px' }}>
            <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '0.4rem', color: 'var(--text-muted)' }}>
              Filter by Role
            </label>
            <select
              className="form-select"
              value={roleFilter}
              onChange={(e) => {
                setRoleFilter(e.target.value);
                setPage(1);
              }}
            >
              <option value="">All Roles</option>
              <option value="user">User</option>
              <option value="agent">Support Agent</option>
              <option value="admin">Administrator</option>
            </select>
          </div>

          {/* Status Filter */}
          <div style={{ flex: '1 1 150px' }}>
            <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '0.4rem', color: 'var(--text-muted)' }}>
              Account Status
            </label>
            <select
              className="form-select"
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value);
                setPage(1);
              }}
            >
              <option value="">All Statuses</option>
              <option value="true">Active Only</option>
              <option value="false">Deactivated Only</option>
            </select>
          </div>

          {/* Sorting */}
          <div style={{ flex: '1 1 180px' }}>
            <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '0.4rem', color: 'var(--text-muted)' }}>
              Sort Order
            </label>
            <select
              className="form-select"
              value={sortOption}
              onChange={(e) => {
                setSortOption(e.target.value);
                setPage(1);
              }}
            >
              <option value="newest">Recently Registered</option>
              <option value="oldest">Earliest Registered</option>
              <option value="name_asc">Name (A-Z)</option>
              <option value="name_desc">Name (Z-A)</option>
            </select>
          </div>

          {/* Clear Filters */}
          <div style={{ flex: '0 0 auto' }}>
            <button
              onClick={handleClearFilters}
              className="btn btn-secondary"
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem', height: '42px' }}
              title="Reset all filters"
            >
              <SlidersHorizontal size={14} /> Reset
            </button>
          </div>
        </div>
      </div>

      {/* Users Table */}
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <div className="table-container">
          <table className="table" style={{ width: '100%', margin: 0 }}>
            <thead>
              <tr>
                <th style={{ padding: '1rem' }}>User Profile</th>
                <th style={{ padding: '1rem' }}>Department</th>
                <th style={{ padding: '1rem' }}>Role</th>
                <th style={{ padding: '1rem' }}>Account Status</th>
                <th style={{ padding: '1rem' }}>Registered</th>
                <th style={{ padding: '1rem', textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan="6" style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
                    <RefreshCw size={24} className="spin" style={{ margin: '0 auto 0.75rem', display: 'block' }} />
                    Loading user directory...
                  </td>
                </tr>
              ) : users.length === 0 ? (
                <tr>
                  <td colSpan="6" style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
                    <Users size={32} style={{ margin: '0 auto 0.75rem', display: 'block', opacity: 0.5 }} />
                    No users found matching the selected criteria.
                  </td>
                </tr>
              ) : (
                users.map((targetUser) => {
                  const isSelf = currentAdmin?._id === targetUser._id;
                  const isUpdating = updatingUserId === targetUser._id;

                  return (
                    <tr key={targetUser._id} style={{ opacity: targetUser.isActive ? 1 : 0.65 }}>
                      {/* Name & Email */}
                      <td style={{ padding: '1rem' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                          <div
                            style={{
                              width: '36px',
                              height: '36px',
                              borderRadius: '50%',
                              backgroundColor: targetUser.role === 'admin'
                                ? 'rgba(239, 68, 68, 0.2)'
                                : targetUser.role === 'agent'
                                ? 'rgba(59, 130, 246, 0.2)'
                                : 'rgba(100, 116, 139, 0.2)',
                              color: targetUser.role === 'admin'
                                ? '#ef4444'
                                : targetUser.role === 'agent'
                                ? '#3b82f6'
                                : '#94a3b8',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              fontWeight: 700,
                              fontSize: '0.9rem',
                            }}
                          >
                            {targetUser.name?.charAt(0).toUpperCase() || 'U'}
                          </div>
                          <div>
                            <div style={{ fontWeight: 600, color: 'var(--text-color)', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                              {targetUser.name}
                              {isSelf && (
                                <span style={{ fontSize: '0.7rem', padding: '0.1rem 0.4rem', borderRadius: '4px', background: 'rgba(99, 102, 241, 0.2)', color: 'var(--primary-color)' }}>
                                  You
                                </span>
                              )}
                            </div>
                            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                              {targetUser.email}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Department */}
                      <td style={{ padding: '1rem', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                        {targetUser.department || 'General'}
                      </td>

                      {/* Role & Role Dropdown */}
                      <td style={{ padding: '1rem' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          <select
                            className="form-select"
                            style={{
                              padding: '0.35rem 0.65rem',
                              fontSize: '0.825rem',
                              width: 'auto',
                              minWidth: '125px',
                              backgroundColor: 'var(--bg-input)',
                              borderColor: 'var(--border-color)',
                              borderRadius: 'var(--radius-sm)',
                              color: 'var(--text-main)',
                            }}
                            value={targetUser.role}
                            disabled={isUpdating || (isSelf && targetUser.role === 'admin')}
                            onChange={(e) => handleRoleChange(targetUser._id, targetUser, e.target.value)}
                            title={isSelf ? 'Cannot change your own admin role' : 'Change user role'}
                          >
                            <option value="user">User</option>
                            <option value="agent">Support Agent</option>
                            <option value="admin">Admin</option>
                          </select>
                        </div>
                      </td>

                      {/* Status */}
                      <td style={{ padding: '1rem' }}>
                        {targetUser.isActive ? (
                          <span
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '0.3rem',
                              padding: '0.2rem 0.6rem',
                              borderRadius: '999px',
                              fontSize: '0.75rem',
                              fontWeight: 600,
                              backgroundColor: 'rgba(34, 197, 94, 0.15)',
                              color: '#22c55e',
                            }}
                          >
                            <CheckCircle2 size={12} /> Active
                          </span>
                        ) : (
                          <span
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '0.3rem',
                              padding: '0.2rem 0.6rem',
                              borderRadius: '999px',
                              fontSize: '0.75rem',
                              fontWeight: 600,
                              backgroundColor: 'rgba(239, 68, 68, 0.15)',
                              color: '#ef4444',
                            }}
                          >
                            <XCircle size={12} /> Deactivated
                          </span>
                        )}
                      </td>

                      {/* Created At */}
                      <td style={{ padding: '1rem', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                        {new Date(targetUser.createdAt).toLocaleDateString(undefined, {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric',
                        })}
                      </td>

                      {/* Actions: Toggle Status Button */}
                      <td style={{ padding: '1rem', textAlign: 'right' }}>
                        <button
                          onClick={() => handleStatusToggle(targetUser._id, targetUser)}
                          disabled={isUpdating || isSelf}
                          className={`btn btn-sm ${targetUser.isActive ? 'btn-danger-outline' : 'btn-success-outline'}`}
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '0.35rem',
                            fontSize: '0.75rem',
                            padding: '0.3rem 0.6rem',
                            borderRadius: '4px',
                            cursor: isSelf ? 'not-allowed' : 'pointer',
                            opacity: isSelf ? 0.4 : 1,
                          }}
                          title={isSelf ? 'Cannot deactivate your own account' : targetUser.isActive ? 'Deactivate account' : 'Activate account'}
                        >
                          <Power size={12} />
                          {targetUser.isActive ? 'Deactivate' : 'Activate'}
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Footer */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: '1rem 1.5rem',
            borderTop: '1px solid var(--border-color)',
            flexWrap: 'wrap',
            gap: '1rem',
            background: 'rgba(15, 23, 42, 0.4)',
          }}
        >
          <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
            Showing{' '}
            {pagination.totalItems > 0 ? (page - 1) * limit + 1 : 0}–
            {Math.min(page * limit, pagination.totalItems)} of {pagination.totalItems} users
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
              Page {pagination.currentPage} of {pagination.totalPages}
            </span>

            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button
                className="btn btn-secondary btn-sm"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={!pagination.hasPreviousPage || loading}
                style={{ display: 'flex', alignItems: 'center', gap: '0.2rem' }}
              >
                <ChevronLeft size={14} /> Prev
              </button>
              <button
                className="btn btn-secondary btn-sm"
                onClick={() => setPage((p) => p + 1)}
                disabled={!pagination.hasNextPage || loading}
                style={{ display: 'flex', alignItems: 'center', gap: '0.2rem' }}
              >
                Next <ChevronRight size={14} />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default UserManagement;
