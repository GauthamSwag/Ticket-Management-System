import React from 'react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Cell,
} from 'recharts';

const PRIORITY_COLORS = {
  Low: '#10b981',
  Medium: '#06b6d4',
  High: '#f59e0b',
  Critical: '#ef4444',
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
          {data.payload.priority}: <span style={{ color: data.payload.color }}>{data.value} tickets</span>
        </p>
      </div>
    );
  }
  return null;
};

const PriorityChart = ({ data = [], loading = false }) => {
  // Ensure all 4 priorities are shown in order
  const order = ['Low', 'Medium', 'High', 'Critical'];
  const dataMap = {};
  data.forEach((d) => (dataMap[d.priority] = d.count));

  const chartData = order.map((p) => ({
    priority: p,
    count: dataMap[p] || 0,
    color: PRIORITY_COLORS[p],
  }));

  return (
    <div className="card" style={{ height: '340px', display: 'flex', flexDirection: 'column' }}>
      <h3 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '1rem', color: 'var(--text-main)' }}>
        Priority Breakdown
      </h3>

      {loading ? (
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)' }}>
          Loading priority chart...
        </div>
      ) : (
        <div style={{ flex: 1, minHeight: 0 }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 5 }}>
              <XAxis
                dataKey="priority"
                stroke="var(--text-dim)"
                fontSize={12}
                tickLine={false}
              />
              <YAxis
                stroke="var(--text-dim)"
                fontSize={12}
                allowDecimals={false}
                tickLine={false}
              />
              <Tooltip content={<CustomTooltip />} />
              <Bar dataKey="count" radius={[6, 6, 0, 0]}>
                {chartData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
};

export default PriorityChart;
