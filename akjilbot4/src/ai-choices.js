/* Contextual choices use only offered cards, the acting fighter and public information. */
A4.AIChoices=(function(){
  'use strict';
  var ELEMENTS=['FIRE','NATURE','LIGHTNING','ICE','HOLY'];
  function copy(x){return x===undefined?undefined:JSON.parse(JSON.stringify(x));}
  function opposite(s){return s==='enemy'?'player':'enemy';}
  function count(f,key){return f[key+'Count']===undefined?(f[key]||[]).length:f[key+'Count'];}
  function publicStatus(status){
    status=status||{};var out={cardLocks:copy(status.cardLocks||[]),foresightTurns:copy(status.foresightTurns||[])};
    ['deckEmptied','awakened','execution','executionTurn','warnings','salvation','cosmicBonus','baptisms','poison','directHolyUsedTurn','directHolyCountTurn','directHolyCount','ghostWalkReflectTurn','ghostWalkReflectPhase','cleansedConfession','confession'].forEach(function(key){if(status[key]!==undefined)out[key]=copy(status[key]);});
    if(status.expansion)out.expansion=copy(status.expansion);if(status.classes)out.classes=copy(status.classes);
    if(status.cards){out.cards={};['effects','ignite','currentStacks','lightningBonus','lightningLastTurn','lightningStreak','previousDamage','drawCount','drawCountTurn'].forEach(function(key){if(status.cards[key]!==undefined)out.cards[key]=copy(status.cards[key]);});}
    if(status.treasures){out.treasures={};
      // Mirage stores an unrevealed original hand here, so this is an explicit
      // allowlist rather than a clone followed by deleting known hidden fields.
      ['freeMain2Turn','escapeTurn','escapeStacks','escapeStacksTurn','previousFirstElement','main1PaidTurn','main1Paid','receiptTurn','firstElementTurn','firstElement','firstCounteredTurn','firstCounteredUid','elementCountsTurn','elementCounts','twinTriggered','twinTurn','mirrorTurn','echoTurn','savedMana'].forEach(function(key){if(status.treasures[key]!==undefined)out.treasures[key]=copy(status.treasures[key]);});
    }
    return out;
  }
  function publicFighter(f){
    var out={hand:[],deck:[],rest:[],excluded:[],inFlight:[]};
    ['heroId','fatigueExtra','bloodstones','daggers','name','hp','maxHp','shield','mana','maxMana','manaGrowth','overloadNext','overloadLocked','heroPower','heroPowerUsedTurn','heroPowerReadyTurn','playedThisTurn','damageTakenThisTurn','bossId','passives','treasureIds','limitedUsed','usedThisTurn','lastTurnCards'].forEach(function(k){if(f[k]!==undefined)out[k]=copy(f[k]);});
    ['hand','deck','rest','excluded'].forEach(function(k){out[k+'Count']=count(f,k);});
    out.runes=copy(f.runes||[]);out.status=publicStatus(f.status);return out;
  }
  function snapshot(b,side){
    var view={turn:b.turn,phase:b.phase,rulesVersion:3,history:copy(b.history||[]),scheduled:[],lastLog:[],generatedCounter:0,runChanges:[]};
    if(side==='enemy'&&b.publicPlayerDeck)view.publicPlayerDeck=copy(b.publicPlayerDeck);
    view[side]=copy(b[side]);view[opposite(side)]=publicFighter(b[opposite(side)]);['player','enemy'].forEach(function(target){A4.Battle.redactTrapChoices(view[target].status||{},target,side);});return view;
  }
  function definition(card,c){return A4.Battle.describeCard(card,c);}
  function effectiveDefinition(card,b,c,side){return A4.Battle.context(b,c,function(){return 0.5;},{side:side},[]).def(card);}
  function active(e,turn){return (e.from===undefined||e.from<=turn)&&(e.until===undefined||e.until>=turn);}
  function fallback(def,own,opp){
    var result={score:0,damage:0,heal:0,draw:0},a=def.ai||{};
    result.damage=a.damage||0;result.heal=a.heal||0;result.draw=a.draw||0;result.score=a.value||0;
    (def.effects||[]).forEach(function(e){
      if(e.type==='damage')result.damage+=e.amount||0;
      if(e.type==='randomDamage')result.damage+=((e.min||0)+(e.max||0))/2;
      if(e.type==='heal')result.heal+=e.amount||0;
      if(e.type==='draw')result.draw+=e.amount||0;
      if(e.type==='shield')result.score+=(e.amount||0)*0.5;
      if(e.type==='scheduledDamage')result.damage+=(e.amount||0)*(e.turns||1)*0.65;
    });
    result.score+=result.damage+Math.min(result.heal,Math.max(0,own.maxHp-own.hp))*(own.hp<10?1.6:0.9)+Math.min(result.draw,Math.max(0,8-own.hand.length))*2;
    if(result.damage>0&&result.damage>=opp.hp+(opp.shield||0))result.score+=50;
    return result;
  }
  function evaluation(def,own,opp,b,c){
    var result=A4.AIEvaluation&&A4.AIEvaluation.evaluateCard?A4.AIEvaluation.evaluateCard(def,own,opp,b,c):fallback(def,own,opp);
    if(typeof result==='number')return {score:result};return result;
  }
  function metric(def,own,opp,b,c){var r=evaluation(def,own,opp,b,c);return r&&typeof r.score==='number'&&isFinite(r.score)?r.score:0;}
  function manaCost(b,s,card,c){return A4.Battle.cardCost(b,s,card,c);}
  function limit(b,s,c){return A4.Battle.handLimit(b,s,c);}
  function expectedElements(b,c,target,nextTurn){
    var scores={FIRE:1,NATURE:1,LIGHTNING:1,ICE:1,HOLY:0.65},hist=b.history||[],f=b[target],turn=b.turn+(nextTurn?1:0);
    if(target==='player'&&b.publicPlayerDeck)b.publicPlayerDeck.forEach(function(card){var d=definition(card,c);if(scores[d.element]!==undefined)scores[d.element]+=0.3;});
    hist.slice(-16).forEach(function(h,index,entries){
      (h[target]||[]).forEach(function(card){var d=c.cards[card.cardId]||{},el=card.element||d.element;if(scores[el]!==undefined)scores[el]+=0.5+1.5*(index+1)/entries.length;});
    });
    var effects=f.status&&f.status.cards&&f.status.cards.effects||[],override=null;
    effects.forEach(function(e){if(e.kind==='elementOverride'&&active(e,turn))override=e.element;});
    if(override&&scores[override]!==undefined)ELEMENTS.forEach(function(el){scores[el]=el===override?100:0;});
    (f.status&&f.status.cardLocks||[]).forEach(function(lock){if(active(lock,turn))ELEMENTS.forEach(function(el){if(!lock.elements||lock.elements.indexOf(el)>=0)scores[el]=0;});});
    effects.forEach(function(e){if(e.kind==='forbiddenElements'&&active(e,turn))(e.elements||[]).forEach(function(el){scores[el]=0;});});
    return scores;
  }
  function elementValue(option,b,c,side,continuation){
    if(continuation.op==='iceTrap')return expectedElements(b,c,opposite(side),true)[option.id]||0;
    var own=b[side],zone=own.deck.length?own.deck:own.rest,cards=zone.filter(function(card){return effectiveDefinition(card,b,c,side).element===option.id;});
    if(!cards.length)return -1000;
    var values=cards.map(function(card){return acquisition(card,b,c,side,{},{});});
    var discover=(own.treasureIds||[]).indexOf('loaded_dice')>=0;
    var average=values.reduce(function(sum,v){return sum+v;},0)/values.length;
    // The top of a shuffled deck is not a strategic signal. Compare the
    // available distribution; loaded dice adds the benefit of choosing a card.
    return average+(discover?(Math.max.apply(null,values)-average)*0.7:0);
  }
  function acquisition(option,b,c,side,settings,continuation){
    var own=b[side],opp=b[opposite(side)],d=effectiveDefinition(option,b,c,side),op=continuation.op||'',free=op==='generateCast',cost=manaCost(b,side,option,c),cap=limit(b,side,c);
    if(continuation.discount)cost=Math.max(op==='discoverMove'?1:0,cost-continuation.discount);
    if(continuation.zeroUntil!==undefined||continuation.zeroCost||free)cost=0;
    d.cost=cost;
    var value=metric(d,own,opp,b,c),missing=Math.max(0,own.maxHp-own.hp),nextMana=Math.max(0,Math.min(5,own.maxMana)-(own.overloadNext||0));
    if(!free){
      var availableResource=d.bloodCost!==undefined?(own.bloodstones||0):own.mana,reachable=d.bloodCost!==undefined?availableResource:Math.max(own.mana,nextMana),turns=Math.max(0,cost-reachable);
      value=value/(1+turns*0.65)-cost*0.3;
      if(cost<=availableResource&&b.phase==='MAIN1')value+=1.6;
      if(d.temporary&&b.phase==='MAIN2')value*=0.1;
      if(d.unplayable&&!d.rule)value-=8;
      if(option.availableFrom>b.turn)value*=0.6;
      var frequencies=expectedElements(b,c,opposite(side),false),total=0,beatenBy={FIRE:'ICE',NATURE:'FIRE',LIGHTNING:'NATURE',ICE:'LIGHTNING'};
      ELEMENTS.forEach(function(el){total+=frequencies[el]||0;});
      if(value>0&&beatenBy[d.element]&&total>0&&opp.handCount>0)value*=1-0.2*(frequencies[beatenBy[d.element]]||0)/total;
      if(own.hand.length>=cap)value=0;
    }
    if(op==='dredge')value=(cost<=own.mana?value+3:value*0.45);
    if(op==='golden')value/=1+(continuation.delay||1)*0.3;
    if(op==='northern'&&d.element==='ICE'&&opp.handCount>0)value+=4.5;
    if(op==='treasureChoice'||op==='prayer')value+=Math.max(0,metric(d,own,opp,b,c))*0.12;
    if(d.element==='HOLY'&&own.status&&own.status.salvation)value+=2+6/Math.max(1,own.status.salvation.remaining||50);
    if(d.rule==='점화'&&own.bossId==='antonidas')value+=2;
    // A defensive pick must be useful at the current health total; the shared
    // evaluator already clips healing and recognises damage-reduction effects.
    if(missing===0&&d.rule==='치유의 손길')value*=0.55;
    return value;
  }
  function opponentValue(option,b,c,side){
    var own=b[opposite(side)],opp=b[side],d=definition(option,c),revealed=copy(own);
    // Options explicitly reveal these identities. No other opponent card is read.
    revealed.hand=[copy(option)];
    return metric(d,revealed,opp,b,c);
  }
  function score(option,b,c,settings,continuation,side){
    if(!option.cardId)return ELEMENTS.indexOf(option.id)>=0?elementValue(option,b,c,side,continuation):0;
    var op=continuation.op||'',value=acquisition(option,b,c,side,settings,continuation),d=definition(option,c),enemyOwner=continuation.owner===opposite(side);
    var rawValue=op==='cycle'||op==='shortCircuit'?metric(d,b[side],b[opposite(side)],b,c):0;
    if(op==='cycle')return -rawValue;
    if(op==='shortCircuit'){
      var cap=limit(b,side,c),cost=manaCost(b,side,option,c);
      return Math.min(cost,Math.max(0,cap-b[side].hand.length))*2.8-rawValue*0.4;
    }
    if(op==='hibernate'||op==='revelation'||op==='weaknessDiscard'||op==='hookDiscard')return opponentValue(option,b,c,side);
    if(op==='grave')return opponentValue(option,b,c,side)*0.7+(continuation.upgraded?value:0);
    if(op==='stealRest'||op==='intercept'||(op==='take'&&enemyOwner))value+=Math.max(0,opponentValue(option,b,c,side))*0.35;
    return value;
  }
  function choose(options,b,c,settings,continuation){
    if(!options||!options.length)return null;
    settings=settings||{};continuation=continuation||{};
    var side=continuation.side==='player'?'player':'enemy',view=snapshot(b,side),best=options[0],bestScore=-Infinity;
    options.forEach(function(option){if(A4.AI)A4.AI.checkDeadline();var value=score(option,view,c,settings,continuation,side);if(value>bestScore){bestScore=value;best=option;}});
    return best;
  }
  return {choose:choose};
}());
