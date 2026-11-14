A4.Stats = (function () {
  function empty(){return {version:1,cards:{},elements:{},treasures:{},bots:{}};}
  function bucket(state){return state.stats||(state.stats=empty());}
  function record(map,key){if(!A4.has(map,key))map[key]={offered:0,picked:0,runs:0,totalWins:0,win:0,loss:0};return map[key];}
  function ordinary(id,catalog){return (catalog.cardPool||[]).indexOf(id)>=0||!!(catalog.cards[id]&&catalog.cards[id].classCard&&!catalog.cards[id].treasure);}
  function choice(state,options,picked,catalog,treasure){
    var stats=bucket(state),map=treasure?stats.treasures:stats.cards,seen={};
    function valid(id){return treasure?!!catalog.treasures[id]:ordinary(id,catalog);}
    options.forEach(function(id){if(!valid(id)||seen[id])return;seen[id]=true;record(map,id).offered++;
      if(!treasure)record(stats.elements,catalog.cards[id].element).offered++;
    });
    var selected=Array.isArray(picked)?picked:[picked],selectedSeen={};selected.forEach(function(id){if(valid(id)&&!selectedSeen[id]){selectedSeen[id]=true;record(map,id).picked++;if(!treasure)record(stats.elements,catalog.cards[id].element).picked++;}});
  }
  function finish(state,run,catalog){
    if(run.statsFinished)return;
    var stats=bucket(state),elements={},cards={},treasures={};
    function add(r){r.runs++;r.totalWins+=run.wins;}
    (run.deck||[]).forEach(function(card){cards[card.cardId]=true;});
    Object.keys(run.treasures||{}).forEach(function(slot){treasures[run.treasures[slot]]=true;});
    Object.keys(cards).forEach(function(id){if(!ordinary(id,catalog))return;add(record(stats.cards,id));elements[catalog.cards[id].element]=true;});
    Object.keys(elements).forEach(function(el){add(record(stats.elements,el));});
    Object.keys(treasures).forEach(function(id){if(catalog.treasures[id])add(record(stats.treasures,id));});
    run.statsFinished=true;
  }
  function battle(state,run,won){
    if(!run||run.phase!=='BATTLE'||!run.battle)return;
    var stage=String(run.wins+1),done=run.statsRecordedStages||(run.statsRecordedStages={});
    if(done[stage])return;
    var id=run.enemyId||run.battle.enemy.bossId;
    if(id){var r=record(bucket(state).bots,id);r[won?'win':'loss']++;}
    done[stage]=true;
  }
  function percent(n,d){return (d>0?n/d*100:0).toFixed(1)+'%';}
  function render(stats,catalog){
    stats=stats||empty();
    var icons={FIRE:'🔥',NATURE:'🍃',LIGHTNING:'⚡',ICE:'❄️',HOLY:'🕊️',NEUTRAL:'🌊',COSMIC:'🌌',CURSE:'💔'};
    var names={FIRE:'화염',NATURE:'자연',LIGHTNING:'전기',ICE:'냉기',HOLY:'신성',NEUTRAL:'무속성',COSMIC:'우주'};
    var elements=['FIRE','ICE','NATURE','LIGHTNING','HOLY','NEUTRAL','COSMIC'];
    var lines=['📊 탐험 통계 📊',new Array(1001).join('\u200b'),'','■ 속성별 통계'];
    function get(map,id){return map&&A4.has(map,id)?map[id]:{};}
    function average(r){return (r.runs>0?r.totalWins/r.runs:0).toFixed(2)+'승 ('+(r.runs||0)+'회)';}
    function picked(r){return percent(r.picked||0,r.offered||0)+' ('+(r.picked||0)+'/'+(r.offered||0)+')';}
    function line(name,r){return name+': 선택률 '+picked(r)+' | 평균 승수 '+average(r);}
    elements.filter(function(el){return el!=='NEUTRAL'&&el!=='COSMIC';}).forEach(function(el){lines.push(line(icons[el]+' '+names[el],get(stats.elements,el)));});
    lines.push('','■ 카드별 통계');
    elements.forEach(function(el){
      var ids=(catalog.cardPool||[]).concat(Object.keys(catalog.cards).filter(function(id){return catalog.cards[id].classCard;})).filter(function(id){return catalog.cards[id].element===el;});
      if(!ids.length)return;
      lines.push('',icons[el]+' '+names[el]+' 카드 통계');
      ids.forEach(function(id){lines.push(line('['+icons[el]+'] '+catalog.cards[id].name,get(stats.cards,id)));});
    });
    lines.push('','■ 보물별 통계');
    ['low','high'].forEach(function(tier){['passive','card'].forEach(function(kind){
      lines.push('',(tier==='low'?'✨ 하급':'💫 상급')+' '+(kind==='passive'?'지속형':'카드형')+' 보물 통계');
      Object.keys(catalog.treasures||{}).forEach(function(id){var t=catalog.treasures[id],marker=t.tier==='low'?'✨':'💫',element=t.kind==='card'?icons[catalog.cards[t.cardId].element]||'🌊':'';if(t.tier===tier&&t.kind===kind)lines.push(line('['+marker+element+'] '+t.name,get(stats.treasures,id)));});
    });});
    lines.push('','■ 봇별 격파율');
    Object.keys(catalog.enemies||{}).sort(function(a,b){return (catalog.enemies[a].stages||[0])[0]-(catalog.enemies[b].stages||[0])[0];}).forEach(function(id){
      var r=get(stats.bots,id),win=r.win||0,loss=r.loss||0;
      lines.push(catalog.enemies[id].name+': '+win+'승 '+loss+'패 | 격파율 '+percent(win,win+loss));
    });
    return lines.join('\n');
  }
  return {empty:empty,choice:choice,finish:finish,battle:battle,render:render};
}());

