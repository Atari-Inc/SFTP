import React, { useEffect, useState } from 'react'
import { AlertCircle, LogOut, LogIn } from 'lucide-react'
import { checkAuthStatus } from '@/utils/authCheck'
import { useAuth } from '@/contexts/AuthContext'

const AuthStatusAlert: React.FC = () => {
  const [authStatus, setAuthStatus] = useState<any>(null)
  const { logout } = useAuth()

  useEffect(() => {
    const status = checkAuthStatus()
    setAuthStatus(status)
  }, [])

  if (!authStatus || authStatus.status === 'valid') {
    return null
  }

  const handleLogout = () => {
    logout()
    window.location.href = '/login'
  }

  return (
    <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 mb-4">
      <div className="flex">
        <div className="flex-shrink-0">
          <AlertCircle className="h-5 w-5 text-yellow-400" />
        </div>
        <div className="ml-3">
          <p className="text-sm text-yellow-700">
            {authStatus.message}
          </p>
          <div className="mt-2">
            <button
              onClick={handleLogout}
              className="bg-yellow-100 px-3 py-1 rounded text-yellow-800 hover:bg-yellow-200 transition-colors flex items-center text-sm"
            >
              <LogIn className="h-4 w-4 mr-1" />
              Log In Again
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default AuthStatusAlert