class Weapon {
    constructor(player, stats) {
        this.player = player;
        this.stats = stats || {};
        this.name = this.stats.name || 'Arma';
        this.damage = this.stats.damage || 0;
        this.range = this.stats.range || Infinity;
        this.destroyRadius = this.stats.destroyRadius || 25;
        this.projectileRadius = this.stats.projectileRadius || 5;
        this.gravity = this.stats.gravity || 0.5;
        this.bounceCount = this.stats.bounceCount || 0;
        this.guided = !!(this.stats.guided);
        this.color = this.stats.color || '#ff6600';
        this.infinite = !!(this.stats.infinite);
        this.spawnFrom = this.stats.spawnFrom || 'muzzle';
        this.projectileCount = this.stats.projectileCount || 1;
        this.spreadAngle = this.stats.spreadAngle || 0;
        this.breaksTerrain = this.stats.breaksTerrain !== false;
        this.maxLifetime = this.stats.maxLifetime !== undefined ? this.stats.maxLifetime : Infinity;
        this.drill = !!(this.stats.drill);
        this.drop = !!(this.stats.drop);
        this.fallSpeed = this.stats.fallSpeed || 1.2;
        this.dropWeapon = this.stats.dropWeapon || null;
        this.heal = this.stats.heal || 0;

        this.icon = new Image();
        this.icon.src = this.stats.icon || 'img/guns/default.png';

        this.projectileImage = new Image();
        this.projectileImage.src = this.stats.projectileImage || 'img/projectile/default.png';

        this.fireRate = this.stats.fireRate || 18;
        this.cooldown = 0;

        this.maxAmmo = this.stats.shots || 1;
        this.reloadTime = this.stats.reloadTime || 30;
        this.reloadTimer = 0;
        this.reloading = false;

        this.packSize = this.stats.packSize || 5;
        this.price = this.stats.price || 25;

        if (this.infinite) {
            this.stock = Infinity;
            this.ammo = this.maxAmmo;
        } else {
            this.stock = this.stats.startStock || 0;
            this.ammo = Math.min(this.maxAmmo, this.stock);
        }

        this.mouseX = 0;
        this.mouseY = 0;
        this.angle = 0;
        this.power = 0;
        this.parabolaPoints = [];
        this.parabolaSets = [];
        this.aimPoint = { x: 0, y: 0 };

        this.onMouseMove = (e) => {
            this.mouseX = e.clientX;
            this.mouseY = e.clientY;
        };

        window.addEventListener('mousemove', this.onMouseMove);
    }

    destroy() {
        window.removeEventListener('mousemove', this.onMouseMove);
    }

    buy() {
        const cost = this.price;
        if (this.infinite || this.player.gold < cost) return false;

        this.player.gold -= cost;
        this.stock += this.packSize;
        if (this.ammo < this.maxAmmo) {
            this.ammo = Math.min(this.maxAmmo, this.stock);
        }
        return true;
    }

    getCanvasMousePos(canvas) {
        const rect = canvas.getBoundingClientRect();
        const scaleX = canvas.width / rect.width;
        const scaleY = canvas.height / rect.height;
        return {
            x: (this.mouseX - rect.left) * scaleX,
            y: (this.mouseY - rect.top) * scaleY
        };
    }

    calculateTrajectory(canvas) {
        const pos = this.getCanvasMousePos(canvas);
        this.aimPoint = pos;

        if (this.heal) {
            this.angle = 0;
            this.power = 0;
            this.parabolaPoints = [];
            this.parabolaSets = [];
            return { vx: 0, vy: 0 };
        }

        if (this.spawnFrom === 'sky') {
            this.angle = Math.PI / 2;
            this.power = 4;
            this.parabolaPoints = [];
            this.parabolaSets = [];
            return { vx: 0, vy: this.power };
        }

        const px = this.player.getCenterX();
        const py = this.player.getCenterY();

        const dx = pos.x - px;
        const dy = pos.y - py;
        const dist = Math.sqrt(dx * dx + dy * dy);

        this.angle = Math.atan2(dy, dx);
        this.power = Math.min(this.stats.maxSpeed,
            Math.max(this.stats.minSpeed, dist / 20));

        const vx = Math.cos(this.angle) * this.power;
        const vy = Math.sin(this.angle) * this.power;

        this.parabolaSets = this.getSpreadOffsets().map(off => {
            const a = this.angle + off;
            const svx = Math.cos(a) * this.power;
            const svy = Math.sin(a) * this.power;

            const pts = [];
            let simX = px;
            let simY = py;
            let simVx = svx;
            let simVy = svy;

            for (let i = 0; i < CONFIG.PARABOLA_STEPS; i++) {
                pts.push({ x: simX, y: simY });
                simX += simVx;
                simY += simVy;
                simVy += this.gravity;

                const traveled = Math.hypot(simX - px, simY - py);
                if (traveled >= this.range) break;
            }
            return pts;
        });

        this.parabolaPoints = this.parabolaSets[0] || [];

        return { vx, vy };
    }

