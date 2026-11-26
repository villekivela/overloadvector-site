// The home page's phone: a Pixel 10 Pro's shape, built here from plain geometry. Its proportions,
// corners, punch-hole camera and camera bar are the phone's; nothing is a downloaded model, and
// it carries no maker's logo. Lengths are millimetres.
import {
  BoxGeometry,
  CircleGeometry,
  DataTexture,
  ExtrudeGeometry,
  Group,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  NeutralToneMapping,
  PerspectiveCamera,
  PMREMGenerator,
  RingGeometry,
  Scene,
  ShaderMaterial,
  Shape,
  ShapeGeometry,
  SRGBColorSpace,
  TextureLoader,
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
const FIELD_OF_VIEW = 22;

/** How the phone stands, in radians: `back` opens the page, `front` is where it rests. */
export const POSES = {
  back: { yaw: Math.PI + 0.5, pitch: 0.1, roll: -0.06 },
  front: { yaw: -0.3, pitch: 0.05, roll: 0 },
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
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

// The screen lights itself: no lamp or tone mapping changes the app's colours.
const SCREEN_FRAGMENT = `
  uniform sampler2D from;
  uniform sampler2D to;
  uniform float blend;
  varying vec2 vUv;
  void main() {
    gl_FragColor = vec4(mix(texture2D(from, vUv).rgb, texture2D(to, vUv).rgb, blend), 1.0);
    #include <colorspace_fragment>
  }
`;

function buildBack(frame) {
  // Built facing +z, then turned to face away from the screen.
  const back = new Group();
  const glass = new MeshStandardMaterial({ color: 0x7d848e, roughness: 0.5, metalness: 0.15 });
  const visor = new MeshStandardMaterial({ color: 0x050507, roughness: 0.08, metalness: 0.6 });
  const rim = new MeshStandardMaterial({ color: 0x6a6e76, roughness: 0.25, metalness: 1 });
  const lens = new MeshStandardMaterial({ color: 0x020204, roughness: 0.02, metalness: 1 });
  const iris = new MeshStandardMaterial({ color: 0x24345c, roughness: 0.15, metalness: 0.9 });
  const glint = new MeshBasicMaterial({ color: 0x8f9bb5, transparent: true, opacity: 0.55 });

  const cover = new Mesh(panel(WIDTH - 2.6, HEIGHT - 2.6, CORNER - 1.3), glass);
  cover.position.z = 0.02;
  back.add(cover);

  // The camera bar: a raised pill across the upper back, with a dark glass visor set in it.
  const bar = new Group();
  bar.position.y = HEIGHT / 2 - 25;
  bar.add(new Mesh(slab(55, 21, 2.6, 10.5, 0.7), frame));
  const pane = new Mesh(slab(50.6, 16.6, 0.5, 8.3, 0.2), visor);
  pane.position.z = 2.45;
  bar.add(pane);

  const top = 2.97;
  const disc = (radius, material, x, y, z) => {
    const mesh = new Mesh(new CircleGeometry(radius, 48), material);
    mesh.position.set(x, y, top + z);
    bar.add(mesh);
  };
  for (const [x, radius] of [[-15.4, 5.6], [-2.6, 5.6], [9.6, 4.8]]) {
    const ring = new Mesh(new RingGeometry(radius - 0.7, radius, 48), rim);
    ring.position.set(x, 0, top + 0.01);
    bar.add(ring);
    disc(radius - 0.7, lens, x, 0, 0.005);
    disc(radius * 0.5, iris, x, 0, 0.012);
    disc(radius * 0.26, lens, x, 0, 0.018);
    disc(radius * 0.07, glint, x - radius * 0.3, radius * 0.32, 0.024);
  }
  disc(1.9, new MeshStandardMaterial({ color: 0xe9dfc4, roughness: 0.5 }), 19.6, 3.4, 0.01);
  disc(1.5, rim, 19.6, -3.4, 0.01);

  back.add(bar);
  back.rotation.y = Math.PI;
  back.position.z = -DEPTH / 2;
  return back;
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

/**
 * Draws the phone into `canvas`, on a clear background. `fill` is the share of the canvas's
 * height the phone takes when it faces the reader.
 */
export function createPhone(canvas, { fill = 0.8, pixelRatio = 1 } = {}) {
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
    uniforms: { from: { value: blank }, to: { value: blank }, blend: { value: 0 } },
    vertexShader: SCREEN_VERTEX,
    fragmentShader: SCREEN_FRAGMENT,
  });

  const frame = new MeshStandardMaterial({ color: 0xb4b9c1, roughness: 0.22, metalness: 1 });
  const phone = new Group();
  const body = new Mesh(slab(WIDTH, HEIGHT, DEPTH, CORNER, 0.9), frame);
  body.position.z = -DEPTH / 2;
  phone.add(body, buildFront(screen), buildBack(frame));
  // Power above volume, on the right as the screen faces the reader.
  for (const [y, length] of [[31, 10], [11, 21]]) {
    const button = new Mesh(new BoxGeometry(0.9, length, 2.2), frame);
    button.position.set(WIDTH / 2 + 0.15, y, 0);
    phone.add(button);
  }
  phone.rotation.order = "YXZ";
  scene.add(phone);

  const camera = new PerspectiveCamera(FIELD_OF_VIEW, 1, 10, 4000);
  const loader = new TextureLoader();
  const sharpest = renderer.capabilities.getMaxAnisotropy();

  return {
    setSize(width, height) {
      renderer.setSize(width, height, false);
      camera.aspect = width / height;
      // Tall enough for the phone, and wide enough for it at any turn.
      const tall = Math.max(HEIGHT / fill, (WIDTH * 1.5) / camera.aspect);
      camera.position.z = tall / (2 * Math.tan((FIELD_OF_VIEW * Math.PI) / 360));
      camera.updateProjectionMatrix();
    },
    setPose({ yaw, pitch, roll }) {
      phone.rotation.set(pitch, yaw, roll);
    },
    /** Shows `from`, or its blend with `to`: 0 is all `from`, 1 all `to`. */
    setScreen(from, to = from, blend = 0) {
      screen.uniforms.from.value = from;
      screen.uniforms.to.value = to;
      screen.uniforms.blend.value = blend;
    },
    async loadScreen(url) {
      const texture = await loader.loadAsync(url);
      texture.colorSpace = SRGBColorSpace;
      texture.anisotropy = sharpest;
      return texture;
    },
    render() {
      renderer.render(scene, camera);
    },
  };
}
