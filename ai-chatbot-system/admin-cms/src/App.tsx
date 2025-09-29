import { useState, useEffect } from 'react';
import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { Layout } from 'antd';
import Sidebar from './components/Layout/Sidebar';
import Header from './components/Layout/Header';
import Dashboard from './pages/Dashboard';
import Documents from './pages/Documents';
import Training from './pages/Training';
import Upload from './pages/Upload';
import Conversations from './pages/Conversations';
import Settings from './pages/Settings';
import Login from './pages/Login';
import { useAuth } from './hooks/useAuth';

const { Content } = Layout;

function App() {
  const [collapsed, setCollapsed] = useState(false);
  const { isAuthenticated } = useAuth();
  const location = useLocation();

  // Check if user has a token on mount
  useEffect(() => {
    const token = localStorage.getItem('authToken');
    if (token && location.pathname === '/') {
      window.location.href = '/dashboard';
    }
  }, [location]);

  if (!isAuthenticated) {
    return <Login />;
  }

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Sidebar collapsed={collapsed} />
      <Layout>
        <Header collapsed={collapsed} setCollapsed={setCollapsed} />
        <Content
          style={{
            margin: '24px 16px',
            padding: 24,
            minHeight: 280,
            background: '#fff',
            borderRadius: 8,
          }}
        >
          <Routes>
            <Route path="/" element={<Navigate to="/dashboard" />} />
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/documents" element={<Documents />} />
            <Route path="/training" element={<Training />} />
            <Route path="/upload" element={<Upload />} />
            <Route path="/conversations" element={<Conversations />} />
            <Route path="/settings" element={<Settings />} />
          </Routes>
        </Content>
      </Layout>
    </Layout>
  );
}

export default App;