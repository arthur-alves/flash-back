// Real-time pixel-art upscale filters, applied to the Ruffle canvas via a
// WebGL overlay. Not byte-exact ports of the original xBR/HQ2X/2xSaI
// reference implementations (those rely on large precomputed lookup tables
// this project has no build step to generate) — these are original GLSL
// shaders written to match each algorithm's visual character: diagonal edge
// detection + directional blending, with per-filter thresholds tuned so xBR
// reads sharpest, 2xSaI softest, and HQ2X in between. CSS `filter` can't do
// any of this — none of its primitives (or even SVG feConvolveMatrix) can
// express neighbor-pattern-dependent blending, only fixed per-pixel math.
const PIXEL_FILTERS = ["original", "2xsai", "hq2x", "xbr"];

const VERTEX_SRC = `
attribute vec2 aPosition;
varying vec2 vTexCoord;
void main() {
  vTexCoord = aPosition * 0.5 + 0.5;
  gl_Position = vec4(aPosition, 0.0, 1.0);
}
`;

// Shared helpers, prepended to every fragment shader.
const FRAGMENT_HEADER = `
precision mediump float;
varying vec2 vTexCoord;
uniform sampler2D uTexture;
uniform vec2 uTexel;

vec3 fetch(vec2 offset) {
  return texture2D(uTexture, vTexCoord + offset * uTexel).rgb;
}

float luma(vec3 c) {
  return dot(c, vec3(0.299, 0.587, 0.114));
}
`;

// One shared edge-directed blend, parameterized per filter:
//   threshold - how different two diagonal lumas must be before we treat
//               it as a real edge (lower = more eager to smooth)
//   strength  - how much of the diagonal-neighbor average to blend in
function edgeDirectedShader(threshold, strength) {
  return `
${FRAGMENT_HEADER}
void main() {
  vec3 center = fetch(vec2(0.0, 0.0));
  vec3 nw = fetch(vec2(-1.0, -1.0));
  vec3 ne = fetch(vec2(1.0, -1.0));
  vec3 sw = fetch(vec2(-1.0, 1.0));
  vec3 se = fetch(vec2(1.0, 1.0));
  vec3 n = fetch(vec2(0.0, -1.0));
  vec3 s = fetch(vec2(0.0, 1.0));
  vec3 w = fetch(vec2(-1.0, 0.0));
  vec3 e = fetch(vec2(1.0, 0.0));

  float dMain = abs(luma(nw) - luma(se));
  float dAnti = abs(luma(ne) - luma(sw));
  float threshold = ${threshold.toFixed(4)};
  float strength = ${strength.toFixed(4)};

  vec3 result = center;
  if (dMain + threshold < dAnti) {
    result = mix(center, (nw + se) * 0.5, strength);
  } else if (dAnti + threshold < dMain) {
    result = mix(center, (ne + sw) * 0.5, strength);
  } else {
    vec3 cross = (n + s + w + e) * 0.25;
    result = mix(center, cross, strength * 0.35);
  }

  gl_FragColor = vec4(result, 1.0);
}
`;
}

const FRAGMENT_SRC = {
  // Softest: leans hard into diagonal blending, closest to 2xSaI's
  // characteristic smooth, slightly blurry look.
  "2xsai": edgeDirectedShader(0.02, 0.85),
  // Middle ground: noticeable smoothing but keeps more definition.
  hq2x: edgeDirectedShader(0.05, 0.55),
  // Sharpest: only blends where the edge is unambiguous, otherwise leaves
  // pixels untouched — closest to xBR's crisp reconstructed edges.
  xbr: edgeDirectedShader(0.12, 0.4),
};

function compileShader(gl, type, source) {
  const shader = gl.createShader(type);
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    const info = gl.getShaderInfoLog(shader);
    gl.deleteShader(shader);
    throw new Error(`Shader compile error: ${info}`);
  }
  return shader;
}

function createProgram(gl, vertexSrc, fragmentSrc) {
  const program = gl.createProgram();
  const vertexShader = compileShader(gl, gl.VERTEX_SHADER, vertexSrc);
  const fragmentShader = compileShader(gl, gl.FRAGMENT_SHADER, fragmentSrc);
  gl.attachShader(program, vertexShader);
  gl.attachShader(program, fragmentShader);
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    const info = gl.getProgramInfoLog(program);
    gl.deleteProgram(program);
    throw new Error(`Program link error: ${info}`);
  }
  return program;
}

// Sets up a WebGL context on `outputCanvas` that renders `sourceCanvas`
// (the live Ruffle canvas) through the selected pixel filter every frame.
// Returns null if WebGL isn't available (caller should fall back to just
// showing the Ruffle canvas directly, i.e. behave like "original").
function createPixelFilterRenderer(outputCanvas) {
  const gl = outputCanvas.getContext("webgl") || outputCanvas.getContext("experimental-webgl");
  if (!gl) return null;

  const positionBuffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);

  const texture = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, texture);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);

  const programs = {};
  for (const [name, fragmentSrc] of Object.entries(FRAGMENT_SRC)) {
    const program = createProgram(gl, VERTEX_SRC, fragmentSrc);
    programs[name] = {
      program,
      aPosition: gl.getAttribLocation(program, "aPosition"),
      uTexture: gl.getUniformLocation(program, "uTexture"),
      uTexel: gl.getUniformLocation(program, "uTexel"),
    };
  }

  function render(sourceCanvas, filterName) {
    const locs = programs[filterName];
    if (!locs || !sourceCanvas.width || !sourceCanvas.height) return;

    const dpr = window.devicePixelRatio || 1;
    const displayWidth = Math.round(outputCanvas.clientWidth * dpr);
    const displayHeight = Math.round(outputCanvas.clientHeight * dpr);
    if (outputCanvas.width !== displayWidth || outputCanvas.height !== displayHeight) {
      outputCanvas.width = displayWidth;
      outputCanvas.height = displayHeight;
    }

    gl.viewport(0, 0, outputCanvas.width, outputCanvas.height);
    gl.useProgram(locs.program);

    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, sourceCanvas);

    gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
    gl.enableVertexAttribArray(locs.aPosition);
    gl.vertexAttribPointer(locs.aPosition, 2, gl.FLOAT, false, 0, 0);

    gl.uniform1i(locs.uTexture, 0);
    gl.uniform2f(locs.uTexel, 1 / sourceCanvas.width, 1 / sourceCanvas.height);

    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  }

  return { render };
}
