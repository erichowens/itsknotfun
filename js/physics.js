/**
 * Position-Based Dynamics (PBD) Rope Physics with Tangle Formation
 *
 * Based on Müller et al. (2006) "Position-Based Dynamics"
 *
 * Why PBD over force-based springs:
 * - Unconditionally stable (no tiny timesteps needed for stiff ropes)
 * - Direct control over constraint satisfaction
 * - Predictable behavior at any framerate
 *
 * This implementation uses:
 * - Verlet integration for particle updates
 * - Gauss-Seidel iteration for constraint solving (sequential, fast convergence)
 * - Distance constraints for rope segments
 * - Collision constraints for ground and obstacles
 * - TangleConstraints for physical rope interlocking
 *
 * KEY INSIGHT: Real tangles create PHYSICAL CONSTRAINTS
 * When two ropes cross and tension is applied, they interlock at the crossing
 * point. This creates a new constraint that:
 * - Transfers forces between ropes
 * - Tightens under tension
 * - Has friction that resists sliding
 * - Fundamentally changes what movements are possible
 */

/**
 * A particle in the rope simulation
 */
class Particle {
    constructor(x, y, mass = 1.0) {
        this.position = new Vec2(x, y);
        this.prevPosition = new Vec2(x, y);
        this.velocity = Vec2.zero();

        // Inverse mass: 0 = infinite mass (pinned/fixed)
        this.inverseMass = mass > 0 ? 1.0 / mass : 0;
        this.mass = mass;

        // For constraint solving
        this.predicted = new Vec2(x, y);

        // Accumulated forces (gravity, etc.)
        this.acceleration = Vec2.zero();

        // Damping (0-1, higher = more damping)
        this.damping = 0.01;

        // Height (z-coordinate) for 3D crossing detection
        // This determines which rope is "over" vs "under" when they cross
        this.height = 0;
    }

    /**
     * Pin this particle in place (infinite mass)
     */
    pin() {
        this.inverseMass = 0;
    }

    /**
     * Unpin this particle
     */
    unpin(mass = 1.0) {
        this.inverseMass = mass > 0 ? 1.0 / mass : 0;
        this.mass = mass;
    }

    get isPinned() {
        return this.inverseMass === 0;
    }

    /**
     * Apply force (accumulated until integration step)
     */
    applyForce(force) {
        if (this.inverseMass > 0) {
            this.acceleration.addMut(force.mul(this.inverseMass));
        }
    }

    /**
     * Verlet integration step - predict new position
     */
    integrate(dt) {
        if (this.inverseMass === 0) {
            this.predicted.copy(this.position);
            return;
        }

        // Velocity from position difference (Verlet)
        this.velocity = this.position.sub(this.prevPosition).div(dt);

        // Apply damping
        this.velocity.mulMut(1.0 - this.damping);

        // Predict new position
        this.predicted = this.position
            .add(this.velocity.mul(dt))
            .add(this.acceleration.mul(dt * dt));

        // Clear acceleration for next frame
        this.acceleration.set(0, 0);
    }

    /**
     * Update position from predicted (after constraint solving)
     */
    updatePosition(dt) {
        if (this.inverseMass === 0) return;

        this.prevPosition.copy(this.position);
        this.position.copy(this.predicted);

        // Derive velocity from position change
        this.velocity = this.position.sub(this.prevPosition).div(dt);
    }

    /**
     * Teleport to new position (resets velocity)
     */
    teleport(x, y) {
        this.position.set(x, y);
        this.prevPosition.set(x, y);
        this.predicted.set(x, y);
        this.velocity.set(0, 0);
    }
}

/**
 * Distance constraint between two particles
 * Maintains rest length between particles
 */
class DistanceConstraint {
    constructor(particleA, particleB, restLength = null, stiffness = 1.0) {
        this.particleA = particleA;
        this.particleB = particleB;
        this.restLength = restLength ?? particleA.position.distanceTo(particleB.position);
        this.stiffness = stiffness; // 0-1, how strictly to enforce
    }

    /**
     * Project constraint (move particles to satisfy distance)
     * Gauss-Seidel: immediately updates predicted positions
     */
    solve() {
        const delta = this.particleB.predicted.sub(this.particleA.predicted);
        const distance = delta.length;

        if (distance < 1e-6) return; // Avoid division by zero

        const error = distance - this.restLength;
        const wSum = this.particleA.inverseMass + this.particleB.inverseMass;

        if (wSum < 1e-6) return; // Both particles pinned

        // Correction vector
        const correction = delta.mul((error * this.stiffness) / (distance * wSum));

        // Apply weighted corrections
        this.particleA.predicted.addMut(correction.mul(this.particleA.inverseMass));
        this.particleB.predicted.subMut(correction.mul(this.particleB.inverseMass));
    }
}

/**
 * Bending constraint for rope smoothness
 * Penalizes deviation from straight line between three particles
 */
