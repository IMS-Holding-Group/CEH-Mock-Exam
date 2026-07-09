const API = {
    async request(path, options) {
        const opts = options || {};
        const headers = opts.headers || {};
        if (opts.body && typeof opts.body === 'object') {
            headers['Content-Type'] = 'application/json';
            opts.body = JSON.stringify(opts.body);
        }
        const response = await fetch(path, {
            method: opts.method || 'GET',
            headers: headers,
            body: opts.body || undefined
        });
        const data = await response.json();
        if (!response.ok) {
            throw new Error(data.error || 'حدث خطأ في الاتصال بالخادم');
        }
        return data;
    },

    getConfig() {
        return this.request('/api/config');
    },

    getQuestions(includeCorrect) {
        const q = includeCorrect ? '?includeCorrect=1' : '';
        return this.request('/api/questions' + q);
    },

    createQuestion(data) {
        return this.request('/api/questions', { method: 'POST', body: data });
    },

    updateQuestion(id, data) {
        return this.request('/api/questions/' + id, { method: 'PUT', body: data });
    },

    deleteQuestion(id) {
        return this.request('/api/questions/' + id, { method: 'DELETE' });
    },

    startSession(traineeName) {
        return this.request('/api/sessions/start', {
            method: 'POST',
            body: { traineeName: traineeName }
        });
    },

    logEvent(sessionId, eventType, details) {
        return this.request('/api/sessions/' + sessionId + '/events', {
            method: 'POST',
            body: { eventType: eventType, details: details || null }
        });
    },

    submitSession(sessionId, answers, autoSubmit) {
        return this.request('/api/sessions/' + sessionId + '/submit', {
            method: 'POST',
            body: { answers: answers, autoSubmit: !!autoSubmit }
        });
    },

    getSession(sessionId) {
        return this.request('/api/sessions/' + sessionId);
    },

    getSessions() {
        return this.request('/api/sessions');
    },

    deleteSession(sessionId) {
        return this.request('/api/sessions/' + sessionId, { method: 'DELETE' });
    }
};

function formatDuration(seconds) {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    const pad = n => String(n).padStart(2, '0');
    if (h > 0) {
        return toEnglishDigits(pad(h) + ':' + pad(m) + ':' + pad(s));
    }
    return toEnglishDigits(pad(m) + ':' + pad(s));
}

function formatDateTime(dateStr) {
    if (!dateStr) return '-';
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    const pad = n => String(n).padStart(2, '0');
    const datePart = [
        d.getFullYear(),
        pad(d.getMonth() + 1),
        pad(d.getDate())
    ].join('/');
    const hours24 = d.getHours();
    const period = hours24 >= 12 ? 'PM' : 'AM';
    const hours12 = hours24 % 12 || 12;
    const timePart = [
        pad(hours12),
        pad(d.getMinutes()),
        pad(d.getSeconds())
    ].join(':');
    return toEnglishDigits(datePart + ' ' + timePart + ' ' + period);
}

function toEnglishDigits(value) {
    return String(value).replace(/[٠-٩]/g, digit => '٠١٢٣٤٥٦٧٨٩'.indexOf(digit)).replace(/[۰-۹]/g, digit => '۰۱۲۳۴۵۶۷۸۹'.indexOf(digit));
}

function eventTypeLabel(type) {
    const map = {
        eye_suspicious: 'حركة عين مشبوهة',
        copy_attempt: 'محاولة نسخ',
        camera_loss: 'فقدان الكاميرا',
        translate_attempt: 'محاولة ترجمة'
    };
    return map[type] || type;
}

function statusLabel(status) {
    const map = {
        active: 'نشطة',
        paused: 'متوقفة',
        completed: 'مكتملة',
        auto_submitted: 'تسليم تلقائي'
    };
    return map[status] || status;
}
