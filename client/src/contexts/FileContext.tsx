import React, { createContext, useContext, useReducer, ReactNode, useEffect } from 'react'
import { fileAPI } from '@/services/api'
import toast from 'react-hot-toast'
import { useAuth } from './AuthContext'

interface FileItem {
  id: string
  name: string
  size: number
  type: 'file' | 'folder'
  path: string
  created_at: string
  modified_at: string
  owner: string
}

interface FileOperation {
  id: string
  type: 'upload' | 'download' | 'delete'
  fileName: string
  status: 'pending' | 'in-progress' | 'completed' | 'failed'
  progress: number
  error?: string
}

interface FileState {
  currentPath: string
  files: FileItem[]
  selectedFiles: string[]
  operations: FileOperation[]
  isLoading: boolean
  error: string | null
  clipboard: { operation: 'copy' | null; fileIds: string[] }
}

type FileAction =
  | { type: 'SET_LOADING'; payload: boolean }
  | { type: 'SET_ERROR'; payload: string | null }
  | { type: 'SET_CURRENT_PATH'; payload: string }
  | { type: 'SET_FILES'; payload: FileItem[] }
  | { type: 'ADD_FILE'; payload: FileItem }
  | { type: 'REMOVE_FILE'; payload: string }
  | { type: 'UPDATE_FILE'; payload: FileItem }
  | { type: 'SET_SELECTED_FILES'; payload: string[] }
  | { type: 'ADD_OPERATION'; payload: FileOperation }
  | { type: 'UPDATE_OPERATION'; payload: { id: string; updates: Partial<FileOperation> } }
  | { type: 'REMOVE_OPERATION'; payload: string }
  | { type: 'SET_CLIPBOARD'; payload: { operation: 'copy' | null; fileIds: string[] } }
  | { type: 'CLEAR_CLIPBOARD'; payload: void }

const initialState: FileState = {
  currentPath: '/',
  files: [],
  selectedFiles: [],
  operations: [],
  isLoading: false,
  error: null,
  clipboard: { operation: null, fileIds: [] },
}

const fileReducer = (state: FileState, action: FileAction): FileState => {
  switch (action.type) {
    case 'SET_LOADING':
      return { ...state, isLoading: action.payload }
    case 'SET_ERROR':
      return { ...state, error: action.payload }
    case 'SET_CURRENT_PATH':
      return { ...state, currentPath: action.payload }
    case 'SET_FILES':
      return { ...state, files: action.payload }
    case 'ADD_FILE':
      return { ...state, files: [...state.files, action.payload] }
    case 'REMOVE_FILE':
      return { ...state, files: state.files.filter(f => f.id !== action.payload) }
    case 'UPDATE_FILE':
      return {
        ...state,
        files: state.files.map(f => f.id === action.payload.id ? action.payload : f)
      }
    case 'SET_SELECTED_FILES':
      return { ...state, selectedFiles: action.payload }
    case 'ADD_OPERATION':
      return { ...state, operations: [...state.operations, action.payload] }
    case 'UPDATE_OPERATION':
      return {
        ...state,
        operations: state.operations.map(op =>
          op.id === action.payload.id ? { ...op, ...action.payload.updates } : op
        )
      }
    case 'REMOVE_OPERATION':
      return { ...state, operations: state.operations.filter(op => op.id !== action.payload) }
    case 'SET_CLIPBOARD':
      return { ...state, clipboard: action.payload }
    case 'CLEAR_CLIPBOARD':
      return { ...state, clipboard: { operation: null, fileIds: [] } }
    default:
      return state
  }
}

