
import * as THREE from "three";
import type { FaceData } from "./FaceGeometry";
import type { AnimationState } from "./FaceAnimator";

const vertexShader = /* glsl */ `
  uniform float uTime;
  uniform float uMouthOpen;
  uniform float uBrowRaise;
  uniform float uSmile;
  uniform float uEyeBlink;
  uniform float uPixelRatio;
  uniform float uMouseX;
  uniform float uMouseY;
  uniform float uIntroProgress;

  attribute vec3 aMouthOpen;
  attribute vec3 aBrowRaise;
  attribute vec3 aSmile;
  attribute vec3 aEyeBlink;
  attribute float aRandom;

  varying float vAlpha;
  varying float vRandom;
  varying vec3 vViewPos;
  varying vec3 vWorldPos;
  varying float vViewDepthNorm;
  varying float vFade;
  varying float vFacing;

  void main() {

    vec3 pos = position
      + aMouthOpen * uMouthOpen
      + aBrowRaise * uBrowRaise
      + aSmile     * uSmile
      + aEyeBlink  * uEyeBlink;

    float maskNeck = smoothstep(-0.6, -0.2, pos.y);

    float targetLookX = clamp(uMouseX * 1.3, -1.2, 0.85);
    float lookX = targetLookX * maskNeck;
    float lookY = uMouseY * 0.8 * maskNeck;

    float cosX = cos(lookX);
    float sinX = sin(lookX);
    float nx = pos.x * cosX - pos.z * sinX;
    float nz = pos.x * sinX + pos.z * cosX;
    pos.x = nx;
    pos.z = nz;

    float cosY = cos(-lookY);
    float sinY = sin(-lookY);
    float ny = pos.y * cosY - pos.z * sinY;
    nz = pos.y * sinY + pos.z * cosY;
    pos.y = ny;
    pos.z = nz;

    float wobbleFreq = 0.7 + aRandom * 0.4;
    float wobbleAmp  = 0.002 + aRandom * 0.002;
    pos.x += sin(uTime * wobbleFreq + aRandom * 6.28) * wobbleAmp;
    pos.y += cos(uTime * wobbleFreq * 0.8 + aRandom * 3.14) * wobbleAmp;
    pos.z += sin(uTime * wobbleFreq * 0.6 + aRandom * 1.57) * wobbleAmp * 0.5;

    vFade = 1.0;

    float maskY = smoothstep(0.4, 0.9, position.y) + smoothstep(-0.3, -0.9, position.y);
    float maskX = smoothstep(0.45, 0.75, abs(position.x));
    float dissolveFactor = clamp(maskY + maskX, 0.0, 1.0);

    if (dissolveFactor > 0.0) {

      float flowTime = uTime * 0.15 + aRandom * 100.0;
      float progress = fract(flowTime); 

      float driftStrength = 1.0 * dissolveFactor * (0.6 + aRandom * 0.4);
      float drift = progress * driftStrength;

      float topMask = smoothstep(0.4, 1.0, position.y);
      float cheekMask = smoothstep(0.4, 0.8, abs(position.x)) * smoothstep(-0.2, 0.4, position.y);
      float neckMask = smoothstep(-0.4, -1.0, position.y);

      float speedMult = mix(1.0, 0.08, neckMask); 
      float actualDrift = drift * speedMult;

      float gravity = pow(progress, 1.5) * driftStrength * 1.5 * speedMult;
      pos.y -= actualDrift * neckMask * 0.8 + gravity;

      pos.x += sign(pos.x) * actualDrift * 0.4 * neckMask;

      pos.z -= actualDrift * 0.5 * (topMask + cheekMask); 

      pos.x += sin(flowTime * 2.5 + position.y * 5.0) * actualDrift * 0.08;

      float alphaFade = 1.0 - smoothstep(0.3, 0.95, progress);
      vFade = alphaFade * (1.0 - dissolveFactor * 0.1);
    }

    float initProgress = clamp((uIntroProgress - aRandom * 0.5) / 0.5, 0.0, 1.0);

    initProgress = initProgress * initProgress * (3.0 - 2.0 * initProgress); 

    vec3 scatterOffset = vec3(
       sin(aRandom * 123.0) * (6.0 + aRandom * 6.0),
       -8.0 - aRandom * 5.0,
       cos(aRandom * 123.0) * (6.0 + aRandom * 6.0)
    );

    pos = mix(scatterOffset, pos, initProgress);

    vec4 mvPosition = modelViewMatrix * vec4(pos, 1.0);
    float dist = -mvPosition.z;

    float baseSize = 2.2 + aRandom * 0.8;
    gl_PointSize = baseSize * uPixelRatio * (180.0 / dist);
    gl_PointSize = clamp(gl_PointSize, 1.0, 6.0);

    gl_Position = projectionMatrix * mvPosition;

    vViewPos = mvPosition.xyz;
    vWorldPos = pos;
    vRandom = aRandom;

    vViewDepthNorm = smoothstep(2.5, 6.5, dist);

    vec3 centerView = (modelViewMatrix * vec4(0.0, 0.2, 0.0, 1.0)).xyz;
    vec3 viewNormal = normalize(mvPosition.xyz - centerView);
    vFacing = viewNormal.z;

    vAlpha = (0.9 + aRandom * 0.1) * smoothstep(0.0, 0.8, initProgress);
  }
`;

