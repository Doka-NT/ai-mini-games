(() => {
  const canvas = document.getElementById('game');
  const ctx = canvas.getContext('2d');
  const scoreEl = document.getElementById('score');
  const btnStart = document.getElementById('btn-start');
  const btnReset = document.getElementById('btn-reset');

  const W = canvas.width, H = canvas.height;

  const paddleH = 100, paddleW = 12;
  const ballSize = 12;

  let left = {x:20, y: (H - paddleH)/2, vy:0, score:0};
  let right = {x: W - 20 - paddleW, y: (H - paddleH)/2, vy:0, score:0};
  let ball = {x: W/2, y: H/2, vx:0, vy:0};
  let running = false;
  let aiDifficulty = 0.12; // скорость реакции ИИ
  let lastTime = 0;

  function reset(){
    left.y = right.y = (H - paddleH)/2;
    left.score = right.score = 0;
    serve();
    updateHud();
  }

  function serve(dir = (Math.random()<0.5?1:-1)){
    ball.x = W/2; ball.y = H/2;
    const angle = (Math.random()*0.6 - 0.3);
    ball.vx = 6 * dir; ball.vy = 6 * angle;
  }

  function start(){ if(running) return; running = true; lastTime = performance.now(); loop(lastTime); }
  function stop(){ running = false; }

  function updateHud(){ scoreEl.textContent = `Игрок: ${left.score} — ${right.score} : Компьютер`; }

  function draw(){
    ctx.clearRect(0,0,W,H);
    // середина
    ctx.strokeStyle = 'rgba(255,255,255,0.06)';
    ctx.setLineDash([10,10]);
    ctx.beginPath(); ctx.moveTo(W/2,0); ctx.lineTo(W/2,H); ctx.stroke();
    ctx.setLineDash([]);

    // ракетки
    ctx.fillStyle = '#0ea5a4'; ctx.fillRect(left.x, left.y, paddleW, paddleH);
    ctx.fillStyle = '#60a5fa'; ctx.fillRect(right.x, right.y, paddleW, paddleH);

    // мяч
    ctx.fillStyle = '#fef08a'; ctx.fillRect(ball.x - ballSize/2, ball.y - ballSize/2, ballSize, ballSize);
  }

  function clamp(v,a,b){ return Math.max(a, Math.min(b, v)); }

  function step(dt){
    // движение мяча
    ball.x += ball.vx * dt/16;
    ball.y += ball.vy * dt/16;

    // отскок от верх/низ
    if(ball.y - ballSize/2 < 0){ ball.y = ballSize/2; ball.vy *= -1; }
    if(ball.y + ballSize/2 > H){ ball.y = H - ballSize/2; ball.vy *= -1; }

    // проверка столкновения с ракетками
    if(ball.x - ballSize/2 < left.x + paddleW){
      if(ball.y > left.y && ball.y < left.y + paddleH){
        ball.x = left.x + paddleW + ballSize/2; ball.vx *= -1.05; // ускорение
        // добавим влияние ракетки
        const rel = (ball.y - (left.y + paddleH/2)) / (paddleH/2);
        ball.vy += rel * 4;
      } else {
        right.score++; updateHud(); serve(1); running = false; // пауза после очка
      }
    }
    if(ball.x + ballSize/2 > right.x){
      if(ball.y > right.y && ball.y < right.y + paddleH){
        ball.x = right.x - ballSize/2; ball.vx *= -1.05;
        const rel = (ball.y - (right.y + paddleH/2)) / (paddleH/2);
        ball.vy += rel * 4;
      } else {
        left.score++; updateHud(); serve(-1); running = false;
      }
    }

    // управление игроками: W/S и стрелки
    if(keys.w) left.y -= 8 * dt/16;
    if(keys.s) left.y += 8 * dt/16;
    if(keys.ArrowUp) right.y -= 8 * dt/16;
    if(keys.ArrowDown) right.y += 8 * dt/16;

    // ИИ bewegt правую ракетку при автопиле (можно убрать для двух игроков)
    if(!keys.ArrowUp && !keys.ArrowDown){
      // простой ИИ: двигаться к мячу с ограниченной скоростью
      const target = clamp(ball.y - paddleH/2, 0, H - paddleH);
      right.y += (target - right.y) * aiDifficulty * dt/16;
    }

    left.y = clamp(left.y, 0, H - paddleH);
    right.y = clamp(right.y, 0, H - paddleH);
  }

  let keys = {};
  document.addEventListener('keydown', e => { keys[e.key] = true; if(e.key === ' '){ start(); } });
  document.addEventListener('keyup', e => { keys[e.key] = false; });

  btnStart.addEventListener('click', ()=> start());
  btnReset.addEventListener('click', ()=> { reset(); draw(); });

  function loop(t){
    if(!running) { draw(); return; }
    const dt = t - lastTime; lastTime = t;
    step(dt);
    draw();
    requestAnimationFrame(loop);
  }

  // мобильное касание: верх/низ
  canvas.addEventListener('touchstart', e => {
    const y = e.touches[0].clientY - canvas.getBoundingClientRect().top;
    if(y < H/2) keys.w = true; else keys.s = true;
  });
  canvas.addEventListener('touchend', e => { keys.w = keys.s = false; });

  // старт
  reset(); draw();
})();