class BendingConstraint {
    constructor(particleA, particleB, particleC, stiffness = 0.5) {
        this.particleA = particleA;
        this.particleB = particleB; // Middle particle
        this.particleC = particleC;
        this.stiffness = stiffness;

        // Calculate rest angle (usually ~180 degrees for a rope)
        this.restAngle = this.calculateAngle(
            particleA.position, particleB.position, particleC.position
        );
    }

    calculateAngle(a, b, c) {
        const ba = a.sub(b);
        const bc = c.sub(b);
        return Math.acos(Math.max(-1, Math.min(1, ba.dot(bc) / (ba.length * bc.length + 1e-6))));
    }

    solve() {
        const currentAngle = this.calculateAngle(
            this.particleA.predicted,
            this.particleB.predicted,
            this.particleC.predicted
        );

        const angleError = currentAngle - this.restAngle;

        if (Math.abs(angleError) < 0.01) return;

        // Simple center-push for bending resistance
        const center = this.particleA.predicted
            .add(this.particleC.predicted)
            .div(2);

        const pushDir = this.particleB.predicted.sub(center);
        const pushAmount = angleError * this.stiffness * 0.1;

        if (this.particleB.inverseMass > 0) {
            this.particleB.predicted.addMut(pushDir.normalize().mul(pushAmount));
        }
    }
}

/**
 * TangleConstraint - Physical binding between two ropes at a crossing point
 *
 * This is the KEY INNOVATION for realistic tangle physics.
 * When ropes cross and tension is applied, they don't just visually overlap -
 * they physically interlock, creating a constraint that:
 * - Keeps the crossing point together (the tangle point)
 * - Transfers forces between the two ropes
 * - Tightens when you pull on either rope
 * - Has friction that resists ropes sliding through each other
 *
 * The tangle effectively creates a "virtual joint" between the two ropes.
 *
 * KEY PHYSICS: Capstan Equation
 * Real rope friction follows: T₂ = T₁ × e^(μθ)
 * Where θ is the wrap angle. A 180° wrap with μ=0.3 multiplies friction by 2.6x!
 * This is why tangled ropes get exponentially harder to untangle as they wrap.
 */
class TangleConstraint {
    constructor(particleA, particleB, ropeA, ropeB, crossingPoint, options = {}) {
        // The two particles closest to the crossing point (one from each rope)
        this.particleA = particleA;
        this.particleB = particleB;
        this.ropeA = ropeA;
        this.ropeB = ropeB;

        // Where the tangle formed
        this.crossingPoint = crossingPoint.clone();

        // Options with defaults
        this.baseFriction = options.friction ?? 0.3;     // Base friction coefficient (μ)
        this.stiffness = options.stiffness ?? 0.9;       // How tightly locked
        this.maxDistance = options.maxDistance ?? 15;    // Max separation before tangle breaks
        this.minDistance = options.minDistance ?? 2;     // Minimum (ropes have thickness)

        // Current rest distance at tangle point (can tighten)
        this.restDistance = particleA.position.distanceTo(particleB.position);
        this.restDistance = Math.max(this.minDistance, Math.min(this.restDistance, this.maxDistance));

        // Wrap angle tracking (critical for Capstan equation)
        this.wrapAngle = options.initialWrapAngle ?? Math.PI / 6; // Start at 30° minimum
        this.maxWrapAngle = Math.PI * 2;  // Can wrap up to 360°

        // Tangle state
        this.age = 0;                    // How long has tangle existed
        this.tension = 0;                // Current tension at tangle point
        this.isLocked = false;           // Has it tightened into a real lock?
        this.lockThreshold = 50;         // Tension needed to "lock" the tangle

        // Unique ID for tracking
        this.id = TangleConstraint.nextId++;
    }

    /**
     * Calculate effective friction using Capstan equation
     * T₂ = T₁ × e^(μθ) → effective friction multiplier = e^(μθ)
     */
    getCapstanFriction() {
        return Math.exp(this.baseFriction * this.wrapAngle);
    }

