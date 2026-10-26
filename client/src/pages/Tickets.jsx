import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useSocket } from '../context/SocketContext';
import { getTickets } from '../services/api';
import TicketTable from '../components/TicketTable';
import Alert from '../components/Alert';
import { TableSkeleton } from '../components/SkeletonLoader';
import EmptyState from '../components/EmptyState';
import {
  Ticket,
  Plus,
  RefreshCw,
  Search,
  Filter,
  RotateCcw,
  Inbox,
  ChevronLeft,
  ChevronRight,
  ArrowUpDown,
  X,
  SlidersHorizontal,
} from 'lucide-react';

const STATUS_OPTIONS = ['All', 'Open', 'Assigned', 'In Progress', 'Resolved', 'Closed'];
const PRIORITY_OPTIONS = ['All', 'Critical', 'High', 'Medium', 'Low'];
const CATEGORY_OPTIONS = [
  'All',
  'Technical Issue',
  'Account Issue',
  'Billing',
  'Software',
  'Hardware',
  'Network',
  'Other',
];

const SORT_OPTIONS = [
  { label: 'Newest First', value: 'newest' },
  { label: 'Oldest First', value: 'oldest' },
  { label: 'Priority: High to Low', value: 'priority_desc' },
  { label: 'Priority: Low to High', value: 'priority_asc' },
  { label: 'Recently Updated', value: 'recently_updated' },
];

