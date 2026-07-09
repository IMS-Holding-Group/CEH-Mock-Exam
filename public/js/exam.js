const ExamApp = {
    sessionId: null,
    traineeName: '',
    questions: [],
    answers: {},
    currentIndex: 0,
    timerInterval: null,
    remainingSeconds: 0,
    examPaused: false,
    submitting: false,

    async init() {
        this.sessionId = parseInt(sessionStorage.getItem('ceh_session_id'), 10);
        this.traineeName = sessionStorage.getItem('ceh_trainee_name') || '';
        const durationMinutes = parseInt(sessionStorage.getItem('ceh_duration_minutes'), 10) || 240;
        const eyeThreshold = parseFloat(sessionStorage.getItem('ceh_eye_threshold')) || 0.22;
        const eyeDuration = parseInt(sessionStorage.getItem('ceh_eye_duration'), 10) || 1800;

        if (!this.sessionId || !this.traineeName) {
            window.location.href = '/index.html';
            return;
        }

        document.getElementById('traineeLabel').textContent = this.traineeName;
        document.getElementById('metaTrainee').textContent = 'المتدربة: ' + this.traineeName;

        const data = await API.getQuestions(false);
        this.questions = data.questions || [];
        if (!this.questions.length) {
            alert('لا توجد أسئلة في بنك الأسئلة. يرجى إضافة أسئلة من لوحة المدرب.');
            window.location.href = '/trainer.html';
            return;
        }

        this.remainingSeconds = durationMinutes * 60;
        this.renderQuestion();
        this.buildProgressDots();
        this.startTimer();

        document.getElementById('prevBtn').addEventListener('click', () => this.goPrev());
        document.getElementById('nextBtn').addEventListener('click', () => this.goNext());
        document.getElementById('submitBtn').addEventListener('click', () => this.confirmSubmit());
        document.getElementById('resumeCameraBtn').addEventListener('click', () => this.resumeCamera());
        document.getElementById('alertCloseBtn').addEventListener('click', () => this.hideAlert());
        this.updateTrackingDebug({
            phase: 'calibrating',
            status: 'neutral',
            deviation: null,
            details: 'جاري تجهيز المراقبة'
        });

        const callbacks = {
            onLogEvent: (type, details) => this.logEvent(type, details),
            onAlert: (title, message) => this.showAlert(title, message)
        };

        AntiCopy.init(this.sessionId, callbacks);
        AntiTranslate.init(this.sessionId, callbacks);

        const video = document.getElementById('cameraVideo');
        const canvas = document.getElementById('eyeCanvas');

        try {
            await CameraManager.init(video, {
                onLoss: (reason) => this.handleCameraLoss(reason),
                onRestore: () => this.handleCameraRestore()
            });
            EyeTracker.init(video, canvas, {
                deviationThreshold: eyeThreshold,
                suspiciousDurationMs: eyeDuration
            }, (details) => {
                this.logEvent('eye_suspicious', details);
                this.showAlert('حركة عين مشبوهة', 'تم رصد انحراف في اتجاه النظر عن منطقة الشاشة. يرجى التركيز على الاختبار.');
            }, (metrics) => {
                this.updateTrackingDebug(metrics);
            });
            document.getElementById('metaMonitoring').textContent = 'المراقبة: نشطة';
        } catch (err) {
            this.handleCameraLoss(err.message);
        }
    },

    startTimer() {
        this.updateTimerDisplay();
        this.timerInterval = setInterval(() => {
            if (this.examPaused || this.submitting) return;
            this.remainingSeconds--;
            this.updateTimerDisplay();
            if (this.remainingSeconds <= 0) {
                clearInterval(this.timerInterval);
                this.submitExam(true);
            }
        }, 1000);
    },

    updateTimerDisplay() {
        const box = document.getElementById('timerBox');
        const h = Math.floor(this.remainingSeconds / 3600);
        const m = Math.floor((this.remainingSeconds % 3600) / 60);
        const s = this.remainingSeconds % 60;
        const pad = n => String(n).padStart(2, '0');
        box.textContent = pad(h) + ':' + pad(m) + ':' + pad(s);
        if (this.remainingSeconds <= 300) {
            box.classList.add('warning');
        }
    },

    buildProgressDots() {
        const container = document.getElementById('progressDots');
        container.innerHTML = '';
        this.questions.forEach((q, i) => {
            const dot = document.createElement('span');
            dot.className = 'progress-dot';
            if (this.answers[q.id]) dot.classList.add('answered');
            if (i === this.currentIndex) dot.classList.add('current');
            dot.title = 'سؤال ' + toEnglishDigits(i + 1);
            dot.addEventListener('click', () => {
                if (!this.examPaused) {
                    this.currentIndex = i;
                    this.renderQuestion();
                    this.buildProgressDots();
                }
            });
            container.appendChild(dot);
        });
    },

    renderQuestion() {
        const q = this.questions[this.currentIndex];
        if (!q) return;
        document.getElementById('questionNumber').textContent = 'سؤال ' + toEnglishDigits(q.questionNumber || (this.currentIndex + 1));
        document.getElementById('questionCategory').textContent = q.category || 'عام';
        document.getElementById('questionText').textContent = q.text;
        document.getElementById('metaProgress').textContent = 'التقدم: ' + toEnglishDigits(this.currentIndex + 1) + ' / ' + toEnglishDigits(this.questions.length);

        const container = document.getElementById('optionsContainer');
        container.innerHTML = '';
        const selected = this.answers[q.id] || null;

        q.options.forEach(opt => {
            const row = document.createElement('label');
            row.className = 'option-row';
            const input = document.createElement('input');
            input.type = 'radio';
            input.name = 'questionOption';
            input.value = opt.key;
            input.checked = selected === opt.key;
            input.addEventListener('change', () => {
                if (!this.examPaused) {
                    this.answers[q.id] = opt.key;
                    this.buildProgressDots();
                }
            });
            const span = document.createElement('span');
            span.textContent = opt.key + ') ' + opt.text;
            row.appendChild(input);
            row.appendChild(span);
            container.appendChild(row);
        });

        document.getElementById('prevBtn').disabled = this.currentIndex === 0;
        document.getElementById('nextBtn').disabled = this.currentIndex === this.questions.length - 1;
    },

    goPrev() {
        if (this.currentIndex > 0 && !this.examPaused) {
            this.currentIndex--;
            this.renderQuestion();
            this.buildProgressDots();
        }
    },

    goNext() {
        if (this.currentIndex < this.questions.length - 1 && !this.examPaused) {
            this.currentIndex++;
            this.renderQuestion();
            this.buildProgressDots();
        }
    },

    confirmSubmit() {
        if (this.examPaused || this.submitting) return;
        const unanswered = this.questions.filter(q => !this.answers[q.id]).length;
        let msg = 'هل أنتِ متأكدة من تسليم الاختبار؟';
        if (unanswered > 0) {
            msg += '\nيوجد ' + unanswered + ' سؤال بدون إجابة.';
        }
        if (confirm(msg)) {
            this.submitExam(false);
        }
    },

    async submitExam(autoSubmit) {
        if (this.submitting) return;
        this.submitting = true;
        clearInterval(this.timerInterval);
        EyeTracker.destroy();
        CameraManager.destroy();
        AntiTranslate.destroy();

        const answersList = this.questions.map(q => ({
            questionId: q.id,
            selectedOptionKey: this.answers[q.id] || null
        }));

        try {
            const report = await API.submitSession(this.sessionId, answersList, autoSubmit);
            sessionStorage.setItem('ceh_last_report', JSON.stringify(report));
            sessionStorage.removeItem('ceh_session_id');
            window.location.href = '/results.html?session=' + this.sessionId;
        } catch (err) {
            this.submitting = false;
            alert(err.message);
        }
    },

    async logEvent(eventType, details) {
        try {
            await API.logEvent(this.sessionId, eventType, details);
        } catch (err) {
            console.error(err);
        }
    },

    handleCameraLoss(reason) {
        this.examPaused = true;
        EyeTracker.pause();
        document.getElementById('cameraStatus').textContent = 'الكاميرا: غير نشطة';
        document.getElementById('cameraStatus').className = 'monitoring-status inactive';
        this.updateTrackingDebug({
            phase: 'lost_face',
            status: 'alert',
            deviation: null,
            details: reason
        });
        document.getElementById('pauseMessage').textContent = 'تم إيقاف الاختبار مؤقتًا بسبب: ' + reason + '. يجب إعادة تفعيل الكاميرا للمتابعة.';
        document.getElementById('pauseOverlay').classList.add('show');
        this.logEvent('camera_loss', reason);
    },

    handleCameraRestore() {
        document.getElementById('cameraStatus').textContent = 'الكاميرا: نشطة';
        document.getElementById('cameraStatus').className = 'monitoring-status active';
        this.updateTrackingDebug({
            phase: 'calibrating',
            status: 'neutral',
            deviation: null,
            details: 'عادت الكاميرا ويجري استئناف الرصد'
        });
    },

    async resumeCamera() {
        try {
            await CameraManager.startCamera();
            this.examPaused = false;
            EyeTracker.resume();
            document.getElementById('pauseOverlay').classList.remove('show');
        } catch (err) {
            alert('فشل تفعيل الكاميرا. يرجى السماح بالوصول من إعدادات المتصفح.');
        }
    },

    showAlert(title, message) {
        document.getElementById('alertTitle').textContent = title;
        document.getElementById('alertMessage').textContent = message;
        document.getElementById('alertOverlay').classList.add('show');
    },

    hideAlert() {
        document.getElementById('alertOverlay').classList.remove('show');
    },

    updateTrackingDebug(metrics) {
        const statusEl = document.getElementById('trackingDebugStatus');
        const valueEl = document.getElementById('trackingDebugValue');
        const detailsEl = document.getElementById('trackingDebugDetails');
        if (!statusEl || !valueEl || !detailsEl) return;

        let label = 'جاري المعايرة';
        if (metrics.status === 'safe') {
            label = 'النظر ضمن النطاق الطبيعي';
        } else if (metrics.status === 'warn') {
            label = 'النظر قريب من حد الاشتباه';
        } else if (metrics.status === 'alert') {
            label = 'انحراف واضح أو فقدان وجه';
        }

        statusEl.className = 'tracking-debug-status ' + (metrics.status || 'neutral');
        statusEl.textContent = label;
        valueEl.textContent = 'الانحراف: ' + (metrics.deviation === null || metrics.deviation === undefined ? '-' : toEnglishDigits(metrics.deviation.toFixed(2)));
        detailsEl.textContent = 'التفاصيل: ' + toEnglishDigits(metrics.details || '-');
    }
};

document.addEventListener('DOMContentLoaded', () => {
    ExamApp.init().catch(err => {
        alert(err.message);
        window.location.href = '/index.html';
    });
});
