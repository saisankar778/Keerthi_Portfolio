# Keerthi Tadikonda, portfolio

A single-page portfolio built from `keerthi_resume (22).pdf`. Plain HTML, CSS and
JavaScript with no build step. Open `index.html` in a browser and it runs.

## What still needs real files

Her two portraits are done, built from `img/IMG_20260523_165645380_PCT.jpg.jpeg`
by `tools/build-photos.py`. What is left is the three project screenshots:

| File | What it is |
| --- | --- |
| `img/work-01.jpg` | ATS Resume Checker screenshot |
| `img/work-02.jpg` | Persona screenshot |
| `img/work-03.jpg` | Soil Monitoring System screenshot |

Landscape, roughly 1200 x 900 or wider. Until each one exists its card shows a
tinted cover with the project's tech logo, which is a finished look rather than
a placeholder, so adding them one at a time is fine. Each screenshot fades in
over its cover automatically on reload.

To rebuild the portraits from a different photo:

```bash
pip install pillow rembg onnxruntime
python3 tools/build-photos.py img/<her-photo>.jpg
```

That writes `img/keerthi-hero.webp` (background removed, transparent) and
`img/keerthi-about.webp`. Check the crop box at the top of the script if the
new photo is framed differently.

## Running it

Double-clicking `index.html` works. To serve it over http instead:

```bash
python3 -m http.server 8000
# then open http://localhost:8000
```

## Deploying

Everything is static and self contained, so any static host works. Drag the
folder onto Netlify, or:

```bash
npx vercel --prod
```

## How it is put together

```
index.html          all the content
styles.css          design tokens, layout, both themes
wave.js             the background field: one WebGL fragment shader, no library
main.js             every animation, with the reason for each at the top
assets/fonts/       Geist and Geist Mono, self hosted
assets/logos/       Simple Icons and devicon marks, monochrome
assets/logos.css    generated: those SVGs inlined as data URIs
vendor/             GSAP, ScrollTrigger and Lenis, pinned copies
tools/build-logos.py    regenerates assets/logos.css
tools/build-photos.py   rebuilds the two portraits from one source photo
```

Nothing is loaded from a CDN at runtime, so the site does not break if a CDN
goes down and it works fully offline.

### Adding a tech logo

```bash
curl -o assets/logos/<slug>.svg https://cdn.simpleicons.org/<slug>
python3 tools/build-logos.py
```

Then add the slug to the `LOGOS` array in `main.js`, or use the generated
`logo-<slug>` class directly on an element.

### The background field

`wave.js` draws a full screen silk field from a single fragment shader, no
library. Six sheets sweep across the frame, each drawn with a soft edge, a
bright crease where light catches the fold, and a shadow cast onto whatever it
overlaps. That layering is what makes it read as fabric rather than a gradient.

The palette is sampled from the reference image: cream, peach, apricot, orange
and coral on the warm ramp, pale blue through teal to deep teal on the cool
one. A diagonal axis decides which ramp each pixel takes, and that axis rides
the fold height, so the warm-to-cool boundary is never a straight line.

The pointer drives three things. The sampling point is pushed away from the
cursor, so the folds gather and part around it. A slow swell rides on that
bend. And a specular term with its light at the cursor makes the silk catch
light where you point. When the pointer rests the light drifts on its own. On
a phone, device tilt moves it instead.

The field is fixed behind the whole page. A paper scrim over it is driven by
scroll position: clear across the hero, 93 percent behind the reading sections
so body copy sits on near solid paper, then eased back to 72 percent under the
closing block so the colour returns as a bookend.

A tone guard lifts the darkest folds on light and caps the brightest on dark,
preserving hue and moving only tone. Every text zone over the field was
measured rather than eyeballed, and clears WCAG AA in both themes.

Cost control: the canvas renders at 0.58 of device resolution, capped at
1500px wide, and soft gradients survive that downsampling invisibly. If the
first 45 frames average worse than about 42fps it drops to 0.40 once and stays
there. Without WebGL the canvas is removed and the field falls back to a static
CSS gradient in the same palette; under `prefers-reduced-motion` it renders one
frozen frame.

### Motion and depth

Everything below runs on GSAP's single ticker with `quickTo` / `quickSetter`,
which write straight to the transform. No extra requestAnimationFrame loops, no
state, and nothing that triggers layout.

