'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const A=require('../../악질봇4.0.0.js'),catalog=A.catalog,content=A.content;
const originalPlan=A.AI.plan;
let metrics;
A.AI.plan=function(b,c,rng,observed){
  const started=performance.now(),result=originalPlan(b,c,rng,observed),elapsed=performance.now()-started;
  if(metrics){
    metrics.decisions++;metrics.simulations+=result.stats.simulations;metrics.truncated+=result.stats.truncated;
    metrics.elapsed+=elapsed;metrics.maxMs=Math.max(metrics.maxMs,elapsed);
    assert.ok(result.stats.simulations<=A.AI.limits.simulations,'every real search obeys its simulation budget');
    for(const error of result.stats.errors||[])metrics.errors.push(b.enemy.name+' / turn '+b.turn+' '+b.phase+': '+error);
  }
  return result;
};
function assertZones(b){
  const seen=new Set();
  for(const side of ['player','enemy']){
    const f=b[side];assert.ok(f.hand.length<=A.Battle.handLimit(b,side,catalog),side+' overflow');
    for(const zone of ['hand','deck','rest','excluded','inFlight'])for(const card of f[zone]){
      assert.ok(!seen.has(card.uid),'duplicate physical card '+card.uid);seen.add(card.uid);assert.ok(catalog.cards[card.cardId]);
    }
  }
}
function settle(b,rng){
  let choices=0;
  while(b.pendingChoice){assert.ok(++choices<150,'discovery chain must terminate');A.Battle.choose(b,0,catalog,rng);}
  assertZones(b);
}
function playerPlan(b,rng){
  const mirror=A.copy(b);mirror.player=A.copy(b.enemy);mirror.enemy=A.copy(b.player);
  mirror.history=mirror.history.map(h=>({turn:h.turn,phase:h.phase,player:h.enemy,enemy:h.player}));
  return A.Battle.plan(mirror,catalog,rng);
}
for(const seed of [27,443,9127])test('all twenty-six opponent battles resolve after repeated saved-state reloads, seed '+seed,t=>{
  metrics={decisions:0,simulations:0,truncated:0,elapsed:0,maxMs:0,errors:[]};
  for(const [enemyIndex,enemy] of content.opponentDecks.enemies.entries()){
    const stage=enemy.stages[enemy.stages.length-1],state=A.newState(seed),rng=A.random(state),hero=catalog.heroes.filter(h=>h.enabled!==false)[(enemyIndex+seed)%4];
    const deck=hero.cards.map(id=>({uid:A.id(state,'run-card-'),cardId:id,upgraded:false}));
    for(let n=0;n<(stage-1)*2;n++)deck.push({uid:A.id(state,'run-card-'),cardId:A.pick(hero.classPool,rng),upgraded:n%5===0});
    const run={wins:stage-1,hero:A.copy(hero),deck,treasures:{}};
    const prepared=A.Opponents.prepare(state,run,catalog,enemy.id);
    let b=A.Battle.create({name:'자동 진행 플레이어',heroName:hero.name,heroId:hero.id,startingTreasureId:hero.startingTreasureId,heroPower:A.copy(hero.power),maxHp:catalog.config.playerMaxHpByStage[stage-1],deck:A.copy(deck),passives:[]},
      {name:prepared.name,bossId:prepared.enemyId,startingTreasureId:prepared.startingTreasureId,heroPower:A.BossRules.power(prepared.enemyId),maxHp:prepared.maxHp,deck:A.copy(prepared.deck),passives:prepared.treasurePassives,treasureIds:prepared.treasures.map(x=>x.treasureId)},catalog,rng);
    settle(b,rng);
    let phases=0;
    try{
      while(b.outcome==='ongoing'&&phases++<240){
        const plan=playerPlan(b,rng);
        A.Battle.submit(b,Array.from(plan.uids),catalog,rng,{heroPower:plan.heroPower});settle(b,rng);
        b=JSON.parse(JSON.stringify(b));assertZones(b);
      }
    }catch(error){error.message=enemy.name+' / seed '+seed+' / turn '+b.turn+' '+b.phase+': '+error.message;throw error;}
    assert.ok(b.outcome==='victory'||b.outcome==='defeat',enemy.name+' exceeded 240 phases');
    assert.ok(!b.pendingChoice,enemy.name+' finished with pending choice');
  }
  t.diagnostic('AI '+metrics.decisions+' decisions / '+metrics.simulations+' simulations / '+metrics.truncated+' budget truncations; mean '+(metrics.elapsed/metrics.decisions).toFixed(1)+'ms / max '+metrics.maxMs.toFixed(1)+'ms');
  assert.equal(metrics.errors.length,0,'simulation errors:\n'+metrics.errors.slice(0,12).join('\n'));
});