    /**
     * Solve the tangle constraint
     * This is like a distance constraint but with Capstan friction and tightening
     */
    solve() {
        const delta = this.particleB.predicted.sub(this.particleA.predicted);
        const distance = delta.length;

        if (distance < 1e-6) return;

        // Calculate tension (how much the constraint is being stretched)
        this.tension = Math.max(0, distance - this.restDistance);

        // Update wrap angle based on movement (ropes can wrap tighter or looser)
        this.updateWrapAngle();

        // If under tension, the tangle tightens (this is the key behavior!)
        // Capstan effect: higher wrap angle = more friction = tighter lock
        if (this.tension > 0 && !this.isLocked) {
            // Tightening rate amplified by Capstan friction
            const capstanMultiplier = this.getCapstanFriction();
            const tightenRate = 0.02 * this.tension * Math.min(capstanMultiplier, 3.0);
            this.restDistance = Math.max(this.minDistance, this.restDistance - tightenRate);

            // Also increase wrap angle under tension (ropes dig into each other)
            this.wrapAngle = Math.min(this.maxWrapAngle, this.wrapAngle + this.tension * 0.001);

            // Lock if enough tension has been applied
            if (this.tension > this.lockThreshold) {
                this.isLocked = true;
            }
        }

        // Calculate correction needed
        let error;
        if (distance > this.restDistance) {
            // Ropes being pulled apart - resist with stiffness
            error = distance - this.restDistance;
        } else if (distance < this.minDistance) {
            // Ropes too close - push apart (they have thickness)
            error = distance - this.minDistance;
        } else {
            // Within acceptable range
            return;
        }

        const wSum = this.particleA.inverseMass + this.particleB.inverseMass;
        if (wSum < 1e-6) return;

        // Apply correction with Capstan friction
        const effectiveStiffness = this.isLocked ? 1.0 : this.stiffness;
        const correction = delta.mul((error * effectiveStiffness) / (distance * wSum));

        // Capstan friction resists sliding - exponentially based on wrap angle
        const capstanFriction = this.getCapstanFriction();
        // Clamp to prevent numerical instability (friction can't exceed 1.0 as a factor)
        const frictionFactor = Math.min(0.99, 1.0 - (1.0 / capstanFriction));

        // Apply less correction = more resistance to movement (friction effect)
        const effectiveFriction = this.isLocked ? 0.98 : (1.0 - frictionFactor * 0.5);

        this.particleA.predicted.addMut(correction.mul(this.particleA.inverseMass * effectiveFriction));
        this.particleB.predicted.subMut(correction.mul(this.particleB.inverseMass * effectiveFriction));

        // Update crossing point to track where the tangle is
        this.crossingPoint = this.particleA.predicted.add(this.particleB.predicted).div(2);
    }

    /**
     * Update wrap angle based on rope movement around the tangle point
     * Tracks how much the ropes have wrapped around each other
     *
     * CONSERVATIVE approach: wrap angle only increases under tension,
     * and naturally decreases (ropes slide apart) when slack
     */
    updateWrapAngle() {
        // Get adjacent particles to calculate rope direction at tangle point
        const idxA = this.ropeA.particles.indexOf(this.particleA);
        const idxB = this.ropeB.particles.indexOf(this.particleB);

        if (idxA < 0 || idxB < 0) return;

        // Calculate direction vectors along each rope at the tangle point
        let dirA = Vec2.zero();
        if (idxA > 0 && idxA < this.ropeA.particles.length - 1) {
            const prev = this.ropeA.particles[idxA - 1].predicted;
            const next = this.ropeA.particles[idxA + 1].predicted;
            dirA = next.sub(prev).normalize();
        }

        let dirB = Vec2.zero();
        if (idxB > 0 && idxB < this.ropeB.particles.length - 1) {
            const prev = this.ropeB.particles[idxB - 1].predicted;
            const next = this.ropeB.particles[idxB + 1].predicted;
            dirB = next.sub(prev).normalize();
        }

        // Cross product gives sine of angle between directions
        // Higher cross = more perpendicular = better wrap
        const cross = Math.abs(dirA.cross(dirB));

        // Only increase wrap angle when there's actual tension pulling on the tangle
        // Perpendicularity alone isn't enough - the ropes need to be pulling tight
        if (this.tension > 1 && cross > 0.5) {
            // Under tension with good crossing angle: wrap increases slowly
            const wrapIncrease = this.tension * 0.001 * cross;
            this.wrapAngle = Math.min(this.maxWrapAngle, this.wrapAngle + wrapIncrease);
        } else if (this.tension < 0.5) {
            // When slack, wrap angle naturally decreases (ropes can slide apart)
            this.wrapAngle = Math.max(Math.PI / 6, this.wrapAngle * 0.995);
        }
        // When tension is moderate (0.5-1), wrap angle stays stable
    }

    /**
     * Check if this tangle should break (ropes pulled apart OR slack for too long)
     * Capstan effect: Higher wrap angle = exponentially harder to break
     */
    shouldBreak() {
        const distance = this.particleA.position.distanceTo(this.particleB.position);

        // Break if ropes are slack for too long (natural untangling)
        // Only applies to unlocked tangles with low wrap angle
        if (!this.isLocked && this.wrapAngle < Math.PI / 3 && this.tension < 0.3) {
            this.slackFrames = (this.slackFrames || 0) + 1;
            if (this.slackFrames > 90) { // ~1.5 seconds of slack
                return true;
            }
        } else {
            this.slackFrames = 0;
        }

        // Capstan friction makes higher-wrapped tangles much harder to break
        const capstanMultiplier = this.getCapstanFriction();

        // Base break distance, multiplied by Capstan effect
        let breakDistance = this.maxDistance * 1.5;

        // Locked tangles use full Capstan resistance (but capped)
        if (this.isLocked) {
            breakDistance = this.maxDistance * Math.min(capstanMultiplier, 3);
        }

        // Cap the break distance to something reasonable
        breakDistance = Math.min(breakDistance, this.maxDistance * 3);

        return distance > breakDistance;
    }

