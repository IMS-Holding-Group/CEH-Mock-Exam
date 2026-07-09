const http = require('http');
const fs = require('fs');
const path = require('path');
const url = require('url');
const db = require('./db');
const config = require('./config');

const publicDir = path.join(__dirname, '..', 'public');
const assetsDir = path.join(__dirname, '..', 'assets');

const mimeTypes = {
    '.html': 'text/html; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.js': 'application/javascript; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.svg': 'image/svg+xml',
    '.ttf': 'font/ttf',
    '.woff': 'font/woff',
    '.woff2': 'font/woff2'
};

function sendJson(res, status, data) {
    res.writeHead(status, {
        'Content-Type': 'application/json; charset=utf-8',
        'Access-Control-Allow-Origin': '*'
    });
    res.end(JSON.stringify(data));
}

function readBody(req) {
    return new Promise((resolve, reject) => {
        let body = '';
        req.on('data', chunk => {
            body += chunk.toString();
            if (body.length > 2 * 1024 * 1024) {
                reject(new Error('حجم الطلب كبير جدًا'));
            }
        });
        req.on('end', () => {
            if (!body) {
                resolve({});
                return;
            }
            try {
                resolve(JSON.parse(body));
            } catch (e) {
                reject(new Error('صيغة JSON غير صالحة'));
            }
        });
        req.on('error', reject);
    });
}

function serveStatic(res, filePath) {
    const ext = path.extname(filePath).toLowerCase();
    const mime = mimeTypes[ext] || 'application/octet-stream';
    fs.readFile(filePath, (err, data) => {
        if (err) {
            res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
            res.end('الملف غير موجود');
            return;
        }
        res.writeHead(200, { 'Content-Type': mime });
        res.end(data);
    });
}

async function getQuestionsWithOptions() {
    const questions = await db.query('SELECT * FROM questions ORDER BY id ASC');
    const options = await db.query('SELECT * FROM question_options ORDER BY question_id ASC, option_key ASC');
    const optionsMap = {};
    options.forEach(opt => {
        if (!optionsMap[opt.question_id]) {
            optionsMap[opt.question_id] = [];
        }
        optionsMap[opt.question_id].push({
            key: opt.option_key,
            text: opt.option_text
        });
    });
    return questions.map(q => ({
        id: q.id,
        questionNumber: q.question_number,
        category: q.category,
        text: q.question_text,
        correctOptionKey: q.correct_option_key,
        options: optionsMap[q.id] || []
    }));
}

async function getQuestionById(id) {
    const rows = await db.query('SELECT * FROM questions WHERE id = ?', [id]);
    if (!rows.length) return null;
    const q = rows[0];
    const options = await db.query(
        'SELECT option_key, option_text FROM question_options WHERE question_id = ? ORDER BY option_key ASC',
        [id]
    );
    return {
        id: q.id,
        questionNumber: q.question_number,
        category: q.category,
        text: q.question_text,
        correctOptionKey: q.correct_option_key,
        options: options.map(o => ({ key: o.option_key, text: o.option_text }))
    };
}

async function createQuestion(data) {
    const result = await db.query(
        'INSERT INTO questions (question_number, category, question_text, correct_option_key) VALUES (?, ?, ?, ?)',
        [data.questionNumber || null, data.category || null, data.text, data.correctOptionKey]
    );
    const questionId = result.insertId;
    for (const opt of data.options) {
        await db.query(
            'INSERT INTO question_options (question_id, option_key, option_text) VALUES (?, ?, ?)',
            [questionId, opt.key, opt.text]
        );
    }
    return questionId;
}

async function updateQuestion(id, data) {
    await db.query(
        'UPDATE questions SET question_number = ?, category = ?, question_text = ?, correct_option_key = ? WHERE id = ?',
        [data.questionNumber || null, data.category || null, data.text, data.correctOptionKey, id]
    );
    await db.query('DELETE FROM question_options WHERE question_id = ?', [id]);
    for (const opt of data.options) {
        await db.query(
            'INSERT INTO question_options (question_id, option_key, option_text) VALUES (?, ?, ?)',
            [id, opt.key, opt.text]
        );
    }
}

