/* Opponent content and deterministic deck preparation, not boss effect handlers.
 * Call prepare only inside the state transaction. A saved enemySpec is reused;
 * rendering/resuming a battle must never build a new deck or draw new randomness.
 * Specifications deliberately have no empty executable effects arrays.
 */
A4.Opponents = (function () {
  var content = A4.content, roster = content.opponentDecks.enemies;
  var abilities = content.opponentAbilities, byId = {}, byName = {}, references = {};
  var encounters = [[],[],[],[],[],[],[],[]];
  content.generalCards.concat(content.tokens,abilities.exclusiveCards).forEach(function (card) {
    byName[card.name] = card; references[card.id] = card;
  });
  roster.forEach(function (enemy) {
    A4.assert(abilities.abilities[enemy.id],'상대와 영웅 능력의 식별자가 다릅니다: '+enemy.id);
    byId[enemy.id] = enemy;
    enemy.stages.forEach(function (stage) { encounters[stage-1].push(enemy.id); });
  });
  function enabledEncounter(id) { return byId[id].encounterEnabled !== false; }
  function poolFor(enemy) {
    return content.generalCards.filter(function (card) {
      return !enemy.randomPoolElements || enemy.randomPoolElements.indexOf(card.element) >= 0;
    });
  }
  function entryReference(entry) { return entry.cardId ? references[entry.cardId] : byName[entry.name]; }
  function validateDesign() {
    var errors = [], ids = {}, names = {};
    function check(ok, message) { if (!ok) errors.push(message); }
    check(roster.length === 26,'상대 26종이 필요합니다.');
    check(content.generalCards.length >= 100,'일반 카드 원문이 부족합니다.');
    check(abilities.exclusiveCards.length === 21,'전용 카드 21종이 필요합니다.');
    check(abilities.doctorQuotes.length === 12,'세례 대사 12개가 필요합니다.');
    abilities.exclusiveCards.forEach(function (card) {
      check(card.exclusive === true && (card.id==='crystal_ball'||(card.upgradeable === false && !card.upgrade)),'전용 카드 강화 불가: '+card.name);
    });
    roster.forEach(function (enemy) {
      var count = 0, copies = {}, entries = {};
      check(!ids[enemy.id] && !names[enemy.name],'상대 식별자·이름 중복: '+enemy.name);
      ids[enemy.id] = true; names[enemy.name] = true;
      check(!!abilities.abilities[enemy.id],'영웅 능력 명세 누락: '+enemy.name);
      check(['fixed','random','mirror'].indexOf(enemy.deckMode) >= 0,'덱 생성 방식: '+enemy.name);
      check(enemy.stages.length > 0 && enemy.stages.every(function (stage) { return A4.integer(stage,1) && stage <= 8; }),'등장 단계: '+enemy.name);
      (enemy.cards || []).forEach(function (entry) {
        var definition=entryReference(entry),key=definition?definition.id:(entry.cardId||entry.name);
        check(!!definition&&definition.name===entry.name,'정의되지 않은 카드: '+enemy.name+' / '+entry.name);
        check(A4.integer(entry.count,1),'카드 장수: '+enemy.name+' / '+entry.name);
        var rankKey=key+(entry.upgraded?'+':'');
        check(!entries[rankKey],'카드 항목 중복: '+enemy.name+' / '+entry.name);entries[rankKey]=true;
        check(!entry.upgraded||!!(definition&&definition.upgrade),'강화 정의가 없는 카드: '+enemy.name+' / '+entry.name);
        copies[key] = (copies[key]||0)+entry.count; count += entry.count;
        var limit = enemy.duplicateLimits && enemy.duplicateLimits[entry.name] || 2;
        check(copies[key] <= limit,'동명 카드 상한: '+enemy.name+' / '+entry.name);
        check(!definition || !definition.token,'기본 덱에 토큰: '+enemy.name+' / '+entry.name);
      });
      if (enemy.deckMode === 'random') {
        check(A4.integer(enemy.randomCount,1),'무작위 카드 장수: '+enemy.name);
        check(poolFor(enemy).length * 2 >= enemy.randomCount,'무작위 풀 부족: '+enemy.name);
        count += enemy.randomCount;
      }
      if (enemy.deckMode !== 'mirror') check(A4.integer(enemy.deckSize,4) && count === enemy.deckSize,'덱 총 장수: '+enemy.name+' ('+count+'/'+enemy.deckSize+')');
      else check(count === 0 && enemy.deckSize === null,'미러는 고정 덱을 가지지 않습니다.');
    });
    encounters.forEach(function (list, index) { check(list.length === [2,9,9,7,7,4,4,4][index],(index+1)+'전투 후보 수'); });
    return errors;
  }
  function addInstance(state, target, entry) {
    var definition = typeof entry==='string'?byName[entry]:entryReference(entry);
    A4.assert(definition,'상대 카드 명세가 없습니다: '+(entry.name||entry));
    target.push({uid:A4.id(state,'enemy-card-'),cardId:definition.id,upgraded:!!entry.upgraded});
  }
  function prepare(state, run, catalog, forcedEnemyId) {
    var stage = run.wins+1, rng, id, enemy, plan, bag = [], errors;
    A4.assert(A4.integer(stage,1) && stage <= 8,'상대 생성 단계가 올바르지 않습니다.');
    if (run.enemySpec && run.enemySpec.stage === stage) {
      A4.assert(!forcedEnemyId || run.enemySpec.enemyId === forcedEnemyId,'이미 확정된 상대를 다시 추첨할 수 없습니다.');
      return run.enemySpec;
    }
    errors = validateDesign(); A4.assert(!errors.length,errors.join(', '));
    var seenIds={},seenNames={};
    (run.encounterResults||[]).forEach(function(result){
      if(result.enemyId)seenIds[result.enemyId]=true;
      if(result.name)seenNames[result.name]=true;
    });
    // Older saves may retain only the most recent opponent ID.
    if(run.wins>0&&run.enemyId)seenIds[run.enemyId]=true;
    var candidates=encounters[stage-1].filter(function(candidate){return (enabledEncounter(candidate)||candidate===forcedEnemyId)&&!seenIds[candidate]&&!seenNames[byId[candidate].name];});
    if (forcedEnemyId) {
      A4.assert(encounters[stage-1].indexOf(forcedEnemyId) >= 0,'해당 전투의 후보가 아닙니다.');
      A4.assert(candidates.indexOf(forcedEnemyId)>=0,'이번 탐험에서 이미 만난 상대입니다.');
    }
    A4.assert(candidates.length>0,'이번 탐험에서 아직 만나지 않은 상대 후보가 없습니다.');
    rng = A4.random(state); id = forcedEnemyId || A4.pick(candidates,rng); enemy = byId[id];
    plan = {version:1,contentRevision:content.revision,battleReady:false,enemyId:id,name:enemy.name,
      stage:stage,maxHp:content.stageHp[stage-1],deckMode:enemy.deckMode,deck:[],
      heroPowerSpec:A4.copy(abilities.abilities[id]),treasures:[],treasurePassives:[],playerOpeningAdditions:[]};
    if (enemy.deckMode === 'mirror') {
      A4.assert(Array.isArray(run.deck) && run.deck.length > 0,'복제할 탐험 덱이 없습니다.');
      if(run.hero&&run.hero.startingTreasureId)plan.startingTreasureId=run.hero.startingTreasureId;
      plan.deck = run.deck.map(function (card) {
        var cloned = A4.copy(card); cloned.uid = A4.id(state,'enemy-card-'); return cloned;
      });
      Object.keys(run.treasures || {}).forEach(function (slot) {
        var treasureId = run.treasures[slot], def = catalog.treasures[treasureId];
        A4.assert(def,'복제할 보물 정의가 없습니다: '+treasureId);
        plan.treasures.push({sourceSlot:slot,treasureId:treasureId,definition:A4.copy(def)});
        if (def.kind === 'passive') plan.treasurePassives = plan.treasurePassives.concat(A4.copy(def.effects));
      });
      // Card treasures are already in run.deck; do not append them again.
      // Relics, hero powers and other run.effects are outside the mirror scope.
    } else {
      enemy.cards.forEach(function (entry) {
        for (var n = 0; n < entry.count; n++) addInstance(state,plan.deck,entry);
      });
      if (enemy.deckMode === 'random') {
        poolFor(enemy).forEach(function (card) { bag.push(card.name,card.name); });
        A4.sample(bag,enemy.randomCount,rng).forEach(function (name) { addInstance(state,plan.deck,name); });
      }
      A4.assert(plan.deck.length === enemy.deckSize,'생성한 상대 덱 장수가 다릅니다.');
    }
    if (id === 'extreme_troll') {
      for (var i = 0; i < 3; i++) plan.playerOpeningAdditions.push({uid:A4.id(state,'battle-card-'),cardId:'deactivation',upgraded:false});
    }
    // Save the chosen identity, complete random deck, copies and ability together.
    run.enemySpec = plan;
    return plan;
  }
  function rejectBlueprint(enemy) {
    A4.assert(enemy && !enemy.blueprint,'상대 덱·능력은 설계 데이터입니다. 카드 효과와 보스 전투 처리를 먼저 구현해야 합니다.');
  }
  // Register the requested roster without pretending unsupported effects run.
  A4.catalog.config.enemyMaxHpByStage = content.stageHp.slice();
  A4.catalog.encounters = encounters.map(function(list){return list.filter(enabledEncounter);});
  roster.forEach(function (enemy) {
    A4.catalog.enemies[enemy.id] = {id:enemy.id,name:enemy.name,blueprint:true,
      implementationStatus:'pending',deckMode:enemy.deckMode,deckSize:enemy.deckSize,
      encounterEnabled:enemy.encounterEnabled!==false,stages:enemy.stages.slice(),heroPowerSpec:A4.copy(abilities.abilities[enemy.id])};
  });
  return {validateDesign:validateDesign,prepare:prepare,rejectBlueprint:rejectBlueprint,
    get:function (id) { return byId[id] ? A4.copy(byId[id]) : null; },
    reference:function (name) { return byName[name] ? A4.copy(byName[name]) : null; },
    referenceById:function (id) { return references[id] ? A4.copy(references[id]) : null; },
    stage:function (number) {
      A4.assert(A4.integer(number,1) && number <= 8,'전투 번호는 1~8입니다.');
      return {stage:number,maxHp:content.stageHp[number-1],candidates:encounters[number-1].filter(enabledEncounter)};
    }};
}());
