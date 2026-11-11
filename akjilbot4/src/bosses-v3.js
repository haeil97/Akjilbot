/* Boss abilities use the same queue, mana, zones and choices as player cards. */
A4.BossRules=(function(){
  var SIDES=['player','enemy'];
  function power(id){
    if(id==='white_night')return {id:'white_night',rule:'white_night',module:'boss',name:'하얀 밤',kind:'passive',cost:0,text:'메인 페이즈의 제한 시간이 15초로 감소합니다.'};
    var p=A4.copy(A4.content.opponentAbilities.abilities[id]);
    A4.assert(p,'보스 능력 정의가 없습니다: '+id);
    p.id=id;p.rule=id;p.module='boss';p.cost=p.cost||0;
    if(id==='patchwerk'||id==='aurelion_sol')p.cooldown=4;
    if(id==='plague_doctor')p.cooldown=2;
    var scores={little_hatchling:{damage:2},aviana:{heal:4},black_knight:{control:5},patchwerk:{value:14},brightwing:{value:6},teemo:{value:5},lich_king:{draw:1,value:2},aurelion_sol:{value:7},faceless_manipulator:{control:1},mida:{control:4},plague_doctor:{value:9},extreme_troll:{draw:1,control:2}};
    if(scores[id])p.ai=scores[id];return p;
  }
  function install(c){
    A4.content.opponentAbilities.exclusiveCards.forEach(function(ref){
      var d={name:ref.name,element:ref.element,cost:ref.cost,text:ref.text,exclusive:true,noUpgrade:true,module:'boss',rule:ref.id,effects:[]};
      if(ref.displayElement)d.displayElement=ref.displayElement;
      if(/(?:^|[.,]\s*)압도(?:[.,:\s]|$)/.test(ref.text))d.overpower=true;
      if(/일회용/.test(ref.text))d.excludeOnUse=true;
      if(ref.id==='path_to_salvation'){d.innate=true;d.excludeOnUse=true;}
      if(ref.id==='poisonous_mushroom'||ref.id==='boo_scare')d.castOnDraw=true;
      if(ref.id==='crystal_ball'){d.noUpgrade=false;d.upgrade={cost:0,text:ref.upgrade.text};}
      if(ref.id==='ban_hammer_triple')d.ai={value:18};
      if(ref.id==='path_to_salvation')d.ai={value:25};
      if(ref.id==='prophecy')d.ai={control:6};
      c.cards[ref.id]=d;
    });
    Object.keys(c.enemies).forEach(function(id){var e=c.enemies[id];e.blueprint=false;e.implementationStatus='implemented';e.heroPower=power(id);});
  }
  function has(ctx,s,id){var p=ctx.fighter(s).heroPower;return p&&p.id===id;}
  function drawElement(ctx,s,el){return ctx.draw(s,1,function(d){return d.element===el;});}
  function task(s,op,more){var t={kind:'bossTask',module:'boss',side:s,op:op},k;for(k in more)if(A4.has(more,k))t[k]=more[k];return t;}
  function run(ctx,t){
    var s=t.side,f=ctx.fighter(s),o=ctx.other(s),foe=ctx.fighter(o),id=t.kind==='power'?t.power.rule:(t.def?t.def.rule:t.op),card,n,picked;
    if(t.module!=='boss')return false;
    switch(id){
    case 'pikachu':
      n=f.hand.concat(foe.hand).filter(function(x){return ctx.def(x).element==='LIGHTNING';}).length;ctx.damage(s,o,n,{card:null});break;
    case 'ivysaur':
      n=foe.status.poison||0;if(n){foe.status.poison=0;ctx.damage(s,o,n*(n+1)/2,{card:null,noBonus:true});}else ctx.poison(s,o,2);break;
    case 'boo':f.status.ghostWalkReflectTurn=ctx.battle.turn;f.status.ghostWalkReflectPhase=ctx.battle.phase;break;
    case 'poison_powder':f.status.poisonPowders=f.status.poisonPowders||[];f.status.poisonPowders.push({turn:ctx.battle.turn,card:ctx.copy(t.card)});break;
    case 'fiora_weakness_nature':case 'fiora_weakness_ice':case 'fiora_weakness_lightning':case 'fiora_weakness_fire':
      ctx.draw(s,1,function(d){return d.name==='약점 포착';});
      if(t.critical){
        if(id==='fiora_weakness_nature')for(n=1;n<=2;n++)ctx.schedule(ctx.battle.turn+n,'STANDBY',{kind:'effect',side:s,card:t.card,effect:{type:'heal',amount:5}});
        if(id==='fiora_weakness_ice')ctx.discover(s,foe.hand.slice(),task(s,'weaknessDiscard',{owner:o}),{label:'상대 손에서 레스트로 보낼 카드를 선택하세요.',sourceZone:'hand'});
        if(id==='fiora_weakness_lightning')ctx.discover(s,foe.rest.slice(),task(s,'stealRest',{owner:o}),{label:'상대 레스트에서 가져올 카드를 선택하세요.',sourceZone:'opponentRest'});
        if(id==='fiora_weakness_fire')ctx.damage(s,o,8);
      }break;
    case 'weaknessDiscard':
      card=t.choice&&foe.hand.filter(function(x){return x.uid===t.choice.uid;})[0];if(card)ctx.move(o,card.uid,'rest');break;
    case 'fiora_grand_duel':
      f.rest.slice().filter(function(x){return ctx.catalog.cards[x.cardId].name==='약점 포착';}).forEach(function(x){card=ctx.remove(s,x.uid);if(card)ctx.add(s,card,'hand');});
      ['nature','ice','lightning','fire'].forEach(function(el){ctx.generate(s,'fiora_weakness_'+el,{zone:'deck'});});ctx.shuffle(f.deck);break;
    case 'powderEnd':ctx.poison(s,o,foe.drawnCountThisTurn||0);break;
    case 'pointing':card=foe.hand[0];if(card){ctx.move(o,card.uid,'deck');ctx.shuffle(foe.deck);}ctx.draw(s,1);ctx.draw(o,1);break;
    case 'hanar_lie':
      if(t.critical){picked=ctx.pick(ctx.catalog.cardPool.filter(function(cid){return /발견/.test(ctx.catalog.cards[cid].text);}));if(picked)ctx.generate(s,picked);}break;
    case 'hanar_truth':
      card=t.card.copiedEffectCard||foe.lastDrawnCard;card=card&&ctx.copy(card);
      if(card){var copiedDef=ctx.def(card),trail=t.truthTrail||[];
        if(!copiedDef.unplayable&&card.cardId!=='hanar_truth'&&trail.indexOf(card.cardId)<0){
          var copiedTask=ctx.copy(t);copiedTask.kind='card';copiedTask.card=card;copiedTask.def=copiedDef;copiedTask.module=copiedDef.module;copiedTask.truthTrail=trail.concat([card.cardId]);
          if(copiedDef.module==='cards')A4.CardRules.run(ctx,copiedTask);
          else if(copiedDef.module==='treasures')A4.TreasureRules.run(ctx,copiedTask);
          else run(ctx,copiedTask);
        }
      }break;
    case 'little_hatchling':ctx.damage(s,o,2,{card:null});break;
    case 'aviana':ctx.heal(s,4,{card:null});break;
    case 'black_knight':
      picked=ctx.battle.resolution&&ctx.battle.resolution.entries;
      var countered=picked?picked[o].filter(function(x){return x.powerCounterBy===s;}):[];
      if(countered.length)ctx.note('powerCounter',o,countered.length,{cards:countered.map(function(x){return ctx.copy(x.def);})});
      break;
    case 'patchwerk':f.hp=Math.min(100,f.hp*2);f.maxHp=Math.min(100,f.maxHp*2);ctx.note('doubleHealth',s,2,{text:f.hp+'/'+f.maxHp});break;
    case 'brightwing':
      picked=ctx.pick(ctx.catalog.cardPool.filter(function(cid){return ctx.catalog.cards[cid].cost<=3&&ctx.canAutoCast({cardId:cid,upgraded:false});}));
      if(picked)ctx.cast(s,{cardId:picked,upgraded:false});break;
    case 'teemo':if(foe.deck.filter(function(x){return x.cardId==='poisonous_mushroom';}).length<=3){if(ctx.modify('harmfulEffect',{side:o,kind:'mushrooms',cancel:false}).cancel)break;for(n=0;n<3;n++)ctx.generate(o,'poisonous_mushroom',{zone:'deck'});ctx.shuffle(foe.deck);ctx.note('powerShuffle',o,3,{text:'[🌊] 버섯 함정'});}break;
    case 'lich_king':ctx.discover(s,foe.rest,task(s,'stealRest',{}),{label:'상대 레스트에서 가져올 카드를 선택하세요.',sourceZone:'opponentRest'});break;
    case 'stealRest':card=ctx.remove(o,t.choice.uid);if(card)ctx.add(s,card,'hand');break;
    case 'aurelion_sol':f.status.cosmicBonus=(f.status.cosmicBonus||0)+1;ctx.note('powerScaling',s,1,{text:String(f.status.cosmicBonus)});break;
    case 'faceless_manipulator':card=ctx.pick(foe.hand);if(card){ctx.move(o,card.uid,'deck');ctx.shuffle(foe.deck);}ctx.draw(o,1);break;
    case 'mida':ctx.sample(foe.rest,3).forEach(function(x){ctx.move(o,x.uid,'excluded');});break;
    case 'plague_doctor':
      ctx.heal(o,Math.max(0,foe.maxHp-foe.hp),{card:null});
      n=f.status.baptisms=(f.status.baptisms||0)+1;
      var speech=A4.content.opponentAbilities.doctorQuotes[n-1].replace(/\(플레이어 닉네임\)/g,ctx.battle.player.name);
      ctx.log(speech);ctx.note('text',s,0,{text:speech});
      if(n===12){
        f.name='백야';f.maxHp=100;f.hp=100;
        ['hand','deck','rest'].forEach(function(z){f[z].forEach(function(x){ctx.upgrade(x);});});
        f.heroPower=power('white_night');
        ctx.battle.mainTimeoutMs=20000;ctx.log('[🛟] 세례가 [🛟] 하얀 밤으로 변신합니다.');
        ctx.note('text',s,0,{text:'[🛟] 세례가 [🛟] 하얀 밤으로 변신합니다.'});
        ctx.battle.pendingPowerAnnouncements=ctx.battle.pendingPowerAnnouncements||[];
        ctx.battle.pendingPowerAnnouncements.push('[🛟] 하얀 밤 | 지속형\n메인 페이즈의 제한 시간이 15초로 감소합니다.');
      }break;
    case 'extreme_troll':
      drawElement(ctx,s,'ICE');card=ctx.pick(foe.deck.filter(function(x){return ctx.def(x).element==='LIGHTNING';}));if(card)ctx.move(o,card.uid,'rest');break;
    case 'ban_hammer_triple':
      if(ctx.modify('harmfulEffect',{side:o,kind:'warning',cancel:false}).cancel)break;
      foe.status.warnings=(foe.status.warnings||0)+1;ctx.log(foe.name+' 경고 '+foe.status.warnings+'/3');
      if(foe.status.warnings>=3)ctx.battle[o==='player'?'specialDefeat':'specialVictory']=true;break;
    case 'deactivation':f.status.warnings=0;break;
    case 'prophecy':break;
    case 'path_to_salvation':
      if(!f.status.salvation)f.status.salvation={remaining:50,activatedTurn:ctx.battle.turn};break;
    case 'crystal_ball':break;
    case 'ominous_presence':ctx.shield(s,10);ctx.draw(s,2);break;
    case 'boo_ghost_raider':ctx.damage(s,o,((f.playedThisTurn||0)+(foe.playedThisTurn||0))*4);break;
    case 'boo_scare':ctx.draw(s,1);card=ctx.pick(foe.hand);if(card)ctx.move(o,card.uid,'rest');break;
    case 'final_chapter':for(n=1;n<=3;n++){ctx.schedule(ctx.battle.turn+n,'STANDBY',{kind:'effect',side:s,card:t.card,effect:{type:'damage',amount:6}});ctx.schedule(ctx.battle.turn+n,'STANDBY',{kind:'effect',side:s,card:t.card,effect:{type:'heal',amount:6}});}break;
    case 'salvation_prayer':ctx.heal(s,5);ctx.heal(o,5);break;
    case 'bramble_root':ctx.shield(s,5);ctx.draw(s,1);break;
    case 'poisonous_mushroom':ctx.poison(s,s,2);ctx.draw(s,1);break;
    case 'ivernReplace':
      card=ctx.pick(f.hand.filter(function(x){return ctx.def(x).element!=='NATURE';}));
      if(card){ctx.move(s,card.uid,'deck');ctx.shuffle(f.deck);}drawElement(ctx,s,'NATURE');break;
    default:return false;
    }return true;
  }
  function foeHand(ctx,side){return ctx.fighter(side).hand;}
  function hook(ctx,e){
    SIDES.forEach(function(s){
      var f=ctx.fighter(s),o=ctx.other(s),p=f.heroPower,id=p&&p.id,card;
      ctx.withSource(s,p||{name:'전투 효과'},function(){
      if(e.type==='counter'&&e.side===s&&id==='fiora'){
        var phaseKey=ctx.battle.turn+':'+ctx.battle.phaseSerial+':'+ctx.battle.phase;
        if(f.status.fioraCounterPhase!==phaseKey){f.status.fioraCounterPhase=phaseKey;f.status.fioraCounteredUids=[];}
        (e.targets||[]).forEach(function(target){if(f.status.fioraCounteredUids.indexOf(target.uid)<0){
          f.status.fioraCounteredUids.push(target.uid);ctx.damage(s,o,5,{card:null,noBonus:true});
        }});
      }
      if(e.type==='beforeMain'&&e.phase==='MAIN2'&&id==='fiora'){
        var records=ctx.battle.history||[],last=records[records.length-1];
        if(last&&last.turn===ctx.battle.turn&&last.phase==='MAIN1'&&!(last[o]||[]).length)ctx.damage(s,o,5,{card:null});
      }
      if(e.type==='damage'&&e.side===s&&e.amount>0&&e.reactiveAllowed!==false&&f.status.ghostWalkReflectTurn===ctx.battle.turn&&f.status.ghostWalkReflectPhase===ctx.battle.phase){ctx.withSource(s,power('boo'),function(){ctx.damage(s,o,e.amount,{card:null,noBonus:true,reactionDepth:(e.reactionDepth||0)+1});});}

      if(e.type==='afterEnd'&&f.status.poisonPowders){
        f.status.poisonPowders=f.status.poisonPowders.filter(function(x){if(x.turn!==ctx.battle.turn)return x.turn>ctx.battle.turn;ctx.withSource(s,ctx.def(x.card),function(){ctx.poison(s,o,ctx.fighter(o).drawnCountThisTurn||0);});return false;});
      }
      if(e.type==='battleStart'){
        if(f.bossId==='extreme_troll')for(var i=0;i<3;i++)ctx.generate(o,'deactivation');
        if(id==='white_night')ctx.battle.mainTimeoutMs=20000;
      }
      if(e.type==='standby'){
        if(id==='trap_room')ctx.draw(s,1,function(d){return d.cost===3;});
        f.hand.forEach(function(x){if(x.cardId==='crystal_ball'||x.originalCardId==='crystal_ball'){
          x.crystalUpgraded=x.cardId==='crystal_ball'?!!x.upgraded:!!x.crystalUpgraded;x.cardId=ctx.pick(ctx.catalog.cardPool);x.originalCardId='crystal_ball';x.transformed=true;x.upgraded=x.crystalUpgraded;x.noUpgrade=false;
          delete x.cost;delete x.costDelta;delete x.element;delete x.temporaryUntil;
          if(ctx.def(x).temporary)x.temporaryUntil=ctx.battle.turn;
        }});
        if(id==='inquiry'&&!(A4.Classes&&A4.Classes.has(f,'dragon_pendant_passive'))&&(ctx.battle.turn+1)%2===0&&f.status.inquiryTurn!==ctx.battle.turn){f.status.inquiryTurn=ctx.battle.turn;ctx.generate(s,'crystal_ball');}
      }
      if(e.type==='end'){
        if(id==='cannon_minion')ctx.damage(s,o,1,{card:null});
        if(id==='antonidas')drawElement(ctx,s,'FIRE');
        if(id==='ivern')SIDES.forEach(function(side){ctx.enqueue(task(side,'ivernReplace',{}));});
        if(id==='yogg_saron')SIDES.forEach(function(side){card=ctx.pick(ctx.fighter(side).rest);if(card)ctx.move(side,card.uid,'excluded');});
        if(f.status.salvation&&f.status.salvation.lastEndTurn!==ctx.battle.turn){
          f.status.salvation.lastEndTurn=ctx.battle.turn;
          f.status.salvation.remaining--;
          SIDES.forEach(function(owner){var who=ctx.fighter(owner),st=who.status,count=st.directHolyCountTurn===ctx.battle.turn?st.directHolyCount:(who.usedThisTurn||[]).filter(function(x){return !x.free&&x.element==='HOLY';}).length;f.status.salvation.remaining-=count||0;});
          f.status.salvation.remaining=Math.max(0,f.status.salvation.remaining);
          if(f.status.salvation.remaining<=0)ctx.battle[s==='player'?'specialVictory':'specialDefeat']=true;
        }
      }
      if(e.type==='heal'&&e.side===o&&e.amount>0&&id==='yuumi'&&f.status.yuumiHealTurn!==ctx.battle.turn){f.status.yuumiHealTurn=ctx.battle.turn;ctx.draw(s,1,null,{costDelta:-2,costFloor:0});}
      if(e.type==='cardUsed'&&e.side===s&&!e.free&&e.def.element==='HOLY'){
        if(f.status.directHolyCountTurn!==ctx.battle.turn){f.status.directHolyCountTurn=ctx.battle.turn;f.status.directHolyCount=(f.usedThisTurn||[]).slice(0,Math.max(0,(e.ordinal||1)-1)).filter(function(x){return !x.free&&x.element==='HOLY';}).length;}
        f.status.directHolyCount++;
      }
      });
    });
  }
  function modify(ctx,what,d){
    if(what==='damageTaken'&&has(ctx,d.side,'super_minion')){
      var minion=ctx.fighter(d.side),blocked=d.ignoreArmor?0:Math.min(minion.shield,d.value),hpDamage=Math.max(0,d.value-blocked);
      if(!minion.status.inhibitorTriggered&&hpDamage>0&&minion.hp-hpDamage<=minion.maxHp/2){
        minion.status.inhibitorTriggered=true;d.value=0;
        ['hand','deck','rest'].forEach(function(zone){minion[zone].forEach(function(card){ctx.upgrade(card);});});
      }
    }

    if(what==='cardCost'&&ctx.battle.phase==='MAIN1'&&has(ctx,d.side,'hanar')&&/발견/.test(d.def.text))d.value=Math.max(0,d.value-1);
    if(what==='cardUsable'){
      var f=ctx.fighter(d.side),lock=f.status.confession;
      var opposingPower=ctx.fighter(ctx.other(d.side)).heroPower;
      if(((opposingPower&&opposingPower.id==='meltranix'&&opposingPower.kind==='passive')||(lock&&lock.from<=ctx.battle.turn&&(lock.until===undefined||lock.until>=ctx.battle.turn)))&&f.hand[0]!==d.card&&f.hand[f.hand.length-1]!==d.card){d.allowed=false;d.reason='자백: 손패의 첫 번째와 마지막 카드만 낼 수 있습니다.';}
    }
    if(what==='afterCounter')SIDES.forEach(function(s){
      if(!has(ctx,s,'piranha_plant'))return;var o=ctx.other(s);
      d.entries[o].forEach(function(target){
        if(target.countered&&(target.counterSourceSide===s||d.entries[s].some(function(x){return (x.targets||[]).some(function(c){return c.uid===target.card.uid;});}))){
          var live=ctx.find(o,target.card.uid);if(live)live.swallowedBy=s;
        }
      });
    });
    if(what==='damage'&&d.card&&!d.noBonus)d.value+=ctx.fighter(d.sourceSide).status.cosmicBonus||0;
    if(what==='heal'&&d.card)d.value+=ctx.fighter(d.side).status.cosmicBonus||0;
    if(what==='move'&&d.to==='excluded'&&(d.card.cardId==='ban_hammer_triple'||d.card.originalCardId==='ban_hammer_triple'))d.to='rest';
    if(what==='beforeCardCounterPower')SIDES.forEach(function(s){
      if(d.powers&&d.powers[s]&&has(ctx,s,'boo')){var ghost=ctx.fighter(s).status;ghost.ghostWalkReflectTurn=ctx.battle.turn;ghost.ghostWalkReflectPhase=ctx.battle.phase;}
      d.entries[s].forEach(function(x){if(x.def.rule==='hanar_truth'){delete x.card.copiedEffectCard;}if(x.def.rule==='hanar_truth'&&ctx.fighter(ctx.other(s)).lastDrawnCard){
        var copied=ctx.copy(ctx.fighter(ctx.other(s)).lastDrawnCard),cd=ctx.def(copied);if(!cd.unplayable&&cd.rule!=='hanar_truth'){x.card.copiedEffectCard=copied;x.effectRule=cd.rule||cd.name;x.effectUpgraded=!!copied.upgraded;}
      }});
      var o=ctx.other(s),targets=d.entries[o],own=d.entries[s];
      if(d.powers&&d.powers[s]&&has(ctx,s,'black_knight')){
        var target=ctx.pick(targets.filter(function(x){return !x.countered;}));if(target){target.countered=true;target.powerCounterBy=s;}
      }
    });
    if(what==='beforeCounter')SIDES.forEach(function(s){
      var eligible=d.entries[s].filter(function(x){return ((x.effectRule||x.def.rule)==='hanar_lie')&&(x.counterEligible===undefined?!x.countered:x.counterEligible);});
      eligible.forEach(function(x){var target=ctx.pick(d.entries[ctx.other(s)]);if(target){target.countered=true;x.didCounter=true;x.targets=x.targets||[];if(!x.targets.some(function(c){return c.uid===target.card.uid;}))x.targets.push(ctx.copy(target.card));}});
      var targets=d.entries[ctx.other(s)];
      d.entries[s].forEach(function(entry){if((entry.effectRule||entry.def.rule)==='prophecy'&&(entry.counterEligible===undefined?!entry.countered:entry.counterEligible))targets.forEach(function(target){target.countered=true;entry.didCounter=true;entry.targets.push(ctx.copy(target.card));});});
    });
  }
  return {install:install,power:power,run:run,hook:hook,modify:modify,supports:function(id){return A4.content.opponentAbilities.exclusiveCards.some(function(x){return x.id===id;});}};
}());