const fragmentShader = /* glsl */ `
  varying float vAlpha;
  varying float vRandom;
  varying vec3 vViewPos;
  varying vec3 vWorldPos;
  varying float vViewDepthNorm;
  varying float vFade;
  varying float vFacing;

  void main() {
    float dist = length(gl_PointCoord - vec2(0.5));
    if (dist > 0.5) discard;

    float core = smoothstep(0.18, 0.0, dist);
    float glow = 1.0 - smoothstep(0.0, 0.5, dist);
    glow = pow(glow, 1.3);
    float brightness = core * 0.65 + glow * 0.35;

    float depthLight = 1.0 - vViewDepthNorm * 0.7;

    float frontFacing = smoothstep(-0.3, 0.9, vWorldPos.z);

    float lighting = mix(0.45, 1.0, frontFacing * depthLight);

    float edgeDist = length(vWorldPos.xy);
    float totalDist = length(vWorldPos.xyz);
    float rimFactor = 0.0;
    if (totalDist > 0.01) {
      rimFactor = smoothstep(0.55, 0.92, edgeDist / totalDist) * 0.5;
    }

    float yNorm = smoothstep(-1.2, 1.2, vWorldPos.y);

    vec3 colorBottom = vec3(0.08, 0.12, 0.65);

    vec3 colorMid = vec3(0.05, 0.55, 0.85);

    vec3 colorTop = vec3(0.1, 0.85, 0.65);

    vec3 baseColor;
    if (yNorm < 0.45) {
      baseColor = mix(colorBottom, colorMid, yNorm / 0.45);
    } else {
      baseColor = mix(colorMid, colorTop, (yNorm - 0.45) / 0.55);
    }

    vec3 brightColor = vec3(0.2, 0.9, 1.0);
    baseColor = mix(baseColor, brightColor, frontFacing * 0.3);

    vec3 rimColor = vec3(0.4, 0.85, 1.0);

    vec3 color = baseColor * lighting + rimColor * rimFactor;

    color *= 1.35; 

    color = min(color, 1.0);

    float backfaceMask = smoothstep(-0.2, 0.2, vFacing);

    float finalAlpha = brightness * vAlpha * (lighting * 0.8 + rimFactor + 0.2) * vFade * backfaceMask;
    finalAlpha = clamp(finalAlpha, 0.0, 1.0);

    gl_FragColor = vec4(color, finalAlpha);
  }
`;

export class ParticleSystem {
  public readonly points: THREE.Points;
  private readonly uniforms: Record<string, THREE.IUniform>;

  constructor(faceData: FaceData) {
    const { positions, morphTargets, particleCount } = faceData;

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute(
      "aMouthOpen",
      new THREE.BufferAttribute(morphTargets.mouthOpen, 3),
    );
    geometry.setAttribute(
      "aBrowRaise",
      new THREE.BufferAttribute(morphTargets.browRaise, 3),
    );
    geometry.setAttribute(
      "aSmile",
      new THREE.BufferAttribute(morphTargets.smile, 3),
    );
    geometry.setAttribute(
      "aEyeBlink",
      new THREE.BufferAttribute(morphTargets.eyeBlink, 3),
    );

    const randoms = new Float32Array(particleCount);
    for (let i = 0; i < particleCount; i++) randoms[i] = Math.random();
    geometry.setAttribute("aRandom", new THREE.BufferAttribute(randoms, 1));

    this.uniforms = {
      uTime: { value: 0 },
      uMouthOpen: { value: 0 },
      uBrowRaise: { value: 0 },
      uSmile: { value: 0 },
      uEyeBlink: { value: 0 },
      uPixelRatio: { value: Math.min(window.devicePixelRatio, 2) },
      uMouseX: { value: 0 },
      uMouseY: { value: 0 },
      uIntroProgress: { value: 0 },
    };

    const material = new THREE.ShaderMaterial({
      vertexShader,
      fragmentShader,
      uniforms: this.uniforms,
      transparent: true,
      depthWrite: false,
      depthTest: true,
      blending: THREE.AdditiveBlending,
    });

    this.points = new THREE.Points(geometry, material);
  }

  update(
    time: number,
    animState: AnimationState,
    mouseX: number = 0,
    mouseY: number = 0,
    introProgress: number = 1.0,
  ) {
    this.uniforms.uTime.value = time;
    this.uniforms.uMouthOpen.value = animState.mouthOpen;
    this.uniforms.uBrowRaise.value = animState.browRaise;
    this.uniforms.uSmile.value = animState.smile;
    this.uniforms.uEyeBlink.value = animState.eyeBlink;
    this.uniforms.uMouseX.value = mouseX;
    this.uniforms.uMouseY.value = mouseY;
    this.uniforms.uIntroProgress.value = introProgress;

    this.points.rotation.y = animState.headRotY * 0.5;
    this.points.rotation.x = animState.headRotX * 0.5;
    this.points.rotation.z = animState.headRotZ * 0.5;
  }

  handleResize() {
    this.uniforms.uPixelRatio.value = Math.min(window.devicePixelRatio, 2);
  }
}
