class Terrain {
    constructor(width, height) {
        this.width = width;
        this.height = height;

        this.offCanvas = document.createElement('canvas');
        this.offCanvas.width = width;
        this.offCanvas.height = height;
        this.offCtx = this.offCanvas.getContext('2d');

        this.generate();
    }

    generate() {
        const ctx = this.offCtx;
        const groundY = this.height - CONFIG.TERRAIN_HEIGHT_OFFSET;

        ctx.fillStyle = CONFIG.TERRAIN_COLOR;
        ctx.fillRect(0, groundY, this.width, this.height - groundY);

        const imageData = ctx.getImageData(0, 0, this.width, this.height);
        const data = imageData.data;

        for (let y = groundY; y < this.height; y++) {
            for (let x = 0; x < this.width; x++) {
                const i = (y * this.width + x) * 4;
                const depth = (y - groundY) / (this.height - groundY);

                const noise = (Math.random() - 0.5) * 30;
                const r = parseInt(CONFIG.TERRAIN_COLOR.substr(1, 2), 16) + noise;
                const g = parseInt(CONFIG.TERRAIN_COLOR.substr(3, 2), 16) + noise;
                const b = parseInt(CONFIG.TERRAIN_COLOR.substr(5, 2), 16) + noise;

                data[i] = Math.max(0, Math.min(255, r + depth * -30));
                data[i + 1] = Math.max(0, Math.min(255, g + depth * -20));
                data[i + 2] = Math.max(0, Math.min(255, b + depth * -15));
                data[i + 3] = 255;
            }
        }

        ctx.putImageData(imageData, 0, 0);
    }

    destroy(x, y, radius) {
        const ctx = this.offCtx;
        ctx.save();
        ctx.globalCompositeOperation = 'destination-out';
        ctx.beginPath();
        ctx.arc(x, y, radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
    }

    isSolid(x, y) {
        if (x < 0 || x >= this.width || y < 0 || y >= this.height) return false;
        const pixel = this.offCtx.getImageData(Math.floor(x), Math.floor(y), 1, 1).data;
        return pixel[3] > 0;
    }

    getGroundY(x) {
        for (let y = 0; y < this.height; y++) {
            if (this.isSolid(x, y)) return y;
        }
        return this.height;
    }

    draw(ctx) {
        ctx.drawImage(this.offCanvas, 0, 0);
    }
}
