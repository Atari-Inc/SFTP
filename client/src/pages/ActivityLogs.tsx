import React, { useState, useEffect } from 'react'
import { 
  Filter, 
  Download, 
  Calendar,
  User,
  Activity as ActivityIcon,
  Search,
  RefreshCw,
  FileText,
  AlertCircle,
  CheckCircle,
  XCircle
} from 'lucide-react'
import { activityAPI } from '@/services/api'
import { ActivityLog } from '@/types'
import { formatDate } from '@/utils'
import Button from '@/components/ui/Button'
import LoadingSpinner from '@/components/ui/LoadingSpinner'
import Modal from '@/components/ui/Modal'

const ActivityLogs: React.FC = () => {
  const [logs, setLogs] = useState<ActivityLog[]>([])
  const [loading, setLoading] = useState(true)
  const [filters, setFilters] = useState({
    search: '',
    action: '',
    status: '',
    startDate: '',
    endDate: '',
    userId: '',
  })
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 20,
    total: 0,
    totalPages: 0,
  })
  const [showFilters, setShowFilters] = useState(false)
  const [selectedLog, setSelectedLog] = useState<ActivityLog | null>(null)

  useEffect(() => {
    loadActivityLogs()
  }, [pagination.page, filters])

  const loadActivityLogs = async () => {
    setLoading(true)
    try {
      const params = {
        page: pagination.page,
        limit: pagination.limit,
        ...Object.fromEntries(
          Object.entries(filters).filter(([_, value]) => value !== '')
        ),
      }
      
      const response = await activityAPI.getLogs(params)
      setLogs(response.data.data)
      setPagination(prev => ({
        ...prev,
        total: response.data.pagination.total,
        totalPages: response.data.pagination.totalPages,
      }))
    } catch (error) {
      console.error('Failed to load activity logs:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleFilterChange = (key: string, value: string) => {
    setFilters(prev => ({ ...prev, [key]: value }))
    setPagination(prev => ({ ...prev, page: 1 }))
  }

  const handleExport = async (format: 'csv' | 'json') => {
    try {
      const response = await activityAPI.exportLogs({
        ...Object.fromEntries(
          Object.entries(filters).filter(([_, value]) => value !== '')
        ),
        format,
      })
      
      const url = window.URL.createObjectURL(new Blob([response.data]))
      const link = document.createElement('a')
      link.href = url
      link.setAttribute('download', `activity-logs.${format}`)
      document.body.appendChild(link)
      link.click()
      link.remove()
      window.URL.revokeObjectURL(url)
    } catch (error) {
      console.error('Failed to export logs:', error)
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'success':
        return <CheckCircle className="h-4 w-4 text-green-600" />
      case 'failure':
        return <XCircle className="h-4 w-4 text-red-600" />
      default:
        return <AlertCircle className="h-4 w-4 text-yellow-600" />
    }
  }

  const getActionColor = (action: string) => {
    const actionLower = action.toLowerCase()
    if (actionLower.includes('login') || actionLower.includes('auth')) return 'text-blue-600'
    if (actionLower.includes('upload') || actionLower.includes('create')) return 'text-green-600'
    if (actionLower.includes('delete') || actionLower.includes('remove')) return 'text-red-600'
    if (actionLower.includes('download') || actionLower.includes('view')) return 'text-purple-600'
    if (actionLower.includes('update') || actionLower.includes('modify')) return 'text-orange-600'
    return 'text-gray-600'
  }

  const clearFilters = () => {
    setFilters({
      search: '',
      action: '',
      status: '',
      startDate: '',
      endDate: '',
      userId: '',
    })
    setPagination(prev => ({ ...prev, page: 1 }))
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Activity Logs</h1>
          <p className="mt-2 text-gray-600">Track all system activities and user actions</p>
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
          <Button onClick={loadActivityLogs} variant="outline">
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
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
                  placeholder="Search logs..."
                  className="pl-10 input-field"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Action
              </label>
              <select
                value={filters.action}
                onChange={(e) => handleFilterChange('action', e.target.value)}
                className="input-field"
              >
                <option value="">All Actions</option>
                <option value="login">Login</option>
                <option value="logout">Logout</option>
                <option value="upload">Upload</option>
                <option value="download">Download</option>
                <option value="delete">Delete</option>
                <option value="create">Create</option>
                <option value="update">Update</option>
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
                <option value="success">Success</option>
                <option value="failure">Failure</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Start Date
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
                End Date
              </label>
              <input
                type="date"
                value={filters.endDate}
                onChange={(e) => handleFilterChange('endDate', e.target.value)}
                className="input-field"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                User ID
              </label>
              <input
                type="text"
                value={filters.userId}
                onChange={(e) => handleFilterChange('userId', e.target.value)}
                placeholder="Filter by user ID"
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

      <div className="card">
        {loading ? (
          <div className="flex items-center justify-center h-32">
            <LoadingSpinner size="lg" />
          </div>
        ) : logs.length === 0 ? (
          <div className="text-center py-12">
            <ActivityIcon className="mx-auto h-12 w-12 text-gray-400" />
            <h3 className="mt-2 text-sm font-medium text-gray-900">No activity logs</h3>
            <p className="mt-1 text-sm text-gray-500">
              No logs match your current filters.
            </p>
          </div>
        ) : (
          <>
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
                      Resource
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      IP Address
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {logs.map((log) => (
                    <tr
                      key={log.id}
                      className="hover:bg-gray-50 cursor-pointer"
                      onClick={() => setSelectedLog(log)}
                    >
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {formatDate(log.timestamp, 'long')}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <User className="h-4 w-4 text-gray-400 mr-2" />
                          <div>
                            <div className="text-sm font-medium text-gray-900">
                              {log.username}
                            </div>
                            <div className="text-sm text-gray-500">
                              {log.userId}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`text-sm font-medium ${getActionColor(log.action)}`}>
                          {log.action}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {log.resource}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          {getStatusIcon(log.status)}
                          <span className={`ml-2 text-sm capitalize ${
                            log.status === 'success' ? 'text-green-600' : 'text-red-600'
                          }`}>
                            {log.status}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {log.ipAddress}
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
        isOpen={!!selectedLog}
        onClose={() => setSelectedLog(null)}
        title="Activity Log Details"
      >
        {selectedLog && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">Timestamp</label>
                <p className="text-sm text-gray-900">{formatDate(selectedLog.timestamp, 'long')}</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Status</label>
                <div className="flex items-center">
                  {getStatusIcon(selectedLog.status)}
                  <span className={`ml-2 text-sm capitalize ${
                    selectedLog.status === 'success' ? 'text-green-600' : 'text-red-600'
                  }`}>
                    {selectedLog.status}
                  </span>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">User</label>
                <p className="text-sm text-gray-900">{selectedLog.username}</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">User ID</label>
                <p className="text-sm text-gray-900">{selectedLog.userId}</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Action</label>
                <p className={`text-sm font-medium ${getActionColor(selectedLog.action)}`}>
                  {selectedLog.action}
                </p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Resource</label>
                <p className="text-sm text-gray-900">{selectedLog.resource}</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">IP Address</label>
                <p className="text-sm text-gray-900">{selectedLog.ipAddress}</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Resource ID</label>
                <p className="text-sm text-gray-900">{selectedLog.resourceId || 'N/A'}</p>
              </div>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700">User Agent</label>
              <p className="text-sm text-gray-900 break-all">{selectedLog.userAgent}</p>
            </div>
            
            {selectedLog.details && Object.keys(selectedLog.details).length > 0 && (
              <div>
                <label className="block text-sm font-medium text-gray-700">Details</label>
                <pre className="text-sm text-gray-900 bg-gray-100 p-3 rounded-lg overflow-x-auto">
                  {JSON.stringify(selectedLog.details, null, 2)}
                </pre>
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  )
}

export default ActivityLogs