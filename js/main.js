/**
 * Main Entry Point - UI and game loop
 */

(function() {
    'use strict';

    // Global state
    let simulation = null;
    let renderer = null;
    let lastTime = 0;
    let animationId = null;
    const USE_3D_RENDERER = true; // Toggle between 2D and 3D rendering

    // DOM elements
    const elements = {
        canvas: null,
        walkerSpeedSlider: null,
        walkerSpeedValue: null,
        dogEnergySlider: null,
        dogEnergyValue: null,
        leashSlider: null,
        leashValue: null,
        resetBtn: null,
        pauseBtn: null,
        crossingCount: null,
        tangleMetric: null,
        activeTangles: null,
        capstanFriction: null,
        timeElapsed: null,
        braidWord: null,
        eventLog: null,
        crossingAlert: null,
        tabs: null,
        // State cards
        walkerStateCard: null,
        walkerStateValue: null,
        walkerHandValue: null,
        dogBehaviors: [],
        dogEnergyBars: []
    };

    /**
     * Initialize the application
     */
    function init() {
        // Get DOM elements
        elements.canvas = document.getElementById('simulationCanvas');
        elements.walkerSpeedSlider = document.getElementById('walkerSpeedSlider');
        elements.walkerSpeedValue = document.getElementById('walkerSpeedValue');
        elements.dogEnergySlider = document.getElementById('dogEnergySlider');
        elements.dogEnergyValue = document.getElementById('dogEnergyValue');
        elements.leashSlider = document.getElementById('leashSlider');
        elements.leashValue = document.getElementById('leashValue');
        elements.resetBtn = document.getElementById('resetBtn');
        elements.pauseBtn = document.getElementById('pauseBtn');
        elements.crossingCount = document.getElementById('crossingCount');
        elements.tangleMetric = document.getElementById('tangleMetric');
        elements.activeTangles = document.getElementById('activeTangles');
        elements.capstanFriction = document.getElementById('capstanFriction');
        elements.timeElapsed = document.getElementById('timeElapsed');
        elements.braidWord = document.getElementById('braidWord');
        elements.eventLog = document.getElementById('eventLog');
        elements.crossingAlert = document.getElementById('crossingAlert');
        elements.tabs = document.querySelectorAll('.tab');

        // State card elements
        elements.walkerStateCard = document.getElementById('walkerStateCard');
        elements.walkerStateValue = document.getElementById('walkerStateValue');
        elements.walkerHandValue = document.getElementById('walkerHandValue');
        elements.dogBehaviors = [
            document.getElementById('dogABehavior'),
            document.getElementById('dogBBehavior'),
            document.getElementById('dogCBehavior')
        ];
        elements.dogEnergyBars = [
            document.querySelector('#dogAEnergy .energy-fill'),
            document.querySelector('#dogBEnergy .energy-fill'),
            document.querySelector('#dogCEnergy .energy-fill')
        ];

        // Initialize renderer (3D or 2D based on flag)
        if (USE_3D_RENDERER && typeof Renderer3D !== 'undefined') {
            renderer = new Renderer3D(elements.canvas);
        } else {
            renderer = new Renderer(elements.canvas);
        }

        // Initialize simulation
        simulation = new Simulation({
            leashLength: parseInt(elements.leashSlider.value),
            walkerSpeed: parseFloat(elements.walkerSpeedSlider.value),
            dogEnergy: parseFloat(elements.dogEnergySlider.value)
        });

        // Get canvas dimensions for simulation init (3D renderer uses container size)
        const canvasWidth = renderer.width || elements.canvas.width || 800;
        const canvasHeight = renderer.height || elements.canvas.height || 600;
        simulation.init(canvasWidth, canvasHeight);

        // Set up callbacks
        simulation.onCrossing(handleCrossing);
        simulation.onStatsUpdate(updateStats);

        // Set up UI events
        setupEventListeners();

        // Start the loop
        lastTime = performance.now();
        animationId = requestAnimationFrame(gameLoop);

        // Initial stats update
        updateStats(simulation.getStats());
    }

    /**
     * Main game loop
     */
    function gameLoop(currentTime) {
        const dt = (currentTime - lastTime) / 1000;
        lastTime = currentTime;

        // Update simulation
        simulation.update(dt);

        // Update state cards
        updateStateCards();

        // Render
        renderer.render(simulation);

        // Continue loop
        animationId = requestAnimationFrame(gameLoop);
    }

    /**
     * Update state cards with current walker and dog states
     */
    function updateStateCards() {
        if (!simulation || !simulation.walker) return;

        // Walker state
        const walker = simulation.walker;
        const walkerState = walker.untangleState || 'normal';

        // Format state name for display
        const stateNames = {
            'normal': 'Walking',
            'assessing': 'Assessing...',
            'stepping': 'Stepping Over',
            'turning': 'Turning',
            'waiting': 'Waiting'
        };

        if (elements.walkerStateValue) {
            elements.walkerStateValue.textContent = stateNames[walkerState] || walkerState;
        }

        if (elements.walkerStateCard) {
            elements.walkerStateCard.setAttribute('data-state', walkerState);
        }

        // Walker hand height
        if (elements.walkerHandValue) {
            const handHeight = walker.handHeight || 0;
            if (handHeight > 15) {
                elements.walkerHandValue.textContent = 'Raised High';
            } else if (handHeight > 5) {
                elements.walkerHandValue.textContent = 'Raised';
            } else {
                elements.walkerHandValue.textContent = 'Normal';
            }
        }

        // Dog states
        const dogs = simulation.dogs;
        const behaviorNames = {
            'wander': 'Wandering',
            'followWalker': 'Following',
            'sniff': 'Sniffing',
            'pull': 'Pulling!',
            'avoidOtherDogs': 'Avoiding',
            'avoid': 'Avoiding',
            'pee': 'Marking Territory',
            'socialize': 'Socializing',
            'react_tangle': 'Frustrated!',
            'idle': 'Resting'
        };

        for (let i = 0; i < dogs.length && i < 3; i++) {
            const dog = dogs[i];
            const behaviorEl = elements.dogBehaviors[i];
            const energyBar = elements.dogEnergyBars[i];

            if (behaviorEl) {
                // Get current behavior from dog
                const behavior = dog.currentBehavior || dog.activeBehavior || 'wander';
                const displayName = behaviorNames[behavior] || behavior;
                behaviorEl.textContent = displayName;
                behaviorEl.setAttribute('data-behavior', behavior);
            }

            if (energyBar) {
                // Energy level (0-1 scale, typically around 0.5-1.5)
                const energyPercent = Math.min(100, Math.max(0, (dog.energy || 0.75) / 1.5 * 100));
                energyBar.style.width = energyPercent + '%';

                // Position background gradient based on energy level
                // Low energy = green (left), high energy = red (right)
                const gradientPos = Math.max(0, 100 - energyPercent);
                energyBar.style.backgroundPosition = gradientPos + '% 0';
            }
        }
    }

    /**
     * Handle crossing event
     */
    function handleCrossing(event) {
        // Show alert
        showCrossingAlert(event.description);

        // Add to log
        addEventToLog(event);

        // Update stats immediately
        updateStats(simulation.getStats());
    }

    /**
     * Show crossing alert popup
     */
    function showCrossingAlert(text) {
        const alert = elements.crossingAlert;
        alert.textContent = text;
        alert.style.animation = 'none';
        alert.offsetHeight; // Trigger reflow
        alert.style.animation = 'popIn 0.5s ease forwards, fadeOut 0.3s ease 1.5s forwards';

        // Remove after animation
        setTimeout(() => {
            alert.style.animation = 'none';
        }, 2000);
    }

    /**
     * Add event to the log
     */
    function addEventToLog(event) {
        const logEntry = document.createElement('div');
        logEntry.className = 'event';
        logEntry.textContent = `[${event.time.toFixed(1)}s] ${event.description}`;

        // Insert at top
        elements.eventLog.insertBefore(logEntry, elements.eventLog.firstChild);

        // Limit log size
        while (elements.eventLog.children.length > 20) {
            elements.eventLog.removeChild(elements.eventLog.lastChild);
        }
    }

    /**
     * Update statistics display
     */
    function updateStats(stats) {
        elements.crossingCount.textContent = stats.totalCrossings;
        elements.tangleMetric.textContent = stats.complexity;
        elements.timeElapsed.textContent = stats.elapsedTimeFormatted;
        elements.braidWord.textContent = stats.braidWord;

        // Update tangle-specific stats
        const activeTangleCount = stats.activeTangles || 0;
        const lockedCount = stats.lockedTangles || 0;
        elements.activeTangles.textContent = activeTangleCount + (lockedCount > 0 ? ` (${lockedCount}🔒)` : '');
        elements.capstanFriction.textContent = stats.totalCapstanFriction || '1.0x';

        // Color coding for active tangles
        if (activeTangleCount === 0) {
            elements.activeTangles.style.color = '#28a745'; // Green - no tangles
        } else if (lockedCount === 0) {
            elements.activeTangles.style.color = '#ffc107'; // Yellow - loose tangles
        } else {
            elements.activeTangles.style.color = '#dc3545'; // Red - locked tangles
        }

        // Color coding for Capstan friction (higher = worse)
        const frictionValue = parseFloat(stats.totalCapstanFriction) || 1.0;
        if (frictionValue < 1.5) {
            elements.capstanFriction.style.color = '#28a745'; // Green
        } else if (frictionValue < 3.0) {
            elements.capstanFriction.style.color = '#ffc107'; // Yellow
        } else {
            elements.capstanFriction.style.color = '#dc3545'; // Red - hard to untangle!
        }

        // Color coding for complexity
        if (stats.complexity === 0) {
            elements.tangleMetric.style.color = '#28a745'; // Green - untangled
        } else if (stats.complexity < 5) {
            elements.tangleMetric.style.color = '#ffc107'; // Yellow - mild tangle
        } else {
            elements.tangleMetric.style.color = '#dc3545'; // Red - seriously tangled
        }
    }

    /**
     * Set up UI event listeners
     */
    function setupEventListeners() {
        // Walker speed slider
        elements.walkerSpeedSlider.addEventListener('input', (e) => {
            const value = parseFloat(e.target.value);
            elements.walkerSpeedValue.textContent = value.toFixed(1) + 'x';
            simulation.setConfig('walkerSpeed', value);
        });

        // Dog energy slider
        elements.dogEnergySlider.addEventListener('input', (e) => {
            const value = parseFloat(e.target.value);
            elements.dogEnergyValue.textContent = value.toFixed(1) + 'x';
            simulation.setConfig('dogEnergy', value);

            // Update all dogs
            for (const dog of simulation.dogs) {
                dog.energy = value / 2;
            }
        });

        // Leash length slider
        elements.leashSlider.addEventListener('input', (e) => {
            const value = parseInt(e.target.value);
            elements.leashValue.textContent = value + 'px';
            simulation.setConfig('leashLength', value);
        });

        // Reset button
        elements.resetBtn.addEventListener('click', () => {
            const canvasWidth = renderer.width || elements.canvas.width || 800;
            const canvasHeight = renderer.height || elements.canvas.height || 600;
            simulation.reset(canvasWidth, canvasHeight);
            elements.eventLog.innerHTML = '<div class="event">[0.0s] Simulation reset — walk begins!</div>';
            elements.pauseBtn.textContent = 'Pause'; // Reset pause button state
            updateStats(simulation.getStats());
        });

        // Pause button
        elements.pauseBtn.addEventListener('click', () => {
            const isPaused = simulation.togglePause();
            elements.pauseBtn.textContent = isPaused ? 'Resume' : 'Pause';
        });

        // Tab switching
        elements.tabs.forEach(tab => {
            tab.addEventListener('click', () => {
                const tabName = tab.dataset.tab;
                switchTab(tabName);
            });
        });

        // Handle window resize
        window.addEventListener('resize', () => {
            // Renderer handles its own resize
            // Update simulation bounds
            simulation.physics.bounds = {
                minX: renderer.width / 2 - 200,
                maxX: renderer.width / 2 + 200,
                minY: -10000,
                maxY: renderer.height * 0.7 + 200
            };
        });
    }

    /**
     * Switch between tabs
     */
    function switchTab(tabName) {
        // Update tab buttons
        elements.tabs.forEach(tab => {
            tab.classList.toggle('active', tab.dataset.tab === tabName);
        });

        // Update tab content
        document.querySelectorAll('.tab-content').forEach(content => {
            content.classList.toggle('active', content.id === tabName + 'Tab');
        });

        // Pause simulation when viewing theory
        if (tabName === 'theory') {
            if (!simulation.isPaused) {
                simulation.togglePause();
                elements.pauseBtn.textContent = 'Resume';
            }
        }
    }

    // Initialize when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

})();
