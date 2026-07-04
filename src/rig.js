// Camera rig: WALK (grounded exploration — gravity, jump, sprint, stride-
// matched head-bob) and FLY (free flight, wheel-scaled speed), alongside the
// default orbit mode. Feel constants and the pointer-lock cooldown handling
// are ported from LAAS (MIT, github.com/Braffolk/fable5-world-demo).
import * as THREE from 'three';
import { heightAt } from './terrain.js';
import { distToRiver, riverLevelNear } from './landuse.js';
import { LAKES } from './geodata.js';
import { pointInPoly, clamp } from './util.js';

const EYE_HEIGHT = 1.7;
const WALK_SPEED = 4.6;
const SPRINT_MULT = 2.0;
const GRAVITY = 22;
const JUMP_V0 = 7.0;
const STEP_DOWN = 0.55;
const GROUND_ACCEL = 10;
const AIR_ACCEL = 2.5;
const STRIDE_RATE = 1.7;
const BOB_Y_WALK = 0.026;
const BOB_Y_SPRINT_ADD = 0.018;
const BOB_LATERAL = 0.55;
const FLY_GROUND_CLEAR = 1.4;
const WADE_CLEAR = 0.45;
const LOCK_COOLDOWN_MS = 1300;

function waterLevelAt(x, z) {
  let w = -Infinity;
  if (distToRiver(x, z) < 18) w = Math.max(w, riverLevelNear(x, z));
  for (const lake of LAKES) {
    if (pointInPoly(x, z, lake.poly)) w = Math.max(w, lake.level);
  }
  return w;
}

export class Rig {
  constructor(camera, dom) {
    this.camera = camera;
    this.dom = dom;
    this.mode = 'orbit';          // 'orbit' | 'fly' | 'walk'
    this.yaw = 0;
    this.pitch = 0;
    this.flySpeed = 32;
    this.keys = new Set();
    this.vel = new THREE.Vector3();
    this.basePos = new THREE.Vector3();
    this.velY = 0;
    this.grounded = false;
    this.stride = 0;
    this.bobK = 0;
    this.locked = false;
    this.onModeChange = null;

    let unlockAt = -1e9;
    dom.addEventListener('click', () => {
      if (this.mode === 'orbit' || this.locked) return;
      const wait = unlockAt + LOCK_COOLDOWN_MS - performance.now();
      if (wait > 0) setTimeout(() => dom.requestPointerLock(), wait + 30);
      else dom.requestPointerLock();
    });
    document.addEventListener('pointerlockchange', () => {
      this.locked = document.pointerLockElement === dom;
      if (!this.locked) unlockAt = performance.now();
    });
    document.addEventListener('mousemove', (e) => {
      if (!this.locked) return;
      this.yaw -= e.movementX * 0.0023;
      this.pitch = clamp(this.pitch - e.movementY * 0.0023, -1.45, 1.45);
    });
    addEventListener('keydown', (e) => {
      if (e.code === 'KeyV' && this.mode !== 'orbit') {
        this.setMode(this.mode === 'walk' ? 'fly' : 'walk');
      }
      if (e.code === 'Space' && this.mode === 'walk') {
        this.jumpAt = performance.now();
        e.preventDefault();
      }
      this.keys.add(e.code);
    });
    addEventListener('keyup', (e) => this.keys.delete(e.code));
    addEventListener('wheel', (e) => {
      if (this.mode !== 'fly' || !this.locked) return;
      this.flySpeed = clamp(this.flySpeed * (e.deltaY > 0 ? 0.85 : 1.18), 3, 300);
    }, { passive: true });
    this.jumpAt = -1;
  }

  setMode(mode) {
    if (mode === this.mode) return;
    this.mode = mode;
    if (mode === 'orbit') {
      if (document.pointerLockElement === this.dom) document.exitPointerLock();
    } else {
      // adopt the current camera pose
      const e = new THREE.Euler().setFromQuaternion(this.camera.quaternion, 'YXZ');
      this.yaw = e.y;
      this.pitch = e.x;
      this.basePos.copy(this.camera.position);
      if (mode === 'walk') {
        const g = heightAt(this.basePos.x, this.basePos.z);
        this.basePos.y = g + EYE_HEIGHT;
        this.velY = 0;
        this.grounded = true;
      }
      this.vel.set(0, 0, 0);
    }
    if (this.onModeChange) this.onModeChange(mode);
  }

