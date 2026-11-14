/* Shared keyword operations. New cards opt in through effects and metadata. */
A4.Keywords=(function(){
  'use strict';
  var descriptions={rune:'룬: 발동하면 레스트로 이동하지 않고 효과가 유지됩니다. 캐릭터마다 하나만 유지하며, 다른 룬이 발동하면 기존 룬을 레스트로 보냅니다. 새 룬이 카운터당하면 기존 룬을 유지합니다.',power:'위력: 내 카드의 피해량과 회복량을 고정된 수치만큼 증가시킵니다.',bloodstone:'혈석: 아감마간의 고유 자원입니다. 최대 5개까지 보유하며 스탠바이 페이즈에 회복되지 않고 누적됩니다.',dagger:'단검: 각 단검은 소모되면 피해를 4 주며 최대 5개까지 보유할 수 있습니다.',sunrise:'해오름: 메인 페이즈 1에 추가 효과가 발동합니다.',dusk:'어스름: 메인 페이즈 2에 추가 효과가 발동합니다.',disarm:'무장해제: 이 캐릭터는 방어도를 획득할 수 없습니다.',degrade:'열화: 강화된 카드가 강화되기 전으로 되돌아갑니다.',dredge:'인양: 내 덱 맨 밑에 있는 카드 3장을 미리 봅니다. 1장을 선택해 덱 맨 위에 놓습니다.',unstable:'불안정: 이 카드는 같은 속성의 카드에도 카운터당합니다.',volatile:'휘발성: 이 카드가 손에 있으면 엔드 페이즈시에 게임에서 제외됩니다.',vulnerable:'취약: 이 캐릭터는 피해를 받을 때 50%의 피해를 추가로 입습니다. 소수점은 버립니다.',weakened:'약화: 이 캐릭터는 가하는 피해량이 25% 감소합니다. 소수점은 버립니다.',shock:'감전: 상대의 손에서 최대 마나 이하 비용인 사용 가능한 무작위 카드들을 다음 턴의 엔드 페이즈시까지 사용할 수 없게 만듭니다.',sinking:'침몰: 내 덱에 남은 카드가 0장이 된 적이 있으면, 추가 효과가 발동합니다.',discardBottom:'폐기: 내 덱 맨 아래에서 카드 X장을 레스트로 보냅니다.',execution:'처형: 매 턴의 스탠바이 페이즈시에, 대상의 체력이 처형 중첩보다 낮으면 처형합니다. 처형되지 않으면 처형 중첩이 1 감소합니다.',liberation:'해방: 이 카드는 조건을 만족하기 전까지 사용할 수 없습니다. 손에 있는 동안 조건을 충족하면 해방되며 레스트로 이동하면 초기화됩니다.',orbit:'궤도: 이 카드가 손에 있을 때, 다른 카드를 일정 수만큼 사용했으면 추가 효과가 발동합니다.',awakening:'각성: 내 최대 마나가 5에 도달한 적이 있으면, 추가 효과가 발동합니다.'};
  function observe(f){if(A4.TreasureRules&&A4.TreasureRules.owns(f,'icarus_wings')){f.maxMana=3;f.mana=Math.min(5,f.mana);}f.status=f.status||{};if(!f.deck.length)f.status.deckEmptied=true;if(f.maxMana>=5)f.status.awakened=true;}
  function effects(f){f.status.cards=f.status.cards||{effects:[]};return f.status.cards.effects||(f.status.cards.effects=[]);}
  function active(f,kind,b){return ((f.status.cards||{}).effects||[]).some(function(e){return e.kind===kind&&(e.from===undefined||e.from<=b.turn)&&(e.until===undefined||e.until>=b.turn);});}
  function condition(ctx,side,card,test){
    var f=ctx.fighter(side);observe(f);if(test===true)return true;if(!test)return false;
    if(test.type==='sunrise'||test.type==='dusk')return (ctx.battle.resolution&&ctx.battle.resolution.phase||ctx.battle.phase)===(test.type==='sunrise'?'MAIN1':'MAIN2');
    if(test.type==='sinking')return !!f.status.deckEmptied;
    if(test.type==='awakening')return !!f.status.awakened;
    if(test.type==='turn')return ctx.battle.turn+1>=test.amount;
    if(test.type==='hpBelow')return f.hp<test.amount;
    if(test.type==='played')return f.playedThisTurn>=test.amount;
    if(test.type==='orbit')return (card.orbitCount||0)>=test.amount;
    if(test.all)return test.all.every(function(x){return condition(ctx,side,card,x);});
    if(test.any)return test.any.some(function(x){return condition(ctx,side,card,x);});
    return false;
  }
  function liberated(ctx,side,card,test){if(card.liberationReady)return true;if(test&&(test.type==='heroPowerUsed'||test.type==='played'))return false;if(condition(ctx,side,card,test)){card.liberationReady=true;return true;}return false;}
  function enqueue(ctx,side,list,card){(list||[]).forEach(function(e){ctx.enqueue({kind:'effect',side:side,card:card||null,effect:ctx.copy(e)});});}
  function effect(ctx,t){
    if(t.effect.type==='summonMinion'){A4.Minions.summon(ctx,t.side,t.effect.minionId||t.effect.spec);return true;}
    var e=t.effect,side=t.side,other=side==='player'?'enemy':'player',target=e.target==='self'?side:other,f=ctx.fighter(target),b=ctx.battle,n=Math.max(0,Math.floor(e.amount||0)),card;
    if(e.type==='sunrise'||e.type==='dusk'){if(condition(ctx,side,t.card,{type:e.type}))enqueue(ctx,side,e.effects,t.card);return true;}
    if(e.type==='power'){f=ctx.fighter(side);f.status.classes=f.status.classes||{};f.status.classes.powerBonus=(f.status.classes.powerBonus||0)+n;return true;}
    if(e.type==='bloodstone'){f=ctx.fighter(side);f.bloodstones=Math.min(5,(f.bloodstones||0)+n);ctx.runChange({type:'bloodstones',side:side,amount:f.bloodstones});return true;}
    if(e.type==='dagger'){f=ctx.fighter(side);f.daggers=Math.min(5,(f.daggers||0)+n);return true;}
    if(e.type==='consumeDaggers'){f=ctx.fighter(side);var spent=Math.min(f.daggers||0,e.amount===undefined?5:n);f.daggers=(f.daggers||0)-spent;for(var d=0;d<spent;d++)ctx.damage(side,other,4,{card:null,noBonus:true});return true;}
    if(['disarm','vulnerable','weakened'].indexOf(e.type)>=0){if(ctx.modify('harmfulEffect',{side:target,kind:e.type,cancel:false}).cancel)return true;var status={kind:e.type,from:b.turn};if(e.turns!==undefined)status.until=b.turn+Math.max(0,e.turns);effects(f).push(status);return true;}
    if(e.type==='degrade'){
      if(ctx.modify('harmfulEffect',{side:target,kind:'degrade',cancel:false}).cancel)return true;
      var zones=e.zones||['hand'];zones.forEach(function(zone){(f[zone]||[]).forEach(function(x){if(e.uid&&x.uid!==e.uid)return;x.upgraded=false;if(x.originalCardId==='crystal_ball')x.crystalUpgraded=false;delete x.revertUpgradeTurn;});});return true;
    }
    if(e.type==='shock'){
      if(ctx.modify('harmfulEffect',{side:target,kind:'shock',cancel:false}).cancel)return true;
      var available=f.hand.filter(function(x){return A4.Battle.cardAllowed(b,target,ctx.catalog,x)&&ctx.cost(target,x)<=f.maxMana;});
      for(var i=0;i<n&&available.length;i++){card=ctx.pick(available);available.splice(available.indexOf(card),1);card.shockedUntil=Math.max(card.shockedUntil===undefined?-1:card.shockedUntil,b.turn+1);}return true;
    }
    if(e.type==='dredgeKeyword'){var owner=ctx.fighter(side);ctx.choose(side,owner.deck.slice(-3),{module:'keywords',op:'dredge',side:side},{label:'인양',sourceZone:'deck'});return true;}
    if(e.type==='discardBottom'){
      f=ctx.fighter(side);for(var j=0;j<n&&f.deck.length;j++)ctx.move(side,f.deck[f.deck.length-1].uid,'rest');observe(f);return true;
    }
    if(e.type==='execution'){if(ctx.modify('harmfulEffect',{side:target,kind:'execution',cancel:false}).cancel)return true;f.status.execution=(f.status.execution||0)+n;return true;}
    if(e.type==='sinking'||e.type==='awakening'){f=ctx.fighter(side);observe(f);if(e.type==='sinking'?f.status.deckEmptied:f.status.awakened)enqueue(ctx,side,e.effects,t.card);return true;}
    return false;
  }
  function modify(ctx,what,data){
    if(what==='cardUsable'){
      if(data.card.shockedUntil!==undefined&&data.card.shockedUntil>=ctx.battle.turn){data.allowed=false;data.reason='감전으로 사용할 수 없는 카드입니다.';}
      if(data.def.liberation&&!liberated(ctx,data.side,data.card,data.def.liberation)){data.allowed=false;data.reason='해방 조건을 만족하지 않았습니다.';}
    }
  }
  function hook(ctx,e){
    var b=ctx.battle;
    ['player','enemy'].forEach(function(side){var f=ctx.fighter(side);observe(f);
      if(e.type==='standby'&&f.status.execution>0&&f.status.executionTurn!==b.turn){
        f.status.executionTurn=b.turn;
        if(f.hp<f.status.execution){f.hp=0;ctx.note('text',side,0,{text:f.name+' 처형.'});}
        else f.status.execution--;
      }
      if((e.type==='cardUsed'||e.type==='powerUsed')&&e.side===side){f.hand.forEach(function(x){var d=ctx.def(x),rule=d.liberation;if(!rule||x.liberationReady||e.card&&e.card.uid===x.uid)return;if(rule.type==='heroPowerUsed'&&e.type==='powerUsed'||rule.type==='played'&&e.type==='cardUsed'&&!e.free){x.liberationProgress=(x.liberationProgress||0)+1;if(x.liberationProgress>=(rule.amount||1))x.liberationReady=true;}});}
      if(e.type==='cardUsed'&&e.side===side){f.hand.forEach(function(x){if(e.card&&e.card.uid===x.uid)return;var d=ctx.def(x),orbit=d.orbit;if(!orbit||x.orbitTriggered)return;x.orbitCount=(x.orbitCount||0)+1;if(x.orbitCount>=orbit.count){x.orbitTriggered=true;enqueue(ctx,side,orbit.effects,x);}});}
      if(e.type==='afterEnd'){
        f.status.cards=f.status.cards||{effects:[]};f.status.cards.effects=effects(f).filter(function(x){return ['disarm','vulnerable','weakened'].indexOf(x.kind)<0||x.until===undefined||x.until>b.turn;});
        ['hand','deck','rest','excluded','inFlight'].forEach(function(zone){f[zone].forEach(function(x){if(x.shockedUntil!==undefined&&x.shockedUntil<=b.turn)delete x.shockedUntil;});});
      }
    });
  }
  return {run:function(ctx,t){if(t.module!=='keywords'||t.op!=='dredge')return false;var card=ctx.remove(t.side,t.choice.uid);if(card)ctx.fighter(t.side).deck.unshift(card);return true;},descriptions:descriptions,observe:observe,active:active,condition:condition,liberated:liberated,effect:effect,modify:modify,hook:hook};
}());
