# Portfolio

Static site: plain HTML, CSS and JavaScript, no build step.

```
index.html               all page copy (projects, about, contact)
css/style.css            layout and theme (colour tokens at the top)
js/main.js               nav, videos, scroll reveals, and the interactive figures
assets/                  demo videos + posters, OpenGL textures, resume PDF, favicon
```

## Run locally

```bash
python3 -m http.server 4173
```

Then open http://localhost:4173. The WebGL scene loads textures, so open it through a server, not `file://`.

## Interactive figures

Each one is a port of the project's own code, in `js/main.js`:

- `pendulum` (hero): the update loop from `swinging-pendulum/main.cpp` (g = 1000, damping = 0.1)
- `lossChart`: the 2-2-1 XOR network from `gradient-descent-math-ia`, trained at η = 1, 0.1 and 2
- `cubes`: `first-opengl`'s Renderer and Camera (same cube geometry, positions, textures and shader mix)

The Cadence and pendulum cards use the original screen recordings, re-encoded as MP4.

## Deploy

Any static host works (GitHub Pages, Netlify, Cloudflare Pages): publish the folder as-is.
