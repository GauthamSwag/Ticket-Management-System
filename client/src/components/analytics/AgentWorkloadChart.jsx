import React from 'react';
import { User, LifeBuoy } from 'lucide-react';

const AgentWorkloadChart = ({ workload = [], loading = false }) => {
  return (
    <div className="card" style={{ marginTop: '1.5rem' }}>
      <h3 style={{ fontSize: '1.05rem', fontWeight: 700, marginBottom: '1.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
        <LifeBuoy size={18} color="var(--primary)" />
        Support Agent Workload & Resolution Metrics
      </h3>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '2rem 0', color: 'var(--text-muted)' }}>
          Loading agent workload metrics...
        </div>
      ) : workload.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '2rem 0', color: 'var(--text-dim)' }}>
          No support agents or workload assignments registered
        </div>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table className="ticket-table" style={{ width: '100%', minWidth: '600px' }}>
            <thead>
              <tr>
                <th>Agent</th>
                <th>Department</th>
                <th>Assigned</th>
                <th>In Progress</th>
                <th>Resolved</th>
                <th>Closed</th>
                <th>Total Workload</th>
              </tr>
            </thead>
            <tbody>
              {workload.map((agent) => (
                <tr key={agent.agentId || agent.name}>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                      <div
                        style={{
                          width: '32px',
                          height: '32px',
                          borderRadius: '50%',
                          background: 'linear-gradient(135deg, #06b6d4, #3b82f6)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          color: '#ffffff',
                          fontWeight: 700,
                          fontSize: '0.8rem',
                        }}
                      >
                        {agent.name.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <p style={{ fontWeight: 600, color: 'var(--text-main)', fontSize: '0.88rem' }}>
                          {agent.name}
                        </p>
                        <p style={{ fontSize: '0.75rem', color: 'var(--text-dim)' }}>
                          {agent.email}
                        </p>
                      </div>
                    </div>
                  </td>
                  <td style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                    {agent.department || 'Support'}
                  </td>
                  <td>
                    <span
                      style={{
                        background: 'rgba(168, 85, 247, 0.15)',
                        color: '#c084fc',
                        padding: '0.2rem 0.5rem',
                        borderRadius: 'var(--radius-sm)',
                        fontWeight: 700,
                        fontSize: '0.82rem',
                      }}
                    >
                      {agent.assigned}
                    </span>
                  </td>
                  <td>
                    <span
                      style={{
                        background: 'rgba(6, 182, 212, 0.15)',
                        color: '#22d3ee',
                        padding: '0.2rem 0.5rem',
                        borderRadius: 'var(--radius-sm)',
                        fontWeight: 700,
                        fontSize: '0.82rem',
                      }}
                    >
                      {agent.inProgress}
                    </span>
                  </td>
                  <td>
                    <span
                      style={{
                        background: 'rgba(16, 185, 129, 0.15)',
                        color: '#34d399',
                        padding: '0.2rem 0.5rem',
                        borderRadius: 'var(--radius-sm)',
                        fontWeight: 700,
                        fontSize: '0.82rem',
                      }}
                    >
                      {agent.resolved}
                    </span>
                  </td>
                  <td>
                    <span
                      style={{
                        background: 'rgba(148, 163, 184, 0.15)',
                        color: '#94a3b8',
                        padding: '0.2rem 0.5rem',
                        borderRadius: 'var(--radius-sm)',
                        fontWeight: 700,
                        fontSize: '0.82rem',
                      }}
                    >
                      {agent.closed}
                    </span>
                  </td>
                  <td>
                    <span
                      style={{
                        fontWeight: 800,
                        fontSize: '0.92rem',
                        color: agent.total > 0 ? 'var(--primary)' : 'var(--text-dim)',
                      }}
                    >
                      {agent.total}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default AgentWorkloadChart;
