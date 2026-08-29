class Game {
    constructor() {
        this.canvas = document.getElementById('gameCanvas');
        this.ctx = this.canvas.getContext('2d');
        this.canvas.width = CONFIG.CANVAS_WIDTH;
        this.canvas.height = CONFIG.CANVAS_HEIGHT;

        this.terrain = new Terrain(CONFIG.CANVAS_WIDTH, CONFIG.CANVAS_HEIGHT);

        const groundY = CONFIG.CANVAS_HEIGHT - CONFIG.TERRAIN_HEIGHT_OFFSET;
        this.player = new Player(
            CONFIG.CANVAS_WIDTH / 2 - CONFIG.PLAYER_WIDTH / 2,
            groundY - CONFIG.PLAYER_HEIGHT
        );

        this.projectiles = [];

        this.restartBtn = document.getElementById('restartBtn');
        this.restartBtn.addEventListener('click', () => this.handleRestart());

        this.bgGradient = this.ctx.createLinearGradient(0, 0, 0, CONFIG.CANVAS_HEIGHT);
        this.bgGradient.addColorStop(0, '#87CEEB');
        this.bgGradient.addColorStop(0.6, '#B0E0E6');
        this.bgGradient.addColorStop(1, '#D4F1F9');
    }

    handleRestart() {
        this.restart();
        this.restartBtn.style.display = 'none';
    }

    update() {
        if (this.player.inventoryOpen) return;

        if (this.player.isAlive()) {
            this.player.update(this.terrain);

            if (this.player.y > CONFIG.CANVAS_HEIGHT + 20) {
                this.player.takeDamage(this.player.hp);
            }
        }

        for (const p of this.projectiles) {
            p.update(this.terrain);
        }
        this.projectiles = this.projectiles.filter(p => p.alive);
    }

    restart() {
        if (this.player) {
            if (this.player.inventory) {
                for (const w of this.player.inventory) w.destroy();
            }
            if (this.player.destroyInput) this.player.destroyInput();
        }

        const terrain = new Terrain(CONFIG.CANVAS_WIDTH, CONFIG.CANVAS_HEIGHT);
        this.terrain = terrain;

        const groundY = CONFIG.CANVAS_HEIGHT - CONFIG.TERRAIN_HEIGHT_OFFSET;
        const player = new Player(
            CONFIG.CANVAS_WIDTH / 2 - CONFIG.PLAYER_WIDTH / 2,
            groundY - CONFIG.PLAYER_HEIGHT
        );
        this.player = player;

        this.projectiles = [];
    }

    applyDirectHit(projectile, target) {
        target.takeDamage(projectile.damage || projectile.weapon.damage);
    }

    applyExplosionDamage(projectile, target) {
        const dx = target.getCenterX() - projectile.x;
        const dy = target.getCenterY() - projectile.y;
        const dist = Math.hypot(dx, dy);

        const radius = projectile.destroyRadius;

        if (dist > radius) return;

        const falloff = 1 - (dist / radius);
        const dmg = Math.max(0, Math.round(projectile.damage * (0.35 + 0.65 * falloff)));

        target.takeDamage(dmg);
    }

    draw() {
        const ctx = this.ctx;

        ctx.fillStyle = this.bgGradient;
        ctx.fillRect(0, 0, CONFIG.CANVAS_WIDTH, CONFIG.CANVAS_HEIGHT);

        this.terrain.draw(ctx);
        this.player.draw(ctx);
        this.player.weapon.drawParabola(ctx);

        for (const p of this.projectiles) {
            p.draw(ctx);
        }

        this.drawHUD(ctx);

        if (this.player.inventoryOpen) {
            this.player.drawInventory(ctx);
        }
    }

    drawHUD(ctx) {
        const weapon = this.player.weapon;

        ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
        ctx.fillRect(10, 10, 300, 100);

        ctx.fillStyle = '#fff';
        ctx.font = '13px monospace';
        ctx.fillText('A/D: Mover  ·  Espacio: Saltar', 20, 30);
        ctx.fillText('Click: Disparar  ·  E: Inventario', 20, 48);

        const ammoState = weapon.infinite ? '∞' :
            (weapon.reloading ? 'RECARGANDO' : `Cargador ${weapon.ammo}/${weapon.maxAmmo} · Stock ${weapon.stock}`);
        ctx.fillStyle = weapon.color;
        ctx.fillText(`${weapon.name}  [${ammoState}]`, 20, 66);
        ctx.fillStyle = '#ffd54f';
        ctx.fillText(`Daño: ${weapon.damage}  Alcance: ${weapon.range}`, 20, 82);
        ctx.fillStyle = '#ffd700';
        ctx.fillText(`Oro: ${this.player.gold} · Proyectiles: ${this.projectiles.length}`, 20, 98);

        const icon = weapon.icon;
        if (icon && icon.complete && icon.naturalWidth > 0) {
            ctx.drawImage(icon, 260, 18, 34, 34);
        }

        this.drawBottomBar(ctx);
        this.player.drawSlots(ctx);

        if (!this.player.isAlive()) {
            this.drawDeathScreen(ctx);
            this.restartBtn.style.display = 'block';
        } else {
            this.restartBtn.style.display = 'none';
        }
    }

    drawDeathScreen(ctx) {
        ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
        ctx.fillRect(0, 0, CONFIG.CANVAS_WIDTH, CONFIG.CANVAS_HEIGHT);

        ctx.fillStyle = '#e53935';
        ctx.font = 'bold 48px monospace';
        ctx.textAlign = 'center';
        ctx.fillText('HAS MUERTO', CONFIG.CANVAS_WIDTH / 2, CONFIG.CANVAS_HEIGHT / 2 - 20);
        ctx.textAlign = 'left';
    }

    drawBottomBar(ctx) {
        const barX = CONFIG.CANVAS_WIDTH / 2 - 115;
        const barY = CONFIG.CANVAS_HEIGHT - 50;
        const barW = 230;
        const barH = 10;

        ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
        ctx.fillRect(barX - 2, barY - 2, barW + 4, barH + 4);

        ctx.fillStyle = '#222';
        ctx.fillRect(barX, barY, barW, barH);

        const hpPct = Math.max(0, this.player.hp / this.player.maxHp);
        const hpW = barW * hpPct;

        const grad = ctx.createLinearGradient(barX, 0, barX + barW, 0);
        if (hpPct > 0.5) {
            grad.addColorStop(0, '#d84315');
            grad.addColorStop(0.5, '#4caf50');
            grad.addColorStop(1, '#8bc34a');
        } else if (hpPct > 0.25) {
            grad.addColorStop(0, '#ff9800');
            grad.addColorStop(1, '#ffeb3b');
        } else {
            grad.addColorStop(0, '#c62828');
            grad.addColorStop(1, '#ff5252');
        }
        ctx.fillStyle = grad;
        ctx.fillRect(barX, barY, hpW, barH);

        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 2;
        ctx.strokeRect(barX, barY, barW, barH);

        ctx.fillStyle = '#fff';
        ctx.font = 'bold 13px monospace';
        ctx.textAlign = 'center';
        ctx.fillText(`${Math.round(this.player.hp)} / ${this.player.maxHp}`,
            barX + barW / 2, barY + barH / 2 + 5);
        ctx.textAlign = 'left';
    }

    loop() {
        this.update();
        this.draw();
        requestAnimationFrame(() => this.loop());
    }

    start() {
        this.loop();
    }
}

window.addEventListener('load', () => {
    window.game = new Game();
    window.game.start();
});
