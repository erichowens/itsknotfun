/**
 * Vector2D - Lightweight 2D vector math for physics simulation
 * Immutable operations return new vectors; mutable operations modify in place
 */

class Vec2 {
    constructor(x = 0, y = 0) {
        this.x = x;
        this.y = y;
    }

    // Factory methods
    static zero() { return new Vec2(0, 0); }
    static one() { return new Vec2(1, 1); }
    static up() { return new Vec2(0, -1); }
    static down() { return new Vec2(0, 1); }
    static left() { return new Vec2(-1, 0); }
    static right() { return new Vec2(1, 0); }

    static fromAngle(angle, magnitude = 1) {
        return new Vec2(Math.cos(angle) * magnitude, Math.sin(angle) * magnitude);
    }

    static random(minX = -1, maxX = 1, minY = -1, maxY = 1) {
        return new Vec2(
            minX + Math.random() * (maxX - minX),
            minY + Math.random() * (maxY - minY)
        );
    }

    static randomUnit() {
        const angle = Math.random() * Math.PI * 2;
        return Vec2.fromAngle(angle);
    }

    // Clone
    clone() {
        return new Vec2(this.x, this.y);
    }

    copy(other) {
        this.x = other.x;
        this.y = other.y;
        return this;
    }

    set(x, y) {
        this.x = x;
        this.y = y;
        return this;
    }

    // Immutable operations (return new vectors)
    add(other) {
        return new Vec2(this.x + other.x, this.y + other.y);
    }

    sub(other) {
        return new Vec2(this.x - other.x, this.y - other.y);
    }

    mul(scalar) {
        return new Vec2(this.x * scalar, this.y * scalar);
    }

    div(scalar) {
        if (scalar === 0) return Vec2.zero();
        return new Vec2(this.x / scalar, this.y / scalar);
    }

    negate() {
        return new Vec2(-this.x, -this.y);
    }

    // Mutable operations (modify in place, return this for chaining)
    addMut(other) {
        this.x += other.x;
        this.y += other.y;
        return this;
    }

    subMut(other) {
        this.x -= other.x;
        this.y -= other.y;
        return this;
    }

    mulMut(scalar) {
        this.x *= scalar;
        this.y *= scalar;
        return this;
    }

    divMut(scalar) {
        if (scalar !== 0) {
            this.x /= scalar;
            this.y /= scalar;
        }
        return this;
    }

    negateMut() {
        this.x = -this.x;
        this.y = -this.y;
        return this;
    }

    // Properties
    get length() {
        return Math.sqrt(this.x * this.x + this.y * this.y);
    }

    get lengthSquared() {
        return this.x * this.x + this.y * this.y;
    }

    get angle() {
        return Math.atan2(this.y, this.x);
    }

    // Normalization
    normalize() {
        const len = this.length;
        if (len === 0) return Vec2.zero();
        return this.div(len);
    }

    normalizeMut() {
        const len = this.length;
        if (len > 0) {
            this.x /= len;
            this.y /= len;
        }
        return this;
    }

    setLength(newLength) {
        return this.normalize().mul(newLength);
    }

    setLengthMut(newLength) {
        this.normalizeMut().mulMut(newLength);
        return this;
    }

    limit(maxLength) {
        if (this.lengthSquared > maxLength * maxLength) {
            return this.setLength(maxLength);
        }
        return this.clone();
    }

    limitMut(maxLength) {
        if (this.lengthSquared > maxLength * maxLength) {
            this.setLengthMut(maxLength);
        }
        return this;
    }

    // Products
    dot(other) {
        return this.x * other.x + this.y * other.y;
    }

    // 2D cross product (returns scalar - z component of 3D cross)
    cross(other) {
        return this.x * other.y - this.y * other.x;
    }

    // Distance
    distanceTo(other) {
        const dx = other.x - this.x;
        const dy = other.y - this.y;
        return Math.sqrt(dx * dx + dy * dy);
    }

    distanceToSquared(other) {
        const dx = other.x - this.x;
        const dy = other.y - this.y;
        return dx * dx + dy * dy;
    }

    // Interpolation
    lerp(other, t) {
        return new Vec2(
            this.x + (other.x - this.x) * t,
            this.y + (other.y - this.y) * t
        );
    }

    lerpMut(other, t) {
        this.x += (other.x - this.x) * t;
        this.y += (other.y - this.y) * t;
        return this;
    }

    // Rotation
    rotate(angle) {
        const cos = Math.cos(angle);
        const sin = Math.sin(angle);
        return new Vec2(
            this.x * cos - this.y * sin,
            this.x * sin + this.y * cos
        );
    }

