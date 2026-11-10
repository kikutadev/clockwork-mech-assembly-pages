import {Game,WIDTH,HEIGHT,CORE,LANES,TURRETS,MODULES,WAVES} from "./sim.js?v=2";
const $=id=>document.getElementById(id);
const KEY="shotworks-profile-v1";
let cached={};try{cached=JSON.parse(localStorage.getItem(KEY)||"{}");}catch{}
const game=new Game(cached);
const canvas=$("battle"),ctx=canvas.getContext("2d");
const testCanvas=$("test-canvas"),testCtx=testCanvas.getContext("2d");
let preview=null,previewTime=0,previewSerial=0;
let slot=0,elapsedUI=0,lastFrame=performance.now(),lastEffect=null,lastResult=null;
let noticeUntil=0,selectedHint="初めは「分裂」を入れてみよう。",renderedProfile="";
function persist(){try{localStorage.setItem(KEY,JSON.stringify(game.exportProfile()));}catch{}}
const num=n=>String(n).padStart(2,"0");
function explainSelection(){
  const modules=game.profile.loadout;
  if(!modules[0]&&!modules[1]){
    $("explain").innerHTML='<b>💡 まずは「分裂」を入れてみよう</b><p>敵を倒すと弾が増え、後ろの敵へ飛びます。1枠だけでも変化を試せます。</p>';
  }else if(modules[0]==="split"&&modules[1]==="blast"){
    $("explain").innerHTML='<b>✦ 分裂した弾も爆発する</b><p>左の「分裂」で生まれた弾は、右の「爆発」を引き継ぎます。順番を入れ替えたらどうなる？</p>';
  }else if(modules[0]==="blast"&&modules[1]==="split"){
    $("explain").innerHTML='<b>✦ 最初の弾だけが爆発する</b><p>「爆発」が先なので、後から生まれた分裂弾には爆発が付きません。順番の効果を比べられます。</p>';
  }else if(modules[0]==="frost"&&modules[1]==="arc"){
    $("explain").innerHTML='<b>✦ 冷却された敵から強い電撃が飛ぶ</b><p>凍った敵を起点に電撃を放つと、電撃のダメージが上がります。逆順だと変化します。</p>';
  }else{
    const used=modules.filter(Boolean).map(id=>MODULES[id].name).join(" → ");
    $("explain").innerHTML='<b>いまの弾：'+used+'</b><p>実際に撃ってみてください。パーツを1つ変えるだけでも飛び方が変わります。</p>';
  }
}
function renderModules(){
  const sig=game.profile.loadout.join("|")+"|"+game.profile.completed+"|"+slot;
  if(sig===renderedProfile)return;renderedProfile=sig;
  const sockets=$("sockets");
  sockets.replaceChildren();
  for(let i=0;i<2;i++){
    const id=game.profile.loadout[i],module=id?MODULES[id]:null;
    const btn=document.createElement("button");
    btn.type="button";btn.className="socket "+(i===slot?"active ":"")+(id?"equipped":"");
    btn.dataset.slot=String(i);btn.setAttribute("aria-pressed",String(i===slot));
    btn.setAttribute("aria-label",module?("スロット"+(i+1)+": "+module.name+"。選択または右上×で外す"):"空きスロット"+(i+1));
    if(module){
      btn.innerHTML='<span class="socket-number">SLOT '+num(i+1)+'</span>'+
        '<span class="chip-icon" style="color:'+module.accent+'">'+module.icon+'</span>'+
        '<b>'+module.name+'</b><span class="remove" data-remove="'+i+'">×</span>';
    }else{
      btn.innerHTML='<span class="socket-number">SLOT '+num(i+1)+'</span>'+
        '<b>＋ 空き</b><small>タップして選択</small>';
    }
    sockets.appendChild(btn);
    if(i===0){const arrow=document.createElement("div");arrow.className="socket-arrow";arrow.textContent="→";sockets.appendChild(arrow);}
  }
  $("socket-help").textContent="スロット"+num(slot+1)+"に入れるパーツを選択";
  $("unlock-info").textContent=game.available().length+"種類";
  // Show only usable parts; the next unlock is already visible in the discovery row.
  $("chips").innerHTML=Object.entries(MODULES).filter(([id])=>game.isUnlocked(id)).map(([id,module])=>{
    const unlocked=game.isUnlocked(id);
    const equipped=game.profile.loadout.includes(id);
    return '<button class="chip '+(!unlocked?"chip-locked ":"")+(equipped?"chip-equipped":"")+
      '" data-module="'+id+'" '+(!unlocked?"disabled":"")+' type="button" aria-label="'+module.name+'：'+module.short+'">'+
      '<span class="chip-icon" style="color:'+module.accent+'">'+module.icon+'</span>'+
      '<span class="chip-body"><b>'+module.name+'</b><small>'+module.short+'</small></span>'+
      '<span class="chip-tail">'+(unlocked?(equipped?"装着中":"選ぶ"):(id==="frost"?"第1波で獲得":"第2波で獲得"))+'</span></button>';
  }).join("");
  const next=game.profile.completed===0?["第1波クリアで「冷却」","遅らせて時間を稼ぐ弾"]:
    game.profile.completed===1?["第2波クリアで「電撃」","冷却した敵から強い連鎖攻撃"]:
    ["全5種類のパーツを獲得","何度でも組み直して試せます"];
  $("reward-title").textContent=next[0];$("reward-sub").textContent=next[1];
  $("mobile-loadout").textContent=game.profile.loadout.filter(Boolean).map(id=>MODULES[id].name).join(" → ")||"未改造";
  explainSelection();
  restartPreview();
}
$("sockets").addEventListener("click",e=>{
  const remove=e.target.closest("[data-remove]");
  if(remove){
    game.setModule(Number(remove.dataset.remove),null);slot=Number(remove.dataset.remove);
  }else{
    const button=e.target.closest("[data-slot]");if(!button)return;
    slot=Number(button.dataset.slot);
  }
  renderedProfile="";renderModules();persist();
});
$("chips").addEventListener("click",e=>{
  const btn=e.target.closest("[data-module]");if(!btn)return;
  const id=btn.dataset.module;
  const both=game.profile.loadout.slice();
  if(!game.setModule(slot,id))return;
  // First card click prepares the other slot without forcing a separate socket click.
  if(!both[slot]&&!game.profile.loadout[1-slot])slot=1-slot;
  renderedProfile="";renderModules();persist();
});
$("mobile-customize").addEventListener("click",()=>{
  $("workshop").scrollIntoView({behavior:"instant",block:"start"});
});
$("mobile-test").addEventListener("click",()=>{
  if(game.phase!=="ready")retry(true);else game.start();
  $("canvas-wrap").scrollIntoView({behavior:"instant",block:"start"});
  update();
});
$("swap").addEventListener("click",()=>{
  game.swap();renderedProfile="";renderModules();persist();
});
function stageNav(){
  $("wave-list").innerHTML=WAVES.map((w,i)=>{
    const n=i+1,active=n===game.wave,locked=n>game.profile.completed+1;
    return '<button type="button" data-wave="'+n+'" '+(locked?"disabled":"")+
      ' class="'+(active?"current":game.profile.completed>=n?"cleared":"")+'">第'+n+'波'+(locked?" 🔒":"")+'</button>';
  }).join("");
}
$("wave-list").addEventListener("click",e=>{
  const btn=e.target.closest("[data-wave]");if(!btn)return;
  if(game.selectWave(Number(btn.dataset.wave))){lastResult=null;lastEffect=null;stageNav();update();persist();}
});
function retry(run=true){
  game.retry();lastResult=null;lastEffect=null;$("outcome").hidden=true;$("effect-banner").hidden=true;
  if(run)game.start();
  update();
}
$("start").addEventListener("click",()=>{game.start();update();});
$("retry-top").addEventListener("click",()=>retry(true));
$("retry").addEventListener("click",()=>retry(true));
$("next").addEventListener("click",()=>{
  if(game.nextWave()){lastResult=null;lastEffect=null;stageNav();renderedProfile="";renderModules();$("outcome").hidden=true;update();persist();}
});
$("speed").addEventListener("click",()=>{
  game.setSpeed(game.speed===1?2:game.speed===2?5:1);
  $("speed").textContent="×"+game.speed;
});
function showResult(){
  if(game.result===lastResult||!game.result)return;
  const r=game.result;lastResult=r;
  $("outcome").hidden=false;
  $("outcome-title").textContent=r.won?"第"+game.wave+"波を防衛！":"コアが突破された";
  $("outcome-tag").textContent=r.won?"DEFENSE COMPLETE":"CORE BREACHED";
  $("outcome-tag").style.color=r.won?"#b7e2bc":"#f2ada2";
  $("outcome-hp").textContent=r.hp+" / 100";
  const delta=r.prevHp==null?null:r.hp-r.prevHp;
  $("outcome-delta").textContent=delta==null?"初回":(delta>0?"+":"")+delta;
  $("outcome-delta").style.color=delta>0?"#b9e7ae":delta<0?"#f4aaa1":"";
  $("outcome-duration").textContent=r.seconds.toFixed(1)+"秒";
  $("outcome-description").textContent=r.won?
    "耐久が同じでも、撃破までの時間は変わります。":
    "同じ敵を出し直せます。パーツや順番を変えて再挑戦。";
  const loadoutLabel=ids=>ids.map(id=>id?MODULES[id].name:"空き").join(" → ");
  $("outcome-compare").hidden=!r.previous;
  if(r.previous){
    const box=$("outcome-compare");
    box.replaceChildren();
    const old=document.createElement("span");
    old.textContent="前回 "+(r.previous.mixed?"戦闘中に交換":loadoutLabel(r.previous.modules))+
      " · 耐久"+r.previous.hp+(r.previous.seconds==null?"":" / "+r.previous.seconds.toFixed(1)+"秒");
    const arrow=document.createElement("b");arrow.textContent="→";
    const current=document.createElement("span");
    current.textContent="今回 "+(r.mixed?"戦闘中に交換":loadoutLabel(r.modules))+
      " · 耐久"+r.hp+" / "+r.seconds.toFixed(1)+"秒";
    box.append(old,arrow,current);
  }
  $("next").disabled=!r.won||game.wave===WAVES.length;
  $("next").innerHTML=game.wave===WAVES.length?"全波をクリア":"次の侵攻へ <span>▶</span>";
  renderedProfile="";renderModules();stageNav();persist();
}
function update(){
  $("core-value").innerHTML=Math.ceil(game.core)+' <small>/ 100</small>';
  $("core-value").style.color=game.core<=40?"#f3a89a":"";
  $("kill-value").innerHTML=game.kills+' <small>体</small>';
  $("wave-value").innerHTML=num(game.wave)+' <small>/ 04</small>';
  $("wave-name").textContent="第"+game.wave+"波："+WAVES[game.wave-1].name;
  $("wave-hint").textContent=WAVES[game.wave-1].hint;
  $("phase-tag").textContent=game.phase==="ready"?"準備中":game.phase==="run"?"交戦中":"戦闘終了";
  $("state").textContent=game.phase==="ready"?"準備中":game.phase==="run"?"自動迎撃中":game.result?.won?"防衛成功":"防衛失敗";
  const script=WAVES[game.wave-1].enemies;
  const count=script.length-game.spawnIndex+game.enemies.length;
  $("remaining").textContent=game.phase==="ready"?"敵が出現するまでパーツを試せます":
    game.phase==="run"?"残り "+count+"体 / 射撃 "+game.metrics.mainShots+"発":
    "撃破 "+game.kills+" / 侵入 "+game.escapes+"体";
  $("start").disabled=game.phase!=="ready";
  $("start").innerHTML=game.phase==="ready"?"迎撃開始 <span>▶</span>":game.phase==="run"?"防衛中":"終了";
  $("retry-top").disabled=game.phase==="ready";
  if(game.phase==="result")showResult();
  if(game.lastEffect!==lastEffect){
    lastEffect=game.lastEffect;noticeUntil=performance.now()+1300;
    if(lastEffect){
      $("effect-name").textContent=lastEffect.name+"が発動";
      $("effect-note").textContent=lastEffect.note;
      $("effect-emoji").textContent=Object.entries(MODULES).find(([,v])=>v.name===lastEffect.name)?.[1].icon||"✧";
    }
  }
  $("effect-banner").hidden=!lastEffect||performance.now()>noticeUntil;
}
// A noninteractive live test range. It uses the SAME Game.fire() and stepProjectiles()
// as real defense; there are no fake projectile shapes or precomputed outcomes.
const px=x=>27+(x-TURRETS.main.x)*1.15;
const py=y=>75+(y-TURRETS.main.y)*.95;
function restartPreview(){
  const demo=new Game({completed:game.profile.completed,loadout:game.profile.loadout});
  for(const [type,x,y,progress] of [
    ["bug",628,322,.83],["pack",679,297,.71],["shell",720,348,.59]
  ]){
    const e=demo.spawn({type,lane:0});
    Object.assign(e,{x,y,progress});
  }
  demo.fire("main");
  preview=demo;previewTime=0;previewSerial++;
  $("test-status").textContent="新しい弾を試射中";
  $("test-impact").textContent="命中までの弾の動きを確認";
}
function stepPreview(dt){
  if(!preview)return;
  previewTime+=dt;
  preview.time+=dt;
  preview.stepProjectiles(dt);
  const m=preview.metrics;
  const changes=[];
  if(m.extraBullets)changes.push("派生弾 "+m.extraBullets+"発");
  if(m.blastHits)changes.push("爆風 "+m.blastHits+"命中");
  if(m.pierces)changes.push("貫通 "+m.pierces+"回");
  if(m.slows)changes.push("冷却 "+m.slows+"体");
  if(m.arcHits)changes.push("電撃 "+m.arcHits+"体");
  const label=changes.length?changes.join(" / "):
    m.impacts>0?"通常弾が命中":"命中までの弾の動きを確認";
  if($("test-impact").textContent!==label)$("test-impact").textContent=label;
  if(previewTime>2.8)restartPreview();
}
function drawPreview(){
  const c=testCtx;
  c.clearRect(0,0,340,150);
  c.fillStyle="#11292c";c.fillRect(0,0,340,150);
  c.strokeStyle="#385656";c.lineWidth=15;c.lineCap="round";
  c.beginPath();c.moveTo(75,76);c.lineTo(325,76);c.stroke();
  c.strokeStyle="#728778";c.lineWidth=1.5;c.setLineDash([9,11]);
  c.beginPath();c.moveTo(75,76);c.lineTo(325,76);c.stroke();c.setLineDash([]);
  c.fillStyle="#9cbeb0";c.font="10px system-ui";c.fillText("TEST FIRE",10,18);
  c.fillStyle="#2d6665";c.fillRect(17,60,22,30);
  c.strokeStyle="#c5dfbf";c.lineWidth=4;c.beginPath();c.moveTo(25,75);c.lineTo(59,75);c.stroke();
  for(const e of preview.enemies){
    const x=px(e.x),y=py(e.y),r=Math.max(7,e.r*.72);
    c.beginPath();c.arc(x,y,r,0,Math.PI*2);c.fillStyle=e.fill;c.fill();
    c.strokeStyle=e.cold>0?"#a7eff5":"#203d42";c.lineWidth=e.cold>0?4:2;c.stroke();
    c.fillStyle="#203940";c.fillRect(x-r,y-r-8,r*2,3);
    c.fillStyle="#b9dbba";c.fillRect(x-r,y-r-8,r*2*Math.max(0,e.hp/e.maxHp),3);
  }
  for(const p of preview.bullets){
    const x=px(p.x),y=py(p.y),lx=px(p.px),ly=py(p.py);
    c.strokeStyle=p.shard?"#f9bc8c":"#fff0bd";c.lineWidth=p.shard?3:5;
    c.beginPath();c.moveTo(lx,ly);c.lineTo(x,y);c.stroke();
    c.fillStyle=p.shard?"#f8ba89":"#ffe4a5";
    c.beginPath();c.arc(x,y,p.shard?4:6,0,Math.PI*2);c.fill();
  }
  for(const fx of preview.effects){
    const f=fx.life/fx.max;
    c.globalAlpha=Math.max(0,Math.min(1,f));
    if(fx.kind==="blast"||fx.kind==="frost"){
      c.strokeStyle=fx.kind==="blast"?"#ffc491":"#a4e5f5";c.lineWidth=5;
      c.beginPath();c.arc(px(fx.x),py(fx.y),fx.r*.85*(.5+.5*(1-f)),0,Math.PI*2);c.stroke();
    }else if(fx.kind==="arc"){
      c.strokeStyle="#dbc0ff";c.lineWidth=4;c.beginPath();c.moveTo(px(fx.x),py(fx.y));
      c.lineTo(px(fx.x2)-9,py(fx.y2)-9);c.lineTo(px(fx.x2),py(fx.y2));c.stroke();
    }else if(["launch","pierce","hit","kill"].includes(fx.kind)){
      c.strokeStyle=fx.kind==="pierce"?"#f6e8ab":"#efcca5";c.lineWidth=2;
      c.beginPath();c.arc(px(fx.x),py(fx.y),9+(1-f)*15,0,Math.PI*2);c.stroke();
    }
    c.globalAlpha=1;
  }
  if(previewTime>1.4){
    c.fillStyle="#b3d6bd";c.font="11px system-ui";c.fillText("↻ 自動リプレイ",225,137);
  }
}
const bg=document.createElement("canvas");bg.width=WIDTH;bg.height=HEIGHT;
const b=bg.getContext("2d");b.fillStyle="#2a3a3b";b.fillRect(0,0,WIDTH,HEIGHT);
let seed=5091;const noise=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
for(let i=0;i<3200;i++){
  const x=noise()*WIDTH,y=noise()*HEIGHT;
  b.fillStyle=noise()>.5?"#7280742b":"#142c3022";
  b.fillRect(x,y,1+noise()*9,1+noise()*4);
}
b.strokeStyle="#9bbab011";b.lineWidth=1;
for(let x=0;x<WIDTH;x+=45){b.beginPath();b.moveTo(x,0);b.lineTo(x,HEIGHT);b.stroke();}
for(let y=0;y<HEIGHT;y+=45){b.beginPath();b.moveTo(0,y);b.lineTo(WIDTH,y);b.stroke();}
function circle(x,y,r,fill,stroke,width=1){
  ctx.beginPath();ctx.arc(x,y,r,0,Math.PI*2);
  if(fill){ctx.fillStyle=fill;ctx.fill();}
  if(stroke){ctx.lineWidth=width;ctx.strokeStyle=stroke;ctx.stroke();}
}
function poly(x,y,r,n,fill,rotation=0){
  ctx.fillStyle=fill;ctx.beginPath();
  for(let i=0;i<n;i++){
    const angle=rotation+i*2*Math.PI/n;
    if(i===0)ctx.moveTo(x+r*Math.cos(angle),y+r*Math.sin(angle));
    else ctx.lineTo(x+r*Math.cos(angle),y+r*Math.sin(angle));
  }
  ctx.closePath();ctx.fill();
}
function road(points,stroke,width){
  ctx.strokeStyle=stroke;ctx.lineCap="round";ctx.lineJoin="round";ctx.lineWidth=width;
  ctx.beginPath();points.forEach((p,i)=>i?ctx.lineTo(p.x,p.y):ctx.moveTo(p.x,p.y));ctx.stroke();
}
function text(x,y,s,size=12,color="#d7e9d9",align="center"){
  ctx.font="bold "+size+"px ui-monospace,monospace";ctx.fillStyle=color;ctx.textAlign=align;ctx.fillText(s,x,y);
}
function turretDraw(id,t){
  const main=id==="main",target=game.pick(t);
  const heading=target?Math.atan2(target.y-t.y,target.x-t.x):Math.PI/4;
  const size=main?34:21;
  circle(t.x,t.y,size+11,"#12272a",main?"#adcaad":"#799e9b",main?5:3);
  ctx.save();ctx.translate(t.x,t.y);ctx.rotate(heading);
  ctx.fillStyle=main?"#d3e1c2":"#9fbdb1";
  ctx.fillRect(0,-(main?7:4),main?57:32,main?14:8);
  ctx.strokeStyle="#294142";ctx.lineWidth=3;
  ctx.strokeRect(0,-(main?7:4),main?57:32,main?14:8);
  ctx.restore();
  poly(t.x,t.y,size,main?6:4,main?"#789b8d":"#587b80",Math.PI/4);
  poly(t.x,t.y,size*.63,main?6:4,main?"#b9dbbf":"#a6c4b9",Math.PI/4);
  circle(t.x,t.y,main?9:6,"#244044","#d0e6d7",2);
  if(main){
    circle(t.x,t.y,52,"", "#b5d5ad44",1);
    text(t.x,t.y+70,"MAIN / CUSTOM",12,"#d3e5c9");
    for(let i=0;i<2;i++){
      const m=game.profile.loadout[i];
      circle(t.x-13+i*26,t.y+29,7,m?MODULES[m].accent:"#355753","#253f41",2);
    }
  }else text(t.x,t.y+44,id==="north"?"SUPPORT 1":"SUPPORT 2",10,"#a3c6bc");
}
function draw(){
  ctx.clearRect(0,0,WIDTH,HEIGHT);ctx.drawImage(bg,0,0);
  for(let i=0;i<LANES.length;i++){
    const route=LANES[i];
    road(route,"#142d30",79);road(route,i===0?"#545f53":"#4a5854",64);
    road(route,i===0?"#606a59":"#53645d",46);
    ctx.setLineDash([10,16]);road(route,"#d9d0ae65",1.5);ctx.setLineDash([]);
  }
  // Fixed defense core. No build pads or hidden placement controls.
  circle(CORE.x,CORE.y,56,"#1c3436","#a6c6b5",6);
  poly(CORE.x,CORE.y,40,6,"#52766d",Math.PI/6);
  poly(CORE.x,CORE.y,27,6,game.core<40?"#a65f5d":"#b8d4b0",Math.PI/6);
  circle(CORE.x,CORE.y,11,"#24494b","#d9ecd0",2);
  ctx.fillStyle="#192c32";ctx.fillRect(CORE.x-41,CORE.y+70,82,8);
  ctx.fillStyle=game.core<40?"#ea958b":"#a8dab0";
  ctx.fillRect(CORE.x-41,CORE.y+70,82*game.core/100,8);
  // Targetable enemy silhouettes with direct visual HP and frozen state.
  for(const e of game.enemies){
    if(e.dead)continue;
    circle(e.x,e.y,e.r+4,"#14232d9e");
    if(e.type==="dash")poly(e.x,e.y,e.r,3,e.fill,0);
    else if(e.type==="shell"||e.type==="boss")poly(e.x,e.y,e.r,6,e.fill,Math.PI/6);
    else poly(e.x,e.y,e.r,e.type==="pack"?5:4,e.fill,Math.PI/4);
    circle(e.x,e.y,e.r+1,"", "#2f3b42",2);
    if(e.cold>0)circle(e.x,e.y,e.r+7,"","#9de6f2",3);
    if(e.hp<e.maxHp){
      const w=Math.max(23,e.r*2.5);
      ctx.fillStyle="#182930";ctx.fillRect(e.x-w/2,e.y-e.r-14,w,4);
      ctx.fillStyle=e.armor?"#c6cadf":"#eec5a0";ctx.fillRect(e.x-w/2,e.y-e.r-14,w*Math.max(0,e.hp/e.maxHp),4);
    }
  }
  turretDraw("north",TURRETS.north);
  turretDraw("east",TURRETS.east);
  turretDraw("main",TURRETS.main);
  for(const projectile of game.bullets){
    const m=projectile.modules,bright=projectile.from==="main";
    const color=projectile.shard?"#f8bf96":m.includes("frost")?"#bce9f1":bright?"#f9e2b2":"#9ebdc0";
    ctx.strokeStyle=bright?color+"99":"#a6d3ce88";ctx.lineWidth=bright?5:2;
    ctx.beginPath();ctx.moveTo(projectile.px,projectile.py);ctx.lineTo(projectile.x,projectile.y);ctx.stroke();
    circle(projectile.x,projectile.y,projectile.shard?6:bright?8:4,color);
    if(bright)circle(projectile.x,projectile.y,projectile.shard?10:13,"",color+"66",2);
  }
  for(const fx of game.effects){
    const f=Math.max(0,fx.life/fx.max);ctx.globalAlpha=f;
    if(fx.kind==="blast"||fx.kind==="frost"){
      circle(fx.x,fx.y,fx.r*(.5+.5*(1-f)),fx.kind==="blast"?"#e8a87d33":"#a7e3ef38",
        fx.kind==="blast"?"#ffd2a2":"#bceff7",fx.kind==="blast"?5:4);
    }else if(fx.kind==="arc"){
      ctx.lineWidth=5;ctx.strokeStyle="#e0caff";
      ctx.beginPath();ctx.moveTo(fx.x,fx.y);ctx.lineTo(fx.x+11,fx.y-16);
      ctx.lineTo(fx.x2-11,fx.y2+10);ctx.lineTo(fx.x2,fx.y2);ctx.stroke();
    }else if(fx.kind==="pierce"){
      circle(fx.x,fx.y,10+(1-f)*25,"","#f9db9d",3);
    }else if(fx.kind==="launch"){
      circle(fx.x,fx.y,10+(1-f)*17,"","#fbc890",2);
    }else if(fx.kind==="breach"){circle(fx.x,fx.y,17+(1-f)*49,"#e9898170","#f6b0a0",5);}
    else if(fx.kind==="muzzle"){circle(fx.x,fx.y,15+(1-f)*16,"","#fff2c0",2);}
    else if(fx.kind==="kill"){circle(fx.x,fx.y,8+(1-f)*20,"","#f8d1a2",2);}
    else if(fx.kind==="hit"){circle(fx.x,fx.y,6+(1-f)*12,"","#fff1d8",2);}
    ctx.globalAlpha=1;
  }
  if(game.phase==="ready"){
    ctx.fillStyle="#123036b0";ctx.fillRect(25,HEIGHT-59,225,31);
    text(136,HEIGHT-38,"CHANGE → FIRE → COMPARE",12,"#b6e0c3");
  }
}
function frame(now){
  const dt=Math.max(0,Math.min(.05,(now-lastFrame)/1000));lastFrame=now;
  for(let i=0;i<game.speed;i++)game.step(dt);
  stepPreview(dt);
  draw();drawPreview();elapsedUI+=dt;
  if(elapsedUI>.11){update();elapsedUI=0;}
  requestAnimationFrame(frame);
}
stageNav();renderModules();update();requestAnimationFrame(frame);
