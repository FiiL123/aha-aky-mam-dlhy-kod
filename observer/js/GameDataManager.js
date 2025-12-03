class GameDataManager {
    constructor(observer) {
        this.observer = observer;
        this.gameStates = [];
        this.currentFrame = 0;
        this.selectedEntity = null;
        // Game constants for calculations
        this.MATERIAL_TO_SURFACE_RATIO = 1.0;
        // Dynamic player elements registry
        this.playerElementsRegistry = new Map(); // playerId -> elements map
    }

    async loadGameData() {
        // Just initialize with empty state - data will be loaded via file upload
        this.gameStates = [];
        this.currentFrame = 0;
        this.selectedEntity = null;

        console.log('GameDataManager initialized - waiting for file upload');
    }

    // Method to load data from uploaded file
    async loadUploadedData(gameStates) {
        this.gameStates = gameStates;
        this.currentFrame = 0;
        this.selectedEntity = null;

        console.log(`Loaded ${this.gameStates.length} game states from uploaded file`);

        // Generate dynamic player panels first
        this.generatePlayerPanels();

        this.updatePlayerInfo();
        this.updatePlayerColors();
        this.resetView();
        this.updateTimelineUI();

        // Notify timeline manager that data is loaded
        if (this.observer && this.observer.timelineManager) {
            this.observer.timelineManager.onDataLoaded();
        }
    }

    getCurrentFrame() {
        return this.currentFrame;
    }

    setCurrentFrame(frame) {
        if (frame >= 0 && frame < this.gameStates.length) {
            this.currentFrame = frame;
            this.updatePlayerInfo();
            this.updatePlayerColors();
            this.updateTimelineUI();
            this.updateEntityInfo(); // Update selected entity info when frame changes
            // Update play button state when frame changes
            if (this.observer.timelineManager) {
                this.observer.timelineManager.updatePlayButtonState();
            }
        }
    }

    getTotalFrames() {
        return this.gameStates.length;
    }

    getCurrentGameData() {
        const gameData = this.gameStates[this.currentFrame] || null;

        // Validate game data to prevent observer freezing
        if (gameData && !this.validateGameData(gameData)) {
            console.error(`Invalid game state detected at frame ${this.currentFrame}, attempting to skip to next valid frame`);
            return this.findNextValidFrame();
        }

        return gameData;
    }

    // Validate game state to detect corrupted data
    validateGameData(gameData) {
        if (!gameData) return false;

        // Check for required properties
        if (!gameData.ships || !Array.isArray(gameData.ships)) {
            return false;
        }

        // Validate ships array for invalid entries
        try {
            for (const ship of gameData.ships) {
                if (ship && (ship.health === undefined || ship.position === undefined || ship.player === undefined)) {
                    console.warn("Invalid ship data detected:", ship);
                    return false;
                }
            }
        } catch (error) {
            console.error("Error validating ships array:", error);
            return false;
        }

        return true;
    }

    // Find the next valid frame when current frame is corrupted
    findNextValidFrame() {
        for (let i = this.currentFrame + 1; i < this.gameStates.length; i++) {
            if (this.validateGameData(this.gameStates[i])) {
                console.log(`Found valid frame at index ${i}, skipping corrupted frames`);
                this.currentFrame = i;
                return this.gameStates[i];
            }
        }

        // If no valid frame found, return empty state to prevent freezing
        console.error("No valid frames found after corruption, returning empty state");
        return {
            ships: [],
            asteroids: [],
            wormholes: [],
            players: []
        };
    }

    nextFrame() {
        if (this.currentFrame < this.gameStates.length - 1) {
            this.setCurrentFrame(this.currentFrame + 1);
            return true;
        }
        return false;
    }

    previousFrame() {
        if (this.currentFrame > 0) {
            this.setCurrentFrame(this.currentFrame - 1);
            return true;
        }
        return false;
    }

    updateTimelineUI() {
        const frameSlider = document.getElementById('frameSlider');
        const frameCounter = document.getElementById('frameCounter');

        if (frameSlider && this.gameStates.length > 0) {
            frameSlider.max = this.gameStates.length - 1;
            frameSlider.value = this.currentFrame;
        }

        if (frameCounter) {
            frameCounter.textContent = `${this.currentFrame + 1} / ${this.gameStates.length}`;
        }
    }

    updatePlayerInfo() {
        const currentGameData = this.getCurrentGameData();
        if (!currentGameData) return;

        currentGameData.players.forEach(player => {
            const playerElements = this.getPlayerElements(player.id);
            if (!playerElements) return;

            // Update player header with name and ID
            if (playerElements.header) {
                playerElements.header.textContent = `${player.name} (${player.id})`;
            }

            // Update score
            if (playerElements.score) {
                playerElements.score.textContent = player.score || 0;
            }

            // Update rock and fuel
            if (playerElements.rock) {
                playerElements.rock.textContent = player.mothership.rock;
            }
            if (playerElements.fuel) {
                playerElements.fuel.textContent = player.mothership.fuel;
            }

            // Count ships for this player
            const playerShips = currentGameData.ships.filter(s => s.player === player.id);
            if (playerElements.ships) {
                playerElements.ships.textContent = playerShips.length;
            }
        });
    }

    getPlayerColor(playerId) {
        const currentGameData = this.getCurrentGameData();
        if (!currentGameData || !currentGameData.players) return '#ffffff';
        const player = currentGameData.players.find(p => p.id === playerId);
        return player ? player.color : '#ffffff';
    }

    updatePlayerColors() {
        const currentGameData = this.getCurrentGameData();
        if (!currentGameData) return;

        currentGameData.players.forEach(player => {
            const playerElements = this.getPlayerElements(player.id);
            if (playerElements && playerElements.panel) {
                playerElements.panel.style.borderLeftColor = player.color || '#ffffff';
            }
        });
    }

    deselectEntity() {
        this.selectedEntity = null;
        this.updateEntityInfo();
    }

    selectEntityAt(x, y) {
        const currentGameData = this.getCurrentGameData();
        if (!currentGameData) return;

        // Don't immediately deselect - check if there's an entity to select first
        let foundEntity = null;

        for (const ship of currentGameData.ships) {
            if (ship === null) continue;
            const dist = Math.sqrt((ship.position.x - x) ** 2 + (ship.position.y - y) ** 2);
            if (dist < 50) {
                foundEntity = { type: 'ship', id: ship.id };
                break;
            }
        }

        if (!foundEntity) {
            for (const asteroid of currentGameData.asteroids) {
                if (asteroid === null) continue;
                const dist = Math.sqrt((asteroid.position.x - x) ** 2 + (asteroid.position.y - y) ** 2);
                if (dist < asteroid.size + 10) {
                    foundEntity = { type: 'asteroid', id: asteroid.id };
                    break;
                }
            }
        }

        if (!foundEntity) {
            for (const wormhole of currentGameData.wormholes) {
                if (wormhole === null) continue;
                const dist = Math.sqrt((wormhole.position.x - x) ** 2 + (wormhole.position.y - y) ** 2);
                if (dist < 30) {
                    foundEntity = { type: 'wormhole', id: wormhole.id };
                    break;
                }
            }
        }

        // Only update selection if we found something or if we're clicking on empty space
        // This prevents accidental deselection during camera panning
        this.selectedEntity = foundEntity;
        this.updateEntityInfo();
    }

    updateEntityInfo() {
        const infoDiv = document.getElementById('entityInfo');

        if (!this.selectedEntity) {
            infoDiv.innerHTML = '<strong>Click on an entity to see details</strong>';
            return;
        }

        const selectedData = this.getInterpolatedSelectedEntity();
        if (!selectedData) {
            infoDiv.innerHTML = '<strong>Selected entity not found in current frame</strong>';
            return;
        }

        const { type, data } = selectedData;
        let html = `<strong>${type.charAt(0).toUpperCase() + type.slice(1)} ID: ${data.id}</strong> `;

        switch (type) {
            case 'ship':
                html += `<span class="entity-detail">P${data.player}</span>`;
                html += `<span class="entity-detail">Pos: (${Math.round(data.position.x)}, ${Math.round(data.position.y)})</span>`;
                html += `<span class="entity-detail">HP: ${data.health}</span>`;
                html += `<span class="entity-detail">Fuel: ${data.fuel}</span>`;
                html += `<span class="entity-detail">Type: ${this.getShipTypeName(data.type)}</span>`;
                html += `<span class="entity-detail">Rock: ${data.rock}</span>`;
                break;
            case 'asteroid':
                html += `<span class="entity-detail">Pos: (${Math.round(data.position.x)}, ${Math.round(data.position.y)})</span>`;
                html += `<span class="entity-detail">Size: ${data.size.toFixed(2)}</span>`;
                // Calculate material using the formula: Material = Size² × π × MaterialToSurfaceRatio
                const material = Math.pow(data.size, 2) * Math.PI * this.MATERIAL_TO_SURFACE_RATIO;
                html += `<span class="entity-detail">Material: ${material.toFixed(2)}</span>`;
                html += `<span class="entity-detail">Type: ${data.type}</span>`;
                if (data.owner_id !== undefined && data.owner_id !== -1) {
                    html += `<span class="entity-detail">Owner: P${data.owner_id}</span>`;
                }
                if (data.surface !== undefined) {
                    html += `<span class="entity-detail">Surface: ${data.surface}</span>`;
                }
                break;
            case 'wormhole':
                html += `<span class="entity-detail">Pos: (${Math.round(data.position.x)}, ${Math.round(data.position.y)})</span>`;
                html += `<span class="entity-detail">Target: ${data.target_id}</span>`;
                break;
        }

        infoDiv.innerHTML = html;
    }

    resetView() {
        this.observer.camera.reset();
    }

    getSelectedEntity() {
        return this.selectedEntity;
    }

    // Get selected entity for rendering
    getInterpolatedSelectedEntity() {
        if (!this.selectedEntity) return null;

        // Get the current game data
        const gameData = this.getCurrentGameData();
        if (!gameData) return null;

        const { type, id } = this.selectedEntity;
        const entityArray = gameData[type + 's']; // ships, asteroids, wormholes

        if (!entityArray) return null;

        const entity = entityArray.find(e => e && e.id === id);
        return entity ? { type, data: entity } : null;
    }

    getShipTypeName(shipType) {
        const shipTypes = {
            0: "MotherShip",
            1: "SuckerShip",
            2: "DrillShip",
            3: "TankerShip",
            4: "TruckShip",
            5: "BattleShip"
        };
        return shipTypes[shipType] || `Unknown (${shipType})`;
    }

    getGameData() {
        return this.getCurrentGameData();
    }

    // Dynamic Player Panel Generation Methods
    generatePlayerPanels() {
        const currentGameData = this.getCurrentGameData();
        if (!currentGameData || !currentGameData.players) return;

        const container = document.getElementById('playersContainer');
        if (!container) return;

        container.innerHTML = ''; // Clear existing panels

        // Apply layout class based on player count
        container.className = 'players-container';
        if (currentGameData.players.length > 4) {
            container.classList.add('two-columns');
        }

        // Clear registry
        this.playerElementsRegistry.clear();

        // Generate panel for each player
        currentGameData.players.forEach(player => {
            const panel = this.createPlayerPanel(player);
            container.appendChild(panel);
            this.registerPlayerElements(player.id, panel);
        });
    }

    createPlayerPanel(player) {
        const panel = document.createElement('div');
        panel.className = 'player-info';
        panel.id = `player${player.id}Info`;

        panel.innerHTML = `
            <h3 class="player-header">${player.name} (${player.id})</h3>
            <div class="stat-row">
                <span>Score:</span>
                <span class="player-score">${player.score || 0}</span>
            </div>
            <div class="stat-row">
                <span>Rock:</span>
                <span class="player-rock">1000</span>
            </div>
            <div class="stat-row">
                <span>Fuel:</span>
                <span class="player-fuel">1000</span>
            </div>
            <div class="stat-row">
                <span>Ships:</span>
                <span class="player-ships">0</span>
            </div>
        `;

        return panel;
    }

    registerPlayerElements(playerId, panel) {
        const elements = {
            panel: panel,
            header: panel.querySelector('.player-header'),
            score: panel.querySelector('.player-score'),
            rock: panel.querySelector('.player-rock'),
            fuel: panel.querySelector('.player-fuel'),
            ships: panel.querySelector('.player-ships')
        };
        this.playerElementsRegistry.set(playerId, elements);
    }

    getPlayerElements(playerId) {
        return this.playerElementsRegistry.get(playerId);
    }
}
