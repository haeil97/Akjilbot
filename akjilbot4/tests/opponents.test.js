'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const A4 = require('../../악질봇4.0.0.js');
const fixtures = require('./fixtures.js');
const copy = value => JSON.parse(JSON.stringify(value));
const roster = A4.content.opponentDecks.enemies;
function run(stage) { return {wins:stage-1,deck:[],treasures:{}}; }
function names(plan) { return plan.deck.map(card => A4.Opponents.referenceById(card.cardId).name); }
function counts(list) { return list.reduce((out,name) => (out[name]=(out[name] || 0)+1,out),{}); }

test('the single script contains all card references and all twenty-six stage-specific opponents', () => {
  assert.deepEqual(A4.Opponents.validateDesign(),[]);
  assert.equal(A4.content.generalCards.length,110);
  assert.equal(A4.content.tokens.length,4);
  assert.deepEqual([1,2,3,4,5,6,7,8].map(n=>A4.Opponents.stage(n).maxHp),[15,20,25,35,40,50,60,70]);
  assert.deepEqual(A4.Opponents.stage(1).candidates,['cannon_minion','little_hatchling']);
  assert.deepEqual(A4.Opponents.stage(2).candidates,A4.Opponents.stage(3).candidates);
  assert.deepEqual(A4.Opponents.stage(4).candidates,A4.Opponents.stage(5).candidates);
  assert.deepEqual(A4.Opponents.stage(6).candidates,A4.Opponents.stage(7).candidates);
  assert.equal(new Set(roster.map(e=>e.id)).size,26);
});

test('fixed decks respect the requested sizes, explicit duplicate exceptions, and exclusive cards', () => {
  const expectedSizes = {cannon_minion:8,little_hatchling:8,aviana:17,black_knight:16,patchwerk:16,antonidas:16,
    pikachu:20,fiora:29,piranha_plant:32,ivysaur:30,hanar:20,super_minion:40,boo:40,meltranix:30,brightwing:20,teemo:30,ivern:26,trap_room:27,yuumi:40,lich_king:40,aurelion_sol:20,mida:30,yogg_saron:40,extreme_troll:30};
  const exceptions = {aviana:{'성지순례':3},fiora:{'약점 포착':8},yuumi:{'대단원':4,'필연':4,'구원의 기도':4},meltranix:{'지목':4},boo:{'유령 강탈자':4,'심해 저주':4,'서리 저주':4,'놀래키기':4},ivern:{'덩굴뿌리':4},aurelion_sol:{'수정구':14,'불길한 존재감':4},yogg_saron:{'운명':20,'필연':20}};
  for (const enemy of roster.filter(e=>e.deckMode==='fixed')) {
    const plan = A4.Opponents.prepare(A4.newState(12),run(enemy.stages[0]),A4.catalog,enemy.id);
    assert.equal(plan.deck.length,expectedSizes[enemy.id],enemy.name);
    const occurrences = counts(names(plan));
    for (const [name,count] of Object.entries(occurrences)) assert.ok(count <= (exceptions[enemy.id]?.[name] || 2),enemy.name+' '+name);
    assert.equal(new Set(plan.deck.map(c=>c.uid)).size,plan.deck.length);
    assert.ok(plan.deck.every(c=>c.upgraded===false||(enemy.id==='aviana'&&c.cardId==='general:성지순례')));
  }
  const list = id => counts(names(A4.Opponents.prepare(A4.newState(9),run(8),A4.catalog,id)));
  assert.equal(list('mida')['구원의 길'],1);
  assert.equal(list('extreme_troll')['밴 해머+++'],2);
  assert.deepEqual(list('yogg_saron'),{'운명':20,'필연':20});
});

test('trap room contains each magitech trap twice and each divine power once, and Ivern contains no lightning', () => {
  const trap = A4.Opponents.prepare(A4.newState(8),run(4),A4.catalog,'trap_room');
  const tally = counts(names(trap));
  for (const name of ['마법공학: 퓨즈','마법공학: 니비루','마법공학: 아틀라스','예지','풍요','얼음 회오리','칼바람','굽이치는 파도','자연화','마나 연소']) assert.equal(tally[name],2);
  for (const name of ['신의 권능: 재생','신의 권능: 징벌','신의 권능: 성역']) assert.equal(tally[name],1);
  assert.equal(trap.deck.length,27);
  const ivern = A4.Opponents.prepare(A4.newState(8),run(4),A4.catalog,'ivern');
  assert.equal(counts(names(ivern))['덩굴뿌리'],4);
  for (const name of ['맹독','차오르는 독','이슬 절차']) assert.equal(counts(names(ivern))[name],2);
  assert.equal(ivern.deck.length,26);
  assert.ok(ivern.deck.every(c=>A4.Opponents.referenceById(c.cardId).element!=='LIGHTNING'));
  for (const id of ['cannon_minion','little_hatchling']) {
    const first = A4.Opponents.prepare(A4.newState(3),run(1),A4.catalog,id);
    assert.ok(first.deck.every(c=>A4.Opponents.referenceById(c.cardId).element!=='HOLY'));
  }
});

