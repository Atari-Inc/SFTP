import React from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import ProtectedRoute from '@/components/auth/ProtectedRoute'
import Login from '@/components/auth/Login'
import DashboardLayout from '@/components/layout/DashboardLayout'
import Dashboard from '@/pages/Dashboard'
import FileManager from '@/pages/FileManager'
import EnhancedFileManager from '@/pages/EnhancedFileManager'
import UnifiedFileManager from '@/pages/UnifiedFileManager'
import SftpServer from '@/pages/SftpServer'
import Users from '@/pages/Users'
import ActivityLogs from '@/pages/ActivityLogs'
import Profile from '@/pages/Profile'
import LoadingSpinner from '@/components/ui/LoadingSpinner'

const App: React.FC = () => {
  const { isLoading } = useAuth()

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <LoadingSpinner size="lg" />
      </div>
    )
  }

  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      
      <Route
        path="/*"
        element={
          <ProtectedRoute>
            <DashboardLayout />
          </ProtectedRoute>
        }
      >
        <Route index element={<Navigate to="/dashboard" replace />} />
        <Route path="dashboard" element={<Dashboard />} />
        <Route path="files" element={<EnhancedFileManager />} />
        <Route path="files-basic" element={<FileManager />} />
        <Route path="sftp" element={<SftpServer />} />
        <Route path="users" element={
          <ProtectedRoute requiredRole="admin">
            <Users />
          </ProtectedRoute>
        } />
        <Route path="activity" element={<ActivityLogs />} />
        <Route path="profile" element={<Profile />} />
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Route>
    </Routes>
  )
}

export default App