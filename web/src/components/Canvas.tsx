import React, { useState, useRef, useEffect } from 'react'
import { useEditorStore } from '../store'
import { Piece } from '../types'

// 智能车竞赛赛道设计常量
const DESIGN_BOUNDS = { width: 2340, height: 1654 } // 实际画布大小(px) 对应 1170cm x 827cm
const CM_TO_PX = 2 // 1cm = 2px (缩放比例)
const TRACK_WIDTH_CM = 45 // 赛道宽度(cm) - 智能车竞赛标准
const TRACK_WIDTH = TRACK_WIDTH_CM * CM_TO_PX // 90px
const HALF_TRACK_WIDTH = TRACK_WIDTH / 2 // 22.5cm = 45px
const SNAP_DISTANCE = 30 // 吸附距离 (px)

interface Point {
  x: number
  y: number
}

export function Canvas() {
  const { project, selectedIds, selectPiece, clearSelection, updatePiece, updatePieces, deletePieces, rotatePieces, copySelected, paste, undo, redo } = useEditorStore()
  const svgRef = useRef<SVGSVGElement>(null)
  
  // 视图缩放和平移状态 - 初始视角：左下角是原点，向右是X正轴，向上是Y正轴
  // 为了能看到原点和坐标轴，初始视图从(-100, -DESIGN_BOUNDS.height-100)开始
  const initialViewBox = { 
    x: -100, 
    y: -DESIGN_BOUNDS.height - 100, 
    width: DESIGN_BOUNDS.width + 200, 
    height: DESIGN_BOUNDS.height + 200 
  }
  const [viewBox, setViewBox] = useState(initialViewBox)
  const [zoom, setZoom] = useState(1)
  
  const [draggingPiece, setDraggingPiece] = useState<{ id: string | number, offsetX: number, offsetY: number } | null>(null)
  const [snapTarget, setSnapTarget] = useState<{ x: number; y: number } | null>(null)
  const [mouseDownPos, setMouseDownPos] = useState<{ x: number, y: number } | null>(null)
  const [hasMoved, setHasMoved] = useState(false)
  
  // 视图拖动状态（鼠标中键平移）
  const [isPanning, setIsPanning] = useState(false)
  const [panStartPos, setPanStartPos] = useState<{ x: number, y: number } | null>(null)
  
  // 编辑弹窗状态
  const [editingPiece, setEditingPiece] = useState<Piece | null>(null)
  const [lastClickTime, setLastClickTime] = useState(0)
  const [lastClickId, setLastClickId] = useState<string | number | null>(null)
  
  // 框选状态
  const [isBoxSelecting, setIsBoxSelecting] = useState(false)
  const [boxSelectStart, setBoxSelectStart] = useState<Point | null>(null)
  const [boxSelectEnd, setBoxSelectEnd] = useState<Point | null>(null)

  // 键盘快捷键
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // 避免在输入框中触发快捷键
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return
      }

      // Tab - 旋转 15°
      if (e.key === 'Tab' && selectedIds.size > 0) {
        e.preventDefault()
        rotatePieces(Array.from(selectedIds), 15)
      }

      // Delete - 删除选中元件
      if (e.key === 'Delete' && selectedIds.size > 0) {
        e.preventDefault()
        deletePieces(Array.from(selectedIds))
      }

      // Ctrl+Z - 撤销
      if (e.ctrlKey && e.key === 'z' && !e.shiftKey) {
        e.preventDefault()
        undo()
      }

      // Ctrl+Shift+Z 或 Ctrl+Y - 重做
      if ((e.ctrlKey && e.shiftKey && e.key === 'z') || (e.ctrlKey && e.key === 'y')) {
        e.preventDefault()
        redo()
      }

      // Ctrl+C - 复制
      if (e.ctrlKey && e.key === 'c' && selectedIds.size > 0) {
        e.preventDefault()
        copySelected()
      }

      // Ctrl+V - 粘贴
      if (e.ctrlKey && e.key === 'v') {
        e.preventDefault()
        paste()
      }

      // Escape - 取消选中
      if (e.key === 'Escape') {
        clearSelection()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [selectedIds, rotatePieces, deletePieces, undo, redo, copySelected, paste, clearSelection])

  // 阻止浏览器的 Ctrl+滚轮 缩放（只在画布区域）
  useEffect(() => {
    const preventBrowserZoom = (e: WheelEvent) => {
      if (e.ctrlKey) {
        e.preventDefault()
      }
    }
    
    const svgElement = svgRef.current
    if (svgElement) {
      // 使用 { passive: false } 以便可以调用 preventDefault()
      svgElement.addEventListener('wheel', preventBrowserZoom, { passive: false })
      return () => svgElement.removeEventListener('wheel', preventBrowserZoom)
    }
  }, [])

  // 处理鼠标滚轮缩放
  const handleWheel = (e: React.WheelEvent<SVGSVGElement>) => {
    // 只有按住 Ctrl 时才缩放，否则不处理
    if (!e.ctrlKey) return
    
    // 阻止浏览器默认的缩放行为
    e.preventDefault()
    e.stopPropagation()
    
    // 获取鼠标在SVG坐标系中的位置
    const pt = screenToSVG(e.clientX, e.clientY)
    
    // 计算缩放比例 (向上滚动放大，向下滚动缩小)
    const delta = -e.deltaY
    const scaleChange = delta > 0 ? 0.9 : 1.1 // 每次缩放 10%
    
    // 限制缩放范围 (0.1x ~ 5x)
    const newZoom = Math.max(0.1, Math.min(5, zoom * scaleChange))
    const actualScale = newZoom / zoom
    
    // 计算新的 viewBox，使鼠标位置保持不变
    const newWidth = viewBox.width * actualScale
    const newHeight = viewBox.height * actualScale
    
    // 以鼠标位置为中心进行缩放
    const newX = pt.x - (pt.x - viewBox.x) * actualScale
    const newY = pt.y - (pt.y - viewBox.y) * actualScale
    
    setViewBox({ x: newX, y: newY, width: newWidth, height: newHeight })
    setZoom(newZoom)
  }

  // 处理SVG上的鼠标按下（包括中键平移）
  const handleSvgMouseDown = (e: React.MouseEvent<SVGSVGElement>) => {
    // 鼠标中键 - 开始平移视图
    if (e.button === 1) {
      e.preventDefault()
      setIsPanning(true)
      setPanStartPos({ x: e.clientX, y: e.clientY })
      return
    }
    
    // 左键点击空白处 - 开始框选
    if (e.button === 0) {
      const target = e.target as SVGElement
      
      // 如果点击的不是赛道片段相关的元素，则开始框选
      // 检查是否有 piece-group 类名（赛道片段的容器）
      let element: Element | null = target
      let isPieceElement = false
      while (element && element !== e.currentTarget) {
        if (element.classList && element.classList.contains('piece-group')) {
          isPieceElement = true
          break
        }
        element = element.parentElement
      }
      
      if (!isPieceElement) {
        const pt = screenToSVG(e.clientX, e.clientY)
        setBoxSelectStart(pt)
        setBoxSelectEnd(pt)
        setIsBoxSelecting(true)
        
        // 如果没按Ctrl，清空选中
        if (!e.ctrlKey && !e.metaKey) {
          clearSelection()
        }
      }
    }
  }

  const handlePieceMouseDown = (id: string | number, e: React.MouseEvent) => {
    e.stopPropagation()
    const multi = e.ctrlKey || e.metaKey
    
    // 检测双击
    const currentTime = Date.now()
    const timeDiff = currentTime - lastClickTime
    const isDoubleClick = timeDiff < 200 && lastClickId === id
    
    if (isDoubleClick) {
      // 双击：打开编辑弹窗
      const piece = project.pieces?.find(p => p.id === id)
      if (piece) {
        setEditingPiece(piece)
      }
      setLastClickTime(0)
      setLastClickId(null)
      return
    }
    
    // 记录单击时间和ID
    setLastClickTime(currentTime)
    setLastClickId(id)
    
    // 如果按下 Ctrl，只进行选中/取消选中，不开始拖拽
    if (multi) {
      selectPiece(id, multi)
      return
    }

    // 记录鼠标按下位置，用于判断是否是拖动
    const pt = screenToSVG(e.clientX, e.clientY)
    setMouseDownPos({ x: pt.x, y: pt.y })
    setHasMoved(false)

    // 准备拖拽数据（但还不确定是否真的要拖动）
    const piece = project.pieces?.find(p => p.id === id)
    if (piece && svgRef.current) {
      setDraggingPiece({ id, offsetX: pt.x - piece.x, offsetY: pt.y - piece.y })
    }
  }

  const handleMouseMove = (e: React.MouseEvent<SVGSVGElement>) => {
    // 如果正在框选
    if (isBoxSelecting && boxSelectStart) {
      const pt = screenToSVG(e.clientX, e.clientY)
      setBoxSelectEnd(pt)
      return
    }
    
    // 如果正在平移视图（鼠标中键拖动）
    if (isPanning && panStartPos) {
      const deltaX = e.clientX - panStartPos.x
      const deltaY = e.clientY - panStartPos.y
      
      // 根据当前缩放级别调整平移速度
      const moveScale = viewBox.width / DESIGN_BOUNDS.width
      
      setViewBox({
        ...viewBox,
        x: viewBox.x - deltaX * moveScale,
        y: viewBox.y - deltaY * moveScale
      })
      
      setPanStartPos({ x: e.clientX, y: e.clientY })
      return
    }
    
    // 如果正在拖动赛道片段
    if (!draggingPiece || !mouseDownPos) return

    const pt = screenToSVG(e.clientX, e.clientY)
    
    // 计算鼠标移动距离，判断是否真的在拖动
    const distance = Math.sqrt(
      Math.pow(pt.x - mouseDownPos.x, 2) + Math.pow(pt.y - mouseDownPos.y, 2)
    )
    
    // 如果移动距离小于 5px，认为是点击而不是拖动
    if (distance < 5) return
    
    // 标记已经开始拖动
    if (!hasMoved) {
      setHasMoved(true)
      
      // 第一次移动时，确定选中状态
      if (!selectedIds.has(draggingPiece.id)) {
        // 点击未选中的片段，清空其他选中并选中当前片段
        selectPiece(draggingPiece.id, false)
      }
      // 如果点击的是已选中的片段，保持多选状态
    }

    const newX = pt.x - draggingPiece.offsetX
    const newY = pt.y - draggingPiece.offsetY

    // 获取当前拖动片段的原始位置
    const currentPiece = project.pieces?.find(p => p.id === draggingPiece.id)
    if (!currentPiece) return

    // 吸附到其他赛道片段的连接点
    const snapResult = findSnapPoint(draggingPiece.id, newX, newY)
    setSnapTarget(snapResult.snapped ? snapResult.snapPoint : null)

    // 如果是多选，同步移动所有选中的片段
    if (selectedIds.size > 1) {
      const finalDeltaX = snapResult.x - currentPiece.x
      const finalDeltaY = snapResult.y - currentPiece.y

      // 批量更新所有选中的片段
      const updates = new Map<string | number, Partial<Piece>>()
      selectedIds.forEach(id => {
        const piece = project.pieces?.find(p => p.id === id)
        if (piece) {
          updates.set(id, {
            x: piece.x + finalDeltaX,
            y: piece.y + finalDeltaY
          })
        }
      })
      updatePieces(updates)
    } else {
      // 单选，只移动当前片段
      updatePiece(draggingPiece.id, {
        x: snapResult.x,
        y: snapResult.y
      })
    }
  }

  const handleMouseUp = (e: React.MouseEvent<SVGSVGElement>) => {
    // 如果正在框选
    if (isBoxSelecting && boxSelectStart && boxSelectEnd) {
      // 计算框选范围
      const minX = Math.min(boxSelectStart.x, boxSelectEnd.x)
      const maxX = Math.max(boxSelectStart.x, boxSelectEnd.x)
      const minY = Math.min(boxSelectStart.y, boxSelectEnd.y)
      const maxY = Math.max(boxSelectStart.y, boxSelectEnd.y)
      
      // 找到所有在框选范围内的赛道片段
      const piecesInBox = project.pieces?.filter(piece => {
        return piece.x >= minX && piece.x <= maxX && piece.y >= minY && piece.y <= maxY
      }) || []
      
      // 批量选中框内的片段
      if (piecesInBox.length > 0) {
        const isCtrlPressed = e.ctrlKey || e.metaKey
        if (isCtrlPressed) {
          // Ctrl模式：添加到现有选中
          piecesInBox.forEach(piece => {
            if (!selectedIds.has(piece.id)) {
              selectPiece(piece.id, true)
            }
          })
        } else {
          // 非Ctrl模式：替换选中（先选中第一个清空其他，然后添加剩余的）
          piecesInBox.forEach((piece, index) => {
            selectPiece(piece.id, index > 0) // 第一个用false清空，后续用true累加
          })
        }
      }
      
      // 重置框选状态
      setIsBoxSelecting(false)
      setBoxSelectStart(null)
      setBoxSelectEnd(null)
      return
    }
    
    // 停止平移视图
    if (isPanning) {
      setIsPanning(false)
      setPanStartPos(null)
      return
    }
    
    // 如果鼠标按下后没有移动（或移动很小），说明是单击而不是拖动
    if (draggingPiece && !hasMoved) {
      // 单击行为：选中这个赛道（清空其他选中）
      selectPiece(draggingPiece.id, false)
    }
    
    setDraggingPiece(null)
    setSnapTarget(null)
    setMouseDownPos(null)
    setHasMoved(false)
  }

  // 屏幕坐标转SVG坐标（考虑Y轴翻转）
  const screenToSVG = (clientX: number, clientY: number): Point => {
    if (!svgRef.current) return { x: 0, y: 0 }
    const pt = svgRef.current.createSVGPoint()
    pt.x = clientX
    pt.y = clientY
    const transformed = pt.matrixTransform(svgRef.current.getScreenCTM()?.inverse())
    // 因为我们使用了 scale(1, -1) 翻转Y轴，所以需要反转Y坐标
    return { x: transformed.x, y: -transformed.y }
  }

  // 吸附逻辑：查找附近的连接点（起点和终点都可以吸附）
  const findSnapPoint = (currentId: string | number, x: number, y: number): { x: number; y: number; snapped: boolean; snapPoint: Point | null } => {
    const currentPiece = project.pieces?.find(p => p.id === currentId)
    if (!currentPiece) return { x, y, snapped: false, snapPoint: null }

    // 当前片段的起点和终点（基于新位置）
    const currentStart = { x, y }
    const currentEnd = getEndPoint(currentPiece, x, y)

    // 检查其他片段的连接点
    let bestSnap: Point | null = null
    let minDist = SNAP_DISTANCE
    let snapToStart = true // 标记是起点还是终点吸附

    project.pieces?.forEach(piece => {
      if (piece.id === currentId) return

      const otherStart = { x: piece.x, y: piece.y }
      const otherEnd = getEndPoint(piece, piece.x, piece.y)

      // 检查所有组合：当前起点/终点 吸附到 其他起点/终点
      const candidates: Point[] = [otherStart, otherEnd]

      candidates.forEach((point) => {
        // 检查起点吸附
        const distStart = distance(currentStart, point)
        if (distStart < minDist) {
          minDist = distStart
          bestSnap = point
          snapToStart = true
        }

        // 检查终点吸附（需要调整整体位置）
        const distEnd = distance(currentEnd, point)
        if (distEnd < minDist) {
          minDist = distEnd
          bestSnap = point
          snapToStart = false
        }
      })
    })

    if (bestSnap !== null) {
      const snap = bestSnap as { x: number; y: number }
      if (snapToStart) {
        // 起点吸附：直接移动到目标点
        return { x: snap.x, y: snap.y, snapped: true, snapPoint: snap }
      } else {
        // 终点吸附：计算起点应该在的位置
        const offsetX = currentEnd.x - currentStart.x
        const offsetY = currentEnd.y - currentStart.y
        return { 
          x: snap.x - offsetX, 
          y: snap.y - offsetY, 
          snapped: true, 
          snapPoint: snap 
        }
      }
    }
    return { x, y, snapped: false, snapPoint: null }
  }

  const distance = (p1: Point, p2: Point) => 
    Math.sqrt((p1.x - p2.x) ** 2 + (p1.y - p2.y) ** 2)

  // 获取赛道片段的终点坐标
  const getEndPoint = (piece: Piece, startX: number, startY: number): Point => {
    if (piece.type === 'straight') {
      const length = (piece.params.length || 0) * CM_TO_PX
      const angle = (piece.rotation || 0) * Math.PI / 180
      return {
        x: startX + length * Math.cos(angle),
        y: startY + length * Math.sin(angle)
      }
    } else if (piece.type === 'curve') {
      const radius = (piece.params.radius || 0) * CM_TO_PX
      const angleSpan = piece.params.angle || 90
      const rotation = (piece.rotation || 0) * Math.PI / 180
      const endAngle = rotation + (angleSpan * Math.PI / 180)
      
      return {
        x: startX + radius * Math.cos(endAngle) - radius * Math.cos(rotation),
        y: startY + radius * Math.sin(endAngle) - radius * Math.sin(rotation)
      }
    }
    return { x: startX, y: startY }
  }

  return (
    <div style={{ width: '100%', height: '100%', background: '#1E3A8A', overflow: 'auto' }}>
      <svg
        ref={svgRef}
        width="100%"
        height="100%"
        viewBox={`${viewBox.x} ${viewBox.y} ${viewBox.width} ${viewBox.height}`}
        onMouseDown={handleSvgMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onWheel={handleWheel}
        onContextMenu={(e) => e.preventDefault()}
        style={{ cursor: isPanning ? 'grabbing' : draggingPiece ? 'grabbing' : 'default' }}
      >
        {/* 翻转Y轴，使其向上为正 */}
        <g transform={`scale(1, -1)`}>
          {/* 背景 - 模拟蓝色布料场地（ASC 标准） - 超大尺寸覆盖所有缩放级别 */}
          <rect x={-10000} y={-10000 - DESIGN_BOUNDS.height} width={20000 + DESIGN_BOUNDS.width} height={20000 + DESIGN_BOUNDS.height} fill="#1E3A8A" />

          {/* 坐标轴指示 */}
          <g>
            {/* X轴（红色，向右） */}
            <line x1="0" y1="0" x2="200" y2="0" stroke="#EF4444" strokeWidth="3" />
            <text x="210" y="0" fill="#EF4444" fontSize="24" fontWeight="bold" transform="scale(1, -1)">X</text>
            
            {/* Y轴（绿色，向上） */}
            <line x1="0" y1="0" x2="0" y2="200" stroke="#10B981" strokeWidth="3" />
            <text x="0" y="-210" fill="#10B981" fontSize="24" fontWeight="bold" transform="scale(1, -1)">Y</text>
            
            {/* 原点标记 */}
            <circle cx="0" cy="0" r="8" fill="#FBBF24" stroke="white" strokeWidth="2" />
            <text x="15" y="0" fill="white" fontSize="20" fontWeight="bold" transform="scale(1, -1)">(0,0)</text>
          </g>

        {/* 辅助网格（可选） */}
        <defs>
          <pattern id="grid" width="100" height="100" patternUnits="userSpaceOnUse">
            <path d="M 100 0 L 0 0 0 100" fill="none" stroke="#3B82F6" strokeWidth="0.5" opacity="0.2"/>
          </pattern>
        </defs>
        <rect width={DESIGN_BOUNDS.width} height={DESIGN_BOUNDS.height} fill="url(#grid)" />

        {/* 赛道边界多边形 */}
        {project.boundary && project.boundary.points.length > 0 && (
          <polyline
            points={project.boundary.points.map(p => `${p.x * CM_TO_PX},${p.y * CM_TO_PX}`).join(' ')}
            fill="none"
            stroke="#FCD34D"
            strokeWidth="4"
            strokeDasharray="15,5"
            opacity="0.8"
          />
        )}

        {/* 赛道片段 */}
        {project.pieces?.map((piece) => (
          <PieceShape
            key={piece.id}
            piece={piece}
            selected={selectedIds.has(piece.id)}
            onMouseDown={(e: React.MouseEvent) => handlePieceMouseDown(piece.id, e)}
          />
        ))}

        {/* 吸附目标高亮 */}
        {snapTarget && (
          <g>
            {/* 吸附圆圈动画 */}
            <circle cx={snapTarget.x} cy={snapTarget.y} r={20} fill="none" stroke="#10B981" strokeWidth={3} opacity={0.6}>
              <animate attributeName="r" from="20" to="30" dur="0.8s" repeatCount="indefinite" />
              <animate attributeName="opacity" from="0.6" to="0" dur="0.8s" repeatCount="indefinite" />
            </circle>
            <circle cx={snapTarget.x} cy={snapTarget.y} r={8} fill="#10B981" stroke="#FFFFFF" strokeWidth={2} />
            {/* 吸附十字准星 */}
            <line x1={snapTarget.x - 15} y1={snapTarget.y} x2={snapTarget.x + 15} y2={snapTarget.y} stroke="#10B981" strokeWidth={2} opacity={0.8} />
            <line x1={snapTarget.x} y1={snapTarget.y - 15} x2={snapTarget.x} y2={snapTarget.y + 15} stroke="#10B981" strokeWidth={2} opacity={0.8} />
          </g>
        )}
        </g> {/* 结束 Y轴翻转的 g 标签 */}

        {/* 框选矩形 - 在Y轴翻转之外渲染,使用屏幕坐标 */}
        {isBoxSelecting && boxSelectStart && boxSelectEnd && (
          <rect
            x={Math.min(boxSelectStart.x, boxSelectEnd.x)}
            y={-Math.max(boxSelectStart.y, boxSelectEnd.y)}
            width={Math.abs(boxSelectEnd.x - boxSelectStart.x)}
            height={Math.abs(boxSelectEnd.y - boxSelectStart.y)}
            fill="rgba(59, 130, 246, 0.1)"
            stroke="#3B82F6"
            strokeWidth={2}
            strokeDasharray="5,5"
          />
        )}
      </svg>
      
      {/* 赛道编辑弹窗 */}
      {editingPiece && (
        <PieceEditModal
          piece={editingPiece}
          onClose={() => setEditingPiece(null)}
          onSave={(updates) => {
            updatePiece(editingPiece.id, updates)
            setEditingPiece(null)
          }}
        />
      )}
    </div>
  )
}

