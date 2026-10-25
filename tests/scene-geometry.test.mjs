import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import * as THREE from '../assets/vendor/three.module.min.js';

// Execute the production geometry builders with real Three.js. Only texture
// painting is stubbed: it has no effect on mesh positions or triangle bounds.
const source = await readFile(new URL('../index.html', import.meta.url), 'utf8');
const start = source.indexOf('const M =');
const end = source.indexOf('/* ================= 屏幕网页（CSS3D）');
assert.ok(start >= 0 && end > start, 'the scene geometry block must be loadable');
const gradient = { addColorStop() {} };
const context = {
  fillRect() {}, fillText() {}, beginPath() {}, arc() {}, fill() {},
  save() {}, restore() {}, stroke() {}, moveTo() {}, lineTo() {},
  strokeRect() {}, clearRect() {}, translate() {}, rotate() {}, scale() {},
  measureText(text) { return { width: text.length * 8 }; },
  createRadialGradient() { return gradient; },
  createLinearGradient() { return gradient; },
};
const document = { createElement() { return { getContext() { return context; } }; } };
const scene = new THREE.Scene();
const model = new Function('THREE', 'scene', 'document', 'ld', `${source.slice(start, end)}
return { TOP, SW, SH, desk, kb, mouse, mon, screenMesh, glass, floor };`
)(THREE, scene, document, { loaded() {} });
scene.updateMatrixWorld(true);

function bounds(object) {
  assert.ok(object, 'expected scene object was not found');
  return new THREE.Box3().setFromObject(object, true);
}

const tabletop = scene.getObjectByName('desk-top') ?? model.desk.children[0];
const tableBounds = bounds(tabletop);
const epsilon = 0.0001;

test('the two standing binders have separate physical bounds', () => {
  const binders = [0, 1].map((i) => scene.getObjectByName(`binder-${i}`)
    ?? scene.children.find((o) => o.isMesh && Math.abs(o.position.x - [0.52, 0.585][i]) < 1e-6 && Math.abs(o.position.z + 0.26) < 1e-6));
  const overlap = bounds(binders[0]).intersect(bounds(binders[1]));
  const size = overlap.getSize(new THREE.Vector3());
  assert.ok(overlap.isEmpty() || Math.min(size.x, size.y, size.z) <= epsilon,
    `binder solids overlap by ${size.toArray().map((n) => n.toFixed(5)).join(', ')} m`);
});

for (const [label, key] of [['keyboard', 'kb'], ['mouse', 'mouse']]) {
  test(`${label} rests above the actual tabletop surface`, () => {
    const item = scene.getObjectByName(label) ?? model[key];
    const lowest = bounds(item).min.y;
    assert.ok(lowest >= tableBounds.max.y - epsilon,
      `${label} bottom ${lowest.toFixed(5)} m is below tabletop ${tableBounds.max.y.toFixed(5)} m`);
  });
}

test('plant foliage and stems do not pass through the tabletop', () => {
  const plant = scene.getObjectByName('plant')
    ?? scene.children.find((o) => o.isGroup && Math.abs(o.position.x - 1.08) < 1e-6);
  assert.ok(plant, 'plant was not found');
  // The central solid excludes the bevel at the tabletop edges, avoiding
  // false positives where the rounded outer bounding box contains empty air.
  const solid = tableBounds.clone();
  solid.min.add(new THREE.Vector3(0.01, 0.001, 0.01));
  solid.max.sub(new THREE.Vector3(0.01, 0.001, 0.01));
  let crossings = 0;
  plant.traverse((object) => {
    if (!object.isMesh) return;
    const positions = object.geometry.attributes.position;
    const indices = object.geometry.index;
    const count = indices ? indices.count : positions.count;
    const triangle = new THREE.Triangle();
    for (let i = 0; i < count; i += 3) {
      for (const [offset, vertex] of [[0, triangle.a], [1, triangle.b], [2, triangle.c]]) {
        vertex.fromBufferAttribute(positions, indices ? indices.getX(i + offset) : i + offset).applyMatrix4(object.matrixWorld);
      }
      if (solid.intersectsTriangle(triangle)) crossings++;
    }
  });
  assert.equal(crossings, 0, `${crossings} plant triangles intersect the tabletop solid`);
});

