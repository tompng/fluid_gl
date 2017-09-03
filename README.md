# WebGL wave & fluid effect

## demo
https://tompng.github.io/fluid_gl/

## package.json
```json
"dependencies": {
  "fluid_gl" : "git://github.com/tompng/fluid_gl.git",
  "three": "^0.86.0"
}
```

## sample
https://tompng.github.io/fluid_gl/sample.html
```js
let THREE = require('three')
let FluidGL = require('fluid_gl')
let renderer = new THREE.WebGLRenderer()
renderer.setSize(256, 256)
document.body.appendChild(renderer.domElement)
let simulator = new FluidGL.FluidSimulator(renderer, 256)
function animate(){
  let time = performance.now()/1000
  simulator.disturb(
    0.5, 0.5,
    { vx: 2*Math.cos(time), vy: 2*Math.sin(time), a: 1, b: 0.5+0.5*Math.sin(time/3) }
  )
  simulator.calc()
  FluidGL.show(renderer, simulator.wave)
  requestAnimationFrame(animate)
}
animate()
```

## api

### initialize
```javascript
let renderer = new THREE.WebGLRenderer()
let resolution = 256 //must be power of 2
let simulator = new FluidGL.WaveSimulator(renderer, resolution) // fluid with wave height
let simulator = new FluidGL.FluidSimulator(renderer, resolution) // fluid without wave height
```

### disturb
```javascript
// WaveSimulator
simulator.disturb(x, y, {vx: vx, vy: vy, h: waveHeight, a: colorFactorA})
// FluidSimulator
simulator.disturb(x, y, {vx: vx, vy: vy, b: colorFactorB, a: colorFactorA})
```

### calc
```javascript
simulator.calc()
```

### display
```javascript
FluidGL.show(renderer, simulator.wave)
```

### read velocity(this is slow)
```javascript
simulator.read(x, y, (val)=>{console.log(val.vx, val.vy, val.h, val.b, val.a)})
```

### use calculated wave as texture
```javascript
myCustomMaterial.uniforms.mywavetexture.value = simulator.wave.texture
// texture color representates:
// WaveSimulator: {r: vx, g: vy, b: waveHeight, a: colorFactorA}
// FluidSimulator: {r: vx, g: vy, b: colorFactorB, a: colorFactorA}
```
