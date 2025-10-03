import { CONFIG } from "./config.js";


export class TrafficLightController {
    initialize(mode, settings) {
        this.mode = mode;
        this.settings = { ...settings };
        if (mode === CONFIG.MODES.FIXED) {
            this.initializeFixedMode();
        } else if (mode === CONFIG.MODES.ADAPTIVE) {
            this.initializeAdaptiveMode();
        }
    }
    constructor() {
        this.lights = {};
        this.mode = CONFIG.MODES.FIXED;
        this.settings = { ...CONFIG.DEFAULT_SETTINGS };
       
        // Fixed mode state - explicit phases for described cycle
        // 0: NS green, 1: NS yellow, 2: NS red (wait), 3: WE green, 4: WE yellow, 5: WE red (wait)
        this.fixedState = {
            currentPhase: 0,
            phaseTimer: 0,
            isActive: false
        };
       
        // Adaptive mode state - completely independent
        this.adaptiveState = {
            currentPair: null,           // 'WE', 'NS', or null (no active pair)
            currentPhase: 'red',         // 'red', 'yellow', 'green'
            phaseTimer: 0,               // Milliseconds in current phase
            isActive: false,             // Whether adaptive mode is running
            greenPairScores: { north: 0, south: 0, east: 0, west: 0 },  // Cars detected on currently green directions
            redPairScores: { north: 0, south: 0, east: 0, west: 0 },    // Cars waiting on red directions
            redPairWaitTimes: { north: 0, south: 0, east: 0, west: 0 }, // How long cars have been waiting (ms)
            priorityScores: { WE: 0, NS: 0 },    // Combined priority scores for each pair
            lastSwitchTime: 0,           // Timestamp of last pair switch
            firstCarTriggered: false,    // Has first car been detected?
            nextPair: null,              // Which pair gets green after current red phase
            greenLockTime: 0,            // Remaining time in green lock (ms)
            greenLockDuration: 5000,     // Green lock duration = 5 seconds
            currentGreenCarsPassed: 0    // Count of cars that passed during current green
        };
       
        this.initializeLights();

    }

    initializeLights() {
        // Initialize all lights to red
        Object.values(CONFIG.DIRECTIONS).forEach(direction => {
            this.lights[direction] = {
                state: CONFIG.LIGHT_STATES.RED,
                timer: 0
            };
        });
    }

    initializeFixedMode() {
        console.log('Initializing Fixed Mode');
        this.fixedState = {
            currentPhase: 0, // Start with North-South green
            phaseTimer: 0,
            isActive: true
        };
        this.setFixedLightState();
    }


    initializeAdaptiveMode() {
        this.adaptiveState.currentPair = null;      // No pair has green initially
        this.adaptiveState.currentPhase = 'red';    // Start with all red
        this.adaptiveState.phaseTimer = 0;          // Reset timer
        this.adaptiveState.isActive = true;         // Activate adaptive mode
        this.adaptiveState.greenPairScores = { north: 0, south: 0, east: 0, west: 0 };
        this.adaptiveState.redPairScores = { north: 0, south: 0, east: 0, west: 0 };
        this.adaptiveState.redPairWaitTimes = { north: 0, south: 0, east: 0, west: 0 };
        this.adaptiveState.priorityScores = { WE: 0, NS: 0 };
        this.adaptiveState.lastSwitchTime = 0;
        this.adaptiveState.firstCarTriggered = false;
        
        this.setAllLightsRed();  // Set all directions to red
        console.log('Adaptive mode initialized - all lights red, waiting for cars');
    }


    update(deltaTime, mode, settings) {
        this.mode = mode;
        this.settings = { ...settings };


        if (mode === CONFIG.MODES.FIXED) {
            if (!this.fixedState.isActive) {
                this.initializeFixedMode();
            }
            this.updateFixedMode(deltaTime);
        } else if (mode === CONFIG.MODES.ADAPTIVE) {
            if (!this.adaptiveState.isActive) {
                this.initializeAdaptiveMode();
            }
            this.updateAdaptiveMode(deltaTime);
        }
    }


