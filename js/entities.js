/**
 * Entities - Walker and Dogs with movement behaviors
 *
 * Top-down view: characters are seen from above
 * Walker moves forward steadily, dogs exhibit various behaviors
 */

/**
 * Base entity with position, velocity, and animation state
 */
class Entity {
    constructor(x, y) {
        this.position = new Vec2(x, y);
        this.velocity = Vec2.zero();
        this.facing = 0; // Angle in radians (0 = right, PI/2 = down)
        this.targetFacing = 0;

        // Animation
        this.animationTime = 0;
        this.animationSpeed = 1.0;
        this.state = 'idle'; // idle, walking, running

        // Physical properties
        this.radius = 10;
        this.maxSpeed = 100;
    }

    /**
     * Smoothly rotate towards target facing
     */
    updateFacing(dt, turnSpeed = 5) {
        let diff = this.targetFacing - this.facing;

        // Normalize to [-PI, PI]
        while (diff > Math.PI) diff -= Math.PI * 2;
        while (diff < -Math.PI) diff += Math.PI * 2;

        this.facing += diff * Math.min(1, turnSpeed * dt);
    }

    /**
     * Update animation time based on movement
     */
    updateAnimation(dt) {
        const speed = this.velocity.length;
        if (speed > 1) {
            this.animationTime += dt * this.animationSpeed * (speed / 50);
            this.state = speed > this.maxSpeed * 0.7 ? 'running' : 'walking';
        } else {
            this.state = 'idle';
        }
    }

    /**
     * Get the animation phase (0-1) for current cycle
     */
    get animationPhase() {
        return (this.animationTime % 1);
    }

    update(dt) {
        this.position.addMut(this.velocity.mul(dt));
        this.updateFacing(dt);
        this.updateAnimation(dt);
    }
}

/**
 * The human walker holding the leashes
 */
class Walker extends Entity {
    constructor(x, y) {
        super(x, y);

        this.radius = 12;
        this.maxSpeed = 60;
        this.walkSpeed = 40; // Normal walking pace

        // Walker moves forward by default
        this.facing = -Math.PI / 2; // Facing up (forward on sidewalk)
        this.targetFacing = this.facing;

        // Gait animation
        this.strideLength = 15;
        this.armSwing = 0;

        // Hand position offset (where leashes attach)
        this.handOffset = new Vec2(0, 5); // Slightly in front

        // Auto-walk state
        this.isWalking = true;
        this.walkDirection = new Vec2(0, -1); // Up the screen
    }

    /**
     * Get the position where leashes attach (walker's hand)
     */
    getHandPosition() {
        const rotatedOffset = this.handOffset.rotate(this.facing);
        return this.position.add(rotatedOffset);
    }

    /**
     * Set walking speed multiplier
     */
    setSpeedMultiplier(mult) {
        this.velocity = this.walkDirection.mul(this.walkSpeed * mult);
    }

    /**
     * Update walker position and animation
     */
    update(dt) {
        if (this.isWalking) {
            const targetVel = this.walkDirection.mul(this.walkSpeed);
            this.velocity.lerpMut(targetVel, 0.1);
            this.targetFacing = this.walkDirection.angle;
        }

        super.update(dt);

        // Arm swing animation
        this.armSwing = Math.sin(this.animationTime * Math.PI * 2) * 0.3;
    }

    /**
     * Get leg positions for animation (top-down view)
     */
    getLegPositions() {
        const phase = this.animationPhase;
        const stride = this.state === 'idle' ? 0 : this.strideLength;

        const leftOffset = Math.sin(phase * Math.PI * 2) * stride;
        const rightOffset = Math.sin((phase + 0.5) * Math.PI * 2) * stride;

        const perpendicular = Vec2.fromAngle(this.facing + Math.PI / 2);
        const forward = Vec2.fromAngle(this.facing);

        return {
            left: this.position
                .add(perpendicular.mul(-4))
                .add(forward.mul(leftOffset * 0.3)),
            right: this.position
                .add(perpendicular.mul(4))
                .add(forward.mul(rightOffset * 0.3))
        };
    }
}

/**
 * Dog behaviors for realistic movement
 */
