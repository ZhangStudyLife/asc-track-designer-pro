export interface TrackProject {
  id?: string
  name: string
  version: string
  createdAt?: string
  updatedAt?: string
  boundary?: Boundary
  skin?: TrackSkin
  pieces?: Piece[]
}

export interface Boundary {
  unit: 'cm' | 'px'
  points: Point[]
  closed: boolean
}

export interface Point {
  idx: number
  x: number
  y: number
}

export interface TrackSkin {
  trackWidthCm: number
  color?: string
}

export interface Piece {
  id: string | number
  type: 'straight' | 'curve'
  params: {
    length?: number
    radius?: number
    angle?: number
  }
  x: number
  y: number
  rotation: number
}

export interface BOMSummary {
  totalPieces: number
  totalLength: string
  bom: Record<string, number>
  details?: Piece[]
}

export interface TrackMetadata {
  id: string
  name: string
  uploaderId?: string
  createdAt: string
  totalPieces: number
  totalLength: string
}

export interface APIResponse<T = any> {
  success: boolean
  data?: T
  error?: string
}
