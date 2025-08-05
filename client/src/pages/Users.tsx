import React, { useState, useEffect } from 'react'
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
  Settings
} from 'lucide-react'
import { userAPI } from '@/services/api'
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
  const [selectedUser, setSelectedUser] = useState<User | null>(null)
  const [sshKeyInput, setSshKeyInput] = useState('')
  const [userFolders, setUserFolders] = useState<FolderAssignment[]>([])
  const [newFolders, setNewFolders] = useState<FolderAssignment[]>([{ folder_path: '', permission: 'read' }])
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 10,
    total: 0,
    totalPages: 0,
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
  }, [pagination.page, searchQuery])

  const loadUsers = async () => {
    setLoading(true)
    try {
      const response = await userAPI.getUsers({
        page: pagination.page,
        limit: pagination.limit,
        search: searchQuery || undefined,
      })
      setUsers(response.data.data)
      setPagination(prev => ({
        ...prev,
        total: response.data.pagination.total,
        totalPages: response.data.pagination.totalPages,
      }))
    } catch (error) {
      console.error('Failed to load users:', error)
      toast.error('Failed to load users')
    } finally {
      setLoading(false)
    }
  }

  const handleCreateUser = async (data: UserFormData) => {
    try {
      const userData = {
        ...data,
        home_directory: data.home_directory || `/home/${data.username}`,
        folder_assignments: newFolders.filter(f => f.folder_path.trim())
      }
      await userAPI.createUser(userData)
      toast.success('User created successfully')
      setShowCreateModal(false)
      reset()
      setNewFolders([{ folder_path: '', permission: 'read' }])
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
    if (confirm(`Are you sure you want to delete user "${username}"?`)) {
      try {
        await userAPI.deleteUser(userId)
        toast.success('User deleted successfully')
        loadUsers()
      } catch (error: any) {
        toast.error(error.response?.data?.message || 'Failed to delete user')
      }
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

  const handleUpdateSshKey = async () => {
    if (!selectedUser || !sshKeyInput.trim()) return

    try {
      await userAPI.updateSftpSshKey(selectedUser.id, sshKeyInput.trim())
      toast.success('SSH key updated successfully')
      setShowSshKeyModal(false)
      setSshKeyInput('')
      setSelectedUser(null)
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to update SSH key')
    }
  }

  const getRoleColor = (role: string) => {
    return role === 'admin' ? 'text-purple-600 bg-purple-100' : 'text-blue-600 bg-blue-100'
  }

  const getStatusColor = (is_active: boolean) => {
    return is_active ? 'text-green-600 bg-green-100' : 'text-red-600 bg-red-100'
  }

  const filteredUsers = users.filter(user =>
    user.username.toLowerCase().includes(searchQuery.toLowerCase()) ||
    user.email.toLowerCase().includes(searchQuery.toLowerCase())
  )

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Users</h1>
          <p className="mt-2 text-gray-600">Manage system users and their permissions</p>
        </div>
        <Button onClick={() => setShowCreateModal(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Add User
        </Button>
      </div>

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
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      User
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Role
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Home Directory
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Last Login
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {filteredUsers.map((user) => (
                    <tr key={user.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <div className="h-10 w-10 bg-primary-600 rounded-full flex items-center justify-center">
                            <span className="text-sm font-medium text-white">
                              {user.username.charAt(0).toUpperCase()}
                            </span>
                          </div>
                          <div className="ml-4">
                            <div className="text-sm font-medium text-gray-900">
                              {user.username}
                            </div>
                            <div className="text-sm text-gray-500 flex items-center">
                              <Mail className="h-3 w-3 mr-1" />
                              {user.email}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getRoleColor(user.role)}`}>
                          <Shield className="h-3 w-3 mr-1" />
                          {user.role}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        <div className="flex items-center">
                          <Home className="h-3 w-3 mr-1" />
                          {(user as any).home_directory || `/home/${user.username}`}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(user.is_active)}`}>
                          {user.is_active ? (
                            <UserCheck className="h-3 w-3 mr-1" />
                          ) : (
                            <UserX className="h-3 w-3 mr-1" />
                          )}
                          {user.is_active ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {user.last_login ? (
                          <div className="flex items-center">
                            <Calendar className="h-3 w-3 mr-1" />
                            {formatDate(user.last_login, 'relative')}
                          </div>
                        ) : (
                          'Never'
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <div className="flex items-center justify-end space-x-2">
                          <Button
                            onClick={() => openFoldersModal(user)}
                            variant="outline"
                            size="sm"
                            title="Manage Folders"
                          >
                            <Folder className="h-3 w-3" />
                          </Button>
                          <Button
                            onClick={() => openSshKeyModal(user)}
                            variant="outline"
                            size="sm"
                            title="Manage SSH Key"
                          >
                            <Key className="h-3 w-3" />
                          </Button>
                          <Button
                            onClick={() => openEditModal(user)}
                            variant="outline"
                            size="sm"
                            title="Edit User"
                          >
                            <Edit className="h-3 w-3" />
                          </Button>
                          <Button
                            onClick={() => handleDeleteUser(user.id, user.username)}
                            variant="danger"
                            size="sm"
                            title="Delete User"
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
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
      >
        <form onSubmit={handleSubmit(handleCreateUser)} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700">Username</label>
            <input
              {...register('username', {
                required: 'Username is required',
                minLength: { value: 3, message: 'Username must be at least 3 characters' },
              })}
              className="mt-1 input-field"
              placeholder="Enter username"
            />
            {errors.username && (
              <p className="mt-1 text-sm text-red-600">{errors.username.message}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">Email</label>
            <input
              {...register('email', {
                required: 'Email is required',
                pattern: {
                  value: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
                  message: 'Invalid email address',
                },
              })}
              type="email"
              className="mt-1 input-field"
              placeholder="Enter email"
            />
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
            <label className="block text-sm font-medium text-gray-700">Home Directory</label>
            <input
              {...register('home_directory')}
              className="mt-1 input-field"
              placeholder={`/home/username (auto-generated if empty)`}
            />
            <p className="mt-1 text-xs text-gray-500">
              User's home directory path. Will default to /home/username if not specified.
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">SSH Public Key (Optional)</label>
            <textarea
              {...register('ssh_public_key')}
              className="mt-1 input-field"
              rows={3}
              placeholder="ssh-rsa AAAA... (optional - for SFTP access)"
            />
            <p className="mt-1 text-xs text-gray-500">
              Optional SSH public key for SFTP access. If provided, will be automatically configured in AWS Transfer Family.
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">Folder Assignments</label>
            <div className="mt-2 space-y-2">
              {newFolders.map((folder, index) => (
                <div key={index} className="flex space-x-2">
                  <input
                    value={folder.folder_path}
                    onChange={(e) => updateFolderRow(index, 'folder_path', e.target.value)}
                    className="flex-1 input-field"
                    placeholder="/path/to/folder"
                  />
                  <select
                    value={folder.permission}
                    onChange={(e) => updateFolderRow(index, 'permission', e.target.value)}
                    className="input-field w-24"
                  >
                    <option value="read">Read</option>
                    <option value="write">Write</option>
                    <option value="full">Full</option>
                  </select>
                  {newFolders.length > 1 && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => removeFolderRow(index)}
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  )}
                </div>
              ))}
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={addFolderRow}
                className="w-full"
              >
                <FolderPlus className="h-3 w-3 mr-2" />
                Add Folder
              </Button>
            </div>
            <p className="mt-1 text-xs text-gray-500">
              Additional folders this user can access beyond their home directory.
            </p>
          </div>

          <div className="flex justify-end space-x-2">
            <Button type="button" variant="outline" onClick={() => setShowCreateModal(false)}>
              Cancel
            </Button>
            <Button type="submit" loading={isSubmitting}>
              Create User
            </Button>
          </div>
        </form>
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
        onClose={() => setShowSshKeyModal(false)}
        title="Manage SSH Key"
      >
        <div className="space-y-4">
          <div>
            <p className="text-sm text-gray-600 mb-4">
              Update the SSH public key for <strong>{selectedUser?.username}</strong> in AWS Transfer Family SFTP.
            </p>
            
            <label className="block text-sm font-medium text-gray-700">SSH Public Key</label>
            <textarea
              value={sshKeyInput}
              onChange={(e) => setSshKeyInput(e.target.value)}
              className="mt-1 input-field"
              rows={4}
              placeholder="ssh-rsa AAAAB3NzaC1yc2EAAAA... user@hostname"
            />
            <p className="mt-1 text-xs text-gray-500">
              Paste the complete SSH public key. This will be configured for SFTP access in AWS Transfer Family.
            </p>
          </div>

          <div className="flex justify-end space-x-2">
            <Button type="button" variant="outline" onClick={() => setShowSshKeyModal(false)}>
              Cancel
            </Button>
            <Button 
              onClick={handleUpdateSshKey} 
              disabled={!sshKeyInput.trim()}
            >
              Update SSH Key
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

            <label className="block text-sm font-medium text-gray-700 mb-2">Additional Folder Access</label>
            <div className="space-y-2">
              {newFolders.map((folder, index) => (
                <div key={index} className="flex space-x-2">
                  <input
                    value={folder.folder_path}
                    onChange={(e) => updateFolderRow(index, 'folder_path', e.target.value)}
                    className="flex-1 input-field"
                    placeholder="/path/to/folder"
                  />
                  <select
                    value={folder.permission}
                    onChange={(e) => updateFolderRow(index, 'permission', e.target.value)}
                    className="input-field w-32"
                  >
                    <option value="read">Read Only</option>
                    <option value="write">Read & Write</option>
                    <option value="full">Full Access</option>
                  </select>
                  {newFolders.length > 1 && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => removeFolderRow(index)}
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  )}
                </div>
              ))}
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={addFolderRow}
                className="w-full"
              >
                <FolderPlus className="h-3 w-3 mr-2" />
                Add Another Folder
              </Button>
            </div>
            <p className="mt-2 text-xs text-gray-500">
              Specify additional folders this user can access. Each folder can have different permission levels.
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
    </div>
  )
}

export default Users