/**
 * Braid Theory Implementation for Three-Dog Leash Tracking
 *
 * The braid group B₃ has two generators:
 * - σ₁: Dog B crosses over Dog A
 * - σ₂: Dog C crosses over Dog B
 *
 * With the Yang-Baxter relation: σ₁σ₂σ₁ = σ₂σ₁σ₂
 *
 * This module tracks crossings, builds braid words, and computes complexity metrics.
 */

/**
 * Represents a single crossing event
 */
class Crossing {
    constructor(generator, sign, timestamp) {
        // generator: 1 for σ₁ (dogs A-B), 2 for σ₂ (dogs B-C)
        this.generator = generator;
        // sign: 1 for over (+), -1 for under (inverse)
        this.sign = sign;
        // When this crossing occurred
        this.timestamp = timestamp;
    }

    /**
     * Get the inverse of this crossing
     */
    inverse() {
        return new Crossing(this.generator, -this.sign, this.timestamp);
    }

    /**
     * Check if this crossing cancels with another
     */
    cancels(other) {
        return this.generator === other.generator && this.sign === -other.sign;
    }

    /**
     * String representation using mathematical notation
     */
    toString() {
        const base = this.generator === 1 ? 'σ₁' : 'σ₂';
        return this.sign > 0 ? base : `${base}⁻¹`;
    }

    /**
     * Short string for display
     */
    toShortString() {
        const base = this.generator === 1 ? 'σ1' : 'σ2';
        return this.sign > 0 ? base : `${base}^-1`;
    }

    /**
     * Human-readable description
     */
    describe(dogNames = ['A', 'B', 'C']) {
        if (this.generator === 1) {
            return this.sign > 0
                ? `${dogNames[1]} crosses OVER ${dogNames[0]}`
                : `${dogNames[1]} crosses UNDER ${dogNames[0]}`;
        } else {
            return this.sign > 0
                ? `${dogNames[2]} crosses OVER ${dogNames[1]}`
                : `${dogNames[2]} crosses UNDER ${dogNames[1]}`;
        }
    }
}

/**
 * A braid word is a sequence of crossings
 */
class BraidWord {
    constructor(crossings = []) {
        this.crossings = [...crossings];
    }

    /**
     * Add a crossing to the word
     */
    append(crossing) {
        this.crossings.push(crossing);
        return this;
    }

    /**
     * Get the length (number of generators)
     */
    get length() {
        return this.crossings.length;
    }

    /**
     * Check if the braid is trivial (identity)
     */
    get isTrivial() {
        return this.crossings.length === 0;
    }

    /**
     * Calculate the writhe (signed sum of crossings)
     * Positive crossings contribute +1, negative contribute -1
     */
    get writhe() {
        return this.crossings.reduce((sum, c) => sum + c.sign, 0);
    }

    /**
     * Calculate complexity metric
     * Simple version: absolute writhe + word length penalty
     */
    get complexity() {
        const absWrithe = Math.abs(this.writhe);
        // Word length matters more when writhe is low
        // (could be many crossings that mostly cancel)
        return absWrithe + Math.floor(this.length / 2);
    }

    /**
     * Get string representation
     */
    toString() {
        if (this.crossings.length === 0) return 'ε'; // Identity
        return this.crossings.map(c => c.toString()).join('·');
    }

    /**
     * Get shortened string for display (last N crossings)
     */
    toDisplayString(maxLength = 8) {
        if (this.crossings.length === 0) return 'ε';
        if (this.crossings.length <= maxLength) {
            return this.crossings.map(c => c.toString()).join('·');
        }
        const lastN = this.crossings.slice(-maxLength);
        return '...' + lastN.map(c => c.toString()).join('·');
    }

    /**
     * Clone this braid word
     */
    clone() {
        return new BraidWord(this.crossings.map(c =>
            new Crossing(c.generator, c.sign, c.timestamp)
        ));
    }

    /**
     * Perform simple reductions (cancel adjacent inverses)
     * Returns a new simplified BraidWord
     */
    simplify() {
        if (this.crossings.length < 2) return this.clone();

        const result = [];

        for (const crossing of this.crossings) {
            if (result.length > 0 && result[result.length - 1].cancels(crossing)) {
                // Cancel with previous
                result.pop();
            } else {
                result.push(new Crossing(crossing.generator, crossing.sign, crossing.timestamp));
            }
        }

        return new BraidWord(result);
    }

