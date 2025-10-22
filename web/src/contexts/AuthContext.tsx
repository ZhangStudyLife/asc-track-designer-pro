import { createContext, useContext, useState, useEffect, ReactNode } from 'react'

interface User {
  id: string
  login: string
  name: string
  avatar_url: string
}

interface AuthContextType {
  user: User | null
  isLoading: boolean
  isAuthenticated: boolean
  login: () => void
  logout: () => void
  refreshUser: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  // 检查当前登录状态
  const refreshUser = async () => {
    try {
      // 优先使用localStorage中的token
      const token = localStorage.getItem('auth_token')

      const headers: HeadersInit = {}
      if (token) {
        headers['Authorization'] = `Bearer ${token}`
      }

      const response = await fetch('/api/auth/user', {
        credentials: 'include', // 包含cookie(备用方案)
        headers,
      })

      if (response.ok) {
        const userData = await response.json()
        setUser(userData)
        console.log('✅ 用户已登录:', userData.login)
      } else {
        setUser(null)
        // 如果401,清除可能无效的token
        if (response.status === 401) {
          localStorage.removeItem('auth_token')
        }
        console.log('ℹ️ 用户未登录')
      }
    } catch (error) {
      console.error('Failed to fetch user:', error)
      setUser(null)
    } finally {
      setIsLoading(false)
    }
  }

  // 初始化时检查登录状态和URL中的token
  useEffect(() => {
    // 检查URL query参数中是否有token (OAuth回调)
    const urlParams = new URLSearchParams(window.location.search)
    const tokenFromUrl = urlParams.get('auth_token')

    console.log('📍 当前URL:', window.location.href)
    console.log('📍 Query参数:', window.location.search)

    if (tokenFromUrl) {
      // 保存token到localStorage
      localStorage.setItem('auth_token', tokenFromUrl)
      console.log('✅ 从URL获取token并保存, token长度:', tokenFromUrl.length)

      // 清除URL中的token(安全起见)
      const cleanUrl = window.location.pathname
      window.history.replaceState(null, '', cleanUrl)
    } else {
      const existingToken = localStorage.getItem('auth_token')
      if (existingToken) {
        console.log('📦 使用已存储的token, 长度:', existingToken.length)
      } else {
        console.log('ℹ️ 没有找到token')
      }
    }

    refreshUser()
  }, [])

  // 监听页面焦点,自动刷新登录状态(处理OAuth回调后的刷新)
  useEffect(() => {
    const handleFocus = () => {
      // 只在非加载状态下刷新,避免重复请求
      if (!isLoading) {
        refreshUser()
      }
    }

    window.addEventListener('focus', handleFocus)
    return () => window.removeEventListener('focus', handleFocus)
  }, [isLoading])

  // 登录：跳转到GitHub OAuth
  const login = async () => {
    try {
      const response = await fetch('/api/auth/github')
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: '未知错误' }))
        alert(errorData.error || 'GitHub OAuth未配置，请联系管理员')
        return
      }
      const data = await response.json()
      if (data.url) {
        window.location.href = data.url
      }
    } catch (error) {
      console.error('Failed to initiate login:', error)
      alert('登录失败，请稍后重试')
    }
  }

  // 登出
  const logout = async () => {
    try {
      await fetch('/api/auth/logout', {
        method: 'POST',
        credentials: 'include',
      })
      setUser(null)
    } catch (error) {
      console.error('Failed to logout:', error)
    }
  }

  const value: AuthContextType = {
    user,
    isLoading,
    isAuthenticated: user !== null,
    login,
    logout,
    refreshUser,
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}
