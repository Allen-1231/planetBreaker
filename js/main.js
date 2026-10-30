(function () {
  'use strict';
  var $ = function (id) { return document.getElementById(id); };
  var msgEl = $('msg'), canvas = $('c');
  var renderer;
  try { renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true, powerPreference: 'high-performance' }); }
  catch (e) { msgEl.textContent = '這個瀏覽器無法啟動 WebGL，無法執行遊戲。'; return; }
  var DPR = Math.min(window.devicePixelRatio || 1, 2);
  renderer.setPixelRatio(DPR);
  renderer.setClearColor(0x03050a, 1);

  var TAU = Math.PI * 2, V3 = THREE.Vector3;
  var scene = new THREE.Scene();
  var FOV0 = 62;
  var camera = new THREE.PerspectiveCamera(FOV0, 1, 0.5, 90000);

  /* ---------- textures ---------- */
  var nTex = Object.keys(TEX).length, nDone = 0;
  var mgr = new THREE.LoadingManager(function () { msgEl.classList.add('done'); });
  mgr.onProgress = function () { nDone++; msgEl.textContent = '載入天體貼圖 ' + Math.min(nDone, nTex) + ' / ' + nTex; };
  var loader = new THREE.TextureLoader(mgr);
  var aniso = Math.min(8, renderer.capabilities.getMaxAnisotropy());
  var T = {};
  Object.keys(TEX).forEach(function (k) { var t = loader.load(TEX[k]); t.anisotropy = aniso; if (k !== 'ring') t.wrapS = THREE.RepeatWrapping; T[k] = t; });

  /* ---------- world ---------- */
  var SUN_R = 420;
  var DEG = Math.PI / 180;
  var PL = {
    mercury: { name: '水星', R: 38, km: 2440, col: '#b8b0a4', short: '水', atm: false },
    venus:   { name: '金星', R: 78, km: 6052, col: '#e8c27a', short: '金', atm: false },
    earth:   { name: '地球', R: 80, km: 6371, col: '#4a90e2', short: '地', atm: true },
    mars:    { name: '火星', R: 45, km: 3390, col: '#d4683a', short: '火', atm: false },
    jupiter: { name: '木星', R: 380, km: 69911, col: '#d9a877', short: '木', atm: true },
    saturn:  { name: '土星', R: 320, km: 58232, col: '#e8d49a', short: '土', atm: true },
    uranus:  { name: '天王星', R: 140, km: 25362, col: '#8fe0e8', short: '天', atm: true },
    neptune: { name: '海王星', R: 135, km: 24622, col: '#5a7ff0', short: '海', atm: true },
    pluto:   { name: '冥王星', R: 28, km: 1188, col: '#cdb7a4', short: '冥', atm: false }
  };
  var ORDER = ['mercury', 'venus', 'earth', 'mars', 'jupiter', 'saturn', 'uranus', 'neptune', 'pluto'];
  /* real orbital elements and rotation periods (same data as the solar-system viewer) */
  var EL = {
    mercury: { a: 0.38710, e: 0.20563, L0: 252.251, w: 77.457, i: 7.005, Om: 48.331, P: 87.969, rotH: 1407.6 },
    venus:   { a: 0.72333, e: 0.00677, L0: 181.980, w: 131.564, i: 3.395, Om: 76.680, P: 224.701, rotH: 5832.5 },
    earth:   { a: 1.00000, e: 0.01671, L0: 100.464, w: 102.937, i: 0, Om: 0, P: 365.256, rotH: 23.934 },
    mars:    { a: 1.52368, e: 0.09340, L0: 355.453, w: 336.060, i: 1.850, Om: 49.558, P: 686.980, rotH: 24.623 },
    jupiter: { a: 5.20260, e: 0.04849, L0: 34.404, w: 14.753, i: 1.303, Om: 100.464, P: 4332.59, rotH: 9.925 },
    saturn:  { a: 9.55490, e: 0.05551, L0: 49.944, w: 92.599, i: 2.489, Om: 113.666, P: 10759.22, rotH: 10.656 },
    uranus:  { a: 19.2184, e: 0.04630, L0: 313.232, w: 170.954, i: 0.773, Om: 74.017, P: 30688.5, rotH: 17.24 },
    neptune: { a: 30.1104, e: 0.00899, L0: 304.880, w: 44.971, i: 1.770, Om: 131.784, P: 60182, rotH: 16.11 },
    pluto:   { a: 39.482, e: 0.24883, L0: 238.929, w: 224.067, i: 17.16, Om: 110.299, P: 90560, rotH: 153.29 }
  };
  var VIS = {
    mercury: { tex: 'mercury', bump: 'mercuryBump', bk: 2.0, atmo: [0.6, 0.55, 0.5, 0.0, 1.02], rim: [0.6, 0.55, 0.5, 0.1], tilt: 0.03, detail: 0.5, stretch: 1, flow: 0, seg: [96, 64] },
    venus:   { tex: 'venus', atmo: [1.0, 0.80, 0.45, 0.95, 1.07], rim: [1.0, 0.85, 0.55, 0.45], tilt: 177.36, detail: 0.12, stretch: 2, flow: 0.0004, seg: [96, 64] },
    earth:   { tex: 'earth', earth: true, atmo: [0.30, 0.56, 1.0, 1.0, 1.06], rim: [0.3, 0.56, 1.0, 0.55], tilt: 23.44, detail: 0.22, stretch: 1, flow: 0, seg: [128, 80] },
    mars:    { tex: 'mars', bump: 'marsBump', bk: 2.6, atmo: [0.95, 0.62, 0.42, 0.45, 1.04], rim: [0.95, 0.6, 0.4, 0.25], tilt: 25.19, detail: 0.5, stretch: 1, flow: 0, seg: [96, 64] },
    jupiter: { tex: 'jupiter', atmo: [0.85, 0.78, 0.66, 0.30, 1.03], rim: [0.85, 0.78, 0.66, 0.2], tilt: 3.13, detail: 0.30, stretch: 4, flow: 0.0006, seg: [160, 96] },
    saturn:  { tex: 'saturn', atmo: [0.95, 0.86, 0.62, 0.26, 1.03], rim: [0.9, 0.82, 0.6, 0.15], ring: true, tilt: 26.73, detail: 0.24, stretch: 4, flow: 0.0005, seg: [160, 96] },
    uranus:  { tex: 'uranus', atmo: [0.55, 0.92, 0.96, 0.65, 1.04], rim: [0.55, 0.92, 0.96, 0.5], tilt: 97.77, detail: 0.10, stretch: 2, flow: 0.0003, seg: [96, 64] },
    neptune: { tex: 'neptune', atmo: [0.30, 0.50, 1.0, 0.75, 1.04], rim: [0.3, 0.5, 1.0, 0.45], tilt: 28.32, detail: 0.18, stretch: 3, flow: 0.0008, seg: [96, 64] },
    pluto:   { tex: 'pluto', bump: 'plutoBump', bk: 1.6, atmo: [0.7, 0.65, 0.6, 0.0, 1.02], rim: [0.7, 0.65, 0.6, 0.1], tilt: 122.53, detail: 0.4, stretch: 1, flow: 0, seg: [96, 64] }
  };
  ORDER.forEach(function (id) { VIS[id].spin = 0.012 * TAU * (24 / EL[id].rotH); });
  /* orbits: Kepler solver, real direction/inclination, compressed distances, sped-up periods */
  function kepler(M, e) { var E = M; for (var i = 0; i < 7; i++) E = E - (E - e * Math.sin(E) - M) / (1 - e * Math.cos(E)); return E; }
  function gameDist(r) { return 3000 * Math.pow(r, 0.42); }
  function posFromE(el, E, out) {
    var xv = el.a * (Math.cos(E) - el.e), yv = el.a * Math.sqrt(1 - el.e * el.e) * Math.sin(E), r = Math.hypot(xv, yv), nu = Math.atan2(yv, xv);
    var u = nu + (el.w - el.Om) * DEG, Om = el.Om * DEG, inc = el.i * DEG, cu = Math.cos(u), su = Math.sin(u), cO = Math.cos(Om), sO = Math.sin(Om), ci = Math.cos(inc), si = Math.sin(inc);
    var X = r * (cO * cu - sO * su * ci), Y = r * (sO * cu + cO * su * ci), Z = r * su * si, s = gameDist(r) / r;
    out.set(X * s, Z * s, -Y * s); return r;
  }
  var startDays = (Date.now() - Date.UTC(2000, 0, 1, 12, 0, 0)) / 86400000;
  ORDER.forEach(function (id) { var el = EL[id]; el.M0 = ((((el.L0 - el.w) * DEG + TAU * startDays / el.P) % TAU) + TAU) % TAU; el.M = el.M0; el.Pg = 330 * Math.pow(el.a, 0.75); });
  function orbitPos(id, out) { var el = EL[id]; posFromE(el, kepler(el.M, el.e), out); return out; }

  /* ---------- shaders ---------- */
  var PLANET_VS = [
    'varying vec2 vUv; varying vec3 vN; varying vec3 vE; varying vec3 vNo; varying vec3 vW; varying vec3 vObj;',
    'void main(){ vUv = uv; vObj = position; vec3 n = normalize(normal); vec3 e = normalize(cross(vec3(0.,1.,0.), n)); vec3 no = cross(n, e);',
    '  mat3 m = mat3(modelMatrix); vN = normalize(m * n); vE = normalize(m * e); vNo = normalize(m * no);',
    '  vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }'
  ].join('\n');
  var PLANET_FS = [
    'uniform sampler2D map, bumpMap, ringMap, nightMap, cloudMap;',
    'uniform float useBump, bumpK, rimK, ringOn, ringIn, ringOut, amb, earthOn, detailK, stretch, flow, time, pr, dmg, flash;',
    'uniform vec2 bumpTexel; uniform vec3 sunDir, rimColor, ringN, pc;',
    'varying vec2 vUv; varying vec3 vN; varying vec3 vE; varying vec3 vNo; varying vec3 vW; varying vec3 vObj;',
    'float h3(vec3 p){ p = fract(p * 0.3183099 + 0.1); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }',
    'float vn(vec3 x){ vec3 i = floor(x), f = fract(x); f = f * f * (3.0 - 2.0 * f);',
    '  return mix(mix(mix(h3(i), h3(i + vec3(1,0,0)), f.x), mix(h3(i + vec3(0,1,0)), h3(i + vec3(1,1,0)), f.x), f.y),',
    '             mix(mix(h3(i + vec3(0,0,1)), h3(i + vec3(1,0,1)), f.x), mix(h3(i + vec3(0,1,1)), h3(i + vec3(1,1,1)), f.x), f.y), f.z); }',
    'float fbm(vec3 p){ float a = 0.5, s = 0.0; for (int i = 0; i < 5; i++) { s += a * vn(p); p *= 2.03; a *= 0.5; } return s; }',
    'void main(){',
    '  vec3 N = normalize(vN); vec3 Nb = N;',
    '  vec2 uvv = vUv + vec2(flow * time * (1.0 - 0.6 * abs(vUv.y - 0.5) * 2.0), 0.0);',
    '  if (useBump > 0.5) {',
    '    float hx = texture2D(bumpMap, vUv + vec2(bumpTexel.x,0.)).r - texture2D(bumpMap, vUv - vec2(bumpTexel.x,0.)).r;',
    '    float hy = texture2D(bumpMap, vUv + vec2(0.,bumpTexel.y)).r - texture2D(bumpMap, vUv - vec2(0.,bumpTexel.y)).r;',
    '    Nb = normalize(N - bumpK * (hx * normalize(vE) + hy * normalize(vNo))); }',
    '  vec3 V = normalize(cameraPosition - vW); float cd = length(cameraPosition - vW);',
    '  float ndl = dot(N, sunDir); float soft = smoothstep(-0.07, 0.24, ndl);',
    '  vec3 c = texture2D(map, uvv).rgb;',
    '  float near = clamp(1.0 - cd / (pr * 3.5), 0.0, 1.0);',
    '  vec3 pn = normalize(vObj); vec3 q = vec3(pn.x, pn.y * stretch, pn.z);',
    '  float d1 = fbm(q * 14.0 + 3.1), d2 = fbm(q * 55.0 + 7.7), d3 = vn(q * 220.0);',
    '  float dn = d1 * 0.55 + d2 * 0.33 + d3 * 0.12;',
    '  c *= 1.0 + (dn - 0.5) * detailK * (0.4 + 1.2 * near);',
    '  float cl = 0.0;',
    '  if (earthOn > 0.5) { cl = texture2D(cloudMap, vUv + vec2(time * 0.00012, 0.0)).r; cl = clamp(cl * 1.1 + (d2 - 0.5) * 0.25 * near, 0.0, 1.0); c = mix(c, vec3(1.0), cl * 0.82); }',
    '  float l = clamp(dot(Nb, sunDir), 0.0, 1.0); float shade = 1.0;',
    '  if (ringOn > 0.5) { float dn2 = dot(sunDir, ringN);',
    '    if (abs(dn2) > 0.001) { float t = dot(pc - vW, ringN) / dn2;',
    '      if (t > 0.0) { vec3 hit = vW + sunDir * t; float rr = length(hit - pc); float u = (rr - ringIn) / (ringOut - ringIn);',
    '        if (u > 0.0 && u < 1.0) shade = 1.0 - texture2D(ringMap, vec2(u, 0.5)).a * 0.88; } } }',
    '  vec3 col = c * (amb + 1.15 * pow(l, 0.78) * soft * shade);',
    '  if (earthOn > 0.5) { vec3 nc = texture2D(nightMap, vUv).rgb; col += nc * vec3(1.0, 0.85, 0.55) * smoothstep(0.08, -0.18, ndl) * 1.5 * (1.0 - cl * 0.85); }',
    '  float fres = pow(1.0 - max(dot(N, V), 0.0), 3.0);',
    '  col += rimColor * fres * (0.08 + 0.92 * clamp(ndl + 0.35, 0.0, 1.0)) * rimK;',
    '  if (dmg > 0.02) { float ridge = abs(fbm(q * 7.0 + 11.0) - 0.5); float ck = smoothstep(0.012 + dmg * 0.08, 0.0, ridge) * smoothstep(0.02, 0.22, dmg); col += vec3(1.0, 0.42, 0.08) * ck * (0.6 + 2.0 * dmg); col *= 1.0 - 0.25 * dmg; }',
    '  col += vec3(1.0, 0.7, 0.4) * flash * (0.25 + 0.75 * fres);',
    '  gl_FragColor = vec4(col, 1.0); }'
  ].join('\n');
  var ATMO_VS = 'varying vec3 vNw; varying vec3 vWp; void main(){ vNw = normalize(mat3(modelMatrix) * normal); vec4 w = modelMatrix * vec4(position, 1.0); vWp = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }';
  var ATMO_FS = [
    'uniform vec3 sunDir, color; uniform float k; varying vec3 vNw; varying vec3 vWp;',
    'void main(){ vec3 V = normalize(cameraPosition - vWp); vec3 n = normalize(vNw);',
    '  float i = pow(clamp(0.60 - dot(n, V), 0.0, 1.0), 3.4); float lit = clamp(dot(n, sunDir) + 0.55, 0.0, 1.0);',
    '  vec3 c = mix(color * 0.55, mix(color, vec3(1.0), 0.25), i);',
    '  gl_FragColor = vec4(c * i * (0.25 + 0.95 * lit) * 1.5 * k, 1.0); }'
  ].join('\n');
  var RING_VS = 'varying vec2 vUv; varying vec3 vW; void main(){ vUv = uv; vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }';
  var RING_FS = [
    'uniform sampler2D ringMap; uniform vec3 sunDir, pc, ringN; uniform float pr; varying vec2 vUv; varying vec3 vW;',
    'void main(){ vec4 t = texture2D(ringMap, vec2(vUv.x, 0.5)); vec3 oc = vW - pc;',
    '  float b = dot(oc, sunDir); float c = dot(oc, oc) - pr * pr; float disc = b * b - c; float sh = 1.0;',
    '  if (disc > 0.0 && (-b - sqrt(disc)) > 0.0) sh = 1.0 - smoothstep(0.0, 0.10, disc / (pr * pr));',
    '  float lit = 0.10 + 0.90 * pow(abs(dot(ringN, sunDir)), 0.45);',
    '  gl_FragColor = vec4(t.rgb * lit * (0.06 + 0.94 * sh) * 1.05, t.a * 0.96); }'
  ].join('\n');
  var SUN_VS = 'varying vec2 vUv; varying vec3 vN; varying vec3 vW; void main(){ vUv = uv; vN = normalize(mat3(modelMatrix) * normal); vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }';
  var SUN_FS = [
    'uniform sampler2D map; uniform float time; varying vec2 vUv; varying vec3 vN; varying vec3 vW;',
    'void main(){ vec3 V = normalize(cameraPosition - vW); float mu = clamp(dot(normalize(vN), V), 0.0, 1.0);',
    '  vec3 a = texture2D(map, vUv + vec2(time * 0.0040, 0.0)).rgb; vec3 b = texture2D(map, vUv + vec2(0.37 - time * 0.0027, 0.0)).rgb;',
    '  vec3 c = mix(a, b, 0.5); float lum = dot(c, vec3(0.3, 0.59, 0.11));',
    '  c = mix(c, vec3(1.0, 0.82, 0.5) * (lum * 1.5 + 0.2), 0.3); c *= 0.52 + 0.78 * pow(mu, 0.5);',
    '  c += vec3(1.0, 0.5, 0.12) * pow(1.0 - mu, 3.0) * 0.30; gl_FragColor = vec4(c * 1.1, 1.0); }'
  ].join('\n');

  var timeU = { value: 0 };
  var sunPos = new V3(0, 0, 0);
  function makeBody(id) {
    var d = PL[id], v = VIS[id], R = d.R;
    var o = { id: id, R: R, v: v, sunDir: new V3(1, 0, 0), pos: orbitPos(id, new V3()) };
    o.group = new THREE.Group(); o.tilt = new THREE.Group(); o.group.add(o.tilt);
    o.tilt.rotation.z = -v.tilt * Math.PI / 180;
    var rim = v.rim;
    o.u = {
      map: { value: T[v.tex] }, bumpMap: { value: v.bump ? T[v.bump] : T[v.tex] }, ringMap: { value: T.ring },
      nightMap: { value: T.earthNight || T[v.tex] }, cloudMap: { value: T.clouds || T[v.tex] }, earthOn: { value: v.earth ? 1 : 0 },
      useBump: { value: v.bump ? 1 : 0 }, bumpK: { value: v.bk || 0 }, bumpTexel: { value: new THREE.Vector2(1 / 1024, 1 / 512) },
      rimK: { value: rim[3] }, rimColor: { value: new V3(rim[0], rim[1], rim[2]) },
      sunDir: { value: o.sunDir }, ringOn: { value: v.ring ? 1 : 0 }, ringN: { value: new V3(0, 1, 0) }, pc: { value: o.pos },
      ringIn: { value: R * 1.24 }, ringOut: { value: R * 2.27 }, amb: { value: 0.07 },
      detailK: { value: v.detail }, stretch: { value: v.stretch }, flow: { value: v.flow }, time: timeU, pr: { value: R }, dmg: { value: 0 }, flash: { value: 0 }
    };
    o.mesh = new THREE.Mesh(new THREE.SphereGeometry(R, v.seg[0], v.seg[1]), new THREE.ShaderMaterial({ uniforms: o.u, vertexShader: PLANET_VS, fragmentShader: PLANET_FS }));
    o.tilt.add(o.mesh);
    o.atmoMesh = new THREE.Mesh(new THREE.SphereGeometry(R * v.atmo[4], 64, 40), new THREE.ShaderMaterial({
      uniforms: { sunDir: { value: o.sunDir }, color: { value: new V3(v.atmo[0], v.atmo[1], v.atmo[2]) }, k: { value: v.atmo[3] } },
      vertexShader: ATMO_VS, fragmentShader: ATMO_FS, side: THREE.BackSide, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
    o.group.add(o.atmoMesh);
    if (v.ring) {
      var inner = R * 1.24, outer = R * 2.27, rg = new THREE.RingGeometry(inner, outer, 192, 1), p = rg.attributes.position, uv = rg.attributes.uv;
      for (var i = 0; i < p.count; i++) uv.setXY(i, (Math.hypot(p.getX(i), p.getY(i)) - inner) / (outer - inner), 0.5);
      rg.rotateX(-Math.PI / 2);
      o.ring = new THREE.Mesh(rg, new THREE.ShaderMaterial({ uniforms: { ringMap: { value: T.ring }, sunDir: { value: o.sunDir }, pc: o.u.pc, ringN: o.u.ringN, pr: { value: R } },
        vertexShader: RING_VS, fragmentShader: RING_FS, transparent: true, side: THREE.DoubleSide, depthWrite: false }));
      o.tilt.add(o.ring);
    }
    o.group.position.copy(o.pos);
    o.sunDir.copy(sunPos).sub(o.pos).normalize();
    scene.add(o.group);
    return o;
  }
  var bodies = {};
  ORDER.forEach(function (id) { bodies[id] = makeBody(id); });
  /* Saturn's ring plane: slightly tilted about the x axis (shared with the debris field) */
  var SAT_TILT = 0.06, satQ = new THREE.Quaternion();

  /* sun */
  var sunU = { time: timeU };
  var sunMesh = new THREE.Mesh(new THREE.SphereGeometry(SUN_R, 96, 64), new THREE.ShaderMaterial({ uniforms: { map: { value: T.sun }, time: sunU.time }, vertexShader: SUN_VS, fragmentShader: SUN_FS }));
  scene.add(sunMesh);
  function glowTex(stops) {
    var cv = document.createElement('canvas'); cv.width = cv.height = 256;
    var g = cv.getContext('2d'), gr = g.createRadialGradient(128, 128, 0, 128, 128, 128);
    stops.forEach(function (s) { gr.addColorStop(s[0], s[1]); });
    g.fillStyle = gr; g.fillRect(0, 0, 256, 256); return new THREE.CanvasTexture(cv);
  }
  function glowSprite(size, tex) {
    var sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true }));
    sp.scale.set(size, size, 1); return sp;
  }
  var sunGlow = glowSprite(SUN_R * 5.6, glowTex([[0, 'rgba(255,240,200,0.95)'], [0.2, 'rgba(255,196,110,0.55)'], [0.45, 'rgba(255,140,50,0.18)'], [1, 'rgba(255,100,20,0)']]));
  scene.add(sunGlow);

  /* sky */
  var sky = new THREE.Group(); scene.add(sky);
  (function () {
    function gauss() { return (Math.random() + Math.random() + Math.random() + Math.random() - 2) / 0.58; }
    function make(n, bandFrac, size, alpha) {
      var pos = new Float32Array(n * 3), col = new Float32Array(n * 3);
      var q = new THREE.Quaternion().setFromUnitVectors(new V3(0, 1, 0), new V3(0.32, 0.88, 0.34).normalize());
      for (var i = 0; i < n; i++) {
        var v = new V3(), a = Math.random() * TAU;
        if (Math.random() < bandFrac) { var lat = gauss() * 0.13; v.set(Math.cos(a) * Math.cos(lat), Math.sin(lat), Math.sin(a) * Math.cos(lat)).applyQuaternion(q); }
        else { var u = Math.random() * 2 - 1, s = Math.sqrt(1 - u * u); v.set(s * Math.cos(a), u, s * Math.sin(a)); }
        v.multiplyScalar(60000); pos[i * 3] = v.x; pos[i * 3 + 1] = v.y; pos[i * 3 + 2] = v.z;
        var b = 0.3 + Math.pow(Math.random(), 3) * 0.7, w = Math.random();
        col[i * 3] = b * (0.85 + 0.15 * w); col[i * 3 + 1] = b * 0.92; col[i * 3 + 2] = b * (1 - 0.18 * w);
      }
      var g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('color', new THREE.BufferAttribute(col, 3));
      var p = new THREE.Points(g, new THREE.PointsMaterial({ size: size, sizeAttenuation: false, vertexColors: true, transparent: true, opacity: alpha, depthWrite: false }));
      p.frustumCulled = false; sky.add(p);
    }
    make(2600, 0, 1.6, 1); make(14000, 0.85, 1, 0.45);
  })();

  /* ---------- lights, ship ---------- */
  var sunLight = new THREE.DirectionalLight(0xfff1dc, 2.8); scene.add(sunLight); scene.add(sunLight.target);
  scene.add(new THREE.HemisphereLight(0x88a8d8, 0x2a2018, 1.1));
  var fillLight = new THREE.DirectionalLight(0xbcd2ff, 0.9); scene.add(fillLight); scene.add(fillLight.target);
  var shipG = new THREE.Group(); scene.add(shipG);
  var shipRoot = new THREE.Group(); shipG.add(shipRoot); shipRoot.scale.setScalar(1.25);
  (function () {
    var hull = new THREE.MeshStandardMaterial({ color: 0xdfe5ee, metalness: 0.25, roughness: 0.45 });
    var dark = new THREE.MeshStandardMaterial({ color: 0x2a3140, metalness: 0.3, roughness: 0.6 });
    var acc = new THREE.MeshStandardMaterial({ color: 0xff8a3d, metalness: 0.1, roughness: 0.5, emissive: 0x401800 });
    var glass = new THREE.MeshStandardMaterial({ color: 0x7fe3ff, metalness: 0.0, roughness: 0.1, emissive: 0x0a3a50 });
    var body = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.85, 4.0, 14), hull); body.rotation.x = Math.PI / 2; shipRoot.add(body);
    var nose = new THREE.Mesh(new THREE.ConeGeometry(0.55, 2.0, 14), hull); nose.rotation.x = -Math.PI / 2; nose.position.z = -3.0; shipRoot.add(nose);
    var tip = new THREE.Mesh(new THREE.SphereGeometry(0.12, 8, 8), acc); tip.position.z = -4.0; shipRoot.add(tip);
    var cock = new THREE.Mesh(new THREE.SphereGeometry(0.55, 12, 10), glass); cock.scale.set(0.8, 0.6, 1.5); cock.position.set(0, 0.5, -1.1); shipRoot.add(cock);
    [-1, 1].forEach(function (s) {
      var w = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.1, 1.9), hull); w.position.set(s * 1.7, -0.05, 0.9); w.rotation.y = s * -0.35; shipRoot.add(w);
      var tp = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.7, 1.1), acc); tp.position.set(s * 2.95, 0.3, 1.45); shipRoot.add(tp);
      var en = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.42, 1.3, 10), dark); en.rotation.x = Math.PI / 2; en.position.set(s * 0.85, -0.1, 2.3); shipRoot.add(en);
    });
    var fin = new THREE.Mesh(new THREE.BoxGeometry(0.1, 1.0, 1.2), acc); fin.position.set(0, 0.8, 1.9); shipRoot.add(fin);
  })();
  var engGlow = glowSprite(4.6, glowTex([[0, 'rgba(200,240,255,0.95)'], [0.3, 'rgba(110,190,255,0.6)'], [1, 'rgba(60,120,255,0)']]));
  engGlow.position.set(0, -0.1, 3.3); shipRoot.add(engGlow);

  /* ---------- layout ---------- */
  var UP = new V3(0, 1, 0);
  var BELT_R = 4750;

  /* ---------- obstacle fields ---------- */
  var rockGeo = new THREE.IcosahedronGeometry(1, 1);
  (function () {
    var p = rockGeo.attributes.position, v = new V3();
    for (var i = 0; i < p.count; i++) { v.fromBufferAttribute(p, i); var n = 0.78 + 0.5 * (Math.sin(v.x * 3.1 + v.y * 2.3) * Math.cos(v.z * 2.7 + v.x * 1.9) * 0.5 + 0.5); v.normalize().multiplyScalar(n); p.setXYZ(i, v.x, v.y, v.z); }
    rockGeo.computeVertexNormals();
  })();
  var dummy = new THREE.Object3D(), ZERO = new THREE.Matrix4().makeScale(0, 0, 0);
  function makeField(N, gen, baseColor, rough) {
    var f = { N: N, lx: new Float32Array(N), ly: new Float32Array(N), lz: new Float32Array(N), lr: new Float32Array(N), alive: new Uint8Array(N), inv: new THREE.Matrix4() };
    f.group = new THREE.Group(); f.spin = new THREE.Group(); f.group.add(f.spin); scene.add(f.group);
    f.mesh = new THREE.InstancedMesh(rockGeo, new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: rough, metalness: 0.05 }), N);
    f.mesh.frustumCulled = false; var col = new THREE.Color();
    for (var i = 0; i < N; i++) {
      var o = gen(i); f.lx[i] = o[0]; f.ly[i] = o[1]; f.lz[i] = o[2]; f.lr[i] = o[3]; f.alive[i] = 1;
      dummy.position.set(o[0], o[1], o[2]); dummy.rotation.set(Math.random() * 6, Math.random() * 6, Math.random() * 6);
      dummy.scale.set(o[3] * (0.8 + Math.random() * 0.5), o[3] * (0.7 + Math.random() * 0.5), o[3] * (0.8 + Math.random() * 0.5)); dummy.updateMatrix();
      f.mesh.setMatrixAt(i, dummy.matrix);
      var s = 0.55 + Math.random() * 0.45; baseColor(col, s); f.mesh.setColorAt(i, col);
    }
    f.spin.add(f.mesh); return f;
  }
  var belt = null, rings = null;
  (function () {
    belt = makeField(3200, function () {
      var a = Math.random() * TAU, rr = BELT_R + (Math.random() + Math.random() - 1) * 420, y = (Math.random() + Math.random() - 1) * 70, u = Math.random();
      return [Math.cos(a) * rr, y, Math.sin(a) * rr, u < 0.72 ? 4 + Math.random() * 6 : 9 + Math.random() * 10];
    }, function (c, s) { c.setRGB(0.50 * s, 0.44 * s, 0.38 * s); }, 0.95);
    var sat = bodies.saturn, R = sat.R;
    rings = makeField(1800, function () {
      var r = R * (1.32 + Math.random() * 0.93), a = Math.random() * TAU, thick = (Math.random() + Math.random() + Math.random() - 1.5) * 9;
      return [Math.cos(a) * r, thick, Math.sin(a) * r, Math.random() < 0.8 ? 1.4 + Math.random() * 2.2 : 3.4 + Math.random() * 3];
    }, function (c, s) { c.setRGB(0.85 * s + 0.1, 0.88 * s + 0.1, 0.95 * s + 0.05); }, 0.7);
    rings.group.position.copy(sat.pos); rings.group.quaternion.copy(sat.tilt.quaternion);
  })();

  /* energy orbs */
  var orbs = [];
  (function () {
    var pts = [bodies.earth.pos.clone().add(new V3(-40, 36, -560))].concat(ORDER.map(function (id) { return bodies[id].pos; }));
    var geo = new THREE.SphereGeometry(5, 14, 10), mat = new THREE.MeshBasicMaterial({ color: 0x7fe3ff }), gtex = glowTex([[0, 'rgba(160,240,255,0.9)'], [0.4, 'rgba(90,200,255,0.3)'], [1, 'rgba(60,160,255,0)']]);
    for (var i = 0; i < pts.length - 1; i++) {
      for (var k = 1; k <= 3; k++) {
        var t = k / 4, p = pts[i].clone().lerp(pts[i + 1], t); p.x += (Math.random() - 0.5) * 160; p.y += (Math.random() - 0.5) * 120; p.z += (Math.random() - 0.5) * 160;
        var m = new THREE.Mesh(geo, mat); m.position.copy(p); m.add(glowSprite(40, gtex)); scene.add(m); orbs.push({ mesh: m, got: false, t: Math.random() * 6 });
      }
    }
  })();

  /* speed lines & trail particles */
  var NL = 420, linePos = new Float32Array(NL * 6), lineBase = new Float32Array(NL * 3);
  var lineGeo = new THREE.BufferGeometry(); lineGeo.setAttribute('position', new THREE.BufferAttribute(linePos, 3));
  var lineMat = new THREE.LineBasicMaterial({ color: 0xbfe6ff, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending });
  var lines = new THREE.LineSegments(lineGeo, lineMat); lines.frustumCulled = false; scene.add(lines);
  var LB = 220;
  for (var li = 0; li < NL; li++) { lineBase[li * 3] = (Math.random() * 2 - 1) * LB; lineBase[li * 3 + 1] = (Math.random() * 2 - 1) * LB; lineBase[li * 3 + 2] = (Math.random() * 2 - 1) * LB; }
  var PN = 700, pPos = new Float32Array(PN * 3), pCol = new Float32Array(PN * 4), pSize = new Float32Array(PN);
  var pVel = new Float32Array(PN * 3), pLife = new Float32Array(PN), pMax = new Float32Array(PN), pBase = new Float32Array(PN * 3), pNext = 0;
  var pGeo = new THREE.BufferGeometry();
  pGeo.setAttribute('position', new THREE.BufferAttribute(pPos, 3)); pGeo.setAttribute('aCol', new THREE.BufferAttribute(pCol, 4)); pGeo.setAttribute('aSize', new THREE.BufferAttribute(pSize, 1));
  var pMat = new THREE.ShaderMaterial({
    uniforms: { uScale: { value: 600 } },
    vertexShader: 'attribute vec4 aCol; attribute float aSize; uniform float uScale; varying vec4 vC; void main(){ vC = aCol; vec4 mv = modelViewMatrix * vec4(position, 1.0); gl_PointSize = clamp(aSize * uScale / -mv.z, 1.0, 120.0); gl_Position = projectionMatrix * mv; }',
    fragmentShader: 'varying vec4 vC; void main(){ float d = length(gl_PointCoord - 0.5) * 2.0; if (d > 1.0) discard; float a = pow(1.0 - d, 1.6); gl_FragColor = vec4(vC.rgb * a * vC.a, a * vC.a); }',
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending });
  var pPts = new THREE.Points(pGeo, pMat); pPts.frustumCulled = false; scene.add(pPts);
  function emit(x, y, z, vx, vy, vz, life, size, r, g, b) {
    var i = pNext; pNext = (pNext + 1) % PN;
    pPos[i * 3] = x; pPos[i * 3 + 1] = y; pPos[i * 3 + 2] = z; pVel[i * 3] = vx; pVel[i * 3 + 1] = vy; pVel[i * 3 + 2] = vz;
    pLife[i] = life; pMax[i] = life; pSize[i] = size; pBase[i * 3] = r; pBase[i * 3 + 1] = g; pBase[i * 3 + 2] = b;
  }
  function updateParticles(dt) {
    for (var i = 0; i < PN; i++) {
      if (pLife[i] <= 0) { pCol[i * 4 + 3] = 0; continue; }
      pLife[i] -= dt; var k = Math.max(0, pLife[i] / pMax[i]);
      pPos[i * 3] += pVel[i * 3] * dt; pPos[i * 3 + 1] += pVel[i * 3 + 1] * dt; pPos[i * 3 + 2] += pVel[i * 3 + 2] * dt;
      pCol[i * 4] = pBase[i * 3]; pCol[i * 4 + 1] = pBase[i * 3 + 1]; pCol[i * 4 + 2] = pBase[i * 3 + 2]; pCol[i * 4 + 3] = k;
    }
    pGeo.attributes.position.needsUpdate = true; pGeo.attributes.aCol.needsUpdate = true; pGeo.attributes.aSize.needsUpdate = true;
  }
  function burst(p, n, speed, size, r, g, b, life) {
    for (var i = 0; i < n; i++) {
      var a = Math.random() * TAU, e = (Math.random() - 0.5) * 2, s = speed * (0.3 + Math.random() * 0.9), k = Math.sqrt(1 - e * e);
      emit(p.x, p.y, p.z, Math.cos(a) * k * s, e * s, Math.sin(a) * k * s, (life || 0.8) * (0.6 + Math.random() * 0.6), size * (0.6 + Math.random() * 0.8), r, g, b);
    }
  }

  /* ---------- HUD builders ---------- */
  var pipsEl = $('pips'), pips = [];
  ORDER.forEach(function (id) {
    var pp = document.createElement('span'); pp.className = 'pip'; pp.style.setProperty('--c', PL[id].col); pp.title = PL[id].name; pp.textContent = PL[id].short; pipsEl.appendChild(pp); pips.push(pp);
  });

  /* ---------- audio ---------- */
  var AC = null, master = null, muted = false, eng = null, engGain = null, whoosh = null, whooshGain = null, whooshF = null;
  function audioInit() {
    if (AC) { if (AC.state === 'suspended') AC.resume(); return; }
    try {
      AC = new (window.AudioContext || window.webkitAudioContext)(); master = AC.createGain(); master.gain.value = 0.0001; var comp = AC.createDynamicsCompressor(); comp.threshold.value = -18; comp.knee.value = 16; comp.ratio.value = 6; comp.attack.value = 0.003; comp.release.value = 0.2; master.connect(comp); comp.connect(AC.destination); master.gain.setTargetAtTime(muted ? 0.0001 : 0.5, AC.currentTime + 0.08, 0.15);
      eng = AC.createOscillator(); engGain = AC.createGain(); var lp = AC.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 220;
      eng.type = 'sawtooth'; eng.frequency.value = 50; engGain.gain.value = 0.0001; eng.connect(lp); lp.connect(engGain); engGain.connect(master); eng.start();
      var n = AC.sampleRate * 2, buf = AC.createBuffer(1, n, AC.sampleRate), d = buf.getChannelData(0); for (var i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
      whoosh = AC.createBufferSource(); whoosh.buffer = buf; whoosh.loop = true; whooshF = AC.createBiquadFilter(); whooshF.type = 'bandpass'; whooshF.frequency.value = 600; whooshF.Q.value = 0.7;
      whooshGain = AC.createGain(); whooshGain.gain.value = 0.0001; whoosh.connect(whooshF); whooshF.connect(whooshGain); whooshGain.connect(master); whoosh.start();
    } catch (e) { AC = null; }
  }
  function tone(f, dur, type, vol, f2, delay) {
    if (!AC) return; var t0 = AC.currentTime + (delay || 0), o = AC.createOscillator(), g = AC.createGain();
    o.type = type || 'sine'; o.frequency.setValueAtTime(f, t0); if (f2) o.frequency.exponentialRampToValueAtTime(f2, t0 + dur);
    g.gain.setValueAtTime(0.0001, t0); g.gain.exponentialRampToValueAtTime(vol, t0 + 0.022); g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    o.connect(g); g.connect(master); o.start(t0); o.stop(t0 + dur + 0.05);
  }
  function noiseHit(dur, vol, f0, f1) {
    if (!AC) return; var n = Math.floor(AC.sampleRate * dur), buf = AC.createBuffer(1, n, AC.sampleRate), d = buf.getChannelData(0);
    for (var i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
    var s = AC.createBufferSource(); s.buffer = buf; var f = AC.createBiquadFilter(); f.type = 'bandpass'; f.Q.value = 0.9;
    var t0 = AC.currentTime; f.frequency.setValueAtTime(f0, t0); f.frequency.exponentialRampToValueAtTime(f1, t0 + dur);
    var g = AC.createGain(); g.gain.setValueAtTime(vol, t0); g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur); s.connect(f); f.connect(g); g.connect(master); s.start();
  }
  var sfx = {
    gate: function () { [659, 880, 1175].forEach(function (f, i) { tone(f, 0.3, 'triangle', 0.18, null, i * 0.07); }); },
    hit: function (s) { tone(90, 0.3, 'sine', 0.5 * s, 36); noiseHit(0.2, 0.4 * s, 1600, 200); },
    orb: function () { tone(1200, 0.14, 'sine', 0.16, 1900); },
    warn: function () { tone(740, 0.1, 'square', 0.09); tone(740, 0.1, 'square', 0.09, null, 0.16); },
    boom: function () { tone(180, 1.2, 'sawtooth', 0.25, 28); noiseHit(1.0, 0.5, 2400, 100); },
    win: function () { [523, 659, 784, 1046, 1318].forEach(function (f, i) { tone(f, 0.5, 'triangle', 0.2, null, i * 0.12); }); },
    beep: function (hi) { var f = hi ? 1047 : 659; tone(f, 0.32, 'sine', 0.2, null, 0.12); tone(f * 2, 0.2, 'sine', 0.03, null, 0.12); }
  };
  $('bMute').addEventListener('click', function () { muted = !muted; $('bMute').setAttribute('aria-pressed', muted ? 'true' : 'false'); $('bMute').style.opacity = muted ? 0.55 : 1; if (master) master.gain.setTargetAtTime(muted ? 0.0001 : 0.5, AC.currentTime, 0.05); });

  window.addEventListener('pointerdown', function () { audioInit(); }, { once: true, capture: true });
  /* ---------- news / captions ---------- */
  var newsEl = $('news'), capEl = $('cap'), lastNews = -99, capTimer = 0;
  function news(text, kind, force) {
    var now = performance.now() / 1000; if (!force && now - lastNews < 0.8) return;
    var d = document.createElement('div'); d.className = 'toast' + (kind ? ' ' + kind : '');
    var em = document.createElement('em'); em.textContent = kind === 'bad' ? '警告' : (kind === 'good' ? '得分' : '通報'); d.appendChild(em);
    d.appendChild(document.createTextNode(text)); newsEl.appendChild(d); while (newsEl.children.length > 3) newsEl.removeChild(newsEl.firstChild);
    setTimeout(function () { if (d.parentNode) d.parentNode.removeChild(d); }, 4300); lastNews = now;
  }
  var FACTS = {
    mercury: ['水星', '太陽系最小的行星，公轉一圈只要 88 天，但自轉很慢，日出到日出要 176 個地球日。'],
    venus: ['金星', '自轉方向與其他行星相反，一天比一年還長；表面溫度高到足以熔化鉛。'],
    pluto: ['冥王星', '軌道傾斜又偏心，有時比海王星更靠近太陽；自轉像滾動般躺著。'],
    earth: ['地球', '唯一已知擁有液態海洋與生命的行星。夜側的點點燈火，是人類。'],
    mars: ['火星', '擁有太陽系最高的火山——奧林帕斯山，高約 22 公里。'],
    belt: ['小行星帶', '真實的小行星帶其實非常空曠。這個版本的比較擠，請見諒。'],
    jupiter: ['木星', '太陽系最大的行星。大紅斑是一場存在了近兩百年的風暴，寬度約與地球相當。'],
    saturn: ['土星環', '土星的密度比水還低；環寬幾十萬公里，厚度卻只有約十公尺到一公里。'],
    uranus: ['天王星', '側躺著繞太陽，一個冬天長達二十一年。'],
    neptune: ['海王星', '太陽系風速最快的行星，風速可超過每小時 2,000 公里。']
  };
  function caption(key) {
    var f = FACTS[key]; capEl.firstChild.textContent = f[0]; capEl.lastChild.textContent = f[1]; capEl.classList.add('on'); capTimer = 6.5;
  }
  var capSeen = {};

  /* ---------- game state ---------- */
  var mode = 'menu'; // menu | ready | play | pause | over
  var G = null;
  var HULL_MAX = 100, ENERGY_MAX = 100;
  var SPEED_BASE = 300, SPEED_BOOST = 700, SPEED_CRUISE = 300, SPEED_IDLE = 130, STRAFE_V = 150, LIFT_V = 120, ACC_MAIN = 190, ACC_BOOST = 520, ACC_SIDE = 130, ACC_BRAKE = 240, VMAX = 800, VMAX_BOOST = 1150, MU_SUN = 9.77e6, GS = 4.5, YAW_RATE = 0.8, PITCH_RATE = 0.65, FPFOV = 74, MSENS = 0.0008, SCOPE_FOV = 19, PHIT = 0.92;
  var SENS = 1, SENS_LV = [0.5, 1, 1.7], SENS_NM = ['低', '中', '高'], sensI = 1;
  try { var _si = parseInt(localStorage.getItem('pbSens2'), 10); if (_si >= 0 && _si <= 2) { sensI = _si; SENS = SENS_LV[sensI]; } } catch (_) {}
  var KMS = 0.1;
  var GRAV = { mercury: 3.7, venus: 8.9, earth: 9.8, mars: 3.7, jupiter: 24.8, saturn: 10.4, uranus: 8.9, neptune: 11.2, pluto: 0.62 };
  var tmpAcc = new V3(), tmpG = new V3(), tmpRel = new V3(), refVel = new V3(), gGrav = new V3();
  var PD = {
    mercury: { drones: 3, score: 1200 }, venus: { drones: 4, score: 1800 }, earth: { drones: 5, score: 1500 }, mars: { drones: 3, score: 1000 }, jupiter: { drones: 8, score: 3500 },
    saturn: { drones: 7, score: 3000 }, uranus: { drones: 5, score: 2200 }, neptune: { drones: 6, score: 2500 }, pluto: { drones: 4, score: 2000 }
  };
  var DESTROY_NEWS = {
    mercury: '水星被擊碎。它本來就繞太陽太近，現在終於不用再被烤了。',
    venus: '金星被擊碎。這下不用再擔心它的酸雨了。',
    earth: '地球被擊碎。保險公司：天災不理賠，這是你炸的。',
    mars: '火星被擊碎。火星人（如果有的話）：我們才剛搬來。',
    jupiter: '木星被擊碎，大紅斑終於不再是問題。',
    saturn: '土星被擊碎，環變成了一條漂亮的碎石帶。',
    uranus: '天王星被擊碎。這次不是側躺，是躺平。',
    neptune: '海王星被擊碎。太陽系最後的藍色也消失了。',
    pluto: '冥王星被擊碎。這次連「矮行星」的身分都不用爭了。'
  };
  var shake = 0, flashVig = 0, redVig = 0, slowT = 0, crossHit = 0, kick = 0;
  var invert = false; try { invert = localStorage.getItem('voyInv') === '1'; } catch (_) {}
  $('bInv').setAttribute('aria-pressed', invert ? 'true' : 'false'); $('bInv').style.opacity = invert ? 1 : 0.7;
  var fwd = new V3(), tmpA = new V3(), tmpB = new V3(), tmpC = new V3(), qTmp = new THREE.Quaternion();
  var events = [];
  function forwardOf(yaw, pitch, out) { var cp = Math.cos(pitch); return out.set(-Math.sin(yaw) * cp, Math.sin(pitch), -Math.cos(yaw) * cp); }

  /* planets as targets */
  ORDER.forEach(function (id) { var B = bodies[id]; B.hp = 1; B.maxHp = 1; B.state = 'alive'; B.dyingT = 0; B.u.dmg = { value: 0 }; B.u.flash = { value: 0 }; });

  /* ---------- weapon & effect systems ---------- */
  var NB = 720, NE = 320, NBUL = NB + NE, NBEAM = 8, NRIB = NBUL + NBEAM, UPV = new V3(0, 1, 0);
  var bAlive = new Uint8Array(NBUL), bPos = new Float32Array(NBUL * 3), bVel = new Float32Array(NBUL * 3), bLife = new Float32Array(NBUL), bOrg = new Float32Array(NBUL * 3);
  var bPierce = new Uint8Array(NBUL), bHome = new Uint8Array(NBUL), bKind = new Uint8Array(NBUL), bLen = new Float32Array(NBUL), bW = new Float32Array(NBUL), bCol = new Float32Array(NBUL * 3);
  var bulPos = new Float32Array(NBUL * 3), bulCol = new Float32Array(NBUL * 3), bulSize = new Float32Array(NBUL);
  var bulGeo = new THREE.BufferGeometry();
  bulGeo.setAttribute('position', new THREE.BufferAttribute(bulPos, 3)); bulGeo.setAttribute('aCol', new THREE.BufferAttribute(bulCol, 3)); bulGeo.setAttribute('aSize', new THREE.BufferAttribute(bulSize, 1));
  var bulPts = new THREE.Points(bulGeo, new THREE.ShaderMaterial({
    uniforms: { uPx: { value: DPR } },
    vertexShader: 'attribute vec3 aCol; attribute float aSize; uniform float uPx; varying vec3 vC; void main(){ vC = aCol; gl_PointSize = aSize * uPx; gl_Position = projectionMatrix * viewMatrix * vec4(position, 1.0); }',
    fragmentShader: 'varying vec3 vC; void main(){ float d = length(gl_PointCoord - 0.5) * 2.0; if (d > 1.0) discard; float a = pow(1.0 - d, 1.4); gl_FragColor = vec4(mix(vC, vec3(1.0), 0.55) * a, a); }',
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
  bulPts.frustumCulled = false; scene.add(bulPts);
  /* stretched energy-bolt ribbons (bullets + beams share one mesh) */
  var ribPos = new Float32Array(NRIB * 12), ribUv = new Float32Array(NRIB * 8), ribCol = new Float32Array(NRIB * 12), ribIdx = new Uint16Array(NRIB * 6);
  (function () {
    for (var i = 0; i < NRIB; i++) { var o = i * 4; ribUv.set([0, -1, 0, 1, 1, -1, 1, 1], i * 8); ribIdx.set([o, o + 1, o + 2, o + 1, o + 3, o + 2], i * 6); for (var k = 0; k < 4; k++) ribPos[i * 12 + k * 3 + 1] = -1e7; }
  })();
  var ribGeo = new THREE.BufferGeometry();
  ribGeo.setAttribute('position', new THREE.BufferAttribute(ribPos, 3)); ribGeo.setAttribute('uv', new THREE.BufferAttribute(ribUv, 2)); ribGeo.setAttribute('aC', new THREE.BufferAttribute(ribCol, 3)); ribGeo.setIndex(new THREE.BufferAttribute(ribIdx, 1));
  var ribMesh = new THREE.Mesh(ribGeo, new THREE.ShaderMaterial({
    vertexShader: 'attribute vec3 aC; varying vec2 vUv; varying vec3 vC; void main(){ vUv = uv; vC = aC; gl_Position = projectionMatrix * viewMatrix * vec4(position, 1.0); }',
    fragmentShader: 'varying vec2 vUv; varying vec3 vC; void main(){ float v = vUv.y, u = vUv.x; float along = smoothstep(0.0, 0.8, u) * (1.0 - smoothstep(0.9, 1.0, u)); float core = exp(-v * v * 18.0); float glow = exp(-v * v * 3.4) * 0.6; vec3 c = vC * glow + vec3(1.0) * core * 0.95 + vC * core * 0.35; gl_FragColor = vec4(c * along, 1.0); }',
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide }));
  ribMesh.frustumCulled = false; scene.add(ribMesh);
  var beams = []; for (var bmI = 0; bmI < NBEAM; bmI++) beams.push({ on: false, a: new V3(), b: new V3(), w: 1, r: 1, g: 1, bl: 1, k: 1 });
  function setBeam(i, a, b, w, r, g, bl, k) { var m = beams[i]; m.on = true; m.a.copy(a); m.b.copy(b); m.w = w; m.r = r; m.g = g; m.bl = bl; m.k = k; }
  function clearBeam(i) { beams[i].on = false; }
  var rq = new V3(), rd = new V3(), rs = new V3();
  function hideRib(slot) { var o = slot * 12; for (var k = 0; k < 4; k++) ribPos[o + k * 3 + 1] = -1e7; }
  function writeRib(slot, hx, hy, hz, tx, ty, tz, hwMin, hwMax, r, g, b, kk) {
    rd.set(hx - tx, hy - ty, hz - tz); var L = rd.length(); if (L < 1e-3) { hideRib(slot); return; } rd.multiplyScalar(1 / L);
    var mx = (hx + tx) * 0.5, my = (hy + ty) * 0.5, mz = (hz + tz) * 0.5; rq.set(camera.position.x - mx, camera.position.y - my, camera.position.z - mz);
    var dist = rq.length(), hw = Math.max(dist * 0.002 * (kk || 1), Math.min(dist * 0.0036 * (kk || 1), hwMax)); if (hwMin > hw) hw = hwMin;
    rs.crossVectors(rd, rq); var sl = rs.length(); if (sl < 1e-3) { rs.crossVectors(rd, UPV); sl = rs.length() || 1; } rs.multiplyScalar(hw / sl);
    var o = slot * 12;
    ribPos[o] = tx - rs.x; ribPos[o + 1] = ty - rs.y; ribPos[o + 2] = tz - rs.z; ribPos[o + 3] = tx + rs.x; ribPos[o + 4] = ty + rs.y; ribPos[o + 5] = tz + rs.z;
    ribPos[o + 6] = hx - rs.x; ribPos[o + 7] = hy - rs.y; ribPos[o + 8] = hz - rs.z; ribPos[o + 9] = hx + rs.x; ribPos[o + 10] = hy + rs.y; ribPos[o + 11] = hz + rs.z;
    for (var k = 0; k < 4; k++) { ribCol[o + k * 3] = r; ribCol[o + k * 3 + 1] = g; ribCol[o + k * 3 + 2] = b; }
  }
  function spawnBullet(isPlayer, p, v, life, o) {
    o = o || {}; var s = isPlayer ? 0 : NB, e = isPlayer ? NB : NBUL;
    var fi = -1, oldL = 1e9; for (var i = s; i < e; i++) { if (!bAlive[i]) { fi = i; break; } if (isPlayer && bLife[i] < oldL) { oldL = bLife[i]; fi = i; } }
    if (fi >= 0) { var i = fi;
      bAlive[i] = 1; bPos[i * 3] = p.x; bPos[i * 3 + 1] = p.y; bPos[i * 3 + 2] = p.z; bOrg[i * 3] = p.x; bOrg[i * 3 + 1] = p.y; bOrg[i * 3 + 2] = p.z;
      bVel[i * 3] = v.x; bVel[i * 3 + 1] = v.y; bVel[i * 3 + 2] = v.z; bLife[i] = life; bKind[i] = o.kind || 0; bPierce[i] = o.pierce || 0; bHome[i] = o.home || 0;
      bLen[i] = o.len || (isPlayer ? 40 : 36); bW[i] = o.w || (isPlayer ? 22 : 1.5);
      var c = o.col || (isPlayer ? [0.3, 0.85, 1.0] : [1.0, 0.32, 0.16]);
      bCol[i * 3] = c[0]; bCol[i * 3 + 1] = c[1]; bCol[i * 3 + 2] = c[2]; bulCol[i * 3] = c[0]; bulCol[i * 3 + 1] = c[1]; bulCol[i * 3 + 2] = c[2];
      return i;
    }
    return -1;
  }
  function syncBullets() {
    for (var i = 0; i < NBUL; i++) {
      if (!bAlive[i]) { bulSize[i] = 0; bulPos[i * 3 + 1] = -1e7; hideRib(i); continue; }
      var x = bPos[i * 3], y = bPos[i * 3 + 1], z = bPos[i * 3 + 2];
      bulPos[i * 3] = x; bulPos[i * 3 + 1] = y; bulPos[i * 3 + 2] = z; bulSize[i] = i < NB ? 15 : (bKind[i] === 2 ? 26 : (bKind[i] === 1 ? 11 : 14));
      var vx = bVel[i * 3], vy = bVel[i * 3 + 1], vz = bVel[i * 3 + 2], sp = Math.sqrt(vx * vx + vy * vy + vz * vz) || 1;
      var ox = x - bOrg[i * 3], oy = y - bOrg[i * 3 + 1], oz = z - bOrg[i * 3 + 2], od = Math.sqrt(ox * ox + oy * oy + oz * oz), L = Math.min(bLen[i], od);
      writeRib(i, x, y, z, x - vx / sp * L, y - vy / sp * L, z - vz / sp * L, 0, bW[i], bCol[i * 3], bCol[i * 3 + 1], bCol[i * 3 + 2], i < NB ? 5.5 : 1);
    }
    for (var q = 0; q < NBEAM; q++) {
      var m = beams[q]; if (!m.on) { hideRib(NBUL + q); continue; }
      writeRib(NBUL + q, m.b.x, m.b.y, m.b.z, m.a.x, m.a.y, m.a.z, 0, m.w, m.r * m.k, m.g * m.k, m.bl * m.k);
    }
    bulGeo.attributes.position.needsUpdate = true; bulGeo.attributes.aSize.needsUpdate = true; bulGeo.attributes.aCol.needsUpdate = true;
    ribGeo.attributes.position.needsUpdate = true; ribGeo.attributes.aC.needsUpdate = true;
  }

  /* shock rings + fireballs */
  var ringTex = glowTex([[0, 'rgba(255,255,255,0)'], [0.82, 'rgba(255,255,255,0)'], [0.93, 'rgba(255,255,255,1)'], [1, 'rgba(255,255,255,0)']]);
  var fbTex = glowTex([[0, 'rgba(255,255,230,1)'], [0.25, 'rgba(255,200,110,0.85)'], [0.6, 'rgba(255,110,40,0.35)'], [1, 'rgba(255,60,20,0)']]);
  var rings3 = [], fireballs = [];
  for (var ri = 0; ri < 8; ri++) {
    var rm = new THREE.Sprite(new THREE.SpriteMaterial({ map: ringTex, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, depthTest: false }));
    rm.visible = false; scene.add(rm); rings3.push({ s: rm, t: 1, dur: 1, size: 1 });
  }
  for (var fi = 0; fi < 6; fi++) {
    var fs = new THREE.Sprite(new THREE.SpriteMaterial({ map: fbTex, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
    fs.visible = false; scene.add(fs); fireballs.push({ s: fs, t: 1, dur: 1, size: 1 });
  }
  var ringN = 0, fbN = 0;
  function ring(p, size, color, dur) { var r = rings3[ringN]; ringN = (ringN + 1) % rings3.length; r.t = 0; r.size = size; r.dur = dur; r.s.position.copy(p); r.s.material.color.setHex(color); r.s.visible = true; }
  function fireball(p, size, dur) { var f = fireballs[fbN]; fbN = (fbN + 1) % fireballs.length; f.t = 0; f.size = size; f.dur = dur; f.s.position.copy(p); f.s.visible = true; }
  function updateFx(dt) {
    rings3.forEach(function (r) { if (!r.s.visible) return; r.t += dt / r.dur; if (r.t >= 1) { r.s.visible = false; return; } var e = 1 - Math.pow(1 - r.t, 2.4); r.s.scale.setScalar(Math.max(0.01, r.size * (0.05 + e))); r.s.material.opacity = (1 - r.t) * 0.9; });
    fireballs.forEach(function (f) { if (!f.s.visible) return; f.t += dt / f.dur; if (f.t >= 1) { f.s.visible = false; return; } var e = 1 - Math.pow(1 - f.t, 2); f.s.scale.setScalar(Math.max(0.01, f.size * (0.2 + 0.8 * e))); f.s.material.opacity = Math.min(1, (1 - f.t) * 1.6); });
  }

  /* ---------- per-planet disintegration effects (space + tech look) ---------- */
  var PFX_TH = {
    mercury: { a: 0xffa347, b: 0xfff0d0, tilt: 0.0, lat: 'ico1' },
    venus: { a: 0xe6d84a, b: 0xfff6b0, tilt: 3.1, lat: 'dodeca' },
    earth: { a: 0x3ad0ff, b: 0x9dffd0, tilt: 0.41, lat: 'ico2' },
    mars: { a: 0xff5a2a, b: 0xffc08a, tilt: 0.44, lat: 'octa' },
    jupiter: { a: 0xffa860, b: 0xfff2d8, tilt: 0.05, lat: 'ico2' },
    saturn: { a: 0xf0cf7a, b: 0xfff3c8, tilt: 0.47, lat: 'ico1' },
    uranus: { a: 0x7fffe8, b: 0xe8ffff, tilt: 1.71, lat: 'octa' },
    neptune: { a: 0x3f6bff, b: 0xb48cff, tilt: 0.5, lat: 'ico2' },
    pluto: { a: 0xffd8e8, b: 0xffffff, tilt: 2.1, lat: 'octa' }
  };
  var pfxGeo = { ring: new THREE.RingGeometry(0.94, 1, 96), annulus: new THREE.RingGeometry(1.25, 2.3, 96), sph: new THREE.SphereGeometry(1, 24, 16), ico1: new THREE.IcosahedronGeometry(1, 1), ico2: new THREE.IcosahedronGeometry(1, 2), octa: new THREE.OctahedronGeometry(1, 0), dodeca: new THREE.DodecahedronGeometry(1, 0), tetra: new THREE.TetrahedronGeometry(1, 0) };
  var pfxGlowTex = glowTex([[0, 'rgba(255,255,255,1)'], [0.3, 'rgba(255,255,255,0.45)'], [1, 'rgba(255,255,255,0)']]);
  var pfxL = [], pfxZ = new V3(0, 0, 1), pfxQ = new THREE.Quaternion(), pfxN = new V3();
  function pfxNormal(tilt, out) { return (out || new V3()).set(Math.sin(tilt), Math.cos(tilt), 0.12).normalize(); }
  function pfxQuat(n) { return new THREE.Quaternion().setFromUnitVectors(pfxZ, n); }
  function pfx(o) {
    var m;
    if (o.sprite) m = new THREE.Sprite(new THREE.SpriteMaterial({ map: pfxGlowTex, color: o.col, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false }));
    else if (o.lines) m = new THREE.LineSegments(o.geoObj, new THREE.LineBasicMaterial({ color: o.col, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false }));
    else m = new THREE.Mesh(pfxGeo[o.geo], new THREE.MeshBasicMaterial({ color: o.col, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, wireframe: !!o.wire }));
    m.position.copy(o.pos); if (o.q) m.quaternion.copy(o.q); m.scale.setScalar(Math.max(0.001, o.s0)); m.visible = false; m.frustumCulled = false; m.renderOrder = 6; scene.add(m);
    o.m = m; o.t = 0; pfxL.push(o); return o;
  }
  function pfxFree(o) { scene.remove(o.m); if (o.m.material) o.m.material.dispose(); if (o.geoObj) o.geoObj.dispose(); }
  function clearPfx() { for (var i = pfxL.length - 1; i >= 0; i--) pfxFree(pfxL[i]); pfxL.length = 0; }
  function updatePfx(dt) {
    for (var i = pfxL.length - 1; i >= 0; i--) {
      var o = pfxL[i]; o.t += dt; var tt = o.t - (o.delay || 0); if (tt < 0) continue; var u = tt / o.dur;
      if (u >= 1) { pfxFree(o); pfxL.splice(i, 1); continue; }
      var m = o.m; m.visible = true;
      var e = o.ease === 'in' ? u * u : (o.ease === 'lin' ? u : 1 - Math.pow(1 - u, 2.2)), s = o.s0 + (o.s1 - o.s0) * e;
      if (o.sy) m.scale.set(s, s * o.sy, s); else m.scale.setScalar(Math.max(0.001, s));
      if (o.vel) m.position.addScaledVector(o.vel, dt);
      if (o.rz) m.rotateZ(o.rz * dt); if (o.spin) { m.rotation.x += o.spin[0] * dt; m.rotation.y += o.spin[1] * dt; m.rotation.z += o.spin[2] * dt; }
      var fi = o.fin ? Math.min(1, tt / o.fin) : 1, fl = o.flick ? (0.65 + 0.35 * Math.sin(o.t * o.flick)) : 1;
      m.material.opacity = o.op * fi * fl * Math.pow(1 - u, o.k === undefined ? 1.3 : o.k);
      if (o.upd) o.upd(o, u, dt);
    }
  }
  function pfxSpikes(n, inner, jit) {
    var arr = [];
    for (var i = 0; i < n; i++) { var a = Math.random() * TAU, e = Math.random() * 2 - 1, kk = Math.sqrt(1 - e * e), dx = Math.cos(a) * kk, dz = Math.sin(a) * kk, l = inner + Math.random() * jit; arr.push(dx * inner, e * inner, dz * inner, dx * l, e * l, dz * l); }
    var g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(arr), 3)); return g;
  }
  function pfxBolts(n, segs, R) {
    var arr = [];
    for (var i = 0; i < n; i++) {
      var a = Math.random() * TAU, e = Math.random() * 1.6 - 0.8, kk = Math.sqrt(1 - e * e), d = new V3(Math.cos(a) * kk, e, Math.sin(a) * kk), pr = new V3(0, 0, 0);
      for (var s = 0; s < segs; s++) { var nx = d.clone().multiplyScalar((s + 1) / segs * R).add(new V3((Math.random() - 0.5) * 0.18 * R, (Math.random() - 0.5) * 0.18 * R, (Math.random() - 0.5) * 0.18 * R)); arr.push(pr.x, pr.y, pr.z, nx.x, nx.y, nx.z); pr = nx; }
    }
    var g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(arr), 3)); return g;
  }
  function pfxRingAt(P, n, col, s0, s1, dur, delay, op, extra) {
    var o = { geo: 'ring', col: col, op: op || 0.95, pos: P.clone(), q: pfxQuat(n), s0: s0, s1: s1, dur: dur, delay: delay || 0, k: 1.1 }; if (extra) for (var k in extra) o[k] = extra[k]; return pfx(o);
  }
  function pfxGlow(P, col, s0, s1, dur, delay, op) { return pfx({ sprite: true, col: col, op: op || 0.9, pos: P.clone(), s0: s0, s1: s1, dur: dur, delay: delay || 0, k: 1.6 }); }
  function pfxRandQ() { return new THREE.Quaternion().setFromUnitVectors(pfxZ, new V3(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).normalize()); }
  /* the 1.5 s collapse before the break: scanning lattice + contracting lock rings + a sweeping scan plane */
  function pfxDying(B) {
    var th = PFX_TH[B.id], R = B.R, n = pfxNormal(th.tilt), P = B.pos.clone(), follow = function (o) { o.m.position.copy(B.pos); };
    pfx({ geo: th.lat, wire: true, col: th.a, op: 0.9, pos: P, s0: R * 1.04, s1: R * 1.12, dur: 1.5, k: 0.2, fin: 0.15, flick: 34, rz: 0.8, upd: follow });
    for (var i = 0; i < 3; i++) pfxRingAt(P, n, i === 1 ? th.b : th.a, R * 2.6, R * 1.02, 0.55, i * 0.45, 0.9, { fin: 0.1, k: 0.3, ease: 'in', upd: follow });
    pfx({ geo: 'ring', col: th.b, op: 0.9, pos: P, q: pfxQuat(n), s0: R, s1: R, dur: 1.4, k: 0.1, ease: 'lin', upd: function (o, u) { var h = (u * 2 - 1) * 0.95; o.m.position.copy(B.pos).addScaledVector(n, h * R); o.m.scale.setScalar(R * 1.03 * Math.sqrt(Math.max(0.02, 1 - h * h))); } });
  }
  function planetFx(B) {
    var id = B.id, th = PFX_TH[id], R = B.R, P = B.pos.clone(), n = pfxNormal(th.tilt), up = n.clone(), i, c = new THREE.Color(th.a);
    pfxGlow(P, th.b, R * 2.2, R * 5.5, 0.7, 0, 1);
    shake = Math.max(shake, 1.2);
    if (id === 'mercury') {
      pfx({ lines: true, geoObj: pfxSpikes(70, R * 1.0, R * 1.6), col: th.b, op: 1, pos: P, s0: 1, s1: 3.6, dur: 0.8, k: 1.0 });
      pfx({ lines: true, geoObj: pfxSpikes(50, R * 1.0, R * 2.6), col: th.a, op: 0.9, pos: P, s0: 1, s1: 4.8, dur: 1.1, k: 1.2 });
      for (i = 0; i < 4; i++) pfx({ geo: 'ring', col: i % 2 ? th.b : th.a, op: 0.95, pos: P, q: pfxRandQ(), s0: R, s1: R * (7 + i * 1.6), dur: 0.55 + i * 0.18, k: 1.0 });
      pfx({ geo: 'ico1', wire: true, col: th.a, op: 0.9, pos: P, s0: R, s1: R * 3.4, dur: 0.9, rz: 3, spin: [1.5, 2, 0] });
    } else if (id === 'venus') {
      pfx({ geo: 'dodeca', wire: true, col: th.a, op: 0.95, pos: P, s0: R * 1.2, s1: R * 0.55, dur: 0.4, k: 0.2, ease: 'in', spin: [0, 3, 0] });
      for (i = 0; i < 3; i++) pfx({ geo: 'sph', col: i === 0 ? 0xffe97a : (i === 1 ? 0xc9d83a : 0xff9a3a), op: 0.22, pos: P, s0: R * 0.5, s1: R * (3.2 + i * 1.1), dur: 2.4 + i * 0.5, delay: 0.38 + i * 0.12, k: 1.1, ease: 'out' });
      pfxRingAt(P, n, th.a, R * 1.0, R * 5.5, 2.2, 0.4, 0.8); pfxRingAt(P, n, th.b, R * 1.0, R * 8, 2.8, 0.55, 0.5);
      pfx({ geo: 'dodeca', wire: true, col: th.b, op: 0.7, pos: P, s0: R * 0.6, s1: R * 3.4, dur: 2.4, delay: 0.38, rz: 1.5, spin: [0.6, 0.9, 0] });
    } else if (id === 'earth') {
      for (i = 0; i < 6; i++) { var h = (i / 5 * 2 - 1) * 0.82; pfx({ geo: 'ring', col: i % 2 ? th.a : th.b, op: 0.95, pos: P.clone().addScaledVector(n, h * R), q: pfxQuat(n), s0: R * Math.sqrt(1 - h * h), s1: R * Math.sqrt(1 - h * h) * 3.6, dur: 1.5 + i * 0.1, delay: i * 0.07, vel: n.clone().multiplyScalar(h * R * 0.9), k: 1.0 }); }
      pfx({ geo: 'ico2', wire: true, col: th.a, op: 0.9, pos: P, s0: R, s1: R * 2.6, dur: 1.4, rz: 0.5, k: 0.9 });
      pfxRingAt(P, n, 0xffffff, R, R * 9, 1.0, 0.1); pfxRingAt(P, n, th.a, R, R * 12, 1.6, 0.25, 0.7);
      pfx({ geo: 'sph', col: 0x3aa0ff, op: 0.18, pos: P, s0: R, s1: R * 3.5, dur: 1.8 });
    } else if (id === 'mars') {
      for (i = 0; i < 3; i++) pfx({ geo: 'sph', col: i === 0 ? 0xff5a2a : (i === 1 ? 0xc0391a : 0xffa070), op: 0.25, pos: P, s0: R * 0.8, s1: R * (4 + i * 1.2), dur: 2.0 + i * 0.4, delay: i * 0.08, k: 1.0 });
      pfx({ lines: true, geoObj: pfxSpikes(90, R * 1.0, R * 2.2), col: th.b, op: 0.9, pos: P, s0: 1, s1: 3.8, dur: 1.2, k: 1.1 });
      pfx({ geo: 'ring', col: th.a, op: 0.9, pos: P, q: pfxQuat(new V3(0, 1, 0)), s0: R, s1: R * 9, dur: 1.8, k: 1.0 }); pfxRingAt(P, n, th.b, R, R * 6, 1.2, 0.15);
      pfx({ geo: 'octa', wire: true, col: th.a, op: 0.95, pos: P, s0: R * 1.1, s1: R * 3.0, dur: 1.1, rz: 2, spin: [1, 1.4, 0] });
    } else if (id === 'jupiter') {
      for (i = 0; i < 7; i++) { var hh = (i / 6 * 2 - 1) * 0.75; pfx({ geo: 'ring', col: i % 2 ? 0xfff2d8 : 0xff9a50, op: 0.95, pos: P.clone().addScaledVector(n, hh * R), q: pfxQuat(n), s0: R * Math.sqrt(1 - hh * hh), s1: R * (3.5 + (i % 3) * 1.8) * Math.sqrt(1 - hh * hh) + R * 1.5, dur: 1.3 + (i % 3) * 0.35, vel: n.clone().multiplyScalar(hh * R * 0.5), rz: (i % 2 ? 1 : -1) * 2, k: 1.0 }); }
      for (i = 0; i < 3; i++) pfx({ lines: true, geoObj: pfxBolts(14, 7, R * (2.4 + i * 0.7)), col: i === 0 ? 0xffffff : 0xb8d8ff, op: 1, pos: P, s0: 1, s1: 1.15, dur: 0.35 + i * 0.12, delay: i * 0.16, k: 0.8, flick: 90 });
      pfx({ geo: 'ico2', wire: true, col: th.a, op: 0.8, pos: P, s0: R, s1: R * 2.4, dur: 1.2 });
    } else if (id === 'saturn') {
      pfx({ geo: 'annulus', col: th.a, op: 0.75, pos: P, q: pfxQuat(n), s0: R, s1: R * 2.8, dur: 2.0, rz: 1.4, k: 1.0 });
      pfx({ geo: 'annulus', col: th.b, op: 0.5, pos: P, q: pfxQuat(n), s0: R * 0.8, s1: R * 3.6, dur: 2.4, rz: -0.9, delay: 0.1, k: 1.0 });
      for (i = 0; i < 3; i++) pfxRingAt(P, n, i === 1 ? th.b : th.a, R * 1.2, R * (6 + i * 2.2), 1.2 + i * 0.3, i * 0.12, 0.9, { rz: 2 });
      pfx({ geo: 'ico1', wire: true, col: th.a, op: 0.8, pos: P, s0: R, s1: R * 2.4, dur: 1.2, rz: 1 });
      pfx({ upd: function (o, u, dt) { for (var q = 0; q < 6; q++) { var a = Math.random() * TAU, rr = R * (1.3 + u * 2.2 + Math.random() * 0.8), s = 40 + u * 90; var d = new V3(Math.cos(a), 0, Math.sin(a)).applyQuaternion(pfxQuat(n)); emit(P.x + d.x * rr, P.y + d.y * rr, P.z + d.z * rr, d.x * s, d.y * s, d.z * s, 1.1, Math.max(2, R * 0.03), c.r, c.g, c.b); } }, sprite: true, col: 0, op: 0, pos: P, s0: 1, s1: 1, dur: 1.4 });
    } else if (id === 'uranus') {
      for (i = 0; i < 3; i++) pfxRingAt(P, n, i === 0 ? th.b : th.a, R * 1.1, R * (5.5 + i * 2), 1.1 + i * 0.3, i * 0.1, 0.95, { rz: 1 + i });
      for (i = 0; i < 14; i++) { var sd = new V3(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).normalize(), sz = R * (0.12 + Math.random() * 0.2); pfx({ geo: i % 3 ? 'octa' : 'tetra', wire: i % 2 === 0, col: i % 2 ? 0xffffff : th.a, op: 0.95, pos: P.clone().addScaledVector(sd, R * 0.4), s0: sz, s1: sz * 0.7, dur: 1.8 + Math.random() * 0.8, vel: sd.clone().multiplyScalar(R * (1.4 + Math.random() * 1.6)), spin: [Math.random() * 4, Math.random() * 4, Math.random() * 4], k: 0.6, ease: 'lin' }); }
      pfx({ geo: 'octa', wire: true, col: th.a, op: 0.9, pos: P, s0: R * 1.05, s1: R * 3.2, dur: 1.3, spin: [0.5, 1.2, 0.3] });
      pfx({ lines: true, geoObj: pfxSpikes(36, R * 1.0, R * 2.0), col: th.b, op: 0.9, pos: P, s0: 1, s1: 3.4, dur: 1.0 });
    } else if (id === 'neptune') {
      pfx({ geo: 'ico2', wire: true, col: th.a, op: 0.9, pos: P, s0: R * 1.2, s1: R * 0.7, dur: 0.35, ease: 'in', k: 0.2 });
      for (i = 0; i < 4; i++) pfxRingAt(P, n, i % 2 ? th.b : th.a, R * 0.9, R * (7 + i * 1.5), 0.7 + i * 0.2, 0.3 + i * 0.07, 0.95, { rz: 3 });
      pfx({ geo: 'sph', col: 0x2a46d8, op: 0.25, pos: P, s0: R * 0.6, s1: R * 4.2, dur: 1.8, delay: 0.3 });
      pfx({ geo: 'ico2', wire: true, col: th.b, op: 0.8, pos: P, s0: R * 0.7, s1: R * 3.4, dur: 1.5, delay: 0.3, rz: 2 });
      var bq = pfxQuat(n); pfx({ upd: function (o, u, dt) { var base = o.t * 7; for (var arm = 0; arm < 4; arm++) for (var j = 0; j < 3; j++) { var a = base + arm * Math.PI / 2 + j * 0.5, rr = R * (0.8 + u * 3.2 + j * 0.25), d = new V3(Math.cos(a), (Math.random() - 0.5) * 0.2, Math.sin(a)).applyQuaternion(bq), tc = arm % 2 ? th.b : th.a, cc = new THREE.Color(tc); emit(P.x + d.x * rr, P.y + d.y * rr, P.z + d.z * rr, -d.z * 90, d.y * 20, d.x * 90, 0.9, Math.max(2, R * 0.03), cc.r, cc.g, cc.b); } }, sprite: true, col: 0, op: 0, pos: P, s0: 1, s1: 1, dur: 1.7, delay: 0.3 });
    } else {
      pfx({ geo: 'octa', wire: true, col: th.a, op: 0.95, pos: P, s0: R * 1.15, s1: R * 0.6, dur: 0.5, ease: 'in', k: 0.2, spin: [0, 2, 0] });
      pfxRingAt(P, n, th.b, R, R * 7, 2.2, 0.5, 0.7); pfxRingAt(P, n, th.a, R, R * 11, 3.0, 0.7, 0.45);
      for (i = 0; i < 16; i++) { var sd2 = new V3(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).normalize(), sz2 = R * (0.1 + Math.random() * 0.22); pfx({ geo: i % 2 ? 'tetra' : 'octa', wire: i % 3 === 0, col: i % 2 ? 0xffffff : th.a, op: 0.95, pos: P.clone().addScaledVector(sd2, R * 0.3), s0: sz2, s1: sz2 * 0.8, dur: 3.0 + Math.random() * 1.5, delay: 0.5, vel: sd2.clone().multiplyScalar(R * (0.5 + Math.random() * 1.0)), spin: [Math.random() * 2, Math.random() * 2, Math.random() * 2], k: 0.7, ease: 'lin' }); }
      pfx({ geo: 'sph', col: 0xffffff, op: 0.3, pos: P, s0: R * 0.5, s1: R * 2.4, dur: 1.2, delay: 0.5 });
    }
  }
  /* debris */
  var ND = 1600, dPos = new Float32Array(ND * 3), dVel = new Float32Array(ND * 3), dSc = new Float32Array(ND), dLife = new Float32Array(ND), dMax = new Float32Array(ND), dRot = new Float32Array(ND * 3), dAng = new Float32Array(ND * 3), dNext = 0, dActive = 0;
  var debMesh = new THREE.InstancedMesh(rockGeo, new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.85, metalness: 0.05, emissive: 0x331100, emissiveIntensity: 0.0 }), ND);
  debMesh.frustumCulled = false; scene.add(debMesh);
  (function () { var c = new THREE.Color(1, 1, 1); for (var i = 0; i < ND; i++) { debMesh.setMatrixAt(i, ZERO); debMesh.setColorAt(i, c); } })();
  function spawnDebris(B, n) {
    var base = new THREE.Color(PL[B.id].col), c = new THREE.Color();
    for (var k = 0; k < n; k++) {
      var i = dNext; dNext = (dNext + 1) % ND;
      var a = Math.random() * TAU, e = Math.random() * 2 - 1, kk = Math.sqrt(1 - e * e), r = Math.pow(Math.random(), 0.6) * B.R * 0.92;
      var dx = Math.cos(a) * kk, dy = e, dz = Math.sin(a) * kk;
      dPos[i * 3] = B.pos.x + dx * r; dPos[i * 3 + 1] = B.pos.y + dy * r; dPos[i * 3 + 2] = B.pos.z + dz * r;
      var sp = (30 + Math.random() * 1.0 * B.R * 0.7) * (0.4 + r / B.R);
      dVel[i * 3] = dx * sp; dVel[i * 3 + 1] = dy * sp; dVel[i * 3 + 2] = dz * sp;
      dSc[i] = 2 + Math.pow(Math.random(), 2.4) * Math.max(5, B.R * 0.075); dLife[i] = dMax[i] = 5 + Math.random() * 4;
      dRot[i * 3] = (Math.random() - 0.5) * 3; dRot[i * 3 + 1] = (Math.random() - 0.5) * 3; dRot[i * 3 + 2] = (Math.random() - 0.5) * 3;
      dAng[i * 3] = Math.random() * 6; dAng[i * 3 + 1] = Math.random() * 6; dAng[i * 3 + 2] = Math.random() * 6;
      var br = 0.35 + Math.random() * 0.9; c.copy(base).multiplyScalar(br); debMesh.setColorAt(i, c);
    }
    debMesh.instanceColor.needsUpdate = true; dActive = Math.min(ND, dActive + n);
  }
  function updateDebris(dt) {
    if (dActive <= 0) return; var any = 0, drag = Math.exp(-0.3 * dt);
    for (var i = 0; i < ND; i++) {
      if (dLife[i] <= 0) continue; dLife[i] -= dt; any++;
      if (dLife[i] <= 0) { debMesh.setMatrixAt(i, ZERO); continue; }
      dVel[i * 3] *= drag; dVel[i * 3 + 1] *= drag; dVel[i * 3 + 2] *= drag;
      dPos[i * 3] += dVel[i * 3] * dt; dPos[i * 3 + 1] += dVel[i * 3 + 1] * dt; dPos[i * 3 + 2] += dVel[i * 3 + 2] * dt;
      dAng[i * 3] += dRot[i * 3] * dt; dAng[i * 3 + 1] += dRot[i * 3 + 1] * dt; dAng[i * 3 + 2] += dRot[i * 3 + 2] * dt;
      dummy.position.set(dPos[i * 3], dPos[i * 3 + 1], dPos[i * 3 + 2]); dummy.rotation.set(dAng[i * 3], dAng[i * 3 + 1], dAng[i * 3 + 2]);
      var fade = Math.min(1, dLife[i] / 1.5); dummy.scale.setScalar(dSc[i] * fade); dummy.updateMatrix(); debMesh.setMatrixAt(i, dummy.matrix);
      if (G && G.t > 0 && dSc[i] > 5 && dMax[i] - dLife[i] < 6 && !G.result) {
        var ddx = dPos[i * 3] - G.pos.x; if (ddx < 14 && ddx > -14) { var ddy = dPos[i * 3 + 1] - G.pos.y, ddz = dPos[i * 3 + 2] - G.pos.z, rr = dSc[i] * 0.9 + 2.6; if (ddx * ddx + ddy * ddy + ddz * ddz < rr * rr) { if (damage(5 + dSc[i] * 0.5, 'debris')) { G.speed *= 0.6; burst(G.pos, 10, 22, 1.0, 1, 0.7, 0.4, 0.6); } dLife[i] = Math.min(dLife[i], 0.3); } }
      }
    }
    debMesh.instanceMatrix.needsUpdate = true; dActive = any;
  }

  /* ---------- enemies: fighters, shuttles, warships (scattered across the system) ---------- */
  var ETYPE = {
    fighter: { name: '戰鬥機', hp: 30, r: 12, wake: 1400, score: 60, bump: 1, sc: 1.5 },
    shuttle: { name: '太空梭', hp: 90, r: 21, wake: 1150, score: 160, bump: 2, sc: 1.6 },
    frigate: { name: '護衛艦', hp: 600, r: 32, wake: 6500, score: 500, bump: 4, sc: 2.2 },
    warship: { name: '戰艦', hp: 1100, r: 190, wake: 6500, score: 1000, bump: 5, sc: 6.6 },
    cruiser: { name: '巡洋艦', hp: 1800, r: 250, wake: 6000, score: 1600, bump: 6, sc: 6.3 },
    carrier: { name: '航空母艦', hp: 2600, r: 380, wake: 5500, score: 2200, bump: 7, sc: 8 },
    g_bulwark: { name: '盾衛', hp: 7800, r: 140, wake: 3800, score: 2500, bump: 8, sc: 2 },
    g_lancer: { name: '光矛', hp: 5100, r: 96, wake: 3800, score: 2500, bump: 8, sc: 2 },
    g_hive: { name: '蜂后', hp: 6000, r: 120, wake: 3800, score: 2500, bump: 8, sc: 2 },
    g_reaper: { name: '旋刃', hp: 4500, r: 84, wake: 3800, score: 2500, bump: 8, sc: 2 },
    dread: { name: '巨型戰艦', hp: 4000, r: 550, wake: 5000, score: 3500, bump: 8, sc: 21 }
  };
  var GU = { value: 0 }, GS = 2;
  var eMatRed = new THREE.MeshStandardMaterial({ color: 0x8a1f1a, emissive: 0x7a0a0a, emissiveIntensity: 0.9, roughness: 0.5, metalness: 0.3 });
  var eMatDark = new THREE.MeshStandardMaterial({ color: 0x2b2f3a, roughness: 0.6, metalness: 0.4 });
  var eMatHull = new THREE.MeshStandardMaterial({ color: 0x59606e, roughness: 0.5, metalness: 0.6 });
  var eMatWhite = new THREE.MeshStandardMaterial({ color: 0xc9ced8, roughness: 0.45, metalness: 0.35 });
  var eMatLight = new THREE.MeshBasicMaterial({ color: 0xff3a2a });
  var eGlowTex = glowTex([[0, 'rgba(255,120,90,0.95)'], [0.35, 'rgba(255,60,40,0.4)'], [1, 'rgba(255,30,20,0)']]);
  var eEngTex = glowTex([[0, 'rgba(255,200,120,0.95)'], [0.4, 'rgba(255,120,40,0.4)'], [1, 'rgba(255,80,20,0)']]);
  /* ---------- capital ships: frigate / warship / cruiser / carrier / dreadnought (they hunt the player) ---------- */
  var SHIPS = ['frigate', 'warship', 'cruiser', 'carrier', 'dread'];
  var SHIPAI = {
    frigate: { spd: 250, near: 450, far: 850, side: 100, k: 1.3 },
    warship: { spd: 190, near: 1000, far: 1500, side: 60, k: 0.9 },
    cruiser: { spd: 150, near: 1250, far: 1800, side: 70, k: 0.8 },
    carrier: { spd: 120, near: 1800, far: 2400, side: 30, k: 0.6 },
    dread: { spd: 105, near: 2000, far: 2700, side: 35, k: 0.5 }
  };
  function sMat(c, e, ei) { return new THREE.MeshStandardMaterial({ color: c, emissive: e || 0x000000, emissiveIntensity: ei || 0, roughness: 0.5, metalness: 0.6 }); }
  function buildShipModel(type) {
    var g = new THREE.Group(), m, i;
    if (type === 'frigate') {
      m = new THREE.Mesh(new THREE.BoxGeometry(4.6, 3, 26), sMat(0x4a6a78, 0x103040, 0.4)); g.add(m);
      var pr = new THREE.Mesh(new THREE.ConeGeometry(3.3, 12, 4), sMat(0x5d8497)); pr.rotation.x = Math.PI / 2; pr.rotation.z = Math.PI / 4; pr.position.z = 19; pr.scale.set(1, 1, 0.6); g.add(pr);
      [-1, 1].forEach(function (s) { var f = new THREE.Mesh(new THREE.BoxGeometry(9, 0.6, 8), sMat(0x233844, 0xff3a2a, 0.35)); f.position.set(s * 6, -0.4, -6); f.rotation.z = s * 0.18; g.add(f); var en = glowSprite(14, eEngTex); en.position.set(s * 1.6, 0, -14); g.add(en); });
      var tu = new THREE.Mesh(new THREE.BoxGeometry(2.4, 1.6, 4), sMat(0x8a1f1a, 0xff3a2a, 0.6)); tu.position.set(0, 2.4, 6); g.add(tu); g.add(glowSprite(34, eGlowTex));
    } else if (type === 'cruiser') {
      m = new THREE.Mesh(new THREE.BoxGeometry(11, 5.5, 70), sMat(0x39425f, 0x101830, 0.4)); g.add(m);
      var pr2 = new THREE.Mesh(new THREE.ConeGeometry(6.6, 18, 4), sMat(0x4c5878)); pr2.rotation.x = Math.PI / 2; pr2.rotation.z = Math.PI / 4; pr2.position.z = 44; pr2.scale.set(1, 1, 0.5); g.add(pr2);
      var br = new THREE.Mesh(new THREE.BoxGeometry(6, 9, 11), sMat(0x1f2638, 0xff6a40, 0.35)); br.position.set(0, 7, -16); g.add(br);
      [-1, 1].forEach(function (s) {
        var pon = new THREE.Mesh(new THREE.BoxGeometry(5, 3.4, 52), sMat(0x2b3248)); pon.position.set(s * 9, -1, -4); g.add(pon);
        for (i = 0; i < 3; i++) { var tr = new THREE.Mesh(new THREE.BoxGeometry(3.6, 2.2, 5), sMat(0x8a1f1a, 0xff3a2a, 0.5)); tr.position.set(s * 8.5, 2.2, 14 - i * 16); g.add(tr); var ba = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.9, 9), sMat(0x1a1d28)); ba.position.set(s * 8.5, 2.6, 19 - i * 16); g.add(ba); }
        var en = glowSprite(30, eEngTex); en.position.set(s * 5, 0, -36); g.add(en);
      });
      var sl = new THREE.Mesh(new THREE.BoxGeometry(11.2, 0.5, 60), sMat(0x300000, 0xff2a1a, 1.1)); sl.position.y = 2.8; sl.scale.set(0.35, 1, 1); g.add(sl); g.add(glowSprite(90, eGlowTex));
    } else if (type === 'carrier') {
      m = new THREE.Mesh(new THREE.BoxGeometry(40, 4.2, 96), sMat(0x6a6f7a, 0x202428, 0.3)); g.add(m);
      var fl = new THREE.Mesh(new THREE.BoxGeometry(46, 1.6, 70), sMat(0x474c57)); fl.position.set(0, 2.4, -6); g.add(fl);
      for (i = 0; i < 6; i++) { var st = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.5, 8), sMat(0x301a00, 0xffb030, 1.0)); st.position.set(0, 3.4, -30 + i * 12); g.add(st); }
      var isl = new THREE.Mesh(new THREE.BoxGeometry(6, 14, 18), sMat(0x353a45, 0xff6a40, 0.25)); isl.position.set(18, 9, -10); g.add(isl);
      var hang = new THREE.Mesh(new THREE.BoxGeometry(30, 3, 50), sMat(0x1a1006, 0xff8a30, 0.9)); hang.position.set(0, -3, 8); g.add(hang);
      var pr3 = new THREE.Mesh(new THREE.ConeGeometry(14, 16, 4), sMat(0x59606c)); pr3.rotation.x = Math.PI / 2; pr3.rotation.z = Math.PI / 4; pr3.position.z = 56; pr3.scale.set(1.4, 1, 0.3); g.add(pr3);
      for (i = -1; i <= 1; i += 2) { var en2 = glowSprite(34, eEngTex); en2.position.set(i * 12, 0, -50); g.add(en2); }
      g.add(glowSprite(120, eGlowTex));
    } else {
      return null;
    }
    g.visible = false; scene.add(g); return g;
  }
  var sDir = new V3(), sWant = new V3(), sTan = new V3();
  function updateShip(d, dt, dist) {
    var A = SHIPAI[d.type], T = ETYPE[d.type];
    if (!d.awake) {
      d.ang += dt * 0.07;
      if (d.home) { var B = bodies[d.home]; sWant.set(B.pos.x + Math.cos(d.ang) * d.pr, B.pos.y + Math.sin(d.ang * 2 + d.ph) * 40, B.pos.z + Math.sin(d.ang) * d.pr); if (B.state === 'dead') d.awake = true; }
      else sWant.set(d.anchor.x + Math.cos(d.ang) * d.pr, d.anchor.y + Math.sin(d.ang * 2 + d.ph) * 30, d.anchor.z + Math.sin(d.ang) * d.pr);
      d.vel.copy(sWant).sub(d.pos).multiplyScalar(2); d.pos.lerp(sWant, 1 - Math.exp(-dt * 2));
      if (dist < T.wake) { d.awake = true; d.fireT = Math.max(d.fireT, 1 + Math.random()); }
    } else {
      var dir = sDir.copy(G.pos).sub(d.pos).divideScalar(Math.max(dist, 1)), want = sWant.set(0, 0, 0);
      if (dist > A.far) want.copy(dir).multiplyScalar(A.spd); else if (dist < A.near) want.copy(dir).multiplyScalar(-A.spd * 0.6);
      sTan.set(-dir.z, 0, dir.x).multiplyScalar(d.side * A.side); want.add(sTan); want.addScaledVector(G.vel, 0.25);
      d.vel.lerp(want, 1 - Math.exp(-dt * A.k)); d.pos.addScaledVector(d.vel, dt);
      if (d.charge > 0) { d.charge -= dt; if (d.charge <= 0) { for (var cq = -1; cq <= 1; cq++) eShot(d, 340, cq * 0.05, 2, 9, 72, [1, 0.45, 0.15], 6.5); ring(d.pos, d.r * 1.6, 0xffa060, 0.6); shake = Math.max(shake, 0.25); } }
      if (d.burst > 0) { d.burstT -= dt; if (d.burstT <= 0) { d.burstT = 0.16; d.burst--; eShot(d, 540, 0, 0, 2.2, 56, [1, 0.3, 0.15], 3.4 + d.r / 100); } }
      d.fireT -= dt;
      if (d.fireT <= 0 && dist > 90) {
        if (d.type === 'frigate' && dist < 1700) { if (++d.cnt % 3 === 0) { d.fireT = 2.4 + Math.random(); for (var q = -1; q <= 1; q++) eShot(d, 450, q * 0.06, 1, 2.6, 36, [1, 0.45, 0.2], 3.8); } else { d.fireT = 1.9 + Math.random() * 0.8; d.burst = 4; d.burstT = 0; } }
        else if (d.type === 'warship' && dist < 1900) { if (Math.random() < 0.38) { d.fireT = 3.4 + Math.random() * 1.2; for (var q2 = -2; q2 <= 2; q2++) eShot(d, 380, q2 * 0.07, 1, 3.2, 40, [1, 0.35, 0.6], 4.4); } else { d.fireT = 2.6 + Math.random(); d.burst = 3; d.burstT = 0; } }
        else if (d.type === 'cruiser' && dist < 2300) {
          d.fireT = 3.4 + Math.random() * 1.0; for (var q3 = -3; q3 <= 3; q3++) eShot(d, 520, q3 * 0.045, 0, 2.2, 50, [1, 0.3, 0.15], 4.2);
          if (++d.cnt % 2 === 0) { eShot(d, 340, -0.03, 2, 9, 70, [1, 0.45, 0.15], 6.5); eShot(d, 340, 0.03, 2, 9, 70, [1, 0.45, 0.15], 6.5); }
        }
        else if (d.type === 'carrier' && dist < 2700) { d.fireT = 2.2 + Math.random() * 0.9; eShot(d, 480, 0, 0, 2.0, 44, [1, 0.6, 0.2], 4.4); }
        else if (d.type === 'dread' && dist < 3400) {
          if (Math.random() < 0.55 && d.charge <= 0) { d.fireT = 5.2 + Math.random() * 1.5; d.charge = 1.1; ring(d.pos, d.r * 2.2, 0xff5a30, 1.1); events.push({ type: 'cannon', name: d.name }); }
          else { d.fireT = 3.2 + Math.random(); d.burst = 5; d.burstT = 0; }
        }
      }
      if (d.type === 'carrier') {
        d.spT -= dt; var awF = 0; if (d.spT <= 0) drones.forEach(function (q) { if (q.alive && q.awake && q.type === 'fighter') awF++; }); if (d.spT <= 0 && dist < 3200 && awF < FIGHT_CAP) { d.spT = 9; var made = 0; for (var di = 0; di < drones.length && made < 3; di++) { var f = drones[di]; if (f.alive || !f.reserve || f.guard || f.type !== 'fighter') continue; f.alive = true; f.awake = true; f.hp = ETYPE.fighter.hp; f.max = f.hp; f.fireT = 1.2; f.vel.set(0, 0, 0); f.pos.copy(d.pos).add(tmpA.set((Math.random() - 0.5) * d.r, -6, (Math.random() - 0.5) * d.r)); f.g.position.copy(f.pos); f.g.visible = true; f.g.scale.setScalar(f.sc); made++; ring(f.pos, 50, 0xffaa55, 0.5); } }
      }
      if (dist < d.r + 3 && !G.result && d.ramT <= 0) { d.ramT = 1.2; damage(d.type === 'dread' ? 25 : (d.type === 'frigate' ? 10 : 16), 'drone'); burst(G.pos, 12, 24, 1.0, 1, 0.5, 0.3, 0.6); }
    }
    ORDER.forEach(function (id) { var P = bodies[id]; if (P.state === 'dead') return; var dd = d.pos.distanceTo(P.pos); if (dd < P.R * 1.12 + d.r) { tmpC.copy(d.pos).sub(P.pos).normalize(); d.pos.copy(P.pos).addScaledVector(tmpC, P.R * 1.12 + d.r); } });
    d.g.position.copy(d.pos); d.g.scale.setScalar(d.sc * (1 + d.flash * 0.05));
    if (d.awake) { tmpC.copy(G.pos); d.g.lookAt(tmpC); } else if (d.vel.lengthSq() > 4) { tmpC.copy(d.pos).add(d.vel); d.g.lookAt(tmpC); }
  }

  function buildEnemy(type) {
    if (type.indexOf('g_') === 0) return buildGuard(type);
    if (type === 'frigate' || type === 'cruiser' || type === 'carrier') return buildShipModel(type);
    var g = new THREE.Group(), m;
    if (type === 'fighter') {
      m = new THREE.Mesh(new THREE.OctahedronGeometry(1, 0), eMatRed); m.scale.set(3, 1.6, 4.4); g.add(m);
      [-1, 1].forEach(function (s) { var w = new THREE.Mesh(new THREE.BoxGeometry(5, 0.2, 2.2), eMatDark); w.position.x = s * 3.6; w.rotation.z = s * 0.25; g.add(w); });
      g.add(glowSprite(18, eGlowTex));
    } else if (type === 'shuttle') {
      m = new THREE.Mesh(new THREE.CylinderGeometry(2.2, 2.6, 12, 10), eMatWhite); m.rotation.x = Math.PI / 2; g.add(m);
      var nose = new THREE.Mesh(new THREE.ConeGeometry(2.2, 5, 10), eMatRed); nose.rotation.x = Math.PI / 2; nose.position.z = 8.5; g.add(nose);
      [-1, 1].forEach(function (s) { var w = new THREE.Mesh(new THREE.BoxGeometry(9, 0.35, 5.5), eMatDark); w.position.set(s * 5.6, -0.4, -2.5); w.rotation.z = s * 0.12; g.add(w); });
      var fin = new THREE.Mesh(new THREE.BoxGeometry(0.4, 4, 3.6), eMatRed); fin.position.set(0, 2.6, -5); g.add(fin);
      var eg = glowSprite(14, eEngTex); eg.position.z = -7; g.add(eg); g.add(glowSprite(26, eGlowTex));
    } else {
      m = new THREE.Mesh(new THREE.BoxGeometry(11, 5, 48), eMatHull); g.add(m);
      var prow = new THREE.Mesh(new THREE.ConeGeometry(5.8, 14, 4), eMatHull); prow.rotation.x = Math.PI / 2; prow.rotation.z = Math.PI / 4; prow.position.z = 31; prow.scale.set(1, 1, 0.55); g.add(prow);
      var br = new THREE.Mesh(new THREE.BoxGeometry(6, 5, 10), eMatDark); br.position.set(0, 5, -9); g.add(br);
      var br2 = new THREE.Mesh(new THREE.BoxGeometry(3.4, 3, 5), eMatRed); br2.position.set(0, 9, -10); g.add(br2);
      [-1, 1].forEach(function (s) {
        var wing = new THREE.Mesh(new THREE.BoxGeometry(10, 0.8, 20), eMatDark); wing.position.set(s * 9.5, -0.6, -8); g.add(wing);
        [-1, 1].forEach(function (zz) { var tu = new THREE.Mesh(new THREE.BoxGeometry(2.6, 1.6, 3), eMatRed); tu.position.set(s * 3.2, 3.2, zz * 9 + 8); g.add(tu); var ba = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.7, 6), eMatDark); ba.position.set(s * 3.2, 3.4, zz * 9 + 12); g.add(ba); });
        var en = glowSprite(22, eEngTex); en.position.set(s * 3.4, 0, -25); g.add(en);
        var li = new THREE.Mesh(new THREE.SphereGeometry(0.7, 6, 5), eMatLight); li.position.set(s * 14.5, -0.6, -17); g.add(li);
      });
      g.add(glowSprite(50, eGlowTex));
    }
    g.visible = false; scene.add(g); return g;
  }
  var ENEMY_POOL = (function () {
    var spec = [], f = { mercury: 2, venus: 3, earth: 3, mars: 3, jupiter: 5, saturn: 4, uranus: 3, neptune: 4, pluto: 2 };
    ORDER.forEach(function (id) { for (var k = 0; k < f[id]; k++) spec.push({ type: 'fighter', home: id, k: k, n: f[id] }); });
    for (var s = 0; s < 12; s++) spec.push({ type: 'shuttle', home: null });
    spec.push({ type: 'warship', home: 'mars' }); spec.push({ type: 'frigate', home: null }); spec.push({ type: 'frigate', home: null });
    [['frigate', 3], ['warship', 4], ['cruiser', 3], ['carrier', 2], ['dread', 3]].forEach(function (p) { for (var q = 0; q < p[1]; q++) spec.push({ type: p[0], home: null, reserve: true, sched: true }); });
    for (var r = 0; r < 58; r++) spec.push({ type: 'fighter', home: null, reserve: true });
    for (var r2 = 0; r2 < 4; r2++) spec.push({ type: 'shuttle', home: null, reserve: true });
    for (var r3 = 0; r3 < 3; r3++) spec.push({ type: 'frigate', home: null, reserve: true });
    ['g_bulwark', 'g_lancer', 'g_hive', 'g_reaper'].forEach(function (t) { spec.push({ type: t, home: null, reserve: true, guard: true }); });
    return spec;
  })();
  var drones = [], reinT = 14, schedT = 25, fightT = 6, FIGHT_CAP = 30;
  ENEMY_POOL.forEach(function (sp) {
    var T = ETYPE[sp.type];
    drones.push({ g: buildEnemy(sp.type === 'dread' ? 'warship' : sp.type), sc: T.sc, type: sp.type, name: T.name, r: T.r, max: T.hp, sp: sp, pos: new V3(), vel: new V3(), hp: 0, alive: false, awake: false, home: sp.home, anchor: new V3(), pr: 300, ang: 0, fireT: 0, burst: 0, burstT: 0, side: 1, ph: Math.random() * 6, flash: 0, ramT: 0, charge: 0, reserve: !!sp.reserve, guard: !!sp.guard, ship: SHIPS.indexOf(sp.type) >= 0, sched: !!sp.sched, cnt: 0, st: 0, stT: 3, dashDir: new V3(), ls: 0, lT: 0, aim: new V3(), bdir: new V3(), bhit: false, spT: 6 });
  });
  function randAnchor(out, minFromStart) {
    for (var t = 0; t < 40; t++) {
      var a = Math.random() * TAU, rr = 1800 + Math.pow(Math.random(), 0.8) * 12500; out.set(Math.cos(a) * rr, (Math.random() - 0.5) * 300, Math.sin(a) * rr);
      if (out.distanceTo(G.pos) < minFromStart) continue; var ok = true;
      ORDER.forEach(function (id) { if (out.distanceTo(bodies[id].pos) < bodies[id].R * 2.4 + 300) ok = false; });
      if (ok) return;
    }
  }
  function placeEnemy(d, center) {
    d.g.position.copy(d.pos); d.g.visible = true; d.vel.set(0, 0, 0);
  }
  function resetDrones() {
    reinT = 14; schedT = 25; fightT = 6;
    drones.forEach(function (d) {
      var sp = d.sp, T = ETYPE[d.type]; d.alive = !d.reserve; d.awake = false; d.hp = T.hp; d.max = T.hp; d.fireT = 1 + Math.random() * 2.5; d.burst = 0; d.burstT = 0; d.flash = 0; d.ramT = 0; d.charge = 0; d.side = Math.random() < 0.5 ? -1 : 1; d.vel.set(0, 0, 0); d.ang = Math.random() * TAU; d.ph = Math.random() * 6;
      if (d.reserve) { d.g.visible = false; return; }
      if (sp.home) {
        var B = bodies[sp.home]; d.home = sp.home; d.ang = (sp.k !== undefined ? sp.k / sp.n * TAU : Math.random() * TAU);
        d.pr = d.type === 'warship' ? B.R * 1.6 + 420 : B.R * 1.9 + 140; d.pos.set(B.pos.x + Math.cos(d.ang) * d.pr, B.pos.y + (Math.random() - 0.5) * B.R * 0.5, B.pos.z + Math.sin(d.ang) * d.pr);
      } else {
        d.home = null; randAnchor(d.anchor, d.ship ? 5500 : 3000); d.pr = d.ship ? 500 : 260; d.pos.set(d.anchor.x + Math.cos(d.ang) * d.pr, d.anchor.y, d.anchor.z + Math.sin(d.ang) * d.pr);
      }
      d.g.position.copy(d.pos); d.g.scale.setScalar(d.sc); d.g.visible = true;
    });
  }
  function spawnReinforce(n) {
    var made = 0;
    for (var k = 0; k < n; k++) {
      var free = drones.filter(function (d) { return d.reserve && !d.alive && !d.guard && !d.sched; }); if (!free.length) break;
      var heavy = G.destroyed >= 1 && Math.random() < 0.3, mid = Math.random() < 0.3, want = heavy ? 'frigate' : (mid ? 'shuttle' : 'fighter');
      var pick = free.filter(function (d) { return d.type === want; }); if (!pick.length) pick = free; var d = pick[Math.floor(Math.random() * pick.length)], T = ETYPE[d.type];
      d.alive = true; d.awake = true; d.hp = T.hp; d.max = T.hp; d.fireT = 1.6 + Math.random(); d.flash = 0; d.burst = 0; d.charge = 0; d.vel.set(0, 0, 0);
      var vx = Math.random() * 2 - 1, vy = (Math.random() * 2 - 1) * 0.7, vz = Math.random() * 2 - 1, vl = Math.hypot(vx, vy, vz) || 1, rr = 1100 + Math.random() * 500;
      d.pos.set(G.pos.x + vx / vl * rr, G.pos.y + vy / vl * rr, G.pos.z + vz / vl * rr);
      d.g.position.copy(d.pos); d.g.visible = true; d.g.scale.setScalar(d.sc); made++; ring(d.pos, 60, 0xff7744, 0.5);
    }
    return made;
  }
  function shipTarget(t) {
    var pts = [[0, 2], [90, 3], [240, 6], [420, 9], [600, 10], [780, 7]];
    if (t >= pts[pts.length - 1][0]) return pts[pts.length - 1][1];
    for (var i = 1; i < pts.length; i++) if (t < pts[i][0]) { var a = pts[i - 1], b = pts[i]; return Math.round(a[1] + (b[1] - a[1]) * (t - a[0]) / (b[0] - a[0])); }
    return 2;
  }
  function fighterTarget(t) { return Math.round(4 + (FIGHT_CAP - 4) * (1 - Math.exp(-t / 360))); }
  function spawnFighters() {
    var awakeF = 0; drones.forEach(function (d) { if (d.alive && d.awake && d.type === 'fighter') awakeF++; });
    var need = Math.min(2, fighterTarget(G.t) - awakeF), made = 0;
    for (var i = 0; i < drones.length && made < need; i++) {
      var d = drones[i]; if (!d.reserve || d.alive || d.type !== 'fighter' || d.guard || d.sched) continue;
      var a = Math.random() * TAU, rr = 2000 + Math.random() * 700, T = ETYPE.fighter;
      d.alive = true; d.awake = true; d.hp = T.hp; d.max = T.hp; d.fireT = 1.6 + Math.random(); d.flash = 0; d.burst = 0; d.charge = 0; d.vel.set(0, 0, 0);
      d.pos.set(G.pos.x + Math.cos(a) * rr, G.pos.y + (Math.random() - 0.5) * 500, G.pos.z + Math.sin(a) * rr);
      d.g.position.copy(d.pos); d.g.visible = true; d.g.scale.setScalar(d.sc); ring(d.pos, 50, 0xff7744, 0.5); made++;
    }
    return made;
  }
  function spawnCapital() {
    var t = G.t, alive = 0, dreads = 0, cand = [];
    drones.forEach(function (d) { if (d.alive && d.ship && !d.guard) { alive++; if (d.type === 'dread') dreads++; } });
    if (alive >= shipTarget(t)) return false;
    var W = { frigate: t < 240 ? 3 : 1, warship: t > 60 ? (t < 300 ? 3 : 1.5) : 0, cruiser: t > 150 ? (t < 300 ? 2 : 3) : 0, carrier: t > 240 ? 2.5 : 0, dread: (t > 330 && dreads < (t > 540 ? 2 : 1)) ? 1 : 0 }, tot = 0;
    drones.forEach(function (d) { if (d.sched && !d.alive && W[d.type] > 0) { cand.push(d); tot += W[d.type]; } });
    if (!cand.length) return false;
    var r = Math.random() * tot, pick = cand[0];
    for (var i = 0; i < cand.length; i++) { r -= W[cand[i].type]; if (r <= 0) { pick = cand[i]; break; } }
    var d = pick, T = ETYPE[d.type], a = Math.random() * TAU, rr = 4800 + Math.random() * 1400;
    d.alive = true; d.awake = true; d.hp = T.hp; d.max = T.hp; d.fireT = 2.5 + Math.random(); d.flash = 0; d.burst = 0; d.charge = 0; d.spT = 6; d.vel.set(0, 0, 0);
    d.pos.set(G.pos.x + Math.cos(a) * rr, G.pos.y + (Math.random() - 0.5) * 600, G.pos.z + Math.sin(a) * rr);
    d.g.position.copy(d.pos); d.g.visible = true; d.g.scale.setScalar(d.sc); ring(d.pos, d.r * 0.8, 0xff7744, 0.8);
    return true;
  }
  function killDrone(d, byBomb) {
    var T = ETYPE[d.type]; d.alive = false; d.g.visible = false; G.kills++; award('killScore', T.score); bump(T.bump);
    var big = d.ship || d.guard, kk = d.type === 'dread' ? 3.4 : (d.type === 'carrier' ? 2.4 : (d.type === 'cruiser' ? 2.0 : (d.type === 'warship' ? 1.7 : (d.type === 'frigate' ? 1.2 : (d.guard ? 2 : 1)))));
    if (d.guard) guardDeathFx(d); else { burst(d.pos, big ? 70 : 16, (big ? 120 : 36) * kk, big ? 3 : 1.4, 1, 0.6, 0.3, big ? 1.2 : 0.7); fireball(d.pos, (big ? 130 : (d.type === 'shuttle' ? 54 : 34)) * kk, big ? 1.2 : 0.5); ring(d.pos, (big ? 160 : 50) * kk, 0xff7744, big ? 0.9 : 0.5); }
    events.push({ type: big ? 'boom' : 'drone', p: d.pos.clone(), name: T.name });
    if (big) { shake = Math.max(shake, Math.max(0.5, 2 - G.pos.distanceTo(d.pos) / 400)); var dr = d.type === 'dread' || d.type === 'carrier' || d.type === 'cruiser' || d.guard; G.energy = Math.min(ENERGY_MAX, G.energy + (dr ? 100 : 30)); if (dr) G.bombs += 2; else if (Math.random() < 0.4) G.bombs++; events.push({ type: 'enemyDown', name: T.name }); }
    else if (Math.random() < (d.type === 'shuttle' ? 0.4 : 0.18)) { G.energy = Math.min(ENERGY_MAX, G.energy + 12); }
  }
  function hurtEnemy(d, dmg) {
    if (!d.alive) return; d.hp -= dmg; d.flash = 1; d.awake = true; if (d.hp <= 0) { killDrone(d, false); if (d.guard) guardDown(d); }
  }
  function eShot(d, speed, spread, kind, w, len, col, life) {
    var dist = d.pos.distanceTo(G.pos), lead = dist / speed;
    tmpC.copy(G.pos).addScaledVector(G.vel, lead * 0.75).sub(d.pos).normalize();
    if (spread) { tmpE.crossVectors(tmpC, UPV).normalize(); tmpC.addScaledVector(tmpE, spread).normalize(); }
    tmpC.multiplyScalar(speed); tmpC.x += (Math.random() - 0.5) * 24; tmpC.y += (Math.random() - 0.5) * 24; tmpC.z += (Math.random() - 0.5) * 24;
    tmpB.copy(d.pos).addScaledVector(tmpA.copy(tmpC).normalize(), d.r * 0.9); spawnBullet(false, tmpB, tmpC, life || 3.4, { kind: kind || 0, w: w || 1.5, len: len || 36, col: col });
  }
  function updateDrones(dt) {
    if (G && !G.result && !boss.alive) { reinT -= dt; if (reinT <= 0) { reinT = 13 + Math.random() * 5; var awakeN = 0; drones.forEach(function (d) { if (d.alive && d.awake) awakeN++; }); if (awakeN < 10 && spawnReinforce(awakeN < 4 ? 3 : 2)) events.push({ type: 'reinforce' }); } }
    if (G && !G.result && !boss.alive) { fightT -= dt; if (fightT <= 0) { fightT = 3.5; spawnFighters(); } }
    if (G && !G.result && !boss.alive) { schedT -= dt; if (schedT <= 0) { schedT = 8; if (spawnCapital()) events.push({ type: 'reinforce' }); } }
    drones.forEach(function (d) {
      if (!d.alive) return; var T = ETYPE[d.type], toP = tmpA.copy(G.pos).sub(d.pos), dist = toP.length(); d.flash = Math.max(0, d.flash - dt * 5);
      if (d.ramT > 0) d.ramT -= dt;
      if (d.guard) { updateGuard(d, dt, dist); return; }
      if (d.ship) { updateShip(d, dt, dist); return; }
      if (!d.awake) {
        d.ang += dt * (d.type === 'warship' ? 0.08 : 0.22);
        if (d.home) { var B = bodies[d.home]; tmpB.set(B.pos.x + Math.cos(d.ang) * d.pr, B.pos.y + Math.sin(d.ang * 2 + d.ph) * 40, B.pos.z + Math.sin(d.ang) * d.pr); if (B.state === 'dead') d.awake = true; }
        else tmpB.set(d.anchor.x + Math.cos(d.ang) * d.pr, d.anchor.y + Math.sin(d.ang * 2 + d.ph) * 30, d.anchor.z + Math.sin(d.ang) * d.pr);
        d.vel.copy(tmpB).sub(d.pos).multiplyScalar(2); d.pos.lerp(tmpB, 1 - Math.exp(-dt * 2));
        if (dist < T.wake) d.awake = true;
        if (d.awake) d.fireT = Math.max(d.fireT, 0.8 + Math.random());
      } else {
        if (dist > 5200 && d.hp >= d.max) { d.awake = false; d.g.position.copy(d.pos); return; }
        var dir = toP.divideScalar(Math.max(dist, 1)), want = tmpB.set(0, 0, 0);
        if (d.type === 'fighter') {
          if (dist > 320) want.copy(dir).multiplyScalar(300); else if (dist < 170) want.copy(dir).multiplyScalar(-220);
          tmpC.set(-dir.z, 0, dir.x).multiplyScalar(d.side * 120); want.add(tmpC); want.y += Math.sin(G.t * 1.3 + d.ph) * 30; want.addScaledVector(G.vel, 0.56);
          d.vel.lerp(want, 1 - Math.exp(-dt * 1.4));
        } else if (d.type === 'shuttle') {
          if (dist > 650) want.copy(dir).multiplyScalar(230); else if (dist < 380) want.copy(dir).multiplyScalar(-170);
          tmpC.set(-dir.z, 0, dir.x).multiplyScalar(d.side * 90); want.add(tmpC); want.y += Math.sin(G.t * 0.9 + d.ph) * 40; want.addScaledVector(G.vel, 0.44);
          d.vel.lerp(want, 1 - Math.exp(-dt * 1.0));
        } else if (d.type === 'dread') {
          if (dist > 1800) want.copy(dir).multiplyScalar(150); else if (dist < 1200) want.copy(dir).multiplyScalar(-90);
          tmpC.set(-dir.z, 0, dir.x).multiplyScalar(d.side * 35); want.add(tmpC); want.addScaledVector(G.vel, 0.24);
          d.vel.lerp(want, 1 - Math.exp(-dt * 0.5));
        } else {
          if (dist > 1100) want.copy(dir).multiplyScalar(170); else if (dist < 700) want.copy(dir).multiplyScalar(-110);
          tmpC.set(-dir.z, 0, dir.x).multiplyScalar(d.side * 55); want.add(tmpC); want.addScaledVector(G.vel, 0.32);
          d.vel.lerp(want, 1 - Math.exp(-dt * 0.7));
        }
        d.pos.addScaledVector(d.vel, dt);
        if (d.burst > 0) { d.burstT -= dt; if (d.burstT <= 0) { d.burstT = 0.16; d.burst--; eShot(d, 540, 0, 0, 2.2, 56, [1, 0.3, 0.15], 3.4); } }
        if (d.charge > 0) { d.charge -= dt; if (d.charge <= 0) { for (var cq = -1; cq <= 1; cq++) eShot(d, 340, cq * 0.05, 2, 9, 72, [1, 0.45, 0.15], 6.5); ring(d.pos, d.r * 1.6, 0xffa060, 0.6); shake = Math.max(shake, 0.25); } }
        d.fireT -= dt;
        if (d.fireT <= 0 && dist > 90) {
          if (d.type === 'fighter' && dist < 950) { d.fireT = 1.7 + Math.random() * 1.5; eShot(d, 560, 0, 0, 1.5, 36, null, 3.2); }
          else if (d.type === 'shuttle' && dist < 1100) { d.fireT = 2.4 + Math.random() * 1.1; eShot(d, 430, -0.05, 0, 1.8, 44, [1, 0.7, 0.2], 3.6); eShot(d, 430, 0.05, 0, 1.8, 44, [1, 0.7, 0.2], 3.6); }
          else if (d.type === 'dread' && dist < 2700) {
            if (Math.random() < 0.55 && d.charge <= 0) { d.fireT = 5.2 + Math.random() * 1.5; d.charge = 1.1; ring(d.pos, d.r * 2.2, 0xff5a30, 1.1); events.push({ type: 'cannon', name: d.name }); }
            else { d.fireT = 3.2 + Math.random(); d.burst = 5; d.burstT = 0; }
          }
          else if (d.type === 'warship' && dist < 1700) {
            if (Math.random() < 0.38) { d.fireT = 3.4 + Math.random() * 1.2; for (var q = -2; q <= 2; q++) eShot(d, 380, q * 0.07, 1, 3.2, 40, [1, 0.35, 0.6], 4.4); }
            else { d.fireT = 2.6 + Math.random() * 1.0; d.burst = 3; d.burstT = 0; }
          }
        }
        if (dist < d.r + 3 && !G.result && d.ramT <= 0) {
          if (d.type === 'warship' || d.type === 'dread') { d.ramT = 1.2; damage(d.type === 'dread' ? 25 : 14, 'drone'); burst(G.pos, 12, 24, 1.0, 1, 0.5, 0.3, 0.6); }
          else { if (damage(d.type === 'shuttle' ? 10 : 8, 'drone')) burst(G.pos, 12, 24, 1.0, 1, 0.5, 0.3, 0.6); killDrone(d, false); return; }
        }
      }
      ORDER.forEach(function (id) { var P = bodies[id]; if (P.state === 'dead') return; var dd = d.pos.distanceTo(P.pos); if (dd < P.R * 1.12 + d.r) { tmpC.copy(d.pos).sub(P.pos).normalize(); d.pos.copy(P.pos).addScaledVector(tmpC, P.R * 1.12 + d.r); } });
      d.g.position.copy(d.pos); d.g.scale.setScalar(d.sc * (1 + d.flash * 0.06));
      if (d.awake || d.type !== 'fighter') { if (d.vel.lengthSq() > 4) { tmpC.copy(d.pos).add(d.vel); d.g.lookAt(tmpC); } }
      if (d.awake && (d.type === 'warship' || d.type === 'dread')) { tmpC.copy(G.pos); d.g.lookAt(tmpC); }
    });
  }

  /* ---------- combo / score ---------- */
  function comboMult() { return Math.min(5, 1 + Math.floor(G.combo / 4)); }
  function award(key, base) { var m = comboMult(); G[key] += base * m; }
  function bump(n) { G.combo += n; G.comboT = 4.2 + 1.2 * G.up.chain; if (G.combo > G.maxCombo) G.maxCombo = G.combo; }
  function clampN(v, a, b) { return v < a ? a : (v > b ? b : v); }
  function segDist(p, a, b) {
    var abx = b.x - a.x, aby = b.y - a.y, abz = b.z - a.z, l2 = abx * abx + aby * aby + abz * abz || 1;
    var t = clampN(((p.x - a.x) * abx + (p.y - a.y) * aby + (p.z - a.z) * abz) / l2, 0, 1), dx = a.x + abx * t - p.x, dy = a.y + aby * t - p.y, dz = a.z + abz * t - p.z;
    return Math.sqrt(dx * dx + dy * dy + dz * dz);
  }
  var tmpD = new V3(), tmpE = new V3(), shipE = new THREE.Euler(0, 0, 0, 'YXZ');

  /* ---------- upgrades ---------- */
  var UPG = [
    { id: 'rapid', name: '超頻機炮', desc: '射速提高 22%，火力更連貫。', max: 3 },
    { id: 'twin', name: '雙槍齊射', desc: '兩側機炮同時開火，火力加倍。', max: 1 },
    { id: 'spread', name: '扇形散射', desc: '每次射擊多射出斜向光束，更容易命中。', max: 2 },
    { id: 'pierce', name: '貫穿光束', desc: '光束可貫穿防衛機、節點與岩石。', max: 1 },
    { id: 'homing', name: '導引光束', desc: '光束會自動偏向附近的敵人。', max: 2 },
    { id: 'cool', name: '液冷核心', desc: '機炮升溫變慢、冷卻更快。', max: 2 },
    { id: 'bomb', name: '核融合彈頭', desc: '炸彈範圍與威力提升，立刻補 2 顆。', max: 2 },
    { id: 'hull', name: '複合裝甲', desc: '承受傷害 −12%，並立即修復 40% 船體。', max: 3 },
    { id: 'drive', name: '推進增幅', desc: '加速更省能量，能量回復更快。', max: 2 },
    { id: 'chain', name: '連擊延長', desc: '連擊維持時間 +1.2 秒，倍率更好維持。', max: 2 }
  ];
  function newUp() { var o = {}; UPG.forEach(function (u) { o[u.id] = 0; }); return o; }
  function applyUp(id) {
    if (id === 'bomb') G.bombs += 2; else if (id === 'hull') G.hull = Math.min(HULL_MAX, G.hull + 40);
  }
  function offerUpgrades() {
    var pool = UPG.filter(function (u) { return G.up[u.id] < u.max; });
    for (var i = pool.length - 1; i > 0; i--) { var j = Math.floor(Math.random() * (i + 1)), t = pool[i]; pool[i] = pool[j]; pool[j] = t; }
    G.offer = pool.slice(0, 3); if (!G.offer.length) return;
    var box = $('cards'); box.innerHTML = '';
    G.offer.forEach(function (u, i) {
      var b = document.createElement('button'); b.type = 'button'; b.className = 'ucard'; b.innerHTML = '<span class="uk"></span><b></b><span class="ud"></span><span class="ul"></span>';
      b.children[0].textContent = String(i + 1); b.children[1].textContent = u.name; b.children[2].textContent = u.desc; b.children[3].textContent = G.up[u.id] ? '等級 ' + G.up[u.id] + ' → ' + (G.up[u.id] + 1) : '新能力';
      b.addEventListener('click', function () { selectUpgrade(i); }); box.appendChild(b);
    });
    pickSel = -1; var okb = $('bPickOk'); if (okb) { okb.disabled = true; okb.textContent = '請先選一項'; }
    setMode('pick'); try { if (document.exitPointerLock) document.exitPointerLock(); } catch (_) {}
    sfx.up();
  }
  var pickSel = -1;
  function selectUpgrade(i) {
    if (mode !== 'pick' || !G.offer || !G.offer[i]) return; pickSel = i; var cs = $('cards').children; for (var k = 0; k < cs.length; k++) cs[k].classList.toggle('sel', k === i);
    var okb = $('bPickOk'); okb.disabled = false; okb.textContent = '確定：' + G.offer[i].name; sfx.pop();
  }
  $('bPickOk').addEventListener('click', function () { if (pickSel >= 0) chooseUpgrade(pickSel); });
  function chooseUpgrade(i) {
    if (mode !== 'pick' || !G.offer || !G.offer[i]) return; var u = G.offer[i]; G.up[u.id]++; applyUp(u.id); G.offer = null; G.picked++;
    news('強化：' + u.name + (G.up[u.id] > 1 ? ' Lv.' + G.up[u.id] : ''), 'good', true); setMode('play'); keys = {}; mouseL = mouseR = false; tryLock(); sfx.pickok();
  }

  /* ---------- orbital motion (real elements, scaled) ---------- */
  var AZ = new V3(0, 0, 1), AY = new V3(0, 1, 0), tmpOP = new V3(), tmpRt = new V3(), tmpUp = new V3();
  ORDER.forEach(function (id) { bodies[id].vel = new V3(); });
  var orbitLines = [];
  ORDER.forEach(function (id) {
    var pts = [], tp = new V3(), el = EL[id]; el.xz = [];
    for (var k = 0; k <= 96; k++) { posFromE(el, k / 96 * TAU, tp); pts.push(tp.clone()); el.xz.push(tp.x, tp.z); }
    var ln = new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints(pts), new THREE.LineBasicMaterial({ color: 0x7fa6e0, transparent: true, opacity: 0.2, depthWrite: false, blending: THREE.AdditiveBlending }));
    ln.frustumCulled = false; scene.add(ln); orbitLines.push(ln);
  });
  function applyOrbits(dt) {
    ORDER.forEach(function (id) {
      var B = bodies[id]; tmpOP.copy(B.pos); orbitPos(id, B.pos); B.group.position.copy(B.pos); B.sunDir.copy(sunPos).sub(B.pos).normalize();
      if (dt > 0) { B.vel.copy(B.pos).sub(tmpOP).multiplyScalar(1 / dt); B.mesh.rotation.y += VIS[id].spin * dt; }
    });
    rings.group.position.copy(bodies.saturn.pos); rings.group.quaternion.copy(bodies.saturn.tilt.quaternion);
  }
  function updateOrbits(dt) {
    ORDER.forEach(function (id) { var el = EL[id]; el.M = (el.M + TAU * dt / el.Pg) % TAU; });
    belt.spin.rotation.y += dt * 0.004; applyOrbits(dt);
  }
  var ovA = new V3(), ovB = new V3();
  function orbitVel(id, out) { var el = EL[id], M = el.M, dM = 0.0006; orbitPos(id, ovA); el.M = M + dM; orbitPos(id, ovB); el.M = M; out.copy(ovB).sub(ovA).multiplyScalar(TAU / (dM * el.Pg)); }
  function gravityAt(p, out) {
    gGrav.copy(sunPos).sub(p); var r = Math.max(gGrav.length(), 1); out.copy(gGrav).multiplyScalar(MU_SUN / (r * r + 900) / r);
    if (r > 16000) out.addScaledVector(gGrav, (r - 16000) * 0.002 / r);
    ORDER.forEach(function (id) { var B = bodies[id]; if (B.state === 'dead') return; gGrav.copy(B.pos).sub(p); var rr = Math.max(gGrav.length(), B.R * 0.9); out.addScaledVector(gGrav, GS * GRAV[id] * B.R * B.R / (rr * rr) / Math.max(gGrav.length(), 1)); });
    return out;
  }
  function resetOrbits() { ORDER.forEach(function (id) { EL[id].M = EL[id].M0; bodies[id].mesh.rotation.y = 0; }); applyOrbits(0); ORDER.forEach(function (id) { orbitVel(id, bodies[id].vel); }); }

  /* ---------- planet cores (weak points that ride the planet's spin) ---------- */
  var CORE_CFG = {
    mercury: { n: 0, pat: 'single' }, venus: { n: 0, pat: 'slow' }, earth: { n: 0, pat: 'single' }, mars: { n: 0, pat: 'burst' }, jupiter: { n: 0, pat: 'spread' },
    saturn: { n: 0, pat: 'burst' }, uranus: { n: 0, pat: 'slow' }, neptune: { n: 0, pat: 'spread' }, pluto: { n: 0, pat: 'single' }
  };
  function planetHp(R) { return Math.round(8 * (40 + 0.9 * Math.pow(R, 1.4))); }
  var cores = [];
  var coreGeo = new THREE.OctahedronGeometry(1, 0), coreMat = new THREE.MeshStandardMaterial({ color: 0x4a1408, emissive: 0xff5a1a, emissiveIntensity: 1.5, roughness: 0.4, metalness: 0.5 });
  var coreGlowTex = glowTex([[0, 'rgba(255,230,170,0.95)'], [0.3, 'rgba(255,110,40,0.45)'], [1, 'rgba(255,60,20,0)']]);
  ORDER.forEach(function (id, oi) {
    var B = bodies[id], cfg = CORE_CFG[id]; B.cores = [];
    for (var k = 0; k < cfg.n; k++) {
      var y = (1 - (k + 0.5) / cfg.n * 2) * 0.8 + (Math.sin(oi * 3.7 + k) * 0.12), rr = Math.sqrt(Math.max(0.05, 1 - y * y)), th = k * 2.399963 + oi * 1.3;
      var dir = new V3(Math.cos(th) * rr, y, Math.sin(th) * rr).normalize(), cs = 7 + B.R * 0.04;
      var g = new THREE.Group(), cr = new THREE.Mesh(coreGeo, coreMat); cr.scale.set(cs, cs * 1.9, cs); g.add(cr);
      var gl = glowSprite(cs * 7, coreGlowTex); g.add(gl); g.visible = false; scene.add(g);
      var c = { g: g, cr: cr, glow: gl, B: B, dir: dir, dirW: new V3(), pos: new V3(), vel: new V3(), hp: 0, maxHp: 90 + B.R * 0.25, alive: false, cs: cs, fireT: 1.8 + Math.random() * 2.5, tele: 0, burst: 0, burstT: 0, facing: false, pat: cfg.pat, flash: 0 };
      B.cores.push(c); cores.push(c);
    }
  });
  function coreLeft(B) { var n = 0; for (var i = 0; i < B.cores.length; i++) if (B.cores[i].alive) n++; return n; }
  function resetCores() {
    ORDER.forEach(function (id) { var B = bodies[id]; B.maxHp = planetHp(B.R); B.hp = B.maxHp; });
    cores.forEach(function (c) { c.alive = true; c.hp = c.maxHp; c.g.visible = true; c.fireT = 1.8 + Math.random() * 2.5; c.tele = 0; c.burst = 0; c.flash = 0; });
  }
  function killCore(c) {
    if (!c.alive) return; c.alive = false; c.g.visible = false; var B = c.B;
    burst(c.pos, 26, 70, 2.6, 1, 0.6, 0.25, 0.9); fireball(c.pos, c.cs * 7, 0.7); ring(c.pos, c.cs * 10, 0xffa060, 0.6);
    G.coresKilled++; award('killScore', 200); bump(2); if (B.state === 'alive') { B.hp = Math.max(0, B.hp - B.maxHp * 0.05); B.u.flash.value = 1; } shake = Math.max(shake, Math.max(0, 1.2 - G.pos.distanceTo(c.pos) / 500));
    if (B.state === 'alive' && B.hp <= 0) { B.state = 'dying'; B.dyingT = 1.5; events.push({ type: 'dying', id: B.id }); pfxDying(B); }
    else events.push({ type: 'core', left: coreLeft(B), id: B.id });
  }
  function coreAim(c, speed, spreadOff, kind, w, len, col) {
    var dist = c.pos.distanceTo(G.pos), lead = dist / speed;
    tmpD.copy(G.pos).addScaledVector(G.vel, lead * 0.7).sub(c.pos).normalize(); tmpE.crossVectors(tmpD, UPV).normalize();
    tmpC.copy(tmpD).addScaledVector(tmpE, spreadOff).normalize().multiplyScalar(speed); tmpB.copy(c.pos).addScaledVector(c.dirW, c.cs * 2);
    spawnBullet(false, tmpB, tmpC, 4.6, { kind: kind, w: w, len: len, col: col });
  }
  function updateCores(dt) {
    var pl = G.pos;
    cores.forEach(function (c) {
      if (!c.alive) return; var B = c.B; if (B.state === 'dead') { c.alive = false; c.g.visible = false; return; }
      c.dirW.copy(c.dir).applyAxisAngle(AY, B.mesh.rotation.y).applyAxisAngle(AZ, B.tilt.rotation.z);
      c.pos.copy(c.dirW).multiplyScalar(B.R).add(B.pos);
      var w = VIS[B.id].spin; tmpOP.set(0, 1, 0).applyAxisAngle(AZ, B.tilt.rotation.z).multiplyScalar(w); tmpE.copy(c.pos).sub(B.pos); c.vel.crossVectors(tmpOP, tmpE).add(B.vel);
      tmpD.copy(pl).sub(B.pos).normalize(); c.facing = c.dirW.dot(tmpD) > 0.04;
      c.g.position.copy(c.pos).addScaledVector(c.dirW, c.cs * 0.4); c.g.quaternion.setFromUnitVectors(UPV, c.dirW); c.flash = Math.max(0, c.flash - dt * 4);
      var dist = c.pos.distanceTo(pl);
      if (mode === 'play' && B.state === 'alive' && !G.result && c.facing && dist < 1700 && dist > 90) {
        if (c.burst > 0) { c.burstT -= dt; if (c.burstT <= 0) { c.burstT = 0.14; c.burst--; coreAim(c, 470, 0, 0, 1.6, 38, [1, 0.5, 0.15]); } }
        else {
          c.fireT -= dt; if (c.fireT < 0.7) c.tele = 1 - Math.max(0, c.fireT) / 0.7;
          if (c.fireT <= 0) {
            c.tele = 0;
            if (c.pat === 'single') { c.fireT = 2.4 + Math.random() * 1.2; coreAim(c, 520, 0, 0, 1.7, 42, [1, 0.5, 0.15]); }
            else if (c.pat === 'burst') { c.fireT = 3.6 + Math.random() * 1.2; c.burst = 3; c.burstT = 0; }
            else if (c.pat === 'spread') { c.fireT = 3.8 + Math.random() * 1.2; for (var q = -2; q <= 2; q++) coreAim(c, 430, q * 0.1, 0, 1.6, 36, [1, 0.4, 0.2]); }
            else { c.fireT = 4.2 + Math.random() * 1.4; coreAim(c, 250, -0.05, 1, 3.0, 30, [1, 0.3, 0.6]); coreAim(c, 250, 0.05, 1, 3.0, 30, [1, 0.3, 0.6]); }
          }
        }
      } else { c.tele = 0; if (c.fireT < 0.9) c.fireT = 0.9; }
      c.glow.scale.setScalar(c.cs * 7 * (1 + c.tele * 1.2 + c.flash * 0.8)); c.cr.rotation.y += dt * 1.2;
      c.glow.material.color.setRGB(1, 1 - 0.35 * c.tele, 1 - 0.7 * c.tele);
    });
  }

  /* ---------- Jupiter lightning ---------- */
  var zaps = [{ on: false, t: 0, S: new V3(), T: new V3(), hit: false }, { on: false, t: 0, S: new V3(), T: new V3(), hit: false }, { on: false, t: 0, S: new V3(), T: new V3(), hit: false }];
  function scheduleZap() {
    var Jp = bodies.jupiter, z = null; for (var i = 0; i < zaps.length; i++) if (!zaps[i].on) { z = zaps[i]; break; } if (!z) return;
    z.on = true; z.t = 0; z.hit = false; z.T.copy(G.pos).addScaledVector(G.vel, 1.0); z.T.x += (Math.random() - 0.5) * 30; z.T.y += (Math.random() - 0.5) * 30; z.T.z += (Math.random() - 0.5) * 30;
    z.S.copy(z.T).sub(Jp.pos).normalize().multiplyScalar(Jp.R * 0.99).add(Jp.pos); ring(z.T, 110, 0xaad4ff, 0.95); events.push({ type: 'zapWarn' });
  }
  function updateZaps(dt) {
    var Jp = bodies.jupiter;
    if (Jp.state !== 'dead' && !G.result) { var dj = G.pos.distanceTo(Jp.pos); if (dj < Jp.R * 2.5 && dj > Jp.R * 1.02) { G.zapT -= dt; if (G.zapT <= 0) { G.zapT = 2.0 + Math.random() * 1.3; scheduleZap(); } } }
    zaps.forEach(function (z, i) {
      if (!z.on) { clearBeam(i); return; } z.t += dt;
      if (z.t < 0.95) { setBeam(i, z.S, z.T, 0.35, 0.5, 0.75, 1, 0.25 + z.t * 0.6); }
      else if (z.t < 1.2) {
        setBeam(i, z.S, z.T, 7, 0.65, 0.85, 1, 1.0);
        if (!z.hit) { z.hit = true; burst(z.T, 30, 70, 2, 0.7, 0.85, 1, 0.5); fireball(z.T, 90, 0.4); events.push({ type: 'zap' }); shake = Math.max(shake, Math.max(0, 1.4 - G.pos.distanceTo(z.T) / 150)); }
        if (z.t < 1.06 && segDist(G.pos, z.S, z.T) < 26) { if (damage(14, 'lightning')) { burst(G.pos, 14, 26, 1, 0.7, 0.85, 1, 0.5); z.t = 1.07; } }
      } else { z.on = false; clearBeam(i); }
    });
  }

  /* ---------- final boss: guardians first, then the Sun itself ---------- */
  var sunGlow0 = sunGlow.scale.x;
  var boss = { alive: false, stage: 0, dying: 0, hp: 0, max: 32000, pos: new V3(), ph: 1, t: 0, atk: 0, ringT: 0, spawnT: 0, beamT: 0, beamS: 0, beamT2: 0, beamHit: false, beamDir: new V3(), aim: new V3(), rainT: 0, novaT: 0, novaS: 0, hintT: 0, inv: 0, flash: 0, g: new THREE.Group(), rings: [] };
  (function () {
    boss.core = { material: { emissiveIntensity: 1 } }; boss.g.visible = false;
  })();
  var flameTex = glowTex([[0, 'rgba(255,250,210,0.95)'], [0.3, 'rgba(255,150,40,0.55)'], [1, 'rgba(255,80,10,0)']]);
  function sunSurface(dir, out) { return out.copy(sunPos).addScaledVector(dir, SUN_R * 1.03); }
  function startBoss() {
    boss.alive = true; boss.stage = 1; boss.dying = 0; boss.ph = 1; boss.t = 0; boss.pos.copy(sunPos); boss.hp = boss.max; boss.inv = 999; boss.flash = 1; boss.hintT = 0;
    var gi = 0;
    drones.forEach(function (d) {
      if (!d.guard) return; var a = gi / 4 * TAU + 0.6; gi++;
      d.alive = true; d.awake = false; d.hp = ETYPE[d.type].hp; d.max = d.hp; d.ang = a; d.pr = 1500; d.fireT = 3 + Math.random() * 2; d.flash = 0; d.vel.set(0, 0, 0); d.side = gi % 2 ? 1 : -1; d.st = 0; d.stT = 3; d.ls = 0; d.lT = 0; d.spT = 6; d.charge = 0;
      d.pos.set(Math.cos(a) * 1500, (gi - 2.5) * 60, Math.sin(a) * 1500); d.g.position.copy(d.pos); d.g.visible = true; d.g.scale.setScalar(GS); ring(d.pos, 240, 0xffa060, 1.0);
    });
    ring(sunPos, 900, 0xffa060, 1.4); fireball(sunPos, 900, 1.2); G.bombs = Math.max(G.bombs, 5); G.hull = Math.min(HULL_MAX, G.hull + 40); G.energy = ENERGY_MAX;
    shake = Math.max(shake, 1.2); events.push({ type: 'bossStart' });
  }
  function guardDown(d) {
    var left = guardsLeft(); if (d.type === 'g_lancer') clearBeam(4); events.push({ type: 'guardDown', name: ETYPE[d.type].name, left: left });
    if (left <= 0 && boss.alive && boss.stage === 1) {
      boss.stage = 2; boss.inv = 3.2; boss.hp = boss.max; boss.ph = 1; boss.flash = 1; boss.atk = 3.5; boss.ringT = 6; boss.rainT = 5; boss.beamT = 9; boss.beamS = 0; boss.spawnT = 12; boss.novaT = 12; boss.novaS = 0;
      ring(sunPos, 1400, 0xffd080, 1.6); fireball(sunPos, 1100, 1.4); shake = Math.max(shake, 1.8); flashVig = Math.max(flashVig, 0.6); events.push({ type: 'sunAwake' });
    }
  }
  function bossPhase(n) {
    boss.ph = n; boss.inv = 2.4; boss.flash = 1; boss.atk = 3.5; boss.ringT = 4; boss.rainT = 3; boss.beamS = 0; boss.beamT = 6; boss.novaT = n === 3 ? 7 : 99; boss.novaS = 0; clearBeam(3);
    for (var i = NB; i < NBUL; i++) if (bAlive[i]) { bAlive[i] = 0; burst(tmpA.set(bPos[i * 3], bPos[i * 3 + 1], bPos[i * 3 + 2]), 2, 10, 1, 1, 0.5, 0.2, 0.4); }
    ring(sunPos, 1200, 0xffc080, 1.2); fireball(sunPos, 800, 1.0); shake = Math.max(shake, 1.4); events.push({ type: 'bossPhase', n: n });
  }
  function bossHit(dmg) {
    if (!boss.alive) return false;
    if (boss.stage !== 2 || boss.inv > 0) { if (boss.stage === 1 && boss.hintT <= 0) { boss.hintT = 4; events.push({ type: 'sunShielded' }); } return false; }
    boss.hp -= dmg; boss.flash = Math.min(1, boss.flash + 0.25); G.shotsHit++; crossHit = 0.12;
    if (boss.hp <= 0) { boss.hp = 0; boss.alive = false; boss.dying = 3.6; clearBeam(3); for (var i = NB; i < NBUL; i++) bAlive[i] = 0; events.push({ type: 'bossDie' }); }
    else if (boss.ph === 1 && boss.hp < boss.max * 0.66) bossPhase(2); else if (boss.ph === 2 && boss.hp < boss.max * 0.33) bossPhase(3);
    return true;
  }
  var sDir = new V3(), sPt = new V3();
  function aimDirFromSun(lead) { return sDir.copy(G.pos).addScaledVector(G.vel, lead).sub(sunPos).normalize(); }
  function sunVolley(n, spread, speed, kind, w, len) {
    var dist = G.pos.length(), dir = aimDirFromSun(dist / speed * 0.8); tmpE.crossVectors(dir, UPV).normalize(); var up2 = tmpA.crossVectors(tmpE, dir).normalize();
    for (var k = 0; k < n; k++) { var o = (k - (n - 1) / 2) * spread; tmpC.copy(dir).addScaledVector(tmpE, o).addScaledVector(up2, (Math.random() - 0.5) * spread).normalize(); sunSurface(tmpC, tmpB); tmpC.multiplyScalar(speed); spawnBullet(false, tmpB, tmpC, 11, { kind: kind, len: len, w: w, col: [1, 0.5, 0.1] }); }
    emit(tmpB.x, tmpB.y, tmpB.z, 0, 0, 0, 0.5, 120, 1, 0.6, 0.2);
  }
  function updateBoss(dt) {
    if (boss.hintT > 0) boss.hintT -= dt;
    if (boss.dying > 0) {
      boss.dying -= dt; sunGlow.scale.setScalar(sunGlow0 * (1.2 + Math.random() * 0.15));
      if (Math.random() < dt * 10) { tmpB.set(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).normalize().multiplyScalar(SUN_R * 1.05); fireball(tmpB, 160 + Math.random() * 160, 0.7); burst(tmpB, 16, 90, 3, 1, 0.6, 0.25, 0.9); events.push({ type: 'bossBoom' }); shake = Math.max(shake, 0.8); }
      if (boss.dying <= 0) {
        sunGlow.scale.setScalar(sunGlow0); ring(sunPos, 4000, 0xffffff, 2.2); ring(sunPos, 2400, 0xffb060, 1.8); fireball(sunPos, 1800, 2.0); burst(sunPos, 120, 800, 10, 1, 0.8, 0.4, 2.0);
        flashVig = 1; shake = 3; slowT = 1.4; award('bossScore', 8000); G.bossKilled = true; G.result = 'win'; G.endT = 4.4; events.push({ type: 'win' });
      }
      return;
    }
    if (!boss.alive) { if (sunGlow.scale.x !== sunGlow0) sunGlow.scale.setScalar(sunGlow0); return; }
    boss.t += dt; boss.flash = Math.max(0, boss.flash - dt * 1.6); if (boss.inv > 0 && boss.stage === 2) boss.inv -= dt;
    sunGlow.scale.setScalar(sunGlow0 * (1 + boss.flash * 0.25 + (boss.novaS === 1 ? 0.3 * Math.sin(boss.t * 22) + 0.3 : 0)));
    var ds = G.pos.length() - SUN_R;
    if (ds < 520 && !G.result) { G.hull -= (14 * (1 - ds / 520) + 3) * dt; redVig = Math.max(redVig, 0.45); shake = Math.max(shake, 0.25); }
    if (boss.stage !== 2 || boss.inv > 0 || G.result) return;
    var f = boss.ph === 3 ? 0.7 : (boss.ph === 2 ? 0.85 : 1);
    boss.atk -= dt; if (boss.atk <= 0) { boss.atk = 3.4 * f; sunVolley(boss.ph === 3 ? 5 : 3, 0.06, 400, 2, 9, 72); events.push({ type: 'bossShot' }); }
    boss.rainT -= dt;
    if (boss.rainT <= 0) {
      boss.rainT = 5.2 * f; var cnt = boss.ph === 1 ? 6 : 9;
      for (var c = 0; c < cnt; c++) {
        tmpD.copy(G.pos).normalize(); tmpC.set(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).multiplyScalar(0.9).add(tmpD).normalize(); sunSurface(tmpC, sPt);
        for (var q = 0; q < 3; q++) { tmpE.copy(G.pos).addScaledVector(G.vel, 3).sub(sPt).normalize(); tmpE.x += (Math.random() - 0.5) * 0.5; tmpE.y += (Math.random() - 0.5) * 0.5; tmpE.z += (Math.random() - 0.5) * 0.5; tmpE.normalize().multiplyScalar(240 + Math.random() * 60); spawnBullet(false, sPt, tmpE, 12, { kind: 1, len: 34, w: 2.6, col: [1, 0.4, 0.1] }); }
        emit(sPt.x, sPt.y, sPt.z, tmpC.x * 60, tmpC.y * 60, tmpC.z * 60, 0.6, 90, 1, 0.5, 0.15);
      }
      events.push({ type: 'sunRain' });
    }
    if (boss.ph >= 2) {
      boss.ringT -= dt;
      if (boss.ringT <= 0) { boss.ringT = 6.5 * f; tmpD.copy(G.pos).normalize(); tmpC.set(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).normalize(); tmpD.crossVectors(tmpD, tmpC).normalize(); if (tmpD.lengthSq() < 0.5) tmpD.set(0, 1, 0); ringShot(sunPos, 44, 285, 1, 2.8, 32, [1, 0.45, 0.12], 12, tmpD); events.push({ type: 'bossRing' }); }
      boss.spawnT -= dt;
      if (boss.spawnT <= 0) { boss.spawnT = 14; var made = 0; for (var di = 0; di < drones.length && made < 3; di++) { var d = drones[di]; if (d.alive || !d.reserve || d.guard || d.type !== 'fighter') continue; d.alive = true; d.awake = true; d.hp = ETYPE.fighter.hp; d.max = d.hp; d.fireT = 1.5; d.vel.set(0, 0, 0); tmpC.set(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).normalize(); sunSurface(tmpC, d.pos); d.pos.addScaledVector(tmpC, 150); d.g.position.copy(d.pos); d.g.visible = true; d.g.scale.setScalar(d.sc); made++; ring(d.pos, 60, 0xff7744, 0.5); } }
      // flame jet: telegraphed beam from the sun's surface
      if (boss.beamS === 0) { boss.beamT -= dt; if (boss.beamT <= 0) { boss.beamS = 1; boss.beamT2 = 0; boss.aim.copy(G.pos).addScaledVector(G.vel, 1.5); events.push({ type: 'bossCharge' }); } }
      else if (boss.beamS === 1) {
        boss.beamT2 += dt; if (boss.beamT2 < 1.1) boss.aim.lerp(tmpA.copy(G.pos).addScaledVector(G.vel, Math.max(0.4, 1.5 - boss.beamT2)), 0.08);
        boss.beamDir.copy(boss.aim).sub(sunPos).normalize(); sunSurface(boss.beamDir, tmpC); tmpB.copy(tmpC).addScaledVector(boss.beamDir, 6500);
        setBeam(3, tmpC, tmpB, 0.4 + boss.beamT2 * 0.8, 1, 0.3, 0.1, 0.35 + boss.beamT2 * 0.4);
        if (boss.beamT2 >= 1.4) { boss.beamS = 2; boss.beamT2 = 0; boss.beamHit = false; events.push({ type: 'bossBeam' }); shake = Math.max(shake, 1.0); }
      } else {
        boss.beamT2 += dt; sunSurface(boss.beamDir, tmpC); tmpB.copy(tmpC).addScaledVector(boss.beamDir, 6500); setBeam(3, tmpC, tmpB, 16, 1, 0.7, 0.3, 1.0);
        if (!boss.beamHit && segDist(G.pos, tmpC, tmpB) < 30) { boss.beamHit = true; if (damage(28, 'beam')) burst(G.pos, 20, 36, 1.3, 1, 0.7, 0.3, 0.7); }
        if (boss.beamT2 > 0.8) { boss.beamS = 0; boss.beamT = 8 * f; clearBeam(3); }
      }
    }
    if (boss.ph === 3) {
      if (boss.novaS === 0) { boss.novaT -= dt; if (boss.novaT <= 0) { boss.novaS = 1; boss.novaT2 = 0; events.push({ type: 'novaCharge' }); } }
      else { boss.novaT2 += dt; if (boss.novaT2 >= 2.6) { boss.novaS = 0; boss.novaT = 14; var N = 90; for (var k = 0; k < N; k++) { var y = 1 - (k + 0.5) / N * 2, rr = Math.sqrt(1 - y * y), th = k * 2.399963; tmpC.set(Math.cos(th) * rr, y, Math.sin(th) * rr); sunSurface(tmpC, tmpB); tmpC.multiplyScalar(310); spawnBullet(false, tmpB, tmpC, 13, { kind: 0, len: 40, w: 3.2, col: [1, 0.6, 0.2] }); } ring(sunPos, 1800, 0xffd080, 1.2); shake = Math.max(shake, 1.6); events.push({ type: 'novaBlast' }); } }
    }
  }
  /* ---------- boss-stage guardians (four different designs) ---------- */
  var GTYPES = ['g_bulwark', 'g_lancer', 'g_hive', 'g_reaper'];

  pfxGeo.cap = new THREE.SphereGeometry(1, 14, 8, 0, 1.0, 0.9, 1.0);
  function gMat(c, e, ei) { return new THREE.MeshStandardMaterial({ color: c, emissive: e || 0x000000, emissiveIntensity: ei || 0, roughness: 0.3, metalness: 0.7, side: THREE.DoubleSide }); }
  function gBasic(c) { return new THREE.MeshBasicMaterial({ color: c, transparent: true, opacity: 0.95, blending: THREE.AdditiveBlending, depthWrite: false }); }
  function energyMat(ca, cb) {
    return new THREE.ShaderMaterial({
      uniforms: { uT: GU, uA: { value: new THREE.Color(ca) }, uB: { value: new THREE.Color(cb) } },
      vertexShader: 'varying vec3 vN; varying vec3 vV; varying vec3 vP; void main(){ vec4 mv = modelViewMatrix * vec4(position,1.0); vN = normalize(normalMatrix * normal); vV = normalize(-mv.xyz); vP = position; gl_Position = projectionMatrix * mv; }',
      fragmentShader: 'uniform float uT; uniform vec3 uA; uniform vec3 uB; varying vec3 vN; varying vec3 vV; varying vec3 vP; void main(){ float f = 1.0 - abs(dot(normalize(vN), normalize(vV))); float rim = f * f; float w = 0.5 + 0.5 * sin(vP.y * 0.16 + uT * 1.8 + sin(vP.x * 0.12 - uT * 1.1) * 2.4 + sin(vP.z * 0.1 + uT) * 1.6); vec3 c = mix(uA, uB, w) * (0.45 + rim * 1.5); gl_FragColor = vec4(c, (0.2 + rim * 0.8) * 0.85); }',
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending
    });
  }
  function buildGuard(type) {
    var g = new THREE.Group(), spin = new THREE.Group(), m, i, ud = g.userData; g.add(spin); g.scale.setScalar(GS);
    if (type === 'g_bulwark') {
      g.add(new THREE.Mesh(new THREE.SphereGeometry(22, 40, 28), gMat(0x1a2a46, 0x2a7fff, 0.9)));
      var shell = new THREE.Mesh(new THREE.SphereGeometry(31, 40, 28), energyMat(0x2a7fff, 0x7ff0ff)); g.add(shell);
      var belt = new THREE.Group(); belt.rotation.x = Math.PI / 2; spin.add(belt);
      for (i = 0; i < 6; i++) belt.add(new THREE.Mesh(new THREE.SphereGeometry(62, 24, 12, i / 6 * TAU + 0.07, TAU / 6 - 0.15, 0.75, 1.64), gMat(0x233a5c, 0x1c5cc0, 0.55)));
      [1, -1].forEach(function (s) { var e = new THREE.Mesh(new THREE.TorusGeometry(42.2, 1.3, 10, 96), gBasic(0x7fe8ff)); e.rotation.x = Math.PI / 2; e.position.y = s * 45.3; belt.add(e); });
      var ra = new THREE.Mesh(new THREE.TorusGeometry(50, 1.4, 12, 110), gBasic(0x66ccff)), rb = new THREE.Mesh(new THREE.TorusGeometry(54, 1.1, 12, 110), gBasic(0x99ddff)); ra.rotation.x = 1.2; rb.rotation.y = 1.1; g.add(ra); g.add(rb);
      g.add(glowSprite(190, glowTex([[0, 'rgba(120,190,255,0.8)'], [0.4, 'rgba(60,120,255,0.3)'], [1, 'rgba(40,80,255,0)']])));
      ud.anim = function (t) { ra.rotation.y = t * 0.7; rb.rotation.x = -t * 0.9; shell.scale.setScalar(1 + 0.04 * Math.sin(t * 3)); };
    } else if (type === 'g_lancer') {
      var pts = [[0, -100], [5, -96], [11, -80], [15, -50], [14, -10], [12, 30], [9, 60], [5, 90], [0, 118]].map(function (q) { return new THREE.Vector2(q[0], q[1]); });
      m = new THREE.Mesh(new THREE.LatheGeometry(pts, 40), gMat(0x4a4020, 0xffb000, 0.4)); m.rotation.x = Math.PI / 2; g.add(m);
      var sh = new THREE.Mesh(new THREE.SphereGeometry(1, 32, 22), energyMat(0xffa000, 0xfff0a0)); sh.scale.set(22, 22, 125); sh.position.z = 8; g.add(sh);
      var lens = new THREE.Mesh(new THREE.SphereGeometry(8, 20, 14), gBasic(0xfff2b0)); lens.position.z = 104; g.add(lens);
      for (i = 0; i < 3; i++) { var fa = i / 3 * TAU, fg = new THREE.Group(); fg.rotation.z = fa; var fin = new THREE.Mesh(new THREE.TorusGeometry(46, 2.2, 10, 48, 1.2), gMat(0x3a3220, 0xffa000, 0.6)); fin.rotation.x = -Math.PI / 2; fin.position.set(-8, 0, -10); fg.add(fin); g.add(fg); }
      var rr = []; for (i = 0; i < 3; i++) { var rg = new THREE.Mesh(new THREE.TorusGeometry(20, 1.6, 10, 64), gBasic(0xffd060)); g.add(rg); rr.push(rg); }
      g.add(glowSprite(150, glowTex([[0, 'rgba(255,230,120,0.85)'], [0.4, 'rgba(255,170,40,0.3)'], [1, 'rgba(255,120,0,0)']])));
      ud.anim = function (t) { for (var k = 0; k < 3; k++) { var u = (t * 0.5 + k / 3) % 1; rr[k].position.z = -80 + u * 180; rr[k].scale.setScalar(0.8 + 0.5 * Math.sin(u * Math.PI)); } };
    } else if (type === 'g_hive') {
      var body = new THREE.Mesh(new THREE.SphereGeometry(34, 40, 28), gMat(0x2a1f3a, 0x8a3cff, 0.6)); body.scale.set(1.15, 0.95, 1.5); g.add(body);
      var hs = new THREE.Mesh(new THREE.SphereGeometry(41, 40, 28), energyMat(0x8a3cff, 0x77ff99)); hs.scale.set(1.15, 0.95, 1.5); g.add(hs);
      var halo = glowTex([[0, 'rgba(170,255,170,0.95)'], [0.4, 'rgba(90,255,120,0.35)'], [1, 'rgba(60,255,100,0)']]); ud.pods = [];
      for (i = 0; i < 8; i++) { var ha = i / 8 * TAU, pod = new THREE.Mesh(new THREE.SphereGeometry(9, 24, 16), gMat(0x1c3a22, 0x55ff77, 1.1)); pod.position.set(Math.cos(ha) * 52, Math.sin(ha) * 42, (i % 2 ? 14 : -14)); var hl = glowSprite(46, halo); pod.add(hl); spin.add(pod); ud.pods.push(pod); }
      var o1 = new THREE.Mesh(new THREE.TorusGeometry(52, 1.1, 10, 110), gBasic(0x77ff99)); o1.scale.y = 0.8; spin.add(o1);
      var o2 = new THREE.Mesh(new THREE.TorusGeometry(62, 1.4, 10, 110), gBasic(0xaa88ff)); o2.rotation.y = Math.PI / 2; g.add(o2);
      g.add(glowSprite(170, glowTex([[0, 'rgba(150,255,160,0.8)'], [0.4, 'rgba(120,80,255,0.3)'], [1, 'rgba(100,40,255,0)']])));
      ud.anim = function (t) { hs.scale.set(1.15 + 0.04 * Math.sin(t * 2.4), 0.95 + 0.04 * Math.sin(t * 2.4), 1.5); o2.rotation.x = t * 0.5; };
    } else {
      g.add(new THREE.Mesh(new THREE.SphereGeometry(12, 32, 22), gMat(0x120a0a, 0xff2a1a, 1.6)));
      var rs = new THREE.Mesh(new THREE.SphereGeometry(19, 32, 22), energyMat(0xff2a1a, 0xffb070)); g.add(rs);
      for (i = 0; i < 4; i++) { var bl = new THREE.Mesh(new THREE.TorusGeometry(34, 3, 8, 48, 1.5), gMat(0x3a0f12, 0xff3a2a, 0.9)); bl.scale.z = 0.5; bl.rotation.z = i / 4 * TAU; spin.add(bl); }
      var ri = new THREE.Mesh(new THREE.TorusGeometry(24, 1, 8, 64), gBasic(0xff6a50)); spin.add(ri);
      g.add(glowSprite(140, glowTex([[0, 'rgba(255,90,70,0.9)'], [0.4, 'rgba(255,40,30,0.3)'], [1, 'rgba(255,20,10,0)']])));
      ud.anim = function (t) { rs.scale.setScalar(1 + 0.08 * Math.sin(t * 9)); };
    }
    g.visible = false; scene.add(g); ud.spin = spin; return g;
  }
  function gQ(from, to) { return new THREE.Quaternion().setFromUnitVectors(from, to); }
  function guardDeathFx(d) {
    var p = d.pos.clone(), S = d.r, i, a, v, t = d.type;
    if (t === 'g_bulwark') {
      burst(p, 80, 260, 3, 0.4, 0.75, 1, 1.3);
      pfx({ sprite: 1, pos: p, col: 0xaadfff, s0: S * 1.2, s1: S * 4.5, dur: 0.5, op: 1, k: 1.6 });
      pfx({ geo: 'ico2', wire: true, pos: p, col: 0x4aa8ff, s0: S * 0.9, s1: S * 2.4, dur: 0.8, op: 0.8, spin: [0.6, 0.9, 0.3] });
      pfx({ geo: 'sph', pos: p, col: 0x66bbff, s0: S * 0.7, s1: S * 2.6, dur: 0.45, op: 0.35 });
      for (i = 0; i < 3; i++) ring(p, S * (2.4 + i * 0.9), i ? 0x66ccff : 0xffffff, 0.55 + i * 0.15);
      for (i = 0; i < 6; i++) { a = i / 6 * TAU; v = new V3(Math.cos(a), (Math.random() - 0.5) * 0.8, Math.sin(a)).normalize(); pfx({ geo: 'cap', pos: p.clone().addScaledVector(v, S * 0.5), col: 0x8fd0ff, s0: S * 0.5, s1: S * 0.35, dur: 1.2, op: 1, vel: v.clone().multiplyScalar(300 + Math.random() * 160), spin: [Math.random() * 4, Math.random() * 4, Math.random() * 4], k: 1.0 }); }
    } else if (t === 'g_lancer') {
      v = new V3(0, 0, 1).applyQuaternion(d.g.quaternion); var q = gQ(pfxZ, v), qy = gQ(new V3(0, 1, 0), v);
      burst(p, 70, 300, 2.6, 1, 0.85, 0.35, 1.1);
      pfx({ sprite: 1, pos: p, col: 0xffe9a0, s0: S * 1.4, s1: S * 4, dur: 0.4, op: 1, k: 1.5 });
      pfx({ geo: 'sph', pos: p, q: qy, sy: 11, col: 0xffe27a, s0: S * 0.5, s1: S * 0.05, dur: 0.5, op: 1, ease: 'lin', k: 0.8 });
      for (i = 0; i < 4; i++) pfx({ geo: 'ring', pos: p.clone().addScaledVector(v, (i - 1.5) * S * 0.9), q: q, col: i % 2 ? 0xffc040 : 0xfff0b0, s0: S * 0.3, s1: S * (2.2 + i * 0.5), dur: 0.5 + i * 0.08, delay: i * 0.06, op: 0.95 });
      [1, -1].forEach(function (sg) { pfx({ geo: 'sph', pos: p.clone(), q: qy, sy: 6, col: 0xffd060, s0: S * 0.1, s1: S * 0.05, dur: 0.7, op: 1, vel: v.clone().multiplyScalar(sg * 800), k: 0.8 }); });
      pfx({ lines: true, geoObj: pfxSpikes(60, S * 0.4, S * 2.0), pos: p, col: 0xffd870, s0: 0.6, s1: 2.4, dur: 0.7, op: 0.9 });
    } else if (t === 'g_hive') {
      burst(p, 60, 200, 2.4, 0.45, 1, 0.5, 1.2); burst(p, 40, 260, 2.4, 0.7, 0.4, 1, 1.2);
      (d.g.userData.pods || []).forEach(function (pod, k) { var w = pod.getWorldPosition(new V3()); v = w.clone().sub(p).normalize(); pfx({ sprite: 1, pos: w, col: 0x77ff99, s0: S * 0.2, s1: S * 1.1, dur: 0.45, delay: k * 0.05, op: 1, vel: v.multiplyScalar(60), k: 1.4 }); });
      ring(p, S * 3.2, 0x77ff99, 0.7);
      pfx({ sprite: 1, pos: p, col: 0xa070ff, s0: S * 0.8, s1: S * 4.5, dur: 0.6, delay: 0.4, op: 1, k: 1.5 });
      pfx({ geo: 'sph', pos: p, col: 0x9a60ff, s0: S * 0.8, s1: S * 2.6, dur: 0.5, delay: 0.4, op: 0.35 });
      pfx({ lines: true, geoObj: pfxSpikes(50, S * 0.4, S * 1.6), pos: p, col: 0xaaff99, s0: 0.6, s1: 2.2, dur: 0.8, delay: 0.4, op: 0.9 });
    } else {
      burst(p, 90, 380, 2.2, 1, 0.3, 0.2, 1.0);
      pfx({ sprite: 1, pos: p, col: 0xff3a2a, s0: S * 3, s1: S * 0.15, dur: 0.25, op: 1, ease: 'in', k: 0.2 });
      pfx({ sprite: 1, pos: p, col: 0xffd0b0, s0: S * 0.6, s1: S * 5, dur: 0.55, delay: 0.25, op: 1, k: 1.5 });
      for (i = 0; i < 3; i++) { v = new V3(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).normalize(); pfx({ geo: 'ring', pos: p, q: gQ(pfxZ, v), col: 0xff4030, s0: S * 0.3, s1: S * (3 + i), dur: 0.5 + i * 0.1, delay: 0.25, op: 0.95 }); }
      pfx({ lines: true, geoObj: pfxSpikes(70, S * 0.3, S * 2.8), pos: p, col: 0xff6a50, s0: 0.6, s1: 2.6, dur: 0.7, delay: 0.25, op: 1 });
      for (i = 0; i < 2; i++) { v = new V3(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).normalize(); pfx({ geo: 'sph', pos: p, q: gQ(new V3(0, 1, 0), v), sy: 14, col: 0xff6a50, s0: S * 0.06, s1: S * 0.02, dur: 0.5, delay: 0.25, op: 1, k: 0.7 }); }
    }
  }
  function ringShot(origin, n, speed, kind, w, len, col, life, nrm) {
    tmpD.copy(nrm); tmpE.crossVectors(tmpD, UPV); if (tmpE.lengthSq() < 1e-4) tmpE.set(1, 0, 0); tmpE.normalize(); var tw = tmpA.crossVectors(tmpD, tmpE).normalize();
    for (var k = 0; k < n; k++) { var a = k / n * TAU; tmpC.copy(tmpE).multiplyScalar(Math.cos(a)).addScaledVector(tw, Math.sin(a)); tmpB.copy(origin).addScaledVector(tmpC, 30); tmpC.multiplyScalar(speed); spawnBullet(false, tmpB, tmpC, life, { kind: kind, len: len, w: w, col: col }); }
  }
  var gDir = new V3();
  function guardsLeft() { var n = 0; drones.forEach(function (d) { if (d.guard && d.alive) n++; }); return n; }
  function updateGuard(d, dt, dist) {
    var T = ETYPE[d.type], spin = d.g.userData.spin; spin.rotation.z += dt * (d.type === 'g_reaper' ? (d.st === 2 ? 14 : 5) : (d.type === 'g_bulwark' ? 0.6 : 0.9)); if (d.type === 'g_lancer') spin.rotation.z = 0;
    if (!d.awake) {
      d.ang += dt * 0.12; tmpB.set(Math.cos(d.ang) * d.pr, Math.sin(d.ang * 2 + d.ph) * 120, Math.sin(d.ang) * d.pr); d.vel.copy(tmpB).sub(d.pos).multiplyScalar(1.5); d.pos.lerp(tmpB, 1 - Math.exp(-dt * 2));
      if (dist < T.wake) d.awake = true;
    } else {
      var dir = gDir.copy(G.pos).sub(d.pos).divideScalar(Math.max(dist, 1)), want = tmpB.set(0, 0, 0);
      if (d.type === 'g_bulwark') { if (dist > 1300) want.copy(dir).multiplyScalar(130); else if (dist < 900) want.copy(dir).multiplyScalar(-110); tmpC.set(-dir.z, 0, dir.x).multiplyScalar(d.side * 45); want.add(tmpC); d.vel.lerp(want, 1 - Math.exp(-dt * 0.8)); }
      else if (d.type === 'g_lancer') { if (dist > 1600) want.copy(dir).multiplyScalar(200); else if (dist < 1100) want.copy(dir).multiplyScalar(-170); tmpC.set(-dir.z, 0, dir.x).multiplyScalar(d.side * 150); want.add(tmpC); want.y += Math.sin(G.t * 0.8 + d.ph) * 60; d.vel.lerp(want, 1 - Math.exp(-dt * 1.0)); }
      else if (d.type === 'g_hive') { if (dist > 1400) want.copy(dir).multiplyScalar(110); else if (dist < 900) want.copy(dir).multiplyScalar(-90); tmpC.set(-dir.z, 0, dir.x).multiplyScalar(d.side * 60); want.add(tmpC); d.vel.lerp(want, 1 - Math.exp(-dt * 0.8)); }
      else {
        d.stT -= dt;
        if (d.st === 0) { if (dist > 600) want.copy(dir).multiplyScalar(260); else if (dist < 380) want.copy(dir).multiplyScalar(-200); tmpC.set(-dir.z, 0, dir.x).multiplyScalar(d.side * 240); want.add(tmpC); d.vel.lerp(want, 1 - Math.exp(-dt * 2)); if (d.stT <= 0) { d.st = 1; d.stT = 1.0; d.dashDir.copy(dir); ring(d.pos, 80, 0xff3322, 1.0); events.push({ type: 'reaperCharge' }); } }
        else if (d.st === 1) { d.vel.multiplyScalar(Math.exp(-dt * 4)); d.dashDir.lerp(dir, 0.06).normalize(); if (d.stT <= 0) { d.st = 2; d.stT = 0.95; } }
        else { d.vel.copy(d.dashDir).multiplyScalar(820); if (d.stT <= 0) { d.st = 0; d.stT = 3.2 + Math.random(); for (var q = -2; q <= 2; q++) eShot(d, 480, q * 0.08, 0, 2.0, 44, [1, 0.25, 0.2], 3.6); } }
      }
      d.pos.addScaledVector(d.vel, dt);
      var sl = d.pos.length(); if (sl > 3400) d.pos.multiplyScalar(3400 / sl); if (sl < SUN_R + d.r + 80) d.pos.multiplyScalar((SUN_R + d.r + 80) / Math.max(sl, 1));
      d.fireT -= dt;
      if (d.type === 'g_bulwark') {
        if (d.fireT <= 0 && dist < 2400) { d.fireT = 3.4 + Math.random(); for (var s = -1; s <= 1; s++) eShot(d, 350, s * 0.06, 2, 9, 70, [0.5, 0.8, 1], 6.5); if (Math.random() < 0.5) { tmpC.copy(dir); ringShot(d.pos, 16, 230, 1, 2.6, 30, [0.5, 0.85, 1], 6, tmpC); } }
      } else if (d.type === 'g_lancer') {
        if (d.ls === 0) { if (d.fireT <= 0 && dist < 3000) { d.ls = 1; d.lT = 0; d.aim.copy(G.pos).addScaledVector(G.vel, 1.2); events.push({ type: 'lancerCharge' }); } else if (d.fireT > 1.6 && Math.random() < dt * 0.5 && dist < 2200) { eShot(d, 760, 0, 0, 2.2, 60, [1, 0.9, 0.4], 3.4); } }
        else if (d.ls === 1) { d.lT += dt; if (d.lT < 1.1) d.aim.lerp(tmpA.copy(G.pos).addScaledVector(G.vel, Math.max(0.4, 1.2 - d.lT)), 0.07); d.bdir.copy(d.aim).sub(d.pos).normalize(); tmpB.copy(d.pos).addScaledVector(d.bdir, 3200); setBeam(4, d.pos, tmpB, 0.3 + d.lT * 0.6, 1, 0.8, 0.2, 0.35 + d.lT * 0.4); if (d.lT >= 1.3) { d.ls = 2; d.lT = 0; d.bhit = false; events.push({ type: 'bossBeam' }); shake = Math.max(shake, 0.8); } }
        else { d.lT += dt; tmpB.copy(d.pos).addScaledVector(d.bdir, 3200); setBeam(4, d.pos, tmpB, 11, 1, 0.9, 0.4, 1.0); if (!d.bhit && segDist(G.pos, d.pos, tmpB) < 24) { d.bhit = true; if (damage(22, 'beam')) burst(G.pos, 18, 34, 1.3, 1, 0.8, 0.3, 0.7); } if (d.lT > 0.5) { d.ls = 0; d.fireT = 4 + Math.random() * 1.5; clearBeam(4); } }
      } else if (d.type === 'g_hive') {
        if (d.fireT <= 0 && dist < 2600) { d.fireT = 4 + Math.random(); tmpC.set(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5); ringShot(d.pos, 14, 240, 1, 2.6, 28, [0.6, 1, 0.5], 6.5, tmpC); }
        d.spT -= dt; if (d.spT <= 0) { d.spT = 9; var made = 0; for (var di = 0; di < drones.length && made < 2; di++) { var f = drones[di]; if (f.alive || !f.reserve || f.guard || f.type !== 'fighter') continue; f.alive = true; f.awake = true; f.hp = ETYPE.fighter.hp; f.max = f.hp; f.fireT = 1.4; f.vel.set(0, 0, 0); f.pos.copy(d.pos).add(tmpA.set((Math.random() - 0.5) * 120, (Math.random() - 0.5) * 80, (Math.random() - 0.5) * 120)); f.g.position.copy(f.pos); f.g.visible = true; f.g.scale.setScalar(f.sc); made++; ring(f.pos, 50, 0x77ff88, 0.5); } }
      }
      if (dist < d.r + 3 && !G.result && d.ramT <= 0) { d.ramT = 1.0; damage(d.type === 'g_reaper' && d.st === 2 ? 22 : 12, 'drone'); burst(G.pos, 12, 24, 1.0, 1, 0.5, 0.3, 0.6); }
    }
    GU.value = G.t; if (d.g.userData.anim) d.g.userData.anim(G.t); d.g.position.copy(d.pos); d.g.scale.setScalar(GS * (1 + d.flash * 0.05));
    if (d.type === 'g_reaper' && d.st >= 1 && d.awake) { tmpC.copy(d.pos).add(d.dashDir); d.g.lookAt(tmpC); } else { tmpC.copy(G.pos); if (d.awake) d.g.lookAt(tmpC); }
  }

  function findTarget(maxAng, maxDist) {
    var best = null, ba = maxAng;
    function consider(pos, vel, ext, ref) {
      tmpC.copy(pos).sub(G.pos); var dl = tmpC.length(); if (dl > maxDist || dl < 20) return;
      var ang = Math.acos(clampN(tmpC.dot(fwd) / dl, -1, 1)) - ext / dl; if (ang < ba) { ba = ang; best = ref; best.p = pos; best.v = vel; }
    }
    for (var i = 0; i < drones.length; i++) { var d = drones[i]; if (d.alive) consider(d.pos, d.vel, d.r, d); }
    for (var j = 0; j < cores.length; j++) { var n = cores[j]; if (n.alive && n.facing) consider(n.pos, n.vel, n.cs * 1.6, n); }
    if (boss.alive && boss.stage === 2) consider(boss.pos, ZV, SUN_R, boss);
    return best;
  }
  var ZV = new V3(0, 0, 0);

  function objective() {
    if (boss.alive) {
      if (boss.stage === 1) { var gt = null, gd = 1e12, tot = 0; drones.forEach(function (d) { if (!d.guard || !d.alive) return; tot++; var q = d.pos.distanceTo(G.pos); if (q < gd) { gd = q; gt = d; } }); if (gt) return { pos: gt.pos, R: gt.r, label: gt.name, name: '守衛・' + gt.name + '（剩 ' + tot + '/4）', frac: gt.hp / gt.max, boss: true }; }
      return { pos: boss.pos, R: SUN_R, label: '太陽', name: '太陽・第 ' + boss.ph + ' 階段' + (boss.inv > 0 ? '・無敵' : ''), frac: boss.hp / boss.max, boss: true };
    }
    var T = G.tgt; if (!T || T.state === 'dead' || boss.dying > 0 || G.bossT > 0) return null;
    return { pos: T.pos, R: T.R, label: PL[T.id].name, name: PL[T.id].name + (T.state === 'dying' ? '・崩解中' : '・血量 ' + Math.ceil(T.hp) + '/' + T.maxHp), frac: T.state === 'dying' ? 0 : T.hp / T.maxHp };
  }

  /* ---------- core update (no rendering) ---------- */
  function damage(amount, kind) {
    if (G.invuln > 0 && kind !== 'bullet' || G.result) return false;
    amount *= (1 - 0.12 * G.up.hull); if (kind === 'bullet' || kind === 'drone' || kind === 'beam' || kind === 'lightning') amount *= 0.65;
    G.hull -= amount; G.invuln = kind === 'bullet' ? G.invuln : (kind === 'heat' ? 0 : 0.6); G.hits++; G.hitLog[kind] = (G.hitLog[kind] || 0) + 1;
    if (kind !== 'heat') { if (amount >= 8) { if (G.combo >= 4) events.push({ type: 'comboBreak' }); G.combo = 0; G.comboT = 0; } else if (G.comboT > 0) G.comboT = Math.max(0.05, G.comboT - 1.2); }
    shake = Math.max(shake, Math.min(2.2, 0.5 + amount * 0.06)); redVig = Math.max(redVig, kind === 'bullet' ? 0.55 : 1); kick += kind === 'bullet' ? 0.012 : 0.03; events.push({ type: 'hit', kind: kind, amount: amount }); return true;
  }
  function nearestPlanet() {
    var best = null, bd = 1e12;
    ORDER.forEach(function (id) { var P = bodies[id]; if (P.state === 'dead') return; var d = G.pos.distanceTo(P.pos) - P.R, rel = d / P.R; if (rel < bd) { bd = rel; best = { id: id, alt: d, rel: rel }; } });
    var ds = G.pos.length() - SUN_R; if (ds / SUN_R < bd || !best) best = { id: 'sun', alt: ds, rel: ds / SUN_R };
    return best;
  }
  function targetPlanet() {
    if (G.hitPl && G.hitPl.state !== 'dead' && G.t - G.hitPlT < 6) return G.hitPl;
    var best = null, bd = 1e12;
    ORDER.forEach(function (id) { var P = bodies[id]; if (P.state === 'dead') return; var d = G.pos.distanceTo(P.pos); if (d < bd) { bd = d; best = P; } });
    return best;
  }
  function prepField(f) { f.group.updateMatrixWorld(true); f.spin.updateMatrixWorld(true); f.inv.copy(f.spin.matrixWorld).invert(); }
  var lp = new V3();
  function killRock(f, i, scored) {
    f.alive[i] = 0; f.mesh.setMatrixAt(i, ZERO); f.mesh.instanceMatrix.needsUpdate = true; if (scored) { award('rockScore', 5); G.rocks++; }
  }
  function collideField(f, shipR, kind) {
    lp.copy(G.pos).applyMatrix4(f.inv);
    if (kind === 'rock') { if (Math.abs(Math.hypot(lp.x, lp.z) - BELT_R) > 520 || Math.abs(lp.y) > 160) return; } else { var lim = bodies.saturn.R * 2.4; if (Math.abs(lp.x) > lim || Math.abs(lp.z) > lim || Math.abs(lp.y) > 400) return; }
    for (var i = 0; i < f.N; i++) {
      if (!f.alive[i]) continue; var dx = f.lx[i] - lp.x; if (dx > 40 || dx < -40) continue; var dy = f.ly[i] - lp.y, dz = f.lz[i] - lp.z, rr = f.lr[i] * 0.9 + shipR;
      if (dx * dx + dy * dy + dz * dz < rr * rr) {
        killRock(f, i, false); var amount = kind === 'rock' ? 6 + f.lr[i] * 0.9 : 3 + f.lr[i];
        if (damage(amount, kind)) { G.vel.multiplyScalar(0.7); burst(G.pos, 14, 24, 1.0, 0.8, 0.72, 0.6, 0.7); } else burst(G.pos, 6, 16, 0.8, 0.8, 0.72, 0.6, 0.5);
      }
    }
  }
  function fieldHit(f, p, r) { // world point p; returns true when a rock inside radius r was removed (count)
    lp.copy(p).applyMatrix4(f.inv); var n = 0;
    if (f === belt) { if (Math.abs(Math.hypot(lp.x, lp.z) - BELT_R) > 520 || Math.abs(lp.y) > 160) return 0; } else { var lim = bodies.saturn.R * 2.4; if (Math.abs(lp.x) > lim || Math.abs(lp.z) > lim || Math.abs(lp.y) > 400) return 0; }
    for (var i = 0; i < f.N; i++) {
      if (!f.alive[i]) continue; var dx = f.lx[i] - lp.x; if (dx > r + f.lr[i] || dx < -r - f.lr[i]) continue; var dy = f.ly[i] - lp.y, dz = f.lz[i] - lp.z, rr = f.lr[i] + r;
      if (dx * dx + dy * dy + dz * dz < rr * rr) { killRock(f, i, true); n++; if (r < 10) break; }
    }
    return n;
  }
  function hitPlanetUnused(B, dmg, p) {
    if (B.state !== 'alive') return; if (G) { G.hitPl = B; G.hitPlT = G.t; } B.hp -= dmg; B.u.flash.value = Math.min(1, B.u.flash.value + 0.5); G.dmgDealt += dmg;
    if (B.hp <= 0) { B.hp = 0; B.state = 'dying'; B.dyingT = 1.5; events.push({ type: 'dying', id: B.id }); pfxDying(B); }
  }
  function boom(p, radius, dmg) {
    fireball(p, radius * 1.3, 0.7); ring(p, radius * 2.2, 0xffc680, 0.7); burst(p, 40, radius * 0.8, 2.0, 1, 0.7, 0.3, 0.9); G.bombsUsed++;
    shake = Math.max(shake, Math.max(0.3, 1.6 - G.pos.distanceTo(p) / 700));
    cores.forEach(function (c) { if (c.alive && c.pos.distanceTo(p) < radius + c.cs) killCore(c); });
    if (boss.alive && boss.pos.distanceTo(p) < radius + SUN_R) bossHit(dmg * 0.8);
    drones.forEach(function (d) { if (d.alive && d.pos.distanceTo(p) < radius + d.r) hurtEnemy(d, dmg); });
    ORDER.forEach(function (id) { var B = bodies[id]; if (B.state === 'alive' && B.pos.distanceTo(p) < radius + B.R) hitPlanetUnused(B, dmg * 1.5, p); });
    fieldHit(belt, p, radius * 0.9); fieldHit(rings, p, radius * 0.9);
    events.push({ type: 'boom' });
  }
  function destroyPlanet(B) {
    B.state = 'dead'; G.destroyed++; award('planetScore', PD[B.id].score); bump(4); G.hull = Math.min(HULL_MAX, G.hull + 25); G.bombs++;
    var col = new THREE.Color(PL[B.id].col);
    planetFx(B);
    spawnDebris(B, Math.round(Math.min(520, Math.max(160, B.R * 1.5))));
    var tcc = new THREE.Color(PFX_TH[B.id].a); burst(B.pos, 60, B.R * 1.2, Math.max(3, B.R * 0.04), tcc.r, tcc.g, tcc.b, 1.4);
    var dist = G.pos.distanceTo(B.pos); shake = Math.max(shake, Math.max(0.6, 3.2 - dist / (B.R * 2.2))); flashVig = Math.max(flashVig, Math.max(0.4, 1.1 - dist / (B.R * 8))); slowT = 1.1;
    events.push({ type: 'pdie', id: B.id });
    if (G.destroyed >= ORDER.length) { G.bossT = 3.4; events.push({ type: 'bossWarn' }); } else G.pickT = 2.4;
  }
  function step(dt, inp) {
    if (!G) return; G.t += dt;
    prepField(belt); prepField(rings);
    var U = G.up;
    // steering: rate input (keys / touch / offset mouse) + direct mouse delta (pointer lock)
    var ty = -inp.yaw * YAW_RATE, tp = inp.pitch * PITCH_RATE, sm = 1 - Math.exp(-dt * 14);
    G.yawV += (ty - G.yawV) * sm; G.pitchV += (tp - G.pitchV) * sm;
    var dyaw = inp.dyaw || 0, dpitch = inp.dpitch || 0;
    G.yaw += G.yawV * dt + dyaw; G.pitch = Math.max(-1.45, Math.min(1.45, G.pitch + G.pitchV * dt + dpitch));
    var turn = G.yawV + dyaw / Math.max(dt, 0.004);
    G.bank = 0;
    var np = nearestPlanet(); G.altInfo = np; var prox = Math.max(0, 1 - np.rel / 1.6); if (np.id === 'sun') prox = Math.max(0, 1 - np.rel / 0.8) * 0.5; G.prox += (prox - G.prox) * (1 - Math.exp(-dt * 4));
    var wantBoost = inp.boost && G.energy > 1.5, wantBrake = inp.thrust < 0 && !wantBoost;
    G.boosting = wantBoost; G.braking = wantBrake;
    forwardOf(G.yaw, G.pitch, fwd); tmpRt.crossVectors(fwd, UPV); if (tmpRt.lengthSq() < 1e-6) tmpRt.set(1, 0, 0); tmpRt.normalize(); tmpUp.crossVectors(tmpRt, fwd).normalize();
    tmpAcc.set(0, 0, 0);
    if (wantBoost) tmpAcc.addScaledVector(fwd, ACC_BOOST); else if (inp.thrust > 0) tmpAcc.addScaledVector(fwd, ACC_MAIN);
    if (inp.strafe) tmpAcc.addScaledVector(tmpRt, inp.strafe * ACC_SIDE); if (inp.lift) tmpAcc.addScaledVector(tmpUp, inp.lift * ACC_SIDE);
    refVel.set(0, 0, 0); if (np.id !== 'sun' && np.rel < 8) refVel.copy(bodies[np.id].vel);
    if (wantBrake) { tmpRel.copy(G.vel).sub(refVel); var rl = tmpRel.length(); if (rl > 0.01) { var dv = Math.min(rl, ACC_BRAKE * dt); G.vel.addScaledVector(tmpRel, -dv / rl); } }
    gravityAt(G.pos, tmpG); G.gmag = tmpG.length(); tmpAcc.add(tmpG);
    G.vel.addScaledVector(tmpAcc, dt);
    var vm = G.vel.length(), vmax = wantBoost ? VMAX_BOOST : VMAX; if (vm > vmax) G.vel.multiplyScalar(Math.max(vmax / vm, 1 - 2.5 * dt));
    G.pos.addScaledVector(G.vel, dt); G.speed = G.vel.length(); G.relV.copy(G.vel).sub(refVel); G.relSpeed = G.relV.length();
    if (wantBoost) G.energy = Math.max(0, G.energy - 26 * (1 - 0.3 * U.drive) * dt); else G.energy = Math.min(ENERGY_MAX, G.energy + (5 + 14 * G.prox) * (1 + 0.4 * U.drive) * dt);
    G.proxScore += 40 * G.prox * G.prox * (G.speed / SPEED_BASE) * dt;
    if (np.alt < G.bestAlt && np.id !== 'sun') G.bestAlt = np.alt;
    if (G.comboT > 0) { G.comboT -= dt; if (G.comboT <= 0) G.combo = 0; }
    updateOrbits(dt);
    // planets
    ORDER.forEach(function (id) {
      var P = bodies[id]; if (P.state === 'dead') return; var d = G.pos.distanceTo(P.pos);
      if (d < P.R * 1.03 + 2) { tmpA.copy(G.pos).sub(P.pos).normalize(); G.pos.copy(P.pos).addScaledVector(tmpA, P.R * 1.03 + 2); var vn = G.vel.dot(tmpA) - P.vel.dot(tmpA); if (vn < 0) G.vel.addScaledVector(tmpA, -vn * 1.35); if (damage(Math.min(45, 8 + Math.max(0, -vn) * 0.08), 'planet')) burst(G.pos, 24, 30, 1.2, 1, 0.7, 0.35, 0.8); }
      else if (PL[id].atm && id !== 'earth' && d < P.R * 1.075) {
        var k = 1 - (d - P.R * 1.03) / (P.R * 0.045); G.hull -= 7 * k * dt; shake = Math.max(shake, 0.45); redVig = Math.max(redVig, 0.5);
        emit(G.pos.x + (Math.random() - 0.5) * 3, G.pos.y + (Math.random() - 0.5) * 3, G.pos.z + (Math.random() - 0.5) * 3, -fwd.x * 40, 6, -fwd.z * 40, 0.4, 0.7, 1, 0.55, 0.2);
        if (G.t - G.heatWarn > 3) { G.heatWarn = G.t; events.push({ type: 'heat', id: id }); }
      }
      if (P.state === 'dying') {
        P.dyingT -= dt; P.u.dmg.value = 1; P.u.flash.value = 0.5 + 0.5 * Math.sin(G.t * 40);
        for (var q = 0; q < 2; q++) { var a = Math.random() * TAU, e = Math.random() * 2 - 1, kk = Math.sqrt(1 - e * e); emit(P.pos.x + Math.cos(a) * kk * P.R, P.pos.y + e * P.R, P.pos.z + Math.sin(a) * kk * P.R, 0, 0, 0, 0.5, Math.max(2, P.R * 0.05), 1, 0.55, 0.2); }
        if (P.dyingT <= 0) destroyPlanet(P);
      } else { P.u.dmg.value += ((1 - P.hp / P.maxHp) - P.u.dmg.value) * (1 - Math.exp(-dt * 6)); P.u.flash.value = Math.max(0, P.u.flash.value - dt * 5); }
    });
    ORDER.forEach(function (id) { var P = bodies[id]; if (P.state === 'alive' && !capSeen[id] && G.pos.distanceTo(P.pos) < P.R * 4.2) { capSeen[id] = 1; events.push({ type: 'cap', key: id }); } });
    if (!capSeen.belt && Math.abs(Math.hypot(G.pos.x, G.pos.z) - BELT_R) < 400 && Math.abs(G.pos.y) < 200) { capSeen.belt = 1; events.push({ type: 'cap', key: 'belt' }); }
    if (G.pos.length() < SUN_R + 20) { G.hull = 0; events.push({ type: 'sunburn' }); }
    var sdist = G.pos.length(), sin_ = -G.vel.dot(G.pos) / Math.max(sdist, 1);
    if (sdist - SUN_R < 1300 && sin_ > 60 && G.t - (G.sunWarnT || -9) > 2.5) { G.sunWarnT = G.t; events.push({ type: 'sunWarn' }); }
    collideField(belt, 2.6, 'rock'); collideField(rings, 2.6, 'ring');
    // orbs
    orbs.forEach(function (o) {
      if (o.got) return; var d = G.pos.distanceTo(o.mesh.position);
      if (d < 70) { o.mesh.position.lerp(G.pos, Math.min(1, dt * 4)); d = G.pos.distanceTo(o.mesh.position); }
      if (d < 12) { o.got = true; o.mesh.visible = false; G.orbs++; award('orbScore', 100); bump(1); G.energy = Math.min(ENERGY_MAX, G.energy + 35); if (G.orbs % 3 === 0) G.bombs++; events.push({ type: 'orb', p: o.mesh.position.clone() }); }
    });
    updateCores(dt); updateZaps(dt); updateBoss(dt);
    if (G.pickT > 0) { G.pickT -= dt; if (G.pickT <= 0 && !G.result) events.push({ type: 'pick' }); }
    if (G.bossT > 0) { G.bossT -= dt; if (G.bossT <= 0) startBoss(); }
    // weapons
    G.cdFire -= dt; G.cdBomb -= dt;
    if (G.overheat) { G.heat = Math.max(0, G.heat - 0.42 * (1 + 0.3 * U.cool) * dt); if (G.heat < 0.35) G.overheat = false; } else G.heat = Math.max(0, G.heat - 0.34 * (1 + 0.3 * U.cool) * dt);
    G.lock = null;
    if (!G.result && (G.shots >= 0)) { var lk = findTarget(0.075 + 0.04 * U.homing + (touchMode ? 0.05 : 0), 2600); if (lk) G.lock = lk; }
    shipE.set(G.pitch, G.yaw, G.bank * 0.45, 'YXZ');
    G.spool = clampN((G.spool || 0) + ((inp.fire && !G.overheat && !G.result) ? dt / 0.8 : -dt * 2.2), 0, 1);
    if (inp.fire && !G.overheat && G.cdFire <= 0 && !G.result) {
      G.cdFire = (0.135 - 0.04 * (G.spool || 0)) * (1 - 0.22 * U.rapid); shake = Math.max(shake, 0.07 + 0.09 * (G.spool || 0)); kick += 0.003 * (G.spool || 0); G.heat += 0.024 * (1 - 0.2 * U.cool) * (1 + 0.3 * U.twin + 0.12 * U.spread); G.shots++; kick += 0.0042; if (G.heat >= 1) { G.heat = 1; G.overheat = true; events.push({ type: 'overheat' }); }
      // convergence point: crosshair line, snapped to a locked target
      var sd = G.lock; tmpB.copy(G.pos).addScaledVector(fwd, 1100);
      var nSides = U.twin ? 2 : 1, offN = U.spread === 0 ? 1 : (U.spread === 1 ? 3 : 5), shotV = 3000, bcol = U.homing ? [0.75, 0.55, 1.0] : (U.pierce ? [0.5, 1.0, 0.7] : [0.3, 0.85, 1.0]);
      for (var si = 0; si < nSides; si++) {
        var sgn = U.twin ? (si ? 1 : -1) : (G.side = -G.side);
        tmpA.set(sgn * 1.9, -1.0, -2.4).applyEuler(shipE).add(G.pos); tmpD.copy(G.pos).addScaledVector(fwd, 1100);
        if (sd) { tmpD.copy(sd.p).addScaledVector(sd.v, G.pos.distanceTo(sd.p) / 3000 * 0.8); }
        tmpC.copy(tmpD).sub(tmpA).normalize(); tmpE.crossVectors(tmpC, UPV).normalize();
        for (var oi = 0; oi < offN; oi++) {
          var off = (oi - (offN - 1) / 2) * 0.05; tmpB.copy(tmpC).addScaledVector(tmpE, off).normalize().multiplyScalar(shotV);
          tmpB.x += (Math.random() - 0.5) * 4; tmpB.y += (Math.random() - 0.5) * 4; tmpB.z += (Math.random() - 0.5) * 4;
          spawnBullet(true, tmpA, tmpB, 4.6, { pierce: U.pierce ? 2 : 0, home: U.homing, col: bcol });
        }
        emit(tmpA.x, tmpA.y, tmpA.z, fwd.x * 40, fwd.y * 40, fwd.z * 40, 0.08, 1.3, 0.6, 0.95, 1); emit(tmpA.x + fwd.x * 1.5, tmpA.y + fwd.y * 1.5, tmpA.z + fwd.z * 1.5, G.vel.x, G.vel.y, G.vel.z, 0.05, 3.6, 0.85, 1, 1);
        emit(tmpA.x, tmpA.y, tmpA.z, G.vel.x + (Math.random() - 0.5) * 30 + sgn * 22, G.vel.y + 14 + Math.random() * 10, G.vel.z + (Math.random() - 0.5) * 30, 0.35, 0.5, 1, 0.8, 0.4);
      }
      events.push({ type: 'shot' });
    }
    if (inp.bomb && G.cdBomb <= 0 && G.bombs > 0 && !G.result) {
      G.cdBomb = 1.2; G.bombs--; var bm = G.bomb; bm.alive = true; bm.life = 3.2; bm.pos.copy(G.pos).addScaledVector(fwd, 8); bm.vel.copy(fwd).multiplyScalar(480 + G.speed * 0.7); bm.mesh.visible = true; events.push({ type: 'bombLaunch' }); kick += 0.02;
    }
    // bomb flight
    var bm2 = G.bomb;
    if (bm2.alive) {
      bm2.life -= dt; var steps = Math.max(1, Math.ceil(bm2.vel.length() * dt / 30)), sdt = dt / steps, exploded = false;
      for (var s = 0; s < steps && !exploded; s++) {
        bm2.pos.addScaledVector(bm2.vel, sdt);
        ORDER.forEach(function (id) { var B = bodies[id]; if (!exploded && B.state === 'alive' && bm2.pos.distanceTo(B.pos) < B.R * PHIT) exploded = true; });
        if (!exploded) drones.forEach(function (d) { if (!exploded && d.alive && d.pos.distanceTo(bm2.pos) < d.r + 2) exploded = true; });
        if (!exploded) cores.forEach(function (c) { if (!exploded && c.alive && c.pos.distanceTo(bm2.pos) < c.cs * 2) exploded = true; });
        if (!exploded && boss.alive && boss.pos.distanceTo(bm2.pos) < SUN_R) exploded = true;
        if (!exploded && (fieldHit(belt, bm2.pos, 3) || fieldHit(rings, bm2.pos, 3))) exploded = true;
      }
      bm2.mesh.position.copy(bm2.pos); emit(bm2.pos.x, bm2.pos.y, bm2.pos.z, 0, 0, 0, 0.35, 2.0, 1, 0.7, 0.3);
      if (exploded || bm2.life <= 0) { bm2.alive = false; bm2.mesh.visible = false; boom(bm2.pos, 150 * (1 + 0.3 * U.bomb), 420 * (1 + 0.4 * U.bomb)); }
    }
    // bullets
    for (var i = 0; i < NBUL; i++) {
      if (!bAlive[i]) continue; bLife[i] -= dt; if (bLife[i] <= 0) { bAlive[i] = 0; continue; }
      var isP = i < NB, vx = bVel[i * 3], vy = bVel[i * 3 + 1], vz = bVel[i * 3 + 2], sp = Math.sqrt(vx * vx + vy * vy + vz * vz), n = Math.max(1, Math.ceil(sp * dt / 22)), h = dt / n, dead = false;
      if (isP && bHome[i]) { // gentle steering toward the best target in a cone ahead of the bolt
        var hb = null, ha = 0.42, hx = bPos[i * 3], hy = bPos[i * 3 + 1], hz = bPos[i * 3 + 2];
        for (var hd = 0; hd < drones.length; hd++) { var dd0 = drones[hd]; if (!dd0.alive) continue; tmpC.set(dd0.pos.x - hx, dd0.pos.y - hy, dd0.pos.z - hz); var hl = tmpC.length(); if (hl > 1800 || hl < 12) continue; var an = Math.acos(clampN(tmpC.dot(tmpD.set(vx / sp, vy / sp, vz / sp)) / hl, -1, 1)); if (an < ha) { ha = an; hb = dd0.pos; } }
        for (var hn = 0; hn < cores.length; hn++) { var nn0 = cores[hn]; if (!nn0.alive || !nn0.facing) continue; tmpC.set(nn0.pos.x - hx, nn0.pos.y - hy, nn0.pos.z - hz); var hl2 = tmpC.length(); if (hl2 > 1800 || hl2 < 12) continue; var an2 = Math.acos(clampN(tmpC.dot(tmpD.set(vx / sp, vy / sp, vz / sp)) / hl2, -1, 1)); if (an2 < ha) { ha = an2; hb = nn0.pos; } }
        if (boss.alive && boss.stage === 2) { tmpC.set(boss.pos.x - hx, boss.pos.y - hy, boss.pos.z - hz); var hl3 = tmpC.length(); var an3 = Math.acos(clampN(tmpC.dot(tmpD.set(vx / sp, vy / sp, vz / sp)) / hl3, -1, 1)); if (an3 < ha) { ha = an3; hb = boss.pos; } }
        if (hb) { tmpC.set(hb.x - hx, hb.y - hy, hb.z - hz).normalize(); tmpD.set(vx / sp, vy / sp, vz / sp).lerp(tmpC, Math.min(1, (2.2 + 1.6 * bHome[i]) * dt)).normalize(); vx = tmpD.x * sp; vy = tmpD.y * sp; vz = tmpD.z * sp; bVel[i * 3] = vx; bVel[i * 3 + 1] = vy; bVel[i * 3 + 2] = vz; }
      }
      for (var st = 0; st < n && !dead; st++) {
        bPos[i * 3] += vx * h; bPos[i * 3 + 1] += vy * h; bPos[i * 3 + 2] += vz * h; tmpA.set(bPos[i * 3], bPos[i * 3 + 1], bPos[i * 3 + 2]);
        if (isP) {
          for (var ni = 0; ni < cores.length && !dead; ni++) { var cc = cores[ni]; if (cc.alive && cc.pos.distanceTo(tmpA) < cc.cs * 2.1) { cc.hp -= 12; cc.flash = 1; G.shotsHit++; crossHit = 0.12; if (bPierce[i] > 0) bPierce[i]--; else dead = true; burst(tmpA, 4, 26, 1.2, 1, 0.6, 0.3, 0.3); events.push({ type: 'tick' }); if (cc.hp <= 0) killCore(cc); } }
          for (var oi2 = 0; oi2 < ORDER.length && !dead; oi2++) { var B = bodies[ORDER[oi2]]; if (B.state === 'dead') continue; if (tmpA.distanceTo(B.pos) < B.R * PHIT) { dead = true; if (B.state === 'alive') { hitPlanetUnused(B, 11 * (1 + 0.1 * (U.rapid || 0)), tmpA); G.shotsHit++; crossHit = 0.12; award('proxScore', 1); } burst(tmpA, 3, 26, Math.max(1.5, B.R * 0.01), 1, 0.6, 0.35, 0.3); events.push({ type: 'phit' }); } }
          for (var di = 0; di < drones.length && !dead; di++) { var d = drones[di]; if (d.alive && d.pos.distanceTo(tmpA) < d.r) { G.shotsHit++; crossHit = 0.12; if (bPierce[i] > 0) bPierce[i]--; else dead = true; burst(tmpA, 4, 20, 0.8, 1, 0.6, 0.3, 0.3); events.push({ type: 'tick' }); hurtEnemy(d, 11); } }
          if (!dead && boss.alive && boss.pos.distanceTo(tmpA) < SUN_R) { dead = true; if (bossHit(11)) { burst(tmpA, 4, 40, 2, 1, 0.6, 0.25, 0.4); events.push({ type: 'tick' }); } else burst(tmpA, 3, 30, 2, 0.6, 0.8, 1, 0.3); }
          if (!dead && (fieldHit(belt, tmpA, 2.5) || fieldHit(rings, tmpA, 2.5))) { if (bPierce[i] > 0) bPierce[i]--; else dead = true; burst(tmpA, 4, 16, 0.8, 0.8, 0.72, 0.6, 0.3); G.shotsHit++; crossHit = 0.1; }
        } else if (tmpA.distanceTo(G.pos) < 6.5 && !G.result) { dead = true; if (damage(bKind[i] === 2 ? 16 : (bKind[i] === 1 ? 7 : 5), 'bullet')) { G.invuln = Math.max(G.invuln, 0.12); burst(G.pos, 6, 14, 0.8, 1, 0.5, 0.3, 0.4); } }
        else { for (var oj = 0; oj < ORDER.length; oj++) { var B2 = bodies[ORDER[oj]]; if (B2.state !== 'dead' && tmpA.distanceTo(B2.pos) < B2.R) { dead = true; break; } } }
      }
      if (dead) bAlive[i] = 0;
    }
    updateDrones(dt); updateDebris(dt);
    if (G.invuln > 0) G.invuln -= dt;
    if (G.hull <= 0 && !G.result) { G.hull = 0; G.result = 'lose'; G.endT = 1.8; events.push({ type: 'lose' }); }
    G.tgt = targetPlanet();
  }

  /* ---------- flow ---------- */
  function setMode(m) {
    mode = m; document.body.classList.remove('menu', 'ready', 'play', 'pause', 'over', 'pick'); document.body.classList.add(m === 'ready' ? 'play' : m); document.body.classList.toggle('ready', m === 'ready');
    $('ovMenu').hidden = m !== 'menu'; $('ovPause').hidden = m !== 'pause'; $('ovEnd').hidden = m !== 'over'; $('ovPick').hidden = m !== 'pick';
  }
  var bombObj = { alive: false, life: 0, pos: new V3(), vel: new V3(), mesh: null };
  (function () { var m = new THREE.Mesh(new THREE.SphereGeometry(3.5, 14, 10), new THREE.MeshBasicMaterial({ color: 0xffe0a0 })); m.add(glowSprite(46, fbTex)); m.visible = false; scene.add(m); bombObj.mesh = m; })();
  function newGame() {
    resetOrbits(); var e = bodies.earth;
    var sOff = new V3(-40, 36, -560); ORDER.forEach(function (id) { if (id === 'earth') return; var Pn = bodies[id], dd = e.pos.distanceTo(Pn.pos); if (dd < Pn.R * 4 + 1500) { var aw = e.pos.clone().sub(Pn.pos).setY(0).normalize().multiplyScalar(560); sOff.set(aw.x, 36, aw.z); } });
    var start = e.pos.clone().add(sOff), look = e.pos.clone().sub(start);
    G = {
      t: 0, readyT: 0, pos: start, yaw: Math.atan2(-look.x, -look.z), pitch: Math.atan2(look.y, Math.hypot(look.x, look.z)) * 0.5, yawV: 0, pitchV: 0, bank: 0, speed: 0,
      hull: HULL_MAX, energy: ENERGY_MAX, heat: 0, overheat: false, bombs: 3, cdFire: 0, cdBomb: 0, side: 1, bomb: bombObj,
      destroyed: 0, kills: 0, rocks: 0, orbs: 0, hits: 0, shots: 0, shotsHit: 0, dmgDealt: 0, bombsUsed: 0,
      prox: 0, proxScore: 0, planetScore: 0, killScore: 0, rockScore: 0, orbScore: 0, invuln: 0, boosting: false, braking: false,
      camYaw: 0, camPitch: 0, endT: 0, result: null, heatWarn: -9, altInfo: null, bestAlt: 1e9, tgt: e, hitLog: { rock: 0, ring: 0, planet: 0, heat: 0, bullet: 0, drone: 0, debris: 0 },
      combo: 0, comboT: 0, maxCombo: 0, up: newUp(), picked: 0, offer: null, zapT: 2, pickT: 0, bossT: 0, bossScore: 0, bossKilled: false, lock: null, warm: 0, coresKilled: 0, sv: 0, lv: 0
    };
    G.camYaw = G.yaw; G.camPitch = G.pitch; capSeen = {}; shake = 0; flashVig = 0; redVig = 0; slowT = 0;
    belt.alive.fill(1); rings.alive.fill(1); restoreField(belt); restoreField(rings);
    orbs.forEach(function (o) { o.got = false; o.mesh.visible = true; });
    ORDER.forEach(function (id) { var B = bodies[id]; B.hp = B.maxHp; B.state = 'alive'; B.u.dmg.value = 0; B.u.flash.value = 0; B.group.visible = true; B.group.scale.setScalar(1); if (B.ring) B.ring.visible = true; });
    clearPfx(); bAlive.fill(0); bombObj.alive = false; bombObj.mesh.visible = false; dLife.fill(0); dActive = 0; for (var i = 0; i < ND; i++) debMesh.setMatrixAt(i, ZERO); debMesh.instanceMatrix.needsUpdate = true;
    resetCores(); resetDrones(); G.vel = new V3(); orbitVel('earth', G.vel); G.relV = new V3(); G.relSpeed = 0; G.gmag = 0; G.speed = G.vel.length(); shipG.visible = true; kick = 0;
    boss.alive = false; boss.stage = 0; boss.dying = 0; boss.g.visible = false; sunGlow.scale.setScalar(sunGlow0); boss.core.material.emissiveIntensity = 1.3; for (var bq = 0; bq < NBEAM; bq++) clearBeam(bq); zaps.forEach(function (z) { z.on = false; });
  }
  function restoreField(f) {
    for (var i = 0; i < f.N; i++) { dummy.position.set(f.lx[i], f.ly[i], f.lz[i]); dummy.rotation.set(i * 1.7, i * 2.3, i * 0.9); dummy.scale.setScalar(f.lr[i]); dummy.updateMatrix(); f.mesh.setMatrixAt(i, dummy.matrix); }
    f.mesh.instanceMatrix.needsUpdate = true;
  }

  /* ---------- input ---------- */
  var accDx = 0, accDy = 0, usePL = false;
  var uiS = 1, touchScope = false, uiT = 1;
  function isScoped() { return !!(G && mode === 'play' && (touchMode ? touchScope : mouseR) && !G.result); }
  function updateUiScale() {
    var w = window.innerWidth, h = window.innerHeight, s = Math.max(0.7, Math.min(1.2, Math.min(w / 1700, h / 900))), t = Math.max(0.8, Math.min(1.25, Math.min(w / 900, h / 520)));
    if (touchMode) s = (w < 700) ? Math.max(0.85, Math.min(1.05, w / 430)) : Math.max(s, 0.85);
    uiS = s; uiT = t; var st = document.documentElement.style; st.setProperty('--s', s.toFixed(3)); st.setProperty('--ts', t.toFixed(3));
    document.body.classList.toggle('narrow', w < 700); document.body.classList.toggle('short', h < 520);
  }

  /* fit each overlay panel (menu / pause / pick / end) to the actual viewport */
  var fitKey = '';
  function fitOverlays() {
    var w = window.innerWidth, h = window.innerHeight;
    ['ovMenu', 'ovPause', 'ovPick', 'ovEnd'].forEach(function (id) {
      var ov = document.getElementById(id); if (!ov || ov.hidden) return;
      var el = id === 'ovPick' ? ov.querySelector('.pickc') : ov.querySelector('.card'); if (!el) return;
      var key = id + w + 'x' + h + ':' + el.innerHTML.length + (touchMode ? 't' : ''); if (el._fk === key) return; el._fk = key;
      var stack = id === 'ovPick' && (w < 680 || h > w * 1.05), Wb = id === 'ovPick' ? (stack ? 400 : 920) : (w < 680 ? 340 : 580); el.classList.toggle('stack', stack);
      el.style.zoom = 1; el.style.width = Wb + 'px'; el.style.maxWidth = 'none';
      var H = el.offsetHeight || 1, z = Math.min(w * 0.94 / Wb, h * 0.9 / H); z = Math.max(0.45, Math.min(id === 'ovPick' ? 1.5 : 1.7, z));
      el.style.zoom = z.toFixed(3);
    });
  }
  window.addEventListener('resize', fitOverlays); window.addEventListener('orientationchange', function () { setTimeout(fitOverlays, 250); }); setInterval(fitOverlays, 200);
  window.addEventListener('resize', updateUiScale); window.addEventListener('orientationchange', function () { setTimeout(updateUiScale, 200); }); updateUiScale();
  (function () {
    var vm = document.querySelector('meta[name=viewport]'); if (vm && vm.content.indexOf('user-scalable') < 0) vm.content += ', maximum-scale=1, user-scalable=no';
    var kh = document.getElementById('keys'); if (kh) kh.textContent = kh.textContent.replace('Ctrl 下降', 'C 下降');
  })();
  function fsLock() {
    var fe = document.fullscreenElement || document.webkitFullscreenElement;
    try { if (navigator.keyboard) { if (fe && navigator.keyboard.lock) navigator.keyboard.lock(['Escape']).catch(function () {}); else if (!fe && navigator.keyboard.unlock) navigator.keyboard.unlock(); } } catch (_) {}
    try { if (fe && touchMode && screen.orientation && screen.orientation.lock) screen.orientation.lock('landscape').catch(function () {}); } catch (_) {}
    setTimeout(updateUiScale, 120);
  }
  document.addEventListener('fullscreenchange', fsLock); document.addEventListener('webkitfullscreenchange', fsLock);
  var scopeBtn = document.createElement('button'); scopeBtn.id = 'bScope'; scopeBtn.type = 'button'; scopeBtn.className = 'tbtn'; scopeBtn.textContent = '狙擊'; scopeBtn.setAttribute('aria-label', '狙擊鏡');
  scopeBtn.addEventListener('pointerdown', function (e) { e.preventDefault(); touchScope = !touchScope; scopeBtn.classList.toggle('on', touchScope); }); document.body.appendChild(scopeBtn);
  var scopeShown = false, scopeEl = document.createElement('div'); scopeEl.id = 'scope'; scopeEl.innerHTML = '<svg viewBox="0 0 200 200" preserveAspectRatio="xMidYMid meet"><circle cx="100" cy="100" r="98" fill="none" stroke="rgba(127,227,255,.55)" stroke-width="1.2"/><circle cx="100" cy="100" r="46" fill="none" stroke="rgba(127,227,255,.35)" stroke-width="0.8"/><path d="M100 6V88M100 112V194M6 100H88M112 100H194" stroke="rgba(127,227,255,.9)" stroke-width="1.1"/><path d="M100 58V70M100 130V142M58 100H70M130 100H142M80 100h4M116 100h4M100 80v4M100 116v4" stroke="rgba(127,227,255,.7)" stroke-width="1"/><circle cx="100" cy="100" r="1.6" fill="#ff5a4d"/></svg><b>放大 ×' + (FPFOV / SCOPE_FOV).toFixed(1) + '</b>'; document.body.appendChild(scopeEl);
  var hpListEl = document.createElement('div'); hpListEl.id = 'hpList'; hpListEl.setAttribute('aria-label', '太陽與行星血量');
  var hpRows = [];
  ['sun'].concat(ORDER).forEach(function (id) {
    var row = document.createElement('div'); row.className = 'hr'; row.innerHTML = '<span class="hn"></span><span class="hb"><i></i></span><span class="hv"></span>';
    row.firstChild.textContent = id === 'sun' ? '太陽' : PL[id].name; hpListEl.appendChild(row); hpRows.push({ id: id, row: row, bar: row.querySelector('i'), val: row.querySelector('.hv'), cf: -1, ct: '' });
  });
  document.body.appendChild(hpListEl);
  function updateHpList() {
    for (var i = 0; i < hpRows.length; i++) {
      var r = hpRows[i], f, t, st = '';
      if (r.id === 'sun') {
        if (boss.alive) { f = boss.hp / boss.max; t = boss.stage === 1 ? '守衛中' : String(Math.ceil(boss.hp)); st = boss.stage === 1 ? 'guard' : ''; }
        else if (G.bossKilled || boss.dying > 0) { f = 0; t = '已擊毀'; st = 'dead'; } else { f = 1; t = String(boss.max); st = 'wait'; }
      } else {
        var B = bodies[r.id];
        if (B.state === 'dead') { f = 0; t = '已擊毀'; st = 'dead'; } else { f = B.state === 'dying' ? 0 : B.hp / B.maxHp; t = B.state === 'dying' ? '崩解中' : Math.ceil(B.hp) + ''; st = (G.tgt === B) ? 'tgt' : ''; }
      }
      var w = (Math.max(0, Math.min(1, f)) * 100).toFixed(1);
      if (w !== r.cf) { r.cf = w; r.bar.style.width = w + '%'; }
      if (t + st !== r.ct) { r.ct = t + st; r.val.textContent = t; r.row.className = 'hr' + (st ? ' ' + st : ''); }
    }
  }
  (function () { var pl = document.querySelector('#ovPause .lede'); if (pl && !document.getElementById('pauseTip')) { var tip = document.createElement('p'); tip.id = 'pauseTip'; tip.className = 'lede'; tip.innerHTML = '\uD83D\uDCA1建議攻打順序：' + ['水星', '火星', '地球', '金星', '冥王星', '海王星', '天王星', '土星', '木星'].map(function (n, k) { return '<span style=\"white-space:nowrap\">' + n + (k < 8 ? ' -\u2060>' : '') + '</span>'; }).join(' '); pl.insertAdjacentElement('afterend', tip); } })();
  var keys = {}, mouseNDC = { x: 0, y: 0 }, mouseSeen = false, mouseL = false, mouseR = false, touchMode = false, touchStick = null, btnBoost = false, btnFire = false, btnThrust = false, btnBrake = false, bombReq = false;
  function setTouch(on) { if (touchMode === on) return; touchMode = on; document.body.classList.toggle('touch', on); updateUiScale(); }
  if (window.matchMedia && matchMedia('(pointer: coarse)').matches) setTouch(true);
  window.addEventListener('keydown', function (e) {
    if ((e.ctrlKey || e.metaKey) && (mode === 'play' || mode === 'pause')) e.preventDefault();
    if (e.repeat) { if (e.code === 'Space') e.preventDefault(); return; }
    keys[e.code] = true; if (e.code === 'Space' || e.code.indexOf('Arrow') === 0) e.preventDefault();
    if (mode === 'pick') { var pk = e.code === 'Digit1' || e.code === 'Numpad1' ? 0 : (e.code === 'Digit2' || e.code === 'Numpad2' ? 1 : (e.code === 'Digit3' || e.code === 'Numpad3' ? 2 : -1)); if (pk >= 0) selectUpgrade(pk); else if ((e.code === 'Enter' || e.code === 'NumpadEnter') && pickSel >= 0) chooseUpgrade(pickSel); return; }
    if (e.code === 'KeyE') bombReq = true;
    if (e.code === 'KeyF') toggleFS();
    if (e.code === 'KeyP' || e.code === 'Escape') { if (mode === 'play') pauseGame(); else if (mode === 'pause') resumeGame(); }
    if (e.code === 'Enter' && mode === 'menu') startGame();
  });
  window.addEventListener('keyup', function (e) { keys[e.code] = false; if (e.code === 'Space') e.preventDefault(); });
  document.addEventListener('click', function (e) { var t = e.target; if (t && t.tagName === 'BUTTON' && t.blur) setTimeout(function () { t.blur(); }, 0); }, true);
  window.addEventListener('blur', function () { keys = {}; mouseL = mouseR = false; if (mode === 'play') pauseGame(); });
  document.addEventListener('visibilitychange', function () { if (document.hidden && mode === 'play') pauseGame(); });
  var aimEl = $('aim'), stickEl = $('stick'), knobEl = $('knob'), STICK_R = 54;
  canvas.addEventListener('pointerdown', function (e) {
    if (e.pointerType === 'touch') {
      setTouch(true);
      if (mode === 'play' && !touchStick && e.clientX < window.innerWidth * 0.62) {
        touchStick = { id: e.pointerId, ox: e.clientX, oy: e.clientY, dx: 0, dy: 0 };
        stickEl.style.display = 'block'; stickEl.style.left = e.clientX + 'px'; stickEl.style.top = e.clientY + 'px'; knobEl.style.transform = 'translate(0,0)';
        try { canvas.setPointerCapture(e.pointerId); } catch (_) {}
      }
    } else {
      setTouch(false);
      if (mode === 'play' && !usePL) tryLock();
      if (e.button === 0) mouseL = true; else if (e.button === 2) { mouseR = true; }
      try { canvas.setPointerCapture(e.pointerId); } catch (_) {}
    }
  });
  canvas.addEventListener('pointermove', function (e) {
    if (e.pointerType === 'touch') {
      if (touchStick && e.pointerId === touchStick.id) {
        var dx = e.clientX - touchStick.ox, dy = e.clientY - touchStick.oy, m = Math.hypot(dx, dy), k = m > STICK_R ? STICK_R / m : 1;
        touchStick.dx = dx * k / STICK_R; touchStick.dy = dy * k / STICK_R; knobEl.style.transform = 'translate(' + (dx * k).toFixed(1) + 'px,' + (dy * k).toFixed(1) + 'px)';
      }
    } else if (usePL) { accDx += e.movementX || 0; accDy += e.movementY || 0; }
    else { mouseNDC.x = e.clientX / window.innerWidth * 2 - 1; mouseNDC.y = e.clientY / window.innerHeight * 2 - 1; mouseSeen = true; aimEl.style.transform = 'translate(' + e.clientX + 'px,' + e.clientY + 'px)'; }
  });
  function endPtr(e) {
    if (e.pointerType === 'touch') { if (touchStick && e.pointerId === touchStick.id) { touchStick = null; stickEl.style.display = 'none'; } }
    else { if (e.button === 0) mouseL = false; else if (e.button === 2) mouseR = false; }
  }
  document.addEventListener('mousedown', function (e) { if (touchMode || mode !== 'play') return; if (e.button === 0) mouseL = true; else if (e.button === 2) mouseR = true; }, true);
  window.addEventListener('mouseup', function (e) { if (e.button === 0) mouseL = false; else if (e.button === 2) mouseR = false; }, true);
  canvas.addEventListener('pointerup', endPtr); canvas.addEventListener('pointercancel', endPtr);
  canvas.addEventListener('contextmenu', function (e) { e.preventDefault(); });
  document.addEventListener('mouseleave', function () { mouseSeen = false; });
  function holdBtn(el, setter, tap) {
    el.addEventListener('pointerdown', function (e) { if (e.pointerType === 'touch') setTouch(true); setter(true); if (tap) bombReq = true; el.classList.add('on'); try { el.setPointerCapture(e.pointerId); } catch (_) {} e.preventDefault(); });
    ['pointerup', 'pointercancel', 'lostpointercapture'].forEach(function (n) { el.addEventListener(n, function () { setter(false); el.classList.remove('on'); }); });
    el.addEventListener('contextmenu', function (e) { e.preventDefault(); });
  }
  (function () { var b = $('bSens'); if (!b) return; function show() { b.textContent = '靈敏度 ' + SENS_NM[sensI]; } show(); b.addEventListener('click', function () { sensI = (sensI + 1) % 3; SENS = SENS_LV[sensI]; show(); try { localStorage.setItem('pbSens2', String(sensI)); } catch (_) {} }); })();
  holdBtn($('bThrust'), function (v) { btnThrust = v; }); holdBtn($('bBrake'), function (v) { btnBrake = v; });
  holdBtn($('bBoost'), function (v) { btnBoost = v; }); holdBtn($('bFire'), function (v) { btnFire = v; }); holdBtn($('bBomb'), function () {}, true);
  function tryLock() { if (touchMode || usePL || !canvas.requestPointerLock) return; try { var p = canvas.requestPointerLock(); if (p && p.catch) p.catch(function () {}); } catch (_) {} }
  document.addEventListener('pointerlockchange', function () { usePL = document.pointerLockElement === canvas; document.body.classList.toggle('pl', usePL); accDx = accDy = 0; if (!usePL && mode === 'play') pauseGame(); });
  document.addEventListener('pointerlockerror', function () { usePL = false; document.body.classList.remove('pl'); });
  function dz(v) { var a = Math.abs(v); if (a < 0.07) return 0; return Math.sign(v) * Math.pow((a - 0.07) / 0.93, 1.25); }
  function gatherInput() {
    var yaw = 0, pitch = 0, dyaw = 0, dpitch = 0;
    if (touchStick) { var tmk = isScoped() ? SCOPE_FOV / FPFOV : 1; yaw += touchStick.dx * tmk; pitch += -touchStick.dy * tmk; }
    if (usePL) { var msk = isScoped() ? SCOPE_FOV / FPFOV : 1; dyaw = clampN(-accDx * MSENS * msk, -0.45, 0.45); dpitch = clampN(-accDy * MSENS * msk * (invert ? -1 : 1), -0.45, 0.45); accDx = accDy = 0; }
    else if (mouseSeen && !touchMode) { yaw += dz(mouseNDC.x) * 0.6; pitch += -dz(mouseNDC.y) * 0.6; }
    yaw = Math.max(-1, Math.min(1, yaw)) * SENS; pitch = Math.max(-1, Math.min(1, pitch)) * SENS; if (invert) pitch = -pitch; dyaw *= SENS; dpitch *= SENS;
    var bomb = bombReq; bombReq = false;
    return { yaw: yaw, pitch: pitch, dyaw: dyaw, dpitch: dpitch, thrust: touchMode ? ((btnThrust ? 1 : 0) - (btnBrake ? 1 : 0)) : (((keys.KeyW || keys.ArrowUp) ? 1 : 0) - ((keys.KeyS || keys.ArrowDown) ? 1 : 0)), strafe: ((keys.KeyD || keys.ArrowRight) ? 1 : 0) - ((keys.KeyA || keys.ArrowLeft) ? 1 : 0), lift: (keys.Space ? 1 : 0) - ((keys.KeyC || keys.KeyQ) ? 1 : 0), boost: !!(keys.ShiftLeft || keys.ShiftRight || btnBoost), brake: false, fire: !!(mouseL || btnFire || keys.KeyJ), bomb: bomb };
  }

  function fmtT(t) { var m = Math.floor(t / 60), s = Math.floor(t % 60); return (m < 10 ? '0' : '') + m + ':' + (s < 10 ? '0' : '') + s; }
  function fmtN(n) { return String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ','); }
  function startGame() {
    audioInit(); newGame(); setMode('ready'); tryLock(); accDx = accDy = 0; G.readyT = 3.4; touchScope = false; scopeBtn.classList.remove('on'); newsEl.innerHTML = ''; keys = {}; mouseL = mouseR = false; touchStick = null; stickEl.style.display = 'none'; bombReq = false;
    news('任務：擊碎九顆行星。行星越大血量越多，而且一直在繞太陽運行。紅色血條的是敵艦，他們會攻擊你。', null, true); news('沒有自動前進：按 W 推進，S 煞車。引力會拉著你漂移，小心別被行星或太陽吸進去。', null, true);
  }
  function pauseGame() { if (mode !== 'play') return; setMode('pause'); try { if (document.exitPointerLock) document.exitPointerLock(); } catch (_) {} }
  function resumeGame() { if (mode !== 'pause') return; setMode('play'); touchScope = false; scopeBtn.classList.remove('on'); keys = {}; mouseL = mouseR = false; tryLock(); accDx = accDy = 0; }
  function totalScore() {
    var s = G.planetScore + G.killScore + G.rockScore + G.orbScore + G.proxScore + G.bossScore;
    if (G.result === 'win') s += 2000 + Math.round(G.hull) * 15 + Math.max(0, 300 - G.t) * 10;
    return s;
  }
  var RANKS = [[12000, '見習砲手', '你把太陽系打爛了，但連擊還沒能真正接起來。'], [24000, '星際轟炸員', '護盾一層層剝開，行星一顆顆崩解，連太陽守衛都對你另眼相看。'], [40000, '毀滅者', '貼著行星開火、串起連擊、閃過彈幕，天文學家已經不想再寫論文了。'], [1e9, '星系終結者', '快、準、狠，連擊倍率一路頂滿。太陽系現在只剩下太陽的殘骸。']];
  function endGame() {
    var win = G.result === 'win', sc = totalScore(), r = RANKS[0];
    for (var i = 0; i < RANKS.length; i++) { if (sc < RANKS[i][0]) { r = RANKS[i]; break; } }
    setMode('over'); var best = 0, key = 'planetBreakerBest';
    try { var old = parseFloat(localStorage.getItem(key)); if (old > 0) best = old; if (sc > best) { best = sc; localStorage.setItem(key, String(Math.round(best))); } } catch (_) { best = Math.max(best, sc); }
    $('endEye').textContent = win ? 'Solar System Cleared' : 'Mission Failed';
    $('endTitle').textContent = win ? r[1] : (G.altInfo && G.altInfo.id === 'sun' && G.pos.length() < SUN_R + 40 ? '太陽烤熟了你' : '戰鬥機解體');
    try { if (document.exitPointerLock) document.exitPointerLock(); } catch (_) {}
    $('endText').textContent = win ? r[2] : '擊碎了 ' + G.destroyed + ' 顆行星後，戰鬥機解體。太陽系還剩 ' + (ORDER.length - G.destroyed) + ' 顆行星正在慶祝。';
    $('endScore').textContent = fmtN(sc);
    var acc = G.shots ? Math.round(G.shotsHit / G.shots * 100) : 0;
    var rows = [['擊碎行星', G.destroyed + ' / ' + ORDER.length], ['用時', fmtT(G.t)], ['擊落敵艦', G.kills + ' 架'], ['造成傷害', fmtN(G.dmgDealt)], ['最高連擊', G.maxCombo], ['強化', G.picked + ' 項'], ['擊碎小行星', G.rocks + ' 顆'], ['命中率', acc + '%'], ['船體剩餘', Math.round(G.hull) + '%'], ['最佳紀錄', fmtN(best)]];
    var dl = $('endStats'); dl.innerHTML = '';
    rows.forEach(function (rw) { var a = document.createElement('div'); a.innerHTML = '<dt></dt><dd></dd>'; a.firstChild.textContent = rw[0]; a.lastChild.textContent = rw[1]; dl.appendChild(a); });
    if (engGain) engGain.gain.value = 0.0001; if (whooshGain) whooshGain.gain.value = 0.0001;
  }
  $('bStart').addEventListener('click', startGame); $('bAgain').addEventListener('click', startGame); $('bRestartP').addEventListener('click', startGame);
  $('bResume').addEventListener('click', resumeGame);
  $('bPause').addEventListener('click', function () { if (mode === 'play') pauseGame(); else if (mode === 'pause') resumeGame(); });
  $('bInv').addEventListener('click', function () { invert = !invert; $('bInv').setAttribute('aria-pressed', invert ? 'true' : 'false'); $('bInv').style.opacity = invert ? 1 : 0.7; try { localStorage.setItem('voyInv', invert ? '1' : '0'); } catch (_) {} });
  function fsFail() { var m = '此環境不允許網頁全螢幕。請按瀏覽器的全螢幕（F11），或使用頁面右上角的展開功能。'; ['fsNote', 'fsNoteP'].forEach(function (id) { var el = $(id); if (el) el.textContent = m; }); news(m, 'bad', true); }
  function toggleFS() {
    try {
      var fe = document.fullscreenElement || document.webkitFullscreenElement, r = document.documentElement, p;
      if (fe) p = (document.exitFullscreen || document.webkitExitFullscreen).call(document);
      else { var rf = r.requestFullscreen || r.webkitRequestFullscreen; if (!rf) throw 0; p = rf.call(r); }
      if (p && p.catch) p.catch(fsFail);
    } catch (e) { fsFail(); }
  }
  ['bFull', 'bFullM', 'bFullP'].forEach(function (id) { var b = $(id); if (b) b.addEventListener('click', toggleFS); });
  sfx.shot = function () { if (!AC) return; tone(2300 + Math.random() * 400, 0.07, 'sawtooth', 0.035, 520); tone(150, 0.08, 'sine', 0.14, 55); noiseHit(0.05, 0.09, 3200, 700); };
  sfx.tick = function () { tone(2300, 0.045, 'sine', 0.05, 1500); };
  sfx.shield = function () { tone(720 + Math.random() * 90, 0.12, 'sine', 0.06, 420); };
  sfx.shieldDown = function () { tone(900, 0.55, 'sawtooth', 0.09, 110); noiseHit(0.5, 0.22, 3200, 220); tone(300, 0.7, 'triangle', 0.14, 60); };
  sfx.zap = function () { noiseHit(0.35, 0.45, 4200, 300); tone(190, 0.3, 'sawtooth', 0.14, 50); };
  sfx.up = function () { [523, 784].forEach(function (f, i) { tone(f, 0.25, 'triangle', 0.09, null, i * 0.08); }); };
  sfx.pickok = function () { [660, 880, 1320].forEach(function (f, i) { tone(f, 0.22, 'triangle', 0.1, null, i * 0.07); }); };
  sfx.bossRoar = function () { tone(72, 2.2, 'sawtooth', 0.18, 30); tone(46, 2.6, 'sine', 0.3, 22); noiseHit(1.6, 0.28, 900, 60); };
  sfx.bomb = function () { tone(140, 0.5, 'sawtooth', 0.18, 320); noiseHit(0.4, 0.2, 400, 1800); };
  sfx.boom = sfx.boom;
  sfx.pop = function () { noiseHit(0.18, 0.25, 2200, 300); tone(260, 0.12, 'triangle', 0.14, 90); };
  sfx.bigboom = function () { tone(95, 1.8, 'sawtooth', 0.28, 22); noiseHit(1.6, 0.6, 2800, 70); tone(52, 2.2, 'sine', 0.5, 20); };
  sfx.explode = function () { tone(120, 0.7, 'sawtooth', 0.22, 30); noiseHit(0.7, 0.45, 2200, 120); };
  sfx.over = function () { tone(520, 0.1, 'square', 0.1, 300); };
  var shotSfxT = 0, tickT = 0, shT = 0, bbT = 0;

  function handleEvents() {
    var ev = events; events = [];
    ev.forEach(function (e) {
      if (e.type === 'shot') { var now = performance.now(); if (now - shotSfxT > 38) { shotSfxT = now; sfx.shot(); } }
      else if (e.type === 'phit') { /* quiet */ }
      else if (e.type === 'tick') { var tn = performance.now(); if (tn - tickT > 45) { tickT = tn; sfx.tick(); } }
      else if (e.type === 'enemyDown') { news('擊沉' + e.name + '！補充能量', 'good'); }
      else if (e.type === 'cannon') { news(e.name + ' 正在裝填火炮！快閃避！', 'warn'); }
      else if (e.type === 'reinforce') { news('敵機來襲！注意四周！', 'warn'); }
      else if (e.type === 'core') { sfx.pop(); news(PL[e.id].name + ' 核心被擊毀，還剩 ' + e.left + ' 個', 'good'); }
      else if (e.type === 'zapWarn') sfx.warn();
      else if (e.type === 'zap') sfx.zap();
      else if (e.type === 'pick') offerUpgrades();
      else if (e.type === 'comboBreak') news('連擊中斷', 'bad');
      else if (e.type === 'bossWarn') news('最後一顆行星消失了……太陽似乎有動靜。', 'bad', true);
      else if (e.type === 'bossStart') { sfx.bossRoar(); news('太陽的四位守衛現身！飛向太陽，先擊敗全部守衛。', 'bad', true); }
      else if (e.type === 'sunWarn') { sfx.warn(); news('危險！太陽引力正在把你拉進去，立刻反向推進！', 'bad'); redVig = Math.max(redVig, 0.5); }
      else if (e.type === 'guardDown') { sfx.bigboom(); news('擊破' + e.name + '！' + (e.left ? '還剩 ' + e.left + ' 位守衛' : '守衛全滅'), 'good', true); }
      else if (e.type === 'sunAwake') { sfx.bossRoar(); news('太陽甦醒了！躲開烈焰，擊倒太陽！', 'bad', true); }
      else if (e.type === 'sunShielded') { news('太陽被守衛庇護著，先擊敗守衛！', 'warn'); }
      else if (e.type === 'lancerCharge') { sfx.warn(); news('光矛蓄力中，離開瞄準線！', 'bad'); }
      else if (e.type === 'reaperCharge') { sfx.warn(); }
      else if (e.type === 'novaCharge') { sfx.warn(); news('太陽閃焰蓄力！準備找縫隙閃避！', 'bad', true); }
      else if (e.type === 'novaBlast') { sfx.bigboom(); }
      else if (e.type === 'sunRain') { sfx.zap(); }
      else if (e.type === 'bossPhase') { sfx.bigboom(); news(e.n === 2 ? '太陽第二階段：日冕環、烈焰噴流與增援！' : '太陽第三階段：狂暴！小心太陽閃焰！', 'bad', true); }
      else if (e.type === 'bossCharge') { sfx.warn(); news('光炮蓄力中，離開紅線！', 'bad', true); }
      else if (e.type === 'bossBeam') sfx.zap();
      else if (e.type === 'bossBoom') { var bn = performance.now(); if (bn - bbT > 120) { bbT = bn; sfx.pop(); } }
      else if (e.type === 'bossDie') { sfx.bigboom(); news('太陽守衛被擊破！', 'good', true); }
      else if (e.type === 'bombLaunch') sfx.bomb();
      else if (e.type === 'boom') sfx.explode();
      else if (e.type === 'drone') sfx.pop();
      else if (e.type === 'dying') { sfx.warn(); news(PL[e.id].name + ' 即將崩解！', 'good', true); }
      else if (e.type === 'pdie') { sfx.bigboom(); news(DESTROY_NEWS[e.id] + '（+' + PD[e.id].score + ' × 連擊，船體 +25，炸彈 +1）', 'good', true); }
      else if (e.type === 'orb') { sfx.orb(); burst(e.p, 10, 14, 1.0, 0.5, 0.9, 1, 0.6); }
      else if (e.type === 'overheat') { sfx.over(); news('機炮過熱，冷卻中…', 'bad'); }
      else if (e.type === 'hit') {
        if (e.kind !== 'heat') { sfx.hit(Math.min(1, e.amount / 20)); if (e.kind !== 'bullet') { var lbl = { rock: '撞上小行星', ring: '被環冰擊中', planet: '擦撞行星表面', drone: '被無人機撞擊', debris: '被行星碎片擊中', lightning: '被木星閃電擊中', boss: '撞上太陽守衛', beam: '被光炮擊中' }[e.kind] || '受損'; news(lbl + ' −' + Math.round(e.amount) + '% 船體', 'bad'); } }
      } else if (e.type === 'heat') { sfx.warn(); news('大氣層過熱！快拉高離開表面。', 'bad', true); }
      else if (e.type === 'cap') { caption(e.key); }
      else if (e.type === 'sunburn') { news('你太靠近太陽了。', 'bad', true); }
      else if (e.type === 'win') { sfx.win(); news('行星與太陽守衛全數擊碎——任務完成！', 'good', true); }
      else if (e.type === 'lose') { sfx.boom(); shake = 3; redVig = 1; burst(G.pos, 70, 60, 2.4, 1, 0.7, 0.3, 1.4); fireball(G.pos, 70, 1); shipG.visible = false; }
    });
  }

  /* ---------- camera / frame ---------- */
  var stage = $('stage'), W = 1, Hh = 1;
  function resize() {
    W = Math.max(1, stage.clientWidth); Hh = Math.max(1, stage.clientHeight); renderer.setSize(W, Hh, false); camera.aspect = W / Hh; camera.updateProjectionMatrix();
    var m = $('mini'), s = m.clientWidth || 112; m.width = Math.round(s * DPR); m.height = Math.round(s * DPR); var mc = $('mk'); mc.width = Math.round(W * DPR); mc.height = Math.round(Hh * DPR);
  }
  if (window.ResizeObserver) new ResizeObserver(resize).observe(stage); else window.addEventListener('resize', resize);
  var menuAng = 0, camBack = new V3(), camLook = new V3(), camWant = new V3();
  function updateCamera(rdt) {
    var fovT = FOV0;
    if (mode === 'menu') {
      menuAng += rdt * 0.12; var C = bodies.earth.pos.clone().add(new V3(-40, 36, -560)); tmpA.set(Math.cos(menuAng) * 24, 6 + Math.sin(menuAng * 0.7) * 3, Math.sin(menuAng) * 24); camWant.copy(C).add(tmpA); camLook.copy(C);
      camera.position.lerp(camWant, 1 - Math.exp(-rdt * 3)); camera.lookAt(camLook); shipG.position.copy(C); shipG.rotation.set(0.05, 0, 0, 'YXZ'); shipG.visible = true;
    } else if (G) {
      /* first-person cockpit camera */
      shipE.set(G.pitch, G.yaw, G.bank * 0.45, 'YXZ'); kick *= Math.exp(-rdt * 10);
      tmpA.set(0, 0.8, -0.9).applyEuler(shipE); camera.position.copy(G.pos).add(tmpA);
      var sp = Math.max(0, (G.speed - SPEED_BASE) / (SPEED_BOOST - SPEED_BASE)), scopedNow = isScoped(), sk = shake > 0.01 ? shake * (scopedNow ? 0.12 : 0.55) : 0, kk2 = scopedNow ? 0.2 : 0.8, jx = 0, jy = 0, jz = 0;
      if (sk) { camera.position.x += (Math.random() - 0.5) * sk * 0.9; camera.position.y += (Math.random() - 0.5) * sk * 0.9; camera.position.z += (Math.random() - 0.5) * sk * 0.9; jx = (Math.random() - 0.5) * sk * 0.018; jy = (Math.random() - 0.5) * sk * 0.018; jz = (Math.random() - 0.5) * sk * 0.03; shake *= Math.exp(-rdt * 6); } else shake = 0;
      camera.rotation.order = 'YXZ'; camera.rotation.set(G.pitch + kick * kk2 + jx, G.yaw + jy, G.bank * 0.45 + jz);
      fovT = FPFOV + 22 * sp + (G.braking ? -6 : 0) + 6 * G.prox + kick * 40 * kk2 - (mode === 'ready' ? 18 * Math.max(0, Math.min(1, G.readyT / 3.4)) : 0);
      shipG.visible = false;
    }
    var scoped = isScoped(); if (!scoped && scopeBtn.classList.contains('on') && !touchScope) scopeBtn.classList.remove('on'); if (scoped) fovT = SCOPE_FOV; if (scoped !== scopeShown) { scopeShown = scoped; document.body.classList.toggle('scoped', scoped); }
    camera.fov += (fovT - camera.fov) * (1 - Math.exp(-rdt * (scoped ? 14 : 7))); camera.updateProjectionMatrix();
    pMat.uniforms.uScale.value = Hh * DPR / (2 * Math.tan(camera.fov * Math.PI / 360));
    sky.position.copy(camera.position);
  }
  function syncScene(rdt) {
    timeU.value += rdt; var cp = camera.position;
    ORDER.forEach(function (id) {
      var P = bodies[id];
      if (P.state === 'dead') { P.group.visible = false; return; }
      P.group.visible = true; var w = P.state === 'dying' ? 1 + 0.012 * Math.sin(timeU.value * 60) : 1; P.group.scale.setScalar(w);
      if (P.ring) { P.tilt.getWorldQuaternion(qTmp); P.u.ringN.value.set(0, 1, 0).applyQuaternion(qTmp); }
    });
    var shp = G && mode !== 'menu' ? G.pos : camera.position;
    tmpA.copy(sunPos).sub(shp).normalize(); sunLight.position.copy(shp).addScaledVector(tmpA, 100); sunLight.target.position.copy(shp); fillLight.position.copy(camera.position); fillLight.target.position.copy(shp);
    sunGlow.position.copy(sunPos); sunMesh.rotation.y += rdt * 0.01;
    var dSun = cp.length(); sunGlow.material.opacity = Math.min(1, Math.max(0.4, dSun / 2500));
    var spd = G && mode === 'play' ? (G.relSpeed || 0) : 0, boostK = spd > SPEED_BASE * 1.15 ? Math.min(1, (spd - SPEED_BASE) / (SPEED_BOOST - SPEED_BASE)) : 0;
    forwardOf(G ? G.yaw : 0, G ? G.pitch : 0, fwd);
    lineMat.opacity = mode === 'play' ? Math.min(0.9, 0.12 + spd / SPEED_BOOST * 0.8) : 0;
    var len = Math.min(70, spd * 0.045), svx = fwd.x, svy = fwd.y, svz = fwd.z; if (G && mode === 'play' && G.relSpeed > 5) { svx = G.relV.x / G.relSpeed; svy = G.relV.y / G.relSpeed; svz = G.relV.z / G.relSpeed; }
    for (var i = 0; i < NL; i++) {
      var bx = lineBase[i * 3], by = lineBase[i * 3 + 1], bz = lineBase[i * 3 + 2];
      var rx = ((bx - shp.x) % (2 * LB) + 3 * LB) % (2 * LB) - LB, ry = ((by - shp.y) % (2 * LB) + 3 * LB) % (2 * LB) - LB, rz = ((bz - shp.z) % (2 * LB) + 3 * LB) % (2 * LB) - LB;
      var px = shp.x + rx, py = shp.y + ry, pz = shp.z + rz;
      linePos[i * 6] = px; linePos[i * 6 + 1] = py; linePos[i * 6 + 2] = pz; linePos[i * 6 + 3] = px - svx * len; linePos[i * 6 + 4] = py - svy * len; linePos[i * 6 + 5] = pz - svz * len;
    }
    lineGeo.attributes.position.needsUpdate = true;
    engGlow.scale.setScalar(3.6 + 2.6 * boostK + Math.sin(performance.now() / 60) * 0.2);
    orbs.forEach(function (o) { if (!o.got) { o.t += rdt; o.mesh.scale.setScalar(1 + 0.15 * Math.sin(o.t * 4)); } });
    rings.spin.rotation.y += rdt * 0.012;
    syncBullets();
  }

  var miniCv = $('mini'), mctx = miniCv.getContext('2d');
  var MX0 = -15500, MX1 = 15500, MZ0 = -15500, MZ1 = 15500;
  function drawMini() {
    var s = miniCv.width, c = s / 2, sc = (s - 12 * DPR) / Math.max(MX1 - MX0, MZ1 - MZ0), cx = (MX0 + MX1) / 2, cz = (MZ0 + MZ1) / 2;
    function P(x, z) { return [c + (x - cx) * sc, c + (z - cz) * sc]; }
    mctx.clearRect(0, 0, s, s);
    var o = P(0, 0); mctx.strokeStyle = 'rgba(143,180,232,0.12)'; mctx.lineWidth = 1;
    ORDER.forEach(function (id) { var xz = EL[id].xz; mctx.beginPath(); for (var k = 0; k < xz.length; k += 2) { var q = P(xz[k], xz[k + 1]); if (k) mctx.lineTo(q[0], q[1]); else mctx.moveTo(q[0], q[1]); } mctx.stroke(); });
    mctx.fillStyle = '#ffc766'; mctx.beginPath(); mctx.arc(o[0], o[1], 3.5 * DPR, 0, TAU); mctx.fill();
    ORDER.forEach(function (id) {
      var B = bodies[id], p = P(B.pos.x, B.pos.z), r = (2 + Math.log(B.R) * 0.5) * DPR, tg = G && G.tgt === B && mode !== 'menu';
      if (B.state === 'dead') { mctx.strokeStyle = 'rgba(160,170,190,0.5)'; mctx.lineWidth = 1; mctx.beginPath(); mctx.arc(p[0], p[1], r, 0, TAU); mctx.stroke(); return; }
      mctx.fillStyle = PL[id].col; mctx.beginPath(); mctx.arc(p[0], p[1], r, 0, TAU); mctx.fill();
      if (tg) { mctx.strokeStyle = '#fff'; mctx.lineWidth = 1.3 * DPR; mctx.beginPath(); mctx.arc(p[0], p[1], r + 2.5 * DPR, 0, TAU); mctx.stroke(); }
      if (B.hp < B.maxHp) { mctx.strokeStyle = '#ff6a4a'; mctx.lineWidth = 1.5 * DPR; mctx.beginPath(); mctx.arc(p[0], p[1], r + 1.2 * DPR, -Math.PI / 2, -Math.PI / 2 + TAU * (1 - B.hp / B.maxHp)); mctx.stroke(); }
    });
    if (G && mode !== 'menu') { mctx.fillStyle = '#ff5a4d'; drones.forEach(function (d) { if (!d.alive) return; var p = P(d.pos.x, d.pos.z), z = (d.type === 'dread' ? 5.5 : (d.ship ? 3.6 : (d.type === 'shuttle' ? 2.4 : 1.8))) * DPR; mctx.globalAlpha = d.awake ? 1 : 0.55; mctx.fillRect(p[0] - z / 2, p[1] - z / 2, z, z); }); mctx.globalAlpha = 1; }
    if (boss.alive && G && mode !== 'menu') { var bp = P(boss.pos.x, boss.pos.z); mctx.fillStyle = '#ff8a30'; mctx.beginPath(); mctx.arc(bp[0], bp[1], 4 * DPR, 0, TAU); mctx.fill(); }
    var pos = G && mode !== 'menu' ? G.pos : bodies.earth.pos, yaw = G ? G.yaw : 0, sp = P(pos.x, pos.z);
    mctx.save(); mctx.translate(sp[0], sp[1]); mctx.rotate(-yaw + Math.PI); mctx.fillStyle = '#fff'; mctx.shadowColor = '#7fe3ff'; mctx.shadowBlur = 6 * DPR;
    mctx.beginPath(); mctx.moveTo(0, 5 * DPR); mctx.lineTo(3.4 * DPR, -3.5 * DPR); mctx.lineTo(0, -1.5 * DPR); mctx.lineTo(-3.4 * DPR, -3.5 * DPR); mctx.closePath(); mctx.fill(); mctx.restore();
  }
  var speedEl = $('speed'), altEl = $('alt'), hullFill = $('hullFill'), hullOut = $('hullOut'), enFill = $('enFill'), enOut = $('enOut'), timerEl = $('timer'), vigEl = $('vig'), navEl = $('nav'), cntEl = $('count');
  var heatFill = $('heatFill'), heatOut = $('heatOut'), bombEl = $('bombs'), tgtName = $('tgtName'), tgtFill = $('tgtFill'), tgtOut = $('tgtOut'), crossEl = $('cross'), scoreEl = $('score'), lastSpeedTxt = '', dispScore = 0;
  var comboEl = $('combo'), comboN = $('comboN'), comboT = $('comboT'), comboB = $('comboB');
  var mkCv = $('mk'), mk = mkCv.getContext('2d'), mkV = new V3(), mkDirty = false;
  function drawMarkers() {
    mk.clearRect(0, 0, mkCv.width, mkCv.height); mkDirty = true; if (!G || mode === 'menu' || mode === 'over') return;
    var f = Hh * 0.5 / Math.tan(camera.fov * Math.PI / 360);
    function mark(pos, rad, col, ref, lbl) {
      var dist = camera.position.distanceTo(pos); mkV.copy(pos).project(camera); if (mkV.z >= 1 || Math.abs(mkV.x) > 1.05 || Math.abs(mkV.y) > 1.05) return null;
      var x = (mkV.x * 0.5 + 0.5) * mkCv.width, y = (-mkV.y * 0.5 + 0.5) * mkCv.height, half = clampN(rad * f / dist, 9, 70) * DPR, lock = G.lock === ref, c = half * 0.45;
      mk.strokeStyle = col; mk.lineWidth = (lock ? 2.4 : 1.4) * DPR; mk.globalAlpha = lock ? 1 : 0.7; mk.beginPath();
      mk.moveTo(x - half, y - half + c); mk.lineTo(x - half, y - half); mk.lineTo(x - half + c, y - half); mk.moveTo(x + half - c, y - half); mk.lineTo(x + half, y - half); mk.lineTo(x + half, y - half + c);
      mk.moveTo(x + half, y + half - c); mk.lineTo(x + half, y + half); mk.lineTo(x + half - c, y + half); mk.moveTo(x - half + c, y + half); mk.lineTo(x - half, y + half); mk.lineTo(x - half, y + half - c); mk.stroke();
      if (lock || lbl) { mk.fillStyle = col; mk.globalAlpha = 0.95; mk.font = (11 * DPR * uiS) + 'px IBM Plex Mono, monospace'; mk.textAlign = 'center'; mk.fillText((lbl ? lbl + ' ' : '') + fmtN(dist), x, y + half + 13 * DPR); }
      return [x, y, half];
    }
    function hpBar(sc, d) {
      if (!sc) return; var bw = Math.max(40 * DPR * uiS, Math.min(sc[2] * 2, 120 * DPR * uiS)), bh = 5 * DPR * uiS, bx = sc[0] - bw / 2, by = sc[1] - sc[2] - 12 * DPR * uiS, fr = Math.max(0, d.hp / d.max);
      mk.globalAlpha = 0.95; mk.fillStyle = 'rgba(25,0,0,0.78)'; mk.fillRect(bx - DPR, by - DPR, bw + 2 * DPR, bh + 2 * DPR); mk.fillStyle = fr < 0.3 ? '#ff1f1f' : '#ff4a3a'; mk.fillRect(bx, by, bw * fr, bh);
      mk.strokeStyle = 'rgba(255,120,100,0.8)'; mk.lineWidth = DPR; mk.strokeRect(bx - DPR, by - DPR, bw + 2 * DPR, bh + 2 * DPR);
      mk.fillStyle = '#ff9a8a'; mk.font = (10 * DPR * uiS) + 'px Noto Sans TC, sans-serif'; mk.textAlign = 'center'; mk.fillText(d.name, sc[0], by - 4 * DPR * uiS);
    }
    for (var i = 0; i < drones.length; i++) { var d = drones[i]; if (d.alive && G.pos.distanceTo(d.pos) < 7000) { var sc = mark(d.pos, d.r, '#ff6a52', d); hpBar(sc, d); } }
    for (var j = 0; j < cores.length; j++) { var nd = cores[j]; if (nd.alive && nd.facing && G.pos.distanceTo(nd.pos) < 3500) mark(nd.pos, nd.cs * 1.6, '#ffb347', nd); }
    if (boss.alive) { var bsc = mark(boss.pos, SUN_R, '#ffa040', boss, '太陽'); if (boss.stage === 2) hpBar(bsc, { hp: boss.hp, max: boss.max, name: boss.inv > 0 ? '太陽（無敵）' : '太陽' }); }
    mk.globalAlpha = 1;
  }
  function updateHud() {
    if (!G) return;
    var kms = Math.round((G.relSpeed || 0) * KMS * 10) / 10; var st = kms.toFixed(1); if (st !== lastSpeedTxt) { speedEl.firstChild.nodeValue = st; lastSpeedTxt = st; }
    var hp = Math.max(0, G.hull); hullFill.style.width = hp + '%'; hullFill.className = hp < 30 ? 'low' : (hp < 60 ? 'mid' : ''); hullOut.textContent = Math.round(hp) + '%';
    enFill.style.width = G.energy + '%'; enOut.textContent = Math.round(G.energy) + '%'; timerEl.textContent = fmtT(G.t);
    heatFill.style.width = (G.heat * 100) + '%'; heatFill.className = G.overheat ? 'low' : (G.heat > 0.7 ? 'mid' : ''); heatOut.textContent = G.overheat ? '過熱' : Math.round(G.heat * 100) + '%';
    bombEl.textContent = '炸彈 ' + G.bombs; $('bBomb').textContent = '炸彈 ' + G.bombs;
    dispScore += (totalScore() - dispScore) * 0.2; if (Math.abs(totalScore() - dispScore) < 1) dispScore = totalScore(); scoreEl.textContent = fmtN(dispScore);
    var T0 = objective();
    if (T0) { tgtName.textContent = T0.name; tgtFill.style.width = (T0.frac * 100) + '%'; tgtFill.className = T0.shield ? 'sh' : (T0.boss ? 'bs' : ''); tgtOut.textContent = fmtN(G.pos.distanceTo(T0.pos) - T0.R); }
    else { tgtName.textContent = '全數擊碎'; tgtFill.style.width = '0%'; tgtOut.textContent = ''; }
    var np = G.altInfo; if (np && np.rel < 3 && np.id !== 'sun') {
      var info = PL[np.id], km = Math.round(np.alt / info.R * info.km / 100) * 100; altEl.textContent = info.name + ' · 高度 ' + fmtN(km) + ' km'; altEl.className = np.rel < 0.12 ? 'hot' : (np.rel < 0.6 ? 'close' : '');
    } else if (np && np.id === 'sun' && np.rel < 2) { altEl.textContent = '太陽 · 距離 ' + fmtN(np.alt) + ' 單位'; altEl.className = np.rel < 0.5 ? 'hot' : 'close'; }
    else { altEl.textContent = '深空巡航'; altEl.className = ''; }
    if (G.gmag > 0.8) altEl.textContent += ' · 引力 ' + G.gmag.toFixed(1); if (G.pos.length() > 16000) { altEl.textContent = '太陽系邊界・引力場正在拉你回來'; altEl.className = 'hot'; }
    updateHpList();
    pips.forEach(function (p, i) { var B = bodies[ORDER[i]]; p.classList.toggle('done', B.state === 'dead'); p.classList.toggle('next', G.tgt === B && B.state !== 'dead'); });
    var vig = 0, vc = 'rgba(255,70,50,0.6)'; if (hp < 30) vig = Math.max(vig, (30 - hp) / 30 * 0.6 + 0.15);
    if (redVig > 0) { vig = Math.max(vig, redVig * 0.65); redVig = Math.max(0, redVig - 0.04); }
    if (flashVig > 0) { vig = Math.max(vig, flashVig * 0.8); vc = 'rgba(255,240,220,0.8)'; flashVig = Math.max(0, flashVig - 0.025); }
    vigEl.style.setProperty('--vc', vc); vigEl.style.opacity = (mode === 'play' || mode === 'pause') ? vig.toFixed(2) : 0;
    // crosshair
    tmpA.copy(G.pos).addScaledVector(fwd, 700).project(camera); crossEl.style.transform = (tmpA.z < 1 ? 'translate(' + ((tmpA.x * 0.5 + 0.5) * W).toFixed(1) + 'px,' + ((-tmpA.y * 0.5 + 0.5) * Hh).toFixed(1) + 'px)' : 'translate(-999px,-999px)');
    crossEl.classList.toggle('hit', crossHit > 0); crossHit = Math.max(0, crossHit - 0.016); crossEl.classList.toggle('hot', G.overheat); crossEl.classList.toggle('lock', !!G.lock);
    if (G.combo > 0) { comboEl.style.display = 'block'; comboN.textContent = '×' + comboMult(); comboT.textContent = '連擊 ' + G.combo; comboB.style.width = Math.max(0, G.comboT / (4.2 + 1.2 * G.up.chain) * 100) + '%'; comboEl.className = 'm' + comboMult(); } else comboEl.style.display = 'none';
    drawMarkers();
    // nav marker to target
    if (T0 && mode === 'play') {
      tmpA.copy(T0.pos).project(camera); var onScreen = tmpA.z < 1 && Math.abs(tmpA.x) < 0.92 && Math.abs(tmpA.y) < 0.88, d = G.pos.distanceTo(T0.pos), dx = tmpA.x, dy = tmpA.y;
      if (tmpA.z > 1) { dx = -dx; dy = -dy; }
      var arrow = navEl.firstChild; navEl.lastChild.textContent = T0.label + ' ' + fmtN(d - T0.R);
      if (onScreen && d > T0.R * 2.2) { arrow.className = 'dia'; navEl.style.transform = 'translate(' + ((dx * 0.5 + 0.5) * W - 11).toFixed(1) + 'px,' + ((-dy * 0.5 + 0.5) * Hh - 34 - 0).toFixed(1) + 'px)'; arrow.style.transform = ''; }
      else if (onScreen) navEl.style.transform = 'translate(-999px,-999px)';
      else { var m = Math.max(Math.abs(dx) / 0.9, Math.abs(dy) / 0.8) || 1; dx /= m; dy /= m; arrow.className = ''; navEl.style.transform = 'translate(' + ((dx * 0.5 + 0.5) * W - 11).toFixed(1) + 'px,' + ((-dy * 0.5 + 0.5) * Hh - 11).toFixed(1) + 'px)'; arrow.style.transform = 'rotate(' + (Math.atan2(-dy, dx) + Math.PI / 2).toFixed(3) + 'rad)'; }
    } else navEl.style.transform = 'translate(-999px,-999px)';
  }

  var last = performance.now();
  function frame(now) {
    requestAnimationFrame(frame);
    var rdt = Math.min(0.05, (now - last) / 1000); last = now;
    if (capTimer > 0) { capTimer -= rdt; if (capTimer <= 0) capEl.classList.remove('on'); }
    var ts = slowT > 0 ? 0.35 : 1; if (slowT > 0) slowT -= rdt;
    if (mode === 'ready' && G.warm < 8) { G.warm++; cntEl.textContent = ''; }
    else if (mode === 'ready') {
      var prevC = Math.ceil(G.readyT); G.readyT -= rdt; var c = Math.ceil(G.readyT - 0.4);
      if (c !== Math.ceil(prevC - 0.4) && c >= 0) { if (c > 0) sfx.beep(false); else sfx.beep(true); }
      cntEl.textContent = G.readyT > 0.4 ? String(Math.min(3, Math.ceil(G.readyT - 0.4))) : (G.readyT > -0.3 ? 'GO' : '');
      if (G.readyT <= 0) { cntEl.textContent = ''; setMode('play'); }
    } else if (mode === 'play') {
      cntEl.textContent = '';
      step(rdt * ts, G.result ? { yaw: 0, pitch: 0, dyaw: 0, dpitch: 0, boost: false, brake: false, fire: false, bomb: false } : gatherInput()); handleEvents();
      if (G.result) { G.endT -= rdt; if (G.endT <= 0) endGame(); }
      if (AC && engGain) {
        var spn = G.speed / SPEED_BOOST; engGain.gain.setTargetAtTime(0.05 + 0.05 * spn, AC.currentTime, 0.08); eng.frequency.setTargetAtTime(48 + spn * 70, AC.currentTime, 0.1);
        whooshGain.gain.setTargetAtTime(G.boosting ? 0.2 : 0.02 + 0.05 * G.prox, AC.currentTime, 0.1); whooshF.frequency.setTargetAtTime(500 + G.speed * 2.5, AC.currentTime, 0.1);
      }
    } else if (mode === 'pause') { /* frozen */ } else if (AC && engGain) { engGain.gain.setTargetAtTime(0.0001, AC.currentTime, 0.1); whooshGain.gain.setTargetAtTime(0.0001, AC.currentTime, 0.1); }
    if (mode !== 'pause') { updateParticles(rdt); updateFx(rdt); updatePfx(rdt); if (mode === 'over' || mode === 'ready' || mode === 'pick') updateDebris(rdt); }
    if (mode === 'menu' || mode === 'over' || mode === 'ready') { updateOrbits(rdt); updateCores(rdt); }
    updateCamera(rdt); syncScene(rdt);
    renderer.render(scene, camera);
    if (mode === 'play' || mode === 'pause' || mode === 'ready' || mode === 'pick') updateHud(); else if (mkDirty) { mk.clearRect(0, 0, mkCv.width, mkCv.height); mkDirty = false; }
    drawMini();
  }
  resize(); newGame(); G.camYaw = G.yaw; camera.position.copy(bodies.earth.pos).add(new V3(-16, 40, -540)); setMode('menu'); requestAnimationFrame(frame);

  /* test hooks */
  window.__game = {
    get G() { return G; }, get mode() { return mode; }, bodies: bodies, drones: drones,
    start: startGame, forceMode: function (m) { setMode(m); },
    place: function (id, dist, ox, oy) { newGame(); var B = bodies[id]; G.vel.copy(B.vel); var dir = B.pos.clone().sub(sunPos).normalize(); G.pos.copy(B.pos).addScaledVector(dir, -(B.R + dist)); G.pos.addScaledVector(new V3(-dir.z, 0, dir.x), ox || 0); G.pos.y += oy || 0; var l = B.pos.clone().sub(G.pos); G.yaw = Math.atan2(-l.x, -l.z); G.pitch = Math.atan2(l.y, Math.hypot(l.x, l.z)); G.camYaw = G.yaw; G.camPitch = G.pitch; G.speed = 100; camera.position.copy(G.pos); setMode('play'); },
    run: function (secs, pilot) { var n = Math.round(secs / (1 / 60)); for (var i = 0; i < n && G && !G.result; i++) { step(1 / 60, pilot ? pilot(G) : { yaw: 0, pitch: 0, boost: false, brake: false, fire: false, bomb: false }); handleEvents(); if (mode === 'pick') chooseUpgrade(Math.floor(Math.random() * G.offer.length)); updateParticles(1 / 60); updateFx(1 / 60); } return G ? { t: G.t, hull: Math.round(G.hull), destroyed: G.destroyed, hits: G.hits, boss: boss.alive ? Math.round(boss.hp) : (G.bossKilled ? 'dead' : null), score: Math.round(totalScore()), maxCombo: G.maxCombo, up: G.up, result: G.result, nodes: G.coresKilled } : null; },
    boss: boss, cores: cores, EL: EL, bAlive: bAlive, NBp: NB, hurt: hurtEnemy, startBoss: startBoss, objective: objective, offer: offerUpgrades, choose: chooseUpgrade, step: step, handle: handleEvents,
    pilot: function (G) {
      var aim = null, R0 = 0, vel = null, kindT = '', stand = 600;
      if (boss.alive) {
        if (boss.stage === 1) { var bd0 = 1e12; drones.forEach(function (d) { if (!d.guard || !d.alive) return; var dd = d.pos.distanceTo(G.pos); if (dd < bd0) { bd0 = dd; aim = d.pos; R0 = d.r; vel = d.vel; kindT = 'enemy'; stand = 650; } }); }
        else { aim = boss.pos; R0 = SUN_R; kindT = 'sun'; stand = 1700; vel = ZV; }
      } else {
        var bd = 1e12; drones.forEach(function (d) { if (!d.alive || !d.awake) return; var dd = d.pos.distanceTo(G.pos); if (dd < 700 && dd < bd) { bd = dd; aim = d.pos; R0 = d.r; vel = d.vel; kindT = 'enemy'; stand = 450; } });
        if (!aim) { var T0 = G.tgt; if (T0) { aim = T0.pos; R0 = T0.R; vel = T0.vel; kindT = 'planet'; stand = 650; } }
      }
      if (!aim) return { yaw: 0, pitch: 0, thrust: 0 };
      var tv = vel || ZV, d0 = aim.clone().sub(G.pos), dist0 = d0.length(), u = d0.clone().multiplyScalar(1 / Math.max(dist0, 1));
      var tl = Math.min(dist0 / 3000, 2.5), ap = aim.clone().addScaledVector(tv, tl);
      var d = ap.sub(G.pos), dist = d.length(), wy = Math.atan2(-d.x, -d.z), dy = wy - G.yaw; dy = Math.atan2(Math.sin(dy), Math.cos(dy));
      var wp = Math.atan2(d.y, Math.hypot(d.x, d.z)), dp = wp - G.pitch, tol = Math.max(0.05, Math.atan(R0 * 0.8 / Math.max(dist, 1))), aligned = Math.abs(dy) < tol && Math.abs(dp) < tol, surf = dist0 - R0;
      var closing = -(G.vel.clone().sub(tv)).dot(u), desired = surf > stand ? Math.min(420, Math.sqrt(2 * 110 * (surf - stand))) : -Math.min(60, (stand - surf) * 0.2);
      var o = { yaw: Math.max(-1, Math.min(1, -dy * 2.5)), pitch: Math.max(-1, Math.min(1, dp * 2.5)), thrust: 0, boost: false, fire: (aligned && surf < 1900) || !!G.lock, bomb: aligned && (kindT === 'planet' || kindT === 'sun') && surf < 900 && G.bombs > 0 };
      var facing = Math.abs(dy) < 0.6 && Math.abs(dp) < 0.6;
      if (closing < desired - 10 && facing) { o.thrust = 1; o.boost = G.energy > 40 && desired > 300 && closing < 250 && (kindT !== 'sun' || surf > 4500); }
      else if (closing > desired + 40) o.thrust = -1;
      var np = G.altInfo; if (np && np.id !== 'sun' && np.alt < 220) { var B2 = bodies[np.id]; var aw = G.pos.clone().sub(B2.pos); var ay = Math.atan2(-aw.x, -aw.z) - G.yaw; ay = Math.atan2(Math.sin(ay), Math.cos(ay)); o.yaw = Math.max(-1, Math.min(1, -ay * 2.5)); o.pitch = Math.max(-1, Math.min(1, (Math.atan2(aw.y, Math.hypot(aw.x, aw.z)) - G.pitch) * 2.5)); o.thrust = 1; o.boost = true; o.fire = false; o.bomb = false; }
      var inw = -G.vel.dot(G.pos) / Math.max(G.pos.length(), 1); if (G.pos.length() - SUN_R < Math.max(900, 400 + Math.max(0, inw) * Math.max(0, inw) / 250)) { var as = G.pos.clone(); var ay2 = Math.atan2(-as.x, -as.z) - G.yaw; ay2 = Math.atan2(Math.sin(ay2), Math.cos(ay2)); o.yaw = Math.max(-1, Math.min(1, -ay2 * 2.5)); o.pitch = Math.max(-1, Math.min(1, (Math.atan2(as.y, Math.hypot(as.x, as.z)) - G.pitch) * 2.5)); o.thrust = 1; o.boost = false; }
      o.dyaw = -o.yaw * 0.03; o.dpitch = o.pitch * 0.025; o.yaw = 0; o.pitch = 0;
      return o;
    }
  };
})();
