import React from 'react'

// 预定义标签配置
const PREDEFINED_TAGS = [
  { id: '初学者', label: '初学者', color: '#10B981' },
  { id: '中级', label: '中级', color: '#F59E0B' },
  { id: '高级', label: '高级', color: '#EF4444' },
  { id: '圆形', label: '圆形', color: '#3B82F6' },
  { id: '8字形', label: '8字形', color: '#8B5CF6' },
  { id: '直线', label: '直线', color: '#6B7280' },
  { id: '复杂', label: '复杂', color: '#EC4899' },
  { id: '简单', label: '简单', color: '#14B8A6' },
  { id: '推荐', label: '推荐', color: '#F97316' },
]

interface TagSelectorProps {
  selectedTags: string[]
  onChange: (tags: string[]) => void
  maxSelection?: number
}

export function TagSelector({ selectedTags, onChange, maxSelection = 5 }: TagSelectorProps) {
  const toggleTag = (tagId: string) => {
    if (selectedTags.includes(tagId)) {
      // 取消选中
      onChange(selectedTags.filter(t => t !== tagId))
    } else {
      // 选中（检查最大数量）
      if (selectedTags.length < maxSelection) {
        onChange([...selectedTags, tagId])
      }
    }
  }

  return (
    <div style={styles.container}>
      <div style={styles.hint}>
        💡 选择标签 (最多{maxSelection}个) - 已选 {selectedTags.length}/{maxSelection}
      </div>
      <div style={styles.tagGrid}>
        {PREDEFINED_TAGS.map(tag => {
          const isSelected = selectedTags.includes(tag.id)
          return (
            <button
              key={tag.id}
              onClick={() => toggleTag(tag.id)}
              style={{
                ...styles.tag,
                ...(isSelected ? {
                  ...styles.tagSelected,
                  backgroundColor: tag.color,
                  borderColor: tag.color,
                } : {
                  borderColor: tag.color,
                  color: tag.color,
                }),
              }}
              disabled={!isSelected && selectedTags.length >= maxSelection}
            >
              {isSelected && '✓ '}
              {tag.label}
            </button>
          )
        })}
      </div>
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    marginTop: '12px',
  },
  hint: {
    fontSize: '12px',
    color: '#6B7280',
    marginBottom: '8px',
  },
  tagGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(3, 1fr)',
    gap: '8px',
  },
  tag: {
    padding: '8px 12px',
    border: '2px solid',
    borderRadius: '6px',
    background: '#FFFFFF',
    fontSize: '13px',
    fontWeight: '500',
    cursor: 'pointer',
    transition: 'all 0.2s',
  },
  tagSelected: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
}
