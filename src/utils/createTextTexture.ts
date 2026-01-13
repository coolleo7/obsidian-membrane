import * as THREE from 'three'

export function createTextTexture(
  text: string,
  options: {
    fontSize?: number
    fontFamily?: string
    color?: string
    backgroundColor?: string
    width?: number
    height?: number
  } = {}
): THREE.CanvasTexture {
  const {
    fontSize = 120,
    fontFamily = 'Arial, sans-serif',
    color = '#ffffff',
    backgroundColor = '#000000',
    width = 1024,
    height = 512
  } = options

  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const context = canvas.getContext('2d')!

  // Clear canvas
  context.fillStyle = backgroundColor
  context.fillRect(0, 0, width, height)

  // Draw HIGH-CONTRAST text - bright white, bold
  context.fillStyle = color
  context.font = `bold ${fontSize}px ${fontFamily}`
  context.textAlign = 'center'
  context.textBaseline = 'middle'
  
  // Strong text shadow for depth
  context.shadowColor = 'rgba(255, 255, 255, 0.3)'
  context.shadowBlur = 30
  context.shadowOffsetX = 0
  context.shadowOffsetY = 0

  // Draw text multiple times for extra boldness
  context.fillText(text, width / 2, height / 2)
  context.fillText(text, width / 2, height / 2) // Double stroke for boldness

  // Create texture
  const texture = new THREE.CanvasTexture(canvas)
  texture.needsUpdate = true
  return texture
}