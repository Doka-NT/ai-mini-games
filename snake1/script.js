(() => {
  const canvas = document.getElementById('game');
  const ctx = canvas.getContext('2d');
  const scoreEl = document.getElementById('score');
  const highEl = document.getElementById('highscore');
  const overlay = document.getElementById('overlay');
  const message = document.getElementById('message');
  const btnRestart = document.getElementById('btn-restart');
  const btnPause = document.getElementById('btn-pause');

  const gridSize = 20; // количество клеток по одной стороне
  const tileCount = canvas.width / gridSize; // предполагаем квадрат

  let snake = [{x:9,y:9}];
  let dir = {x:0,y:0};
  let nextDir = {x:0,y:0};
  let food = null;
  let score = 0;
  let speed = 8; // шагов в секунду
  let running = false;
  let paused = false;
  let lastFrame = 0;

  function randPos(){
    return {
      x: Math.floor(Math.random()*tileCount),
      y: Math.floor(Math.random()*tileCount)
    };
  }

  function placeFood(){
    let p;
    do{
      p = randPos();
    }while(snake.some(s => s.x===p.x && s.y===p.y));
    food = p;
  }

  function reset(){
    snake = [{x:Math.floor(tileCount/2), y:Math.floor(tileCount/2)}];
    dir = {x:0,y:0};
    nextDir = {x:0,y:0};
    score = 0;
    speed = 8;
    running = true;
    paused = false;
    placeFood();
    overlay.style.pointerEvents = 'none';
    overlay.style.display = 'none';
    message.textContent = '';
  }

  function endGame(text){
    running = false;
    overlay.style.pointerEvents = 'auto';
    message.innerHTML = text + '<br><small>Нажмите "Начать заново" или пробел</small>';
    overlay.style.display = 'flex';
    // рекорд
    const best = Number(localStorage.getItem('snake_high')||0);
    if(score>best){
      localStorage.setItem('snake_high', String(score));
    }
    updateHud();
  }

  function updateHud(){
    scoreEl.textContent = 'Счёт: ' + score;
    highEl.textContent = 'Рекорд: ' + (localStorage.getItem('snake_high')||0);
  }

  function step(){
    // движение
    if(!running || paused) return;
    if(nextDir.x!==0 || nextDir.y!==0){
      // запрет разворота
      if(snake.length>1){
        const back = snake[1];
        if(back.x === snake[0].x + nextDir.x && back.y === snake[0].y + nextDir.y){
          // запрещено — игнорируем
        } else dir = nextDir;
      } else dir = nextDir;
    }

    const head = {x: snake[0].x + dir.x, y: snake[0].y + dir.y};
    // переход через стену
    if(head.x < 0) head.x = tileCount-1;
    if(head.x >= tileCount) head.x = 0;
    if(head.y < 0) head.y = tileCount-1;
    if(head.y >= tileCount) head.y = 0;

    // столкновение с собой — проверяем только тело (индексы > 0)
    if(snake.some((s, idx) => idx > 0 && s.x===head.x && s.y===head.y)){
      endGame('Вы врезались!');
      return;
    }

    snake.unshift(head);
    // еда
    if(food && head.x===food.x && head.y===food.y){
      score++;
      // чуть увеличиваем скорость каждые 5 очков
      if(score % 5 === 0) speed = Math.min(20, speed + 1);
      placeFood();
    } else {
      snake.pop();
    }
    updateHud();
  }

  function draw(){
    // фон
    ctx.fillStyle = '#041024';
    ctx.fillRect(0,0,canvas.width,canvas.height);

    // сетка (тонко)
    ctx.strokeStyle = 'rgba(255,255,255,0.02)';
    ctx.lineWidth = 1;
    for(let i=0;i<tileCount;i++){
      ctx.beginPath();
      ctx.moveTo(i*gridSize,0);
      ctx.lineTo(i*gridSize,canvas.height);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(0,i*gridSize);
      ctx.lineTo(canvas.width,i*gridSize);
      ctx.stroke();
    }

    // еда
    if(food){
      ctx.fillStyle = '#ef4444';
      ctx.fillRect(food.x*gridSize+2, food.y*gridSize+2, gridSize-4, gridSize-4);
    }

    // змейка
    for(let i=snake.length-1;i>=0;i--){
      const s = snake[i];
      if(i===0){
        ctx.fillStyle = '#2dd4bf';
        ctx.fillRect(s.x*gridSize+1, s.y*gridSize+1, gridSize-2, gridSize-2);
      } else {
        const frac = i/snake.length;
        ctx.fillStyle = `rgba(45,212,191,${0.25 + 0.65*frac})`;
        ctx.fillRect(s.x*gridSize+1, s.y*gridSize+1, gridSize-2, gridSize-2);
      }
    }
  }

  function loop(ts){
    if(!lastFrame) lastFrame = ts;
    const elapsed = ts - lastFrame;
    const interval = 1000/speed;
    if(elapsed >= interval){
      lastFrame = ts - (elapsed % interval);
      step();
    }
    draw();
    requestAnimationFrame(loop);
  }

  // ввод
  window.addEventListener('keydown', e => {
    if(e.key === ' '){
      if(!running) reset();
      else { paused = !paused; btnPause.textContent = paused ? 'Возобновить' : 'Пауза'; }
      e.preventDefault();
      return;
    }
    const key = e.key.toLowerCase();
    const map = {
      arrowup:[0,-1], w:[0,-1], k:[0,-1],
      arrowdown:[0,1], s:[0,1], j:[0,1],
      arrowleft:[-1,0], a:[-1,0], h:[-1,0],
      arrowright:[1,0], d:[1,0], l:[1,0]
    };
    if(map[key]){
      const [x,y] = map[key];
      nextDir = {x,y};
      e.preventDefault();
    }
    if(e.key === 'r') reset();
  });

  // мобильные кнопки
  document.querySelectorAll('.mobile-controls button').forEach(b => {
    b.addEventListener('click', ()=>{
      const d = b.dataset.dir;
      const m = {up:[0,-1],down:[0,1],left:[-1,0],right:[1,0]};
      const [x,y] = m[d];
      nextDir = {x,y};
    });
  });

  btnRestart.addEventListener('click', ()=> reset());
  btnPause.addEventListener('click', ()=>{
    if(!running) return;
    paused = !paused;
    btnPause.textContent = paused ? 'Возобновить' : 'Пауза';
  });

  // отзывчивость — подгонка размера холста под devicePixelRatio
  function resizeCanvas(){
    const cssW = canvas.clientWidth;
    const cssH = canvas.clientHeight;
    const ratio = window.devicePixelRatio || 1;
    canvas.width = Math.floor(cssW * ratio);
    canvas.height = Math.floor(cssH * ratio);
    ctx.setTransform(ratio,0,0,ratio,0,0);
  }
  window.addEventListener('resize', resizeCanvas);
  resizeCanvas();

  updateHud();
  requestAnimationFrame(loop);

  // стартовое сообщение
  overlay.style.pointerEvents = 'auto';
  message.innerHTML = 'Нажмите пробел или "Начать заново" чтобы запустить';
  // разместим начальную еду
  placeFood();

})();
