/* ===================== ЭЛЕМЕНТЫ СТРАНИЦЫ ===================== */
const cards = document.querySelectorAll('.memory-card');
const box = document.getElementsByClassName('box');
const mainPage = document.getElementsByClassName('mainPage');
const gameOver = document.getElementsByClassName('gameOver');
const gameOver1 = document.getElementsByClassName('gameOver1');
const gameOverText = document.getElementsByClassName('gameOverText');
const finishGame = document.getElementsByClassName('finishGame');

const levelEl = document.getElementById('level'); // на экране — ROUND
const triesEl = document.getElementById('tries');
const scoreEl = document.getElementById('score');
const healthFill = document.getElementById('healthFill');
const timerEl = document.getElementById('timer');
const movesEl = document.getElementById('moves');
const muteBtn = document.getElementById('muteBtn');
const flash = document.getElementById('flash');
const flashText = document.getElementById('flashText');

/* ===================== КОНФИГ УРОВНЕЙ ===================== */
// 5 уровней: простые сначала (больше времени), с каждым — своя заставка и меньше времени.
// На экране уровни называются раундами (ROUND I..V), как в Mortal Kombat.
const LEVELS = [
  // фоны отзеркалены (*-left.jpg): боец слева, справа место под карты
  { time: 210, bg: 'fon/level1-left.jpg' }, // 3:30
  { time: 180, bg: 'fon/level2-left.jpg' }, // 3:00
  { time: 150, bg: 'fon/level3-left.jpg' }, // 2:30
  { time: 125, bg: 'fon/level4-left.jpg' }, // 2:05
  { time: 105, bg: 'fon/level5-left.jpg' }, // 1:45
];

// Тестовый режим: index.html?test — один уровень из 2 пар, чтобы быстро увидеть победу
const TEST_MODE = typeof location !== 'undefined' && new URLSearchParams(location.search).has('test');
const TEST_PAIRS = 2;
if (TEST_MODE) {
  LEVELS.splice(1); // оставляем только 1-й уровень
  // карты в разметке идут парами подряд — прячем всё после первых TEST_PAIRS пар
  cards.forEach((card, i) => { if (i >= TEST_PAIRS * 2) card.style.display = 'none'; });
}

const START_TRY = 24;                 // попытки (здоровье) на уровень
const MAX_ATTEMPTS = 3;               // попытки на уровень: проиграл — переигрываешь тот же уровень

// римские цифры: в шрифте Creepy нет арабских цифр
const ROMAN = ['I', 'II', 'III', 'IV', 'V'];
const TOTAL_PAIRS = TEST_MODE ? TEST_PAIRS : cards.length / 2; // 12 пар (в тесте — 2)

/* ===================== ЗВУКИ (пути) ===================== */
const SND = {
  match:    'music/во время неправильных карт/mk3-09415.mp3',     // правильная пара
  wrong:    'music/во время неправильных карт/toasty_tfCWsU6.mp3', // неправильная пара ("Toasty!")
  gong:     'music/Начало игры/unknown-artist-z_uk-gonga.mp3',
  music:    'music/Начало игры/Alexey Korovin — MORTAL KOMBAT (Remix).mp3',
  winVoice: 'music/Победа/mk3-09015.mp3',
  winTheme: 'music/Победа/the-immortals-theme-from-mortal-kombat-encounter-the-ultimate (1).mp3',
  loseHit:  'music/во время неправильных карт/mk3-09440.mp3', // удар при проигрыше
  loseVoice:'music/Конец/mk3-09155.mp3',
  loseTheme:'music/Конец/mortal-kombat-george-s.-clinton-demon-warriors-final-kombat-liu-kang-vs.-shang-tsung_(get-tune.net).mp3',
};

/* ===================== СОСТОЯНИЕ ИГРЫ ===================== */
let hasFlippedCard = false;
let lockBoard = false;
let firstCard = null;
let secondCard = null;