    /**
     * Apply the Yang-Baxter relation once if possible
     * σ₁σ₂σ₁ ↔ σ₂σ₁σ₂
     * Returns true if a substitution was made
     */
    applyYangBaxter() {
        for (let i = 0; i < this.crossings.length - 2; i++) {
            const a = this.crossings[i];
            const b = this.crossings[i + 1];
            const c = this.crossings[i + 2];

            // Check for σ₁σ₂σ₁ pattern (all same sign)
            if (a.generator === 1 && b.generator === 2 && c.generator === 1 &&
                a.sign === b.sign && b.sign === c.sign) {
                // Replace with σ₂σ₁σ₂
                this.crossings[i] = new Crossing(2, a.sign, a.timestamp);
                this.crossings[i + 1] = new Crossing(1, b.sign, b.timestamp);
                this.crossings[i + 2] = new Crossing(2, c.sign, c.timestamp);
                return true;
            }

            // Check for σ₂σ₁σ₂ pattern
            if (a.generator === 2 && b.generator === 1 && c.generator === 2 &&
                a.sign === b.sign && b.sign === c.sign) {
                // Replace with σ₁σ₂σ₁
                this.crossings[i] = new Crossing(1, a.sign, a.timestamp);
                this.crossings[i + 1] = new Crossing(2, b.sign, b.timestamp);
                this.crossings[i + 2] = new Crossing(1, c.sign, c.timestamp);
                return true;
            }
        }
        return false;
    }

    /**
     * Full reduction using free group cancellation and Yang-Baxter
     * This is a simplified version - full Garside normal form is more complex
     */
    reduce() {
        let current = this.clone();
        let iterations = 0;
        const maxIterations = 100; // Prevent infinite loops

        while (iterations < maxIterations) {
            const beforeLength = current.length;

            // First simplify (cancel inverses)
            current = current.simplify();

            // Then try Yang-Baxter (might expose new cancellations)
            current.applyYangBaxter();

            // If no change, we're done
            if (current.length === beforeLength) break;
            iterations++;
        }

        return current;
    }
}

/**
 * Tracks the braid state for three dogs over time
 */
class BraidTracker {
    constructor(dogNames = ['A', 'B', 'C']) {
        this.dogNames = dogNames;
        this.braidWord = new BraidWord();
        this.eventLog = [];
        this.startTime = Date.now();

        // Map rope IDs to dog indices (0=A, 1=B, 2=C)
        this.ropeToDoag = new Map();

        // Debounce crossings to avoid multiple detections
        this.lastCrossing = null;
        this.crossingCooldown = 200; // ms
    }

    /**
     * Register a rope with a dog index
     */
    registerRope(ropeId, dogIndex) {
        this.ropeToDoag.set(ropeId, dogIndex);
    }

    /**
     * Get elapsed time in seconds
     */
    getElapsedTime() {
        return (Date.now() - this.startTime) / 1000;
    }

    /**
     * Record a crossing event
     * @param ropeA - First rope involved
     * @param ropeB - Second rope involved
     * @param sign - Positive (over) or negative (under)
     */
    recordCrossing(ropeIdA, ropeIdB, sign) {
        const now = Date.now();

        // Debounce
        if (this.lastCrossing) {
            const timeSinceLast = now - this.lastCrossing.time;
            if (timeSinceLast < this.crossingCooldown &&
                this.lastCrossing.ropeA === ropeIdA &&
                this.lastCrossing.ropeB === ropeIdB) {
                return null;
            }
        }

        const dogA = this.ropeToDoag.get(ropeIdA);
        const dogB = this.ropeToDoag.get(ropeIdB);

        if (dogA === undefined || dogB === undefined) {
            console.warn('Unknown rope IDs:', ropeIdA, ropeIdB);
            return null;
        }

        // Determine which generator this is
        // σ₁: dogs 0-1 (A-B)
        // σ₂: dogs 1-2 (B-C)
        const sortedDogs = [dogA, dogB].sort((a, b) => a - b);
        let generator;

        if (sortedDogs[0] === 0 && sortedDogs[1] === 1) {
            generator = 1; // σ₁
        } else if (sortedDogs[0] === 1 && sortedDogs[1] === 2) {
            generator = 2; // σ₂
        } else if (sortedDogs[0] === 0 && sortedDogs[1] === 2) {
            // Dogs A and C crossing - this would be σ₁σ₂ or σ₂σ₁
            // For simplicity, we track it as affecting B's position
            // In reality, this is more complex topologically
            generator = 1; // Approximate
            console.log('A-C crossing detected, approximating as σ₁');
        } else {
            console.warn('Invalid dog pair:', sortedDogs);
            return null;
        }

        const timestamp = this.getElapsedTime();
        const crossing = new Crossing(generator, sign, timestamp);

        this.braidWord.append(crossing);
        this.lastCrossing = { time: now, ropeA: ropeIdA, ropeB: ropeIdB };

        // Log event
        const event = {
            time: timestamp,
            crossing: crossing,
            description: crossing.describe(this.dogNames)
        };
        this.eventLog.push(event);

        return event;
    }

