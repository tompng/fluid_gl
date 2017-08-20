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
    this.pressure = SimulatorBase.createRenderTarget(size,size)
    this.divV = SimulatorBase.createRenderTarget(size,size)
    this.wave = SimulatorBase.createRenderTarget(size,size)
    this.wavetmp = SimulatorBase.createRenderTarget(size,size)
    this.advectionShader = FluidSimulator.advectionShader(size)
    this.divShader = FluidSimulator.divShader(size)
    this.pressuredVelocityShader = FluidSimulator.pressuredVelocityShader(size)
    this.poissonSolver = new PoissonSolverGL(renderer, size)
  }
  clear(){
    this._clearTarget(wave)
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

FluidSimulator.storeShader = function(){
  let VERT = `
  uniform float size, height;
  varying vec2 vsrc;
  void main(){
    vec4 xyiw = modelMatrix*vec4(0,0,0,1);
    vsrc=xyiw.xy+position.xy/size;
    gl_Position=vec4(
      position.x,
      2.0*xyiw.z-1.0+(position.y+1.0)/height,
      0,
      1
    );
  }
  `
  let FRAG = `
  uniform sampler2D texture;
  varying vec2 vsrc;
  void main(){gl_FragColor=texture2D(texture,vsrc);}
  `
  return new THREE.ShaderMaterial({
    uniforms: {
      texture: {type: "t"},
      size: {type: 'f'},
      height: {type: 'f'},
    },
    vertexShader: VERT,
    fragmentShader: FRAG,
    transparent: true,
    blending: THREE.NoBlending,
    blendSrc: THREE.OneFactor,
    blendDst: THREE.ZeroFactor
  });
}
FluidSimulator.vertexShaderCode = 'void main(){gl_Position=vec4(position,1);}';


FluidSimulator.divShader = function(size){
  let FRAG = `
  uniform sampler2D wave;
  const vec2 dx = vec2(1.0/SIZE, 0);
  const vec2 dy = vec2(0, 1.0/SIZE);
  void main(){
    vec2 coord = gl_FragCoord.xy/SIZE;
    float div = texture2D(wave,coord+dx).x - texture2D(wave,coord-dx).x + texture2D(wave,coord+dy).y - texture2D(wave,coord-dy).y;
    gl_FragColor = vec4(div,div,div,div);
  }
  `
  var defs = {SIZE: size.toFixed(2)};
  return new THREE.ShaderMaterial({
    uniforms: {wave: {type: "t"}},
    defines: defs,
    vertexShader: FluidSimulator.vertexShaderCode,
    fragmentShader: FRAG,
    transparent: true,
    blending: THREE.NoBlending,
    blendSrc: THREE.OneFactor,
    blendDst: THREE.ZeroFactor
  });
}

FluidSimulator.pressuredVelocityShader = function(size){
  let FRAG = `
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
  var defs = {SIZE: size.toFixed(2)};
  return new THREE.ShaderMaterial({
    uniforms: {wave: {type: 't'}, pressure: {type: 't'}},
    defines: defs,
    vertexShader: FluidSimulator.vertexShaderCode,
    fragmentShader: FRAG,
    transparent: true,
    blending: THREE.NoBlending,
    blendSrc: THREE.OneFactor,
    blendDst: THREE.ZeroFactor
  });
}

FluidSimulator.advectionShader = function(size){
  let FRAG = `
  uniform sampler2D wave;
  void main(){
    vec2 coord = gl_FragCoord.xy/SIZE;
    coord = coord + texture2D(wave,coord).xy/SIZE;
    gl_FragColor = texture2D(wave, coord)*0.9999;
  }
  `
  var defs = {SIZE: size.toFixed(2)};
  return new THREE.ShaderMaterial({
    uniforms: {wave: {type: "t"}},
    defines: defs,
    vertexShader: FluidSimulator.vertexShaderCode,
    fragmentShader: FRAG,
    transparent: true,
    blending: THREE.NoBlending,
    blendSrc: THREE.OneFactor,
    blendDst: THREE.ZeroFactor
  });
}

FluidSimulator.waveMultShader = function(){
  let VERT = `
  void main(){gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1);}
  `
  let FRAG = `
  uniform vec4 value;
  void main(){gl_FragColor=value;}
  `
  return new THREE.ShaderMaterial({
    uniforms: {value: {type: 'v4'}},
    vertexShader: VERT,
    fragmentShader: FRAG,
    transparent: true,
    depthTest: false,
    blending: THREE.MultiplyBlending,
  });
}
FluidSimulator.waveAddShader = function(){
  let VERT = `
  void main(){gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1);}
  `
  let FRAG = `
  uniform vec4 value;
  void main(){gl_FragColor=value;}
  `
  return new THREE.ShaderMaterial({
    uniforms: {value: {type: 'v4'}},
    vertexShader: VERT,
    fragmentShader: FRAG,
    transparent: true,
    depthTest: false,
    blending: THREE.CustomBlending,
    blendSrc: THREE.OneFactor,
    blendDst: THREE.OneFactor
  });
}

function circleShader(){
  let VERT = `
  uniform vec2 center;
  uniform float radius;
  varying vec2 coord;
  void main(){
    gl_Position=vec4(center+radius*position.xy,0,1);
    coord = position.xy;
  }
  `
  let FRAG = `
  varying vec2 coord;
  uniform vec4 value;
  void main(){
    float r2=dot(coord,coord);
    if(r2>1.0)discard;
    float alpha=(1.0-r2)*(1.0-r2);
    gl_FragColor = FRAGCOLOR;
  }
  `
  return {
    mult: new THREE.ShaderMaterial({
      uniforms: {radius: {type: 'f'},center: {type: 'v2'},value: {type: 'v4'}},
      vertexShader: VERT,
      fragmentShader: FRAG.replace('FRAGCOLOR', '1.0-alpha*(1.0-value)'),
      transparent: true,
      depthTest: false,
      blending: THREE.MultiplyBlending,
    }),
    add: new THREE.ShaderMaterial({
      uniforms: {radius: {type: 'f'},center: {type: 'v2'},value: {type: 'v4'}},
      vertexShader: VERT,
      fragmentShader: FRAG.replace('FRAGCOLOR', 'alpha*value'),
      transparent: true,
      depthTest: false,
      blending: THREE.CustomBlending,
      blendSrc: THREE.OneFactor,
      blendDst: THREE.OneFactor
    })
  }
}

module.exports = FluidSimulator
FluidSimulator.THREE = THREE
