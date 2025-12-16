/**
 * Canvas Renderer for the Leash Simulation
 *
 * Chalkboard-style visualization:
 * - Green chalkboard background with grid
 * - Chalk-drawn walker and dogs
 * - Mathematical annotations and diagrams
 * - Rope physics with braid notation
 */

class Renderer {
    constructor(canvas) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');

        // Viewport settings
        this.width = 0;
        this.height = 0;
        this.scale = 1;

        // Camera follows walker
        this.cameraOffset = new Vec2(0, 0);
        this.cameraTarget = null;

        // Environment scroll
        this.scrollOffset = 0;

        // Chalkboard color palette
        this.colors = {
            // Chalkboard colors
            board: '#2a4a3a',
            boardDark: '#1e3a2c',
            gridLine: 'rgba(255, 255, 255, 0.08)',
            gridLineMajor: 'rgba(255, 255, 255, 0.15)',
            chalk: '#e8e4dc',
            chalkFaded: 'rgba(232, 228, 220, 0.4)',
            chalkDim: 'rgba(232, 228, 220, 0.2)',
            shadow: 'rgba(0, 0, 0, 0.3)',

            // Colored chalk for leashes
            leashA: '#ff9999', // Pink chalk (dog A)
            leashB: '#99ccff', // Blue chalk (dog B)
            leashC: '#99ff99', // Green chalk (dog C)

            // Crossing highlight (yellow/orange chalk)
            crossingOver: '#ffdd44',
            crossingUnder: '#88aaff',

            // Tangle indicators
            tangleLoose: '#ffaa44',    // Orange chalk
            tangleLocked: '#ff6666',   // Red chalk
            tangleGlow: 'rgba(255, 170, 68, 0.3)'
        };

        // Mathematical decorations
        this.decorations = this.generateDecorations();

