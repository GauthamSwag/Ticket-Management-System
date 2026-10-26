import React from 'react';
import {
  CircleDot,
  UserCheck,
  Clock,
  CheckCircle2,
  Lock,
  AlertTriangle,
  Flame,
  ArrowDown,
  Minus,
  Tag,
} from 'lucide-react';

export const StatusBadge = ({ status }) => {
  const norm = (status || 'Open').toLowerCase().replace(/\s+/g, '-');

  const getIcon = () => {
    switch (status) {
      case 'Open':
        return <CircleDot size={12} />;
      case 'Assigned':
        return <UserCheck size={12} />;
      case 'In Progress':
        return <Clock size={12} />;
      case 'Resolved':
        return <CheckCircle2 size={12} />;
      case 'Closed':
        return <Lock size={12} />;
      default:
        return <CircleDot size={12} />;
    }
  };

  return (
    <span className={`badge-status badge-status-${norm}`}>
      {getIcon()}
      <span>{status}</span>
    </span>
  );
};

export const PriorityBadge = ({ priority }) => {
  const norm = (priority || 'Medium').toLowerCase();

  const getIcon = () => {
    switch (priority) {
      case 'Low':
        return <ArrowDown size={12} />;
      case 'Medium':
        return <Minus size={12} />;
      case 'High':
        return <AlertTriangle size={12} />;
      case 'Critical':
        return <Flame size={12} />;
      default:
        return <Minus size={12} />;
    }
  };

  return (
    <span className={`badge-priority badge-priority-${norm}`}>
      {getIcon()}
      <span>{priority}</span>
    </span>
  );
};

export const CategoryBadge = ({ category }) => {
  return (
    <span className="badge-category">
      <Tag size={11} style={{ opacity: 0.7 }} />
      <span>{category}</span>
    </span>
  );
};

export default { StatusBadge, PriorityBadge, CategoryBadge };
