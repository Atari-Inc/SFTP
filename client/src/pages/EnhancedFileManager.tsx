import React, { useEffect, useState, useRef } from 'react'
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
  List,
  FileText,
  Image,
  Film,
  Music,
  Archive,
  Code,
  File,
  Folder,
  FolderOpen,
  MoreVertical,
  Share2,
  Copy,
  Move,
  Edit2,
  Eye,
  CheckCircle,
  XCircle,
  AlertCircle,
  Info,
  Clipboard,
  X,
  Filter,
  HardDrive,
  Cloud,
  Clock
} from 'lucide-react'
import { useFiles } from '@/contexts/FileContext'
import { formatBytes, formatDate } from '@/utils'

// Utility function to get file type from file name
const getFileType = (file: FileItemType): string => {
  if (file.type === 'folder') return 'Folder'
  
  const extension = file.name.split('.').pop()?.toLowerCase() || ''
  
  // Image types
  if (['jpg', 'jpeg', 'png', 'gif', 'bmp', 'svg', 'webp'].includes(extension)) {
    return 'Image'
  }
  
  // Document types
  if (['pdf', 'doc', 'docx', 'txt', 'rtf', 'odt'].includes(extension)) {
    return 'Document'
  }
  
  // Spreadsheet types
  if (['xls', 'xlsx', 'csv', 'ods'].includes(extension)) {
    return 'Spreadsheet'
  }
  
  // Presentation types
  if (['ppt', 'pptx', 'odp'].includes(extension)) {
    return 'Presentation'
  }
  
  // Video types
  if (['mp4', 'avi', 'mov', 'wmv', 'flv', 'mkv', 'webm'].includes(extension)) {
    return 'Video'
  }
  
  // Audio types
  if (['mp3', 'wav', 'flac', 'aac', 'ogg', 'wma'].includes(extension)) {
    return 'Audio'
  }
  
  // Archive types
  if (['zip', 'rar', '7z', 'tar', 'gz', 'bz2'].includes(extension)) {
    return 'Archive'
  }
  
  // Code types
  if (['js', 'ts', 'jsx', 'tsx', 'py', 'java', 'cpp', 'c', 'cs', 'php', 'rb', 'go', 'rs', 'swift'].includes(extension)) {
    return 'Code'
  }
  
  return extension ? extension.toUpperCase() + ' File' : 'File'
}
import Button from '@/components/ui/Button'
import Modal from '@/components/ui/Modal'
import LoadingSpinner from '@/components/ui/LoadingSpinner'
import toast from 'react-hot-toast'

interface FileItemType {
  id: string
  name: string
  size: number
  type: 'file' | 'folder'
  path: string
  created_at: string
  modified_at: string
  owner: string
  mime_type?: string
}