test('shared candidates receive the current stage health without mutating shared definitions', () => {
  const definition = A4.Opponents.get('aviana');
  const one = A4.Opponents.prepare(A4.newState(21),run(2),A4.catalog,'aviana');
  const two = A4.Opponents.prepare(A4.newState(22),run(3),A4.catalog,'aviana');
  assert.equal(one.maxHp,20); assert.equal(two.maxHp,25);
  assert.deepEqual(A4.Opponents.get('aviana'),definition);
  assert.throws(()=>A4.Opponents.prepare(A4.newState(1),run(1),A4.catalog,'aviana'),/候補|후보/);
});

test('doctor samples thirty-seven nonholy general cards with at most two copies plus three prophecies', () => {
  const signatures = new Set();
  for (let seed = 1; seed <= 40; seed++) {
    const plan = A4.Opponents.prepare(A4.newState(seed*56789),run(8),A4.catalog,'plague_doctor');
    assert.equal(plan.deck.length,40);
    const tally = counts(names(plan)); assert.equal(tally['예고'],3); delete tally['예고'];
    for (const [name,count] of Object.entries(tally)) {
      const def = A4.Opponents.reference(name);
      assert.ok(count<=2); assert.equal(def.token,false); assert.notEqual(def.element,'HOLY'); assert.ok(!def.exclusive);
    }
    assert.ok(plan.deck.every(c=>!c.upgraded)); signatures.add(names(plan).join('|'));
  }
  assert.ok(signatures.size>1);
});

test('mirror preserves individual upgrades and all treasure entries without duplicating card treasures or copying relics', () => {
  const catalog = fixtures(A4), state = A4.newState(3), r = run(6);
  r.deck = [{uid:'original-1',cardId:'fire',upgraded:true},{uid:'original-2',cardId:'fire',upgraded:false},
    {uid:'original-3',cardId:'treasure_low',upgraded:false,treasureSlot:'low'},
    {uid:'original-4',cardId:'treasure_high',upgraded:false,treasureSlot:'extra'}];
  r.treasures = {low:'low_card',high:'high_hp',extra:'high_card',extraPassive:'low_shield'};
  r.effects = [{type:'maxHp',amount:999}]; r.hero = {power:{id:'do-not-copy'}};
  const plan = A4.Opponents.prepare(state,r,catalog,'faceless_manipulator');
  assert.equal(plan.deck.length,4); assert.equal(plan.treasures.length,4);
  assert.deepEqual(plan.deck.map(c=>[c.cardId,c.upgraded]),r.deck.map(c=>[c.cardId,c.upgraded]));
  assert.ok(plan.deck.every(c=>r.deck.every(original=>original.uid!==c.uid)));
  assert.deepEqual(plan.treasurePassives,[{type:'maxHp',amount:2},{type:'startingShield',amount:1}]);
  assert.equal(plan.heroPowerSpec.name,'요그사론의 심복');
  plan.deck[0].upgraded=false; plan.treasures[1].definition.effects[0].amount=9999;
  assert.equal(r.deck[0].upgraded,true); assert.equal(catalog.treasures.high_hp.effects[0].amount,2);
});

test('saved encounter identity and random deck cannot be rerolled on resume', () => {
  const state=A4.newState(778899), r=run(8);
  const first=copy(A4.Opponents.prepare(state,r,A4.catalog,'plague_doctor'));
  const saved=copy(state);
  assert.deepEqual(A4.Opponents.prepare(state,r,A4.catalog),first);
  assert.deepEqual(state,saved);
  assert.throws(()=>A4.Opponents.prepare(state,r,A4.catalog,'yogg_saron'),/확정된 상대/);
});

