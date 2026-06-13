// --- Game State Variables ---
let hits = 0;
let totalClicks = 0;
let timeLeft = 10.00;
let gameActive = false;
let leaderboard = [];

// Intervals
let timerInterval = null;
let spawnInterval = null;

// --- DOM Elements ---
const startScreen = document.getElementById('start-screen');
const playScreen = document.getElementById('play-screen');
const resultScreen = document.getElementById('result-screen');

const btnStart = document.getElementById('btn-start');
const btnRestart = document.getElementById('btn-restart');

const hudTime = document.getElementById('hud-time');
const hudHits = document.getElementById('hud-hits');
const hudAccuracy = document.getElementById('hud-accuracy');

const playZone = document.getElementById('play-zone');

const resultHits = document.getElementById('result-hits');
const resultAccuracy = document.getElementById('result-accuracy');
const resultTps = document.getElementById('result-tps');
const resultRating = document.getElementById('result-rating');

// Leaderboard & Save Form DOM
const startLeaderboardBody = document.getElementById('start-leaderboard-body');
const resultLeaderboardBody = document.getElementById('result-leaderboard-body');
const scoreSaveContainer = document.getElementById('score-save-container');
const scoreSaveForm = document.getElementById('score-save-form');
const playerNameInput = document.getElementById('player-name');
const playerPasswordInput = document.getElementById('player-password');

// --- Initialization ---
document.addEventListener('DOMContentLoaded', () => {
    loadLeaderboard();
    initEventListeners();
});

function initEventListeners() {
    btnStart.addEventListener('click', startGame);
    btnRestart.addEventListener('click', startGame);
    
    // Listen for misses on the play zone
    playZone.addEventListener('mousedown', handleMissClick);
    
    // Leaderboard Form Submission
    scoreSaveForm.addEventListener('submit', handleScoreSave);
}

// --- Screen Switching Helper ---
function showScreen(screenToShow) {
    [startScreen, playScreen, resultScreen].forEach(screen => {
        screen.classList.remove('active');
    });
    screenToShow.classList.add('active');
}

// --- Leaderboard Storage & Sort ---
function loadLeaderboard() {
    const stored = localStorage.getItem('aimpro_leaderboard');
    if (stored) {
        try {
            leaderboard = JSON.parse(stored);
        } catch (e) {
            console.error('Failed to parse leaderboard data', e);
            leaderboard = [];
        }
    } else {
        // Load default mock leaderboard ranks for initial visual layout
        leaderboard = [
            { name: 'AimGod', password: '1111', score: 18, accuracy: 96, date: new Date().toISOString() },
            { name: 'FakerAim', password: '2222', score: 15, accuracy: 88, date: new Date().toISOString() },
            { name: 'BronzeCree', password: '3333', score: 8, accuracy: 68, date: new Date().toISOString() }
        ];
        saveLeaderboardToStorage();
    }
    renderLeaderboard();
}

function saveLeaderboardToStorage() {
    localStorage.setItem('aimpro_leaderboard', JSON.stringify(leaderboard));
}

function renderLeaderboard() {
    // Sort ranks: Score Descending -> Accuracy Descending -> Date Oldest First
    leaderboard.sort((a, b) => {
        if (b.score !== a.score) {
            return b.score - a.score;
        }
        return b.accuracy - a.accuracy;
    });

    const top5 = leaderboard.slice(0, 5);
    
    // Render HTML helper
    const buildTableHTML = (data) => {
        if (data.length === 0) {
            return `<tr><td colspan="4" class="empty-table-msg">기록이 없습니다. 첫 기록을 세워보세요!</td></tr>`;
        }
        return data.map((player, idx) => {
            const rank = idx + 1;
            return `
                <tr class="rank-${rank}">
                    <td class="rank-cell">#${rank}</td>
                    <td>${escapeHTML(player.name)}</td>
                    <td><strong>${player.score}</strong> HITS</td>
                    <td>${player.accuracy}%</td>
                </tr>
            `;
        }).join('');
    };

    const tableHTML = buildTableHTML(top5);
    startLeaderboardBody.innerHTML = tableHTML;
    resultLeaderboardBody.innerHTML = tableHTML;
}

