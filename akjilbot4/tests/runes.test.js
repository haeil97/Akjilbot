const test=require('node:test'),assert=require('node:assert/strict'),A=require('../../악질봇4.0.0.js');
function setup(){
 const c=A.copy(A.catalog);let serial=0;
 c.cards.blank={name:'빈 카드',element:'NEUTRAL',cost:0,effects:[]};
 c.cards.runeA={name:'첫 룬',element:'FIRE',cost:0,rune:true,effects:[],runeEffects:[{type:'damageBonus',amount:2}],runeTriggers:[{event:'standby',effects:[{type:'damage',amount:3}]}]};
 c.cards.runeB={name:'다른 룬',element:'LIGHTNING',cost:0,rune:true,effects:[],runeEffects:[{type:'damageBonus',amount:5}]};
 c.cards.ice={name:'냉기',element:'ICE',cost:0,effects:[]};
 const card=(id,extra={})=>Object.assign({uid:'rune-test-'+(++serial),cardId:id,upgraded:false},extra);
 const spec=name=>({name,maxHp:100,deck:Array.from({length:20},()=>card('blank'))});
 let b=A.Battle.create(spec('플레이어'),spec('상대'),c,()=>.3);b.enemyPlan=[];b.enemyPowerPlan=false;
 const job=t=>{b.resolution={queue:[t],phase:b.phase};A.Battle.process(b,c,()=>.3);};
 const ctx=()=>A.Battle.context(b,c,()=>.3,{side:'player'},[]);
 const play=(id,side='player')=>{const x=card(id);b[side].hand.push(x);if(side==='player'){b.enemyPlan=[];b.enemyPowerPlan=false;A.Battle.submit(b,[x.uid],c,()=>.3);}else job({kind:'cast',side,card:x,copy:false});return x;};
 return {c,get b(){return b;},card,ctx,job,play,reload(){b=JSON.parse(JSON.stringify(b));}};
}
test('a successful rune occupies the active zone instead of rest and its continuous effect survives phase changes and reload',()=>{
 const f=setup(),x=f.play('runeA');assert.equal(f.b.player.runes[0].uid,x.uid);assert.ok(!f.b.player.rest.some(a=>a.uid===x.uid));assert.ok(!f.b.player.inFlight.some(a=>a.uid===x.uid));
 assert.equal(f.ctx().damage('player','enemy',4,{card:f.card('blank')}),6);f.reload();assert.equal(f.ctx().damage('player','enemy',4,{card:f.card('blank')}),6);
 f.b.phase='MAIN2';f.b.enemyPlan=[];A.Battle.submit(f.b,[],f.c,()=>.3);assert.equal(f.b.player.runes[0].uid,x.uid);assert.ok(f.b.enemy.hp<88);
});
test('a new rune sends the old physical card to rest immediately and only the new continuous effect applies',()=>{
 const f=setup(),a=f.play('runeA'),b=f.play('runeB');assert.equal(f.b.player.runes.length,1);assert.equal(f.b.player.runes[0].uid,b.uid);assert.ok(f.b.player.rest.some(x=>x.uid===a.uid));assert.equal(f.ctx().damage('player','enemy',4,{card:f.card('blank')}),9);
 f.ctx().move('player',b.uid,'rest');assert.equal(f.b.player.runes.length,0);assert.equal(f.ctx().damage('player','enemy',4,{card:f.card('blank')}),4);
});
test('countering a submitted rune sends only that card to rest and keeps the previous rune',()=>{
 const f=setup(),a=f.play('runeB'),newRune=f.card('runeA'),counter=f.card('ice');f.b.player.hand=[newRune];f.b.enemy.hand=[counter];f.b.enemyPlan=[counter.uid];f.b.enemyPowerPlan=false;
 A.Battle.submit(f.b,[newRune.uid],f.c,()=>.3);assert.equal(f.b.player.runes[0].uid,a.uid);assert.ok(f.b.player.rest.some(x=>x.uid===newRune.uid));assert.equal(f.ctx().damage('player','enemy',1,{card:f.card('blank')}),6);
});
test('automatic rune casts replace only their owner rune and players have independent active runes',()=>{
 const f=setup(),p=f.play('runeA'),e=f.card('runeA');f.job({kind:'cast',side:'enemy',card:e,copy:true});assert.equal(f.b.player.runes[0].uid,p.uid);assert.equal(f.b.enemy.runes.length,1);
 f.job({kind:'cast',side:'enemy',card:f.card('runeB'),copy:true});assert.equal(f.b.enemy.runes[0].cardId,'runeB');assert.equal(f.b.enemy.rest.filter(x=>x.cardId==='runeA').length,1);assert.equal(f.b.player.runes[0].uid,p.uid);
});
test('active rune cards remain public without revealing the opponent hand and show exactly the diamond name in battle status',()=>{
 const f=setup();f.play('runeA');const controls=A.BattleUI.controls(f.b,f.c),summary=A.BattleUI.summary(f.b,2,f.c),view=A.AI.publicSnapshot(f.b,f.c);
 assert.match(summary,/• \[🔥💎\] 첫 룬(?:\n|$)/);assert.doesNotMatch(summary,/• \[🔥💎\] 첫 룬[:(]/);assert.match(A.UI.card(f.card('runeA'),f.c),/^\[🔥💎\]/);
 assert.match(summary,/플레이어: \[🔥💎\] 첫 룬/);assert.equal(view.player.runes[0].cardId,'runeA');assert.deepEqual(view.player.hand,[]);assert.ok(!controls.includes('• [🔥💎]'));
 const choiceView=A.AIChoices.choose([{cardId:'blank'}],f.b,f.c,{}, {side:'enemy'});assert.equal(choiceView.cardId,'blank');
});
test('queued and delayed rune effects stop after their source rune is moved to rest',()=>{
 const f=setup(),a=f.play('runeA');f.ctx().move('player',a.uid,'rest');const hp=f.b.enemy.hp;
 f.job({kind:'runeTrigger',module:'runes',side:'player',uid:a.uid,effects:[{type:'damage',amount:20}]});assert.equal(f.b.enemy.hp,hp);
 f.job({kind:'effect',side:'player',card:a,effect:{type:'damage',amount:20},runeSource:{side:'player',uid:a.uid}});assert.equal(f.b.enemy.hp,hp);
});
test('runes are not removed by temporary or volatile hand cleanup and leaving the active area terminates them',()=>{
 const f=setup(),a=f.card('runeA',{temporary:true,volatile:true});f.b.player.hand=[a];A.Battle.submit(f.b,[a.uid],f.c,()=>.3);f.b.enemyPlan=[];A.Battle.submit(f.b,[],f.c,()=>.3);assert.equal(f.b.player.runes[0].uid,a.uid);
 const removed=f.ctx().remove('player',a.uid);assert.equal(removed.activeRuneDef,undefined);assert.equal(f.b.player.runes.length,0);
});

test('replaying the same physical rune never revives scheduled effects from its previous activation',()=>{
 const f=setup(),a=f.play('runeA'),oldActivation=f.b.player.runes[0].runeActivationId;f.ctx().move('player',a.uid,'rest');f.ctx().move('player',a.uid,'hand');f.b.enemyPlan=[];A.Battle.submit(f.b,[a.uid],f.c,()=>.3);assert.notEqual(f.b.player.runes[0].runeActivationId,oldActivation);
 const hp=f.b.enemy.hp;f.job({kind:'effect',side:'player',card:a,effect:{type:'damage',amount:20},runeSource:{side:'player',uid:a.uid,activation:oldActivation}});assert.equal(f.b.enemy.hp,hp);
 f.job({kind:'runeTrigger',module:'runes',side:'player',uid:a.uid,activation:oldActivation,effects:[{type:'damage',amount:20}]});assert.equal(f.b.enemy.hp,hp);
});
