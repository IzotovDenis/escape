import * as THREE from 'three';
import { trackShader } from './aqua-logic.js';

// ImageGen art stays in atlases; the running surface, rails and slides are geometry.
export async function createSunnyPark(scene, renderer, bend, material) {
  const loader = new THREE.TextureLoader();
  const [panorama, props, tiles] = await Promise.all(
    ['sunny-panorama.png', 'sunny-props.png', 'sunny-tiles.png'].map(name => loader.loadAsync(`${import.meta.env.BASE_URL}assets/${name}`))
  );
  for (const texture of [panorama, props, tiles]) {
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
  }
  panorama.repeat.set(1, .68);
  scene.background = panorama;
  scene.fog = new THREE.Fog('#abe5e5', 75, 175);
  const root = new THREE.Group(); scene.add(root);
  const box = new THREE.BoxGeometry(1, 1, 1);
  const longBox = new THREE.BoxGeometry(1, 1, 1, 1, 1, 100);
  function block(parent, color, x, y, z, sx, sy, sz) {
    const m = new THREE.Mesh(sz > 30 ? longBox : box, material(color));
    m.position.set(x,y,z); m.scale.set(sx,sy,sz); m.frustumCulled = false;
    parent.add(m); return m;
  }
  tiles.wrapS = tiles.wrapT = THREE.RepeatWrapping; tiles.repeat.set(1, 20);
  const roadMat = material('#fff1d5').clone(); roadMat.map = tiles;
  roadMat.onBeforeCompile = material('#fff1d5').onBeforeCompile;
  roadMat.customProgramCacheKey = () => 'sunny-road'; roadMat.roughness = .34;
  const road = new THREE.Mesh(new THREE.PlaneGeometry(10.4, 200, 2, 120), roadMat);
  road.rotation.x = -Math.PI/2; road.position.set(0,.015,-76); road.frustumCulled=false;root.add(road);
  block(root,'#d8a568',0,-.32,-76,10.8,.6,200);
  for(const x of [-5.4,5.4]) {
    block(root,'#fff4d8',x,.14,-76,.32,.3,200);
    block(root,'#159baa',x,.34,-76,.34,.10,200);
  }
  for(const x of [-1.5,1.5]) block(root,'#78d7d6',x,.025,-76,.085,.015,200);

  const clock = {value:0};
  const water = new THREE.Mesh(new THREE.PlaneGeometry(360,260),new THREE.ShaderMaterial({
    uniforms:{clock},
    vertexShader:`varying vec3 world;void main(){vec4 p=modelMatrix*vec4(position,1.);world=p.xyz;gl_Position=projectionMatrix*viewMatrix*p;}`,
    fragmentShader:`uniform float clock;varying vec3 world;
    void main(){vec2 p=world.xz;p+=vec2(sin(p.y*.47+clock*.36),cos(p.x*.35-clock*.29))*1.2;float a=sin(p.x*1.8+p.y*.7+clock*.8);float b=sin(p.y*2.1-p.x*.6-clock*.6);float rip=pow(clamp(.5+.25*a+.25*b,0.,1.),14.);float small=sin(p.x*4.+p.y*5.+clock*1.5)*.5+.5;
    vec3 c=mix(vec3(.008,.44,.60),vec3(.02,.76,.81),.5+.25*a);c+=vec3(.35,.54,.48)*rip*.55;c+=vec3(.17,.22,.20)*pow(small,28.);
    float f=smoothstep(70.,175.,length(world-cameraPosition));c=mix(c,vec3(.41,.77,.78),f);gl_FragColor=vec4(c,1.);
    #include <colorspace_fragment>
    }`
  }));water.rotation.x=-Math.PI/2;water.position.set(0,-.45,-70);root.add(water);

  const atlasMaterials = [];
  for(let i=0;i<8;i++) atlasMaterials.push(new THREE.ShaderMaterial({
    uniforms:{sheet:{value:props},frame:{value:i},trackBend:bend,shadow:{value:0}},transparent:true,depthWrite:true,side:THREE.DoubleSide,
    vertexShader:`${trackShader}varying vec2 uv2;varying float depth;void main(){uv2=uv;vec4 p=modelMatrix*vec4(position,1.);float ahead=max(0.,2.-p.z);p.x+=routeOffset(ahead);vec4 v=viewMatrix*p;depth=-v.z;gl_Position=projectionMatrix*v;}`,
    fragmentShader:`uniform sampler2D sheet;uniform float frame;uniform float shadow;varying vec2 uv2;varying float depth;void main(){vec2 uv=vec2((mod(frame,4.)+clamp(uv2.x,.005,.995))/4.,(1.-floor(frame/4.)+clamp(uv2.y,.005,.995))/2.);vec4 c=texture2D(sheet,uv);float key=min(c.r,c.b)-c.g;float alpha=c.a*(1.-smoothstep(.10,.38,key));if(alpha<.65)discard;if(key>.015){c.r=min(c.r,c.g+.10);c.b=min(c.b,c.g+.10);}c.rgb=mix(c.rgb,vec3(.40,.76,.76),smoothstep(80.,160.,depth));gl_FragColor=shadow>.5?vec4(.06,.14,.11,alpha*.16):vec4(c.rgb,alpha);
    #include <colorspace_fragment>
    }`
  }));
  const plane = new THREE.PlaneGeometry(1,1);
  const shadowMaterials=atlasMaterials.slice(0,2).map(mat=>{const m=mat.clone();m.uniforms.trackBend=bend;m.uniforms.shadow.value=1;m.depthWrite=false;return m;});
  function prop(parent, frame, x, z, width, height) {
    const m=new THREE.Mesh(plane,atlasMaterials[frame]);m.position.set(x,height*.5-.15,z);m.scale.set(width,height,1);m.frustumCulled=false;parent.add(m);return m;
  }
  // A small fixed pool of chunks loops rather than accumulating scenery.
  const chunks=[];
  for(let i=0;i<12;i++){
    const g=new THREE.Group();g.position.z=12-i*16;root.add(g);chunks.push(g);
    for(const side of [-1,1]) {
      const x=side*(9+(i%2)*2);
      block(g,'#e4c18b',side*11,-.23,0,8,.3,12);
      prop(g,(i+(side===1?1:0))%2,x,-3,7.5,12);
      const shade=new THREE.Mesh(plane,shadowMaterials[i%2]);shade.rotation.set(-Math.PI/2,0,side*.45);shade.position.set(side*5.2,.055,-2);shade.scale.set(7,11,1);shade.frustumCulled=false;g.add(shade);
      if(i%3===0)prop(g,side===1?2:3,side*11.5,3,6.2,7.5);
      else prop(g,i%3===1?7:5,side*12,2,6.8,6.5);
      prop(g,4,side*7,-2,3.8,3.7);
      if(i%4===0)prop(g,6,side*17,4,4.5,4.5);
      // Close rail posts and rope bars create visible parallax at speed.
      for(const z of [-6,-2,2,6]){
        block(g,'#bd874b',side*5.75,.65,z,.18,1.65,.18);
        block(g,'#ffdf79',side*5.75,1.5,z,.29,.18,.29);
      }
      block(g,'#f8e2b4',side*5.75,1.2,0,.095,.095,16);
      block(g,'#f8e2b4',side*5.75,.75,0,.08,.08,16);
    }
  }
  // Slides occupy the outer water zone, beyond the palms (outer edge 14.75).
  // Keep the near ends behind the foreground scenery, rather than above the runner.
  for(const side of [-1,1]){
    const points=[];
    for(let i=0;i<=60;i++){
      const z=-24-i*2.6;
      points.push(new THREE.Vector3(side*(24+Math.sin(i*.23)*2),9+Math.sin(i*.18)*1.4,z));
    }
    const path=new THREE.CatmullRomCurve3(points);
    for(let section=0;section<12;section++){
      const pts=[];for(let j=0;j<=8;j++)pts.push(path.getPoint((section+j/8)/12));
      const m=new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts),24,.85,16,false),material(section%2?'#ffb921':'#ff711b'));
      m.frustumCulled=false;root.add(m);
    }
    for(let i=0;i<8;i++){
      const p=path.getPoint(i/8);block(root,'#55afb5',p.x,p.y*.5,p.z,.3,p.y,.3);
    }
  }
  // Soft, transparent contact shadow stays attached to the runner.
  const shadow=new THREE.Mesh(new THREE.PlaneGeometry(2.1,1.3),new THREE.ShaderMaterial({transparent:true,depthWrite:false,
    vertexShader:`varying vec2 v;void main(){v=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,
    fragmentShader:`varying vec2 v;void main(){float a=(1.-smoothstep(.08,.5,length(v-.5)))*.26;gl_FragColor=vec4(.06,.17,.15,a);}`
  }));shadow.rotation.x=-Math.PI/2;shadow.position.y=.05;root.add(shadow);
  let distance=0;
  return {
    update(dt,speed,active,playerX,jump,menu){
      if(active){clock.value+=dt;distance+=speed*dt;// Plane UV +V points toward -Z. Positive offset moves the pattern toward +Z,
        // matching obstacles and scenery approaching the camera.
        tiles.offset.y=(distance/10)%1;
        for(const g of chunks){g.position.z+=speed*dt;if(g.position.z>28)g.position.z-=192;else if(g.position.z<=-164)g.position.z+=192;}
      }
      shadow.position.x=playerX;shadow.position.z=2;shadow.scale.setScalar(1-jump*.12);shadow.visible=!menu;
    },
    resize(aspect){
      // Cover the viewport without distorting the source image. Keep the same
      // vertical framing, cropping the sides continuously on narrow screens.
      const imageAspect=panorama.image.width/panorama.image.height;
      const visibleHeight=Math.min(.68,imageAspect/aspect);
      const visibleWidth=visibleHeight*aspect/imageAspect;
      panorama.repeat.set(visibleWidth,visibleHeight);
      panorama.offset.set((1-visibleWidth)/2,0);
    }
  };
}
