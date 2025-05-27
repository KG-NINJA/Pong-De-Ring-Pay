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

function drawScrollingBackground() { /* ... existing code ... */ }
class VulcanBullet { /* ... existing code ... */ }
class Missile { /* ... existing code ... */ }
class Factory { /* ... existing code ... */ }
class TurretBullet { /* ... existing code ... */ }
class AntiAirTurret { /* ... existing code ... */ }
class EnemyJet { /* ... existing code ... */ }
class Battleship { /* ... existing code ... */ }
function initializeFactories(){ /* ... existing code ... */ }
function spawnEnemyJet() { /* ... existing code ... */ }
function drawAimingReticle() { /* ... existing code ... */ }

// Ellipsizing unchanged classes and functions for brevity in this diff view
// Actual file will contain their full definitions from the previous overwrite.
Factory.prototype.draw = function(voX,voY){const sX=this.mapX-voX;const sY=this.mapY-voY;if(sX>canvas.width+this.width||sX<-this.width||sY>canvas.height+this.height||sY<-this.height)return;if(this.isDestroyed){ctx.fillStyle='gray';ctx.fillRect(sX-this.width/2,sY-this.height/2,this.width,this.height/2);ctx.fillStyle='#555';ctx.fillRect(sX-this.width/2+5,sY-this.height/4,this.width-10,this.height/3);}else{ctx.fillStyle='purple';ctx.fillRect(sX-this.width/2,sY-this.height/2,this.width,this.height);const hpBW=this.width;const hpBH=5;const cDMH=Math.min(MAX_HP_CAP,Math.max(this.initialMaxHp,this.targetHpBasedOnAge));const hpR=this.hp/cDMH;ctx.fillStyle='red';ctx.fillRect(sX-hpBW/2,sY-this.height/2-hpBH-2,hpBW,hpBH);ctx.fillStyle='green';ctx.fillRect(sX-hpBW/2,sY-this.height/2-hpBH-2,hpBW*hpR,hpBH);}ctx.fillStyle='white';ctx.font='10px Arial';ctx.textAlign='center';ctx.fillText(this.id,sX,sY+this.height/2+10);ctx.textAlign='left';for(const t of this.antiAirTurrets)t.draw(voX,voY);};
Factory.prototype.takeDamage = function(amount){ if(this.isDestroyed)return; this.hp-=amount; if(this.hp<=0 && !this.isDestroyed){ this.hp=0;this.isDestroyed=true; score += 750; console.log(`Factory ${this.id} destroyed. Score: ${score}`); explosions.push(new Explosion(this.mapX, this.mapY, this.width * 0.9, 45)); explosions.push(new Explosion(this.mapX - this.width/3, this.mapY - this.height/3, this.width * 0.6, 55)); explosions.push(new Explosion(this.mapX + this.width/3, this.mapY + this.height/3, this.width * 0.7, 60)); /* // TODO: Play explosion sound (large factory) */ for(const t of this.antiAirTurrets) if(!t.isDestroyed) t.takeDamage(t.hp + 1); }};
AntiAirTurret.prototype.takeDamage = function(amount){ if(this.isDestroyed)return; this.hp-=amount; if(this.hp<=0 && !this.isDestroyed){ this.hp=0;this.isDestroyed=true; score += 75; console.log(`Turret ${this.id} destroyed. Score: ${score}`); explosions.push(new Explosion(this.mapX, this.mapY, this.width * 2.5, 25)); /* // TODO: Play explosion sound (medium) */ }};
EnemyJet.prototype.takeDamage = function(amount){ if(this.isDestroyed) return;  this.hp -= amount; if (this.hp <= 0 && !this.isDestroyed) {  this.hp = 0; this.isDestroyed = true; score += 150;  console.log(`Jet ${this.id} destroyed. Score: ${score}`); explosions.push(new Explosion(this.mapX, this.mapY, this.width * 2.5, 30)); /* // TODO: Play explosion sound (medium/fast) */ }};
Battleship.prototype.takeDamage = function(amount){ if(this.isDestroyed || !this.isActive) return; this.hp -= amount; if (this.hp <= 0 && !this.isDestroyed) { this.hp = 0; this.isDestroyed = true; this.isActive = false;  score += 4000; console.log(`Battleship ${this.id} destroyed! Score: ${score}`); explosions.push(new Explosion(this.mapX, this.mapY, this.width * 0.8, 80)); explosions.push(new Explosion(this.mapX - this.width/3, this.mapY - this.height/4, this.width * 0.6, 90)); explosions.push(new Explosion(this.mapX + this.width/3, this.mapY + this.height/4, this.width * 0.6, 100)); /* // TODO: Play massive explosion sound */ this.turrets.forEach(turret => { if (!turret.isDestroyed) turret.takeDamage(turret.hp + 1000); }); }};
Missile.prototype.update = function(){ if(this.reached) return; this.mapX+=this.vX; this.mapY+=this.vY; const dX=this.tMX-this.mapX; const dY=this.tMY-this.mapY; if(Math.sqrt(dX*dX+dY*dY)<this.speed*1.5) { this.reached=true; explosions.push(new Explosion(this.mapX, this.mapY, this.width * 5, 25)); /* // TODO: Play missile explosion sound */ }};
AntiAirTurret.prototype.fireAtPlayer = function(pMX,pMY){const nB=new TurretBullet(this.mapX,this.mapY,pMX,pMY);allTurretBullets.push(nB); /*// TODO: Play AA Turret shoot sound*/ };
EnemyJet.prototype.fireWeapon = function(pMX, pMY) { const bSX = this.mapX + Math.cos(this.angle)*(this.height/2+5); const bSY = this.mapY + Math.sin(this.angle)*(this.height/2+5); allTurretBullets.push(new TurretBullet(bSX, bSY, pMX, pMY)); /* // TODO: Play jet shoot sound */};

