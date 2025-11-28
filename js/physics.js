/**
 * Position-Based Dynamics (PBD) Rope Physics
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
     * Get rest length (sum of constraint rest lengths)
     */
    getRestLength() {
        return this.distanceConstraints.reduce((sum, c) => sum + c.restLength, 0);
    }
}

Rope.nextId = 0;

/**
 * Main physics world - manages all ropes and constraints
 */
class PhysicsWorld {
    constructor(options = {}) {
        this.ropes = [];
        this.gravity = options.gravity ?? new Vec2(0, 50); // Subtle downward pull (top-down view hint)
        this.solverIterations = options.solverIterations ?? 8;
        this.bounds = options.bounds ?? null; // { minX, maxX, minY, maxY }

        // For tracking crossings
        this.crossingCallback = null;
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
            // Distance constraints
            for (const rope of this.ropes) {
                for (const constraint of rope.distanceConstraints) {
                    constraint.solve();
                }
            }

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

        // 3. Update positions from predicted
        for (const rope of this.ropes) {
            for (const particle of rope.particles) {
                particle.updatePosition(dt);
            }
        }

        // 4. Detect crossings (after positions are updated)
        this.detectCrossings();
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
     */
    detectRopeCrossings(ropeA, ropeB) {
        const segmentsA = ropeA.getSegments();
        const segmentsB = ropeB.getSegments();

        for (const segA of segmentsA) {
            for (const segB of segmentsB) {
                const result = Segment.segmentIntersection(
                    segA.start, segA.end,
                    segB.start, segB.end
                );

                if (result.intersects) {
                    // Determine which rope is "on top"
                    // In our 2D top-down view, we use distance from walker
                    // as a proxy for height (closer to walker = on top)
                    const distA = segA.start.distanceTo(ropeA.startParticle.position);
                    const distB = segB.start.distanceTo(ropeB.startParticle.position);
                    const sign = distA < distB ? 1 : -1;

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
    module.exports = { Particle, DistanceConstraint, BendingConstraint, Rope, PhysicsWorld };
} else {
    window.Particle = Particle;
    window.DistanceConstraint = DistanceConstraint;
    window.BendingConstraint = BendingConstraint;
    window.Rope = Rope;
    window.PhysicsWorld = PhysicsWorld;
}
