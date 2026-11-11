/* Player classes, their private card pools, starting treasures and persistent shrines. */
A4.Classes=(function(){
 'use strict';
 var data=A4.content.classes,definitions={},treasures=[
 ['boar_altar','agamaggan','low','passive','멧돼지 제단','매 턴의 메인 페이즈 1에 영웅 능력이 자동으로 사용되지만, 지불하는 체력이 절반으로 감소합니다.'],
 ['dragon_pendant_card','celeste','low','card','용의 팬던트','내 손에 있는 모든 ‘수정구’를 강화합니다.'],
 ['dragon_pendant_passive','celeste','low','passive','용의 팬던트','‘탐구’가 ‘수정구+’를 가져오지만, 네 턴에 한 번씩 발동합니다.'],
 ['steadfast_soul','thekal','low','passive','굳건한 영혼','매 턴의 엔드 페이즈시에, 내 제단의 체력을 모두 회복시킵니다.'],
 ['loa_wrath','thekal','low','passive','로아의 분노','내 제단이 파괴되면, 카드를 뽑고 상대에게 피해를 6 줍니다.'],
 ['sacred_ritual','thekal','low','passive','신성한 의식','내 제단이 생존한 동안, 내 카드들의 비용이 (1) 감소합니다. 단, (1) 이하로 낮아지진 않습니다.'],
 ['loa_grace','thekal','low','passive','로아의 은총','내 제단이 파괴되면, 내 손에 있는 강화되지 않은 무작위 카드가 강화됩니다.'],
 ['loa_covenant','thekal','high','passive','로아의 서약','내 제단이 3턴이 아닌 2턴만에 부활합니다.'],
 ['majestic_presence','thekal','high','passive','위풍당당한 위용','내 제단이 파괴되면, 내 손에 있는 카드들의 비용이 (1) 감소합니다.'],
 ['grace_harvester','thekal','high','passive','은총 수확자','내 제단이 파괴될 때, 내 손이 가득 찰 때까지 카드를 뽑습니다.'],
 ['eternal_devotion','thekal','high','passive','영원한 헌신','게임이 시작할 때, 내 제단을 복사하여 소환합니다.']];
 function id(x){return 'class:'+x;}
 function state(f){return f.status.classes||(f.status.classes={});}
 function has(f,key){return f.startingTreasureId===key||(f.treasureIds||[]).indexOf(key)>=0||(f.passives||[]).some(function(x){return x.id===key||x.treasureId===key;});}
 function alive(f,key){return (f.shrines||[]).filter(function(x){return x.hp>0&&(!key||x.id===key);});}
 function task(side,op,extra){var t={kind:'class',module:'classes',side:side,op:op};Object.keys(extra||{}).forEach(function(k){t[k]=extra[k];});return t;}
 function pool(c,hero){var h=(c.heroes||[]).filter(function(x){return x.id===hero;})[0];return h?h.classPool||[]:[];}
 function options(c,ids){return ids.map(function(x){return {cardId:x,upgraded:false};});}
 function install(c){
  data.cards.forEach(function(ref){var d=A4.copy(ref),key=id(d.id);delete d.id;d.module='classes';d.rule=key;d.classCard=true;d.effects=[];d.innate=/先天性|선천성/.test(d.text);d.excludeOnUse=/일회용/.test(d.text);d.temporary=/^일시적/.test(d.text);if(d.upgrade){d.upgrade.module='classes';d.upgrade.rule=key;d.upgrade.innate=/선천성/.test(d.upgrade.text);d.upgrade.excludeOnUse=/일회용/.test(d.upgrade.text);d.upgrade.temporary=/^일시적/.test(d.upgrade.text);}c.cards[key]=d;definitions[key]=ref;});
  c.startingTreasures={};data.startingTreasures.forEach(function(x){c.startingTreasures[x.id]=A4.copy(x);});c.shrines={};data.shrines.forEach(function(x){c.shrines[x.id]=A4.copy(x);});
  c.heroes=data.heroes.map(function(x){var h=A4.copy(x);h.cards=h.cards.map(id);h.classPool=h.classPool.map(id);return h;});
  treasures.forEach(function(row){var t={id:row[0],classId:row[1],tier:row[2],kind:row[3],name:row[4],text:row[5]};if(t.kind==='card'){t.cardId=id(row[0]);c.cards[t.cardId]={name:t.name,element:'LIGHTNING',cost:0,text:t.text,treasure:true,treasureId:t.id,rule:t.cardId,module:'classes',effects:[]};definitions[t.cardId]={action:'pendant'};}else t.effects=[{type:'treasurePassive',id:t.id,treasureId:t.id,module:'classes'}];c.treasures[t.id]=t;});
  ['molten_bone','decay_potion'].forEach(function(key){c.treasures[key].classId='silent';});return c;
 }
 function summon(ctx,side,key){var f=ctx.fighter(side),ref=ctx.catalog.shrines[key];if(!ref)return;f.shrineId=key;f.shrines=[{id:key,name:ref.name,hp:ref.maxHp,maxHp:ref.maxHp}];if(has(f,'eternal_devotion'))f.shrines.push(ctx.copy(f.shrines[0]));}
 function copyHand(ctx,side,x,discount){if(!x)return null;return ctx.generate(side,x.cardId,{upgraded:!!x.upgraded,costDelta:(x.costDelta||0)-(discount||0),costFloor:0});}
 function getTreasure(ctx,side,permanent){var f=ctx.fighter(side),ids=Object.keys(ctx.catalog.treasures).filter(function(k){var t=ctx.catalog.treasures[k];return t.tier==='low'&&(!t.classId||t.classId===f.heroId)&&(f.treasureIds||[]).indexOf(k)<0;});var key=ctx.pick(ids);if(!key)return;var t=ctx.catalog.treasures[key];if(t.kind==='card'){var card=ctx.generate(side,t.cardId);if(permanent)ctx.runChange({type:'addTreasure',side:side,treasureId:key,card:card,cardUid:card.uid});}else{f.treasureIds.push(key);f.passives=f.passives.concat(ctx.copy(t.effects));if(permanent)ctx.runChange({type:'addTreasure',side:side,treasureId:key});}}
 function castDeck(ctx,side,zero,n,twice){var f=ctx.fighter(side);ctx.sample(f.deck.filter(function(x){return ctx.canAutoCast(x)&&(!zero||ctx.cost(side,x)===0)&&x.uid!==(ctx.task.card||{}).uid;}),n).forEach(function(x){ctx.move(side,x.uid,'inFlight');ctx.cast(side,x,{copy:false});if(twice)ctx.cast(side,x,{copy:true});});}
 function discard(ctx,side,n){A4.Keywords.effect(ctx,{side:side,effect:{type:'discardBottom',amount:n}});}
 function chooseMove(ctx,side,owner,zone,n){var f=ctx.fighter(owner);if(f[zone].length)ctx.discover(side,f[zone].slice(),task(side,'moveChoice',{owner:owner,zone:zone,remaining:n}),{sourceZone:zone});}
 function run(ctx,t){
  if(t.module!=='classes')return false;
  var b=ctx.battle,s=t.side,f=ctx.fighter(s),o=ctx.other(s),foe=ctx.fighter(o),st=state(f),d=t.def||{},ref=definitions[d.rule||t.op]||{},up=!!d.upgraded,action=t.op||ref.action,x,n;
  if(t.kind==='power')action=t.power.rule;
  if(ref.delegate){var delegated=ctx.copy(t),describe=ctx.def;delegated.module='cards';delegated.def=ctx.copy(d);delegated.def.rule=ref.delegate;delegated.def.module='cards';ctx.def=function(card){var result=describe(card);if(t.card&&card.uid===t.card.uid){result.rule=ref.delegate;result.module='cards';}return result;};try{return A4.CardRules.run(ctx,delegated);}finally{ctx.def=describe;}}
  switch(action){
  case 'strike':ctx.damage(s,o,up?9:6);break;
  case 'guard':ctx.shield(s,up?8:5);break;
  case 'link':ctx.draw(s,up?3:2);break;
  case 'regen':ctx.heal(s,up?4:2);ctx.schedule(b.turn+1,'STANDBY',{kind:'effect',side:s,card:t.card,effect:{type:'heal',amount:up?4:2}});break;
  case 'thunderbolt':ctx.damage(s,o,up?10:8);A4.Keywords.effect(ctx,{side:s,effect:{type:'shock',amount:up?3:2}});break;
  case 'neutralize':ctx.damage(s,o,up?4:3);A4.Keywords.effect(ctx,{side:s,effect:{type:'weakened',turns:up?2:1}});break;
  case 'chain':for(n=0;n<(up?3:2);n++)ctx.damage(s,o,2);break;
  case 'leap':x=options(ctx.catalog,pool(ctx.catalog,f.heroId));if(x.length)ctx.discover(s,x,task(s,'generateChoice'));break;
  case 'generateChoice':if(t.choice)ctx.generate(s,t.choice.cardId,{upgraded:!!t.choice.upgraded});break;
  case 'innervate':ctx.mana(s,up?2:1);break;
  case 'snack':for(n=1;n<=(up?2:1);n++)ctx.schedule(b.turn+n,'STANDBY',{kind:'effect',side:s,card:t.card,effect:{type:'mana',amount:2}});break;
  case 'phytoncide':ctx.draw(s,f.maxMana);break;
  case 'growth':if(f.maxMana<5){f.manaGrowth++;f.maxMana++;A4.Keywords.observe(f);}break;
  case 'entangle':A4.Keywords.effect(ctx,{side:s,effect:{type:'weakened',turns:up?3:2}});break;
  case 'seedbomb':ctx.damage(s,o,foe.status.poison>0?(up?16:8):(up?10:5));break;
  case 'focus':if(st.focusTurn!==b.turn)st.focusCount=0;st.focusTurn=b.turn;st.focusCount=(st.focusCount||0)+1;break;
  case 'invocation':(f.shrines||[]).forEach(function(a){a.maxHp+=up?5:3;});break;
  case 'acolyte':alive(f).forEach(function(a){ctx.damage(s,o,(up?6:3)+a.hp);});break;
  case 'chooseShrine':summon(ctx,s,t.choice.id);ctx.runChange({type:'setShrine',side:s,shrineId:t.choice.id});break;
  case 'loa_call':(f.shrines||[]).forEach(function(a){if(a.hp<=0&&a.reviveTurn>b.turn)a.reviveTurn--;});break;
  case 'bloodcraft':if((f.bloodstones||0)>=5)return true;n=bloodPrice(f,t.bloodCostScale);if(st.nextBloodPayment==='opponent'){foe.hp-=n;if(n)ctx.note('text',o,0,{text:foe.name+'의 체력을 혈석 제작 비용으로 '+n+' 소모했다.'});}else if(st.nextBloodPayment!=='free'){if(f.hp<=n)return true;f.hp-=n;}delete st.nextBloodPayment;f.bloodstones=Math.min(5,(f.bloodstones||0)+1);ctx.runChange({type:'bloodstones',side:s,amount:f.bloodstones});break;
  case 'crescendo':ctx.heal(s,up?8:5);ctx.damage(s,o,Math.max(1,A4.Battle.fatigue(b.turn+1)),{ignoreArmor:true,unblockable:true,noBonus:true,card:null});break;
  case 'saturation':ctx.draw(s,up?3:2);break;
  case 'bloodRitual':st.nextBloodPayment=up?'opponent':'free';break;
  case 'anchor_pull':if(f.deck.length)ctx.discover(s,f.deck.slice(),task(s,'anchorChoice'),{sourceZone:'deck'});break;
  case 'anchorChoice':ctx.choose(s,[{id:'top',name:'덱 맨 위'},{id:'bottom',name:'덱 맨 밑'}],task(s,'anchorPosition',{card:t.choice}));break;
  case 'anchorPosition':x=ctx.remove(s,t.card.uid);if(x){if(t.choice.id==='top')f.deck.unshift(x);else f.deck.push(x);}break;
  case 'pendant':f.hand.forEach(function(c){if(c.cardId==='crystal_ball'||c.originalCardId==='crystal_ball')ctx.upgrade(c);});break;
  case 'mimic':x=f.hand.slice().sort(function(a,z){return ctx.cost(s,a)-ctx.cost(s,z);})[0];for(n=0;n<(up?2:1);n++)copyHand(ctx,s,x);break;
  case 'bait':ctx.sample(f.deck.filter(function(c){return c.uid!==t.card.uid&&ctx.cost(s,c)===0&&!c.upgraded&&!!ctx.catalog.cards[c.cardId].upgrade&&!ctx.catalog.cards[c.cardId].treasure;}),up?2:1).forEach(ctx.upgrade);break;
  case 'snow':castDeck(ctx,s,true,up?2:1,!!f.status.deckEmptied);break;
  case 'zeroDraw':ctx.draw(s,ctx.limit(s)-f.hand.length,function(def,c){return ctx.cost(s,c)===0;});break;
  case 'surf':for(n=1;n<=2;n++)ctx.schedule(b.turn+n,'STANDBY',task(s,'surfTick',{discover:up}));break;
  case 'surfTick':x=f.deck.filter(function(c){return ctx.cost(s,c)===0&&ctx.canAutoCast(c);});if(t.discover&&x.length)ctx.discover(s,x,task(s,'deckCastChoice'),{sourceZone:'deck'});else castDeck(ctx,s,true,1,false);break;
  case 'deckCastChoice':if(ctx.find(s,t.choice.uid)){ctx.move(s,t.choice.uid,'inFlight');ctx.cast(s,t.choice,{copy:false});}break;
  case 'discard':discard(ctx,s,up?3:2);break;
  case 'buried':ctx.draw(s,up?2:1);ctx.shield(s,up?10:5);break;
  case 'restSurprise':case 'restPlasma':case 'restAura':case 'restCannon':break;
  case 'anchor':ctx.draw(s,up?4:2);if(!f.status.deckEmptied&&!ctx.modify('harmfulEffect',{side:s,kind:'noDraw',cancel:false}).cancel)st.noDrawTurn=b.turn+1;break;
  case 'stolen':if(f.status.deckEmptied)chooseMove(ctx,s,o,'deck',up?2:1);else for(n=0;n<(up?2:1);n++){x=ctx.pick(foe.deck);if(x)ctx.add(s,ctx.remove(o,x.uid),'hand');}break;
  case 'deepBait':discard(ctx,s,up?6:3);ctx.draw(s,1);break;
  case 'flood':discard(ctx,s,3);f.deck.slice(0,up?5:3).forEach(function(c){c.costDelta=(c.costDelta||0)-1;c.costFloor=0;});break;
  case 'salvage':discard(ctx,s,3);if(f.status.deckEmptied)chooseMove(ctx,s,s,'rest',up?2:1);else for(n=0;n<(up?2:1);n++){x=ctx.pick(f.rest);if(x)ctx.move(s,x.uid,'hand');}break;
  case 'moveChoice':x=ctx.remove(t.owner,t.choice.uid);if(x)ctx.add(s,x,'hand');if(t.remaining>1)chooseMove(ctx,s,t.owner,t.zone,t.remaining-1);break;
  case 'convert':if(f.hand.length)ctx.discover(s,f.hand.slice(),task(s,'discardChoice'),{sourceZone:'hand'});break;
  case 'discardChoice':ctx.move(s,t.choice.uid,'rest');ctx.draw(s,1);break;
  case 'overdrive':n=f.hand.length;f.hand.slice().forEach(function(c){ctx.move(s,c.uid,'rest');});ctx.draw(s,n);break;
  case 'negotiate':discard(ctx,s,3);if(f.hand.length&&foe.hand.length){if(f.status.deckEmptied)ctx.discover(s,f.hand.slice(),task(s,'exchangeOwn'));else exchange(ctx,s,ctx.pick(f.hand),ctx.pick(foe.hand));}break;
  case 'exchangeOwn':ctx.discover(s,foe.hand.slice(),task(s,'exchangeOther',{own:t.choice}));break;
  case 'exchangeOther':exchange(ctx,s,t.own,t.choice);break;
  case 'shrineDestroyed':if(has(f,'loa_wrath')){ctx.draw(s,1);ctx.damage(s,o,6,{card:null});}if(has(f,'loa_grace')){x=ctx.pick(f.hand.filter(function(c){return !c.upgraded&&!!ctx.catalog.cards[c.cardId].upgrade;}));if(x)ctx.upgrade(x);}if(has(f,'majestic_presence'))f.hand.forEach(function(c){c.costDelta=(c.costDelta||0)-1;c.costFloor=0;});if(has(f,'grace_harvester'))ctx.draw(s,ctx.limit(s)-f.hand.length);break;
  default:return false;
  }return true;
 }
 function exchange(ctx,s,a,z){var o=ctx.other(s),left=ctx.remove(s,a.uid),right=ctx.remove(o,z.uid);if(left)ctx.add(o,left,'hand');if(right)ctx.add(s,right,'hand');}
 function absorb(ctx,s,amount){var f=ctx.fighter(s);alive(f).forEach(function(a){var lost=Math.min(a.hp,amount);a.hp-=lost;amount-=lost;if(lost&&a.hp<=0){a.reviveTurn=ctx.battle.turn+(has(f,'loa_covenant')?2:3);ctx.enqueue(task(s,'shrineDestroyed'));}});return amount;}
 function bloodPrice(f,scale){return Math.floor((f.runWins||0)*2*(scale===undefined?1:scale));}
 function bloodUsable(f,scale,available){return (available===undefined?(f.bloodstones||0):available)<5&&((state(f).nextBloodPayment==='free'||state(f).nextBloodPayment==='opponent')||f.hp>bloodPrice(f,scale));}
 function modify(ctx,what,d){var f=d.side?ctx.fighter(d.side):null,st=f?state(f):null;
  if(what==='harmfulEffect'&&has(f,'purification_well')&&(st.purified||0)<2){st.purified=(st.purified||0)+1;d.cancel=true;ctx.note('text',d.side,0,{text:f.name+'의 [🎖️] 정화의 원천이 해로운 효과를 무시했다. ('+st.purified+'/2)'});}
  if(what==='overload'&&alive(f,'kragwa').length)d.value=0;
  if(what==='cardCost'){if(alive(f)&&alive(f).length&&has(f,'sacred_ritual')&&d.value>0)d.value=Math.max(1,d.value-1);if(d.def.action==='buried'&&f.status.deckEmptied)d.value=0;}
  if(what==='drawAllowed'&&st.noDrawTurn===ctx.battle.turn)d.allowed=false;
  if(what==='basicDraw'&&st.noDrawTurn===ctx.battle.turn)d.replace=true;
  if(what==='powerUsable'&&d.power&&d.power.id==='loa_call'&&!(f.shrines||[]).some(function(a){return a.hp<=0;}))d.allowed=false;
  if(what==='powerUsable'&&d.power&&d.power.id==='bloodcraft'&&!bloodUsable(f,undefined,d.bloodAvailable))d.allowed=false;
  if(what==='damage'&&d.card&&!d.noBonus){var own=ctx.fighter(d.sourceSide);d.value+=(state(own).powerBonus||0)+alive(own,'janalai').length*2;}
  if(what==='heal'&&d.card)d.value+=(st.powerBonus||0)+alive(f,'janalai').length*2;
  if(what==='healFinal'&&alive(f,'bwonsamdi').length&&d.value>0){ctx.damage(d.side,ctx.other(d.side),d.value,{card:null,noBonus:true});d.value=0;}
 }
 function hook(ctx,e){var b=ctx.battle;
  ['player','enemy'].forEach(function(s){var f=ctx.fighter(s),o=ctx.other(s),st=state(f),turn=b.turn,x;
   if(e.type==='battleStart'){
    if(f.heroId==='thekal'&&!(f.shrines||[]).length){if(f.shrineId)summon(ctx,s,f.shrineId);else ctx.discover(s,data.shrines.map(function(a){return {id:a.id,name:'[🕯] '+a.name+' | ❤️'+a.maxHp,text:'제단. '+a.text};}),task(s,'chooseShrine'));}
    if(has(f,'snake_ring')&&!st.snakeApplied){st.snakeApplied=true;ctx.draw(s,2,null,{opening:true});}
   }
   if(e.type==='standby'&&st.standbyTurn!==turn){
    st.standbyTurn=turn;
    if(f.heroPower&&f.heroPower.id==='inquiry'&&has(f,'dragon_pendant_passive')&&(turn+1)%4===0)ctx.generate(s,'crystal_ball',{upgraded:true});
    (f.shrines||[]).forEach(function(a){var revived=a.hp<=0&&a.reviveTurn<=turn;if(revived){a.hp=a.maxHp;delete a.reviveTurn;}if(a.hp>0){
      if(has(f,'bound_reliquary'))a.maxHp++;if(revived)a.hp=a.maxHp;
      if(a.id==='akali'&&f.shield)ctx.damage(s,o,f.shield,{card:null});
      if(a.id==='gral')copyHand(ctx,s,ctx.pick(ctx.fighter(o).deck),1);
    }});
   }
   if(e.type==='beforeMain'&&e.phase==='MAIN1'&&has(f,'boar_altar')&&f.heroPower&&f.heroPower.id==='bloodcraft'&&st.boarTurn!==turn&&bloodUsable(f,0.5)){st.boarTurn=turn;ctx.enqueue({kind:'power',module:'classes',side:s,power:ctx.copy(f.heroPower),bloodCostScale:0.5});}
   if(e.type==='powerUsed'&&e.side===s&&e.power&&e.power.id!=='bloodcraft')delete st.nextBloodPayment;
   if(e.type==='shieldGained'&&e.side===s&&e.amount>0&&alive(f,'gonk').length)ctx.mana(s,f.maxMana,true);
   if(e.type==='cardUsed'&&e.side===s){
    if(has(f,'pandaria_codex')&&(e.card.cardId==='crystal_ball'||e.card.originalCardId==='crystal_ball')){st.crystals=(st.crystals||0)+1;if(st.crystals%5===0)st.powerBonus=(st.powerBonus||0)+1;}
    if(st.focusTurn===turn)ctx.damage(s,o,3*(st.focusCount||1),{card:null});
    alive(f,'kragwa').forEach(function(){if(/과부하/.test(e.def.text||''))ctx.damage(s,o,5,{card:null});});
    alive(f,'shirvallah').forEach(function(){var ids=ctx.catalog.cardPool.filter(function(id){return ctx.catalog.cards[id].element==='HOLY';});x=ctx.pick(ids);if(x)ctx.generate(s,x);});
   }
   if(e.type==='cardRest'&&e.side===s){var d=ctx.def(e.card),ref=definitions[d.rule]||{},up=!!e.card.upgraded;
    if(ref.action==='restSurprise'){ctx.damage(s,o,up?16:10);ctx.draw(s,2);}
    if(ref.action==='restPlasma'){A4.Keywords.effect(ctx,{side:s,effect:{type:'shock',amount:up?3:1}});ctx.draw(s,3);}
    if(ref.action==='restCannon'){ctx.damage(s,o,up?10:6);A4.Keywords.effect(ctx,{side:s,effect:{type:'shock',amount:1}});}
    if(ref.action==='restAura')getTreasure(ctx,s,up);
   }
   if(e.type==='end'){
    alive(f,'halazzi').forEach(function(){ctx.damage(s,o,f.playedThisTurn*2,{card:null});});
    if(has(f,'steadfast_soul'))alive(f).forEach(function(a){a.hp=a.maxHp;});
   }
   if(has(f,'bilgewater_tribute')&&f.status.deckEmptied&&!st.tribute){st.tribute=true;getTreasure(ctx,s,false);}
  });
 }
 function evaluate(d,m,own,opp,b,c){var ref=definitions[d.rule]||{},up=!!d.upgraded,action=d.rule==='bloodcraft'?'bloodcraft':ref.action,st=(own.status||{}).classes||{};
  if(ref.delegate){var standard=A4.Opponents.reference(ref.delegate);if(standard){var base=A4.Battle.describeCard({cardId:standard.id,upgraded:up},c),score=A4.AIEvaluation.evaluateCard(base,own,opp,b,c);Object.keys(m).forEach(function(k){if(score[k]!==undefined)m[k]=score[k];});}return;}
  switch(action){
  case 'strike':m.damage=up?9:6;break;case 'guard':m.shield=up?8:5;break;case 'link':m.draw=up?3:2;break;
  case 'regen':m.heal=(up?4:2)*1.7;break;case 'thunderbolt':m.damage=up?10:8;m.control=up?4:3;break;
  case 'neutralize':m.damage=up?4:3;m.control=up?3:2;break;case 'chain':m.damage=up?6:4;m.hits=up?3:2;break;
  case 'leap':m.draw=1;m.value=1;break;case 'innervate':m.mana=up?2:1;break;case 'snack':m.value=up?5:3;break;
  case 'phytoncide':m.draw=own.maxMana;break;case 'growth':m.value=own.maxMana<5?6:0;break;case 'entangle':m.control=up?4:3;break;
  case 'seedbomb':m.damage=(opp.status||{}).poison?(up?16:8):(up?10:5);break;case 'focus':m.value=2;break;
  case 'invocation':m.value=(own.shrines||[]).length*(up?4:2);break;case 'acolyte':m.damage=alive(own).reduce(function(sum,a){return sum+a.hp+(up?6:3);},0);break;
  case 'crescendo':m.heal=up?8:5;m.damage=Math.max(1,A4.Battle.fatigue(b.turn+1));m.fatigueDamage=true;break;
  case 'saturation':m.draw=up?3:2;break;
  case 'bloodRitual':m.value=st.nextBloodPayment?0:(own.runWins||0)*2*(up?2:1)+1;break;
  case 'bloodcraft':var payment=bloodPrice(own),wanted=(own.hand||[]).some(function(x){return c.cards[x.cardId]&&c.cards[x.cardId].bloodCost!==undefined;});m.value=(wanted?5:2)-((st.nextBloodPayment==='free'||st.nextBloodPayment==='opponent')?0:payment*(own.hp<15?1.7:0.8));if(st.nextBloodPayment==='opponent'){m.value+=payment*1.3;if(payment>=opp.hp&&payment>0)m.value+=50;}break;
  case 'mimic':m.draw=own.hand.length>1?(up?2:1):0;break;case 'zeroDraw':m.draw=4;break;case 'discard':m.value=1;break;
  case 'buried':m.draw=up?2:1;m.shield=up?10:5;break;case 'restSurprise':m.damage=up?16:10;m.draw=2;break;
  case 'restPlasma':m.draw=3;m.control=up?4:2;break;case 'restCannon':m.damage=up?10:6;m.control=2;break;
  case 'restAura':m.draw=1;m.value=4;break;case 'anchor':m.draw=up?4:2;m.value=own.status.deckEmptied?0:-2;break;
  case 'stolen':case 'salvage':m.draw=up?2:1;break;case 'deepBait':m.draw=1;break;case 'convert':m.draw=1;m.value=-1;break;
  case 'overdrive':m.draw=own.hand.length-1;m.value=-m.draw;break;default:m.value=1;
  }
 }
 function restoreCrystal(card){if(card.originalCardId!=='crystal_ball')return;card.cardId='crystal_ball';card.upgraded=!!card.crystalUpgraded;['originalCardId','transformed','cost','costDelta','element','noUpgrade','temporaryUntil'].forEach(function(k){delete card[k];});}
 return {evaluate:evaluate,restoreCrystal:restoreCrystal,install:install,run:run,hook:hook,modify:modify,absorb:absorb,has:has,alive:alive,pool:pool,supports:function(rule){return !!definitions[rule];}};
}());
