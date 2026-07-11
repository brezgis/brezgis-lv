// Camera rig — Minecraft-style, two modes only:
//   FLY  — WASD/arrows glide on the view plane, Space climbs, Shift sinks,
//          the wheel scales speed. Sink onto the ground and you land walking.
//   WALK — WASD/arrows walk, Shift sprints, Space jumps, double-tap Space
//          lifts off into flight. Gravity applies: switch to walk in mid-air
//          and you fall (on purpose — it's fun).
// Click captures the mouse in both modes; Esc frees it. Before the first
// input the rig idles in a 'cinema' state (the intro orbit, driven by main).
// Feel constants adapted from LAAS (MIT, github.com/Braffolk/fable5-world-demo).
import * as THREE from 'three';
import { heightAt } from './terrain.js';
import { waterLevelAt } from './riverzone.js';
import { clamp } from './util.js';

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
const FLY_CLEAR = 0.9;          // minimum hover height over ground
const LAND_EPS = 0.4;           // sink to within this of the ground -> land
const WADE_DEPTH = 1.05;
const LOCK_COOLDOWN_MS = 1300;
const LOOK_SENS = 0.0021;
const LOOK_SMOOTH = 32;
const DOUBLE_TAP_MS = 320;
const PLAYER_R = 0.38;

const KEY_ALIAS = {
  ArrowUp: 'KeyW', ArrowDown: 'KeyS', ArrowLeft: 'KeyA', ArrowRight: 'KeyD',
};
const MOVE_KEYS = new Set(['KeyW', 'KeyA', 'KeyS', 'KeyD']);

export function flyBoostFor(alt) {
  return 1 + clamp((alt - 14) / 55, 0, 5);
}

export class Rig {
  constructor(camera, dom) {
    this.camera = camera;
    this.dom = dom;
    this.mode = 'cinema';         // 'cinema' | 'fly' | 'walk'
    this.yaw = 0; this.pitch = 0;
    this.yawT = 0; this.pitchT = 0;
    this.flySpeed = 32;
    this.sprint = false;
    this.era = 4;
    this.keys = new Set();
    this.vel = new THREE.Vector3();
    this.basePos = new THREE.Vector3();
    this._fwd = new THREE.Vector3();
    this._right = new THREE.Vector3();
    this._wish = new THREE.Vector3();
    this._rot = new THREE.Euler(0, 0, 0, 'YXZ');
    this.velY = 0;
    this.grounded = false;
    this.stride = 0;
    this.bobK = 0;
    this.locked = false;
    this.onModeChange = null;
    this.collideFn = null;        // (x, z, feetY) -> [x, z], set by main
    this.jumpAt = -1;
    this.lastSpaceT = -1e9;
    this.lastWT = -1e9;

    let unlockAt = -1e9;
    const requestLock = () => {
      const wait = unlockAt + LOCK_COOLDOWN_MS - performance.now();
      if (wait > 0) setTimeout(() => this.mode !== 'cinema' && dom.requestPointerLock(), wait + 30);
      else dom.requestPointerLock();
    };
    dom.addEventListener('click', () => {
      if (this.mode === 'cinema') this.setMode('fly');
      if (!this.locked) requestLock();
    });
    document.addEventListener('pointerlockchange', () => {
      this.locked = document.pointerLockElement === dom;
      if (!this.locked) unlockAt = performance.now();
    });
    document.addEventListener('mousemove', (e) => {
      if (!this.locked) return;
      this.yawT -= e.movementX * LOOK_SENS;
      this.pitchT = clamp(this.pitchT - e.movementY * LOOK_SENS, -1.45, 1.45);
    });
    addEventListener('keydown', (e) => {
      if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA')) return;
      const code = KEY_ALIAS[e.code] || e.code;
      if (KEY_ALIAS[e.code]) e.preventDefault();     // arrows must never scroll
      // first input leaves the intro orbit flying — and is CONSUMED: letting
      // the same Space fall through seeded lastSpaceT, so a second tap within
      // 320ms dropped the player straight out of the sky into walk mode
      if (this.mode === 'cinema' && (MOVE_KEYS.has(code) || e.code === 'Space') && !e.repeat) {
        this.setMode('fly');
        requestLock();
        if (e.code === 'Space') { e.preventDefault(); this.keys.add(code); return; }
      }
      if (e.code === 'KeyV' && !e.repeat) {
        this.setMode(this.mode === 'walk' ? 'fly' : 'walk');
      }
      if (e.code === 'Space') {
        e.preventDefault();
        if (!e.repeat) {
          const now = performance.now();
          const doubleTap = now - this.lastSpaceT < DOUBLE_TAP_MS;
          this.lastSpaceT = now;
          if (this.mode === 'walk') {
            if (doubleTap) {
              this.setMode('fly');
              this.velY = 0;
            } else {
              this.jumpAt = now;
            }
          } else if (this.mode === 'fly' && doubleTap) {
            this.setMode('walk');               // cut the wings: gravity takes over
          }
        }
      }
      if (code === 'KeyW' && this.mode === 'fly' && !e.repeat) {
        const now = performance.now();
        if (now - this.lastWT < DOUBLE_TAP_MS) this.sprint = true;
        this.lastWT = now;
      }
      this.keys.add(code);
    });
    addEventListener('keyup', (e) => {
      const code = KEY_ALIAS[e.code] || e.code;
      this.keys.delete(code);
      if (code === 'KeyW') this.sprint = false;
    });
    addEventListener('wheel', (e) => {
      if (this.mode !== 'fly' || !this.locked) return;
      this.flySpeed = clamp(this.flySpeed * (e.deltaY > 0 ? 0.85 : 1.18), 3, 300);
    }, { passive: true });
    addEventListener('blur', () => {
      this.keys.clear();
      this.sprint = false;
    });
  }

