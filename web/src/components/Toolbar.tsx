import React, { useState } from 'react'
import { useEditorStore } from '../store'
import { STRAIGHT_PIECES, CURVE_PIECES, createPieceInstance, TrackPieceDefinition } from '../trackPieces'
import { Piece, Boundary } from '../types'

export function Toolbar() {
  const { project, addPiece, deletePieces, selectedIds, setBoundary, saveToLocalStorage } = useEditorStore()
  const [expandedSection, setExpandedSection] = useState<'straight' | 'curve' | null>('straight')
  const [quickInput, setQuickInput] = useState('')
  const [showBOM, setShowBOM] = useState(false)
  const [showBoundary, setShowBoundary] = useState(false)

  const handleAddPiece = (definition: TrackPieceDefinition) => {
    const piece = createPieceInstance(definition)
    addPiece(piece)
  }

  // 快捷输入处理
  const handleQuickInput = (e: React.FormEvent) => {
    e.preventDefault()
    const input = quickInput.trim().toUpperCase()
    
    // 匹配 L100, L56.5, L67.5 等直道（支持小数）
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

    // 匹配 R50-90, R100.5-45 等弯道（支持小数半径）
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

    alert('格式错误！请输入如 L100（直道）或 R50-90（弯道）')
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

  const toggleSection = (section: 'straight' | 'curve') => {
    setExpandedSection(expandedSection === section ? null : section)
  }

  return (
    <div style={styles.toolbar}>
      <h2 style={styles.title}>🏁 ASC 赛道设计器</h2>

      {/* 快捷输入 */}
      <div style={styles.section}>
        <h3 style={styles.sectionTitle}>快捷输入</h3>
        <form onSubmit={handleQuickInput} style={styles.quickForm}>
          <input
            type="text"
            value={quickInput}
            onChange={(e) => setQuickInput(e.target.value)}
            placeholder="L100 或 R50-90"
            style={styles.quickInput}
          />
          <button type="submit" style={styles.quickButton}>
            ➕ 添加
          </button>
        </form>
        <p style={styles.hint}>
          💡 直道: L100 | 弯道: R50-90
        </p>
      </div>

      {/* 标准元件库 */}
      <div style={styles.section}>
        <h3 style={styles.sectionTitle}>标准元件库</h3>

        {/* 直道系列 */}
        <div style={styles.category}>
          <button
            onClick={() => toggleSection('straight')}
            style={{...styles.categoryButton, ...(expandedSection === 'straight' ? styles.categoryButtonActive : {})}}
          >
            📏 直道系列 ({STRAIGHT_PIECES.length})
          </button>
          {expandedSection === 'straight' && (
            <div style={styles.pieceGrid}>
              {STRAIGHT_PIECES.map((piece) => (
                <button
                  key={piece.id}
                  onClick={() => handleAddPiece(piece)}
                  style={styles.pieceButton}
                  title={`添加 ${piece.name}`}
                >
                  {piece.id}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* 弯道系列 */}
        <div style={styles.category}>
          <button
            onClick={() => toggleSection('curve')}
            style={{...styles.categoryButton, ...(expandedSection === 'curve' ? styles.categoryButtonActive : {})}}
          >
            🔄 弯道系列 ({CURVE_PIECES.length})
          </button>
          {expandedSection === 'curve' && (
            <div style={styles.pieceGrid}>
              {CURVE_PIECES.map((piece) => (
                <button
                  key={piece.id}
                  onClick={() => handleAddPiece(piece)}
                  style={styles.pieceButton}
                  title={`添加 ${piece.name}`}
                >
                  {piece.id}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* 操作 */}
      <div style={styles.section}>
        <h3 style={styles.sectionTitle}>操作</h3>
        <button
          onClick={handleDelete}
          disabled={selectedIds.size === 0}
          style={{ ...styles.button, ...(selectedIds.size === 0 ? styles.buttonDisabled : styles.deleteButton) }}
        >
          🗑️ 删除 ({selectedIds.size})
        </button>
      </div>

      {/* 文件 */}
      <div style={styles.section}>
        <h3 style={styles.sectionTitle}>文件</h3>
        <button onClick={handleImport} style={styles.button}>
          📂 导入 JSON
        </button>
        <button onClick={handleExport} style={styles.button}>
          💾 导出 JSON
        </button>
        <button onClick={() => setShowBOM(true)} style={styles.button}>
          📊 查看 BOM 表
        </button>
        <button onClick={() => setShowBoundary(true)} style={styles.button}>
          🔲 赛道边界
        </button>
      </div>

      {/* 统计信息 */}
      <div style={styles.section}>
        <h3 style={styles.sectionTitle}>统计</h3>
        <div style={styles.statsBox}>
          <p style={styles.statItem}>
            <span style={styles.statLabel}>元件数:</span>
            <span style={styles.statValue}>{project.pieces?.length || 0}</span>
          </p>
          <p style={styles.statItem}>
            <span style={styles.statLabel}>选中:</span>
            <span style={styles.statValue}>{selectedIds.size}</span>
          </p>
        </div>
      </div>

      {/* 快捷键提示 */}
      <div style={styles.section}>
        <h3 style={styles.sectionTitle}>快捷键</h3>
        <div style={styles.shortcutsBox}>
          <p style={styles.shortcutItem}>
            <kbd style={styles.kbd}>Tab</kbd> 旋转 15°
          </p>
          <p style={styles.shortcutItem}>
            <kbd style={styles.kbd}>Delete</kbd> 删除
          </p>
          <p style={styles.shortcutItem}>
            <kbd style={styles.kbd}>Ctrl+Z</kbd> 撤销
          </p>
        </div>
      </div>

      {/* BOM 弹窗 */}
      {showBOM && <BOMModal project={project} onClose={() => setShowBOM(false)} />}

      {/* 边界编辑器 */}
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
    </div>
  )
}

// 边界编辑器弹窗
function BoundaryModal({ boundary, onSave, onClose }: { boundary?: Boundary; onSave: (b: Boundary) => void; onClose: () => void }) {
  const [points, setPoints] = useState(boundary?.points || [])
  const [pointInput, setPointInput] = useState('')
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null)
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null)

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

  const handleDragStart = (e: React.DragEvent, index: number) => {
    setDraggedIndex(index)
    e.dataTransfer.effectAllowed = 'move'
  }

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    setDragOverIndex(index)
  }

  const handleDrop = (e: React.DragEvent, dropIndex: number) => {
    e.preventDefault()
    if (draggedIndex === null) return

    const newPoints = [...points]
    const draggedPoint = newPoints[draggedIndex]
    
    // 移除被拖拽的元素
    newPoints.splice(draggedIndex, 1)
    
    // 在新位置插入
    newPoints.splice(dropIndex, 0, draggedPoint)
    
    setPoints(newPoints)
    setDraggedIndex(null)
    setDragOverIndex(null)
  }

  const handleDragEnd = () => {
    setDraggedIndex(null)
    setDragOverIndex(null)
  }

  const handleSave = () => {
    onSave({
      unit: 'cm',
      points,
      closed: true
    })
  }

  return (
    <div style={styles.modalOverlay} onClick={onClose}>
      <div style={styles.modalContent} onClick={(e) => e.stopPropagation()}>
        <div style={styles.modalHeader}>
          <h2 style={styles.modalTitle}>🔲 赛道边界编辑</h2>
          <button onClick={onClose} style={styles.closeButton}>✕</button>
        </div>
        
        <div style={styles.modalBody}>
          <p style={styles.hint}>
            💡 定义多边形边界点，0为原点，1,2,3...依次连接
          </p>
          
          <div style={styles.quickForm}>
            <input
              type="text"
              value={pointInput}
              onChange={(e) => setPointInput(e.target.value)}
              placeholder="X,Y 如: 0,0"
              style={styles.quickInput}
            />
            <button onClick={handleAddPoint} style={styles.quickButton}>
              ➕ 添加点
            </button>
          </div>

          <div style={{marginTop: '16px'}}>
            <h4>已添加点 ({points.length})</h4>
            <div style={{maxHeight: '200px', overflowY: 'auto', border: '1px solid #E5E7EB', borderRadius: '6px', padding: '8px'}}>
              {points.map((p, idx) => (
                <div
                  key={idx}
                  draggable
                  onDragStart={(e) => handleDragStart(e, idx)}
                  onDragOver={(e) => handleDragOver(e, idx)}
                  onDrop={(e) => handleDrop(e, idx)}
                  onDragEnd={handleDragEnd}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    padding: '8px',
                    borderBottom: '1px solid #F3F4F6',
                    background: draggedIndex === idx ? '#F3F4F6' : dragOverIndex === idx ? '#E0E7FF' : 'white',
                    cursor: 'move',
                    transition: 'background 0.15s'
                  }}
                >
                  {/* 拖拽手柄 */}
                  <div
                    style={{
                      fontSize: '18px',
                      color: '#9CA3AF',
                      cursor: 'grab',
                      userSelect: 'none',
                      lineHeight: '1'
                    }}
                    title="拖动排序"
                  >
                    ⋮⋮
                  </div>
                  
                  {/* 点信息 */}
                  <span style={{flex: 1}}>点 {idx}: ({p.x}, {p.y}) cm</span>
                  
                  {/* 删除按钮 */}
                  <button
                    onClick={() => setPoints(points.filter((_, i) => i !== idx))}
                    style={{
                      padding: '4px 8px',
                      fontSize: '14px',
                      cursor: 'pointer',
                      border: '1px solid #E5E7EB',
                      borderRadius: '4px',
                      background: 'white',
                      color: '#EF4444'
                    }}
                    title="删除"
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>
          </div>

          <div style={{marginTop: '16px', display: 'flex', gap: '8px'}}>
            <button onClick={handleSave} style={{...styles.button, ...styles.quickButton, flex: 1}}>
              💾 保存边界
            </button>
            <button onClick={onClose} style={{...styles.button, flex: 1}}>
              取消
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// BOM 弹窗组件
function BOMModal({ project, onClose }: { project: any, onClose: () => void }) {
  const bom = generateBOM(project)

  return (
    <div style={styles.modalOverlay} onClick={onClose}>
      <div style={styles.modalContent} onClick={(e) => e.stopPropagation()}>
        <div style={styles.modalHeader}>
          <h2 style={styles.modalTitle}>📊 BOM 物料清单</h2>
          <button onClick={onClose} style={styles.closeButton}>✕</button>
        </div>
        
        <div style={styles.modalBody}>
          <table style={styles.bomTable}>
            <thead>
              <tr>
                <th style={styles.th}>元件编号</th>
                <th style={styles.th}>名称</th>
                <th style={styles.th}>规格</th>
                <th style={styles.th}>数量</th>
              </tr>
            </thead>
            <tbody>
              {bom.map((item, idx) => (
                <tr key={idx} style={idx % 2 === 0 ? styles.trEven : styles.trOdd}>
                  <td style={styles.td}>{item.id}</td>
                  <td style={styles.td}>{item.name}</td>
                  <td style={styles.td}>{item.spec}</td>
                  <td style={styles.td}>{item.count}</td>
                </tr>
              ))}
            </tbody>
          </table>
          
          <div style={styles.bomSummary}>
            <p><strong>总元件数:</strong> {project.pieces?.length || 0}</p>
            <p><strong>总长度:</strong> {calculateTotalLength(project)} cm</p>
          </div>
        </div>
      </div>
    </div>
  )
}

// 生成 BOM 表
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

// 计算总长度
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
    width: '300px',
    height: '100%',
    background: '#F9FAFB',
    borderRight: '2px solid #E5E7EB',
    padding: '16px',
    overflowY: 'auto',
    display: 'flex',
    flexDirection: 'column',
    gap: '16px',
  },
  title: {
    fontSize: '22px',
    fontWeight: 'bold',
    marginBottom: '8px',
    color: '#111827',
    borderBottom: '2px solid #3B82F6',
    paddingBottom: '12px',
  },
  section: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
  },
  sectionTitle: {
    fontSize: '14px',
    fontWeight: '600',
    marginBottom: '4px',
    color: '#374151',
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
  },
  category: {
    marginBottom: '8px',
  },
  categoryButton: {
    width: '100%',
    padding: '10px 12px',
    border: '2px solid #D1D5DB',
    borderRadius: '8px',
    background: '#FFFFFF',
    cursor: 'pointer',
    fontSize: '14px',
    fontWeight: '600',
    transition: 'all 0.2s',
    textAlign: 'left',
    color: '#374151',
  },
  categoryButtonActive: {
    background: '#3B82F6',
    borderColor: '#2563EB',
    color: '#FFFFFF',
  },
  pieceGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(2, 1fr)',
    gap: '6px',
    marginTop: '8px',
    padding: '8px',
    background: '#F3F4F6',
    borderRadius: '6px',
  },
  pieceButton: {
    padding: '8px 10px',
    border: '1px solid #D1D5DB',
    borderRadius: '6px',
    background: '#FFFFFF',
    cursor: 'pointer',
    fontSize: '12px',
    fontWeight: '500',
    transition: 'all 0.15s',
    color: '#1F2937',
  },
  button: {
    width: '100%',
    padding: '10px 12px',
    marginBottom: '6px',
    border: '1px solid #D1D5DB',
    borderRadius: '8px',
    background: '#FFFFFF',
    cursor: 'pointer',
    fontSize: '14px',
    fontWeight: '500',
    transition: 'all 0.2s',
    color: '#374151',
  },
  buttonDisabled: {
    opacity: 0.5,
    cursor: 'not-allowed',
  },
  deleteButton: {
    background: '#FEF2F2',
    borderColor: '#FCA5A5',
    color: '#DC2626',
    fontWeight: '600',
  },
  statsBox: {
    background: '#FFFFFF',
    border: '1px solid #E5E7EB',
    borderRadius: '8px',
    padding: '12px',
  },
  statItem: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '8px',
    fontSize: '13px',
  },
  statLabel: {
    color: '#6B7280',
    fontWeight: '500',
  },
  statValue: {
    color: '#111827',
    fontWeight: '700',
    fontSize: '16px',
  },
  shortcutsBox: {
    background: '#FFFFFF',
    border: '1px solid #E5E7EB',
    borderRadius: '8px',
    padding: '12px',
  },
  shortcutItem: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    marginBottom: '6px',
    fontSize: '12px',
    color: '#4B5563',
  },
  kbd: {
    background: '#1F2937',
    color: '#FFFFFF',
    padding: '3px 8px',
    borderRadius: '4px',
    fontSize: '11px',
    fontWeight: '600',
    fontFamily: 'monospace',
    border: '1px solid #374151',
  },
  quickForm: {
    display: 'flex',
    gap: '8px',
  },
  quickInput: {
    flex: 1,
    padding: '10px 12px',
    border: '2px solid #E5E7EB',
    borderRadius: '6px',
    fontSize: '14px',
    fontWeight: '600',
    fontFamily: 'monospace',
    textTransform: 'uppercase',
  },
  quickButton: {
    padding: '10px 16px',
    background: '#10B981',
    color: '#FFFFFF',
    border: 'none',
    borderRadius: '6px',
    fontSize: '14px',
    fontWeight: '600',
    cursor: 'pointer',
  },
  hint: {
    fontSize: '11px',
    color: '#6B7280',
    margin: '4px 0 0 0',
  },
  modalOverlay: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    background: 'rgba(0, 0, 0, 0.5)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000,
  },
  modalContent: {
    background: '#FFFFFF',
    borderRadius: '12px',
    width: '90%',
    maxWidth: '800px',
    maxHeight: '80vh',
    overflow: 'hidden',
    boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)',
  },
  modalHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '20px 24px',
    borderBottom: '2px solid #E5E7EB',
  },
  modalTitle: {
    fontSize: '20px',
    fontWeight: 'bold',
    color: '#111827',
    margin: 0,
  },
  closeButton: {
    background: 'none',
    border: 'none',
    fontSize: '24px',
    cursor: 'pointer',
    color: '#6B7280',
    padding: '0',
    width: '32px',
    height: '32px',
  },
  modalBody: {
    padding: '24px',
    overflowY: 'auto',
    maxHeight: 'calc(80vh - 80px)',
  },
  bomTable: {
    width: '100%',
    borderCollapse: 'collapse',
    marginBottom: '20px',
  },
  th: {
    background: '#F3F4F6',
    padding: '12px',
    textAlign: 'left',
    fontWeight: '600',
    color: '#374151',
    borderBottom: '2px solid #E5E7EB',
  },
  td: {
    padding: '12px',
    borderBottom: '1px solid #E5E7EB',
    color: '#1F2937',
  },
  trEven: {
    background: '#FFFFFF',
  },
  trOdd: {
    background: '#F9FAFB',
  },
  bomSummary: {
    background: '#EFF6FF',
    border: '2px solid #DBEAFE',
    borderRadius: '8px',
    padding: '16px',
    marginTop: '16px',
  },
}
