import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { User } from '../types';
import { authApi } from '../api/client';

interface AuthContextType {
  user: User | null;
  token: string | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<User>;
  logout: () => void;
  // Role helpers
  isAdmin: boolean;
  isSales: boolean;
  isWarehouse: boolean;
  isAccounts: boolean;
  canManageCustomers: boolean;
  canViewCustomers: boolean;
  canManageProducts: boolean;
  canViewProducts: boolean;
  canManageChallans: boolean;
  canConfirmChallan: boolean;
  canCancelChallan: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(() => {
    const saved = localStorage.getItem('fundsroom_user');
    return saved ? JSON.parse(saved) : null;
  });
  const [token, setToken] = useState<string | null>(() => localStorage.getItem('fundsroom_token'));
  const [loading, setLoading] = useState<boolean>(true);

  // Restore authenticated session on initial mount
  useEffect(() => {
    const restoreSession = async () => {
      const storedToken = localStorage.getItem('fundsroom_token');
      if (!storedToken) {
        setLoading(false);
        return;
      }

      try {
        const freshUser = await authApi.getMe();
        setUser(freshUser);
        localStorage.setItem('fundsroom_user', JSON.stringify(freshUser));
      } catch (err) {
        console.warn('Session expired or invalid token:', err);
        logout();
      } finally {
        setLoading(false);
      }
    };

    restoreSession();

    const handleUnauthorized = () => {
      logout();
    };

    window.addEventListener('auth:unauthorized', handleUnauthorized);
    return () => window.removeEventListener('auth:unauthorized', handleUnauthorized);
  }, []);

  const login = async (email: string, password: string): Promise<User> => {
    const result = await authApi.login({ email, password });
    localStorage.setItem('fundsroom_token', result.token);
    localStorage.setItem('fundsroom_user', JSON.stringify(result.user));
    setToken(result.token);
    setUser(result.user);
    return result.user;
  };

  const logout = () => {
    localStorage.removeItem('fundsroom_token');
    localStorage.removeItem('fundsroom_user');
    setToken(null);
    setUser(null);
  };

  const role = user?.role;

  const value: AuthContextType = {
    user,
    token,
    loading,
    login,
    logout,
    isAdmin: role === 'ADMIN',
    isSales: role === 'SALES',
    isWarehouse: role === 'WAREHOUSE',
    isAccounts: role === 'ACCOUNTS',
    canManageCustomers: role === 'ADMIN' || role === 'SALES',
    canViewCustomers: role === 'ADMIN' || role === 'SALES' || role === 'ACCOUNTS',
    canManageProducts: role === 'ADMIN' || role === 'WAREHOUSE',
    canViewProducts: Boolean(user), // All four roles can view products
    canManageChallans: role === 'ADMIN' || role === 'SALES',
    canConfirmChallan: role === 'ADMIN' || role === 'SALES' || role === 'WAREHOUSE',
    canCancelChallan: role === 'ADMIN' || role === 'ACCOUNTS',
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
