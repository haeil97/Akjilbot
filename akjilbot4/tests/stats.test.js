const test=require('node:test');
const assert=require('node:assert/strict');
const A=require('../../악질봇4.0.0.js');
const copy=x=>JSON.parse(JSON.stringify(x));

test('card and treasure choice denominators deduplicate offers and aggregate attributes',()=>{
 const s=A.newState(1),c=A.catalog;
 A.Stats.choice(s,['general:화염구','general:화염구','general:불길'],'general:화염구',c);
 A.Stats.choice(s,['lucky_shovel','lucky_shovel','recycling_bin'],'lucky_shovel',c,true);
 assert.equal(s.stats.cards['general:화염구'].offered,1);assert.equal(s.stats.cards['general:화염구'].picked,1);
 assert.equal(s.stats.elements.FIRE.offered,2);assert.equal(s.stats.elements.FIRE.picked,1);
 assert.equal(s.stats.treasures.lucky_shovel.offered,1);assert.equal(s.stats.treasures.lucky_shovel.picked,1);
 assert.equal(s.stats.treasures.recycling_bin.offered,1);assert.equal(s.stats.treasures.recycling_bin.picked,0);
 assert.equal(s.stats.cards['general:화염구'].runs,0);
});

test('final averages include only the ending deck and treasures, merging ranks and ignoring former holdings',()=>{
 const s=A.newState(1),c=A.catalog;
 A.Stats.choice(s,['general:화염구'],'general:화염구',c);
 A.Stats.choice(s,['lucky_shovel'],'lucky_shovel',c,true);
 const run={wins:5,statsSeen:{cards:{'general:화염구':true},treasures:{lucky_shovel:true}},
  deck:[{cardId:'general:불길'},{cardId:'general:불길',upgraded:true},{cardId:'general:저주'},{cardId:'treasure_mystic_coin'}],treasures:{low:'mystic_coin',extra:'mystic_coin'}};
 A.Stats.finish(s,run,c);A.Stats.finish(s,run,c);
 assert.equal(s.stats.cards['general:화염구'].runs,0);assert.equal(s.stats.cards['general:화염구'].picked,1);
 assert.equal(s.stats.treasures.lucky_shovel.runs,0);assert.equal(s.stats.treasures.lucky_shovel.picked,1);
 assert.equal(s.stats.cards['general:불길'].runs,1);assert.equal(s.stats.cards['general:불길'].totalWins,5);
 assert.equal(s.stats.elements.FIRE.runs,1);assert.equal(s.stats.elements.FIRE.totalWins,5);
 assert.equal(s.stats.cards['general:저주'],undefined);assert.equal(s.stats.cards.treasure_mystic_coin,undefined);
 assert.equal(s.stats.treasures.mystic_coin.runs,1);assert.equal(s.stats.treasures.mystic_coin.totalWins,5);
 A.Stats.finish(s,{wins:1,deck:[{cardId:'general:불길'}],treasures:{low:'mystic_coin'}},c);
 const output=A.Stats.render(s.stats,c);assert.match(output,/불길: 선택률 0.0% \(0\/0\) \| 평균 승수 3.00승 \(2회\)/);
 assert.match(output,/신비한 동전: 선택률 0.0% \(0\/0\) \| 평균 승수 3.00승 \(2회\)/);
 assert.equal((output.match(/\u200b/g)||[]).length,1000);
 const removed={wins:8,deck:[],treasures:{},statsSeen:run.statsSeen};A.Stats.finish(s,removed,c);
 assert.equal(s.stats.elements.FIRE.runs,2);assert.equal(s.stats.cards['general:화염구'].runs,0);assert.equal(s.stats.treasures.lucky_shovel.runs,0);
});

test('opponent results count one per stage and ignore preview or reward abandonment',()=>{
 const s=A.newState(1),r={wins:0,phase:'ENCOUNTER',enemyId:'teemo',battle:null};
 A.Stats.battle(s,r,false);assert.equal(s.stats,undefined);
 r.phase='BATTLE';r.battle={enemy:{bossId:'teemo'}};A.Stats.battle(s,r,true);A.Stats.battle(s,r,true);A.Stats.battle(s,r,false);
 assert.equal(s.stats.bots.teemo.win,1);assert.equal(s.stats.bots.teemo.loss,0);
 r.wins=1;r.phase='REWARD';A.Stats.battle(s,r,false);assert.equal(s.stats.bots.teemo.loss,0);
 r.phase='BATTLE';r.enemyId='boo';A.Stats.battle(s,r,false);
 assert.equal(s.stats.bots.boo.loss,1);assert.match(A.Stats.render(s.stats,A.catalog),/티모: 1승 0패 \| 격파율 100.0%/);
 const resumed=copy(s);A.validateState(resumed);assert.deepEqual(resumed.stats,s.stats);
 resumed.stats.cards.bad={offered:0,picked:0,runs:1,totalWins:9,win:0,loss:0};assert.throws(()=>A.validateState(resumed),/통계 집계 범위/);
});
