const CameraManager = {
    video: null,
    stream: null,
    onLoss: null,
    onRestore: null,
    trackEndedHandler: null,
    checkInterval: null,
    isPaused: false,
    failureCount: 0,
    maxFailuresBeforeLoss: 3,
    lastVideoTime: 0,
    stalledCount: 0,

    async init(videoElement, callbacks) {
        this.video = videoElement;
        this.onLoss = callbacks.onLoss;
        this.onRestore = callbacks.onRestore;
        await this.startCamera();
        this.checkInterval = setInterval(() => this.checkStreamHealth(), 2000);
    },

    async startCamera() {
        try {
            if (this.stream) {
                this.stream.getTracks().forEach(t => t.stop());
            }
            this.stream = await navigator.mediaDevices.getUserMedia({
                video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } },
                audio: false
            });
            this.video.srcObject = this.stream;
            const track = this.stream.getVideoTracks()[0];
            if (track) {
                track.onended = () => this.handleLoss('انتهى مسار الفيديو');
            }
            this.isPaused = false;
            this.failureCount = 0;
            this.stalledCount = 0;
            this.lastVideoTime = 0;
            if (this.onRestore) {
                this.onRestore();
            }
        } catch (err) {
            this.handleLoss('رفض الإذن أو فشل التفعيل');
            throw err;
        }
    },

    checkStreamHealth() {
        if (!this.stream) {
            this.registerFailure('لا يوجد بث');
            return;
        }
        const track = this.stream.getVideoTracks()[0];
        const settings = track ? track.getSettings() : null;
        const looksHealthy = track &&
            track.readyState === 'live' &&
            track.enabled &&
            settings &&
            settings.width &&
            settings.height;
        if (!looksHealthy) {
            this.registerFailure('مسار الكاميرا غير نشط');
            return;
        }
        if (this.video.readyState < 2) {
            this.registerFailure('الفيديو لم يكتمل تحميله');
            return;
        }
        if (this.video.currentTime === this.lastVideoTime) {
            this.stalledCount++;
            if (this.stalledCount >= this.maxFailuresBeforeLoss) {
                this.registerFailure('بث الكاميرا متوقف');
            }
            return;
        }
        this.lastVideoTime = this.video.currentTime;
        this.stalledCount = 0;
        this.failureCount = 0;
    },

    registerFailure(reason) {
        this.failureCount++;
        if (this.failureCount >= this.maxFailuresBeforeLoss) {
            this.handleLoss(reason);
        }
    },

    handleLoss(reason) {
        if (this.isPaused) return;
        this.isPaused = true;
        if (this.onLoss) {
            this.onLoss(reason);
        }
    },

    getVideoElement() {
        return this.video;
    },

    destroy() {
        if (this.checkInterval) {
            clearInterval(this.checkInterval);
        }
        if (this.stream) {
            this.stream.getTracks().forEach(t => t.stop());
        }
    }
};
