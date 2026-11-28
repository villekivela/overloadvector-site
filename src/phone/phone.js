// The home page's phone: a Pixel 10 Pro's shape, built here from plain geometry. Its proportions,
// corners, punch-hole camera and camera bar are the phone's; nothing is a downloaded model, and
// it carries no maker's logo. Lengths are millimetres.
import {
  AdditiveBlending,
  BoxGeometry,
  CanvasTexture,
  CircleGeometry,
  DataTexture,
  DirectionalLight,
  ExtrudeGeometry,
  Group,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  NeutralToneMapping,
  NoColorSpace,
  PerspectiveCamera,
  PMREMGenerator,
  RingGeometry,
  Scene,
  ShaderMaterial,
  Shape,
  ShapeGeometry,
  SRGBColorSpace,
  TextureLoader,
  VideoTexture,
  WebGLRenderer,
} from "three";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";

const WIDTH = 72;
const HEIGHT = 152.8;
const DEPTH = 8.6;
const CORNER = 10.5;
// The screen is 20:9, as the screenshots are (640 by 1428).
const BEZEL = 3.2;
const SCREEN_WIDTH = WIDTH - 2 * BEZEL;
const SCREEN_HEIGHT = (SCREEN_WIDTH * 1428) / 640;
const FIELD_OF_VIEW = 30;
/** The share of the canvas's height the phone takes when it faces the reader. */
export const FILL = 0.74;

/** How the phone stands, in radians: `open` is how the page opens, `front` is where it rests. */
export const POSES = {
  open: { yaw: -0.7, pitch: 0.1, roll: -0.04 },
  front: { yaw: -0.3, pitch: 0.05, roll: 0 },
};

/** The body's colours by the page's theme: a charcoal phone on the dark page, a moonstone one on the light. */
const FINISHES = {
  dark: { frame: 0x5a5d62, glass: 0x202124, line: 0x55585e },
  light: { frame: 0xa3abbd, glass: 0x6c7589, line: 0xc4cad8 },
};

function roundedRect(width, height, radius) {
  const shape = new Shape();
  const x = -width / 2;
  const y = -height / 2;
  shape.moveTo(x + radius, y);
  shape.lineTo(x + width - radius, y);
  shape.absarc(x + width - radius, y + radius, radius, -Math.PI / 2, 0);
  shape.lineTo(x + width, y + height - radius);
  shape.absarc(x + width - radius, y + height - radius, radius, 0, Math.PI / 2);
  shape.lineTo(x + radius, y + height);
  shape.absarc(x + radius, y + height - radius, radius, Math.PI / 2, Math.PI);
  shape.lineTo(x, y + radius);
  shape.absarc(x + radius, y + radius, radius, Math.PI, 1.5 * Math.PI);
  return shape;
}

/** A slab with softened edges, `width` by `height` by `depth` overall, its back face at z = 0. */
function slab(width, height, depth, radius, bevel) {
  const geometry = new ExtrudeGeometry(roundedRect(width - 2 * bevel, height - 2 * bevel, radius - bevel), {
    depth: depth - 2 * bevel,
    bevelEnabled: true,
    bevelThickness: bevel,
    bevelSize: bevel,
    bevelSegments: 5,
    curveSegments: 24,
  });
  geometry.translate(0, 0, bevel);
  return geometry;
}

function panel(width, height, radius) {
  return new ShapeGeometry(roundedRect(width, height, radius), 24);
}

const SCREEN_VERTEX = `
  varying vec2 vUv;
  varying vec3 vNormal;
  varying vec3 vPlace;
  void main() {
    vUv = uv;
    vNormal = normalMatrix * normal;
    vec4 place = modelViewMatrix * vec4(position, 1.0);
    vPlace = place.xyz;
    gl_Position = projectionMatrix * place;
  }
`;

