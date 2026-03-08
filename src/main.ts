
import "./style.css";
import * as THREE from "three";
import { generateFaceData } from "./FaceGeometry";
import { FaceAnimator } from "./FaceAnimator";
import { ParticleSystem } from "./ParticleSystem";
import { CameraController } from "./CameraController";

const canvas = document.getElementById("webgl-canvas") as HTMLCanvasElement;
const loadingOverlay = document.getElementById("loading-overlay")!;

const renderer = new THREE.WebGLRenderer({
  canvas,
  antialias: true,
  alpha: true,
});
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setClearColor(0x000000, 0);

const scene = new THREE.Scene();
scene.fog = new THREE.FogExp2(0x000000, 0.03);

const camera = new THREE.PerspectiveCamera(
  45,
  window.innerWidth / window.innerHeight,
  0.1,
  100,
);

function init() {
  const PARTICLE_COUNT = 50000;
  const faceData = generateFaceData(PARTICLE_COUNT);

  const particleSystem = new ParticleSystem(faceData);
  scene.add(particleSystem.points);

  const animator = new FaceAnimator();
  const cameraCtrl = new CameraController(camera);

  setTimeout(() => {
    loadingOverlay.classList.add("hidden");
  }, 300);

  const clock = new THREE.Clock();
  let elapsed = 0;

  function animate() {
    requestAnimationFrame(animate);

    const dt = clock.getDelta();
    elapsed += dt;

    const animState = animator.update(dt);
    cameraCtrl.update(dt);
    const mouseOffset = cameraCtrl.getMouseOffset();

    const introDuration = 4.5;
    const introProgress = Math.min(elapsed / introDuration, 1.0);

    particleSystem.update(
      elapsed,
      animState,
      mouseOffset.x,
      mouseOffset.y,
      introProgress,
    );

    renderer.render(scene, camera);
  }

  animate();

  window.addEventListener("resize", () => {
    const w = window.innerWidth;
    const h = window.innerHeight;
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    particleSystem.handleResize();
  });
}

requestAnimationFrame(() => {
  init();
});

const cursorDot = document.getElementById("cursor-dot");
const cursorRing = document.getElementById("cursor-ring");

if (cursorDot && cursorRing) {
  let mouseX = window.innerWidth / 2;
  let mouseY = window.innerHeight / 2;
  let ringX = mouseX;
  let ringY = mouseY;

  window.addEventListener("mousemove", (e) => {
    mouseX = e.clientX;
    mouseY = e.clientY;

    cursorDot.style.setProperty("--x", `${mouseX}px`);
    cursorDot.style.setProperty("--y", `${mouseY}px`);
  });

  const animateCursor = () => {
    ringX += (mouseX - ringX) * 0.15;
    ringY += (mouseY - ringY) * 0.15;
    cursorRing.style.setProperty("--x", `${ringX}px`);
    cursorRing.style.setProperty("--y", `${ringY}px`);
    requestAnimationFrame(animateCursor);
  };
  animateCursor();

  document.querySelectorAll("a, button").forEach((el) => {
    el.addEventListener("mouseenter", () => document.body.classList.add("hovering"));
    el.addEventListener("mouseleave", () => document.body.classList.remove("hovering"));
  });
}
