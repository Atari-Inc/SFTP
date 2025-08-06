import React, { useState, useEffect, useRef } from 'react'
import { 
  Plus, 
  Search, 
  Edit, 
  Trash2, 
  UserCheck, 
  UserX,
  MoreVertical,
  Shield,
  Mail,
  Calendar,
  Key,
  Folder,
  FolderPlus,
  Home,
  Settings,
  Filter,
  Download,
  FileText,
  RefreshCw,
  Eye,
  Power,
  Copy,
  CheckCircle
} from 'lucide-react'
import { userAPI, foldersAPI } from '@/services/api'
import { User } from '@/types'
import { formatDate } from '@/utils'
import Button from '@/components/ui/Button'
import Modal from '@/components/ui/Modal'
import LoadingSpinner from '@/components/ui/LoadingSpinner'
import { useForm } from 'react-hook-form'
import toast from 'react-hot-toast'

interface UserFormData {
  username: string
  email: string
  password: string
  role: 'admin' | 'user'
  ssh_public_key?: string
  home_directory?: string
  folder_assignments?: Array<{
    folder_path: string
    permission: string
  }>
  enable_sftp?: boolean
  private_key?: string
}

interface FolderAssignment {
  id?: string
  folder_path: string
  permission: 'read' | 'write' | 'full'
  is_active?: boolean
  created_at?: string
}

