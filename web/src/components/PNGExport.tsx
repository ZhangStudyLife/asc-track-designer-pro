import React, { useState } from 'react'
import { TrackProject, Piece } from '../types'

interface PNGExportProps {
  project: TrackProject
  onClose: () => void
}

interface Bounds {
  minX: number
  maxX: number
  minY: number
  maxY: number
}

const CM_TO_PX = 2
const TRACK_WIDTH_CM = 45
const TRACK_WIDTH = TRACK_WIDTH_CM * CM_TO_PX
const HALF_TRACK_WIDTH = TRACK_WIDTH / 2

export function PNGExport({ project, onClose }: PNGExportProps) {
  const [exporting, setExporting] = useState(false)
  const [progress, setProgress] = useState(0)
  const [error, setError] = useState('')

  // 精确计算赛道边界
  const calculateBounds = (pieces: Piece[]): Bounds => {
    if (!pieces || pieces.length === 0) {
      return { minX: 0, maxX: 1000, minY: 0, maxY: 1000 }
    }

    let minX = Infinity, maxX = -Infinity
    let minY = Infinity, maxY = -Infinity
    const margin = 150

    pieces.forEach((piece) => {
      if (piece.type === 'straight') {
        const length = (piece.params.length || 0) * CM_TO_PX
        const angle = (piece.rotation || 0) * Math.PI / 180
        const endX = piece.x + length * Math.cos(angle)
        const endY = piece.y + length * Math.sin(angle)

        minX = Math.min(minX, piece.x - margin, endX - margin)
        maxX = Math.max(maxX, piece.x + margin, endX + margin)
        minY = Math.min(minY, piece.y - margin, endY - margin)
        maxY = Math.max(maxY, piece.y + margin, endY + margin)
      } else if (piece.type === 'curve') {
        const centerRadius = (piece.params.radius || 0) * CM_TO_PX
        const rotation = (piece.rotation || 0) * Math.PI / 180
        const centerX = piece.x - centerRadius * Math.cos(rotation)
        const centerY = piece.y - centerRadius * Math.sin(rotation)
        const outerRadius = centerRadius + HALF_TRACK_WIDTH

        minX = Math.min(minX, centerX - outerRadius - margin)
        maxX = Math.max(maxX, centerX + outerRadius + margin)
        minY = Math.min(minY, centerY - outerRadius - margin)
        maxY = Math.max(maxY, centerY + outerRadius + margin)
      }
    })

    return { minX, maxX, minY, maxY }
  }

  // 生成BOM（长度用米）
  const generateBOM = () => {
    const counts: Record<string, number> = {}
    let totalLengthCm = 0

    project.pieces?.forEach((piece) => {
      let id = ''
      if (piece.type === 'straight') {
        id = `L${piece.params.length || 0}`
        totalLengthCm += piece.params.length || 0
      } else if (piece.type === 'curve') {
        id = `R${piece.params.radius || 0}-${piece.params.angle || 90}`
        const radius = piece.params.radius || 0
        const angle = piece.params.angle || 90
        totalLengthCm += (radius * angle * Math.PI) / 180
      }
      counts[id] = (counts[id] || 0) + 1
    })

    return {
      items: Object.entries(counts).map(([id, count]) => ({ id, count })),
      totalPieces: project.pieces?.length || 0,
      totalLengthM: (totalLengthCm / 100).toFixed(2),  // 转换为米
    }
  }

  // 绘制直道（完全按照Canvas.tsx逻辑）
  const drawStraight = (
    ctx: CanvasRenderingContext2D,
    piece: Piece,
    bounds: Bounds,
    scale: number,
    offsetX: number,
    offsetY: number,
    canvasHeight: number
  ) => {
    const length = (piece.params.length || 0) * CM_TO_PX * scale
    const angle = (piece.rotation || 0) * Math.PI / 180

    // 转换坐标（Y轴翻转）
    const canvasX = (piece.x - bounds.minX) * scale + offsetX
    const canvasY = canvasHeight - ((piece.y - bounds.minY) * scale + offsetY)

    const endX = canvasX + length * Math.cos(angle)
    const endY = canvasY - length * Math.sin(angle)  // Y轴翻转，sin取负

    ctx.save()

    // 绘制灰色边框
    ctx.strokeStyle = '#6B7280'
    ctx.lineWidth = (TRACK_WIDTH + 2) * scale
    ctx.lineCap = 'butt'
    ctx.beginPath()
    ctx.moveTo(canvasX, canvasY)
    ctx.lineTo(endX, endY)
    ctx.stroke()

    // 绘制白色赛道
    ctx.strokeStyle = '#FFFFFF'
    ctx.lineWidth = TRACK_WIDTH * scale
    ctx.beginPath()
    ctx.moveTo(canvasX, canvasY)
    ctx.lineTo(endX, endY)
    ctx.stroke()

    // 绘制标签
    const midX = (canvasX + endX) / 2
    const midY = (canvasY + endY) / 2

    ctx.fillStyle = '#FFB732'
    ctx.font = `bold ${Math.max(16, 20 * scale)}px Arial`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(`L${piece.params.length}`, midX, midY)

    // 绘制连接点 - 起点(绿色)
    ctx.beginPath()
    ctx.arc(canvasX, canvasY, Math.max(6, 8 * scale), 0, 2 * Math.PI)
    ctx.fillStyle = '#10b981'
    ctx.fill()
    ctx.strokeStyle = '#ffffff'
    ctx.lineWidth = Math.max(2, 3 * scale)
    ctx.stroke()

    // 绘制连接点 - 终点(红色)
    ctx.beginPath()
    ctx.arc(endX, endY, Math.max(6, 8 * scale), 0, 2 * Math.PI)
    ctx.fillStyle = '#ef4444'
    ctx.fill()
    ctx.strokeStyle = '#ffffff'
    ctx.lineWidth = Math.max(2, 3 * scale)
    ctx.stroke()

    ctx.restore()
  }

  // 绘制弯道（完全按照Canvas.tsx逻辑）
  const drawCurve = (
    ctx: CanvasRenderingContext2D,
    piece: Piece,
    bounds: Bounds,
    scale: number,
    offsetX: number,
    offsetY: number,
    canvasHeight: number
  ) => {
    const centerRadius = (piece.params.radius || 0) * CM_TO_PX * scale
    const angleSpan = (piece.params.angle || 90) * Math.PI / 180
    const rotation = (piece.rotation || 0) * Math.PI / 180

    const innerRadius = centerRadius - HALF_TRACK_WIDTH * scale
    const outerRadius = centerRadius + HALF_TRACK_WIDTH * scale

    // 转换坐标（Y轴翻转）
    const pieceCanvasX = (piece.x - bounds.minX) * scale + offsetX
    const pieceCanvasY = canvasHeight - ((piece.y - bounds.minY) * scale + offsetY)

    // 计算圆心（注意Y轴翻转时sin取负）
    const centerX = pieceCanvasX - centerRadius * Math.cos(rotation)
    const centerY = pieceCanvasY + centerRadius * Math.sin(rotation)  // Y轴翻转

    // 起点和终点角度（Y轴翻转时角度取负）
    const startAngle = -rotation
    const endAngle = -rotation - angleSpan

    ctx.save()

    // 绘制扇环
    ctx.beginPath()
    ctx.arc(centerX, centerY, outerRadius, startAngle, endAngle, true)
    ctx.arc(centerX, centerY, innerRadius, endAngle, startAngle, false)
    ctx.closePath()

    ctx.fillStyle = '#FFFFFF'
    ctx.fill()

    // 绘制标签
    const labelAngle = -rotation - angleSpan / 2
    const labelRadius = centerRadius + 30 * scale
    const labelX = centerX + labelRadius * Math.cos(labelAngle)
    const labelY = centerY + labelRadius * Math.sin(labelAngle)

    ctx.fillStyle = '#FFB732'
    ctx.font = `bold ${Math.max(14, 18 * scale)}px Arial`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(`R${piece.params.radius}-${piece.params.angle}°`, labelX, labelY)

    // 计算终点位置（在中线上）
    const midEndX = centerX + centerRadius * Math.cos(endAngle)
    const midEndY = centerY + centerRadius * Math.sin(endAngle)

    // 绘制连接点 - 起点(绿色)
    ctx.beginPath()
    ctx.arc(pieceCanvasX, pieceCanvasY, Math.max(6, 8 * scale), 0, 2 * Math.PI)
    ctx.fillStyle = '#10b981'
    ctx.fill()
    ctx.strokeStyle = '#ffffff'
    ctx.lineWidth = Math.max(2, 3 * scale)
    ctx.stroke()

    // 绘制连接点 - 终点(红色)
    ctx.beginPath()
    ctx.arc(midEndX, midEndY, Math.max(6, 8 * scale), 0, 2 * Math.PI)
    ctx.fillStyle = '#ef4444'
    ctx.fill()
    ctx.strokeStyle = '#ffffff'
    ctx.lineWidth = Math.max(2, 3 * scale)
    ctx.stroke()

    ctx.restore()
  }

  // 绘制BOM表格
  const drawBOMTable = (
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    width: number
  ) => {
    const bom = generateBOM()
    const padding = 40
    const rowHeight = 50
    const headerHeight = 60
    const tableHeight = headerHeight + bom.items.length * rowHeight + padding * 3 + 120

    // 背景
    ctx.fillStyle = '#FFFFFF'
    ctx.fillRect(x, y, width, tableHeight)

    // 边框
    ctx.strokeStyle = '#E0E0E0'
    ctx.lineWidth = 3
    ctx.strokeRect(x, y, width, tableHeight)

    // 标题
    ctx.fillStyle = '#1976D2'
    ctx.font = 'bold 36px Arial'
    ctx.textAlign = 'left'
    ctx.textBaseline = 'top'
    ctx.fillText('📊 BOM 物料清单', x + padding, y + padding)

    // 表头
    const tableY = y + padding + 60
    ctx.fillStyle = '#F5F5F5'
    ctx.fillRect(x + padding, tableY, width - padding * 2, headerHeight)

    ctx.fillStyle = '#333'
    ctx.font = 'bold 24px Arial'
    ctx.textBaseline = 'middle'
    ctx.fillText('元件编号', x + padding + 20, tableY + headerHeight / 2)
    ctx.textAlign = 'right'
    ctx.fillText('数量', x + width - padding - 20, tableY + headerHeight / 2)

    // 表格行
    ctx.textAlign = 'left'
    let currentY = tableY + headerHeight
    bom.items.forEach((item, idx) => {
      if (idx % 2 === 0) {
        ctx.fillStyle = '#FAFAFA'
        ctx.fillRect(x + padding, currentY, width - padding * 2, rowHeight)
      }

      ctx.fillStyle = '#555'
      ctx.font = '22px Arial'
      ctx.fillText(item.id, x + padding + 20, currentY + rowHeight / 2)

      ctx.fillStyle = '#1976D2'
      ctx.font = 'bold 24px Arial'
      ctx.textAlign = 'right'
      ctx.fillText(String(item.count), x + width - padding - 20, currentY + rowHeight / 2)
      ctx.textAlign = 'left'

      currentY += rowHeight
    })

    // 分割线
    currentY += 20
    ctx.strokeStyle = '#E0E0E0'
    ctx.lineWidth = 2
    ctx.beginPath()
    ctx.moveTo(x + padding, currentY)
    ctx.lineTo(x + width - padding, currentY)
    ctx.stroke()

    // 总计
    currentY += 40
    ctx.fillStyle = '#333'
    ctx.font = 'bold 26px Arial'
    ctx.fillText(`总元件数: ${bom.totalPieces}`, x + padding + 20, currentY)

    currentY += 45
    ctx.fillText(`总长度: ${bom.totalLengthM} m`, x + padding + 20, currentY)  // 显示米
  }

  // 导出PNG
  const handleExport = async () => {
    setExporting(true)
    setProgress(0)
    setError('')

    try {
      await new Promise(resolve => setTimeout(resolve, 100))

      const pieces = project.pieces || []
      if (pieces.length === 0) {
        throw new Error('赛道为空，无法导出')
      }

      const bounds = calculateBounds(pieces)
      setProgress(10)
      console.log('边界:', bounds)

      // 使用16K分辨率（尽可能高，但受浏览器限制）
      const targetWidth = 15360  // 16K width
      const trackWidth = bounds.maxX - bounds.minX
      const trackHeight = bounds.maxY - bounds.minY
      const bomWidth = 1600  // 增大BOM表宽度以适应16K

      let scale = (targetWidth - bomWidth - 400) / trackWidth
      let canvasWidth = targetWidth
      let canvasHeight = Math.max(trackHeight * scale + 400, 4000)

      // 检查Canvas尺寸限制（浏览器最大32767px）
      const MAX_CANVAS_SIZE = 32000
      if (canvasWidth > MAX_CANVAS_SIZE || canvasHeight > MAX_CANVAS_SIZE) {
        // 自动降低分辨率以适应限制
        const widthRatio = MAX_CANVAS_SIZE / canvasWidth
        const heightRatio = MAX_CANVAS_SIZE / canvasHeight
        const adjustRatio = Math.min(widthRatio, heightRatio, 1)

        canvasWidth = Math.floor(canvasWidth * adjustRatio)
        canvasHeight = Math.floor(canvasHeight * adjustRatio)
        scale = scale * adjustRatio

        console.log(`⚠️ 画布尺寸调整为: ${canvasWidth}x${canvasHeight}px (受浏览器限制)`)
      }

      console.log(`Canvas: ${Math.round(canvasWidth)}x${Math.round(canvasHeight)}px, Scale: ${scale.toFixed(3)}x`)
      setProgress(20)

      // 创建Canvas
      const canvas = document.createElement('canvas')
      canvas.width = canvasWidth
      canvas.height = canvasHeight
      const ctx = canvas.getContext('2d', { alpha: false })

      if (!ctx) {
        throw new Error('无法创建Canvas上下文')
      }

      setProgress(30)

      // 背景
      ctx.fillStyle = '#1E3A8A'
      ctx.fillRect(0, 0, canvasWidth, canvasHeight)
      setProgress(40)

      // 绘制赛道
      const trackOffsetX = 100
      const trackOffsetY = 100

      console.log(`开始绘制 ${pieces.length} 个赛道元件...`)

      pieces.forEach((piece, index) => {
        try {
          if (piece.type === 'straight') {
            drawStraight(ctx, piece, bounds, scale, trackOffsetX, trackOffsetY, canvasHeight)
          } else if (piece.type === 'curve') {
            drawCurve(ctx, piece, bounds, scale, trackOffsetX, trackOffsetY, canvasHeight)
          }

          const pieceProgress = 40 + Math.floor((index / pieces.length) * 40)
          setProgress(pieceProgress)
        } catch (err) {
          console.error(`绘制元件 ${index} 失败:`, err)
        }
      })

      setProgress(80)

      // 绘制BOM表格
      const bomX = canvasWidth - bomWidth - 50
      const bomY = 50
      console.log('绘制BOM表格...')
      drawBOMTable(ctx, bomX, bomY, bomWidth)
      setProgress(90)

      await new Promise(resolve => setTimeout(resolve, 200))

      console.log('开始转换为PNG...')

      // 转换为Blob
      const blob = await new Promise<Blob | null>((resolve) => {
        try {
          canvas.toBlob(
            (blob) => {
              console.log('toBlob完成:', blob ? `${Math.round(blob.size / 1024)}KB` : 'null')
              resolve(blob)
            },
            'image/png',
            1.0
          )
        } catch (err) {
          console.error('toBlob出错:', err)
          resolve(null)
        }
      })

      if (!blob) {
        throw new Error('Canvas转换失败，可能是图片尺寸过大或浏览器内存不足')
      }

      setProgress(95)
      console.log(`PNG生成成功: ${Math.round(blob.size / 1024)}KB`)

      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${project.name || 'track'}_16K.png`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)

      setProgress(100)
      setTimeout(() => {
        onClose()
      }, 500)

    } catch (err) {
      console.error('导出失败:', err)
      const errorMsg = (err as Error).message || '导出失败'
      setError(errorMsg)
      setExporting(false)
      setProgress(0)
      console.error('完整错误信息:', err)
    }
  }

  return (
    <div style={styles.overlay} onClick={!exporting ? onClose : undefined}>
      <div style={styles.dialog} onClick={(e) => e.stopPropagation()}>
        <h2 style={styles.title}>🖼️ 导出高清PNG</h2>

        <div style={styles.info}>
          <div style={styles.infoItem}>
            <span style={styles.infoLabel}>分辨率:</span>
            <span style={styles.infoValue}>16K (15360px)</span>
          </div>
          <div style={styles.infoItem}>
            <span style={styles.infoLabel}>包含:</span>
            <span style={styles.infoValue}>赛道 + BOM表格</span>
          </div>
          <div style={styles.infoItem}>
            <span style={styles.infoLabel}>元件数:</span>
            <span style={styles.infoValue}>{project.pieces?.length || 0}</span>
          </div>
        </div>

        {error && (
          <div style={styles.error}>
            <strong>❌ 错误:</strong> {error}
          </div>
        )}

        {exporting && (
          <div style={styles.progress}>
            <div style={{ ...styles.progressBar, width: `${progress}%` }} />
            <span style={styles.progressText}>{progress}%</span>
          </div>
        )}

        <div style={styles.buttons}>
          <button
            onClick={onClose}
            style={styles.cancelButton}
            disabled={exporting}
          >
            {exporting ? '导出中...' : '取消'}
          </button>
          <button
            onClick={handleExport}
            style={styles.exportButton}
            disabled={exporting || (project.pieces?.length || 0) === 0}
          >
            {exporting ? `导出中 ${progress}%` : '开始导出'}
          </button>
        </div>

        {exporting && (
          <div style={styles.hint}>
            正在生成16K超高清图片，请稍候...
          </div>
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
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 2000,
  },
  dialog: {
    backgroundColor: '#fff',
    borderRadius: '16px',
    padding: '32px',
    width: '90%',
    maxWidth: '500px',
    boxShadow: '0 20px 60px rgba(0, 0, 0, 0.3)',
  },
  title: {
    margin: '0 0 24px 0',
    fontSize: '28px',
    fontWeight: 'bold',
    color: '#1976D2',
    textAlign: 'center',
  },
  info: {
    backgroundColor: '#F5F5F5',
    borderRadius: '12px',
    padding: '20px',
    marginBottom: '24px',
  },
  infoItem: {
    display: 'flex',
    justifyContent: 'space-between',
    marginBottom: '12px',
    fontSize: '16px',
  },
  infoLabel: {
    color: '#666',
    fontWeight: '500',
  },
  infoValue: {
    color: '#333',
    fontWeight: 'bold',
  },
  error: {
    backgroundColor: '#FEE',
    color: '#C33',
    padding: '12px',
    borderRadius: '8px',
    marginBottom: '16px',
    fontSize: '14px',
  },
  progress: {
    position: 'relative',
    height: '40px',
    backgroundColor: '#E0E0E0',
    borderRadius: '20px',
    overflow: 'hidden',
    marginBottom: '24px',
  },
  progressBar: {
    height: '100%',
    backgroundColor: '#4CAF50',
    transition: 'width 0.3s ease',
    borderRadius: '20px',
  },
  progressText: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    transform: 'translate(-50%, -50%)',
    color: '#fff',
    fontWeight: 'bold',
    fontSize: '16px',
    textShadow: '0 1px 2px rgba(0,0,0,0.3)',
  },
  buttons: {
    display: 'flex',
    gap: '16px',
  },
  cancelButton: {
    flex: 1,
    padding: '14px 24px',
    border: '2px solid #E0E0E0',
    borderRadius: '8px',
    backgroundColor: '#fff',
    color: '#666',
    fontSize: '16px',
    fontWeight: '600',
    cursor: 'pointer',
    transition: 'all 0.2s',
  },
  exportButton: {
    flex: 1,
    padding: '14px 24px',
    border: 'none',
    borderRadius: '8px',
    backgroundColor: '#1976D2',
    color: '#fff',
    fontSize: '16px',
    fontWeight: '600',
    cursor: 'pointer',
    transition: 'all 0.2s',
  },
  hint: {
    marginTop: '16px',
    textAlign: 'center',
    color: '#666',
    fontSize: '14px',
    fontStyle: 'italic',
  },
}
