/* Fill this catalog after the remaining game design has been supplied. */
A4.catalog = {
  config: {
    enabled: false,
    dataPath: 'sdcard/bot/akjilbot4',
    rooms: { live: [null, null], test: [null, null, null] },
    initialInventory: null, /* {gold:0, keys:?, stones:0, essence:0} */
    sessionTimeoutMs: null,
    playerMaxHpByStage: [60,60,60,60,60,60,60,60],
    equippedDestruction: null /* 'unequip' requires an explicit design decision */
  },
  cards: {
    aquatic_form: {name:'수중 동물 변신',element:'NATURE',cost:0,text:'내 덱 맨 밑 3장을 보고 1장을 맨 위에 놓습니다. 남은 마나로 낼 수 있으면 뽑습니다.',effects:[{type:'dredge',amount:3}],upgrade:{innate:true,text:'선천성. 내 덱 맨 밑 3장을 보고 1장을 맨 위에 놓습니다. 남은 마나로 낼 수 있으면 뽑습니다.'}},
    wild_growth: {name:'급속 성장',element:'NATURE',cost:2,excludeOnUse:true,text:'일회용. 최대 마나가 1 증가합니다. 이미 5라면 넘치는 마나를 얻습니다.',effects:[{type:'growMana',amount:1,cardId:'excess_mana'}],upgrade:{innate:true,text:'선천성, 일회용. 최대 마나가 1 증가합니다. 이미 5라면 넘치는 마나+를 얻습니다.',effects:[{type:'growMana',amount:1,cardId:'excess_mana',upgraded:true}]}},
    healing_touch: {name:'치유의 손길',element:'NATURE',cost:2,text:'체력을 10 회복합니다.',effects:[{type:'heal',amount:10}],upgrade:{text:'체력을 15 회복합니다.',effects:[{type:'heal',amount:15}]}},
    flash_freeze: {name:'급속 빙결',element:'ICE',cost:1,overpower:true,text:'압도. 피해를 3 줍니다. 치명타: 다음 턴에 상대가 카드를 낼 수 없습니다.',effects:[{type:'damage',amount:3},{type:'lockCards',from:1,until:1,critical:true}],upgrade:{text:'압도. 피해를 5 줍니다. 치명타: 다음 턴의 엔드 페이즈시까지 상대가 카드를 낼 수 없습니다.',effects:[{type:'damage',amount:5},{type:'lockCards',from:0,until:1,critical:true}]}},
    foresight: {name:'초고속',element:'NATURE',cost:1,text:'카드를 뽑습니다. 다음 턴의 두 메인 페이즈에서 상대가 낼 카드를 알 수 있습니다.',effects:[{type:'draw',amount:1},{type:'foresight',amount:1}],upgrade:{text:'카드를 2장 뽑습니다. 다음 턴의 두 메인 페이즈에서 상대가 낼 카드를 알 수 있습니다.',effects:[{type:'draw',amount:2},{type:'foresight',amount:1}]}},
    ancestral_knowledge: {name:'선조의 지혜',element:'LIGHTNING',cost:0,text:'과부하: (1). 카드를 2장 뽑습니다.',effects:[{type:'overload',amount:1},{type:'draw',amount:2}],upgrade:{text:'과부하: (1). 카드를 3장 뽑습니다.',effects:[{type:'overload',amount:1},{type:'draw',amount:3}]}},
    thunder: {name:'천둥',element:'LIGHTNING',cost:1,text:'다음 3턴의 스탠바이 페이즈시마다 상대에게 피해를 2 줍니다.',effects:[{type:'scheduledDamage',amount:2,turns:3}],upgrade:{text:'다음 3턴의 스탠바이 페이즈시마다 상대에게 피해를 4 줍니다.',effects:[{type:'scheduledDamage',amount:4,turns:3}]}},
    crackle: {name:'파지직',element:'LIGHTNING',cost:1,text:'과부하: (1). 상대에게 피해를 7~9 줍니다.',effects:[{type:'overload',amount:1},{type:'randomDamage',min:7,max:9}],upgrade:{text:'과부하: (1). 상대에게 피해를 14~18 줍니다.',effects:[{type:'overload',amount:1},{type:'randomDamage',min:14,max:18}]}},
    excess_mana: {name:'넘치는 마나',element:'NATURE',cost:0,token:true,excludeOnUse:true,text:'일회용. 카드를 뽑습니다.',effects:[{type:'draw',amount:1}],upgrade:{text:'일회용. 카드를 2장 뽑습니다.',effects:[{type:'draw',amount:2}]}}
  },
  cardPool: [],
  /* Legacy-engine defaults. Live classes are installed from content/직업-설계.json. */
  heroes: [{id:'guff',name:'거프',cards:['aquatic_form','aquatic_form','ancestral_knowledge','ancestral_knowledge','foresight','foresight','general:살아 움직이는 숲','general:살아 움직이는 숲','general:산사태','general:산사태','thunder','thunder','crackle','crackle','flash_freeze','flash_freeze','wild_growth','wild_growth','healing_touch','healing_touch'],power:{id:'nurture',name:'양성',element:'NEUTRAL',kind:'active',cost:1,usesPerTurn:1,text:'내 손에 있는 무작위 카드의 비용이 (1) 감소합니다.',effects:[{type:'discountRandomHand',amount:1}]}},
    {id:'silent',name:'사일런트',cards:['general:마나 연소','general:마나 연소','general:찌릿!','general:찌릿!','general:소각','general:소각','general:맹독','general:맹독','general:차오르는 독','general:차오르는 독','general:씨뿌리기','general:씨뿌리기','general:재생','general:재생','general:무덤의 지명자','general:무덤의 지명자','general:믹스테이프','general:믹스테이프','general:마법공학: 니비루','general:마법공학: 퓨즈'],power:{id:'poison_sting',name:'독침',element:'NEUTRAL',kind:'active',cost:1,usesPerTurn:1,text:'상대에게 중독을 1-2 부여합니다.',effects:[{type:'randomPoison',min:1,max:2}]}},
    {id:'celeste',name:'셀레스테',cards:['general:불길','general:불길','general:작열통','general:작열통','general:폭발의 룬','general:폭발의 룬','general:긴급 차단','general:긴급 차단','general:마비','general:마비','general:충전','general:충전','thunder','thunder','general:냉동 캡슐','general:냉동 캡슐','general:동면','general:동면','general:발굴','general:발굴'],power:{id:'inquiry',name:'탐구',element:'NEUTRAL',kind:'passive',cost:0,text:"짝수 턴의 스탠바이 페이즈시마다, '수정구'를 내 손으로 가져옵니다.",effects:[]}}
  ],
  enemies: {}, /* id:{name,maxHp,cards:[cardId,...],passives:[]} */
  encounters: [[], [], [], [], [], [], [], []],
  treasures: {}, /* id:{name,tier:'low'|'high',kind:'card'|'passive',cardId?,effects?} */
  relics: {}, /* id:{name,grade:'C'|'B'|'A'|'S'|'SS',levels:[{effects:[]},... x6]} */
  enhancement: {}, /* grade -> current level 0..4 -> {gold,stones,success,fail,down,destroy} */
  slotCosts: { 2: null, 3: null }, /* {gold,stones} */
  pulls: {} /* id:{name,gold,grades:[{value:'C',weight:100},...]} */
};
A4.validateCatalog = function (c) {
  var errors = [], i, key, item, low = 0, high = 0, seen = {};
  function check(ok, message) { if (!ok) errors.push(message); }
  function card(id) { return A4.has(c.cards, id) && A4.integer(c.cards[id].cost, 0) && (Array.isArray(c.cards[id].effects) || !!c.cards[id].rule); }
  check(Array.isArray(c.config.playerMaxHpByStage) && c.config.playerMaxHpByStage.length === 8 && c.config.playerMaxHpByStage.every(function (hp) { return A4.integer(hp,1); }), '단계별 플레이어 최대 체력 8개');
  check(A4.integer(c.config.sessionTimeoutMs, 1), '세션 무응답 제한 시간');
  var inv = c.config.initialInventory;
  check(inv && A4.integer(inv.gold, 0) && A4.integer(inv.keys, 0) && A4.integer(inv.stones, 0) && A4.integer(inv.essence, 0), '신규 유저 시작 재화');
  check(Array.isArray(c.heroes) && c.heroes.length > 0, '영웅 목록');
  for (key in c.cards) if (A4.has(c.cards,key)) {
    try {
      A4.Combat.validateCard({uid:'validate',cardId:key,upgraded:false},c);
      if (c.cards[key].upgrade) A4.Combat.validateCard({uid:'validate',cardId:key,upgraded:true},c);
      check(typeof c.cards[key].name === 'string' && !!c.cards[key].name, '카드 이름: '+key);
    } catch (error) { errors.push('카드 '+key+': '+error.message); }
  }
  for (i = 0; i < (c.heroes || []).length; i++) {
    item = c.heroes[i];
    check(item.id && !seen[item.id], '영웅 ID 중복'); seen[item.id] = true;
    check(item.enabled===false || item.cards && item.cards.length >= 4 && item.cards.every(card), '영웅 ' + item.id + '의 기본 덱');
    try { A4.Combat.validateHeroPower(item.power,c); } catch(error) { errors.push('영웅 '+item.id+': '+error.message); }
  }
  seen = {};
  check(c.cardPool.length >= 3, '일반 카드 보상 풀 최소 3종');
  for (i = 0; i < c.cardPool.length; i++) {
    key = c.cardPool[i]; check(!seen[key] && card(key) && !c.cards[key].treasure, '일반 카드 풀: ' + key); seen[key] = true;
  }
  for (i = 0; i < 8; i++) {
    check(c.encounters[i] && c.encounters[i].length, (i + 1) + '단계 상대');
    (c.encounters[i] || []).forEach(function (id) {
      var e = c.enemies[id];
      if(c.config.engineVersion===3&&e&&e.heroPower){
        check(!!A4.Opponents.get(id),'상대 설정: '+id);
        try { A4.Battle.validateHeroPower(e.heroPower); } catch(error) { errors.push('상대 '+id+': '+error.message); }
        return;
      }
      if (e && e.blueprint) { errors.push('상대 효과 구현 필요: '+e.name); return; }
      check(e && A4.integer(e.maxHp, 1) && e.cards && e.cards.length >= 4 && e.cards.every(card), '상대 설정: ' + id);
      if (e) { try { A4.Combat.validatePassives(e.passives || []); } catch(error) { errors.push('상대 '+id+': '+error.message); } }
    });
  }
  for (key in c.treasures) if (A4.has(c.treasures, key)) {
    item = c.treasures[key];
    check(item.tier === 'low' || item.tier === 'high', '보물 등급: ' + key);
    check(item.kind === 'passive' ? Array.isArray(item.effects) : item.kind === 'card' && card(item.cardId) && c.cards[item.cardId].treasure === true, '보물 효과: ' + key);
    if (item.kind === 'passive') { try { A4.Combat.validatePassives(item.effects); } catch(error) { errors.push('보물 '+key+': '+error.message); } }
    if (item.tier === 'low') low++; if (item.tier === 'high') high++;
  }
  check(low >= 3, '하급 보물 최소 3종');
  check(high >= 4, '상급 보물 최소 4종(기존 보물을 제외한 교체 선택지 3개)');
  for (key in c.relics) if (A4.has(c.relics,key)) {
    item=c.relics[key]; check(['C','B','A','S','SS'].indexOf(item.grade) >= 0,'유물 등급: '+key);
    check(item.levels && item.levels.length === 6,'유물 +0~+5 효과: '+key);
    if (item.levels) for (i=0;i<item.levels.length;i++) {
      try { A4.Combat.validatePassives(item.levels[i].effects); } catch(error) { errors.push('유물 '+key+' +'+i+': '+error.message); }
    }
  }
  return errors;
};
