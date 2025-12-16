/**
 * 3D Renderer for Dog Leash Simulation
 *
 * Uses Three.js to render the walker, dogs, and leashes in a chalky, cartoon style
 * with a three-quarter isometric view. The ropes and knots are the visual focus.
 */

class Renderer3D {
    constructor(canvas) {
        this.canvas = canvas;
        this.container = canvas.parentElement;

        // Three.js core
        this.scene = null;
        this.camera = null;
        this.renderer = null;

        // 3D objects
        this.walkerGroup = null;
        this.dogGroups = [];
        this.leashMeshes = [];
        this.tangleSpheres = [];
        this.groundPlane = null;
        this.decorations3D = [];

        // Animation state
        this.walkerBobPhase = 0;
        this.dogAnimPhases = [0, 0.33, 0.66]; // Offset phases for each dog

        // Camera settings - hip height, front-right of walker
        this.cameraDistance = 120; // ~10 meters in front-right
        this.cameraHeight = 35;    // Hip height (~1m in world scale)
        this.cameraAngle = Math.PI / 12; // Slight downward tilt (15 degrees)
        this.cameraRotation = -Math.PI / 4; // 45 degrees to the right-front

        // Camera orbit control state (click and drag)
        this.isDragging = false;
        this.lastMouseX = 0;
        this.lastMouseY = 0;
        this.orbitSensitivity = 0.005; // Inverted controls feel

        // Chalky color palette
        this.colors = {
            background: 0x2a4a3a, // Chalkboard green
            chalk: 0xe8e4dc,
            chalkFaded: 0xc8c4bc,
            ground: 0x1e3a2c,
            gridLine: 0x3a5a4a,

            // Dog/leash colors (chalky pastels)
            leashA: 0xff9999, // Pink
            leashB: 0x99ccff, // Blue
            leashC: 0x99ff99, // Green

            // Tangle indicators
            tangleLoose: 0xffaa44,
            tangleLocked: 0xff6666
        };

        // Rope rendering settings
        this.ropeSegments = 6; // Tube segments around rope (fewer = lighter weight)
        this.ropeRadius = 1.0; // Thinner leashes for realistic look

        this.init();
    }

    init() {
        // Hide the 2D canvas
        this.canvas.style.display = 'none';

        // Create container for 3D
        this.container3D = document.createElement('div');
        this.container3D.id = 'canvas3D';
        this.container3D.style.width = '100%';
        this.container3D.style.height = '500px';
        this.container3D.style.borderRadius = '8px';
        this.container3D.style.overflow = 'hidden';
        this.container.appendChild(this.container3D);

        // Scene
        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(this.colors.background);
        this.scene.fog = new THREE.Fog(this.colors.background, 300, 800);

        // Camera (perspective with three-quarter view)
        const aspect = this.container3D.clientWidth / this.container3D.clientHeight;
        this.camera = new THREE.PerspectiveCamera(45, aspect, 1, 2000);
        this.updateCameraPosition(new THREE.Vector3(0, 0, 0));

        // Renderer
        this.renderer = new THREE.WebGLRenderer({
            antialias: true,
            alpha: false
        });
        this.renderer.setSize(this.container3D.clientWidth, this.container3D.clientHeight);
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        this.renderer.shadowMap.enabled = true;
        this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        this.container3D.appendChild(this.renderer.domElement);

        // Lighting (soft, chalk-like)
        this.setupLighting();

        // Ground plane with grid
        this.createGround();

        // Create chalk dust particles
        this.createChalkDust();

        // Handle resize
        window.addEventListener('resize', () => this.onResize());

        // Setup camera orbit controls (click and drag)
        this.setupCameraControls();

        // Create materials (shared)
        this.createMaterials();
    }

    /**
     * Setup mouse/touch controls for orbiting camera
     * Uses inverted controls (drag left = camera goes right) like many 3rd person games
     */
    setupCameraControls() {
        const canvas = this.renderer.domElement;

        // Mouse controls
        canvas.addEventListener('mousedown', (e) => {
            this.isDragging = true;
            this.lastMouseX = e.clientX;
            this.lastMouseY = e.clientY;
            canvas.style.cursor = 'grabbing';
        });

        canvas.addEventListener('mousemove', (e) => {
            if (!this.isDragging) return;

            const deltaX = e.clientX - this.lastMouseX;
            const deltaY = e.clientY - this.lastMouseY;

            // Inverted horizontal: drag left = rotate camera right (see more of left side)
            this.cameraRotation -= deltaX * this.orbitSensitivity;

            // Inverted vertical: drag up = tilt camera down
            this.cameraAngle += deltaY * this.orbitSensitivity;
            // Clamp vertical angle to prevent flipping
            this.cameraAngle = Math.max(-Math.PI / 3, Math.min(Math.PI / 2.5, this.cameraAngle));

            this.lastMouseX = e.clientX;
            this.lastMouseY = e.clientY;
        });

        canvas.addEventListener('mouseup', () => {
            this.isDragging = false;
            canvas.style.cursor = 'grab';
        });

        canvas.addEventListener('mouseleave', () => {
            this.isDragging = false;
            canvas.style.cursor = 'grab';
        });

        // Touch controls for mobile
        canvas.addEventListener('touchstart', (e) => {
            if (e.touches.length === 1) {
                this.isDragging = true;
                this.lastMouseX = e.touches[0].clientX;
                this.lastMouseY = e.touches[0].clientY;
            }
        });

        canvas.addEventListener('touchmove', (e) => {
            if (!this.isDragging || e.touches.length !== 1) return;

            const deltaX = e.touches[0].clientX - this.lastMouseX;
            const deltaY = e.touches[0].clientY - this.lastMouseY;

            this.cameraRotation -= deltaX * this.orbitSensitivity;
            this.cameraAngle += deltaY * this.orbitSensitivity;
            this.cameraAngle = Math.max(-Math.PI / 3, Math.min(Math.PI / 2.5, this.cameraAngle));

            this.lastMouseX = e.touches[0].clientX;
            this.lastMouseY = e.touches[0].clientY;

            e.preventDefault(); // Prevent scrolling
        }, { passive: false });

        canvas.addEventListener('touchend', () => {
            this.isDragging = false;
        });

        // Scroll wheel for zoom
        canvas.addEventListener('wheel', (e) => {
            this.cameraDistance += e.deltaY * 0.5;
            this.cameraDistance = Math.max(50, Math.min(400, this.cameraDistance));
            e.preventDefault();
        }, { passive: false });

        // Set initial cursor
        canvas.style.cursor = 'grab';
    }

