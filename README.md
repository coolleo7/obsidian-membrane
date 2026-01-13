# Obsidian Membrane

A mesmerizing 3D interactive experience featuring a liquid obsidian membrane with real-time refraction, organic typography distortion, and heavy physics-based mouse interactions.

## Features

### 🖤 **Obsidian Membrane**
- High-transmission physical material with strong Fresnel edge
- Custom refraction shader for organic text distortion
- Dynamic material properties that respond to mouse movement

### ⚖️ **Heavy Physics**
- GSAP-powered mouse inertia with extreme friction
- Liquid displacement that feels like dragging viscous fluid
- Wave propagation system creating ripples through the mesh
- Physics-based camera shake for immersion

### 📝 **Refracted Typography**
- High-contrast "OBSIDIAN MEMBRANE" text rendered behind the membrane
- Real-time refraction shader distorts text organically
- Canvas-based text rendering for crisp typography

### 🌊 **Simplex Noise Pulse**
- Continuous noise-driven animation through the mesh
- Dynamic wave origins based on mouse movement
- Organic pulsing that creates living membrane feel

### 🎬 **Analog Post-Processing**
- Selective bloom for highlight enhancement
- Film grain effect to remove digital sterility
- Chromatic aberration for analog camera feel
- Vignette for depth and focus

## Technical Implementation

Built with:
- **React 18** + **TypeScript**
- **Three.js** + **React Three Fiber**
- **React Three Drei** for utilities
- **React Three Postprocessing** for effects
- **GSAP** for smooth animations
- **Simplex Noise** for organic movement

## Key Components

- `ObsidianMembrane`: Main scene with physics and geometry
- `RefractionMaterial`: Custom shader for text refraction
- `MembraneGeometry`: Dynamic mesh with wave displacement
- `Effects`: Post-processing pipeline

## Running the Project

```bash
npm install
npm run dev
```

## Performance Notes

- High vertex count (128x128) for smooth wave propagation
- Optimized shader uniforms for real-time updates
- Efficient physics calculations with proper delta time
- Background rendering for smooth 60fps experience

The membrane responds to mouse movement with realistic liquid physics, creating a truly immersive and tactile experience that makes pixels feel like they weigh a ton.