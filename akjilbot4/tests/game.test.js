'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const A4 = require('../../악질봇4.0.0.js');
const fixture = require('./fixtures');

test('card addition rewards weight each four-mana card by half and five-mana by one quarter',()=>{
  const catalog=A4.copy(A4.catalog),state=A4.newState(724931),user=A4.Game.newUser(state,'가중치 검증',1000,catalog);
  catalog.config.engineVersion=2;catalog.cardPool=[];delete catalog.heroes[0].classPool;
  for(let cost=0;cost<=5;cost++){const id='weighted-'+cost;catalog.cards[id]={name:id,cost,element:'NEUTRAL',effects:[]};catalog.cardPool.push(id);}
  const counts=[0,0,0,0,0,0],trials=6000;
  for(let n=0;n<trials;n++){
    user.session={room:'옥랜111',until:61000};
    user.run={id:'weighted-run',wins:3,phase:'REWARD',hero:A4.copy(catalog.heroes[0]),deck:catalog.cardPool.map((id,i)=>({uid:'owned-'+i,cardId:id,upgraded:false})),treasures:{},effects:[],queue:['add'],pending:{id:'weighted-choice',kind:'offerRemove',options:['제거한다','제거하지 않는다']},battle:null};
    A4.Game.act(state,user,{type:'choose',token:'weighted-choice',index:2},catalog,1000,'옥랜111');
    const options=user.run.pending.options;assert.equal(options.length,4);assert.equal(new Set(options).size,4);assert.equal(user.run.pending.kind,'add');
    counts[catalog.cards[options[0]].cost]++;
  }
  [4,4,4,4,2,1].forEach((weight,cost)=>{const expected=trials*weight/19;assert.ok(Math.abs(counts[cost]-expected)<expected*0.15,'cost '+cost+': '+counts[cost]+' vs '+expected);});
});

test('weighted reward sampling removes each selected entry and handles pools smaller than three',()=>{
  const list=['cheap','four','five'],weights={cheap:4,four:2,five:1};
  assert.deepEqual(A4.weightedSample(list,3,()=>0,id=>weights[id]),list);
  assert.deepEqual(A4.weightedSample(list,3,()=>0.999,id=>weights[id]),['five','four','cheap']);
  assert.deepEqual(A4.weightedSample(['only'],3,()=>0,()=>1),['only']);
  assert.deepEqual(list,['cheap','four','five']);
});

function memory() {
  const files = {};
  return {files,list:()=>Object.keys(files),read:name=>files[name],writeNewDurable(name,value){ assert.ok(!Object.hasOwn(files,name)); files[name]=value; }};
}
function harness(seed=99) {
  const catalog=fixture(A4), io=memory();
  let store=A4.Store.create(io), app, now=1000, counter=0;
  store.load(A4.newState(seed)); app=A4.App.create(store,catalog);
  return {
    catalog,io,
    get store(){return store;},
    time(value){now=value;},
    call(action,extra={}) {counter++;return app.handle({identity:'alice',name:'Alice',room:'room-one',now:now++,action,...extra});},
    text(text,extra={}) {return app.handle({identity:'alice',name:'Alice',room:'room-one',now:now++,text,...extra});},
    user() {const s=store.getState();return s.users[s.identities['identity:alice']];},
    restart() {store.close();store=A4.Store.create(io);store.load(A4.newState(777));app=A4.App.create(store,catalog);},
    choose(index=1) {const p=this.user().run.pending;return this.call({type:'choose',token:p.id,index});},
    start() {this.call({type:'explore'});return this.choose(1);},
    win() {
      for(let n=0;n<50;n++) {
        const run=this.user().run;
        if(!run || run.phase!=='BATTLE') return;
        const f=run.battle.player;
        let index=f.hand.findIndex(x=>{const d=A4.Combat.describeCard(x,catalog);return d.cost<=f.mana && d.effects.some(e=>e.type==='damage' && e.target!=='self');});
        if(index<0) index=f.hand.findIndex(x=>A4.Combat.describeCard(x,catalog).cost<=f.mana);
        this.call({type:'submit',token:run.turnToken,indices:index<0?[]:[index+1]});
      }
      throw new Error('Synthetic enemy not defeated within 50 turns');
    },
    rewards(policy=()=>1) {let n=0;while(this.user().run?.pending){assert.ok(n++<20);this.choose(policy(this.user().run.pending,this.user().run));}}
  };
}

