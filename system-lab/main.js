import {Game, CONDITIONS, ACTIONS, PARTS, RESEARCH, W, H, GATE, validPair} from "./sim.js";

const STORAGE_KEY="clockwork-system-lab-v1";
let saved={};
try { saved=JSON.parse(localStorage.getItem(STORAGE_KEY)||"{}"); } catch(_) {}
const game=new Game(saved);
const el=id=>document.getElementById(id);
const canvas=el("field"),ctx=canvas.getContext("2d");
let activeTab="parts",lastFrame=performance.now(),uiTick=0,saveTick=0;
const facilityNames={turret:"自動砲台",mineW:"西側地雷",mineE:"東側地雷"};
const facilityDescriptions={
  turret:"封鎖扉の右隣に設置。射程内の敵へ自動射撃（建設資源 2）",
  mineW:"西から迫る敵へ一度だけ範囲ダメージ（建設資源 1）",
  mineE:"東から迫る敵へ一度だけ範囲ダメージ（建設資源 1）"
};
function persist(){
  try {localStorage.setItem(STORAGE_KEY,JSON.stringify(game.exportSave()));}catch(_){}
}
for(let i=0;i<2;i++){
  const condition=el("condition-"+i),action=el("action-"+i);
  CONDITIONS.forEach(([id,name])=>condition.add(new Option(name,id)));
  ACTIONS.forEach(([id,name])=>action.add(new Option(name,id)));
  condition.value=game.save.slots[i].condition;
  action.value=game.save.slots[i].action;
  const changed=()=>{
    game.updateCommand(i,condition.value,action.value);
    game.locks={};
    persist();refresh();
  };
  condition.addEventListener("change",changed);
  action.addEventListener("change",changed);
}
function setHangar(open){
  if(game.defeated)return;
  if(open)game.openHangar(); else game.closeHangar();
  el("modal").hidden=!game.paused;
  el("pause-stamp").hidden=!game.paused;
  el("hangar-toggle").textContent=game.paused?"格納庫を閉じる":"格納庫を開く";
  if(game.paused)renderHangar();
  refresh();
}
el("hangar-toggle").addEventListener("click",()=>setHangar(!game.paused));
el("hangar-close").addEventListener("click",()=>setHangar(false));
document.querySelectorAll("[data-tab]").forEach(button=>button.addEventListener("click",()=>{
  activeTab=button.dataset.tab;
  document.querySelectorAll("[data-tab]").forEach(b=>b.classList.toggle("on",b===button));
  renderHangar();
}));
document.addEventListener("keydown",e=>{
  if(e.key==="Escape"){
    if(game.paused)setHangar(false);
    else game.robot.selected=false;
  }
  if((e.key==="h"||e.key==="H")&&!["INPUT","SELECT","TEXTAREA"].includes(document.activeElement?.tagName)){
    e.preventDefault();
    if(!game.defeated)setHangar(!game.paused);
  }
  if(e.key==="1"&&!game.paused&&!game.defeated&&document.activeElement?.tagName!=="SELECT"){
    game.robot.selected=true;
  }
});
canvas.addEventListener("pointerdown",e=>{
  const rect=canvas.getBoundingClientRect();
  const x=(e.clientX-rect.left)/rect.width*W,y=(e.clientY-rect.top)/rect.height*H;
  const worked=game.selectAt(x,y,Math.max(30,36*W/rect.width));
  el("field-tip").textContent=game.robot.selected?"次に移動したい地面をタップ":"機体をタップ → 地面をタップして一時移動";
  if(worked)refresh();
});
el("retry").addEventListener("click",()=>{
  el("defeat-modal").hidden=true;
  game.resetBattle();
  setHangar(true);
  persist();
});
function actButton(label,kind,id,slot,disabled=false,extra=""){
  return '<button '+(disabled?'disabled ':'')+'data-kind="'+kind+'" data-id="'+id+'" '+(slot?'data-slot="'+slot+'" ':'')+'class="'+extra+'">'+label+'</button>';
}
function renderHangar(){
  const b=el("hangar-body"),s=game.save,stats=game.stats();
  el("hangar-budget").textContent="建設資源 "+game.capacityUsed()+" / "+stats.budget;
  if(activeTab==="parts"){
    b.innerHTML='<div class="parts-grid">'+Object.entries(PARTS).map(([slot,parts])=>{
      const title={weapon:"武器",legs:"脚",sensor:"センサー",armor:"装甲"}[slot];
      return '<section class="parts-group"><h3>'+title+'</h3>'+parts.map(p=>{
        const owned=s.owned.includes(p.id+":"+slot);
        const equipped=s.installed[slot]===p.id;
        const label=equipped?'装備中':owned?'換装':"製造 "+p.cost+" 素材";
        const kind=owned?"equip":"craft";
        const disabled=equipped||(!owned&&s.material<p.cost);
        return '<div class="part-row"><div><strong>'+p.name+'</strong><small>'+p.note+'</small></div>'+actButton(label,kind,p.id,slot,disabled,equipped?"equipped":"")+'</div>';
      }).join("")+'</section>';
    }).join("")+'</div>';
  }else if(activeTab==="team"){
    b.innerHTML='<div class="two-col"><section><h3>防衛設備</h3><p>設置中の設備が建設資源を消費。撤去すると枠が戻ります。地雷は使用すると消滅します。</p>'+
      Object.entries(facilityNames).map(([id,name])=>{
        const deployed=!!s.facilities[id],cost=id==="turret"?2:1;
        return '<div class="facility-row"><div><strong>'+name+'</strong><small>'+facilityDescriptions[id]+'</small></div>'+actButton(deployed?"撤去":"設置","facility",id,"",!deployed&&game.capacityUsed()+cost>stats.budget)+'</div>';
      }).join("")+'</section><section><h3>守備位置</h3><div class="home-map"><p>「戻る」コマンドの帰還地点です。位置を変えても、戦闘中の機体は瞬間移動しません。</p><p>現在： X '+Math.round(s.home.x)+' / Y '+Math.round(s.home.y)+'</p>'+
      actButton("西側","home","west")+" "+actButton("南側","home","south")+" "+actButton("東側","home","east")+'</div><h3 style="margin-top:27px">編成</h3><p>試作は名称未定（二足）1機のみ。初期の合計2スロットは固定。複数機と機体追加のバランスは未決です。</p></section></div>';
  }else{
    b.innerHTML='<div class="two-col"><section><h3>恒久研究</h3><p>解析データを使って能力を強化します。敗北時の回収分も残ります。</p><div class="research-list">'+RESEARCH.map(r=>{
      const done=s.research.includes(r.id);
      return '<div class="research-row"><div><strong>'+r.name+'</strong><small>'+r.description+'</small></div>'+actButton(done?"研究済":"研究 "+r.cost+" データ","research",r.id,"",done||s.data<r.cost)+'</div>';
    }).join("")+'</div></section><section><h3>物語の進行</h3><p>一定数の敵を倒すと次の物語が解放されます。解放しただけでは敵は強化されません。</p><div class="tab-story"><h3>'+(s.tier===1?"次の敵帯":"敵帯 02 に到達")+'</h3><p class="'+(s.totalKills>=12?"story-ready":"")+'">'+(s.tier===2?"次の敵帯で戦闘中。複数方向と追加の敵が出現します。":"累計 "+s.totalKills+" / 12 体撃破で解放（この試作の仮閾値）")+'</p>'+
      (s.tier===1?actButton("次の物語へ進む","story","advance","",s.totalKills<12):"")+'</div><p>進行後も戦闘は同じ世界で継続します。独立ステージやクリア画面はありません。</p></section></div>';
  }
}
el("hangar-body").addEventListener("click",e=>{
  const target=e.target.closest("button[data-kind]");
  if(!target)return;
  const {kind,id,slot}=target.dataset;
  let changed=false;
  if(kind==="equip")changed=game.equip(slot,id);
  if(kind==="craft")changed=game.craft(slot,id);
  if(kind==="facility")changed=game.toggleFacility(id);
  if(kind==="research")changed=game.research(id);
  if(kind==="story")changed=game.advanceStory();
  if(kind==="home"){
    const choices={west:{x:315,y:285},south:{x:475,y:418},east:{x:626,y:285}};
    changed=game.setHome(choices[id].x,choices[id].y);
  }
  if(changed){persist();renderHangar();refresh();}
});
function refresh(){
  const s=game.snapshot(),st=s.stats;
  el("gate-value").textContent=Math.ceil(s.gateHP)+" / "+st.gateHp;
  el("gate-overlay").textContent=Math.ceil(s.gateHP);
  el("gate-value").style.color=s.gateHP/st.gateHp<.4?"#f08472":"";
  el("kill-value").textContent=s.totalKills;
  el("data-value").textContent=s.data;
  el("material-value").textContent=s.material;
  el("time-value").textContent=String(Math.floor(s.time/60)).padStart(2,"0")+":"+String(Math.floor(s.time%60)).padStart(2,"0");
  el("enemy-value").textContent=s.enemyCount;
  el("tier-label").textContent=s.tier===1?"敵帯 01 · 西側侵入":"敵帯 02 · 多方向侵入";
  el("event-text").textContent=game.lastAction;
  el("battle-status").textContent=s.defeated?"封鎖扉破壊":s.paused?"戦場の時間を停止しています。":game.robot.hp<=0?"機体が停止。封鎖扉を守れません。":game.robot.manual?"一時移動中。射撃は並行実行します。":"命令による自律防衛中。編集は即時反映。";
  el("move-owner").textContent=game.robot.manual?"手動":s.used.move===null?"—":"0"+(s.used.move+1);
  el("shoot-owner").textContent=s.used.weapon===null?"—":"0"+(s.used.weapon+1);
  el("stats").innerHTML=[
    ["索敵",Math.round(st.detect)],["射程",Math.round(st.range)],["移動速度",Math.round(st.speed)],["威力",st.damage],["射撃間隔",st.interval+" 秒"],["機体HP",Math.ceil(game.robot.hp)+" / "+st.hp]
  ].map(([label,value])=>'<div><span>'+label+'</span><b>'+value+'</b></div>').join("");
  for(let i=0;i<2;i++){
    const status=s.active[i],row=document.querySelector('.command-row[data-index="'+i+'"]');
    const invalid=!validPair(game.save.slots[i].condition,game.save.slots[i].action);
    el("status-"+i).textContent=status.text;
    el("invalid-"+i).hidden=!invalid;
    row.classList.toggle("running",status.active&&!s.paused&&!s.defeated);
    row.classList.toggle("invalid-row",invalid);
  }
  if(s.defeated&&el("defeat-modal").hidden){
    el("result-kills").textContent=s.kills;
    el("result-data").textContent=s.data;
    el("result-material").textContent=s.material;
    el("defeat-modal").hidden=false;
    persist();
  }
}
const ground=document.createElement("canvas");
ground.width=W;ground.height=H;
const bg=ground.getContext("2d");
bg.fillStyle="#2d3938";bg.fillRect(0,0,W,H);
let seed=9981;const noise=()=>{seed=(seed*1664525+1013904223)>>>0;return seed/4294967296;};
for(let i=0;i<1850;i++){
  const x=noise()*W,y=noise()*H,r=1+noise()*3;
  bg.fillStyle=noise()>.6?"#64705a22":"#101e2428";
  bg.fillRect(x,y,r*3,1+noise()*2);
}
bg.strokeStyle="#d0b88f15";bg.lineWidth=1;
for(let x=30;x<W;x+=45){bg.beginPath();bg.moveTo(x,0);bg.lineTo(x,H);bg.stroke();}
for(let y=10;y<H;y+=45){bg.beginPath();bg.moveTo(0,y);bg.lineTo(W,y);bg.stroke();}
for(const rock of [[180,105,27],[710,90,18],[720,445,24],[215,440,31],[360,90,14]]){
  const [x,y,r]=rock;bg.fillStyle="#46504a";bg.beginPath();bg.moveTo(x-r,y+r*.4);bg.lineTo(x-r*.6,y-r*.7);bg.lineTo(x+r*.6,y-r);bg.lineTo(x+r,y+r*.3);bg.closePath();bg.fill();
  bg.strokeStyle="#626e62";bg.stroke();
}
function circle(x,y,r,stroke,fill,width=1){
  ctx.beginPath();ctx.arc(x,y,r,0,Math.PI*2);
  if(fill){ctx.fillStyle=fill;ctx.fill();}
  if(stroke){ctx.strokeStyle=stroke;ctx.lineWidth=width;ctx.stroke();}
}
function draw(){
  ctx.clearRect(0,0,W,H);ctx.drawImage(ground,0,0);
  const st=game.stats(),g=GATE,robot=game.robot;
  // Approach lanes; no collision walls or concealed tactical AI in the prototype.
  ctx.fillStyle="#9e9c7850";ctx.fillRect(0,265,900,20);
  ctx.strokeStyle="#dfbd7d33";ctx.setLineDash([8,8]);ctx.lineWidth=1;
  ctx.strokeRect(15,15,W-30,H-30);ctx.setLineDash([]);
  circle(g.x,g.y,136,"#c9a1663b",null,1);
  // Gate compound, low surface ring and sealed center.
  circle(g.x,g.y,57,"#a89677","#1d2d31",12);
  circle(g.x,g.y,42,"#859c93","#263e41",5);
  ctx.save();ctx.translate(g.x,g.y);ctx.rotate(Math.PI/4);
  ctx.fillStyle="#475a5b";ctx.fillRect(-28,-28,56,56);ctx.strokeStyle="#b9bb9d";ctx.lineWidth=4;ctx.strokeRect(-28,-28,56,56);
  ctx.fillStyle="#192c34";ctx.fillRect(-19,-19,38,38);ctx.strokeStyle="#8baba5";ctx.lineWidth=2;ctx.strokeRect(-19,-19,38,38);
  ctx.restore();
  // Facility placement markers
  if(game.save.facilities.turret){
    const t={x:g.x+72,y:g.y-42};
    circle(t.x,t.y,14,"#b2d7bd","#294c4b",3);
    ctx.fillStyle="#d0e8c9";ctx.fillRect(t.x-3,t.y-19,6,18);
  }
  for(const [id,p] of [["mineW",{x:g.x-98,y:g.y+35}],["mineE",{x:g.x+95,y:g.y+35}]]){
    if(game.save.facilities[id]){
      circle(p.x,p.y,10,"#d8b57e","#776d4e",2);
      ctx.strokeStyle="#d8b57e";ctx.beginPath();ctx.moveTo(p.x-5,p.y-5);ctx.lineTo(p.x+5,p.y+5);ctx.moveTo(p.x+5,p.y-5);ctx.lineTo(p.x-5,p.y+5);ctx.stroke();
    }
  }
  // Sensor and weapon circles represent actual logic ranges.
  if(robot.hp>0){
    circle(robot.x,robot.y,st.detect,"#6ca7b080",null,1);
    circle(robot.x,robot.y,st.range,"#e0b76f8c",null,1);
  }
  // Defense position marker
  const home=game.save.home;
  ctx.strokeStyle="#9ed1bd99";ctx.lineWidth=2;
  ctx.strokeRect(home.x-10,home.y-10,20,20);
  ctx.fillStyle="#9ed1bd";ctx.font="10px monospace";ctx.fillText("H",home.x+14,home.y-9);
  for(const e of game.enemies){
    const specs={crawler:{color:"#b47b63",radius:12},swift:{color:"#d39a65",radius:9},armored:{color:"#9c7772",radius:16}}[e.kind];
    circle(e.x,e.y,Math.max(5,specs.radius+5),"#d7805744",null,1);
    ctx.save();ctx.translate(e.x,e.y);
    const theta=Math.atan2(g.y-e.y,g.x-e.x);ctx.rotate(theta);
    ctx.fillStyle=specs.color;ctx.strokeStyle="#342b2a";ctx.lineWidth=2;
    ctx.beginPath();ctx.moveTo(specs.radius,0);ctx.lineTo(-specs.radius*.8,-specs.radius*.75);ctx.lineTo(-specs.radius*.5,0);ctx.lineTo(-specs.radius*.8,specs.radius*.75);ctx.closePath();ctx.fill();ctx.stroke();
    ctx.restore();
    ctx.fillStyle="#271f1d";ctx.fillRect(e.x-14,e.y-specs.radius-14,28,3);
    ctx.fillStyle="#dc9a78";ctx.fillRect(e.x-14,e.y-specs.radius-14,28*Math.max(0,e.hp/e.maxHp),3);
  }
  if(robot.manual){
    ctx.setLineDash([6,5]);ctx.strokeStyle="#a8d0b0";ctx.lineWidth=2;
    ctx.beginPath();ctx.moveTo(robot.x,robot.y);ctx.lineTo(robot.manual.x,robot.manual.y);ctx.stroke();ctx.setLineDash([]);
    circle(robot.manual.x,robot.manual.y,8,"#a8d0b0",null,2);
  }
  // Robot at the actual simulated position.
  ctx.save();ctx.translate(robot.x,robot.y);
  ctx.fillStyle="#10191b88";ctx.beginPath();ctx.ellipse(0,14,24,8,0,0,Math.PI*2);ctx.fill();
  ctx.fillStyle=robot.hp>0?"#83b6ad":"#6e7e80";ctx.strokeStyle="#203139";ctx.lineWidth=3;
  ctx.fillRect(-15,-15,30,31);ctx.strokeRect(-15,-15,30,31);
  ctx.fillStyle="#adcfc1";ctx.fillRect(-8,-21,16,10);
  ctx.fillStyle="#283a47";ctx.fillRect(-8,-4,16,10);
  ctx.fillStyle="#d5bb7e";ctx.fillRect(10,-4,24,6);
  ctx.fillStyle="#6d918e";ctx.fillRect(-12,13,9,14);ctx.fillRect(4,13,9,14);
  if(robot.selected){circle(0,1,37,"#cbeac7",null,2);}
  ctx.restore();
  ctx.fillStyle="#233034";ctx.fillRect(robot.x-25,robot.y-33,50,4);
  ctx.fillStyle="#93c5ad";ctx.fillRect(robot.x-25,robot.y-33,50*Math.max(0,robot.hp/robot.maxHp),4);
  for(const bullet of game.bullets){
    circle(bullet.x,bullet.y,bullet.fromTurret?4:5,null,bullet.fromTurret?"#f3b283":"#f6df97");
  }
  for(const effect of game.effects){
    const r=effect.type==="mine"?50*(1-effect.life/.7)+5:effect.type==="kill"?30*(1-effect.life/.45)+5:11;
    circle(effect.x,effect.y,r,effect.type==="mine"?"#f5cb8c":effect.type==="kill"?"#e8b686":"#e9e5c4",null,3);
  }
  // Show the actual dynamic position of the unit label.
  el("unit-label").style.left=(robot.x/W*100)+"%";
  el("unit-label").style.top=(robot.y/H*100)+"%";
}
function frame(now){
  const dt=Math.min(.06,(now-lastFrame)/1000);lastFrame=now;
  game.step(dt);
  draw();
  uiTick+=dt;saveTick+=dt;
  if(uiTick>.17){refresh();uiTick=0;}
  if(saveTick>2){persist();saveTick=0;}
  requestAnimationFrame(frame);
}
refresh();requestAnimationFrame(frame);
