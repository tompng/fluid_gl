'use strict'

let THREE = require('three')
class SimpleViewer{
  init(){
    let VERT = `
    varying vec2 coord;
    void main(){
      coord=position.xy/2.0+vec2(0.5,0.5);
      gl_Position=vec4(position,1);
    }
    `
    let FRAG = `
    varying vec2 coord;
    uniform sampler2D wave;
    void main(){
      vec4 uvha=texture2D(wave,coord);
      gl_FragColor.rgb = uvha.a*vec3(8,4,2) + uvha.z*vec3(4,0,0);
      gl_FragColor.a = 1.0;
    }
    `
    this.scene = new THREE.Scene()
    this.camera = new THREE.Camera()
    let geometry = new THREE.PlaneBufferGeometry(2,2)
    let shader = new THREE.ShaderMaterial({
      uniforms: {wave: {type: "t"}},
      vertexShader: VERT,
      fragmentShader: FRAG,
    })
    this.plane = new THREE.Mesh(geometry, shader)
    this.scene.add(this.plane)
  }
  render(renderer, target){
    if(!this.scene)this.init()
    this.plane.material.uniforms.wave.value = target.texture || target
    renderer.render(this.scene, this.camera)
  }
}

let viewer = new SimpleViewer()
module.exports = (renderer, target) => viewer.render(renderer, target)
