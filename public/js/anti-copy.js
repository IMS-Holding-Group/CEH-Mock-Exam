const AntiCopy = {
    sessionId: null,
    onLogEvent: null,
    onAlert: null,
    initialized: false,

    init(sessionId, callbacks) {
        if (this.initialized) return;
        this.sessionId = sessionId;
        this.onLogEvent = callbacks.onLogEvent;
        this.onAlert = callbacks.onAlert;
        this.initialized = true;

        document.addEventListener('copy', (e) => this.handleCopy(e));
        document.addEventListener('cut', (e) => this.handleCopy(e));
        document.addEventListener('contextmenu', (e) => {
            e.preventDefault();
            this.recordAttempt('قائمة الزر الأيمن');
        });
        document.addEventListener('keydown', (e) => {
            if ((e.ctrlKey || e.metaKey) && (e.key === 'c' || e.key === 'C' || e.key === 'x' || e.key === 'X')) {
                e.preventDefault();
                this.recordAttempt('اختصار لوحة المفاتيح');
            }
            if ((e.ctrlKey || e.metaKey) && (e.key === 'a' || e.key === 'A')) {
                e.preventDefault();
            }
            if ((e.ctrlKey || e.metaKey) && (e.key === 'p' || e.key === 'P')) {
                e.preventDefault();
            }
        });
        document.addEventListener('selectstart', (e) => {
            e.preventDefault();
        });
        document.addEventListener('dragstart', (e) => {
            e.preventDefault();
        });
    },

    handleCopy(e) {
        e.preventDefault();
        this.recordAttempt('عملية نسخ');
    },

    recordAttempt(source) {
        if (this.onLogEvent) {
            this.onLogEvent('copy_attempt', source);
        }
        if (this.onAlert) {
            this.onAlert('محاولة نسخ مرصودة', 'تم رصد محاولة نسخ (' + source + '). النسخ ممنوع أثناء الاختبار.');
        }
    }
};
