const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const css = (name) => getComputedStyle(document.documentElement).getPropertyValue(name).trim();
const MONO = '"Geist Mono", ui-monospace, Menlo, monospace';
const ink = (a) => `rgba(236, 235, 230, ${a})`;

function fitCanvas(canvas, onResize) {
  const view = { ctx: canvas.getContext("2d"), w: 0, h: 0 };
  new ResizeObserver(() => {
    const rect = canvas.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    view.w = rect.width;
    view.h = rect.height;
    canvas.width = Math.round(rect.width * dpr);
    canvas.height = Math.round(rect.height * dpr);
    view.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    onResize?.();
  }).observe(canvas);
  return view;
}

function whileVisible(el, frame) {
  let raf = 0;
  let last = 0;
  const loop = (now) => {
    const dt = Math.min((now - last) / 1000, 1 / 30);
    last = now;
    frame(dt, now / 1000);
    raf = requestAnimationFrame(loop);
  };
  new IntersectionObserver(([entry]) => {
    if (entry.isIntersecting && !raf) {
      last = performance.now();
      raf = requestAnimationFrame(loop);
    } else if (!entry.isIntersecting && raf) {
      cancelAnimationFrame(raf);
      raf = 0;
    }
  }).observe(el);
}

const easeOut = (t) => 1 - (1 - t) ** 3;

function trainXor(lr, epochs) {
  const sigmoid = (x) => 1 / (1 + Math.exp(-x));
  const X = [[0, 0], [0, 1], [1, 0], [1, 1]];
  const Y = [0, 1, 1, 0];
  const W1 = [[0.5, 0.2], [0.3, 0.8]];
  const b1 = [0, 0];
  const W2 = [0.6, 0.4];
  let b2 = 0;
  const losses = new Float32Array(epochs);

  for (let epoch = 0; epoch < epochs; epoch++) {
    let total = 0;
    for (let n = 0; n < 4; n++) {
      const [x0, x1] = X[n];
      const y = Y[n];
      const h0 = sigmoid(W1[0][0] * x0 + W1[0][1] * x1 + b1[0]);
      const h1 = sigmoid(W1[1][0] * x0 + W1[1][1] * x1 + b1[1]);
      const yHat = sigmoid(W2[0] * h0 + W2[1] * h1 + b2);

      const delta = 2 * (y - yHat) * yHat * (1 - yHat);
      const g0 = W2[0] * h0 * (1 - h0);
      const g1 = W2[1] * h1 * (1 - h1);
      W1[0][0] += lr * delta * g0 * x0;
      W1[0][1] += lr * delta * g0 * x1;
      W1[1][0] += lr * delta * g1 * x0;
      W1[1][1] += lr * delta * g1 * x1;
      b1[0] += lr * delta * g0;
      b1[1] += lr * delta * g1;
      W2[0] += lr * delta * h0;
      W2[1] += lr * delta * h1;
      b2 += lr * delta;

      total += (y - yHat) ** 2;
    }
    losses[epoch] = total;
  }
  return losses;
}

