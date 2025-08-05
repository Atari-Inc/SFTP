import React, { createContext, useContext, useReducer, ReactNode } from 'react'
import { fileAPI } from '@/services/api'
import toast from 'react-hot-toast'

interface FileItem {
  id: string
  name: string
  size: number
  type: 'file' | 'folder'
  path: string
  createdAt: string
  modifiedAt: string
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

const initialState: FileState = {
  currentPath: '/',
  files: [],
  selectedFiles: [],
  operations: [],
  isLoading: false,
  error: null,
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

  const loadFiles = async (path: string = state.currentPath) => {
    dispatch({ type: 'SET_LOADING', payload: true })
    try {
      const response = await fileAPI.listFiles(path)
      // Backend returns { data: [...], total: number, path: string }
      const filesData = response.data.data || response.data || []
      dispatch({ type: 'SET_FILES', payload: Array.isArray(filesData) ? filesData : [] })
      dispatch({ type: 'SET_CURRENT_PATH', payload: path })
    } catch (error: any) {
      const errorMessage = error.response?.data?.message || 'Failed to load files'
      dispatch({ type: 'SET_ERROR', payload: errorMessage })
      dispatch({ type: 'SET_FILES', payload: [] }) // Reset to empty array on error
      toast.error(errorMessage)
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
        await loadFiles()
        
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
      await fileAPI.deleteFiles(fileIds)
      fileIds.forEach(id => {
        dispatch({ type: 'REMOVE_FILE', payload: id })
      })
      toast.success(`${fileIds.length} file(s) deleted successfully`)
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
  }

  return (
    <FileContext.Provider value={contextValue}>
      {children}
    </FileContext.Provider>
  )
}