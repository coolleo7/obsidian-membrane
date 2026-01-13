import React, { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { EffectComposer, Bloom, Noise, Vignette, ChromaticAberration } from '@react-three/postprocessing'
import { BlendFunction, KernelSize } from 'postprocessing'
import * as THREE from 'three'

export const Effects = () => {
  const noiseRef = useRef<any>(null!)

  useFrame((state) => {
    if (noiseRef.current) {
      // Animate grain for more organic feel
      noiseRef.current.blendMode.opacity = 0.08 + Math.sin(state.clock.elapsedTime * 0.5) * 0.02
    }
  })

  return (
    <EffectComposer>
      {/* Chromatic aberration for analog feel */}
      <ChromaticAberration
        blendFunction={BlendFunction.NORMAL}
        offset={new THREE.Vector2(0.002, 0.002)}
      />

      {/* Selective bloom for Fresnel edge highlights */}
      <Bloom
        intensity={1.2}
        kernelSize={KernelSize.LARGE}
        luminanceThreshold={0.6}
        luminanceSmoothing={0.7}
        blendFunction={BlendFunction.ADD}
        mipmapBlur
      />

      {/* Film grain effect */}
      <Noise
        ref={noiseRef}
        premultiply
        blendFunction={BlendFunction.OVERLAY}
        opacity={0.1}
      />

      {/* Subtle vignette for depth */}
      <Vignette
        offset={0.3}
        darkness={0.6}
        blendFunction={BlendFunction.NORMAL}
      />
    </EffectComposer>
  )
}