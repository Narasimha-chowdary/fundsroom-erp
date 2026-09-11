import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Users,
  Package,
  AlertTriangle,
  FileSpreadsheet,
  CheckCircle2,
  ArrowRight,
  Loader2,
} from 'lucide-react';
import { customerApi, productApi, challanApi } from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import { Product, SalesChallan } from '../../types';
import { StatusBadge, StockBadge } from '../../components/common/Badge';

export const DashboardPage: React.FC = () => {
  const { user, canViewCustomers } = useAuth();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    totalCustomers: 0,
    totalProducts: 0,
    lowStockCount: 0,
    totalChallans: 0,
    confirmedChallans: 0,
  });

  const [lowStockProducts, setLowStockProducts] = useState<Product[]>([]);
  const [recentChallans, setRecentChallans] = useState<SalesChallan[]>([]);

  useEffect(() => {
    const fetchDashboardData = async () => {
      setLoading(true);
      try {
        // Parallel queries to existing endpoints
        const promises: Promise<any>[] = [
          productApi.getAll({ limit: 1 }),
          productApi.getAll({ lowStock: true, limit: 5 }),
          challanApi.getAll({ limit: 5 }),
          challanApi.getAll({ status: 'CONFIRMED', limit: 1 }),
        ];

        // Customer API is only available to ADMIN, SALES, ACCOUNTS
        if (canViewCustomers) {
          promises.push(customerApi.getAll({ limit: 1 }));
        }

        const results = await Promise.allSettled(promises);

        const prodRes = results[0].status === 'fulfilled' ? results[0].value : null;
        const lowStockRes = results[1].status === 'fulfilled' ? results[1].value : null;
        const challanRes = results[2].status === 'fulfilled' ? results[2].value : null;
        const confirmedRes = results[3].status === 'fulfilled' ? results[3].value : null;
        const customerRes =
          results[4] && results[4].status === 'fulfilled' ? results[4].value : null;

        setStats({
          totalProducts: prodRes?.pagination?.total || 0,
          lowStockCount: lowStockRes?.pagination?.total || 0,
          totalChallans: challanRes?.pagination?.total || 0,
          confirmedChallans: confirmedRes?.pagination?.total || 0,
          totalCustomers: customerRes?.pagination?.total || 0,
        });

        setLowStockProducts(lowStockRes?.products || []);
        setRecentChallans(challanRes?.challans || []);
      } catch (err) {
        console.error('Failed to load dashboard metrics:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchDashboardData();
  }, [canViewCustomers]);

  if (loading) {
    return (
      <div className="page-loading">
        <Loader2 className="spinner" size={36} />
        <p>Loading operations overview...</p>
      </div>
    );
  }

  return (
    <div className="dashboard-container">
      <div className="page-header">
        <div>
          <h1 className="page-title">Operations Dashboard</h1>
          <p className="page-subtitle">
            Welcome back, <strong>{user?.name}</strong>. Here is the operational overview for today.
          </p>
        </div>
      </div>

      {/* KPI Cards Grid */}
      <div className="kpi-grid">
        {canViewCustomers && (
          <div className="kpi-card" onClick={() => navigate('/customers')}>
            <div className="kpi-icon-box kpi-blue">
              <Users size={24} />
            </div>
            <div className="kpi-content">
              <span className="kpi-label">Total Customers</span>
              <span className="kpi-value">{stats.totalCustomers}</span>
            </div>
          </div>
        )}

        <div className="kpi-card" onClick={() => navigate('/products')}>
          <div className="kpi-icon-box kpi-purple">
            <Package size={24} />
          </div>
          <div className="kpi-content">
            <span className="kpi-label">Active Products</span>
            <span className="kpi-value">{stats.totalProducts}</span>
          </div>
        </div>

        <div
          className={`kpi-card ${stats.lowStockCount > 0 ? 'kpi-alert-border' : ''}`}
          onClick={() => navigate('/products')}
        >
          <div className="kpi-icon-box kpi-amber">
            <AlertTriangle size={24} />
          </div>
          <div className="kpi-content">
            <span className="kpi-label">Low Stock Alerts</span>
            <span className="kpi-value text-warning">{stats.lowStockCount}</span>
          </div>
        </div>

        <div className="kpi-card" onClick={() => navigate('/challans')}>
          <div className="kpi-icon-box kpi-indigo">
            <FileSpreadsheet size={24} />
          </div>
          <div className="kpi-content">
            <span className="kpi-label">Total Challans</span>
            <span className="kpi-value">{stats.totalChallans}</span>
          </div>
        </div>

        <div className="kpi-card" onClick={() => navigate('/challans')}>
          <div className="kpi-icon-box kpi-green">
            <CheckCircle2 size={24} />
          </div>
          <div className="kpi-content">
            <span className="kpi-label">Confirmed Dispatches</span>
            <span className="kpi-value text-success">{stats.confirmedChallans}</span>
          </div>
        </div>
      </div>

      {/* Dual Section Grid: Low Stock Alert & Recent Challans */}
      <div className="dashboard-sections-grid">
        {/* Low Stock Alert Panel */}
        <div className="panel-card">
          <div className="panel-header">
            <div className="panel-title-with-badge">
              <h3>Low Stock Warnings</h3>
              {stats.lowStockCount > 0 && (
                <span className="count-pill warning">{stats.lowStockCount}</span>
              )}
            </div>
            <button
              type="button"
              className="text-link-btn"
              onClick={() => navigate('/products')}
            >
              <span>Manage Inventory</span>
              <ArrowRight size={16} />
            </button>
          </div>

          <div className="panel-body">
            {lowStockProducts.length === 0 ? (
              <div className="empty-state-simple">
                <CheckCircle2 size={32} className="text-success" />
                <p>All catalog products have sufficient inventory stock levels.</p>
              </div>
            ) : (
              <div className="table-responsive">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Product</th>
                      <th>SKU</th>
                      <th>Stock Level</th>
                      <th>Warehouse Location</th>
                    </tr>
                  </thead>
                  <tbody>
                    {lowStockProducts.map((prod) => (
                      <tr key={prod.id}>
                        <td className="font-medium">{prod.name}</td>
                        <td className="text-muted">{prod.sku}</td>
                        <td>
                          <StockBadge stock={prod.currentStock} minAlert={prod.minStockAlert} />
                        </td>
                        <td>{prod.location}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        {/* Recent Challans Panel */}
        <div className="panel-card">
          <div className="panel-header">
            <h3>Recent Sales Challans</h3>
            <button
              type="button"
              className="text-link-btn"
              onClick={() => navigate('/challans')}
            >
              <span>View All</span>
              <ArrowRight size={16} />
            </button>
          </div>

          <div className="panel-body">
            {recentChallans.length === 0 ? (
              <div className="empty-state-simple">
                <FileSpreadsheet size={32} className="text-muted" />
                <p>No sales challans recorded yet.</p>
              </div>
            ) : (
              <div className="table-responsive">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Challan #</th>
                      <th>Customer</th>
                      <th>Total (₹)</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {recentChallans.map((ch) => (
                      <tr key={ch.id}>
                        <td className="font-semibold text-accent">{ch.challanNumber}</td>
                        <td>{ch.customer?.businessName || ch.customer?.name || '—'}</td>
                        <td className="font-medium">₹{Number(ch.totalAmount).toLocaleString('en-IN')}</td>
                        <td>
                          <StatusBadge status={ch.status} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