    // FIXED MODE LOGIC - Simple timer-based cycling
    updateFixedMode(deltaTime) {
        this.fixedState.phaseTimer += deltaTime;


        switch (this.fixedState.currentPhase) {
            case 0: // NS green
                if (this.fixedState.phaseTimer >= this.settings.GREEN_DURATION) {
                    this.advanceFixedPhase();
                }
                break;
            case 1: // NS yellow
                if (this.fixedState.phaseTimer >= this.settings.YELLOW_DURATION) {
                    this.advanceFixedPhase();
                }
                break;
            case 2: // NS red (wait)
                if (this.fixedState.phaseTimer >= 3000) { // 3 seconds wait
                    this.advanceFixedPhase();
                }
                break;
            case 3: // WE green
                if (this.fixedState.phaseTimer >= this.settings.GREEN_DURATION) {
                    this.advanceFixedPhase();
                }
                break;
            case 4: // WE yellow
                if (this.fixedState.phaseTimer >= this.settings.YELLOW_DURATION) {
                    this.advanceFixedPhase();
                }
                break;
            case 5: // WE red (wait)
                if (this.fixedState.phaseTimer >= 3000) { // 3 seconds wait
                    this.advanceFixedPhase();
                }
                break;
        }
    }


    advanceFixedPhase() {
    this.fixedState.currentPhase = (this.fixedState.currentPhase + 1) % 6;
    this.fixedState.phaseTimer = 0;
    this.setFixedLightState();
    console.log(`Fixed Mode: Advanced to phase ${this.fixedState.currentPhase}`);
    }


    setFixedLightState() {
        // Reset all lights to red first
        this.setAllLightsRed();


        switch (this.fixedState.currentPhase) {
            case 0: // NS green
                this.lights[CONFIG.DIRECTIONS.NORTH].state = CONFIG.LIGHT_STATES.GREEN;
                this.lights[CONFIG.DIRECTIONS.SOUTH].state = CONFIG.LIGHT_STATES.GREEN;
                break;
            case 1: // NS yellow
                this.lights[CONFIG.DIRECTIONS.NORTH].state = CONFIG.LIGHT_STATES.YELLOW;
                this.lights[CONFIG.DIRECTIONS.SOUTH].state = CONFIG.LIGHT_STATES.YELLOW;
                break;
            case 2: // NS red (wait)
                // All lights remain red
                break;
            case 3: // WE green
                this.lights[CONFIG.DIRECTIONS.WEST].state = CONFIG.LIGHT_STATES.GREEN;
                this.lights[CONFIG.DIRECTIONS.EAST].state = CONFIG.LIGHT_STATES.GREEN;
                break;
            case 4: // WE yellow
                this.lights[CONFIG.DIRECTIONS.WEST].state = CONFIG.LIGHT_STATES.YELLOW;
                this.lights[CONFIG.DIRECTIONS.EAST].state = CONFIG.LIGHT_STATES.YELLOW;
                break;
            case 5: // WE red (wait)
                // All lights remain red
                break;
        }
    }


