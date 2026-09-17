import * as THREE from 'three';

// Use the detailed ImageGen character artwork for both menu and gameplay.
// Front/back rows retain each boy's identity; sliding has its own pose atlas.
export function createAquaRunner(scene, runTexture, slideTexture) {
  const root = new THREE.Group();
  scene.add(root);
  const uniforms = {
    sheet: { value: runTexture },
    frame: { value: 0 },
    rows: { value: 4 },
    mirror: { value: 0 },
  };
  const material = new THREE.ShaderMaterial({
    uniforms, transparent: true, side: THREE.DoubleSide,
    vertexShader: `varying vec2 vUv;
      void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,
    fragmentShader: `uniform sampler2D sheet;uniform float frame;uniform float rows;uniform float mirror;varying vec2 vUv;
      void main(){
        float row=floor(frame/4.);
        // ImageGen rows have unequal heights; sample their actual boundaries.
        float top=rows==2.?(row<1.?0.:520./1024.):(row<1.?0.:row<2.?340./1254.:row<3.?680./1254.:970./1254.);
        float bottom=rows==2.?(row<1.?520./1024.:1.):(row<1.?340./1254.:row<2.?680./1254.:row<3.?970./1254.:1.);
        vec2 uv=vec2((mod(frame,4.)+clamp(mix(vUv.x,1.-vUv.x,mirror),.006,.994))/4.,
          mix(1.-bottom,1.-top,clamp(vUv.y,.012,.988)));
        vec4 c=texture2D(sheet,uv);
        float alpha=c.a*(1.-smoothstep(.10,.34,c.g-max(c.r,c.b)));
        if(alpha<.7)discard;
        c.g=min(c.g,max(c.r,c.b)+.025);
        gl_FragColor=vec4(c.rgb,alpha);
        #include <colorspace_fragment>
      }`,
  });
  const figure = new THREE.Mesh(new THREE.PlaneGeometry(2.7, 2.7), material);
  figure.frustumCulled = false;
  root.add(figure);
  let skin = 0, phase = 0, lean = 0;
  function choose(value) { skin = value; phase = 0; }
  function update(dt, { x, jump, slide, menu, moving, speed, laneError, visible = true }) {
    if (moving) {
      phase += dt * (menu ? 4 : 8 + (speed - 16) * .18);
      lean += ((menu || slide ? 0 : THREE.MathUtils.clamp(-laneError * .045, -.08, .08)) - lean) * (1 - Math.exp(-dt * 14));
    }
    uniforms.sheet.value = slide ? slideTexture : runTexture;
    uniforms.rows.value = slide ? 2 : 4;
    const step = Math.floor(phase) % 8;
    const running = !slide && !menu && jump <= 0;
    // The source poses favor one leg. Reflect the second half of each stride
    // so left and right feet take turns, with a return pose between contacts.
    uniforms.mirror.value = running && step >= 4 ? 1 : 0;
    uniforms.frame.value = (slide || menu ? skin * 4 : 8 + skin * 4)
      + (running ? [0,1,2,1][step % 4] : Math.floor(phase) % 4);
    const bounce = running ? .045 * (1 - Math.cos(phase * Math.PI)) : 0;
    root.position.set(x, slide ? .14 : 1.35 + jump + bounce, slide ? .8 : 2);
    root.rotation.set(slide ? -Math.PI / 2 : 0, 0, slide ? 0 : lean + (running ? Math.sin(phase * Math.PI / 4) * .018 : 0));
    figure.scale.set(slide ? 1.05 : 1, slide ? 1.25 : 1, 1);
    root.visible = visible;
  }
  return { root, choose, update };
}
