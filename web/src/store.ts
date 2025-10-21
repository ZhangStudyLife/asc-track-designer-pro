import { create } from 'zustand'
import { TrackProject, Piece, Boundary } from './types'

interface EditorState {
  project: TrackProject
  selectedIds: Set<string | number>
  scale: number
  offset: { x: number; y: number }
  clipboard: Piece[]
  history: TrackProject[]
  historyIndex: number

  setProject: (project: TrackProject) => void
  addPiece: (piece: Piece) => void
  updatePiece: (id: string | number, updates: Partial<Piece>) => void
  updatePieces: (updates: Map<string | number, Partial<Piece>>) => void
  deletePieces: (ids: (string | number)[]) => void
  selectPiece: (id: string | number, multi?: boolean) => void
  clearSelection: () => void
  setScale: (scale: number) => void
  setOffset: (offset: { x: number; y: number }) => void
  rotatePieces: (ids: (string | number)[], angle: number) => void
  copySelected: () => void
  paste: () => void
  undo: () => void
  redo: () => void
  setBoundary: (boundary: Boundary) => void
  loadFromLocalStorage: () => void
  saveToLocalStorage: () => void
}

const STORAGE_KEY = 'asc-track-project'

export const useEditorStore = create<EditorState>((set, get) => ({
  project: {
    name: 'New Track',
    version: '1.0',
    pieces: [],
    skin: {
      trackWidthCm: 45,
      color: '#333',
    },
  },
  selectedIds: new Set(),
  scale: 1,
  offset: { x: 0, y: 0 },
  clipboard: [],
  history: [],
  historyIndex: -1,

  setProject: (project) => set({ project, selectedIds: new Set(), history: [project], historyIndex: 0 }),

  addPiece: (piece) => set((state) => {
    const newProject = {
      ...state.project,
      pieces: [...(state.project.pieces || []), piece],
    }
    const newHistory = state.history.slice(0, state.historyIndex + 1)
    newHistory.push(newProject)
    get().saveToLocalStorage()
    return {
      project: newProject,
      history: newHistory.slice(-50),
      historyIndex: Math.min(newHistory.length - 1, 49),
    }
  }),

  updatePiece: (id, updates) => set((state) => {
    const newProject = {
      ...state.project,
      pieces: state.project.pieces?.map((p) =>
        p.id === id ? { ...p, ...updates } : p
      ),
    }
    return { project: newProject }
  }),

  updatePieces: (updates) => set((state) => {
    const newProject = {
      ...state.project,
      pieces: state.project.pieces?.map((p) =>
        updates.has(p.id) ? { ...p, ...updates.get(p.id) } : p
      ),
    }
    return { project: newProject }
  }),

  deletePieces: (ids) => set((state) => {
    const idSet = new Set(ids)
    const newProject = {
      ...state.project,
      pieces: state.project.pieces?.filter((p) => !idSet.has(p.id)),
    }
    const newHistory = state.history.slice(0, state.historyIndex + 1)
    newHistory.push(newProject)
    return {
      project: newProject,
      selectedIds: new Set(),
      history: newHistory.slice(-50),
      historyIndex: Math.min(newHistory.length - 1, 49),
    }
  }),

  selectPiece: (id, multi = false) => set((state) => {
    const newSelected = new Set(multi ? state.selectedIds : [])
    if (newSelected.has(id)) {
      newSelected.delete(id)
    } else {
      newSelected.add(id)
    }
    return { selectedIds: newSelected }
  }),

  clearSelection: () => set({ selectedIds: new Set() }),

  setScale: (scale) => set({ scale: Math.max(0.1, Math.min(3, scale)) }),

  setOffset: (offset) => set({ offset }),

  rotatePieces: (ids, angle) => set((state) => {
    if (ids.length === 0) return state
    
    const selectedPieces = state.project.pieces?.filter((p) => ids.includes(p.id)) || []
    if (selectedPieces.length === 0) return state
    
    // 如果只有一个赛道，直接旋转
    if (selectedPieces.length === 1) {
      const newProject = {
        ...state.project,
        pieces: state.project.pieces?.map((p) =>
          ids.includes(p.id) ? { ...p, rotation: (p.rotation + angle) % 360 } : p
        ),
      }
      return { project: newProject }
    }
    
    // 多选时：计算质心（所有赛道位置的平均值）
    const centerX = selectedPieces.reduce((sum, p) => sum + p.x, 0) / selectedPieces.length
    const centerY = selectedPieces.reduce((sum, p) => sum + p.y, 0) / selectedPieces.length
    
    // 将角度转换为弧度
    const angleRad = (angle * Math.PI) / 180
    const cosAngle = Math.cos(angleRad)
    const sinAngle = Math.sin(angleRad)
    
    // 围绕质心旋转所有选中的赛道
    const updates = new Map<string | number, Partial<Piece>>()
    selectedPieces.forEach((p) => {
      // 相对于质心的位置
      const relX = p.x - centerX
      const relY = p.y - centerY
      
      // 旋转后的位置
      const newRelX = relX * cosAngle - relY * sinAngle
      const newRelY = relX * sinAngle + relY * cosAngle
      
      // 转换回绝对坐标
      const newX = centerX + newRelX
      const newY = centerY + newRelY
      
      // 同时旋转赛道自身的角度
      const newRotation = (p.rotation + angle) % 360
      
      updates.set(p.id, {
        x: newX,
        y: newY,
        rotation: newRotation
      })
    })
    
    // 批量更新
    const newProject = {
      ...state.project,
      pieces: state.project.pieces?.map((p) =>
        updates.has(p.id) ? { ...p, ...updates.get(p.id) } : p
      ),
    }
    return { project: newProject }
  }),

  copySelected: () => set((state) => {
    const selectedPieces = state.project.pieces?.filter((p) => state.selectedIds.has(p.id)) || []
    return { clipboard: selectedPieces }
  }),

  paste: () => set((state) => {
    if (state.clipboard.length === 0) return state
    const newPieces = state.clipboard.map((p) => ({
      ...p,
      id: Date.now() + Math.random(),
      x: p.x + 50, // 偏移一点避免完全重叠
      y: p.y + 50,
    }))
    const newProject = {
      ...state.project,
      pieces: [...(state.project.pieces || []), ...newPieces],
    }
    const newHistory = state.history.slice(0, state.historyIndex + 1)
    newHistory.push(newProject)
    return {
      project: newProject,
      history: newHistory.slice(-50),
      historyIndex: Math.min(newHistory.length - 1, 49),
      selectedIds: new Set(newPieces.map((p) => p.id)),
    }
  }),

  undo: () => set((state) => {
    if (state.historyIndex <= 0) return state
    const newIndex = state.historyIndex - 1
    return {
      historyIndex: newIndex,
      project: state.history[newIndex],
      selectedIds: new Set(),
    }
  }),

  redo: () => set((state) => {
    if (state.historyIndex >= state.history.length - 1) return state
    const newIndex = state.historyIndex + 1
    return {
      historyIndex: newIndex,
      project: state.history[newIndex],
      selectedIds: new Set(),
    }
  }),

  setBoundary: (boundary) => set((state) => {
    const newProject = { ...state.project, boundary }
    get().saveToLocalStorage()
    return { project: newProject }
  }),

  loadFromLocalStorage: () => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY)
      if (saved) {
        const project = JSON.parse(saved)
        set({ project, history: [project], historyIndex: 0 })
      }
    } catch (e) {
      console.error('Failed to load from localStorage:', e)
    }
  },

  saveToLocalStorage: () => {
    try {
      const state = get()
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state.project))
    } catch (e) {
      console.error('Failed to save to localStorage:', e)
    }
  },
}))