// Restore full definitions for functions that were previously ellipsized in the overwrite block
drawScrollingBackground = function() {
    ctx.fillStyle = '#000011'; ctx.fillRect(0, 0, canvas.width, canvas.height);
    const viewOriginX = player.mapX - player.x; const viewOriginY = player.mapY - player.y;
    ctx.fillStyle = '#FFFF00'; 
    for (let i = 0; i < 100; i++) { 
        let starMapX = ((i*37+(i%10)*97)*23)%MAP_WIDTH; let starMapY = ((i*53+(i%10)*101)*29)%MAP_HEIGHT;
        let screenX = starMapX - viewOriginX; let screenY = starMapY - viewOriginY; // Simpler star drawing relative to viewport origin
        screenX = (screenX % MAP_WIDTH + MAP_WIDTH) % MAP_WIDTH; // Wrap within map
        screenY = (screenY % MAP_HEIGHT + MAP_HEIGHT) % MAP_HEIGHT;
        // Adjust to keep stars on screen if they wrap around the map conceptually
        if (screenX > canvas.width + viewOriginX) screenX -= MAP_WIDTH; else if (screenX < viewOriginX -MAP_WIDTH) screenX += MAP_WIDTH;
        if (screenY > canvas.height + viewOriginY) screenY -= MAP_HEIGHT; else if (screenY < viewOriginY-MAP_HEIGHT) screenY += MAP_HEIGHT;

        ctx.fillRect(screenX - viewOriginX, screenY - viewOriginY, 2, 2); // Final draw relative to canvas
    }
    ctx.strokeStyle = 'rgba(255,255,255,0.1)'; ctx.lineWidth = 1;
    let offsetX = viewOriginX % GRID_SIZE; let offsetY = viewOriginY % GRID_SIZE;
    for (let x = -offsetX; x < canvas.width; x += GRID_SIZE) { ctx.beginPath(); ctx.moveTo(x,0); ctx.lineTo(x,canvas.height); ctx.stroke(); }
    for (let y = -offsetY; y < canvas.height; y += GRID_SIZE) { ctx.beginPath(); ctx.moveTo(0,y); ctx.lineTo(canvas.width,y); ctx.stroke(); }
};
VulcanBullet.prototype.draw = function(voX, voY) { const sX=this.mapX-voX; const sY=this.mapY-voY; if(sX > -this.width && sX < canvas.width && sY > -this.height && sY < canvas.height){ ctx.fillStyle='yellow'; ctx.fillRect(sX,sY,this.width,this.height);}};
Missile.prototype.draw = function(voX,voY){const sX=this.mapX-voX;const sY=this.mapY-voY;if(sX<-this.width*2||sX>canvas.width+this.width*2||sY<-this.height*2||sY>canvas.height+this.height*2)return;ctx.save();ctx.translate(sX,sY);ctx.rotate(this.angle);ctx.fillStyle='orange';ctx.beginPath();ctx.moveTo(0,-this.height/2);ctx.lineTo(-this.width/2,this.height/2);ctx.lineTo(this.width/2,this.height/2);ctx.closePath();ctx.fill();ctx.restore();};
Factory.prototype.constructor = function(mX,mY,id,w=80,h=60){this.mapX=mX;this.mapY=mY;this.id=id;this.width=w;this.height=h;this.initialMaxHp=500;this.hp=this.initialMaxHp;this.maxHp=this.initialMaxHp;this.isDestroyed=false;this.creationTime=Date.now();this.targetHpBasedOnAge=this.initialMaxHp;this.antiAirTurrets=[];this.turretSpawnRate=30000;this.maxTurrets=4;this.lastTurretSpawnTime=this.creationTime;};
Factory.prototype.spawnAntiAirTurret = function(){if(this.antiAirTurrets.length>=this.maxTurrets)return;const tI=this.antiAirTurrets.length;let oX=0,oY=0;if(tI===0){oX=-this.width/2-20;oY=-this.height/2;}else if(tI===1){oX=this.width/2+20;oY=-this.height/2;}else if(tI===2){oX=-this.width/2-20;oY=this.height/2;}else if(tI===3){oX=this.width/2+20;oY=this.height/2;}const nT=new AntiAirTurret(this.mapX+oX,this.mapY+oY,this.id);this.antiAirTurrets.push(nT);allAntiAirTurrets.push(nT);};
Factory.prototype.updateDurability = function(gTIS){if(this.isDestroyed)return;const eS=Math.max(0,gTIS-((this.creationTime-gameStartTime)/1000));this.targetHpBasedOnAge=Math.min(this.initialMaxHp+(eS/60)*HP_INCREASE_PER_MINUTE,MAX_HP_CAP);this.maxHp=this.targetHpBasedOnAge;if(this.hp<this.targetHpBasedOnAge)this.hp=Math.min(this.hp+HP_INCREASE_RATE_PER_FRAME,this.targetHpBasedOnAge);this.hp=Math.min(this.hp,MAX_HP_CAP,this.maxHp);const cT=Date.now();if(this.antiAirTurrets.length<this.maxTurrets&&(cT-this.lastTurretSpawnTime)>=this.turretSpawnRate){this.spawnAntiAirTurret();this.lastTurretSpawnTime=cT;}this.antiAirTurrets=this.antiAirTurrets.filter(t=>!t.isDestroyed);};
TurretBullet.prototype.constructor = function(mX,mY,tMX,tMY){this.mapX=mX;this.mapY=mY;this.targetMapX=tMX;this.targetMapY=tMY;this.speed=6;this.width=6;this.height=6;this.damage=5;this.lifeSpanFrames=180;this.framesAlive=0;this.markedForRemoval=false;const dX=this.targetMapX-this.mapX;const dY=this.targetMapY-this.mapY;const dist=Math.sqrt(dX*dX+dY*dY);if(dist===0){this.velocityX=0;this.velocityY=0;}else{this.velocityX=(dX/dist)*this.speed;this.velocityY=(dY/dist)*this.speed;}};
TurretBullet.prototype.update = function(){if(this.markedForRemoval)return;this.mapX+=this.velocityX;this.mapY+=this.velocityY;this.framesAlive++;if(this.framesAlive>=this.lifeSpanFrames)this.markedForRemoval=true;};
TurretBullet.prototype.draw = function(voX,voY){if(this.markedForRemoval)return;const sX=this.mapX-voX;const sY=this.mapY-voY;if(sX<-this.width||sX>canvas.width+this.width||sY<-this.height||sY>canvas.height+this.height)return;ctx.fillStyle='rgb(255,100,100)';ctx.beginPath();ctx.arc(sX,sY,this.width/2,0,Math.PI*2);ctx.fill();};
AntiAirTurret.prototype.constructor = function(mX,mY,pFId){this.mapX=mX;this.mapY=mY;this.pFId=pFId;this.width=20;this.height=20;this.hp=75;this.maxHp=75;this.isDestroyed=false;this.fireRate=1;this.canFire=true;this.range=250;this.id=`T_${pFId}_${Date.now()%10000}`};
AntiAirTurret.prototype.draw = function(voX,voY){if(this.isDestroyed)return;const sX=this.mapX-voX;const sY=this.mapY-voY;if(sX<-this.width||sX>canvas.width+this.width||sY<-this.height||sY>canvas.height+this.height)return;ctx.fillStyle='olive';ctx.fillRect(sX-this.width/2,sY-this.height/2,this.width,this.height);ctx.strokeStyle='black';ctx.lineWidth=3;ctx.beginPath();ctx.moveTo(sX,sY);ctx.lineTo(sX,sY-this.height);ctx.stroke();};
AntiAirTurret.prototype.update = function(pMX,pMY,gTIS){if(this.isDestroyed)return;const dX=pMX-this.mapX;const dY=pMY-this.mapY;const distToP=Math.sqrt(dX*dX+dY*dY);if(distToP<=this.range&&this.canFire){this.fireAtPlayer(pMX,pMY);this.canFire=false;setTimeout(()=>this.canFire=true,1000/this.fireRate);}};
EnemyJet.prototype.constructor = function(mapX, mapY, angle) { this.mapX = mapX; this.mapY = mapY; this.angle = angle; this.width = 40; this.height = 20; this.hp = 40; this.maxHp = 40; this.speed = (Math.random() * 2) + 4;  this.isDestroyed = false; this.fireRate = 0.5; this.canFire = true; this.movementPattern = 'flyStraight'; this.velocityX = Math.cos(this.angle) * this.speed; this.velocityY = Math.sin(this.angle) * this.speed; this.id = `jet_${Date.now()}_${Math.floor(Math.random()*1000)}`; };
Battleship.prototype.constructor = function(mapX, mapY) { this.id = `battleship_${Date.now()}`; this.mapX = mapX; this.mapY = mapY; this.width = 280;  this.height = 90; this.hp = 2500; this.maxHp = 2500; this.speed = 1; this.isDestroyed = false; this.isActive = false;  this.angle = 0;  this.turrets = []; this.turretRelativePositions = [ { x: -this.width * 0.35, y: -this.height * 0.25 }, { x: -this.width * 0.35, y: this.height * 0.25 }, { x: 0, y: -this.height * 0.3 }, { x: 0, y: this.height * 0.3 }, { x: this.width * 0.35, y: 0 }, ]; this.patrolTargetX1 = this.width / 2 + 100;  this.patrolTargetX2 = MAP_WIDTH - this.width / 2 - 100;  this.patrolDirection = 1;  this.mapX = -this.width;  this.mapY = MAP_HEIGHT / 2;  this.angle = 0;  this.velocityX = this.speed; this.velocityY = 0; };
initializeFactories = function(){factories=[];const fD=[{id:'F1',mapX:300,mapY:300},{id:'F2',mapX:MAP_WIDTH-300,mapY:300},{id:'F3',mapX:300,mapY:MAP_HEIGHT-300},{id:'F4',mapX:MAP_WIDTH-300,mapY:MAP_HEIGHT-300},{id:'F5',mapX:MAP_WIDTH/2,mapY:200},{id:'F6',mapX:MAP_WIDTH/2,mapY:MAP_HEIGHT-200},{id:'F7',mapX:MAP_WIDTH/2,mapY:MAP_HEIGHT/2}];fD.forEach(d=>factories.push(new Factory(d.mapX,d.mapY,d.id)));};
spawnEnemyJet = function() { if (allEnemyJets.length >= maxEnemyJets) return; let sX, sY, angle; const edge = Math.floor(Math.random()*4); switch(edge){case 0:sX=Math.random()*MAP_WIDTH;sY=-50;angle=Math.PI/2+(Math.random()-0.5)*(Math.PI/4);break;case 1:sX=MAP_WIDTH+50;sY=Math.random()*MAP_HEIGHT;angle=Math.PI+(Math.random()-0.5)*(Math.PI/4);break;case 2:sX=Math.random()*MAP_WIDTH;sY=MAP_HEIGHT+50;angle=-Math.PI/2+(Math.random()-0.5)*(Math.PI/4);break;case 3:sX=-50;sY=Math.random()*MAP_HEIGHT;angle=0+(Math.random()-0.5)*(Math.PI/4);break;} allEnemyJets.push(new EnemyJet(sX, sY, angle));};
drawAimingReticle = function() { const x=player.aimingReticle.x; const y=player.aimingReticle.y; const size=player.aimingReticle.size; ctx.strokeStyle='red'; ctx.lineWidth=2; ctx.beginPath(); ctx.moveTo(x-size/2,y);ctx.lineTo(x+size/2,y);ctx.moveTo(x,y-size/2);ctx.lineTo(x,y+size/2);ctx.stroke(); ctx.beginPath();ctx.arc(x,y,size/4,0,Math.PI*2);ctx.stroke();};

