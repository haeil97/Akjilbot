/* Serializable post-battle rewards and tavern. Currency belongs to this run. */
A4.Journey=(function(){
  'use strict';
  function own(run,id){return Object.keys(run.treasures||{}).some(function(k){return run.treasures[k]===id;});}
  function cap(run,c){return (run.maxHp||(A4.Regions?A4.Regions.playerHp(run,c):c.config.playerMaxHpByStage[Math.min(7,run.wins)]))||60;}
  function cards(run,c){return run.deck.filter(function(x){var d=c.cards[x.cardId];return d&&d.upgrade&&!x.upgraded&&!d.treasure&&!x.treasureSlot;});}
  function show(state,run,kind,options,extra){run.phase='REWARD';run.pending={id:A4.id(state,'choice-'),kind:kind,options:A4.copy(options),extra:extra||null};}
  function pool(run,c){var hero=c.heroes.filter(function(x){return x.id===run.hero.id;})[0];return (hero&&hero.classPool||run.hero.classPool||[]).filter(function(id){return !!c.cards[id];});}
  function removalCandidates(run,c,previous){return run.deck.filter(function(x){var d=c.cards[x.cardId];return d&&!d.treasure&&!x.treasureSlot&&(!previous||x.cardId!==previous.cardId||!!x.upgraded!==!!previous.upgraded);});}
  function curseCandidates(run,c){return removalCandidates(run,c).filter(function(x){return A4.Combat.describeCard(x,c).element==='CURSE';});}
  function availableTreasures(run,c,tier){return Object.keys(c.treasures).filter(function(id){var t=c.treasures[id];return t.tier===tier&&!t.retired&&(!t.classId||t.classId===run.hero.id)&&(!t.excludeHeroes||t.excludeHeroes.indexOf(run.hero.id)<0)&&!own(run,id);});}
  function lowTreasures(run,c){return availableTreasures(run,c,'low');}
  function ownedGeneralLow(run,c){return Object.keys(run.treasures||{}).filter(function(slot){var id=run.treasures[slot],t=c.treasures[id];return t&&t.tier==='low'&&!t.classId&&!t.retired&&id!==run.hero.startingTreasureId&&!(c.startingTreasures&&c.startingTreasures[id]);}).map(function(slot){return {slot:slot,treasureId:run.treasures[slot]};});}
  function price(run,value,rng){return value;}
  function cardPrice(c,id){var d=c.cards[id];return d.shopPrice||Math.min(6,3+Math.max(0,d.cost||0));}
  function add(state,run,id){var x={uid:A4.id(state,'card-'),cardId:id,upgraded:false};run.deck.push(x);return x;}
  function stock(run,c,rng){
    var out=[],privatePool=pool(run,c),ordinary=c.cardPool||[];
    function offer(ids,n,kind){var available=ids.slice();for(var i=0;i<n&&ids.length;i++){if(!available.length)available=ids.slice();var id=A4.pick(available,rng);available.splice(available.indexOf(id),1);out.push({kind:kind,cardId:id,price:price(run,cardPrice(c,id),rng),sold:false});}}
    offer(privatePool,3,'card');offer(ordinary,2,'card');
    out.push({kind:'remove',price:price(run,3+Math.max(0,run.wins-1)*2,rng),sold:false});
    var health=Math.max(0,Math.min(1,(run.hp===undefined?cap(run,c):run.hp)/cap(run,c)));
    if(rng()<0.15+0.7*(1-health))out.push({kind:'potion',amount:10,price:price(run,4,rng),sold:false});
    if(cards(run,c).length&&rng()<0.15+0.7*health)out.push({kind:'upgrade',price:price(run,5,rng),sold:false});
    if(own(run,'vip_membership'))out.forEach(function(item){item.originalPrice=item.price;item.discountPercent=10+Math.floor(rng()*21);item.price=Math.max(1,Math.floor(item.originalPrice*(100-item.discountPercent)/100));});
    return out;
  }
  function next(state,user,c,rng){
    var r=user.run,step,opts;
    while(r.queue.length){step=r.queue.shift();
      if(step==='bundles'){
        var ids=pool(r,c);A4.assert(ids.length,'이 직업의 보상 카드가 아직 없습니다.');opts=[];
        for(var i=0;i<3;i++){var bundle=[];for(var j=0;j<3;j++)bundle.push(A4.pick(ids,rng));opts.push(bundle);}show(state,r,'bundles',opts);return true;
      }
      if(step==='camp'){show(state,r,'camp',['rest','forge']);return true;}
      if(step==='forge'){opts=A4.sample(cards(r,c),3,rng).map(function(x){return x.uid;});if(opts.length){show(state,r,'forge',opts);return true;}continue;}
      if(step==='event'){
        if(rng()>=Math.min(100,20+(r.eventChanceBonusPercent||0))/100)continue;
        var region=A4.Regions&&A4.Regions.enabled(r)?A4.Regions.progress(r,true):null;
        var curses=curseCandidates(r,c);
        var events=(A4.content.regionEvents||[]).filter(function(e){return region&&e.regionId===region.regionId&&(!e.requiresRemovalCandidate||removalCandidates(r,c).length)&&(!e.lowTreasureOffers||lowTreasures(r,c).length>=2)&&(!e.requiresOwnedGeneralLow||ownedGeneralLow(r,c).length)&&(e.curseOrHpAtMost===undefined||curses.length||(r.hp===undefined?cap(r,c):r.hp)<=e.curseOrHpAtMost);});
        if(events.length){var event=A4.copy(A4.pick(events,rng)),extra={event:event};if(event.requiresOwnedGeneralLow)extra.ownedLowCandidate=A4.copy(A4.pick(ownedGeneralLow(r,c),rng));if(event.requiresRemovalCandidate)extra.removalCandidate=A4.copy(A4.pick(removalCandidates(r,c),rng));if(event.choices.some(function(x){return x.requiresCurse;})&&curses.length)extra.removalCandidate=A4.copy(A4.pick(curses,rng));if(event.lowTreasureOffers){extra.treasureCandidates=A4.sample(lowTreasures(r,c),2,rng);extra.rerollCount=0;}event.choices=event.choices.filter(function(x){return !x.requiresCurse||curses.length;});show(state,r,'event',event.choices.map(function(x){return x.id;}),extra);}
        else show(state,r,'event',['continue']);return true;
      }
      if(step==='tavern'){r.tavern=stock(r,c,rng);return tavern(state,user);}
      if(step==='clear'){r.journeyClear=true;return false;}
      // Treasure milestones retain their existing selection and swap rules.
      r.queue.unshift(step);return false;
    }
    return false;
  }
  function tavern(state,user){var r=user.run;show(state,r,'tavern',r.tavern.map(function(x,i){return {index:i,item:x};}).concat([{leave:true}]));return true;}
  function reward(run,c,rng,state){
    var missing=1-Math.max(0,Math.min(1,run.hp/cap(run,c))),base=4+Math.floor(rng()*3),bonus=Math.min(5,Math.round(missing*5));
    var eventBonus=run.nextBattleGoldBonus||0,investmentBonus=0,waiting=[];run.lastBattleEventRewards=[];
    (run.delayedEventRewards||[]).forEach(function(entry){
      if(run.wins<entry.dueWins){waiting.push(entry);return;}
      var payout={id:entry.id,eventId:entry.eventId,gold:entry.gold||0};
      if(entry.lowTreasure){var available=lowTreasures(run,c);if(!available.length){waiting.push(entry);return;}A4.assert(state,'지연 보물 지급에 저장 상태가 필요합니다.');var id=A4.pick(available,rng),slot='extra-'+A4.id(state,'treasure-');run.treasures[slot]=id;payout.treasureId=id;if(c.treasures[id].kind==='card'){var card=add(state,run,c.treasures[id].cardId);card.treasureSlot=slot;}}
      investmentBonus+=payout.gold;run.lastBattleEventRewards.push(payout);
    });
    if(waiting.length)run.delayedEventRewards=waiting;else delete run.delayedEventRewards;
    run.gold=(run.gold||0)+base+bonus+eventBonus+investmentBonus;run.lastBattleGold={base:base,bonus:bonus,eventBonus:eventBonus,investmentBonus:investmentBonus,total:base+bonus+eventBonus+investmentBonus};delete run.nextBattleGoldBonus;
    run.journeyVersion=2;
    var milestone=run.wins===1?['low']:run.wins===4?['high']:run.wins===6?['swap']:[];
    run.queue=milestone.concat(['bundles','camp','event','tavern']);if(run.wins>=(A4.Regions?A4.Regions.limit(run):8))run.queue.push('clear');
  }
  function choose(state,user,c,p,picked,rng){
    var r=user.run,x,offer;
    if(p.kind==='eventRemove'){
      var selected=p.extra.candidates.filter(function(card){return card.uid===picked;})[0];A4.assert(selected,'제시된 카드 중 하나를 선택하세요.');
      var removalEvent=A4.copy(p.extra.event),removalChoice=removalEvent.choices.filter(function(choice){return choice.id===p.extra.choiceId;})[0];
      A4.assert(removalChoice,'이벤트 선택지가 올바르지 않습니다.');delete removalChoice.discoverRemoval;removalChoice.removeCandidate=true;
      return choose(state,user,c,{kind:'event',extra:{event:removalEvent,removalCandidate:selected}},removalChoice.id,rng);
    }
    if(p.kind==='bundles'){var offered=[].concat.apply([],p.options);picked.forEach(function(id){add(state,r,id);});A4.Stats.choice(state,offered,picked,c);return true;}
    if(p.kind==='camp'){if(picked==='rest')r.hp=Math.min(cap(r,c),(r.hp===undefined?cap(r,c):r.hp)+10);else r.queue.unshift('forge');return true;}
    if(p.kind==='forge'||p.kind==='shopUpgrade'){x=cards(r,c).filter(function(y){return y.uid===picked;})[0];A4.assert(x,'강화할 수 없는 카드입니다.');x.upgraded=true;if(p.kind==='shopUpgrade')r.queue.unshift('tavernResume');return true;}
    if(p.kind==='shopRemove'){A4.assert(r.deck.some(function(y){return y.uid===picked;}),'덱에 없는 카드입니다.');r.deck=r.deck.filter(function(y){return y.uid!==picked;});r.queue.unshift('tavernResume');return true;}
    if(p.kind==='event'){
      var event=p.extra&&p.extra.event;if(!event)return true;
      var choice=event.choices.filter(function(x){return x.id===picked;})[0];A4.assert(choice,'이벤트 선택지가 올바르지 않습니다.');
      A4.assert((r.gold||0)>=(choice.costGold||0),event.id==='today_soup'?'골드가 부족합니다. 다른 수프를 선택하세요.':'골드가 부족합니다. 다른 선택지를 골라주세요.');
      if(choice.discoverRemoval){
        var removalOptions=A4.sample(removalCandidates(r,c),3,rng);A4.assert(removalOptions.length,'제거할 수 있는 카드가 없습니다. 다른 선택지를 골라주세요.');
        show(state,r,'eventRemove',removalOptions.map(function(card){return card.uid;}),{event:A4.copy(event),choiceId:choice.id,candidates:A4.copy(removalOptions)});return 'stay';
      }
      if(choice.rerollTreasures){
        var previousTreasures=p.extra.treasureCandidates||[],newTreasures=lowTreasures(r,c).filter(function(id){return previousTreasures.indexOf(id)<0;});
        A4.assert(newTreasures.length>=2,'교체할 다른 하급 보물 후보가 부족합니다. 다른 선택지를 골라주세요.');
        var hpCost=2+4*(p.extra.rerollCount||0);r.hp=Math.max(0,(r.hp===undefined?cap(r,c):r.hp)-hpCost);
        if(r.hp===0)return {eventDefeat:true,eventResult:{name:event.name,title:event.resultTitle,outro:'보따리를 살펴보다 쓰러졌습니다.',loseHp:hpCost}};
        var refreshed=A4.copy(p.extra);refreshed.treasureCandidates=A4.sample(newTreasures,2,rng);refreshed.rerollCount=(refreshed.rerollCount||0)+1;refreshed.lastRerollHp=hpCost;
        show(state,r,'event',p.options,refreshed);return 'stay';
      }
      if(choice.rerollCandidate){
        var alternatives=removalCandidates(r,c,p.extra.removalCandidate);A4.assert(alternatives.length,'직전 후보와 다른 카드가 없습니다. 다른 선택지를 골라주세요.');
        var nextCandidate=A4.pick(alternatives,rng);r.gold=(r.gold||0)-(choice.costGold||0);var updated=A4.copy(p.extra);updated.removalCandidate=A4.copy(nextCandidate);show(state,r,'event',p.options,updated);return 'stay';
      }
      if(choice.nextEvent){
        if(choice.loseHp){r.hp=Math.max(0,(r.hp===undefined?cap(r,c):r.hp)-choice.loseHp);if(r.hp===0)return {eventDefeat:true,eventResult:{name:event.name,title:event.resultTitle,outro:'상자를 꺼내다 쓰러졌습니다.',loseHp:choice.loseHp}};}
        var following=A4.copy(choice.nextEvent);show(state,r,'event',following.choices.map(function(x){return x.id;}),{event:following});return 'stay';
      }
      if(choice.outcomes)choice=choice.outcomes[rng()<0.5?0:1];
      var treasurePool=choice.exchangeOwnedLow?availableTreasures(r,c,'high'):choice.addLowTreasure||choice.treasureOffer!==undefined?lowTreasures(r,c):[],offeredTreasure=choice.treasureOffer!==undefined&&(p.extra.treasureCandidates||[])[choice.treasureOffer];
      A4.assert(!choice.addLowTreasure||treasurePool.length,'획득할 하급 보물이 없습니다.');
      A4.assert(choice.treasureOffer===undefined||offeredTreasure&&treasurePool.indexOf(offeredTreasure)>=0,'선택한 하급 보물을 획득할 수 없습니다.');
      var exchanged=choice.exchangeOwnedLow&&p.extra.ownedLowCandidate;
      A4.assert(!choice.exchangeOwnedLow||exchanged&&ownedGeneralLow(r,c).some(function(held){return held.slot===exchanged.slot&&held.treasureId===exchanged.treasureId;}),'교환할 일반 하급 보물이 없습니다.');
      A4.assert(!choice.exchangeOwnedLow||treasurePool.length,'획득할 상급 보물이 없습니다.');
      var removal=choice.removeCandidate?r.deck.filter(function(x){return p.extra.removalCandidate&&x.uid===p.extra.removalCandidate.uid;})[0]:null;
      A4.assert(!choice.removeCandidate||removal&&c.cards[removal.cardId]&&!c.cards[removal.cardId].treasure&&!removal.treasureSlot,'제거할 카드가 없습니다. 다른 선택지를 골라주세요.');
      A4.assert(!choice.requiresCurse||removal&&A4.Combat.describeCard(removal,c).element==='CURSE','제거할 저주가 없습니다. 다른 선택지를 골라주세요.');
      A4.assert(!choice.addCardId||c.cards[choice.addCardId],'이벤트 보상 카드가 등록되지 않았습니다.');
      var privatePool=choice.addClassCard?pool(r,c):[];A4.assert(!choice.addClassCard||privatePool.length,'추가할 직업 카드가 없습니다.');
      var result={id:event.id,name:event.name,title:choice.resultTitle||event.resultTitle,simpleResult:!!event.simpleResult,outro:choice.outro||event.outro,beforeHp:r.hp===undefined?cap(r,c):r.hp,maxHp:cap(r,c),beforeGold:r.gold||0,heal:choice.heal||0,costGold:choice.costGold||0,gainGold:choice.gainGold||0,cardId:null,deckText:event.deckText||'내 덱',removedCard:removal?A4.copy(removal):null};
      r.gold=result.beforeGold-result.costGold+result.gainGold;
      if(choice.addLowTreasure||offeredTreasure||choice.exchangeOwnedLow){var treasureId=offeredTreasure||A4.pick(treasurePool,rng),slot=exchanged?exchanged.slot:'extra-'+A4.id(state,'treasure-');if(exchanged){result.lostTreasureId=exchanged.treasureId;result.treasureNoParticle=true;r.deck=r.deck.filter(function(card){return card.treasureSlot!==slot;});}r.treasures[slot]=treasureId;result.treasureId=treasureId;if(c.treasures[treasureId].kind==='card'){var treasureCard=add(state,r,c.treasures[treasureId].cardId);treasureCard.treasureSlot=slot;}}
      if(choice.addClassCard){result.cardId=A4.pick(privatePool,rng);add(state,r,result.cardId);}
      if(choice.addCardId){result.cardId=choice.addCardId;add(state,r,choice.addCardId);}
      if(removal)r.deck=r.deck.filter(function(x){return x.uid!==removal.uid;});
      result.loseHp=choice.loseHp||0;result.logOrder=event.logOrder||null;
      if(choice.nextBattleGold){r.nextBattleGoldBonus=(r.nextBattleGoldBonus||0)+choice.nextBattleGold;result.nextBattleGold=choice.nextBattleGold;}
      if(choice.eventChanceBonusPercent){r.eventChanceBonusPercent=Math.min(80,(r.eventChanceBonusPercent||0)+choice.eventChanceBonusPercent);result.eventChanceBonusPercent=choice.eventChanceBonusPercent;}
      if(choice.delayedReward){var delayed=A4.copy(choice.delayedReward);delayed.id=A4.id(state,'event-reward-');delayed.eventId=event.id;delayed.dueWins=r.wins+delayed.battles;if(!r.delayedEventRewards)r.delayedEventRewards=[];r.delayedEventRewards.push(delayed);result.delayedReward=A4.copy(choice.delayedReward);}
      r.hp=Math.max(0,Math.min(result.maxHp,result.beforeHp+result.heal-result.loseHp));result.afterHp=r.hp;result.afterGold=r.gold;r.lastEventResult=A4.copy(result);
      return {eventResult:result,eventDefeat:r.hp===0};
    }
    if(p.kind==='tavern'){
      if(picked.leave){var interest=Math.min(5,Math.floor((r.gold||0)/10));r.gold+=interest;r.lastInterest=interest;delete r.tavern;return true;}
      offer=r.tavern[picked.index];A4.assert(offer&&!offer.sold,'이미 구매한 물품입니다.');A4.assert((r.gold||0)>=offer.price,'골드가 부족합니다.');
      if(offer.kind==='remove'){A4.assert(r.deck.length>0,'제거할 카드가 없습니다.');show(state,r,'shopRemove',r.deck.map(function(y){return y.uid;}));}
      else if(offer.kind==='upgrade'){var candidates=A4.sample(cards(r,c),3,rng);A4.assert(candidates.length,'강화할 카드가 없습니다.');show(state,r,'shopUpgrade',candidates.map(function(y){return y.uid;}));}
      else if(offer.kind==='potion'){r.hp=Math.min(cap(r,c),r.hp+offer.amount);}
      else add(state,r,offer.cardId);
      r.gold-=offer.price;offer.sold=true;
      if(offer.kind==='card'||offer.kind==='potion')tavern(state,user);
      return 'stay';
    }
    return false;
  }
  function resume(state,user){var r=user.run;if(r.queue[0]==='tavernResume'){r.queue.shift();tavern(state,user);return true;}return false;}
  return {next:next,choose:choose,reward:reward,resume:resume,price:price,cardPrice:cardPrice};
}());
