const test=require('node:test'),assert=require('node:assert/strict'),A=require('../../악질봇4.0.0.js');
function fixture(rng=()=>.2){
 const c=A.copy(A.catalog);c.cards.blank={name:'빈 카드',element:'NEUTRAL',cost:0,effects:[]};let seq=0;
 const card=(id,upgraded=false,extra={})=>Object.assign({uid:'revision-'+(++seq),cardId:id,upgraded},extra);
 const spec=name=>({name,maxHp:200,deck:Array.from({length:30},()=>card('blank'))});let b=A.Battle.create(spec('플레이어'),spec('상대'),c,rng);b.enemyPlan=[];b.enemyPowerPlan=false;
 function job(t){b.resolution={queue:[t]};A.Battle.process(b,c,rng);let guard=0;while(b.pendingChoice){assert.ok(++guard<30);A.Battle.choose(b,0,c,rng);}}
 const ctx=()=>A.Battle.context(b,c,rng,{side:'player'},[]);
 function play(id,up=false,target){const x=card(id,up);b.player.inFlight.push(x);const d=A.Battle.describeCard(x,c);job({kind:'card',module:d.module,side:'player',card:x,def:d,enemyTarget:target||null,paidCost:A.Battle.cardCost(b,'player',x,c)});return x;}
 function summon(extra={}){return A.Minions.summon(ctx(),'enemy',Object.assign({name:'검증 하수인',maxHp:50,skills:[{id:'a',name:'검증 행동',text:'피해 3',effects:[{type:'damage',amount:3}]}]},extra));}
 function event(type,extra={}){job({kind:'event',event:Object.assign({type},extra)});}
 return {get b(){return b;},c,card,play,job,ctx,summon,event,reload(){b=JSON.parse(JSON.stringify(b));}};
}
test('replacement pools exactly match 40 Guff cards, 105 neutral cards and 63 neutral treasures',()=>{
 const c=A.catalog,h=c.heroes.find(h=>h.id==='guff');assert.equal(h.classPool.length,40);assert.equal(new Set(h.classPool).size,40);
 assert.equal(c.cardPool.length,105);assert.equal(c.neutralTreasurePool.length,63);
 for(const id of ['class:guff_snack','class:guff_forbidden_healing'])assert.ok(!h.classPool.includes(id));
 for(const id of ['general:초과 인출','general:이건 내 거야!','general:화염포','general:자연의 해독','general:신의 권능: 재생'])assert.ok(!c.cardPool.includes(id));
 assert.equal(c.treasures.first_aid_kit.classId,'guff');assert.ok(c.neutralTreasurePool.includes('rune_spring'));assert.ok(c.neutralTreasurePool.includes('evasion'));
 assert.deepEqual(c.heroes.filter(h=>h.enabled!==false).map(h=>h.id),['guff']);assert.equal(Object.keys(c.minions).length,0);
});
test('all 40 Guff families execute in both ranks with serializable state',()=>{
 for(const id of A.catalog.heroes[0].classPool)for(const up of [false,true]){
  const f=fixture();f.b.player.maxMana=5;f.b.player.status.awakened=true;f.b.player.hp=100;
  assert.doesNotThrow(()=>f.play(id,up),id+' '+up);assert.doesNotThrow(()=>f.reload());
 }
});
test('enemy-target damage hits the selected minion and leaves opponent-only effects on the owner',()=>{
 const f=fixture(),m=f.summon();f.b.enemy.usedThisTurn=[{card:f.card('general:불길'),def:f.c.cards['general:불길']}];
 f.play('general:소각',false,m.uid);assert.equal(m.hp,46);assert.equal(f.b.enemy.hp,200);
 f.play('class:guff_electric_storm',false,m.uid);assert.equal(m.hp,46);assert.equal(f.b.enemy.hp,190);
 f.play('class:guff_vine_whip');assert.equal(f.b.enemy.hp,184);
});
test('area and random damage include living minions and repeat hits keep their target',()=>{
 const f=fixture(()=>.99),a=f.summon(),b=f.summon();f.b.player.maxMana=3;
 f.play('class:guff_fire_sea');assert.equal(f.b.enemy.hp,188);assert.equal(a.hp,38);assert.equal(b.hp,38);
 f.b.player.maxMana=5;f.b.player.status.awakened=true;f.play('class:guff_ignition',true,a.uid);assert.equal(a.hp,20);assert.equal(b.hp,38);
 f.play('general:연쇄 번개');assert.equal(b.hp,33);
});
test('minions act on their summon turn, cycle skills and never use cards or mana',()=>{
 const f=fixture(),m=f.summon({skills:[{name:'첫 행동',text:'피해 3',effects:[{type:'damage',amount:3}]},{name:'다음 행동',text:'피해 5',effects:[{type:'damage',amount:5}]}]});
 const mana=f.b.enemy.mana,played=f.b.enemy.playedThisTurn;assert.equal(m.preparedSkill.name,'첫 행동');f.event('end');assert.equal(f.b.player.hp,197);assert.equal(m.preparedSkill.name,'다음 행동');
 f.event('end');assert.equal(f.b.player.hp,197);f.b.turn++;f.reload();f.event('end');assert.equal(f.b.player.hp,192);assert.equal(f.b.enemy.mana,mana);assert.equal(f.b.enemy.playedThisTurn,played);
});
test('random intent survives reload, dead minions never act, and their owner remains the victory condition',()=>{
 const f=fixture(()=>.9),m=f.summon({selection:'random',skills:[{name:'A',text:'',effects:[]},{name:'B',text:'',effects:[{type:'damage',amount:7}]}]});
 assert.equal(m.preparedSkill.name,'B');f.reload();assert.equal(f.b.enemy.minions[0].preparedSkill.name,'B');f.b.enemy.minions[0].hp=0;f.event('end');assert.equal(f.b.player.hp,200);assert.equal(f.b.outcome,'ongoing');
});
test('starting companions and summon effects share the same implementation',()=>{
 const f=fixture(),d={name:'검증 동료',maxHp:10,skills:[{name:'행동',text:'피해 2',effects:[{type:'damage',amount:2}]}]};
 const b=A.Battle.create({name:'나',maxHp:100,deck:[]},{name:'적',maxHp:100,deck:[],startingMinions:[d]},f.c,()=>.3);assert.equal(b.enemy.minions.length,1);
 f.job({kind:'effect',side:'enemy',effect:{type:'summonMinion',spec:d}});assert.equal(f.b.enemy.minions.length,1);
});
test('intent, minion conditions, damage attribution and skill encyclopedia are public',()=>{
 const f=fixture(),m=f.summon();f.play('class:guff_spark',false,m.uid);const text=A.BattleUI.summary(f.b,f.c,3);
 assert.match(text,/□ 검증 하수인: ❤️ 50\/50/);assert.match(text,/검증 행동.*준비/);assert.match(text,/취약/);
 f.c.minionSkills.revelation={id:'revelation',name:'계시 스킬',text:'상대의 손에서 카드를 발견합니다.'};
 assert.match(A.UI.render(null,{kind:'encyclopedia',query:'계시 스킬'},f.c,0),/\[🌕\] 계시 스킬 \| 스킬/);
});
test('fire heart adds 25 percentage points to normal vulnerability against body and minions',()=>{
 const f=fixture(),m=f.summon();f.play('class:guff_spark',false,m.uid);f.play('class:guff_fire_heart');f.play('class:guff_vine_whip',false,m.uid);assert.equal(m.hp,40);
 f.play('class:guff_spark');f.play('class:guff_vine_whip');assert.equal(f.b.enemy.hp,190);
});
test('two runes coexist with Spring; replacement expires only the oldest and Barricade retains armor',()=>{
 const f=fixture();f.b.player.treasureIds.push('rune_spring');f.play('class:guff_barricade',true);f.play('class:guff_shade');assert.equal(f.b.player.runes.length,2);
 f.b.player.shield=12;f.job({kind:'phase',op:'clearShields'});assert.equal(f.b.player.shield,12);
 f.play('class:guff_harmony');assert.equal(f.b.player.runes.length,2);assert.ok(!A.GuffRules.hasRune(f.b.player,'barricade'));
 f.job({kind:'phase',op:'clearShields'});assert.equal(f.b.player.shield,0);
});
test('Small Seed triggers on leaving the active rune for rest but not when countered',()=>{
 const f=fixture(),m=f.summon();f.b.player.hand=[];f.play('class:guff_small_seed',true,m.uid);const before=f.b.player.hand.length;
 f.play('class:guff_fire_heart');assert.equal(f.b.player.hand.length,before+3);assert.ok(m.status.cards.effects.some(e=>e.kind==='vulnerable'&&e.until===f.b.turn+4));
});
test('Giant Seed blocks draws through next END; mana-dependent discounts and armor retain precise conditions',()=>{
 const f=fixture();f.b.player.hand=[];f.play('class:guff_giant_seed');assert.equal(f.b.player.hand.length,3);f.play('class:starter_link');assert.equal(f.b.player.hand.length,3);
 f.b.turn++;f.play('class:starter_link');assert.equal(f.b.player.hand.length,3);f.b.turn++;f.play('class:starter_link');assert.equal(f.b.player.hand.length,5);
 const x=f.card('class:guff_eruption');f.b.player.hand=[x];assert.equal(A.Battle.cardCost(f.b,'player',x,f.c),1);f.b.player.heroPowerUsedTurn=f.b.turn;assert.equal(A.Battle.cardCost(f.b,'player',x,f.c),0);
 f.b.player.overloadNext=2;f.b.player.overloadLocked=1;const echo=f.card('class:guff_echo');assert.equal(A.Battle.cardCost(f.b,'player',echo,f.c),0);
});
test('Guff class treasures keep Nurture discounts through rest and restore locked mana',()=>{
 const f=fixture();f.b.player.treasureIds.push('nature_staff');const x=f.card('class:guff_echo');f.b.player.hand=[x];
 f.job({kind:'effect',side:'player',effect:{type:'discountRandomHand',amount:1}});assert.equal(A.Battle.cardCost(f.b,'player',x,f.c),2);
 f.ctx().move('player',x.uid,'rest');f.ctx().move('player',x.uid,'hand');assert.equal(A.Battle.cardCost(f.b,'player',x,f.c),2);
 f.b.player.overloadLocked=1;f.b.player.overloadNext=2;f.b.player.mana=0;f.play('treasure_guff_suppress');assert.equal(f.b.player.mana,1);assert.equal(f.b.enemy.overloadNext,3);
});