    setupLighting() {
        // Ambient light (soft overall illumination)
        const ambient = new THREE.AmbientLight(0xffffff, 0.6);
        this.scene.add(ambient);

        // Main directional light (top-right, creates depth)
        const mainLight = new THREE.DirectionalLight(0xffffff, 0.8);
        mainLight.position.set(100, 200, 100);
        mainLight.castShadow = true;
        mainLight.shadow.mapSize.width = 1024;
        mainLight.shadow.mapSize.height = 1024;
        mainLight.shadow.camera.near = 10;
        mainLight.shadow.camera.far = 500;
        mainLight.shadow.camera.left = -200;
        mainLight.shadow.camera.right = 200;
        mainLight.shadow.camera.top = 200;
        mainLight.shadow.camera.bottom = -200;
        this.scene.add(mainLight);

        // Fill light from opposite side
        const fillLight = new THREE.DirectionalLight(0x88aacc, 0.3);
        fillLight.position.set(-50, 100, -50);
        this.scene.add(fillLight);

        // Subtle rim light for chalk effect
        const rimLight = new THREE.DirectionalLight(0xffffee, 0.2);
        rimLight.position.set(0, 50, -100);
        this.scene.add(rimLight);
    }

    createMaterials() {
        // Chalky toon-shaded material
        this.chalkMaterial = new THREE.MeshToonMaterial({
            color: this.colors.chalk,
            emissive: 0x111111
        });

        // Walker material (white chalk)
        this.walkerMaterial = new THREE.MeshToonMaterial({
            color: this.colors.chalk,
            emissive: 0x222222
        });

        // Dog materials (colored chalk)
        this.dogMaterials = [
            new THREE.MeshToonMaterial({ color: this.colors.leashA, emissive: 0x331111 }),
            new THREE.MeshToonMaterial({ color: this.colors.leashB, emissive: 0x112233 }),
            new THREE.MeshToonMaterial({ color: this.colors.leashC, emissive: 0x113311 })
        ];

        // Leash materials (same colors as dogs but slightly different)
        this.leashMaterials = [
            new THREE.MeshToonMaterial({ color: this.colors.leashA, emissive: 0x220000 }),
            new THREE.MeshToonMaterial({ color: this.colors.leashB, emissive: 0x001122 }),
            new THREE.MeshToonMaterial({ color: this.colors.leashC, emissive: 0x002200 })
        ];

        // Tangle point materials
        this.tangleLooseMaterial = new THREE.MeshToonMaterial({
            color: this.colors.tangleLoose,
            emissive: 0x332200,
            transparent: true,
            opacity: 0.8
        });

        this.tangleLockedMaterial = new THREE.MeshToonMaterial({
            color: this.colors.tangleLocked,
            emissive: 0x331100,
            transparent: true,
            opacity: 0.9
        });
    }

    createGround() {
        // Environment colors (chalky pastels)
        const envColors = {
            grass: 0x4a7c4a,        // Green grass/yards
            sidewalk: 0x8a8a7a,     // Gray sidewalk
            street: 0x3a3a3a,       // Dark street
            driveway: 0x6a6a5a,     // Concrete driveway
            crosswalk: 0xf0f0e0,    // White crosswalk stripes
            curb: 0x7a7a6a,         // Curb color
            fence: 0x8b6914         // Wooden fence color
        };

        // Base ground (grass - covers everything)
        const groundGeom = new THREE.PlaneGeometry(1000, 2000);
        const groundMat = new THREE.MeshToonMaterial({
            color: envColors.grass,
            side: THREE.DoubleSide
        });
        this.groundPlane = new THREE.Mesh(groundGeom, groundMat);
        this.groundPlane.rotation.x = -Math.PI / 2;
        this.groundPlane.position.y = -1;
        this.groundPlane.receiveShadow = true;
        this.scene.add(this.groundPlane);

        // Street (dark band running along the scene)
        const streetGeom = new THREE.PlaneGeometry(80, 2000);
        const streetMat = new THREE.MeshToonMaterial({ color: envColors.street });
        const street = new THREE.Mesh(streetGeom, streetMat);
        street.rotation.x = -Math.PI / 2;
        street.position.set(-120, 0.1, 0);
        street.receiveShadow = true;
        this.scene.add(street);

        // Street center line (yellow dashes)
        this.createStreetLines(-120, 2000, 0xdddd44);

        // Sidewalk (gray strip on the right side of street)
        const sidewalkGeom = new THREE.PlaneGeometry(40, 2000);
        const sidewalkMat = new THREE.MeshToonMaterial({ color: envColors.sidewalk });
        const sidewalk = new THREE.Mesh(sidewalkGeom, sidewalkMat);
        sidewalk.rotation.x = -Math.PI / 2;
        sidewalk.position.set(-60, 0.2, 0);
        sidewalk.receiveShadow = true;
        this.scene.add(sidewalk);

        // Curbs (raised edges)
        this.createCurb(-80, 2000, envColors.curb);
        this.createCurb(-40, 2000, envColors.curb);

        // Crosswalk at z = -200
        this.createCrosswalk(-120, -200, envColors.crosswalk);

        // Crosswalk at z = 300
        this.createCrosswalk(-120, 300, envColors.crosswalk);

        // Driveways (breaks in the curb going to houses)
        this.createDriveway(-60, -100, envColors.driveway);
        this.createDriveway(-60, 50, envColors.driveway);
        this.createDriveway(-60, 200, envColors.driveway);

        // Simple fences along yards
        this.createFences(envColors.fence);

        // Simple house shapes (blocky, Megaman Legends style)
        this.createHouses();

        // Fire hydrant
        this.createFireHydrant(-55, 150);

        // Mailboxes
        this.createMailbox(-50, -80);
        this.createMailbox(-50, 80);

        // Trees
        this.createTree(-30, -150);
        this.createTree(-35, 100);
        this.createTree(-25, 250);
    }

