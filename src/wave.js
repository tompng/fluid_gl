let THREE = require('three')
function WaveSimulator(renderer, size, option) {
  if(!option)option = {}
  var camera = new THREE.Camera();
  var scene = new THREE.Scene();
  var disturbScene = new THREE.Scene();
  var disturbObjects = []
  var planeGeometry = new THREE.PlaneBufferGeometry(2,2);
  for(var i=0;i<100;i++){
    var shader=circleShader();
    var obj={
      mult: new THREE.Mesh(planeGeometry,shader.mult),
      add: new THREE.Mesh(planeGeometry,shader.add)
    };
    disturbScene.add(obj.mult,obj.add);
    obj.mult.visible=obj.add.visible=false;
    disturbObjects.push(obj);
  }
  var disturbIndex = 0
  camera.position.z = 1;
  gl = renderer.getContext();
  var mesh = new THREE.Mesh(planeGeometry);
  scene.add(mesh);
  var wave0 = createRenderTarget(size,size,{type:THREE.FloatType,filter:THREE.LinearFilter});
  var wave1 = createRenderTarget(size,size,{type:THREE.FloatType,filter:THREE.LinearFilter});
  var normalShader
  if(option.generateNormal){
    this.normal = createRenderTarget(size,size);
    normalShader = WaveSimulator.normalShader(size, option.pattern);
  }
  var maxStore = 128;
  var store = {
    target: createRenderTarget(1,maxStore,{filter:THREE.NearestFilter}),
    array: new Uint8Array(maxStore*4),
    positions: {},
    index: 0,
    max: maxStore
  }
  store.scene = new THREE.Scene();
  store.meshes = [];
  store.shader = WaveSimulator.storeShader();
  store.shader.uniforms.size.value = size;
  store.shader.uniforms.height.value = store.max;
  for(var i=0;i<maxStore;i++){
    var smesh = new THREE.Mesh(new THREE.PlaneBufferGeometry(2, 2));
    smesh.material = store.shader;
    store.meshes.push(smesh);
    store.scene.add(smesh);
  }
  function createRenderTarget(w,h,option){
    option=option||{};
    return new THREE.WebGLRenderTarget(w, h, {
      wrapS: THREE.RepeatWrapping,
      wrapT: THREE.RepeatWrapping,
      minFilter: option.filter || THREE.LinearFilter,
      magFilter: option.filter || THREE.LinearFilter,
      format: option.format || THREE.RGBAFormat,
      type: option.type || THREE.UnsignedByteType,
      stencilBuffer: false,
      depthBuffer: false
    });
  }
  var waveShader = WaveSimulator.waveShader(size,true);
  var initShader = WaveSimulator.initShader();
  this.init = function(){
    mesh.material = initShader;
    renderer.render(scene, camera, wave0);
    renderer.render(scene, camera, wave1);
  }
  this.init();
  this.storeLoad = function(){
    if(store.index){
      gl.bindFramebuffer(gl.FRAMEBUFFER, store.target.__webglFramebuffer, true);
      gl.bindFramebuffer(gl.FRAMEBUFFER,store.target.__webglFramebuffer,true);
      gl.readPixels(0, 0, 1, store.index, gl.RGBA, gl.UNSIGNED_BYTE, store.array);
    }
    store.meshes.forEach(function(m){m.visible=false;})
    store.captured = {};
    for(var id in store.positions){
      var index = store.positions[id];
      var arr=[]
      for(var i=0;i<4;i++)arr[i]=store.array[4*index+i]/0xff;
      store.captured[id] = {vx: arr[0], vy: arr[1], h: arr[2], a: arr[3]};
    }
    window.store=store;
    store.index = 0;
    store.positions = {};
  }
  this.readStoredPixel = function(id){
    return store.captured[id];
  }
  this.storePixel = function(id,x,y){
    if(store.index==store.max)return;
    if(x<0||x>=size||y<0||y>=size)return;
    store.positions[id]=store.index;
    var mesh = store.meshes[store.index];
    mesh.position.x = x/size;
    mesh.position.y = y/size;
    mesh.position.z = store.index/store.max;
    mesh.visible = true;
    store.index++;
  }
  this.storeDone = function(){
    store.shader.uniforms.texture.value = this.wave.texture || this.wave;
    renderer.render(store.scene, camera, store.target);
  }
  this.disturb = function(position, option){
    var obj = disturbObjects[disturbIndex++]
    if(!obj)return
    obj.mult.material.uniforms.center.value=obj.add.material.uniforms.center.value=new THREE.Vector4(position.x, position.y);
    obj.mult.material.uniforms.radius.value=obj.add.material.uniforms.radius.value=option.r || 0.1;
    var vmult = option.vmult || 0
    var hmult = option.hmult || 1
    var amult = option.amult || 0.95
    obj.mult.material.uniforms.value.value=new THREE.Vector4(vmult, vmult, hmult, amult);
    var vx = option.vx || 0
    var vy = option.vy || 0
    var h = option.h || 0
    var a = option.a || 0
    obj.add.material.uniforms.value.value=new THREE.Vector4((1-vmult)*vx, (1-vmult)*vy, (1-hmult)*h, (1-amult)*a)
    obj.mult.visible=obj.add.visible=true;
  }
  this.calc = function(){
    if(disturbIndex){
      var autoClearWas = renderer.autoClear
      renderer.autoClear = false
      renderer.render(disturbScene, camera, this.wave)
      renderer.autoClear = autoClearWas
      for(var i=0;i<this.disturbIndex;i++){
        var obj = disturbObjects[i]
        obj.add.visible = obj.mult.visible = false
      }
      disturbIndex = 0
    }
    this.wave = wave0;
    wave0 = wave1;
    wave1 = this.wave;

    if(normalShader){
      calcNormal()
    }

    mesh.material = waveShader;
    waveShader.uniforms.wave.value = wave0.texture || wave0;
    renderer.render(scene, camera, wave1);
  }
  function calcNormal(){
    mesh.material = normalShader;
    normalShader.uniforms.wave.value = wave1.texture || wave1;
    if(option.pattern)normalShader.uniforms.time.value = performance.now()/1000;
    renderer.render(scene, camera, this.normal);
  }
  this.wave=wave1;
  this.storePixel('test',0,0);
  this.storeDone();
  this.storeLoad();
  var test = this.readStoredPixel('test');
  console.error(test)
}

