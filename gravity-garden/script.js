(() => {
  const canvas = document.getElementById('game');
  const ctx = canvas.getContext('2d');
  const modeSelect = document.getElementById('mode');
  const btnStart = document.getElementById('btn-start');
  const btnPause = document.getElementById('btn-pause');
  const btnReset = document.getElementById('btn-reset');
  const btnClear = document.getElementById('btn-clear');
  const btnExport = document.getElementById('btn-export');

  const W = canvas.width, H = canvas.height;

  // объекты: attractor/repellor
  const nodes = []; // {x,y,strength,type,active}

  // семя
  const seed = {x:100,y:100,vx:0,vy:0,r:6,alive:true};
  const goal = {x:700,y:450,r:28};

  let running = false;
  let lastTime = 0;

  // параметры физики
  const G = 6000; // базовый множитель силы
  const damping = 0.998; // трение воздуха
  const maxForce = 2000;
  const nodeRadius = 16;

  function addNode(x,y,type){
    nodes.push({x,y,type,strength:type==='attractor'?1: -1});
  }

  function removeNodeAt(x,y){
    for(let i=nodes.length-1;i>=0;i--){
      const n = nodes[i];
      const dx = n.x-x, dy = n.y-y;
      if(dx*dx+dy*dy <= nodeRadius*nodeRadius*4){ nodes.splice(i,1); return true; }
    }
    return false;
  }

  // оставить след
  const traces = [];

  canvas.addEventListener('pointerdown', e=>{
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX-rect.left, y = e.clientY-rect.top;
    if(e.shiftKey){ removeNodeAt(x,y); return; }
    addNode(x,y, modeSelect.value==='attractor' ? 'attractor' : 'repellor');
  });

  btnStart.addEventListener('click', ()=>{ running = true; lastTime = performance.now(); loop(lastTime); });
  btnPause.addEventListener('click', ()=> running = !running);
  btnReset.addEventListener('click', ()=>{ seed.x=100; seed.y=100; seed.vx=seed.vy=0; seed.alive=true; nodes.length=0; traces.length=0; draw(); });
  btnClear.addEventListener('click', ()=>{ traces.length=0; draw(); });
  btnExport.addEventListener('click', ()=>{ const data = canvas.toDataURL(); const a = document.createElement('a'); a.href=data; a.download='gravity-garden.png'; a.click(); });

  function step(dt){
    if(!seed.alive) return;
    // compute force
    let fx=0, fy=0;
    for(const n of nodes){
      const dx = n.x - seed.x; const dy = n.y - seed.y;
      const dist2 = dx*dx+dy*dy + 30; // small softening
      const inv = 1/Math.max(30,Math.sqrt(dist2));
      let force = G * n.strength / dist2; // inverse-square
      // soften and clamp
      force = Math.max(-maxForce, Math.min(maxForce, force));
      fx += force * dx * inv;
      fy += force * dy * inv;
    }
    // apply
    seed.vx += fx*dt/1000; seed.vy += fy*dt/1000;
    seed.vx *= damping; seed.vy *= damping;
    seed.x += seed.vx*dt/16; seed.y += seed.vy*dt/16;

    // leave trace
    traces.push({x:seed.x,y:seed.y,life:120});
    for(let i=traces.length-1;i>=0;i--){ traces[i].life--; if(traces[i].life<=0) traces.splice(i,1); }

    // check bounds
    if(seed.x<0||seed.x>W||seed.y<0||seed.y>H) seed.alive=false;

    // check goal
    const gx = seed.x-goal.x, gy = seed.y-goal.y; if(gx*gx+gy*gy <= goal.r*goal.r){ seed.alive=false; setTimeout(()=>{ alert('Уровень пройден!'); },50); }
  }

  function draw(){
    ctx.clearRect(0,0,W,H);
    // фон сетка
    ctx.fillStyle='#071322'; ctx.fillRect(0,0,W,H);
    ctx.strokeStyle='rgba(255,255,255,0.04)'; ctx.lineWidth=1; for(let i=0;i<W;i+=40){ ctx.beginPath(); ctx.moveTo(i,0); ctx.lineTo(i,H); ctx.stroke(); } for(let j=0;j<H;j+=40){ ctx.beginPath(); ctx.moveTo(0,j); ctx.lineTo(W,j); ctx.stroke(); }

    // traces
    for(const t of traces){ ctx.fillStyle = `rgba(255,215,120,${t.life/120*0.6})`; ctx.fillRect(t.x-2,t.y-2,4,4); }

    // nodes
    for(const n of nodes){ ctx.beginPath(); ctx.arc(n.x,n.y,nodeRadius,0,Math.PI*2); ctx.fillStyle = n.type==='attractor' ? 'rgba(59,130,246,0.9)' : 'rgba(239,68,68,0.9)'; ctx.fill(); ctx.strokeStyle='rgba(255,255,255,0.06)'; ctx.stroke(); }

    // goal
    ctx.beginPath(); ctx.arc(goal.x,goal.y,goal.r,0,Math.PI*2); ctx.fillStyle='rgba(34,197,94,0.12)'; ctx.fill(); ctx.lineWidth=2; ctx.strokeStyle='rgba(34,197,94,0.7)'; ctx.stroke();

    // seed
    ctx.beginPath(); ctx.arc(seed.x,seed.y,seed.r,0,Math.PI*2); ctx.fillStyle='rgba(250,204,21,0.95)'; ctx.fill(); ctx.strokeStyle='rgba(0,0,0,0.3)'; ctx.stroke();

    // hud
    ctx.fillStyle='rgba(255,255,255,0.06)'; ctx.fillRect(8,8,220,36); ctx.fillStyle='#dbeafe'; ctx.font='14px monospace'; ctx.fillText(`Nodes: ${nodes.length}  Traces: ${traces.length}`,16,32);
  }

  function loop(ts){
    if(!lastTime) lastTime = ts; const dt = Math.min(60, ts-lastTime); lastTime = ts; if(running) step(dt); draw(); requestAnimationFrame(loop);
  }

  draw();
})();
