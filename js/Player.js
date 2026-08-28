class Player {
    constructor(x, y) {
        this.x = x;
        this.y = y;
        this.vx = 0;
        this.vy = 0;
        this.width = CONFIG.PLAYER_WIDTH;
        this.height = CONFIG.PLAYER_HEIGHT;
        this.onGround = false;
        this.color = '#2196F3';
        this.borderColor = '#1565C0';

        this.hp = 100;
        this.maxHp = 100;

        this.flashTimer = 0;
        this.flashDuration = 12;
        this.damagePopups = [];

        this.sideSamples = [];
        const r = this.width / 2;
        for (let i = 0; i <= 4; i++) {
            const t = i / 4;
            const py = (r + t * (this.height - 2 * r)) / this.height;
            this.sideSamples.push({ x: 0, y: py });
            this.sideSamples.push({ x: 1, y: py });
        }

        this.inventory = CONFIG.WEAPONS.map(stats => new Weapon(this, stats));
        for (let i = 0; i < this.inventory.length; i++) this.inventory[i].inventoryIndex = i;

        this.slotCount = 4;
        this.slots = [];
        for (let i = 0; i < this.slotCount; i++) {
            this.slots.push(i % this.inventory.length);
        }
        this.activeSlot = 0;
        this.inventoryOpen = false;

        this.gold = CONFIG.START_GOLD;

        this.inventoryLayout = null;

        this.keys = { ' ': false, a: false, s: false, d: false };

        this.bindInput();
    }

    get weapon() { return this.inventory[this.slots[this.activeSlot]]; }

    selectSlot(i) {
        if (i >= 0 && i < this.slotCount) this.activeSlot = i;
    }

    cycleWeapon() {
        this.activeSlot = (this.activeSlot + 1) % this.slotCount;
    }

    bindInput() {
        this.onKeyDown = (e) => {
            if (e.key === 'Tab') {
                e.preventDefault();
                this.cycleWeapon();
                return;
            }
            if (e.key === 'e' || e.key === 'E') {
                this.inventoryOpen = !this.inventoryOpen;
                this.inventoryLayout = null;
                return;
            }
            if (e.key >= '1' && e.key <= '9') {
                const n = parseInt(e.key, 10) - 1;
                if (n < this.slotCount) this.selectSlot(n);
                return;
            }

            const key = e.key.toLowerCase();
            if (key in this.keys) this.keys[key] = true;
        };
        this.onKeyUp = (e) => {
            const key = e.key.toLowerCase();
            if (key in this.keys) this.keys[key] = false;
        };
        this.onShoot = (e) => {
            if (e.button !== 0 || !this.isAlive()) return;
            if (this.inventoryOpen) {
                this.handleInventoryClick(e);
            } else {
                this.weapon.shoot();
            }
        };

        window.addEventListener('keydown', this.onKeyDown);
        window.addEventListener('keyup', this.onKeyUp);
        window.addEventListener('mousedown', this.onShoot);
    }

    getCanvasMouse(e) {
        const canvas = window.game ? window.game.canvas : null;
        if (!canvas) return { x: e.clientX, y: e.clientY };
        const rect = canvas.getBoundingClientRect();
        return {
            x: (e.clientX - rect.left) * (canvas.width / rect.width),
            y: (e.clientY - rect.top) * (canvas.height / rect.height)
        };
    }

    handleInventoryClick(e) {
        const pos = this.getCanvasMouse(e);
        const layout = this.getInventoryLayout();

        for (const row of layout.items) {
            const weapon = this.inventory[row.inventoryIndex];
            if (!weapon.infinite && this.pointInRect(pos.x, pos.y, row.buy)) {
                weapon.buy();
                return;
            }
        }

        for (const slot of layout.slots) {
            if (this.pointInRect(pos.x, pos.y, slot)) {
                this.selectSlot(slot.index);
                return;
            }
        }

        for (const row of layout.items) {
            if (this.pointInRect(pos.x, pos.y, row)) {
                this.slots[this.activeSlot] = row.inventoryIndex;
                return;
            }
        }
    }

    pointInRect(x, y, rect) {
        return x >= rect.x && x <= rect.x + rect.w &&
            y >= rect.y && y <= rect.y + rect.h;
    }

    getInventoryLayout() {
        const cw = CONFIG.CANVAS_WIDTH;
        const ch = CONFIG.CANVAS_HEIGHT;

        const panelW = 520;
        const panelH = 440;
        const panelX = (cw - panelW) / 2;
        const panelY = (ch - panelH) / 2;

        const slots = [];
        const slotW = 110;
        const slotH = 70;
        const gap = 12;
        const slotsStartX = panelX + 15;
        const slotsY = panelY + 55;
        for (let i = 0; i < this.slotCount; i++) {
            slots.push({
                index: i,
                x: slotsStartX + i * (slotW + gap),
                y: slotsY,
                w: slotW,
                h: slotH
            });
        }

        const items = [];
        const itemX = panelX + 15;
        const itemY = panelY + 165;
        const itemW = panelW - 30;
        const itemH = 38;
        const itemGap = 6;
        for (let i = 0; i < this.inventory.length; i++) {
            const rowY = itemY + i * (itemH + itemGap);
            items.push({
                inventoryIndex: i,
                x: itemX,
                y: rowY,
                w: itemW,
                h: itemH,
                buy: {
                    x: itemX + itemW - 118,
                    y: rowY + 4,
                    w: 112,
                    h: itemH - 8
                }
            });
        }

        return { panel: { x: panelX, y: panelY, w: panelW, h: panelH }, slots, items };
    }

    drawInventory(ctx) {
        const layout = this.getInventoryLayout();
        const p = layout.panel;

        ctx.fillStyle = 'rgba(20, 20, 40, 0.92)';
        ctx.fillRect(p.x, p.y, p.w, p.h);
        ctx.strokeStyle = '#888';
        ctx.lineWidth = 2;
        ctx.strokeRect(p.x, p.y, p.w, p.h);

        ctx.fillStyle = '#fff';
        ctx.font = 'bold 24px monospace';
        ctx.textAlign = 'center';
        ctx.fillText('INVENTARIO', CONFIG.CANVAS_WIDTH / 2, p.y + 30);
        ctx.fillStyle = '#ffd700';
        ctx.font = 'bold 16px monospace';
        ctx.fillText(`Oro: ${this.gold}`, CONFIG.CANVAS_WIDTH / 2, p.y + 52);
        //ctx.font = '12px monospace';
        //ctx.fillStyle = '#bbb';
        //ctx.fillText('Clic en un slot (o teclas 1-4) y luego clic en un arma para asignarla', CONFIG.CANVAS_WIDTH / 2, p.y + 72);

        for (const slot of layout.slots) {
            const weapon = this.inventory[this.slots[slot.index]];
            const active = slot.index === this.activeSlot;

            ctx.fillStyle = active ? 'rgba(67,160,71,0.5)' : 'rgba(255,255,255,0.06)';
            ctx.fillRect(slot.x, slot.y, slot.w, slot.h);
            ctx.strokeStyle = active ? '#43a047' : '#666';
            ctx.lineWidth = active ? 3 : 1;
            ctx.strokeRect(slot.x, slot.y, slot.w, slot.h);

            ctx.textAlign = 'center';
            ctx.fillStyle = weapon.color;
            ctx.font = 'bold 15px monospace';
            const shortName = weapon.name.split(' ')[0];
            ctx.fillText(`${slot.index + 1}. ${shortName}`, slot.x + slot.w / 2, slot.y + 24);
            
            ctx.fillStyle = '#ccc';
            ctx.font = '12px monospace';
            //const stockText = weapon.infinite ? '∞' : `${weapon.stock}`;
            //ctx.fillText(stockText, slot.x + slot.w / 2, slot.y + 46);
            ctx.textAlign = 'left';
        }

        for (const row of layout.items) {
            const weapon = this.inventory[row.inventoryIndex];
            const inActiveSlot = this.slots[this.activeSlot] === row.inventoryIndex;

            ctx.fillStyle = inActiveSlot ? 'rgba(67,160,71,0.25)' : 'rgba(255,255,255,0.05)';
            ctx.fillRect(row.x, row.y, row.w, row.h);
            ctx.strokeStyle = inActiveSlot ? '#43a047' : '#555';
            ctx.lineWidth = 1;
            ctx.strokeRect(row.x, row.y, row.w, row.h);

            ctx.fillStyle = weapon.color;
            ctx.font = 'bold 15px monospace';
            ctx.fillText(weapon.name, row.x + 12, row.y + 24);
            
            ctx.fillStyle = '#aaa';
            ctx.font = '12px monospace';
            const stockText = weapon.infinite ? '∞' : `${weapon.stock}`;
            ctx.fillText(stockText, row.x + 190, row.y + 24);

            ctx.fillStyle = '#999';
            //ctx.fillText(`Daño ${weapon.damage} · Alcance ${weapon.range}`, row.x + 320, row.y + 24);
            
            if (!weapon.infinite) {
                const canBuy = this.gold >= weapon.price;
                ctx.fillStyle = canBuy ? 'rgba(67,160,71,0.6)' : 'rgba(90,90,90,0.6)';
                ctx.fillRect(row.buy.x, row.buy.y, row.buy.w, row.buy.h);
                ctx.strokeStyle = canBuy ? '#43a047' : '#777';
                ctx.lineWidth = 1;
                ctx.strokeRect(row.buy.x, row.buy.y, row.buy.w, row.buy.h);

                ctx.textAlign = 'center';
                ctx.fillStyle = canBuy ? '#fff' : '#bbb';
                ctx.font = 'bold 12px monospace';
                //ctx.fillText(`Comprar +${weapon.packSize}`, row.buy.x + row.buy.w / 2, row.buy.y + 14);
                ctx.fillText(`${weapon.packSize}`, row.buy.x + row.buy.w / 2, row.buy.y + 14);
                ctx.fillStyle = '#ffd700';
                ctx.fillText(`${weapon.price} Oro`, row.buy.x + row.buy.w / 2, row.buy.y + 26);
                ctx.textAlign = 'left';
            }

            ctx.fillStyle = '#fff';
            ctx.font = '12px monospace';
            ctx.fillText('Pulsa E para cerrar', CONFIG.CANVAS_WIDTH / 2, p.y + p.h - 16);
        }
    }

    drawSlots(ctx) {
        const x = CONFIG.CANVAS_WIDTH / 2 - 115;
        const y = CONFIG.CANVAS_HEIGHT - 36;
        const w = 56;
        const h = 34;
        const gap = 2;

        for (let i = 0; i < this.slotCount; i++) {
            const weapon = this.inventory[this.slots[i]];
            const active = i === this.activeSlot;

            ctx.fillStyle = active ? 'rgba(67,160,71,0.55)' : 'rgba(0,0,0,0.6)';
            ctx.fillRect(x + i * (w + gap), y, w, h);
            ctx.strokeStyle = active ? '#43a047' : '#777';
            ctx.lineWidth = active ? 2.5 : 1;
            ctx.strokeRect(x + i * (w + gap), y, w, h);

            ctx.fillStyle = weapon.color;
            ctx.font = 'bold 10px monospace';
            ctx.textAlign = 'center';
            ctx.fillText(`${i + 1}`, x + i * (w + gap) + 11, y + 12);
            ctx.fillStyle = '#eee';
            ctx.fillText(weapon.name.split(' ')[0], x + i * (w + gap) + w / 2 + 4, y + 21);

            ctx.fillStyle = '#ccc';
            ctx.font = '10px monospace';
            ctx.fillText(weapon.infinite ? '∞' : `${weapon.stock}`, x + i * (w + gap) + w / 2 + 4, y + 30);
            ctx.textAlign = 'left';
        }
    }

    destroyInput() {
        window.removeEventListener('keydown', this.onKeyDown);
        window.removeEventListener('keyup', this.onKeyUp);
        window.removeEventListener('mousedown', this.onShoot);
    }

    update(terrain) {
        if (this.inventoryOpen) return;

        if (this.keys.a) this.vx = -CONFIG.PLAYER_SPEED;
        else if (this.keys.d) this.vx = CONFIG.PLAYER_SPEED;
        else this.vx *= CONFIG.FRICTION;

        if (this.keys[' '] && this.onGround) {
            this.vy = CONFIG.PLAYER_JUMP;
            this.onGround = false;
        }

        this.vy += CONFIG.GRAVITY;

        const nextX = this.x + this.vx;
        const nextY = this.y + this.vy;

        this.onGround = false;

        if (this.checkCollision(nextX, this.y, terrain)) {
            this.vx = 0;
        } else {
            this.x = nextX;
        }

        if (this.checkCollision(this.x, nextY, terrain)) {
            if (this.vy > 0 && this.groundedCheck(this.x, nextY, terrain)) {
                this.onGround = true;
            }
            this.vy = 0;
        } else {
            this.y = nextY;
        }

        this.x = Math.max(0, Math.min(CONFIG.CANVAS_WIDTH - this.width, this.x));

        this.updateDamagePopups();
        this.weapon.update(terrain);
    }

    radius() { return this.width / 2; }

    checkCollision(x, y, terrain) {
        const r = this.radius();
        const cx = x + this.width / 2;
        const topY = y + r;
        const botY = y + this.height - r;

        for (const p of this.sideSamples) {
            const px = x + p.x * this.width;
            const py = y + p.y * this.height;
            if (terrain.isSolid(px, py)) return true;
        }

        for (let i = 0; i <= 6; i++) {
            const t = i / 6;
            const a = Math.PI * (1 - t);

            const upx = cx + Math.cos(a) * r * 0.9;
            const upy = topY + Math.sin(a) * r * 0.9;
            if (terrain.isSolid(upx, upy)) return true;

            const botA = Math.PI * t;
            const bpx = cx + Math.cos(botA) * r * 0.9;
            const bpy = botY + Math.sin(botA) * r * 0.9;
            if (terrain.isSolid(bpx, bpy)) return true;
        }

        return false;
    }

    groundedCheck(x, y, terrain) {
        const r = this.radius();
        const cx = x + this.width / 2;
        const botY = y + this.height - r;

        for (let i = 0; i <= 3; i++) {
            const t = i / 3;
            const a = Math.PI * (0.5 + t * 0.5);
            const px = cx + Math.cos(a) * r * 0.9;
            const py = botY + Math.sin(a) * r * 0.9;
            if (terrain.isSolid(px, py + 2)) return true;
        }

        const midX = x + this.width * 0.5;
        if (terrain.isSolid(midX, this.y + this.height)) return true;

        return false;
    }

    getCenterX() { return this.x + this.width / 2; }
    getCenterY() { return this.y + this.height / 2; }

    takeDamage(amount) {
        this.hp = Math.max(0, this.hp - amount);
        if (this.hp <= 0) {
            this.hp = 0;
        }

        if (amount > 0) {
            this.flashTimer = this.flashDuration;
            this.damagePopups.push({
                x: this.getCenterX(),
                y: this.y - 10,
                value: Math.round(amount),
                life: 60,
                maxLife: 60
            });
        }

        return this.hp;
    }

    updateDamagePopups() {
        for (const popup of this.damagePopups) {
            popup.y -= 1.2;
            popup.life--;
        }
        this.damagePopups = this.damagePopups.filter(p => p.life > 0);
    }

    isAlive() {
        return this.hp > 0;
    }

    draw(ctx) {
        const r = this.radius();
        const cx = this.x + this.width / 2;
        const topY = this.y + r;
        const botY = this.y + this.height - r;

        this.traceCapsule(ctx, r, cx, topY, botY);

        const flashing = this.flashTimer > 0;
        const flashOn = flashing && Math.floor(this.flashTimer / 3) % 2 === 0;

        if (flashOn) {
            ctx.fillStyle = '#ff5252';
            ctx.strokeStyle = '#b71c1c';
        } else {
            ctx.fillStyle = this.color;
            ctx.strokeStyle = this.borderColor;
        }
        ctx.fill();
        ctx.lineWidth = 2;
        ctx.stroke();

        if (this.flashTimer > 0) this.flashTimer--;

        ctx.fillStyle = '#fff';
        ctx.beginPath();
        ctx.arc(cx - 6, topY + 4, 4, 0, Math.PI * 2);
        ctx.arc(cx + 6, topY + 4, 4, 0, Math.PI * 2);
        ctx.fill();

        this.drawDamagePopups(ctx);

        this.weapon.draw(ctx);
    }

    drawDamagePopups(ctx) {
        for (const popup of this.damagePopups) {
            const alpha = popup.life / popup.maxLife;
            const size = 14 + (1 - alpha) * 6;

            ctx.font = `bold ${size}px monospace`;
            ctx.textAlign = 'center';
            ctx.lineWidth = 3;
            ctx.strokeStyle = `rgba(0, 0, 0, ${alpha})`;
            ctx.fillStyle = `rgba(255, 40, 40, ${alpha})`;
            ctx.strokeText(`-${popup.value}`, popup.x, popup.y);
            ctx.fillText(`-${popup.value}`, popup.x, popup.y);
            ctx.textAlign = 'left';
        }
    }

    traceCapsule(ctx, r, cx, topY, botY) {
        ctx.beginPath();
        ctx.moveTo(this.x, topY);
        ctx.lineTo(this.x, botY);
        ctx.arc(cx, botY, r, Math.PI, 0, false);
        ctx.lineTo(this.x + this.width, topY);
        ctx.arc(cx, topY, r, 0, Math.PI, false);
        ctx.closePath();
    }
}
