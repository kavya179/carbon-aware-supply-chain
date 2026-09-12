import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';

import Layout from './components/layout/Layout';
import Dashboard from './pages/Dashboard';
import Suppliers from './pages/Suppliers';
import Emissions from './pages/Emissions';
import Analytics from './pages/Analytics';
import Recommendations from './pages/Recommendations';
import SubmitData from './pages/SubmitData';
import CsvUpload from './pages/CsvUpload';
import Login from './pages/auth/Login';
import Register from './pages/auth/Register';
import { AuthProvider } from './context/AuthContext';
import ProtectedRoute from './components/auth/ProtectedRoute';

function App() {
  return (
    <AuthProvider>
      <Router>
        <Toaster
          position="top-right"
          toastOptions={{
            style: {
              background: '#0f1f38',
              color: '#e8f4f8',
              border: '1px solid rgba(0, 214, 143, 0.2)',
            },
            success: { iconTheme: { primary: '#00d68f', secondary: '#030f1c' } },
            error: { iconTheme: { primary: '#ef4444', secondary: '#fff' } },
          }}
        />
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          
          <Route path="/" element={<ProtectedRoute><Layout /></ProtectedRoute>}>
            <Route index element={<Dashboard />} />
            <Route path="suppliers" element={<ProtectedRoute allowedRoles={['company_manager', 'auditor']}><Suppliers /></ProtectedRoute>} />
            <Route path="emissions" element={<Emissions />} />
            <Route path="analytics" element={<ProtectedRoute allowedRoles={['company_manager', 'auditor']}><Analytics /></ProtectedRoute>} />
            <Route path="recommendations" element={<Recommendations />} />
            <Route path="submit" element={<ProtectedRoute allowedRoles={['company_manager', 'supplier']}><SubmitData /></ProtectedRoute>} />
            <Route path="submit/upload" element={<ProtectedRoute allowedRoles={['company_manager', 'supplier']}><CsvUpload /></ProtectedRoute>} />
          </Route>
        </Routes>
      </Router>
    </AuthProvider>
  );
}

export default App;
