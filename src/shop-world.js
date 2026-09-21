import * as T from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { Reflector } from 'three/addons/objects/Reflector.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { SSAOPass } from 'three/addons/postprocessing/SSAOPass.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
export function createShop(canvas) {
  const renderer = new T.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(devicePixelRatio, matchMedia('(pointer:coarse)').matches ? 1.5 : 2));
  renderer.info.autoReset=false;renderer.shadowMap.enabled = true; renderer.shadowMap.type = T.PCFSoftShadowMap;
  renderer.outputColorSpace = T.SRGBColorSpace; renderer.toneMapping = T.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.05;
  const scene = new T.Scene(); scene.background = new T.Color('#b9dde2'); scene.fog = new T.Fog('#d4e1db', 22, 55);
  const camera = new T.PerspectiveCamera(60, 1, .06, 65); camera.rotation.order = 'YXZ';
  const products = [], hitTargets = [], blockers = [], cache = new Map(), signs = new Map();
  const mobile=matchMedia('(pointer:coarse)').matches;
  const pmrem=new T.PMREMGenerator(renderer), room=new RoomEnvironment();
  scene.environment=pmrem.fromScene(room,.02).texture;scene.environmentIntensity=.4;room.dispose();pmrem.dispose();
  const pending=[];let loadedResolve,loadedReject;const ready=new Promise((resolve,reject)=>{loadedResolve=resolve;loadedReject=reject;});
  const atlas=new T.TextureLoader().load(`${import.meta.env.BASE_URL}assets/shop-packaging.webp`,loaded=>{for(const t of pending){t.image=loaded.image;t.needsUpdate=true;}loadedResolve();},undefined,loadedReject);
  atlas.colorSpace=T.SRGBColorSpace;atlas.anisotropy=Math.min(8,renderer.capabilities.getMaxAnisotropy());
  function packTexture(index){const t=atlas.clone();t.repeat.set(.25,.5);t.offset.set((index%4)/4,index<4?.5:0);pending.push(t);return t;}

  const packaging=Array.from({length:8},(_,i)=>new T.MeshStandardMaterial({map:packTexture(i),roughness:i===6?.48:.37,metalness:i<4?.08:0}));

  function mat(color, roughness = .7) { const key = color + roughness; if (!cache.has(key)) cache.set(key, new T.MeshStandardMaterial({ color, roughness })); return cache.get(key); }
  const steel = new T.MeshStandardMaterial({color:'#c1c4bf',roughness:.32,metalness:.65}), white = mat('#e3e1d7',.42), dark = mat('#1e2927'), wood = mat('#cbb087'), green = mat('#086343');
  function box(w,h,d,x,y,z,material=white,parent=scene,block=false) { const m=new T.Mesh(new T.BoxGeometry(w,h,d),material);m.position.set(x,y,z);m.castShadow=true;m.receiveShadow=true;parent.add(m);if(block)blockers.push(m);return m; }
  function cylinder(r1,r2,h,x,y,z,material,parent=scene) {const m=new T.Mesh(new T.CylinderGeometry(r1,r2,h,20),material);m.position.set(x,y,z);m.castShadow=true;parent.add(m);return m;}
  function texture(draw,w=512,h=256){const c=document.createElement('canvas');c.width=w;c.height=h;draw(c.getContext('2d'),w,h);const t=new T.CanvasTexture(c);t.colorSpace=T.SRGBColorSpace;t.anisotropy=Math.min(8,renderer.capabilities.getMaxAnisotropy());return t;}
  function sign(text,sub,w,h,x,y,z,rot=0,bg='#096344',fg='#fff9e8'){
    const key=[text,sub,w,h,bg,fg].join('|');
    if(!signs.has(key)){const map=texture((c,W,H)=>{c.fillStyle=bg;c.fillRect(0,0,W,H);c.fillStyle=fg;c.textAlign='center';c.textBaseline='middle';c.font=`600 ${sub?65:80}px Arial`;c.fillText(text,W/2,sub?H*.39:H*.5,W*.91);if(sub){c.font='34px Arial';c.fillText(sub,W/2,H*.75,W*.9);}},Math.min(4096,Math.max(256,Math.round(256*w/h))),256);signs.set(key,new T.MeshStandardMaterial({map,roughness:.65}));}
    const m=new T.Mesh(new T.PlaneGeometry(w,h),signs.get(key));m.position.set(x,y,z);m.rotation.y=rot;scene.add(m);return m;
  }
  scene.add(new T.HemisphereLight('#eefaff','#9b927d',.5));
  const sun=new T.DirectionalLight('#fff4df',2.5);sun.position.set(2,9,17);sun.castShadow=true;sun.shadow.mapSize.set(2048,2048);Object.assign(sun.shadow.camera,{left:-10,right:10,top:10,bottom:-10,near:1,far:35});sun.shadow.bias=-.00025;sun.shadow.normalBias=.02;sun.shadow.radius=3;scene.add(sun);sun.target.position.set(5,0,5);scene.add(sun.target);
  const floorTex=texture((c,w,h)=>{c.fillStyle='#e7e4d9';c.fillRect(0,0,w,h);c.strokeStyle='#bfbfb7';c.lineWidth=1;c.strokeRect(0,0,w,h);c.fillStyle='#ffffff40';c.fillRect(5,5,w-10,3);},128,128);floorTex.wrapS=floorTex.wrapT=T.RepeatWrapping;floorTex.repeat.set(20,24);
  box(10,.1,12,5,-.05,6,new T.MeshStandardMaterial({map:floorTex,roughness:.3,metalness:.06}));
  box(.15,3.1,12,-.08,1.5,6,white,scene,true);box(.15,3.1,12,10.08,1.5,6,white,scene,true);box(10,3.1,.15,5,1.5,-.08,white,scene,true);
  const ceilingTex=texture((c,w,h)=>{c.fillStyle='#f1eee6';c.fillRect(0,0,w,h);c.strokeStyle='#bbbcb6';c.lineWidth=2;c.strokeRect(0,0,w,h);},128,128);ceilingTex.wrapS=ceilingTex.wrapT=T.RepeatWrapping;ceilingTex.repeat.set(10,12);
  box(10,.08,12,5,3.05,6,new T.MeshStandardMaterial({map:ceilingTex,roughness:.9})).castShadow=false;
  for(const x of [2,7.8]){box(1,.08,.65,x,2.94,8,white);for(let n=0;n<10;n++)box(.85,.01,.02,x,2.89,7.73+n*.06,dark);}

  for(const [y,col,h] of [[2.56,'#096846',.18],[2.76,'#e85d2c',.1],[2.9,'#d44235',.07]]){
    box(10,h,.025,5,y,.025,mat(col));box(.025,h,12,.025,y,6,mat(col));box(.025,h,12,9.975,y,6,mat(col));
  }
  const glow=new T.MeshStandardMaterial({color:'#ffffff',emissive:'#e4f7ff',emissiveIntensity:2});
  for(let x=1.8;x<10;x+=3.2)for(let z=2;z<12;z+=3.8){box(.28,.045,2.15,x,2.94,z,steel);box(.2,.018,2.03,x,2.913,z,glow);const light=new T.PointLight('#eefaff',3,6,2);light.position.set(x,2.65,z);scene.add(light);}
  // Window frames and open central sliding entrance.
  const glass=new T.MeshPhysicalMaterial({color:'#d7edf0',transparent:true,opacity:.13,roughness:.08,depthWrite:false});
  for(const [x,w] of [[2,3.9],[8,3.9]]){box(w,2.7,.025,x,1.4,12,glass);box(w,.09,.08,x,.12,12,steel);box(w,.09,.08,x,2.78,12,steel);}
  for(const x of [0,2,4,6,8,10])box(.055,2.8,.1,x,1.4,12,steel);
  sign('7 ELEVEN','ยินดีต้อนรับ · WELCOME',1.8,.55,5,2.58,11.94,Math.PI);
  box(35,.1,13,5,-.12,18.6,mat('#cec9bb'));box(35,.05,5,5,-.1,22,mat('#717b7d'));
  for(const x of [-3,3,13]){
    cylinder(.14,.24,4.8,x,2.3,16,wood);
    for(let i=0;i<7;i++){const leaf=new T.Mesh(new T.SphereGeometry(1,10,6),mat(i%2?'#45865c':'#25694e'));leaf.scale.set(.38,.12,2);leaf.rotation.y=i*Math.PI*2/7;leaf.rotation.z=.25;leaf.position.set(x+Math.sin(i)*.45,4.7,16+Math.cos(i)*.45);scene.add(leaf);}
  }
  box(4,4,1,-3,1.8,24,mat('#eed6ac'));box(8,5,1,11,2.3,25,mat('#f1e4cc'));
  // Price rails and dense shelving.
  function price(x,y,z,rot=0,value='20'){sign(value+' ฿','',.16,.075,x,y,z,rot,'#fff5ca','#263d32');}
  function shelf(cx,cz,w,d,levels=4,height=1.68,material=white){
    box(w,.17,d,cx,.14,cz,dark,scene,true);for(const side of [-1,1])for(const end of [-1,1])box(.045,height,.045,cx+side*w/2,height/2,cz+end*d/2,steel,scene,true);
    for(let k=0;k<levels;k++){
      const y=.35+k*.37;box(w,.03,d,cx,y,cz,material,scene,true);
      for(const side of [-1,1])box(.028,.065,d,cx+side*w/2,y-.02,cz,steel);
    }
  }
  const doughTexture=texture((c,w,h)=>{c.fillStyle='#c78940';c.fillRect(0,0,w,h);let seed=17;for(let n=0;n<6500;n++){seed=(seed*1664525+1013904223)>>>0;const x=(seed%w);seed=(seed*1664525+1013904223)>>>0;const y=seed%h;c.fillStyle=n%3?'#e7ac6180':'#89552860';c.fillRect(x,y,n%3+1,n%2+1);}},256,256);
  const dough=new T.MeshStandardMaterial({map:doughTexture,bumpMap:doughTexture,bumpScale:.002,roughness:.85});
  const icingMaterials=['#69412c','#df89a5'].map(color=>new T.MeshPhysicalMaterial({color,roughness:.3,clearcoat:.5,clearcoatRoughness:.15}));
  const film=new T.MeshPhysicalMaterial({color:'#ffffff',transparent:true,opacity:.07,roughness:.16,metalness:.05,depthWrite:false});
  function product(type,x,y,z,rotation=0,index=0){
    const g=new T.Group();g.position.set(x,y,z);g.rotation.y=rotation;g.userData={type,available:true};scene.add(g);products.push(g);
    if(type==='chips'){const m=packaging[index%3];const geo=new T.BoxGeometry(.29,.335,.14,8,12,4);const pos=geo.attributes.position;for(let n=0;n<pos.count;n++){const t=(pos.getY(n)+.16)/.32;pos.setX(n,pos.getX(n)*(.84+.16*Math.sin(t*Math.PI))*(1+.014*Math.sin(n*2.5)));pos.setZ(n,pos.getZ(n)*(.22+.78*Math.sin(t*Math.PI))*(1+.1*Math.sin(pos.getX(n)*75+t*12)));}geo.computeVertexNormals();const b=new T.Mesh(geo,m);b.position.y=.16;g.add(b);b.rotation.z=(index%3-1)*.06;box(.275,.012,.025,0,.322,0,m,g);box(.275,.012,.025,0,.005,0,m,g);}
    if(type==='donut'){const base=new T.Mesh(new T.TorusGeometry(.095,.045,12,28),dough);base.rotation.x=-Math.PI/2;base.position.y=.055;g.add(base);const icing=new T.Mesh(new T.TorusGeometry(.095,.038,12,28),icingMaterials[index%2]);icing.rotation.x=-Math.PI/2;icing.position.y=.078;const iv=icing.geometry.attributes.position;for(let q=0;q<iv.count;q++){const a=Math.atan2(iv.getY(q),iv.getX(q));iv.setZ(q,iv.getZ(q)+.006*Math.sin(a*7+index));}icing.geometry.computeVertexNormals();g.add(icing);box(.31,.015,.3,0,.008,0,mat('#f2ead8'),g);box(.32,.15,.31,0,.075,0,film,g);box(.08,.005,.045,.1,.156,.11,mat('#f4eac5'),g);for(let j=0;j<12;j++){const a=j*2.399;const sprinkle=box(.025,.009,.009,Math.cos(a)*.092,.112,Math.sin(a)*.092,mat(['#f8db62','#f6efe1','#d870a0'][j%3]),g);sprinkle.rotation.y=a;}}
    if(type==='sandwich'){const shape=new T.Shape();shape.moveTo(-.14,0);shape.lineTo(.14,0);shape.lineTo(0,.29);shape.closePath();const geo=new T.ExtrudeGeometry(shape,{depth:.1,bevelEnabled:false});const m=new T.Mesh(geo,mat('#edcc8a'));m.position.z=-.05;g.add(m);box(.285,.33,.008,0,.165,.058,packaging[4],g);box(.30,.013,.12,0,.012,0,mat('#d6bb6e'),g);}
    if(type==='cola'){cylinder(.057,.06,.23,0,.12,0,mat('#352420',.22),g);cylinder(.062,.062,.14,0,.14,0,packaging[7],g);cylinder(.028,.056,.075,0,.27,0,mat('#392925',.18),g);cylinder(.025,.025,.05,0,.325,0,mat('#c72b2b'),g);}
    g.traverse(o=>{if(o.isMesh){o.userData.product=g;o.castShadow=false;hitTargets.push(o);}});return g;
  }
  // Two central double-sided gondolas, low enough to see department signs.
  for(const [cx,type] of [[3.05,'chips'],[6.75,'other']]){
    shelf(cx,5.4,1.1,4.8);box(.07,1.48,4.75,cx,.87,5.4,mat('#cbc8b9'),scene,true);
    for(let row=0;row<4;row++)for(let j=0;j<12;j++)for(const side of [-1,1]){
      const z=3.2+j*.38,y=.385+row*.37,x=cx+side*.35;
      if(type==='chips')product('chips',x,y,z,side*Math.PI/2,Math.floor(j/4));
      else{box(.18,.27,.26,x,y+.135,z,packaging[j%2?3:5]);}
      if(j%3===0)price(cx+side*.56,y-.025,z,side*Math.PI/2,type==='chips'?'20':'15');if(j%5===0&&row===2)sign('พิเศษ','2 ชิ้น 35 ฿',.19,.19,cx+side*.57,y-.11,z,side*Math.PI/2,'#f6d34f','#752a21');
    }
    for(let row=0;row<4;row++){
      box(1.1,.035,.35,cx,.35+row*.37,7.82,steel);
      for(let k=0;k<3;k++){if(type==='chips')product('chips',cx-.34+k*.34,.385+row*.37,7.87,0,k);else box(.28,.30,.13,cx-.34+k*.34,.535+row*.37,7.87,packaging[(k%2)?3:5]);}
      price(cx,.325+row*.37,8.015,0,'20');
    }
    sign(type==='chips'?'ขนมขบเคี้ยว':'อร่อยทุกวัน',type==='chips'?'ЧИПСЫ · SNACKS':'СЛАДОСТИ · NOODLES',1.25,.39,cx,1.95,7.85);
  }
  // Sandwich cold bay along left wall, products face right into aisle.
  shelf(.67,4.9,.84,4.4,4,2.2);box(.08,2.05,4.4,.28,1.17,4.9,dark,scene,true);
  for(let r=0;r<4;r++)for(let j=0;j<11;j++){product('sandwich',.86,.385+r*.37,2.91+j*.38,Math.PI/2,j);if(j%3===0)price(1.105,.35+r*.37,2.91+j*.38,Math.PI/2,'35');}
  sign('แซนด์วิช','СЭНДВИЧИ · READY TO EAT',3.9,.35,1.115,2.18,4.9,Math.PI/2);
  for(const z of [2.77,7.03])box(.04,1.6,.04,1.05,1.2,z,glow);
  // Bakery case: wooden base, open player-facing side, transparent side walls.
  box(.85,.6,2,.67,.3,9.3,wood,scene,true);box(.06,1,2,.28,1.1,9.3,wood,scene,true);
  for(let r=0;r<3;r++){box(.85,.04,2,.67,.65+r*.32,9.3,steel,scene,true);box(.78,.015,1.93,.69,.68+r*.32,9.3,mat('#cab993'));box(.025,.025,2,1.08,.68+r*.32,9.3,glow);for(let j=0;j<6;j++)product('donut',.87,.69+r*.32,8.49+j*.32,0,j+r);price(1.11,.64+r*.32,9.3,Math.PI/2,'25');}
  for(const z of [8.3,10.3]){box(.85,1.05,.025,.67,1.13,z,glass);box(.04,1.05,.04,1.085,1.13,z,steel);}box(.85,.04,2,.67,1.66,9.3,steel);box(.78,.015,1.9,.67,1.64,9.3,glass);
  const grain=texture((c,w,h)=>{c.fillStyle='#cdb38a';c.fillRect(0,0,w,h);for(let n=0;n<160;n++){c.strokeStyle=n%2?'#b4997560':'#e8d8b660';c.lineWidth=1;c.beginPath();c.moveTo(n*3.3,0);c.bezierCurveTo(n*3.3+6,70,n*3.3-7,180,n*3.3+3,h);c.stroke();}},512,256);wood.map=grain;wood.needsUpdate=true;

  sign('โดนัท','ПОНЧИКИ · BAKERY',1.9,.42,1.11,1.91,9.3,Math.PI/2,'#76533e');
  // Rear fridges: accessible display fronts with slim frames and LED rails.
  box(9.5,2.2,.15,5,1.13,.28,dark,scene,true);box(9.5,.15,.8,5,.12,.65,dark,scene,true);
  for(let j=0;j<8;j++){
    const x=.85+j*1.18;for(let r=0;r<4;r++){
      box(1.15,.035,.65,x,.32+r*.4,.65,steel,scene,true);
      for(let c=0;c<7;c++){if(j<4)product('cola',x-.48+c*.16,.345+r*.4,.9,0,c);else{const bx=x-.48+c*.16,by=.345+r*.4;const m=mat(j%2?'#c4dce1':'#e9ad34',.18);cylinder(.058,.06,.23,bx,by+.12,.86,m);cylinder(.025,.058,.07,bx,by+.27,.86,m);cylinder(.025,.025,.035,bx,by+.323,.86,mat(j%2?'#3f86b3':'#39905a'));cylinder(.061,.061,.1,bx,by+.15,.86,packaging[j%2?6:3]);}}
      price(x,.30+r*.4,1.02,0,j<4?'20':'15');
    }
    box(.045,1.95,.05,x-.57,1.2,1.04,steel);box(.016,1.8,.02,x-.52,1.2,1.02,glow);
    box(.035,2.03,.055,x+.57,1.13,1.08,steel);
    box(1.16,.045,.055,x,.14,1.08,steel);box(1.16,.045,.055,x,2.14,1.08,steel);
    box(1.08,1.94,.014,x,1.14,1.07,new T.MeshPhysicalMaterial({color:'#d6edf0',roughness:.12,metalness:.12,transparent:true,opacity:.1,depthWrite:false}));
    box(.033,.43,.075,x+.48,1.17,1.12,steel);
    for(let l=0;l<5;l++)box(1.08,.014,.016,x,.09+l*.018,1.06,mat('#59625f'));

  }
  for(const x of [1.6,4.4,7.5]){const coldLight=new T.PointLight('#e2f5ff',2.5,3,2);coldLight.position.set(x,1.9,1.35);scene.add(coldLight);}
  sign('เครื่องดื่ม','НАПИТКИ · COLD DRINKS',8.9,.35,5,2.34,1.055);
  shelf(9.35,4.9,.8,4.4,4,2);box(.08,2,4.4,9.73,1.1,4.9,dark,scene,true);
  for(let r=0;r<4;r++)for(let j=0;j<13;j++)box(.28,.24,.22,9.24,.51+r*.37,2.9+j*.32,packaging[j%2?6:4]);
  sign('อาหารพร้อมทาน','МОЛОКО · ГОТОВАЯ ЕДА',3.9,.35,8.92,2.17,4.9,-Math.PI/2);
  // Cash register with screen facing the customer and compact coffee corner.
  box(2.55,1,.65,8.475,.5,10.325,wood,scene,true);box(2.68,.06,.76,8.475,1.03,10.325,white,scene,true);
  box(.42,.05,.3,8.4,1.1,10.3,dark);box(.05,.23,.05,8.4,1.23,10.3,dark);box(.44,.29,.05,8.4,1.42,10.27,dark);
  sign('สวัสดี','КАССА · CHECKOUT',.4,.24,8.4,1.42,10.24,Math.PI,'#21382f');
  sign('КАССА','Собери список → сюда',2.2,.35,8.47,2.15,10.3,Math.PI);
  box(2.55,.95,.6,8.48,.475,11.45,wood,scene,true);box(.58,.63,.4,9.1,1.26,11.4,dark);box(.54,.3,.38,7.85,1.1,11.4,steel);
  sign('ALL Café','สดใหม่ทุกวัน',1,.6,9.97,2,10.7,-Math.PI/2,'#f4ebd5','#704b36');
  for(let j=0;j<5;j++)box(1,.09,.47,1.2,.22+j*.1,11.48,green);
  sign('ยินดีต้อนรับ','Корзинки',1.5,.35,1.4,1.12,11.74,Math.PI);
  const shadowTex=texture((c,w,h)=>{const gradient=c.createRadialGradient(w/2,h/2,0,w/2,h/2,w/2);gradient.addColorStop(0,'rgba(35,30,20,.4)');gradient.addColorStop(.65,'rgba(35,30,20,.23)');gradient.addColorStop(1,'rgba(35,30,20,0)');c.fillStyle=gradient;c.fillRect(0,0,w,h);},128,128);
  for(const [x,z,w,d] of [[3.05,5.4,2.5,6.3],[6.75,5.4,2.5,6.3],[.7,4.9,2,5.5],[.7,9.3,2.2,3.2],[5,.6,10,2.6],[8.5,10.5,3.7,2.6]]){const m=new T.Mesh(new T.PlaneGeometry(w,d),new T.MeshBasicMaterial({map:shadowTex,transparent:true,depthWrite:false}));m.rotation.x=-Math.PI/2;m.position.set(x,.008,z);scene.add(m);}
  // Merge static opaque fixture geometry by material. Product meshes remain separately selectable.
  scene.updateMatrixWorld(true);const batches=new Map(),casting=new Set();
  for(const o of [...scene.children])if(o.isMesh&&!o.material.transparent&&!Array.isArray(o.material)){
    const geo=o.geometry.clone().applyMatrix4(o.matrixWorld);if(!geo.attributes.uv)continue;
    if(!batches.has(o.material))batches.set(o.material,[]);batches.get(o.material).push(geo);if(o.castShadow)casting.add(o.material);o.visible=false;
  }
  for(const [material,geometries] of batches){const geometry=mergeGeometries(geometries,false);if(!geometry)continue;const mesh=new T.Mesh(geometry,material);mesh.receiveShadow=true;mesh.castShadow=casting.has(material);scene.add(mesh);for(const geo of geometries)geo.dispose();}
  // Draw repeated products in material/geometry batches while preserving individual ray targets.
  const productBatches=new Map(),instanceRefs=new Map();
  for(const p of products){p.updateMatrixWorld(true);p.traverse(o=>{if(!o.isMesh)return;const position=o.geometry.attributes.position;let hash=0;for(let i=0;i<position.array.length;i++)hash=(Math.imul(hash,31)+Math.round(position.array[i]*100000))|0;const key=o.material.id+':'+o.geometry.type+':'+hash;if(!productBatches.has(key))productBatches.set(key,[]);productBatches.get(key).push({mesh:o,product:p,matrix:o.matrixWorld.clone()});o.visible=false;});}
  for(const entries of productBatches.values()){
    const batch=new T.InstancedMesh(entries[0].mesh.geometry,entries[0].mesh.material,entries.length);batch.instanceMatrix.setUsage(T.DynamicDrawUsage);batch.receiveShadow=true;batch.frustumCulled=false;
    entries.forEach((entry,index)=>{batch.setMatrixAt(index,entry.matrix);if(!instanceRefs.has(entry.product))instanceRefs.set(entry.product,[]);instanceRefs.get(entry.product).push({batch,index,matrix:entry.matrix});});scene.add(batch);
  }
  const invisibleMatrix=new T.Matrix4().makeScale(0,0,0);
  function productVisible(product,visible){product.visible=visible;product.userData.available=visible;for(const ref of instanceRefs.get(product)||[]){ref.batch.setMatrixAt(ref.index,visible?ref.matrix:invisibleMatrix);ref.batch.instanceMatrix.needsUpdate=true;}}
  // A restrained planar reflection gives the tiled floor the shop's polished finish.
  const floorReflection=new Reflector(new T.PlaneGeometry(10,12),{textureWidth:mobile?256:512,textureHeight:mobile?256:512,color:0xaaa99c,clipBias:.003});
  floorReflection.rotation.x=-Math.PI/2;floorReflection.position.set(5,.003,6);floorReflection.material.transparent=true;floorReflection.material.depthWrite=false;
  floorReflection.material.fragmentShader=floorReflection.material.fragmentShader.replace('gl_FragColor = vec4( blendOverlay( base.rgb, color ), 1.0 );','gl_FragColor = vec4( blendOverlay( base.rgb, color ), 0.13 );');const reflectRender=floorReflection.onBeforeRender;floorReflection.onBeforeRender=function(...args){if(scene.overrideMaterial)return;reflectRender.apply(this,args);};scene.add(floorReflection);
  const highlight=new T.BoxHelper(new T.Mesh(new T.BoxGeometry(.1,.1,.1)), '#ffe0a0');highlight.visible=false;scene.add(highlight);
  const ray=new T.Raycaster();ray.far=2.2;
  function target(){ray.setFromCamera(new T.Vector2(0,0),camera);const hits=ray.intersectObjects([...hitTargets.filter(o=>o.userData.product.userData.available),...blockers],false);const p=hits[0]?.object.userData.product;return p?.userData.available?p:null;}
  const renderTarget=new T.WebGLRenderTarget(innerWidth,innerHeight,{type:T.HalfFloatType,samples:mobile?0:2});const composer=new EffectComposer(renderer,renderTarget);composer.setPixelRatio(mobile?1:Math.min(devicePixelRatio,1.5));const ao=new SSAOPass(scene,camera,innerWidth,innerHeight,8);ao.kernelRadius=.24;ao.minDistance=.0005;ao.maxDistance=.06;composer.addPass(new RenderPass(scene,camera));composer.addPass(ao);composer.addPass(new OutputPass());
  function resize(){renderer.setSize(innerWidth,innerHeight);camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();composer.setSize(innerWidth,innerHeight);}resize();
  addEventListener('resize',resize);
  function render(player,yaw,pitch){renderer.info.reset();camera.position.set(player.x,1.6,player.z);camera.rotation.set(pitch,yaw,0,'YXZ');composer.render();renderer.shadowMap.autoUpdate=false;}
  return {ready,scene,camera,renderer,products,quality:{ao,composer,floorReflection},render,target,highlight,restock(){for(const p of products){productVisible(p,true);}},pick(p){productVisible(p,false);highlight.visible=false;}};
}
