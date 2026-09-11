import React from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { Role } from '../../types';
import { Loader2, AlertTriangle } from 'lucide-react';

interface ProtectedRouteProps {
  allowedRoles?: Role[];
}

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ allowedRoles }) => {
  const { user, token, loading } = useAuth();

  if (loading) {
    return (
      <div className="fullscreen-loading">
        <Loader2 className="spinner" size={40} />
        <p>Verifying authentication session...</p>
      </div>
    );
  }

  if (!token || !user) {
    return <Navigate to="/login" replace />;
  }

  if (allowedRoles && !allowedRoles.includes(user.role)) {
    return (
      <div className="access-denied-container">
        <AlertTriangle size={48} className="text-warning" />
        <h2>Access Restricted</h2>
        <p>
          Your account role (<strong>{user.role}</strong>) does not have authorization to view this module.
        </p>
      </div>
    );
  }

  return <Outlet />;
};