function lossChart(canvas) {
  const EPOCHS = 10000;
  const Y_MAX = 1.6;
  const CONVERGED = 0.05;
  const series = [
    { lr: 2, color: ink(0.32) },
    { lr: 0.1, color: ink(0.7) },
    { lr: 1, color: null },
  ];

  let ready = false;
  let progress = reduceMotion ? 1 : 0;
  const view = fitCanvas(canvas, () => ready && draw());

  function prepare() {
    for (const s of series) {
      s.data = trainXor(s.lr, EPOCHS);
      const hit = s.data.findIndex((v) => v < CONVERGED);
      s.note = hit >= 0
        ? `converges by epoch ${hit.toLocaleString("en-US")}`
        : `stalls at ${s.data[EPOCHS - 1].toFixed(2)}`;
    }
    ready = true;
  }

  function draw() {
    const { ctx, w, h } = view;
    const accent = css("--accent");
    const faint = css("--faint");
    const pad = { l: 34, r: 20, t: 96, b: 32 };
    const pw = w - pad.l - pad.r;
    const ph = h - pad.t - pad.b;
    const x = (e) => pad.l + (e / (EPOCHS - 1)) * pw;
    const y = (v) => pad.t + ph - (Math.min(v, Y_MAX) / Y_MAX) * ph;

    ctx.clearRect(0, 0, w, h);
    ctx.font = `11px ${MONO}`;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";

    [...series].reverse().forEach((s, i) => {
      const ly = 26 + i * 18;
      ctx.strokeStyle = s.color ?? accent;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(18, ly - 3.5);
      ctx.lineTo(32, ly - 3.5);
      ctx.stroke();
      ctx.fillStyle = s.color ? css("--text") : accent;
      const label = `η = ${s.lr}`;
      ctx.fillText(label, 40, ly);
      ctx.fillStyle = faint;
      ctx.fillText(s.note, 40 + ctx.measureText(label + "  ").width, ly);
    });

    ctx.lineWidth = 1;
    ctx.strokeStyle = ink(0.08);
    ctx.setLineDash([2, 4]);
    ctx.beginPath();
    ctx.moveTo(pad.l, Math.round(y(1)) + 0.5);
    ctx.lineTo(w - pad.r, Math.round(y(1)) + 0.5);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.strokeStyle = ink(0.16);
    ctx.beginPath();
    ctx.moveTo(pad.l, Math.round(y(0)) + 0.5);
    ctx.lineTo(w - pad.r, Math.round(y(0)) + 0.5);
    ctx.stroke();

    ctx.fillStyle = faint;
    ctx.textAlign = "right";
    ctx.textBaseline = "middle";
    ctx.fillText("1", pad.l - 10, y(1));
    ctx.fillText("0", pad.l - 10, y(0));
    ctx.textBaseline = "alphabetic";
    ctx.fillText("epochs →", w - pad.r, h - 10);
    ctx.textAlign = "left";
    ctx.fillText("loss", pad.l - 22, pad.t - 10);

    const columns = Math.max(2, Math.floor(pw / 1.5));
    const shown = Math.max(2, Math.ceil(columns * easeOut(progress)));
    for (const s of series) {
      ctx.strokeStyle = s.color ?? accent;
      ctx.lineWidth = s.color ? 1.5 : 2.25;
      ctx.beginPath();
      let px = 0;
      let py = 0;
      for (let i = 0; i < shown; i++) {
        const e = Math.round((i / (columns - 1)) * (EPOCHS - 1));
        px = x(e);
        py = y(s.data[e]);
        i ? ctx.lineTo(px, py) : ctx.moveTo(px, py);
      }
      ctx.stroke();
      if (progress < 1) {
        ctx.fillStyle = s.color ?? accent;
        ctx.beginPath();
        ctx.arc(px, py, 2.5, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  let done = false;
  whileVisible(canvas, (dt) => {
    if (!ready) prepare();
    if (done) return;
    progress = Math.min(1, progress + dt / 2.4);
    draw();
    done = progress >= 1;
  });
}

const mat4 = {
  multiply(a, b) {
    const out = new Float32Array(16);
    for (let c = 0; c < 4; c++) {
      for (let r = 0; r < 4; r++) {
        let sum = 0;
        for (let k = 0; k < 4; k++) sum += a[k * 4 + r] * b[c * 4 + k];
        out[c * 4 + r] = sum;
      }
    }
    return out;
  },
  perspective(fovy, aspect, near, far) {
    const f = 1 / Math.tan(fovy / 2);
    const nf = 1 / (near - far);
    return new Float32Array([f / aspect, 0, 0, 0, 0, f, 0, 0, 0, 0, (far + near) * nf, -1, 0, 0, 2 * far * near * nf, 0]);
  },
  lookAt(eye, center, up) {
    const f = vec3.normalize(vec3.sub(center, eye));
    const s = vec3.normalize(vec3.cross(f, up));
    const u = vec3.cross(s, f);
    return new Float32Array([
      s[0], u[0], -f[0], 0,
      s[1], u[1], -f[1], 0,
      s[2], u[2], -f[2], 0,
      -vec3.dot(s, eye), -vec3.dot(u, eye), vec3.dot(f, eye), 1,
    ]);
  },
  translation([x, y, z]) {
    return new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, x, y, z, 1]);
  },
  rotation(angle, axis) {
    const [x, y, z] = vec3.normalize(axis);
    const c = Math.cos(angle);
    const s = Math.sin(angle);
    const t = 1 - c;
    return new Float32Array([
      t * x * x + c, t * x * y + s * z, t * x * z - s * y, 0,
      t * x * y - s * z, t * y * y + c, t * y * z + s * x, 0,
      t * x * z + s * y, t * y * z - s * x, t * z * z + c, 0,
      0, 0, 0, 1,
    ]);
  },
};

const vec3 = {
  add: (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]],
  sub: (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]],
  scale: (a, k) => [a[0] * k, a[1] * k, a[2] * k],
  dot: (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2],
  cross: (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]],
  normalize: (a) => vec3.scale(a, 1 / Math.hypot(...a)),
};

