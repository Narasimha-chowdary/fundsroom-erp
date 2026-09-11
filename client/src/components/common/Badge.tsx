import React from 'react';

interface BadgeProps {
  children: React.ReactNode;
  variant?: 'primary' | 'success' | 'warning' | 'danger' | 'info' | 'neutral';
  size?: 'sm' | 'md';
}

export const Badge: React.FC<BadgeProps> = ({ children, variant = 'neutral', size = 'sm' }) => {
  return <span className={`badge badge-${variant} badge-${size}`}>{children}</span>;
};

export const RoleBadge: React.FC<{ role?: string }> = ({ role }) => {
  switch (role) {
    case 'ADMIN':
      return <Badge variant="primary">ADMIN</Badge>;
    case 'SALES':
      return <Badge variant="info">SALES</Badge>;
    case 'WAREHOUSE':
      return <Badge variant="warning">WAREHOUSE</Badge>;
    case 'ACCOUNTS':
      return <Badge variant="success">ACCOUNTS</Badge>;
    default:
      return <Badge variant="neutral">{role || 'UNKNOWN'}</Badge>;
  }
};

export const StatusBadge: React.FC<{ status?: string }> = ({ status }) => {
  switch (status) {
    case 'ACTIVE':
    case 'CONFIRMED':
      return <Badge variant="success">{status}</Badge>;
    case 'LEAD':
    case 'DRAFT':
      return <Badge variant="warning">{status}</Badge>;
    case 'INACTIVE':
    case 'CANCELLED':
      return <Badge variant="danger">{status}</Badge>;
    default:
      return <Badge variant="neutral">{status || '—'}</Badge>;
  }
};

export const StockBadge: React.FC<{ stock: number; minAlert: number }> = ({ stock, minAlert }) => {
  if (stock === 0) {
    return <Badge variant="danger">Out of Stock</Badge>;
  }
  if (stock <= minAlert) {
    return <Badge variant="warning">Low Stock ({stock})</Badge>;
  }
  return <Badge variant="success">In Stock ({stock})</Badge>;
};
