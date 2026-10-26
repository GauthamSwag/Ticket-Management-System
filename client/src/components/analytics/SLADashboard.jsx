import React from 'react';
import { Link } from 'react-router-dom';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  CartesianGrid,
} from 'recharts';
import {
  Timer,
  CheckCircle2,
  AlertOctagon,
  Clock,
  ShieldAlert,
  ArrowRight,
  TrendingDown,
  UserCheck,
} from 'lucide-react';

const SLADashboard = ({ slaOverview, slaPriority, slaAgents, slaTrends }) => {
  const total = slaOverview?.totalTickets || 0;
  const withinSLA = slaOverview?.ticketsWithinSLA || 0;
  const responseBreaches = slaOverview?.responseBreaches || 0;
  const resolutionBreaches = slaOverview?.resolutionBreaches || 0;
  const approachingResponse = slaOverview?.approachingResponseDeadline || 0;
  const approachingResolution = slaOverview?.approachingResolutionDeadline || 0;

  const complianceRate = total > 0 ? Math.round((withinSLA / total) * 100) : 100;

  return (
    <div>
      {/* SLA Quick Action Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '1rem',
          marginBottom: '1.5rem',
          padding: '1rem 1.25rem',
          background: 'rgba(99, 102, 241, 0.08)',
          borderRadius: 'var(--radius-md)',
          border: '1px solid rgba(99, 102, 241, 0.2)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <Timer size={22} color="var(--primary)" />
          <div>
            <div style={{ fontWeight: 600, fontSize: '0.95rem' }}>Active SLA Policy Automation</div>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
              Targets are monitored server-side every minute with automated alerts and audit history tracking.
            </div>
          </div>
        </div>

        <Link
          to="/admin/sla"
          className="btn btn-primary btn-sm"
          style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}
        >
          Configure SLA Targets <ArrowRight size={14} />
        </Link>
      </div>

      {/* SLA Metric Cards */}
      <div
        className="stats-grid"
        style={{
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: '1rem',
          marginBottom: '2rem',
        }}
      >
        <div className="stat-card">
          <div className="stat-icon" style={{ background: 'rgba(56, 189, 248, 0.15)', color: '#38bdf8' }}>
            <Timer size={22} />
          </div>
          <div>
            <div className="stat-value">{total}</div>
            <div className="stat-label">Monitored Tickets</div>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon" style={{ background: 'rgba(16, 185, 129, 0.15)', color: '#10b981' }}>
            <CheckCircle2 size={22} />
          </div>
          <div>
            <div className="stat-value">{complianceRate}%</div>
            <div className="stat-label">SLA Compliance ({withinSLA})</div>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon" style={{ background: 'rgba(239, 68, 68, 0.15)', color: '#ef4444' }}>
            <AlertOctagon size={22} />
          </div>
          <div>
            <div className="stat-value">{responseBreaches}</div>
            <div className="stat-label">Response Breaches</div>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon" style={{ background: 'rgba(244, 63, 94, 0.15)', color: '#f43f5e' }}>
            <ShieldAlert size={22} />
          </div>
          <div>
            <div className="stat-value">{resolutionBreaches}</div>
            <div className="stat-label">Resolution Breaches</div>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon" style={{ background: 'rgba(245, 158, 11, 0.15)', color: '#f59e0b' }}>
            <Clock size={22} />
          </div>
          <div>
            <div className="stat-value">{approachingResponse + approachingResolution}</div>
            <div className="stat-label">Approaching Deadline</div>
          </div>
        </div>
      </div>

      {/* Middle Row: Priority SLA Performance & Breach Trend */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: '1.5rem', marginBottom: '2rem' }}>
        {/* Priority SLA Performance Chart */}
        <div className="card">
          <div style={{ marginBottom: '1.25rem' }}>
            <h3 style={{ fontSize: '1.1rem', margin: '0 0 0.25rem' }}>SLA Compliance by Priority Tier</h3>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', margin: 0 }}>
              Breakdown of compliant vs breached tickets by urgency level
            </p>
          </div>

          <div style={{ width: '100%', height: 260 }}>
            {slaPriority && slaPriority.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={slaPriority} margin={{ top: 10, right: 20, left: -10, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255, 255, 255, 0.05)" />
                  <XAxis dataKey="priority" stroke="var(--text-dim)" fontSize={12} />
                  <YAxis stroke="var(--text-dim)" fontSize={12} allowDecimals={false} />
                  <Tooltip
                    contentStyle={{
                      background: 'rgba(15, 23, 42, 0.95)',
                      border: '1px solid var(--border-color)',
                      borderRadius: '8px',
                      fontSize: '12px',
                    }}
                  />
                  <Legend wrapperStyle={{ fontSize: '12px' }} />
                  <Bar dataKey="withinSLA" name="Within SLA" fill="#10b981" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="responseBreaches" name="Response Breached" fill="#f59e0b" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="resolutionBreaches" name="Resolution Breached" fill="#ef4444" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div style={{ textAlign: 'center', color: 'var(--text-dim)', paddingTop: '6rem' }}>
                No priority SLA metrics available.
              </div>
            )}
          </div>
        </div>

        {/* SLA Breach Trends */}
        <div className="card">
          <div style={{ marginBottom: '1.25rem' }}>
            <h3 style={{ fontSize: '1.1rem', margin: '0 0 0.25rem' }}>SLA Breach Timeline Trends</h3>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', margin: 0 }}>
              Daily distribution of SLA response and resolution breach occurrences
            </p>
          </div>

          <div style={{ width: '100%', height: 260 }}>
            {slaTrends && slaTrends.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={slaTrends} margin={{ top: 10, right: 20, left: -10, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255, 255, 255, 0.05)" />
                  <XAxis dataKey="date" stroke="var(--text-dim)" fontSize={12} />
                  <YAxis stroke="var(--text-dim)" fontSize={12} allowDecimals={false} />
                  <Tooltip
                    contentStyle={{
                      background: 'rgba(15, 23, 42, 0.95)',
                      border: '1px solid var(--border-color)',
                      borderRadius: '8px',
                      fontSize: '12px',
                    }}
                  />
                  <Legend wrapperStyle={{ fontSize: '12px' }} />
                  <Bar dataKey="responseBreaches" name="Response Breaches" fill="#f59e0b" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="resolutionBreaches" name="Resolution Breaches" fill="#ef4444" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div style={{ textAlign: 'center', color: '#10b981', paddingTop: '6rem' }}>
                <CheckCircle2 size={32} style={{ margin: '0 auto 0.5rem', opacity: 0.8 }} />
                <div>Zero SLA breaches recorded in this date range. Excellent compliance!</div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Bottom Table: Agent SLA Workload & Resolution Performance */}
      <div className="card">
        <div style={{ marginBottom: '1.25rem' }}>
          <h3 style={{ fontSize: '1.1rem', margin: '0 0 0.25rem' }}>Support Agent SLA Accountability</h3>
          <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', margin: 0 }}>
            Performance and SLA breach counts assigned per support staff member
          </p>
        </div>

        {slaAgents && slaAgents.length > 0 ? (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.875rem' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border-color)', color: 'var(--text-muted)' }}>
                  <th style={{ padding: '0.75rem 1rem' }}>Support Agent</th>
                  <th style={{ padding: '0.75rem 1rem' }}>Assigned Tickets</th>
                  <th style={{ padding: '0.75rem 1rem' }}>Resolved</th>
                  <th style={{ padding: '0.75rem 1rem' }}>Response Breaches</th>
                  <th style={{ padding: '0.75rem 1rem' }}>Resolution Breaches</th>
                  <th style={{ padding: '0.75rem 1rem' }}>SLA Health</th>
                </tr>
              </thead>
              <tbody>
                {slaAgents.map((ag) => {
                  const totalBreaches = (ag.responseBreaches || 0) + (ag.resolutionBreaches || 0);
                  const isHealthy = totalBreaches === 0;

                  return (
                    <tr key={ag.agentId} style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.04)' }}>
                      <td style={{ padding: '0.85rem 1rem', fontWeight: 600 }}>{ag.agent}</td>
                      <td style={{ padding: '0.85rem 1rem' }}>{ag.assignedTickets}</td>
                      <td style={{ padding: '0.85rem 1rem', color: '#10b981' }}>{ag.resolvedTickets}</td>
                      <td style={{ padding: '0.85rem 1rem', color: ag.responseBreaches > 0 ? '#f59e0b' : 'var(--text-dim)' }}>
                        {ag.responseBreaches}
                      </td>
                      <td style={{ padding: '0.85rem 1rem', color: ag.resolutionBreaches > 0 ? '#ef4444' : 'var(--text-dim)' }}>
                        {ag.resolutionBreaches}
                      </td>
                      <td style={{ padding: '0.85rem 1rem' }}>
                        {isHealthy ? (
                          <span className="badge badge-status-resolved" style={{ fontSize: '0.75rem' }}>
                            Optimal
                          </span>
                        ) : (
                          <span className="badge badge-priority-critical" style={{ fontSize: '0.75rem' }}>
                            {totalBreaches} Breach{totalBreaches > 1 ? 'es' : ''}
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div style={{ textAlign: 'center', color: 'var(--text-dim)', padding: '2rem 1rem' }}>
            No agent assignment data available for SLA accountability analysis.
          </div>
        )}
      </div>
    </div>
  );
};

export default SLADashboard;
