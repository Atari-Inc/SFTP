import React, { createContext, useContext, useState, useCallback, ReactNode } from 'react'
import { useAuth } from './AuthContext'
import api from '@/services/api'
import sftpService, { SftpConnection } from '@/services/sftpService'
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
  permissions?: string
}

interface Operation {
  id: string
  fileName: string
  status: 'in-progress' | 'completed' | 'failed'
  progress: number
}

interface ClipboardData {
  fileIds: string[]
  operation: 'copy' | 'move' | null
}

interface SftpFileContextType {
  files: FileItemType[]
  currentPath: string
  selectedFiles: string[]
  operations: Operation[]
  isLoading: boolean
  error: string | null
  clipboard: ClipboardData
  
  // Connection management
  activeConnection: string | null
  isConnecting: boolean
  
  // Core operations
  loadFiles: () => Promise<void>
  navigateToPath: (path: string) => void
  uploadFiles: (files: FileList) => Promise<void>
  downloadFile: (fileId: string) => Promise<void>
  deleteFiles: (fileIds: string[]) => Promise<void>
  
  // Selection operations
  selectFiles: (fileIds: string[]) => void
  clearSelection: () => void
  
  // File operations
  createFolder: (name: string) => Promise<void>
  moveFiles: (fileIds: string[], targetPath: string) => Promise<void>
  renameFile: (fileId: string, newName: string) => Promise<void>
  shareFile: (fileId: string, emails: string[]) => Promise<string>
  searchFiles: (query: string) => Promise<FileItemType[]>
  previewFile: (fileId: string) => Promise<any>
  
  // Clipboard operations
  copyFilesToClipboard: (fileIds: string[]) => void
  pasteFiles: (targetPath: string, operation: 'copy' | 'move') => Promise<void>
  clearClipboard: () => void
  
  // SFTP-specific operations
  connectToSftp: (host: string, port: number, username: string) => Promise<string>
  disconnectFromSftp: (connectionId: string) => Promise<void>
  listConnections: () => Promise<SftpConnection[]>
  
  // Mode management
  isInSftpMode: boolean
  toggleSftpMode: () => void
}

const SftpFileContext = createContext<SftpFileContextType | undefined>(undefined)

interface SftpFileProviderProps {
  children: ReactNode
}

