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
        this.pickupPopups = [];

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
        this.inventoryScroll = 0;

        this.mouse = { x: 0, y: 0 };

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
                this.inventoryScroll = 0;
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

        this.onMouseMoveUI = (e) => {
            this.mouse = this.getCanvasMouse(e);
        };

        this.onWheel = (e) => {
            if (!this.inventoryOpen) return;
            e.preventDefault();
            const layout = this.getInventoryLayout();
            this.inventoryScroll = Math.max(0, Math.min(
                layout.maxScroll,
                this.inventoryScroll + (e.deltaY > 0 ? 40 : -40)
            ));
        };

        window.addEventListener('keydown', this.onKeyDown);
        window.addEventListener('keyup', this.onKeyUp);
        window.addEventListener('mousedown', this.onShoot);
        window.addEventListener('mousemove', this.onMouseMoveUI);
        window.addEventListener('wheel', this.onWheel);
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

        if (this.pointInRect(pos.x, pos.y, layout.viewport)) {
            for (const row of layout.items) {
                const weapon = this.inventory[row.inventoryIndex];
                if (!weapon.infinite &&
                    this.pointInRect(pos.x, pos.y, {
                        x: row.buy.x,
                        y: row.buy.y - this.inventoryScroll,
                        w: row.buy.w,
                        h: row.buy.h
                    })) {
                    weapon.buy();
                    return;
                }
            }
        }

        for (const slot of layout.slots) {
            if (this.pointInRect(pos.x, pos.y, slot)) {
                this.selectSlot(slot.index);
                return;
            }
        }

        if (this.pointInRect(pos.x, pos.y, layout.viewport)) {
            for (const row of layout.items) {
                if (this.pointInRect(pos.x, pos.y, {
                    x: row.x,
                    y: row.y - this.inventoryScroll,
                    w: row.w,
                    h: row.h
                })) {
                    this.slots[this.activeSlot] = row.inventoryIndex;
                    return;
                }
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

        const panelW = 760;
        const panelH = 500;
        const panelX = (cw - panelW) / 2;
        const panelY = (ch - panelH) / 2;

        const slots = [];
        const slotW = 130;
        const slotH = 72;
        const gap = 14;
        const slotsStartX = panelX + 20;
        const slotsY = panelY + 50;
        for (let i = 0; i < this.slotCount; i++) {
            slots.push({
                index: i,
                x: slotsStartX + i * (slotW + gap),
                y: slotsY,
                w: slotW,
                h: slotH
            });
        }

        const cols = 5;
        const cellGap = 14;
        const buyW = 92;
        const buyH = 22;
        const cellW = 122;
        const cellH = 88;
        const gridW = cols * cellW + (cols - 1) * cellGap;
        const gridX = panelX + (panelW - gridW) / 2;
        const gridY = panelY + 142;

        const viewport = { x: panelX + 12, y: gridY - 8, w: panelW - 24, h: 240 };

        const rows = Math.ceil(this.inventory.length / cols);
        const contentH = rows * (cellH + cellGap) - cellGap;
        const maxScroll = Math.max(0, contentH - viewport.h);

        const items = [];
        for (let i = 0; i < this.inventory.length; i++) {
            const col = i % cols;
            const row = Math.floor(i / cols);
            const cx = gridX + col * (cellW + cellGap);
            const cy = gridY + row * (cellH + cellGap);

            items.push({
                inventoryIndex: i,
                x: cx,
                y: cy,
                w: cellW,
                h: cellH,
                buy: {
                    x: cx + (cellW - buyW) / 2,
                    y: cy + cellH - buyH - 4,
                    w: buyW,
                    h: buyH
                }
            });
        }

        return { panel: { x: panelX, y: panelY, w: panelW, h: panelH }, slots, viewport, maxScroll, items };
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
        ctx.fillStyle = '#bbb';
        ctx.font = '11px monospace';
        ctx.fillText('Clic en arma para asignar al slot activo  ·  Pulsa 1-4 para cambiar slot  ·  Rueda para desplazar  ·  E para cerrar', CONFIG.CANVAS_WIDTH / 2, p.y + p.h - 30);

        for (const slot of layout.slots) {
            const weapon = this.inventory[this.slots[slot.index]];
            const active = slot.index === this.activeSlot;

            ctx.fillStyle = active ? 'rgba(67,160,71,0.5)' : 'rgba(255,255,255,0.06)';
            ctx.fillRect(slot.x, slot.y, slot.w, slot.h);
            ctx.strokeStyle = active ? '#43a047' : '#666';
            ctx.lineWidth = active ? 3 : 1;
            ctx.strokeRect(slot.x, slot.y, slot.w, slot.h);

            this.drawIcon(ctx, weapon, slot.x + slot.w / 2, slot.y + slot.h / 2 - 2, 48);

            ctx.textAlign = 'center';
            ctx.fillStyle = '#ccc';
            ctx.font = '12px monospace';
            ctx.fillText(weapon.infinite ? '∞' : `${weapon.stock}`, slot.x + slot.w / 2, slot.y + slot.h - 6);
            ctx.textAlign = 'left';
        }

        let hoveredWeapon = null;
        let hoveredRect = null;

        ctx.save();
        ctx.beginPath();
        ctx.rect(layout.viewport.x, layout.viewport.y, layout.viewport.w, layout.viewport.h);
        ctx.clip();
        ctx.translate(0, -this.inventoryScroll);

        for (const cell of layout.items) {
            const weapon = this.inventory[cell.inventoryIndex];
            const inActiveSlot = this.slots[this.activeSlot] === cell.inventoryIndex;
            const isHover = this.pointInRect(this.mouse.x, this.mouse.y + this.inventoryScroll, cell);

            ctx.fillStyle = inActiveSlot ? 'rgba(67,160,71,0.2)' :
                (isHover ? 'rgba(255,255,255,0.1)' : 'rgba(255,255,255,0.04)');
            ctx.fillRect(cell.x, cell.y, cell.w, cell.h);
            ctx.strokeStyle = inActiveSlot ? '#43a047' : (isHover ? '#aaa' : '#444');
            ctx.lineWidth = inActiveSlot ? 2 : 1;
            ctx.strokeRect(cell.x, cell.y, cell.w, cell.h);

            this.drawIcon(ctx, weapon, cell.x + cell.w / 2, cell.y + 26, 44);

            ctx.textAlign = 'center';
            ctx.fillStyle = weapon.color;
            ctx.font = 'bold 12px monospace';
            ctx.fillText(weapon.name, cell.x + cell.w / 2, cell.y + 62);

            if (!weapon.infinite) {
                const canBuy = this.gold >= weapon.price;
                const hoverBuy = isHover && this.pointInRect(this.mouse.x, this.mouse.y + this.inventoryScroll, cell.buy);

                ctx.fillStyle = canBuy ? (hoverBuy ? 'rgba(80,180,90,0.8)' : 'rgba(67,160,71,0.6)') :
                    'rgba(90,90,90,0.5)';
                ctx.fillRect(cell.buy.x, cell.buy.y, cell.buy.w, cell.buy.h);
                ctx.strokeStyle = canBuy ? '#43a047' : '#666';
                ctx.lineWidth = 1;
                ctx.strokeRect(cell.buy.x, cell.buy.y, cell.buy.w, cell.buy.h);

                ctx.fillStyle = canBuy ? '#fff' : '#999';
                ctx.font = 'bold 10px monospace';
                ctx.fillText(`+${weapon.packSize} (${weapon.price} Oro)`, cell.buy.x + cell.buy.w / 2, cell.buy.y + 14);
            } else {
                ctx.fillStyle = '#ffd700';
                ctx.font = '10px monospace';
                ctx.fillText('Munición infinita', cell.x + cell.w / 2, cell.y + cell.h - 14);
            }

            ctx.textAlign = 'left';

            if (isHover) {
                hoveredWeapon = weapon;
                hoveredRect = { x: cell.x, y: cell.y - this.inventoryScroll, w: cell.w, h: cell.h };
            }
        }

        ctx.restore();

        if (layout.maxScroll > 0) {
            const trackW = 6;
            const trackX = layout.viewport.x + layout.viewport.w - trackW - 4;
            const trackY = layout.viewport.y + 4;
            const trackH = layout.viewport.h - 8;
            const thumbH = Math.max(20, trackH * (layout.viewport.h / (layout.viewport.h + layout.maxScroll)));
            const thumbY = trackY + (trackH - thumbH) * (this.inventoryScroll / layout.maxScroll);

            ctx.fillStyle = 'rgba(255,255,255,0.15)';
            ctx.fillRect(trackX, trackY, trackW, trackH);
            ctx.fillStyle = '#999';
            ctx.fillRect(trackX, thumbY, trackW, thumbH);
        }

        ctx.fillStyle = '#fff';
        ctx.font = '12px monospace';
        ctx.textAlign = 'center';
        ctx.fillText('Pulsa E para cerrar', CONFIG.CANVAS_WIDTH / 2, p.y + p.h - 12);

        if (hoveredWeapon && hoveredRect) {
            const lines = [
                hoveredWeapon.name,
                `Daño: ${hoveredWeapon.damage}  ·  Alcance: ${hoveredWeapon.range}`,
                `Cadencia: ${hoveredWeapon.fireRate}/s  ·  Recarga: ${(hoveredWeapon.reloadTime / 60).toFixed(1)}s`
            ];
            const tw = 230;
            const lh = 16;
            const th = 8 + lines.length * lh;
            const tx = hoveredRect.x + hoveredRect.w / 2 - tw / 2;
            const ty = hoveredRect.y + hoveredRect.h + 8;

            ctx.fillStyle = 'rgba(0,0,0,0.85)';
            ctx.fillRect(tx, ty, tw, th);
            ctx.strokeStyle = '#888';
            ctx.lineWidth = 1;
            ctx.strokeRect(tx, ty, tw, th);
            ctx.textAlign = 'center';
            ctx.fillStyle = hoveredWeapon.color;
            ctx.font = 'bold 13px monospace';
            ctx.fillText(lines[0], tx + tw / 2, ty + 16);
            ctx.fillStyle = '#fff';
            ctx.font = '11px monospace';
            for (let i = 1; i < lines.length; i++) {
                ctx.fillText(lines[i], tx + tw / 2, ty + 16 + i * lh);
            }
            ctx.textAlign = 'left';
        }
    }

    drawSlots(ctx) {
        const x = CONFIG.CANVAS_WIDTH / 2 - 115;
        const y = CONFIG.CANVAS_HEIGHT - 36;
        const w = 56;
        const h = 34;
        const gap = 2;

        let hoveredWeapon = null;
        let hoverBox = null;

        for (let i = 0; i < this.slotCount; i++) {
            const weapon = this.inventory[this.slots[i]];
            const active = i === this.activeSlot;
            const bx = x + i * (w + gap);

            ctx.fillStyle = active ? 'rgba(67,160,71,0.55)' : 'rgba(0,0,0,0.6)';
            ctx.fillRect(bx, y, w, h);
            ctx.strokeStyle = active ? '#43a047' : '#777';
            ctx.lineWidth = active ? 2.5 : 1;
            ctx.strokeRect(bx, y, w, h);

            ctx.fillStyle = '#fff';
            ctx.font = 'bold 10px monospace';
            ctx.textAlign = 'left';
            ctx.fillText(`${i + 1}`, bx + 3, y + 11);

            this.drawIcon(ctx, weapon, bx + w / 2, y + h / 2, 32);

            if (weapon.infinite) {
                ctx.fillStyle = '#ffd700';
            } else if (weapon.stock <= 0) {
                ctx.fillStyle = '#ff5252';
            } else {
                ctx.fillStyle = '#ccc';
            }
            ctx.font = 'bold 10px monospace';
            ctx.textAlign = 'right';
            ctx.fillText(weapon.infinite ? '∞' : `${weapon.stock}`, bx + w - 3, y + h - 3);
            ctx.textAlign = 'left';

            if (this.pointInRect(this.mouse.x, this.mouse.y, { x: bx, y, w, h })) {
                hoveredWeapon = weapon;
                hoverBox = { x: bx, y, w, h };
            }
        }

        if (hoveredWeapon) this.drawSlotTooltip(ctx, hoveredWeapon, hoverBox);
    }

    drawSlotTooltip(ctx, weapon, box) {
        const text = `${weapon.name}  ·  Daño: ${weapon.damage}`;
        const tw = 170;
        const th = 22;
        let tx = box.x + box.w / 2 - tw / 2;
        let ty = box.y - th - 6;
        if (ty < 0) ty = box.y + box.h + 6;

        ctx.fillStyle = 'rgba(0,0,0,0.85)';
        ctx.fillRect(tx, ty, tw, th);
        ctx.strokeStyle = '#888';
        ctx.lineWidth = 1;
        ctx.strokeRect(tx, ty, tw, th);

        ctx.fillStyle = weapon.color;
        ctx.font = 'bold 12px monospace';
        ctx.fillText(text, tx + tw / 2, ty + 16);
    }

    drawIcon(ctx, weapon, cx, cy, size) {
        const img = weapon.icon;
        if (img && img.complete && img.naturalWidth > 0) {
            ctx.save();
            ctx.globalAlpha = weapon.stock <= 0 && !weapon.infinite ? 0.35 : 1;
            ctx.drawImage(img, cx - size / 2, cy - size / 2, size, size);
            ctx.restore();
        }
    }

    destroyInput() {
        window.removeEventListener('keydown', this.onKeyDown);
        window.removeEventListener('keyup', this.onKeyUp);
        window.removeEventListener('mousedown', this.onShoot);
        window.removeEventListener('mousemove', this.onMouseMoveUI);
        window.removeEventListener('wheel', this.onWheel);
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
        this.updatePickupPopups();
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

    heal(amount) {
        if (!this.isAlive() || amount <= 0) return this.hp;
        this.hp = Math.min(this.maxHp, this.hp + amount);
        this.addPickupPopup(`${Math.round(amount)} HP`);
        return this.hp;
    }

    updateDamagePopups() {
        for (const popup of this.damagePopups) {
            popup.y -= 1.2;
            popup.life--;
        }
        this.damagePopups = this.damagePopups.filter(p => p.life > 0);
    }

    addPickupPopup(text) {
        this.pickupPopups.push({
            x: this.getCenterX(),
            y: this.y - 20,
            value: text,
            life: 80,
            maxLife: 80
        });
    }

    updatePickupPopups() {
        for (const popup of this.pickupPopups) {
            popup.y -= 1;
            popup.life--;
        }
        this.pickupPopups = this.pickupPopups.filter(p => p.life > 0);
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
        this.drawPickupPopups(ctx);

        this.weapon.draw(ctx);
    }

    drawPickupPopups(ctx) {
        for (const popup of this.pickupPopups) {
            const alpha = popup.life / popup.maxLife;

            ctx.font = 'bold 12px monospace';
            ctx.textAlign = 'center';
            ctx.lineWidth = 3;
            ctx.strokeStyle = `rgba(0, 0, 0, ${alpha})`;
            ctx.fillStyle = `rgba(76, 175, 80, ${alpha})`;
            ctx.strokeText(`+${popup.value}`, popup.x, popup.y);
            ctx.fillText(`+${popup.value}`, popup.x, popup.y);
            ctx.textAlign = 'left';
        }
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