interface PieceShapeProps {
  piece: Piece
  selected: boolean
  onMouseDown: (e: React.MouseEvent) => void
}

function PieceShape({ piece, selected, onMouseDown }: PieceShapeProps) {
  
  if (piece.type === 'straight') {
    const length = (piece.params.length || 0) * CM_TO_PX
    const angle = (piece.rotation || 0) * Math.PI / 180
    const endX = piece.x + length * Math.cos(angle)
    const endY = piece.y + length * Math.sin(angle)
    
    // 计算标注位置（中点）
    const midX = (piece.x + endX) / 2
    const midY = (piece.y + endY) / 2
    const labelOffset = 20 // 标注偏移量

    return (
      <g className="piece-group" onMouseDown={onMouseDown} style={{ cursor: 'grab' }}>
        {/* 赛道边框（灰色，便于区分） */}
        <line
          x1={piece.x}
          y1={piece.y}
          x2={endX}
          y2={endY}
          stroke="#6B7280"
          strokeWidth={TRACK_WIDTH + 2}
          strokeLinecap="butt"
        />

        {/* 主赛道 - 纯白色（ASC 标准赛道皮） */}
        <line
          x1={piece.x}
          y1={piece.y}
          x2={endX}
          y2={endY}
          stroke="#FFFFFF"
          strokeWidth={TRACK_WIDTH}
          strokeLinecap="butt"
        />

        {/* 选中高亮 - 左右两侧的黄色边线 */}
        {selected && (
          <>
            {/* 计算垂直于直道方向的偏移 */}
            {(() => {
              const angle = (piece.rotation || 0) * Math.PI / 180
              const perpAngle = angle + Math.PI / 2
              const offset = (TRACK_WIDTH / 2) + 1
              const dx = offset * Math.cos(perpAngle)
              const dy = offset * Math.sin(perpAngle)
              
              return (
                <>
                  {/* 上边线 */}
                  <line
                    x1={piece.x + dx}
                    y1={piece.y + dy}
                    x2={endX + dx}
                    y2={endY + dy}
                    stroke="#FBBF24"
                    strokeWidth="8"
                    strokeLinecap="butt"
                    opacity="0.8"
                  />
                  {/* 下边线 */}
                  <line
                    x1={piece.x - dx}
                    y1={piece.y - dy}
                    x2={endX - dx}
                    y2={endY - dy}
                    stroke="#FBBF24"
                    strokeWidth="8"
                    strokeLinecap="butt"
                    opacity="0.8"
                  />
                </>
              )
            })()}
          </>
        )}

        {/* 赛道尺寸标注 - 橙黄色（ASC 标准标注颜色） */}
        <text
          x={midX}
          y={midY - labelOffset}
          fill="#FFB732"
          fontSize="16"
          fontWeight="bold"
          textAnchor="middle"
          transform={`scale(1, -1) translate(0, ${-2 * (midY - labelOffset)})`}
          style={{ pointerEvents: 'none', userSelect: 'none' }}
        >
          L{piece.params.length || 0}
        </text>

        {/* 连接点 - 起点(绿色) */}
        <circle cx={piece.x} cy={piece.y} r={6} fill="#10b981" stroke="#fff" strokeWidth={2} />
        
        {/* 连接点 - 终点(红色) */}
        <circle cx={endX} cy={endY} r={6} fill="#ef4444" stroke="#fff" strokeWidth={2} />
      </g>
    )
  }

  if (piece.type === 'curve') {
    // R50-90: radius=50cm (中线半径), angle=90° (圆心角)
    const centerRadius = (piece.params.radius || 0) * CM_TO_PX // 中线半径
    const angleSpan = piece.params.angle || 90 // 圆心角(度)
    const rotation = (piece.rotation || 0) * Math.PI / 180
    
    // 扇环的内外半径
    const innerRadius = centerRadius - HALF_TRACK_WIDTH
    const outerRadius = centerRadius + HALF_TRACK_WIDTH
    
    // 计算圆心（假设起点在中线上）
    const centerX = piece.x - centerRadius * Math.cos(rotation)
    const centerY = piece.y - centerRadius * Math.sin(rotation)
    
    // 起点和终点角度
    const startAngle = rotation
    const endAngle = rotation + (angleSpan * Math.PI / 180)
    
    // 内弧起点和终点
    const innerStartX = centerX + innerRadius * Math.cos(startAngle)
    const innerStartY = centerY + innerRadius * Math.sin(startAngle)
    const innerEndX = centerX + innerRadius * Math.cos(endAngle)
    const innerEndY = centerY + innerRadius * Math.sin(endAngle)
    
    // 外弧起点和终点
    const outerStartX = centerX + outerRadius * Math.cos(startAngle)
    const outerStartY = centerY + outerRadius * Math.sin(startAngle)
    const outerEndX = centerX + outerRadius * Math.cos(endAngle)
    const outerEndY = centerY + outerRadius * Math.sin(endAngle)
    
    // 中线终点（用于连接点）
    const midEndX = centerX + centerRadius * Math.cos(endAngle)
    const midEndY = centerY + centerRadius * Math.sin(endAngle)
    
    // SVG路径标志
    const largeArcFlag = Math.abs(angleSpan) > 180 ? 1 : 0
    const sweepFlag = angleSpan > 0 ? 1 : 0
    
    // 绘制扇环：外弧 -> 连接线 -> 内弧(反向) -> 连接线
    const pathData = `
      M ${outerStartX} ${outerStartY}
      A ${outerRadius} ${outerRadius} 0 ${largeArcFlag} ${sweepFlag} ${outerEndX} ${outerEndY}
      L ${innerEndX} ${innerEndY}
      A ${innerRadius} ${innerRadius} 0 ${largeArcFlag} ${sweepFlag ? 0 : 1} ${innerStartX} ${innerStartY}
      Z
    `
    
    // 标注位置（扇环中点）
    const labelAngle = rotation + (angleSpan * Math.PI / 360) // 角度中点
    const labelRadius = centerRadius + 30 // 标注在外侧
    const labelX = centerX + labelRadius * Math.cos(labelAngle)
    const labelY = centerY + labelRadius * Math.sin(labelAngle)

    return (
      <g className="piece-group" onMouseDown={onMouseDown} style={{ cursor: 'grab' }}>
        {/* 主赛道扇环 - 纯白色填充（ASC 标准赛道皮） */}
        <path
          d={pathData}
          fill="#FFFFFF"
          stroke="none"
        />

        {/* 选中高亮 - 黄色外圈 */}
        {selected && (
          <path
            d={pathData}
            fill="none"
            stroke="#FBBF24"
            strokeWidth="10"
            opacity="0.6"
          />
        )}

        {/* 赛道尺寸标注 - 橙黄色（ASC 标准标注颜色） */}
        <text
          x={labelX}
          y={labelY}
          fill="#FFB732"
          fontSize="16"
          fontWeight="bold"
          textAnchor="middle"
          transform={`scale(1, -1) translate(0, ${-2 * labelY})`}
          style={{ pointerEvents: 'none', userSelect: 'none' }}
        >
          R{piece.params.radius || 0}-{angleSpan}°
        </text>

        {/* 连接点 - 起点(绿色) 在中线上 */}
        <circle cx={piece.x} cy={piece.y} r={6} fill="#10b981" stroke="#fff" strokeWidth={2} />

        {/* 连接点 - 终点(红色) 在中线上 */}
        <circle cx={midEndX} cy={midEndY} r={6} fill="#ef4444" stroke="#fff" strokeWidth={2} />
      </g>
    )
  }

  return null
}

