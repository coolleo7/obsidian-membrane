import { Suspense } from 'react'
import { Canvas } from '@react-three/fiber'
import * as THREE from 'three'
import { ObsidianMembrane } from './components/ObsidianMembrane'
import { Effects } from './components/Effects'

function App() {
  return (
    <div style={{ width: '100vw', height: '100vh', background: '#0B0C0C' }}>
      <Canvas
        camera={{ position: [0, 3, 6], fov: 60 }}
        onCreated={({ gl, camera }) => {
          // set the canvas clear color to a very dark obsidian tone so any bleed looks consistent
          gl.setClearColor(new THREE.Color('#0B0C0C'))
          // Set camera to look down at the liquid surface (pool view)
          camera.lookAt(0, 0, 0)
        }}
        gl={{ 
          antialias: true, 
          alpha: false,
          toneMapping: THREE.ACESFilmicToneMapping,
          toneMappingExposure: 1.5,
          powerPreference: "high-performance"
        }}
        dpr={[1, 2]}
        shadows
      >
        <Suspense fallback={null}>
          <ObsidianMembrane />
          <Effects />
        </Suspense>
      </Canvas>
    </div>
  )
}

export { App }