function cubes(canvas) {
  const options = { antialias: true, alpha: false };
  const gl = canvas.getContext("webgl2", options) || canvas.getContext("webgl", options);
  const hint = canvas.parentElement.querySelector(".media-hint");
  if (!gl) {
    if (hint) hint.textContent = "WebGL isn't available in this browser";
    return;
  }
  const isGL2 = typeof WebGL2RenderingContext !== "undefined" && gl instanceof WebGL2RenderingContext;

  const compile = (type, src) => {
    const shader = gl.createShader(type);
    gl.shaderSource(shader, src);
    gl.compileShader(shader);
    return shader;
  };
  const program = gl.createProgram();
  gl.attachShader(program, compile(gl.VERTEX_SHADER, `
    attribute vec3 in_pos;
    attribute vec2 in_texCoords;
    varying vec2 texCoords;
    uniform mat4 model;
    uniform mat4 view;
    uniform mat4 projection;
    void main() {
      gl_Position = projection * view * model * vec4(in_pos, 1.0);
      texCoords = in_texCoords;
    }`));
  gl.attachShader(program, compile(gl.FRAGMENT_SHADER, `
    precision mediump float;
    varying vec2 texCoords;
    uniform sampler2D texture1;
    uniform sampler2D texture2;
    void main() {
      gl_FragColor = mix(texture2D(texture1, texCoords), texture2D(texture2, texCoords), 0.2);
    }`));
  gl.linkProgram(program);
  gl.useProgram(program);

  const vertices = new Float32Array([
    -0.5, -0.5, 0.5, 0, 0,   -0.5, 0.5, 0.5, 0, 1,   0.5, 0.5, 0.5, 1, 1,   0.5, -0.5, 0.5, 1, 0,
    -0.5, -0.5, -0.5, 0, 0,  -0.5, 0.5, -0.5, 0, 1,  0.5, 0.5, -0.5, 1, 1,  0.5, -0.5, -0.5, 1, 0,
    -0.5, 0.5, 0.5, 0, 0,    -0.5, 0.5, -0.5, 0, 1,  0.5, 0.5, -0.5, 1, 1,  0.5, 0.5, 0.5, 1, 0,
    -0.5, -0.5, 0.5, 0, 0,   -0.5, -0.5, -0.5, 0, 1, 0.5, -0.5, -0.5, 1, 1, 0.5, -0.5, 0.5, 1, 0,
    -0.5, 0.5, 0.5, 1, 1,    -0.5, -0.5, 0.5, 1, 0,  -0.5, -0.5, -0.5, 0, 0, -0.5, 0.5, -0.5, 0, 1,
    0.5, 0.5, 0.5, 1, 1,     0.5, -0.5, 0.5, 1, 0,   0.5, -0.5, -0.5, 0, 0,  0.5, 0.5, -0.5, 0, 1,
  ]);
  const indices = new Uint16Array([
    0, 1, 3, 1, 2, 3,   4, 5, 7, 5, 6, 7,   8, 9, 11, 9, 10, 11,
    12, 13, 15, 13, 14, 15,   16, 17, 18, 16, 18, 19,   20, 21, 22, 20, 22, 23,
  ]);
  const cubePositions = [
    [-2.0, 0.0, -20.0], [3.5, 1.5, -7.0], [-3.5, -1.5, -8.0], [2.5, -1.0, -6.0], [-2.5, 1.0, -9.0],
    [1.0, 2.0, -5.5], [4.0, 0.0, -10.0], [-4.0, 0.5, -6.5], [1.5, -2.0, -7.5], [-1.5, -0.5, -45.0],
  ];

  gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
  gl.bufferData(gl.ARRAY_BUFFER, vertices, gl.STATIC_DRAW);
  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, gl.createBuffer());
  gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, indices, gl.STATIC_DRAW);
  const aPos = gl.getAttribLocation(program, "in_pos");
  const aUv = gl.getAttribLocation(program, "in_texCoords");
  gl.enableVertexAttribArray(aPos);
  gl.vertexAttribPointer(aPos, 3, gl.FLOAT, false, 20, 0);
  gl.enableVertexAttribArray(aUv);
  gl.vertexAttribPointer(aUv, 2, gl.FLOAT, false, 20, 12);

  const uniform = (name) => gl.getUniformLocation(program, name);
  const uModel = uniform("model");
  const uView = uniform("view");
  const uProjection = uniform("projection");
  gl.uniform1i(uniform("texture1"), 0);
  gl.uniform1i(uniform("texture2"), 1);

  function loadTexture(unit, url, flipVertically) {
    const texture = gl.createTexture();
    gl.activeTexture(gl.TEXTURE0 + unit);
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array([40, 40, 52, 255]));
    const image = new Image();
    image.onload = () => {
      gl.activeTexture(gl.TEXTURE0 + unit);
      gl.bindTexture(gl.TEXTURE_2D, texture);
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, flipVertically);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image);
      if (isGL2) {
        gl.generateMipmap(gl.TEXTURE_2D);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
      } else {
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      }
    };
    image.src = url;
  }
  loadTexture(0, "assets/brick.jpg", false);
  loadTexture(1, "assets/smiley.png", true);

  gl.enable(gl.DEPTH_TEST);

  const camera = { pos: [0, 0, 3], yaw: -90, pitch: 0 };
  const resetCamera = () => Object.assign(camera, { pos: [0, 0, 3], yaw: -90, pitch: 0 });
  const basis = () => {
    const yaw = (camera.yaw * Math.PI) / 180;
    const pitch = (camera.pitch * Math.PI) / 180;
    const front = vec3.normalize([Math.cos(yaw) * Math.cos(pitch), Math.sin(pitch), Math.sin(yaw) * Math.cos(pitch)]);
    const right = vec3.normalize(vec3.cross(front, [0, 1, 0]));
    const up = vec3.normalize(vec3.cross(right, front));
    return { front, right, up };
  };

  const hideHint = () => hint?.classList.add("is-hidden");
  let dragging = false;
  let lastX = 0;
  let lastY = 0;
  canvas.addEventListener("pointerdown", (e) => {
    dragging = true;
    lastX = e.clientX;
    lastY = e.clientY;
    canvas.setPointerCapture(e.pointerId);
    hideHint();
  });
  canvas.addEventListener("pointermove", (e) => {
    if (!dragging) return;
    const sensitivity = 0.25;
    camera.yaw += (e.clientX - lastX) * sensitivity;
    camera.pitch = Math.max(-89.9, Math.min(89.9, camera.pitch + (lastY - e.clientY) * sensitivity));
    lastX = e.clientX;
    lastY = e.clientY;
  });
  const release = () => (dragging = false);
  canvas.addEventListener("pointerup", release);
  canvas.addEventListener("pointercancel", release);
  canvas.addEventListener("dblclick", resetCamera);

  const keys = new Set();
  canvas.addEventListener("keydown", (e) => {
    const key = e.key.toLowerCase();
    if ("wasd".includes(key) && key.length === 1) {
      keys.add(key);
      e.preventDefault();
      hideHint();
    }
  });
  canvas.addEventListener("keyup", (e) => keys.delete(e.key.toLowerCase()));
  canvas.addEventListener("blur", () => keys.clear());

  new ResizeObserver(() => {
    const rect = canvas.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(rect.width * dpr);
    canvas.height = Math.round(rect.height * dpr);
  }).observe(canvas);

  const start = performance.now() / 1000;
  const axis = [0.5, 1.0, 0.0];
  whileVisible(canvas, (dt, now) => {
    const { front, right, up } = basis();
    const speed = 8 * dt;
    if (keys.has("w")) camera.pos = vec3.add(camera.pos, vec3.scale(front, speed));
    if (keys.has("s")) camera.pos = vec3.sub(camera.pos, vec3.scale(front, speed));
    if (keys.has("a")) camera.pos = vec3.sub(camera.pos, vec3.scale(right, speed));
    if (keys.has("d")) camera.pos = vec3.add(camera.pos, vec3.scale(right, speed));

    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.clearColor(0.075, 0.075, 0.085, 1);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    gl.uniformMatrix4fv(uProjection, false, mat4.perspective((45 * Math.PI) / 180, canvas.width / canvas.height, 0.1, 100));
    gl.uniformMatrix4fv(uView, false, mat4.lookAt(camera.pos, vec3.add(camera.pos, front), up));

    const time = reduceMotion ? 0 : now - start;
    cubePositions.forEach((position, i) => {
      const angle = ((time * 50 + 20 * i) * Math.PI) / 180;
      gl.uniformMatrix4fv(uModel, false, mat4.multiply(mat4.translation(position), mat4.rotation(angle, axis)));
      gl.drawElements(gl.TRIANGLES, 36, gl.UNSIGNED_SHORT, 0);
    });
  });
}