    // ADAPTIVE MODE LOGIC - THE HEART OF ADAPTIVE MODE
    updateAdaptiveMode(deltaTime) {
        if (!this.adaptiveState.isActive) return;   // Exit if not active

        this.adaptiveState.phaseTimer += deltaTime; // Increment phase timer

        // PHASE 1: WAITING FOR FIRST CAR
        if (this.adaptiveState.currentPair === null) {
            const firstDetectedPair = this.getFirstDetectedPair();
            if (firstDetectedPair) {
                console.log(`🚦 FIRST CAR DETECTED! Starting ${firstDetectedPair} green phase`);
                this.switchToAdaptivePair(firstDetectedPair);
                this.startAdaptiveGreen();
                this.adaptiveState.firstCarTriggered = true;
            }
        } 
        // PHASE 2: ACTIVE TRAFFIC MANAGEMENT
        else {
            if (this.adaptiveState.currentPhase === 'green') {
                // GREEN LOCK LOGIC
                if (this.adaptiveState.greenLockTime > 0) {
                    this.adaptiveState.greenLockTime = Math.max(0, this.adaptiveState.greenLockTime - deltaTime);
                    if (this.adaptiveState.greenLockTime > 0) {
                        this.setAdaptiveLightState();
                        return; // Skip score comparison during lock
                    }
                }

                // DYNAMIC SWITCHING DECISION
                const currentScore = this.calculateCurrentGreenPairScore();
                const waitingScore = this.calculateWaitingRedPairScore();

                const shouldSwitch = waitingScore > currentScore * 1.5 || 
                                   this.adaptiveState.phaseTimer >= this.settings.GREEN_DURATION;

                if (shouldSwitch) {
                    // Green loses - immediately switch to yellow
                    this.startAdaptiveYellow();
                } else {
                    // Green wins - apply 5-second lock
                    this.adaptiveState.greenLockTime = this.adaptiveState.greenLockDuration;
                }
                
            } else if (this.adaptiveState.currentPhase === 'yellow') {
                // YELLOW PHASE
                if (this.adaptiveState.phaseTimer >= this.settings.YELLOW_DURATION) {
                    console.log(`🔴 YELLOW→RED: ${this.adaptiveState.currentPair} going to red`);
                    this.startAdaptiveRed();
                }
                
            } else if (this.adaptiveState.currentPhase === 'red') {
                // RED CLEARANCE PHASE
                if (this.adaptiveState.phaseTimer >= 2000) { // 2 second safety clearance
                    const nextPair = this.adaptiveState.nextPair || this.getOtherPair();
                    console.log(`🟢 RED→GREEN: Switching to GREEN for ${nextPair}`);
                    this.switchToAdaptivePair(nextPair);
                    this.startAdaptiveGreen();
                    this.adaptiveState.nextPair = null;
                }
            }
        }

        this.setAdaptiveLightState(); // Apply current state to actual lights
    }


    // PAIR SWITCHING
    switchToAdaptivePair(pair) {
        this.adaptiveState.currentPair = pair;           // Set new active pair
        this.adaptiveState.lastSwitchTime = Date.now();  // Record switch time
    }

    // GREEN PHASE START
    startAdaptiveGreen() {
        this.adaptiveState.currentPhase = 'green';
        this.adaptiveState.phaseTimer = 0;               // Reset phase timer
        this.adaptiveState.greenLockTime = this.adaptiveState.greenLockDuration; // Start with 5s lock
        this.adaptiveState.currentGreenCarsPassed = 0;   // Reset car counter
    }

    // YELLOW PHASE START
    startAdaptiveYellow() {
        this.adaptiveState.currentPhase = 'yellow';
        this.adaptiveState.phaseTimer = 0;               // Reset for yellow timing
    }

    // RED PHASE START
    startAdaptiveRed() {
        this.adaptiveState.currentPhase = 'red';
        this.adaptiveState.phaseTimer = 0;               // Reset for red clearance timing
    }

    // PHYSICAL LIGHT CONTROL
    setAdaptiveLightState() {
        // Determine what color lights should be
        const state = this.adaptiveState.currentPhase === 'green' ? CONFIG.LIGHT_STATES.GREEN :
                     this.adaptiveState.currentPhase === 'yellow' ? CONFIG.LIGHT_STATES.YELLOW :
                     CONFIG.LIGHT_STATES.RED;

        // Apply to the correct directions
        if (this.adaptiveState.currentPair === 'WE') {
            // West-East gets the current phase color
            this.lights[CONFIG.DIRECTIONS.WEST].state = state;
            this.lights[CONFIG.DIRECTIONS.EAST].state = state;
            // North-South stays red
            this.lights[CONFIG.DIRECTIONS.NORTH].state = CONFIG.LIGHT_STATES.RED;
            this.lights[CONFIG.DIRECTIONS.SOUTH].state = CONFIG.LIGHT_STATES.RED;
            
        } else if (this.adaptiveState.currentPair === 'NS') {
            // North-South gets the current phase color
            this.lights[CONFIG.DIRECTIONS.NORTH].state = state;
            this.lights[CONFIG.DIRECTIONS.SOUTH].state = state;
            // West-East stays red
            this.lights[CONFIG.DIRECTIONS.WEST].state = CONFIG.LIGHT_STATES.RED;
            this.lights[CONFIG.DIRECTIONS.EAST].state = CONFIG.LIGHT_STATES.RED;
            
        } else {
            // No active pair - all lights red (initialization state)
            this.lights[CONFIG.DIRECTIONS.NORTH].state = CONFIG.LIGHT_STATES.RED;
            this.lights[CONFIG.DIRECTIONS.SOUTH].state = CONFIG.LIGHT_STATES.RED;
            this.lights[CONFIG.DIRECTIONS.WEST].state = CONFIG.LIGHT_STATES.RED;
            this.lights[CONFIG.DIRECTIONS.EAST].state = CONFIG.LIGHT_STATES.RED;
        }
    }

