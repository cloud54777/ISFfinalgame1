import { CONFIG } from "./config.js";

export class SensorSystem {
    constructor(intersection) {
        this.intersection = intersection;
        this.detectorDistance = CONFIG.DEFAULT_SETTINGS.DETECTOR_DISTANCE;
        this.sensorData = {};
        this.carCounts = {};
        this.waitingCars = {};
        this.totalCarsDetected = {};
        
        this.initializeSensors();
    }

    initializeSensors() {
        // Initialize sensor data for each direction
        Object.values(CONFIG.DIRECTIONS).forEach(direction => {
            this.sensorData[direction] = {
                carsWaiting: 0,
                waitTime: 0,
                detectedCars: [],
                firstCarWaitStart: null,
                totalCarsDetected: 0
            };
            this.carCounts[direction] = 0;
            this.waitingCars[direction] = null;
            this.totalCarsDetected[direction] = 0;
        });
    }

    initialize(detectorDistance) {
        this.detectorDistance = detectorDistance;
        this.initializeSensors();
    }

    update(cars, lightStates, prevLightStates) {
        // Reset detection data but keep total counts
        Object.values(CONFIG.DIRECTIONS).forEach(direction => {
            this.sensorData[direction].carsWaiting = 0;
            this.sensorData[direction].waitTime = 0;
            this.sensorData[direction].detectedCars = [];
            // DON'T reset firstCarWaitStart and waitingCars - keep tracking wait time
            // this.sensorData[direction].firstCarWaitStart = null;
            // this.waitingCars[direction] = null;  // This was causing first car to be ignored!
        });

        // Adaptive mode: reset car counts on light cycle change (but preserve timers)
        if (lightStates && prevLightStates) {
            Object.values(CONFIG.DIRECTIONS).forEach(direction => {
                if (lightStates[direction] !== prevLightStates[direction]) {
                    this.resetCarCount(direction);
                    // Only reset waiting count, NOT waitTime or firstCarWaitStart
                    // Keep timer running until car actually moves
                    this.sensorData[direction].carsWaiting = 0;
                }
            });
        }

        // Check if we should reset counts (manual trigger)
        if (this.shouldResetCounts) {
            this.resetAllCarCounts();
            this.shouldResetCounts = false;
        }

        // Process each car
        cars.forEach(car => {
            const direction = car.getDirection();
            const detectionZone = this.getDetectionZone(direction);
            const inZone = this.isCarInDetectionZone(car, detectionZone);

            // Count cars entering detection zone (regardless of light state)
            if (!car._countedInDetector && inZone) {
                car._countedInDetector = true;
                this.totalCarsDetected[direction]++;
                this.sensorData[direction].totalCarsDetected = this.totalCarsDetected[direction];
                console.log(`🚗 CAR DETECTED: ${direction.toUpperCase()} (Total: ${this.totalCarsDetected[direction]}) - Car ${car.id}`);
            }
            if (!inZone && car._countedInDetector) {
                car._countedInDetector = false;
                // Remove car from detectedCars list if it has crossed the stop line (left the detection zone)
                const idx = this.sensorData[direction].detectedCars.indexOf(car);
                if (idx !== -1) {
                    this.sensorData[direction].detectedCars.splice(idx, 1);
                }
            }

            // Handle waiting cars (when light is red OR all lights are red)
            const isRedLight = lightStates && lightStates[direction] === CONFIG.LIGHT_STATES.RED;
            const allLightsRed = !lightStates || Object.values(lightStates).every(state => state === CONFIG.LIGHT_STATES.RED);

            if ((isRedLight || allLightsRed) && inZone) {
                this.sensorData[direction].detectedCars.push(car);

                // If the light is red (or all are red) and the car is in the zone, add the car to the detected list
                // (until it crosses the stop line then it no longer matters - minus it or cancel it).
                // If the car is stopped and waiting, count it as a waiting car.
                if (car.isWaiting()) {
                    this.sensorData[direction].carsWaiting++;
                    // Set as waiting car immediately (first car gets priority)
                    if (!this.waitingCars[direction]) {
                        this.waitingCars[direction] = car;
                        console.log(`⏰ FIRST WAITING CAR: Car ${car.id} from ${direction} - Timer should start!`);
                    }
                    // Start sensor timer if not already started
                    if (!this.sensorData[direction].firstCarWaitStart) {
                        this.sensorData[direction].firstCarWaitStart = Date.now() - car.getWaitTime();
                        console.log(`🚨 SENSOR TIMER STARTED: ${direction.toUpperCase()} - First car timer initiated`);
                    }
                }
            }
        });

        // Calculate wait times for first waiting car in each direction
        Object.values(CONFIG.DIRECTIONS).forEach(direction => {
            if (this.waitingCars[direction]) {
                this.sensorData[direction].waitTime = this.waitingCars[direction].getWaitTime();
                
                // Clean up waiting cars that are no longer waiting
                if (!this.waitingCars[direction].isWaiting()) {
                    console.log(`⏰ CLEARING WAITING CAR: Car ${this.waitingCars[direction].id} from ${direction} no longer waiting`);
                    this.waitingCars[direction] = null;
                    this.sensorData[direction].firstCarWaitStart = null;
                }
            }
        });

        return this.sensorData;
    }