// 赛道编辑弹窗组件
function PieceEditModal({ piece, onClose, onSave }: { 
  piece: Piece
  onClose: () => void
  onSave: (updates: Partial<Piece>) => void 
}) {
  const [rotation, setRotation] = useState(piece.rotation.toString())
  const [x, setX] = useState((piece.x / 2).toFixed(1)) // px转cm
  const [y, setY] = useState((piece.y / 2).toFixed(1))
  
  const handleSave = () => {
    const updates: Partial<Piece> = {
      rotation: parseFloat(rotation) % 360,
      x: parseFloat(x) * 2, // cm转px
      y: parseFloat(y) * 2
    }
    onSave(updates)
  }
  
  return (
    <div style={modalStyles.overlay} onClick={onClose}>
      <div style={modalStyles.content} onClick={(e) => e.stopPropagation()}>
        <div style={modalStyles.header}>
          <h3 style={modalStyles.title}>
            {piece.type === 'straight' 
              ? `直道 L${piece.params.length}`
              : `弯道 R${piece.params.radius}-${piece.params.angle}`
            }
          </h3>
          <button onClick={onClose} style={modalStyles.closeButton}>✕</button>
        </div>
        
        <div style={modalStyles.body}>
          <div style={modalStyles.field}>
            <label style={modalStyles.label}>角度 (°)</label>
            <input
              type="number"
              value={rotation}
              onChange={(e) => setRotation(e.target.value)}
              style={modalStyles.input}
              step="1"
              min="0"
              max="360"
            />
          </div>
          
          <div style={modalStyles.field}>
            <label style={modalStyles.label}>X 坐标 (cm)</label>
            <input
              type="number"
              value={x}
              onChange={(e) => setX(e.target.value)}
              style={modalStyles.input}
              step="0.1"
            />
          </div>
          
          <div style={modalStyles.field}>
            <label style={modalStyles.label}>Y 坐标 (cm)</label>
            <input
              type="number"
              value={y}
              onChange={(e) => setY(e.target.value)}
              style={modalStyles.input}
              step="0.1"
            />
          </div>
          
          <div style={modalStyles.actions}>
            <button onClick={handleSave} style={modalStyles.saveButton}>
              保存
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

const modalStyles = {
  overlay: {
    position: 'fixed' as const,
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
  content: {
    backgroundColor: 'white',
    borderRadius: '8px',
    padding: '0',
    minWidth: '320px',
    maxWidth: '90%',
    boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '16px 20px',
    borderBottom: '1px solid #E5E7EB',
  },
  title: {
    margin: 0,
    fontSize: '18px',
    fontWeight: 'bold' as const,
    color: '#1F2937',
  },
  closeButton: {
    background: 'none',
    border: 'none',
    fontSize: '24px',
    cursor: 'pointer',
    color: '#6B7280',
    padding: '0',
    width: '24px',
    height: '24px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  body: {
    padding: '20px',
  },
  field: {
    marginBottom: '16px',
  },
  label: {
    display: 'block',
    marginBottom: '6px',
    fontSize: '14px',
    fontWeight: '500' as const,
    color: '#374151',
  },
  input: {
    width: '100%',
    padding: '8px 12px',
    border: '1px solid #D1D5DB',
    borderRadius: '6px',
    fontSize: '14px',
    boxSizing: 'border-box' as const,
  },
  actions: {
    display: 'flex',
    gap: '8px',
    marginTop: '20px',
  },
  saveButton: {
    flex: 1,
    padding: '10px',
    backgroundColor: '#3B82F6',
    color: 'white',
    border: 'none',
    borderRadius: '6px',
    fontSize: '14px',
    fontWeight: '500' as const,
    cursor: 'pointer',
  },
  cancelButton: {
    flex: 1,
    padding: '10px',
    backgroundColor: '#F3F4F6',
    color: '#374151',
    border: 'none',
    borderRadius: '6px',
    fontSize: '14px',
    fontWeight: '500' as const,
    cursor: 'pointer',
  },
}