    /**
     * Create dashed center line for street
     */
    createStreetLines(x, length, color) {
        const dashLength = 20;
        const gapLength = 15;
        const lineWidth = 2;

        const lineMat = new THREE.MeshToonMaterial({ color: color });

        for (let z = -length / 2; z < length / 2; z += dashLength + gapLength) {
            const dashGeom = new THREE.PlaneGeometry(lineWidth, dashLength);
            const dash = new THREE.Mesh(dashGeom, lineMat);
            dash.rotation.x = -Math.PI / 2;
            dash.position.set(x, 0.15, z + dashLength / 2);
            this.scene.add(dash);
        }
    }

    /**
     * Create raised curb along sidewalk edge
     */
    createCurb(x, length, color) {
        const curbGeom = new THREE.BoxGeometry(2, 3, length);
        const curbMat = new THREE.MeshToonMaterial({ color: color });
        const curb = new THREE.Mesh(curbGeom, curbMat);
        curb.position.set(x, 1.5, 0);
        curb.castShadow = true;
        curb.receiveShadow = true;
        this.scene.add(curb);
    }

    /**
     * Create crosswalk stripes
     */
    createCrosswalk(x, z, color) {
        const stripeWidth = 4;
        const stripeLength = 80;
        const stripeGap = 6;
        const numStripes = 8;

        const stripeMat = new THREE.MeshToonMaterial({ color: color });

        for (let i = 0; i < numStripes; i++) {
            const stripeGeom = new THREE.PlaneGeometry(stripeLength, stripeWidth);
            const stripe = new THREE.Mesh(stripeGeom, stripeMat);
            stripe.rotation.x = -Math.PI / 2;
            stripe.position.set(x, 0.2, z + i * (stripeWidth + stripeGap) - (numStripes * (stripeWidth + stripeGap)) / 2);
            this.scene.add(stripe);
        }
    }

    /**
     * Create driveway connecting street to yard
     */
    createDriveway(x, z, color) {
        const drivewayGeom = new THREE.PlaneGeometry(35, 25);
        const drivewayMat = new THREE.MeshToonMaterial({ color: color });
        const driveway = new THREE.Mesh(drivewayGeom, drivewayMat);
        driveway.rotation.x = -Math.PI / 2;
        driveway.position.set(x + 15, 0.3, z);
        driveway.receiveShadow = true;
        this.scene.add(driveway);
    }

    /**
     * Create simple fences along yards
     */
    createFences(color) {
        const fenceMat = new THREE.MeshToonMaterial({ color: color });

        // Fence posts and rails along right side of sidewalk
        const fencePositions = [
            { z: -180, length: 60 },
            { z: -30, length: 50 },
            { z: 130, length: 50 },
            { z: 280, length: 60 }
        ];

        for (const fence of fencePositions) {
            // Horizontal rail
            const railGeom = new THREE.BoxGeometry(3, 2, fence.length);
            const rail = new THREE.Mesh(railGeom, fenceMat);
            rail.position.set(-35, 8, fence.z);
            rail.castShadow = true;
            this.scene.add(rail);

            // Lower rail
            const lowerRail = new THREE.Mesh(railGeom, fenceMat);
            lowerRail.position.set(-35, 4, fence.z);
            lowerRail.castShadow = true;
            this.scene.add(lowerRail);

            // Posts
            const postGeom = new THREE.BoxGeometry(3, 12, 3);
            const numPosts = Math.floor(fence.length / 15) + 1;
            for (let i = 0; i < numPosts; i++) {
                const post = new THREE.Mesh(postGeom, fenceMat);
                post.position.set(-35, 6, fence.z - fence.length / 2 + i * 15);
                post.castShadow = true;
                this.scene.add(post);
            }
        }
    }

    /**
     * Create simple blocky houses (Megaman Legends style)
     */
    createHouses() {
        const housePositions = [
            { x: 30, z: -150, color: 0xcc9999, roofColor: 0x884444 },
            { x: 40, z: 50, color: 0x99cccc, roofColor: 0x446688 },
            { x: 25, z: 200, color: 0xcccc99, roofColor: 0x888844 }
        ];

        for (const house of housePositions) {
            const houseGroup = new THREE.Group();

            // Main body (box)
            const bodyMat = new THREE.MeshToonMaterial({ color: house.color });
            const bodyGeom = new THREE.BoxGeometry(60, 40, 50);
            const body = new THREE.Mesh(bodyGeom, bodyMat);
            body.position.y = 20;
            body.castShadow = true;
            body.receiveShadow = true;
            houseGroup.add(body);

            // Roof (pyramid-ish shape using a cone)
            const roofMat = new THREE.MeshToonMaterial({ color: house.roofColor });
            const roofGeom = new THREE.ConeGeometry(45, 25, 4);
            const roof = new THREE.Mesh(roofGeom, roofMat);
            roof.position.y = 52;
            roof.rotation.y = Math.PI / 4;
            roof.castShadow = true;
            houseGroup.add(roof);

            // Door (dark rectangle)
            const doorMat = new THREE.MeshToonMaterial({ color: 0x553322 });
            const doorGeom = new THREE.BoxGeometry(10, 20, 2);
            const door = new THREE.Mesh(doorGeom, doorMat);
            door.position.set(0, 10, -26);
            houseGroup.add(door);

            // Windows (light rectangles)
            const windowMat = new THREE.MeshToonMaterial({ color: 0xaaddff });
            const windowGeom = new THREE.BoxGeometry(8, 8, 2);

            const window1 = new THREE.Mesh(windowGeom, windowMat);
            window1.position.set(-15, 25, -26);
            houseGroup.add(window1);

            const window2 = new THREE.Mesh(windowGeom, windowMat);
            window2.position.set(15, 25, -26);
            houseGroup.add(window2);

            houseGroup.position.set(house.x, 0, house.z);
            this.scene.add(houseGroup);
        }
    }

