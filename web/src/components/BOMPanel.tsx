import React, { useMemo } from 'react'
import { useEditorStore } from '../store'

/**
 * BOM (Bill of Materials) 统计面板
 * 显示赛道元件清单和总长度计算
 */
export function BOMPanel() {
  const { project } = useEditorStore()

  // 计算 BOM 统计
  const bomStats = useMemo(() => {
    const pieces = project.pieces || []
    const bomMap = new Map<string, { count: number; lengthCm: number; type: string }>()
    let totalLengthCm = 0

    pieces.forEach((piece) => {
      let key = ''
      let lengthCm = 0

      if (piece.type === 'straight') {
        const length = piece.params.length || 0
        key = `L${length}`
        lengthCm = length
      } else if (piece.type === 'curve') {
        const radius = piece.params.radius || 0
        const angle = piece.params.angle || 0
        key = `R${radius}-${angle}°`
        // 弧长 = 半径 × 角度弧度
        lengthCm = radius * (angle * Math.PI / 180)
      }

      totalLengthCm += lengthCm

      if (bomMap.has(key)) {
        const existing = bomMap.get(key)!
        existing.count++
      } else {
        bomMap.set(key, { count: 1, lengthCm, type: piece.type })
      }
    })

    const bomList = Array.from(bomMap.entries())
      .map(([key, value]) => ({ key, ...value }))
      .sort((a, b) => {
        // 先按类型排序（直道在前），再按长度
        if (a.type !== b.type) return a.type === 'straight' ? -1 : 1
        return a.lengthCm - b.lengthCm
      })

    return {
      totalPieces: pieces.length,
      totalLengthM: (totalLengthCm / 100).toFixed(2),
      totalLengthCm: totalLengthCm.toFixed(2),
      bomList,
    }
  }, [project.pieces])

  return (
    <div style={styles.panel}>
      <div style={styles.header}>
        <h3 style={styles.title}>📊 BOM 统计</h3>
        <span style={styles.subtitle}>元件清单与长度计算</span>
      </div>

      {/* 总计 */}
      <div style={styles.summaryBox}>
        <div style={styles.summaryItem}>
          <span style={styles.summaryLabel}>总元件数</span>
          <span style={styles.summaryValue}>{bomStats.totalPieces}</span>
        </div>
        <div style={styles.summaryItem}>
          <span style={styles.summaryLabel}>总长度</span>
          <span style={styles.summaryValueHighlight}>{bomStats.totalLengthM} m</span>
        </div>
        <div style={styles.summaryItemSmall}>
          <span style={styles.summaryLabelSmall}>({bomStats.totalLengthCm} cm)</span>
        </div>
      </div>

      {/* BOM 清单 */}
      <div style={styles.bomList}>
        <div style={styles.bomHeader}>
          <span style={styles.bomHeaderCell}>型号</span>
          <span style={styles.bomHeaderCell}>数量</span>
          <span style={styles.bomHeaderCell}>单长(cm)</span>
        </div>
        {bomStats.bomList.length === 0 ? (
          <div style={styles.emptyState}>
            暂无元件
            <br />
            <small>点击左侧按钮添加赛道元件</small>
          </div>
        ) : (
          bomStats.bomList.map((item) => (
            <div key={item.key} style={styles.bomRow}>
              <span style={styles.bomCell}>
                <span style={item.type === 'straight' ? styles.badgeStraight : styles.badgeCurve}>
                  {item.key}
                </span>
              </span>
              <span style={styles.bomCell}>{item.count}</span>
              <span style={styles.bomCell}>{item.lengthCm.toFixed(2)}</span>
            </div>
          ))
        )}
      </div>

      {/* 长度计算说明 */}
      <div style={styles.infoBox}>
        <div style={styles.infoTitle}>💡 长度计算公式</div>
        <div style={styles.infoText}>
          <strong>直道:</strong> length (cm)
        </div>
        <div style={styles.infoText}>
          <strong>弯道:</strong> radius × angle × π / 180
        </div>
        <div style={styles.infoExample}>
          例: R50-90° = 50 × 90 × π / 180 ≈ 78.54 cm
        </div>
      </div>
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  panel: {
    width: '320px',
    height: '100%',
    background: '#F9FAFB',
    borderLeft: '2px solid #E5E7EB',
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
  },
  header: {
    padding: '16px',
    background: '#FFFFFF',
    borderBottom: '2px solid #E5E7EB',
  },
  title: {
    fontSize: '18px',
    fontWeight: 'bold',
    color: '#111827',
    margin: 0,
    marginBottom: '4px',
  },
  subtitle: {
    fontSize: '12px',
    color: '#6B7280',
  },
  summaryBox: {
    padding: '16px',
    background: 'linear-gradient(135deg, #3B82F6 0%, #2563EB 100%)',
    color: '#FFFFFF',
  },
  summaryItem: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '8px',
  },
  summaryItemSmall: {
    textAlign: 'center',
    marginTop: '4px',
  },
  summaryLabel: {
    fontSize: '14px',
    opacity: 0.9,
  },
  summaryLabelSmall: {
    fontSize: '11px',
    opacity: 0.7,
  },
  summaryValue: {
    fontSize: '20px',
    fontWeight: 'bold',
  },
  summaryValueHighlight: {
    fontSize: '24px',
    fontWeight: 'bold',
    textShadow: '0 2px 4px rgba(0,0,0,0.2)',
  },
  bomList: {
    flex: 1,
    overflowY: 'auto',
    padding: '12px',
  },
  bomHeader: {
    display: 'grid',
    gridTemplateColumns: '2fr 1fr 1fr',
    gap: '8px',
    padding: '8px 12px',
    background: '#FFFFFF',
    borderRadius: '6px',
    marginBottom: '8px',
    fontWeight: '600',
    fontSize: '12px',
    color: '#374151',
    borderBottom: '2px solid #E5E7EB',
  },
  bomHeaderCell: {
    textAlign: 'left',
  },
  bomRow: {
    display: 'grid',
    gridTemplateColumns: '2fr 1fr 1fr',
    gap: '8px',
    padding: '10px 12px',
    background: '#FFFFFF',
    borderRadius: '6px',
    marginBottom: '6px',
    fontSize: '13px',
    color: '#1F2937',
    border: '1px solid #E5E7EB',
    transition: 'all 0.15s',
  },
  bomCell: {
    display: 'flex',
    alignItems: 'center',
  },
  badgeStraight: {
    background: '#DBEAFE',
    color: '#1E40AF',
    padding: '3px 8px',
    borderRadius: '4px',
    fontSize: '11px',
    fontWeight: '600',
    fontFamily: 'monospace',
  },
  badgeCurve: {
    background: '#FEF3C7',
    color: '#92400E',
    padding: '3px 8px',
    borderRadius: '4px',
    fontSize: '11px',
    fontWeight: '600',
    fontFamily: 'monospace',
  },
  emptyState: {
    textAlign: 'center',
    padding: '40px 20px',
    color: '#9CA3AF',
    fontSize: '14px',
  },
  infoBox: {
    padding: '12px',
    background: '#FFFBEB',
    borderTop: '2px solid #FDE68A',
    fontSize: '12px',
  },
  infoTitle: {
    fontWeight: '600',
    color: '#92400E',
    marginBottom: '8px',
  },
  infoText: {
    color: '#78350F',
    marginBottom: '4px',
  },
  infoExample: {
    color: '#78350F',
    marginTop: '6px',
    fontStyle: 'italic',
    fontSize: '11px',
  },
}
