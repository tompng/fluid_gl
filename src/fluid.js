'use strict'
let THREE = require('three')
let PoissonSolverGL = require('poisson_gl')
let SimulatorBase = require('./simulator_base')

class FluidSimulator extends SimulatorBase {
  constructor(renderer, size, option){
    if(!option)option = {}
    super(renderer)
    this._initDisturb()
    this._initStore(size)
    this.pressure = SimulatorBase.createRenderTarget(size, size)
    this.divV = SimulatorBase.createRenderTarget(size, size)
    this.wave = SimulatorBase.createRenderTarget(size, size)
    this.wavetmp = SimulatorBase.createRenderTarget(size, size)
    this.advectionShader = FluidSimulator.advectionShader(size)
    this.divShader = FluidSimulator.divShader(size)
    this.pressuredVelocityShader = FluidSimulator.pressuredVelocityShader(size)
    this.poissonSolver = new PoissonSolverGL(renderer, size)
  }
  clear(){
    this._clearTarget(this.wave)
  }
  disturb(position, option){
    let vmult = option.vmult || 0
    let amult = option.amult || 0.95
    let bmult = option.bmult || 0.95
    let vx = option.vx || 0
    let vy = option.vy || 0
    let a = option.a || 0
    let b = option.b || 0
    let mult = new THREE.Vector4(vmult, vmult, amult, bmult)
    let add = new THREE.Vector4((1-vmult)*vx, (1-vmult)*vy, (1-amult)*a, (1-bmult)*b)
    super.disturb(position, option.r||0.1, mult, add)
  }
  calc(){
    this._disturbApply(this.wave)
    this._render(this.wavetmp, this.advectionShader, { wave: this.wave.texture })
    this._render(this.divV, this.divShader, { wave: this.wavetmp.texture })
    this.poissonSolver.solve(this.divV, this.pressure)
    this._render(
      this.wave,
      this.pressuredVelocityShader,
      { wave: this.wavetmp.texture, pressure: this.pressure.texture }
    )
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
    uniforms: { wave: { type: 't' } },
    fragment: `
    uniform sampler2D wave;
    void main(){
      vec2 coord = gl_FragCoord.xy/SIZE;
      coord = coord + texture2D(wave,coord).xy/SIZE;
      gl_FragColor = texture2D(wave, coord)*0.9999;
    }
    `
  })
}

module.exports = FluidSimulator
FluidSimulator.THREE = THREE
