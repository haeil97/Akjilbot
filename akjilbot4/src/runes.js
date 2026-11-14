/* One public, physical, persistent rune per fighter. Definitions are data only. */
A4.Runes=(function(){
 'use strict';
 function current(f){return (f.runes||[])[0]||null;}
 function capacity(f){return A4.TreasureRules&&A4.TreasureRules.owns(f,'rune_spring')?2:1;}
 function definition(card,c){return card.activeRuneDef||A4.Battle.describeCard(card,c);}
 function amount(f,type){var sum=0;(f.runes||[]).forEach(function(x){(x.activeRuneDef&&x.activeRuneDef.runeEffects||[]).forEach(function(e){if(e.type===type)sum+=e.amount||0;});});return sum;}
 function activate(ctx,t){
  var f=ctx.fighter(t.side),card=ctx.find(t.side,t.card.uid);if(!card)return;
  if((f.runes||[]).length>=capacity(f))ctx.move(t.side,f.runes[0].uid,'rest');
  f.runeSerial=(f.runeSerial||0)+1;card.runeActivationId=f.runeSerial;card.activeRuneDef=ctx.copy(t.def);ctx.move(t.side,card.uid,'runes');
  card.runeEnemyTarget=t.enemyTarget||null;
  ctx.emit('runeActivated',{side:t.side,card:card,def:ctx.copy(t.def)});
 }
 function modify(ctx,what,d){
  var f=ctx.fighter(d.side||d.sourceSide||ctx.side);
  if(what==='move'&&d.from==='runes'&&d.to!=='runes'){
   delete d.card.activeRuneDef;delete d.card.runeActivationId;ctx.emit('runeEnded',{side:d.side,card:d.card,to:d.to});
  }
  if(what==='damage'&&d.card&&!d.noBonus)d.value+=amount(ctx.fighter(d.sourceSide),'damageBonus');
  if(what==='heal'&&d.card&&!d.noBonus)d.value+=amount(f,'healBonus');
  if(what==='damageTaken'&&!d.unblockable)d.value=Math.max(0,d.value-amount(f,'damageReduction'));
  if(what==='cardCost')d.value=Math.max(0,d.value+amount(f,'cardCost'));
  if(what==='powerCost')d.value=Math.max(0,d.value+amount(f,'powerCost'));
 }
 function hook(ctx,e){
  ['player','enemy'].forEach(function(side){(ctx.fighter(side).runes||[]).forEach(function(x){
   (definition(x,ctx.catalog).runeTriggers||[]).forEach(function(trigger){
    if(trigger.event!==e.type)return;
    if(e.side&&trigger.side!=='both'&&(trigger.side==='opponent'?e.side===side:e.side!==side))return;
    if(e.card&&e.card.uid===x.uid&&!trigger.includeSelf)return;
    ctx.enqueue({module:'runes',kind:'runeTrigger',side:side,uid:x.uid,activation:x.runeActivationId,effects:ctx.copy(trigger.effects||[]),displaySource:{side:side,label:definition(x,ctx.catalog)}});
   });
  });});
 }
 function run(ctx,t){
  if(t.module!=='runes')return false;
  var x=(ctx.fighter(t.side).runes||[]).filter(function(r){return r.uid===t.uid;})[0];if(!x||t.activation!==undefined&&x.runeActivationId!==t.activation)return true;
  (t.effects||[]).forEach(function(e){ctx.enqueue({kind:'effect',side:t.side,card:ctx.copy(x),effect:e,runeSource:{side:t.side,uid:x.uid,activation:x.runeActivationId}});});return true;
 }
 return {activate:activate,modify:modify,hook:hook,run:run,current:current,definition:definition,amount:amount,capacity:capacity};
}());