async function ensureTrainee(name) {
    const trimmed = name.trim();
    const existing = await db.query('SELECT id FROM trainees WHERE name = ?', [trimmed]);
    if (existing.length) {
        return existing[0].id;
    }
    const result = await db.query('INSERT INTO trainees (name) VALUES (?)', [trimmed]);
    return result.insertId;
}

async function startSession(traineeName) {
    const traineeId = await ensureTrainee(traineeName);
    const questions = await db.query('SELECT COUNT(*) AS total FROM questions');
    const total = questions[0].total;
    const now = new Date();
    const result = await db.query(
        'INSERT INTO exam_sessions (trainee_id, started_at, total_questions, status) VALUES (?, ?, ?, ?)',
        [traineeId, formatDateTime(now), total, 'active']
    );
    return {
        sessionId: result.insertId,
        traineeId,
        traineeName: traineeName.trim(),
        totalQuestions: total,
        durationMinutes: config.examDurationMinutes,
        eyeDeviationThreshold: config.eyeDeviationThreshold,
        eyeSuspiciousDurationMs: config.eyeSuspiciousDurationMs
    };
}

function formatDateTime(date) {
    const pad = n => String(n).padStart(2, '0');
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
}

async function logEvent(sessionId, eventType, details) {
    const now = formatDateTime(new Date());
    await db.query(
        'INSERT INTO monitoring_events (session_id, event_type, occurred_at, details) VALUES (?, ?, ?, ?)',
        [sessionId, eventType, now, details || null]
    );
    const columnMap = {
        eye_suspicious: 'eye_suspicious_count',
        copy_attempt: 'copy_attempts_count',
        camera_loss: 'camera_loss_count',
        translate_attempt: 'translate_attempts_count'
    };
    const column = columnMap[eventType];
    if (column) {
        await db.query(`UPDATE exam_sessions SET ${column} = ${column} + 1 WHERE id = ?`, [sessionId]);
    }
}

async function submitSession(sessionId, answers, autoSubmit) {
    const sessions = await db.query('SELECT * FROM exam_sessions WHERE id = ?', [sessionId]);
    if (!sessions.length) {
        throw new Error('الجلسة غير موجودة');
    }
    const session = sessions[0];
    if (session.status === 'completed' || session.status === 'auto_submitted') {
        throw new Error('تم تسليم هذه الجلسة مسبقًا');
    }
    const questions = await db.query('SELECT id, correct_option_key FROM questions');
    const correctMap = {};
    questions.forEach(q => {
        correctMap[q.id] = q.correct_option_key;
    });
    let correctCount = 0;
    let wrongCount = 0;
    for (const ans of answers) {
        const qId = parseInt(ans.questionId, 10);
        const selected = ans.selectedOptionKey || null;
        const isCorrect = selected && correctMap[qId] === selected ? 1 : 0;
        if (isCorrect) {
            correctCount++;
        } else {
            wrongCount++;
        }
        await db.query(
            'INSERT INTO session_answers (session_id, question_id, selected_option_key, is_correct) VALUES (?, ?, ?, ?) ON DUPLICATE KEY UPDATE selected_option_key = VALUES(selected_option_key), is_correct = VALUES(is_correct)',
            [sessionId, qId, selected, isCorrect]
        );
    }
    const total = questions.length;
    const unanswered = total - correctCount - wrongCount;
    wrongCount += unanswered;
    const scorePercent = total > 0 ? ((correctCount / total) * 100).toFixed(2) : '0.00';
    const startedAt = new Date(session.started_at);
    const endedAt = new Date();
    const durationSeconds = Math.max(0, Math.floor((endedAt - startedAt) / 1000));
    const status = autoSubmit ? 'auto_submitted' : 'completed';
    await db.query(
        'UPDATE exam_sessions SET ended_at = ?, duration_seconds = ?, correct_count = ?, wrong_count = ?, score_percent = ?, status = ? WHERE id = ?',
        [formatDateTime(endedAt), durationSeconds, correctCount, wrongCount, scorePercent, status, sessionId]
    );
    const updated = await getSessionReport(sessionId);
    return updated;
}

