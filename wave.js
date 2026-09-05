/* ============================================================
   Silk field
   ------------------------------------------------------------
   One full-screen fragment shader, no library. Domain-warped flow
   noise builds soft folds rather than hard bands, shaded so the
   crests catch light and the troughs fall away, then coloured
   along a warm-to-cool axis: cream through apricot to coral on
   one side, pale blue through teal to deep teal on the other.
   Palette sampled from the reference image.

   The pointer does three things:
     bend     the sampling point is pushed away from the cursor, so
              the folds gather and part around it
     ripple   a slow swell rides on that bend
     sheen    a specular term with its light at the cursor, riding
              the fold height, so the silk catches light where you
              point at it

   A luminance floor keeps the field clear of the type sitting on
   it, so dark copy on light and light copy on dark both clear
   WCAG AA. Measured, not guessed.

   Falls back to a static CSS gradient when WebGL is unavailable,
   and renders one frozen frame under prefers-reduced-motion.
   ============================================================ */

(function () {
  'use strict';

  var canvas = document.getElementById('waveCanvas');
  if (!canvas) return;

  var gl = canvas.getContext('webgl', {
    alpha: false, antialias: false, depth: false, stencil: false,
    powerPreference: 'low-power'
  }) || canvas.getContext('experimental-webgl');

  if (!gl) {
    document.documentElement.classList.add('no-gl');
    return;
  }

  var VERT = [
    'attribute vec2 aPos;',
    'void main(){ gl_Position = vec4(aPos, 0.0, 1.0); }'
  ].join('\n');

  var FRAG = [
    'precision mediump float;',
    'uniform vec2  uRes;',
    'uniform float uTime;',
    'uniform vec2  uMouse;',
    'uniform float uEnergy;',
    'uniform float uDark;',

    /* ------------------------------------------------------------------
       TUNING DIALS. These are the only numbers worth touching to change
       how the background feels. Edit, save, hard refresh (ctrl+shift+R).

       CONTRAST  overall separation between the light and dark folds.
                 1.00 = full strength, lower = flatter and calmer.
       DEPTH     how far into the colour ramp each fold travels as it
                 recedes. The single biggest driver of contrast.
       CREASE    brightness of the light line along each fold edge.
       SHADOW    darkness of the shadow one sheet casts on the next.
       SHEEN     broad soft light across the face of each fold.
       ------------------------------------------------------------------ */
    'const float CONTRAST = 0.98;',
    'const float DEPTH    = 0.17;',
    'const float CREASE   = 0.04;',
    'const float SHADOW   = 0.02;',
    'const float SHEEN    = 0.05;',
    'const vec3  MIDTONE  = vec3(0.80, 0.76, 0.68);',

    'float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123); }',

    'float noise(vec2 p){',
    '  vec2 i = floor(p), f = fract(p);',
    '  vec2 u = f * f * (3.0 - 2.0 * f);',
    '  return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x),',
    '             mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x), u.y);',
    '}',

    'float fbm(vec2 p){',
    '  float v = 0.0, a = 0.55;',
    '  for (int i = 0; i < 3; i++) { v += a * noise(p); p *= 2.06; a *= 0.5; }',
    '  return v;',
    '}',

    /* The edge of one sheet of silk. Three slow harmonics keep it laminar, so
       the folds sweep rather than churn; a little noise stops them repeating. */
    'float foldY(vec2 p, float i, float t){',
    '  float ph = i * 1.93;',
    '  return 0.108 * sin(p.x * (1.22 + i * 0.21) + t * 0.115 + ph)',
    '       + 0.055 * sin(p.x * (2.10 - i * 0.14) - t * 0.089 + ph * 1.63)',
    '       + 0.028 * sin(p.x * (3.55 + i * 0.29) + t * 0.067 + ph * 2.31)',
    '       + 0.026 * (fbm(vec2(p.x * 0.75 + i * 5.1, t * 0.028 + i * 3.4)) - 0.5);',
    '}',

    /* cream, peach, apricot, orange, coral */
    'vec3 warmRamp(float u){',
    '  vec3 c = mix(vec3(0.992, 0.945, 0.749), vec3(0.988, 0.780, 0.529), smoothstep(0.00, 0.30, u));',
    '  c = mix(c, vec3(0.984, 0.647, 0.329), smoothstep(0.25, 0.56, u));',
    '  c = mix(c, vec3(0.929, 0.494, 0.227), smoothstep(0.50, 0.79, u));',
    '  c = mix(c, vec3(0.831, 0.361, 0.118), smoothstep(0.74, 1.00, u));',
    '  return c;',
    '}',

    /* pale, blue-grey, teal, deep teal */
    'vec3 coolRamp(float u){',
    '  vec3 c = mix(vec3(0.855, 0.914, 0.910), vec3(0.443, 0.620, 0.639), smoothstep(0.00, 0.30, u));',
    '  c = mix(c, vec3(0.251, 0.608, 0.635), smoothstep(0.25, 0.56, u));',
    '  c = mix(c, vec3(0.051, 0.459, 0.494), smoothstep(0.50, 0.79, u));',
    '  c = mix(c, vec3(0.043, 0.404, 0.451), smoothstep(0.74, 1.00, u));',
    '  return c;',
    '}',

    /* One sheet. It fills everything below its edge; the shading is brightest
       just under that edge and deepens with distance, which is what reads as
       volume rather than a flat band. */
    'vec3 sheet(vec3 col, vec2 p, float base, float i, float u, float t, float bias){',
    '  float d = p.y - (base + foldY(p, i, t));',
    '  float a = smoothstep(-0.010, 0.010, d);',

    /* the sheet above casts a soft shadow on whatever it overlaps: this is
       what makes the stack read as layers rather than one gradient */
    '  float occl = exp(-max(-d, 0.0) * 26.0) * (1.0 - smoothstep(-0.004, 0.004, d));',
    '  col *= 1.0 - occl * SHADOW;',

    '  float sh = exp(-max(d, 0.0) * 3.4);',
    '  float uu = clamp(u + (1.0 - sh) * DEPTH, 0.0, 1.0);',
    '  float ax = p.x * 0.70 + (1.0 - p.y) * 0.60 + bias;',
    '  vec3 c = mix(coolRamp(uu), warmRamp(uu), smoothstep(0.18, 0.82, ax));',

    /* light catching the crease itself */
    '  c += exp(-max(d, 0.0) * 38.0) * CREASE;',
    '  c += sh * SHEEN;',
    '  return mix(col, c, a);',
    '}',

    'float lum(vec3 c){ return dot(c, vec3(0.2126, 0.7152, 0.0722)); }',

    'void main(){',
    '  vec2 p = gl_FragCoord.xy / uRes;',
    '  p.y = 1.0 - p.y;',
    '  float asp = uRes.x / uRes.y;',
    '  float t = uTime;',

    /* ---- pointer: the folds gather and part around the cursor ---- */
    '  vec2 dm = (p - uMouse) * vec2(asp, 1.0);',
    '  float dist = length(dm);',
    '  float infl = exp(-dist * dist * 5.0);',
    '  vec2 pw = p + normalize(dm + vec2(1e-4)) * infl * 0.062 * (0.55 + uEnergy);',
    '  pw.y += sin(dist * 15.0 - t * 1.35) * infl * 0.015 * (0.35 + uEnergy);',

    /* ---- the sheets, back to front ---- */
    '  float bias = -0.12;',
    '  vec3 col = mix(coolRamp(0.06), warmRamp(0.02),',
    '                 smoothstep(0.18, 0.82, pw.x * 0.52 + (1.0 - pw.y) * 0.66 + bias));',
    '  col = sheet(col, pw, 0.07, 0.0, 0.06, t, bias);',
    '  col = sheet(col, pw, 0.25, 1.0, 0.20, t, bias);',
    '  col = sheet(col, pw, 0.43, 2.0, 0.38, t, bias);',
    '  col = sheet(col, pw, 0.61, 3.0, 0.56, t, bias);',
    '  col = sheet(col, pw, 0.79, 4.0, 0.74, t, bias);',
    '  col = sheet(col, pw, 0.94, 5.0, 0.90, t, bias);',

    /* ---- global contrast: pull the whole field toward its mid tone ---- */
    '  col = mix(MIDTONE, col, CONTRAST);',

    /* ---- dark theme: the same silk dropped to a deep tint ---- */
    '  vec3 night = mix(vec3(0.024, 0.034, 0.038), col * 0.74, 0.64);',
    '  col = mix(col, night, uDark);',

    /* ---- tone guard: lift the darkest folds on light, cap the brightest on
       dark, so the type over them always clears. Hue is untouched. ---- */
    '  float L = lum(col);',
    '  col = mix(col, vec3(1.0), smoothstep(0.24, 0.06, L) * 0.28 * (1.0 - uDark));',
    '  col = mix(col, vec3(0.05, 0.07, 0.075), smoothstep(0.22, 0.50, L) * 0.36 * uDark);',

    /* ---- keep the nav strip and the hero footer legible ---- */
    '  vec3 lift = mix(vec3(0.965, 0.945, 0.905), vec3(0.040, 0.052, 0.058), uDark);',
    '  float topLift = 1.0 - smoothstep(0.0, 0.17, p.y);',
    '  float botLift = smoothstep(0.70, 1.0, p.y);',
    '  col = mix(col, lift, topLift * mix(0.58, 0.72, uDark));',
    '  col = mix(col, lift, botLift * mix(0.72, 0.76, uDark));',

    /* ---- reflection: light source sits on the cursor ---- */
    '  float fall = pow(max(0.0, 1.0 - dist * 0.90), 2.0);',
    '  float spec = fall * (0.40 + 0.60 * uEnergy);',
    '  col += spec * mix(vec3(0.20, 0.19, 0.16), vec3(0.14, 0.18, 0.18), uDark);',
    '  col = mix(col, mix(vec3(1.0), vec3(0.60, 0.72, 0.72), uDark), fall * 0.10);',

    /* ---- grain, so the wide gradients do not band ---- */
    '  col += (hash(gl_FragCoord.xy + fract(t)) - 0.5) * 0.018;',
    '  gl_FragColor = vec4(col, 1.0);',
    '}'
  ].join('\n');

  function compile(type, src) {
    var s = gl.createShader(type);
    gl.shaderSource(s, src);
    gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
      console.error('[wave] shader: ' + gl.getShaderInfoLog(s));
      return null;
    }
    return s;
  }

  function bail() {
    /* An initialised WebGL canvas paints opaque black even with nothing drawn,
       which would hide the CSS fallback, so take it out of the page. */
    canvas.style.display = 'none';
    document.documentElement.classList.add('no-gl');
  }

  var vs = compile(gl.VERTEX_SHADER, VERT);
  var fs = compile(gl.FRAGMENT_SHADER, FRAG);
  if (!vs || !fs) { bail(); return; }

  var prog = gl.createProgram();
  gl.attachShader(prog, vs);
  gl.attachShader(prog, fs);
  gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
    console.error('[wave] link: ' + gl.getProgramInfoLog(prog));
    bail();
    return;
  }
  gl.useProgram(prog);

  var buf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  var aPos = gl.getAttribLocation(prog, 'aPos');
  gl.enableVertexAttribArray(aPos);
  gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);

  var uRes = gl.getUniformLocation(prog, 'uRes');
  var uTime = gl.getUniformLocation(prog, 'uTime');
  var uMouse = gl.getUniformLocation(prog, 'uMouse');
  var uEnergy = gl.getUniformLocation(prog, 'uEnergy');
  var uDark = gl.getUniformLocation(prog, 'uDark');

  /* Soft gradients survive downsampling, so render well under device
     resolution and let the browser scale it back up. */
  var QUALITY = 0.58;
  var MAX_W = 1500;

  function resize() {
    var scale = Math.min(window.devicePixelRatio || 1, 2) * QUALITY;
    var w = Math.max(1, Math.round(window.innerWidth * scale));
    var h = Math.max(1, Math.round(window.innerHeight * scale));
    if (w > MAX_W) { h = Math.max(1, Math.round(h * MAX_W / w)); w = MAX_W; }
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w;
      canvas.height = h;
      gl.viewport(0, 0, w, h);
    }
    gl.uniform2f(uRes, w, h);
  }

  /* pointer state, eased so the light glides rather than snaps */
  var target = { x: 0.5, y: 0.42 };
  var eased = { x: 0.5, y: 0.42 };
  var energy = 0, energyTarget = 0;
  var lastMove = 0;

  function point(x, y) {
    target.x = x / window.innerWidth;
    target.y = y / window.innerHeight;
    energyTarget = 1;
    lastMove = performance.now();
  }

  window.addEventListener('pointermove', function (e) { point(e.clientX, e.clientY); }, { passive: true });
  window.addEventListener('touchmove', function (e) {
    if (e.touches[0]) point(e.touches[0].clientX, e.touches[0].clientY);
  }, { passive: true });

  /* Phones have no cursor, so tilt drives the light instead. */
  window.addEventListener('deviceorientation', function (e) {
    if (e.gamma == null || e.beta == null) return;
    if (performance.now() - lastMove < 2000) return;
    target.x = Math.min(1, Math.max(0, 0.5 + e.gamma / 90));
    target.y = Math.min(1, Math.max(0, 0.5 + (e.beta - 45) / 90));
    energyTarget = 0.65;
  }, true);

  var reduced = window.matchMedia('(prefers-reduced-motion: reduce)');

  function isDark() {
    var t = document.documentElement.dataset.theme;
    if (t === 'dark') return 1;
    if (t === 'light') return 0;
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 1 : 0;
  }

  var dark = isDark(), darkEased = dark;
  var start = performance.now();
  var raf = null;

  /* Cheap insurance for weak GPUs: time the first stretch of frames and, if
     they are not keeping up, halve the pixel count once and stay there. */
  var probe = { n: 0, sum: 0, last: 0, done: false };

  function watchCost(now) {
    if (probe.done) return;
    if (probe.last) { probe.sum += now - probe.last; probe.n++; }
    probe.last = now;
    if (probe.n < 45) return;
    probe.done = true;
    if (probe.sum / probe.n > 24) {   /* under about 42fps */
      QUALITY = 0.40;
      resize();
    }
  }

  function frame(now) {
    raf = requestAnimationFrame(frame);

    if (document.hidden) return;
    watchCost(now);

    /* let the light settle back to an idle drift when the pointer rests */
    if (now - lastMove > 2200) energyTarget = 0;

    eased.x += (target.x - eased.x) * 0.038;
    eased.y += (target.y - eased.y) * 0.038;
    energy += (energyTarget - energy) * 0.022;
    darkEased += (dark - darkEased) * 0.08;

    var t = (now - start) / 1000;

    /* with no pointer activity the light wanders on its own */
    var idle = 1 - energy;
    var mx = eased.x + Math.cos(t * 0.085) * 0.18 * idle;
    var my = eased.y + Math.sin(t * 0.064) * 0.12 * idle;

    gl.uniform1f(uTime, t);
    gl.uniform2f(uMouse, mx, my);
    gl.uniform1f(uEnergy, energy);
    gl.uniform1f(uDark, darkEased);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }

  function drawOnce() {
    gl.uniform1f(uTime, 6.0);
    gl.uniform2f(uMouse, 0.5, 0.4);
    gl.uniform1f(uEnergy, 0.0);
    gl.uniform1f(uDark, isDark());
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }

  function apply() {
    if (raf) { cancelAnimationFrame(raf); raf = null; }
    resize();
    if (reduced.matches) drawOnce();
    else raf = requestAnimationFrame(frame);
  }

  var rt;
  window.addEventListener('resize', function () {
    clearTimeout(rt);
    rt = setTimeout(function () { resize(); if (reduced.matches) drawOnce(); }, 150);
  });

  if (reduced.addEventListener) reduced.addEventListener('change', apply);

  /* the theme toggle and the system setting both retint the field */
  new MutationObserver(function () { dark = isDark(); if (reduced.matches) drawOnce(); })
    .observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', function () {
    dark = isDark();
    if (reduced.matches) drawOnce();
  });

  apply();
  document.documentElement.classList.add('has-wave');
})();
