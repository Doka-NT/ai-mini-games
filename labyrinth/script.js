const canvas = document.getElementById('maze');
const ctx = canvas.getContext('2d');

// Аудио контекст и звуки
let audioCtx = null;
let sounds = {
    step: null,
    wall: null,
    win: null
};

// Инициализация аудио
function initAudio() {
    try {
        audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        
        // Звук шага
        sounds.step = {
            play: () => {
                if (!audioCtx) return;
                const osc = audioCtx.createOscillator();
                const gain = audioCtx.createGain();
                osc.type = 'sine';
                osc.frequency.setValueAtTime(880, audioCtx.currentTime);
                gain.gain.setValueAtTime(0.2, audioCtx.currentTime);
                gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.1);
                osc.connect(gain).connect(audioCtx.destination);
                osc.start();
                osc.stop(audioCtx.currentTime + 0.1);
            }
        };

        // Звук удара о стену
        sounds.wall = {
            play: () => {
                if (!audioCtx) return;
                const osc = audioCtx.createOscillator();
                const gain = audioCtx.createGain();
                osc.type = 'triangle';
                osc.frequency.setValueAtTime(150, audioCtx.currentTime);
                gain.gain.setValueAtTime(0.3, audioCtx.currentTime);
                gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.2);
                osc.connect(gain).connect(audioCtx.destination);
                osc.start();
                osc.stop(audioCtx.currentTime + 0.2);
            }
        };

        // Звук победы
        sounds.win = {
            play: () => {
                if (!audioCtx) return;
                const notes = [523.25, 659.25, 783.99, 1046.50]; // До Ми Соль До
                notes.forEach((freq, index) => {
                    const osc = audioCtx.createOscillator();
                    const gain = audioCtx.createGain();
                    osc.type = 'sine';
                    osc.frequency.value = freq;
                    gain.gain.setValueAtTime(0.2, audioCtx.currentTime + index * 0.1);
                    gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + index * 0.1 + 0.3);
                    osc.connect(gain).connect(audioCtx.destination);
                    osc.start(audioCtx.currentTime + index * 0.1);
                    osc.stop(audioCtx.currentTime + index * 0.1 + 0.3);
                });
            }
        };
    } catch (e) {
        console.error('Ошибка инициализации аудио:', e);
    }
}

// Размеры лабиринта
const CELL_SIZE = 25;  // Увеличиваем размер клетки для лучшей видимости
const ROWS = 31;  // 63 / 2 (округлено до нечетного)
const COLS = 31;  // 63 / 2 (округлено до нечетного)

// Размеры канваса
canvas.width = COLS * CELL_SIZE;
canvas.height = ROWS * CELL_SIZE;

// Цвета
const WALL_COLOR = '#2c3e50';
const PATH_COLOR = '#ecf0f1';
const PLAYER_COLOR = '#e74c3c';
const EXIT_COLOR = '#27ae60';

// Позиция игрока
let playerPos = {
    x: 1,
    y: 1
};

// Создаем пустой лабиринт
let maze = Array(ROWS).fill().map(() => Array(COLS).fill(1));

// Генерация лабиринта с использованием алгоритма Recursive Backtracking
function generateMaze(row, col) {
    maze[row][col] = 0;
    
    // Направления: вверх, вправо, вниз, влево
    const directions = [
        [-2, 0],
        [0, 2],
        [2, 0],
        [0, -2]
    ];
    
    // Перемешиваем направления для случайности
    shuffleArray(directions);
    
    // Проверяем каждое направление
    for (let [dy, dx] of directions) {
        const newRow = row + dy;
        const newCol = col + dx;
        
        if (newRow > 0 && newRow < ROWS - 1 && newCol > 0 && newCol < COLS - 1 && maze[newRow][newCol] === 1) {
            // Прорубаем путь
            maze[row + dy/2][col + dx/2] = 0;
            maze[newRow][newCol] = 0;
            generateMaze(newRow, newCol);
        }
    }
}

// Функция для перемешивания массива
function shuffleArray(array) {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
}

// Отрисовка лабиринта
function drawMaze() {
    for (let row = 0; row < ROWS; row++) {
        for (let col = 0; col < COLS; col++) {
            const x = col * CELL_SIZE;
            const y = row * CELL_SIZE;
            
            ctx.fillStyle = maze[row][col] ? WALL_COLOR : PATH_COLOR;
            ctx.fillRect(x, y, CELL_SIZE, CELL_SIZE);
        }
    }
    
    // Отрисовка выхода
    ctx.fillStyle = EXIT_COLOR;
    ctx.fillRect((COLS-2) * CELL_SIZE, (ROWS-2) * CELL_SIZE, CELL_SIZE, CELL_SIZE);
    
    // Отрисовка игрока (круг)
    ctx.fillStyle = PLAYER_COLOR;
    ctx.beginPath();
    ctx.arc(
        playerPos.x * CELL_SIZE + CELL_SIZE/2,
        playerPos.y * CELL_SIZE + CELL_SIZE/2,
        CELL_SIZE/2 - 2,
        0,
        Math.PI * 2
    );
    ctx.fill();
}

// Обработка движения игрока
function movePlayer(dx, dy) {
    if (!audioCtx) initAudio();
    
    const newX = playerPos.x + dx;
    const newY = playerPos.y + dy;
    
    // Проверяем, не выходит ли игрок за пределы и не врезается ли в стену
    if (newX >= 0 && newX < COLS && newY >= 0 && newY < ROWS) {
        if (maze[newY][newX] === 0) {
            playerPos.x = newX;
            playerPos.y = newY;
            sounds.step.play();
            
            // Проверяем, достиг ли игрок выхода
            if (newX === COLS-2 && newY === ROWS-2) {
                sounds.win.play();
                setTimeout(() => {
                    alert('Поздравляем! Вы прошли лабиринт!');
                    initGame();
                }, 500);
            }
        } else {
            sounds.wall.play();
        }
    }
    drawMaze();
}

// Отслеживание нажатых клавиш
let keys = {
    ArrowUp: false,
    ArrowDown: false,
    ArrowLeft: false,
    ArrowRight: false
};

// Обработчики нажатия и отпускания клавиш
document.addEventListener('keydown', (e) => {
    if (keys.hasOwnProperty(e.key)) {
        keys[e.key] = true;
    }
});

document.addEventListener('keyup', (e) => {
    if (keys.hasOwnProperty(e.key)) {
        keys[e.key] = false;
    }
});

// Функция обновления состояния игры
function gameLoop() {
    if (keys.ArrowUp) movePlayer(0, -1);
    if (keys.ArrowDown) movePlayer(0, 1);
    if (keys.ArrowLeft) movePlayer(-1, 0);
    if (keys.ArrowRight) movePlayer(1, 0);
    
    requestAnimationFrame(gameLoop);
}

// Запускаем игровой цикл
gameLoop();

// Инициализация игры
function initGame() {
    // Заполняем лабиринт стенами
    maze = Array(ROWS).fill().map(() => Array(COLS).fill(1));
    
    // Генерируем лабиринт
    generateMaze(1, 1);
    
    // Устанавливаем игрока на старт
    playerPos = {
        x: 1,
        y: 1
    };
    
    // Отрисовываем начальное состояние
    drawMaze();
}

// Запускаем игру
initGame();
