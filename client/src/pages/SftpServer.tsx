import React, { useState, useEffect } from 'react'
import { 
  Server, 
  Play, 
  Square, 
  RefreshCw, 
  Users, 
  FolderOpen, 
  Upload, 
  Download, 
  Terminal,
  Key,
  Activity,
  Settings,
  CheckCircle,
  XCircle,
  AlertCircle,
  Copy,
  Eye,
  EyeOff,
  Wifi,
  WifiOff,
  Monitor,
  HardDrive,
  Clock,
  User
} from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import toast from 'react-hot-toast'

interface SftpConnection {
  id: string
  host: string
  port: number
  username: string
  status: 'connected' | 'disconnected' | 'error' | 'connecting'
  lastConnected?: string
  bytesTransferred: number
  filesTransferred: number
}

interface SftpServerStats {
  status: 'online' | 'offline' | 'maintenance'
  uptime: string
  activeConnections: number
  totalConnections: number
  bytesTransferred: string
  filesTransferred: number
  lastActivity: string
}

interface SftpUser {
  id: string
  username: string
  status: 'active' | 'inactive'
  lastLogin?: string
  publicKey: string
  homeDirectory: string
  permissions: string[]
}

const SftpServer: React.FC = () => {
  const { user } = useAuth()
  const [activeTab, setActiveTab] = useState<'overview' | 'connections' | 'users' | 'files' | 'logs'>('overview')
  const [serverStats, setServerStats] = useState<SftpServerStats>({
    status: 'online',
    uptime: '2d 14h 32m',
    activeConnections: 3,
    totalConnections: 127,
    bytesTransferred: '2.4 GB',
    filesTransferred: 486,
    lastActivity: '2 minutes ago'
  })
  const [connections, setConnections] = useState<SftpConnection[]>([
    {
      id: '1',
      host: '192.168.1.100',
      port: 22,
      username: 'admin',
      status: 'connected',
      lastConnected: '2024-01-15 10:30:00',
      bytesTransferred: 1024000,
      filesTransferred: 15
    }
  ])
  const [sftpUsers, setSftpUsers] = useState<SftpUser[]>([])
  const [showPrivateKey, setShowPrivateKey] = useState(false)
  const [isConnecting, setIsConnecting] = useState(false)
  const [connectionForm, setConnectionForm] = useState({
    host: '',
    port: 22,
    username: '',
    privateKey: ''
  })

  useEffect(() => {
    fetchSftpUsers()
  }, [])

  const fetchSftpUsers = async () => {
    // Mock data for now - will be replaced with actual API call
    setSftpUsers([
      {
        id: '1',
        username: user?.username || 'admin',
        status: 'active',
        lastLogin: '2024-01-15 10:30:00',
        publicKey: 'ssh-rsa AAAAB3NzaC1yc2EAAAADAQABAAABgQC...',
        homeDirectory: `/home/${user?.username}`,
        permissions: ['read', 'write', 'execute']
      }
    ])
  }

  const handleStartServer = () => {
    toast.success('SFTP Server started successfully')
    setServerStats(prev => ({ ...prev, status: 'online' }))
  }

  const handleStopServer = () => {
    toast.success('SFTP Server stopped')
    setServerStats(prev => ({ ...prev, status: 'offline' }))
  }

  const handleConnectSftp = async () => {
    setIsConnecting(true)
    try {
      // Simulate connection attempt
      await new Promise(resolve => setTimeout(resolve, 2000))
      
      const newConnection: SftpConnection = {
        id: Date.now().toString(),
        host: connectionForm.host,
        port: connectionForm.port,
        username: connectionForm.username,
        status: 'connected',
        lastConnected: new Date().toLocaleString(),
        bytesTransferred: 0,
        filesTransferred: 0
      }
      
      setConnections(prev => [...prev, newConnection])
      toast.success(`Connected to ${connectionForm.host}:${connectionForm.port}`)
      setConnectionForm({ host: '', port: 22, username: '', privateKey: '' })
    } catch (error) {
      toast.error('Failed to connect to SFTP server')
    }
    setIsConnecting(false)
  }

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text)
    toast.success('Copied to clipboard')
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'online':
      case 'connected':
      case 'active':
        return 'text-green-600 bg-green-100'
      case 'offline':
      case 'disconnected':
      case 'inactive':
        return 'text-red-600 bg-red-100'
      case 'maintenance':
      case 'connecting':
        return 'text-yellow-600 bg-yellow-100'
      default:
        return 'text-gray-600 bg-gray-100'
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'online':
      case 'connected':
      case 'active':
        return <CheckCircle className="h-4 w-4" />
      case 'offline':
      case 'disconnected':
      case 'inactive':
        return <XCircle className="h-4 w-4" />
      case 'maintenance':
      case 'connecting':
        return <AlertCircle className="h-4 w-4" />
      default:
        return <AlertCircle className="h-4 w-4" />
    }
  }

  const tabs = [
    { id: 'overview', name: 'Overview', icon: Monitor },
    { id: 'connections', name: 'Connections', icon: Wifi },
    { id: 'users', name: 'SFTP Users', icon: Users },
    { id: 'files', name: 'File Browser', icon: FolderOpen },
    { id: 'logs', name: 'Activity Logs', icon: Activity },
  ]

  const isAdmin = user?.role === 'admin'

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 flex items-center">
                <Terminal className="h-8 w-8 mr-3 text-primary-600" />
                SFTP Server Management
              </h1>
              <p className="mt-2 text-gray-600">
                Manage your SFTP server connections, users, and file transfers
              </p>
            </div>
            
            {isAdmin && (
              <div className="flex space-x-3">
                <button
                  onClick={handleStartServer}
                  disabled={serverStats.status === 'online'}
                  className="flex items-center px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  <Play className="h-4 w-4 mr-2" />
                  Start Server
                </button>
                <button
                  onClick={handleStopServer}
                  disabled={serverStats.status === 'offline'}
                  className="flex items-center px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  <Square className="h-4 w-4 mr-2" />
                  Stop Server
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Server Status Card */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-8">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900 flex items-center">
              <Server className="h-5 w-5 mr-2" />
              Server Status
            </h2>
            <div className={`flex items-center px-3 py-1 rounded-full text-sm font-medium ${getStatusColor(serverStats.status)}`}>
              {getStatusIcon(serverStats.status)}
              <span className="ml-1 capitalize">{serverStats.status}</span>
            </div>
          </div>
          
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-gray-900">{serverStats.uptime}</div>
              <div className="text-sm text-gray-500">Uptime</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-gray-900">{serverStats.activeConnections}</div>
              <div className="text-sm text-gray-500">Active</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-gray-900">{serverStats.totalConnections}</div>
              <div className="text-sm text-gray-500">Total Connections</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-gray-900">{serverStats.bytesTransferred}</div>
              <div className="text-sm text-gray-500">Data Transferred</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-gray-900">{serverStats.filesTransferred}</div>
              <div className="text-sm text-gray-500">Files Transferred</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-gray-900">{serverStats.lastActivity}</div>
              <div className="text-sm text-gray-500">Last Activity</div>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200">
          <div className="border-b border-gray-200">
            <nav className="flex space-x-8 px-6">
              {tabs.map((tab) => {
                const Icon = tab.icon
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id as any)}
                    className={`flex items-center py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                      activeTab === tab.id
                        ? 'border-primary-500 text-primary-600'
                        : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                    }`}
                  >
                    <Icon className="h-4 w-4 mr-2" />
                    {tab.name}
                  </button>
                )
              })}
            </nav>
          </div>

          <div className="p-6">
            {/* Overview Tab */}
            {activeTab === 'overview' && (
              <div className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {/* Quick Actions */}
                  <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-lg p-6">
                    <h3 className="text-lg font-semibold text-gray-900 mb-4">Quick Actions</h3>
                    <div className="space-y-3">
                      <button className="w-full flex items-center justify-center px-4 py-2 bg-white border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors">
                        <RefreshCw className="h-4 w-4 mr-2" />
                        Refresh Status
                      </button>
                      <button className="w-full flex items-center justify-center px-4 py-2 bg-white border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors">
                        <Settings className="h-4 w-4 mr-2" />
                        Server Settings
                      </button>
                    </div>
                  </div>

                  {/* Connection Info */}
                  <div className="bg-gradient-to-br from-green-50 to-green-100 rounded-lg p-6">
                    <h3 className="text-lg font-semibold text-gray-900 mb-4">Connection Details</h3>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-gray-600">Host:</span>
                        <span className="font-medium">localhost</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">Port:</span>
                        <span className="font-medium">22</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">Protocol:</span>
                        <span className="font-medium">SFTP/SSH</span>
                      </div>
                    </div>
                  </div>

                  {/* SSH Key Info */}
                  <div className="bg-gradient-to-br from-purple-50 to-purple-100 rounded-lg p-6">
                    <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                      <Key className="h-5 w-5 mr-2" />
                      SSH Key Status
                    </h3>
                    <div className="space-y-2">
                      <div className="flex items-center text-green-600">
                        <CheckCircle className="h-4 w-4 mr-2" />
                        <span className="text-sm">Public key configured</span>
                      </div>
                      <div className="flex items-center text-green-600">
                        <CheckCircle className="h-4 w-4 mr-2" />
                        <span className="text-sm">Private key stored securely</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Recent Activity */}
                <div className="bg-gray-50 rounded-lg p-6">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                    <Clock className="h-5 w-5 mr-2" />
                    Recent Activity
                  </h3>
                  <div className="space-y-3">
                    {[
                      { action: 'File uploaded', file: 'document.pdf', time: '2 minutes ago', user: 'admin' },
                      { action: 'Connection established', file: 'from 192.168.1.100', time: '5 minutes ago', user: 'john.doe' },
                      { action: 'File downloaded', file: 'backup.zip', time: '10 minutes ago', user: 'admin' },
                    ].map((activity, index) => (
                      <div key={index} className="flex items-center justify-between py-2 px-3 bg-white rounded border">
                        <div className="flex items-center">
                          <User className="h-4 w-4 text-gray-400 mr-3" />
                          <div>
                            <span className="text-sm font-medium text-gray-900">{activity.action}</span>
                            <span className="text-sm text-gray-600 ml-1">- {activity.file}</span>
                          </div>
                        </div>
                        <div className="text-xs text-gray-500">
                          <div>{activity.user}</div>
                          <div>{activity.time}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Connections Tab */}
            {activeTab === 'connections' && (
              <div className="space-y-6">
                {/* New Connection Form */}
                <div className="bg-gray-50 rounded-lg p-6">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">New SFTP Connection</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    <input
                      type="text"
                      placeholder="Host"
                      value={connectionForm.host}
                      onChange={(e) => setConnectionForm(prev => ({ ...prev, host: e.target.value }))}
                      className="input-field"
                    />
                    <input
                      type="number"
                      placeholder="Port"
                      value={connectionForm.port}
                      onChange={(e) => setConnectionForm(prev => ({ ...prev, port: parseInt(e.target.value) }))}
                      className="input-field"
                    />
                    <input
                      type="text"
                      placeholder="Username"
                      value={connectionForm.username}
                      onChange={(e) => setConnectionForm(prev => ({ ...prev, username: e.target.value }))}
                      className="input-field"
                    />
                    <button
                      onClick={handleConnectSftp}
                      disabled={isConnecting || !connectionForm.host || !connectionForm.username}
                      className="btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {isConnecting ? (
                        <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                      ) : (
                        <Wifi className="h-4 w-4 mr-2" />
                      )}
                      Connect
                    </button>
                  </div>
                </div>

                {/* Active Connections */}
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">Active Connections</h3>
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Connection
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Status
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Last Connected
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Data Transfer
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Actions
                          </th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {connections.map((connection) => (
                          <tr key={connection.id}>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <div className="text-sm font-medium text-gray-900">
                                {connection.username}@{connection.host}:{connection.port}
                              </div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <div className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(connection.status)}`}>
                                {getStatusIcon(connection.status)}
                                <span className="ml-1 capitalize">{connection.status}</span>
                              </div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                              {connection.lastConnected || 'Never'}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                              <div>{(connection.bytesTransferred / 1024).toFixed(1)} KB</div>
                              <div className="text-xs">{connection.filesTransferred} files</div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                              <button className="text-red-600 hover:text-red-900">
                                <WifiOff className="h-4 w-4" />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}

            {/* SFTP Users Tab */}
            {activeTab === 'users' && (
              <div className="space-y-6">
                <div className="flex justify-between items-center">
                  <h3 className="text-lg font-semibold text-gray-900">SFTP Users</h3>
                  {isAdmin && (
                    <button className="btn-primary">
                      <Users className="h-4 w-4 mr-2" />
                      Add SFTP User
                    </button>
                  )}
                </div>

                <div className="grid gap-6">
                  {sftpUsers.map((sftpUser) => (
                    <div key={sftpUser.id} className="bg-white border border-gray-200 rounded-lg p-6">
                      <div className="flex justify-between items-start mb-4">
                        <div>
                          <h4 className="text-lg font-medium text-gray-900">{sftpUser.username}</h4>
                          <div className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(sftpUser.status)} mt-1`}>
                            {getStatusIcon(sftpUser.status)}
                            <span className="ml-1 capitalize">{sftpUser.status}</span>
                          </div>
                        </div>
                        <div className="text-sm text-gray-500">
                          Last login: {sftpUser.lastLogin || 'Never'}
                        </div>
                      </div>

                      <div className="space-y-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">Home Directory</label>
                          <div className="flex items-center space-x-2">
                            <input
                              type="text"
                              value={sftpUser.homeDirectory}
                              readOnly
                              className="input-field flex-1"
                            />
                            <button
                              onClick={() => copyToClipboard(sftpUser.homeDirectory)}
                              className="p-2 text-gray-400 hover:text-gray-600"
                            >
                              <Copy className="h-4 w-4" />
                            </button>
                          </div>
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">SSH Public Key</label>
                          <div className="flex items-center space-x-2">
                            <input
                              type="text"
                              value={sftpUser.publicKey}
                              readOnly
                              className="input-field flex-1 font-mono text-xs"
                            />
                            <button
                              onClick={() => copyToClipboard(sftpUser.publicKey)}
                              className="p-2 text-gray-400 hover:text-gray-600"
                            >
                              <Copy className="h-4 w-4" />
                            </button>
                          </div>
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">Permissions</label>
                          <div className="flex flex-wrap gap-2">
                            {sftpUser.permissions.map((permission) => (
                              <span
                                key={permission}
                                className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800"
                              >
                                {permission}
                              </span>
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* File Browser Tab */}
            {activeTab === 'files' && (
              <div className="space-y-6">
                <div className="flex justify-between items-center">
                  <h3 className="text-lg font-semibold text-gray-900">Remote File Browser</h3>
                  <div className="flex space-x-2">
                    <button className="btn-secondary">
                      <Upload className="h-4 w-4 mr-2" />
                      Upload
                    </button>
                    <button className="btn-secondary">
                      <Download className="h-4 w-4 mr-2" />
                      Download
                    </button>
                  </div>
                </div>

                <div className="bg-gray-50 rounded-lg p-4">
                  <div className="text-center text-gray-500 py-12">
                    <FolderOpen className="h-12 w-12 mx-auto mb-4 text-gray-400" />
                    <p>Select an active SFTP connection to browse files</p>
                  </div>
                </div>
              </div>
            )}

            {/* Activity Logs Tab */}
            {activeTab === 'logs' && (
              <div className="space-y-6">
                <div className="flex justify-between items-center">
                  <h3 className="text-lg font-semibold text-gray-900">SFTP Activity Logs</h3>
                  <button className="btn-secondary">
                    <RefreshCw className="h-4 w-4 mr-2" />
                    Refresh
                  </button>
                </div>

                <div className="bg-white border border-gray-200 rounded-lg">
                  <div className="p-4 border-b border-gray-200">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <input
                        type="text"
                        placeholder="Filter by user..."
                        className="input-field"
                      />
                      <select className="input-field">
                        <option value="">All actions</option>
                        <option value="connect">Connect</option>
                        <option value="disconnect">Disconnect</option>
                        <option value="upload">Upload</option>
                        <option value="download">Download</option>
                      </select>
                      <input
                        type="date"
                        className="input-field"
                      />
                    </div>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Timestamp
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            User
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Action
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Details
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            IP Address
                          </th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {[
                          { timestamp: '2024-01-15 10:30:00', user: 'admin', action: 'Upload', details: 'document.pdf (2.5MB)', ip: '192.168.1.100' },
                          { timestamp: '2024-01-15 10:25:00', user: 'john.doe', action: 'Connect', details: 'SSH connection established', ip: '192.168.1.101' },
                          { timestamp: '2024-01-15 10:20:00', user: 'admin', action: 'Download', details: 'backup.zip (15.2MB)', ip: '192.168.1.100' },
                        ].map((log, index) => (
                          <tr key={index}>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                              {log.timestamp}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                              {log.user}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                                {log.action}
                              </span>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                              {log.details}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                              {log.ip}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

export default SftpServer