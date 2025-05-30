// Get canvas and context
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

// Set initial canvas dimensions
canvas.width = 800;
canvas.height = 600;

// Map dimensions
const MAP_WIDTH = 1600;
const MAP_HEIGHT = 1200;
const GRID_SIZE = 50; 

// Factory Durability Constants
const HP_INCREASE_PER_MINUTE = 50; 
const MAX_HP_CAP = 1000;           
const HP_INCREASE_RATE_PER_FRAME = 0.05; 

// Game state variables
let gameOver = false;
let playerMisses = 0; 
let gameStartTime = Date.now();
let factories = [];
let allAntiAirTurrets = []; 
let allTurretBullets = []; 
let allEnemyJets = [];    

// Enemy Jet Spawning Parameters
let jetSpawnTimer = 0;
const initialJetSpawnInterval = 10000; 
let currentJetSpawnInterval = initialJetSpawnInterval; 
const maxEnemyJets = 5; 

// Battleship State
let battleship = null;
let battleshipAppeared = false;
const BATTLESHIP_APPEAR_TIME = 30; 

// Game Progression / Stage Variables
let stageNumber = 1;
let isStageClearing = false; 
let stageClearMessage = "";
let stageClearTimer = 0; 
const stageClearDuration = 3000; 

// Score & Effects
let score = 0;
let explosions = [];

// Developer/Test Variables
let playerInvulnerable = false; // DEV_TEST: Player invulnerability toggle

// Explosion Class
class Explosion {
    constructor(mapX, mapY, maxSize, lifeSpan = 30) { 
        this.mapX = mapX;
        this.mapY = mapY;
        this.size = 0;
        this.maxSize = maxSize;
        this.lifeSpanFrames = lifeSpan; 
        this.framesAlive = 0;
        this.isComplete = false;
    }
    update() {
        if (this.isComplete) return;
        this.framesAlive++;
        const progress = this.framesAlive / this.lifeSpanFrames;
        if (progress < 1) { this.size = this.maxSize * progress; } 
        else { this.size = this.maxSize; this.isComplete = true; }
    }
    draw(viewOriginX, viewOriginY) {
        if (this.isComplete && this.framesAlive > this.lifeSpanFrames) return; 
        const screenX = this.mapX - viewOriginX; const screenY = this.mapY - viewOriginY;
        const progress = Math.min(1, this.framesAlive / this.lifeSpanFrames);
        if (screenX + this.size < 0 || screenX - this.size > canvas.width || screenY + this.size < 0 || screenY - this.size > canvas.height) return;
        ctx.beginPath();
        let color = 'rgba(255, 100, 0, ' + (0.6 * (1 - progress)) + ')'; 
        if (progress > 0.5) color = 'rgba(255, 0, 0, ' + (0.4 * (1 - progress) / 0.5) + ')'; 
        ctx.fillStyle = color; ctx.arc(screenX, screenY, this.size, 0, Math.PI * 2); ctx.fill();
        if (progress < 0.7) { 
            ctx.beginPath(); const coreSize = this.size * (0.6 - progress * 0.5);
            if (coreSize > 0) {
                 let coreColor = 'rgba(255, 255, 100, ' + (0.9 * (0.7 - progress)/0.7) + ')'; 
                 ctx.fillStyle = coreColor; ctx.arc(screenX, screenY, coreSize, 0, Math.PI * 2); ctx.fill();
            }
        }
    }
}

// Refactored ES6 Classes Start

class Factory {
    constructor(mX, mY, id, w = 80, h = 60) {
        this.mapX = mX; this.mapY = mY; this.id = id; this.width = w; this.height = h;
        this.initialMaxHp = 500; this.hp = this.initialMaxHp; this.maxHp = this.initialMaxHp;
        this.isDestroyed = false; this.creationTime = Date.now();
        this.targetHpBasedOnAge = this.initialMaxHp;
        this.antiAirTurrets = [];
        this.turretSpawnRate = 30000; this.maxTurrets = 4;
        this.lastTurretSpawnTime = this.creationTime;
    }

    draw(voX, voY) {
        const sX = this.mapX - voX; const sY = this.mapY - voY;
        if (sX > canvas.width + this.width || sX < -this.width || sY > canvas.height + this.height || sY < -this.height) return;
        if (this.isDestroyed) {
            ctx.fillStyle = 'gray'; ctx.fillRect(sX - this.width / 2, sY - this.height / 2, this.width, this.height / 2);
            ctx.fillStyle = '#555'; ctx.fillRect(sX - this.width / 2 + 5, sY - this.height / 4, this.width - 10, this.height / 3);
        } else {
            ctx.fillStyle = 'purple'; ctx.fillRect(sX - this.width / 2, sY - this.height / 2, this.width, this.height);
            const hpBW = this.width; const hpBH = 5;
            const cDMH = Math.min(MAX_HP_CAP, Math.max(this.initialMaxHp, this.targetHpBasedOnAge));
            const hpR = this.hp / cDMH;
            ctx.fillStyle = 'red'; ctx.fillRect(sX - hpBW / 2, sY - this.height / 2 - hpBH - 2, hpBW, hpBH);
            ctx.fillStyle = 'green'; ctx.fillRect(sX - hpBW / 2, sY - this.height / 2 - hpBH - 2, hpBW * hpR, hpBH);
        }
        ctx.fillStyle = 'white'; ctx.font = '10px Arial'; ctx.textAlign = 'center';
        ctx.fillText(this.id, sX, sY + this.height / 2 + 10);
        ctx.textAlign = 'left';
        for (const t of this.antiAirTurrets) t.draw(voX, voY);
    }

    takeDamage(amount) {
        if (this.isDestroyed) return;
        this.hp -= amount;
        if (this.hp <= 0 && !this.isDestroyed) {
            this.hp = 0; this.isDestroyed = true; score += 750;
            console.log(`Factory ${this.id} destroyed. Score: ${score}`);
            explosions.push(new Explosion(this.mapX, this.mapY, this.width * 0.9, 45));
            explosions.push(new Explosion(this.mapX - this.width / 3, this.mapY - this.height / 3, this.width * 0.6, 55));
            explosions.push(new Explosion(this.mapX + this.width / 3, this.mapY + this.height / 3, this.width * 0.7, 60));
            // TODO: Play explosion sound (large factory) // SFX_COMMENT
            for (const t of this.antiAirTurrets) if (!t.isDestroyed) t.takeDamage(t.hp + 1);
        }
    }

