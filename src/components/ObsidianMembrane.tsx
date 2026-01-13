import React, { useRef, useMemo, useEffect } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { createNoise2D } from 'simplex-noise'
import gsap from 'gsap'
import { PulseRefractionMaterial } from './PulseRefractionMaterial'

const MembraneMaterial = ({ mouse, renderTexture, pulseRef }: { mouse: THREE.Vector2, renderTexture: THREE.Texture | null, pulseRef?: React.MutableRefObject<{ pos: THREE.Vector2; time: number; strength: number } | null> }) => {
  // Use custom shader material that distorts text based on noise pulse
  return (
    <PulseRefractionMaterial 
      mouse={mouse}
      texture={renderTexture}
      pulseSpeed={0.025} // SAME as geometry pulse speed
      pulseStrength={0.25} // Stronger distortion for visible effect
      pulseRef={pulseRef}
    />
  )
}

const MembraneGeometry = ({ mouse, renderTexture, draggingRef, dragSpeedRef, pulseRef, clickPulseRef }: { mouse: THREE.Vector2, renderTexture: THREE.Texture, draggingRef: React.MutableRefObject<boolean>, dragSpeedRef: React.MutableRefObject<number>, pulseRef?: React.MutableRefObject<{ pos: THREE.Vector2; time: number; strength: number } | null>, clickPulseRef?: React.MutableRefObject<{ pos: THREE.Vector2; time: number; strength: number } | null> }) => {
  const meshRef = useRef<THREE.Mesh>(null!)
  const geometryRef = useRef<THREE.PlaneGeometry>(null!)
  const noise2D = useMemo(() => createNoise2D(), [])
  const waveOrigins = useRef<Array<{pos: THREE.Vector2, time: number, strength: number}>>([])
  const originalPositionsRef = useRef<Float32Array | null>(null)
  const { viewport } = useThree()
  
  // Store original positions on first frame
  useEffect(() => {
    if (geometryRef.current && !originalPositionsRef.current) {
      const positions = geometryRef.current.attributes.position.array as Float32Array
      originalPositionsRef.current = new Float32Array(positions)
    }
  }, [])

  useFrame((state) => {
    if (meshRef.current && geometryRef.current) {
      const time = state.clock.elapsedTime
      const positions = geometryRef.current.attributes.position.array as Float32Array

      // Add new wave origin when mouse moves while dragging - SMOOTH, continuous waves
      // Waves are only spawned during active pointer drag for click+drag pulse behavior
  // mouse is already in world/mesh coordinates (viewport-space) so use directly
  const mousePos = new THREE.Vector2(mouse.x, mouse.y)
      const lastWave = waveOrigins.current[waveOrigins.current.length - 1]
      if (draggingRef.current) {
        // Spawn waves less frequently but stronger while dragging
        const minDist = 0.35
        if (!lastWave || lastWave.pos.distanceTo(mousePos) > minDist) {
          // Strength scaled by drag speed for more expressive pulses
          const speed = Math.min(dragSpeedRef.current * 2.5, 2.0)
          const strength = 0.6 + speed * 0.9
          waveOrigins.current.push({
            pos: mousePos.clone(),
            time: time,
            strength: strength
          })
          // Also notify material about a pulse centered at this position
          if (pulseRef) {
            pulseRef.current = { pos: mousePos.clone(), time: time, strength: strength }
          }
        }
      }

  // Remove old waves - keep them longer for smooth, slow settling
      // Like ripples slowly fading in thick syrup
      waveOrigins.current = waveOrigins.current.filter(wave => time - wave.time < 8)

      // Ensure we have original positions stored
      if (!originalPositionsRef.current && geometryRef.current) {
        originalPositionsRef.current = new Float32Array(positions)
      }
      
      // Apply vertex displacement - always calculate relative to original position
      for (let i = 0; i < positions.length; i += 3) {
        // Use original positions for calculations to prevent accumulation
        const originalX = originalPositionsRef.current ? originalPositionsRef.current[i] : positions[i]
        const originalY = originalPositionsRef.current ? originalPositionsRef.current[i + 1] : positions[i + 1]
        const x = originalX
        const y = originalY

        let totalDisplacement = 0

        // Calculate SMOOTH displacement from all wave origins - like corn syrup
        // Smooth, continuous waves that propagate outward smoothly
        waveOrigins.current.forEach(wave => {
          const distance = Math.sqrt((x - wave.pos.x) ** 2 + (y - wave.pos.y) ** 2)
          const waveAge = time - wave.time
          const waveRadius = waveAge * 0.5 // MUCH SLOWER propagation - very viscous
          const waveWidth = 3.0 // Wider wave front for smoothness

          // Smooth falloff using smoothstep - creates viscous, continuous waves
          const distFromWaveFront = Math.abs(distance - waveRadius)
          const normalizedDist = Math.min(distFromWaveFront / waveWidth, 1.0)
          
          // Smoothstep for smooth falloff (corn syrup smoothness)
          const smoothFactor = normalizedDist * normalizedDist * (3 - 2 * normalizedDist)
          const waveInfluence = 1.0 - smoothFactor
          
            if (waveInfluence > 0.01) {
              // Smooth wave displacement - use smoother curve
              // Make the wave zero-mean (centered around 0) so repeated pulses don't
              // accumulate a positive offset on the surface. Previously we used
              // `sin * 0.5 + 0.5` which produced only positive displacements.
              const waveStrength = wave.strength * Math.exp(-waveAge * 0.15) // Much slower decay - very viscous
              const wavePhase = (distance - waveRadius) / waveWidth
              // Centered sine wave in [-1,1]
              const smoothWave = Math.sin(wavePhase * Math.PI * 1)
              // Scale down to keep visual amplitude similar to previous implementation
              const waveDisplacement = smoothWave * 0.5 * waveStrength * waveInfluence
              totalDisplacement += waveDisplacement
            }
        })

  // Continuous SMOOTH noise-based PULSE - very slow, organic movement
        // Like slow currents in thick syrup
        const pulseSpeed = 0.015 // EXTREMELY SLOW pulse - very viscous
        const pulseNoise = noise2D(
          x * 0.2 + time * pulseSpeed, // Lower frequency = smoother
          y * 0.2 + time * (pulseSpeed * 1.2)
        ) * 0.15 // Smoother, less aggressive

        // Additional SMOOTH layered noise for organic feel - very slow
        const organicNoise = noise2D(
          x * 0.4 + time * 0.01, // Much slower, lower frequency
          y * 0.4 + time * 0.015
        ) * 0.06 // Gentler

  // Mouse influence with SMOOTH falloff - like dragging finger through corn syrup
  // The displacement should lag behind the mouse position with smooth, viscous response
  const mouseDistance = Math.sqrt((x - mouse.x) ** 2 + (y - mouse.y) ** 2)
  // Scale influence area to viewport size so it feels proportional on any screen
  // Lower value = smaller influence area (currently 0.25 for tighter control)
  const maxDistance = Math.max(viewport.width, viewport.height) * 0.25
        const normalizedDist = Math.min(mouseDistance / maxDistance, 1.0)
        
        // Smoothstep for smooth, continuous falloff (no sharp edges)
        const smoothInfluence = 1.0 - (normalizedDist * normalizedDist * (3 - 2 * normalizedDist))
        
        // Apply smooth damping - displacement builds up very slowly, like very thick syrup
        const viscousDamping = 0.4 + smoothInfluence * 0.3 // Much slower buildup - high viscosity
        const mouseDisplacement = smoothInfluence * 0.01 * viscousDamping // Very subtle displacement

        // Combine all displacements - wave, pulse, organic noise, mouse
        // Additionally apply a short-lived stronger click impact if present
        // For rotated plane (-90° on X): displacement goes in Z (world Y/up direction)
        // Always calculate relative to original Z position (which is 0 for a plane)
        let clickDisplacement = 0
        if (clickPulseRef && clickPulseRef.current) {
          const clickAge = time - clickPulseRef.current.time
          const clickDuration = 0.8 // seconds
          if (clickAge < clickDuration) {
            // Exponential decay so the impact drops off smoothly
            const clickFalloff = Math.exp(-clickAge * 2.5)
            // Scale by smoothInfluence so clicks affect nearby verts more
            clickDisplacement = clickPulseRef.current.strength * clickFalloff * smoothInfluence * 3.0
          } else {
            // Clear after it's finished
            clickPulseRef.current = null
          }
        }

        const originalZ = originalPositionsRef.current ? originalPositionsRef.current[i + 2] : 0
        positions[i + 2] = originalZ + totalDisplacement + pulseNoise + organicNoise + mouseDisplacement + clickDisplacement
      }

      geometryRef.current.attributes.position.needsUpdate = true
      geometryRef.current.computeVertexNormals()
    }
  })

  return (
    <mesh ref={meshRef} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]}>
      {/* Rotate plane to horizontal for pool view, expand beyond viewport */}
      <planeGeometry ref={geometryRef} args={[viewport.width * 1.4, viewport.height * 1.4, 200, 200]} />
      <MembraneMaterial mouse={mouse} renderTexture={renderTexture} />
    </mesh>
  )
}