// The screen lights itself: no lamp or tone mapping changes the app's colours, and its picture is
// read a little sharper than the size it is drawn at asks for, so the text on it stays crisp. The
// glass over it is glossy: it mirrors a window up and to the right as a pane of light with hard
// edges and a thin line beside it, which cross the screen as the phone turns and at rest lie
// over its upper right corner. Everywhere else the screen's colours are untouched. A picture
// comes in as linear colour, a clip's frame as it was encoded, sRGB, which is taken back to
// linear here.
const SCREEN_FRAGMENT = `
  uniform sampler2D from;
  uniform sampler2D to;
  uniform bool fromVideo;
  uniform bool toVideo;
  uniform float blend;
  varying vec2 vUv;
  varying vec3 vNormal;
  varying vec3 vPlace;
  vec3 colour(sampler2D screen, bool video) {
    vec4 texel = texture2D(screen, vUv, -0.5);
    return video ? sRGBTransferEOTF(texel).rgb : texel.rgb;
  }
  // 1 between two edges, each a hair wide.
  float pane(float from, float to, float at) {
    return smoothstep(from, from + 0.004, at) * (1.0 - smoothstep(to, to + 0.004, at));
  }
  void main() {
    vec3 shown = mix(colour(from, fromVideo), colour(to, toVideo), blend);
    // Where the glass's mirror image of this spot lies, on a wall a unit behind the camera.
    vec3 mirrored = reflect(normalize(vPlace), normalize(vNormal));
    vec2 wall = mirrored.xy / max(mirrored.z, 0.001);
    float across = wall.x + 0.35 * wall.y;
    float window = pane(GLOSS_FROM, GLOSS_FROM + 2.0, across) * mix(0.04, 0.014, clamp((across - GLOSS_FROM) / 0.12, 0.0, 1.0));
    float line = pane(GLOSS_FROM - 0.03, GLOSS_FROM - 0.022, across) * 0.02;
    gl_FragColor = vec4(shown + window + line, 1.0);
    #include <colorspace_fragment>
  }
`.replace(/GLOSS_FROM/g, "(-0.585)");

/** A camera lens seen from above, painted: the glass's rings, its coating and the light on it. */
function lensFace(periscope) {
  const size = 256;
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = size;
  const pen = canvas.getContext("2d");
  pen.translate(size / 2, size / 2);
  const unit = size / 2;
  const ring = (radius, width, colour) => {
    pen.beginPath();
    pen.arc(0, 0, radius * unit, 0, 2 * Math.PI);
    pen.lineWidth = width * unit;
    pen.strokeStyle = colour;
    pen.stroke();
  };
  const glow = (x, y, radius, colour) => {
    const fade = pen.createRadialGradient(x * unit, y * unit, 0, x * unit, y * unit, radius * unit);
    fade.addColorStop(0, colour);
    fade.addColorStop(1, "rgba(0, 0, 0, 0)");
    pen.fillStyle = fade;
    pen.fillRect(-unit, -unit, size, size);
  };

  pen.fillStyle = "#030305";
  pen.fillRect(-unit, -unit, size, size);
  // The barrel's steps, going down into the lens.
  ring(0.93, 0.05, "#141518");
  ring(0.8, 0.03, "#15161a");
  ring(0.66, 0.05, "#101116");
  pen.save();
  pen.beginPath();
  if (periscope) pen.roundRect(-0.36 * unit, -0.3 * unit, 0.72 * unit, 0.6 * unit, 0.1 * unit);
  else pen.arc(0, 0, 0.56 * unit, 0, 2 * Math.PI);
  pen.clip();
  pen.fillStyle = "#06070c";
  pen.fillRect(-unit, -unit, size, size);
  // The coating throws back blue from one side and violet from the other.
  glow(-0.22, -0.26, 0.6, "rgba(46, 60, 120, 0.4)");
  glow(0.3, 0.32, 0.42, "rgba(74, 56, 110, 0.2)");
  pen.restore();
  if (!periscope) {
    ring(0.3, 0.03, "#0c0e16");
    pen.beginPath();
    pen.arc(0, 0, 0.2 * unit, 0, 2 * Math.PI);
    pen.fillStyle = "#010102";
    pen.fill();
  }
  glow(-0.3, -0.36, 0.1, "rgba(255, 255, 255, 0.3)");
  glow(0.2, 0.26, 0.06, "rgba(200, 210, 255, 0.12)");

  const face = new CanvasTexture(canvas);
  face.colorSpace = SRGBColorSpace;
  return face;
}