function pendulum(canvas) {
  const GRAVITY = 1000;
  const DAMPING = 0.1;
  const LENGTH = 300;

  let pos = LENGTH * (Math.PI / 4);
  let velocity = 0;
  let playing = !reduceMotion;
  let dragging = false;
  const trail = [];

  const view = fitCanvas(canvas, draw);
  const SCALE_DEG = 45;
  const MAX_SWING_DEG = 70;
  const BOB = 14;
  const layout = () => {
    const ay = 20;
    const half = view.w / 2 - BOB - 6;
    const fitScale = (view.w / 2 - 22) / Math.sin((SCALE_DEG * Math.PI) / 180) - 33;
    const fitSwing = half / Math.sin((MAX_SWING_DEG * Math.PI) / 180);
    const r = Math.max(100, Math.min(view.h - ay - 76, fitScale, fitSwing));
    const limit = Math.min(Math.PI / 2, Math.asin(Math.min(1, Math.max(0, half) / r)));
    return { ax: view.w / 2, ay, r, limit };
  };

  function update(dt) {
    if (!playing || dragging) return;
    const steps = 4;
    const h = dt / steps;
    for (let i = 0; i < steps; i++) {
      const theta = pos / LENGTH;
      const acceleration = -GRAVITY * Math.sin(theta);
      velocity += acceleration * h;
      velocity -= velocity * DAMPING * h;
      pos += velocity * h;
    }
    trail.push(pos / LENGTH);
    if (trail.length > 26) trail.shift();
  }

  function draw() {
    const { ctx, w, h } = view;
    const { ax, ay, r } = layout();
    const theta = pos / LENGTH;
    const accent = css("--accent");

    ctx.clearRect(0, 0, w, h);
    ctx.lineCap = "round";

    ctx.strokeStyle = ink(0.22);
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(ax - 26, ay);
    ctx.lineTo(ax + 26, ay);
    ctx.stroke();

    const R = r + 24;
    for (let deg = -SCALE_DEG; deg <= SCALE_DEG; deg += 5) {
      const a = (deg * Math.PI) / 180;
      const major = deg % 15 === 0;
      const len = major ? 9 : 4;
      ctx.strokeStyle = major ? ink(0.26) : ink(0.12);
      ctx.beginPath();
      ctx.moveTo(ax + R * Math.sin(a), ay + R * Math.cos(a));
      ctx.lineTo(ax + (R + len) * Math.sin(a), ay + (R + len) * Math.cos(a));
      ctx.stroke();
    }

    ctx.lineWidth = 2;
    for (let i = 1; i < trail.length; i++) {
      ctx.strokeStyle = `rgba(255, 90, 54, ${(i / trail.length) * 0.5})`;
      ctx.beginPath();
      ctx.moveTo(ax + r * Math.sin(trail[i - 1]), ay + r * Math.cos(trail[i - 1]));
      ctx.lineTo(ax + r * Math.sin(trail[i]), ay + r * Math.cos(trail[i]));
      ctx.stroke();
    }

    const bx = ax + r * Math.sin(theta);
    const by = ay + r * Math.cos(theta);

    ctx.strokeStyle = ink(0.75);
    ctx.lineWidth = 1.25;
    ctx.beginPath();
    ctx.moveTo(ax, ay);
    ctx.lineTo(bx, by);
    ctx.stroke();

    ctx.fillStyle = css("--text");
    ctx.beginPath();
    ctx.arc(ax, ay, 3.5, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = accent;
    ctx.beginPath();
    ctx.arc(bx, by, BOB, 0, Math.PI * 2);
    ctx.fill();

    const deg = ((theta * 180) / Math.PI).toFixed(1);
    const omega = (velocity / LENGTH).toFixed(2);
    ctx.font = `11px ${MONO}`;
    ctx.fillStyle = css("--faint");
    ctx.textAlign = "center";
    ctx.fillText(`θ ${deg}°   ω ${omega} rad/s`, ax, Math.min(h - 8, ay + R + 46));
    ctx.textAlign = "left";
  }

  function setAngle(theta) {
    const { limit } = layout();
    pos = Math.max(-limit, Math.min(limit, theta)) * LENGTH;
    velocity = 0;
    trail.length = 0;
  }

  function fromPointer(e) {
    const rect = canvas.getBoundingClientRect();
    const { ax, ay } = layout();
    setAngle(Math.atan2(e.clientX - rect.left - ax, e.clientY - rect.top - ay));
    draw();
  }

  canvas.addEventListener("pointerdown", (e) => {
    dragging = true;
    canvas.setPointerCapture(e.pointerId);
    fromPointer(e);
  });
  canvas.addEventListener("pointermove", (e) => dragging && fromPointer(e));
  const release = () => {
    if (!dragging) return;
    dragging = false;
    playing = true;
  };
  canvas.addEventListener("pointerup", release);
  canvas.addEventListener("pointercancel", release);

  canvas.addEventListener("keydown", (e) => {
    const step = { ArrowLeft: 0.2, ArrowRight: -0.2 }[e.key];
    if (step === undefined) return;
    e.preventDefault();
    setAngle(pos / LENGTH + step);
    playing = true;
  });

  whileVisible(canvas, (dt) => {
    update(dt);
    draw();
  });
}

document.querySelectorAll("[data-copy]").forEach((btn) => {
  btn.addEventListener("click", async () => {
    try {
      await navigator.clipboard.writeText(btn.dataset.copy);
      btn.textContent = "Copied";
    } catch {
      getSelection().selectAllChildren(btn.previousElementSibling);
      btn.textContent = "Press ⌘C";
    }
    setTimeout(() => (btn.textContent = "Copy"), 1800);
  });
});

document.querySelectorAll("video[data-autoplay]").forEach((video) => {
  const toggle = video.parentElement.querySelector("[data-video-toggle]");
  let userPaused = reduceMotion;

  const sync = () => {
    toggle.classList.toggle("is-paused", video.paused);
    toggle.setAttribute("aria-label", video.paused ? "Play video" : "Pause video");
  };
  const play = () => video.play().catch(() => {}).finally(sync);

  toggle.addEventListener("click", () => {
    userPaused = !video.paused;
    userPaused ? video.pause() : play();
  });
  video.addEventListener("play", sync);
  video.addEventListener("pause", sync);

  new IntersectionObserver(([entry]) => {
    if (entry.isIntersecting && !userPaused) play();
    else if (!entry.isIntersecting) video.pause();
  }, { threshold: 0.2 }).observe(video);
  sync();
});

function gallery(root) {
  const track = root.querySelector("[data-gallery-track]");
  const slides = [...track.children];
  const count = root.querySelector("[data-gallery-count]");
  const caption = root.querySelector("[data-gallery-caption]");
  const prev = root.querySelector("[data-gallery-prev]");
  const next = root.querySelector("[data-gallery-next]");
  let index = 0;

  const render = () => {
    count.textContent = `${index + 1} / ${slides.length}`;
    caption.textContent = slides[index].dataset.caption;
    prev.disabled = index === 0;
    next.disabled = index === slides.length - 1;
  };
  const nearest = () => {
    const at = track.scrollLeft;
    let best = 0;
    slides.forEach((slide, i) => {
      if (Math.abs(slide.offsetLeft - track.offsetLeft - at) < Math.abs(slides[best].offsetLeft - track.offsetLeft - at)) best = i;
    });
    return best;
  };
  const go = (i) => {
    const target = slides[Math.max(0, Math.min(slides.length - 1, i))];
    track.scrollTo({ left: target.offsetLeft - track.offsetLeft, behavior: reduceMotion ? "auto" : "smooth" });
  };

  prev.addEventListener("click", () => go(nearest() - 1));
  next.addEventListener("click", () => go(nearest() + 1));
  track.addEventListener("keydown", (e) => {
    if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
    e.preventDefault();
    go(nearest() + (e.key === "ArrowRight" ? 1 : -1));
  });
  track.addEventListener("scroll", () => {
    const i = track.scrollLeft + track.clientWidth >= track.scrollWidth - 2 ? slides.length - 1 : nearest();
    if (i !== index) { index = i; render(); }
  }, { passive: true });
  render();
}
document.querySelectorAll("[data-gallery]").forEach(gallery);

// The live experiments start only when they are about to scroll into view.
function whenNear(selector, start) {
  const el = document.querySelector(selector);
  if (!el) return;
  const observer = new IntersectionObserver(([entry]) => {
    if (!entry.isIntersecting) return;
    observer.disconnect();
    start(el);
  }, { rootMargin: "400px 0px" });
  observer.observe(el);
}
whenNear("[data-cubes]", cubes);
whenNear("[data-loss-chart]", lossChart);
whenNear("[data-pendulum]", pendulum);

document.querySelectorAll(".demo canvas").forEach((canvas) => {
  canvas.addEventListener("pointerdown", () => {
    canvas.parentElement.querySelector(".media-hint")?.classList.add("is-hidden");
  }, { once: true });
});

/* ---------- the loss surface ---------- */

// The page is a loss surface. Every project is a minimum on it, and the dot is an optimizer:
// gradient descent with momentum, the same update rule as the paper under "Gradient Descent, by Hand".
function landscape(stage) {
  const base = stage.querySelector("[data-map-base]");
  const over = stage.querySelector("[data-map-over]");
  const bctx = base.getContext("2d");
  const octx = over.getContext("2d");
  const readout = stage.querySelector("[data-readout]");
  const status = stage.querySelector("[data-status]");
  const labels = new Map([...stage.querySelectorAll("[data-min]")].map((el) => [el.dataset.min, el]));
  const indexLinks = new Map([...stage.querySelectorAll("[data-index]")].map((el) => [el.dataset.index, el]));
  const lossCells = new Map([...stage.querySelectorAll("[data-loss-for]")].map((el) => [el.dataset.lossFor, el]));

  // Positions are fractions of the screen. a is the depth of the well, s its width,
  // c a faint long-range pull so the surface always slopes toward something.
  const SITES = [
    { id: "cadence",  name: "Cadence",                   wide: [0.30, 0.50], tall: [0.36, 0.37], a: 0.14, s: 0.125, c: 0.012 },
    { id: "delphi",   name: "Delphi",                    wide: [0.585, 0.36], tall: [0.66, 0.52], a: 0.105, s: 0.115, c: 0.012 },
    { id: "pytorch",  name: "From scratch, in PyTorch",  wide: [0.845, 0.53], tall: [0.78, 0.275], a: 0.05, s: 0.06, c: 0.012 },
    { id: "opengl",   name: "First OpenGL",              wide: [0.185, 0.82], tall: [0.24, 0.64], a: 0.05, s: 0.06, c: 0.012 },
    { id: "gradient", name: "Gradient Descent, by Hand", wide: [0.47, 0.80], tall: [0.72, 0.72], a: 0.05, s: 0.06, c: 0.012 },
    { id: "pendulum", name: "Swinging Pendulum",         wide: [0.725, 0.76], tall: [0.30, 0.82], a: 0.05, s: 0.06, c: 0.012 },
    { id: "about",    name: "About",                     wide: [0.075, 0.34], tall: [0.14, 0.215], a: -0.05, s: 0.08, c: 0, hill: true },
  ];
  const RIPPLE = 0.008;
  const ETA = 0.0016;      // learning rate
  const MU = 0.94;         // momentum
  const PULL = 0.55;       // extra quadratic term when a project is picked from the index

  let W = 0, H = 0, S = 1;
  let sites = [];
  let fLow = 0, fHigh = 1;
  const g = { x: 0, y: 0 };

  function f(x, y) {
    let v = 0;
    for (const p of sites) {
      const dx = x - p.x, dy = y - p.y;
      const r2 = dx * dx + dy * dy;
      v += -p.a / (1 + r2 / p.s2) + p.c * Math.log(p.s2 + r2);
    }
    return v + RIPPLE * (Math.sin(3.1 * x + 1.7) * Math.cos(2.3 * y + 0.4) + 0.5 * Math.sin(5.3 * x - 2.2 * y + 0.9));
  }
  function grad(x, y) {
    let gx = 0, gy = 0;
    for (const p of sites) {
      const dx = x - p.x, dy = y - p.y;
      const r2 = dx * dx + dy * dy;
      const q = 1 + r2 / p.s2;
      const k = (2 * p.a) / (p.s2 * q * q) + (2 * p.c) / (p.s2 + r2);
      gx += k * dx;
      gy += k * dy;
    }
    const c = Math.cos(5.3 * x - 2.2 * y + 0.9);
    g.x = gx + RIPPLE * (3.1 * Math.cos(3.1 * x + 1.7) * Math.cos(2.3 * y + 0.4) + 2.65 * c);
    g.y = gy + RIPPLE * (-2.3 * Math.sin(3.1 * x + 1.7) * Math.sin(2.3 * y + 0.4) - 1.1 * c);
  }
  const loss = (x, y) => Math.max(0, Math.min(1, (f(x, y) - fLow) / (fHigh - fLow)));

  // optimizer state, in surface units (pixels / S)
  const opt = { x: 0, y: 0, vx: 0, vy: 0, n: 0 };
  let pull = null;
  let trail = [];
  let preview = null;
  let current = null;
  let hot = null;
  let running = false;
  let raf = 0;
  let last = 0;
  let carry = 0;
  let onSettle = null;

  function stepOnce(o, target) {
    grad(o.x, o.y);
    let gx = g.x, gy = g.y;
    if (target) {
      gx += PULL * (o.x - target.mx);
      gy += PULL * (o.y - target.my);
    }
    o.vx = MU * o.vx - ETA * gx;
    o.vy = MU * o.vy - ETA * gy;
    o.x = Math.max(0, Math.min(W / S, o.x + o.vx));
    o.y = Math.max(0, Math.min(H / S, o.y + o.vy));
    o.n++;
    return Math.hypot(o.vx, o.vy) < 1.2e-5 && Math.hypot(gx, gy) < 0.02;
  }

  const nearest = (x, y) => {
    let best = null, d = 0.05;
    for (const p of sites) {
      const r = Math.hypot(x - p.mx, y - p.my);
      if (!p.hill && r < d) { best = p; d = r; }
    }
    return best;
  };

  function layout() {
    const rect = stage.getBoundingClientRect();
    W = rect.width;
    H = rect.height;
    S = Math.min(W, H);
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    for (const canvas of [base, over]) {
      canvas.width = Math.round(W * dpr);
      canvas.height = Math.round(H * dpr);
      canvas.getContext("2d").setTransform(dpr, 0, 0, dpr, 0, 0);
    }

    const key = W < 760 || H > W * 1.15 ? "tall" : "wide";
    sites = SITES.map((d) => ({ ...d, x: (d[key][0] * W) / S, y: (d[key][1] * H) / S, s2: d.s * d.s }));

    // where each well really bottoms out, once its neighbours have tugged on it
    for (const p of sites) {
      let x = p.x, y = p.y;
      if (!p.hill) {
        for (let i = 0; i < 700; i++) {
          grad(x, y);
          x -= 0.02 * g.x;
          y -= 0.02 * g.y;
        }
      }
      p.mx = x;
      p.my = y;
    }

    drawContours();

    fLow = Math.min(...sites.filter((p) => !p.hill).map((p) => f(p.mx, p.my)));
    for (const p of sites) {
      const el = labels.get(p.id);
      const px = p.mx * S, py = p.my * S;
      el.style.transform = `translate(${px.toFixed(1)}px, ${py.toFixed(1)}px)`;
      const flip = px > W * (key === "tall" ? 0.5 : 0.7);
      el.classList.toggle("is-left", flip);
      if (flip) el.style.transform += " translateX(-100%)";
      el.classList.add("is-placed");
      const cell = lossCells.get(p.id);
      if (cell) cell.textContent = loss(p.mx, p.my).toFixed(3);
    }
  }

  function drawContours() {
    const cell = 6;
    const cols = Math.ceil(W / cell) + 1;
    const rows = Math.ceil(H / cell) + 1;
    const vals = new Float32Array(cols * rows);
    let lo = Infinity, hi = -Infinity;
    for (let j = 0; j < rows; j++) {
      for (let i = 0; i < cols; i++) {
        const v = f((i * cell) / S, (j * cell) / S);
        vals[j * cols + i] = v;
        if (v < lo) lo = v;
        if (v > hi) hi = v;
      }
    }
    fHigh = hi;

    const LEVELS = 26;
    bctx.clearRect(0, 0, W, H);
    bctx.lineWidth = 1;
    for (let k = 0; k < LEVELS; k++) {
      const L = lo + ((k + 0.5) / LEVELS) * (hi - lo);
      const depth = 1 - k / (LEVELS - 1);
      bctx.strokeStyle = ink((k % 5 === 2 ? 0.2 : 0.085) + depth * 0.1);
      bctx.beginPath();
      for (let j = 0; j < rows - 1; j++) {
        for (let i = 0; i < cols - 1; i++) {
          const a = vals[j * cols + i], b = vals[j * cols + i + 1];
          const c = vals[(j + 1) * cols + i + 1], d = vals[(j + 1) * cols + i];
          const idx = (a > L ? 8 : 0) | (b > L ? 4 : 0) | (c > L ? 2 : 0) | (d > L ? 1 : 0);
          if (idx === 0 || idx === 15) continue;
          const x0 = i * cell, y0 = j * cell;
          const tx = x0 + ((L - a) / (b - a)) * cell;         // top edge
          const ry = y0 + ((L - b) / (c - b)) * cell;         // right edge
          const bx = x0 + ((L - d) / (c - d)) * cell;         // bottom edge
          const ly = y0 + ((L - a) / (d - a)) * cell;         // left edge
          const x1 = x0 + cell, y1 = y0 + cell;
          switch (idx) {
            case 1: case 14: bctx.moveTo(x0, ly); bctx.lineTo(bx, y1); break;
            case 2: case 13: bctx.moveTo(bx, y1); bctx.lineTo(x1, ry); break;
            case 3: case 12: bctx.moveTo(x0, ly); bctx.lineTo(x1, ry); break;
            case 4: case 11: bctx.moveTo(tx, y0); bctx.lineTo(x1, ry); break;
            case 6: case 9: bctx.moveTo(tx, y0); bctx.lineTo(bx, y1); break;
            case 7: case 8: bctx.moveTo(tx, y0); bctx.lineTo(x0, ly); break;
            case 5: bctx.moveTo(tx, y0); bctx.lineTo(x0, ly); bctx.moveTo(bx, y1); bctx.lineTo(x1, ry); break;
            case 10: bctx.moveTo(tx, y0); bctx.lineTo(x1, ry); bctx.moveTo(x0, ly); bctx.lineTo(bx, y1); break;
          }
        }
      }
      bctx.stroke();
    }
  }

  function render() {
    octx.clearRect(0, 0, W, H);
    octx.lineCap = "round";
    octx.lineJoin = "round";

    if (preview && preview.length > 1) {
      octx.strokeStyle = ink(0.34);
      octx.lineWidth = 1;
      octx.setLineDash([2, 5]);
      octx.beginPath();
      preview.forEach(([x, y], i) => (i ? octx.lineTo(x * S, y * S) : octx.moveTo(x * S, y * S)));
      octx.stroke();
      octx.setLineDash([]);
    }

    octx.lineWidth = 1.5;
    for (let i = 1; i < trail.length; i++) {
      octx.strokeStyle = `rgba(255, 90, 54, ${(i / trail.length) * 0.75})`;
      octx.beginPath();
      octx.moveTo(trail[i - 1][0] * S, trail[i - 1][1] * S);
      octx.lineTo(trail[i][0] * S, trail[i][1] * S);
      octx.stroke();
    }

    const x = opt.x * S, y = opt.y * S;
    octx.fillStyle = "rgba(255, 90, 54, 0.16)";
    octx.beginPath();
    octx.arc(x, y, 11, 0, Math.PI * 2);
    octx.fill();
    octx.fillStyle = css("--accent");
    octx.beginPath();
    octx.arc(x, y, 4.5, 0, Math.PI * 2);
    octx.fill();

    readout.textContent = `loss ${loss(opt.x, opt.y).toFixed(3)} · step ${opt.n}`;
  }

  function mark(id) {
    current = id;
    for (const [key, el] of labels) el.classList.toggle("is-current", key === id);
    for (const [key, el] of indexLinks) el.classList.toggle("is-current", key === id);
  }
  function setHot(id) {
    if (hot === id) return;
    hot = id;
    for (const [key, el] of labels) el.classList.toggle("is-hot", key === id);
    for (const [key, el] of indexLinks) el.classList.toggle("is-hot", key === id);
  }

  function settle() {
    running = false;
    raf = 0;
    opt.vx = opt.vy = 0;
    const site = pull || nearest(opt.x, opt.y);
    pull = null;
    if (site) {
      mark(site.id);
      status.textContent = site.hill ? "Back at the initial weights." : `Converged at ${site.name}.`;
    } else {
      mark(null);
      status.textContent = "Stuck on a plateau. Drop it somewhere else.";
    }
    render();
    const done = onSettle;
    onSettle = null;
    done?.(site);
  }

  function frame(now) {
    carry += Math.min(0.05, (now - last) / 1000) * 60;
    last = now;
    let steps = Math.floor(carry);
    carry -= steps;
    let done = false;
    while (steps-- > 0 && !done) {
      done = stepOnce(opt, pull) || opt.n > 2400;
      if (opt.n % 2 === 0) trail.push([opt.x, opt.y]);
    }
    if (trail.length > 900) trail.splice(0, trail.length - 900);
    if (done) return settle();
    render();
    raf = requestAnimationFrame(frame);
  }
  function run() {
    status.textContent = "Descending";
    mark(null);
    if (reduceMotion) {
      for (let i = 0; i < 2400 && !stepOnce(opt, pull); i++) if (i % 2 === 0) trail.push([opt.x, opt.y]);
      return settle();
    }
    running = true;
    if (!raf) {
      last = performance.now();
      carry = 0;
      raf = requestAnimationFrame(frame);
    }
  }

  function drop(x, y) {
    Object.assign(opt, { x, y, vx: 0, vy: 0, n: 0 });
    trail = [[x, y]];
    pull = null;
    preview = null;
    run();
  }

  // where would the optimizer end up from here? same rule, run ahead of time
  function forecast(x, y) {
    const o = { x, y, vx: 0, vy: 0, n: 0 };
    const path = [[x, y]];
    for (let i = 0; i < 1400; i++) {
      const done = stepOnce(o, null);
      if (i % 3 === 0) path.push([o.x, o.y]);
      if (done) break;
    }
    return { path, site: nearest(o.x, o.y) };
  }

  const point = (e) => {
    const rect = over.getBoundingClientRect();
    return [(e.clientX - rect.left) / S, (e.clientY - rect.top) / S];
  };
  let pendingMove = null;
  over.addEventListener("pointermove", (e) => {
    if (e.pointerType !== "mouse") return;
    pendingMove = point(e);
    requestAnimationFrame(() => {
      if (!pendingMove) return;
      const result = forecast(...pendingMove);
      pendingMove = null;
      preview = result.path;
      setHot(result.site?.id ?? null);
      if (!running) render();
    });
  });
  over.addEventListener("pointerleave", () => {
    pendingMove = null;
    preview = null;
    setHot(null);
    if (!running) render();
  });
  over.addEventListener("click", (e) => drop(...point(e)));

  for (const [id, el] of [...labels, ...indexLinks]) {
    el.addEventListener("pointerenter", () => setHot(id));
    el.addEventListener("pointerleave", () => setHot(null));
  }

  function place(id) {
    const site = sites.find((p) => p.id === id);
    Object.assign(opt, { x: site.mx, y: site.my, vx: 0, vy: 0 });
    trail = [];
    pull = null;
    mark(id);
    status.textContent = site.hill ? "At the initial weights." : `Converged at ${site.name}.`;
    render();
  }

  function goTo(id, instant) {
    const site = sites.find((p) => p.id === id);
    if (!site) return;
    if (raf) cancelAnimationFrame(raf);
    raf = 0;
    running = false;
    if (instant || reduceMotion || site.hill || Math.hypot(opt.x - site.mx, opt.y - site.my) < 0.01) return place(id);
    pull = site;
    trail = [[opt.x, opt.y]];
    opt.n = 0;
    preview = null;
    run();
  }

  layout();
  let resizeTimer = 0;
  window.addEventListener("resize", () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
      if (raf) cancelAnimationFrame(raf);
      raf = 0;
      running = false;
      const resting = pull?.id || current || nearest(opt.x, opt.y)?.id || "cadence";
      layout();
      place(resting);
    }, 120);
  });

  return {
    goTo,
    lossOf: (id) => {
      const site = sites.find((p) => p.id === id);
      return site ? loss(site.mx, site.my) : 0;
    },
    // first visit: start on the hill and roll downhill from the initial weights
    begin(openId) {
      if (openId) return place(openId);
      const start = sites.find((p) => p.hill);
      const toward = sites[0];
      const d = Math.hypot(toward.mx - start.mx, toward.my - start.my);
      place("about");
      if (reduceMotion) return;
      setTimeout(() => {
        drop(start.mx + ((toward.mx - start.mx) / d) * 0.03, start.my + ((toward.my - start.my) / d) * 0.03);
      }, 500);
    },
  };
}

