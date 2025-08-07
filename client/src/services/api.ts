import axios, { AxiosInstance, AxiosResponse } from 'axios'
import toast from 'react-hot-toast'

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001/api'

class ApiClient {
  private client: AxiosInstance

  constructor() {
    this.client = axios.create({
      baseURL: API_BASE_URL,
      timeout: 60000,
      headers: {
        'Content-Type': 'application/json',
      },
    })

    this.setupInterceptors()
  }

  private setupInterceptors() {
    this.client.interceptors.request.use(
      (config) => {
        const token = localStorage.getItem('token')
        if (token) {
          config.headers.Authorization = `Bearer ${token}`
        }
        return config
      },
      (error) => {
        return Promise.reject(error)
      }
    )

    this.client.interceptors.response.use(
      (response) => response,
      (error) => {
        if (error.response?.status === 401) {
          localStorage.removeItem('token')
          window.location.href = '/login'
          toast.error('Session expired. Please login again.')
        }
        return Promise.reject(error)
      }
    )
  }

  public get<T = any>(url: string, config = {}): Promise<AxiosResponse<T>> {
    return this.client.get(url, config)
  }

  public post<T = any>(url: string, data = {}, config = {}): Promise<AxiosResponse<T>> {
    return this.client.post(url, data, config)
  }

  public put<T = any>(url: string, data = {}, config = {}): Promise<AxiosResponse<T>> {
    return this.client.put(url, data, config)
  }

  public delete<T = any>(url: string, config = {}): Promise<AxiosResponse<T>> {
    return this.client.delete(url, config)
  }
}

const apiClient = new ApiClient()

export const authAPI = {
  login: (credentials: { username: string; password: string }) =>
    apiClient.post('/auth/login', credentials),
  
  register: (userData: { username: string; email: string; password: string }) =>
    apiClient.post('/auth/register', userData),
  
  me: () => apiClient.get('/auth/me'),
  
  refreshToken: () => apiClient.post('/auth/refresh'),
  
  logout: () => apiClient.post('/auth/logout'),
}

export const fileAPI = {
  listFiles: (path: string = '/') =>
    apiClient.get(`/files?path=${encodeURIComponent(path)}`),
  
  uploadFile: (formData: FormData, onUploadProgress?: (progress: number) => void) =>
    apiClient.post('/files/upload', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
      onUploadProgress: (progressEvent: { loaded: number; total?: number }) => {
        if (onUploadProgress && progressEvent.total) {
          const progress = Math.round((progressEvent.loaded * 100) / progressEvent.total)
          onUploadProgress(progress)
        }
      },
    }),
  
  downloadFile: (fileId: string) =>
    apiClient.get(`/files/${fileId}/download`, { responseType: 'blob' }),
  
  deleteFiles: (data: { file_ids: string[]; current_path?: string }) =>
    apiClient.delete('/files', { data }),
  
  createFolder: (data: { name: string; path: string }) =>
    apiClient.post('/files/folder', data),
  
  moveFiles: (data: { file_ids: string[]; target_path: string; current_path?: string }) =>
    apiClient.put('/files/move', data),
  
  copyFiles: (data: { file_ids: string[]; target_path: string; current_path?: string }) =>
    apiClient.post('/files/copy', data),
  
  renameFile: (fileId: string, newName: string) =>
    apiClient.put(`/files/${fileId}/rename`, { name: newName }),
  
  shareFile: (data: { file_id: string; share_with: string[]; permission?: string; expires_in?: number }) =>
    apiClient.post('/files/share', data),
  
  bulkOperation: (data: { operation: string; file_ids: string[]; target_path?: string }) =>
    apiClient.post('/files/bulk-operation', data),
  
  searchFiles: (query: string, path: string = '/') =>
    apiClient.get(`/files/search?query=${encodeURIComponent(query)}&path=${encodeURIComponent(path)}`),
  
  getStorageStats: (path: string = '/') =>
    apiClient.get(`/files/storage-stats?path=${encodeURIComponent(path)}`),
  
  previewFile: (fileId: string) =>
    apiClient.get(`/files/preview/${fileId}`),
  
  getFileInfo: (fileId: string) => apiClient.get(`/files/${fileId}`),
}

export const userAPI = {
  getUsers: (params?: { page?: number; limit?: number; search?: string }) =>
    apiClient.get('/users', { params, timeout: 90000 }),
  
  getUser: (userId: string) => apiClient.get(`/users/${userId}`),
  
  createUser: (userData: { 
    username: string; 
    email: string; 
    password: string; 
    role: string; 
    ssh_public_key?: string;
    home_directory?: string;
    folder_assignments?: Array<{ folder_path: string; permission: string }>;
  }) =>
    apiClient.post('/users', userData),
  
  updateUser: (userId: string, userData: Partial<{ username: string; email: string; role: string; ssh_public_key?: string; isActive?: boolean }>) =>
    apiClient.put(`/users/${userId}`, userData),
  
  toggleUserStatus: (userId: string, isActive: boolean) =>
    apiClient.put(`/users/${userId}/status`, { isActive }),
  
  deleteUser: (userId: string) => apiClient.delete(`/users/${userId}`),
  
  updateProfile: (data: { username?: string; email?: string; currentPassword?: string; newPassword?: string }) =>
    apiClient.put('/users/profile', data),
  
  getSftpUserInfo: (userId: string) => apiClient.get(`/users/${userId}/sftp`),
  
  updateSftpSshKey: (userId: string, sshKey: string) =>
    apiClient.put(`/users/${userId}/sftp/ssh-key`, { ssh_public_key: sshKey }),
  
  resetSftpPassword: (userId: string, newPassword: string) =>
    apiClient.put(`/users/${userId}/sftp/reset-password`, { password: newPassword }),
  
  listSftpUsers: () => apiClient.get('/users/sftp/list'),
  
  generateSshKey: (data: { username: string }) => apiClient.post('/users/generate-ssh-key', data),
  
  updateUserFolders: (userId: string, folders: Array<{ folder_path: string; permission: string }>) =>
    apiClient.put(`/users/${userId}/folders`, folders),
  
  getUserFolders: (userId: string) => apiClient.get(`/users/${userId}/folders`),
}

export const foldersAPI = {
  listS3Folders: () => apiClient.get('/folders'),
  
  getBucketInfo: () => apiClient.get('/folders/bucket-info'),
}

export const activityAPI = {
  getLogs: (params?: { 
    page?: number
    limit?: number
    startDate?: string
    endDate?: string
    action?: string
    userId?: string
  }) => apiClient.get('/activity', { params }),
  
  getLogById: (logId: string) => apiClient.get(`/activity/${logId}`),
  
  exportLogs: (params?: { 
    startDate?: string
    endDate?: string
    format?: 'csv' | 'json'
  }) => apiClient.get('/activity/export', { 
    params,
    responseType: 'blob'
  }),
}

export const statsAPI = {
  getDashboardStats: () => apiClient.get('/stats/dashboard'),
  
  getStorageStats: () => apiClient.get('/stats/storage'),
  
  getUserStats: () => apiClient.get('/stats/users'),
  
  getActivityStats: (period?: '24h' | '7d' | '30d') =>
    apiClient.get('/stats/activity', { params: { period } }),
}

export const settingsAPI = {
  getSettings: () => apiClient.get('/settings'),
  
  updateSettings: (settings: Record<string, any>) =>
    apiClient.put('/settings', settings),
  
  getSystemInfo: () => apiClient.get('/settings/system'),
}

export default apiClient