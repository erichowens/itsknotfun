/**
 * Knot3D - Deterministic 3D braid/knot visualization
 * Creates smooth 3D tube rendering with proper over/under crossings
 */

(function() {
    'use strict';

    // Strand colors
    const STRAND_COLORS = [
        { main: '#e74c3c', light: '#ff6b5b', dark: '#a93226' }, // Red
        { main: '#27ae60', light: '#4cd787', dark: '#1e8449' }, // Green
        { main: '#3498db', light: '#5dade2', dark: '#2471a3' }  // Blue
    ];

    /**
     * 3D Vector utilities
     */
    const Vec3 = {
        create: (x = 0, y = 0, z = 0) => ({ x, y, z }),
        add: (a, b) => ({ x: a.x + b.x, y: a.y + b.y, z: a.z + b.z }),
        sub: (a, b) => ({ x: a.x - b.x, y: a.y - b.y, z: a.z - b.z }),
        scale: (v, s) => ({ x: v.x * s, y: v.y * s, z: v.z * s }),
        lerp: (a, b, t) => ({
            x: a.x + (b.x - a.x) * t,
            y: a.y + (b.y - a.y) * t,
            z: a.z + (b.z - a.z) * t
        }),
        length: (v) => Math.sqrt(v.x * v.x + v.y * v.y + v.z * v.z),
        normalize: (v) => {
            const len = Vec3.length(v);
            return len > 0 ? Vec3.scale(v, 1 / len) : { x: 0, y: 1, z: 0 };
        },
        cross: (a, b) => ({
            x: a.y * b.z - a.z * b.y,
            y: a.z * b.x - a.x * b.z,
            z: a.x * b.y - a.y * b.x
        }),
        dot: (a, b) => a.x * b.x + a.y * b.y + a.z * b.z
    };

    /**
     * Generate smooth 3D braid paths from a braid word
     */
    class BraidPathGenerator {
        constructor(numStrands = 3) {
            this.numStrands = numStrands;
            this.strandSpacing = 40;
            this.crossingHeight = 60;
            this.depthOffset = 30; // Z offset for over/under
        }

        /**
         * Generate 3D paths for a braid word
         * @param {number[]} operations - Array of generators (1, -1, 2, -2, etc.)
         * @returns {Array} Array of strand path objects
         */
        generatePaths(operations) {
            const paths = [];

            // Initialize strand positions
            const positions = [];
            for (let i = 0; i < this.numStrands; i++) {
                positions.push(i);
                paths.push({
                    strandId: i,
                    points: [],
                    color: STRAND_COLORS[i]
                });
            }

            const startY = 0;
            const totalHeight = (operations.length + 1) * this.crossingHeight;

            // Starting points
            for (let i = 0; i < this.numStrands; i++) {
                const x = (i - (this.numStrands - 1) / 2) * this.strandSpacing;
                paths[i].points.push(Vec3.create(x, startY, 0));
            }

            // Process each operation
            for (let opIdx = 0; opIdx < operations.length; opIdx++) {
                const op = operations[opIdx];
                const y1 = startY + opIdx * this.crossingHeight;
                const y2 = startY + (opIdx + 1) * this.crossingHeight;
                const yMid = (y1 + y2) / 2;

                const leftSlot = Math.abs(op) - 1;
                const rightSlot = leftSlot + 1;
                const isOver = op > 0; // Positive = left goes over

                // Find which strands are in these slots
                let leftStrand = -1, rightStrand = -1;
                for (let i = 0; i < this.numStrands; i++) {
                    if (positions[i] === leftSlot) leftStrand = i;
                    if (positions[i] === rightSlot) rightStrand = i;
                }

                // Generate points for each strand
                for (let i = 0; i < this.numStrands; i++) {
                    const currentSlot = positions[i];
                    const currentX = (currentSlot - (this.numStrands - 1) / 2) * this.strandSpacing;

                    if (i === leftStrand) {
                        // Left strand crosses to right
                        const newSlot = rightSlot;
                        const newX = (newSlot - (this.numStrands - 1) / 2) * this.strandSpacing;
                        const midX = (currentX + newX) / 2;

                        // Add intermediate points for smooth curve
                        paths[i].points.push(Vec3.create(currentX, y1 + this.crossingHeight * 0.2, 0));
                        paths[i].points.push(Vec3.create(
                            midX,
                            yMid,
                            isOver ? this.depthOffset : -this.depthOffset
                        ));
                        paths[i].points.push(Vec3.create(newX, y2 - this.crossingHeight * 0.2, 0));

                        positions[i] = newSlot;
                    } else if (i === rightStrand) {
                        // Right strand crosses to left
                        const newSlot = leftSlot;
                        const newX = (newSlot - (this.numStrands - 1) / 2) * this.strandSpacing;
                        const midX = (currentX + newX) / 2;

                        paths[i].points.push(Vec3.create(currentX, y1 + this.crossingHeight * 0.2, 0));
                        paths[i].points.push(Vec3.create(
                            midX,
                            yMid,
                            isOver ? -this.depthOffset : this.depthOffset
                        ));
                        paths[i].points.push(Vec3.create(newX, y2 - this.crossingHeight * 0.2, 0));

                        positions[i] = newSlot;
                    } else {
                        // Strand goes straight
                        paths[i].points.push(Vec3.create(currentX, y2, 0));
                    }
                }
            }

            // Add ending points
            for (let i = 0; i < this.numStrands; i++) {
                const lastPoint = paths[i].points[paths[i].points.length - 1];
                paths[i].points.push(Vec3.create(lastPoint.x, totalHeight, 0));
            }

            return paths;
        }

        /**
         * Interpolate path to get smooth curves
         */
        interpolatePath(points, segments = 20) {
            if (points.length < 2) return points;

            const result = [];
            for (let i = 0; i < points.length - 1; i++) {
                const p0 = points[Math.max(0, i - 1)];
                const p1 = points[i];
                const p2 = points[i + 1];
                const p3 = points[Math.min(points.length - 1, i + 2)];

                for (let j = 0; j < segments; j++) {
                    const t = j / segments;
                    result.push(this.catmullRom(p0, p1, p2, p3, t));
                }
            }
            result.push(points[points.length - 1]);
            return result;
        }

        catmullRom(p0, p1, p2, p3, t) {
            const t2 = t * t;
            const t3 = t2 * t;

            return {
                x: 0.5 * ((2 * p1.x) + (-p0.x + p2.x) * t +
                    (2 * p0.x - 5 * p1.x + 4 * p2.x - p3.x) * t2 +
                    (-p0.x + 3 * p1.x - 3 * p2.x + p3.x) * t3),
                y: 0.5 * ((2 * p1.y) + (-p0.y + p2.y) * t +
                    (2 * p0.y - 5 * p1.y + 4 * p2.y - p3.y) * t2 +
                    (-p0.y + 3 * p1.y - 3 * p2.y + p3.y) * t3),
                z: 0.5 * ((2 * p1.z) + (-p0.z + p2.z) * t +
                    (2 * p0.z - 5 * p1.z + 4 * p2.z - p3.z) * t2 +
                    (-p0.z + 3 * p1.z - 3 * p2.z + p3.z) * t3)
            };
        }
    }

    /**
     * 3D Knot Renderer
     */
    class Knot3DRenderer {
        constructor(canvas) {
            this.canvas = canvas;
            this.ctx = canvas.getContext('2d');
            this.tubeRadius = 6;
            this.lightDir = Vec3.normalize(Vec3.create(0.5, -0.5, 1));

            // Camera/projection settings
            this.rotationY = 0;
            this.rotationX = 0.3;
            this.zoom = 1;
            this.centerOffset = { x: 0, y: 0 };
        }

        /**
         * Project 3D point to 2D screen coordinates
         */
        project(point) {
            // Apply rotation
            let { x, y, z } = point;

            // Rotate around Y axis
            const cosY = Math.cos(this.rotationY);
            const sinY = Math.sin(this.rotationY);
            const x1 = x * cosY - z * sinY;
            const z1 = x * sinY + z * cosY;

            // Rotate around X axis
            const cosX = Math.cos(this.rotationX);
            const sinX = Math.sin(this.rotationX);
            const y1 = y * cosX - z1 * sinX;
            const z2 = y * sinX + z1 * cosX;

            // Simple perspective projection
            const fov = 400;
            const scale = fov / (fov + z2) * this.zoom;

            return {
                x: this.canvas.width / 2 + x1 * scale + this.centerOffset.x,
                y: this.canvas.height / 2 + y1 * scale + this.centerOffset.y,
                z: z2,
                scale: scale
            };
        }

        /**
         * Render paths as 3D tubes
         */
        render(paths, progress = 1) {
            const ctx = this.ctx;
            const width = this.canvas.width;
            const height = this.canvas.height;

            // Clear with gradient background
            const gradient = ctx.createLinearGradient(0, 0, 0, height);
            gradient.addColorStop(0, '#1a1a2e');
            gradient.addColorStop(1, '#16213e');
            ctx.fillStyle = gradient;
            ctx.fillRect(0, 0, width, height);

            // Collect all tube segments with depth info
            const segments = [];

            for (const path of paths) {
                const generator = new BraidPathGenerator();
                const smoothPoints = generator.interpolatePath(path.points, 15);
                const numPoints = Math.floor(smoothPoints.length * progress);

                for (let i = 0; i < numPoints - 1; i++) {
                    const p1 = smoothPoints[i];
                    const p2 = smoothPoints[i + 1];
                    const proj1 = this.project(p1);
                    const proj2 = this.project(p2);

                    segments.push({
                        p1: proj1,
                        p2: proj2,
                        z: (proj1.z + proj2.z) / 2,
                        color: path.color,
                        radius: this.tubeRadius * ((proj1.scale + proj2.scale) / 2)
                    });
                }
            }

            // Sort by depth (back to front)
            segments.sort((a, b) => b.z - a.z);

            // Draw segments
            for (const seg of segments) {
                this.drawTubeSegment(seg);
            }
        }

        drawTubeSegment(seg) {
            const ctx = this.ctx;
            const { p1, p2, color, radius } = seg;

            // Calculate angle for gradient
            const dx = p2.x - p1.x;
            const dy = p2.y - p1.y;
            const len = Math.sqrt(dx * dx + dy * dy);
            if (len < 0.5) return;

            // Perpendicular direction for lighting
            const perpX = -dy / len;
            const perpY = dx / len;

            // Create gradient across tube width for 3D effect
            const gradientStart = {
                x: (p1.x + p2.x) / 2 - perpX * radius,
                y: (p1.y + p2.y) / 2 - perpY * radius
            };
            const gradientEnd = {
                x: (p1.x + p2.x) / 2 + perpX * radius,
                y: (p1.y + p2.y) / 2 + perpY * radius
            };

            const gradient = ctx.createLinearGradient(
                gradientStart.x, gradientStart.y,
                gradientEnd.x, gradientEnd.y
            );
            gradient.addColorStop(0, color.dark);
            gradient.addColorStop(0.3, color.main);
            gradient.addColorStop(0.5, color.light);
            gradient.addColorStop(0.7, color.main);
            gradient.addColorStop(1, color.dark);

            // Draw thick line
            ctx.strokeStyle = gradient;
            ctx.lineWidth = radius * 2;
            ctx.lineCap = 'round';
            ctx.beginPath();
            ctx.moveTo(p1.x, p1.y);
            ctx.lineTo(p2.x, p2.y);
            ctx.stroke();

            // Add specular highlight
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
            ctx.lineWidth = radius * 0.5;
            ctx.beginPath();
            ctx.moveTo(p1.x - perpX * radius * 0.3, p1.y - perpY * radius * 0.3);
            ctx.lineTo(p2.x - perpX * radius * 0.3, p2.y - perpY * radius * 0.3);
            ctx.stroke();
        }
    }

    /**
     * Interactive 3D Knot Demo
     */
    class Knot3DDemo {
        constructor(container, options = {}) {
            this.container = container;
            this.numStrands = options.numStrands || 3;
            this.operations = options.operations || [];
            this.autoRotate = options.autoRotate !== false;

            this.isAnimating = false;
            this.progress = 1;
            this.animationId = null;

            this.setup();
        }

        setup() {
            this.container.innerHTML = `
                <div class="knot-3d-wrapper">
                    <canvas class="knot-3d-canvas"></canvas>
                    <div class="knot-3d-controls">
                        <button class="viz-btn knot-play">▶ Animate</button>
                        <button class="viz-btn knot-reset">↺ Reset</button>
                    </div>
                    <div class="knot-3d-word"></div>
                </div>
            `;

            this.canvas = this.container.querySelector('.knot-3d-canvas');
            this.canvas.width = 280;
            this.canvas.height = 280;

            this.renderer = new Knot3DRenderer(this.canvas);
            this.generator = new BraidPathGenerator(this.numStrands);

            this.updatePaths();
            this.render();

            // Drag to rotate
            let isDragging = false;
            let lastX = 0, lastY = 0;

            this.canvas.addEventListener('mousedown', (e) => {
                isDragging = true;
                lastX = e.clientX;
                lastY = e.clientY;
                this.autoRotate = false;
            });

            window.addEventListener('mousemove', (e) => {
                if (!isDragging) return;
                const dx = e.clientX - lastX;
                const dy = e.clientY - lastY;
                this.renderer.rotationY += dx * 0.01;
                this.renderer.rotationX += dy * 0.01;
                lastX = e.clientX;
                lastY = e.clientY;
                this.render();
            });

            window.addEventListener('mouseup', () => {
                isDragging = false;
            });

            // Controls
            this.container.querySelector('.knot-play').addEventListener('click', () => {
                this.animate();
            });

            this.container.querySelector('.knot-reset').addEventListener('click', () => {
                this.reset();
            });

            // Auto-rotate
            if (this.autoRotate) {
                this.startAutoRotate();
            }
        }

        setOperations(ops) {
            this.operations = ops;
            this.updatePaths();
            this.render();
            this.updateWordDisplay();
        }

        updatePaths() {
            this.paths = this.generator.generatePaths(this.operations);
            // Center vertically
            const totalHeight = (this.operations.length + 1) * this.generator.crossingHeight;
            this.renderer.centerOffset.y = -totalHeight / 2 + 30;
        }

        updateWordDisplay() {
            const wordEl = this.container.querySelector('.knot-3d-word');
            if (this.operations.length === 0) {
                wordEl.textContent = 'ε (identity)';
                return;
            }
            const word = this.operations.map(op => {
                const abs = Math.abs(op);
                const sub = String.fromCharCode(0x2080 + abs);
                return op > 0 ? 'σ' + sub : 'σ' + sub + '⁻¹';
            }).join('');
            wordEl.textContent = word;
        }

        render() {
            this.renderer.render(this.paths, this.progress);
        }

        animate() {
            this.stopAnimation();
            this.progress = 0;
            this.isAnimating = true;

            const duration = 2000 + this.operations.length * 500;
            const startTime = performance.now();

            const step = () => {
                if (!this.isAnimating) return;

                const elapsed = performance.now() - startTime;
                this.progress = Math.min(1, elapsed / duration);

                this.render();

                if (this.progress < 1) {
                    this.animationId = requestAnimationFrame(step);
                } else {
                    this.isAnimating = false;
                }
            };

            this.animationId = requestAnimationFrame(step);
        }

        stopAnimation() {
            this.isAnimating = false;
            if (this.animationId) {
                cancelAnimationFrame(this.animationId);
                this.animationId = null;
            }
        }

        reset() {
            this.stopAnimation();
            this.progress = 1;
            this.renderer.rotationY = 0;
            this.renderer.rotationX = 0.3;
            this.render();
        }

        startAutoRotate() {
            const rotate = () => {
                if (this.autoRotate && !this.isAnimating) {
                    this.renderer.rotationY += 0.005;
                    this.render();
                }
                requestAnimationFrame(rotate);
            };
            rotate();
        }
    }

    /**
     * 3D Physics Comparison - Replaces the old 2D bouncing demo
     */
    class Knot3DComparison {
        constructor(container) {
            this.container = container;
            this.demos = [];
            this.setup();
        }

        setup() {
            this.container.innerHTML = `
                <div class="knot-3d-comparison">
                    <div class="knot-3d-panel">
                        <h4>2 Strands (B₂)</h4>
                        <div class="knot-3d-container" id="knot-3d-2"></div>
                        <p class="knot-3d-insight">σ₁σ₁σ₁ = just 3 twists<br>Always untangles!</p>
                    </div>
                    <div class="knot-3d-panel">
                        <h4>3 Strands (B₃)</h4>
                        <div class="knot-3d-container" id="knot-3d-3"></div>
                        <p class="knot-3d-insight">σ₁σ₂σ₁ creates a<br>genuine tangle!</p>
                    </div>
                </div>
                <div class="knot-3d-presets">
                    <span>Try:</span>
                    <button class="viz-btn preset-btn" data-preset="simple">Simple Twist</button>
                    <button class="viz-btn preset-btn" data-preset="yang-baxter">Yang-Baxter</button>
                    <button class="viz-btn preset-btn" data-preset="complex">Complex Tangle</button>
                </div>
            `;

            // Create demos
            this.demo2 = new Knot3DDemo(
                document.getElementById('knot-3d-2'),
                { numStrands: 2, operations: [1, 1, 1] }
            );

            this.demo3 = new Knot3DDemo(
                document.getElementById('knot-3d-3'),
                { numStrands: 3, operations: [1, 2, 1] }
            );

            this.demo2.updateWordDisplay();
            this.demo3.updateWordDisplay();

            // Preset buttons
            this.container.querySelectorAll('.preset-btn').forEach(btn => {
                btn.addEventListener('click', () => {
                    const preset = btn.dataset.preset;
                    this.applyPreset(preset);
                });
            });
        }

        applyPreset(preset) {
            const presets = {
                'simple': {
                    ops2: [1, 1],
                    ops3: [1, 1]
                },
                'yang-baxter': {
                    ops2: [1, -1, 1],
                    ops3: [1, 2, 1]
                },
                'complex': {
                    ops2: [1, 1, 1, -1, 1],
                    ops3: [1, 2, -1, 2, 1, -2]
                }
            };

            const p = presets[preset];
            if (!p) return;

            this.demo2.setOperations(p.ops2);
            this.demo3.setOperations(p.ops3);

            // Animate both
            setTimeout(() => {
                this.demo2.animate();
                this.demo3.animate();
            }, 100);
        }
    }

    /**
     * Famous Knots Explorer
     * Displays classic mathematical knots as closed braids
     */
    class FamousKnotsExplorer {
        constructor(container) {
            this.container = container;
            this.currentKnot = 'trefoil';

            // Famous knots defined by their braid words
            // When closed (connecting top to bottom), these create the knots
            this.knots = {
                'unknot': {
                    name: 'Unknot',
                    description: 'The trivial knot — just a simple loop',
                    operations: [],
                    numStrands: 2,
                    notation: 'ε (identity)',
                    crossingNumber: 0,
                    facts: 'Any knot that can be untangled to a circle is an unknot'
                },
                'trefoil': {
                    name: 'Trefoil Knot',
                    description: 'The simplest non-trivial knot',
                    operations: [1, 1, 1],
                    numStrands: 2,
                    notation: 'σ₁³',
                    crossingNumber: 3,
                    facts: 'Found in Celtic art, Buddhist symbols, and your shoelaces!'
                },
                'figure8': {
                    name: 'Figure-8 Knot',
                    description: 'The second simplest knot',
                    operations: [1, -2, 1, -2],
                    numStrands: 3,
                    notation: 'σ₁σ₂⁻¹σ₁σ₂⁻¹',
                    crossingNumber: 4,
                    facts: 'Most commonly used stopper knot by sailors and climbers'
                },
                'cinquefoil': {
                    name: 'Cinquefoil Knot',
                    description: 'A 5-crossing torus knot',
                    operations: [1, 1, 1, 1, 1],
                    numStrands: 2,
                    notation: 'σ₁⁵',
                    crossingNumber: 5,
                    facts: 'Also called the Solomon\'s Seal knot or pentafoil'
                },
                'granny': {
                    name: 'Granny Knot',
                    description: 'Two trefoils composed the wrong way',
                    operations: [1, 1, 1, 1, 1, 1],
                    numStrands: 2,
                    notation: 'σ₁⁶',
                    crossingNumber: 6,
                    facts: 'Slips under tension — never use for safety-critical knots!'
                },
                'stevedore': {
                    name: 'Stevedore Knot',
                    description: 'A stopper knot used by dock workers',
                    operations: [1, 1, -2, 1, -2, 1],
                    numStrands: 3,
                    notation: 'σ₁²σ₂⁻¹σ₁σ₂⁻¹σ₁',
                    crossingNumber: 6,
                    facts: 'Larger and more secure than the figure-8 knot'
                }
            };

            this.setup();
        }

        setup() {
            this.container.innerHTML = `
                <div class="famous-knots-explorer">
                    <div class="knot-selector">
                        ${Object.entries(this.knots).map(([key, knot]) => `
                            <button class="knot-select-btn ${key === this.currentKnot ? 'active' : ''}"
                                    data-knot="${key}">
                                ${knot.name}
                            </button>
                        `).join('')}
                    </div>
                    <div class="knot-display-area">
                        <div class="knot-canvas-wrapper">
                            <canvas class="knot-canvas"></canvas>
                            <div class="knot-rotation-hint">🖱️ Drag to rotate</div>
                        </div>
                        <div class="knot-info-panel">
                            <h4 class="knot-title"></h4>
                            <p class="knot-description"></p>
                            <div class="knot-stats">
                                <div class="knot-stat">
                                    <span class="stat-label">Braid representation:</span>
                                    <span class="stat-value knot-notation"></span>
                                </div>
                                <div class="knot-stat">
                                    <span class="stat-label">Crossing number:</span>
                                    <span class="stat-value knot-crossings"></span>
                                </div>
                            </div>
                            <p class="knot-facts"></p>
                            <div class="knot-actions">
                                <button class="viz-btn knot-animate-btn">▶ Animate Weave</button>
                            </div>
                        </div>
                    </div>
                </div>
            `;

            this.canvas = this.container.querySelector('.knot-canvas');
            this.canvas.width = 300;
            this.canvas.height = 300;

            // Use a special renderer that handles closed braids
            this.renderer = new ClosedKnotRenderer(this.canvas);
            this.generator = new BraidPathGenerator(3);

            this.progress = 1;
            this.autoRotate = true;

            // Selector buttons
            this.container.querySelectorAll('.knot-select-btn').forEach(btn => {
                btn.addEventListener('click', () => {
                    this.container.querySelectorAll('.knot-select-btn').forEach(b =>
                        b.classList.remove('active'));
                    btn.classList.add('active');
                    this.currentKnot = btn.dataset.knot;
                    this.progress = 1;
                    this.updateDisplay();
                });
            });

            // Animate button
            this.container.querySelector('.knot-animate-btn').addEventListener('click', () => {
                this.animate();
            });

            // Drag to rotate
            let isDragging = false;
            let lastX = 0, lastY = 0;

            this.canvas.addEventListener('mousedown', (e) => {
                isDragging = true;
                lastX = e.clientX;
                lastY = e.clientY;
                this.autoRotate = false;
            });

            window.addEventListener('mousemove', (e) => {
                if (!isDragging) return;
                const dx = e.clientX - lastX;
                const dy = e.clientY - lastY;
                this.renderer.rotationY += dx * 0.01;
                this.renderer.rotationX += dy * 0.01;
                lastX = e.clientX;
                lastY = e.clientY;
                this.render();
            });

            window.addEventListener('mouseup', () => {
                isDragging = false;
            });

            // Touch support
            this.canvas.addEventListener('touchstart', (e) => {
                if (e.touches.length === 1) {
                    isDragging = true;
                    lastX = e.touches[0].clientX;
                    lastY = e.touches[0].clientY;
                    this.autoRotate = false;
                    e.preventDefault();
                }
            });

            this.canvas.addEventListener('touchmove', (e) => {
                if (!isDragging || e.touches.length !== 1) return;
                const dx = e.touches[0].clientX - lastX;
                const dy = e.touches[0].clientY - lastY;
                this.renderer.rotationY += dx * 0.01;
                this.renderer.rotationX += dy * 0.01;
                lastX = e.touches[0].clientX;
                lastY = e.touches[0].clientY;
                this.render();
                e.preventDefault();
            });

            this.canvas.addEventListener('touchend', () => {
                isDragging = false;
            });

            this.updateDisplay();
            this.startAutoRotate();
        }

        updateDisplay() {
            const knot = this.knots[this.currentKnot];

            // Update info panel
            this.container.querySelector('.knot-title').textContent = knot.name;
            this.container.querySelector('.knot-description').textContent = knot.description;
            this.container.querySelector('.knot-notation').textContent = knot.notation;
            this.container.querySelector('.knot-crossings').textContent = knot.crossingNumber;
            this.container.querySelector('.knot-facts').textContent = '💡 ' + knot.facts;

            // Update generator for correct number of strands
            this.generator = new BraidPathGenerator(knot.numStrands);

            // Generate paths
            this.paths = this.generator.generatePaths(knot.operations);

            // Center the view
            const totalHeight = (knot.operations.length + 1) * this.generator.crossingHeight;
            this.renderer.centerOffset.y = -totalHeight / 2 + 30;

            this.render();
        }

        render() {
            const knot = this.knots[this.currentKnot];
            this.renderer.render(this.paths, this.progress, knot.operations.length > 0);
        }

        animate() {
            this.progress = 0;
            const knot = this.knots[this.currentKnot];
            const duration = 1500 + knot.operations.length * 400;
            const startTime = performance.now();

            const step = () => {
                const elapsed = performance.now() - startTime;
                this.progress = Math.min(1, elapsed / duration);
                this.render();

                if (this.progress < 1) {
                    requestAnimationFrame(step);
                }
            };

            requestAnimationFrame(step);
        }

        startAutoRotate() {
            const rotate = () => {
                if (this.autoRotate) {
                    this.renderer.rotationY += 0.008;
                    this.render();
                }
                requestAnimationFrame(rotate);
            };
            rotate();
        }
    }

    /**
     * Renderer for closed knots (braid closure)
     * Extends the base renderer to connect top and bottom
     */
    class ClosedKnotRenderer extends Knot3DRenderer {
        constructor(canvas) {
            super(canvas);
            this.rotationX = 0.4; // Better default angle for knots
        }

        /**
         * Render paths as closed knots
         */
        render(paths, progress = 1, showClosure = true) {
            const ctx = this.ctx;
            const width = this.canvas.width;
            const height = this.canvas.height;

            // Clear with darker gradient for drama
            const gradient = ctx.createLinearGradient(0, 0, 0, height);
            gradient.addColorStop(0, '#0d1b2a');
            gradient.addColorStop(1, '#1b263b');
            ctx.fillStyle = gradient;
            ctx.fillRect(0, 0, width, height);

            // Add subtle grid
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.03)';
            ctx.lineWidth = 1;
            for (let i = 0; i < width; i += 30) {
                ctx.beginPath();
                ctx.moveTo(i, 0);
                ctx.lineTo(i, height);
                ctx.stroke();
            }
            for (let i = 0; i < height; i += 30) {
                ctx.beginPath();
                ctx.moveTo(0, i);
                ctx.lineTo(width, i);
                ctx.stroke();
            }

            // Collect all tube segments with depth info
            const segments = [];
            const generator = new BraidPathGenerator();

            for (const path of paths) {
                const smoothPoints = generator.interpolatePath(path.points, 15);
                const numPoints = Math.floor(smoothPoints.length * progress);

                // Main braid segments
                for (let i = 0; i < numPoints - 1; i++) {
                    const p1 = smoothPoints[i];
                    const p2 = smoothPoints[i + 1];
                    const proj1 = this.project(p1);
                    const proj2 = this.project(p2);

                    segments.push({
                        p1: proj1,
                        p2: proj2,
                        z: (proj1.z + proj2.z) / 2,
                        color: path.color,
                        radius: this.tubeRadius * ((proj1.scale + proj2.scale) / 2)
                    });
                }

                // Add closure arcs if complete
                if (showClosure && progress >= 1 && path.points.length >= 2) {
                    const closureSegments = this.generateClosureArc(
                        path.points[path.points.length - 1], // End point
                        path.points[0], // Start point
                        path.color
                    );
                    segments.push(...closureSegments);
                }
            }

            // Sort by depth (back to front)
            segments.sort((a, b) => b.z - a.z);

            // Draw segments
            for (const seg of segments) {
                this.drawTubeSegment(seg);
            }

            // Add glow effect
            ctx.globalCompositeOperation = 'screen';
            for (const seg of segments) {
                if (Math.random() < 0.1) { // Sparse glow
                    ctx.beginPath();
                    ctx.arc((seg.p1.x + seg.p2.x) / 2, (seg.p1.y + seg.p2.y) / 2,
                            seg.radius * 2, 0, Math.PI * 2);
                    ctx.fillStyle = `rgba(255, 255, 255, 0.02)`;
                    ctx.fill();
                }
            }
            ctx.globalCompositeOperation = 'source-over';
        }

        /**
         * Generate closure arc connecting end back to start
         * Creates the "knot" from the "braid"
         */
        generateClosureArc(endPoint, startPoint, color) {
            const segments = [];
            const numSteps = 20;

            // Arc goes around the side
            // Midpoint pushes outward in X and Z
            const midX = (endPoint.x + startPoint.x) / 2 + 80;
            const midY = (endPoint.y + startPoint.y) / 2;
            const midZ = 60; // Pushed outward for 3D effect

            const points = [];
            for (let i = 0; i <= numSteps; i++) {
                const t = i / numSteps;
                // Quadratic bezier curve
                const mt = 1 - t;
                const x = mt * mt * endPoint.x + 2 * mt * t * midX + t * t * startPoint.x;
                const y = mt * mt * endPoint.y + 2 * mt * t * midY + t * t * startPoint.y;
                const z = mt * mt * (endPoint.z || 0) + 2 * mt * t * midZ + t * t * (startPoint.z || 0);
                points.push({ x, y, z });
            }

            for (let i = 0; i < points.length - 1; i++) {
                const p1 = points[i];
                const p2 = points[i + 1];
                const proj1 = this.project(p1);
                const proj2 = this.project(p2);

                segments.push({
                    p1: proj1,
                    p2: proj2,
                    z: (proj1.z + proj2.z) / 2,
                    color: color,
                    radius: this.tubeRadius * ((proj1.scale + proj2.scale) / 2) * 0.9
                });
            }

            return segments;
        }
    }

    /**
     * Interactive Braid Generator Builder
     * Lets users click generators to build their own braid words
     */
    class BraidGeneratorBuilder {
        constructor(container) {
            this.container = container;
            this.operations = [];
            this.maxOperations = 10;
            this.setup();
        }

        setup() {
            this.container.innerHTML = `
                <div class="generator-builder">
                    <div class="generator-display">
                        <canvas class="generator-canvas"></canvas>
                        <div class="generator-word-display">
                            <span class="word-label">Braid word:</span>
                            <span class="word-value">ε (identity)</span>
                        </div>
                    </div>
                    <div class="generator-buttons">
                        <div class="generator-row">
                            <span class="gen-label">Add:</span>
                            <button class="gen-btn gen-sigma1" data-op="1">σ₁</button>
                            <button class="gen-btn gen-sigma1-inv" data-op="-1">σ₁⁻¹</button>
                            <button class="gen-btn gen-sigma2" data-op="2">σ₂</button>
                            <button class="gen-btn gen-sigma2-inv" data-op="-2">σ₂⁻¹</button>
                        </div>
                        <div class="generator-row actions">
                            <button class="gen-btn gen-undo">↩ Undo</button>
                            <button class="gen-btn gen-reset">↺ Clear</button>
                            <button class="gen-btn gen-animate">▶ Animate</button>
                        </div>
                    </div>
                    <div class="generator-legend">
                        <div class="legend-item"><span class="legend-color" style="background:#e74c3c"></span> Strand 1 (left)</div>
                        <div class="legend-item"><span class="legend-color" style="background:#27ae60"></span> Strand 2 (middle)</div>
                        <div class="legend-item"><span class="legend-color" style="background:#3498db"></span> Strand 3 (right)</div>
                    </div>
                    <div class="generator-hint">
                        Click generators to build a braid. Drag canvas to rotate 3D view.
                    </div>
                </div>
            `;

            this.canvas = this.container.querySelector('.generator-canvas');
            this.canvas.width = 350;
            this.canvas.height = 300;

            this.wordDisplay = this.container.querySelector('.word-value');

            this.renderer = new Knot3DRenderer(this.canvas);
            this.renderer.rotationX = 0.2;
            this.generator = new BraidPathGenerator(3);

            this.updateDisplay();

            // Generator buttons
            this.container.querySelectorAll('.gen-btn[data-op]').forEach(btn => {
                btn.addEventListener('click', () => {
                    if (this.operations.length < this.maxOperations) {
                        const op = parseInt(btn.dataset.op);
                        this.operations.push(op);
                        this.updateDisplay();
                    }
                });
            });

            // Undo button
            this.container.querySelector('.gen-undo').addEventListener('click', () => {
                if (this.operations.length > 0) {
                    this.operations.pop();
                    this.updateDisplay();
                }
            });

            // Reset button
            this.container.querySelector('.gen-reset').addEventListener('click', () => {
                this.operations = [];
                this.updateDisplay();
            });

            // Animate button
            this.container.querySelector('.gen-animate').addEventListener('click', () => {
                this.animate();
            });

            // Drag to rotate
            let isDragging = false;
            let lastX = 0, lastY = 0;

            this.canvas.addEventListener('mousedown', (e) => {
                isDragging = true;
                lastX = e.clientX;
                lastY = e.clientY;
            });

            window.addEventListener('mousemove', (e) => {
                if (!isDragging) return;
                const dx = e.clientX - lastX;
                const dy = e.clientY - lastY;
                this.renderer.rotationY += dx * 0.01;
                this.renderer.rotationX += dy * 0.01;
                lastX = e.clientX;
                lastY = e.clientY;
                this.render();
            });

            window.addEventListener('mouseup', () => {
                isDragging = false;
            });
        }

        updateDisplay() {
            // Update word display
            if (this.operations.length === 0) {
                this.wordDisplay.textContent = 'ε (identity)';
            } else {
                const word = this.operations.map(op => {
                    const abs = Math.abs(op);
                    const sub = String.fromCharCode(0x2080 + abs);
                    return op > 0 ? 'σ' + sub : 'σ' + sub + '⁻¹';
                }).join(' · ');
                this.wordDisplay.textContent = word;
            }

            // Update paths and render
            this.paths = this.generator.generatePaths(this.operations);
            const totalHeight = (this.operations.length + 1) * this.generator.crossingHeight;
            this.renderer.centerOffset.y = -totalHeight / 2 + 50;
            this.render();
        }

        render() {
            this.renderer.render(this.paths, this.progress || 1);
        }

        animate() {
            this.progress = 0;
            const duration = 1500 + this.operations.length * 400;
            const startTime = performance.now();

            const step = () => {
                const elapsed = performance.now() - startTime;
                this.progress = Math.min(1, elapsed / duration);
                this.render();

                if (this.progress < 1) {
                    requestAnimationFrame(step);
                }
            };

            requestAnimationFrame(step);
        }
    }

    // Export
    window.Knot3D = {
        Knot3DDemo,
        Knot3DComparison,
        BraidPathGenerator,
        Knot3DRenderer,
        BraidGeneratorBuilder,
        FamousKnotsExplorer,
        ClosedKnotRenderer
    };

    // Auto-initialize
    document.addEventListener('DOMContentLoaded', () => {
        const physicsContainer = document.getElementById('physics-demo-container');
        if (physicsContainer) {
            // Replace old PhysicsComparison with new 3D version
            new Knot3DComparison(physicsContainer);
        }

        const generatorContainer = document.getElementById('generator-builder-container');
        if (generatorContainer) {
            new BraidGeneratorBuilder(generatorContainer);
        }

        const famousKnotsContainer = document.getElementById('famous-knots-container');
        if (famousKnotsContainer) {
            new FamousKnotsExplorer(famousKnotsContainer);
        }
    });

})();
