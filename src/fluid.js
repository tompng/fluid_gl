'use strict'

let THREE = require('three')
let PoissonSolverGL = require('poisson_gl')
let SimulatorBase = require('./simulator_base')

class FluidSimulator extends SimulatorBase {
  constructor(renderer, size, option){
    if(!option)option = {}
    super(renderer)
    this.pressure = SimulatorBase.createRenderTarget(size, size)
    this.divV = SimulatorBase.createRenderTarget(size, size)
    this.wave = SimulatorBase.createRenderTarget(size, size)
    this.wavetmp = SimulatorBase.createRenderTarget(size, size)
    this.advectionShader = FluidSimulator.advectionShader(size)
    this.divShader = FluidSimulator.divShader(size)
    this.pressuredVelocityShader = FluidSimulator.pressuredVelocityShader(size)
    this.poissonSolver = new PoissonSolverGL(renderer, size)
    let defaultDecay = 0.9999
    this.vDecay = option.vDecay || option.decay || defaultDecay
    this.bDecay = option.bDecay || option.decay || defaultDecay
    this.aDecay = option.aDecay || option.decay || defaultDecay
  }
  clear(){
    this._clearTarget(this.wave)
  }
  disturb(x, y, option){
    let vmult = option.vmult || 0
    let bmult = option.bmult || 0.95
    let amult = option.amult || 0.95
    let vadd = option.vadd || 1-vmult
    let badd = option.badd || 1-bmult
    let aadd = option.aadd || 1-amult
    let vx = option.vx || 0
    let vy = option.vy || 0
    let a = option.a || 0
    let b = option.b || 0
    let mult = new THREE.Vector4(vmult, vmult, bmult, amult)
    let add = new THREE.Vector4(vx*vadd, vy*vadd, b*badd, a*aadd)
    super.disturb(x, y, option.r || 0.05, mult, add)
  }
  calc(){
    this._disturbApply(this.wave)
    let decay = new THREE.Vector4(this.vDecay, this.vDecay, this.bDecay, this.aDecay)
    this._render(this.wavetmp, this.advectionShader, { wave: this.wave.texture, decay: decay })
    this._render(this.divV, this.divShader, { wave: this.wavetmp.texture })
    this.poissonSolver.solve(this.divV, this.pressure)
    this._render(
      this.wave,
      this.pressuredVelocityShader,
      { wave: this.wavetmp.texture, pressure: this.pressure.texture }
    )
    this._storeExecute(this.wave)
    this._storeRead()
  }
  _storeConvert(r, g, b, a){
    return { vx: r, vy: g, b: b, a: a }
  }
}

FluidSimulator.divShader = function(size){
  return SimulatorBase.generateCalcShader({
    size: size,
    uniforms: { wave: { type: 't' } },
    fragment: `
    uniform sampler2D wave;
    const vec2 dx = vec2(1.0/SIZE, 0);
    const vec2 dy = vec2(0, 1.0/SIZE);
    void main(){
      vec2 coord = gl_FragCoord.xy/SIZE;
      float div = texture2D(wave,coord+dx).x - texture2D(wave,coord-dx).x + texture2D(wave,coord+dy).y - texture2D(wave,coord-dy).y;
      gl_FragColor = vec4(div,div,div,div);
    }
    `
  })
}

FluidSimulator.pressuredVelocityShader = function(size){
  return SimulatorBase.generateCalcShader({
    size: size,
    uniforms: { wave: { type: 't' }, pressure: { type: 't' } },
    fragment: `
    uniform sampler2D wave, pressure;
    const vec2 dx = vec2(1.0/SIZE, 0);
    const vec2 dy = vec2(0, 1.0/SIZE);
    void main(){
      vec2 coord = gl_FragCoord.xy/SIZE;
      vec4 uvzw = texture2D(wave, coord);
      vec2 grad = vec2(
        texture2D(pressure,coord+dx).x - texture2D(pressure,coord-dx).x,
        texture2D(pressure,coord+dy).x - texture2D(pressure,coord-dy).x
      );
      gl_FragColor = uvzw - vec4(grad*0.5, 0, 0);
    }
    `
  })
}

FluidSimulator.advectionShader = function(size){
  return SimulatorBase.generateCalcShader({
    size: size,
    uniforms: { wave: { type: 't' }, decay: { type: 'v4' } },
    fragment: `
    uniform sampler2D wave;
    uniform vec4 decay;
    const vec2 dx = vec2(0.25/SIZE, 0);
    const vec2 dy = vec2(0, 0.25/SIZE);
    void main(){
      vec2 coord = gl_FragCoord.xy/SIZE;
      coord = coord - texture2D(wave,coord).xy/SIZE;
      gl_FragColor = 0.25*decay*(
        +texture2D(wave, coord-dx)
        +texture2D(wave, coord+dx)
        +texture2D(wave, coord-dy)
        +texture2D(wave, coord+dy)
      );
    }
    `
  })
}

module.exports = FluidSimulator