    // UTILITY METHODS
    getOtherPair() {
        if (!this.adaptiveState.currentPair) return null;
        return this.adaptiveState.currentPair === 'WE' ? 'NS' : 'WE';
    }

    // FIRST CAR DETECTION
    getFirstDetectedPair() {
        // Determines which pair gets the very first green light
        if (!this.adaptiveState.priorityScores) return null;
        
        const weScore = this.adaptiveState.priorityScores.WE || 0;
        const nsScore = this.adaptiveState.priorityScores.NS || 0;
        
        console.log(`🔍 FIRST CAR DETECTION - Priority Scores: NS=${nsScore}, WE=${weScore}`);
        
        // Return pair with higher initial priority
        if (nsScore > 0 && nsScore >= weScore) return 'NS';
        if (weScore > 0) return 'WE';
        return null; // No cars detected yet
    }

    // CURRENT GREEN PAIR PERFORMANCE
    calculateCurrentGreenPairScore() {
        const currentPair = this.adaptiveState.currentPair;
        if (!currentPair) return 0; // Safety check for null currentPair
        if (currentPair === 'NS') {
            const northScore = this.adaptiveState.greenPairScores.north || 0;
            const southScore = this.adaptiveState.greenPairScores.south || 0;
            return northScore + southScore; // Total cars using NS green
        } else {
            const westScore = this.adaptiveState.greenPairScores.west || 0;
            const eastScore = this.adaptiveState.greenPairScores.east || 0;
            return westScore + eastScore; // Total cars using WE green
        }
    }

    // WAITING PAIR DEMAND with TIME WEIGHTING
    calculateWaitingRedPairScore() {
        const waitingPair = this.getOtherPair(); // Get the pair that's currently red
        if (!waitingPair) return 0; // Safety check for null waitingPair
        if (waitingPair === 'NS') {
            const northScore = this.adaptiveState.redPairScores.north || 0;
            const southScore = this.adaptiveState.redPairScores.south || 0;
            const northWait = this.adaptiveState.redPairWaitTimes.north || 0;
            const southWait = this.adaptiveState.redPairWaitTimes.south || 0;

            // WAIT TIME MULTIPLIER: score × (1 + waitTime/10000)
            // Longer waits = exponentially higher priority
            const northFinal = northScore * (1 + northWait / 10000);
            const southFinal = southScore * (1 + southWait / 10000);
            return northFinal + southFinal;
        } else {
            const westScore = this.adaptiveState.redPairScores.west || 0;
            const eastScore = this.adaptiveState.redPairScores.east || 0;
            const westWait = this.adaptiveState.redPairWaitTimes.west || 0;
            const eastWait = this.adaptiveState.redPairWaitTimes.east || 0;

            const westFinal = westScore * (1 + westWait / 10000);
            const eastFinal = eastScore * (1 + eastWait / 10000);
            return westFinal + eastFinal;
        }
    }

