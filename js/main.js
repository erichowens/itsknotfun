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
        timeElapsed: null,
        braidWord: null,
        eventLog: null,
        crossingAlert: null,
        tabs: null
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
        elements.timeElapsed = document.getElementById('timeElapsed');
        elements.braidWord = document.getElementById('braidWord');
        elements.eventLog = document.getElementById('eventLog');
        elements.crossingAlert = document.getElementById('crossingAlert');
        elements.tabs = document.querySelectorAll('.tab');

        // Initialize renderer
        renderer = new Renderer(elements.canvas);

        // Initialize simulation
        simulation = new Simulation({
            leashLength: parseInt(elements.leashSlider.value),
            walkerSpeed: parseFloat(elements.walkerSpeedSlider.value),
            dogEnergy: parseFloat(elements.dogEnergySlider.value)
        });

        simulation.init(renderer.width, renderer.height);

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

        // Render
        renderer.render(simulation);

        // Continue loop
        animationId = requestAnimationFrame(gameLoop);
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
            simulation.reset(renderer.width, renderer.height);
            elements.eventLog.innerHTML = '<div class="event">[0.0s] Simulation reset — walk begins!</div>';
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
