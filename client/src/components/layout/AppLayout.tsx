import React, { useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard,
  Users,
  Package,
  FileSpreadsheet,
  LogOut,
  Menu,
  X,
  ShieldCheck,
  Building2,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { RoleBadge } from '../common/Badge';

export const AppLayout: React.FC = () => {
  const { user, logout, canViewCustomers } = useAuth();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const navItems = [
    {
      to: '/dashboard',
      label: 'Dashboard',
      icon: <LayoutDashboard size={18} />,
      show: true,
    },
    {
      to: '/customers',
      label: 'Customer CRM',
      icon: <Users size={18} />,
      show: canViewCustomers,
    },
    {
      to: '/products',
      label: 'Products & Stock',
      icon: <Package size={18} />,
      show: true,
    },
    {
      to: '/challans',
      label: 'Sales Challans',
      icon: <FileSpreadsheet size={18} />,
      show: true,
    },
  ];

  return (
    <div className="app-shell">
      {/* Mobile Drawer Backdrop */}
      {mobileMenuOpen && (
        <div
          className="sidebar-backdrop"
          onClick={() => setMobileMenuOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside className={`sidebar ${mobileMenuOpen ? 'open' : ''}`}>
        <div className="sidebar-brand">
          <div className="brand-logo">
            <Building2 size={24} className="text-accent" />
          </div>
          <div className="brand-info">
            <span className="brand-title">Fundsroom</span>
            <span className="brand-subtitle">Mini ERP Portal</span>
          </div>
          <button
            className="mobile-close-btn"
            onClick={() => setMobileMenuOpen(false)}
          >
            <X size={20} />
          </button>
        </div>

        <div className="sidebar-user-preview">
          <div className="user-avatar">
            {user?.name?.charAt(0).toUpperCase() || 'U'}
          </div>
          <div className="user-details">
            <div className="user-name">{user?.name}</div>
            <RoleBadge role={user?.role} />
          </div>
        </div>

        <nav className="sidebar-nav">
          <div className="nav-section-label">OPERATIONS</div>
          {navItems
            .filter((item) => item.show)
            .map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) =>
                  `nav-link ${isActive ? 'active' : ''}`
                }
                onClick={() => setMobileMenuOpen(false)}
              >
                <span className="nav-icon">{item.icon}</span>
                <span className="nav-label">{item.label}</span>
              </NavLink>
            ))}
        </nav>

        <div className="sidebar-footer">
          <button
            type="button"
            className="logout-btn"
            onClick={handleLogout}
          >
            <LogOut size={18} />
            <span>Sign Out</span>
          </button>
        </div>
      </aside>

      {/* Main Layout Area */}
      <div className="main-viewport">
        {/* Top Header */}
        <header className="top-header">
          <button
            type="button"
            className="mobile-hamburger"
            onClick={() => setMobileMenuOpen(true)}
            aria-label="Toggle menu"
          >
            <Menu size={22} />
          </button>

          <div className="header-status">
            <div className="status-indicator-dot" />
            <span>Operations Portal Live</span>
          </div>

          <div className="header-actions">
            <div className="header-role-indicator">
              <ShieldCheck size={16} className="role-shield" />
              <span>{user?.email}</span>
              <RoleBadge role={user?.role} />
            </div>
          </div>
        </header>

        {/* Dynamic Page Content */}
        <main className="content-container">
          <Outlet />
        </main>
      </div>
    </div>
  );
};
