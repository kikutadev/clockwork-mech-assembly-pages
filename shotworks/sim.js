// SHOTWORKS — fixed-lane defense. Modules execute left → right when a projectile hits.
// There are no hidden upgrade stats, firing conditions or random encounter rolls.
export const WIDTH=1000,HEIGHT=600;
export const CORE={x:930,y:328};
export const TURRETS={
  main:{x:492,y:322,range:272,damage:24,interval:1.0},
  north:{x:263,y:117,range:173,damage:8,interval:1.38},
  east:{x:766,y:420,range:180,damage:10,interval:1.32}
};
export const LANES=[
  [{x:-42,y:155},{x:165,y:155},{x:296,y:240},{x:456,y:240},{x:648,y:323},{x:930,y:328}],
  [{x:-42,y:480},{x:172,y:480},{x:300,y:405},{x:456,y:405},{x:648,y:323},{x:930,y:328}]
];
const length=(a,b)=>Math.hypot(b.x-a.x,b.y-a.y);
const routes=LANES.map(points=>({points,lengths:points.slice(1).map((p,i)=>length(p,points[i]))}));
routes.forEach(r=>r.total=r.lengths.reduce((a,b)=>a+b,0));
export const MODULES={
  split:{name:"分裂",icon:"✣",short:"命中すると2発に分かれる",accent:"#ffc991"},
  blast:{name:"爆発",icon:"✺",short:"命中地点の周囲にも当たる",accent:"#f4ad91"},
  pierce:{name:"貫通",icon:"➤",short:"後ろの敵まで弾が通る",accent:"#f5db9e"},
  frost:{name:"冷却",icon:"❄",short:"敵の進む速さを落とす",accent:"#99def2"},
  arc:{name:"電撃",icon:"ϟ",short:"近くの敵へ連鎖する",accent:"#c7b4ff"}
};
const TYPES={
  bug:{hp:63,speed:47,armor:0,core:9,r:13,fill:"#c58767",name:"歩行獣"},
  dash:{hp:48,speed:75,armor:0,core:7,r:10,fill:"#e5be72",name:"俊足獣"},
  shell:{hp:130,speed:34,armor:.45,core:17,r:18,fill:"#a3a8bd",name:"装甲獣"},
  pack:{hp:35,speed:55,armor:0,core:6,r:9,fill:"#c5a875",name:"群体"},
  boss:{hp:410,speed:28,armor:.28,core:38,r:25,fill:"#c67e7c",name:"巨獣"}
};
export const WAVES=[
  {name:"後ろに続く群れ",hint:"1発で1体倒しても、後続が抜けてしまう。弾を増やせない？",
   enemies:Array.from({length:13},(_,i)=>({at:i*.65,type:i%5===3?"pack":"bug",lane:i%3===0?1:0}))},
  {name:"装甲と高速獣",hint:"速い敵を止めたい。装甲をまとめて抜ける攻撃は作れる？",
   enemies:Array.from({length:17},(_,i)=>({at:i*.64,type:i%5===2?"shell":i%3===1?"dash":"bug",lane:i%2}))},
  {name:"二方向のラッシュ",hint:"冷却させた敵から電撃を飛ばせば、連携攻撃になるかも。",
   enemies:Array.from({length:23},(_,i)=>({at:i*.52,type:i%3===1?"shell":i%5===2?"dash":"pack",lane:i%2}))},
  {name:"最後の突破",hint:"両方向から装甲・群体・巨獣。自分の弾で守り切ろう。",
   enemies:Array.from({length:27},(_,i)=>({at:i*.53,type:i===26?"boss":i%6===3?"shell":i%4===1?"dash":"bug",lane:i%2}))}
];
const clamp=(v,min,max)=>Math.max(min,Math.min(max,v));
const dist=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
const clone=o=>JSON.parse(JSON.stringify(o));
export function pointAt(lane,pct){
  const r=routes[lane],pathDist=clamp(pct,0,1)*r.total;
  let walked=0;
  for(let i=0;i<r.lengths.length;i++){
    const len=r.lengths[i],t=clamp((pathDist-walked)/len,0,1);
    if(pathDist<=walked+len||i===r.lengths.length-1){
      const a=r.points[i],b=r.points[i+1];
      return {x:a.x+(b.x-a.x)*t,y:a.y+(b.y-a.y)*t};
    }
    walked+=len;
  }
  return {...CORE};
}
function normalizeProfile(saved){
  const cleared=Number.isFinite(saved.completed)?clamp(Math.floor(saved.completed),0,WAVES.length):0;
  const unlocked=cleared>=2?["split","blast","pierce","frost","arc"]:cleared>=1?["split","blast","pierce","frost"]:["split","blast","pierce"];
  const loadout=(Array.isArray(saved.loadout)?saved.loadout:[null,null]).slice(0,2).map(id=>unlocked.includes(id)?id:null);
  while(loadout.length<2)loadout.push(null);
  return {completed:cleared,loadout,
    selectedWave:clamp(Number.isInteger(saved.selectedWave)?saved.selectedWave:1,1,Math.min(WAVES.length,cleared+1)),
    results:typeof saved.results==="object"&&saved.results?clone(saved.results):{}};
}
export class Game{
  constructor(saved={}){
    this.profile=normalizeProfile(saved);
    this.wave=this.profile.selectedWave;
    this.speed=1;
    this.resetWave();
  }
  available(){return Object.keys(MODULES).filter(id=>this.isUnlocked(id));}
  isUnlocked(id){return id in MODULES&&(id==="frost"?this.profile.completed>=1:id==="arc"?this.profile.completed>=2:true);}
  setModule(index,id){
    if(![0,1].includes(index)||!(id===null||this.isUnlocked(id)))return false;
    this.profile.loadout[index]=id;
    return true;
  }
  swap(){
    this.profile.loadout.reverse();
  }
  resetWave(){
    this.phase="ready";this.time=0;this.core=100;this.enemies=[];this.bullets=[];this.effects=[];
    this.spawnIndex=0;this.nextEnemy=1;this.nextBullet=1;this.kills=0;this.escapes=0;
    this.metrics={mainShots:0,extraBullets:0,blastHits:0,pierces:0,arcHits:0,slows:0,impacts:0};
    this.timers={main:0,north:0,east:0};this.usedLoadouts=new Set();
    this.lastEffect=null;this.result=null;
  }
  selectWave(wave){
    if(!Number.isInteger(wave)||wave<1||wave>Math.min(WAVES.length,this.profile.completed+1))return false;
    this.wave=wave;this.profile.selectedWave=wave;this.resetWave();return true;
  }
  start(){
    if(this.phase!=="ready")return false;
    this.phase="run";return true;
  }
  retry(){this.resetWave();}
  nextWave(){
    if(this.phase!=="result"||!this.result?.won||this.wave>=WAVES.length)return false;
    this.wave++;this.profile.selectedWave=this.wave;this.resetWave();return true;
  }
  setSpeed(v){this.speed=[1,2,5].includes(v)?v:1;}
  spawn(d){
    const def=TYPES[d.type],p=pointAt(d.lane,0);
    const e={id:this.nextEnemy++,type:d.type,lane:d.lane,progress:0,...p,
      hp:def.hp,maxHp:def.hp,speed:def.speed,armor:def.armor,coreDamage:def.core,r:def.r,
      fill:def.fill,cold:0,dead:false};
    this.enemies.push(e);return e;
  }
  live(){return this.enemies.filter(e=>!e.dead);}
  hit(enemy,damage,{ignoreArmor=false}={}){
    if(!enemy||enemy.dead)return 0;
    const dealt=damage*(ignoreArmor?1:1-enemy.armor);
    enemy.hp-=dealt;this.metrics.impacts++;
    this.effects.push({kind:"hit",x:enemy.x,y:enemy.y,life:.24,max:.24});
    if(enemy.hp<=0){
      enemy.dead=true;this.kills++;
      this.effects.push({kind:"kill",x:enemy.x,y:enemy.y,life:.42,max:.42});
    }
    return dealt;
  }
  pick(turret){
    return this.live().filter(e=>dist(e,turret)<=turret.range+e.r)
      .sort((a,b)=>b.progress-a.progress||a.id-b.id)[0]||null;
  }
  fire(turretId){
    const turret=TURRETS[turretId],target=this.pick(turret);
    if(!target)return false;
    const main=turretId==="main";
    const bullet={id:this.nextBullet++,from:turretId,x:turret.x,y:turret.y,px:turret.x,py:turret.y,
      targetId:target.id,damage:turret.damage,modules:main?this.profile.loadout.filter(Boolean):[],
      speed:main?495:410,shard:false,depth:0,hitIds:[]};
    this.bullets.push(bullet);
    this.timers[turretId]=turret.interval;
    if(main){this.metrics.mainShots++;this.usedLoadouts.add(JSON.stringify(bullet.modules));}
    this.effects.push({kind:"muzzle",x:turret.x,y:turret.y,life:.2,max:.2});
    return true;
  }
  spawnExtra(source,target,damage,remaining,kind){
    if(!target||source.depth>=2||this.bullets.length>70)return false;
    this.bullets.push({id:this.nextBullet++,from:"main",x:source.x,y:source.y,
      px:source.x,py:source.y,targetId:target.id,damage,modules:remaining.slice(),speed:570,
      shard:kind==="split",depth:source.depth+1,hitIds:[...source.hitIds,source.targetId]});
    this.metrics.extraBullets++;
    this.effects.push({kind:"launch",x:source.x,y:source.y,life:.28,max:.28});
    return true;
  }
  impact(bullet,enemy){
    // The physical bullet already hit one victim. Left-to-right module processing is real.
    bullet.x=enemy.x;bullet.y=enemy.y;
    this.hit(enemy,bullet.damage,{ignoreArmor:bullet.modules.includes("pierce")});
    bullet.hitIds.push(enemy.id);
    const enemies=this.live();
    for(let i=0;i<bullet.modules.length;i++){
      const id=bullet.modules[i],later=bullet.modules.slice(i+1);
      if(id==="split"){
        const others=this.live().filter(e=>!bullet.hitIds.includes(e.id)&&dist(e,enemy)<195)
          .sort((a,b)=>dist(a,enemy)-dist(b,enemy)||a.id-b.id).slice(0,2);
        for(const next of others)this.spawnExtra(bullet,next,bullet.damage*.57,later,"split");
        this.lastEffect={name:"分裂",note:others.length+"発の追加弾",at:this.time};
      }else if(id==="blast"){
        const radius=69;
        this.effects.push({kind:"blast",x:enemy.x,y:enemy.y,r:radius,life:.55,max:.55});
        let hits=0;
        for(const e of this.live().filter(o=>dist(o,enemy)<=radius+o.r)){
          this.hit(e,19);hits++;this.metrics.blastHits++;
        }
        this.lastEffect={name:"爆発",note:hits+"体に範囲ダメージ",at:this.time};
      }else if(id==="pierce"){
        const candidates=this.live().filter(e=>!bullet.hitIds.includes(e.id)&&
          e.progress<enemy.progress&&enemy.progress-e.progress<.155&&dist(e,enemy)<175)
          .sort((a,b)=>b.progress-a.progress);
        if(candidates.length&&this.spawnExtra(bullet,candidates[0],bullet.damage*.78,later,"pierce")){
          this.metrics.pierces++;
          this.effects.push({kind:"pierce",x:enemy.x,y:enemy.y,life:.24,max:.24});
          this.lastEffect={name:"貫通",note:"後続の敵にも命中",at:this.time};
        }
      }else if(id==="frost"){
        if(!enemy.dead){enemy.cold=Math.max(enemy.cold,3.9);this.metrics.slows++;}
        this.effects.push({kind:"frost",x:enemy.x,y:enemy.y,r:34,life:.5,max:.5});
        this.lastEffect={name:"冷却",note:"移動速度を低下",at:this.time};
      }else if(id==="arc"){
        const target=this.live().filter(e=>e.id!==enemy.id&&dist(e,enemy)<150)
          .sort((a,b)=>dist(a,enemy)-dist(b,enemy)||a.id-b.id)[0];
        const charged=enemy.cold>0;
        if(target){
          this.hit(target,charged?53:30);this.metrics.arcHits++;
          this.effects.push({kind:"arc",x:enemy.x,y:enemy.y,x2:target.x,y2:target.y,life:.36,max:.36});
          this.lastEffect={name:"電撃",note:charged?"冷却から大連鎖！":"近くの敵に連鎖",at:this.time};
        }
      }
    }
  }
  finish(){
    if(this.phase!=="run")return;
    const won=this.core>0,result={hp:Math.ceil(this.core),won,kills:this.kills,escaped:this.escapes,
      shots:this.metrics.mainShots,extras:this.metrics.extraBullets,impacts:this.metrics.impacts,
      seconds:Math.round(this.time*10)/10,
      modules:this.profile.loadout.slice(),mixed:this.usedLoadouts.size>1};
    const previous=this.profile.results[this.wave];
    result.prevHp=previous?.hp??null;
    result.previous=previous?{hp:previous.hp,modules:[...previous.modules],
      extras:previous.extras??null,seconds:previous.seconds??null,mixed:!!previous.mixed}:null;
    this.result=result;this.phase="result";
    // End-of-battle particle effects must not stay frozen on the victory scene.
    this.effects=[];this.bullets=[];
    this.profile.results[this.wave]={hp:result.hp,modules:result.modules,kills:result.kills,
      extras:result.extras,seconds:result.seconds,mixed:result.mixed};
    if(won)this.profile.completed=Math.max(this.profile.completed,this.wave);
  }
  step(dt){
    if(this.phase!=="run"||dt<=0)return;
    dt=Math.min(.05,dt);this.time+=dt;
    const schedule=WAVES[this.wave-1].enemies;
    while(this.spawnIndex<schedule.length&&schedule[this.spawnIndex].at<=this.time){
      this.spawn(schedule[this.spawnIndex++]);
    }
    for(const e of this.live()){
      e.progress+=e.speed*(e.cold>0?.38:1)*dt/routes[e.lane].total;
      e.cold=Math.max(0,e.cold-dt);
      Object.assign(e,pointAt(e.lane,e.progress));
      if(e.progress>=1){
        e.dead=true;this.escapes++;this.core=Math.max(0,this.core-e.coreDamage);
        this.effects.push({kind:"breach",x:CORE.x,y:CORE.y,life:.55,max:.55});
      }
    }
    for(const id of Object.keys(TURRETS)){
      this.timers[id]=Math.max(0,this.timers[id]-dt);
      if(!this.timers[id])this.fire(id);
    }
    this.stepProjectiles(dt);
    if(this.core<=0||(this.spawnIndex>=schedule.length&&!this.enemies.length&&!this.bullets.length))this.finish();
  }
  // Also used for the instant test-fire: identical bullet travel and module impact rules.
  stepProjectiles(dt){
    dt=Math.min(.05,Math.max(0,dt));
    // Generated shards begin flying on the next tick, not twice in one frame.
    const active=this.bullets.slice();
    const settled=new Set();
    for(const p of active){
      const enemy=this.enemies.find(e=>e.id===p.targetId&&!e.dead);
      if(!enemy){settled.add(p.id);continue;}
      p.px=p.x;p.py=p.y;
      const d=dist(p,enemy);
      if(d<=p.speed*dt+enemy.r+2){
        this.impact(p,enemy);settled.add(p.id);
      }else{
        p.x+=(enemy.x-p.x)*p.speed*dt/d;
        p.y+=(enemy.y-p.y)*p.speed*dt/d;
      }
    }
    this.bullets=this.bullets.filter(p=>!settled.has(p.id));
    this.enemies=this.enemies.filter(e=>!e.dead);
    this.effects=this.effects.filter(e=>(e.life-=dt)>0);
  }
  exportProfile(){return clone(this.profile);}
}