    rotateMut(angle) {
        const cos = Math.cos(angle);
        const sin = Math.sin(angle);
        const newX = this.x * cos - this.y * sin;
        const newY = this.x * sin + this.y * cos;
        this.x = newX;
        this.y = newY;
        return this;
    }

    // Perpendicular (90 degrees counter-clockwise)
    perpendicular() {
        return new Vec2(-this.y, this.x);
    }

    // Reflection off a surface with given normal
    reflect(normal) {
        const d = this.dot(normal) * 2;
        return this.sub(normal.mul(d));
    }

    // Project this vector onto another
    projectOnto(other) {
        const otherLenSq = other.lengthSquared;
        if (otherLenSq === 0) return Vec2.zero();
        return other.mul(this.dot(other) / otherLenSq);
    }

    // Comparison
    equals(other, epsilon = 0.0001) {
        return Math.abs(this.x - other.x) < epsilon &&
               Math.abs(this.y - other.y) < epsilon;
    }

    isZero(epsilon = 0.0001) {
        return Math.abs(this.x) < epsilon && Math.abs(this.y) < epsilon;
    }

    // String representation
    toString() {
        return `Vec2(${this.x.toFixed(2)}, ${this.y.toFixed(2)})`;
    }

    // Array conversion
    toArray() {
        return [this.x, this.y];
    }

    static fromArray(arr) {
        return new Vec2(arr[0], arr[1]);
    }
}

/**
 * Segment utilities for line segment math
 * Critical for rope collision and crossing detection
 */
const Segment = {
    /**
     * Find the closest point on segment AB to point P
     */
    closestPointOnSegment(a, b, p) {
        const ab = b.sub(a);
        const ap = p.sub(a);
        const abLenSq = ab.lengthSquared;

        if (abLenSq === 0) return a.clone();

        let t = ap.dot(ab) / abLenSq;
        t = Math.max(0, Math.min(1, t));

        return a.add(ab.mul(t));
    },

    /**
     * Distance from point P to segment AB
     */
    pointToSegmentDistance(a, b, p) {
        const closest = this.closestPointOnSegment(a, b, p);
        return p.distanceTo(closest);
    },

    /**
     * Shortest distance between two line segments
     * Returns { distance, pointOnSeg1, pointOnSeg2, t1, t2 }
     */
    segmentToSegmentDistance(p1, p2, q1, q2) {
        const u = p2.sub(p1);
        const v = q2.sub(q1);
        const w = p1.sub(q1);

        const a = u.dot(u);
        const b = u.dot(v);
        const c = v.dot(v);
        const d = u.dot(w);
        const e = v.dot(w);

        const denom = a * c - b * b;
        let s, t;

        if (denom < 1e-10) {
            // Segments are nearly parallel
            s = 0;
            t = d > b ? d / b : 0;
        } else {
            s = (b * e - c * d) / denom;
            t = (a * e - b * d) / denom;
        }

        // Clamp to [0, 1]
        s = Math.max(0, Math.min(1, s));
        t = Math.max(0, Math.min(1, t));

        // Recompute closest points
        const closestOnP = p1.add(u.mul(s));
        const closestOnQ = q1.add(v.mul(t));

        return {
            distance: closestOnP.distanceTo(closestOnQ),
            pointOnSeg1: closestOnP,
            pointOnSeg2: closestOnQ,
            t1: s,
            t2: t
        };
    },

    /**
     * Check if two segments intersect
     * Returns { intersects, point, t1, t2 } or { intersects: false }
     */
    segmentIntersection(p1, p2, q1, q2) {
        const r = p2.sub(p1);
        const s = q2.sub(q1);
        const qp = q1.sub(p1);

        const rxs = r.cross(s);
        const qpxr = qp.cross(r);

        // Parallel or collinear
        if (Math.abs(rxs) < 1e-10) {
            return { intersects: false };
        }

        const t = qp.cross(s) / rxs;
        const u = qpxr / rxs;

        if (t >= 0 && t <= 1 && u >= 0 && u <= 1) {
            return {
                intersects: true,
                point: p1.add(r.mul(t)),
                t1: t,
                t2: u
            };
        }

        return { intersects: false };
    },

    /**
     * Determine crossing orientation (which segment goes "over")
     * Returns 1 if seg1 goes over seg2 at intersection, -1 otherwise
     * Uses segment indices as proxy for vertical ordering
     */
    crossingSign(seg1Idx, seg2Idx, intersection) {
        // In our 2D top-down view, we use segment index as a proxy
        // Lower index = closer to walker = "on top" when crossing
        return seg1Idx < seg2Idx ? 1 : -1;
    }
};

// Export for module systems, attach to window for browser
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { Vec2, Segment };
} else {
    window.Vec2 = Vec2;
    window.Segment = Segment;
}
