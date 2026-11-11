const test=require('node:test');
const assert=require('node:assert/strict');
const A=require('../../악질봇4.0.0.js');
const copy=x=>JSON.parse(JSON.stringify(x));
function setup(){
 const c=copy(A.catalog);let n=0;
 const card=()=>({uid:'discount-'+(++n),cardId:A.CardRules.nameToId('치유의 손길'),upgraded:false});
 const spec=name=>({name,maxHp:100,deck:Array.from({length:8},card)});
 const b=A.Battle.create(spec('나'),spec('상대'),c,()=>0.5);
 b.enemyPlan=[];b.enemyPowerPlan=false;
 const ctx=A.Battle.context(b,c,()=>0.5,{side:'player'},[]);
 return {b,c,ctx,card};
}
for(const zone of ['rest','excluded','deck'])for(const modifier of [{costDelta:-1,costFloor:0},{cost:0},{cost:0,treasureCostRestore:{hasCost:false,cost:null,costDelta:-1,costFloor:0,until:5}}]){
 test('discount clears on '+zone+' '+JSON.stringify(modifier),()=>{
  const {b,c,ctx}=setup();const x=b.player.hand[0];Object.assign(x,modifier);
  ctx.move('player',x.uid,zone);
  assert.equal(A.Battle.describeCard(x,c).cost,2);
  assert.equal(x.treasureCostRestore,undefined);
  ctx.move('player',x.uid,'hand');assert.equal(A.Battle.describeCard(x,c).cost,2);
 });
}
test('discounted payment stays valid until resolution then clears on rest',()=>{
 const {b,c}=setup();const x=b.player.hand[0];x.costDelta=-1;b.player.mana=1;
 A.Battle.submit(b,[x.uid],c,()=>0.5);
 assert.equal(b.player.mana,0);
 assert.equal(A.Battle.describeCard(b.player.rest.find(y=>y.uid===x.uid),c).cost,2);
});
test('deck-applied discount survives draw and save, but clears on later discard',()=>{
 const {b,c,ctx}=setup();const x=b.player.deck[0];x.costDelta=-1;
 ctx.draw('player',1);assert.equal(A.Battle.describeCard(x,c).cost,1);
 const restored=copy(b),fresh=A.Battle.context(restored,c,()=>0.5,{side:'player'},[]);
 assert.equal(A.Battle.describeCard(fresh.find('player',x.uid),c).cost,1);
 fresh.move('player',x.uid,'rest');assert.equal(A.Battle.describeCard(fresh.find('player',x.uid),c).cost,2);
});
test('overflow clears drawn discounts and positive cost modifiers remain intact',()=>{
 const {b,c,ctx,card}=setup();while(b.player.hand.length<8)b.player.hand.push(card());
 const x=b.player.deck[0];ctx.draw('player',1,null,{cost:0});
 assert.ok(b.player.excluded.some(y=>y.uid===x.uid));assert.equal(A.Battle.describeCard(x,c).cost,2);
 const y=b.player.hand[0];y.costDelta=1;ctx.move('player',y.uid,'rest');assert.equal(A.Battle.describeCard(y,c).cost,3);
});
