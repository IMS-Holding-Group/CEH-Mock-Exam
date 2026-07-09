async function loadResults() {
    const params = new URLSearchParams(window.location.search);
    let sessionId = params.get('session');
    let report = null;

    if (sessionId) {
        try {
            report = await API.getSession(sessionId);
        } catch (err) {
            console.error(err);
        }
    }

    if (!report) {
        const cached = sessionStorage.getItem('ceh_last_report');
        if (cached) {
            report = JSON.parse(cached);
        }
    }

    if (!report) {
        document.getElementById('resultSummary').textContent = 'لم يتم العثور على تقرير الجلسة.';
        return;
    }

    const duration = formatDuration(report.durationSeconds || 0);
    document.getElementById('resultSummary').textContent =
        'المتدربة: ' + report.traineeName +
        ' | تاريخ البدء: ' + formatDateTime(report.startedAt) +
        ' | الحالة: ' + statusLabel(report.status);

    const stats = [
        { value: toEnglishDigits(report.scorePercent + '%'), label: 'الدرجة النهائية' },
        { value: toEnglishDigits(report.correctCount), label: 'إجابات صحيحة' },
        { value: toEnglishDigits(report.wrongCount), label: 'إجابات خاطئة' },
        { value: duration, label: 'الوقت المستغرق' },
        { value: toEnglishDigits(report.eyeSuspiciousCount), label: 'حركة عين مشبوهة' },
        { value: toEnglishDigits(report.copyAttemptsCount), label: 'محاولات النسخ' },
        { value: toEnglishDigits(report.cameraLossCount), label: 'فقدان الكاميرا' },
        { value: toEnglishDigits(report.translateAttemptsCount), label: 'محاولات الترجمة' }
    ];

    const grid = document.getElementById('statsGrid');
    grid.innerHTML = '';
    stats.forEach(stat => {
        const box = document.createElement('div');
        box.className = 'stat-box';
        box.innerHTML = '<span class="stat-value">' + stat.value + '</span><span class="stat-label">' + stat.label + '</span>';
        grid.appendChild(box);
    });

    const tbody = document.getElementById('eventsTableBody');
    tbody.innerHTML = '';
    const events = report.events || [];
    if (!events.length) {
        tbody.innerHTML = '<tr><td colspan="3">لا توجد أحداث مراقبة مسجلة</td></tr>';
        return;
    }
    events.forEach(ev => {
        const tr = document.createElement('tr');
        tr.innerHTML =
            '<td>' + eventTypeLabel(ev.event_type) + '</td>' +
            '<td>' + formatDateTime(ev.occurred_at) + '</td>' +
            '<td>' + toEnglishDigits(ev.details || '-') + '</td>';
        tbody.appendChild(tr);
    });
}

document.addEventListener('DOMContentLoaded', loadResults);