function appFixture(){
 const c=A.copy(A.catalog),files={},io={list:()=>Object.keys(files),read:n=>files[n],writeNewDurable(n,v){files[n]=v;}};let store=A.Store.create(io);store.load(A.newState(42));let app=A.App.create(store,c),serial=0;
 const send=text=>app.handle({text,identity:'target-user',name:'테스터',room:'개발123',now:1000+serial,eventId:'target-event-'+(++serial)});
 const user=()=>Object.values(store.getState().users)[0];const mutate=fn=>store.transact('targets',s=>fn(Object.values(s.users)[0].run.battle,Object.values(s.users)[0].run));
 send('+탐험');send('1');send('y');
 mutate(b=>{
  b.enemy.hp=b.enemy.maxHp=100;b.enemyPlan=[];b.enemyPowerPlan=false;b.enemy.mana=0;b.player.mana=5;
  b.player.hand=[1,2,3].map(n=>({uid:'target-card-'+n,cardId:'general:화염구'}));
  const ctx=A.Battle.context(b,c,()=>.3,{side:'enemy'},[]);for(let i=0;i<2;i++)A.Minions.summon(ctx,'enemy',{name:'대상 '+(i+1),maxHp:20,skills:[]});
 });
 return {c,get store(){return store;},send,user,mutate,reload(){store.close();store=A.Store.create(io);store.load(A.newState(42));app=A.App.create(store,c);}};
}
test('11, 22 and 33 reach the owner and two different minions through actual chat submission',()=>{
 const h=appFixture();h.send('11 22 33');const b=h.user().run.battle;assert.equal(b.enemy.hp,96);assert.deepEqual(b.enemy.minions.map(m=>m.hp),[16,16]);
});
test('omitted targets default to owner and invalid or body-only targets reject atomically',()=>{
 const h=appFixture(),before=A.copy(h.user().run.battle);assert.throws(()=>h.send('14'),/대상 번호/);assert.deepEqual(h.user().run.battle,before);
 h.mutate(b=>{b.player.hand[0].cardId='class:guff_electric_storm';});const bodyOnly=A.copy(h.user().run.battle);assert.throws(()=>h.send('12'),/하수인을 대상으로/);assert.deepEqual(h.user().run.battle,bodyOnly);
 h.mutate(b=>{b.player.hand[0].cardId='general:화염구';});h.send('1');assert.equal(h.user().run.battle.enemy.hp,96);assert.deepEqual(h.user().run.battle.enemy.minions.map(m=>m.hp),[20,20]);
});
test('multiple rune slots and minion intent pass durable-state validation and reload',()=>{
 const h=appFixture();h.mutate(b=>{b.player.treasureIds.push('rune_spring');b.player.hand=[{uid:'spring-rune1',cardId:'class:guff_shade'},{uid:'spring-rune2',cardId:'class:guff_barricade',upgraded:true}];b.player.mana=5;});h.send('1 2');assert.equal(h.user().run.battle.player.runes.length,2);assert.equal(A.validateState(h.store.getState()),true);
 const before=A.copy(h.user().run.battle);h.reload();assert.deepEqual(h.user().run.battle,before);
});
test('dying targets do not redirect repeat damage to the owner and dead units are removed from target numbering',()=>{
 const f=fixture(),a=f.summon({maxHp:5}),b=f.summon();f.b.player.maxMana=5;f.b.player.status.awakened=true;f.play('class:guff_ignition',true,a.uid);assert.equal(f.b.enemy.hp,200);assert.deepEqual(A.Minions.targets(f.b,'enemy').map(x=>x.uid),[null,b.uid]);
});
test('maximum-mana increases trigger Life Cycle against every enemy and reflected overload terminates',()=>{
 const f=fixture(),m=f.summon();f.b.player.treasureIds.push('life_cycle','struck_tree');f.b.enemy.treasureIds.push('struck_tree');f.play('class:guff_growth');assert.equal(f.b.enemy.hp,192);assert.equal(m.hp,42);
 f.play('class:guff_bloom');assert.equal(f.b.player.overloadNext,2);assert.equal(f.b.enemy.overloadNext,2);
});

