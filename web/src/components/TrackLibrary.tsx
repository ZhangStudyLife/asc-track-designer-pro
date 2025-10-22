import React, { useState, useEffect } from 'react'
import { TrackMetadata } from '../types'
import { listTracks, getTrack, downloadTrack } from '../api'
import { useEditorStore } from '../store'

interface TrackLibraryProps {
  onClose: () => void
}

// 预设标签（与 TagSelector 保持一致）
const PRESET_TAGS = [
  { id: 'beginner', label: '初学者', color: '#4caf50' },
  { id: 'intermediate', label: '中级', color: '#ff9800' },
  { id: 'advanced', label: '高级', color: '#f44336' },
  { id: 'circular', label: '圆形', color: '#2196f3' },
  { id: 'figure8', label: '8字形', color: '#9c27b0' },
  { id: 'straight', label: '直道为主', color: '#607d8b' },
  { id: 'curves', label: '弯道为主', color: '#3f51b5' },
  { id: 'competition', label: '竞赛级', color: '#e91e63' },
  { id: 'practice', label: '练习用', color: '#009688' },
]

export function TrackLibrary({ onClose }: TrackLibraryProps) {
  const [tracks, setTracks] = useState<TrackMetadata[]>([])
  const [loading, setLoading] = useState(true)
  const [detailLoading, setDetailLoading] = useState(false)
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedTags, setSelectedTags] = useState<string[]>([])
  const [lengthRange, setLengthRange] = useState<[number, number]>([500, 5000])
  const [showFilters, setShowFilters] = useState(false)

  const setProject = useEditorStore(state => state.setProject)

  useEffect(() => {
    loadTracks()
  }, [page, searchQuery, selectedTags, lengthRange])

  const loadTracks = async () => {
    setLoading(true)
    try {
      const result = await listTracks(
        page,
        20,
        searchQuery,
        selectedTags,
        lengthRange[0],
        lengthRange[1]
      )
      if (result.success && result.data) {
        setTracks(result.data.items)
        setTotal(result.data.total)
      }
    } catch (err) {
      console.error('加载赛道列表失败:', err)
    } finally {
      setLoading(false)
    }
  }

  const handleApply = async (track: TrackMetadata) => {
    setDetailLoading(true)
    try {
      const result = await getTrack(track.id)
      if (result.success && result.data) {
        setProject(result.data.project)
        onClose()
      }
    } catch (err) {
      console.error('加载赛道失败:', err)
      alert('加载赛道失败')
    } finally {
      setDetailLoading(false)
    }
  }

  const handleDownload = async (track: TrackMetadata) => {
    try {
      const project = await downloadTrack(track.id)
      const blob = new Blob([JSON.stringify(project, null, 2)], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${track.name}.json`
      a.click()
      URL.revokeObjectURL(url)
    } catch (err) {
      console.error('下载失败:', err)
      alert('下载失败')
    }
  }

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    setPage(1)
    loadTracks()
  }

  const toggleTag = (tagId: string) => {
    if (selectedTags.includes(tagId)) {
      setSelectedTags(selectedTags.filter(t => t !== tagId))
    } else {
      setSelectedTags([...selectedTags, tagId])
    }
    setPage(1)
  }

  const getTagColor = (tag: string) => {
    const preset = PRESET_TAGS.find(t => t.id === tag)
    return preset ? preset.color : '#607d8b'
  }

  const getTagLabel = (tag: string) => {
    const preset = PRESET_TAGS.find(t => t.id === tag)
    return preset ? preset.label : tag
  }

  return (
    <div style={styles.overlay} onClick={onClose}>
      <div style={styles.container} onClick={(e) => e.stopPropagation()}>
        <div style={styles.header}>
          <h2 style={styles.title}>赛道分享库</h2>
          <form onSubmit={handleSearch} style={styles.searchForm}>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="搜索赛道..."
              style={styles.searchInput}
            />
            <button type="submit" style={styles.searchButton}>搜索</button>
          </form>
          <button
            onClick={() => setShowFilters(!showFilters)}
            style={styles.filterToggle}
          >
            {showFilters ? '隐藏筛选' : '显示筛选'}
          </button>
          <button onClick={onClose} style={styles.closeButton}>✕</button>
        </div>

        {/* 筛选面板 */}
        {showFilters && (
          <div style={styles.filterPanel}>
            <div style={styles.filterSection}>
              <label style={styles.filterLabel}>标签筛选:</label>
              <div style={styles.tagFilters}>
                {PRESET_TAGS.map(tag => (
                  <button
                    key={tag.id}
                    onClick={() => toggleTag(tag.id)}
                    style={{
                      ...styles.tagChip,
                      backgroundColor: selectedTags.includes(tag.id) ? tag.color : '#f0f0f0',
                      color: selectedTags.includes(tag.id) ? '#fff' : '#666',
                    }}
                  >
                    {tag.label}
                  </button>
                ))}
              </div>
            </div>

            <div style={styles.filterSection}>
              <label style={styles.filterLabel}>
                长度范围: {lengthRange[0]}cm - {lengthRange[1]}cm
              </label>
              <div style={styles.rangeInputs}>
                <input
                  type="number"
                  value={lengthRange[0]}
                  onChange={(e) => {
                    const val = parseInt(e.target.value) || 0
                    setLengthRange([val, lengthRange[1]])
                  }}
                  min={0}
                  max={10000}
                  style={styles.rangeInput}
                />
                <span>-</span>
                <input
                  type="number"
                  value={lengthRange[1]}
                  onChange={(e) => {
                    const val = parseInt(e.target.value) || 5000
                    setLengthRange([lengthRange[0], val])
                  }}
                  min={0}
                  max={10000}
                  style={styles.rangeInput}
                />
              </div>
            </div>
          </div>
        )}

        {loading ? (
          <div style={styles.loading}>加载中...</div>
        ) : tracks.length === 0 ? (
          <div style={styles.empty}>暂无赛道</div>
        ) : (
          <>
            <div style={styles.grid}>
              {tracks.map((track) => (
                <div key={track.id} style={styles.card}>
                  {track.thumbnail ? (
                    <img src={track.thumbnail} alt={track.name} style={styles.thumbnail} />
                  ) : (
                    <div style={styles.noThumbnail}>无预览</div>
                  )}
                  <div style={styles.cardContent}>
                    <h3 style={styles.cardTitle}>{track.name}</h3>

                    {/* 上传者信息 */}
                    {track.uploaderName && (
                      <div style={styles.uploader}>
                        {track.uploaderAvatar && (
                          <img
                            src={track.uploaderAvatar}
                            alt={track.uploaderName}
                            style={styles.uploaderAvatar}
                          />
                        )}
                        <span style={styles.uploaderName}>{track.uploaderName}</span>
                      </div>
                    )}

                    {track.description && (
                      <p style={styles.description}>{track.description}</p>
                    )}

                    {/* 赛道标签 */}
                    {track.tags && track.tags.length > 0 && (
                      <div style={styles.trackTags}>
                        {track.tags.map(tag => (
                          <span
                            key={tag}
                            style={{
                              ...styles.trackTag,
                              backgroundColor: getTagColor(tag),
                            }}
                          >
                            {getTagLabel(tag)}
                          </span>
                        ))}
                      </div>
                    )}

                    <div style={styles.meta}>
                      <span>元件: {track.totalPieces}</span>
                      <span>长度: {track.totalLength}m</span>
                    </div>

                    <div style={styles.cardButtons}>
                      <button
                        onClick={() => handleApply(track)}
                        style={{ ...styles.cardButton, ...styles.applyButton }}
                        disabled={detailLoading}
                      >
                        应用
                      </button>
                      <button
                        onClick={() => handleDownload(track)}
                        style={{ ...styles.cardButton, ...styles.downloadButton }}
                      >
                        下载
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div style={styles.pagination}>
              <button
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
                style={styles.pageButton}
              >
                上一页
              </button>
              <span style={styles.pageInfo}>
                第 {page} 页 / 共 {Math.ceil(total / 20)} 页
              </span>
              <button
                onClick={() => setPage(p => p + 1)}
                disabled={page >= Math.ceil(total / 20)}
                style={styles.pageButton}
              >
                下一页
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
  container: {
    backgroundColor: '#fff',
    borderRadius: '8px',
    width: '90%',
    maxWidth: '1200px',
    height: '90%',
    display: 'flex',
    flexDirection: 'column',
    boxShadow: '0 4px 16px rgba(0, 0, 0, 0.2)',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    gap: '16px',
    padding: '20px 24px',
    borderBottom: '1px solid #ddd',
  },
  title: {
    margin: 0,
    fontSize: '20px',
    fontWeight: 'bold',
    color: '#333',
  },
  searchForm: {
    flex: 1,
    display: 'flex',
    gap: '8px',
  },
  searchInput: {
    flex: 1,
    padding: '8px 12px',
    border: '1px solid #ddd',
    borderRadius: '4px',
    fontSize: '14px',
  },
  searchButton: {
    padding: '8px 16px',
    backgroundColor: '#1976d2',
    color: '#fff',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer',
    fontSize: '14px',
  },
  filterToggle: {
    padding: '8px 16px',
    backgroundColor: '#f0f0f0',
    color: '#666',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer',
    fontSize: '14px',
  },
  closeButton: {
    width: '32px',
    height: '32px',
    border: 'none',
    backgroundColor: 'transparent',
    fontSize: '20px',
    cursor: 'pointer',
    color: '#666',
  },
  filterPanel: {
    padding: '16px 24px',
    backgroundColor: '#f9f9f9',
    borderBottom: '1px solid #ddd',
  },
  filterSection: {
    marginBottom: '12px',
  },
  filterLabel: {
    display: 'block',
    marginBottom: '8px',
    fontSize: '13px',
    fontWeight: '500',
    color: '#555',
  },
  tagFilters: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '8px',
  },
  tagChip: {
    padding: '6px 12px',
    border: 'none',
    borderRadius: '16px',
    fontSize: '12px',
    fontWeight: '500',
    cursor: 'pointer',
    transition: 'all 0.2s',
  },
  rangeInputs: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  },
  rangeInput: {
    width: '100px',
    padding: '6px 8px',
    border: '1px solid #ddd',
    borderRadius: '4px',
    fontSize: '13px',
  },
  loading: {
    flex: 1,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '16px',
    color: '#999',
  },
  empty: {
    flex: 1,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '16px',
    color: '#999',
  },
  grid: {
    flex: 1,
    overflowY: 'auto',
    padding: '24px',
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
    gap: '20px',
    alignContent: 'start',
  },
  card: {
    border: '1px solid #ddd',
    borderRadius: '8px',
    overflow: 'hidden',
    transition: 'box-shadow 0.2s',
    cursor: 'pointer',
  },
  thumbnail: {
    width: '100%',
    height: '180px',
    objectFit: 'cover',
    backgroundColor: '#f5f5f5',
  },
  noThumbnail: {
    width: '100%',
    height: '180px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f5f5f5',
    color: '#999',
    fontSize: '14px',
  },
  cardContent: {
    padding: '16px',
  },
  cardTitle: {
    margin: '0 0 8px 0',
    fontSize: '16px',
    fontWeight: 'bold',
    color: '#333',
  },
  uploader: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    marginBottom: '8px',
  },
  uploaderAvatar: {
    width: '20px',
    height: '20px',
    borderRadius: '50%',
    objectFit: 'cover',
  },
  uploaderName: {
    fontSize: '12px',
    color: '#888',
  },
  description: {
    margin: '0 0 12px 0',
    fontSize: '13px',
    color: '#666',
    lineHeight: '1.5',
    display: '-webkit-box',
    WebkitLineClamp: 2,
    WebkitBoxOrient: 'vertical',
    overflow: 'hidden',
  },
  trackTags: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '6px',
    marginBottom: '12px',
  },
  trackTag: {
    padding: '3px 8px',
    borderRadius: '12px',
    fontSize: '11px',
    fontWeight: '500',
    color: '#fff',
  },
  meta: {
    display: 'flex',
    gap: '16px',
    marginBottom: '12px',
    fontSize: '13px',
    color: '#888',
  },
  cardButtons: {
    display: 'flex',
    gap: '8px',
  },
  cardButton: {
    flex: 1,
    padding: '8px 12px',
    border: 'none',
    borderRadius: '4px',
    fontSize: '14px',
    fontWeight: '500',
    cursor: 'pointer',
  },
  applyButton: {
    backgroundColor: '#1976d2',
    color: '#fff',
  },
  downloadButton: {
    backgroundColor: '#f0f0f0',
    color: '#666',
  },
  pagination: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '16px',
    padding: '16px',
    borderTop: '1px solid #ddd',
  },
  pageButton: {
    padding: '8px 16px',
    border: '1px solid #ddd',
    borderRadius: '4px',
    backgroundColor: '#fff',
    cursor: 'pointer',
    fontSize: '14px',
  },
  pageInfo: {
    fontSize: '14px',
    color: '#666',
  },
}
