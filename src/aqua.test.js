import test from 'node:test';
import assert from 'node:assert/strict';
import { newRun, action, tick, hits, row, trackOffset, height, swipeAction } from './aqua-logic.js';
test('jump clears rings, slide clears arches, jump also clears flamingos',()=>{const r=newRun();assert.equal(hits(r,{lane:1,kind:'ring'}),true);action(r,'jump');tick(r,.45);assert.equal(hits(r,{lane:1,kind:'ring'}),false);assert.equal(hits(r,{lane:1,kind:'flamingo'}),false);tick(r,.5);action(r,'slide');assert.equal(hits(r,{lane:1,kind:'arch'}),false);assert.equal(hits(r,{lane:1,kind:'ring'}),true);});
test('lane changes stay on track and obstacle rows always have a safe lane',()=>{const r=newRun();for(let i=0;i<5;i++)action(r,'left');assert.equal(r.lane,0);tick(r,.1);assert.equal(hits(r,{lane:1,kind:'flamingo'}),false);for(let i=0;i<500;i++){const pattern=row();assert.equal(pattern.obstacles.length,2);assert.ok(pattern.obstacles.every(o=>o.lane!==pattern.safe));}});
test('restart resets protection, collectibles and movement; speed stays capped',()=>{const r=newRun();r.shield=false;r.coins=18;action(r,'jump');const fresh=newRun();assert.equal(fresh.shield,true);assert.equal(fresh.coins,0);assert.equal(fresh.jump,0);fresh.distance=100000;tick(fresh,.016);assert.equal(fresh.speed,34);});

test('gentle start accelerates gradually to a bounded top speed',()=>{
 const r=newRun();assert.equal(r.speed,16);
 let previous=r.speed;
 for(let i=0;i<6000;i++){tick(r,1/60);assert.ok(r.speed>=previous);assert.ok(r.speed-previous<.006);assert.ok(r.speed<=34);previous=r.speed;}
 assert.ok(r.speed>30);
});
test('fixed route enters from the distance, with a tangent aligned at the runner',()=>{
 assert.equal(trackOffset(0,0),0);
 assert.ok(Math.abs(trackOffset(0,100))>1);
 for(let d=0;d<3000;d+=5){
  assert.equal(trackOffset(d,0),0);
  assert.ok(Math.abs(trackOffset(d,.01))<.000001);
  // Three fixed world points retain their relative curvature as the player moves.
  const curvature=(distance,shift)=>trackOffset(distance,100-shift)-2*trackOffset(distance,70-shift)+trackOffset(distance,40-shift);
  assert.ok(Math.abs(curvature(d,0)-curvature(d+2,2))<1e-10);
  assert.ok(Math.abs(trackOffset(d,80))<8);
 }
});

test('flamingos allow forgiving jump timing throughout the collision window',()=>{
 for(const speed of [16,25,34])for(const lead of [.22,.35,.5,.6]){
  const r=newRun();action(r,'jump');
  // Entire front-to-back collision interval, including early and late jumps.
  for(let offset=-1.05/speed;offset<=1.05/speed;offset+=.005){
   r.jump=.9-(lead+offset);
   assert.equal(hits(r,{lane:1,kind:'flamingo'}),false,`speed ${speed}, lead ${lead}, offset ${offset}`);
  }
 }
 const grounded=newRun();assert.equal(hits(grounded,{lane:1,kind:'flamingo'}),true);
 action(grounded,'slide');assert.equal(hits(grounded,{lane:1,kind:'flamingo'}),true);
});

test('down immediately lands at every jump phase and up interrupts sliding',()=>{
 for(const elapsed of [.05,.25,.45,.75]){
  const r=newRun();action(r,'jump');tick(r,elapsed);assert.ok(height(r)>0);
  action(r,'slide');assert.equal(height(r),0);assert.equal(r.jump,0);assert.equal(r.slide,.85);
  assert.equal(hits(r,{lane:1,kind:'arch'}),false);
  action(r,'jump');assert.equal(r.slide,0);tick(r,.05);assert.ok(height(r)>0);
 }
});
test('lane movement responds in one frame and can reverse mid-jump',()=>{
 const r=newRun();action(r,'jump');action(r,'right');tick(r,1/60);assert.ok(r.x>1);
 action(r,'left');action(r,'left');tick(r,.08);assert.ok(r.x < -2.7);assert.ok(r.jump>0);
});
test('swipes fire during movement once, with small jitter ignored',()=>{
 for(const [x,y,expected] of [[14,0,'right'],[-14,2,'left'],[1,-14,'jump'],[2,14,'slide']]){
  const gesture={x:100,y:100,fired:false};
  assert.equal(swipeAction(gesture,105,104),null);
  assert.equal(swipeAction(gesture,100+x,100+y),expected);
  assert.equal(swipeAction(gesture,100+x*3,100+y*3),null);
 }
 assert.equal(swipeAction(null,0,0),null);
});
