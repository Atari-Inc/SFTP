import React, { useEffect } from 'react'
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'
import { clsx } from 'clsx'

interface ModalProps {
  isOpen: boolean
  onClose: () => void
  title?: string
  children: React.ReactNode
  size?: 'sm' | 'md' | 'lg' | 'xl'
  closeOnOverlayClick?: boolean
}

const Modal: React.FC<ModalProps> = ({
  isOpen,
  onClose,
  title,
  children,
  size = 'md',
  closeOnOverlayClick = true,
}) => {
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = 'unset'
    }

    return () => {
      document.body.style.overflow = 'unset'
    }
  }, [isOpen])

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose()
      }
    }

    if (isOpen) {
      document.addEventListener('keydown', handleEscape)
    }

    return () => {
      document.removeEventListener('keydown', handleEscape)
    }
  }, [isOpen, onClose])

  if (!isOpen) return null

  const sizeClasses = {
    sm: 'max-w-md',
    md: 'max-w-lg',
    lg: 'max-w-2xl',
    xl: 'max-w-4xl',
  }

  const handleOverlayClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget && closeOnOverlayClick) {
      onClose()
    }
  }

  return createPortal(
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div 
        className="flex min-h-screen items-center justify-center p-4 text-center sm:p-0"
        onClick={handleOverlayClick}
      >
        <div className="fixed inset-0 bg-black bg-opacity-50 transition-opacity" />
        
        <div className={clsx(
          'relative inline-block w-full transform overflow-hidden rounded-lg bg-white text-left shadow-xl transition-all sm:my-8 sm:align-middle',
          sizeClasses[size]
        )}>
          <div className="bg-white px-6 py-4">
            <div className="flex items-center justify-between">
              {title && (
                <h3 className="text-lg font-medium leading-6 text-gray-900">
                  {title}
                </h3>
              )}
              <button
                type="button"
                className="rounded-md bg-white text-gray-400 hover:text-gray-600 focus:outline-none focus:ring-2 focus:ring-primary-500"
                onClick={onClose}
              >
                <X className="h-6 w-6" />
              </button>
            </div>
          </div>
          
          <div className="px-6 pb-6">
            {children}
          </div>
        </div>
      </div>
    </div>,
    document.body
  )
}

export default Modal