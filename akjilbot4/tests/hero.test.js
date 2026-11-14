'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const A4=require('../../악질봇4.0.0.js');
const fixture=require('./fixtures');
const copy=A4.copy;
// These tests exercise the legacy effect engine with its original eight-card fixture.
// The current class production starters is checked in production-integration.test.js.
function catalog(){const c=fixture(A4),ids=['aquatic_form','wild_growth','healing_touch','flash_freeze','foresight','ancestral_knowledge','thunder','crackle'];ids.concat(['excess_mana']).forEach(id=>{c.cards[id]=copy(A4.catalog.cards[id]);});c.heroes=copy(A4.catalog.heroes.slice(0,1));c.heroes[0].cards=ids;c.heroes[0].power.usesPerTurn=1;delete c.heroes[0].classPool;delete c.heroes[0].startingTreasureId;c.config.playerMaxHpByStage=copy(A4.catalog.config.playerMaxHpByStage);return c;}
function makeBattle(ids,enemy=['harmless'],cat=catalog()){
  const deck=(list,prefix)=>list.map((id,i)=>({uid:prefix+i,cardId:id,upgraded:false}));
  return A4.Combat.create({name:'player',heroName:'거프',heroPower:cat.heroes[0].power,maxHp:15,deck:deck(ids,'p'),passives:[]},{name:'enemy',maxHp:100,deck:deck(enemy,'e'),passives:[]},cat,()=>0.5);
}
function quiet(b,ids=[]){b.enemyPlan=ids;b.enemyPlanTurn=b.turn;b.enemyPlanPhase=b.phase;b.enemyPlanDeferred=false;}
function uid(b,id,side='player'){return b[side].hand.find(c=>c.cardId===id).uid;}
function harness(){
  const c=catalog(),files={};let store,app,time=1000;
  const io={list:()=>Object.keys(files),read:n=>files[n],writeNewDurable(n,v){assert.ok(!Object.hasOwn(files,n));files[n]=v;}};
  function open(){store=A4.Store.create(io);store.load(A4.newState(42));app=A4.App.create(store,c);}
  open();
  return {c,io,files,get store(){return store;},send(action,eventId){return app.handle({identity:'hero-user',name:'Hero user',room:'test',now:time++,action,eventId});},
    user(){const s=store.getState();return s.users[s.identities['identity:hero-user']];},restart(){store.close();open();},
    start(){this.send({type:'explore'});this.send({type:'choose',token:this.user().run.pending.id,index:1});},
    mutate(fn){store.transact('test-setup',s=>fn(s.users[s.identities['identity:hero-user']]));}};
}

test('Guff is the only offered hero; eight legacy fixture cards yield four opening cards, no early key duplication',()=>{
  const h=harness();const text=h.send({type:'explore'});
  assert.match(text,/⚔️ 탐험 - 영웅 선택 ⚔️/);assert.match(text,/거프/);assert.equal(text.split('\n').filter(line=>/^\[[^\]]+\]/.test(line)).length,0);assert.match(text,/양성/);
  assert.deepEqual(h.user().run.pending.options,['guff']);assert.equal(h.user().items.keys,4);
  h.restart();h.send({type:'explore'});assert.equal(h.user().items.keys,4);
  h.send({type:'choose',token:h.user().run.pending.id,index:1});
  const r=h.user().run;
  assert.deepEqual(r.deck.map(c=>h.c.cards[c.cardId].name),['수중 동물 변신','급속 성장','치유의 손길','급속 빙결','초고속','선조의 지혜','천둥','파지직']);
  assert.equal(r.battle.player.hand.length,4);assert.equal(r.battle.player.deck.length,4);assert.equal(r.hero.id,'guff');
  assert.equal(r.battle.player.maxHp,60);assert.equal(r.battle.phase,'MAIN1');
  assert.equal(r.battle.player.heroPower.name,'양성');assert.equal(r.battle.player.heroPower.cost,1);
});

test('eight-card hands survive restart, display the new limit and reject a ninth saved card',()=>{
  const h=harness();h.start();
  h.mutate(u=>{const f=u.run.battle.player;f.hand=f.hand.concat(f.deck);f.deck=[];});
  h.restart();const text=h.send({type:'explore'});
  assert.match(text,/손패 8\/8/);assert.equal(h.user().run.battle.player.hand.length,8);
  assert.equal(A4.validateState(h.store.getState()),true);
  for(const side of ['player','enemy']){
    const state=h.store.getState(),u=state.users[state.identities['identity:hero-user']],f=u.run.battle[side];
    f.hand=Array.from({length:8},(_,i)=>({uid:side+'-saved-'+i,cardId:'harmless',upgraded:false}));f.deck=[];f.rest=[];f.excluded=[];
    assert.equal(A4.validateState(state),true);
    f.hand.push({uid:side+'-overflow',cardId:'harmless',upgraded:false});
    assert.throws(()=>A4.validateState(state),/손패 한도/);
  }
});

