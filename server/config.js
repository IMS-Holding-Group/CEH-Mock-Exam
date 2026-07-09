const isLocalDev = process.env.NODE_ENV === 'development'
    || (process.platform === 'win32' && process.env.FORCE_PRODUCTION_DB !== '1');

module.exports = {
    port: parseInt(process.env.PORT, 10) || 3000,
    host: process.env.HOST || '0.0.0.0',
    db: {
        host: process.env.DB_HOST || (isLocalDev ? 'localhost' : '127.0.0.1'),
        user: process.env.DB_USER || (isLocalDev ? 'root' : 'u741730784_cehmockuser'),
        password: process.env.DB_PASSWORD || (isLocalDev ? '' : 'CehMock!2026#Secure'),
        database: process.env.DB_NAME || (isLocalDev ? 'ceh_mock_exam' : 'u741730784_cehmockexam'),
        waitForConnections: true,
        connectionLimit: parseInt(process.env.DB_CONNECTION_LIMIT, 10) || 10
    },
    examDurationMinutes: parseInt(process.env.EXAM_DURATION_MINUTES, 10) || 240,
    eyeDeviationThreshold: parseFloat(process.env.EYE_DEVIATION_THRESHOLD) || 0.25,
    eyeSuspiciousDurationMs: parseInt(process.env.EYE_SUSPICIOUS_DURATION_MS, 10) || 1800
};
