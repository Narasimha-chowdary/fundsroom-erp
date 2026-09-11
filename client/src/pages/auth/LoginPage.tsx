import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { Button } from '../../components/common/Button';
import { Alert } from '../../components/common/Alert';
import { Building2, Lock, Mail, Shield } from 'lucide-react';

export const LoginPage: React.FC = () => {
  const { login } = useAuth();
  const navigate = useNavigate();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      await login(email, password);
      navigate('/dashboard');
    } catch (err: any) {
      setError(err.message || 'Login failed. Please verify your credentials.');
    } finally {
      setLoading(false);
    }
  };

  const handleQuickFill = (demoEmail: string) => {
    setEmail(demoEmail);
    setPassword('Fundsroom@2026');
    setError(null);
  };

  return (
    <div className="login-wrapper">
      <div className="login-card">
        <div className="login-header">
          <div className="login-logo-container">
            <Building2 size={36} className="text-accent" />
          </div>
          <h1 className="login-title">Fundsroom ERP Portal</h1>
          <p className="login-subtitle">Wholesale & Distribution Operations Management</p>
        </div>

        {error && <Alert type="error" message={error} onClose={() => setError(null)} />}

        <form onSubmit={handleSubmit} className="login-form">
          <div className="form-group">
            <label className="form-label" htmlFor="email">
              Email Address
            </label>
            <div className="input-with-icon">
              <Mail className="input-icon" size={18} />
              <input
                id="email"
                type="email"
                className="form-input"
                placeholder="name@fundsroom.local"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
              />
            </div>
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="password">
              Password
            </label>
            <div className="input-with-icon">
              <Lock className="input-icon" size={18} />
              <input
                id="password"
                type="password"
                className="form-input"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete="current-password"
              />
            </div>
          </div>

          <Button type="submit" variant="primary" size="lg" loading={loading} className="w-full">
            Sign In to Portal
          </Button>
        </form>

        {/* Quick Demo Login Pre-fills */}
        <div className="demo-accounts-box">
          <div className="demo-accounts-title">
            <Shield size={14} />
            <span>Select Demo Role to Pre-fill</span>
          </div>
          <div className="demo-pills-grid">
            <button
              type="button"
              className="demo-pill demo-admin"
              onClick={() => handleQuickFill('admin@fundsroom.local')}
            >
              <strong>ADMIN</strong>
              <span>Full Access</span>
            </button>
            <button
              type="button"
              className="demo-pill demo-sales"
              onClick={() => handleQuickFill('sales@fundsroom.local')}
            >
              <strong>SALES</strong>
              <span>CRM & Challans</span>
            </button>
            <button
              type="button"
              className="demo-pill demo-warehouse"
              onClick={() => handleQuickFill('warehouse@fundsroom.local')}
            >
              <strong>WAREHOUSE</strong>
              <span>Stock & Dispatch</span>
            </button>
            <button
              type="button"
              className="demo-pill demo-accounts"
              onClick={() => handleQuickFill('accounts@fundsroom.local')}
            >
              <strong>ACCOUNTS</strong>
              <span>Audit & View</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