    /**
     * Get diagnostic info for debugging/visualization
     */
    getDebugInfo() {
        return {
            id: this.id,
            tension: this.tension.toFixed(1),
            wrapAngle: (this.wrapAngle * 180 / Math.PI).toFixed(0) + '°',
            capstanFriction: this.getCapstanFriction().toFixed(2) + 'x',
            isLocked: this.isLocked,
            age: this.age.toFixed(1) + 's',
            restDistance: this.restDistance.toFixed(1)
        };
    }

    /**
     * Get the crossing sign for braid tracking
     * Positive if ropeA is "over" ropeB, negative if "under"
     */
    getCrossingSign() {
        // Use velocity to determine which is on top (rope moving faster is on top)
        const velA = this.particleA.velocity.length;
        const velB = this.particleB.velocity.length;
        return velA > velB ? 1 : -1;
    }
}

TangleConstraint.nextId = 0;

/**
 * A rope/leash made of connected particles
 */
class Rope {
    constructor(startPos, endPos, numSegments, options = {}) {
        this.particles = [];
        this.distanceConstraints = [];
        this.bendingConstraints = [];

        // Options with defaults
        const {
            mass = 0.1,
            stiffness = 1.0,
            bendStiffness = 0.3,
            damping = 0.02,
            color = '#8B4513', // Leather brown
            thickness = 3
        } = options;

        this.color = color;
        this.thickness = thickness;
        this.id = Rope.nextId++;

        // Create particles along the rope
        for (let i = 0; i <= numSegments; i++) {
            const t = i / numSegments;
            const pos = startPos.lerp(endPos, t);
            const particle = new Particle(pos.x, pos.y, mass);
            particle.damping = damping;
            this.particles.push(particle);
        }

        // Create distance constraints between adjacent particles
        const segmentLength = startPos.distanceTo(endPos) / numSegments;
        for (let i = 0; i < this.particles.length - 1; i++) {
            this.distanceConstraints.push(
                new DistanceConstraint(
                    this.particles[i],
                    this.particles[i + 1],
                    segmentLength,
                    stiffness
                )
            );
        }

        // Create bending constraints for smoothness
        for (let i = 0; i < this.particles.length - 2; i++) {
            this.bendingConstraints.push(
                new BendingConstraint(
                    this.particles[i],
                    this.particles[i + 1],
                    this.particles[i + 2],
                    bendStiffness
                )
            );
        }
    }

    get startParticle() {
        return this.particles[0];
    }

    get endParticle() {
        return this.particles[this.particles.length - 1];
    }

    /**
     * Pin the start of the rope (attach to walker)
     */
    pinStart() {
        this.startParticle.pin();
    }

    /**
     * Pin the end of the rope (attach to dog collar)
     */
    pinEnd() {
        this.endParticle.pin();
    }

    /**
     * Move the start particle (walker's hand)
     */
    moveStart(newPos) {
        this.startParticle.teleport(newPos.x, newPos.y);
    }

    /**
     * Move the end particle (dog's collar)
     */
    moveEnd(newPos) {
        this.endParticle.teleport(newPos.x, newPos.y);
    }

    /**
     * Apply gravity to all particles
     */
    applyGravity(gravity) {
        for (const particle of this.particles) {
            particle.applyForce(gravity);
        }
    }

    /**
     * Get all segments as pairs of positions (for rendering/collision)
     */
    getSegments() {
        const segments = [];
        for (let i = 0; i < this.particles.length - 1; i++) {
            segments.push({
                start: this.particles[i].position,
                end: this.particles[i + 1].position,
                index: i,
                ropeId: this.id
            });
        }
        return segments;
    }

    /**
     * Get total length of rope (sum of segment lengths)
     */
    getCurrentLength() {
        let length = 0;
        for (let i = 0; i < this.particles.length - 1; i++) {
            length += this.particles[i].position.distanceTo(this.particles[i + 1].position);
        }
        return length;
    }

    /**
     * Get total length using predicted positions (during constraint solving)
     */
    getPredictedLength() {
        let length = 0;
        for (let i = 0; i < this.particles.length - 1; i++) {
            length += this.particles[i].predicted.distanceTo(this.particles[i + 1].predicted);
        }
        return length;
    }

    /**
     * Get rest length (sum of constraint rest lengths)
     */
    getRestLength() {
        return this.distanceConstraints.reduce((sum, c) => sum + c.restLength, 0);
    }

    /**
     * Enforce maximum total rope length constraint
     * This is critical for leashes - they should NEVER stretch beyond their rest length
     *
     * Algorithm: If total length exceeds max, scale all segments proportionally
     * to bring total back to max while preserving rope shape
     */
    enforceMaxLength(maxStretchFactor = 1.0) {
        const restLength = this.getRestLength();
        const maxLength = restLength * maxStretchFactor;
        // Use predicted positions (we're in the middle of constraint solving)
        const currentLength = this.getPredictedLength();

        if (currentLength <= maxLength) return; // Within bounds

        // Calculate how much we need to shrink
        const scaleFactor = maxLength / currentLength;

        // Find the center of mass of unpinned particles for scaling anchor
        let anchor = null;

        // If start is pinned, scale from start
        if (this.startParticle.isPinned) {
            anchor = this.startParticle.predicted.clone();
        } else if (this.endParticle.isPinned) {
            anchor = this.endParticle.predicted.clone();
        }

        if (!anchor) return; // Both unpinned, can't enforce

        // Scale each particle's position toward the anchor
        for (const particle of this.particles) {
            if (particle.isPinned) continue;

            // Vector from anchor to particle
            const toParticle = particle.predicted.sub(anchor);
            // Scale it down
            const newPos = anchor.add(toParticle.mul(scaleFactor));
            particle.predicted.copy(newPos);
        }
    }

