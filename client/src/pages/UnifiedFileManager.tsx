import React, { useEffect, useState } from 'react'
import { 
  Server, 
  Database, 
  ToggleLeft, 
  ToggleRight,
  Wifi,
  WifiOff,
  Settings,
  AlertCircle,
  CheckCircle,
  Info
} from 'lucide-react'
import { useSftpFiles } from '@/contexts/SftpFileContext'
import { useFiles } from '@/contexts/FileContext'
import { useAuth } from '@/contexts/AuthContext'
import EnhancedFileManager from './EnhancedFileManager'
import Button from '@/components/ui/Button'
import Modal from '@/components/ui/Modal'
import toast from 'react-hot-toast'

const UnifiedFileManager: React.FC = () => {
  const { user } = useAuth()
  const sftpContext = useSftpFiles()
  const s3Context = useFiles()
  
  const [showConnectionModal, setShowConnectionModal] = useState(false)
  const [connectionForm, setConnectionForm] = useState({
    host: '',
    port: 22,
    username: user?.username || ''
  })

  const {
    isInSftpMode,
    toggleSftpMode,
    activeConnection,
    isConnecting,
    connectToSftp,
    disconnectFromSftp
  } = sftpContext

  // Use the appropriate context based on mode
  const currentContext = isInSftpMode ? sftpContext : s3Context

  const handleConnectSftp = async () => {
    if (!connectionForm.host || !connectionForm.username) {
      toast.error('Host and username are required')
      return
    }

    try {
      await connectToSftp(connectionForm.host, connectionForm.port, connectionForm.username)
      setShowConnectionModal(false)
      setConnectionForm({ host: '', port: 22, username: user?.username || '' })
    } catch (error) {
      // Error is handled in the context
    }
  }

  const handleDisconnect = async () => {
    if (activeConnection) {
      await disconnectFromSftp(activeConnection)
    }
  }

  const handleToggleMode = () => {
    if (isInSftpMode && activeConnection) {
      // If switching away from SFTP mode while connected, ask for confirmation
      if (confirm('This will disconnect your SFTP connection. Continue?')) {
        toggleSftpMode()
      }
    } else {
      toggleSftpMode()
    }
  }

  return (
    <div className="space-y-6">
      {/* Mode Selection Header */}
      <div className="bg-gradient-to-r from-blue-600 to-purple-600 rounded-xl p-6 text-white">
        <div className="flex justify-between items-start">
          <div>
            <h1 className="text-3xl font-bold mb-2">Unified File Manager</h1>
            <p className="text-blue-100">
              {isInSftpMode ? 'SFTP Server File Management' : 'AWS S3 File Management'}
            </p>
          </div>
          <div className="flex items-center space-x-4">
            {/* Mode Toggle */}
            <div className="bg-white/20 backdrop-blur rounded-lg p-4">
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm font-medium">Storage Mode</span>
                <button
                  onClick={handleToggleMode}
                  className="flex items-center space-x-2 hover:bg-white/10 rounded p-1 transition-colors"
                >
                  {isInSftpMode ? (
                    <ToggleRight className="h-6 w-6 text-green-300" />
                  ) : (
                    <ToggleLeft className="h-6 w-6 text-gray-300" />
                  )}
                </button>
              </div>
              <div className="flex items-center space-x-3">
                <div className="flex items-center space-x-2">
                  <Database className={`h-4 w-4 ${!isInSftpMode ? 'text-green-300' : 'text-gray-400'}`} />
                  <span className={`text-xs ${!isInSftpMode ? 'text-white' : 'text-gray-300'}`}>S3</span>
                </div>
                <div className="flex items-center space-x-2">
                  <Server className={`h-4 w-4 ${isInSftpMode ? 'text-green-300' : 'text-gray-400'}`} />
                  <span className={`text-xs ${isInSftpMode ? 'text-white' : 'text-gray-300'}`}>SFTP</span>
                </div>
              </div>
            </div>

            {/* Connection Status */}
            <div className="bg-white/20 backdrop-blur rounded-lg p-4">
              <div className="flex items-center space-x-2 mb-2">
                {isInSftpMode ? (
                  activeConnection ? (
                    <>
                      <CheckCircle className="h-5 w-5 text-green-300" />
                      <span className="text-sm font-medium">Connected</span>
                    </>
                  ) : (
                    <>
                      <WifiOff className="h-5 w-5 text-red-300" />
                      <span className="text-sm font-medium">Disconnected</span>
                    </>
                  )
                ) : (
                  <>
                    <Database className="h-5 w-5 text-green-300" />
                    <span className="text-sm font-medium">S3 Ready</span>
                  </>
                )}
              </div>
              <div className="flex items-center space-x-2">
                {isInSftpMode ? (
                  activeConnection ? (
                    <Button
                      onClick={handleDisconnect}
                      variant="outline"
                      size="sm"
                      className="bg-white/10 hover:bg-white/20 border-white/20"
                    >
                      <WifiOff className="h-3 w-3 mr-1" />
                      Disconnect
                    </Button>
                  ) : (
                    <Button
                      onClick={() => setShowConnectionModal(true)}
                      variant="outline"
                      size="sm"
                      className="bg-white/10 hover:bg-white/20 border-white/20"
                      disabled={isConnecting}
                    >
                      <Wifi className="h-3 w-3 mr-1" />
                      {isConnecting ? 'Connecting...' : 'Connect'}
                    </Button>
                  )
                ) : (
                  <Button
                    variant="outline"
                    size="sm"
                    className="bg-white/10 hover:bg-white/20 border-white/20"
                  >
                    <Settings className="h-3 w-3 mr-1" />
                    S3 Config
                  </Button>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Connection Status Alert */}
      {isInSftpMode && !activeConnection && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <div className="flex items-center">
            <AlertCircle className="h-5 w-5 text-yellow-600 mr-3" />
            <div>
              <h3 className="text-sm font-medium text-yellow-800">SFTP Connection Required</h3>
              <p className="text-sm text-yellow-700 mt-1">
                You need to establish an SFTP connection to view and manage files in SFTP mode.
              </p>
            </div>
            <Button
              onClick={() => setShowConnectionModal(true)}
              className="ml-auto"
              size="sm"
            >
              Connect to SFTP
            </Button>
          </div>
        </div>
      )}

      {/* Info Alert for SFTP Features */}
      {isInSftpMode && activeConnection && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="flex items-center">
            <Info className="h-5 w-5 text-blue-600 mr-3" />
            <div>
              <h3 className="text-sm font-medium text-blue-800">SFTP Mode Active</h3>
              <p className="text-sm text-blue-700 mt-1">
                You're now managing files through SFTP. All operations will be performed on the remote server.
                Some advanced features may have limited functionality in SFTP mode.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* File Manager Component */}
      {(isInSftpMode && activeConnection) || !isInSftpMode ? (
        <div>
          {/* Pass the appropriate context to the file manager */}
          <EnhancedFileManager />
        </div>
      ) : (
        <div className="bg-white rounded-lg shadow-sm min-h-[500px] flex items-center justify-center">
          <div className="text-center text-gray-500">
            <Server className="h-16 w-16 mx-auto mb-4 text-gray-300" />
            <h3 className="text-lg font-medium mb-2">No SFTP Connection</h3>
            <p className="text-sm mb-4">Connect to an SFTP server to start managing files</p>
            <Button onClick={() => setShowConnectionModal(true)}>
              <Wifi className="h-4 w-4 mr-2" />
              Connect to SFTP Server
            </Button>
          </div>
        </div>
      )}

      {/* SFTP Connection Modal */}
      <Modal
        isOpen={showConnectionModal}
        onClose={() => setShowConnectionModal(false)}
        title="Connect to SFTP Server"
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Host / Server Address
            </label>
            <input
              type="text"
              value={connectionForm.host}
              onChange={(e) => setConnectionForm(prev => ({ ...prev, host: e.target.value }))}
              placeholder="sftp.example.com or 192.168.1.100"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              autoFocus
            />
            <p className="text-xs text-gray-500 mt-1">
              For AWS Transfer Family: {import.meta.env.VITE_TRANSFER_SERVER_ID || 's-xxxxxxxxx'}.server.transfer.{import.meta.env.VITE_AWS_REGION || 'us-east-1'}.amazonaws.com
            </p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Port
              </label>
              <input
                type="number"
                value={connectionForm.port}
                onChange={(e) => setConnectionForm(prev => ({ ...prev, port: parseInt(e.target.value) || 22 }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Username
              </label>
              <input
                type="text"
                value={connectionForm.username}
                onChange={(e) => setConnectionForm(prev => ({ ...prev, username: e.target.value }))}
                placeholder="your-username"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          </div>

          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
            <div className="flex items-start">
              <AlertCircle className="h-4 w-4 text-yellow-600 mt-0.5 mr-2" />
              <div className="text-xs text-yellow-800">
                <strong>Authentication:</strong> This connection uses your stored SSH private key for authentication.
                Make sure your public key is configured on the SFTP server.
              </div>
            </div>
          </div>

          <div className="flex justify-end space-x-2 pt-4 border-t">
            <Button
              variant="outline"
              onClick={() => setShowConnectionModal(false)}
            >
              Cancel
            </Button>
            <Button
              onClick={handleConnectSftp}
              disabled={isConnecting || !connectionForm.host || !connectionForm.username}
            >
              {isConnecting ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  Connecting...
                </>
              ) : (
                <>
                  <Wifi className="h-4 w-4 mr-2" />
                  Connect
                </>
              )}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}

export default UnifiedFileManager