test('Solar watches the chosen minion but its burst still damages the owner',()=>{
 const f=fixture(),m=f.summon();f.b.player.hand=[];f.play('general:태양 작렬',false,m.uid);f.play('class:guff_vine_whip',false,m.uid);assert.equal(f.b.enemy.hp,200);f.play('class:guff_vine_whip',false,m.uid);assert.equal(f.b.enemy.hp,190);assert.equal(f.b.player.hand.length,1);
});
test('minion skill damage uses the minion weakness and is not strengthened by owner card bonuses',()=>{
 const f=fixture(),m=f.summon({skills:[{name:'검증 공격',text:'상대에게 피해를 8 줍니다.',effects:[{type:'damage',amount:8}]}]});
 f.b.enemy.treasureIds.push('archmage_robe');m.status.cards.effects.push({kind:'weakened',from:0,until:3});f.event('end');assert.equal(f.b.player.hp,194);
});
test('paired rune triggers stop independently on replacement and repeated armor gains trigger Blue Heart individually',()=>{
 const f=fixture(()=>.99),m=f.summon();f.b.player.treasureIds.push('rune_spring');f.play('class:guff_blue_heart');f.play('class:guff_barricade');f.b.player.status.awakened=true;f.b.player.maxMana=5;
 f.play('class:guff_root_wall',true);assert.equal(m.hp,32);assert.equal(f.b.player.shield,18);
 f.play('class:guff_shade');assert.ok(!A.GuffRules.hasRune(f.b.player,'blue_heart'));f.play('class:guff_root_wall');assert.equal(m.hp,32);
});
test('a discounted Thick Branch draws twice and a fresh instance retains its normal cost',()=>{
 const f=fixture(),x=f.card('class:guff_thick_branch',false,{costDelta:-1});f.b.player.hand=[x];
 f.b.player.inFlight.push(f.b.player.hand.pop());f.job({kind:'card',module:'guff',side:'player',card:x,def:A.Battle.describeCard(x,f.c),paidCost:1});assert.equal(f.b.player.hand.length,2);
 const fresh=fixture();assert.equal(A.Battle.cardCost(fresh.b,'player',fresh.card('class:guff_thick_branch'),fresh.c),2);
});

test('revised neutral costs, upgraded Ignite and Frozen Buckler match the supplied list',()=>{
 const f=fixture();for(const pair of [['영혼관',1,1],['불안정한 원소',3,2],['연쇄 번개',1,1]]){const d=f.c.cards[A.CardRules.nameToId(pair[0])];assert.equal(d.cost,pair[1]);assert.equal(d.upgrade.cost,pair[2]);}
 f.play('general:점화',true);assert.equal(f.b.enemy.hp,194);assert.equal(f.b.player.status.cards.ignite,6);
 for(const up of [false,true]){
  const g=fixture();g.b.player.shield=0;g.play('general:얼어붙은 버클러',up);assert.equal(g.b.player.shield,12);g.b.turn++;g.b.player.shield=0;g.play('class:starter_guard');assert.equal(g.b.player.shield,up?5:0);
 }
});