function buildBack({ frame, glass }) {
  // Built facing +z, then turned to face away from the screen.
  const back = new Group();
  const visor = new MeshStandardMaterial({ color: 0x040405, roughness: 0.06, metalness: 0.7 });
  const rim = new MeshStandardMaterial({ color: 0x121316, roughness: 0.4, metalness: 1 });
  const dark = new MeshStandardMaterial({ color: 0x0b0c0e, roughness: 0.35, metalness: 0.4 });

  const cover = new Mesh(slab(WIDTH - 2.4, HEIGHT - 2.4, 0.3, CORNER - 1.2, 0.12), glass);
  cover.position.z = -0.12;
  back.add(cover);

  // The camera bar: a pill standing well off the upper back. Dark glass covers the lenses, and
  // the flash and the temperature sensor sit in the metal at its end.
  const bar = new Group();
  const tall = 3.3;
  bar.position.y = HEIGHT / 2 - 25.5;
  bar.add(new Mesh(slab(64, 22, tall, 11, 0.55), frame));
  const pane = new Mesh(slab(48.4, 19.6, 0.4, 9.8, 0.15), visor);
  pane.position.set(-6.8, 0, tall - 0.22);
  bar.add(pane);

  const onGlass = tall + 0.19;
  const disc = (radius, material, x, y, z) => {
    const mesh = new Mesh(new CircleGeometry(radius, 56), material);
    mesh.position.set(x, y, z);
    bar.add(mesh);
    return mesh;
  };
  const round = lensFace(false);
  for (const [x, radius, face] of [[-21, 4.3, round], [-7.2, 5, round], [6.4, 4, lensFace(true)]]) {
    const lens = new MeshStandardMaterial({ map: face, emissiveMap: face, emissive: 0xffffff, emissiveIntensity: 0.07, roughness: 0.08, metalness: 0.2 });
    disc(radius, lens, x, 0, onGlass + 0.01);
    const edge = new Mesh(new RingGeometry(radius, radius + 0.25, 56), rim);
    edge.position.set(x, 0, onGlass + 0.01);
    bar.add(edge);
  }
  // The lenses lie under the glass, which throws the room back over them.
  const shine = new MeshStandardMaterial({
    color: 0xffffff,
    roughness: 0.04,
    metalness: 1,
    transparent: true,
    opacity: 0.07,
    blending: AdditiveBlending,
    depthWrite: false,
  });
  const sheet = new Mesh(panel(48, 19.2, 9.6), shine);
  sheet.position.set(-6.8, 0, onGlass + 0.03);
  bar.add(sheet);
  // The flash above the sensor.
  const onMetal = tall + 0.01;
  disc(2.5, dark, 24.6, 4, onMetal);
  disc(2.15, new MeshStandardMaterial({ color: 0xf4f1e8, roughness: 0.35, emissive: 0xf4f1e8, emissiveIntensity: 0.35 }), 24.6, 4, onMetal + 0.01);
  disc(0.75, new MeshStandardMaterial({ color: 0xf3df9a, roughness: 0.5, emissive: 0xf3df9a, emissiveIntensity: 0.4 }), 24.6, 4, onMetal + 0.02);
  disc(2, dark, 25, -3.9, onMetal);
  disc(1.1, visor, 25, -3.9, onMetal + 0.01);
  // A microphone's pinhole in the glass.
  disc(0.35, dark, 14.6, 0, onGlass + 0.01);

  back.add(bar);
  back.rotation.y = Math.PI;
  back.position.z = -DEPTH / 2;
  return back;
}