interface FileContextType extends FileState {
  loadFiles: (path?: string) => Promise<void>
  navigateToPath: (path: string) => Promise<void>
  uploadFiles: (files: FileList) => Promise<void>
  downloadFile: (fileId: string) => Promise<void>
  deleteFiles: (fileIds: string[]) => Promise<void>
  selectFiles: (fileIds: string[]) => void
  clearSelection: () => void
  createFolder: (name: string) => Promise<void>
  clearCompletedOperations: () => void
  moveFiles: (fileIds: string[], targetPath: string) => Promise<void>
  copyFiles: (fileIds: string[], targetPath: string) => Promise<void>
  renameFile: (fileId: string, newName: string) => Promise<void>
  shareFile: (fileId: string, shareWith: string[], permission?: string) => Promise<string>
  searchFiles: (query: string) => Promise<FileItem[]>
  previewFile: (fileId: string) => Promise<any>
  bulkOperation: (operation: string, fileIds: string[], targetPath?: string) => Promise<void>
  clipboard: { operation: 'copy' | null; fileIds: string[] }
  copyFilesToClipboard: (fileIds: string[]) => void
  pasteFiles: (targetPath?: string, operation?: 'copy' | 'move') => Promise<void>
  clearClipboard: () => void
}

const FileContext = createContext<FileContextType | undefined>(undefined)

export const useFiles = () => {
  const context = useContext(FileContext)
  if (context === undefined) {
    throw new Error('useFiles must be used within a FileProvider')
  }
  return context
}

interface FileProviderProps {
  children: ReactNode
}

