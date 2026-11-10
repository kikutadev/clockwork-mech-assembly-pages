// System-only prototype. SPEC.md is authoritative; all numeric balance values here are provisional.
export const CONDITIONS = [
  ["found", "敵を発見"],
  ["close", "敵が近すぎる"],
  ["gate", "敵が昇降口付近"],
  ["clear", "周囲に敵がいない"]
];
export const ACTIONS = [
  ["approach", "近づく"], ["retreat", "離れる"],
  ["return", "戻る"], ["hold", "停止"], ["shoot", "撃つ"]
];
export const PARTS = {
  weapon: [
    {id:"basic", name:"標準砲", owned:true, range:128, damage:28, interval:0.8, note:"標準的な射程と速さ"},
    {id:"long", name:"長砲身", owned:true, range:184, damage:38, interval:1.48, note:"遠くまで届くが連射が遅い"},
    {id:"rapid", name:"速射砲", cost:6, range:105, damage:15, interval:0.32, note:"短射程・低威力・高速射撃"}
  ],
  legs: [
    {id:"standard", name:"標準脚", owned:true, speed:72, note:"安定した標準速度"},
    {id:"swift", name:"機動脚", owned:true, speed:112, note:"高速で守備範囲を広げる"}
  ],
  sensor: [
    {id:"basic", name:"標準センサー", owned:true, detect:216, note:"近くの敵を認知する"},
    {id:"radar", name:"広域センサー", cost:5, detect:295, note:"遠距離の敵を早く認知"}
  ],
  armor: [
    {id:"basic", name:"軽量装甲", owned:true, hp:100, speedFactor:1, note:"速度を損なわない"},
    {id:"heavy", name:"重装甲", cost:5, hp:170, speedFactor:.77, note:"耐久増加・移動低下"}
  ]
};
// Temporary System Lab milestones: progressively widening kill intervals, NOT adopted SPEC values.
export const UNLOCKS = [
  {id:"return", kills:2, name:"自動帰還", detail:"「周囲に敵がいない→戻る／停止」と守備位置が使えます", tab:"command"},
  {id:"parts", kills:10, name:"武器・脚の換装", detail:"長砲身・機動脚を選べます", tab:"parts"},
  {id:"avoid", kills:24, name:"近接回避", detail:"「敵が近すぎる→離れる」を組めます", tab:"command"},
  {id:"gate", kills:46, name:"昇降口優先", detail:"「敵が昇降口付近」を条件にできます", tab:"command"},
  {id:"mines", kills:78, name:"防衛地雷", detail:"地雷の設置と封鎖扉の補強研究が使えます", tab:"team"},
  {id:"story", kills:122, name:"次の物語", detail:"格納庫から任意に次の敵帯へ進めます", tab:"research"},
  {id:"advancedParts", kills:180, name:"追加パーツ", detail:"センサー・装甲の換装と部品製造ができます", tab:"parts"},
  {id:"turret", kills:256, name:"自動砲台", detail:"砲台の配置と建設資源拡張研究が使えます", tab:"team"}
];
const CONDITION_UNLOCK = {clear:"return", close:"avoid", gate:"gate"};
const ACTION_UNLOCK = {return:"return", hold:"return", retreat:"avoid"};
export const RESEARCH = [
  {id:"fire", name:"火力解析", cost:9, description:"自機の武器ダメージ +25%"},
  {id:"gate", name:"封鎖扉補強", cost:10, description:"封鎖扉の最大耐久 +50"},
  {id:"build", name:"建設資源拡張", cost:10, description:"建設資源の上限 +2"}
];
const INIT_SAVE = {
  data:3, material:4, totalKills:0, tier:1,
  slots:[{condition:"found", action:"approach"}, {condition:"found", action:"shoot"}],
  installed:{weapon:"basic", legs:"standard", sensor:"basic", armor:"basic"},
  owned:["basic:weapon","long:weapon","standard:legs","swift:legs","basic:sensor","basic:armor"],
  research:[], facilities:{turret:false,mineW:false,mineE:false},
  home:{x:570,y:325}
};
export const W=900, H=560;
export const GATE={x:470,y:280,r:42};
const ENEMY_TYPES={
  crawler:{hp:63,speed:18,damage:13,r:12},
  swift:{hp:45,speed:27,damage:10,r:9},
  armored:{hp:126,speed:13,damage:19,r:16}
};
const clone=obj=>JSON.parse(JSON.stringify(obj));
const dist=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
const norm=(a,b)=>{const d=dist(a,b)||1;return {x:(b.x-a.x)/d,y:(b.y-a.y)/d};};
export const validPair=(condition,action)=>condition!=="clear"||action==="return"||action==="hold";