    // SENSOR DATA PROCESSING & SCORE CALCULATION
    updateAdaptiveLogic(sensorData, deltaTime) {
        if (this.mode !== CONFIG.MODES.ADAPTIVE || !this.adaptiveState.isActive) return;

        // DEFAULT DATA STRUCTURE
        if (!sensorData) {
            sensorData = {
                north: { carsWaiting: 0, waitTime: 0, totalCarsDetected: 0 },
                south: { carsWaiting: 0, waitTime: 0, totalCarsDetected: 0 },
                east: { carsWaiting: 0, waitTime: 0, totalCarsDetected: 0 },
                west: { carsWaiting: 0, waitTime: 0, totalCarsDetected: 0 }
            };
        }
        
        // Store for first car detection
        this.adaptiveState.currentSensorData = sensorData;
        
        // CALCULATE PRIORITY SCORES FOR EACH PAIR
        const weScore = this.calculatePairScore('WE', sensorData);
        const nsScore = this.calculatePairScore('NS', sensorData);
        
        this.adaptiveState.priorityScores = { WE: weScore, NS: nsScore };
        
        console.log('🎯 Priority Scores Updated:', this.adaptiveState.priorityScores);

        // DISTRIBUTE SENSOR DATA BASED ON CURRENT LIGHT STATE
        const northData = sensorData[CONFIG.DIRECTIONS.NORTH] || { carsWaiting: 0, waitTime: 0, totalCarsDetected: 0 };
        const southData = sensorData[CONFIG.DIRECTIONS.SOUTH] || { carsWaiting: 0, waitTime: 0, totalCarsDetected: 0 };
        const eastData = sensorData[CONFIG.DIRECTIONS.EAST] || { carsWaiting: 0, waitTime: 0, totalCarsDetected: 0 };
        const westData = sensorData[CONFIG.DIRECTIONS.WEST] || { carsWaiting: 0, waitTime: 0, totalCarsDetected: 0 };

        if (this.adaptiveState.currentPair === 'NS') {
            // NS has green - track throughput
            this.adaptiveState.greenPairScores.north = northData.totalCarsDetected;
            this.adaptiveState.greenPairScores.south = southData.totalCarsDetected;

            // WE is red - track waiting demand
            this.adaptiveState.redPairScores.east = eastData.carsWaiting;
            this.adaptiveState.redPairScores.west = westData.carsWaiting;
            this.adaptiveState.redPairWaitTimes.east = eastData.waitTime;
            this.adaptiveState.redPairWaitTimes.west = westData.waitTime;
            
        } else if (this.adaptiveState.currentPair === 'WE') {
            // WE has green - track throughput
            this.adaptiveState.greenPairScores.east = eastData.totalCarsDetected;
            this.adaptiveState.greenPairScores.west = westData.totalCarsDetected;

            // NS is red - track waiting demand
            this.adaptiveState.redPairScores.north = northData.carsWaiting;
            this.adaptiveState.redPairScores.south = southData.carsWaiting;
            this.adaptiveState.redPairWaitTimes.north = northData.waitTime;
            this.adaptiveState.redPairWaitTimes.south = southData.waitTime;
        } else {
            // No active pair - track all as potential green
            this.adaptiveState.greenPairScores.north = northData.totalCarsDetected;
            this.adaptiveState.greenPairScores.south = southData.totalCarsDetected;
            this.adaptiveState.greenPairScores.east = eastData.totalCarsDetected;
            this.adaptiveState.greenPairScores.west = westData.totalCarsDetected;
        }
    }

    // PRIORITY SCORE FORMULA
    calculatePairScore(pair, sensorData) {
        let totalScore = 0;
        
        if (pair === 'WE') {
            const westData = sensorData[CONFIG.DIRECTIONS.WEST] || { carsWaiting: 0, waitTime: 0, totalCarsDetected: 0 };
            const eastData = sensorData[CONFIG.DIRECTIONS.EAST] || { carsWaiting: 0, waitTime: 0, totalCarsDetected: 0 };
            
            // SCORE FORMULA: (waiting cars × wait time in seconds) + total cars detected
            totalScore = (westData.carsWaiting * (westData.waitTime / 1000)) +
                        (eastData.carsWaiting * (eastData.waitTime / 1000)) +
                        westData.totalCarsDetected + eastData.totalCarsDetected;
                        
        } else if (pair === 'NS') {
            const northData = sensorData[CONFIG.DIRECTIONS.NORTH] || { carsWaiting: 0, waitTime: 0, totalCarsDetected: 0 };
            const southData = sensorData[CONFIG.DIRECTIONS.SOUTH] || { carsWaiting: 0, waitTime: 0, totalCarsDetected: 0 };
            
            totalScore = (northData.carsWaiting * (northData.waitTime / 1000)) +
                        (southData.carsWaiting * (southData.waitTime / 1000)) +
                        northData.totalCarsDetected + southData.totalCarsDetected; 
        }
        
        return totalScore;
    }