  update(dt) {
    if (this.mode === 'orbit') return;
    const fwd = new THREE.Vector3(-Math.sin(this.yaw), 0, -Math.cos(this.yaw));
    const right = new THREE.Vector3(-fwd.z, 0, fwd.x);
    const wish = new THREE.Vector3();
    if (this.keys.has('KeyW')) wish.add(fwd);
    if (this.keys.has('KeyS')) wish.sub(fwd);
    if (this.keys.has('KeyD')) wish.add(right);
    if (this.keys.has('KeyA')) wish.sub(right);
    const sprint = this.keys.has('ShiftLeft') || this.keys.has('ShiftRight');

    if (this.mode === 'fly') {
      const dir = new THREE.Vector3(
        -Math.sin(this.yaw) * Math.cos(this.pitch),
        Math.sin(this.pitch),
        -Math.cos(this.yaw) * Math.cos(this.pitch)
      );
      const move = new THREE.Vector3();
      if (this.keys.has('KeyW')) move.add(dir);
      if (this.keys.has('KeyS')) move.sub(dir);
      if (this.keys.has('KeyD')) move.add(right);
      if (this.keys.has('KeyA')) move.sub(right);
      if (this.keys.has('KeyE')) move.y += 1;
      if (this.keys.has('KeyQ')) move.y -= 1;
      if (move.lengthSq() > 0) move.normalize();
      const sp = this.flySpeed * (sprint ? 3 : 1);
      this.vel.lerp(move.multiplyScalar(sp), 1 - Math.exp(-6 * dt));
      this.basePos.addScaledVector(this.vel, dt);
      const minY = heightAt(this.basePos.x, this.basePos.z) + FLY_GROUND_CLEAR;
      if (this.basePos.y < minY) this.basePos.y = minY;
      this.camera.position.copy(this.basePos);
      this.camera.quaternion.setFromEuler(new THREE.Euler(this.pitch, this.yaw, 0, 'YXZ'));
      return;
    }

    // ---- walk ----
    if (wish.lengthSq() > 0) wish.normalize();
    const speed = WALK_SPEED * (sprint ? SPRINT_MULT : 1);
    const accel = this.grounded ? GROUND_ACCEL : AIR_ACCEL;
    this.vel.x += (wish.x * speed - this.vel.x) * (1 - Math.exp(-accel * dt));
    this.vel.z += (wish.z * speed - this.vel.z) * (1 - Math.exp(-accel * dt));
    this.basePos.x += this.vel.x * dt;
    this.basePos.z += this.vel.z * dt;

    const ground = heightAt(this.basePos.x, this.basePos.z);
    const water = waterLevelAt(this.basePos.x, this.basePos.z);
    const floor = Math.max(ground, water > -1e8 ? water - EYE_HEIGHT + WADE_CLEAR + EYE_HEIGHT - EYE_HEIGHT : -Infinity);
    void floor;

    if (this.grounded && this.jumpAt > 0 && performance.now() - this.jumpAt < 150) {
      this.velY = JUMP_V0;
      this.grounded = false;
      this.jumpAt = -1;
    }
    this.velY -= GRAVITY * dt;
    this.basePos.y += this.velY * dt;
    const eyeFloor = ground + EYE_HEIGHT;
    if (this.basePos.y <= eyeFloor + (this.grounded ? STEP_DOWN : 0)) {
      this.basePos.y = eyeFloor;
      this.velY = 0;
      this.grounded = true;
    } else if (this.basePos.y > eyeFloor + STEP_DOWN) {
      this.grounded = false;
    }
    // wading: keep the eye above open water
    if (water > -1e8 && this.basePos.y < water + WADE_CLEAR + 0.9) {
      this.basePos.y = water + WADE_CLEAR + 0.9;
      this.velY = Math.max(0, this.velY);
      this.grounded = true;
    }

    // stride-matched bob (amplitude follows actual horizontal speed)
    const hSpeed = Math.hypot(this.vel.x, this.vel.z);
    this.bobK += ((this.grounded ? clamp(hSpeed / WALK_SPEED, 0, 2) : 0) - this.bobK) * (1 - Math.exp(-8 * dt));
    this.stride += hSpeed * dt * STRIDE_RATE;
    const amp = (BOB_Y_WALK + Math.max(0, hSpeed / WALK_SPEED - 1) * BOB_Y_SPRINT_ADD) * this.bobK;
    const bobY = Math.sin(this.stride * 2) * amp;
    const bobX = Math.sin(this.stride) * amp * BOB_LATERAL;

    this.camera.position.copy(this.basePos);
    this.camera.position.y += bobY;
    this.camera.position.addScaledVector(right, bobX);
    this.camera.quaternion.setFromEuler(new THREE.Euler(this.pitch, this.yaw, Math.sin(this.stride) * 0.0032 * this.bobK, 'YXZ'));
  }
}