    spawnAntiAirTurret() {
        if (this.antiAirTurrets.length >= this.maxTurrets) return;
        const tI = this.antiAirTurrets.length; let oX = 0, oY = 0;
        if (tI === 0) { oX = -this.width / 2 - 20; oY = -this.height / 2; }
        else if (tI === 1) { oX = this.width / 2 + 20; oY = -this.height / 2; }
        else if (tI === 2) { oX = -this.width / 2 - 20; oY = this.height / 2; }
        else if (tI === 3) { oX = this.width / 2 + 20; oY = this.height / 2; }
        const nT = new AntiAirTurret(this.mapX + oX, this.mapY + oY, this.id);
        this.antiAirTurrets.push(nT); allAntiAirTurrets.push(nT);
    }

    updateDurability(gTIS) {
        if (this.isDestroyed) return;
        const eS = Math.max(0, gTIS - ((this.creationTime - gameStartTime) / 1000));
        this.targetHpBasedOnAge = Math.min(this.initialMaxHp + (eS / 60) * HP_INCREASE_PER_MINUTE, MAX_HP_CAP);
        this.maxHp = this.targetHpBasedOnAge;
        if (this.hp < this.targetHpBasedOnAge) this.hp = Math.min(this.hp + HP_INCREASE_RATE_PER_FRAME, this.targetHpBasedOnAge);
        this.hp = Math.min(this.hp, MAX_HP_CAP, this.maxHp);
        const cT = Date.now();
        if (this.antiAirTurrets.length < this.maxTurrets && (cT - this.lastTurretSpawnTime) >= this.turretSpawnRate) {
            this.spawnAntiAirTurret(); this.lastTurretSpawnTime = cT;
        }
        this.antiAirTurrets = this.antiAirTurrets.filter(t => !t.isDestroyed);
    }
}

class TurretBullet {
    constructor(mX, mY, tMX, tMY) {
        this.mapX = mX; this.mapY = mY;
        this.targetMapX = tMX; this.targetMapY = tMY;
        this.speed = 6; this.width = 6; this.height = 6; this.damage = 5;
        this.lifeSpanFrames = 180; this.framesAlive = 0; this.markedForRemoval = false;
        const dX = this.targetMapX - this.mapX; const dY = this.targetMapY - this.mapY;
        const dist = Math.sqrt(dX * dX + dY * dY);
        if (dist === 0) { this.velocityX = 0; this.velocityY = 0; }
        else { this.velocityX = (dX / dist) * this.speed; this.velocityY = (dY / dist) * this.speed; }
    }

    update() {
        if (this.markedForRemoval) return;
        this.mapX += this.velocityX; this.mapY += this.velocityY;
        this.framesAlive++;
        if (this.framesAlive >= this.lifeSpanFrames) this.markedForRemoval = true;
    }

    draw(voX, voY) {
        if (this.markedForRemoval) return;
        const sX = this.mapX - voX; const sY = this.mapY - voY;
        if (sX < -this.width || sX > canvas.width + this.width || sY < -this.height || sY > canvas.height + this.height) return;
        ctx.fillStyle = 'rgb(255,100,100)'; ctx.beginPath();
        ctx.arc(sX, sY, this.width / 2, 0, Math.PI * 2); ctx.fill();
    }
}

class AntiAirTurret {
    constructor(mX, mY, pFId) {
        this.mapX = mX; this.mapY = mY; this.pFId = pFId;
        this.width = 20; this.height = 20; this.hp = 75; this.maxHp = 75;
        this.isDestroyed = false; this.fireRate = 1; this.canFire = true; this.range = 250;
        this.id = `T_${pFId}_${Date.now() % 10000}`;
    }

    draw(voX, voY) {
        if (this.isDestroyed) return;
        const sX = this.mapX - voX; const sY = this.mapY - voY;
        if (sX < -this.width || sX > canvas.width + this.width || sY < -this.height || sY > canvas.height + this.height) return;
        ctx.fillStyle = 'olive';
        ctx.fillRect(sX - this.width / 2, sY - this.height / 2, this.width, this.height);
        ctx.strokeStyle = 'black'; ctx.lineWidth = 3;
        ctx.beginPath(); ctx.moveTo(sX, sY); ctx.lineTo(sX, sY - this.height); ctx.stroke();
    }

    takeDamage(amount) {
        if (this.isDestroyed) return;
        this.hp -= amount;
        if (this.hp <= 0 && !this.isDestroyed) {
            this.hp = 0; this.isDestroyed = true; score += 75;
            console.log(`Turret ${this.id} destroyed. Score: ${score}`);
            explosions.push(new Explosion(this.mapX, this.mapY, this.width * 2.5, 25));
            // TODO: Play explosion sound (medium) // SFX_COMMENT
        }
    }

    update(pMX, pMY, gTIS) {
        if (this.isDestroyed) return;
        const dX = pMX - this.mapX; const dY = pMY - this.mapY;
        const distToP = Math.sqrt(dX * dX + dY * dY);
        if (distToP <= this.range && this.canFire) {
            this.fireAtPlayer(pMX, pMY); this.canFire = false;
            setTimeout(() => this.canFire = true, 1000 / this.fireRate);
        }
    }

    fireAtPlayer(pMX, pMY) {
        const nB = new TurretBullet(this.mapX, this.mapY, pMX, pMY);
        allTurretBullets.push(nB);
        // TODO: Play AA Turret shoot sound // SFX_COMMENT
    }
}