const EnhancedFileManager: React.FC = () => {
  const {
    files,
    currentPath,
    selectedFiles,
    operations,
    isLoading,
    error,
    clipboard,
    loadFiles,
    navigateToPath,
    uploadFiles,
    downloadFile,
    deleteFiles,
    selectFiles,
    clearSelection,
    createFolder,
    moveFiles,
    renameFile,
    shareFile,
    searchFiles,
    previewFile,
    copyFilesToClipboard,
    pasteFiles,
    clearClipboard,
  } = useFiles()


  // Modal states
  const [showUploadModal, setShowUploadModal] = useState(false)
  const [showCreateFolderModal, setShowCreateFolderModal] = useState(false)
  const [showDetailsModal, setShowDetailsModal] = useState(false)
  const [showShareModal, setShowShareModal] = useState(false)
  const [showRenameModal, setShowRenameModal] = useState(false)
  const [showMoveModal, setShowMoveModal] = useState(false)
  const [showPreviewModal, setShowPreviewModal] = useState(false)

  // Form states
  const [selectedFile, setSelectedFile] = useState<FileItemType | null>(null)
  const [newFolderName, setNewFolderName] = useState('')
  const [renameValue, setRenameValue] = useState('')
  const [shareEmails, setShareEmails] = useState('')
  const [moveTargetPath, setMoveTargetPath] = useState('')
  const [previewData, setPreviewData] = useState<any>(null)

  // UI states
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('list')
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<FileItemType[]>([])
  const [isSearching, setIsSearching] = useState(false)
  const [dragActive, setDragActive] = useState(false)
  const [sortBy, setSortBy] = useState<'name' | 'size' | 'date'>('name')
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc')
  const [showFilters, setShowFilters] = useState(false)
  const [filterType, setFilterType] = useState<'all' | 'folder' | 'image' | 'document' | 'video' | 'audio'>('all')
  const [activeDropdown, setActiveDropdown] = useState<string | null>(null)
  const [contextMenu, setContextMenu] = useState<{
    x: number
    y: number
    fileId: string | null
  } | null>(null)
  
  const fileInputRef = useRef<HTMLInputElement>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const contextMenuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    loadFiles()
  }, [])

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setActiveDropdown(null)
      }
      if (contextMenuRef.current && !contextMenuRef.current.contains(event.target as Node)) {
        setContextMenu(null)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [selectedFiles, clipboard, files, currentPath])

  // Event handlers
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

  const handleFileDoubleClick = (file: FileItemType) => {
    if (file.type === 'folder') {
      navigateToPath(file.path)
    } else {
      handlePreviewFile(file)
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

  // New enhanced handlers

  const handleCopyFiles = () => {
    if (selectedFiles.length > 0) {
      copyFilesToClipboard(selectedFiles)
    }
  }

  const handlePasteFiles = async (operation: 'copy' | 'move' = 'copy') => {
    await pasteFiles(currentPath, operation)
  }

  const handleRename = (file: FileItemType) => {
    setSelectedFile(file)
    setRenameValue(file.name)
    setShowRenameModal(true)
  }

  const handleRenameSubmit = async () => {
    if (selectedFile && renameValue.trim()) {
      await renameFile(selectedFile.id, renameValue.trim())
      setShowRenameModal(false)
      setRenameValue('')
      setSelectedFile(null)
    }
  }

  const handleMove = () => {
    if (selectedFiles.length > 0) {
      setMoveTargetPath(currentPath)
      setShowMoveModal(true)
    }
  }

  const handleMoveSubmit = async () => {
    if (selectedFiles.length > 0 && moveTargetPath) {
      await moveFiles(selectedFiles, moveTargetPath)
      setShowMoveModal(false)
      setMoveTargetPath('')
    }
  }

  const handleShare = (file: FileItemType) => {
    setSelectedFile(file)
    setShowShareModal(true)
  }

  const handleShareSubmit = async () => {
    if (selectedFile && shareEmails.trim()) {
      try {
        const emails = shareEmails.split(',').map(email => email.trim()).filter(Boolean)
        const shareUrl = await shareFile(selectedFile.id, emails)
        
        navigator.clipboard.writeText(shareUrl)
        toast.success('Share URL copied to clipboard!')
        
        setShowShareModal(false)
        setShareEmails('')
        setSelectedFile(null)
      } catch (error) {
        // Error handled in shareFile function
      }
    }
  }

  const handleContextMenu = (e: React.MouseEvent, fileId: string | null = null) => {
    e.preventDefault()
    setContextMenu({
      x: e.clientX,
      y: e.clientY,
      fileId
    })
    setActiveDropdown(null) // Close any active dropdown
  }

  const handleKeyDown = (e: KeyboardEvent) => {
    // Keyboard shortcuts
    if (e.ctrlKey || e.metaKey) {
      switch (e.key.toLowerCase()) {
        case 'a':
          e.preventDefault()
          selectFiles(files.map(f => f.id))
          break
        case 'c':
          if (selectedFiles.length > 0) {
            e.preventDefault()
            copyFilesToClipboard(selectedFiles)
          }
          break
        case 'v':
          if (clipboard.fileIds.length > 0) {
            e.preventDefault()
            pasteFiles(currentPath, 'copy')
          }
          break
        case 'x':
          if (selectedFiles.length > 0) {
            e.preventDefault()
            copyFilesToClipboard(selectedFiles)
            // Visual indication that files are cut (for move operation)
          }
          break
      }
    }
    
    // Delete key
    if (e.key === 'Delete' && selectedFiles.length > 0) {
      if (confirm(`Delete ${selectedFiles.length} selected item(s)?`)) {
        deleteFiles(selectedFiles)
      }
    }
    
    // F2 key for rename
    if (e.key === 'F2' && selectedFiles.length === 1) {
      const file = files.find(f => f.id === selectedFiles[0])
      if (file) {
        handleRename(file)
      }
    }
    
    // Escape key
    if (e.key === 'Escape') {
      setContextMenu(null)
      setActiveDropdown(null)
      clearSelection()
    }
  }

  const handlePreviewFile = async (file: FileItemType) => {
    try {
      const data = await previewFile(file.id)
      setPreviewData(data)
      setSelectedFile(file)
      setShowPreviewModal(true)
    } catch (error) {
      setSelectedFile(file)
      setShowDetailsModal(true)
    }
  }

  const handleSearch = async () => {
    if (!searchQuery.trim()) {
      setSearchResults([])
      setIsSearching(false)
      return
    }

    setIsSearching(true)
    try {
      const results = await searchFiles(searchQuery.trim())
      setSearchResults(results)
    } catch (error) {
      setSearchResults([])
    } finally {
      setIsSearching(false)
    }
  }

  const clearSearch = () => {
    setSearchQuery('')
    setSearchResults([])
    setIsSearching(false)
  }

  // Utility functions
  const getFileTypeIcon = (file: FileItemType) => {
    if (file.type === 'folder') {
      return <Folder className="h-5 w-5 text-blue-600" />
    }
    
    const ext = file.name.split('.').pop()?.toLowerCase()
    switch (ext) {
      case 'jpg':
      case 'jpeg':
      case 'png':
      case 'gif':
      case 'webp':
        return <Image className="h-5 w-5 text-green-600" />
      case 'mp4':
      case 'avi':
      case 'mov':
      case 'mkv':
        return <Film className="h-5 w-5 text-purple-600" />
      case 'mp3':
      case 'wav':
      case 'flac':
        return <Music className="h-5 w-5 text-pink-600" />
      case 'zip':
      case 'rar':
      case '7z':
      case 'tar':
        return <Archive className="h-5 w-5 text-yellow-600" />
      case 'js':
      case 'ts':
      case 'py':
      case 'java':
      case 'cpp':
        return <Code className="h-5 w-5 text-blue-600" />
      case 'pdf':
      case 'doc':
      case 'docx':
      case 'txt':
        return <FileText className="h-5 w-5 text-red-600" />
      default:
        return <File className="h-5 w-5 text-gray-600" />
    }
  }

  const sortFiles = (files: FileItemType[]) => {
    return [...files].sort((a, b) => {
      let comparison = 0
      
      // Folders always come first
      if (a.type === 'folder' && b.type !== 'folder') return -1
      if (a.type !== 'folder' && b.type === 'folder') return 1
      
      switch (sortBy) {
        case 'name':
          comparison = a.name.localeCompare(b.name)
          break
        case 'size':
          comparison = a.size - b.size
          break
        case 'date':
          comparison = new Date(a.modified_at).getTime() - new Date(b.modified_at).getTime()
          break
      }
      
      return sortOrder === 'asc' ? comparison : -comparison
    })
  }

  const filterFiles = (files: FileItemType[]) => {
    let filtered = files.filter(file =>
      file.name.toLowerCase().includes(searchQuery.toLowerCase())
    )
    
    if (filterType !== 'all') {
      filtered = filtered.filter(file => {
        if (filterType === 'folder') return file.type === 'folder'
        
        const ext = file.name.split('.').pop()?.toLowerCase()
        switch (filterType) {
          case 'image':
            return ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg'].includes(ext || '')
          case 'document':
            return ['pdf', 'doc', 'docx', 'txt', 'odt'].includes(ext || '')
          case 'video':
            return ['mp4', 'avi', 'mov', 'mkv', 'webm'].includes(ext || '')
          case 'audio':
            return ['mp3', 'wav', 'flac', 'aac', 'ogg'].includes(ext || '')
          default:
            return true
        }
      })
    }
    
    return filtered
  }

  const pathSegments = currentPath.split('/').filter(Boolean)
  const displayFiles = searchQuery && searchResults.length >= 0 ? searchResults : files || []
  const processedFiles = sortFiles(filterFiles(displayFiles))

  const totalSize = files?.reduce((acc, file) => acc + (file.size || 0), 0) || 0
  const fileCount = files?.filter(f => f.type === 'file').length || 0
  const folderCount = files?.filter(f => f.type === 'folder').length || 0

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-600 to-purple-600 rounded-xl p-6 text-white">
        <div className="flex justify-between items-start">
          <div>
            <h1 className="text-3xl font-bold mb-2">Enhanced File Manager</h1>
            <p className="text-blue-100">
              Complete AWS S3 File Management with Copy, Paste, Move, Share & More
            </p>
          </div>
          <div className="flex items-center space-x-4">
            <div className="bg-white/20 backdrop-blur rounded-lg px-4 py-2">
              <div className="flex items-center space-x-2">
                <HardDrive className="h-5 w-5" />
                <div>
                  <p className="text-xs opacity-90">Storage Used</p>
                  <p className="text-sm font-semibold">{formatBytes(totalSize)}</p>
                </div>
              </div>
            </div>
            <div className="bg-white/20 backdrop-blur rounded-lg px-4 py-2">
              <div className="flex items-center space-x-2">
                <Folder className="h-5 w-5" />
                <div>
                  <p className="text-xs opacity-90">Files / Folders</p>
                  <p className="text-sm font-semibold">{fileCount} / {folderCount}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Breadcrumb Navigation */}
      <div className="bg-white rounded-lg shadow-sm p-4">
        <nav className="flex items-center justify-between">
          <ol className="inline-flex items-center space-x-1 md:space-x-3">
            <li className="inline-flex items-center">
              <button
                onClick={() => navigateToPath('/')}
                className="inline-flex items-center px-3 py-1 text-sm font-medium text-gray-700 hover:text-blue-600 hover:bg-blue-50 rounded-md transition-colors"
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
                      className="ml-1 px-3 py-1 text-sm font-medium text-gray-700 hover:text-blue-600 hover:bg-blue-50 rounded-md transition-colors"
                    >
                      {segment}
                    </button>
                  </div>
                </li>
              )
            })}
          </ol>
          
          <div className="flex items-center space-x-2">
            <Button onClick={() => loadFiles()} variant="outline" size="sm">
              <RefreshCw className="h-4 w-4" />
            </Button>
          </div>
        </nav>
      </div>

      {/* Toolbar */}
      <div className="bg-white rounded-lg shadow-sm p-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-2">
            <Button onClick={() => setShowUploadModal(true)}>
              <Upload className="h-4 w-4 mr-2" />
              Upload
            </Button>
            <Button onClick={() => setShowCreateFolderModal(true)} variant="outline">
              <FolderPlus className="h-4 w-4 mr-2" />
              New Folder
            </Button>
            
            <Button 
              onClick={() => selectFiles(processedFiles.map(f => f.id))} 
              variant="outline"
              disabled={processedFiles.length === 0}
            >
              <CheckCircle className="h-4 w-4 mr-2" />
              Select All
            </Button>
            
            <Button onClick={() => loadFiles()} variant="outline">
              <RefreshCw className="h-4 w-4 mr-2" />
              Refresh
            </Button>
            
            {selectedFiles.length > 0 && (
              <>
                <div className="h-6 w-px bg-gray-300 mx-2" />
                <Button onClick={handleDownloadSelected} variant="outline" size="sm">
                  <Download className="h-4 w-4 mr-2" />
                  Download ({selectedFiles.length})
                </Button>
                <Button onClick={handleCopyFiles} variant="outline" size="sm">
                  <Copy className="h-4 w-4 mr-2" />
                  Copy ({selectedFiles.length})
                </Button>
                <Button onClick={handleMove} variant="outline" size="sm">
                  <Move className="h-4 w-4 mr-2" />
                  Move ({selectedFiles.length})
                </Button>
                {selectedFiles.length === 1 && (
                  <Button 
                    onClick={() => {
                      const file = files.find(f => f.id === selectedFiles[0])
                      if (file) handleRename(file)
                    }}
                    variant="outline" 
                    size="sm"
                  >
                    <Edit2 className="h-4 w-4 mr-2" />
                    Rename
                  </Button>
                )}
                <Button 
                  onClick={() => handleShare(files.find(f => f.id === selectedFiles[0])!)} 
                  variant="outline" 
                  size="sm" 
                  disabled={selectedFiles.length !== 1 || files.find(f => f.id === selectedFiles[0])?.type === 'folder'}
                >
                  <Share2 className="h-4 w-4 mr-2" />
                  Share
                </Button>
                <Button onClick={handleDeleteSelected} variant="danger" size="sm">
                  <Trash2 className="h-4 w-4 mr-2" />
                  Delete ({selectedFiles.length})
                </Button>
                <Button onClick={() => clearSelection()} variant="outline" size="sm">
                  <XCircle className="h-4 w-4 mr-2" />
                  Clear
                </Button>
              </>
            )}
          </div>

          <div className="flex items-center gap-2">
            {/* Clipboard indicator */}
            {clipboard.operation && clipboard.fileIds.length > 0 && (
              <div className="flex items-center bg-blue-50 border border-blue-200 rounded-lg px-3 py-1 text-sm mr-2">
                <Clipboard className="h-4 w-4 mr-2 text-blue-600" />
                <span className="text-blue-700">
                  {clipboard.fileIds.length} file(s) copied
                </span>
                <Button onClick={() => handlePasteFiles('copy')} variant="outline" size="sm" className="ml-2">
                  <Copy className="h-3 w-3 mr-1" />
                  Copy Here
                </Button>
                <Button onClick={() => handlePasteFiles('move')} variant="outline" size="sm" className="ml-1">
                  <Move className="h-3 w-3 mr-1" />
                  Move Here
                </Button>
                <Button onClick={clearClipboard} variant="outline" size="sm" className="ml-1">
                  <X className="h-3 w-3" />
                </Button>
              </div>
            )}
            
            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search files..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
                className="pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent w-64"
              />
              {searchQuery && (
                <button
                  onClick={clearSearch}
                  className="absolute right-2 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
            
            <Button onClick={handleSearch} variant="outline" size="sm" disabled={!searchQuery.trim() || isSearching}>
              {isSearching ? 'Searching...' : 'Search'}
            </Button>

            {/* Filter */}
            <Button
              onClick={() => setShowFilters(!showFilters)}
              variant="outline"
              size="sm"
            >
              <Filter className="h-4 w-4 mr-2" />
              Filter
            </Button>

            {/* Sort */}
            <select
              value={`${sortBy}-${sortOrder}`}
              onChange={(e) => {
                const [by, order] = e.target.value.split('-')
                setSortBy(by as any)
                setSortOrder(order as any)
              }}
              className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
            >
              <option value="name-asc">Name (A-Z)</option>
              <option value="name-desc">Name (Z-A)</option>
              <option value="size-asc">Size (Small first)</option>
              <option value="size-desc">Size (Large first)</option>
              <option value="date-asc">Date (Oldest first)</option>
              <option value="date-desc">Date (Newest first)</option>
            </select>

            {/* View Mode */}
            <div className="flex bg-gray-100 rounded-lg p-1">
              <button
                onClick={() => setViewMode('grid')}
                className={`p-1.5 rounded ${viewMode === 'grid' ? 'bg-white shadow-sm' : ''}`}
              >
                <Grid className="h-4 w-4" />
              </button>
              <button
                onClick={() => setViewMode('list')}
                className={`p-1.5 rounded ${viewMode === 'list' ? 'bg-white shadow-sm' : ''}`}
              >
                <List className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>

        {/* Filter Bar */}
        {showFilters && (
          <div className="mt-4 pt-4 border-t flex items-center gap-2">
            <span className="text-sm text-gray-600">Filter by type:</span>
            {['all', 'folder', 'image', 'document', 'video', 'audio'].map(type => (
              <button
                key={type}
                onClick={() => setFilterType(type as any)}
                className={`px-3 py-1 text-sm rounded-full capitalize ${
                  filterType === type 
                    ? 'bg-blue-100 text-blue-700' 
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                {type}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* File Display Area */}
      <div 
        className={`bg-white rounded-lg shadow-sm min-h-[500px] ${dragActive ? 'ring-2 ring-blue-500 ring-opacity-50' : ''}`}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
      >
        {isLoading ? (
          <div className="flex items-center justify-center h-96">
            <LoadingSpinner size="lg" />
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center h-96 text-red-500">
            <AlertCircle className="h-16 w-16 mb-4 text-red-300" />
            <p className="text-lg font-medium">Failed to load files</p>
            <p className="text-sm mt-1">{error}</p>
            <Button onClick={() => loadFiles()} variant="outline" className="mt-4">
              <RefreshCw className="h-4 w-4 mr-2" />
              Try Again
            </Button>
          </div>
        ) : isSearching ? (
          <div className="flex items-center justify-center h-96">
            <LoadingSpinner size="lg" />
            <p className="ml-4 text-gray-500">Searching files...</p>
          </div>
        ) : searchQuery && searchResults.length >= 0 ? (
          <div className="p-6">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-medium">Search Results for "{searchQuery}"</h3>
              <Button onClick={clearSearch} variant="outline" size="sm">
                <X className="h-4 w-4 mr-2" />
                Clear Search
              </Button>
            </div>
            {searchResults.length === 0 ? (
              <p className="text-gray-500 text-center py-8">No files found matching your search.</p>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
                {searchResults.map((file) => (
                  <div
                    key={file.id}
                    className="group relative flex flex-col items-center p-4 rounded-lg border-2 cursor-pointer transition-all hover:shadow-md border-gray-200 hover:border-gray-300"
                    onClick={(e) => handleFileSelect(file.id, e.ctrlKey || e.metaKey)}
                    onDoubleClick={() => file.type === 'folder' ? navigateToPath(file.path) : handlePreviewFile(file)}
                  >
                    <div className="text-4xl mb-2">
                      {getFileTypeIcon(file)}
                    </div>
                    <p className="text-sm font-medium text-center truncate w-full" title={file.name}>
                      {file.name}
                    </p>
                    <p className="text-xs text-gray-500 mt-1">
                      in {file.path}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : processedFiles.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-96 text-gray-500">
            <Folder className="h-16 w-16 mb-4 text-gray-300" />
            <p className="text-lg font-medium">No files found</p>
            <p className="text-sm mt-1">Upload files or create folders to get started</p>
          </div>
        ) : viewMode === 'grid' ? (
          /* Grid View */
          <div 
            className="p-6 grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4"
            onContextMenu={(e) => handleContextMenu(e, null)}
          >
            {processedFiles.map((file) => (
              <div
                key={file.id}
                className={`group relative flex flex-col items-center p-4 rounded-lg border-2 cursor-pointer transition-all hover:shadow-md ${
                  selectedFiles.includes(file.id) 
                    ? 'border-blue-500 bg-blue-50' 
                    : 'border-gray-200 hover:border-gray-300'
                }`}
                onClick={(e) => handleFileSelect(file.id, e.ctrlKey || e.metaKey)}
                onDoubleClick={() => handleFileDoubleClick(file)}
                onContextMenu={(e) => handleContextMenu(e, file.id)}
              >
                <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity" ref={dropdownRef}>
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      setActiveDropdown(activeDropdown === file.id ? null : file.id)
                    }}
                    className="p-1 rounded hover:bg-gray-100 dropdown-trigger"
                  >
                    <MoreVertical className="h-4 w-4" />
                  </button>
                  
                  {activeDropdown === file.id && (
                    <div className="absolute right-0 mt-1 w-48 bg-white rounded-md shadow-lg z-50 border">
                      <div className="py-1">
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            handlePreviewFile(file)
                            setActiveDropdown(null)
                          }}
                          className="flex items-center px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 w-full text-left"
                        >
                          <Eye className="h-4 w-4 mr-3" />
                          Preview
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            handleRename(file)
                            setActiveDropdown(null)
                          }}
                          className="flex items-center px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 w-full text-left"
                        >
                          <Edit2 className="h-4 w-4 mr-3" />
                          Rename
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            copyFilesToClipboard([file.id])
                            setActiveDropdown(null)
                          }}
                          className="flex items-center px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 w-full text-left"
                        >
                          <Copy className="h-4 w-4 mr-3" />
                          Copy
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            downloadFile(file.id)
                            setActiveDropdown(null)
                          }}
                          className="flex items-center px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 w-full text-left"
                        >
                          <Download className="h-4 w-4 mr-3" />
                          Download
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            handleShare(file)
                            setActiveDropdown(null)
                          }}
                          className="flex items-center px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 w-full text-left"
                        >
                          <Share2 className="h-4 w-4 mr-3" />
                          Share
                        </button>
                        <div className="border-t my-1"></div>
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            if (confirm(`Delete "${file.name}"?`)) {
                              deleteFiles([file.id])
                            }
                            setActiveDropdown(null)
                          }}
                          className="flex items-center px-4 py-2 text-sm text-red-600 hover:bg-red-50 w-full text-left"
                        >
                          <Trash2 className="h-4 w-4 mr-3" />
                          Delete
                        </button>
                      </div>
                    </div>
                  )}
                </div>
                
                <div className="text-4xl mb-2">
                  {getFileTypeIcon(file)}
                </div>
                <p className="text-sm font-medium text-center truncate w-full" title={file.name}>
                  {file.name}
                </p>
                <p className="text-xs text-gray-500 mt-1">
                  {file.type === 'folder' ? 'Folder' : formatBytes(file.size)}
                </p>
              </div>
            ))}
          </div>
        ) : (
          /* List View */
          <div 
            className="overflow-x-auto"
            onContextMenu={(e) => handleContextMenu(e, null)}
          >
            <table className="min-w-full">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    <input
                      type="checkbox"
                      checked={selectedFiles.length === processedFiles.length && processedFiles.length > 0}
                      onChange={(e) => {
                        if (e.target.checked) {
                          selectFiles(processedFiles.map(f => f.id))
                        } else {
                          clearSelection()
                        }
                      }}
                      className="h-4 w-4 text-blue-600 rounded"
                    />
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Name
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Type
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Size
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Created
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Modified
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Owner
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {processedFiles.map((file) => (
                  <tr 
                    key={file.id} 
                    className={`hover:bg-gray-50 cursor-pointer ${selectedFiles.includes(file.id) ? 'bg-blue-50' : ''}`}
                    onClick={(e) => {
                      // Don't trigger selection if clicking on checkbox or dropdown
                      if (!(e.target as HTMLElement).closest('input') && !(e.target as HTMLElement).closest('.dropdown-trigger')) {
                        handleFileSelect(file.id, e.ctrlKey || e.metaKey)
                      }
                    }}
                    onDoubleClick={() => handleFileDoubleClick(file)}
                    onContextMenu={(e) => handleContextMenu(e, file.id)}
                  >
                    <td className="px-6 py-4">
                      <input
                        type="checkbox"
                        checked={selectedFiles.includes(file.id)}
                        onChange={(e) => {
                          e.stopPropagation()
                          handleFileSelect(file.id, true)
                        }}
                        className="h-4 w-4 text-blue-600 rounded"
                      />
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <span className="mr-3">{getFileTypeIcon(file)}</span>
                        <span className="text-sm font-medium text-gray-900">{file.name}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 capitalize">
                      {file.type === 'folder' ? 'Folder' : getFileType(file)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {file.type === 'folder' ? '-' : formatBytes(file.size)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {formatDate(file.created_at)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {formatDate(file.modified_at)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {file.owner}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <div className="flex items-center justify-end space-x-2">
                        <Button onClick={() => handlePreviewFile(file)} variant="outline" size="sm">
                          <Eye className="h-4 w-4" />
                        </Button>
                        <Button onClick={() => handleRename(file)} variant="outline" size="sm">
                          <Edit2 className="h-4 w-4" />
                        </Button>
                        <Button onClick={() => downloadFile(file.id)} variant="outline" size="sm">
                          <Download className="h-4 w-4" />
                        </Button>
                        <Button onClick={() => handleShare(file)} variant="outline" size="sm">
                          <Share2 className="h-4 w-4" />
                        </Button>
                        <Button
                          onClick={() => {
                            if (confirm(`Delete "${file.name}"?`)) {
                              deleteFiles([file.id])
                            }
                          }}
                          variant="danger"
                          size="sm"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        
        {dragActive && (
          <div className="absolute inset-0 bg-blue-500 bg-opacity-10 flex items-center justify-center pointer-events-none">
            <div className="bg-white rounded-lg shadow-xl p-8 text-center">
              <Cloud className="h-16 w-16 text-blue-500 mx-auto mb-4" />
              <p className="text-lg font-medium">Drop files here to upload</p>
            </div>
          </div>
        )}
      </div>

      {/* Upload Progress */}
      {operations.length > 0 && (
        <div className="fixed bottom-4 right-4 w-96 bg-white rounded-lg shadow-xl border p-4 max-h-64 overflow-y-auto">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-medium">File Operations</h3>
          </div>
          {operations.map((op) => (
            <div key={op.id} className="mb-3">
              <div className="flex items-center justify-between mb-1">
                <span className="text-sm truncate flex-1">{op.fileName}</span>
                <span className="text-xs text-gray-500 ml-2">
                  {op.status === 'completed' && <CheckCircle className="h-4 w-4 text-green-500" />}
                  {op.status === 'failed' && <XCircle className="h-4 w-4 text-red-500" />}
                  {op.status === 'in-progress' && <Clock className="h-4 w-4 text-blue-500 animate-spin" />}
                </span>
              </div>
              {op.status === 'in-progress' && (
                <div className="w-full bg-gray-200 rounded-full h-1.5">
                  <div 
                    className="bg-blue-600 h-1.5 rounded-full transition-all"
                    style={{ width: `${op.progress}%` }}
                  />
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Modals */}
      <Modal
        isOpen={showUploadModal}
        onClose={() => setShowUploadModal(false)}
        title="Upload Files"
      >
        <div className="space-y-4">
          <div 
            className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center hover:border-gray-400 transition-colors cursor-pointer"
            onClick={() => fileInputRef.current?.click()}
          >
            <Upload className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <p className="text-sm text-gray-600">Click to select files or drag and drop</p>
            <p className="text-xs text-gray-500 mt-2">Maximum file size: 100MB</p>
            <input
              ref={fileInputRef}
              type="file"
              multiple
              onChange={handleUpload}
              className="hidden"
            />
          </div>
          <div className="flex justify-end space-x-2">
            <Button variant="outline" onClick={() => setShowUploadModal(false)}>
              Cancel
            </Button>
          </div>
        </div>
      </Modal>

      <Modal
        isOpen={showCreateFolderModal}
        onClose={() => setShowCreateFolderModal(false)}
        title="Create New Folder"
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Folder Name
            </label>
            <input
              type="text"
              value={newFolderName}
              onChange={(e) => setNewFolderName(e.target.value)}
              placeholder="Enter folder name"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              autoFocus
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

      <Modal
        isOpen={showRenameModal}
        onClose={() => setShowRenameModal(false)}
        title="Rename File"
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              New Name
            </label>
            <input
              type="text"
              value={renameValue}
              onChange={(e) => setRenameValue(e.target.value)}
              placeholder="Enter new name"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              autoFocus
            />
          </div>
          <div className="flex justify-end space-x-2">
            <Button variant="outline" onClick={() => setShowRenameModal(false)}>
              Cancel
            </Button>
            <Button onClick={handleRenameSubmit} disabled={!renameValue.trim()}>
              Rename
            </Button>
          </div>
        </div>
      </Modal>

      <Modal
        isOpen={showMoveModal}
        onClose={() => setShowMoveModal(false)}
        title="Move Files"
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Target Path
            </label>
            <input
              type="text"
              value={moveTargetPath}
              onChange={(e) => setMoveTargetPath(e.target.value)}
              placeholder="Enter target path (e.g., /Documents)"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              autoFocus
            />
          </div>
          <div className="flex justify-end space-x-2">
            <Button variant="outline" onClick={() => setShowMoveModal(false)}>
              Cancel
            </Button>
            <Button onClick={handleMoveSubmit} disabled={!moveTargetPath.trim()}>
              Move Files
            </Button>
          </div>
        </div>
      </Modal>

      <Modal
        isOpen={showShareModal}
        onClose={() => setShowShareModal(false)}
        title="Share File"
      >
        {selectedFile && (
          <div className="space-y-4">
            <p className="text-sm text-gray-600">
              Share "{selectedFile.name}" with other users
            </p>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Enter emails (comma-separated)
              </label>
              <input
                type="text"
                value={shareEmails}
                onChange={(e) => setShareEmails(e.target.value)}
                placeholder="user@example.com, another@example.com"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            <div className="flex justify-end space-x-2">
              <Button variant="outline" onClick={() => setShowShareModal(false)}>
                Cancel
              </Button>
              <Button onClick={handleShareSubmit} disabled={!shareEmails.trim()}>
                <Share2 className="h-4 w-4 mr-2" />
                Generate Share Link
              </Button>
            </div>
          </div>
        )}
      </Modal>

      <Modal
        isOpen={showPreviewModal}
        onClose={() => setShowPreviewModal(false)}
        title="File Preview"
        size="lg"
      >
        {selectedFile && previewData && (
          <div className="space-y-4">
            <div className="flex items-center space-x-4">
              <div className="text-4xl">{getFileTypeIcon(selectedFile)}</div>
              <div>
                <h3 className="text-lg font-medium">{selectedFile.name}</h3>
                <p className="text-sm text-gray-500">{formatBytes(selectedFile.size)}</p>
              </div>
            </div>
            
            {previewData.can_preview && (
              <div className="mt-4 p-4 border rounded-lg">
                {previewData.mime_type?.startsWith('image/') && (
                  <img 
                    src={previewData.preview_url} 
                    alt={selectedFile.name}
                    className="max-w-full max-h-96 mx-auto rounded"
                  />
                )}
                {previewData.mime_type?.startsWith('text/') && (
                  <iframe 
                    src={previewData.preview_url}
                    className="w-full h-96 border-0"
                    title={selectedFile.name}
                  />
                )}
                {previewData.mime_type === 'application/pdf' && (
                  <iframe 
                    src={previewData.preview_url}
                    className="w-full h-96 border-0"
                    title={selectedFile.name}
                  />
                )}
              </div>
            )}
            
            <div className="grid grid-cols-2 gap-4 pt-4 border-t">
              <div>
                <p className="text-xs text-gray-500 uppercase">Created</p>
                <p className="text-sm">{formatDate(selectedFile.created_at)}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500 uppercase">Modified</p>
                <p className="text-sm">{formatDate(selectedFile.modified_at)}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500 uppercase">Owner</p>
                <p className="text-sm">{selectedFile.owner}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500 uppercase">Type</p>
                <p className="text-sm">{previewData.mime_type || 'Unknown'}</p>
              </div>
            </div>
            
            <div className="flex justify-end space-x-2 pt-4 border-t">
              <Button variant="outline" onClick={() => setShowPreviewModal(false)}>
                Close
              </Button>
              <Button onClick={() => downloadFile(selectedFile.id)}>
                <Download className="h-4 w-4 mr-2" />
                Download
              </Button>
            </div>
          </div>
        )}
      </Modal>

      <Modal
        isOpen={showDetailsModal}
        onClose={() => setShowDetailsModal(false)}
        title="File Details"
        size="lg"
      >
        {selectedFile && (
          <div className="space-y-4">
            <div className="flex items-center space-x-4">
              <div className="text-4xl">{getFileTypeIcon(selectedFile)}</div>
              <div>
                <h3 className="text-lg font-medium">{selectedFile.name}</h3>
                <p className="text-sm text-gray-500">{selectedFile.type === 'folder' ? 'Folder' : formatBytes(selectedFile.size)}</p>
              </div>
            </div>
            
            <div className="grid grid-cols-2 gap-4 pt-4 border-t">
              <div>
                <p className="text-xs text-gray-500 uppercase">Created</p>
                <p className="text-sm">{formatDate(selectedFile.created_at)}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500 uppercase">Modified</p>
                <p className="text-sm">{formatDate(selectedFile.modified_at)}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500 uppercase">Owner</p>
                <p className="text-sm">{selectedFile.owner}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500 uppercase">Path</p>
                <p className="text-sm font-mono text-xs">{selectedFile.path}</p>
              </div>
            </div>
            
            <div className="flex justify-end space-x-2 pt-4 border-t">
              <Button variant="outline" onClick={() => setShowDetailsModal(false)}>
                Close
              </Button>
              {selectedFile.type === 'file' && (
                <Button onClick={() => downloadFile(selectedFile.id)}>
                  <Download className="h-4 w-4 mr-2" />
                  Download
                </Button>
              )}
            </div>
          </div>
        )}
      </Modal>

      {/* Right-click Context Menu */}
      {contextMenu && (
        <div
          ref={contextMenuRef}
          className="fixed z-50 bg-white rounded-md shadow-lg border py-1 min-w-48"
          style={{
            left: `${Math.min(contextMenu.x, window.innerWidth - 200)}px`,
            top: `${Math.min(contextMenu.y, window.innerHeight - 300)}px`,
          }}
        >
          {contextMenu.fileId ? (
            // Context menu for specific file
            <>
              <button
                onClick={() => {
                  const file = files.find(f => f.id === contextMenu.fileId)
                  if (file) {
                    if (file.type === 'folder') {
                      navigateToPath(file.path)
                    } else {
                      handlePreviewFile(file)
                    }
                  }
                  setContextMenu(null)
                }}
                className="flex items-center px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 w-full text-left"
              >
                {files.find(f => f.id === contextMenu.fileId)?.type === 'folder' ? (
                  <>
                    <FolderOpen className="h-4 w-4 mr-3" />
                    Open
                  </>
                ) : (
                  <>
                    <Eye className="h-4 w-4 mr-3" />
                    Preview
                  </>
                )}
              </button>
              
              <div className="border-t my-1"></div>
              
              <button
                onClick={() => {
                  const file = files.find(f => f.id === contextMenu.fileId)
                  if (file) {
                    handleRename(file)
                  }
                  setContextMenu(null)
                }}
                className="flex items-center px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 w-full text-left"
              >
                <Edit2 className="h-4 w-4 mr-3" />
                Rename
              </button>
              
              <button
                onClick={() => {
                  if (contextMenu.fileId) {
                    copyFilesToClipboard([contextMenu.fileId])
                  }
                  setContextMenu(null)
                }}
                className="flex items-center px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 w-full text-left"
              >
                <Copy className="h-4 w-4 mr-3" />
                Copy
              </button>
              
              <button
                onClick={() => {
                  if (contextMenu.fileId) {
                    copyFilesToClipboard([contextMenu.fileId])
                    // Visual indication for move operation
                  }
                  setContextMenu(null)
                }}
                className="flex items-center px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 w-full text-left"
              >
                <Move className="h-4 w-4 mr-3" />
                Cut (for Move)
              </button>
              
              {files.find(f => f.id === contextMenu.fileId)?.type === 'file' && (
                <>
                  <button
                    onClick={() => {
                      if (contextMenu.fileId) {
                        downloadFile(contextMenu.fileId)
                      }
                      setContextMenu(null)
                    }}
                    className="flex items-center px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 w-full text-left"
                  >
                    <Download className="h-4 w-4 mr-3" />
                    Download
                  </button>
                  
                  <button
                    onClick={() => {
                      const file = files.find(f => f.id === contextMenu.fileId)
                      if (file) {
                        handleShare(file)
                      }
                      setContextMenu(null)
                    }}
                    className="flex items-center px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 w-full text-left"
                  >
                    <Share2 className="h-4 w-4 mr-3" />
                    Share
                  </button>
                </>
              )}
              
              <div className="border-t my-1"></div>
              
              <button
                onClick={() => {
                  if (contextMenu.fileId) {
                    const file = files.find(f => f.id === contextMenu.fileId)
                    if (file && confirm(`Delete "${file.name}"?`)) {
                      deleteFiles([contextMenu.fileId])
                    }
                  }
                  setContextMenu(null)
                }}
                className="flex items-center px-4 py-2 text-sm text-red-600 hover:bg-red-50 w-full text-left"
              >
                <Trash2 className="h-4 w-4 mr-3" />
                Delete
              </button>
              
              <div className="border-t my-1"></div>
              
              <button
                onClick={() => {
                  const file = files.find(f => f.id === contextMenu.fileId)
                  if (file) {
                    setSelectedFile(file)
                    setShowDetailsModal(true)
                  }
                  setContextMenu(null)
                }}
                className="flex items-center px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 w-full text-left"
              >
                <Info className="h-4 w-4 mr-3" />
                Properties
              </button>
            </>
          ) : (
            // Context menu for empty space
            <>
              {clipboard.fileIds.length > 0 && (
                <>
                  <button
                    onClick={() => {
                      pasteFiles(currentPath, 'copy')
                      setContextMenu(null)
                    }}
                    className="flex items-center px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 w-full text-left"
                  >
                    <Copy className="h-4 w-4 mr-3" />
                    Paste (Copy)
                  </button>
                  
                  <button
                    onClick={() => {
                      pasteFiles(currentPath, 'move')
                      setContextMenu(null)
                    }}
                    className="flex items-center px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 w-full text-left"
                  >
                    <Move className="h-4 w-4 mr-3" />
                    Paste (Move)
                  </button>
                  
                  <div className="border-t my-1"></div>
                </>
              )}
              
              <button
                onClick={() => {
                  setShowCreateFolderModal(true)
                  setContextMenu(null)
                }}
                className="flex items-center px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 w-full text-left"
              >
                <FolderPlus className="h-4 w-4 mr-3" />
                New Folder
              </button>
              
              <button
                onClick={() => {
                  fileInputRef.current?.click()
                  setContextMenu(null)
                }}
                className="flex items-center px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 w-full text-left"
              >
                <Upload className="h-4 w-4 mr-3" />
                Upload Files
              </button>
              
              {selectedFiles.length > 0 && (
                <>
                  <div className="border-t my-1"></div>
                  
                  <button
                    onClick={() => {
                      selectFiles([])
                      setContextMenu(null)
                    }}
                    className="flex items-center px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 w-full text-left"
                  >
                    <X className="h-4 w-4 mr-3" />
                    Clear Selection
                  </button>
                </>
              )}
              
              <div className="border-t my-1"></div>
              
              <button
                onClick={() => {
                  loadFiles()
                  setContextMenu(null)
                }}
                className="flex items-center px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 w-full text-left"
              >
                <RefreshCw className="h-4 w-4 mr-3" />
                Refresh
              </button>
            </>
          )}
        </div>
      )}

      {/* Background click to close context menu */}
      {contextMenu && (
        <div
          className="fixed inset-0 z-40"
          onClick={() => setContextMenu(null)}
        />
      )}
    </div>
  )
}

export default EnhancedFileManager