let currentLevel = 0;   // индекс уровня (0..4)
let attempt = 1;        // текущая попытка на уровне (1..MAX_ATTEMPTS)
let attemptOver = false; // защита: попытка проиграна, ждём перезапуска уровня
let counterTry = START_TRY;
let counterFinish = TOTAL_PAIRS;
let moves = 0;
let timeLeft = 0;
let timerId = null;
let isMuted = false;
let gameEnded = false;  // защита: финал (победа/проигрыш) запускается один раз

/* фоновая музыка (единый объект — можно ставить на паузу) */
const bgMusic = new Audio();
bgMusic.loop = true;
bgMusic.volume = 0.35;

/* ===================== ЗВУК ===================== */
const soundCache = {};

// заранее подгружаем короткие звуки — чтобы играли сразу, без задержки
[SND.match, SND.wrong, SND.loseHit, SND.loseVoice, SND.winVoice].forEach(src => {
  soundCache[src] = new Audio(src);
  soundCache[src].preload = 'auto';
});

function playSound(src, volume = 1) {
  if (isMuted) return;
  // копия подгруженного звука — можно играть несколько раз подряд
  const a = soundCache[src] ? soundCache[src].cloneNode() : new Audio(src);
  a.volume = volume;
  a.play().catch(() => {});
  return a;
}

function toggleMute() {
  isMuted = !isMuted;
  bgMusic.muted = isMuted;
  muteBtn.textContent = isMuted ? '🔇' : '🔊';
}

/* ===================== ЛОГИКА КАРТ ===================== */
function flipCard() {
  if (lockBoard || gameEnded || attemptOver) return;
  if (this === firstCard) return;
  if (this.classList.contains('matched')) return;

  this.classList.add('flip');

  if (!hasFlippedCard) {
    hasFlippedCard = true;
    firstCard = this;
    return;
  }

  secondCard = this;
  moves++;
  movesEl.textContent = moves;
  checkForMatch();
}

function checkForMatch() {
  const isMatch = firstCard.dataset.framework === secondCard.dataset.framework;
  isMatch ? disableCards() : unFlipCards();
}

// Верная пара
function disableCards() {
  firstCard.classList.add('matched');
  secondCard.classList.add('matched');
  playSound(SND.match);

  counterFinish--;
  if (counterFinish === 0) {
    levelCleared(); // уровень пройден
    return;
  }
  resetBoard();
}

// Неверная пара
function unFlipCards() {
  lockBoard = true;
  playSound(SND.wrong);

  counterTry--;
  updateHealth();

  setTimeout(() => {
    firstCard.classList.remove('flip');
    secondCard.classList.remove('flip');
    resetBoard();
    if (counterTry === 0) attemptLost(); // кончилось здоровье
  }, 1000);
}

function resetBoard() {
  [hasFlippedCard, lockBoard] = [false, false];
  [firstCard, secondCard] = [null, null];
}

/* ===================== ПОЛОСА ЗДОРОВЬЯ ===================== */
function updateHealth() {
  const percent = Math.max(0, (counterTry / START_TRY) * 100);
  healthFill.style.width = percent + '%';
  healthFill.classList.toggle('low', counterTry <= 3);
  scoreEl.textContent = counterTry;
}

/* ===================== ТАЙМЕР (обратный отсчёт) ===================== */
function renderTime() {
  const m = String(Math.floor(timeLeft / 60)).padStart(2, '0');
  const s = String(timeLeft % 60).padStart(2, '0');
  timerEl.textContent = `${m}:${s}`;
  timerEl.classList.toggle('danger', timeLeft <= 10); // краснеет под конец
}

function startCountdown() {
  stopTimer();
  timerId = setInterval(() => {
    timeLeft--;
    renderTime();
    if (timeLeft <= 0) {
      stopTimer();
      attemptLost('TIME UP'); // время вышло
    }
  }, 1000);
}

function stopTimer() {
  clearInterval(timerId);
  timerId = null;
}

/* ===================== ПЕРЕМЕШИВАНИЕ (Фишер–Йетс) ===================== */
function shuffleCards() {
  const positions = [...cards.keys()];
  for (let i = positions.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [positions[i], positions[j]] = [positions[j], positions[i]];
  }
  cards.forEach((card, i) => (card.style.order = positions[i]));
}

