const test=require('node:test'),assert=require('node:assert/strict'),A=require('../../악질봇4.0.0.js');
function fixture(heroId='guff',shrineId){
 const c=A.copy(A.catalog),hero=c.heroes.find(h=>h.id===heroId);let serial=0;
 const card=(id,upgraded=false,extra={})=>Object.assign({uid:'class-test-'+(++serial),cardId:id,upgraded},extra);
 const spec=(name)=>({name,maxHp:200,deck:Array.from({length:20},()=>card('starter:blank'))});c.cards['starter:blank']={name:'빈 카드',element:'NEUTRAL',cost:0,effects:[]};
 const player=Object.assign(spec('플레이어'),{heroId:hero.id,heroName:hero.name,heroPower:A.copy(hero.power),startingTreasureId:hero.startingTreasureId,shrineId});
 const b=A.Battle.create(player,spec('상대'),c,()=>.3);b.enemyPlan=[];b.enemyPowerPlan=false;
 function job(t){b.resolution={queue:[t]};A.Battle.process(b,c,()=>.3);}
 function settle(){let n=0;while(b.pendingChoice){assert.ok(n++<100);A.Battle.choose(b,0,c,()=>.3);}}
 function play(id,up=false){const x=card(id,up),d=A.Battle.describeCard(x,c);b.player.inFlight.push(x);job({kind:'card',module:d.module,side:'player',card:x,def:d});settle();return x;}
 function ctx(){return A.Battle.context(b,c,()=>.3,{side:'player'},[]);}
 return {b,c,hero,card,job,settle,play,ctx};
}
function harness(enableAll=true){const files={},c=A.copy(A.catalog),io={list:()=>Object.keys(files),read:n=>files[n],writeNewDurable(n,v){files[n]=v;}};let store,app,now=1000,event=0;
 if(enableAll)c.heroes.forEach(h=>{h.enabled=true;});
 function open(){store=A.Store.create(io);store.load(A.newState(42));app=A.App.create(store,c);}open();
 return {c,get store(){return store;},get app(){return app;},send(text){return app.handle({text,identity:'class-user',name:'테스터',room:'개발123',now:now++,eventId:'class-event-'+(++event)});},user(){const s=store.getState();return s.users[s.identities['identity:class-user']];},reopen(){store.close();open();}};
}
test('all six class definitions retain ten-card starting decks and can be re-enabled',()=>{
 assert.equal(A.catalog.heroes.length,6);assert.deepEqual(A.catalog.heroes.map(h=>h.cards.length),[10,10,10,10,10,10]);
 const h=harness(),screen=h.send('+탐험');for(const hero of h.c.heroes)assert.ok(screen.includes(hero.name));
 h.send('6');assert.equal(h.user().run.hero.id,'nautilus');
 assert.deepEqual(h.user().run.deck.map(x=>x.cardId),[
  'class:starter_strike','class:starter_strike','class:starter_strike',
  'class:nautilus_drop','class:nautilus_drop',
  'class:nautilus_buried','class:nautilus_buried','class:nautilus_buried',
  'class:nautilus_surprise','class:nautilus_surprise'
 ]);
 assert.equal(h.c.cards['class:nautilus_drop'].cost,0);assert.equal(h.c.cards['class:nautilus_drop'].upgrade.cost,0);
 h.send('y');assert.equal(h.user().run.battle.player.heroId,'nautilus');
 assert.equal(h.user().run.battle.player.startingTreasureId,'bilgewater_tribute');
 for(const id of ['guff','silent','celeste','thekal'])assert.ok(h.c.startingTreasures[h.c.heroes.find(h=>h.id===id).startingTreasureId]);
});
test('only Guff appears in production selection, including saved selection screens',()=>{
 assert.deepEqual(A.catalog.heroes.filter(h=>h.enabled!==false).map(h=>h.id),['guff']);
 const h=harness(false),screen=h.send('+탐험');assert.ok(screen.includes(h.c.heroes[0].name));
 for(const hero of h.c.heroes.slice(1))assert.ok(!screen.includes(hero.name));
 assert.deepEqual(h.user().run.pending.options,['guff']);assert.throws(()=>h.send('2'),/선택 번호/);
 h.store.transact('restore old selection',s=>{Object.values(s.users)[0].run.pending.options=h.c.heroes.map(x=>x.id);});
 h.reopen();h.send('+탐험');assert.deepEqual(h.user().run.pending.options,['guff']);h.send('1');assert.equal(h.user().run.hero.id,'guff');
});

test('disabling a class preserves its already selected exploration',()=>{
 const h=harness();h.send('+탐험');h.send('2');const deck=A.copy(h.user().run.deck);
 h.c.heroes.find(x=>x.id==='silent').enabled=false;h.reopen();h.send('+탐험');
 assert.equal(h.user().run.hero.id,'silent');assert.deepEqual(h.user().run.deck,deck);h.send('y');assert.equal(h.user().run.battle.player.heroId,'silent');
});

