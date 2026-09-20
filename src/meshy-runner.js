import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { createRedRunner } from './red-runner.js';

export async function createMeshyRunner(scene, runTexture) {
  const [red, gltf] = await Promise.all([
    createRedRunner(scene, runTexture),
    new GLTFLoader().loadAsync(`${import.meta.env.BASE_URL}assets/meshy-boy.glb`),
  ]);
  const root = new THREE.Group();
  const pivot = new THREE.Group();
  const model = gltf.scene;
  root.add(pivot); pivot.add(model); scene.add(root);
  model.updateMatrixWorld(true);
  const bounds = new THREE.Box3().setFromObject(model);
  const scale = 2.45 / bounds.getSize(new THREE.Vector3()).y;
  model.scale.setScalar(scale);
  model.position.set(-bounds.getCenter(new THREE.Vector3()).x * scale, -bounds.min.y * scale, 0);
  model.traverse(object => {
    if (object.isMesh) {
      object.frustumCulled = false;
      object.castShadow = true;
      object.receiveShadow = true;
    }
  });
  const mixer = new THREE.AnimationMixer(model);
  const actions = {};
  for (const source of gltf.animations) {
    const clip = source.clone();
    // The game owns travel and jump height; keep imported root motion in place.
    for (const track of clip.tracks) {
      if (track.name.includes('Hips') && track.name.endsWith('.position')) {
        for (let i = 0; i < track.values.length; i += 3) {
          track.values[i] = track.values[0];
          track.values[i + 2] = track.values[2];
          if (clip.name === 'Jump_Run') track.values[i + 1] = track.values[1];
        }
      }
    }
    actions[clip.name] = mixer.clipAction(clip);
  }
  actions.Jump_Run.setLoop(THREE.LoopOnce, 1);
  actions.Jump_Run.clampWhenFinished = true;
  let selected = 0, active, lean = 0;
  function play(name) {
    const next = actions[name];
    if (next === active) return;
    next.reset().play();
    if (active) next.crossFadeFrom(active, .16, false);
    active = next;
  }
  return {
    get root() { return selected === 1 ? red.root : root; },
    choose(value) { if (selected !== value) red.reset(); selected = value; },
    reset() { red.reset(); lean = 0; active?.stop(); active = undefined; },
    update(dt, state) {
      if (selected !== 0) {
        red.update(dt, state);
        root.visible = false;
        return;
      }
      red.root.visible = false;
      const { x, jump, slide, menu, moving, speed, laneError, visible } = state;
      root.visible = visible;
      play(menu ? 'Walking' : jump > 0 ? 'Jump_Run' : 'Running');
      active.timeScale = menu ? .55 : active === actions.Running ? speed / 16 : 1;
      if (moving && !slide) mixer.update(dt);
      if (moving) lean = THREE.MathUtils.damp(lean, menu ? 0 : THREE.MathUtils.clamp(-laneError * .08, -.18, .18), 14, dt);
      root.position.set(x, jump + (slide ? .45 : 0), 2);
      root.rotation.set(0, menu ? -.2 : Math.PI, 0);
      // No slide clip was supplied: recline the rig while the game handles sliding.
      pivot.rotation.set(slide ? -1.35 : 0, 0, slide ? 0 : lean);
    },
  };
}