function gameLoop() {
    ctx.clearRect(0,0,canvas.width,canvas.height);
    drawScrollingBackground();
    const cgTIS=(Date.now()-gameStartTime)/1000;
    if(!gameOver)player.update(); player.draw(); drawAimingReticle();
    const voX=player.mapX-player.x; const voY=player.mapY-player.y;

    for(let i=player.vulcanBullets.length-1;i>=0;i--){const b=player.vulcanBullets[i];b.update();b.draw(voX,voY);let bRmv=false;
        for(const f of factories)if(!f.isDestroyed&&b.mapX>=f.mapX-f.width/2&&b.mapX<=f.mapX+f.width/2&&b.mapY>=f.mapY-f.height/2&&b.mapY<=f.mapY+f.height/2){f.takeDamage(b.damage);player.vulcanBullets.splice(i,1);bRmv=true;break;}
        if(!bRmv)for(const jet of allEnemyJets)if(!jet.isDestroyed&&b.mapX>=jet.mapX-jet.width/2&&b.mapX<=jet.mapX+jet.width/2&&b.mapY>=jet.mapY-jet.height/2&&b.mapY<=jet.mapY+jet.height/2){jet.takeDamage(b.damage);player.vulcanBullets.splice(i,1);bRmv=true;break;}
        if(!bRmv && battleship && battleship.isActive && !battleship.isDestroyed &&
           b.mapX >= battleship.mapX - battleship.width/2 && b.mapX <= battleship.mapX + battleship.width/2 &&
           b.mapY >= battleship.mapY - battleship.height/2 && b.mapY <= battleship.mapY + battleship.height/2) {
            battleship.takeDamage(b.damage); player.vulcanBullets.splice(i,1); bRmv=true;
        }
        if(!bRmv&&player.vulcanBullets[i]&&(Math.abs(b.mapY-player.mapY)>canvas.height*1.5||b.mapY<0||b.mapY>MAP_HEIGHT))player.vulcanBullets.splice(i,1);}

    for(let i=player.missiles.length-1;i>=0;i--){const m=player.missiles[i];m.update();m.draw(voX,voY);
        if(m.reached){
            let hitSomething = false;
            for(const f of factories)if(!f.isDestroyed&&m.tMX>=f.mapX-f.width/2&&m.tMX<=f.mapX+f.width/2&&m.tMY>=f.mapY-f.height/2&&m.tMY<=f.mapY+f.height/2){f.takeDamage(m.damage); hitSomething=true;}
            for(const jet of allEnemyJets)if(!jet.isDestroyed&&m.tMX>=jet.mapX-jet.width/2&&m.tMX<=jet.mapX+jet.width/2&&m.tMY>=jet.mapY-jet.height/2&&m.tMY<=jet.mapY+jet.height/2){jet.takeDamage(m.damage); hitSomething=true;}
            if(battleship && battleship.isActive && !battleship.isDestroyed &&
               m.tMX >= battleship.mapX - battleship.width/2 && m.tMX <= battleship.mapX + battleship.width/2 &&
               m.tMY >= battleship.mapY - battleship.height/2 && m.tMY <= battleship.mapY + battleship.height/2){
                battleship.takeDamage(m.damage); hitSomething=true;
            }
            player.missiles.splice(i,1);
        } else if(m.mapY>MAP_HEIGHT+m.height||m.mapY<-m.height||m.mapX<-m.width||m.mapX>MAP_WIDTH+m.width)player.missiles.splice(i,1);}

    for(const f of factories){f.updateDurability(cgTIS);f.draw(voX,voY);}
    for(let i=allAntiAirTurrets.length-1;i>=0;i--){const t=allAntiAirTurrets[i];if(t.isDestroyed)allAntiAirTurrets.splice(i,1);else t.update(player.mapX,player.mapY,cgTIS);}
    
    for(let i=allTurretBullets.length-1;i>=0;i--){const b=allTurretBullets[i];b.update();b.draw(voX,voY);
        const pSHX=player.x-player.width/2;const pSHY=player.y-player.height/2;const bSX=b.mapX-voX;const bSY=b.mapY-voY;
        if(!b.markedForRemoval&&bSX-b.width/2<pSHX+player.width&&bSX+b.width/2>pSHX&&bSY-b.height/2<pSHY+player.height&&bSY+b.height/2>pSHY){if(!gameOver)handlePlayerMiss(b.damage);b.markedForRemoval=true;}
        if(b.markedForRemoval)allTurretBullets.splice(i,1);
    }

    jetSpawnTimer+=16; if(jetSpawnTimer>=currentJetSpawnInterval){spawnEnemyJet();jetSpawnTimer=0;}
    for(let i=allEnemyJets.length-1;i>=0;i--){const jet=allEnemyJets[i];
        if(jet.isDestroyed)allEnemyJets.splice(i,1);
        else{jet.update(player.mapX,player.mapY,voX,voY,MAP_WIDTH,MAP_HEIGHT);jet.draw(voX,voY);}}

    if (!isStageClearing) {
        if (checkAllFactoriesDestroyed()) {
            let proceedToClear = false;
            if (battleshipAppeared) { if (battleship && battleship.isDestroyed) proceedToClear = true; } 
            else proceedToClear = true;
            if (proceedToClear) {
                isStageClearing = true; stageClearMessage = `STAGE ${stageNumber} CLEAR!`;
                stageClearTimer = stageClearDuration; console.log(stageClearMessage);
            }
        }
    } else { 
        stageClearTimer -= 16; 
        if (stageClearTimer <= 0) resetGameForNextStage();
    }
    
    if (!battleshipAppeared && cgTIS >= BATTLESHIP_APPEAR_TIME && !isStageClearing) { 
        battleship = new Battleship(0, MAP_HEIGHT / 2); 
        battleship.initializeTurrets(AntiAirTurret); 
        battleship.isActive = true; battleshipAppeared = true;
        console.log("The GIANT BATTLESHIP has appeared!");
        // DEV_TEST: Battleship Appearance Log
        console.log("DEV_TEST: Battleship appeared at " + cgTIS.toFixed(2) + "s. Expected around: " + BATTLESHIP_APPEAR_TIME + "s.");
    }
    if (battleship && battleship.isActive && !isStageClearing) { 
        battleship.update(player.mapX, player.mapY, MAP_WIDTH, MAP_HEIGHT, cgTIS);
        battleship.draw(voX, voY);
    } else if (battleship && battleship.isDestroyed && battleshipAppeared && !isStageClearing) { 
        battleship.draw(voX, voY); 
    }

    // Update and Draw Explosions
    for (let i = explosions.length - 1; i >= 0; i--) {
        const explosion = explosions[i];
        explosion.update();
        explosion.draw(voX, voY);
        if (explosion.isComplete) {
            explosions.splice(i, 1);
        }
    }

    displayGameInfo(); requestAnimationFrame(gameLoop);
}
initializeFactories(); gameLoop();
// --- ここから追加 ---
window.onload = () => {
    const loadingMessage = document.getElementById('loadingMessage');
    if (loadingMessage) {
        loadingMessage.style.display = 'none';
    }
};
// --- ここまで追加 ---
