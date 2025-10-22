import React, { useState } from 'react'
import { useEditorStore } from '../store'
import { uploadTrack } from '../api'
import { useAuth } from '../contexts/AuthContext'
import { GitHubLogin } from './GitHubLogin'
import { TagSelector } from './TagSelector'

interface ShareDialogProps {
  onClose: () => void
}

export function ShareDialog({ onClose }: ShareDialogProps) {
  const { isAuthenticated } = useAuth()
  const project = useEditorStore(state => state.project)
  const [name, setName] = useState(project.name || 'Untitled Track')
  const [description, setDescription] = useState('')
  const [tags, setTags] = useState<string[]>([])
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)

  const handleUpload = async () => {
    if (!isAuthenticated) {
      setError('请先登录 GitHub 账号')
      return
    }

    if (!name.trim()) {
      setError('请输入赛道名称')
      return
    }

    setUploading(true)
    setError('')

    try {
      // 生成缩略图
      const thumbnail = await generateThumbnail()

      // 上传（包含标签）
      const result = await uploadTrack(project, name, description, thumbnail, tags)

      if (result.success) {
        setSuccess(true)
        setTimeout(() => {
          onClose()
        }, 2000)
      } else {
        setError(result.error || '上传失败')
      }
    } catch (err) {
      setError('上传失败: ' + (err as Error).message)
    } finally {
      setUploading(false)
    }
  }

  const generateThumbnail = async (): Promise<string> => {
    // 获取Canvas的SVG元素
    const svgElement = document.querySelector('svg') as SVGSVGElement
    if (!svgElement) return ''

    try {
      // 克隆SVG避免影响原始元素
      const clonedSvg = svgElement.cloneNode(true) as SVGSVGElement

      // 设置固定尺寸（缩略图）
      const width = 300
      const height = 200
      clonedSvg.setAttribute('width', String(width))
      clonedSvg.setAttribute('height', String(height))

      // 序列化SVG
      const svgData = new XMLSerializer().serializeToString(clonedSvg)
      const svgBlob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' })

      // 转换为Canvas
      return new Promise((resolve) => {
        const img = new Image()
        const url = URL.createObjectURL(svgBlob)

        img.onload = () => {
          const canvas = document.createElement('canvas')
          canvas.width = width
          canvas.height = height
          const ctx = canvas.getContext('2d')
          if (ctx) {
            ctx.drawImage(img, 0, 0, width, height)
            const base64 = canvas.toDataURL('image/png')
            resolve(base64)
          } else {
            resolve('')
          }
          URL.revokeObjectURL(url)
        }

        img.onerror = () => {
          resolve('')
          URL.revokeObjectURL(url)
        }

        img.src = url
      })
    } catch (err) {
      console.error('生成缩略图失败:', err)
      return ''
    }
  }

  return (
    <div style={styles.overlay} onClick={onClose}>
      <div style={styles.dialog} onClick={(e) => e.stopPropagation()}>
        <h2 style={styles.title}>分享赛道</h2>

        {success ? (
          <div style={styles.success}>
            <div style={styles.successIcon}>✓</div>
            <p>分享成功！</p>
          </div>
        ) : (
          <>
            {/* 登录状态 */}
            <div style={styles.loginSection}>
              <GitHubLogin />
            </div>

            {!isAuthenticated && (
              <div style={styles.warning}>
                请先使用 GitHub 账号登录以分享赛道
              </div>
            )}

            <div style={styles.field}>
              <label style={styles.label}>赛道名称 *</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                style={styles.input}
                placeholder="输入赛道名称"
                disabled={!isAuthenticated}
              />
            </div>

            <div style={styles.field}>
              <label style={styles.label}>赛道描述</label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                style={styles.textarea}
                placeholder="输入赛道描述（可选）"
                rows={4}
                disabled={!isAuthenticated}
              />
            </div>

            {/* 标签选择器 */}
            <div style={styles.field}>
              <TagSelector
                selectedTags={tags}
                onChange={setTags}
              />
            </div>

            {error && <div style={styles.error}>{error}</div>}

            <div style={styles.buttons}>
              <button
                onClick={onClose}
                style={{ ...styles.button, ...styles.cancelButton }}
                disabled={uploading}
              >
                取消
              </button>
              <button
                onClick={handleUpload}
                style={{ ...styles.button, ...styles.uploadButton }}
                disabled={uploading || !isAuthenticated}
              >
                {uploading ? '上传中...' : '上传'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  overlay: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000,
  },
  dialog: {
    backgroundColor: '#fff',
    borderRadius: '8px',
    padding: '24px',
    width: '90%',
    maxWidth: '600px',
    maxHeight: '90vh',
    overflowY: 'auto',
    boxShadow: '0 4px 16px rgba(0, 0, 0, 0.2)',
  },
  title: {
    margin: '0 0 20px 0',
    fontSize: '20px',
    fontWeight: 'bold',
    color: '#333',
  },
  loginSection: {
    marginBottom: '16px',
    padding: '12px',
    backgroundColor: '#f9f9f9',
    borderRadius: '6px',
  },
  warning: {
    padding: '12px',
    backgroundColor: '#fff3cd',
    color: '#856404',
    borderRadius: '4px',
    fontSize: '14px',
    marginBottom: '16px',
    border: '1px solid #ffeaa7',
  },
  field: {
    marginBottom: '16px',
  },
  label: {
    display: 'block',
    marginBottom: '8px',
    fontSize: '14px',
    fontWeight: '500',
    color: '#555',
  },
  input: {
    width: '100%',
    padding: '10px',
    border: '1px solid #ddd',
    borderRadius: '4px',
    fontSize: '14px',
    boxSizing: 'border-box',
  },
  textarea: {
    width: '100%',
    padding: '10px',
    border: '1px solid #ddd',
    borderRadius: '4px',
    fontSize: '14px',
    fontFamily: 'inherit',
    resize: 'vertical',
    boxSizing: 'border-box',
  },
  error: {
    padding: '10px',
    backgroundColor: '#fee',
    color: '#c33',
    borderRadius: '4px',
    fontSize: '14px',
    marginBottom: '16px',
  },
  success: {
    textAlign: 'center',
    padding: '40px 20px',
  },
  successIcon: {
    fontSize: '48px',
    color: '#4caf50',
    marginBottom: '16px',
  },
  buttons: {
    display: 'flex',
    gap: '12px',
    justifyContent: 'flex-end',
  },
  button: {
    padding: '10px 20px',
    border: 'none',
    borderRadius: '4px',
    fontSize: '14px',
    fontWeight: '500',
    cursor: 'pointer',
    transition: 'opacity 0.2s',
  },
  cancelButton: {
    backgroundColor: '#f0f0f0',
    color: '#666',
  },
  uploadButton: {
    backgroundColor: '#1976d2',
    color: '#fff',
  },
}
