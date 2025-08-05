import React, { useEffect, useState } from 'react'
import { 
  Upload, 
  Download, 
  Trash2, 
  FolderPlus, 
  RefreshCw,
  ChevronRight,
  Home,
  Search,
  Grid,
  List
} from 'lucide-react'
import { useFiles } from '@/contexts/FileContext'
import { formatBytes, formatDate, getFileIcon } from '@/utils'
import Button from '@/components/ui/Button'
import Modal from '@/components/ui/Modal'
import LoadingSpinner from '@/components/ui/LoadingSpinner'
import toast from 'react-hot-toast'

const FileManager: React.FC = () => {
  const {
    files,
    currentPath,
    selectedFiles,
    operations,
    isLoading,
    loadFiles,
    navigateToPath,
    uploadFiles,
    downloadFile,
    deleteFiles,
    selectFiles,
    clearSelection,
    createFolder,
  } = useFiles()

  const [showUploadModal, setShowUploadModal] = useState(false)
  const [showCreateFolderModal, setShowCreateFolderModal] = useState(false)
  const [newFolderName, setNewFolderName] = useState('')
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('list')
  const [searchQuery, setSearchQuery] = useState('')
  const [dragActive, setDragActive] = useState(false)

  useEffect(() => {
    loadFiles()
  }, [])

  const handleFileSelect = (fileId: string, isCtrlClick: boolean) => {
    if (isCtrlClick) {
      const newSelection = selectedFiles.includes(fileId)
        ? selectedFiles.filter(id => id !== fileId)
        : [...selectedFiles, fileId]
      selectFiles(newSelection)
    } else {
      selectFiles([fileId])
    }
  }

  const handleFileDoubleClick = (file: any) => {
    if (file.type === 'folder') {
      navigateToPath(file.path)
    } else {
      downloadFile(file.id)
    }
  }

  const handleUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files
    if (files && files.length > 0) {
      uploadFiles(files)
      setShowUploadModal(false)
    }
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setDragActive(false)
    
    const files = e.dataTransfer.files
    if (files.length > 0) {
      uploadFiles(files)
    }
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    setDragActive(true)
  }

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault()
    setDragActive(false)
  }

  const handleCreateFolder = async () => {
    if (newFolderName.trim()) {
      await createFolder(newFolderName.trim())
      setNewFolderName('')
      setShowCreateFolderModal(false)
    }
  }

  const handleDeleteSelected = async () => {
    if (selectedFiles.length > 0) {
      if (confirm(`Are you sure you want to delete ${selectedFiles.length} file(s)?`)) {
        await deleteFiles(selectedFiles)
        clearSelection()
      }
    }
  }

  const handleDownloadSelected = async () => {
    for (const fileId of selectedFiles) {
      await downloadFile(fileId)
    }
  }

  const pathSegments = currentPath.split('/').filter(Boolean)
  const filteredFiles = files.filter(file =>
    file.name.toLowerCase().includes(searchQuery.toLowerCase())
  )

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold text-gray-900">File Manager</h1>
        <div className="flex space-x-2">
          <Button onClick={() => setViewMode(viewMode === 'grid' ? 'list' : 'grid')} variant="outline">
            {viewMode === 'grid' ? <List className="h-4 w-4" /> : <Grid className="h-4 w-4" />}
          </Button>
          <Button onClick={() => loadFiles()} variant="outline">
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center space-y-4 sm:space-y-0">
        <nav className="flex" aria-label="Breadcrumb">
          <ol className="inline-flex items-center space-x-1 md:space-x-3">
            <li className="inline-flex items-center">
              <button
                onClick={() => navigateToPath('/')}
                className="inline-flex items-center text-sm font-medium text-gray-700 hover:text-primary-600"
              >
                <Home className="h-4 w-4 mr-2" />
                Root
              </button>
            </li>
            {pathSegments.map((segment, index) => {
              const path = '/' + pathSegments.slice(0, index + 1).join('/')
              return (
                <li key={path}>
                  <div className="flex items-center">
                    <ChevronRight className="h-4 w-4 text-gray-400" />
                    <button
                      onClick={() => navigateToPath(path)}
                      className="ml-1 text-sm font-medium text-gray-700 hover:text-primary-600 md:ml-2"
                    >
                      {segment}
                    </button>
                  </div>
                </li>
              )
            })}
          </ol>
        </nav>

        <div className="flex items-center space-x-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search files..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            />
          </div>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button onClick={() => setShowUploadModal(true)}>
          <Upload className="h-4 w-4 mr-2" />
          Upload Files
        </Button>
        <Button onClick={() => setShowCreateFolderModal(true)} variant="outline">
          <FolderPlus className="h-4 w-4 mr-2" />
          New Folder
        </Button>
        {selectedFiles.length > 0 && (
          <>
            <Button onClick={handleDownloadSelected} variant="outline">
              <Download className="h-4 w-4 mr-2" />
              Download ({selectedFiles.length})
            </Button>
            <Button onClick={handleDeleteSelected} variant="danger">
              <Trash2 className="h-4 w-4 mr-2" />
              Delete ({selectedFiles.length})
            </Button>
          </>
        )}
      </div>

      <div
        className={`min-h-64 border-2 border-dashed rounded-lg p-6 ${
          dragActive ? 'border-primary-500 bg-primary-50' : 'border-gray-300'
        }`}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
      >
        {isLoading ? (
          <div className="flex items-center justify-center h-32">
            <LoadingSpinner size="lg" />
          </div>
        ) : filteredFiles.length === 0 ? (
          <div className="text-center py-12">
            <FolderPlus className="mx-auto h-12 w-12 text-gray-400" />
            <h3 className="mt-2 text-sm font-medium text-gray-900">No files</h3>
            <p className="mt-1 text-sm text-gray-500">
              {searchQuery ? 'No files match your search.' : 'Get started by uploading a file.'}
            </p>
          </div>
        ) : viewMode === 'list' ? (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Name
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Size
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Modified
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Owner
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredFiles.map((file) => (
                  <tr
                    key={file.id}
                    className={`cursor-pointer hover:bg-gray-50 ${
                      selectedFiles.includes(file.id) ? 'bg-primary-50' : ''
                    }`}
                    onClick={(e) => handleFileSelect(file.id, e.ctrlKey || e.metaKey)}
                    onDoubleClick={() => handleFileDoubleClick(file)}
                  >
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <span className="text-2xl mr-3">
                          {getFileIcon(file.name, file.type)}
                        </span>
                        <div>
                          <div className="text-sm font-medium text-gray-900">
                            {file.name}
                          </div>
                          <div className="text-sm text-gray-500 capitalize">
                            {file.type}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {file.type === 'folder' ? '-' : formatBytes(file.size)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {formatDate(file.modifiedAt, 'relative')}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {file.owner}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
            {filteredFiles.map((file) => (
              <div
                key={file.id}
                className={`p-4 border rounded-lg cursor-pointer hover:bg-gray-50 ${
                  selectedFiles.includes(file.id) ? 'border-primary-500 bg-primary-50' : 'border-gray-200'
                }`}
                onClick={(e) => handleFileSelect(file.id, e.ctrlKey || e.metaKey)}
                onDoubleClick={() => handleFileDoubleClick(file)}
              >
                <div className="text-center">
                  <div className="text-4xl mb-2">
                    {getFileIcon(file.name, file.type)}
                  </div>
                  <div className="text-sm font-medium text-gray-900 truncate">
                    {file.name}
                  </div>
                  <div className="text-xs text-gray-500">
                    {file.type === 'folder' ? 'Folder' : formatBytes(file.size)}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {operations.length > 0 && (
        <div className="card">
          <h3 className="text-lg font-medium text-gray-900 mb-4">File Operations</h3>
          <div className="space-y-2">
            {operations.map((operation) => (
              <div key={operation.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <div className="flex items-center">
                  <div className="text-sm font-medium text-gray-900">
                    {operation.type === 'upload' ? '↑' : '↓'} {operation.fileName}
                  </div>
                  <div className="ml-2 text-sm text-gray-500 capitalize">
                    {operation.status}
                  </div>
                </div>
                <div className="flex items-center">
                  <div className="w-32 bg-gray-200 rounded-full h-2 mr-2">
                    <div
                      className={`h-2 rounded-full ${
                        operation.status === 'completed' ? 'bg-green-600' :
                        operation.status === 'failed' ? 'bg-red-600' :
                        'bg-blue-600'
                      }`}
                      style={{ width: `${operation.progress}%` }}
                    ></div>
                  </div>
                  <span className="text-sm text-gray-500">{operation.progress}%</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <Modal isOpen={showUploadModal} onClose={() => setShowUploadModal(false)} title="Upload Files">
        <div className="space-y-4">
          <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center">
            <Upload className="mx-auto h-12 w-12 text-gray-400" />
            <div className="mt-4">
              <label htmlFor="file-upload" className="cursor-pointer">
                <span className="text-sm font-medium text-primary-600 hover:text-primary-500">
                  Choose files to upload
                </span>
                <input
                  id="file-upload"
                  name="file-upload"
                  type="file"
                  multiple
                  className="sr-only"
                  onChange={handleUpload}
                />
              </label>
              <p className="text-sm text-gray-500">or drag and drop</p>
            </div>
          </div>
        </div>
      </Modal>

      <Modal isOpen={showCreateFolderModal} onClose={() => setShowCreateFolderModal(false)} title="Create New Folder">
        <div className="space-y-4">
          <div>
            <label htmlFor="folder-name" className="block text-sm font-medium text-gray-700">
              Folder Name
            </label>
            <input
              type="text"
              id="folder-name"
              value={newFolderName}
              onChange={(e) => setNewFolderName(e.target.value)}
              className="mt-1 input-field"
              placeholder="Enter folder name"
              onKeyPress={(e) => e.key === 'Enter' && handleCreateFolder()}
            />
          </div>
          <div className="flex justify-end space-x-2">
            <Button variant="outline" onClick={() => setShowCreateFolderModal(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreateFolder} disabled={!newFolderName.trim()}>
              Create Folder
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}

export default FileManager