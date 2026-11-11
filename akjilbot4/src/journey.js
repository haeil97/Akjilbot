/* Serializable post-battle rewards and tavern. Currency belongs to this run. */
A4.Journey=(function(){
  'use strict';
  function own(run,id){return Object.keys(run.treasures||{}).some(function(k){return run.treasures[k]===id;});}
  function cap(run,c){return (run.maxHp||c.config.playerMaxHpByStage[Math.min(7,run.wins)])||60;}
  function cards(run,c){return run.deck.filter(function(x){var d=c.cards[x.cardId];return d&&d.upgrade&&!x.upgraded&&!d.treasure&&!x.treasureSlot;});}
  function show(state,run,kind,options,extra){run.phase='REWARD';run.pending={id:A4.id(state,'choice-'),kind:kind,options:A4.copy(options),extra:extra||null};}
  function pool(run,c){var hero=c.heroes.filter(function(x){return x.id===run.hero.id;})[0];return (hero&&hero.classPool||run.hero.classPool||[]).filter(function(id){return !!c.cards[id];});}
  function price(run,value){return own(run,'vip_membership')?Math.max(1,value-1):value;}
  function cardPrice(c,id){var d=c.cards[id];return d.shopPrice||Math.min(6,3+Math.max(0,d.cost||0));}
  function add(state,run,id){var x={uid:A4.id(state,'card-'),cardId:id,upgraded:false};run.deck.push(x);return x;}
  function stock(run,c,rng){
    var out=[],privatePool=pool(run,c),ordinary=c.cardPool||[];
    function offer(ids,n,kind){var available=ids.slice();for(var i=0;i<n&&ids.length;i++){if(!available.length)available=ids.slice();var id=A4.pick(available,rng);available.splice(available.indexOf(id),1);out.push({kind:kind,cardId:id,price:price(run,cardPrice(c,id)),sold:false});}}
    offer(privatePool,3,'card');offer(ordinary,2,'card');
    out.push({kind:'remove',price:price(run,3+Math.max(0,run.wins-1)*2),sold:false});
    var health=Math.max(0,Math.min(1,(run.hp===undefined?cap(run,c):run.hp)/cap(run,c)));
    if(rng()<0.15+0.7*(1-health))out.push({kind:'potion',amount:10,price:price(run,4),sold:false});
    if(cards(run,c).length&&rng()<0.15+0.7*health)out.push({kind:'upgrade',price:price(run,5),sold:false});
    return out;
  }
  function next(state,user,c,rng){
    var r=user.run,step,opts;
    while(r.queue.length){step=r.queue.shift();
      if(step==='bundles'){
        var ids=pool(r,c);A4.assert(ids.length,'이 직업의 보상 카드가 아직 없습니다.');opts=[];
        for(var i=0;i<3;i++){var bundle=[];for(var j=0;j<3;j++)bundle.push(A4.pick(ids,rng));opts.push(bundle);}show(state,r,'bundles',opts);return true;
      }
      if(step==='camp'){show(state,r,'camp',['rest','forge']);return true;}
      if(step==='forge'){opts=A4.sample(cards(r,c),3,rng).map(function(x){return x.uid;});if(opts.length){show(state,r,'forge',opts);return true;}continue;}
      if(step==='event'){show(state,r,'event',['continue']);return true;}
      if(step==='tavern'){r.tavern=stock(r,c,rng);return tavern(state,user);}
      if(step==='clear'){r.journeyClear=true;return false;}
      // Treasure milestones retain their existing selection and swap rules.
      r.queue.unshift(step);return false;
    }
    return false;
  }
  function tavern(state,user){var r=user.run;show(state,r,'tavern',r.tavern.map(function(x,i){return {index:i,item:x};}).concat([{leave:true}]));return true;}
  function reward(run,c,rng){
    var missing=1-Math.max(0,Math.min(1,run.hp/cap(run,c))),base=4+Math.floor(rng()*3),bonus=Math.min(5,Math.round(missing*5));
    run.gold=(run.gold||0)+base+bonus;run.lastBattleGold={base:base,bonus:bonus,total:base+bonus};
    run.journeyVersion=2;
    var milestone=run.wins===1?['low']:run.wins===4?['high']:run.wins===6?['swap']:[];
    run.queue=milestone.concat(['bundles','camp','event','tavern']);if(run.wins>=8)run.queue.push('clear');
  }
  function choose(state,user,c,p,picked,rng){
    var r=user.run,x,offer;
    if(p.kind==='bundles'){var offered=[].concat.apply([],p.options);picked.forEach(function(id){add(state,r,id);});A4.Stats.choice(state,offered,picked,c);return true;}
    if(p.kind==='camp'){if(picked==='rest')r.hp=Math.min(cap(r,c),(r.hp===undefined?cap(r,c):r.hp)+10);else r.queue.unshift('forge');return true;}
    if(p.kind==='forge'||p.kind==='shopUpgrade'){x=cards(r,c).filter(function(y){return y.uid===picked;})[0];A4.assert(x,'강화할 수 없는 카드입니다.');x.upgraded=true;if(p.kind==='shopUpgrade')r.queue.unshift('tavernResume');return true;}
    if(p.kind==='shopRemove'){A4.assert(r.deck.some(function(y){return y.uid===picked;}),'덱에 없는 카드입니다.');r.deck=r.deck.filter(function(y){return y.uid!==picked;});r.queue.unshift('tavernResume');return true;}
    if(p.kind==='event')return true;
    if(p.kind==='tavern'){
      if(picked.leave){var interest=Math.min(5,Math.floor((r.gold||0)/10));r.gold+=interest;r.lastInterest=interest;delete r.tavern;return true;}
      offer=r.tavern[picked.index];A4.assert(offer&&!offer.sold,'이미 구매한 물품입니다.');A4.assert((r.gold||0)>=offer.price,'골드가 부족합니다.');
      if(offer.kind==='remove'){A4.assert(r.deck.length>0,'제거할 카드가 없습니다.');show(state,r,'shopRemove',r.deck.map(function(y){return y.uid;}));}
      else if(offer.kind==='upgrade'){var candidates=A4.sample(cards(r,c),3,rng);A4.assert(candidates.length,'강화할 카드가 없습니다.');show(state,r,'shopUpgrade',candidates.map(function(y){return y.uid;}));}
      else if(offer.kind==='potion'){r.hp=Math.min(cap(r,c),r.hp+offer.amount);}
      else add(state,r,offer.cardId);
      r.gold-=offer.price;offer.sold=true;
      if(offer.kind==='card'||offer.kind==='potion')tavern(state,user);
      return 'stay';
    }
    return false;
  }
  function resume(state,user){var r=user.run;if(r.queue[0]==='tavernResume'){r.queue.shift();tavern(state,user);return true;}return false;}
  return {next:next,choose:choose,reward:reward,resume:resume,price:price,cardPrice:cardPrice};
}());
