import React, { useEffect } from 'react'
import { Canvas } from './components/Canvas'
import { ModernToolbar } from './components/ModernToolbar'
import { useEditorStore } from './store'
import { AuthProvider } from './contexts/AuthContext'

export function App() {
  const loadFromLocalStorage = useEditorStore(state => state.loadFromLocalStorage)

  useEffect(() => {
    loadFromLocalStorage()
  }, [loadFromLocalStorage])

  return (
    <AuthProvider>
      <div style={styles.container}>
        <ModernToolbar />
        <div style={styles.main}>
          <Canvas />
        </div>
      </div>
    </AuthProvider>
  )
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    display: 'flex',
    width: '100%',
    height: '100%',
  },
  main: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
  },
}
