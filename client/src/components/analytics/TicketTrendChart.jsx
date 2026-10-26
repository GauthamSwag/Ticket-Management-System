import React from 'react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from 'recharts';

const CustomTooltip = ({ active, payload, label }) => {
  if (active && payload && payload.length) {
    return (
      <div
        style={{
          background: 'rgba(17, 24, 39, 0.95)',
          border: '1px solid rgba(255, 255, 255, 0.1)',
          borderRadius: 'var(--radius-sm)',
          padding: '0.5rem 0.85rem',
          boxShadow: 'var(--shadow-md)',
        }}
      >
        <p style={{ fontSize: '0.8rem', color: 'var(--text-dim)', marginBottom: '0.2rem' }}>
          Date: {label}
        </p>
        <p style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--primary)' }}>
          {payload[0].value} new tickets
        </p>
      </div>
    );
  }
  return null;
};

const TicketTrendChart = ({ data = [], loading = false }) => {
  return (
    <div className="card" style={{ height: '340px', display: 'flex', flexDirection: 'column' }}>
      <h3 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '1rem', color: 'var(--text-main)' }}>
        Ticket Creation Activity Trend
      </h3>

      {loading ? (
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)' }}>
          Loading trend chart...
        </div>
      ) : data.length === 0 ? (
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-dim)' }}>
          No trend data for selected time range
        </div>
      ) : (
        <div style={{ flex: 1, minHeight: 0 }}>
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data} margin={{ top: 10, right: 15, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="trendGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#6366f1" stopOpacity={0.4} />
                  <stop offset="95%" stopColor="#6366f1" stopOpacity={0.0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255, 255, 255, 0.05)" />
              <XAxis
                dataKey="date"
                stroke="var(--text-dim)"
                fontSize={11}
                tickLine={false}
              />
              <YAxis
                stroke="var(--text-dim)"
                fontSize={11}
                allowDecimals={false}
                tickLine={false}
              />
              <Tooltip content={<CustomTooltip />} />
              <Area
                type="monotone"
                dataKey="count"
                stroke="#6366f1"
                strokeWidth={2}
                fillOpacity={1}
                fill="url(#trendGradient)"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
};

export default TicketTrendChart;
