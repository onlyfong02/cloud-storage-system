import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from '@/contexts/AuthContext';
import { ProtectedRoute } from '@/components/ProtectedRoute';
import { Toaster } from 'sonner';
import './i18n';
import LoginPage from '@/pages/Login';
import RegisterPage from '@/pages/Register';
import Dashboard from '@/pages/Dashboard';
import AdminPage from '@/pages/Admin';
import { UploadManager } from './components/UploadManager';

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <UploadManager />
        <Toaster
          position="top-center"
          expand={true}
          richColors
          theme="light"
          toastOptions={{
            style: {
              borderRadius: '0',
              border: '2px solid black',
              boxShadow: '4px 4px 0px 0px rgba(0,0,0,1)',
              fontSize: '1rem',
              fontWeight: '600',
            },
            className: 'font-bold',
          }}
        />
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
          <Route
            path="/dashboard"
            element={
              <ProtectedRoute>
                <Dashboard />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin"
            element={
              <ProtectedRoute requireAdmin>
                <AdminPage />
              </ProtectedRoute>
            }
          />
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;