A4.Game = (function () {
  function newUser(state, name, now, catalog) {
    var initial = catalog.config.initialInventory;
    A4.assert(initial && A4.integer(initial.keys,0) && A4.integer(initial.gold,0) && A4.integer(initial.stones,0) && A4.integer(initial.essence,0), '신규 유저 시작 재화가 아직 정해지지 않았습니다.');
    return {id:A4.id(state,'user-'),name:name,createdAt:now,gold:initial.gold,items:{keys:initial.keys,stones:initial.stones,essence:initial.essence},keyUpdatedAt:now,slotCount:1,relics:[],equipped:[],run:null,lastRun:null,session:null,receipts:[]};
  }
  function addCard(state, run, cardId, slot) {
    var item = {uid:A4.id(state,'card-'),cardId:cardId,upgraded:false};
    if (slot) item.treasureSlot = slot;
    run.deck.push(item); return item;
  }
  function combinedPassives(user, catalog) {
    var result = A4.Economy.passives(user,catalog), slot, id, treasure;
    if (user.run) for (slot in user.run.treasures) if (A4.has(user.run.treasures,slot)) {
      id = user.run.treasures[slot]; treasure = catalog.treasures[id];
      A4.assert(treasure,'보물 정의가 없습니다: '+id);
      if (treasure.kind === 'passive') result = result.concat(A4.copy(treasure.effects));
    }
    return result.concat(user.run ? A4.copy(user.run.effects) : []);
  }
  function setTreasure(state, user, slot, id, catalog) {
    var run = user.run, def = catalog.treasures[id], previous = run.treasures[slot];
    
    A4.assert(def,'보물 정의가 없습니다.');
    run.deck = run.deck.filter(function (card) { return card.treasureSlot !== slot; });
    run.treasures[slot] = id;
    if (def.kind === 'card') addCard(state,run,def.cardId,slot);
    
    return previous?{before:previous,after:id}:null;
  }
  function availableTreasures(run, catalog, tier) {
    var held = Object.keys(run.treasures).map(function (slot) { return run.treasures[slot]; });
    return Object.keys(catalog.treasures).filter(function (id) { return !catalog.treasures[id].retired && catalog.treasures[id].tier === tier && (!catalog.treasures[id].excludeHeroes||catalog.treasures[id].excludeHeroes.indexOf(run.hero.id)<0) && (!catalog.treasures[id].classId||catalog.treasures[id].classId===run.hero.id) && held.indexOf(id) < 0; });
  }
  function editableCards(run, catalog, upgrading) {
    var seen = {};
    return run.deck.filter(function (card) {
      var def = catalog.cards[card.cardId], uniqueKey = card.cardId + (card.upgraded ? '+' : '');
      if (!def || def.treasure || card.treasureSlot || (upgrading && (card.upgraded || !def.upgrade || seen[uniqueKey]))) return false;
      seen[uniqueKey] = true; return true;
    });
  }
  function pending(state, run, kind, options, extra) {
    run.phase = 'REWARD';
    run.pending = {id:A4.id(state,'choice-'),kind:kind,options:A4.copy(options),extra:extra || null};
  }
  function nextReward(state, user, catalog, rng) {
    var run = user.run, step, candidates;
    if(catalog.config.engineVersion===3&&A4.Journey&&run.journeyVersion!==2){run.journeyVersion=2;run.gold=run.gold||0;run.queue=run.queue.filter(function(x){return ['low','high','swap','replaceHigh'].indexOf(x)>=0;}).concat(['bundles','camp','event','tavern']);}
    if(A4.Journey&&run.journeyVersion===2&&(A4.Journey.resume(state,user)||A4.Journey.next(state,user,catalog,rng)))return;
    while (run.queue.length) {
      if(A4.Journey&&run.journeyVersion===2&&(A4.Journey.resume(state,user)||A4.Journey.next(state,user,catalog,rng)))return;
      step = run.queue.shift();
      if (step === 'add') {
        var remaining=(catalog.config.engineVersion===3&&run.hero&&run.hero.classPool?run.hero.classPool:catalog.cardPool).slice(),offered=[];
        while(offered.length<4&&remaining.length){
          var elements=[];remaining.forEach(function(id){var el=catalog.cards[id].element;if(elements.indexOf(el)<0)elements.push(el);});
          var element=A4.weightedSample(elements,1,rng,function(el){return el==='HOLY'?0.5:1;})[0];
          var chosen=A4.weightedSample(remaining.filter(function(id){return catalog.cards[id].element===element;}),1,rng,function(id){var cost=catalog.cards[id].cost;return cost===5?1:cost===4?2:4;})[0];
          offered.push(chosen);remaining.splice(remaining.indexOf(chosen),1);
        }
        pending(state,run,'add',offered);return;
      }
      if (step === 'upgrade' || step === 'remove') {
        candidates = editableCards(run,catalog,step === 'upgrade');
        if (!candidates.length && step === 'upgrade') continue;
        if(!candidates.length)continue;
        pending(state,run,step,A4.sample(candidates,4,rng).map(function (x) { return x.uid; })); return;
      }
      if (step === 'low' || step === 'high' || step === 'replaceHigh') {
        candidates = availableTreasures(run,catalog,step === 'low' ? 'low' : 'high');
        A4.assert(candidates.length > 0,'획득 가능한 보물이 없습니다.');
        pending(state,run,'treasure',A4.sample(candidates,4,rng),{slot:step === 'replaceHigh' ? (run.swapSlot||'high') : step});run.swapSlot=null; return;
      }
      if (step === 'offerRemove') { pending(state,run,step,['제거한다','제거하지 않는다']); return; }
      if (step === 'swap') { pending(state,run,step,['하급 보물을 무작위 상급 보물로 교체','상급 보물 4개 중 선택하여 기존 상급 보물 교체','교체하지 않는다']); return; }
      if (step === 'finalEdit') { pending(state,run,step,['2장 제거 후 2장 추가','2장 제거','2장 추가']); return; }
      A4.fail('알 수 없는 보상 단계: '+step);
    }
    run.phase = 'READY'; run.pending = null; user.session = null;
  }
  function encounterResults(run) {
    if(!run.encounterResults)run.encounterResults=[];
    // Older saves did not retain defeated opponents' names. Do not invent them.
    for(var stage=1;stage<=run.wins;stage++)if(!run.encounterResults.some(function(x){return x.stage===stage;}))run.encounterResults.push({stage:stage,name:stage+'전투 상대 (이름 기록 없음)',won:true});
    run.encounterResults.sort(function(a,b){return a.stage-b.stage;});
    return run.encounterResults;
  }
  function recordEncounter(run,won) {
    var results=encounterResults(run),enemy=run.battle&&run.battle.enemy||run.enemySpec;
    if(!enemy)return;
    var stage=run.wins+1;
    if(!results.some(function(x){return x.stage===stage;}))results.push({stage:stage,enemyId:run.enemyId||null,name:enemy.name,won:won});
  }
  function finish(state, user, reason, now, rng, catalog) {
    var run = user.run;
    A4.assert(run,'진행 중인 탐험이 없습니다.');
    if(reason!=='clear')A4.Stats.battle(state,run,false);
    A4.Stats.finish(state,run,catalog);
    if(reason!=='clear')recordEncounter(run,false);
    var reward = run.journeyVersion===2?{gold:run.gold||0,keys:0,stones:0,essence:0}:A4.Economy.reward(run.wins,rng);
    A4.Economy.grant(user,reward,now);
    user.lastRun = {id:run.id,wins:run.wins,reason:reason,reward:reward,finishedAt:now,encounterResults:A4.copy(encounterResults(run))};
    user.keyUpdatedAt = Math.max(now, user.keyUpdatedAt);
    user.run = null; user.session = null;
    return user.lastRun;
  }
  function performSwap(state,user,catalog,slot,mode,rng){
    if(mode==='random'){var change=setTreasure(state,user,slot,A4.pick(availableTreasures(user.run,catalog,'high'),rng),catalog);nextReward(state,user,catalog,rng);return {kind:'run',treasureChange:change};}
    else{user.run.swapSlot=slot;user.run.queue.unshift('replaceHigh');nextReward(state,user,catalog,rng);return {kind:'run'};}
  }
  function offerBattle(state,user,catalog,rng) {
    if(catalog.config.engineVersion!==3){beginBattle(state,user,catalog,rng);return;}
    var run=user.run,spec=A4.Opponents.prepare(state,run,catalog);
    run.enemyId=spec.enemyId;run.phase='ENCOUNTER';run.pending=null;run.battle=null;run.turnToken=null;
  }
  function restartEncounter(user,catalog,now,room){
    var run=user.run;
    A4.assert(run&&['BATTLE','ENCOUNTER'].indexOf(run.phase)>=0,'재시작할 진행 중인 전투가 없습니다.');
    A4.assert(catalog.config.engineVersion===3&&run.enemySpec&&run.enemySpec.enemyId===run.enemyId,'재시작할 상대의 저장된 정보가 없습니다.');
    run.enemySpec.maxHp=A4.Opponents.stage(run.wins+1).maxHp;
    run.enemySpec.stage=run.wins+1;
    run.phase='ENCOUNTER';run.pending=null;run.battle=null;run.turnToken=null;
    user.session={room:room,until:now+catalog.config.sessionTimeoutMs};
    return {kind:'run'};
  }
  function beginBattle(state,user,catalog,rng) {
    
    if(catalog.config.engineVersion===3){
      var liveRun=user.run,spec=A4.Opponents.prepare(state,liveRun,catalog);
      liveRun.enemyId=spec.enemyId;
      liveRun.battle=A4.Combat.create({name:user.name,heroName:liveRun.hero.name,heroPower:A4.copy(liveRun.hero.power),heroId:liveRun.hero.id,startingTreasureId:liveRun.hero.startingTreasureId,shrineId:liveRun.shrineId,bloodstones:liveRun.bloodstones,runWins:liveRun.wins,maxHp:catalog.config.playerMaxHpByStage[liveRun.wins],hp:liveRun.hp,deck:A4.copy(liveRun.deck),passives:combinedPassives(user,catalog),treasureIds:Object.keys(liveRun.treasures).map(function(k){return liveRun.treasures[k];})},
        {name:spec.name,bossId:spec.enemyId,startingTreasureId:spec.startingTreasureId,heroPower:A4.BossRules.power(spec.enemyId),maxHp:spec.maxHp,deck:A4.copy(spec.deck),passives:A4.copy(spec.treasurePassives),treasureIds:spec.treasures.map(function(x){return x.treasureId;})},catalog,rng,{publicPlayerHistory:A4.copy(user.aiPublicHistory||[])});
      liveRun.phase='BATTLE';liveRun.pending=null;liveRun.turnToken=A4.id(state,'turn-');
      liveRun.battle.publicPlayerHistory=A4.copy(user.aiPublicHistory||[]);
      applyRunChanges(state,user,catalog);return;
    }
    var run = user.run, enemyId = A4.pick(catalog.encounters[run.wins],rng), enemy = catalog.enemies[enemyId];
    A4.Opponents.rejectBlueprint(enemy);
    run.enemyId = enemyId;
    run.battle = A4.Combat.create({name:user.name,heroName:run.hero.name,heroPower:A4.copy(run.hero.power),maxHp:catalog.config.playerMaxHpByStage[run.wins],hp:run.hp,deck:A4.copy(run.deck),passives:combinedPassives(user,catalog)},
      {name:enemy.name,maxHp:enemy.maxHp,deck:enemy.cards.map(function (id) { return {uid:A4.id(state,'enemy-card-'),cardId:id,upgraded:false}; }),passives:A4.copy(enemy.passives || [])},catalog,rng);
    run.phase = 'BATTLE'; run.pending = null; run.turnToken = A4.id(state,'turn-');
    if (run.battle.outcome && run.battle.outcome !== 'ongoing') A4.fail('전투 시작 직후 종료되었습니다. 초기 체력·지속 효과 설정을 확인하세요.');
  }
  function start(state,user,catalog,now,room,rng) {
    A4.Economy.refreshKeys(user,now);
    if (!user.run) {
      var missing = A4.validateCatalog(catalog);
      A4.assert(!missing.length,'탐험 설정이 비어 있습니다: '+missing.join(', '));
      A4.assert(user.items.keys >= 1,'미궁 열쇠가 부족합니다.');
      user.items.keys--;
      user.run = {id:A4.id(state,'run-'),startedAt:now,wins:0,gold:0,journeyVersion:catalog.config.engineVersion===3?2:1,phase:'HERO',hero:null,deck:[],treasures:{},effects:[],queue:[],pending:null,battle:null};
      user.run.pending = {id:A4.id(state,'choice-'),kind:'hero',options:catalog.heroes.filter(function (s) { return s.enabled!==false; }).map(function (s) { return s.id; })};
    } else if (user.run.phase === 'READY') offerBattle(state,user,catalog,rng);
    user.session = {room:room,until:now+catalog.config.sessionTimeoutMs};
    return {kind:'run'};
  }
  function select(state,user,catalog,token,index,now,rng) {
    var run = user.run, p, picked, card, choices, treasureChange=null;
    if(run && run.phase==='BATTLE' && run.battle.pendingChoice) {
      A4.assert(run.turnToken===token,'이전 전투 선택입니다. +탐험으로 현재 단계를 확인하세요.');
      A4.assert(!run.battle.pendingChoice.lamp||run.battle.pendingChoice.lampStage==='results','+카드명으로 원하는 카드명을 검색하세요.');
      A4.assert(A4.integer(index,1)&&index<=run.battle.pendingChoice.options.length,'선택 번호가 올바르지 않습니다.');
      return battleResult(state,user,catalog,A4.Combat.choose(run.battle,run.battle.rulesVersion===3?index-1:index,catalog,rng),now,rng);
    }
    A4.assert(run && run.pending,'현재 선택할 보상이 없습니다.'); p = run.pending;
    A4.assert(p.id === token,'이미 처리되었거나 이전 화면의 선택입니다. +탐험으로 현재 단계를 확인하세요.');
    A4.assert(A4.integer(index,1) && index <= p.options.length,'선택 번호가 올바르지 않습니다.'); picked = p.options[index-1];
    
    if (p.kind === 'hero') {
      var hero = catalog.heroes.filter(function (s) { return s.id === picked; })[0];
      A4.assert(hero,'선택한 영웅 정의가 없습니다.');A4.assert(hero.enabled!==false,hero.name+'은 '+(hero.incompleteReason||'준비 중')+'으로 아직 선택할 수 없습니다.'); run.hero=A4.copy(hero);
      hero.cards.forEach(function (id) { addCard(state,run,id); }); offerBattle(state,user,catalog,rng); return {kind:'run'};
    }
    var journeyChoice=A4.Journey&&A4.Journey.choose(state,user,catalog,p,picked,rng);
    if(journeyChoice==='stay')return {kind:'run'};
    if(journeyChoice){}
    else if (p.kind === 'add') {A4.Stats.choice(state,p.options,picked,catalog);addCard(state,run,picked);}
    else if (p.kind === 'upgrade') {
      card = run.deck.filter(function (c) { return c.uid === picked; })[0];
      A4.assert(card && !card.upgraded && !card.treasureSlot && !catalog.cards[card.cardId].treasure,'강화할 수 없는 카드입니다.'); card.upgraded = true;
    } else if (p.kind === 'remove') run.deck = run.deck.filter(function (c) { return c.uid !== picked; });
    else if (p.kind === 'swapTarget') {return performSwap(state,user,catalog,picked,p.extra.mode,rng);}
    else if (p.kind === 'treasure') {A4.Stats.choice(state,p.options,picked,catalog,true);treasureChange=setTreasure(state,user,p.extra.slot,picked,catalog);}
    else if (p.kind === 'offerRemove') { if (index === 1) run.queue.unshift('remove'); }
    else if (p.kind === 'swap') {
      if(index===1||index===2){
        var tier=index===1?'low':'high',targets=Object.keys(run.treasures).filter(function(slot){return catalog.treasures[run.treasures[slot]].tier===tier;});
        A4.assert(targets.length,'교체할 '+(tier==='low'?'하급':'상급')+' 보물이 없습니다. 다른 항목을 선택하세요.');
        if(targets.length>1)pending(state,run,'swapTarget',targets,{mode:index===1?'random':'chosen'});
        else return performSwap(state,user,catalog,targets[0],index===1?'random':'chosen',rng);
        return {kind:'run'};
      }
    } else if (p.kind === 'finalEdit') {
      if (index === 1) run.queue = ['remove','remove','add','add'].concat(run.queue);
      if (index === 2) run.queue = ['remove','remove'].concat(run.queue);
      if (index === 3) run.queue = ['add','add'].concat(run.queue);
    } else A4.fail('알 수 없는 선택 단계입니다.');
    nextReward(state,user,catalog,rng); if(run.journeyClear)return {kind:'finished',record:finish(state,user,'clear',now,rng,catalog)};return {kind:'run',treasureChange:treasureChange};
  }
  function submit(state,user,catalog,token,indices,now,rng,heroPower) {
    var run = user.run, ids = [], battle, result, queues;
    A4.assert(run && run.phase === 'BATTLE','진행 중인 전투가 없습니다.');
    A4.assert(run.turnToken === token,'이미 처리되었거나 이전 턴의 제출입니다. +탐험으로 현재 전투를 확인하세요.');
    battle = run.battle;
    var targets={},available=A4.Minions?A4.Minions.targets(battle,'enemy'):[];
    indices.forEach(function (index) {
      var number=index,target=1;if(String(index).indexOf(':')>=0){var parts=String(index).split(':');number=Number(parts[0]);target=Number(parts[1]);}else if(index>=10&&available.length>1){number=Math.floor(index/10);target=index%10;}
      A4.assert(A4.integer(number,1)&&number<=battle.player.hand.length,'손패 번호가 올바르지 않습니다.');
      A4.assert(target>=1&&target<=Math.max(1,available.length),'대상 번호가 올바르지 않습니다.');var card=battle.player.hand[number-1];ids.push(card.uid);if(target>1)targets[card.uid]=available[target-1].uid;
    });
    result = A4.Combat.submit(battle,ids,catalog,rng,{heroPower:!!heroPower,targets:targets});
    return battleResult(state,user,catalog,result,now,rng);
  }
  function battleResult(state,user,catalog,result,now,rng) {
    var run=user.run,queues;
    var b=run.battle;
    user.aiPublicHistory=user.aiPublicHistory||[];
    (b.history||[]).slice(b.aiPublicHistoryCursor||0).forEach(function(h){
      user.aiPublicHistory.push({turn:-1,phase:h.phase,player:(h.player||[]).map(function(card){return {cardId:card.cardId,element:card.element,upgraded:!!card.upgraded,countered:!!card.countered};})});
    });
    user.aiPublicHistory=user.aiPublicHistory.slice(-48);b.aiPublicHistoryCursor=(b.history||[]).length;
    applyRunChanges(state,user,catalog);
    if(run.battle.escapeRequested){
      if(run.battle.escapeRequested.side==='enemy'&&run.enemySpec){
        run.enemySpec.deck=run.enemySpec.deck.filter(function(x){return x.cardId!=='treasure_hearthstone';});
        run.enemySpec.treasures=(run.enemySpec.treasures||[]).filter(function(x){return x.treasureId!=='hearthstone';});
      }
      offerBattle(state,user,catalog,rng);return {kind:'run'};
    }
    var extraMessages=[];
    delete run.battle.pendingDoctorSpeeches;
    if(!run.battle.pendingChoice){extraMessages=(run.battle.pendingPowerAnnouncements||[]).slice();run.battle.pendingPowerAnnouncements=[];}
    var victoryAnnouncement=null,summary=run.battle.rulesVersion===3&&result.outcome!=='ongoing'?A4.BattleUI.summary(run.battle,run.wins+1,catalog):null;
    if (result.removedFromRun && result.removedFromRun.length) run.deck = run.deck.filter(function (c) { return result.removedFromRun.indexOf(c.uid) < 0; });
    if (result.outcome === 'defeat') return {kind:'finished',record:finish(state,user,'defeat',now,rng,catalog),log:result.log,battleSummary:summary,extraMessages:extraMessages};
    if (result.outcome === 'victory') {
      if(run.hero.startingTreasureId==='great_blood'){run.battle.player.hp=Math.min(run.battle.player.maxHp,run.battle.player.hp+12);}
      run.hp=run.battle.player.hp;
      A4.Stats.battle(state,run,true);
      victoryAnnouncement='⚔️ 탐험 - 승리! ⚔️\n'+run.battle.enemy.name+' ✅️';
      recordEncounter(run,true);
      run.wins++; run.battle = null; run.turnToken = null;run.enemySpec=null;
      if (run.wins === 8 && catalog.config.engineVersion!==3) return {kind:'finished',record:finish(state,user,'clear',now,rng,catalog),log:result.log,battleSummary:summary,victoryAnnouncement:victoryAnnouncement,extraMessages:extraMessages};
      queues = {1:['low','add','add'],2:['upgrade','add','add'],3:['offerRemove','add','add'],4:['high','add','add'],5:['upgrade','add','add'],6:['swap','add','add'],7:['finalEdit']};
      if(A4.Journey&&catalog.config.engineVersion===3)A4.Journey.reward(run,catalog,rng);else run.queue=queues[run.wins].slice();nextReward(state,user,catalog,rng);
    } else run.turnToken = A4.id(state,'turn-');
    return {kind:'run',log:result.log,battleSummary:summary,victoryAnnouncement:victoryAnnouncement,extraMessages:extraMessages};
  }
  function applyRunChanges(state,user,catalog){
    var run=user.run,b=run&&run.battle;
    if(!b||!b.runChanges)return;
    
    function instances(callback){['player','enemy'].forEach(function(side){['hand','deck','rest','excluded','inFlight','runes'].forEach(function(zone){(b[side][zone]||[]).forEach(callback);});});}
    function persistCard(source,slot){
      if(!source||!catalog.cards[source.cardId])return;
      var treasureId=catalog.cards[source.cardId].treasureId;
      if(!slot&&treasureId){slot='extra-'+A4.id(state,'treasure-');run.treasures[slot]=treasureId;}
      var c={uid:A4.id(state,'card-'),cardId:source.cardId,upgraded:!!source.upgraded};if(slot)c.treasureSlot=slot;
      run.deck.push(c);instances(function(x){if(x.uid===source.uid||(source.uid&&x.originUid===source.uid))x.runUid=c.uid;});
      return c;
    }
    b.runChanges.forEach(function(change){
      if(change.side==='enemy')return;
      if(change.type==='addCard')persistCard(change.card);
      if(change.type==='removeCard'){
        var uid=change.runUid||change.uid;instances(function(x){if(x.uid===change.uid&&x.runUid)uid=x.runUid;});
        run.deck=run.deck.filter(function(x){return x.uid!==uid;});
      }
      if(change.type==='addTreasure'){
        var id=change.treasureId||change.id,def=catalog.treasures[id];if(!def)return;
        var slot='extra-'+A4.id(state,'treasure-');run.treasures[slot]=id;
        
        if(def.kind==='card'){
          var source=change.card||null;instances(function(x){if(x.uid===change.cardUid)source=x;});
          persistCard(source||{uid:change.cardUid,cardId:def.cardId,upgraded:false},slot);
        }
      }
      if(change.type==='removeTreasure'){
        var target=change.treasureId||change.id,keys=Object.keys(run.treasures),slotToRemove=null;
        keys.some(function(slot){if(run.treasures[slot]===target){slotToRemove=slot;return true;}return false;});
        if(slotToRemove){delete run.treasures[slotToRemove];run.deck=run.deck.filter(function(x){return x.treasureSlot!==slotToRemove;});}
      }
      if(change.type==='setShrine'){run.shrineId=change.shrineId;if(b.restartSpecs)b.restartSpecs.player.shrineId=change.shrineId;}
      if(change.type==='upgradeCard'){var upgradeUid=change.runUid;instances(function(x){if(x.uid===change.uid&&x.runUid)upgradeUid=x.runUid;});run.deck.forEach(function(x){if(x.uid===upgradeUid||x.uid===change.uid)x.upgraded=true;});}
      if(change.type==='bloodstones')run.bloodstones=change.amount;
      if(change.type==='setHeroPower')run.hero.power=A4.copy(change.power);
    });
    b.runChanges=[];
    
    if(b.restartSpecs){
      b.restartSpecs.player.deck=A4.copy(run.deck);b.restartSpecs.player.heroPower=A4.copy(run.hero.power);
      b.restartSpecs.player.passives=combinedPassives(user,catalog);
      b.restartSpecs.player.treasureIds=Object.keys(run.treasures).map(function(k){return run.treasures[k];});
    }
  }
  function equip(user,uid,slot,catalog) {
    A4.assert(!user.run,'진행 중인 탐험이 있으면 유물 장착을 변경할 수 없습니다.');
    A4.assert(A4.integer(slot,1) && slot <= user.slotCount,'사용할 수 없는 장착 슬롯입니다.');
    var item = A4.Economy.findRelic(user,uid), i, other;
    A4.assert(catalog.relics[item.relicId],'유물 정의가 없습니다.');
    for (i = 0; i < user.equipped.length; i++) if (i !== slot-1 && user.equipped[i]) {
      other = A4.Economy.findRelic(user,user.equipped[i]); A4.assert(other.relicId !== item.relicId,'같은 유물을 중복 장착할 수 없습니다.');
    }
    user.equipped[slot-1] = uid;
  }
  function act(state,user,action,catalog,now,room) {
    var rng = A4.random(state), result, slot;
    // Refresh saved Nurture definitions without replacing copied hero powers.
    if(user.run){
      var run=user.run;
      if(run.phase==='HERO'&&run.pending&&run.pending.kind==='hero')run.pending.options=catalog.heroes.filter(function(h){return h.enabled!==false;}).map(function(h){return h.id;});
      Object.keys(run.treasures||{}).forEach(function(slot){
        if(run.treasures[slot]==='hearthstone'&&!run.deck.some(function(x){return x.cardId==='treasure_hearthstone';})){
          var converted={uid:A4.id(state,'card-'),cardId:'treasure_hearthstone',upgraded:false,treasureSlot:slot};run.deck.push(converted);
          if(run.battle){run.battle.player.passives=(run.battle.player.passives||[]).filter(function(x){return x.id!=='hearthstone';});run.battle.player.deck.push(A4.copy(converted));}
        }
      });
      var powers=[run.hero&&run.hero.power],battle=run.battle;
      if(battle)['player','enemy'].forEach(function(side){powers.push(battle[side]&&battle[side].heroPower);if(battle.restartSpecs)powers.push(battle.restartSpecs[side]&&battle.restartSpecs[side].heroPower);});
      powers.forEach(function(power){if(power&&(power.id==='patchwerk'||power.id==='aurelion_sol')){var current=A4.BossRules.power(power.id);power.cooldown=4;power.text=current.text;}});
      powers.forEach(function(power){if(power&&power.id==='inquiry'){var hero=catalog.heroes.filter(function(h){return h.id==='celeste';})[0];if(hero){Object.keys(power).forEach(function(key){delete power[key];});Object.keys(hero.power).forEach(function(key){power[key]=A4.copy(hero.power[key]);});}}});
      powers.forEach(function(power){if(power&&(power.id==='hanar'||power.id==='fiora'||power.id==='yuumi'||power.id==='ivysaur'||power.id==='aviana'))power.text=A4.BossRules.power(power.id).text;});
      powers.forEach(function(power){if(power&&power.id==='boo'){var current=A4.BossRules.power('boo');Object.keys(current).forEach(function(key){power[key]=A4.copy(current[key]);});}});
      powers.forEach(function(power){if(power&&power.id==='meltranix'){var current=A4.BossRules.power('meltranix');Object.keys(current).forEach(function(key){power[key]=A4.copy(current[key]);});}});
      if(battle)['player','enemy'].forEach(function(side){var f=battle[side];if(f&&f.heroPower&&(f.heroPower.id==='patchwerk'||f.heroPower.id==='aurelion_sol')&&f.heroPowerUsedTurn>=0)f.heroPowerReadyTurn=Math.max(f.heroPowerReadyTurn||0,f.heroPowerUsedTurn+4);});
      powers.forEach(function(power){if(power&&power.id==='nurture'&&power.effects&&power.effects.some(function(e){return e.type==='heal';})){power.text='내 손에 있는 무작위 카드의 비용이 (1) 감소합니다.';power.effects=[{type:'discountRandomHand',amount:1}];}});
    }

    if(catalog.config.relicsEnabled===false&&['equip','unequip','expand','enhance'].indexOf(action.type)>=0)A4.fail('유물 시스템은 준비 중입니다.');
    if(catalog.config.shopEnabled===false&&action.type==='pull')A4.fail('상점 시스템은 준비 중입니다.');
    if (action.type === 'explore') {result=start(state,user,catalog,now,room,rng);syncDeadline(user,now);return result;}
    if (action.type === 'encounterResponse') {
      A4.assert(user.run&&user.run.phase==='ENCOUNTER','현재 전투 시작을 기다리고 있지 않습니다.');
      if(!user.session||now>=user.session.until){user.session=null;return {kind:'message',text:'⚔️ 세션 종료: +탐험으로 기존 탐험을 이어갑니다.'};}
      A4.assert(user.session.room===room,'+탐험으로 이 방에서 이어가세요.');
      if(!action.accept){user.session=null;return {kind:'message',text:'⚔️ 세션 종료: +탐험으로 기존 탐험을 이어갑니다.'};}
      beginBattle(state,user,catalog,rng);user.session={room:room,until:now+catalog.config.sessionTimeoutMs};syncDeadline(user,now);return {kind:'run'};
    }
    if (action.type === 'pauseBattle') {
      A4.assert(user.run&&user.run.phase==='BATTLE'&&user.session&&user.session.room===room,'현재 진행 중인 전투가 없습니다.');
      var pausedBattle=user.run.battle;
      if(!canPauseBattle(pausedBattle))return {kind:'message',text:'시간을 신뢰하지 말라. 내가 너를 지도할 것이다.'};
      user.session=null;pausedBattle.mainDeadline=null;
      if(pausedBattle.pendingChoice&&pausedBattle.pendingChoice.lamp)delete pausedBattle.pendingChoice.lampDeadline;
      return {kind:'message',text:'⚔️ 세션 종료: +탐험으로 기존 탐험을 이어갑니다.'};
    }
    if (action.type === 'pauseReward') {
      A4.assert(user.run&&user.run.phase==='REWARD','현재 보상 단계가 아닙니다.');
      user.session=null;
      return {kind:'message',text:'⚔️ 세션 종료: +탐험으로 기존 탐험을 이어갑니다.'};
    }
    if (action.type === 'lampSearch') {
      A4.assert(user.run&&user.run.phase==='BATTLE'&&user.session&&user.session.room===room,'현재 진행 중인 전투가 없습니다.');
      var selection=user.run.battle.pendingChoice;
      A4.assert(selection&&selection.lamp,'현재 램프 검색 단계가 아닙니다.');
      if(action.query===null){selection.lampStage='search';selection.options=[];}
      else {
        var needle=String(action.query||'').replace(/\s/g,'').toLowerCase();
        A4.assert(needle,'+카드명으로 원하는 카드명을 검색하세요.');
        selection.options=catalog.cardPool.filter(function(id){return catalog.cards[id].name.replace(/\s/g,'').toLowerCase().indexOf(needle)>=0;}).sort(function(a,b){var x=catalog.cards[a],y=catalog.cards[b];return x.cost-y.cost||(x.name<y.name?-1:x.name>y.name?1:0);}).map(function(id){return {cardId:id,upgraded:false};});
        selection.lampStage=selection.options.length?'results':'search';
        if(!selection.options.length)return {kind:'message',text:'검색 결과가 없습니다.\n'+A4.BattleUI.controls(user.run.battle,catalog)};
      }
      syncDeadline(user,now);return {kind:'run'};
    }
    if (action.type === 'timeout') {
      A4.assert(user.run&&user.run.phase==='BATTLE'&&user.run.battle.mainDeadline<=now,'만료된 메인 페이즈가 없습니다.');
      if(canPauseBattle(user.run.battle))return act(state,user,{type:'pauseBattle'},catalog,now,room);
      if(user.run.battle.pendingChoice){
        var pendingLamp=user.run.battle.pendingChoice;
        if(pendingLamp.lamp){pendingLamp.options=catalog.cardPool.map(function(id){return {cardId:id,upgraded:false};});pendingLamp.lampStage='results';}
        var options=user.run.battle.pendingChoice.options;
        result=select(state,user,catalog,user.run.turnToken,1+Math.floor(rng()*options.length),now,rng);
      }else result=submit(state,user,catalog,user.run.turnToken,[],now,rng,false);
      if(user.session)user.session.until=now+catalog.config.sessionTimeoutMs;
      syncDeadline(user,now);return result;
    }
    if (action.type === 'choose' || action.type === 'submit' || action.type === 'forfeit') {
      A4.assert(user.run,'진행 중인 탐험이 없습니다.');
      if (action.type !== 'forfeit') A4.assert(user.session && now < user.session.until,'⚔️ 세션 종료: +탐험으로 기존 탐험을 이어갑니다.');
      if (action.type === 'choose') result = select(state,user,catalog,action.token,action.index,now,rng);
      if (action.type === 'submit') result = submit(state,user,catalog,action.token,action.indices,now,rng,action.heroPower);
      if (action.type === 'forfeit') return {kind:'finished',record:finish(state,user,'forfeit',now,rng,catalog)};
      if (user.session) { user.session.room = room; user.session.until = now+catalog.config.sessionTimeoutMs; }
      syncDeadline(user,now);
      return result;
    }
    A4.Economy.refreshKeys(user,now);
    if (action.type === 'stats') return {kind:'stats',stats:A4.copy(state.stats||A4.Stats.empty())};
    if (action.type === 'encyclopedia') return {kind:'encyclopedia',query:action.query||''};
    if (action.type === 'inventory' || action.type === 'relics' || action.type === 'shop' || action.type === 'deck' || action.type === 'help' || action.type === 'rules') return {kind:action.type};
    if (action.type === 'equip') { equip(user,action.uid,action.slot,catalog); return {kind:'relics'}; }
    if (action.type === 'unequip') {
      A4.assert(!user.run,'진행 중인 탐험이 있으면 유물 장착을 변경할 수 없습니다.');
      A4.assert(A4.integer(action.slot,1) && action.slot <= user.slotCount,'잘못된 슬롯입니다.');
      user.equipped[action.slot-1] = null; return {kind:'relics'};
    }
    if (action.type === 'expand') {
      slot = user.slotCount+1; A4.assert(slot <= 3,'유물 슬롯은 최대 3개입니다.');
      A4.Economy.spend(user,catalog.slotCosts[slot]); user.slotCount = slot; return {kind:'relics'};
    }
    if (action.type === 'enhance') {
      result = A4.Economy.enhance(user,action.uid,catalog,rng);
      if (user.run && user.run.battle) {
        A4.Combat.syncPassives(user.run.battle,combinedPassives(user,catalog));
        if (!user.run.battle.resolution && user.run.battle.player.hp <= 0) return {kind:'finished',record:finish(state,user,'defeat',now,rng,catalog)};
      }
      return {kind:'enhancement',result:result};
    }
    if (action.type === 'pull') return {kind:'pull',relic:A4.Economy.pull(state,user,action.id,catalog,rng)};
    A4.fail('알 수 없는 행동입니다.');
  }
  function canPauseBattle(b){return !!b&&!b.mainTimeoutMs&&!['player','enemy'].some(function(side){var power=b[side].heroPower;return power&&power.id==='white_night';});}
  function syncDeadline(user,now){
    var b=user.run&&user.run.battle;
    if(!b||!user.run||user.run.phase!=='BATTLE')return;
    if(b.rulesVersion!==3){b.mainDeadline=null;return;}
    if(b.mainTimeoutMs===15000)b.mainTimeoutMs=20000;
    if(b.pendingChoice&&b.pendingChoice.lamp){
      if(!b.pendingChoice.lampDeadline)b.pendingChoice.lampDeadline=now+120000;
      b.mainDeadline=b.pendingChoice.lampDeadline;b.deadlineSerial='lamp:'+user.run.turnToken;b.deadlineLimit=120000;
      if(user.session)user.session.until=b.mainDeadline;return;
    }
    var limit=b.pendingChoice?150000:(b.mainTimeoutMs||150000);
    var serial=b.pendingChoice?'choice:'+user.run.turnToken:b.phaseSerial;
    if(user.session)user.session.until=now+150000;
    if((b.pendingChoice||!b.resolution)&&b.outcome==='ongoing'){
      if(!b.mainDeadline||b.deadlineSerial!==serial||b.deadlineLimit!==limit){b.mainDeadline=now+limit;b.deadlineSerial=serial;b.deadlineLimit=limit;}
      if(user.session)user.session.until=b.mainDeadline;
    }else b.mainDeadline=null;
  }
  return {restartEncounter:restartEncounter,newUser:newUser,act:act,passives:combinedPassives,syncDeadline:syncDeadline,canPauseBattle:canPauseBattle};
}());