    /**
     * Get current stats
     */
    getStats() {
        const simplified = this.braidWord.reduce();
        return {
            totalCrossings: this.braidWord.length,
            simplifiedLength: simplified.length,
            writhe: this.braidWord.writhe,
            complexity: simplified.complexity,
            braidWord: this.braidWord.toDisplayString(12),
            simplifiedWord: simplified.toDisplayString(12),
            isTrivial: simplified.isTrivial
        };
    }

    /**
     * Get recent events for display
     */
    getRecentEvents(count = 10) {
        return this.eventLog.slice(-count).reverse();
    }

    /**
     * Reset the tracker
     */
    reset() {
        this.braidWord = new BraidWord();
        this.eventLog = [];
        this.startTime = Date.now();
        this.lastCrossing = null;
    }

    /**
     * Check if currently tangled (non-trivial after reduction)
     */
    isTangled() {
        return !this.braidWord.reduce().isTrivial;
    }

    /**
     * Get the sequence of moves needed to untangle
     * (Simple version: just reverse the word)
     */
    getUntangleSequence() {
        const reduced = this.braidWord.reduce();
        const inverse = [];

        // Reverse and invert each crossing
        for (let i = reduced.crossings.length - 1; i >= 0; i--) {
            inverse.push(reduced.crossings[i].inverse());
        }

        return new BraidWord(inverse);
    }
}

/**
 * Crossing detector that works with PhysicsWorld
 */
class CrossingDetector {
    constructor(braidTracker) {
        this.tracker = braidTracker;
        this.previousIntersections = new Set();
    }

    /**
     * Create a unique key for an intersection
     */
    makeKey(ropeIdA, ropeIdB, segA, segB) {
        // Ensure consistent ordering
        if (ropeIdA > ropeIdB || (ropeIdA === ropeIdB && segA > segB)) {
            return `${ropeIdB}-${ropeIdA}-${segB}-${segA}`;
        }
        return `${ropeIdA}-${ropeIdB}-${segA}-${segB}`;
    }

    /**
     * Handle crossing callback from physics
     */
    onCrossing(ropeA, ropeB, segIdxA, segIdxB, sign, point) {
        const key = this.makeKey(ropeA.id, ropeB.id, segIdxA, segIdxB);

        // Only record if this is a NEW intersection
        if (!this.previousIntersections.has(key)) {
            this.previousIntersections.add(key);
            return this.tracker.recordCrossing(ropeA.id, ropeB.id, sign);
        }

        return null;
    }

    /**
     * Clear an intersection when segments separate
     */
    clearIntersection(ropeIdA, ropeIdB, segIdxA, segIdxB) {
        const key = this.makeKey(ropeIdA, ropeIdB, segIdxA, segIdxB);
        this.previousIntersections.delete(key);
    }

    /**
     * Reset detector state
     */
    reset() {
        this.previousIntersections.clear();
    }
}

// Export
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { Crossing, BraidWord, BraidTracker, CrossingDetector };
} else {
    window.Crossing = Crossing;
    window.BraidWord = BraidWord;
    window.BraidTracker = BraidTracker;
    window.CrossingDetector = CrossingDetector;
}
