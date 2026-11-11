const test=require('node:test'),assert=require('node:assert/strict'),A=require('../../악질봇4.0.0.js');
function fixture(treasures=[]){
 const c=A.copy(A.catalog);c.cards.blank={name:'빈 카드',element:'NEUTRAL',cost:0,effects:[]};let serial=0;
 const card=(id,upgraded=false,extra={})=>Object.assign({uid:'exp-'+(++serial),cardId:id,upgraded},extra);
 const spec=name=>({name,maxHp:60,deck:Array.from({length:15},()=>card('blank'))});
 const b=A.Battle.create(Object.assign(spec('나'),{treasureIds:treasures}),spec('상대'),c,()=>.31);b.enemyPlan=[];b.enemyPowerPlan=false;
 function job(t){b.resolution={queue:[t]};A.Battle.process(b,c,()=>.31);}
 function ctx(){return A.Battle.context(b,c,()=>.31,{side:'player'},[]);}
 function settle(){let guard=0;while(b.pendingChoice){assert.ok(++guard<100);A.Battle.choose(b,0,c,()=>.31);}}
 function play(id,up=false){let x=card(id,up);b.player.inFlight.push(x);const d=A.Battle.describeCard(x,c);job({kind:'card',module:d.module,side:'player',card:x,def:d});settle();return x;}
 return {b,c,card,ctx,job,play,settle};
}
function harness(){const files={},c=A.copy(A.catalog),io={list:()=>Object.keys(files),read:n=>files[n],writeNewDurable(n,v){files[n]=v;}};let store,app,now=1000,event=0;
 function open(){store=A.Store.create(io);store.load(A.newState(42));app=A.App.create(store,c);}open();
 return {c,get store(){return store;},send(text){return app.handle({text,identity:'exp-user',name:'테스터',room:'개발123',now:now++,eventId:'exp-event-'+(++event)});},user(){const s=store.getState();return s.users[s.identities['identity:exp-user']];},reopen(){store.close();open();},mutate(fn){store.transact('arrange',s=>fn(s,s.users[s.identities['identity:exp-user']]));}};
}
function win(h){h.mutate((s,u)=>{const b=u.run.battle;b.player.hand=[{uid:A.id(s,'hit-'),cardId:'class:starter_strike',cost:0}];b.enemy.hp=1;b.enemy.shield=0;b.enemyPlan=[];b.enemyPowerPlan=false;b.enemy.status.inhibitorTriggered=true;});h.send('1');}
test('new neutral pool is exact, class poison cards no longer appear and new families execute at both ranks',()=>{
 assert.equal(A.catalog.cardPool.length,111);assert.equal(A.catalog.cardPool.includes('general:맹독'),false);assert.ok(A.catalog.cardPool.includes('general:살라드라실'));
 for(const id of A.catalog.cardPool.filter(id=>A.catalog.cards[id].module==='expansion'))for(const up of [false,true]){
  const f=fixture();f.b.player.hp=20;f.b.player.mana=5;f.b.player.hand=[f.card('class:starter_strike'),f.card('class:starter_guard')];f.b.player.deck=[f.card('class:starter_strike'),f.card('class:starter_link')];
  assert.doesNotThrow(()=>f.play(id,up),id);assert.doesNotThrow(()=>JSON.stringify(f.b));
 }
});
test('curse cards are uninteracting heart cards, unplayable and temporary, and leave the hand after their END effect',()=>{
 const f=fixture();for(const name of ['고드름','저주','혹한']){const id=A.CardRules.nameToId(name),d=f.c.cards[id];assert.equal(d.element,'CURSE');assert.equal(d.unplayable,true);assert.equal(d.temporary,true);assert.equal(d.excludeOnUse,false);}
 const curse=f.card(A.CardRules.nameToId('저주'));f.b.player.hand=[curse];assert.equal(A.Battle.cardAllowed(f.b,'player',f.c,curse),false);assert.match(A.UI.card(curse,f.c),/💔/);
 f.b.phase='MAIN2';f.b.enemyPlan=[];A.Battle.submit(f.b,[],f.c,()=>.31);assert.equal(f.b.player.hp,57);assert.ok(!f.b.player.hand.some(x=>x.uid===curse.uid));assert.ok(f.b.player.rest.some(x=>x.uid===curse.uid));
});
test('sunrise applies only in MAIN1 and unstable cards have no character vulnerability',()=>{
 const f=fixture();const before=f.b.enemy.hp;f.play('general:불씨');assert.equal(f.b.enemy.hp,before-4);f.b.phase='MAIN2';f.play('general:불씨');assert.equal(f.b.enemy.hp,before-4);
 for(const id of ['general:플레어드라이브','general:아쿠아링','general:강풍'])assert.equal(f.c.cards[id].unstable,true);
 assert.ok(!f.c.cards['general:플레어드라이브'].text.includes('취약'));
});
test('potency changes card damage and healing; bloodstones and daggers cap at five and consuming daggers deals four each',()=>{
 const f=fixture();f.b.player.hp=20;f.job({kind:'effect',side:'player',effect:{type:'power',amount:2}});f.play('class:starter_strike');assert.equal(f.b.enemy.hp,52);f.play('class:guff_regen');assert.equal(f.b.player.hp,24);
 for(const type of ['bloodstone','dagger'])f.job({kind:'effect',side:'player',effect:{type,amount:8}});assert.equal(f.b.player.bloodstones,5);assert.equal(f.b.player.daggers,5);
 f.job({kind:'effect',side:'player',effect:{type:'consumeDaggers',amount:2}});assert.equal(f.b.player.daggers,3);assert.equal(f.b.enemy.hp,44);
 f.b.player.heroId='silent';assert.match(A.BattleUI.controls(f.b,f.c),/단검 \| 🗡️ 🗡️ 🗡️ \(3\/5\)/);
});
test('creators gate prevents all exile and singularity triggers only when a card actually enters exclusion',()=>{
 const gate=fixture(['creators_gate','singularity']);const x=gate.card('class:starter_strike');gate.b.player.hand=[x];gate.ctx().move('player',x.uid,'excluded');gate.job({kind:'event',event:{type:'noop'}});assert.equal(gate.b.player.excluded.length,0);assert.ok(gate.b.player.rest.some(c=>c.uid===x.uid));assert.equal(gate.b.player.hand.length,0);
 const singular=fixture(['singularity']);const y=singular.card('class:starter_strike');singular.b.player.hand=[y];singular.b.resolution={queue:[]};A.Battle.context(singular.b,singular.c,()=>.31,{side:'player'},singular.b.resolution.queue).move('player',y.uid,'excluded');A.Battle.process(singular.b,singular.c,()=>.31);assert.equal(singular.b.player.hand.length,1);assert.ok(singular.c.cards[singular.b.player.hand[0].cardId].treasure);
});
test('velvet choker permits only one card per phase, Icarus pins maximum mana and emerald goggles discounts only the first hand position',()=>{
 const f=fixture(['velvet_choker','icarus_wings','emerald_goggles']);assert.equal(f.b.player.maxMana,3);assert.equal(f.b.player.mana,3);const a=f.card('class:starter_strike'),b=f.card('class:starter_guard');f.b.player.hand=[a,b];assert.equal(f.ctx().cost('player',a),0);assert.equal(f.ctx().cost('player',b),1);assert.throws(()=>A.Battle.submit(f.b,[a.uid,b.uid],f.c,()=>.31),/카드 1장/);assert.ok(A.AI.candidates(f.b,f.c,'player',4).every(x=>x.uids.length<=1));
 f.b.turn=28;f.b.phase='MAIN2';f.b.enemyPlan=[];A.Battle.submit(f.b,[],f.c,()=>.31);assert.equal(f.b.player.maxMana,3);
});
test('overflow potion cycles the first held card into the deck on every overflowing draw and keeps the newly drawn card',()=>{
 const f=fixture(['acceleration_potion']);const held=Array.from({length:8},()=>f.card('blank'));f.b.player.hand=held.slice();const a=f.card('class:starter_strike'),b=f.card('class:starter_guard');f.b.player.deck=[a,b];f.ctx().draw('player',2);assert.ok(f.b.player.deck.some(x=>x.uid===held[0].uid));assert.ok(f.b.player.deck.some(x=>x.uid===held[1].uid));assert.ok(f.b.player.hand.some(x=>x.uid===a.uid));assert.ok(f.b.player.hand.some(x=>x.uid===b.uid));assert.equal(f.b.player.hand.length,8);assert.equal(f.b.player.excluded.length,0);
});
test('battle-start permanent forge, scroll potency decay, mystery tome and neutral treasure filtering',()=>{
 const f=fixture(['absurd_scroll','mystery_tome']);assert.equal(f.b.player.status.classes.powerBonus,4);assert.equal(f.b.player.status.expansion.scrollPower,4);assert.equal(f.b.player.deck.filter(x=>f.c.cards[x.cardId].treasure).length,3);
 assert.ok(!A.catalog.neutralTreasurePool.includes('molten_bone'));assert.ok(!A.catalog.neutralTreasurePool.includes('shaladrassil'));assert.deepEqual(A.catalog.treasures.judge_ring.excludeHeroes,['celeste','agamaggan']);
 assert.equal(f.c.cards.treasure_starburst.cost,1);f.b.enemy.shield=18;f.play('treasure_starburst');assert.equal(f.b.enemy.shield,0);
});
test('win flow persists three bundles, camp, event placeholder and shop, grants low-health gold and never double-adds on replay',()=>{
 const h=harness();h.send('+탐험');h.send('1');h.send('y');h.mutate((s,u)=>{u.run.battle.player.hp=1;});win(h);
 let r=h.user().run;assert.equal(r.gold,r.lastBattleGold.total);assert.equal(r.lastBattleGold.bonus,5);assert.equal(r.pending.kind,'treasure');h.send('1');r=h.user().run;assert.equal(r.pending.kind,'bundles');assert.equal(r.pending.options.length,3);for(const bundle of r.pending.options){assert.equal(bundle.length,3);assert.ok(bundle.every(id=>r.hero.classPool.includes(id)));}
 const oldLength=r.deck.length,screen=A.UI.render(h.user(),{kind:'run'},h.c,1000);assert.match(screen,/職業|직업/);h.reopen();h.send('1');assert.equal(h.user().run.deck.length,oldLength+3);assert.equal(h.user().run.pending.kind,'camp');
 h.send('1');assert.equal(h.user().run.hp,11);assert.equal(h.user().run.pending.kind,'event');h.send('1');r=h.user().run;assert.equal(r.pending.kind,'tavern');assert.equal(r.tavern.filter(x=>x.kind==='card').length,5);assert.equal(r.tavern.find(x=>x.kind==='remove').price,3);
 const stock=A.copy(r.tavern);h.reopen();assert.deepEqual(h.user().run.tavern,stock);h.send(String(h.user().run.pending.options.length));assert.equal(h.user().run.phase,'READY');assert.equal(h.user().run.hp,11);h.send('+탐험');h.send('y');assert.equal(h.user().run.battle.player.hp,11);
});
test('shop purchases deduct run gold once, removal returns to saved stock and interest is capped at five',()=>{
 const h=harness();h.send('+탐험');h.send('1');h.send('y');win(h);h.send('1');h.send('1');h.send('2');if(h.user().run.pending.kind==='forge')h.send('1');h.send('1');
 h.mutate((s,u)=>{u.run.gold=100;});let r=h.user().run;assert.equal(r.pending.kind,'tavern');const before=r.deck.length,amount=r.tavern[0].price;h.send('1');r=h.user().run;assert.equal(r.deck.length,before+1);assert.equal(r.gold,100-amount);assert.throws(()=>h.send('1'),/이미 구매/);
 const removal=r.tavern.findIndex(x=>x.kind==='remove');h.send(String(removal+1));assert.equal(h.user().run.pending.kind,'shopRemove');h.send('1');r=h.user().run;assert.equal(r.deck.length,before);assert.equal(r.pending.kind,'tavern');const money=r.gold;h.send(String(r.pending.options.length));assert.equal(h.user().run.gold,money+5);assert.equal(h.user().run.lastInterest,5);
});
test('all eight victories offer the new flow, including the last battle, and settle only after leaving the final tavern',()=>{
 const h=harness();h.send('+탐험');h.send('1');h.send('y');
 for(let stage=1;stage<=8;stage++){
  win(h);assert.equal(h.user().run.wins,stage);let guard=0;while(h.user().run&&h.user().run.phase==='REWARD'){
   assert.ok(++guard<15);const r=h.user().run,p=r.pending;h.send(String(p.kind==='tavern'?p.options.length:p.kind==='camp'?2:p.kind==='swap'?3:1));
  }
  if(stage<8){assert.equal(h.user().run.phase,'READY');h.send('+탐험');h.send('y');}
 }
 assert.equal(h.user().run,null);assert.equal(h.user().lastRun.wins,8);assert.ok(h.user().lastRun.reward.gold>0);
});