/* ===================== ЗАПУСК УРОВНЯ ===================== */
function initLevel(idx) {
  const lvl = LEVELS[idx];

  // заставка уровня
  box[0].style.backgroundImage = `url("${lvl.bg}")`;

  // счётчики
  counterTry = START_TRY;
  counterFinish = TOTAL_PAIRS;
  moves = 0;
  timeLeft = lvl.time;

  attemptOver = false;

  // панель
  levelEl.textContent = idx + 1;
  triesEl.textContent = MAX_ATTEMPTS - attempt + 1; // сколько попыток осталось
  movesEl.textContent = '0';
  updateHealth();
  renderTime();

  // карты: закрыть, снять совпадения, перемешать
  resetBoard();
  cards.forEach(c => c.classList.remove('flip', 'matched'));
  shuffleCards();

  startCountdown();
}

/* ===================== УРОВЕНЬ ПРОЙДЕН ===================== */
function levelCleared() {
  lockBoard = true;
  stopTimer();

  // последний уровень — полная победа (голос сыграет winSequence)
  if (currentLevel >= LEVELS.length - 1) {
    winSequence();
    return;
  }

  playSound(SND.winVoice);

  // иначе — вспышка "ROUND X" (следующий раунд) и переход на него
  showFlash('ROUND ' + ROMAN[currentLevel + 1], 'win', 2200, () => {
    currentLevel++;
    attempt = 1; // на новом раунде попытки заново
    initLevel(currentLevel);
  });
}

/* ===================== ПОПЫТКА ПРОИГРАНА ===================== */
// Попытки остались — вспышка "TRY AGAIN" и тот же раунд заново, иначе — конец игры
function attemptLost(reason = 'DEFEAT') {
  if (attemptOver || gameEnded) return;
  if (attempt >= MAX_ATTEMPTS) {
    loseSequence(reason);
    return;
  }
  attemptOver = true;
  lockBoard = true;
  stopTimer();
  playSound(SND.loseHit);

  attempt++;
  showFlash('TRY AGAIN', 'lose', 2200, () => initLevel(currentLevel));
}

/* ===================== ФИНАЛ С ЗАДЕРЖКОЙ И АНИМАЦИЕЙ ===================== */
function showFlash(text, type, delay, done) {
  flashText.textContent = text;
  flash.className = 'flash show ' + type;
  setTimeout(() => {
    flash.className = 'flash';
    done();
  }, delay);
}

// Победа: голос → вспышка → экран победы + музыка
function winSequence() {
  if (gameEnded) return;
  gameEnded = true;
  lockBoard = true;
  stopTimer();
  bgMusic.pause();
  playSound(SND.winVoice);
  showFlash('FLAWLESS', 'win', 2600, () => {
    box[0].style.display = 'none';
    finishGame[0].style.display = 'flex';
    playSound(SND.winTheme, 0.8);
  });
}

// Проигрыш: удар + голос → вспышка → экран проигрыша + музыка
function loseSequence(reason) {
  if (gameEnded) return;
  gameEnded = true;
  lockBoard = true;
  stopTimer();
  bgMusic.pause();
  playSound(SND.loseHit);
  playSound(SND.loseVoice, 0.6);
  showFlash(reason || 'FATALITY', 'lose', 2600, () => {
    box[0].style.display = 'none';
    gameOver[0].style.display = 'flex';
    gameOverText[0].style.display = 'flex';
    playSound(SND.loseTheme, 0.6);
  });
}

/* ===================== КЛИКИ ПО КАРТАМ ===================== */
cards.forEach(card => card.addEventListener('click', flipCard));

/* ===================== КНОПКИ ЭКРАНОВ ===================== */
function firstClick() {
  box[0].style.display = 'flex';
  mainPage[0].style.display = 'none';
  gameOver1[0].style.display = 'none';

  currentLevel = 0;
  attempt = 1;
  initLevel(0);

  playSound(SND.gong);
  bgMusic.src = SND.music;
  bgMusic.muted = isMuted;
  bgMusic.play().catch(() => {});
}

function mainClick() {
  bgMusic.pause();
  location.reload(); // полный сброс
}