    getSpreadOffsets() {
        const n = this.projectileCount;
        if (n <= 1) return [0];

        const offsets = [];
        for (let i = 0; i < n; i++) {
            if (n % 2 === 1) {
                offsets.push((i - Math.floor(n / 2)) * this.spreadAngle);
            } else {
                offsets.push((i - n / 2 + 0.5) * this.spreadAngle);
            }
        }
        return offsets;
    }

    shoot() {
        if (!this.infinite && (this.cooldown > 0 || this.reloading || this.ammo <= 0)) return;

        const canvas = document.querySelector('canvas');
        this.calculateTrajectory(canvas);

        if (this.heal > 0) {
            if (window.game && window.game.player) {
                window.game.player.heal(this.heal);
            }
        } else {
            const spawn = this.getSpawnPoint();

            if (window.game && window.game.projectiles) {
                for (const off of this.getSpreadOffsets()) {
                    const a = this.angle + off;
                    const vxo = Math.cos(a) * this.power;
                    const vyo = Math.sin(a) * this.power;

                    window.game.projectiles.push(
                        new Projectile(spawn.x, spawn.y, vxo, vyo, this, this.aimPoint.x, this.aimPoint.y)
                    );
                }
            }
        }

        this.cooldown = this.fireRate;

        if (!this.infinite) {
            this.ammo--;
            this.stock--;
            if (this.ammo <= 0 && this.stock > 0) this.startReload();
        }
    }

    startReload() {
        this.reloading = true;
        this.reloadTimer = this.reloadTime;
    }

    getSpawnPoint() {
        if (this.drop) {
            const pad = CONFIG.DROP_SPAWN_PADDING !== undefined ? CONFIG.DROP_SPAWN_PADDING : 40;
            return {
                x: pad + Math.random() * (CONFIG.CANVAS_WIDTH - 2 * pad),
                y: CONFIG.SKY_SPAWN_Y !== undefined ? CONFIG.SKY_SPAWN_Y : -30
            };
        }
        if (this.spawnFrom === 'sky') {
            return {
                x: CONFIG.CANVAS_WIDTH / 2,
                y: CONFIG.SKY_SPAWN_Y !== undefined ? CONFIG.SKY_SPAWN_Y : -30
            };
        }
        return this.getMuzzle();
    }

    getMuzzle() {
        const px = this.player.getCenterX();
        const py = this.player.getCenterY();
        const barrelLen = 25;
        return {
            x: px + Math.cos(this.angle) * barrelLen,
            y: py + Math.sin(this.angle) * barrelLen
        };
    }

    update(terrain) {
        if (this.cooldown > 0) this.cooldown--;

        if (!this.infinite && this.reloading) {
            this.reloadTimer--;
            if (this.reloadTimer <= 0) {
                this.ammo = Math.min(this.maxAmmo, this.stock);
                this.reloading = false;
            }
        }

        if (window.game && window.game.canvas) {
            this.calculateTrajectory(window.game.canvas);
        }
    }

    draw(ctx) {
        if (this.spawnFrom !== 'muzzle' || this.heal > 0) return;

        const px = this.player.getCenterX();
        const py = this.player.getCenterY();
        const muzzle = this.getMuzzle();

        ctx.strokeStyle = '#555';
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.moveTo(px, py);
        ctx.lineTo(muzzle.x, muzzle.y);
        ctx.stroke();

        ctx.fillStyle = this.color;
        ctx.beginPath();
        ctx.arc(muzzle.x, muzzle.y, 6, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = this.color;
        ctx.lineWidth = 2;
        ctx.stroke();
    }

    drawParabola(ctx) {
        const alpha = this.guided ? 0.35 : 0.6;
        const sets = this.parabolaSets.length ? this.parabolaSets : [this.parabolaPoints];

        for (const pts of sets) {
            for (let i = 0; i < pts.length; i++) {
                const p = pts[i];
                const fade = 1 - (i / pts.length);
                const size = 2 + fade * 2;

                ctx.fillStyle = `rgba(255, ${Math.floor(100 + fade * 155)}, 50, ${alpha * fade})`;
                ctx.beginPath();
                ctx.arc(p.x, p.y, size, 0, Math.PI * 2);
                ctx.fill();
            }
        }
    }
}