test('monitor opening leaves the screen center and corners unobstructed', () => {
  const normal = new THREE.Vector3(0, 0, 1).transformDirection(model.screenMesh.matrixWorld);
  const ray = new THREE.Raycaster();
  const solids = [];
  model.mon.traverse((object) => {
    if (!object.isMesh || object === model.screenMesh || object === model.glass) return;
    if (object.material.transparent && object.material.opacity < 1) return;
    solids.push(object);
  });
  for (const [x, y] of [[0, 0], [-0.95, -0.95], [-0.95, 0.95], [0.95, -0.95], [0.95, 0.95]]) {
    const point = new THREE.Vector3(x * model.SW / 2, y * model.SH / 2, 0).applyMatrix4(model.screenMesh.matrixWorld);
    const origin = point.clone().addScaledVector(normal, 1);
    ray.set(origin, normal.clone().negate());
    ray.far = 1 - epsilon;
    const hit = ray.intersectObjects(solids, false)[0];
    assert.equal(hit, undefined,
      `screen sample (${x}, ${y}) is obscured by ${hit?.object.name || hit?.object.geometry.type || 'a monitor solid'}`);
  }
});

function worldTriangles(root) {
  const solids = [];
  root.traverse((object) => {
    if (!object.isMesh || object === model.screenMesh || object === model.glass) return;
    const positions = object.geometry.attributes.position;
    const indices = object.geometry.index;
    const count = indices ? indices.count : positions.count;
    const instances = object.isInstancedMesh ? object.count : 1;
    const triangles = [];
    for (let instance = 0; instance < instances; instance++) {
      const matrix = object.matrixWorld.clone();
      if (object.isInstancedMesh) {
        const local = new THREE.Matrix4();
        object.getMatrixAt(instance, local);
        matrix.multiply(local);
      }
      for (let i = 0; i < count; i += 3) {
        const triangle = new THREE.Triangle();
        for (const [offset, vertex] of [[0, triangle.a], [1, triangle.b], [2, triangle.c]]) {
          vertex.fromBufferAttribute(positions, indices ? indices.getX(i + offset) : i + offset).applyMatrix4(matrix);
        }
        triangles.push(triangle);
      }
    }
    solids.push({ name: object.name || root.name, bounds: bounds(object), triangles });
  });
  return solids;
}

function cameraHarness(width, height, reduced, orbitTime, pointer) {
  const cameraExpression = source.match(/const camera = (new THREE\.PerspectiveCamera\([^;]+\));/);
  assert.ok(cameraExpression, 'production perspective camera must be loadable');
  const camera = new Function('THREE', 'innerWidth', 'innerHeight', `return ${cameraExpression[1]};`)(THREE, width, height);
  const smallExpression = source.match(/const small = ([^;]+);/);
  assert.ok(smallExpression, 'production viewport breakpoint must be loadable');
  const small = new Function('innerWidth', `return ${smallExpression[1]};`)(width);
  const cameraStart = source.indexOf('const target = new THREE.Vector3()');
  const cameraEnd = source.indexOf('/* ================= 交互', cameraStart);
  assert.ok(cameraStart >= 0 && cameraEnd > cameraStart, 'production camera transitions must be loadable');
  const screenPos = model.screenMesh.getWorldPosition(new THREE.Vector3());
  const screenNormal = new THREE.Vector3(0, 0, 1).transformDirection(model.screenMesh.matrixWorld);
  const clock = { time: 0, now() { return this.time; } };
  const element = { classList: { toggle() {} }, focus() {}, blur() {} };
  // DOM changes and focus timers do not affect the camera; the actual camera
  // controller, easing, moving destinations, and pointer offsets remain intact.
  const controller = new Function('THREE', 'camera', 'TOP', 'SW', 'SH', 'reduce', 'small', 'screenPos', 'screenNormal', 'performance', 'd', '$', 'setTimeout', 'frame', 'document', 'scene', 'floor', `${source.slice(cameraStart, cameraEnd)}
    return {
      go, frameCamera,
      initialize(time, pointer) {
        state = 'overview'; clock0 = 0; px = pointer[0]; py = pointer[1];
        const initial = views.overview(time / 1000);
        camera.position.copy(initial.pos); target.copy(initial.look); camera.lookAt(target);
      },
      get transitioning() { return tween !== null; },
    };`
  )(THREE, camera, model.TOP, model.SW, model.SH, reduced, small, screenPos, screenNormal, clock, element, () => element, () => {}, element, document, scene, model.floor);
  clock.time = orbitTime * 1000;
  controller.initialize(clock.time, pointer);
  return { camera, controller, clock, screenPos, screenNormal };
}

