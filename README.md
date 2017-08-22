# WebGL wave & fluid effect

## demo
https://tompng.github.io/fluid_gl/index.html

## package.json
```json
"dependencies": {
  "fluid_gl" : "git://github.com/tompng/fluid_gl.git",
  "three": "^0.86.0"
}
```

## app
```js
let THREE = require('three')
let FluidGL = require('fluid_gl')
let renderer = new THREE.WebGLRenderer()
renderer.setSize(256, 256)
let simulator = new FluidGL.FluidSimulator(renderer, 256)
document.body.appendChild(renderer.domElement)

function animate(){
  let time = performance.now()/1000
  simulator.disturb(
    { x: 0.5, y: 0.5 },
    { vx: 0.4*Math.cos(time), vy: 0.4*Math.sin(time), a: 1, b: 0.5+0.5*Math.sin(time/3) }
  )
  simulator.calc()
  FluidGL.show(renderer, simulator.wave)
  requestAnimationFrame(animate);
}
animate()
```
