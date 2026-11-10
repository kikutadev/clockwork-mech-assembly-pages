// CIRCUIT SIEGE — pure deterministic simulation for a programmable tower defense prototype.
// Art, costs and balance are experimental. No dependency on the Godot game's command catalog.
export const WIDTH=1000, HEIGHT=630;
export const PATHS=[
  [{x:-40,y:127},{x:140,y:127},{x:250,y:221},{x:404,y:221},{x:532,y:315},{x:681,y:315},{x:807,y:365},{x:920,y:315}],
  [{x:-40,y:505},{x:145,y:505},{x:256,y:408},{x:405,y:408},{x:532,y:315},{x:681,y:315},{x:807,y:365},{x:920,y:315}]
];
export const CORE={x:920,y:315};
export const PADS=[
  {x:177,y:238},{x:177,y:402},{x:357,y:107},{x:351,y:528},
  {x:474,y:314},{x:593,y:178},{x:609,y:462},{x:792,y:255}
];
export const CHASSIS={
  sentry:{name:"セントリー",price:75,range:159,rate:1,damage:1,energy:1,color:"#95cfbb",hint:"速く撃てる標準台"},
  relay:{name:"リレー",price:95,range:181,rate:1.13,damage:.86,energy:.78,color:"#8ec7e4",hint:"状態付与を省エネで回す"},
  lens:{name:"レンズ",price:125,range:227,rate:1.4,damage:1.32,energy:1.23,color:"#ecc591",hint:"長射程で強打・低速"}
};
export const CONDITIONS={
  any:{name:"敵が射程内"},
  crowd:{name:"密集した敵がいる"},
  armored:{name:"装甲を持つ敵"},
  swift:{name:"足の速い敵"},
  marked:{name:"標識のある敵"},
  chilled:{name:"冷却された敵"},
  nearCore:{name:"コアへ接近した敵"},
  wounded:{name:"HPが半分以下の敵"},
  coreHurt:{name:"コア耐久が70%未満"}
};
export const TARGETS={
  front:{name:"コアに近い順"},weak:{name:"HPが低い順"},
  armored:{name:"装甲が厚い順"},cluster:{name:"密集している順"},
  marked:{name:"標識がある順"},fast:{name:"速い順"}
};
export const SKILLS={
  bolt:{name:"ボルト",energy:0,cd:.64,damage:22,range:1,desc:"低燃費の単体射撃"},
  chill:{name:"凍結弾",energy:7,cd:1.25,damage:9,range:1,desc:"命中した敵を2.8秒減速"},
  blast:{name:"散弾爆破",energy:17,cd:1.85,damage:24,range:.95,desc:"半径58の複数敵を攻撃"},
  mark:{name:"弱点標識",energy:9,cd:1.4,damage:0,range:1.1,desc:"次の命中ダメージを1.8倍"},
  chain:{name:"連鎖電撃",energy:19,cd:2.3,damage:24,range:1,desc:"最大4体に連鎖。冷却中に過負荷"},
  shove:{name:"反動波",energy:14,cd:2.05,damage:7,range:.83,desc:"押し戻し。冷却中は効果2倍"},
  lance:{name:"貫通レール",energy:24,cd:3.1,damage:57,range:1.25,desc:"一直線上の敵を貫く・装甲に強い"},
  mend:{name:"補修パルス",energy:29,cd:4.8,damage:0,range:1,desc:"コア耐久を12回復する"},
  nova:{name:"過負荷ノヴァ",energy:38,cd:5.4,damage:58,range:.88,desc:"広範囲の爆発、冷却の敵に大ダメージ"}
};
export const UNLOCKS=[
  {kills:12,kind:"skill",id:"chain",name:"連鎖電撃",description:"冷却した敵から電撃を連鎖させる"},
  {kills:32,kind:"skill",id:"shove",name:"反動波",description:"侵入を押し戻す。冷却中は効果2倍"},
  {kills:70,kind:"skill",id:"lance",name:"貫通レール",description:"装甲と縦列へ高火力。レンズ台も解放"},
  {kills:130,kind:"skill",id:"mend",name:"補修パルス",description:"コアを回復する自動修復回路"},
  {kills:210,kind:"skill",id:"nova",name:"過負荷ノヴァ",description:"密集と冷却を利用した大爆発"}
];
const INITIAL_SKILLS=["bolt","chill","blast","mark"];
const ENEMIES={
  grunt:{name:"歩行獣",hp:56,speed:46,armor:0,damage:10,credit:9,r:11,color:"#d29676"},
  runner:{name:"斥候",hp:40,speed:76,armor:0,damage:8,credit:10,r:8,color:"#e0b473"},
  shell:{name:"甲殻",hp:136,speed:30,armor:.38,damage:18,credit:17,r:15,color:"#aa8ca1"},
  swarm:{name:"群体",hp:31,speed:63,armor:0,damage:5,credit:7,r:7,color:"#c7a47d"},
  boss:{name:"重装番人",hp:580,speed:28,armor:.28,damage:37,credit:80,r:24,color:"#d47c83"}
};
const copy=o=>JSON.parse(JSON.stringify(o));
const dist=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
function makePath(nodes){
  const lengths=nodes.slice(1).map((p,i)=>dist(p,nodes[i]));
  const total=lengths.reduce((a,b)=>a+b,0);
  return {nodes,lengths,total};
}
const PATH_DATA=PATHS.map(makePath);
export function pointOnPath(lane,progress){
  const data=PATH_DATA[lane],d=clamp(progress,0,1)*data.total;
  let walked=0;
  for(let i=0;i<data.lengths.length;i++){
    const len=data.lengths[i];
    if(d<=walked+len||i===data.lengths.length-1){
      const f=clamp((d-walked)/len,0,1);
      return {x:data.nodes[i].x+(data.nodes[i+1].x-data.nodes[i].x)*f,
        y:data.nodes[i].y+(data.nodes[i+1].y-data.nodes[i].y)*f};
    }
    walked+=len;
  }
  return {...CORE};
}
export const defaultRules=()=>[
  {condition:"crowd",skill:"blast",target:"cluster"},
  {condition:"any",skill:"bolt",target:"front"}
];
function scaledEnemy(type,wave,lane,id){
  const source=ENEMIES[type],hp=Math.round(source.hp*(1+.115*(wave-1)));
  return {id,type,lane,progress:0,x:0,y:0,hp,maxHp:hp,
    speed:source.speed*(1+.026*(wave-1)),armor:source.armor,damage:source.damage,
    credit:source.credit,r:source.r,color:source.color,mark:0,chill:0};
}
export function makeWave(wave){
  const size=Math.min(28,6+Math.floor(wave*1.65));
  const queue=[];
  for(let i=0;i<size;i++){
    let type="grunt";
    if(wave>=2 && i%3===1)type="runner";
    if(wave>=3 && i%5===2)type="shell";
    if(wave>=4 && i%4===3)type="swarm";
    if(wave%5===0 && i===size-1)type="boss";
    queue.push({type,lane:i%2,time:i*(wave>=4?.72:.89)});
  }
  return queue;
}
export class Game{
  constructor(profile={},random=Math.random){
    this.random=random;
    this.profile={
      totalKills:Math.max(0,Number(profile.totalKills)||0),
      bestWave:Math.max(0,Number(profile.bestWave)||0),
      presets:profile.presets&&typeof profile.presets==="object"?copy(profile.presets):{}
    };
    this.resetRun();
  }
  resetRun(){
    this.phase="prepare";
    this.wave=1;
    this.hp=110;this.maxHp=110;
    this.credits=250;this.energy=80;this.maxEnergy=80;
    this.elapsed=0;this.runKills=0;this.towers=[];
    this.enemies=[];this.effects=[];this.logs=["建設点をタップして砲台を置こう。準備できたら侵攻開始。"];
    this.spawnQueue=[];this.spawnClock=0;this.nextEnemyId=1;this.nextTowerId=1;
    this.paused=false;this.speed=1;this.notice=null;
    this.selectedPad=4;this.selectedTowerId=null;
  }
  log(s){this.logs.unshift(s);this.logs=this.logs.slice(0,5);}
  nextUnlock(){return UNLOCKS.find(u=>this.profile.totalKills<u.kills)||null;}
  unlockedSkills(){
    return Object.keys(SKILLS).filter(id=>INITIAL_SKILLS.includes(id)||
      UNLOCKS.some(u=>u.id===id&&this.profile.totalKills>=u.kills));
  }
  skillUnlocked(id){return this.unlockedSkills().includes(id);}
  chassisUnlocked(id){return id!=="lens"||this.profile.totalKills>=70;}
  towerAt(pad){return this.towers.find(t=>t.pad===pad)||null;}
  selectedTower(){return this.towers.find(t=>t.id===this.selectedTowerId)||null;}
  build(pad,chassis="sentry"){
    const ch=CHASSIS[chassis];
    if(!ch||!this.chassisUnlocked(chassis)||!PADS[pad]||
      this.towerAt(pad)||this.credits<ch.price||this.phase==="lost")return false;
    this.credits-=ch.price;
    const tower={id:this.nextTowerId++,pad,chassis,level:1,wait:0,last:"待機",
      activeRule:-1,activeTimer:0,shots:0,spent:ch.price,
      rules:this.profile.presets[chassis]?
        copy(this.profile.presets[chassis]):defaultRules()};
    this.towers.push(tower);
    this.selectedPad=pad;this.selectedTowerId=tower.id;
    this.log(ch.name+"を建設。回路を編集できます。");
    return true;
  }
  sell(id){
    const index=this.towers.findIndex(t=>t.id===id);
    if(index<0||this.phase==="lost")return false;
    const tower=this.towers[index];
    const refund=Math.round(tower.spent*.65);
    this.credits+=refund;
    this.towers.splice(index,1);
    this.selectedTowerId=null;this.selectedPad=tower.pad;
    this.log("砲台を回収。+"+refund+" CR");
    return true;
  }
  upgrade(id){
    const t=this.towers.find(t=>t.id===id);
    if(!t||t.level>=3||this.phase==="lost")return false;
    const cost=45+t.level*35;
    if(this.credits<cost)return false;
    this.credits-=cost;t.spent+=cost;t.level++;
    this.log("砲台を強化。Lv."+t.level);
    return true;
  }
  setRule(id,index,condition,skill,target){
    const t=this.towers.find(t=>t.id===id);
    if(!t||index<0||index>1||!CONDITIONS[condition]||
      !SKILLS[skill]||!TARGETS[target]||!this.skillUnlocked(skill)||
      this.phase==="lost")return false;
    t.rules[index]={condition,skill,target};
    this.profile.presets[t.chassis]=copy(t.rules);
    return true;
  }
  startWave(){
    if(this.phase!=="prepare")return false;
    if(this.towers.length===0)return false;
    this.phase="combat";this.paused=false;
    this.spawnQueue=makeWave(this.wave);this.spawnClock=0;
    this.log("第"+this.wave+"波 侵攻開始");
    return true;
  }
  togglePause(){
    if(this.phase!=="combat")return false;
    this.paused=!this.paused;return true;
  }
  setSpeed(speed){this.speed=speed===2?2:1;}
  spawn(type,lane){
    const e=scaledEnemy(type,this.wave,lane,this.nextEnemyId++);
    const pos=pointOnPath(lane,0);e.x=pos.x;e.y=pos.y;
    this.enemies.push(e);return e;
  }
  candidates(tower,skill){
    const pad=PADS[tower.pad],ch=CHASSIS[tower.chassis],range=ch.range*
      (1+(tower.level-1)*.065)*SKILLS[skill].range;
    return this.enemies.filter(e=>e.hp>0&&dist(e,pad)<=range+e.r);
  }
  conditionTargets(rule,candidates){
    if(rule.condition==="coreHurt")return this.hp/this.maxHp<.7?[null]:[];
    if(rule.condition==="any")return candidates;
    if(rule.condition==="crowd")
      return candidates.filter(e=>candidates.filter(o=>dist(o,e)<72).length>=3);
    if(rule.condition==="armored")return candidates.filter(e=>e.armor>0);
    if(rule.condition==="swift")return candidates.filter(e=>e.speed>61);
    if(rule.condition==="marked")return candidates.filter(e=>e.mark>0);
    if(rule.condition==="chilled")return candidates.filter(e=>e.chill>0);
    if(rule.condition==="nearCore")return candidates.filter(e=>e.progress>.7);
    if(rule.condition==="wounded")return candidates.filter(e=>e.hp/e.maxHp<.5);
    return [];
  }
  chooseTarget(eligible,strategy){
    if(eligible.length===1)return eligible[0];
    const score=e=>{
      if(strategy==="front")return e.progress*100;
      if(strategy==="weak")return (1-e.hp/e.maxHp)*100+(.001*e.progress);
      if(strategy==="armored")return e.armor*120+e.progress;
      if(strategy==="marked")return (e.mark>0?100:0)+e.progress;
      if(strategy==="fast")return e.speed+e.progress;
      if(strategy==="cluster")return eligible.filter(o=>dist(o,e)<72).length*20+e.progress;
      return e.progress;
    };
    return eligible.slice().sort((a,b)=>score(b)-score(a)||a.id-b.id)[0];
  }
  kill(e){
    if(e.hp>0||e.dead)return;
    e.dead=true;this.runKills++;this.profile.totalKills++;this.credits+=e.credit;
    this.effects.push({kind:"kill",x:e.x,y:e.y,life:.38,max:.38});
    const unlocked=UNLOCKS.find(u=>u.kills===this.profile.totalKills);
    if(unlocked){
      this.notice=unlocked;
      this.log("新しい回路が解放：「"+unlocked.name+"」");
    }
  }
  damage(e,amount,{ignoreArmor=false}={}){
    if(e.dead||e.hp<=0)return 0;
    let dealt=amount*(ignoreArmor?1:e.armor?1-e.armor:1);
    if(e.mark>0){dealt*=1.8;e.mark=0;this.effects.push({kind:"critical",x:e.x,y:e.y,life:.4,max:.4});}
    e.hp-=dealt;
    this.effects.push({kind:"hit",x:e.x,y:e.y,life:.15,max:.15});
    if(e.hp<=0)this.kill(e);
    return dealt;
  }
  cast(t,rule,target){
    const sk=SKILLS[rule.skill],ch=CHASSIS[t.chassis],pad=PADS[t.pad];
    const base=sk.damage*ch.damage*(1+.22*(t.level-1));
    const all=this.enemies.filter(e=>!e.dead&&e.hp>0);
    const hit=(e,amount,opts)=>this.damage(e,amount,opts);
    const explosion=(point,r,amount,kind="blast")=>{
      this.effects.push({kind,x:point.x,y:point.y,life:.43,max:.43,r});
      for(const e of all.filter(o=>dist(o,point)<r+o.r))hit(e,amount*(kind==="nova"&&e.chill>0?1.7:1));
    };
    switch(rule.skill){
      case "bolt": hit(target,base);break;
      case "chill":
        if(target.chill<1)target.chill=2.8;
        hit(target,base);break;
      case "mark":
        target.mark=4.8;
        this.effects.push({kind:"mark",x:target.x,y:target.y,life:.4,max:.4});
        break;
      case "blast":explosion(target,58,base);break;
      case "chain":{
        const visited=new Set(),victims=[];
        let current=target;
        while(current&&victims.length<4){
          visited.add(current.id);victims.push(current);
          const remaining=all.filter(e=>!visited.has(e.id)&&dist(e,current)<110);
          current=remaining.sort((a,b)=>dist(a,current)-dist(b,current))[0];
        }
        let last=pad;
        for(const [i,e] of victims.entries()){
          this.effects.push({kind:"beam",x:last.x,y:last.y,x2:e.x,y2:e.y,life:.22,max:.22});
          const cold=e.chill>0;
          const impact=base*(i===0?1:.7)*(cold?1.85:1);
          hit(e,impact);
          if(cold){
            explosion(e,33,base*.38,"overload");
            e.chill=0;
          }
          last=e;
        }
        break;
      }
      case "shove":{
        const cold=target.chill>0;
        const push=cold?.18:.095;
        target.progress=Math.max(0,target.progress-push);
        Object.assign(target,pointOnPath(target.lane,target.progress));
        hit(target,base);
        this.effects.push({kind:"push",x:target.x,y:target.y,life:.43,max:.43,r:48});
        break;
      }
      case "lance":{
        const dx=target.x-pad.x,dy=target.y-pad.y,len=Math.hypot(dx,dy)||1;
        const ux=dx/len,uy=dy/len;
        const victims=all.filter(e=>{
          const ex=e.x-pad.x,ey=e.y-pad.y;
          const along=ex*ux+ey*uy;
          return along>0&&along<Math.max(250,len+45)&&Math.abs(ex*uy-ey*ux)<e.r+14;
        });
        this.effects.push({kind:"beam",x:pad.x,y:pad.y,x2:pad.x+ux*290,y2:pad.y+uy*290,life:.26,max:.26,thick:true});
        for(const e of victims)hit(e,base,{ignoreArmor:true});
        break;
      }
      case "mend":
        this.hp=clamp(this.hp+12,0,this.maxHp);
        this.effects.push({kind:"heal",x:CORE.x,y:CORE.y,life:.55,max:.55,r:43});
        break;
      case "nova":
        explosion(target,94,base,"nova");
        break;
    }
    if(target&&rule.skill!=="chain"&&rule.skill!=="lance"&&rule.skill!=="mend"){
      this.effects.push({kind:"shot",x:pad.x,y:pad.y,x2:target.x,y2:target.y,life:.17,max:.17});
    }
    t.shots++;
    t.last=SKILLS[rule.skill].name+" 実行";
  }
  processTower(t){
    if(t.activeTimer<=0)t.activeRule=-1;
    if(t.wait>0){t.last="再装填 "+t.wait.toFixed(1)+"秒";return;}
    for(let i=0;i<t.rules.length;i++){
      const rule=t.rules[i],skill=SKILLS[rule.skill];
      if(!skill||!this.skillUnlocked(rule.skill))continue;
      if(rule.skill==="mend"&&rule.condition!=="coreHurt")continue;
      if(rule.condition==="coreHurt"&&rule.skill!=="mend")continue;
      const can=this.candidates(t,rule.skill);
      let eligible=this.conditionTargets(rule,can);
      // Applied statuses should unlock lower-priority attacks, not endlessly recast on the same foe.
      if(rule.skill==="mark")eligible=eligible.filter(e=>e&&e.mark<=0);
      if(rule.skill==="chill")eligible=eligible.filter(e=>e&&e.chill<=1);
      if(!eligible.length)continue;
      const cost=Math.ceil(skill.energy*CHASSIS[t.chassis].energy);
      if(this.energy<cost){t.last="EN不足 → 下位の命令を確認";continue;}
      const target=eligible[0]===null?null:this.chooseTarget(eligible,rule.target);
      this.energy-=cost;
      t.wait=skill.cd*CHASSIS[t.chassis].rate;
      t.activeRule=i;t.activeTimer=.45;
      this.cast(t,rule,target);
      return;
    }
    t.last="対象待ち";
  }
  step(dt){
    if(this.phase!=="combat"||this.paused||dt<=0)return;
    dt=Math.min(.05,dt);this.elapsed+=dt;this.spawnClock+=dt;
    this.energy=clamp(this.energy+dt*11,0,this.maxEnergy);
    while(this.spawnQueue.length&&this.spawnClock>=this.spawnQueue[0].time){
      const {type,lane}=this.spawnQueue.shift();this.spawn(type,lane);
    }
    // Move first. Each enemy progresses by path length, not straight-line distance to the gate.
    for(const e of this.enemies){
      if(e.dead)continue;
      const slow=e.chill>0?.47:1;
      e.progress+=e.speed*slow*dt/PATH_DATA[e.lane].total;
      e.chill=Math.max(0,e.chill-dt);e.mark=Math.max(0,e.mark-dt);
      Object.assign(e,pointOnPath(e.lane,e.progress));
      if(e.progress>=1){
        e.dead=true;
        this.hp=Math.max(0,this.hp-e.damage);
        this.effects.push({kind:"breach",x:CORE.x,y:CORE.y,life:.55,max:.55});
      }
    }
    for(const t of this.towers){
      t.wait=Math.max(0,t.wait-dt);
      t.activeTimer=Math.max(0,t.activeTimer-dt);
      this.processTower(t);
    }
    this.enemies=this.enemies.filter(e=>!e.dead);
    this.effects=this.effects.filter(e=>(e.life-=dt)>0);
    if(this.hp<=0){
      this.phase="lost";this.profile.bestWave=Math.max(this.profile.bestWave,this.wave-1);
      this.log("コア陥落。累計撃破と解放済み技は引き継がれます。");
      return;
    }
    if(!this.enemies.length&&!this.spawnQueue.length){
      const bonus=40+this.wave*13;
      this.credits+=bonus;
      this.profile.bestWave=Math.max(this.profile.bestWave,this.wave);
      this.log("第"+this.wave+"波を防衛！ +"+bonus+" CR");
      this.wave++;this.phase="prepare";this.energy=clamp(this.energy+26,0,this.maxEnergy);
    }
  }
  snapshot(){
    return {phase:this.phase,wave:this.wave,hp:this.hp,maxHp:this.maxHp,
      credits:this.credits,energy:this.energy,runKills:this.runKills,
      totalKills:this.profile.totalKills,bestWave:this.profile.bestWave,
      nextUnlock:this.nextUnlock(),remaining:this.spawnQueue.length+this.enemies.length};
  }
  exportProfile(){return copy(this.profile);}
}