        this.resize();
        window.addEventListener('resize', () => this.resize());
    }

    resize() {
        const container = this.canvas.parentElement;
        const rect = container.getBoundingClientRect();

        // Set canvas size
        this.width = rect.width;
        this.height = Math.min(500, window.innerHeight * 0.5);

        this.canvas.width = this.width * window.devicePixelRatio;
        this.canvas.height = this.height * window.devicePixelRatio;
        this.canvas.style.width = this.width + 'px';
        this.canvas.style.height = this.height + 'px';

        this.ctx.scale(window.devicePixelRatio, window.devicePixelRatio);
    }

    /**
     * Generate mathematical decorations for chalkboard
     */
    generateDecorations() {
        const decorations = [];
        const numDecorations = 15;

        // Mathematical formulas and diagrams
        const formulas = [
            'B₃ = ⟨σ₁, σ₂⟩',
            'σ₁σ₂σ₁ = σ₂σ₁σ₂',
            'T₂ = T₁·e^{μθ}',
            '∫ω = ∮∂ω',
            'π₁(S³\\K)',
            'Δ = σ₁σ₂σ₁',
            '∇×F = 0',
            'det(A-λI) = 0'
        ];

        const diagrams = ['braid', 'crossing', 'loop', 'vector', 'axes'];

        for (let i = 0; i < numDecorations; i++) {
            const type = Math.random();
            let decoration;

            if (type < 0.4) {
                // Formula
                decoration = {
                    type: 'formula',
                    x: (Math.random() < 0.5 ? -1 : 1) * (120 + Math.random() * 60),
                    y: i * 300 + Math.random() * 150,
                    text: formulas[Math.floor(Math.random() * formulas.length)],
                    rotation: (Math.random() - 0.5) * 0.2,
                    opacity: 0.15 + Math.random() * 0.15
                };
            } else if (type < 0.7) {
                // Small diagram
                decoration = {
                    type: 'diagram',
                    x: (Math.random() < 0.5 ? -1 : 1) * (100 + Math.random() * 80),
                    y: i * 300 + Math.random() * 150,
                    diagram: diagrams[Math.floor(Math.random() * diagrams.length)],
                    size: 20 + Math.random() * 20,
                    opacity: 0.1 + Math.random() * 0.15
                };
            } else {
                // Coordinate marker
                decoration = {
                    type: 'marker',
                    x: (Math.random() < 0.5 ? -1 : 1) * (80 + Math.random() * 100),
                    y: i * 300 + Math.random() * 150,
                    label: ['P', 'Q', 'R', 'A', 'B', 'x₀', 'y₀'][Math.floor(Math.random() * 7)],
                    opacity: 0.2 + Math.random() * 0.1
                };
            }

            decorations.push(decoration);
        }

        // Add funny mathematician desk items
        this.addFunnyDeskItems(decorations);

        return decorations;
    }

    /**
     * Add humorous "mathematician's desk" items - scientific dog schematics, etc.
     */
    addFunnyDeskItems(decorations) {
        // Scientific dog schematic positions (scattered throughout the board)
        const deskItems = [
            // Yorkie schematic with annotations
            {
                type: 'dogSchematic',
                breed: 'yorkie',
                x: -160,
                y: 200,
                opacity: 0.25
            },
            // Golden Retriever with floof analysis
            {
                type: 'dogSchematic',
                breed: 'golden',
                x: 170,
                y: 800,
                opacity: 0.25
            },
            // Coffee mug with math
            {
                type: 'coffeeMug',
                x: -150,
                y: 1400,
                opacity: 0.2
            },
            // Another yorkie further down
            {
                type: 'dogSchematic',
                breed: 'yorkie',
                x: 165,
                y: 2000,
                opacity: 0.22
            },
            // Treat optimization diagram
            {
                type: 'treatDiagram',
                x: -155,
                y: 2600,
                opacity: 0.23
            },
            // Golden with "bork frequency" analysis
            {
                type: 'dogSchematic',
                breed: 'golden',
                x: 160,
                y: 3200,
                opacity: 0.24
            },
            // Sticky note
            {
                type: 'stickyNote',
                x: -165,
                y: 3800,
                text: 'WHY SO CUTE?!',
                opacity: 0.28
            },
            // Ball trajectory diagram
            {
                type: 'ballTrajectory',
                x: 155,
                y: 4400,
                opacity: 0.22
            }
        ];

        decorations.push(...deskItems);
    }

    /**
     * Set camera to follow an entity
     */
    followEntity(entity) {
        this.cameraTarget = entity;
    }

    /**
     * Update camera position
     */
    updateCamera(dt) {
        if (this.cameraTarget) {
            const targetOffset = new Vec2(
                this.width / 2 - this.cameraTarget.position.x,
                this.height * 0.7 - this.cameraTarget.position.y
            );
            this.cameraOffset.lerpMut(targetOffset, 0.1);
        }

        // Update scroll for environment
        this.scrollOffset = -this.cameraOffset.y;
    }

    /**
     * Transform world coordinates to screen
     */
    toScreen(worldPos) {
        return worldPos.add(this.cameraOffset);
    }

    /**
     * Clear and prepare frame
     */
    beginFrame() {
        this.ctx.clearRect(0, 0, this.width, this.height);
    }

    /**
     * Draw the chalkboard environment with grid
     */
    drawEnvironment() {
        const ctx = this.ctx;
        const centerX = this.width / 2;

        // Chalkboard background with subtle gradient
        const gradient = ctx.createLinearGradient(0, 0, this.width, this.height);
        gradient.addColorStop(0, this.colors.board);
        gradient.addColorStop(0.5, this.colors.boardDark);
        gradient.addColorStop(1, this.colors.board);
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, this.width, this.height);

        // Add chalk dust texture effect
        ctx.fillStyle = 'rgba(255, 255, 255, 0.02)';
        for (let i = 0; i < 50; i++) {
            const x = Math.random() * this.width;
            const y = (Math.random() * this.height * 3 + this.scrollOffset) % (this.height + 100) - 50;
            const size = Math.random() * 3 + 1;
            ctx.beginPath();
            ctx.arc(x, y, size, 0, Math.PI * 2);
            ctx.fill();
        }

        // Draw grid lines (minor)
        const gridSize = 40;
        const gridOffset = (this.scrollOffset % gridSize);
        ctx.strokeStyle = this.colors.gridLine;
        ctx.lineWidth = 1;

        // Horizontal grid lines
        for (let y = -gridSize + gridOffset; y < this.height + gridSize; y += gridSize) {
            ctx.beginPath();
            ctx.moveTo(0, y);
            ctx.lineTo(this.width, y);
            ctx.stroke();
        }

        // Vertical grid lines
        for (let x = 0; x < this.width; x += gridSize) {
            ctx.beginPath();
            ctx.moveTo(x, 0);
            ctx.lineTo(x, this.height);
            ctx.stroke();
        }

        // Major grid lines (every 4 minor lines)
        const majorGridSize = gridSize * 4;
        const majorGridOffset = (this.scrollOffset % majorGridSize);
        ctx.strokeStyle = this.colors.gridLineMajor;
        ctx.lineWidth = 1;

        for (let y = -majorGridSize + majorGridOffset; y < this.height + majorGridSize; y += majorGridSize) {
            ctx.beginPath();
            ctx.moveTo(0, y);
            ctx.lineTo(this.width, y);
            ctx.stroke();
        }

        for (let x = 0; x < this.width; x += majorGridSize) {
            ctx.beginPath();
            ctx.moveTo(x, 0);
            ctx.lineTo(x, this.height);
            ctx.stroke();
        }

        // Central vertical axis (more prominent)
        ctx.strokeStyle = this.colors.chalkFaded;
        ctx.setLineDash([8, 4]);
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(centerX, 0);
        ctx.lineTo(centerX, this.height);
        ctx.stroke();
        ctx.setLineDash([]);

        // Draw "safe zone" boundaries for walking area (chalk marks)
        const walkWidth = 80;
        ctx.strokeStyle = this.colors.chalkDim;
        ctx.setLineDash([15, 10]);
        ctx.lineWidth = 2;

        ctx.beginPath();
        ctx.moveTo(centerX - walkWidth, 0);
        ctx.lineTo(centerX - walkWidth, this.height);
        ctx.stroke();

        ctx.beginPath();
        ctx.moveTo(centerX + walkWidth, 0);
        ctx.lineTo(centerX + walkWidth, this.height);
        ctx.stroke();
        ctx.setLineDash([]);
    }

    /**
     * Draw mathematical decorations
     */
    drawDecorations() {
        const ctx = this.ctx;
        const centerX = this.width / 2;

        for (const decoration of this.decorations) {
            const screenY = decoration.y + this.cameraOffset.y;

            // Cull off-screen decorations (larger margin for big items like dog schematics)
            if (screenY < -120 || screenY > this.height + 120) continue;

            const screenX = centerX + decoration.x;

            switch (decoration.type) {
                case 'formula':
                    this.drawFormula(screenX, screenY, decoration);
                    break;
                case 'diagram':
                    this.drawDiagram(screenX, screenY, decoration);
                    break;
                case 'marker':
                    this.drawMarker(screenX, screenY, decoration);
                    break;
                case 'dogSchematic':
                    this.drawDogSchematic(screenX, screenY, decoration);
                    break;
                case 'coffeeMug':
                    this.drawCoffeeMug(screenX, screenY, decoration);
                    break;
                case 'treatDiagram':
                    this.drawTreatDiagram(screenX, screenY, decoration);
                    break;
                case 'stickyNote':
                    this.drawStickyNote(screenX, screenY, decoration);
                    break;
                case 'ballTrajectory':
                    this.drawBallTrajectory(screenX, screenY, decoration);
                    break;
            }
        }
    }

    /**
     * Draw a chalk formula
     */
    drawFormula(x, y, decoration) {
        const ctx = this.ctx;

        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(decoration.rotation || 0);

        ctx.font = '14px "Caveat", cursive, serif';
        ctx.fillStyle = `rgba(232, 228, 220, ${decoration.opacity})`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';

        // Chalk texture effect - slight offset copies
        ctx.fillText(decoration.text, 0.5, 0.5);
        ctx.fillStyle = `rgba(232, 228, 220, ${decoration.opacity * 0.7})`;
        ctx.fillText(decoration.text, 0, 0);

        ctx.restore();
    }

    /**
     * Draw a small mathematical diagram
     */
    drawDiagram(x, y, decoration) {
        const ctx = this.ctx;
        const size = decoration.size;
        const opacity = decoration.opacity;

        ctx.strokeStyle = `rgba(232, 228, 220, ${opacity})`;
        ctx.fillStyle = `rgba(232, 228, 220, ${opacity * 0.5})`;
        ctx.lineWidth = 1.5;

        switch (decoration.diagram) {
            case 'braid':
                // Simple 3-strand braid sketch
                this.drawChalkBraid(x, y, size, opacity);
                break;

            case 'crossing':
                // Over/under crossing symbol
                this.drawChalkCrossing(x, y, size, opacity);
                break;

            case 'loop':
                // Simple loop/knot
                ctx.beginPath();
                ctx.arc(x, y, size * 0.6, 0, Math.PI * 1.8);
                ctx.stroke();
                break;

            case 'vector':
                // Arrow vector
                ctx.beginPath();
                ctx.moveTo(x - size * 0.5, y);
                ctx.lineTo(x + size * 0.5, y);
                ctx.lineTo(x + size * 0.3, y - size * 0.2);
                ctx.moveTo(x + size * 0.5, y);
                ctx.lineTo(x + size * 0.3, y + size * 0.2);
                ctx.stroke();
                break;

            case 'axes':
                // Coordinate axes
                ctx.beginPath();
                ctx.moveTo(x - size * 0.5, y);
                ctx.lineTo(x + size * 0.5, y);
                ctx.moveTo(x, y + size * 0.5);
                ctx.lineTo(x, y - size * 0.5);
                ctx.stroke();
                // Axis labels
                ctx.font = '10px serif';
                ctx.fillText('x', x + size * 0.6, y);
                ctx.fillText('y', x, y - size * 0.6);
                break;
        }
    }

    /**
     * Draw a chalk-style braid diagram
     */
    drawChalkBraid(x, y, size, opacity) {
        const ctx = this.ctx;
        ctx.strokeStyle = `rgba(232, 228, 220, ${opacity})`;
        ctx.lineWidth = 1.5;

        // Three strands with a crossing
        const spacing = size * 0.3;

        // Left strand
        ctx.beginPath();
        ctx.moveTo(x - spacing, y - size * 0.4);
        ctx.lineTo(x - spacing, y + size * 0.4);
        ctx.stroke();

        // Middle strand (crossing pattern)
        ctx.beginPath();
        ctx.moveTo(x, y - size * 0.4);
        ctx.quadraticCurveTo(x + spacing, y, x, y + size * 0.4);
        ctx.stroke();

        // Right strand
        ctx.beginPath();
        ctx.moveTo(x + spacing, y - size * 0.4);
        ctx.quadraticCurveTo(x - spacing * 0.5, y, x + spacing, y + size * 0.4);
        ctx.stroke();
    }

    /**
     * Draw a chalk-style crossing symbol
     */
    drawChalkCrossing(x, y, size, opacity) {
        const ctx = this.ctx;
        ctx.strokeStyle = `rgba(232, 228, 220, ${opacity})`;
        ctx.lineWidth = 2;

        // Over strand (continuous)
        ctx.beginPath();
        ctx.moveTo(x - size * 0.4, y - size * 0.4);
        ctx.lineTo(x + size * 0.4, y + size * 0.4);
        ctx.stroke();

        // Under strand (broken)
        ctx.beginPath();
        ctx.moveTo(x + size * 0.4, y - size * 0.4);
        ctx.lineTo(x + size * 0.1, y - size * 0.1);
        ctx.stroke();

        ctx.beginPath();
        ctx.moveTo(x - size * 0.1, y + size * 0.1);
        ctx.lineTo(x - size * 0.4, y + size * 0.4);
        ctx.stroke();
    }

    /**
     * Draw a coordinate marker
     */
    drawMarker(x, y, decoration) {
        const ctx = this.ctx;
        const opacity = decoration.opacity;

        // Small dot
        ctx.fillStyle = `rgba(232, 228, 220, ${opacity})`;
        ctx.beginPath();
        ctx.arc(x, y, 3, 0, Math.PI * 2);
        ctx.fill();

        // Label
        ctx.font = '12px "Caveat", cursive, serif';
        ctx.fillStyle = `rgba(232, 228, 220, ${opacity})`;
        ctx.textAlign = 'left';
        ctx.fillText(decoration.label, x + 6, y + 4);
    }

    /**
     * Draw a scientific dog schematic (Yorkie or Golden Retriever)
     */
    drawDogSchematic(x, y, decoration) {
        const ctx = this.ctx;
        const opacity = decoration.opacity;
        const breed = decoration.breed;

        ctx.save();
        ctx.translate(x, y);

        // Schematic title
        ctx.fillStyle = `rgba(232, 228, 220, ${opacity})`;
        ctx.font = 'bold 11px "Caveat", cursive';
        ctx.textAlign = 'center';

        if (breed === 'yorkie') {
            ctx.fillText('CANIS YORKIUS', 0, -55);
            ctx.font = '9px "Caveat", cursive';
            ctx.fillText('(smol floof specimen)', 0, -43);

            // Draw yorkie body outline (small, compact)
            ctx.strokeStyle = `rgba(232, 228, 220, ${opacity})`;
            ctx.lineWidth = 1.5;

            // Body
            ctx.beginPath();
            ctx.ellipse(0, 0, 20, 12, 0, 0, Math.PI * 2);
            ctx.stroke();

            // Head (round)
            ctx.beginPath();
            ctx.arc(-18, -5, 10, 0, Math.PI * 2);
            ctx.stroke();

            // Ears (triangular, pointy)
            ctx.beginPath();
            ctx.moveTo(-25, -10);
            ctx.lineTo(-28, -22);
            ctx.lineTo(-20, -12);
            ctx.stroke();
            ctx.beginPath();
            ctx.moveTo(-12, -12);
            ctx.lineTo(-10, -22);
            ctx.lineTo(-15, -10);
            ctx.stroke();

            // Tiny legs
            ctx.beginPath();
            ctx.moveTo(-10, 10);
            ctx.lineTo(-10, 20);
            ctx.moveTo(10, 10);
            ctx.lineTo(10, 20);
            ctx.moveTo(-5, 10);
            ctx.lineTo(-5, 18);
            ctx.moveTo(5, 10);
            ctx.lineTo(5, 18);
            ctx.stroke();

            // Fluffy tail
            ctx.beginPath();
            ctx.moveTo(20, -2);
            ctx.quadraticCurveTo(30, -10, 28, -18);
            ctx.stroke();

            // Annotations with arrows
            ctx.font = '8px "Caveat", cursive';
            ctx.textAlign = 'left';

            // "Floof asymptotes"
            ctx.fillText('floof', 25, -20);
            ctx.fillText('asymptotes', 25, -12);
            ctx.beginPath();
            ctx.moveTo(24, -16);
            ctx.lineTo(18, -8);
            ctx.stroke();
            this.drawArrowHead(ctx, 18, -8, Math.PI * 0.7, 4, opacity);

            // "bark... arf arf?"
            ctx.fillText('bark...', -45, 5);
            ctx.fillText('arf arf?', -45, 13);
            ctx.beginPath();
            ctx.moveTo(-35, 0);
            ctx.lineTo(-28, -5);
            ctx.stroke();
            this.drawArrowHead(ctx, -28, -5, -Math.PI * 0.3, 4, opacity);

            // "Why so cute?"
            ctx.font = 'bold 9px "Caveat", cursive';
            ctx.fillText('WHY SO', -5, 35);
            ctx.fillText('CUTE?!', -5, 44);
            ctx.beginPath();
            ctx.moveTo(0, 28);
            ctx.lineTo(0, 12);
            ctx.stroke();
            this.drawArrowHead(ctx, 0, 12, -Math.PI / 2, 4, opacity);

            // Dimension line for smolness
            ctx.setLineDash([2, 2]);
            ctx.beginPath();
            ctx.moveTo(-30, 25);
            ctx.lineTo(25, 25);
            ctx.stroke();
            ctx.setLineDash([]);
            ctx.font = '7px "Caveat", cursive';
            ctx.textAlign = 'center';
            ctx.fillText('≈ smol', 0, 32);

        } else if (breed === 'golden') {
            ctx.fillText('CANIS FLOOFICUS', 0, -65);
            ctx.font = '9px "Caveat", cursive';
            ctx.fillText('(maximum floof)', 0, -53);

            // Draw golden body outline (larger, fluffy)
            ctx.strokeStyle = `rgba(232, 228, 220, ${opacity})`;
            ctx.lineWidth = 1.5;

            // Fluffy body (wavy outline)
            ctx.beginPath();
            ctx.moveTo(-25, -5);
            for (let i = 0; i <= 10; i++) {
                const angle = (i / 10) * Math.PI * 2;
                const rx = 28 + Math.sin(i * 3) * 3;
                const ry = 18 + Math.cos(i * 4) * 2;
                ctx.lineTo(Math.cos(angle) * rx, Math.sin(angle) * ry);
            }
            ctx.closePath();
            ctx.stroke();

            // Big happy head
            ctx.beginPath();
            ctx.arc(-30, -10, 15, 0, Math.PI * 2);
            ctx.stroke();

            // Floppy ears
            ctx.beginPath();
            ctx.ellipse(-42, -5, 6, 12, 0.3, 0, Math.PI * 2);
            ctx.stroke();
            ctx.beginPath();
            ctx.ellipse(-20, -5, 6, 12, -0.3, 0, Math.PI * 2);
            ctx.stroke();

            // Snoot
            ctx.beginPath();
            ctx.ellipse(-40, -8, 6, 4, 0, 0, Math.PI * 2);
            ctx.stroke();

            // Tongue out (happy boi)
            ctx.beginPath();
            ctx.moveTo(-38, -4);
            ctx.quadraticCurveTo(-36, 4, -40, 8);
            ctx.stroke();

            // Big fluffy legs
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.moveTo(-15, 16);
            ctx.lineTo(-15, 30);
            ctx.moveTo(15, 16);
            ctx.lineTo(15, 30);
            ctx.moveTo(-5, 16);
            ctx.lineTo(-5, 28);
            ctx.moveTo(5, 16);
            ctx.lineTo(5, 28);
            ctx.stroke();
            ctx.lineWidth = 1.5;

            // Magnificent fluffy tail
            ctx.beginPath();
            ctx.moveTo(28, -5);
            ctx.bezierCurveTo(40, -15, 45, -5, 42, 10);
            ctx.stroke();
            // Floof lines on tail
            for (let i = 0; i < 3; i++) {
                ctx.beginPath();
                ctx.moveTo(35 + i * 3, -8 + i * 5);
                ctx.lineTo(40 + i * 2, -5 + i * 4);
                ctx.stroke();
            }

            // Annotations
            ctx.font = '8px "Caveat", cursive';
            ctx.textAlign = 'left';

            // "Floof → ∞"
            ctx.fillText('floof → ∞', 35, -25);
            ctx.beginPath();
            ctx.moveTo(34, -22);
            ctx.lineTo(28, -12);
            ctx.stroke();
            this.drawArrowHead(ctx, 28, -12, Math.PI * 0.6, 4, opacity);

            // "Bork frequency"
            ctx.fillText('bork freq:', -60, -30);
            ctx.fillText('f(t)=BORK', -60, -22);
            ctx.beginPath();
            ctx.moveTo(-50, -28);
            ctx.lineTo(-40, -18);
            ctx.stroke();
            this.drawArrowHead(ctx, -40, -18, Math.PI * 0.6, 4, opacity);

            // "Happy coefficient"
            ctx.font = 'bold 9px "Caveat", cursive';
            ctx.textAlign = 'center';
            ctx.fillText('happiness', 0, 42);
            ctx.fillText('= MAX', 0, 51);
            ctx.beginPath();
            ctx.moveTo(0, 35);
            ctx.lineTo(-30, -2);
            ctx.stroke();
            this.drawArrowHead(ctx, -30, -2, -Math.PI * 0.7, 4, opacity);

            // Zoomies indicator
            ctx.font = '7px "Caveat", cursive';
            ctx.textAlign = 'right';
            ctx.fillText('zoomies', 50, 20);
            ctx.fillText('potential:', 50, 27);
            ctx.fillText('EXTREME', 50, 34);
        }

        ctx.restore();
    }

    /**
     * Draw arrowhead helper
     */
    drawArrowHead(ctx, x, y, angle, size, opacity) {
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(angle);
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(-size, -size / 2);
        ctx.moveTo(0, 0);
        ctx.lineTo(-size, size / 2);
        ctx.stroke();
        ctx.restore();
    }

    /**
     * Draw a coffee mug with math equation
     */
    drawCoffeeMug(x, y, decoration) {
        const ctx = this.ctx;
        const opacity = decoration.opacity;

        ctx.save();
        ctx.translate(x, y);
        ctx.strokeStyle = `rgba(232, 228, 220, ${opacity})`;
        ctx.fillStyle = `rgba(232, 228, 220, ${opacity * 0.3})`;
        ctx.lineWidth = 1.5;

        // Mug body
        ctx.beginPath();
        ctx.moveTo(-15, -20);
        ctx.lineTo(-15, 15);
        ctx.quadraticCurveTo(-15, 20, -10, 20);
        ctx.lineTo(10, 20);
        ctx.quadraticCurveTo(15, 20, 15, 15);
        ctx.lineTo(15, -20);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        // Handle
        ctx.beginPath();
        ctx.arc(20, 0, 8, -Math.PI / 2, Math.PI / 2);
        ctx.stroke();

        // Coffee level
        ctx.fillStyle = `rgba(139, 90, 43, ${opacity * 0.5})`;
        ctx.fillRect(-13, -5, 26, 23);

        // Steam
        ctx.strokeStyle = `rgba(232, 228, 220, ${opacity * 0.5})`;
        ctx.lineWidth = 1;
        for (let i = 0; i < 3; i++) {
            ctx.beginPath();
            ctx.moveTo(-5 + i * 5, -22);
            ctx.quadraticCurveTo(-3 + i * 5, -30, -5 + i * 5, -35);
            ctx.stroke();
        }

        // Text on mug
        ctx.fillStyle = `rgba(232, 228, 220, ${opacity})`;
        ctx.font = '7px "Caveat", cursive';
        ctx.textAlign = 'center';
        ctx.fillText('I ♥', 0, 0);
        ctx.fillText('MATH', 0, 8);

        // Label
        ctx.font = '8px "Caveat", cursive';
        ctx.fillText('(fuel)', 0, 32);

        ctx.restore();
    }

    /**
     * Draw a treat optimization diagram
     */
    drawTreatDiagram(x, y, decoration) {
        const ctx = this.ctx;
        const opacity = decoration.opacity;

        ctx.save();
        ctx.translate(x, y);
        ctx.fillStyle = `rgba(232, 228, 220, ${opacity})`;
        ctx.strokeStyle = `rgba(232, 228, 220, ${opacity})`;
        ctx.lineWidth = 1;

        // Title
        ctx.font = 'bold 10px "Caveat", cursive';
        ctx.textAlign = 'center';
        ctx.fillText('TREAT', 0, -45);
        ctx.fillText('OPTIMIZATION', 0, -35);

        // Axes
        ctx.beginPath();
        ctx.moveTo(-35, 25);
        ctx.lineTo(-35, -25);
        ctx.lineTo(35, -25);
        ctx.stroke();

        // Axis labels
        ctx.font = '7px "Caveat", cursive';
        ctx.textAlign = 'center';
        ctx.fillText('treats', 0, -28);
        ctx.save();
        ctx.translate(-40, 0);
        ctx.rotate(-Math.PI / 2);
        ctx.fillText('happiness', 0, 0);
        ctx.restore();

        // Curve (exponential happiness)
        ctx.beginPath();
        ctx.moveTo(-33, 20);
        for (let i = 0; i <= 20; i++) {
            const px = -33 + i * 3.3;
            const py = 20 - Math.pow(i / 5, 1.8) * 3;
            ctx.lineTo(px, py);
        }
        ctx.stroke();

        // Data points (bone shapes)
        const points = [[-25, 15], [-10, 5], [5, -10], [20, -20]];
        for (const [px, py] of points) {
            ctx.beginPath();
            ctx.ellipse(px, py, 4, 2, 0, 0, Math.PI * 2);
            ctx.stroke();
            ctx.beginPath();
            ctx.arc(px - 4, py, 1.5, 0, Math.PI * 2);
            ctx.arc(px + 4, py, 1.5, 0, Math.PI * 2);
            ctx.fill();
        }

        // Annotation
        ctx.font = '8px "Caveat", cursive';
        ctx.fillText('lim treats→∞', 15, -5);
        ctx.fillText('= good boi', 15, 3);

        ctx.restore();
    }

    /**
     * Draw a sticky note
     */
    drawStickyNote(x, y, decoration) {
        const ctx = this.ctx;
        const opacity = decoration.opacity;

        ctx.save();
        ctx.translate(x, y);

        // Yellow sticky note background
        ctx.fillStyle = `rgba(255, 245, 157, ${opacity * 0.7})`;
        ctx.beginPath();
        ctx.moveTo(-25, -25);
        ctx.lineTo(25, -25);
        ctx.lineTo(25, 20);
        ctx.lineTo(20, 25);
        ctx.lineTo(-25, 25);
        ctx.closePath();
        ctx.fill();

        // Fold corner
        ctx.fillStyle = `rgba(255, 235, 120, ${opacity * 0.8})`;
        ctx.beginPath();
        ctx.moveTo(25, 20);
        ctx.lineTo(20, 20);
        ctx.lineTo(20, 25);
        ctx.closePath();
        ctx.fill();

        // Border
        ctx.strokeStyle = `rgba(200, 180, 100, ${opacity})`;
        ctx.lineWidth = 1;
        ctx.stroke();

        // Text
        ctx.fillStyle = `rgba(50, 50, 50, ${opacity})`;
        ctx.font = 'bold 11px "Caveat", cursive';
        ctx.textAlign = 'center';
        const lines = decoration.text.split(' ');
        ctx.fillText(lines.slice(0, 2).join(' '), 0, -5);
        if (lines.length > 2) {
            ctx.fillText(lines.slice(2).join(' '), 0, 10);
        }

        ctx.restore();
    }

    /**
     * Draw a ball trajectory diagram
     */
    drawBallTrajectory(x, y, decoration) {
        const ctx = this.ctx;
        const opacity = decoration.opacity;

        ctx.save();
        ctx.translate(x, y);
        ctx.fillStyle = `rgba(232, 228, 220, ${opacity})`;
        ctx.strokeStyle = `rgba(232, 228, 220, ${opacity})`;
        ctx.lineWidth = 1;

        // Title
        ctx.font = 'bold 10px "Caveat", cursive';
        ctx.textAlign = 'center';
        ctx.fillText('BALL PHYSICS', 0, -50);
        ctx.font = '8px "Caveat", cursive';
        ctx.fillText('(very important)', 0, -40);

        // Throw trajectory (parabola)
        ctx.beginPath();
        ctx.moveTo(-40, 20);
        for (let t = 0; t <= 20; t++) {
            const px = -40 + t * 4;
            const py = 20 - (t * 2.5 - t * t * 0.12);
            ctx.lineTo(px, py);
        }
        ctx.stroke();

        // Ball at various positions
        const ballPositions = [
            { x: -40, y: 20, label: 't₀' },
            { x: -10, y: -15, label: 't₁' },
            { x: 20, y: -10, label: 't₂' },
            { x: 40, y: 20, label: 'FETCH!' }
        ];

        ctx.fillStyle = `rgba(255, 200, 100, ${opacity})`;
        for (const ball of ballPositions) {
            ctx.beginPath();
            ctx.arc(ball.x, ball.y, 5, 0, Math.PI * 2);
            ctx.fill();
            ctx.stroke();

            ctx.fillStyle = `rgba(232, 228, 220, ${opacity})`;
            ctx.font = '7px "Caveat", cursive';
            ctx.textAlign = 'center';
            ctx.fillText(ball.label, ball.x, ball.y + 15);
            ctx.fillStyle = `rgba(255, 200, 100, ${opacity})`;
        }

        // Dog running below (stick figure)
        ctx.strokeStyle = `rgba(232, 228, 220, ${opacity})`;
        ctx.beginPath();
        // Body
        ctx.ellipse(10, 35, 12, 6, 0, 0, Math.PI * 2);
        ctx.stroke();
        // Head
        ctx.beginPath();
        ctx.arc(-5, 30, 6, 0, Math.PI * 2);
        ctx.stroke();
        // Running legs
        ctx.beginPath();
        ctx.moveTo(0, 40);
        ctx.lineTo(-8, 50);
        ctx.moveTo(20, 40);
        ctx.lineTo(28, 50);
        ctx.stroke();

        // "ZOOM" text
        ctx.font = 'bold 8px "Caveat", cursive';
        ctx.fillStyle = `rgba(232, 228, 220, ${opacity})`;
        ctx.fillText('ZOOM', 35, 35);
        ctx.fillText('→→→', 35, 43);

        ctx.restore();
    }

    /**
     * Draw the walker (chalk-style top-down view)
     */
    drawWalker(walker) {
        const ctx = this.ctx;
        const pos = this.toScreen(walker.position);

        ctx.save();
        ctx.translate(pos.x, pos.y);
        ctx.rotate(walker.facing + Math.PI / 2); // Adjust for top-down

        // Chalk style settings
        ctx.strokeStyle = this.colors.chalk;
        ctx.fillStyle = this.colors.chalk;
        ctx.lineWidth = 2;
        ctx.lineCap = 'round';

        // Shadow (subtle chalk smudge)
        ctx.fillStyle = this.colors.shadow;
        ctx.beginPath();
        ctx.ellipse(2, 2, 12, 8, 0, 0, Math.PI * 2);
        ctx.fill();

        // Body (chalk outline)
        ctx.strokeStyle = this.colors.chalk;
        ctx.fillStyle = 'rgba(232, 228, 220, 0.3)';
        ctx.beginPath();
        ctx.ellipse(0, 0, 8, 12, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        // Head
        ctx.fillStyle = 'rgba(232, 228, 220, 0.5)';
        ctx.beginPath();
        ctx.arc(0, -10, 6, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        // Eyes (simple dots)
        ctx.fillStyle = this.colors.chalk;
        ctx.beginPath();
        ctx.arc(-2, -10, 1, 0, Math.PI * 2);
        ctx.arc(2, -10, 1, 0, Math.PI * 2);
        ctx.fill();

        // Arms (with swing animation)
        ctx.lineWidth = 3;

        // Left arm
        ctx.save();
        ctx.translate(-6, 0);
        ctx.rotate(walker.armSwing);
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(0, 10);
        ctx.stroke();
        ctx.restore();

        // Right arm (holding leashes)
        ctx.save();
        ctx.translate(6, 0);
        ctx.rotate(-walker.armSwing);
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(0, 10);
        ctx.stroke();
        // Hand (circle)
        ctx.fillStyle = 'rgba(232, 228, 220, 0.6)';
        ctx.beginPath();
        ctx.arc(0, 10, 3, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        ctx.restore();

        // Label
        ctx.fillStyle = this.colors.chalkFaded;
        ctx.font = '10px "Caveat", cursive';
        ctx.textAlign = 'center';
        ctx.fillText('Walker', 0, 20);

        ctx.restore();
    }

    /**
     * Draw a dog (chalk-style top-down view)
     */
    drawDog(dog) {
        const ctx = this.ctx;
        const pos = this.toScreen(dog.position);

        // Get dog's assigned chalk color based on index
        const dogColors = [this.colors.leashA, this.colors.leashB, this.colors.leashC];
        const chalkColor = dog.chalkColor || dogColors[dog.id % 3] || this.colors.chalk;

        ctx.save();
        ctx.translate(pos.x, pos.y);
        ctx.rotate(dog.facing + Math.PI / 2);

        // Chalk style settings
        ctx.lineWidth = 2;
        ctx.lineCap = 'round';

        // Shadow (subtle)
        ctx.fillStyle = this.colors.shadow;
        ctx.beginPath();
        ctx.ellipse(2, 2, 10, 6, 0, 0, Math.PI * 2);
        ctx.fill();

        // Body (chalk outline with light fill)
        ctx.strokeStyle = chalkColor;
        ctx.fillStyle = chalkColor.replace(')', ', 0.2)').replace('rgb', 'rgba');
        ctx.beginPath();
        ctx.ellipse(0, 0, 6, 10, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        // Head
        ctx.fillStyle = chalkColor.replace(')', ', 0.3)').replace('rgb', 'rgba');
        ctx.beginPath();
        ctx.ellipse(0, -10, 5, 6, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        // Ears (simple triangles)
        ctx.beginPath();
        ctx.moveTo(-3, -12);
        ctx.lineTo(-6, -16);
        ctx.lineTo(-1, -14);
        ctx.closePath();
        ctx.stroke();

        ctx.beginPath();
        ctx.moveTo(3, -12);
        ctx.lineTo(6, -16);
        ctx.lineTo(1, -14);
        ctx.closePath();
        ctx.stroke();

        // Snout
        ctx.beginPath();
        ctx.ellipse(0, -14, 2, 2.5, 0, 0, Math.PI * 2);
        ctx.stroke();

        // Nose (filled dot)
        ctx.fillStyle = chalkColor;
        ctx.beginPath();
        ctx.arc(0, -15, 1.5, 0, Math.PI * 2);
        ctx.fill();

        // Eyes
        ctx.beginPath();
        ctx.arc(-2, -10, 1, 0, Math.PI * 2);
        ctx.arc(2, -10, 1, 0, Math.PI * 2);
        ctx.fill();

        // Legs (chalk strokes)
        const legPositions = [
            { x: -4, y: -6 },  // Front left
            { x: 4, y: -6 },   // Front right
            { x: -4, y: 6 },   // Back left
            { x: 4, y: 6 }     // Back right
        ];

        const phase = dog.legCycle % 1;
        const isMoving = dog.velocity.length > 5;

        for (let i = 0; i < 4; i++) {
            const legPhase = phase + (i % 2 === 0 ? 0 : 0.5);
            const offset = isMoving ? Math.sin(legPhase * Math.PI * 2) * 3 : 0;

            ctx.beginPath();
            ctx.arc(legPositions[i].x, legPositions[i].y + offset, 2.5, 0, Math.PI * 2);
            ctx.stroke();
        }

        // Tail (wagging line)
        ctx.save();
        ctx.translate(0, 10);
        ctx.rotate(dog.tailWag);
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.quadraticCurveTo(2, 4, 0, 8);
        ctx.stroke();
        ctx.restore();

        // Collar (colored ring)
        ctx.strokeStyle = chalkColor;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(0, -8, 4, 0, Math.PI * 2);
        ctx.stroke();

        ctx.restore();

        // Dog label with name
        const dogNames = ['A', 'B', 'C'];
        const dogName = dogNames[dog.id % 3] || '?';
        ctx.fillStyle = chalkColor;
        ctx.font = 'bold 12px Arial, "Caveat", sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(`Dog ${dogName}`, pos.x, pos.y + 25);

        // Sniffing indicator
        if (dog.state === 'sniffing') {
            ctx.fillStyle = this.colors.chalk;
            ctx.font = '10px "Caveat", cursive';
            ctx.fillText('*sniff*', pos.x, pos.y - 25);
        }
    }

    /**
     * Draw a rope/leash (chalk-style)
     */
    drawRope(rope, crossings = []) {
        const ctx = this.ctx;

        // Get all segments
        const particles = rope.particles;

        if (particles.length < 2) return;

        // Determine chalk color for this rope
        const ropeColors = [this.colors.leashA, this.colors.leashB, this.colors.leashC];
        const chalkColor = ropeColors[rope.id % 3] || this.colors.chalk;

        // Draw rope shadow (subtle)
        ctx.strokeStyle = this.colors.shadow;
        ctx.lineWidth = rope.thickness + 1;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';

        ctx.beginPath();
        let firstPos = this.toScreen(particles[0].position);
        ctx.moveTo(firstPos.x + 1, firstPos.y + 1);

        for (let i = 1; i < particles.length; i++) {
            const pos = this.toScreen(particles[i].position);
            ctx.lineTo(pos.x + 1, pos.y + 1);
        }
        ctx.stroke();

        // Draw main rope (chalk line with slight glow effect)
        // Glow layer
        ctx.strokeStyle = chalkColor.replace(')', ', 0.3)').replace('#', 'rgba(').replace(/([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})/i, (m, r, g, b) =>
            `${parseInt(r, 16)}, ${parseInt(g, 16)}, ${parseInt(b, 16)}`);
        ctx.lineWidth = rope.thickness + 3;

        ctx.beginPath();
        firstPos = this.toScreen(particles[0].position);
        ctx.moveTo(firstPos.x, firstPos.y);

        for (let i = 1; i < particles.length; i++) {
            const pos = this.toScreen(particles[i].position);
            ctx.lineTo(pos.x, pos.y);
        }
        ctx.stroke();

        // Main chalk line
        ctx.strokeStyle = chalkColor;
        ctx.lineWidth = rope.thickness;

        ctx.beginPath();
        firstPos = this.toScreen(particles[0].position);
        ctx.moveTo(firstPos.x, firstPos.y);

        for (let i = 1; i < particles.length; i++) {
            const pos = this.toScreen(particles[i].position);
            ctx.lineTo(pos.x, pos.y);
        }
        ctx.stroke();

        // Add chalk texture effect (small dots along the rope)
        ctx.fillStyle = chalkColor;
        for (let i = 0; i < particles.length; i += 3) {
            const pos = this.toScreen(particles[i].position);
            const offsetX = (Math.random() - 0.5) * 2;
            const offsetY = (Math.random() - 0.5) * 2;
            ctx.globalAlpha = 0.3;
            ctx.beginPath();
            ctx.arc(pos.x + offsetX, pos.y + offsetY, 1, 0, Math.PI * 2);
            ctx.fill();
        }
        ctx.globalAlpha = 1;

        // Draw crossing indicators
        for (const crossing of crossings) {
            if (crossing.ropeId === rope.id) {
                const pos = this.toScreen(crossing.point);
                ctx.fillStyle = crossing.isOver ? this.colors.crossingOver : this.colors.crossingUnder;
                ctx.beginPath();
                ctx.arc(pos.x, pos.y, 5, 0, Math.PI * 2);
                ctx.fill();
            }
        }
    }

    /**
     * Draw crossing point highlight (chalk-style)
     */
    drawCrossingPoint(point, isOver) {
        const ctx = this.ctx;
        const pos = this.toScreen(point);

        // Chalk glow
        ctx.fillStyle = isOver ? 'rgba(255, 221, 68, 0.3)' : 'rgba(136, 170, 255, 0.3)';
        ctx.beginPath();
        ctx.arc(pos.x, pos.y, 10, 0, Math.PI * 2);
        ctx.fill();

        // Main circle
        ctx.fillStyle = isOver ? this.colors.crossingOver : this.colors.crossingUnder;
        ctx.strokeStyle = this.colors.chalk;
        ctx.lineWidth = 2;

        ctx.beginPath();
        ctx.arc(pos.x, pos.y, 6, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        // Arrow indicator (chalk style)
        ctx.fillStyle = this.colors.board;
        ctx.font = 'bold 10px "Caveat", cursive';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(isOver ? '↑' : '↓', pos.x, pos.y);

        // Label
        ctx.fillStyle = this.colors.chalkFaded;
        ctx.font = '9px "Caveat", cursive';
        ctx.fillText(isOver ? 'σ' : 'σ⁻¹', pos.x, pos.y - 12);
    }

    /**
     * Draw a tangle point with visual indication of wrap angle and lock state
     * Tangles are physical constraints where ropes interlock (chalk-style)
     */
    drawTangle(tangle) {
        const ctx = this.ctx;

        // Get tangle position from the constraint point
        const tanglePoint = tangle.crossingPoint || tangle.particleA?.position;
        if (!tanglePoint) return;

        const pos = this.toScreen(tanglePoint);

        // Calculate visual intensity based on wrap angle
        const wrapDegrees = tangle.wrapAngle * 180 / Math.PI;
        const intensity = Math.min(1, wrapDegrees / 180);

        // Base radius grows with wrap angle
        const baseRadius = 8 + intensity * 6;

        // Chalk glow effect for locked tangles
        if (tangle.isLocked) {
            ctx.fillStyle = this.colors.tangleGlow;
            ctx.beginPath();
            ctx.arc(pos.x, pos.y, baseRadius + 8, 0, Math.PI * 2);
            ctx.fill();
        }

        // Outer ring showing wrap progress (chalk style)
        ctx.strokeStyle = tangle.isLocked ? this.colors.tangleLocked : this.colors.tangleLoose;
        ctx.lineWidth = 3;
        ctx.lineCap = 'round';
        ctx.beginPath();
        const startAngle = -Math.PI / 2;
        const endAngle = startAngle + Math.min(tangle.wrapAngle, Math.PI * 2);
        ctx.arc(pos.x, pos.y, baseRadius, startAngle, endAngle);
        ctx.stroke();

        // Inner circle (chalk outline)
        ctx.strokeStyle = tangle.isLocked ? this.colors.tangleLocked : this.colors.tangleLoose;
        ctx.fillStyle = tangle.isLocked ? 'rgba(255, 102, 102, 0.4)' : 'rgba(255, 170, 68, 0.3)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(pos.x, pos.y, baseRadius - 3, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        // Lock indicator or angle
        if (tangle.isLocked) {
            ctx.fillStyle = this.colors.chalk;
            ctx.font = 'bold 10px "Caveat", cursive';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText('🔒', pos.x, pos.y);
        } else {
            ctx.fillStyle = this.colors.chalk;
            ctx.font = 'bold 9px "Caveat", cursive';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(Math.round(wrapDegrees) + '°', pos.x, pos.y);
        }

        // Capstan friction annotation (chalk style)
        const friction = tangle.getCapstanFriction ? tangle.getCapstanFriction() : 1;
        if (friction > 1.1) {
            ctx.fillStyle = this.colors.chalkFaded;
            ctx.font = '10px "Caveat", cursive';
            ctx.fillText('μ=' + friction.toFixed(1), pos.x, pos.y - baseRadius - 10);
        }
    }

    /**
     * Draw connection lines between tangled rope segments
     */
    drawTangleConnection(tangle) {
        const ctx = this.ctx;

        if (!tangle.particleA || !tangle.particleB) return;

        const posA = this.toScreen(tangle.particleA.position);
        const posB = this.toScreen(tangle.particleB.position);

        // Dashed line connecting the tangled points
        ctx.strokeStyle = tangle.isLocked ? this.colors.tangleLocked : this.colors.tangleLoose;
        ctx.lineWidth = 2;
        ctx.setLineDash([4, 4]);
        ctx.globalAlpha = 0.5;

        ctx.beginPath();
        ctx.moveTo(posA.x, posA.y);
        ctx.lineTo(posB.x, posB.y);
        ctx.stroke();

        ctx.setLineDash([]);
        ctx.globalAlpha = 1;
    }

    /**
     * Complete render pass
     */
    render(simulation) {
        this.beginFrame();

        // Update camera
        if (simulation.walker) {
            this.followEntity(simulation.walker);
        }
        this.updateCamera(1 / 60);

        // Draw layers back to front
        this.drawEnvironment();
        this.drawDecorations();

        // Draw ropes (behind characters)
        for (const rope of simulation.physics.ropes) {
            this.drawRope(rope);
        }

        // Draw tangle connections (behind tangle points)
        if (simulation.physics.tangleConstraints) {
            for (const tangle of simulation.physics.tangleConstraints) {
                this.drawTangleConnection(tangle);
            }
        }

        // Draw active crossing points (temporary indicators)
        if (simulation.activeCrossings) {
            for (const crossing of simulation.activeCrossings) {
                this.drawCrossingPoint(crossing.point, crossing.isOver);
            }
        }

        // Draw tangle points (physical constraints)
        if (simulation.physics.tangleConstraints) {
            for (const tangle of simulation.physics.tangleConstraints) {
                this.drawTangle(tangle);
            }
        }

        // Draw dogs
        for (const dog of simulation.dogs) {
            this.drawDog(dog);
        }

        // Draw walker (on top)
        if (simulation.walker) {
            this.drawWalker(simulation.walker);
        }
    }
}

// Export
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { Renderer };
} else {
    window.Renderer = Renderer;
}
