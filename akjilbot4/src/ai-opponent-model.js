/* Samples a plausible opponent from a redacted snapshot. Zones share one card
 * inventory, so imagining one card in the hand does not also put it in the rest. */
A4.AIOpponentModel=(function(){
  'use strict';
  function copy(x){return x===undefined?undefined:JSON.parse(JSON.stringify(x));}
  function count(f,key){return Math.max(0,f[key+'Count']===undefined?(f[key]||[]).length:f[key+'Count']);}
  function key(card){return card.cardId+'|'+(card.upgraded?1:0);}
  function drawIndex(items,rng,weight){
    var weights=items.map(function(x){return Math.max(0.001,weight(x));}),sum=weights.reduce(function(a,z){return a+z;},0),roll=rng()*sum;
    for(var i=0;i<items.length;i++){roll-=weights[i];if(roll<0)return i;}return items.length-1;
  }
  function sample(snapshot,c,seedIndex,rng,observed){
    var source=snapshot.player,fighter={},zones=['hand','deck','rest','excluded'],sizes={},serial=0,usedUids={};
    // This module accepts publicSnapshot output. Never copy the input zones,
    // even if a caller accidentally supplies a fighter with nonempty arrays.
    Object.keys(source).forEach(function(field){if(zones.indexOf(field)<0&&field!=='inFlight'&&!/Count$/.test(field))fighter[field]=copy(source[field]);});
    zones.forEach(function(zone){sizes[zone]=count(source,zone);fighter[zone]=[];});fighter.inFlight=[];
    var pool=[],weights={},maxCopies={},upgradedCopies={},lastSeen={},history=(snapshot.publicPlayerHistory||[]).concat(snapshot.history||[]).slice(-48),ordinary=c.cardPool&&c.cardPool.length?c.cardPool:Object.keys(c.cards);
    var prediction=A4.AIEvaluation&&A4.AIEvaluation.predict?A4.AIEvaluation.predict(snapshot,c):{knownCards:[],elements:{}};
    (prediction.knownCards||[]).forEach(function(card){if(c.cards[card.cardId])weights[key(card)]=(weights[key(card)]||0)+card.weight;});
    function add(id,up){if(c.cards[id])pool.push({cardId:id,upgraded:!!up});}
    var hero=(c.heroes||[]).filter(function(h){return h.name===source.heroName||h.id===source.heroId||(h.power&&source.heroPower&&h.power.id===source.heroPower.id);})[0];
    if(snapshot.publicPlayerDeck){snapshot.publicPlayerDeck.forEach(function(card){if(c.cards[card.cardId])pool.push(copy(card));});history=snapshot.history||[];}
    else {
      if(hero)(hero.cards||[]).forEach(function(id){add(id,false);});
      (source.treasureIds||[]).forEach(function(id){var treasure=c.treasures&&c.treasures[id];if(treasure&&treasure.kind==='card')add(treasure.cardId,false);});
    }
    if(snapshot.enemy.bossId==='extreme_troll')for(var forced=0;forced<3;forced++)add('deactivation',false);
    var planted={'서리꽃':{name:'혹한',count:3},'서리 저주':{name:'고드름',count:1},'심해 저주':{name:'저주',count:1}};
    history.forEach(function(phase){(phase.enemy||[]).forEach(function(card){
      if(card.countered)return;var d=c.cards[card.cardId],token=d&&planted[d.rule||d.name];
      if(token&&A4.CardRules)for(var i=0;i<token.count;i++)add(A4.CardRules.nameToId(token.name),card.upgraded);
    });});
    if(snapshot.enemy.heroPower&&snapshot.enemy.heroPower.id==='teemo'&&snapshot.enemy.heroPowerUsedTurn===snapshot.turn)for(var mushroom=0;mushroom<3;mushroom++)add('poisonous_mushroom',false);
    history.forEach(function(phase){
      var counts={},ups={};(phase.player||[]).forEach(function(card){if(!c.cards[card.cardId])return;counts[card.cardId]=(counts[card.cardId]||0)+1;if(card.upgraded)ups[card.cardId]=(ups[card.cardId]||0)+1;lastSeen[card.cardId]=card;});
      Object.keys(counts).forEach(function(id){maxCopies[id]=Math.max(maxCopies[id]||0,counts[id]);});
      Object.keys(ups).forEach(function(id){upgradedCopies[id]=Math.max(upgradedCopies[id]||0,ups[id]);});
    });
    Object.keys(maxCopies).forEach(function(id){
      var existing=pool.filter(function(card){return card.cardId===id;});
      for(var i=existing.length;i<maxCopies[id];i++)add(id,lastSeen[id].upgraded);
      // An upgrade observed in public might be temporary. One scenario retains
      // the base copy; the others retain the most recently observed upgrade.
      if(seedIndex%3!==0&&lastSeen[id].upgraded)existing.slice(0,upgradedCopies[id]||1).forEach(function(card){card.upgraded=true;});
    });
    function take(id,up){
      var index=-1;for(var i=0;i<pool.length;i++)if(pool[i].cardId===id&&(up===undefined||pool[i].upgraded===!!up)){index=i;break;}
      if(index<0&&up!==undefined)return take(id);return index<0?null:pool.splice(index,1)[0];
    }
    function stamp(card){var result=copy(card);if(!result.uid||usedUids[result.uid])do{result.uid='ai-player-'+seedIndex+'-'+(++serial);}while(usedUids[result.uid]);usedUids[result.uid]=true;return result;}
    (fighter.runes||[]).forEach(function(card){take(card.cardId,card.upgraded);if(card.uid)usedUids[card.uid]=true;});
    var observedCards=(observed||[]).map(function(entry){var card=entry.card||entry;if(!card.cardId&&entry.def)card={cardId:entry.def.cardId,upgraded:!!entry.def.upgraded};return copy(card);}).filter(function(card){return !!c.cards[card.cardId];});
    observedCards.forEach(function(card){take(card.cardId,card.upgraded);fighter.hand.push(stamp(card));});
    sizes.hand=Math.max(sizes.hand,fighter.hand.length);
    var observedUids=fighter.hand.map(function(card){return card.uid;});
    // Recently played ordinary cards usually inhabit the rest. Treat this as
    // an inference, not knowledge: leave one world unanchored for reshuffles,
    // theft or removal effects whose hidden targets were not revealed.
    if(seedIndex%3!==2){
      history.slice().reverse().forEach(function(phase){(phase.player||[]).slice().reverse().forEach(function(card){
        var d=c.cards[card.cardId];if(!d)return;
        if(card.upgraded&&d.upgrade){var upgraded=copy(d);Object.keys(d.upgrade).forEach(function(k){upgraded[k]=d.upgrade[k];});d=upgraded;}
        var zone=!card.countered&&d.excludeOnUse?'excluded':'rest';
        if(fighter[zone].length>=sizes[zone])return;var candidate=take(card.cardId,card.upgraded);if(candidate)fighter[zone].push(stamp(candidate));
      });});
    }
    function likelihood(card){return 1+Math.min(5,weights[key(card)]||0);}
    function unknown(){
      var id=ordinary[drawIndex(ordinary,rng,function(cid){var d=c.cards[cid];if(!d)return 0.001;var cost=d.cost||0,frequency=cost===4?0.5:cost>=5?0.25:1;return frequency*(0.7+(prediction.elements[prediction.forcedElement||d.element]||0));})];
      return {cardId:id,upgraded:false};
    }
    var needed=zones.reduce(function(n,zone){return n+sizes[zone]-fighter[zone].length;},0);
    while(pool.length<needed)pool.push(unknown());
    // Without replacement across zones: the starting Guff list, for example,
    // can never place its sole thunder in both hand and rest in the same world.
    ['hand','rest','excluded','deck'].forEach(function(zone){
      while(fighter[zone].length<sizes[zone]){
        var index=drawIndex(pool,rng,zone==='hand'?likelihood:function(){return 1;});
        fighter[zone].push(stamp(pool.splice(index,1)[0]));
      }
    });
    // Preserve public draw ordinals without reading the actual drawn card UIDs.
    // Which sampled hand cards were drawn this turn is itself only a hypothesis.
    var drawState=fighter.status&&fighter.status.cards;
    if(drawState&&drawState.drawCountTurn===snapshot.turn){
      drawState.drawnUids=[];
      for(var drawOrdinal=0;drawOrdinal<(drawState.drawCount||0);drawOrdinal++)drawState.drawnUids.push(drawOrdinal<fighter.hand.length?fighter.hand[drawOrdinal].uid:'ai-prior-draw-'+drawOrdinal);
    }
    var confession=fighter.status&&fighter.status.confession;
    var opposingPower=snapshot.enemy.heroPower;
    if(((opposingPower&&opposingPower.id==='meltranix'&&opposingPower.kind==='passive')||(confession&&confession.from<=snapshot.turn&&(confession.until===undefined||confession.until>=snapshot.turn)))&&observedUids.length){
      var shown=fighter.hand.filter(function(x){return observedUids.indexOf(x.uid)>=0;}),others=fighter.hand.filter(function(x){return observedUids.indexOf(x.uid)<0;});
      fighter.hand=shown.length>1?[shown[0]].concat(others,shown.slice(1)):shown.concat(others);
    }
    return {fighter:fighter,observedUids:observedUids};
  }
  return {sample:sample};
}());