    /**
     * Create a fire hydrant
     */
    createFireHydrant(x, z) {
        const hydrantGroup = new THREE.Group();
        const hydrantMat = new THREE.MeshToonMaterial({ color: 0xdd4444 });

        // Main body
        const bodyGeom = new THREE.CylinderGeometry(3, 4, 12, 8);
        const body = new THREE.Mesh(bodyGeom, hydrantMat);
        body.position.y = 6;
        body.castShadow = true;
        hydrantGroup.add(body);

        // Top cap
        const capGeom = new THREE.CylinderGeometry(4, 3, 3, 8);
        const cap = new THREE.Mesh(capGeom, hydrantMat);
        cap.position.y = 13;
        hydrantGroup.add(cap);

        // Side nozzles
        const nozzleGeom = new THREE.CylinderGeometry(1.5, 1.5, 4, 6);
        const leftNozzle = new THREE.Mesh(nozzleGeom, hydrantMat);
        leftNozzle.rotation.z = Math.PI / 2;
        leftNozzle.position.set(-4, 8, 0);
        hydrantGroup.add(leftNozzle);

        const rightNozzle = new THREE.Mesh(nozzleGeom, hydrantMat);
        rightNozzle.rotation.z = Math.PI / 2;
        rightNozzle.position.set(4, 8, 0);
        hydrantGroup.add(rightNozzle);

        hydrantGroup.position.set(x, 0, z);
        this.scene.add(hydrantGroup);
    }

    /**
     * Create a mailbox
     */
    createMailbox(x, z) {
        const mailboxGroup = new THREE.Group();

        // Post
        const postMat = new THREE.MeshToonMaterial({ color: 0x8b6914 });
        const postGeom = new THREE.BoxGeometry(3, 25, 3);
        const post = new THREE.Mesh(postGeom, postMat);
        post.position.y = 12.5;
        post.castShadow = true;
        mailboxGroup.add(post);

        // Box
        const boxMat = new THREE.MeshToonMaterial({ color: 0x333333 });
        const boxGeom = new THREE.BoxGeometry(8, 8, 12);
        const box = new THREE.Mesh(boxGeom, boxMat);
        box.position.set(0, 28, 2);
        box.castShadow = true;
        mailboxGroup.add(box);

        // Flag
        const flagMat = new THREE.MeshToonMaterial({ color: 0xdd4444 });
        const flagGeom = new THREE.BoxGeometry(1, 6, 1);
        const flag = new THREE.Mesh(flagGeom, flagMat);
        flag.position.set(5, 30, 0);
        flag.rotation.z = Math.PI / 6;
        mailboxGroup.add(flag);

        mailboxGroup.position.set(x, 0, z);
        this.scene.add(mailboxGroup);
    }

    /**
     * Create a simple blocky tree
     */
    createTree(x, z) {
        const treeGroup = new THREE.Group();

        // Trunk
        const trunkMat = new THREE.MeshToonMaterial({ color: 0x8b6914 });
        const trunkGeom = new THREE.CylinderGeometry(4, 5, 30, 6);
        const trunk = new THREE.Mesh(trunkGeom, trunkMat);
        trunk.position.y = 15;
        trunk.castShadow = true;
        treeGroup.add(trunk);

        // Foliage (stacked spheres for blocky look)
        const foliageMat = new THREE.MeshToonMaterial({ color: 0x3a7a3a });

        const foliage1 = new THREE.Mesh(new THREE.SphereGeometry(18, 6, 4), foliageMat);
        foliage1.position.y = 40;
        foliage1.castShadow = true;
        treeGroup.add(foliage1);

        const foliage2 = new THREE.Mesh(new THREE.SphereGeometry(14, 6, 4), foliageMat);
        foliage2.position.y = 55;
        foliage2.castShadow = true;
        treeGroup.add(foliage2);

        const foliage3 = new THREE.Mesh(new THREE.SphereGeometry(10, 6, 4), foliageMat);
        foliage3.position.y = 68;
        foliage3.castShadow = true;
        treeGroup.add(foliage3);

        treeGroup.position.set(x, 0, z);
        this.scene.add(treeGroup);
    }