- **Hero depth parallax.** The name, the portrait and the footer copy sit on
  three planes at different parallax rates, and she takes a small 3D rotation,
  so moving the pointer parallaxes them against each other. The stage uses
  `perspective` but deliberately not `transform-style: preserve-3d`, because
  preserve-3d z-sorts children by 3D position and paints the name in front of
  her.
- **The work deck is dealt in 3D.** Each card swings in on its own Y axis from
  a `translateZ(-260px)` start and settles onto the stack, with the cards
  beneath pushed back in depth and tilted. The pile has real thickness.
- **Double bezel.** Every project card is a tray holding a plate: an outer
  shell with its own tint and hairline, an inner core with a concentric radius
  and an inset highlight.
- **Magnetic buttons and back-to-top.** They lean toward the cursor and spring
  back on leave, with the trailing icon nested in its own circle that shifts
  diagonally on hover.
- **Spotlight surfaces.** Project cards and certification tiles pick up a
  highlight that tracks the cursor, fed by `--mx` / `--my` custom properties.
- **Headings hinge into place.** They are split on their explicit line breaks
  and each line rotates up from behind its own mask. No measurement, so nothing
  to recompute on resize, and it degrades to plain text with JS off.
- **Scroll rail and section pill.** A thin progress rail at the top, and a pill
  in the nav that slides to whichever section is in view.

Cursor-driven effects are gated behind `(pointer: fine)`, since a finger has no
hover state and they would only fight the scroll. All of it sits behind the
reduced-motion guard, so the page renders fully static when that is set.

### Tuning the background

Every number worth touching sits in one labelled block at the top of the
shader in `wave.js`, at lines 68 to 73. Edit, save, hard refresh with
ctrl+shift+R.

```glsl
const float CONTRAST = 0.86;   // light-to-dark separation across the folds
const float DEPTH    = 0.17;   // how far into the ramp each fold recedes
const float CREASE   = 0.09;   // the light line along each fold edge
const float SHADOW   = 0.09;   // shadow one sheet casts on the next
const float SHEEN    = 0.05;   // broad soft light across each fold
const vec3  MIDTONE  = vec3(0.80, 0.76, 0.68);   // what CONTRAST pulls toward
```

For a calmer background, lower `CONTRAST` first: 0.86 is the current setting,
0.75 is noticeably flatter, 1.0 is full strength. `DEPTH` is the next biggest
lever. Lowering all of them together flattens the field without touching hue.

Two other things you might want:

- **Colour balance.** The warm and cool ramps are the `warmRamp` and
  `coolRamp` functions just below. Each is five stops, light to dark.
- **How much of the frame is warm.** The `bias` value in `main()` slides the
  warm-to-cool boundary. More negative pushes it right (more teal), more
  positive pushes it left (more orange).

After changing anything that darkens the field, check the type still reads over
it. The dark folds sitting under the hero footer copy are the tightest spot on
the page.

### How the page is kept smooth

Scroll runs through Lenis at a low lerp, so the page keeps gliding after the
wheel stops, with touch synced to the same feel. Every hover and surface
transition sits on one soft curve with no snap at either end, on a three step
duration scale. Entrances are long and settle rather than arrive. Scroll linked
motion trails the scroll instead of tracking it: the hero release and the work
deck both scrub with lag, so nothing snaps to the scrollbar. Headlines use
`text-wrap: balance` and body copy `text-wrap: pretty`, so no line is left with
an orphan.

### Design notes

- Neutrals carry the warm half of the reference (cream paper, warm ink, warm
  tinted shadows) and the single accent carries the cool half (deep teal). The
  full multi-colour lives in the background field alone, which is what keeps the
  page from turning into a rainbow. Light and dark are the same tokens with
  different values, and dark mode follows the system setting unless the toggle
  in the nav overrides it.
- Corner radius rule: buttons and tags are pill, cards and media are 14px,
  nothing else is rounded.
- The scroll choreography is the hero entrance, the work deck, and reveals on
  everything else. All of it collapses to a static page under
  `prefers-reduced-motion`, and the page is fully readable with JavaScript off.

### Editing content

Everything visible lives in `index.html`. To add a fourth project, copy one
`<article class="card">` block, give it a `data-from` of `left` or `right`, set
its own `--tone-a` and `--tone-b`, and point `data-cover` at a new image. The
deck timing adapts to the number of cards on its own.

The GitHub links on all three cards point at her profile rather than individual
repositories, since the resume did not list repository URLs. Worth updating.
