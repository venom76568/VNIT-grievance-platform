import { useState, useEffect, createContext, useContext } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { Toaster, toast } from 'sonner';
import '@/App.css';
import Login from '@/pages/Auth/Login';
import Register from '@/pages/Auth/Register';
import StudentDashboard from '@/pages/Student/Dashboard';
import AdminDashboard from '@/pages/Admin/Dashboard';
import WorkerDashboard from '@/pages/Worker/Dashboard';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

// Auth Context
const AuthContext = createContext(null);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [token, setToken] = useState(localStorage.getItem('token'));

  useEffect(() => {
    if (token) {
      axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
      fetchUser();
    } else {
      setLoading(false);
    }
  }, [token]);

  const fetchUser = async () => {
    try {
      const response = await axios.get(`${API}/auth/me`);
      setUser(response.data);
    } catch (error) {
      localStorage.removeItem('token');
      setToken(null);
      delete axios.defaults.headers.common['Authorization'];
    } finally {
      setLoading(false);
    }
  };

  const login = async (email, password) => {
    try {
      const response = await axios.post(`${API}/auth/login`, { email, password });
      const { token, user } = response.data;
      localStorage.setItem('token', token);
      setToken(token);
      axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
      setUser(user);
      toast.success('Login successful!');
      return user;
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Login failed');
      throw error;
    }
  };

  const register = async (userData) => {
    try {
      const response = await axios.post(`${API}/auth/register`, userData);
      const { token, user } = response.data;
      localStorage.setItem('token', token);
      setToken(token);
      axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
      setUser(user);
      toast.success('Registration successful!');
      return user;
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Registration failed');
      throw error;
    }
  };

  const logout = () => {
    localStorage.removeItem('token');
    setToken(null);
    setUser(null);
    delete axios.defaults.headers.common['Authorization'];
    toast.success('Logged out successfully');
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

const ProtectedRoute = ({ children, role }) => {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 via-white to-green-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (role && user.role !== role) {
    return <Navigate to="/" replace />;
  }

  return children;
};

const AppRoutes = () => {
  const { user } = useAuth();

  return (
    <Routes>
      <Route path="/login" element={!user ? <Login /> : <Navigate to="/" replace />} />
      <Route path="/register" element={!user ? <Register /> : <Navigate to="/" replace />} />
      
      <Route
        path="/"
        element={
          <ProtectedRoute>
            {user?.role === 'resident' && <Navigate to="/student/dashboard" replace />}
            {user?.role === 'admin' && <Navigate to="/admin/dashboard" replace />}
            {user?.role === 'worker' && <Navigate to="/worker/dashboard" replace />}
          </ProtectedRoute>
        }
      />
      
      <Route
        path="/student/dashboard"
        element={
          <ProtectedRoute role="resident">
            <StudentDashboard />
          </ProtectedRoute>
        }
      />
      
      <Route
        path="/admin/dashboard"
        element={
          <ProtectedRoute role="admin">
            <AdminDashboard />
          </ProtectedRoute>
        }
      />
      
      <Route
        path="/worker/dashboard"
        element={
          <ProtectedRoute role="worker">
            <WorkerDashboard />
          </ProtectedRoute>
        }
      />
    </Routes>
  );
};

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppRoutes />
        <Toaster position="top-right" richColors />
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;