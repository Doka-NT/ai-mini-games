class Game {
    constructor() {
        this.player = document.getElementById('player');
        this.gameArea = document.querySelector('.game');
        this.score = 0;
        this.scoreElement = document.getElementById('score');
        this.speedElement = document.getElementById('speedometer');
        this.roadContainer = document.querySelector('.road-container');
        this.roadLines = document.querySelector('.road-lines');
        this.roadSides = document.querySelector('.road-sides'); // Добавляем ссылку на боковые линии
        this.roadLinesOffset = 0; // Смещение для центральной линии
        this.isPlaying = false;
        this.obstacles = [];
        this.speed = 5;
        this.playerSpeed = 5;
        this.currentSpeed = 0;
        this.maxSpeed = 200;
        // Заглушки для фона и ускорения (мелодии)
        this.bgMusicPlaying = false;
        this.accelSoundPlaying = false;

        // Более отзывчивые параметры для удобной игры:
        this.acceleration = 1.2;    // более быстрое ускорение
        this.deceleration = 0.6;    // более заметное торможение при удержании вниз
        this.naturalDeceleration = 0.18; // естественное замедление при отпускании газа
        this.animationSpeed = 0;    // текущая длительность анимации дороги (s)
        this.animationInertia = 0.96; // коэффициент инерции для сглаживания изменения анимации (0-1), увеличено для более плавного изменения
        this.speedInertia = 0.7;    // отдельный коэффициент инерции для сглаживания скорости игрока (0-1)
        this.spawnTimer = null;
        this.headlightsOn = true;
        this.maxActiveObstacles = 4; // ограничиваем количество соперников для баланса игры

        // Типы машин с их характеристиками движения
        this.carTypes = [
            {
                type: 'sport',
                wheelCount: 4,
                movePattern: 'smooth',
                speed: 2.5,
                verticalSpeed: 8,  // быстрее движется
                baseSpeed: 180,    // базовая скорость спорткара
                amplitude: 20,
                turnAngle: 15  // максимальный угол поворота
            },
            {
                type: 'truck',
                wheelCount: 6,
                movePattern: 'steady',
                speed: 0.8,
                verticalSpeed: 2,  // медленнее движется
                baseSpeed: 60,     // базовая скорость грузовика
                amplitude: 10,
                turnAngle: 5   // грузовики меньше наклоняются
            },
            {
                type: 'suv',
                wheelCount: 4,
                movePattern: 'adaptive',
                speed: 1.5,
                verticalSpeed: 4,  // средняя скорость
                baseSpeed: 120,    // средняя базовая скорость
                amplitude: 15,
                turnAngle: 10  // средний наклон
            }
        ];
        
        // Добавляем колёса игроку
        this.addWheels(this.player, 4);
        
        this.keys = {
            ArrowLeft: false,
            ArrowRight: false,
            ArrowUp: false,
            ArrowDown: false
        };

        this.playerPosition = {
            x: parseInt(getComputedStyle(this.player).left)
        };

        // кэшируем размеры игрока для быстрой проверки коллизий
        this.playerSize = {
            w: this.player.offsetWidth,
            h: this.player.offsetHeight,
            bottomOffset: 16 // совпадает с CSS bottom:16px
        };

        document.getElementById('startButton').addEventListener('click', () => this.startGame());
        document.addEventListener('keydown', (e) => this.handleKeyDown(e));
        document.addEventListener('keyup', (e) => this.handleKeyUp(e));
    }

    handleKeyDown(e) {
        if (this.keys.hasOwnProperty(e.key)) {
            // Добавляем диагностику ускорения (запуск звука только если не был нажат до этого)
            if (e.key === "ArrowUp" && !this.keys.ArrowUp) {
                this.playAccelSound();
            }
            this.keys[e.key] = true;
        }
    }

    handleKeyUp(e) {
        if (this.keys.hasOwnProperty(e.key)) {
            // Прерывание ускорения — останавливаем звук
            if (e.key === "ArrowUp") {
                this.stopAccelSound();
            }
            this.keys[e.key] = false;
        }
    }

    startGame() {
        if (!this.isPlaying) {
            // отменяем предыдущий таймер, если остался после прошлой игры
            if (this.spawnTimer) {
                clearTimeout(this.spawnTimer);
                this.spawnTimer = null;
            }

            // Диагностика: старт фоновой музыки и остановка звука ускорения
            this.playBgMusic();
            this.stopAccelSound();

            this.isPlaying = true;
            this.score = 0;
            this.currentSpeed = 0;
            this.animationSpeed = 0;
            this.roadLinesOffset = 0; // Сбрасываем смещение центральной линии
            this.scoreElement.textContent = this.score;
            this.speedElement.textContent = '0';
            this.updateRoadAnimationSpeed(); // Инициализация анимации дороги
            this.clearObstacles();
            this.gameLoop();
            this.spawnObstacles();
        }
    }

    gameLoop() {
        if (!this.isPlaying) return;

        this.updatePlayerPosition();
        this.updateRoadLinesPosition(); // Обновляем позицию центральной линии
        this.updateObstacles();
        this.checkCollisions();

        requestAnimationFrame(() => this.gameLoop());
    }

    updatePlayerPosition() {
        // Вычисляем целевую скорость в зависимости от ввода
        let targetSpeed = this.currentSpeed;

        if (this.keys.ArrowUp) {
            // Прогрессивное ускорение: медленнее на высокой скорости
            const accelerationFactor = 1 - (this.currentSpeed / this.maxSpeed) * 0.5;
            targetSpeed = Math.min(this.maxSpeed, this.currentSpeed + this.acceleration * accelerationFactor);
        } else if (this.keys.ArrowDown) {
            // Тормозим сильнее при удержании вниз
            targetSpeed = Math.max(0, this.currentSpeed - this.deceleration);
        } else {
            // Естественное плавное замедление при отпускании газа
            targetSpeed = Math.max(0, this.currentSpeed - this.naturalDeceleration);
        }

        // Сглаживаем переход к целевой скорости, чтобы убрать резкие скачки при отпускании клавиши
        let inertia = Math.max(0, Math.min(0.98, this.speedInertia)); // используем отдельный коэффициент для скорости
        // При ускорении даём более быстрый отклик (меньше инерции)
        if (this.keys.ArrowUp) {
            inertia = Math.max(0, Math.min(0.98, this.speedInertia * 0.6));
        }
        this.currentSpeed = this.currentSpeed * inertia + targetSpeed * (1 - inertia);

        // Если скорость очень мала, устанавливаем в 0 (устранение "дрейфа")
        if (this.currentSpeed < 0.02) this.currentSpeed = 0;

        // Обновление спидометра (округлённое значение)
        this.speedElement.textContent = Math.floor(this.currentSpeed);

        // Обновление скорости анимации дороги (использует this.animationSpeed внутри)
        this.updateRoadAnimationSpeed();

        // Скорость движения машины по X зависит от текущей (сглаженной) скорости
        const effectiveSpeed = this.playerSpeed * (1 + this.currentSpeed / 100);

        if (this.keys.ArrowLeft) {
            this.playerPosition.x = Math.max(0, this.playerPosition.x - effectiveSpeed);
        }
        if (this.keys.ArrowRight) {
            this.playerPosition.x = Math.min(
                this.gameArea.offsetWidth - this.player.offsetWidth,
                this.playerPosition.x + effectiveSpeed
            );
        }
        
        // Обновление позиции игрока
        this.player.style.left = `${this.playerPosition.x}px`;
        
        // Эффект мигания фар (оставляем без изменений)
        if (Math.random() < 0.05) {
            this.headlightsOn = !this.headlightsOn;
            const headlights = this.player.querySelectorAll('.headlight');
            headlights.forEach(light => {
                light.style.opacity = this.headlightsOn ? '1' : '0.7';
            });
        }
    }

    addWheels(element, wheelCount) {
        const wheelPositions = ['front-left', 'front-right'];
        if (wheelCount >= 4) {
            wheelPositions.push('back-left', 'back-right');
        }
        if (wheelCount === 6) {
            wheelPositions.push('middle-left', 'middle-right');
        }
        
        wheelPositions.forEach(position => {
            const wheel = document.createElement('div');
            wheel.className = `wheel ${position}`;
            element.appendChild(wheel);
        });
    }

    getRandomCarType() {
        return this.carTypes[Math.floor(Math.random() * this.carTypes.length)];
    }

    spawnObstacles() {
        if (!this.isPlaying) return;

        // Ограничиваем количество активных машин для снижения нагрузки
        if (this.obstacles.length >= this.maxActiveObstacles) {
            const nextDelayShort = 800 + Math.random() * 1200; // увеличиваем задержку между появлением машин
            this.spawnTimer = setTimeout(() => this.spawnObstacles(), nextDelayShort);
            return;
        }

        const carType = this.getRandomCarType();
        const obstacle = document.createElement('div');
        obstacle.className = `obstacle car-${carType.type}`;
        
        // Разная ширина для разных типов машин
        const maxX = this.gameArea.offsetWidth - (carType.type === 'truck' ? 70 : 60);
        const startX = Math.random() * maxX;
        const startY = - (carType.type === 'truck' ? 140 : 100);
        obstacle.style.left = `${startX}px`;
        obstacle.style.top = `${startY}px`;
        
        // Храним числовые позиции в data-* чтобы сократить layout-access и парсинг style
        obstacle.dataset.movePattern = carType.movePattern;
        obstacle.dataset.speed = carType.speed;
        obstacle.dataset.verticalSpeed = carType.verticalSpeed;
        obstacle.dataset.amplitude = carType.amplitude;
        obstacle.dataset.startX = startX;
        obstacle.dataset.x = startX;
        obstacle.dataset.y = startY;
        obstacle.dataset.prevX = startX;
        obstacle.dataset.turnAngle = carType.turnAngle;
        obstacle.dataset.baseSpeed = carType.baseSpeed;
        obstacle.dataset.time = 0;
        
        // НЕ добавляем дочерние элементы (колёса) для препятствий — это уменьшает DOM-узлы и нагрузку
        this.gameArea.appendChild(obstacle);

        // кэшируем ширину/высоту сразу после добавления в DOM
        obstacle.dataset.width = obstacle.offsetWidth;
        obstacle.dataset.height = obstacle.offsetHeight;

        this.obstacles.push(obstacle);

        // сохраняем id таймера чтобы можно было отменить при сбросе/конце игры
        const nextDelay = 900 + Math.random() * 1200;
        this.spawnTimer = setTimeout(() => this.spawnObstacles(), nextDelay);
    }

    updateObstaclePosition(obstacle) {
        const movePattern = obstacle.dataset.movePattern;
        const speed = parseFloat(obstacle.dataset.speed);
        const amplitude = parseFloat(obstacle.dataset.amplitude);
        const startX = parseFloat(obstacle.dataset.startX);
        const time = parseFloat(obstacle.dataset.time);
        const turnAngle = parseFloat(obstacle.dataset.turnAngle) || 5;
        const oWidth = parseFloat(obstacle.dataset.width) || obstacle.offsetWidth;
        const maxX = this.gameArea.offsetWidth - oWidth;
        const baseSpeed = parseFloat(obstacle.dataset.baseSpeed) || 100;

        // читаем позиции из dataset (числа) — это значительно сокращает обращения к стилям
        let prevX = parseFloat(obstacle.dataset.prevX) || startX;
        let newX = startX;

        switch(movePattern) {
            case 'smooth':
                newX = startX + Math.sin(time * 0.015) * amplitude;
                break;
            case 'steady':
                newX = startX + Math.sin(time * 0.008) * amplitude;
                break;
            case 'adaptive':
                newX = startX + Math.sin(time * 0.012) * amplitude;
                break;
        }

        // Простая логика избегания других машин: если рядом по вертикали и потенциально пересекаются по X — сдвигаем
        const y = parseFloat(obstacle.dataset.y) || 0;
        for (let other of this.obstacles) {
            if (other === obstacle) continue;
            const oy = parseFloat(other.dataset.y) || 0;
            // рассматриваем только ближайших по Y (они на экране рядом)
            if (Math.abs(oy - y) < 120) {
                const ox = parseFloat(other.dataset.x) || 0;
                const otherW = parseFloat(other.dataset.width) || other.offsetWidth;
                const minDist = (oWidth + otherW) * 0.6;
                const gap = newX - ox;
                if (Math.abs(gap) < minDist) {
                    // сдвигаем в сторону от другой машины
                    if (gap >= 0) {
                        newX = ox + minDist;
                    } else {
                        newX = ox - minDist;
                    }
                }
            }
        }

        // Плавный поворот в зависимости от дельты X, ограничиваем углом поворота
        const deltaX = newX - prevX;
        let rotation = Math.max(-turnAngle, Math.min(turnAngle, deltaX * 2));

        // Ограничиваем движение границами дороги
        newX = Math.max(0, Math.min(maxX, newX));

        // Записываем обновлённые позиции в dataset и в стиль один раз
        obstacle.dataset.prevX = newX;
        obstacle.dataset.x = newX;
        obstacle.style.left = `${newX}px`;
        obstacle.style.transform = `rotate(${rotation}deg)`;
        obstacle.dataset.time = time + speed;
    }

    updateObstacles() {
        // идём с конца чтобы безопасно удалять элементы внутри цикла
        for (let i = this.obstacles.length - 1; i >= 0; i--) {
            const obstacle = this.obstacles[i];
            const baseSpeed = parseFloat(obstacle.dataset.baseSpeed) || 100;
            const speedDiff = this.currentSpeed - baseSpeed;
            // Вычисляем относительную скорость обгона
            const relativeSpeed = parseFloat(obstacle.dataset.verticalSpeed) + (speedDiff * 0.05);
            const y = (parseFloat(obstacle.dataset.y) || 0) + relativeSpeed;
            obstacle.dataset.y = y;

            const oHeight = parseFloat(obstacle.dataset.height) || obstacle.offsetHeight;
            if (y > this.gameArea.offsetHeight + oHeight) {
                obstacle.remove();
                this.obstacles.splice(i, 1);
                this.updateScore();
                continue;
            }

            obstacle.style.top = `${y}px`;
            // обновляем горизонтальную позицию и поворот с учётом избегания
            this.updateObstaclePosition(obstacle);
        }
    }

    checkCollisions() {
        // используем кэшированные позиции/размеры — это быстрее, чем getBoundingClientRect для каждого объекта
        const pLeft = this.playerPosition.x;
        const pTop = this.gameArea.offsetHeight - this.playerSize.bottomOffset - this.playerSize.h;
        const pRight = pLeft + this.playerSize.w;
        const pBottom = pTop + this.playerSize.h;

        for (let obstacle of this.obstacles) {
            const oLeft = parseFloat(obstacle.dataset.x) || 0;
            const oTop = parseFloat(obstacle.dataset.y) || 0;
            const oW = parseFloat(obstacle.dataset.width) || obstacle.offsetWidth;
            const oH = parseFloat(obstacle.dataset.height) || obstacle.offsetHeight;
            const oRight = oLeft + oW;
            const oBottom = oTop + oH;

            if (!(pRight < oLeft || pLeft > oRight || pBottom < oTop || pTop > oBottom)) {
                this.gameOver();
                return;
            }
        }
    }

    isColliding(rect1, rect2) {
        return !(rect1.right < rect2.left ||
                rect1.left > rect2.right ||
                rect1.bottom < rect2.top ||
                rect1.top > rect2.bottom);
    }
    
    updateRoadLinesPosition() {
        // Скорость ленты строго пропорциональна текущей скорости игрока
        // 60px = один цикл паттерна, поэтому на максимальной скорости пусть это будет, например, 20px за кадр
        const maxLineSpeed = 20;
        const lineSpeed = (this.currentSpeed / this.maxSpeed) * maxLineSpeed;
        
        // Для дебага выводим в консоль скорость игрока и реальную скорость линии
        if (this.isPlaying && (this.currentSpeed > 0 || this.roadLinesOffset !== 0)) {
            console.log('[road] player speed:', this.currentSpeed, '| line offset:', this.roadLinesOffset, '| lineSpeed(px/frame):', lineSpeed);
        }

        this.roadLinesOffset += lineSpeed;

        // Ограничиваем смещение, чтобы линия циклически повторялась
        this.roadLinesOffset = this.roadLinesOffset % 60;

        // Применяем смещение к стилю background-position (только вниз — положительное значение Y)
        this.roadLines.style.backgroundPosition = `0 ${this.roadLinesOffset}px`;
    }

    updateScore() {
        this.score += 10;
        this.scoreElement.textContent = this.score;
    }

    clearObstacles() {
        // отменяем таймер спавна если есть
        if (this.spawnTimer) {
            clearTimeout(this.spawnTimer);
            this.spawnTimer = null;
        }
        this.obstacles.forEach(obstacle => obstacle.remove());
        this.obstacles = [];
    }

    updateRoadAnimationSpeed() {
        // Привязываем анимацию дороги напрямую к скорости игрока (this.currentSpeed)
        const minDuration = 0.2;
        const maxDuration = 2.0;

        // Нормализуем скорость игрока в [0,1]
        const speedFactor = this.maxSpeed > 0 ? Math.max(0, Math.min(1, this.currentSpeed / this.maxSpeed)) : 0;

        // Если машина стоит — приостанавливаем анимацию (чтобы не было "подергиваний" при нулевой скорости)
        if (speedFactor <= 0.001) {
            this.roadContainer.style.animationPlayState = 'paused';
            // Центральная линия теперь управляется отдельно через JavaScript
            // Также останавливаем анимацию текстуры дороги и боковых линий
            if (this.roadSides) {
                this.roadSides.style.animationPlayState = 'paused';
            }
            return;
        }

        // При большей скорости длительность анимации уменьшается (чем меньше duration — тем быстрее визуал)
        const targetDuration = maxDuration - (maxDuration - minDuration) * speedFactor;

        // Сглаживаем переход к целевой длительности с помощью this.animationInertia
        if (typeof this.animationSpeed !== 'number' || this.animationSpeed <= 0) {
            this.animationSpeed = targetDuration;
        } else {
            this.animationSpeed = this.animationSpeed * this.animationInertia + targetDuration * (1 - this.animationInertia);
        }

        // Применяем рассчитанную (и сглаженную) длительность анимации
        this.roadContainer.style.animationDuration = `${this.animationSpeed}s`;
        this.roadContainer.style.animationPlayState = 'running';
        // Центральная линия теперь управляется отдельно через JavaScript
        
        // Добавляем синхронизацию анимации боковых линий дороги
        if (this.roadSides) {
            this.roadSides.style.animationDuration = `${this.animationSpeed}s`;
            this.roadSides.style.animationPlayState = 'running';
        }
    }

    gameOver() {
        this.isPlaying = false;
        // Диагностика: остановка фоновой музыки и звука ускорения
        this.stopBgMusic();
        this.stopAccelSound();

        // отменяем таймер спавна на случай, если он запланирован
        if (this.spawnTimer) {
            clearTimeout(this.spawnTimer);
            this.spawnTimer = null;
        }
        alert(`Игра окончена! Ваш счёт: ${this.score}`);
        this.clearObstacles();
        this.playerPosition.x = 175;
        this.player.style.left = `${this.playerPosition.x}px`;
        
        // Останавливаем анимацию дороги при окончании игры
        this.currentSpeed = 0;
        this.animationSpeed = 0;
        this.roadLinesOffset = 0; // Сбрасываем смещение центральной линии
        this.updateRoadAnimationSpeed();
        
        // Дополнительно останавливаем анимацию боковых линий
        if (this.roadSides) {
            this.roadSides.style.animationPlayState = 'paused';
        }
        
        // Сбрасываем позицию центральной линии
        if (this.roadLines) {
            this.roadLines.style.backgroundPosition = '0 0';
        }
    }
    // --- Генерация фоновой музыки и звука ускорения через Web Audio API ---
    playBgMusic() {
        if (!this.bgMusicPlaying) {
            this.bgMusicPlaying = true;
            try {
                if (!this.audioCtx) {
                    this.audioCtx = new (window.AudioContext || window.webkitAudioContext)();
                }
                // Весёлая быстрая мелодия: последовательность коротких «major» аккордов, темп — выше
                if (this.bgMusicNotes) {
                    if (this.audioCtx.state === 'suspended') this.audioCtx.resume();
                    return;
                }
                this.bgGain = this.audioCtx.createGain();
                this.bgGain.gain.value = 0.045; // ещё тише (≈24% от начального значения)
                this.bgGain.connect(this.audioCtx.destination);
                this.bgMusicNotes = [
                    // ===== Вступление (бас и ритм, под марш) =====
                    { freq: [130.81, 261.63, 329.63], duration: 0.4 }, // C (бас + мажор)
                    { freq: [146.83, 293.66, 349.23], duration: 0.4 }, // Dm
                    { freq: [196.00, 392.00, 493.88], duration: 0.4 }, // G
                    { freq: [174.61, 349.23, 440.00], duration: 0.4 }, // F

                    // ===== Основная тема "Калинки" =====
                    // "Ка-лин-ка, ка-лин-ка, ка-лин-ка моя!"
                    { freq: [261.63, 392.00, 523.25], duration: 0.3 }, // C
                    { freq: [261.63, 392.00, 523.25], duration: 0.3 }, // C
                    { freq: [293.66, 440.00, 587.33], duration: 0.3 }, // D
                    { freq: [293.66, 440.00, 587.33], duration: 0.3 }, // D
                    { freq: [329.63, 493.88, 659.26], duration: 0.3 }, // E
                    { freq: [329.63, 493.88, 659.26], duration: 0.3 }, // E
                    { freq: [293.66, 440.00, 587.33], duration: 0.4 }, // D

                    // "В саду ягода малин-ка, малин-ка моя!"
                    { freq: [392.00, 587.33, 784.00], duration: 0.3 }, // G
                    { freq: [392.00, 587.33, 784.00], duration: 0.3 },
                    { freq: [440.00, 659.26, 880.00], duration: 0.3 }, // A
                    { freq: [440.00, 659.26, 880.00], duration: 0.3 },
                    { freq: [392.00, 587.33, 784.00], duration: 0.4 }, // G
                    { freq: [349.23, 523.25, 698.46], duration: 0.4 }, // F
                    { freq: [261.63, 392.00, 523.25], duration: 0.6 }, // C — завершение фразы

                    // ===== Басовая линия для глубины =====
                    { freq: [130.81], duration: 0.4 }, // C
                    { freq: [146.83], duration: 0.4 }, // D
                    { freq: [196.00], duration: 0.4 }, // G
                    { freq: [174.61], duration: 0.4 }, // F
                    { freq: [130.81], duration: 0.6 }  // C (завершение)
                ];
                this.bgMusicStep = 0;
                this._bgMusicPlaying = true;
                const playStep = () => {
                    if (!this._bgMusicPlaying) return;
                    const noteObj = this.bgMusicNotes[this.bgMusicStep % this.bgMusicNotes.length];
                    const now = this.audioCtx.currentTime;
                    // Мажорный аккорд — одновременно три осциллятора
                    let oscs = noteObj.freq.map(fq => {
                        const osc = this.audioCtx.createOscillator();
                        osc.type = "sawtooth";
                        osc.frequency.value = fq;
                        osc.connect(this.bgGain);
                        osc.start(now);
                        osc.stop(now + noteObj.duration);
                        return osc;
                    });
                    oscs.forEach(o => {
                        o.onended = () => o.disconnect();
                    });
                    if (!this._bgMusicPlaying) {
                        oscs.forEach(o => o.disconnect());
                        return;
                    }
                    this.bgMusicStep = (this.bgMusicStep + 1) % this.bgMusicNotes.length;
                    setTimeout(playStep, noteObj.duration * 900); // чуть быстрее break между аккордами
                    console.log('[AUDIO] Фоновая музыка: аккорд', noteObj.freq, 'продолжительность', noteObj.duration);
                };
                playStep();
                console.log('[AUDIO] Генерируемая быстрая фоновая музыка: старт');
            } catch (e) {
                console.error('[AUDIO ERROR] Не удалось сгенерировать фоновую музыку:', e);
            }
        }
    }
    stopBgMusic() {
        if (this.bgMusicPlaying) {
            this.bgMusicPlaying = false;
            this._bgMusicPlaying = false;
            try {
                if (this.audioCtx && this.audioCtx.state !== 'closed') {
                    if (this.bgGain) this.bgGain.gain.value = 0;
                }
                console.log('[AUDIO] Фоновая музыка: остановлена (генерация)');
            } catch (e) {
                console.error('[AUDIO ERROR] Не удалось остановить фоновую музыку:', e);
            }
        }
    }
    playAccelSound() {
        if (this._accelOsc) return; // Уже ревёт
        try {
            if (!this.audioCtx) {
                this.audioCtx = new (window.AudioContext || window.webkitAudioContext)();
            }
            // Создадим "рев спорткара" — sawtooth + чуть дрожащий pitch + фильтр + немного гармоник
            const osc = this.audioCtx.createOscillator();
            osc.type = "sawtooth";
            // Базовая частота — около 170-300Гц (низкий, басистый рев V8), при ускорении — чуть повышается
            osc.frequency.setValueAtTime(190, this.audioCtx.currentTime);

            // LFO (невысокий LFO-модулятор для эффекта "дрожания" двигателя)
            const lfo = this.audioCtx.createOscillator();
            lfo.type = "triangle";
            lfo.frequency.value = 17; // 17 Гц — не идеально, но для web OK
            const lfoGain = this.audioCtx.createGain();
            lfoGain.gain.value = 21; // глубина LFO колебания
            lfo.connect(lfoGain);
            lfoGain.connect(osc.frequency);

            // Фильтр для подчистки "ревущего" звука
            const filter = this.audioCtx.createBiquadFilter();
            filter.type = "lowpass";
            filter.frequency.value = 1200;

            // Основная огибающая громкости
            const gain = this.audioCtx.createGain();
            gain.gain.value = 0.22;

            osc.connect(filter).connect(gain).connect(this.audioCtx.destination);

            osc.start();
            lfo.start();

            this._accelOsc = osc;
            this._accelLFO = lfo;
            this._accelLFOGain = lfoGain;
            this._accelGain = gain;
            this._accelFilter = filter;

            console.log('[AUDIO] Звук ускорения: рев спорткара включён');
        } catch (e) {
            console.error('[AUDIO ERROR] Не удалось сгенерировать звук ускорения:', e);
        }
    }
    stopAccelSound() {
        // Отключаем "рев" плавно
        if (this._accelOsc) {
            const osc = this._accelOsc;
            const lfo = this._accelLFO;
            const lfoGain = this._accelLFOGain;
            const gain = this._accelGain;
            try {
                if (gain) {
                    gain.gain.linearRampToValueAtTime(0, this.audioCtx.currentTime + 0.08);
                }
                setTimeout(() => {
                    try {
                        osc.stop();
                        osc.disconnect();
                        if (lfo) lfo.stop();
                        if (lfo) lfo.disconnect();
                        if (lfoGain) lfoGain.disconnect();
                        if (gain) gain.disconnect();
                        if (this._accelFilter) this._accelFilter.disconnect();
                    } catch (e) {}
                    this._accelOsc = null;
                    this._accelLFO = null;
                    this._accelLFOGain = null;
                    this._accelGain = null;
                    this._accelFilter = null;
                    console.log('[AUDIO] Звук ускорения: рев спорткара выключен');
                }, 95);
            } catch (e) {
                this._accelOsc = null;
                this._accelLFO = null;
                this._accelLFOGain = null;
                this._accelGain = null;
                this._accelFilter = null;
            }
        }
    }
}

window.onload = () => {
    new Game();
};
