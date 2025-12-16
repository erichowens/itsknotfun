/**
 * Braid Visualization - Interactive educational visualizations for braid theory
 * Part of "It's Knot Fun" - Three Dog Leash Simulation
 */

(function() {
    'use strict';

    // Strand colors (consistent throughout)
    const STRAND_COLORS = {
        0: { main: '#e74c3c', shadow: '#c0392b', name: 'Ruby' },   // Left/Red
        1: { main: '#27ae60', shadow: '#1e8449', name: 'Emerald' }, // Middle/Green
        2: { main: '#3498db', shadow: '#2980b9', name: 'Sapphire' } // Right/Blue
    };

    /**
     * BraidVisualizer - Renders interactive braid diagrams
     */
    class BraidVisualizer {
        constructor(canvas, options = {}) {
            this.canvas = canvas;
            this.ctx = canvas.getContext('2d');
            this.numStrands = options.numStrands || 3;
            this.strandWidth = options.strandWidth || 12;
            this.strandSpacing = options.strandSpacing || 60;
            this.crossingHeight = options.crossingHeight || 80;
            this.operations = [];
            this.currentStep = 0;
            this.animationProgress = 1;
            this.isAnimating = false;

            // Current strand positions (which strand is in which slot)
            this.strandPositions = [];
            for (let i = 0; i < this.numStrands; i++) {
                this.strandPositions.push(i);
            }

            this.setupCanvas();
        }

        setupCanvas() {
            // Set canvas size
            const width = this.strandSpacing * (this.numStrands + 1);
            const height = 400;
            this.canvas.width = width;
            this.canvas.height = height;
            this.canvas.style.width = width + 'px';
            this.canvas.style.height = height + 'px';
        }

        /**
         * Add an operation to the braid
         * @param {number} generator - 1 or 2 for σ₁ or σ₂, negative for inverse
         */
        addOperation(generator) {
            this.operations.push(generator);
            this.render();
        }

        /**
         * Clear all operations
         */
        reset() {
            this.operations = [];
            this.currentStep = 0;
            this.strandPositions = [];
            for (let i = 0; i < this.numStrands; i++) {
                this.strandPositions.push(i);
            }
            this.render();
        }

        /**
         * Play animation of operations
         */
        async playAnimation(speed = 1000) {
            this.isAnimating = true;
            this.currentStep = 0;

            for (let i = 0; i <= this.operations.length; i++) {
                if (!this.isAnimating) break;
                this.currentStep = i;
                await this.animateStep(speed);
            }

            this.isAnimating = false;
        }

        stopAnimation() {
            this.isAnimating = false;
        }

        async animateStep(duration) {
            return new Promise(resolve => {
                const startTime = performance.now();
                const animate = (currentTime) => {
                    const elapsed = currentTime - startTime;
                    this.animationProgress = Math.min(elapsed / duration, 1);
                    this.render();

                    if (this.animationProgress < 1) {
                        requestAnimationFrame(animate);
                    } else {
                        this.animationProgress = 1;
                        resolve();
                    }
                };
                requestAnimationFrame(animate);
            });
        }

        /**
         * Get braid word as string
         * @param {boolean} animated - If true, only show operations up to currentStep
         */
        getBraidWord(animated = false) {
            const ops = animated && this.isAnimating
                ? this.operations.slice(0, this.currentStep)
                : this.operations;

            if (ops.length === 0) return 'ε';

            return ops.map(op => {
                const abs = Math.abs(op);
                const sub = String.fromCharCode(0x2080 + abs); // Subscript digit
                if (op > 0) {
                    return 'σ' + sub;
                } else {
                    return 'σ' + sub + '⁻¹';
                }
            }).join('');
        }

        /**
         * Render the braid diagram
         */
        render() {
            const ctx = this.ctx;
            const width = this.canvas.width;
            const height = this.canvas.height;

            // Clear with chalkboard background
            ctx.fillStyle = '#2d4a3e';
            ctx.fillRect(0, 0, width, height);

            // Add chalk dust texture
            this.addChalkTexture();

            // Draw title (show progress during animation)
            ctx.font = '16px "Caveat", cursive';
            ctx.fillStyle = '#f0e6d3';
            ctx.textAlign = 'center';
            ctx.fillText(this.getBraidWord(true), width / 2, 25);

            // Calculate positions
            const startY = 50;
            const endY = height - 30;
            const totalOperations = this.operations.length;

            if (totalOperations === 0) {
                // Draw straight strands
                for (let i = 0; i < this.numStrands; i++) {
                    this.drawStrand(ctx, i, [
                        { x: this.getStrandX(i), y: startY },
                        { x: this.getStrandX(i), y: endY }
                    ], false);
                }

                // Draw strand labels
                this.drawLabels(ctx, startY - 15);
                return;
            }

            // Calculate crossing height based on number of operations
            const availableHeight = endY - startY;
            const crossingH = Math.min(this.crossingHeight, availableHeight / totalOperations);

            // Track strand paths
            const paths = [];
            for (let i = 0; i < this.numStrands; i++) {
                paths.push([{ x: this.getStrandX(i), y: startY }]);
            }

            // Current positions (which slot each strand occupies)
            const positions = [];
            for (let i = 0; i < this.numStrands; i++) {
                positions.push(i);
            }

            // Build paths through operations (limit to currentStep during animation)
            const opsToShow = this.isAnimating ? this.currentStep : totalOperations;
            for (let opIdx = 0; opIdx < opsToShow; opIdx++) {
                const op = this.operations[opIdx];
                const y1 = startY + opIdx * crossingH;
                const y2 = startY + (opIdx + 1) * crossingH;
                const yMid = (y1 + y2) / 2;

                const leftSlot = Math.abs(op) - 1;
                const rightSlot = leftSlot + 1;

                // Find which strands are in these slots
                let leftStrand = -1, rightStrand = -1;
                for (let i = 0; i < this.numStrands; i++) {
                    if (positions[i] === leftSlot) leftStrand = i;
                    if (positions[i] === rightSlot) rightStrand = i;
                }

                // Add crossing points
                for (let i = 0; i < this.numStrands; i++) {
                    const currentSlot = positions[i];
                    const x1 = this.getStrandX(currentSlot);

                    if (i === leftStrand) {
                        // This strand moves right
                        const x2 = this.getStrandX(rightSlot);
                        paths[i].push({ x: x1, y: y1 });
                        paths[i].push({ x: (x1 + x2) / 2, y: yMid, crossing: op > 0 ? 'over' : 'under' });
                        paths[i].push({ x: x2, y: y2 });
                        positions[i] = rightSlot;
                    } else if (i === rightStrand) {
                        // This strand moves left
                        const x2 = this.getStrandX(leftSlot);
                        paths[i].push({ x: x1, y: y1 });
                        paths[i].push({ x: (x1 + x2) / 2, y: yMid, crossing: op > 0 ? 'under' : 'over' });
                        paths[i].push({ x: x2, y: y2 });
                        positions[i] = leftSlot;
                    } else {
                        // This strand goes straight
                        paths[i].push({ x: x1, y: y2 });
                    }
                }
            }

            // Add final segments
            for (let i = 0; i < this.numStrands; i++) {
                const lastPoint = paths[i][paths[i].length - 1];
                paths[i].push({ x: lastPoint.x, y: endY });
            }

            // Draw strands (under-crossings first, then over-crossings)
            for (let pass = 0; pass < 2; pass++) {
                for (let i = 0; i < this.numStrands; i++) {
                    this.drawStrandPath(ctx, i, paths[i], pass === 1);
                }
            }

            // Draw labels
            this.drawLabels(ctx, startY - 15);
        }

        getStrandX(slot) {
            return this.strandSpacing + slot * this.strandSpacing;
        }

        addChalkTexture() {
            const ctx = this.ctx;
            ctx.save();
            ctx.globalAlpha = 0.03;
            for (let i = 0; i < 100; i++) {
                const x = Math.random() * this.canvas.width;
                const y = Math.random() * this.canvas.height;
                const size = Math.random() * 3 + 1;
                ctx.fillStyle = '#fff';
                ctx.beginPath();
                ctx.arc(x, y, size, 0, Math.PI * 2);
                ctx.fill();
            }
            ctx.restore();
        }

        drawStrandPath(ctx, strandIndex, points, drawOver) {
            const color = STRAND_COLORS[strandIndex];

            ctx.save();
            ctx.lineCap = 'round';
            ctx.lineJoin = 'round';

            for (let i = 0; i < points.length - 1; i++) {
                const p1 = points[i];
                const p2 = points[i + 1];
                const isOver = p2.crossing === 'over';
                const isUnder = p2.crossing === 'under';

                if (drawOver && isUnder) continue;
                if (!drawOver && isOver) continue;

                // Draw shadow/outline
                ctx.strokeStyle = color.shadow;
                ctx.lineWidth = this.strandWidth + 4;
                ctx.beginPath();
                ctx.moveTo(p1.x, p1.y);

                if (p2.crossing) {
                    // Draw curve through crossing point
                    const cp1x = p1.x;
                    const cp1y = p1.y + (p2.y - p1.y) * 0.5;
                    const cp2x = p2.x;
                    const cp2y = p1.y + (p2.y - p1.y) * 0.5;
                    ctx.bezierCurveTo(cp1x, cp1y, cp2x, cp2y, p2.x, p2.y);
                } else {
                    ctx.lineTo(p2.x, p2.y);
                }
                ctx.stroke();

                // Draw main strand
                ctx.strokeStyle = color.main;
                ctx.lineWidth = this.strandWidth;
                ctx.beginPath();
                ctx.moveTo(p1.x, p1.y);

                if (p2.crossing) {
                    const cp1x = p1.x;
                    const cp1y = p1.y + (p2.y - p1.y) * 0.5;
                    const cp2x = p2.x;
                    const cp2y = p1.y + (p2.y - p1.y) * 0.5;
                    ctx.bezierCurveTo(cp1x, cp1y, cp2x, cp2y, p2.x, p2.y);
                } else {
                    ctx.lineTo(p2.x, p2.y);
                }
                ctx.stroke();

                // Add chalk effect
                ctx.strokeStyle = 'rgba(255,255,255,0.3)';
                ctx.lineWidth = 2;
                ctx.beginPath();
                ctx.moveTo(p1.x - 3, p1.y);
                if (p2.crossing) {
                    const cp1x = p1.x - 3;
                    const cp1y = p1.y + (p2.y - p1.y) * 0.5;
                    const cp2x = p2.x - 3;
                    const cp2y = p1.y + (p2.y - p1.y) * 0.5;
                    ctx.bezierCurveTo(cp1x, cp1y, cp2x, cp2y, p2.x - 3, p2.y);
                } else {
                    ctx.lineTo(p2.x - 3, p2.y);
                }
                ctx.stroke();
            }

            ctx.restore();
        }

        drawStrand(ctx, strandIndex, points, isOver) {
            const color = STRAND_COLORS[strandIndex];

            ctx.save();
            ctx.lineCap = 'round';
            ctx.lineJoin = 'round';

            // Shadow
            ctx.strokeStyle = color.shadow;
            ctx.lineWidth = this.strandWidth + 4;
            ctx.beginPath();
            ctx.moveTo(points[0].x, points[0].y);
            for (let i = 1; i < points.length; i++) {
                ctx.lineTo(points[i].x, points[i].y);
            }
            ctx.stroke();

            // Main strand
            ctx.strokeStyle = color.main;
            ctx.lineWidth = this.strandWidth;
            ctx.beginPath();
            ctx.moveTo(points[0].x, points[0].y);
            for (let i = 1; i < points.length; i++) {
                ctx.lineTo(points[i].x, points[i].y);
            }
            ctx.stroke();

            ctx.restore();
        }

        drawLabels(ctx, y) {
            ctx.font = 'bold 14px "Courier New", monospace';
            ctx.textAlign = 'center';

            for (let i = 0; i < this.numStrands; i++) {
                const x = this.getStrandX(i);
                const color = STRAND_COLORS[i];

                // Draw circle background
                ctx.fillStyle = color.main;
                ctx.beginPath();
                ctx.arc(x, y, 12, 0, Math.PI * 2);
                ctx.fill();

                // Draw label
                ctx.fillStyle = '#fff';
                ctx.fillText(String(i + 1), x, y + 5);
            }
        }
    }

    /**
     * ComparisonVisualizer - Side-by-side comparison of 2 vs 3 strands
     */
    class ComparisonVisualizer {
        constructor(container) {
            this.container = container;
            this.setup();
        }

        setup() {
            this.container.innerHTML = `
                <div class="comparison-viz">
                    <div class="comparison-panel">
                        <h4>Two Strands (B₂)</h4>
                        <canvas id="viz-2strand"></canvas>
                        <div class="controls">
                            <button class="viz-btn" data-action="add-s1">+σ₁</button>
                            <button class="viz-btn" data-action="add-s1-inv">+σ₁⁻¹</button>
                            <button class="viz-btn" data-action="reset">Reset</button>
                        </div>
                        <p class="viz-word">Word: <span class="word-display">ε</span></p>
                        <p class="viz-insight">Any tangle = σ₁ⁿ. Just count crossings!</p>
                    </div>
                    <div class="comparison-panel">
                        <h4>Three Strands (B₃)</h4>
                        <canvas id="viz-3strand"></canvas>
                        <div class="controls">
                            <button class="viz-btn" data-action="add-s1">+σ₁</button>
                            <button class="viz-btn" data-action="add-s1-inv">+σ₁⁻¹</button>
                            <button class="viz-btn" data-action="add-s2">+σ₂</button>
                            <button class="viz-btn" data-action="add-s2-inv">+σ₂⁻¹</button>
                            <button class="viz-btn" data-action="reset">Reset</button>
                        </div>
                        <p class="viz-word">Word: <span class="word-display">ε</span></p>
                        <p class="viz-insight">Order matters! σ₁σ₂ ≠ σ₂σ₁</p>
                    </div>
                </div>
            `;

            // Create visualizers
            this.viz2 = new BraidVisualizer(
                document.getElementById('viz-2strand'),
                { numStrands: 2, strandSpacing: 50 }
            );
            this.viz3 = new BraidVisualizer(
                document.getElementById('viz-3strand'),
                { numStrands: 3, strandSpacing: 50 }
            );

            this.viz2.render();
            this.viz3.render();

            // Add event listeners
            this.container.querySelectorAll('.viz-btn').forEach(btn => {
                btn.addEventListener('click', (e) => this.handleButton(e));
            });
        }

        handleButton(e) {
            const action = e.target.dataset.action;
            const panel = e.target.closest('.comparison-panel');
            const is2Strand = panel.querySelector('canvas').id === 'viz-2strand';
            const viz = is2Strand ? this.viz2 : this.viz3;

            switch (action) {
                case 'add-s1':
                    viz.addOperation(1);
                    break;
                case 'add-s1-inv':
                    viz.addOperation(-1);
                    break;
                case 'add-s2':
                    if (!is2Strand) viz.addOperation(2);
                    break;
                case 'add-s2-inv':
                    if (!is2Strand) viz.addOperation(-2);
                    break;
                case 'reset':
                    viz.reset();
                    break;
            }

            // Update word display
            panel.querySelector('.word-display').textContent = viz.getBraidWord();
        }
    }

    /**
     * YangBaxterDemo - Interactive Yang-Baxter relation proof
     */
    class YangBaxterDemo {
        constructor(container) {
            this.container = container;
            this.setup();
        }

        setup() {
            this.container.innerHTML = `
                <div class="yang-baxter-demo">
                    <h4>The Yang-Baxter Relation: σ₁σ₂σ₁ = σ₂σ₁σ₂</h4>
                    <p class="yb-subtitle">Two different paths, same destination!</p>
                    <div class="yb-panels">
                        <div class="yb-panel">
                            <h5>Path A: σ₁σ₂σ₁</h5>
                            <canvas id="yb-path-a"></canvas>
                            <button class="viz-btn yb-play" data-path="a">▶ Play</button>
                        </div>
                        <div class="yb-equals">=</div>
                        <div class="yb-panel">
                            <h5>Path B: σ₂σ₁σ₂</h5>
                            <canvas id="yb-path-b"></canvas>
                            <button class="viz-btn yb-play" data-path="b">▶ Play</button>
                        </div>
                    </div>
                    <button class="viz-btn yb-both">▶ Play Both Simultaneously</button>
                </div>
            `;

            this.vizA = new BraidVisualizer(
                document.getElementById('yb-path-a'),
                { numStrands: 3, strandSpacing: 45, crossingHeight: 70 }
            );
            this.vizB = new BraidVisualizer(
                document.getElementById('yb-path-b'),
                { numStrands: 3, strandSpacing: 45, crossingHeight: 70 }
            );

            // Pre-populate with the operations
            this.resetDemo();

            // Event listeners
            this.container.querySelectorAll('.yb-play').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    const path = e.target.dataset.path;
                    if (path === 'a') {
                        this.resetPathA();
                        this.vizA.playAnimation(800);
                    } else {
                        this.resetPathB();
                        this.vizB.playAnimation(800);
                    }
                });
            });

            this.container.querySelector('.yb-both').addEventListener('click', () => {
                this.resetDemo();
                // Small delay to ensure reset renders before animation starts
                setTimeout(() => {
                    this.vizA.playAnimation(800);
                    this.vizB.playAnimation(800);
                }, 50);
            });
        }

        resetPathA() {
            this.vizA.reset();
            this.vizA.addOperation(1);  // σ₁
            this.vizA.addOperation(2);  // σ₂
            this.vizA.addOperation(1);  // σ₁
        }

        resetPathB() {
            this.vizB.reset();
            this.vizB.addOperation(2);  // σ₂
            this.vizB.addOperation(1);  // σ₁
            this.vizB.addOperation(2);  // σ₂
        }

        resetDemo() {
            this.resetPathA();
            this.resetPathB();
        }
    }

    /**
     * ExplainerCard - Creates styled explanation cards
     */
    class ExplainerCard {
        static create(options) {
            const { term, intuition, formal, example, complexity, style = 'graph-paper' } = options;

            const card = document.createElement('div');
            card.className = `explainer-card ${style}`;

            card.innerHTML = `
                <h3 class="card-term">${term}</h3>
                ${intuition ? `<p class="card-intuition">"${intuition}"</p>` : ''}
                ${formal ? `<p class="card-formal">${formal}</p>` : ''}
                ${example ? `<p class="card-example"><strong>Example:</strong> ${example}</p>` : ''}
                ${complexity ? `<p class="card-complexity">${complexity}</p>` : ''}
            `;

            return card;
        }
    }

    // Export to global scope
    window.BraidViz = {
        BraidVisualizer,
        ComparisonVisualizer,
        YangBaxterDemo,
        ExplainerCard,
        STRAND_COLORS
    };

    // Auto-initialize when DOM is ready
    document.addEventListener('DOMContentLoaded', () => {
        // Initialize comparison visualizer if container exists
        const comparisonContainer = document.getElementById('comparison-viz-container');
        if (comparisonContainer) {
            new ComparisonVisualizer(comparisonContainer);
        }

        // Initialize Yang-Baxter demo if container exists
        const ybContainer = document.getElementById('yang-baxter-container');
        if (ybContainer) {
            new YangBaxterDemo(ybContainer);
        }
    });

})();
