const EyeTracker = {
    video: null,
    canvas: null,
    ctx: null,
    running: false,
    animationId: null,
    deviationThreshold: 0.22,
    suspiciousDurationMs: 1800,
    deviationStart: null,
    lastEventTime: 0,
    onSuspicious: null,
    paused: false,
    recentCenters: [],
    sampleEveryFrames: 5,
    frameCounter: 0,
    minFacePixels: 220,
    baselineCenter: null,
    baselineFaceRatio: null,
    baselineSamples: [],
    calibrationFramesRequired: 10,
    calibrationComplete: false,
    lostFaceStart: null,
    lostFaceGraceMs: 2200,
    directionHistory: [],
    edgeDeviationCount: 0,
    strongDeviationStart: null,
    onMetrics: null,

    init(video, canvas, settings, onSuspicious, onMetrics) {
        this.video = video;
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d', { willReadFrequently: true });
        this.deviationThreshold = settings.deviationThreshold || 0.22;
        this.suspiciousDurationMs = settings.suspiciousDurationMs || 1800;
        this.onSuspicious = onSuspicious;
        this.onMetrics = onMetrics || null;
        this.running = true;
        this.frameCounter = 0;
        this.recentCenters = [];
        this.baselineCenter = null;
        this.baselineFaceRatio = null;
        this.baselineSamples = [];
        this.calibrationComplete = false;
        this.lostFaceStart = null;
        this.directionHistory = [];
        this.edgeDeviationCount = 0;
        this.strongDeviationStart = null;
        this.loop();
    },

    pause() {
        this.paused = true;
    },

    resume() {
        this.paused = false;
        this.deviationStart = null;
        this.recentCenters = [];
        this.lostFaceStart = null;
        this.directionHistory = [];
        this.strongDeviationStart = null;
    },

    loop() {
        if (!this.running) return;
        if (!this.paused && this.video && this.video.readyState >= 2) {
            this.frameCounter++;
            if (this.frameCounter % this.sampleEveryFrames === 0) {
                this.analyzeFrame();
            }
        }
        this.animationId = requestAnimationFrame(() => this.loop());
    },

    isSkin(r, g, b) {
        return r > 60 && g > 40 && b > 20 && r > g && r > b && (Math.max(r, g, b) - Math.min(r, g, b)) > 15;
    },

    analyzeFrame() {
        const w = 160;
        const h = 120;
        this.canvas.width = w;
        this.canvas.height = h;
        this.ctx.drawImage(this.video, 0, 0, w, h);
        const imageData = this.ctx.getImageData(0, 0, w, h);
        const data = imageData.data;
        let sumX = 0;
        let sumY = 0;
        let count = 0;
        let minX = w;
        let maxX = 0;
        let minY = h;
        let maxY = 0;
        for (let y = 0; y < h; y++) {
            for (let x = 0; x < w; x++) {
                const i = (y * w + x) * 4;
                const r = data[i];
                const g = data[i + 1];
                const b = data[i + 2];
                if (this.isSkin(r, g, b)) {
                    sumX += x;
                    sumY += y;
                    count++;
                    if (x < minX) minX = x;
                    if (x > maxX) maxX = x;
                    if (y < minY) minY = y;
                    if (y > maxY) maxY = y;
                }
            }
        }
        const now = Date.now();
        if (count < this.minFacePixels) {
            this.recentCenters = [];
            if (!this.lostFaceStart) {
                this.lostFaceStart = now;
                this.emitMetrics({
                    phase: 'lost_face',
                    status: 'warn',
                    deviation: null,
                    details: 'الوجه غير واضح بعد',
                    threshold: this.deviationThreshold
                });
                return;
            }
            if (now - this.lostFaceStart >= this.lostFaceGraceMs) {
                this.emitMetrics({
                    phase: 'lost_face',
                    status: 'alert',
                    deviation: null,
                    details: 'لم يُرصد الوجه بوضوح',
                    threshold: this.deviationThreshold
                });
                this.trackDeviation(true, now, 'لم يُرصد الوجه بوضوح');
            }
            return;
        }
        this.lostFaceStart = null;
        const faceWidth = Math.max(1, maxX - minX);
        const faceHeight = Math.max(1, maxY - minY);
        const faceRatio = (faceWidth * faceHeight) / (w * h);
        this.recentCenters.push({
            x: sumX / count,
            y: sumY / count,
            faceRatio: faceRatio
        });
        if (this.recentCenters.length > 6) {
            this.recentCenters.shift();
        }
        const avg = this.getAverageCenter();
        if (!this.calibrationComplete) {
            this.collectCalibration(avg);
            this.emitMetrics({
                phase: 'calibrating',
                status: 'neutral',
                deviation: null,
                details: 'جاري المعايرة ' + this.baselineSamples.length + '/' + this.calibrationFramesRequired,
                threshold: this.deviationThreshold
            });
            return;
        }
        const baselineX = this.baselineCenter ? this.baselineCenter.x / w : 0.5;
        const baselineY = this.baselineCenter ? this.baselineCenter.y / h : 0.42;
        const normX = Math.abs(avg.x / w - baselineX);
        const normY = Math.abs(avg.y / h - baselineY);
        const faceRatioDelta = Math.abs(avg.faceRatio - this.baselineFaceRatio);
        const instantNormX = Math.abs((sumX / count) / w - baselineX);
        const instantNormY = Math.abs((sumY / count) / h - baselineY);
        const weightedDeviation = (normX * 1.2) + (normY * 0.30) + (faceRatioDelta * 0.75);
        const faceNearEdge = avg.x < 20 || avg.x > 140 || avg.y < 14 || avg.y > 110;
        const mostlyHorizontal = normX > 0.10 && normY < 0.10;
        const moderateHorizontal = normX > 0.07 && normY < 0.08;
        const strongInstantHorizontal = instantNormX > 0.16 && instantNormY < 0.12;
        const severeDeviation = weightedDeviation > (this.deviationThreshold + 0.06);
        this.directionHistory.push(mostlyHorizontal ? 1 : 0);
        if (this.directionHistory.length > 5) {
            this.directionHistory.shift();
        }
        const repeatedHorizontalDeviation = this.directionHistory.filter(Boolean).length >= 4;
        if (faceNearEdge || severeDeviation) {
            this.edgeDeviationCount++;
        } else {
            this.edgeDeviationCount = 0;
        }
        if (strongInstantHorizontal || faceNearEdge) {
            if (!this.strongDeviationStart) {
                this.strongDeviationStart = now;
            }
        } else {
            this.strongDeviationStart = null;
        }
        const quickStrongDeviation = this.strongDeviationStart && (now - this.strongDeviationStart >= 900);
        const isDeviated =
            this.edgeDeviationCount >= 2 ||
            quickStrongDeviation ||
            severeDeviation ||
            (moderateHorizontal && weightedDeviation > (this.deviationThreshold - 0.03)) ||
            (repeatedHorizontalDeviation && weightedDeviation > this.deviationThreshold);
        this.emitMetrics({
            phase: 'tracking',
            status: isDeviated ? 'alert' : (weightedDeviation > (this.deviationThreshold - 0.05) ? 'warn' : 'safe'),
            deviation: weightedDeviation,
            details: 'x=' + normX.toFixed(2) + ' y=' + normY.toFixed(2) + ' فوري=' + instantNormX.toFixed(2) + ' حد=' + this.deviationThreshold.toFixed(2),
            threshold: this.deviationThreshold
        });
        this.trackDeviation(
            isDeviated,
            now,
            'انحراف=' + weightedDeviation.toFixed(2) + ' x=' + normX.toFixed(2) + ' y=' + normY.toFixed(2) + ' فوري=' + instantNormX.toFixed(2) + ' حجم=' + faceRatioDelta.toFixed(2)
        );
    },

    getAverageCenter() {
        let totalX = 0;
        let totalY = 0;
        let totalFaceRatio = 0;
        for (const center of this.recentCenters) {
            totalX += center.x;
            totalY += center.y;
            totalFaceRatio += center.faceRatio || 0;
        }
        return {
            x: totalX / this.recentCenters.length,
            y: totalY / this.recentCenters.length,
            faceRatio: totalFaceRatio / this.recentCenters.length
        };
    },

    collectCalibration(avg) {
        this.baselineSamples.push({
            x: avg.x,
            y: avg.y,
            faceRatio: avg.faceRatio
        });
        if (this.baselineSamples.length < this.calibrationFramesRequired) {
            return;
        }
        let totalX = 0;
        let totalY = 0;
        let totalFaceRatio = 0;
        for (const sample of this.baselineSamples) {
            totalX += sample.x;
            totalY += sample.y;
            totalFaceRatio += sample.faceRatio;
        }
        this.baselineCenter = {
            x: totalX / this.baselineSamples.length,
            y: totalY / this.baselineSamples.length
        };
        this.baselineFaceRatio = totalFaceRatio / this.baselineSamples.length;
        this.calibrationComplete = true;
        this.baselineSamples = [];
    },

    emitMetrics(payload) {
        if (this.onMetrics) {
            this.onMetrics(payload);
        }
    },

    trackDeviation(isDeviated, now, details) {
        if (isDeviated) {
            if (!this.deviationStart) {
                this.deviationStart = now;
            } else if (now - this.deviationStart >= this.suspiciousDurationMs) {
                if (now - this.lastEventTime > this.suspiciousDurationMs) {
                    this.lastEventTime = now;
                    if (this.onSuspicious) {
                        this.onSuspicious(details);
                    }
                }
                this.deviationStart = now;
            }
        } else {
            this.deviationStart = null;
        }
    },

    destroy() {
        this.running = false;
        this.recentCenters = [];
        this.baselineSamples = [];
        this.directionHistory = [];
        this.strongDeviationStart = null;
        this.onMetrics = null;
        if (this.animationId) {
            cancelAnimationFrame(this.animationId);
        }
    }
};
