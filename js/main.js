const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const css = (name) => getComputedStyle(document.documentElement).getPropertyValue(name).trim();
const MONO = '"Fragment Mono", ui-monospace, Menlo, monospace';

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

function animateOnce(el, duration, frame) {
  if (reduceMotion) return;
  const observer = new IntersectionObserver(([entry]) => {
    if (!entry.isIntersecting) return;
    observer.disconnect();
    const start = performance.now();
    const tick = (now) => {
      const p = Math.min(1, (now - start) / duration);
      frame(p);
      if (p < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }, { threshold: 0.3 });
  observer.observe(el);
}

const nav = document.querySelector("[data-nav]");
const onScroll = () => nav.classList.toggle("is-scrolled", window.scrollY > 8);
window.addEventListener("scroll", onScroll, { passive: true });
onScroll();

const clock = document.querySelector("[data-clock]");
if (clock) {
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Edmonton",
    hour: "numeric",
    minute: "2-digit",
  });
  const tick = () => (clock.textContent = `Calgary, AB · ${fmt.format(new Date())}`);
  tick();
  setInterval(tick, 10_000);
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

const revealer = new IntersectionObserver((entries) => {
  for (const entry of entries) {
    if (!entry.isIntersecting) continue;
    entry.target.classList.add("is-in");
    revealer.unobserve(entry.target);
  }
}, { threshold: 0.12, rootMargin: "0px 0px -40px 0px" });
document.querySelectorAll("[data-reveal]").forEach((el) => revealer.observe(el));

document.querySelectorAll("video[data-autoplay]").forEach((video) => {
  const toggle = video.parentElement.querySelector("[data-video-toggle]");
  let userPaused = reduceMotion;

  const sync = () => {
    if (!toggle) return;
    toggle.classList.toggle("is-paused", video.paused);
    toggle.setAttribute("aria-label", video.paused ? "Play video" : "Pause video");
  };
  const play = () => video.play().catch(() => {}).finally(sync);

  if (toggle) {
    toggle.addEventListener("click", () => {
      userPaused = !video.paused;
      userPaused ? video.pause() : play();
    });
  } else if (reduceMotion) {
    video.controls = true;
  }
  video.addEventListener("play", sync);
  video.addEventListener("pause", sync);

  new IntersectionObserver(([entry]) => {
    if (entry.isIntersecting && !userPaused) play();
    else if (!entry.isIntersecting) video.pause();
  }, { threshold: 0.2 }).observe(video);
  sync();
});

function harmonograph(canvas) {
  const STEPS = 6000;
  const DURATION = 260;
  const points = new Float32Array(STEPS * 2);
  for (let i = 0; i < STEPS; i++) {
    const t = (i / STEPS) * DURATION;
    const decay = Math.exp(-0.009 * t);
    points[i * 2] = Math.sin(t) * decay;
    points[i * 2 + 1] = Math.sin(1.012 * t + Math.PI / 2) * decay;
  }

  let progress = reduceMotion ? 1 : 0;
  const view = fitCanvas(canvas, () => draw());
  const centerX = parseFloat(canvas.dataset.cx ?? "0.5");
  const centerY = parseFloat(canvas.dataset.cy ?? "0.46");

  function draw() {
    const { ctx, w, h } = view;
    const cx = w * centerX;
    const cy = h * centerY;
    const scale = Math.min(w * 0.42, h * 0.44);
    const shown = Math.max(2, Math.floor(STEPS * easeOut(progress)));

    ctx.clearRect(0, 0, w, h);
    ctx.strokeStyle = "rgba(236, 235, 230, 0.07)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let i = 0; i < shown; i++) {
      const x = cx + points[i * 2] * scale;
      const y = cy + points[i * 2 + 1] * scale;
      i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
    }
    ctx.stroke();
  }

  animateOnce(canvas, 4000, (p) => {
    progress = p;
    draw();
  });
}

