import React, { useState } from 'react'
import { User, Lock, Mail, Save, Eye, EyeOff } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { userAPI } from '@/services/api'
import { useForm } from 'react-hook-form'
import { validateEmail, validatePassword } from '@/utils'
import Button from '@/components/ui/Button'
import toast from 'react-hot-toast'

interface ProfileFormData {
  username: string
  email: string
}

interface PasswordFormData {
  currentPassword: string
  newPassword: string
  confirmPassword: string
}

const Profile: React.FC = () => {
  const { user } = useAuth()
  const [showCurrentPassword, setShowCurrentPassword] = useState(false)
  const [showNewPassword, setShowNewPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)

  const {
    register: registerProfile,
    handleSubmit: handleSubmitProfile,
    formState: { errors: errorsProfile, isSubmitting: isSubmittingProfile },
  } = useForm<ProfileFormData>({
    defaultValues: {
      username: user?.username || '',
      email: user?.email || '',
    },
  })

  const {
    register: registerPassword,
    handleSubmit: handleSubmitPassword,
    watch,
    reset: resetPassword,
    formState: { errors: errorsPassword, isSubmitting: isSubmittingPassword },
  } = useForm<PasswordFormData>()

  const newPassword = watch('newPassword')

  const handleUpdateProfile = async (data: ProfileFormData) => {
    try {
      await userAPI.updateProfile(data)
      toast.success('Profile updated successfully')
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to update profile')
    }
  }

  const handleUpdatePassword = async (data: PasswordFormData) => {
    try {
      await userAPI.updateProfile({
        currentPassword: data.currentPassword,
        newPassword: data.newPassword,
      })
      toast.success('Password updated successfully')
      resetPassword()
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to update password')
    }
  }

  if (!user) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-gray-500">Loading profile...</p>
      </div>
    )
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Profile Settings</h1>
        <p className="mt-2 text-gray-600">Manage your account settings and preferences</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-1">
          <div className="card text-center">
            <div className="h-24 w-24 bg-primary-600 rounded-full flex items-center justify-center mx-auto">
              <span className="text-3xl font-bold text-white">
                {user.username.charAt(0).toUpperCase()}
              </span>
            </div>
            <h3 className="mt-4 text-xl font-medium text-gray-900">{user.username}</h3>
            <p className="text-gray-500">{user.email}</p>
            <div className="mt-4">
              <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                user.role === 'admin' ? 'text-purple-600 bg-purple-100' : 'text-blue-600 bg-blue-100'
              }`}>
                {user.role === 'admin' ? '👑' : '👤'} {user.role}
              </span>
            </div>
            <div className="mt-4 text-sm text-gray-500">
              <p>Member since</p>
              <p>{new Date(user.createdAt).toLocaleDateString()}</p>
            </div>
          </div>
        </div>

        <div className="lg:col-span-2 space-y-6">
          <div className="card">
            <h3 className="text-lg font-medium text-gray-900 mb-4 flex items-center">
              <User className="h-5 w-5 mr-2" />
              Profile Information
            </h3>
            
            <form onSubmit={handleSubmitProfile(handleUpdateProfile)} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">Username</label>
                <input
                  {...registerProfile('username', {
                    required: 'Username is required',
                    minLength: { value: 3, message: 'Username must be at least 3 characters' },
                  })}
                  className="mt-1 input-field"
                  placeholder="Enter username"
                />
                {errorsProfile.username && (
                  <p className="mt-1 text-sm text-red-600">{errorsProfile.username.message}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">Email</label>
                <input
                  {...registerProfile('email', {
                    required: 'Email is required',
                    validate: (value) => validateEmail(value) || 'Invalid email address',
                  })}
                  type="email"
                  className="mt-1 input-field"
                  placeholder="Enter email"
                />
                {errorsProfile.email && (
                  <p className="mt-1 text-sm text-red-600">{errorsProfile.email.message}</p>
                )}
              </div>

              <div className="flex justify-end">
                <Button type="submit" loading={isSubmittingProfile}>
                  <Save className="h-4 w-4 mr-2" />
                  Update Profile
                </Button>
              </div>
            </form>
          </div>

          <div className="card">
            <h3 className="text-lg font-medium text-gray-900 mb-4 flex items-center">
              <Lock className="h-5 w-5 mr-2" />
              Change Password
            </h3>
            
            <form onSubmit={handleSubmitPassword(handleUpdatePassword)} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">Current Password</label>
                <div className="mt-1 relative">
                  <input
                    {...registerPassword('currentPassword', {
                      required: 'Current password is required',
                    })}
                    type={showCurrentPassword ? 'text' : 'password'}
                    className="input-field pr-10"
                    placeholder="Enter current password"
                  />
                  <button
                    type="button"
                    className="absolute inset-y-0 right-0 pr-3 flex items-center"
                    onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                  >
                    {showCurrentPassword ? (
                      <EyeOff className="h-4 w-4 text-gray-400" />
                    ) : (
                      <Eye className="h-4 w-4 text-gray-400" />
                    )}
                  </button>
                </div>
                {errorsPassword.currentPassword && (
                  <p className="mt-1 text-sm text-red-600">{errorsPassword.currentPassword.message}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">New Password</label>
                <div className="mt-1 relative">
                  <input
                    {...registerPassword('newPassword', {
                      required: 'New password is required',
                      validate: (value) => {
                        const validation = validatePassword(value)
                        return validation.isValid || validation.errors[0]
                      },
                    })}
                    type={showNewPassword ? 'text' : 'password'}
                    className="input-field pr-10"
                    placeholder="Enter new password"
                  />
                  <button
                    type="button"
                    className="absolute inset-y-0 right-0 pr-3 flex items-center"
                    onClick={() => setShowNewPassword(!showNewPassword)}
                  >
                    {showNewPassword ? (
                      <EyeOff className="h-4 w-4 text-gray-400" />
                    ) : (
                      <Eye className="h-4 w-4 text-gray-400" />
                    )}
                  </button>
                </div>
                {errorsPassword.newPassword && (
                  <p className="mt-1 text-sm text-red-600">{errorsPassword.newPassword.message}</p>
                )}
                {newPassword && (
                  <div className="mt-2">
                    <div className="text-xs text-gray-600">Password strength:</div>
                    <div className="flex space-x-1 mt-1">
                      {Array.from({ length: 4 }).map((_, i) => {
                        const validation = validatePassword(newPassword)
                        const strength = 4 - validation.errors.length
                        return (
                          <div
                            key={i}
                            className={`h-1 flex-1 rounded ${
                              i < strength
                                ? strength <= 1
                                  ? 'bg-red-500'
                                  : strength <= 2
                                  ? 'bg-yellow-500'
                                  : 'bg-green-500'
                                : 'bg-gray-200'
                            }`}
                          />
                        )
                      })}
                    </div>
                  </div>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">Confirm New Password</label>
                <div className="mt-1 relative">
                  <input
                    {...registerPassword('confirmPassword', {
                      required: 'Please confirm your new password',
                      validate: (value) => value === newPassword || 'Passwords do not match',
                    })}
                    type={showConfirmPassword ? 'text' : 'password'}
                    className="input-field pr-10"
                    placeholder="Confirm new password"
                  />
                  <button
                    type="button"
                    className="absolute inset-y-0 right-0 pr-3 flex items-center"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  >
                    {showConfirmPassword ? (
                      <EyeOff className="h-4 w-4 text-gray-400" />
                    ) : (
                      <Eye className="h-4 w-4 text-gray-400" />
                    )}
                  </button>
                </div>
                {errorsPassword.confirmPassword && (
                  <p className="mt-1 text-sm text-red-600">{errorsPassword.confirmPassword.message}</p>
                )}
              </div>

              <div className="flex justify-end space-x-2">
                <Button type="button" variant="outline" onClick={() => resetPassword()}>
                  Cancel
                </Button>
                <Button type="submit" loading={isSubmittingPassword}>
                  <Lock className="h-4 w-4 mr-2" />
                  Update Password
                </Button>
              </div>
            </form>
          </div>

          <div className="card">
            <h3 className="text-lg font-medium text-gray-900 mb-4">Account Information</h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">User ID</label>
                <p className="mt-1 text-sm text-gray-900 font-mono">{user.id}</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Role</label>
                <p className="mt-1 text-sm text-gray-900 capitalize">{user.role}</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Account Created</label>
                <p className="mt-1 text-sm text-gray-900">
                  {new Date(user.createdAt).toLocaleDateString('en-US', {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric',
                  })}
                </p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Last Updated</label>
                <p className="mt-1 text-sm text-gray-900">
                  {new Date(user.updatedAt).toLocaleDateString('en-US', {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric',
                  })}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default Profile