// SIGNAL DEFENSE — compact deterministic tower-defense simulation.
// No placement, equipment, chips, or resource management. One rule at first.
export const W=900,H=520;
export const TRACK=[
  {x:-28,y:152},{x:236,y:152},{x:324,y:262},
  {x:555,y:262},{x:668,y:353},{x:840,y:353}
];
export const CORE={x:840,y:353};
export const TOWERS=[
  {x:210,y:251,range:142,damage:21,interval:.92,name:"迎撃砲"},
  {x:460,y:142,range:147,damage:23,interval:1.2,name:"連装砲"},
  {x:745,y:244,range:153,damage:31,interval:1.36,name:"重砲"}
];
export const WHEN={
  pack:{label:"3体が集まったら",short:"集団"},
  armor:{label:"装甲の敵が来たら",short:"装甲"},
  danger:{label:"敵がゲートに迫ったら",short:"危険"},
  chilled:{label:"凍った敵がいたら",short:"凍結"}
};
export const THEN={
  freeze:{label:"まとめて凍らせる",short:"氷結",cost:32,cd:4.4},
  beam:{label:"貫通ビームを撃つ",short:"貫通",cost:43,cd:4.5},
  push:{label:"敵を押し戻す",short:"後退",cost:34,cd:4.2},
  chain:{label:"連鎖雷を放つ",short:"連鎖",cost:42,cd:4.4}
};
const ENEMY={
  grunt:{label:"歩行獣",hp:79,speed:46,armor:0,damage:12,size:10,color:"#dca078"},
  swift:{label:"俊足獣",hp:65,speed:76,armor:0,damage:10,size:8,color:"#f0c47d"},
  shell:{label:"装甲獣",hp:157,speed:33,armor:.50,damage:21,size:15,color:"#a3a8c6"},
  tiny:{label:"群体",hp:47,speed:56,armor:0,damage:7,size:7,color:"#b3c88b"},
  boss:{label:"巨装獣",hp:510,speed:27,armor:.34,damage:37,size:23,color:"#e68f8d"}
};
export const STAGES=[
  {name:"密集する群れ",hint:"群れが固まって押し寄せる。足止めが有効。",enemies:[
    ...Array.from({length:12},(_,i)=>({type:"grunt",at:i*.53}))]},
  {name:"足の速い敵",hint:"俊足獣が通常の敵を追い越す。門前で止めるか、先に倒すか。",enemies:[
    ...Array.from({length:14},(_,i)=>({type:i%3===0?"grunt":"swift",at:i*.58}))]},
  {name:"硬い装甲",hint:"装甲獣が混ざる。通常射撃の半分を防ぐ。",enemies:[
    ...Array.from({length:15},(_,i)=>({type:i%4===2?"shell":"grunt",at:i*.58}))]},
  {name:"凍結から連鎖へ",hint:"第2回路が解放。凍結した敵への連鎖雷を組んでみよう。",enemies:[
    ...Array.from({length:18},(_,i)=>({type:i%5===3?"shell":i%3===1?"swift":"tiny",at:i*.48}))]},
  {name:"最後の侵攻",hint:"装甲・俊足・群体・巨装獣が混ざる。回路の組み合わせが試される。",enemies:[
    ...Array.from({length:21},(_,i)=>({type:i===20?"boss":i%6===2?"shell":i%3===1?"swift":"grunt",at:i*.47}))]}
];
const lengths=TRACK.slice(1).map((p,i)=>Math.hypot(p.x-TRACK[i].x,p.y-TRACK[i].y));
const distanceTotal=lengths.reduce((a,b)=>a+b,0);
const d=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const clone=o=>JSON.parse(JSON.stringify(o));
export function atPath(pct){
  let left=clamp(pct,0,1)*distanceTotal;
  for(let i=0;i<lengths.length;i++){
    if(left<=lengths[i]||i===lengths.length-1){
      const a=TRACK[i],b=TRACK[i+1],t=clamp(left/lengths[i],0,1);
      return {x:a.x+(b.x-a.x)*t,y:a.y+(b.y-a.y)*t};
    }
    left-=lengths[i];
  }
  return {...TRACK.at(-1)};
}
export class Game{
  constructor(saved={}){
    const safe=(v,fallback)=>Number.isFinite(v)?v:fallback;
    this.profile={
      unlocked:clamp(Math.floor(safe(saved.unlocked,1)),1,5),
      best:saved.best&&typeof saved.best==="object"?clone(saved.best):{},
      last:saved.last&&typeof saved.last==="object"?clone(saved.last):{},
      currentStage:clamp(Math.floor(safe(saved.currentStage,1)),1,5),
      rules:Array.isArray(saved.rules)?saved.rules.slice(0,2).map(r=>({
        when:WHEN[r?.when]?r.when:"pack",then:THEN[r?.then]?r.then:"freeze"
      })):[{when:"pack",then:"freeze"},{when:"chilled",then:"chain"}]
    };
    while(this.profile.rules.length<2)this.profile.rules.push({when:"chilled",then:"chain"});
    this.stage=clamp(this.profile.currentStage,1,this.profile.unlocked);
    this.speed=3;
    this.reset();
  }
  twoRules(){return this.stage>=4;}
  availableWhen(){return Object.keys(WHEN).filter(x=>this.twoRules()||x!=="chilled");}
  availableThen(){return Object.keys(THEN).filter(x=>this.twoRules()||x!=="chain");}
  setRule(index,when,then){
    if(index<0||index>=(this.twoRules()?2:1)||
      !this.availableWhen().includes(when)||!this.availableThen().includes(then))return false;
    this.profile.rules[index]={when,then};return true;
  }
  swapRules(){
    if(!this.twoRules())return false;
    this.profile.rules.reverse();return true;
  }
  selectStage(stage){
    if(!Number.isInteger(stage)||stage<1||stage>this.profile.unlocked||stage>5)return false;
    this.stage=stage;this.profile.currentStage=stage;this.reset();return true;
  }
  reset(){
    this.phase="ready";this.time=0;this.hp=100;this.maxHp=100;
    this.charge=80;this.wait=0;this.spawnIndex=0;this.nextEnemyId=1;
    this.enemies=[];this.effects=[];
    this.turrets=TOWERS.map((t,i)=>({...t,id:i,wait:0,shots:0}));
    this.casts=0;this.intercepted=0;this.leaks=0;
    this.lastCast=null;this.ruleState=["条件待ち","条件待ち"];
    this.result=null;
  }
  start(){
    if(this.phase!=="ready")return false;
    this.phase="run";return true;
  }
  retry(){this.reset();}
  nextStage(){
    if(this.phase!=="result"||!this.result?.won||this.stage>=5)return false;
    this.stage++;this.profile.currentStage=this.stage;this.reset();return true;
  }
  setSpeed(s){if([1,3,5].includes(s))this.speed=s;}
  spawn(type){
    const eDef=ENEMY[type],point=atPath(0);
    const e={id:this.nextEnemyId++,type,progress:0,x:point.x,y:point.y,
      hp:eDef.hp,maxHp:eDef.hp,speed:eDef.speed,armor:eDef.armor,
      damage:eDef.damage,r:eDef.size,color:eDef.color,chill:0,dead:false};
    this.enemies.push(e);
    return e;
  }
  hit(e,raw,ignoreArmor=false){
    if(e.dead)return 0;
    const actual=raw*(ignoreArmor?1:1-e.armor);
    e.hp-=actual;
    this.effects.push({type:"impact",x:e.x,y:e.y,time:.16,max:.16});
    if(e.hp<=0){e.dead=true;this.intercepted++;this.effects.push({type:"kill",x:e.x,y:e.y,time:.4,max:.4});}
    return actual;
  }
  crowdSize(e){return this.enemies.filter(o=>!o.dead&&d(o,e)<=86).length;}
  sense(rule){
    const live=this.enemies.filter(e=>!e.dead&&e.progress>=.13);
    let matches=[];
    if(rule.when==="pack")matches=live.filter(e=>this.crowdSize(e)>=3&&e.chill<=.6);
    if(rule.when==="armor")matches=live.filter(e=>e.armor>.1);
    if(rule.when==="danger")matches=live.filter(e=>e.progress>=.76);
    if(rule.when==="chilled")matches=live.filter(e=>e.chill>0.7);
    matches.sort((a,b)=>b.progress-a.progress||a.id-b.id);
    return matches[0]||null;
  }
  findSignalTargets(target,r){
    return this.enemies.filter(e=>!e.dead&&d(e,target)<=r+e.r);
  }
  cast(rule,target,index){
    const skill=rule.then;
    const victims=this.findSignalTargets(target,92);
    let affected=0;
    if(skill==="freeze"){
      for(const e of victims){
        if(e.chill<1){
          e.chill=5.8;affected++;
        }
      }
      this.effects.push({type:"freeze",x:target.x,y:target.y,r:96,time:.72,max:.72});
    }else if(skill==="beam"){
      // Piercing follows the lane's local direction, including the curved sections.
      const foes=this.enemies.filter(e=>!e.dead&&Math.abs(e.progress-target.progress)<.038);
      for(const e of foes){this.hit(e,93,true);affected++;}
      this.effects.push({type:"beam",x:target.x,y:target.y,r:92,time:.48,max:.48});
    }else if(skill==="push"){
      for(const e of victims){
        e.progress=clamp(e.progress-.115,0,1);Object.assign(e,atPath(e.progress));affected++;
      }
      this.effects.push({type:"push",x:target.x,y:target.y,r:96,time:.62,max:.62});
    }else if(skill==="chain"){
      const struck=new Set(),candidates=this.enemies.filter(e=>!e.dead);
      let current=target,previous=null;
      for(let n=0;n<5&&current;n++){
        const chilled=current.chill>.5;
        const x=current.x,y=current.y;
        this.hit(current,chilled?92:45,false);
        current.chill=0;struck.add(current.id);affected++;
        if(previous)this.effects.push({type:"lightning",x:previous.x,y:previous.y,x2:x,y2:y,time:.4,max:.4});
        else this.effects.push({type:"lightning",x:x-55,y:y-100,x2:x,y2:y,time:.4,max:.4});
        previous={x,y};
        current=candidates.filter(e=>!e.dead&&!struck.has(e.id)&&d(e,previous)<130)
          .sort((a,b)=>d(a,previous)-d(b,previous))[0]||null;
      }
    }
    this.casts++;this.lastCast={skill,affected,rule:index+1,seconds:Math.round(this.time)};
    this.ruleState[index]="実行！ "+THEN[skill].short+" ×"+affected;
  }
  processRules(){
    const ruleCount=this.twoRules()?2:1;
    const sensors=[];
    for(let i=0;i<ruleCount;i++){
      const rule=this.profile.rules[i],target=this.sense(rule);
      sensors.push(target);
      this.ruleState[i]=target?"条件成立":"条件待ち";
    }
    if(this.wait>0)return;
    for(let i=0;i<ruleCount;i++){
      const rule=this.profile.rules[i],target=sensors[i];
      if(!target)continue;
      const skill=THEN[rule.then];
      if(this.charge<skill.cost){this.ruleState[i]="チャージ不足";continue;}
      this.charge-=skill.cost;this.wait=skill.cd;
      this.cast(rule,target,i);
      return;
    }
  }
  finish(){
    if(this.phase!=="run")return;
    this.phase="result";
    const won=this.hp>0;
    const prev=this.profile.last[this.stage]||null;
    this.result={won,hp:Math.ceil(this.hp),casts:this.casts,
      kills:this.intercepted,leaks:this.leaks,previousHp:prev?.hp??null};
    this.profile.last[this.stage]={...this.result};
    if(won){
      const best=this.profile.best[this.stage];
      if(!best||this.hp>best.hp)this.profile.best[this.stage]={hp:Math.ceil(this.hp),rules:clone(this.profile.rules),casts:this.casts};
      this.profile.unlocked=Math.max(this.profile.unlocked,Math.min(5,this.stage+1));
    }
  }
  step(dt){
    if(this.phase!=="run"||dt<=0)return;
    dt=Math.min(dt,.05);
    this.time+=dt;this.charge=clamp(this.charge+9*dt,0,80);
    this.wait=Math.max(0,this.wait-dt);
    const scripts=STAGES[this.stage-1].enemies;
    while(this.spawnIndex<scripts.length&&scripts[this.spawnIndex].at<=this.time){
      this.spawn(scripts[this.spawnIndex++].type);
    }
    for(const e of this.enemies){
      if(e.dead)continue;
      const slow=e.chill>0?.27:1;
      e.progress+=e.speed*slow*dt/distanceTotal;
      e.chill=Math.max(0,e.chill-dt);
      Object.assign(e,atPath(e.progress));
      if(e.progress>=1){
        e.dead=true;this.leaks++;this.hp=Math.max(0,this.hp-e.damage);
        this.effects.push({type:"breach",x:CORE.x,y:CORE.y,time:.55,max:.55});
      }
    }
    for(const t of this.turrets){
      t.wait=Math.max(0,t.wait-dt);
      if(t.wait>0)continue;
      const target=this.enemies.filter(e=>!e.dead&&d(e,t)<=t.range+e.r)
        .sort((a,b)=>b.progress-a.progress||a.id-b.id)[0];
      if(target){
        this.hit(target,t.damage);
        this.effects.push({type:"shot",x:t.x,y:t.y,x2:target.x,y2:target.y,time:.16,max:.16});
        t.shots++;t.wait=t.interval;
      }
    }
    this.processRules();
    this.enemies=this.enemies.filter(e=>!e.dead);
    this.effects=this.effects.filter(e=>(e.time-=dt)>0);
    if(this.hp<=0||(this.spawnIndex>=scripts.length&&!this.enemies.length))this.finish();
  }
  exportProfile(){return clone(this.profile);}
}