export const ObsidianMembrane = () => {
  const { viewport, camera } = useThree()
  const pulseRef = useRef<{ pos: THREE.Vector2; time: number; strength: number } | null>(null)
  // clickPulseRef used to create a short, stronger local displacement when user clicks
  const clickPulseRef = useRef<{ pos: THREE.Vector2; time: number; strength: number } | null>(null)
  const mouseRef = useRef(new THREE.Vector2(0, 0))
  const targetMouseRef = useRef(new THREE.Vector2(0, 0))
  const lastMouseRef = useRef(new THREE.Vector2(0, 0))
  const lastTargetRef = useRef(new THREE.Vector2(0, 0))
  const cameraShakeRef = useRef(new THREE.Vector3(0, 10, 6)) // Pool view from high building (~60 degree angle)
  const isDraggingRef = useRef(false)
  const dragSpeedRef = useRef(0)

  // Create HIGH-CONTRAST text texture for refraction - combined text
  const textTexture = useMemo(() => {
    const canvas = document.createElement('canvas')
    canvas.width = 1024
    canvas.height = 1024
  
    const ctx = canvas.getContext('2d')!
    
    // Fully clear canvas (important)
    ctx.clearRect(0, 0, canvas.width, canvas.height)
  
    // Black background
    ctx.fillStyle = '#000000'
    ctx.fillRect(0, 0, canvas.width, canvas.height)
  
    // Draw ONLY the letter B
    ctx.fillStyle = '#ffffff'
    ctx.font = 'bold 50px Arial'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText('OBSIDIAN MEMBRANE', canvas.width / 2 + 225, canvas.height / 2 - 200)
  
    const texture = new THREE.CanvasTexture(canvas)
  
    // 🔴 CRITICAL FIXES (remove ghost characters)
    // texture.wrapS = THREE.ClampToEdgeWrapping
    // texture.wrapT = THREE.ClampToEdgeWrapping
    // texture.minFilter = THREE.LinearFilter
    // texture.magFilter = THREE.LinearFilter
    // texture.generateMipmaps = false
  
    texture.needsUpdate = true
    return texture
  }, [])
  

  useEffect(() => {
    // GSAP-powered EXTREME heavy mouse-trailing inertia with maximum friction
    // The liquid should lag behind significantly - EXTREME drag and resistance
    const handlePointerMove = (event: PointerEvent) => {
      const x = (event.clientX / window.innerWidth) * 2 - 1
      const y = -(event.clientY / window.innerHeight) * 2 + 1

      // Convert to world coordinates
      targetMouseRef.current.set(x * viewport.width / 2, y * viewport.height / 2)

      // Calculate velocity for resistance - fast movements resisted more
      const velocity = targetMouseRef.current.clone().sub(lastTargetRef.current)
      const speed = velocity.length()
      dragSpeedRef.current = speed
      lastTargetRef.current.copy(targetMouseRef.current)
      
      // Dynamic duration based on speed - faster = more resistance
      // This creates the feeling of dragging through thick corn syrup
      const baseDuration = 6.0 // EXTREMELY SLOW - very viscous syrup
      const speedMultiplier = Math.min(1 + speed * 0.4, 1.6) // Smooth resistance curve
      const duration = baseDuration * speedMultiplier

      // Use GSAP with smooth, viscous ease - like corn syrup
      // power3.out creates smooth, heavy deceleration without sharp stops
      gsap.to(mouseRef.current, {
        x: targetMouseRef.current.x,
        y: targetMouseRef.current.y,
        duration: duration, // VERY SLOW - viscous response
        ease: "power3.out", // Smooth, heavy deceleration - like dragging through syrup
        overwrite: true
      })
    }

    const handlePointerDown = (event: PointerEvent) => {
      isDraggingRef.current = true
      // ensure target mouse is updated immediately so geometry spawns a pulse at click point
      const x = (event.clientX / window.innerWidth) * 2 - 1
      const y = -(event.clientY / window.innerHeight) * 2 + 1
      targetMouseRef.current.set(x * viewport.width / 2, y * viewport.height / 2)
      // also update lastTarget so velocity calc won't spike
      lastTargetRef.current.copy(targetMouseRef.current)
      // create an immediate pulse with moderate strength
      const time = performance.now() / 1000
      // Stronger visual pulse for clicks (shader) without affecting drag-spawned waves
      pulseRef.current = { pos: targetMouseRef.current.clone(), time, strength: 1.6 }
  // Also create a short-lived, deeper local displacement on the geometry for click "impact"
  clickPulseRef.current = { pos: targetMouseRef.current.clone(), time, strength: 0.085 }
    }

    const handlePointerUp = () => { isDraggingRef.current = false }

    window.addEventListener('pointermove', handlePointerMove)
    window.addEventListener('pointerdown', handlePointerDown)
    window.addEventListener('pointerup', handlePointerUp)

    return () => {
      window.removeEventListener('pointermove', handlePointerMove)
      window.removeEventListener('pointerdown', handlePointerDown)
      window.removeEventListener('pointerup', handlePointerUp)
    }
  }, [viewport])

  useFrame((state) => {
    const currentMouse = targetMouseRef.current.clone()

    // Store last mouse position for velocity calculation
    lastMouseRef.current.copy(currentMouse)

    // VERY subtle camera movement - heavy objects don't shake much
    const velocity = currentMouse.clone().sub(lastMouseRef.current)
    const shakeAmount = velocity.length() * 0.003 // Reduced - heavy objects resist movement
    // Keep camera stable for pool view - minimal shake
    cameraShakeRef.current.x = Math.sin(state.clock.elapsedTime * 0.3) * shakeAmount * 0.3 // Much less shake
    cameraShakeRef.current.y = 10 + Math.cos(state.clock.elapsedTime * 0.2) * shakeAmount * 0.3 // Maintain high building height
    cameraShakeRef.current.z = 6 // Maintain pool view distance

    // Very slow camera settling - creates weight
    camera.position.lerp(cameraShakeRef.current, 0.1) // Slower lerp = more weight
    // Keep camera looking down at the pool
    camera.lookAt(0, 0, 0)
  })

  // Cleanup texture on unmount
  useEffect(() => {
    return () => {
      textTexture.dispose()
    }
  }, [textTexture])

  return (
    <group>
      {/* HIGH-CONTRAST typography behind membrane - for refraction */}
      {/* <mesh position={[0, 1.2, -1]}>
        <planeGeometry args={[4, 2]} />
        <meshBasicMaterial map={textTexture} transparent />
      </mesh>
      <mesh position={[0, -1.2, -1]}>
        <planeGeometry args={[3.5, 1.5]} />
        <meshBasicMaterial map={textTexture} transparent />
      </mesh> */}

      {/* The obsidian membrane with pulse-based refraction */}
      {/* Text distorts organically as Simplex Noise pulse moves through mesh */}
      <MembraneGeometry 
        mouse={mouseRef.current} 
        renderTexture={textTexture}
        draggingRef={isDraggingRef}
        dragSpeedRef={dragSpeedRef}
        pulseRef={pulseRef}
        clickPulseRef={clickPulseRef}
      />

      {/* Enhanced lighting for pool view - top-down perspective */}
      <ambientLight intensity={0.5} />
      <pointLight position={[0, 8, 0]} intensity={1.5} color="#ffffff" />
      <pointLight position={[5, 6, 5]} intensity={0.8} color="#4a90e2" />
      <pointLight position={[-5, 6, -5]} intensity={0.6} color="#ffffff" />
      <directionalLight position={[0, 10, 0]} intensity={1.0} />
      
      {/* Rim lighting from above for pool surface */}
      <spotLight
        position={[0, 8, 0]}
        angle={Math.PI / 4}
        penumbra={0.6}
        intensity={1.8}
        color="#ffffff"
      />
    </group>
  )
}