class EnemyJet {
    constructor(mapX, mapY, angle) {
        this.mapX = mapX; this.mapY = mapY; this.angle = angle;
        this.width = 40; this.height = 20; this.hp = 40; this.maxHp = 40;
        this.speed = (Math.random() * 2) + 4; this.isDestroyed = false;
        this.fireRate = 0.5; this.canFire = true; this.movementPattern = 'flyStraight';
        this.velocityX = Math.cos(this.angle) * this.speed;
        this.velocityY = Math.sin(this.angle) * this.speed;
        this.id = `jet_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
    }

    draw(voX, voY) {
        // Placeholder for EnemyJet.draw - Original logic was not provided in snippet
        if (this.isDestroyed) return;
        const sX = this.mapX - voX; const sY = this.mapY - voY;
        if (sX < -this.width || sX > canvas.width + this.width || sY < -this.height || sY > canvas.height + this.height) return;
        
        ctx.save();
        ctx.translate(sX, sY);
        ctx.rotate(this.angle);
        ctx.fillStyle = 'red'; // Default color
        ctx.fillRect(-this.width / 2, -this.height / 2, this.width, this.height);
        // Simple triangle shape for jet nose
        ctx.beginPath();
        ctx.moveTo(this.width / 2, 0);
        ctx.lineTo(this.width / 2 + 10, -this.height / 4);
        ctx.lineTo(this.width / 2 + 10, this.height / 4);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
        // console.log(`Drawing Jet ${this.id} at screen ${sX}, ${sY}`); 
    }

    takeDamage(amount) {
        if (this.isDestroyed) return;
        this.hp -= amount;
        if (this.hp <= 0 && !this.isDestroyed) {
            this.hp = 0; this.isDestroyed = true; score += 150;
            console.log(`Jet ${this.id} destroyed. Score: ${score}`);
            explosions.push(new Explosion(this.mapX, this.mapY, this.width * 2.5, 30));
            // TODO: Play explosion sound (medium/fast) // SFX_COMMENT
        }
    }

    update(pMX, pMY, voX, voY, mapW, mapH) {
        // Placeholder for EnemyJet.update - Original logic was not provided in snippet
        if (this.isDestroyed) return;

        this.mapX += this.velocityX;
        this.mapY += this.velocityY;

        // Basic boundary removal
        if (this.mapX < -this.width * 2 || this.mapX > mapW + this.width * 2 ||
            this.mapY < -this.height * 2 || this.mapY > mapH + this.height * 2) {
            this.isDestroyed = true; // Mark for removal if way off screen
            // console.log(`Jet ${this.id} flew out of bounds and is destroyed.`);
            return;
        }
        
        // Simple auto-fire logic (example)
        const distToPlayer = Math.sqrt(Math.pow(pMX - this.mapX, 2) + Math.pow(pMY - this.mapY, 2));
        if (distToPlayer < 400 && this.canFire) { // Range of 400
             this.fireWeapon(pMX, pMY);
             this.canFire = false;
             setTimeout(() => { this.canFire = true; }, 1000 / this.fireRate);
        }
        // console.log(`Updating Jet ${this.id} to ${this.mapX}, ${this.mapY}`);
    }

    fireWeapon(pMX, pMY) {
        const bSX = this.mapX + Math.cos(this.angle) * (this.height / 2 + 5); // Bullet start X
        const bSY = this.mapY + Math.sin(this.angle) * (this.height / 2 + 5); // Bullet start Y
        allTurretBullets.push(new TurretBullet(bSX, bSY, pMX, pMY));
        // TODO: Play jet shoot sound // SFX_COMMENT
    }
}

class Battleship {
    constructor(mapX, mapY) { // Initial mapX, mapY might be off-screen for entry
        this.id = `battleship_${Date.now()}`;
        this.mapX = mapX; this.mapY = mapY;
        this.width = 280; this.height = 90;
        this.hp = 2500; this.maxHp = 2500;
        this.speed = 1; this.isDestroyed = false; this.isActive = false;
        this.angle = 0; // Angle for drawing if it rotates, or for movement direction
        this.turrets = [];
        this.turretRelativePositions = [ // Relative to battleship's center
            { x: -this.width * 0.35, y: -this.height * 0.25 },
            { x: -this.width * 0.35, y: this.height * 0.25 },
            { x: 0, y: -this.height * 0.3 },
            { x: 0, y: this.height * 0.3 },
            { x: this.width * 0.35, y: 0 },
        ];
        // Patrol behavior
        this.patrolTargetX1 = this.width / 2 + 100; // Patrol start point (within map)
        this.patrolTargetX2 = MAP_WIDTH - this.width / 2 - 100; // Patrol end point (within map)
        this.patrolDirection = 1; // 1 for right, -1 for left

        // Initial position and velocity for entry
        this.mapX = -this.width; // Start off-screen to the left
        this.mapY = MAP_HEIGHT / 2; // Appear mid-screen vertically
        this.angle = 0; // Pointing right
        this.velocityX = this.speed;
        this.velocityY = 0;
    }

    initializeTurrets(AntiAirTurretClass) { // Pass the class itself
        this.turrets = [];
        this.turretRelativePositions.forEach((pos, index) => {
            const turretMapX = this.mapX + pos.x; // Initial position based on battleship's current mapX
            const turretMapY = this.mapY + pos.y; // Initial position based on battleship's current mapY
            const turret = new AntiAirTurretClass(turretMapX, turretMapY, `${this.id}_turret${index}`);
            turret.range = 350; // Battleship turrets might have longer range
            turret.fireRate = 0.75; // And slightly different fire rate
            this.turrets.push(turret);
            allAntiAirTurrets.push(turret); // Add to global array for updates and rendering
        });
    }

    draw(voX, voY) {
        // Placeholder for Battleship.draw - Original logic was not provided in snippet
        const sX = this.mapX - voX; const sY = this.mapY - voY;
        if (sX > canvas.width + this.width || sX < -this.width || sY > canvas.height + this.height || sY < -this.height) {
            // console.log(`Battleship ${this.id} off-screen, not drawing.`);
            return;
        }

        if (this.isDestroyed) {
            ctx.fillStyle = 'darkred'; // Darker red when destroyed
            ctx.fillRect(sX - this.width / 2, sY - this.height / 2, this.width, this.height);
            ctx.fillStyle = '#333';
            ctx.fillRect(sX - this.width/2 + 10, sY - this.height/4, this.width - 20, this.height/2);

        } else {
            ctx.fillStyle = 'darkgrey'; // Main body
            ctx.fillRect(sX - this.width / 2, sY - this.height / 2, this.width, this.height);
            
            // Superstructure (example)
            ctx.fillStyle = 'grey';
            ctx.fillRect(sX - this.width * 0.25, sY - this.height * 0.4, this.width * 0.5, this.height * 0.3);
            
            // HP Bar
            const hpBarWidth = this.width * 0.8;
            const hpBarHeight = 8;
            const hpRatio = this.hp / this.maxHp;
            ctx.fillStyle = 'red';
            ctx.fillRect(sX - hpBarWidth / 2, sY - this.height / 2 - hpBarHeight - 5, hpBarWidth, hpBarHeight);
            ctx.fillStyle = 'green';
            ctx.fillRect(sX - hpBarWidth / 2, sY - this.height / 2 - hpBarHeight - 5, hpBarWidth * hpRatio, hpBarHeight);
        }
        // Turrets are drawn by the main game loop from allAntiAirTurrets
        // console.log(`Drawing Battleship ${this.id} at screen ${sX}, ${sY}`);
    }

    takeDamage(amount) {
        if (this.isDestroyed || !this.isActive) return;
        this.hp -= amount;
        if (this.hp <= 0 && !this.isDestroyed) {
            this.hp = 0; this.isDestroyed = true; this.isActive = false; score += 4000;
            console.log(`Battleship ${this.id} destroyed! Score: ${score}`);
            explosions.push(new Explosion(this.mapX, this.mapY, this.width * 0.8, 80));
            explosions.push(new Explosion(this.mapX - this.width / 3, this.mapY - this.height / 4, this.width * 0.6, 90));
            explosions.push(new Explosion(this.mapX + this.width / 3, this.mapY + this.height / 4, this.width * 0.6, 100));
            // TODO: Play massive explosion sound // SFX_COMMENT
            this.turrets.forEach(turret => {
                if (!turret.isDestroyed) turret.takeDamage(turret.hp + 1000); // Overkill turrets
            });
        }
    }

    update(pMX, pMY, mapW, mapH, cgTIS) {
        // Placeholder for Battleship.update - Original logic was not provided in snippet
        if (!this.isActive || this.isDestroyed) {
            // console.log(`Battleship ${this.id} update skipped. Active: ${this.isActive}, Destroyed: ${this.isDestroyed}`);
            return;
        }

        // Entry behavior: move onto screen
        if (this.mapX < this.patrolTargetX1 && this.patrolDirection === 1) {
            this.mapX += this.velocityX;
            if (this.mapX >= this.patrolTargetX1) {
                this.mapX = this.patrolTargetX1; // Snap to position
                // console.log(`Battleship ${this.id} reached patrol start X1: ${this.patrolTargetX1}`);
            }
        } else { // Patrol behavior
            this.mapX += this.velocityX * this.patrolDirection;
            if (this.patrolDirection === 1 && this.mapX >= this.patrolTargetX2) {
                this.mapX = this.patrolTargetX2;
                this.patrolDirection = -1;
                // console.log(`Battleship ${this.id} reached patrol end X2: ${this.patrolTargetX2}, reversing.`);
            } else if (this.patrolDirection === -1 && this.mapX <= this.patrolTargetX1) {
                this.mapX = this.patrolTargetX1;
                this.patrolDirection = 1;
                // console.log(`Battleship ${this.id} reached patrol start X1: ${this.patrolTargetX1}, reversing.`);
            }
        }
        
        // Update turrets' absolute positions and let them decide to fire
        this.turrets.forEach((turret, index) => {
            if (!turret.isDestroyed) {
                const relPos = this.turretRelativePositions[index];
                turret.mapX = this.mapX + relPos.x; // Update absolute X
                turret.mapY = this.mapY + relPos.y; // Update absolute Y
                // Turret update (which includes firing logic) is handled in the main game loop's iteration of allAntiAirTurrets
            }
        });
        // console.log(`Updating Battleship ${this.id} to ${this.mapX}, ${this.mapY}`);
    }
}

// Refactored ES6 Classes End


// Player class
class Player {
    constructor(startX, startY, speed, width, height) {
        this.mapX = startX; this.mapY = startY;
        this.x = canvas.width / 2; this.y = canvas.height / 2; 
        this.hp = 100; this.lives = 3; this.speed = speed;
        this.width = width; this.height = height;
        this.keys = {}; 
        this.vulcanBullets = []; this.vulcanFireRate = 5; this.canFireVulcan = true;
        this.missiles = []; this.missileFireRate = 2000; this.canFireMissile = true;
        this.aimingReticle = { x: canvas.width / 2, y: canvas.height / 2, size: 30, speed: 7 };
    }
    draw() {
        ctx.fillStyle = 'blue'; 
        ctx.fillRect(this.x - this.width / 2, this.y - this.height / 2, this.width, this.height);
    }
    fireVulcan() {
        this.vulcanBullets.push(new VulcanBullet(this.mapX, this.mapY - this.height / 2));
        // TODO: Play Vulcan shoot sound // SFX_COMMENT
    }
    fireMissile() {
        const targetMapX = this.mapX - (canvas.width / 2) + this.aimingReticle.x;
        const targetMapY = this.mapY - (canvas.height / 2) + this.aimingReticle.y;
        this.missiles.push(new Missile(this.mapX, this.mapY, targetMapX, targetMapY));
        // TODO: Play Missile launch sound // SFX_COMMENT
    }
    update() {
        if (this.keys['ArrowUp']) this.mapY -= this.speed;
        if (this.keys['ArrowDown']) this.mapY += this.speed;
        if (this.keys['ArrowLeft']) this.mapX -= this.speed;
        if (this.keys['ArrowRight']) this.mapX += this.speed;
        this.mapX = (this.mapX % MAP_WIDTH + MAP_WIDTH) % MAP_WIDTH;
        this.mapY = (this.mapY % MAP_HEIGHT + MAP_HEIGHT) % MAP_HEIGHT; 
        if (this.keys['w'] || this.keys['W']) this.aimingReticle.y -= this.aimingReticle.speed;
        if (this.keys['s'] || this.keys['S']) this.aimingReticle.y += this.aimingReticle.speed;
        if (this.keys['a'] || this.keys['A']) this.aimingReticle.x -= this.aimingReticle.speed;
        if (this.keys['d'] || this.keys['D']) this.aimingReticle.x += this.aimingReticle.speed;
        this.aimingReticle.x = Math.max(0, Math.min(canvas.width, this.aimingReticle.x));
        this.aimingReticle.y = Math.max(0, Math.min(canvas.height, this.aimingReticle.y));
    }
}
const player = new Player(MAP_WIDTH / 2, MAP_HEIGHT / 2, 5, 50, 50);

window.addEventListener('keydown', (e) => {
    player.keys[e.key] = true;
    // Game Controls
    if ((e.key === ' ' || e.key === 'Spacebar') && player.canFireVulcan && !gameOver) {
        player.fireVulcan(); player.canFireVulcan = false;
        setTimeout(() => player.canFireVulcan = true, 1000 / player.vulcanFireRate);
    }
    if ((e.key === 'm' || e.key === 'M') && player.canFireMissile && !gameOver) {
        player.fireMissile(); player.canFireMissile = false;
        setTimeout(() => player.canFireMissile = true, player.missileFireRate);
    }
    
    // DEV_TEST: Developer Test Hotkeys
    if (e.key === 'h' || e.key === 'H')  handlePlayerMiss(10); // Test damage
    if (e.key === 'i' || e.key === 'I') { // Toggle Invulnerability
        playerInvulnerable = !playerInvulnerable;
        console.log("DEV_TEST: Player Invulnerability: " + playerInvulnerable);
    }
    if (e.key === 'l' || e.key === 'L') { // Log Game State
        logGameStateSummary();
    }
    if (e.key === 'k' || e.key === 'K') { // Destroy All Factories
        console.log("DEV_TEST: Force destroying all factories.");
        factories.forEach(factory => {
            if (!factory.isDestroyed) {
                factory.takeDamage(factory.hp + 1); // Ensure full destruction
            }
        });
        // If battleship has appeared and is not destroyed, destroy it too for quick stage progression test
        if (battleshipAppeared && battleship && !battleship.isDestroyed) {
            console.log("DEV_TEST: Force destroying battleship for stage progression.");
            battleship.takeDamage(battleship.hp + 1);
        }
    }
});
window.addEventListener('keyup', (e) => { player.keys[e.key] = false; });

function handlePlayerMiss(damageAmount = 10) {
    // DEV_TEST: Invulnerability Check
    if (playerInvulnerable) {
        console.log("Player hit but INVULNERABLE. Damage ignored.");
        return;
    }
    if (gameOver) return;
    player.hp -= damageAmount; console.log(`Player took ${damageAmount} damage. HP: ${player.hp}`);
    if (player.hp <= 0) {
        player.lives--; player.hp = 100; console.log("Player Lives:", player.lives);
        if (player.lives <= 0) { gameOver = true; console.log("Game Over"); }
    }
}

function displayGameInfo() {
    ctx.fillStyle = 'white'; ctx.font = '20px Arial';
    ctx.fillText(`HP: ${player.hp}`, 10, 30); 
    ctx.fillText(`Lives: ${player.lives}`, 10, 60);
    ctx.fillText(`Stage: ${stageNumber}`, canvas.width - 150, 30); 
    ctx.fillText(`Score: ${score}`, canvas.width - 150, 60); 

    // DEV_TEST: Display Invulnerability Status
    if (playerInvulnerable) {
        ctx.fillStyle = 'cyan';
        ctx.font = '20px Arial';
        ctx.textAlign = 'center';
        ctx.fillText("INVULNERABLE", canvas.width / 2, 30);
        ctx.textAlign = 'left';
    }

    if (isStageClearing && stageClearMessage) {
        ctx.fillStyle = 'yellow'; ctx.font = '60px Arial'; ctx.textAlign = 'center';
        ctx.fillText(stageClearMessage, canvas.width / 2, canvas.height / 2);
        ctx.textAlign = 'left'; 
    }
    if (gameOver) {
        ctx.fillStyle = 'red'; ctx.font = '50px Arial'; ctx.textAlign = 'center';
        const gameOverYPos = isStageClearing ? canvas.height / 2 + 60 : canvas.height / 2;
        ctx.fillText('Game Over', canvas.width / 2, gameOverYPos); 
        ctx.textAlign = 'left'; 
    }
}

// DEV_TEST: Game State Logger
function logGameStateSummary() {
    console.log("====== GAME STATE SUMMARY ======");
    console.log(`Current Time: ${((Date.now() - gameStartTime)/1000).toFixed(2)}s`);
    console.log(`Stage: ${stageNumber}`);
    console.log(`Player HP: ${player.hp}, Lives: ${player.lives}, Invulnerable: ${playerInvulnerable}`);
    console.log(`Score: ${score}`);
    
    let activeFactories = factories.filter(f => !f.isDestroyed).length;
    console.log(`Factories: ${activeFactories} active / ${factories.length} total`);
    
    let activeJets = allEnemyJets.filter(j => !j.isDestroyed).length;
    console.log(`Enemy Jets: ${activeJets} active`);

    let activeTurrets = allAntiAirTurrets.filter(t => !t.isDestroyed).length;
    console.log(`AA Turrets (total): ${activeTurrets} active`);

    if (battleshipAppeared) {
        if (battleship && !battleship.isDestroyed) {
            console.log(`Battleship: ACTIVE, HP: ${battleship.hp}`);
        } else if (battleship && battleship.isDestroyed) {
            console.log("Battleship: DESTROYED");
        } else {
            console.log("Battleship: Appeared but state unknown (likely destroyed and cleaned up).");
        }
    } else {
        console.log("Battleship: Has not appeared yet.");
    }
    console.log("==============================");
}


function checkAllFactoriesDestroyed() {
    if (factories.length === 0 && stageNumber > 0) return false; 
    for (const factory of factories) if (!factory.isDestroyed) return false;
    return factories.length > 0; 
}

function resetGameForNextStage() {
    stageNumber++; console.log(`Advancing to Stage ${stageNumber}`);
    player.hp = 100; player.mapX = MAP_WIDTH / 2; player.mapY = MAP_HEIGHT / 2;
    player.vulcanBullets = []; player.missiles = [];
    initializeFactories(); 
    allEnemyJets = []; allTurretBullets = []; allAntiAirTurrets = []; 
    battleship = null; battleshipAppeared = false;
    isStageClearing = false; stageClearMessage = ""; stageClearTimer = 0;
    jetSpawnTimer = 0; currentJetSpawnInterval = initialJetSpawnInterval; 
    explosions = []; // Clear existing explosions
    console.log(`Stage ${stageNumber} initialized and ready.`);
}

// VulcanBullet and Missile classes remain as they are (assuming they are already ES6 or don't need refactor per prompt)
// Or, if they were prototype based, they should also be refactored.
// For now, assuming VulcanBullet and Missile are okay based on prompt focusing on specific classes.
// Re-checking prompt: VulcanBullet and Missile were not on the list for refactor.
// The previous read_file output showed "class VulcanBullet { /* ... existing code ... */ }" and "class Missile { /* ... existing code ... */ }"
// and then later "VulcanBullet.prototype.draw" and "Missile.prototype.update", "Missile.prototype.draw"
// This means VulcanBullet and Missile ALSO need refactoring. I missed this.
// I will add them to the refactoring process.

class VulcanBullet {
    constructor(mapX, mapY, width = 5, height = 15, speed = 10, damage = 10) {
        this.mapX = mapX; this.mapY = mapY;
        this.width = width; this.height = height;
        this.speed = speed; this.damage = damage;
    }

    update() {
        this.mapY -= this.speed; // Moves upwards
    }

    draw(voX, voY) {
        const sX = this.mapX - voX; const sY = this.mapY - voY;
        if (sX > -this.width && sX < canvas.width && sY > -this.height && sY < canvas.height) {
            ctx.fillStyle = 'yellow';
            ctx.fillRect(sX, sY, this.width, this.height);
        }
    }
}

class Missile {
    constructor(mX, mY, tMX, tMY, w = 10, h = 20, speed = 4, damage = 50) {
        this.mapX = mX; this.mapY = mY;
        this.targetMapX = tMX; this.targetMapY = tMY;
        this.width = w; this.height = h;
        this.speed = speed; this.damage = damage;
        this.reached = false;
        const dX = this.targetMapX - this.mapX;
        const dY = this.targetMapY - this.mapY;
        this.angle = Math.atan2(dY, dX) + Math.PI / 2; // Point towards target
        this.vX = Math.cos(this.angle - Math.PI / 2) * this.speed;
        this.vY = Math.sin(this.angle - Math.PI / 2) * this.speed;
    }

    update() {
        if (this.reached) return;
        this.mapX += this.vX; this.mapY += this.vY;
        const dX = this.targetMapX - this.mapX;
        const dY = this.targetMapY - this.mapY;
        if (Math.sqrt(dX * dX + dY * dY) < this.speed * 1.5) { // Proximity check
            this.reached = true;
            explosions.push(new Explosion(this.mapX, this.mapY, this.width * 5, 25));
            // TODO: Play missile explosion sound // SFX_COMMENT
        }
    }

    draw(voX, voY) {
        const sX = this.mapX - voX; const sY = this.mapY - voY;
        if (sX < -this.width * 2 || sX > canvas.width + this.width * 2 || sY < -this.height * 2 || sY > canvas.height + this.height * 2) return;
        ctx.save();
        ctx.translate(sX, sY);
        ctx.rotate(this.angle);
        ctx.fillStyle = 'orange';
        ctx.beginPath();
        ctx.moveTo(0, -this.height / 2); // Tip
        ctx.lineTo(-this.width / 2, this.height / 2); // Bottom-left
        ctx.lineTo(this.width / 2, this.height / 2);  // Bottom-right
        ctx.closePath();
        ctx.fill();
        ctx.restore();
    }
}


// Global functions
function drawScrollingBackground() {
    ctx.fillStyle = '#000011'; ctx.fillRect(0, 0, canvas.width, canvas.height);
    const viewOriginX = player.mapX - player.x; const viewOriginY = player.mapY - player.y;
    ctx.fillStyle = '#FFFF00'; 
    for (let i = 0; i < 100; i++) { 
        let starMapX = ((i*37+(i%10)*97)*23)%MAP_WIDTH; let starMapY = ((i*53+(i%10)*101)*29)%MAP_HEIGHT;
        let screenX = starMapX - viewOriginX; let screenY = starMapY - viewOriginY; 
        screenX = (screenX % MAP_WIDTH + MAP_WIDTH) % MAP_WIDTH; 
        screenY = (screenY % MAP_HEIGHT + MAP_HEIGHT) % MAP_HEIGHT;
        if (screenX > canvas.width + viewOriginX) screenX -= MAP_WIDTH; else if (screenX < viewOriginX -MAP_WIDTH) screenX += MAP_WIDTH;
        if (screenY > canvas.height + viewOriginY) screenY -= MAP_HEIGHT; else if (screenY < viewOriginY-MAP_HEIGHT) screenY += MAP_HEIGHT;
        ctx.fillRect(screenX - viewOriginX, screenY - viewOriginY, 2, 2); 
    }
    ctx.strokeStyle = 'rgba(255,255,255,0.1)'; ctx.lineWidth = 1;
    let offsetX = viewOriginX % GRID_SIZE; let offsetY = viewOriginY % GRID_SIZE;
    for (let x = -offsetX; x < canvas.width; x += GRID_SIZE) { ctx.beginPath(); ctx.moveTo(x,0); ctx.lineTo(x,canvas.height); ctx.stroke(); }
    for (let y = -offsetY; y < canvas.height; y += GRID_SIZE) { ctx.beginPath(); ctx.moveTo(0,y); ctx.lineTo(canvas.width,y); ctx.stroke(); }
}

function initializeFactories() {
    factories = [];
    // Simplified initial factory data; can be expanded
    const factoryData = [
        { id: 'F1', mapX: 300, mapY: 300 }, { id: 'F2', mapX: MAP_WIDTH - 300, mapY: 300 },
        { id: 'F3', mapX: 300, mapY: MAP_HEIGHT - 300 }, { id: 'F4', mapX: MAP_WIDTH - 300, mapY: MAP_HEIGHT - 300 },
        { id: 'F5', mapX: MAP_WIDTH / 2, mapY: 200 }, { id: 'F6', mapX: MAP_WIDTH / 2, mapY: MAP_HEIGHT - 200 },
        { id: 'F7', mapX: MAP_WIDTH/2, mapY: MAP_HEIGHT/2}
    ];
    factoryData.forEach(data => factories.push(new Factory(data.mapX, data.mapY, data.id)));
    // Reset turrets as well, as factories will respawn them
    allAntiAirTurrets = []; 
    factories.forEach(f => { 
      // Factories now spawn their own initial turrets if needed, or rely on update loop.
      // For simplicity, let's let the update loop handle initial spawn if desired, or add explicit call here.
      // f.spawnAntiAirTurret(); // if initial turrets desired immediately.
    });
}

function spawnEnemyJet() {
    if (allEnemyJets.length >= maxEnemyJets) return;
    let startX, startY, angle;
    const edge = Math.floor(Math.random() * 4);
    switch (edge) {
        case 0: startX = Math.random() * MAP_WIDTH; startY = -50; angle = Math.PI / 2 + (Math.random() - 0.5) * (Math.PI / 4); break; // Top edge
        case 1: startX = MAP_WIDTH + 50; startY = Math.random() * MAP_HEIGHT; angle = Math.PI + (Math.random() - 0.5) * (Math.PI / 4); break; // Right edge
        case 2: startX = Math.random() * MAP_WIDTH; startY = MAP_HEIGHT + 50; angle = -Math.PI / 2 + (Math.random() - 0.5) * (Math.PI / 4); break; // Bottom edge
        case 3: startX = -50; startY = Math.random() * MAP_HEIGHT; angle = 0 + (Math.random() - 0.5) * (Math.PI / 4); break; // Left edge
    }
    allEnemyJets.push(new EnemyJet(startX, startY, angle));
}

function drawAimingReticle() {
    const x = player.aimingReticle.x; const y = player.aimingReticle.y;
    const size = player.aimingReticle.size;
    ctx.strokeStyle = 'red'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(x - size / 2, y); ctx.lineTo(x + size / 2, y);
    ctx.moveTo(x, y - size / 2); ctx.lineTo(x, y + size / 2); ctx.stroke();
    ctx.beginPath(); ctx.arc(x, y, size / 4, 0, Math.PI * 2); ctx.stroke();
}

function gameLoop() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    drawScrollingBackground();
    const currentGameTimeInSeconds = (Date.now() - gameStartTime) / 1000;

    if (!gameOver) player.update();
    player.draw();
    drawAimingReticle();

    const viewOriginX = player.mapX - player.x;
    const viewOriginY = player.mapY - player.y;

    // Update and draw player's vulcan bullets
    for (let i = player.vulcanBullets.length - 1; i >= 0; i--) {
        const bullet = player.vulcanBullets[i];
        bullet.update();
        bullet.draw(viewOriginX, viewOriginY);
        let bulletRemoved = false;
        // Check collision with factories
        for (const factory of factories) {
            if (!factory.isDestroyed && bullet.mapX >= factory.mapX - factory.width / 2 && bullet.mapX <= factory.mapX + factory.width / 2 &&
                bullet.mapY >= factory.mapY - factory.height / 2 && bullet.mapY <= factory.mapY + factory.height / 2) {
                factory.takeDamage(bullet.damage);
                player.vulcanBullets.splice(i, 1); bulletRemoved = true; break;
            }
        }
        if (bulletRemoved) continue;
        // Check collision with enemy jets
        for (const jet of allEnemyJets) {
            if (!jet.isDestroyed && bullet.mapX >= jet.mapX - jet.width / 2 && bullet.mapX <= jet.mapX + jet.width / 2 &&
                bullet.mapY >= jet.mapY - jet.height / 2 && bullet.mapY <= jet.mapY + jet.height / 2) {
                jet.takeDamage(bullet.damage);
                player.vulcanBullets.splice(i, 1); bulletRemoved = true; break;
            }
        }
        if (bulletRemoved) continue;
        // Check collision with battleship
        if (battleship && battleship.isActive && !battleship.isDestroyed &&
            bullet.mapX >= battleship.mapX - battleship.width / 2 && bullet.mapX <= battleship.mapX + battleship.width / 2 &&
            bullet.mapY >= battleship.mapY - battleship.height / 2 && bullet.mapY <= battleship.mapY + battleship.height / 2) {
            battleship.takeDamage(bullet.damage);
            player.vulcanBullets.splice(i, 1); bulletRemoved = true;
        }
        if (bulletRemoved) continue;
        // Remove bullets that fly too far
        if (bullet.mapY < 0 || bullet.mapY > MAP_HEIGHT || bullet.mapX < 0 || bullet.mapX > MAP_WIDTH || Math.abs(bullet.mapY - player.mapY) > canvas.height * 1.5) {
             player.vulcanBullets.splice(i, 1);
        }
    }

    // Update and draw player's missiles
    for (let i = player.missiles.length - 1; i >= 0; i--) {
        const missile = player.missiles[i];
        missile.update();
        missile.draw(viewOriginX, viewOriginY);
        if (missile.reached) {
            // Area damage or direct hit logic for missiles
            for (const factory of factories) if (!factory.isDestroyed && missile.targetMapX >= factory.mapX - factory.width/2 && missile.targetMapX <= factory.mapX + factory.width/2 && missile.targetMapY >= factory.mapY - factory.height/2 && missile.targetMapY <= factory.mapY + factory.height/2) factory.takeDamage(missile.damage);
            for (const jet of allEnemyJets) if (!jet.isDestroyed && missile.targetMapX >= jet.mapX - jet.width/2 && missile.targetMapX <= jet.mapX + jet.width/2 && missile.targetMapY >= jet.mapY - jet.height/2 && missile.targetMapY <= jet.mapY + jet.height/2) jet.takeDamage(missile.damage);
            if (battleship && battleship.isActive && !battleship.isDestroyed && missile.targetMapX >= battleship.mapX - battleship.width/2 && missile.targetMapX <= battleship.mapX + battleship.width/2 && missile.targetMapY >= battleship.mapY - battleship.height/2 && missile.targetMapY <= battleship.mapY + battleship.height/2) battleship.takeDamage(missile.damage);
            player.missiles.splice(i, 1);
        } else if (missile.mapY > MAP_HEIGHT + missile.height || missile.mapY < -missile.height || missile.mapX < -missile.width || missile.mapX > MAP_WIDTH + missile.width) {
            player.missiles.splice(i, 1); // Remove if out of bounds
        }
    }

    // Update and draw factories
    for (const factory of factories) {
        factory.updateDurability(currentGameTimeInSeconds);
        factory.draw(viewOriginX, viewOriginY);
    }

    // Update and draw anti-air turrets (global list)
    for (let i = allAntiAirTurrets.length - 1; i >= 0; i--) {
        const turret = allAntiAirTurrets[i];
        if (turret.isDestroyed) {
            allAntiAirTurrets.splice(i, 1);
        } else {
            // Turret update might depend on whether it's part of battleship or factory for its target logic
            // For now, all turrets target player. Battleship turrets have positions updated by battleship.
            turret.update(player.mapX, player.mapY, currentGameTimeInSeconds);
            // turret.draw(viewOriginX, viewOriginY); // Drawing handled by factory/battleship or here if independent
        }
    }
    // Note: Factory.draw() also draws its turrets. Battleship.draw() could do the same or turrets are drawn from allAntiAirTurrets.
    // For simplicity, ensure all turrets are drawn. If factory/battleship draws them, this loop's draw can be skipped for those.
    // The current Factory.draw() iterates its own antiAirTurrets and draws them.
    // The placeholder Battleship.draw() does not explicitly draw its turrets. So they need to be drawn from the global list.
    // Let's draw ALL turrets from the global list to be safe, and remove specific drawing from factory if it causes double draw.
    // Re-checking: Factory.draw() calls t.draw(). So, turrets associated with factories are drawn there.
    // Turrets associated with Battleship need to be drawn.
    // This loop for allAntiAirTurrets will draw all of them. If a turret is already drawn by its parent, it's drawn twice.
    // This is not ideal. A better way is for entities to draw their sub-entities.
    // Let's stick to the original structure where Factory draws its turrets.
    // Battleship should also draw its turrets. I'll add that to Battleship.draw() placeholder.
    // For now, removing the explicit draw from this loop and relying on parent entities.
    // The update loop for allAntiAirTurrets is still essential.

    // Update and draw enemy turret bullets
    for (let i = allTurretBullets.length - 1; i >= 0; i--) {
        const bullet = allTurretBullets[i];
        bullet.update();
        bullet.draw(viewOriginX, viewOriginY);
        const playerScreenHitboxX = player.x - player.width / 2;
        const playerScreenHitboxY = player.y - player.height / 2;
        const bulletScreenX = bullet.mapX - viewOriginX;
        const bulletScreenY = bullet.mapY - viewOriginY;

        if (!bullet.markedForRemoval &&
            bulletScreenX - bullet.width / 2 < playerScreenHitboxX + player.width &&
            bulletScreenX + bullet.width / 2 > playerScreenHitboxX &&
            bulletScreenY - bullet.height / 2 < playerScreenHitboxY + player.height &&
            bulletScreenY + bullet.height / 2 > playerScreenHitboxY) {
            if (!gameOver) handlePlayerMiss(bullet.damage);
            bullet.markedForRemoval = true;
        }
        if (bullet.markedForRemoval) allTurretBullets.splice(i, 1);
    }

    // Spawn and manage enemy jets
    jetSpawnTimer += 16; // Assuming 60 FPS, 16ms per frame
    if (jetSpawnTimer >= currentJetSpawnInterval && !isStageClearing) {
        spawnEnemyJet();
        jetSpawnTimer = 0;
    }
    for (let i = allEnemyJets.length - 1; i >= 0; i--) {
        const jet = allEnemyJets[i];
        if (jet.isDestroyed) {
            allEnemyJets.splice(i, 1);
        } else {
            jet.update(player.mapX, player.mapY, viewOriginX, viewOriginY, MAP_WIDTH, MAP_HEIGHT);
            jet.draw(viewOriginX, viewOriginY);
        }
    }
    
    // Stage progression logic
    if (!isStageClearing) {
        if (checkAllFactoriesDestroyed()) {
            let proceedToClear = false;
            if (battleshipAppeared) { // If battleship was part of this stage
                if (battleship && battleship.isDestroyed) proceedToClear = true;
            } else { // If no battleship in this stage
                proceedToClear = true;
            }

            if (proceedToClear) {
                isStageClearing = true;
                stageClearMessage = `STAGE ${stageNumber} CLEAR!`;
                stageClearTimer = stageClearDuration;
                console.log(stageClearMessage);
            }
        }
    } else { // Stage is clearing
        stageClearTimer -= 16; // Countdown
        if (stageClearTimer <= 0) {
            resetGameForNextStage();
        }
    }

    // Battleship appearance and logic
    if (!battleshipAppeared && currentGameTimeInSeconds >= BATTLESHIP_APPEAR_TIME && !isStageClearing) {
        battleship = new Battleship(0, MAP_HEIGHT / 2); // Initial position for entry
        battleship.initializeTurrets(AntiAirTurret); // Pass the AntiAirTurret class
        battleship.isActive = true;
        battleshipAppeared = true;
        console.log("The GIANT BATTLESHIP has appeared!");
        // DEV_TEST: Battleship Appearance Log
        console.log("DEV_TEST: Battleship appeared at " + currentGameTimeInSeconds.toFixed(2) + "s. Expected around: " + BATTLESHIP_APPEAR_TIME + "s.");
    }

    if (battleship && battleship.isActive && !isStageClearing) {
        battleship.update(player.mapX, player.mapY, MAP_WIDTH, MAP_HEIGHT, currentGameTimeInSeconds);
        battleship.draw(viewOriginX, viewOriginY); // Battleship draws itself and its turrets
    } else if (battleship && battleship.isDestroyed && battleshipAppeared && !isStageClearing) {
        // Still draw the destroyed battleship for a bit if needed, or let it fade
        battleship.draw(viewOriginX, viewOriginY); 
    }


    // Update and Draw Explosions
    for (let i = explosions.length - 1; i >= 0; i--) {
        const explosion = explosions[i];
        explosion.update();
        explosion.draw(viewOriginX, viewOriginY);
        if (explosion.isComplete && explosion.framesAlive > explosion.lifeSpanFrames + 30) { // Extra delay before removing
            explosions.splice(i, 1);
        }
    }

    displayGameInfo();
    if (!gameOver) {
        requestAnimationFrame(gameLoop);
    } else {
        // Final game over display, if different from displayGameInfo's handling
        displayGameInfo(); // Ensure it's called one last time
        console.log("Game Over - final state rendered.");
    }
}

// Initial setup
initializeFactories();
gameLoop();

// --- Removed old prototype definitions and placeholder classes ---
// Factory.prototype.constructor = ... (and other Factory methods)
// TurretBullet.prototype.constructor = ... (and other TurretBullet methods)
// AntiAirTurret.prototype.constructor = ... (and other AntiAirTurret methods)
// EnemyJet.prototype.constructor = ... (and other EnemyJet methods)
// Battleship.prototype.constructor = ... (and other Battleship methods)
// VulcanBullet.prototype.constructor = ... (and other VulcanBullet methods)
// Missile.prototype.constructor = ... (and other Missile methods)
// class Factory { /* ... existing code ... */ } (and other placeholder classes)
// ... etc for all refactored classes
