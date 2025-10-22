import React, { useState } from 'react'
import { useEditorStore } from '../store'
import { STRAIGHT_PIECES, CURVE_PIECES, createPieceInstance, TrackPieceDefinition } from '../trackPieces'
import { Piece, Boundary } from '../types'
import { ShareDialog } from './ShareDialog'
import { TrackLibrary } from './TrackLibrary'
import { PNGExport } from './PNGExport'
import { GitHubLogin } from './GitHubLogin'

export function ModernToolbar() {
  const { project, addPiece, deletePieces, selectedIds, setBoundary, saveToLocalStorage } = useEditorStore()
  const [quickInput, setQuickInput] = useState('')
  const [showBOM, setShowBOM] = useState(false)
  const [showBoundary, setShowBoundary] = useState(false)
  const [showShare, setShowShare] = useState(false)
  const [showLibrary, setShowLibrary] = useState(false)
  const [showPNGExport, setShowPNGExport] = useState(false)
  const [expandLibrary, setExpandLibrary] = useState(false)
  const [expandAdvanced, setExpandAdvanced] = useState(false)

  const handleAddPiece = (definition: TrackPieceDefinition) => {
    const piece = createPieceInstance(definition)
    addPiece(piece)
  }

  const handleQuickInput = (e: React.FormEvent) => {
    e.preventDefault()
    const input = quickInput.trim().toUpperCase()

    const straightMatch = input.match(/^L(\d+\.?\d*)$/)
    if (straightMatch) {
      const length = parseFloat(straightMatch[1])
      const piece: Piece = {
        id: Date.now(),
        type: 'straight',
        x: 200,
        y: 200,
        rotation: 0,
        params: { length }
      }
      addPiece(piece)
      setQuickInput('')
      return
    }

    const curveMatch = input.match(/^R(\d+\.?\d*)-(\d+\.?\d*)$/)
    if (curveMatch) {
      const radius = parseFloat(curveMatch[1])
      const angle = parseFloat(curveMatch[2])
      const piece: Piece = {
        id: Date.now(),
        type: 'curve',
        x: 400,
        y: 200,
        rotation: 0,
        params: { radius, angle }
      }
      addPiece(piece)
      setQuickInput('')
      return
    }

    alert('格式: L100 或 R50-90')
  }

  const handleDelete = () => {
    if (selectedIds.size > 0) {
      deletePieces(Array.from(selectedIds))
    }
  }

  const handleExport = async () => {
    const json = JSON.stringify(project, null, 2)
    const blob = new Blob([json], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${project.name || 'track'}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  const handleImport = () => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = '.json'
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0]
      if (!file) return

      const text = await file.text()
      try {
        const data = JSON.parse(text)
        useEditorStore.getState().setProject(data)
      } catch (err) {
        alert('Invalid JSON file')
      }
    }
    input.click()
  }

  return (
    <div style={styles.toolbar}>
      {/* Logo */}
      <div style={styles.logo}>
        <div style={styles.logoIcon}>🏁</div>
        <div style={styles.logoText}>赛道设计器</div>
      </div>

      {/* 登录状态 */}
      <div style={styles.loginSection}>
        <GitHubLogin compact />
      </div>

      {/* 快捷输入 */}
      <div style={styles.section}>
        <form onSubmit={handleQuickInput} style={styles.quickForm}>
          <input
            type="text"
            value={quickInput}
            onChange={(e) => setQuickInput(e.target.value)}
            placeholder="L100 / R50-90"
            style={styles.quickInput}
          />
          <button type="submit" style={styles.addButton}>+</button>
        </form>
      </div>

      {/* 常用操作 */}
      <div style={styles.section}>
        <button
          onClick={handleDelete}
          disabled={selectedIds.size === 0}
          style={{
            ...styles.iconButton,
            ...(selectedIds.size === 0 ? styles.buttonDisabled : styles.deleteButton)
          }}
        >
          <span style={styles.icon}>🗑️</span>
          <span style={styles.label}>删除 ({selectedIds.size})</span>
        </button>

        <button onClick={() => setShowPNGExport(true)} style={{ ...styles.iconButton, ...styles.primaryButton }}>
          <span style={styles.icon}>🖼️</span>
          <span style={styles.label}>导出PNG</span>
        </button>

        <button onClick={() => setShowShare(true)} style={{ ...styles.iconButton, ...styles.shareButton }}>
          <span style={styles.icon}>🌐</span>
          <span style={styles.label}>分享</span>
        </button>

        <button onClick={() => setShowLibrary(true)} style={{ ...styles.iconButton, ...styles.libraryButton }}>
          <span style={styles.icon}>📚</span>
          <span style={styles.label}>地图库</span>
        </button>
      </div>

      {/* 标准元件库（可折叠） */}
      <div style={styles.section}>
        <button
          onClick={() => setExpandLibrary(!expandLibrary)}
          style={styles.expandButton}
        >
          <span>{expandLibrary ? '▼' : '▶'}</span>
          <span>元件库</span>
        </button>

        {expandLibrary && (
          <>
            <div style={styles.subsection}>
              <div style={styles.subsectionTitle}>直道</div>
              <div style={styles.miniGrid}>
                {STRAIGHT_PIECES.slice(0, 6).map((piece) => (
                  <button
                    key={piece.id}
                    onClick={() => handleAddPiece(piece)}
                    style={styles.miniButton}
                  >
                    {piece.id}
                  </button>
                ))}
              </div>
            </div>

            <div style={styles.subsection}>
              <div style={styles.subsectionTitle}>弯道</div>
              <div style={styles.miniGrid}>
                {CURVE_PIECES.slice(0, 6).map((piece) => (
                  <button
                    key={piece.id}
                    onClick={() => handleAddPiece(piece)}
                    style={styles.miniButton}
                  >
                    {piece.id}
                  </button>
                ))}
              </div>
            </div>
          </>
        )}
      </div>

      {/* 高级功能（可折叠） */}
      <div style={styles.section}>
        <button
          onClick={() => setExpandAdvanced(!expandAdvanced)}
          style={styles.expandButton}
        >
          <span>{expandAdvanced ? '▼' : '▶'}</span>
          <span>高级</span>
        </button>

        {expandAdvanced && (
          <div style={styles.subsection}>
            <button onClick={handleImport} style={styles.textButton}>
              📂 导入 JSON
            </button>
            <button onClick={handleExport} style={styles.textButton}>
              💾 导出 JSON
            </button>
            <button onClick={() => setShowBOM(true)} style={styles.textButton}>
              📊 BOM表
            </button>
            <button onClick={() => setShowBoundary(true)} style={styles.textButton}>
              🔲 边界
            </button>
          </div>
        )}
      </div>

      {/* 统计 */}
      <div style={styles.stats}>
        <div style={styles.statRow}>
          <span style={styles.statLabel}>元件</span>
          <span style={styles.statValue}>{project.pieces?.length || 0}</span>
        </div>
        <div style={styles.statRow}>
          <span style={styles.statLabel}>选中</span>
          <span style={styles.statValue}>{selectedIds.size}</span>
        </div>
      </div>

      {/* 快捷键 */}
      <div style={styles.hints}>
        <div style={styles.hint}>
          <kbd style={styles.kbd}>Tab</kbd> 旋转
        </div>
        <div style={styles.hint}>
          <kbd style={styles.kbd}>Del</kbd> 删除
        </div>
        <div style={styles.hint}>
          <kbd style={styles.kbd}>Ctrl+Z</kbd> 撤销
        </div>
      </div>

      {/* 弹窗 */}
      {showBOM && <BOMModal project={project} onClose={() => setShowBOM(false)} />}
      {showBoundary && (
        <BoundaryModal
          boundary={project.boundary}
          onSave={(boundary) => {
            setBoundary(boundary)
            saveToLocalStorage()
            setShowBoundary(false)
          }}
          onClose={() => setShowBoundary(false)}
        />
      )}
      {showShare && <ShareDialog onClose={() => setShowShare(false)} />}
      {showLibrary && <TrackLibrary onClose={() => setShowLibrary(false)} />}
      {showPNGExport && <PNGExport project={project} onClose={() => setShowPNGExport(false)} />}
    </div>
  )
}

