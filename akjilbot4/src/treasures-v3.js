/* Approved 4.0.0 treasures. ES5; no runtime file or Node dependencies. */
A4.TreasureRules = (function () {
  var definitions = [
    ['recycling_bin','low','passive','재활용 쓰레기통',null,null,'내 카드가 카운터당할 때마다 방어도를 5 얻습니다.'],
    ['lucky_shovel','low','passive','행운의 삽',null,null,'한 턴에 한 번, 내가 카드를 발견한 후에, 그 카드를 복사하여 내 손으로 가져옵니다. 그 카드들의 비용이 (1) 감소합니다.'],
    ['philosopher_stone','low','passive','현자의 돌',null,null,'내가 비용이 (2) 이상인 카드를 낸 후에, 내 손에 있는 카드들의 비용이 (1) 감소합니다.'],
    ['zephrys_lamp','low','card','제피르스의 램프','LIGHTNING',0,'원하는 카드를 검색하여 내 손으로 가져옵니다.'],
    ['infinity_stone','high','card','인피니티 스톤','FIRE',4,'상대의 모든 것을 절반 파괴합니다.'],
    ['innate_talent','high','card','천부적 재능','HOLY',2,'선천성, 일회용. 비용이 0인 강화된 카드를 발견합니다. 내 영웅 능력이 비용이 (1)인 그 카드로 바뀝니다.'],
    ['molten_bone','low','passive','녹아내린 뼈',null,null,'상대에게 중독을 부여할 때마다, 1 더 부여합니다.'],
    ['antarctic_clock','low','passive','남극 시계',null,null,'내가 비용이 0인 카드를 낼 때마다 상대에게 피해를 4 줍니다.'],
    ['shaladrassil','high','card','살라드라실','NATURE',4,'내 손, 덱, 레스트에 있는 모든 강화되지 않은 카드를 강화합니다.'],
    ['time_potion','high','passive','시간 왜곡 물약',null,null,'내 모든 카드가 일시적이 됩니다. 매 스탠바이 페이즈시마다 카드를 4장 뽑습니다.'],
    ['decay_potion','high','passive','부패 물약',null,null,'상대에게 부여된 중독이 감소하지 않지만, 상대에게 중독을 부여할 때마다 나에게도 부여합니다.'],
    ['mana_receipt','low','passive','마나 영수증',null,null,'메인 페이즈 1에서 카드 비용으로 마나를 2 이상 소모했다면, 메인 페이즈 2가 시작될 때 마나를 1 회복합니다.'],
    ['endless_waves','low','passive','끝없는 파도',null,null,'엔드 페이즈시에 손패가 2장 이하라면, 다음 턴의 스탠바이 페이즈시에 카드를 뽑습니다.'],
    ['prism_compass','low','passive','프리즘 나침반',null,null,'턴에 처음 직접 사용하는 카드의 속성이 이전 턴에 처음 직접 사용한 카드와 다르면, 그 카드의 비용이 1 감소합니다. 단, 1보다 낮아지진 않습니다.'],
    ['pelgozi_wallet','low','passive','펠고지의 지갑',null,null,'내 손패 한도가 3장 증가합니다.'],
    ['twin_ring','low','passive','쌍둥이 반지',null,null,'한 턴에 처음으로 같은 속성의 카드를 사용하면 카드를 뽑습니다.'],
    ['loaded_dice','low','passive','사기 주사위',null,null,'매 턴의 스탠바이 페이즈시에 내 덱에서 카드를 뽑는 대신 카드를 발견하여 내 손으로 가져옵니다.'],
    ['magic_mirror_passive','low','passive','보석 팬던트',null,null,'턴에 처음으로 카드를 발견하면, 선택하지 않은 선택지 중 1장도 내 손으로 가져옵니다.'],
    ['lightning_rod','low','passive','피뢰침',null,null,'내 마나가 과부하될 때마다 과부하된 마나당 상대에게 피해를 6 줍니다.'],
    ['archmage_robe','low','passive','대마도사의 로브',null,null,'내 카드들의 피해량이 2 증가합니다.'],
    ['first_aid_kit','low','passive','응급 치료 키트',null,null,'매 턴의 엔드 페이즈시마다, 체력을 3 회복합니다.'],
    ['judge_ring','high','passive','심판관의 반지',null,null,'내 영웅 능력의 비용이 (0)이 됩니다.'],
    ['mystic_coin','low','card','신비한 동전','LIGHTNING',0,'메인 페이즈 1에 사용하면 이번 턴에만 마나를 1 얻습니다. 메인 페이즈 2에 사용하면 체력을 10 회복합니다.'],
    ['grave_pick','low','card','도굴꾼의 곡괭이','ICE',1,'내 레스트에서 카드를 3장 발견하여 손으로 가져옵니다. 그 카드들의 비용이 (1) 감소합니다. 단, 1보다 낮아지진 않습니다.'],
    ['paper_clone','low','card','종이 분신','FIRE',1,'내 손의 무작위 카드를 일시적, 일회용으로 복사합니다. 그 카드의 비용이 (0)이 됩니다.'],
    ['escape_key','low','card','비상구 열쇠','NATURE',0,'일회용. 이번 턴에 내 카드가 레스트로 보내질 때마다 카드를 뽑습니다. 내 손에 있는 모든 카드를 레스트로 보냅니다.'],
    ['empty_grail','low','card','빈 잔의 성배','HOLY',1,'내 레스트의 카드가 내 덱의 카드보다 많으면 체력을 20 회복합니다. 그렇지 않으면 카드를 3장 뽑습니다.'],
    ['wonder_wand','low','card','불가사의한 마법봉','FIRE',1,'카드를 2장 뽑습니다. 그 카드들의 비용이 (0)이 됩니다.'],
    ['thief_hook','low','card','도둑의 갈고리','ICE',0,'상대의 손에서 카드를 발견하여 상대의 레스트로 보냅니다. 내 레스트에서 카드를 발견하여 내 손으로 가져옵니다.'],
    ['sealed_reliquary','low','card','봉인된 유물함','NATURE',1,'일회용. 하급 보물을 발견하여 내 손으로 가져옵니다.'],
    ['cassette','low','card','카세트테이프','LIGHTNING',1,'지난 턴에 상대가 사용했던 카드들을 복사하여 내 손으로 가져오고 탐험 덱에 추가합니다.'],
    ['exchange_deed','low','card','교환 증서','LIGHTNING',0,'일회용. 서로의 손에 있는 카드를 모두 바꿉니다.'],
    ['magic_mirror_card','low','card','마법 거울','ICE',2,'일회용. 상대의 영웅 능력을 복사하여 이번 탐험 동안 얻습니다.'],
    ['tolins_cup','low','card','톨린의 술잔','FIRE',0,'카드를 뽑습니다. 그 카드를 복사하여 내 손을 가득 채웁니다.'],
    ['gambling_box','low','card','도박의 함','HOLY',2,'일회용. 모든 덱과 레스트를 한데 섞은 후, 상대와 반씩 나누어 각자의 덱으로 나누어 가집니다. 그 후 내 덱에 있는 모든 카드들의 비용을 (1) 감소시킵니다. 단, 1보다 낮아지진 않습니다.'],
    ['full_bag','low','card','가득 찬 가방','NATURE',0,'내 손이 가득 찰 때까지 카드를 뽑습니다.'],
    ['runeterra_codex','high','passive','룬테라의 비전서',null,null,'엔드 페이즈시에 남은 마나를 최대 2까지 저장합니다. 다음 스탠바이 페이즈시에, 저장한 만큼 일시적인 마나를 얻습니다.'],
    ['hearthstone','high','card','귀환석','NATURE',0,'선천성. 전투 시작 전으로 탈출하고 이 카드를 내 탐험 덱에서 제거합니다.'],
    ['element_distiller','high','passive','프리즘 증류기',null,null,'매 턴의 스탠바이 페이즈시에, 화염·냉기·자연·전기 중 원하는 속성을 선택하여 뽑을 수 있습니다.'],
    ['echo_shard','high','passive','메아리 조각',null,null,'내가 턴에 처음으로 상대 카드를 카운터하면, 그 카드를 복사하여 내 손으로 가져옵니다. 그 카드의 비용이 (1) 감소합니다.'],
    ['enchant_table','high','passive','인챈트 테이블',null,null,'내가 영웅 능력을 사용할 때마다 내 손에 있는 무작위 카드를 강화합니다.'],
    ['loser_gramophone','low','passive','패자의 축음기',null,null,'매 턴의 엔드 페이즈시에, 이번 턴에 처음으로 카운터당한 내 카드를 레스트에서 내 손으로 가져옵니다.'],
    ['grandmage_staff','high','passive','대마법사의 지팡이',null,null,'매 턴의 스탠바이 페이즈시에, 무작위 카드를 내 손으로 가져옵니다. 그 카드는 일회용입니다.'],
    ['nature_hourglass','high','card','자연의 모래시계','NATURE',1,'이 카드는 메인 페이즈 1에만 사용할 수 있습니다. 이번 턴의 메인 페이즈 2에 마나를 모두 회복하고 카드를 2장 뽑습니다.'],
    ['pickpocket_gloves','high','card','소매치기 장갑','ICE',0,'상대의 손에서 카드를 2장 훔쳐옵니다.'],
    ['nether_portal','high','card','네더 차원문','HOLY',0,'이번 게임에서 제외된 내 카드를 발견합니다. 그 카드의 비용이 (0)이 됩니다.'],
    ['horizon_cutter','high','card','지평선 절단기','FIRE',0,'일시적. 내 레스트에 있는 카드의 2배만큼 상대에게 피해를 줍니다.'],
    ['mirage','low','card','신기루','NATURE',0,'내 손에 있는 카드들을 내 덱의 무작위 카드 8장으로 교체합니다. 이번 턴의 엔드 페이즈시에 원래 카드들로 돌아옵니다.'],
    ['wish','high','card','소원','HOLY',5,'일회용. 체력을 전부 회복하고 내 손이 가득 찰 때까지 카드를 뽑습니다.'],
    ['starlight_disassembler','high','card','별빛 분해기','HOLY',1,'상대가 낸 카드들을 모두 카운터합니다.'],
    ['destruction_orb','high','card','파괴의 구슬','FIRE',1,'일회용. 상대의 마나 수정을 1개 파괴하고 상대의 손에서 카드를 2장 레스트로 보냅니다.'],
    ['roasting_wand','high','card','통구이 마법봉','FIRE',3,'누군가 죽을 때까지 무작위 캐릭터에게 막거나 줄일 수 없는 피해를 10 줍니다.'],
    ['time_warp','high','card','시간 왜곡','ICE',1,'다음 턴에 상대가 카드를 낼 수 없게 만듭니다.'],
    ['acceleration_boots','high','card','가속의 장화','NATURE',2,'이 카드는 메인 페이즈 1에만 사용할 수 있습니다. 이번 턴의 메인 페이즈 2에 내 카드들의 비용이 (0)이 됩니다.']
  ];
  var oneUse = ['innate_talent','escape_key','sealed_reliquary','exchange_deed','magic_mirror_card','gambling_box','wish','destruction_orb'];
  var icons = {FIRE:'🔥',ICE:'❄️',NATURE:'🍃',LIGHTNING:'⚡',HOLY:'🕊️',NEUTRAL:'🌊'};
  function install(catalog) {
    catalog.treasures = catalog.treasures || {};
    definitions.forEach(function (row) {
      var id = row[0], tier = row[1], kind = row[2], marker = tier === 'low' ? '✨' : '💫';
      var treasure = {id:id,name:row[3],tier:tier,kind:kind,text:row[6],displayIcon:marker};
      if (kind === 'card') {
        var cardId = 'treasure_' + id;
        treasure.cardId = cardId;
        catalog.cards[cardId] = {name:row[3],element:row[4],cost:row[5],text:row[6],treasure:true,treasureId:id,treasureTier:tier,displayIcon:icons[row[4]]+marker,upgradeable:false,rule:id,module:'treasures',effects:[]};
        if (oneUse.indexOf(id) >= 0) catalog.cards[cardId].excludeOnUse = true;
        if (/선천성/.test(row[6])) catalog.cards[cardId].innate = true;
        if (id === 'horizon_cutter') catalog.cards[cardId].temporary = true;
        if (id === 'nature_hourglass' || id === 'acceleration_boots') catalog.cards[cardId].main1Only = true;
        if (id === 'starlight_disassembler') catalog.cards[cardId].counterAll = true;
      } else treasure.effects = [{type:'treasurePassive',id:id,treasureId:id,module:'treasures'}];
      catalog.treasures[id] = treasure;
    });
    return catalog;
  }
  var policy = {twinRingPerElement:false,copiedPowerMode:'replace'};
  function state(f) { if (!f.status) f.status={}; if (!f.status.treasures) f.status.treasures={}; return f.status.treasures; }
  function owns(f,id) {
    if ((f.treasureIds || []).indexOf(id) >= 0) return true;
    return (f.passives || []).some(function (p) {return p.type==='treasurePassive' && p.id===id;});
  }
  function removeOwned(f,id) {
    f.treasureIds=(f.treasureIds||[]).filter(function (x) {return x!==id;});
    f.passives=(f.passives||[]).filter(function (p) {return !(p.type==='treasurePassive' && p.id===id);});
  }
  function allSides(fn) { ['player','enemy'].forEach(fn); }
  function sourced(ctx,side,id,fn){var t=ctx.catalog.treasures[id];return ctx.withSource(side,t.kind==='card'?ctx.catalog.cards[t.cardId]:{name:t.name,displayElement:t.tier==='high'?'💫':'✨'},fn);}
  function copyInto(ctx,side,card,overrides,zone) {
    var args=ctx.copy(card), key;
    delete args.uid; delete args.runCardUid; delete args.runUid;
    if (overrides) for(key in overrides) if(A4.has(overrides,key)) args[key]=overrides[key];
    if(zone) args.zone=zone;
    return ctx.generate(side,card.cardId,args);
  }
  function handMove(ctx,side,card,sourceSide) {
    var detached=ctx.remove(sourceSide || side,card.uid);
    return detached ? ctx.add(side,detached,'hand') : null;
  }
  function hasCardIn(f,zone,uid) { return !!f[zone] && f[zone].some(function(c){return c.uid===uid;}); }
  function task(side,op,extra) {
    var out={module:'treasures',kind:'custom',side:side,op:op}, key;
    var id={nextWaves:'endless_waves',askElement:'element_distiller',elementChoice:'element_distiller',askBasicDiscover:'loaded_dice',basicDiscover:'loaded_dice'}[op];
    if(id){var row=definitions.filter(function(x){return x[0]===id;})[0];out.displaySource={side:side,label:{name:row[3],displayElement:row[1]==='high'?'💫':'✨'}};}
    if(extra) for(key in extra) if(A4.has(extra,key)) out[key]=extra[key];
    return out;
  }
  function temporaryCost(card,cost,until) {
    if (!card.treasureCostRestore) card.treasureCostRestore={hasCost:A4.has(card,'cost'),cost:card.cost===undefined?null:card.cost,costDelta:card.costDelta||0,costFloor:card.costFloor||0,until:until};
    else card.treasureCostRestore.until=Math.max(card.treasureCostRestore.until,until);
    card.cost=cost;delete card.costDelta;delete card.costFloor;
  }
  function decreaseCost(ctx,side,card,amount) { var current=ctx.cost(side,card); card.cost=current===0?0:Math.max(1,current-amount);delete card.costDelta;delete card.costFloor; }
  function discoverMove(ctx,side,zone,count,options) {
    var list=ctx.fighter(side)[zone].slice();
    if(!list.length || !count) return;
    ctx.discover(side,list,task(side,'discoverMove',{zone:zone,remaining:count,discount:options&&options.discount||0,zeroUntil:options&&options.zeroUntil,zeroCost:!!(options&&options.zeroCost)}),{label:zone==='rest'?'레스트에서 가져올 카드':'제외 영역에서 돌아올 카드',sourceZone:zone});
  }
  function drawToFull(ctx,side) { return ctx.draw(side,Math.max(0,ctx.limit(side)-ctx.fighter(side).hand.length)); }
  function run(ctx,t) {
    var side=t.side, self=ctx.fighter(side), enemy=ctx.other(side), foe=ctx.fighter(enemy), s=state(self), b=ctx.battle;
    var id=t.op || t.power && t.power.rule || t.def && t.def.rule || t.card && ctx.def(t.card).rule, card, cards, opts, power, i, all;
    if(id==='discoverMove') {
      if(t.choice) {
        card=ctx.find(side,t.choice.uid);
        if(card && hasCardIn(self,t.zone,card.uid)) {
          if(t.discount) decreaseCost(ctx,side,card,t.discount);
          if(t.zeroUntil!==undefined) temporaryCost(card,0,t.zeroUntil);
          if(t.zeroCost){card.cost=0;delete card.costDelta;delete card.costFloor;delete card.treasureCostRestore;}
          handMove(ctx,side,card);
        }
      }
      discoverMove(ctx,side,t.zone,t.remaining-1,{discount:t.discount,zeroUntil:t.zeroUntil,zeroCost:t.zeroCost});
      return true;
    }
    if(id==='basicDiscover') {
      if(t.choice && hasCardIn(self,'deck',t.choice.uid)) {
        ctx.draw(side,1,function(d,c){return c.uid===t.choice.uid;});
      }
      return true;
    }
    if(id==='elementChoice') {
      if(!t.choice) return true;
      if(owns(self,'loaded_dice')) {
        if(!self.deck.length && self.rest.length) { self.deck=self.rest.splice(0); ctx.shuffle(self.deck); }
        opts=self.deck.filter(function(c){return ctx.def(c).element===t.choice.id;});
        if(opts.length) ctx.discover(side,opts,task(side,'basicDiscover'),{label:'선택한 속성의 카드 발견',sourceZone:'deck'});
      } else ctx.draw(side,1,function(d){return d.element===t.choice.id;});
      return true;
    }
    if(id==='nextWaves') { ctx.draw(side,1); return true; }
    if(id==='hourglass') { ctx.mana(side,self.maxMana,true); ctx.draw(side,2); return true; }
    if(id==='boots') { s.freeMain2Turn=b.turn; return true; }
    if(id==='reliquaryChoice') {
      if(t.choice && t.choice.cardId) ctx.generate(side,t.choice.cardId);
      return true;
    }
    if(id==='restoreMirage') {
      cards=s.mirages && s.mirages[t.mirageId];
      if(!cards) return true;
      allSides(function(owner){
        ['hand','deck','rest','excluded'].forEach(function(zone){
          ctx.fighter(owner)[zone]=ctx.fighter(owner)[zone].filter(function(c){return c.mirageGroup!==t.mirageId;});
        });
      });
      delete s.mirages[t.mirageId];
      // Keep independently drawn/generated cards first. Restore the saved hand
      // in its original order; ctx.add excludes only the trailing overflow.
      cards.forEach(function(c){ctx.add(side,c,'hand');});
      return true;
    }
    switch(id) {
    case 'lampChoice':if(t.choice)ctx.generate(side,t.choice.cardId);return true;
    case 'zephrys_lamp':
      opts=ctx.catalog.cardPool.map(function(key){return {cardId:key,upgraded:false};});
      ctx.choose(side,opts,task(side,'lampChoice'),{lamp:true,label:'제피르스의 램프'});return true;
    case 'innate_talent':
      opts=ctx.catalog.cardPool.filter(function(key){var d=ctx.catalog.cards[key];return d.upgrade&&(d.upgrade.cost===undefined?d.cost:d.upgrade.cost)===0;}).map(function(key){return {cardId:key,upgraded:true};});
      if(opts.length)ctx.discover(side,opts,task(side,'talentChoice'));return true;
    case 'talentChoice':
      if(t.choice){var d=ctx.def(t.choice);self.heroPower={id:'talent_'+t.choice.cardId,name:d.name,kind:'active',cost:1,text:d.text,module:'treasures',rule:'talentPower',cardId:t.choice.cardId};}return true;
    case 'talentPower':
      card={cardId:t.power.cardId,upgraded:true};
      return A4.CardRules.run(ctx,{kind:'card',module:'cards',side:side,card:card,def:ctx.def(card),free:true});
    case 'hearthstone':
      ctx.runChange({type:'removeCard',side:side,uid:t.card.uid});
      ctx.runChange({type:'removeTreasure',side:side,treasureId:'hearthstone'});
      b.escapeRequested={side:side};return true;
    case 'infinity_stone':
      var lost=Math.floor(foe.maxMana/2),hand=ctx.sample(foe.hand,Math.floor(foe.hand.length/2)),deck=ctx.sample(foe.deck,Math.floor(foe.deck.length/2));
      foe.manaGrowth=(foe.manaGrowth||0)-lost;foe.maxMana-=lost;foe.mana=Math.min(foe.mana,foe.maxMana);
      ctx.damage(side,enemy,Math.floor(Math.max(0,foe.hp)/2));
      hand.concat(deck).forEach(function(x){ctx.move(enemy,x.uid,'rest');});return true;
    case 'shaladrassil':['hand','deck','rest'].forEach(function(z){self[z].forEach(function(card){ctx.upgrade(card);});});return true;
    case 'mystic_coin':
      if(b.phase==='MAIN1' || b.resolution && b.resolution.phase==='MAIN1') ctx.mana(side,1,false); else ctx.heal(side,10);
      return true;
    case 'grave_pick': discoverMove(ctx,side,'rest',3,{discount:1}); return true;
    case 'paper_clone':
      if(self.hand.length) copyInto(ctx,side,ctx.pick(self.hand),{cost:0,costDelta:0,temporaryUntil:b.phase==='END'?b.turn+1:b.turn,excludeOnUse:true});
      return true;
    case 'escape_key':
      s.escapeTurn=b.turn; s.escapeStacks=(s.escapeStacksTurn===b.turn?s.escapeStacks:0)+1; s.escapeStacksTurn=b.turn;
      self.hand.slice().forEach(function(c){ctx.move(side,c.uid,'rest');});
      return true;
    case 'empty_grail':
      if(self.rest.length>self.deck.length) ctx.heal(side,20); else ctx.draw(side,3);
      return true;
    case 'wonder_wand':
      ctx.draw(side,2,null,{cost:0,costDelta:0});
      return true;
    case 'thief_hook':
      if(foe.hand.length)ctx.discover(side,foe.hand.slice(),task(side,'hookDiscard',{owner:enemy}),{label:'상대 손에서 레스트로 보낼 카드',sourceZone:'hand'});
      else discoverMove(ctx,side,'rest',1);return true;
    case 'hookDiscard':
      if(t.choice&&hasCardIn(foe,'hand',t.choice.uid))ctx.move(enemy,t.choice.uid,'rest');
      discoverMove(ctx,side,'rest',1);return true;
    case 'sealed_reliquary':
      opts=[];
      Object.keys(ctx.catalog.treasures).forEach(function(key){
        var treasure=ctx.catalog.treasures[key];
        if(!treasure.retired&&(!treasure.classId||treasure.classId===self.heroId)&&treasure.tier==='low' && treasure.kind==='card' && key!=='sealed_reliquary') opts.push({id:key,name:treasure.name,text:treasure.text,cardId:treasure.cardId});
      });
      if(opts.length) ctx.discover(side,opts,task(side,'reliquaryChoice'),{label:'하급 카드형 보물 발견'});
      return true;
    case 'cassette':
      (foe.lastTurnCards||[]).forEach(function(item){
        var original=item.card||item;
        if(original.cardId) {
          var created=copyInto(ctx,side,original);
          if(side==='player') ctx.runChange({type:'addCard',side:side,card:ctx.copy(created),cardId:original.cardId,upgraded:!!original.upgraded});
        }
      });
      return true;
    case 'exchange_deed':
      cards=self.hand.splice(0); opts=foe.hand.splice(0);
      opts.forEach(function(c){ctx.add(side,c,'hand');});
      cards.forEach(function(c){ctx.add(enemy,c,'hand');});
      return true;
    case 'magic_mirror_card':
      power=foe.heroPower && ctx.copy(foe.heroPower);
      if(power) {
        if(policy.copiedPowerMode==='additional') { self.additionalHeroPowers=self.additionalHeroPowers||[]; self.additionalHeroPowers.push(power); }
        else { self.heroPower=power; self.heroPowerUsedTurn=-1; }
        if(side==='player') ctx.runChange({type:'setHeroPower',side:side,power:power,mode:policy.copiedPowerMode});
      }
      return true;
    case 'tolins_cup':
      cards=ctx.draw(side,1);
      if(cards.length) {
        card=cards[0];
        for(i=self.hand.length;i<ctx.limit(side);i++) copyInto(ctx,side,card);
      }
      return true;
    case 'gambling_box':
      all=self.deck.splice(0).concat(self.rest.splice(0),foe.deck.splice(0),foe.rest.splice(0));
      ctx.shuffle(all); self.deck=all.splice(0,Math.ceil(all.length/2)); foe.deck=all;
      self.deck.forEach(function(c){decreaseCost(ctx,side,c,1);});
      return true;
    case 'full_bag': drawToFull(ctx,side); return true;
    case 'nature_hourglass': ctx.schedule(b.turn,'MAIN2',task(side,'hourglass')); return true;
    case 'pickpocket_gloves':
      ctx.sample(foe.hand,2).forEach(function(c){handMove(ctx,side,c,enemy);});
      return true;
    case 'nether_portal': discoverMove(ctx,side,'excluded',1,{zeroCost:true}); return true;
    case 'horizon_cutter': ctx.damage(side,enemy,self.rest.length*2); return true;
    case 'mirage':
      s.mirages=s.mirages||{}; s.mirageSerial=(s.mirageSerial||0)+1;
      id=side+'-mirage-'+s.mirageSerial+'-'+b.turn;
      s.mirages[id]=self.hand.splice(0);
      ctx.sample(self.deck,8).forEach(function(c){copyInto(ctx,side,c,{mirageGroup:id});});
      ctx.schedule(b.turn,'END',task(side,'restoreMirage',{mirageId:id}));
      return true;
    case 'wish': ctx.heal(side,self.maxHp); drawToFull(ctx,side); return true;
    case 'starlight_disassembler': return true; /* Counter work is performed in beforeCounter, before ordinary effects. */
    case 'destruction_orb':
      foe.manaGrowth=(foe.manaGrowth||0)-1; foe.maxMana=Math.max(0,foe.maxMana-1); foe.mana=Math.min(foe.mana,foe.maxMana);
      ctx.sample(foe.hand,2).forEach(function(c){ctx.move(enemy,c.uid,'rest');});
      return true;
    case 'roasting_wand':
      /* Stops at the first lethal hit; other phase effects still resolve before the core's death check. */
      while(self.hp>0 && foe.hp>0) ctx.damage(side,ctx.rng()<0.5?side:enemy,10,{unblockable:true,ignoreArmor:true,noBonus:true,card:t.card});
      return true;
    case 'time_warp':
      foe.status.cardLocks=foe.status.cardLocks||[]; foe.status.cardLocks.push({from:b.turn+1,until:b.turn+1,name:'시간 왜곡'});
      return true;
    case 'acceleration_boots': ctx.schedule(b.turn,'MAIN2',task(side,'boots')); return true;
    }
    return false;
  }
  function modify(ctx,what,data) {
    var side=data.side || data.sourceSide || ctx.side, self=ctx.fighter(side), s=state(self), b=ctx.battle;
    if(what==='damage') {
      if(data.card && owns(ctx.fighter(data.sourceSide),'archmage_robe') && !data.noBonus) data.value+=2;
    } else if(what==='handLimit' && owns(self,'pelgozi_wallet')) data.value+=3;
    else if(what==='powerCost' && owns(self,'judge_ring')) data.value=0;
    else if(what==='cardCost') {
      if(s.freeMain2Turn===b.turn && b.phase==='MAIN2') data.value=0;
      else if(owns(self,'prism_compass') && data.first && s.previousFirstElement && data.def.element!==s.previousFirstElement) data.value=data.value===0?0:Math.max(1,data.value-1);
    } else if(what==='basicDraw') {
      var basicCount=owns(self,'time_potion')?4:1;data.count=basicCount;
      if(owns(self,'element_distiller')) {
        data.replace=true;
        for(var drawIndex=0;drawIndex<basicCount;drawIndex++)ctx.enqueue(task(side,'askElement'));
      } else if(owns(self,'loaded_dice')) { data.replace=true;for(var discoverIndex=0;discoverIndex<basicCount;discoverIndex++)ctx.enqueue(task(side,'askBasicDiscover')); }
    } else if(what==='beforeCounter') {
      var activeStarlights=[];
      allSides(function(owner){(data.entries[owner]||[]).forEach(function(entry){if(entry.def.rule==='starlight_disassembler'&&(entry.counterEligible===undefined?!entry.countered:entry.counterEligible))activeStarlights.push(entry);});});
      allSides(function(owner){
        var enemy=ctx.other(owner), own=data.entries[owner]||[], other=data.entries[enemy]||[];
        own.forEach(function(entry){
          if(activeStarlights.indexOf(entry)>=0) {
            other.forEach(function(target){target.countered=true;entry.didCounter=true;entry.targets=entry.targets||[];if(!entry.targets.some(function(c){return c.uid===target.card.uid;}))entry.targets.push(target.card);});
          }
        });
      });
    }
  }
  function hook(ctx,e) {
    var b=ctx.battle, side=e.side, f=side?ctx.fighter(side):null, s=f?state(f):null, cards, first;
    if(e.type==='standby') {
      allSides(function(owner){
        var a=ctx.fighter(owner), st=state(a);
        if(st.standbyProcessed===b.turn) return;
        st.standbyProcessed=b.turn;
        st.previousFirstElement=st.firstElementTurn===b.turn-1?st.firstElement:null;
        if(owns(a,'runeterra_codex') && st.savedMana) {sourced(ctx,owner,'runeterra_codex',function(){ctx.mana(owner,st.savedMana,false);});st.savedMana=0;}
        if(e.opening&&owns(a,'time_potion'))sourced(ctx,owner,'time_potion',function(){ctx.draw(owner,4);});
        if(owns(a,'grandmage_staff') && ctx.catalog.cardPool.length) sourced(ctx,owner,'grandmage_staff',function(){ctx.generate(owner,ctx.pick(ctx.catalog.cardPool),{excludeOnUse:true});});
      });
    } else if(e.type==='beforeMain' && b.phase==='MAIN2') {
      allSides(function(owner){var a=ctx.fighter(owner),st=state(a);if(owns(a,'mana_receipt')&&st.main1PaidTurn===b.turn&&st.main1Paid>=2&&st.receiptTurn!==b.turn){st.receiptTurn=b.turn;sourced(ctx,owner,'mana_receipt',function(){ctx.mana(owner,1,true);});}});
    } else if(e.type==='end') {
      allSides(function(owner){
        var a=ctx.fighter(owner), st=state(a), card;
        if(st.endProcessed===b.turn) return;
        st.endProcessed=b.turn;
        if(owns(a,'endless_waves') && a.hand.length<=2) ctx.schedule(b.turn+1,'STANDBY',task(owner,'nextWaves'));
        if(owns(a,'first_aid_kit')) sourced(ctx,owner,'first_aid_kit',function(){ctx.heal(owner,3,{noBonus:true});});
        if(owns(a,'runeterra_codex')) st.savedMana=Math.min(2,a.mana);
        if(owns(a,'loser_gramophone')&&st.firstCounteredTurn===b.turn) {
          card=a.rest.filter(function(c){return c.uid===st.firstCounteredUid;})[0];
          if(card) handMove(ctx,owner,card);
        }
      });
    } else if(e.type==='afterEnd') {
      allSides(function(owner){var a=ctx.fighter(owner);['hand','deck','rest','excluded'].forEach(function(zone){a[zone].forEach(function(c){var restore=c.treasureCostRestore;if(restore&&restore.until<=b.turn){if(restore.hasCost)c.cost=restore.cost;else delete c.cost;if(restore.costDelta)c.costDelta=restore.costDelta;if(restore.costFloor)c.costFloor=restore.costFloor;delete c.treasureCostRestore;}});});});
    } else if(e.type==='cardUsed' && f) {
      if(e.countered&&owns(f,'recycling_bin'))sourced(ctx,side,'recycling_bin',function(){ctx.shield(side,5);});
      if(!e.free) {
        if(owns(f,'philosopher_stone')&&e.paidCost>=2)f.hand.forEach(function(x){x.costDelta=(x.costDelta||0)-1;x.costFloor=0;});
        if(owns(f,'antarctic_clock')&&e.paidCost===0)sourced(ctx,side,'antarctic_clock',function(){ctx.damage(side,ctx.other(side),4,{card:null,noBonus:true});});
        if(s.firstElementTurn!==b.turn) {s.firstElementTurn=b.turn;s.firstElement=e.def.element;}
        if((b.phase==='MAIN1' || b.resolution&&b.resolution.phase==='MAIN1')) {
          if(s.main1PaidTurn!==b.turn){s.main1PaidTurn=b.turn;s.main1Paid=0;}
          s.main1Paid+=e.manaPaid!==undefined?e.manaPaid:e.paidCost===undefined?(e.cost===undefined?Math.max(0,ctx.cost(side,e.card)):e.cost):e.paidCost;
        }
      }
      if(e.countered && s.firstCounteredTurn!==b.turn){s.firstCounteredTurn=b.turn;s.firstCounteredUid=e.card.uid;}
      if(!e.free && owns(f,'twin_ring')) {
        if(s.elementCountsTurn!==b.turn){s.elementCountsTurn=b.turn;s.elementCounts={};s.twinTriggered={};}
        first=e.def.element; s.elementCounts[first]=(s.elementCounts[first]||0)+1;
        if(s.elementCounts[first]===2 && (policy.twinRingPerElement?!s.twinTriggered[first]:s.twinTurn!==b.turn)) {s.twinTriggered[first]=true;s.twinTurn=b.turn;sourced(ctx,side,'twin_ring',function(){ctx.draw(side,1);});}
      }
    } else if(e.type==='discovered' && f && owns(f,'magic_mirror_passive') && s.mirrorTurn!==b.turn) {
      s.mirrorTurn=b.turn;
      cards=(e.options||[]).filter(function(c){return c.uid?c.uid!==e.choice.uid:(c.id||c.cardId)!==(e.choice.id||e.choice.cardId);});
      if(cards.length) {
        first=ctx.pick(cards);
        if(first.uid && e.sourceZone==='opponentRest' && hasCardIn(ctx.fighter(ctx.other(side)),'rest',first.uid)) handMove(ctx,side,first,ctx.other(side));
        else if(first.uid && e.sourceZone && hasCardIn(f,e.sourceZone,first.uid)) handMove(ctx,side,first);
        else if(first.uid && e.sourceZone && hasCardIn(ctx.fighter(ctx.other(side)),e.sourceZone,first.uid)) handMove(ctx,side,first,ctx.other(side));
        else if(first.cardId) copyInto(ctx,side,first);
        else if(first.id && ctx.catalog.cards[first.id]) ctx.generate(side,first.id);
      }
    } else if(e.type==='overload' && f && owns(f,'lightning_rod')) sourced(ctx,side,'lightning_rod',function(){ctx.damage(side,ctx.other(side),6*e.amount,{noBonus:true,card:null});});
    else if(e.type==='powerUsed' && f && owns(f,'enchant_table')) {
      cards=f.hand.filter(function(c){var d=ctx.def(c);return !c.upgraded&&!d.treasure&&(!d.exclusive||c.cardId==='crystal_ball')&&(!c.noUpgrade||c.cardId==='crystal_ball')&&!!d.upgrade;});
      if(cards.length) ctx.upgrade(ctx.pick(cards));
    } else if(e.type==='counter' && f && owns(f,'echo_shard') && s.echoTurn!==b.turn && e.targets && e.targets.length) {
      s.echoTurn=b.turn;var echoed=copyInto(ctx,side,e.targets[0]);if(echoed&&hasCardIn(f,'hand',echoed.uid)){echoed.costDelta=(echoed.costDelta||0)-1;echoed.costFloor=0;}
    } else if(e.type==='cardRest' && f && s.escapeTurn===b.turn) sourced(ctx,side,'escape_key',function(){ctx.draw(side,s.escapeStacks||1);});

    if(e.type==='discovered'&&f&&owns(f,'lucky_shovel')&&e.choice&&e.choice.cardId&&s.luckyShovelTurn!==b.turn){
      s.luckyShovelTurn=b.turn;
      sourced(ctx,side,'lucky_shovel',function(){
        var original=e.choice.uid&&ctx.find(side,e.choice.uid);
        if(!original)original=f.hand.filter(function(x){return (e.beforeHandUids||[]).indexOf(x.uid)<0&&x.cardId===e.choice.cardId;})[0];
        var copied=copyInto(ctx,side,original||e.choice);
        [original,copied].forEach(function(x){if(x&&hasCardIn(f,'hand',x.uid)){x.costDelta=(x.costDelta||0)-1;x.costFloor=0;}});
      });
    }
  }

  var originalRun=run;
  run=function(ctx,t){
    var self=ctx.fighter(t.side), opts;
    if(t.op==='askElement') {
      ctx.refill(t.side);
      opts=[{id:'FIRE',name:'🔥 화염'},{id:'ICE',name:'❄️ 냉기'},{id:'NATURE',name:'🍃 자연'},{id:'LIGHTNING',name:'⚡ 전기'}].filter(function(option){return self.deck.some(function(card){return ctx.def(card).element===option.id;});});
      ctx.choose(t.side,opts,task(t.side,'elementChoice'),{label:'이번 스탠바이 페이즈시에 뽑을 속성',discover:false});return true;
    }
    if(t.op==='askBasicDiscover') {
      if(!self.deck.length && self.rest.length){self.deck=self.rest.splice(0);ctx.shuffle(self.deck);}
      if(self.deck.length) ctx.discover(t.side,self.deck.slice(),task(t.side,'basicDiscover'),{label:'스탠바이 페이즈 드로우 발견',sourceZone:'deck'});
      return true;
    }
    return originalRun(ctx,t);
  };
  // Remove retired ownership before any saved run is rendered or resumed.
  function removeRetired(state,catalog,apply){
    var changed=false,id='vitality_potion';
    function remove(list,predicate){return (list||[]).filter(function(item){if(predicate(item)){changed=true;return false;}return true;});}
    function fighter(f){
      if(!f)return;
      var ids=remove(f.treasureIds,function(x){return x===id;}),passives=remove(f.passives,function(x){return x.id===id||x.treasureId===id;});
      if(apply){if(f.treasureIds)f.treasureIds=ids;if(f.passives)f.passives=passives;}
      var st=f.status&&f.status.treasures;
      if(st&&st.vitalityApplied){changed=true;if(apply){
        f.maxHp=Math.max(1,Math.floor(f.maxHp/2));f.hp=Math.min(f.maxHp,Math.ceil(f.hp/2));
        if(f.baseMaxHp!==undefined)f.baseMaxHp=Math.max(1,Math.floor(f.baseMaxHp/2));
        delete st.vitalityApplied;
      }}
    }
    Object.keys(state.users||{}).forEach(function(uid){
      var run=state.users[uid].run;if(!run)return;
      Object.keys(run.treasures||{}).forEach(function(slot){if(run.treasures[slot]===id){changed=true;if(apply)delete run.treasures[slot];}});
      var pending=run.pending;
      if(pending&&pending.kind==='treasure'&&pending.options.indexOf(id)>=0){
        changed=true;if(apply){pending.options=pending.options.filter(function(x){return x!==id;});
          if(!pending.options.length)pending.options=Object.keys(catalog.treasures).filter(function(x){return catalog.treasures[x].tier==='high'&&Object.keys(run.treasures||{}).every(function(slot){return run.treasures[slot]!==x;});}).slice(0,4);
        }
      }
      var spec=run.enemySpec;
      if(spec){var treasures=remove(spec.treasures,function(x){return x.treasureId===id;}),passives=remove(spec.treasurePassives,function(x){return x.id===id||x.treasureId===id;});if(apply){spec.treasures=treasures;spec.treasurePassives=passives;}}
      var b=run.battle;if(b){['player','enemy'].forEach(function(side){fighter(b[side]);if(b.restartSpecs)fighter(b.restartSpecs[side]);});}
    });
    return changed;
  }
  return {removeRetired:removeRetired,install:install,definitions:definitions,run:run,resolve:run,hook:hook,modify:modify,policy:policy,owns:owns,supports:function(id){return definitions.some(function(d){return d[0]===id&&d[2]==='card';});}};
}());
