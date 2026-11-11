/* Structural invariants prevent damaged mappings from being treated as new users. */
A4.validateState = function (state) {
  function ok(value,message) { A4.assert(value,'저장 데이터 검증 실패: '+message); }
  function object(value) { return value && typeof value === 'object' && !Array.isArray(value); }
  ok(object(state) && state.schemaVersion === 4,'지원하지 않는 버전');
  ok(A4.integer(state.sequence,0) && state.sequence < 9007199254740991,'식별자 순번');
  ok(A4.integer(state.rngState,1) && state.rngState <= 4294967295,'난수 상태');
  ok(object(state.users) && object(state.identities) && object(state.linkCodes),'계정 영역');
  if(state.stats!==undefined){
    ok(object(state.stats)&&state.stats.version===1,'통계 버전');
    ['cards','elements','treasures','bots'].forEach(function(kind){
      ok(object(state.stats[kind]),'통계 영역 '+kind);
      Object.keys(state.stats[kind]).forEach(function(id){var r=state.stats[kind][id];
        ok(object(r),'통계 기록');
        ['offered','picked','runs','totalWins','win','loss'].forEach(function(field){ok(A4.integer(r[field],0),'통계 수치 '+field);});
        ok(r.picked<=r.offered&&r.totalWins<=r.runs*8,'통계 집계 범위');
      });
    });
  }
  if(state.pendingLinks!==undefined){
    ok(object(state.pendingLinks),'연동 확인 영역');
    Object.keys(state.pendingLinks).forEach(function(k){var p=state.pendingLinks[k];ok(p&&state.users[p.owner]&&state.users[p.previousUser]&&typeof p.room==='string'&&typeof p.issuance==='string'&&/^\d{4}$/.test(p.code)&&A4.integer(p.expiresAt,0),'연동 확인 요청');});
  }
  if(state.adminHistory!==undefined){
    ok(Array.isArray(state.adminHistory)&&state.adminHistory.length<=256,'관리자 변경 기록');
    state.adminHistory.forEach(function(e){ok(e&&typeof e.id==='string'&&state.users[e.actorId]&&state.users[e.targetId]&&typeof e.command==='string'&&A4.integer(e.at,0),'관리자 변경 기록 형식');});
  }
  Object.keys(state.identities).forEach(function (key) { ok(typeof state.identities[key] === 'string' && A4.has(state.users,state.identities[key]),'계정 매핑 대상 누락'); });
  Object.keys(state.users).forEach(function (id) {
    var u=state.users[id], seen={}, r;
    ok(object(u) && u.id === id && typeof u.name === 'string','사용자 정보');
    if(u.aiPublicHistory!==undefined){
      ok(Array.isArray(u.aiPublicHistory)&&u.aiPublicHistory.length<=48,'AI 공개 제출 기록');
      u.aiPublicHistory.forEach(function(h){ok(h&&['MAIN1','MAIN2'].indexOf(h.phase)>=0&&Array.isArray(h.player),'AI 공개 페이즈 기록');
        h.player.forEach(function(card){ok(card&&typeof card.cardId==='string'&&typeof card.element==='string'&&typeof card.upgraded==='boolean'&&typeof card.countered==='boolean','AI 공개 카드 기록');});
      });
    }
    if(u.isAdmin!==undefined)ok(typeof u.isAdmin==='boolean','관리자 권한');
    if(u.mergedInto!==undefined)ok(typeof u.mergedInto==='string'&&u.mergedInto!==id&&state.users[u.mergedInto]&&!u.session,'연동된 이전 계정');
    ok(A4.integer(u.gold,0) && object(u.items) && A4.integer(u.items.keys,0) && A4.integer(u.items.stones,0) && A4.integer(u.items.essence,0),'재화');
    ok(A4.integer(u.keyUpdatedAt,0),'열쇠 시간');
    ok(A4.integer(u.slotCount,1) && u.slotCount <= 3 && Array.isArray(u.relics) && Array.isArray(u.equipped) && u.equipped.length <= u.slotCount,'유물 슬롯');
    u.relics.forEach(function (item) { ok(item && typeof item.uid === 'string' && !seen[item.uid] && typeof item.relicId === 'string' && A4.integer(item.level,0) && item.level <= 5,'유물 개체'); seen[item.uid]=item; });
    var equippedTypes={};
    u.equipped.forEach(function (uid) { if (uid === null) return; ok(seen[uid] && !equippedTypes[seen[uid].relicId],'장착 대상 누락 또는 중복'); equippedTypes[seen[uid].relicId]=true; });
    ok(Array.isArray(u.receipts) && u.receipts.length <= 256,'명령 처리 기록');
    u.receipts.forEach(function (receipt) { ok(receipt && typeof receipt.id === 'string' && typeof receipt.text === 'string','명령 처리 기록 형식'); });
    if (u.session) ok(typeof u.session.room === 'string' && A4.integer(u.session.until,0),'세션 시간');
    if (!u.run) return;
    r=u.run;
    if(r.gold!==undefined)ok(A4.integer(r.gold,0),'탐험 골드');
    if(r.bloodstones!==undefined)ok(A4.integer(r.bloodstones,0)&&r.bloodstones<=5,'혈석');
    if(r.shrineId!==undefined)ok(typeof r.shrineId==='string','제단 선택');
    if(r.hp!==undefined)ok(A4.integer(r.hp,1),'탐험 현재 체력');
    ok(typeof r.id === 'string' && A4.integer(r.wins,0) && r.wins <= 8 && ['HERO','ENCOUNTER','BATTLE','REWARD','READY'].indexOf(r.phase) >= 0,'탐험 단계');
    if(r.phase!=='HERO') ok(r.hero && typeof r.hero.id==='string' && r.hero.power,'선택 영웅');
    ok(Array.isArray(r.deck) && Array.isArray(r.queue) && Array.isArray(r.effects) && object(r.treasures),'탐험 덱과 보상 큐');
    seen={};
    r.deck.forEach(function (card) { ok(card && typeof card.uid === 'string' && !seen[card.uid] && typeof card.cardId === 'string' && typeof card.upgraded === 'boolean','탐험 카드 개체'); seen[card.uid]=true; });
    if (r.phase === 'HERO' || r.phase === 'REWARD') ok(r.pending && typeof r.pending.id === 'string' && Array.isArray(r.pending.options) && r.pending.options.length > 0,'보상 선택지');
    if (r.phase === 'ENCOUNTER') ok(!r.battle&&!r.pending&&r.enemySpec&&r.enemySpec.stage===r.wins+1&&r.enemySpec.enemyId===r.enemyId&&typeof r.enemySpec.name==='string'&&A4.integer(r.enemySpec.maxHp,1)&&Array.isArray(r.enemySpec.deck),'전투 시작 대기');
    if (r.phase === 'BATTLE') {
      ok(r.battle && A4.integer(r.battle.turn,0) && r.battle.outcome === 'ongoing' && typeof r.turnToken === 'string','전투 상태');
      var v3=r.battle.rulesVersion===3;
      ok((v3||r.battle.rulesVersion===2) && (v3?['STANDBY','MAIN1','MAIN2','END']:['MAIN1','MAIN2']).indexOf(r.battle.phase)>=0,'전투 규칙 버전·페이즈');
      [r.battle.player,r.battle.enemy].forEach(function (f,sideIndex) {
        var cards={};if(f&&f.fatigueExtra!==undefined)ok(A4.integer(f.fatigueExtra,0),'추가 탈진 피해');if(f&&f.daggers!==undefined)ok(A4.integer(f.daggers,0)&&f.daggers<=5,'단검');
        ok(f && A4.integer(f.hp,r.battle.resolution?-9007199254740991:1) && A4.integer(f.maxHp,1) && f.hp <= f.maxHp && A4.integer(f.mana,0) && A4.integer(f.maxMana,v3?0:1) && f.mana <= 5 && f.maxMana <= 5,'전투 체력·마나');
        ok(A4.integer(f.heroPowerUsedTurn,-1) && A4.integer(f.playedThisTurn,0),'영웅 능력·카드 사용 기록');
        (v3?['deck','hand','rest','excluded','inFlight']:['deck','hand','rest','excluded']).forEach(function (zone) {
          ok(Array.isArray(f[zone]),'전투 카드 영역');
          f[zone].forEach(function (card) { ok(card && typeof card.uid === 'string' && !cards[card.uid] && typeof card.cardId === 'string','전투 카드 중복/누락'); cards[card.uid]=true; });
        });
        ok(!f.runes||Array.isArray(f.runes)&&f.runes.length<=1,'발동 중인 룬 수');
        (f.runes||[]).forEach(function(card){ok(card&&typeof card.uid==='string'&&!cards[card.uid]&&typeof card.cardId==='string','룬 카드 중복/누락');cards[card.uid]=true;});
        (f.shrines||[]).forEach(function(a){ok(typeof a.id==='string'&&A4.integer(a.maxHp,1)&&A4.integer(a.hp,0)&&a.hp<=a.maxHp,'제단 체력');if(a.hp===0)ok(A4.integer(a.reviveTurn,0),'제단 부활 예약');});
        ok(f.hand.length <= (v3?A4.Battle.handLimit(r.battle,sideIndex===0?'player':'enemy',A4.catalog):A4.HAND_LIMIT),'손패 한도');
      });
      ok(Array.isArray(r.battle.enemyPlan) && (r.battle.resolution||r.battle.enemyPlanTurn === r.battle.turn),'상대의 예약 행동');
      ok(r.battle.resolution||r.battle.enemyPlanPhase===r.battle.phase,'상대 행동 페이즈');
      if(r.battle.pendingChoice) ok(r.battle.resolution && Array.isArray(r.battle.pendingChoice.options) && (r.battle.pendingChoice.options.length>0||(r.battle.pendingChoice.lamp===true&&r.battle.pendingChoice.lampStage==='search')),'전투 도중 선택');
    }
  });
  return true;
};
