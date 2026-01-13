import React, { useRef, useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { createNoise2D } from 'simplex-noise'

const vertexShader = `
  varying vec3 vPosition;
  varying vec3 vNormal;
  varying vec2 vUv;
  varying vec3 vWorldPosition;

  void main() {
    vPosition = position;
    vNormal = normal;
    vUv = uv;

    vec4 worldPosition = modelMatrix * vec4(position, 1.0);
    vWorldPosition = worldPosition.xyz;

    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`

const fragmentShader = `
  uniform float uTime;
  uniform vec2 uMouse;
  uniform sampler2D uTexture;
  uniform float uRefractionStrength;

  varying vec3 vPosition;
  varying vec3 vNormal;
  varying vec2 vUv;
  varying vec3 vWorldPosition;

  // Simplex noise function
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
    // Mouse influence on refraction
    vec2 mouseOffset = uMouse * 0.1;

    // Time-based noise for organic movement
    float noise1 = snoise(vec3(vPosition.xy * 2.0, uTime * 0.5));
    float noise2 = snoise(vec3(vPosition.xy * 4.0 + mouseOffset, uTime * 0.8));

    // Create refraction UV offset
    vec2 refractionUv = vUv + vec2(noise1, noise2) * uRefractionStrength * 0.1;

    // Sample texture with refraction
    vec4 texColor = texture2D(uTexture, refractionUv);

    // Fresnel effect for edge highlighting
    vec3 viewDirection = normalize(cameraPosition - vWorldPosition);
    float fresnel = pow(1.0 - dot(viewDirection, vNormal), 2.0);

    // Combine refraction with fresnel edge
    vec3 finalColor = mix(texColor.rgb, vec3(0.8, 0.9, 1.0), fresnel * 0.3);

    gl_FragColor = vec4(finalColor, texColor.a);
  }
`

interface RefractionMaterialProps {
  mouse: THREE.Vector2
  texture?: THREE.Texture | null
}

export const RefractionMaterial: React.FC<RefractionMaterialProps> = ({
  mouse,
  texture
}) => {
  const materialRef = useRef<THREE.ShaderMaterial>(null!)
  const noise2D = useMemo(() => createNoise2D(), [])
  const smoothedMouse = useRef(new THREE.Vector2())
  const smoothedRefraction = useRef(1.0)

  const uniforms = useMemo(() => ({
    uTime: { value: 0 },
    uMouse: { value: new THREE.Vector2() },
    uTexture: { value: texture || new THREE.Texture() },
    uRefractionStrength: { value: 1.0 }
  }), [texture])

  useFrame((state) => {
    if (materialRef.current) {
      const t = state.clock.elapsedTime
      // Smooth mouse to remove jitter from fast small movements
      smoothedMouse.current.lerp(mouse, 0.12)
      materialRef.current.uniforms.uMouse.value.copy(smoothedMouse.current)
      materialRef.current.uniforms.uTime.value = t

      // Dynamic refraction strength based on mouse movement and time
      // Use lower-frequency/time multipliers and smaller mouseSpeed contribution
      const mouseNoise = noise2D(smoothedMouse.current.x * 0.35, smoothedMouse.current.y * 0.35 + t * 0.12)
      const timeNoise = noise2D(t * 0.04, t * 0.06)
      const mouseSpeed = smoothedMouse.current.length()

      const targetRefraction = 0.55 + mouseNoise * 0.22 + timeNoise * 0.14 + mouseSpeed * 0.05
      // Smooth the refraction strength over time to remove rapid flicker
      smoothedRefraction.current = THREE.MathUtils.lerp(smoothedRefraction.current, targetRefraction, 0.06)
      materialRef.current.uniforms.uRefractionStrength.value = smoothedRefraction.current
    }
  })

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