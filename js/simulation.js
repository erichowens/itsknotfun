/**
 * Main Simulation - Orchestrates physics, entities, and braid tracking
 */

class Simulation {
    constructor(options = {}) {
        // Configurable parameters
        this.config = {
            leashLength: options.leashLength || 120,
            leashSegments: options.leashSegments || 15,
            walkerSpeed: options.walkerSpeed || 1.0,
            dogEnergy: options.dogEnergy || 1.5,
            gravity: new Vec2(0, 20), // Subtle downward bias
            solverIterations: 8
        };

        // Core systems
        this.physics = new PhysicsWorld({
            gravity: this.config.gravity,
            solverIterations: this.config.solverIterations
        });

        this.braidTracker = new BraidTracker(['A', 'B', 'C']);
        this.crossingDetector = new CrossingDetector(this.braidTracker);

        // Entities
        this.walker = null;
        this.dogs = [];
        this.leashes = [];

        // State
        this.isPaused = false;
        this.elapsedTime = 0;
        this.activeCrossings = []; // For rendering
        this.crossingDisplayTime = 1.0; // How long to show crossing indicators

        // Event callbacks
        this.onCrossingCallback = null;
        this.onStatsUpdateCallback = null;

        // Setup physics crossing detection
        this.physics.onCrossing((ropeA, ropeB, segA, segB, sign, point) => {
            this.handleCrossing(ropeA, ropeB, segA, segB, sign, point);
        });
    }

    /**
     * Initialize the simulation with walker and dogs
     */
    init(canvasWidth, canvasHeight) {
        const centerX = canvasWidth / 2;
        const startY = canvasHeight * 0.7;

        // Create walker
        this.walker = new Walker(centerX, startY);
        this.walker.setSpeedMultiplier(this.config.walkerSpeed);

        // Create three dogs with different breeds
        const dogPresets = ['goldenRetriever', 'borderCollie', 'beagle'];
        const dogColors = ['#8B0000', '#00008B', '#006400']; // Matching leash colors
        const angleSpread = Math.PI / 3; // 60 degrees spread

        for (let i = 0; i < 3; i++) {
            const angle = -Math.PI / 2 + (i - 1) * angleSpread; // Fan out ahead
            const distance = this.config.leashLength * 0.7;

            const dogX = centerX + Math.cos(angle) * distance;
            const dogY = startY + Math.sin(angle) * distance;

            const dog = createDogFromPreset(dogX, dogY, dogPresets[i]);
            dog.name = ['A', 'B', 'C'][i]; // Override with letter names
            this.dogs.push(dog);

            // Create leash connecting walker to dog
            const leash = new Rope(
                this.walker.getHandPosition(),
                dog.getCollarPosition(),
                this.config.leashSegments,
                {
                    mass: 0.05,
                    stiffness: 0.95,
                    bendStiffness: 0.2,
                    damping: 0.03,
                    color: dogColors[i],
                    thickness: 3
                }
            );

            // Pin both ends (will be moved by entities)
            leash.pinStart();
            leash.pinEnd();

            this.leashes.push(leash);
            this.physics.addRope(leash);

            // Register with braid tracker
            this.braidTracker.registerRope(leash.id, i);

            // Link dog to leash
            dog.leash = leash;
        }

        // Set world bounds based on canvas
        this.physics.bounds = {
            minX: centerX - 200,
            maxX: centerX + 200,
            minY: -10000, // Allow lots of vertical space
            maxY: startY + 200
        };

        return this;
    }

    /**
     * Handle crossing detection
     */
    handleCrossing(ropeA, ropeB, segIdxA, segIdxB, sign, point) {
        const event = this.crossingDetector.onCrossing(
            ropeA, ropeB, segIdxA, segIdxB, sign, point
        );

        if (event) {
            // Add to active crossings for rendering
            this.activeCrossings.push({
                point: point.clone(),
                isOver: sign > 0,
                ropeId: ropeA.id,
                timeRemaining: this.crossingDisplayTime
            });

            // Trigger callback
            if (this.onCrossingCallback) {
                this.onCrossingCallback(event);
            }
        }
    }