    /**
     * Strict length enforcement - pulls rope taut if stretched
     * Uses iterative projection to bring each segment to rest length
     * More aggressive than standard PBD for leash-like behavior
     */
    enforceStrictLength(iterations = 3) {
        for (let iter = 0; iter < iterations; iter++) {
            for (const constraint of this.distanceConstraints) {
                const delta = constraint.particleB.predicted.sub(constraint.particleA.predicted);
                const distance = delta.length;

                if (distance <= constraint.restLength || distance < 1e-6) continue;

                // Only correct if stretched (not compressed)
                const error = distance - constraint.restLength;
                const wSum = constraint.particleA.inverseMass + constraint.particleB.inverseMass;

                if (wSum < 1e-6) continue;

                // Full correction (stiffness = 1.0)
                const correction = delta.mul(error / (distance * wSum));

                constraint.particleA.predicted.addMut(correction.mul(constraint.particleA.inverseMass));
                constraint.particleB.predicted.subMut(correction.mul(constraint.particleB.inverseMass));
            }
        }
    }
}

Rope.nextId = 0;

/**
 * Main physics world - manages all ropes, constraints, and tangles
 */
class PhysicsWorld {
    constructor(options = {}) {
        this.ropes = [];
        this.gravity = options.gravity ?? new Vec2(0, 50); // Subtle downward pull (top-down view hint)
        this.solverIterations = options.solverIterations ?? 8;
        this.bounds = options.bounds ?? null; // { minX, maxX, minY, maxY }

        // TANGLE PHYSICS - The key addition!
        this.tangleConstraints = [];      // Active tangle points between ropes
        this.tangleFormationThreshold = 8; // How close segments must be to potentially tangle
        this.tangleTensionThreshold = 25;  // Minimum tension to form a tangle (HIGH - require REAL tension)
        this.ropeCollisionRadius = 1.5;    // Ropes have physical thickness (reduced for thinner leashes)
        this.allowFreeCrossing = true;     // Allow ropes to cross freely (for braid behavior)

        // Tangle debounce - prevent rapid tangle formation
        this.tangleCooldowns = new Map();  // Key: "ropeA-ropeB-segA-segB", Value: cooldown frames remaining
        this.tangleCooldownFrames = 120;   // ~2 seconds at 60fps before same segments can tangle again
        this.maxTanglesPerRopePair = 2;    // Maximum tangles between any two ropes
        this.maxTotalTangles = 6;          // Global maximum tangles in simulation

        // For tracking crossings (braid theory)
        this.crossingCallback = null;

        // For tracking tangle events
        this.onTangleFormed = null;
        this.onTangleBroken = null;
    }

    /**
     * Reset all physics state to initial conditions
     */
    reset() {
        this.ropes = [];
        this.tangleConstraints = [];
        this.currentIntersections = new Set();
        this.tangleCooldowns = new Map();
    }

    addRope(rope) {
        this.ropes.push(rope);
        return rope;
    }

    removeRope(rope) {
        const idx = this.ropes.indexOf(rope);
        if (idx !== -1) {
            this.ropes.splice(idx, 1);
        }
    }

    /**
     * Set callback for when ropes cross
     * callback(rope1, rope2, segment1Idx, segment2Idx, crossingSign)
     */
    onCrossing(callback) {
        this.crossingCallback = callback;
    }

    /**
     * Main simulation step
     */
    step(dt) {
        // 1. Apply forces and predict positions
        for (const rope of this.ropes) {
            rope.applyGravity(this.gravity);
            for (const particle of rope.particles) {
                particle.integrate(dt);
            }
        }

        // 2. Solve constraints iteratively (Gauss-Seidel)
        for (let i = 0; i < this.solverIterations; i++) {
            // Distance constraints (within each rope)
            for (const rope of this.ropes) {
                for (const constraint of rope.distanceConstraints) {
                    constraint.solve();
                }
            }

            // TANGLE CONSTRAINTS - This is where the magic happens!
            // Tangles create physical connections BETWEEN ropes
            for (const tangle of this.tangleConstraints) {
                tangle.solve();
                tangle.age += dt;
            }

            // Rope-rope collision (push apart if too close but not tangled)
            this.solveRopeCollisions();

            // Bending constraints (fewer iterations needed)
            if (i < this.solverIterations / 2) {
                for (const rope of this.ropes) {
                    for (const constraint of rope.bendingConstraints) {
                        constraint.solve();
                    }
                }
            }

            // Boundary constraints
            if (this.bounds) {
                this.solveBoundaryConstraints();
            }
        }

        // 2.5 Strict leash length enforcement (post-processing)
        // This ensures leashes NEVER exceed their max length
        // Done after regular constraint solving to guarantee hard limits
        for (const rope of this.ropes) {
            // First, do additional strict per-segment enforcement
            rope.enforceStrictLength(2);
            // Then, enforce total max length (no stretch allowed for leashes)
            rope.enforceMaxLength(1.0);
        }

        // 3. Update positions from predicted
        for (const rope of this.ropes) {
            for (const particle of rope.particles) {
                particle.updatePosition(dt);
            }
        }

        // 4. Check for new tangles forming and old ones breaking
        this.updateTangles();

        // 5. Detect crossings for braid word tracking
        this.detectCrossings();
    }