test('production catalog offers Guff and 105 neutral cards; invalid settings never consume a key',()=>{
  assert.equal(A4.catalog.config.enabled,true);
  assert.equal(A4.catalog.heroes.length,6);assert.equal(A4.catalog.heroes[0].id,'guff');
  assert.equal(A4.catalog.heroes[0].cards.length,10);assert.equal(A4.catalog.cardPool.length,105);
  const h=harness();h.call({type:'inventory'});h.catalog.encounters[7]=[];
  const before=h.store.getState();
  assert.throws(()=>h.call({type:'explore'}),/탐험 설정/);
  assert.deepEqual(h.store.getState(),before);
});

test('unsupported upgrade and passive content fail before the first key is consumed',()=>{
  const h=harness();h.call({type:'inventory'});
  h.catalog.cards.fire.upgrade.effects=[{type:'not-implemented',amount:9}];
  assert.throws(()=>h.call({type:'explore'}),/지원하지 않는 카드 효과/);
  assert.equal(h.user().items.keys,5);assert.equal(h.user().run,null);
});

test('starter selection, battle, reward choices survive restarts with the same RNG and AI plan',()=>{
  const h=harness();h.call({type:'explore'});
  const first=h.user().run.pending;assert.equal(h.user().items.keys,4);
  h.restart();h.call({type:'explore'});
  assert.deepEqual(h.user().run.pending,first);assert.equal(h.user().items.keys,4);
  h.choose();const battle=h.user().run.battle;h.restart();h.call({type:'explore'});
  assert.deepEqual(h.user().run.battle,battle);
  h.win();const reward=h.user().run.pending;
  assert.equal(reward.kind,'treasure');assert.equal(reward.options.length,3);
  h.restart();h.call({type:'explore'});assert.deepEqual(h.user().run.pending,reward);
});

test('card treasure adds a real card; passive treasure never enters card zones',()=>{
  for(const kind of ['low_card','low_hp']) {
    const h=harness();h.start();h.win();h.choose(h.user().run.pending.options.indexOf(kind)+1);
    h.rewards();const run=h.user().run;
    assert.equal(run.phase,'READY');assert.equal(run.deck.length,kind==='low_card'?7:6);
    assert.equal(run.treasures.low,kind);assert.equal(h.user().session,null);
  }
});

test('complete all eight encounters and exact reward stages with every round-seven branch',()=>{
  for(const finalChoice of [1,2,3]) {
    const h=harness(100+finalChoice);h.start();
    const firstKinds={1:'treasure',2:'upgrade',3:'offerRemove',4:'treasure',5:'upgrade',6:'swap',7:'finalEdit'};
    for(let stage=1;stage<=8;stage++) {
      if(stage>1)h.call({type:'explore'});
      assert.equal(h.user().run.battle.turn,0);assert.equal(h.user().run.battle.player.mana,1);
      h.win();
      if(stage===8)break;
      assert.equal(h.user().run.wins,stage);assert.equal(h.user().run.pending.kind,firstKinds[stage]);
      h.rewards((p)=>p.kind==='finalEdit'?finalChoice:p.kind==='swap'?3:1);
      const run=h.user().run;
      assert.equal(run.phase,'READY');assert.equal(h.user().session,null);
      const normal=run.deck.filter(c=>!c.treasureSlot).length;
      if(stage===1)assert.equal(normal,6);
      if(stage===2)assert.equal(normal,8);
      if(stage===3)assert.equal(normal,9);
      if(stage===4)assert.equal(normal,11);
      if(stage===5)assert.equal(normal,13);
      if(stage===6)assert.equal(normal,15);
      if(stage===7)assert.equal(normal,({1:15,2:13,3:17})[finalChoice]);
    }
    const user=h.user();assert.equal(user.run,null);assert.equal(user.lastRun.wins,8);assert.equal(user.lastRun.reason,'clear');
    assert.ok(user.lastRun.reward.gold>=1000 && user.lastRun.reward.gold<=1500);
    assert.equal(user.lastRun.reward.gold%50,0);assert.equal(user.items.keys,5);
    assert.equal(user.gold,10000+user.lastRun.reward.gold);
    assert.throws(()=>h.call({type:'forfeit'}),/진행 중인 탐험/);
  }
});