/** What the frame carries: the buttons, the antenna lines, and the port and speakers below. */
function buildEdges({ frame, line }) {
  const edges = new Group();
  const hollow = new MeshStandardMaterial({ color: 0x050506, roughness: 0.5, metalness: 0.3 });
  const flat = DEPTH - 1.8;

  // Power above volume, on the right as the screen faces the reader.
  for (const [y, length] of [[31, 10], [10.5, 21]]) {
    const button = new Mesh(slab(2.3, length, 1.1, 1.15, 0.3), frame);
    button.rotation.y = Math.PI / 2;
    button.position.set(WIDTH / 2 - 0.55, y, 0);
    edges.add(button);
  }
  // Antenna lines: thin bands across the metal, near each corner and on the top edge.
  for (const side of [-1, 1]) {
    for (const y of [HEIGHT / 2 - 17, -HEIGHT / 2 + 17]) {
      const band = new Mesh(new BoxGeometry(0.06, 0.9, flat), line);
      band.position.set(side * (WIDTH / 2), y, 0);
      edges.add(band);
    }
  }
  for (const [x, y] of [[-14, HEIGHT / 2], [16, -HEIGHT / 2]]) {
    const band = new Mesh(new BoxGeometry(0.9, 0.06, flat), line);
    band.position.set(x, y, 0);
    edges.add(band);
  }
  // Below: the port between a speaker and a microphone slot. On top: one more pinhole.
  const slot = (width, height, x, y, up) => {
    const mesh = new Mesh(panel(width, height, height / 2), hollow);
    mesh.rotation.x = (up * -Math.PI) / 2;
    mesh.position.set(x, y + up * 0.01, 0);
    edges.add(mesh);
  };
  slot(8.6, 2.7, 0, -HEIGHT / 2, -1);
  slot(9.5, 1.3, 15, -HEIGHT / 2, -1);
  slot(9.5, 1.3, -15, -HEIGHT / 2, -1);
  slot(1, 1, 12, HEIGHT / 2, 1);
  return edges;
}

function buildFront(screen) {
  const front = new Group();
  const glass = new MeshStandardMaterial({ color: 0x030304, roughness: 0.1, metalness: 0.4 });
  const cover = new Mesh(panel(WIDTH - 2, HEIGHT - 2, CORNER - 1), glass);
  cover.position.z = 0.02;
  front.add(cover);

  const display = panel(SCREEN_WIDTH, SCREEN_HEIGHT, CORNER - BEZEL);
  const positions = display.getAttribute("position");
  const uv = display.getAttribute("uv");
  for (let i = 0; i < positions.count; i++) {
    uv.setXY(i, positions.getX(i) / SCREEN_WIDTH + 0.5, positions.getY(i) / SCREEN_HEIGHT + 0.5);
  }
  const lit = new Mesh(display, screen);
  lit.position.z = 0.04;
  front.add(lit);

  // The punch-hole camera, centred in the status bar.
  const hole = new Mesh(new CircleGeometry(1.75, 40), new MeshBasicMaterial({ color: 0x000000 }));
  hole.position.set(0, SCREEN_HEIGHT / 2 - 4.2, 0.06);
  front.add(hole);
  const glint = new Mesh(new CircleGeometry(0.7, 24), new MeshBasicMaterial({ color: 0x10121c }));
  glint.position.set(0, SCREEN_HEIGHT / 2 - 4.2, 0.07);
  front.add(glint);

  front.position.z = DEPTH / 2;
  return front;
}

