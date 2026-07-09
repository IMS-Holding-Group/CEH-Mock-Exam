CREATE DATABASE IF NOT EXISTS ceh_mock_exam CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE ceh_mock_exam;

CREATE TABLE IF NOT EXISTS trainees (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(150) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uk_trainee_name (name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS questions (
    id INT AUTO_INCREMENT PRIMARY KEY,
    question_number VARCHAR(50) DEFAULT NULL,
    category VARCHAR(120) DEFAULT NULL,
    question_text TEXT NOT NULL,
    correct_option_key VARCHAR(5) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS question_options (
    id INT AUTO_INCREMENT PRIMARY KEY,
    question_id INT NOT NULL,
    option_key VARCHAR(5) NOT NULL,
    option_text TEXT NOT NULL,
    FOREIGN KEY (question_id) REFERENCES questions(id) ON DELETE CASCADE,
    UNIQUE KEY uk_question_option (question_id, option_key)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS exam_sessions (
    id INT AUTO_INCREMENT PRIMARY KEY,
    trainee_id INT NOT NULL,
    started_at DATETIME NOT NULL,
    ended_at DATETIME DEFAULT NULL,
    duration_seconds INT DEFAULT 0,
    total_questions INT DEFAULT 0,
    correct_count INT DEFAULT 0,
    wrong_count INT DEFAULT 0,
    score_percent DECIMAL(5,2) DEFAULT 0,
    eye_suspicious_count INT DEFAULT 0,
    copy_attempts_count INT DEFAULT 0,
    camera_loss_count INT DEFAULT 0,
    translate_attempts_count INT DEFAULT 0,
    status ENUM('active', 'paused', 'completed', 'auto_submitted') DEFAULT 'active',
    FOREIGN KEY (trainee_id) REFERENCES trainees(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS session_answers (
    id INT AUTO_INCREMENT PRIMARY KEY,
    session_id INT NOT NULL,
    question_id INT NOT NULL,
    selected_option_key VARCHAR(5) DEFAULT NULL,
    is_correct TINYINT(1) DEFAULT 0,
    FOREIGN KEY (session_id) REFERENCES exam_sessions(id) ON DELETE CASCADE,
    FOREIGN KEY (question_id) REFERENCES questions(id) ON DELETE CASCADE,
    UNIQUE KEY uk_session_question (session_id, question_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS monitoring_events (
    id INT AUTO_INCREMENT PRIMARY KEY,
    session_id INT NOT NULL,
    event_type ENUM('eye_suspicious', 'copy_attempt', 'camera_loss', 'translate_attempt') NOT NULL,
    occurred_at DATETIME NOT NULL,
    details VARCHAR(500) DEFAULT NULL,
    FOREIGN KEY (session_id) REFERENCES exam_sessions(id) ON DELETE CASCADE,
    INDEX idx_session_event (session_id, event_type)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO questions (question_number, category, question_text, correct_option_key) VALUES
('1', 'Footprinting', 'أي أداة تُستخدم لجمع معلومات DNS عن نطاق مستهدف؟', 'B');

SET @q1 = LAST_INSERT_ID();
INSERT INTO question_options (question_id, option_key, option_text) VALUES
(@q1, 'A', 'Wireshark'),
(@q1, 'B', 'nslookup'),
(@q1, 'C', 'Nmap'),
(@q1, 'D', 'Metasploit');

INSERT INTO questions (question_number, category, question_text, correct_option_key) VALUES
('2', 'Scanning', 'أي من البروتوكولات التالية يعمل افتراضيًا على المنفذ 443؟', 'C');

SET @q2 = LAST_INSERT_ID();
INSERT INTO question_options (question_id, option_key, option_text) VALUES
(@q2, 'A', 'FTP'),
(@q2, 'B', 'Telnet'),
(@q2, 'C', 'HTTPS'),
(@q2, 'D', 'SMTP');

INSERT INTO questions (question_number, category, question_text, correct_option_key) VALUES
('3', 'Malware', 'أي نوع من البرمجيات الخبيثة ينتظر تنفيذ شرط معين قبل التفعيل؟', 'D');

SET @q3 = LAST_INSERT_ID();
INSERT INTO question_options (question_id, option_key, option_text) VALUES
(@q3, 'A', 'Worm'),
(@q3, 'B', 'Adware'),
(@q3, 'C', 'Spyware'),
(@q3, 'D', 'Logic Bomb');
