class InputHandler {
    constructor(canvas, camera, observer) {
        this.canvas = canvas;
        this.camera = camera;
        this.observer = observer;
        this.mouse = {
            isDown: false,
            lastX: 0,
            lastY: 0,
            startX: 0,
            startY: 0,
            hasDragged: false
        };

        // Drag detection threshold (in pixels)
        this.dragThreshold = 5;

        this.setupEventListeners();
    }

    setupEventListeners() {
        window.addEventListener('resize', () => this.resizeCanvas());

        this.canvas.addEventListener('mousedown', (e) => this.onMouseDown(e));
        this.canvas.addEventListener('mousemove', (e) => this.onMouseMove(e));
        this.canvas.addEventListener('mouseup', (e) => this.onMouseUp(e));
        this.canvas.addEventListener('wheel', (e) => this.onWheel(e));

        this.canvas.addEventListener('touchstart', (e) => this.onTouchStart(e));
        this.canvas.addEventListener('touchmove', (e) => this.onTouchMove(e));
        this.canvas.addEventListener('touchend', (e) => this.onTouchEnd(e));

        this.canvas.addEventListener('contextmenu', (e) => e.preventDefault());

        // Add event listeners to UI elements if they exist
        this.addButtonListener('resetView', () => this.resetView());
        this.addButtonListener('toggleGrid', () => this.toggleGrid());
        this.addButtonListener('zoomIn', () => this.zoomIn());
        this.addButtonListener('zoomOut', () => this.zoomOut());

        // Global keyboard event listeners for timeline controls
        document.addEventListener('keydown', (e) => this.onKeyDown(e));
    }

    addButtonListener(id, callback) {
        const element = document.getElementById(id);
        if (element) {
            element.addEventListener('click', callback);
        }
    }

    resizeCanvas() {
        const container = this.canvas.parentElement;
        this.canvas.width = container.clientWidth;
        this.canvas.height = container.clientHeight;
    }

    onMouseDown(e) {
        this.mouse.isDown = true;
        this.mouse.lastX = e.clientX;
        this.mouse.lastY = e.clientY;
        this.mouse.startX = e.clientX;
        this.mouse.startY = e.clientY;
        this.mouse.hasDragged = false;
    }

    onMouseMove(e) {
        this.updateCoordinates(e);

        if (this.mouse.isDown) {
            const deltaX = e.clientX - this.mouse.lastX;
            const deltaY = e.clientY - this.mouse.lastY;

            this.camera.pan(deltaX, deltaY);

            this.mouse.lastX = e.clientX;
            this.mouse.lastY = e.clientY;

            // Check if this movement constitutes a drag
            const totalDeltaX = e.clientX - this.mouse.startX;
            const totalDeltaY = e.clientY - this.mouse.startY;
            const totalDistance = Math.sqrt(totalDeltaX * totalDeltaX + totalDeltaY * totalDeltaY);

            if (totalDistance >= this.dragThreshold) {
                this.mouse.hasDragged = true;
            }
        }
    }

    onMouseUp(e) {
        this.mouse.isDown = false;

        // Only select entities if this was a genuine click (not a drag)
        if (!this.mouse.hasDragged) {
            const rect = this.canvas.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top;

            const worldX = (x - this.canvas.width / 2) / this.camera.zoom + this.camera.x;
            const worldY = (y - this.canvas.height / 2) / this.camera.zoom + this.camera.y;

            this.observer.selectEntityAt(worldX, worldY);
        }

        // Reset drag state for next interaction
        this.mouse.hasDragged = false;
    }

    onWheel(e) {
        e.preventDefault();
        this.camera.handleWheel(e.deltaY);
    }

    
    onTouchStart(e) {
        e.preventDefault();
        if (e.touches.length === 1) {
            const touch = e.touches[0];
            this.mouse.isDown = true;
            this.mouse.lastX = touch.clientX;
            this.mouse.lastY = touch.clientY;
            this.mouse.startX = touch.clientX;
            this.mouse.startY = touch.clientY;
            this.mouse.hasDragged = false;
        }
    }

    onTouchMove(e) {
        e.preventDefault();
        if (e.touches.length === 1 && this.mouse.isDown) {
            const touch = e.touches[0];
            const deltaX = touch.clientX - this.mouse.lastX;
            const deltaY = touch.clientY - this.mouse.lastY;

            this.camera.pan(deltaX, deltaY);

            this.mouse.lastX = touch.clientX;
            this.mouse.lastY = touch.clientY;

            // Check if this movement constitutes a drag
            const totalDeltaX = touch.clientX - this.mouse.startX;
            const totalDeltaY = touch.clientY - this.mouse.startY;
            const totalDistance = Math.sqrt(totalDeltaX * totalDeltaX + totalDeltaY * totalDeltaY);

            if (totalDistance >= this.dragThreshold) {
                this.mouse.hasDragged = true;
            }
        }
    }

    onTouchEnd(e) {
        e.preventDefault();

        // Only select entities if this was a genuine touch (not a drag)
        if (!this.mouse.hasDragged && this.mouse.isDown) {
            const rect = this.canvas.getBoundingClientRect();
            const x = this.mouse.lastX - rect.left;
            const y = this.mouse.lastY - rect.top;

            const worldX = (x - this.canvas.width / 2) / this.camera.zoom + this.camera.x;
            const worldY = (y - this.canvas.height / 2) / this.camera.zoom + this.camera.y;

            this.observer.selectEntityAt(worldX, worldY);
        }

        this.mouse.isDown = false;
        this.mouse.hasDragged = false;
    }

    updateCoordinates(e) {
        const rect = this.canvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;

        const worldX = Math.round((x - this.canvas.width / 2) / this.camera.zoom + this.camera.x);
        const worldY = Math.round((y - this.canvas.height / 2) / this.camera.zoom + this.camera.y);

        document.getElementById('coordinates').textContent = `X: ${worldX}, Y: ${worldY}`;
    }

    resetView() {
        this.camera.reset();
    }

    toggleGrid() {
        this.observer.renderer.toggleGrid();
    }

    
    zoomIn() {
        this.camera.zoomIn();
    }

    zoomOut() {
        this.camera.zoomOut();
    }

    onKeyDown(e) {
        // Handle Escape key for deselection
        if (e.key === 'Escape' || e.key === 'Esc') {
            this.observer.deselectEntity();
            return;
        }

        // Handle timeline controls if timeline manager exists
        if (this.observer.timelineManager) {
            this.observer.timelineManager.handleKeyDown(e);
        }
    }
}