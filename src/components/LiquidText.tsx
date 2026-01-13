import { useRef, useMemo, useEffect } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import gsap from 'gsap'

// Shader material for liquid text with blur and displacement
const LiquidTextMaterial = ({ 
  mouse, 
  texture, 
  velocity
}: { 
  mouse: THREE.Vector2
  texture: THREE.Texture
  velocity: THREE.Vector2
}) => {
  const materialRef = useRef<THREE.ShaderMaterial>(null!)

  const vertexShader = `
    attribute vec2 aDisplacement;
    varying vec2 vUv;
    varying vec3 vPosition;
    varying vec3 vNormal;
    varying vec3 vWorldPosition;
    varying vec2 vDisplacement;
    
    void main() {
      vUv = uv;
      vPosition = position;
      vNormal = normalize(normalMatrix * normal);
      vDisplacement = aDisplacement;
      
      vec4 worldPosition = modelMatrix * vec4(position, 1.0);
      vWorldPosition = worldPosition.xyz;
      
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `

  const fragmentShader = `
    uniform sampler2D uTexture;
    uniform vec2 uMouse;
    uniform vec2 uVelocity;
    uniform float uTime;
    
    varying vec2 vUv;
    varying vec3 vPosition;
    varying vec3 vNormal;
    varying vec3 vWorldPosition;
    varying vec2 vDisplacement;
    
    // Simplex noise for organic blur
    vec3 mod289(vec3 x) {
      return x - floor(x * (1.0 / 289.0)) * 289.0;
    }
    
    vec4 mod289(vec4 x) {
      return x - floor(x * (1.0 / 289.0)) * 289.0;
    }
    
    vec4 permute(vec4 x) {
      return mod289(((x*34.0)+1.0)*x);
    }
    
    vec4 taylorInvSqrt(vec4 r) {
      return 1.79284291400159 - 0.85373472095314 * r;
    }
    
    float snoise(vec3 v) {
      const vec2 C = vec2(1.0/6.0, 1.0/3.0);
      const vec4 D = vec4(0.0, 0.5, 1.0, 2.0);
      
      vec3 i = floor(v + dot(v, C.yyy));
      vec3 x0 = v - i + dot(i, C.xxx);
      
      vec3 g = step(x0.yzx, x0.xyz);
      vec3 l = 1.0 - g;
      vec3 i1 = min(g.xyz, l.zxy);
      vec3 i2 = max(g.xyz, l.zxy);
      
      vec3 x1 = x0 - i1 + C.xxx;
      vec3 x2 = x0 - i2 + C.yyy;
      vec3 x3 = x0 - D.yyy;
      
      i = mod289(i);
      vec4 p = permute(permute(permute(
                 i.z + vec4(0.0, i1.z, i2.z, 1.0))
               + i.y + vec4(0.0, i1.y, i2.y, 1.0))
               + i.x + vec4(0.0, i1.x, i2.x, 1.0));
      
      float n_ = 0.142857142857;
      vec3 ns = n_ * D.wyz - D.xzx;
      
      vec4 j = p - 49.0 * floor(p * ns.z * ns.z);
      vec4 x_ = floor(j * ns.z);
      vec4 y_ = floor(j - 7.0 * x_);
      
      vec4 x = x_ * ns.x + ns.yyyy;
      vec4 y = y_ * ns.x + ns.yyyy;
      vec4 h = 1.0 - abs(x) - abs(y);
      
      vec4 b0 = vec4(x.xy, y.xy);
      vec4 b1 = vec4(x.zw, y.zw);
      
      vec4 s0 = floor(b0)*2.0 + 1.0;
      vec4 s1 = floor(b1)*2.0 + 1.0;
      vec4 sh = -step(h, vec4(0.0));
      
      vec4 a0 = b0.xzyw + s0.xzyw*sh.xxyy;
      vec4 a1 = b1.xzyw + s1.xzyw*sh.zzww;
      
      vec3 p0 = vec3(a0.xy, h.x);
      vec3 p1 = vec3(a0.zw, h.y);
      vec3 p2 = vec3(a1.xy, h.z);
      vec3 p3 = vec3(a1.zw, h.w);
      
      vec4 norm = taylorInvSqrt(vec4(dot(p0,p0), dot(p1,p1), dot(p2,p2), dot(p3,p3)));
      p0 *= norm.x;
      p1 *= norm.y;
      p2 *= norm.z;
      p3 *= norm.w;
      
      vec4 m = max(0.6 - vec4(dot(x0,x0), dot(x1,x1), dot(x2,x2), dot(x3,x3)), 0.0);
      m = m * m;
      return 42.0 * dot(m*m, vec4(dot(p0,x0), dot(p1,x1), dot(p2,x2), dot(p3,x3)));
    }
    
    void main() {
      // Get displacement magnitude for blur calculation
      float dispMagnitude = length(vDisplacement);
      
      // Calculate velocity-based blur
      float velocityMagnitude = length(uVelocity);
      float blurAmount = min(velocityMagnitude * 0.4 + dispMagnitude * 0.6, 2.0);
      
      // Add organic noise-based blur for liquid feel
      float noiseBlur = snoise(vec3(vPosition.xy * 0.15, uTime * 0.12)) * 0.15;
      blurAmount += abs(noiseBlur);
      
      // Apply displacement to UV coordinates
      vec2 distortedUv = vUv + vDisplacement * 0.3;
      
      // Multi-sample blur for liquid effect
      vec4 color = vec4(0.0);
      float samples = 12.0;
      float totalWeight = 0.0;
      
      for (float i = 0.0; i < samples; i += 1.0) {
        float angle = (i / samples) * 3.14159 * 2.0;
        float radius = blurAmount * (i / samples) * 0.025;
        vec2 offset = vec2(cos(angle), sin(angle)) * radius;
        vec2 sampleUv = distortedUv + offset;
        
        // Clamp to valid UV range
        sampleUv = clamp(sampleUv, vec2(0.0), vec2(1.0));
        
        vec4 sampleColor = texture2D(uTexture, sampleUv);
        float weight = 1.0 / (1.0 + i * 0.4);
        color += sampleColor * weight;
        totalWeight += weight;
      }
      
      color /= totalWeight;
      
      // Add fresnel effect for liquid edge glow
      vec3 viewDirection = normalize(cameraPosition - vWorldPosition);
      float fresnel = pow(1.0 - dot(viewDirection, vNormal), 2.0);
      
      // Liquid color tint with more visibility
      vec3 liquidColor = mix(
        color.rgb,
        vec3(0.8, 0.9, 1.0), // Slight blue tint
        fresnel * 0.4
      );
      
      // Make text more visible
      float alpha = min(color.a * 1.2, 1.0);
      
      gl_FragColor = vec4(liquidColor, alpha);
    }
  `

  const uniforms = useMemo(() => ({
    uTexture: { value: texture },
    uMouse: { value: new THREE.Vector2() },
    uVelocity: { value: new THREE.Vector2() },
    uTime: { value: 0 }
  }), [texture])

  useFrame((state) => {
    if (materialRef.current) {
      materialRef.current.uniforms.uTime.value = state.clock.elapsedTime
      materialRef.current.uniforms.uMouse.value.copy(mouse)
      materialRef.current.uniforms.uVelocity.value.copy(velocity)
    }
  })

  // Displacement attribute is set on geometry, no need to access here

  return (
    <shaderMaterial
      ref={materialRef}
      vertexShader={vertexShader}
      fragmentShader={fragmentShader}
      uniforms={uniforms}
      transparent
      side={THREE.DoubleSide}
    />
  )
}

