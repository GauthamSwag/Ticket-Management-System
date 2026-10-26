import React, { createContext, useContext, useState, useEffect } from 'react';
import api from '../services/api';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(localStorage.getItem('ticket_token') || null);
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState(null);

  // Initialize and verify user on initial app mount
  useEffect(() => {
    const initAuth = async () => {
      const storedToken = localStorage.getItem('ticket_token');
      if (storedToken) {
        try {
          const res = await api.get('/auth/me');
          if (res.data && res.data.success) {
            setUser(res.data.user);
            localStorage.setItem('ticket_user', JSON.stringify(res.data.user));
          }
        } catch (err) {
          console.error('[AuthContext] Session expired or invalid:', err.message);
          localStorage.removeItem('ticket_token');
          localStorage.removeItem('ticket_user');
          setUser(null);
          setToken(null);
        }
      }
      setLoading(false);
    };

    initAuth();
  }, []);

  // Login handler
  const login = async (email, password) => {
    setAuthError(null);
    try {
      const res = await api.post('/auth/login', { email, password });
      const { token: receivedToken, user: receivedUser } = res.data;

      localStorage.setItem('ticket_token', receivedToken);
      localStorage.setItem('ticket_user', JSON.stringify(receivedUser));

      setToken(receivedToken);
      setUser(receivedUser);
      return { success: true, user: receivedUser };
    } catch (err) {
      const msg = err.response?.data?.message || 'Login failed. Please check your credentials.';
      setAuthError(msg);
      return { success: false, message: msg };
    }
  };

  // Register handler
  const register = async (userData) => {
    setAuthError(null);
    try {
      const res = await api.post('/auth/register', userData);
      const { token: receivedToken, user: receivedUser } = res.data;

      localStorage.setItem('ticket_token', receivedToken);
      localStorage.setItem('ticket_user', JSON.stringify(receivedUser));

      setToken(receivedToken);
      setUser(receivedUser);
      return { success: true, user: receivedUser };
    } catch (err) {
      const msg = err.response?.data?.message || 'Registration failed. Please try again.';
      setAuthError(msg);
      return { success: false, message: msg };
    }
  };

  // Logout handler
  const logout = () => {
    localStorage.removeItem('ticket_token');
    localStorage.removeItem('ticket_user');
    setToken(null);
    setUser(null);
    setAuthError(null);
  };

  // Update profile
  const updateUser = (updatedUser) => {
    setUser(updatedUser);
    localStorage.setItem('ticket_user', JSON.stringify(updatedUser));
  };

  const value = {
    user,
    token,
    loading,
    authError,
    setAuthError,
    isAuthenticated: !!token && !!user,
    role: user?.role || null,
    isAdmin: user?.role === 'admin',
    isAgent: user?.role === 'agent',
    isUser: user?.role === 'user',
    login,
    register,
    logout,
    updateUser,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
