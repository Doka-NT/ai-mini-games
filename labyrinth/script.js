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

// Позиция игрока и параметры движения
let playerPos = {
    x: 1,
    y: 1,
    lastMoveTime: 0,        // время последнего движения
    moveDelay: 0          // задержка между ходами в мс
};

// Состояние клавиш
let keyStates = {
    ArrowUp: { pressed: false, lastPress: 0 },
    ArrowDown: { pressed: false, lastPress: 0 },
    ArrowLeft: { pressed: false, lastPress: 0 },
    ArrowRight: { pressed: false, lastPress: 0 }
};

// Создаем пустой лабиринт
let maze = Array(ROWS).fill().map(() => Array(COLS).fill(1));

// Генерация лабиринта с использованием алгоритма Recursive Backtracking и дополнительными тупиками
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
    
    // Счетчик для отслеживания количества прорубленных путей
    let pathsCreated = 0;
    
    // Проверяем каждое направление
    for (let [dy, dx] of directions) {
        const newRow = row + dy;
        const newCol = col + dx;
        
        if (newRow > 0 && newRow < ROWS - 1 && newCol > 0 && newCol < COLS - 1 && maze[newRow][newCol] === 1) {
            // Создаем дополнительные тупики с вероятностью 25%
            const shouldCreateDeadEnd = Math.random() < 0.40 && pathsCreated > 0;
            
            // Прорубаем путь
            maze[row + dy/2][col + dx/2] = 0;
            maze[newRow][newCol] = 0;
            pathsCreated++;
            
            if (shouldCreateDeadEnd) {
                // Создаем тупик
                const deadEndDirections = directions.filter(([ddy, ddx]) => 
                    newRow + ddy > 0 && newRow + ddy < ROWS - 1 && 
                    newCol + ddx > 0 && newCol + ddx < COLS - 1 && 
                    maze[newRow + ddy][newCol + ddx] === 1
                );
                
                if (deadEndDirections.length > 0) {
                    const [ddy, ddx] = deadEndDirections[Math.floor(Math.random() * deadEndDirections.length)];
                    maze[newRow + ddy/2][newCol + ddx/2] = 0;
                    maze[newRow + ddy][newCol + ddx] = 0;
                }
            } else {
                generateMaze(newRow, newCol);
            }
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
    
    // Проверяем задержку между ходами
    const currentTime = Date.now();
    if (currentTime - playerPos.lastMoveTime < playerPos.moveDelay) {
        return;
    }
    playerPos.moving = true;
    
    const newX = playerPos.x + dx;
    const newY = playerPos.y + dy;
    
    // Проверяем, не выходит ли игрок за пределы и не врезается ли в стену
    if (newX >= 0 && newX < COLS && newY >= 0 && newY < ROWS) {
        if (maze[newY][newX] === 0) {
            playerPos.x = newX;
            playerPos.y = newY;
            playerPos.lastMoveTime = currentTime;
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
            // Звук удара о стену тоже с задержкой
            if (currentTime - playerPos.lastMoveTime >= playerPos.moveDelay) {
                sounds.wall.play();
                playerPos.lastMoveTime = currentTime;
            }
        }
    }
    drawMaze();
}

// Обработчики нажатия и отпускания клавиш
document.addEventListener('keydown', (e) => {
    switch(e.key) {
        case 'ArrowUp':
            movePlayer(0, -1);
            break;
        case 'ArrowDown':
            movePlayer(0, 1);
            break;
        case 'ArrowLeft':
            movePlayer(-1, 0);
            break;
        case 'ArrowRight':
            movePlayer(1, 0);
            break;
    }
});

// Инициализация игры
function initGame() {
    // Заполняем лабиринт стенами
    maze = Array(ROWS).fill().map(() => Array(COLS).fill(1));
    
    // Генерируем лабиринт
    generateMaze(1, 1);
    
    // Устанавливаем игрока на старт, сохраняя параметры управления
    const moveDelay = playerPos.moveDelay || 150;
    playerPos = {
        x: 1,
        y: 1,
        lastMoveTime: 0,
        moveDelay: moveDelay
    };
    
    // Отрисовываем начальное состояние
    drawMaze();
}

// Запускаем игру
initGame();
