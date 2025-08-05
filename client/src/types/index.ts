export interface User {
  id: string
  username: string
  email: string
  role: 'admin' | 'user'
  isActive: boolean
  lastLogin?: string
  createdAt: string
  updatedAt: string
}

export interface FileItem {
  id: string
  name: string
  size: number
  type: 'file' | 'folder'
  path: string
  mimeType?: string
  permissions: string
  owner: string
  group: string
  createdAt: string
  modifiedAt: string
  accessedAt: string
}

export interface ActivityLog {
  id: string
  userId: string
  username: string
  action: string
  resource: string
  resourceId?: string
  details: Record<string, any>
  ipAddress: string
  userAgent: string
  timestamp: string
  status: 'success' | 'failure'
}

export interface DashboardStats {
  totalUsers: number
  activeUsers: number
  totalFiles: number
  totalStorage: number
  usedStorage: number
  recentUploads: number
  recentDownloads: number
  systemLoad: {
    cpu: number
    memory: number
    disk: number
  }
}

export interface FileOperation {
  id: string
  type: 'upload' | 'download' | 'delete' | 'move' | 'rename'
  fileName: string
  status: 'pending' | 'in-progress' | 'completed' | 'failed'
  progress: number
  startTime: string
  endTime?: string
  error?: string
  size?: number
}

export interface SystemSettings {
  maxFileSize: number
  allowedFileTypes: string[]
  maxStoragePerUser: number
  sessionTimeout: number
  enableRegistration: boolean
  enableGuestAccess: boolean
  maintenanceMode: boolean
  backupInterval: number
  logRetentionDays: number
}

export interface Notification {
  id: string
  type: 'info' | 'success' | 'warning' | 'error'
  title: string
  message: string
  timestamp: string
  read: boolean
  userId?: string
}

export interface Pagination {
  page: number
  limit: number
  total: number
  totalPages: number
  hasNext: boolean
  hasPrev: boolean
}

export interface ApiResponse<T> {
  data: T
  message?: string
  pagination?: Pagination
}