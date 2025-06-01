const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

// Set canvas dimensions
canvas.width = 800;
canvas.height = 600;

// World Size Constants
const WORLD_WIDTH = 1600;
const WORLD_HEIGHT = 1200;
const GRID_SIZE = 50;

// Viewport Variables
let viewportX = 0;
let viewportY = 0;

// Game Object Arrays
let warehouses = [];
let enemyJets = [];

// Enemy Spawning Variables
let enemySpawnTimer = 0;
const ENEMY_SPAWN_INTERVAL = 3000; // ms
const MAX_ENEMY_JETS = 5;
const MS_PER_FRAME = 1000 / 60; // Approximate milliseconds per frame for 60FPS


// Stage Clear Variables
let stageClearMessage = "";
let stageClearTimer = 0;
const STAGE_CLEAR_DISPLAY_TIME = 3000;
let gameInitialized = false;

// Collision Detection Function
function checkCollision(rect1, rect2) {
    if (!rect1 || !rect2 ||
        typeof rect1.x === 'undefined' || typeof rect1.y === 'undefined' ||
        typeof rect1.width === 'undefined' || typeof rect1.height === 'undefined' ||
        typeof rect2.x === 'undefined' || typeof rect2.y === 'undefined' ||
        typeof rect2.width === 'undefined' || typeof rect2.height === 'undefined') {
        return false;
    }
    return rect1.x < rect2.x + rect2.width &&
           rect1.x + rect1.width > rect2.x &&
           rect1.y < rect2.y + rect2.height &&
           rect1.y + rect1.height > rect2.y;
}

class Helicopter {
    constructor(x, y) {
        this.x = x;
        this.y = y;
        this.width = 50;
        this.height = 30;
        this.speed = 3;
        this.color = 'green';
        this.keys = {};
        this.bullets = [];
        this.missiles = [];
        this.maxHealth = 100;
        this.currentHealth = this.maxHealth;
    }

    draw(ctx) {
        ctx.fillStyle = this.color;
        ctx.fillRect(this.x - viewportX, this.y - viewportY, this.width, this.height);
    }

    update() {
        let dx = 0;
        let dy = 0;

        if (this.keys['ArrowUp']) dy -= this.speed;
        if (this.keys['ArrowDown']) dy += this.speed;
        if (this.keys['ArrowLeft']) dx -= this.speed;
        if (this.keys['ArrowRight']) dx += this.speed;

        if (dx !== 0 && dy !== 0) {
            const factor = 1 / Math.sqrt(2);
            dx *= factor;
            dy *= factor;
        }

        this.x += dx;
        this.y += dy;

        this.x = Math.max(0, Math.min(WORLD_WIDTH - this.width, this.x));
        this.y = Math.max(0, Math.min(WORLD_HEIGHT - this.height, this.y));
    }

    fireVulcan() {
        const bulletWidth = 4;
        const bulletX = this.x + this.width / 2 - bulletWidth / 2;
        const bulletY = this.y;
        this.bullets.push(new VulcanBullet(bulletX, bulletY));
    }

    fireMissile() {
        const missileWidth = 8;
        const missileX = this.x + this.width / 2 - missileWidth / 2;
        const missileY = this.y + this.height;
        this.missiles.push(new Missile(missileX, missileY));
    }

    takeDamage(amount) {
        this.currentHealth -= amount;
        if (this.currentHealth < 0) {
            this.currentHealth = 0;
        }
        console.log("Player health: " + this.currentHealth);
    }
}

class VulcanBullet {
    constructor(x, y) {
        this.x = x;
        this.y = y;
        this.width = 4;
        this.height = 10;
        this.speed = 7;
        this.color = 'yellow';
        this.damage = 10;
    }

    update() {
        this.y -= this.speed;
    }

    draw(ctx) {
        ctx.fillStyle = this.color;
        ctx.fillRect(this.x - viewportX, this.y - viewportY, this.width, this.height);
    }
}

class Missile {
    constructor(x, y) {
        this.x = x;
        this.y = y;
        this.width = 8;
        this.height = 18;
        this.speed = 5;
        this.color = 'orange';
        this.damage = 50;
    }

    update() {
        this.y += this.speed;
    }

    draw(ctx) {
        ctx.fillStyle = this.color;
        ctx.fillRect(this.x - viewportX, this.y - viewportY, this.width, this.height);
    }
}

