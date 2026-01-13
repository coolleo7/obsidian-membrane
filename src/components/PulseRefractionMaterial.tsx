import { useRef, useMemo, useEffect } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'

const vertexShader = `
  varying vec3 vPosition;
  varying vec3 vNormal;
  varying vec2 vUv;
  varying vec3 vWorldPosition;
  varying vec3 vViewPosition;

  void main() {
    vPosition = position;
    vNormal = normalize(normalMatrix * normal);
    vUv = uv;

    vec4 worldPosition = modelMatrix * vec4(position, 1.0);
    vWorldPosition = worldPosition.xyz;
    vViewPosition = (modelViewMatrix * vec4(position, 1.0)).xyz;

    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`

const fragmentShader = `
  uniform float uTime;
  uniform vec2 uMouse;
  uniform sampler2D uTexture;
  uniform float uPulseSpeed;
  uniform float uPulseStrength;
  uniform vec2 uPulseOrigin;
  uniform float uPulseStart;
  uniform float uPulsePower;

  varying vec3 vPosition;
  varying vec3 vNormal;
  varying vec2 vUv;
  varying vec3 vWorldPosition;
  varying vec3 vViewPosition;

  // Simplex noise function - SAME as geometry pulse
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
    const vec2  C = vec2(1.0/6.0, 1.0/3.0);
    const vec4  D = vec4(0.0, 0.5, 1.0, 2.0);

    vec3 i  = floor(v + dot(v, C.yyy));
    vec3 x0 =   v - i + dot(i, C.xxx);

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
    vec3  ns = n_ * D.wyz - D.xzx;

    vec4 j = p - 49.0 * floor(p * ns.z * ns.z);

    vec4 x_ = floor(j * ns.z);
    vec4 y_ = floor(j - 7.0 * x_);

    vec4 x = x_ *ns.x + ns.yyyy;
    vec4 y = y_ *ns.x + ns.yyyy;
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
    // SAME pulse parameters as geometry - creates synchronized distortion
  float pulseSpeed = uPulseSpeed; // 0.025 - matches geometry
  // Lower base noise frequency for smoother, less jittery distortion
  float noiseFreq = 0.08;
    
    // Calculate PULSE noise - same as geometry displacement
    // This makes text distortion follow the pulse moving through mesh
    // Lower-frequency, lower-amplitude pulse noise to remove high-frequency jitter
    float pulseNoiseX = snoise(vec3(
      vPosition.x * noiseFreq + uTime * pulseSpeed * 0.6,
      vPosition.y * noiseFreq + uTime * (pulseSpeed * 0.7),
      uTime * 0.04
    ));

    float pulseNoiseY = snoise(vec3(
      vPosition.x * noiseFreq + uTime * (pulseSpeed * 0.65),
      vPosition.y * noiseFreq + uTime * pulseSpeed * 0.6,
      uTime * 0.05
    ));

    // Additional organic noise layer - lower amplitude for stability
    float organicNoise = snoise(vec3(
      vPosition.x * 0.05 + uTime * 0.012,
      vPosition.y * 0.05 + uTime * 0.014,
      uTime * 0.02
    )) * 0.6;

  // Combine pulse noises for organic distortion (reduced amplitude)
  vec2 pulseDistortion = vec2(pulseNoiseX, pulseNoiseY) * uPulseStrength * 0.6;
    
    // Radial pulse driven by user input (click/drag)
    float radial = 0.0;
    if (uPulseStart > 0.0) {
      float t = uTime - uPulseStart;
      // pulse expands outward at rate ~0.9 and has smooth falloff
      float distToPulse = length(vPosition.xy - uPulseOrigin);
      float waveFront = t * 0.9;
      float pulseWidth = 0.6; // visual width of wave front
      float normalized = (distToPulse - waveFront) / pulseWidth;
      radial = exp(-normalized * normalized * 4.0) * uPulsePower;
      // Add directional displacement from pulse to UV distortion
  pulseDistortion += normalize(vPosition.xy - uPulseOrigin) * radial * 0.6;
    }
  pulseDistortion += vec2(organicNoise) * 0.25;

    // Use surface normal for proper refraction direction
    vec3 viewDirection = normalize(-vViewPosition);
    vec3 refractedDir = refract(-viewDirection, vNormal, 1.0 / 1.5);
    
    // Project refracted direction to UV space
    vec2 refractionOffset = refractedDir.xy * 0.3;
    
    // Combine pulse distortion with refraction
    // Map UV from membrane space to texture space
    // Membrane is 10x8, texture is 2048x1024, text planes are at z=-1
    vec2 textureUv = vUv;
    textureUv = textureUv * 0.5 + 0.5; // Normalize to 0-1
    // textureUv.y = 1.0 - textureUv.y; // Flip Y for texture coordinates
    
    // Apply pulse distortion - this makes text distort ORGANICALLY as pulse moves through mesh
    // The distortion follows the SAME Simplex Noise pulse that displaces the geometry
  // Slightly reduce distortion multipliers to stabilize the image
  vec2 distortedUv = textureUv + pulseDistortion * 0.6 + refractionOffset * 0.25;
    // Clamp sampling coordinates to avoid sampling outside the texture (which can look like background)
    distortedUv = clamp(distortedUv, vec2(0.0), vec2(1.0));

    // Sample text texture with distorted UVs
    // This creates REAL-TIME refraction - text distorts as pulse moves through mesh
    vec4 textColor = texture2D(uTexture, distortedUv);
    
    // Calculate Fresnel for edge glow
    float fresnel = pow(1.0 - dot(viewDirection, vNormal), 2.0);
    
  // Transmission color - obsidian (very dark volcanic glass)
  // Slight bluish/green tint to emulate obsidian highlights under light
  vec3 transmissionColor = vec3(0.015, 0.018, 0.03);

  // Mix text color with transmission based on fresnel
  // Text is more visible at edges (stronger refraction)
  vec3 refractedText = mix(transmissionColor, textColor.rgb, textColor.a * (0.25 + fresnel * 0.55));

  // Edge glow color - subtle cool rim to emulate obsidian sheen
  vec3 edgeColor = mix(refractedText, vec3(0.08, 0.12, 0.2), fresnel * 0.5);

  // Final color - text visible through membrane with pulse distortion
  vec3 finalColor = mix(refractedText, edgeColor, fresnel * 0.7);

    // Fully opaque dense glassy obsidian so background never shows through
  gl_FragColor = vec4(finalColor, 1.0);
  }
`

