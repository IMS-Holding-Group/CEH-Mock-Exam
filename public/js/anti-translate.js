const AntiTranslate = {
    sessionId: null,
    onLogEvent: null,
    onAlert: null,
    observer: null,
    langInterval: null,
    initialized: false,
    lastAlertTime: 0,

    init(sessionId, callbacks) {
        if (this.initialized) return;
        this.sessionId = sessionId;
        this.onLogEvent = callbacks.onLogEvent;
        this.onAlert = callbacks.onAlert;
        this.initialized = true;

        document.documentElement.setAttribute('translate', 'no');
        document.body.setAttribute('translate', 'no');
        this.applyTranslateNo(document.body);

        this.observer = new MutationObserver((mutations) => {
            mutations.forEach((mutation) => {
                if (mutation.type === 'childList') {
                    mutation.addedNodes.forEach((node) => {
                        if (node.nodeType === 1) {
                            if (this.isTranslateElement(node)) {
                                this.handleTranslateDetection('عنصر ترجمة جديد');
                            }
                            this.applyTranslateNo(node);
                        }
                    });
                }
                if (mutation.type === 'attributes') {
                    if (mutation.attributeName === 'class' && this.isTranslateElement(mutation.target)) {
                        this.handleTranslateDetection('تغيير فئة ترجمة');
                    }
                    if (mutation.attributeName === 'lang' && mutation.target === document.documentElement) {
                        if (document.documentElement.lang !== 'ar') {
                            document.documentElement.lang = 'ar';
                            this.handleTranslateDetection('تغيير لغة الصفحة');
                        }
                    }
                }
            });
        });

        this.observer.observe(document.documentElement, {
            childList: true,
            subtree: true,
            attributes: true,
            attributeFilter: ['class', 'lang', 'translate']
        });

        this.langInterval = setInterval(() => {
            if (document.documentElement.lang !== 'ar') {
                document.documentElement.lang = 'ar';
                this.handleTranslateDetection('استعادة اللغة العربية');
            }
        }, 1000);
    },

    applyTranslateNo(root) {
        if (!root || !root.setAttribute) return;
        root.setAttribute('translate', 'no');
        if (root.children) {
            for (let i = 0; i < root.children.length; i++) {
                this.applyTranslateNo(root.children[i]);
            }
        }
    },

    isTranslateElement(el) {
        if (!el || !el.classList) return false;
        const cls = el.className.toString().toLowerCase();
        const id = (el.id || '').toLowerCase();
        const tag = (el.tagName || '').toLowerCase();
        if (tag === 'font' && cls.indexOf('translate') !== -1) return true;
        if (cls.indexOf('goog-te') !== -1) return true;
        if (cls.indexOf('translated') !== -1) return true;
        if (cls.indexOf('skiptranslate') !== -1) return true;
        if (id.indexOf('goog-gt') !== -1) return true;
        if (cls.indexOf('goog-text-highlight') !== -1) return true;
        return false;
    },

    handleTranslateDetection(source) {
        const now = Date.now();
        if (now - this.lastAlertTime < 5000) return;
        this.lastAlertTime = now;
        if (this.onLogEvent) {
            this.onLogEvent('translate_attempt', source);
        }
        if (this.onAlert) {
            this.onAlert(
                'محاولة ترجمة مرصودة',
                'تم رصد محاولة تفعيل ترجمة الصفحة (' + source + '). يرجى إيقاف الترجمة يدويًا من إعدادات المتصفح فورًا.'
            );
        }
    },

    destroy() {
        if (this.observer) {
            this.observer.disconnect();
        }
        if (this.langInterval) {
            clearInterval(this.langInterval);
        }
    }
};
