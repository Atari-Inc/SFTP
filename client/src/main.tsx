import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { Toaster } from 'react-hot-toast'
import App from './App'
import { AuthProvider } from './contexts/AuthContext'
import { FileProvider } from './contexts/FileContext'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <FileProvider>
          <App />
          <Toaster position="top-right" />
        </FileProvider>
      </AuthProvider>
    </BrowserRouter>
  </React.StrictMode>,
)