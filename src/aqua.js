import './aqua.css';
import * as THREE from 'three';
import { createAquaRunner } from './aqua-runner.js';
import { createObstacleFactory } from './aqua-obstacles.js';
import { createSunnyPark } from './aqua-sunny.js';
import { newRun, action, tick, height, hits, row, trackOffset, trackShader, swipeAction } from './aqua-logic.js';
const $ = id => document.getElementById(id);
let state = 'menu', run = newRun(), skin = 0, best = 0, muted = false, audio, items = [], spawn = 0, last = 0, time = 0, toastUntil = 0;
try { best = Number(localStorage.getItem('aqua-best')) || 0; skin = Number(localStorage.getItem('aqua-skin')) === 1 ? 1 : 0; } catch {}
$('best').textContent = `${best} м`;
function beep(frequency = 700) { if(muted) return; try { audio ??= new AudioContext(); void audio.resume(); const o=audio.createOscillator(),g=audio.createGain();o.connect(g);g.connect(audio.destination);o.frequency.setValueAtTime(frequency,audio.currentTime);o.frequency.exponentialRampToValueAtTime(frequency*.6,audio.currentTime+.12);g.gain.setValueAtTime(.035,audio.currentTime);g.gain.exponentialRampToValueAtTime(.001,audio.currentTime+.16);o.start();o.stop(audio.currentTime+.17); }catch{} }
function toast(s) { $('toast').textContent=s;$('toast').classList.add('show');toastUntil=time+2.3; }
const renderer = new THREE.WebGLRenderer({canvas:$('aqua-scene'),antialias:true});
renderer.setPixelRatio(Math.min(devicePixelRatio,1.7));renderer.setClearColor('#a8e4e9');renderer.outputColorSpace=THREE.SRGBColorSpace;
const scene=new THREE.Scene();scene.fog=new THREE.Fog('#a8e4e9',48,130);
const camera=new THREE.PerspectiveCamera(55,1,.1,180);
scene.add(new THREE.HemisphereLight(0xfff5dc,0x277b85,1.65));const sun=new THREE.DirectionalLight(0xfff1d1,2.1);sun.position.set(-8,20,8);scene.add(sun);
const bend={value:0};
const bendVertex=`vec4 bentWorld = modelMatrix * vec4(transformed, 1.0);
float ahead = max(0.0, 2.0 - bentWorld.z);
bentWorld.x += routeOffset(ahead);
vec4 mvPosition = viewMatrix * bentWorld;
gl_Position = projectionMatrix * mvPosition;`;
const mats=new Map();function material(color){if(!mats.has(color)){
 const mat=new THREE.MeshStandardMaterial({color,roughness:.46});
 mat.onBeforeCompile=shader=>{shader.uniforms.trackBend=bend;shader.vertexShader=trackShader+shader.vertexShader.replace('#include <project_vertex>',bendVertex);};
 mat.customProgramCacheKey=()=> 'aqua-curved-track-v1';mats.set(color,mat);
}return mats.get(color)}
const roadCube=new THREE.BoxGeometry(1,1,1,1,1,100);
const cube=new THREE.BoxGeometry(1,1,1),ball=new THREE.SphereGeometry(1,16,12),torus=new THREE.TorusGeometry(.78,.24,10,24),iceCone=new THREE.ConeGeometry(.23,.65,10);
function mesh(group,geo,color,x,y,z,sx=1,sy=sx,sz=sx){const m=new THREE.Mesh(geo===cube&&sz>25?roadCube:geo,material(color));m.frustumCulled=false;m.position.set(x,y,z);m.scale.set(sx,sy,sz);group.add(m);return m}
let park;
const loader=new THREE.TextureLoader();let runnerTexture,slideTexture,runner,shield;
let buildObstacle;
const spray=new THREE.Group();scene.add(spray);
for(let i=0;i<12;i++)mesh(spray,ball,i%2?'#e9ffff':'#76e3f3',0,0,0,.09);
function choose(n){skin=n;document.querySelectorAll('[data-skin]').forEach(b=>{b.classList.toggle('chosen',Number(b.dataset.skin)===n);b.setAttribute('aria-pressed',String(Number(b.dataset.skin)===n));});if(runner)runner.choose(n);try{localStorage.setItem('aqua-skin',String(n));}catch{}}
document.querySelectorAll('[data-skin]').forEach(b=>b.onclick=()=>choose(Number(b.dataset.skin)));
async function init(){
 const loaded=await Promise.all([
 loader.loadAsync(`${import.meta.env.BASE_URL}assets/sunny-runners-volume.png`),
 loader.loadAsync(`${import.meta.env.BASE_URL}assets/sunny-slide-volume.png`),
 createSunnyPark(scene,renderer,bend,material),
 loader.loadAsync(`${import.meta.env.BASE_URL}assets/sunny-obstacles.png`)
 ]);
 [runnerTexture,slideTexture,park]=loaded;
 const obstacleArt=loaded[3];obstacleArt.colorSpace=THREE.SRGBColorSpace;
 buildObstacle=createObstacleFactory(material,bend,obstacleArt);
 for(const t of [runnerTexture,slideTexture]){t.colorSpace=THREE.SRGBColorSpace;t.minFilter=THREE.LinearFilter;t.generateMipmaps=false;}
 document.querySelectorAll('.skins canvas').forEach((canvas,i)=>{
 const ctx=canvas.getContext('2d');const im=runnerTexture.image;
 ctx.clearRect(0,0,canvas.width,canvas.height);
 ctx.drawImage(im,0,i*340/1254*im.height,im.width/4,340/1254*im.height,-15,0,180,180);
 });
 runner=createAquaRunner(scene,runnerTexture,slideTexture);
 park.resize(camera.aspect);
 shield=mesh(scene,torus,'#ffc94f',0,.7,2,1.03);shield.rotation.x=Math.PI/2;
 choose(skin);$('start').disabled=false;$('start').textContent='Погнали! →';
}
function makeItem(kind,lane,z){const g=buildObstacle(kind);g.position.set((lane-1)*3,0,z);scene.add(g);items.push({kind,lane,z,mesh:g,done:false});}
function clear(){for(const i of items)scene.remove(i.mesh);items=[];}
function start(){clear();run=newRun();spawn=0;state='playing';$('menu').hidden=true;$('overlay').hidden=true;$('hud').hidden=false;$('touch').hidden=false;$('footer').hidden=true;beep();toast('← → обходи · ↑ круги и фламинго · ↓ арки');}
function pause(){if(state!=='playing')return;state='paused';$('overlay').hidden=false;$('touch').hidden=true;$('result-title').textContent='На паузе';$('result-copy').textContent='Вода подождёт. Отдохни и продолжай.';$('result-label').textContent='МОЖНО ВЫДОХНУТЬ';$('resume').hidden=false;$('resume').focus();}
function end(){state='ended';beep(160);const d=Math.floor(run.distance);if(d>best){best=d;try{localStorage.setItem('aqua-best',String(best));}catch{}}$('best').textContent=`${best} м`;$('overlay').hidden=false;$('touch').hidden=true;$('result-label').textContent='ВОТ ЭТО ЗАПЛЫВ!';$('result-title').textContent=`${d} метров`;$('result-copy').textContent=`Мороженое: ${run.coins} · Рекорд: ${best} м`;$('resume').hidden=true;$('retry').focus();}
$('start').onclick=start;$('retry').onclick=start;$('pause').onclick=pause;$('resume').onclick=()=>{state='playing';$('overlay').hidden=true;$('touch').hidden=false;};$('home').onclick=()=>{state='menu';clear();run=newRun();$('menu').hidden=false;$('overlay').hidden=true;$('hud').hidden=true;$('touch').hidden=true;$('footer').hidden=false;$('start').focus();};
$('sound').onclick=()=>{muted=!muted;$('sound').textContent=muted?'♪̸':'♫';$('sound').setAttribute('aria-label',muted?'Включить звук':'Выключить звук');};
function input(name){if(state==='playing'){action(run,name);if(name==='jump')beep(450);}}
addEventListener('keydown',e=>{const a={ArrowLeft:'left',a:'left',ArrowRight:'right',d:'right',ArrowUp:'jump',w:'jump',' ':'jump',ArrowDown:'slide',s:'slide'}[e.key];if(a&&state==='playing'){e.preventDefault();if(!e.repeat)input(a);}if(e.key==='Escape'){if(state==='playing')pause();else if(state==='paused')$('resume').click();}});
document.querySelectorAll('[data-action]').forEach(b=>b.onpointerdown=e=>{e.preventDefault();input(b.dataset.action);});
let gesture;const canvas=$('aqua-scene');
canvas.onpointerdown=e=>{
 if(state!=='playing'||gesture||e.isPrimary===false||e.button!==0)return;
 e.preventDefault();gesture={x:e.clientX,y:e.clientY,id:e.pointerId,fired:false};
 canvas.setPointerCapture(e.pointerId);
};
function moveGesture(e){
 if(!gesture||gesture.id!==e.pointerId)return;
 if(state!=='playing'){gesture=null;return;}
 e.preventDefault();const command=swipeAction(gesture,e.clientX,e.clientY);
 if(command)input(command);
}
canvas.onpointermove=moveGesture;
canvas.onpointerup=e=>{
 if(!gesture||gesture.id!==e.pointerId)return;
 moveGesture(e);gesture=null;
 if(canvas.hasPointerCapture(e.pointerId))canvas.releasePointerCapture(e.pointerId);
};
canvas.onpointercancel=canvas.onlostpointercapture=e=>{if(gesture?.id===e.pointerId)gesture=null;};
addEventListener('blur',()=>{gesture=null;pause();});document.addEventListener('visibilitychange',()=>{if(document.hidden)pause();});
function resize(){renderer.setSize(innerWidth,innerHeight);camera.aspect=innerWidth/innerHeight;camera.fov=camera.aspect<.8?70:55;camera.updateProjectionMatrix();park?.resize(camera.aspect);}addEventListener('resize',resize);resize();
function frame(now){requestAnimationFrame(frame);const dt=Math.min((now-last)/1000||0,.04);last=now;time+=dt;
 if(state==='playing'){
 tick(run,dt);spawn-=run.speed*dt;
 if(spawn<=0){const r=row();for(const o of r.obstacles)makeItem(o.kind,o.lane,-72);for(let j=0;j<4;j++)makeItem('coin',r.safe,-72-j*2.2);if(Math.random()<.17)makeItem('shield',r.safe,-84);spawn=Math.max(22,run.speed*.95);}
 for(const item of items){item.z+=run.speed*dt;item.mesh.position.z=item.z;if(item.kind==='shield')item.mesh.rotation.y+=dt*2;
 if(item.kind==='coin'){item.mesh.position.y=Math.sin(time*3+item.z*.08)*.10;item.mesh.rotation.z=Math.sin(time*2+item.z*.05)*.06;}
 if(!item.done&&Math.abs(item.z-2)<1.05){if(item.kind==='coin'||item.kind==='shield'){if(Math.abs(run.x-(item.lane-1)*3)<1.1){item.done=true;item.mesh.visible=false;if(item.kind==='coin'){run.coins++;beep(900+run.coins%4*100);}else{run.shield=true;toast('Защитный круг!');beep(650);}}}else if(hits(run,item)&&run.invincible<=0){item.done=true;if(run.shield){run.shield=false;run.invincible=1.8;item.mesh.visible=false;toast('Круг спас! Продолжай!');beep(220);}else{end();break;}}}}
 const expired=items.filter(i=>i.z>12);for(const i of expired)scene.remove(i.mesh);items=items.filter(i=>i.z<=12);
 $('distance').textContent=`${Math.floor(run.distance)} м`;$('coins').textContent=run.coins;$('power').textContent=run.shield?'◯ Круг защитит один раз':'Без защиты — ищи жёлтый круг';
 }
 bend.value=run.distance;
 const moving=state==='playing'||state==='menu';
 park?.update(dt,state==='menu'?-2:run.speed,moving,run.x,height(run),state==='menu');
 if(runner){
   const sliding=state!=='menu'&&run.slide>0;
   const slideProgress=.85-run.slide;
   runner.update(dt,{x:state==='menu'?2.5:run.x,jump:height(run),slide:sliding,menu:state==='menu',moving,speed:run.speed,laneError:(run.lane-1)*3-run.x,visible:run.invincible<=0||state!=='playing'||Math.floor(time*14)%2===0});
   shield.position.set(runner.root.position.x,sliding?.3:.65+height(run),sliding?1.3:2);shield.visible=state!=='menu'&&run.shield&&!sliding;
   spray.visible=sliding;
   spray.position.set(run.x,0,1.4);
   spray.children.forEach((drop,i)=>{const phase=(slideProgress*3+i/12)%1;drop.position.set((i%2?1:-1)*(.45+phase*.9),.1+Math.sin(phase*Math.PI)*.3,phase*2);drop.scale.setScalar(.1*(1-phase)+.025);});
 }
 camera.position.set(state==='menu'?4:0,state==='menu'?7:camera.aspect<.8?8.6:5.8,state==='menu'?15:camera.aspect<.8?19:12.5);camera.lookAt(state==='menu'?-3:trackOffset(run.distance,17)*.2,.7,-15);
 const targetFov=(camera.aspect<.8?70:55)+(state==='menu'?0:(run.speed-16)*.3);
 if(Math.abs(camera.fov-targetFov)>.01){camera.fov+=(targetFov-camera.fov)*Math.min(1,dt*4);camera.updateProjectionMatrix();}
 if(time>toastUntil)$('toast').classList.remove('show');scene.traverse(object=>{if(object.isMesh)object.frustumCulled=false;});renderer.render(scene,camera);
}
init().catch(e=>{$('load-status').textContent='Не удалось загрузить персонажей. Обнови страницу.';console.error(e);});requestAnimationFrame(frame);

// Keep installed copies on the same current navigation cache as the school game.
if(import.meta.env.PROD && 'serviceWorker' in navigator){navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`).then(r=>r.update()).catch(console.error);}
