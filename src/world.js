import * as THREE from 'three';
import { CELL, SIZE, open, at, BOOKS, EXIT, SPAWN, TOTAL, ROOMS, DOORS, CATS, DOG } from './game.js';

export async function createWorld(canvas) {
  const mobile = matchMedia('(pointer: coarse)').matches || navigator.maxTouchPoints > 0;
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(devicePixelRatio, mobile ? 1.5 : 1.7));
  renderer.setSize(canvas.clientWidth, canvas.clientHeight, false);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.12;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.shadowMap.autoUpdate = false;
  renderer.shadowMap.needsUpdate = true;
  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#d7ded8');
  scene.fog = new THREE.Fog('#d7ded8', 20, 65);
  const camera = new THREE.PerspectiveCamera(68, 1, 0.07, 85);
  camera.rotation.order = 'YXZ';
  scene.add(new THREE.HemisphereLight('#fff4dd', '#82918f', 2.5));
  const sun = new THREE.DirectionalLight('#ffe0a0', 3.1);
  sun.position.set(28, 45, 38); sun.target.position.set(0, 0, 7);
  sun.castShadow = true;
  Object.assign(sun.shadow.camera, { left: -66, right: 66, top: 66, bottom: -66, near: 1, far: 150 });
  sun.shadow.mapSize.set(mobile ? 1024 : 2048, mobile ? 1024 : 2048); sun.shadow.normalBias = 0.025;
  scene.add(sun, sun.target);

  const materials = new Map(), batches = new Map();
  const material = (color, basic = false) => {
    const key = color + basic;
    if (!materials.has(key)) materials.set(key, basic ? new THREE.MeshBasicMaterial({ color }) : new THREE.MeshStandardMaterial({ color, roughness: 0.72, metalness: 0.03 }));
    return materials.get(key);
  };
  const dummy = new THREE.Object3D();
  function instance(shape, pos, scale, color, rotation = 0, basic = false, shadow = true) {
    const key = `${shape}-${color}-${basic}-${shadow}`;
    if (!batches.has(key)) batches.set(key, { shape, mat: material(color, basic), matrices: [], shadow });
    dummy.position.set(...pos); dummy.scale.set(...scale); dummy.rotation.set(0, rotation, 0); dummy.updateMatrix();
    batches.get(key).matrices.push(dummy.matrix.clone());
  }
  const box = (pos, scale, color, rot = 0, basic = false, shadow = true) => instance('box', pos, scale, color, rot, basic, shadow);
  const sphere = (pos, scale, color) => instance('sphere', pos, scale, color);
  const roomColor = (x, z) => ROOMS.find(r => x >= r.x && x <= r.x + 2 && z >= r.z && z <= r.z + 2)?.color || '#759b99';
  for (let z = 0; z < SIZE; z++) for (let x = 0; x < SIZE; x++) {
    if (!open(x, z)) continue;
    const p = at(x, z);
    for (let tz = 0; tz < 4; tz++) for (let tx = 0; tx < 4; tx++) {
      const checker = (tx + tz) % 2;
      box([p.x + (tx - 1.5) * 0.8, -0.025, p.z + (tz - 1.5) * 0.8], [0.793, 0.05, 0.793], checker ? '#c5d0c9' : '#e8dfc9', 0, false, false);
    }
    box([p.x, 3.8, p.z], [CELL, 0.08, CELL], '#e2dfd2', 0, false, false);
    if (x % 3 === 0 && z % 3 === 0) {
      box([p.x, 3.73, p.z], [0.7, 0.08, 1.5], '#d4d2c8', 0, false, false);
      box([p.x, 3.675, p.z], [0.58, 0.025, 1.37], '#fff1cf', 0, true, false);
    }
    for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      if (open(x + dx, z + dz)) continue;
      const angle = Math.atan2(-dx, -dz);
      const wx = p.x + dx * CELL / 2, wz = p.z + dz * CELL / 2;
      const local = (u, y, d) => [wx + Math.cos(angle) * u - dx * d, y, wz - Math.sin(angle) * u - dz * d];
      const wallBox = (u, y, d, w, h, depth, col, basic = false, shadow = true) => box(local(u, y, d), [w, h, depth], col, angle, basic, shadow);
      wallBox(0, 2.5, 0, CELL + 0.03, 2.6, 0.14, '#e9e1c9');
      wallBox(0, 0.62, 0, CELL + 0.03, 1.24, 0.15, roomColor(x, z));
      wallBox(0, 1.25, 0.025, CELL, 0.065, 0.18, '#f6e8c6');
      wallBox(0, 0.085, 0.06, CELL, 0.17, 0.12, '#4e6967');
      wallBox(0, 3.61, 0.01, CELL, 0.09, 0.21, '#d2cbb7');
      const isWindow = dx === 1 && ((x === 16 && z >= 17 && z <= 28) || x === 30);
      const isLocker = !isWindow && dx !== 0 && ((x === 15 && z >= 17 && z <= 28) || (x === 1 && z % 3 !== 0) || (x === 16 && z <= 14 && z >= 3));
      if (isWindow) {
        wallBox(0, 2.38, 0.1, 2.7, 1.94, 0.08, '#d5c7a9');
        wallBox(0, 2.38, 0.155, 2.5, 1.74, 0.02, '#cce5db', true);
        wallBox(-0.55, 2.07, 0.175, 0.72, 0.54, 0.012, '#a1c4b4', true);
        wallBox(0.65, 1.95, 0.175, 0.82, 0.3, 0.012, '#b1cbb0', true);
        wallBox(0, 2.38, 0.2, 0.065, 1.81, 0.06, '#f3ead5');
        wallBox(0, 2.42, 0.2, 2.56, 0.065, 0.06, '#f3ead5');
        wallBox(0, 1.46, 0.23, 2.84, 0.1, 0.42, '#eee4ce');
        // Sunlight is geometry, so it stays crisp on the tiled floor without texture downloads.
        if (x === 16) sunPatch(p.x, p.z);
      } else if (isLocker) {
        for (let i = 0; i < 4; i++) {
          const u = (i - 1.5) * 0.67;
          wallBox(u, 1.18, 0.25, 0.64, 2.28, 0.43, '#427b80');
          wallBox(u, 1.19, 0.48, 0.59, 2.17, 0.035, i % 2 ? '#5b989b' : '#518f94');
          wallBox(u + 0.2, 1.19, 0.515, 0.035, 0.21, 0.055, '#d5cbb1');
          wallBox(u - 0.02, 1.82, 0.504, 0.28, 0.075, 0.012, '#d7d9c0');
          for (let j = 0; j < 3; j++) wallBox(u, 2.06 - j * 0.065, 0.51, 0.3, 0.02, 0.02, '#39666b');
        }
      } else if ((x * 7 + z * 3 + dx + dz) % 7 === 0) {
        const labels = [['БОЛЬШЕ', 'ОТКРЫТИЙ', '#d8b56c'], ['ПЕРЕМЕНА', 'НАЧИНАЕТСЯ!', '#9cae8f'], ['ПРОБУЙ.', 'У ТЕБЯ ПОЛУЧИТСЯ', '#baa1bf']];
        const [title, subtitle, bg] = labels[(x + z) % 3];
        wallBox(0, 2.24, 0.105, 1.53, 1.28, 0.06, '#c7b187');
        sign(title, subtitle, bg, local(0, 2.24, 0.145), angle, 1.42, 1.17);
      }
    }
  }

  function sunPatch(x, z) {
    const shape = new THREE.Shape();
    shape.moveTo(x + 1.4, -z - 1.2); shape.lineTo(x + 1.4, -z + 1.2); shape.lineTo(x - 4.7, -z - 2.1); shape.lineTo(x - 4.7, -z - 4.5); shape.closePath();
    const mesh = new THREE.Mesh(new THREE.ShapeGeometry(shape), new THREE.MeshBasicMaterial({ color: '#ffda85', transparent: true, opacity: 0.15, depthWrite: false }));
    mesh.rotation.x = -Math.PI / 2; mesh.position.y = 0.012; scene.add(mesh);
    for (let i = 0; i < 2; i++) box([x - 1.6, 0.017, z + 1.63 + i * 0.58], [5.55, 0.009, 0.075], '#bbc3b3', -0.5, false, false);
  }

  function sign(title, subtitle, color, position, angle = 0, width = 2.6, height = 0.8) {
    const h = Math.round(768 * height / width);
    const titleSize = Math.min(66, h * 0.27, 650 / (title.length * 0.63));
    const subtitleSize = Math.min(30, h * 0.14, 630 / (subtitle.length * 0.7));
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="768" height="${h}" viewBox="0 0 768 ${h}"><rect width="768" height="${h}" rx="8" fill="${color}"/><rect x="9" y="9" width="750" height="${h - 18}" rx="4" fill="none" stroke="#fffae5" stroke-width="2" opacity=".5"/><text x="384" y="${h * 0.44}" text-anchor="middle" fill="#304d4d" font-family="Arial,sans-serif" font-weight="bold" font-size="${titleSize}">${title}</text><text x="384" y="${h * 0.7}" text-anchor="middle" fill="#304d4d" font-family="Arial,sans-serif" font-size="${subtitleSize}" letter-spacing="2">${subtitle}</text><path d="M365 ${h * 0.85}h38m-7-7 7 7-7 7" stroke="#304d4d" fill="none" stroke-width="3"/></svg>`;
    const texture = new THREE.TextureLoader().load(`data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`);
    texture.colorSpace = THREE.SRGBColorSpace;
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(width, height), new THREE.MeshBasicMaterial({ map: texture }));
    mesh.position.set(...position); mesh.rotation.y = angle; scene.add(mesh); return mesh;
  }

  // Furniture stays along walls, clear of the navigation paths.
  function plant(x, z) {
    box([x, 0.25, z], [0.57, 0.5, 0.57], '#bd926a');
    box([x, 0.5, z], [0.62, 0.09, 0.62], '#cda77e');
    box([x, 0.71, z], [0.05, 0.53, 0.05], '#698253');
    sphere([x, 1.03, z], [0.44, 0.72, 0.43], '#678c64');
    sphere([x + 0.2, 0.9, z + 0.1], [0.39, 0.5, 0.36], '#86a076');
  }
  function desk(x, z, rot = 0) {
    box([x, 0.72, z], [1.1, 0.09, 0.65], '#c4a476', rot);
    for (const dx of [-0.44, 0.44]) for (const dz of [-0.24, 0.24]) box([x + dx, 0.34, z + dz], [0.055, 0.67, 0.055], '#5b7979');
    box([x, 0.43, z + 0.72], [0.48, 0.07, 0.47], '#9ba576');
    box([x, 0.7, z + 0.92], [0.48, 0.5, 0.06], '#9ba576');
    for (const dx of [-0.19, 0.19]) for (const dz of [0.55, 0.89]) box([x + dx, 0.21, z + dz], [0.04, 0.43, 0.04], '#5b7979');
  }
  for (const { cx, cz, name } of ROOMS) {
    const c = at(cx, cz);
    box([c.x, 2.08, c.z - 4.7], [4.3, 1.66, 0.12], '#c6ab80');
    sign(name.toUpperCase(), 'ДУМАЙ • ПРОБУЙ • ИГРАЙ', '#7eaaa0', [c.x, 2.08, c.z - 4.62], 0, 4.1, 1.49);
    for (const dx of [-2.9, 2.9]) for (const dz of [-0.9, 1.5]) desk(c.x + dx, c.z + dz);
    plant(c.x + 3.75, c.z - 3.7);
  }
  plant(SPAWN.x - 4.1, SPAWN.z - 1.9); plant(SPAWN.x - 4.1, SPAWN.z - 18.8);
  for (const z of [SPAWN.z - 10.4, SPAWN.z - 36.4]) {
    box([SPAWN.x - 4.45, 0.48, z], [0.64, 0.12, 2.7], '#c49e6e');
    box([SPAWN.x - 4.67, 0.8, z], [0.1, 0.57, 2.7], '#c49e6e');
    for (const dz of [-1, 1]) box([SPAWN.x - 4.45, 0.24, z + dz], [0.52, 0.46, 0.08], '#567777');
  }

  // Hanging wayfinding signs and a recognisable exit at the starting end of the hall.
  for (const [z, title, sub] of [[SPAWN.z - 5, 'ПЕРЕМЕНА', `НАЙДИ ${TOTAL} ТЕТРАДЕЙ`], [SPAWN.z - 20, 'КАБИНЕТЫ', 'ОТКРЫВАЙ ДВЕРИ — E'], [SPAWN.z - 42, 'БОЛЬШОЙ КРУГ', 'ИССЛЕДУЙ ШКОЛУ']]) {
    box([SPAWN.x - 1.6, 3.31, z], [3.2, 0.66, 0.12], '#456d70');
    sign(title, sub, '#b5c9b9', [SPAWN.x - 1.6, 3.31, z + 0.07], 0, 3.08, 0.56);
    for (const x of [SPAWN.x - 2.75, SPAWN.x - 0.45]) box([x, 3.65, z], [0.025, 0.38, 0.025], '#636c63');
  }

  const doorMeshes = DOORS.map(door => {
    const root = new THREE.Group(); root.position.set(door.x, 0, door.z); root.rotation.y = door.axis === 'x' ? Math.PI / 2 : 0;
    const part = (parent, position, scale, color) => {
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(...scale), material(color));
      mesh.position.set(...position); mesh.castShadow = true; mesh.receiveShadow = true; parent.add(mesh); return mesh;
    };
    part(root, [-1.36, 1.38, 0], [0.48, 2.76, 0.24], '#e0d4ba');
    part(root, [1.36, 1.38, 0], [0.48, 2.76, 0.24], '#e0d4ba');
    part(root, [0, 3.22, 0], [3.2, 1.16, 0.24], '#e9e1c9');
    for (const x of [-1.13, 1.13]) part(root, [x, 1.36, 0], [0.1, 2.73, 0.3], '#b49672');
    part(root, [0, 2.72, 0], [2.34, 0.1, 0.3], '#b49672');
    const pivot = new THREE.Group(); pivot.position.x = -1.07; root.add(pivot);
    part(pivot, [1.07, 1.35, 0], [2.14, 2.66, 0.12], ROOMS[door.roomId].color);
    part(pivot, [1.07, 0.61, 0.066], [1.8, 0.75, 0.025], '#d7c59c');
    part(pivot, [1.84, 1.15, 0.12], [0.23, 0.06, 0.14], '#d9c385');
    const plate = sign(String(door.roomId + 1).padStart(2, '0'), door.name.toUpperCase(), '#efe3c7', [1.07, 1.98, 0.076], 0, 1.68, 0.7);
    pivot.add(plate);
    const reversePlate = sign(String(door.roomId + 1).padStart(2, '0'), 'В КОРИДОР', '#efe3c7', [1.07, 1.98, -0.076], Math.PI, 1.68, 0.7);
    pivot.add(reversePlate);
    scene.add(root); return { root, pivot, id: door.id };
  });
  box([EXIT.x, 1.35, EXIT.z + 1.43], [2.45, 2.7, 0.14], '#426b67');
  for (const x of [-0.59, 0.59]) {
    box([EXIT.x + x, 1.4, EXIT.z + 1.32], [1.12, 2.5, 0.08], '#7baca0');
    box([EXIT.x + x, 1.83, EXIT.z + 1.26], [0.86, 1.17, 0.04], '#b3d5c9', 0, true);
    box([EXIT.x + x, 1.06, EXIT.z + 1.2], [0.7, 0.045, 0.07], '#e7d8ab');
  }
  sign('ВЫХОД', 'ВСЕ ТЕТРАДИ С СОБОЙ?', '#e6c47d', [EXIT.x, 3.05, EXIT.z + 1.24], Math.PI, 2.43, 0.6);
  // Back-facing wall text needs to face the approaching player (toward -Z).
  const exitHalo = new THREE.Mesh(new THREE.RingGeometry(0.7, 0.8, 48), new THREE.MeshBasicMaterial({ color: '#77d9b5', transparent: true, opacity: 0.6, side: THREE.DoubleSide, depthWrite: false }));
  exitHalo.rotation.x = -Math.PI / 2; exitHalo.position.set(EXIT.x, 0.02, EXIT.z); scene.add(exitHalo);

  const geometries = { box: new THREE.BoxGeometry(1, 1, 1), sphere: new THREE.IcosahedronGeometry(1, 1) };
  for (const batch of batches.values()) {
    const mesh = new THREE.InstancedMesh(geometries[batch.shape], batch.mat, batch.matrices.length);
    batch.matrices.forEach((m, i) => mesh.setMatrixAt(i, m));
    mesh.castShadow = batch.shadow; mesh.receiveShadow = true; mesh.computeBoundingSphere(); scene.add(mesh);
  }

  const bookMeshes = BOOKS.map(book => {
    const group = new THREE.Group();
    const cover = new THREE.Mesh(new THREE.BoxGeometry(0.51, 0.68, 0.09), new THREE.MeshStandardMaterial({ color: '#ad80d2', roughness: 0.4 }));
    cover.castShadow = true; group.add(cover);
    const paper = new THREE.Mesh(new THREE.BoxGeometry(0.43, 0.6, 0.07), material('#fff3db'));
    paper.position.set(0.025, 0, 0.055); group.add(paper);
    const spine = new THREE.Mesh(new THREE.BoxGeometry(0.055, 0.68, 0.12), material('#76559a')); spine.position.x = -0.225; group.add(spine);
    for (let i = 0; i < 4; i++) {
      const line = new THREE.Mesh(new THREE.BoxGeometry(0.27, 0.015, 0.008), material('#b4b7c3'));
      line.position.set(0.04, 0.13 - i * 0.08, 0.095); group.add(line);
    }
    group.position.set(book.x, 1.05, book.z); scene.add(group);
    const ring = new THREE.Mesh(new THREE.RingGeometry(0.35, 0.4, 32), new THREE.MeshBasicMaterial({ color: '#ffe0a0', transparent: true, opacity: 0.65, side: THREE.DoubleSide, depthWrite: false }));
    ring.rotation.x = -Math.PI / 2; ring.position.set(book.x, 0.02, book.z); scene.add(ring);
    return { group, ring };
  });

  const loader = new THREE.TextureLoader();
  const [spriteTexture, idleTexture, redTexture, redBackTexture] = await Promise.all([
    loader.loadAsync(`${import.meta.env.BASE_URL}assets/runner-sheet.png`), loader.loadAsync(`${import.meta.env.BASE_URL}assets/runner-idle.png`),
    loader.loadAsync(`${import.meta.env.BASE_URL}assets/red-runner-sheet.png`), loader.loadAsync(`${import.meta.env.BASE_URL}assets/red-runner-back-sheet.png`)
  ]);
  for (const texture of [spriteTexture, idleTexture, redTexture, redBackTexture]) {
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.minFilter = THREE.LinearFilter; texture.magFilter = THREE.LinearFilter;
    texture.generateMipmaps = false;
  }
  const spriteMaterial = new THREE.ShaderMaterial({
    uniforms: { sheet: { value: spriteTexture }, idleSheet: { value: idleTexture }, isIdle: { value: 1 }, frame: { value: 0 }, lightTint: { value: new THREE.Color('#fff3da') } },
    transparent: true, side: THREE.DoubleSide, depthWrite: true,
    vertexShader: `varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: `uniform sampler2D sheet; uniform sampler2D idleSheet; uniform float isIdle; uniform float frame; uniform vec3 lightTint; varying vec2 vUv;
      void main() {
        float col = mod(frame, 4.0); float row = floor(frame / 4.0);
        vec2 uv = vec2((col + clamp(vUv.x, 0.006, 0.994)) / 4.0, (1.0 - row + clamp(vUv.y, 0.006, 0.994)) / 2.0);
        vec4 c;
        if (isIdle > 0.5) c = texture2D(idleSheet, vec2(vUv.x, clamp(vUv.y * 0.984 + 0.024, 0.0, 1.0)));
        else c = texture2D(sheet, uv);
        float key = c.g - max(c.r, c.b);
        float alpha = 1.0 - smoothstep(0.10, 0.34, key);
        if (alpha < 0.4) discard;
        c.g = min(c.g, max(c.r, c.b) + 0.025);
        gl_FragColor = vec4(c.rgb * lightTint * 1.08, alpha);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`
  });
  const runner = new THREE.Mesh(new THREE.PlaneGeometry(1.68, 2.24), spriteMaterial);
  runner.position.set(0, 1.14, 0); scene.add(runner);
  const shadow = new THREE.Mesh(new THREE.PlaneGeometry(1.45, 0.94), new THREE.ShaderMaterial({
    transparent: true, depthWrite: false,
    vertexShader: `varying vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }`,
    fragmentShader: `varying vec2 vUv; void main(){ float a=1.0-smoothstep(0.05,0.5,length(vUv-0.5)); gl_FragColor=vec4(0.15,0.17,0.15,a*0.27); }`
  }));
  shadow.rotation.x = -Math.PI / 2; shadow.position.y = 0.024; scene.add(shadow);

  const redMaterial = spriteMaterial.clone();
  redMaterial.uniforms.sheet.value = redTexture;
  redMaterial.uniforms.isIdle.value = 0;
  const wanderer = new THREE.Mesh(runner.geometry, redMaterial);
  scene.add(wanderer);
  const redShadow = shadow.clone(); scene.add(redShadow);

  const petTexture = await loader.loadAsync(`${import.meta.env.BASE_URL}assets/pets-sheet.png`);
  petTexture.colorSpace = THREE.SRGBColorSpace;
  petTexture.minFilter = THREE.LinearFilter; petTexture.generateMipmaps = false;
  function petSprite(frame, position, size) {
    const mat = new THREE.ShaderMaterial({
      uniforms: { sheet: { value: petTexture }, frame: { value: frame } },
      transparent: true, side: THREE.DoubleSide,
      vertexShader: `varying vec2 vUv; void main(){vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}`,
      fragmentShader: `uniform sampler2D sheet; uniform float frame; varying vec2 vUv;
        void main(){
          vec2 uv=(vec2(mod(frame,2.0),1.0-floor(frame/2.0))+clamp(vUv,0.006,0.994))/2.0;
          vec4 c=texture2D(sheet,uv);
          float a=c.a*(1.0-smoothstep(0.10,0.34,c.g-max(c.r,c.b)));
          if(a<0.45) discard;
          c.g=min(c.g,max(c.r,c.b)+0.025);
          gl_FragColor=vec4(c.rgb,a);
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
        }`,
    });
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(size, size), mat);
    mesh.position.set(position.x, size * 0.47, position.z); scene.add(mesh);
    const groundShadow = shadow.clone(); groundShadow.scale.set(0.65, 0.7, 1);
    groundShadow.position.set(position.x, 0.025, position.z); scene.add(groundShadow);
    return mesh;
  }
  const cats = CATS.map(cat => petSprite(cat.id, cat, 1.15));
  const dog = petSprite(2, DOG, 1.5);
  const poopMesh = new THREE.Group();
  const poopGeometry = new THREE.SphereGeometry(1, 10, 6);
  for (const [x, y, radius] of [[0, 0.10, 0.23], [0.02, 0.23, 0.16], [0.05, 0.33, 0.09]]) {
    const piece = new THREE.Mesh(poopGeometry, material('#765035'));
    piece.position.set(x, y, 0); piece.scale.set(radius, radius * 0.7, radius * 0.8); poopMesh.add(piece);
  }
  scene.add(poopMesh);

  function render(time, game, intro = false, reduced = false) {
    resize();
    for (const pet of [...cats, dog]) {
      pet.rotation.y = Math.atan2(camera.position.x - pet.position.x, camera.position.z - pet.position.z);
    }
    dog.material.uniforms.frame.value = game.dog.phase === 'squatting' ? 3 : 2;
    dog.position.y = 1.5 * 0.47 + (!reduced && game.dog.phase === 'squatting' ? Math.sin(time * 9) * 0.012 : 0);
    poopMesh.visible = !intro && game.poops.length > 0;
    if (game.poops[0]) poopMesh.position.set(game.poops[0].x, 0, game.poops[0].z);
    const running = !intro && game.state === 'playing' && game.enemyMoving;
    spriteMaterial.uniforms.isIdle.value = running ? 0 : 1;
    runner.userData.pose = running ? 'running' : 'idle';
    for (const door of doorMeshes) {
      const target = !intro && game.openedDoors.has(door.id) ? Math.PI / 2 : 0;
      if (Math.abs(target - door.pivot.rotation.y) > 0.001) renderer.shadowMap.needsUpdate = true;
      door.pivot.rotation.y += (target - door.pivot.rotation.y) * (reduced ? 1 : 0.16);
    }
    for (let i = 0; i < bookMeshes.length; i++) {
      const { group, ring } = bookMeshes[i];
      group.visible = ring.visible = !game.collected.has(i);
      group.position.y = 1.05 + (reduced ? 0 : Math.sin(time * 2.2 + i) * 0.09);
      group.rotation.y = reduced ? 0.35 : time * 0.65 + i;
    }
    if (intro) {
      camera.fov = 57; camera.position.set(SPAWN.x - 2.9, 1.5, SPAWN.z + 0.9);
      camera.lookAt(SPAWN.x + 1.1, 1.38, SPAWN.z - 10);
      if (!reduced) camera.position.x += Math.sin(time * 0.15) * 0.045;
      runner.position.set(SPAWN.x + 0.65, 1.14, SPAWN.z - 2.4);
    } else {
      runner.position.set(game.enemy.x, 1.14 + (reduced || !running ? 0 : Math.sin(game.enemyTravel * 6) * 0.015), game.enemy.z);
      spriteMaterial.uniforms.frame.value = Math.floor(game.enemyTravel * 4.5) % 8;
    }
    runner.rotation.y = Math.atan2(camera.position.x - runner.position.x, camera.position.z - runner.position.z);
    shadow.position.x = runner.position.x; shadow.position.z = runner.position.z;
    const npc = game.wanderer, facing = npc.facing || { x: 0, z: -1 };
    wanderer.visible = redShadow.visible = !intro;
    wanderer.position.set(npc.x, 1.14 + (reduced || !npc.moving ? 0 : Math.sin(npc.travel * 6) * 0.015), npc.z);
    wanderer.rotation.y = Math.atan2(camera.position.x - npc.x, camera.position.z - npc.z);
    const back = (camera.position.x - npc.x) * facing.x + (camera.position.z - npc.z) * facing.z < 0;
    redMaterial.uniforms.sheet.value = back ? redBackTexture : redTexture;
    redMaterial.uniforms.frame.value = Math.floor(npc.travel * 4.5) % 8;
    wanderer.userData.view = back ? 'back' : 'front';
    redShadow.position.set(npc.x, 0.024, npc.z);
    exitHalo.material.color.set(game.collected.size === TOTAL ? '#64efb9' : '#d2b778');
    camera.updateProjectionMatrix(); renderer.render(scene, camera);
  }

  let renderWidth = 0, renderHeight = 0;
  function resize() {
    // Safari can finish rotating after its resize event, or while textures load.
    // CSS owns the full-screen canvas; sync its drawing buffer before each frame.
    const width = canvas.clientWidth, height = canvas.clientHeight;
    if (!width || !height || (width === renderWidth && height === renderHeight)) return;
    renderWidth = width; renderHeight = height;
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
  }
  resize();
  return { renderer, scene, camera, runner, wanderer, render, bookMeshes, resize };
}
