/* Serializable phase engine. No IO, wall clock, closures, or promises in saved state. */
A4.Battle = (function () {
  'use strict';
  // Saved turn indices stay zero-based; the first playable turn is turn 1.
  var SIDES=['player','enemy'], ZONES=['hand','deck','rest','excluded','inFlight','runes'];
  var COUNTERS={ICE:'FIRE',FIRE:'NATURE',NATURE:'LIGHTNING',LIGHTNING:'ICE'};
  function clone(v){return v===undefined?undefined:JSON.parse(JSON.stringify(v));}
  function other(s){return s==='player'?'enemy':'player';}
  function label(d){return {name:d.name,element:d.element||'NEUTRAL',displayElement:d.kind==='active'||d.kind==='passive'?'🛟':d.displayElement||null,treasure:!!d.treasure,rune:!!d.rune,rule:d.rule||null};}
  function report(b){return b.report||(b.report={turn:b.turn,phase:b.phase,serial:b.phaseSerial,nodes:[],logs:[]});}
  function node(b,side,d,card,parent){
    if(card&&card.originalCardId==='crystal_ball'&&card.cardId!=='crystal_ball')parent=node(b,side,{name:card.crystalUpgraded?'수정구+':'수정구',element:'COSMIC'},null,parent).id;
    var r=report(b),n={id:r.nodes.length,side:side,label:label(d),uid:card&&card.uid||null,parent:parent===undefined?null:parent,countered:false};r.nodes.push(n);return n;
  }
  function modules(){return [A4.CardRules,A4.TreasureRules,A4.BossRules,A4.Keywords,A4.Classes,A4.Expansion,A4.Runes].filter(function(x){return !!x;});}
  function shuffle(a,rng){for(var i=a.length-1;i>0;i--){var j=Math.floor(rng()*(i+1)),t=a[i];a[i]=a[j];a[j]=t;}return a;}
  function describe(c,catalog){
    var base=catalog.cards[c.cardId]; A4.assert(base,'알 수 없는 카드: '+c.cardId);
    var d=clone(base),k;
    if(c.upgraded&&base.upgrade){for(k in base.upgrade)if(A4.has(base.upgrade,k))d[k]=clone(base.upgrade[k]); d.name=base.name+'+';}
    ['bloodCost','rune','runeEffects','runeTriggers','cost','element','excludeOnUse','temporary','unplayable','overpower','volatile','liberation','orbit','unstable','limited','innate','rule','module'].forEach(function(key){if(c[key]!==undefined)d[key]=c[key];});
    if(c.costDelta)d.cost=Math.max(c.costFloor||0,d.cost+c.costDelta);
    d.overpower=!!d.overpower||/(?:^|[.,]\s*)압도(?:[.,:\s]|$)/.test(d.text||'');
    d.unstable=!!d.unstable||/(?:^|[.,]\s*)불안정(?:[.,:\s]|$)/.test(d.text||'');
    d.volatile=!!d.volatile||/(?:^|[.,]\s*)휘발성(?:[.,:\s]|$)/.test(d.text||'');
    d.uid=c.uid;d.cardId=c.cardId;d.upgraded=!!c.upgraded;d.element=d.element||'NEUTRAL';
    return d;
  }
  function clearCostReduction(card,catalog){
    // Explicit battle-long modifiers belong to rules/status, not these
    // per-instance discounts. Cancel delayed restoration as well.
    var restore=card.treasureCostRestore;
    if(restore){
      if(restore.hasCost)card.cost=restore.cost;else delete card.cost;
      card.costDelta=restore.costDelta||0;card.costFloor=restore.costFloor||0;
      delete card.treasureCostRestore;
    }
    var plain=clone(card);delete plain.cost;delete plain.costDelta;delete plain.costFloor;
    if(card.cost!==undefined&&card.cost<describe(plain,catalog).cost)delete card.cost;
    if(card.costDelta<0){delete card.costDelta;delete card.costFloor;}
  }
  function fighter(spec,catalog,rng){
    var f={name:spec.name,baseMaxHp:spec.maxHp,maxHp:spec.maxHp,hp:spec.maxHp,shield:0,mana:2,maxMana:2,manaGrowth:0,overloadNext:0,
      hand:[],deck:clone(spec.deck||[]),rest:[],excluded:[],inFlight:[],runes:[],passives:clone(spec.passives||[]),treasureIds:clone(spec.treasureIds||[]),
      heroName:spec.heroName||spec.name,heroPower:clone(spec.heroPower||null),heroPowerUsedTurn:-1,heroPowerReadyTurn:0,
      status:{cardLocks:[],foresightTurns:[]},playedThisTurn:0,usedThisTurn:[],lastTurnCards:[],damageTakenThisTurn:0,limitedUsed:{},bossId:spec.bossId||null,heroId:spec.heroId||null,startingTreasureId:spec.startingTreasureId||null,shrineId:spec.shrineId||null,shrines:[],bloodstones:spec.bloodstones||0,fatigueExtra:0,runWins:spec.runWins||0};
    f.passives.forEach(function(p){if(p.type==='maxHp'){f.maxHp+=p.amount;f.hp+=p.amount;}if(p.type==='startingShield')f.shield+=p.amount;});
    if(spec.hp!==undefined){A4.assert(A4.integer(spec.hp,1),'시작 체력이 올바르지 않습니다.');f.hp=Math.min(f.maxHp,spec.hp);}
    shuffle(f.deck,rng); return f;
  }
  function context(b,c,rng,task,spawned){
    var ctx={battle:b,catalog:c,rng:rng,task:task,side:task.side||'player',copy:clone,other:other};
    ctx.fighter=function(s){return b[s];};ctx.self=b[ctx.side];ctx.foe=b[other(ctx.side)];
    ctx.pick=function(a){return a.length?a[Math.floor(rng()*a.length)]:null;};
    ctx.sample=function(a,n){return shuffle(a.slice(),rng).slice(0,n);};ctx.shuffle=function(a){return shuffle(a,rng);};
    ctx.log=function(t){if(b._aiSimulation)return;if(b.lastLog.length<120)b.lastLog.push(String(t));else if(b.lastLog.length===120)b.lastLog.push('이후 반복 효과 로그는 생략합니다.');};
    var ownNode=b.report&&b.report.nodes.slice().reverse().filter(function(n){return n.side===ctx.side&&((task.card&&n.uid===task.card.uid)||(task.kind==='power'&&n.power));})[0];
    if(ownNode&&task.kind!=='cast'){task.displayNode={serial:b.report.serial,id:ownNode.id};task.displaySource={side:ctx.side,label:ownNode.label};}
    if(!task.displaySource&&(task.card||task.power))task.displaySource={side:ctx.side,label:label(task.card?describe(task.card,c):task.power)};
    ctx.withSource=function(side,source,fn){var old=task.displaySource;task.displaySource={side:side,label:label(source)};try{return fn();}finally{task.displaySource=old;}};
    ctx.note=function(type,side,amount,extra){if(b._aiSimulation)return;var r=report(b),source=extra&&extra.source||task.displaySource||null,last=r.logs[r.logs.length-1];if(['gainCard','move','overflow'].indexOf(type)>=0&&last&&last.type===type&&last.side===side&&last.text===(extra&&extra.text||null)&&JSON.stringify(last.source)===JSON.stringify(source)&&!!last.cards===!!(extra&&extra.cards)){last.amount+=amount;if(extra&&extra.cards)last.cards=last.cards.concat(clone(extra.cards));return;}if(r.logs.length>=100){if(!r.omitted){r.omitted=true;r.logs.push({type:'text',text:'반복 효과의 추가 로그는 생략합니다.'});}return;}r.logs.push({type:type,side:side,amount:amount,source:clone(source),blocked:extra&&extra.blocked||0,modified:!!(extra&&extra.modified),text:extra&&extra.text||null,cards:extra&&extra.cards?clone(extra.cards):null});};
    ctx.reveal=function(s,card){return node(b,s,ctx.def(card),card);};
    function inherit(next){if(task.runeSource&&next.kind==='effect'&&!next.runeSource)next.runeSource=clone(task.runeSource);if(task.castTrail&&!next.castTrail)next.castTrail=clone(task.castTrail);if(task.displaySource&&!next.displaySource)next.displaySource=clone(task.displaySource);if(task.displayNode&&!next.displayNode)next.displayNode=clone(task.displayNode);return next;}
    ctx.enqueue=function(t){spawned.push(inherit(clone(t)));};
    ctx.prepend=function(t){var list=Array.isArray(t)?t:[t];for(var i=list.length-1;i>=0;i--)spawned.unshift(inherit(clone(list[i])));};
    ctx.emit=function(type,data){var ev=clone(data||{});ev.type=type;ctx.enqueue({kind:'event',side:ev.side||ctx.side,event:ev});};
    ctx.modify=function(what,data){modules().forEach(function(m){if(m.modify)m.modify(ctx,what,data);});return data;};
    ctx.def=function(card){
      var d=describe(card,c),s=findSide(b,card.uid)||ctx.side;
      var v=ctx.modify('element',{side:s,card:card,def:d,value:d.element});d.element=v.value;return d;
    };
    ctx.limit=function(s){return Math.max(1,Math.floor(ctx.modify('handLimit',{side:s,value:A4.HAND_LIMIT||8}).value));};
    ctx.cost=function(s,card,first){
      var d=ctx.def(card),data={side:s,card:card,def:d,value:d.cost,first:first===undefined?b[s].playedThisTurn===0:!!first};
      return Math.max(0,Math.floor(ctx.modify('cardCost',data).value));
    };
    ctx.powerCost=function(s,power){return Math.max(0,Math.floor(ctx.modify('powerCost',{side:s,power:power||b[s].heroPower,value:(power||b[s].heroPower).cost||0}).value));};
    ctx.find=function(s,uid){return locate(b[s],uid).card||null;};
    ctx.remove=function(s,uid){var l=locate(b[s],uid);if(l.zone==='runes'&&l.card)ctx.modify('move',{side:s,card:l.card,from:'runes',to:null});if(l.zone==='hand'&&A4.Classes&&l.card)A4.Classes.restoreCrystal(l.card);var card=l.card?b[s][l.zone].splice(l.index,1)[0]:null;if(A4.Keywords)A4.Keywords.observe(b[s]);return card;};
    ctx.add=function(s,card,zone,options){
      if(!card)return null;zone=zone||'hand';options=options||{};var overflow=zone==='hand'&&b[s].hand.length>=ctx.limit(s);
      if(overflow&&ctx.modify('handOverflow',{side:s,card:card,draw:!!options.draw,cycleFirst:false}).cycleFirst){var firstCard=b[s].hand[0];if(firstCard)ctx.move(s,firstCard.uid,'deck');overflow=b[s].hand.length>=ctx.limit(s);}
      if(overflow)zone='excluded';
      if(zone==='excluded')zone=ctx.modify('move',{side:s,card:card,from:options.from||null,to:zone,overflow:overflow}).to;
      if(zone==='hand'&&(ctx.def(card).temporary||card.temporaryUntil!==undefined||A4.TreasureRules&&A4.TreasureRules.owns&&A4.TreasureRules.owns(b[s],'time_potion')))card.temporaryUntil=Math.max(card.temporaryUntil||0,b.turn+(b.phase==='END'?1:0));
      if(zone==='rest'||zone==='excluded'||(zone==='deck'&&(options.from==='hand'||options.from==='inFlight')))clearCostReduction(card,c);
      if(zone==='rest'){delete card.liberationReady;delete card.liberationProgress;}
      if(zone==='hand'&&options.from!=='hand'){delete card.orbitCount;delete card.orbitTriggered;}
      if(zone==='runes'){(b[s].runes||[]).slice().forEach(function(old){if(old.uid!==card.uid)ctx.move(s,old.uid,'rest');});if(!card.activeRuneDef)card.activeRuneDef=clone(ctx.def(card));}if(!b[s][zone])b[s][zone]=[];b[s][zone].push(card);if(A4.Keywords)A4.Keywords.observe(b[s]);
      if(task.displaySource&&!options.silent&&!overflow&&zone==='hand')ctx.note('gainCard',s,1);
      if(overflow){ctx.log(ctx.def(card).name+' — 손패 초과로 제외');ctx.note('overflow',s,1,{cards:[label(ctx.def(card))]});}
      if(zone==='excluded')ctx.emit('cardExcluded',{side:s,card:card,previousZone:options.from||null});
      if(zone==='rest')ctx.emit('cardRest',{side:s,card:card,previousZone:options.from||null});
      return card;
    };
    ctx.move=function(s,uid,to,options){
      var l=locate(b[s],uid);if(!l.card)return null;
      var data=ctx.modify('move',{side:s,card:l.card,from:l.zone,to:to});
      var card=b[s][l.zone].splice(l.index,1)[0];if(l.zone==='hand'&&data.to!=='hand'&&A4.Classes)A4.Classes.restoreCrystal(card);if(A4.Keywords)A4.Keywords.observe(b[s]);if(!(options&&options.silent)&&task.displaySource&&(l.zone!=='inFlight'||(options&&options.logEffect))&&to!=='inFlight'&&data.to!=='hand')ctx.note('move',s,1,{text:data.to,cards:options&&options.logEffect?[label(ctx.def(card))]:null});return ctx.add(s,card,data.to,{from:l.zone});
    };
    ctx.generate=function(s,id,options){
      options=options||{};var card={uid:'b'+(++b.generatedCounter),cardId:id,upgraded:!!options.upgraded},k;
      A4.assert(c.cards[id],'생성 카드가 없습니다: '+id);
      for(k in options)if(A4.has(options,k)&&['zone','uid','cardId','runUid','runCardUid','treasureSlot'].indexOf(k)<0)card[k]=clone(options[k]);
      if(ctx.def(card).liberation){delete card.liberationReady;delete card.liberationProgress;}
      if(ctx.def(card).temporary&&card.temporaryUntil===undefined)card.temporaryUntil=b.turn+(b.phase==='END'?1:0);
      return ctx.add(s,card,options.zone||'hand');
    };
    ctx.upgrade=function(card){
      if(card.originalCardId==='crystal_ball'){if(!card.crystalUpgraded){card.crystalUpgraded=true;card.upgraded=true;return true;}return false;}
      var d=c.cards[card.cardId];if(d&&d.upgrade&&!d.treasure&&(!d.exclusive||card.cardId==='crystal_ball')&&(!card.noUpgrade||card.cardId==='crystal_ball')&&!card.upgraded){card.upgraded=true;delete card.noUpgrade;return true;}return false;
    };
    ctx.refill=function(s){if(!b[s].deck.length&&b[s].rest.length){b[s].deck=shuffle(b[s].rest,rng);b[s].rest=[];ctx.emit('refill',{side:s});}};
    ctx.draw=function(s,n,filter,options){
      if(!ctx.modify('drawAllowed',{side:s,allowed:true}).allowed)return [];
      var result=[],f=b[s],i,j,card,d,drawn=0;options=options||{};
      var drawBatch=b.drawBatchSerial=(b.drawBatchSerial||0)+1;
      for(i=0;i<n;i++){
        ctx.refill(s);j=-1;
        for(var k=0;k<f.deck.length;k++){if(!filter||filter(ctx.def(f.deck[k]),f.deck[k])){j=k;break;}}
        if(j<0)break;card=f.deck.splice(j,1)[0];d=ctx.def(card);if(A4.Keywords)A4.Keywords.observe(f);drawn++;if(!options.opening)f.drawnCountThisTurn=(f.drawnCountThisTurn||0)+1;f.lastDrawnCard=clone(card);
        if(options.cost!==undefined)card.cost=options.cost;
        if(options.costDelta!==undefined){card.costDelta=(card.costDelta||0)+options.costDelta;card.costFloor=options.costFloor||0;}
        Object.keys(options).forEach(function(key){if(['cost','costDelta','costFloor','opening','basic'].indexOf(key)<0)card[key]=clone(options[key]);});
        if(d.castOnDraw){
          f.inFlight.push(card);ctx.enqueue({kind:'cast',side:s,card:clone(card),free:true,fromDraw:true});
        }else{
          if(d.temporary&&card.temporaryUntil===undefined)card.temporaryUntil=b.turn+(b.phase==='END'?1:0);
          var overflow=f.hand.length>=ctx.limit(s);ctx.add(s,card,'hand',{silent:true,draw:true});overflow=!f.hand.some(function(x){return x.uid===card.uid;});
          if(!options.opening)ctx.emit('draw',{side:s,card:card,overflow:overflow,drawBatch:drawBatch});if(!overflow)result.push(card);
        }
      }
      if(drawn&&!options.opening&&!options.basic)ctx.note('draw',s,drawn);
      return result;
    };
    ctx.poison=function(source,target,amount,reflected){
      if(amount<=0)return 0;
      var own=b[source],foe=b[target],owns=function(f,id){return A4.TreasureRules&&A4.TreasureRules.owns&&A4.TreasureRules.owns(f,id);};
      if(source!==target&&owns(own,'molten_bone'))amount++;
      if(ctx.modify('harmfulEffect',{side:target,sourceSide:source,kind:'poison',cancel:false}).cancel)return 0;
      foe.status.poison=(foe.status.poison||0)+amount;
      ctx.note('poison',target,amount);
      if(source!==target&&!reflected&&owns(own,'decay_potion'))ctx.poison(source,source,amount,true);
      return amount;
    };
    ctx.damage=function(source,s,n,options){
      options=options||{};var card=options.card===undefined?task.card:options.card;
      var data={sourceSide:source,side:s,card:card||null,value:Math.max(0,n),unblockable:!!options.unblockable,ignoreArmor:!!options.ignoreArmor,noBonus:!!options.noBonus};
      if(card&&!options.noBonus)b[source].passives.forEach(function(p){if(p.type==='damageBonus')data.value+=p.amount;});
      ctx.modify('damage',data);if(A4.Keywords&&!data.unblockable){if(A4.Keywords.active(b[source],'weakened',b))data.value=Math.floor(data.value*0.75);if(A4.Keywords.active(b[s],'vulnerable',b))data.value=Math.floor(data.value*1.5);}ctx.modify('damageTaken',data);var damage=Math.max(0,Math.floor(data.value)),f=b[s],blocked=data.ignoreArmor?0:Math.min(f.shield,damage);
      f.shield-=blocked;var hpDamage=damage-blocked;if(A4.Classes)hpDamage=A4.Classes.absorb(ctx,s,hpDamage);f.hp-=hpDamage;f.damageTakenThisTurn+=damage;
      var reactionDepth=options.reactionDepth===undefined?(task.kind==='event'&&task.event.type==='damage'?(task.event.reactionDepth||0)+1:task.reactionDepth||0):options.reactionDepth;
      ctx.emit('damage',{side:s,sourceSide:source,amount:damage,hpDamage:hpDamage,card:card||null,unblockable:data.unblockable,reactionDepth:reactionDepth,reactiveAllowed:reactionDepth===0||(b.player.hp>0&&b.enemy.hp>0)});
      if(damage||damage!==Math.max(0,n)){ctx.log(f.name+' 피해 '+damage+(blocked?' (방어도 '+blocked+')':''));ctx.note('damage',s,damage,{blocked:blocked,modified:damage!==Math.max(0,n),source:card?{side:source,label:label(ctx.def(card))}:task.displaySource});}return damage;
    };
    ctx.fatigue=function(source,target,advance){var amount=Math.max(1,1+(b.turn+1-20))+(b[target].fatigueExtra||0);var dealt=ctx.damage(source,target,amount,{ignoreArmor:true,unblockable:true,noBonus:true,card:null});if(advance&&dealt>0)b[target].fatigueExtra=(b[target].fatigueExtra||0)+1;return dealt;};
    ctx.heal=function(s,n,options){
      options=options||{};var f=b[s],card=options.card===undefined?task.card:options.card;
      var data=ctx.modify('heal',{side:s,card:card||null,value:Math.max(0,n),noBonus:!!options.noBonus});ctx.modify('healFinal',data);var requested=Math.max(0,Math.floor(data.value)),amount=Math.max(0,Math.min(requested,f.maxHp-f.hp));
      f.hp+=amount;ctx.emit('heal',{side:s,amount:amount,requested:requested,card:card||null});if(amount)ctx.log(f.name+' 회복 '+amount);ctx.note('heal',s,amount,{modified:amount!==Math.max(0,n),source:card?{side:task.displaySource?task.displaySource.side:ctx.side,label:label(ctx.def(card))}:task.displaySource});return amount;
    };
    ctx.shield=function(s,n){if(n>0&&A4.Keywords&&A4.Keywords.active(b[s],'disarm',b))return;b[s].shield=Math.max(0,b[s].shield+n);if(n){ctx.note('shield',s,n);if(n>0)ctx.emit('shieldGained',{side:s,amount:n});}};
    ctx.mana=function(s,n,recover){var current=b[s].mana;if(recover&&n>=0)b[s].mana=Math.max(current,Math.min(b[s].maxMana,current+n));else b[s].mana=Math.max(0,Math.min(5,current+n));if(b[s].mana!==current)ctx.note('mana',s,b[s].mana-current);};
    ctx.overload=function(s,n){n=ctx.modify('overload',{side:s,value:n}).value;if(n>0&&!ctx.modify('harmfulEffect',{side:s,kind:'overload',cancel:false}).cancel){b[s].overloadNext+=n;ctx.emit('overload',{side:s,amount:n});}};
    ctx.schedule=function(turn,phase,t){b.scheduled.push({turn:turn,phase:phase,task:inherit(clone(t))});};
    ctx.canAutoCast=function(card){
      var d=ctx.def(card),rule=d.rule||d.name;
      if(d.liberation&&A4.Keywords&&!A4.Keywords.liberated(ctx,ctx.side,card,d.liberation))return false;
      return !d.unplayable&&['운명','필연','되감기'].indexOf(rule)<0&&!(rule==='전선'&&d.upgraded);
    };
    ctx.cast=function(s,card,options){
      if(!ctx.canAutoCast(card))return;
      options=options||{};var x=clone(card),trail=clone(task.castTrail||[]),key=card.uid?s+':'+card.uid:null;
      if(key&&trail.indexOf(key)>=0){ctx.log('자동 시전 중 같은 카드의 재귀 호출을 멈춥니다.');ctx.note('text',s,0,{text:'자동 시전 중 같은 카드의 재귀 호출을 멈춥니다.'});return;}
      if(key)trail.push(key);
      if(options.copy!==false){x.uid='b'+(++b.generatedCounter);delete x.runUid;delete x.runCardUid;delete x.treasureSlot;}
      ctx.enqueue({kind:'cast',side:s,card:x,free:true,copy:options.copy!==false,castTrail:trail});
    };
    ctx.choose=function(s,options,continuation,settings){
      settings=settings||{};if(!options.length)return false;
      var resume=inherit(clone(continuation));resume.side=resume.side||s;
      ctx.enqueue({kind:'choiceRequest',side:s,options:options,continuation:resume,settings:settings});
      return true;
    };
    ctx.discover=function(s,options,continuation,settings){
      var names={},unique=[];options.forEach(function(o){var key=o.cardId?describe(o,c).name+'|'+describe(o,c).element:(o.id||o.name);if(!names[key]){names[key]=true;unique.push(o);}});
      settings=clone(settings||{});settings.discover=true;return ctx.choose(s,ctx.sample(unique,3),continuation,settings);
    };
    ctx.runChange=function(change){
      change=clone(change);
      if(change.type==='removeCard'){var removed=ctx.find(change.side||'player',change.uid);if(removed&&removed.runUid)change.runUid=removed.runUid;}
      b.runChanges.push(clone(change));
      // A rescue can occur before Game consumes these changes. Update the restart
      // snapshot immediately as well; Game later replaces it with canonical UIDs.
      var s=change.side||'player',spec=b.restartSpecs&&b.restartSpecs[s],id=change.treasureId||change.id,treasure=c.treasures&&c.treasures[id];if(!spec)return;
      if(change.type==='addCard'){var added=clone(change.card||{cardId:change.cardId,upgraded:!!change.upgraded});added.originUid=added.uid;added.uid='r'+(++b.generatedCounter);spec.deck.push(added);}
      if(change.type==='removeCard')spec.deck=spec.deck.filter(function(x){return x.uid!==(change.runUid||change.uid)&&x.originUid!==change.uid;});
      if(change.type==='upgradeCard')spec.deck.forEach(function(x){if(x.uid===(change.runUid||change.uid)||x.originUid===change.uid)x.upgraded=true;});
      if(change.type==='bloodstones')spec.bloodstones=change.amount;
      if(change.type==='setShrine')spec.shrineId=change.shrineId;
      if(change.type==='setHeroPower')spec.heroPower=clone(change.power);
      if(change.type==='addTreasure'&&treasure){spec.treasureIds=spec.treasureIds||[];spec.treasureIds.push(id);if(treasure.kind==='card')spec.deck.push({uid:'r'+(++b.generatedCounter),originUid:change.cardUid,cardId:treasure.cardId,upgraded:false});else spec.passives=(spec.passives||[]).concat(clone(treasure.effects));}
      if(change.type==='removeTreasure'){spec.treasureIds=(spec.treasureIds||[]).filter(function(x){return x!==id;});spec.passives=(spec.passives||[]).filter(function(x){return x.treasureId!==id&&x.id!==id;});}
    };
    ctx.lock=function(s,from,until,elements){if(ctx.modify('harmfulEffect',{side:s,kind:'lock',cancel:false}).cancel)return;b[s].status.cardLocks.push({from:from,until:until,elements:elements||null,name:task.card?ctx.def(task.card).name:'카드 사용 제한'});};
    return ctx;
  }
  function locate(f,uid){for(var z=0;z<ZONES.length;z++){var zone=ZONES[z],a=f[zone]||[];for(var i=0;i<a.length;i++)if(a[i].uid===uid)return {zone:zone,index:i,card:a[i]};}return {};}
  function findSide(b,uid){for(var i=0;i<SIDES.length;i++)if(locate(b[SIDES[i]],uid).card)return SIDES[i];return null;}
  function usable(ctx,s,card){
    var f=ctx.battle[s],d=ctx.def(card),data={side:s,card:card,def:d,allowed:true,reason:''},turn=ctx.battle.turn;
    if(d.unplayable){data.allowed=false;data.reason='사용불가 카드입니다.';}
    if(d.main1Only&&ctx.battle.phase!=='MAIN1'){data.allowed=false;data.reason='메인 페이즈 1에서만 사용할 수 있습니다.';}
    if(card.availableFrom!==undefined&&card.availableFrom>turn){data.allowed=false;data.reason='아직 사용할 수 없는 카드입니다.';}
    if(d.limited&&f.limitedUsed[card.cardId]===turn){data.allowed=false;data.reason='이번 턴에 이미 사용한 제한 카드입니다.';}
    f.status.cardLocks.forEach(function(l){if(l.from<=turn&&l.until>=turn&&(!l.elements||l.elements.indexOf(d.element)>=0)){data.allowed=false;data.reason='현재 이 카드를 사용할 수 없습니다.';}});
    ctx.modify('cardUsable',data);return data;
  }
  function redactTrapChoices(status,targetSide,viewer){
    ((status.cards||{}).effects||[]).forEach(function(e){
      if(e.kind==='iceTrap'&&(e.sourceSide||other(targetSide))!==viewer){delete e.element;e.hiddenChoice=true;}
    });
    return status;
  }
  function publicFighter(f){return {name:f.name,hp:f.hp,maxHp:f.maxHp,shield:f.shield,mana:f.mana,maxMana:f.maxMana,handCount:f.hand.length,deckCount:f.deck.length,restCount:f.rest.length,excludedCount:f.excluded.length,fatigueExtra:f.fatigueExtra||0,runes:clone(f.runes||[]),heroPower:clone(f.heroPower),heroPowerUsedTurn:f.heroPowerUsedTurn,playedThisTurn:f.playedThisTurn};}
  function basicScore(def,own,opp){
    var a=def.ai||{},d=a.damage||0,h=a.heal||0,draw=a.draw||0,shield=a.shield||0,v=a.value||0,control=a.control||0;
    (def.effects||[]).forEach(function(e){if(e.type==='damage')d+=e.amount||0;if(e.type==='randomDamage')d+=((e.min||0)+(e.max||0))/2;if(e.type==='heal')h+=e.amount||0;if(e.type==='draw')draw+=e.amount||0;if(e.type==='shield')shield+=e.amount||0;if(e.type==='overload')v-=(e.amount||0)*0.65;if(e.type==='scheduledDamage')d+=(e.amount||0)*(e.turns||1)*0.6;if(e.type==='lockCards')control+=3;});
    if(!def.ai&&def.rule&&!(def.effects||[]).some(function(e){return ['damage','heal','draw','randomDamage','shield','scheduledDamage'].indexOf(e.type)>=0;})){
      var text=def.text||'',m=/피해를?\s*(\d+)/.exec(text);if(m)d+=Number(m[1]);
      m=/(?:체력을?\s*)(\d+)\s*회복/.exec(text);if(m)h+=Number(m[1]);
      m=/카드를?\s*(\d+)장\s*(?:뽑|발견)/.exec(text);if(m)draw+=Number(m[1]);else if(/카드를 뽑/.test(text))draw+=1;
      if(/카운터|낼 수 없|차단/.test(text))control+=2;if(/방어도를?\s*10/.test(text))shield+=10;
      if(/승리|경고/.test(text))v+=8;if(/최대 마나/.test(text))v+=own.maxMana<5?5:0;
      if(/무작위.*사용/.test(text))v+=5;if(/비용.*감소/.test(text))v+=1;
    }
    if(d>=opp.hp+opp.shield)v+=35;
    return v+d*0.8+Math.min(h,Math.max(0,own.maxHp-own.hp))*(own.hp<=8?1.25:0.65)+Math.min(draw,Math.max(0,8-own.hand.length+1))*1.65+shield*(own.hp<own.maxHp/2?0.55:0.22)+control;
  }
  function damageEstimate(d){
    var n=d.ai&&d.ai.damage||0;(d.effects||[]).forEach(function(e){if(e.type==='damage')n+=e.amount||0;if(e.type==='randomDamage')n+=((e.min||0)+(e.max||0))/2;});
    if(!n){var m=/피해를?\s*(\d+)/.exec(d.text||'');if(m)n=Number(m[1]);}return n;
  }
  function actionPriority(d){var name=d.name.replace(/\+$/,'');if(name==='과열')return -10;if(name==='급속 성장')return -8;if(/회복|방어도/.test(d.text||''))return -4;if(name==='겨울의 뿔피리')return 4;if(/뽑|발견/.test(d.text||''))return 2;return 0;}
  function comboValue(def,own,foe,b,remainingHand,spent,totalDamage){
    var name=def.name.replace(/\+$/,''),v=0,phase1=b.phase==='MAIN1',text=def.text||'';
    if(/과부하/.test(text))v-=0.5;
    if(name==='과열')v+=remainingHand===0?(phase1?8:3):-4;

    if(name==='금단의 불꽃')v+=(own.mana-spent)*(def.upgraded?6:4)*0.8;
    if(name==='백드래프트')v+=own.deck.length*0.6;
    if(name==='지평선 절단기')v+=own.rest.length*1.4;
    if(name==='심판')v+=own.rest.filter(function(x){return x.element==='HOLY';}).length*1.5;
    if(name==='점화')v+=2.5+(own.status.cards&&own.status.cards.ignite||0)*0.45;
    if(name==='초과 인출')v+=(own.overloadNext+(own.overloadLocked||0))*2-(!own.overloadNext&&!own.overloadLocked?2:0);
    if(name==='급속 성장')v+=own.maxMana<5?4.5:0;
    if(name==='번개 개화'||name==='신비한 동전'||name==='겨울의 뿔피리')v+=phase1?3.5:-2.5;
    if(name==='자연의 모래시계'||name==='가속의 장화')v+=phase1&&remainingHand>=2?7:0;
    if(name==='완전 빙결')v-=b.turn+1>=28?0.5:0;
    if(name==='대한파')v+=phase1&&remainingHand===0?3:phase1?-1:0;
    if(name==='치유의 손길'&&own.hp===own.maxHp)v-=1.5;
    if(name==='밴 해머+++')v+=14;
    if(name==='비활성화')v+=(own.status.boss&&own.status.boss.warnings||own.status.warnings||0)>0?12:-8;
    if(name==='독버섯')v-=damageEstimate(def)*1.8+2;
    if(name==='저주'||name==='고드름')v+=4;
    if(name==='구원의 길')v+=own.status.boss&&own.status.boss.salvation!==undefined?-1:15;
    if(name==='기적같은 성장'||name==='가득 찬 가방')v+=Math.max(0,8-remainingHand)*1.2;
    if(name==='산사태'&&own.hand.some(function(x){return x.cost>=3;}))v+=1;
    if(/발견|훔쳐|가져옵/.test(text))v+=phase1?0.7:0.2;
    if(phase1&&/이번 턴.*비용|이번 턴.*마나|이번 턴.*레스트/.test(text))v+=1.4;
    if(b.turn+1>=20&&own.hp<=1+(b.turn+1-20)&&/회복|방어도/.test(text))v+=/회복/.test(text)?8:-2;
    return v;
  }
  function powerValue(power,own,opp,b,ctx){
    var id=power.rule||power.id,v=basicScore(power,own,opp);
    if((id==='lich_king'||id==='mida')&&opp.restCount===0)return -10;
    if((id==='faceless_manipulator'||id==='black_knight')&&opp.handCount===0)return -10;
    if((id==='boo'||id==='ivysaur')&&A4.AIEvaluation)return A4.AIEvaluation.evaluateCard(power,own,opp,b,ctx.catalog).score;
    if(id==='aviana')return Math.min(4,own.maxHp-own.hp)*(own.hp<8?1.5:0.8);
    if(id==='aurelion_sol')return 3+Math.min(5,own.hand.filter(function(x){return damageEstimate(ctx.def(x))>0;}).length);
    if(id==='extreme_troll'&&!own.deck.length&&!own.rest.length)return opp.deckCount>0?0.8:-2;
    if(id==='patchwerk')return Math.min(12,own.hp*0.45)+Math.min(8,own.maxHp*0.18);
    if(id==='plague_doctor')return 20+(own.status.baptisms||0)*1.2-Math.max(0,opp.maxHp-opp.hp)*0.1;
    if(id==='teemo')return opp.deckCount<8?6.5:4;
    if(id==='mida')return Math.min(3,opp.restCount)*1.8;
    if(id==='lich_king')return own.hand.length<8?5:0;
    if(id==='faceless_manipulator')return opp.handCount>5?1.3:0.5;
    return v===0&&power.rule?2.8:v;
  }
  function bestChoice(options,own,c){
    var best=options[0],v=-Infinity;options.forEach(function(o){var score=o.cardId?basicScore(describe(o,c),own,{hp:30,shield:0}):0;if(score>v){v=score;best=o;}});return best;
  }
  function legacyPlan(b,c,rng,observed){
    /* Deliberately reconstruct a redacted battle before evaluating candidates.
       Adding hidden state to an AI score is impossible through this context. */
    var publicOpponent=publicFighter(b.player),redacted={rulesVersion:3,turn:b.turn,phase:b.phase,enemy:clone(b.enemy),history:clone(b.history),scheduled:[],lastLog:[],runChanges:[],generatedCounter:0};redacted.player={name:publicOpponent.name,hp:publicOpponent.hp,maxHp:publicOpponent.maxHp,shield:publicOpponent.shield,mana:publicOpponent.mana,maxMana:publicOpponent.maxMana,hand:[],deck:[],rest:[],excluded:[],inFlight:[],runes:clone(b.player.runes||[]),handCount:publicOpponent.handCount,deckCount:publicOpponent.deckCount,restCount:publicOpponent.restCount,passives:[],status:{cardLocks:[],foresightTurns:[]},playedThisTurn:publicOpponent.playedThisTurn,heroPower:publicOpponent.heroPower,fatigueExtra:publicOpponent.fatigueExtra,usedThisTurn:[],lastTurnCards:[]};
    redacted.player.status.poison=(b.player.status||{}).poison||0;
    redacted.player.status.cosmicBonus=(b.player.status||{}).cosmicBonus||0;
    redacted.player.status.cardLocks=clone((b.player.status||{}).cardLocks||[]);
    redacted.player.status.cards={effects:((((b.player.status||{}).cards||{}).effects)||[]).filter(function(e){return ['healScale','forbiddenElements','elementOverride'].indexOf(e.kind)>=0;}).map(clone)};
    redactTrapChoices(redacted.enemy.status,'enemy','enemy');
    var ctx=context(redacted,c,function(){return 0.5;},{side:'enemy'},[]),f=redacted.enemy,eligible=[];
    f.hand.forEach(function(card){var d=ctx.def(card);if(d.rule==='poison_powder'&&f.heroPower&&f.heroPower.id==='ivysaur'&&(b.player.drawnCountThisTurn||0)<2)return;if(A4.AIEvaluation){var evaluation=A4.AIEvaluation.evaluateCard(d,f,redacted.player,redacted,c);if(evaluation.cleanseAllowed===false||evaluation.prayerAllowed===false)return;}if(usable(ctx,'enemy',card).allowed&&(f.hand.length<=1||d.rule!=='불안정한 원소'))eligible.push(card);});
    var history=b.history.slice(-12),freq={};history.forEach(function(h){(h.player||[]).forEach(function(x){var el=x.element||(c.cards[x.cardId]||{}).element;if(el)freq[el]=(freq[el]||0)+1;});});
    if(observed){freq={};observed.forEach(function(x){freq[x.def.element]=(freq[x.def.element]||0)+1;});publicOpponent.knownSubmission=observed.map(function(x){return clone(x.def);});}
    if(!Object.keys(freq).length){Object.keys(COUNTERS).forEach(function(el){freq[el]=1;});}
    var publicPrediction=!observed&&A4.AIEvaluation?A4.AIEvaluation.predict(redacted,c):null;
    if(publicPrediction)freq=publicPrediction.elements;
    var total=Object.keys(freq).reduce(function(n,k){return n+freq[k];},0)||1;
    var best={uids:[],heroPower:false,score:0},power=f.heroPower,powerAllowed=power&&power.kind==='active'&&f.heroPowerUsedTurn!==b.turn&&(f.heroPowerReadyTurn||0)<=b.turn;
    if(power&&power.id==='teemo'&&b.player.deck.filter(function(x){return x.cardId==='poisonous_mushroom';}).length>3)powerAllowed=false;
    if(power&&power.id==='plague_doctor'&&f.heroPowerUsedTurn>=0&&f.heroPowerUsedTurn===b.turn-1)powerAllowed=false;
    if(power&&power.id==='ivysaur'&&((b.player.status||{}).poison||0)>0&&((b.player.status||{}).poison||0)<3)powerAllowed=false;
    var pdata={side:'enemy',power:power,allowed:!!powerAllowed};ctx.modify('powerUsable',pdata);powerAllowed=pdata.allowed;
    var pcost=powerAllowed?ctx.powerCost('enemy',power):100,pscore=powerAllowed?powerValue(power,f,redacted.player,redacted,ctx):0;
    if(powerAllowed&&power.id==='nurture')pscore=f.hand.length?f.hand.filter(function(x){return ctx.def(x).cost>0;}).length/f.hand.length*2:0;
    var max=1<<Math.min(eligible.length,12);
    for(var mask=0;mask<max;mask++)for(var useP=0;useP<=(powerAllowed?1:0);useP++){
      var sum=useP?pcost:0,score=useP?pscore:0,ids=[],seen={},valid=true,selected=[],damageSum=0;
      for(var ci=0;ci<eligible.length;ci++)if(mask&(1<<ci))selected.push(eligible[ci]);
      selected.sort(function(a,z){return actionPriority(ctx.def(a))-actionPriority(ctx.def(z));});
      var batchCost=(useP?pcost:0)+selected.reduce(function(n,card,index){return n+ctx.cost('enemy',card,index===0&&f.playedThisTurn===0);},0);
      if(batchCost>f.mana)continue;
      if(observed){redacted.player.knownSubmission=observed.map(function(x){return clone(x.def);});redacted.player.knownSubmissionTurn=redacted.turn;redacted.player.knownSubmissionPhase=redacted.phase;}
      var batch=A4.AIEvaluation&&A4.AIEvaluation.evaluateBatch(selected.map(function(card,index){return {card:card,def:ctx.def(card),paidCost:ctx.cost('enemy',card,index===0&&f.playedThisTurn===0)};}),f,redacted.player,redacted,c,batchCost);if(batch&&!batch.allowed)continue;
      var prayerOwn=f,prayerFoe=redacted.player;if(f.heroPower&&f.heroPower.id==='yuumi'){prayerOwn=clone(f);prayerFoe=clone(redacted.player);}
      for(var i=0;i<selected.length;i++){
        var card=selected[i],def=ctx.def(card),cost=ctx.cost('enemy',card,ids.length===0&&f.playedThisTurn===0);
        if(def.rule==='salvation_prayer'&&f.heroPower&&f.heroPower.id==='yuumi'&&A4.AIEvaluation){var prayer=A4.AIEvaluation.prayerPolicy(def,prayerOwn,prayerFoe,redacted,c);if(!prayer.allowed){valid=false;break;}prayerOwn.hp+=prayer.selfHeal;prayerFoe.hp+=prayer.otherHeal;if(prayer.otherHeal>0)prayerOwn.status.yuumiHealTurn=b.turn;}
        if((def.limited||def.rule==='금단의 불꽃')&&seen[card.cardId]){valid=false;break;}seen[card.cardId]=true;sum+=cost;ids.push(card.uid);
        var chance=(freq[COUNTERS[def.element]]||0)/total,against=0;
        Object.keys(COUNTERS).forEach(function(el){if(COUNTERS[el]===def.element||(def.unstable&&el===def.element))against+=(freq[el]||0)/total;});
        score+=((def.rule==='금단의 불꽃'||def.rule==='boo_ghost_raider')&&batch?batch.metrics[i].score:basicScore(def,f,publicOpponent))*(1-against*(observed?1:0.45))+chance*(observed?4:publicPrediction&&publicPrediction.constrained?4*(1-publicPrediction.passChance):1.4)-cost*0.15;
        if(A4.AIEvaluation){var evaluation=A4.AIEvaluation.evaluateCard(def,f,redacted.player,redacted,c);score+=(evaluation.cleanseBonus||0)+(evaluation.prayerBonus||0)-(evaluation.fullHealthPenalty||0);}
        damageSum+=((def.rule==='금단의 불꽃'||def.rule==='boo_ghost_raider')&&batch?batch.metrics[i].damage:damageEstimate(def))*(1-against*(observed?1:0.4));
        if(def.unstable)score-=against*0.8;
      }
      if(!valid||sum>f.mana)continue;
      selected.forEach(function(card){if(batch&&ctx.def(card).rule==='금단의 불꽃')return;score+=comboValue(ctx.def(card),f,publicOpponent,b,f.hand.length-selected.length,sum,damageSum);});
      if(damageSum>=publicOpponent.hp+publicOpponent.shield)score+=45;
      // MAIN1 preserves some mana/cards for information and cards drawn this phase.
      if(b.phase==='MAIN1')score+=(batch?batch.mana:f.mana-sum)*0.48-Math.max(0,ids.length-2)*0.15;
      if(score>best.score+0.00001){best={uids:ids,heroPower:!!useP,score:score};}
    }
    return best;
  }
  function plan(b,c,rng,observed){return A4.AI?A4.AI.plan(b,c,rng,observed):legacyPlan(b,c,rng,observed);}
  function preparePlan(b,c,rng){if(b._aiSimulation){b.enemyPlan=[];b.enemyPowerPlan=false;b.enemyPlanDeferred=false;return;}var p=plan(b,c,rng);b.enemyPlan=p.uids;b.enemyPowerPlan=p.heroPower;b.enemyPlanTurn=b.turn;b.enemyPlanPhase=b.phase;b.enemyPlanDeferred=b.enemy.status.foresightTurns.indexOf(b.turn)>=0&&b.player.status.foresightTurns.indexOf(b.turn)<0;}
  function event(ctx,e){
    if(e.type==='standby')SIDES.forEach(function(side){var f=ctx.fighter(side),amount=f.status.poison||0;
      if(amount){ctx.withSource(side,{name:'중독',element:'NATURE'},function(){ctx.damage(other(side),side,amount,{card:null,noBonus:true});});
        if(!(A4.TreasureRules&&A4.TreasureRules.owns&&A4.TreasureRules.owns(ctx.fighter(other(side)),'decay_potion')))f.status.poison=Math.max(0,amount-1);
      }
    });
    modules().forEach(function(m){if(m.hook)m.hook(ctx,e);});
  }
  function dispatch(ctx,t){
    var module=t.module==='cards'?A4.CardRules:t.module==='treasures'?A4.TreasureRules:t.module==='boss'?A4.BossRules:t.module==='keywords'?A4.Keywords:t.module==='classes'?A4.Classes:t.module==='expansion'?A4.Expansion:t.module==='runes'?A4.Runes:null;
    if(module&&module.run&&module.run(ctx,t)===true)return true;
    if(!t.module){var list=modules();for(var i=0;i<list.length;i++)if(list[i].run&&list[i].run(ctx,t)===true)return true;}
    return false;
  }
  function cardTask(entry,side,free){var d=entry.def;return {kind:'card',module:d.module||(d.treasure?'treasures':d.exclusive?'boss':'cards'),side:side,card:clone(entry.card),def:clone(d),targets:clone(entry.targets||[]),critical:!!entry.didCounter,free:!!free,fromDraw:!!entry.fromDraw,step:0};}
  function effect(ctx,t){
    var e=t.effect,s=t.side,opp=other(s),targets=e.target==='both'?SIDES:[e.target==='opponent'?opp:s],f=ctx.battle[s];
    if(A4.Keywords&&A4.Keywords.effect(ctx,t))return;
    switch(e.type){
    case 'damage':ctx.damage(s,e.target==='self'?s:opp,e.amount);break;
    case 'discountRandomHand':var discounted=ctx.pick(f.hand.filter(function(x){return ctx.cost(s,x)>0;}));if(discounted){var beforeCost=ctx.cost(s,discounted);discounted.costDelta=(discounted.costDelta||0)-e.amount;discounted.costFloor=0;var afterCost=ctx.cost(s,discounted);ctx.note('discount',s,beforeCost-afterCost,{text:beforeCost+' → '+afterCost,cards:s==='player'?[label(ctx.def(discounted))]:null});}else ctx.note('powerNoTarget',s,0);break;
    case 'randomPoison':ctx.poison(s,opp,e.min+Math.floor(ctx.rng()*(e.max-e.min+1)));break;
    case 'heal':targets.forEach(function(x){ctx.heal(x,e.amount);});break;
    case 'shield':targets.forEach(function(x){ctx.shield(x,e.amount);});break;
    case 'draw':targets.forEach(function(x){ctx.draw(x,e.amount);});break;
    case 'randomDamage':ctx.damage(s,opp,e.min+Math.floor(ctx.rng()*(e.max-e.min+1)));break;
    case 'overload':ctx.overload(s,e.amount);break;
    case 'mana':ctx.mana(s,e.amount,e.recover);break;
    case 'generate':for(var i=0;i<(e.amount||1);i++)ctx.generate(e.target==='opponent'?opp:s,e.cardId,{upgraded:!!e.upgraded,zone:e.zone||'hand'});break;
    case 'growMana':if(f.maxMana<5){f.manaGrowth+=e.amount;f.maxMana=Math.min(5,f.maxMana+e.amount);}else if(e.cardId)ctx.generate(s,e.cardId,{upgraded:!!e.upgraded});break;
    case 'lockCards':ctx.lock(opp,ctx.battle.turn+e.from,ctx.battle.turn+e.until,e.elements);break;
    case 'foresight':f.status.foresightTurns.push(ctx.battle.turn+e.amount);break;
    case 'scheduledDamage':for(var j=1;j<=e.turns;j++)ctx.schedule(ctx.battle.turn+j,'STANDBY',{kind:'effect',side:s,card:t.card,effect:{type:'damage',amount:e.amount}});break;
    case 'excludeSelf':ctx.move(s,t.card.uid,'excluded');break;
    case 'removeFromRun':ctx.move(s,t.card.uid,'excluded');ctx.runChange({type:'removeCard',side:s,uid:t.card.uid});ctx.battle.removedFromRun.push(t.card.uid);break;
    case 'upgradeSelf':var live=ctx.find(s,t.card.uid);if(live)ctx.upgrade(live);break;
    case 'dredge':ctx.discover(s,f.deck.slice(-e.amount),{kind:'coreChoice',side:s,op:'dredge'},{label:'덱 맨 위에 놓을 카드를 선택하세요.',sourceZone:'deck'});break;
    default:A4.assert(false,'처리되지 않은 카드 효과: '+e.type);
    }
  }
  function scheduled(ctx,phase){var b=ctx.battle,remaining=[];b.scheduled.forEach(function(x){if(x.turn===b.turn&&x.phase===phase)ctx.enqueue(x.task);else if(x.turn>=b.turn)remaining.push(x);});b.scheduled=remaining;}
  function core(ctx,t){
    var b=ctx.battle,s=t.side||'player',f=b[s],i,d,card,entries;
    if(t.kind==='effect'&&t.runeSource){var activeRune=A4.Runes.current(b[t.runeSource.side]);if(!activeRune||activeRune.uid!==t.runeSource.uid||t.runeSource.activation!==undefined&&activeRune.runeActivationId!==t.runeSource.activation)return;}
    if(t.kind==='event'){
      if(b.resolution.suppressed&&['draw','cardRest','damage','heal','counter','powerUsed','cardUsed','cardResolved','discovered','overload','refill'].indexOf(t.event.type)>=0)return;
      // Events store snapshots for recovery but live-instance mutations must affect
      // the owning zone (temporary upgrades and aura metadata in particular).
      if(t.event.card&&t.event.card.uid&&t.event.side){var liveCard=ctx.find(t.event.side,t.event.card.uid);if(liveCard)t.event.card=liveCard;}
      event(ctx,t.event);return;
    }
    if(t.kind==='choiceRequest'){
      var settings=t.settings||{},resume=clone(t.continuation),options=t.options;
      if(s==='enemy'||b._aiSimulation){
        var choiceBattle=b._aiSimulation?b:(A4.AI?A4.AI.publicSnapshot(b,ctx.catalog):b);
        var selected=A4.AIChoices?A4.AIChoices.choose(options,choiceBattle,ctx.catalog,settings,resume):bestChoice(options,b[s],ctx.catalog);resume.choice=clone(selected);resume.options=clone(options);
        if(settings.discover)resume.discoveryEvent={type:'discovered',side:s,choice:clone(selected),options:clone(options),sourceZone:settings.sourceZone||null};
        ctx.enqueue(resume);
      }else{A4.assert(!b.pendingChoice,'동시에 두 선택을 요청할 수 없습니다.');b.pendingChoice={kind:settings.discover?'discovery':'choice',discover:!!settings.discover,label:settings.label||'카드를 선택하세요.',options:clone(options),continuation:resume,sourceZone:settings.sourceZone||null,lamp:!!settings.lamp,lampStage:settings.lamp?'search':null};}
      return;
    }
    if(t.kind==='effect'){effect(ctx,t);return;}
    if(t.kind==='coreChoice'){
      if(t.op==='dredge'){card=ctx.remove(s,t.choice.uid);if(card){f.deck.unshift(card);if(ctx.cost(s,card)<=f.mana)ctx.draw(s,1);}}return;
    }
    if(t.kind==='card'){
      if(b.resolution.suppressed&&t.free&&!t.reflected)return;
      if(t.def.rune&&A4.Runes)A4.Runes.activate(ctx,t);
      if(t.def.rule){A4.assert(dispatch(ctx,t),'카드 구현 누락: '+t.def.name);return;}
      (t.def.effects||[]).forEach(function(e){if(!e.critical||t.critical)ctx.enqueue({kind:'effect',side:s,card:t.card,effect:e});});return;
    }
    if(t.kind==='power'){
      if(t.power.rule||t.power.module){A4.assert(dispatch(ctx,t),'영웅 능력 구현 누락: '+t.power.name);}
      else (t.power.effects||[]).forEach(function(e){ctx.enqueue({kind:'effect',side:s,effect:e});});
      ctx.emit('powerUsed',{side:s,power:t.power});return;
    }
    if(t.kind==='cast'){
      if(b.resolution.suppressed){if(!t.copy&&ctx.find(s,t.card.uid))ctx.enqueue({kind:'finalizeCard',side:s,card:t.card,countered:false});return;}
      card=t.card;d=ctx.def(card);if(t.copy){f.inFlight.push(card);}else if(!ctx.find(s,card.uid))f.inFlight.push(card);
      var parent=t.displayNode&&b.report&&t.displayNode.serial===b.report.serial?t.displayNode.id:null,castNode=node(b,s,d,card,parent);
      t.displayNode={serial:b.report.serial,id:castNode.id};t.displaySource={side:s,label:castNode.label};
      ctx.emit('cardUsed',{side:s,card:card,def:d,free:true,countered:false,critical:false});
      ctx.enqueue(cardTask({card:card,def:d,fromDraw:t.fromDraw},s,true));ctx.emit('cardResolved',{side:s,card:card,def:d,free:true,countered:false,critical:false});ctx.enqueue({kind:'finalizeCard',side:s,card:card,countered:false});return;
    }
    if(t.kind==='finalizeCard'){
      var l=locate(f,t.card.uid);if(!l.card||l.zone!=='inFlight')return;card=l.card;d=ctx.def(card);
      if(card.originalCardId){card.cardId=card.originalCardId;card.upgraded=card.originalCardId==='crystal_ball'?!!card.crystalUpgraded:false;delete card.noUpgrade;delete card.cost;delete card.costDelta;delete card.element;delete card.originalCardId;delete card.transformed;d=ctx.def(card);}
      if(card.swallowedBy)ctx.withSource(card.swallowedBy,A4.BossRules.power('piranha_plant'),function(){ctx.move(s,card.uid,'excluded',{logEffect:true});});
      else ctx.move(s,card.uid,(!t.countered&&d.excludeOnUse)?'excluded':'rest');return;
    }
    if(t.kind==='phase'){
      if(t.op==='opening'){
        SIDES.forEach(function(side){var p=b[side],innate=p.deck.filter(function(x){return ctx.def(x).innate;}).slice(0,4);innate.forEach(function(x){ctx.move(side,x.uid,'hand');});ctx.draw(side,4-p.hand.length,null,{opening:true});});
        b.phase='STANDBY';ctx.emit('battleStart',{});ctx.emit('standby',{opening:true});ctx.emit('beforeDeath',{phase:'STANDBY'});ctx.enqueue({kind:'phase',op:'death',next:'main1'});return;
      }
      if(t.op==='main'){
        b.phase=t.phase;b.phaseSerial++;scheduled(ctx,t.phase);ctx.emit('beforeMain',{phase:t.phase});ctx.emit('beforeDeath',{phase:t.phase});ctx.enqueue({kind:'phase',op:'death',next:'ready'});return;
      }
      if(t.op==='ready'){preparePlan(b,ctx.catalog,ctx.rng);return;}
      if(t.op==='afterCombat'){
        ctx.emit('mainSubmissionResolved',{entries:clone(b.resolution.entries),phase:b.phase});
        ctx.emit('beforeDeath',{phase:b.phase});ctx.enqueue({kind:'phase',op:'death',next:b.phase==='MAIN1'?'main2':'end'});return;
      }
      if(t.op==='death'){
        if(b.restartRequested){
          var changes=clone(b.runChanges),specs=clone(b.restartSpecs),serial=b.phaseSerial,generated=b.generatedCounter;
          changes.forEach(function(change){if(change.type==='removeTreasure'){var id=change.treasureId||change.id,who=change.side||'player';specs[who].treasureIds=(specs[who].treasureIds||[]).filter(function(x){return x!==id;});specs[who].passives=(specs[who].passives||[]).filter(function(x){return x.treasureId!==id&&x.id!==id&&x.rule!==id;});}});
          var restarted=create(specs.player,specs.enemy,ctx.catalog,ctx.rng,b._aiSimulation?{simulation:true,steps:b._aiStepsRemaining}:null),keys=Object.keys(b);keys.forEach(function(k){delete b[k];});Object.keys(restarted).forEach(function(k){b[k]=restarted[k];});b.runChanges=changes;b.phaseSerial=Math.max(serial+1,b.phaseSerial);b.generatedCounter=Math.max(generated,b.generatedCounter);b.lastLog.unshift('귀환석 — 같은 상대와 전투를 다시 시작합니다.');report(b).logs.unshift({type:'text',text:'귀환석으로 같은 상대와 전투를 다시 시작합니다.'});return;
        }
        if(b.preventDeath){b.preventDeath=false;return;}
        if(b.player.hp<=0||b.specialDefeat){b.outcome='defeat';b.resolution.queue=[];return;}
        if(b.enemy.hp<=0||b.specialVictory){b.outcome='victory';b.resolution.queue=[];return;}
        if(t.next==='ready')ctx.enqueue({kind:'phase',op:'ready'});
        if(t.next==='main2')ctx.enqueue({kind:'phase',op:'main',phase:'MAIN2'});
        if(t.next==='end')ctx.enqueue({kind:'phase',op:'end'});
        if(t.next==='standby')ctx.enqueue({kind:'phase',op:'standby'});
        if(t.next==='main1')ctx.enqueue({kind:'phase',op:'main',phase:'MAIN1'});return;
      }
      if(t.op==='end'){
        b.phase='END';scheduled(ctx,'END');ctx.emit('end',{});ctx.enqueue({kind:'phase',op:'cleanup'});return;
      }
      if(t.op==='cleanup'){
        SIDES.forEach(function(side){b[side].hand.slice().forEach(function(x){var def=ctx.def(x);if(def.volatile){ctx.move(side,x.uid,'excluded');return;}if((def.temporary||A4.TreasureRules&&A4.TreasureRules.owns&&A4.TreasureRules.owns(b[side],'time_potion'))&&x.temporaryUntil===undefined)x.temporaryUntil=b.turn;if(x.temporaryUntil!==undefined&&x.temporaryUntil<=b.turn)ctx.move(side,x.uid,'rest');});});
        ctx.emit('afterEnd',{});ctx.enqueue({kind:'phase',op:'clearShields'});ctx.emit('beforeDeath',{phase:'END'});ctx.enqueue({kind:'phase',op:'death',next:'standby'});return;
      }
      if(t.op==='clearShields'){SIDES.forEach(function(side){b[side].shield=0;});return;}
      if(t.op==='standby'){
        b.turn++;b.phase='STANDBY';
        SIDES.forEach(function(side){var p=b[side];p.lastTurnCards=clone(p.usedThisTurn);p.usedThisTurn=[];p.playedThisTurn=0;p.limitedUsed={};p.damageTakenLastTurn=p.damageTakenThisTurn;p.damageTakenThisTurn=0;p.drawnCountThisTurn=0;p.maxMana=Math.max(0,Math.min(5,ctx.modify('maximumMana',{side:side,value:2+Math.floor((b.turn+1)/5)+p.manaGrowth}).value));p.overloadLocked=Math.min(p.maxMana,p.overloadNext);p.mana=Math.max(0,p.maxMana-p.overloadNext);p.overloadNext=0;
          var data=ctx.modify('basicDraw',{side:side,replace:false});if(!data.replace)ctx.draw(side,data.count||1,null,{basic:true});
          p.passives.forEach(function(pass){if(pass.type==='turnDrawBonus')ctx.draw(side,pass.amount);});
        });
        scheduled(ctx,'STANDBY');ctx.emit('standby',{});ctx.enqueue({kind:'phase',op:'fatigue'});return;
      }
      if(t.op==='fatigue'){
        if(b.turn+1>=20)SIDES.forEach(function(side){ctx.fatigue(other(side),side,false);});
        ctx.emit('beforeDeath',{phase:'STANDBY'});ctx.enqueue({kind:'phase',op:'death',next:'main1'});return;
      }
    }
    A4.assert(dispatch(ctx,t),'처리되지 않은 전투 작업: '+(t.op||t.kind));
  }
  function process(b,c,rng){
    while(b.resolution&&b.resolution.queue.length&&!b.pendingChoice&&b.outcome==='ongoing'){
      if(b._aiSimulation){if(A4.AI)A4.AI.checkDeadline();if(--b._aiStepsRemaining<0)throw new Error('AI_SIMULATION_LIMIT');}
      b.resolution.steps=(b.resolution.steps||0)+1;
      if(b.resolution.steps>2000&&!b.resolution.suppressed){b.resolution.suppressed=true;b.lastLog.push('반복 효과가 2,000회를 넘어 추가 연쇄 발동을 멈춥니다. 제출한 카드와 페이즈 처리는 계속됩니다.');report(b).logs.push({type:'text',text:'반복 효과가 2,000회를 넘어 추가 연쇄 발동을 멈춥니다. 제출한 카드와 페이즈 처리는 계속됩니다.'});}
      var t=b.resolution.queue.shift(),spawned=[];if(t.discoveryEvent)t.discoveryEvent.beforeHandUids=b[t.side].hand.map(function(x){return x.uid;});core(context(b,c,rng,t,spawned),t);if(A4.Keywords)SIDES.forEach(function(side){A4.Keywords.observe(b[side]);});
      if(b.escapeRequested){b.resolution=null;b.pendingChoice=null;break;}
      if(t.discoveryEvent){t.discoveryEvent.castUids=spawned.filter(function(x){return x.kind==='cast'&&x.side===t.side;}).map(function(x){return x.card.uid;});spawned.unshift({kind:'event',side:t.side,event:clone(t.discoveryEvent)});}
      if(b.resolution) b.resolution.queue=spawned.concat(b.resolution.queue);
    }
    if(b.resolution&&!b.resolution.queue.length&&!b.pendingChoice)b.resolution=null;
    return {outcome:b.outcome,log:clone(b.lastLog),pending:!!b.pendingChoice,removedFromRun:clone(b.removedFromRun)};
  }
  function create(p,e,c,rng,internalOptions){
    var b={rulesVersion:3,turn:0,phase:'MAIN1',phaseSerial:0,outcome:'ongoing',player:fighter(p,c,rng),enemy:fighter(e,c,rng),enemyPlan:[],enemyPowerPlan:false,enemyPlanTurn:0,enemyPlanPhase:'MAIN1',enemyPlanDeferred:false,history:[],generatedCounter:0,removedFromRun:[],runChanges:[],scheduled:[],pendingChoice:null,lastLog:[],resolution:{queue:[{kind:'phase',op:'opening'}],entries:null},restartSpecs:{player:clone(p),enemy:clone(e)}};
    if(internalOptions&&internalOptions.simulation){b._aiSimulation=true;b._aiStepsRemaining=internalOptions.steps===undefined?400:internalOptions.steps;}
    if(internalOptions&&internalOptions.publicPlayerHistory)b.publicPlayerHistory=clone(internalOptions.publicPlayerHistory);
    // The initial deck composition is public; current zones and draw order are not.
    b.publicPlayerDeck=(p.deck||[]).map(function(card){var known={cardId:card.cardId,upgraded:!!card.upgraded};['cost','costDelta','costFloor','element'].forEach(function(k){if(card[k]!==undefined)known[k]=card[k];});return known;}).sort(function(a,z){return JSON.stringify(a).localeCompare(JSON.stringify(z));});
    process(b,c,rng);return b;
  }
  function validateSubmission(ctx,s,uids,usePower){
    var f=ctx.battle[s],cards=[],seen={},limited={},cost=0,bloodCost=0;var submission=ctx.modify('submission',{side:s,uids:uids,allowed:true});A4.assert(submission.allowed,submission.reason||'제출할 수 없는 행동입니다.');
    uids.forEach(function(uid){A4.assert(!seen[uid],'같은 카드를 중복 제출할 수 없습니다.');seen[uid]=true;var card=f.hand.filter(function(x){return x.uid===uid;})[0];A4.assert(card,'손에 없는 카드입니다.');var u=usable(ctx,s,card);A4.assert(u.allowed,u.reason);var d=ctx.def(card);if(d.limited){A4.assert(!limited[card.cardId],'제한 카드는 한 턴에 한 장만 사용할 수 있습니다.');limited[card.cardId]=true;}var paidCost=ctx.cost(s,card,cards.length===0&&f.playedThisTurn===0),observed=ctx.battle._aiObservedCosts;if(ctx.battle._aiSimulation&&s==='player'&&ctx.battle._aiObservedCostTurn===ctx.battle.turn&&ctx.battle._aiObservedCostPhase===ctx.battle.phase&&observed&&observed[card.uid]!==undefined)paidCost=observed[card.uid];if(d.bloodCost!==undefined)bloodCost+=paidCost;else cost+=paidCost;cards.push({card:card,def:d,paidCost:paidCost,bloodPaid:d.bloodCost!==undefined?paidCost:0,countered:false,didCounter:false,targets:[],side:s});});
    if(usePower){var power=f.heroPower;A4.assert(power&&power.kind==='active','사용형 영웅 능력이 없습니다.');var allowed=f.heroPowerUsedTurn!==ctx.battle.turn&&(f.heroPowerReadyTurn||0)<=ctx.battle.turn;var data=ctx.modify('powerUsable',{side:s,power:power,allowed:allowed,bloodAvailable:(f.bloodstones||0)-bloodCost});A4.assert(data.allowed,'이번 턴에는 영웅 능력을 사용할 수 없습니다.');cost+=ctx.powerCost(s,power);}
    var hpCost=0;if(A4.Classes&&A4.Classes.alive(f,'hireek').length){hpCost=cards.reduce(function(sum,x){return sum+(x.def.bloodCost===undefined?x.paidCost*5:0);},0);cost-=hpCost/5;A4.assert(hpCost<f.hp,'카드 비용으로 지불할 체력이 부족합니다.');}
    A4.assert(cost<=f.mana,'마나가 부족합니다.');A4.assert(bloodCost<=(f.bloodstones||0),'혈석이 부족합니다.');return {cards:cards,cost:cost,hpCost:hpCost,bloodCost:bloodCost,power:!!usePower};
  }
  function submit(b,uids,c,rng,options){
    options=options||{};A4.assert(b.outcome==='ongoing'&&!b.pendingChoice&&!b.resolution,'현재 제출할 수 없습니다.');A4.assert(b.phase==='MAIN1'||b.phase==='MAIN2','메인 페이즈가 아닙니다.');
    var initialTasks=[],ctx=context(b,c,rng,{side:'player'},initialTasks),p=validateSubmission(ctx,'player',uids,options.heroPower);
    if(b.enemyPlanDeferred&&b.player.status.foresightTurns.indexOf(b.turn)<0){var reactive=plan(b,c,rng,p.cards);b.enemyPlan=reactive.uids;b.enemyPowerPlan=reactive.heroPower;}
    var e=validateSubmission(ctx,'enemy',b.enemyPlan||[],b.enemyPowerPlan),groups={player:p.cards,enemy:e.cards};
    b.lastLog=[];b.report={turn:b.turn,phase:b.phase,serial:b.phaseSerial,submitted:true,nodes:[],logs:[]};b.resolution={queue:[],entries:groups,phase:b.phase};
    SIDES.forEach(function(s){var chosen=s==='player'?p:e;if(chosen.power){var pn=node(b,s,b[s].heroPower,null);pn.power=true;}chosen.cards.forEach(function(entry){entry.displayId=node(b,s,entry.def,entry.card).id;});});
    SIDES.forEach(function(s){var chosen=s==='player'?p:e,names=chosen.cards.map(function(x){return x.def.name;});if(chosen.power)names.push('능력: '+b[s].heroPower.name);ctx.log(b[s].name+' 제출 — '+(names.join(', ')||'쉬기'));});
    SIDES.forEach(function(s){var plan=s==='player'?p:e,f=b[s];f.mana-=plan.cost;f.hp-=plan.hpCost||0;if(plan.bloodCost){f.bloodstones-=plan.bloodCost;ctx.runChange({type:'bloodstones',side:s,amount:f.bloodstones});}if(plan.power){f.heroPowerUsedTurn=b.turn;if(f.heroPower.cooldown)f.heroPowerReadyTurn=b.turn+f.heroPower.cooldown;}plan.cards.forEach(function(entry){ctx.move(s,entry.card.uid,'inFlight');f.playedThisTurn++;if(entry.def.limited)f.limitedUsed[entry.card.cardId]=b.turn;f.usedThisTurn.push({cardId:entry.card.cardId,uid:entry.card.uid,upgraded:entry.card.upgraded,element:entry.def.element,card:clone(entry.card),turn:b.turn,phase:b.phase});});});
    p.cards.forEach(function(a){e.cards.forEach(function(z){if(a.def.element!=='CURSE'&&z.def.element!=='CURSE'&&(COUNTERS[a.def.element]===z.def.element||((a.def.overpower||z.def.unstable)&&a.def.element===z.def.element))){z.countered=true;a.didCounter=true;a.targets.push(clone(z.card));}if(a.def.element!=='CURSE'&&z.def.element!=='CURSE'&&(COUNTERS[z.def.element]===a.def.element||((z.def.overpower||a.def.unstable)&&a.def.element===z.def.element))){a.countered=true;z.didCounter=true;z.targets.push(clone(a.card));}});});
    SIDES.forEach(function(s){groups[s].forEach(function(entry){entry.elementCountered=entry.countered;});});
    ctx.modify('beforeCardCounterPower',{entries:groups,powers:{player:p.power,enemy:e.power}});
    SIDES.forEach(function(s){groups[s].forEach(function(entry){entry.counterEligible=!entry.countered;});});
    ctx.modify('beforeCounter',{entries:groups,powers:{player:p.power,enemy:e.power}});
    ctx.modify('afterCounter',{entries:groups,powers:{player:p.power,enemy:e.power}});
    SIDES.forEach(function(s){groups[s].forEach(function(entry){b.report.nodes[entry.displayId].countered=entry.countered;});});
    var queue=b.resolution.queue;initialTasks.forEach(function(t){queue.push(t);});
    SIDES.forEach(function(s){groups[s].forEach(function(entry,index){queue.push({kind:'event',side:s,event:{type:'cardUsed',side:s,card:clone(entry.card),def:clone(entry.def),paidCost:entry.paidCost,manaPaid:entry.def.bloodCost!==undefined||(s==='player'?p:e).hpCost?0:entry.paidCost,bloodPaid:entry.bloodPaid||0,free:false,countered:entry.countered,critical:entry.didCounter,ordinal:b[s].playedThisTurn-groups[s].length+index+1}});if(entry.didCounter)queue.push({kind:'event',side:s,event:{type:'counter',side:s,card:clone(entry.card),targets:clone(entry.targets)}});});});
    SIDES.forEach(function(s){var pl=s==='player'?p:e;if(pl.power)queue.push({kind:'power',module:b[s].heroPower.module||'boss',side:s,power:clone(b[s].heroPower)});groups[s].forEach(function(entry){if(!entry.countered){queue.push(cardTask(entry,entry.reflectedBy||s,!!entry.reflectedBy));queue.push({kind:'event',side:s,event:{type:'cardResolved',side:s,card:clone(entry.card),def:clone(entry.def),free:false,countered:false,critical:entry.didCounter}});}else b.lastLog.push(entry.def.name+' 카운터');});});
    SIDES.forEach(function(s){groups[s].forEach(function(entry){queue.push({kind:'finalizeCard',side:s,card:clone(entry.card),countered:entry.countered});});});
    b.history.push({turn:b.turn,phase:b.phase,player:p.cards.map(function(x){return {cardId:x.card.cardId,upgraded:!!x.card.upgraded,element:x.def.element,countered:x.countered};}),enemy:e.cards.map(function(x){return {cardId:x.card.cardId,upgraded:!!x.card.upgraded,element:x.def.element,countered:x.countered};})});
    queue.push({kind:'phase',op:'afterCombat'});return process(b,c,rng);
  }
  function choiceOptions(p){
    var op=p.continuation&&p.continuation.op;
    if(op!=='iceTrap'&&op!=='elementChoice')return p.options;
    var order=['FIRE','NATURE','LIGHTNING','ICE','HOLY'];
    return p.options.filter(function(x){return order.indexOf(x.id)>=0;}).sort(function(a,b){return order.indexOf(a.id)-order.indexOf(b.id);});
  }
  function choose(b,index,c,rng){
    A4.assert(b.pendingChoice,'선택할 효과가 없습니다.');var p=b.pendingChoice;p.options=choiceOptions(p);A4.assert(index>=0&&index<p.options.length,'선택 번호가 올바르지 않습니다.');var t=clone(p.continuation);t.choice=clone(p.options[index]);t.options=clone(p.options);b.pendingChoice=null;
    if(p.discover)t.discoveryEvent={type:'discovered',side:t.side,choice:clone(t.choice),options:clone(t.options),sourceZone:p.sourceZone};b.resolution.queue.unshift(t);return process(b,c,rng);
  }
  function view(b){var v={turn:b.turn,phase:b.phase,outcome:b.outcome,player:clone(b.player),enemy:publicFighter(b.enemy),history:clone(b.history),lastLog:clone(b.lastLog),enemyReacting:b.enemy.status.foresightTurns.indexOf(b.turn)>=0&&b.player.status.foresightTurns.indexOf(b.turn)<0};redactTrapChoices(v.player.status,'player','player');if(b.player.status.foresightTurns.indexOf(b.turn)>=0&&b.enemy.status.foresightTurns.indexOf(b.turn)<0)v.foreseenCards=b.enemyPlan.map(function(uid){return clone(locate(b.enemy,uid).card);});return v;}
  function sync(b,passives){b.player.passives=clone(passives);}
  function validateCard(card,c){var d=describe(card,c);A4.assert(A4.integer(d.cost,0)&&d.cost<=5,'카드 비용이 올바르지 않습니다.');A4.assert(d.rule||Array.isArray(d.effects),'카드 효과가 없습니다.');if(d.rule){var m=d.module==='expansion'?A4.Expansion:d.module==='classes'?A4.Classes:d.module==='treasures'?A4.TreasureRules:d.module==='boss'?A4.BossRules:A4.CardRules;if(m&&m.supports)A4.assert(m.supports(d.rule),'효과 구현이 없습니다: '+d.rule);}}
  function validatePower(power){A4.assert(power&&power.id&&power.name,'영웅 능력 정의가 필요합니다.');A4.assert(power.kind==='active'||power.kind==='passive','영웅 능력 유형이 올바르지 않습니다.');}
  function canSubmit(b,s,c,card){try{if(b.pendingChoice||b.resolution||b.outcome!=='ongoing'||['MAIN1','MAIN2'].indexOf(b.phase)<0)return false;validateSubmission(context(b,c,function(){return 0.5;},{side:s},[]),s,card?[card.uid]:[],!card);return true;}catch(error){return false;}}
  return {create:create,submit:submit,choose:choose,publicView:view,syncPassives:sync,describeCard:describe,canSubmit:canSubmit,validateSubmission:validateSubmission,legacyPlan:legacyPlan,choiceOptions:choiceOptions,cardAllowed:function(b,s,c,card){return usable(context(b,c,function(){return 0.5;},{side:s},[]),s,card).allowed;},planEnemy:function(b,c,rng){return plan(b,c,rng).uids;},plan:plan,maximumMana:function(turn){return Math.min(5,2+Math.floor(turn/5));},fatigue:function(turn){return turn<20?0:1+(turn-20);},fatigueDamage:function(turn,f){return Math.max(1,1+(turn-20))+(f&&f.fatigueExtra||0);},validateCard:validateCard,validatePassives:function(p){A4.assert(Array.isArray(p),'지속 효과 목록이 필요합니다.');},validateHeroPower:validatePower,context:context,process:process,redactTrapChoices:redactTrapChoices,handLimit:function(b,s,c){return context(b,c,function(){return 0.5;},{side:s},[]).limit(s);},cardCost:function(b,s,card,c){return context(b,c,function(){return 0.5;},{side:s},[]).cost(s,card);},powerCost:function(b,s,c){return context(b,c,function(){return 0.5;},{side:s},[]).powerCost(s);}};
}());
(function(){
  var legacy=A4.Combat;
  A4.LegacyCombat=legacy;
  ['create','submit','choose','publicView','syncPassives','describeCard','planEnemy','validateCard','validateHeroPower'].forEach(function(name){
    var old=legacy[name];A4.Combat[name]=function(){var a=arguments,cat=null,v3=false;
      if(name==='create'){cat=a[2];v3=cat&&cat.config.engineVersion===3;}
      else if(name==='describeCard'||name==='validateCard'||name==='validateHeroPower'){cat=a[1];v3=cat&&cat.config.engineVersion===3;}
      else v3=a[0]&&a[0].rulesVersion===3;
      return (v3?A4.Battle[name]:old).apply(null,a);
    };
  });
  var oldPassives=legacy.validatePassives;A4.Combat.validatePassives=function(p){if((p||[]).some(function(x){return x.type==='treasure'||x.module==='treasures'||x.module==='classes'||x.module==='expansion';}))return A4.Battle.validatePassives(p);return oldPassives(p);};
}());