test('desktop and mobile camera transitions clear the chair and monitor', (t) => {
  const chair = scene.getObjectByName('chair');
  assert.ok(chair, 'chair must be present for camera collision checks');
  const solids = [...worldTriangles(chair), ...worldTriangles(model.mon)];
  const closest = new THREE.Vector3();
  // The orbit extrema matter: the overview camera keeps moving during a tween.
  const orbitTimes = [0, Math.PI / 0.12, 3 * Math.PI / 0.12];
  const viewports = [[1440, 900], [390, 844], [844, 390], [768, 1024]];
  for (const [width, height] of viewports) {
    let minimum = Infinity;
    let frameCount = 0;
    for (const reduced of [false, true]) {
      for (const orbitTime of reduced ? [0] : orbitTimes) {
        for (const pointer of [[0, 0], [-0.5, 0.5], [0.5, -0.5]]) {
          const { camera, controller, clock, screenPos, screenNormal } = cameraHarness(width, height, reduced, orbitTime, pointer);
          // A sphere encompassing the camera and all four near-plane corners
          // prevents geometry from entering the camera's immediate clipping area.
          const halfHeight = camera.near * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
          const radius = Math.hypot(camera.near, halfHeight, halfHeight * camera.aspect);
          for (const destination of ['desk', 'screen', 'desk', 'overview']) {
            controller.go(destination);
            for (let sample = 0; sample <= 110; sample++) {
              controller.frameCamera(clock.time);
              const frontDistance = camera.position.clone().sub(screenPos).dot(screenNormal);
              assert.ok(frontDistance > radius, `${width}×${height} ${destination}: camera crosses monitor front`);
              let nearest = Infinity;
              let nearestName = '';
              for (const solid of solids) {
                if (solid.bounds.distanceToPoint(camera.position) >= nearest) continue;
                for (const triangle of solid.triangles) {
                  triangle.closestPointToPoint(camera.position, closest);
                  const distance = camera.position.distanceTo(closest);
                  if (distance < nearest) { nearest = distance; nearestName = solid.name; }
                }
              }
              const clearance = nearest - radius;
              minimum = Math.min(minimum, clearance);
              frameCount++;
              assert.ok(clearance > epsilon,
                `${width}×${height} ${destination}: near-plane sphere intersects ${nearestName}, clearance ${clearance.toFixed(5)} m`);
              clock.time += 1000 / 60;
              if (!controller.transitioning) break;
            }
          }
        }
      }
    }
    t.diagnostic(`${width}×${height}: ${frameCount} camera frames; minimum solid clearance ${(minimum * 1000).toFixed(1)} mm`);
  }
});

test('portrait overview keeps all desk props inside the horizontal frame margin', () => {
  for (const orbitTime of [0, Math.PI / 0.12, 3 * Math.PI / 0.12]) {
    const { camera } = cameraHarness(390, 844, false, orbitTime, [0, 0]);
    camera.updateMatrixWorld(true);
    let maximum = 0;
    let clippedObject = '';
    scene.traverse((object) => {
      if (!object.isMesh || object.material.isShadowMaterial) return;
      const positions = object.geometry.attributes.position;
      for (let instance = 0; instance < (object.isInstancedMesh ? object.count : 1); instance++) {
        const matrix = object.matrixWorld.clone();
        if (object.isInstancedMesh) {
          const local = new THREE.Matrix4();
          object.getMatrixAt(instance, local);
          matrix.multiply(local);
        }
        const vertex = new THREE.Vector3();
        for (let i = 0; i < positions.count; i++) {
          vertex.fromBufferAttribute(positions, i).applyMatrix4(matrix).project(camera);
          if (Math.abs(vertex.x) > maximum) {
            maximum = Math.abs(vertex.x);
            let named = object;
            while (!named.name && named.parent && named.parent !== scene) named = named.parent;
            clippedObject = named.name || object.geometry.type;
          }
        }
      }
    });
    assert.ok(maximum <= 0.9,
      `390×844 overview at ${orbitTime.toFixed(2)} s: ${clippedObject} reaches NDC x=${maximum.toFixed(3)}, beyond the 0.9 frame margin`);
  }
});
