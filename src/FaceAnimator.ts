export interface AnimationState {
  mouthOpen: number; 
  browRaise: number; 
  smile: number; 
  eyeBlink: number; 
  headRotY: number; 
  headRotX: number; 
  headRotZ: number; 
}

export class FaceAnimator {
  private time = 0;

  private currentMouth = 0; 
  private targetMouth = 0; 

  private blinkTimer = 0;
  private nextBlinkAt: number; 
  private blinkProgress = 0; 
  private isBlinking = false;

  private currentSmile = 0;
  private targetSmile = 0;
  private smileTimer = 0;
  private nextSmileChange: number;

  constructor() {
    this.nextBlinkAt = 2 + Math.random() * 3; 
    this.nextSmileChange = 4 + Math.random() * 6;
  }

  update(dt: number): AnimationState {
    this.time += dt;
    const t = this.time;

    const talkCycle = Math.sin(t * 2.0) * 0.5 + 0.5; 
    const syllable = Math.sin(t * 4.5) * 0.5 + 0.5; 
    const variation = Math.sin(t * 1.2) * 0.3; 

    const pauseCycle = Math.sin(t * 0.4); 
    const isTalking = pauseCycle > -0.3 ? 1.0 : 0.0; 

    this.targetMouth =
      (talkCycle * 0.5 + syllable * 0.35 + variation) * isTalking;
    this.targetMouth = Math.max(0, Math.min(0.85, this.targetMouth));

    const mouthLerp = 6.0;
    this.currentMouth +=
      (this.targetMouth - this.currentMouth) * Math.min(1, mouthLerp * dt);

    const mouthOpen = Math.max(0, Math.min(1, this.currentMouth));

    this.blinkTimer += dt;

    if (!this.isBlinking && this.blinkTimer >= this.nextBlinkAt) {
      this.isBlinking = true;
      this.blinkProgress = 0;
      this.blinkTimer = 0;
    }

    let eyeBlink = 0;
    if (this.isBlinking) {
      this.blinkProgress += dt;
      const blinkDuration = 0.18;
      const halfBlink = blinkDuration / 2;

      if (this.blinkProgress < halfBlink) {

        eyeBlink = this.blinkProgress / halfBlink;
      } else if (this.blinkProgress < blinkDuration) {

        eyeBlink = 1.0 - (this.blinkProgress - halfBlink) / halfBlink;
      } else {

        eyeBlink = 0;
        this.isBlinking = false;
        this.blinkTimer = 0;

        this.nextBlinkAt = 2.5 + Math.random() * 3.5;

        if (Math.random() < 0.2) {
          this.nextBlinkAt = 0.3 + Math.random() * 0.3;
        }
      }
    }

    this.smileTimer += dt;
    if (this.smileTimer >= this.nextSmileChange) {
      this.smileTimer = 0;
      this.nextSmileChange = 5 + Math.random() * 8;

      this.targetSmile = Math.random() < 0.5 ? 0.2 + Math.random() * 0.5 : 0;
    }

    this.currentSmile +=
      (this.targetSmile - this.currentSmile) * Math.min(1, 1.5 * dt);
    const smile = Math.max(0, Math.min(1, this.currentSmile));

    const browEmphasis = Math.max(0, mouthOpen - 0.5) * 0.5;
    const browSlow = (Math.sin(t * 0.3) * 0.5 + 0.5) * 0.1;
    const browRaise = Math.max(0, Math.min(1, browEmphasis + browSlow));

    const headRotY = Math.sin(t * 0.15) * 0.08 + Math.sin(t * 0.08) * 0.04;
    const headRotX =
      Math.sin(t * 0.12 + 1.0) * 0.04 + Math.sin(t * 0.06) * 0.02;
    const headRotZ = Math.sin(t * 0.1 + 2.0) * 0.012;

    return {
      mouthOpen,
      browRaise,
      smile,
      eyeBlink,
      headRotY,
      headRotX,
      headRotZ,
    };
  }
}
