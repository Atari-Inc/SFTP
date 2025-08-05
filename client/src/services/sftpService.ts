import api from './api'

export interface SftpConnection {
  id: string
  host: string
  port: number
  username: string
  status: 'connected' | 'disconnected' | 'error' | 'connecting'
  connected_at?: string
  bytes_transferred: number
  files_transferred: number
}

export interface SftpServerStatus {
  status: 'online' | 'offline' | 'maintenance'
  uptime: string
  active_connections: number
  total_connections: number
  bytes_transferred: string
  files_transferred: number
  last_activity: string
  server_info: {
    host: string
    port: number
    protocol: string
    version: string
  }
}

export interface SftpUser {
  id: string
  username: string
  status: 'active' | 'inactive'
  last_login?: string
  public_key: string
  home_directory: string
  permissions: string[]
  sftp_enabled: boolean
}

export interface SftpFile {
  name: string
  size: number
  modified?: string
  is_directory: boolean
  permissions: string
}

export interface SftpLog {
  id: string
  timestamp: string
  user: string
  action: string
  details: string
  ip_address?: string
  location_country?: string
  location_city?: string
}

class SftpService {
  // Server Management
  async getServerStatus(): Promise<SftpServerStatus> {
    const response = await api.get('/sftp/status')
    return response.data
  }

  async startServer(): Promise<{ message: string }> {
    const response = await api.post('/sftp/server/start')
    return response.data
  }

  async stopServer(): Promise<{ message: string }> {
    const response = await api.post('/sftp/server/stop')
    return response.data
  }

  // Connection Management
  async createConnection(connectionData: {
    host: string
    port: number
    username: string
  }): Promise<{ id: string; status: string; message: string }> {
    const response = await api.post('/sftp/connect', connectionData)
    return response.data
  }

  async getConnections(): Promise<{ connections: SftpConnection[] }> {
    const response = await api.get('/sftp/connections')
    return response.data
  }

  async closeConnection(connectionId: string): Promise<{ message: string }> {
    const response = await api.delete(`/sftp/connections/${connectionId}`)
    return response.data
  }

  // File Operations
  async listRemoteFiles(
    connectionId: string, 
    path: string = '/'
  ): Promise<{ path: string; files: SftpFile[] }> {
    const response = await api.get(`/sftp/connections/${connectionId}/files`, {
      params: { path }
    })
    return response.data
  }

  async uploadFile(
    connectionId: string,
    uploadData: { local_path: string; remote_path: string }
  ): Promise<{ message: string; remote_path: string; size: number }> {
    const response = await api.post(`/sftp/connections/${connectionId}/upload`, uploadData)
    return response.data
  }

  async downloadFile(
    connectionId: string,
    downloadData: { remote_path: string; local_path: string }
  ): Promise<{ message: string; local_path: string; size: number }> {
    const response = await api.post(`/sftp/connections/${connectionId}/download`, downloadData)
    return response.data
  }

  // User Management
  async getSftpUsers(): Promise<{ users: SftpUser[] }> {
    const response = await api.get('/sftp/users')
    return response.data
  }

  // Activity Logs
  async getSftpLogs(params?: {
    skip?: number
    limit?: number
    user_filter?: string
    action_filter?: string
  }): Promise<{
    logs: SftpLog[]
    total: number
    skip: number
    limit: number
  }> {
    const response = await api.get('/sftp/logs', { params })
    return response.data
  }

  // Utility functions
  formatFileSize(bytes: number): string {
    if (bytes === 0) return '0 Bytes'
    
    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }

  formatUptime(uptime: string): string {
    // Parse uptime string like "2d 14h 32m" and return formatted version
    return uptime
  }

  getConnectionStatusColor(status: string): string {
    switch (status) {
      case 'connected':
        return 'text-green-600 bg-green-100'
      case 'disconnected':
        return 'text-red-600 bg-red-100'
      case 'connecting':
        return 'text-yellow-600 bg-yellow-100'
      case 'error':
        return 'text-red-600 bg-red-100'
      default:
        return 'text-gray-600 bg-gray-100'
    }
  }

  getServerStatusColor(status: string): string {
    switch (status) {
      case 'online':
        return 'text-green-600 bg-green-100'
      case 'offline':
        return 'text-red-600 bg-red-100'
      case 'maintenance':
        return 'text-yellow-600 bg-yellow-100'
      default:
        return 'text-gray-600 bg-gray-100'
    }
  }

  parseFilePath(path: string): string[] {
    return path.split('/').filter(p => p.length > 0)
  }

  joinPath(parts: string[]): string {
    return '/' + parts.join('/')
  }

  getParentPath(path: string): string {
    const parts = this.parseFilePath(path)
    if (parts.length <= 1) return '/'
    return this.joinPath(parts.slice(0, -1))
  }

  // Mock data for development
  getMockServerStatus(): SftpServerStatus {
    return {
      status: 'online',
      uptime: '2d 14h 32m',
      active_connections: 3,
      total_connections: 127,
      bytes_transferred: '2.4 GB',
      files_transferred: 486,
      last_activity: '2 minutes ago',
      server_info: {
        host: 'localhost',
        port: 22,
        protocol: 'SFTP/SSH',
        version: '2.0'
      }
    }
  }

  getMockConnections(): SftpConnection[] {
    return [
      {
        id: 'admin@192.168.1.100:22',
        host: '192.168.1.100',
        port: 22,
        username: 'admin',
        status: 'connected',
        connected_at: '2024-01-15T10:30:00',
        bytes_transferred: 1024000,
        files_transferred: 15
      },
      {
        id: 'user@192.168.1.101:22',
        host: '192.168.1.101',
        port: 22,
        username: 'user',
        status: 'connected',
        connected_at: '2024-01-15T09:15:00',
        bytes_transferred: 512000,
        files_transferred: 8
      }
    ]
  }

  getMockFiles(): SftpFile[] {
    return [
      {
        name: '..',
        size: 0,
        is_directory: true,
        permissions: '755'
      },
      {
        name: 'documents',
        size: 0,
        modified: '2024-01-15T10:30:00',
        is_directory: true,
        permissions: '755'
      },
      {
        name: 'backup.zip',
        size: 15728640,
        modified: '2024-01-14T16:45:00',
        is_directory: false,
        permissions: '644'
      },
      {
        name: 'config.txt',
        size: 2048,
        modified: '2024-01-15T08:20:00',
        is_directory: false,
        permissions: '644'
      }
    ]
  }

  getMockLogs(): SftpLog[] {
    return [
      {
        id: '1',
        timestamp: '2024-01-15T10:30:00',
        user: 'admin',
        action: 'sftp_upload',
        details: 'Uploaded document.pdf to /home/admin/documents/',
        ip_address: '192.168.1.100',
        location_country: 'United States',
        location_city: 'New York'
      },
      {
        id: '2',
        timestamp: '2024-01-15T10:25:00',
        user: 'john.doe',
        action: 'sftp_connect',
        details: 'SSH connection established to 192.168.1.101:22',
        ip_address: '192.168.1.101',
        location_country: 'United States',
        location_city: 'San Francisco'
      },
      {
        id: '3',
        timestamp: '2024-01-15T10:20:00',
        user: 'admin',
        action: 'sftp_download',
        details: 'Downloaded backup.zip from /home/admin/backups/',
        ip_address: '192.168.1.100',
        location_country: 'United States',
        location_city: 'New York'
      }
    ]
  }
}

export default new SftpService()