class Renderer {
    constructor(canvas, camera, gameData, selectedEntity, dataManager) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.camera = camera;
        this.gameData = gameData;
        this.selectedEntity = selectedEntity;
        this.dataManager = dataManager;
        this.showGrid = false;
        this.stars = [];
        this.generateStars();
    }

    generateStars() {
        this.stars = [];
        for (let i = 0; i < 200; i++) {
            this.stars.push({
                x: Math.random() * 40000 - 20000,
                y: Math.random() * 40000 - 20000,
                size: Math.random() * 2 + 0.5,
                brightness: Math.random() * 0.8 + 0.2
            });
        }
    }

    toggleGrid() {
        this.showGrid = !this.showGrid;
    }

    render() {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

        // Stars disabled for now
        // this.renderStars();

        if (this.showGrid) {
            this.renderGrid();
        }

        if (!this.gameData) {
            this.ctx.fillStyle = '#ffffff';
            this.ctx.font = '20px Arial';
            this.ctx.textAlign = 'center';
            this.ctx.fillText('Loading game data...', this.canvas.width / 2, this.canvas.height / 2);
            return;
        }

        
        this.renderBoundary();
        this.renderWormholes();
        this.renderAsteroids();
        this.renderShips();

        if (this.selectedEntity) {
            this.renderSelection();
            this.renderSelectedWormholePath();
        }
    }

    renderStars() {
        this.ctx.fillStyle = '#ffffff';
        this.stars.forEach(star => {
            const pos = this.camera.worldToScreen(star.x, star.y);
            if (pos.x > -10 && pos.x < this.canvas.width + 10 &&
                pos.y > -10 && pos.y < this.canvas.height + 10) {
                this.ctx.globalAlpha = star.brightness;
                this.ctx.beginPath();
                this.ctx.arc(pos.x, pos.y, star.size, 0, Math.PI * 2);
                this.ctx.fill();
            }
        });
        this.ctx.globalAlpha = 1;
    }

    renderGrid() {
        const gridSize = 1000;
        const startX = Math.floor((this.camera.x - this.canvas.width / 2 / this.camera.zoom) / gridSize) * gridSize;
        const endX = Math.ceil((this.camera.x + this.canvas.width / 2 / this.camera.zoom) / gridSize) * gridSize;
        const startY = Math.floor((this.camera.y - this.canvas.height / 2 / this.camera.zoom) / gridSize) * gridSize;
        const endY = Math.ceil((this.camera.y + this.canvas.height / 2 / this.camera.zoom) / gridSize) * gridSize;

        this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
        this.ctx.lineWidth = 1;

        for (let x = startX; x <= endX; x += gridSize) {
            const pos = this.camera.worldToScreen(x, 0);
            this.ctx.beginPath();
            this.ctx.moveTo(pos.x, 0);
            this.ctx.lineTo(pos.x, this.canvas.height);
            this.ctx.stroke();
        }

        for (let y = startY; y <= endY; y += gridSize) {
            const pos = this.camera.worldToScreen(0, y);
            this.ctx.beginPath();
            this.ctx.moveTo(0, pos.y);
            this.ctx.lineTo(this.canvas.width, pos.y);
            this.ctx.stroke();
        }
    }

    renderBoundary() {
        const center = this.camera.worldToScreen(0, 0);
        const radius = this.gameData.radius * this.camera.zoom;

        this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
        this.ctx.lineWidth = 2;
        this.ctx.beginPath();
        this.ctx.rect(center.x - radius, center.y - radius, radius * 2, radius * 2);
        this.ctx.stroke();
    }

    renderWormholes() {
        this.gameData.wormholes.forEach(wormhole => {
            if (!wormhole || wormhole.position === undefined || wormhole.id === undefined) {
                return;
            }

            const pos = this.camera.worldToScreen(wormhole.position.x, wormhole.position.y);

            const connected = this.gameData.wormholes.find(w =>
                w.id === wormhole.id && w.target_id === wormhole.target_id &&
                (w.position.x !== wormhole.position.x || w.position.y !== wormhole.position.y)
            );

            if (connected) {
                const connectedPos = this.camera.worldToScreen(connected.position.x, connected.position.y);
                this.ctx.strokeStyle = 'rgba(255, 107, 74, 0.5)';
                this.ctx.lineWidth = 2;
                this.ctx.setLineDash([5, 5]);
                this.ctx.beginPath();
                this.ctx.moveTo(pos.x, pos.y);
                this.ctx.lineTo(connectedPos.x, connectedPos.y);
                this.ctx.stroke();
                this.ctx.setLineDash([]);
            }

            const radius = 20 * this.camera.zoom;
            this.ctx.fillStyle = '#ff6b4a';
            this.ctx.beginPath();
            this.ctx.arc(pos.x, pos.y, radius, 0, Math.PI * 2);
            this.ctx.fill();

            this.ctx.fillStyle = '#ffaa4a';
            this.ctx.beginPath();
            this.ctx.arc(pos.x, pos.y, radius * 0.6, 0, Math.PI * 2);
            this.ctx.fill();

            this.ctx.fillStyle = '#ffffff';
            this.ctx.font = `${12 * this.camera.zoom}px Arial`;
            this.ctx.textAlign = 'center';
            this.ctx.fillText(wormhole.id.toString(), pos.x, pos.y + 4 * this.camera.zoom);
        });
    }

    renderAsteroids() {
        this.gameData.asteroids.forEach(asteroid => {
            if (!asteroid || asteroid.position === undefined || asteroid.size === undefined) {
                return;
            }

            const pos = this.camera.worldToScreen(asteroid.position.x, asteroid.position.y);
            const radius = asteroid.size * this.camera.zoom;

            this.ctx.fillStyle = asteroid.type === 0 ? '#888888' : '#aaaa88';
            this.ctx.beginPath();
            this.ctx.arc(pos.x, pos.y, radius, 0, Math.PI * 2);
            this.ctx.fill();

            this.ctx.fillStyle = asteroid.type === 0 ? '#666666' : '#888866';
            this.ctx.beginPath();
            this.ctx.arc(pos.x - radius * 0.3, pos.y - radius * 0.3, radius * 0.3, 0, Math.PI * 2);
            this.ctx.fill();
        });
    }

    renderShips() {
        this.gameData.ships.forEach(ship => {
            // Skip invalid ship data to prevent rendering errors
            if (!ship || ship.position === undefined || ship.health === undefined) {
                console.warn("Skipping invalid ship data:", ship);
                return;
            }

            const pos = this.camera.worldToScreen(ship.position.x, ship.position.y);
            const size = 50 * this.camera.zoom;

            // Check if ship is destroyed - be more defensive about undefined values
            const isDestroyed = (ship.health === 0) || (ship.is_destroyed === true) || (ship.health <= 0);

            // Check if this is a mothership (type 0) - motherships should never show destroyed status or health bars
            const isMothership = ship.type === 0;

            // Safely get player color with fallback
            let playerColor = '#ffffff';
            try {
                playerColor = this.dataManager.getPlayerColor(ship.player);
            } catch (error) {
                console.warn("Error getting player color for ship:", ship, error);
            }

            // Set color and opacity based on ship status, but motherships always have full opacity
            if (isMothership) {
                this.ctx.fillStyle = playerColor;
                this.ctx.globalAlpha = 1.0; // Motherships always full opacity
            } else if (isDestroyed) {
                this.ctx.fillStyle = this.getDestroyedColor(playerColor);
                this.ctx.globalAlpha = 0.4; // Reduced opacity for destroyed ships
            } else {
                this.ctx.fillStyle = playerColor;
                this.ctx.globalAlpha = 1.0;
            }

            // Calculate ship angle based on vector or default to pointing right
            let angle = 0;
            if (ship.vector && (ship.vector.x !== 0 || ship.vector.y !== 0)) {
                try {
                    angle = Math.atan2(ship.vector.y, ship.vector.x);
                } catch (error) {
                    console.warn("Error calculating ship angle:", ship.vector, error);
                    angle = 0;
                }
            }

            // Draw ship based on type
            this.ctx.save();
            this.ctx.translate(pos.x, pos.y);
            this.ctx.rotate(angle);

            // Safely draw ship type with fallback
            try {
                this.drawShipByType(ship.type || 0, size);
            } catch (error) {
                console.warn("Error drawing ship type:", ship.type, error);
                // Draw a basic triangle as fallback
                this.ctx.beginPath();
                this.ctx.moveTo(size, 0);
                this.ctx.lineTo(-size, -size/2);
                this.ctx.lineTo(-size, size/2);
                this.ctx.closePath();
                this.ctx.fill();
            }

            // Add X mark for destroyed ships (but not motherships)
            if (isDestroyed && !isMothership) {
                this.drawDestroyedMark(size);
            }

            // Reset globalAlpha before drawing health bar to keep it fully visible
            this.ctx.globalAlpha = 1.0;

            // Draw health bar or destroyed label (but not for motherships)
            if (!isMothership) {
                if (ship.health > 0 && !isDestroyed) {
                    const healthPercent = ship.health / 100;
                    this.ctx.fillStyle = healthPercent > 0.5 ? '#4aff4a' : healthPercent > 0.25 ? '#ffff4a' : '#ff4a4a';
                    // Position healthbar above the ship in screen space, not world space
                    this.ctx.fillRect(-size, -size - 10 * this.camera.zoom, size * 2 * healthPercent, 4 * this.camera.zoom);
                } else if (isDestroyed) {
                    this.drawDestroyedLabel(size);
                }
            }

            this.ctx.restore();

            // Draw player number
            this.ctx.fillStyle = isDestroyed ? '#aaaaaa' : '#ffffff';
            this.ctx.font = `${12 * this.camera.zoom}px Arial`;
            this.ctx.textAlign = 'center';
            this.ctx.fillText(`P${ship.player}`, pos.x, pos.y + 4 * this.camera.zoom);

            // Reset globalAlpha
            this.ctx.globalAlpha = 1.0;
        });
    }

    drawShipByType(shipType, size) {
        switch (shipType) {
            case 0: // MotherShip
                this.drawMotherShip(size);
                break;
            case 1: // SuckerShip
                this.drawSuckerShip(size);
                break;
            case 2: // DrillShip
                this.drawDrillShip(size);
                break;
            case 3: // TankerShip
                this.drawTankerShip(size);
                break;
            case 4: // TruckShip
                this.drawTruckShip(size);
                break;
            case 5: // BattleShip
                this.drawBattleShip(size);
                break;
            default:
                // Default triangle for unknown types
                this.drawDefaultShip(size);
        }
    }

    drawMotherShip(size) {
        // Large hexagon shape for MotherShip
        size *= 2
        this.ctx.beginPath();
        for (let i = 0; i < 6; i++) {
            const angle = (Math.PI / 3) * i;
            const x = size * Math.cos(angle);
            const y = size * Math.sin(angle);
            if (i === 0) {
                this.ctx.moveTo(x, y);
            } else {
                this.ctx.lineTo(x, y);
            }
        }
        this.ctx.closePath();
        this.ctx.fill();

        // Crown/halo indicator
        this.ctx.strokeStyle = '#ffdd00';
        this.ctx.lineWidth = 3;
        this.ctx.beginPath();
        this.ctx.arc(0, 0, size * 1.2, 0, Math.PI * 2);
        this.ctx.stroke();
    }

    drawSuckerShip(size) {
        // Basic triangle
        this.ctx.beginPath();
        this.ctx.moveTo(size, 0);
        this.ctx.lineTo(-size * 0.7, -size * 0.7);
        this.ctx.lineTo(-size * 0.7, size * 0.7);
        this.ctx.closePath();
        this.ctx.fill();

        // Circular suction indicator
        this.ctx.strokeStyle = '#00aaff';
        this.ctx.lineWidth = 2;
        this.ctx.beginPath();
        this.ctx.arc(size * 0.3, 0, size * 0.3, 0, Math.PI * 2);
        this.ctx.stroke();
    }

    drawDrillShip(size) {
        // Basic triangle
        this.ctx.beginPath();
        this.ctx.moveTo(size, 0);
        this.ctx.lineTo(-size * 0.7, -size * 0.7);
        this.ctx.lineTo(-size * 0.7, size * 0.7);
        this.ctx.closePath();
        this.ctx.fill();

        // Drill bit/spike indicator
        this.ctx.fillStyle = '#888888';
        this.ctx.beginPath();
        this.ctx.moveTo(size * 1.2, 0);
        this.ctx.lineTo(size * 0.8, -size * 0.2);
        this.ctx.lineTo(size * 0.8, size * 0.2);
        this.ctx.closePath();
        this.ctx.fill();
    }

    drawTankerShip(size) {
        // Basic triangle
        this.ctx.beginPath();
        this.ctx.moveTo(size, 0);
        this.ctx.lineTo(-size * 0.7, -size * 0.7);
        this.ctx.lineTo(-size * 0.7, size * 0.7);
        this.ctx.closePath();
        this.ctx.fill();

        // Fuel tank cylinder
        this.ctx.fillStyle = '#666666';
        this.ctx.fillRect(-size * 0.3, -size * 0.4, size * 0.6, size * 0.8);
    }

    drawTruckShip(size) {
        // Basic triangle
        this.ctx.beginPath();
        this.ctx.moveTo(size, 0);
        this.ctx.lineTo(-size * 0.7, -size * 0.7);
        this.ctx.lineTo(-size * 0.7, size * 0.7);
        this.ctx.closePath();
        this.ctx.fill();

        // Cargo box
        this.ctx.strokeStyle = '#8b4513';
        this.ctx.lineWidth = 2;
        this.ctx.strokeRect(-size * 0.4, -size * 0.3, size * 0.5, size * 0.6);
    }

    drawBattleShip(size) {
        // Basic triangle
        this.ctx.beginPath();
        this.ctx.moveTo(size, 0);
        this.ctx.lineTo(-size * 0.7, -size * 0.7);
        this.ctx.lineTo(-size * 0.7, size * 0.7);
        this.ctx.closePath();
        this.ctx.fill();

        // Cannon/weapon indicator
        this.ctx.strokeStyle = '#ff0000';
        this.ctx.lineWidth = 3;
        this.ctx.beginPath();
        this.ctx.moveTo(size * 0.5, 0);
        this.ctx.lineTo(size * 1.3, 0);
        this.ctx.stroke();
    }

    drawDefaultShip(size) {
        // Default triangle for unknown ship types
        this.ctx.beginPath();
        this.ctx.moveTo(size, 0);
        this.ctx.lineTo(-size * 0.7, -size * 0.7);
        this.ctx.lineTo(-size * 0.7, size * 0.7);
        this.ctx.closePath();
        this.ctx.fill();
    }

    renderSelection() {
        const { type, data } = this.selectedEntity;
        let pos, radius;

        switch (type) {
            case 'ship':
                pos = this.camera.worldToScreen(data.position.x, data.position.y);
                radius = 160 * this.camera.zoom;
                break;
            case 'asteroid':
                pos = this.camera.worldToScreen(data.position.x, data.position.y);
                radius = (data.size + 10) * this.camera.zoom;
                break;
            case 'wormhole':
                pos = this.camera.worldToScreen(data.position.x, data.position.y);
                radius = 30 * this.camera.zoom;
                break;
        }

        this.ctx.strokeStyle = '#ffff4a';
        this.ctx.lineWidth = 3;
        this.ctx.setLineDash([5, 5]);
        this.ctx.beginPath();
        this.ctx.arc(pos.x, pos.y, radius, 0, Math.PI * 2);
        this.ctx.stroke();
        this.ctx.setLineDash([]);
    }

    renderSelectedWormholePath() {
        if (!this.selectedEntity || this.selectedEntity.type !== 'wormhole') return;

        const selectedWormhole = this.selectedEntity.data;
        const targetWormhole = this.gameData.wormholes.find(w =>
            w.id === selectedWormhole.target_id && w.position !== selectedWormhole.position
        );

        if (targetWormhole) {
            const startPos = this.camera.worldToScreen(selectedWormhole.position.x, selectedWormhole.position.y);
            const endPos = this.camera.worldToScreen(targetWormhole.position.x, targetWormhole.position.y);

            this.ctx.strokeStyle = '#00ff00';
            this.ctx.lineWidth = 4;
            this.ctx.setLineDash([10, 5]);
            this.ctx.beginPath();
            this.ctx.moveTo(startPos.x, startPos.y);
            this.ctx.lineTo(endPos.x, endPos.y);
            this.ctx.stroke();
            this.ctx.setLineDash([]);

            const angle = Math.atan2(endPos.y - startPos.y, endPos.x - startPos.x);
            const arrowLength = 15;
            this.ctx.fillStyle = '#00ff00';
            this.ctx.beginPath();
            this.ctx.moveTo(endPos.x, endPos.y);
            this.ctx.lineTo(
                endPos.x - arrowLength * Math.cos(angle - Math.PI / 6),
                endPos.y - arrowLength * Math.sin(angle - Math.PI / 6)
            );
            this.ctx.lineTo(
                endPos.x - arrowLength * Math.cos(angle + Math.PI / 6),
                endPos.y - arrowLength * Math.sin(angle + Math.PI / 6)
            );
            this.ctx.closePath();
            this.ctx.fill();
        }
    }

    getDestroyedColor(originalColor) {
        // Convert the original color to grayscale for destroyed ships
        // Simple approach: extract RGB components and convert to gray
        const r = parseInt(originalColor.slice(1, 3), 16);
        const g = parseInt(originalColor.slice(3, 5), 16);
        const b = parseInt(originalColor.slice(5, 7), 16);
        const gray = Math.round(0.299 * r + 0.587 * g + 0.114 * b);
        return `#${gray.toString(16).padStart(2, '0')}${gray.toString(16).padStart(2, '0')}${gray.toString(16).padStart(2, '0')}`;
    }

    drawDestroyedMark(size) {
        // Draw red X mark over destroyed ships
        this.ctx.strokeStyle = '#ff0000';
        this.ctx.lineWidth = Math.max(2, 4 * this.camera.zoom);
        this.ctx.beginPath();
        this.ctx.moveTo(-size * 0.6, -size * 0.6);
        this.ctx.lineTo(size * 0.6, size * 0.6);
        this.ctx.moveTo(size * 0.6, -size * 0.6);
        this.ctx.lineTo(-size * 0.6, size * 0.6);
        this.ctx.stroke();
    }

    drawDestroyedLabel(size) {
        // Draw "DESTROYED" text above the ship
        this.ctx.fillStyle = '#ff0000';
        this.ctx.font = `bold ${10 * this.camera.zoom}px Arial`;
        this.ctx.textAlign = 'center';
        this.ctx.fillText('DESTROYED', 0, -size - 15 * this.camera.zoom);
    }
}