import { CONFIG } from "./config.js";


export class TrafficLightController {
    constructor() {
        this.lights = {};
        this.mode = CONFIG.MODES.FIXED;
        this.settings = { ...CONFIG.DEFAULT_SETTINGS };

        this.fixedState = {
            currentPhase: 0,
            phaseTimer: 0,
            isActive: false
        };

        this.adaptiveState = {
            currentPair: null,
            currentPhase: 'red',
            phaseTimer: 0,
            isActive: false,
            greenPairScores: { north: 0, south: 0, east: 0, west: 0 },
            redPairScores: { north: 0, south: 0, east: 0, west: 0 },
            redPairWaitTimes: { north: 0, south: 0, east: 0, west: 0 },
            priorityScores: { WE: 0, NS: 0 },
            lastSwitchTime: 0,
            firstCarTriggered: false
        };

        this.initializeLights();
    } {
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

        this.fixedState = {
            currentPhase: 0,
            phaseTimer: 0,
            isActive: false
        };

        this.adaptiveState = {
            currentPair: null,
            currentPhase: 'red',
            phaseTimer: 0,
            isActive: false,
            greenPairScores: { north: 0, south: 0, east: 0, west: 0 },
            redPairScores: { north: 0, south: 0, east: 0, west: 0 },
            redPairWaitTimes: { north: 0, south: 0, east: 0, west: 0 },
            lastSwitchTime: 0,
            firstCarTriggered: false,
            currentSensorData: null  // Store current sensor data
        };

        this.initializeLights();

    }

