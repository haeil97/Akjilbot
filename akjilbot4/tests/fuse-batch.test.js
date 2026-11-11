const test=require('node:test');
const assert=require('node:assert/strict');
const A=require('../../악질봇4.0.0.js');
const copy=x=>JSON.parse(JSON.stringify(x));
function setup(upgraded=false){
  const c=copy(A.catalog);let serial=0;
  const card=name=>({uid:'fuse-test-'+(++serial),cardId:A.CardRules.nameToId(name),upgraded:false});
  const spec=name=>({name,maxHp:200,deck:Array.from({length:8},()=>card('천둥'))});
  const b=A.Battle.create(spec('나'),spec('상대'),c,()=>0.5);
  const fuse=card('마법공학: 퓨즈');fuse.upgraded=upgraded;
  b.enemy.hand=[fuse];b.enemyPlan=[];b.enemyPowerPlan=false;
  b.player.hand=[];b.player.deck=Array.from({length:20},()=>card('천둥'));b.player.rest=[];
  return {b,c,fuse,card};
}
function draw(b,c,n,reload=false){
  const tasks=[];A.Battle.context(b,c,()=>0.5,{side:'player'},tasks).draw('player',n);
  b.resolution={queue:tasks,phase:b.phase};
  if(reload)b=copy(b);
  A.Battle.process(b,c,()=>0.5);return b;
}
for(const n of [2,3,5])for(const prior of [0,1])for(const upgraded of [false,true]){
  test(`Fuse rank ${upgraded} handles ${n} cards with ${prior} prior draw and later separate draws`,()=>{
    let {b,c,fuse}=setup(upgraded);
    if(prior)b=draw(b,c,1);
    const expectedRest=b.player.deck.slice(prior?0:1,n).map(x=>x.uid);
    b=draw(b,c,n,true);
    assert.equal(b.player.hand.length,1);
    for(const uid of expectedRest)assert.ok(b.player.rest.some(x=>x.uid===uid));
    assert.ok(b.enemy.rest.some(x=>x.uid===fuse.uid));
    b=draw(b,c,1);
    assert.equal(b.player.hand.length,upgraded?1:2);
  });
}
test('Wonder Wand sends both drawn cards and the triggering Fuse to rest after standby draw',()=>{
  let {b,c,fuse}=setup();b=draw(b,c,1);
  const ids=b.player.deck.slice(0,2).map(x=>x.uid);
  b.player.hand.push({uid:'wand',cardId:'treasure_wonder_wand'});b.player.mana=5;
  A.Battle.submit(b,['wand'],c,()=>0.5);
  assert.equal(b.player.hand.length,1);
  for(const uid of ids.concat('wand'))assert.ok(b.player.rest.some(x=>x.uid===uid));
  assert.ok(b.enemy.rest.some(x=>x.uid===fuse.uid));
});
test('overflow cards remain excluded when Fuse disposes of the rest of a large draw',()=>{
  let {b,c,card}=setup();b=draw(b,c,1);
  b.player.hand.push(...Array.from({length:6},()=>card('파지직')));
  b=draw(b,c,5);
  assert.equal(b.player.hand.length,7);
  assert.equal(b.player.excluded.length,4);
  assert.equal(b.player.rest.length,1);
});

for(const upgraded of [false,true])test(`Fuse logs credit its owner and omit its own rest move (upgraded=${upgraded})`,()=>{
  let {b,c,fuse}=setup(upgraded);b=draw(b,c,1);
  b.player.name='원구(D-28X)';b.enemy.name='아우렐리온 솔';
  b.player.hand.push({uid:'wand',cardId:'treasure_wonder_wand'});b.player.mana=5;
  A.Battle.submit(b,['wand'],c,()=>0.5);
  const moves=b.report.logs.filter(x=>x.type==='move');
  assert.equal(moves.length,1);assert.equal(moves[0].amount,2);
  assert.equal(moves[0].side,'player');assert.equal(moves[0].source.side,'enemy');
  assert.equal(moves[0].source.label.name,'마법공학: 퓨즈'+(upgraded?'+':''));
  assert.ok(b.enemy.rest.some(x=>x.uid===fuse.uid));
  const text=A.BattleUI.summary(copy(b),7,c);
  assert.ok(text.includes('원구(D-28X)가 [🔥✨] 불가사의한 마법봉으로 카드를 2장 뽑았다.'),text);
  assert.ok(text.includes('아우렐리온 솔이 [⚡] 마법공학: 퓨즈'+(upgraded?'+':'')+'로 원구(D-28X)의 카드 2장을 레스트로 보냈다.'),text);
  assert.doesNotMatch(text,/마법봉로|마법봉으로 .*레스트로 보냈다/);
  if(upgraded){
    b=copy(b);b.report.logs=[];
    b=draw(b,c,1,true);
    const later=b.report.logs.filter(x=>x.type==='move');
    assert.equal(later.length,1);assert.equal(later[0].source.side,'enemy');
    assert.equal(later[0].source.label.name,'마법공학: 퓨즈+');
  }
});
test('player-owned Fuse logs credit the player when the enemy draws',()=>{
  let {b,c}=setup();[b.player,b.enemy]=[b.enemy,b.player];
  b.player.name='플레이어';b.enemy.name='아우렐리온 솔';
  const tasks=[];A.Battle.context(b,c,()=>0.5,{side:'enemy'},tasks).draw('enemy',3);
  b.resolution={queue:tasks,phase:b.phase};A.Battle.process(b,c,()=>0.5);
  const moves=b.report.logs.filter(x=>x.type==='move');
  assert.equal(moves.length,1);assert.equal(moves[0].amount,2);
  assert.equal(moves[0].source.side,'player');assert.equal(moves[0].side,'enemy');
});