const Users: React.FC = () => {
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [showEditModal, setShowEditModal] = useState(false)
  const [showSshKeyModal, setShowSshKeyModal] = useState(false)
  const [showFoldersModal, setShowFoldersModal] = useState(false)
  const [showDetailsModal, setShowDetailsModal] = useState(false)
  const [showBulkActions, setShowBulkActions] = useState(false)
  const [selectedUsers, setSelectedUsers] = useState<string[]>([])
  const [selectedUser, setSelectedUser] = useState<User | null>(null)
  const [activeDropdown, setActiveDropdown] = useState<string | null>(null)
  const [sshKeyInput, setSshKeyInput] = useState('')
  const [regeneratedSshKeys, setRegeneratedSshKeys] = useState<{publicKey: string, privateKey: string} | null>(null)
  const [regeneratingKeys, setRegeneratingKeys] = useState(false)
  const [sftpPassword, setSftpPassword] = useState('')
  const [showPasswordReset, setShowPasswordReset] = useState(false)
  const [userFolders, setUserFolders] = useState<FolderAssignment[]>([])
  const [newFolders, setNewFolders] = useState<FolderAssignment[]>([{ folder_path: '', permission: 'read' }])
  const [currentUsername, setCurrentUsername] = useState('')
  const [availableFolders, setAvailableFolders] = useState<Array<{path: string, name: string, type: string}>>([])
  const [loadingFolders, setLoadingFolders] = useState(false)
  const [showAllFoldersModal, setShowAllFoldersModal] = useState(false)
  const [selectedUserFolders, setSelectedUserFolders] = useState<any>(null)
  const [enableSftp, setEnableSftp] = useState(false)
  const [generatedSshKeys, setGeneratedSshKeys] = useState<{publicKey: string, privateKey: string} | null>(null)
  const [generatingKeys, setGeneratingKeys] = useState(false)
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 10,
    total: 0,
    totalPages: 0,
  })
  const [showFilters, setShowFilters] = useState(false)
  const [filters, setFilters] = useState({
    search: '',
    role: '',
    status: '',
    enableSftp: '',
    startDate: '',
    endDate: '',
  })

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<UserFormData>()

  const {
    register: registerEdit,
    handleSubmit: handleSubmitEdit,
    reset: resetEdit,
    formState: { errors: errorsEdit, isSubmitting: isSubmittingEdit },
  } = useForm<Partial<UserFormData>>()

  useEffect(() => {
    loadUsers()
    loadAvailableFolders()
  }, [pagination.page, searchQuery, filters])

  const handleFilterChange = (key: string, value: string) => {
    setFilters(prev => ({ ...prev, [key]: value }))
    setPagination(prev => ({ ...prev, page: 1 }))
  }

  const clearFilters = () => {
    setFilters({
      search: '',
      role: '',
      status: '',
      enableSftp: '',
      startDate: '',
      endDate: '',
    })
    setPagination(prev => ({ ...prev, page: 1 }))
  }

  const handleExport = async (format: 'csv' | 'json') => {
    try {
      // Create export params from filters
      const exportParams = {
        ...Object.fromEntries(
          Object.entries(filters).filter(([_, value]) => value !== '')
        ),
        format,
      }
      
      // For now, we'll export current users data
      // TODO: Create actual export API endpoint
      const dataToExport = users.map(user => ({
        id: user.id,
        username: user.username,
        email: user.email,
        role: user.role,
        isActive: user.isActive,
        lastLogin: user.lastLogin,
        createdAt: user.createdAt,
        enableSftp: user.folder_assignments?.length > 0 ? 'Yes' : 'No'
      }))

      if (format === 'csv') {
        const csvContent = [
          ['ID', 'Username', 'Email', 'Role', 'Status', 'Last Login', 'Created At', 'SFTP Enabled'].join(','),
          ...dataToExport.map(user => [
            user.id,
            user.username,
            user.email,
            user.role,
            user.isActive ? 'Active' : 'Inactive',
            user.lastLogin ? formatDate(user.lastLogin) : 'Never',
            formatDate(user.createdAt),
            user.enableSftp
          ].join(','))
        ].join('\n')

        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
        const link = document.createElement('a')
        link.href = URL.createObjectURL(blob)
        link.download = `users-export-${new Date().toISOString().split('T')[0]}.csv`
        link.click()
      } else {
        const jsonContent = JSON.stringify(dataToExport, null, 2)
        const blob = new Blob([jsonContent], { type: 'application/json;charset=utf-8;' })
        const link = document.createElement('a')
        link.href = URL.createObjectURL(blob)
        link.download = `users-export-${new Date().toISOString().split('T')[0]}.json`
        link.click()
      }

      toast.success(`Users exported as ${format.toUpperCase()}`)
    } catch (error) {
      console.error('Export failed:', error)
      toast.error('Failed to export users')
    }
  }

  const loadAvailableFolders = async () => {
    setLoadingFolders(true)
    try {
      const response = await foldersAPI.listS3Folders()
      setAvailableFolders(response.data)
    } catch (error) {
      console.error('Failed to load folders:', error)
      // Fallback to empty if S3 fetch fails
      setAvailableFolders([])
    } finally {
      setLoadingFolders(false)
    }
  }

  const loadUsers = async (retryCount = 0) => {
    setLoading(true)
    try {
      // Combine searchQuery and filters.search
      const searchTerm = filters.search || searchQuery
      
      const response = await userAPI.getUsers({
        page: pagination.page,
        limit: pagination.limit,
        search: searchTerm || undefined,
        // Note: Backend doesn't support these filters yet, but ready for future implementation
        role: filters.role || undefined,
        status: filters.status || undefined,
        enableSftp: filters.enableSftp || undefined,
        startDate: filters.startDate || undefined,
        endDate: filters.endDate || undefined,
      })
      let filteredUsers = response.data.data

      // Apply client-side filtering until backend supports it
      if (filters.role) {
        filteredUsers = filteredUsers.filter(user => user.role === filters.role)
      }
      if (filters.status) {
        const isActive = filters.status === 'active'
        filteredUsers = filteredUsers.filter(user => user.isActive === isActive)
      }
      if (filters.enableSftp) {
        const hasSftp = filters.enableSftp === 'yes'
        filteredUsers = filteredUsers.filter(user => 
          hasSftp ? (user.folder_assignments && user.folder_assignments.length > 0) : 
                   (!user.folder_assignments || user.folder_assignments.length === 0)
        )
      }
      if (filters.startDate) {
        filteredUsers = filteredUsers.filter(user => 
          new Date(user.createdAt) >= new Date(filters.startDate)
        )
      }
      if (filters.endDate) {
        filteredUsers = filteredUsers.filter(user => 
          new Date(user.createdAt) <= new Date(filters.endDate)
        )
      }

      setUsers(filteredUsers)
      setPagination(prev => ({
        ...prev,
        total: response.data.pagination.total, // Keep original total for now
        totalPages: response.data.pagination.totalPages,
      }))
    } catch (error: any) {
      console.error('Failed to load users:', error)
      
      if (error.code === 'ECONNABORTED' && retryCount < 2) {
        toast.error(`Request timed out. Retrying... (${retryCount + 1}/2)`)
        setTimeout(() => loadUsers(retryCount + 1), 1000)
        return
      }
      
      if (error.code === 'ECONNABORTED') {
        toast.error('Unable to load users - server is taking too long to respond. Please try again later or contact support.')
      } else {
        toast.error('Failed to load users')
      }
    } finally {
      setLoading(false)
    }
  }

  const handleCreateUser = async (data: UserFormData) => {
    try {
      const userData = {
        ...data,
        home_directory: data.home_directory || `/home/${data.username}`,
        folder_assignments: newFolders.filter(f => f.folder_path.trim()),
        ssh_public_key: generatedSshKeys?.publicKey || data.ssh_public_key,
        enable_sftp: enableSftp,
        private_key: generatedSshKeys?.privateKey // Store private key with user for later access
      }
      await userAPI.createUser(userData)
      toast.success('User created successfully')
      setShowCreateModal(false)
      reset()
      setNewFolders([{ folder_path: '', permission: 'read' }])
      setEnableSftp(false)
      setGeneratedSshKeys(null)
      setCurrentUsername('')
      loadUsers()
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to create user')
    }
  }

  const handleEditUser = async (data: Partial<UserFormData>) => {
    if (!selectedUser) return
    
    try {
      const updateData = Object.fromEntries(
        Object.entries(data).filter(([_, value]) => value !== '')
      )
      
      await userAPI.updateUser(selectedUser.id, updateData)
      toast.success('User updated successfully')
      setShowEditModal(false)
      setSelectedUser(null)
      resetEdit()
      loadUsers()
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to update user')
    }
  }

  const handleDeleteUser = async (userId: string, username: string) => {
    if (confirm(`Are you sure you want to delete user "${username}"? This action cannot be undone.`)) {
      try {
        await userAPI.deleteUser(userId)
        toast.success('User deleted successfully')
        loadUsers()
      } catch (error: any) {
        toast.error(error.response?.data?.message || 'Failed to delete user')
      }
    }
  }

  const handleToggleStatus = async (user: User) => {
    const newStatus = !user.is_active
    const action = newStatus ? 'activate' : 'deactivate'
    
    if (confirm(`Are you sure you want to ${action} user "${user.username}"?`)) {
      try {
        await userAPI.toggleUserStatus(user.id, newStatus)
        toast.success(`User ${action}d successfully`)
        loadUsers()
      } catch (error: any) {
        toast.error(error.response?.data?.message || `Failed to ${action} user`)
      }
    }
  }

  const handleViewDetails = (user: User) => {
    setSelectedUser(user)
    setShowDetailsModal(true)
  }

  const handleBulkDelete = async () => {
    if (selectedUsers.length === 0) {
      toast.error('No users selected')
      return
    }
    
    if (confirm(`Are you sure you want to delete ${selectedUsers.length} users? This action cannot be undone.`)) {
      try {
        await Promise.all(selectedUsers.map(userId => userAPI.deleteUser(userId)))
        toast.success(`${selectedUsers.length} users deleted successfully`)
        setSelectedUsers([])
        loadUsers()
      } catch (error: any) {
        toast.error('Failed to delete some users')
      }
    }
  }

  const handleSelectAll = () => {
    if (selectedUsers.length === users.length) {
      setSelectedUsers([])
    } else {
      setSelectedUsers(users.map(u => u.id))
    }
  }

  const handleSelectUser = (userId: string) => {
    if (selectedUsers.includes(userId)) {
      setSelectedUsers(selectedUsers.filter(id => id !== userId))
    } else {
      setSelectedUsers([...selectedUsers, userId])
    }
  }

  const openEditModal = (user: User) => {
    setSelectedUser(user)
    resetEdit({
      username: user.username,
      email: user.email,
      role: user.role,
    })
    setShowEditModal(true)
  }

  const openSshKeyModal = (user: User) => {
    setSelectedUser(user)
    setSshKeyInput('')
    setRegeneratedSshKeys(null)
    setSftpPassword('')
    setShowPasswordReset(false)
    setShowSshKeyModal(true)
  }

  const openFoldersModal = async (user: User) => {
    setSelectedUser(user)
    try {
      const response = await userAPI.getUserFolders(user.id)
      setUserFolders(response.data)
      setNewFolders(response.data.length > 0 ? response.data : [{ folder_path: '', permission: 'read' }])
    } catch (error) {
      console.error('Failed to load user folders:', error)
      setUserFolders([])
      setNewFolders([{ folder_path: '', permission: 'read' }])
    }
    setShowFoldersModal(true)
  }

  const addFolderRow = () => {
    setNewFolders([...newFolders, { folder_path: '', permission: 'read' }])
  }

  const removeFolderRow = (index: number) => {
    if (newFolders.length > 1) {
      setNewFolders(newFolders.filter((_, i) => i !== index))
    }
  }

  const updateFolderRow = (index: number, field: keyof FolderAssignment, value: string) => {
    const updated = [...newFolders]
    updated[index] = { ...updated[index], [field]: value }
    setNewFolders(updated)
  }

  const handleUpdateFolders = async () => {
    if (!selectedUser) return

    try {
      const validFolders = newFolders.filter(f => f.folder_path.trim())
      await userAPI.updateUserFolders(selectedUser.id, validFolders)
      toast.success('Folder assignments updated successfully')
      setShowFoldersModal(false)
      setSelectedUser(null)
      setNewFolders([{ folder_path: '', permission: 'read' }])
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to update folder assignments')
    }
  }

  const openAllFoldersModal = (user: any) => {
    setSelectedUserFolders(user)
    setShowAllFoldersModal(true)
  }

  const handleUpdateSshKey = async () => {
    if (!selectedUser) return
    
    const keyToUpdate = regeneratedSshKeys?.publicKey || sshKeyInput.trim()
    if (!keyToUpdate) {
      toast.error('Please provide an SSH key or generate a new one')
      return
    }

    try {
      await userAPI.updateSftpSshKey(selectedUser.id, keyToUpdate)
      toast.success('SSH key updated successfully')
      setShowSshKeyModal(false)
      setSshKeyInput('')
      setRegeneratedSshKeys(null)
      setSelectedUser(null)
      loadUsers()
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to update SSH key')
    }
  }

  const regenerateSshKeys = async () => {
    if (!selectedUser) return
    
    setRegeneratingKeys(true)
    try {
      const response = await userAPI.generateSshKey({ username: selectedUser.username })
      setRegeneratedSshKeys({
        publicKey: response.data.public_key,
        privateKey: response.data.private_key
      })
      toast.success('SSH keys regenerated successfully!')
    } catch (error) {
      toast.error('Failed to regenerate SSH keys')
      console.error('Key regeneration error:', error)
    } finally {
      setRegeneratingKeys(false)
    }
  }

  const handleResetSftpPassword = async () => {
    if (!selectedUser || !sftpPassword.trim()) return
    
    try {
      await userAPI.resetSftpPassword(selectedUser.id, sftpPassword)
      toast.success('SFTP password reset successfully')
      setSftpPassword('')
      setShowPasswordReset(false)
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to reset SFTP password')
    }
  }

  const generateSshKeys = async () => {
    setGeneratingKeys(true)
    try {
      // For now, we'll use a simple client-side key generation approach
      // In production, you might want to use a proper crypto library
      const keyPair = await generateRSAKeyPair()
      setGeneratedSshKeys(keyPair)
      toast.success('SSH keys generated successfully!')
    } catch (error) {
      toast.error('Failed to generate SSH keys')
      console.error('Key generation error:', error)
    } finally {
      setGeneratingKeys(false)
    }
  }

  const generateRSAKeyPair = async (): Promise<{publicKey: string, privateKey: string}> => {
    const username = currentUsername || 'user'
    
    try {
      const response = await userAPI.generateSshKey({ username })
      return {
        publicKey: response.data.public_key,
        privateKey: response.data.private_key
      }
    } catch (error) {
      console.error('Failed to generate SSH keys:', error)
      throw new Error('Failed to generate SSH keys. Please try again.')
    }
  }

  const getRoleColor = (role: string) => {
    return role === 'admin' ? 'text-purple-600 bg-purple-100' : 'text-blue-600 bg-blue-100'
  }

  const getStatusColor = (is_active: boolean) => {
    return is_active ? 'text-green-600 bg-green-100' : 'text-red-600 bg-red-100'
  }

  const getPermissionBadge = (permission: string) => {
    switch(permission) {
      case 'read':
        return { label: 'R', color: 'bg-blue-100 text-blue-700', title: 'Read Only' }
      case 'write':
        return { label: 'RW', color: 'bg-yellow-100 text-yellow-700', title: 'Read & Write' }
      case 'full':
        return { label: 'Full', color: 'bg-green-100 text-green-700', title: 'Full Access' }
      default:
        return { label: '?', color: 'bg-gray-100 text-gray-700', title: 'Unknown' }
    }
  }

  const filteredUsers = users.filter(user =>
    user.username.toLowerCase().includes(searchQuery.toLowerCase()) ||
    user.email.toLowerCase().includes(searchQuery.toLowerCase())
  )
  
  const dropdownRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setActiveDropdown(null)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Users</h1>
          <p className="mt-2 text-gray-600">Manage system users and their permissions</p>
        </div>
        <div className="flex space-x-2">
          <Button onClick={() => setShowFilters(!showFilters)} variant="outline">
            <Filter className="h-4 w-4 mr-2" />
            Filters
          </Button>
          <Button onClick={() => handleExport('csv')} variant="outline">
            <Download className="h-4 w-4 mr-2" />
            Export CSV
          </Button>
          <Button onClick={() => handleExport('json')} variant="outline">
            <FileText className="h-4 w-4 mr-2" />
            Export JSON
          </Button>
          <Button onClick={loadUsers} variant="outline">
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
          <Button onClick={() => {
            setShowCreateModal(true)
            setCurrentUsername('')
            setNewFolders([{ folder_path: '', permission: 'read' }])
            reset()
          }}>
            <Plus className="h-4 w-4 mr-2" />
            Add User
          </Button>
        </div>
      </div>

      {showFilters && (
        <div className="card">
          <h3 className="text-lg font-medium text-gray-900 mb-4">Filters</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Search
              </label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <input
                  type="text"
                  value={filters.search}
                  onChange={(e) => handleFilterChange('search', e.target.value)}
                  placeholder="Search users..."
                  className="pl-10 input-field"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Role
              </label>
              <select
                value={filters.role}
                onChange={(e) => handleFilterChange('role', e.target.value)}
                className="input-field"
              >
                <option value="">All Roles</option>
                <option value="admin">Admin</option>
                <option value="user">User</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Status
              </label>
              <select
                value={filters.status}
                onChange={(e) => handleFilterChange('status', e.target.value)}
                className="input-field"
              >
                <option value="">All Status</option>
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                SFTP Enabled
              </label>
              <select
                value={filters.enableSftp}
                onChange={(e) => handleFilterChange('enableSftp', e.target.value)}
                className="input-field"
              >
                <option value="">All Users</option>
                <option value="yes">SFTP Enabled</option>
                <option value="no">SFTP Disabled</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Created After
              </label>
              <input
                type="date"
                value={filters.startDate}
                onChange={(e) => handleFilterChange('startDate', e.target.value)}
                className="input-field"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Created Before
              </label>
              <input
                type="date"
                value={filters.endDate}
                onChange={(e) => handleFilterChange('endDate', e.target.value)}
                className="input-field"
              />
            </div>
          </div>
          
          <div className="flex justify-end mt-4">
            <Button onClick={clearFilters} variant="outline">
              Clear Filters
            </Button>
          </div>
        </div>
      )}

      {selectedUsers.length > 0 && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg px-4 py-3 flex items-center justify-between">
          <div className="flex items-center">
            <CheckCircle className="h-5 w-5 text-blue-600 mr-3" />
            <span className="text-sm font-medium text-blue-900">
              {selectedUsers.length} user{selectedUsers.length > 1 ? 's' : ''} selected
            </span>
          </div>
          <div className="flex items-center space-x-2">
            <Button
              onClick={() => {
                const selectedUsersList = users.filter(u => selectedUsers.includes(u.id))
                selectedUsersList.forEach(user => handleToggleStatus(user))
                setSelectedUsers([])
              }}
              variant="outline"
              size="sm"
            >
              <Power className="h-4 w-4 mr-2" />
              Toggle Status
            </Button>
            <Button
              onClick={handleBulkDelete}
              variant="danger"
              size="sm"
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Delete Selected
            </Button>
            <Button
              onClick={() => setSelectedUsers([])}
              variant="outline"
              size="sm"
            >
              Cancel
            </Button>
          </div>
        </div>
      )}

      <div className="flex justify-between items-center">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search users..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10 input-field"
          />
        </div>
        <div className="text-sm text-gray-500">
          {pagination.total} total users
        </div>
      </div>

      <div className="card">
        {loading ? (
          <div className="flex items-center justify-center h-32">
            <LoadingSpinner size="lg" />
          </div>
        ) : filteredUsers.length === 0 ? (
          <div className="text-center py-12">
            <Shield className="mx-auto h-12 w-12 text-gray-400" />
            <h3 className="mt-2 text-sm font-medium text-gray-900">No users found</h3>
            <p className="mt-1 text-sm text-gray-500">
              {searchQuery ? 'No users match your search.' : 'Get started by adding a user.'}
            </p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-3 py-3">
                      <input
                        type="checkbox"
                        checked={selectedUsers.length === users.length && users.length > 0}
                        onChange={handleSelectAll}
                        className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                      />
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      User
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Role
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Home Directory
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Assigned Folders
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Last Login
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {filteredUsers.map((user) => (
                    <tr key={user.id} className="hover:bg-gray-50">
                      <td className="px-3 py-4">
                        <input
                          type="checkbox"
                          checked={selectedUsers.includes(user.id)}
                          onChange={() => handleSelectUser(user.id)}
                          className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                        />
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <div className="h-10 w-10 bg-gradient-to-br from-blue-500 to-blue-600 rounded-full flex items-center justify-center shadow-sm">
                            <span className="text-sm font-medium text-white">
                              {user.username.charAt(0).toUpperCase()}
                            </span>
                          </div>
                          <div className="ml-3">
                            <div className="text-sm font-medium text-gray-900">
                              {user.username}
                            </div>
                            <div className="text-xs text-gray-500 flex items-center">
                              <Mail className="h-3 w-3 mr-1" />
                              {user.email}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getRoleColor(user.role)}`}>
                          <Shield className="h-3 w-3 mr-1" />
                          {user.role}
                        </span>
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap">
                        <div className="flex items-center text-sm text-gray-700">
                          <Home className="h-3 w-3 mr-1 text-gray-400" />
                          <span className="font-mono text-xs">
                            {(user as any).home_directory || `/home/${user.username}`}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-4">
                        <div className="max-w-xs">
                          {(user as any).folder_assignments && (user as any).folder_assignments.length > 0 ? (
                            <div className="space-y-1">
                              {(user as any).folder_assignments.slice(0, 2).map((folder: any, idx: number) => {
                                const badge = getPermissionBadge(folder.permission)
                                return (
                                  <div key={idx} className="flex items-center gap-1">
                                    <Folder className="h-3 w-3 text-gray-400 flex-shrink-0" />
                                    <span className="font-mono text-xs text-gray-700 truncate max-w-[150px]">
                                      {folder.folder_path}
                                    </span>
                                    <span 
                                      className={`px-1.5 py-0.5 rounded text-xs font-medium ${badge.color}`}
                                      title={badge.title}
                                    >
                                      {badge.label}
                                    </span>
                                  </div>
                                )
                              })}
                              {(user as any).folder_assignments.length > 2 && (
                                <div className="flex items-center gap-1">
                                  <FolderPlus className="h-3 w-3 text-gray-400" />
                                  <button
                                    onClick={() => openAllFoldersModal(user)}
                                    className="text-xs text-blue-600 hover:text-blue-800 font-medium underline hover:no-underline transition-colors"
                                  >
                                    +{(user as any).folder_assignments.length - 2} more folders
                                  </button>
                                </div>
                              )}
                            </div>
                          ) : (
                            <div className="flex items-center gap-1">
                              <Folder className="h-3 w-3 text-gray-300" />
                              <span className="text-xs text-gray-400 italic">No folders assigned</span>
                            </div>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(user.is_active)}`}>
                          {user.is_active ? (
                            <UserCheck className="h-3 w-3 mr-1" />
                          ) : (
                            <UserX className="h-3 w-3 mr-1" />
                          )}
                          {user.is_active ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-500">
                        {user.last_login ? (
                          <div className="flex items-center text-xs">
                            <Calendar className="h-3 w-3 mr-1" />
                            {formatDate(user.last_login, 'relative')}
                          </div>
                        ) : (
                          <span className="text-xs text-gray-400">Never</span>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <div className="relative inline-block text-left" ref={dropdownRef}>
                          <Button
                            onClick={() => setActiveDropdown(activeDropdown === user.id ? null : user.id)}
                            variant="outline"
                            size="sm"
                            className="inline-flex items-center"
                          >
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                          
                          {activeDropdown === user.id && (
                            <div className="origin-top-right absolute right-0 mt-2 w-56 rounded-md shadow-lg bg-white ring-1 ring-black ring-opacity-5 z-50">
                              <div className="py-1" role="menu">
                                <button
                                  onClick={() => {
                                    handleViewDetails(user)
                                    setActiveDropdown(null)
                                  }}
                                  className="flex items-center px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 w-full text-left"
                                >
                                  <Eye className="h-4 w-4 mr-3" />
                                  View Details
                                </button>
                                
                                <button
                                  onClick={() => {
                                    openEditModal(user)
                                    setActiveDropdown(null)
                                  }}
                                  className="flex items-center px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 w-full text-left"
                                >
                                  <Edit className="h-4 w-4 mr-3" />
                                  Edit User
                                </button>
                                
                                <button
                                  onClick={() => {
                                    openFoldersModal(user)
                                    setActiveDropdown(null)
                                  }}
                                  className="flex items-center px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 w-full text-left"
                                >
                                  <Folder className="h-4 w-4 mr-3" />
                                  Manage Folders
                                </button>
                                
                                <button
                                  onClick={() => {
                                    openSshKeyModal(user)
                                    setActiveDropdown(null)
                                  }}
                                  className="flex items-center px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 w-full text-left"
                                >
                                  <Key className="h-4 w-4 mr-3" />
                                  Manage SSH Key
                                </button>
                                
                                <div className="border-t border-gray-100"></div>
                                
                                <button
                                  onClick={() => {
                                    handleToggleStatus(user)
                                    setActiveDropdown(null)
                                  }}
                                  className="flex items-center px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 w-full text-left"
                                >
                                  <Power className="h-4 w-4 mr-3" />
                                  {user.is_active ? 'Deactivate' : 'Activate'} User
                                </button>
                                
                                <button
                                  onClick={() => {
                                    navigator.clipboard.writeText(user.id)
                                    toast.success('User ID copied to clipboard')
                                    setActiveDropdown(null)
                                  }}
                                  className="flex items-center px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 w-full text-left"
                                >
                                  <Copy className="h-4 w-4 mr-3" />
                                  Copy User ID
                                </button>
                                
                                <div className="border-t border-gray-100"></div>
                                
                                <button
                                  onClick={() => {
                                    handleDeleteUser(user.id, user.username)
                                    setActiveDropdown(null)
                                  }}
                                  className="flex items-center px-4 py-2 text-sm text-red-600 hover:bg-red-50 w-full text-left"
                                >
                                  <Trash2 className="h-4 w-4 mr-3" />
                                  Delete User
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex items-center justify-between mt-6">
              <div className="text-sm text-gray-700">
                Showing {((pagination.page - 1) * pagination.limit) + 1} to{' '}
                {Math.min(pagination.page * pagination.limit, pagination.total)} of{' '}
                {pagination.total} results
              </div>
              
              <div className="flex space-x-2">
                <Button
                  onClick={() => setPagination(prev => ({ ...prev, page: prev.page - 1 }))}
                  disabled={pagination.page === 1}
                  variant="outline"
                >
                  Previous
                </Button>
                <Button
                  onClick={() => setPagination(prev => ({ ...prev, page: prev.page + 1 }))}
                  disabled={pagination.page === pagination.totalPages}
                  variant="outline"
                >
                  Next
                </Button>
              </div>
            </div>
          </>
        )}
      </div>

      <Modal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        title="Create New User"
        size="xl"
      >
        <div className="max-h-[80vh] overflow-y-auto pr-2 scrollbar-hide">
          <form onSubmit={handleSubmit(handleCreateUser)} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700">Username</label>
            <input
              {...register('username', {
                required: 'Username is required',
                minLength: { value: 3, message: 'Username must be at least 3 characters' },
                onChange: (e) => setCurrentUsername(e.target.value)
              })}
              className="mt-1 input-field"
              placeholder="Enter username"
              onChange={(e) => {
                setCurrentUsername(e.target.value)
              }}
            />
            {errors.username && (
              <p className="mt-1 text-sm text-red-600">{errors.username.message}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Email Address</label>
            <div className="relative">
              <input
                {...register('email', {
                  required: 'Email is required',
                  pattern: {
                    value: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
                    message: 'Invalid email address',
                  },
                })}
                type="email"
                className="input-field pr-10"
                placeholder={currentUsername ? `${currentUsername}@company.com` : 'Enter email address'}
              />
              <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
                <Mail className="h-4 w-4 text-gray-400" />
              </div>
            </div>
            {currentUsername && (
              <div className="mt-2 flex justify-end">
                <button
                  type="button"
                  className="text-xs text-blue-600 hover:text-blue-800 bg-blue-50 hover:bg-blue-100 px-3 py-1 rounded-md border border-blue-200 transition-colors"
                  onClick={() => {
                    const emailField = document.querySelector('input[type="email"]') as HTMLInputElement
                    if (emailField) {
                      emailField.value = `${currentUsername}@company.com`
                      emailField.dispatchEvent(new Event('input', { bubbles: true }))
                    }
                  }}
                >
                  📧 Use {currentUsername}@company.com
                </button>
              </div>
            )}
            {errors.email && (
              <p className="mt-1 text-sm text-red-600">{errors.email.message}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">Password</label>
            <input
              {...register('password', {
                required: 'Password is required',
                minLength: { value: 6, message: 'Password must be at least 6 characters' },
              })}
              type="password"
              className="mt-1 input-field"
              placeholder="Enter password"
            />
            {errors.password && (
              <p className="mt-1 text-sm text-red-600">{errors.password.message}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">Role</label>
            <select {...register('role', { required: 'Role is required' })} className="mt-1 input-field">
              <option value="">Select role</option>
              <option value="user">User</option>
              <option value="admin">Admin</option>
            </select>
            {errors.role && (
              <p className="mt-1 text-sm text-red-600">{errors.role.message}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Home Directory</label>
            <div className="relative">
              <select
                {...register('home_directory')}
                className="input-field pr-10"
                disabled={loadingFolders}
              >
                <option value="">Select home directory...</option>
                <option value={`/home/${currentUsername || 'username'}`}>
                  🏠 /home/{currentUsername || 'username'} (Default)
                </option>
                {availableFolders.map((folder) => (
                  <option key={folder.path} value={folder.path}>
                    📁 {folder.name} ({folder.path})
                  </option>
                ))}
              </select>
              <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
                <Home className="h-4 w-4 text-gray-400" />
              </div>
            </div>
            <div className="mt-2 p-3 bg-blue-50 border border-blue-200 rounded-md">
              <div className="flex items-start">
                <div className="flex-shrink-0">
                  <Home className="h-4 w-4 text-blue-600 mt-0.5" />
                </div>
                <div className="ml-2 text-sm text-blue-800">
                  <p className="font-medium">Home Directory Selection</p>
                  <p className="mt-1">
                    {loadingFolders 
                      ? 'Loading directories from S3...' 
                      : `Choose from your S3 root folders or use the default /home/${currentUsername || 'username'} directory.`
                    }
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div className="border border-gray-200 rounded-lg p-4 bg-gray-50">
            <div className="flex items-center justify-between mb-4">
              <label className="block text-sm font-medium text-gray-700 flex items-center">
                <Key className="h-4 w-4 mr-2" />
                SFTP Access Configuration
              </label>
            </div>
            
            <div className="space-y-4">
              <div className="flex items-center">
                <input
                  type="checkbox"
                  id="enableSftp"
                  checked={enableSftp}
                  onChange={(e) => {
                    setEnableSftp(e.target.checked)
                    if (!e.target.checked) {
                      setGeneratedSshKeys(null)
                    }
                  }}
                  className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                />
                <label htmlFor="enableSftp" className="ml-2 text-sm text-gray-700">
                  Enable SFTP access for this user
                </label>
              </div>

              {enableSftp && (
                <div className="space-y-4 pl-6 border-l-2 border-blue-200">
                  <div className="bg-blue-50 p-3 rounded-md">
                    <div className="flex items-start">
                      <div className="flex-shrink-0">
                        <Key className="h-4 w-4 text-blue-600 mt-0.5" />
                      </div>
                      <div className="ml-2 text-sm text-blue-800">
                        <p className="font-medium">SSH Key Generation</p>
                        <p className="mt-1">
                          Generate SSH keys for secure SFTP access. The public key will be saved to AWS Transfer Family, and the private key will be available for download.
                        </p>
                      </div>
                    </div>
                  </div>

                  <div>
                    {!generatedSshKeys ? (
                      <Button
                        type="button"
                        onClick={generateSshKeys}
                        loading={generatingKeys}
                        className="bg-green-600 hover:bg-green-700 text-white"
                      >
                        <Key className="h-4 w-4 mr-2" />
                        {generatingKeys ? 'Generating SSH Keys...' : 'Generate SSH Key Pair'}
                      </Button>
                    ) : (
                      <div className="space-y-3">
                        <div className="flex items-center justify-between p-3 bg-green-50 border border-green-200 rounded-md">
                          <div className="flex items-center">
                            <div className="flex-shrink-0">
                              <div className="h-8 w-8 bg-green-100 rounded-full flex items-center justify-center">
                                <Key className="h-4 w-4 text-green-600" />
                              </div>
                            </div>
                            <div className="ml-3">
                              <p className="text-sm font-medium text-green-800">SSH Keys Generated Successfully</p>
                              <p className="text-xs text-green-600">Public key will be configured in AWS Transfer Family</p>
                            </div>
                          </div>
                          <Button
                            type="button"
                            onClick={() => setGeneratedSshKeys(null)}
                            variant="outline"
                            size="sm"
                            className="text-green-700 border-green-300 hover:bg-green-100"
                          >
                            Regenerate
                          </Button>
                        </div>

                        <div className="grid grid-cols-1 gap-3">
                          <div>
                            <label className="block text-xs font-medium text-gray-600 mb-1">Public Key (saved to AWS Transfer Family)</label>
                            <textarea
                              value={generatedSshKeys.publicKey}
                              readOnly
                              className="w-full p-2 text-xs font-mono bg-gray-100 border border-gray-300 rounded-md resize-none"
                              rows={2}
                            />
                          </div>
                          
                          <div>
                            <label className="block text-xs font-medium text-gray-600 mb-1">Private Key (download and save securely)</label>
                            <div className="relative">
                              <textarea
                                value={generatedSshKeys.privateKey}
                                readOnly
                                className="w-full p-2 text-xs font-mono bg-gray-100 border border-gray-300 rounded-md resize-none"
                                rows={4}
                              />
                              <Button
                                type="button"
                                onClick={() => {
                                  const blob = new Blob([generatedSshKeys.privateKey], { type: 'text/plain' })
                                  const url = URL.createObjectURL(blob)
                                  const a = document.createElement('a')
                                  a.href = url
                                  a.download = `${currentUsername || 'user'}_sftp_private_key.pem`
                                  document.body.appendChild(a)
                                  a.click()
                                  document.body.removeChild(a)
                                  URL.revokeObjectURL(url)
                                  toast.success('Private key downloaded successfully')
                                }}
                                variant="outline"
                                size="sm"
                                className="absolute top-1 right-1 text-xs"
                              >
                                Download
                              </Button>
                            </div>
                            <p className="text-xs text-amber-600 mt-1 flex items-center">
                              <span className="mr-1">⚠️</span>
                              Save this private key securely. It will not be shown again.
                            </p>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700">Or paste existing SSH Public Key</label>
                    <textarea
                      {...register('ssh_public_key')}
                      className="mt-1 input-field"
                      rows={2}
                      placeholder="ssh-rsa AAAA... (optional - if you have an existing key)"
                      disabled={!!generatedSshKeys}
                    />
                    <p className="mt-1 text-xs text-gray-500">
                      {generatedSshKeys 
                        ? 'Using generated SSH key above. Clear generated keys to use a custom key.' 
                        : 'Optional: Paste an existing SSH public key instead of generating new ones.'
                      }
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="border border-gray-200 rounded-lg p-4 bg-gray-50">
            <div className="flex items-center justify-between mb-4">
              <label className="block text-sm font-medium text-gray-700">
                <Folder className="h-4 w-4 inline mr-2" />
                Additional Folder Access
              </label>
              <span className="text-xs text-gray-500 bg-white px-2 py-1 rounded">
                {loadingFolders ? 'Loading...' : `${availableFolders.length} folders available`}
              </span>
            </div>
            
            <div className="space-y-3 max-h-80 overflow-y-auto scrollbar-hide">
              {newFolders.map((folder, index) => (
                <div key={index} className="bg-white border border-gray-200 rounded-md p-3 min-h-[140px]">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-medium text-gray-600">
                      Folder Assignment #{index + 1}
                    </span>
                    {newFolders.length > 1 && (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => removeFolderRow(index)}
                        className="text-red-600 hover:text-red-800 border-red-200 hover:border-red-300"
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    )}
                  </div>
                  
                  <div className="grid grid-cols-3 gap-3">
                    <div className="col-span-2">
                      <label className="block text-xs font-medium text-gray-600 mb-1">Folder Path</label>
                      <select
                        value={folder.folder_path}
                        onChange={(e) => updateFolderRow(index, 'folder_path', e.target.value)}
                        className="w-full input-field text-sm"
                        disabled={loadingFolders}
                      >
                        <option value="">Select folder...</option>
                        {availableFolders.map((availableFolder) => (
                          <option key={availableFolder.path} value={availableFolder.path}>
                            📁 {availableFolder.name} ({availableFolder.path})
                          </option>
                        ))}
                      </select>
                    </div>
                    
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">Permission</label>
                      <select
                        value={folder.permission}
                        onChange={(e) => updateFolderRow(index, 'permission', e.target.value)}
                        className="w-full input-field text-sm"
                      >
                        <option value="read">🔍 Read Only</option>
                        <option value="write">✏️ Read & Write</option>
                        <option value="full">🔓 Full Access</option>
                      </select>
                    </div>
                  </div>
                  
                  {folder.folder_path && (
                    <div className="mt-2 p-2 bg-gray-50 rounded text-xs text-gray-600">
                      <strong>Access:</strong> {folder.permission === 'read' ? 'View and download files' : folder.permission === 'write' ? 'View, download, upload, and modify files' : 'Complete control including delete operations'}
                    </div>
                  )}
                </div>
              ))}
              
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={addFolderRow}
                className="w-full border-dashed border-2 hover:border-blue-300 hover:bg-blue-50"
                disabled={loadingFolders}
              >
                <FolderPlus className="h-4 w-4 mr-2" />
                {loadingFolders ? 'Loading folders...' : 'Add Another Folder Assignment'}
              </Button>
            </div>
            
            <div className="mt-4 p-3 bg-green-50 border border-green-200 rounded-md">
              <div className="flex items-start">
                <div className="flex-shrink-0">
                  <Settings className="h-4 w-4 text-green-600 mt-0.5" />
                </div>
                <div className="ml-2 text-sm text-green-800">
                  <p className="font-medium">Folder Access Management</p>
                  <p className="mt-1">
                    Grant users access to specific S3 folders beyond their home directory. Each folder can have different permission levels for granular access control.
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div className="flex justify-end space-x-2">
            <Button type="button" variant="outline" onClick={() => {
              setShowCreateModal(false)
              setCurrentUsername('')
              setNewFolders([{ folder_path: '', permission: 'read' }])
              reset()
            }}>
              Cancel
            </Button>
            <Button type="submit" loading={isSubmitting}>
              Create User
            </Button>
          </div>
        </form>
        </div>
      </Modal>

      <Modal
        isOpen={showEditModal}
        onClose={() => setShowEditModal(false)}
        title="Edit User"
      >
        <form onSubmit={handleSubmitEdit(handleEditUser)} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700">Username</label>
            <input
              {...registerEdit('username', {
                minLength: { value: 3, message: 'Username must be at least 3 characters' },
              })}
              className="mt-1 input-field"
              placeholder="Enter username"
            />
            {errorsEdit.username && (
              <p className="mt-1 text-sm text-red-600">{errorsEdit.username.message}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">Email</label>
            <input
              {...registerEdit('email', {
                pattern: {
                  value: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
                  message: 'Invalid email address',
                },
              })}
              type="email"
              className="mt-1 input-field"
              placeholder="Enter email"
            />
            {errorsEdit.email && (
              <p className="mt-1 text-sm text-red-600">{errorsEdit.email.message}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">Role</label>
            <select {...registerEdit('role')} className="mt-1 input-field">
              <option value="">Keep current role</option>
              <option value="user">User</option>
              <option value="admin">Admin</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">New Password</label>
            <input
              {...registerEdit('password', {
                minLength: { value: 6, message: 'Password must be at least 6 characters' },
              })}
              type="password"
              className="mt-1 input-field"
              placeholder="Leave blank to keep current password"
            />
            {errorsEdit.password && (
              <p className="mt-1 text-sm text-red-600">{errorsEdit.password.message}</p>
            )}
          </div>

          <div className="flex justify-end space-x-2">
            <Button type="button" variant="outline" onClick={() => setShowEditModal(false)}>
              Cancel
            </Button>
            <Button type="submit" loading={isSubmittingEdit}>
              Update User
            </Button>
          </div>
        </form>
      </Modal>

      <Modal
        isOpen={showSshKeyModal}
        onClose={() => {
          setShowSshKeyModal(false)
          setRegeneratedSshKeys(null)
          setSshKeyInput('')
        }}
        title="Manage SSH Key & SFTP Access"
        size="lg"
      >
        <div className="space-y-6">
          <div>
            <p className="text-sm text-gray-600 mb-4">
              Manage SSH authentication for <strong>{selectedUser?.username}</strong>. You can either regenerate SSH keys for password-based authentication or manually update the SSH public key.
            </p>

            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
              <div className="flex items-start">
                <Key className="h-5 w-5 text-blue-600 mt-0.5 mr-3" />
                <div className="text-sm text-blue-800">
                  <p className="font-medium mb-1">SSH Key Management Options</p>
                  <ul className="list-disc list-inside space-y-1 text-xs">
                    <li>Regenerate SSH keys to enable password-based SFTP authentication</li>
                    <li>Reset SFTP password for existing users</li>
                    <li>Or manually paste an existing SSH public key</li>
                    <li>All changes will be synced with AWS Transfer Family</li>
                  </ul>
                </div>
              </div>
            </div>

            {!regeneratedSshKeys ? (
              <div className="space-y-4">
                <div>
                  <Button
                    onClick={regenerateSshKeys}
                    loading={regeneratingKeys}
                    disabled={regeneratingKeys}
                    className="w-full"
                  >
                    {regeneratingKeys ? (
                      <>
                        <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                        Regenerating SSH Keys...
                      </>
                    ) : (
                      <>
                        <Key className="h-4 w-4 mr-2" />
                        Regenerate SSH Keys (Enable Password Auth)
                      </>
                    )}
                  </Button>
                  <p className="mt-2 text-xs text-gray-500 text-center">
                    This will generate new SSH keys and enable password-based authentication
                  </p>
                </div>

                {!showPasswordReset && (
                  <div>
                    <Button
                      onClick={() => setShowPasswordReset(true)}
                      variant="outline"
                      className="w-full"
                    >
                      <Power className="h-4 w-4 mr-2" />
                      Reset SFTP Password
                    </Button>
                    <p className="mt-2 text-xs text-gray-500 text-center">
                      Reset the SFTP password for existing user authentication
                    </p>
                  </div>
                )}

                {showPasswordReset && (
                  <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                    <div className="space-y-3">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          New SFTP Password
                        </label>
                        <input
                          type="password"
                          value={sftpPassword}
                          onChange={(e) => setSftpPassword(e.target.value)}
                          className="input-field"
                          placeholder="Enter new SFTP password"
                          minLength={6}
                        />
                        <p className="mt-1 text-xs text-gray-500">
                          Password must be at least 6 characters long
                        </p>
                      </div>
                      <div className="flex space-x-2">
                        <Button
                          onClick={handleResetSftpPassword}
                          disabled={!sftpPassword || sftpPassword.length < 6}
                          size="sm"
                        >
                          Reset Password
                        </Button>
                        <Button
                          onClick={() => {
                            setShowPasswordReset(false)
                            setSftpPassword('')
                          }}
                          variant="outline"
                          size="sm"
                        >
                          Cancel
                        </Button>
                      </div>
                    </div>
                  </div>
                )}

                <div className="relative">
                  <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-gray-300"></div>
                  </div>
                  <div className="relative flex justify-center text-sm">
                    <span className="px-2 bg-white text-gray-500">OR</span>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Manually Update SSH Public Key
                  </label>
                  <textarea
                    value={sshKeyInput}
                    onChange={(e) => setSshKeyInput(e.target.value)}
                    className="input-field"
                    rows={4}
                    placeholder="ssh-rsa AAAAB3NzaC1yc2EAAAA... user@hostname"
                  />
                  <p className="mt-1 text-xs text-gray-500">
                    Paste your existing SSH public key here
                  </p>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                  <div className="flex items-center mb-3">
                    <CheckCircle className="h-5 w-5 text-green-600 mr-2" />
                    <span className="font-medium text-green-900">SSH Keys Successfully Regenerated!</span>
                  </div>
                  
                  <div className="space-y-3">
                    <div>
                      <label className="text-xs font-medium text-gray-700">Public Key (Will be saved to AWS Transfer Family)</label>
                      <textarea
                        value={regeneratedSshKeys.publicKey}
                        readOnly
                        className="mt-1 input-field bg-gray-50 text-xs font-mono"
                        rows={3}
                      />
                    </div>

                    <div>
                      <label className="text-xs font-medium text-gray-700">Private Key (Download and save securely)</label>
                      <div className="relative">
                        <textarea
                          value={regeneratedSshKeys.privateKey}
                          readOnly
                          className="mt-1 input-field bg-gray-50 text-xs font-mono pr-24"
                          rows={4}
                        />
                        <button
                          onClick={() => {
                            const blob = new Blob([regeneratedSshKeys.privateKey], { type: 'text/plain' })
                            const url = URL.createObjectURL(blob)
                            const a = document.createElement('a')
                            a.href = url
                            a.download = `${selectedUser?.username}_private_key.pem`
                            a.click()
                            toast.success('Private key downloaded!')
                          }}
                          className="absolute top-2 right-2 px-3 py-1 bg-blue-600 text-white text-xs rounded hover:bg-blue-700"
                        >
                          <Download className="h-3 w-3 inline mr-1" />
                          Download
                        </button>
                      </div>
                    </div>

                    <div className="bg-yellow-50 border border-yellow-200 rounded p-3">
                      <div className="flex items-start">
                        <Shield className="h-4 w-4 text-yellow-600 mt-0.5 mr-2" />
                        <div className="text-xs text-yellow-800">
                          <p className="font-medium mb-1">Important Security Notice:</p>
                          <ul className="list-disc list-inside space-y-0.5">
                            <li>Download and securely store the private key</li>
                            <li>The private key cannot be retrieved later</li>
                            <li>User can now login via SFTP using their password</li>
                            <li>Share the private key with the user through a secure channel</li>
                          </ul>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="mt-4 flex justify-end space-x-2">
                    <Button
                      onClick={() => setRegeneratedSshKeys(null)}
                      variant="outline"
                      size="sm"
                    >
                      Regenerate Again
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="flex justify-end space-x-2 pt-4 border-t">
            <Button 
              type="button" 
              variant="outline" 
              onClick={() => {
                setShowSshKeyModal(false)
                setRegeneratedSshKeys(null)
                setSshKeyInput('')
              }}
            >
              Cancel
            </Button>
            <Button 
              onClick={handleUpdateSshKey} 
              disabled={!regeneratedSshKeys?.publicKey && !sshKeyInput.trim()}
            >
              {regeneratedSshKeys ? 'Save & Update SSH Key' : 'Update SSH Key'}
            </Button>
          </div>
        </div>
      </Modal>

      <Modal
        isOpen={showFoldersModal}
        onClose={() => setShowFoldersModal(false)}
        title="Manage Folder Assignments"
        size="lg"
      >
        <div className="space-y-4">
          <div>
            <p className="text-sm text-gray-600 mb-4">
              Manage folder access permissions for <strong>{selectedUser?.username}</strong>
            </p>
            
            <div className="bg-gray-50 p-3 rounded-md mb-4">
              <div className="flex items-center text-sm text-gray-600">
                <Home className="h-4 w-4 mr-2" />
                <span>Home Directory: <strong>{(selectedUser as any)?.home_directory || `/home/${selectedUser?.username}`}</strong></span>
              </div>
              <p className="text-xs text-gray-500 mt-1">User automatically has full access to their home directory</p>
            </div>

            <div className="border border-gray-200 rounded-lg p-4 bg-gray-50">
              <div className="flex items-center justify-between mb-4">
                <label className="block text-sm font-medium text-gray-700">
                  <Folder className="h-4 w-4 inline mr-2" />
                  Additional Folder Access
                </label>
                <span className="text-xs text-gray-500 bg-white px-2 py-1 rounded">
                  {loadingFolders ? 'Loading...' : `${availableFolders.length} folders available`}
                </span>
              </div>
              
              <div className="space-y-3">
                {newFolders.map((folder, index) => (
                  <div key={index} className="bg-white border border-gray-200 rounded-md p-3">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-medium text-gray-600">
                        Folder Assignment #{index + 1}
                      </span>
                      {newFolders.length > 1 && (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => removeFolderRow(index)}
                          className="text-red-600 hover:text-red-800 border-red-200 hover:border-red-300"
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      )}
                    </div>
                    
                    <div className="grid grid-cols-3 gap-3">
                      <div className="col-span-2">
                        <label className="block text-xs font-medium text-gray-600 mb-1">Folder Path</label>
                        <select
                          value={folder.folder_path}
                          onChange={(e) => updateFolderRow(index, 'folder_path', e.target.value)}
                          className="w-full input-field text-sm"
                          disabled={loadingFolders}
                        >
                          <option value="">Select folder...</option>
                          {availableFolders.map((availableFolder) => (
                            <option key={availableFolder.path} value={availableFolder.path}>
                              📁 {availableFolder.name} ({availableFolder.path})
                            </option>
                          ))}
                        </select>
                      </div>
                      
                      <div>
                        <label className="block text-xs font-medium text-gray-600 mb-1">Permission</label>
                        <select
                          value={folder.permission}
                          onChange={(e) => updateFolderRow(index, 'permission', e.target.value)}
                          className="w-full input-field text-sm"
                        >
                          <option value="read">🔍 Read Only</option>
                          <option value="write">✏️ Read & Write</option>
                          <option value="full">🔓 Full Access</option>
                        </select>
                      </div>
                    </div>
                    
                    {folder.folder_path && (
                      <div className="mt-2 p-2 bg-gray-50 rounded text-xs text-gray-600">
                        <strong>Access:</strong> {folder.permission === 'read' ? 'View and download files' : folder.permission === 'write' ? 'View, download, upload, and modify files' : 'Complete control including delete operations'}
                      </div>
                    )}
                  </div>
                ))}
                
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={addFolderRow}
                  className="w-full border-dashed border-2 hover:border-blue-300 hover:bg-blue-50"
                  disabled={loadingFolders}
                >
                  <FolderPlus className="h-4 w-4 mr-2" />
                  {loadingFolders ? 'Loading folders...' : 'Add Another Folder Assignment'}
                </Button>
              </div>
            </div>
            <p className="mt-2 text-xs text-gray-500">
              {loadingFolders 
                ? 'Loading folders from S3 bucket...' 
                : `Specify additional folders this user can access. ${availableFolders.length} folders available from your S3 bucket.`
              }
            </p>
          </div>

          <div className="flex justify-end space-x-2">
            <Button type="button" variant="outline" onClick={() => setShowFoldersModal(false)}>
              Cancel
            </Button>
            <Button onClick={handleUpdateFolders}>
              Update Folder Assignments
            </Button>
          </div>
        </div>
      </Modal>

      <Modal
        isOpen={showAllFoldersModal}
        onClose={() => setShowAllFoldersModal(false)}
        title={`All Folder Assignments - ${selectedUserFolders?.username}`}
        size="lg"
      >
        <div className="space-y-4">
          <div>
            <p className="text-sm text-gray-600 mb-4">
              Complete list of folder assignments for <strong>{selectedUserFolders?.username}</strong>
            </p>
            
            <div className="bg-gray-50 p-3 rounded-md mb-4">
              <div className="flex items-center text-sm text-gray-600">
                <Home className="h-4 w-4 mr-2" />
                <span>Home Directory: <strong>{selectedUserFolders?.home_directory || `/home/${selectedUserFolders?.username}`}</strong></span>
              </div>
              <p className="text-xs text-gray-500 mt-1">User automatically has full access to their home directory</p>
            </div>

            {selectedUserFolders?.folder_assignments && selectedUserFolders.folder_assignments.length > 0 ? (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-medium text-gray-700 flex items-center">
                    <Folder className="h-4 w-4 mr-2" />
                    Additional Folder Access ({selectedUserFolders.folder_assignments.length})
                  </h4>
                </div>
                
                <div className="grid gap-3">
                  {selectedUserFolders.folder_assignments.map((folder: any, index: number) => {
                    const badge = getPermissionBadge(folder.permission)
                    return (
                      <div key={index} className="bg-white border border-gray-200 rounded-lg p-4 hover:shadow-sm transition-shadow">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3 flex-1">
                            <div className="flex-shrink-0">
                              <Folder className="h-5 w-5 text-gray-400" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="font-mono text-sm text-gray-900 truncate">
                                {folder.folder_path}
                              </p>
                              <p className="text-xs text-gray-500 mt-1">
                                {folder.permission === 'read' ? 'View and download files' : 
                                 folder.permission === 'write' ? 'View, download, upload, and modify files' : 
                                 'Complete control including delete operations'}
                              </p>
                            </div>
                          </div>
                          <div className="flex-shrink-0">
                            <span 
                              className={`px-2.5 py-1 rounded-full text-xs font-semibold ${badge.color}`}
                              title={badge.title}
                            >
                              {badge.label}
                            </span>
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            ) : (
              <div className="text-center py-8">
                <Folder className="h-12 w-12 text-gray-300 mx-auto mb-3" />
                <p className="text-sm text-gray-500">No additional folder assignments</p>
                <p className="text-xs text-gray-400 mt-1">This user only has access to their home directory</p>
              </div>
            )}
          </div>

          <div className="flex justify-end">
            <Button type="button" variant="outline" onClick={() => setShowAllFoldersModal(false)}>
              Close
            </Button>
          </div>
        </div>
      </Modal>

      <Modal
        isOpen={showDetailsModal}
        onClose={() => setShowDetailsModal(false)}
        title="User Details"
        size="lg"
      >
        {selectedUser && (
          <div className="space-y-6">
            <div className="bg-gray-50 rounded-lg p-6">
              <div className="flex items-center mb-4">
                <div className="h-16 w-16 bg-gradient-to-br from-blue-500 to-blue-600 rounded-full flex items-center justify-center shadow-md">
                  <span className="text-2xl font-bold text-white">
                    {selectedUser.username.charAt(0).toUpperCase()}
                  </span>
                </div>
                <div className="ml-4">
                  <h3 className="text-xl font-semibold text-gray-900">{selectedUser.username}</h3>
                  <div className="flex items-center mt-1">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getRoleColor(selectedUser.role)}`}>
                      <Shield className="h-3 w-3 mr-1" />
                      {selectedUser.role}
                    </span>
                    <span className={`ml-2 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(selectedUser.is_active)}`}>
                      {selectedUser.is_active ? (
                        <UserCheck className="h-3 w-3 mr-1" />
                      ) : (
                        <UserX className="h-3 w-3 mr-1" />
                      )}
                      {selectedUser.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-4">
                <div>
                  <label className="text-xs font-medium text-gray-500 uppercase tracking-wider">User ID</label>
                  <div className="mt-1 flex items-center">
                    <p className="text-sm text-gray-900 font-mono">{selectedUser.id}</p>
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(selectedUser.id)
                        toast.success('User ID copied!')
                      }}
                      className="ml-2 text-gray-400 hover:text-gray-600"
                    >
                      <Copy className="h-4 w-4" />
                    </button>
                  </div>
                </div>

                <div>
                  <label className="text-xs font-medium text-gray-500 uppercase tracking-wider">Email</label>
                  <p className="mt-1 text-sm text-gray-900 flex items-center">
                    <Mail className="h-4 w-4 mr-2 text-gray-400" />
                    {selectedUser.email}
                  </p>
                </div>

                <div>
                  <label className="text-xs font-medium text-gray-500 uppercase tracking-wider">Created</label>
                  <p className="mt-1 text-sm text-gray-900 flex items-center">
                    <Calendar className="h-4 w-4 mr-2 text-gray-400" />
                    {formatDate(selectedUser.created_at)}
                  </p>
                </div>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="text-xs font-medium text-gray-500 uppercase tracking-wider">Home Directory</label>
                  <p className="mt-1 text-sm text-gray-900 flex items-center">
                    <Home className="h-4 w-4 mr-2 text-gray-400" />
                    {(selectedUser as any).home_directory || `/home/${selectedUser.username}`}
                  </p>
                </div>

                <div>
                  <label className="text-xs font-medium text-gray-500 uppercase tracking-wider">Last Login</label>
                  <p className="mt-1 text-sm text-gray-900">
                    {selectedUser.last_login ? formatDate(selectedUser.last_login, 'relative') : 'Never'}
                  </p>
                </div>

                <div>
                  <label className="text-xs font-medium text-gray-500 uppercase tracking-wider">SFTP Access</label>
                  <p className="mt-1 text-sm text-gray-900">
                    {(selectedUser as any).folder_assignments?.length > 0 ? (
                      <span className="text-green-600 flex items-center">
                        <CheckCircle className="h-4 w-4 mr-1" />
                        Enabled ({(selectedUser as any).folder_assignments.length} folders)
                      </span>
                    ) : (
                      <span className="text-gray-500 flex items-center">
                        <UserX className="h-4 w-4 mr-1" />
                        Disabled
                      </span>
                    )}
                  </p>
                </div>
              </div>
            </div>

            {(selectedUser as any).folder_assignments?.length > 0 && (
              <div>
                <label className="text-xs font-medium text-gray-500 uppercase tracking-wider">Folder Assignments</label>
                <div className="mt-2 space-y-2">
                  {(selectedUser as any).folder_assignments.map((folder: any, index: number) => (
                    <div key={index} className="flex items-center justify-between bg-gray-50 p-3 rounded-md">
                      <div className="flex items-center">
                        <Folder className="h-4 w-4 text-gray-400 mr-2" />
                        <span className="text-sm text-gray-900 font-mono">{folder.folder_path}</span>
                      </div>
                      <span className={`px-2 py-1 rounded text-xs font-medium ${
                        folder.permission === 'full' ? 'bg-purple-100 text-purple-700' :
                        folder.permission === 'write' ? 'bg-blue-100 text-blue-700' :
                        'bg-gray-100 text-gray-700'
                      }`}>
                        {folder.permission}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="flex justify-end space-x-2 pt-4 border-t">
              <Button
                onClick={() => {
                  openEditModal(selectedUser)
                  setShowDetailsModal(false)
                }}
                variant="outline"
              >
                <Edit className="h-4 w-4 mr-2" />
                Edit User
              </Button>
              <Button
                onClick={() => setShowDetailsModal(false)}
                variant="primary"
              >
                Close
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}

export default Users