test('Nurture discounts once per whole turn and shares mana across both phases',()=>{
  const c=catalog(),b=makeBattle(['harmless'],[],c);b.player.hp=7;b.player.maxMana=2;b.player.mana=2;quiet(b);
  A4.Combat.submit(b,[],c,()=>0.5,{heroPower:true});
  assert.equal(b.phase,'MAIN2');assert.equal(b.turn,0);assert.equal(b.player.hp,7);assert.equal(b.player.mana,1);
  assert.equal(b.player.playedThisTurn,0);assert.equal(b.player.rest.length,0);assert.equal(b.player.heroPowerUsedTurn,0);
  const before=copy(b);assert.throws(()=>A4.Combat.submit(b,[],c,()=>0.5,{heroPower:true}),/한 턴에 한 번/);assert.deepEqual(b,before);
  quiet(b);A4.Combat.submit(b,[],c,()=>0.5);
  assert.equal(b.turn,1);assert.equal(b.phase,'MAIN1');assert.equal(b.player.mana,1);
  quiet(b);A4.Combat.submit(b,[],c,()=>0.5,{heroPower:true});assert.equal(b.player.hp,7);
});

test('Nurture is allowed under card lock and never counters or counts as a played card',()=>{
  const c=catalog(),b=makeBattle(['flash_freeze'],[],c);b.player.hp=14;b.player.status.cardLocks=[{from:0,until:0}];quiet(b);
  assert.throws(()=>A4.Combat.submit(b,[uid(b,'flash_freeze')],c,()=>0.5),/카드를 낼 수 없습니다/);
  A4.Combat.submit(b,[],c,()=>0.5,{heroPower:true});assert.equal(b.player.hp,14);assert.equal(b.player.playedThisTurn,0);
  assert.deepEqual(b.history[0].player,[]);assert.equal(b.player.hand.length,1);
});

test('a countered submitted card does not cancel Nurture and combined cost must be available upfront',()=>{
  const c=catalog(),b=makeBattle(['flash_freeze'],['lightning'],c);b.player.hp=8;quiet(b,[uid(b,'lightning','enemy')]);
  const before=copy(b);assert.throws(()=>A4.Combat.submit(b,[uid(b,'flash_freeze')],c,()=>0.5,{heroPower:true}),/마나/);assert.deepEqual(b,before);
  b.player.mana=2;b.player.maxMana=2;
  A4.Combat.submit(b,[uid(b,'flash_freeze')],c,()=>0.5,{heroPower:true});
  assert.equal(b.player.hp,7);assert.equal(b.player.mana,0);assert.equal(b.player.playedThisTurn,1);
  assert.equal(b.history[0].player[0].countered,true);assert.equal(b.player.rest.length,1);
});

test('power may be saved for MAIN2, and each new encounter has correct HP and a fresh power',()=>{
  const h=harness();h.start();
  for(let stage=0;stage<8;stage++){
    if(stage){h.mutate(u=>{u.run.wins=stage;u.run.phase='READY';u.run.battle=null;u.session=null;});h.send({type:'explore'});}
    const b=h.user().run.battle;assert.equal(b.player.hp,60);assert.equal(b.player.maxHp,60);assert.equal(b.player.heroPowerUsedTurn,-1);
    h.send({type:'submit',token:h.user().run.turnToken,indices:[]});assert.equal(h.user().run.battle.phase,'MAIN2');
    assert.equal(h.user().run.battle.player.mana,1);
    h.send({type:'submit',token:h.user().run.turnToken,indices:[],heroPower:true});assert.equal(h.user().run.battle.turn,1);
  }
});

test('crash after the primary commit cannot discount or spend twice and preserves ability use across phases',()=>{
  const h=harness();h.start();h.mutate(u=>{u.run.battle.player.hp=8;u.run.battle.player.maxMana=2;u.run.battle.player.mana=2;});
  const action={type:'submit',token:h.user().run.turnToken,indices:[],heroPower:true};
  const write=h.io.writeNewDurable;h.io.writeNewDurable=(n,v)=>{if(n.endsWith('-b.json'))throw Error('power loss');write(n,v);};
  assert.throws(()=>h.send(action,'nurture-event'),e=>e.code==='SAVE_BLOCKED');
  h.io.writeNewDurable=write;h.restart();const saved=h.store.getState();
  assert.equal(h.user().run.battle.player.hp,8);assert.equal(h.user().run.battle.player.mana,1);assert.equal(h.user().run.battle.player.heroPowerUsedTurn,0);
  h.send(action,'nurture-event');assert.deepEqual(h.store.getState(),saved);
  assert.throws(()=>h.send({type:'submit',token:h.user().run.turnToken,indices:[],heroPower:true}),/한 턴에 한 번/);
});

