import {Game,W,H,TRACK,CORE,TOWERS,WHEN,THEN,STAGES} from "./sim.js";
const $=id=>document.getElementById(id);
const KEY="signal-defense-profile-v1";
let saved={};try{saved=JSON.parse(localStorage.getItem(KEY)||"{}");}catch{}
const game=new Game(saved);
const canvas=$("battle"),ctx=canvas.getContext("2d");
let previous=performance.now(),uiElapsed=0,lastCastCount=0,noticeUntil=0,lastRenderedStage=0;
function persist(){try{localStorage.setItem(KEY,JSON.stringify(game.exportProfile()));}catch{}}
function option(id,label,current){const o=new Option(label,id);o.selected=id===current;return o;}
$("mobile-rule-link").addEventListener("click",()=>{
  const el=$("when-0");if(el)el.scrollIntoView({behavior:"smooth",block:"center"});
});
function drawRuleEditor(){
  const num=game.twoRules()?2:1;
  const stack=$("rule-stack");stack.replaceChildren();
  for(let i=0;i<num;i++){
    const rule=game.profile.rules[i];
    const article=document.createElement("article");
    article.className="rule";article.dataset.index=String(i);
    article.innerHTML='<div class="rule-top"><span class="rule-name">作戦 0'+(i+1)+'</span><span class="rule-state" id="rule-state-'+i+'">条件待ち</span></div>'+
      '<label for="when-'+i+'">いつ</label><select id="when-'+i+'" data-field="when" aria-label="作戦'+(i+1)+'の条件"></select>'+
      '<div class="connector"><span></span><b>なら</b></div>'+
      '<label for="then-'+i+'">何をする</label><select id="then-'+i+'" data-field="then" aria-label="作戦'+(i+1)+'の行動"></select>';
    stack.appendChild(article);
    const when=$("when-"+i),then=$("then-"+i);
    game.availableWhen().forEach(id=>when.add(option(id,WHEN[id].label,rule.when)));
    game.availableThen().forEach(id=>then.add(option(id,THEN[id].label,rule.then)));
    if(!game.availableWhen().includes(rule.when))when.value=game.availableWhen()[0];
    if(!game.availableThen().includes(rule.then))then.value=game.availableThen()[0];
    if(when.value!==rule.when||then.value!==rule.then){
      game.setRule(i,when.value,then.value);
    }
  }
  $("locked-rule").hidden=game.twoRules();
  $("swap-rules").hidden=!game.twoRules();
  $("extra-rule-hint").hidden=!game.twoRules();
}
$("swap-rules").addEventListener("click",()=>{
  if(game.swapRules()){
    drawRuleEditor();refresh();persist();
    $("last-event").textContent="作戦の優先順を入れ替えました。";
  }
});
$("rule-stack").addEventListener("change",e=>{
  const row=e.target.closest(".rule");if(!row)return;
  const i=Number(row.dataset.index);
  if(game.setRule(i,$("when-"+i).value,$("then-"+i).value)){
    $("last-event").textContent="作戦 0"+(i+1)+" を更新。次の条件成立から適用します。";
    persist();
  }
  refresh();
});
function renderStageHeader(){
  $("mission-number").textContent=String(game.stage).padStart(2,"0");
  $("stage-count").textContent=String(game.stage).padStart(2,"0")+" / 05";
  $("mission-title").textContent=STAGES[game.stage-1].name;
  $("mission-hint").textContent=STAGES[game.stage-1].hint;
  $("stage-nav").innerHTML=STAGES.map((stage,i)=>{
    const number=i+1;
    const done=!!game.profile.best[number];
    return '<button data-stage="'+number+'" class="'+(number===game.stage?"active":done?"beaten":"")+
      '" '+(number>game.profile.unlocked?"disabled":"")+' aria-label="第'+number+'波 '+stage.name+'">第'+number+'波</button>';
  }).join("");
  lastRenderedStage=game.stage;
}
$("stage-nav").addEventListener("click",e=>{
  const button=e.target.closest("[data-stage]");if(!button)return;
  if(game.selectStage(Number(button.dataset.stage))){renderStageHeader();drawRuleEditor();refresh();persist();}
});
function start(){
  if(game.start()){$("result-panel").hidden=true;refresh();}
}
$("start").addEventListener("click",start);
function retry(){
  game.retry();lastCastCount=0;noticeUntil=0;$("signal-effect").hidden=true;
  $("result-panel").hidden=true;
  refresh();persist();
}
$("restart").addEventListener("click",retry);
$("try-again").addEventListener("click",retry);
$("go-next").addEventListener("click",()=>{
  if(game.nextStage()){
    lastCastCount=0;noticeUntil=0;$("signal-effect").hidden=true;
    $("result-panel").hidden=true;
    renderStageHeader();drawRuleEditor();refresh();persist();
  }
});
document.querySelectorAll("[data-speed]").forEach(btn=>btn.addEventListener("click",()=>{
  game.setSpeed(Number(btn.dataset.speed));
  document.querySelectorAll("[data-speed]").forEach(b=>b.classList.toggle("on",Number(b.dataset.speed)===game.speed));
}));
function showResult(){
  if(game.phase!=="result")return;
  const result=game.result;
  $("result-panel").hidden=false;
  $("result-eyebrow").textContent=result.won?"DEFENSE COMPLETE":"CORE BREACHED";
  $("result-eyebrow").style.color=result.won?"#b7ddb4":"#efaba2";
  $("result-heading").textContent=result.won?"第"+game.stage+"波を防衛":"コアが突破されました";
  $("result-hp").textContent=result.hp+" / 100";
  $("result-casts").textContent=result.casts+"回";
  const delta=result.previousHp==null?null:result.hp-result.previousHp;
  $("result-delta").textContent=delta==null?"初回":(delta>0?"+":"")+delta;
  $("result-delta").style.color=delta>0?"#bce5b7":delta<0?"#f2a9a0":"";
  $("result-summary").textContent=result.casts===0?"今回の作戦は一度も発動しませんでした。条件を変えて再挑戦してみよう。":
    "敵を"+result.kills+"体撃破、"+result.leaks+"体が突破。"+(result.won?"次の侵攻へ進むか、同じ敵で結果を改善できます。":"条件・行動を変え、同じ侵攻を試してみよう。");
  $("go-next").disabled=!result.won||game.stage>=5;
  $("go-next").textContent=game.stage===5?"全5波クリア":"次の侵攻へ ▶";
  renderStageHeader();
  persist();
}
function refresh(){
  if(lastRenderedStage!==game.stage)renderStageHeader();
  const current=game.profile.rules[0];
  $("mobile-rule-summary").textContent=WHEN[current.when].label+" → "+THEN[current.then].label;
  $("hp").textContent=Math.ceil(game.hp)+" / 100";
  $("hp").style.color=game.hp<40?"#eaa39b":"";
  $("charge").textContent=Math.floor(game.charge)+" / 80";
  $("charge-meter-label").textContent=Math.floor(game.charge)+" / 80";
  $("charge-fill").style.width=(game.charge/80*100)+"%";
  $("battle-state").textContent=game.phase==="ready"?"準備中":game.phase==="run"?"自動防衛中":"戦闘終了";
  $("live-dot").classList.toggle("playing",game.phase==="run");
  const remaining=STAGES[game.stage-1].enemies.length-game.spawnIndex+game.enemies.length;
  $("enemies-left").textContent=game.phase==="ready"?"敵の到来を待っています":remaining+"体 / 特殊技 "+game.casts+"回";
  $("start").disabled=game.phase!=="ready";
  $("restart").disabled=game.phase==="ready";
  $("start").innerHTML=game.phase==="ready"?"侵攻を開始 <span>▶</span>":game.phase==="run"?"防衛中":"終了";
  $("field-hint").textContent=game.phase==="ready"?"作戦を選んで「侵攻を開始」。同じ敵で何度でも試せます":
    game.phase==="run"?"作戦の発動は色で表示。違う作戦で同じ敵に再挑戦できます":"右の作戦を変えて再挑戦できます";
  for(let i=0;i<(game.twoRules()?2:1);i++){
    const row=$("rule-stack").querySelector('[data-index="'+i+'"]');
    const fired=game.lastCast?.rule===i+1&&performance.now()<noticeUntil;
    if(row)row.classList.toggle("fired",fired);
    const status=$("rule-state-"+i);
    if(status)status.textContent=fired?"実行！ "+THEN[game.lastCast.skill].short+" ×"+game.lastCast.affected:game.phase==="run"?game.ruleState[i]:"待機中";
  }
  if(game.lastCast){
    $("last-event").textContent="作戦 0"+game.lastCast.rule+"："+
      THEN[game.lastCast.skill].short+" → "+game.lastCast.affected+"体に作用";
  }
  if(game.phase==="result"&&$("result-panel").hidden)showResult();
}
const surface=document.createElement("canvas");
surface.width=W;surface.height=H;
const bg=surface.getContext("2d");
bg.fillStyle="#2c3a3c";bg.fillRect(0,0,W,H);
let seed=9499;function rand(){seed=(seed*1664525+1013904223)>>>0;return seed/4294967296;}
for(let i=0;i<2000;i++){
  bg.fillStyle=rand()>.5?"#71817420":"#122c2e2b";
  bg.fillRect(rand()*W,rand()*H,rand()*9+2,rand()*3+1);
}
bg.strokeStyle="#b9cfcf14";
for(let x=0;x<W;x+=48){bg.beginPath();bg.moveTo(x,0);bg.lineTo(x,H);bg.stroke();}
for(let y=0;y<H;y+=48){bg.beginPath();bg.moveTo(0,y);bg.lineTo(W,y);bg.stroke();}
function disc(x,y,r,fill,stroke=null,sw=1){
  ctx.beginPath();ctx.arc(x,y,r,0,Math.PI*2);
  if(fill){ctx.fillStyle=fill;ctx.fill();}
  if(stroke){ctx.lineWidth=sw;ctx.strokeStyle=stroke;ctx.stroke();}
}
function line(points,width,color){
  ctx.lineWidth=width;ctx.strokeStyle=color;ctx.lineCap="round";ctx.lineJoin="round";
  ctx.beginPath();points.forEach((p,i)=>i?ctx.lineTo(p.x,p.y):ctx.moveTo(p.x,p.y));ctx.stroke();
}
function text(x,y,value,size=12,color="#dbeadd"){
  ctx.font="bold "+size+"px ui-monospace,monospace";ctx.fillStyle=color;
  ctx.textAlign="center";ctx.fillText(value,x,y);
}
function draw(){
  ctx.clearRect(0,0,W,H);ctx.drawImage(surface,0,0);
  line(TRACK,63,"#172b33");
  line(TRACK,50,"#515f59");
  line(TRACK,38,"#65736a");
  ctx.setLineDash([7,14]);line(TRACK,1.5,"#dfddbd77");ctx.setLineDash([]);
  // Gate is visually distinct and continuously shows live HP.
  disc(CORE.x,CORE.y,47,"#142c36","#b2d1bb",4);
  ctx.fillStyle="#4b8072";ctx.fillRect(CORE.x-24,CORE.y-25,48,50);
  ctx.fillStyle="#a8dac0";ctx.fillRect(CORE.x-13,CORE.y-15,26,30);
  ctx.fillStyle="#1a3035";ctx.fillRect(CORE.x-32,CORE.y+58,64,7);
  ctx.fillStyle=game.hp<40?"#ed9c90":"#bfe0af";ctx.fillRect(CORE.x-32,CORE.y+58,64*game.hp/100,7);
  text(CORE.x,CORE.y-60,"CORE",12);
  for(const [i,t] of game.turrets.entries()){
    disc(t.x,t.y,28,"#1a333b","#92b6a9",3);
    ctx.save();ctx.translate(t.x,t.y);ctx.rotate(Math.PI/4);
    ctx.fillStyle=i===0?"#94c9a5":i===1?"#99bcd0":"#e5c69d";
    ctx.fillRect(-13,-13,26,26);ctx.fillStyle="#173037";ctx.fillRect(-5,-5,10,10);
    ctx.restore();
    ctx.strokeStyle="#cce2cd";ctx.lineWidth=4;
    ctx.beginPath();ctx.moveTo(t.x,t.y-16);ctx.lineTo(t.x,t.y-34);ctx.stroke();
    text(t.x,t.y+45,"0"+(i+1),11,"#d0e4da");
  }
  // Enemies: silhouette, color, and HP communicate type and damage at small size.
  for(const e of game.enemies){
    if(e.dead)continue;
    const n=e.r;
    disc(e.x,e.y,n+2,"#122427aa","#354545",2);
    ctx.fillStyle=e.color;ctx.strokeStyle="#3c3b38";ctx.lineWidth=1.5;
    ctx.beginPath();
    if(e.type==="swift"){
      ctx.moveTo(e.x+n,e.y);ctx.lineTo(e.x-n,e.y-n*.7);ctx.lineTo(e.x-n,e.y+n*.7);
    }else if(e.type==="shell"||e.type==="boss"){
      for(let a=0;a<6;a++){const angle=Math.PI/3*a;const px=e.x+n*Math.cos(angle),py=e.y+n*Math.sin(angle);a?ctx.lineTo(px,py):ctx.moveTo(px,py);}
    }else{
      ctx.moveTo(e.x+n,e.y);ctx.lineTo(e.x,e.y-n);ctx.lineTo(e.x-n,e.y);ctx.lineTo(e.x,e.y+n);
    }
    ctx.closePath();ctx.fill();ctx.stroke();
    if(e.chill>0)disc(e.x,e.y,n+5,null,"#b0eff8",2);
    if(e.hp<e.maxHp){
      const width=Math.max(22,n*2.6);ctx.fillStyle="#13272b";ctx.fillRect(e.x-width/2,e.y-n-12,width,4);
      ctx.fillStyle="#e6c49b";ctx.fillRect(e.x-width/2,e.y-n-12,width*Math.max(0,e.hp/e.maxHp),4);
    }
  }
  for(const fx of game.effects){
    const r=fx.time/fx.max;ctx.globalAlpha=Math.min(1,Math.max(0,r));
    if(fx.type==="shot"||fx.type==="lightning"){
      ctx.strokeStyle=fx.type==="shot"?"#ead9a8":"#a5e4fc";
      ctx.lineWidth=fx.type==="shot"?3:5;
      ctx.beginPath();ctx.moveTo(fx.x,fx.y);ctx.lineTo(fx.x2,fx.y2);ctx.stroke();
    }else if(fx.type==="freeze"){
      disc(fx.x,fx.y,fx.r*(1-r*.18),"#a4d9e635","#b9e9f4",5);
    }else if(fx.type==="beam"){
      ctx.lineWidth=12;ctx.strokeStyle="#f7dfa5";
      ctx.beginPath();ctx.moveTo(fx.x-102,fx.y-25);ctx.lineTo(fx.x+102,fx.y+25);ctx.stroke();
      disc(fx.x,fx.y,fx.r*.45,"#fce9a72b","#ffe6b3",2);
    }else if(fx.type==="push"){
      disc(fx.x,fx.y,fx.r*(1-r*.45),"#b6f0ba20","#adf0c3",4);
    }else if(fx.type==="breach")disc(fx.x,fx.y,35+(1-r)*22,"#e89a7e44","#f3b7a0",3);
    else if(fx.type==="kill")disc(fx.x,fx.y,12+(1-r)*24,null,"#fae0af",2);
    else if(fx.type==="impact")disc(fx.x,fx.y,9+(1-r)*8,null,"#f4e8cc",2);
    ctx.globalAlpha=1;
  }
  if(game.phase==="ready"){
    ctx.fillStyle="#112b2ab8";ctx.fillRect(20,H-62,245,34);
    text(142,H-40,"PROGRAM → RUN → COMPARE",12,"#c4e6cb");
  }
}
function frame(now){
  const dt=Math.max(0,Math.min(.05,(now-previous)/1000));previous=now;
  for(let i=0;i<game.speed;i++)game.step(dt);
  if(game.casts!==lastCastCount){
    lastCastCount=game.casts;noticeUntil=now+1600;
    if(game.lastCast){
      $("effect-title").textContent="作戦 0"+game.lastCast.rule+"："+
        THEN[game.lastCast.skill].short+" が発動";
      $("effect-detail").textContent=game.lastCast.affected+"体に作用";
    }
  }
  $("signal-effect").hidden=now>=noticeUntil||!game.lastCast;
  draw();uiElapsed+=dt;
  if(uiElapsed>.1){refresh();uiElapsed=0;}
  requestAnimationFrame(frame);
}
renderStageHeader();drawRuleEditor();refresh();requestAnimationFrame(frame);