export const FileProvider: React.FC<FileProviderProps> = ({ children }) => {
  const [state, dispatch] = useReducer(fileReducer, initialState)
  const { isAuthenticated } = useAuth()

  useEffect(() => {
    if (isAuthenticated) {
      loadFiles()
    }
  }, [isAuthenticated])

  const loadFiles = async (path: string = state.currentPath) => {
    dispatch({ type: 'SET_LOADING', payload: true })
    dispatch({ type: 'SET_ERROR', payload: null })
    try {
      console.log('Loading files from path:', path)
      const response = await fileAPI.listFiles(path)
      console.log('Files API response:', response.data)
      
      // Backend returns { data: [...], total: number, path: string }
      const filesData = response.data.data || response.data || []
      console.log('Processed files data:', filesData)
      
      if (!Array.isArray(filesData)) {
        console.warn('Files data is not an array:', filesData)
      }
      
      dispatch({ type: 'SET_FILES', payload: Array.isArray(filesData) ? filesData : [] })
      dispatch({ type: 'SET_CURRENT_PATH', payload: path })
    } catch (error: any) {
      console.error('Error loading files:', error)
      const errorMessage = error.response?.data?.message || error.message || 'Failed to load files'
      dispatch({ type: 'SET_ERROR', payload: errorMessage })
      dispatch({ type: 'SET_FILES', payload: [] }) // Reset to empty array on error
      toast.error(`Error loading files: ${errorMessage}`)
    } finally {
      dispatch({ type: 'SET_LOADING', payload: false })
    }
  }

  const navigateToPath = async (path: string) => {
    await loadFiles(path)
  }

  const uploadFiles = async (files: FileList) => {
    const fileArray = Array.from(files)
    
    for (const file of fileArray) {
      const operationId = Date.now().toString() + Math.random().toString(36).substr(2, 9)
      const operation: FileOperation = {
        id: operationId,
        type: 'upload',
        fileName: file.name,
        status: 'pending',
        progress: 0,
      }
      
      dispatch({ type: 'ADD_OPERATION', payload: operation })
      
      try {
        dispatch({ type: 'UPDATE_OPERATION', payload: { 
          id: operationId, 
          updates: { status: 'in-progress' } 
        }})
        
        const formData = new FormData()
        formData.append('file', file)
        formData.append('path', state.currentPath)
        
        await fileAPI.uploadFile(formData, (progress) => {
          dispatch({ type: 'UPDATE_OPERATION', payload: { 
            id: operationId, 
            updates: { progress } 
          }})
        })
        
        dispatch({ type: 'UPDATE_OPERATION', payload: { 
          id: operationId, 
          updates: { status: 'completed', progress: 100 } 
        }})
        
        toast.success(`${file.name} uploaded successfully`)
        
        // Add small delay for S3 consistency then refresh
        setTimeout(async () => {
          await loadFiles()
          // Clear completed operations after refresh
          setTimeout(() => {
            dispatch({ type: 'REMOVE_OPERATION', payload: operationId })
          }, 2000) // Keep success status visible for 2 seconds
        }, 1000)
        
      } catch (error: any) {
        const errorMessage = error.response?.data?.message || 'Upload failed'
        dispatch({ type: 'UPDATE_OPERATION', payload: { 
          id: operationId, 
          updates: { status: 'failed', error: errorMessage } 
        }})
        toast.error(`Failed to upload ${file.name}: ${errorMessage}`)
      }
    }
  }

  const downloadFile = async (fileId: string) => {
    const file = state.files.find(f => f.id === fileId)
    if (!file) return
    
    const operationId = Date.now().toString() + Math.random().toString(36).substr(2, 9)
    const operation: FileOperation = {
      id: operationId,
      type: 'download',
      fileName: file.name,
      status: 'pending',
      progress: 0,
    }
    
    dispatch({ type: 'ADD_OPERATION', payload: operation })
    
    try {
      dispatch({ type: 'UPDATE_OPERATION', payload: { 
        id: operationId, 
        updates: { status: 'in-progress' } 
      }})
      
      const response = await fileAPI.downloadFile(fileId)
      
      const url = window.URL.createObjectURL(new Blob([response.data]))
      const link = document.createElement('a')
      link.href = url
      link.setAttribute('download', file.name)
      document.body.appendChild(link)
      link.click()
      link.remove()
      window.URL.revokeObjectURL(url)
      
      dispatch({ type: 'UPDATE_OPERATION', payload: { 
        id: operationId, 
        updates: { status: 'completed', progress: 100 } 
      }})
      
      toast.success(`${file.name} downloaded successfully`)
      
    } catch (error: any) {
      const errorMessage = error.response?.data?.message || 'Download failed'
      dispatch({ type: 'UPDATE_OPERATION', payload: { 
        id: operationId, 
        updates: { status: 'failed', error: errorMessage } 
      }})
      toast.error(`Failed to download ${file.name}: ${errorMessage}`)
    }
  }

  const deleteFiles = async (fileIds: string[]) => {
    try {
      const response = await fileAPI.deleteFiles({ 
        file_ids: fileIds
      })
      if (response.data.success) {
        fileIds.forEach(id => {
          dispatch({ type: 'REMOVE_FILE', payload: id })
        })
        toast.success(`${response.data.deleted_count} file(s) deleted successfully`)
      } else {
        toast.error(`Delete failed: ${response.data.errors.join(', ')}`)
      }
    } catch (error: any) {
      const errorMessage = error.response?.data?.message || 'Delete failed'
      toast.error(errorMessage)
    }
  }

  const selectFiles = (fileIds: string[]) => {
    dispatch({ type: 'SET_SELECTED_FILES', payload: fileIds })
  }

  const clearSelection = () => {
    dispatch({ type: 'SET_SELECTED_FILES', payload: [] })
  }

  const createFolder = async (name: string) => {
    try {
      const response = await fileAPI.createFolder({ name, path: state.currentPath })
      dispatch({ type: 'ADD_FILE', payload: response.data })
      toast.success(`Folder "${name}" created successfully`)
    } catch (error: any) {
      const errorMessage = error.response?.data?.message || 'Failed to create folder'
      toast.error(errorMessage)
    }
  }

  const clearCompletedOperations = () => {
    const completedIds = state.operations
      .filter(op => op.status === 'completed')
      .map(op => op.id)
    
    completedIds.forEach(id => {
      dispatch({ type: 'REMOVE_OPERATION', payload: id })
    })
  }

  const moveFiles = async (fileIds: string[], targetPath: string) => {
    try {
      const response = await fileAPI.moveFiles({ 
        file_ids: fileIds, 
        target_path: targetPath
      })
      if (response.data.success) {
        toast.success(`${response.data.moved_count} file(s) moved successfully`)
        await loadFiles()
        clearSelection()
      } else {
        toast.error(`Move failed: ${response.data.errors.join(', ')}`)
      }
    } catch (error: any) {
      const errorMessage = error.response?.data?.message || 'Failed to move files'
      toast.error(errorMessage)
    }
  }

  const copyFiles = async (fileIds: string[], targetPath: string) => {
    try {
      const response = await fileAPI.copyFiles({ 
        file_ids: fileIds, 
        target_path: targetPath
      })
      if (response.data.success) {
        toast.success(`${response.data.copied_count} file(s) copied successfully`)
        await loadFiles()
        clearSelection()
      } else {
        toast.error(`Copy failed: ${response.data.errors.join(', ')}`)
      }
    } catch (error: any) {
      const errorMessage = error.response?.data?.message || 'Failed to copy files'
      toast.error(errorMessage)
    }
  }

  const renameFile = async (fileId: string, newName: string) => {
    try {
      const response = await fileAPI.renameFile(fileId, newName)
      dispatch({ type: 'UPDATE_FILE', payload: response.data })
      toast.success(`File renamed successfully`)
    } catch (error: any) {
      const errorMessage = error.response?.data?.message || 'Failed to rename file'
      toast.error(errorMessage)
    }
  }

  const shareFile = async (fileId: string, shareWith: string[], permission: string = 'read'): Promise<string> => {
    try {
      const response = await fileAPI.shareFile({ 
        file_id: fileId, 
        share_with: shareWith, 
        permission,
        expires_in: 3600 
      })
      toast.success(`File shared successfully`)
      return response.data.share_url
    } catch (error: any) {
      const errorMessage = error.response?.data?.message || 'Failed to share file'
      toast.error(errorMessage)
      throw error
    }
  }

  const searchFiles = async (query: string): Promise<FileItem[]> => {
    try {
      const response = await fileAPI.searchFiles(query, state.currentPath)
      return response.data.results
    } catch (error: any) {
      const errorMessage = error.response?.data?.message || 'Search failed'
      toast.error(errorMessage)
      return []
    }
  }

  const previewFile = async (fileId: string) => {
    try {
      const response = await fileAPI.previewFile(fileId)
      return response.data
    } catch (error: any) {
      const errorMessage = error.response?.data?.message || 'Failed to get file preview'
      toast.error(errorMessage)
      throw error
    }
  }

  const bulkOperation = async (operation: string, fileIds: string[], targetPath?: string) => {
    try {
      const response = await fileAPI.bulkOperation({ 
        operation, 
        file_ids: fileIds, 
        target_path: targetPath 
      })
      
      if (response.data.success !== false) {
        toast.success(`Bulk ${operation} completed successfully`)
        await loadFiles()
        clearSelection()
      } else {
        toast.error(`Bulk ${operation} failed`)
      }
    } catch (error: any) {
      const errorMessage = error.response?.data?.message || `Bulk ${operation} failed`
      toast.error(errorMessage)
    }
  }

  const copyFilesToClipboard = (fileIds: string[]) => {
    dispatch({ type: 'SET_CLIPBOARD', payload: { operation: 'copy', fileIds } })
    toast.success(`${fileIds.length} file(s) copied to clipboard`)
  }

  const pasteFiles = async (targetPath?: string, operation: 'copy' | 'move' = 'copy') => {
    const { fileIds } = state.clipboard
    if (fileIds.length === 0) {
      toast.error('Nothing to paste')
      return
    }

    const destination = targetPath || state.currentPath

    try {
      if (operation === 'move') {
        await moveFiles(fileIds, destination)
      } else {
        await copyFiles(fileIds, destination)
      }
      
      // Clear clipboard after successful paste
      clearClipboard()
    } catch (error) {
      // Error handling is done in moveFiles/copyFiles
    }
  }

  const clearClipboard = () => {
    dispatch({ type: 'CLEAR_CLIPBOARD', payload: undefined })
  }

  const contextValue: FileContextType = {
    ...state,
    loadFiles,
    navigateToPath,
    uploadFiles,
    downloadFile,
    deleteFiles,
    selectFiles,
    clearSelection,
    createFolder,
    clearCompletedOperations,
    moveFiles,
    copyFiles,
    renameFile,
    shareFile,
    searchFiles,
    previewFile,
    bulkOperation,
    copyFilesToClipboard,
    pasteFiles,
    clearClipboard,
  }

  return (
    <FileContext.Provider value={contextValue}>
      {children}
    </FileContext.Provider>
  )
}