class Warehouse {
    constructor(x, y, width, height, health) {
        this.x = x;
        this.y = y;
        this.width = width;
        this.height = height;
        this.initialHealth = health;
        this.currentHealth = health;
        this.color = 'gray';
        this.destroyedColor = '#444';
        this.isDestroyed = false;
    }

    draw(ctx) {
        const screenX = this.x - viewportX;
        const screenY = this.y - viewportY;

        ctx.fillStyle = this.isDestroyed ? this.destroyedColor : this.color;
        ctx.fillRect(screenX, screenY, this.width, this.height);

        if (!this.isDestroyed && this.currentHealth < this.initialHealth) {
            const healthBarHeight = 5;
            const healthBarWidth = this.width;
            const healthPercentage = this.currentHealth / this.initialHealth;

            ctx.fillStyle = 'red';
            ctx.fillRect(screenX, screenY - healthBarHeight - 2, healthBarWidth, healthBarHeight);
            ctx.fillStyle = 'lime';
            ctx.fillRect(screenX, screenY - healthBarHeight - 2, healthBarWidth * healthPercentage, healthBarHeight);
        }
    }

    takeDamage(amount) {
        if (this.isDestroyed) {
            return;
        }
        this.currentHealth -= amount;
        if (this.currentHealth <= 0) {
            this.currentHealth = 0;
            this.isDestroyed = true;
            console.log('Warehouse destroyed at world x:', this.x, 'y:', this.y);
        }
    }
}

class EnemyJet {
    constructor(x, y, speed) {
        this.x = x;
        this.y = y;
        this.width = 40;
        this.height = 20;
        this.speed = speed;
        this.initialHealth = 30; // Standard health for jets
        this.currentHealth = this.initialHealth;
        this.color = 'red';
        this.isDestroyed = false;
        this.dx = 0;
        this.dy = 0;
    }

    draw(ctx, vX, vY) {
        if (this.isDestroyed) {
            return;
        }
        const screenX = this.x - vX;
        const screenY = this.y - vY;

        if (screenX > canvas.width || screenX + this.width < 0 ||
            screenY > canvas.height || screenY + this.height < 0) {
            return;
        }

        ctx.fillStyle = this.color;
        ctx.beginPath();

        if (Math.abs(this.dx) > Math.abs(this.dy)) {
            if (this.dx > 0) {
                ctx.moveTo(screenX, screenY);
                ctx.lineTo(screenX + this.width, screenY + this.height / 2);
                ctx.lineTo(screenX, screenY + this.height);
            } else {
                ctx.moveTo(screenX + this.width, screenY);
                ctx.lineTo(screenX, screenY + this.height / 2);
                ctx.lineTo(screenX + this.width, screenY + this.height);
            }
        } else {
            if (this.dy < 0) {
                 ctx.moveTo(screenX + this.width / 2, screenY);
                 ctx.lineTo(screenX, screenY + this.height);
                 ctx.lineTo(screenX + this.width, screenY + this.height);
            } else {
                 ctx.moveTo(screenX + this.width / 2, screenY + this.height);
                 ctx.lineTo(screenX, screenY);
                 ctx.lineTo(screenX + this.width, screenY);
            }
        }
        ctx.closePath();
        ctx.fill();
    }

    update() {
        if (this.isDestroyed) {
            return;
        }
        this.x += this.dx * this.speed;
        this.y += this.dy * this.speed;
    }

    takeDamage(amount) {
        if (this.isDestroyed) {
            return;
        }
        this.currentHealth -= amount;
        if (this.currentHealth <= 0) {
            this.currentHealth = 0;
            this.isDestroyed = true;
            console.log('EnemyJet destroyed at', this.x, this.y);
        }
    }
}

const player = new Helicopter(WORLD_WIDTH / 2 - 25, WORLD_HEIGHT / 2 - 15);

function initializeWarehouses() {
    warehouses = [];
    const warehouseWidth = 80;
    const warehouseHeight = 50;
    const warehouseHealth = 100;
    const positions = [
        { x: WORLD_WIDTH * 0.1, y: WORLD_HEIGHT - warehouseHeight - 10 },
        { x: WORLD_WIDTH * 0.3, y: WORLD_HEIGHT - warehouseHeight - 10 },
        { x: WORLD_WIDTH * 0.5, y: WORLD_HEIGHT - warehouseHeight - 10 },
        { x: WORLD_WIDTH * 0.7, y: WORLD_HEIGHT - warehouseHeight - 10 },
        { x: WORLD_WIDTH * 0.9, y: WORLD_HEIGHT - warehouseHeight - 10 }
    ];
    positions.forEach(pos => {
        warehouses.push(new Warehouse(pos.x, pos.y, warehouseWidth, warehouseHeight, warehouseHealth));
    });
    console.log(warehouses.length + ' warehouses initialized.');
    gameInitialized = true;
}

