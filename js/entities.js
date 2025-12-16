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
 * Now with untangling behaviors!
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
        this.baseWalkDirection = new Vec2(0, -1); // Original direction to return to

        // Untangling behavior state
        this.untangleState = 'normal'; // normal, assessing, stepping, turning, waiting
        this.untangleTimer = 0;
        this.untangleCooldown = 0; // Don't immediately try again
        this.stepDirection = null; // Direction to step when untangling
        this.tangleInfo = null; // Current tangle info from simulation

        // Hand height for raising/lowering during untangle
        this.handHeight = 0; // 0 = normal, positive = raised
        this.targetHandHeight = 0;
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
     * Provide tangle information from the simulation
     */
    setTangleInfo(tangleStats, dogs) {
        this.tangleInfo = tangleStats;
        this.dogs = dogs;
    }

    /**
     * Update walker position and animation, including untangle behavior
     */
    update(dt) {
        // Update cooldown
        if (this.untangleCooldown > 0) {
            this.untangleCooldown -= dt;
        }

        // Check for tangles and respond
        this.updateUntangleBehavior(dt);

        if (this.isWalking) {
            const speedMult = this.getSpeedMultiplierForState();
            const targetVel = this.walkDirection.mul(this.walkSpeed * speedMult);
            this.velocity.lerpMut(targetVel, 0.1);
            this.targetFacing = this.walkDirection.angle;
        }

        super.update(dt);

        // Arm swing animation
        this.armSwing = Math.sin(this.animationTime * Math.PI * 2) * 0.3;

        // Smoothly adjust hand height
        this.handHeight += (this.targetHandHeight - this.handHeight) * 0.1;
    }

    /**
     * Get speed multiplier based on untangle state
     */
    getSpeedMultiplierForState() {
        switch (this.untangleState) {
            case 'slowing':
                return 0.5; // Slow down while dealing with tangles
            case 'waiting':
                return 0.1; // Nearly stopped for locked tangles
            // Legacy states (shouldn't be reached)
            case 'assessing':
            case 'stepping':
            case 'turning':
                return 0.5;
            default:
                return 1.0; // Normal speed
        }
    }

    /**
     * Main untangle behavior state machine
     * SIMPLIFIED: Walker just slows down and raises hand, keeps walking forward
     * No turning or stepping sideways - this caused backwards walking bugs
     */
    updateUntangleBehavior(dt) {
        // Don't start new untangle if on cooldown
        if (this.untangleState === 'normal' && this.untangleCooldown > 0) {
            return;
        }

        // Check if we have active tangles (require at least 2 to react)
        const tangleCount = this.tangleInfo ?
            (this.tangleInfo.count || this.tangleInfo.activeTangles || 0) : 0;
        const hasTangles = tangleCount >= 2;
        const hasLockedTangles = this.tangleInfo &&
            (this.tangleInfo.locked > 0 || this.tangleInfo.lockedTangles > 0);

        switch (this.untangleState) {
            case 'normal':
                if (hasTangles) {
                    // Start responding - just slow down and raise hand
                    this.untangleState = 'slowing';
                    this.untangleTimer = 2.0; // Slow for 2 seconds
                    this.targetHandHeight = 15; // Raise hand
                }
                break;

            case 'slowing':
                this.untangleTimer -= dt;
                // Keep walking forward, just slower (handled by getSpeedMultiplierForState)
                // IMPORTANT: Don't change walkDirection!

                if (this.untangleTimer <= 0 || !hasTangles) {
                    if (hasLockedTangles && hasTangles) {
                        // Locked tangles - stop briefly
                        this.untangleState = 'waiting';
                        this.untangleTimer = 1.5;
                        this.targetHandHeight = 20;
                    } else {
                        this.finishUntangle();
                    }
                }
                break;

            case 'waiting':
                this.untangleTimer -= dt;
                this.targetHandHeight = 20; // Keep hand high
                // Keep walking direction forward!
                this.walkDirection = this.baseWalkDirection.clone();

                if (this.untangleTimer <= 0 || !hasTangles) {
                    this.finishUntangle();
                }
                break;

            // Legacy states - immediately finish if somehow entered
            case 'assessing':
            case 'stepping':
            case 'turning':
                this.finishUntangle();
                break;
        }
    }

    /**
     * Decide what untangle action to take
     */
    decideUntangleAction(hasLockedTangles) {
        // Analyze dog positions to decide step direction
        if (this.dogs && this.dogs.length >= 2) {
            // Find which dogs are tangled by looking at their relative positions
            // Step towards the side that would help separate them

            const dogPositions = this.dogs.map(d => d.position);
            const avgDogPos = dogPositions.reduce(
                (acc, p) => acc.add(p),
                Vec2.zero()
            ).mul(1 / dogPositions.length);

            // Direction from walker to average dog position
            const toDogs = avgDogPos.sub(this.position);

            // Step perpendicular to the line to dogs
            // Choose direction that moves away from cluster
            const perpendicular = Vec2.fromAngle(toDogs.angle + Math.PI / 2);

            // Randomly choose left or right step, with slight bias based on dog positions
            const leftDogCount = this.dogs.filter(d =>
                d.position.sub(this.position).cross(toDogs) < 0
            ).length;

            // Step towards the side with fewer dogs
            if (leftDogCount > this.dogs.length / 2) {
                this.stepDirection = this.baseWalkDirection.add(perpendicular.mul(-0.5)).normalize();
            } else {
                this.stepDirection = this.baseWalkDirection.add(perpendicular.mul(0.5)).normalize();
            }
        } else {
            // Default: step to the right
            this.stepDirection = this.baseWalkDirection.add(
                Vec2.fromAngle(this.baseWalkDirection.angle + Math.PI / 2).mul(0.5)
            ).normalize();
        }

        this.untangleState = 'stepping';
        this.untangleTimer = 1.5; // Step aside for 1.5 seconds
    }

    /**
     * Decide which direction to turn
     */
    decideTurnDirection() {
        if (this.dogs && this.dogs.length >= 2) {
            // Turn to face the tangled dogs more directly
            // This can help give slack to untangle

            // Find center of dogs
            const avgDogPos = this.dogs.reduce(
                (acc, d) => acc.add(d.position),
                Vec2.zero()
            ).mul(1 / this.dogs.length);

            // Slight turn towards dogs
            const toDogs = avgDogPos.sub(this.position).normalize();
            const turnAmount = 0.3; // Partial turn

            this.walkDirection = this.baseWalkDirection.lerp(toDogs, turnAmount).normalize();
        }
    }

    /**
     * Finish untangle attempt and return to normal
     */
    finishUntangle() {
        this.untangleState = 'normal';
        this.untangleTimer = 0;
        this.untangleCooldown = 3.0; // Wait 3 seconds before trying again
        this.targetHandHeight = 0; // Lower hand
        this.stepDirection = null;

        // Gradually return to base walk direction
        this.walkDirection = this.baseWalkDirection.clone();
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
    WANDER: 0.25,
    FOLLOW_WALKER: 0.2,
    SNIFF: 0.15,
    PULL: 0.1,
    AVOID_OTHER_DOGS: 0.1,
    PEE: 0.1,
    SOCIALIZE: 0.05,
    REACT_TANGLE: 0.05,

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
     * Sniffing behavior - stop and investigate the ground
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
    },

    /**
     * Pee/marking behavior - dogs stop to mark territory
     * Typically happens near vertical objects (simulated by random positions)
     */
    pee(dog, dt) {
        if (dog.peeTimer > 0) {
            dog.peeTimer -= dt;
            // Stay still while marking
            return dog.velocity.negate().mul(0.8);
        }

        // Random chance to need to mark - males more frequent
        const peeFrequency = dog.isMale ? 0.002 : 0.0005;
        if (Math.random() < peeFrequency * dt) {
            dog.peeTimer = 2 + Math.random() * 3; // 2-5 seconds
            dog.state = 'marking';
        }

        return Vec2.zero();
    },

    /**
     * Socialize with other dogs - sniff each other when close
     */
    socialize(dog, otherDogs, dt) {
        const socialRadius = 40; // Close enough to interact
        let socialForce = Vec2.zero();

        for (const other of otherDogs) {
            if (other === dog) continue;

            const toOther = other.position.sub(dog.position);
            const distance = toOther.length;

            // If close and both dogs are calm (not pulling/running fast)
            if (distance < socialRadius && distance > 10 &&
                dog.velocity.length < 30 && other.velocity.length < 30) {

                // Dogs want to approach each other to sniff
                if (!dog.socializing && !other.socializing) {
                    // Start socializing
                    if (Math.random() < 0.01 * dt) {
                        dog.socializing = true;
                        dog.socializeTarget = other;
                        dog.socializeTimer = 2 + Math.random() * 3;
                    }
                }

                // If actively socializing with this dog
                if (dog.socializing && dog.socializeTarget === other) {
                    dog.socializeTimer -= dt;

                    if (dog.socializeTimer <= 0) {
                        // Done socializing
                        dog.socializing = false;
                        dog.socializeTarget = null;
                    } else {
                        // Move towards the other dog (gentle attraction)
                        const attraction = toOther.normalize().mul(15);
                        socialForce.addMut(attraction);
                    }
                }
            }
        }

        return socialForce;
    },

    /**
     * React to tangles - frustrated behavior when leash is tangled
     * Dogs pull and tug when they feel restricted
     */
    reactToTangle(dog, tangles, walkerPos) {
        if (!tangles || tangles.length === 0) return Vec2.zero();

        // Check if this dog's leash is involved in any tangles
        let isInTangle = false;
        let tangleTension = 0;

        for (const tangle of tangles) {
            if (tangle.ropeA === dog.leash || tangle.ropeB === dog.leash) {
                isInTangle = true;
                tangleTension += tangle.tension || 10;
            }
        }

        if (!isInTangle) return Vec2.zero();

        // Dog reacts to tangle based on personality
        dog.frustration = Math.min(1.0, (dog.frustration || 0) + 0.01 * tangleTension);

        // Frustrated dogs pull randomly, trying to "undo" the tangle
        if (dog.frustration > 0.3) {
            const frustrationForce = Vec2.fromAngle(
                Math.random() * Math.PI * 2,
                dog.frustration * 30 * dog.energy
            );

            // Sometimes try to return to walker (learned behavior)
            if (Math.random() < 0.3) {
                const toWalker = walkerPos.sub(dog.position).normalize();
                return toWalker.mul(dog.frustration * 20);
            }

            return frustrationForce;
        }

        return Vec2.zero();
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
        this.isMale = Math.random() > 0.5;            // Affects marking frequency

        // Behavior state
        this.wanderAngle = Math.random() * Math.PI * 2;
        this.sniffTimer = 0;
        this.peeTimer = 0;                            // Timer for marking behavior
        this.currentBehavior = 'wander';              // Track current dominant behavior for UI

        // Social behavior state
        this.socializing = false;
        this.socializeTarget = null;
        this.socializeTimer = 0;

        // Tangle reaction state
        this.frustration = 0;                         // Builds when tangled (0-1)

        // Animation
        this.tailWag = 0;
        this.legCycle = Math.random(); // Offset leg animation

        // Vertical bounce (simulates 3D height from trotting gait)
        // This determines which leash is "over" vs "under" at crossings
        this.height = 0;                              // Current vertical offset
        this.bouncePhase = Math.random() * Math.PI * 2; // Random phase offset per dog
        this.bounceAmplitude = 5;                     // How much dogs bounce while trotting

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
     * @param {number} dt - Delta time
     * @param {Walker} walker - Walker entity
     * @param {Dog[]} otherDogs - Other dogs in simulation
     * @param {number} leashLength - Max leash length
     * @param {Array} tangles - Active tangle constraints (optional)
     */
    updateBehavior(dt, walker, otherDogs, leashLength, tangles = []) {
        // Handle pee timer (marking territory)
        if (this.peeTimer > 0) {
            this.peeTimer -= dt;
            this.state = 'marking';
            this.currentBehavior = 'pee';
            this.velocity.mulMut(0.1); // Almost stop while marking
            return;
        }

        // Handle sniff timer
        if (this.sniffTimer > 0) {
            this.sniffTimer -= dt;
            this.state = 'sniffing';
            this.currentBehavior = 'sniff';
            this.velocity.mulMut(0.9); // Slow down while sniffing
            return;
        }

        // Handle socializing
        if (this.socializing && this.socializeTarget) {
            this.state = 'socializing';
            this.currentBehavior = 'socialize';
            // Will continue in socialize behavior below
        }

        // Decay frustration over time when not tangled
        if (this.frustration > 0) {
            this.frustration = Math.max(0, this.frustration - 0.02 * dt);
        }

        // Calculate individual behavior forces for tracking dominant behavior
        const wanderForce = DogBehaviors.wander(this, dt).mul(DogBehaviors.WANDER);
        const followForce = DogBehaviors.followWalker(this, walker.getHandPosition(), leashLength).mul(DogBehaviors.FOLLOW_WALKER);
        const sniffForce = DogBehaviors.sniff(this, dt).mul(DogBehaviors.SNIFF);
        const pullForce = DogBehaviors.pull(this, walker.position, walker.walkDirection).mul(DogBehaviors.PULL);
        const avoidForce = DogBehaviors.avoidOtherDogs(this, otherDogs).mul(DogBehaviors.AVOID_OTHER_DOGS);
        const peeForce = DogBehaviors.pee(this, dt).mul(DogBehaviors.PEE);
        const socializeForce = DogBehaviors.socialize(this, otherDogs, dt).mul(DogBehaviors.SOCIALIZE);
        const tangleForce = DogBehaviors.reactToTangle(this, tangles, walker.position).mul(DogBehaviors.REACT_TANGLE);

        // Track dominant behavior based on force magnitude
        const behaviors = [
            { name: 'wander', force: wanderForce.length },
            { name: 'followWalker', force: followForce.length },
            { name: 'sniff', force: sniffForce.length },
            { name: 'pull', force: pullForce.length },
            { name: 'avoid', force: avoidForce.length },
            { name: 'pee', force: peeForce.length },
            { name: 'socialize', force: socializeForce.length },
            { name: 'react_tangle', force: tangleForce.length }
        ];

        // Find behavior with highest force
        let dominantBehavior = behaviors.reduce((max, b) => b.force > max.force ? b : max, behaviors[0]);

        // Override with special states
        if (this.peeTimer > 0) {
            this.currentBehavior = 'pee';
        } else if (this.socializing) {
            this.currentBehavior = 'socialize';
        } else if (this.frustration > 0.5) {
            this.currentBehavior = 'react_tangle';
        } else if (this.velocity.length < 3 && dominantBehavior.force < 10) {
            this.currentBehavior = 'idle';
        } else {
            this.currentBehavior = dominantBehavior.name;
        }

        // Accumulate behavior forces
        let force = Vec2.zero();
        force.addMut(wanderForce);
        force.addMut(followForce);
        force.addMut(sniffForce);
        force.addMut(pullForce);
        force.addMut(avoidForce);
        force.addMut(peeForce);
        force.addMut(socializeForce);
        force.addMut(tangleForce);

        // Apply force to velocity
        this.velocity.addMut(force.mul(dt * this.energy * 2));

        // Limit speed
        this.velocity.limitMut(this.maxSpeed * this.energy);

        // Update facing based on velocity
        if (this.velocity.length > 5) {
            this.targetFacing = this.velocity.angle;
        }
    }

    /**
     * Main update method
     * @param {number} dt - Delta time
     * @param {Walker} walker - Walker entity
     * @param {Dog[]} otherDogs - Other dogs
     * @param {number} leashLength - Max leash length
     * @param {Array} tangles - Active tangle constraints (optional)
     */
    update(dt, walker, otherDogs, leashLength, tangles = []) {
        this.updateBehavior(dt, walker, otherDogs, leashLength, tangles);
        super.update(dt);

        // Tail wag animation
        this.tailWag = Math.sin(this.animationTime * Math.PI * 4) * 0.5;

        // Leg cycle
        this.legCycle += dt * (this.velocity.length / 30);

        // Vertical bounce from trotting gait
        // Dogs bounce more when moving faster, creating natural over/under crossings
        const speed = this.velocity.length;
        const bounceFrequency = 8; // Bounce cycles per second when running
        this.bouncePhase += dt * bounceFrequency * (speed / this.maxSpeed + 0.3);

        // Bounce amplitude scales with speed (stationary dogs don't bounce)
        const dynamicAmplitude = this.bounceAmplitude * Math.min(1, speed / 50);
        this.height = Math.abs(Math.sin(this.bouncePhase)) * dynamicAmplitude;
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
