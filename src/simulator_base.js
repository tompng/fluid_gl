'use strict'

let THREE = require('three')
class SimulatorBase {
  constructor(renderer){
    this.renderer = renderer
    this.camera = new THREE.Camera()
    this.camera.position.z = 1
    this.planeGeometry = new THREE.PlaneBufferGeometry(2, 2)
    this.scene = new THREE.Scene()
    this.mesh = new THREE.Mesh(this.planeGeometry)
    this.scene.add(this.mesh)
  }
  _initDisturb(){
    this.disturbScene = new THREE.Scene()
    this.disturbObjects = []
    this.disturbIndex = 0
    for(let i=0; i<256; i++){
      let shaders = disturbCircleShaders()
      let obj = {
        mult: new THREE.Mesh(this.planeGeometry, shaders.mult),
        add: new THREE.Mesh(this.planeGeometry, shaders.add)
      }
      this.disturbScene.add(obj.mult, obj.add)
      obj.mult.visible = obj.add.visible = false
      this.disturbObjects.push(obj)
    }
  }
  _storeFloatReadTest(){
    if(SimulatorBase._storeFloadReadTestResult !== undefined){
      return SimulatorBase._storeFloadReadTestResult
    }
    let target = SimulatorBase.createRenderTarget(1, 1, { type: THREE.TypeFloat })
    let clearColor = renderer.getClearColor()
    renderer.setClearColor(new THREE.Color(1, 0, 0))
    this.renderer.render(new THREE.Scene(), new THREE.Camera(), target)
    let buf = new Float32Array(4)
    this.renderer.readRenderTargetPixels(target, 0, 0, 1, 1, buf)
    renderer.setClearColor(clearColor)
    let diff = 0.01
    SimulatorBase._storeFloadReadTestResult = 1-diff < buf[0] && buf[0] < 1+diff
    return SimulatorBase._storeFloadReadTestResult
  }
  _initStore(){
    let fallback = !this._storeFloatReadTest()
    let type = fallback ? THREE.UnsignedByteType : THREE.FloatType
    let arrayClass = fallback ? Uint8Array : Float32Array
    let maxStore = 256
    let store = {
      fallback: fallback,
      target: SimulatorBase.createRenderTarget(maxStore, 1, { type: type }),
      array: new arrayClass(maxStore*4),
      callbacks: [],
      scene: new THREE.Scene(),
      shader: SimulatorBase.storeShader(fallback),
      geometry: new THREE.Geometry(),
      index: 0,
      max: maxStore
    }
    let points = new THREE.Points(store.geometry, store.shader)
    store.scene.add(points)
    this.store = store
  }
  read(x, y, cb){
    if(!this.store)this._initStore()
    let store = this.store
    if(store.index == store.max)return
    store.callbacks[store.index]=cb
    store.geometry.vertices.push(new THREE.Vector3(x,y, store.index/store.max))
    store.geometry.verticesNeedUpdate = true
    store.index++
  }
  _storeRead(){
    let store = this.store
    if(!store || !store.index)return
    this.renderer.readRenderTargetPixels(store.target, 0, 0, store.index, 1, store.array)
    let array = store.array
    let conv = store.fallback ? v=>v==0xff?1:(v-0x7f)/0x7f : v=>v
    store.callbacks.forEach((cb, i)=>{
      let index = 4*i
      if(cb)cb(this._storeConvert(conv(array[index]), conv(array[index+1]), conv(array[index+2]), conv(array[index+3])))
    })
    store.index = 0
    store.geometry.vertices = []
    store.callbacks = []
  }
  _storeConvert(r, g, b, a){
    return { r: r, g: g, b: b, a: a }
  }
  _storeExecute(target){
    if(!this.store || !this.store.index)return
    this.store.shader.uniforms.texture.value = target.texture
    this.renderer.render(this.store.scene, this.camera, this.store.target)
  }
  disturb(position, r, mult, add){
    if(!this.disturbScene)this._initDisturb()
    let obj = this.disturbObjects[this.disturbIndex++]
    if(!obj)return
    obj.mult.material.uniforms.center.value = obj.add.material.uniforms.center.value = new THREE.Vector4(2*position.x-1, 2*position.y-1)
    obj.mult.material.uniforms.radius.value = obj.add.material.uniforms.radius.value = 2*r
    obj.mult.material.uniforms.value.value = mult
    obj.add.material.uniforms.value.value = add
    obj.mult.visible = obj.add.visible = true
  }
  _disturbApply(target){
    if(!this.disturbIndex)return
    let autoClearWas = this.renderer.autoClear
    this.renderer.autoClear = false
    this.renderer.render(this.disturbScene, this.camera, target)
    this.renderer.autoClear = autoClearWas
    for(let i=0;i<this.disturbIndex;i++){
      let obj = this.disturbObjects[i]
      obj.mult.visible = obj.add.visible = false
    }
    this.disturbIndex = 0
  }
  _clearTarget(target){
    _render(target, SimulatorBase.zeroShader)
  }
  _render(target, material, uniforms){
    this.mesh.material = material
    for(let name in uniforms){
      let value = uniforms[name]
      if(material.uniforms[name]){
        material.uniforms[name].value = value && (value.texture || value)
      }
    }
    this.renderer.render(this.scene, this.camera, target)
  }
  static createRenderTarget(w, h, option){
    option=option||{}
    return new THREE.WebGLRenderTarget(w, h, {
      wrapS: THREE.RepeatWrapping,
      wrapT: THREE.RepeatWrapping,
      minFilter: option.filter || THREE.LinearFilter,
      magFilter: option.filter || THREE.LinearFilter,
      format: option.format || THREE.RGBAFormat,
      type: option.type || THREE.FloatType,
      stencilBuffer: false,
      depthBuffer: false
    })
  }
  static generateCalcShader(option){
    let defs = Object.assign({}, option.defs)
    if(option.size)defs.SIZE = option.size.toFixed(2)
    return new THREE.ShaderMaterial({
      uniforms: option.uniforms || {},
      defines: defs,
      vertexShader: option.vertex || SimulatorBase.vertexShaderCode,
      fragmentShader: option.fragment,
      transparent: true,
      blending: THREE.NoBlending,
      blendSrc: THREE.OneFactor,
      blendDst: THREE.ZeroFactor
    });
  }
}

