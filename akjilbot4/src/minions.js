/* Public end-phase companions. Skills are effects, never card submissions. */
A4.Minions=(function(){
 'use strict';
 function alive(f){return (f.minions||[]).filter(function(m){return m.hp>0;});}
 function find(b,side,uid){return (b[side].minions||[]).filter(function(m){return m.uid===uid;})[0]||null;}
 function targets(b,side){return [{uid:null,name:b[side].name}].concat(alive(b[side]));}
 function skill(c,id){return typeof id==='object'?id:(c.minionSkills||{})[id];}
 function prepare(m,c,rng){
  if(!m.skills.length){m.preparedSkill=null;return;}
  var index=m.selection==='random'?Math.floor(rng()*m.skills.length):(m.cursor||0)%m.skills.length;
  var d=skill(c,m.skills[index]);A4.assert(d,'하수인 스킬 정의가 없습니다.');m.preparedSkill=A4.copy(d);m.preparedIndex=index;
 }
 function summon(ctx,side,spec){
  var d=typeof spec==='string'?(ctx.catalog.minions||{})[spec]:spec;A4.assert(d,'하수인 정의가 없습니다.');
  A4.assert(A4.integer(d.maxHp,1)&&Array.isArray(d.skills),'하수인의 체력과 스킬 목록이 필요합니다.');
  var m={uid:'minion-'+(++ctx.battle.generatedCounter),minionId:d.id||null,name:d.name,maxHp:d.maxHp,hp:d.maxHp,shield:0,status:{cards:{effects:[]}},skills:ctx.copy(d.skills),selection:d.selection||'cycle',cursor:0,spawnTurn:ctx.battle.turn,lastActTurn:-1};
  A4.assert(m.selection==='cycle'||m.selection==='random','하수인 행동 방식은 cycle 또는 random입니다.');
  prepare(m,ctx.catalog,ctx.rng);var f=ctx.fighter(side);if(!f.minions)f.minions=[];f.minions.push(m);ctx.note('text',side,0,{text:m.name+'을 소환했다.'});if(ctx.battle.phase==='END'&&m.preparedSkill)ctx.enqueue({module:'minions',kind:'minionSkill',side:side,uid:m.uid,skill:ctx.copy(m.preparedSkill)});return m;
 }
 function selected(ctx){return ctx.task.enemyTarget===undefined?null:ctx.task.enemyTarget;}
 function mode(ctx){var d=ctx.task.def||(ctx.task.card?ctx.def(ctx.task.card):{}),text=d.text||'';return ctx.task.targetMode||d.targetMode||(/모든 적/.test(text)?'all':/무작위 적/.test(text)?'random':/적에게|적이 피해/.test(text)?'choose':'body');}
 function resolve(ctx,side,targetMode){
  var list=targets(ctx.battle,side),uid=selected(ctx);targetMode=targetMode||mode(ctx);
  if(targetMode==='all')return list;
  if(targetMode==='random')return [ctx.pick(list)];
  if(targetMode==='choose'&&uid)return [find(ctx.battle,side,uid)].filter(function(x){return x&&x.hp>0;});
  return [list[0]];
 }
 function active(m,kind,b){return (m.status.cards.effects||[]).some(function(e){return e.kind===kind&&(e.from===undefined||e.from<=b.turn)&&(e.until===undefined||e.until>=b.turn);});}
 function hit(ctx,source,side,m,n,options){
  options=options||{};if(m.hp<=0)return 0;var card=options.card===undefined?ctx.task.card:options.card;
  var data={sourceSide:source,side:side,card:card||null,value:n,noBonus:!!options.noBonus,unblockable:!!options.unblockable,targetMinion:m.uid};
  if(card&&!options.noBonus)(ctx.fighter(source).passives||[]).forEach(function(p){if(p.type==='damageBonus')data.value+=p.amount;});ctx.modify('damage',data);
  var value=data.value;if(!options.unblockable){if(A4.Keywords.active(ctx.task.minionSource?find(ctx.battle,source,ctx.task.minionSource)||ctx.fighter(source):ctx.fighter(source),'weakened',ctx.battle))value=Math.floor(value*.75);if(active(m,'vulnerable',ctx.battle))value=Math.floor(value*(A4.GuffRules&&A4.GuffRules.hasRune(ctx.fighter(ctx.other(side)),'fire_heart')?1.75:1.5));
   var owner=ctx.fighter(side);if((owner.status.cards&&owner.status.cards.effects||[]).some(function(e){return e.kind==='allEnemyImmune'&&e.from<=ctx.battle.turn&&e.until>=ctx.battle.turn;}))value=0;
  }
  value=Math.max(0,Math.floor(value));var blocked=options.ignoreArmor?0:Math.min(m.shield,value);m.shield-=blocked;m.hp=Math.max(0,m.hp-value+blocked);
  ctx.note('damage',side,value,{minionUid:m.uid,blocked:blocked});ctx.emit('minionDamaged',{side:side,sourceSide:source,minionUid:m.uid,amount:value});
  if(m.hp===0)ctx.note('text',side,0,{text:m.name+'이 쓰러졌다.'});return value;
 }
 function harm(ctx,side,kind,turns){resolve(ctx,side,'choose').forEach(function(m){if(!m.uid){A4.Keywords.effect(ctx,{side:ctx.side,effect:{type:kind,target:'opponent',turns:turns,bodyOnly:true}});return;}m.status.cards.effects.push({kind:kind,from:ctx.battle.turn,until:ctx.battle.turn+turns});});}
 function randomDamage(ctx,side,amount,options){var o=ctx.other(side),m=ctx.pick(targets(ctx.battle,o)),settings=ctx.copy(options||{});settings.bodyOnly=true;return m.uid?hit(ctx,side,o,m,amount,settings):ctx.damage(side,o,amount,settings);}
 function hook(ctx,e){
  if(e.type==='minionDamaged'){var m=find(ctx.battle,e.side,e.minionUid);if(m)(m.status.cards.effects||[]).forEach(function(x){if(x.kind==='solar'&&x.until>=ctx.battle.turn){x.amount+=e.amount;if(x.amount>=10){x.kind='spent';ctx.enqueue({module:'cards',op:'solarBurst',side:x.sourceSide,target:e.side,amount:x.burst,card:x.sourceCard});}}});}
  if(e.type==='battleStart')['player','enemy'].forEach(function(side){var f=ctx.fighter(side),spec=ctx.battle.restartSpecs[side],defs=spec.startingMinions||((ctx.catalog.enemies||{})[f.bossId]||{}).startingMinions||[];defs.forEach(function(d){summon(ctx,side,d);});});
  if(e.type==='end')['player','enemy'].forEach(function(side){alive(ctx.fighter(side)).forEach(function(m){if(m.preparedSkill&&m.lastActTurn!==ctx.battle.turn)ctx.enqueue({module:'minions',kind:'minionSkill',side:side,uid:m.uid,skill:ctx.copy(m.preparedSkill)});});});
 }
 function run(ctx,t){
  if(t.module!=='minions')return false;
  if(t.op==='summon'){summon(ctx,t.side,t.spec);return true;}
  var m=find(ctx.battle,t.side,t.uid);if(!m||m.hp<=0||ctx.fighter(t.side).hp<=0||m.lastActTurn===ctx.battle.turn)return true;
  m.lastActTurn=ctx.battle.turn;var d=t.skill,o=ctx.other(t.side);t.def={text:d.text||'',targetMode:d.targetMode||A4.GuffRules.mode(d.text||'')};t.minionSource=m.uid;t.displaySource={side:t.side,minionUid:m.uid,label:{name:d.name,element:'NEUTRAL',displayElement:'🌕'}};
  ctx.note('text',t.side,0,{text:m.name+'이 [🌕] '+d.name+'을 사용했다.'});
  if(d.cardRule){A4.CardRules.run(ctx,{kind:'skill',module:'cards',side:t.side,def:{name:d.name,rule:d.cardRule,text:d.text,upgraded:!!d.upgraded},minionSource:m.uid,displaySource:t.displaySource});}
  (d.effects||[]).forEach(function(e){
   if(e.type==='summonMinion'){summon(ctx,t.side,e.minionId||e.spec);return;}
   if(e.target==='self'){
    if(e.type==='heal')m.hp=Math.min(m.maxHp,m.hp+e.amount);if(e.type==='shield')m.shield+=e.amount;return;
   }
   var effect=ctx.copy(e);if(effect.target==='owner')effect.target='self';ctx.enqueue({kind:'effect',side:t.side,effect:effect,minionSource:m.uid,displaySource:ctx.copy(t.displaySource)});
  });m.cursor=(m.preparedIndex+1)%Math.max(1,m.skills.length);prepare(m,ctx.catalog,ctx.rng);return true;
 }
 return {alive:alive,find:find,targets:targets,summon:summon,prepare:prepare,resolve:resolve,mode:mode,hit:hit,harm:harm,active:active,hook:hook,run:run,randomDamage:randomDamage};
}());