test('round-six lower-to-higher random replacement and chosen higher replacement preserve uniqueness',()=>{
  for(const swap of [1,2]) {
    const h=harness(600+swap);h.start();
    for(let stage=1;stage<=6;stage++) {
      if(stage>1)h.call({type:'explore'});h.win();
      if(stage<6)h.rewards(p=>p.kind==='treasure' && p.options.includes('low_card')?p.options.indexOf('low_card')+1:1);
    }
    const old=h.user().run.treasures;h.choose(swap);
    if(swap===2) {
      const p=h.user().run.pending;assert.equal(p.kind,'treasure');assert.equal(p.options.length,3);
      assert.ok(!p.options.includes(old.high));h.choose(1);
    }
    h.rewards();const run=h.user().run;
    assert.notEqual(run.treasures.low,run.treasures.high);
    if(swap===1){assert.equal(h.catalog.treasures[run.treasures.low].tier,'high');assert.equal(run.treasures.high,old.high);}
    else {assert.equal(run.treasures.low,old.low);assert.notEqual(run.treasures.high,old.high);}
    for(const slot of ['low','high'])assert.equal(run.deck.filter(c=>c.treasureSlot===slot).length,h.catalog.treasures[run.treasures[slot]].kind==='card'?1:0);
  }
});

test('timeout ends only the session; +explore restores exact state without extra key',()=>{
  const h=harness();h.start();const before=h.user().run;h.time(100000);
  assert.throws(()=>h.call({type:'submit',token:before.turnToken,indices:[]}),/⚔️ 세션 종료:/);
  h.call({type:'explore'},{room:'another-room'});
  assert.deepEqual(h.user().run,before);assert.equal(h.user().items.keys,4);assert.equal(h.user().session.room,'another-room');
});

test('outdated choice and turn tokens cannot repeat a mutation',()=>{
  const h=harness();h.call({type:'explore'});const p=h.user().run.pending;h.choose();
  assert.throws(()=>h.call({type:'choose',token:p.id,index:1}),/선택할 보상/);
  const run=h.user().run;h.call({type:'submit',token:run.turnToken,indices:[]});const saved=h.store.getState();
  assert.throws(()=>h.call({type:'submit',token:run.turnToken,indices:[]}),/이전 턴/);
  assert.deepEqual(h.store.getState(),saved);
});

test('message receipt replay does not spend a second key even after terminal settlement',()=>{
  const h=harness();const output=h.call({type:'explore'},{eventId:'room-one:1'});
  h.text('gg',{eventId:'room-one:2'});const saved=h.store.getState();
  assert.equal(h.call({type:'explore'},{eventId:'room-one:1'}),output);
  assert.deepEqual(h.store.getState(),saved);assert.equal(h.user().lastRun.reward.gold,50);
});

test('mandatory card rewards cannot skip; upgrading changes one instance and skips only if no target',()=>{
  const h=harness();h.start();h.win();h.rewards();h.call({type:'explore'});h.win();
  const p=h.user().run.pending;assert.equal(p.kind,'upgrade');const selected=p.options[0];
  h.choose();const run=h.user().run;
  assert.equal(run.deck.filter(c=>c.upgraded).length,1);assert.equal(run.deck.find(c=>c.uid===selected).upgraded,true);
  assert.equal(run.pending.kind,'add');assert.throws(()=>h.choose(0),/선택 번호/);
  assert.equal(new Set(run.pending.options).size,4);
});

test('zero eligible upgrades skip while removal samples physical duplicate copies',()=>{
  const h=harness();h.start();h.win();h.rewards();
  h.store.transact('test-upgrade-all',s=>{const u=s.users[s.identities['identity:alice']];u.run.deck.forEach(c=>{if(!c.treasureSlot)c.upgraded=true;});});
  h.call({type:'explore'});h.win();assert.equal(h.user().run.pending.kind,'add');h.rewards();
  h.store.transact('test-duplicate-deck',s=>{const u=s.users[s.identities['identity:alice']];u.run.deck=u.run.deck.map(c=>c.treasureSlot?c:{...c,cardId:'fire',upgraded:false});});
  h.call({type:'explore'});h.win();h.choose(1);
  const p=h.user().run.pending;assert.equal(p.kind,'remove');assert.equal(p.options.length,4);assert.equal(new Set(p.options).size,4);
});

