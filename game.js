const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

// Set canvas dimensions
canvas.width = 800;
canvas.height = 600;

let warehouses = []; // Global array for warehouses

// Stage Clear Variables
let stageClearMessage = "";
let stageClearTimer = 0; // Timer to display the message
const STAGE_CLEAR_DISPLAY_TIME = 3000; // Display message for 3 seconds (in milliseconds)
let gameInitialized = false; // To ensure initializeWarehouses has run at least once

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
        ctx.fillRect(this.x, this.y, this.width, this.height);
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

        this.x = Math.max(0, Math.min(canvas.width - this.width, this.x));
        this.y = Math.max(0, Math.min(canvas.height - this.height, this.y));
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
        // Future: Add game over check here if this.currentHealth <= 0
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
        ctx.fillRect(this.x, this.y, this.width, this.height);
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
        ctx.fillRect(this.x, this.y, this.width, this.height);
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
        ctx.fillStyle = this.isDestroyed ? this.destroyedColor : this.color;
        ctx.fillRect(this.x, this.y, this.width, this.height);

        if (!this.isDestroyed && this.currentHealth < this.initialHealth) {
            const healthBarHeight = 5;
            const healthBarWidth = this.width;
            const healthPercentage = this.currentHealth / this.initialHealth;

            ctx.fillStyle = 'red';
            ctx.fillRect(this.x, this.y - healthBarHeight - 2, healthBarWidth, healthBarHeight);
            ctx.fillStyle = 'lime';
            ctx.fillRect(this.x, this.y - healthBarHeight - 2, healthBarWidth * healthPercentage, healthBarHeight);
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
            console.log('Warehouse destroyed at x:', this.x, 'y:', this.y);
        }
    }
}

const player = new Helicopter(canvas.width / 2 - 25, canvas.height / 2 - 15);

function initializeWarehouses() {
    warehouses = [];
    const warehouseWidth = 80;
    const warehouseHeight = 50;
    const warehouseHealth = 100;

    const positions = [
        { x: 100, y: canvas.height - 60 },
        { x: 230, y: canvas.height - 60 },
        { x: 360, y: canvas.height - 60 },
        { x: 490, y: canvas.height - 60 },
        { x: 620, y: canvas.height - 60 }
    ];

    positions.forEach(pos => {
        warehouses.push(new Warehouse(pos.x, pos.y, warehouseWidth, warehouseHeight, warehouseHealth));
    });
    console.log(warehouses.length + ' warehouses initialized.');
    gameInitialized = true;
}

window.addEventListener('keydown', (e) => {
    if (player) {
        player.keys[e.key] = true;
        if (e.key === ' ') {
            e.preventDefault();
            player.fireVulcan();
        }
        if (e.key === 'm' || e.key === 'M') {
            e.preventDefault();
            player.fireMissile();
        }
    }
});

window.addEventListener('keyup', (e) => {
    if (player) {
        player.keys[e.key] = false;
    }
});

function gameLoop() {
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    if (player) {
        player.update();
        player.draw(ctx);

        for (let i = player.bullets.length - 1; i >= 0; i--) {
            const bullet = player.bullets[i];
            bullet.update();
            let bulletHitWarehouse = false;
            for (let j = 0; j < warehouses.length; j++) {
                const warehouse = warehouses[j];
                if (!warehouse.isDestroyed && checkCollision(bullet, warehouse)) {
                    warehouse.takeDamage(bullet.damage);
                    player.bullets.splice(i, 1);
                    bulletHitWarehouse = true;
                    break;
                }
            }
            if (!bulletHitWarehouse) {
                bullet.draw(ctx);
                if (bullet.y + bullet.height < 0) {
                    player.bullets.splice(i, 1);
                }
            }
        }

        for (let i = player.missiles.length - 1; i >= 0; i--) {
            const missile = player.missiles[i];
            missile.update();
            let missileHitWarehouse = false;
            for (let j = 0; j < warehouses.length; j++) {
                const warehouse = warehouses[j];
                if (!warehouse.isDestroyed && checkCollision(missile, warehouse)) {
                    warehouse.takeDamage(missile.damage);
                    player.missiles.splice(i, 1);
                    missileHitWarehouse = true;
                    break;
                }
            }
            if (!missileHitWarehouse) {
                missile.draw(ctx);
                if (missile.y > canvas.height) {
                    player.missiles.splice(i, 1);
                }
            }
        }
    }

    warehouses.forEach(warehouse => {
        if (warehouse) warehouse.draw(ctx);
    });

    if (stageClearTimer <= 0 && gameInitialized) {
        let allWarehousesDestroyed = true;
        if (warehouses.length > 0) {
           for (let i = 0; i < warehouses.length; i++) {
               if (!warehouses[i].isDestroyed) {
                   allWarehousesDestroyed = false;
                   break;
               }
           }
        } else {
           allWarehousesDestroyed = false;
        }

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
        ctx.font = "bold 48px Arial";
        ctx.fillStyle = "white";
        ctx.textAlign = "center";
        ctx.fillText(stageClearMessage, canvas.width / 2, canvas.height / 2 + 15);
        ctx.textAlign = "left";
        stageClearTimer -= (1000/60);
        if (stageClearTimer <= 0) {
            stageClearMessage = "";
            stageClearTimer = 0;
        }
    }

    // --- Display Player Health ---
    if (player) {
        ctx.font = "20px Arial";
        ctx.fillStyle = "white";
        ctx.textAlign = "left";
        ctx.fillText("Health: " + player.currentHealth + "/" + player.maxHealth, 10, 30);
    }

    requestAnimationFrame(gameLoop);
}

initializeWarehouses();
gameLoop();
