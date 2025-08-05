import React, { useState, useEffect } from 'react'
import { 
  Users, 
  FolderOpen, 
  HardDrive, 
  Activity,
  TrendingUp,
  Download,
  Upload,
  Server
} from 'lucide-react'
import { statsAPI } from '@/services/api'
import { DashboardStats } from '@/types'
import { formatBytes } from '@/utils'
import LoadingSpinner from '@/components/ui/LoadingSpinner'

const StatCard: React.FC<{
  title: string
  value: string
  change?: string
  changeType?: 'positive' | 'negative'
  icon: React.ReactNode
}> = ({ title, value, change, changeType, icon }) => (
  <div className="card">
    <div className="flex items-center">
      <div className="flex-shrink-0">
        <div className="h-8 w-8 bg-primary-100 rounded-lg flex items-center justify-center">
          {icon}
        </div>
      </div>
      <div className="ml-4 flex-1">
        <p className="text-sm font-medium text-gray-600">{title}</p>
        <p className="text-2xl font-semibold text-gray-900">{value}</p>
        {change && (
          <p className={`text-sm ${changeType === 'positive' ? 'text-green-600' : 'text-red-600'}`}>
            {change}
          </p>
        )}
      </div>
    </div>
  </div>
)

const Dashboard: React.FC = () => {
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadDashboardStats()
  }, [])

  const loadDashboardStats = async () => {
    try {
      const response = await statsAPI.getDashboardStats()
      setStats(response.data)
    } catch (error) {
      console.error('Failed to load dashboard stats:', error)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <LoadingSpinner size="lg" />
      </div>
    )
  }

  if (!stats) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500">Failed to load dashboard data</p>
      </div>
    )
  }

  const storagePercentage = (stats.usedStorage / stats.totalStorage) * 100

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Dashboard</h1>
        <p className="mt-2 text-gray-600">Welcome back! Here's what's happening.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard
          title="Total Users"
          value={stats.totalUsers.toString()}
          change="+12% from last month"
          changeType="positive"
          icon={<Users className="h-5 w-5 text-primary-600" />}
        />
        
        <StatCard
          title="Active Users"
          value={stats.activeUsers.toString()}
          change="+5% from last week"
          changeType="positive"
          icon={<Activity className="h-5 w-5 text-green-600" />}
        />
        
        <StatCard
          title="Total Files"
          value={stats.totalFiles.toLocaleString()}
          change="+23% from last month"
          changeType="positive"
          icon={<FolderOpen className="h-5 w-5 text-blue-600" />}
        />
        
        <StatCard
          title="Storage Used"
          value={formatBytes(stats.usedStorage)}
          change={`${storagePercentage.toFixed(1)}% of total`}
          icon={<HardDrive className="h-5 w-5 text-orange-600" />}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="card">
          <h3 className="text-lg font-medium text-gray-900 mb-4">System Load</h3>
          <div className="space-y-4">
            <div>
              <div className="flex justify-between text-sm mb-1">
                <span>CPU Usage</span>
                <span>{stats.systemLoad.cpu}%</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div 
                  className="bg-blue-600 h-2 rounded-full" 
                  style={{ width: `${stats.systemLoad.cpu}%` }}
                ></div>
              </div>
            </div>
            
            <div>
              <div className="flex justify-between text-sm mb-1">
                <span>Memory Usage</span>
                <span>{stats.systemLoad.memory}%</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div 
                  className="bg-green-600 h-2 rounded-full" 
                  style={{ width: `${stats.systemLoad.memory}%` }}
                ></div>
              </div>
            </div>
            
            <div>
              <div className="flex justify-between text-sm mb-1">
                <span>Disk Usage</span>
                <span>{stats.systemLoad.disk}%</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div 
                  className="bg-orange-600 h-2 rounded-full" 
                  style={{ width: `${stats.systemLoad.disk}%` }}
                ></div>
              </div>
            </div>
          </div>
        </div>

        <div className="card">
          <h3 className="text-lg font-medium text-gray-900 mb-4">Recent Activity</h3>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <div className="h-8 w-8 bg-green-100 rounded-full flex items-center justify-center">
                  <Upload className="h-4 w-4 text-green-600" />
                </div>
                <div className="ml-3">
                  <p className="text-sm font-medium text-gray-900">Recent Uploads</p>
                  <p className="text-sm text-gray-500">Last 24 hours</p>
                </div>
              </div>
              <span className="text-2xl font-semibold text-gray-900">
                {stats.recentUploads}
              </span>
            </div>
            
            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <div className="h-8 w-8 bg-blue-100 rounded-full flex items-center justify-center">
                  <Download className="h-4 w-4 text-blue-600" />
                </div>
                <div className="ml-3">
                  <p className="text-sm font-medium text-gray-900">Recent Downloads</p>
                  <p className="text-sm text-gray-500">Last 24 hours</p>
                </div>
              </div>
              <span className="text-2xl font-semibold text-gray-900">
                {stats.recentDownloads}
              </span>
            </div>
          </div>
        </div>
      </div>

      <div className="card">
        <h3 className="text-lg font-medium text-gray-900 mb-4">Storage Overview</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="text-center">
            <div className="text-3xl font-bold text-gray-900">{formatBytes(stats.totalStorage)}</div>
            <div className="text-sm text-gray-500">Total Storage</div>
          </div>
          <div className="text-center">
            <div className="text-3xl font-bold text-primary-600">{formatBytes(stats.usedStorage)}</div>
            <div className="text-sm text-gray-500">Used Storage</div>
          </div>
          <div className="text-center">
            <div className="text-3xl font-bold text-green-600">
              {formatBytes(stats.totalStorage - stats.usedStorage)}
            </div>
            <div className="text-sm text-gray-500">Available Storage</div>
          </div>
        </div>
        
        <div className="mt-6">
          <div className="flex justify-between text-sm mb-2">
            <span>Storage Usage</span>
            <span>{storagePercentage.toFixed(1)}%</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-3">
            <div 
              className={`h-3 rounded-full ${
                storagePercentage > 90 ? 'bg-red-600' : 
                storagePercentage > 75 ? 'bg-orange-600' : 
                'bg-green-600'
              }`}
              style={{ width: `${storagePercentage}%` }}
            ></div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default Dashboard