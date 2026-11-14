/* Executable rules for the 100 ordinary cards and their four token families.
 * Choices and delayed effects are JSON queue jobs: no callback captures state.
 * All transient mutations live on battle instances, never on the run deck.
 */
A4.CardRules = (function () {
  'use strict';
  var ELEMENTS = ['FIRE','ICE','NATURE','LIGHTNING','HOLY','NEUTRAL'];
  var names = {}, ordinary = [], handled = {};
  function own(o,k) { return Object.prototype.hasOwnProperty.call(o,k); }
  function state(f) { return f.status.cards || (f.status.cards = {effects:[],ignite:0,currentStacks:0,lightningBonus:0,lightningLastTurn:-2,lightningStreak:0,previousDamage:0}); }
  function active(e,b) { return (e.from === undefined || e.from <= b.turn) && (e.until === undefined || e.until >= b.turn); }
  function effects(ctx,side,kind) { return state(ctx.fighter(side)).effects.filter(function(e){return e.kind===kind && active(e,ctx.battle);}); }
  function status(ctx,side,kind,extra) { if(harmfulKinds.indexOf(kind)>=0&&ctx.modify('harmfulEffect',{side:side,kind:kind,cancel:false}).cancel)return null;var e={kind:kind}; if(ctx.task.card){e.name=ctx.def(ctx.task.card).name;e.sourceCard=ctx.copy(ctx.task.card);} Object.keys(extra||{}).forEach(function(k){e[k]=extra[k];}); state(ctx.fighter(side)).effects.push(e); return e; }
  function isGeneral(ctx,c) { var d=ctx.def(c); return !c.noUpgrade && !d.token && !d.treasure && !d.exclusive && !!d.upgrade; }
  function element(ctx,c) { return ctx.def(c).element; }
  function baseName(ctx,c) { return ctx.catalog.cards[c.cardId].name; }
  function pool(ctx,filter,exclude) { return (ctx.catalog.cardPool||ordinary).filter(function(id){return id!==exclude && (!filter || filter(ctx.catalog.cards[id]));}); }
  function option(ctx,id,up) { var d=ctx.catalog.cards[id]; return {cardId:id,upgraded:!!up,name:d.name+(up?'+':''),text:up?d.upgrade.text:d.text}; }
  function randomCard(ctx,side,filter,opts) { var ids=pool(ctx,filter); if(!ids.length)return null; return ctx.generate(side,ctx.pick(ids),opts||{}); }
  function task(ctx,op,extra) { var t={module:'cards',op:op,side:ctx.side,card:ctx.task && ctx.task.card ? ctx.copy(ctx.task.card):null}; Object.keys(extra||{}).forEach(function(k){t[k]=extra[k];}); return t; }
  function later(ctx,turn,phase,op,extra) { ctx.schedule(turn,phase,task(ctx,op,extra)); }
  function draw(ctx,side,n,filter,opts) { return ctx.draw(side,n,filter,opts)||[]; }
  function damage(ctx,side,n,extra) { return ctx.damage(ctx.side,side,n,extra||{}); }
  function lock(ctx,side,from,until,allowed) { if(ctx.modify('harmfulEffect',{side:side,kind:'lock',cancel:false}).cancel)return;var f=ctx.fighter(side); f.status.cardLocks=f.status.cardLocks||[]; var e={from:ctx.battle.turn+from,until:ctx.battle.turn+until,name:ctx.task.card?ctx.def(ctx.task.card).name:'카드 사용 제한'}; if(allowed)e.elements=ELEMENTS.concat(['COSMIC']).filter(function(x){return allowed.indexOf(x)<0;}); f.status.cardLocks.push(e); }
  function discover(ctx,side,options,op,extra,label,zone) {
    if(!options.length)return false;
    ctx.discover(side,options,task(ctx,op,extra),{label:label||'카드를 발견하세요.',sourceZone:zone}); return true;
  }
  function fromZone(ctx,side,owner,zone,op,extra,filter) { var selfId=ctx.task&&ctx.task.card&&ctx.task.card.cardId; var cards=ctx.fighter(owner)[zone].filter(function(c){return c.cardId!==selfId && (!filter || filter(c));}); extra=extra||{}; extra.owner=owner; extra.zone=zone; return discover(ctx,side,cards,op,extra,null,zone); }
  function copyToHand(ctx,side,card,extra) { var c=ctx.copy(card); delete c.uid; delete c.runUid; var opts={upgraded:!!c.upgraded}; Object.keys(c).forEach(function(k){if(k!=='cardId'&&k!=='uid')opts[k]=c[k];}); Object.keys(extra||{}).forEach(function(k){opts[k]=extra[k];}); return ctx.generate(side,c.cardId,opts); }
  function allZones(f) { return f.hand.concat(f.deck,f.rest,f.excluded); }
  function temporaryUntil(ctx) { return ctx.battle.phase==='END'?ctx.battle.turn+1:ctx.battle.turn; }
  function movedToHand(ctx,side,owner,card) { var got=ctx.remove(owner,card.uid); if(got)ctx.add(side,got,'hand'); return got; }
  function costDrop(ctx,card,amount,floor) { if(ctx.def(card).cost===0)return; card.costDelta=(card.costDelta||0)-amount; card.costFloor=floor===undefined?0:floor; }
  function flags(d) {
    d.innate=/선천성/.test(d.text); d.excludeOnUse=/일회용/.test(d.text); d.temporary=/^(?:사용불가[, ]+)?일시적[.,]/.test(d.text);
    d.unstable=/(?:^|[.,]\s*)불안정(?:[.,:\s]|$)/.test(d.text); d.volatile=/(?:^|[.,]\s*)휘발성(?:[.,:\s]|$)/.test(d.text); d.limited=/제한[.,]/.test(d.text); d.unplayable=/^사용불가/.test(d.text); d.overpower=/(?:^|[.,]\s*)압도(?:[.,:\s]|$)/.test(d.text);
    d.main1Only=/메인 페이즈 1에만/.test(d.text);
  }
  var harmfulKinds=['disarm','vulnerable','weakened','manaBurn','healScale','solar','costIncrease','forbiddenElements','elementOverride','iceTrap','revelation','atlasDiscard','fuseDiscard','nibiruDiscard'];
  function harmfulEffects(b,side){
    var f=b[side],s=f.status||{},found=[],groups={},opponent=b[side==='player'?'enemy':'player'];
    function live(e){return e.until===undefined||e.until>=b.turn;}
    if(s.execution>0)found.push({type:'execution',amount:s.execution});
    (f.hand||[]).forEach(function(card){if(card.shockedUntil!==undefined&&card.shockedUntil>=b.turn)found.push({type:'shock',value:card});});
    if(s.poison>0)found.push({type:'poison',amount:s.poison});
    if(f.overloadNext>0||f.overloadLocked>0)found.push({type:'overload'});
    if(s.warnings>0)found.push({type:'warnings',amount:s.warnings});
    (s.cardLocks||[]).forEach(function(e){if(live(e))found.push({type:'lock',value:e});});
    (((s.cards||{}).effects)||[]).forEach(function(e){if(live(e)&&harmfulKinds.indexOf(e.kind)>=0)found.push({type:'effect',value:e});});
    (b.scheduled||[]).forEach(function(e){
      var t=e.task||{},damage=t.op==='damage'||(t.kind==='effect'&&t.effect&&t.effect.type==='damage'),target=t.target||(t.effect&&t.effect.target==='self'?t.side:(t.side==='player'?'enemy':'player'));
      if(e.turn<b.turn||!(damage&&target===side||t.op==='burnout'&&t.owner===side))return;
      var key=(t.card&&t.card.uid||t.displaySource&&t.displaySource.label&&t.displaySource.label.name||'scheduled')+':'+t.side+':'+(t.op||t.effect.type);
      if(!groups[key]){groups[key]={type:'scheduled',values:[]};found.push(groups[key]);}groups[key].values.push(e);
    });
    return found;
  }
  function removeHarmful(ctx,side,target){
    var b=ctx.battle,f=ctx.fighter(side),s=f.status,foe=target?ctx.fighter(target):null,items=harmfulEffects(b,side);
    items.forEach(function(item){var e,copy;
      if(item.type==='execution'){s.execution=0;if(foe)foe.status.execution=(foe.status.execution||0)+item.amount;}
      else if(item.type==='shock'){var until=item.value.shockedUntil;delete item.value.shockedUntil;if(foe){var victim=ctx.pick(foe.hand.filter(function(x){return ctx.cost(target,x)<=foe.maxMana&&A4.Battle.cardAllowed(b,target,ctx.catalog,x);}));if(victim)victim.shockedUntil=until;}}
      else if(item.type==='poison'){s.poison=0;if(foe){foe.status.poison=(foe.status.poison||0)+item.amount;ctx.note('poison',target,item.amount);}}
      else if(item.type==='overload'){
        var next=f.overloadNext||0,locked=f.overloadLocked||0;f.overloadNext=0;f.overloadLocked=0;ctx.mana(side,locked,true);
        if(foe){foe.overloadNext=(foe.overloadNext||0)+next;var added=Math.min(locked,Math.max(0,foe.maxMana-(foe.overloadLocked||0)));foe.overloadLocked=(foe.overloadLocked||0)+added;foe.mana=Math.max(0,foe.mana-added);}
      }else if(item.type==='warnings'){s.warnings=0;if(foe){foe.status.warnings=(foe.status.warnings||0)+item.amount;if(foe.status.warnings>=3)b[target==='player'?'specialDefeat':'specialVictory']=true;}}
      else if(item.type==='lock'){s.cardLocks=s.cardLocks.filter(function(x){return x!==item.value;});if(foe)foe.status.cardLocks.push(ctx.copy(item.value));}
      else if(item.type==='effect'){
        e=item.value;state(f).effects=state(f).effects.filter(function(x){return x!==e;});
        if(foe){copy=ctx.copy(e);if(copy.sourceSide!==undefined)copy.sourceSide=side;
          if(copy.kind==='atlasDiscard'){copy.sourceSide=side;}if(copy.kind==='fuseDiscard')copy.sourceSide=side;
          if(copy.kind==='revelation'){var marked=ctx.pick(foe.hand);copy.uid=marked?marked.uid:null;copy.sourceSide=side;}
          state(foe).effects.push(copy);
        }
      }else if(item.type==='scheduled')item.values.forEach(function(entry){
        b.scheduled=b.scheduled.filter(function(x){return x!==entry;});
        if(foe){copy=ctx.copy(entry);copy.task.side=side;if(copy.task.op==='burnout'){copy.task.owner=target;copy.task.uids=foe.hand.map(function(x){return x.uid;});}else {copy.task.target=target;if(copy.task.effect)copy.task.effect.target='opponent';}b.scheduled.push(copy);}
      });
    });
    if(items.length)ctx.note('text',side,0,{text:target?'해로운 효과 '+items.length+'개를 상대에게 옮깁니다.':'해로운 효과 '+items.length+'개를 없앱니다.'});
    return items.length;
  }
  function install(catalog) {
    ordinary=[]; names={};
    A4.content.generalCards.concat(A4.content.tokens).forEach(function(ref){
      var old=catalog.cards[ref.id], d=A4.copy(ref), u=A4.copy(ref.upgrade);
      delete d.implementationStatus; delete d.sourceLine; delete d.notes;
      d.module='cards'; d.rule=ref.name; d.effects=old?A4.copy(old.effects):[{type:'script',module:'cards',rule:ref.name}];
      flags(d); flags(u); u.module='cards'; u.rule=ref.name;
      u.effects=old&&old.upgrade&&old.upgrade.effects?A4.copy(old.upgrade.effects):old?A4.copy(old.effects):[{type:'script',module:'cards',rule:ref.name}];
      d.upgrade=u; catalog.cards[ref.id]=d; names[ref.name]=ref.id;
      if(!ref.token)ordinary.push(ref.id);
    });
    catalog.cardPool=ordinary.slice();
  }
  function run(ctx,t) {
    var b=ctx.battle, side=t.side, f=ctx.fighter(side), enemy=ctx.other(side), foe=ctx.fighter(enemy), s=state(f),
      card=t.card, def=t.def||(card?ctx.def(card):{}), up=def.upgraded===undefined?!!(card&&card.upgraded):!!def.upgraded, n=def.rule||def.name, now=b.turn,
      list,c,i,count,amount,e,ids,chosen=t.choice;
    ctx.side=side; ctx.self=f; ctx.foe=foe;
    if(t.op) return continuation(ctx,t);
    if(t.module!=='cards' && def.module!=='cards')return false;
    handled[n]=true;
    if(['서리꽃','서리 저주','심해 저주'].indexOf(n)>=0&&ctx.modify('harmfulEffect',{side:enemy,kind:'harmfulCards',cancel:false}).cancel)return true;
    switch(n) {
    case '마법공학: 아틀라스':break;
    case '하늘의 선물':draw(ctx,side,Math.max(0,6-f.hand.length));if(!up)draw(ctx,enemy,Math.max(0,6-foe.hand.length));break;
    case '맹독':ctx.poison(side,enemy,up?4:3);break;
    case '독버섯':ctx.poison(side,enemy,up?7:5);if(t.critical)damage(ctx,enemy,foe.status.poison||0);break;
    case '차오르는 독':ctx.poison(side,enemy,(up?3:2)+(foe.status.poison>0?2:0));break;
    case '독사과':ctx.heal(side,up?18:12);ctx.poison(side,side,3);break;
    case '궁극의 역병':damage(ctx,enemy,5);draw(ctx,side,5);ctx.shield(side,5);ctx.poison(side,enemy,5);break;
    case '제독':amount=removeHarmful(ctx,side);draw(ctx,side,amount);break;
    case '전이':removeHarmful(ctx,side,enemy);break;
    case '자연의 해독':draw(ctx,side,1);ctx.enqueue(task(ctx,'naturalDetox',{upgraded:up}));break;
    case '씨뿌리기':amount=foe.status.poison||0;if(amount){foe.status.poison=0;damage(ctx,enemy,amount*(amount+1)/2,{noBonus:true});}else ctx.poison(side,enemy,up?4:3);break;
    case '과열': if(!f.hand.length){draw(ctx,side,up?3:2);ctx.mana(side,up?3:2);} break;
    case '불길': draw(ctx,side,up?2:1,function(d){return d.element==='FIRE';}); break;
    case '벼려내기': damage(ctx,enemy,up?8:4); for(i=0;i<(up?2:1);i++)randomCard(ctx,side,function(d){return d.element==='FIRE';},{temporaryUntil:temporaryUntil(ctx)}); break;
    case '금단의 불꽃': amount=f.mana;f.mana=0;damage(ctx,enemy,amount*(up?6:4));break;
    case '화염구': draw(ctx,side,1);damage(ctx,enemy,up?6:4);break;
    case '마나 연소': status(ctx,enemy,'manaBurn',{from:now+1,until:now+1,amount:up?2:1});break;
    case '소각':
      damage(ctx,enemy,up?8:4); list=(foe.usedThisTurn||[]).filter(function(x){return !x.free;});
      list=up?list:ctx.sample(list,1);list.forEach(function(x){var p=x.card||x;if(p.uid&&ctx.find(enemy,p.uid))ctx.move(enemy,p.uid,'excluded',{logEffect:true});});break;
    case '작열통': damage(ctx,enemy,up?10:6);status(ctx,enemy,'healScale',{until:now+2,value:up?0:0.5});break;
    case '영혼관':draw(ctx,side,3,null,up?{}:{temporaryUntil:temporaryUntil(ctx)});break;
    case '불장난':damage(ctx,enemy,up?6:4);later(ctx,now+1,'STANDBY','returnRest',{uid:card.uid});break;
    case '태양 작렬':
      var solarTarget=A4.Minions&&A4.Minions.resolve(ctx,enemy,'choose')[0],solar={kind:'solar',from:now,until:now+1,amount:0,burst:up?15:10,sourceSide:side,sourceCard:ctx.copy(card)};
      if(solarTarget&&solarTarget.uid)solarTarget.status.cards.effects.push(solar);else status(ctx,enemy,'solar',solar);break;
    case '화염 장막':status(ctx,side,'flameVeil',{until:now+1,amount:up?5:3,sourceCard:ctx.copy(card)});break;
    case '점화':damage(ctx,enemy,(up?6:5)+(s.ignite||0));s.ignite=(s.ignite||0)+(up?6:5);break;
    case '폭발의 룬':damage(ctx,enemy,up?8:4);if(t.critical)damage(ctx,enemy,up?12:6);break;
    case '절멸':if(!up)damage(ctx,side,5);break;
    case '백드래프트':damage(ctx,enemy,f.deck.length);break;
    case '번아웃':later(ctx,now+(up?2:3),'STANDBY','burnout',{owner:enemy,uids:foe.hand.map(function(x){return x.uid;})});break;
    case '화염 제단':status(ctx,side,'fireOverpower',{});break;
    case '불안정한 원소':draw(ctx,side,f.deck.length);break;
    case '불덩이 작렬':damage(ctx,enemy,up?50:30);break;
    case '서리꽃':for(i=0;i<3;i++)ctx.generate(enemy,names['혹한'],{upgraded:up,zone:'deck'});ctx.shuffle(foe.deck);break;
    case '겨울의 뿔피리':ctx.mana(side,up?3:2,true);break;
    case '모사':if(f.hand.length){list=f.hand.slice().sort(function(a,z){return ctx.cost(side,a)-ctx.cost(side,z);});for(i=0;i<(up?2:1);i++)copyToHand(ctx,side,list[0]);}break;
    case '얼음 방패':status(ctx,side,'iceShield',{until:now+1});break;
    case '확고한 알리바이':status(ctx,side,'damageCap',{until:now+2,amount:1});break;
    case '대 한파':draw(ctx,side,1);lock(ctx,side,0,0);lock(ctx,enemy,0,0);break;
    case '완전 빙결':draw(ctx,side,up?3:2,null,{availableFrom:now+1});break;
    case '되감기':damage(ctx,enemy,up?4:2);chosen=ctx.pick(f.rest.filter(function(x){return ctx.canAutoCast(x);}));if(chosen)ctx.cast(side,chosen,{free:true,copy:true});break;
    case '급속 빙결':damage(ctx,enemy,up?5:3);if(t.critical)lock(ctx,enemy,up?0:1,1);break;
    case '얼음 덫':ctx.choose(side,['FIRE','NATURE','LIGHTNING','ICE','HOLY'].map(function(x){return {id:x,name:x};}),task(ctx,'iceTrap',{upgraded:up}),{label:'다음 턴에 카운터할 속성을 선택하세요.'});break;
    case '얼어붙은 버클러':ctx.shield(side,12);if(!up)status(ctx,side,'disarm',{from:now+1,until:now+1});break;
    case '냉동 캡슐':e=status(ctx,side,'capsule',{until:now+1,amount:0,multiplier:up?2:1,sourceCard:ctx.copy(card),key:card.uid+':'+now});later(ctx,e.until,'END','capsule',{key:e.key});break;
    case '서리 저주':ctx.generate(enemy,names['고드름'],{upgraded:up});break;
    case '동면':fromZone(ctx,side,enemy,'hand','hibernate',{upgraded:up});break;
    case '북부 항해':fromZone(ctx,side,side,'deck','northern',{upgraded:up});break;
    case '얼음 거울':damage(ctx,enemy,up?5:3);break;
    case '발굴':fromZone(ctx,side,side,'rest','take',{remaining:up?2:1});break;
    case '얼음 회오리':lock(ctx,enemy,up?0:1,1);break;
    case '심해 저주':ctx.generate(enemy,names['저주'],{upgraded:up});break;
    case '칼바람':status(ctx,enemy,'costIncrease',{from:now+(up?0:1),until:now+2,amount:1});break;
    case '번개 개화':ctx.overload(side,up?1:2);ctx.mana(side,2);break;
    case '수중 동물 변신':list=f.deck.slice(Math.max(0,f.deck.length-3));if(list.length)ctx.choose(side,list,task(ctx,'dredge'),{label:'덱 맨 아래 카드 중 하나를 맨 위에 놓으세요.'});break;
    case '살아 움직이는 숲':status(ctx,side,'forest',{until:now+3,selfDamage:up?2:3,damage:up?4:3,sourceCard:ctx.copy(card)});break;
    case '초고속':draw(ctx,side,up?2:1);f.status.foresightTurns=f.status.foresightTurns||[];f.status.foresightTurns.push(now+1);break;
    case '재생':ctx.heal(side,up?5:3);later(ctx,now+1,'STANDBY','heal',{amount:up?5:3});break;
    case '이슬 절차':status(ctx,side,'extraDraw',{amount:1});status(ctx,enemy,'extraDraw',{amount:1});break;
    case '광합성':draw(ctx,side,up?3:2);break;
    case '산사태':damage(ctx,enemy,up?8:4);if(f.hand.some(function(x){return ctx.cost(side,x)>=2;}))draw(ctx,side,1,function(d,x){return ctx.cost(side,x)>=2;});break;
    case '등산용 간식':later(ctx,now+1,'STANDBY','mana',{amount:1});if(up)later(ctx,now+2,'STANDBY','mana',{amount:1});break;
    case '왕성한 진균':list=draw(ctx,side,3);list.forEach(function(x){if(element(ctx,x)==='FIRE'&&f.hand.some(function(h){return h.uid===x.uid;}))ctx.move(side,x.uid,'rest');});break;
    case '흡수':damage(ctx,enemy,up?6:4);if(t.critical)(up?(t.targets||[]):ctx.sample(t.targets||[],1)).forEach(function(x){movedToHand(ctx,side,enemy,x);});break;
    case '급속 성장':if(f.maxMana>=5)ctx.generate(side,'excess_mana',{upgraded:up});else{f.manaGrowth=(f.manaGrowth||0)+1;f.maxMana=Math.min(5,f.maxMana+1);}break;
    case '치유의 손길':ctx.shield(side,up?15:10);break;
    case '먹음직스러운 덥석멜론':[2,3,4,5].forEach(function(cost){draw(ctx,side,1,function(d,c){return ctx.cost(side,c)===cost;});});break;
    case '풍요':ctx.shield(side,up?14:7);draw(ctx,side,2);break;
    case '굽이치는 파도':amount=damage(ctx,enemy,up?8:5);if(typeof amount==='object')amount=amount.amount;ctx.shield(side,typeof amount==='number'?amount:(up?8:5));break;
    case '기적같은 성장':list=draw(ctx,side,Math.max(0,ctx.limit(side)-f.hand.length));amount=list.reduce(function(sum,x){return sum+ctx.cost(side,x);},0);ctx.shield(side,amount*(up?2:1));break;
    case '자연화':draw(ctx,enemy,up?1:2);break;
    case '폭풍 인도기':
      f.deck.slice().forEach(function(x){if(!x.upgraded&&(ctx.catalog.cardPool||ordinary).indexOf(x.cardId)>=0&&isGeneral(ctx,x)){var id=ctx.pick(pool(ctx));x.cardId=id;x.upgraded=true;costDrop(ctx,x,up?2:1,0);}});break;
    case '접붙이기':amount=0;foe.rest.slice().forEach(function(x){amount+=ctx.cost(enemy,x);ctx.move(enemy,x.uid,'excluded');});ctx.shield(side,Math.floor(amount*(up?1:0.5)));break;
    case '찌릿!':damage(ctx,enemy,up?5:3);if(f.hand.some(function(x){return element(ctx,x)==='LIGHTNING';}))draw(ctx,side,1,function(d){return d.element==='LIGHTNING';});break;
    case '선조의 지혜':ctx.overload(side,1);draw(ctx,side,up?3:2);break;
    case '부스터 팩':for(i=0;i<3;i++)randomCard(ctx,side,null,{upgraded:up||i===0});break;
    case '초과 인출':amount=(f.overloadNext||0)+(f.overloadLocked||0);f.overloadNext=0;ctx.mana(side,f.overloadLocked||0,true);f.overloadLocked=0;draw(ctx,side,amount);break;
    case '전선':ids=pool(ctx,function(d){return /발견/.test(d.text);},card.cardId).filter(function(id){return !up||ctx.canAutoCast({cardId:id,upgraded:false});});discover(ctx,side,ids.map(function(id){return option(ctx,id,false);}),up?'generateCast':'generateChoice');break;
    case '믹스테이프':fromZone(ctx,side,enemy,'deck','copyChoice',{discount:up?1:0});break;
    case '전류 공급':draw(ctx,side,1);s.currentStacks++;if(s.currentStacks>=2){s.currentStacks-=2;f.status.classes=f.status.classes||{};f.status.classes.powerBonus=(f.status.classes.powerBonus||0)+2;}break;
    case '긴급 차단':fromZone(ctx,side,enemy,'hand','intercept',{upgraded:up});break;
    case '천둥':for(i=1;i<=3;i++)later(ctx,now+i,'STANDBY','damage',{amount:up?5:3,target:enemy});break;
    case '파지직':ctx.overload(side,1);damage(ctx,enemy,(up?14:7)+Math.floor(ctx.rng()*(up?5:3)));break;
    case '마비':list=(foe.usedThisTurn||[]).filter(function(x){return !x.free;}).map(function(x){return x.def?x.def.element:element(ctx,x.card||x);});status(ctx,enemy,'forbiddenElements',{until:now+3,elements:list});break;
    case '단락':fromZone(ctx,side,side,'deck','shortCircuit');break;
    case '무덤의 지명자':fromZone(ctx,side,enemy,'rest','grave',{upgraded:up});break;
    case '충전':later(ctx,now+1,'STANDBY','charge');break;
    case '번개':lock(ctx,enemy,up?0:1,1);status(ctx,enemy,'immune',{from:now+1,until:now+1});status(ctx,enemy,'allEnemyImmune',{from:now+1,until:now+1});break;
    case '연쇄 번개':if(up)draw(ctx,side,1);count=Math.max(1,s.lightningStreak||1);for(i=0;i<count;i++)damage(ctx,enemy,5);break;
    case '마법공학: 퓨즈':case '마법공학: 니비루': break; /* Hand-triggered rules below; manual use is prohibited. */
    case '고철 더미에서':if((f.lastTurnCards||[]).some(function(x){return (x.def?x.def.element:element(ctx,x.card||x))==='LIGHTNING'&&!x.free;})){
      ids=Object.keys(ctx.catalog.treasures).filter(function(id){var d=ctx.catalog.treasures[id];return !d.retired&&(!d.classId||d.classId===f.heroId)&&d.kind==='card'&&d.tier===(up?'high':'low');});
      discover(ctx,side,ids.map(function(id){var x=option(ctx,ctx.catalog.treasures[id].cardId,false);x.treasureId=id;return x;}),'treasureChoice');}break;
    case '두꺼비집':status(ctx,enemy,'elementOverride',{from:now+(up?0:1),until:now+1,element:'LIGHTNING'});break;
    case '기도':ids=pool(ctx,function(d){return d.element==='HOLY';},card.cardId);discover(ctx,side,ids.map(function(id){return option(ctx,id,false);}), 'prayer',{remaining:up?2:1});break;
    case '윤회':draw(ctx,side,up?2:1);fromZone(ctx,side,side,'deck','cycle',{remaining:2});break;
    case '운명':ids=pool(ctx).filter(function(id){return ctx.canAutoCast({cardId:id,upgraded:true});});if(ids.length)ctx.cast(side,{cardId:ctx.pick(ids),upgraded:true},{free:true,copy:true});break;
    case '예지':if(up)fromZone(ctx,side,side,'deck','take',{remaining:1},function(x){return ctx.cost(side,x)===3;});else draw(ctx,side,1,function(d,x){return ctx.cost(side,x)===3;});break;
    case '안도':if(!(s.previousDamage||0)){draw(ctx,side,up?2:1);ctx.shield(side,4);}break;
    case '심판':count=f.rest.filter(function(x){return element(ctx,x)==='HOLY';}).length;damage(ctx,enemy,count*(up?3:2));break;
    case '계시':fromZone(ctx,side,enemy,'hand','revelation',{upgraded:up});break;
    case '배교':damage(ctx,enemy,t.critical?(up?12:6):(up?6:3));break;
    case '황금궤':ids=pool(ctx,null,card.cardId);discover(ctx,side,ids.map(function(id){return option(ctx,id,true);}), 'golden',{delay:up?1:3});break;
    case '필연':ids=pool(ctx).filter(function(id){return ctx.canAutoCast({cardId:id,upgraded:false});});if(ids.length)for(i=0;i<(up?3:2);i++)ctx.cast(side,{cardId:ctx.pick(ids),upgraded:false},{free:true,copy:true});break;
    case '불굴':status(ctx,side,up?'immune':'immuneCards',{until:now});break;
    case '성전':draw(ctx,side,1);lock(ctx,side,0,up?2:1,['HOLY']);lock(ctx,enemy,0,up?2:1,['HOLY']);break;
    case '성지순례':status(ctx,side,'pilgrimage',{amount:up?3:2,sourceCard:ctx.copy(card)});break;
    case '축성':ctx.sample(f.rest.filter(function(x){return !x.upgraded&&(isGeneral(ctx,x)||x.cardId==='crystal_ball'||x.originalCardId==='crystal_ball');}),5).forEach(function(x){ctx.upgrade(x);});if(up)fromZone(ctx,side,side,'rest','take',{remaining:1});else if(f.rest.length)ctx.move(side,ctx.pick(f.rest).uid,'hand');break;
    case '신의 권능: 가속':case '신의 권능: 재생':case '신의 권능: 징벌':case '신의 권능: 성역':case '신의 권능: 응징':break; /* Aura effects apply while held. */
    case '넘치는 마나':draw(ctx,side,up?2:1);break;
    case '혹한':case '고드름':case '저주':break; /* Zone/hand effects, no ordinary on-use effect. */
    default: throw new Error('일반 카드 실행 규칙 누락: '+n);
    }
    return true;
  }
  function continuation(ctx,t) {
    var side=t.side,f=ctx.fighter(side),enemy=ctx.other(side),foe=ctx.fighter(enemy),b=ctx.battle,s=state(f),
      selected=t.choice,c,list,amount,ids,e;
    switch(t.op) {
    case 'naturalDetox':ctx.heal(side,(f.status.poison||0)*(t.upgraded?2:1));f.status.poison=0;break;
    case 'returnRest':c=f.rest.filter(function(x){return x.uid===t.uid;})[0];if(c)ctx.move(side,c.uid,'hand');break;
    case 'burnout':ctx.fighter(t.owner).hand.slice().forEach(function(x){if(t.uids.indexOf(x.uid)>=0)ctx.move(t.owner,x.uid,'rest');});break;
    case 'atlasRest':
      var targets=f.hand.filter(function(x){return (t.beforeHandUids||[]).indexOf(x.uid)<0;});
      ctx.withSource(t.sourceSide,t.sourceDef,function(){
        targets.forEach(function(x){ctx.move(side,x.uid,'rest');});
        if(b.resolution)b.resolution.queue=b.resolution.queue.filter(function(job){
          if(job.kind==='cast'&&job.side===side&&(t.castUids||[]).indexOf(job.card.uid)>=0){
            var found=ctx.find(side,job.card.uid);if(found)ctx.move(side,found.uid,'rest');else {ctx.add(side,ctx.copy(job.card),'rest');ctx.note('move',side,1,{text:'rest'});}return false;
          }return true;
        });
      });break;
    case 'loseShield':ctx.shield(side,-t.amount);break;
    case 'capsule':e=s.effects.filter(function(x){return x.kind==='capsule'&&x.key===t.key;})[0];if(e){damage(ctx,enemy,e.amount*(e.multiplier||1),{card:e.sourceCard});e.kind='spent';}break;
    case 'heal':ctx.heal(side,t.amount);break;
    case 'mana':ctx.mana(side,t.amount);break;
    case 'damage':damage(ctx,t.target||enemy,t.amount);break;
    case 'solarBurst':ctx.damage(side,t.target,t.amount,{card:t.card,bodyOnly:true});draw(ctx,side,1);break;
    case 'coldDiscard':if(!t.upgraded)draw(ctx,side,1);draw(ctx,enemy,1);break;
    case 'iceTrap':status(ctx,enemy,'iceTrap',{from:b.turn+1,until:b.turn+1,element:selected.id,all:t.upgraded,sourceSide:side});break;
    case 'hibernate':if(ctx.find(t.owner,selected.uid)){ctx.move(t.owner,selected.uid,t.upgraded?'rest':'deck');if(!t.upgraded)ctx.shuffle(ctx.fighter(t.owner).deck);}break;
    case 'northern':c=movedToHand(ctx,side,t.owner,selected);if(c&&element(ctx,c)==='ICE')lock(ctx,enemy,t.upgraded?0:1,1,['ICE']);break;
    case 'take':
      movedToHand(ctx,side,t.owner,selected);
      if(t.remaining>1)fromZone(ctx,side,t.owner,t.zone,'take',{remaining:t.remaining-1});break;
    case 'dredge':
      c=ctx.remove(side,selected.uid);if(c){f.deck.unshift(c);if(ctx.cost(side,c)<=f.mana){draw(ctx,side,1);if(t.card&&t.card.upgraded)copyToHand(ctx,side,c);}}break;
    case 'generateChoice':ctx.generate(side,selected.cardId,{upgraded:!!selected.upgraded});break;
    case 'generateCast':if(ctx.canAutoCast(selected))ctx.cast(side,selected,{free:true,copy:true});break;
    case 'copyChoice':c=copyToHand(ctx,side,selected);if(c&&t.discount)costDrop(ctx,c,t.discount,0);break;
    case 'intercept':copyToHand(ctx,side,selected,{intercept:{owner:t.owner,uid:selected.uid,steal:t.upgraded}});break;
    case 'shortCircuit':c=ctx.find(t.owner,selected.uid);if(c){amount=ctx.cost(t.owner,c);ctx.move(t.owner,c.uid,'excluded');draw(ctx,side,amount);}break;
    case 'grave':if(t.upgraded)movedToHand(ctx,side,t.owner,selected);else if(ctx.find(t.owner,selected.uid))ctx.move(t.owner,selected.uid,'excluded');break;
    case 'charge':
      status(ctx,side,'temporaryUpgrade',{from:b.turn,until:b.turn});
      allZones(f).concat(f.inFlight||[]).forEach(function(x){if(ctx.upgrade(x))x.revertUpgradeTurn=b.turn;});break;
    case 'treasureChoice':
      c=ctx.generate(side,selected.cardId,{upgraded:false});ctx.runChange({type:'addTreasure',side:side,treasureId:selected.treasureId,cardUid:c.uid});break;
    case 'prayer':
      c=ctx.generate(side,selected.cardId,{upgraded:false});ctx.runChange({type:'addCard',side:side,card:ctx.copy(c)});
      if(t.remaining>1){ids=pool(ctx,function(d){return d.element==='HOLY';},t.card.cardId);discover(ctx,side,ids.map(function(id){return option(ctx,id,false);}), 'prayer',{remaining:t.remaining-1});}break;
    case 'cycle':
      if(ctx.find(t.owner,selected.uid))ctx.move(t.owner,selected.uid,'rest');if(t.remaining>1)fromZone(ctx,side,t.owner,'deck','cycle',{remaining:t.remaining-1});break;
    case 'revelation':status(ctx,t.owner,'revelation',{from:b.turn+(t.upgraded?0:1),until:b.turn+1,uid:selected.uid,sourceSide:side});break;
    case 'golden':later(ctx,b.turn+t.delay,'STANDBY','goldenDelivery',{cardId:selected.cardId,upgraded:true});break;
    case 'goldenDelivery':ctx.generate(side,t.cardId,{upgraded:true});break;
    case 'auraRest':
      (t.auras||[]).forEach(function(x){
        if(x.rule==='신의 권능: 재생')ctx.heal(side,5,{card:x.card});
        if(x.rule==='신의 권능: 징벌'){if(A4.Minions)A4.Minions.randomDamage(ctx,side,5,{card:x.card});else ctx.damage(side,enemy,5,{card:x.card});}
        if(x.rule==='신의 권능: 성역'&&x.card.uid!==t.restCard.uid)ctx.withSource(side,ctx.def(x.card),function(){draw(ctx,side,1);});
      });break;
    case 'reflectHeal':ctx.damage(side,enemy,t.amount,{card:t.card});break;
    default:return false;
    }
    return true;
  }
  function held(ctx,side,name) { return ctx.fighter(side).hand.filter(function(c){return baseName(ctx,c)===name;}); }
  function hook(ctx,event) {
    var b=ctx.battle,side=event.side,f=side?ctx.fighter(side):null,s=f?state(f):null,enemy=side?ctx.other(side):null,
      card=event.card,def=card?ctx.def(card):null,list,c,e,amount;
    if(event.type==='battleStart') {
      ['player','enemy'].forEach(function(owner){state(ctx.fighter(owner));});return;
    }
    if(event.type==='standby') {
      ['player','enemy'].forEach(function(owner){
        var p=ctx.fighter(owner),st=state(p);st.previousDamage=p.damageTakenLastTurn||0;
        effects(ctx,owner,'manaBurn').forEach(function(x){p.mana=Math.max(0,p.mana-x.amount);});
        effects(ctx,owner,'extraDraw').forEach(function(x){ctx.withSource(owner,x.sourceCard?ctx.def(x.sourceCard):{name:x.name||'이슬 절차',element:'NATURE'},function(){draw(ctx,owner,x.amount);});});
        st.drawCount=p.status.cards.drawCountTurn===b.turn?st.drawCount:0;
        st.effects=st.effects.filter(function(x){return x.until===undefined||x.until>=b.turn;});
      });return;
    }
    if(event.type==='end') {
      ['player','enemy'].forEach(function(owner){
        var p=ctx.fighter(owner);
        held(ctx,owner,'저주').slice().forEach(function(x){ctx.damage(owner,owner,x.upgraded?5:3,{card:x});});
        effects(ctx,owner,'pilgrimage').forEach(function(x){ctx.damage(owner,ctx.other(owner),x.amount,{card:x.sourceCard});});
      });return;
    }
    if(event.type==='afterEnd') {
      ['player','enemy'].forEach(function(owner){
        allZones(ctx.fighter(owner)).concat(ctx.fighter(owner).inFlight||[]).forEach(function(x){if(x.revertUpgradeTurn!==undefined&&x.revertUpgradeTurn<=b.turn){x.upgraded=false;delete x.revertUpgradeTurn;}});
      });return;
    }
    if(event.type==='cardUsed') {
      if(!event.free) {
        if(def.element==='LIGHTNING' && s.lightningLastTurn!==b.turn){s.lightningStreak=s.lightningLastTurn===b.turn-1?s.lightningStreak+1:1;s.lightningLastTurn=b.turn;}
        if(card.intercept) {
          var source=card.intercept,original=ctx.fighter(source.owner).hand.filter(function(x){return x.uid===source.uid;})[0];
          if(original){if(source.steal)movedToHand(ctx,side,source.owner,original);else ctx.move(source.owner,original.uid,'rest');}
        }
      }
      return;
    }
    if(event.type==='draw') {
      if(s.drawCountTurn!==b.turn){s.drawCountTurn=b.turn;s.drawCount=0;s.drawnUids=[];}s.drawCount++;s.drawnUids.push(card.uid);
      if(effects(ctx,side,'temporaryUpgrade').length && ctx.upgrade(card))card.revertUpgradeTurn=b.turn;
      var fuseEffect=effects(ctx,side,'fuseDiscard')[0];
      if(fuseEffect && f.hand.some(function(x){return x.uid===card.uid;}))ctx.withSource(fuseEffect.sourceSide||enemy,fuseEffect.fuseSource||{name:'마법공학: 퓨즈+',element:'LIGHTNING'},function(){ctx.move(side,card.uid,'rest');});
      if(s.drawCount>1&&f.hand.some(function(x){return x.uid===card.uid;})){
        list=held(ctx,enemy,'마법공학: 퓨즈');
        if(list.length){
          c=list[0];ctx.reveal(enemy,c);
          ctx.withSource(enemy,ctx.def(c),function(){
          var fuseSource=ctx.copy(ctx.def(c));
          ctx.move(enemy,c.uid,'rest',{silent:true});
          // A multi-card draw already moved its whole batch into hand, but its
          // draw events resolve one by one. Include the remaining batch now;
          // the base Fuse must not gain the upgraded card's turn-long effect.
          var excess=s.drawnUids.slice(1);
          if(event.drawBatch!==undefined&&b.resolution)(b.resolution.queue||[]).forEach(function(t){
            var pending=t.event;
            if(t.kind==='event'&&pending&&pending.type==='draw'&&pending.side===side&&pending.drawBatch===event.drawBatch&&excess.indexOf(pending.card.uid)<0)excess.push(pending.card.uid);
          });
          excess.forEach(function(uid){if(f.hand.some(function(x){return x.uid===uid;}))ctx.move(side,uid,'rest');});
          if(c.upgraded)status(ctx,side,'fuseDiscard',{until:b.turn,name:fuseSource.name,sourceCard:ctx.copy(c),sourceSide:enemy,fuseSource:fuseSource});
          ctx.log('마법공학: 퓨즈 — 초과 드로우 차단');
          });
        }
      }
      return;
    }
    if(event.type==='discovered'){
      var lasting=effects(ctx,side,'atlasDiscard')[0],trap=held(ctx,enemy,'마법공학: 아틀라스')[0],sourceDef,sourceSide;
      if(lasting){sourceDef=lasting.sourceDef;sourceSide=lasting.sourceSide;}
      else if(trap){sourceDef=ctx.copy(ctx.def(trap));sourceSide=enemy;
        ctx.reveal(enemy,trap);
        ctx.withSource(enemy,sourceDef,function(){ctx.move(enemy,trap.uid,'rest',{silent:true});ctx.draw(enemy,1);});
        if(trap.upgraded)status(ctx,side,'atlasDiscard',{until:b.turn,sourceSide:enemy,sourceDef:sourceDef});
      }
      if(sourceDef)ctx.prepend({module:'cards',op:'atlasRest',side:side,beforeHandUids:event.beforeHandUids||[],castUids:event.castUids||[],sourceSide:sourceSide,sourceDef:sourceDef});
      return;
    }
    if(event.type==='cardRest') {
      /* Snapshot held auras at the moment of the move, supplied by modify(move).
       * It includes the departing aura itself for 재생/징벌, but not 성역. */
      if(card.cardsRestAuras){
        ctx.enqueue({module:'cards',op:'auraRest',side:side,restCard:ctx.copy(card),auras:ctx.copy(card.cardsRestAuras)});
        delete card.cardsRestAuras;
      }
      if(/^신의 권능: /.test(baseName(ctx,card))&&card.upgraded)draw(ctx,side,1);
      return;
    }
    if(event.type==='damage'&&event.amount>0) {
      effects(ctx,side,'solar').forEach(function(x){
        x.amount+=event.amount;if(x.amount>=10){x.kind='spent';ctx.enqueue({module:'cards',op:'solarBurst',side:x.sourceSide,target:side,amount:x.burst,card:x.sourceCard});}
      });
      effects(ctx,side,'capsule').forEach(function(x){x.amount+=event.amount;});
      if(!event.unblockable&&event.reactiveAllowed!==false)effects(ctx,side,'flameVeil').forEach(function(x){ctx.damage(side,ctx.other(side),x.amount,{card:x.sourceCard,reactionDepth:(event.reactionDepth||0)+1});});
      return;
    }
    if(event.type==='counter') {
      effects(ctx,side,'forest').forEach(function(x){for(var i=0;i<event.targets.length;i++)ctx.damage(side,ctx.other(side),x.damage,{card:x.sourceCard});});
    }
  }
  function modify(ctx,what,data) {
    var b=ctx.battle,side=data.side,f=side?ctx.fighter(side):null,s=f?state(f):null,card=data.card,
      list,c,i,key,n,entry,opposing;
    if(what==='element') {
      list=effects(ctx,side,'elementOverride');if(list.length)data.value=list[list.length-1].element;
      if(data.value==='FIRE'&&effects(ctx,side,'fireOverpower').length)data.def.overpower=true;
      return;
    }
    if(what==='cardCost') {
      effects(ctx,side,'costIncrease').forEach(function(x){data.value+=x.amount;});
      list=held(ctx,side,'신의 권능: 가속').filter(function(x){return x.uid!==card.uid;});
      if(list.length&&data.value>0)data.value=Math.max(1,data.value-list.length);
      i=f.hand.map(function(x){return x.uid;}).indexOf(card.uid);
      if(i>=0){if(i>0&&baseName(ctx,f.hand[i-1])==='고드름')data.value++;if(i<f.hand.length-1&&baseName(ctx,f.hand[i+1])==='고드름')data.value++;}
      return;
    }
    if(what==='cardUsable') {
      if(effects(ctx,side,'forbiddenElements').some(function(x){return x.elements.indexOf(data.def.element)>=0;})){data.allowed=false;data.reason='마비된 속성의 카드는 낼 수 없습니다.';}
      return;
    }
    if(what==='damage') {
      if(card&&!data.noBonus&&ctx.def(card).element==='LIGHTNING')data.value+=(state(ctx.fighter(data.sourceSide)).lightningBonus||0);
      return;
    }
    if(what==='damageTaken') {
      if(data.unblockable)return;
      if(effects(ctx,side,'immune').length)data.value=0;
      if(card&&data.sourceSide!==side&&effects(ctx,side,'immuneCards').length)data.value=0;
      if(effects(ctx,side,'iceShield').length&&(!card||ctx.def(card).element!=='LIGHTNING'))data.value=0;
      effects(ctx,side,'flameVeil').forEach(function(x){data.value=Math.max(0,data.value-x.amount);});
      if(data.value>0&&effects(ctx,side,'damageCap').length)data.value=1;
      return;
    }
    if(what==='healFinal') {
      effects(ctx,side,'healScale').forEach(function(x){data.value=Math.floor(data.value*x.value);});
      if(data.value>0&&held(ctx,side,'신의 권능: 응징').length){ctx.enqueue({module:'cards',op:'reflectHeal',side:side,amount:data.value,card:data.card});data.value=0;}
      return;
    }
    if(what==='move'&&data.to==='rest') {
      n=baseName(ctx,card);
      if(n==='혹한'){
        data.to='excluded';ctx.enqueue({module:'cards',op:'coldDiscard',side:side,upgraded:!!card.upgraded});return;
      }
      var auras=f.hand.filter(function(x){return /^신의 권능: (재생|징벌|성역)$/.test(baseName(ctx,x));}).map(function(x){return {rule:baseName(ctx,x),card:ctx.copy(x)};});
      if(auras.length)card.cardsRestAuras=auras;return;
    }
    if(what==='beforeCounter') {
      ['player','enemy'].forEach(function(owner){
        var ownEntries=data.entries[owner],opponent=ctx.other(owner),foeEntries=data.entries[opponent],st=state(ctx.fighter(owner)),ordinal=ctx.fighter(owner).playedThisTurn-ownEntries.length;
        ownEntries.forEach(function(x,index){
          var name=x.effectRule||x.def.rule||x.def.name;
          if(name==='연쇄 번개'){
            var streak=st.lightningLastTurn===b.turn?st.lightningStreak:st.lightningLastTurn===b.turn-1?st.lightningStreak+1:1;
            if(streak>=3)x.countered=false;
          }
          if(name==='폭발의 룬')x.def.overpower=true;
          effects(ctx,owner,'iceTrap').forEach(function(trap){if(x.def.element===trap.element&&(!trap.used||trap.all)){x.countered=true;trap.used=true;}});
          effects(ctx,owner,'revelation').forEach(function(mark){if(x.card.uid===mark.uid){x.countered=true;ctx.draw(mark.sourceSide,2);}});
          if(effects(ctx,owner,'nibiruDiscard').length){x.countered=true;x.counterSourceSide=opponent;}
          if(ordinal+index+1>=3&&!effects(ctx,owner,'nibiruDiscard').length){
            var heldTrap=held(ctx,opponent,'마법공학: 니비루')[0];
            if(heldTrap){ctx.reveal(opponent,heldTrap);ctx.move(opponent,heldTrap.uid,'rest');x.countered=true;x.counterSourceSide=opponent;if(heldTrap.upgraded)status(ctx,owner,'nibiruDiscard',{until:b.turn});ctx.log('마법공학: 니비루 — '+(ordinal+index+1)+'번째 카드 차단');}
          }
          if((x.counterEligible===undefined?!x.countered:x.counterEligible)&&(name==='절멸'||name==='자연화')){
            var targets=name==='자연화'?foeEntries:ctx.sample(foeEntries,1);
            targets.forEach(function(z){z.countered=true;x.didCounter=true;if(!x.targets.some(function(q){return q.uid===z.card.uid;}))x.targets.push(ctx.copy(z.card));});
          }
          if(name==='얼음 거울'&&x.didCounter&&(x.counterEligible===undefined?!x.countered:x.counterEligible)){
            var reflected=(x.effectUpgraded===undefined?x.card.upgraded:x.effectUpgraded)?x.targets:ctx.sample(x.targets,1);
            reflected.forEach(function(z){var target=foeEntries.filter(function(y){return y.card.uid===z.uid;})[0];if(target){target.countered=false;target.reflectedBy=owner;}});
            if(reflected.length)ctx.log('얼음 거울 — 상대 카드 효과 반사');
          }
        });
      });
      return;
    }
    if(what==='afterCounter') {
      ['player','enemy'].forEach(function(owner){
        var st=state(ctx.fighter(owner));
        data.entries[owner].forEach(function(x){if((x.def.rule||x.def.name)==='연쇄 번개'){
          var streak=st.lightningLastTurn===b.turn?st.lightningStreak:st.lightningLastTurn===b.turn-1?st.lightningStreak+1:1;
          if(streak>=3)x.countered=false;
        }});
        var forests=effects(ctx,owner,'forest');if(!forests.length)return;
        data.entries[owner].forEach(function(x){if(x.countered){x.countered=false;forests.forEach(function(forest){ctx.damage(owner,owner,forest.selfDamage,{card:forest.sourceCard});});}});
      });
      ['player','enemy'].forEach(function(owner){
        var targets=data.entries[ctx.other(owner)];
        data.entries[owner].forEach(function(x){x.targets=x.targets.filter(function(c){return targets.some(function(z){return z.card.uid===c.uid&&z.countered;});});x.didCounter=x.targets.length>0;});
      });
    }
  }
  return {install:install,run:run,resolve:run,hook:hook,modify:modify,harmfulEffects:harmfulEffects,supports:function(rule){return own(names,rule);},cardIds:function(){return ordinary.slice();},nameToId:function(name){return names[name];}};
}());
