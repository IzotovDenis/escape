import * as T from 'three';
export function createShop(canvas) {
  const renderer = new T.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(devicePixelRatio, matchMedia('(pointer:coarse)').matches ? 1.5 : 2));
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = T.PCFSoftShadowMap;
  renderer.outputColorSpace = T.SRGBColorSpace; renderer.toneMapping = T.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.05;
  const scene = new T.Scene(); scene.background = new T.Color('#b9dde2'); scene.fog = new T.Fog('#d4e1db', 22, 55);
  const camera = new T.PerspectiveCamera(68, 1, .06, 65); camera.rotation.order = 'YXZ';
  const products = [], hitTargets = [], blockers = [], cache = new Map();
  function mat(color, roughness = .7) { const key = color + roughness; if (!cache.has(key)) cache.set(key, new T.MeshStandardMaterial({ color, roughness })); return cache.get(key); }
  const steel = mat('#bfc9c7', .28), white = mat('#f3f0e5'), dark = mat('#283d39'), wood = mat('#cbb087'), green = mat('#086343');
  function box(w,h,d,x,y,z,material=white,parent=scene,block=false) { const m=new T.Mesh(new T.BoxGeometry(w,h,d),material);m.position.set(x,y,z);m.castShadow=true;m.receiveShadow=true;parent.add(m);if(block)blockers.push(m);return m; }
  function cylinder(r1,r2,h,x,y,z,material,parent=scene) {const m=new T.Mesh(new T.CylinderGeometry(r1,r2,h,12),material);m.position.set(x,y,z);m.castShadow=true;parent.add(m);return m;}
  function texture(draw,w=512,h=256){const c=document.createElement('canvas');c.width=w;c.height=h;draw(c.getContext('2d'),w,h);const t=new T.CanvasTexture(c);t.colorSpace=T.SRGBColorSpace;t.anisotropy=Math.min(8,renderer.capabilities.getMaxAnisotropy());return t;}
  function sign(text,sub,w,h,x,y,z,rot=0,bg='#096344',fg='#fff9e8'){
    const map=texture((c,W,H)=>{c.fillStyle=bg;c.fillRect(0,0,W,H);c.fillStyle=fg;c.textAlign='center';c.textBaseline='middle';c.font=`600 ${sub?65:80}px Arial`;c.fillText(text,W/2,sub?H*.39:H*.5,W*.91);if(sub){c.font='34px Arial';c.fillText(sub,W/2,H*.75,W*.9);}},Math.min(4096,Math.max(256,Math.round(256*w/h))),256);
    const m=new T.Mesh(new T.PlaneGeometry(w,h),new T.MeshStandardMaterial({map,roughness:.65}));m.position.set(x,y,z);m.rotation.y=rot;scene.add(m);return m;
  }
  scene.add(new T.HemisphereLight('#eefaff','#b5ac91',1.45));
  const sun=new T.DirectionalLight('#fff1d6',1.8);sun.position.set(2,9,17);sun.castShadow=true;sun.shadow.mapSize.set(2048,2048);Object.assign(sun.shadow.camera,{left:-10,right:10,top:10,bottom:-10,near:1,far:35});sun.shadow.bias=-.0006;scene.add(sun);sun.target.position.set(5,0,5);scene.add(sun.target);
  const floorTex=texture((c,w,h)=>{c.fillStyle='#e7e4d9';c.fillRect(0,0,w,h);c.strokeStyle='#bfbfb7';c.lineWidth=3;c.strokeRect(0,0,w,h);c.fillStyle='#ffffff40';c.fillRect(5,5,w-10,3);},128,128);floorTex.wrapS=floorTex.wrapT=T.RepeatWrapping;floorTex.repeat.set(10,12);
  box(10,.1,12,5,-.05,6,new T.MeshStandardMaterial({map:floorTex,roughness:.3,metalness:.06}));
  box(.15,3.1,12,-.08,1.5,6,white,scene,true);box(.15,3.1,12,10.08,1.5,6,white,scene,true);box(10,3.1,.15,5,1.5,-.08,white,scene,true);
  box(10,.08,12,5,3.05,6,mat('#e5e5da'));
  for(const [y,col,h] of [[2.56,'#096846',.18],[2.76,'#e85d2c',.1],[2.9,'#d44235',.07]]){
    box(10,h,.025,5,y,.025,mat(col));box(.025,h,12,.025,y,6,mat(col));box(.025,h,12,9.975,y,6,mat(col));
  }
  const glow=new T.MeshStandardMaterial({color:'#ffffff',emissive:'#e4f7ff',emissiveIntensity:2});
  for(let x=1.8;x<10;x+=3.2)for(let z=2;z<12;z+=3.8){box(.18,.035,2,x,2.97,z,glow);const light=new T.PointLight('#eefaff',3,6,2);light.position.set(x,2.65,z);scene.add(light);}
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
    for(let k=0;k<levels;k++)box(w,.045,d,cx,.35+k*.37,cz,material,scene,true);
  }
  const chipMaps=['#e9b624','#19814c','#c43929'].map((color,i)=>texture((c,w,h)=>{c.fillStyle=color;c.fillRect(0,0,w,h);c.fillStyle='#ffffff35';for(let a=0;a<5;a++)c.fillRect(a*110,0,3,h);c.fillStyle='#ffed97';c.beginPath();c.ellipse(w/2,h*.38,w*.36,h*.25,-.1,0,Math.PI*2);c.fill();c.fillStyle='#d33127';c.beginPath();c.ellipse(w/2,h*.38,w*.31,h*.16,-.1,0,Math.PI*2);c.fill();c.fillStyle='white';c.font='bold 78px Arial';c.textAlign='center';c.fillText('เลย์',w/2,h*.46);c.font='bold 27px Arial';c.fillText(['ORIGINAL','SEAWEED','HOT CHILI'][i],w/2,h*.7);c.fillStyle='#ffe5a0';for(let j=0;j<3;j++){c.beginPath();c.ellipse(170+j*70,210,65,25,j*.4,0,Math.PI*2);c.fill();}}));
  const chipMats=chipMaps.map(map=>new T.MeshStandardMaterial({map,roughness:.32}));
  const colaLabel=new T.MeshStandardMaterial({map:texture((c,w,h)=>{c.fillStyle='#c8202e';c.fillRect(0,0,w,h);c.fillStyle='white';c.font='italic bold 72px Georgia';c.textAlign='center';c.fillText('Cola',w/2,h*.55);c.font='24px Arial';c.fillText('เย็นสดชื่น · ORIGINAL',w/2,h*.78);}),roughness:.4});
  const sandwichMap=texture((c,w,h)=>{c.fillStyle='#f3dfac';c.fillRect(0,0,w,h);c.fillStyle='#dab071';c.beginPath();c.moveTo(0,h);c.lineTo(w/2,0);c.lineTo(w,h);c.closePath();c.fill();c.fillStyle='#f7e8ba';c.beginPath();c.moveTo(35,h-20);c.lineTo(w/2,45);c.lineTo(w-35,h-20);c.closePath();c.fill();c.fillStyle='#6e9d48';c.fillRect(50,h*.66,w-100,15);c.fillStyle='#dd8882';c.fillRect(70,h*.73,w-140,16);c.fillStyle='#f5c92e';c.fillRect(w*.2,h*.8,w*.6,h*.2);c.fillStyle='#375b37';c.font='bold 29px Arial';c.textAlign='center';c.fillText('แซนด์วิช',w/2,h*.92);});
  const sandwichMat=new T.MeshStandardMaterial({map:sandwichMap,roughness:.45});
  function product(type,x,y,z,rotation=0,index=0){
    const g=new T.Group();g.position.set(x,y,z);g.rotation.y=rotation;g.userData={type,available:true};scene.add(g);products.push(g);
    if(type==='chips'){const m=chipMats[index%3];const geo=new T.BoxGeometry(.25,.32,.1,4,8,2);const pos=geo.attributes.position;for(let n=0;n<pos.count;n++){const t=(pos.getY(n)+.16)/.32;pos.setX(n,pos.getX(n)*(.85+.15*Math.sin(t*Math.PI)));pos.setZ(n,pos.getZ(n)*(.35+.65*Math.sin(t*Math.PI)));}geo.computeVertexNormals();const b=new T.Mesh(geo,m);b.position.y=.16;g.add(b);b.rotation.z=(index%3-1)*.06;box(.26,.018,.105,0,.31,0,m,g);}
    if(type==='donut'){const base=new T.Mesh(new T.TorusGeometry(.095,.045,8,16),mat('#ce944e'));base.rotation.x=-Math.PI/2;base.position.y=.055;g.add(base);const icing=new T.Mesh(new T.TorusGeometry(.095,.038,8,16),mat(index%2?'#ed9aaf':'#624432'));icing.rotation.x=-Math.PI/2;icing.position.y=.078;g.add(icing);for(let j=0;j<12;j++){const a=j*2.399;const sprinkle=box(.025,.009,.009,Math.cos(a)*.092,.112,Math.sin(a)*.092,mat(['#f8db62','#f6efe1','#d870a0'][j%3]),g);sprinkle.rotation.y=a;}}
    if(type==='sandwich'){const shape=new T.Shape();shape.moveTo(-.14,0);shape.lineTo(.14,0);shape.lineTo(0,.29);shape.closePath();const geo=new T.ExtrudeGeometry(shape,{depth:.1,bevelEnabled:false});const m=new T.Mesh(geo,mat('#edcc8a'));m.position.z=-.05;g.add(m);box(.27,.28,.008,0,.14,.058,sandwichMat,g);}
    if(type==='cola'){cylinder(.057,.06,.23,0,.12,0,mat('#352420',.22),g);cylinder(.059,.059,.11,0,.13,0,colaLabel,g);cylinder(.028,.056,.075,0,.27,0,mat('#392925',.18),g);cylinder(.025,.025,.05,0,.325,0,mat('#c72b2b'),g);}
    g.traverse(o=>{if(o.isMesh){o.userData.product=g;o.castShadow=false;hitTargets.push(o);}});return g;
  }
  const packMats=['#a54331','#e0ae34','#459166','#4f87a0'].map((color,i)=>new T.MeshStandardMaterial({map:texture((c,w,h)=>{c.fillStyle=color;c.fillRect(0,0,w,h);c.fillStyle='#ffffff';c.fillRect(0,0,w,16);c.fillRect(0,h-16,w,16);c.font='bold 55px Arial';c.textAlign='center';c.fillText(['อร่อย','มาม่า','นมสด','ขนม'][i],w/2,80);c.font='24px Arial';c.fillText(['CRISPY SNACK','TOM YUM','FRESH MILK','SWEET BITES'][i],w/2,122);c.fillStyle='#f4d59b';c.beginPath();c.ellipse(w/2,190,95,36,0,0,Math.PI*2);c.fill();c.fillStyle='#fff8de';c.fillRect(w*.15,h-42,w*.7,16);}),roughness:.48}));
  // Two central double-sided gondolas, low enough to see department signs.
  for(const [cx,type] of [[3.05,'chips'],[6.75,'other']]){
    shelf(cx,5.4,1.1,4.8);box(.07,1.6,4.75,cx,.9,5.4,white,scene,true);
    for(let row=0;row<4;row++)for(let j=0;j<12;j++)for(const side of [-1,1]){
      const z=3.2+j*.38,y=.385+row*.37,x=cx+side*.35;
      if(type==='chips')product('chips',x,y,z,side*Math.PI/2,j+row);
      else{box(.18,.27,.26,x,y+.135,z,packMats[j%4]);}
      if(j%3===0)price(cx+side*.56,y-.025,z,side*Math.PI/2,type==='chips'?'20':'15');
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
  for(let r=0;r<3;r++){box(.85,.04,2,.67,.65+r*.32,9.3,steel,scene,true);for(let j=0;j<6;j++)product('donut',.87,.69+r*.32,8.49+j*.32,0,j+r);price(1.11,.64+r*.32,9.3,Math.PI/2,'25');}
  for(const z of [8.3,10.3])box(.85,1.05,.025,.67,1.13,z,glass);
  sign('โดนัท','ПОНЧИКИ · BAKERY',1.9,.42,1.11,1.91,9.3,Math.PI/2,'#76533e');
  // Rear fridges: accessible display fronts with slim frames and LED rails.
  box(9.5,2.2,.15,5,1.13,.28,dark,scene,true);box(9.5,.15,.8,5,.12,.65,dark,scene,true);
  for(let j=0;j<8;j++){
    const x=.85+j*1.18;for(let r=0;r<4;r++){
      box(1.15,.035,.65,x,.32+r*.4,.65,steel,scene,true);
      for(let c=0;c<5;c++){if(j<4)product('cola',x-.44+c*.21,.345+r*.4,.9,0,c);else{const m=mat(j%2?'#87bed1':'#ebae3c',.25);cylinder(.055,.06,.27,x-.44+c*.21,.485+r*.4,.86,m);cylinder(.035,.035,.035,x-.44+c*.21,.637+r*.4,.86,mat('#f0f3e9'));}}
      price(x,.30+r*.4,1.02,0,j<4?'20':'15');
    }
    box(.045,1.95,.05,x-.57,1.2,1.04,steel);box(.016,1.8,.02,x-.52,1.2,1.02,glow);
    box(.027,.35,.04,x+.48,1.17,1.04,steel);
  }
  sign('เครื่องดื่ม','НАПИТКИ · COLD DRINKS',8.9,.35,5,2.34,1.055);
  shelf(9.35,4.9,.8,4.4,4,2);box(.08,2,4.4,9.73,1.1,4.9,dark,scene,true);
  for(let r=0;r<4;r++)for(let j=0;j<13;j++)box(.28,.24,.22,9.24,.51+r*.37,2.9+j*.32,packMats[(j%2)+2]);
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
  const highlight=new T.BoxHelper(new T.Mesh(new T.BoxGeometry(.1,.1,.1)), '#ffe0a0');highlight.visible=false;scene.add(highlight);
  const ray=new T.Raycaster();ray.far=2.2;
  function target(){ray.setFromCamera(new T.Vector2(0,0),camera);const hits=ray.intersectObjects([...hitTargets.filter(o=>o.userData.product.userData.available),...blockers],false);const p=hits[0]?.object.userData.product;return p?.userData.available?p:null;}
  function resize(){renderer.setSize(innerWidth,innerHeight);camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();}resize();
  addEventListener('resize',resize);
  function render(player,yaw,pitch){camera.position.set(player.x,1.6,player.z);camera.rotation.set(pitch,yaw,0,'YXZ');renderer.render(scene,camera);renderer.shadowMap.autoUpdate=false;}
  return {scene,camera,renderer,products,render,target,highlight,restock(){for(const p of products){p.visible=true;p.userData.available=true;}},pick(p){p.visible=false;p.userData.available=false;highlight.visible=false;}};
}