    setAllLightsRed() {
        Object.values(CONFIG.DIRECTIONS).forEach(direction => {
            this.lights[direction].state = CONFIG.LIGHT_STATES.RED;
        });
    }


    render(ctx, intersection) {
        const directions = ['north', 'south', 'east', 'west'];
        directions.forEach(direction => {
            const state = this.lights[CONFIG.DIRECTIONS[direction.toUpperCase()]].state;
            this.renderTrafficLight(ctx, direction, state, intersection);
        });
    }


    renderTrafficLight(ctx, direction, state, intersection) {
        const position = intersection.getLightPosition(direction);
        if (!position) return;


        const lightSize = CONFIG.LIGHT_SIZE || 12;
        const spacing = lightSize + 2;


        // Draw light housing
        ctx.fillStyle = '#333';
        ctx.fillRect(position.x - lightSize - 1, position.y - spacing * 1.5 - 1, (lightSize + 1) * 2, spacing * 3 + 2);


        // Draw lights
        const lights = ['red', 'yellow', 'green'];
        lights.forEach((color, index) => {
            const lightY = position.y - spacing + (index * spacing);


            // Light background
            ctx.fillStyle = '#222';
            ctx.beginPath();
            ctx.arc(position.x, lightY, lightSize, 0, Math.PI * 2);
            ctx.fill();


            // Active light
            if (state === color) {
                ctx.fillStyle = color;
                ctx.beginPath();
                ctx.arc(position.x, lightY, lightSize - 2, 0, Math.PI * 2);
                ctx.fill();
            }
        });
    }


    // Public methods for UI and game engine
    getLightStates() {
        const states = {};
        Object.entries(this.lights).forEach(([direction, light]) => {
            states[direction] = light.state;
        });
        return states;
    }


    setMode(mode) {
        this.mode = mode;
        if (mode === CONFIG.MODES.FIXED && !this.fixedState.isActive) {
            this.initializeFixedMode();
        } else if (mode === CONFIG.MODES.ADAPTIVE && !this.adaptiveState.isActive) {
            this.initializeAdaptiveMode();
        }
    }


    updateSettings(settings) {
        this.settings = { ...settings };
    }


    reset() {
        if (this.mode === CONFIG.MODES.FIXED) {
            this.fixedState.isActive = false;
            this.initializeFixedMode();
        } else if (this.mode === CONFIG.MODES.ADAPTIVE) {
            this.adaptiveState.isActive = false;
            this.initializeAdaptiveMode();
        }
        console.log(`${this.mode} mode reset`);
    }


    // Debug methods
    getDebugInfo() {
        if (this.mode === CONFIG.MODES.FIXED) {
            return {
                mode: 'Fixed',
                phase: this.fixedState.currentPhase,
                timer: (this.fixedState.phaseTimer / 1000).toFixed(1) + 's',
                active: this.fixedState.isActive
            };
        } else {
            return {
                mode: 'Adaptive',
                pair: this.adaptiveState.currentPair,
                phase: this.adaptiveState.currentPhase,
                timer: (this.adaptiveState.phaseTimer / 1000).toFixed(1) + 's',
                scores: this.adaptiveState.priorityScores,
                greenLock: (this.adaptiveState.greenLockTime / 1000).toFixed(1) + 's',
                greenScores: this.adaptiveState.greenPairScores,
                redScores: this.adaptiveState.redPairScores,
                waitTimes: this.adaptiveState.redPairWaitTimes,
                active: this.adaptiveState.isActive
            };
        }
    }
}