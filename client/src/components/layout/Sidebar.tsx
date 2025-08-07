import React from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import { 
  Home, 
  FolderOpen, 
  Users, 
  Activity, 
  Settings, 
  LogOut,
  Server,
  User,
  BarChart3,
  Terminal
} from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import toast from 'react-hot-toast'

const navigation = [
  { name: 'Dashboard', href: '/dashboard', icon: Home },
  { name: 'File Manager', href: '/files', icon: FolderOpen },
  { name: 'SFTP Server', href: '/sftp', icon: Terminal, requiresSftp: true },
  { name: 'Users', href: '/users', icon: Users, adminOnly: true },
  { name: 'Activity Logs', href: '/activity', icon: Activity },
  { name: 'Analytics', href: '/analytics', icon: BarChart3, adminOnly: true },
  { name: 'Settings', href: '/settings', icon: Settings, adminOnly: true },
]

const Sidebar: React.FC = () => {
  const { user, logout } = useAuth()
  const location = useLocation()

  const filteredNavigation = navigation.filter(item => {
    // Check admin-only items
    if (item.adminOnly && user?.role !== 'admin') {
      return false
    }
    
    // Check SFTP requirement - show for admin or users with SFTP enabled
    if (item.requiresSftp) {
      return user?.role === 'admin' || user?.enable_sftp
    }
    
    return true
  })

  return (
    <div className="flex flex-col w-64 bg-white border-r border-gray-200 h-full">
      <div className="flex items-center justify-center h-16 px-4 border-b border-gray-200">
        <div className="flex items-center">
          <Server className="h-8 w-8 text-primary-600" />
          <span className="ml-2 text-xl font-bold text-gray-900">Atari Files Transfer</span>
        </div>
      </div>

      <div className="flex-1 flex flex-col overflow-y-auto">
        <nav className="flex-1 px-4 py-4 space-y-2">
          {filteredNavigation.map((item) => {
            const Icon = item.icon
            const isActive = location.pathname === item.href || 
              (item.href !== '/dashboard' && location.pathname.startsWith(item.href))
            
            return (
              <NavLink
                key={item.name}
                to={item.href}
                className={`sidebar-link ${isActive ? 'active' : ''}`}
              >
                <Icon className="h-5 w-5 mr-3" />
                {item.name}
              </NavLink>
            )
          })}
        </nav>

        <div className="px-4 py-4 border-t border-gray-200">
          <div className="flex items-center mb-4">
            <div className="h-8 w-8 bg-primary-600 rounded-full flex items-center justify-center">
              <User className="h-4 w-4 text-white" />
            </div>
            <div className="ml-3">
              <p className="text-sm font-medium text-gray-900">{user?.username}</p>
              <p className="text-xs text-gray-500 capitalize">{user?.role}</p>
            </div>
          </div>
          
          <button
            onClick={logout}
            className="flex items-center w-full px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <LogOut className="h-4 w-4 mr-3" />
            Sign out
          </button>
        </div>
      </div>
    </div>
  )
}

export default Sidebar