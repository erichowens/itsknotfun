/**
 * Canvas Renderer for the Leash Simulation
 *
 * Top-down view of suburban sidewalk with:
 * - Scrolling environment (sidewalk, grass, props)
 * - Walker with animated gait
 * - Three dogs with quadruped animation
 * - Rope physics visualization with crossing indicators
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

        // Colors
        this.colors = {
            sidewalk: '#d4d4d4',
            sidewalkLines: '#b8b8b8',
            grass: '#4a7c3f',
            grassDark: '#3d6633',
            sky: '#87CEEB',
            shadow: 'rgba(0, 0, 0, 0.15)',

            // Leash colors (distinct for each dog)
            leashA: '#8B0000', // Dark red
            leashB: '#00008B', // Dark blue
            leashC: '#006400', // Dark green

            // Crossing highlight
            crossingOver: '#FFD700',
            crossingUnder: '#4169E1'
        };

        // Environment props
        this.props = this.generateProps();

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
     * Generate random sidewalk props
     */
    generateProps() {
        const props = [];
        const numProps = 20;

        for (let i = 0; i < numProps; i++) {
            const type = Math.random();
            let prop;

            if (type < 0.3) {
                // Fire hydrant
                prop = {
                    type: 'hydrant',
                    x: Math.random() < 0.5 ? -80 : 80,
                    y: i * 200 + Math.random() * 100,
                    color: '#FF4444'
                };
            } else if (type < 0.5) {
                // Tree
                prop = {
                    type: 'tree',
                    x: Math.random() < 0.5 ? -100 : 100,
                    y: i * 200 + Math.random() * 100,
                    size: 20 + Math.random() * 15
                };
            } else if (type < 0.7) {
                // Mailbox
                prop = {
                    type: 'mailbox',
                    x: Math.random() < 0.5 ? -70 : 70,
                    y: i * 200 + Math.random() * 100,
                    color: '#333366'
                };
            } else {
                // Bush
                prop = {
                    type: 'bush',
                    x: (Math.random() < 0.5 ? -1 : 1) * (60 + Math.random() * 40),
                    y: i * 200 + Math.random() * 100,
                    size: 10 + Math.random() * 10
                };
            }

            props.push(prop);
        }

        return props;
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
     * Draw the suburban environment
     */
    drawEnvironment() {
        const ctx = this.ctx;

        // Sky/background
        ctx.fillStyle = this.colors.sky;
        ctx.fillRect(0, 0, this.width, this.height);

        // Grass on both sides
        const sidewalkWidth = 80;
        const centerX = this.width / 2;

        // Left grass
        ctx.fillStyle = this.colors.grass;
        ctx.fillRect(0, 0, centerX - sidewalkWidth, this.height);

        // Right grass
        ctx.fillRect(centerX + sidewalkWidth, 0, this.width - centerX - sidewalkWidth, this.height);

        // Grass texture (simple stripes)
        ctx.fillStyle = this.colors.grassDark;
        const grassStripeSpacing = 30;
        const stripeOffset = (this.scrollOffset % grassStripeSpacing);

        for (let y = -grassStripeSpacing + stripeOffset; y < this.height + grassStripeSpacing; y += grassStripeSpacing) {
            // Left side stripes
            ctx.fillRect(0, y, centerX - sidewalkWidth, 2);
            // Right side stripes
            ctx.fillRect(centerX + sidewalkWidth, y, this.width - centerX - sidewalkWidth, 2);
        }

        // Sidewalk
        ctx.fillStyle = this.colors.sidewalk;
        ctx.fillRect(centerX - sidewalkWidth, 0, sidewalkWidth * 2, this.height);

        // Sidewalk cracks/lines
        ctx.strokeStyle = this.colors.sidewalkLines;
        ctx.lineWidth = 1;
        const lineSpacing = 60;
        const lineOffset = (this.scrollOffset % lineSpacing);

        for (let y = -lineSpacing + lineOffset; y < this.height + lineSpacing; y += lineSpacing) {
            ctx.beginPath();
            ctx.moveTo(centerX - sidewalkWidth, y);
            ctx.lineTo(centerX + sidewalkWidth, y);
            ctx.stroke();
        }

        // Center line (subtle)
        ctx.strokeStyle = 'rgba(0, 0, 0, 0.05)';
        ctx.setLineDash([10, 10]);
        ctx.beginPath();
        ctx.moveTo(centerX, 0);
        ctx.lineTo(centerX, this.height);
        ctx.stroke();
        ctx.setLineDash([]);
    }

    /**
     * Draw environment props
     */
    drawProps() {
        const ctx = this.ctx;
        const centerX = this.width / 2;

        for (const prop of this.props) {
            const screenY = prop.y + this.cameraOffset.y;

            // Cull off-screen props
            if (screenY < -50 || screenY > this.height + 50) continue;

            const screenX = centerX + prop.x;

            switch (prop.type) {
                case 'hydrant':
                    this.drawHydrant(screenX, screenY, prop.color);
                    break;
                case 'tree':
                    this.drawTree(screenX, screenY, prop.size);
                    break;
                case 'mailbox':
                    this.drawMailbox(screenX, screenY, prop.color);
                    break;
                case 'bush':
                    this.drawBush(screenX, screenY, prop.size);
                    break;
            }
        }
    }

    drawHydrant(x, y, color) {
        const ctx = this.ctx;

        // Shadow
        ctx.fillStyle = this.colors.shadow;
        ctx.beginPath();
        ctx.ellipse(x + 2, y + 2, 8, 4, 0, 0, Math.PI * 2);
        ctx.fill();

        // Body
        ctx.fillStyle = color;
        ctx.fillRect(x - 5, y - 12, 10, 14);

        // Top
        ctx.beginPath();
        ctx.arc(x, y - 12, 5, 0, Math.PI * 2);
        ctx.fill();

        // Side nozzles
        ctx.fillRect(x - 9, y - 8, 4, 4);
        ctx.fillRect(x + 5, y - 8, 4, 4);
    }

    drawTree(x, y, size) {
        const ctx = this.ctx;

        // Shadow
        ctx.fillStyle = this.colors.shadow;
        ctx.beginPath();
        ctx.ellipse(x + 3, y + 3, size * 0.8, size * 0.4, 0, 0, Math.PI * 2);
        ctx.fill();

        // Trunk
        ctx.fillStyle = '#5D4037';
        ctx.fillRect(x - 3, y - 5, 6, 10);

        // Foliage (top-down circle)
        ctx.fillStyle = '#2E7D32';
        ctx.beginPath();
        ctx.arc(x, y - 5, size, 0, Math.PI * 2);
        ctx.fill();

        // Highlight
        ctx.fillStyle = '#4CAF50';
        ctx.beginPath();
        ctx.arc(x - size * 0.3, y - 5 - size * 0.3, size * 0.4, 0, Math.PI * 2);
        ctx.fill();
    }

    drawMailbox(x, y, color) {
        const ctx = this.ctx;

        // Shadow
        ctx.fillStyle = this.colors.shadow;
        ctx.beginPath();
        ctx.ellipse(x + 2, y + 2, 6, 3, 0, 0, Math.PI * 2);
        ctx.fill();

        // Post
        ctx.fillStyle = '#5D4037';
        ctx.fillRect(x - 2, y - 8, 4, 12);

        // Box
        ctx.fillStyle = color;
        ctx.fillRect(x - 8, y - 14, 16, 8);

        // Top curve
        ctx.beginPath();
        ctx.arc(x, y - 14, 8, Math.PI, 0);
        ctx.fill();
    }

    drawBush(x, y, size) {
        const ctx = this.ctx;

        // Shadow
        ctx.fillStyle = this.colors.shadow;
        ctx.beginPath();
        ctx.ellipse(x + 2, y + 2, size, size * 0.5, 0, 0, Math.PI * 2);
        ctx.fill();

        // Bush (multiple overlapping circles)
        ctx.fillStyle = '#388E3C';
        ctx.beginPath();
        ctx.arc(x - size * 0.3, y, size * 0.7, 0, Math.PI * 2);
        ctx.arc(x + size * 0.3, y, size * 0.7, 0, Math.PI * 2);
        ctx.arc(x, y - size * 0.2, size * 0.8, 0, Math.PI * 2);
        ctx.fill();
    }

    /**
     * Draw the walker (top-down view)
     */
    drawWalker(walker) {
        const ctx = this.ctx;
        const pos = this.toScreen(walker.position);

        ctx.save();
        ctx.translate(pos.x, pos.y);
        ctx.rotate(walker.facing + Math.PI / 2); // Adjust for top-down

        // Shadow
        ctx.fillStyle = this.colors.shadow;
        ctx.beginPath();
        ctx.ellipse(2, 2, 12, 8, 0, 0, Math.PI * 2);
        ctx.fill();

        // Body (oval from top)
        ctx.fillStyle = '#4A4A4A'; // Dark jacket
        ctx.beginPath();
        ctx.ellipse(0, 0, 8, 12, 0, 0, Math.PI * 2);
        ctx.fill();

        // Head
        ctx.fillStyle = '#E8C4A0'; // Skin tone
        ctx.beginPath();
        ctx.arc(0, -10, 6, 0, Math.PI * 2);
        ctx.fill();

        // Hair
        ctx.fillStyle = '#3D2314';
        ctx.beginPath();
        ctx.arc(0, -12, 5, Math.PI, 0);
        ctx.fill();

        // Arms (with swing animation)
        const legs = walker.getLegPositions();
        ctx.fillStyle = '#4A4A4A';

        // Left arm
        ctx.save();
        ctx.translate(-6, 0);
        ctx.rotate(walker.armSwing);
        ctx.fillRect(-2, -2, 4, 10);
        ctx.restore();

        // Right arm (holding leashes)
        ctx.save();
        ctx.translate(6, 0);
        ctx.rotate(-walker.armSwing);
        ctx.fillRect(-2, -2, 4, 10);
        // Hand
        ctx.fillStyle = '#E8C4A0';
        ctx.beginPath();
        ctx.arc(0, 10, 3, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();

        ctx.restore();
    }

    /**
     * Draw a dog (top-down view)
     */
    drawDog(dog) {
        const ctx = this.ctx;
        const pos = this.toScreen(dog.position);

        ctx.save();
        ctx.translate(pos.x, pos.y);
        ctx.rotate(dog.facing + Math.PI / 2);

        // Shadow
        ctx.fillStyle = this.colors.shadow;
        ctx.beginPath();
        ctx.ellipse(2, 2, 10, 6, 0, 0, Math.PI * 2);
        ctx.fill();

        // Body (elongated oval)
        ctx.fillStyle = dog.bodyColor || dog.color;
        ctx.beginPath();
        ctx.ellipse(0, 0, 6, 10, 0, 0, Math.PI * 2);
        ctx.fill();

        // Head
        ctx.fillStyle = dog.color;
        ctx.beginPath();
        ctx.ellipse(0, -10, 5, 6, 0, 0, Math.PI * 2);
        ctx.fill();

        // Ears
        ctx.beginPath();
        ctx.ellipse(-4, -12, 3, 4, -0.3, 0, Math.PI * 2);
        ctx.ellipse(4, -12, 3, 4, 0.3, 0, Math.PI * 2);
        ctx.fill();

        // Snout
        ctx.fillStyle = dog.bodyColor || dog.color;
        ctx.beginPath();
        ctx.ellipse(0, -14, 2, 3, 0, 0, Math.PI * 2);
        ctx.fill();

        // Nose
        ctx.fillStyle = '#1a1a1a';
        ctx.beginPath();
        ctx.arc(0, -16, 1.5, 0, Math.PI * 2);
        ctx.fill();

        // Eyes
        ctx.fillStyle = '#1a1a1a';
        ctx.beginPath();
        ctx.arc(-2, -10, 1, 0, Math.PI * 2);
        ctx.arc(2, -10, 1, 0, Math.PI * 2);
        ctx.fill();

        // Legs (four paws visible from top)
        const legs = dog.getLegPositions();
        ctx.fillStyle = dog.color;

        // We're in rotated space, so draw relative to body
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
            ctx.fill();
        }

        // Tail
        ctx.save();
        ctx.translate(0, 10);
        ctx.rotate(dog.tailWag);
        ctx.fillStyle = dog.color;
        ctx.beginPath();
        ctx.moveTo(-1.5, 0);
        ctx.lineTo(0, 8);
        ctx.lineTo(1.5, 0);
        ctx.fill();
        ctx.restore();

        // Collar
        ctx.strokeStyle = '#CC0000';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(0, -8, 4, 0, Math.PI * 2);
        ctx.stroke();

        ctx.restore();

        // Name label (if sniffing)
        if (dog.state === 'sniffing') {
            ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
            ctx.font = '10px sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText('*sniff*', pos.x, pos.y - 25);
        }
    }

    /**
     * Draw a rope/leash
     */
    drawRope(rope, crossings = []) {
        const ctx = this.ctx;

        // Get all segments
        const particles = rope.particles;

        if (particles.length < 2) return;

        // Draw rope shadow first
        ctx.strokeStyle = this.colors.shadow;
        ctx.lineWidth = rope.thickness + 2;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';

        ctx.beginPath();
        let firstPos = this.toScreen(particles[0].position);
        ctx.moveTo(firstPos.x + 2, firstPos.y + 2);

        for (let i = 1; i < particles.length; i++) {
            const pos = this.toScreen(particles[i].position);
            ctx.lineTo(pos.x + 2, pos.y + 2);
        }
        ctx.stroke();

        // Draw main rope
        ctx.strokeStyle = rope.color;
        ctx.lineWidth = rope.thickness;

        ctx.beginPath();
        firstPos = this.toScreen(particles[0].position);
        ctx.moveTo(firstPos.x, firstPos.y);

        for (let i = 1; i < particles.length; i++) {
            const pos = this.toScreen(particles[i].position);
            ctx.lineTo(pos.x, pos.y);
        }
        ctx.stroke();

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
     * Draw crossing point highlight
     */
    drawCrossingPoint(point, isOver) {
        const ctx = this.ctx;
        const pos = this.toScreen(point);

        ctx.fillStyle = isOver ? this.colors.crossingOver : this.colors.crossingUnder;
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 2;

        ctx.beginPath();
        ctx.arc(pos.x, pos.y, 6, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        // Arrow indicator
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 10px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(isOver ? '↑' : '↓', pos.x, pos.y);
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
        this.drawProps();

        // Draw ropes (behind characters)
        for (const rope of simulation.physics.ropes) {
            this.drawRope(rope);
        }

        // Draw active crossing points
        if (simulation.activeCrossings) {
            for (const crossing of simulation.activeCrossings) {
                this.drawCrossingPoint(crossing.point, crossing.isOver);
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