    createChalkDust() {
        // Floating chalk dust particles for atmosphere
        const particleCount = 100;
        const geometry = new THREE.BufferGeometry();
        const positions = new Float32Array(particleCount * 3);

        for (let i = 0; i < particleCount; i++) {
            positions[i * 3] = (Math.random() - 0.5) * 400;
            positions[i * 3 + 1] = Math.random() * 100;
            positions[i * 3 + 2] = (Math.random() - 0.5) * 400;
        }

        geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));

        const material = new THREE.PointsMaterial({
            color: this.colors.chalk,
            size: 2,
            transparent: true,
            opacity: 0.3,
            sizeAttenuation: true
        });

        this.chalkDust = new THREE.Points(geometry, material);
        this.scene.add(this.chalkDust);
    }

    /**
     * Create the 3D walker model (Megaman Legends blocky cartoon style)
     */
    createWalker() {
        this.walkerGroup = new THREE.Group();

        // Megaman Legends style - more angular, blocky shapes
        // Body colors
        const shirtMat = new THREE.MeshToonMaterial({ color: 0x4488dd, emissive: 0x112244 }); // Blue shirt
        const pantsMat = new THREE.MeshToonMaterial({ color: 0x444466, emissive: 0x111122 }); // Dark pants
        const skinMat = new THREE.MeshToonMaterial({ color: 0xffccaa, emissive: 0x221100 });  // Skin tone
        const hairMat = new THREE.MeshToonMaterial({ color: 0x553322, emissive: 0x110000 });  // Brown hair

        // Torso (box - more angular)
        const torsoGeom = new THREE.BoxGeometry(16, 18, 10);
        const torso = new THREE.Mesh(torsoGeom, shirtMat);
        torso.position.y = 24;
        torso.castShadow = true;
        this.walkerGroup.add(torso);

        // Hips/waist (smaller box)
        const hipsGeom = new THREE.BoxGeometry(14, 8, 9);
        const hips = new THREE.Mesh(hipsGeom, pantsMat);
        hips.position.y = 11;
        hips.castShadow = true;
        this.walkerGroup.add(hips);

        // Head (more blocky - rounded box shape)
        const headGeom = new THREE.BoxGeometry(12, 14, 12);
        const head = new THREE.Mesh(headGeom, skinMat);
        head.position.y = 42;
        head.castShadow = true;
        this.walkerGroup.add(head);

        // Hair (cap on top of head)
        const hairGeom = new THREE.BoxGeometry(13, 6, 13);
        const hair = new THREE.Mesh(hairGeom, hairMat);
        hair.position.y = 50;
        hair.castShadow = true;
        this.walkerGroup.add(hair);

        // Eyes (angular shapes)
        const eyeGeom = new THREE.BoxGeometry(2.5, 3, 1);
        const eyeMat = new THREE.MeshToonMaterial({ color: 0x333333 });

        const leftEye = new THREE.Mesh(eyeGeom, eyeMat);
        leftEye.position.set(-3, 43, 6);
        this.walkerGroup.add(leftEye);

        const rightEye = new THREE.Mesh(eyeGeom, eyeMat);
        rightEye.position.set(3, 43, 6);
        this.walkerGroup.add(rightEye);

        // Mouth (simple line)
        const mouthGeom = new THREE.BoxGeometry(4, 1, 1);
        const mouthMat = new THREE.MeshToonMaterial({ color: 0x664444 });
        const mouth = new THREE.Mesh(mouthGeom, mouthMat);
        mouth.position.set(0, 38, 6);
        this.walkerGroup.add(mouth);

        // Arms (boxes - more angular)
        const upperArmGeom = new THREE.BoxGeometry(4, 12, 4);
        const lowerArmGeom = new THREE.BoxGeometry(3.5, 10, 3.5);

        // Left arm (swinging)
        this.walkerLeftUpperArm = new THREE.Mesh(upperArmGeom, shirtMat);
        this.walkerLeftUpperArm.position.set(-12, 27, 0);
        this.walkerLeftUpperArm.castShadow = true;
        this.walkerGroup.add(this.walkerLeftUpperArm);

        this.walkerLeftArm = new THREE.Mesh(lowerArmGeom, skinMat);
        this.walkerLeftArm.position.set(-12, 16, 0);
        this.walkerLeftArm.castShadow = true;
        this.walkerGroup.add(this.walkerLeftArm);

        // Right arm (holding leashes, extended forward)
        this.walkerRightUpperArm = new THREE.Mesh(upperArmGeom, shirtMat);
        this.walkerRightUpperArm.position.set(12, 27, 0);
        this.walkerRightUpperArm.castShadow = true;
        this.walkerGroup.add(this.walkerRightUpperArm);

        this.walkerRightArm = new THREE.Mesh(lowerArmGeom, skinMat);
        this.walkerRightArm.position.set(12, 18, 5);
        this.walkerRightArm.rotation.x = -Math.PI / 6;
        this.walkerRightArm.castShadow = true;
        this.walkerGroup.add(this.walkerRightArm);

        // Hand (blocky sphere shape)
        const handGeom = new THREE.BoxGeometry(4, 4, 4);
        this.walkerHand = new THREE.Mesh(handGeom, skinMat);
        this.walkerHand.position.set(12, 14, 8);
        this.walkerGroup.add(this.walkerHand);

        // Legs (boxes)
        const upperLegGeom = new THREE.BoxGeometry(5, 10, 5);
        const lowerLegGeom = new THREE.BoxGeometry(4.5, 10, 4.5);
        const footGeom = new THREE.BoxGeometry(5, 3, 8);
        const shoeMat = new THREE.MeshToonMaterial({ color: 0x664422, emissive: 0x110000 });

        // Left leg
        const leftUpperLeg = new THREE.Mesh(upperLegGeom, pantsMat);
        leftUpperLeg.position.set(-5, 4, 0);
        leftUpperLeg.castShadow = true;
        this.walkerGroup.add(leftUpperLeg);

        this.walkerLeftLeg = new THREE.Mesh(lowerLegGeom, pantsMat);
        this.walkerLeftLeg.position.set(-5, -5, 0);
        this.walkerLeftLeg.castShadow = true;
        this.walkerGroup.add(this.walkerLeftLeg);

        const leftFoot = new THREE.Mesh(footGeom, shoeMat);
        leftFoot.position.set(-5, -11, 2);
        leftFoot.castShadow = true;
        this.walkerGroup.add(leftFoot);

        // Right leg
        const rightUpperLeg = new THREE.Mesh(upperLegGeom, pantsMat);
        rightUpperLeg.position.set(5, 4, 0);
        rightUpperLeg.castShadow = true;
        this.walkerGroup.add(rightUpperLeg);

        this.walkerRightLeg = new THREE.Mesh(lowerLegGeom, pantsMat);
        this.walkerRightLeg.position.set(5, -5, 0);
        this.walkerRightLeg.castShadow = true;
        this.walkerGroup.add(this.walkerRightLeg);

        const rightFoot = new THREE.Mesh(footGeom, shoeMat);
        rightFoot.position.set(5, -11, 2);
        rightFoot.castShadow = true;
        this.walkerGroup.add(rightFoot);

        this.scene.add(this.walkerGroup);
    }

    /**
     * Create a 3D dog model (Megaman Legends blocky cartoon style)
     */
    createDog(index) {
        const dogGroup = new THREE.Group();
        const material = this.dogMaterials[index % 3];

        // Different dog "breeds" with blocky Megaman Legends styling
        const dogStyles = [
            { name: 'Golden', bodyScale: 1.0, earFlop: true, tailCurl: 0.3 },
            { name: 'Collie', bodyScale: 0.9, earFlop: false, tailCurl: 0.2 },
            { name: 'Beagle', bodyScale: 0.85, earFlop: true, tailCurl: 0.4 }
        ];
        const style = dogStyles[index % 3];

        // Body (blocky box shape)
        const bodyGeom = new THREE.BoxGeometry(16 * style.bodyScale, 12 * style.bodyScale, 24 * style.bodyScale);
        const body = new THREE.Mesh(bodyGeom, material);
        body.position.y = 12;
        body.castShadow = true;
        dogGroup.add(body);

        // Chest (slightly wider front section)
        const chestGeom = new THREE.BoxGeometry(14 * style.bodyScale, 10 * style.bodyScale, 8 * style.bodyScale);
        const chest = new THREE.Mesh(chestGeom, material);
        chest.position.set(0, 12, 10 * style.bodyScale);
        chest.castShadow = true;
        dogGroup.add(chest);

        // Head (blocky box)
        const headGeom = new THREE.BoxGeometry(10 * style.bodyScale, 10 * style.bodyScale, 12 * style.bodyScale);
        const head = new THREE.Mesh(headGeom, material);
        head.position.set(0, 16, 16 * style.bodyScale);
        head.castShadow = true;
        dogGroup.add(head);

        // Snout (smaller box)
        const snoutGeom = new THREE.BoxGeometry(6 * style.bodyScale, 5 * style.bodyScale, 8 * style.bodyScale);
        const snout = new THREE.Mesh(snoutGeom, material);
        snout.position.set(0, 13, 24 * style.bodyScale);
        snout.castShadow = true;
        dogGroup.add(snout);

        // Nose (small dark box)
        const noseGeom = new THREE.BoxGeometry(3, 2, 2);
        const noseMat = new THREE.MeshToonMaterial({ color: 0x222222 });
        const nose = new THREE.Mesh(noseGeom, noseMat);
        nose.position.set(0, 14, 28 * style.bodyScale);
        dogGroup.add(nose);

        // Eyes (blocky shapes)
        const eyeGeom = new THREE.BoxGeometry(2.5, 3, 1);
        const eyeMat = new THREE.MeshToonMaterial({ color: 0x222222 });
        const eyeWhiteGeom = new THREE.BoxGeometry(3.5, 4, 0.5);
        const eyeWhiteMat = new THREE.MeshToonMaterial({ color: 0xffffff });

        // Left eye
        const leftEyeWhite = new THREE.Mesh(eyeWhiteGeom, eyeWhiteMat);
        leftEyeWhite.position.set(-3, 18, 20 * style.bodyScale);
        dogGroup.add(leftEyeWhite);
        const leftEye = new THREE.Mesh(eyeGeom, eyeMat);
        leftEye.position.set(-3, 18, 20.5 * style.bodyScale);
        dogGroup.add(leftEye);

        // Right eye
        const rightEyeWhite = new THREE.Mesh(eyeWhiteGeom, eyeWhiteMat);
        rightEyeWhite.position.set(3, 18, 20 * style.bodyScale);
        dogGroup.add(rightEyeWhite);
        const rightEye = new THREE.Mesh(eyeGeom, eyeMat);
        rightEye.position.set(3, 18, 20.5 * style.bodyScale);
        dogGroup.add(rightEye);

        // Ears (blocky triangular shapes)
        if (style.earFlop) {
            // Floppy ears (like beagle/golden)
            const earGeom = new THREE.BoxGeometry(4, 10, 3);
            const leftEar = new THREE.Mesh(earGeom, material);
            leftEar.position.set(-6, 16, 14 * style.bodyScale);
            leftEar.rotation.z = Math.PI / 8;
            leftEar.castShadow = true;
            dogGroup.add(leftEar);

            const rightEar = new THREE.Mesh(earGeom, material);
            rightEar.position.set(6, 16, 14 * style.bodyScale);
            rightEar.rotation.z = -Math.PI / 8;
            rightEar.castShadow = true;
            dogGroup.add(rightEar);
        } else {
            // Pointy ears (like collie)
            const earGeom = new THREE.ConeGeometry(3, 8, 4);
            const leftEar = new THREE.Mesh(earGeom, material);
            leftEar.position.set(-4, 24, 14 * style.bodyScale);
            leftEar.rotation.z = Math.PI / 10;
            leftEar.castShadow = true;
            dogGroup.add(leftEar);

            const rightEar = new THREE.Mesh(earGeom, material);
            rightEar.position.set(4, 24, 14 * style.bodyScale);
            rightEar.rotation.z = -Math.PI / 10;
            rightEar.castShadow = true;
            dogGroup.add(rightEar);
        }

        // Legs (blocky boxes)
        const legGeom = new THREE.BoxGeometry(4 * style.bodyScale, 12, 4 * style.bodyScale);
        const pawGeom = new THREE.BoxGeometry(5 * style.bodyScale, 3, 6 * style.bodyScale);

        const legPositions = [
            { x: -5 * style.bodyScale, z: 8 * style.bodyScale },   // Front left
            { x: 5 * style.bodyScale, z: 8 * style.bodyScale },    // Front right
            { x: -5 * style.bodyScale, z: -8 * style.bodyScale },  // Back left
            { x: 5 * style.bodyScale, z: -8 * style.bodyScale }    // Back right
        ];

        dogGroup.legs = [];
        for (const pos of legPositions) {
            const leg = new THREE.Mesh(legGeom, material);
            leg.position.set(pos.x, 6, pos.z);
            leg.castShadow = true;
            dogGroup.add(leg);
            dogGroup.legs.push(leg);

            // Paw
            const paw = new THREE.Mesh(pawGeom, material);
            paw.position.set(pos.x, 1, pos.z + 1);
            paw.castShadow = true;
            dogGroup.add(paw);
        }

        // Tail (blocky cylinder shape)
        const tailGeom = new THREE.BoxGeometry(3, 3, 12);
        dogGroup.tail = new THREE.Mesh(tailGeom, material);
        dogGroup.tail.position.set(0, 14, -16 * style.bodyScale);
        dogGroup.tail.rotation.x = Math.PI / 3 + style.tailCurl;
        dogGroup.add(dogGroup.tail);

        // Collar (blocky torus)
        const collarGeom = new THREE.TorusGeometry(6 * style.bodyScale, 1.5, 4, 8);
        const collarColors = [0xdd2222, 0x2222dd, 0x22dd22];
        const collarMat = new THREE.MeshToonMaterial({
            color: collarColors[index % 3]
        });
        const collar = new THREE.Mesh(collarGeom, collarMat);
        collar.position.set(0, 16, 10 * style.bodyScale);
        collar.rotation.x = Math.PI / 2;
        dogGroup.add(collar);

        // Collar tag (small box)
        const tagGeom = new THREE.BoxGeometry(3, 4, 1);
        const tagMat = new THREE.MeshToonMaterial({ color: 0xdddd44 });
        const tag = new THREE.Mesh(tagGeom, tagMat);
        tag.position.set(0, 11, 12 * style.bodyScale);
        dogGroup.add(tag);

        // Store collar position for leash attachment
        dogGroup.collarOffset = new THREE.Vector3(0, 16, 10 * style.bodyScale);

        this.scene.add(dogGroup);
        this.dogGroups.push(dogGroup);

        return dogGroup;
    }

    /**
     * Create or update a leash (3D tube following rope particles)
     * Uses particle.height for Y coordinate to show over/under crossings
     */
    updateLeash(index, particles) {
        // Remove old leash mesh if exists
        if (this.leashMeshes[index]) {
            this.scene.remove(this.leashMeshes[index]);
            this.leashMeshes[index].geometry.dispose();
        }

        if (particles.length < 2) return;

        // Create curve from particle positions (convert 2D to 3D)
        // Use particle.height for the Y coordinate - this creates over/under crossings
        const baseHeight = 10; // Base height above ground
        const heightScale = 3; // Scale factor to make height differences more visible

        const points = particles.map(p => {
            // 2D position maps to X and Z, particle height maps to Y
            const particleHeight = (p.height || 0) * heightScale;
            return new THREE.Vector3(
                p.position.x,
                baseHeight + particleHeight,
                -p.position.y  // 2D Y becomes negative 3D Z (forward)
            );
        });

        // Add subtle sag in the middle of the leash (gravity effect)
        // But preserve height differences from particle bouncing
        for (let i = 0; i < points.length; i++) {
            const t = i / (points.length - 1);
            // Subtle sag in the middle, reduced at endpoints
            const sag = Math.sin(t * Math.PI) * 3;
            points[i].y = Math.max(3, points[i].y - sag);
        }

        const curve = new THREE.CatmullRomCurve3(points);

        // Create tube geometry
        const tubeGeom = new THREE.TubeGeometry(
            curve,
            particles.length * 2,  // Path segments
            this.ropeRadius,       // Radius
            this.ropeSegments,     // Radial segments
            false                  // Closed
        );

        const material = this.leashMaterials[index % 3];
        const tubeMesh = new THREE.Mesh(tubeGeom, material);
        tubeMesh.castShadow = true;

        this.scene.add(tubeMesh);
        this.leashMeshes[index] = tubeMesh;
    }

    /**
     * Update tangle point visualizations
     */
    updateTangles(tangles) {
        // Remove old tangle spheres
        for (const sphere of this.tangleSpheres) {
            this.scene.remove(sphere);
            sphere.geometry.dispose();
        }
        this.tangleSpheres = [];

        // Create new spheres for each tangle
        for (const tangle of tangles) {
            const pos3D = this.to3D(tangle.crossingPoint);
            pos3D.y += 5; // Raise above ropes

            // Size based on wrap angle
            const size = 4 + (tangle.wrapAngle / Math.PI) * 4;

            const geom = new THREE.SphereGeometry(size, 8, 6);
            const material = tangle.isLocked ? this.tangleLockedMaterial : this.tangleLooseMaterial;
            const sphere = new THREE.Mesh(geom, material);
            sphere.position.copy(pos3D);

            // Add pulsing animation data
            sphere.userData.pulsePhase = Math.random() * Math.PI * 2;
            sphere.userData.baseScale = 1;

            this.scene.add(sphere);
            this.tangleSpheres.push(sphere);
        }
    }

    /**
     * Convert 2D simulation position to 3D world position
     * 2D (x, y) → 3D (x, 0, -y) - y becomes negative z (forward is up in 2D)
     */
    to3D(vec2, yHeight = 10) {
        return new THREE.Vector3(vec2.x, yHeight, -vec2.y);
    }

    /**
     * Update camera to follow walker - hip height, orbitable
     */
    updateCameraPosition(targetPos) {
        // Camera orbits around the walker at hip height
        // cameraRotation controls horizontal orbit (yaw)
        // cameraAngle controls vertical tilt (pitch)

        // Horizontal position: orbit around walker
        const cameraX = targetPos.x + Math.sin(this.cameraRotation) * this.cameraDistance;
        const cameraZ = targetPos.z + Math.cos(this.cameraRotation) * this.cameraDistance;

        // Vertical position: hip height + tilt-based offset
        // At angle 0, camera is at hip height; positive angles look down from above
        const verticalOffset = Math.sin(this.cameraAngle) * this.cameraDistance * 0.5;
        const cameraY = this.cameraHeight + verticalOffset;

        this.camera.position.set(cameraX, cameraY, cameraZ);

        // Look at walker's midsection (hip/waist area where leashes are held)
        const lookAtHeight = 25; // Slightly above hip to see dogs and leashes
        this.camera.lookAt(targetPos.x, lookAtHeight, targetPos.z);
    }

    /**
     * Animate walker walking cycle
     * @param dt - Delta time
     * @param isMoving - Whether walker is moving
     * @param handHeight - Height to raise the hand (for untangling)
     * @param untangleState - Current untangle state for body language
     */
    animateWalker(dt, isMoving, handHeight = 0, untangleState = 'normal') {
        if (!this.walkerGroup) return;

        if (isMoving) {
            this.walkerBobPhase += dt * 8;

            // Body bob
            this.walkerGroup.position.y = Math.sin(this.walkerBobPhase * 2) * 2;

            // Arm swing - left arm swings normally
            const armSwing = Math.sin(this.walkerBobPhase) * 0.4;
            this.walkerLeftArm.rotation.x = armSwing;

            // Right arm raises based on handHeight (holding leashes)
            // Higher hand height = arm raised more (negative X rotation points up)
            const raiseAmount = handHeight * 0.02; // Scale factor
            this.walkerRightArm.rotation.x = -armSwing * 0.3 - Math.PI / 6 - raiseAmount;

            // Leg swing
            const legSwing = Math.sin(this.walkerBobPhase) * 0.5;
            this.walkerLeftLeg.rotation.x = legSwing;
            this.walkerRightLeg.rotation.x = -legSwing;
        } else {
            // Idle pose - arm still reflects hand height
            const raiseAmount = handHeight * 0.02;
            this.walkerRightArm.rotation.x = -Math.PI / 6 - raiseAmount;
        }

        // Update hand position based on raised arm
        if (this.walkerHand) {
            // Hand moves up and forward when arm is raised
            const baseY = 17;
            const baseZ = 5;
            this.walkerHand.position.y = baseY + handHeight * 0.5;
            this.walkerHand.position.z = baseZ + handHeight * 0.3;
        }

        // Body language based on untangle state
        if (untangleState === 'assessing' || untangleState === 'waiting') {
            // Slight lean back when assessing/waiting
            this.walkerGroup.rotation.x = 0.05;
        } else if (untangleState === 'stepping') {
            // Slight lean in step direction
            this.walkerGroup.rotation.x = -0.03;
        } else {
            this.walkerGroup.rotation.x = 0;
        }
    }

    /**
     * Animate dog walking/running cycle
     * @param dogGroup - The Three.js group for this dog
     * @param index - Dog index
     * @param dt - Delta time
     * @param velocity - Dog's velocity vector
     * @param dogHeight - Dog's actual height from simulation (from trotting gait)
     */
    animateDog(dogGroup, index, dt, velocity, dogHeight = 0) {
        const speed = Math.sqrt(velocity.x * velocity.x + velocity.y * velocity.y);
        const isMoving = speed > 5;

        if (isMoving) {
            this.dogAnimPhases[index] += dt * (8 + speed * 0.05);
            const phase = this.dogAnimPhases[index];

            // Leg animation (trotting)
            if (dogGroup.legs) {
                dogGroup.legs[0].rotation.x = Math.sin(phase) * 0.5;        // Front left
                dogGroup.legs[1].rotation.x = Math.sin(phase + Math.PI) * 0.5; // Front right
                dogGroup.legs[2].rotation.x = Math.sin(phase + Math.PI) * 0.5; // Back left
                dogGroup.legs[3].rotation.x = Math.sin(phase) * 0.5;        // Back right
            }

            // Body bounce - USE THE ACTUAL DOG HEIGHT from simulation!
            // This ensures the visual matches the physics (which determines over/under crossings)
            const heightScale = 3; // Same scale as leash rendering
            dogGroup.position.y = dogHeight * heightScale;

            // Tail wag
            if (dogGroup.tail) {
                dogGroup.tail.rotation.y = Math.sin(phase * 3) * 0.5;
            }
        } else {
            // Idle animation - gentle tail wag
            this.dogAnimPhases[index] += dt * 3;
            if (dogGroup.tail) {
                dogGroup.tail.rotation.y = Math.sin(this.dogAnimPhases[index]) * 0.3;
            }
        }
    }

    /**
     * Animate tangle points (pulsing glow)
     */
    animateTangles(dt) {
        for (const sphere of this.tangleSpheres) {
            sphere.userData.pulsePhase += dt * 4;
            const scale = sphere.userData.baseScale * (1 + Math.sin(sphere.userData.pulsePhase) * 0.2);
            sphere.scale.setScalar(scale);
        }
    }

    /**
     * Animate floating chalk dust
     */
    animateChalkDust(dt) {
        if (!this.chalkDust) return;

        const positions = this.chalkDust.geometry.attributes.position.array;
        for (let i = 0; i < positions.length; i += 3) {
            positions[i + 1] += Math.sin(Date.now() * 0.001 + i) * 0.1;
            if (positions[i + 1] > 100) positions[i + 1] = 0;
        }
        this.chalkDust.geometry.attributes.position.needsUpdate = true;
    }

    /**
     * Main render function
     */
    render(simulation) {
        const dt = 1 / 60;

        // Create entities if needed
        if (!this.walkerGroup && simulation.walker) {
            this.createWalker();
        }

        while (this.dogGroups.length < simulation.dogs.length) {
            this.createDog(this.dogGroups.length);
        }

        // Update walker position and rotation
        if (simulation.walker && this.walkerGroup) {
            const walkerPos = this.to3D(simulation.walker.position, 0);
            this.walkerGroup.position.x = walkerPos.x;
            this.walkerGroup.position.z = walkerPos.z;
            this.walkerGroup.rotation.y = -simulation.walker.facing + Math.PI / 2;

            // Pass hand height and untangle state for visualization
            const handHeight = simulation.walker.handHeight || 0;
            const untangleState = simulation.walker.untangleState || 'normal';
            this.animateWalker(dt, simulation.walker.velocity?.length > 5, handHeight, untangleState);

            // Update camera to follow
            this.updateCameraPosition(walkerPos);
        }

        // Update dogs
        for (let i = 0; i < simulation.dogs.length; i++) {
            const dog = simulation.dogs[i];
            const dogGroup = this.dogGroups[i];

            if (dogGroup) {
                const dogPos = this.to3D(dog.position, 0);
                dogGroup.position.x = dogPos.x;
                dogGroup.position.z = dogPos.z;
                dogGroup.rotation.y = -dog.facing + Math.PI / 2;

                // Pass dog's actual height from simulation for accurate over/under visualization
                this.animateDog(dogGroup, i, dt, dog.velocity, dog.height || 0);
            }
        }

        // Update leashes
        for (let i = 0; i < simulation.leashes.length; i++) {
            this.updateLeash(i, simulation.leashes[i].particles);
        }

        // Update tangles
        if (simulation.physics?.tangleConstraints) {
            this.updateTangles(simulation.physics.tangleConstraints);
        }

        // Animations
        this.animateTangles(dt);
        this.animateChalkDust(dt);

        // Move ground with camera
        if (this.groundPlane && this.camera) {
            this.groundPlane.position.x = this.camera.position.x;
            this.groundPlane.position.z = this.camera.position.z - 200;
        }

        // Render
        this.renderer.render(this.scene, this.camera);
    }

    onResize() {
        if (!this.container3D) return;

        const width = this.container3D.clientWidth;
        const height = this.container3D.clientHeight;

        this.camera.aspect = width / height;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(width, height);
    }

    /**
     * Clean up
     */
    dispose() {
        // Dispose geometries and materials
        this.scene.traverse(obj => {
            if (obj.geometry) obj.geometry.dispose();
            if (obj.material) {
                if (Array.isArray(obj.material)) {
                    obj.material.forEach(m => m.dispose());
                } else {
                    obj.material.dispose();
                }
            }
        });

        this.renderer.dispose();
        this.container3D.remove();

        // Show 2D canvas again
        this.canvas.style.display = 'block';
    }
}

// Export
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { Renderer3D };
} else {
    window.Renderer3D = Renderer3D;
}
