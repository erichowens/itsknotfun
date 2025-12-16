/**
 * Leash Demo - Close-up physics demonstration for Theory page
 * Shows 2-dog vs 3-dog comparison with thick rope rendering
 */

(function() {
    'use strict';

    // Colors matching the main renderer
    const LEASH_COLORS = {
        0: { main: '#ff9999', glow: 'rgba(255, 153, 153, 0.4)', name: 'Dog A' },
        1: { main: '#99ccff', glow: 'rgba(153, 204, 255, 0.4)', name: 'Dog B' },
        2: { main: '#99ff99', glow: 'rgba(153, 255, 153, 0.4)', name: 'Dog C' }
    };

    /**
     * Mini physics simulation for demo purposes
     */
    class MiniPhysics {
        constructor(numDogs) {
            this.numDogs = numDogs;
            this.particles = [];
            this.anchorPoint = { x: 0, y: 0 };
            this.time = 0;
            this.crossings = [];
            this.lastPositions = [];
        }

        init(centerX, centerY, radius) {
            this.anchorPoint = { x: centerX, y: centerY - radius * 0.3 };
            this.particles = [];
            this.crossings = [];
            this.lastPositions = [];

            // Create dog endpoints that will move in patterns
            const angleStep = (Math.PI * 2) / this.numDogs;
            for (let i = 0; i < this.numDogs; i++) {
                const angle = -Math.PI / 2 + angleStep * i;
                this.particles.push({
                    x: centerX + Math.cos(angle) * radius,
                    y: centerY + Math.sin(angle) * radius * 0.6,
                    baseAngle: angle,
                    radius: radius,
                    centerX: centerX,
                    centerY: centerY,
                    id: i,
                    // Movement parameters (different for each dog)
                    frequency: 0.5 + i * 0.3,
                    amplitude: 0.8 + i * 0.2,
                    phase: i * Math.PI * 2 / 3
                });
                this.lastPositions.push({ x: 0, y: 0 });
            }
        }

        update(dt) {
            this.time += dt;

            // Move dogs in wandering patterns
            for (let i = 0; i < this.particles.length; i++) {
                const p = this.particles[i];
                const lp = this.lastPositions[i];

                // Save last position for crossing detection
                lp.x = p.x;
                lp.y = p.y;

                // Create interesting movement patterns
                const wanderAngle = p.baseAngle +
                    Math.sin(this.time * p.frequency + p.phase) * p.amplitude +
                    Math.sin(this.time * 0.7 + p.phase * 2) * 0.3;

                const wanderRadius = p.radius * (0.7 + Math.sin(this.time * 0.3 + p.phase) * 0.3);

                p.x = p.centerX + Math.cos(wanderAngle) * wanderRadius;
                p.y = p.centerY + Math.sin(wanderAngle) * wanderRadius * 0.6;
            }

            // Detect crossings (simplified)
            this.detectCrossings();
        }

        detectCrossings() {
            // Check for line segment intersections between leashes
            for (let i = 0; i < this.particles.length; i++) {
                for (let j = i + 1; j < this.particles.length; j++) {
                    const crossing = this.checkCrossing(i, j);
                    if (crossing) {
                        // Check if we recently detected this crossing
                        const existingIdx = this.crossings.findIndex(c =>
                            c.leashA === i && c.leashB === j &&
                            this.time - c.time < 0.5
                        );

                        if (existingIdx === -1) {
                            crossing.time = this.time;
                            this.crossings.push(crossing);

                            // Keep only recent crossings
                            if (this.crossings.length > 10) {
                                this.crossings.shift();
                            }
                        }
                    }
                }
            }
        }

        checkCrossing(i, j) {
            // Simplified crossing detection using current positions
            const a1 = this.anchorPoint;
            const a2 = this.particles[i];
            const b1 = this.anchorPoint;
            const b2 = this.particles[j];

            // Check if segments intersect
            const d1 = this.direction(b1, b2, a1);
            const d2 = this.direction(b1, b2, a2);
            const d3 = this.direction(a1, a2, b1);
            const d4 = this.direction(a1, a2, b2);

            if (((d1 > 0 && d2 < 0) || (d1 < 0 && d2 > 0)) &&
                ((d3 > 0 && d4 < 0) || (d3 < 0 && d4 > 0))) {

                // Calculate intersection point
                const t = this.lineIntersection(a1, a2, b1, b2);
                if (t !== null) {
                    return {
                        leashA: i,
                        leashB: j,
                        point: {
                            x: a1.x + t * (a2.x - a1.x),
                            y: a1.y + t * (a2.y - a1.y)
                        },
                        isOver: i < j // Simplified: lower index is "over"
                    };
                }
            }
            return null;
        }

        direction(p1, p2, p3) {
            return (p3.x - p1.x) * (p2.y - p1.y) - (p2.x - p1.x) * (p3.y - p1.y);
        }

        lineIntersection(a1, a2, b1, b2) {
            const denom = (b2.y - b1.y) * (a2.x - a1.x) - (b2.x - b1.x) * (a2.y - a1.y);
            if (Math.abs(denom) < 0.0001) return null;

            const t = ((b2.x - b1.x) * (a1.y - b1.y) - (b2.y - b1.y) * (a1.x - b1.x)) / denom;
            if (t < 0.1 || t > 0.9) return null; // Ignore crossings too close to endpoints

            return t;
        }

        reset() {
            this.time = 0;
            this.crossings = [];
        }
    }

    /**
     * LeashDemo - Renders a close-up physics demo
     */
    class LeashDemo {
        constructor(canvas, options = {}) {
            this.canvas = canvas;
            this.ctx = canvas.getContext('2d');
            this.numDogs = options.numDogs || 3;
            this.ropeThickness = options.ropeThickness || 8;
            this.speed = options.speed || 0.5; // Slow motion by default

            this.physics = new MiniPhysics(this.numDogs);
            this.isRunning = false;
            this.animationId = null;
            this.lastTime = 0;
            this.crossingCount = 0;
            this.braidWord = 'ε';
            this.braidOps = [];

            this.setupCanvas();
            this.physics.init(
                this.canvas.width / 2,
                this.canvas.height * 0.6,
                Math.min(this.canvas.width, this.canvas.height) * 0.35
            );
        }

        setupCanvas() {
            const size = 280;
            this.canvas.width = size;
            this.canvas.height = size;
            this.canvas.style.width = size + 'px';
            this.canvas.style.height = size + 'px';
        }

        start() {
            if (this.isRunning) return;
            this.isRunning = true;
            this.lastTime = performance.now();
            this.animate();
        }

        stop() {
            this.isRunning = false;
            if (this.animationId) {
                cancelAnimationFrame(this.animationId);
                this.animationId = null;
            }
        }

        reset() {
            this.stop();
            this.physics.reset();
            this.crossingCount = 0;
            this.braidWord = 'ε';
            this.braidOps = [];
            this.render();
        }

        animate() {
            if (!this.isRunning) return;

            const currentTime = performance.now();
            const dt = ((currentTime - this.lastTime) / 1000) * this.speed;
            this.lastTime = currentTime;

            // Update physics
            const prevCrossingCount = this.physics.crossings.length;
            this.physics.update(dt);

            // Check for new crossings
            if (this.physics.crossings.length > prevCrossingCount) {
                const newCrossing = this.physics.crossings[this.physics.crossings.length - 1];
                this.addCrossing(newCrossing);
            }

            // Render
            this.render();

            this.animationId = requestAnimationFrame(() => this.animate());
        }

        addCrossing(crossing) {
            this.crossingCount++;

            // Build braid word (simplified for demo)
            const generator = crossing.leashA < crossing.leashB ?
                (crossing.leashA + 1) : -(crossing.leashA + 1);

            this.braidOps.push(generator);
            this.updateBraidWord();
        }

        updateBraidWord() {
            if (this.braidOps.length === 0) {
                this.braidWord = 'ε';
                return;
            }

            // Show last 4 operations
            const ops = this.braidOps.slice(-4);
            this.braidWord = ops.map(op => {
                const abs = Math.abs(op);
                const sub = String.fromCharCode(0x2080 + abs);
                return op > 0 ? 'σ' + sub : 'σ' + sub + '⁻¹';
            }).join('');

            if (this.braidOps.length > 4) {
                this.braidWord = '...' + this.braidWord;
            }
        }

        render() {
            const ctx = this.ctx;
            const width = this.canvas.width;
            const height = this.canvas.height;

            // Clear with chalkboard background
            ctx.fillStyle = '#2a4a3a';
            ctx.fillRect(0, 0, width, height);

            // Add subtle grid
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
            ctx.lineWidth = 1;
            const gridSize = 20;
            for (let x = 0; x < width; x += gridSize) {
                ctx.beginPath();
                ctx.moveTo(x, 0);
                ctx.lineTo(x, height);
                ctx.stroke();
            }
            for (let y = 0; y < height; y += gridSize) {
                ctx.beginPath();
                ctx.moveTo(0, y);
                ctx.lineTo(width, y);
                ctx.stroke();
            }

            // Draw title
            ctx.font = 'bold 16px Arial, sans-serif';
            ctx.fillStyle = '#e8e4dc';
            ctx.textAlign = 'center';
            ctx.fillText(`${this.numDogs} Dog${this.numDogs > 1 ? 's' : ''}`, width / 2, 22);

            // Draw anchor point (walker's hand)
            const anchor = this.physics.anchorPoint;
            ctx.fillStyle = '#e8e4dc';
            ctx.beginPath();
            ctx.arc(anchor.x, anchor.y, 8, 0, Math.PI * 2);
            ctx.fill();
            ctx.strokeStyle = '#c0c0c0';
            ctx.lineWidth = 2;
            ctx.stroke();

            // Draw leashes (thick ropes)
            for (let i = 0; i < this.physics.particles.length; i++) {
                this.drawLeash(i);
            }

            // Draw crossing highlights
            const recentCrossings = this.physics.crossings.filter(c =>
                this.physics.time - c.time < 1.5
            );
            for (const crossing of recentCrossings) {
                this.drawCrossingHighlight(crossing);
            }

            // Draw dogs
            for (let i = 0; i < this.physics.particles.length; i++) {
                this.drawDog(i);
            }

            // Draw stats
            ctx.font = '12px "Special Elite", monospace';
            ctx.fillStyle = '#e8e4dc';
            ctx.textAlign = 'left';
            ctx.fillText(`Crossings: ${this.crossingCount}`, 10, height - 30);
            ctx.fillText(`Word: ${this.braidWord}`, 10, height - 12);
        }

        drawLeash(index) {
            const ctx = this.ctx;
            const particle = this.physics.particles[index];
            const anchor = this.physics.anchorPoint;
            const color = LEASH_COLORS[index];

            // Draw glow
            ctx.strokeStyle = color.glow;
            ctx.lineWidth = this.ropeThickness + 6;
            ctx.lineCap = 'round';
            ctx.beginPath();
            ctx.moveTo(anchor.x, anchor.y);
            ctx.lineTo(particle.x, particle.y);
            ctx.stroke();

            // Draw shadow
            ctx.strokeStyle = 'rgba(0, 0, 0, 0.3)';
            ctx.lineWidth = this.ropeThickness + 2;
            ctx.beginPath();
            ctx.moveTo(anchor.x + 2, anchor.y + 2);
            ctx.lineTo(particle.x + 2, particle.y + 2);
            ctx.stroke();

            // Draw main rope
            ctx.strokeStyle = color.main;
            ctx.lineWidth = this.ropeThickness;
            ctx.beginPath();
            ctx.moveTo(anchor.x, anchor.y);
            ctx.lineTo(particle.x, particle.y);
            ctx.stroke();

            // Draw highlight (gives 3D effect)
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.moveTo(anchor.x - 2, anchor.y - 2);
            ctx.lineTo(particle.x - 2, particle.y - 2);
            ctx.stroke();
        }

        drawDog(index) {
            const ctx = this.ctx;
            const particle = this.physics.particles[index];
            const color = LEASH_COLORS[index];

            // Dog body (circle with color)
            ctx.fillStyle = color.main;
            ctx.strokeStyle = '#e8e4dc';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.arc(particle.x, particle.y, 12, 0, Math.PI * 2);
            ctx.fill();
            ctx.stroke();

            // Dog label
            ctx.fillStyle = '#2a4a3a';
            ctx.font = 'bold 14px Arial, sans-serif';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(String.fromCharCode(65 + index), particle.x, particle.y);
        }

        drawCrossingHighlight(crossing) {
            const ctx = this.ctx;
            const age = this.physics.time - crossing.time;
            const alpha = Math.max(0, 1 - age / 1.5);

            // Animated ring
            const radius = 15 + age * 10;
            ctx.strokeStyle = `rgba(255, 221, 68, ${alpha})`;
            ctx.lineWidth = 3;
            ctx.beginPath();
            ctx.arc(crossing.point.x, crossing.point.y, radius, 0, Math.PI * 2);
            ctx.stroke();

            // Central dot
            if (age < 0.5) {
                ctx.fillStyle = '#ffdd44';
                ctx.beginPath();
                ctx.arc(crossing.point.x, crossing.point.y, 6, 0, Math.PI * 2);
                ctx.fill();
            }
        }
    }

    /**
     * PhysicsComparison - Side-by-side 2-dog vs 3-dog demo
     */
    class PhysicsComparison {
        constructor(container) {
            this.container = container;
            this.demos = [];
            this.setup();
        }

        setup() {
            this.container.innerHTML = `
                <div class="physics-comparison">
                    <div class="physics-panel">
                        <canvas id="physics-demo-2"></canvas>
                        <div class="physics-controls">
                            <button class="viz-btn" data-action="start">▶ Start</button>
                            <button class="viz-btn" data-action="stop">⏸ Stop</button>
                            <button class="viz-btn" data-action="reset">↺ Reset</button>
                        </div>
                        <p class="physics-insight">Leashes can always untangle by<br>reversing direction</p>
                    </div>
                    <div class="physics-panel">
                        <canvas id="physics-demo-3"></canvas>
                        <div class="physics-controls">
                            <button class="viz-btn" data-action="start">▶ Start</button>
                            <button class="viz-btn" data-action="stop">⏸ Stop</button>
                            <button class="viz-btn" data-action="reset">↺ Reset</button>
                        </div>
                        <p class="physics-insight">Order matters! Crossings can<br>lock into complex tangles</p>
                    </div>
                </div>
                <button class="viz-btn physics-both-btn">▶ Run Both Demos</button>
            `;

            // Create demos
            this.demos = [
                new LeashDemo(document.getElementById('physics-demo-2'), { numDogs: 2 }),
                new LeashDemo(document.getElementById('physics-demo-3'), { numDogs: 3 })
            ];

            // Initial render
            this.demos.forEach(d => d.render());

            // Event listeners
            this.container.querySelectorAll('.physics-panel').forEach((panel, idx) => {
                panel.querySelectorAll('.viz-btn').forEach(btn => {
                    btn.addEventListener('click', () => {
                        const action = btn.dataset.action;
                        const demo = this.demos[idx];
                        if (action === 'start') demo.start();
                        else if (action === 'stop') demo.stop();
                        else if (action === 'reset') demo.reset();
                    });
                });
            });

            // Both button
            this.container.querySelector('.physics-both-btn').addEventListener('click', () => {
                this.demos.forEach(d => {
                    d.reset();
                    d.start();
                });
            });
        }

        destroy() {
            this.demos.forEach(d => d.stop());
        }
    }

    // Export
    window.LeashDemo = {
        LeashDemo,
        PhysicsComparison
    };

    // Auto-initialize
    document.addEventListener('DOMContentLoaded', () => {
        const container = document.getElementById('physics-demo-container');
        if (container) {
            new PhysicsComparison(container);
        }
    });

})();