    initializeLights() {
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
            currentPhase: 0,
            phaseTimer: 0,
            isActive: true
        };
        this.setFixedLightState();
    }


    initializeAdaptiveMode() {
        console.log('Initializing Adaptive Mode');
        this.adaptiveState = {
            currentPair: null,
            currentPhase: 'red',
            phaseTimer: 0,
            isActive: true,
            greenPairScores: { north: 0, south: 0, east: 0, west: 0 },
            redPairScores: { north: 0, south: 0, east: 0, west: 0 },
            redPairWaitTimes: { north: 0, south: 0, east: 0, west: 0 },
            lastSwitchTime: 0,
            firstCarTriggered: false
        };
        this.setAllLightsRed();
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


    updateFixedMode(deltaTime) {
        this.fixedState.phaseTimer += deltaTime;


        switch (this.fixedState.currentPhase) {
            case 0:
                if (this.fixedState.phaseTimer >= this.settings.GREEN_DURATION) {
                    this.advanceFixedPhase();
                }
                break;
            case 1:
                if (this.fixedState.phaseTimer >= this.settings.YELLOW_DURATION) {
                    this.advanceFixedPhase();
                }
                break;
            case 2:
                if (this.fixedState.phaseTimer >= 3000) {
                    this.advanceFixedPhase();
                }
                break;
            case 3:
                if (this.fixedState.phaseTimer >= this.settings.GREEN_DURATION) {
                    this.advanceFixedPhase();
                }
                break;
            case 4:
                if (this.fixedState.phaseTimer >= this.settings.YELLOW_DURATION) {
                    this.advanceFixedPhase();
                }
                break;
            case 5:
                if (this.fixedState.phaseTimer >= 3000) {
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
        this.setAllLightsRed();


        switch (this.fixedState.currentPhase) {
            case 0:
                this.lights[CONFIG.DIRECTIONS.NORTH].state = CONFIG.LIGHT_STATES.GREEN;
                this.lights[CONFIG.DIRECTIONS.SOUTH].state = CONFIG.LIGHT_STATES.GREEN;
                break;
            case 1:
                this.lights[CONFIG.DIRECTIONS.NORTH].state = CONFIG.LIGHT_STATES.YELLOW;
                this.lights[CONFIG.DIRECTIONS.SOUTH].state = CONFIG.LIGHT_STATES.YELLOW;
                break;
            case 2:
                break;
            case 3:
                this.lights[CONFIG.DIRECTIONS.WEST].state = CONFIG.LIGHT_STATES.GREEN;
                this.lights[CONFIG.DIRECTIONS.EAST].state = CONFIG.LIGHT_STATES.GREEN;
                break;
            case 4:
                this.lights[CONFIG.DIRECTIONS.WEST].state = CONFIG.LIGHT_STATES.YELLOW;
                this.lights[CONFIG.DIRECTIONS.EAST].state = CONFIG.LIGHT_STATES.YELLOW;
                break;
            case 5:
                break;
        }
    }


    updateAdaptiveMode(deltaTime) {
        this.adaptiveState.phaseTimer += deltaTime;

        if (this.adaptiveState.currentPair === null) {
            const firstDetectedPair = this.getFirstDetectedPair();

            if (firstDetectedPair) {
                console.log(`🚦 FIRST CAR: ${firstDetectedPair} pair gets green light!`);
                this.switchToAdaptivePair(firstDetectedPair);
            }
            return;
        }

        const scoreCalculationInterval = 3000;

        switch (this.adaptiveState.currentPhase) {
            case 'green':
                if (this.adaptiveState.phaseTimer >= scoreCalculationInterval) {
                    const currentPairScore = this.calculateCurrentGreenPairScore();
                    const waitingPairScore = this.calculateWaitingRedPairScore();

                    console.log(`📊 GREEN ${this.adaptiveState.currentPair}: ${currentPairScore.toFixed(1)} vs RED ${this.getOtherPair()}: ${waitingPairScore.toFixed(1)}`);

                    if (waitingPairScore > currentPairScore) {
                        console.log('🚥 RED pair wins! Starting yellow transition...');
                        this.startAdaptiveYellow();
                    } else {
                        console.log('✅ GREEN pair wins! Staying green, recalculating in 3 seconds...');
                        this.adaptiveState.phaseTimer = 0;
                    }
                }
                break;

            case 'yellow':
                if (this.adaptiveState.phaseTimer >= this.settings.YELLOW_DURATION) {
                    this.startAdaptiveRed();
                }
                break;

            case 'red':
                if (this.adaptiveState.phaseTimer >= 1500) {
                    const nextPair = this.getOtherPair();
                    console.log(`🔄 SWITCHING: ${this.adaptiveState.currentPair} → ${nextPair}`);
                    this.switchToAdaptivePair(nextPair);
                }
                break;
        }
    }


    switchToAdaptivePair(pair) {
        this.adaptiveState.currentPair = pair;
        this.startAdaptiveGreen();
    }


    startAdaptiveGreen() {
        this.adaptiveState.currentPhase = 'green';
        this.adaptiveState.phaseTimer = 0;
        this.setAdaptiveLightState();
        console.log(`Adaptive Mode: ${this.adaptiveState.currentPair} lights turned GREEN`);
    }


    startAdaptiveYellow() {
        this.adaptiveState.currentPhase = 'yellow';
        this.adaptiveState.phaseTimer = 0;
        this.setAdaptiveLightState();
        console.log(`Adaptive Mode: ${this.adaptiveState.currentPair} lights turned YELLOW`);
    }


    startAdaptiveRed() {
        this.adaptiveState.currentPhase = 'red';
        this.adaptiveState.phaseTimer = 0;
        this.adaptiveState.lastSwitchTime = Date.now();
        this.setAllLightsRed();
        console.log(`Adaptive Mode: ${this.adaptiveState.currentPair} lights turned RED`);
    }


    setAdaptiveLightState() {
        this.setAllLightsRed();


        if (this.adaptiveState.currentPair === 'WE') {
            const state = this.adaptiveState.currentPhase === 'green' ? CONFIG.LIGHT_STATES.GREEN :
                         this.adaptiveState.currentPhase === 'yellow' ? CONFIG.LIGHT_STATES.YELLOW :
                         CONFIG.LIGHT_STATES.RED;
            this.lights[CONFIG.DIRECTIONS.WEST].state = state;
            this.lights[CONFIG.DIRECTIONS.EAST].state = state;
        } else if (this.adaptiveState.currentPair === 'NS') {
            const state = this.adaptiveState.currentPhase === 'green' ? CONFIG.LIGHT_STATES.GREEN :
                         this.adaptiveState.currentPhase === 'yellow' ? CONFIG.LIGHT_STATES.YELLOW :
                         CONFIG.LIGHT_STATES.RED;
            this.lights[CONFIG.DIRECTIONS.NORTH].state = state;
            this.lights[CONFIG.DIRECTIONS.SOUTH].state = state;
        }
    }


    getFirstDetectedPair() {
        // Use priority scores to determine which pair should get first green light
        if (!this.adaptiveState.priorityScores) return null;
        
        const weScore = this.adaptiveState.priorityScores.WE || 0;
        const nsScore = this.adaptiveState.priorityScores.NS || 0;
        
        console.log(`🔍 FIRST CAR DETECTION - Priority Scores: NS=${nsScore}, WE=${weScore}`);
        
        // Return the pair with higher priority score
        if (nsScore > 0 && nsScore >= weScore) return 'NS';
        if (weScore > 0) return 'WE';
        return null;
    }

    getOtherPair() {
        return this.adaptiveState.currentPair === 'WE' ? 'NS' : 'WE';
    }

    calculateCurrentGreenPairScore() {
        const currentPair = this.adaptiveState.currentPair;
        if (currentPair === 'NS') {
            const northScore = this.adaptiveState.greenPairScores.north || 0;
            const southScore = this.adaptiveState.greenPairScores.south || 0;
            return northScore + southScore;
        } else {
            const westScore = this.adaptiveState.greenPairScores.west || 0;
            const eastScore = this.adaptiveState.greenPairScores.east || 0;
            return westScore + eastScore;
        }
    }

    calculateWaitingRedPairScore() {
        const waitingPair = this.getOtherPair();
        if (waitingPair === 'NS') {
            const northScore = this.adaptiveState.redPairScores.north || 0;
            const southScore = this.adaptiveState.redPairScores.south || 0;
            const northWait = this.adaptiveState.redPairWaitTimes.north || 0;
            const southWait = this.adaptiveState.redPairWaitTimes.south || 0;

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


    updateAdaptiveLogic(sensorData, deltaTime) {
        if (this.mode !== CONFIG.MODES.ADAPTIVE || !this.adaptiveState.isActive) return;

        if (!sensorData) {
            sensorData = {
                north: { carsWaiting: 0, waitTime: 0, totalCarsDetected: 0 },
                south: { carsWaiting: 0, waitTime: 0, totalCarsDetected: 0 },
                east: { carsWaiting: 0, waitTime: 0, totalCarsDetected: 0 },
                west: { carsWaiting: 0, waitTime: 0, totalCarsDetected: 0 }
            };
        }
        
        // Store current sensor data for getFirstDetectedPair to access
        this.adaptiveState.currentSensorData = sensorData;
        
        console.log('📊 updateAdaptiveLogic called with sensor data:', {
            north: sensorData[CONFIG.DIRECTIONS.NORTH]?.totalCarsDetected || 0,
            south: sensorData[CONFIG.DIRECTIONS.SOUTH]?.totalCarsDetected || 0,
            east: sensorData[CONFIG.DIRECTIONS.EAST]?.totalCarsDetected || 0,
            west: sensorData[CONFIG.DIRECTIONS.WEST]?.totalCarsDetected || 0
        });

        // Calculate priority scores for each pair
        const weScore = this.calculatePairScore('WE', sensorData);
        const nsScore = this.calculatePairScore('NS', sensorData);
        
        this.adaptiveState.priorityScores = { WE: weScore, NS: nsScore };
        
        console.log('🎯 Priority Scores Updated:', this.adaptiveState.priorityScores);

        const northData = sensorData[CONFIG.DIRECTIONS.NORTH] || { carsWaiting: 0, waitTime: 0, totalCarsDetected: 0 };
        const southData = sensorData[CONFIG.DIRECTIONS.SOUTH] || { carsWaiting: 0, waitTime: 0, totalCarsDetected: 0 };
        const eastData = sensorData[CONFIG.DIRECTIONS.EAST] || { carsWaiting: 0, waitTime: 0, totalCarsDetected: 0 };
        const westData = sensorData[CONFIG.DIRECTIONS.WEST] || { carsWaiting: 0, waitTime: 0, totalCarsDetected: 0 };

        if (this.adaptiveState.currentPair === 'NS') {
            this.adaptiveState.greenPairScores.north = northData.totalCarsDetected;
            this.adaptiveState.greenPairScores.south = southData.totalCarsDetected;

            this.adaptiveState.redPairScores.east = eastData.carsWaiting;
            this.adaptiveState.redPairScores.west = westData.carsWaiting;
            this.adaptiveState.redPairWaitTimes.east = eastData.waitTime;
            this.adaptiveState.redPairWaitTimes.west = westData.waitTime;
        } else if (this.adaptiveState.currentPair === 'WE') {
            this.adaptiveState.greenPairScores.east = eastData.totalCarsDetected;
            this.adaptiveState.greenPairScores.west = westData.totalCarsDetected;

            this.adaptiveState.redPairScores.north = northData.carsWaiting;
            this.adaptiveState.redPairScores.south = southData.carsWaiting;
            this.adaptiveState.redPairWaitTimes.north = northData.waitTime;
            this.adaptiveState.redPairWaitTimes.south = southData.waitTime;
        } else {
            this.adaptiveState.greenPairScores.north = northData.totalCarsDetected;
            this.adaptiveState.greenPairScores.south = southData.totalCarsDetected;
            this.adaptiveState.greenPairScores.east = eastData.totalCarsDetected;
            this.adaptiveState.greenPairScores.west = westData.totalCarsDetected;
        }
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


        const lightSize = CONFIG.LIGHT_SIZE || 4;
        const spacing = lightSize + 1;


        ctx.fillStyle = '#333';
        ctx.fillRect(position.x - lightSize - 1, position.y - spacing * 1.5 - 1, (lightSize + 1) * 2, spacing * 3 + 2);


        const lights = ['red', 'yellow', 'green'];
        lights.forEach((color, index) => {
            const lightY = position.y - spacing + (index * spacing);


            ctx.fillStyle = '#222';
            ctx.beginPath();
            ctx.arc(position.x, lightY, lightSize, 0, Math.PI * 2);
            ctx.fill();


            if (state === color) {
                ctx.fillStyle = color;
                ctx.beginPath();
                ctx.arc(position.x, lightY, lightSize - 2, 0, Math.PI * 2);
                ctx.fill();
            }
        });
    }


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
                greenScores: this.adaptiveState.greenPairScores,
                redScores: this.adaptiveState.redPairScores,
                waitTimes: this.adaptiveState.redPairWaitTimes,
                active: this.adaptiveState.isActive
            };
        }
    }

    calculatePairScore(pair, sensorData) {
        let totalScore = 0;
        
        if (pair === 'WE') {
            const westData = sensorData[CONFIG.DIRECTIONS.WEST] || { carsWaiting: 0, waitTime: 0, totalCarsDetected: 0 };
            const eastData = sensorData[CONFIG.DIRECTIONS.EAST] || { carsWaiting: 0, waitTime: 0, totalCarsDetected: 0 };
            
            // Score = (cars waiting * wait time in seconds) + total cars detected
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
}