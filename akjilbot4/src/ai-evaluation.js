/* Contextual, rule-based estimates used to order bounded real-engine AI searches.
 * This module never reads an opponent's concealed card identities. All identity
 * reads are either our own zones or the public submission history. No rule is
 * inferred from localized card description text.
 */
A4.AIEvaluation=(function(){
  'use strict';
  var ELEMENTS=['FIRE','NATURE','LIGHTNING','ICE','HOLY','NEUTRAL','COSMIC'];
  var COUNTERS={ICE:'FIRE',FIRE:'NATURE',NATURE:'LIGHTNING',LIGHTNING:'ICE'};
  function number(n,fallback){return typeof n==='number'&&isFinite(n)?n:(fallback||0);}
  function clamp(n,lo,hi){return Math.max(lo,Math.min(hi,n));}
  function count(f,zone){return typeof f[zone+'Count']==='number'?f[zone+'Count']:(f[zone]||[]).length;}
  function status(f){return f.status||{};}
  function cardsState(f){return status(f).cards||{};}
  function active(e,b,turn){turn=turn===undefined?b.turn:turn;return (e.from===undefined||e.from<=turn)&&(e.until===undefined||e.until>=turn);}
  function effects(f,kind,b,turn){return (cardsState(f).effects||[]).filter(function(e){return e.kind===kind&&active(e,b,turn);});}
  function owns(f,id){return (f.treasureIds||[]).indexOf(id)>=0||(f.passives||[]).some(function(p){return p.type==='treasurePassive'&&p.id===id;});}
  function limit(f){return number(f.handLimit,8+(owns(f,'pelgozi_wallet')?3:0));}
  var definitionCache=null;
  function withDefinitionCache(c,fn){var previous=definitionCache;definitionCache={catalog:c,values:{},size:0};try{return fn();}finally{definitionCache=previous;}}
  function definition(x,c){
    var cache=definitionCache&&definitionCache.catalog===c?definitionCache:null,key=cache?JSON.stringify(x):null,d;
    if(cache&&A4.has(cache.values,key))return cache.values[key];
    try{d=A4.Battle.describeCard(x,c);}catch(ignore){d=c.cards[x.cardId]||{};}
    if(cache&&cache.size<2048){cache.values[key]=d;cache.size++;}return d;
  }
  function zoneCount(own,zone,c,predicate){return (own[zone]||[]).reduce(function(n,x){return n+(predicate(definition(x,c),x)?1:0);},0);}
  function wounded(f){return Math.max(0,number(f.maxHp)-number(f.hp));}
  function timeWeight(b){return b.turn>=19?0.68:b.turn>=14?0.8:1;}
  // Permanent scaling outlives the planner's short simulation horizon. Value
  // each stack in both candidate ranking and the resulting board position.
  function cosmicStackValue(f,b){return (10+Math.min(6,(count(f,'hand')+count(f,'deck')+count(f,'rest'))*0.3))*timeWeight(b);}
  function damageBonus(own,def){return (status(own).cosmicBonus||0)+((status(own).classes||{}).powerBonus||0)+(A4.Classes?A4.Classes.alive(own,'janalai').length*2:0)+(owns(own,'archmage_robe')?2:0)+(def.element==='LIGHTNING'?(cardsState(own).lightningBonus||0):0);}
  function damageAfter(own,opp,def,n,b,options){
    options=options||{};
    if(n<=0)return 0;
    if(!options.noBonus)n+=damageBonus(own,def);
    if(options.unblockable)return n;
    if(effects(own,'weakened',b).length)n=Math.floor(n*0.75);
    if(effects(opp,'vulnerable',b).length)n=Math.floor(n*(A4.GuffRules&&A4.GuffRules.hasRune(own,'fire_heart')?1.75:1.5));
    if(effects(opp,'immune',b).length||(!options.power&&effects(opp,'immuneCards',b).length&&own!==opp))return 0;
    if(effects(opp,'iceShield',b).length&&def.element!=='LIGHTNING')return 0;
    effects(opp,'flameVeil',b).forEach(function(e){n=Math.max(0,n-number(e.amount));});
    if(n>0&&effects(opp,'damageCap',b).length)n=1;
    return Math.max(0,n);
  }
  function healing(own,n,b,def){
    if(n<=0)return 0;
    n+=def&&def.kind?0:number(status(own).cosmicBonus);
    effects(own,'healScale',b).forEach(function(e){n=Math.floor(n*e.value);});
    return Math.min(wounded(own),Math.max(0,n));
  }
  function evaluateBatch(entries,own,opp,b,c,cost){
    var projected={},metrics=[],ids={},ok=true;
    Object.keys(own).forEach(function(k){projected[k]=own[k];});
    entries.forEach(function(x){ids[x.card.uid]=true;});
    projected.hand=(own.hand||[]).filter(function(x){return !ids[x.uid];});
    projected.status=JSON.parse(JSON.stringify(own.status||{}));
    projected.status.cards=projected.status.cards||{effects:[]};projected.status.cards.effects=projected.status.cards.effects||[];
    projected.mana=Math.max(0,number(own.mana)-cost);projected.aiPaidBatch=true;projected.playedThisTurn=number(own.playedThisTurn)+entries.length;
    // Submitted cards are removed together. Later projected draws have no known
    // identity, so they cannot change these held-card aura counts.
    var auras={damage:0,draw:0,heal:0,positiveCost:0};
    projected.hand.forEach(function(x){var d=definition(x,c);if(d.rule==='신의 권능: 징벌')auras.damage++;if(d.rule==='신의 권능: 성역')auras.draw++;if(d.rule==='신의 권능: 재생')auras.heal++;if(d.cost>0)auras.positiveCost++;});
    function covering(kind,until){return effects(projected,kind,b).some(function(e){return e.until===undefined||e.until>=until;});}
    function cycling(def,paid){
      var value=0,ts=projected.status.treasures||{};
      if(ts.escapeTurn===b.turn&&count(projected,'deck')+count(projected,'rest'))value+=2;
      if(owns(projected,'antarctic_clock')&&paid===0)value+=damageAfter(projected,opp,{element:'NEUTRAL'},4,b,{noBonus:true,power:true})*1.25;
      if(owns(projected,'philosopher_stone')&&paid>=2)value+=auras.positiveCost*0.8;
      if(owns(projected,'twin_ring')){
        projected.status.treasures=projected.status.treasures||{};ts=projected.status.treasures;
        if(ts.elementCountsTurn!==b.turn){ts.elementCountsTurn=b.turn;ts.elementCounts={};}
        var prior=(ts.elementCounts||{})[def.element]||0;ts.elementCounts=ts.elementCounts||{};ts.elementCounts[def.element]=prior+1;
        if(prior===1&&ts.twinTurn!==b.turn&&count(projected,'deck')+count(projected,'rest')){value+=2;ts.twinTurn=b.turn;}
      }
      value+=auras.damage*5;
      value+=auras.draw*2;
      value+=auras.heal*Math.min(5,wounded(projected))*0.8;
      return value;
    }
    entries.forEach(function(x){
      var def=x.def,rule=def.rule||def.name,kind=null,until=b.turn,paid=number(x.paidCost,def.cost),extra=cycling(def,paid),redundant=false;
      var cycleHeal=Math.min(wounded(projected),auras.heal*5);
      if(rule==='얼음 방패'){kind='iceShield';until=b.turn+1;}
      if(rule==='확고한 알리바이'){kind='damageCap';until=b.turn+2;}
      if(rule==='불굴'){kind=def.upgraded?'immune':'immuneCards';}
      if(kind){
        redundant=covering(kind,until)||(kind==='immuneCards'&&(covering('immune',until)||entries.some(function(y){return y!==x&&y.def.rule==='불굴'&&y.def.upgraded;})));
        if(redundant&&extra<=0)ok=false;
      }
      projected.aiRemainingHand=projected.hand.length;
      var m=evaluateCard(def,projected,opp,b,c);m.score+=extra;metrics.push(m);
      if(rule==='boo_ghost_raider'&&m.damage<12)ok=false;
      if(rule==='salvation_prayer'&&projected.heroPower&&projected.heroPower.id==='yuumi'&&healing(opp,5,b,def)>0)projected.status.yuumiHealTurn=b.turn;
      if(rule==='금단의 불꽃'){
        var counter=(opp.knownSubmissionTurn===b.turn&&opp.knownSubmissionPhase===b.phase?opp.knownSubmission||[]:[]).some(function(d){return COUNTERS[def.element]===d.element||((def.overpower||d.unstable)&&def.element===d.element);});
        if(projected.mana<=0&&damageBonus(projected,def)<=0&&extra<=0&&!counter)ok=false;
        projected.mana=0;
      }else if(rule==='겨울의 뿔피리')projected.mana=Math.max(projected.mana,Math.min(number(projected.maxMana),projected.mana+m.mana));
      else if(m.mana)projected.mana=Math.min(5,projected.mana+m.mana);
      if(kind&&!redundant)projected.status.cards.effects.push({kind:kind,from:b.turn,until:until,amount:1});
      if(m.fatigueDamage){var nextFoe={};Object.keys(opp).forEach(function(k){nextFoe[k]=opp[k];});nextFoe.fatigueExtra=(opp.fatigueExtra||0)+1;opp=nextFoe;}
      projected.hp=Math.min(number(projected.maxHp),number(projected.hp)+m.heal+cycleHeal);
      // Track occupied draw slots without inventing or inspecting hidden card identities.
      for(var i=0;i<Math.floor(m.draw)&&projected.hand.length<limit(projected);i++)projected.hand.push({cardId:'ai-projected-draw',uid:'ai-projected-'+metrics.length+'-'+i});
    });
    return {allowed:ok,metrics:metrics,mana:projected.mana};
  }
  function prayerPolicy(def,own,opp,b,c){
    var selfHeal=healing(own,5,b,def),otherHeal=healing(opp,5,b,def);
    var canDraw=status(own).yuumiHealTurn!==b.turn&&otherHeal>0&&count(own,'deck')+count(own,'rest')>0&&count(own,'hand')-1<limit(own);
    var reflected=selfHeal>0&&zoneCount(own,'hand',c,function(d){return d.rule==='신의 권능: 응징';})>0;
    var urgent=!reflected&&selfHeal>0&&(number(own.hp)<=Math.max(8,number(own.maxHp)*0.3)||number(status(own).poison)>=number(own.hp));
    return {allowed:canDraw||urgent||reflected,bonus:canDraw?3:0,draw:canDraw?1:0,selfHeal:reflected?0:selfHeal,otherHeal:otherHeal};
  }
  function generic(def,m){
    (def.effects||[]).forEach(function(e){
      var a=number(e.amount),p=e.critical?0.25:1;
      if(e.type==='damage'){if(e.target==='self')m.selfDamage+=a*p;else m.damage+=a*p;}
      else if(e.type==='randomDamage')m.damage+=(number(e.min)+number(e.max))*0.5*p;
      else if(e.type==='heal'){m.heal+=a;if(e.target==='both')m.value-=a*0.65;}
      else if(e.type==='draw'){if(e.target==='opponent')m.value-=a*1.8;else m.draw+=a;}
      else if(e.type==='shield')m.shield+=a;
      else if(e.type==='overload')m.overload+=a;
      else if(e.type==='mana')m.mana+=a;
      else if(e.type==='growMana')m.value+=a*7;
      else if(e.type==='scheduledDamage')m.delayedDamage+=a*number(e.turns,1)*0.72;
      else if(e.type==='lockCards')m.control+=4*p;
      else if(e.type==='foresight')m.value+=2.2;
      else if(e.type==='generate')m.draw+=a||1;
      else if(e.type==='dredge')m.draw+=0.8;
    });
    if(def.ai){['damage','heal','draw','shield','control','value'].forEach(function(k){if(!m[k])m[k]=number(def.ai[k]);});}
  }
  function evaluateCard(def,own,opp,b,c){
    if(A4.AI)A4.AI.checkDeadline();
    b=b||{turn:0,phase:'MAIN1'};c=c||A4.catalog;own=own||{};opp=opp||{};
    if(def.rule==='talentPower'&&def.cardId){var converted=JSON.parse(JSON.stringify(definition({cardId:def.cardId,upgraded:true},c)));converted.cost=def.cost;converted.kind='active';return evaluateCard(converted,own,opp,b,c);}
    var r=def.rule||def.id||def.name,up=!!def.upgraded,m={damage:0,selfDamage:0,heal:0,shield:0,draw:0,control:0,value:0,mana:0,overload:0,delayedDamage:0,priority:0,score:0},
      st=cardsState(own),os=status(own),ps=status(opp),h=count(own,'hand'),rest=count(own,'rest'),deck=count(own,'deck'),enemyHand=count(opp,'hand'),enemyRest=count(opp,'rest'),
      phase1=b.phase==='MAIN1',available=Math.max(0,limit(own)-h+(own.aiPaidBatch?0:1)),crit=number(own.aiCounterChance,0.25),i,n,holy,remaining=Math.max(0,number(own.aiRemainingHand,h-1));
    switch(r){
    case '제독':case '전이':
      var ownerSide=own===b.enemy?'enemy':'player',harmBattle={turn:b.turn,scheduled:b.scheduled||[]};harmBattle[ownerSide]=own;harmBattle[ownerSide==='enemy'?'player':'enemy']=opp;
      var harmful=A4.CardRules&&A4.CardRules.harmfulEffects?A4.CardRules.harmfulEffects(harmBattle,ownerSide):[];
      var poison=number(os.poison),otherHarmful=harmful.filter(function(x){return x.type!=='poison';}).length;
      m.cleanseAllowed=poison>=3||otherHarmful>0;
      m.cleanseBonus=poison>=5?3:0;
      m.value=poison*(poison>=5?1.5:0.5)+otherHarmful*2+m.cleanseBonus;
      if(r==='제독')m.draw=harmful.length;else {m.delayedDamage=poison*(poison>=5?2:0.5);m.control=otherHarmful*2;}
      break;
    case '자연의 해독':m.cleanseAllowed=number(os.poison)>=3;m.cleanseBonus=number(os.poison)>=5?3:0;m.draw=1;m.heal=number(os.poison)*(up?2:1);m.value=number(os.poison)*(number(os.poison)>=5?1.5:0.5)+m.cleanseBonus;break;
    case '씨뿌리기':if(number(ps.poison)>0){m.damage=number(ps.poison)*(number(ps.poison)+1)/2;m.poisonDetonation=true;}else m.delayedDamage=(up?4:3)*2;break;
    case '맹독':m.delayedDamage=(up?4:3)*2;break;
    case '독버섯':m.delayedDamage=(up?7:5)*2;m.value=enemyHand?number(ps.poison)*0.5:0;break;
    case '차오르는 독':m.delayedDamage=((up?3:2)+(ps.poison>0?2:0))*2;break;
    case '독사과':m.heal=up?18:12;m.value=-6;break;
    case '궁극의 역병':m.damage=5;m.draw=5;m.shield=5;m.delayedDamage=10;break;
    case '하늘의 선물':m.draw=Math.max(0,6-remaining);m.value=up?0:-Math.max(0,6-enemyHand)*1.5;break;
    case '마법공학: 아틀라스':m.holdValue=4;m.value=-7;break;
    case 'shaladrassil':m.value=['hand','deck','rest'].reduce(function(n,z){return n+zoneCount(own,z,c,function(d,x){return !x.upgraded&&!!d.upgrade&&!d.treasure;});},0)*1.5;break;
    case '과열':if(remaining===0){m.draw=up?3:2;m.mana=up?3:2;}else m.value=-1; m.priority=5;break;
    case '불길':m.draw=Math.min(up?2:1,zoneCount(own,'deck',c,function(d){return d.element==='FIRE';})+(deck?0:zoneCount(own,'rest',c,function(d){return d.element==='FIRE';})));break;
    case '벼려내기':m.damage=up?8:4;m.draw=up?2:1;m.value+=phase1?0.4:-0.5;break;
    case '금단의 불꽃':m.damage=Math.max(0,number(own.mana)-(own.aiPaidBatch?0:number(def.cost)))*(up?6:4);m.priority=9;break;
    case '화염구':m.damage=up?6:4;m.draw=1;break;
    case '마나 연소':m.control=Math.min(number(opp.maxMana,1),up?2:1)*2.7;break;
    case '소각':m.damage=up?8:4;m.control=Math.min((opp.usedThisTurn||[]).filter(function(x){return !x.free;}).length,up?Infinity:1)*1.3;break;
    case '작열통':m.damage=up?10:6;m.control=(up?3:1.8)*(wounded(opp)>0?1.2:0.7);break;
    case '영혼관':m.draw=3;m.value+=up?0:(phase1?0.5:-1.3);break;
    case '불장난':m.damage=up?6:4;m.draw=0.7;break;
    case '태양 작렬':m.delayedDamage=(up?15:10)*0.42;break;
    case '화염 장막':m.shield=up?8:5;m.delayedDamage=up?5:3;break;
    case '점화':m.damage=(up?6:5)+number(st.ignite);m.value=(up?6:5)*0.55*timeWeight(b);break;
    case '폭발의 룬':m.damage=(up?8:4)+(up?12:6)*crit;m.control=2*crit;break;
    case '절멸':m.selfDamage=up?0:5;m.control=enemyHand?4.8:0;break;
    case '백드래프트':m.damage=deck;break;
    case '번아웃':m.control=enemyHand*(up?0.6:0.35);break;
    case '화염 제단':m.value=effects(own,'fireOverpower',b).length?0:(zoneCount(own,'hand',c,function(d){return d.element==='FIRE';})+zoneCount(own,'deck',c,function(d){return d.element==='FIRE';})*0.35)*1.8;break;
    case '불안정한 원소':m.draw=deck;m.value-=Math.max(0,deck-available)*0.12;break;
    case '불덩이 작렬':m.damage=up?50:30;break;
    case '서리꽃':m.control=number(opp.deckCount,6)<=8?2.5:1.4;break;
    case '겨울의 뿔피리':m.mana=Math.min(up?3:2,Math.max(0,number(own.maxMana)-number(own.mana)+(own.aiPaidBatch?0:number(def.cost))));m.priority=8;break;
    case '모사':m.draw=h>1?(up?2:1):0;break;
    case '얼음 방패':m.shield=effects(own,'iceShield',b).some(function(e){return e.until===undefined||e.until>=b.turn+1;})?0:number(opp.mana)*3+2;m.value=m.shield?1:-2;break;
    case '확고한 알리바이':m.shield=effects(own,'damageCap',b).some(function(e){return e.until===undefined||e.until>=b.turn+2;})?0:number(opp.maxMana,1)*5+2;m.value=m.shield?1:-3;break;
    case '대 한파':m.draw=1;m.control=phase1?(enemyHand-h)*0.8:0;m.value+=phase1&&remaining===0?1:0;break;
    case '완전 빙결':m.draw=(up?3:2)*0.78;break;
    case '되감기':m.damage=up?4:2;m.value=rest?4.5:0;break;
    case '급속 빙결':m.damage=up?5:3;m.control=4.8*crit;break;
    case '얼음 덫':m.control=(up?4.5:2.8)*Math.min(1,enemyHand/2);break;
    case '얼어붙은 버클러':m.shield=12;if(!up)m.value-=1;break;
    case '냉동 캡슐':m.delayedDamage=Math.min(number(own.hp)-1,number(opp.maxMana,1)*4)*0.7*(up?2:1);break;
    case '서리 저주':m.control=enemyHand<8?2.5:0;break;
    case '동면':m.control=enemyHand?(up?4:2.4):0;break;
    case '북부 항해':m.draw=deck?1:0;m.control=zoneCount(own,'deck',c,function(d){return d.element==='ICE';})?2.2:0;break;
    case '얼음 거울':m.damage=up?5:3;m.control=(up?7:4)*crit;break;
    case '발굴':m.draw=Math.min(rest,up?2:1);m.value=m.draw?0.5:0;break;
    case '얼음 회오리':m.control=enemyHand?4.7:1.3;break;
    case '심해 저주':m.delayedDamage=enemyHand<8?(up?8:5):0;m.control=1;break;
    case '칼바람':m.control=enemyHand>0?4:0;break;
    case '번개 개화':m.mana=2;m.overload=up?1:2;break;
    case '수중 동물 변신':m.draw=deck?0.85:0;m.value=deck?0.5:0;break;
    case '살아 움직이는 숲':m.value=effects(own,'forest',b).length?1:5;m.selfDamage=1.2;m.control=1.5;break;
    case '초고속':m.draw=up?2:1;m.value=2.5;break;
    case '재생':m.heal=up?5:3;m.value=Math.min(wounded(own),up?5:3)*0.4;break;
    case '이슬 절차':m.value=(Math.max(0,limit(own)-h)-Math.max(0,8-enemyHand))*0.8;break;
    case '광합성':m.draw=up?3:2;break;
    case '산사태':m.damage=up?8:4;m.draw=zoneCount(own,'hand',c,function(d){return d.cost>=2;})?1:0;break;
    case '등산용 간식':m.value=Math.min(1,Math.max(0,5-number(own.maxMana)+number(own.overloadNext)))*1.8*(up?1.72:1);break;
    case '왕성한 진균':m.draw=3*(deck?1-zoneCount(own,'deck',c,function(d){return d.element==='FIRE';})/deck:0.7);break;
    case '흡수':m.damage=up?6:4;m.draw=crit*(up?2:1);break;
    case '급속 성장':if(number(own.maxMana)<5)m.value=(5-number(own.maxMana))*1.1+5*timeWeight(b);else m.draw=up?2:1;break;
    case '치유의 손길':m.shield=up?15:10;break;
    case '먹음직스러운 덥석멜론':for(i=2;i<=5;i++)if(zoneCount(own,'deck',c,function(d){return d.cost===i;}))m.draw++;break;
    case '풍요':m.shield=up?14:7;m.draw=2;break;
    case '굽이치는 파도':m.damage=up?8:5;m.shield=damageAfter(own,opp,def,m.damage,b);break;
    case '기적같은 성장':m.draw=available;m.shield=available*(up?4:2);break;
    case '자연화':m.control=enemyHand?6:0;m.value-=Math.min(up?1:2,Math.max(0,8-enemyHand))*1.2;break;
    case '폭풍 인도기':m.value=zoneCount(own,'deck',c,function(d,x){return !x.upgraded&&!d.treasure&&!d.exclusive&&!d.token;})*(up?1.5:1.1);break;
    case '접붙이기':m.shield=enemyRest*(up?1.6:0.8);m.control=enemyRest*0.7;break;
    case '찌릿!':m.damage=up?5:3;m.draw=zoneCount(own,'hand',c,function(d){return d.element==='LIGHTNING';})>1?1:0;break;
    case '선조의 지혜':m.overload=1;m.draw=up?3:2;break;
    case '부스터 팩':m.draw=3;m.value=up?2:0.7;break;
    case '초과 인출':m.draw=number(own.overloadNext)+number(own.overloadLocked);m.value=number(own.overloadNext)*2;m.mana=number(own.overloadLocked);break;
    case '전선':if(up)m.value=4.5;else m.draw=1.15;break;
    case '믹스테이프':m.draw=count(opp,'deck')?1:0;m.value=up&&m.draw?1:0;break;
    case '전류 공급':m.draw=1;m.value=(number(st.currentStacks)>=1?3:1.4)*timeWeight(b);break;
    case '긴급 차단':m.draw=enemyHand?1:0;m.control=enemyHand?(up?2.5:1):0;break;
    case '천둥':m.delayedDamage=3*(up?5:3)*0.78;break;
    case '파지직':m.overload=1;m.damage=up?16:8;break;
    case '마비':m.control=Math.min(4,(opp.usedThisTurn||[]).filter(function(x){return !x.free;}).length)*2;break;
    case '단락':m.draw=deck?Math.min(3,Math.max.apply(Math,(own.deck||[]).map(function(x){return number(definition(x,c).cost);} ).concat([0]))):0;m.value-=0.4;break;
    case '무덤의 지명자':m.draw=up&&enemyRest?1:0;m.control=enemyRest?1.4:0;break;
    case '충전':m.value=zoneCount(own,'hand',c,function(d,x){return !x.upgraded&&!d.treasure&&!d.exclusive&&!d.token;})*1.6+1;break;
    case '번개':m.control=enemyHand?2:0;m.value-=own.hp>opp.hp?0:1;break;
    case '연쇄 번개':m.damage=5*Math.max(1,number(st.lightningStreak,1)+(st.lightningLastTurn===b.turn-1?1:0));m.hits=Math.max(1,Math.round(m.damage/5));m.draw=up?1:0;break;
    case '마법공학: 퓨즈':m.holdValue=3.5;m.value=-7;break;
    case '마법공학: 니비루':m.holdValue=2.8;m.value=-7;break;
    case '고철 더미에서':if((own.lastTurnCards||[]).some(function(x){return !x.free&&(x.def?x.def.element:definition(x.card||x,c).element)==='LIGHTNING';}))m.draw=up?2.5:1.8;break;
    case '두꺼비집':m.control=zoneCount(own,'hand',c,function(d){return d.element==='NATURE';})*1.6+1;break;
    case '기도':m.draw=up?2:1;m.value=0.5;break;
    case '윤회':m.draw=up?2:1;m.value=deck>2?1:0;break;
    case '운명':m.value=5.5;break;
    case '예지':m.draw=zoneCount(own,'deck',c,function(d){return d.cost===3;})?1:0;m.value=m.draw&&up?0.6:0;break;
    case '안도':if(!number(st.previousDamage)){m.draw=up?2:1;m.shield=4;}break;
    case '심판':holy=zoneCount(own,'rest',c,function(d){return d.element==='HOLY';});m.damage=holy*(up?3:2);break;
    case '계시':m.control=enemyHand?(up?4:2.5):0;m.draw=enemyHand?0.5:0;break;
    case '배교':m.damage=(up?6:3)+(up?6:3)*crit;break;
    case '황금궤':m.draw=up?1.2:0.7;break;
    case '필연':m.value=(up?3:2)*3.8;break;
    case '불굴':m.shield=number(opp.mana)*3+1;m.value+=number(own.hp)<8?2:0;break;
    case '성전':m.draw=1;holy=zoneCount(own,'hand',c,function(d){return d.element==='HOLY';});m.control=(holy-Math.max(0,h-holy))*0.6+2;break;
    case '성지순례':m.delayedDamage=(up?3:2)*4*timeWeight(b);break;
    case '축성':m.draw=1;m.value=Math.min(5,zoneCount(own,'rest',c,function(d,x){return !x.upgraded&&!d.treasure&&!d.exclusive&&!d.token;}))*1.25;break;
    case '신의 권능: 가속':m.holdValue=2+Math.min(3,h*0.45);m.value=-m.holdValue;break;
    case '신의 권능: 재생':m.holdValue=wounded(own)?5:1;m.heal=5;break;
    case '신의 권능: 징벌':m.holdValue=6;m.damage=5;break;
    case '신의 권능: 성역':m.holdValue=h<7?4:1;m.draw=up?1:0;break;
    case '신의 권능: 응징':m.holdValue=2;break;
    case '넘치는 마나':m.draw=up?2:1;break;
    case '혹한':m.value=1.8;break;
    case '고드름':m.value=3;break;
    case '저주':m.value=up?9:6;break;
    case 'ban_hammer_triple':m.value=number(ps.warnings)>=2?100:12+number(ps.warnings)*8;break;
    case 'deactivation':m.value=number(os.warnings)*(number(os.warnings)>=2?16:7);break;
    case 'prophecy':case 'starlight_disassembler':m.control=enemyHand?6.5:0;break;
    case 'path_to_salvation':m.value=os.salvation?0:23;break;
    case 'crystal_ball':m.value=-1;m.holdValue=3;break;
    case 'ominous_presence':m.shield=10;m.draw=2;break;
    case 'final_chapter':m.delayedDamage=18*0.72;m.heal=6;m.value=Math.min(12,wounded(own))*0.6;break;
    case 'fiora_weakness_nature':case 'fiora_weakness_ice':case 'fiora_weakness_lightning':case 'fiora_weakness_fire':
      m.draw=zoneCount(own,deck?'deck':'rest',c,function(d){return d.name==='약점 포착';})?1:0;
      if(r==='fiora_weakness_nature')m.heal=10*crit;
      if(r==='fiora_weakness_ice')m.control=enemyHand?4*crit:0;
      if(r==='fiora_weakness_lightning'){m.draw+=enemyRest?crit:0;m.control=enemyRest?crit:0;}
      if(r==='fiora_weakness_fire')m.damage=8*crit;
      break;
    case 'fiora_grand_duel':
      m.draw=Math.min(available,zoneCount(own,'rest',c,function(d){return d.name==='약점 포착';}));m.value=4;break;
    case 'salvation_prayer':
      m.heal=5;m.value=-healing(opp,5,b,def)*0.65;
      if(own.heroPower&&own.heroPower.id==='yuumi'){
        var prayer=prayerPolicy(def,own,opp,b,c);m.prayerAllowed=prayer.allowed;m.prayerBonus=prayer.bonus;m.draw=prayer.draw;m.value+=prayer.bonus;
      }break;
    case 'bramble_root':m.shield=5;m.draw=1;break;
    case 'poisonous_mushroom':m.value=-4;m.draw=1;break;
    case 'zephrys_lamp':m.draw=1;m.value=4;break;
    case 'innate_talent':m.value=5;break;
    case 'infinity_stone':m.damage=Math.floor(number(opp.hp)/2);m.control=Math.floor(number(opp.maxMana)/2)*6+Math.floor(enemyHand/2)*2;break;
    case 'hearthstone':m.value=number(own.hp)<number(own.maxHp)*0.2?12:-20;break;
    case 'mystic_coin':if(phase1)m.mana=1;else m.heal=10;break;
    case 'grave_pick':m.draw=Math.min(3,rest);m.value=m.draw*0.8;break;
    case 'paper_clone':m.draw=h>1?1:0;m.value=phase1&&h>1?2:0;break;
    case 'escape_key':m.draw=Math.min(remaining,deck+rest);m.value-=remaining*1.4;break;
    case 'empty_grail':if(rest>deck)m.heal=20;else m.draw=3;break;
    case 'wonder_wand':m.draw=2;m.value=phase1?3.4:1.6;break;
    case 'thief_hook':m.draw=rest?1:0;m.control=enemyHand?2.5:0;break;
    case 'sealed_reliquary':m.draw=1;m.value=2.2;break;
    case 'cassette':m.draw=(opp.lastTurnCards||[]).length;break;
    case 'exchange_deed':m.value=(enemyHand-remaining)*2;break;
    case 'magic_mirror_card':m.value=opp.heroPower&&own.heroPower&&opp.heroPower.id!==own.heroPower.id?2:0;break;
    case 'tolins_cup':m.draw=deck||rest?available:0;break;
    case 'gambling_box':m.value=Math.min(8,(deck+rest+count(opp,'deck')+enemyRest)*0.3);break;
    case 'full_bag':m.draw=available;break;
    case 'nature_hourglass':m.mana=number(own.maxMana);m.draw=2;m.value=phase1?2:-12;break;
    case 'pickpocket_gloves':m.draw=Math.min(2,enemyHand);m.control=m.draw*2;break;
    case 'nether_portal':m.draw=count(own,'excluded')?1:0;m.value=m.draw?2:0;break;
    case 'horizon_cutter':m.damage=rest*2;break;
    case 'mirage':m.value=phase1?Math.max(0,8-remaining)*1.2:-1;break;
    case 'wish':m.heal=number(own.maxHp);m.draw=available;break;
    case 'destruction_orb':m.control=Math.min(2,enemyHand)*2+(number(opp.maxMana)>0?7:0);break;
    case 'roasting_wand':m.value=(number(own.hp)-number(opp.hp))*0.55;m.volatile=true;break;
    case 'time_warp':m.control=enemyHand?6.5:1.3;break;
    case 'acceleration_boots':m.value=phase1?zoneCount(own,'hand',c,function(d){return d.cost>0;})*2.5:-10;break;
    case 'pikachu':
      var electricShare=0.25,publicDeck=b.publicPlayerDeck;
      if(publicDeck&&publicDeck.length)electricShare=publicDeck.filter(function(x){return definition(x,c).element==='LIGHTNING';}).length/publicDeck.length;
      var electricOverride=effects(opp,'elementOverride',b);if(electricOverride.length)electricShare=electricOverride[electricOverride.length-1].element==='LIGHTNING'?1:0;
      m.damage=zoneCount(own,'hand',c,function(d){return d.element==='LIGHTNING';})+enemyHand*electricShare;break;
    case 'ivysaur':if(number(ps.poison)>0)m.damage=number(ps.poison)*(number(ps.poison)+1)/2;else {m.delayedDamage=3;m.ivysaurOpeningBonus=5;m.value+=m.ivysaurOpeningBonus;}break;
    case 'meltranix':m.control=Math.max(0,enemyHand-2)*1.5;break;
    case 'boo':m.damage=enemyHand?damageAfter(opp,own,{element:'NEUTRAL'},number(opp.mana)*3,b,{noBonus:true,power:true}):0;break;
    case 'boo_ghost_raider':m.damage=(number(own.playedThisTurn)+number(opp.playedThisTurn)+(own.aiPaidBatch?0:1)+(opp.knownSubmissionTurn===b.turn&&opp.knownSubmissionPhase===b.phase?(opp.knownSubmission||[]).length:0))*4;break;
    case 'boo_scare':m.draw=1;m.control=enemyHand?3:0;break;
    case 'poison_powder':m.delayedDamage=Math.max(1,number(opp.drawnCountThisTurn))*1.8;break;
    case 'hanar_truth':m.value=3;m.draw=0.3;break;
    case 'hanar_lie':m.control=enemyHand?4:0;m.draw=enemyHand?0.7:0;break;
    case 'pointing':m.draw=1;m.control=enemyHand?1.7:0;m.value-=1.5;break;
    case 'nurture':m.value=zoneCount(own,'hand',c,function(d){return d.cost>0;})?2:0;break;
    case 'poison_sting':m.delayedDamage=3;break;
    case 'inquiry':m.draw=1;m.value=1;break;
    case 'little_hatchling':m.damage=2;break;
    case 'aviana':m.heal=4;break;
    case 'black_knight':m.control=enemyHand?4:0;break;
    case 'patchwerk':m.heal=Math.max(0,Math.min(100,number(own.hp)*2)-number(own.hp));m.value=Math.max(0,Math.min(100,number(own.maxHp)*2)-number(own.maxHp))*0.3;break;
    case 'brightwing':m.value=4.4;break;
    case 'teemo':m.delayedDamage=9*Math.min(0.85,4/Math.max(4,count(opp,'deck')));break;
    case 'lich_king':m.draw=enemyRest?1:0;m.control=enemyRest?1.1:0;break;
    case 'aurelion_sol':m.value=cosmicStackValue(own,b);break;
    case 'faceless_manipulator':m.control=enemyHand>=8?0.8:0.15;break;
    case 'mida':m.control=Math.min(3,enemyRest)*(count(opp,'deck')<4?2.2:1.1);break;
    case 'plague_doctor':m.value=number(os.baptisms)>=11?40:20+number(os.baptisms)*1.2;m.value-=wounded(opp)*0.1;break;
    case 'extreme_troll':m.draw=zoneCount(own,'deck',c,function(d){return d.element==='ICE';})||(!deck&&zoneCount(own,'rest',c,function(d){return d.element==='ICE';}))?1:0;m.control=count(opp,'deck')?1:0;break;
    default:if(def.module==='guff'&&A4.GuffRules)A4.GuffRules.evaluate(def,m,own,opp,b,c);else if(def.module==='classes'&&A4.Classes)A4.Classes.evaluate(def,m,own,opp,b,c);else if(def.module==='expansion'&&A4.Expansion)A4.Expansion.evaluate(def,m,own,opp,b,c);else generic(def,m);
    }
    // Respect current public protection and scaling. Multiple-hit lightning applies
    // bonuses/caps per hit, just as the executor does.
    n=Math.max(1,m.hits||1);if(!m.fatigueDamage)m.damage=damageAfter(own,opp,def,m.damage/n,b,{noBonus:!!def.kind||!!m.poisonDetonation,power:!!def.kind})*n;
    if(r==='금단의 불꽃'&&!m.damage&&damageBonus(own,def)>0)m.damage=damageAfter(own,opp,def,damageBonus(own,def),b,{noBonus:true});
    m.selfDamage=damageAfter(own,own,def,m.selfDamage,b,{noBonus:!!def.kind,power:!!def.kind});
    if(effects(own,'disarm',b).length)m.shield=0;
    m.fullHealthPenalty=0;
    if(!def.kind&&m.heal>0&&number(own.maxHp)>0&&!wounded(own)&&!zoneCount(own,'hand',c,function(d){return d.rule==='신의 권능: 응징';})){
      m.fullHealthPenalty=(m.damage||m.draw||m.shield||m.control||m.delayedDamage||m.mana||m.value>0)?0.75:3;
    }
    m.heal=healing(own,m.heal,b,def);
    if(m.overload&&owns(own,'lightning_rod'))m.damage+=m.overload*6;
    if(m.delayedDamage>0)m.delayedDamage+=damageBonus(own,def)*1.4;
    if(def.element==='HOLY'&&os.salvation)m.value+=os.salvation.remaining<=4?5:1;
    if(def.element==='HOLY'&&ps.salvation)m.value-=ps.salvation.remaining<=4?7:1;
    if(def.element==='LIGHTNING'&&st.lightningLastTurn!==b.turn)m.value+=number(st.lightningStreak)>=2?1.2:0.3;
    m.draw=Math.min(m.draw,available);
    if(!deck&&!rest&&['부스터 팩','벼려내기','전선','기도','고철 더미에서','grave_pick','pickpocket_gloves','nether_portal','sealed_reliquary','thief_hook','cassette','모사','믹스테이프','긴급 차단','lich_king','paper_clone'].indexOf(r)<0)m.draw=0;
    var urgency=number(own.hp)<8?1.65:number(own.hp)<number(own.maxHp)*0.4?1.35:0.95;
    var manaGain=phase1?Math.min(m.mana,Math.max(0,5-number(own.mana)+number(def.cost))):0;
    m.score=m.damage*1.25-m.selfDamage*urgency*1.3+m.heal*urgency+m.shield*(own.hp<12?0.7:0.36)+m.draw*(phase1?2.2:1.7)+m.control+m.value+m.delayedDamage*0.82+manaGain*2.2-m.overload*1.6;
    m.score-=m.fullHealthPenalty;
    // Repeatable powers keep the hand intact. Prefer this resource advantage
    // early, but only when the power has a useful effect and cards to preserve.
    m.cardSavingBonus=def.kind==='active'&&m.score>0&&h>0?(b.turn<=2?1.2:0.6)*(h<=limit(own)-3?1:0.35):0;

    if(m.damage>=number(opp.hp)+(m.fatigueDamage?0:number(opp.shield))&&m.damage>0)m.score+=45;
    if(m.selfDamage>=number(own.hp)+number(own.shield)&&m.selfDamage>0)m.score-=75;
    if(m.heal||m.shield)m.priority=-4;
    if(m.draw)m.priority=2;
    if(m.mana)m.priority=7;
    if(r==='금단의 불꽃')m.priority=9;
    if(def.unplayable)m.score=-20;
    return m;
  }
  function survivalHp(f){var hp=Math.max(0,number(f.hp));return hp*1.15+Math.min(12,hp)*0.7+Math.min(5,hp)*1.2+Math.min(20,number(f.shield))*0.55+Math.max(0,number(f.shield)-20)*0.22;}
  function statusValue(f,opp,b){
    var v=0,s=status(f),st=cardsState(f),turn=b.turn,hand=count(f,'hand');
    (st.effects||[]).forEach(function(e){
      if(e.until!==undefined&&e.until<turn)return;
      var duration=e.until===undefined?3:Math.min(3,e.until-Math.max(turn,number(e.from,turn))+1),weight=e.from>turn?0.7:1;
      if(e.kind==='immune'||e.kind==='immuneCards'||e.kind==='iceShield')v+=Math.min(10,number(opp.mana)*2.2+2)*weight;
      else if(e.kind==='damageCap')v+=(4+number(opp.maxMana))*weight;
      else if(e.kind==='flameVeil')v+=number(e.amount)*Math.min(3,duration)*0.8;
      else if(e.kind==='pilgrimage')v+=number(e.amount)*3.4*timeWeight(b);
      else if(e.kind==='extraDraw')v+=hand<6?3.1:1;
      else if(e.kind==='fireOverpower')v+=2.5;
      else if(e.kind==='forest')v+=duration*1.7;
      else if(e.kind==='costIncrease')v-=number(e.amount)*Math.min(3,duration)*Math.min(3,hand)*0.75;
      else if(e.kind==='manaBurn')v-=number(e.amount)*2;
      else if(e.kind==='forbiddenElements')v-=Math.min(5,(e.elements||[]).length*1.3)*duration*0.6;
      else if(e.kind==='healScale')v-=wounded(f)>0?(1-number(e.value,1))*2.2:0;
      else if(e.kind==='solar')v-=number(e.burst)*(number(e.amount)>=7?0.7:0.22);
      else if(e.kind==='capsule')v+=number(e.amount)*number(e.multiplier,1)*0.7;
      else if(e.kind==='iceTrap')v-=2.1;
      else if(e.kind==='revelation')v-=1.8;
      else if(e.kind==='nibiruDiscard')v-=Math.min(5,hand);
      else if(e.kind==='elementOverride')v-=1.5;
    });
    (s.cardLocks||[]).forEach(function(e){if(e.until>=turn){var fraction=e.elements?e.elements.length/7:1;v-=fraction*Math.min(6,hand*1.5)*(e.from>turn?0.8:1);}});
    v+=number(st.ignite)*0.52*timeWeight(b)+number(st.lightningBonus)*1.8+number(st.currentStacks)*0.7+number(st.lightningStreak)*0.6;
    v+=number(s.cosmicBonus)*cosmicStackValue(f,b);
    v-=number(s.poison)*2.3;
    v+=number(s.baptisms)*1.8+Math.max(0,number(s.baptisms)-8)*4;
    v-=number(s.warnings)*9+(number(s.warnings)>=2?13:0);
    if(s.salvation){var remaining=Math.max(0,number(s.salvation.remaining));v+=12+Math.max(0,50-remaining)*0.4+25/(remaining+1);}
    if((s.foresightTurns||[]).indexOf(turn)>=0||(s.foresightTurns||[]).indexOf(turn+1)>=0)v+=2.2;
    v-=number(f.overloadNext)*1.8;
    return v;
  }
  function futureValue(b,side,c){
    var value=0,other=side==='enemy'?'player':'enemy';
    (b.scheduled||[]).forEach(function(job){
      if(job.turn<b.turn)return;
      var t=job.task||{},e=t.effect||{},own=b[t.side],opp=b[t.side==='enemy'?'player':'enemy'],n=0,target=t.side,delay=job.turn-b.turn,scale=Math.pow(0.72,delay),d=t.card?definition(t.card,c):{},future={turn:job.turn,phase:job.phase};
      if(!own||!opp)return;
      if(t.op==='damage'||e.type==='damage'){
        target=t.target|| (e.target==='self'?t.side:(t.side==='enemy'?'player':'enemy'));n=number(t.amount,e.amount);n=damageAfter(own,b[target],d,n,future,{power:!t.card,noBonus:!t.card});value+=(target===side?-1:1)*n*1.25*scale;
      }else if(t.op==='heal'||e.type==='heal'){
        n=healing(own,number(t.amount,e.amount),future,d);value+=(t.side===side?1:-1)*n*scale;
      }else if(t.op==='mana'||t.op==='hourglass')value+=(t.side===side?1:-1)*(t.op==='hourglass'?number(own.maxMana)*1.6+3:number(t.amount)*1.4)*scale;
      else if(t.op==='boots')value+=(t.side===side?1:-1)*count(own,'hand')*1.6*scale;
      else if(t.op==='charge')value+=(t.side===side?1:-1)*count(own,'hand')*0.8*scale;
      else if(t.op==='goldenDelivery'||t.op==='nextWaves'||t.op==='returnRest')value+=(t.side===side?1:-1)*1.8*scale;
      else if(t.op==='burnout')value+=(t.owner===side?-1:1)*Math.min(3,count(b[t.owner]||{},'hand'))*0.9*scale;
      else if(t.op==='loseShield')value+=(t.side===side?-1:1)*Math.min(number(own.shield),number(t.amount))*0.45*scale;
    });
    return value;
  }
  function heroPotential(f,opp,b){
    var p=f.heroPower||{},id=p.rule||p.id,value=0;
    if(id==='nurture')value=count(f,'hand')?0.8:0;
    else if(id==='pikachu')value=2.5;
    else if(id==='ivysaur')value=number(status(opp).poison)?Math.min(15,number(status(opp).poison)*1.2):2;
    else if(id==='meltranix')value=Math.max(0,count(opp,'hand')-2)*0.5;
    else if(id==='fiora')value=2.5;
    else if(id==='boo')value=count(opp,'hand')?2:0;
    else if(id==='piranha_plant')value=2;
    else if(id==='hanar')value=2;
    else if(id==='super_minion')value=status(f).inhibitorTriggered?0:3;
    else if(id==='little_hatchling')value=2;
    else if(id==='cannon_minion')value=2.6;
    else if(id==='patchwerk')value=Math.min(10,number(f.hp)*0.17);
    else if(id==='black_knight')value=count(opp,'hand')?2.3:0.7;
    else if(id==='aurelion_sol')value=3.2;
    else if(id==='aviana')value=Math.min(4,wounded(f))*0.35;
    else if(id==='brightwing')value=2.5;
    else if(id==='poison_sting')value=2;
    else if(id==='inquiry')value=2;
    else if(id==='teemo')value=1.8;
    else if(id==='lich_king')value=count(opp,'rest')?2.5:0.5;
    else if(id==='yuumi')value=2;
    else if(id==='antonidas'||id==='trap_room')value=count(f,'hand')<7?3:1;
    else if(id==='extreme_troll')value=2.3;
    else if(id==='mida')value=count(opp,'rest')?1.7:0.5;
    else if(id==='plague_doctor')value=3;
    if(p.kind==='active'&&owns(f,'judge_ring'))value+=1.8;
    return value*timeWeight(b);
  }
  function reserveQuality(f,c){
    // Permanent discounts/upgrades are investments even outside a two-phase
    // horizon. Count only our own reserve unless in an explicitly imagined world.
    var value=0,all=(f.deck||[]).concat(f.rest||[]);
    all.forEach(function(x){
      var d=c.cards[x.cardId]||{},base=number(d.cost),cost=x.cost===undefined?base:number(x.cost);
      cost=Math.max(number(x.costFloor),cost+number(x.costDelta));
      if(x.upgraded&&d.upgrade&&x.revertUpgradeTurn===undefined)value+=0.55;
      if(!x.treasureCostRestore)value+=(base-cost)*0.25;
      if(x.cardId==='ban_hammer_triple')value+=0.7;
      if(x.cardId==='path_to_salvation'&&!status(f).salvation)value+=0.8;
    });
    return value;
  }
  function imaginedBurden(f,b,c,includeHand){
    var deck=f.deck||[],rest=f.rest||[],hand=f.hand||[],harm=0,poison=0;
    deck.concat(rest).forEach(function(x){
      if(x.cardId==='poisonous_mushroom')poison++;
      var d=c.cards[x.cardId]||{};
      if(d.rule==='고드름')harm+=0.35;
      if(d.rule==='저주')harm+=(x.upgraded?5:3)*0.22;
    });
    // Four future draws, with refill and automatic replacement, are a bounded
    // expected value, not knowledge of the sampled draw order.
    harm+=poison*3*Math.min(0.85,4/Math.max(4,deck.length+rest.length))*1.15;
    if(includeHand)hand.forEach(function(x){var d=c.cards[x.cardId]||{};if(d.rule==='저주')harm+=(x.upgraded?5:3)*1.2;if(d.rule==='고드름')harm+=1.5;});
    return harm;
  }
  function position(b,side,c){
    c=c||A4.catalog;var other=side==='enemy'?'player':'enemy',own=b[side],opp=b[other],v=0;
    if(b.outcome==='victory')return side==='player'?100000:-100000;
    if(b.outcome==='defeat')return side==='enemy'?100000:-100000;
    if(b.outcome==='draw')return 0;
    v=survivalHp(own)-survivalHp(opp);
    v+=(own.shrines||[]).reduce(function(sum,a){return sum+a.hp*.85+2;},0)-(opp.shrines||[]).reduce(function(sum,a){return sum+a.hp*.85+2;},0);
    v+=(number(own.maxMana)-number(opp.maxMana))*5.3;
    v+=(number(own.mana)-number(opp.mana))*(b.phase==='MAIN1'?1.65:b.phase==='MAIN2'?1.4:0.15);
    v+=(Math.min(8,count(own,'hand'))-Math.min(8,count(opp,'hand')))*2.25;
    v+=(number(own.maxHp)-number(opp.maxHp))*0.08;
    v+=statusValue(own,opp,b)-statusValue(opp,own,b)+futureValue(b,side,c);
    v+=heroPotential(own,opp,b)-heroPotential(opp,own,b)+reserveQuality(own,c);
    if(b._aiImagined){
      // Synthetic opponent cards were sampled exclusively from public evidence.
      // This branch values new publicly caused deck mutations (e.g. mushrooms)
      // without ever inspecting real concealed opponent card identities.
      v-=reserveQuality(opp,c);
      v+=imaginedBurden(opp,b,c,true)-imaginedBurden(own,b,c,false);
    }
    // Only our own concealed hand is evaluated. The opponent's hand is a count;
    // sampled identities are consumed by the executor, not this static score.
    (own.hand||[]).forEach(function(x){
      var d=definition(x,c),m=evaluateCard(d,own,opp,b,c),cost=number(d.cost),future=clamp(m.score,-8,24)*0.11;
      if(cost>number(own.maxMana))future*=0.4;
      if(x.availableFrom>b.turn)future*=0.65;
      if(d.temporary||x.temporaryUntil!==undefined)future*=b.phase==='MAIN2'?0.3:0.7;
      if(m.holdValue)future+=m.holdValue*0.6;
      if(d.rule==='저주')future-=(x.upgraded?5:3)*1.4;
      if(d.rule==='고드름')future-=1.5;
      if(d.rule==='poisonous_mushroom')future-=1;
      v+=future;
    });
    var supply=count(own,'deck')+count(own,'rest'),enemySupply=count(opp,'deck')+count(opp,'rest');
    v+=(Math.min(24,supply)-Math.min(24,enemySupply))*0.08;
    if(!supply)v-=Math.max(0,4-count(own,'hand'))*1.1;
    if(!enemySupply)v+=Math.max(0,4-count(opp,'hand'))*1.1;
    if(owns(own,'runeterra_codex'))v+=Math.min(2,number(own.mana))*0.65;
    if(owns(opp,'runeterra_codex'))v-=Math.min(2,number(opp.mana))*0.65;
    if(owns(own,'first_aid_kit'))v+=Math.min(3,wounded(own))*0.9;
    if(owns(opp,'first_aid_kit'))v-=Math.min(3,wounded(opp))*0.9;

    // Approaching fatigue makes real health more valuable than shields.
    if(b.turn>=17){var fatigue=b.turn<19?1:1+(b.turn+1-20);v+=(Math.min(number(own.hp),fatigue*3)-Math.min(number(opp.hp),fatigue*3))*0.5+(number(opp.fatigueExtra)-number(own.fatigueExtra))*1.5;}
    return isFinite(v)?v:0;
  }
  function predict(b,c){
    c=c||A4.catalog;var f=b.player||{},elements={},known={},history=(b.publicPlayerHistory||[]).concat(b.history||[]).slice(-48),passes=0,total=0,cards=0;
    ELEMENTS.forEach(function(el){elements[el]=el==='NEUTRAL'||el==='COSMIC'?0.05:0.45;});
    history.forEach(function(h,index){
      var decay=Math.pow(0.92,history.length-1-index),phase=h.phase===b.phase?1.5:0.2,w=decay*phase,list=h.player||[];
      var behaviorWeight=decay*(h.phase===b.phase?1:0.05);
      total+=behaviorWeight;cards+=list.length*behaviorWeight;if(!list.length)passes+=behaviorWeight;
      list.forEach(function(x){var d=c.cards[x.cardId]||{},el=x.element||d.element;if(el)elements[el]=number(elements[el])+w;var key=x.cardId+'|'+(x.upgraded?1:0);if(x.cardId){if(!known[key])known[key]={cardId:x.cardId,upgraded:!!x.upgraded,weight:0};known[key].weight+=w;}});
    });
    // A published hero's starter is a weak prior, never an assertion about a
    // hidden current zone; reward additions and removals remain uncertain.
    if(b.publicPlayerDeck)b.publicPlayerDeck.forEach(function(x){var d=definition(x,c),key=x.cardId+'|'+(x.upgraded?1:0);if(!c.cards[x.cardId])return;elements[d.element]=number(elements[d.element])+0.25;if(!known[key])known[key]={cardId:x.cardId,upgraded:!!x.upgraded,weight:0};known[key].weight+=0.35;});
    (b.publicPlayerDeck?[]:c.heroes||[]).forEach(function(hero){
      if(hero.name===f.heroName||hero.id===f.heroId||(f.heroPower&&hero.power&&f.heroPower.id===hero.power.id)){
        (hero.cards||[]).forEach(function(id){var d=c.cards[id],key=id+'|0';if(!d)return;elements[d.element]=number(elements[d.element])+0.12;if(!known[key])known[key]={cardId:id,upgraded:false,weight:0};known[key].weight+=0.18;});
      }
    });
    var n=count(f,'hand'),mana=number(f.mana),turn=b.turn;
    var overrides=effects(f,'elementOverride',b),forced=overrides.length?overrides[overrides.length-1].element:null;
    var constrained=!!forced||(status(f).cardLocks||[]).some(function(l){return active(l,b);})||effects(f,'forbiddenElements',b).length>0;
    if(forced){var priorTotal=ELEMENTS.reduce(function(sum,el){return sum+elements[el];},0);ELEMENTS.forEach(function(el){elements[el]=el===forced?priorTotal:0;});}
    ELEMENTS.forEach(function(el){
      var blocked=(status(f).cardLocks||[]).some(function(l){return active(l,b)&&(!l.elements||l.elements.indexOf(el)>=0);})||effects(f,'forbiddenElements',b).some(function(e){return (e.elements||[]).indexOf(el)>=0;});
      if(blocked)elements[el]=0;
    });
    var totalElements=ELEMENTS.reduce(function(n,el){return n+elements[el];},0),pass=(passes+0.75)/(total+3),mean=(cards+2)/(total+2);
    if(!n||!totalElements){pass=1;mean=0;}else{if(mana<=0)pass=Math.max(pass,0.8);else if(mana===1)pass=Math.max(pass,0.2);if(b.phase==='MAIN1')pass=Math.max(pass,0.18);mean=Math.min(n,Math.max(0.4,mean),mana+1);}
    ELEMENTS.forEach(function(el){elements[el]=totalElements?elements[el]/totalElements:0;});
    var knownCards=Object.keys(known).map(function(k){return known[k];});
    // Recent MAIN1 expenditures are evidence a type is less likely in MAIN2,
    // but repeated copies / newly drawn cards retain a nonzero probability.
    if(b.phase==='MAIN2')knownCards.forEach(function(x){var spent=history.some(function(h){return h.turn===turn&&h.phase==='MAIN1'&&(h.player||[]).some(function(a){return a.cardId===x.cardId;});});if(spent)x.weight*=0.45;});
    return {elements:elements,passChance:clamp(pass,0,1),meanCards:mean,knownCards:knownCards,historySamples:history.length,phaseSamples:history.filter(function(h){return h.phase===b.phase;}).length,constrained:constrained,forcedElement:forced};
  }
  return {withDefinitionCache:withDefinitionCache,evaluateBatch:evaluateBatch,prayerPolicy:prayerPolicy,evaluateCard:evaluateCard,position:position,predict:predict,damageAfter:damageAfter,healing:healing,owns:owns,count:count};
}());