    /**
     * Solve rope-rope collisions
     * Ropes have physical thickness and push each other apart
     * unless they're already tangled at that point
     *
     * When allowFreeCrossing is true, ropes pass through each other freely
     * (crossing detection still happens separately for braid word tracking)
     */
    solveRopeCollisions() {
        // If free crossing is enabled, skip collision resolution entirely
        // This allows ropes to pass through each other for braid behavior
        if (this.allowFreeCrossing) {
            return;
        }

        for (let i = 0; i < this.ropes.length; i++) {
            for (let j = i + 1; j < this.ropes.length; j++) {
                this.solveRopePairCollision(this.ropes[i], this.ropes[j]);
            }
        }
    }

    /**
     * Solve collision between two ropes
     */
    solveRopePairCollision(ropeA, ropeB) {
        // Check each particle of ropeA against segments of ropeB
        for (const particleA of ropeA.particles) {
            if (particleA.inverseMass === 0) continue;

            for (let k = 0; k < ropeB.particles.length - 1; k++) {
                const p1 = ropeB.particles[k];
                const p2 = ropeB.particles[k + 1];

                // Skip if this particle pair is already tangled
                if (this.areTangled(particleA, p1) || this.areTangled(particleA, p2)) {
                    continue;
                }

                // Find closest point on segment to particle
                const closest = this.closestPointOnSegment(
                    particleA.predicted, p1.predicted, p2.predicted
                );
                const distance = particleA.predicted.distanceTo(closest);

                // If within collision radius, push apart
                if (distance < this.ropeCollisionRadius && distance > 0.01) {
                    const pushDir = particleA.predicted.sub(closest).normalize();
                    const overlap = this.ropeCollisionRadius - distance;
                    const push = pushDir.mul(overlap * 0.5);

                    // Push particle away from segment
                    if (particleA.inverseMass > 0) {
                        particleA.predicted.addMut(push);
                    }

                    // Push segment particles in opposite direction
                    const segPush = push.mul(-0.5);
                    if (p1.inverseMass > 0) p1.predicted.addMut(segPush);
                    if (p2.inverseMass > 0) p2.predicted.addMut(segPush);
                }
            }
        }
    }

    /**
     * Check if two particles are connected by a tangle
     */
    areTangled(particleA, particleB) {
        return this.tangleConstraints.some(t =>
            (t.particleA === particleA && t.particleB === particleB) ||
            (t.particleA === particleB && t.particleB === particleA)
        );
    }

    /**
     * Find closest point on line segment to a point
     */
    closestPointOnSegment(point, segStart, segEnd) {
        const v = segEnd.sub(segStart);
        const u = point.sub(segStart);
        const t = Math.max(0, Math.min(1, u.dot(v) / (v.dot(v) + 1e-6)));
        return segStart.add(v.mul(t));
    }

    /**
     * Update tangles - form new ones, break old ones
     * This is called after positions are updated
     */
    updateTangles() {
        // Decrement cooldowns
        for (const [key, value] of this.tangleCooldowns.entries()) {
            if (value <= 1) {
                this.tangleCooldowns.delete(key);
            } else {
                this.tangleCooldowns.set(key, value - 1);
            }
        }

        // Check for tangles that should break
        const toRemove = [];
        for (const tangle of this.tangleConstraints) {
            if (tangle.shouldBreak()) {
                toRemove.push(tangle);
                if (this.onTangleBroken) {
                    this.onTangleBroken(tangle);
                }
            }
        }
        for (const tangle of toRemove) {
            const idx = this.tangleConstraints.indexOf(tangle);
            if (idx !== -1) this.tangleConstraints.splice(idx, 1);
        }

        // Check for new tangles forming
        this.detectNewTangles();
    }

    /**
     * Detect where new tangles should form
     * Tangles form when:
     * 1. Two rope segments cross (intersect)
     * 2. There's sufficient tension on both ropes
     * 3. The crossing angle is favorable (not too parallel)
     */
    detectNewTangles() {
        for (let i = 0; i < this.ropes.length; i++) {
            for (let j = i + 1; j < this.ropes.length; j++) {
                this.detectRopePairTangles(this.ropes[i], this.ropes[j]);
            }
        }
    }