test('opening gifts are separate from the thirty-card boss deck and fit the new eight-card hand limit', () => {
  const plan=A4.Opponents.prepare(A4.newState(33),run(8),A4.catalog,'extreme_troll');
  assert.equal(plan.deck.length,30); assert.equal(plan.playerOpeningAdditions.length,3);
  assert.ok(plan.playerOpeningAdditions.every(c=>c.cardId==='deactivation' && !c.upgraded));
  assert.equal(A4.HAND_LIMIT,8); assert.ok(4+plan.playerOpeningAdditions.length<=A4.HAND_LIMIT);
  assert.equal(new Set(plan.deck.concat(plan.playerOpeningAdditions).map(c=>c.uid)).size,33);
});

test('boss specifications are backed by executable registered cards and powers', () => {
  assert.ok(A4.content.opponentAbilities.exclusiveCards.every(c=>(c.id==='crystal_ball'||c.upgradeable===false) && !c.effects));
  const errors=A4.validateCatalog(A4.catalog);
  assert.deepEqual(errors,[]);
  assert.doesNotThrow(()=>A4.Opponents.rejectBlueprint(A4.catalog.enemies.plague_doctor));
  assert.equal(A4.catalog.enemies.plague_doctor.heroPower.module,'boss');
  assert.equal(A4.catalog.config.enabled,true);
});

test('a crash after the first durable snapshot recovers the same complete doctor deck and RNG state', () => {
  const files={}, io={list:()=>Object.keys(files),read:key=>files[key],writeNewDurable:(key,value)=>{
    if (Object.hasOwn(files,key)) throw new Error('EEXIST'); files[key]=value;
  }};
  const catalog=fixtures(A4), initial=A4.newState(374857);
  const user=A4.Game.newUser(initial,'복구 시험',1800000000000,catalog); initial.users[user.id]=user;
  user.run={id:A4.id(initial,'run-'),wins:7,phase:'HERO',hero:null,deck:[],treasures:{},effects:[],queue:[],
    pending:{id:'test-choice',options:['test-hero']},battle:null};
  const expected=copy(initial);
  A4.Opponents.prepare(expected,expected.users[user.id].run,catalog,'plague_doctor');
  assert.equal(A4.validateState(expected,catalog),true);
  const store=A4.Store.create(io); store.load(initial);
  const write=io.writeNewDurable;
  io.writeNewDurable=(key,value)=>{if(key.endsWith('-b.json'))throw new Error('power off');write(key,value);};
  assert.throws(()=>store.transact('prepare-enemy',draft=>A4.Opponents.prepare(draft,draft.users[user.id].run,catalog,'plague_doctor')),e=>e.code==='SAVE_BLOCKED');
  store.close(); io.writeNewDurable=write;
  const recovered=A4.Store.create(io); recovered.load(A4.newState(1));
  assert.deepEqual(recovered.getState(),expected);
  recovered.transact('resume-enemy',draft=>A4.Opponents.prepare(draft,draft.users[user.id].run,catalog));
  assert.deepEqual(recovered.getState(),expected);
  recovered.close();
});

test('one run never draws the same opponent twice, including across saved-state reloads',()=>{
  for(let seed=1;seed<=30;seed++){
    let state=A4.newState(seed*87123),r={wins:0,deck:[{uid:'starter',cardId:A4.catalog.heroes[0].cards[0],upgraded:false}],treasures:{},encounterResults:[]};
    const seen=new Set();
    for(let stage=1;stage<=8;stage++){
      const enemy=A4.Opponents.prepare(state,r,A4.catalog);
      assert.ok(!seen.has(enemy.enemyId),'repeated opponent '+enemy.enemyId);seen.add(enemy.enemyId);
      const rng=state.rngState;assert.deepEqual(A4.Opponents.prepare(state,copy(r),A4.catalog),enemy);assert.equal(state.rngState,rng);
      r.encounterResults.push({stage,enemyId:enemy.enemyId,name:enemy.name,won:true});r.enemyId=enemy.enemyId;r.wins++;r.enemySpec=null;
      r=copy(r);state=copy(state);
    }
  }
});
test('name-only history and legacy last-opponent ID also exclude an encountered opponent',()=>{
  for(const saved of [{encounterResults:[{stage:2,name:'아비아나',won:true}]},{enemyId:'aviana'}]){
    const r=Object.assign(run(3),saved),state=A4.newState(31),before=copy(state);
    assert.throws(()=>A4.Opponents.prepare(state,r,A4.catalog,'aviana'),/이미 만난 상대/);assert.deepEqual(state,before);
    assert.notEqual(A4.Opponents.prepare(state,r,A4.catalog).enemyId,'aviana');
  }
});


