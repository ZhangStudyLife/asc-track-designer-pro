/**
 * 智能车竞赛标准赛道元件库
 * 符合  官方规格标准
 */

export interface TrackPieceDefinition {
  id: string
  name: string
  type: 'straight' | 'curve'
  params: {
    length?: number  // cm (直道)
    radius?: number  // cm (弯道中心线半径)
    angle?: number   // 度 (弯道圆心角)
  }
  category: 'straight' | 'curve'
}

/**
 * 标准直道元件
 * 命名规则：L{长度cm}
 */
export const STRAIGHT_PIECES: TrackPieceDefinition[] = [
  { id: 'L25', name: 'L25 (25cm)', type: 'straight', params: { length: 25 }, category: 'straight' },
  { id: 'L37.5', name: 'L37.5 (37.5cm)', type: 'straight', params: { length: 37.5 }, category: 'straight' },
  { id: 'L50', name: 'L50 (50cm)', type: 'straight', params: { length: 50 }, category: 'straight' },
  { id: 'L75', name: 'L75 (75cm)', type: 'straight', params: { length: 75 }, category: 'straight' },
  { id: 'L100', name: 'L100 (100cm)', type: 'straight', params: { length: 100 }, category: 'straight' },
]

/**
 * 标准弯道元件
 * 命名规则：R{半径cm}-{角度°}
 */
export const CURVE_PIECES: TrackPieceDefinition[] = [
  // R50 系列 (半径 50cm)
  { id: 'R50-30', name: 'R50-30° (半径50cm)', type: 'curve', params: { radius: 50, angle: 30 }, category: 'curve' },
  { id: 'R50-45', name: 'R50-45° (半径50cm)', type: 'curve', params: { radius: 50, angle: 45 }, category: 'curve' },
  { id: 'R50-60', name: 'R50-60° (半径50cm)', type: 'curve', params: { radius: 50, angle: 60 }, category: 'curve' },
  { id: 'R50-90', name: 'R50-90° (半径50cm)', type: 'curve', params: { radius: 50, angle: 90 }, category: 'curve' },

  // R60 系列 (半径 60cm)
  { id: 'R60-30', name: 'R60-30° (半径60cm)', type: 'curve', params: { radius: 60, angle: 30 }, category: 'curve' },
  { id: 'R60-45', name: 'R60-45° (半径60cm)', type: 'curve', params: { radius: 60, angle: 45 }, category: 'curve' },
  { id: 'R60-60', name: 'R60-60° (半径60cm)', type: 'curve', params: { radius: 60, angle: 60 }, category: 'curve' },
  { id: 'R60-90', name: 'R60-90° (半径60cm)', type: 'curve', params: { radius: 60, angle: 90 }, category: 'curve' },


  // R70 系列 (半径 70cm)
  { id: 'R70-45', name: 'R70-45° (半径70cm)', type: 'curve', params: { radius: 70, angle: 45 }, category: 'curve' },
]

/**
 * 所有标准元件
 */
export const ALL_PIECES: TrackPieceDefinition[] = [
  ...STRAIGHT_PIECES,
  ...CURVE_PIECES,
]

/**
 * 根据 ID 获取元件定义
 */
export function getPieceDefinition(id: string): TrackPieceDefinition | undefined {
  return ALL_PIECES.find(p => p.id === id)
}

/**
 * 创建新的赛道元件实例（用于添加到画布）
 */
export function createPieceInstance(definition: TrackPieceDefinition, x: number = 400, y: number = 400) {
  return {
    id: Date.now() + Math.random(), // 唯一ID
    type: definition.type,
    params: { ...definition.params },
    x,
    y,
    rotation: 0,
  }
}