export const LiquidText = () => {
  const { viewport } = useThree()
  const meshRef = useRef<THREE.Mesh>(null!)
  const geometryRef = useRef<THREE.PlaneGeometry>(null!)
  
  // Mouse tracking
  const mouseRef = useRef(new THREE.Vector2(0, 0))
  const targetMouseRef = useRef(new THREE.Vector2(0, 0))
  const lastMouseRef = useRef(new THREE.Vector2(0, 0))
  const velocityRef = useRef(new THREE.Vector2(0, 0))
  const isDraggingRef = useRef(false)
  
  // Displacement data for each vertex
  const displacementDataRef = useRef<Float32Array | null>(null)
  const displacementAttributeRef = useRef<THREE.BufferAttribute | null>(null)
  const vertexVelocitiesRef = useRef<Float32Array | null>(null)
  
  // Original positions
  const originalPositionsRef = useRef<Float32Array | null>(null)
  
  // Create text texture
  const textTexture = useMemo(() => {
    const canvas = document.createElement('canvas')
    canvas.width = 2048
    canvas.height = 1024
    const ctx = canvas.getContext('2d')!
    
    // Transparent background
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    
    // White text with better visibility
    ctx.fillStyle = '#ffffff'
    ctx.font = 'bold 200px Arial'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText('LIQUID', canvas.width / 2, canvas.height / 2 - 150)
    
    ctx.font = 'bold 120px Arial'
    ctx.fillText('TEXT', canvas.width / 2, canvas.height / 2 + 150)
    
    const texture = new THREE.CanvasTexture(canvas)
    texture.needsUpdate = true
    return texture
  }, [])
  
  // Initialize geometry and attributes
  useEffect(() => {
    if (geometryRef.current) {
      const positions = geometryRef.current.attributes.position.array as Float32Array
      originalPositionsRef.current = new Float32Array(positions)
      
      // Create displacement attribute
      const vertexCount = positions.length / 3
      const displacementData = new Float32Array(vertexCount * 2) // x, y displacement per vertex
      displacementDataRef.current = displacementData
      
      const displacementAttribute = new THREE.BufferAttribute(displacementData, 2)
      geometryRef.current.setAttribute('aDisplacement', displacementAttribute)
      displacementAttributeRef.current = displacementAttribute
      
      // Initialize velocities
      vertexVelocitiesRef.current = new Float32Array(vertexCount * 2)
    }
  }, [])
  
  // Mouse event handlers
  useEffect(() => {
    const handlePointerMove = (event: PointerEvent) => {
      const x = (event.clientX / window.innerWidth) * 2 - 1
      const y = -(event.clientY / window.innerHeight) * 2 + 1
      
      targetMouseRef.current.set(x * viewport.width / 2, y * viewport.height / 2)
      
      // Calculate velocity
      const delta = targetMouseRef.current.clone().sub(lastMouseRef.current)
      velocityRef.current.copy(delta)
      lastMouseRef.current.copy(targetMouseRef.current)
      
      // Smooth mouse following with drag speed
      const speed = delta.length()
      const duration = Math.max(0.05, 0.3 - speed * 0.05) // Faster drag = faster response
      
      gsap.to(mouseRef.current, {
        x: targetMouseRef.current.x,
        y: targetMouseRef.current.y,
        duration: duration,
        ease: "power2.out",
        overwrite: true
      })
    }
    
    const handlePointerDown = (event: PointerEvent) => {
      isDraggingRef.current = true
      const x = (event.clientX / window.innerWidth) * 2 - 1
      const y = -(event.clientY / window.innerHeight) * 2 + 1
      targetMouseRef.current.set(x * viewport.width / 2, y * viewport.height / 2)
      lastMouseRef.current.copy(targetMouseRef.current)
    }
    
    const handlePointerUp = () => {
      isDraggingRef.current = false
    }
    
    window.addEventListener('pointermove', handlePointerMove)
    window.addEventListener('pointerdown', handlePointerDown)
    window.addEventListener('pointerup', handlePointerUp)
    
    return () => {
      window.removeEventListener('pointermove', handlePointerMove)
      window.removeEventListener('pointerdown', handlePointerDown)
      window.removeEventListener('pointerup', handlePointerUp)
    }
  }, [viewport])
  
  useFrame((_state, delta) => {
    if (!geometryRef.current || !displacementDataRef.current || !originalPositionsRef.current || !vertexVelocitiesRef.current || !displacementAttributeRef.current) return
    
    const positions = geometryRef.current.attributes.position.array as Float32Array
    const displacementData = displacementDataRef.current
    const vertexVelocities = vertexVelocitiesRef.current
    
    const mousePos = mouseRef.current
    const velocity = velocityRef.current
    const isDragging = isDraggingRef.current
    
    // Get geometry dimensions
    const width = viewport.width * 1.4
    const height = viewport.height * 1.4
    
    // Update displacement for each vertex
    for (let i = 0; i < positions.length; i += 3) {
      const vertexIndex = i / 3
      const dispIndex = vertexIndex * 2
      const velIndex = vertexIndex * 2
      
      const x = positions[i]
      const y = positions[i + 1]
      
      // Get current displacement
      let dispX = displacementData[dispIndex] || 0
      let dispY = displacementData[dispIndex + 1] || 0
      
      // Get vertex velocity
      let velX = vertexVelocities[velIndex] || 0
      let velY = vertexVelocities[velIndex + 1] || 0
      
      // Calculate distance to mouse
      const distToMouse = Math.sqrt((x - mousePos.x) ** 2 + (y - mousePos.y) ** 2)
      const maxInfluence = Math.max(viewport.width, viewport.height) * 0.45
      const influence = Math.max(0, 1 - distToMouse / maxInfluence)
      
      if (isDragging && influence > 0.01 && velocity.length() > 0.01) {
        // Apply drag force in direction of velocity (proportional to drag speed)
        const dragStrength = Math.min(velocity.length() * 1.2, 4.0)
        const dragDir = velocity.clone().normalize()
        
        // Add velocity in drag direction
        velX += dragDir.x * influence * dragStrength * delta * 20
        velY += dragDir.y * influence * dragStrength * delta * 20
      }
      
      // Apply velocity to displacement
      dispX += velX * delta
      dispY += velY * delta
      
      // Spring physics: return to original position
      const springStrength = 4.0
      const damping = 0.88
      
      // Spring force pulls back to zero
      velX -= dispX * springStrength * delta
      velY -= dispY * springStrength * delta
      
      // Apply damping
      velX *= damping
      velY *= damping
      
      // Boundary constraints: push back from edges
      const edgeDist = 0.2
      const edgeX = Math.abs(x) / (width / 2)
      const edgeY = Math.abs(y) / (height / 2)
      
      if (edgeX > 1 - edgeDist) {
        const pushBack = (edgeX - (1 - edgeDist)) / edgeDist
        const force = (x > 0 ? -1 : 1) * pushBack * 3.0
        velX += force * delta
        dispX += force * delta * 0.1
      }
      if (edgeY > 1 - edgeDist) {
        const pushBack = (edgeY - (1 - edgeDist)) / edgeDist
        const force = (y > 0 ? -1 : 1) * pushBack * 3.0
        velY += force * delta
        dispY += force * delta * 0.1
      }
      
      // Clamp displacement
      dispX = Math.max(-2, Math.min(2, dispX))
      dispY = Math.max(-2, Math.min(2, dispY))
      
      // Store velocities and displacement
      vertexVelocities[velIndex] = velX
      vertexVelocities[velIndex + 1] = velY
      displacementData[dispIndex] = dispX
      displacementData[dispIndex + 1] = dispY
      
      // Apply displacement to vertex position
      const originalX = originalPositionsRef.current[i]
      const originalY = originalPositionsRef.current[i + 1]
      positions[i] = originalX + dispX * 0.25
      positions[i + 1] = originalY + dispY * 0.25
    }
    
    // Update attributes
    displacementAttributeRef.current.needsUpdate = true
    geometryRef.current.attributes.position.needsUpdate = true
    geometryRef.current.computeVertexNormals()
    
    // Decay global velocity
    velocityRef.current.multiplyScalar(0.8)
  })
  
  // Cleanup
  useEffect(() => {
    return () => {
      textTexture.dispose()
    }
  }, [textTexture])
  
  return (
    <group>
      <mesh ref={meshRef} position={[0, 0, 0]}>
        <planeGeometry 
          ref={geometryRef} 
          args={[viewport.width * 1.4, viewport.height * 1.4, 200, 200]} 
        />
        <LiquidTextMaterial
          mouse={mouseRef.current}
          texture={textTexture}
          velocity={velocityRef.current}
        />
      </mesh>
      
      <ambientLight intensity={0.7} />
      <pointLight position={[5, 5, 8]} intensity={1.2} />
      <pointLight position={[-5, -5, 8]} intensity={0.8} />
      <directionalLight position={[0, 0, 5]} intensity={0.5} />
    </group>
  )
}
