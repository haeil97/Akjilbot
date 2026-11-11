A4.Economy = (function () {
  var INTERVAL = 30 * 60 * 1000;
  var GOLD = [[50,50],[50,100],[100,200],[200,400],[200,400],[400,600],[500,800],[600,1000],[1000,1500]];
  function refreshKeys(user, now) {
    var count;
    if (user.run) return; /* Recharge starts when the active expedition ends. */
    if (now < user.keyUpdatedAt) return; /* clock rollback never grants duplicate intervals */
    if (user.items.keys >= 5) { user.keyUpdatedAt = now; return; }
    count = Math.floor((now - user.keyUpdatedAt) / INTERVAL);
    if (count <= 0) return;
    user.items.keys = Math.min(5, user.items.keys + count);
    user.keyUpdatedAt = user.items.keys >= 5 ? now : user.keyUpdatedAt + count * INTERVAL;
  }
  function grant(user, reward, now) {
    refreshKeys(user, now);
    user.gold += reward.gold || 0;
    user.items.keys += reward.keys || 0;
    user.items.stones += reward.stones || 0;
    user.items.essence += reward.essence || 0;
    if (user.items.keys >= 5) user.keyUpdatedAt = Math.max(now, user.keyUpdatedAt);
  }
  function reward(wins, rng) {
    A4.assert(A4.integer(wins, 0) && wins <= 8, '잘못된 처치 수입니다.');
    var bounds = GOLD[wins], out = {gold: bounds[0] + 50 * Math.floor(rng() * ((bounds[1] - bounds[0]) / 50 + 1)), keys:0,stones:0,essence:0};
    if (wins === 4) out.keys = rng() < 0.2 ? 1 : 0;
    if (wins === 5) { out.keys = rng() < 0.8 ? 1 : 0; out.stones = rng() < 0.8 ? 0 : 1; }
    if (wins === 6) { out.keys = 1; out.stones = rng() < 0.8 ? 1 : 2; }
    if (wins === 7) { out.keys = 1; out.stones = rng() < 0.6 ? 2 : 3; out.essence = rng() < 0.5 ? 0 : 1; }
    if (wins === 8) { out.keys = 1; out.stones = A4.weighted([{value:3,weight:60},{value:4,weight:30},{value:5,weight:10}],rng); out.essence = A4.weighted([{value:1,weight:70},{value:2,weight:20},{value:3,weight:10}],rng); }
    return out;
  }
  function spend(user, cost) {
    A4.assert(cost && A4.integer(cost.gold, 0) && A4.integer(cost.stones, 0), '비용이 아직 설정되지 않았습니다.');
    A4.assert(user.gold >= cost.gold && user.items.stones >= cost.stones, '코인 또는 강화석이 부족합니다.');
    user.gold -= cost.gold; user.items.stones -= cost.stones;
  }
  function findRelic(user, uid) {
    for (var i = 0; i < user.relics.length; i++) if (user.relics[i].uid === uid) return user.relics[i];
    A4.fail('해당 유물이 없습니다.');
  }
  function passives(user, catalog) {
    var out = [], i, owned, def;
    for (i = 0; i < user.equipped.length; i++) {
      if (!user.equipped[i]) continue;
      owned = findRelic(user, user.equipped[i]); def = catalog.relics[owned.relicId];
      A4.assert(def && def.levels && def.levels[owned.level] && Array.isArray(def.levels[owned.level].effects), '유물 효과 설정이 비어 있습니다: ' + owned.relicId);
      out = out.concat(A4.copy(def.levels[owned.level].effects));
    }
    return out;
  }
  function enhance(user, uid, catalog, rng) {
    var owned = findRelic(user,uid), def = catalog.relics[owned.relicId], rule, equipped, outcome;
    A4.assert(def, '유물 정의가 없습니다.');
    A4.assert(owned.level < 5, '최대 강화는 +5입니다.');
    rule = catalog.enhancement[def.grade] && catalog.enhancement[def.grade][owned.level];
    A4.assert(rule, '이 등급/단계의 강화 비용·확률이 아직 정해지지 않았습니다.');
    A4.assert(['C','B','A','S','SS'].indexOf(def.grade) >= 0, '잘못된 유물 등급입니다.');
    A4.assert((def.grade === 'S' || def.grade === 'SS') || rule.destroy === 0, 'C/B/A 등급 유물은 파괴될 수 없습니다.');
    equipped = user.equipped.indexOf(uid) >= 0;
    if (equipped && user.run && rule.destroy > 0) A4.assert(catalog.config.equippedDestruction === 'unequip', '탐험 중 장착 유물 파괴 시 처리 규칙이 미정입니다.');
    A4.assert(def.levels && def.levels[Math.min(5,owned.level+1)] && def.levels[Math.max(0,owned.level-1)], '강화 전후 유물 효과가 아직 정해지지 않았습니다.');
    outcome = A4.weighted([{value:'success',weight:rule.success},{value:'fail',weight:rule.fail},{value:'down',weight:rule.down},{value:'destroy',weight:rule.destroy}],rng);
    spend(user,rule);
    if (outcome === 'success') owned.level++;
    if (outcome === 'down') owned.level = Math.max(0,owned.level-1);
    if (outcome === 'destroy') {
      user.relics = user.relics.filter(function (r) { return r.uid !== uid; });
      user.equipped = user.equipped.map(function (id) { return id === uid ? null : id; });
    }
    return {outcome:outcome,uid:uid,level:outcome === 'destroy' ? null : owned.level};
  }
  function pull(state, user, id, catalog, rng) {
    var def = catalog.pulls[id], grade, pool = [], key, relic;
    A4.assert(def && A4.integer(def.gold,0) && Array.isArray(def.grades), '뽑기 비용·확률이 아직 정해지지 않았습니다.');
    A4.assert(user.gold >= def.gold,'코인이 부족합니다.');
    def.grades.forEach(function (g) {
      A4.assert(['C','B','A','S','SS'].indexOf(g.value) >= 0, '뽑기 등급 오류');
      if (g.weight > 0) A4.assert(Object.keys(catalog.relics).some(function (rid) { return catalog.relics[rid].grade === g.value; }), '뽑기 대상 유물이 비어 있습니다: '+g.value);
    });
    grade = A4.weighted(def.grades,rng);
    for (key in catalog.relics) if (A4.has(catalog.relics,key) && catalog.relics[key].grade === grade) pool.push(key);
    relic = {uid:A4.id(state,'relic-'),relicId:A4.pick(pool,rng),level:0};
    user.gold -= def.gold; user.relics.push(relic); return relic;
  }
  return {refreshKeys:refreshKeys,grant:grant,reward:reward,spend:spend,findRelic:findRelic,passives:passives,enhance:enhance,pull:pull,keyInterval:INTERVAL};
}());