test('hero selection uses exact new starting decks and abilities without putting starter treasures into reward slots',()=>{
 for(let index=1;index<=4;index++){
  const h=harness();h.send('+탐험');h.send(String(index));const run=h.user().run,hero=h.c.heroes[index-1];assert.deepEqual(run.deck.map(x=>x.cardId),hero.cards);assert.deepEqual(run.treasures,{});
  const out=h.send('y'),b=h.user().run.battle;assert.equal(b.heroId,undefined);assert.equal(b.player.heroId,hero.id);assert.equal(b.player.startingTreasureId,hero.startingTreasureId);
  if(index===2){assert.equal(b.player.heroPower.name,'신속');assert.equal(b.player.hand.length,6);}else if(index!==4)assert.equal(b.player.hand.length,4);
  if(index===4){assert.ok(b.pendingChoice);assert.equal(b.pendingChoice.options.length,3);assert.ok(out.includes('제단'));const first=A.copy(b.pendingChoice);h.reopen();assert.deepEqual(h.user().run.battle.pendingChoice,first);h.send('1');assert.ok(h.user().run.shrineId);assert.equal(h.user().run.battle.player.shrines.length,1);}
 }
});
test('Guff purification ignores exactly the first two harmful effects each battle, not damage',()=>{
 const {b,ctx,job}=fixture();ctx().poison('enemy','player',3);assert.equal(b.player.status.poison,undefined);
 job({kind:'effect',side:'enemy',effect:{type:'weakened',turns:2}});assert.ok(!b.player.status.cards.effects.some(e=>e.kind==='weakened'));
 ctx().poison('enemy','player',4);assert.equal(b.player.status.poison,4);ctx().damage('enemy','player',7,{card:null});assert.equal(b.player.hp,193);assert.equal(b.player.status.classes.purified,2);
});
test('shared starter strike, guard, link and Guff specific cards use the new values and upgraded snack schedules two ticks',()=>{
 for(const up of [false,true]){
  const {b,play}=fixture();play('class:starter_strike',up);assert.equal(b.enemy.hp,up?191:194);play('class:starter_guard',up);assert.equal(b.player.shield,up?8:5);
  const hand=b.player.hand.length;play('class:starter_link',up);assert.equal(b.player.hand.length,hand+(up?3:2));
  play('class:guff_snack',up);assert.deepEqual(b.scheduled.map(x=>x.task.effect.amount),up?[2,2]:[2]);
 }
 const {b,play}=fixture();b.player.hp=100;play('class:guff_regen');assert.equal(b.player.hp,102);assert.equal(b.scheduled[0].task.effect.amount,2);
});
test('Celeste counts transformed crystal uses, adds power every fifth use and resets crystals whenever they leave hand',()=>{
 const {b,c,card,job,ctx,play}=fixture('celeste');
 for(let i=0;i<5;i++)job({kind:'event',side:'player',event:{type:'cardUsed',side:'player',free:false,card:card('crystal_ball'),def:c.cards.crystal_ball}});
 assert.equal(b.player.status.classes.powerBonus,1);const hp=b.enemy.hp;play('class:celeste_chain');assert.equal(b.enemy.hp,hp-6);
 for(const zone of ['rest','deck','excluded']){const x=card('class:starter_strike',false,{originalCardId:'crystal_ball',transformed:true,crystalUpgraded:true});b.player.hand=[x];ctx().move('player',x.uid,zone);assert.equal(x.cardId,'crystal_ball');assert.equal(x.upgraded,true);}
});
test('Thekal discovers one shrine once, retains it through the run and re-summons it in later battles',()=>{
 const h=harness();h.send('+탐험');h.send('4');h.send('y');const choices=h.user().run.battle.pendingChoice.options;h.send('1');const id=h.user().run.shrineId;assert.equal(id,choices[0].id);
 h.send('++관리자획득');h.send('++재시작');h.send('y');assert.equal(h.user().run.battle.pendingChoice,null);assert.equal(h.user().run.battle.player.shrines[0].id,id);
});
test('shrine damage follows shields then shrine HP then player HP, revives three standbys later, and Loa Call accelerates it',()=>{
 const {b,c,job,ctx}=fixture('thekal','akali');const altar=b.player.shrines[0];assert.equal(altar.hp,5);assert.equal(altar.maxHp,6);b.player.shield=3;ctx().damage('enemy','player',10,{card:null});assert.equal(b.player.shield,0);assert.equal(altar.hp,0);assert.equal(b.player.hp,198);assert.equal(altar.reviveTurn,3);
 job({kind:'power',module:'classes',side:'player',power:b.player.heroPower});assert.equal(altar.reviveTurn,2);
 b.turn=1;job({kind:'event',event:{type:'standby'}});assert.equal(altar.hp,0);b.turn=2;job({kind:'event',event:{type:'standby'}});assert.equal(altar.hp,7);assert.equal(altar.maxHp,7);
});
test('all nine shrine abilities are executable: overload immunity, copy, Holy generation, end damage, mana refill, HP costs, potency and healing conversion',()=>{
 const k=fixture('thekal','kragwa');k.ctx().overload('player',2);assert.equal(k.b.player.overloadNext,0);
 const g=fixture('thekal','gral');assert.equal(g.b.player.hand.length,5);
 const s=fixture('thekal','shirvallah'),before=s.b.player.hand.length;s.job({kind:'event',event:{type:'cardUsed',side:'player',card:s.card('class:starter_link'),def:s.c.cards['class:starter_link']}});assert.equal(s.b.player.hand.length,before+1);
 const h=fixture('thekal','halazzi');h.b.player.playedThisTurn=3;h.job({kind:'event',event:{type:'end'}});assert.equal(h.b.enemy.hp,194);
 const mana=fixture('thekal','gonk');mana.b.player.mana=0;mana.job({kind:'effect',side:'player',effect:{type:'shield',amount:2}});assert.equal(mana.b.player.mana,2);
 const life=fixture('thekal','hireek'),x=life.card('class:starter_strike');life.b.player.hand=[x];life.b.player.mana=0;A.Battle.submit(life.b,[x.uid],life.c,()=>.3);assert.equal(life.b.player.hp,195);
 const power=fixture('thekal','janalai');power.play('class:starter_strike');assert.equal(power.b.enemy.hp,192);
 const heal=fixture('thekal','bwonsamdi');heal.b.player.hp=100;heal.job({kind:'effect',side:'player',effect:{type:'heal',amount:5}});assert.equal(heal.b.player.hp,100);assert.equal(heal.b.enemy.hp,195);
});
test('Agamaggan bloodcraft creates one stone up to five, sacrifices twice run wins and never auto-refills',()=>{
 const {b,job}=fixture('agamaggan');b.player.runWins=3;b.player.bloodstones=4;job({kind:'power',module:'classes',side:'player',power:b.player.heroPower});assert.equal(b.player.hp,194);assert.equal(b.player.bloodstones,5);
 b.turn++;job({kind:'event',event:{type:'standby'}});assert.equal(b.player.bloodstones,5);
});
test('every declared class card resolves and each completed class reward pool contains only its declared cards',()=>{
 for(const ref of A.content.classes.cards)for(const up of ref.upgrade?[false,true]:[false]){
  const f=fixture('thekal','akali');f.b.player.heroId=ref.id.split('_')[0];f.b.player.status.deckEmptied=true;f.b.player.hand=[f.card('class:starter_strike'),f.card('class:starter_link')];f.b.player.rest=[f.card('class:starter_guard')];
  assert.doesNotThrow(()=>f.play('class:'+ref.id,up),ref.id+' '+up);assert.doesNotThrow(()=>JSON.stringify(f.b));
 }
 for(const hero of A.catalog.heroes.filter(h=>h.enabled!==false))for(const id of hero.classPool)assert.ok(A.catalog.cards[id]);
});