function spotlight(el) {
  if (!window.matchMedia("(hover: hover)").matches) return;
  el.addEventListener("pointermove", (e) => {
    const rect = el.getBoundingClientRect();
    el.style.setProperty("--mx", `${e.clientX - rect.left}px`);
    el.style.setProperty("--my", `${e.clientY - rect.top}px`);
  });
  el.addEventListener("pointerleave", () => {
    el.style.removeProperty("--mx");
    el.style.removeProperty("--my");
  });
}

function countUp(container) {
  if (reduceMotion) return;
  const NUMBER = /\d+(?:\.\d+)?/g;
  const nodes = [...container.querySelectorAll("dd")]
    .map((dd) => dd.firstChild)
    .filter((node) => node && node.nodeType === Node.TEXT_NODE);
  const originals = nodes.map((node) => node.textContent);
  const render = (p) => nodes.forEach((node, i) => {
    node.textContent = p >= 1
      ? originals[i]
      : originals[i].replace(NUMBER, (m) => (parseFloat(m) * p).toFixed((m.split(".")[1] || "").length));
  });
  render(0);
  animateOnce(container, 1400, (p) => render(p >= 1 ? 1 : easeOut(p)));
}

function tiltIn(frame) {
  if (reduceMotion) return;
  let queued = false;
  const update = () => {
    queued = false;
    const top = frame.getBoundingClientRect().top;
    const p = Math.min(1, Math.max(0, (innerHeight - top) / (innerHeight * 0.7)));
    frame.style.setProperty("--tilt", `${((1 - p) * 14).toFixed(2)}deg`);
    frame.style.setProperty("--lift", (0.94 + 0.06 * p).toFixed(3));
  };
  const queue = () => {
    if (queued) return;
    queued = true;
    requestAnimationFrame(update);
  };
  window.addEventListener("scroll", queue, { passive: true });
  window.addEventListener("resize", queue);
  update();
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

    ctx.strokeStyle = "rgba(236, 235, 230, 0.22)";
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
      ctx.strokeStyle = major ? "rgba(236, 235, 230, 0.26)" : "rgba(236, 235, 230, 0.12)";
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

    ctx.strokeStyle = "rgba(236, 235, 230, 0.8)";
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
    { lr: 2, color: "rgba(236, 235, 230, 0.3)" },
    { lr: 0.1, color: "rgba(236, 235, 230, 0.62)" },
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
    const pad = { l: 30, r: 18, t: 86, b: 30 };
    const pw = w - pad.l - pad.r;
    const ph = h - pad.t - pad.b;
    const x = (e) => pad.l + (e / (EPOCHS - 1)) * pw;
    const y = (v) => pad.t + ph - (Math.min(v, Y_MAX) / Y_MAX) * ph;

    ctx.clearRect(0, 0, w, h);
    ctx.font = `10.5px ${MONO}`;
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
    ctx.strokeStyle = "rgba(236, 235, 230, 0.08)";
    ctx.setLineDash([2, 4]);
    ctx.beginPath();
    ctx.moveTo(pad.l, Math.round(y(1)) + 0.5);
    ctx.lineTo(w - pad.r, Math.round(y(1)) + 0.5);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.strokeStyle = "rgba(236, 235, 230, 0.16)";
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
    gl.clearColor(0.15, 0.15, 0.2, 1);
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

document.querySelectorAll("[data-backdrop]").forEach(harmonograph);
document.querySelectorAll("[data-spotlight]").forEach(spotlight);
const stats = document.querySelector(".stats");
if (stats) countUp(stats);
const demoFrame = document.querySelector(".browser");
if (demoFrame) tiltIn(demoFrame);
const heroPendulum = document.querySelector("[data-hero-pendulum]");
if (heroPendulum) pendulum(heroPendulum);
const chart = document.querySelector("[data-loss-chart]");
if (chart) lossChart(chart);
const scene = document.querySelector("[data-cubes]");
if (scene) cubes(scene);