    /**
     * Count how many tangles exist between two specific ropes
     */
    countTanglesBetweenRopes(ropeA, ropeB) {
        return this.tangleConstraints.filter(t =>
            (t.ropeA === ropeA && t.ropeB === ropeB) ||
            (t.ropeA === ropeB && t.ropeB === ropeA)
        ).length;
    }

    /**
     * Detect tangles between two specific ropes
     * Uses research-based criteria:
     * - Segment intersection (ropes actually cross)
     * - Minimum crossing angle (30° = π/6 radians) for tangle to form
     * - Tension threshold (ropes must be under tension)
     */
    detectRopePairTangles(ropeA, ropeB) {
        // Check global max tangles
        if (this.tangleConstraints.length >= this.maxTotalTangles) {
            return;
        }

        // Check if we've hit max tangles for this rope pair
        if (this.countTanglesBetweenRopes(ropeA, ropeB) >= this.maxTanglesPerRopePair) {
            return;
        }

        const segmentsA = ropeA.getSegments();
        const segmentsB = ropeB.getSegments();

        // Minimum crossing angle for tangle formation (45° in radians) - INCREASED from 30°
        const MIN_WRAP_ANGLE = Math.PI / 4;  // 45°

        // Skip first segments near walker's hand to prevent instant tangling
        // Increased from 3 to 6 since leashes now have displaced origins
        const SKIP_SEGMENTS_FROM_START = 6;

        for (const segA of segmentsA) {
            // Skip segments too close to the pinned start (walker's hand)
            if (segA.index < SKIP_SEGMENTS_FROM_START) continue;

            for (const segB of segmentsB) {
                // Skip segments too close to the pinned start (walker's hand)
                if (segB.index < SKIP_SEGMENTS_FROM_START) continue;

                // Check cooldown for this segment pair
                const cooldownKey = `${ropeA.id}-${ropeB.id}-${segA.index}-${segB.index}`;
                if (this.tangleCooldowns.has(cooldownKey)) continue;

                // Check if segments intersect
                const result = Segment.segmentIntersection(
                    segA.start, segA.end,
                    segB.start, segB.end
                );

                if (!result.intersects) continue;

                // Find the particles closest to the intersection
                const particleA = this.findClosestParticle(ropeA, result.point);
                const particleB = this.findClosestParticle(ropeB, result.point);

                // Skip if these particles are already tangled
                if (this.areTangled(particleA, particleB)) continue;

                // Check crossing angle (perpendicular crossings tangle more easily)
                const dirA = segA.end.sub(segA.start).normalize();
                const dirB = segB.end.sub(segB.start).normalize();
                const crossProduct = Math.abs(dirA.cross(dirB)); // 1 = perpendicular, 0 = parallel

                // Convert cross product to angle: sin(θ) = cross product
                const crossingAngle = Math.asin(Math.min(1, crossProduct)); // 0 to π/2

                // CRITICAL: Minimum wrap angle threshold (45°)
                // Parallel/shallow crossings won't form tangles - ropes just slide past
                if (crossingAngle < MIN_WRAP_ANGLE) continue;

                // Check tension on both sides of the crossing - BOTH must have tension
                const tensionA = this.measureLocalTension(ropeA, particleA);
                const tensionB = this.measureLocalTension(ropeB, particleB);

                // Require BOTH ropes to have meaningful tension (not just total)
                if (tensionA < 2 || tensionB < 2) continue;

                // Tangle forms if:
                // - Crossing angle >= 45° (already checked)
                // - Both ropes have tension >= 2 (already checked)
                // - Combined conditions meet threshold
                const tangleProbability = (tensionA + tensionB) * crossProduct;

                if (tangleProbability > this.tangleTensionThreshold) {
                    // Set cooldown for this segment pair
                    this.tangleCooldowns.set(cooldownKey, this.tangleCooldownFrames);

                    // Create the tangle with initial wrap angle based on crossing angle
                    const tangle = new TangleConstraint(
                        particleA, particleB,
                        ropeA, ropeB,
                        result.point,
                        {
                            friction: 0.3,  // Base friction coefficient (μ) for Capstan
                            stiffness: Math.min(0.95, 0.7 + tangleProbability * 0.02),
                            initialWrapAngle: crossingAngle  // Start at actual crossing angle
                        }
                    );

                    this.tangleConstraints.push(tangle);

                    if (this.onTangleFormed) {
                        this.onTangleFormed(tangle, ropeA, ropeB, result.point);
                    }
                }
            }
        }
    }

    /**
     * Find the particle in a rope closest to a point
     */
    findClosestParticle(rope, point) {
        let closest = rope.particles[0];
        let minDist = closest.position.distanceTo(point);

        for (const particle of rope.particles) {
            const dist = particle.position.distanceTo(point);
            if (dist < minDist) {
                minDist = dist;
                closest = particle;
            }
        }

        return closest;
    }