/** Draws the phone into `canvas`, on a clear background. */
export function createPhone(canvas, { pixelRatio = 1 } = {}) {
  const renderer = new WebGLRenderer({ canvas, alpha: true, antialias: true });
  renderer.setPixelRatio(pixelRatio);
  renderer.toneMapping = NeutralToneMapping;

  const scene = new Scene();
  const rooms = new PMREMGenerator(renderer);
  scene.environment = rooms.fromScene(new RoomEnvironment(), 0.04).texture;
  rooms.dispose();

  const blank = new DataTexture(new Uint8Array([0, 0, 0, 255]), 1, 1);
  blank.needsUpdate = true;
  const screen = new ShaderMaterial({
    uniforms: {
      from: { value: blank },
      to: { value: blank },
      fromVideo: { value: false },
      toVideo: { value: false },
      blend: { value: 0 },
    },
    vertexShader: SCREEN_VERTEX,
    fragmentShader: SCREEN_FRAGMENT,
  });

  // The body's own materials, coloured by setFinish.
  const body = {
    frame: new MeshStandardMaterial({ roughness: 0.27, metalness: 1 }),
    glass: new MeshStandardMaterial({ roughness: 0.45, metalness: 0.25 }),
    line: new MeshStandardMaterial({ roughness: 0.6, metalness: 0.2 }),
  };
  const setFinish = (name) => {
    for (const [part, colour] of Object.entries(FINISHES[name])) body[part].color.set(colour);
  };
  setFinish("dark");
  const phone = new Group();
  const shell = new Mesh(slab(WIDTH, HEIGHT, DEPTH, CORNER, 0.9), body.frame);
  shell.position.z = -DEPTH / 2;
  phone.add(shell, buildFront(screen), buildBack(body), buildEdges(body));
  phone.rotation.order = "YXZ";
  scene.add(phone);
  // A lamp up and to the left, and one behind to catch the frame's edge.
  const key = new DirectionalLight(0xffffff, 1.1);
  key.position.set(-90, 140, 220);
  const edge = new DirectionalLight(0xdfe6ff, 1.0);
  edge.position.set(160, 40, -60);
  scene.add(key, edge);

  const camera = new PerspectiveCamera(FIELD_OF_VIEW, 1, 10, 4000);
  const loader = new TextureLoader();
  const sharpest = renderer.capabilities.getMaxAnisotropy();

  return {
    setSize(width, height) {
      renderer.setSize(width, height, false);
      camera.aspect = width / height;
      // Tall enough for the phone, and wide enough for it at any turn. A narrow canvas zooms out
      // from the same spot, so the phone keeps the perspective of the picture drawn ahead of time.
      const tall = HEIGHT / FILL;
      camera.position.z = tall / (2 * Math.tan((FIELD_OF_VIEW * Math.PI) / 360));
      camera.zoom = Math.min(1, (tall * camera.aspect) / (WIDTH * 1.25));
      camera.updateProjectionMatrix();
    },
    /** The body's colour: "dark" or "light", after the page's theme. */
    setFinish,
    /** How the phone stands. */
    setPose({ yaw, pitch, roll }) {
      phone.rotation.set(pitch, yaw, roll);
    },
    /** Shows `from`, or its blend with `to`: 0 is all `from`, 1 all `to`. */
    setScreen(from, to = from, blend = 0) {
      screen.uniforms.from.value = from;
      screen.uniforms.to.value = to;
      screen.uniforms.fromVideo.value = Boolean(from.isVideoTexture);
      screen.uniforms.toVideo.value = Boolean(to.isVideoTexture);
      screen.uniforms.blend.value = blend;
    },
    async loadScreen(url) {
      const texture = await loader.loadAsync(url);
      texture.colorSpace = SRGBColorSpace;
      texture.anisotropy = sharpest;
      return texture;
    },
    /** A screen that shows what `video` is playing. */
    videoScreen(video) {
      const texture = new VideoTexture(video);
      // Raw: the screen's shader decodes it.
      texture.colorSpace = NoColorSpace;
      texture.anisotropy = sharpest;
      return texture;
    },
    render() {
      renderer.render(scene, camera);
    },
  };
}
