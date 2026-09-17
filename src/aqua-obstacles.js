import * as THREE from 'three';
import { trackShader } from './aqua-logic.js';

export function createObstacleFactory(material,bend,art){
  const arc=new THREE.TorusGeometry(.78,.27,12,12,Math.PI/4);
  const mats=new Map();
  function glossy(color){if(!mats.has(color)){const base=material(color),m=base.clone();m.onBeforeCompile=base.onBeforeCompile;m.customProgramCacheKey=()=> 'aqua-inflatables';m.roughness=.22;m.metalness=.06;mats.set(color,m);}return mats.get(color);}
  function part(group,geo,color,x,y,z,sx=1,sy=sx,sz=sx){const m=new THREE.Mesh(geo,glossy(color));m.position.set(x,y,z);m.scale.set(sx,sy,sz);m.frustumCulled=false;group.add(m);return m;}
  function stripedRing(parent,color,x,y,z,scale=1){const g=new THREE.Group();g.position.set(x,y,z);g.scale.setScalar(scale);g.rotation.x=-Math.PI/2;parent.add(g);for(let i=0;i<8;i++){const m=part(g,arc,i%2?'#fff5dc':color,0,0,0);m.rotation.z=i*Math.PI/4;}return g;}
  const shadowMat=new THREE.ShaderMaterial({uniforms:{trackBend:bend},transparent:true,depthWrite:false,
    vertexShader:trackShader+'varying vec2 v;void main(){v=uv;vec4 p=modelMatrix*vec4(position,1.);float d=max(0.,2.-p.z);p.x+=routeOffset(d);gl_Position=projectionMatrix*viewMatrix*p;}',
    fragmentShader:'varying vec2 v;void main(){float a=1.-smoothstep(.1,.5,length(v-.5));gl_FragColor=vec4(.08,.19,.18,a*.24);}'
  });const shadowGeo=new THREE.PlaneGeometry(2.8,2.4);
  const artGeo=new THREE.PlaneGeometry(1,1);
  const regions={ring:[50,50,715,440,2.8,1.45],arch:[790,15,1480,480,2.9,2.7],flamingo:[65,455,720,995,2.65,2.75],coin:[995,425,1300,1024,.95,1.9]};
  const artMaterials=new Map();
  for(const [kind,[left,top,right,bottom]] of Object.entries(regions)){
    artMaterials.set(kind,new THREE.ShaderMaterial({
      uniforms:{sheet:{value:art},rect:{value:new THREE.Vector4(left/1536,1-bottom/1024,(right-left)/1536,(bottom-top)/1024)},trackBend:bend},
      transparent:true,side:THREE.DoubleSide,
      vertexShader:trackShader+`varying vec2 v;varying float depth;void main(){v=uv;vec4 p=modelMatrix*vec4(position,1.);p.x+=routeOffset(max(0.,2.-p.z));vec4 view=viewMatrix*p;depth=-view.z;gl_Position=projectionMatrix*view;}`,
      fragmentShader:`uniform sampler2D sheet;uniform vec4 rect;varying vec2 v;varying float depth;void main(){vec4 c=texture2D(sheet,rect.xy+v*rect.zw);if(c.a<.75)discard;c.rgb=mix(c.rgb,vec3(.4,.76,.76),smoothstep(80.,160.,depth));gl_FragColor=vec4(c.rgb,1.);
      #include <colorspace_fragment>
      }`
    }));
  }
  return function build(kind){const g=new THREE.Group();
    const shadow=new THREE.Mesh(shadowGeo,shadowMat);shadow.rotation.x=-Math.PI/2;shadow.position.y=.065;shadow.frustumCulled=false;g.add(shadow);
    if(regions[kind]){
      const [, , , ,width,height]=regions[kind];
      const sprite=new THREE.Mesh(artGeo,artMaterials.get(kind));
      sprite.scale.set(width,height,1);sprite.position.y=height/2+(kind==='coin'?.65:.04);sprite.frustumCulled=false;
      g.add(sprite);return g;
    }
    if(kind==='shield'){
      const ring=stripedRing(g,'#ffd22f',0,1.05,0,.62);ring.rotation.x=0;
    }
    return g;
  };
}
