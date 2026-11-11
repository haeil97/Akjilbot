/* Neutral pool revision, hand curses, resources and new neutral treasures. */
A4.Expansion=(function(){
 'use strict';
 var cardRows=[
 ['화염포','FIRE',1,'무작위 캐릭터에게 피해를 6 줍니다. 해오름: 대신 상대에게 피해를 줍니다.',1,'무작위 캐릭터에게 피해를 12 줍니다. 해오름: 대신 상대에게 피해를 줍니다.',{damage:6}],
 ['플레어드라이브','FIRE',1,'불안정, 일시적. 상대에게 피해를 8 줍니다.',1,'불안정, 일시적. 상대에게 피해를 14 줍니다.',{damage:8}],
 ['불씨','FIRE',1,'상대의 손에서 무작위 카드를 레스트로 보냅니다. 해오름: 상대에게 피해를 4 줍니다.',1,'상대의 손에서 무작위 카드를 레스트로 둘 보냅니다. 해오름: 상대에게 피해를 8 줍니다.',{control:3}],
 ['불타는 가위','FIRE',2,'일회용. 내 덱에서 무작위 카드를 내 손으로 가져옵니다. 그 카드를 내 탐험 덱에서 제거합니다. 해오름: 대신 발견합니다.',2,'일회용. 내 덱에서 무작위 카드를 내 손으로 둘 가져옵니다. 그 카드들을 내 탐험 덱에서 제거합니다. 해오름: 대신 발견합니다.',{draw:1,value:2}],
 ['아쿠아링','ICE',0,'불안정. 카드를 뽑습니다. 치명타: 카드를 추가로 뽑습니다.',0,'불안정. 카드를 2장 뽑습니다. 치명타: 카드를 추가로 뽑습니다.',{draw:1.25}],
 ['방한 고글','ICE',1,'방어도를 4 얻습니다. 방어도가 없으면 이 카드는 어디에 있든 비용이 (0)이 됩니다.',1,'방어도를 8 얻습니다. 방어도가 없으면 이 카드는 어디에 있든 비용이 (0)이 됩니다.',{shield:4}],
 ['심호흡','NATURE',0,'내 레스트를 덱에 넣고 섞습니다. 그 후에 카드를 뽑습니다.',0,'내 레스트를 덱에 넣고 섞습니다. 그 후에 카드를 2장 뽑습니다.',{draw:1}],
 ['금단의 치유술','NATURE',0,'마나를 모두 소모합니다. 소모한 마나의 4배만큼의 체력을 회복합니다.',0,'마나를 모두 소모합니다. 소모한 마나의 6배만큼의 체력을 회복합니다.',{heal:8}],
 ['가속','NATURE',1,'상대의 손패를 봅니다.',0,'상대의 손패를 봅니다.',{value:1.5}],
 ['강풍','NATURE',2,'불안정. 상대에게 피해를 8 주고 상대의 손에서 무작위 카드를 상대의 레스트로 보냅니다. 내가 다음에 내는 카드가 불안정을 얻습니다.',2,'불안정. 상대에게 피해를 14 주고 상대의 손에서 무작위 카드 둘을 상대의 레스트로 보냅니다. 내가 다음에 내는 카드가 불안정을 얻습니다.',{damage:8,control:3}],
 ['꿈 숨결','NATURE',2,'일회용. 카드를 뽑습니다. 내 손에 자연 카드가 둘 있으면, 내 최대 마나가 1 증가합니다.',2,'선천성, 일회용. 카드를 뽑습니다. 내 손에 자연 카드가 있으면, 내 최대 마나가 1 증가합니다.',{draw:1,value:4}],
 ['살라드라실','NATURE',4,'일회용. 내 손, 덱, 레스트에 있는 모든 강화되지 않은 카드를 강화합니다.',3,'일회용. 내 손, 덱, 레스트에 있는 모든 강화되지 않은 카드를 강화합니다.',{value:10}],
 ['이건 내 거야!','LIGHTNING',0,'과부하: (1). 과부하 카드를 발견하여 내 손으로 가져옵니다.',0,'과부하: (1). 과부하 카드를 둘 발견하여 내 손으로 가져옵니다.',{draw:1,overload:1}],
 ['송전','LIGHTNING',1,'내 손에서 카드를 발견합니다. 그 카드를 이번 전투 동안 강화합니다.',1,'내 손에서 카드를 둘 발견합니다. 그 카드를 이번 전투 동안 강화합니다.',{value:3}],
 ['볼트태클','LIGHTNING',2,'상대에게 피해를 10 줍니다. 이번 전투에서 이 카드의 비용이 1 감소합니다.',2,'상대에게 피해를 15 줍니다. 이번 전투에서 이 카드의 비용이 1 감소합니다.',{damage:10}],
 ['축복','HOLY',2,'일회용. 내 손에서 카드를 발견합니다. 그 카드를 이번 탐험 동안 강화합니다.',1,'선천성, 일회용. 내 손에서 카드를 발견합니다. 그 카드를 이번 탐험 동안 강화합니다.',{value:5}]
 ];
 var passives=[
 ['golden_forge','low','황금 대장간','전투가 시작될 때, 내 손에서 무작위 카드를 이번 탐험 동안 강화합니다.'],
 ['velvet_choker','low','벨벳 초커','전투가 시작될 때, 내 최대 마나가 1 증가합니다. 각 메인 페이즈에 카드를 1장만 낼 수 있습니다.'],
 ['mystery_tome','low','수수께끼의 고서','전투가 시작될 때, 무작위 하급 보물 셋을 내 덱에 섞어 넣습니다.'],
 ['creators_gate','low','창조자의 관문','내 카드들이 게임에서 제외될 때마다 대신 레스트로 이동합니다.'],
 ['icarus_wings','low','이카루스의 날개','내 최대 마나가 3으로 고정됩니다.'],
 ['acceleration_potion','low','가속의 물약','매 턴의 스탠바이 페이즈시에 카드를 추가로 뽑습니다. 내 손패 한도를 초과하여 카드를 뽑으면 첫 번째 카드가 내 덱으로 되돌아갑니다.'],
 ['absurd_scroll','low','터무니 없는 두루마리','전투 시작 시 내가 위력을 5 얻습니다. 매 턴의 스탠바이 페이즈시에 위력을 1 잃습니다.'],
 ['vip_membership','low','VIP 회원권','선술집의 물품이 할인됩니다!'],
 ['singularity','high','특이점','내 카드들이 게임에서 제외될 때마다 무작위 하급 보물을 내 손으로 가져옵니다.'],
 ['emerald_goggles','high','에메랄드 고글','내 손패에서 첫 번째에 있는 카드의 비용이 (1) 감소합니다.']
 ];
 var allowed='과열|금단의 불꽃|벼려내기|불길|영혼관|마나 연소|불장난|소각|작열통|절멸|점화|제독|태양 작렬|폭발의 룬|화염 장막|화염구|화염포|플레어드라이브|불씨|백드래프트|번아웃|불타는 가위|화염 제단|불안정한 원소|불덩이 작렬|겨울의 뿔피리|아쿠아링|급속 빙결|냉동 캡슐|대 한파|동면|북부 항해|얼어붙은 버클러|얼음 거울|얼음 덫|얼음 방패|완전 빙결|확고한 알리바이|방한 고글|얼음 회오리|칼바람|심호흡|수중 동물 변신|광합성|먹음직스러운 덥석멜론|산사태|살아 움직이는 숲|왕성한 진균|이슬 절차|초고속|흡수|가속|굽이치는 파도|치유의 손길|풍요|강풍|꿈 숨결|기적같은 성장|자연화|폭풍 인도기|살라드라실|궁극의 역병|접붙이기|부스터 팩|선조의 지혜|전선|찌릿!|초과 인출|이건 내 거야!|긴급 차단|단락|마비|무덤의 지명자|믹스테이프|전류 공급|전이|천둥|충전|파지직|송전|볼트태클|두꺼비집|번개|연쇄 번개|고철 더미에서|마법공학: 니비루|마법공학: 아틀라스|마법공학: 퓨즈|기도|안도|예지|윤회|하늘의 선물|계시|배교|불굴|성지순례|심판|운명|축성|필연|황금궤|성전|축복|신의 권능: 가속|신의 권능: 성역|신의 권능: 응징|신의 권능: 징벌'.split('|');
 function own(f,id){return A4.TreasureRules.owns(f,id);}
 function state(f){return f.status.expansion||(f.status.expansion={});}
 function task(s,op,extra){var t={module:'expansion',side:s,op:op};Object.keys(extra||{}).forEach(function(k){t[k]=extra[k];});return t;}
 function flags(d){d.unstable=/불안정/.test(d.text);d.temporary=/일시적/.test(d.text);d.excludeOnUse=/일회용/.test(d.text);d.innate=/선천성/.test(d.text);}
 function install(c){
  cardRows.forEach(function(row){var d={name:row[0],element:row[1],cost:row[2],text:row[3],rule:row[0],module:'expansion',effects:[],ai:row[6]},u={cost:row[4],text:row[5],module:'expansion',rule:row[0]};flags(d);flags(u);d.upgrade=u;c.cards['general:'+row[0]]=d;});
  c.cardPool=allowed.map(function(name){var found=Object.keys(c.cards).filter(function(id){var d=c.cards[id];return !d.classCard&&!d.treasure&&d.name===name;})[0];A4.assert(found,'중립 카드 누락: '+name);return found;});
  Object.keys(c.cards).forEach(function(id){var d=c.cards[id];if(!d.treasure)d.neutralCard=c.cardPool.indexOf(id)>=0;});
  ['고드름','저주','혹한'].forEach(function(name){var id=A4.CardRules.nameToId(name),d=c.cards[id];d.element='CURSE';d.displayElement='💔';d.unplayable=true;d.temporary=true;d.excludeOnUse=false;d.upgrade.element='CURSE';d.upgrade.displayElement='💔';d.upgrade.unplayable=true;d.upgrade.temporary=true;d.upgrade.excludeOnUse=false;
   if(name==='고드름')d.text=d.upgrade.text='사용불가, 일시적. 이 카드가 내 손에 있으면, 이 카드의 양쪽에 있는 카드들의 비용이 (1) 증가합니다.';
   else if(name==='저주'){d.text='사용불가, 일시적. 이 카드가 내 손에 있으면, 매 턴의 엔드 페이즈시에 나에게 피해를 3 줍니다.';d.upgrade.text=d.text.replace('3','5');}
   else {d.text='사용불가, 일시적. 이 카드가 레스트로 이동할 때, 대신 이 카드를 게임에서 제외하고 서로 카드를 1장 뽑습니다.';d.upgrade.text='사용불가, 일시적. 이 카드가 레스트로 이동할 때, 대신 이 카드를 게임에서 제외하고 상대가 카드를 1장 뽑습니다.';}
  });
  var alibi=c.cards[A4.CardRules.nameToId('확고한 알리바이')];alibi.unstable=true;alibi.text='불안정. 2턴 후의 엔드 페이즈시까지 내가 한 번에 받는 피해가 1로 고정됩니다.';alibi.upgrade.unstable=false;
  var forge=c.cards[A4.CardRules.nameToId('벼려내기')];forge.text='상대에게 피해를 4 줍니다. 일시적인 무작위 화염 카드를 얻습니다.';forge.upgrade.text='상대에게 피해를 8 줍니다. 일시적인 무작위 화염 카드를 2장 얻습니다.';
  passives.forEach(function(row){c.treasures[row[0]]={id:row[0],tier:row[1],kind:'passive',name:row[2],text:row[3],effects:[{type:'treasurePassive',id:row[0],module:'expansion'}]};});
  c.treasures.shaladrassil.retired=true;c.treasures.judge_ring.excludeHeroes=['celeste','agamaggan'];
  c.cards.treasure_starburst={name:'스타버스트',element:'HOLY',cost:1,text:'일회용. 상대의 방어도를 파괴합니다.',treasure:true,treasureId:'starburst',rule:'starburst',module:'expansion',excludeOnUse:true,effects:[],ai:{control:4}};
  c.treasures.starburst={id:'starburst',tier:'low',kind:'card',name:'스타버스트',text:c.cards.treasure_starburst.text,cardId:'treasure_starburst'};
  c.neutralTreasurePool=Object.keys(c.treasures).filter(function(id){return !c.treasures[id].classId&&!c.treasures[id].retired;});
  c.cardPool.forEach(function(id){c.cards[id].shopPrice=Math.min(6,3+(c.cards[id].cost||0));});
  return c;
 }
 function lowTreasure(ctx,side,zone){var f=ctx.fighter(side),ids=Object.keys(ctx.catalog.treasures).filter(function(id){var d=ctx.catalog.treasures[id];return !d.retired&&d.tier==='low'&&(!d.classId||d.classId===f.heroId);});if(!ids.length)return;var d=ctx.catalog.treasures[ctx.pick(ids)];if(d.kind==='card')return ctx.generate(side,d.cardId,{zone:zone||'hand'});var x=ctx.generate(side,'treasure_token:'+d.id,{zone:zone||'hand'});return x;}
 function installTokens(c){Object.keys(c.treasures).forEach(function(id){var d=c.treasures[id];if(d.kind==='passive'&&!d.retired)c.cards['treasure_token:'+id]={name:d.name,element:'NEUTRAL',cost:0,text:'일회용. '+d.text,treasure:true,treasureId:id,rule:'claimTreasure',claimedTreasureId:id,module:'expansion',excludeOnUse:true,effects:[],ai:{value:6}};});}
 function upgrade(ctx,side,x,persistent){if(ctx.upgrade(x)&&persistent)ctx.runChange({type:'upgradeCard',side:side,uid:x.uid,runUid:x.runUid||x.originUid});}
 function choose(ctx,s,list,op,extra){if(list.length)ctx.discover(s,list,task(s,op,extra),{sourceZone:op==='upgrade'||op==='bless'?'hand':'deck'});}
 function run(ctx,t){
  var s=t.side,f=ctx.fighter(s),o=ctx.other(s),foe=ctx.fighter(o),b=ctx.battle,d=t.def||t.card&&ctx.def(t.card)||{},name=t.op||d.rule,up=d.upgraded===undefined?!!(t.card&&t.card.upgraded):d.upgraded,n=up?2:1,x,list,now=b.turn,sun=(b.resolution&&b.resolution.phase||b.phase)==='MAIN1';
  if(name==='scissorsChoice'){if(t.choice){x=ctx.find(s,t.choice.uid);if(x&&f.deck.some(function(a){return a.uid===x.uid;})){ctx.move(s,x.uid,'hand');ctx.runChange({type:'removeCard',side:s,uid:x.uid,runUid:x.runUid});}}if(t.remaining>1)choose(ctx,s,f.deck.slice(),'scissorsChoice',{remaining:t.remaining-1});return true;}
  if(name==='upgrade'||name==='bless'){if(t.choice){x=ctx.find(s,t.choice.uid);if(x)upgrade(ctx,s,x,name==='bless');}if(t.remaining>1)choose(ctx,s,f.hand.filter(function(a){return !a.upgraded&&ctx.catalog.cards[a.cardId].upgrade;}),name,{remaining:t.remaining-1});return true;}
  if(name==='overloadChoice'){if(t.choice)ctx.generate(s,t.choice.cardId);if(t.remaining>1)choose(ctx,s,ctx.catalog.cardPool.filter(function(id){return /과부하/.test(ctx.catalog.cards[id].text);}).map(function(id){return {cardId:id};}),'overloadChoice',{remaining:t.remaining-1});return true;}
  if(name==='꿈 숨결 확인'){if(f.hand.filter(function(a){return ctx.def(a).element==='NATURE';}).length>=t.minimum){f.manaGrowth=(f.manaGrowth||0)+1;f.maxMana=Math.min(5,f.maxMana+1);A4.Keywords.observe(f);}return true;}
  switch(name){
  case '화염포':ctx.damage(s,sun?o:ctx.pick([s,o]),up?12:6);break;
  case '플레어드라이브':ctx.damage(s,o,up?14:8);break;
  case '불씨':ctx.sample(foe.hand,n).forEach(function(a){ctx.move(o,a.uid,'rest');});if(sun)ctx.damage(s,o,up?8:4);break;
  case '불타는 가위':if(sun)choose(ctx,s,f.deck.slice(),'scissorsChoice',{remaining:n});else ctx.sample(f.deck,n).forEach(function(a){ctx.move(s,a.uid,'hand');ctx.runChange({type:'removeCard',side:s,uid:a.uid,runUid:a.runUid});});break;
  case '아쿠아링':ctx.draw(s,n+(t.critical?1:0));break;
  case '방한 고글':ctx.shield(s,up?8:4);break;
  case '심호흡':f.rest.slice().forEach(function(a){ctx.move(s,a.uid,'deck');});ctx.shuffle(f.deck);ctx.draw(s,n);break;
  case '금단의 치유술':x=f.mana;f.mana=0;ctx.heal(s,x*(up?6:4));break;
  case '가속':if(s==='player')ctx.note('text',s,0,{text:'상대 손패: '+(foe.hand.map(function(a){return ctx.def(a).name;}).join(', ')||'없음')});break;
  case '강풍':ctx.damage(s,o,up?14:8);ctx.sample(foe.hand,n).forEach(function(a){ctx.move(o,a.uid,'rest');});state(f).nextUnstable=true;break;
  case '꿈 숨결':ctx.draw(s,1);ctx.enqueue(task(s,'꿈 숨결 확인',{minimum:up?1:2}));break;
  case '살라드라실':['hand','deck','rest'].forEach(function(z){f[z].forEach(function(a){ctx.upgrade(a);});});break;
  case '이건 내 거야!':ctx.overload(s,1);choose(ctx,s,ctx.catalog.cardPool.filter(function(id){return /과부하/.test(ctx.catalog.cards[id].text);}).map(function(id){return {cardId:id};}),'overloadChoice',{remaining:n});break;
  case '송전':case '축복':choose(ctx,s,f.hand.filter(function(a){return !a.upgraded&&ctx.catalog.cards[a.cardId].upgrade;}),name==='축복'?'bless':'upgrade',{remaining:name==='축복'?1:n});break;
  case '볼트태클':ctx.damage(s,o,up?15:10);x=ctx.find(s,t.card.uid);if(x)x.permanentBattleDiscount=(x.permanentBattleDiscount||0)+1;break;
  case 'starburst':ctx.shield(o,-foe.shield);break;
  case 'claimTreasure':var id=d.claimedTreasureId||ctx.catalog.cards[t.card.cardId].claimedTreasureId;if(id&&!own(f,id)){f.treasureIds.push(id);f.passives=f.passives.concat(ctx.copy(ctx.catalog.treasures[id].effects||[]));}break;
  default:return false;
  }return true;
 }
 function modify(ctx,what,d){var f=ctx.fighter(d.side||d.sourceSide||ctx.side),st=state(f),b=ctx.battle;
  if(what==='move'&&d.to==='excluded'&&own(f,'creators_gate'))d.to='rest';
  if(what==='handOverflow'&&d.draw&&own(f,'acceleration_potion'))d.cycleFirst=true;
  if(what==='maximumMana'&&own(f,'icarus_wings'))d.value=3;
  if(what==='cardCost'){d.value=Math.max(0,d.value-(d.card.permanentBattleDiscount||0));if(d.def.rule==='방한 고글'&&!f.shield)d.value=0;if(own(f,'emerald_goggles')&&f.hand[0]&&d.card.uid===f.hand[0].uid)d.value=Math.max(0,d.value-1);}
  if(what==='submission'&&own(f,'velvet_choker')&&d.uids.length>1){d.allowed=false;d.reason='벨벳 초커: 각 메인 페이즈에는 카드 1장만 낼 수 있습니다.';}
  if(what==='element'&&d.def.element==='CURSE'){d.value='CURSE';}
  if(what==='beforeCounter'){
   ['player','enemy'].forEach(function(s){var st=state(ctx.fighter(s)),entries=d.entries[s];if(st.nextUnstable&&entries.length){var first=entries[0];st.nextUnstable=false;first.def.unstable=true;var other=d.entries[ctx.other(s)];other.forEach(function(a){if(a.def.element===first.def.element&&a.def.element!=='CURSE'){first.countered=true;a.didCounter=true;a.targets=a.targets||[];a.targets.push(ctx.copy(first.card));}});}});
  }
 }
 function hook(ctx,e){var b=ctx.battle;
  ['player','enemy'].forEach(function(s){var f=ctx.fighter(s),st=state(f);
   if(e.type==='battleStart'&&!st.started){st.started=true;
    if(own(f,'velvet_choker')){f.manaGrowth=(f.manaGrowth||0)+1;f.maxMana=Math.min(5,f.maxMana+1);f.mana=Math.min(5,f.mana+1);}
    if(own(f,'icarus_wings')){f.maxMana=3;f.mana=3;}
    if(own(f,'golden_forge')){var options=f.hand.filter(function(a){return !a.upgraded&&ctx.catalog.cards[a.cardId].upgrade;});if(options.length)upgrade(ctx,s,ctx.pick(options),true);}
    if(own(f,'mystery_tome')){for(var i=0;i<3;i++)lowTreasure(ctx,s,'deck');ctx.shuffle(f.deck);}
    if(own(f,'absurd_scroll')){f.status.classes=f.status.classes||{};f.status.classes.powerBonus=(f.status.classes.powerBonus||0)+5;st.scrollPower=5;}
   }
   if(e.type==='standby'&&st.standby!==b.turn){st.standby=b.turn;if(own(f,'icarus_wings'))f.maxMana=3;if(own(f,'acceleration_potion'))ctx.draw(s,1);if(own(f,'absurd_scroll')&&st.scrollPower>0){st.scrollPower--;f.status.classes.powerBonus=Math.max(0,(f.status.classes.powerBonus||0)-1);}}
   if(e.type==='cardExcluded'&&e.side===s&&own(f,'singularity'))lowTreasure(ctx,s);
  });
 }
 function evaluate(d,m,f,foe,b,c){
  var up=!!d.upgraded,n=up?2:1,enemyHand=foe.handCount===undefined?(foe.hand||[]).length:foe.handCount,hand=f.hand||[],deck=f.deck||[],rest=f.rest||[],sun=b.phase==='MAIN1';
  switch(d.rule){
  case '화염포':m.damage=(up?12:6)*(sun?1:0.5);m.selfDamage=sun?0:(up?12:6)*0.5;break;
  case '플레어드라이브':m.damage=up?14:8;break;
  case '불씨':m.control=Math.min(enemyHand,n)*2.4;m.damage=sun?(up?8:4):0;break;
  case '불타는 가위':m.draw=Math.min(deck.length,n);m.value=m.draw*0.8;break;
  case '아쿠아링':m.draw=n+(f.aiCounterChance===undefined?0.25:f.aiCounterChance);break;
  case '방한 고글':m.shield=up?8:4;break;
  case '심호흡':m.draw=Math.min(deck.length+rest.length,n);break;
  case '금단의 치유술':m.heal=Math.max(0,(f.mana||0)-(f.aiPaidBatch?0:d.cost||0))*(up?6:4);m.priority=9;break;
  case '가속':m.value=enemyHand?1.5:0;break;
  case '강풍':m.damage=up?14:8;m.control=Math.min(enemyHand,n)*2.2;m.value=-1;break;
  case '꿈 숨결':m.draw=1;m.value=hand.filter(function(x){return c.cards[x.cardId]&&c.cards[x.cardId].element==='NATURE'&&x.uid!==d.uid;}).length>=(up?1:2)&&f.maxMana<5?6:0;break;
  case '살라드라실':m.value=hand.concat(deck,rest).filter(function(x){return !x.upgraded&&c.cards[x.cardId]&&c.cards[x.cardId].upgrade&&!c.cards[x.cardId].treasure;}).length*1.5;break;
  case '이건 내 거야!':m.draw=n;m.overload=1;break;
  case '송전':case '축복':m.value=Math.min(d.rule==='축복'?1:n,hand.filter(function(x){return !x.upgraded&&c.cards[x.cardId]&&c.cards[x.cardId].upgrade;}).length)*(d.rule==='축복'?5:2.5);break;
  case '볼트태클':m.damage=up?15:10;m.value=Math.max(0,d.cost||0)*0.5;break;
  case 'starburst':m.control=(foe.shield||0)*0.65;break;
  case 'claimTreasure':m.value=6;break;
  }
 }
 return {install:function(c){install(c);installTokens(c);},run:run,hook:hook,modify:modify,evaluate:evaluate,supports:function(rule){return ['claimTreasure','starburst'].indexOf(rule)>=0||cardRows.some(function(r){return r[0]===rule;});},lowTreasure:lowTreasure};
}());