// --- Game Logic ---
function startGame() {
    // Reset state
    hits = 0;
    totalClicks = 0;
    timeLeft = 10.00;
    gameActive = true;
    
    // Clear play area
    playZone.innerHTML = '';
    
    // Update HUD display
    hudTime.textContent = '10.00s';
    hudHits.textContent = '0';
    hudAccuracy.textContent = '100%';
    
    // Reset Registration Form Container Display
    scoreSaveContainer.style.display = 'block';
    scoreSaveForm.reset();
    
    showScreen(playScreen);
    
    // Start High Precision Timer (Updates every 10ms for smooth decimal countdown)
    let lastTime = performance.now();
    timerInterval = setInterval(() => {
        const now = performance.now();
        const delta = (now - lastTime) / 1000;
        lastTime = now;
        
        timeLeft -= delta;
        if (timeLeft <= 0) {
            timeLeft = 0;
            hudTime.textContent = '0.00s';
            endGame();
        } else {
            hudTime.textContent = `${timeLeft.toFixed(2)}s`;
        }
    }, 10);
    
    // Target Spawner: Spawns targets at a calibrated comfortable speed (every 550ms)
    spawnInterval = setInterval(spawnTarget, 550);
}

function spawnTarget() {
    if (!gameActive) return;

    const target = document.createElement('div');
    target.className = 'target';
    
    // Calculate random size - slightly larger for comfort (22px ~ 58px)
    const size = Math.floor(Math.random() * (58 - 22 + 1)) + 22;
    target.style.width = `${size}px`;
    target.style.height = `${size}px`;
    
    // Position bounds inside the 16:9 box (5% to 95% width, 10% to 90% height)
    const xPos = Math.random() * 90 + 5; 
    const yPos = Math.random() * 80 + 10; 
    
    target.style.left = `calc(${xPos}% - ${size/2}px)`;
    target.style.top = `calc(${yPos}% - ${size/2}px)`;
    
    // Calibrated survival lifespan - targets stay on screen longer (1200ms ~ 1650ms)
    const lifespan = Math.floor(Math.random() * (1650 - 1200 + 1)) + 1200;
    
    // Handle Auto-expiry transition
    const expireTimer = setTimeout(() => {
        if (target.parentNode) {
            target.classList.add('expiring');
            setTimeout(() => {
                if (target.parentNode) {
                    playZone.removeChild(target);
                }
            }, 100);
        }
    }, lifespan - 100);

    target.dataset.timeoutId = expireTimer;
    
    target.addEventListener('mousedown', (e) => {
        handleTargetHit(e, target, size);
    });
    
    playZone.appendChild(target);
}

function handleTargetHit(e, targetEl, size) {
    if (!gameActive) return;
    
    e.stopPropagation();
    
    const timeoutId = targetEl.dataset.timeoutId;
    if (timeoutId) clearTimeout(Number(timeoutId));
    
    const rect = playZone.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const clickY = e.clientY - rect.top;
    
    createExplosion(clickX, clickY);
    
    if (targetEl.parentNode) {
        playZone.removeChild(targetEl);
    }
    
    hits++;
    totalClicks++;
    updateHUD();
}

function handleMissClick(e) {
    if (!gameActive) return;
    
    totalClicks++;
    updateHUD();
}

function updateHUD() {
    hudHits.textContent = hits;
    const accuracy = totalClicks === 0 ? 100 : Math.round((hits / totalClicks) * 100);
    hudAccuracy.textContent = `${accuracy}%`;
}

function createExplosion(x, y) {
    const particleCount = 10;
    
    for (let i = 0; i < particleCount; i++) {
        const particle = document.createElement('div');
        particle.className = 'particle';
        
        particle.style.left = `${x}px`;
        particle.style.top = `${y}px`;
        
        const angle = Math.random() * Math.PI * 2;
        const distance = Math.random() * 40 + 20; 
        
        const tx = Math.cos(angle) * distance;
        const ty = Math.sin(angle) * distance;
        
        particle.style.setProperty('--tx', `${tx}px`);
        particle.style.setProperty('--ty', `${ty}px`);
        
        playZone.appendChild(particle);
        
        setTimeout(() => {
            if (particle.parentNode) {
                playZone.removeChild(particle);
            }
        }, 400);
    }
}

