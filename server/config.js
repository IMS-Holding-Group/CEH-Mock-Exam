const isHostedProduction = !!process.env.PORT;

module.exports = {
    port: parseInt(process.env.PORT, 10) || 3000,
    host: process.env.HOST || '0.0.0.0',
    db: {
        host: process.env.DB_HOST || 'localhost',
        user: process.env.DB_USER || (isHostedProduction ? 'u741730784_cehmockuser' : 'root'),
        password: process.env.DB_PASSWORD || (isHostedProduction ? 'CehMock!2026#Secure' : ''),
        database: process.env.DB_NAME || (isHostedProduction ? 'u741730784_cehmockexam' : 'ceh_mock_exam'),
        waitForConnections: true,
        connectionLimit: parseInt(process.env.DB_CONNECTION_LIMIT, 10) || 10
    },
    examDurationMinutes: parseInt(process.env.EXAM_DURATION_MINUTES, 10) || 240,
    eyeDeviationThreshold: parseFloat(process.env.EYE_DEVIATION_THRESHOLD) || 0.25,
    eyeSuspiciousDurationMs: parseInt(process.env.EYE_SUSPICIOUS_DURATION_MS, 10) || 1800
};
