import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useSocket } from '../context/SocketContext';
import {
  getAnalyticsOverview,
  getAnalyticsStatus,
  getAnalyticsPriority,
  getAnalyticsCategory,
  getAnalyticsAgents,
  getAnalyticsTrends,
  getSLAOverview,
  getSLAPriority,
  getSLAAgents,
  getSLATrends,
} from '../services/api';
import OverviewCards from '../components/analytics/OverviewCards';
import StatusChart from '../components/analytics/StatusChart';
import PriorityChart from '../components/analytics/PriorityChart';
import CategoryChart from '../components/analytics/CategoryChart';
import TicketTrendChart from '../components/analytics/TicketTrendChart';
import AgentWorkloadChart from '../components/analytics/AgentWorkloadChart';
import SLADashboard from '../components/analytics/SLADashboard';
import Alert from '../components/Alert';
import { BarChart3, Calendar, RefreshCw, Filter, RotateCcw, Timer, Activity, Sliders } from 'lucide-react';

const Analytics = () => {
  const { isAdmin } = useAuth();
  const { socket } = useSocket();

  const [activeTab, setActiveTab] = useState('overview'); // 'overview' | 'sla'

  const [overview, setOverview] = useState({});
  const [statusData, setStatusData] = useState([]);
  const [priorityData, setPriorityData] = useState([]);
  const [categoryData, setCategoryData] = useState([]);
  const [trendData, setTrendData] = useState([]);
  const [agentWorkload, setAgentWorkload] = useState([]);

  // SLA Analytics states
  const [slaOverview, setSlaOverview] = useState({});
  const [slaPriority, setSlaPriority] = useState([]);
  const [slaAgents, setSlaAgents] = useState([]);
  const [slaTrends, setSlaTrends] = useState([]);

  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [alert, setAlert] = useState({ type: '', message: '' });

  const fetchAllAnalytics = async (isManual = false) => {
    if (isManual) setRefreshing(true);
    else setLoading(true);

    try {
      const trendParams = {};
      if (fromDate) trendParams.fromDate = fromDate;
      if (toDate) trendParams.toDate = toDate;

      const [
        ovRes,
        stRes,
        prRes,
        catRes,
        agRes,
        trRes,
        slaOvRes,
        slaPrRes,
        slaAgRes,
        slaTrRes,
      ] = await Promise.all([
        getAnalyticsOverview(),
        getAnalyticsStatus(),
        getAnalyticsPriority(),
        getAnalyticsCategory(),
        getAnalyticsAgents(),
        getAnalyticsTrends(trendParams),
        getSLAOverview(),
        getSLAPriority(),
        getSLAAgents(),
        getSLATrends(trendParams),
      ]);

      if (ovRes.success) setOverview(ovRes.overview);
      if (stRes.success) setStatusData(stRes.distribution);
      if (prRes.success) setPriorityData(prRes.distribution);
      if (catRes.success) setCategoryData(catRes.distribution);
      if (agRes.success) setAgentWorkload(agRes.workload);
      if (trRes.success) setTrendData(trRes.trends);

      if (slaOvRes.success) setSlaOverview(slaOvRes.slaOverview);
      if (slaPrRes.success) setSlaPriority(slaPrRes.data);
      if (slaAgRes.success) setSlaAgents(slaAgRes.agents);
      if (slaTrRes.success) setSlaTrends(slaTrRes.trends);
    } catch (err) {
      setAlert({
        type: 'error',
        message: err.response?.data?.message || 'Failed to retrieve analytics metrics.',
      });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    if (isAdmin) {
      fetchAllAnalytics();
    }
  }, [isAdmin]);

  // Real-time metrics synchronization via Socket.IO
  useEffect(() => {
    if (!socket) return;

    const handleRealtimeUpdate = () => {
      fetchAllAnalytics(true);
    };

    socket.on('ticket:created', handleRealtimeUpdate);
    socket.on('ticket:statusChanged', handleRealtimeUpdate);
    socket.on('ticket:assigned', handleRealtimeUpdate);
    socket.on('ticket:priorityChanged', handleRealtimeUpdate);
    socket.on('sla:breached', handleRealtimeUpdate);
    socket.on('sla:warning', handleRealtimeUpdate);

    return () => {
      socket.off('ticket:created', handleRealtimeUpdate);
      socket.off('ticket:statusChanged', handleRealtimeUpdate);
      socket.off('ticket:assigned', handleRealtimeUpdate);
      socket.off('ticket:priorityChanged', handleRealtimeUpdate);
      socket.off('sla:breached', handleRealtimeUpdate);
      socket.off('sla:warning', handleRealtimeUpdate);
    };
  }, [socket, fromDate, toDate]);

  const handleApplyRange = (e) => {
    e.preventDefault();
    fetchAllAnalytics(true);
  };

  const handleResetRange = () => {
    setFromDate('');
    setToDate('');
    setTimeout(() => {
      fetchAllAnalytics(true);
    }, 0);
  };

  if (!isAdmin) {
    return (
      <div className="container" style={{ padding: '5rem 1.5rem', textAlign: 'center' }}>
        <Alert type="error" message="Unauthorized: Administrator access required." />
      </div>
    );
  }

  return (
    <div className="container" style={{ padding: '2.5rem 1.5rem 5rem' }}>
      {/* Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '1rem',
          marginBottom: '2rem',
        }}
      >
        <div>
          <h1 style={{ fontSize: '2rem', display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
            <BarChart3 size={28} color="var(--primary)" />
            Enterprise Analytics & Intelligence
          </h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginTop: '0.25rem' }}>
            System-wide operational metrics, agent workload distribution, and ticket resolution trends.
          </p>
        </div>

        {/* Refresh button */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <Link to="/admin/sla" className="btn btn-secondary btn-sm" style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            <Sliders size={14} /> SLA Rules
          </Link>
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={() => fetchAllAnalytics(true)}
            disabled={refreshing}
            style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}
          >
            <RefreshCw size={14} className={refreshing ? 'spin' : ''} />
            {refreshing ? 'Refreshing...' : 'Live Refresh'}
          </button>
        </div>
      </div>

      {alert.message && (
        <Alert
          type={alert.type}
          message={alert.message}
          onClose={() => setAlert({ type: '', message: '' })}
        />
      )}

      {/* Analytics Category Tabs */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1.5rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.75rem' }}>
        <button
          type="button"
          onClick={() => setActiveTab('overview')}
          className={`btn btn-sm ${activeTab === 'overview' ? 'btn-primary' : 'btn-secondary'}`}
          style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}
        >
          <Activity size={15} /> Operational Overview
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('sla')}
          className={`btn btn-sm ${activeTab === 'sla' ? 'btn-primary' : 'btn-secondary'}`}
          style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}
        >
          <Timer size={15} /> SLA Compliance &amp; Monitoring
        </button>
      </div>

      {/* Date Range Filter Bar */}
      <form
        onSubmit={handleApplyRange}
        style={{
          background: 'var(--bg-card)',
          border: '1px solid var(--border-color)',
          borderRadius: 'var(--radius-md)',
          padding: '1rem 1.25rem',
          marginBottom: '2rem',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '1rem',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Calendar size={16} color="var(--primary)" />
            <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-main)' }}>
              Creation Date Filter:
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <label style={{ fontSize: '0.8rem', color: 'var(--text-dim)' }}>From:</label>
            <input
              type="date"
              className="form-input"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
              style={{ padding: '0.35rem 0.65rem', fontSize: '0.85rem', width: 'auto' }}
            />
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <label style={{ fontSize: '0.8rem', color: 'var(--text-dim)' }}>To:</label>
            <input
              type="date"
              className="form-input"
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
              style={{ padding: '0.35rem 0.65rem', fontSize: '0.85rem', width: 'auto' }}
            />
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <button
            type="submit"
            className="btn btn-primary btn-sm"
            style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}
          >
            <Filter size={14} /> Apply Filter
          </button>
          {(fromDate || toDate) && (
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={handleResetRange}
              style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}
            >
              <RotateCcw size={14} /> Reset
            </button>
          )}
        </div>
      </form>

      {activeTab === 'sla' ? (
        <SLADashboard
          slaOverview={slaOverview}
          slaPriority={slaPriority}
          slaAgents={slaAgents}
          slaTrends={slaTrends}
        />
      ) : (
        <>
          {/* 1. Overview Summary Metric Cards */}
          <OverviewCards overview={overview} loading={loading} />

          {/* 2. Status & Priority Breakdown Grid */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))',
              gap: '1.5rem',
              marginBottom: '1.5rem',
            }}
          >
            <StatusChart data={statusData} loading={loading} />
            <PriorityChart data={priorityData} loading={loading} />
          </div>

          {/* 3. Category & Creation Trend Grid */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))',
              gap: '1.5rem',
              marginBottom: '1.5rem',
            }}
          >
            <CategoryChart data={categoryData} loading={loading} />
            <TicketTrendChart data={trendData} loading={loading} />
          </div>

          {/* 4. Support Agent Workload Table */}
          <AgentWorkloadChart workload={agentWorkload} loading={loading} />
        </>
      )}
    </div>
  );
};

export default Analytics;