const DogBehaviors = {
    // Base behavior weights
    WANDER: 0.3,
    FOLLOW_WALKER: 0.2,
    SNIFF: 0.2,
    PULL: 0.15,
    AVOID_OTHER_DOGS: 0.15,

    /**
     * Random wandering impulse
     */
    wander(dog, dt) {
        dog.wanderAngle += (Math.random() - 0.5) * 2 * dt;
        return Vec2.fromAngle(dog.wanderAngle, dog.energy * 30);
    },

    /**
     * Return towards walker when leash is taut
     */
    followWalker(dog, walkerPos, leashLength) {
        const toWalker = walkerPos.sub(dog.position);
        const distance = toWalker.length;

        if (distance > leashLength * 0.8) {
            // Getting close to leash limit, pull back
            const urgency = (distance - leashLength * 0.8) / (leashLength * 0.2);
            return toWalker.normalize().mul(urgency * 50);
        }
        return Vec2.zero();
    },

    /**
     * Sniffing behavior - stop and investigate
     */
    sniff(dog, dt) {
        if (dog.sniffTimer > 0) {
            dog.sniffTimer -= dt;
            return dog.velocity.negate().mul(0.5); // Slow down
        }

        // Random chance to start sniffing
        if (Math.random() < 0.005 * dt * dog.curiosity) {
            dog.sniffTimer = 1 + Math.random() * 2;
            dog.state = 'sniffing';
        }

        return Vec2.zero();
    },

    /**
     * Pulling ahead behavior
     */
    pull(dog, walkerPos, walkDirection) {
        if (dog.pulliness > 0.5 && Math.random() < 0.01) {
            // Surge forward
            return walkDirection.mul(dog.pulliness * 40);
        }
        return Vec2.zero();
    },

    /**
     * Avoid colliding with other dogs
     */
    avoidOtherDogs(dog, otherDogs) {
        let avoidance = Vec2.zero();
        const avoidRadius = 30;

        for (const other of otherDogs) {
            if (other === dog) continue;

            const toOther = other.position.sub(dog.position);
            const distance = toOther.length;

            if (distance < avoidRadius && distance > 0) {
                const repulsion = toOther.normalize().mul(-1 * (avoidRadius - distance));
                avoidance.addMut(repulsion);
            }
        }

        return avoidance;
    }
};

/**
 * A dog with personality and behaviors
 */
class Dog extends Entity {
    constructor(x, y, name, color) {
        super(x, y);

        this.name = name;
        this.color = color;
        this.radius = 8;
        this.maxSpeed = 100;

        // Personality traits (0-1)
        this.energy = 0.5 + Math.random() * 0.5;      // How active
        this.curiosity = 0.3 + Math.random() * 0.7;   // How often sniffs
        this.pulliness = Math.random() * 0.8;          // How much pulls ahead

        // Behavior state
        this.wanderAngle = Math.random() * Math.PI * 2;
        this.sniffTimer = 0;

        // Animation
        this.tailWag = 0;
        this.legCycle = Math.random(); // Offset leg animation

        // Reference to leash (set externally)
        this.leash = null;
    }

    /**
     * Get collar position (where leash attaches)
     */
    getCollarPosition() {
        // Collar is at back of neck
        const backOffset = Vec2.fromAngle(this.facing + Math.PI, 3);
        return this.position.add(backOffset);
    }

    /**
     * Update dog with behaviors
     */
    updateBehavior(dt, walker, otherDogs, leashLength) {
        if (this.sniffTimer > 0) {
            this.sniffTimer -= dt;
            this.state = 'sniffing';
            this.velocity.mulMut(0.9); // Slow down while sniffing
            return;
        }

        // Accumulate behavior forces
        let force = Vec2.zero();

        force.addMut(DogBehaviors.wander(this, dt).mul(DogBehaviors.WANDER));
        force.addMut(DogBehaviors.followWalker(this, walker.getHandPosition(), leashLength).mul(DogBehaviors.FOLLOW_WALKER));
        force.addMut(DogBehaviors.sniff(this, dt).mul(DogBehaviors.SNIFF));
        force.addMut(DogBehaviors.pull(this, walker.position, walker.walkDirection).mul(DogBehaviors.PULL));
        force.addMut(DogBehaviors.avoidOtherDogs(this, otherDogs).mul(DogBehaviors.AVOID_OTHER_DOGS));

        // Apply force to velocity
        this.velocity.addMut(force.mul(dt * this.energy * 2));

        // Limit speed
        this.velocity.limitMut(this.maxSpeed * this.energy);

        // Update facing based on velocity
        if (this.velocity.length > 5) {
            this.targetFacing = this.velocity.angle;
        }
    }

