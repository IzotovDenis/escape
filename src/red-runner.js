import * as THREE from 'three';
import { createRedRunnerMotion } from './red-runner-motion.js';
import { createRedRunRig } from './red-runner-rig.js';

// Running uses opaque painted parts with articulated joints. The action
// illustrations retain their own pose correspondence for jumps and slides.
export async function createRedRunner(scene, runTexture) {
  const base = `${import.meta.env.BASE_URL}assets/`;
  const [atlas, metadataResponse, flowResponse, flipAtlas, flipMetadataResponse, flipFlowResponse] = await Promise.all([
    new THREE.TextureLoader().loadAsync(`${base}red-hoodie-actions.png`),
    fetch(`${base}red-motion.json`), fetch(`${base}red-motion.bin`),
    new THREE.TextureLoader().loadAsync(`${base}red-hoodie-flip.png`),
    fetch(`${base}red-flip.json`), fetch(`${base}red-flip.bin`),
  ]);
  if (!metadataResponse.ok || !flowResponse.ok || !flipMetadataResponse.ok || !flipFlowResponse.ok) throw new Error('Red runner motion could not load');
  const metadata = await metadataResponse.json();
  const flipMetadata = await flipMetadataResponse.json();
  const originalBytes = new Uint8Array(await flowResponse.arrayBuffer());
  const flipBytes = new Uint8Array(await flipFlowResponse.arrayBuffer());
  const bytes = new Uint8Array(originalBytes.length + flipBytes.length);
  bytes.set(originalBytes); bytes.set(flipBytes, originalBytes.length);
  const pairOffset = metadata.pairs.length;
  metadata.poses.push(...flipMetadata.poses);
  metadata.pairs.push(...flipMetadata.pairs.map(pair => ({ ...pair, index: pair.index + pairOffset })));
  const columns = 8, rows = Math.ceil(metadata.pairs.length / columns);
  const tile = metadata.flowSize, width = tile * columns;
  const packed = new Uint8Array(width * tile * rows * 4).fill(128);
  for (const { index } of metadata.pairs) {
    for (let y = 0; y < tile; y++) {
      const start = (index * tile * tile + y * tile) * 4;
      packed.set(bytes.subarray(start, start + tile * 4),
        ((Math.floor(index / columns) * tile + y) * width + index % columns * tile) * 4);
    }
  }
  const flow = new THREE.DataTexture(packed, width, rows * tile, THREE.RGBAFormat);
  flow.minFilter = flow.magFilter = THREE.LinearFilter;
  flow.needsUpdate = true;
  for (const texture of [atlas, flipAtlas]) {
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.minFilter = THREE.LinearFilter;
    texture.generateMipmaps = false;
  }
  const textures = { run: runTexture, actions: atlas, flip: flipAtlas };
  const poses = new Map(metadata.poses.map(pose => [pose.id, pose]));
  const pairs = new Map(metadata.pairs.map(pair => [`${pair.from}:${pair.to}`, pair.index]));
  // Only the three upright takeoff poses are used for jumping. Reuse their
  // correspondence in both directions; no inverted somersault pose is selected.
  for (let i = 0; i < 3; i++) poses.set(`jump${i}`, poses.get(`flip${i}`));
  const jumpAlias = id => /^flip[0-2]$/.test(id) ? id.replace('flip', 'jump') : id;
  for (const pair of metadata.pairs) {
    const from = jumpAlias(pair.from), to = jumpAlias(pair.to);
    if (from !== pair.from || to !== pair.to) pairs.set(`${from}:${to}`, pair.index);
  }
  const uniforms = {
    fromSheet: { value: runTexture }, toSheet: { value: runTexture }, flow: { value: flow },
    fromRect: { value: new THREE.Vector4() }, toRect: { value: new THREE.Vector4() },
    fromSize: { value: new THREE.Vector2() }, toSize: { value: new THREE.Vector2() },
    fromOffset: { value: new THREE.Vector2() }, toOffset: { value: new THREE.Vector2() },
    fromMirror: { value: 0 }, toMirror: { value: 0 },
    blend: { value: 0 }, flowCell: { value: new THREE.Vector2() },
    flowGrid: { value: new THREE.Vector2(columns, rows) },
    flowSize: { value: tile }, flowRange: { value: metadata.encodingRange * 2 },
    useFlow: { value: 0 }, reverseFlow: { value: 0 },
    hideFrom: { value: 0 }, hideTo: { value: 0 }, refineSlide: { value: 0 },
  };
  const material = new THREE.ShaderMaterial({
    uniforms, transparent: true, depthWrite: false, side: THREE.DoubleSide,
    vertexShader: `varying vec2 vUv;
      void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,
    fragmentShader: `
      uniform sampler2D fromSheet,toSheet,flow;
      uniform vec4 fromRect,toRect;
      uniform vec2 fromSize,toSize,fromOffset,toOffset,flowCell,flowGrid;
      uniform float blend,flowSize,flowRange,useFlow,reverseFlow,fromMirror,toMirror;
      uniform float hideFrom,hideTo,refineSlide;
      varying vec2 vUv;
      vec4 vectors(vec2 uv){
        vec2 padded=(clamp(uv,0.,1.)*(flowSize-1.)+.5)/flowSize;
        vec4 f=(texture2D(flow,(flowCell+padded)/flowGrid)-.5)*flowRange;
        return mix(f,f.zwxy,reverseFlow)*useFlow;
      }
      vec4 pose(sampler2D sheet,vec2 uv,vec4 rect,vec2 size,vec2 offset,float mirror){
        vec2 p=(uv-.5-offset)/size+.5;
        if(any(lessThan(p,vec2(0.)))||any(greaterThan(p,vec2(1.))))return vec4(0.);
        p.x=mix(p.x,1.-p.x,mirror);
        vec4 c=texture2D(sheet,rect.xy+p*rect.zw);
        c.a=smoothstep(.12,.84,c.a);
        return vec4(c.rgb*c.a,c.a);
      }
      void main(){
        vec2 a=vUv,b=vUv;
        // Invert the forward displacement, rather than dissolving two feet
        // or two heads at different positions. Two iterations stay inexpensive.
        a=vUv-vectors(a).xy*blend;
        a=vUv-vectors(a).xy*blend;
        b=vUv-vectors(b).zw*(1.-blend);
        b=vUv-vectors(b).zw*(1.-blend);
        if(refineSlide>.5){
          for(int i=0;i<6;i++){
            a=vUv-vectors(a).xy*blend;
            b=vUv-vectors(b).zw*(1.-blend);
          }
        }
        vec4 c=mix(pose(fromSheet,a,fromRect,fromSize,fromOffset,fromMirror)*(1.-hideFrom),
                   pose(toSheet,b,toRect,toSize,toOffset,toMirror)*(1.-hideTo),blend);
        if(c.a<.025)discard;
        gl_FragColor=vec4(c.rgb/max(c.a,.001),c.a);
        #include <colorspace_fragment>
      }`,
  });
  // A shallow curved surface gives lane changes a little parallax. Jump poses
  // keep the torso upright while the legs tuck and extend underneath it.
  const geometry = new THREE.PlaneGeometry(3.05, 3.05, 16, 16);
  const positions = geometry.attributes.position;
  for (let i = 0; i < positions.count; i++) {
    const x = positions.getX(i) / 1.525, y = positions.getY(i) / 1.525;
    positions.setZ(i, .13 * Math.max(0, 1 - x * x) * Math.max(0, 1 - y * y));
  }
  const root = new THREE.Group(), figure = new THREE.Mesh(geometry, material);
  const body = new THREE.Group();
  const runRig = createRedRunRig(flipAtlas, poses.get('flip0'));
  figure.frustumCulled = false;
  body.add(figure, runRig.root); root.add(body); scene.add(root);
  const motion = createRedRunnerMotion();
  let visualJump = 0, wasJumping = false, descent = null;
  function setPose(prefix, id) {
    const pose = poses.get(id);
    uniforms[`${prefix}Sheet`].value = textures[pose.texture];
    uniforms[`${prefix}Rect`].value.fromArray(pose.uvRect);
    uniforms[`${prefix}Size`].value.fromArray(pose.size);
    uniforms[`${prefix}Offset`].value.fromArray(pose.offset);
    uniforms[`${prefix}Mirror`].value = pose.mirror ? 1 : 0;
  }
  return {
    root,
    reset() { motion.reset(); visualJump = 0; wasJumping = false; descent = null; },
    update(dt, state) {
      const pose = motion.update(dt, state);
      if (state.moving) {
        // Down still changes collisions immediately, but the picture settles
        // over 90 ms instead of teleporting from the apex to the floor.
        if (wasJumping && !state.jumping && state.slide) descent = { height: visualJump, elapsed: 0 };
        if (state.jumping || state.menu) descent = null;
        if (descent) {
          descent.elapsed += dt;
          visualJump = descent.height * (1 - THREE.MathUtils.smoothstep(descent.elapsed, 0, .09));
          if (descent.elapsed >= .09) descent = null;
        } else visualJump = state.jump;
        wasJumping = state.jumping;
      }
      setPose('from', pose.from); setPose('to', pose.to);
      const direct = pairs.get(`${pose.from}:${pose.to}`);
      const reversed = pairs.get(`${pose.to}:${pose.from}`);
      const index = direct ?? reversed;
      const fromRun = /^run\d+$/.test(pose.from), toRun = /^run\d+$/.test(pose.to);
      const runWeight = (fromRun ? 1 - pose.mix : 0) + (toRun ? pose.mix : 0);
      runRig.root.visible = runWeight > .001;
      runRig.update(pose.runCycle);
      runRig.setOpacity(runWeight);
      figure.visible = runWeight < .999;
      uniforms.hideFrom.value = fromRun ? 1 : 0;
      uniforms.hideTo.value = toRun ? 1 : 0;
      uniforms.useFlow.value = index === undefined || fromRun || toRun ? 0 : 1;
      uniforms.refineSlide.value = pose.from.startsWith('action') && pose.to.startsWith('action') ? 1 : 0;
      uniforms.reverseFlow.value = direct === undefined && reversed !== undefined ? 1 : 0;
      uniforms.flowCell.value.set((index ?? 0) % columns, Math.floor((index ?? 0) / columns));
      uniforms.blend.value = pose.mix;
      const slide = pose.slideBlend;
      root.position.set(state.x, 1.32 + visualJump + pose.bounce - slide * .5 - pose.landing * .08, 2);
      root.rotation.set(0, pose.lean * 1.6, pose.lean);
      body.scale.set(1 + pose.landing * .025, 1 - slide * .25 - pose.landing * .04, 1);
      root.visible = state.visible !== false;
      root.userData.pose = pose;
      root.userData.jumpHeight = visualJump;
    },
  };
}