async function getSessionReport(sessionId) {
    const rows = await db.query(
        `SELECT es.*, t.name AS trainee_name
         FROM exam_sessions es
         JOIN trainees t ON t.id = es.trainee_id
         WHERE es.id = ?`,
        [sessionId]
    );
    if (!rows.length) return null;
    const s = rows[0];
    const events = await db.query(
        'SELECT event_type, occurred_at, details FROM monitoring_events WHERE session_id = ? ORDER BY occurred_at ASC',
        [sessionId]
    );
    return {
        sessionId: s.id,
        traineeName: s.trainee_name,
        startedAt: s.started_at,
        endedAt: s.ended_at,
        durationSeconds: s.duration_seconds,
        totalQuestions: s.total_questions,
        correctCount: s.correct_count,
        wrongCount: s.wrong_count,
        scorePercent: parseFloat(s.score_percent),
        eyeSuspiciousCount: s.eye_suspicious_count,
        copyAttemptsCount: s.copy_attempts_count,
        cameraLossCount: s.camera_loss_count,
        translateAttemptsCount: s.translate_attempts_count,
        status: s.status,
        events
    };
}

async function getAllSessions() {
    return db.query(
        `SELECT es.id, t.name AS trainee_name, es.started_at, es.ended_at, es.duration_seconds,
                es.score_percent, es.correct_count, es.wrong_count, es.total_questions,
                es.eye_suspicious_count, es.copy_attempts_count, es.camera_loss_count,
                es.translate_attempts_count, es.status
         FROM exam_sessions es
         JOIN trainees t ON t.id = es.trainee_id
         ORDER BY es.started_at DESC`
    );
}

async function deleteSession(sessionId) {
    const existing = await db.query('SELECT id FROM exam_sessions WHERE id = ?', [sessionId]);
    if (!existing.length) {
        return false;
    }
    await db.query('DELETE FROM exam_sessions WHERE id = ?', [sessionId]);
    return true;
}