test('Aquatic Form pauses a paid phase, persists exact bottom-three choices, and resumes once',()=>{
  const h=harness();h.start();h.mutate(u=>{
    const b=u.run.battle,all=b.player.hand.concat(b.player.deck),card=all.find(c=>c.cardId==='aquatic_form');
    b.player.hand=[card];b.player.deck=all.filter(c=>c!==card);b.player.hp=10;
  });
  h.send({type:'submit',token:h.user().run.turnToken,indices:[1],heroPower:true});
  const paused=h.user().run.battle,options=copy(paused.pendingChoice.options),token=h.user().run.turnToken;
  assert.equal(paused.player.hp,10);assert.equal(paused.player.mana,0);assert.equal(paused.pendingChoice.options.length,3);
  h.restart();h.send({type:'explore'});assert.deepEqual(h.user().run.battle.pendingChoice.options,options);
  h.send({type:'choose',token,index:1});const after=h.user().run.battle;
  assert.equal(after.pendingChoice,null);assert.equal(after.phase,'MAIN2');assert.equal(after.player.hp,10);assert.equal(after.player.heroPowerUsedTurn,0);
  assert.equal(after.player.hand.length+after.player.deck.length+after.player.rest.length+after.player.excluded.length,8);
  assert.throws(()=>h.send({type:'choose',token,index:1}),/선택할 보상/);
});

test('countered Aquatic Form has no prompt and a resolved choice card can be used in MAIN2',()=>{
  const c=catalog(),b=makeBattle(['aquatic_form'],['fire'],c);b.player.deck=[{uid:'draw-me',cardId:'crackle',upgraded:false}];
  quiet(b,[uid(b,'fire','enemy')]);A4.Combat.submit(b,[uid(b,'aquatic_form')],c,()=>0.5);assert.equal(b.pendingChoice,null);
  const other=makeBattle(['aquatic_form'],[],c);other.player.deck=[{uid:'draw-me',cardId:'crackle',upgraded:false}];quiet(other);
  A4.Combat.submit(other,[uid(other,'aquatic_form')],c,()=>0.5);A4.Combat.choose(other,1,c,()=>0.5);
  assert.equal(other.phase,'MAIN2');assert.equal(other.player.hand[0].uid,'draw-me');quiet(other);
  A4.Combat.submit(other,['draw-me'],c,()=>0.5);assert.ok(other.enemy.hp<=93);
});

test('Wild Growth changes only max mana, persists growth and uses an excluded token at the cap',()=>{
  const c=catalog(),b=makeBattle(['wild_growth'],[],c);b.turn=5;b.player.maxMana=2;b.player.mana=2;quiet(b);
  A4.Combat.submit(b,[uid(b,'wild_growth')],c,()=>0.5);assert.equal(b.player.maxMana,3);assert.equal(b.player.mana,0);assert.equal(b.player.excluded.length,1);
  quiet(b);A4.Combat.submit(b,[],c,()=>0.5);assert.equal(b.player.mana,3);
  const full=makeBattle(['wild_growth'],[],c);full.turn=20;full.player.maxMana=5;full.player.mana=5;quiet(full);
  A4.Combat.submit(full,[uid(full,'wild_growth')],c,()=>0.5);assert.equal(full.player.hand[0].cardId,'excess_mana');assert.equal(full.player.mana,3);
});

test('Ancestral Knowledge overload survives MAIN2, applies once at next standby and cancels if countered',()=>{
  const c=catalog(),b=makeBattle(['ancestral_knowledge'],[],c);quiet(b);A4.Combat.submit(b,[uid(b,'ancestral_knowledge')],c,()=>0.5);
  assert.equal(b.player.mana,1);assert.equal(b.player.overloadNext,1);quiet(b);A4.Combat.submit(b,[],c,()=>0.5);assert.equal(b.player.mana,0);assert.equal(b.player.overloadNext,0);
  const blocked=makeBattle(['ancestral_knowledge'],['physical'],c);quiet(blocked,[uid(blocked,'physical','enemy')]);A4.Combat.submit(blocked,[uid(blocked,'ancestral_knowledge')],c,()=>0.5);assert.equal(blocked.player.overloadNext,0);
});

