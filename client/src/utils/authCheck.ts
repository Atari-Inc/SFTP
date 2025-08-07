export const checkAuthStatus = () => {
  const token = localStorage.getItem('token')
  
  if (!token) {
    console.log('❌ No authentication token found')
    return { status: 'no_token', message: 'Please log in' }
  }

  try {
    // Basic JWT structure check
    const parts = token.split('.')
    if (parts.length !== 3) {
      console.log('❌ Invalid token format')
      return { status: 'invalid_format', message: 'Invalid token format' }
    }

    // Decode payload (without verification)
    const payload = JSON.parse(atob(parts[1]))
    const now = Math.floor(Date.now() / 1000)
    
    if (payload.exp && payload.exp < now) {
      console.log('❌ Token has expired')
      localStorage.removeItem('token')
      return { status: 'expired', message: 'Token expired, please log in again' }
    }

    console.log('✅ Token appears valid', { user_id: payload.sub, exp: new Date(payload.exp * 1000) })
    return { status: 'valid', user_id: payload.sub }

  } catch (error) {
    console.log('❌ Error checking token:', error)
    localStorage.removeItem('token')
    return { status: 'error', message: 'Invalid token, please log in again' }
  }
}