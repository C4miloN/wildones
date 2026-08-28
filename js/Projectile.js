class Projectile {
    constructor(x, y, vx, vy, weapon, targetX, targetY) {
        this.x = x;
        this.y = y;
        this.vx = vx;
        this.vy = vy;
        this.startX = x;
        this.startY = y;
        this.weapon = weapon;
        this.radius = weapon ? weapon.projectileRadius : CONFIG.PROJECTILE_RADIUS;
        this.damage = weapon ? weapon.damage : 0;
        this.range = weapon ? weapon.range : Infinity;
        this.destroyRadius = weapon ? weapon.destroyRadius : CONFIG.DESTROY_RADIUS;
        this.gravity = weapon ? weapon.gravity : CONFIG.PROJECTILE_GRAVITY;
        this.bounceCount = weapon ? weapon.bounceCount : 0;
        this.guided = weapon ? weapon.guided : false;
        this.color = weapon ? weapon.color : '#ff6600';
        this.targetX = targetX;
        this.targetY = targetY;

        this.alive = true;
        this.exploded = false;
        this.directHit = false;
        this.lifetime = 0;
        this.trail = [];
        this.trailMaxLength = 15;
    }

    update(terrain) {
        if (!this.alive) return;

        this.lifetime++;

        this.trail.push({ x: this.x, y: this.y });
        if (this.trail.length > this.trailMaxLength) this.trail.shift();

        if (this.guided && this.targetX !== undefined) {
            const dx = this.targetX - this.x;
            const dy = this.targetY - this.y;
            const dist = Math.hypot(dx, dy) || 1;
            const desiredX = dx / dist * 8;
            const desiredY = dy / dist * 8;

            const steer = 0.08;
            this.vx += (desiredX - this.vx) * steer;
            this.vy += (desiredY - this.vy) * steer;
        }

        this.vy += this.gravity;
        this.x += this.vx;
        this.y += this.vy;

        const traveled = Math.hypot(this.x - this.startX, this.y - this.startY);

        const player = window.game ? window.game.player : null;
        if (player && player.isAlive() && this.lifetime > 8 && this.hitsPlayer(player)) {
            this.directHit = true;
            this.damagePlayer(player);
            this.explode(terrain);
            return;
        }

        if (terrain.isSolid(this.x, this.y)) {
            if (this.bounceCount > 0) {
                this.bounce(terrain);
                return;
            }
            this.explode(terrain);
            return;
        }

        if (traveled >= this.range) {
            this.explode(terrain);
            return;
        }

        if (this.x < -50 || this.x > CONFIG.CANVAS_WIDTH + 50 ||
            this.y < -50 || this.y > CONFIG.CANVAS_HEIGHT + 50) {
            this.alive = false;
        }
    }

    bounce(terrain) {
        const r = this.radius;

        const hitLeft = terrain.isSolid(this.x - r * 2, this.y);
        const hitRight = terrain.isSolid(this.x + r * 2, this.y);
        const hitDown = terrain.isSolid(this.x, this.y + r * 2);
        const hitUp = terrain.isSolid(this.x, this.y - r * 2);

        if (hitLeft || hitRight) this.vx *= -0.6;
        if (hitDown || hitUp) this.vy *= -0.5;

        this.bounceCount--;

        this.x += this.vx;
        this.y += this.vy;
        while (terrain.isSolid(this.x, this.y)) {
            this.x -= this.vx;
        }
    }

    hitsPlayer(player) {
        const cx = player.getCenterX();
        const cy = player.getCenterY();
        const r = player.width / 2;
        const halfH = player.height / 2 - r;
        const topY = cy - halfH;
        const botY = cy + halfH;

        const d = this.pointToSegmentDist(this.x, this.y, cx, topY, cx, botY);
        return d <= r + this.radius;
    }

    pointToSegmentDist(px, py, x1, y1, x2, y2) {
        const dx = x2 - x1;
        const dy = y2 - y1;
        const len2 = dx * dx + dy * dy;
        let t = len2 > 0 ? ((px - x1) * dx + (py - y1) * dy) / len2 : 0;
        t = Math.max(0, Math.min(1, t));
        const closestX = x1 + t * dx;
        const closestY = y1 + t * dy;
        return Math.hypot(px - closestX, py - closestY);
    }

    damagePlayer(player) {
        if (window.game) {
            window.game.applyDirectHit(this, player);
        }
    }

    explode(terrain) {
        terrain.destroy(this.x, this.y, this.destroyRadius);
        this.exploded = true;
        this.alive = false;

        if (window.game && window.game.player) {
            window.game.player.gold += Math.round(this.destroyRadius * 0.4);

            if (!this.directHit) {
                window.game.applyExplosionDamage(this, window.game.player);
            }
        }
    }

    draw(ctx) {
        if (!this.alive) return;

        for (let i = 0; i < this.trail.length; i++) {
            const t = this.trail[i];
            const alpha = (i / this.trail.length) * 0.5;
            const size = this.radius * (i / this.trail.length);
            ctx.fillStyle = `rgba(255, 150, 30, ${alpha})`;
            ctx.beginPath();
            ctx.arc(t.x, t.y, size, 0, Math.PI * 2);
            ctx.fill();
        }

        const gradient = ctx.createRadialGradient(
            this.x, this.y, 0,
            this.x, this.y, this.radius
        );
        gradient.addColorStop(0, '#fff');
        gradient.addColorStop(0.4, this.color);
        gradient.addColorStop(1, this.shade(this.color, -80));

        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
        ctx.fill();

        if (this.guided) {
            ctx.strokeStyle = 'rgba(255,255,255,0.6)';
            ctx.lineWidth = 1.5;
            ctx.beginPath();
            ctx.arc(this.x, this.y, this.radius + 3, 0, Math.PI * 2);
            ctx.stroke();
        }
    }

    shade(hex, amt) {
        const num = parseInt(hex.slice(1), 16);
        const r = Math.max(0, Math.min(255, (num >> 16) + amt));
        const g = Math.max(0, Math.min(255, ((num >> 8) & 0xff) + amt));
        const b = Math.max(0, Math.min(255, (num & 0xff) + amt));
        return `rgb(${r},${g},${b})`;
    }
}
