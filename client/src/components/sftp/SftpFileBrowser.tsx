import React, { useState, useEffect, useCallback } from 'react'
import { 
  FolderOpen, 
  File, 
  Upload, 
  Download, 
  Trash2, 
  Edit3, 
  Move, 
  Copy, 
  FolderPlus,
  RefreshCw,
  ArrowLeft,
  ArrowRight,
  MoreHorizontal,
  Eye,
  Share,
  CheckSquare,
  Square
} from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import sftpService, { SftpFile, SftpConnection } from '@/services/sftpService'
import toast from 'react-hot-toast'

interface SftpFileBrowserProps {
  activeConnection: SftpConnection | null
  connections: SftpConnection[]
}

interface FileItem extends SftpFile {
  selected?: boolean
}

const SftpFileBrowser: React.FC<SftpFileBrowserProps> = ({ activeConnection, connections }) => {
  const { user } = useAuth()
  const [files, setFiles] = useState<FileItem[]>([])
  const [currentPath, setCurrentPath] = useState('/')
  const [pathHistory, setPathHistory] = useState<string[]>(['/'])
  const [historyIndex, setHistoryIndex] = useState(0)
  const [isLoading, setIsLoading] = useState(false)
  const [selectedFiles, setSelectedFiles] = useState<string[]>([])
  const [showUploadModal, setShowUploadModal] = useState(false)
  const [showCreateFolderModal, setShowCreateFolderModal] = useState(false)
  const [newFolderName, setNewFolderName] = useState('')
  const [uploadFiles, setUploadFiles] = useState<FileList | null>(null)

  // Load files when connection or path changes
  const loadFiles = useCallback(async (path: string = currentPath) => {
    if (!activeConnection) {
      setFiles([])
      return
    }

    setIsLoading(true)
    try {
      const response = await sftpService.listRemoteFiles(activeConnection.id, path)
      const fileItems: FileItem[] = response.files.map(file => ({
        ...file,
        selected: false
      }))
      
      // Add parent directory navigation if not at root
      if (path !== '/') {
        fileItems.unshift({
          name: '..',
          size: 0,
          is_directory: true,
          permissions: '755',
          modified: '',
          selected: false
        })
      }
      
      setFiles(fileItems)
      setSelectedFiles([])
    } catch (error: any) {
      console.error('Error loading files:', error)
      toast.error('Failed to load files from SFTP server')
      setFiles([])
    } finally {
      setIsLoading(false)
    }
  }, [activeConnection, currentPath])

  useEffect(() => {
    loadFiles()
  }, [loadFiles])

  const navigateToPath = (path: string) => {
    if (path === '..') {
      // Navigate to parent directory
      const parentPath = currentPath.split('/').slice(0, -1).join('/') || '/'
      path = parentPath
    }

    setCurrentPath(path)
    
    // Update history
    const newHistory = pathHistory.slice(0, historyIndex + 1)
    newHistory.push(path)
    setPathHistory(newHistory)
    setHistoryIndex(newHistory.length - 1)
    
    loadFiles(path)
  }

  const navigateBack = () => {
    if (historyIndex > 0) {
      const newIndex = historyIndex - 1
      setHistoryIndex(newIndex)
      const path = pathHistory[newIndex]
      setCurrentPath(path)
      loadFiles(path)
    }
  }

  const navigateForward = () => {
    if (historyIndex < pathHistory.length - 1) {
      const newIndex = historyIndex + 1
      setHistoryIndex(newIndex)
      const path = pathHistory[newIndex]
      setCurrentPath(path)
      loadFiles(path)
    }
  }

  const toggleFileSelection = (fileName: string) => {
    if (fileName === '..') return
    
    setSelectedFiles(prev => 
      prev.includes(fileName) 
        ? prev.filter(f => f !== fileName)
        : [...prev, fileName]
    )
  }

  const selectAllFiles = () => {
    const selectableFiles = files.filter(f => f.name !== '..')
    if (selectedFiles.length === selectableFiles.length) {
      setSelectedFiles([])
    } else {
      setSelectedFiles(selectableFiles.map(f => f.name))
    }
  }

  const handleFileDoubleClick = (file: FileItem) => {
    if (file.is_directory) {
      if (file.name === '..') {
        navigateToPath('..')
      } else {
        const newPath = currentPath === '/' ? `/${file.name}` : `${currentPath}/${file.name}`
        navigateToPath(newPath)
      }
    } else {
      // Handle file double-click (preview or download)
      handleDownloadFile([file.name])
    }
  }

  const handleUploadFiles = async () => {
    if (!uploadFiles || !activeConnection) return

    for (let i = 0; i < uploadFiles.length; i++) {
      const file = uploadFiles[i]
      try {
        // Note: This is a placeholder - actual SFTP upload would need proper implementation
        toast.info(`Uploading ${file.name} via SFTP - Implementation needed`)
        
        // Simulate upload progress
        await new Promise(resolve => setTimeout(resolve, 1000))
        
      } catch (error) {
        toast.error(`Failed to upload ${file.name}`)
      }
    }
    
    setShowUploadModal(false)
    setUploadFiles(null)
    loadFiles()
  }

  const handleDownloadFile = async (fileNames: string[]) => {
    if (!activeConnection) return

    for (const fileName of fileNames) {
      try {
        // Note: This is a placeholder - actual SFTP download would need proper implementation
        toast.info(`Downloading ${fileName} via SFTP - Implementation needed`)
        
        // Simulate download
        await new Promise(resolve => setTimeout(resolve, 1000))
        
      } catch (error) {
        toast.error(`Failed to download ${fileName}`)
      }
    }
  }

  const handleDeleteFiles = async (fileNames: string[]) => {
    if (!activeConnection || fileNames.length === 0) return

    const confirmed = confirm(`Are you sure you want to delete ${fileNames.length} file(s)?`)
    if (!confirmed) return

    for (const fileName of fileNames) {
      try {
        // Note: This is a placeholder - actual SFTP delete would need proper implementation
        toast.info(`Deleting ${fileName} via SFTP - Implementation needed`)
        
      } catch (error) {
        toast.error(`Failed to delete ${fileName}`)
      }
    }
    
    loadFiles()
    setSelectedFiles([])
  }

  const handleCreateFolder = async () => {
    if (!activeConnection || !newFolderName.trim()) return

    try {
      // Note: This is a placeholder - actual SFTP mkdir would need proper implementation
      toast.info(`Creating folder ${newFolderName} via SFTP - Implementation needed`)
      
      setShowCreateFolderModal(false)
      setNewFolderName('')
      loadFiles()
    } catch (error) {
      toast.error('Failed to create folder')
    }
  }

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 B'
    const k = 1024
    const sizes = ['B', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`
  }

  const getFileIcon = (file: FileItem) => {
    if (file.is_directory) {
      return <FolderOpen className="h-5 w-5 text-blue-500" />
    }
    return <File className="h-5 w-5 text-gray-500" />
  }

  if (!activeConnection) {
    return (
      <div className="text-center py-12">
        <FolderOpen className="h-16 w-16 mx-auto mb-4 text-gray-300" />
        <h3 className="text-lg font-medium text-gray-900 mb-2">No Active SFTP Connection</h3>
        <p className="text-gray-500 mb-4">
          Establish an SFTP connection to browse and manage remote files
        </p>
        {connections.length > 0 && (
          <p className="text-sm text-gray-400">
            Available connections: {connections.length}
          </p>
        )}
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex items-center justify-between bg-white border border-gray-200 rounded-lg p-4">
        <div className="flex items-center space-x-4">
          {/* Navigation */}
          <div className="flex items-center space-x-2">
            <button
              onClick={navigateBack}
              disabled={historyIndex <= 0}
              className="p-2 rounded-lg bg-gray-100 hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <ArrowLeft className="h-4 w-4" />
            </button>
            <button
              onClick={navigateForward}
              disabled={historyIndex >= pathHistory.length - 1}
              className="p-2 rounded-lg bg-gray-100 hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <ArrowRight className="h-4 w-4" />
            </button>
            <button
              onClick={() => loadFiles()}
              className="p-2 rounded-lg bg-gray-100 hover:bg-gray-200"
            >
              <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
            </button>
          </div>

          {/* Path Breadcrumb */}
          <div className="flex items-center space-x-1 text-sm bg-gray-50 rounded-lg px-3 py-2">
            <span className="text-gray-600">Path:</span>
            <span className="font-mono text-gray-900">{currentPath}</span>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center space-x-2">
          {selectedFiles.length > 0 && (
            <>
              <button
                onClick={() => handleDownloadFile(selectedFiles)}
                className="flex items-center px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                <Download className="h-4 w-4 mr-2" />
                Download ({selectedFiles.length})
              </button>
              <button
                onClick={() => handleDeleteFiles(selectedFiles)}
                className="flex items-center px-3 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Delete ({selectedFiles.length})
              </button>
            </>
          )}
          <button
            onClick={() => setShowUploadModal(true)}
            className="flex items-center px-3 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
          >
            <Upload className="h-4 w-4 mr-2" />
            Upload
          </button>
          <button
            onClick={() => setShowCreateFolderModal(true)}
            className="flex items-center px-3 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700"
          >
            <FolderPlus className="h-4 w-4 mr-2" />
            New Folder
          </button>
        </div>
      </div>

      {/* Connection Info */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-3 h-3 bg-green-500 rounded-full"></div>
            <span className="text-sm font-medium text-blue-900">
              Connected to: {activeConnection.username}@{activeConnection.host}:{activeConnection.port}
            </span>
          </div>
          <div className="text-xs text-blue-600">
            {activeConnection.filesTransferred} files • {formatFileSize(activeConnection.bytesTransferred)} transferred
          </div>
        </div>
      </div>

      {/* File List */}
      <div className="bg-white border border-gray-200 rounded-lg">
        {/* Header */}
        <div className="border-b border-gray-200 px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <button
                onClick={selectAllFiles}
                className="flex items-center space-x-2 text-sm text-gray-600 hover:text-gray-900"
              >
                {selectedFiles.length === files.filter(f => f.name !== '..').length && files.length > 1 ? (
                  <CheckSquare className="h-4 w-4" />
                ) : (
                  <Square className="h-4 w-4" />
                )}
                <span>Select All</span>
              </button>
              <span className="text-sm text-gray-500">
                {files.length} items
                {selectedFiles.length > 0 && ` (${selectedFiles.length} selected)`}
              </span>
            </div>
          </div>
        </div>

        {/* File List */}
        <div className="divide-y divide-gray-100">
          {isLoading ? (
            <div className="text-center py-8">
              <RefreshCw className="h-8 w-8 mx-auto mb-2 text-gray-400 animate-spin" />
              <p className="text-gray-500">Loading files...</p>
            </div>
          ) : files.length === 0 ? (
            <div className="text-center py-8">
              <FolderOpen className="h-8 w-8 mx-auto mb-2 text-gray-400" />
              <p className="text-gray-500">This directory is empty</p>
            </div>
          ) : (
            files.map((file, index) => (
              <div
                key={index}
                className={`flex items-center justify-between px-4 py-3 hover:bg-gray-50 cursor-pointer ${
                  selectedFiles.includes(file.name) ? 'bg-blue-50' : ''
                }`}
                onDoubleClick={() => handleFileDoubleClick(file)}
              >
                <div className="flex items-center space-x-3">
                  {file.name !== '..' && (
                    <input
                      type="checkbox"
                      checked={selectedFiles.includes(file.name)}
                      onChange={() => toggleFileSelection(file.name)}
                      className="rounded border-gray-300"
                      onClick={(e) => e.stopPropagation()}
                    />
                  )}
                  {getFileIcon(file)}
                  <div>
                    <div className="font-medium text-gray-900">{file.name}</div>
                    <div className="text-sm text-gray-500">
                      {file.is_directory ? 'Directory' : formatFileSize(file.size)}
                      {file.modified && ` • ${new Date(file.modified).toLocaleDateString()}`}
                    </div>
                  </div>
                </div>
                
                <div className="flex items-center space-x-2">
                  <span className="text-xs text-gray-400 font-mono">
                    {file.permissions}
                  </span>
                  {file.name !== '..' && (
                    <button className="p-1 rounded hover:bg-gray-200">
                      <MoreHorizontal className="h-4 w-4 text-gray-400" />
                    </button>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Upload Modal */}
      {showUploadModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Upload Files</h3>
            <div className="space-y-4">
              <input
                type="file"
                multiple
                onChange={(e) => setUploadFiles(e.target.files)}
                className="w-full p-3 border-2 border-dashed border-gray-300 rounded-lg text-center"
              />
              {uploadFiles && (
                <div className="text-sm text-gray-600">
                  Selected {uploadFiles.length} file(s)
                </div>
              )}
            </div>
            <div className="flex justify-end space-x-2 mt-6">
              <button
                onClick={() => {
                  setShowUploadModal(false)
                  setUploadFiles(null)
                }}
                className="px-4 py-2 text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200"
              >
                Cancel
              </button>
              <button
                onClick={handleUploadFiles}
                disabled={!uploadFiles}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
              >
                Upload
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Create Folder Modal */}
      {showCreateFolderModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Create New Folder</h3>
            <input
              type="text"
              placeholder="Folder name"
              value={newFolderName}
              onChange={(e) => setNewFolderName(e.target.value)}
              className="w-full p-3 border border-gray-300 rounded-lg"
              autoFocus
            />
            <div className="flex justify-end space-x-2 mt-6">
              <button
                onClick={() => {
                  setShowCreateFolderModal(false)
                  setNewFolderName('')
                }}
                className="px-4 py-2 text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200"
              >
                Cancel
              </button>
              <button
                onClick={handleCreateFolder}
                disabled={!newFolderName.trim()}
                className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50"
              >
                Create
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default SftpFileBrowser