module.exports = {
    port: 3000,
    db: {
        host: 'localhost',
        user: 'root',
        password: '',
        database: 'ceh_mock_exam',
        waitForConnections: true,
        connectionLimit: 10
    },
    examDurationMinutes: 240,
    eyeDeviationThreshold: 0.25,
    eyeSuspiciousDurationMs: 1800
};