    getDetectionZone(direction) {
        const stopLine = this.intersection.getStopLinePosition(direction);
        const roadWidth = CONFIG.ROAD_WIDTH;
        
        switch (direction) {
            case CONFIG.DIRECTIONS.NORTH:
                return {
                    x1: this.intersection.centerX - roadWidth / 2,
                    y1: stopLine.y1 - this.detectorDistance,
                    x2: this.intersection.centerX + roadWidth / 2,
                    y2: stopLine.y1
                };
            case CONFIG.DIRECTIONS.EAST:
                return {
                    x1: stopLine.x1,
                    y1: this.intersection.centerY - roadWidth / 2,
                    x2: stopLine.x1 + this.detectorDistance,
                    y2: this.intersection.centerY + roadWidth / 2
                };
            case CONFIG.DIRECTIONS.SOUTH:
                return {
                    x1: this.intersection.centerX - roadWidth / 2,
                    y1: stopLine.y1,
                    x2: this.intersection.centerX + roadWidth / 2,
                    y2: stopLine.y1 + this.detectorDistance
                };
            case CONFIG.DIRECTIONS.WEST:
                return {
                    x1: stopLine.x1 - this.detectorDistance,
                    y1: this.intersection.centerY - roadWidth / 2,
                    x2: stopLine.x1,
                    y2: this.intersection.centerY + roadWidth / 2
                };
            default:
                return { x1: 0, y1: 0, x2: 0, y2: 0 };
        }
    }

    isCarInDetectionZone(car, zone) {
        return (
            car.x >= zone.x1 &&
            car.x <= zone.x2 &&
            car.y >= zone.y1 &&
            car.y <= zone.y2
        );
    }

    render(ctx) {
        // Only render in adaptive mode
        if (!this.shouldRenderSensors()) return;

        // Render detection zones with translucent overlay
        ctx.strokeStyle = 'rgba(255, 165, 0, 0.8)';
        ctx.fillStyle = 'rgba(255, 165, 0, 0.1)';
        ctx.lineWidth = 2;
        ctx.setLineDash([5, 5]);

        Object.values(CONFIG.DIRECTIONS).forEach(direction => {
            const zone = this.getDetectionZone(direction);
            
            // Fill detection zone
            ctx.fillRect(zone.x1, zone.y1, zone.x2 - zone.x1, zone.y2 - zone.y1);
            
            // Stroke detection zone border
            ctx.strokeRect(zone.x1, zone.y1, zone.x2 - zone.x1, zone.y2 - zone.y1);
            
            // Show total cars detected (white box)
            this.renderCarCount(ctx, direction, zone);
            
            // Show wait time for first waiting car (smaller red box)
            this.renderWaitTime(ctx, direction, zone);
        });
        
        ctx.setLineDash([]);
    }

    shouldRenderSensors() {
        // Check if we're in adaptive mode by looking at the game engine
        // This is a simple check - in a real implementation you'd pass the mode
        return true; // For now, always render when called
    }

