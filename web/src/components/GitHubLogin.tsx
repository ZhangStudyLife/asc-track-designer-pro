import React from 'react'
import { useAuth } from '../contexts/AuthContext'

interface GitHubLoginProps {
  compact?: boolean
}

export function GitHubLogin({ compact = false }: GitHubLoginProps) {
  const { user, isLoading, isAuthenticated, login, logout } = useAuth()

  if (isLoading) {
    return (
      <div style={compact ? styles.compactContainer : styles.container}>
        <span style={styles.loading}>加载中...</span>
      </div>
    )
  }

  if (isAuthenticated && user) {
    return (
      <div style={compact ? styles.compactContainer : styles.container}>
        <div style={styles.userInfo}>
          <img
            src={user.avatar_url}
            alt={user.name || user.login}
            style={compact ? styles.avatarCompact : styles.avatar}
          />
          {!compact && (
            <div style={styles.userDetails}>
              <div style={styles.userName}>{user.name || user.login}</div>
              <div style={styles.userLogin}>@{user.login}</div>
            </div>
          )}
        </div>
        <button
          onClick={logout}
          style={compact ? styles.logoutButtonCompact : styles.logoutButton}
          title="登出"
        >
          {compact ? '退出' : '🚪 登出'}
        </button>
      </div>
    )
  }

  return (
    <div style={compact ? styles.compactContainer : styles.container}>
      <button
        onClick={login}
        style={compact ? styles.loginButtonCompact : styles.loginButton}
      >
        {compact ? '登录' : '🔐 GitHub 登录'}
      </button>
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
    padding: '16px',
    background: '#FFFFFF',
    borderRadius: '8px',
    border: '1px solid #E5E7EB',
  },
  compactContainer: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  },
  loading: {
    fontSize: '12px',
    color: '#6B7280',
  },
  userInfo: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
  },
  avatar: {
    width: '48px',
    height: '48px',
    borderRadius: '50%',
    border: '2px solid #3B82F6',
  },
  avatarCompact: {
    width: '32px',
    height: '32px',
    borderRadius: '50%',
    border: '2px solid #3B82F6',
  },
  userDetails: {
    display: 'flex',
    flexDirection: 'column',
    gap: '2px',
  },
  userName: {
    fontSize: '14px',
    fontWeight: '600',
    color: '#111827',
  },
  userLogin: {
    fontSize: '12px',
    color: '#6B7280',
  },
  loginButton: {
    width: '100%',
    padding: '10px 16px',
    background: 'linear-gradient(135deg, #24292E 0%, #000000 100%)',
    color: '#FFFFFF',
    border: 'none',
    borderRadius: '8px',
    fontSize: '14px',
    fontWeight: '600',
    cursor: 'pointer',
    transition: 'all 0.2s',
  },
  loginButtonCompact: {
    padding: '6px 12px',
    background: '#24292E',
    color: '#FFFFFF',
    border: 'none',
    borderRadius: '6px',
    fontSize: '12px',
    fontWeight: '600',
    cursor: 'pointer',
    transition: 'all 0.2s',
  },
  logoutButton: {
    width: '100%',
    padding: '8px 12px',
    background: '#F3F4F6',
    color: '#6B7280',
    border: '1px solid #E5E7EB',
    borderRadius: '6px',
    fontSize: '13px',
    fontWeight: '500',
    cursor: 'pointer',
    transition: 'all 0.2s',
  },
  logoutButtonCompact: {
    padding: '4px 8px',
    background: '#F3F4F6',
    color: '#6B7280',
    border: '1px solid #E5E7EB',
    borderRadius: '4px',
    fontSize: '11px',
    fontWeight: '500',
    cursor: 'pointer',
  },
}