    /**
     * Measure tension at a point in the rope
     * Tension is high when the rope is being pulled taut
     */
    measureLocalTension(rope, particle) {
        const idx = rope.particles.indexOf(particle);
        if (idx === -1) return 0;

        let tension = 0;

        // Check stretch from adjacent segments
        if (idx > 0) {
            const constraint = rope.distanceConstraints[idx - 1];
            const actualDist = constraint.particleA.position.distanceTo(constraint.particleB.position);
            tension += Math.max(0, actualDist - constraint.restLength);
        }

        if (idx < rope.distanceConstraints.length) {
            const constraint = rope.distanceConstraints[idx];
            const actualDist = constraint.particleA.position.distanceTo(constraint.particleB.position);
            tension += Math.max(0, actualDist - constraint.restLength);
        }

        // NOTE: Velocity was previously added but removed - it caused false tangles
        // when walker was moving. Tangles should only form from actual rope stretch.

        return tension;
    }

    /**
     * Keep particles within bounds
     */
    solveBoundaryConstraints() {
        if (!this.bounds) return;

        const { minX, maxX, minY, maxY } = this.bounds;

        for (const rope of this.ropes) {
            for (const particle of rope.particles) {
                if (particle.inverseMass === 0) continue;

                if (particle.predicted.x < minX) particle.predicted.x = minX;
                if (particle.predicted.x > maxX) particle.predicted.x = maxX;
                if (particle.predicted.y < minY) particle.predicted.y = minY;
                if (particle.predicted.y > maxY) particle.predicted.y = maxY;
            }
        }
    }

    /**
     * Detect crossings between rope segments
     * This is where the braid theory magic happens!
     */
    detectCrossings() {
        if (!this.crossingCallback) return;

        // Check each pair of ropes
        for (let i = 0; i < this.ropes.length; i++) {
            for (let j = i + 1; j < this.ropes.length; j++) {
                this.detectRopeCrossings(this.ropes[i], this.ropes[j]);
            }
        }
    }

    /**
     * Detect crossings between two ropes
     * Also tracks when segments separate so crossings can be re-detected
     */
    detectRopeCrossings(ropeA, ropeB) {
        const segmentsA = ropeA.getSegments();
        const segmentsB = ropeB.getSegments();

        // Track current intersections to detect separation
        if (!this.currentIntersections) {
            this.currentIntersections = new Set();
        }

        // Skip first segments near walker's hand to prevent instant tangling
        // Increased from 3 to 6 since leashes now have displaced origins
        const SKIP_SEGMENTS_FROM_START = 6;

        const newIntersections = new Set();

        for (const segA of segmentsA) {
            // Skip segments too close to the pinned start (walker's hand)
            if (segA.index < SKIP_SEGMENTS_FROM_START) continue;

            for (const segB of segmentsB) {
                // Skip segments too close to the pinned start (walker's hand)
                if (segB.index < SKIP_SEGMENTS_FROM_START) continue;

                const result = Segment.segmentIntersection(
                    segA.start, segA.end,
                    segB.start, segB.end
                );

                const key = `${ropeA.id}-${ropeB.id}-${segA.index}-${segB.index}`;

                if (result.intersects) {
                    newIntersections.add(key);

                    // Only callback if this is a NEW intersection
                    if (!this.currentIntersections.has(key)) {
                        // Determine which rope is "on top" using particle heights
                        // Each particle has a height value from the dog's bouncing gait
                        // Higher height = rope is on top at this crossing

                        // Get the particles at this segment and interpolate height at crossing point
                        const particleA1 = ropeA.particles[segA.index];
                        const particleA2 = ropeA.particles[segA.index + 1];
                        const particleB1 = ropeB.particles[segB.index];
                        const particleB2 = ropeB.particles[segB.index + 1];

                        // Interpolate height based on where on the segment the crossing occurs
                        // result.t1 is the parameter along segment A, result.t2 along segment B
                        const heightA = particleA1.height + (particleA2.height - particleA1.height) * (result.t1 || 0.5);
                        const heightB = particleB1.height + (particleB2.height - particleB1.height) * (result.t2 || 0.5);

                        // Higher height = on top, positive sign
                        const sign = heightA > heightB ? 1 : -1;

                        this.crossingCallback(
                            ropeA, ropeB,
                            segA.index, segB.index,
                            sign,
                            result.point
                        );
                    }
                }
            }
        }

        // Update the current intersections set
        // Segments that were intersecting but aren't anymore can now re-trigger
        this.currentIntersections = newIntersections;
    }

    /**
     * Get all rope segments (for external collision/rendering)
     */
    getAllSegments() {
        const allSegments = [];
        for (const rope of this.ropes) {
            allSegments.push(...rope.getSegments());
        }
        return allSegments;
    }
}

// Export
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { Particle, DistanceConstraint, BendingConstraint, TangleConstraint, Rope, PhysicsWorld };
} else {
    window.Particle = Particle;
    window.DistanceConstraint = DistanceConstraint;
    window.BendingConstraint = BendingConstraint;
    window.TangleConstraint = TangleConstraint;
    window.Rope = Rope;
    window.PhysicsWorld = PhysicsWorld;
}