    update(dt, walker, otherDogs, leashLength) {
        this.updateBehavior(dt, walker, otherDogs, leashLength);
        super.update(dt);

        // Tail wag animation
        this.tailWag = Math.sin(this.animationTime * Math.PI * 4) * 0.5;

        // Leg cycle
        this.legCycle += dt * (this.velocity.length / 30);
    }

    /**
     * Get leg positions for quadruped animation
     */
    getLegPositions() {
        const phase = this.legCycle % 1;
        const isMoving = this.velocity.length > 5;
        const amplitude = isMoving ? 5 : 0;

        const forward = Vec2.fromAngle(this.facing);
        const side = Vec2.fromAngle(this.facing + Math.PI / 2);

        // Quadruped gait: diagonal pairs move together
        const frontOffset = isMoving ? Math.sin(phase * Math.PI * 2) * amplitude : 0;
        const backOffset = isMoving ? Math.sin((phase + 0.5) * Math.PI * 2) * amplitude : 0;

        return {
            frontLeft: this.position.add(forward.mul(4 + frontOffset)).add(side.mul(-3)),
            frontRight: this.position.add(forward.mul(4 + backOffset)).add(side.mul(3)),
            backLeft: this.position.add(forward.mul(-4 + backOffset)).add(side.mul(-3)),
            backRight: this.position.add(forward.mul(-4 + frontOffset)).add(side.mul(3))
        };
    }

    /**
     * Get tail position for animation
     */
    getTailPosition() {
        const back = Vec2.fromAngle(this.facing + Math.PI, 6);
        const wagOffset = Vec2.fromAngle(this.facing + Math.PI / 2, this.tailWag * 4);
        return this.position.add(back).add(wagOffset);
    }
}

/**
 * Dog color presets with personality hints
 */
const DogPresets = {
    goldenRetriever: {
        name: 'Buddy',
        color: '#DAA520',
        bodyColor: '#C8A030',
        energy: 0.8,
        curiosity: 0.7,
        pulliness: 0.4
    },
    borderCollie: {
        name: 'Max',
        color: '#1a1a1a',
        bodyColor: '#333333',
        energy: 0.9,
        curiosity: 0.5,
        pulliness: 0.7
    },
    beagle: {
        name: 'Charlie',
        color: '#8B4513',
        bodyColor: '#A0522D',
        energy: 0.7,
        curiosity: 0.9,
        pulliness: 0.3
    },
    labrador: {
        name: 'Lucy',
        color: '#2F1810',
        bodyColor: '#3D2317',
        energy: 0.75,
        curiosity: 0.6,
        pulliness: 0.5
    },
    poodle: {
        name: 'Coco',
        color: '#F5F5DC',
        bodyColor: '#E8E8D0',
        energy: 0.6,
        curiosity: 0.8,
        pulliness: 0.2
    },
    husky: {
        name: 'Luna',
        color: '#708090',
        bodyColor: '#E0E0E0',
        energy: 0.95,
        curiosity: 0.4,
        pulliness: 0.9
    }
};

/**
 * Create a dog from a preset
 */
function createDogFromPreset(x, y, presetName) {
    const preset = DogPresets[presetName] || DogPresets.goldenRetriever;
    const dog = new Dog(x, y, preset.name, preset.color);
    dog.bodyColor = preset.bodyColor;
    dog.energy = preset.energy;
    dog.curiosity = preset.curiosity;
    dog.pulliness = preset.pulliness;
    return dog;
}

// Export
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { Entity, Walker, Dog, DogBehaviors, DogPresets, createDogFromPreset };
} else {
    window.Entity = Entity;
    window.Walker = Walker;
    window.Dog = Dog;
    window.DogBehaviors = DogBehaviors;
    window.DogPresets = DogPresets;
    window.createDogFromPreset = createDogFromPreset;
}