test('Thunder stacks scheduled standby hits and fires at most once per turn, while freezes allow powers',()=>{
  const c=catalog(),b=makeBattle(['thunder'],[],c);quiet(b);A4.Combat.submit(b,[uid(b,'thunder')],c,()=>0.5);assert.equal(b.enemy.hp,100);
  for(let i=1;i<=3;i++){quiet(b);A4.Combat.submit(b,[],c,()=>0.5);assert.equal(b.enemy.hp,100-2*i);if(i<3){quiet(b);A4.Combat.submit(b,[],c,()=>0.5);assert.equal(b.enemy.hp,100-2*i);}}
  const frozen=makeBattle(['flash_freeze'],['fire'],c);quiet(frozen,[uid(frozen,'fire','enemy')]);A4.Combat.submit(frozen,[uid(frozen,'flash_freeze')],c,()=>0.5);
  assert.deepEqual(frozen.enemy.status.cardLocks,[{from:1,until:1}]);
});

test('upgraded Growth remains innate while revised Aquatic Form is not; foresight reveals both next-turn plans',()=>{
  const c=catalog(),hero=c.heroes[0],deck=hero.cards.map((cardId,i)=>({uid:'p'+i,cardId,upgraded:cardId==='aquatic_form'||cardId==='wild_growth'}));
  const b=A4.Combat.create({name:'p',maxHp:15,deck,passives:[],heroPower:hero.power},{name:'e',maxHp:100,deck:[],passives:[]},c,()=>0.5);
  assert.equal(c.cards.aquatic_form.upgrade.innate,false);assert.ok(b.player.hand.some(x=>x.cardId==='wild_growth'));assert.equal(b.player.hand.length,4);
  const see=makeBattle(['foresight'],[],c);quiet(see);A4.Combat.submit(see,[uid(see,'foresight')],c,()=>0.5);quiet(see);A4.Combat.submit(see,[],c,()=>0.5);
  assert.deepEqual(A4.Combat.publicView(see).foreseenCards,[]);quiet(see);A4.Combat.submit(see,[],c,()=>0.5);assert.deepEqual(A4.Combat.publicView(see).foreseenCards,[]);
});

test('hero submission parser accepts power alone or with cards and rejects duplicate powers',()=>{
  assert.deepEqual(A4.App.parse('+제출 turn-1 영웅'),{type:'submit',token:'turn-1',heroPower:true,indices:[]});
  assert.deepEqual(A4.App.parse('+제출 turn-1 1 영웅 3'),{type:'submit',token:'turn-1',heroPower:true,indices:[1,3]});
  assert.throws(()=>A4.App.parse('+제출 turn-1 영웅 영웅'),/한 번만/);
});


test('Celeste passive gives a fresh crystal at visible turns two and four without spending mana or transforming it immediately',()=>{
 const c=copy(A4.catalog),power=c.heroes.find(x=>x.id==='celeste').power;
 c.cards.passive_blank={name:'무해',element:'NEUTRAL',cost:0,effects:[]};
 const spec=(side,power)=>({name:side,maxHp:200,heroPower:power,deck:Array.from({length:16},(_,i)=>({uid:side+i,cardId:'passive_blank'}))});
 let b=A4.Battle.create(spec('player',power),spec('enemy'),c,()=>0.5);
 assert.equal(power.kind,'passive');assert.equal(b.player.hand.some(x=>x.cardId==='crystal_ball'),false);
 assert.equal(A4.Battle.canSubmit(b,'player',c,null),false);
 const advance=()=>{b.enemyPlan=[];b.enemyPowerPlan=false;A4.Battle.submit(b,[],c,()=>0.5);};
 for(let visible=2;visible<=4;visible++){
  b.player.hand=b.player.hand.filter(x=>x.cardId!=='passive_blank');
  advance();advance();assert.equal(b.turn+1,visible);
  assert.equal(b.player.hand.filter(x=>x.cardId==='crystal_ball').length,visible%2===0?1:0);
  assert.equal(b.player.mana,b.player.maxMana);assert.equal(b.player.heroPowerUsedTurn,-1);
  b=copy(b);
 }
});

test('Celeste passive obeys hand overflow and also works when copied by the enemy',()=>{
 const c=copy(A4.catalog),power=c.heroes.find(x=>x.id==='celeste').power;
 c.cards.passive_blank={name:'무해',element:'NEUTRAL',cost:0,effects:[]};
 const spec=side=>({name:side,maxHp:200,heroPower:power,deck:Array.from({length:12},(_,i)=>({uid:side+i,cardId:'passive_blank'}))});
 const b=A4.Battle.create(spec('player'),spec('enemy'),c,()=>0.5);
 b.player.hand=Array.from({length:8},(_,i)=>({uid:'full'+i,cardId:'passive_blank'}));b.turn=1;b.phase='STANDBY';
 b.resolution={queue:[{kind:'event',event:{type:'standby'}}]};A4.Battle.process(b,c,()=>0.5);
 assert.equal(b.player.hand.length,8);assert.ok(b.player.excluded.some(x=>x.cardId==='crystal_ball'));
 assert.equal(b.enemy.hand.filter(x=>x.cardId==='crystal_ball').length,1);
});
