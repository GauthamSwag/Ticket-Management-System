import React, { useState, useEffect } from 'react';
import { getAnalyticsAgents, getSLAAgents } from '../services/api';
import Alert from '../components/Alert';
import {
  UserCheck,
  Shield,
  LifeBuoy,
  RefreshCw,
  Clock,
  AlertTriangle,
  CheckCircle2,
  TrendingUp,
  Inbox,
  Award,
} from 'lucide-react';
import { Link } from 'react-router-dom';

const AgentManagement = () => {
  const [agents, setAgents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [alert, setAlert] = useState({ type: '', message: '' });

  const fetchAgentData = async () => {
    setLoading(true);
    try {
      const [workloadRes, slaRes] = await Promise.allSettled([
        getAnalyticsAgents(),
        getSLAAgents(),
      ]);

      const workloadList =
        workloadRes.status === 'fulfilled' && workloadRes.value?.success
          ? workloadRes.value.workload || []
          : [];

      const slaList =
        slaRes.status === 'fulfilled' && slaRes.value?.success
          ? slaRes.value.data || []
          : [];

      // Create SLA lookup map by agentId
      const slaMap = {};
      slaList.forEach((item) => {
        if (item.agentId) {
          slaMap[item.agentId.toString()] = item;
        }
      });

      // Merge workload and SLA metrics
      const combined = workloadList.map((agent) => {
        const idStr = agent.agentId ? agent.agentId.toString() : '';
        const slaData = slaMap[idStr] || {};

        const activeQueue = (agent.assigned || 0) + (agent.inProgress || 0);
        const resolvedTotal = (agent.resolved || 0) + (agent.closed || 0);
        const respBreaches = slaData.responseBreaches || 0;
        const resolBreaches = slaData.resolutionBreaches || 0;
        const totalBreaches = respBreaches + resolBreaches;

        // Calculate compliance rate if not already provided
        let complianceRate = slaData.complianceRate;
        if (complianceRate === undefined) {
          if (agent.total > 0) {
            complianceRate = Math.max(0, Math.round(((agent.total - totalBreaches) / agent.total) * 100));
          } else {
            complianceRate = 100;
          }
        }

        return {
          ...agent,
          activeQueue,
          resolvedTotal,
          responseBreaches: respBreaches,
          resolutionBreaches: resolBreaches,
          totalBreaches,
          complianceRate,
        };
      });

      setAgents(combined);
    } catch (err) {
      setAlert({
        type: 'error',
        message: err.response?.data?.message || 'Failed to retrieve agent analytics data.',
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAgentData();
  }, []);

  // Compute aggregate system stats
  const totalAgents = agents.length;
  const totalActiveQueue = agents.reduce((acc, a) => acc + (a.activeQueue || 0), 0);
  const totalResolved = agents.reduce((acc, a) => acc + (a.resolvedTotal || 0), 0);
  const totalBreaches = agents.reduce((acc, a) => acc + (a.totalBreaches || 0), 0);

  const getWorkloadBadge = (activeCount) => {
    if (activeCount === 0) {
      return (
        <span
          style={{
            padding: '0.2rem 0.6rem',
            borderRadius: '999px',
            fontSize: '0.75rem',
            fontWeight: 600,
            backgroundColor: 'rgba(59, 130, 246, 0.15)',
            color: '#3b82f6',
          }}
        >
          Available
        </span>
      );
    } else if (activeCount <= 4) {
      return (
        <span
          style={{
            padding: '0.2rem 0.6rem',
            borderRadius: '999px',
            fontSize: '0.75rem',
            fontWeight: 600,
            backgroundColor: 'rgba(34, 197, 94, 0.15)',
            color: '#22c55e',
          }}
        >
          Optimal Load
        </span>
      );
    } else {
      return (
        <span
          style={{
            padding: '0.2rem 0.6rem',
            borderRadius: '999px',
            fontSize: '0.75rem',
            fontWeight: 600,
            backgroundColor: 'rgba(239, 68, 68, 0.15)',
            color: '#ef4444',
          }}
        >
          High Queue ({activeCount})
        </span>
      );
    }
  };

  const getComplianceBadge = (rate) => {
    if (rate >= 90) {
      return (
        <span
          style={{
            padding: '0.2rem 0.6rem',
            borderRadius: '999px',
            fontSize: '0.75rem',
            fontWeight: 700,
            backgroundColor: 'rgba(34, 197, 94, 0.15)',
            color: '#22c55e',
          }}
        >
          {rate}%
        </span>
      );
    } else if (rate >= 75) {
      return (
        <span
          style={{
            padding: '0.2rem 0.6rem',
            borderRadius: '999px',
            fontSize: '0.75rem',
            fontWeight: 700,
            backgroundColor: 'rgba(234, 179, 8, 0.15)',
            color: '#eab308',
          }}
        >
          {rate}%
        </span>
      );
    } else {
      return (
        <span
          style={{
            padding: '0.2rem 0.6rem',
            borderRadius: '999px',
            fontSize: '0.75rem',
            fontWeight: 700,
            backgroundColor: 'rgba(239, 68, 68, 0.15)',
            color: '#ef4444',
          }}
        >
          {rate}%
        </span>
      );
    }
  };

  return (
    <div className="container" style={{ padding: '2rem 1rem' }}>
      {/* Header */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '1.5rem',
          flexWrap: 'wrap',
          gap: '1rem',
        }}
      >
        <div>
          <h1 style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', margin: 0, fontSize: '1.75rem' }}>
            <UserCheck style={{ color: 'var(--primary-color)' }} /> Agent Workloads & SLA Performance
          </h1>
          <p style={{ color: 'var(--text-muted)', margin: '0.35rem 0 0 0', fontSize: '0.9rem' }}>
            Monitor real-time support staff queue distribution, resolution volume, and SLA compliance metrics.
          </p>
        </div>

        <button
          onClick={fetchAgentData}
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

      {/* Aggregate KPI Stat Cards */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
          gap: '1rem',
          marginBottom: '1.5rem',
        }}
      >
        <div className="card" style={{ padding: '1.25rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 600 }}>Active Agents</div>
              <div style={{ fontSize: '1.8rem', fontWeight: 700, color: 'var(--text-color)', marginTop: '0.2rem' }}>
                {totalAgents}
              </div>
            </div>
            <div style={{ padding: '0.6rem', borderRadius: '8px', background: 'rgba(99, 102, 241, 0.15)', color: 'var(--primary-color)' }}>
              <LifeBuoy size={24} />
            </div>
          </div>
        </div>

        <div className="card" style={{ padding: '1.25rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 600 }}>Active Queue</div>
              <div style={{ fontSize: '1.8rem', fontWeight: 700, color: '#38bdf8', marginTop: '0.2rem' }}>
                {totalActiveQueue}
              </div>
            </div>
            <div style={{ padding: '0.6rem', borderRadius: '8px', background: 'rgba(56, 189, 248, 0.15)', color: '#38bdf8' }}>
              <Inbox size={24} />
            </div>
          </div>
        </div>

        <div className="card" style={{ padding: '1.25rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 600 }}>Total Resolved</div>
              <div style={{ fontSize: '1.8rem', fontWeight: 700, color: '#22c55e', marginTop: '0.2rem' }}>
                {totalResolved}
              </div>
            </div>
            <div style={{ padding: '0.6rem', borderRadius: '8px', background: 'rgba(34, 197, 94, 0.15)', color: '#22c55e' }}>
              <CheckCircle2 size={24} />
            </div>
          </div>
        </div>

        <div className="card" style={{ padding: '1.25rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 600 }}>SLA Breaches</div>
              <div style={{ fontSize: '1.8rem', fontWeight: 700, color: totalBreaches > 0 ? '#ef4444' : '#94a3b8', marginTop: '0.2rem' }}>
                {totalBreaches}
              </div>
            </div>
            <div style={{ padding: '0.6rem', borderRadius: '8px', background: 'rgba(239, 68, 68, 0.15)', color: '#ef4444' }}>
              <AlertTriangle size={24} />
            </div>
          </div>
        </div>
      </div>

      {/* Agents Table */}
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <div className="table-container">
          <table className="table" style={{ width: '100%', margin: 0 }}>
            <thead>
              <tr>
                <th style={{ padding: '1rem' }}>Support Agent</th>
                <th style={{ padding: '1rem' }}>Department</th>
                <th style={{ padding: '1rem', textAlign: 'center' }}>Active Queue</th>
                <th style={{ padding: '1rem', textAlign: 'center' }}>Resolved</th>
                <th style={{ padding: '1rem', textAlign: 'center' }}>Total Assigned</th>
                <th style={{ padding: '1rem', textAlign: 'center' }}>SLA Breaches</th>
                <th style={{ padding: '1rem', textAlign: 'center' }}>Compliance</th>
                <th style={{ padding: '1rem', textAlign: 'right' }}>Workload Status</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan="8" style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
                    <RefreshCw size={24} className="spin" style={{ margin: '0 auto 0.75rem', display: 'block' }} />
                    Loading agent workloads...
                  </td>
                </tr>
              ) : agents.length === 0 ? (
                <tr>
                  <td colSpan="8" style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
                    <LifeBuoy size={32} style={{ margin: '0 auto 0.75rem', display: 'block', opacity: 0.5 }} />
                    No active support agents found in the system.
                  </td>
                </tr>
              ) : (
                agents.map((agent) => (
                  <tr key={agent.agentId || agent.email}>
                    {/* Agent Name & Email */}
                    <td style={{ padding: '1rem' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                        <div
                          style={{
                            width: '36px',
                            height: '36px',
                            borderRadius: '50%',
                            backgroundColor: 'rgba(59, 130, 246, 0.2)',
                            color: '#3b82f6',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontWeight: 700,
                            fontSize: '0.9rem',
                          }}
                        >
                          {agent.name?.charAt(0).toUpperCase() || 'A'}
                        </div>
                        <div>
                          <div style={{ fontWeight: 600, color: 'var(--text-color)' }}>
                            {agent.name}
                          </div>
                          <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                            {agent.email}
                          </div>
                        </div>
                      </div>
                    </td>

                    {/* Department */}
                    <td style={{ padding: '1rem', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                      {agent.department || 'Support'}
                    </td>

                    {/* Active Queue */}
                    <td style={{ padding: '1rem', textAlign: 'center' }}>
                      <div style={{ fontWeight: 700, fontSize: '0.95rem', color: agent.activeQueue > 0 ? '#38bdf8' : 'var(--text-muted)' }}>
                        {agent.activeQueue}
                      </div>
                      <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                        ({agent.assigned || 0} open, {agent.inProgress || 0} active)
                      </div>
                    </td>

                    {/* Resolved */}
                    <td style={{ padding: '1rem', textAlign: 'center', fontWeight: 600, color: '#22c55e' }}>
                      {agent.resolvedTotal}
                    </td>

                    {/* Total Assigned */}
                    <td style={{ padding: '1rem', textAlign: 'center', fontWeight: 600, color: 'var(--text-color)' }}>
                      {agent.total || 0}
                    </td>

                    {/* SLA Breaches */}
                    <td style={{ padding: '1rem', textAlign: 'center' }}>
                      {agent.totalBreaches > 0 ? (
                        <div>
                          <span style={{ color: '#ef4444', fontWeight: 700 }}>
                            {agent.totalBreaches}
                          </span>
                          <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                            {agent.responseBreaches} resp / {agent.resolutionBreaches} resol
                          </div>
                        </div>
                      ) : (
                        <span style={{ color: '#22c55e', fontSize: '0.85rem' }}>0</span>
                      )}
                    </td>

                    {/* Compliance */}
                    <td style={{ padding: '1rem', textAlign: 'center' }}>
                      {getComplianceBadge(agent.complianceRate)}
                    </td>

                    {/* Workload Status */}
                    <td style={{ padding: '1rem', textAlign: 'right' }}>
                      {getWorkloadBadge(agent.activeQueue)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default AgentManagement;
