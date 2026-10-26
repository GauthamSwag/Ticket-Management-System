import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { SocketProvider } from './context/SocketContext';
import { ToastProvider } from './context/ToastContext';

import Navbar from './components/Navbar';
import ProtectedRoute from './components/ProtectedRoute';

import Home from './pages/Home';
import Login from './pages/Login';
import Register from './pages/Register';
import Dashboard from './pages/Dashboard';
import Profile from './pages/Profile';
import Tickets from './pages/Tickets';
import CreateTicket from './pages/CreateTicket';
import TicketDetails from './pages/TicketDetails';
import Analytics from './pages/Analytics';
import AdminSLA from './pages/AdminSLA';
import UserManagement from './pages/UserManagement';
import AgentManagement from './pages/AgentManagement';
import Notifications from './pages/Notifications';
import NotFound from './pages/NotFound';

function App() {
  return (
    <Router>
      <AuthProvider>
        <SocketProvider>
          <ToastProvider>
            <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
              <Navbar />
              <main style={{ flex: 1 }}>
                <Routes>
                  {/* Public Routes */}
                  <Route path="/" element={<Home />} />
                  <Route path="/login" element={<Login />} />
                  <Route path="/register" element={<Register />} />

                  {/* Protected Authenticated Routes */}
                  <Route
                    path="/dashboard"
                    element={
                      <ProtectedRoute>
                        <Dashboard />
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/tickets"
                    element={
                      <ProtectedRoute>
                        <Tickets />
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/tickets/create"
                    element={
                      <ProtectedRoute>
                        <CreateTicket />
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/tickets/:id"
                    element={
                      <ProtectedRoute>
                        <TicketDetails />
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/admin/users"
                    element={
                      <ProtectedRoute allowedRoles={['admin']}>
                        <UserManagement />
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/admin/agents"
                    element={
                      <ProtectedRoute allowedRoles={['admin']}>
                        <AgentManagement />
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/analytics"
                    element={
                      <ProtectedRoute allowedRoles={['admin']}>
                        <Analytics />
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/admin/sla"
                    element={
                      <ProtectedRoute allowedRoles={['admin']}>
                        <AdminSLA />
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/notifications"
                    element={
                      <ProtectedRoute>
                        <Notifications />
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/profile"
                    element={
                      <ProtectedRoute>
                        <Profile />
                      </ProtectedRoute>
                    }
                  />

                  {/* 404 Catch-All */}
                  <Route path="/404" element={<NotFound />} />
                  <Route path="*" element={<Navigate to="/404" replace />} />
                </Routes>
              </main>
              <footer className="footer">
                <div className="container">
                  TicketFlow &bull; Enterprise Ticket Management System &bull; Production Ready
                </div>
              </footer>
            </div>
          </ToastProvider>
        </SocketProvider>
      </AuthProvider>
    </Router>
  );
}

export default App;
