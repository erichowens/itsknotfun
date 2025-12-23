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
        this.activeTangles = []; // For rendering tangle points

        // Event callbacks
        this.onCrossingCallback = null;
        this.onStatsUpdateCallback = null;
        this.onTangleCallback = null;

        // Setup physics crossing detection
        this.physics.onCrossing((ropeA, ropeB, segA, segB, sign, point) => {
            this.handleCrossing(ropeA, ropeB, segA, segB, sign, point);
        });

        // Setup tangle event callbacks - THIS IS THE KEY INTEGRATION
        this.physics.onTangleFormed = (tangle, ropeA, ropeB, point) => {
            this.handleTangleFormed(tangle, ropeA, ropeB, point);
        };

        this.physics.onTangleBroken = (tangle) => {
            this.handleTangleBroken(tangle);
        };
    }

    /**
     * Handle new tangle formation
     */
    handleTangleFormed(tangle, ropeA, ropeB, point) {
        // Find rope names
        const ropeIdxA = this.leashes.indexOf(ropeA);
        const ropeIdxB = this.leashes.indexOf(ropeB);
        const nameA = ropeIdxA >= 0 ? this.dogs[ropeIdxA]?.name || `Rope ${ropeIdxA}` : 'Unknown';
        const nameB = ropeIdxB >= 0 ? this.dogs[ropeIdxB]?.name || `Rope ${ropeIdxB}` : 'Unknown';

        const event = {
            type: 'tangle_formed',
            time: this.elapsedTime,
            description: `Tangle formed: ${nameA} ↔ ${nameB} (${(tangle.wrapAngle * 180 / Math.PI).toFixed(0)}°)`,
            tangleId: tangle.id,
            ropeA: nameA,
            ropeB: nameB,
            point: point.clone(),
            wrapAngle: tangle.wrapAngle
        };

        // Add to active tangles for rendering
        this.activeTangles.push({
            tangle: tangle,
            ropeA: ropeA,
            ropeB: ropeB,
            formationTime: this.elapsedTime
        });

        // Trigger callback
        if (this.onTangleCallback) {
            this.onTangleCallback(event);
        }

        // Also fire as a crossing callback for the event log
        if (this.onCrossingCallback) {
            this.onCrossingCallback(event);
        }
    }

    /**
     * Handle tangle breaking
     */
    handleTangleBroken(tangle) {
        // Remove from active tangles
        this.activeTangles = this.activeTangles.filter(t => t.tangle.id !== tangle.id);

        const event = {
            type: 'tangle_broken',
            time: this.elapsedTime,
            description: `Tangle ${tangle.id} broke free! (was ${tangle.isLocked ? 'locked' : 'loose'})`,
            tangleId: tangle.id,
            wasLocked: tangle.isLocked,
            finalWrapAngle: tangle.wrapAngle
        };

        // Trigger callbacks
        if (this.onTangleCallback) {
            this.onTangleCallback(event);
        }

        if (this.onCrossingCallback) {
            this.onCrossingCallback(event);
        }
    }

    /**
     * Initialize the simulation with walker and dogs
     */
    init(canvasWidth, canvasHeight) {
        // Position on 3D sidewalk (x=-60) and start at z=0 in 3D (y=0 in 2D)
        // The 3D renderer uses: 3D.x = 2D.x, 3D.z = -2D.y
        // Sidewalk is at 3D x=-60, so 2D x=-60
        const centerX = -60;  // On the sidewalk in 3D view
        const startY = 0;     // Start at z=0 in 3D

        // Create walker
        this.walker = new Walker(centerX, startY);
        this.walker.setSpeedMultiplier(this.config.walkerSpeed);

        // Create three dogs with different breeds
        const dogPresets = ['goldenRetriever', 'borderCollie', 'beagle'];
        const dogColors = ['#8B0000', '#00008B', '#006400']; // Matching leash colors
        const angleSpread = Math.PI / 3; // 60 degrees spread

        // Hand position offsets - leashes attach at different points
        // This prevents instant tangling at origin
        this.leashHandOffsets = [
            new Vec2(-4, 0),   // Left leash
            new Vec2(0, 2),    // Center leash (slightly forward - positive Y because forward is -Y)
            new Vec2(4, 0)     // Right leash
        ];

        for (let i = 0; i < 3; i++) {
            // Dogs fan out AHEAD of walker (negative Y direction = forward in 3D)
            const angle = -Math.PI / 2 + (i - 1) * angleSpread; // Fan out ahead (negative Y)
            const distance = this.config.leashLength * 0.7;

            const dogX = centerX + Math.cos(angle) * distance;
            const dogY = startY + Math.sin(angle) * distance;

            const dog = createDogFromPreset(dogX, dogY, dogPresets[i]);
            dog.name = ['A', 'B', 'C'][i]; // Override with letter names
            this.dogs.push(dog);

            // Create leash connecting walker to dog
            // Use displaced hand position to prevent instant tangling
            const leash = new Rope(
                this.getDisplacedHandPosition(i),
                dog.getCollarPosition(),
                this.config.leashSegments,
                {
                    mass: 0.05,
                    stiffness: 1.0,      // Full stiffness for leashes (no stretch)
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

        // Provide tangle info to walker for untangle behavior
        const tangleStats = this.getTangleStats();
        this.walker.setTangleInfo(tangleStats, this.dogs);

        // Update walker (now with untangle behavior)
        this.walker.setSpeedMultiplier(this.config.walkerSpeed);
        this.walker.update(dt);

        // Update dogs with behaviors (pass tangles for frustration reactions)
        const tangles = this.physics.tangleConstraints || [];
        for (const dog of this.dogs) {
            dog.update(dt, this.walker, this.dogs, this.config.leashLength, tangles);
        }

        // Update leash endpoints to follow entities
        for (let i = 0; i < this.leashes.length; i++) {
            const leash = this.leashes[i];
            const dog = this.dogs[i];

            // Move leash start to walker's displaced hand position
            // Each leash attaches at a different point to prevent instant tangling
            leash.moveStart(this.getDisplacedHandPosition(i));

            // Move leash end to dog's collar
            leash.moveEnd(dog.getCollarPosition());

            // Propagate dog's bounce height to leash particles
            // The end particle gets the dog's full height, and it
            // smoothly interpolates toward the walker (height 0)
            this.propagateHeightToLeash(leash, dog);
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
     * Get displaced hand position for a specific leash
     * Each leash attaches at a different point on the walker's hand
     * This prevents instant tangling by spreading attachment points
     */
    getDisplacedHandPosition(leashIndex) {
        const baseHandPos = this.walker.getHandPosition();
        if (!this.leashHandOffsets || leashIndex >= this.leashHandOffsets.length) {
            return baseHandPos;
        }

        // Rotate the offset by walker's facing direction
        const offset = this.leashHandOffsets[leashIndex];
        const rotatedOffset = offset.rotate(this.walker.facing);
        return baseHandPos.add(rotatedOffset);
    }

    /**
     * Propagate the dog's bounce height along the leash particles
     * This creates natural over/under crossings based on dog movement
     */
    propagateHeightToLeash(leash, dog) {
        const particles = leash.particles;
        const numParticles = particles.length;

        // Dog's height at the end, walker at height 0
        const dogHeight = dog.height;

        for (let i = 0; i < numParticles; i++) {
            // t goes from 0 (walker/start) to 1 (dog/end)
            const t = i / (numParticles - 1);

            // Height interpolates smoothly from 0 to dogHeight
            // Using smooth step for more natural curve
            const smoothT = t * t * (3 - 2 * t); // Smoothstep function
            particles[i].height = smoothT * dogHeight;
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

        // Tangle statistics
        const tangleStats = this.getTangleStats();

        return {
            ...braidStats,
            elapsedTime: this.elapsedTime,
            elapsedTimeFormatted: this.formatTime(this.elapsedTime),
            isPaused: this.isPaused,
            // Tangle stats
            activeTangles: tangleStats.count,
            lockedTangles: tangleStats.locked,
            maxWrapAngle: tangleStats.maxWrap,
            totalCapstanFriction: tangleStats.totalFriction,
            tangleDetails: tangleStats.details
        };
    }

    /**
     * Get detailed tangle statistics
     */
    getTangleStats() {
        const tangles = this.physics.tangleConstraints;

        if (tangles.length === 0) {
            return {
                count: 0,
                locked: 0,
                maxWrap: '0°',
                totalFriction: '1.0x',
                details: []
            };
        }

        let lockedCount = 0;
        let maxWrapAngle = 0;
        let totalFrictionMultiplier = 1.0;
        const details = [];

        for (const tangle of tangles) {
            if (tangle.isLocked) lockedCount++;
            if (tangle.wrapAngle > maxWrapAngle) maxWrapAngle = tangle.wrapAngle;

            // Capstan friction accumulates multiplicatively
            totalFrictionMultiplier *= tangle.getCapstanFriction();

            details.push(tangle.getDebugInfo());
        }

        return {
            count: tangles.length,
            locked: lockedCount,
            maxWrap: (maxWrapAngle * 180 / Math.PI).toFixed(0) + '°',
            totalFriction: totalFrictionMultiplier.toFixed(1) + 'x',
            details: details
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
     * Reset simulation to initial state (complete cold start)
     */
    reset(canvasWidth, canvasHeight) {
        // Reset physics world completely (clears all ropes, tangles, intersections)
        this.physics.reset();

        // Clear all simulation state
        this.dogs = [];
        this.leashes = [];
        this.activeCrossings = [];
        this.activeTangles = [];
        this.elapsedTime = 0;
        this.isPaused = false;

        // Reset trackers (clears braid words and crossing history)
        this.braidTracker.reset();
        this.crossingDetector.reset();

        // Reinitialize fresh
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