    /**
     * Update simulation state
     */
    update(dt) {
        if (this.isPaused) return;

        // Cap dt to avoid instability
        dt = Math.min(dt, 1 / 30);

        this.elapsedTime += dt;

        // Update walker
        this.walker.setSpeedMultiplier(this.config.walkerSpeed);
        this.walker.update(dt);

        // Update dogs with behaviors
        for (const dog of this.dogs) {
            dog.update(dt, this.walker, this.dogs, this.config.leashLength);
        }

        // Update leash endpoints to follow entities
        for (let i = 0; i < this.leashes.length; i++) {
            const leash = this.leashes[i];
            const dog = this.dogs[i];

            // Move leash start to walker's hand
            leash.moveStart(this.walker.getHandPosition());

            // Move leash end to dog's collar
            leash.moveEnd(dog.getCollarPosition());
        }

        // Step physics
        this.physics.step(dt);

        // Constrain dogs to leash length (enforce from physics side too)
        this.enforceLeashConstraints();

        // Update crossing display timers
        this.activeCrossings = this.activeCrossings.filter(c => {
            c.timeRemaining -= dt;
            return c.timeRemaining > 0;
        });

        // Periodic stats update
        if (this.onStatsUpdateCallback && Math.floor(this.elapsedTime * 4) !== Math.floor((this.elapsedTime - dt) * 4)) {
            this.onStatsUpdateCallback(this.getStats());
        }
    }

    /**
     * Enforce leash length constraints on dogs
     */
    enforceLeashConstraints() {
        const handPos = this.walker.getHandPosition();

        for (let i = 0; i < this.dogs.length; i++) {
            const dog = this.dogs[i];
            const toWalker = handPos.sub(dog.position);
            const distance = toWalker.length;

            if (distance > this.config.leashLength) {
                // Pull dog back
                const correction = toWalker.normalize().mul(distance - this.config.leashLength);
                dog.position.addMut(correction);

                // Also dampen velocity away from walker
                const awayVel = dog.velocity.dot(toWalker.normalize().negate());
                if (awayVel > 0) {
                    dog.velocity.addMut(toWalker.normalize().mul(awayVel * 0.5));
                }
            }
        }
    }

    /**
     * Get current statistics
     */
    getStats() {
        const braidStats = this.braidTracker.getStats();

        return {
            ...braidStats,
            elapsedTime: this.elapsedTime,
            elapsedTimeFormatted: this.formatTime(this.elapsedTime),
            isPaused: this.isPaused
        };
    }

    /**
     * Format time as "Xm Ys" or "Xs"
     */
    formatTime(seconds) {
        if (seconds < 60) {
            return Math.floor(seconds) + 's';
        }
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${mins}m ${secs}s`;
    }

    /**
     * Get recent events for log display
     */
    getRecentEvents(count = 10) {
        return this.braidTracker.getRecentEvents(count);
    }

    /**
     * Pause/resume simulation
     */
    togglePause() {
        this.isPaused = !this.isPaused;
        return this.isPaused;
    }

    /**
     * Reset simulation to initial state
     */
    reset(canvasWidth, canvasHeight) {
        // Clear physics
        for (const rope of this.leashes) {
            this.physics.removeRope(rope);
        }

        // Clear state
        this.dogs = [];
        this.leashes = [];
        this.activeCrossings = [];
        this.elapsedTime = 0;

        // Reset trackers
        this.braidTracker.reset();
        this.crossingDetector.reset();

        // Reinitialize
        this.init(canvasWidth, canvasHeight);
    }

    /**
     * Update configuration
     */
    setConfig(key, value) {
        this.config[key] = value;

        // Handle specific config changes
        if (key === 'walkerSpeed') {
            this.walker?.setSpeedMultiplier(value);
        }
    }

    /**
     * Set crossing event callback
     */
    onCrossing(callback) {
        this.onCrossingCallback = callback;
    }

    /**
     * Set stats update callback
     */
    onStatsUpdate(callback) {
        this.onStatsUpdateCallback = callback;
    }
}

// Export
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { Simulation };
} else {
    window.Simulation = Simulation;
}