test('enhancing equipped relic immediately changes ongoing battle, preserves AI and blocks equipment changes',()=>{
  const h=harness();h.call({type:'inventory'});
  h.store.transact('test-grant',s=>{const u=s.users[s.identities['identity:alice']];u.relics.push({uid:'owned',relicId:'relic_damage',level:0});u.equipped=['owned'];});
  h.start();const before=h.user().run.battle;
  assert.throws(()=>h.call({type:'unequip',slot:1}),/装着|장착/);
  h.text('+강화 owned');const token=h.user().pendingEnhancement.id;h.restart();h.text('+강화확인 '+token);
  const battle=h.user().run.battle;
  assert.equal(h.user().relics[0].level,1);assert.equal(battle.player.passives.find(p=>p.type==='damageBonus').amount,2);
  assert.deepEqual(battle.enemyPlan,before.enemyPlan);assert.deepEqual(battle.player.hand,before.player.hand);assert.equal(battle.turn,before.turn);
  assert.throws(()=>h.text('+강화확인 '+token),/이미 처리/);
});

test('upgraded card UI displays new effects even if base flavor text remains',()=>{
  const h=harness();h.catalog.cards.fire.text='피해를 1 줍니다.';
  const output=A4.UI.card({cardId:'fire',upgraded:true},h.catalog);
  assert.match(output,/피해 2/);assert.match(A4.UI.effects([{type:'damage',amount:3,target:'self'}]),/자신 피해 3/);
});

test('stable identity shares all rooms; nickname alone never merges accounts',()=>{
  const h=harness();h.start();const id=h.user().id;
  h.call({type:'inventory'},{room:'room-two',name:'Renamed'});assert.equal(h.user().id,id);assert.equal(h.user().run.wins,0);
  h.call({type:'inventory'},{identity:'bob',name:'Renamed',room:'room-two'});
  const s=h.store.getState();assert.notEqual(s.identities['identity:bob'],id);assert.equal(Object.keys(s.users).length,2);
});

test('cross-room hashes link after the receiving user confirms a four-digit code',()=>{
  const h=harness();h.call({type:'inventory'});h.call({type:'linkCode'});
  const code=Object.keys(h.store.getState().linkCodes)[0];assert.match(code,/^\d{4}$/);
  assert.equal(h.call({type:'linkRequest',code},{identity:'alternate',room:'room-two'}),'Alice의 데이터로 덮어씌울까요? (y/n)');
  const old=h.store.getState().identities['identity:alternate'];assert.notEqual(old,h.user().id);
  h.text('y',{identity:'alternate',room:'room-two'});
  assert.equal(h.store.getState().identities['identity:alternate'],h.user().id);
  assert.equal(h.store.getState().users[old].mergedInto,h.user().id);
  h.call({type:'inventory'},{identity:'alternate',room:'room-two'});assert.equal(h.user().gold,10000);
});

test('dangling identity data is rejected instead of creating a replacement account',()=>{
  const io=memory(), store=A4.Store.create(io), state=A4.newState(1);state.identities['identity:alice']='missing';store.load(state);
  assert.throws(()=>A4.App.create(store,fixture(A4)),/매핑 대상 누락/);assert.deepEqual(store.getState(),state);
});


test('legacy reward elements stay equally frequent despite unequal pool sizes, while holy is half frequency',()=>{
 const c=A4.copy(A4.catalog);c.config.engineVersion=2;c.cardPool=[];delete c.heroes[0].classPool;
 const sizes={FIRE:8,NATURE:40,LIGHTNING:12,ICE:20,HOLY:30},totals={FIRE:0,NATURE:0,LIGHTNING:0,ICE:0,HOLY:0};
 Object.keys(sizes).forEach(el=>{for(let i=0;i<sizes[el];i++){const id='freq-'+el+i;c.cards[id]={name:id,element:el,cost:1,effects:[]};c.cardPool.push(id);}});
 const state=A4.newState(92817),user=A4.Game.newUser(state,'분포',1000,c);user.session={room:'옥랜111',until:61000};
 for(let i=0;i<4500;i++){
   user.run={id:'freq',wins:3,phase:'REWARD',hero:A4.copy(c.heroes[0]),deck:[],treasures:{},effects:[],queue:['add'],pending:{id:'freq-choice',kind:'offerRemove',options:['제거한다','제거하지 않는다']},battle:null};
   A4.Game.act(state,user,{type:'choose',token:'freq-choice',index:2},c,1000,'옥랜111');
   assert.equal(new Set(user.run.pending.options).size,4);
   totals[c.cards[user.run.pending.options[0]].element]++;
 }
 for(const el of ['FIRE','NATURE','LIGHTNING','ICE'])assert.ok(Math.abs(totals[el]-1000)<120,JSON.stringify(totals));
 assert.ok(Math.abs(totals.HOLY-500)<90,JSON.stringify(totals));
});
