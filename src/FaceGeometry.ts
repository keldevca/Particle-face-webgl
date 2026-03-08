
export interface FaceMorphTargets {
  mouthOpen: Float32Array;
  browRaise: Float32Array;
  smile: Float32Array;
  eyeBlink: Float32Array;
}

export interface FaceData {
  positions: Float32Array;
  morphTargets: FaceMorphTargets;
  particleCount: number;
}

function smoothstep(edge0: number, edge1: number, x: number): number {
  const t = Math.max(0, Math.min(1, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function gaussian(x: number, center: number, width: number): number {
  const d = (x - center) / width;
  return Math.exp(-d * d);
}

function gaussian2D(
  x: number,
  y: number,
  cx: number,
  cy: number,
  wx: number,
  wy: number,
): number {
  const dx = (x - cx) / wx;
  const dy = (y - cy) / wy;
  return Math.exp(-(dx * dx + dy * dy));
}

export function generateFaceData(particleCount = 50000): FaceData {
  const aspect = 1.35;
  const cols = Math.round(Math.sqrt(particleCount / aspect));
  const rows = Math.round(cols * aspect);
  const actualCount = cols * rows;

  const positions = new Float32Array(actualCount * 3);
  const mouthOpen = new Float32Array(actualCount * 3);
  const browRaise = new Float32Array(actualCount * 3);
  const smile = new Float32Array(actualCount * 3);
  const eyeBlink = new Float32Array(actualCount * 3);

  let idx = 0;

  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const u = col / (cols - 1);
      const v = row / (rows - 1);

      const theta = (u - 0.5) * Math.PI * 2.0;
      const phi = v * Math.PI;

      const headRX = 0.76;
      const headRY = 1.05;
      const headRZ = 0.82;

      let rBase = Math.pow(Math.sin(phi), 0.65);
      const nyBase = Math.cos(phi);

      if (nyBase < -0.5) {
        const neckBlend = smoothstep(-0.5, -0.75, nyBase);
        const neckR = 0.35;
        rBase = lerp(rBase, neckR, neckBlend);
      }

      let x = headRX * rBase * Math.sin(theta);
      let y = headRY * Math.cos(phi);
      let z = headRZ * rBase * Math.cos(theta);

      if (nyBase < -0.65) {
        const shoulderBlend = smoothstep(-0.65, -1.0, nyBase);

        x *= lerp(1.0, 3.8, shoulderBlend);

        z *= lerp(1.0, 0.45, shoulderBlend);
        z -= shoulderBlend * 0.15;

        y -= shoulderBlend * 0.35;
      }

      const ny = y / headRY;
      const ax = Math.abs(x);

      if (ny > 0.35) {
        const foreheadF = smoothstep(0.35, 0.95, ny);
        x *= lerp(1.0, 1.02, foreheadF * gaussian(ny, 0.55, 0.2));
        z *= lerp(1.0, 0.85, foreheadF);
      }

      const hairMask = smoothstep(0.4, 0.95, nyBase) + smoothstep(0.5, 0.9, ax);
      if (hairMask > 0.0) {
        const vol = Math.min(Math.max(hairMask, 0.0), 1.0);
        x *= lerp(1.0, 1.15, vol * smoothstep(0.2, 0.8, ax));
        y *= lerp(1.0, 1.08, vol * smoothstep(0.4, 1.0, nyBase));
        z *= lerp(1.0, 1.12, vol);
      }

      {
        const cheekLevel = gaussian(ny, -0.05, 0.2);
        x *= lerp(1.0, 1.06, cheekLevel);
      }

      if (ny < -0.15) {
        const jawCurve = smoothstep(-0.15, -0.75, ny);

        x *= lerp(1.0, 0.75, jawCurve);
        z *= lerp(1.0, 0.8, jawCurve);

        const jawAngle = gaussian(ny, -0.4, 0.12) * gaussian(ax, 0.48, 0.15);
        if (x !== 0) x += Math.sign(x) * jawAngle * 0.05;
      }

      {

        const chinY = -0.7;
        const chinF = gaussian(ny, chinY, 0.08) * gaussian(ax, 0.0, 0.18);
        z += chinF * 0.18;

        const underChinF = gaussian(ny, -0.8, 0.06) * gaussian(ax, 0.0, 0.25);
        z -= underChinF * 0.12;
      }

      const eyeY = 0.1;
      const eyeSep = 0.24;
      const eyeW = 0.13;
      const eyeH = 0.055;

      for (const side of [-1, 1]) {
        const ex = side * eyeSep;

        const dxe = (x - ex) / eyeW;
        const dye = (y - eyeY) / eyeH;
        const eyeDist = dxe * dxe + dye * dye;

        if (eyeDist < 1.0) {

          const socketDepth = 1.0 - eyeDist;
          z -= socketDepth * 0.16;

          const innerCorner =
            gaussian(x, ex - side * eyeW * 0.6, 0.04) *
            gaussian(y, eyeY, eyeH * 0.8);
          z -= innerCorner * 0.04;
        }

        {
          const lidY = eyeY + 0.05;
          const lidF = gaussian(y, lidY, 0.018) * gaussian(x, ex, eyeW * 0.9);
          z += lidF * 0.05;
        }

        {
          const lowerLidY = eyeY - 0.04;
          const lowerF =
            gaussian(y, lowerLidY, 0.015) * gaussian(x, ex, eyeW * 0.7);
          z += lowerF * 0.02;
        }

        {
          const browY = eyeY + 0.13;

          const browCenterX = ex - side * 0.02;
          const browWidth = eyeW * 1.2;
          const browF =
            gaussian(y, browY, 0.03) * gaussian(x, browCenterX, browWidth);
          z += browF * 0.08;
          y += browF * 0.01;
        }

        if (eyeDist > 0.7 && eyeDist < 1.5) {
          const rimF = gaussian(Math.sqrt(eyeDist), 1.0, 0.2);
          z += rimF * 0.03;
        }
      }

      {

        const bridgeW = 0.04;
        if (y < eyeY + 0.05 && y > -0.22 && ax < bridgeW * 3) {
          const bridgeF =
            smoothstep(eyeY + 0.05, -0.05, y) * gaussian(ax, 0.0, bridgeW);
          z += bridgeF * 0.15;
        }

        if (y > -0.26 && y < -0.02) {
          const noseBodyW = lerp(0.04, 0.07, smoothstep(-0.02, -0.22, y));
          const bodyF = gaussian(y, -0.13, 0.1) * gaussian(ax, 0.0, noseBodyW);
          z += bodyF * 0.3;
        }

        {
          const tipF = gaussian2D(ax, y, 0.0, -0.22, 0.045, 0.035);
          z += tipF * 0.16;
        }

        {
          const wingF = gaussian(y, -0.22, 0.035) * gaussian(ax, 0.08, 0.03);
          z += wingF * 0.06;
          if (x !== 0) x += Math.sign(x) * wingF * 0.02;
        }

        {
          const nostrilF = gaussian2D(ax, y, 0.045, -0.24, 0.025, 0.02);
          z -= nostrilF * 0.05;
        }

        {
          const nasionF = gaussian(y, eyeY, 0.04) * gaussian(ax, 0.0, 0.04);
          z -= nasionF * 0.03;
        }
      }

      const mouthY = -0.4;
      const mouthW = 0.18;
      {

        {
          const philF =
            gaussian(ax, 0.0, 0.02) *
            smoothstep(-0.28, -0.22, y) *
            smoothstep(mouthY + 0.06, mouthY + 0.02, y);
          z -= philF * 0.03;

          const ridgeF =
            gaussian(ax, 0.018, 0.008) *
            smoothstep(-0.28, -0.22, y) *
            smoothstep(mouthY + 0.06, mouthY + 0.02, y);
          z += ridgeF * 0.015;
        }

        {
          const upperF =
            gaussian(y, mouthY + 0.02, 0.015) * smoothstep(mouthW, 0.0, ax);
          z += upperF * 0.08;

          const bowF =
            gaussian(y, mouthY + 0.025, 0.01) * gaussian(ax, 0.0, 0.02);
          z -= bowF * 0.025;

          const peakF =
            gaussian(y, mouthY + 0.028, 0.008) * gaussian(ax, 0.04, 0.015);
          z += peakF * 0.02;
        }

        {
          const lineF =
            gaussian(y, mouthY, 0.008) * smoothstep(mouthW, 0.0, ax);
          z -= lineF * 0.04;
        }

        {
          const lowerF =
            gaussian(y, mouthY - 0.025, 0.018) *
            smoothstep(mouthW * 0.85, 0.0, ax);
          z += lowerF * 0.07;
        }

        {
          const foldF =
            gaussian(y, mouthY - 0.07, 0.02) * gaussian(ax, 0.0, 0.12);
          z -= foldF * 0.04;
        }

        {
          const cornerF = gaussian2D(ax, y, mouthW, mouthY, 0.02, 0.015);
          z -= cornerF * 0.03;
        }
      }

      {

        const cheekF = gaussian(y, -0.02, 0.08) * gaussian(ax, 0.42, 0.12);
        z += cheekF * 0.12;
        if (x !== 0) x += Math.sign(x) * cheekF * 0.04;

        const hollowF = gaussian(y, -0.18, 0.08) * gaussian(ax, 0.3, 0.1);
        z -= hollowF * 0.06;
      }

      {
        const foldCurveX = lerp(0.1, 0.2, smoothstep(-0.15, -0.4, y));
        const foldF =
          gaussian(ax, foldCurveX, 0.025) *
          smoothstep(-0.42, -0.22, y) *
          smoothstep(-0.18, -0.25, y);
        z += foldF * 0.03;
      }

      {
        const browRidgeF = gaussian(y, 0.25, 0.04) * smoothstep(0.45, 0.0, ax);
        z += browRidgeF * 0.06;
      }

      {
        const templeF = gaussian(y, 0.22, 0.1) * gaussian(ax, 0.52, 0.08);
        z -= templeF * 0.04;
      }

      if (ax > 0.55 && y > -0.1 && y < 0.18) {
        const earCY = 0.04;
        const earF = gaussian(ax, 0.62, 0.04) * gaussian(y, earCY, 0.08);
        if (x !== 0) x += Math.sign(x) * earF * 0.08;
        z -= earF * 0.04;
      }

      if (ny > 0.55) {
        const fhF = smoothstep(0.55, 1.0, ny);
        z *= lerp(1.0, 0.78, fhF);
      }

      if (ny < -0.85) {
        const neckF = smoothstep(-0.85, -1.0, ny);
        z -= neckF * 0.05;
      }

      const jitter = 0.003;
      x += (Math.random() - 0.5) * jitter;
      y += (Math.random() - 0.5) * jitter;
      z += (Math.random() - 0.5) * jitter;

      const i3 = idx * 3;
      positions[i3] = x;
      positions[i3 + 1] = y;
      positions[i3 + 2] = z;

      {
        const distToMouth = Math.sqrt(
          (x / mouthW) * (x / mouthW) +
            ((y - mouthY) / 0.12) * ((y - mouthY) / 0.12),
        );
        const inf = Math.max(0, 1 - distToMouth);

        if (y < mouthY) {

          mouthOpen[i3] = 0;
          mouthOpen[i3 + 1] = -inf * 0.14;
          mouthOpen[i3 + 2] = -inf * 0.03;
        } else if (y < mouthY + 0.08) {

          mouthOpen[i3] = 0;
          mouthOpen[i3 + 1] = inf * 0.03;
          mouthOpen[i3 + 2] = inf * 0.01;
        } else {
          mouthOpen[i3] = mouthOpen[i3 + 1] = mouthOpen[i3 + 2] = 0;
        }
      }

      {
        const browInf = gaussian(y, 0.26, 0.08) * smoothstep(0.4, 0.0, ax);
        browRaise[i3] = 0;
        browRaise[i3 + 1] = browInf * 0.1;
        browRaise[i3 + 2] = browInf * 0.02;
      }

      {
        const smileInf = gaussian(y, mouthY, 0.08) * smoothstep(0.06, 0.18, ax);
        smile[i3] = Math.sign(x) * smileInf * 0.04;
        smile[i3 + 1] = smileInf * 0.06;
        smile[i3 + 2] = smileInf * 0.02;

        const cheekSmile = gaussian(y, -0.12, 0.1) * gaussian(ax, 0.3, 0.1);
        smile[i3 + 1] += cheekSmile * 0.03;
        smile[i3 + 2] += cheekSmile * 0.02;
      }

      {
        let blinkY = 0,
          blinkZ = 0;
        for (const side of [-1, 1]) {
          const ex = side * eyeSep;
          const dxe = Math.abs(x - ex) / eyeW;
          const dye = (y - eyeY) / (eyeH * 1.5);
          const eyeProx = Math.exp(-(dxe * dxe + dye * dye));
          if (eyeProx > 0.1) {
            blinkY += -(y - eyeY) * eyeProx * 0.7;
            blinkZ += -eyeProx * 0.02;
          }
        }
        eyeBlink[i3] = 0;
        eyeBlink[i3 + 1] = blinkY;
        eyeBlink[i3 + 2] = blinkZ;
      }

      idx++;
    }
  }

  return {
    positions: positions.slice(0, idx * 3),
    morphTargets: {
      mouthOpen: mouthOpen.slice(0, idx * 3),
      browRaise: browRaise.slice(0, idx * 3),
      smile: smile.slice(0, idx * 3),
      eyeBlink: eyeBlink.slice(0, idx * 3),
    },
    particleCount: idx,
  };
}