interface PulseRefractionMaterialProps {
  mouse: THREE.Vector2
  texture?: THREE.Texture | null
  pulseSpeed?: number
  pulseStrength?: number
  pulseRef?: React.MutableRefObject<{ pos: THREE.Vector2; time: number; strength: number } | null>
}

export const PulseRefractionMaterial: React.FC<PulseRefractionMaterialProps> = ({
  mouse,
  texture,
  pulseSpeed = 0.025, // SAME as geometry pulse speed
  pulseStrength = 0.15,
  pulseRef
}) => {
  const materialRef = useRef<THREE.ShaderMaterial>(null!)

  const uniforms = useMemo(() => ({
    uTime: { value: 0 },
    uMouse: { value: new THREE.Vector2() },
    uTexture: { value: texture || null },
    uPulseSpeed: { value: pulseSpeed },
    uPulseStrength: { value: pulseStrength }
    , uPulseOrigin: { value: new THREE.Vector2(0, 0) }
    , uPulseStart: { value: 0 }
    , uPulsePower: { value: 0 }
  }), [texture, pulseSpeed, pulseStrength])
  
  // Update texture when it changes
  useEffect(() => {
    if (materialRef.current && texture) {
      materialRef.current.uniforms.uTexture.value = texture
    }
  }, [texture])

  useFrame((state) => {
    if (materialRef.current) {
      materialRef.current.uniforms.uTime.value = state.clock.elapsedTime
      materialRef.current.uniforms.uMouse.value.copy(mouse)

      // If there's an externally-requested pulse, consume it and set shader uniforms
      if (pulseRef && pulseRef.current) {
        const p = pulseRef.current
        // Use current clock time as pulse start so shader timing is consistent with uTime
        materialRef.current.uniforms.uPulseOrigin.value.set(p.pos.x, p.pos.y)
        materialRef.current.uniforms.uPulseStart.value = state.clock.elapsedTime
        materialRef.current.uniforms.uPulsePower.value = p.strength
        // Clear pulse so it isn't repeatedly reapplied; shader still uses start time for animation
        pulseRef.current = null
      }
    }
  })

  return (
    <shaderMaterial
      ref={materialRef}
      vertexShader={vertexShader}
      fragmentShader={fragmentShader}
      uniforms={uniforms}
      // Make material opaque to prevent background bleed-through during heavy displacement
      transparent={false}
      side={THREE.DoubleSide}
      depthWrite={true}
    />
  )
}
