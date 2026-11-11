const test=require('node:test'),assert=require('node:assert/strict'),A=require('../../악질봇4.0.0.js');
function fixture(){
 const c=A.copy(A.catalog);let serial=0;c.cards.blank={name:'빈 카드',element:'NEUTRAL',cost:0,effects:[]};
 const card=(name,upgraded=false)=>({uid:'defense-'+(++serial),cardId:A.CardRules.nameToId(name)||name,upgraded});
 const spec=name=>({name,maxHp:100,deck:Array.from({length:20},()=>card('blank'))});
 const b=A.Battle.create(spec('나'),spec('상대'),c,()=>.3);b.phase='MAIN1';b.enemyPlan=[];b.enemyPowerPlan=false;
 function play(name,up=false,side='player'){
  const x=card(name,up),def=A.Battle.describeCard(x,c);b[side].inFlight.push(x);
  b.resolution={queue:[{kind:'card',module:def.module,side,card:x,def}]};A.Battle.process(b,c,()=>.3);assert.equal(b.pendingChoice,null);return x;
 }
 return {b,c,card,play};
}

test('healing-only cards leave neutral generation while Guff gains Forbidden Healing and enemies retain their cards',()=>{
 const c=A.catalog,guff=c.heroes.find(h=>h.id==='guff'),id='class:guff_forbidden_healing';
 assert.equal(c.cardPool.length,108);assert.ok(guff.classPool.includes(id));assert.equal(guff.cards.length,10);
 for(const h of c.heroes.filter(h=>h.id!=='guff'))assert.ok(!h.classPool.includes(id));
 for(const oldId of ['general:금단의 치유술','general:자연의 해독','general:신의 권능: 재생',id]){
  assert.ok(c.cards[oldId]);assert.ok(!c.cardPool.includes(oldId));assert.equal(c.cards[oldId].neutralCard,false);
 }
 const trap=A.Opponents.prepare(A.newState(8),{wins:3},c,'trap_room');
 assert.ok(trap.deck.some(x=>x.cardId==='general:신의 권능: 재생'));
 for(const up of [false,true]){
  const f=fixture();f.b.enemy.hp=20;f.b.enemy.status.poison=7;
  f.play('자연의 해독',up,'enemy');assert.equal(f.b.enemy.hp,up?34:27);assert.equal(f.b.enemy.status.poison,0);
  const g=fixture();g.b.player.hp=10;g.b.player.mana=3;g.play(id,up);
  assert.equal(g.b.player.hp,up?28:22);assert.equal(g.b.player.mana,0);
 }
});

test('converted cards grant armor at both ranks and on both sides without healing',()=>{
 for(const side of ['player','enemy'])for(const up of [false,true])for(const name of ['굽이치는 파도','치유의 손길','풍요','기적같은 성장','접붙이기','안도']){
  const {b,c,card,play}=fixture(),f=b[side],foe=b[side==='player'?'enemy':'player'];
  f.hp=40;f.shield=0;f.hand=[];
  let shield;
  switch(name){
   case '굽이치는 파도':shield=up?8:5;break;
   case '치유의 손길':shield=up?15:10;break;
   case '풍요':shield=up?14:7;break;
   case '기적같은 성장':
    f.hand=Array.from({length:5},()=>card('blank'));
    f.deck=[card('굽이치는 파도'),card('치유의 손길'),card('기적같은 성장'),card('blank')];shield=up?12:6;break;
   case '접붙이기':foe.rest=[card('치유의 손길'),card('기적같은 성장')];shield=up?5:2;break;
   case '안도':shield=5;break;
  }
  const def=A.Battle.describeCard(card(name,up),c),metric=A.AIEvaluation.evaluateCard(def,f,foe,b,c);
  assert.equal(metric.heal,0,name);assert.ok(metric.shield>0,name);
  if(name==='굽이치는 파도')assert.equal(def.cost,1);
  const before=f.hand.length;play(name,up,side);assert.equal(f.hp,40,name);assert.equal(f.shield,shield,name+' '+side+' '+up);
  if(name==='풍요')assert.equal(f.hand.length,before+2);
  if(name==='안도')assert.equal(f.hand.length,before+(up?2:1));
  if(name==='기적같은 성장')assert.equal(f.hand.length,8);
  if(name==='접붙이기'){assert.equal(foe.rest.length,0);assert.equal(foe.excluded.length,2);}
  if(name==='굽이치는 파도')assert.equal(foe.hp,100-shield);
 }
});

test('Relief keeps its damage condition and converted armor works at full health',()=>{
 for(const up of [false,true]){
  const f=fixture();f.b.player.shield=0;f.b.player.hand=[];f.play('치유의 손길',up);
  assert.equal(f.b.player.hp,100);assert.equal(f.b.player.shield,up?15:10);
  const g=fixture();g.b.player.shield=0;g.b.player.hand=[];g.b.player.status.cards.previousDamage=1;g.play('안도',up);
  assert.equal(g.b.player.shield,0);assert.equal(g.b.player.hand.length,0);
 }
});
