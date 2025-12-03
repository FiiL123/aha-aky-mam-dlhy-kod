class TimelineManager {
    constructor(observer, dataManager, redirectUrl = null) {
        this.observer = observer;
        this.dataManager = dataManager;
        this.redirectUrl = redirectUrl;
        this.redirectTriggered = false;
        this.isPlaying = false;
        this.isPaused = false;
        this.playInterval = null;
        this.playSpeed = 50; // milliseconds between frames
        this.lastFrameTime = 0;
        this.frameAccumulator = 0;

        this.setupEventListeners();
    }

    setupEventListeners() {
        const playPauseBtn = document.getElementById('playPauseBtn');
        const frameSlider = document.getElementById('frameSlider');
        const speedSelect = document.getElementById('speedSelect');

        if (playPauseBtn) {
            playPauseBtn.addEventListener('click', () => this.togglePlayPause());
        }

        if (frameSlider) {
            frameSlider.addEventListener('input', (e) => this.onFrameSliderChange(e));
        }

        if (speedSelect) {
            speedSelect.addEventListener('change', (e) => this.onSpeedChange(e));
        }

        // Initialize play button state
        this.updatePlayButtonState();
    }

    // Update timeline when data is loaded
    onDataLoaded() {
        this.updatePlayButtonState();
    }

    togglePlayPause() {
        if (this.isPlaying) {
            this.pause();
        } else {
            this.play();
        }
    }

    play() {
        if (this.dataManager.getTotalFrames() <= 1) return;

        this.isPlaying = true;
        this.isPaused = false;
        this.updatePlayPauseUI();
        this.updatePlayButtonState();

        this.lastFrameTime = performance.now();
        this.frameAccumulator = 0;

        // Simple playback with frame stepping
        this.playInterval = setInterval(() => {
            this.advanceFrame();
        }, 16); // ~60fps for smooth animation
    }

    pause() {
        this.isPlaying = false;
        this.isPaused = true;
        this.updatePlayPauseUI();
        this.updatePlayButtonState();

        if (this.playInterval) {
            clearInterval(this.playInterval);
            this.playInterval = null;
        }
    }

    updatePlayPauseUI() {
        const playIcon = document.getElementById('playIcon');
        const playText = document.getElementById('playText');

        if (playIcon && playText) {
            if (this.isPlaying) {
                playIcon.textContent = '⏸';
                playText.textContent = 'Pause';
            } else {
                playIcon.textContent = '▶';
                playText.textContent = 'Play';
            }
        }
    }

    updatePlayButtonState() {
        const playPauseBtn = document.getElementById('playPauseBtn');
        const totalFrames = this.dataManager.getTotalFrames();

        if (playPauseBtn) {
            playPauseBtn.disabled = totalFrames <= 1;
        }
    }

    onFrameSliderChange(e) {
        const frame = parseInt(e.target.value);
        this.dataManager.setCurrentFrame(frame);

        // Check if this is the last frame
        if (frame === this.dataManager.getTotalFrames() - 1) {
            this.handlePlaybackEnd();
        }
    }

    onSpeedChange(e) {
        this.playSpeed = parseInt(e.target.value);

        // If currently playing, restart with new speed
        if (this.isPlaying) {
            this.pause();
            this.play();
        }
    }

    
    // Simple frame advancement without interpolation during playback
    advanceFrame() {
        const now = performance.now();
        const deltaTime = now - this.lastFrameTime;
        this.lastFrameTime = now;

        // Accumulate time based on playback speed
        this.frameAccumulator += deltaTime;

        // Check if it's time to advance to next frame
        if (this.frameAccumulator >= this.playSpeed) {
            this.frameAccumulator = 0;

            // Check if we can advance to next frame
            if (this.dataManager.getCurrentFrame() < this.dataManager.getTotalFrames() - 1) {
                try {
                    this.dataManager.nextFrame();
                } catch (error) {
                    console.error("Error advancing frame:", error);
                    // Try to skip to next valid frame
                    this.handleCorruptedFrame();
                }
            } else {
                // Reached the end, pause playback
                this.pause();
                this.handlePlaybackEnd();
            }
        }
    }

    // Handle corrupted frames by attempting to skip them
    handleCorruptedFrame() {
        const originalFrame = this.dataManager.getCurrentFrame();
        let skipAttempts = 0;
        const maxSkipAttempts = 10;

        while (skipAttempts < maxSkipAttempts) {
            if (this.dataManager.getCurrentFrame() >= this.dataManager.getTotalFrames() - 1) {
                // Reached the end
                this.pause();
                return;
            }

            this.dataManager.nextFrame();
            const gameData = this.dataManager.getCurrentGameData();

            // If we got valid data, stop skipping
            if (gameData && this.dataManager.validateGameData(gameData)) {
                console.log(`Successfully skipped corrupted frame ${originalFrame}, now at frame ${this.dataManager.getCurrentFrame()}`);
                return;
            }

            skipAttempts++;
        }

        // If we couldn't find a valid frame, pause and show error
        console.error(`Could not find valid frame after skipping ${maxSkipAttempts} corrupted frames from frame ${originalFrame}`);
        this.pause();
        this.showErrorMessage("Timeline corrupted: Multiple invalid frames detected. Please reload the game data.");
    }

    // Show error message to user
    showErrorMessage(message) {
        const errorDiv = document.getElementById('errorMessage') || this.createErrorDiv();
        errorDiv.textContent = message;
        errorDiv.style.display = 'block';

        // Auto-hide after 5 seconds
        setTimeout(() => {
            errorDiv.style.display = 'none';
        }, 5000);
    }

    // Create error message div if it doesn't exist
    createErrorDiv() {
        const errorDiv = document.createElement('div');
        errorDiv.id = 'errorMessage';
        errorDiv.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: #ff4444;
            color: white;
            padding: 10px 15px;
            border-radius: 5px;
            z-index: 1000;
            font-family: Arial, sans-serif;
            max-width: 300px;
        `;
        document.body.appendChild(errorDiv);
        return errorDiv;
    }

    nextFrame() {
        const currentFrame = this.dataManager.getCurrentFrame();
        if (currentFrame < this.dataManager.getTotalFrames() - 1) {
            this.dataManager.setCurrentFrame(currentFrame + 1);

            // Check if this is now the last frame
            if (currentFrame + 1 === this.dataManager.getTotalFrames() - 1) {
                this.handlePlaybackEnd();
            }
            return true;
        }
        return false;
    }

    previousFrame() {
        const currentFrame = this.dataManager.getCurrentFrame();
        if (currentFrame > 0) {
            this.dataManager.setCurrentFrame(currentFrame - 1);
            return true;
        }
        return false;
    }

    firstFrame() {
        this.dataManager.setCurrentFrame(0);
    }

    lastFrame() {
        const totalFrames = this.dataManager.getTotalFrames();
        this.dataManager.setCurrentFrame(totalFrames - 1);
        this.handlePlaybackEnd();
    }

    setFrame(frame) {
        this.dataManager.setCurrentFrame(frame);
    }

    getCurrentFrame() {
        return this.dataManager.getCurrentFrame();
    }

    getTotalFrames() {
        return this.dataManager.getTotalFrames();
    }

    // Keyboard controls
    handleKeyDown(e) {
        switch(e.key) {
            case ' ':
                e.preventDefault();
                this.togglePlayPause();
                break;
            case 'ArrowLeft':
                e.preventDefault();
                this.previousFrame();
                break;
            case 'ArrowRight':
                e.preventDefault();
                this.nextFrame();
                break;
            case 'Home':
                e.preventDefault();
                this.firstFrame();
                break;
            case 'End':
                e.preventDefault();
                this.lastFrame();
                break;
        }
    }

    // Clean up when destroying
    destroy() {
        this.pause();
    }

    autoplay() {
        // Start from frame 0 for consistent autoplay behavior
        this.dataManager.setCurrentFrame(0);

        // Start playback - will stop automatically at last frame
        this.play();
    }

    handlePlaybackEnd() {
        if (this.redirectUrl && !this.redirectTriggered) {
            this.redirectTriggered = true;
            setTimeout(() => {
                window.location.href = this.redirectUrl;
            }, 2000); // 2 second delay to show final frame
        }
    }
}