/* ---------- project sheets ---------- */

function sheets(map) {
  const host = document.querySelector("[data-sheets]");
  const stage = document.querySelector("[data-stage]");
  const scrim = document.querySelector("[data-scrim]");
  const closeBtn = host.querySelector("[data-close]");
  const lossLabel = host.querySelector("[data-sheet-loss]");
  const pages = new Map([...host.querySelectorAll(".sheet")].map((el) => [el.id, el]));
  let opener = null;

  function show(id, instant) {
    for (const [key, el] of pages) el.classList.toggle("is-active", key === id);
    lossLabel.textContent = id === "about" ? "initial weights" : `loss ${map.lossOf(id).toFixed(3)}`;
    document.body.classList.add("has-sheet");
    host.inert = false;
    stage.inert = true;
    host.scrollTop = 0;
    map.goTo(id, instant);
    closeBtn.focus({ preventScroll: true });
  }
  function hide() {
    document.body.classList.remove("has-sheet");
    host.inert = true;
    stage.inert = false;
    opener?.focus?.({ preventScroll: true });
    opener = null;
  }
  const idFromHash = () => {
    const id = location.hash.slice(1);
    return pages.has(id) ? id : null;
  };
  const close = () => {
    if (!document.body.classList.contains("has-sheet")) return;
    history.pushState(null, "", location.pathname + location.search);
    hide();
  };

  document.addEventListener("click", (e) => {
    const link = e.target.closest('a[href^="#"]');
    if (!link) return;
    const id = link.getAttribute("href").slice(1);
    if (!pages.has(id)) return;
    e.preventDefault();
    if (!document.body.classList.contains("has-sheet")) opener = link;
    if (idFromHash() !== id) history.pushState(null, "", `#${id}`);
    show(id, false);
  });
  window.addEventListener("popstate", () => {
    const id = idFromHash();
    id ? show(id, true) : hide();
  });
  closeBtn.addEventListener("click", close);
  scrim.addEventListener("click", close);
  document.addEventListener("keydown", (e) => e.key === "Escape" && close());

  host.inert = true;
  const first = idFromHash();
  map.begin(first);
  if (first) show(first, true);
}

const stage = document.querySelector("[data-stage]");
if (stage) {
  const start = () => sheets(landscape(stage));
  document.fonts?.ready ? document.fonts.ready.then(start) : start();
}