export class Game {
  constructor(saved={}, random=Math.random) {
    this.random=random;
    this.save=clone(INIT_SAVE);
    if(saved && typeof saved==="object"){
      for(const key of Object.keys(INIT_SAVE)){
        if(Object.prototype.hasOwnProperty.call(saved,key)) this.save[key]=clone(saved[key]);
      }
    }
    this.normalizeSave();
    this.resetBattle();
  }
  normalizeSave(){
    const s=this.save;
    s.data=Number.isFinite(s.data)?Math.max(0,s.data):3;
    s.material=Number.isFinite(s.material)?Math.max(0,s.material):4;
    s.totalKills=Number.isFinite(s.totalKills)?Math.max(0,s.totalKills):0;
    s.tier=s.tier===2?2:1;
    if(!Array.isArray(s.slots)||s.slots.length!==2) s.slots=clone(INIT_SAVE.slots);
    s.slots=s.slots.map((v,i)=>({
      condition:CONDITIONS.some(c=>c[0]===v?.condition)?v.condition:INIT_SAVE.slots[i].condition,
      action:ACTIONS.some(a=>a[0]===v?.action)?v.action:INIT_SAVE.slots[i].action
    }));
    if(!Array.isArray(s.owned))s.owned=clone(INIT_SAVE.owned);
    if(!Array.isArray(s.research))s.research=[];
    if(!s.facilities||typeof s.facilities!=="object")s.facilities=clone(INIT_SAVE.facilities);
    for(const slot of Object.keys(INIT_SAVE.installed)){
      if(!PARTS[slot].some(p=>p.id===s.installed?.[slot])) {
        if(!s.installed)s.installed={};
        s.installed[slot]=INIT_SAVE.installed[slot];
      }
    }
    if(!s.home||!Number.isFinite(s.home.x)||!Number.isFinite(s.home.y))s.home=clone(INIT_SAVE.home);
  }
  unlockAt(id){return UNLOCKS.find(u=>u.id===id)?.kills||0;}
  isUnlocked(id){return this.save.totalKills>=this.unlockAt(id);}
  nextUnlock(){return UNLOCKS.find(u=>!this.isUnlocked(u.id))||null;}
  canCondition(id){return CONDITIONS.some(c=>c[0]===id)&&this.isUnlocked(CONDITION_UNLOCK[id]);}
  canAction(id){return ACTIONS.some(a=>a[0]===id)&&this.isUnlocked(ACTION_UNLOCK[id]);}
  canEquip(slot){return this.isUnlocked(["weapon","legs"].includes(slot)?"parts":"advancedParts");}
  canResearch(id){return id==="fire"||id==="gate"&&this.isUnlocked("mines")||id==="build"&&this.isUnlocked("turret");}
  canFacility(id){return id==="turret"?this.isUnlocked("turret"):this.isUnlocked("mines");}
  part(slot){return PARTS[slot].find(p=>p.id===this.save.installed[slot]);}
  stats(){
    const gun=this.part("weapon"),legs=this.part("legs"),sensor=this.part("sensor"),armor=this.part("armor");
    return {
      range:gun.range, interval:gun.interval,
      damage:Math.round(gun.damage*(this.save.research.includes("fire")?1.25:1)),
      speed:legs.speed*armor.speedFactor, detect:sensor.detect,
      hp:armor.hp, gateHp:180+(this.save.research.includes("gate")?50:0),
      budget:2+(this.save.research.includes("build")?2:0)
    };
  }
  resetBattle(){
    const st=this.stats();
    this.time=0;
    this.kills=0;
    this.spawnIn=0.8;
    this.nextId=1;
    this.enemies=[];
    this.bullets=[];
    this.effects=[];
    this.robot={x:this.save.home.x,y:this.save.home.y,hp:st.hp, maxHp:st.hp, manual:null,selected:false};
    this.gateHP=st.gateHp;
    this.weaponWait=0;
    this.turretWait=0;
    this.locks={};
    this.unlockNotice=null;
    this.active=[{text:"判定待ち",active:false},{text:"判定待ち",active:false}];
    this.used={move:null,weapon:null};
    this.logs=["新たな防衛。命令は登録された2件のみ実行します。"];
    this.paused=false;
    this.defeated=false;
    this.lastAction="防衛開始";
  }
  log(message){
    this.logs.unshift(message);
    this.logs=this.logs.slice(0,5);
    this.lastAction=message;
  }
  updateCommand(i,condition,action){
    if(!this.save.slots[i]||!this.canCondition(condition)||!this.canAction(action))return false;
    this.save.slots[i]={condition,action};
    return true;
  }
  selectAt(x,y,hitRadius=30){
    if(this.paused||this.defeated)return false;
    if(dist(this.robot,{x,y})<hitRadius){
      this.robot.selected=true;this.log("機体を選択。移動先の地面を指定できます。");return true;
    }
    if(this.robot.selected){
      this.robot.manual={x:Math.min(W-16,Math.max(16,x)),y:Math.min(H-16,Math.max(16,y))};
      this.robot.selected=false;
      this.log("直接移動を指示。射撃コマンドは継続します。");
      return true;
    }
    return false;
  }
  setHome(x,y){
    if(!this.paused||!this.isUnlocked("return"))return false;
    const d=dist({x,y},GATE);
    if(d<65||x<60||x>W-60||y<45||y>H-45)return false;
    this.save.home={x,y};
    return true;
  }
  openHangar(){
    if(this.defeated)return false;
    this.paused=true;this.robot.selected=false;
    return true;
  }
  closeHangar(){this.paused=false;}
  equip(slot,id){
    if(!this.paused||!this.canEquip(slot))return false;
    if(!PARTS[slot]?.some(p=>p.id===id))return false;
    if(!this.save.owned.includes(id+":"+slot))return false;
    const hpRatio=this.robot.hp/this.robot.maxHp;
    this.save.installed[slot]=id;
    this.robot.maxHp=this.stats().hp;
    this.robot.hp=Math.max(0,Math.min(this.robot.maxHp,this.robot.maxHp*hpRatio));
    this.gateHP=Math.min(this.gateHP,this.stats().gateHp);
    return true;
  }
  craft(slot,id){
    if(!this.paused)return false;
    const p=PARTS[slot]?.find(p=>p.id===id);
    if(!p||!this.isUnlocked("advancedParts")||!this.canEquip(slot)||
      !p.cost||this.save.owned.includes(id+":"+slot)||this.save.material<p.cost)return false;
    this.save.material-=p.cost;
    this.save.owned.push(id+":"+slot);
    this.log(p.name+" を製造しました。");
    return true;
  }
  research(id){
    if(!this.paused)return false;
    const r=RESEARCH.find(r=>r.id===id);
    if(!r||!this.canResearch(id)||this.save.research.includes(id)||this.save.data<r.cost)return false;
    this.save.data-=r.cost;
    this.save.research.push(id);
    if(id==="gate")this.gateHP+=50;
    this.log(r.name+" 完了");
    return true;
  }
  capacityUsed(){
    return (this.save.facilities.turret?2:0)+(this.save.facilities.mineW?1:0)+(this.save.facilities.mineE?1:0);
  }
  toggleFacility(id){
    if(!this.paused||!["turret","mineW","mineE"].includes(id)||!this.canFacility(id))return false;
    if(!this.save.facilities[id]){
      const cost=id==="turret"?2:1;
      if(this.capacityUsed()+cost>this.stats().budget)return false;
    }
    this.save.facilities[id]=!this.save.facilities[id];
    return true;
  }
  advanceStory(){
    if(!this.paused||this.save.tier!==1||!this.isUnlocked("story"))return false;
    this.save.tier=2;
    this.log("物語が進行。新しい敵と侵攻方向が加わりました。");
    return true;
  }
  isRecognized(e){
    return !e.dead&&dist(this.robot,e)<=this.stats().detect;
  }
  candidates(condition){
    const visible=this.enemies.filter(e=>this.isRecognized(e));
    if(condition==="clear")return {match:visible.length===0,targets:[]};
    let arr=visible;
    if(condition==="close")arr=visible.filter(e=>dist(this.robot,e)<=64);
    if(condition==="gate")arr=visible.filter(e=>dist(e,GATE)<=135);
    arr=arr.slice().sort((a,b)=>{
      const da=condition==="gate"?dist(a,GATE):dist(a,this.robot);
      const db=condition==="gate"?dist(b,GATE):dist(b,this.robot);
      return da-db||a.id-b.id;
    });
    return {match:arr.length>0,targets:arr};
  }
  evaluate(){
    const slots=this.save.slots;
    const statuses=slots.map(()=>({text:"条件不成立",active:false}));
    const used={move:null,weapon:null};
    const movement={action:null,target:null};
    let shotTarget=null;
    slots.forEach((cmd,i)=>{
      if(!this.canCondition(cmd.condition)||!this.canAction(cmd.action)){
        statuses[i]={text:"機能の解放待ち",active:false};return;
      }
      if(!validPair(cmd.condition,cmd.action)){statuses[i]={text:"無効な組合せ",active:false};return;}
      const match=this.candidates(cmd.condition);
      if(!match.match){delete this.locks[i];return;}
      const isGun=cmd.action==="shoot",device=isGun?"weapon":"move";
      if(used[device]!==null){statuses[i]={text:"上位が装置を使用中",active:false};return;}
      if(isGun){
        const reachable=match.targets.filter(e=>dist(this.robot,e)<=this.stats().range);
        if(!reachable.length){delete this.locks[i];statuses[i]={text:"射程外（自動接近なし）",active:false};return;}
        const target=reachable.find(e=>e.id===this.locks?.[i])||reachable[0];
        this.locks[i]=target.id;
        used.weapon=i;
        shotTarget=target;
        statuses[i]={text:this.weaponWait>0?"装填中":"射撃中",active:true};
      }else{
        used.move=i;
        const target=cmd.action==="return"?this.save.home:(match.targets.find(e=>e.id===this.locks[i])||match.targets[0]||null);
        if(target&&cmd.action!=="return")this.locks[i]=target.id;
        movement.action=cmd.action;
        movement.target=target;
        const d=target?dist(this.robot,target):0;
        const reach=this.stats().range*.92;
        let message="実行中";
        if(cmd.action==="hold")message="停止中";
        else if(cmd.action==="return"&&d<5)message="帰還済";
        else if(cmd.action==="approach"&&d<=reach)message="射程内で停止";
        else if(cmd.action==="retreat"&&d>=90)message="退避済";
        statuses[i]={text:message,active:true};
      }
    });
    if(this.robot.manual){
      if(used.move!==null)statuses[used.move]={text:"手動移動を優先中",active:false};
      used.move=null;
    }
    this.active=statuses;
    this.used=used;
    return {movement,shotTarget};
  }
  moveToward(target,speed,dt){
    const d=dist(this.robot,target);
    if(d<.001)return;
    const amt=Math.min(d,speed*dt);
    const dir=norm(this.robot,target);
    this.robot.x+=dir.x*amt;this.robot.y+=dir.y*amt;
  }
  fire(origin,target,damage,fromTurret=false){
    this.bullets.push({x:origin.x,y:origin.y,targetId:target.id,damage,speed:470,fromTurret});
    this.effects.push({type:"muzzle",x:origin.x,y:origin.y,life:.13});
  }
  kill(e){
    if(e.dead)return;
    e.dead=true;this.kills++;this.save.totalKills++;
    this.save.data++;
    if(this.save.totalKills%2===0)this.save.material++;
    const unlocked=UNLOCKS.find(u=>u.kills===this.save.totalKills);
    if(unlocked){
      this.unlockNotice=unlocked;
      this.log("新機能「"+unlocked.name+"」が解放！");
    }
    this.effects.push({type:"kill",x:e.x,y:e.y,life:.45});
    if(this.kills===1&&!unlocked)this.log("敵を撃破。解析データを獲得しました。");
  }
  spawn(){
    if(this.enemies.filter(e=>!e.dead).length>=12)return;
    const tier=this.save.tier;
    const n=this.nextId++;
    const kind=tier===1?"crawler":n%5===0?"armored":n%3===0?"swift":"crawler";
    const edge=tier===1?0:(n%4);
    const pad=27, random=this.random;
    let x=100,y=H*(.24+random()*.52);
    if(n===1&&tier===1){x=350;y=310;}
    if(edge===1){x=W-pad;y=H*(.22+random()*.56);}
    if(edge===2){x=W*(.25+random()*.5);y=pad;}
    if(edge===3){x=W*(.25+random()*.5);y=H-pad;}
    this.enemies.push({id:n,kind,x,y,hp:ENEMY_TYPES[kind].hp,
      maxHp:ENEMY_TYPES[kind].hp,attackWait:0,dead:false});
  }
  defeat(){
    if(this.defeated)return;
    this.defeated=true;
    this.save.data+=6;
    this.save.material+=4;
    this.log("封鎖扉が破壊。解析データ +6、強化素材 +4 を回収。");
  }
  step(dt){
    if(this.paused||this.defeated||dt<=0)return;
    dt=Math.min(dt,.05);
    this.time+=dt;
    this.weaponWait=Math.max(0,this.weaponWait-dt);
    this.turretWait=Math.max(0,this.turretWait-dt);
    this.spawnIn-=dt;
    if(this.spawnIn<=0){
      this.spawn();
      this.spawnIn+=(this.save.tier===1?4.75:3.6)+this.random()*1.3;
    }
    // Enemies move continuously toward the gate. No wave victory/reset.
    for(const e of this.enemies){
      if(e.dead)continue;
      const enemy=ENEMY_TYPES[e.kind], d=dist(e,GATE);
      if(d>GATE.r+ENEMY_TYPES[e.kind].r+5){
        const v=norm(e,GATE);e.x+=v.x*enemy.speed*dt;e.y+=v.y*enemy.speed*dt;
      } else{
        e.attackWait-=dt;
        if(e.attackWait<=0){this.gateHP=Math.max(0,this.gateHP-enemy.damage);e.attackWait=1.4;}
      }
      if(dist(e,this.robot)<e.kind.length*.2+13 && this.robot.hp>0){
        this.robot.hp=Math.max(0,this.robot.hp-7*dt);
      }
    }
    if(this.robot.hp>0){
      const {movement,shotTarget}=this.evaluate();
      if(this.robot.manual){
        this.moveToward(this.robot.manual,this.stats().speed,dt);
        if(dist(this.robot,this.robot.manual)<3){this.robot.manual=null;this.log("指定地点へ到着。コマンドへ復帰。");}
      }else if(movement.target){
        const d=dist(this.robot,movement.target);
        if(movement.action==="approach" && d>this.stats().range*.92){
          this.moveToward(movement.target,this.stats().speed,dt);
        }else if(movement.action==="retreat" && d<90){
          const away=norm(movement.target,this.robot);
          const goal={x:Math.max(15,Math.min(W-15,this.robot.x+away.x*120)),
            y:Math.max(15,Math.min(H-15,this.robot.y+away.y*120))};
          this.moveToward(goal,this.stats().speed,dt);
        }else if(movement.action==="return"&&d>4){
          this.moveToward(movement.target,this.stats().speed,dt);
        }
      }
      if(shotTarget&&this.weaponWait<=0){
        this.fire(this.robot,shotTarget,this.stats().damage);
        this.weaponWait=this.stats().interval;
      }
    } else {
      this.active=this.active.map(()=>({text:"機体停止",active:false}));
      this.used={move:null,weapon:null};
    }
    if(this.canFacility("turret")&&this.save.facilities.turret&&this.turretWait<=0){
      const origin={x:GATE.x+72,y:GATE.y-42};
      const tgt=this.enemies.filter(e=>!e.dead&&dist(e,origin)<=152)
        .sort((a,b)=>dist(a,GATE)-dist(b,GATE)||a.id-b.id)[0];
      if(tgt){this.fire(origin,tgt,22,true);this.turretWait=1.4;}
    }
    for(const id of ["mineW","mineE"]){
      if(!this.canFacility(id)||!this.save.facilities[id])continue;
      const p=id==="mineW"?{x:GATE.x-98,y:GATE.y+35}:{x:GATE.x+95,y:GATE.y+35};
      const targets=this.enemies.filter(e=>!e.dead&&dist(e,p)<30);
      if(targets.length){
        targets.forEach(e=>{e.hp-=75;if(e.hp<=0)this.kill(e);});
        this.save.facilities[id]=false;
        this.effects.push({type:"mine",x:p.x,y:p.y,life:.7});
        this.log("地雷が作動。施設は消費されました。");
      }
    }
    for(const b of this.bullets){
      const target=this.enemies.find(e=>e.id===b.targetId&&!e.dead);
      if(!target){b.dead=true;continue;}
      const d=dist(b,target);
      if(d<Math.max(10,ENEMY_TYPES[target.kind].r)){
        b.dead=true;target.hp-=b.damage;
        this.effects.push({type:"hit",x:target.x,y:target.y,life:.15});
        if(target.hp<=0)this.kill(target);
      } else {
        const v=norm(b,target), travel=Math.min(d,b.speed*dt);
        b.x+=v.x*travel;b.y+=v.y*travel;
      }
    }
    this.enemies=this.enemies.filter(e=>!e.dead);
    this.bullets=this.bullets.filter(b=>!b.dead);
    this.effects=this.effects.filter(e=>(e.life-=dt)>0);
    if(this.gateHP<=0)this.defeat();
  }
  snapshot(){
    return {time:this.time,kills:this.kills,totalKills:this.save.totalKills,
      data:this.save.data,material:this.save.material,gateHP:this.gateHP,
      paused:this.paused,defeated:this.defeated,enemyCount:this.enemies.length,
      active:this.active,used:this.used,tier:this.save.tier,stats:this.stats()};
  }
  exportSave(){return clone(this.save);}
}
