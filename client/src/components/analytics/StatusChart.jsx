import React from 'react';
import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Tooltip,
  Legend,
} from 'recharts';

const STATUS_COLORS = {
  Open: '#3b82f6',
  Assigned: '#a855f7',
  'In Progress': '#06b6d4',
  Resolved: '#10b981',
  Closed: '#64748b',
};

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
          {data.name}: <span style={{ color: data.payload.fill }}>{data.value} tickets</span>
        </p>
      </div>
    );
  }
  return null;
};

const StatusChart = ({ data = [], loading = false }) => {
  const chartData = data.map((d) => ({
    name: d.status,
    value: d.count,
    color: STATUS_COLORS[d.status] || '#6366f1',
  }));

  return (
    <div className="card" style={{ height: '340px', display: 'flex', flexDirection: 'column' }}>
      <h3 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '1rem', color: 'var(--text-main)' }}>
        Status Distribution
      </h3>

      {loading ? (
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)' }}>
          Loading status chart...
        </div>
      ) : chartData.length === 0 ? (
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-dim)' }}>
          No ticket data available
        </div>
      ) : (
        <div style={{ flex: 1, minHeight: 0 }}>
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={chartData}
                cx="50%"
                cy="50%"
                innerRadius={55}
                outerRadius={85}
                paddingAngle={4}
                dataKey="value"
              >
                {chartData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} stroke="none" />
                ))}
              </Pie>
              <Tooltip content={<CustomTooltip />} />
              <Legend
                verticalAlign="bottom"
                iconType="circle"
                wrapperStyle={{ fontSize: '0.8rem', paddingTop: '10px' }}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
};

export default StatusChart;