async function handleApi(req, res, pathname) {
    try {
        if (req.method === 'GET' && pathname === '/api/config') {
            sendJson(res, 200, {
                examDurationMinutes: config.examDurationMinutes,
                eyeDeviationThreshold: config.eyeDeviationThreshold,
                eyeSuspiciousDurationMs: config.eyeSuspiciousDurationMs
            });
            return;
        }

        if (req.method === 'GET' && pathname === '/api/questions') {
            const includeCorrect = url.parse(req.url, true).query.includeCorrect === '1';
            const questions = await getQuestionsWithOptions();
            if (!includeCorrect) {
                questions.forEach(q => delete q.correctOptionKey);
            }
            sendJson(res, 200, { questions });
            return;
        }

        if (req.method === 'GET' && pathname.startsWith('/api/questions/')) {
            const id = parseInt(pathname.split('/').pop(), 10);
            const question = await getQuestionById(id);
            if (!question) {
                sendJson(res, 404, { error: 'السؤال غير موجود' });
                return;
            }
            sendJson(res, 200, { question });
            return;
        }

        if (req.method === 'POST' && pathname === '/api/questions') {
            const data = await readBody(req);
            if (!data.text || !data.correctOptionKey || !data.options || !data.options.length) {
                sendJson(res, 400, { error: 'بيانات السؤال غير مكتملة' });
                return;
            }
            const id = await createQuestion(data);
            sendJson(res, 201, { id, message: 'تم إضافة السؤال بنجاح' });
            return;
        }

        if (req.method === 'PUT' && pathname.startsWith('/api/questions/')) {
            const id = parseInt(pathname.split('/').pop(), 10);
            const data = await readBody(req);
            const existing = await getQuestionById(id);
            if (!existing) {
                sendJson(res, 404, { error: 'السؤال غير موجود' });
                return;
            }
            await updateQuestion(id, data);
            sendJson(res, 200, { message: 'تم تحديث السؤال بنجاح' });
            return;
        }

        if (req.method === 'DELETE' && pathname.startsWith('/api/questions/')) {
            const id = parseInt(pathname.split('/').pop(), 10);
            await db.query('DELETE FROM questions WHERE id = ?', [id]);
            sendJson(res, 200, { message: 'تم حذف السؤال بنجاح' });
            return;
        }

        if (req.method === 'POST' && pathname === '/api/sessions/start') {
            const data = await readBody(req);
            if (!data.traineeName || !data.traineeName.trim()) {
                sendJson(res, 400, { error: 'اسم المتدربة مطلوب' });
                return;
            }
            const session = await startSession(data.traineeName);
            sendJson(res, 201, session);
            return;
        }

        if (req.method === 'POST' && pathname.startsWith('/api/sessions/') && pathname.endsWith('/events')) {
            const parts = pathname.split('/');
            const sessionId = parseInt(parts[3], 10);
            const data = await readBody(req);
            const allowed = ['eye_suspicious', 'copy_attempt', 'camera_loss', 'translate_attempt'];
            if (!allowed.includes(data.eventType)) {
                sendJson(res, 400, { error: 'نوع الحدث غير صالح' });
                return;
            }
            await logEvent(sessionId, data.eventType, data.details || null);
            sendJson(res, 200, { message: 'تم تسجيل الحدث' });
            return;
        }

        if (req.method === 'POST' && pathname.startsWith('/api/sessions/') && pathname.endsWith('/submit')) {
            const parts = pathname.split('/');
            const sessionId = parseInt(parts[3], 10);
            const data = await readBody(req);
            const report = await submitSession(sessionId, data.answers || [], !!data.autoSubmit);
            sendJson(res, 200, report);
            return;
        }

        if (req.method === 'GET' && pathname === '/api/sessions') {
            const sessions = await getAllSessions();
            sendJson(res, 200, { sessions });
            return;
        }

        if (req.method === 'DELETE' && pathname.startsWith('/api/sessions/')) {
            const sessionId = parseInt(pathname.split('/').pop(), 10);
            const deleted = await deleteSession(sessionId);
            if (!deleted) {
                sendJson(res, 404, { error: 'الجلسة غير موجودة' });
                return;
            }
            sendJson(res, 200, { message: 'تم حذف الجلسة بنجاح' });
            return;
        }

        if (req.method === 'GET' && pathname.startsWith('/api/sessions/')) {
            const sessionId = parseInt(pathname.split('/').pop(), 10);
            const report = await getSessionReport(sessionId);
            if (!report) {
                sendJson(res, 404, { error: 'الجلسة غير موجودة' });
                return;
            }
            sendJson(res, 200, report);
            return;
        }

        sendJson(res, 404, { error: 'المسار غير موجود' });
    } catch (err) {
        console.error(err);
        sendJson(res, 500, { error: err.message || 'خطأ في الخادم' });
    }
}

async function startServer() {
    console.log(`وضع قاعدة البيانات: ${config.db.user}@${config.db.host}/${config.db.database}`);
    await db.initializeDatabase();

    const server = http.createServer(async (req, res) => {
        const parsed = url.parse(req.url, true);
        let pathname = decodeURIComponent(parsed.pathname);

        if (req.method === 'OPTIONS') {
            res.writeHead(204, {
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
                'Access-Control-Allow-Headers': 'Content-Type'
            });
            res.end();
            return;
        }

        if (pathname.startsWith('/api/')) {
            await handleApi(req, res, pathname);
            return;
        }

        if (pathname.startsWith('/assets/')) {
            const assetPath = path.join(assetsDir, pathname.replace('/assets/', ''));
            if (!assetPath.startsWith(assetsDir)) {
                res.writeHead(403);
                res.end();
                return;
            }
            serveStatic(res, assetPath);
            return;
        }

        if (pathname === '/') {
            pathname = '/index.html';
        }

        const filePath = path.join(publicDir, pathname);
        if (!filePath.startsWith(publicDir)) {
            res.writeHead(403);
            res.end();
            return;
        }

        fs.access(filePath, fs.constants.F_OK, err => {
            if (err) {
                serveStatic(res, path.join(publicDir, 'index.html'));
                return;
            }
            serveStatic(res, filePath);
        });
    });

    server.listen(config.port, config.host, () => {
        console.log(`خادم محاكي CEH يعمل على ${config.host}:${config.port}`);
    });
}

startServer().catch(err => {
    console.error('تعذر تهيئة قاعدة البيانات أو تشغيل الخادم:', err.message);
    process.exit(1);
});
