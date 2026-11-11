'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const A=require('../../악질봇4.0.0.js');
let uid=0;
const card=id=>({uid:'interaction-'+(++uid),cardId:id,upgraded:false});
function setup(){
  const c=A.copy(A.catalog);
  c.cards.blank={name:'시험용 빈 카드',element:'NEUTRAL',cost:0,effects:[]};
  const p={name:'P',maxHp:100,deck:Array.from({length:5},()=>card('blank'))};
  const e={name:'E',maxHp:100,deck:Array.from({length:5},()=>card('blank'))};
  const b=A.Battle.create(p,e,c,()=>0.4);b.player.mana=b.enemy.mana=5;b.player.maxMana=b.enemy.maxMana=5;b.enemyPowerPlan=false;
  return {b,c};
}
function submit(b,c,p,e){b.player.hand=[card(p)];b.enemy.hand=[card(e)];b.enemyPlan=[b.enemy.hand[0].uid];return A.Battle.submit(b,[b.player.hand[0].uid],c,()=>0.4);}
test('special card counters resolve symmetrically across cards, treasures and bosses',()=>{
  for(const pair of [['general:자연화','prophecy'],['treasure_starlight_disassembler','prophecy'],['general:자연화','treasure_starlight_disassembler']]){
    for(const ids of [pair,pair.slice().reverse()]){
      const {b,c}=setup();submit(b,c,...ids);
      assert.equal(b.history[0].player[0].countered,true,ids.join('/'));assert.equal(b.history[0].enemy[0].countered,true,ids.join('/'));
      assert.equal(b.player.hp,100);assert.equal(b.enemy.hp,100);
    }
  }
});
test('intrinsically countered prophecy cannot fire its ordinary all-card counter',()=>{
  const {b,c}=setup();submit(b,c,'prophecy','general:배교');
  assert.equal(b.history[0].player[0].countered,true);assert.equal(b.history[0].enemy[0].countered,false);assert.ok(b.player.hp<100);
});
test('committed Black Knight power can prevent an opposing special counter',()=>{
  const {b,c}=setup();b.enemy.heroPower=A.BossRules.power('black_knight');b.enemyPowerPlan=true;
  submit(b,c,'prophecy','general:화염구');
  assert.equal(b.history[0].player[0].countered,true);assert.equal(b.history[0].enemy[0].countered,false);assert.equal(b.player.hp,96);
});
test('rewind skips recursive auto-cast cards without losing a submitted opponent effect',()=>{
  const {b,c}=setup();b.player.rest=[card('general:되감기')];submit(b,c,'general:되감기','general:배교');
  assert.equal(b.phase,'MAIN2');assert.equal(b.outcome,'ongoing');assert.equal(b.enemy.hp,98);assert.equal(b.player.hp,97);
  assert.equal(b.player.rest.length,2);
  assert.doesNotMatch(A.BattleUI.summary(b,1,c),/재귀 호출/);
});
test('infinite rest-draw triggers are bounded and both independent submitted effects still resolve',()=>{
  const {b,c}=setup();b.player.deck=[card('blank')];b.player.rest=[];
  b.player.status.treasures.escapeTurn=0;b.player.status.treasures.escapeStacks=1;
  b.player.status.cards.effects.push({kind:'fuseDiscard',until:0});
  b.resolution={queue:[
    {kind:'event',side:'player',event:{type:'cardRest',side:'player',card:b.player.hand[0]}},
    {kind:'effect',side:'player',effect:{type:'damage',amount:7}},
    {kind:'effect',side:'enemy',effect:{type:'damage',amount:9}},
    {kind:'phase',op:'afterCombat'}
  ]};
  A.Battle.process(b,c,()=>0.4);
  assert.equal(b.phase,'MAIN2');assert.equal(b.enemy.hp,93);assert.equal(b.player.hp,91);assert.equal(b.resolution,null);
  assert.ok(b.lastLog.some(x=>/2,000/.test(x)));
});
test('magic mirror moves an unchosen opponent rest card instead of creating a copy',()=>{
  const {b,c}=setup();b.player.treasureIds=['magic_mirror_passive'];
  const a=card('general:화염구'),z=card('general:재생');b.enemy.rest=[a,z];
  b.resolution={queue:[{kind:'event',event:{type:'discovered',side:'player',choice:a,options:[a,z],sourceZone:'rest'}}]};A.Battle.process(b,c,()=>0.4);
  assert.ok(b.player.hand.some(x=>x.uid===z.uid));assert.deepEqual(b.enemy.rest.map(x=>x.uid),[a.uid]);
});
