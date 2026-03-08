import * as THREE from "three";

export class CameraController {
  private camera: THREE.PerspectiveCamera;
  private time = 0;

  private readonly cameraOffsetX = -1.0;
  private readonly cameraOffsetY = 0.15; 
  private readonly target = new THREE.Vector3(
    this.cameraOffsetX,
    this.cameraOffsetY,
    0,
  );

  private readonly baseDistance = 3.6;

  private mouseX = 0;
  private mouseY = 0;
  private currentX = 0;
  private currentY = 0;

  constructor(camera: THREE.PerspectiveCamera) {
    this.camera = camera;
    
    this.camera.position.set(
      this.cameraOffsetX,
      this.cameraOffsetY,
      this.baseDistance,
    );
    this.camera.lookAt(this.target);

    window.addEventListener("mousemove", this.onMouseMove.bind(this));

    window.addEventListener(
      "touchmove",
      (e) => {
        if (e.touches.length > 0) {
          let ndcX = (e.touches[0].clientX / window.innerWidth) * 2 - 1;
          let ndcY = (e.touches[0].clientY / window.innerHeight) * 2 - 1;
          ndcX -= 0.37;
          ndcY -= -0.10;
          this.mouseX = -ndcX;
          this.mouseY = -ndcY;
        }
      },
      { passive: true },
    );

    document.addEventListener("mouseleave", () => {
      this.mouseX = 0;
      this.mouseY = 0;
    });
  }

  private onMouseMove(event: MouseEvent) {
    let ndcX = (event.clientX / window.innerWidth) * 2 - 1;
    let ndcY = (event.clientY / window.innerHeight) * 2 - 1;

    ndcX -= 0.37; 
    ndcY -= -0.10; 
    this.mouseX = -ndcX;
    this.mouseY = -ndcY;
  }

  public getMouseOffset(): { x: number; y: number } {
    return { x: this.currentX, y: this.currentY };
  }

  update(dt: number) {
    this.time += dt;

    this.currentX += (this.mouseX - this.currentX) * dt * 4.0;
    this.currentY += (this.mouseY - this.currentY) * dt * 4.0;

    const swayAmpX = 0.3; 
    const swayAmpY = 0.2; 

    const x = this.cameraOffsetX + this.currentX * swayAmpX;
    const y = this.cameraOffsetY + this.currentY * swayAmpY;
    const z = this.baseDistance - Math.abs(this.currentX) * 0.1;

    const autoSwayX = Math.sin(this.time * 0.5) * 0.05;
    const autoSwayY = Math.sin(this.time * 0.3) * 0.05;

    this.camera.position.set(x + autoSwayX, y + autoSwayY, z);
    this.camera.lookAt(this.target);
  }
}
