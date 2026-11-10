import {Game,WIDTH,HEIGHT,PATHS,PADS,CORE,CHASSIS,CHIPS,CONDITIONS,TARGETS,SKILLS,UNLOCKS} from "./sim.js?v=chips-1";
const $=id=>document.getElementById(id);
const KEY="clockwork-circuit-siege-profile-v1";
let stored={};try{stored=JSON.parse(localStorage.getItem(KEY)||"{}");}catch{}
const game=new Game(stored);
let building="sentry",frameTime=performance.now(),uiClock=0,saveClock=0,lastUnlock=-1,buildState="",restartArmed=false;
const canvas=$("board"),ctx=canvas.getContext("2d");
const PRESETS={
  sweep:{name:"群れ掃討",require:"bolt",rules:[{condition:"crowd",skill:"blast",target:"cluster"},{condition:"any",skill:"bolt",target:"front"}]},
  focus:{name:"弱点狙い",require:"mark",rules:[{condition:"marked",skill:"bolt",target:"marked"},{condition:"any",skill:"mark",target:"front"}]},
  chill:{name:"冷却制圧",require:"chill",rules:[{condition:"wounded",skill:"bolt",target:"weak"},{condition:"any",skill:"chill",target:"front"}]},
  chain:{name:"冷却→連鎖",require:"chain",rules:[{condition:"chilled",skill:"chain",target:"cluster"},{condition:"any",skill:"chill",target:"front"}]},
  push:{name:"冷却→押戻",require:"shove",rules:[{condition:"chilled",skill:"shove",target:"front"},{condition:"any",skill:"chill",target:"front"}]},
  pierce:{name:"装甲貫通",require:"lance",rules:[{condition:"armored",skill:"lance",target:"armored"},{condition:"any",skill:"bolt",target:"front"}]},
  mend:{name:"自動補修",require:"mend",rules:[{condition:"coreHurt",skill:"mend",target:"front"},{condition:"any",skill:"bolt",target:"front"}]},
  nova:{name:"広域過負荷",require:"nova",rules:[{condition:"crowd",skill:"nova",target:"cluster"},{condition:"any",skill:"chill",target:"front"}]}
};
function save(){try{localStorage.setItem(KEY,JSON.stringify(game.exportProfile()));}catch{}}
function skillText(id){const s=SKILLS[id];return s.desc+" · EN "+s.energy+" / CT "+s.cd.toFixed(1)+"秒";}
const option=(id,obj,value)=>'<option value="'+id+'" '+(id===value?"selected":"")+'>'+obj.name+'</option>';
function renderInspector(){
  const t=game.selectedTower();
  $("inspector-title").textContent=t?CHASSIS[t.chassis].name+" #"+String(t.id).padStart(2,"0"):"砲台を選択";
  $("inspector-level").textContent=t?"Lv."+t.level:"—";
  $("inspector-desc").textContent=t?"この砲台だけの判断を編集。条件・技・狙う相手を組み合わせます。":"建設点を選ぶと、砲台ごとの動作を自由に組み立てられます。";
  $("no-selection").hidden=!!t;$("selected-panel").hidden=!t;
  if(!t)return;
  const ch=CHASSIS[t.chassis],range=Math.round(ch.range*(1+(t.level-1)*.065));
  $("tower-overview").innerHTML='<div><span>有効射程</span><b>'+range+'m</b></div>'+
    '<div><span>射撃間隔</span><b>'+ch.rate.toFixed(2)+'倍</b></div>'+
    '<div><span>発動回数</span><b id="tower-shots">'+t.shots+'</b></div>';
  $("chip-select").innerHTML=Object.entries(CHIPS).map(([id,chip])=>option(id,chip,t.chip)).join("");
  $("chip-hint").textContent=CHIPS[t.chip]?.desc||"基本性能";
  $("rules").innerHTML=t.rules.map((r,i)=>
    '<article class="rule" data-rule="'+i+'"><div class="rule-top"><b>回路 '+String(i+1).padStart(2,"0")+
    (i===0?' · 優先':'')+'</b><span class="rule-state" id="rule-state-'+i+'">判定待ち</span></div>'+
    '<label>いつ<select data-field="condition" aria-label="回路'+(i+1)+'の条件">'+
      Object.entries(CONDITIONS).map(([id,obj])=>option(id,obj,r.condition)).join("")+'</select></label>'+
    '<label>何を<select data-field="skill" aria-label="回路'+(i+1)+'の技">'+
      game.unlockedSkills().map(id=>option(id,SKILLS[id],r.skill)).join("")+'</select></label>'+
    '<label>誰に<select data-field="target" aria-label="回路'+(i+1)+'の対象優先">'+
      Object.entries(TARGETS).map(([id,obj])=>option(id,obj,r.target)).join("")+'</select></label>'+
    '<div class="skill-hint">'+skillText(r.skill)+'</div></article>').join("");
  $("presets").innerHTML=Object.entries(PRESETS).filter(([,p])=>game.skillUnlocked(p.require))
    .map(([id,p])=>'<button data-preset="'+id+'">'+p.name+'</button>').join("");
  const cost=45+t.level*35;
  $("upgrade").textContent=t.level>=3?"最大強化済":"強化 Lv."+(t.level+1)+" · "+cost+" CR";
  $("upgrade").disabled=t.level>=3||game.credits<cost||game.phase==="lost";
  $("sell").textContent="回収 +"+Math.round(t.spent*.65);
  $("sell").disabled=game.phase==="lost";
  updateRuleStates();
}
$("chip-select").addEventListener("change",e=>{
  const t=game.selectedTower();
  if(t&&game.setChip(t.id,e.target.value)){save();renderInspector();updateLive();}
});
$("presets").addEventListener("click",e=>{
  const button=e.target.closest("button[data-preset]");if(!button)return;
  const t=game.selectedTower(),preset=PRESETS[button.dataset.preset];
  if(!t||!preset||!game.skillUnlocked(preset.require))return;
  const valid=preset.rules.every((r,i)=>game.setRule(t.id,i,r.condition,r.skill,r.target));
  if(valid){game.log(preset.name+" 回路を適用");save();renderInspector();updateLive();}
});
$("rules").addEventListener("change",e=>{
  const select=e.target.closest("select");if(!select)return;
  const row=select.closest(".rule"),i=Number(row?.dataset.rule),t=game.selectedTower();if(!t)return;
  let c=row.querySelector('[data-field="condition"]').value;
  let skill=row.querySelector('[data-field="skill"]').value;
  const target=row.querySelector('[data-field="target"]').value;
  if(e.target.dataset.field==="skill"&&skill==="mend")c="coreHurt";
  if(e.target.dataset.field==="condition"&&c==="coreHurt")skill=game.skillUnlocked("mend")?"mend":"bolt";
  if(c!=="coreHurt"&&skill==="mend")skill="bolt";
  if(c==="coreHurt"&&skill!=="mend")c="any";
  if(game.setRule(t.id,i,c,skill,target))save();
  renderInspector();updateLive();
});
$("upgrade").addEventListener("click",()=>{const t=game.selectedTower();if(t&&game.upgrade(t.id)){renderInspector();updateLive();}});
$("sell").addEventListener("click",()=>{const t=game.selectedTower();if(t&&game.sell(t.id)){renderInspector();updateLive();}});
function renderBuildChoices(){
  const sig=building+"|"+game.credits+"|"+game.profile.totalKills+"|"+game.phase;
  if(sig===buildState)return;buildState=sig;
  $("build-choices").innerHTML=Object.entries(CHASSIS).map(([id,ch])=>{
    const locked=!game.chassisUnlocked(id);
    const disabled=locked||game.credits<ch.price||game.phase==="lost";
    return '<button class="build-option '+(building===id?"on":"")+(locked?" locked":"")+
      '" data-chassis="'+id+'" '+(disabled?"disabled":"")+' aria-pressed="'+(building===id)+'">'+
      '<span><strong>'+ch.name+'</strong><small>'+(locked?"70体で解放":ch.hint)+
      '</small></span><span class="cost">'+ch.price+' CR</span></button>';
  }).join("");
}
$("build-choices").addEventListener("click",e=>{
  const b=e.target.closest("[data-chassis]");if(!b)return;
  building=b.dataset.chassis;buildState="";renderBuildChoices();
  $("board-hint").textContent=CHASSIS[building].name+"を選択。◎の空き建設点をタップ";
});
function renderTech(){
  const k=game.profile.totalKills;if(k===lastUnlock)return;lastUnlock=k;
  const next=game.nextUnlock(),prev=next?(UNLOCKS[UNLOCKS.indexOf(next)-1]?.kills||0):UNLOCKS.at(-1).kills;
  $("unlock-progress").textContent=next?k+" / "+next.kills+"体":"すべて解放";
  $("tech-fill").style.width=next?Math.max(0,Math.min(100,(k-prev)/(next.kills-prev)*100))+"%":"100%";
  $("technology").innerHTML=UNLOCKS.map(u=>{
    const on=k>=u.kills;
    return '<div class="tech-row '+(on?"unlocked":"")+'"><span>'+(on?"✓ ":"")+u.name+
      '</span><b>'+(on?"使用可能":u.kills+"体")+'</b></div>';
  }).join("");
}
$("notice-dismiss").addEventListener("click",()=>{game.notice=null;$("notice").hidden=true;});
function updateRuleStates(){
  const t=game.selectedTower();if(!t)return;
  if($("tower-shots"))$("tower-shots").textContent=t.shots;
  for(let i=0;i<2;i++){
    const row=$("rules").querySelector('[data-rule="'+i+'"]');if(!row)continue;
    row.classList.toggle("active",t.activeRule===i&&t.activeTimer>0&&game.phase==="combat");
    $("rule-state-"+i).textContent=t.activeRule===i&&t.activeTimer>0?"技を実行":i===0?t.last:"優先待ち";
  }
  $("upgrade").disabled=t.level>=3||game.credits<45+t.level*35||game.phase==="lost";
}
function updateLive(){
  const s=game.snapshot(),phase=s.phase;
  $("hp").textContent=Math.ceil(s.hp)+" / "+s.maxHp;
  $("hp").style.color=s.hp/s.maxHp<.4?"#f1a09a":"";
  $("credits").innerHTML=s.credits+' <em>CR</em>';
  $("energy").innerHTML=Math.floor(s.energy)+' <em>/ '+game.maxEnergy+'</em>';
  $("wave").textContent=String(s.wave).padStart(2,"0");
  $("kills").textContent=s.totalKills;$("remaining").textContent=s.remaining;
  $("best-wave").textContent=s.bestWave;
  $("phase-title").textContent=phase==="prepare"?"準備フェーズ":phase==="combat"?game.paused?"一時停止中":"侵攻中":"コア陥落";
  $("wave-copy").textContent=phase==="prepare"?"第"+s.wave+"波の侵攻に備える":phase==="combat"?"第"+s.wave+"波　防衛中":"防衛失敗";
  $("wave-info").textContent=phase==="prepare"?"砲台の配置・編集後、侵攻を開始":"残敵 "+s.remaining+" / コアを防衛";
  $("start").disabled=phase!=="prepare"||game.towers.length===0;
  $("start").innerHTML="第"+s.wave+"波を開始 <span>▶</span>";
  $("pause").disabled=phase!=="combat";$("pause").textContent=game.paused?"再開":"停止";
  $("speed").textContent="×"+game.speed;
  $("event").textContent=game.logs[0]||"";
  if(game.notice){
    $("notice").hidden=false;
    $("notice-title").textContent="新回路解放："+game.notice.name;
    $("notice-detail").textContent=game.notice.description;
  }else $("notice").hidden=true;
  renderBuildChoices();const previousUnlock=lastUnlock;renderTech();
  if(lastUnlock!==previousUnlock&&game.selectedTower())renderInspector();
  updateRuleStates();
  if(phase==="lost"&&$("defeat").hidden){
    $("result-kills").textContent=game.runKills;$("result-wave").textContent=game.wave;
    $("result-total").textContent=game.profile.totalKills;$("defeat").hidden=false;save();
  }
}
$("start").addEventListener("click",()=>{if(game.startWave()){$("board-hint").textContent="砲台をタップすると戦闘中も回路を編集できます";updateLive();}});
$("pause").addEventListener("click",()=>{game.togglePause();updateLive();});
$("speed").addEventListener("click",()=>{game.setSpeed(game.speed===1?2:1);updateLive();});
$("retry").addEventListener("click",()=>{game.resetRun();building="sentry";buildState="";lastUnlock=-1;$("defeat").hidden=true;renderInspector();updateLive();save();});
$("restart-run").addEventListener("click",()=>{
  if(!restartArmed){restartArmed=true;$("restart-run").textContent="もう一度押して防衛をやり直す";return;}
  restartArmed=false;game.resetRun();building="sentry";buildState="";lastUnlock=-1;
  $("defeat").hidden=true;$("restart-run").textContent="防衛を最初からやり直す";
  renderInspector();updateLive();save();
});
canvas.addEventListener("pointerdown",e=>{
  if(game.phase==="lost")return;e.preventDefault();
  const rect=canvas.getBoundingClientRect();
  const x=(e.clientX-rect.left)/rect.width*WIDTH,y=(e.clientY-rect.top)/rect.height*HEIGHT;
  let selected=-1,near=Infinity;
  PADS.forEach((p,i)=>{const d=Math.hypot(p.x-x,p.y-y);if(d<near){near=d;selected=i;}});
  const hit=Math.max(33,27*WIDTH/rect.width);
  if(near>Math.min(83,hit)){
    game.selectedTowerId=null;game.selectedPad=-1;renderInspector();updateLive();return;
  }
  const tower=game.towerAt(selected);
  if(tower)game.selectedTowerId=tower.id;
  else if(!game.build(selected,building))game.log("建設できません。資金または解放状況を確認。");
  game.selectedPad=selected;renderInspector();updateLive();
});
canvas.addEventListener("contextmenu",e=>e.preventDefault());
document.addEventListener("keydown",e=>{
  if(e.target.closest("select,textarea,input"))return;
  if(e.key===" "){e.preventDefault();game.togglePause();updateLive();}
  if(e.key==="Escape"){game.selectedTowerId=null;renderInspector();updateLive();}
});
function pathStroke(points,width,color){
  ctx.strokeStyle=color;ctx.lineCap="round";ctx.lineJoin="round";ctx.lineWidth=width;
  ctx.beginPath();points.forEach((p,i)=>i?ctx.lineTo(p.x,p.y):ctx.moveTo(p.x,p.y));ctx.stroke();
}
const ground=document.createElement("canvas");ground.width=WIDTH;ground.height=HEIGHT;
const g=ground.getContext("2d");
let seed=17721;const random=()=>{seed=(seed*1664525+1013904223)>>>0;return seed/4294967296;};
g.fillStyle="#2a3839";g.fillRect(0,0,WIDTH,HEIGHT);
for(let i=0;i<2900;i++){
  const x=random()*WIDTH,y=random()*HEIGHT,brightness=random();
  g.fillStyle=brightness>.5?"#60716c24":"#0c222523";
  g.fillRect(x,y,random()*7+2,random()*3+1);
}
for(let x=0;x<WIDTH;x+=50){g.strokeStyle="#a2c3bc12";g.beginPath();g.moveTo(x,0);g.lineTo(x,HEIGHT);g.stroke();}
for(let y=0;y<HEIGHT;y+=50){g.strokeStyle="#a2c3bc12";g.beginPath();g.moveTo(0,y);g.lineTo(WIDTH,y);g.stroke();}
function circle(x,y,r,fill,stroke="",lw=1){
  ctx.beginPath();ctx.arc(x,y,r,0,Math.PI*2);
  if(fill){ctx.fillStyle=fill;ctx.fill();}
  if(stroke){ctx.lineWidth=lw;ctx.strokeStyle=stroke;ctx.stroke();}
}
function label(x,y,s,color="#d1e3dc",size=11,align="center"){
  ctx.font="600 "+size+"px ui-monospace,monospace";ctx.fillStyle=color;
  ctx.textAlign=align;ctx.fillText(s,x,y);
}
function polygon(x,y,r,sides,fill,stroke,rot=-Math.PI/2){
  ctx.beginPath();
  for(let i=0;i<sides;i++){
    const a=rot+i*2*Math.PI/sides;
    if(!i)ctx.moveTo(x+r*Math.cos(a),y+r*Math.sin(a));
    else ctx.lineTo(x+r*Math.cos(a),y+r*Math.sin(a));
  }
  ctx.closePath();
  if(fill){ctx.fillStyle=fill;ctx.fill();}
  if(stroke){ctx.strokeStyle=stroke;ctx.lineWidth=2;ctx.stroke();}
}
function drawBoard(){
  ctx.clearRect(0,0,WIDTH,HEIGHT);ctx.drawImage(ground,0,0);
  for(const [i,path] of PATHS.entries()){
    pathStroke(path,70,"#152e32");pathStroke(path,57,i?"#45514b":"#505748");
    pathStroke(path,43,i?"#4d5851":"#5b604e");
    ctx.setLineDash([12,18]);pathStroke(path,1.5,"#c8c6aa68");ctx.setLineDash([]);
    label(25,i?465:93,i?"SOUTH IN":"NORTH IN","#d9cca8",12,"left");
  }
  ctx.setLineDash([7,8]);pathStroke(PATHS[0].slice(4),2,"#e7c58c75");ctx.setLineDash([]);
  for(const p of PADS)circle(p.x,p.y,36,"#203b3a","#476b66",2);
  const selected=game.selectedTower();
  if(selected){
    const pad=PADS[selected.pad],ch=CHASSIS[selected.chassis];
    circle(pad.x,pad.y,ch.range*(1+(selected.level-1)*.065),"#a5d6c70b","#b5d5b369",1.6);
  }else if(game.selectedPad>=0&&PADS[game.selectedPad]){
    const pad=PADS[game.selectedPad],ch=CHASSIS[building];
    if(!game.towerAt(game.selectedPad))circle(pad.x,pad.y,ch.range,"#c1e3b50a","#b7cfb35d",1);
  }
  circle(CORE.x,CORE.y,63,"#1a2b31","#a6bfb9",5);
  polygon(CORE.x,CORE.y,40,6,"#273f45","#c7dfcd",Math.PI/6);
  polygon(CORE.x,CORE.y,23,6,game.hp<35?"#b85f5b":"#92c4ad","#25383b",Math.PI/6);
  label(CORE.x-19,CORE.y-78,"CORE","#d1e3d4",12);
  ctx.fillStyle="#182b2d";ctx.fillRect(CORE.x-52,CORE.y+67,104,6);
  ctx.fillStyle=game.hp<35?"#e08a7a":"#a9d1a3";
  ctx.fillRect(CORE.x-52,CORE.y+67,104*game.hp/game.maxHp,6);
  for(let i=0;i<PADS.length;i++){
    const p=PADS[i],tower=game.towerAt(i),isSel=tower&&selected?.id===tower.id;
    if(!tower){
      circle(p.x,p.y,22,"#1c3437",game.selectedPad===i?"#cde8b3":"#81b3a7",3);
      ctx.strokeStyle="#81b3a7";ctx.lineWidth=2;
      ctx.beginPath();ctx.moveTo(p.x-9,p.y);ctx.lineTo(p.x+9,p.y);ctx.moveTo(p.x,p.y-9);ctx.lineTo(p.x,p.y+9);ctx.stroke();continue;
    }
    const ch=CHASSIS[tower.chassis];
    circle(p.x,p.y,27,isSel?"#35524b":"#1b3236",isSel?"#d0ecc0":"#6f9d96",isSel?4:2);
    polygon(p.x,p.y,18,tower.chassis==="lens"?3:tower.chassis==="relay"?6:4,ch.color,"#223b3d",tower.chassis==="sentry"?Math.PI/4:-Math.PI/2);
    circle(p.x,p.y,6,"#284243","#c7e7d0",1);
    label(p.x,p.y+37,"T"+tower.id+"  "+tower.level,ch.color,10);
    if(tower.wait>.1){
      ctx.strokeStyle="#aec6ac77";ctx.lineWidth=2;ctx.beginPath();
      ctx.arc(p.x,p.y,33,-Math.PI/2,-Math.PI/2+Math.PI*2*Math.min(1,tower.wait/3));ctx.stroke();
    }
  }
  for(const e of game.enemies){
    if(e.dead)continue;
    circle(e.x,e.y,e.r+2,"#1d272c9c","#a6847688",1);
    polygon(e.x,e.y,e.r,e.type==="boss"?8:e.type==="shell"?6:e.type==="runner"?3:4,e.color,"#2b3136",Math.PI/4);
    if(e.mark>0){
      ctx.strokeStyle="#ffdc92";ctx.lineWidth=2;ctx.strokeRect(e.x-e.r-6,e.y-e.r-6,e.r*2+12,e.r*2+12);
    }
    if(e.chill>0)circle(e.x,e.y,e.r+5,"","#9be6f8",2);
    if(e.hp<e.maxHp){
      const w=Math.max(19,e.r*2+7);
      ctx.fillStyle="#1a262c";ctx.fillRect(e.x-w/2,e.y-e.r-13,w,4);
      ctx.fillStyle=e.armor?"#d7b6d8":"#edb79a";
      ctx.fillRect(e.x-w/2,e.y-e.r-13,w*Math.max(0,e.hp/e.maxHp),4);
    }
  }
  for(const fx of game.effects){
    const t=fx.life/fx.max;ctx.globalAlpha=Math.max(0,Math.min(1,t));
    if(fx.kind==="beam"||fx.kind==="shot"){
      ctx.beginPath();ctx.moveTo(fx.x,fx.y);ctx.lineTo(fx.x2,fx.y2);
      ctx.lineWidth=fx.thick?9:fx.kind==="beam"?3:2;ctx.strokeStyle=fx.kind==="beam"?"#b6e7ff":"#ffd6a3";ctx.stroke();
    }else if(["blast","overload","push","nova","heal"].includes(fx.kind)){
      circle(fx.x,fx.y,(fx.r||50)*(1-t*.5),fx.kind==="heal"?"#92d9ac33":"#f7c48c38",
        fx.kind==="push"?"#bbecf4":fx.kind==="heal"?"#a5e9c0":"#f9d493",fx.kind==="nova"?5:3);
    }else if(fx.kind==="mark")circle(fx.x,fx.y,24+(1-t)*25,"","#f9ce91",3);
    else if(fx.kind==="critical")label(fx.x,fx.y-30-(1-t)*18,"×1.8","#ffe1a4",16);
    else if(fx.kind==="kill")circle(fx.x,fx.y,15+(1-t)*25,"","#f3ddb2",3);
    else if(fx.kind==="breach")circle(fx.x,fx.y,32+(1-t)*30,"","#f69c8c",5);
    else if(fx.kind==="hit")circle(fx.x,fx.y,6+(1-t)*8,"","#f8efd5",2);
    ctx.globalAlpha=1;
  }
  if(game.paused){
    ctx.fillStyle="#0a1d2480";ctx.fillRect(0,0,WIDTH,HEIGHT);
    label(WIDTH/2,70,"PAUSED / 回路を編集できます","#d6e9dd",20);
  }
}
function frame(now){
  const dt=Math.max(0,Math.min(.05,(now-frameTime)/1000));frameTime=now;
  const before=game.profile.totalKills;
  for(let i=0;i<game.speed;i++)game.step(dt);
  if(game.profile.totalKills!==before)save();
  drawBoard();uiClock+=dt;saveClock+=dt;
  if(uiClock>.12){updateLive();uiClock=0;}
  if(saveClock>4){save();saveClock=0;}
  requestAnimationFrame(frame);
}
renderInspector();updateLive();requestAnimationFrame(frame);