test('victory rewards use only the selected class pool and filter out other class treasures',()=>{
 for(let index=1;index<=4;index++){
  const h=harness();h.send('+탐험');h.send(String(index));h.send('y');if(index===4)h.send('1');
  h.store.transact('winning test hit',state=>{const u=Object.values(state.users)[0],b=u.run.battle;b.enemy.hp=1;b.enemy.shield=0;b.enemyPlan=[];b.enemyPowerPlan=false;b.player.hand=[{uid:'reward-hit',cardId:'class:starter_strike',cost:0,upgraded:false}];});
  h.send('1');let run=h.user().run;assert.equal(run.wins,1);assert.equal(run.pending.kind,'treasure');
  for(const id of run.pending.options){const t=h.c.treasures[id];assert.ok(!t.classId||t.classId===run.hero.id);}
  h.send('1');run=h.user().run;assert.equal(run.pending.kind,'bundles');assert.ok(run.pending.options.every(bundle=>bundle.length===3&&bundle.every(id=>run.hero.classPool.includes(id))));
  h.send('1');assert.equal(h.user().run.pending.kind,'camp');h.send('2');if(h.user().run.pending.kind==='forge')h.send('1');h.send('1');h.send(String(h.user().run.pending.options.length));assert.equal(h.user().run.phase,'READY');
 }
});
test('Celeste class treasures upgrade held crystals and change Inquiry to one upgraded crystal every four turns',()=>{
 const {b,c,card,job,play}=fixture('celeste');const crystal=card('class:starter_strike',false,{originalCardId:'crystal_ball',transformed:true});b.player.hand=[crystal];play('class:dragon_pendant_card');assert.equal(crystal.crystalUpgraded,true);
 b.player.hand=[];b.player.treasureIds.push('dragon_pendant_passive');b.turn=1;job({kind:'event',event:{type:'standby'}});assert.equal(b.player.hand.length,0);
 b.turn=3;job({kind:'event',event:{type:'standby'}});assert.equal(b.player.hand.length,1);assert.equal(b.player.hand[0].cardId,'crystal_ball');assert.equal(b.player.hand[0].upgraded,true);
});
test('Thekal class treasures duplicate shrines, react to destruction and keep the shortened resurrection schedule',()=>{
 const {b,c,ctx,job}=fixture('thekal','akali');b.player.treasureIds=['loa_covenant','loa_wrath','grace_harvester','loa_grace','majestic_presence'];
 const a=b.player.shrines[0],before=b.enemy.hp,hand=b.player.hand.length;const q=[],damage=A.Battle.context(b,c,()=>.3,{side:'enemy'},q);damage.damage('enemy','player',5,{card:null});b.resolution={queue:q};A.Battle.process(b,c,()=>.3);
 assert.equal(a.reviveTurn,2);assert.equal(b.enemy.hp,before-6);assert.equal(b.player.hand.length,8);
});


