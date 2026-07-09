let editingQuestionId = null;

document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
        document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
        btn.classList.add('active');
        document.getElementById(btn.dataset.tab).classList.add('active');
    });
});

document.getElementById('questionForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const data = {
        questionNumber: document.getElementById('qNumber').value.trim(),
        category: document.getElementById('qCategory').value.trim(),
        text: document.getElementById('qText').value.trim(),
        correctOptionKey: document.getElementById('correctOpt').value,
        options: [
            { key: 'A', text: document.getElementById('optA').value.trim() },
            { key: 'B', text: document.getElementById('optB').value.trim() },
            { key: 'C', text: document.getElementById('optC').value.trim() },
            { key: 'D', text: document.getElementById('optD').value.trim() }
        ]
    };
    try {
        if (editingQuestionId) {
            await API.updateQuestion(editingQuestionId, data);
            alert('تم تحديث السؤال بنجاح');
        } else {
            await API.createQuestion(data);
            alert('تم إضافة السؤال بنجاح');
        }
        resetQuestionForm();
        loadQuestions();
    } catch (err) {
        alert(err.message);
    }
});

document.getElementById('resetQuestionBtn').addEventListener('click', resetQuestionForm);

function resetQuestionForm() {
    editingQuestionId = null;
    document.getElementById('questionId').value = '';
    document.getElementById('questionFormTitle').textContent = 'إضافة سؤال جديد';
    document.getElementById('saveQuestionBtn').textContent = 'حفظ السؤال';
    document.getElementById('questionForm').reset();
}

async function loadQuestions() {
    const tbody = document.getElementById('questionsTableBody');
    try {
        const data = await API.getQuestions(true);
        const questions = data.questions || [];
        if (!questions.length) {
            tbody.innerHTML = '<tr><td colspan="5">لا توجد أسئلة بعد</td></tr>';
            return;
        }
        tbody.innerHTML = '';
        questions.forEach(q => {
            const tr = document.createElement('tr');
            const shortText = q.text.length > 80 ? q.text.substring(0, 80) + '...' : q.text;
            tr.innerHTML =
                '<td>' + toEnglishDigits(q.questionNumber || '-') + '</td>' +
                '<td>' + (q.category || '-') + '</td>' +
                '<td>' + shortText + '</td>' +
                '<td>' + q.correctOptionKey + '</td>' +
                '<td><button type="button" class="btn btn-secondary edit-btn" data-id="' + q.id + '">تعديل</button> ' +
                '<button type="button" class="btn btn-danger delete-btn" data-id="' + q.id + '">حذف</button></td>';
            tbody.appendChild(tr);
        });
        document.querySelectorAll('.edit-btn').forEach(btn => {
            btn.addEventListener('click', () => editQuestion(parseInt(btn.dataset.id, 10), questions));
        });
        document.querySelectorAll('.delete-btn').forEach(btn => {
            btn.addEventListener('click', () => deleteQuestion(parseInt(btn.dataset.id, 10)));
        });
    } catch (err) {
        tbody.innerHTML = '<tr><td colspan="5">خطأ في التحميل: ' + err.message + '</td></tr>';
    }
}

function editQuestion(id, questions) {
    const q = questions.find(item => item.id === id);
    if (!q) return;
    editingQuestionId = id;
    document.getElementById('questionFormTitle').textContent = 'تعديل السؤال';
    document.getElementById('saveQuestionBtn').textContent = 'تحديث السؤال';
    document.getElementById('qNumber').value = q.questionNumber || '';
    document.getElementById('qCategory').value = q.category || '';
    document.getElementById('qText').value = q.text;
    document.getElementById('correctOpt').value = q.correctOptionKey;
    q.options.forEach(opt => {
        const map = { A: 'optA', B: 'optB', C: 'optC', D: 'optD' };
        const field = document.getElementById(map[opt.key]);
        if (field) field.value = opt.text;
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

async function deleteQuestion(id) {
    if (!confirm('هل أنت متأكد من حذف هذا السؤال؟')) return;
    try {
        await API.deleteQuestion(id);
        loadQuestions();
    } catch (err) {
        alert(err.message);
    }
}

async function loadSessions() {
    const tbody = document.getElementById('sessionsTableBody');
    try {
        const data = await API.getSessions();
        const sessions = data.sessions || [];
        if (!sessions.length) {
            tbody.innerHTML = '<tr><td colspan="10">لا توجد جلسات مسجلة</td></tr>';
            return;
        }
        tbody.innerHTML = '';
        sessions.forEach(s => {
            const tr = document.createElement('tr');
            tr.innerHTML =
                '<td>' + s.trainee_name + '</td>' +
                '<td>' + formatDateTime(s.started_at) + '</td>' +
                '<td>' + formatDuration(s.duration_seconds || 0) + '</td>' +
                '<td>' + (s.score_percent !== null ? toEnglishDigits(s.score_percent + '%') : '-') + '</td>' +
                '<td>' + toEnglishDigits(s.eye_suspicious_count) + '</td>' +
                '<td>' + toEnglishDigits(s.copy_attempts_count) + '</td>' +
                '<td>' + toEnglishDigits(s.camera_loss_count) + '</td>' +
                '<td>' + toEnglishDigits(s.translate_attempts_count) + '</td>' +
                '<td>' + statusLabel(s.status) + '</td>' +
                '<td><a href="/results.html?session=' + s.id + '" class="btn btn-secondary">عرض</a> ' +
                '<button type="button" class="btn btn-danger delete-session-btn" data-id="' + s.id + '">حذف</button></td>';
            tbody.appendChild(tr);
        });
        document.querySelectorAll('.delete-session-btn').forEach(btn => {
            btn.addEventListener('click', () => deleteSession(parseInt(btn.dataset.id, 10)));
        });
    } catch (err) {
        tbody.innerHTML = '<tr><td colspan="10">خطأ في التحميل: ' + err.message + '</td></tr>';
    }
}

async function deleteSession(id) {
    if (!confirm('هل أنت متأكد من حذف هذه الجلسة؟ سيتم حذف الإجابات وأحداث المراقبة المرتبطة بها أيضًا.')) return;
    try {
        await API.deleteSession(id);
        loadSessions();
    } catch (err) {
        alert(err.message);
    }
}

document.addEventListener('DOMContentLoaded', () => {
    loadQuestions();
    loadSessions();
});
