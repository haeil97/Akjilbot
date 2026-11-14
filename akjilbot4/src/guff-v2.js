/* November Guff rules. Old identifiers remain loadable for saved decks. */
A4.GuffRules=(function(){
 'use strict';
 function owns(f,id){return A4.TreasureRules.owns(f,id);}
 function overloaded(f){return (f.overloadNext||0)+(f.overloadLocked||0);}
 function key(card){return card.cardId&&card.cardId.replace('class:guff_','');}
 function hasRune(f,id){return (f.runes||[]).some(function(x){return key(x)===id;});}
 function runes(f,id){return (f.runes||[]).filter(function(x){return !id||key(x)===id;});}
 function flags(d){d.innate=/선천성/.test(d.text);d.temporary=/^일시적/.test(d.text);d.excludeOnUse=/일회용/.test(d.text);}
 function mode(text){return /모든 적/.test(text)?'all':/무작위 적/.test(text)?'random':/적에게|적이 피해/.test(text)?'choose':'body';}
 function install(c){
  var pool=[];A4.content.guffRevision.forEach(function(row){var id='class:guff_'+row[0],d={name:row[1],element:row[2],cost:row[3],text:row[4],rule:row[0],module:'guff',classCard:true,classId:'guff',rune:!!row[7],effects:[],targetMode:mode(row[4]),upgrade:{cost:row[5],text:row[6],rune:!!row[7],module:'guff',rule:row[0],targetMode:mode(row[6])}};flags(d);flags(d.upgrade);c.cards[id]=d;pool.push(id);});
  c.heroes.filter(function(h){return h.id==='guff';})[0].classPool=pool;
  Object.keys(c.cards).forEach(function(id){if(id.indexOf('class:guff_')===0&&pool.indexOf(id)<0&&id!=='class:guff_regen'&&id!=='class:guff_thunderbolt'){c.cards[id].classCard=false;c.cards[id].retired=true;}});
  var revision=A4.content.neutralRevision;
  revision.cards.forEach(function(ref){var d=c.cards[ref.id];A4.assert(d,'개편 카드 정의 누락: '+ref.name);d.cost=ref.cost;d.text=ref.text;d.targetMode=mode(ref.text);d.botOnly=!!ref.botOnly;d.innate=/선천성/.test(d.text);d.unstable=/불안정/.test(d.text);d.temporary=/일시적/.test(d.text);d.excludeOnUse=/일회용/.test(d.text);d.upgrade.cost=ref.upgrade.cost;d.upgrade.text=ref.upgrade.text;d.upgrade.targetMode=mode(ref.upgrade.text);d.upgrade.innate=/선천성/.test(d.upgrade.text);d.upgrade.unstable=/불안정/.test(d.upgrade.text);d.upgrade.temporary=/일시적/.test(d.upgrade.text);d.upgrade.excludeOnUse=/일회용/.test(d.upgrade.text);});
  c.cardPool=revision.cards.filter(function(d){return !d.botOnly;}).map(function(d){return d.id;});
  Object.keys(c.cards).forEach(function(id){c.cards[id].neutralCard=c.cardPool.indexOf(id)>=0;});
  var ids=revision.treasures.map(function(t){return t.id;});
  Object.keys(c.treasures).forEach(function(id){var t=c.treasures[id];if(!t.classId&&ids.indexOf(id)<0)t.retired=true;});
  function treasure(ref,classId){var t=c.treasures[ref.id]||{},d;t.id=ref.id;t.name=ref.name;t.text=ref.text;t.tier=ref.tier;t.kind=ref.kind;t.retired=false;if(classId)t.classId=classId;
   if(ref.kind==='card'){
    t.cardId=t.cardId||'treasure_'+ref.id;d=c.cards[t.cardId];if(!d)d={name:ref.name,element:ref.element,cost:ref.cost,text:ref.text,treasure:true,treasureId:ref.id,rule:ref.id,module:'guff',effects:[]};
    d.text=ref.text;if(ref.cost!==undefined)d.cost=ref.cost;if(ref.element)d.element=ref.element;d.targetMode=mode(d.text);c.cards[t.cardId]=d;
   }else t.effects=[{type:'treasurePassive',id:ref.id,treasureId:ref.id,module:'guff'}];c.treasures[ref.id]=t;
  }
  revision.treasures.forEach(function(t){treasure(t);});revision.classTreasures.forEach(function(t){treasure(t,'guff');});
  c.neutralTreasurePool=revision.treasures.map(function(t){return t.id;});
  Object.keys(c.treasures).forEach(function(id){var t=c.treasures[id];if(t.kind==='passive'&&!t.retired)c.cards['treasure_token:'+id]={name:t.name,element:'NEUTRAL',cost:0,text:'일회용. '+t.text,treasure:true,treasureId:id,rule:'claimTreasure',claimedTreasureId:id,module:'expansion',excludeOnUse:true,effects:[]};});
  c.minions={};c.minionSkills={};A4.content.minionDesign.minions.forEach(function(m){c.minions[m.id]=A4.copy(m);});A4.content.minionDesign.skills.forEach(function(s){c.minionSkills[s.id]=A4.copy(s);});
 }
 function increase(ctx,s){var f=ctx.fighter(s),before=f.maxMana;if(before>=5)return;f.manaGrowth++;f.maxMana=Math.min(5,f.maxMana+1);A4.Keywords.observe(f);}
 function discoverOverload(ctx,s,n){var h=ctx.catalog.heroes.filter(function(x){return x.id===ctx.fighter(s).heroId;})[0],ids=ctx.catalog.cardPool.concat(h?h.classPool:[]).filter(function(id){return /과부하:/.test(ctx.catalog.cards[id].text);});if(ids.length)ctx.discover(s,ids.map(function(id){return {cardId:id};}),{module:'guff',side:s,op:'overloadChoice',remaining:n});}
 function run(ctx,t){
  if(t.module!=='guff')return false;var s=t.side,f=ctx.fighter(s),o=ctx.other(s),foe=ctx.fighter(o),b=ctx.battle,d=t.def||{},up=!!d.upgraded,k=t.op||d.rule,n,x,list,aw=!!f.status.awakened;
  function hit(amount){return ctx.damage(s,o,amount);}
  function shield(amount){ctx.shield(s,amount);}
  function schedule(amount,type,turns){for(var i=1;i<=turns;i++)ctx.schedule(b.turn+i,'STANDBY',{kind:'effect',side:s,card:t.card,effect:{type:type,amount:amount}});}
  switch(k){
   case 'innervate':ctx.mana(s,up?2:1);break;
   case 'giant_seed':ctx.draw(s,up?4:3);f.status.guffNoDrawUntil=b.turn+1;break;
   case 'bloom':ctx.overload(s,up?1:2);ctx.mana(s,2);break;
   case 'entangle':A4.Keywords.effect(ctx,{side:s,effect:{type:'weakened',turns:up?3:2}});break;
   case 'willow':ctx.draw(s,up?2:1,function(def,c){return ctx.cost(s,c)>=2;});break;
   case 'vine_whip':hit(up?9:6);if(f.maxMana>=3)shield(5);break;
   case 'phytoncide':ctx.draw(s,f.maxMana);break;
   case 'root_wall':for(n=0;n<(aw?(up?3:2):1);n++)shield(6);break;
   case 'thick_branch':hit(up?14:10);if((t.paidCost===undefined?ctx.cost(s,t.card):t.paidCost)<(up?ctx.catalog.cards[t.card.cardId].upgrade.cost:ctx.catalog.cards[t.card.cardId].cost))ctx.draw(s,2);break;
   case 'growth':increase(ctx,s);break;
   case 'last_fruit':ctx.heal(s,up?15:10);break;
   case 'ignition':for(n=0;n<(aw?(up?3:2):1);n++)hit(6);break;
   case 'spark':A4.Minions.harm(ctx,o,'vulnerable',up?4:3);break;
   case 'eruption':hit(6);break;
   case 'burning_root':ctx.damage(s,s,5);increase(ctx,s);break;
   case 'scorch':if(aw)A4.Minions.harm(ctx,o,'vulnerable',up?3:2);hit(f.maxMana*(up?3:2));break;
   case 'redesign':runes(f).slice().forEach(function(r){ctx.move(s,r.uid,'rest');});ctx.draw(s,3);break;
   case 'fire_sea':hit(f.maxMana*(up?5:4));break;
   case 'slash_burn':if(runes(foe).length){runes(foe).slice().forEach(function(r){ctx.move(o,r.uid,'rest');});list=f.deck.filter(function(c){return ctx.def(c).rune;});if(list.length){x=ctx.pick(list);ctx.move(s,x.uid,'inFlight');ctx.cast(s,x,{copy:false});}}break;
   case 'mana_shield':shield(f.maxMana*(up?5:4));break;
   case 'shield_slam':hit(f.shield);break;
   case 'hibernation':schedule(7,'shield',up?3:2);break;
   case 'moonwell':if(runes(f).length)shield(up?10:7);break;
   case 'breeze':if(f.hand.length){n=Math.max.apply(Math,f.hand.map(function(c){return ctx.cost(s,c);}));x=ctx.pick(f.hand.filter(function(c){return ctx.cost(s,c)===n;}));ctx.move(s,x.uid,'deck');ctx.shuffle(f.deck);}ctx.draw(s,2);shield(up?10:6);break;
   case 'overdraft':n=overloaded(f);ctx.mana(s,f.overloadLocked||0,true);f.overloadLocked=0;f.overloadNext=0;ctx.draw(s,n);break;
   case 'mine':ctx.overload(s,1);discoverOverload(ctx,s,up?2:1);break;
   case 'overloadChoice':if(t.choice)ctx.generate(s,t.choice.cardId);if(t.remaining>1)discoverOverload(ctx,s,t.remaining-1);break;
   case 'terraform':ctx.overload(s,1);ctx.draw(s,1,function(def){return !!def.rune;});break;
   case 'electric_storm':ctx.overload(s,1);hit(up?14:10);ctx.draw(s,1);break;
   case 'instant_accel':schedule(1,'mana',up?3:2);break;
   case 'storm_surge':ctx.overload(s,1);hit((up?14:10)+overloaded(f)*5);break;
   case 'echo':hit(up?30:20);break;
   case 'smallSeedBurst':A4.Minions.harm(ctx,o,'vulnerable',t.upgraded?4:2);ctx.draw(s,3);break;
   case 'runeTick':
    x=runes(f).filter(function(r){return r.uid===t.uid;})[0];if(!x)return true;up=!!x.upgraded;
    if(t.rule==='call_companion'&&f.mana>0)ctx.draw(s,up?2:1);
    if(t.rule==='mana_well'&&overloaded(f)>0)ctx.draw(s,1);
    if(t.rule==='harmony')ctx.mana(s,up?2:1,true);
    if(t.rule==='shade')shield(up?5:3);
    if(t.rule==='blue_heart'||t.rule==='storm_eye'){
     var target=ctx.pick(A4.Minions.targets(b,o)),amount=t.rule==='blue_heart'?(up?8:6):(up?9:6);if(target.uid)A4.Minions.hit(ctx,s,o,target,amount,{card:x});else ctx.damage(s,o,amount,{card:x,bodyOnly:true});
    }break;
   case 'evasion':shield(20);break;
   case 'guff_suppress':n=overloaded(f);ctx.mana(s,f.overloadLocked||0,true);f.overloadNext=f.overloadLocked=0;ctx.overload(o,n);break;
   case 'golden_branch':list=f.deck.concat(f.rest);x=ctx.shuffle(list.map(function(c){return ctx.cost(s,c);}));list.forEach(function(c,i){c.cost=x[i];delete c.costDelta;});ctx.draw(s,3);break;
   default:if(d.rune)return true;return false;
  }return true;
 }
 function modify(ctx,what,data){var f=ctx.fighter(data.side||ctx.side),b=ctx.battle;
  if(what==='cardCost'&&data.card.guffStaffDiscount)data.value=Math.max(0,data.value-data.card.guffStaffDiscount);
  if(what==='drawAllowed'&&f.status.guffNoDrawUntil!==undefined&&f.status.guffNoDrawUntil>=b.turn)data.allowed=false;
  if(what==='cardCost'&&data.def.module==='guff'){
   if(data.def.rule==='eruption'&&f.heroPowerUsedTurn===b.turn)data.value=0;
   if(data.def.rule==='echo')data.value=Math.max(0,data.value-overloaded(f));
  }
 }
 function hook(ctx,e){var b=ctx.battle;
  if(e.type==='runeEnded'&&e.to==='rest'&&key(e.card)==='small_seed')ctx.enqueue({module:'guff',side:e.side,op:'smallSeedBurst',upgraded:!!e.card.upgraded,card:ctx.copy(e.card),enemyTarget:e.card.runeEnemyTarget||null,targetMode:'choose'});
  ['player','enemy'].forEach(function(s){var f=ctx.fighter(s),o=ctx.other(s),list=runes(f);
   list.forEach(function(r){var k=key(r),trigger=(e.type==='end'&&(k==='call_companion'||k==='mana_well'))||(e.type==='beforeMain'&&e.phase==='MAIN2'&&k==='harmony')||(e.type==='standby'&&k==='shade')||(e.type==='shieldGained'&&e.side===s&&k==='blue_heart')||(e.type==='overload'&&e.side===s&&k==='storm_eye');if(trigger)ctx.enqueue({module:'guff',side:s,op:'runeTick',uid:r.uid,rule:k,card:ctx.copy(r)});});
   if(e.type==='overload'&&e.side===s&&owns(f,'struck_tree')&&!e.guffReflected)ctx.overload(o,e.amount,true);
   if(e.type==='maximumManaIncreased'&&e.side===s&&owns(f,'life_cycle'))A4.Minions.targets(b,o).forEach(function(m){if(m.uid)A4.Minions.hit(ctx,s,o,m,8,{card:null,noBonus:true});else ctx.damage(s,o,8,{card:null,noBonus:true,bodyOnly:true});});
  });
 }
 function evaluate(d,m,f,foe,b,c){var up=!!d.upgraded,aw=f.status.awakened;
  if(d.rune){m.value=6;return;}switch(d.rule){
   case 'innervate':m.mana=up?2:1;break;case 'giant_seed':m.draw=up?4:3;m.value=-2;break;case 'bloom':m.mana=2;m.overload=up?1:2;break;
   case 'vine_whip':m.damage=up?9:6;if(f.maxMana>=3)m.shield=5;break;case 'phytoncide':m.draw=f.maxMana;break;case 'root_wall':m.shield=6*(aw?(up?3:2):1);break;
   case 'growth':case 'burning_root':m.value=f.maxMana<5?7:0;if(d.rule==='burning_root')m.selfDamage=5;break;
   case 'last_fruit':m.heal=up?15:10;break;case 'ignition':m.damage=6*(aw?(up?3:2):1);break;
   case 'eruption':m.damage=6;break;case 'scorch':m.damage=f.maxMana*(up?3:2);m.control=aw?2:0;break;
   case 'fire_sea':m.damage=f.maxMana*(up?5:4)*(1+A4.Minions.alive(foe).length);break;
   case 'mana_shield':m.shield=f.maxMana*(up?5:4);break;case 'shield_slam':m.damage=f.shield;break;case 'hibernation':m.shield=7*(up?3:2)*.7;break;
   case 'moonwell':m.shield=runes(f).length?(up?10:7):0;break;case 'breeze':m.draw=2;m.shield=up?10:6;break;
   case 'electric_storm':m.damage=up?14:10;m.draw=1;m.overload=1;break;case 'storm_surge':m.damage=(up?14:10)+(overloaded(f)+1)*5;m.overload=1;break;case 'echo':m.damage=up?30:20;break;
   case 'thick_branch':m.damage=up?14:10;break;case 'overdraft':m.draw=overloaded(f);m.mana=f.overloadLocked||0;break;
   case 'willow':case 'terraform':m.draw=up&&d.rule==='willow'?2:1;break;case 'redesign':m.draw=3;m.value=-runes(f).length*2;break;
   case 'mine':m.draw=up?2:1;m.overload=1;break;case 'instant_accel':m.mana=(up?3:2)*.7;break;case 'entangle':case 'spark':m.control=3;break;
  }
 }
 return {install:install,run:run,modify:modify,hook:hook,evaluate:evaluate,hasRune:hasRune,overloaded:overloaded,mode:mode,increase:increase,supports:function(rule){return A4.content.guffRevision.some(function(row){return row[0]===rule;})||['evasion','guff_suppress','golden_branch'].indexOf(rule)>=0;}};
}());
