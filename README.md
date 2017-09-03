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
