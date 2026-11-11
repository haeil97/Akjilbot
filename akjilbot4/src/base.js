/* Shared ES5 helpers. Production content is intentionally not invented. */
A4.VERSION = '4.0.0';
A4.HAND_LIMIT = 8;
A4.copy = function (v) { return JSON.parse(JSON.stringify(v)); };
A4.fail = function (message) { throw new Error(message); };
A4.assert = function (ok, message) { if (!ok) A4.fail(message); };
A4.has = function (obj, key) { return Object.prototype.hasOwnProperty.call(obj, key); };
A4.integer = function (n, min) { return typeof n === 'number' && isFinite(n) && Math.floor(n) === n && n >= min; };
A4.id = function (state, prefix) { state.sequence += 1; return prefix + state.sequence; };
A4.random = function (state) {
  return function () {
    var x = state.rngState | 0;
    x ^= x << 13; x ^= x >>> 17; x ^= x << 5;
    state.rngState = x >>> 0;
    return state.rngState / 4294967296;
  };
};
A4.pick = function (list, rng) { A4.assert(list.length > 0, '선택 가능한 콘텐츠가 없습니다.'); return list[Math.floor(rng() * list.length)]; };
A4.sample = function (list, count, rng) {
  var copy = list.slice(), out = [], i;
  while (copy.length && out.length < count) { i = Math.floor(rng() * copy.length); out.push(copy.splice(i, 1)[0]); }
  return out;
};
A4.weightedSample = function (list, count, rng, weightOf) {
  var pool=list.map(function(value){return {value:value,weight:weightOf(value)};}),out=[],total=0;
  pool.forEach(function(entry){A4.assert(typeof entry.weight==='number'&&isFinite(entry.weight)&&entry.weight>0,'추첨 가중치는 양수여야 합니다.');total+=entry.weight;});
  while(pool.length&&out.length<count){
    var roll=rng()*total,index=pool.length-1;
    for(var i=0;i<pool.length;i++){roll-=pool[i].weight;if(roll<0){index=i;break;}}
    var chosen=pool.splice(index,1)[0];out.push(chosen.value);total-=chosen.weight;
  }
  return out;
};
A4.weighted = function (entries, rng) {
  var total = 0, i, roll;
  for (i = 0; i < entries.length; i++) { A4.assert(typeof entries[i].weight === 'number' && entries[i].weight >= 0, '확률 설정이 올바르지 않습니다.'); total += entries[i].weight; }
  A4.assert(Math.abs(total - 100) < 0.000001, '확률 합계는 100이어야 합니다.');
  roll = rng() * total;
  for (i = 0; i < entries.length; i++) { roll -= entries[i].weight; if (roll < 0) return entries[i].value; }
  return entries[entries.length - 1].value;
};
A4.newState = function (seed) {
  return { schemaVersion: 4, sequence: 0, rngState: (seed >>> 0) || 2463534242, users: {}, identities: {}, linkCodes: {} };
};
