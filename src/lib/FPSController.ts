import * as THREE from 'three';
import { sounds } from './sounds';

export interface WeaponDef {
  id: string;
  name: string;
  maxAmmo: number;
  color: number;
  speed: number;
  fireRate: number; // minimum delay between shots in ms
  reloadTime: number; // ms
  automatic: boolean;
  size: number;
  explosionRadius: number;
  gravity: number;
}

export const WEAPONS: WeaponDef[] = [
  { id: 'ar', name: 'Auto Rifle', maxAmmo: 30, color: 0x00ffff, speed: 2.0, fireRate: 150, reloadTime: 1500, automatic: true, size: 0.15, explosionRadius: 0, gravity: 0 },
  { id: 'smg', name: 'Submachine Gun', maxAmmo: 50, color: 0xffff00, speed: 2.5, fireRate: 80, reloadTime: 1200, automatic: true, size: 0.1, explosionRadius: 0, gravity: 0 },
  { id: 'rocket', name: 'Rocket Launcher', maxAmmo: 5, color: 0xff0000, speed: 1.0, fireRate: 1000, reloadTime: 2500, automatic: false, size: 0.3, explosionRadius: 5, gravity: 0 },
  { id: 'grenade', name: 'Grenades', maxAmmo: 4, color: 0x00ff00, speed: 0.6, fireRate: 800, reloadTime: 2000, automatic: false, size: 0.2, explosionRadius: 8, gravity: 0.05 },
];

export interface FPSStats {
  score: number;
  ammo: number;
  maxAmmo: number;
  isLocked: boolean;
  isReloading: boolean;
  activeWeapon: number;
  unlockedWeapons: boolean[];
}

interface Pickup {
  mesh: THREE.Mesh;
  weaponIndex: number;
}

export class FPSController {
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private renderer: THREE.WebGLRenderer;
  private container: HTMLElement;
  
  private velocity = new THREE.Vector3();
  private direction = new THREE.Vector3();
  private projectiles: THREE.Mesh[] = [];
  private targets: THREE.Mesh[] = [];
  private pickups: Pickup[] = [];
  private obstacles = new THREE.Group();
  private explosions: { mesh: THREE.Mesh; maxRadius: number; age: number }[] = [];
  
  private keys: Record<string, boolean> = {};
  private activeWeapon = 0;
  private weaponAmmo = WEAPONS.map(w => w.maxAmmo);
  private weaponUnlocked = [true, false, false, false];
  private score = 0;
  private isLocked = false;
  private isReloading = false;
  private isMouseDown = false;
  private lastShotTime = 0;
  
  private playerVelocity = new THREE.Vector3();
  private canJump = false;
  
  private clock = new THREE.Clock();
  private animateId: number | null = null;
  private onStatsUpdate: (stats: FPSStats) => void;

  constructor(container: HTMLElement, onStatsUpdate: (stats: FPSStats) => void) {
    this.container = container;
    this.onStatsUpdate = onStatsUpdate;

    const width = container.clientWidth || window.innerWidth;
    const height = container.clientHeight || window.innerHeight;

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x020205);
    this.scene.fog = new THREE.FogExp2(0x020205, 0.012);

    this.camera = new THREE.PerspectiveCamera(75, width / height, 0.1, 1000);
    this.camera.position.set(0, 1.6, 0);

    this.renderer = new THREE.WebGLRenderer({ 
      antialias: true,
      powerPreference: 'high-performance'
    });
    this.renderer.setSize(width, height);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.container.appendChild(this.renderer.domElement);

    const ambientLight = new THREE.AmbientLight(0x404040, 2);
    this.scene.add(ambientLight);
    const pointLight = new THREE.PointLight(0x00d2ff, 1, 100);
    pointLight.position.set(0, 20, 0);
    this.scene.add(pointLight);

    const gridHelper = new THREE.GridHelper(500, 100, 0x00d2ff, 0x004466);
    gridHelper.position.y = -0.5;
    this.scene.add(gridHelper);