test('all group 3 through 5 fixed opponents except the three exclusions carry at least two fitting cleansing cards',()=>{
 const excluded=['faceless_manipulator','plague_doctor','yogg_saron'],cleansing=['제독','자연의 해독','전이'];let checked=0;
 for(const enemy of roster){
  if(!enemy.stages.some(stage=>stage>=4)||excluded.includes(enemy.id))continue;
  checked++;const plan=A4.Opponents.prepare(A4.newState(73),run(enemy.stages[0]),A4.catalog,enemy.id),list=counts(names(plan));
  assert.ok(cleansing.reduce((n,name)=>n+(list[name]||0),0)>=2,enemy.name);assert.equal(plan.deck.length,enemy.deckSize);
 }
 assert.equal(checked,12);
 const sol=A4.Opponents.get('aurelion_sol');assert.equal(sol.cards.find(x=>x.name==='수정구').count,14);assert.equal(sol.cards.find(x=>x.name==='불길한 존재감').count,4);
 for(const id of excluded){assert.ok(!(A4.Opponents.get(id).cards||[]).some(x=>cleansing.includes(x.name)));}
});


test('Fiora has two of each distinct weakness element and one Grand Duel, and swaps stage groups with Super Minion',()=>{
  const spec=A4.Opponents.get('fiora');assert.deepEqual(spec.stages,[4,5]);assert.equal(spec.deckSize,29);
  const plan=A4.Opponents.prepare(A4.newState(9),run(4),A4.catalog,'fiora');
  for(const el of ['nature','ice','lightning','fire'])assert.equal(plan.deck.filter(x=>x.cardId==='fiora_weakness_'+el).length,2);
  assert.equal(plan.deck.filter(x=>x.cardId==='fiora_grand_duel').length,1);
  assert.deepEqual(A4.Opponents.get('super_minion').stages,[2,3]);
  assert.ok(!A4.Opponents.stage(2).candidates.includes('fiora'));assert.ok(!A4.Opponents.stage(4).candidates.includes('super_minion'));
  const display=A4.UI.render(null,{kind:'heroDeck',query:'피오라'},A4.catalog,0);
  for(const icon of ['🍃','❄️','⚡','🔥'])assert.ok(display.includes('x2 ['+icon+'] 약점 포착'));
  assert.ok(display.includes('x1 [🕊️] 대결투'));
  const lookup=A4.UI.render(null,{kind:'encyclopedia',query:'약점 포착'},A4.catalog,0);
  assert.equal((lookup.match(/약점 포착 \| 💧1/g)||[]).length,4);
});


test('temporarily disabled Plague Doctor stays defined but never appears in normal encounter pools',()=>{
 assert.equal(A4.Opponents.get('plague_doctor').encounterEnabled,false);
 assert.equal(A4.catalog.enemies.plague_doctor.encounterEnabled,false);
 assert.ok(A4.catalog.enemies.plague_doctor.heroPower);
 for(let stage=1;stage<=8;stage++){
   assert.ok(!A4.catalog.encounters[stage-1].includes('plague_doctor'));
   assert.ok(!A4.Opponents.stage(stage).candidates.includes('plague_doctor'));
 }
 for(let seed=1;seed<=80;seed++)assert.notEqual(A4.Opponents.prepare(A4.newState(seed*17423),run(8),A4.catalog).enemyId,'plague_doctor');
 // Explicit internal test fixtures can still exercise the disabled boss; saved encounters remain stable.
 const state=A4.newState(9),r=run(8),saved=A4.Opponents.prepare(state,r,A4.catalog,'plague_doctor');
 assert.equal(A4.Opponents.prepare(state,r,A4.catalog),saved);
});


test('Aviana adds exactly one upgraded Pilgrimage while retaining two normal copies and deck lookup shows its rank',()=>{
 const p=A4.Opponents.prepare(A4.newState(17),run(2),A4.catalog,'aviana');
 assert.equal(p.deck.length,17);const family=p.deck.filter(x=>x.cardId==='general:성지순례');
 assert.equal(family.filter(x=>x.upgraded).length,1);assert.equal(family.filter(x=>!x.upgraded).length,2);
 assert.equal(p.deck.filter(x=>x.upgraded).length,1);
 const text=A4.UI.render(null,{kind:'heroDeck',query:'아비아나'},A4.catalog,0);
 assert.ok(text.includes('x1 [🕊️] 성지순례+ | 💧1'));assert.ok(text.includes('x2 [🕊️] 성지순례 | 💧1'));
});
