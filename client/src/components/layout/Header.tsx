import React, { useState } from 'react'
import { Bell, Search, Menu } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'

interface HeaderProps {
  onMenuClick?: () => void
  title?: string
}

const Header: React.FC<HeaderProps> = ({ onMenuClick, title }) => {
  const [searchQuery, setSearchQuery] = useState('')
  const { user } = useAuth()

  return (
    <header className="bg-white border-b border-gray-200 px-6 py-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center">
          {onMenuClick && (
            <button
              onClick={onMenuClick}
              className="mr-4 p-2 rounded-md text-gray-600 hover:bg-gray-100 lg:hidden"
            >
              <Menu className="h-5 w-5" />
            </button>
          )}
          
          {title && (
            <h1 className="text-2xl font-semibold text-gray-900">{title}</h1>
          )}
        </div>

        <div className="flex items-center space-x-4">
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Search className="h-4 w-4 text-gray-400" />
            </div>
            <input
              type="text"
              placeholder="Search..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="block w-64 pl-10 pr-3 py-2 border border-gray-300 rounded-md leading-5 bg-white placeholder-gray-500 focus:outline-none focus:placeholder-gray-400 focus:ring-1 focus:ring-primary-500 focus:border-primary-500 text-sm"
            />
          </div>

          <button className="relative p-2 text-gray-600 hover:bg-gray-100 rounded-md">
            <Bell className="h-5 w-5" />
            <span className="absolute top-1 right-1 block h-2 w-2 rounded-full bg-red-400"></span>
          </button>

          <div className="flex items-center">
            <div className="h-8 w-8 bg-primary-600 rounded-full flex items-center justify-center">
              <span className="text-sm font-medium text-white">
                {user?.username.charAt(0).toUpperCase()}
              </span>
            </div>
          </div>
        </div>
      </div>
    </header>
  )
}

export default Header