import * as THREE from 'three';

// A small cutout rig made from flip0 in red-hoodie-flip.png. Every visible
// fragment samples one unchanged painted image; there are no image dissolves,
// optical-flow warps, generated bitmaps, or independent animation clocks.
//
// Integration:
//   const rig = createRedRunRig(flipAtlas, flip0Metadata);
//   characterRoot.add(rig.root);
//   rig.update(fullStrideCycle); // 0..1, same cycle as the motion controller
//   rig.setOpacity(runWeight);   // 1 for normal running, 0 hides the cutout
// CharacterRoot still owns world position, bounce, leaning and landing scale.
export function createRedRunRig(texture, poseMetadata) {
  const { uvRect, size, offset } = poseMetadata;
  const imageWidth = texture.image.width, imageHeight = texture.image.height;
  const cropLeft = uvRect[0] * imageWidth;
  const cropTop = (1 - uvRect[1] - uvRect[3]) * imageHeight;
  const cropWidth = uvRect[2] * imageWidth, cropHeight = uvRect[3] * imageHeight;
  const figureSize = 3.05;
  // Anatomical landmarks are source-image pixels in the first upright pose.
  // The complete left sleeve/hand also supplies the other arm, mirrored at the
  // shoulder, because the original right forearm is partly hidden by the body.
  const centerX = 144;
  const root = new THREE.Group();
  root.name = 'red-painted-run-rig';
  root.userData.restPivot = new THREE.Vector3();
  const uniforms = { sheet: { value: texture }, opacity: { value: 1 } };
  const material = new THREE.ShaderMaterial({
    uniforms,
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    vertexShader: `varying vec2 vUv;
      void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,
    fragmentShader: `uniform sampler2D sheet;uniform float opacity;varying vec2 vUv;
      void main(){
        vec4 c=texture2D(sheet,vUv);
        c.a=smoothstep(.12,.84,c.a)*opacity;
        if(c.a<.025)discard;
        gl_FragColor=c;
        #include <colorspace_fragment>
      }`,
  });
  const geometries = [];

  function point([x, y], mirror = false) {
    const px = mirror ? 2 * centerX - x : x;
    return new THREE.Vector3(
      figureSize * (offset[0] + ((px - cropLeft) / cropWidth - .5) * size[0]),
      figureSize * (offset[1] + (.5 - (y - cropTop) / cropHeight) * size[1]),
      0,
    );
  }

  function part(name, outline, pivot, parent, order, mirror = false) {
    const anchor = point(pivot, mirror);
    const shape = new THREE.Shape(outline.map(pixel => {
      const vertex = point(pixel, mirror).sub(anchor);
      return new THREE.Vector2(vertex.x, vertex.y);
    }));
    const geometry = new THREE.ShapeGeometry(shape);
    const positions = geometry.attributes.position, uv = geometry.attributes.uv;
    for (let i = 0; i < positions.count; i++) {
      const x = positions.getX(i) + anchor.x, y = positions.getY(i) + anchor.y;
      let px = cropLeft + (x / figureSize - offset[0] + size[0] / 2) / size[0] * cropWidth;
      const py = cropTop + (.5 - (y / figureSize - offset[1]) / size[1]) * cropHeight;
      if (mirror) px = 2 * centerX - px;
      uv.setXY(i, px / imageWidth, 1 - py / imageHeight);
    }
    geometries.push(geometry);
    const group = new THREE.Group();
    group.name = name;
    group.userData.restPivot = anchor;
    group.position.copy(anchor).sub(parent.userData.restPivot);
    const mesh = new THREE.Mesh(geometry, material);
    mesh.name = `${name}-paint`;
    mesh.frustumCulled = false;
    mesh.renderOrder = order;
    group.add(mesh);
    parent.add(group);
    return { group, mesh };
  }

  // Shorts cover the hip cuts. The two knee pieces overlap by about 12 source
  // pixels, so bending a calf never opens a transparent slit through the joint.
  const leftThigh = part('left-thigh', [
    [105, 190], [144, 190], [144, 219], [140, 236], [113, 240], [106, 224],
  ], [126, 200], root, 20);
  const leftCalf = part('left-calf', [
    [107, 220], [143, 220], [143, 237], [140, 240], [109, 240], [105, 236],
  ], [125, 228], leftThigh.group, 19);
  const leftShoe = part('left-shoe', [
    [105, 237], [143, 237], [145, 260], [145, 294], [98, 294], [101, 250],
  ], [125, 246], leftCalf.group, 21);
  const rightThigh = part('right-thigh', [
    [144, 190], [184, 190], [184, 221], [178, 239], [149, 240], [143, 224],
  ], [163, 200], root, 10);
  const rightCalf = part('right-calf', [
    [143, 220], [180, 220], [181, 237], [177, 240], [146, 240], [142, 236],
  ], [163, 228], rightThigh.group, 9);
  const rightShoe = part('right-shoe', [
    [143, 237], [181, 237], [185, 250], [188, 294], [143, 294], [141, 250],
  ], [163, 246], rightCalf.group, 11);

  const torso = part('hoodie-and-shorts', [
    [109, 103], [178, 103], [181, 124], [180, 143], [185, 172],
    [188, 184], [183, 211], [146, 213], [106, 211], [100, 184],
    [103, 167], [108, 147], [109, 124],
  ], [144, 188], root, 40);
  const sleeve = [
    [111, 112], [121, 128], [112, 144], [101, 159], [89, 181],
    [51, 185], [51, 153], [76, 132], [92, 116],
  ];
  const leftArm = part('left-sleeve-and-hand', sleeve, [109, 124], torso.group, 30);
  const rightArm = part('right-sleeve-and-hand', sleeve, [109, 124], torso.group, 31, true);
  // The neck cut sits underneath the raised hood; the head has a small counter
  // motion while the shoulders turn, keeping the face/hair shape fully sharp.
  const head = part('head', [
    [86, 8], [211, 8], [211, 106], [187, 113], [165, 116],
    [128, 116], [107, 112], [86, 105],
  ], [145, 109], torso.group, 50);

  const legs = [
    { hip: leftThigh.group, knee: leftCalf.group, ankle: leftShoe.group, thigh: leftThigh.mesh, calf: leftCalf.mesh, shoe: leftShoe.mesh, side: -1 },
    { hip: rightThigh.group, knee: rightCalf.group, ankle: rightShoe.group, thigh: rightThigh.mesh, calf: rightCalf.mesh, shoe: rightShoe.mesh, side: 1 },
  ];
  const pixelHeight = figureSize * size[1] / cropHeight;
  const thighLength = 28 * pixelHeight, calfLength = 18 * pixelHeight;
  const soleLength = 37 * pixelHeight;
  // The character root rests at y=1.32. Plant the sole at y=.02 above the
  // track instead of inheriting the source jumping pose's small air gap.
  const standingLegLength = point([126, 200]).y + 1.30;

  function update(cycle) {
    const phase = (Number.isFinite(cycle) ? cycle : 0) * Math.PI * 2;
    const swing = Math.cos(phase), sway = Math.sin(phase);
    const bodyBounce = .025 * (1 - Math.cos(phase * 2));
    for (let i = 0; i < legs.length; i++) {
      const leg = legs[i], travel = i === 0 ? swing : -swing;
      // Only the recovering leg lifts. Both feet meet the ground briefly at
      // each exchange; the opposite leg stays planted throughout the swing.
      const recovery = Math.max(0, travel) ** 2;
      const shoeScale = .72 + .28 * recovery;
      const kneeX = leg.side * (.015 + .14 * recovery);
      const kneeY = -.285 + .07 * recovery;
      const ankleX = leg.side * (.015 + .025 * recovery);
      const ankleY = -standingLegLength - bodyBounce + .45 * recovery + soleLength * shoeScale;
      const upperLength = Math.hypot(kneeX, kneeY);
      const lowerX = ankleX - kneeX, lowerY = ankleY - kneeY;
      const lowerLength = Math.hypot(lowerX, lowerY);
      const upperAngle = Math.atan2(kneeX, -kneeY);
      const lowerAngle = Math.atan2(lowerX, -lowerY);
      // In-plane joints keep recovery visible from the elevated rear camera.
      // Only skin/socks between joints stretch; each entire painted shoe stays
      // intact and faces the camera instead of rotating into an edge-on card.
      leg.hip.rotation.set(0, 0, upperAngle);
      leg.thigh.scale.y = upperLength / thighLength;
      leg.knee.position.set(0, -upperLength, 0);
      leg.knee.rotation.set(0, 0, lowerAngle - upperAngle);
      leg.calf.scale.y = lowerLength / calfLength;
      leg.ankle.position.set(0, -lowerLength, .025 * recovery);
      const toeAngle = leg.side * (.025 + .09 * recovery);
      leg.ankle.rotation.set(0, 0, toeAngle - lowerAngle);
      leg.shoe.scale.set(1 + .025 * recovery, shoeScale, 1);
      const front = recovery > 0 ? 20 : 10;
      leg.thigh.renderOrder = front;
      leg.calf.renderOrder = front - 1;
      // The recovering heel comes in front of the shorts, as in the original
      // running artwork. The planted shoe remains underneath the whole body.
      leg.shoe.renderOrder = recovery > .35 ? 42 : front + 1;
    }
    torso.group.rotation.set(.025, .035 * sway, .018 * sway);
    head.group.rotation.set(-.012, -.02 * sway, -.012 * sway);
    // Arms counter the opposite legs. Keeping complete sleeve/hand cutouts
    // avoids visible elbow seams in the original painted fabric and skin.
    leftArm.group.rotation.set(.25 * swing, -.06 * swing, -.18 * swing);
    rightArm.group.rotation.set(-.25 * swing, -.06 * swing, -.18 * swing);
  }

  function setOpacity(weight) {
    const opacity = THREE.MathUtils.clamp(Number.isFinite(weight) ? weight : 0, 0, 1);
    uniforms.opacity.value = opacity;
    root.visible = opacity > .001;
  }

  update(0);
  return {
    root,
    update,
    setOpacity,
    dispose() {
      root.removeFromParent();
      for (const geometry of geometries) geometry.dispose();
      material.dispose();
      // The atlas is shared with jump/slide rendering and belongs to the caller.
    },
  };
}