export const SftpFileProvider: React.FC<SftpFileProviderProps> = ({ children }) => {
  const { user } = useAuth()
  const [files, setFiles] = useState<FileItemType[]>([])
  const [currentPath, setCurrentPath] = useState('/')
  const [selectedFiles, setSelectedFiles] = useState<string[]>([])
  const [operations, setOperations] = useState<Operation[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [clipboard, setClipboard] = useState<ClipboardData>({
    fileIds: [],
    operation: null
  })
  const [activeConnection, setActiveConnection] = useState<string | null>(null)
  const [isConnecting, setIsConnecting] = useState(false)
  const [isInSftpMode, setIsInSftpMode] = useState(false)

  const loadFiles = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    
    try {
      let response
      
      if (isInSftpMode && activeConnection) {
        // Load files via SFTP connection
        response = await sftpService.listRemoteFiles(activeConnection, currentPath)
        
        // Transform SFTP file structure to match our interface
        const sftpFiles = response.files.map((file: any) => ({
          id: `sftp_${file.is_directory ? 'folder' : 'file'}:${currentPath}/${file.name}`,
          name: file.name,
          size: file.size || 0,
          type: file.is_directory ? 'folder' as const : 'file' as const,
          path: `${currentPath}/${file.name}`,
          created_at: file.modified || new Date().toISOString(),
          modified_at: file.modified || new Date().toISOString(),
          owner: user?.username || 'unknown',
          mime_type: file.is_directory ? undefined : 'application/octet-stream',
          permissions: file.permissions || '644'
        }))
        
        setFiles(sftpFiles)
      } else {
        // Load files via regular S3/hybrid API
        response = await api.get(`/files/`, {
          params: { path: currentPath }
        })
        
        if (response.data && response.data.data) {
          setFiles(response.data.data)
        } else {
          setFiles([])
        }
      }
      
    } catch (err: any) {
      console.error('Error loading files:', err)
      setError(err.response?.data?.detail || 'Failed to load files')
      toast.error('Failed to load files')
    } finally {
      setIsLoading(false)
    }
  }, [currentPath, isInSftpMode, activeConnection, user?.username])

  // Load files when path or mode changes
  React.useEffect(() => {
    if ((isInSftpMode && activeConnection) || !isInSftpMode) {
      loadFiles()
    }
  }, [currentPath, isInSftpMode, activeConnection, loadFiles])

  const navigateToPath = useCallback((path: string) => {
    setCurrentPath(path)
    setSelectedFiles([])
    // loadFiles will be called by useEffect when currentPath changes
  }, [])

  const connectToSftp = useCallback(async (host: string, port: number, username: string) => {
    setIsConnecting(true)
    try {
      const response = await sftpService.createConnection({ host, port, username })
      setActiveConnection(response.id)
      setIsInSftpMode(true)
      toast.success(`Connected to ${host}:${port}`)
      return response.id
    } catch (err: any) {
      toast.error(err.response?.data?.detail || 'Failed to connect to SFTP server')
      throw err
    } finally {
      setIsConnecting(false)
    }
  }, [])

  const disconnectFromSftp = useCallback(async (connectionId: string) => {
    try {
      await sftpService.closeConnection(connectionId)
      if (activeConnection === connectionId) {
        setActiveConnection(null)
        setIsInSftpMode(false)
        setCurrentPath('/')
      }
      toast.success('Disconnected from SFTP server')
    } catch (err: any) {
      toast.error('Failed to disconnect from SFTP server')
    }
  }, [activeConnection])

  const listConnections = useCallback(async () => {
    try {
      const response = await sftpService.getConnections()
      return response.connections
    } catch (err: any) {
      console.error('Error listing connections:', err)
      return []
    }
  }, [])

  const toggleSftpMode = useCallback(() => {
    if (isInSftpMode && activeConnection) {
      // Disconnect from SFTP
      disconnectFromSftp(activeConnection)
    } else {
      // Just toggle the mode - connection will be established separately
      setIsInSftpMode(!isInSftpMode)
    }
  }, [isInSftpMode, activeConnection, disconnectFromSftp])

  const uploadFiles = useCallback(async (fileList: FileList) => {
    const filesToUpload = Array.from(fileList)
    
    if (isInSftpMode && activeConnection) {
      // Upload via SFTP
      for (const file of filesToUpload) {
        const operationId = Date.now().toString() + Math.random().toString(36)
        
        setOperations(prev => [...prev, {
          id: operationId,
          fileName: file.name,
          status: 'in-progress',
          progress: 0
        }])
        
        try {
          // For SFTP uploads, we need to handle file transfer differently
          // This is a simplified version - in production, you'd need proper chunked upload
          toast(`SFTP upload: ${file.name} - This feature needs file transfer implementation`)
          
          setOperations(prev => prev.map(op => 
            op.id === operationId 
              ? { ...op, status: 'completed', progress: 100 }
              : op
          ))
          
        } catch (err) {
          setOperations(prev => prev.map(op => 
            op.id === operationId 
              ? { ...op, status: 'failed' }
              : op
          ))
          toast.error(`Failed to upload ${file.name} via SFTP`)
        }
      }
    } else {
      // Upload via regular API
      for (const file of filesToUpload) {
        const operationId = Date.now().toString() + Math.random().toString(36)
        
        setOperations(prev => [...prev, {
          id: operationId,
          fileName: file.name,
          status: 'in-progress',
          progress: 0
        }])
        
        try {
          const formData = new FormData()
          formData.append('file', file)
          formData.append('path', currentPath)
          
          await api.post('/files/upload', formData, {
            headers: { 'Content-Type': 'multipart/form-data' },
            onUploadProgress: (progressEvent: ProgressEvent) => {
              if (progressEvent.total) {
                const progress = Math.round((progressEvent.loaded * 100) / progressEvent.total)
                setOperations(prev => prev.map(op => 
                  op.id === operationId 
                    ? { ...op, progress }
                    : op
                ))
              }
            }
          })
          
          setOperations(prev => prev.map(op => 
            op.id === operationId 
              ? { ...op, status: 'completed', progress: 100 }
              : op
          ))
          
          toast.success(`${file.name} uploaded successfully`)
          
        } catch (err: any) {
          setOperations(prev => prev.map(op => 
            op.id === operationId 
              ? { ...op, status: 'failed' }
              : op
          ))
          toast.error(`Failed to upload ${file.name}`)
        }
      }
    }
    
    // Reload files after upload
    await loadFiles()
    
    // Clean up completed operations after a delay
    setTimeout(() => {
      setOperations(prev => prev.filter(op => op.status === 'in-progress'))
    }, 3000)
  }, [currentPath, loadFiles, isInSftpMode, activeConnection])

  const downloadFile = useCallback(async (fileId: string) => {
    try {
      if (isInSftpMode && activeConnection) {
        // Download via SFTP - This would need proper implementation
        toast('SFTP download - This feature needs implementation')
        return
      }
      
      // Regular download
      const response = await api.get(`/files/${encodeURIComponent(fileId)}/download`, {
        responseType: 'blob'
      })
      
      // Create download link
      const url = window.URL.createObjectURL(new Blob([response.data]))
      const link = document.createElement('a')
      link.href = url
      
      // Get filename from Content-Disposition header or use file ID
      let filename = 'download'
      const contentDisposition = response.headers['content-disposition']
      if (contentDisposition) {
        const filenameMatch = contentDisposition.match(/filename="(.+)"/)
        if (filenameMatch) {
          filename = filenameMatch[1]
        }
      }
      
      link.setAttribute('download', filename)
      document.body.appendChild(link)
      link.click()
      link.remove()
      window.URL.revokeObjectURL(url)
      
      toast.success('Download started')
    } catch (err: any) {
      console.error('Download error:', err)
      toast.error('Failed to download file')
    }
  }, [isInSftpMode, activeConnection])

  const deleteFiles = useCallback(async (fileIds: string[]) => {
    try {
      if (isInSftpMode && activeConnection) {
        // Delete via SFTP - This would need proper implementation
        toast('SFTP delete - This feature needs implementation')
        return
      }
      
      // Regular delete
      await api.delete('/files/', {
        data: { file_ids: fileIds }
      })
      
      toast.success(`${fileIds.length} file(s) deleted successfully`)
      await loadFiles()
    } catch (err: any) {
      toast.error('Failed to delete files')
    }
  }, [loadFiles, isInSftpMode, activeConnection])

  const createFolder = useCallback(async (name: string) => {
    try {
      if (isInSftpMode && activeConnection) {
        // Create folder via SFTP - This would need proper implementation
        toast('SFTP folder creation - This feature needs implementation')
                // toast('SFTP delete - This feature needs implementation')

        return
      }
      
      // Regular folder creation
      await api.post('/files/folder', {
        name,
        path: currentPath
      })
      
      toast.success('Folder created successfully')
      await loadFiles()
    } catch (err: any) {
      toast.error('Failed to create folder')
    }
  }, [currentPath, loadFiles, isInSftpMode, activeConnection])

  const renameFile = useCallback(async (fileId: string, newName: string) => {
    try {
      if (isInSftpMode && activeConnection) {
        // Rename via SFTP - This would need proper implementation
        toast('SFTP rename - This feature needs implementation')
        return
      }
      
      // Regular rename
      await api.put(`/files/${encodeURIComponent(fileId)}/rename`, {
        name: newName
      })
      
      toast.success('File renamed successfully')
      await loadFiles()
    } catch (err: any) {
      toast.error('Failed to rename file')
    }
  }, [loadFiles, isInSftpMode, activeConnection])

  // Other operations (simplified implementations)
  const selectFiles = useCallback((fileIds: string[]) => {
    setSelectedFiles(fileIds)
  }, [])

  const clearSelection = useCallback(() => {
    setSelectedFiles([])
  }, [])

  const moveFiles = useCallback(async (fileIds: string[], targetPath: string) => {
    // Implementation would be similar to other operations
    toast('Move operation - Implementation needed')
  }, [])

  const shareFile = useCallback(async (fileId: string, emails: string[]) => {
    // Implementation would be similar to other operations
    toast('Share operation - Implementation needed')
    return 'share-url'
  }, [])

  const searchFiles = useCallback(async (query: string) => {
    // Implementation would be similar to other operations
    toast('Search operation - Implementation needed')
    return []
  }, [])

  const previewFile = useCallback(async (fileId: string) => {
    // Implementation would be similar to other operations
    toast('Preview operation - Implementation needed')
    return null
  }, [])

  const copyFilesToClipboard = useCallback((fileIds: string[]) => {
    setClipboard({
      fileIds,
      operation: 'copy'
    })
    toast.success(`${fileIds.length} file(s) copied to clipboard`)
  }, [])

  const pasteFiles = useCallback(async (targetPath: string, operation: 'copy' | 'move') => {
    // Implementation would be similar to other operations
    toast('Paste operation - Implementation needed')
  }, [])

  const clearClipboard = useCallback(() => {
    setClipboard({
      fileIds: [],
      operation: null
    })
  }, [])

  const contextValue: SftpFileContextType = {
    files,
    currentPath,
    selectedFiles,
    operations,
    isLoading,
    error,
    clipboard,
    activeConnection,
    isConnecting,
    isInSftpMode,
    
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
    connectToSftp,
    disconnectFromSftp,
    listConnections,
    toggleSftpMode
  }

  return (
    <SftpFileContext.Provider value={contextValue}>
      {children}
    </SftpFileContext.Provider>
  )
}

export const useSftpFiles = (): SftpFileContextType => {
  const context = useContext(SftpFileContext)
  if (context === undefined) {
    throw new Error('useSftpFiles must be used within a SftpFileProvider')
  }
  return context
}