/* Bounded, deterministic information-set search. Imagined hands never come from
 * the player's hidden zones; planning never advances the saved battle RNG. */
A4.AI = (function(){
  'use strict';
  var limits={maxCalculationMs:5000,simulations:24,scenarios:2,rootCandidates:4,phaseCandidates:2,stepsPerSimulation:360,exactCandidates:96,shortlistedCandidates:64,varietyEnabled:true,nearScoreGap:1.5};
  var budget=null;
  function checkDeadline(){if(budget&&Date.now()>=budget.deadline)throw budget.error;}
  function remember(action,score,scenario){
    if(!budget)return;
    var id=key(action),record=budget.records[id];
    if(!record)record=budget.records[id]={uids:action.uids.slice(),heroPower:action.heroPower,scores:[]};
    record.scores[scenario]=score;budget.stats.candidates=Object.keys(budget.records).length;
  }
  function timedBest(){
    var best=null;
    Object.keys(budget.records).forEach(function(id){var record=budget.records[id],scores=record.scores,score=scores[0];
      if(scores[1]!==undefined&&score!==undefined)score=(score*(1-budget.passWeight)+scores[1]*budget.passWeight)*0.85+Math.min(score,scores[1])*0.15;
      if(score!==undefined&&(!best||score>best.score))best={uids:record.uids.slice(),heroPower:record.heroPower,score:score};
    });
    return best||budget.fallback;
  }
  var COUNTERS={FIRE:'NATURE',NATURE:'LIGHTNING',LIGHTNING:'ICE',ICE:'FIRE'};
  function copy(x){return x===undefined?undefined:JSON.parse(JSON.stringify(x));}
  function random(seed){var n=seed>>>0;return function(){n=(Math.imul?Math.imul(n,1664525):n*1664525)+1013904223>>>0;return n/4294967296;};}
  function hash(s){var n=2166136261;for(var i=0;i<s.length;i++)n=((n^s.charCodeAt(i))*16777619)>>>0;return n;}
  function shuffle(a,rng){for(var i=a.length-1;i>0;i--){var j=Math.floor(rng()*(i+1)),x=a[i];a[i]=a[j];a[j]=x;}return a;}
  function scalars(src){var out={};Object.keys(src||{}).forEach(function(k){var x=src[k];if(x===null||typeof x==='number'||typeof x==='boolean'||typeof x==='string')out[k]=x;});return out;}
  function publicStatus(status){
    var out=scalars(status);out.cardLocks=copy(status.cardLocks||[]);out.foresightTurns=copy(status.foresightTurns||[]);
    if(status.classes)out.classes=scalars(status.classes);if(status.expansion)out.expansion=scalars(status.expansion);
    if(status.confession)out.confession=copy(status.confession);
    if(status.salvation)out.salvation=copy(status.salvation);
    if(status.cards){out.cards=scalars(status.cards);out.cards.drawnUids=[];for(var i=0;i<(out.cards.drawCount||0);i++)out.cards.drawnUids.push('ai-prior-draw-'+i);out.cards.effects=(status.cards.effects||[]).map(function(e){var x=scalars(e);if(e.elements)x.elements=copy(e.elements);if(e.sourceCard)x.sourceCard=copy(e.sourceCard);if(e.sourceDef)x.sourceDef=copy(e.sourceDef);if(e.fuseSource)x.fuseSource=copy(e.fuseSource);return x;});}
    if(status.treasures){out.treasures={};['freeMain2Turn','escapeTurn','escapeStacks','escapeStacksTurn','previousFirstElement','main1PaidTurn','main1Paid','receiptTurn','firstElementTurn','firstElement','firstCounteredTurn','firstCounteredUid','elementCountsTurn','twinTurn','mirrorTurn','luckyShovelTurn','echoTurn','savedMana','standbyProcessed','endProcessed'].forEach(function(k){if(status.treasures[k]!==undefined)out.treasures[k]=status.treasures[k];});['elementCounts','twinTriggered'].forEach(function(k){if(status.treasures[k])out.treasures[k]=copy(status.treasures[k]);});}
    return out;
  }
  function publicSnapshot(b,c){
    var p=b.player,player={},fields=['name','heroName','heroId','startingTreasureId','shrineId','runWins','bloodstones','daggers','bossId','hp','maxHp','baseMaxHp','shield','mana','maxMana','manaGrowth','overloadNext','overloadLocked','heroPowerUsedTurn','heroPowerReadyTurn','playedThisTurn','damageTakenThisTurn','damageTakenLastTurn','drawnCountThisTurn'];
    fields.forEach(function(k){if(p[k]!==undefined)player[k]=p[k];});
    if(p.runeSerial!==undefined)player.runeSerial=p.runeSerial;player.runes=copy(p.runes||[]);player.shrines=copy(p.shrines||[]);player.heroPower=copy(p.heroPower);player.status=A4.Battle.redactTrapChoices(publicStatus(p.status||{}),'player','enemy');player.passives=copy(p.passives||[]);player.treasureIds=copy(p.treasureIds||[]);
    player.handCount=p.hand.length;player.deckCount=p.deck.length;player.restCount=p.rest.length;player.excludedCount=p.excluded.length;
    if(b.enemy.heroPower&&b.enemy.heroPower.id==='teemo')player.teemoTrapCount=p.deck.filter(function(x){return x.cardId==='poisonous_mushroom';}).length;
    player.hand=[];player.deck=[];player.rest=[];player.excluded=[];player.inFlight=[];
    player.usedThisTurn=copy(p.usedThisTurn||[]);player.lastTurnCards=copy(p.lastTurnCards||[]);player.limitedUsed=copy(p.limitedUsed||{});
    var result={rulesVersion:3,turn:b.turn,phase:b.phase,phaseSerial:b.phaseSerial||0,outcome:'ongoing',player:player,enemy:copy(b.enemy),history:copy(b.history||[]),scheduled:[],generatedCounter:b.generatedCounter||0,lastLog:[],runChanges:[],removedFromRun:[],pendingChoice:null,resolution:null,enemyPlan:[],enemyPowerPlan:false,enemyPlanDeferred:false};
    A4.Battle.redactTrapChoices(result.enemy.status,'enemy','enemy');
    result.publicPlayerHistory=copy(b.publicPlayerHistory||[]);
    if(b.publicPlayerDeck)result.publicPlayerDeck=copy(b.publicPlayerDeck);
    // Numeric public scheduled effects are safe; concealed selected card/hand
    // snapshots (golden delivery, mirage, revelation) are deliberately absent.
    (b.scheduled||[]).forEach(function(e){var t=e.task||{};
      if(t.side==='enemy'||(t.op==='burnout'&&t.owner==='enemy')){result.scheduled.push(copy(e));return;}
      if(['damage','heal','mana','charge','loseShield','nextWaves','hourglass','boots','capsule'].indexOf(t.op)>=0||t.kind==='effect'){
        var task=scalars(t);if(t.effect)task.effect=copy(t.effect);if(t.card)task.card=copy(t.card);
        result.scheduled.push({turn:e.turn,phase:e.phase,task:task});
      }
    });
    result.enemy.deck.sort(function(a,z){return String(a.uid).localeCompare(String(z.uid));});
    return result;
  }
  function meta(def,own,opp,b,c){return A4.AIEvaluation.evaluateCard(def,own,opp,b,c);}
  function key(a){return a.uids.join(',')+'|'+a.heroPower;}
  function chooseNearBest(ranked,roll){
    if(!ranked.length)return null;
    var ordered=ranked.slice().sort(function(a,z){return Math.abs(z.score-a.score)<0.00001?0:z.score-a.score;}),best=ordered[0],seen={},near=[];
    ordered.forEach(function(a){var identity=a.uids.slice().sort().join(',')+'|'+a.heroPower;
      if(near.length>=3||seen[identity]||best.score-a.score>limits.nearScoreGap||a.outcomes!==best.outcomes)return;
      seen[identity]=true;near.push(a);
    });
    if(!limits.varietyEnabled||near.length<2)return best;
    // Redistribute missing ranks in proportion: two options use 60:25.
    var weights=[60,25,15],total=near.length===2?85:100,point=Math.max(0,Math.min(0.999999999,roll))*total;
    for(var i=0;i<near.length;i++){point-=weights[i];if(point<0)return near[i];}return near[near.length-1];
  }
  function candidates(b,c,side,count){
    checkDeadline();
    var f=b[side],foe=b[side==='enemy'?'player':'enemy'],ctx=A4.Battle.context(b,c,function(){return 0.5;},{side:side},[]),available=[],power=false,pcost=0,pvalue=0,pbonus=0;
    f.hand.forEach(function(x){if(A4.Battle.cardAllowed(b,side,c,x)){var d=ctx.def(x);if(d.rule==='불안정한 원소'&&f.hand.length>1)return;if(d.rule==='poison_powder'&&f.heroPower&&f.heroPower.id==='ivysaur'&&(foe.drawnCountThisTurn||0)<2)return;var evaluation=meta(d,f,foe,b,c);if(evaluation.cleanseAllowed===false||evaluation.prayerAllowed===false)return;available.push({card:x,def:d,first:ctx.cost(side,x,true),cost:ctx.cost(side,x,false),blood:d.bloodCost!==undefined,m:evaluation});}});
    // Hand limits bound the normal enumeration to 1024 subsets.
    var healthCards=!!(A4.Classes&&A4.Classes.alive(f,'hireek').length),spendable=healthCards?Math.floor((f.hp-1)/5):f.mana;
    if(available.length>10)available=available.sort(function(a,z){return z.m.score-a.m.score;}).slice(0,10);
    var teemoBlocked=f.heroPower&&f.heroPower.id==='teemo'&&(foe.teemoTrapCount!==undefined&&!(foe.deck||[]).length?foe.teemoTrapCount:(foe.deck||[]).filter(function(x){return x.cardId==='poisonous_mushroom';}).length)>3;
    if(!teemoBlocked&&f.heroPower&&f.heroPower.kind==='active'&&(f.heroPower.id!=='plague_doctor'||f.heroPowerUsedTurn<0||f.heroPowerUsedTurn!==b.turn-1)&&(f.heroPower.id!=='ivysaur'||!(foe.status||{}).poison||((foe.status||{}).poison||0)>=3)){
      try{A4.Battle.validateSubmission(ctx,side,[],true);power=true;pcost=ctx.powerCost(side);var powerMetric=meta(f.heroPower,f,foe,b,c);pvalue=powerMetric.score;pbonus=powerMetric.cardSavingBonus||0;}catch(ignore){if(budget&&ignore===budget.error)throw ignore;}
    }
    var modelView=side==='enemy'?b:{player:foe,enemy:f,turn:b.turn,phase:b.phase,history:(b.history||[]).map(function(h){return {turn:h.turn,phase:h.phase,player:h.enemy||[],enemy:h.player||[]};})};
    var model=A4.AIEvaluation.predict(modelView,c),freq=model.elements,total=1;
    var ranked=[],batchCache={},handCap=ctx.limit(side),reserveOrder=available.slice().sort(function(a,z){return a.cost-z.cost||z.m.score-a.m.score;});
    function consider(selected,usePower,variant){
      if(selected.length>1&&A4.TreasureRules.owns(f,'velvet_choker'))return;
      checkDeadline();
      var cost=usePower?pcost:0,bloodCost=0,value=usePower?pvalue:0,seen={},ids=[],valid=true,prayerOwn=f,prayerFoe=foe;
      if(f.heroPower&&f.heroPower.id==='yuumi'){prayerOwn=copy(f);prayerFoe=copy(foe);}
      selected.forEach(function(x,i){var paid=i===0&&f.playedThisTurn===0?x.first:x.cost;if(x.blood)bloodCost+=paid;else cost+=paid;});if(bloodCost>(f.bloodstones||0))return;
      var lifeCost=healthCards?(cost-(usePower?pcost:0))*5:0;
      if(healthCards?(lifeCost>=f.hp||usePower&&pcost>f.mana):cost>f.mana)return;
      var batchKey=selected.map(function(x){return x.card.uid;}).join(',')+'|'+cost;
      var batch=batchCache[batchKey];
      if(!batch){batch=A4.AIEvaluation.evaluateBatch(selected.map(function(x,i){return {card:x.card,def:x.def,paidCost:i===0&&f.playedThisTurn===0?x.first:x.cost};}),f,foe,b,c,healthCards?(usePower?pcost:0):cost);batchCache[batchKey]=batch;}if(!batch.allowed)return;
      selected.forEach(function(x,i){if((x.def.limited||x.def.rule==='금단의 불꽃')&&seen[x.card.cardId])valid=false;seen[x.card.cardId]=true;
        if(x.def.rule==='salvation_prayer'&&f.heroPower&&f.heroPower.id==='yuumi'){var prayer=A4.AIEvaluation.prayerPolicy(x.def,prayerOwn,prayerFoe,b,c);if(!prayer.allowed)valid=false;prayerOwn.hp+=prayer.selfHeal;prayerFoe.hp+=prayer.otherHeal;if(prayer.otherHeal>0)prayerOwn.status.yuumiHealTurn=b.turn;}
        ids.push(x.card.uid);
        var risk=0;Object.keys(COUNTERS).forEach(function(el){if(COUNTERS[el]===x.def.element||(x.def.unstable&&el===x.def.element))risk+=(freq[el]||0)/total;});
        if(foe.mana===0)risk*=0.12;if((foe.handCount===undefined?foe.hand.length:foe.handCount)===0)risk=0;
        var counterChance=(freq[COUNTERS[x.def.element]]||0)+(x.def.overpower?(freq[x.def.element]||0):0);
        value+=batch.metrics[i].score*(1-risk*(1-model.passChance)*0.7)+counterChance/total*(model.constrained?4*(1-model.passChance):1.2);
      });
      if(!valid||!healthCards&&cost>f.mana)return;
      if(healthCards)value-=lifeCost*(f.hp<15?1.6:0.8);
      if(b.phase==='MAIN1'&&foe.heroPower&&foe.heroPower.id==='fiora'&&!ids.length)value-=A4.AIEvaluation.evaluateCard({id:'fiora_pressure',kind:'active',effects:[{type:'damage',amount:5}]},foe,f,b,c).damage*1.2;
      if(foe.heroPower&&foe.heroPower.id==='piranha_plant')value-=selected.length*0.35;
      if(b.phase==='MAIN1'&&f.heroPower&&f.heroPower.id==='fiora'&&ids.length)value+=model.passChance*1.5;

      if(usePower&&f.heroPower&&f.heroPower.id==='pikachu')value-=selected.filter(function(x){return x.def.element==='LIGHTNING';}).length*1.25;
      if(b.phase==='MAIN1')value+=batch.mana*0.5;
      value-=cost*0.12;
      if(side==='enemy'&&b.phase==='MAIN2')value+=Math.min(1,selected.reduce(function(sum,x,i){return sum+(batch.metrics[i].score>0&&!x.blood?(i===0&&f.playedThisTurn===0?x.first:x.cost):0);},0)*0.35);
      if(usePower&&selected.length<f.hand.length)value+=pbonus;
      if(side==='enemy'&&f.hand.length<=handCap-3&&!f.hand.some(function(x){return c.cards[x.cardId]&&c.cards[x.cardId].rule==='신의 권능: 징벌';})){
        var spentElements={},savedCardCount=0;selected.forEach(function(x,i){var paid=i===0&&f.playedThisTurn===0?x.first:x.cost;if(paid>0||x.def.temporary||x.card.temporaryUntil!==undefined&&x.card.temporaryUntil<=b.turn)return;savedCardCount++;spentElements[x.def.element]=(spentElements[x.def.element]||0)+1;if(spentElements[x.def.element]>1)value-=5;});
        value-=Math.max(0,savedCardCount-2)*1.2;
      }
      var openingValue=0,earlyDraw=0,reservesPlay=false;
      if(side==='enemy'&&b.phase==='MAIN1'){
        reservesPlay=ids.length>0&&(available.some(function(x){return ids.indexOf(x.card.uid)<0&&!x.def.main1Only&&x.m.score>0&&(x.blood?x.cost<=(f.bloodstones||0)-bloodCost:x.cost<=batch.mana)&&!(x.def.limited&&seen[x.card.cardId]);})||power&&!usePower&&pvalue>0&&pcost<=batch.mana);
        // Reward the option to react, not unused cards that cannot be played.
        if(reservesPlay){
          var reserveMana=batch.mana,reserveBlood=(f.bloodstones||0)-bloodCost,reserveCount=0;
          reserveOrder.forEach(function(x){if(ids.indexOf(x.card.uid)<0&&!x.def.main1Only&&x.m.score>0&&(x.blood?x.cost<=reserveBlood:x.cost<=reserveMana)&&!(x.def.limited&&seen[x.card.cardId])){reserveCount++;if(x.blood)reserveBlood-=x.cost;else reserveMana-=x.cost;}});
          // Similar outcomes should naturally spend something in each phase.
          // Prefer a balanced opening over a token card followed by a large dump.
          openingValue+=1.1;
          if(reserveCount)openingValue+=0.7*(1-Math.abs(ids.length-reserveCount)/(ids.length+reserveCount));
        }
        var space=Math.max(0,handCap-f.hand.length+ids.length),supply=f.deck.length+f.rest.length;
        batch.metrics.forEach(function(m,i){var rule=selected[i].def.rule;if(['완전 빙결','황금궤','불장난'].indexOf(rule)<0)earlyDraw+=Math.max(0,m.draw||0);});
        earlyDraw=Math.min(earlyDraw,space,supply);
        // Drawing early matters when mana and a real need for more options remain.
        if(batch.mana>0&&earlyDraw>0&&f.hand.length-ids.length<5)openingValue+=Math.min(1.2,earlyDraw*0.6);
        else earlyDraw=0;
      }
      ranked.push({uids:ids,heroPower:!!usePower,score:value+openingValue,openingValue:openingValue,earlyDraw:earlyDraw,reservesPlay:reservesPlay,variant:variant||0});
      if(budget&&b===budget.snapshot&&(!budget.fallback||value+openingValue>budget.fallback.score))budget.fallback={uids:ids.slice(),heroPower:!!usePower,score:value+openingValue};
    }
    // Prune unaffordable branches before evaluating effects. Small legal action
    // spaces remain exact. Larger spaces use a cheap shortlist plus all pairs
    // and three-card engine combinations, preserving non-additive synergies.
    var ordered=available.slice().sort(function(a,z){return (a.m.priority||0)-(z.m.priority||0);}),sets=[];
    function collect(start,selected,cost,value,bloodCost){bloodCost=bloodCost||0;
      checkDeadline();
      sets.push({selected:selected.slice(),cost:cost,value:value});
      for(var i=start;i<ordered.length;i++){
        var x=ordered[i],paid=selected.length===0&&f.playedThisTurn===0?x.first:x.cost;
        if(x.blood?bloodCost+paid>(f.bloodstones||0):cost+paid>spendable)continue;
        if((x.def.limited||x.def.rule==='금단의 불꽃')&&selected.some(function(y){return y.card.cardId===x.card.cardId;}))continue;
        selected.push(x);collect(i+1,selected,cost+(x.blood?0:paid),value+x.m.score,bloodCost+(x.blood?paid:0));selected.pop();
      }
    }
    // Establish useful legal fallbacks before the more expensive batch search.
    if(budget&&b===budget.snapshot){consider([],false,0);if(power)consider([],true,0);available.forEach(function(x){consider([x],false,0);});}
    collect(0,[],0,0);
    if(sets.length>limits.exactCandidates){
      sets.sort(function(a,z){return z.value-a.value||a.selected.length-z.selected.length;});
      var keep=sets.slice(0,limits.shortlistedCandidates);
      sets.forEach(function(a){
        if(a.selected.length<=2||a.selected.length===3&&a.selected.some(function(x){return x.m.mana>0||x.def.rule==='boo_ghost_raider'||x.def.rule==='과열'||x.def.rule==='금단의 불꽃';})){
          if(keep.indexOf(a)<0)keep.push(a);
        }
      });
      // Keep different sizes and every element's best counter-oriented batch.
      var sizes={},elements={};sets.forEach(function(a){var n=a.selected.length;if(!sizes[n]){sizes[n]=true;if(keep.indexOf(a)<0)keep.push(a);}
        a.selected.forEach(function(x){if(!elements[x.def.element]){elements[x.def.element]=true;if(keep.indexOf(a)<0)keep.push(a);}});
      });sets=keep;
    }
    ranked=[]; // Warm-up fallbacks stay in the batch cache, without duplicate ranking entries.
    sets.forEach(function(a){consider(a.selected,false,0);if(power&&(healthCards?pcost<=f.mana:a.cost+pcost<=f.mana))consider(a.selected,true,0);});
    ranked.sort(function(a,z){return z.score-a.score||a.uids.length-z.uids.length;});
    var result=[],seenKeys={};
    function add(a){if(a&&!seenKeys[key(a)]){try{A4.Battle.validateSubmission(ctx,side,a.uids,a.heroPower);}catch(error){if(budget&&error===budget.error)throw error;return;}result.push(a);seenKeys[key(a)]=true;}}
    ranked.slice(0,count).forEach(add);
    if(side==='enemy'&&b.phase==='MAIN1'&&available.length){
      var nextView={player:foe,enemy:f,turn:b.turn,phase:'MAIN2',history:b.history||[]},nextModel=A4.AIEvaluation.predict(nextView,c);
      var partial=ranked.filter(function(a){return (a.uids.length>0||a.heroPower)&&(a.uids.length<available.length||power&&!a.heroPower);});
      partial.forEach(function(a){
        var mana=Math.max(0,f.mana-(a.heroPower?pcost:0)),future=0,blood=f.bloodstones||0,left=available.filter(function(x){return a.uids.indexOf(x.card.uid)<0;});
        a.uids.forEach(function(id){var x=available.filter(function(x){return x.card.uid===id;})[0];if(x.blood)blood-=x.cost;else mana-=x.cost;});
        left.sort(function(x,z){return z.m.score/Math.max(1,z.cost)-x.m.score/Math.max(1,x.cost);});
        left.forEach(function(x){if(x.def.main1Only||(x.blood?x.cost>blood:x.cost>mana))return;
          var risk=0;Object.keys(COUNTERS).forEach(function(el){if(COUNTERS[el]===x.def.element||(x.def.unstable&&el===x.def.element))risk+=nextModel.elements[el]||0;});
          future+=Math.max(0,x.m.score)*(1-risk*(1-nextModel.passChance)*0.7);if(x.blood)blood-=x.cost;else mana-=x.cost;
        });
        if(power&&!a.heroPower&&pcost<=mana)future+=Math.max(0,pvalue);
        a.partitionScore=a.score+future;a.phaseSplit=a.reservesPlay||a.earlyDraw>0;
      });
      partial.sort(function(a,z){return z.partitionScore-a.partitionScore||a.uids.length-z.uids.length;});
      var purposeful=partial.filter(function(a){return a.reservesPlay||a.earlyDraw>0;});
      if(!purposeful.length&&partial[0])partial[0].phaseSplit=true;
      add(purposeful[0]||partial[0]);
      // A draw-first opening must compete even when bulk damage ranks higher.
      var drawFirst=purposeful.filter(function(a){return a.earlyDraw>0;}).sort(function(a,z){return a.uids.length-z.uids.length||z.partitionScore-a.partitionScore;});
      var balanced=purposeful.slice().sort(function(a,z){return z.openingValue-a.openingValue||z.partitionScore-a.partitionScore;});
      add(drawFirst[0]||balanced[0]||partial[1]);
    }
    // Include empty submission: it can be best once MAIN2 and counter risk are resolved.
    if(!result.some(function(x){return x.uids.length===0&&!x.heroPower;}))add({uids:[],heroPower:false,score:b.phase==='MAIN1'?f.mana*0.5:0});
    if(f.heroPower&&f.heroPower.id==='plague_doctor')add(ranked.filter(function(x){return !x.heroPower&&x.uids.length;})[0]);
    // Explore meaningful order alternatives, including cost-discount first card.
    ranked.slice(0,2).forEach(function(a){if(a.uids.length<2)return;var orders=[a.uids.slice().reverse()];
      if(a.uids.length>2)orders.push(a.uids.slice(1).concat(a.uids[0]));
      orders.forEach(function(ids){try{A4.Battle.validateSubmission(ctx,side,ids,a.heroPower);var before=ranked.length;consider(ids.map(function(id){return available.filter(function(x){return x.card.uid===id;})[0];}),a.heroPower,1);if(ranked.length>before)add(ranked[ranked.length-1]);}catch(ignore){if(budget&&ignore===budget.error)throw ignore;}});
    });
    return result;
  }
  function world(snapshot,c,seed,index,observed){
    var b=copy(snapshot),rng=random(seed+index*7919),sample=A4.AIOpponentModel.sample(snapshot,c,index,rng,observed);
    if(observed){b._aiObservedCosts={};observed.forEach(function(entry,i){if(A4.integer(entry.paidCost,0)&&sample.observedUids[i])b._aiObservedCosts[sample.observedUids[i]]=entry.paidCost;});b._aiObservedCostTurn=b.turn;b._aiObservedCostPhase=b.phase;}
    b.player=sample.fighter;if(b.player.hand.length)b.player.lastDrawnCard=copy(b.player.hand[b.player.hand.length-1]);b._aiObservedUids=sample.observedUids;
    ['player','enemy'].forEach(function(side){((b[side].status.cards||{}).effects||[]).forEach(function(e){if(e.kind==='iceTrap'&&e.hiddenChoice){e.element=['FIRE','NATURE','LIGHTNING','ICE','HOLY'][Math.floor(rng()*5)];}});});
    shuffle(b.enemy.deck,rng);b._aiImagined=true;
    function spec(f){return {name:f.name,heroId:f.heroId,startingTreasureId:f.startingTreasureId,shrineId:f.shrineId,bloodstones:f.bloodstones,runWins:f.runWins,hp:f.hp,maxHp:f.baseMaxHp||f.maxHp,deck:copy(f.hand.concat(f.deck,f.rest)),heroPower:copy(f.heroPower),passives:copy(f.passives),treasureIds:copy(f.treasureIds),bossId:f.bossId};}
    b.restartSpecs={player:spec(b.player),enemy:spec(b.enemy)};
    return b;
  }
  function simulate(b,c,enemy,player,seed,stats){
    checkDeadline();
    if(stats.simulations>=limits.simulations)return null;
    stats.simulations++;var sim=copy(b);sim._aiSimulation=true;sim._aiStepsRemaining=limits.stepsPerSimulation;
    sim.enemyPlan=enemy.uids.slice();sim.enemyPowerPlan=enemy.heroPower;sim.enemyPlanDeferred=false;sim.resolution=null;sim.pendingChoice=null;
    try{A4.Battle.submit(sim,player.uids,c,random(seed),{heroPower:player.heroPower});stats.steps+=limits.stepsPerSimulation-sim._aiStepsRemaining;return sim;}
    catch(error){if(budget&&error===budget.error)throw error;stats.truncated++;if(String(error.message)!=='AI_SIMULATION_LIMIT'){stats.errors=stats.errors||[];if(stats.errors.length<3)stats.errors.push(String(error.message));}return null;}
  }
  function position(b,c){return A4.AIEvaluation.position(b,'enemy',c);}
  function behaviorResponse(b,c,choices,prediction,index){
    if(prediction.phaseSamples<3)return choices[Math.min(index,choices.length-1)];
    var ctx=A4.Battle.context(b,c,function(){return 0.5;},{side:'player'},[]);
    var expectedCount=prediction.meanCards<0.65?0:prediction.meanCards;
    var ranked=choices.map(function(action){var elementMatch=0;
      action.uids.forEach(function(uid){var card=b.player.hand.filter(function(x){return x.uid===uid;})[0];if(card)elementMatch+=prediction.elements[ctx.def(card).element]||0;});
      return {action:action,score:action.score*0.12-Math.abs(action.uids.length-expectedCount)*4+elementMatch*2};
    }).sort(function(a,z){return z.score-a.score;});
    return ranked[0].action;
  }
  function plan(actual,c,unusedRng,observed){
    var snapshot=publicSnapshot(actual,c);if(observed){snapshot.player.knownSubmission=observed.map(function(x){return copy(x.def);});snapshot.player.knownSubmissionTurn=snapshot.turn;snapshot.player.knownSubmissionPhase=snapshot.phase;}
    if(budget)budget.snapshot=snapshot;
    var stats={simulations:0,steps:0,truncated:0,candidates:0,scenarios:0,expanded:false,splitEvaluations:0};if(budget)budget.stats=stats;
    var pool=candidates(snapshot,c,'enemy',snapshot.phase==='MAIN1'?4:3),root=[];
    function add(action){if(action&&!root.some(function(x){return key(x)===key(action);}))root.push(action);}
    add(pool[0]);
    if(snapshot.enemy.heroPower&&snapshot.enemy.heroPower.id==='plague_doctor')add(pool.filter(function(x){return !x.heroPower&&x.uids.length;})[0]);
    else add(pool.filter(function(x){return !x.uids.length&&!x.heroPower;})[0]);
    if(root.length<2)add(pool[1]);
    if(snapshot.phase==='MAIN1')pool.filter(function(a){return a.phaseSplit;}).sort(function(a,z){return z.openingValue-a.openingValue||z.partitionScore-a.partitionScore;}).some(function(a){add(a);return root.length>=limits.rootCandidates;});
    // No alternative action means no hypothetical battle is necessary.
    if(pool.length===1)return {uids:pool[0].uids.slice(),heroPower:pool[0].heroPower,score:pool[0].score,stats:stats};
    var seed=hash(JSON.stringify(snapshot)),scenarios=[],cache=[],prediction=A4.AIEvaluation.predict(snapshot,c);
    var counterContext=A4.Battle.context(snapshot,c,function(){return 0.5;},{side:'enemy'},[]),rootMetrics={},rootPowerMetric=null;
    function rootMetric(card){if(!rootMetrics[card.uid])rootMetrics[card.uid]=meta(counterContext.def(card),snapshot.enemy,snapshot.player,snapshot,c);return rootMetrics[card.uid];}
    function powerMetric(){if(!rootPowerMetric)rootPowerMetric=meta(snapshot.enemy.heroPower,snapshot.enemy,snapshot.player,snapshot,c);return rootPowerMetric;}
    function scenario(index){
      if(scenarios[index])return scenarios[index];
      var b=world(snapshot,c,seed,index,observed),choices=observed?null:candidates(b,c,'player',4);
      var action=observed?{uids:b._aiObservedUids.slice(),heroPower:false}:behaviorResponse(b,c,choices,prediction,index);
      var passing=index===1&&!observed&&prediction.passChance>=0.35;
      if(passing)action={uids:[],heroPower:false};
      if(budget&&index===1)budget.passWeight=passing?prediction.passChance:0.5;
      stats.scenarios++;
      return scenarios[index]={battle:b,action:action,seed:seed+index*1013,passing:passing};
    }
    function evaluate(ri,si){
      checkDeadline();
      cache[ri]=cache[ri]||[];if(cache[ri][si])return cache[ri][si];
      var action=root[ri],sc=scenario(si),after=simulate(sc.battle,c,action,sc.action,sc.seed,stats),result=after;
      var resultScore=after?position(after,c):null;
      if(after)remember(action,resultScore,si);
      if(after&&snapshot.phase==='MAIN1'&&after.outcome==='ongoing'&&after.phase==='MAIN2'){
        var follows=candidates(after,c,'enemy',2).slice(0,2),responses=candidates(after,c,'player',4),nextPrediction=A4.AIEvaluation.predict({player:after.player,enemy:after.enemy,turn:after.turn,phase:'MAIN2',history:snapshot.history,publicPlayerHistory:snapshot.publicPlayerHistory},c);
        var response=behaviorResponse(after,c,responses,nextPrediction,si);
        if(si===1&&nextPrediction.passChance>=0.35)response={uids:[],heroPower:false};
        var nextBest=null,nextBestScore=-Infinity;
        follows.forEach(function(follow){var trial=simulate(after,c,follow,response,sc.seed+307,stats);stats.splitEvaluations++;
          if(trial){var trialScore=position(trial,c);if(!nextBest||trialScore>nextBestScore){nextBest=trial;nextBestScore=trialScore;remember(action,trialScore,si);}}
        });
        result=nextBest||after;if(nextBest)resultScore=nextBestScore;
      }
      var priority=action.heroPower&&snapshot.enemy.heroPower&&snapshot.enemy.heroPower.id==='plague_doctor'?20:0;
      if(snapshot.phase==='MAIN1'&&after&&after.outcome==='defeat')priority+=6;
      if(snapshot.phase==='MAIN1'&&after&&after.outcome==='ongoing')priority+=(action.openingValue||0)+Math.min(2,action.uids.length)*0.03;
      if(action.heroPower&&snapshot.enemy.heroPower&&snapshot.enemy.heroPower.id==='ivysaur')priority+=powerMetric().ivysaurOpeningBonus||0;
      if(action.heroPower&&action.uids.length<snapshot.enemy.hand.length)priority+=powerMetric().cardSavingBonus||0;
      if(after&&after.outcome==='ongoing'&&snapshot.enemy.hand.length<=counterContext.limit('enemy')-3&&!snapshot.enemy.hand.some(function(x){return c.cards[x.cardId]&&c.cards[x.cardId].rule==='신의 권능: 징벌';})){
        var usedElements={},keptCardCount=0;
        snapshot.enemy.hand.forEach(function(x){if(action.uids.indexOf(x.uid)<0)return;var d=counterContext.def(x);
          var ordinal=action.uids.indexOf(x.uid);
          if(counterContext.cost('enemy',x,ordinal===0&&snapshot.enemy.playedThisTurn===0)>0||d.temporary||x.temporaryUntil!==undefined&&x.temporaryUntil<=snapshot.turn)return;
          keptCardCount++;
          usedElements[d.element]=(usedElements[d.element]||0)+1;
          if(usedElements[d.element]>1)priority-=5;
        });
        priority-=Math.max(0,keptCardCount-2)*1.2;
      }
      if(snapshot.phase==='MAIN2'&&after&&after.outcome==='ongoing'){
        var usefulPaid=0;
        snapshot.enemy.hand.forEach(function(x){var i=action.uids.indexOf(x.uid);if(i>=0&&counterContext.def(x).bloodCost===undefined&&rootMetric(x).score>0)usefulPaid+=counterContext.cost('enemy',x,i===0&&snapshot.enemy.playedThisTurn===0);});
        priority+=Math.min(1,usefulPaid*0.35);
      }
      snapshot.enemy.hand.forEach(function(x){if(action.uids.indexOf(x.uid)>=0){var def=counterContext.def(x),evaluation=rootMetric(x);priority+=(evaluation.cleanseBonus||0)+(evaluation.prayerBonus||0)-(evaluation.fullHealthPenalty||0);
        if(prediction.constrained)priority+=((prediction.elements[COUNTERS[def.element]]||0)+(def.overpower?(prediction.elements[def.element]||0):0))*2*(1-prediction.passChance);
      }});

      var evaluated={score:(result?resultScore:position(sc.battle,c)+action.score*0.35)+priority,outcome:result?result.outcome:null};
      remember(action,evaluated.score,si);return cache[ri][si]=evaluated;
    }
    var first=evaluate(0,0),second=evaluate(1,0);
    var close=Math.abs(first.score-second.score)<6;
    var terminal=first.outcome!=='ongoing'||second.outcome!=='ongoing';
    // Spend extra work only on close decisions or potentially decisive outcomes.
    if(close||terminal||stats.truncated||snapshot.phase==='MAIN1'&&root.length>2){
      stats.expanded=true;
      pool.some(function(action){add(action);return root.length>=limits.rootCandidates;});
      root.forEach(function(action,i){evaluate(i,0);evaluate(i,1);});
    }
    stats.candidates=root.length;
    var rankedDecisions=[];
    root.forEach(function(action,i){
      var a=evaluate(i,0).score,score=a;
      if(stats.expanded){var b=evaluate(i,1).score;var passWeight=scenario(1).passing?prediction.passChance:0.5;score=(a*(1-passWeight)+b*passWeight)*0.85+Math.min(a,b)*0.15;}
      rankedDecisions.push({uids:action.uids.slice(),heroPower:action.heroPower,score:score,outcomes:cache[i].map(function(x){return x.outcome;}).join('|')});
    });
    // Local seeded choice is reproducible after resume and never consumes effect RNG.
    var best=chooseNearBest(rankedDecisions,random(hash('variety:'+seed))());
    delete best.outcomes;
    best.stats=stats;return best;
  }
  function cachedPlan(b,c,rng,observed){
    var started=Date.now(),previous=budget,result,elapsed;
    budget={deadline:started+Math.min(5000,Math.max(0,limits.maxCalculationMs)),error:new Error('AI_TIME_LIMIT'),records:{},passWeight:0.5,fallback:{uids:[],heroPower:false,score:0},stats:{simulations:0,steps:0,truncated:0,candidates:0,scenarios:0,expanded:false,splitEvaluations:0}};
    try{
      try{result=A4.AIEvaluation.withDefinitionCache(c,function(){return plan(b,c,rng,observed);});checkDeadline();}
      catch(error){if(error!==budget.error)throw error;result=timedBest();result.stats=budget.stats;result.stats.timeLimited=true;}
    }finally{budget=previous;}
    elapsed=Date.now()-started;
    if(elapsed>=1000)try{if(typeof Log!=='undefined'&&typeof Log.i==='function')Log.i('악질봇4 AI: '+b.enemy.name+' / '+b.phase+' / '+elapsed+'ms / 가상 전투 '+result.stats.simulations+'회'+(result.stats.timeLimited?' / 5초 제한 도달':''));}catch(ignore){if(budget&&ignore===budget.error)throw ignore;}
    return result;
  }
  return {checkDeadline:checkDeadline,plan:cachedPlan,publicSnapshot:publicSnapshot,limits:limits,candidates:candidates,chooseNearBest:chooseNearBest};
}());