function spawnEnemyJet() {
    let spawnX, spawnY, dirX, dirY;
    const jetSpeed = player ? player.speed * 1.2 : 4;
    const edge = Math.floor(Math.random() * 4);
    switch (edge) {
        case 0:
            spawnX = Math.random() * WORLD_WIDTH; spawnY = -50;
            dirX = Math.random() * 2 - 1; dirY = 1;
            break;
        case 1:
            spawnX = WORLD_WIDTH + 50; spawnY = Math.random() * WORLD_HEIGHT;
            dirX = -1; dirY = Math.random() * 2 - 1;
            break;
        case 2:
            spawnX = Math.random() * WORLD_WIDTH; spawnY = WORLD_HEIGHT + 50;
            dirX = Math.random() * 2 - 1; dirY = -1;
            break;
        case 3:
            spawnX = -50; spawnY = Math.random() * WORLD_HEIGHT;
            dirX = 1; dirY = Math.random() * 2 - 1;
            break;
    }
    const magnitude = Math.sqrt(dirX * dirX + dirY * dirY);
    if (magnitude > 0) { dirX /= magnitude; dirY /= magnitude; }
    else { dirX = 1; dirY = 0; }
    const newJet = new EnemyJet(spawnX, spawnY, jetSpeed);
    newJet.dx = dirX; newJet.dy = dirY;
    enemyJets.push(newJet);
    // console.log("Spawned jet at:", spawnX.toFixed(0), spawnY.toFixed(0), "heading dx:", dirX.toFixed(2), "dy:", dirY.toFixed(2));
}

function drawScrollingBackground() {
    ctx.fillStyle = '#000011';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    const numStars = 200;
    ctx.fillStyle = '#FFFF00';
    for (let i = 0; i < numStars; i++) {
        let starWorldX = ((i * 37 + (i % 10) * 97 + i * 7 ) * 23) % WORLD_WIDTH;
        let starWorldY = ((i * 53 + (i % 10) * 101 + i * 11) * 29) % WORLD_HEIGHT;
        let starScreenX = starWorldX - viewportX;
        let starScreenY = starWorldY - viewportY;
        if (starScreenX >= 0 && starScreenX <= canvas.width &&
            starScreenY >= 0 && starScreenY <= canvas.height) {
            ctx.fillRect(starScreenX, starScreenY, 2, 2);
        }
    }
    ctx.strokeStyle = 'rgba(255,255,255,0.05)';
    ctx.lineWidth = 1;
    let startGridX = -(viewportX % GRID_SIZE);
    for (let x = startGridX; x < canvas.width; x += GRID_SIZE) {
        ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, canvas.height); ctx.stroke();
    }
    let startGridY = -(viewportY % GRID_SIZE);
    for (let y = startGridY; y < canvas.height; y += GRID_SIZE) {
        ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(canvas.width, y); ctx.stroke();
    }
}

window.addEventListener('keydown', (e) => {
    if (player) {
        player.keys[e.key] = true;
        if (e.key === ' ') { e.preventDefault(); player.fireVulcan(); }
        if (e.key === 'm' || e.key === 'M') { e.preventDefault(); player.fireMissile(); }
    }
});
window.addEventListener('keyup', (e) => { if (player) player.keys[e.key] = false; });