// BOM弹窗（保留原有逻辑）
function BOMModal({ project, onClose }: { project: any, onClose: () => void }) {
  const bom = generateBOM(project)

  return (
    <div style={modalStyles.overlay} onClick={onClose}>
      <div style={modalStyles.dialog} onClick={(e) => e.stopPropagation()}>
        <div style={modalStyles.header}>
          <h2 style={modalStyles.title}>📊 BOM 物料清单</h2>
          <button onClick={onClose} style={modalStyles.closeButton}>✕</button>
        </div>

        <div style={modalStyles.body}>
          <table style={modalStyles.table}>
            <thead>
              <tr>
                <th style={modalStyles.th}>元件编号</th>
                <th style={modalStyles.th}>名称</th>
                <th style={modalStyles.th}>规格</th>
                <th style={modalStyles.th}>数量</th>
              </tr>
            </thead>
            <tbody>
              {bom.map((item, idx) => (
                <tr key={idx} style={idx % 2 === 0 ? modalStyles.trEven : modalStyles.trOdd}>
                  <td style={modalStyles.td}>{item.id}</td>
                  <td style={modalStyles.td}>{item.name}</td>
                  <td style={modalStyles.td}>{item.spec}</td>
                  <td style={modalStyles.td}>{item.count}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <div style={modalStyles.summary}>
            <p><strong>总元件数:</strong> {project.pieces?.length || 0}</p>
            <p><strong>总长度:</strong> {calculateTotalLength(project)} cm</p>
          </div>
        </div>
      </div>
    </div>
  )
}

// 边界编辑器（保留原有逻辑）
function BoundaryModal({ boundary, onSave, onClose }: { boundary?: Boundary; onSave: (b: Boundary) => void; onClose: () => void }) {
  const [points, setPoints] = useState(boundary?.points || [])
  const [pointInput, setPointInput] = useState('')

  const handleAddPoint = () => {
    const match = pointInput.match(/^(\d+\.?\d*),\s*(\d+\.?\d*)$/)
    if (!match) {
      alert('格式错误！请输入如 100,200')
      return
    }
    const x = parseFloat(match[1])
    const y = parseFloat(match[2])
    setPoints([...points, { idx: points.length, x, y }])
    setPointInput('')
  }

  const handleSave = () => {
    onSave({
      unit: 'cm',
      points,
      closed: true
    })
  }

  return (
    <div style={modalStyles.overlay} onClick={onClose}>
      <div style={modalStyles.dialog} onClick={(e) => e.stopPropagation()}>
        <div style={modalStyles.header}>
          <h2 style={modalStyles.title}>🔲 赛道边界编辑</h2>
          <button onClick={onClose} style={modalStyles.closeButton}>✕</button>
        </div>

        <div style={modalStyles.body}>
          <p style={modalStyles.hint}>定义多边形边界点（单位：cm）</p>

          <div style={styles.quickForm}>
            <input
              type="text"
              value={pointInput}
              onChange={(e) => setPointInput(e.target.value)}
              placeholder="X,Y 如: 0,0"
              style={styles.quickInput}
            />
            <button onClick={handleAddPoint} style={styles.addButton}>+</button>
          </div>

          <div style={{ marginTop: '16px' }}>
            <h4>已添加点 ({points.length})</h4>
            <div style={{ maxHeight: '200px', overflowY: 'auto' }}>
              {points.map((p, idx) => (
                <div key={idx} style={modalStyles.pointItem}>
                  <span>点 {idx}: ({p.x}, {p.y}) cm</span>
                  <button
                    onClick={() => setPoints(points.filter((_, i) => i !== idx))}
                    style={modalStyles.deleteButton}
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>
          </div>

          <div style={{ marginTop: '16px', display: 'flex', gap: '8px' }}>
            <button onClick={handleSave} style={modalStyles.saveButton}>
              💾 保存
            </button>
            <button onClick={onClose} style={modalStyles.cancelButton}>
              取消
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

function generateBOM(project: any) {
  const counts: Record<string, { name: string; spec: string; count: number }> = {}

  project.pieces?.forEach((piece: Piece) => {
    let id = ''
    let name = ''
    let spec = ''

    if (piece.type === 'straight') {
      id = `L${piece.params.length || 0}`
      name = '直道'
      spec = `${piece.params.length || 0} cm`
    } else if (piece.type === 'curve') {
      id = `R${piece.params.radius || 0}-${piece.params.angle || 90}`
      name = '弯道'
      spec = `R${piece.params.radius || 0}cm, ${piece.params.angle || 90}°`
    }

    if (!counts[id]) {
      counts[id] = { name, spec, count: 0 }
    }
    counts[id].count++
  })

  return Object.entries(counts).map(([id, data]) => ({
    id,
    name: data.name,
    spec: data.spec,
    count: data.count
  }))
}

function calculateTotalLength(project: any): number {
  let total = 0
  project.pieces?.forEach((piece: Piece) => {
    if (piece.type === 'straight') {
      total += piece.params.length || 0
    } else if (piece.type === 'curve') {
      const radius = piece.params.radius || 0
      const angle = piece.params.angle || 90
      total += (radius * angle * Math.PI / 180)
    }
  })
  return Math.round(total * 100) / 100
}

const styles: Record<string, React.CSSProperties> = {
  toolbar: {
    width: '200px',
    height: '100%',
    background: 'linear-gradient(180deg, #FAFBFC 0%, #F5F6F8 100%)',
    borderRight: '1px solid #E1E4E8',
    display: 'flex',
    flexDirection: 'column',
    overflowY: 'auto',
    boxShadow: '2px 0 8px rgba(0,0,0,0.05)',
  },
  logo: {
    padding: '16px',
    borderBottom: '1px solid #E1E4E8',
    textAlign: 'center',
  },
  logoIcon: {
    fontSize: '32px',
    marginBottom: '4px',
  },
  logoText: {
    fontSize: '13px',
    fontWeight: '600',
    color: '#24292E',
  },
  loginSection: {
    padding: '12px',
    borderBottom: '1px solid #E1E4E8',
  },
  section: {
    padding: '12px',
    borderBottom: '1px solid #E1E4E8',
  },
  quickForm: {
    display: 'flex',
    gap: '6px',
  },
  quickInput: {
    flex: 1,
    padding: '8px',
    border: '1px solid #D1D5DB',
    borderRadius: '6px',
    fontSize: '12px',
    fontFamily: 'monospace',
  },
  addButton: {
    width: '36px',
    height: '36px',
    border: 'none',
    borderRadius: '6px',
    background: '#10B981',
    color: '#fff',
    fontSize: '20px',
    cursor: 'pointer',
    fontWeight: 'bold',
  },
  iconButton: {
    width: '100%',
    padding: '10px 12px',
    border: 'none',
    borderRadius: '8px',
    background: '#FFFFFF',
    cursor: 'pointer',
    fontSize: '13px',
    fontWeight: '500',
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    marginBottom: '6px',
    transition: 'all 0.2s',
    boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
  },
  icon: {
    fontSize: '16px',
  },
  label: {
    flex: 1,
    textAlign: 'left',
  },
  buttonDisabled: {
    opacity: 0.4,
    cursor: 'not-allowed',
  },
  deleteButton: {
    background: '#FEE',
    color: '#DC2626',
  },
  primaryButton: {
    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
    color: '#fff',
    fontWeight: '600',
  },
  shareButton: {
    background: 'linear-gradient(135deg, #3B82F6 0%, #1E40AF 100%)',
    color: '#fff',
    fontWeight: '600',
  },
  libraryButton: {
    background: 'linear-gradient(135deg, #10B981 0%, #059669 100%)',
    color: '#fff',
    fontWeight: '600',
  },
  expandButton: {
    width: '100%',
    padding: '8px 12px',
    border: '1px solid #E1E4E8',
    borderRadius: '6px',
    background: '#FFFFFF',
    cursor: 'pointer',
    fontSize: '12px',
    fontWeight: '600',
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    color: '#24292E',
    marginBottom: '8px',
  },
  subsection: {
    marginTop: '8px',
  },
  subsectionTitle: {
    fontSize: '11px',
    fontWeight: '600',
    color: '#6B7280',
    marginBottom: '6px',
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
  },
  miniGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(3, 1fr)',
    gap: '4px',
    marginBottom: '8px',
  },
  miniButton: {
    padding: '6px',
    border: '1px solid #D1D5DB',
    borderRadius: '4px',
    background: '#FFFFFF',
    cursor: 'pointer',
    fontSize: '10px',
    fontWeight: '500',
    transition: 'all 0.15s',
  },
  textButton: {
    width: '100%',
    padding: '8px 12px',
    border: 'none',
    borderRadius: '6px',
    background: '#F9FAFB',
    cursor: 'pointer',
    fontSize: '12px',
    textAlign: 'left',
    marginBottom: '4px',
    transition: 'all 0.15s',
  },
  stats: {
    padding: '12px',
    background: '#FFFFFF',
    margin: '12px',
    borderRadius: '8px',
    boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
  },
  statRow: {
    display: 'flex',
    justifyContent: 'space-between',
    marginBottom: '6px',
    fontSize: '12px',
  },
  statLabel: {
    color: '#6B7280',
  },
  statValue: {
    fontWeight: 'bold',
    color: '#1976D2',
  },
  hints: {
    padding: '12px',
    marginTop: 'auto',
  },
  hint: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    marginBottom: '4px',
    fontSize: '11px',
    color: '#6B7280',
  },
  kbd: {
    background: '#24292E',
    color: '#FFFFFF',
    padding: '2px 6px',
    borderRadius: '3px',
    fontSize: '10px',
    fontWeight: '600',
    fontFamily: 'monospace',
  },
}

const modalStyles: Record<string, React.CSSProperties> = {
  overlay: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    background: 'rgba(0, 0, 0, 0.6)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000,
  },
  dialog: {
    background: '#FFFFFF',
    borderRadius: '16px',
    width: '90%',
    maxWidth: '600px',
    maxHeight: '80vh',
    overflow: 'hidden',
    boxShadow: '0 20px 60px rgba(0, 0, 0, 0.3)',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '20px 24px',
    borderBottom: '1px solid #E1E4E8',
  },
  title: {
    fontSize: '20px',
    fontWeight: 'bold',
    color: '#24292E',
    margin: 0,
  },
  closeButton: {
    background: 'none',
    border: 'none',
    fontSize: '24px',
    cursor: 'pointer',
    color: '#6B7280',
    padding: 0,
    width: '32px',
    height: '32px',
  },
  body: {
    padding: '24px',
    overflowY: 'auto',
    maxHeight: 'calc(80vh - 80px)',
  },
  hint: {
    fontSize: '12px',
    color: '#6B7280',
    marginBottom: '12px',
  },
  table: {
    width: '100%',
    borderCollapse: 'collapse',
    marginBottom: '20px',
  },
  th: {
    background: '#F9FAFB',
    padding: '12px',
    textAlign: 'left',
    fontWeight: '600',
    color: '#374151',
    fontSize: '13px',
    borderBottom: '2px solid #E5E7EB',
  },
  td: {
    padding: '10px 12px',
    borderBottom: '1px solid #E5E7EB',
    color: '#1F2937',
    fontSize: '13px',
  },
  trEven: {
    background: '#FFFFFF',
  },
  trOdd: {
    background: '#F9FAFB',
  },
  summary: {
    background: '#EFF6FF',
    border: '1px solid #DBEAFE',
    borderRadius: '8px',
    padding: '16px',
    fontSize: '14px',
  },
  pointItem: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '8px',
    borderBottom: '1px solid #E5E7EB',
    fontSize: '13px',
  },
  deleteButton: {
    padding: '4px 8px',
    border: '1px solid #FCA5A5',
    borderRadius: '4px',
    background: '#FEE',
    color: '#DC2626',
    cursor: 'pointer',
    fontSize: '12px',
  },
  saveButton: {
    flex: 1,
    padding: '10px',
    border: 'none',
    borderRadius: '8px',
    background: '#10B981',
    color: '#fff',
    fontSize: '14px',
    fontWeight: '600',
    cursor: 'pointer',
  },
  cancelButton: {
    flex: 1,
    padding: '10px',
    border: '1px solid #E1E4E8',
    borderRadius: '8px',
    background: '#fff',
    color: '#6B7280',
    fontSize: '14px',
    fontWeight: '500',
    cursor: 'pointer',
  },
}