    renderCarCount(ctx, direction, zone) {
        const count = this.totalCarsDetected[direction] || 0;
        
        ctx.fillStyle = 'rgba(255, 255, 255, 0.95)';
        ctx.strokeStyle = '#333';
        ctx.lineWidth = 2;
        ctx.font = 'bold 14px Arial';
        ctx.textAlign = 'center';
        
        let textX, textY;
        
        switch (direction) {
            case CONFIG.DIRECTIONS.NORTH:
                textX = zone.x1 - 40;
                textY = (zone.y1 + zone.y2) / 2;
                break;
            case CONFIG.DIRECTIONS.SOUTH:
                textX = zone.x2 + 40;
                textY = (zone.y1 + zone.y2) / 2;
                break;
            case CONFIG.DIRECTIONS.EAST:
                textX = (zone.x1 + zone.x2) / 2;
                textY = zone.y1 - 20;
                break;
            case CONFIG.DIRECTIONS.WEST:
                textX = (zone.x1 + zone.x2) / 2;
                textY = zone.y2 + 30;
                break;
        }
        
        // Draw background box
        const text = count.toString();
        const textWidth = ctx.measureText(text).width;
        const boxWidth = Math.max(textWidth + 10, 30);
        const boxHeight = 20;
        
        ctx.fillRect(textX - boxWidth/2, textY - boxHeight/2, boxWidth, boxHeight);
        ctx.strokeRect(textX - boxWidth/2, textY - boxHeight/2, boxWidth, boxHeight);
        
        // Draw count text
        ctx.fillStyle = '#333';
        ctx.fillText(text, textX, textY + 4);
        
        // Add direction label
        ctx.font = 'bold 10px Arial';
        ctx.fillText(direction.charAt(0).toUpperCase(), textX, textY - 15);
    }

    renderWaitTime(ctx, direction, zone) {
        const waitingCar = this.waitingCars[direction];
        if (!waitingCar) return;
        
        const waitTime = (waitingCar.getWaitTime() / 1000).toFixed(1);
        
        ctx.fillStyle = 'rgba(255, 255, 255, 0.95)';
        ctx.strokeStyle = '#ff4444';
        ctx.lineWidth = 1; // Smaller line width
        ctx.font = 'bold 10px Arial'; // Smaller font
        ctx.textAlign = 'center';
        
        let textX, textY;
        
        switch (direction) {
            case CONFIG.DIRECTIONS.NORTH:
                textX = zone.x2 + 30; // Closer to zone
                textY = (zone.y1 + zone.y2) / 2;
                break;
            case CONFIG.DIRECTIONS.SOUTH:
                textX = zone.x1 - 30; // Closer to zone
                textY = (zone.y1 + zone.y2) / 2;
                break;
            case CONFIG.DIRECTIONS.EAST:
                textX = (zone.x1 + zone.x2) / 2;
                textY = zone.y2 + 30; // Closer to zone
                break;
            case CONFIG.DIRECTIONS.WEST:
                textX = (zone.x1 + zone.x2) / 2;
                textY = zone.y1 - 25; // Closer to zone
                break;
        }
        
        // Draw smaller background box
        const text = `${waitTime}s`;
        const textWidth = ctx.measureText(text).width;
        const boxWidth = Math.max(textWidth + 6, 20); // Smaller box
        const boxHeight = 14; // Smaller height
        
        ctx.fillRect(textX - boxWidth/2, textY - boxHeight/2, boxWidth, boxHeight);
        ctx.strokeRect(textX - boxWidth/2, textY - boxHeight/2, boxWidth, boxHeight);
        
        // Draw wait time text
        ctx.fillStyle = '#ff4444';
        ctx.fillText(text, textX, textY + 2);
    }

    updateDetectorDistance(distance) {
        this.detectorDistance = distance;
    }

    getSensorData() {
        return { ...this.sensorData };
    }

    getCarCounts() {
        return { ...this.carCounts };
    }

    getTotalCarsDetected() {
        return { ...this.totalCarsDetected };
    }

    resetCarCount(direction) {
        this.totalCarsDetected[direction] = 0;
    }

    resetAllCarCounts() {
        Object.values(CONFIG.DIRECTIONS).forEach(direction => {
            this.totalCarsDetected[direction] = 0;
        });
        console.log('Adaptive Mode: Car counts reset for new cycle');
    }
    
    triggerCountReset() {
        this.shouldResetCounts = true;
    }

    reset() {
        this.initializeSensors();
    }
}