    this.scene.add(this.obstacles);
    this.initBuildings();

    for (let i = 0; i < 20; i++) this.spawnTarget();
    this.initPickups();

    this.bindEvents();
    this.updateStats();
    this.animate();
  }

  private createBlock(w: number, h: number, d: number, x: number, y: number, z: number, rotX = 0, rotY = 0, rotZ = 0, color = 0x001122) {
    const geom = new THREE.BoxGeometry(w, h, d);
    const mat = new THREE.MeshPhongMaterial({
       color: color,
       emissive: 0x00d2ff,
       emissiveIntensity: 0.1,
       transparent: true,
       opacity: 0.8
    });
    const mesh = new THREE.Mesh(geom, mat);
    mesh.position.set(x, y, z);
    if(rotX) mesh.rotation.x = rotX;
    if(rotY) mesh.rotation.y = rotY;
    if(rotZ) mesh.rotation.z = rotZ;
    this.obstacles.add(mesh);
    
    const edgesGeom = new THREE.EdgesGeometry(geom);
    const lineMat = new THREE.LineBasicMaterial({ color: 0x00d2ff });
    const line = new THREE.LineSegments(edgesGeom, lineMat);
    line.position.copy(mesh.position);
    line.rotation.copy(mesh.rotation);
    this.scene.add(line);
    return mesh;
  }

  private initBuildings() {
    // Floor foundation
    this.createBlock(250, 1, 250, 0, -1, 0, 0, 0, 0, 0x000a11);
    
    // Central Complex
    this.createBlock(30, 5, 30, 0, 2, -30); // Level 1
    this.createBlock(15, 10, 15, 0, 4.5, -30); // Level 2
    
    // Ramps
    this.createBlock(10, 1, 20, 0, 1.5, -12, Math.PI / 8); // Access L1
    this.createBlock(6, 1, 15, 0, 6, -18, Math.PI / 6); // Access L2
    
    // Outer raised walkway
    this.createBlock(100, 3, 10, 0, 1, -80);
    this.createBlock(10, 3, 100, -50, 1, -30);
    this.createBlock(10, 3, 100, 50, 1, -30);
    
    // Cover blocks (randomized scatter)
    for (let i = 0; i < 40; i++) {
        const x = (Math.random() - 0.5) * 150;
        const z = (Math.random() - 0.5) * 150;
        if (Math.abs(x) < 20 && Math.abs(z) < 20) continue; // Keep center clear
        
        this.createBlock(
          2 + Math.random() * 6,
          2 + Math.random() * 4,
          2 + Math.random() * 6,
          x,
          0.5,
          z,
          0, Math.random() * Math.PI, 0
        );
    }

    // Tall Pillars for verticality visual
    for (let i = 0; i < 15; i++) {
        const x = (Math.random() - 0.5) * 200;
        const z = (Math.random() - 0.5) * 200;
        if (Math.abs(x) < 40 && Math.abs(z) < 40) continue;
        this.createBlock(3, 30, 3, x, 14, z, 0, 0, 0, 0x001144);
    }
  }

  private initPickups() {
    const geom = new THREE.OctahedronGeometry(0.5);
    for (let i = 1; i < WEAPONS.length; i++) {
       const w = WEAPONS[i];
       const mat = new THREE.MeshPhongMaterial({ 
         color: w.color, 
         emissive: w.color, 
         emissiveIntensity: 0.8,
         wireframe: true 
       });
       const mesh = new THREE.Mesh(geom, mat);
       
       // Fixed locations for pickups to encourage exploration
       if (i === 1) mesh.position.set(-45, 3.5, -30); // SMG on walkway
       if (i === 2) mesh.position.set(0, 10.5, -30); // Rocket top of central structure
       if (i === 3) mesh.position.set(50, 3.5, -30); // Grenades right walkway
       
       this.scene.add(mesh);
       this.pickups.push({ mesh, weaponIndex: i });
    }
  }

  private spawnTarget() {
    const geom = new THREE.IcosahedronGeometry(1, 0);
    const mat = new THREE.MeshPhongMaterial({
      color: 0xff00ff,
      emissive: 0xff00ff,
      emissiveIntensity: 0.5,
      wireframe: true
    });
    const target = new THREE.Mesh(geom, mat);
    target.position.set(
      (Math.random() - 0.5) * 160,
      1 + Math.random() * 15, // Varied height
      (Math.random() - 0.5) * 160
    );
    target.userData = { 
      oscillation: Math.random() * Math.PI * 2, 
      speed: 1 + Math.random() * 2, 
      hit: false 
    };
    this.scene.add(target);
    this.targets.push(target);
  }

  private bindEvents() {
    window.addEventListener('keydown', this.handleKeyDown);
    window.addEventListener('keyup', this.handleKeyUp);
    this.container.addEventListener('mousedown', this.handleMouseDown);
    window.addEventListener('mouseup', this.handleMouseUp);
    window.addEventListener('mousemove', this.handleMouseMove);
    document.addEventListener('pointerlockchange', this.handleLockChange);
    window.addEventListener('resize', this.handleResize);
  }

  private unbindEvents() {
    window.removeEventListener('keydown', this.handleKeyDown);
    window.removeEventListener('keyup', this.handleKeyUp);
    this.container.removeEventListener('mousedown', this.handleMouseDown);
    window.removeEventListener('mouseup', this.handleMouseUp);
    window.removeEventListener('mousemove', this.handleMouseMove);
    document.removeEventListener('pointerlockchange', this.handleLockChange);
    window.removeEventListener('resize', this.handleResize);
  }

  private handleKeyDown = (e: KeyboardEvent) => { 
    this.keys[e.code] = true; 
    
    if (e.code === 'KeyR' && !this.isReloading && this.weaponAmmo[this.activeWeapon] < WEAPONS[this.activeWeapon].maxAmmo) {
      this.reload();
    }

    if (e.code === 'Space' && this.canJump) {
      this.playerVelocity.y = 12.0;
      this.canJump = false;
      this.keys[e.code] = false; // Prevent holding jump
    }

    if (!this.isReloading) {
       if (e.code === 'Digit1') this.switchWeapon(0);
       if (e.code === 'Digit2') this.switchWeapon(1);
       if (e.code === 'Digit3') this.switchWeapon(2);
       if (e.code === 'Digit4') this.switchWeapon(3);
    }
  };
  
  private handleKeyUp = (e: KeyboardEvent) => { this.keys[e.code] = false; };
  
  private handleMouseDown = (e: MouseEvent) => {
    if (e.button !== 0) return; // Only left click
    if (!this.isLocked) {
      this.container.requestPointerLock()?.catch(err => {
        console.error("POINTER_LOCK_DENIED", err);
      });
    } else {
      this.isMouseDown = true;
      if (!WEAPONS[this.activeWeapon].automatic) {
         this.shoot();
      }
    }
  };

  private handleMouseUp = (e: MouseEvent) => {
    if (e.button === 0) this.isMouseDown = false;
  };

  private switchWeapon(index: number) {
    if (index >= 0 && index < WEAPONS.length && this.weaponUnlocked[index] && this.activeWeapon !== index) {
      this.activeWeapon = index;
      this.isMouseDown = false; 
      this.updateStats();
    }
  }

  private handleMouseMove = (e: MouseEvent) => {
    if (document.pointerLockElement === this.container) {
      this.camera.rotation.order = 'YXZ';
      this.camera.rotation.y -= e.movementX * 0.002;
      this.camera.rotation.x -= e.movementY * 0.002;
      this.camera.rotation.x = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, this.camera.rotation.x));
    }
  };

  private handleLockChange = () => {
    this.isLocked = document.pointerLockElement === this.container;
    if (!this.isLocked) this.isMouseDown = false;
    this.updateStats();
  };

  private handleResize = () => {
    const w = this.container.clientWidth;
    const h = this.container.clientHeight;
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h);
  };

  private shoot() {
    if (this.isReloading || !this.isLocked) return;
    const weapon = WEAPONS[this.activeWeapon];
    if (this.weaponAmmo[this.activeWeapon] <= 0) return;

    const now = performance.now();
    if (now - this.lastShotTime < weapon.fireRate) return;
    this.lastShotTime = now;

    this.weaponAmmo[this.activeWeapon] -= 1;
    this.updateStats();
    sounds.playShoot();

    const projectileGeom = new THREE.SphereGeometry(weapon.size, 8, 8);
    const projectileMat = new THREE.MeshBasicMaterial({ color: weapon.color });
    const projectile = new THREE.Mesh(projectileGeom, projectileMat);
    projectile.position.copy(this.camera.position);

    const dir = new THREE.Vector3(0, 0, -1).applyQuaternion(this.camera.quaternion);
    
    projectile.userData = {
       velocity: dir.multiplyScalar(weapon.speed * (weapon.id === 'grenade' ? 0.3 : 1.0)),
       weaponIndex: this.activeWeapon,
       gravity: weapon.gravity
    };
    
    // Add an upward arc for grenades automatically
    if (weapon.id === 'grenade') {
       projectile.userData.velocity.y += 0.3;
    }

    this.scene.add(projectile);
    this.projectiles.push(projectile);
    
    setTimeout(() => {
      this.removeProjectile(projectile);
    }, 4000);
  }

  private removeProjectile(p: THREE.Mesh) {
    if (this.projectiles.includes(p)) {
      this.scene.remove(p);
      this.projectiles = this.projectiles.filter(x => x !== p);
    }
  }

  private spawnExplosion(position: THREE.Vector3, radius: number, color: number) {
    const geom = new THREE.IcosahedronGeometry(1, 1);
    const mat = new THREE.MeshBasicMaterial({ 
        color, 
        transparent: true, 
        opacity: 0.8,
        wireframe: true
    });
    const mesh = new THREE.Mesh(geom, mat);
    mesh.position.copy(position);
    this.scene.add(mesh);
    this.explosions.push({ mesh, maxRadius: radius, age: 0 });
  }

  private updateStats() {
    this.onStatsUpdate({
      score: this.score,
      ammo: this.weaponAmmo[this.activeWeapon],
      maxAmmo: WEAPONS[this.activeWeapon].maxAmmo,
      isLocked: this.isLocked,
      isReloading: this.isReloading,
      activeWeapon: this.activeWeapon,
      unlockedWeapons: [...this.weaponUnlocked]
    });
  }

  private reload() {
    this.isReloading = true;
    this.updateStats();
    
    const wIndex = this.activeWeapon;
    setTimeout(() => {
      if (this.activeWeapon === wIndex) {
         this.weaponAmmo[wIndex] = WEAPONS[wIndex].maxAmmo;
      } else {
         this.weaponAmmo[wIndex] = WEAPONS[wIndex].maxAmmo; 
      }
      this.isReloading = false;
      this.updateStats();
    }, WEAPONS[wIndex].reloadTime);
  }

  private getOcclusionAt(position: THREE.Vector3) {
    const raycaster = new THREE.Raycaster();
    const dir = new THREE.Vector3().subVectors(position, this.camera.position).normalize();
    const dist = position.distanceTo(this.camera.position);
    raycaster.set(this.camera.position, dir);
    const intersects = raycaster.intersectObjects(this.obstacles.children, true);
    let occluded = 0;
    for (const hit of intersects) if (hit.distance < dist) occluded += 0.5;
    return Math.min(occluded, 0.95);
  }

  private destroyTarget(target: THREE.Mesh) {
    if (target.userData.hit) return;
    target.userData.hit = true;
    this.score += 1;
    this.updateStats();
    
    const occlusion = this.getOcclusionAt(target.position);
    sounds.playExplosion(occlusion);
    sounds.playSuccess(occlusion);
    
    target.scale.set(1.5, 1.5, 1.5);
    if (target.material instanceof THREE.MeshPhongMaterial) {
      target.material.color.set(0x00ffff);
      target.material.emissive.set(0x00ffff);
      target.material.wireframe = false;
    }
    
    setTimeout(() => {
      this.scene.remove(target);
      this.targets = this.targets.filter(x => x !== target);
      this.spawnTarget();
    }, 150);
  }

  private handleProjectileImpact(p: THREE.Mesh, point: THREE.Vector3, directTarget?: THREE.Mesh) {
    const weapon = WEAPONS[p.userData.weaponIndex];
    
    if (weapon.explosionRadius > 0) {
        this.spawnExplosion(point, weapon.explosionRadius, weapon.color);
        sounds.playExplosion(this.getOcclusionAt(point));
        
        this.targets.forEach(target => {
            if (!target.userData.hit && target.position.distanceTo(point) <= weapon.explosionRadius) {
                this.destroyTarget(target);
            }
        });
    } else {
        if (directTarget) {
            this.destroyTarget(directTarget);
        }
    }
    this.removeProjectile(p);
  }

  private animate = () => {
    const delta = Math.min(this.clock.getDelta(), 0.1); // Cap delta to prevent huge jumps on lag
    this.animateId = requestAnimationFrame(this.animate);

    if (this.isLocked) {
      // 1. Move Player (Horizontal)
      this.velocity.x -= this.velocity.x * 10.0 * delta;
      this.velocity.z -= this.velocity.z * 10.0 * delta;
      
      this.direction.z = (this.keys['KeyW'] ? 1 : 0) - (this.keys['KeyS'] ? 1 : 0);
      this.direction.x = (this.keys['KeyD'] ? 1 : 0) - (this.keys['KeyA'] ? 1 : 0);
      this.direction.normalize();

      if (this.keys['KeyW'] || this.keys['KeyS']) this.velocity.z += this.direction.z * 100.0 * delta;
      if (this.keys['KeyA'] || this.keys['KeyD']) this.velocity.x += this.direction.x * 100.0 * delta;
      
      // Calculate intended horizontal movement
      const oldPos = this.camera.position.clone();
      this.camera.translateX(this.velocity.x * delta);
      this.camera.translateZ(-this.velocity.z * delta);
      
      const horizontalMove = this.camera.position.clone().sub(oldPos);
      horizontalMove.y = 0; // Ignore y for wall collision check
      
      if (horizontalMove.lengthSq() > 0.0001) {
          const moveDir = horizontalMove.clone().normalize();
          const chestHeight = new THREE.Vector3(oldPos.x, oldPos.y - 0.5, oldPos.z);
          const wallRaycaster = new THREE.Raycaster(chestHeight, moveDir, 0, horizontalMove.length() + 0.3);
          const wallHits = wallRaycaster.intersectObject(this.obstacles, true);
          
          if (wallHits.length > 0 && wallHits[0].face && Math.abs(wallHits[0].face.normal.y) < 0.5) {
              // Revert horizontal movement if it hit a vertical wall
              this.camera.position.x = oldPos.x;
              this.camera.position.z = oldPos.z;
          }
      }

      // 2. Vertical Movement & Gravity
      this.playerVelocity.y -= 30.0 * delta; // Gravity
      this.camera.position.y += this.playerVelocity.y * delta;

      // Floor Raycast
      const rayOrigin = this.camera.position.clone();
      const floorRaycaster = new THREE.Raycaster(rayOrigin, new THREE.Vector3(0, -1, 0), 0, 1.61);
      const floorHits = floorRaycaster.intersectObject(this.obstacles, true);

      if (floorHits.length > 0 && this.playerVelocity.y <= 0) {
          this.camera.position.y = floorHits[0].point.y + 1.6;
          this.playerVelocity.y = 0;
          this.canJump = true;
      } else {
          this.canJump = false;
      }

      // Death pit respawn
      if (this.camera.position.y < -15) {
          this.camera.position.set(0, 5, 0);
          this.playerVelocity.y = 0;
      }

      // Audio feedback for moving
      if (this.canJump && (Math.abs(this.velocity.x) > 0.1 || Math.abs(this.velocity.z) > 0.1)) {
        if (Math.floor(performance.now() / 300) !== Math.floor((performance.now() - delta * 1000) / 300)) {
          sounds.playMove();
        }
      }
      
      // Auto fire
      if (this.isMouseDown && WEAPONS[this.activeWeapon].automatic) {
         this.shoot();
      }
      
      // Handle Pickups
      for (let i = this.pickups.length - 1; i >= 0; i--) {
        const pickup = this.pickups[i];
        pickup.mesh.rotation.y += delta;
        pickup.mesh.rotation.x += delta * 0.5;
        
        if (this.camera.position.distanceTo(pickup.mesh.position) < 2.5) {
          this.weaponUnlocked[pickup.weaponIndex] = true;
          this.scene.remove(pickup.mesh);
          this.pickups.splice(i, 1);
          this.switchWeapon(pickup.weaponIndex);
          sounds.playSuccess(0);
        }
      }
    }

    // Handles targets hovering
    this.targets.forEach(t => {
      if (!t.userData.hit) {
        t.userData.oscillation += delta * t.userData.speed;
        t.position.y += Math.sin(t.userData.oscillation) * 0.05;
        t.rotation.y += delta * 2;
        t.rotation.x += delta;
      }
    });

    // Handle Explosions expanding
    for (let i = this.explosions.length - 1; i >= 0; i--) {
        const exp = this.explosions[i];
        exp.age += delta * 4.0; 
        const scale = 0.1 + (exp.age * exp.maxRadius);
        exp.mesh.scale.set(scale, scale, scale);
        
        if (exp.mesh.material instanceof THREE.Material) {
            exp.mesh.material.opacity = Math.max(0, 0.8 - exp.age * 0.8);
        }
        
        if (exp.age >= 1.0) {
            this.scene.remove(exp.mesh);
            this.explosions.splice(i, 1);
        }
    }

    // Handle Projectiles & Intersections
    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      const p = this.projectiles[i];
      
      if (p.userData.gravity) {
         p.userData.velocity.y -= p.userData.gravity * delta * 60;
      }
      
      const oldPos = p.position.clone();
      p.position.add(p.userData.velocity);
      
      let collided = false;

      // Target collisions checking
      for (const target of this.targets) {
        if (!target.userData.hit && p.position.distanceTo(target.position) < 1.5) {
          this.handleProjectileImpact(p, target.position, target);
          collided = true;
          break;
        }
      }
      
      if (collided) continue;

      // Obstacle/Wall collision checking
      const dist = oldPos.distanceTo(p.position);
      if (dist > 0) {
          const dir = p.position.clone().sub(oldPos).normalize();
          const ray = new THREE.Raycaster(oldPos, dir, 0, dist + 0.2);
          const hits = ray.intersectObject(this.obstacles, true);
          if (hits.length > 0) {
              this.handleProjectileImpact(p, hits[0].point);
          }
      }
    }

    this.renderer.render(this.scene, this.camera);
  }

  public dispose() {
    if (this.animateId) cancelAnimationFrame(this.animateId);
    this.unbindEvents();
    this.renderer.dispose();
    this.obstacles.children.forEach(c => {
      if (c instanceof THREE.Mesh) {
        c.geometry.dispose();
        if (Array.isArray(c.material)) c.material.forEach(m => m.dispose());
        else c.material.dispose();
      }
    });
    this.explosions.forEach(e => {
        e.mesh.geometry.dispose();
        if (e.mesh.material instanceof THREE.Material) e.mesh.material.dispose();
    });
    this.container.innerHTML = '';
  }
}