  // read the current camera pose into the rig (after intro/preset moves)
  adoptCamera() {
    const e = this._rot.setFromQuaternion(this.camera.quaternion, 'YXZ');
    this.yaw = this.yawT = e.y;
    this.pitch = this.pitchT = e.x;
    this.basePos.copy(this.camera.position);
    this.vel.set(0, 0, 0);
    this.velY = 0;
  }

  setMode(mode) {
    if (mode === this.mode) return;
    const from = this.mode;
    this.mode = mode;
    if (from === 'cinema') this.adoptCamera();
    if (mode !== 'fly') this.sprint = false;
    if (mode === 'walk') {
      // do NOT snap to the ground: if you were flying you now fall to it
      const g = heightAt(this.basePos.x, this.basePos.z) + EYE_HEIGHT;
      if (this.basePos.y <= g + LAND_EPS) {
        this.basePos.y = g;
        this.grounded = true;
      } else {
        this.grounded = false;
      }
      this.velY = 0;
    }
    if (this.onModeChange) this.onModeChange(mode);
  }

  applyCollision(feetY) {
    if (!this.collideFn) return;
    const c = this.collideFn(this.basePos.x, this.basePos.z, feetY);
    this.basePos.x = c[0];
    this.basePos.z = c[1];
  }

  update(dt) {
    if (this.mode === 'cinema') return;
    const lk = 1 - Math.exp(-LOOK_SMOOTH * dt);
    this.yaw += (this.yawT - this.yaw) * lk;
    this.pitch += (this.pitchT - this.pitch) * lk;

    const fwd = this._fwd.set(-Math.sin(this.yaw), 0, -Math.cos(this.yaw));
    const right = this._right.set(-fwd.z, 0, fwd.x);
    const wish = this._wish.set(0, 0, 0);
    if (this.keys.has('KeyW')) wish.add(fwd);
    if (this.keys.has('KeyS')) wish.sub(fwd);
    if (this.keys.has('KeyD')) wish.add(right);
    if (this.keys.has('KeyA')) wish.sub(right);

    if (this.mode === 'fly') {
      // Minecraft creative: horizontal on the yaw plane, vertical on keys
      let up = 0;
      if (this.keys.has('Space') || this.keys.has('KeyE')) up += 1;
      if (this.keys.has('ShiftLeft') || this.keys.has('ShiftRight') || this.keys.has('KeyQ')) up -= 1;
      const eyeGround = heightAt(this.basePos.x, this.basePos.z) + EYE_HEIGHT;
      const alt = this.basePos.y - (eyeGround - EYE_HEIGHT);
      const speed = this.flySpeed * flyBoostFor(alt) * (this.sprint ? 2.3 : 1);
      if (wish.lengthSq() > 0) wish.normalize();
      wish.y = up * 0.85;
      this.vel.lerp(wish.multiplyScalar(speed), 1 - Math.exp(-6 * dt));
      this.basePos.addScaledVector(this.vel, dt);
      this.applyCollision(this.basePos.y - 1.0);
      if (this.basePos.y <= eyeGround + LAND_EPS) {
        if (up < 0) {
          // settled onto the turf while sinking: that's a landing
          this.basePos.y = eyeGround;
          this.setMode('walk');
        } else {
          this.basePos.y = eyeGround; // hover at eye height, don't sink in
        }
      }
      this.camera.position.copy(this.basePos);
      this.camera.quaternion.setFromEuler(this._rot.set(this.pitch, this.yaw, 0, 'YXZ'));
      return;
    }

    // ---- walk ----
    if (wish.lengthSq() > 0) wish.normalize();
    const sprint = this.keys.has('ShiftLeft') || this.keys.has('ShiftRight');
    const speed = WALK_SPEED * (sprint ? SPRINT_MULT : 1);
    const accel = this.grounded ? GROUND_ACCEL : AIR_ACCEL;
    this.vel.x += (wish.x * speed - this.vel.x) * (1 - Math.exp(-accel * dt));
    this.vel.z += (wish.z * speed - this.vel.z) * (1 - Math.exp(-accel * dt));
    this.basePos.x += this.vel.x * dt;
    this.basePos.z += this.vel.z * dt;
    this.applyCollision(this.basePos.y - EYE_HEIGHT);

    const ground = heightAt(this.basePos.x, this.basePos.z);
    const water = waterLevelAt(this.basePos.x, this.basePos.z, this.era);

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
    if (water > -1e8 && this.basePos.y < water + WADE_DEPTH) {
      this.basePos.y = water + WADE_DEPTH;
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
    this.camera.quaternion.setFromEuler(this._rot.set(this.pitch, this.yaw, Math.sin(this.stride) * 0.0032 * this.bobK, 'YXZ'));
  }
}

export { EYE_HEIGHT, PLAYER_R };