WaveSimulator.storeShader = function(){
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
WaveSimulator.vertexShaderCode = 'void main(){gl_Position=vec4(position,1);}';
WaveSimulator.initShader = function(){
  return new THREE.ShaderMaterial({
    vertexShader: WaveSimulator.vertexShaderCode,
    fragmentShader: 'void main(){gl_FragColor = vec4(0,0,0,0);}',
    transparent: true,
    blending: THREE.NoBlending,
    blendSrc: THREE.OneFactor,
    blendDst: THREE.ZeroFactor
  });
}

WaveSimulator.waveShader = function(size){
  let FRAG = `
  uniform sampler2D wave;
  const vec2 dx = vec2(1.0/SIZE, 0);
  const vec2 dy = vec2(0, 1.0/SIZE);
  void main(){
    vec2 coord = gl_FragCoord.xy/SIZE;
    coord = coord + texture2D(wave,coord).xy/SIZE;
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
  var defs = {SIZE: size.toFixed(2)};
  return new THREE.ShaderMaterial({
    uniforms: {wave: {type: "t"}},
    defines: defs,
    vertexShader: WaveSimulator.vertexShaderCode,
    fragmentShader: FRAG,
    transparent: true,
    blending: THREE.NoBlending,
    blendSrc: THREE.OneFactor,
    blendDst: THREE.ZeroFactor
  });
}

WaveSimulator.normalShader = function(size, pattern){
  let FRAG = `
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
  var uniforms = {wave: {type: 't'}};
  var defines = {SIZE: size.toFixed(2)};
  if(pattern){
    uniforms.pattern = {type: 't', value: pattern};
    uniforms.time = {type: 'f'};
    defines.PATTERN = '1';
  }
  return new THREE.ShaderMaterial({
    uniforms: uniforms,
    defines: defines,
    vertexShader: WaveSimulator.vertexShaderCode,
    fragmentShader: FRAG,
    transparent: true,
    blending: THREE.NoBlending,
    blendSrc: THREE.OneFactor,
    blendDst: THREE.ZeroFactor
  });
}

WaveSimulator.waveMultShader = function(){
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
WaveSimulator.waveAddShader = function(){
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

module.exports = WaveSimulator
WaveSimulator.THREE = THREE