function gameLoop() {
    viewportX = player.x - canvas.width / 2;
    viewportY = player.y - canvas.height / 2;
    viewportX = Math.max(0, Math.min(WORLD_WIDTH - canvas.width, viewportX));
    viewportY = Math.max(0, Math.min(WORLD_HEIGHT - canvas.height, viewportY));

    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    drawScrollingBackground();

    enemySpawnTimer += MS_PER_FRAME;
    if (enemySpawnTimer >= ENEMY_SPAWN_INTERVAL) {
        enemySpawnTimer = 0;
        if (enemyJets.length < MAX_ENEMY_JETS) {
            spawnEnemyJet();
        }
    }

    if (player) {
        player.update();
        // Player Bullets Logic
        for (let i = player.bullets.length - 1; i >= 0; i--) {
            const bullet = player.bullets[i];
            bullet.update();
            let bulletRemoved = false;

            // Check collision with Warehouses
            for (let j = 0; j < warehouses.length; j++) {
                const warehouse = warehouses[j];
                if (!warehouse.isDestroyed && checkCollision(bullet, warehouse)) {
                    warehouse.takeDamage(bullet.damage);
                    player.bullets.splice(i, 1);
                    bulletRemoved = true; break;
                }
            }
            if (bulletRemoved) continue;

            // Check collision with EnemyJets
            for (let j = 0; j < enemyJets.length; j++) {
                const jet = enemyJets[j];
                if (!jet.isDestroyed && checkCollision(bullet, jet)) {
                    jet.takeDamage(bullet.damage);
                    player.bullets.splice(i, 1);
                    bulletRemoved = true; break;
                }
            }
            if (bulletRemoved) continue;

            // Off-screen check
            if (bullet.y + bullet.height < 0 || bullet.y > WORLD_HEIGHT) {
                 player.bullets.splice(i, 1);
            }
        }

        // Player Missiles Logic
        for (let i = player.missiles.length - 1; i >= 0; i--) {
            const missile = player.missiles[i];
            missile.update();
            let missileRemoved = false;

            // Check collision with Warehouses
            for (let j = 0; j < warehouses.length; j++) {
                const warehouse = warehouses[j];
                if (!warehouse.isDestroyed && checkCollision(missile, warehouse)) {
                    warehouse.takeDamage(missile.damage);
                    player.missiles.splice(i, 1);
                    missileRemoved = true; break;
                }
            }
            if (missileRemoved) continue;

            // Check collision with EnemyJets
            for (let j = 0; j < enemyJets.length; j++) {
                const jet = enemyJets[j];
                if (!jet.isDestroyed && checkCollision(missile, jet)) {
                    jet.takeDamage(missile.damage);
                    player.missiles.splice(i, 1);
                    missileRemoved = true; break;
                }
            }
            if (missileRemoved) continue;

            // Off-screen check
            if (missile.y > WORLD_HEIGHT || missile.y < 0 - missile.height) {
                 player.missiles.splice(i, 1);
            }
        }
    }

    warehouses.forEach(warehouse => warehouse.draw(ctx));

    for (let i = enemyJets.length - 1; i >= 0; i--) {
        const jet = enemyJets[i];
        jet.update();
        jet.draw(ctx, viewportX, viewportY);
        const removalMargin = 200;
        if (jet.isDestroyed ||
            jet.x < -removalMargin || jet.x > WORLD_WIDTH + removalMargin ||
            jet.y < -removalMargin || jet.y > WORLD_HEIGHT + removalMargin) {
            enemyJets.splice(i, 1);
            // console.log('Removed jet. Remaining jets:', enemyJets.length);
        }
    }

    if (player) player.draw(ctx);
    if (player) {
        player.bullets.forEach(bullet => bullet.draw(ctx));
        player.missiles.forEach(missile => missile.draw(ctx));
    }

    if (stageClearTimer <= 0 && gameInitialized) {
        let allWarehousesDestroyed = true;
        if (warehouses.length > 0) {
           for (let i = 0; i < warehouses.length; i++) {
               if (!warehouses[i].isDestroyed) { allWarehousesDestroyed = false; break; }
           }
        } else { allWarehousesDestroyed = false; }
        if (allWarehousesDestroyed && warehouses.length > 0) {
            console.log("Stage Clear!");
            stageClearMessage = "Stage Clear!";
            stageClearTimer = STAGE_CLEAR_DISPLAY_TIME;
            initializeWarehouses();
        }
    }

    if (stageClearTimer > 0) {
        ctx.fillStyle = "rgba(0, 0, 0, 0.7)";
        ctx.fillRect(0, canvas.height / 2 - 50, canvas.width, 100);
        ctx.font = "bold 48px Arial"; ctx.fillStyle = "white"; ctx.textAlign = "center";
        ctx.fillText(stageClearMessage, canvas.width / 2, canvas.height / 2 + 15);
        ctx.textAlign = "left";
        stageClearTimer -= MS_PER_FRAME;
        if (stageClearTimer <= 0) { stageClearMessage = ""; stageClearTimer = 0; }
    }

    if (player) {
        ctx.font = "20px Arial"; ctx.fillStyle = "white"; ctx.textAlign = "left";
        ctx.fillText("Health: " + player.currentHealth + "/" + player.maxHealth, 10, 30);
    }
    requestAnimationFrame(gameLoop);
}

initializeWarehouses();
gameLoop();