const Tickets = () => {
  const { user, isAdmin, isAgent } = useAuth();
  const { socket } = useSocket();

  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');

  // Search & Filter State
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [priorityFilter, setPriorityFilter] = useState('All');
  const [categoryFilter, setCategoryFilter] = useState('All');
  const [sortOption, setSortOption] = useState('newest');
  const [slaFilter, setSlaFilter] = useState('All');

  // Pagination State
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const [pagination, setPagination] = useState({
    page: 1,
    currentPage: 1,
    limit: 10,
    totalItems: 0,
    totalPages: 1,
    hasNextPage: false,
    hasPreviousPage: false,
  });

  // Debounce search input by 350ms to prevent API spam
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearch(searchTerm);
      setPage(1); // Reset to page 1 on new search keyword
    }, 350);

    return () => clearTimeout(handler);
  }, [searchTerm]);

  // Server-side query fetcher
  const fetchTickets = useCallback(async () => {
    setLoading(true);
    setErrorMsg('');
    try {
      const params = {
        page,
        limit,
        sort: sortOption,
      };

      if (debouncedSearch.trim()) params.search = debouncedSearch.trim();
      if (statusFilter !== 'All') params.status = statusFilter;
      if (priorityFilter !== 'All') params.priority = priorityFilter;
      if (categoryFilter !== 'All') params.category = categoryFilter;
      if (slaFilter !== 'All') params.slaStatus = slaFilter;

      const res = await getTickets(params);
      if (res && res.success) {
        setTickets(res.tickets || []);
        if (res.pagination) {
          setPagination(res.pagination);
        }
      }
    } catch (err) {
      console.error('Failed to load tickets from server:', err);
      setErrorMsg(err.response?.data?.message || err.message || 'Failed to load tickets from server.');
    } finally {
      setLoading(false);
    }
  }, [page, limit, debouncedSearch, statusFilter, priorityFilter, categoryFilter, slaFilter, sortOption]);

  // Fetch when any filter, search, sort, or page changes
  useEffect(() => {
    fetchTickets();
  }, [fetchTickets]);

  // Real-time synchronization via Socket.IO
  useEffect(() => {
    if (!socket) return;

    const handleTicketLiveChange = () => {
      fetchTickets();
    };

    socket.on('ticket:created', handleTicketLiveChange);
    socket.on('ticket:statusChanged', handleTicketLiveChange);
    socket.on('ticket:assigned', handleTicketLiveChange);
    socket.on('ticket:priorityChanged', handleTicketLiveChange);
    socket.on('ticket:updated', handleTicketLiveChange);
    socket.on('ticket:deleted', handleTicketLiveChange);
    socket.on('sla:warning', handleTicketLiveChange);
    socket.on('sla:breached', handleTicketLiveChange);

    return () => {
      socket.off('ticket:created', handleTicketLiveChange);
      socket.off('ticket:statusChanged', handleTicketLiveChange);
      socket.off('ticket:assigned', handleTicketLiveChange);
      socket.off('ticket:priorityChanged', handleTicketLiveChange);
      socket.off('ticket:updated', handleTicketLiveChange);
      socket.off('ticket:deleted', handleTicketLiveChange);
      socket.off('sla:warning', handleTicketLiveChange);
      socket.off('sla:breached', handleTicketLiveChange);
    };
  }, [socket, fetchTickets]);

  const handleClearFilters = () => {
    setSearchTerm('');
    setDebouncedSearch('');
    setStatusFilter('All');
    setPriorityFilter('All');
    setCategoryFilter('All');
    setSortOption('newest');
    setSlaFilter('All');
    setPage(1);
  };

  const isFiltered =
    searchTerm.trim() !== '' ||
    statusFilter !== 'All' ||
    priorityFilter !== 'All' ||
    categoryFilter !== 'All' ||
    slaFilter !== 'All' ||
    sortOption !== 'newest';

  const getPageTitle = () => {
    if (isAdmin) return 'All Support Tickets (System Registry)';
    if (isAgent) return 'Assigned Ticket Queue';
    return 'My Support Requests';
  };

  const getPageSubtitle = () => {
    if (isAdmin) return 'Server-side queried view of all platform tickets with active filters & sorting.';
    if (isAgent) return 'Manage and resolve tickets assigned to your operational support queue.';
    return 'Track real-time progress and resolutions for tickets submitted by you.';
  };

  const startRecord = pagination.totalItems === 0 ? 0 : (pagination.page - 1) * pagination.limit + 1;
  const endRecord = Math.min(pagination.page * pagination.limit, pagination.totalItems);

  return (
    <div className="container" style={{ padding: '2.5rem 1.5rem 5rem' }}>
      {/* Page Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '1.25rem',
          marginBottom: '1.75rem',
        }}
      >
        <div>
          <h1 style={{ fontSize: '1.85rem', fontWeight: 800, marginBottom: '0.35rem' }}>{getPageTitle()}</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.925rem' }}>{getPageSubtitle()}</p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <button
            onClick={fetchTickets}
            className="btn btn-secondary btn-sm"
            title="Refresh tickets"
            disabled={loading}
            style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}
          >
            <RefreshCw size={14} className={loading ? 'spinning' : ''} />
            <span>Refresh</span>
          </button>

          <Link
            to="/tickets/create"
            className="btn btn-primary"
            style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}
          >
            <Plus size={16} />
            <span>New Ticket</span>
          </Link>
        </div>
      </div>

      {errorMsg && <Alert type="error" message={errorMsg} onClose={() => setErrorMsg('')} />}

      {/* ========================================================================= */}
      {/* FILTER CONTROL BAR                                                        */}
      {/* ========================================================================= */}
      <div
        className="card"
        style={{
          padding: '1.25rem',
          marginBottom: '1.5rem',
          display: 'flex',
          flexDirection: 'column',
          gap: '1rem',
        }}
      >
        {/* Main Controls Row */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
            gap: '0.75rem',
            alignItems: 'center',
          }}
        >
          {/* Search Input */}
          <div style={{ position: 'relative', gridColumn: 'span 2', minWidth: '220px' }}>
            <Search
              size={16}
              style={{
                position: 'absolute',
                left: '12px',
                top: '50%',
                transform: 'translateY(-50%)',
                color: 'var(--text-dim)',
                pointerEvents: 'none',
              }}
            />
            <input
              type="text"
              className="form-input"
              placeholder="Search by ID, title, or description..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              style={{ paddingLeft: '2.4rem', paddingRight: searchTerm ? '2rem' : '0.75rem', fontSize: '0.875rem' }}
            />
            {searchTerm && (
              <button
                type="button"
                onClick={() => setSearchTerm('')}
                style={{
                  position: 'absolute',
                  right: '10px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  background: 'transparent',
                  border: 'none',
                  color: 'var(--text-dim)',
                  cursor: 'pointer',
                  display: 'flex',
                }}
                title="Clear search"
              >
                <X size={14} />
              </button>
            )}
          </div>

          {/* Status Dropdown */}
          <div>
            <select
              className="form-select"
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value);
                setPage(1);
              }}
              style={{ fontSize: '0.85rem' }}
            >
              <option value="All">All Statuses</option>
              {STATUS_OPTIONS.filter((s) => s !== 'All').map((st) => (
                <option key={st} value={st}>
                  {st}
                </option>
              ))}
            </select>
          </div>

          {/* Priority Dropdown */}
          <div>
            <select
              className="form-select"
              value={priorityFilter}
              onChange={(e) => {
                setPriorityFilter(e.target.value);
                setPage(1);
              }}
              style={{ fontSize: '0.85rem' }}
            >
              <option value="All">All Priorities</option>
              {PRIORITY_OPTIONS.filter((p) => p !== 'All').map((pr) => (
                <option key={pr} value={pr}>
                  {pr} Priority
                </option>
              ))}
            </select>
          </div>

          {/* Category Dropdown */}
          <div>
            <select
              className="form-select"
              value={categoryFilter}
              onChange={(e) => {
                setCategoryFilter(e.target.value);
                setPage(1);
              }}
              style={{ fontSize: '0.85rem' }}
            >
              <option value="All">All Categories</option>
              {CATEGORY_OPTIONS.filter((c) => c !== 'All').map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </select>
          </div>

          {/* Sort Dropdown */}
          <div>
            <select
              className="form-select"
              value={sortOption}
              onChange={(e) => {
                setSortOption(e.target.value);
                setPage(1);
              }}
              style={{ fontSize: '0.85rem' }}
            >
              {SORT_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  Sort: {opt.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Sub-row: SLA Filter, Per-page selection & Clear Filters Action */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '0.75rem',
            paddingTop: '0.5rem',
            borderTop: '1px solid var(--border-color)',
            fontSize: '0.825rem',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
            {/* SLA Filter */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <span style={{ color: 'var(--text-dim)', fontWeight: 600 }}>SLA Status:</span>
              <select
                className="form-select"
                value={slaFilter}
                onChange={(e) => {
                  setSlaFilter(e.target.value);
                  setPage(1);
                }}
                style={{ fontSize: '0.8rem', padding: '0.25rem 0.5rem', width: 'auto' }}
              >
                <option value="All">All SLAs</option>
                <option value="within_sla">Within SLA</option>
                <option value="approaching">Approaching Deadline</option>
                <option value="response_breached">Response Breached</option>
                <option value="resolution_breached">Resolution Breached</option>
              </select>
            </div>

            {/* Limit selection */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <span style={{ color: 'var(--text-dim)', fontWeight: 600 }}>Show:</span>
              <select
                className="form-select"
                value={limit}
                onChange={(e) => {
                  setLimit(Number(e.target.value));
                  setPage(1);
                }}
                style={{ fontSize: '0.8rem', padding: '0.25rem 0.5rem', width: 'auto' }}
              >
                <option value="10">10 per page</option>
                <option value="25">25 per page</option>
                <option value="50">50 per page</option>
              </select>
            </div>
          </div>

          {/* Clear Filters Button */}
          {isFiltered && (
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={handleClearFilters}
              style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', color: '#f87171' }}
            >
              <RotateCcw size={13} />
              <span>Clear Filters</span>
            </button>
          )}
        </div>
      </div>

      {/* ========================================================================= */}
      {/* TICKET LIST TABLE & RESULTS                                               */}
      {/* ========================================================================= */}
      {loading ? (
        <TableSkeleton rows={8} cols={6} />
      ) : tickets.length > 0 ? (
        <>
          {/* Table Header Summary */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: '0.75rem',
              fontSize: '0.85rem',
              color: 'var(--text-dim)',
            }}
          >
            <span>
              Showing <strong>{startRecord}</strong>–<strong>{endRecord}</strong> of{' '}
              <strong>{pagination.totalItems}</strong> tickets
            </span>
            <span style={{ fontSize: '0.8rem' }}>Page {pagination.currentPage || pagination.page} of {pagination.totalPages}</span>
          </div>

          <TicketTable tickets={tickets} />

          {/* ========================================================================= */}
          {/* PAGINATION FOOTER                                                         */}
          {/* ========================================================================= */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: '1rem',
              marginTop: '1.75rem',
              padding: '1rem',
              background: 'var(--bg-card)',
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--border-color)',
            }}
          >
            <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
              Showing {startRecord}–{endRecord} of {pagination.totalItems} total tickets
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={!pagination.hasPreviousPage || loading}
                style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}
              >
                <ChevronLeft size={16} /> Previous
              </button>

              <span
                style={{
                  fontSize: '0.85rem',
                  fontWeight: 600,
                  color: 'var(--text-main)',
                  padding: '0 0.5rem',
                }}
              >
                Page {pagination.currentPage || pagination.page} of {pagination.totalPages}
              </span>

              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => setPage((p) => Math.min(pagination.totalPages, p + 1))}
                disabled={!pagination.hasNextPage || loading}
                style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}
              >
                Next <ChevronRight size={16} />
              </button>
            </div>
          </div>
        </>
      ) : (
        /* Empty State */
        <EmptyState
          icon={<Inbox size={32} />}
          title={isFiltered ? 'No tickets match query criteria' : 'No tickets in this queue'}
          description={
            isFiltered
              ? 'Try modifying your search keywords, priority levels, status filters, or clear all filters to see tickets.'
              : 'There are currently no tickets logged in this queue. Create your first support ticket to get started!'
          }
          actionText={isFiltered ? 'Clear All Filters' : 'Create First Ticket'}
          actionLink={!isFiltered ? '/tickets/create' : undefined}
          onAction={isFiltered ? handleClearFilters : undefined}
        />
      )}
    </div>
  );
};

export default Tickets;
