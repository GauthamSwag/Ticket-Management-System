import React from 'react';

/**
 * Standardized CSS Skeleton Loaders for Enterprise Dashboard, Ticket List & Detail Views
 */

export const CardSkeleton = ({ height = '120px' }) => (
  <div className="skeleton-card" style={{ height }}>
    <div className="skeleton skeleton-title" style={{ width: '40%' }} />
    <div className="skeleton skeleton-text" style={{ width: '80%' }} />
    <div className="skeleton skeleton-text" style={{ width: '60%' }} />
  </div>
);

export const TableSkeleton = ({ rows = 6, cols = 5 }) => (
  <div className="ticket-table-container" style={{ padding: '0.5rem' }}>
    <div style={{ display: 'flex', gap: '1rem', padding: '1rem', borderBottom: '1px solid var(--border-color)' }}>
      {Array.from({ length: cols }).map((_, i) => (
        <div key={i} className="skeleton skeleton-text" style={{ width: `${100 / cols}%`, height: '18px', margin: 0 }} />
      ))}
    </div>
    {Array.from({ length: rows }).map((_, r) => (
      <div
        key={r}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '1rem',
          padding: '1.25rem 1rem',
          borderBottom: r < rows - 1 ? '1px solid rgba(255, 255, 255, 0.04)' : 'none',
        }}
      >
        <div className="skeleton skeleton-pill" style={{ width: '80px', height: '24px' }} />
        <div style={{ flex: 2 }}>
          <div className="skeleton skeleton-text" style={{ width: '70%', height: '16px' }} />
          <div className="skeleton skeleton-text" style={{ width: '45%', height: '12px', margin: 0 }} />
        </div>
        <div className="skeleton skeleton-pill" style={{ width: '70px', height: '20px' }} />
        <div className="skeleton skeleton-pill" style={{ width: '60px', height: '20px' }} />
        <div className="skeleton skeleton-text" style={{ width: '100px', height: '14px', margin: 0 }} />
      </div>
    ))}
  </div>
);

export const DashboardSkeleton = () => (
  <div style={{ display: 'flex', flexDirection: 'column', gap: '1.75rem' }}>
    {/* KPI stat cards row */}
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="skeleton-card" style={{ padding: '1.25rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
            <div className="skeleton" style={{ width: '38px', height: '38px', borderRadius: '8px' }} />
            <div className="skeleton skeleton-pill" style={{ width: '50px', height: '20px' }} />
          </div>
          <div className="skeleton" style={{ width: '50px', height: '32px', marginBottom: '0.5rem', borderRadius: '4px' }} />
          <div className="skeleton skeleton-text" style={{ width: '75%', margin: 0 }} />
        </div>
      ))}
    </div>

    {/* Visualizations / Charts row */}
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1.5rem' }}>
      <div className="skeleton-card" style={{ height: '300px', display: 'flex', flexDirection: 'column' }}>
        <div className="skeleton skeleton-title" style={{ width: '40%' }} />
        <div className="skeleton" style={{ flex: 1, borderRadius: '8px', marginTop: '0.5rem' }} />
      </div>
      <div className="skeleton-card" style={{ height: '300px', display: 'flex', flexDirection: 'column' }}>
        <div className="skeleton skeleton-title" style={{ width: '40%' }} />
        <div className="skeleton" style={{ flex: 1, borderRadius: '8px', marginTop: '0.5rem' }} />
      </div>
    </div>

    {/* Recent list skeleton */}
    <div className="skeleton-card" style={{ padding: '1.5rem' }}>
      <div className="skeleton skeleton-title" style={{ width: '30%', marginBottom: '1.25rem' }} />
      <TableSkeleton rows={4} cols={4} />
    </div>
  </div>
);

export const TicketDetailsSkeleton = () => (
  <div className="ticket-details-layout" style={{ marginTop: '1.5rem' }}>
    {/* Main column */}
    <div className="ticket-main-col">
      <div className="skeleton-card" style={{ padding: '2rem' }}>
        <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1.25rem' }}>
          <div className="skeleton skeleton-pill" style={{ width: '90px', height: '28px' }} />
          <div className="skeleton skeleton-pill" style={{ width: '80px', height: '28px' }} />
          <div className="skeleton skeleton-pill" style={{ width: '70px', height: '28px' }} />
        </div>
        <div className="skeleton" style={{ width: '85%', height: '36px', marginBottom: '1.5rem', borderRadius: '6px' }} />
        <div className="skeleton skeleton-text" style={{ width: '100%', height: '16px' }} />
        <div className="skeleton skeleton-text" style={{ width: '95%', height: '16px' }} />
        <div className="skeleton skeleton-text" style={{ width: '70%', height: '16px' }} />
      </div>

      <div className="skeleton-card" style={{ height: '320px' }}>
        <div style={{ display: 'flex', gap: '1rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.75rem', marginBottom: '1rem' }}>
          <div className="skeleton skeleton-pill" style={{ width: '100px', height: '30px' }} />
          <div className="skeleton skeleton-pill" style={{ width: '100px', height: '30px' }} />
          <div className="skeleton skeleton-pill" style={{ width: '100px', height: '30px' }} />
        </div>
        <div className="skeleton" style={{ height: '180px', borderRadius: '8px' }} />
      </div>
    </div>

    {/* Sidebar column */}
    <div className="ticket-sidebar-col">
      <div className="skeleton-card" style={{ height: '150px' }}>
        <div className="skeleton skeleton-title" style={{ width: '60%' }} />
        <div className="skeleton" style={{ width: '100%', height: '42px', borderRadius: '6px' }} />
      </div>
      <div className="skeleton-card" style={{ height: '200px' }}>
        <div className="skeleton skeleton-title" style={{ width: '50%' }} />
        <div className="skeleton skeleton-text" style={{ width: '90%' }} />
        <div className="skeleton skeleton-text" style={{ width: '80%' }} />
        <div className="skeleton skeleton-text" style={{ width: '60%' }} />
      </div>
      <div className="skeleton-card" style={{ height: '160px' }}>
        <div className="skeleton skeleton-title" style={{ width: '70%' }} />
        <div className="skeleton" style={{ width: '100%', height: '38px', borderRadius: '6px' }} />
      </div>
    </div>
  </div>
);

export default {
  CardSkeleton,
  TableSkeleton,
  DashboardSkeleton,
  TicketDetailsSkeleton,
};