test('Agamaggan Boar Altar automatically makes one stone in MAIN1 and pays half the normal life cost',()=>{
 const {b,job}=fixture('agamaggan');b.player.runWins=3;b.player.treasureIds=['boar_altar'];job({kind:'event',event:{type:'beforeMain',phase:'MAIN1'}});assert.equal(b.player.hp,197);assert.equal(b.player.bloodstones,1);
 job({kind:'event',event:{type:'beforeMain',phase:'MAIN1'}});assert.equal(b.player.bloodstones,1);
});


test('AI can evaluate shrine life payments at zero mana and uses them for lethal without inventing mana refunds',()=>{
 const {b,c,card}=fixture('thekal','hireek');const own=b.player;b.player=b.enemy;b.enemy=own;b.player.hp=6;b.enemy.mana=0;b.enemy.hp=100;
 const x=card('class:starter_strike');b.enemy.hand=[x];b.enemy.treasureIds=['mana_receipt'];
 const p=A.AI.plan(b,c,()=>.3);assert.deepEqual(p.uids,[x.uid]);b.enemyPlan=p.uids;b.enemyPowerPlan=p.heroPower;A.Battle.submit(b,[],c,()=>.3);
 assert.equal(b.outcome,'defeat');assert.equal(b.enemy.hp,95);assert.equal(b.enemy.mana,0);assert.ok(!(b.enemy.status.treasures.main1Paid>0));
});


test('Focus stacks only within its own turn and does not retain last-turn stacks',()=>{
 const {b,play}=fixture('celeste');play('class:celeste_focus');play('class:celeste_focus');assert.equal(b.player.status.classes.focusCount,2);
 b.turn++;play('class:celeste_focus');assert.equal(b.player.status.classes.focusCount,1);
});


test('Eternal Devotion summons two independently destructible copies and undead shrines both revive',()=>{
 const {b,c,card}=fixture('thekal','akali');const deck=Array.from({length:8},()=>card('class:starter_guard'));
 const battle=A.Battle.create({name:'데칼',heroId:'thekal',maxHp:60,deck,heroPower:c.heroes.find(h=>h.id==='thekal').power,shrineId:'akali',treasureIds:['eternal_devotion']},{name:'상대',maxHp:60,deck:[]},c,()=>.3);
 assert.equal(battle.player.shrines.length,2);const tasks=[],ctx=A.Battle.context(battle,c,()=>.3,{side:'enemy'},tasks);ctx.damage('enemy','player',12,{card:null});
 assert.equal(battle.player.hp,58);assert.ok(battle.player.shrines.every(a=>a.hp===0&&a.reviveTurn===3));
});
test('Nautilus first sinking grants its starting treasure exactly once and zero-cost deck casts never strand unplayable cards',()=>{
 const {b,c,card,job,play}=fixture('nautilus');b.player.hand=[];b.player.deck=[card('starter:blank')];b.player.rest=[];
 job({kind:'effect',side:'player',effect:{type:'draw',amount:1}});assert.equal(b.player.status.classes.tribute,true);
 const before=(b.player.treasureIds||[]).length+b.player.hand.filter(x=>c.cards[x.cardId].treasure).length;
 job({kind:'event',event:{type:'standby'}});assert.equal((b.player.treasureIds||[]).length+b.player.hand.filter(x=>c.cards[x.cardId].treasure).length,before);
 b.player.deck=[card('starter:blank',false,{unplayable:true})];play('class:agamaggan_snow');assert.ok(b.player.deck[0].unplayable);assert.ok(!b.player.inFlight.some(x=>x.unplayable));
});