SimulatorBase.storeShader = function(fallback){
  let VERT = `
  varying vec2 vsrc;
  void main(){
    vsrc = position.xy;
    gl_Position=vec4(2.0*position.z-1.0, 0, 0, 1);
    gl_PointSize = 1.0;
  }
  `
  function colorFunc(v){
    if(!fallback)return v
    return `(${v}+1.0)*${0x7f/0xff}`
  }
  let FRAG = `
  uniform sampler2D texture;
  varying vec2 vsrc;
  void main(){gl_FragColor=${colorFunc('texture2D(texture, vsrc)')};}
  `
  return SimulatorBase.generateCalcShader({
    uniforms: { texture: { type: 't' } },
    vertex: VERT,
    fragment: FRAG
  })
}
SimulatorBase.vertexShaderCode = 'void main(){gl_Position=vec4(position,1);}'

SimulatorBase.zeroShader = SimulatorBase.generateCalcShader({
  fragment: 'void main(){gl_FragColor = vec4(0,0,0,0);}'
})

let waveDisturbVertexCode = `
void main(){gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1);}
`
let waveDisturbFragmentCode =`
uniform vec4 value;
void main(){gl_FragColor=value;}
`
SimulatorBase.waveMultShader = new THREE.ShaderMaterial({
  uniforms: { value: { type: 'v4' } },
  vertexShader: waveDisturbVertexCode,
  fragmentShader: waveDisturbFragmentCode,
  transparent: true,
  depthTest: false,
  blending: THREE.CustomBlending,
  blendSrc: THREE.ZeroFactor,
  blendDst: THREE.SrcColorFactor
})
SimulatorBase.waveAddShader = new THREE.ShaderMaterial({
  uniforms: { value: { type: 'v4' } },
  vertexShader: waveDisturbVertexCode,
  fragmentShader: waveDisturbFragmentCode,
  transparent: true,
  depthTest: false,
  blending: THREE.CustomBlending,
  blendSrc: THREE.OneFactor,
  blendDst: THREE.OneFactor
})

function disturbCircleShaders(){
  let vertex = `
  uniform vec2 center;
  uniform float radius;
  varying vec2 coord;
  void main(){
    gl_Position=vec4(center+radius*position.xy,0,1);
    coord = position.xy;
  }
  `
  let fragment = `
  varying vec2 coord;
  uniform vec4 value;
  void main(){
    float r2=dot(coord,coord);
    if(r2>1.0)discard;
    float alpha=(1.0-r2)*(1.0-r2);
    gl_FragColor = FRAGCOLOR;
  }
  `
  function uniforms(){
    return {
      radius: { type: 'f' },
      center: { type: 'v2' },
      value: { type: 'v4' }
    }
  }
  return {
    mult: new THREE.ShaderMaterial({
      uniforms: uniforms(),
      vertexShader: vertex,
      fragmentShader: fragment.replace('FRAGCOLOR', '1.0-alpha*(1.0-value)'),
      transparent: true,
      depthTest: false,
      blending: THREE.CustomBlending,
      blendSrc: THREE.ZeroFactor,
      blendDst: THREE.SrcColorFactor
    }),
    add: new THREE.ShaderMaterial({
      uniforms: uniforms(),
      vertexShader: vertex,
      fragmentShader: fragment.replace('FRAGCOLOR', 'alpha*value'),
      transparent: true,
      depthTest: false,
      blending: THREE.CustomBlending,
      blendSrc: THREE.OneFactor,
      blendDst: THREE.OneFactor
    })
  }
}

module.exports = SimulatorBase
SimulatorBase.THREE = THREE