function endGame() {
    gameActive = false;
    
    clearInterval(timerInterval);
    clearInterval(spawnInterval);
    
    playZone.innerHTML = '';
    
    const accuracyVal = totalClicks === 0 ? 0 : Math.round((hits / totalClicks) * 100);
    const tpsVal = (hits / 10).toFixed(2);
    
    // Calibrated thresholds for Ratings based on slower spawning speeds
    let rating = 'ROOKIE';
    if (hits >= 15 && accuracyVal >= 90) {
        rating = 'GODLIKE';
    } else if (hits >= 12 && accuracyVal >= 85) {
        rating = 'PRO';
    } else if (hits >= 9 && accuracyVal >= 75) {
        rating = 'SEMI-PRO';
    } else if (hits >= 6 && accuracyVal >= 60) {
        rating = 'AMATEUR';
    }
    
    resultHits.textContent = hits;
    resultAccuracy.textContent = `${accuracyVal}%`;
    resultTps.textContent = tpsVal;
    resultRating.textContent = rating;
    
    if (rating === 'GODLIKE') {
        resultRating.style.color = 'var(--neon-pink)';
    } else if (rating === 'PRO') {
        resultRating.style.color = 'var(--neon-cyan)';
    } else if (rating === 'SEMI-PRO') {
        resultRating.style.color = 'var(--neon-green)';
    } else {
        resultRating.style.color = 'var(--text-muted)';
    }
    
    renderLeaderboard();
    showScreen(resultScreen);
}

// --- Leaderboard Form Handler ---
function handleScoreSave(e) {
    e.preventDefault();
    
    const name = playerNameInput.value.trim();
    const password = playerPasswordInput.value.trim();
    
    if (!name || !password) {
        alert('닉네임과 비밀번호를 모두 입력해 주세요.');
        return;
    }
    
    const scoreVal = hits;
    const accuracyVal = totalClicks === 0 ? 0 : Math.round((hits / totalClicks) * 100);
    
    // Check if nickname already exists
    const existingPlayerIndex = leaderboard.findIndex(p => p.name.toLowerCase() === name.toLowerCase());
    
    if (existingPlayerIndex !== -1) {
        const existingPlayer = leaderboard[existingPlayerIndex];
        
        // Verify Password
        if (existingPlayer.password !== password) {
            alert('비밀번호가 일치하지 않습니다. 기존에 등록된 다른 플레이어의 닉네임이거나 잘못 입력하셨습니다.');
            return;
        }
        
        // If password is correct, check if the new score is a high score
        if (scoreVal > existingPlayer.score || (scoreVal === existingPlayer.score && accuracyVal > existingPlayer.accuracy)) {
            leaderboard[existingPlayerIndex].score = scoreVal;
            leaderboard[existingPlayerIndex].accuracy = accuracyVal;
            leaderboard[existingPlayerIndex].date = new Date().toISOString();
            alert('최고 점수가 성공적으로 갱신되었습니다!');
        } else {
            alert('등록하려는 점수가 기존에 기록하신 최고 기록보다 낮거나 같습니다.');
        }
    } else {
        // Create new ranking slot
        leaderboard.push({
            name: name,
            password: password,
            score: scoreVal,
            accuracy: accuracyVal,
            date: new Date().toISOString()
        });
        alert('명예의 전당에 새로운 기록이 등록되었습니다!');
    }
    
    saveLeaderboardToStorage();
    renderLeaderboard();
    
    // Hide form after successful registration
    scoreSaveContainer.style.display = 'none';
}

// --- Helper: Escape HTML ---
function escapeHTML(str) {
    return str.replace(/[&<>'"]/g, 
        tag => ({
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            "'": '&#39;',
            '"': '&quot;'
        }[tag] || tag)
    );
}
