import React from 'react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
} from 'recharts';

const CustomTooltip = ({ active, payload }) => {
  if (active && payload && payload.length) {
    const data = payload[0];
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
        <p style={{ fontSize: '0.85rem', fontWeight: 600, color: '#f3f4f6' }}>
          {data.payload.category}: <span style={{ color: 'var(--primary)' }}>{data.value} tickets</span>
        </p>
      </div>
    );
  }
  return null;
};

const CategoryChart = ({ data = [], loading = false }) => {
  return (
    <div className="card" style={{ height: '340px', display: 'flex', flexDirection: 'column' }}>
      <h3 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '1rem', color: 'var(--text-main)' }}>
        Category Distribution
      </h3>

      {loading ? (
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)' }}>
          Loading category chart...
        </div>
      ) : data.length === 0 ? (
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-dim)' }}>
          No category data available
        </div>
      ) : (
        <div style={{ flex: 1, minHeight: 0 }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={data}
              layout="vertical"
              margin={{ top: 5, right: 20, left: 30, bottom: 5 }}
            >
              <XAxis type="number" stroke="var(--text-dim)" fontSize={12} allowDecimals={false} tickLine={false} />
              <YAxis
                type="category"
                dataKey="category"
                stroke="var(--text-dim)"
                fontSize={11}
                tickLine={false}
                width={95}
              />
              <Tooltip content={<CustomTooltip />} />
              <Bar dataKey="count" fill="#818cf8" radius={[0, 6, 6, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
};

export default CategoryChart;