test('new neutral AI estimates account for sunrise, upgrades, paid batch mana and the actual shield target',()=>{
 const f=fixture();const metric=(id,up=false)=>A.AIEvaluation.evaluateCard(A.Battle.describeCard(f.card(id,up),f.c),f.b.player,f.b.enemy,f.b,f.c);
 assert.equal(metric('general:플레어드라이브',true).damage,14);assert.equal(metric('general:볼트태클',true).damage,15);f.b.player.hp=1;f.b.player.mana=0;assert.equal(metric('general:금단의 치유술').heal,0);f.b.player.mana=2;assert.equal(metric('general:금단의 치유술',true).heal,12);f.b.enemy.shield=0;assert.equal(metric('treasure_starburst').control,0);f.b.enemy.shield=20;assert.equal(metric('treasure_starburst').control,13);
});
test('golden forge upgrades an actual run card permanently and the upgrade survives the next battle',()=>{
 const h=harness();h.send('+탐험');h.send('1');h.mutate((s,u)=>{u.run.treasures.low='golden_forge';});h.send('y');const r=h.user().run,upgraded=r.deck.filter(x=>x.upgraded);assert.equal(upgraded.length,1);assert.ok(r.battle.player.hand.some(x=>x.uid===upgraded[0].uid&&x.upgraded));
 h.send('++관리자획득');h.send('++재시작');h.send('y');assert.ok(h.user().run.deck.some(x=>x.uid===upgraded[0].uid&&x.upgraded));
});
