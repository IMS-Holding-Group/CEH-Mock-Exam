document.getElementById('startForm').addEventListener('submit', async function(e) {
    e.preventDefault();
    const nameInput = document.getElementById('traineeName');
    const name = nameInput.value.trim();
    if (!name) {
        alert('يرجى إدخال اسم المتدربة');
        return;
    }
    try {
        const session = await API.startSession(name);
        sessionStorage.setItem('ceh_session_id', session.sessionId);
        sessionStorage.setItem('ceh_trainee_name', session.traineeName);
        sessionStorage.setItem('ceh_duration_minutes', session.durationMinutes);
        sessionStorage.setItem('ceh_eye_threshold', session.eyeDeviationThreshold);
        sessionStorage.setItem('ceh_eye_duration', session.eyeSuspiciousDurationMs);
        window.location.href = '/exam.html';
    } catch (err) {
        alert(err.message);
    }
});
