'use strict'
let THREE = require('three')
let SimulatorBase = require('./simulator_base')
class WaveSimulator extends SimulatorBase {
  constructor(renderer, size, option) {
    if(!option)option = {}
    super(renderer)
    this._initDisturb()
    this._initStore(size)
    this.wave0 = SimulatorBase.createRenderTarget(size, size)
    this.wave1 = SimulatorBase.createRenderTarget(size, size)
    if(option.generateNormal){
      this.pattern = option.pattern
      this.normal = SimulatorBase.createRenderTarget(size, size)
      this.normalShader = WaveSimulator.normalShader(size, this.pattern)
    }
    this.waveShader = WaveSimulator.waveShader(size)
  }
  clear(){
    this._clearTarget(this.wave0)
    this._clearTarget(this.wave1)
    if(this.normalShader)this._clearTarget(this.normalShader)
  }
  disturb(position, option){
    let vmult = option.vmult || 0
    let hmult = option.hmult || 1
    let amult = option.amult || 0.95
    let vx = option.vx || 0
    let vy = option.vy || 0
    let h = option.h || 0
    let a = option.a || 0
    let mult = new THREE.Vector4(vmult, vmult, hmult, amult)
    let add = new THREE.Vector4(vx*(1-vmult), vy*(1-vmult), h*(1-hmult), a*(1-amult))
    super.disturb(position, option.r || 0.05, mult, add)
  }
  calc(){
    this._disturbApply(this.wave)
    this.wave = this.wave0;
    this.wave0 = this.wave1;
    this.wave1 = this.wave;
    this._render(this.wave1, this.waveShader, { wave: this.wave0.texture })
    if(this.normalShader)this._calcNormal()
    this._storeExecute(this.wave)
    this._storeRead()
  }
  _storeConvert(r, g, b, a){
    return { vx: r, vy: g, h: b, a: a }
  }
  _calcNormal(){
    mesh.material = normalShader;
    normalShader.uniforms.wave.value = wave1.texture || wave1;
    let uniforms = { wave: this.wave.texture }
    if(this.pattern){
      uniforms.time = performance.now()/1000;
      uniforms.pattern = this.pattern.texture || this.pattern
    }
    this._render(this.normal, this.normalShader, uniforms)
  }
}

WaveSimulator.vertexShaderCode = 'void main(){gl_Position=vec4(position,1);}';


WaveSimulator.waveShader = function(size){
  return SimulatorBase.generateCalcShader({
    size: size,
    uniforms: { wave: { type: 't' } },
    fragment: `
    uniform sampler2D wave;
    const vec2 dx = vec2(1.0/SIZE, 0);
    const vec2 dy = vec2(0, 1.0/SIZE);
    void main(){
      vec2 coord = gl_FragCoord.xy/SIZE;
      coord = coord - texture2D(wave,coord).xy/SIZE;
      vec4 uvh = texture2D(wave, coord);
      vec4 uvhx0 = texture2D(wave,coord-dx), uvhx1 = texture2D(wave,coord+dx);
      vec4 uvhy0 = texture2D(wave,coord-dy), uvhy1 = texture2D(wave,coord+dy);
      vec4 uvhdx = uvhx1-uvhx0, uvhdy = uvhy1-uvhy0;
      vec4 diff = vec4(
        4.0*uvhdx.z,
        4.0*uvhdy.z,
        (uvhdx.x+uvhdy.y)/4.0,
        0
      );
      vec4 av = (uvhx0+uvhx1+uvhy0+uvhy1)/4.0;
      vec4 outvec = 0.7*uvh+0.3*av + 0.2*diff;
      outvec.a = uvh.a;
      gl_FragColor.xyz = clamp(outvec.xyz*0.9999, vec3(-1,-1,-1), vec3(1,1,1));
      gl_FragColor.a = clamp(outvec.a*0.9999,0.0,1.0);
    }
    `
  })
}

WaveSimulator.normalShader = function(size, pattern){
  let defs = {}
  let uniforms = { wave: { type: 't' }}
  if(pattern){
    uniforms.time = { type: 'f' }
    defs.PATTERN = '1'
  }
  return SimulatorBase.generateCalcShader({
    size: size,
    uniforms: uniforms,
    defs: defs,
    fragment: `
    const vec2 dx = vec2(1.0/SIZE, 0);
    const vec2 dy = vec2(0, 1.0/SIZE);
    uniform sampler2D wave;
    #ifdef PATTERN
    uniform float time;
    uniform sampler2D pattern;
    #endif
    void main(){
      vec2 coord = gl_FragCoord.xy/SIZE;
      vec2 hax0 = texture2D(wave,coord-dx).zw;
      vec2 hax1 = texture2D(wave,coord+dx).zw;
      vec2 hay0 = texture2D(wave,coord-dy).zw;
      vec2 hay1 = texture2D(wave,coord+dy).zw;
      vec2 norm = 32.0*vec2(hax1.x-hax0.x,hay1.x-hay0.x);
      vec2 zw = 0.25*(hax0+hax1+hay0+hay1);
      #ifdef PATTERN
      norm = norm+0.25*(
        +texture2D(pattern, 3.0*coord+time*vec2(0.22,0.0)).xy
        +texture2D(pattern, 3.0*coord+time*vec2(-0.1,0.2)).yz
        +texture2D(pattern, 3.0*coord+time*vec2(-0.1,-0.2)).zx
        -vec2(1.5,1.5)
      );
      #endif
      gl_FragColor = vec4(norm, 4.0*(zw.x-0.5), zw.y);
    }
    `
  })
}

module.exports = WaveSimulator
WaveSimulator.THREE = THREE
