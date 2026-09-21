import './shop.css';
import { createShop } from './shop-world.js';
import { createAudio } from './audio.js';
import { CATEGORIES, newMission, movePlayer, collect, isComplete, totalItems, collectedItems, totalPrice } from './shop-logic.js';
const $=id=>document.getElementById(id), coarse=matchMedia('(pointer:coarse)').matches;
const audio=createAudio();let world,mode='welcome',mission,round=1,seconds=0,yaw=0,pitch=0,last=performance.now(),target=null,muted=false;
const player={x:5,z:10.7},keys=new Set();let toastTimer,drag=null,stickPointer=null,stickOrigin=null,axis={x:0,y:0};
try{muted=localStorage.getItem('shop-muted')==='true';}catch{}
audio.setMuted(muted);
function syncSound(){$('sound').textContent=muted?'♪̸':'♫';$('sound').setAttribute('aria-label',muted?'Включить звук':'Выключить звук');}
syncSound();
function chime(done=false){if(muted)return;void audio.unlock();(done?[523,659,784,1047]:[740,988]).forEach((frequency,i)=>audio.layer({frequency,delay:i*.09,duration:.2,volume:.06}));}
function toast(text){clearTimeout(toastTimer);$('toast').textContent=text;$('toast').classList.add('visible');toastTimer=setTimeout(()=>$('toast').classList.remove('visible'),2600);}
function clearControls(){keys.clear();drag=null;stickPointer=null;axis={x:0,y:0};$('stick').style.transform='';}
function unlock(){if(document.pointerLockElement)document.exitPointerLock();}
function lock(){if(coarse)return;try{const result=$('shop-world').requestPointerLock?.();result?.catch(()=>toast('Для обзора зажми мышь и двигай её.'));}catch{toast('Обзор: зажми мышь или используй стрелки.');}}
function setMode(value){mode=value;clearControls();const playing=value==='playing';$('welcome').hidden=value!=='welcome';$('hud').hidden=!playing;$('touch-controls').hidden=!playing||!coarse;$('map-button').hidden=!playing;$('pause-button').hidden=!playing;document.body.classList.toggle('playing',playing);if(!playing){unlock();if(world)world.highlight.visible=false;}}
function updateList(){
 $('round').textContent=String(round).padStart(2,'0');$('mission-name').textContent=mission.title;
 $('items').innerHTML=Object.entries(mission.needs).map(([id,n])=>`<div class="list-item ${mission.collected[id]>=n?'done':''}"><span class="food-icon">${CATEGORIES[id].icon}</span><span>${CATEGORIES[id].name}</span><b>${mission.collected[id]>=n?'✓ ':''}${mission.collected[id]} / ${n}</b></div>`).join('');
 $('progress').textContent=isComplete(mission)?'Всё собрано — к кассе!':`${collectedItems(mission)} из ${totalItems(mission)} собрано`;
 $('basket-count').textContent=`${collectedItems(mission)} / ${totalItems(mission)}`;
}
function start(next=false){
 if(!world)return;
 mission=newMission(next?mission.needs:null);seconds=0;if(!next){round=1;player.x=5;player.z=10.7;yaw=0;pitch=0;}else round++;
 world.restock();updateList();setMode('playing');void audio.unlock();chime();lock();toast(coarse?'Свайп — осмотреться. Подойди к товару и нажми «Взять».':'Найди товары по списку. Подойди, наведи и нажми E.');
}
const atCheckout=()=>Math.hypot(player.x-8.45,player.z-9.5)<1.15 && player.z<10;
function interact(){
 if(mode!=='playing')return;
 if(atCheckout()){
   if(!isComplete(mission)){toast('Сначала собери все продукты из списка.');return;}
   setMode('won');chime(true);$('win-copy').textContent=`Заказ №${round} · ${totalItems(mission)} покупок · ${formatTime(seconds)}`;
   $('receipt').innerHTML=Object.entries(mission.needs).map(([id,n])=>`<div><span>${CATEGORIES[id].name} × ${n}</span><b>${CATEGORIES[id].price*n} ฿</b></div>`).join('')+`<div><strong>Итого</strong><strong>${totalPrice(mission)} ฿</strong></div>`;
   $('win-dialog').showModal();return;
 }
 target=world.target();if(!target){toast('Подойди ближе и наведи точку на продукт.');return;}
 const id=target.userData.type,result=collect(mission,id);
 if(result==='unneeded'){toast('Этого продукта нет в твоём списке.');return;}
 if(result==='enough'){toast('Этого продукта уже достаточно.');return;}
 world.pick(target);target=null;updateList();chime();if(isComplete(mission))toast('Всё собрано! Касса справа от входа.');
}
function pause(){if(mode!=='playing')return;setMode('paused');$('pause-dialog').showModal();}
function resume(){if(mode!=='paused')return;$('pause-dialog').close();setMode('playing');lock();}
function home(){document.querySelectorAll('dialog[open]').forEach(d=>d.close());setMode('welcome');player.x=4.85;player.z=10.6;yaw=-.17;pitch=0;}
function openMap(){if(mode!=='playing')return;setMode('map');$('map-player').setAttribute('transform',`translate(${player.x*30} ${player.z*30}) rotate(${-yaw*180/Math.PI})`);$('map-dialog').showModal();}
function closeMap(){if(mode!=='map')return;$('map-dialog').close();setMode('playing');lock();}
function formatTime(s){return `${Math.floor(s/60)}:${String(Math.floor(s%60)).padStart(2,'0')}`;}
$('start').onclick=()=>start();$('interaction').onclick=interact;$('touch-take').onclick=interact;
$('pause-button').onclick=pause;$('resume').onclick=resume;$('go-home').onclick=home;$('finish').onclick=home;
$('next-mission').onclick=()=>{$('win-dialog').close();start(true);};$('map-button').onclick=openMap;$('close-map').onclick=closeMap;
$('concepts-button').onclick=()=>$('concepts-dialog').showModal();$('close-concepts').onclick=()=>$('concepts-dialog').close();
$('sound').onclick=()=>{muted=!muted;audio.setMuted(muted);syncSound();void audio.unlock();try{localStorage.setItem('shop-muted',String(muted));}catch{}};
$('pause-dialog').addEventListener('cancel',e=>{e.preventDefault();resume();});$('map-dialog').addEventListener('cancel',e=>{e.preventDefault();closeMap();});$('win-dialog').addEventListener('cancel',e=>e.preventDefault());
addEventListener('keydown',e=>{
 if(e.code==='Escape'){if(mode==='playing'){e.preventDefault();pause();}return;}
 if(mode==='map'&&e.code==='KeyM'){e.preventDefault();closeMap();return;}
 if(mode!=='playing')return;
 if(['KeyW','KeyA','KeyS','KeyD','ArrowUp','ArrowDown','ArrowLeft','ArrowRight','Space','KeyE','KeyM'].includes(e.code))e.preventDefault();
 keys.add(e.code);if(!e.repeat&&e.code==='KeyE')interact();if(!e.repeat&&e.code==='KeyM')openMap();
});addEventListener('keyup',e=>keys.delete(e.code));
addEventListener('blur',()=>{if(mode==='playing')pause();clearControls();});
document.addEventListener('visibilitychange',()=>{if(document.hidden&&mode==='playing')pause();});
document.addEventListener('pointerlockchange',()=>{if(!document.pointerLockElement&&mode==='playing'&&!coarse)pause();});
$('shop-world').addEventListener('pointerdown',e=>{if(mode!=='playing')return;drag={id:e.pointerId,x:e.clientX,y:e.clientY};$('shop-world').setPointerCapture(e.pointerId);if(e.pointerType==='mouse')lock();});
addEventListener('pointermove',e=>{
 if(mode!=='playing')return;
 if(document.pointerLockElement){yaw-=e.movementX*.0024;pitch-=e.movementY*.0024;}
 else if(drag&&drag.id===e.pointerId){yaw-=(e.clientX-drag.x)*.004;pitch-=(e.clientY-drag.y)*.004;drag.x=e.clientX;drag.y=e.clientY;}
 pitch=Math.max(-1.15,Math.min(.9,pitch));
});addEventListener('pointerup',e=>{if(drag?.id===e.pointerId)drag=null;});addEventListener('pointercancel',clearControls);
$('joystick').addEventListener('pointerdown',e=>{if(mode!=='playing')return;e.preventDefault();stickPointer=e.pointerId;const r=$('joystick').getBoundingClientRect();stickOrigin={x:r.left+r.width/2,y:r.top+r.height/2};$('joystick').setPointerCapture(e.pointerId);updateStick(e);});
function updateStick(e){if(e.pointerId!==stickPointer)return;let x=e.clientX-stickOrigin.x,y=e.clientY-stickOrigin.y;const length=Math.hypot(x,y);if(length>36){x*=36/length;y*=36/length;}axis={x:x/36,y:-y/36};$('stick').style.transform=`translate(${x}px,${y}px)`;}
$('joystick').addEventListener('pointermove',updateStick);$('joystick').addEventListener('pointerup',()=>{stickPointer=null;axis={x:0,y:0};$('stick').style.transform='';});
function tick(now){
 const dt=Math.min((now-last)/1000,.045);last=now;
 if(mode==='playing'){
   seconds+=dt;
   let forward=(keys.has('KeyW')||keys.has('ArrowUp')?1:0)-(keys.has('KeyS')||keys.has('ArrowDown')?1:0)+axis.y;
   let strafe=(keys.has('KeyD')?1:0)-(keys.has('KeyA')?1:0)+axis.x;
   if(keys.has('ArrowLeft'))yaw+=dt*1.65;if(keys.has('ArrowRight'))yaw-=dt*1.65;
   const len=Math.max(1,Math.hypot(forward,strafe)),speed=(keys.has('ShiftLeft')||keys.has('ShiftRight')?3.5:2.15)*dt;
   forward/=len;strafe/=len;movePlayer(player,(-Math.sin(yaw)*forward+Math.cos(yaw)*strafe)*speed,(-Math.cos(yaw)*forward-Math.sin(yaw)*strafe)*speed);
   $('elapsed').textContent=formatTime(seconds);
   $('location').textContent=atCheckout()?'Касса':player.z<2.5?'Холодные напитки':player.x<2&&player.z<7.8?'Сэндвичи':player.x<2&&player.z>8?'Пончики':player.z>8?'У входа':player.x<5?'Чипсы и снеки':'Сладости и готовая еда';
 }
 if(world){world.render(player,yaw,pitch);if(mode==='playing'){
   target=world.target();world.highlight.visible=!!target;if(target)world.highlight.setFromObject(target);
   const checkout=atCheckout();$('interaction').hidden=!target&&!checkout;$('touch-take').disabled=!target&&!checkout;
   const label=checkout?(isComplete(mission)?'Завершить покупки':'Проверить список'):target?`Взять · ${CATEGORIES[target.userData.type].name}`:'';
   $('interaction').textContent=(coarse?'':'E · ')+label;$('touch-take').textContent=checkout?'Касса':'Взять';
 }}
 requestAnimationFrame(tick);
}
try{world=createShop($('shop-world'));home();requestAnimationFrame(tick);}catch(error){console.error(error);$('start').disabled=true;$('load-error').hidden=false;$('load-error').textContent='Не удалось запустить 3D. Открой игру в браузере с WebGL 2 и включённым аппаратным ускорением.';}

// Development-only browser verification, excluded from production builds.
if(import.meta.env.DEV && new URLSearchParams(location.search).has('verify')) {
  window.shopVerify={
    state:()=>({mode,player:{...player},yaw,pitch,round,seconds,mission:JSON.parse(JSON.stringify(mission??null)),target:world?.target()?.userData.type,products:world?.products.filter(p=>p.userData.available).map(p=>({type:p.userData.type,x:p.position.x,y:p.position.y,z:p.position.z}))}),
    pose:(x,z,lookX,lookY,lookZ)=>{player.x=x;player.z=z;const dx=lookX-x,dz=lookZ-z;yaw=Math.atan2(-dx,-dz);pitch=Math.atan2(lookY-1.6,Math.hypot(dx,dz));world.render(player,yaw,pitch);},
  };
}
