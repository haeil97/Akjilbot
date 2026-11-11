// 악질봇 4.0.0 — 카카오톡봇 단일 실행 파일
// 카톡봇에는 이 파일의 코드 전체만 등록하세요. 다른 JS 파일이나 Node.js/npm 설치가 필요 없습니다.

// 진행 데이터와 백업은 dataPath에 자동 생성됩니다. 코드 파일과 별도로 보존해야 하는 유저 데이터입니다.
 
// 개발용 원본: akjilbot4/src, 재생성: node akjilbot4/build.js (개발 PC에서만 사용).
var A4 = (function () {
var A4 = {};

// ---- src/base.js ----
 
A4.VERSION = '4.0.0';
A4.HAND_LIMIT = 8;
A4.copy = function (v) { return JSON.parse(JSON.stringify(v)); };
A4.fail = function (message) { throw new Error(message); };
A4.assert = function (ok, message) { if (!ok) A4.fail(message); };
A4.has = function (obj, key) { return Object.prototype.hasOwnProperty.call(obj, key); };
A4.integer = function (n, min) { return typeof n === 'number' && isFinite(n) && Math.floor(n) === n && n >= min; };
A4.id = function (state, prefix) { state.sequence += 1; return prefix + state.sequence; };
A4.random = function (state) {
  return function () {
    var x = state.rngState | 0;
    x ^= x << 13; x ^= x >>> 17; x ^= x << 5;
    state.rngState = x >>> 0;
    return state.rngState / 4294967296;
  };
};
A4.pick = function (list, rng) { A4.assert(list.length > 0, '선택 가능한 콘텐츠가 없습니다.'); return list[Math.floor(rng() * list.length)]; };
A4.sample = function (list, count, rng) {
  var copy = list.slice(), out = [], i;
  while (copy.length && out.length < count) { i = Math.floor(rng() * copy.length); out.push(copy.splice(i, 1)[0]); }
  return out;
};
A4.weightedSample = function (list, count, rng, weightOf) {
  var pool=list.map(function(value){return {value:value,weight:weightOf(value)};}),out=[],total=0;
  pool.forEach(function(entry){A4.assert(typeof entry.weight==='number'&&isFinite(entry.weight)&&entry.weight>0,'추첨 가중치는 양수여야 합니다.');total+=entry.weight;});
  while(pool.length&&out.length<count){
    var roll=rng()*total,index=pool.length-1;
    for(var i=0;i<pool.length;i++){roll-=pool[i].weight;if(roll<0){index=i;break;}}
    var chosen=pool.splice(index,1)[0];out.push(chosen.value);total-=chosen.weight;
  }
  return out;
};
A4.weighted = function (entries, rng) {
  var total = 0, i, roll;
  for (i = 0; i < entries.length; i++) { A4.assert(typeof entries[i].weight === 'number' && entries[i].weight >= 0, '확률 설정이 올바르지 않습니다.'); total += entries[i].weight; }
  A4.assert(Math.abs(total - 100) < 0.000001, '확률 합계는 100이어야 합니다.');
  roll = rng() * total;
  for (i = 0; i < entries.length; i++) { roll -= entries[i].weight; if (roll < 0) return entries[i].value; }
  return entries[entries.length - 1].value;
};
A4.newState = function (seed) {
  return { schemaVersion: 4, sequence: 0, rngState: (seed >>> 0) || 2463534242, users: {}, identities: {}, linkCodes: {} };
};

// ---- src/catalog.js ----
 
A4.catalog = {
  config: {
    enabled: false,
    dataPath: 'sdcard/bot/akjilbot4',
    rooms: { live: [null, null], test: [null, null, null] },
    initialInventory: null,  
    sessionTimeoutMs: null,
    playerMaxHpByStage: [60,60,60,60,60,60,60,60],
    equippedDestruction: null  
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
   
  heroes: [{id:'guff',name:'거프',cards:['aquatic_form','aquatic_form','ancestral_knowledge','ancestral_knowledge','foresight','foresight','general:살아 움직이는 숲','general:살아 움직이는 숲','general:산사태','general:산사태','thunder','thunder','crackle','crackle','flash_freeze','flash_freeze','wild_growth','wild_growth','healing_touch','healing_touch'],power:{id:'nurture',name:'양성',element:'NEUTRAL',kind:'active',cost:1,usesPerTurn:1,text:'내 손에 있는 무작위 카드의 비용이 (1) 감소합니다.',effects:[{type:'discountRandomHand',amount:1}]}},
    {id:'silent',name:'사일런트',cards:['general:마나 연소','general:마나 연소','general:찌릿!','general:찌릿!','general:소각','general:소각','general:맹독','general:맹독','general:차오르는 독','general:차오르는 독','general:씨뿌리기','general:씨뿌리기','general:재생','general:재생','general:무덤의 지명자','general:무덤의 지명자','general:믹스테이프','general:믹스테이프','general:마법공학: 니비루','general:마법공학: 퓨즈'],power:{id:'poison_sting',name:'독침',element:'NEUTRAL',kind:'active',cost:1,usesPerTurn:1,text:'상대에게 중독을 1-2 부여합니다.',effects:[{type:'randomPoison',min:1,max:2}]}},
    {id:'celeste',name:'셀레스테',cards:['general:불길','general:불길','general:작열통','general:작열통','general:폭발의 룬','general:폭발의 룬','general:긴급 차단','general:긴급 차단','general:마비','general:마비','general:충전','general:충전','thunder','thunder','general:냉동 캡슐','general:냉동 캡슐','general:동면','general:동면','general:발굴','general:발굴'],power:{id:'inquiry',name:'탐구',element:'NEUTRAL',kind:'passive',cost:0,text:"짝수 턴의 스탠바이 페이즈시마다, '수정구'를 내 손으로 가져옵니다.",effects:[]}}
  ],
  enemies: {},  
  encounters: [[], [], [], [], [], [], [], []],
  treasures: {},  
  relics: {},  
  enhancement: {},  
  slotCosts: { 2: null, 3: null },  
  pulls: {}  
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

A4.content = {
  "version": 1,
  "revision": "expansion-2026-10-06",
  "description": "카드 원문과 상대 설계 자료입니다. 아직 구현되지 않은 효과의 실행 정의가 아닙니다.",
  "stageHp": [
    15,
    20,
    25,
    35,
    40,
    50,
    60,
    70
  ],
  "opponentDecks": {
    "enemies": [
      {
        "id": "cannon_minion",
        "name": "대포 미니언",
        "stages": [
          1
        ],
        "deckMode": "fixed",
        "deckSize": 8,
        "concept": "자연·화염·냉기를 섞어 공격과 회복을 번갈아 쓰며 공성 피해를 누적하는 첫 상대",
        "cards": [
          {
            "name": "산사태",
            "count": 2
          },
          {
            "name": "재생",
            "count": 1
          },
          {
            "name": "살아 움직이는 숲",
            "count": 1
          },
          {
            "name": "화염구",
            "count": 2
          },
          {
            "name": "완전 빙결",
            "count": 2
          }
        ],
        "notes": [
          "자연 4장, 화염 2장, 냉기 2장으로 구성해 단일 속성 대응만으로 공략되지 않게 했습니다. 신성은 없습니다.",
          "모두 비용 1입니다. 화염구와 완전 빙결로 카드를 보충하고, 재생으로 버티며 공성 피해를 누적합니다. 완전 빙결로 뽑은 카드는 다음 턴부터 사용할 수 있습니다.",
          "산사태의 추가 드로우 조건을 충족하는 고비용 카드는 없습니다. 이 덱에서는 기본 피해 4을 주는 단순 공격 카드로 사용합니다."
        ]
      },
      {
        "id": "little_hatchling",
        "name": "작은 해츨링",
        "stages": [
          1
        ],
        "deckMode": "fixed",
        "deckSize": 8,
        "concept": "화염 주문과 아기 숨결 중 무엇에 마나를 쓸지 고르는 단순한 화염 상대",
        "cards": [
          {
            "name": "불길",
            "count": 2
          },
          {
            "name": "화염구",
            "count": 2
          },
          {
            "name": "금단의 불꽃",
            "count": 2
          },
          {
            "name": "재생",
            "count": 2
          }
        ],
        "notes": [
          "화염 6장, 자연 2장, 신성 0장. 고비용 폭딜, 과부하 폭딜, 카드 제외와 봉쇄를 넣지 않았습니다.",
          "금단의 불꽃과 아기 숨결은 같은 남은 마나를 경쟁하므로, 금단의 불꽃을 낼 때 잔여 마나를 고려해야 합니다."
        ]
      },
      {
        "id": "aviana",
        "name": "아비아나",
        "stages": [
          2,
          3
        ],
        "deckMode": "fixed",
        "deckSize": 17,
        "concept": "서로 회복시키며 공격을 흘리고 성지순례를 쌓는 신성 수비 덱",
        "cards": [
          {
            "name": "안도",
            "count": 2
          },
          {
            "name": "불굴",
            "count": 2
          },
          {
            "name": "계시",
            "count": 2
          },
          {
            "name": "윤회",
            "count": 2
          },
          {
            "name": "성지순례",
            "count": 2
          },
          {
            "name": "성전",
            "count": 2
          },
          {
            "name": "재생",
            "count": 2
          },
          {
            "name": "얼음 방패",
            "count": 2
          },
          {
            "name": "성지순례",
            "count": 1,
            "upgraded": true
          }
        ],
        "notes": [
          "신성 13/17장. 그하니르의 상대 회복을 즉발 공격으로 상쇄하기보다 성지순례의 누적 지속 피해로 장기전에 대비합니다.",
          "무한 회복 대치가 되지 않는지와 30턴 탈진까지의 평균 전투 길이를 확인해야 합니다.",
          "성지순례 원본 2장을 유지하고 강화된 성지순례+ 1장을 추가하여 총 17장입니다."
        ],
        "duplicateLimits": {
          "성지순례": 3
        }
      },
      {
        "id": "black_knight",
        "name": "흑기사",
        "stages": [
          2,
          3
        ],
        "deckMode": "fixed",
        "deckSize": 16,
        "concept": "과부하와 임시 마나로 공격과 처형을 함께 사용하는 공격적인 혼합 덱",
        "cards": [
          {
            "name": "화염구",
            "count": 2
          },
          {
            "name": "작열통",
            "count": 2
          },
          {
            "name": "급속 빙결",
            "count": 2
          },
          {
            "name": "찌릿!",
            "count": 2
          },
          {
            "name": "파지직",
            "count": 2
          },
          {
            "name": "초과 인출",
            "count": 2
          },
          {
            "name": "천둥",
            "count": 2
          },
          {
            "name": "번개 개화",
            "count": 2
          }
        ],
        "notes": [
          "신성 0장. 번개 개화는 메인 1에서 사용하고, 얻은 마나는 메인 2의 처형과 공격에 사용합니다.",
          "파지직과 번개 개화의 과부하는 초과 인출로 해소합니다. 첫 몇 턴의 큰 피해 때문에 2전투 난도를 특히 확인해야 합니다.",
          "처형은 플레이어의 제출을 보고 계획을 바꾸는 능력이 아닙니다. 상대 행동을 보기 전에 영웅 능력 사용 여부를 결정합니다."
        ]
      },
      {
        "id": "patchwerk",
        "name": "패치워크",
        "stages": [
          2,
          3
        ],
        "deckMode": "fixed",
        "deckSize": 16,
        "concept": "체력을 불리고 피해를 되돌려주는 반격형 거구",
        "cards": [
          {
            "name": "화염 장막",
            "count": 2
          },
          {
            "name": "금단의 불꽃",
            "count": 2
          },
          {
            "name": "확고한 알리바이",
            "count": 2
          },
          {
            "name": "재생",
            "count": 2
          },
          {
            "name": "치유의 손길",
            "count": 2
          },
          {
            "name": "굽이치는 파도",
            "count": 2
          },
          {
            "name": "겨울의 뿔피리",
            "count": 2
          },
          {
            "name": "광합성",
            "count": 2
          }
        ],
        "notes": [
          "신성 0장. 마나를 최대치 이상 얻는 카드와 최대 마나를 늘리는 카드를 넣지 않아, 기본 상태에서 2마나 영웅 능력은 5턴부터 사용합니다.",
          "체력 두 배에는 사용자 지정 상한이 없습니다. 반복 사용 시 체력이 기하급수적으로 커질 수 있으므로 실제 전투 길이와 승리 가능성을 확인해야 합니다.",
          "겨울의 뿔피리는 최대 마나까지만 회복하므로 최대 마나가 1인 동안 2마나 영웅 능력을 열어주지 않습니다."
        ]
      },
      {
        "id": "antonidas",
        "name": "안토니다스",
        "stages": [
          2,
          3
        ],
        "deckMode": "fixed",
        "deckSize": 16,
        "concept": "점화를 찾고 회수하면서 같은 주문의 위력을 키우는 화염 마법사",
        "cards": [
          {
            "name": "점화",
            "count": 2
          },
          {
            "name": "불길",
            "count": 2
          },
          {
            "name": "화염구",
            "count": 2
          },
          {
            "name": "화염 장막",
            "count": 2
          },
          {
            "name": "겨울의 뿔피리",
            "count": 2
          },
          {
            "name": "발굴",
            "count": 2
          },
          {
            "name": "수중 동물 변신",
            "count": 2
          },
          {
            "name": "모사",
            "count": 2
          }
        ],
        "notes": [
          "화염 8장, 신성 0장. 설계와 불길로 화염을 찾고 발굴로 사용한 점화를 회수합니다.",
          "모사는 점화가 손에서 최저 비용일 때 점화를 복사하는 보조 수단입니다. 0마나 카드가 남아 있으면 그 카드를 복사하므로 무조건 점화를 복사하지 않습니다.",
          "점화를 여러 장 보유해도 제한 때문에 직접 사용하는 점화는 한 턴에 한 장입니다."
        ]
      },
      {
        "id": "brightwing",
        "name": "빛나래",
        "stages": [
          4,
          5
        ],
        "deckMode": "fixed",
        "deckSize": 20,
        "concept": "수비와 회복으로 버티며 영웅 능력, 운명, 필연으로 무작위 주문을 사용하는 덱",
        "cards": [
          {
            "name": "운명",
            "count": 2
          },
          {
            "name": "필연",
            "count": 2
          },
          {
            "name": "안도",
            "count": 2
          },
          {
            "name": "윤회",
            "count": 2
          },
          {
            "name": "불굴",
            "count": 2
          },
          {
            "name": "황금궤",
            "count": 2
          },
          {
            "name": "성전",
            "count": 2
          },
          {
            "name": "자연의 해독",
            "count": 2
          },
          {
            "name": "치유의 손길",
            "count": 2
          },
          {
            "name": "광합성",
            "count": 2
          }
        ],
        "notes": [
          "신성 14/20장. 지정한 운명과 필연을 각각 2장 포함하며 그 외 고정 공격 카드는 없습니다.",
          "공격 수단은 무작위 사용과 황금궤에서 얻는 카드입니다. 생성 결과에 따른 전투 난도 편차가 큽니다.",
          "재생 2장을 자연의 해독 2장으로 교체해 해로운 상태 효과에 대응합니다."
        ]
      },
      {
        "id": "teemo",
        "name": "티모",
        "stages": [
          4,
          5
        ],
        "deckMode": "fixed",
        "deckSize": 30,
        "concept": "독버섯을 심고 상대의 드로우를 늘려 피해를 터뜨리는 덱 오염 덱",
        "cards": [
          {
            "name": "이슬 절차",
            "count": 2
          },
          {
            "name": "서리꽃",
            "count": 2
          },
          {
            "name": "완전 빙결",
            "count": 2
          },
          {
            "name": "동면",
            "count": 2
          },
          {
            "name": "마나 연소",
            "count": 2
          },
          {
            "name": "초고속",
            "count": 2
          },
          {
            "name": "자연의 해독",
            "count": 2
          },
          {
            "name": "얼어붙은 버클러",
            "count": 2
          },
          {
            "name": "광합성",
            "count": 2
          },
          {
            "name": "심해 저주",
            "count": 2
          },
          {
            "name": "차오르는 독",
            "count": 2
          },
          {
            "name": "독버섯",
            "count": 2
          },
          {
            "name": "마법공학: 아틀라스",
            "count": 2
          },
          {
            "name": "마법공학: 니비루",
            "count": 2
          },
          {
            "name": "태양 작렬",
            "count": 1
          },
          {
            "name": "화염 장막",
            "count": 1
          }
        ],
        "notes": [
          "신성 0장. 독버섯은 초기 덱에 넣지 않고 영웅 능력으로 생성합니다.",
          "이슬 절차로 상대의 독버섯 드로우를 늘리고, 서리꽃의 혹한은 레스트로 이동할 때 추가 드로우를 만듭니다. 동면은 상대 손의 위협적인 카드를 다시 뽑게 만듭니다.",
          "독버섯은 자기 피해와 후속 드로우가 모두 끝난 뒤 레스트로 이동해야 합니다. 해결 중인 버섯을 리필에 포함하지 않으면 같은 드로우 연쇄에서 계속 재사용되는 순환을 막을 수 있습니다. 생성 수에는 임의 상한을 붙이지 않았습니다.",
          "재생 2장을 자연의 해독 2장으로 교체해 해로운 상태 효과에 대응합니다."
        ]
      },
      {
        "id": "ivern",
        "name": "아이번",
        "stages": [
          4,
          5
        ],
        "deckMode": "fixed",
        "deckSize": 26,
        "concept": "중독과 추가 드로우를 자연 중심으로 연결하고 화염 반격과 냉기 수비를 곁들이는 숲 덱",
        "cards": [
          {
            "name": "덩굴뿌리",
            "count": 4
          },
          {
            "name": "자연의 해독",
            "count": 2
          },
          {
            "name": "흡수",
            "count": 2
          },
          {
            "name": "살아 움직이는 숲",
            "count": 2
          },
          {
            "name": "맹독",
            "count": 2
          },
          {
            "name": "차오르는 독",
            "count": 2
          },
          {
            "name": "이슬 절차",
            "count": 2
          },
          {
            "name": "화염 장막",
            "count": 2
          },
          {
            "name": "폭발의 룬",
            "count": 2
          },
          {
            "name": "겨울의 뿔피리",
            "count": 2
          },
          {
            "name": "얼음 방패",
            "count": 2
          },
          {
            "name": "발굴",
            "count": 2
          }
        ],
        "duplicateLimits": {
          "덩굴뿌리": 4
        },
        "notes": [
          "자연 16장, 냉기 6장, 화염 4장입니다. 덩굴뿌리 4장과 전기 카드 없음 조건을 유지했고 신성은 넣지 않았습니다.",
          "살아 움직이는 숲의 카운터 보상, 폭발의 룬의 치명타, 흡수의 탈취를 서로 다른 속성으로 노립니다. 화염 장막과 얼음 방패로 버티고 발굴로 필요한 카드를 회수합니다.",
          "화염을 버리는 왕성한 진균은 혼합 덱과 맞지 않아 제외했습니다. 수풀 가꾸기는 각자의 비자연 카드 1장을 덱에 섞고 자연 카드 1장을 뽑습니다. 현재 덱에 자연이 없으면 그 드로우는 실패하며, 다른 카드가 남아 있는데 레스트를 미리 리필하지 않습니다.",
          "재생 2장을 자연의 해독 2장으로 교체해 해로운 상태 효과에 대응합니다."
        ]
      },
      {
        "id": "trap_room",
        "name": "함정의 방",
        "stages": [
          4,
          5
        ],
        "deckMode": "fixed",
        "deckSize": 27,
        "concept": "손에 든 자동 발동 카드와 레스트 이동을 연결하는 함정 덱",
        "cards": [
          {
            "name": "마법공학: 퓨즈",
            "count": 2
          },
          {
            "name": "마법공학: 니비루",
            "count": 2
          },
          {
            "name": "마법공학: 아틀라스",
            "count": 2
          },
          {
            "name": "신의 권능: 재생",
            "count": 1
          },
          {
            "name": "신의 권능: 징벌",
            "count": 1
          },
          {
            "name": "신의 권능: 성역",
            "count": 1
          },
          {
            "name": "예지",
            "count": 2
          },
          {
            "name": "전이",
            "count": 2
          },
          {
            "name": "풍요",
            "count": 2
          },
          {
            "name": "발굴",
            "count": 2
          },
          {
            "name": "얼음 회오리",
            "count": 2
          },
          {
            "name": "칼바람",
            "count": 2
          },
          {
            "name": "굽이치는 파도",
            "count": 2
          },
          {
            "name": "자연화",
            "count": 2
          },
          {
            "name": "마나 연소",
            "count": 2
          }
        ],
        "notes": [
          "마법공학 3종은 각각 2장, 신의 권능 3종은 각각 1장으로 총 9장의 사용불가 카드를 포함합니다. 신성은 예지까지 총 5/27장입니다.",
          "경보가 비용 3인 카드를 찾고, 선조의 지혜와 풍요로 손을 보충하며 발굴로 필요한 함정을 회수합니다. 예지는 비용 3인 카드를 뽑습니다.",
          "얼음 회오리와 칼바람으로 상대를 견제하고, 굽이치는 파도와 자연화로 피해를 주며, 마나 연소로 상대의 마나를 제한합니다.",
          "선조의 지혜 2장을 전이 2장으로 교체해 해로운 상태 효과에 대응합니다."
        ]
      },
      {
        "id": "yuumi",
        "name": "유미",
        "stages": [
          6,
          7
        ],
        "deckMode": "fixed",
        "deckSize": 40,
        "concept": "상대의 회복을 할인된 카드로 바꾸고 자신의 회복은 응징과 연결하는 신성 덱",
        "cards": [
          {
            "name": "대단원",
            "count": 4
          },
          {
            "name": "운명",
            "count": 2
          },
          {
            "name": "예지",
            "count": 2
          },
          {
            "name": "심판",
            "count": 2
          },
          {
            "name": "계시",
            "count": 2
          },
          {
            "name": "필연",
            "count": 4
          },
          {
            "name": "불굴",
            "count": 2
          },
          {
            "name": "성전",
            "count": 2
          },
          {
            "name": "성지순례",
            "count": 2
          },
          {
            "name": "신의 권능: 응징",
            "count": 2
          },
          {
            "name": "재생",
            "count": 2
          },
          {
            "name": "자연의 해독",
            "count": 2
          },
          {
            "name": "풍요",
            "count": 2
          },
          {
            "name": "광합성",
            "count": 2
          },
          {
            "name": "얼음 방패",
            "count": 2
          },
          {
            "name": "불길한 존재감",
            "count": 2
          },
          {
            "name": "구원의 기도",
            "count": 4
          }
        ],
        "notes": [
          "대단원·필연·구원의 기도는 각각 4장, 나머지는 각각 2장입니다.",
          "대단원은 다음 3턴의 스탠바이 페이즈마다 상대에게 피해 6을 주고 자신은 체력 6을 회복합니다.",
          "구원의 기도로 서로 회복하고 상대가 실제로 회복하면 너랑 유미랑!으로 카드를 뽑아 비용을 낮춥니다.",
          "예지의 비용 3 서치 대상은 신의 권능: 응징입니다. 응징이 손에 있으면 자신에게 적용되는 회복은 상대에게 피해를 주는 효과로 바뀝니다.",
          "치유의 손길 2장을 자연의 해독 2장으로 교체해 해로운 상태 효과에 대응합니다."
        ],
        "duplicateLimits": {
          "대단원": 4,
          "필연": 4,
          "구원의 기도": 4
        }
      },
      {
        "id": "lich_king",
        "name": "리치 왕",
        "stages": [
          6,
          7
        ],
        "deckMode": "fixed",
        "deckSize": 40,
        "concept": "냉기로 견제하고 화염·전기로 상대 레스트를 채워 스컬지로 약탈하는 혼합 덱",
        "cards": [
          {
            "name": "겨울의 뿔피리",
            "count": 2
          },
          {
            "name": "되감기",
            "count": 2
          },
          {
            "name": "얼음 방패",
            "count": 2
          },
          {
            "name": "급속 빙결",
            "count": 2
          },
          {
            "name": "서리 저주",
            "count": 2
          },
          {
            "name": "동면",
            "count": 2
          },
          {
            "name": "북부 항해",
            "count": 2
          },
          {
            "name": "발굴",
            "count": 2
          },
          {
            "name": "심해 저주",
            "count": 2
          },
          {
            "name": "칼바람",
            "count": 2
          },
          {
            "name": "수중 동물 변신",
            "count": 2
          },
          {
            "name": "급속 성장",
            "count": 2
          },
          {
            "name": "광합성",
            "count": 2
          },
          {
            "name": "흡수",
            "count": 2
          },
          {
            "name": "긴급 차단",
            "count": 2
          },
          {
            "name": "전이",
            "count": 2
          },
          {
            "name": "마비",
            "count": 2
          },
          {
            "name": "번아웃",
            "count": 2
          },
          {
            "name": "화염 장막",
            "count": 2
          },
          {
            "name": "불길한 존재감",
            "count": 2
          }
        ],
        "notes": [
          "냉기 20장, 자연 8장, 전기 6장, 화염 4장, 무속성 2장입니다. 불길한 존재감 2장을 유지했고 신성은 넣지 않았습니다.",
          "번아웃과 긴급 차단으로 상대 카드를 레스트에 보내 스컬지의 후보를 만듭니다. 믹스테이프로 상대 덱의 카드도 확보하고, 가져와 사용한 카드는 발굴과 되감기로 다시 활용합니다.",
          "스컬지는 원본 카드를 상대 레스트에서 내 손으로 옮깁니다. 탐험 덱의 영구 제거를 뜻하지 않습니다.",
          "믹스테이프 2장을 전이 2장으로 교체해 해로운 상태 효과에 대응합니다."
        ]
      },
      {
        "id": "aurelion_sol",
        "name": "아우렐리온 솔",
        "stages": [
          6,
          7
        ],
        "deckMode": "fixed",
        "deckSize": 20,
        "concept": "수정구가 매 턴 바뀌는 무작위 주문 덱",
        "cards": [
          {
            "name": "수정구",
            "count": 14
          },
          {
            "name": "불길한 존재감",
            "count": 4
          },
          {
            "name": "제독",
            "count": 2
          }
        ],
        "duplicateLimits": {
          "수정구": 14,
          "불길한 존재감": 4
        },
        "notes": [
          "수정구 14장, 불길한 존재감 4장, 제독 2장으로 구성합니다. 초기 신성 카드는 없지만 수정구가 신성 카드로 변할 수 있습니다.",
          "추가 답변에 따라 손에 있는 수정구만 스탠바이 페이즈에 변신합니다. 사용한 수정구는 원래 수정구 상태로 레스트로 돌아갑니다.",
          "우주의 균형은 추가 답변에 따라 사용형 1마나입니다. 사용할 때마다 이번 전투의 내 카드 피해량/회복량 증가가 1씩 누적됩니다.",
          "불길한 존재감 2장을 제독 2장으로 교체해 해로운 상태 효과에 대응합니다."
        ]
      },
      {
        "id": "faceless_manipulator",
        "name": "얼굴 없는 배후자",
        "stages": [
          6,
          7
        ],
        "deckMode": "mirror",
        "deckSize": null,
        "concept": "플레이어 탐험 덱과 두 유형의 보물을 그대로 복제하는 미러 상대",
        "cards": [],
        "notes": [
          "전투 시작 시 플레이어 탐험 덱의 카드별 장수와 강화 여부, 카드형 보물 및 지속형 보물을 복제합니다. 임의의 고정 카드 목록은 없습니다.",
          "정확한 복제 지시가 기본 중복 상한보다 우선합니다. 플레이어가 같은 카드 3장 이상을 가지고 있으면 그 장수까지 복제합니다.",
          "유물과 플레이어 영웅 능력은 덱 복제 범위에 포함하지 않았습니다. 자신의 영웅 능력은 요그사론의 심복입니다.",
          "손 교란은 상대의 손에서 무작위 한 장을 덱으로 돌린 뒤 한 장을 뽑게 합니다. 숨겨진 손을 보고 계획을 바꾸지 않습니다."
        ]
      },
      {
        "id": "mida",
        "name": "순수한 빛 미다",
        "stages": [
          8
        ],
        "deckMode": "fixed",
        "deckSize": 30,
        "concept": "신성 16장으로 구원의 길을 앞당기면서 여러 속성의 수비·회복과 레스트 제외로 장기전을 이끄는 덱",
        "cards": [
          {
            "name": "구원의 길",
            "count": 1
          },
          {
            "name": "성지순례",
            "count": 1
          },
          {
            "name": "안도",
            "count": 2
          },
          {
            "name": "윤회",
            "count": 2
          },
          {
            "name": "불굴",
            "count": 2
          },
          {
            "name": "성전",
            "count": 2
          },
          {
            "name": "제독",
            "count": 2
          },
          {
            "name": "치유의 손길",
            "count": 2
          },
          {
            "name": "광합성",
            "count": 2
          },
          {
            "name": "기도",
            "count": 2
          },
          {
            "name": "축성",
            "count": 2
          },
          {
            "name": "얼음 방패",
            "count": 2
          },
          {
            "name": "발굴",
            "count": 2
          },
          {
            "name": "화염 장막",
            "count": 2
          },
          {
            "name": "심판",
            "count": 2
          },
          {
            "name": "무덤의 지명자",
            "count": 2
          }
        ],
        "notes": [
          "30장 덱에서 신성 16장, 자연 6장, 냉기 4장, 화염 2장, 전기 2장입니다. 구원의 길은 정확히 1장이고 선천성·일회용입니다.",
          "후속 요청에 따라 계시 2장을 성전 2장으로 교체했습니다. 성전으로 양쪽의 비신성 카드 사용을 제한하며 시간을 벌고, 그동안 성불과 이미 적용한 지속 효과를 활용합니다. 기도로 신성 카드를 보충하고 축성으로 레스트 카드를 강화·회수합니다. 발굴로도 필요한 카드를 회수합니다.",
          "무덤의 지명자와 성불로 상대 레스트를 소진시킵니다. 심판은 내 레스트에 쌓인 신성 카드로 피해를 주고, 성지순례로 지속 피해를 누적합니다.",
          "구원의 길 사용에 성공하면 카운트를 시작합니다. 어느 쪽이든 직접 사용해 카운터당하지 않은 신성 카드만 남은 턴을 줄이며, 자동 사용이나 카운터당한 사용은 줄이지 않습니다. 이미 카운트가 있으면 재사용으로 생성·초기화하지 않습니다.",
          "재생 2장을 제독 2장으로 교체해 해로운 상태 효과에 대응합니다."
        ]
      },
      {
        "id": "plague_doctor",
        "name": "역병 의사",
        "stages": [
          8
        ],
        "deckMode": "random",
        "deckSize": 40,
        "concept": "예고로 시간을 벌면서 세례를 열두 번 사용해 백야로 변신하는 무작위 덱",
        "cards": [
          {
            "name": "예고",
            "count": 3
          }
        ],
        "randomCount": 37,
        "randomPoolElements": [
          "FIRE",
          "ICE",
          "NATURE",
          "LIGHTNING"
        ],
        "duplicateLimits": {
          "예고": 3
        },
        "notes": [
          "고정 예고 3장과 무작위 일반 카드 37장으로 구성합니다. 일반 카드명별 최대 2장, 강화되지 않은 카드만 사용합니다.",
          "신성 최소화 요청을 반영한 설계 제안으로 무작위 37장의 후보를 화염/냉기/자연/전기로 한정했습니다. 모든 일반 카드에서 무작위를 원하면 randomPoolElements 필터를 해제하면 됩니다.",
          "동일 카드가 두 번 선택된 뒤 후보에서 제거하는 방식으로 생성하며, 실제 생성된 40장 목록과 순서는 전투 시작 상태에 저장해야 합니다.",
          "예고는 전용 카드이므로 백야 변신으로도 강화하지 않는 해석입니다. 세례의 연속 턴 사용 금지와 백야의 15초 제한 처리는 별도 규칙으로 보존합니다."
        ],
        "encounterEnabled": false
      },
      {
        "id": "yogg_saron",
        "name": "희망의 끝 요그사론",
        "stages": [
          8
        ],
        "deckMode": "fixed",
        "deckSize": 40,
        "concept": "운명과 필연만으로 주문을 사용하고 광기로 서로의 재사용 자원을 없애는 무작위 덱",
        "cards": [
          {
            "name": "운명",
            "count": 20
          },
          {
            "name": "필연",
            "count": 20
          }
        ],
        "duplicateLimits": {
          "운명": 20,
          "필연": 20
        },
        "notes": [
          "사용자가 지정한 20+20 구성을 그대로 사용합니다. 신성 40/40장입니다.",
          "광기는 각자의 레스트에서 무작위 한 장씩 제외하는 것으로 제안합니다. 어느 한쪽의 레스트가 비어 있어도 다른 쪽은 처리합니다.",
          "운명/필연이 다른 자동 사용 카드를 다시 선택할 수 있어 연쇄 발동의 정지와 재시작 복원이 중요합니다."
        ]
      },
      {
        "id": "extreme_troll",
        "name": "개십악질",
        "stages": [
          8
        ],
        "deckMode": "fixed",
        "deckSize": 30,
        "concept": "화염 드로우와 여러 속성의 수비·방해·회수를 활용하며 밴 해머의 경고 3회를 노리는 특수 승리 덱",
        "cards": [
          {
            "name": "밴 해머+++",
            "count": 2
          },
          {
            "name": "얼음 방패",
            "count": 2
          },
          {
            "name": "발굴",
            "count": 2
          },
          {
            "name": "화염 장막",
            "count": 2
          },
          {
            "name": "마나 연소",
            "count": 2
          },
          {
            "name": "제독",
            "count": 2
          },
          {
            "name": "재생",
            "count": 2
          },
          {
            "name": "치유의 손길",
            "count": 2
          },
          {
            "name": "광합성",
            "count": 2
          },
          {
            "name": "긴급 차단",
            "count": 2
          },
          {
            "name": "마비",
            "count": 2
          },
          {
            "name": "영혼관",
            "count": 2
          },
          {
            "name": "안도",
            "count": 2
          },
          {
            "name": "윤회",
            "count": 2
          },
          {
            "name": "불길",
            "count": 2
          }
        ],
        "notes": [
          "화염 10장, 냉기·자연 각 6장, 전기·신성 각 4장입니다. 번개와 불굴을 영혼관 2장과 불길 2장으로 교체하고 밴 해머+++ 2장을 유지합니다.",
          "빌드업이 찾는 냉기는 밴 해머+++·얼음 방패·발굴로 압축했습니다. 윤회로 필요한 카드를 레스트에 보내고 발굴로 회수하는 경로도 있습니다. 현재 덱에 냉기가 없으면 빌드업의 드로우는 실패하며 레스트를 조기 리필하지 않습니다.",
          "영혼관과 불길로 손패를 보충하고, 화염 장막과 자연의 회복으로 버티며 마나 연소·긴급 차단·마비로 상대의 대응을 방해합니다.",
          "비활성화는 이 적의 덱에 넣지 않습니다. 손패 상한 8장 아래에서 플레이어는 시작 손패 4장에 비활성화 3장을 더해 7장으로 시작합니다. 밴 해머+++는 강화 불가인 전용 카드이며 +++는 카드명 일부입니다.",
          "번아웃 2장을 제독 2장으로 교체해 해로운 상태 효과에 대응합니다."
        ]
      },
      {
        "id": "pikachu",
        "name": "피카츄",
        "stages": [
          2,
          3
        ],
        "deckMode": "fixed",
        "deckSize": 20,
        "concept": "연쇄 번개의 연속 사용을 성장과 임시 마나로 지원하는 전기 중심 4속성 덱",
        "cards": [
          {
            "name": "연쇄 번개",
            "count": 2
          },
          {
            "name": "전류 공급",
            "count": 2
          },
          {
            "name": "선조의 지혜",
            "count": 2
          },
          {
            "name": "파지직",
            "count": 2
          },
          {
            "name": "천둥",
            "count": 2
          },
          {
            "name": "번개 개화",
            "count": 2
          },
          {
            "name": "급속 성장",
            "count": 2
          },
          {
            "name": "재생",
            "count": 2
          },
          {
            "name": "완전 빙결",
            "count": 2
          },
          {
            "name": "마나 연소",
            "count": 2
          }
        ],
        "notes": [
          "기본 동명 카드 최대 2장, 전용 카드 강화 불가 규칙을 적용합니다.",
          "AI는 공개된 기록과 초고속으로 공개된 제출만 사용하고 상대의 숨겨진 손패·덱은 읽지 않습니다."
        ]
      },
      {
        "id": "fiora",
        "name": "피오라",
        "stages": [
          4,
          5
        ],
        "deckMode": "fixed",
        "deckSize": 29,
        "concept": "초고속으로 공개된 행동을 읽고 결투로 메인 1 제출을 압박하는 치명타 혼합 덱",
        "cards": [
          {
            "name": "초고속",
            "count": 2
          },
          {
            "name": "자연의 해독",
            "count": 2
          },
          {
            "name": "급속 빙결",
            "count": 2
          },
          {
            "name": "완전 빙결",
            "count": 2
          },
          {
            "name": "파지직",
            "count": 2
          },
          {
            "name": "전선",
            "count": 2
          },
          {
            "name": "폭발의 룬",
            "count": 2
          },
          {
            "name": "작열통",
            "count": 2
          },
          {
            "name": "굽이치는 파도",
            "count": 2
          },
          {
            "name": "배교",
            "count": 2
          },
          {
            "name": "약점 포착",
            "cardId": "fiora_weakness_nature",
            "count": 2
          },
          {
            "name": "약점 포착",
            "cardId": "fiora_weakness_ice",
            "count": 2
          },
          {
            "name": "약점 포착",
            "cardId": "fiora_weakness_lightning",
            "count": 2
          },
          {
            "name": "약점 포착",
            "cardId": "fiora_weakness_fire",
            "count": 2
          },
          {
            "name": "대결투",
            "count": 1
          }
        ],
        "notes": [
          "기본 동명 카드 최대 2장, 전용 카드 강화 불가 규칙을 적용합니다.",
          "AI는 공개된 기록과 초고속으로 공개된 제출만 사용하고 상대의 숨겨진 손패·덱은 읽지 않습니다.",
          "약점 포착은 같은 이름의 자연·냉기·전기·화염 전용 카드로 속성별로 각각 2장씩 사용합니다. 대결투는 1장입니다.",
          "3그룹의 해로운 효과 제거 카드 최소 2장 조건을 유지하기 위해 수중 동물 변신 2장을 자연의 해독 2장으로 교체합니다."
        ]
      },
      {
        "id": "piranha_plant",
        "name": "뻐끔플라워",
        "stages": [
          2,
          3
        ],
        "deckMode": "fixed",
        "deckSize": 32,
        "concept": "카운터한 카드를 제외하며 발견과 다중 제출을 함정으로 견제하는 4속성 덱",
        "cards": [
          {
            "name": "마법공학: 아틀라스",
            "count": 2
          },
          {
            "name": "마법공학: 니비루",
            "count": 2
          },
          {
            "name": "초고속",
            "count": 2
          },
          {
            "name": "불길",
            "count": 2
          },
          {
            "name": "광합성",
            "count": 2
          },
          {
            "name": "산사태",
            "count": 2
          },
          {
            "name": "재생",
            "count": 2
          },
          {
            "name": "폭발의 룬",
            "count": 2
          },
          {
            "name": "마나 연소",
            "count": 2
          },
          {
            "name": "화염구",
            "count": 2
          },
          {
            "name": "급속 빙결",
            "count": 2
          },
          {
            "name": "얼음 덫",
            "count": 2
          },
          {
            "name": "점화",
            "count": 2
          },
          {
            "name": "선조의 지혜",
            "count": 2
          },
          {
            "name": "긴급 차단",
            "count": 2
          },
          {
            "name": "덩굴뿌리",
            "count": 2
          }
        ],
        "notes": [
          "기본 동명 카드 최대 2장, 전용 카드 강화 불가 규칙을 적용합니다.",
          "AI는 공개된 기록과 초고속으로 공개된 제출만 사용하고 상대의 숨겨진 손패·덱은 읽지 않습니다."
        ]
      },
      {
        "id": "ivysaur",
        "name": "이상해풀",
        "stages": [
          2,
          3
        ],
        "deckMode": "fixed",
        "deckSize": 30,
        "concept": "중독을 쌓아 맹독채찍으로 남은 중독 피해를 한 번에 입히는 자연 중심 4속성 덱",
        "cards": [
          {
            "name": "독가루",
            "count": 2
          },
          {
            "name": "맹독",
            "count": 2
          },
          {
            "name": "독버섯",
            "count": 2
          },
          {
            "name": "차오르는 독",
            "count": 2
          },
          {
            "name": "독사과",
            "count": 2
          },
          {
            "name": "재생",
            "count": 2
          },
          {
            "name": "광합성",
            "count": 2
          },
          {
            "name": "굽이치는 파도",
            "count": 2
          },
          {
            "name": "급속 성장",
            "count": 2
          },
          {
            "name": "초고속",
            "count": 2
          },
          {
            "name": "화염 장막",
            "count": 2
          },
          {
            "name": "작열통",
            "count": 2
          },
          {
            "name": "급속 빙결",
            "count": 2
          },
          {
            "name": "선조의 지혜",
            "count": 2
          },
          {
            "name": "천둥",
            "count": 2
          }
        ],
        "notes": [
          "기본 동명 카드 최대 2장, 전용 카드 강화 불가 규칙을 적용합니다.",
          "AI는 공개된 기록과 초고속으로 공개된 제출만 사용하고 상대의 숨겨진 손패·덱은 읽지 않습니다."
        ]
      },
      {
        "id": "hanar",
        "name": "그림자보석공 하나르",
        "stages": [
          2,
          3
        ],
        "deckMode": "fixed",
        "deckSize": 20,
        "concept": "세공으로 발견 카드의 비용을 낮추고 진실과 거짓으로 상대 카드를 활용하는 발견 덱",
        "cards": [
          {
            "name": "수중 동물 변신",
            "count": 2
          },
          {
            "name": "전선",
            "count": 2
          },
          {
            "name": "믹스테이프",
            "count": 2
          },
          {
            "name": "긴급 차단",
            "count": 2
          },
          {
            "name": "기도",
            "count": 2
          },
          {
            "name": "발굴",
            "count": 2
          },
          {
            "name": "진실",
            "count": 2
          },
          {
            "name": "거짓",
            "count": 2
          },
          {
            "name": "마법공학: 아틀라스",
            "count": 1
          },
          {
            "name": "폭발의 룬",
            "count": 1
          },
          {
            "name": "재생",
            "count": 2
          }
        ],
        "notes": [
          "기본 동명 카드 최대 2장, 전용 카드 강화 불가 규칙을 적용합니다.",
          "AI는 공개된 기록과 초고속으로 공개된 제출만 사용하고 상대의 숨겨진 손패·덱은 읽지 않습니다."
        ]
      },
      {
        "id": "super_minion",
        "name": "슈퍼 미니언",
        "stages": [
          2,
          3
        ],
        "deckMode": "fixed",
        "deckSize": 40,
        "concept": "회복과 보호로 버티며 체력이 절반 이하가 되면 전 덱을 강화하는 4속성 덱",
        "cards": [
          {
            "name": "독사과",
            "count": 2
          },
          {
            "name": "살아 움직이는 숲",
            "count": 2
          },
          {
            "name": "마법공학: 아틀라스",
            "count": 2
          },
          {
            "name": "마법공학: 니비루",
            "count": 2
          },
          {
            "name": "초고속",
            "count": 2
          },
          {
            "name": "광합성",
            "count": 2
          },
          {
            "name": "자연의 해독",
            "count": 2
          },
          {
            "name": "맹독",
            "count": 2
          },
          {
            "name": "독버섯",
            "count": 2
          },
          {
            "name": "차오르는 독",
            "count": 2
          },
          {
            "name": "굽이치는 파도",
            "count": 2
          },
          {
            "name": "급속 성장",
            "count": 2
          },
          {
            "name": "화염구",
            "count": 2
          },
          {
            "name": "폭발의 룬",
            "count": 2
          },
          {
            "name": "화염 장막",
            "count": 2
          },
          {
            "name": "마나 연소",
            "count": 2
          },
          {
            "name": "급속 빙결",
            "count": 2
          },
          {
            "name": "얼음 방패",
            "count": 2
          },
          {
            "name": "선조의 지혜",
            "count": 2
          },
          {
            "name": "재생",
            "count": 2
          }
        ],
        "notes": [
          "기본 동명 카드 최대 2장, 전용 카드 강화 불가 규칙을 적용합니다.",
          "AI는 공개된 기록과 초고속으로 공개된 제출만 사용하고 상대의 숨겨진 손패·덱은 읽지 않습니다.",
          "재생 2장을 자연의 해독 2장으로 교체해 해로운 상태 효과에 대응합니다."
        ]
      },
      {
        "id": "boo",
        "name": "부끄부끄",
        "stages": [
          4,
          5
        ],
        "deckMode": "fixed",
        "deckSize": 40,
        "concept": "저주와 고드름으로 손패를 오염시키고 유령 걸음의 피해 반사로 압박하는 덱",
        "cards": [
          {
            "name": "심해 저주",
            "count": 4
          },
          {
            "name": "서리 저주",
            "count": 4
          },
          {
            "name": "칼바람",
            "count": 2
          },
          {
            "name": "얼어붙은 버클러",
            "count": 2
          },
          {
            "name": "불길한 존재감",
            "count": 2
          },
          {
            "name": "얼음 회오리",
            "count": 2
          },
          {
            "name": "완전 빙결",
            "count": 2
          },
          {
            "name": "초고속",
            "count": 2
          },
          {
            "name": "제독",
            "count": 2
          },
          {
            "name": "작열통",
            "count": 2
          },
          {
            "name": "긴급 차단",
            "count": 2
          },
          {
            "name": "선조의 지혜",
            "count": 2
          },
          {
            "name": "놀래키기",
            "count": 4
          },
          {
            "name": "왕성한 진균",
            "count": 2
          },
          {
            "name": "급속 성장",
            "count": 2
          },
          {
            "name": "유령 강탈자",
            "count": 4
          }
        ],
        "notes": [
          "놀래키기는 뽑을 때 시전하며 부끄부끄가 카드를 뽑고 상대의 무작위 손패를 레스트로 보냅니다.",
          "재생 2장을 제독 2장으로 교체해 해로운 상태 효과에 대응합니다.",
          "신의 권능: 가속 2장과 예지 2장을 제거했습니다. 유령 걸음은 사용한 메인 페이즈에 받은 피해를 상대에게도 줍니다.",
          "유령 강탈자 4장을 추가합니다. AI는 양쪽의 이번 턴 직접 사용 카드와 자기 제출 묶음을 합쳐 실제 피해 12 이상이 가능할 때 사용합니다."
        ],
        "duplicateLimits": {
          "심해 저주": 4,
          "서리 저주": 4,
          "놀래키기": 4,
          "유령 강탈자": 4
        }
      },
      {
        "id": "meltranix",
        "name": "검사 멜트라닉스",
        "stages": [
          4,
          5
        ],
        "deckMode": "fixed",
        "deckSize": 30,
        "concept": "지속형 자백과 지목으로 손패 양끝을 압박하고 점화·중독으로 피해를 누적하는 덱",
        "cards": [
          {
            "name": "지목",
            "count": 4
          },
          {
            "name": "불길한 존재감",
            "count": 2
          },
          {
            "name": "칼바람",
            "count": 2
          },
          {
            "name": "심해 저주",
            "count": 2
          },
          {
            "name": "마나 연소",
            "count": 2
          },
          {
            "name": "제독",
            "count": 2
          },
          {
            "name": "초고속",
            "count": 2
          },
          {
            "name": "급속 성장",
            "count": 2
          },
          {
            "name": "접붙이기",
            "count": 1
          },
          {
            "name": "궁극의 역병",
            "count": 1
          },
          {
            "name": "황금궤",
            "count": 2
          },
          {
            "name": "이슬 절차",
            "count": 2
          },
          {
            "name": "절멸",
            "count": 2
          },
          {
            "name": "점화",
            "count": 2
          },
          {
            "name": "확고한 알리바이",
            "count": 2
          }
        ],
        "notes": [
          "자백은 전투 내내 상대의 현재 손패 첫 번째와 마지막 카드만 직접 제출하게 합니다. 영웅 능력과 자동 시전에는 적용되지 않습니다.",
          "지목은 4장, 접붙이기와 궁극의 역병은 각각 1장, 나머지는 각각 2장입니다.",
          "재생 2장을 제독 2장으로 교체해 해로운 상태 효과에 대응합니다."
        ],
        "duplicateLimits": {
          "지목": 4
        }
      }
    ]
  },
  "opponentAbilities": {
    "schemaVersion": 1,
    "implementationStatus": "specification-only",
    "description": "2026-10-03 사용자 상대 설계 원문을 구조화한 개발 자료. effectId는 설계 식별자이며 전투 엔진의 실행 핸들러 구현을 뜻하지 않습니다.",
    "abilities": {
      "cannon_minion": {
        "name": "공성",
        "kind": "passive",
        "cost": null,
        "text": "매 턴의 엔드 페이즈시에 상대에게 피해를 1 줍니다.",
        "effectId": "end_opponent_damage",
        "parameters": {
          "phase": "END",
          "damage": 1
        },
        "notes": []
      },
      "little_hatchling": {
        "name": "아기 숨결",
        "kind": "active",
        "cost": 1,
        "usesPerTurn": 1,
        "text": "상대에게 피해를 2 줍니다.",
        "effectId": "opponent_damage",
        "parameters": {
          "damage": 2
        },
        "notes": []
      },
      "aviana": {
        "name": "그하니르",
        "kind": "active",
        "cost": 1,
        "usesPerTurn": 1,
        "text": "체력을 4 회복합니다.",
        "effectId": "heal_self",
        "parameters": {
          "amount": 4
        },
        "notes": []
      },
      "black_knight": {
        "name": "처형",
        "kind": "active",
        "cost": 1,
        "usesPerTurn": 1,
        "text": "상대가 낸 카드 중 하나를 카운터합니다.",
        "effectId": "counter_one_opponent_submission",
        "parameters": {
          "targetZone": "currentMainPhaseSubmission",
          "count": 1,
          "targetPolicy": null
        },
        "notes": [
          "플레이어 제출을 본 뒤 영웅 능력 사용 여부를 바꾸면 안 됩니다. 대상 선정 방식은 별도 확정이 필요합니다."
        ]
      },
      "patchwerk": {
        "name": "더 놀아줘!",
        "kind": "active",
        "cost": 2,
        "usesPerTurn": 1,
        "text": "내 현재 체력과 최대 체력을 두 배로 만듭니다. 네 턴 뒤에 다시 사용할 수 있습니다.",
        "effectId": "double_health_with_cooldown",
        "parameters": {
          "currentHpMultiplier": 2,
          "maxHpMultiplier": 2,
          "cooldownTurns": 4
        },
        "notes": [
          "사용 턴이 t이면 t+4부터 재사용 가능합니다. 두 메인 페이즈는 같은 턴으로 계산합니다."
        ]
      },
      "antonidas": {
        "name": "설계",
        "kind": "passive",
        "cost": null,
        "text": "매 턴의 엔드 페이즈시마다 화염 카드를 뽑습니다.",
        "effectId": "phase_draw_element",
        "parameters": {
          "phase": "END",
          "element": "FIRE",
          "count": 1,
          "source": "ownDrawPile"
        },
        "notes": []
      },
      "brightwing": {
        "name": "친구 만들기!",
        "kind": "active",
        "cost": 1,
        "usesPerTurn": 1,
        "text": "비용이 (3) 이하인 무작위 카드를 사용합니다.",
        "effectId": "cast_random_general_card",
        "parameters": {
          "maxCost": 3,
          "count": 1,
          "pool": "unupgradedGeneralCards",
          "freeCast": true,
          "countAsCardUse": false
        },
        "notes": [
          "보물·토큰·전용 카드·강화본은 기본 무작위 풀에서 제외됩니다. 자동 사용 카드의 상성 판정 규칙은 기존 미정 항목입니다."
        ]
      },
      "teemo": {
        "name": "유독성 함정",
        "kind": "active",
        "cost": 1,
        "usesPerTurn": 1,
        "text": "상대의 덱에 '버섯 함정'이 3장 이하라면, 상대의 덱에 '버섯 함정'을 3장 섞어 넣습니다.",
        "effectId": "shuffle_generated_cards_into_opponent_deck",
        "parameters": {
          "cardId": "poisonous_mushroom",
          "count": 3,
          "targetZone": "opponentDrawPile",
          "maximumExistingCount": 3
        },
        "notes": [
          "발동 조건은 상대 덱의 버섯 함정이 3장 이하인지 확인합니다. 조건을 만족하면 항상 3장을 추가하며, 레스트의 함정은 세지 않습니다."
        ]
      },
      "ivern": {
        "name": "수풀 가꾸기",
        "kind": "passive",
        "cost": null,
        "text": "매 턴의 엔드 페이즈시에, 서로의 손에서 자연 카드가 아닌 카드 1장을 덱에 섞어 넣고 자연 카드를 1장 뽑습니다.",
        "effectId": "end_replace_one_non_nature_each_hand",
        "parameters": {
          "phase": "END",
          "targets": "both",
          "returnFilter": {
            "elementNot": "NATURE"
          },
          "returnCountPerSide": 1,
          "returnDestination": "ownDrawPile",
          "drawFilter": {
            "element": "NATURE"
          },
          "drawCountPerSide": 1
        },
        "notes": [
          "후속 답변으로 장수가 없으면 1장입니다. 각자의 손에서 비자연 카드 1장만 덱으로 돌리고 자연 카드 1장을 뽑습니다. 대상 선정은 게임의 기본 카드 선택 처리 규칙을 따릅니다."
        ]
      },
      "trap_room": {
        "name": "경보",
        "kind": "passive",
        "cost": null,
        "text": "매 턴의 스탠바이 페이즈시에, 덱에서 비용이 (3)인 카드를 뽑습니다.",
        "effectId": "standby_draw_cost",
        "parameters": {
          "phase": "STANDBY",
          "cost": 3,
          "count": 1,
          "source": "ownDrawPile"
        },
        "notes": []
      },
      "yuumi": {
        "name": "너랑 유미랑!",
        "kind": "passive",
        "cost": null,
        "text": "턴에 처음으로 상대가 체력을 회복하면 카드를 뽑습니다. 그 카드의 비용이 (2) 감소합니다.",
        "effectId": "draw_on_opponent_heal",
        "parameters": {
          "trigger": "opponentHeals",
          "drawCount": 1,
          "drawnCardCostReduction": 2,
          "oncePerTurn": true
        },
        "notes": [
          "실제 회복량이 0보다 클 때만 발동합니다. 메인 페이즈 1·2를 합쳐 턴당 1회이며 드로우할 카드가 없거나 손이 가득 차도 발동 횟수는 소모됩니다."
        ]
      },
      "lich_king": {
        "name": "스컬지",
        "kind": "active",
        "cost": 1,
        "usesPerTurn": 1,
        "text": "상대의 레스트에서 카드를 발견하여 내 손으로 가져옵니다.",
        "effectId": "discover_steal_opponent_rest",
        "parameters": {
          "source": "opponentRest",
          "choices": 3,
          "destination": "ownHand",
          "move": true,
          "copy": false
        },
        "notes": [
          "기존 카드 인스턴스를 옮깁니다. 플레이어 탐험 덱의 영구 제거를 뜻하지 않습니다."
        ]
      },
      "aurelion_sol": {
        "name": "우주의 균형",
        "kind": "active",
        "cost": 1,
        "usesPerTurn": 1,
        "text": "이번 게임에서 내 카드들의 피해량과 회복량이 1 증가합니다. 네 턴 뒤에 다시 사용할 수 있습니다.",
        "effectId": "card_damage_and_healing_bonus",
        "parameters": {
          "damageBonus": 1,
          "healingBonus": 1,
          "duration": "battle",
          "applicationMode": "onUse",
          "stacks": true,
          "cooldownTurns": 4
        },
        "notes": [
          "후속 답변으로 1마나 사용형, 턴당 1회로 확정했습니다. 사용할 때마다 해당 전투에서 카드 피해량·회복량 +1이 누적됩니다. 영웅 능력 자체의 피해·회복은 ‘내 카드들’에 포함하지 않습니다."
        ]
      },
      "faceless_manipulator": {
        "name": "요그사론의 심복",
        "kind": "active",
        "cost": 0,
        "usesPerTurn": 1,
        "text": "상대의 손에 있는 무작위 카드를 상대의 덱에 섞어 넣습니다. 상대가 카드를 뽑습니다.",
        "effectId": "shuffle_opponent_hand_card_then_draw",
        "parameters": {
          "randomHandCards": 1,
          "destination": "opponentDrawPile",
          "opponentDraw": 1
        },
        "notes": [
          "덱은 플레이어의 탐험 덱을 카드 인스턴스별로 복제하고, 카드형 보물과 지속 효과형 보물도 복제합니다. 유물이나 플레이어 영웅 능력은 복제한다고 명시되지 않았습니다."
        ]
      },
      "mida": {
        "name": "성불",
        "kind": "active",
        "cost": 1,
        "usesPerTurn": 1,
        "text": "상대의 레스트에 있는 무작위 카드 3장을 게임에서 제외합니다.",
        "effectId": "exclude_random_opponent_rest",
        "parameters": {
          "count": 3,
          "source": "opponentRest",
          "destination": "opponentExcluded"
        },
        "notes": []
      },
      "plague_doctor": {
        "name": "세례",
        "kind": "active",
        "cost": 1,
        "usesPerTurn": 1,
        "text": "내가 너의 모든 질병을 고쳐 낫게 하리라.",
        "effectId": "heal_opponent_and_advance_baptism",
        "parameters": {
          "actualEffectText": "플레이어의 체력을 모두 회복합니다.",
          "healTarget": "opponent",
          "healToFull": true,
          "forbidConsecutiveTurnUse": true,
          "cooldownTurns": 2,
          "quoteSequence": "doctorQuotes",
          "nicknamePlaceholder": "(플레이어 닉네임)",
          "transformationAtUseCount": 12,
          "transformation": {
            "name": "백야",
            "currentHp": 100,
            "maxHp": 100,
            "upgradeZones": [
              "hand",
              "deck",
              "rest"
            ],
            "upgradeExclusiveCards": false,
            "heroPower": {
              "name": "하얀 밤",
              "kind": "passive",
              "cost": null,
              "text": "메인 페이즈의 제한 시간이 15초로 감소합니다.",
              "effectId": "main_phase_time_limit",
              "parameters": {
                "phases": [
                  "MAIN1",
                  "MAIN2"
                ],
                "limitMs": 15000,
                "onTimeout": "passCurrentMainPhase",
                "timeoutSubmission": {
                  "cards": [],
                  "heroPower": false
                },
                "offlineTimerPolicy": null
              }
            }
          }
        },
        "notes": [
          "특수 대사는 세례 사용 횟수 순서대로 출력합니다. 원문의 ‘백야는 전 턴에 영웅 능력을 사용하지 않은 경우에만 사용’은 사용형 세례의 연속 턴 사용 제한으로 해석했습니다.",
          "모든 전용 카드는 강화 불가라는 공통 규칙에 따라 변신 시 예고는 강화하지 않는 것으로 정리했습니다. 제외 영역은 강화 대상이 아닙니다.",
          "변신 후에도 같은 전투입니다. 체력·최대 체력·이름·영웅 능력·카드 강화 외의 상태를 초기화한다고 명시되지 않았습니다."
        ]
      },
      "yogg_saron": {
        "name": "광기",
        "kind": "passive",
        "cost": null,
        "text": "매 턴의 엔드 페이즈시에, 서로의 레스트에 있는 무작위 카드를 게임에서 제외합니다.",
        "effectId": "end_exclude_random_from_each_rest",
        "parameters": {
          "phase": "END",
          "targets": "both",
          "countPerSide": 1,
          "source": "rest",
          "destination": "excluded"
        },
        "notes": [
          "각자의 레스트에서 1장씩 제외하는 것으로 정리했습니다."
        ]
      },
      "extreme_troll": {
        "name": "빌드업",
        "kind": "active",
        "cost": 1,
        "usesPerTurn": 1,
        "text": "냉기 카드를 뽑습니다. 상대의 덱에서 무작위 전기 카드를 레스트로 보냅니다.",
        "effectId": "draw_ice_and_discard_opponent_lightning",
        "parameters": {
          "ownDraw": {
            "source": "ownDrawPile",
            "element": "ICE",
            "count": 1
          },
          "opponentMove": {
            "source": "opponentDrawPile",
            "element": "LIGHTNING",
            "count": 1,
            "random": true,
            "destination": "opponentRest"
          },
          "battleStart": {
            "target": "player",
            "cardId": "deactivation",
            "count": 3,
            "additionalToOpeningHand": true,
            "handLimitResolution": "withinGlobalLimit",
            "openingHandCount": 4,
            "globalHandLimit": 8,
            "handCountAfterGrant": 7
          }
        },
        "notes": [
          "후속 답변으로 모든 전투의 손패 상한이 8장으로 변경되었습니다. 기본 시작 손패 4장에 비활성화 3장을 추가해 총 7장을 정상 보유합니다.",
          "덱의 ‘밴 해머’ 2장은 전용 카드 밴 해머+++ 2장을 뜻하는 것으로 정리했습니다."
        ]
      },
      "pikachu": {
        "name": "100만볼트",
        "kind": "active",
        "cost": 1,
        "text": "서로의 손에 있는 전기 카드의 수만큼 상대에게 피해를 줍니다.",
        "effectId": "pikachu",
        "parameters": {},
        "notes": []
      },
      "fiora": {
        "name": "결투",
        "kind": "passive",
        "cost": null,
        "text": "내가 상대 카드를 카운터하거나 상대가 메인 페이즈 1에 카드를 내지 않을 때마다 상대에게 피해를 5 줍니다.",
        "effectId": "fiora",
        "parameters": {
          "counterDamage": 5,
          "emptyMain1Damage": 5
        },
        "notes": [
          "카운터한 상대 카드 한 장당 피해를 5 줍니다. 같은 제출 묶음에서 동일 상대 카드를 여러 카드로 카운터해도 한 번만 셉니다."
        ]
      },
      "piranha_plant": {
        "name": "삼키기",
        "kind": "passive",
        "cost": null,
        "text": "내가 상대 카드를 카운터할 때마다 그 카드를 게임에서 제외합니다.",
        "effectId": "piranha_plant",
        "parameters": {},
        "notes": []
      },
      "ivysaur": {
        "name": "맹독채찍",
        "kind": "active",
        "cost": 1,
        "text": "상대에게 중독을 2 부여합니다. 이미 중독 상태라면, 대신 상대에게 부여된 중독을 모두 소모하고 중독 피해를 즉시 입힙니다.",
        "effectId": "ivysaur",
        "parameters": {},
        "notes": []
      },
      "hanar": {
        "name": "세공",
        "kind": "passive",
        "cost": null,
        "text": "메인 페이즈 1에 내 발견 카드들의 비용이 (1) 감소합니다.",
        "effectId": "hanar",
        "parameters": {},
        "notes": []
      },
      "super_minion": {
        "name": "억제기",
        "kind": "passive",
        "cost": null,
        "text": "전투 중에 처음으로 체력이 절반 이하로 떨어지면 그 피해를 막고, 내 손, 덱, 레스트에 있는 모든 강화되지 않은 카드를 강화합니다.",
        "effectId": "super_minion",
        "parameters": {
          "preventTriggeringDamage": true,
          "oncePerBattle": true
        },
        "notes": []
      },
      "boo": {
        "name": "유령 걸음",
        "kind": "active",
        "cost": 1,
        "text": "이번 페이즈에 피해를 받은 만큼 상대에게도 피해를 줍니다.",
        "effectId": "boo",
        "parameters": {
          "duration": "currentPhase"
        },
        "notes": []
      },
      "meltranix": {
        "name": "자백",
        "kind": "passive",
        "cost": null,
        "text": "상대가 손에서 첫 번째와 마지막에 있는 카드만 낼 수 있습니다.",
        "effectId": "meltranix",
        "parameters": {
          "removable": false
        },
        "notes": [
          "영웅 능력에 의한 손패 제한은 디버프 제거로 해제되지 않으며 전이로 상대에게 옮길 수 없습니다."
        ]
      }
    },
    "exclusiveCards": [
      {
        "id": "ban_hammer_triple",
        "name": "밴 해머+++",
        "element": "ICE",
        "cost": 1,
        "text": "상대에게 경고를 부여합니다. 경고가 3에 도달하면, 상대는 게임에서 추방됩니다. 이 카드는 게임에서 제외되는 대신 레스트로 이동합니다.",
        "upgradeable": false,
        "exclusive": true,
        "flags": {
          "redirectExclusionToRest": true,
          "literalPlusInName": true
        },
        "effectId": "give_warning_and_expulsion",
        "parameters": {
          "warningTarget": "opponent",
          "warningsAdded": 1,
          "expelAt": 3,
          "warningDuration": "battle",
          "specialDefeatResolution": null
        }
      },
      {
        "id": "deactivation",
        "name": "비활성화",
        "element": "LIGHTNING",
        "cost": 2,
        "text": "나에게 부여된 경고를 모두 없앱니다.",
        "upgradeable": false,
        "exclusive": true,
        "flags": {},
        "effectId": "clear_own_warnings",
        "parameters": {
          "target": "self",
          "warningsAfter": 0
        }
      },
      {
        "id": "prophecy",
        "name": "예고",
        "element": "HOLY",
        "cost": 1,
        "text": "상대가 낸 모든 카드를 카운터합니다.",
        "upgradeable": false,
        "exclusive": true,
        "flags": {},
        "effectId": "counter_all_opponent_submission",
        "parameters": {
          "targetZone": "currentMainPhaseSubmission"
        }
      },
      {
        "id": "path_to_salvation",
        "name": "구원의 길",
        "element": "HOLY",
        "cost": 1,
        "text": "선천성. 일회용. 50턴 후의 엔드 페이즈시에 게임에서 승리합니다. 누구든지 신성 카드를 낼 때마다 남은 턴이 1 추가로 감소합니다.",
        "upgradeable": false,
        "exclusive": true,
        "flags": {
          "innate": true,
          "excludeOnUse": true
        },
        "effectId": "delayed_holy_victory",
        "parameters": {
          "baseRemainingTurns": 50,
          "winPhase": "END",
          "acceleratingElement": "HOLY",
          "cardUsers": "both",
          "activationTiming": "firstSuccessfulUse",
          "countSelfUse": true,
          "countFreeCasts": false,
          "countCounteredCasts": true,
          "acceleratingUseType": "manualCardUse",
          "repeatedUseBehavior": "keepExistingCountdown",
          "repeatedSuccessfulManualUseReduction": 1,
          "initialActivationDecreasesCountdown": false,
          "reductionPerTurn": 1,
          "reductionPhase": "END",
          "additionalReductionPerHolyCard": 1
        },
        "notes": [
          "매 엔드 페이즈마다 기본 1턴에 양쪽이 직접 낸 신성 카드 장수를 더해 감소합니다. 카운터당한 직접 사용도 포함하고 자동 시전은 제외합니다. 남은 턴이 0 이하가 되면 엔드 페이즈에 승리합니다."
        ]
      },
      {
        "id": "crystal_ball",
        "name": "수정구",
        "element": "NEUTRAL",
        "cost": 0,
        "text": "이 카드는 매 턴의 스탠바이 페이즈시마다 무작위 카드로 바뀝니다.",
        "upgradeable": true,
        "exclusive": true,
        "flags": {
          "restoreOriginalOnRest": true
        },
        "effectId": "standby_transform_random_card",
        "parameters": {
          "phase": "STANDBY",
          "pool": "unupgradedGeneralCards",
          "transformZones": [
            "hand"
          ],
          "replaceFields": [
            "name",
            "element",
            "cost",
            "text",
            "effects"
          ],
          "restoreCardId": "crystal_ball",
          "restoreWhen": "usedCardMovesToRest"
        },
        "displayElement": "🌌",
        "upgrade": {
          "name": "수정구+",
          "cost": 0,
          "text": "이 카드는 매 턴의 스탠바이 페이즈시마다 강화된 무작위 카드로 바뀝니다."
        }
      },
      {
        "id": "ominous_presence",
        "name": "불길한 존재감",
        "element": "NEUTRAL",
        "cost": 1,
        "text": "방어도를 10 얻고 카드를 2장 뽑습니다.",
        "upgradeable": false,
        "exclusive": true,
        "flags": {},
        "effectId": "gain_armor_and_draw",
        "parameters": {
          "armor": 10,
          "draw": 2,
          "usedBy": [
            "aurelion_sol",
            "lich_king"
          ]
        }
      },
      {
        "id": "final_chapter",
        "name": "대단원",
        "element": "HOLY",
        "cost": 2,
        "text": "다음 3턴의 스탠바이 페이즈시마다 상대에게 피해를 6 주고 체력을 6 회복합니다.",
        "upgradeable": false,
        "exclusive": true,
        "flags": {},
        "effectId": "scheduled_standby_damage_and_heal",
        "parameters": {
          "phase": "STANDBY",
          "firstTurnOffset": 1,
          "turns": 3,
          "amount": 6,
          "damage": 6,
          "heal": 6
        }
      },
      {
        "id": "bramble_root",
        "name": "덩굴뿌리",
        "element": "NATURE",
        "cost": 1,
        "text": "방어도를 5 얻고 카드를 뽑습니다.",
        "upgradeable": false,
        "exclusive": true,
        "flags": {},
        "effectId": "gain_armor_and_draw",
        "parameters": {
          "armor": 5,
          "draw": 1
        }
      },
      {
        "id": "poisonous_mushroom",
        "name": "버섯 함정",
        "element": "NEUTRAL",
        "cost": 1,
        "text": "뽑을 때 시전. 내 영웅에게 중독을 2 부여하고 카드를 뽑습니다.",
        "upgradeable": false,
        "exclusive": true,
        "flags": {
          "castWhenDrawn": true
        },
        "effectId": "poison_self_and_draw",
        "parameters": {
          "draw": 1,
          "automaticCast": {
            "sourceZone": "deck",
            "anyDrawEffect": true,
            "manaCost": 0,
            "resolutionZone": "resolving",
            "resolutionOrder": [
              "poisonSelf",
              "resolveNestedDraw",
              "moveToRest"
            ],
            "afterResolution": "rest",
            "refillWhileResolving": false,
            "persistResolutionStack": true,
            "enterHandByOtherMeansTriggers": false
          },
          "manualCastAllowed": true,
          "manualManaCost": 1,
          "poison": 2,
          "poisonTarget": "self"
        },
        "notes": [
          "뽑힌 버섯 함정은 해결 영역에서 자기 중독와 후속 드로우를 모두 처리한 뒤 레스트로 이동합니다. 해결 중인 버섯 함정은 리필 대상이 아니므로 버섯 함정만 남아 있어도 같은 연쇄에서 계속 재드로우되지 않습니다.",
          "효과 해결 순서와 해결 중인 카드 영역은 전투 상태에 저장합니다. 기존의 페이즈 양쪽 효과 처리 후 사망 판정을 유지합니다."
        ]
      },
      {
        "id": "poison_powder",
        "name": "독가루",
        "element": "NATURE",
        "cost": 0,
        "text": "이번 턴의 엔드 페이즈시에, 상대에게 이번 턴에 상대가 뽑은 카드의 수만큼 중독을 부여합니다.",
        "exclusive": true,
        "upgradeable": false,
        "effectId": "poison_powder",
        "parameters": {},
        "notes": []
      },
      {
        "id": "hanar_truth",
        "name": "진실",
        "element": "ICE",
        "cost": 1,
        "text": "이 카드의 효과는 상대가 마지막으로 뽑은 카드의 효과가 됩니다.",
        "exclusive": true,
        "upgradeable": false,
        "effectId": "hanar_truth",
        "parameters": {},
        "notes": []
      },
      {
        "id": "hanar_lie",
        "name": "거짓",
        "element": "LIGHTNING",
        "cost": 1,
        "text": "상대가 낸 무작위 카드를 카운터합니다. 치명타: 무작위 발견 카드를 내 손으로 가져옵니다.",
        "exclusive": true,
        "upgradeable": false,
        "effectId": "hanar_lie",
        "parameters": {},
        "notes": []
      },
      {
        "id": "pointing",
        "name": "지목",
        "element": "NEUTRAL",
        "cost": 0,
        "text": "상대의 손에서 첫 번째에 있는 카드를 상대의 덱에 섞어 넣습니다. 서로 카드를 1장 뽑습니다.",
        "exclusive": true,
        "upgradeable": false,
        "effectId": "pointing",
        "parameters": {},
        "notes": []
      },
      {
        "id": "boo_scare",
        "name": "놀래키기",
        "element": "NEUTRAL",
        "cost": 1,
        "text": "뽑을 때 시전. 카드를 뽑고, 상대 손에 있는 무작위 카드 하나를 레스트로 보냅니다.",
        "upgradeable": false,
        "exclusive": true,
        "flags": {
          "castOnDraw": true
        },
        "effectId": "boo_scare",
        "parameters": {
          "usedBy": [
            "boo"
          ]
        }
      },
      {
        "id": "salvation_prayer",
        "name": "구원의 기도",
        "element": "HOLY",
        "cost": 0,
        "text": "서로 체력을 5 회복합니다.",
        "upgradeable": false,
        "exclusive": true,
        "flags": {},
        "effectId": "heal_both",
        "parameters": {
          "amount": 5,
          "usedBy": [
            "yuumi"
          ]
        }
      },
      {
        "id": "fiora_weakness_nature",
        "name": "약점 포착",
        "element": "NATURE",
        "cost": 1,
        "text": "압도. 내 덱에서 '약점 포착'을 뽑습니다. 치명타: 다음 2턴의 스탠바이 페이즈시에 체력을 5 회복합니다.",
        "exclusive": true,
        "upgradeable": false,
        "effectId": "fiora_weakness_nature",
        "parameters": {},
        "notes": []
      },
      {
        "id": "fiora_weakness_ice",
        "name": "약점 포착",
        "element": "ICE",
        "cost": 1,
        "text": "압도. 내 덱에서 '약점 포착'을 뽑습니다. 치명타: 상대의 손에서 카드를 발견하여 레스트로 보냅니다.",
        "exclusive": true,
        "upgradeable": false,
        "effectId": "fiora_weakness_ice",
        "parameters": {},
        "notes": []
      },
      {
        "id": "fiora_weakness_lightning",
        "name": "약점 포착",
        "element": "LIGHTNING",
        "cost": 1,
        "text": "압도. 내 덱에서 '약점 포착'을 뽑습니다. 치명타: 상대의 레스트에서 카드를 발견하여 내 손으로 가져옵니다.",
        "exclusive": true,
        "upgradeable": false,
        "effectId": "fiora_weakness_lightning",
        "parameters": {},
        "notes": []
      },
      {
        "id": "fiora_weakness_fire",
        "name": "약점 포착",
        "element": "FIRE",
        "cost": 1,
        "text": "압도. 내 덱에서 '약점 포착'을 뽑습니다. 치명타: 상대에게 피해를 8 줍니다.",
        "exclusive": true,
        "upgradeable": false,
        "effectId": "fiora_weakness_fire",
        "parameters": {},
        "notes": []
      },
      {
        "id": "fiora_grand_duel",
        "name": "대결투",
        "element": "HOLY",
        "cost": 2,
        "text": "압도, 일회용. 내 레스트에 있는 '약점 포착'을 모두 내 손으로 가져옵니다. 내 덱에 4속성의 '약점 포착'을 섞어 넣습니다.",
        "exclusive": true,
        "upgradeable": false,
        "effectId": "fiora_grand_duel",
        "parameters": {},
        "notes": []
      },
      {
        "id": "boo_ghost_raider",
        "name": "유령 강탈자",
        "element": "NEUTRAL",
        "cost": 0,
        "text": "상대에게 이번 턴에 사용된 카드의 숫자당 4의 피해를 줍니다.",
        "exclusive": true,
        "upgradeable": false,
        "effectId": "boo_ghost_raider",
        "parameters": {
          "countDirectCardsOnly": true,
          "bothSides": true,
          "aiMinimumDamage": 12
        },
        "notes": [
          "양쪽의 직접 사용 카드만 세며, 이 카드와 같은 제출의 직접 사용 카드도 포함합니다. 자동 시전과 영웅 능력은 제외합니다."
        ]
      }
    ],
    "doctorQuotes": [
      "너는 (플레이어 닉네임) 사도다. 내가 이 반석 위에 내 교회를 세울 터인즉, 죽음의 힘도 감히 그것을 누르지 못할 것이다.",
      "저희에게 일러 주십시오. 그런 일이 언제 일어나겠습니까?",
      "우리가 불을 명하여 하늘로부터 내려 저들을 멸하라 하기를 원하시나이까",
      "처음 있던 것들이 다 지나갔음이라.",
      "아버지를 우리에게 보여 주옵소서, 그리하면 족하겠나이다.",
      "그가 이르시되 나를 따르라 하시니 일어나 따르리라.",
      "대적들이 한 길로 너를 치러 오지만, 일곱 길로 흩어져 도망하리라",
      "(플레이어 닉네임) 사도가 다른 제자들에게 말하되 우리도 함께 죽으러 가자 하니라.",
      "보라, 내가 만물을 새롭게 하노라.",
      "힘으로도, 권력으로도 되지 아니하고 오직 나의 영으로 이루어지리라.",
      "이 후로는 누구든지 나를 괴롭히게 하지 말라, 내가 내 몸에 그의 흔적을 지니고 있노라.",
      "내가 너희 열둘을 택하지 아니하였느냐, 그러나 너희 중의 한 사람은 마귀니라 하시니."
    ],
    "resolvedDecisions": [
      {
        "id": "deactivation_opening_overflow",
        "subject": "개십악질 시작 손패",
        "decision": "모든 전투의 손패 상한은 8장입니다. 기본 시작 손패 4장과 비활성화 3장, 총 7장을 정상 보유합니다.",
        "affected": [
          "extreme_troll",
          "deactivation"
        ],
        "status": "resolved-by-user"
      },
      {
        "id": "white_night_timeout",
        "subject": "백야 15초 제한",
        "decision": "15초 동안 제출하지 않으면 해당 메인 페이즈에 플레이어가 카드를 내지 않은 것으로 취급하고 다음 페이즈로 진행합니다.",
        "interpretation": "영웅 능력도 제출하지 않은 빈 행동으로 처리합니다. 봇 종료 시간의 취급은 별도 미정입니다.",
        "affected": [
          "plague_doctor"
        ],
        "status": "resolved-by-user"
      },
      {
        "id": "cosmic_balance_activation",
        "subject": "우주의 균형 사용 방식",
        "decision": "1마나 사용형, 턴당 1회입니다. 사용할 때마다 이번 전투의 내 카드 피해량과 회복량 +1이 누적됩니다.",
        "affected": [
          "aurelion_sol"
        ],
        "status": "resolved-by-user"
      },
      {
        "id": "ivern_draw_count",
        "subject": "수풀 가꾸기 교체 장수",
        "decision": "장수 언급이 없으면 1장입니다. 서로 손패의 비자연 카드 1장만 덱에 섞고 자연 카드 1장을 뽑습니다.",
        "affected": [
          "ivern"
        ],
        "status": "resolved-by-user"
      },
      {
        "id": "crystal_transform_zones",
        "subject": "수정구 변신 범위",
        "decision": "매 스탠바이 페이즈에 손패에 있는 수정구만 변신합니다.",
        "affected": [
          "crystal_ball"
        ],
        "status": "resolved-by-user"
      },
      {
        "id": "salvation_countdown",
        "subject": "구원의 길 작동과 누적",
        "decision": "선천성. 일회용. 50턴 후의 엔드 페이즈시에 게임에서 승리합니다. 누구든지 신성 카드를 낼 때마다 남은 턴이 1 추가로 감소합니다.",
        "interpretation": "매 엔드 페이즈에 기본 1턴과 양쪽의 직접 사용 신성 카드 장수만큼 추가 감소합니다. 턴당 추가 감소 상한은 없고, 카운터당한 직접 사용은 포함하며 자동 시전은 제외합니다. 최초 사용 카드도 집계하고 재사용으로 카운트를 초기화하지 않습니다.",
        "affected": [
          "path_to_salvation"
        ],
        "status": "resolved-by-user"
      },
      {
        "id": "filtered_draw_empty",
        "subject": "조건부 드로우의 후보 부재",
        "decision": "덱은 현재 뽑을 카드 더미입니다. 더미에 카드가 남아 있지만 조건에 맞는 카드가 없으면 뽑지 않습니다. 더미 전체가 비었을 때만 기존 규칙대로 레스트를 리필한 뒤 조건을 적용합니다.",
        "affected": [
          "extreme_troll",
          "antonidas",
          "ivern",
          "trap_room"
        ],
        "status": "resolved-from-existing-rules"
      },
      {
        "id": "mushroom_draw_loop",
        "subject": "독버섯 연쇄 해결과 레스트 이동",
        "decision": "사용 카드는 효과 해결 후 레스트로 이동한다는 기존 순서를 적용합니다. 자동 시전된 독버섯을 해결 영역에 두고 자기 피해와 후속 드로우를 모두 해결한 뒤 레스트로 옮깁니다. 해결 중인 카드는 리필 대상이 아니므로 독버섯만 남은 연쇄도 유한하게 끝납니다.",
        "implementationRequirement": "해결 중인 카드 영역과 중첩 드로우 해결 스택을 저장하여 재시작 후 같은 순서로 이어가야 합니다. 사망은 기존 규칙대로 양쪽 페이즈 효과 처리 후 판정합니다.",
        "affected": [
          "poisonous_mushroom"
        ],
        "status": "resolved-from-existing-rules"
      }
    ],
    "unresolved": [
      {
        "id": "white_night_offline_timer",
        "subject": "백야 제한 시간과 봇 종료",
        "question": "봇이 꺼져 있던 시간도 15초 제한에 포함하나요, 재개 시 응답 시간을 보장하나요?",
        "affected": [
          "plague_doctor"
        ],
        "status": "unresolved"
      },
      {
        "id": "special_victory_phase_tie",
        "subject": "특수 승리와 사망의 충돌",
        "question": "같은 페이즈에 경고 3회 또는 구원의 길 승리와 체력 0이 함께 발생하면 어떤 판정을 우선하나요?",
        "affected": [
          "ban_hammer_triple",
          "path_to_salvation"
        ],
        "status": "unresolved"
      },
      {
        "id": "black_knight_target",
        "subject": "처형 대상",
        "question": "처형은 상대의 이번 제출 중 무작위 카드 1장을 카운터하나요, 다른 기준으로 고르나요?",
        "affected": [
          "black_knight"
        ],
        "status": "unresolved"
      }
    ]
  },
  "classes": {
    "heroes": [
      {
        "id": "guff",
        "name": "거프 룬토템",
        "power": {
          "id": "nurture",
          "name": "양성",
          "kind": "active",
          "element": "NEUTRAL",
          "cost": 1,
          "text": "내 손에 있는 무작위 카드의 비용이 (1) 감소합니다.",
          "effects": [
            {
              "type": "discountRandomHand",
              "amount": 1
            }
          ]
        },
        "startingTreasureId": "purification_well",
        "cards": [
          "starter_strike",
          "starter_strike",
          "starter_strike",
          "guff_regen",
          "starter_guard",
          "starter_guard",
          "starter_guard",
          "starter_link",
          "starter_link",
          "guff_thunderbolt"
        ],
        "classPool": [
          "guff_innervate",
          "guff_bloom",
          "guff_snack",
          "guff_phytoncide",
          "guff_growth",
          "guff_entangle"
        ],
        "mechanics": [
          "마나 부스트",
          "회복",
          "각성"
        ]
      },
      {
        "id": "silent",
        "name": "사일런트",
        "power": {
          "id": "swift",
          "name": "신속",
          "kind": "active",
          "cost": 1,
          "element": "NEUTRAL",
          "text": "카드를 뽑습니다.",
          "effects": [
            {
              "type": "draw",
              "amount": 1
            }
          ]
        },
        "startingTreasureId": "snake_ring",
        "cards": [
          "starter_strike",
          "starter_strike",
          "starter_strike",
          "starter_guard",
          "starter_guard",
          "starter_guard",
          "silent_neutralize",
          "silent_neutralize",
          "starter_link",
          "starter_link"
        ],
        "classPool": [
          "silent_apple",
          "silent_poison",
          "silent_sowing",
          "silent_rising",
          "silent_mushroom",
          "silent_seedbomb"
        ],
        "mechanics": [
          "중독",
          "디버프",
          "단검"
        ]
      },
      {
        "id": "celeste",
        "name": "운룡 셀레스테",
        "power": {
          "id": "inquiry",
          "name": "탐구",
          "kind": "passive",
          "element": "NEUTRAL",
          "cost": 0,
          "text": "2턴마다의 스탠바이 페이즈시마다, ‘수정구’를 내 손으로 가져옵니다.",
          "effects": []
        },
        "startingTreasureId": "pandaria_codex",
        "cards": [
          "celeste_chain",
          "celeste_chain",
          "celeste_chain",
          "starter_guard",
          "starter_guard",
          "starter_guard",
          "celeste_leap",
          "celeste_leap",
          "starter_link",
          "starter_link"
        ],
        "classPool": [
          "celeste_focus"
        ],
        "mechanics": [
          "카드 생성 및 발견",
          "위력 증가 및 연쇄 타격",
          "중립 카드 생성",
          "궤도"
        ]
      },
      {
        "id": "thekal",
        "name": "대사제 데칼",
        "power": {
          "id": "loa_call",
          "name": "로아의 부름",
          "kind": "active",
          "element": "NEUTRAL",
          "cost": 2,
          "text": "내 제단이 파괴된 상태면, 부활을 1턴 가속합니다.",
          "module": "classes",
          "rule": "loa_call"
        },
        "startingTreasureId": "bound_reliquary",
        "cards": [
          "thekal_invocation",
          "thekal_invocation",
          "starter_guard",
          "starter_guard",
          "starter_guard",
          "starter_link",
          "starter_link",
          "thekal_acolyte",
          "thekal_acolyte",
          "thekal_acolyte"
        ],
        "classPool": [
          "thekal_icicle",
          "thekal_curse"
        ],
        "mechanics": [
          "제단",
          "자체 디버프와 저주",
          "처형",
          "저주 카드군"
        ]
      },
      {
        "id": "agamaggan",
        "name": "위대한 멧돼지 아감마간",
        "enabled": true,
        "power": {
          "id": "bloodcraft",
          "name": "혈석 제작",
          "kind": "active",
          "element": "NEUTRAL",
          "cost": 0,
          "text": "이번 탐험에서 처치한 상대 수의 2배만큼 체력을 희생하여 혈석을 만듭니다.",
          "module": "classes",
          "rule": "bloodcraft"
        },
        "startingTreasureId": "great_blood",
        "cards": [
          "agamaggan_crescendo",
          "agamaggan_crescendo",
          "starter_guard",
          "starter_guard",
          "starter_guard",
          "agamaggan_saturation",
          "agamaggan_saturation",
          "agamaggan_saturation",
          "agamaggan_blood_ritual",
          "agamaggan_blood_ritual"
        ],
        "classPool": [
          "agamaggan_mimic",
          "agamaggan_frost",
          "agamaggan_bait",
          "agamaggan_snow",
          "agamaggan_drop",
          "agamaggan_surf"
        ],
        "mechanics": [
          "혈석",
          "해방",
          "0코스트",
          "탈진 피해"
        ]
      },
      {
        "id": "nautilus",
        "name": "심해의 타이탄 노틸러스",
        "enabled": false,
        "incompleteReason": "시작 덱 미정",
        "power": {
          "id": "anchor_pull",
          "name": "닻줄 견인",
          "kind": "active",
          "element": "NEUTRAL",
          "cost": 1,
          "text": "내 덱에서 카드를 발견합니다. 그 카드를 내 덱 맨 위에 놓거나 맨 밑에 놓습니다.",
          "module": "classes",
          "rule": "anchor_pull"
        },
        "startingTreasureId": "bilgewater_tribute",
        "cards": [],
        "classPool": [
          "nautilus_anchor",
          "nautilus_stolen",
          "nautilus_bait",
          "nautilus_flood",
          "nautilus_salvage",
          "nautilus_negotiate",
          "nautilus_rewind",
          "nautilus_excavate",
          "nautilus_convert",
          "nautilus_plasma",
          "nautilus_aurawheel",
          "nautilus_cannon",
          "nautilus_overdrive"
        ],
        "mechanics": [
          "침몰·폐기",
          "버리기",
          "보물·골드 획득",
          "레스트 재사용"
        ]
      }
    ],
    "cards": [
      {
        "id": "starter_strike",
        "name": "타격",
        "element": "NATURE",
        "cost": 1,
        "text": "피해를 6 줍니다.",
        "action": "strike",
        "upgrade": {
          "cost": 1,
          "text": "피해를 9 줍니다."
        }
      },
      {
        "id": "starter_guard",
        "name": "수비",
        "element": "ICE",
        "cost": 1,
        "text": "방어도를 5 얻습니다.",
        "action": "guard",
        "upgrade": {
          "cost": 1,
          "text": "방어도를 8 얻습니다."
        }
      },
      {
        "id": "starter_link",
        "name": "연결",
        "element": "LIGHTNING",
        "cost": 1,
        "text": "카드를 2장 뽑습니다.",
        "action": "link",
        "upgrade": {
          "cost": 1,
          "text": "카드를 3장 뽑습니다."
        }
      },
      {
        "id": "guff_regen",
        "name": "재생",
        "element": "NATURE",
        "cost": 1,
        "text": "체력을 2 회복합니다. 다음 턴의 스탠바이 페이즈시에 체력을 2 회복합니다.",
        "action": "regen",
        "upgrade": {
          "cost": 1,
          "text": "체력을 4 회복합니다. 다음 턴의 스탠바이 페이즈시에 체력을 4 회복합니다."
        }
      },
      {
        "id": "guff_thunderbolt",
        "name": "뇌전",
        "element": "LIGHTNING",
        "cost": 2,
        "text": "피해를 8 줍니다. 상대에게 감전을 2 부여합니다.",
        "action": "thunderbolt",
        "upgrade": {
          "cost": 2,
          "text": "피해를 10 줍니다. 상대에게 감전을 3 부여합니다."
        }
      },
      {
        "id": "silent_neutralize",
        "name": "무력화",
        "element": "ICE",
        "cost": 1,
        "text": "피해를 3 줍니다. 약화를 1 부여합니다.",
        "action": "neutralize",
        "upgrade": {
          "cost": 1,
          "text": "피해를 4 줍니다. 약화를 2 부여합니다."
        }
      },
      {
        "id": "celeste_chain",
        "name": "연쇄 타격",
        "element": "FIRE",
        "cost": 1,
        "text": "피해를 2씩 2번 줍니다.",
        "action": "chain",
        "upgrade": {
          "cost": 1,
          "text": "피해를 2씩 3번 줍니다."
        }
      },
      {
        "id": "celeste_leap",
        "name": "도약",
        "element": "LIGHTNING",
        "cost": 1,
        "text": "내 직업의 카드를 발견하여 내 손으로 가져옵니다.",
        "action": "leap",
        "upgrade": {
          "cost": 1,
          "text": "내 직업의 카드를 발견하여 내 손으로 가져옵니다."
        }
      },
      {
        "id": "thekal_invocation",
        "name": "기원",
        "element": "FIRE",
        "cost": 1,
        "text": "내 모든 제단의 최대 체력이 3 증가합니다.",
        "action": "invocation",
        "upgrade": {
          "cost": 1,
          "text": "내 모든 제단의 최대 체력이 5 증가합니다."
        }
      },
      {
        "id": "thekal_acolyte",
        "name": "수행자",
        "element": "LIGHTNING",
        "cost": 1,
        "text": "내 제단이 피해를 3 줍니다. 내 제단의 현재 체력만큼 피해량이 증가합니다.",
        "action": "acolyte",
        "upgrade": {
          "cost": 1,
          "text": "내 제단이 피해를 6 줍니다. 내 제단의 현재 체력만큼 피해량이 증가합니다."
        }
      },
      {
        "id": "guff_innervate",
        "name": "정신 자극",
        "element": "NATURE",
        "cost": 0,
        "text": "일시적. 일시적인 마나를 1 얻습니다.",
        "action": "innervate",
        "upgrade": {
          "cost": 0,
          "text": "일시적. 일시적인 마나를 2 얻습니다."
        }
      },
      {
        "id": "guff_bloom",
        "name": "번개 개화",
        "element": "NATURE",
        "cost": 0,
        "text": "과부하: (2). 이번 턴에만 마나를 2 얻습니다.",
        "delegate": "번개 개화",
        "upgrade": {
          "cost": 0,
          "text": "과부하: (1). 이번 턴에만 마나를 2 얻습니다."
        }
      },
      {
        "id": "guff_snack",
        "name": "등산용 간식",
        "element": "NATURE",
        "cost": 1,
        "text": "다음 턴의 스탠바이 페이즈시에, 일시적인 마나를 2 얻습니다.",
        "action": "snack",
        "upgrade": {
          "cost": 1,
          "text": "다음 두 턴의 스탠바이 페이즈시에, 일시적인 마나를 2 얻습니다."
        }
      },
      {
        "id": "guff_phytoncide",
        "name": "피톤치드",
        "element": "NATURE",
        "cost": 1,
        "text": "내 최대 마나만큼 카드를 뽑습니다.",
        "action": "phytoncide",
        "upgrade": {
          "cost": 0,
          "text": "내 최대 마나만큼 카드를 뽑습니다."
        }
      },
      {
        "id": "guff_growth",
        "name": "급속 성장",
        "element": "NATURE",
        "cost": 2,
        "text": "일회용. 내 최대 마나가 1 증가합니다.",
        "action": "growth",
        "upgrade": {
          "cost": 2,
          "text": "선천성, 일회용. 내 최대 마나가 1 증가합니다."
        }
      },
      {
        "id": "guff_entangle",
        "name": "옭아매기",
        "element": "NATURE",
        "cost": 0,
        "text": "상대에게 약화를 2 부여합니다.",
        "action": "entangle",
        "upgrade": {
          "cost": 0,
          "text": "상대에게 약화를 3 부여합니다."
        }
      },
      {
        "id": "silent_apple",
        "name": "독사과",
        "element": "NATURE",
        "cost": 0,
        "text": "체력을 12 회복합니다. 나에게 중독을 3 부여합니다.",
        "delegate": "독사과",
        "upgrade": {
          "cost": 0,
          "text": "체력을 18 회복합니다. 나에게 중독을 3 부여합니다."
        }
      },
      {
        "id": "silent_poison",
        "name": "맹독",
        "element": "NATURE",
        "cost": 1,
        "text": "상대에게 중독을 3 부여합니다.",
        "delegate": "맹독",
        "upgrade": {
          "cost": 1,
          "text": "상대에게 중독을 4 부여합니다."
        }
      },
      {
        "id": "silent_sowing",
        "name": "씨뿌리기",
        "element": "NATURE",
        "cost": 1,
        "text": "상대에게 중독을 3 부여합니다. 이미 중독 상태라면, 대신 상대에게 부여된 중독을 모두 소모하고 중독 피해를 즉시 입힙니다.",
        "delegate": "씨뿌리기",
        "upgrade": {
          "cost": 1,
          "text": "상대에게 중독을 4 부여합니다. 이미 중독 상태라면, 대신 상대에게 부여된 중독을 모두 소모하고 중독 피해를 즉시 입힙니다."
        }
      },
      {
        "id": "silent_rising",
        "name": "차오르는 독",
        "element": "NATURE",
        "cost": 1,
        "text": "상대에게 중독을 2 부여합니다. 상대가 이미 중독 상태면, 대신 중독을 4 부여합니다.",
        "delegate": "차오르는 독",
        "upgrade": {
          "cost": 1,
          "text": "상대에게 중독을 3 부여합니다. 상대가 이미 중독 상태면, 대신 중독을 5 부여합니다."
        }
      },
      {
        "id": "silent_mushroom",
        "name": "독버섯",
        "element": "NATURE",
        "cost": 2,
        "text": "상대에게 중독을 5 부여합니다. 치명타: 상대에게 중독만큼 피해를 줍니다.",
        "delegate": "독버섯",
        "upgrade": {
          "cost": 2,
          "text": "상대에게 중독을 7 부여합니다. 치명타: 상대에게 중독만큼 피해를 줍니다."
        }
      },
      {
        "id": "silent_seedbomb",
        "name": "씨폭탄",
        "element": "NATURE",
        "cost": 1,
        "text": "상대에게 피해를 5 줍니다. 상대가 중독 상태라면, 대신 피해를 8 줍니다.",
        "action": "seedbomb",
        "upgrade": {
          "cost": 1,
          "text": "상대에게 피해를 10 줍니다. 상대가 중독 상태라면, 대신 피해를 16 줍니다."
        }
      },
      {
        "id": "celeste_focus",
        "name": "힘 모으기",
        "element": "FIRE",
        "cost": 0,
        "text": "이번 턴에, 내가 카드를 낼 때마다 상대에게 피해를 3 줍니다.",
        "action": "focus"
      },
      {
        "id": "thekal_icicle",
        "name": "서리 저주",
        "element": "ICE",
        "cost": 1,
        "text": "상대에게 ‘고드름’ 카드를 줍니다. 고드름 카드 양쪽에 있는 카드들의 비용이 (1) 증가합니다.",
        "delegate": "서리 저주",
        "upgrade": {
          "cost": 1,
          "text": "상대에게 ‘고드름+’ 카드를 줍니다. 고드름 카드 양쪽에 있는 카드들의 비용이 (1) 증가합니다."
        }
      },
      {
        "id": "thekal_curse",
        "name": "심해 저주",
        "element": "ICE",
        "cost": 1,
        "text": "상대에게 ‘저주’ 카드를 줍니다. 저주 카드는 매 턴 엔드 페이즈시 보유자에게 피해를 3 줍니다.",
        "delegate": "심해 저주",
        "upgrade": {
          "cost": 1,
          "text": "상대에게 ‘저주+’ 카드를 줍니다. 저주+ 카드는 매 턴 엔드 페이즈시 보유자에게 피해를 5 줍니다."
        }
      },
      {
        "id": "agamaggan_mimic",
        "name": "모사",
        "element": "ICE",
        "cost": 0,
        "text": "일회용. 내 손에 있는 가장 낮은 비용의 카드를 복사합니다.",
        "action": "mimic",
        "upgrade": {
          "cost": 0,
          "text": "일회용. 내 손에 있는 가장 낮은 비용의 카드를 2장 복사합니다."
        }
      },
      {
        "id": "agamaggan_frost",
        "name": "서리꽃",
        "element": "ICE",
        "cost": 0,
        "text": "상대의 덱에 ‘혹한’을 3장 섞어 넣습니다.",
        "delegate": "서리꽃",
        "upgrade": {
          "cost": 0,
          "text": "상대의 덱에 ‘혹한+’을 3장 섞어 넣습니다."
        }
      },
      {
        "id": "agamaggan_bait",
        "name": "미끼 뿌리기",
        "element": "ICE",
        "cost": 0,
        "text": "내 덱에서 비용이 0인 다른 카드를 이번 전투 동안 강화합니다.",
        "action": "bait",
        "upgrade": {
          "cost": 0,
          "text": "내 덱에서 비용이 0인 다른 카드 둘을 이번 전투 동안 강화합니다."
        }
      },
      {
        "id": "agamaggan_snow",
        "name": "눈송이",
        "element": "ICE",
        "cost": 0,
        "text": "내 덱에서 비용이 0인 다른 카드를 사용합니다. 침몰: 그 카드들이 두 번 시전됩니다.",
        "action": "snow",
        "upgrade": {
          "cost": 0,
          "text": "내 덱에서 비용이 0인 다른 카드를 둘 사용합니다. 침몰: 그 카드들이 두 번 시전됩니다."
        }
      },
      {
        "id": "agamaggan_drop",
        "name": "투하",
        "element": "ICE",
        "cost": 2,
        "text": "내 손이 가득 찰 때까지 비용이 0인 카드를 뽑습니다.",
        "action": "zeroDraw",
        "upgrade": {
          "cost": 1,
          "text": "내 손이 가득 찰 때까지 비용이 0인 카드를 뽑습니다."
        }
      },
      {
        "id": "agamaggan_surf",
        "name": "파도타기",
        "element": "ICE",
        "cost": 1,
        "text": "해방: 다른 카드를 3장 이상 내야 합니다. 다음 두 턴의 스탠바이 페이즈시에, 내 덱에서 비용이 0인 무작위 카드를 사용합니다.",
        "action": "surf",
        "liberation": {
          "type": "played",
          "amount": 3
        },
        "upgrade": {
          "cost": 1,
          "text": "해방: 다른 카드를 3장 이상 내야 합니다. 다음 두 턴의 스탠바이 페이즈시에, 내 덱에서 비용이 0인 카드를 발견하여 사용합니다."
        }
      },
      {
        "id": "nautilus_drop",
        "name": "투하",
        "element": "ICE",
        "cost": 0,
        "text": "폐기: 2",
        "action": "discard",
        "upgrade": {
          "cost": 0,
          "text": "폐기: 3"
        }
      },
      {
        "id": "nautilus_buried",
        "name": "파묻힌 보물",
        "element": "ICE",
        "cost": 2,
        "text": "카드를 뽑고 방어도를 5 얻습니다. 침몰: 이 카드는 어디에 있든 비용이 (0)이 됩니다.",
        "action": "buried",
        "upgrade": {
          "cost": 2,
          "text": "카드를 2장 뽑고 방어도를 10 얻습니다. 침몰: 이 카드는 어디에 있든 비용이 (0)이 됩니다."
        }
      },
      {
        "id": "nautilus_surprise",
        "name": "서프라이드",
        "element": "LIGHTNING",
        "cost": 3,
        "text": "이 카드가 레스트로 이동할 때, 상대에게 피해를 10 주고 카드를 2장 뽑습니다.",
        "action": "restSurprise",
        "upgrade": {
          "cost": 3,
          "text": "이 카드가 레스트로 이동할 때, 상대에게 피해를 16 주고 카드를 2장 뽑습니다."
        }
      },
      {
        "id": "nautilus_anchor",
        "name": "닻을 내려라",
        "element": "ICE",
        "cost": 0,
        "text": "카드를 2장 뽑습니다. 다음 턴에 카드를 뽑을 수 없습니다. 침몰: 다음 턴에도 카드를 뽑을 수 있습니다.",
        "action": "anchor",
        "upgrade": {
          "cost": 0,
          "text": "카드를 4장 뽑습니다. 다음 턴에 카드를 뽑을 수 없습니다. 침몰: 다음 턴에도 카드를 뽑을 수 있습니다."
        }
      },
      {
        "id": "nautilus_stolen",
        "name": "장물",
        "element": "ICE",
        "cost": 1,
        "text": "상대의 덱에서 무작위 카드를 내 손으로 가져옵니다. 침몰: 대신 발견하여 가져옵니다.",
        "action": "stolen",
        "upgrade": {
          "cost": 1,
          "text": "상대의 덱에서 무작위 카드 둘을 내 손으로 가져옵니다. 침몰: 대신 발견하여 가져옵니다."
        }
      },
      {
        "id": "nautilus_bait",
        "name": "심해의 미끼",
        "element": "ICE",
        "cost": 1,
        "text": "폐기: 3. 카드를 뽑습니다.",
        "action": "deepBait",
        "upgrade": {
          "cost": 1,
          "text": "폐기: 6. 카드를 뽑습니다."
        }
      },
      {
        "id": "nautilus_flood",
        "name": "침수",
        "element": "ICE",
        "cost": 1,
        "text": "폐기: 3. 내 덱 맨 위에 있는 카드 3장의 비용을 (1) 감소시킵니다.",
        "action": "flood",
        "upgrade": {
          "cost": 1,
          "text": "폐기: 3. 내 덱 맨 위에 있는 카드 5장의 비용을 (1) 감소시킵니다."
        }
      },
      {
        "id": "nautilus_salvage",
        "name": "인양",
        "element": "ICE",
        "cost": 0,
        "text": "폐기: 3. 내 레스트에서 무작위 카드를 내 손으로 가져옵니다. 침몰: 대신 카드를 발견하여 내 손으로 가져옵니다.",
        "action": "salvage",
        "upgrade": {
          "cost": 0,
          "text": "폐기: 3. 내 레스트에서 무작위 카드 둘을 내 손으로 가져옵니다. 침몰: 대신 카드를 발견하여 내 손으로 가져옵니다."
        }
      },
      {
        "id": "nautilus_negotiate",
        "name": "혀어어어업상",
        "element": "ICE",
        "cost": 1,
        "text": "폐기: 3. 상대와 내 손에서 무작위 카드를 서로 바꿉니다. 침몰: 대신 발견하여 그 카드들을 서로 바꿉니다.",
        "action": "negotiate",
        "upgrade": {
          "cost": 0,
          "text": "폐기: 3. 상대와 내 손에서 무작위 카드를 서로 바꿉니다. 침몰: 대신 발견하여 그 카드들을 서로 바꿉니다."
        }
      },
      {
        "id": "nautilus_rewind",
        "name": "되감기",
        "element": "ICE",
        "cost": 1,
        "text": "상대에게 피해를 2 줍니다. 내 레스트에 있는 무작위 카드를 사용합니다.",
        "delegate": "되감기",
        "upgrade": {
          "cost": 0,
          "text": "상대에게 피해를 4 줍니다. 내 레스트에 있는 무작위 카드를 사용합니다."
        }
      },
      {
        "id": "nautilus_excavate",
        "name": "발굴",
        "element": "ICE",
        "cost": 1,
        "text": "내 레스트에서 카드를 발견하여 내 손으로 가져옵니다.",
        "delegate": "발굴",
        "upgrade": {
          "cost": 1,
          "text": "내 레스트에서 카드를 2장 발견하여 내 손으로 가져옵니다."
        }
      },
      {
        "id": "nautilus_convert",
        "name": "동력 전환",
        "element": "LIGHTNING",
        "cost": 0,
        "text": "내 손에서 카드를 발견하여 버리고 카드를 뽑습니다.",
        "action": "convert",
        "upgrade": {
          "cost": 0,
          "text": "내 손에서 카드를 발견하여 버리고 카드를 뽑습니다."
        }
      },
      {
        "id": "nautilus_plasma",
        "name": "플라즈마",
        "element": "LIGHTNING",
        "cost": 2,
        "text": "이 카드가 레스트로 이동할 때, 상대의 손에서 카드 하나를 감전시키고 카드를 3장 뽑습니다.",
        "action": "restPlasma",
        "upgrade": {
          "cost": 2,
          "text": "이 카드가 레스트로 이동할 때, 상대의 손에서 카드 셋을 감전시키고 카드를 3장 뽑습니다."
        }
      },
      {
        "id": "nautilus_aurawheel",
        "name": "오라휠",
        "element": "LIGHTNING",
        "cost": 3,
        "text": "이 카드가 레스트로 이동할 때, 무작위 하급 보물을 내 손으로 가져옵니다.",
        "action": "restAura",
        "upgrade": {
          "cost": 3,
          "text": "이 카드가 레스트로 이동할 때, 무작위 하급 보물을 내 손으로 가져오고 내 탐험 덱에 추가합니다."
        }
      },
      {
        "id": "nautilus_cannon",
        "name": "전자포",
        "element": "LIGHTNING",
        "cost": 1,
        "text": "이 카드가 레스트로 이동할 때, 상대에게 피해를 6 주고 손에서 카드 하나를 감전시킵니다.",
        "action": "restCannon",
        "upgrade": {
          "cost": 1,
          "text": "이 카드가 레스트로 이동할 때, 상대에게 피해를 10 주고 손에서 카드 하나를 감전시킵니다."
        }
      },
      {
        "id": "nautilus_overdrive",
        "name": "오버드라이브",
        "element": "LIGHTNING",
        "cost": 1,
        "text": "내 손에 있는 카드를 모두 버립니다. 버린 수만큼 카드를 뽑습니다.",
        "action": "overdrive",
        "upgrade": {
          "cost": 0,
          "text": "내 손에 있는 카드를 모두 버립니다. 버린 수만큼 카드를 뽑습니다."
        }
      },
      {
        "id": "agamaggan_crescendo",
        "name": "크레센도",
        "element": "FIRE",
        "cost": 1,
        "bloodCost": 1,
        "text": "체력을 5 회복합니다. 상대에게 탈진 피해를 줍니다.",
        "action": "crescendo",
        "upgrade": {
          "cost": 1,
          "text": "체력을 8 회복합니다. 상대에게 탈진 피해를 줍니다."
        }
      },
      {
        "id": "agamaggan_saturation",
        "name": "포화",
        "element": "ICE",
        "cost": 1,
        "bloodCost": 1,
        "text": "카드를 2장 뽑습니다.",
        "action": "saturation",
        "upgrade": {
          "cost": 1,
          "text": "카드를 3장 뽑습니다."
        }
      },
      {
        "id": "agamaggan_blood_ritual",
        "name": "혈석 의식",
        "element": "LIGHTNING",
        "cost": 1,
        "text": "해방: 이 카드가 손에 있을 때 영웅 능력을 1회 사용해야 합니다. 내 다음 영웅 능력이 체력을 소모하지 않습니다.",
        "action": "bloodRitual",
        "liberation": {
          "type": "heroPowerUsed",
          "amount": 1
        },
        "upgrade": {
          "cost": 1,
          "text": "해방: 이 카드가 손에 있을 때 영웅 능력을 1회 사용해야 합니다. 내 다음 영웅 능력이 대신 상대의 체력을 비용으로 사용합니다."
        }
      }
    ],
    "startingTreasures": [
      {
        "id": "purification_well",
        "name": "정화의 원천",
        "text": "전투마다 첫 2번의 해로운 효과를 무시합니다."
      },
      {
        "id": "snake_ring",
        "name": "뱀의 반지",
        "text": "첫 턴에만 카드를 2장 추가로 뽑습니다."
      },
      {
        "id": "pandaria_codex",
        "name": "판다리아의 비전서",
        "text": "‘수정구’를 5회 낼 때마다, 내 카드의 위력이 1 증가합니다."
      },
      {
        "id": "bound_reliquary",
        "name": "구속된 성물함",
        "text": "매 턴의 스탠바이 페이즈시에, 파괴되지 않은 내 모든 제단의 최대 체력이 1 증가합니다."
      },
      {
        "id": "great_blood",
        "name": "위대한 피",
        "text": "매 전투 종료 시 체력을 12 회복합니다."
      },
      {
        "id": "bilgewater_tribute",
        "name": "빌지워터의 공물",
        "text": "내가 처음으로 침몰한 후에, 무작위 하급 보물을 내 손으로 가져옵니다."
      }
    ],
    "shrines": [
      {
        "id": "akali",
        "name": "아칼리의 용사",
        "maxHp": 5,
        "text": "스탠바이 페이즈시에, 내 방어도만큼 상대에게 피해를 줍니다."
      },
      {
        "id": "kragwa",
        "name": "크라그와의 미끼",
        "maxHp": 5,
        "text": "내가 과부하되지 않습니다. 내가 과부하 카드를 낼 때마다, 상대에게 피해를 5 줍니다."
      },
      {
        "id": "gral",
        "name": "그랄의 미끼",
        "maxHp": 2,
        "text": "스탠바이 페이즈시에, 상대의 덱에서 무작위 카드를 내 손으로 복사하여 가져옵니다. 그 카드의 비용이 (1) 감소합니다."
      },
      {
        "id": "shirvallah",
        "name": "시르밸라의 가호",
        "maxHp": 5,
        "text": "내가 카드를 사용할 때마다, 무작위 신성 카드를 내 손으로 가져옵니다."
      },
      {
        "id": "halazzi",
        "name": "할라지의 굶주림",
        "maxHp": 5,
        "text": "엔드 페이즈시에, 이번 턴에 내가 낸 카드의 수의 2배만큼 상대에게 피해를 줍니다."
      },
      {
        "id": "gonk",
        "name": "공크의 갑주",
        "maxHp": 3,
        "text": "내가 방어도를 얻으면, 마나를 모두 회복합니다."
      },
      {
        "id": "hireek",
        "name": "히르이크의 서약",
        "maxHp": 5,
        "text": "내 카드가 마나 대신 5배의 생명력을 비용으로 사용합니다."
      },
      {
        "id": "janalai",
        "name": "잔알라이의 의복",
        "maxHp": 4,
        "text": "내 카드의 피해량과 회복량이 2 증가합니다."
      },
      {
        "id": "bwonsamdi",
        "name": "브원삼디의 거래",
        "maxHp": 8,
        "text": "내가 생명력을 회복할 때마다 회복하는 대신 상대에게 그만큼의 피해를 줍니다."
      }
    ]
  },
  "generalCards": [
    {
      "name": "과열",
      "element": "FIRE",
      "cost": 0,
      "text": "내 손에 카드가 없으면, 카드를 2장 뽑고 이번 턴에만 마나를 2 얻습니다.",
      "notes": [],
      "sourceLine": 3,
      "id": "general:과열",
      "upgrade": {
        "name": "과열+",
        "element": "FIRE",
        "cost": 0,
        "text": "내 손에 카드가 없으면, 카드를 3장 뽑고 이번 턴에만 마나를 3 얻습니다.",
        "notes": [],
        "sourceLine": 5
      },
      "token": false,
      "implementationStatus": "reference-only"
    },
    {
      "name": "불길",
      "element": "FIRE",
      "cost": 0,
      "text": "화염 카드를 뽑습니다.",
      "notes": [],
      "sourceLine": 8,
      "id": "general:불길",
      "upgrade": {
        "name": "불길+",
        "element": "FIRE",
        "cost": 0,
        "text": "화염 카드를 2장 뽑습니다.",
        "notes": [],
        "sourceLine": 10
      },
      "token": false,
      "implementationStatus": "reference-only"
    },
    {
      "name": "벼려내기",
      "element": "FIRE",
      "cost": 0,
      "text": "상대에게 피해를 4 줍니다. 일시적인 무작위 화염 카드를 얻습니다.",
      "notes": [],
      "sourceLine": 13,
      "id": "general:벼려내기",
      "upgrade": {
        "name": "벼려내기+",
        "element": "FIRE",
        "cost": 0,
        "text": "상대에게 피해를 8 줍니다. 일시적인 무작위 화염 카드를 2장 얻습니다.",
        "notes": [],
        "sourceLine": 15
      },
      "token": false,
      "implementationStatus": "reference-only"
    },
    {
      "name": "금단의 불꽃",
      "element": "FIRE",
      "cost": 0,
      "text": "마나를 모두 소모합니다. 상대에게 소모한 마나의 4배만큼의 피해를 줍니다.",
      "notes": [],
      "sourceLine": 18,
      "id": "general:금단의 불꽃",
      "upgrade": {
        "name": "금단의 불꽃+",
        "element": "FIRE",
        "cost": 0,
        "text": "마나를 모두 소모합니다. 상대에게 소모한 마나의 6배만큼의 피해를 줍니다.",
        "notes": [],
        "sourceLine": 20
      },
      "token": false,
      "implementationStatus": "reference-only"
    },
    {
      "name": "화염구",
      "element": "FIRE",
      "cost": 1,
      "text": "카드를 뽑습니다. 상대에게 피해를 4 줍니다.",
      "notes": [],
      "sourceLine": 23,
      "id": "general:화염구",
      "upgrade": {
        "name": "화염구+",
        "element": "FIRE",
        "cost": 1,
        "text": "카드를 뽑습니다. 상대에게 피해를 6 줍니다.",
        "notes": [],
        "sourceLine": 25
      },
      "token": false,
      "implementationStatus": "reference-only"
    },
    {
      "name": "마나 연소",
      "element": "FIRE",
      "cost": 1,
      "text": "다음 턴에 상대가 획득하는 마나가 1 감소합니다.",
      "notes": [],
      "sourceLine": 28,
      "id": "general:마나 연소",
      "upgrade": {
        "name": "마나 연소+",
        "element": "FIRE",
        "cost": 1,
        "text": "다음 턴에 상대가 획득하는 마나가 2 감소합니다.",
        "notes": [],
        "sourceLine": 30
      },
      "token": false,
      "implementationStatus": "reference-only"
    },
    {
      "name": "소각",
      "element": "FIRE",
      "cost": 1,
      "text": "상대에게 피해를 4 줍니다. 상대가 사용한 카드 중 하나를 게임에서 제외합니다.",
      "notes": [],
      "sourceLine": 33,
      "id": "general:소각",
      "upgrade": {
        "name": "소각+",
        "element": "FIRE",
        "cost": 1,
        "text": "상대에게 피해를 8 줍니다. 상대가 사용한 카드들을 모두 게임에서 제외합니다.",
        "notes": [],
        "sourceLine": 35
      },
      "token": false,
      "implementationStatus": "reference-only"
    },
    {
      "name": "작열통",
      "element": "FIRE",
      "cost": 1,
      "text": "상대에게 피해를 6 줍니다. 상대는 2턴 뒤의 엔드 페이즈시까지 체력 회복량이 절반으로 감소합니다.",
      "notes": [],
      "sourceLine": 38,
      "id": "general:작열통",
      "upgrade": {
        "name": "작열통+",
        "element": "FIRE",
        "cost": 1,
        "text": "상대에게 피해를 10 줍니다. 상대는 2턴 뒤의 엔드 페이즈시까지 체력을 회복할 수 없습니다.",
        "notes": [
          "내림"
        ],
        "sourceLine": 40
      },
      "token": false,
      "implementationStatus": "reference-only"
    },
    {
      "name": "영혼관",
      "element": "FIRE",
      "cost": 0,
      "text": "카드를 3장 뽑습니다. 그 카드들은 일시적입니다.",
      "notes": [],
      "sourceLine": 44,
      "id": "general:영혼관",
      "upgrade": {
        "name": "영혼관+",
        "element": "FIRE",
        "cost": 0,
        "text": "카드를 3장 뽑습니다.",
        "notes": [],
        "sourceLine": 46
      },
      "token": false,
      "implementationStatus": "reference-only"
    },
    {
      "name": "불장난",
      "element": "FIRE",
      "cost": 1,
      "text": "상대에게 피해를 4 줍니다. 이 카드는 레스트에 있다면 다음 턴의 스탠바이 페이즈시에 내 손으로 돌아옵니다.",
      "notes": [],
      "sourceLine": 49,
      "id": "general:불장난",
      "upgrade": {
        "name": "불장난+",
        "element": "FIRE",
        "cost": 1,
        "text": "상대에게 피해를 6 줍니다. 이 카드는 레스트에 있다면 다음 턴의 스탠바이 페이즈시에 내 손으로 돌아옵니다.",
        "notes": [],
        "sourceLine": 51
      },
      "token": false,
      "implementationStatus": "reference-only"
    },
    {
      "name": "태양 작렬",
      "element": "FIRE",
      "cost": 1,
      "text": "다음 턴의 엔드 페이즈시까지 상대가 피해를 10 받으면 피해를 10 더 주고 카드를 뽑습니다.",
      "notes": [],
      "sourceLine": 54,
      "id": "general:태양 작렬",
      "upgrade": {
        "name": "태양 작렬+",
        "element": "FIRE",
        "cost": 1,
        "text": "다음 턴의 엔드 페이즈시까지 상대가 피해를 10 받으면 피해를 15 더 주고 카드를 뽑습니다.",
        "notes": [],
        "sourceLine": 56
      },
      "token": false,
      "implementationStatus": "reference-only"
    },
    {
      "name": "화염 장막",
      "element": "FIRE",
      "cost": 1,
      "text": "다음 턴의 엔드 페이즈시까지 내가 받는 모든 피해가 3 감소하고 피해를 받을 때마다 상대에게 피해를 3 줍니다.",
      "notes": [],
      "sourceLine": 59,
      "id": "general:화염 장막",
      "upgrade": {
        "name": "화염 장막+",
        "element": "FIRE",
        "cost": 1,
        "text": "다음 턴의 엔드 페이즈시까지 내가 받는 모든 피해가 5 감소하고 피해를 받을 때마다 상대에게 피해를 5 줍니다.",
        "notes": [],
        "sourceLine": 61
      },
      "token": false,
      "implementationStatus": "reference-only"
    },
    {
      "name": "점화",
      "element": "FIRE",
      "cost": 1,
      "text": "제한. 상대에게 피해를 5 줍니다. 내 다음 점화의 피해량이 5 증가합니다.",
      "notes": [],
      "sourceLine": 64,
      "id": "general:점화",
      "upgrade": {
        "name": "점화+",
        "element": "FIRE",
        "cost": 1,
        "text": "선천성, 제한. 상대에게 피해를 5 줍니다. 내 다음 점화의 피해량이 5 증가합니다.",
        "notes": [],
        "sourceLine": 66
      },
      "token": false,
      "implementationStatus": "reference-only"
    },
    {
      "name": "폭발의 룬",
      "element": "FIRE",
      "cost": 1,
      "text": "압도, 상대에게 피해를 4 줍니다. 치명타: 상대에게 피해를 6 줍니다.",
      "notes": [],
      "sourceLine": 69,
      "id": "general:폭발의 룬",
      "upgrade": {
        "name": "폭발의 룬+",
        "element": "FIRE",
        "cost": 1,
        "text": "압도, 상대에게 피해를 8 줍니다. 치명타: 상대에게 피해를 12 더 줍니다.",
        "notes": [],
        "sourceLine": 71
      },
      "token": false,
      "implementationStatus": "reference-only"
    },
    {
      "name": "절멸",
      "element": "FIRE",
      "cost": 1,
      "text": "상대가 낸 무작위 카드를 카운터합니다. 내가 피해를 5 받습니다.",
      "notes": [],
      "sourceLine": 74,
      "id": "general:절멸",
      "upgrade": {
        "name": "절멸+",
        "element": "FIRE",
        "cost": 1,
        "text": "상대가 낸 무작위 카드를 카운터합니다.",
        "notes": [],
        "sourceLine": 76
      },
      "token": false,
      "implementationStatus": "reference-only"
    },
    {
      "name": "백드래프트",
      "element": "FIRE",
      "cost": 2,
      "text": "상대에게 내 덱에 있는 카드의 수만큼 피해를 줍니다.",
      "notes": [],
      "sourceLine": 79,
      "id": "general:백드래프트",
      "upgrade": {
        "name": "백드래프트+",
        "element": "FIRE",
        "cost": 1,
        "text": "상대에게 내 덱에 있는 카드의 수만큼 피해를 줍니다.",
        "notes": [],
        "sourceLine": 81
      },
      "token": false,
      "implementationStatus": "reference-only"
    },
    {
      "name": "번아웃",
      "element": "FIRE",
      "cost": 2,
      "text": "상대의 손에 있는 모든 카드에 불을 붙입니다. 그 카드들은 3턴 후의 스탠바이 페이즈시에 레스트로 이동합니다.",
      "notes": [],
      "sourceLine": 84,
      "id": "general:번아웃",
      "upgrade": {
        "name": "번아웃+",
        "element": "FIRE",
        "cost": 2,
        "text": "상대의 손에 있는 모든 카드에 불을 붙입니다. 그 카드들은 2턴 후의 스탠바이 페이즈시에 레스트로 이동합니다.",
        "notes": [],
        "sourceLine": 86
      },
      "token": false,
      "implementationStatus": "reference-only"
    },
    {
      "name": "화염 제단",
      "element": "FIRE",
      "cost": 3,
      "text": "일회용. 이번 게임 동안 내 화염 카드들이 압도를 얻습니다.",
      "notes": [],
      "sourceLine": 89,
      "id": "general:화염 제단",
      "upgrade": {
        "name": "화염 제단+",
        "element": "FIRE",
        "cost": 2,
        "text": "일회용. 이번 게임 동안 내 화염 카드들이 압도를 얻습니다.",
        "notes": [],
        "sourceLine": 91
      },
      "token": false,
      "implementationStatus": "reference-only"
    },
    {
      "name": "불안정한 원소",
      "element": "FIRE",
      "cost": 4,
      "text": "일회용. 내 덱의 남은 카드를 모두 뽑습니다.",
      "notes": [],
      "sourceLine": 94,
      "id": "general:불안정한 원소",
      "upgrade": {
        "name": "불안정한 원소+",
        "element": "FIRE",
        "cost": 3,
        "text": "일회용. 내 덱의 남은 카드를 모두 뽑습니다.",
        "notes": [],
        "sourceLine": 96
      },
      "token": false,
      "implementationStatus": "reference-only"
    },
    {
      "name": "불덩이 작렬",
      "element": "FIRE",
      "cost": 5,
      "text": "상대에게 피해를 30 줍니다.",
      "notes": [],
      "sourceLine": 99,
      "id": "general:불덩이 작렬",
      "upgrade": {
        "name": "불덩이 작렬+",
        "element": "FIRE",
        "cost": 5,
        "text": "상대에게 피해를 50 줍니다.",
        "notes": [],
        "sourceLine": 101
      },
      "token": false,
      "implementationStatus": "reference-only"
    },
    {
      "name": "서리꽃",
      "element": "ICE",
      "cost": 0,
      "text": "상대의 덱에 ‘혹한’을 3장 섞어 넣습니다.",
      "notes": [],
      "sourceLine": 111,
      "id": "general:서리꽃",
      "upgrade": {
        "name": "서리꽃+",
        "element": "ICE",
        "cost": 0,
        "text": "상대의 덱에 ‘혹한+’을 3장 섞어 넣습니다.",
        "notes": [],
        "sourceLine": 113
      },
      "token": false,
      "implementationStatus": "reference-only"
    },
    {
      "name": "겨울의 뿔피리",
      "element": "ICE",
      "cost": 0,
      "text": "마나를 2 회복합니다.",
      "notes": [],
      "sourceLine": 120,
      "id": "general:겨울의 뿔피리",
      "upgrade": {
        "name": "겨울의 뿔피리+",
        "element": "ICE",
        "cost": 0,
        "text": "마나를 3 회복합니다.",
        "notes": [],
        "sourceLine": 122
      },
      "token": false,
      "implementationStatus": "reference-only"
    },
    {
      "name": "모사",
      "element": "ICE",
      "cost": 0,
      "text": "일회용. 내 손에 있는 가장 낮은 비용의 카드를 복사합니다.",
      "notes": [],
      "sourceLine": 125,
      "id": "general:모사",
      "upgrade": {
        "name": "모사+",
        "element": "ICE",
        "cost": 0,
        "text": "일회용. 내 손에 있는 가장 낮은 비용의 카드를 2장복사합니다.",
        "notes": [],
        "sourceLine": 127
      },
      "token": false,
      "implementationStatus": "reference-only"
    },
    {
      "name": "얼음 방패",
      "element": "ICE",
      "cost": 1,
      "text": "다음 턴의 엔드 페이즈시까지 내가 받는 피해를 막습니다. 전기 속성 카드에 의한 피해는 막을 수 없습니다.",
      "notes": [],
      "sourceLine": 129,
      "id": "general:얼음 방패",
      "upgrade": {
        "name": "얼음 방패+",
        "element": "ICE",
        "cost": 0,
        "text": "다음 턴의 엔드 페이즈시까지 내가 받는 피해를 막습니다. 전기 속성 카드에 의한 피해는 막을 수 없습니다.",
        "notes": [],
        "sourceLine": 131
      },
      "token": false,
      "implementationStatus": "reference-only"
    },
    {
      "name": "확고한 알리바이",
      "element": "ICE",
      "cost": 1,
      "text": "2턴 후의 엔드 페이즈시까지 내가 한 번에 받는 피해가 1로 고정됩니다.",
      "notes": [],
      "sourceLine": 134,
      "id": "general:확고한 알리바이",
      "upgrade": {
        "name": "확고한 알리바이+",
        "element": "ICE",
        "cost": 1,
        "text": "2턴 후의 엔드 페이즈시까지 내가 한 번에 받는 피해가 1로 고정됩니다.",
        "notes": [],
        "sourceLine": 136
      },
      "token": false,
      "implementationStatus": "reference-only"
    },
    {
      "name": "대 한파",
      "element": "ICE",
      "cost": 1,
      "text": "이 카드는 메인 페이즈 1에만 사용할 수 있습니다. 카드를 뽑고, 이번 턴의 엔드 페이즈시까지 서로 카드를 낼 수 없습니다.",
      "notes": [],
      "sourceLine": 139,
      "id": "general:대 한파",
      "upgrade": {
        "name": "대 한파+",
        "element": "ICE",
        "cost": 0,
        "text": "이 카드는 메인 페이즈 1에만 사용할 수 있습니다. 카드를 뽑고, 이번 턴의 엔드 페이즈시까지 서로 카드를 낼 수 없습니다.",
        "notes": [],
        "sourceLine": 141
      },
      "token": false,
      "implementationStatus": "reference-only"
    },
    {
      "name": "완전 빙결",
      "element": "ICE",
      "cost": 1,
      "text": "카드를 2장 뽑습니다. 그 카드들은 다음 턴부터 낼 수 있습니다.",
      "notes": [],
      "sourceLine": 144,
      "id": "general:완전 빙결",
      "upgrade": {
        "name": "완전 빙결+",
        "element": "ICE",
        "cost": 1,
        "text": "카드를 3장 뽑습니다. 그 카드들은 다음 턴부터 낼 수 있습니다.",
        "notes": [],
        "sourceLine": 146
      },
      "token": false,
      "implementationStatus": "reference-only"
    },
    {
      "name": "되감기",
      "element": "ICE",
      "cost": 1,
      "text": "상대에게 피해를 2 줍니다. 내 레스트에 있는 무작위 카드를 사용합니다.",
      "notes": [],
      "sourceLine": 149,
      "id": "general:되감기",
      "upgrade": {
        "name": "되감기+",
        "element": "ICE",
        "cost": 0,
        "text": "상대에게 피해를 4 줍니다. 내 레스트에 있는 무작위 카드를 사용합니다.",
        "notes": [
          "레스트에서 발동된 카드는 이 능력으로 발동된 후에도 레스트에 그대로 남아 있음"
        ],
        "sourceLine": 151
      },
      "token": false,
      "implementationStatus": "reference-only"
    },
    {
      "name": "급속 빙결",
      "element": "ICE",
      "cost": 1,
      "text": "압도. 상대에게 피해를 3 줍니다. 치명타: 다음 턴에 상대가 카드를 낼 수 없게 만듭니다.",
      "notes": [],
      "sourceLine": 156,
      "id": "flash_freeze",
      "upgrade": {
        "name": "급속 빙결+",
        "element": "ICE",
        "cost": 1,
        "text": "압도. 상대에게 피해를 5 줍니다. 치명타: 다음 턴의 엔드 페이즈시까지 상대가 카드를 낼 수 없게 만듭니다.",
        "notes": [],
        "sourceLine": 158
      },
      "token": false,
      "implementationStatus": "reference-only"
    },
    {
      "name": "얼음 덫",
      "element": "ICE",
      "cost": 1,
      "text": "속성을 선택합니다. 다음 턴에 상대가 처음으로 그 속성의 카드를 내면 카운터합니다.",
      "notes": [],
      "sourceLine": 161,
      "id": "general:얼음 덫",
      "upgrade": {
        "name": "얼음 덫+",
        "element": "ICE",
        "cost": 1,
        "text": "속성을 선택합니다. 다음 턴에 상대가 그 속성의 카드를 내면 카운터합니다.",
        "notes": [],
        "sourceLine": 163
      },
      "token": false,
      "implementationStatus": "reference-only"
    },
    {
      "name": "얼어붙은 버클러",
      "element": "ICE",
      "cost": 1,
      "text": "방어도를 10 얻습니다. 2턴 후의 스탠바이 페이즈시에 방어도를 10 잃습니다.",
      "notes": [],
      "sourceLine": 166,
      "id": "general:얼어붙은 버클러",
      "upgrade": {
        "name": "얼어붙은 버클러+",
        "element": "ICE",
        "cost": 1,
        "text": "방어도를 10 얻습니다. 3턴 후의 스탠바이 페이즈시에 방어도를 10 잃습니다.",
        "notes": [],
        "sourceLine": 168
      },
      "token": false,
      "implementationStatus": "reference-only"
    },
    {
      "name": "냉동 캡슐",
      "element": "ICE",
      "cost": 1,
      "text": "다음 턴의 엔드 페이즈시까지 받는 피해를 저장합니다. 다음 턴의 엔드 페이즈시에 상대에게 저장한 만큼의 피해를 줍니다.",
      "notes": [],
      "sourceLine": 171,
      "id": "general:냉동 캡슐",
      "upgrade": {
        "name": "냉동 캡슐+",
        "element": "ICE",
        "cost": 0,
        "text": "다음 턴의 엔드 페이즈시까지 받는 피해를 저장합니다. 다음 턴의 엔드 페이즈시에 상대에게 저장한 피해의 2배만 피해를 줍니다.",
        "notes": [],
        "sourceLine": 173
      },
      "token": false,
      "implementationStatus": "reference-only"
    },
    {
      "name": "서리 저주",
      "element": "ICE",
      "cost": 1,
      "text": "상대에게 ‘고드름’ 카드를 줍니다. 고드름 카드 양쪽에 있는 카드들의 비용이 (1) 증가합니다.",
      "notes": [],
      "sourceLine": 176,
      "id": "general:서리 저주",
      "upgrade": {
        "name": "서리 저주+",
        "element": "ICE",
        "cost": 1,
        "text": "상대에게 ‘고드름+’ 카드를 줍니다. 고드름 카드 양쪽에 있는 카드들의 비용이 (1) 증가합니다.",
        "notes": [],
        "sourceLine": 178
      },
      "token": false,
      "implementationStatus": "reference-only"
    },
    {
      "name": "동면",
      "element": "ICE",
      "cost": 1,
      "text": "상대의 손에서 카드를 발견합니다. 그 카드를 상대의 덱에 섞어 넣습니다.",
      "notes": [],
      "sourceLine": 186,
      "id": "general:동면",
      "upgrade": {
        "name": "동면+",
        "element": "ICE",
        "cost": 1,
        "text": "상대의 손에서 카드를 발견합니다. 그 카드를 상대의 레스트로 보냅니다.",
        "notes": [],
        "sourceLine": 188
      },
      "token": false,
      "implementationStatus": "reference-only"
    },
    {
      "name": "북부 항해",
      "element": "ICE",
      "cost": 1,
      "text": "내 덱에서 카드를 발견하여 내 손으로 가져옵니다. 냉기 카드면, 상대가 다음 턴에 냉기 카드만 낼 수 있게 만듭니다.",
      "notes": [],
      "sourceLine": 191,
      "id": "general:북부 항해",
      "upgrade": {
        "name": "북부 항해+",
        "element": "ICE",
        "cost": 1,
        "text": "내 덱에서 카드를 발견하여 내 손으로 가져옵니다. 냉기 카드면, 상대가 다음 턴의 엔드 페이즈시까지 냉기 카드만 낼 수 있게 만듭니다.",
        "notes": [],
        "sourceLine": 193
      },
      "token": false,
      "implementationStatus": "reference-only"
    },
    {
      "name": "얼음 거울",
      "element": "ICE",
      "cost": 1,
      "text": "상대에게 피해를 3 줍니다. 치명타: 그 카드 중 하나를 카운터하지 않고 되돌려줍니다.",
      "notes": [],
      "sourceLine": 196,
      "id": "general:얼음 거울",
      "upgrade": {
        "name": "얼음 거울+",
        "element": "ICE",
        "cost": 1,
        "text": "상대에게 피해를 5 줍니다. 치명타: 그 카드들을 모두 카운터하지 않고 되돌려줍니다.",
        "notes": [],
        "sourceLine": 198
      },
      "token": false,
      "implementationStatus": "reference-only"
    },
    {
      "name": "발굴",
      "element": "ICE",
      "cost": 1,
      "text": "내 레스트에서 카드를 발견하여 내 손으로 가져옵니다.",
      "notes": [],
      "sourceLine": 201,
      "id": "general:발굴",
      "upgrade": {
        "name": "발굴+",
        "element": "ICE",
        "cost": 1,
        "text": "내 레스트에서 카드를 2장 발견하여 내 손으로 가져옵니다.",
        "notes": [],
        "sourceLine": 203
      },
      "token": false,
      "implementationStatus": "reference-only"
    },
    {
      "name": "얼음 회오리",
      "element": "ICE",
      "cost": 2,
      "text": "일회용. 다음 턴에 상대는 아무런 카드도 낼 수 없습니다.",
      "notes": [],
      "sourceLine": 206,
      "id": "general:얼음 회오리",
      "upgrade": {
        "name": "얼음 회오리+",
        "element": "ICE",
        "cost": 2,
        "text": "일회용. 다음 턴의 엔드 페이즈시까지 상대는 아무런 카드도 낼 수 없습니다.",
        "notes": [],
        "sourceLine": 208
      },
      "token": false,
      "implementationStatus": "reference-only"
    },
    {
      "name": "심해 저주",
      "element": "ICE",
      "cost": 1,
      "text": "상대에게 ‘저주’ 카드를 줍니다. 저주 카드는 매 턴 엔드 페이즈시 보유자에게 피해를 3 줍니다.",
      "notes": [],
      "sourceLine": 211,
      "id": "general:심해 저주",
      "upgrade": {
        "name": "심해 저주+",
        "element": "ICE",
        "cost": 1,
        "text": "상대에게 ‘저주+’ 카드를 줍니다. 저주+ 카드는 매 턴 엔드 페이즈시 보유자에게 피해를 5 줍니다.",
        "notes": [
          "저주 카드는 상대의 손패에 추가되고, 아래와 같음. 🌊 속성은 토큰 전용 무속성으로 상성관계가 없음."
        ],
        "sourceLine": 213
      },
      "token": false,
      "implementationStatus": "reference-only"
    },
    {
      "name": "칼바람",
      "element": "ICE",
      "cost": 2,
      "text": "다음 2턴 동안 상대 카드의 비용이 1 증가합니다.",
      "notes": [],
      "sourceLine": 221,
      "id": "general:칼바람",
      "upgrade": {
        "name": "칼바람+",
        "element": "ICE",
        "cost": 2,
        "text": "2턴 후의 엔드 페이즈시까지 상대 카드의 비용이 1 증가합니다. .",
        "notes": [],
        "sourceLine": 223
      },
      "token": false,
      "implementationStatus": "reference-only"
    },
    {
      "name": "번개 개화",
      "element": "NATURE",
      "cost": 0,
      "text": "과부하: (2). 이번 턴에만 마나를 2 얻습니다.",
      "notes": [],
      "sourceLine": 235,
      "id": "general:번개 개화",
      "upgrade": {
        "name": "번개 개화+",
        "element": "NATURE",
        "cost": 0,
        "text": "과부하: (1). 이번 턴에만 마나를 2 얻습니다.",
        "notes": [],
        "sourceLine": 237
      },
      "token": false,
      "implementationStatus": "reference-only"
    },
    {
      "name": "수중 동물 변신",
      "element": "NATURE",
      "cost": 0,
      "text": "내 덱 맨 밑에 있는 카드 3장을 미리 봅니다. 1장을 선택해 덱 맨 위에 놓습니다. 이번 턴에 그 카드를 낼 마나가 있다면, 그 카드를 뽑습니다.",
      "notes": [],
      "sourceLine": 240,
      "id": "aquatic_form",
      "upgrade": {
        "name": "수중 동물 변신+",
        "element": "NATURE",
        "cost": 0,
        "text": "선천성, 내 덱 맨 밑에 있는 카드 3장을 미리 봅니다. 1장을 선택해 덱 맨 위에 놓습니다. 이번 턴에 그 카드를 낼 마나가 있다면, 그 카드를 뽑습니다.",
        "notes": [],
        "sourceLine": 242
      },
      "token": false,
      "implementationStatus": "reference-only"
    },
    {
      "name": "살아 움직이는 숲",
      "element": "NATURE",
      "cost": 1,
      "text": "3턴 후의 엔드 페이즈시까지 내 카드들은 카운터당하는 대신 피해를 3 받고, 상대 카드를 카운터할 때마다 상대에게 피해를 3 줍니다.",
      "notes": [],
      "sourceLine": 245,
      "id": "general:살아 움직이는 숲",
      "upgrade": {
        "name": "살아 움직이는 숲+",
        "element": "NATURE",
        "cost": 1,
        "text": "3턴 후의 엔드 페이즈시까지 내 카드들은 카운터당하는 대신 피해를 2 받고, 상대 카드를 카운터할 때마다 상대에게 피해를 4 줍니다.",
        "notes": [],
        "sourceLine": 247
      },
      "token": false,
      "implementationStatus": "reference-only"
    },
    {
      "name": "초고속",
      "element": "NATURE",
      "cost": 1,
      "text": "카드를 뽑습니다. 다음 턴에, 상대가 무슨 카드를 사용할 지 알 수 있습니다.",
      "notes": [],
      "sourceLine": 250,
      "id": "foresight",
      "upgrade": {
        "name": "초고속+",
        "element": "NATURE",
        "cost": 1,
        "text": "카드를 2장 뽑습니다. 다음 턴에, 상대가 무슨 카드를 사용할 지 알 수 있습니다.",
        "notes": [
          "다음 턴에, 카드를 내는 두 페이즈 동안 모두 상대가 무슨 카드를 사용할 지 알 수 있음. 봇이 이 카드를 사용하면 다음 턴의 카드를 내는 두 페이즈 동안 플레이어가 내는 카드를 본 뒤 봇이 낼 카드를 결정함."
        ],
        "sourceLine": 252
      },
      "token": false,
      "implementationStatus": "reference-only"
    },
    {
      "name": "재생",
      "element": "NATURE",
      "cost": 1,
      "text": "체력을 3 회복합니다. 다음 턴의 스탠바이 페이즈시에 체력을 3 회복합니다.",
      "notes": [],
      "sourceLine": 256,
      "id": "general:재생",
      "upgrade": {
        "name": "재생+",
        "element": "NATURE",
        "cost": 1,
        "text": "체력을 5 회복합니다. 다음 턴의 스탠바이 페이즈시에 체력을 5 회복합니다.",
        "notes": [],
        "sourceLine": 258
      },
      "token": false,
      "implementationStatus": "reference-only"
    },
    {
      "name": "이슬 절차",
      "element": "NATURE",
      "cost": 1,
      "text": "게임이 끝날 때까지 서로는 스탠바이 페이즈시마다 카드를 1장 더 뽑습니다.",
      "notes": [],
      "sourceLine": 261,
      "id": "general:이슬 절차",
      "upgrade": {
        "name": "이슬 절차+",
        "element": "NATURE",
        "cost": 0,
        "text": "게임이 끝날 때까지 서로는 스탠바이 페이즈시마다 카드를 1장 더 뽑습니다.",
        "notes": [],
        "sourceLine": 263
      },
      "token": false,
      "implementationStatus": "reference-only"
    },
    {
      "name": "광합성",
      "element": "NATURE",
      "cost": 1,
      "text": "카드를 2장 뽑습니다.",
      "notes": [],
      "sourceLine": 266,
      "id": "general:광합성",
      "upgrade": {
        "name": "광합성+",
        "element": "NATURE",
        "cost": 1,
        "text": "카드를 3장 뽑습니다.",
        "notes": [],
        "sourceLine": 268
      },
      "token": false,
      "implementationStatus": "reference-only"
    },
    {
      "name": "산사태",
      "element": "NATURE",
      "cost": 1,
      "text": "상대에게 피해를 4 줍니다. 내 손에 비용이 (2) 이상인 카드가 있으면, 비용이 (2) 이상인 카드를 뽑습니다.",
      "notes": [],
      "sourceLine": 271,
      "id": "general:산사태",
      "upgrade": {
        "name": "산사태+",
        "element": "NATURE",
        "cost": 1,
        "text": "상대에게 피해를 8 줍니다. 내 손에 비용이 (2) 이상인 카드가 있으면, 비용이 (2) 이상인 카드를 뽑습니다.",
        "notes": [],
        "sourceLine": 273
      },
      "token": false,
      "implementationStatus": "reference-only"
    },
    {
      "name": "등산용 간식",
      "element": "NATURE",
      "cost": 1,
      "text": "다음 턴의 스탠바이 페이즈시에, 일시적인 마나를 1 얻습니다.",
      "notes": [],
      "sourceLine": 276,
      "id": "general:등산용 간식",
      "upgrade": {
        "name": "등산용 간식+",
        "element": "NATURE",
        "cost": 1,
        "text": "다음 두 턴의 스탠바이 페이즈시에, 일시적인 마나를 1 얻습니다.",
        "notes": [],
        "sourceLine": 278
      },
      "token": false,
      "implementationStatus": "reference-only"
    },
    {
      "name": "왕성한 진균",
      "element": "NATURE",
      "cost": 1,
      "text": "카드를 3장 뽑습니다. 화염 카드를 뽑으면, 그 카드를 버립니다.",
      "notes": [],
      "sourceLine": 281,
      "id": "general:왕성한 진균",
      "upgrade": {
        "name": "왕성한 진균+",
        "element": "NATURE",
        "cost": 0,
        "text": "카드를 3장 뽑습니다. 화염 카드를 뽑으면, 그 카드를 버립니다.",
        "notes": [],
        "sourceLine": 283
      },
      "token": false,
      "implementationStatus": "reference-only"
    },
    {
      "name": "흡수",
      "element": "NATURE",
      "cost": 1,
      "text": "상대에게 피해를 4 줍니다. 치명타: 카운터한 카드 중 하나를 가져옵니다.",
      "notes": [],
      "sourceLine": 286,
      "id": "general:흡수",
      "upgrade": {
        "name": "흡수+",
        "element": "NATURE",
        "cost": 1,
        "text": "상대에게 피해를 6 줍니다. 치명타: 카운터한 카드들을 모두 가져옵니다.",
        "notes": [
          "기본은 카운터된 무작위 카드 1장, 강화는 카운터된 모든 카드를 내 손으로 가져옵니다."
        ],
        "sourceLine": 288
      },
      "token": false,
      "implementationStatus": "reference-only"
    },
    {
      "name": "급속 성장",
      "element": "NATURE",
      "cost": 2,
      "text": "일회용. 내 최대 마나가 1 증가합니다.",
      "notes": [],
      "sourceLine": 292,
      "id": "wild_growth",
      "upgrade": {
        "name": "급속 성장+",
        "element": "NATURE",
        "cost": 2,
        "text": "선천성, 일회용. 내 최대 마나가 1 증가합니다.",
        "notes": [
          "넘치는마나: 최대 마나가 이미 5면 획득하는 토큰"
        ],
        "sourceLine": 294
      },
      "token": false,
      "implementationStatus": "reference-only"
    },
    {
      "name": "치유의 손길",
      "element": "NATURE",
      "cost": 2,
      "text": "체력을 10 회복합니다.",
      "notes": [],
      "sourceLine": 302,
      "id": "healing_touch",
      "upgrade": {
        "name": "치유의 손길+",
        "element": "NATURE",
        "cost": 2,
        "text": "체력을 15 회복합니다.",
        "notes": [],
        "sourceLine": 304
      },
      "token": false,
      "implementationStatus": "reference-only"
    },
    {
      "name": "먹음직스러운 덥석멜론",
      "element": "NATURE",
      "cost": 1,
      "text": "비용이 2, 3, 4, 5인 카드를 뽑습니다.",
      "notes": [],
      "sourceLine": 307,
      "id": "general:먹음직스러운 덥석멜론",
      "upgrade": {
        "name": "먹음직스러운 덥석멜론+",
        "element": "NATURE",
        "cost": 0,
        "text": "비용이 2, 3, 4, 5인 카드를 뽑습니다.",
        "notes": [],
        "sourceLine": 309
      },
      "token": false,
      "implementationStatus": "reference-only"
    },
    {
      "name": "풍요",
      "element": "NATURE",
      "cost": 2,
      "text": "체력을 7 회복합니다. 카드를 2장 뽑습니다.",
      "notes": [],
      "sourceLine": 312,
      "id": "general:풍요",
      "upgrade": {
        "name": "풍요+",
        "element": "NATURE",
        "cost": 2,
        "text": "체력을 14 회복합니다. 카드를 2장 뽑습니다.",
        "notes": [],
        "sourceLine": 314
      },
      "token": false,
      "implementationStatus": "reference-only"
    },
    {
      "name": "굽이치는 파도",
      "element": "NATURE",
      "cost": 2,
      "text": "상대에게 피해를 5 줍니다. 준 피해만큼 체력을 회복합니다.",
      "notes": [],
      "sourceLine": 317,
      "id": "general:굽이치는 파도",
      "upgrade": {
        "name": "굽이치는 파도+",
        "element": "NATURE",
        "cost": 2,
        "text": "상대에게 피해를 8 줍니다. 준 피해만큼 체력을 회복합니다.",
        "notes": [],
        "sourceLine": 319
      },
      "token": false,
      "implementationStatus": "reference-only"
    },
    {
      "name": "기적같은 성장",
      "element": "NATURE",
      "cost": 3,
      "text": "내 손이 가득 찰 때까지 카드를 뽑습니다. 그 카드들의 비용의 합만큼 체력을 회복합니다.",
      "notes": [],
      "sourceLine": 322,
      "id": "general:기적같은 성장",
      "upgrade": {
        "name": "기적같은 성장+",
        "element": "NATURE",
        "cost": 3,
        "text": "내 손이 가득 찰 때까지 카드를 뽑습니다. 그 카드들의 비용의 합의 2배만큼 체력을 회복합니다.",
        "notes": [],
        "sourceLine": 324
      },
      "token": false,
      "implementationStatus": "reference-only"
    },
    {
      "name": "자연화",
      "element": "NATURE",
      "cost": 3,
      "text": "상대가 낸 카드들을 모두 카운터합니다. 상대가 카드를 2장 뽑습니다.",
      "notes": [],
      "sourceLine": 327,
      "id": "general:자연화",
      "upgrade": {
        "name": "자연화+",
        "element": "NATURE",
        "cost": 3,
        "text": "상대가 낸 카드들을 모두 카운터합니다. 상대가 카드를 1장 뽑습니다.",
        "notes": [],
        "sourceLine": 329
      },
      "token": false,
      "implementationStatus": "reference-only"
    },
    {
      "name": "폭풍 인도기",
      "element": "NATURE",
      "cost": 4,
      "text": "내 덱에서 강화되지 않은 모든 카드를 무작위 강화된 카드로 교체합니다. 그 카드들의 비용이 (1) 감소합니다. 단, 1보다 낮아지진 않습니다.",
      "notes": [],
      "sourceLine": 332,
      "id": "general:폭풍 인도기",
      "upgrade": {
        "name": "폭풍 인도기+",
        "element": "NATURE",
        "cost": 4,
        "text": "내 덱에서 강화되지 않은 모든 카드를 무작위 강화된 카드로 교체합니다. 그 카드들의 비용이 (2) 감소합니다. 단, 1보다 낮아지진 않습니다.",
        "notes": [],
        "sourceLine": 334
      },
      "token": false,
      "implementationStatus": "reference-only"
    },
    {
      "name": "접붙이기",
      "element": "NATURE",
      "cost": 5,
      "text": "상대의 레스트에 있는 모든 카드를 게임에서 제외합니다. 그 카드들의 비용의 합의 절반만큼 체력을 회복합니다.",
      "notes": [],
      "sourceLine": 338,
      "id": "general:접붙이기",
      "upgrade": {
        "name": "접붙이기+",
        "element": "NATURE",
        "cost": 5,
        "text": "상대의 레스트에 있는 모든 카드를 게임에서 제외합니다. 그 카드들의 비용의 합만큼 체력을 회복합니다.",
        "notes": [
          "비용의 합이 홀수일 경우 내림"
        ],
        "sourceLine": 340
      },
      "token": false,
      "implementationStatus": "reference-only"
    },
    {
      "name": "찌릿!",
      "element": "LIGHTNING",
      "cost": 0,
      "text": "상대에게 피해를 3 줍니다. 내 손에 다른 전기 카드가 있으면, 전기 카드를 뽑습니다.",
      "notes": [],
      "sourceLine": 346,
      "id": "general:찌릿!",
      "upgrade": {
        "name": "찌릿!+",
        "element": "LIGHTNING",
        "cost": 0,
        "text": "상대에게 피해를 5 줍니다. 내 손에 다른 전기 카드가 있으면, 전기 카드를 뽑습니다.",
        "notes": [],
        "sourceLine": 348
      },
      "token": false,
      "implementationStatus": "reference-only"
    },
    {
      "name": "선조의 지혜",
      "element": "LIGHTNING",
      "cost": 0,
      "text": "과부하: (1). 카드를 2장 뽑습니다.",
      "notes": [],
      "sourceLine": 351,
      "id": "ancestral_knowledge",
      "upgrade": {
        "name": "선조의 지혜+",
        "element": "LIGHTNING",
        "cost": 0,
        "text": "과부하: (1). 카드를 3장 뽑습니다.",
        "notes": [],
        "sourceLine": 353
      },
      "token": false,
      "implementationStatus": "reference-only"
    },
    {
      "name": "부스터 팩",
      "element": "LIGHTNING",
      "cost": 0,
      "text": "일회용. 무작위 카드 3장을 내 손으로 가져옵니다. (강화된 카드 최소 1장 보장!)",
      "notes": [],
      "sourceLine": 356,
      "id": "general:부스터 팩",
      "upgrade": {
        "name": "부스터 팩+",
        "element": "LIGHTNING",
        "cost": 0,
        "text": "일회용. 강화된 무작위 카드 3장을 내 손으로 가져옵니다.",
        "notes": [],
        "sourceLine": 358
      },
      "token": false,
      "implementationStatus": "reference-only"
    },
    {
      "name": "초과 인출",
      "element": "LIGHTNING",
      "cost": 0,
      "text": "과부하된 내 마나를 모두 잠금 해제하고 그만큼 카드를 뽑습니다.",
      "notes": [],
      "sourceLine": 361,
      "id": "general:초과 인출",
      "upgrade": {
        "name": "초과 인출+",
        "element": "LIGHTNING",
        "cost": 0,
        "text": "선천성. 과부하된 내 마나를 모두 잠금 해제하고 그만큼 카드를 뽑습니다.",
        "notes": [],
        "sourceLine": 363
      },
      "token": false,
      "implementationStatus": "reference-only"
    },
    {
      "name": "전선",
      "element": "LIGHTNING",
      "cost": 0,
      "text": "발견 카드를 발견하여 내 손으로 가져옵니다.",
      "notes": [],
      "sourceLine": 367,
      "id": "general:전선",
      "upgrade": {
        "name": "전선+",
        "element": "LIGHTNING",
        "cost": 0,
        "text": "발견 카드를 발견하여 냅니다.",
        "notes": [],
        "sourceLine": 369
      },
      "token": false,
      "implementationStatus": "reference-only"
    },
    {
      "name": "믹스테이프",
      "element": "LIGHTNING",
      "cost": 1,
      "text": "상대의 덱에서 카드를 발견하여 내 손으로 복사해옵니다.",
      "notes": [],
      "sourceLine": 373,
      "id": "general:믹스테이프",
      "upgrade": {
        "name": "믹스테이프+",
        "element": "LIGHTNING",
        "cost": 1,
        "text": "상대의 덱에서 카드를 발견하여 내 손으로 복사해옵니다. 그 카드의 비용이 (1) 감소합니다.",
        "notes": [],
        "sourceLine": 375
      },
      "token": false,
      "implementationStatus": "reference-only"
    },
    {
      "name": "전류 공급",
      "element": "LIGHTNING",
      "cost": 1,
      "text": "카드를 뽑고 전류 중첩을 획득합니다. 전류 중첩이 2에 도달하면 이번 게임에서 내 전기 카드의 피해량이 2 증가합니다.",
      "notes": [],
      "sourceLine": 378,
      "id": "general:전류 공급",
      "upgrade": {
        "name": "전류 공급+",
        "element": "LIGHTNING",
        "cost": 0,
        "text": "카드를 뽑고 전류 중첩을 획득합니다. 전류 중첩이 2에 도달하면 이번 게임에서 내 전기 카드의 피해량이 2 증가합니다.",
        "notes": [],
        "sourceLine": 380
      },
      "token": false,
      "implementationStatus": "reference-only"
    },
    {
      "name": "긴급 차단",
      "element": "LIGHTNING",
      "cost": 1,
      "text": "상대의 손에서 카드를 발견하여 내 손으로 복사해옵니다. 그 카드를 내면, 상대의 손에 있는 원래 카드를 레스트로 보냅니다.",
      "notes": [],
      "sourceLine": 383,
      "id": "general:긴급 차단",
      "upgrade": {
        "name": "긴급 차단+",
        "element": "LIGHTNING",
        "cost": 0,
        "text": "상대의 손에서 카드를 발견하여 내 손으로 복사해옵니다. 그 카드를 내면, 상대의 손에 있는 원래 카드를 내 손으로 가져옵니다.",
        "notes": [],
        "sourceLine": 385
      },
      "token": false,
      "implementationStatus": "reference-only"
    },
    {
      "name": "천둥",
      "element": "LIGHTNING",
      "cost": 1,
      "text": "다음 3턴의 스탠바이 페이즈시마다 상대에게 피해를 2 줍니다.",
      "notes": [],
      "sourceLine": 388,
      "id": "thunder",
      "upgrade": {
        "name": "천둥+",
        "element": "LIGHTNING",
        "cost": 1,
        "text": "다음 3턴의 스탠바이 페이즈시마다 상대에게 피해를 4 줍니다.",
        "notes": [],
        "sourceLine": 390
      },
      "token": false,
      "implementationStatus": "reference-only"
    },
    {
      "name": "파지직",
      "element": "LIGHTNING",
      "cost": 1,
      "text": "과부하: (1). 상대에게 피해를 7-9 줍니다.",
      "notes": [],
      "sourceLine": 393,
      "id": "crackle",
      "upgrade": {
        "name": "파지직+",
        "element": "LIGHTNING",
        "cost": 1,
        "text": "과부하: (1). 상대에게 피해를 14-18 줍니다.",
        "notes": [],
        "sourceLine": 395
      },
      "token": false,
      "implementationStatus": "reference-only"
    },
    {
      "name": "마비",
      "element": "LIGHTNING",
      "cost": 1,
      "text": "이번 턴에 상대가 사용한 속성의 카드를 3턴 후의 엔드 페이즈시까지 낼 수 없게 합니다.",
      "notes": [],
      "sourceLine": 398,
      "id": "general:마비",
      "upgrade": {
        "name": "마비+",
        "element": "LIGHTNING",
        "cost": 1,
        "text": "압도. 이번 턴에 상대가 사용한 속성의 카드를 3턴 후의 엔드 페이즈시까지 낼 수 없게 합니다.",
        "notes": [],
        "sourceLine": 400
      },
      "token": false,
      "implementationStatus": "reference-only"
    },
    {
      "name": "단락",
      "element": "LIGHTNING",
      "cost": 1,
      "text": "내 덱에서 카드를 발견해 게임에서 제외합니다. 그 카드의 비용만큼 카드를 뽑습니다.",
      "notes": [],
      "sourceLine": 403,
      "id": "general:단락",
      "upgrade": {
        "name": "단락+",
        "element": "LIGHTNING",
        "cost": 0,
        "text": "내 덱에서 카드를 발견해 게임에서 제외합니다. 그 카드의 비용만큼 카드를 뽑습니다.",
        "notes": [],
        "sourceLine": 405
      },
      "token": false,
      "implementationStatus": "reference-only"
    },
    {
      "name": "무덤의 지명자",
      "element": "LIGHTNING",
      "cost": 1,
      "text": "상대의 레스트에서 카드를 발견해 게임에서 제외합니다.",
      "notes": [],
      "sourceLine": 408,
      "id": "general:무덤의 지명자",
      "upgrade": {
        "name": "무덤의 지명자+",
        "element": "LIGHTNING",
        "cost": 1,
        "text": "상대의 레스트에서 카드를 발견해 내 손으로 가져옵니다.",
        "notes": [],
        "sourceLine": 410
      },
      "token": false,
      "implementationStatus": "reference-only"
    },
    {
      "name": "충전",
      "element": "LIGHTNING",
      "cost": 1,
      "text": "다음 턴에 내 강화되지 않은 모든 카드가 강화됩니다.",
      "notes": [],
      "sourceLine": 413,
      "id": "general:충전",
      "upgrade": {
        "name": "충전+",
        "element": "LIGHTNING",
        "cost": 0,
        "text": "다음 턴에 내 강화되지 않은 모든 카드가 강화됩니다.",
        "notes": [],
        "sourceLine": 415
      },
      "token": false,
      "implementationStatus": "reference-only"
    },
    {
      "name": "번개",
      "element": "LIGHTNING",
      "cost": 2,
      "text": "다음 턴에 상대가 카드를 낼 수 없게 만듭니다. 다음 턴에 상대가 받는 모든 피해가 0이 됩니다.",
      "notes": [],
      "sourceLine": 418,
      "id": "general:번개",
      "upgrade": {
        "name": "번개+",
        "element": "LIGHTNING",
        "cost": 2,
        "text": "다음 턴의 엔드 페이즈시까지 상대가 카드를 낼 수 없게 만듭니다. 다음 턴에 상대가 받는 모든 피해가 0이 됩니다.",
        "notes": [],
        "sourceLine": 420
      },
      "token": false,
      "implementationStatus": "reference-only"
    },
    {
      "name": "연쇄 번개",
      "element": "LIGHTNING",
      "cost": 2,
      "text": "상대에게 피해를 5 줍니다. 내가 연속으로 전기 카드를 낸 턴만큼 반복합니다. 내가 전기 카드를 연속으로 3턴 냈다면, 이 카드는 카운터당하지 않습니다.",
      "notes": [],
      "sourceLine": 423,
      "id": "general:연쇄 번개",
      "upgrade": {
        "name": "연쇄 번개+",
        "element": "LIGHTNING",
        "cost": 2,
        "text": "카드를 뽑고 상대에게 피해를 5 줍니다. 내가 연속으로 전기 카드를 낸 턴만큼 반복합니다. 내가 전기 카드를 연속으로 3턴 냈다면, 이 카드는 카운터당하지 않습니다.",
        "notes": [],
        "sourceLine": 425
      },
      "token": false,
      "implementationStatus": "reference-only"
    },
    {
      "name": "마법공학: 퓨즈",
      "element": "LIGHTNING",
      "cost": 3,
      "text": "사용불가. 이 카드가 내 손에 있으면, 상대가 한 턴에 카드를 1장보다 초과하여 뽑았을 때 발동합니다. 이 카드와 초과된 상대 카드들을 레스트로 보냅니다.",
      "notes": [],
      "sourceLine": 428,
      "id": "general:마법공학: 퓨즈",
      "upgrade": {
        "name": "마법공학: 퓨즈+",
        "element": "LIGHTNING",
        "cost": 3,
        "text": "사용불가. 이 카드가 내 손에 있으면, 상대가 한 턴에 카드를 1장보다 초과하여 뽑았을 때 발동합니다. 이 카드와 초과된 상대 카드들을 레스트로 보냅니다. 이번 턴의 엔드 페이즈시까지 상대가 카드를 뽑을 때마다 레스트로 보냅니다.",
        "notes": [],
        "sourceLine": 430
      },
      "token": false,
      "implementationStatus": "reference-only"
    },
    {
      "name": "마법공학: 니비루",
      "element": "LIGHTNING",
      "cost": 3,
      "text": "사용불가. 이 카드가 내 손에 있으면, 상대가 한 턴에 카드를 3장 이상 냈을 때 발동합니다. 이 카드를 레스트로 보내고, 그 카드를 카운터합니다.",
      "notes": [],
      "sourceLine": 433,
      "id": "general:마법공학: 니비루",
      "upgrade": {
        "name": "마법공학: 니비루+",
        "element": "LIGHTNING",
        "cost": 3,
        "text": "사용불가. 이 카드가 내 손에 있으면, 상대가 한 턴에 카드를 3장 이상 냈을 때 발동합니다. 이 카드를 레스트로 보내고, 그 카드를 카운터합니다. 이번 턴의 엔드 페이즈시까지 상대가 카드를 낼 때마다 카운터합니다.",
        "notes": [],
        "sourceLine": 435
      },
      "token": false,
      "implementationStatus": "reference-only"
    },
    {
      "name": "고철 더미에서",
      "element": "LIGHTNING",
      "cost": 3,
      "text": "내가 이전 턴에 전기 카드를 사용했으면, 하급 보물을 발견하여 내 손으로 가져오고 탐험 덱에 추가합니다.",
      "notes": [],
      "sourceLine": 438,
      "id": "general:고철 더미에서",
      "upgrade": {
        "name": "고철 더미에서+",
        "element": "LIGHTNING",
        "cost": 3,
        "text": "내가 이전 턴에 전기 카드를 사용했으면, 상급 보물을 발견하여 내 손으로 가져오고 탐험 덱에 추가합니다.",
        "notes": [],
        "sourceLine": 440
      },
      "token": false,
      "implementationStatus": "reference-only"
    },
    {
      "name": "두꺼비집",
      "element": "LIGHTNING",
      "cost": 2,
      "text": "다음 턴에 상대가 내는 모든 카드의 속성이 전기 카드로 취급됩니다.",
      "notes": [],
      "sourceLine": 443,
      "id": "general:두꺼비집",
      "upgrade": {
        "name": "두꺼비집+",
        "element": "LIGHTNING",
        "cost": 2,
        "text": "다음 턴의 엔드 페이즈시까지 상대가 내는 모든 카드의 속성이 전기 카드로 취급됩니다.",
        "notes": [],
        "sourceLine": 445
      },
      "token": false,
      "implementationStatus": "reference-only"
    },
    {
      "name": "기도",
      "element": "HOLY",
      "cost": 0,
      "text": "일회용. 신성 카드를 발견하여 내 손으로 가져오고 탐험 덱에 추가합니다.",
      "notes": [],
      "sourceLine": 455,
      "id": "general:기도",
      "upgrade": {
        "name": "기도+",
        "element": "HOLY",
        "cost": 0,
        "text": "일회용. 신성 카드를 2장 발견하여 내 손으로 가져오고 탐험 덱에 추가합니다.",
        "notes": [],
        "sourceLine": 457
      },
      "token": false,
      "implementationStatus": "reference-only"
    },
    {
      "name": "윤회",
      "element": "HOLY",
      "cost": 0,
      "text": "카드를 뽑습니다. 내 덱에서 카드를 2장 발견해 레스트로 보냅니다.",
      "notes": [],
      "sourceLine": 460,
      "id": "general:윤회",
      "upgrade": {
        "name": "윤회+",
        "element": "HOLY",
        "cost": 0,
        "text": "카드를 2장 뽑습니다. 내 덱에서 카드를 2장 발견해 레스트로 보냅니다.",
        "notes": [],
        "sourceLine": 462
      },
      "token": false,
      "implementationStatus": "reference-only"
    },
    {
      "name": "운명",
      "element": "HOLY",
      "cost": 1,
      "text": "강화된 무작위 카드를 사용합니다.",
      "notes": [],
      "sourceLine": 465,
      "id": "general:운명",
      "upgrade": {
        "name": "운명+",
        "element": "HOLY",
        "cost": 0,
        "text": "강화된 무작위 카드를 사용합니다.",
        "notes": [],
        "sourceLine": 467
      },
      "token": false,
      "implementationStatus": "reference-only"
    },
    {
      "name": "예지",
      "element": "HOLY",
      "cost": 0,
      "text": "내 덱에서 비용이 3인 카드를 뽑습니다.",
      "notes": [],
      "sourceLine": 470,
      "id": "general:예지",
      "upgrade": {
        "name": "예지+",
        "element": "HOLY",
        "cost": 0,
        "text": "내 덱에서 비용이 3인 카드를 발견하여 뽑습니다.",
        "notes": [],
        "sourceLine": 472
      },
      "token": false,
      "implementationStatus": "reference-only"
    },
    {
      "name": "안도",
      "element": "HOLY",
      "cost": 0,
      "text": "이전 턴에 내가 피해를 입지 않았으면, 카드를 뽑고 체력을 4 회복합니다.",
      "notes": [],
      "sourceLine": 475,
      "id": "general:안도",
      "upgrade": {
        "name": "안도+",
        "element": "HOLY",
        "cost": 0,
        "text": "이전 턴에 내가 피해를 입지 않았으면, 카드를 2장 뽑고 체력을 4 회복합니다.",
        "notes": [],
        "sourceLine": 477
      },
      "token": false,
      "implementationStatus": "reference-only"
    },
    {
      "name": "심판",
      "element": "HOLY",
      "cost": 1,
      "text": "내 레스트에 있는 신성 카드의 수의 2배만큼 상대에게 피해를 줍니다.",
      "notes": [],
      "sourceLine": 480,
      "id": "general:심판",
      "upgrade": {
        "name": "심판+",
        "element": "HOLY",
        "cost": 1,
        "text": "내 레스트에 있는 신성 카드의 수의 3배만큼 상대에게 피해를 줍니다.",
        "notes": [],
        "sourceLine": 482
      },
      "token": false,
      "implementationStatus": "reference-only"
    },
    {
      "name": "계시",
      "element": "HOLY",
      "cost": 1,
      "text": "상대의 손에서 카드를 발견합니다. 다음 턴에 상대가 그 카드를 내면 카운터하고 카드를 2장 뽑습니다.",
      "notes": [],
      "sourceLine": 485,
      "id": "general:계시",
      "upgrade": {
        "name": "계시+",
        "element": "HOLY",
        "cost": 1,
        "text": "상대의 손에서 카드를 발견합니다. 다음 턴의 엔드 페이즈시까지 상대가 그 카드를 내면 카운터하고 카드를 2장 뽑습니다.",
        "notes": [],
        "sourceLine": 487
      },
      "token": false,
      "implementationStatus": "reference-only"
    },
    {
      "name": "배교",
      "element": "HOLY",
      "cost": 1,
      "text": "압도. 상대에게 피해를 3 줍니다. 치명타: 대신 피해를 6 줍니다.",
      "notes": [],
      "sourceLine": 490,
      "id": "general:배교",
      "upgrade": {
        "name": "배교+",
        "element": "HOLY",
        "cost": 1,
        "text": "압도. 상대에게 피해를 6 줍니다. 치명타: 대신 피해를 12 줍니다.",
        "notes": [],
        "sourceLine": 492
      },
      "token": false,
      "implementationStatus": "reference-only"
    },
    {
      "name": "황금궤",
      "element": "HOLY",
      "cost": 1,
      "text": "강화된 카드를 발견합니다. 3턴 후의 스탠바이 페이즈시에 그 카드를 내 손으로 가져옵니다.",
      "notes": [],
      "sourceLine": 495,
      "id": "general:황금궤",
      "upgrade": {
        "name": "황금궤+",
        "element": "HOLY",
        "cost": 1,
        "text": "강화된 카드를 발견합니다. 다음 턴의 스탠바이 페이즈시에 그 카드를 내 손으로 가져옵니다.",
        "notes": [],
        "sourceLine": 497
      },
      "token": false,
      "implementationStatus": "reference-only"
    },
    {
      "name": "필연",
      "element": "HOLY",
      "cost": 1,
      "text": "무작위 카드를 2장 사용합니다.",
      "notes": [],
      "sourceLine": 500,
      "id": "general:필연",
      "upgrade": {
        "name": "필연+",
        "element": "HOLY",
        "cost": 1,
        "text": "무작위 카드를 3장 사용합니다.",
        "notes": [],
        "sourceLine": 502
      },
      "token": false,
      "implementationStatus": "reference-only"
    },
    {
      "name": "불굴",
      "element": "HOLY",
      "cost": 1,
      "text": "이번 턴의 엔드 페이즈시까지 내가 상대 카드로 피해를 받지 않습니다.",
      "notes": [],
      "sourceLine": 505,
      "id": "general:불굴",
      "upgrade": {
        "name": "불굴+",
        "element": "HOLY",
        "cost": 1,
        "text": "이번 턴의 엔드 페이즈시까지 내가 피해를 받지 않습니다.",
        "notes": [],
        "sourceLine": 507
      },
      "token": false,
      "implementationStatus": "reference-only"
    },
    {
      "name": "성전",
      "element": "HOLY",
      "cost": 2,
      "text": "카드를 뽑습니다. 다음 턴의 엔드 페이즈시까지 서로는 신성 카드만 낼 수 있습니다.",
      "notes": [],
      "sourceLine": 510,
      "id": "general:성전",
      "upgrade": {
        "name": "성전+",
        "element": "HOLY",
        "cost": 2,
        "text": "카드를 뽑습니다. 2턴 후의 엔드 페이즈시까지 서로는 신성 카드만 낼 수 있습니다.",
        "notes": [],
        "sourceLine": 512
      },
      "token": false,
      "implementationStatus": "reference-only"
    },
    {
      "name": "성지순례",
      "element": "HOLY",
      "cost": 1,
      "text": "이번 게임 동안 매 턴의 엔드 페이즈시마다 상대에게 피해를 1 줍니다.",
      "notes": [],
      "sourceLine": 515,
      "id": "general:성지순례",
      "upgrade": {
        "name": "성지순례+",
        "element": "HOLY",
        "cost": 1,
        "text": "선천성. 이번 게임 동안 매 턴의 엔드 페이즈시마다 상대에게 피해를 2 줍니다.",
        "notes": [],
        "sourceLine": 517
      },
      "token": false,
      "implementationStatus": "reference-only"
    },
    {
      "name": "축성",
      "element": "HOLY",
      "cost": 1,
      "text": "내 레스트에 있는 무작위 카드 다섯을 강화합니다. 내 레스트에서 무작위 카드를 내 손으로 가져옵니다.",
      "notes": [],
      "sourceLine": 520,
      "id": "general:축성",
      "upgrade": {
        "name": "축성+",
        "element": "HOLY",
        "cost": 1,
        "text": "내 레스트에 있는 무작위 카드 다섯을 강화합니다. 내 레스트에서 카드를 발견하여 내 손으로 가져옵니다.",
        "notes": [],
        "sourceLine": 522
      },
      "token": false,
      "implementationStatus": "reference-only"
    },
    {
      "name": "신의 권능: 가속",
      "element": "HOLY",
      "cost": 3,
      "text": "사용불가, 일시적. 이 카드가 내 손에 있으면, 내 손에 있는 다른 카드들의 비용이 (1) 감소합니다. 단, 1보다 낮아지진 않습니다.",
      "notes": [],
      "sourceLine": 525,
      "id": "general:신의 권능: 가속",
      "upgrade": {
        "name": "신의 권능: 가속+",
        "element": "HOLY",
        "cost": 3,
        "text": "사용불가, 일시적. 이 카드가 내 손에 있으면, 내 손에 있는 다른 카드들의 비용이 (1) 감소합니다. 단, 1보다 낮아지진 않습니다. 이 카드가 레스트로 이동할 때, 카드를 뽑습니다.",
        "notes": [],
        "sourceLine": 527
      },
      "token": false,
      "implementationStatus": "reference-only"
    },
    {
      "name": "신의 권능: 재생",
      "element": "HOLY",
      "cost": 3,
      "text": "사용불가, 일시적. 이 카드가 내 손에 있으면, 내 카드가 레스트로 이동할 때마다 체력을 5 회복합니다.",
      "notes": [],
      "sourceLine": 530,
      "id": "general:신의 권능: 재생",
      "upgrade": {
        "name": "신의 권능: 재생+",
        "element": "HOLY",
        "cost": 3,
        "text": "사용불가, 일시적. 이 카드가 내 손에 있으면, 내 카드가 레스트로 이동할 때마다 체력을 5 회복합니다. 이 카드가 레스트로 이동할 때, 카드를 뽑습니다.",
        "notes": [],
        "sourceLine": 532
      },
      "token": false,
      "implementationStatus": "reference-only"
    },
    {
      "name": "신의 권능: 징벌",
      "element": "HOLY",
      "cost": 3,
      "text": "사용불가, 일시적. 이 카드가 내 손에 있으면, 내 카드가 레스트로 이동할 때마다 상대에게 피해를 5 줍니다.",
      "notes": [],
      "sourceLine": 535,
      "id": "general:신의 권능: 징벌",
      "upgrade": {
        "name": "신의 권능: 징벌+",
        "element": "HOLY",
        "cost": 3,
        "text": "사용불가, 일시적. 이 카드가 내 손에 있으면, 내 카드가 레스트로 이동할 때마다 상대에게 피해를 5 줍니다. 이 카드가 레스트로 이동할 때, 카드를 뽑습니다.",
        "notes": [],
        "sourceLine": 537
      },
      "token": false,
      "implementationStatus": "reference-only"
    },
    {
      "name": "신의 권능: 성역",
      "element": "HOLY",
      "cost": 3,
      "text": "사용불가, 일시적. 이 카드가 내 손에 있으면, 내 다른 카드가 레스트로 이동할 때마다 카드를 뽑습니다.",
      "notes": [],
      "sourceLine": 540,
      "id": "general:신의 권능: 성역",
      "upgrade": {
        "name": "신의 권능: 성역+",
        "element": "HOLY",
        "cost": 3,
        "text": "사용불가, 일시적. 이 카드가 내 손에 있으면, 내 다른 카드가 레스트로 이동할 때마다 카드를 뽑습니다. 이 카드가 레스트로 이동할 때, 카드를 뽑습니다.",
        "notes": [],
        "sourceLine": 542
      },
      "token": false,
      "implementationStatus": "reference-only"
    },
    {
      "name": "신의 권능: 응징",
      "element": "HOLY",
      "cost": 3,
      "text": "사용불가, 일시적. 이 카드가 내 손에 있으면, 체력을 회복시키는 내 카드와 능력이 대신 상대에게 피해를 줍니다.",
      "notes": [],
      "sourceLine": 545,
      "id": "general:신의 권능: 응징",
      "upgrade": {
        "name": "신의 권능: 응징+",
        "element": "HOLY",
        "cost": 3,
        "text": "사용불가, 일시적. 이 카드가 내 손에 있으면, 체력을 회복시키는 내 카드와 능력이 대신 상대에게 피해를 줍니다. 이 카드가 레스트로 이동할 때, 카드를 뽑습니다.",
        "notes": [],
        "sourceLine": 547
      },
      "token": false,
      "implementationStatus": "reference-only"
    },
    {
      "name": "마법공학: 아틀라스",
      "element": "LIGHTNING",
      "cost": 3,
      "text": "사용불가. 이 카드가 내 손에 있으면, 상대가 카드를 발견했을 때 발동합니다. 카드를 뽑고 이 카드와 상대가 발견한 카드들을 레스트로 보냅니다.",
      "notes": [],
      "sourceLine": 551,
      "id": "general:마법공학: 아틀라스",
      "upgrade": {
        "name": "마법공학: 아틀라스+",
        "element": "LIGHTNING",
        "cost": 3,
        "text": "사용불가. 이 카드가 내 손에 있으면, 상대가 카드를 발견했을 때 발동합니다. 카드를 뽑고 이 카드와 상대가 발견한 카드들을 레스트로 보냅니다. 이번 턴의 엔드 페이즈시까지 상대가 카드를 발견할 때마다 레스트로 보냅니다.",
        "notes": [],
        "sourceLine": 553
      },
      "token": false,
      "implementationStatus": "reference-only"
    },
    {
      "name": "하늘의 선물",
      "element": "HOLY",
      "cost": 0,
      "text": "서로는 패가 6장이 되도록 카드를 뽑습니다.",
      "notes": [],
      "sourceLine": 556,
      "id": "general:하늘의 선물",
      "upgrade": {
        "name": "하늘의 선물+",
        "element": "HOLY",
        "cost": 0,
        "text": "패가 6장이 되도록 카드를 뽑습니다.",
        "notes": [],
        "sourceLine": 558
      },
      "token": false,
      "implementationStatus": "reference-only"
    },
    {
      "name": "맹독",
      "element": "NATURE",
      "cost": 1,
      "text": "상대에게 중독을 3 부여합니다.",
      "notes": [],
      "sourceLine": 561,
      "id": "general:맹독",
      "upgrade": {
        "name": "맹독+",
        "element": "NATURE",
        "cost": 1,
        "text": "상대에게 중독을 4 부여합니다.",
        "notes": [],
        "sourceLine": 563
      },
      "token": false,
      "implementationStatus": "reference-only"
    },
    {
      "name": "독버섯",
      "element": "NATURE",
      "cost": 2,
      "text": "상대에게 중독을 5 부여합니다. 치명타: 상대에게 중독만큼 피해를 줍니다.",
      "notes": [],
      "sourceLine": 566,
      "id": "general:독버섯",
      "upgrade": {
        "name": "독버섯+",
        "element": "NATURE",
        "cost": 2,
        "text": "상대에게 중독을 7 부여합니다. 치명타: 상대에게 중독만큼 피해를 줍니다.",
        "notes": [],
        "sourceLine": 568
      },
      "token": false,
      "implementationStatus": "reference-only"
    },
    {
      "name": "차오르는 독",
      "element": "NATURE",
      "cost": 1,
      "text": "상대에게 중독을 2 부여합니다. 상대가 이미 중독 상태면, 대신 중독을 4 부여합니다.",
      "notes": [],
      "sourceLine": 571,
      "id": "general:차오르는 독",
      "upgrade": {
        "name": "차오르는 독+",
        "element": "NATURE",
        "cost": 1,
        "text": "상대에게 중독을 3 부여합니다. 상대가 이미 중독 상태면, 대신 중독을 5 부여합니다.",
        "notes": [],
        "sourceLine": 573
      },
      "token": false,
      "implementationStatus": "reference-only"
    },
    {
      "name": "독사과",
      "element": "NATURE",
      "cost": 0,
      "text": "체력을 12 회복합니다. 나에게 중독을 3 부여합니다.",
      "notes": [],
      "sourceLine": 576,
      "id": "general:독사과",
      "upgrade": {
        "name": "독사과+",
        "element": "NATURE",
        "cost": 0,
        "text": "체력을 18 회복합니다. 나에게 중독을 3 부여합니다.",
        "notes": [],
        "sourceLine": 578
      },
      "token": false,
      "implementationStatus": "reference-only"
    },
    {
      "name": "궁극의 역병",
      "element": "NATURE",
      "cost": 5,
      "text": "상대에게 피해를 5 주고, 카드를 5장 뽑고, 보호막을 5 얻고, 상대에게 중독을 5 부여합니다.",
      "notes": [],
      "sourceLine": 581,
      "id": "general:궁극의 역병",
      "upgrade": {
        "name": "궁극의 역병+",
        "element": "NATURE",
        "cost": 4,
        "text": "상대에게 피해를 5 주고, 카드를 5장 뽑고, 보호막을 5 얻고, 상대에게 중독을 5 부여합니다.",
        "notes": [],
        "sourceLine": 583
      },
      "token": false,
      "implementationStatus": "reference-only"
    },
    {
      "name": "제독",
      "element": "FIRE",
      "cost": 1,
      "text": "나에게 부여된 해로운 효과를 모두 없앱니다. 없앤 효과 하나당 카드를 뽑습니다.",
      "notes": [],
      "sourceLine": 587,
      "id": "general:제독",
      "upgrade": {
        "name": "제독+",
        "element": "FIRE",
        "cost": 0,
        "text": "나에게 부여된 해로운 효과를 모두 없앱니다. 없앤 효과 하나당 카드를 뽑습니다.",
        "notes": [],
        "sourceLine": 589
      },
      "token": false,
      "implementationStatus": "reference-only"
    },
    {
      "name": "자연의 해독",
      "element": "NATURE",
      "cost": 1,
      "text": "카드를 뽑습니다. 나에게 부여된 중독만큼 체력을 회복하고, 중독을 없앱니다.",
      "notes": [],
      "sourceLine": 592,
      "id": "general:자연의 해독",
      "upgrade": {
        "name": "자연의 해독+",
        "element": "NATURE",
        "cost": 0,
        "text": "카드를 뽑습니다. 나에게 부여된 중독의 2배만큼 체력을 회복하고, 중독을 없앱니다.",
        "notes": [],
        "sourceLine": 594
      },
      "token": false,
      "implementationStatus": "reference-only"
    },
    {
      "name": "씨뿌리기",
      "element": "NATURE",
      "cost": 1,
      "text": "상대에게 중독을 3 부여합니다. 이미 중독 상태라면, 대신 상대에게 부여된 중독을 모두 소모하고 중독 피해를 즉시 입힙니다.",
      "notes": [],
      "sourceLine": 597,
      "id": "general:씨뿌리기",
      "upgrade": {
        "name": "씨뿌리기+",
        "element": "NATURE",
        "cost": 1,
        "text": "상대에게 중독을 4 부여합니다. 이미 중독 상태라면, 대신 상대에게 부여된 중독을 모두 소모하고 중독 피해를 즉시 입힙니다.",
        "notes": [],
        "sourceLine": 599
      },
      "token": false,
      "implementationStatus": "reference-only"
    },
    {
      "name": "전이",
      "element": "LIGHTNING",
      "cost": 1,
      "text": "나에게 부여된 해로운 효과를 모두 상대에게 옮깁니다.",
      "notes": [],
      "sourceLine": 602,
      "id": "general:전이",
      "upgrade": {
        "name": "전이+",
        "element": "LIGHTNING",
        "cost": 0,
        "text": "나에게 부여된 해로운 효과를 모두 상대에게 옮깁니다.",
        "notes": [],
        "sourceLine": 604
      },
      "token": false,
      "implementationStatus": "reference-only"
    }
  ],
  "tokens": [
    {
      "name": "혹한",
      "element": "NEUTRAL",
      "cost": 1,
      "text": "일시적. 이 카드가 레스트로 이동할 때, 대신 이 카드를 게임에서 제외하고 서로 카드를 1장 뽑습니다.",
      "notes": [],
      "sourceLine": 115,
      "id": "general:혹한",
      "upgrade": {
        "name": "혹한+",
        "element": "NEUTRAL",
        "cost": 1,
        "text": "일시적. 이 카드가 레스트로 이동할 때, 대신 이 카드를 게임에서 제외하고 상대가 카드를 1장 뽑습니다.",
        "notes": [],
        "sourceLine": 117
      },
      "token": true,
      "implementationStatus": "reference-only"
    },
    {
      "name": "고드름",
      "element": "NEUTRAL",
      "cost": 1,
      "text": "일회용. 이 카드의 양쪽에 있는 카드들의 비용이 (1) 증가합니다..",
      "notes": [],
      "sourceLine": 180,
      "id": "general:고드름",
      "upgrade": {
        "name": "고드름+",
        "element": "NEUTRAL",
        "cost": 2,
        "text": "일회용.이 카드의 양쪽에 있는 카드들의 비용이 (1) 증가합니다.",
        "notes": [],
        "sourceLine": 182
      },
      "token": true,
      "implementationStatus": "reference-only"
    },
    {
      "name": "저주",
      "element": "NEUTRAL",
      "cost": 1,
      "text": "일회용. 이 카드가 내 손에 있으면, 매 턴의 엔드 페이즈시 나에게 피해를 3 줍니다.",
      "notes": [],
      "sourceLine": 216,
      "id": "general:저주",
      "upgrade": {
        "name": "저주+",
        "element": "NEUTRAL",
        "cost": 2,
        "text": "일회용. 이 카드가 내 손에 있으면, 매 턴의 엔드 페이즈시 나에게 피해를 5 줍니다.",
        "notes": [],
        "sourceLine": 218
      },
      "token": true,
      "implementationStatus": "reference-only"
    },
    {
      "name": "넘치는 마나",
      "element": "NATURE",
      "cost": 0,
      "text": "일회용. 카드를 뽑습니다.",
      "notes": [],
      "sourceLine": 297,
      "id": "excess_mana",
      "upgrade": {
        "name": "넘치는 마나+",
        "element": "NATURE",
        "cost": 0,
        "text": "일회용. 카드를 2장 뽑습니다.",
        "notes": [],
        "sourceLine": 299
      },
      "token": true,
      "implementationStatus": "reference-only"
    }
  ],
  "sourceCorrections": [
    {
      "sourceLine": 76,
      "from": "절멸",
      "to": "절멸+"
    },
    {
      "sourceLine": 440,
      "from": "고철 더미에서",
      "to": "고철 더미에서+"
    },
    {
      "sourceLine": 482,
      "from": "계시+",
      "to": "심판+"
    }
  ]
};

// ---- src/opponents.js ----
 




A4.Opponents = (function () {
  var content = A4.content, roster = content.opponentDecks.enemies;
  var abilities = content.opponentAbilities, byId = {}, byName = {}, references = {};
  var encounters = [[],[],[],[],[],[],[],[]];
  content.generalCards.concat(content.tokens,abilities.exclusiveCards).forEach(function (card) {
    byName[card.name] = card; references[card.id] = card;
  });
  roster.forEach(function (enemy) {
    A4.assert(abilities.abilities[enemy.id],'상대와 영웅 능력의 식별자가 다릅니다: '+enemy.id);
    byId[enemy.id] = enemy;
    enemy.stages.forEach(function (stage) { encounters[stage-1].push(enemy.id); });
  });
  function enabledEncounter(id) { return byId[id].encounterEnabled !== false; }
  function poolFor(enemy) {
    return content.generalCards.filter(function (card) {
      return !enemy.randomPoolElements || enemy.randomPoolElements.indexOf(card.element) >= 0;
    });
  }
  function entryReference(entry) { return entry.cardId ? references[entry.cardId] : byName[entry.name]; }
  function validateDesign() {
    var errors = [], ids = {}, names = {};
    function check(ok, message) { if (!ok) errors.push(message); }
    check(roster.length === 26,'상대 26종이 필요합니다.');
    check(content.generalCards.length >= 100,'일반 카드 원문이 부족합니다.');
    check(abilities.exclusiveCards.length === 21,'전용 카드 21종이 필요합니다.');
    check(abilities.doctorQuotes.length === 12,'세례 대사 12개가 필요합니다.');
    abilities.exclusiveCards.forEach(function (card) {
      check(card.exclusive === true && (card.id==='crystal_ball'||(card.upgradeable === false && !card.upgrade)),'전용 카드 강화 불가: '+card.name);
    });
    roster.forEach(function (enemy) {
      var count = 0, copies = {}, entries = {};
      check(!ids[enemy.id] && !names[enemy.name],'상대 식별자·이름 중복: '+enemy.name);
      ids[enemy.id] = true; names[enemy.name] = true;
      check(!!abilities.abilities[enemy.id],'영웅 능력 명세 누락: '+enemy.name);
      check(['fixed','random','mirror'].indexOf(enemy.deckMode) >= 0,'덱 생성 방식: '+enemy.name);
      check(enemy.stages.length > 0 && enemy.stages.every(function (stage) { return A4.integer(stage,1) && stage <= 8; }),'등장 단계: '+enemy.name);
      (enemy.cards || []).forEach(function (entry) {
        var definition=entryReference(entry),key=definition?definition.id:(entry.cardId||entry.name);
        check(!!definition&&definition.name===entry.name,'정의되지 않은 카드: '+enemy.name+' / '+entry.name);
        check(A4.integer(entry.count,1),'카드 장수: '+enemy.name+' / '+entry.name);
        var rankKey=key+(entry.upgraded?'+':'');
        check(!entries[rankKey],'카드 항목 중복: '+enemy.name+' / '+entry.name);entries[rankKey]=true;
        check(!entry.upgraded||!!(definition&&definition.upgrade),'강화 정의가 없는 카드: '+enemy.name+' / '+entry.name);
        copies[key] = (copies[key]||0)+entry.count; count += entry.count;
        var limit = enemy.duplicateLimits && enemy.duplicateLimits[entry.name] || 2;
        check(copies[key] <= limit,'동명 카드 상한: '+enemy.name+' / '+entry.name);
        check(!definition || !definition.token,'기본 덱에 토큰: '+enemy.name+' / '+entry.name);
      });
      if (enemy.deckMode === 'random') {
        check(A4.integer(enemy.randomCount,1),'무작위 카드 장수: '+enemy.name);
        check(poolFor(enemy).length * 2 >= enemy.randomCount,'무작위 풀 부족: '+enemy.name);
        count += enemy.randomCount;
      }
      if (enemy.deckMode !== 'mirror') check(A4.integer(enemy.deckSize,4) && count === enemy.deckSize,'덱 총 장수: '+enemy.name+' ('+count+'/'+enemy.deckSize+')');
      else check(count === 0 && enemy.deckSize === null,'미러는 고정 덱을 가지지 않습니다.');
    });
    encounters.forEach(function (list, index) { check(list.length === [2,9,9,7,7,4,4,4][index],(index+1)+'전투 후보 수'); });
    return errors;
  }
  function addInstance(state, target, entry) {
    var definition = typeof entry==='string'?byName[entry]:entryReference(entry);
    A4.assert(definition,'상대 카드 명세가 없습니다: '+(entry.name||entry));
    target.push({uid:A4.id(state,'enemy-card-'),cardId:definition.id,upgraded:!!entry.upgraded});
  }
  function prepare(state, run, catalog, forcedEnemyId) {
    var stage = run.wins+1, rng, id, enemy, plan, bag = [], errors;
    A4.assert(A4.integer(stage,1) && stage <= 8,'상대 생성 단계가 올바르지 않습니다.');
    if (run.enemySpec && run.enemySpec.stage === stage) {
      A4.assert(!forcedEnemyId || run.enemySpec.enemyId === forcedEnemyId,'이미 확정된 상대를 다시 추첨할 수 없습니다.');
      return run.enemySpec;
    }
    errors = validateDesign(); A4.assert(!errors.length,errors.join(', '));
    var seenIds={},seenNames={};
    (run.encounterResults||[]).forEach(function(result){
      if(result.enemyId)seenIds[result.enemyId]=true;
      if(result.name)seenNames[result.name]=true;
    });
     
    if(run.wins>0&&run.enemyId)seenIds[run.enemyId]=true;
    var candidates=encounters[stage-1].filter(function(candidate){return (enabledEncounter(candidate)||candidate===forcedEnemyId)&&!seenIds[candidate]&&!seenNames[byId[candidate].name];});
    if (forcedEnemyId) {
      A4.assert(encounters[stage-1].indexOf(forcedEnemyId) >= 0,'해당 전투의 후보가 아닙니다.');
      A4.assert(candidates.indexOf(forcedEnemyId)>=0,'이번 탐험에서 이미 만난 상대입니다.');
    }
    A4.assert(candidates.length>0,'이번 탐험에서 아직 만나지 않은 상대 후보가 없습니다.');
    rng = A4.random(state); id = forcedEnemyId || A4.pick(candidates,rng); enemy = byId[id];
    plan = {version:1,contentRevision:content.revision,battleReady:false,enemyId:id,name:enemy.name,
      stage:stage,maxHp:content.stageHp[stage-1],deckMode:enemy.deckMode,deck:[],
      heroPowerSpec:A4.copy(abilities.abilities[id]),treasures:[],treasurePassives:[],playerOpeningAdditions:[]};
    if (enemy.deckMode === 'mirror') {
      A4.assert(Array.isArray(run.deck) && run.deck.length > 0,'복제할 탐험 덱이 없습니다.');
      if(run.hero&&run.hero.startingTreasureId)plan.startingTreasureId=run.hero.startingTreasureId;
      plan.deck = run.deck.map(function (card) {
        var cloned = A4.copy(card); cloned.uid = A4.id(state,'enemy-card-'); return cloned;
      });
      Object.keys(run.treasures || {}).forEach(function (slot) {
        var treasureId = run.treasures[slot], def = catalog.treasures[treasureId];
        A4.assert(def,'복제할 보물 정의가 없습니다: '+treasureId);
        plan.treasures.push({sourceSlot:slot,treasureId:treasureId,definition:A4.copy(def)});
        if (def.kind === 'passive') plan.treasurePassives = plan.treasurePassives.concat(A4.copy(def.effects));
      });
       
       
    } else {
      enemy.cards.forEach(function (entry) {
        for (var n = 0; n < entry.count; n++) addInstance(state,plan.deck,entry);
      });
      if (enemy.deckMode === 'random') {
        poolFor(enemy).forEach(function (card) { bag.push(card.name,card.name); });
        A4.sample(bag,enemy.randomCount,rng).forEach(function (name) { addInstance(state,plan.deck,name); });
      }
      A4.assert(plan.deck.length === enemy.deckSize,'생성한 상대 덱 장수가 다릅니다.');
    }
    if (id === 'extreme_troll') {
      for (var i = 0; i < 3; i++) plan.playerOpeningAdditions.push({uid:A4.id(state,'battle-card-'),cardId:'deactivation',upgraded:false});
    }
     
    run.enemySpec = plan;
    return plan;
  }
  function rejectBlueprint(enemy) {
    A4.assert(enemy && !enemy.blueprint,'상대 덱·능력은 설계 데이터입니다. 카드 효과와 보스 전투 처리를 먼저 구현해야 합니다.');
  }
   
  A4.catalog.config.enemyMaxHpByStage = content.stageHp.slice();
  A4.catalog.encounters = encounters.map(function(list){return list.filter(enabledEncounter);});
  roster.forEach(function (enemy) {
    A4.catalog.enemies[enemy.id] = {id:enemy.id,name:enemy.name,blueprint:true,
      implementationStatus:'pending',deckMode:enemy.deckMode,deckSize:enemy.deckSize,
      encounterEnabled:enemy.encounterEnabled!==false,stages:enemy.stages.slice(),heroPowerSpec:A4.copy(abilities.abilities[enemy.id])};
  });
  return {validateDesign:validateDesign,prepare:prepare,rejectBlueprint:rejectBlueprint,
    get:function (id) { return byId[id] ? A4.copy(byId[id]) : null; },
    reference:function (name) { return byName[name] ? A4.copy(byName[name]) : null; },
    referenceById:function (id) { return references[id] ? A4.copy(references[id]) : null; },
    stage:function (number) {
      A4.assert(A4.integer(number,1) && number <= 8,'전투 번호는 1~8입니다.');
      return {stage:number,maxHp:content.stageHp[number-1],candidates:encounters[number-1].filter(enabledEncounter)};
    }};
}());

// ---- src/store.js ----
 




(function () {
    "use strict";
    var FORMAT = "akjilbot4.snapshot.v1";
    var FILE_RE = /^revision-(\d{16})-([ab])\.json$/;

    function fail(code, message, cause) {
        var error = new Error(message);
        error.code = code;
        if (cause) error.cause = cause;
        return error;
    }

    function clone(value) {
        var encoded = JSON.stringify(value);
        if (typeof encoded !== "string") throw fail("INVALID_JSON", "저장할 값이 JSON이 아닙니다.");
        return JSON.parse(encoded);
    }

     
    function sha256(value) {
        var bytes = unescape(encodeURIComponent(value));
        var words = [], length = bytes.length, i, j, t, a, b, c, d, e, f, g, h;
        var w = [], out = [], H = [1779033703, 3144134277, 1013904242, 2773480762,
            1359893119, 2600822924, 528734635, 1541459225];
        var K = [1116352408,1899447441,3049323471,3921009573,961987163,1508970993,2453635748,2870763221,
            3624381080,310598401,607225278,1426881987,1925078388,2162078206,2614888103,3248222580,
            3835390401,4022224774,264347078,604807628,770255983,1249150122,1555081692,1996064986,
            2554220882,2821834349,2952996808,3210313671,3336571891,3584528711,113926993,338241895,
            666307205,773529912,1294757372,1396182291,1695183700,1986661051,2177026350,2456956037,
            2730485921,2820302411,3259730800,3345764771,3516065817,3600352804,4094571909,275423344,
            430227734,506948616,659060556,883997877,958139571,1322822218,1537002063,1747873779,
            1955562222,2024104815,2227730452,2361852424,2428436474,2756734187,3204031479,3329325298];
        function rotate(x, n) { return (x >>> n) | (x << (32 - n)); }
        for (i = 0; i < length; i++) words[i >> 2] = (words[i >> 2] || 0) | bytes.charCodeAt(i) << (24 - (i % 4) * 8);
        words[length >> 2] = (words[length >> 2] || 0) | 128 << (24 - (length % 4) * 8);
        var end = (((length + 8) >> 6) + 1) * 16;
        words[end - 2] = Math.floor(length / 536870912);
        words[end - 1] = (length * 8) | 0;
        for (i = 0; i < end; i += 16) {
            a=H[0]; b=H[1]; c=H[2]; d=H[3]; e=H[4]; f=H[5]; g=H[6]; h=H[7];
            for (j = 0; j < 64; j++) {
                if (j < 16) w[j] = words[i + j] | 0;
                else {
                    var x = w[j - 15], y = w[j - 2];
                    w[j] = (w[j - 16] + (rotate(x,7)^rotate(x,18)^(x>>>3)) + w[j - 7] + (rotate(y,17)^rotate(y,19)^(y>>>10))) | 0;
                }
                t = (h + (rotate(e,6)^rotate(e,11)^rotate(e,25)) + ((e&f)^((~e)&g)) + K[j] + w[j]) | 0;
                var t2 = ((rotate(a,2)^rotate(a,13)^rotate(a,22))+((a&b)^(a&c)^(b&c))) | 0;
                h=g; g=f; f=e; e=(d+t)|0; d=c; c=b; b=a;
                a=(t+t2)|0;
            }
            H[0]=(H[0]+a)|0; H[1]=(H[1]+b)|0; H[2]=(H[2]+c)|0; H[3]=(H[3]+d)|0;
            H[4]=(H[4]+e)|0; H[5]=(H[5]+f)|0; H[6]=(H[6]+g)|0; H[7]=(H[7]+h)|0;
        }
        for (i = 0; i < 8; i++) out.push(("00000000" + (H[i] >>> 0).toString(16)).slice(-8));
        return out.join("");
    }

    function fileName(revision, side) {
        return "revision-" + ("0000000000000000" + revision).slice(-16) + "-" + side + ".json";
    }

    function encode(revision, previous, label, state, result, digestFn) {
        var payload = JSON.stringify({revision: revision, previous: previous, label: String(label), state: state, result: result});
        var digest = (digestFn || sha256)(payload);
        return {checksum: digest, text: JSON.stringify({format: FORMAT, checksum: digest, payload: payload})};
    }

    function decode(text, revision, digestFn) {
        var envelope = JSON.parse(text);
        if (!envelope || envelope.format !== FORMAT || typeof envelope.payload !== "string" || (digestFn || sha256)(envelope.payload) !== envelope.checksum) {
            throw fail("CORRUPT_STORE", "저장 파일의 체크섬이 일치하지 않습니다.");
        }
        var body = JSON.parse(envelope.payload);
        if (!body || body.revision !== revision || !Object.prototype.hasOwnProperty.call(body, "state") ||
                (revision === 0 ? body.previous !== null : typeof body.previous !== "string")) {
            throw fail("CORRUPT_STORE", "저장 파일의 버전 또는 내용이 잘못되었습니다.");
        }
        return {body: body, checksum: envelope.checksum};
    }

    function create(io, options) {
        options = options || {};
        var state, revision = -1, checksum = null, loaded = false, blocked = false, closed = false, busy = false;
        var warnings = [], release = null, timing = {processingMs:0,savingMs:0};

        function readIndex() {
            var names = io.list(), index = {}, revisions = [], i, match, number;
            for (i = 0; i < names.length; i++) {
                match = FILE_RE.exec(String(names[i]));
                if (!match) continue;  
                number = Number(match[1]);
                if (number > 9007199254740991) throw fail("CORRUPT_STORE", "저장 버전 범위를 초과했습니다.");
                if (!index[number]) { index[number] = {}; revisions.push(number); }
                index[number][match[2]] = String(names[i]);
            }
            revisions.sort(function (a,b) { return a-b; });
            return {index: index, revisions: revisions};
        }

        function readPair(number, pair, reportWarnings) {
            var candidates = [], sides = ["a", "b"], i, name;
            for (i = 0; i < sides.length; i++) {
                name = pair[sides[i]];
                if (!name) continue;
                var raw = io.read(name);  
                try { candidates.push(decode(raw, number, io.sha256)); }
                catch (error) { if (reportWarnings) warnings.push("손상된 사본: " + name); }
            }
            if (!candidates.length) throw fail("CORRUPT_STORE", "버전 " + number + "의 유효한 사본이 없습니다. 데이터를 초기화하지 않았습니다.");
            if (candidates.length === 2 && candidates[0].checksum !== candidates[1].checksum) {
                throw fail("CONFLICTING_REVISION", "같은 버전에 서로 다른 저장 내용이 존재합니다: " + number);
            }
            if (reportWarnings && candidates.length < 2) warnings.push("버전 " + number + "을 남아 있는 사본에서 복구했습니다.");
            return candidates[0];
        }

        function recover() {
            var found = readIndex(), previous = null, last = null, i, number;
            if (options.latestSnapshotOnly && found.revisions.length) {
                 
                 
                for (i = 0; i < found.revisions.length; i++) {
                    if (found.revisions[i] !== i) throw fail("CORRUPT_STORE", "저장 이력에 누락된 버전이 있습니다. 데이터를 초기화하지 않았습니다.");
                }
                number = found.revisions[found.revisions.length - 1];
                last = readPair(number, found.index[number], true);
                if (number > 0) {
                    previous = readPair(number - 1, found.index[number - 1], true);
                    if (last.body.previous !== previous.checksum) throw fail("CORRUPT_STORE", "저장 이력의 연결이 손상되었습니다.");
                }
                return last;
            }
            for (i = 0; i < found.revisions.length; i++) {
                number = found.revisions[i];
                if (number !== i) throw fail("CORRUPT_STORE", "저장 이력에 누락된 버전이 있습니다. 데이터를 초기화하지 않았습니다.");
                last = readPair(number, found.index[number], true);
                if (last.body.previous !== previous) throw fail("CORRUPT_STORE", "저장 이력의 연결이 손상되었습니다.");
                previous = last.checksum;
            }
            return last;
        }

        function assertUnchanged() {
             
             
            if (release && io.hasExclusiveLock && io.hasExclusiveLock()) return;
            var found = readIndex(), latest = found.revisions.length ? found.revisions[found.revisions.length - 1] : -1;
            if (latest !== revision) throw fail("STALE_WRITER", "다른 실행 인스턴스가 저장소를 변경했습니다. 재시작이 필요합니다.");
            if (latest >= 0 && readPair(latest, found.index[latest], false).checksum !== checksum) {
                throw fail("STALE_WRITER", "현재 저장 버전이 메모리와 다릅니다. 재시작이 필요합니다.");
            }
        }

        function commit(label, next, result, resultOnly) {
            var nextRevision = revision + 1, record = encode(nextRevision, checksum, label, next, result, io.sha256);
            try {
                assertUnchanged();
                 


                io.writeNewDurable(fileName(nextRevision, "a"), record.text);
                io.writeNewDurable(fileName(nextRevision, "b"), record.text);
            } catch (error) {
                blocked = true;
                throw fail("SAVE_BLOCKED", "저장 실패로 변경을 중단했습니다. 일부 변경은 이미 저장됐을 수 있으므로 재시작 후 확인해야 합니다.", error);
            }
            state = next;
            revision = nextRevision;
            checksum = record.checksum;
            return resultOnly ? {result: clone(result), revision: revision} : {state: clone(state), result: clone(result), revision: revision};
        }

        function ready() {
            if (closed) throw fail("STORE_CLOSED", "저장소가 닫혔습니다.");
            if (blocked) throw fail("SAVE_BLOCKED", "저장 오류가 발생했습니다. 재시작 전에는 변경할 수 없습니다.");
            if (!loaded) throw fail("STORE_NOT_LOADED", "먼저 저장소를 불러와야 합니다.");
        }

        return {
            load: function (initialState) {
                if (closed || loaded || blocked) throw fail("INVALID_LOAD", "새 저장소 인스턴스에서 한 번만 불러올 수 있습니다.");
                try {
                    if (io.acquireLock) release = io.acquireLock();
                    var restored = recover();
                    if (restored) {
                        state = clone(restored.body.state);
                        revision = restored.body.revision;
                        checksum = restored.checksum;
                    } else commit("initialize", clone(initialState), null);
                    loaded = true;
                    return clone(state);
                } catch (error) {
                    blocked = true;
                     

                    if (release) {
                        var unlock = release;
                        release = null;
                        try { unlock(); } catch (closeError) { error.closeError = closeError; }
                    }
                    throw error;
                }
            },
            transact: function (label, reducer, transactionOptions) {
                ready();
                if (busy) throw fail("REENTRANT_TRANSACTION", "중첩 저장 트랜잭션은 허용되지 않습니다.");
                busy = true;
                var started=Date.now(),savingAt=null;
                timing={processingMs:0,savingMs:0};
                try {
                    var draft = clone(state), result = reducer(draft);
                    if (typeof result === "undefined") result = null;
                     
                    draft = clone(draft); result = clone(result);
                    savingAt=Date.now();timing.processingMs=savingAt-started;
                    return commit(label, draft, result, transactionOptions && transactionOptions.resultOnly);
                } finally { if(savingAt!==null)timing.savingMs=Date.now()-savingAt;else timing.processingMs=Date.now()-started;busy = false; }
            },
            getTiming: function () { return {processingMs:timing.processingMs,savingMs:timing.savingMs}; },
            resetTiming: function () { timing={processingMs:0,savingMs:0}; },
            getState: function () { if (!loaded) throw fail("STORE_NOT_LOADED", "저장소가 아직 로드되지 않았습니다."); return clone(state); },
             
             
            select: function (selector) { ready(); return clone(selector(state)); },
            getRevision: function () { return revision; },
            getWarnings: function () { return warnings.slice(); },
            isBlocked: function () { return blocked; },
            close: function () {
                closed = true;
                if (release) { var unlock = release; release = null; unlock(); }
            }
        };
    }

    function safeName(name) {
        if (!/^[A-Za-z0-9._-]+$/.test(name)) throw fail("INVALID_PATH", "잘못된 저장 파일 이름입니다.");
        return name;
    }

    function nodeIO(basePath, requireFn) {
        var req = requireFn || (typeof require === "function" ? require : null);
        if (!req) throw fail("NO_NODE", "Node require 함수를 전달해야 합니다.");
        var fs = req("fs"), path = req("path"), proc = req("process"), root = path.resolve(basePath), sequence = 0;
        function directorySync(directory) {
            var fd;
            try { fd = fs.openSync(directory || root, "r"); fs.fsyncSync(fd); }
            catch (error) {
                 

                if (!(proc.platform === "win32" && ["EPERM","EISDIR","EINVAL","EACCES"].indexOf(error.code) >= 0)) throw error;
            } finally { if (typeof fd === "number") fs.closeSync(fd); }
        }
         

        var missing = [], cursor = root, parent, directory;
        while (!fs.existsSync(cursor)) {
            missing.push(cursor); parent = path.dirname(cursor);
            if (parent === cursor) throw fail("CREATE_DIRECTORY_FAILED", "저장 폴더 상위 경로가 없습니다.");
            cursor = parent;
        }
        if (!fs.statSync(cursor).isDirectory()) throw fail("CREATE_DIRECTORY_FAILED", "저장 경로가 폴더가 아닙니다.");
        while (missing.length) {
            directory = missing.pop();
            try { fs.mkdirSync(directory); }
            catch (error) { if (error.code !== "EEXIST" || !fs.statSync(directory).isDirectory()) throw error; }
            directorySync(path.dirname(directory));
        }
        directorySync(root);
        return {
            list: function () { return fs.readdirSync(root); },
            read: function (name) { return fs.readFileSync(path.join(root, safeName(name)), "utf8"); },
            writeNewDurable: function (name, content) {
                var target = path.join(root, safeName(name));
                var temp = path.join(root, ".pending-" + proc.pid + "-" + Date.now() + "-" + (++sequence) + "-" + Math.random().toString(16).slice(2));
                var fd, published = false;
                try {
                    fd = fs.openSync(temp, "wx");
                    fs.writeFileSync(fd, content, "utf8");
                    fs.fsyncSync(fd);
                    fs.closeSync(fd); fd = undefined;
                     

                    fs.linkSync(temp, target); published = true;
                    directorySync();
                } finally {
                    if (typeof fd === "number") fs.closeSync(fd);
                    if (published) { fs.unlinkSync(temp); directorySync(); }
                     
                }
            },
            durability: proc.platform === "win32" ? "file-fsync+atomic-no-replace (directory fsync unavailable on Windows)" : "file-fsync+directory-fsync+atomic-no-replace"
        };
    }

    function javaIO(basePath) {
        if (typeof java === "undefined") throw fail("NO_JAVA", "Android Java 실행 환경이 필요합니다.");
        var root = new java.io.File(String(basePath)).getCanonicalFile();
        var ownsLock = false, activeLock = null;
        function file(name) { return new java.io.File(root, safeName(name)); }
        function directorySync(directory) {
            var Os = Packages.android.system.Os, constants = Packages.android.system.OsConstants, descriptor = null;
            try {
                descriptor = Os.open(String((directory || root).getAbsolutePath()), constants.O_RDONLY | constants.O_DIRECTORY, 0);
                Os.fsync(descriptor);
            } finally { if (descriptor !== null) Os.close(descriptor); }
        }
        var missing = [], cursor = root, directory;
        while (cursor !== null && !cursor.exists()) { missing.push(cursor); cursor = cursor.getParentFile(); }
        if (cursor === null || !cursor.isDirectory()) throw fail("CREATE_DIRECTORY_FAILED", "저장 경로가 폴더가 아닙니다.");
        while (missing.length) {
            directory = missing.pop();
            if (!directory.mkdir() && !directory.isDirectory()) throw fail("CREATE_DIRECTORY_FAILED", "저장 폴더를 만들 수 없습니다.");
            directorySync(directory.getParentFile());
        }
         

        directorySync(root);
        return {
            sha256: function (value) {
                var digest = java.security.MessageDigest.getInstance("SHA-256");
                var bytes = digest.digest(new java.lang.String(String(value)).getBytes("UTF-8")), hex = [], i;
                for(i=0;i<bytes.length;i++)hex.push(("0"+(bytes[i]&255).toString(16)).slice(-2));
                return hex.join("");
            },
            hasExclusiveLock: function () { return ownsLock && activeLock !== null && activeLock.isValid(); },
            acquireLock: function () {
                var handle = new java.io.RandomAccessFile(file(".writer.lock"), "rw"), channel = handle.getChannel(), lock;
                try {
                    lock = channel.tryLock();
                    if (lock === null) throw fail("STORE_LOCKED", "다른 봇 실행 인스턴스가 저장소를 사용 중입니다.");
                    ownsLock = true; activeLock = lock;
                } catch (error) { try { channel.close(); } finally { handle.close(); } throw error; }
                return function () { ownsLock = false; activeLock = null; try { lock.release(); } finally { try { channel.close(); } finally { handle.close(); } } };
            },
            list: function () {
                var names = root.list(), output = [], i;
                if (names === null) throw fail("READ_DIRECTORY_FAILED", "저장 폴더를 읽을 수 없습니다.");
                for (i = 0; i < names.length; i++) output.push(String(names[i]));
                return output;
            },
            read: function (name) {
                var reader = new java.io.InputStreamReader(new java.io.FileInputStream(file(name)), "UTF-8");
                var buffer = java.lang.reflect.Array.newInstance(java.lang.Character.TYPE, 8192), count;
                var output = new java.lang.StringBuilder();
                try { while ((count = reader.read(buffer)) !== -1) output.append(buffer, 0, count); }
                finally { reader.close(); }
                return String(output.toString());
            },
            writeNewDurable: function (name, content) {
                if (!ownsLock) throw fail("STORE_LOCKED", "저장소 잠금이 없습니다.");
                var target = file(name), temp = java.io.File.createTempFile(".pending-", ".json", root);
                var stream = new java.io.FileOutputStream(temp), writer = new java.io.OutputStreamWriter(stream, "UTF-8");
                try { writer.write(String(content)); writer.flush(); stream.getFD().sync(); }
                finally { try { writer.close(); } finally { stream.close(); } }
                if (target.exists()) throw fail("STALE_WRITER", "저장 버전이 이미 존재합니다.");
                 

                if (!temp.renameTo(target)) throw fail("ATOMIC_PUBLISH_FAILED", "저장 파일 이름 변경에 실패했습니다.");
                directorySync();
            },
            durability: "file-fsync+directory-fsync+exclusive-filechannel-lock"
        };
    }

    A4.Store = {create: create, nodeIO: nodeIO, javaIO: javaIO, sha256: sha256};
}());

// ---- src/combat.js ----
 














A4.Combat = (function () {
    "use strict";
    var COUNTERS = { ICE: "FIRE", FIRE: "NATURE", NATURE: "LIGHTNING", LIGHTNING: "ICE" };
    var ELEMENTS = ["ICE", "FIRE", "NATURE", "LIGHTNING"];
    var EFFECTS = { discountRandomHand: 1, damage: 1, heal: 1, shield: 1, draw: 1, excludeSelf: 1, generate: 1, removeFromRun: 1, upgradeSelf: 1, dredge:1, growMana:1, overload:1, lockCards:1, foresight:1, scheduledDamage:1, randomDamage:1 };
    var PASSIVES = { maxHp: 1, startingShield: 1, damageBonus: 1, turnDrawBonus: 1 };
    function copy(value) { return JSON.parse(JSON.stringify(value)); }
    function own(object, key) { return Object.prototype.hasOwnProperty.call(object, key); }
    function fail(message) { throw new Error(message); }
    function nonnegative(value, label) {
        if (typeof value !== "number" || !isFinite(value) || value < 0 || Math.floor(value) !== value) fail(label + ": 0 이상의 정수가 필요합니다.");
        return value;
    }
    function rngIndex(rng, size) {
        var n = rng();
        if (typeof n !== "number" || !isFinite(n) || n < 0 || n >= 1) fail("난수는 0 이상 1 미만이어야 합니다.");
        return Math.floor(n * size);
    }
    function shuffle(list, rng) {
        var i, j, card;
        for (i = list.length - 1; i > 0; i--) {
            j = rngIndex(rng, i + 1); card = list[i]; list[i] = list[j]; list[j] = card;
        }
        return list;
    }
    function describeCard(instance, catalog) {
        var definition = catalog && catalog.cards && catalog.cards[instance.cardId], result, key;
        if (!definition) fail("정의되지 않은 카드: " + instance.cardId);
        result = copy(definition);
        if (instance.upgraded) {
            if (!definition.upgrade) fail("강화 정의가 없는 카드: " + instance.cardId);
            for (key in definition.upgrade) if (own(definition.upgrade, key)) result[key] = copy(definition.upgrade[key]);
            result.name = definition.name + "+";
        }
        result.overpower=!!result.overpower||/(?:^|[.,]\s*)압도(?:[.,:\s]|$)/.test(result.text||'');
        result.vulnerable=!!result.vulnerable||!!instance.vulnerable||/(?:^|[.,]\s*)취약(?:[.,:\s]|$)/.test(result.text||'');
        result.element = result.element || "NEUTRAL";
        if(instance.costDelta)result.cost=Math.max(0,result.cost+instance.costDelta);
        result.uid = instance.uid; result.cardId = instance.cardId; result.upgraded = !!instance.upgraded;
        return result;
    }
    function validateDefinition(def, catalog) {
        var i, e;
        nonnegative(def.cost, "카드 마나");
        if (["ICE", "FIRE", "NATURE", "LIGHTNING", "NEUTRAL", "HOLY", "COSMIC"].indexOf(def.element) < 0) fail("지원하지 않는 카드 속성: " + def.element);
        if (!Array.isArray(def.effects)) fail("카드 효과 배열이 필요합니다.");
        for (i = 0; i < def.effects.length; i++) {
            e = def.effects[i];
            if (!e || !own(EFFECTS, e.type)) fail("지원하지 않는 카드 효과: " + (e && e.type));
            if (e.type === "damage" || e.type === "heal" || e.type === "shield" || e.type === "draw") nonnegative(e.amount, "효과 크기");
            if (["dredge","growMana","overload","foresight","scheduledDamage"].indexOf(e.type) >= 0) nonnegative(e.amount,"효과 크기");
            if (e.type === "randomDamage") { nonnegative(e.min,"최소 피해"); nonnegative(e.max,"최대 피해"); if (e.max < e.min) fail("피해 범위 오류"); }
            if (e.type === "lockCards") { nonnegative(e.from,"시작 턴"); nonnegative(e.until,"종료 턴"); if (e.until < e.from) fail("금지 기간 오류"); }
            if (e.type === "scheduledDamage") { nonnegative(e.turns,"지속 턴"); if (!e.turns) fail("지속 턴은 1 이상이어야 합니다."); }
            if (e.type === "growMana" && !catalog.cards[e.cardId]) fail("최대 마나 토큰 정의가 없습니다.");
            if (e.target && ["self", "opponent", "both"].indexOf(e.target) < 0) fail("지원하지 않는 효과 대상");
            if ((e.type === "excludeSelf" || e.type === "removeFromRun" || e.type === "upgradeSelf") && e.target && e.target !== "self") fail("이 효과는 사용한 카드 자신에게만 적용할 수 있습니다.");
            if (e.type === "generate") {
                if (!catalog.cards[e.cardId]) fail("생성 카드 정의가 없습니다: " + e.cardId);
                if (e.amount !== undefined) nonnegative(e.amount, "생성 장수");
                if (e.zone && ["hand", "deck", "rest"].indexOf(e.zone) < 0) fail("지원하지 않는 생성 영역");
            }
        }
    }
    function validatePassives(passives) {
        var i;
        if (!Array.isArray(passives)) fail("지속 효과 배열이 필요합니다.");
        for (i = 0; i < passives.length; i++) {
            if (!passives[i]) fail("비어 있는 지속 효과입니다.");
            if (!own(PASSIVES, passives[i].type)) fail("지원하지 않는 지속 효과: " + passives[i].type);
            nonnegative(passives[i].amount, "지속 효과 크기");
        }
    }
    function validateHeroPower(power, catalog) {
        if (!power || !power.id || !power.name) fail("영웅 능력 정의가 필요합니다.");
        if (power.kind === "passive") { validatePassives(power.effects); return; }
        if (power.kind !== "active") fail("영웅 능력 유형 오류");
        nonnegative(power.cost,"영웅 능력 마나");
        if (power.usesPerTurn !== 1) fail("현재 사용형 영웅 능력은 턴당 1회만 지원합니다.");
        validateDefinition({element:"NEUTRAL",cost:power.cost,effects:power.effects},catalog);
        if (power.effects.some(function(e){ return ["heal","shield","damage","draw","discountRandomHand"].indexOf(e.type) < 0; })) fail("아직 지원하지 않는 영웅 능력 효과입니다.");
    }
    function passive(fighter, type) {
        var value = 0, i;
        for (i = 0; i < fighter.passives.length; i++) if (fighter.passives[i].type === type) value += fighter.passives[i].amount;
        return value;
    }
    function fighter(spec, catalog, rng) {
        var seen = {}, i, entry, f, maximum;
        nonnegative(spec.maxHp, "최대 체력");
        if (!spec.maxHp) fail("최대 체력은 1 이상이어야 합니다.");
        if (!Array.isArray(spec.deck)) fail("덱 배열이 필요합니다.");
        validatePassives(spec.passives || []);
        if (spec.heroPower) validateHeroPower(spec.heroPower,catalog);
        for (i = 0; i < spec.deck.length; i++) {
            entry = spec.deck[i];
            if (typeof entry.uid !== "string" || !entry.uid || own(seen, "$" + entry.uid)) fail("카드 식별자는 비어 있지 않고 고유해야 합니다.");
            seen["$" + entry.uid] = true;
            validateDefinition(describeCard(entry, catalog), catalog);
        }
        f = { name: spec.name, baseMaxHp: spec.maxHp, maxHp: spec.maxHp, hp: spec.maxHp,
            shield: 0, mana: 1, maxMana: 1, deck: shuffle(copy(spec.deck), rng),
            hand: [], rest: [], excluded: [], passives: copy(spec.passives || []),
            heroName:spec.heroName || null, heroPower:spec.heroPower ? copy(spec.heroPower) : null,
            heroPowerUsedTurn:-1, manaGrowth:0, overloadNext:0, status:{cardLocks:[],foresightTurns:[]},
            playedThisTurn:0, damageTakenThisTurn:0 };
        if (f.heroPower && f.heroPower.kind === "passive") f.passives = f.passives.concat(copy(f.heroPower.effects));
        maximum = spec.maxHp + passive(f, "maxHp"); f.maxHp = maximum; f.hp = maximum;
        if(spec.hp!==undefined){if(!A4.integer(spec.hp,1))fail('시작 체력이 올바르지 않습니다.');f.hp=Math.min(maximum,spec.hp);}
        f.shield = passive(f, "startingShield");
        return f;
    }
    function draw(f, count, rng) {
        var drawn = 0;
        while (drawn < count) {
            if (!f.deck.length) {
                if (!f.rest.length) break;
                f.deck = shuffle(f.rest, rng); f.rest = [];
            }
            var card=f.deck.pop();
            if (f.hand.length >= A4.HAND_LIMIT) f.excluded.push(card); else f.hand.push(card);
            drawn++;
        }
        return drawn;
    }
    function maximumMana(turn) { return Math.min(5, 1 + Math.floor(turn / 5)); }
    function cardsLocked(f, turn) { return f.status.cardLocks.some(function (lock) { return lock.from <= turn && turn <= lock.until; }); }
    function foresees(f,turn) { return f.status.foresightTurns.indexOf(turn) >= 0; }
    function openingHand(f,catalog,rng) {
        var innate=f.deck.filter(function(c){return describeCard(c,catalog).innate;}).slice(0,4), ids=innate.map(function(c){return c.uid;});
        f.deck=f.deck.filter(function(c){return ids.indexOf(c.uid) < 0;}); f.hand=innate;
        draw(f,4-f.hand.length,rng);
    }
    function fatigue(turn) { return turn < 30 ? 0 : 1 + (turn - 30); }
    function outcome(battle) {
        if (battle.player.hp <= 0) return "defeat";
        if (battle.enemy.hp <= 0) return "victory";
        return "ongoing";
    }
    function publicFighter(f) {
        return { name: f.name, maxHp: f.maxHp, hp: f.hp, shield: f.shield, mana: f.mana,
            maxMana: f.maxMana, handCount: f.hand.length, deckCount: f.deck.length,
            restCount: f.rest.length, excludedCount: f.excluded.length };
    }
    function opponentKnowledge(battle) {
        var information = publicFighter(battle.player), i;
        information.plays = [];
        for (i = 0; i < battle.history.length; i++) information.plays.push(copy(battle.history[i].player));
        return information;
    }
    function aiEffectValue(effect, enemy, opponent, count, anticipatedAttack) {
        var type = effect.type, target = effect.target || (["damage","randomDamage","scheduledDamage","lockCards"].indexOf(type) >= 0 ? "opponent" : "self");
        var amount = effect.amount === undefined ? 1 : effect.amount, selfValue = 0, otherValue = 0, isOther = target !== "self";
        if (type === "damage") {
            selfValue = -Math.min(enemy.hp + enemy.shield, amount) * 1.2;
            otherValue = Math.min(opponent.hp + opponent.shield, amount + passive(enemy, "damageBonus"));
        } else if (type === "heal") {
            selfValue = Math.min(enemy.maxHp - enemy.hp, amount) * 0.85;
            otherValue = -Math.min(opponent.maxHp - opponent.hp, amount) * 0.85;
        } else if (type === "shield") {
            selfValue = Math.min(anticipatedAttack, amount) * 0.8;
            otherValue = -Math.min(Math.max(1, enemy.mana * 2), amount) * 0.8;
        } else if (type === "draw") {
            selfValue = Math.min(amount, Math.max(0, A4.HAND_LIMIT - enemy.hand.length + count), enemy.deck.length + enemy.rest.length) * 0.8;
            otherValue = -Math.min(amount, Math.max(0, A4.HAND_LIMIT - opponent.handCount), (opponent.deckCount || 0) + (opponent.restCount || 0)) * 0.8;
        } else if (type === "generate") {
            selfValue = Math.min(amount, effect.zone && effect.zone !== "hand" ? amount : Math.max(0, A4.HAND_LIMIT - enemy.hand.length + count)) * 0.7;
            otherValue = -Math.min(amount, effect.zone && effect.zone !== "hand" ? amount : Math.max(0, A4.HAND_LIMIT - opponent.handCount)) * 0.7;
        } else if (type === "randomDamage") otherValue=(effect.min+effect.max)/2;
        else if (type === "scheduledDamage") otherValue=amount*effect.turns*0.7;
        else if (type === "dredge") selfValue=0.8;
        else if (type === "growMana") selfValue=enemy.maxMana<5 ? 3 : 0.8;
        else if (type === "foresight") selfValue=1;
        else if (type === "lockCards") otherValue=2;
        else if (type === "overload") selfValue=-amount*0.6;
        return target === "both" ? selfValue + otherValue : isOther ? otherValue : selfValue;
    }
     



    function planEnemy(enemy, publicOpponent, catalog, rng) {
        var weights = { ICE: 1, FIRE: 1, NATURE: 1, LIGHTNING: 1 }, total = 4;
        var i, j, k, entry, elements, observed, defs = [], masks = 1 << enemy.hand.length;
        var mask, cost, chosen, count, score, bestScore = -Infinity, best = [], e, def, probability, value;
        var anticipatedAttack = 1;
        for (i = 0; i < (publicOpponent.plays || []).length; i++) {
            observed = publicOpponent.plays[i];
            for (j = 0; j < observed.length; j++) {
                entry = observed[j];
                if (own(weights, entry.element)) { weights[entry.element]++; total++; }
            }
        }
        if ((publicOpponent.plays || []).length) anticipatedAttack = Math.max(1, Math.min(6, publicOpponent.mana * 2));
        for (i = 0; i < enemy.hand.length; i++) defs.push(describeCard(enemy.hand[i], catalog));
        for (mask = 0; mask < masks; mask++) {
            cost = 0; chosen = []; count = 0; elements = {};
            for (i = 0; i < defs.length; i++) if (mask & (1 << i)) {
                cost += defs[i].cost; chosen.push(enemy.hand[i].uid); count++; elements[defs[i].element] = true;
            }
            if (cost > enemy.mana || (enemy.cannotPlay && chosen.length)) continue;
            score = 0;
            for (i = 0; i < defs.length; i++) if (mask & (1 << i)) {
                def = defs[i]; probability = 0;
                if (publicOpponent.handCount > 0 && publicOpponent.mana > 0) {
                    for (k = 0; k < ELEMENTS.length; k++) if (COUNTERS[ELEMENTS[k]] === def.element || (def.vulnerable && ELEMENTS[k] === def.element)) probability += weights[ELEMENTS[k]] / total;
                }
                if (publicOpponent.currentPlays) probability=publicOpponent.currentPlays.some(function(c){return COUNTERS[c.element]===def.element || ((c.overpower || def.vulnerable) && c.element===def.element);}) ? 1 : 0;
                value = 0;
                for (j = 0; j < def.effects.length; j++) {
                    e = def.effects[j];
                    if (e.type === "upgradeSelf") value += enemy.hand[i].upgraded ? 0 : 0.5;
                    else value += aiEffectValue(e, enemy, publicOpponent, count, anticipatedAttack);
                }
                score += value * (1 - probability) - 0.03;  
            }
            for (k = 0; k < ELEMENTS.length; k++) if (elements[ELEMENTS[k]] && publicOpponent.handCount > 0) score += 1.5 * weights[COUNTERS[ELEMENTS[k]]] / total;
            if (score > bestScore + 0.000001) { bestScore = score; best = [chosen]; }
            else if (Math.abs(score - bestScore) < 0.000001) best.push(chosen);
        }
        return copy(best.length === 1 ? best[0] : best[rngIndex(rng, best.length)]);
    }
    function refreshPlan(battle, catalog, rng) {
        battle.enemy.cannotPlay=cardsLocked(battle.enemy,battle.turn);
        battle.enemyPlan = planEnemy(battle.enemy, opponentKnowledge(battle), catalog, rng);
        battle.enemyPlanTurn = battle.turn;
        battle.enemyPlanPhase=battle.phase;
        battle.enemyPlanDeferred=foresees(battle.enemy,battle.turn)&&!foresees(battle.player,battle.turn);
    }
    function create(playerSpec, enemySpec, catalog, rng) {
        var battle = { turn: 0, outcome: "ongoing", player: fighter(playerSpec, catalog, rng),
            enemy: fighter(enemySpec, catalog, rng), enemyPlan: [], enemyPlanTurn: 0,
            history: [], generatedCounter: 0, removedFromRun: [], lastLog: [], phase:'MAIN1', rulesVersion:2, scheduled:[], resolution:null, pendingChoice:null };
        openingHand(battle.player,catalog,rng); openingHand(battle.enemy,catalog,rng);
        refreshPlan(battle, catalog, rng);
        return battle;
    }
    function selections(f, uids, catalog, turn, usePower) {
        var seen = {}, selected = [], totalCost = 0, i, j, card, def;
        if (!Array.isArray(uids)) fail("사용할 카드 식별자 배열이 필요합니다.");
        if (uids.length && cardsLocked(f,turn)) fail("이번 턴에는 카드를 낼 수 없습니다. 영웅 능력은 사용할 수 있습니다.");
        for (i = 0; i < uids.length; i++) {
            if (typeof uids[i] !== "string" || own(seen, "$" + uids[i])) fail("같은 카드는 한 턴에 두 번 낼 수 없습니다.");
            seen["$" + uids[i]] = true; card = null;
            for (j = 0; j < f.hand.length; j++) if (f.hand[j].uid === uids[i]) { card = f.hand[j]; break; }
            if (!card) fail("손패에 없는 카드입니다: " + uids[i]);
            def = describeCard(card, catalog); validateDefinition(def, catalog);
            if (def.unplayable) fail("사용불가 카드입니다.");
            totalCost += def.cost; selected.push({ card: card, def: def, countered: false, excluded: !!def.excludeOnUse, removed: false });
        }
        if (usePower) {
            if (!f.heroPower || f.heroPower.kind !== 'active') fail("사용형 영웅 능력이 없습니다.");
            if (f.heroPowerUsedTurn === turn) fail("영웅 능력은 한 턴에 한 번만 사용할 수 있습니다.");
            totalCost += f.heroPower.cost;
        }
        if (totalCost > f.mana) fail("마나가 부족합니다.");
        return { cards: selected, cost: totalCost, heroPower:!!usePower };
    }
    function pay(f, selected) {
        var i, j;
        f.mana -= selected.cost;
        for (i = 0; i < selected.cards.length; i++) {
            for (j = f.hand.length - 1; j >= 0; j--) if (f.hand[j].uid === selected.cards[i].card.uid) f.hand.splice(j, 1);
        }
    }
    function targets(effect, source, opponent) {
        if (effect.target === "both") return [source, opponent];
        if (effect.target === "self") return [source];
        if (effect.target === "opponent" || effect.type === "damage") return [opponent];
        return [source];
    }
    function dealDamage(f, amount) {
        var blocked = Math.min(f.shield, amount);
        f.shield -= blocked; f.hp -= amount - blocked;
        f.damageTakenThisTurn += amount;
        return amount - blocked;
    }
    function newGeneratedUid(battle) {
        var used = {}, sides = [battle.player, battle.enemy], zones = ["deck", "hand", "rest", "excluded"], i, j, k, uid;
        for (i = 0; i < sides.length; i++) for (j = 0; j < zones.length; j++) for (k = 0; k < sides[i][zones[j]].length; k++) used["$" + sides[i][zones[j]][k].uid] = true;
        do { battle.generatedCounter++; uid = "generated:" + battle.generatedCounter; } while (own(used, "$" + uid));
        return uid;
    }
    function receive(f,card) { f[f.hand.length < A4.HAND_LIMIT ? 'hand' : 'excluded'].push(card); }
    function finishDredge(source,uid,catalog,rng,log) {
        var index=-1,i,card;
        for(i=0;i<source.deck.length;i++) if(source.deck[i].uid===uid) {index=i;break;}
        if(index<0) fail('발견한 카드가 덱에 없습니다.');
        card=source.deck.splice(index,1)[0]; source.deck.push(card);
        if(describeCard(card,catalog).cost <= source.mana) {draw(source,1,rng);log.push(source.name+': 선택한 카드를 드로우');}
        else log.push(source.name+': 선택한 카드를 덱 맨 위에 놓음');
    }
    function applyEffect(battle, selected, source, opponent, effect, catalog, rng, log) {
        var list = targets(effect, source, opponent), i, j, f, n, instance;
        if(effect.type==='discountRandomHand'){var eligible=source.hand.filter(function(x){return describeCard(x,catalog).cost>0;});if(eligible.length){instance=eligible[rngIndex(rng,eligible.length)];instance.costDelta=(instance.costDelta||0)-effect.amount;}return;}
        if(effect.type==='overload') {source.overloadNext+=effect.amount;log.push(source.name+': 다음 턴 과부하 '+effect.amount);return;}
        if(effect.type==='growMana') {
            if(source.maxMana>=5) receive(source,{uid:newGeneratedUid(battle),cardId:effect.cardId,upgraded:!!effect.upgraded,generated:true});
            else {source.manaGrowth+=effect.amount;source.maxMana=Math.min(5,maximumMana(battle.turn)+source.manaGrowth);}
            return;
        }
        if(effect.type==='lockCards') {opponent.status.cardLocks.push({from:battle.turn+effect.from,until:battle.turn+effect.until});log.push(opponent.name+': 카드 사용 금지');return;}
        if(effect.type==='foresight') {source.status.foresightTurns.push(battle.turn+1);return;}
        if(effect.type==='scheduledDamage') {
            for(i=1;i<=effect.turns;i++) battle.scheduled.push({turn:battle.turn+i,type:'damage',source:source===battle.player?'player':'enemy',target:source===battle.player?'enemy':'player',amount:effect.amount});
            return;
        }
        if(effect.type==='randomDamage') {n=effect.min+rngIndex(rng,effect.max-effect.min+1)+passive(source,'damageBonus');dealDamage(opponent,n);log.push(opponent.name+': 피해 '+n);return;}
        if(effect.type==='dredge') {
            var options=source.deck.slice(0,effect.amount);
            if(!options.length) {log.push(source.name+': 덱에 발견할 카드가 없음');return;}
            if(source===battle.player) {battle.pendingChoice={kind:'dredge',options:copy(options)};return;}
            var affordable=options.filter(function(c){return describeCard(c,catalog).cost<=source.mana;});
            var chosen=(affordable.length?affordable:options)[0];
            finishDredge(source,chosen.uid,catalog,rng,log);return;
        }
        if (effect.type === "excludeSelf") { selected.excluded = true; return; }
        if (effect.type === "removeFromRun") {
            selected.excluded = true; selected.removed = true;
            if (source === battle.player && battle.removedFromRun.indexOf(selected.card.uid) < 0) battle.removedFromRun.push(selected.card.uid);
            return;
        }
        if (effect.type === "upgradeSelf") {
            if (!selected.card.upgraded && !selected.def.treasure && selected.def.upgrade) selected.card.upgraded = true;
            return;
        }
        for (i = 0; i < list.length; i++) {
            f = list[i];
            if (effect.type === "damage") {
                n = effect.amount + (f === opponent ? passive(source, "damageBonus") : 0);
                n = dealDamage(f, n); log.push(f.name + ": 피해 " + n);
            } else if (effect.type === "heal") {
                n = Math.min(effect.amount, Math.max(0, f.maxHp - f.hp)); f.hp += n; log.push(f.name + ": 회복 " + n);
            } else if (effect.type === "shield") { f.shield += effect.amount; log.push(f.name + ": 보호막 +" + effect.amount); }
            else if (effect.type === "draw") { n = draw(f, effect.amount, rng); log.push(f.name + ": " + n + "장 드로우"); }
            else if (effect.type === "generate") {
                n = effect.amount === undefined ? 1 : effect.amount;
                for (j = 0; j < n; j++) {
                    instance = { uid: newGeneratedUid(battle), cardId: effect.cardId, upgraded: false, generated: true };
                    validateDefinition(describeCard(instance, catalog), catalog);
                    if(!effect.zone || effect.zone==='hand') receive(f,instance); else f[effect.zone].push(instance);
                }
                log.push(f.name + ": 카드 " + j + "장 생성");
            }
        }
    }
    function record(selected) {
        var records = [], i, entry;
        for (i = 0; i < selected.length; i++) {
            entry = selected[i]; records.push({ cardId: entry.card.cardId, name: entry.def.name,
                element: entry.def.element || "NEUTRAL", upgraded: !!entry.card.upgraded, countered: entry.countered });
        }
        return records;
    }
    function nextTurn(battle, catalog, rng, log) {
        var sides = [battle.player, battle.enemy], i, f, damage;
        battle.turn++; battle.phase='STANDBY'; damage = fatigue(battle.turn);
        for (i = 0; i < sides.length; i++) {
            f = sides[i]; f.maxMana = Math.min(5,maximumMana(battle.turn)+f.manaGrowth);
            f.mana = Math.max(0,f.maxMana-f.overloadNext); f.overloadNext=0; f.playedThisTurn=0; f.damageTakenThisTurn=0;
            f.status.cardLocks=f.status.cardLocks.filter(function(lock){return lock.until>=battle.turn;});
            f.status.foresightTurns=f.status.foresightTurns.filter(function(turn){return turn>=battle.turn;});
            draw(f,1+passive(f,'turnDrawBonus'),rng);
        }
        var scheduled=battle.scheduled.filter(function(event){return event.turn===battle.turn;});
        battle.scheduled=battle.scheduled.filter(function(event){return event.turn>battle.turn;});
        for(i=0;i<scheduled.length;i++) {
            var event=scheduled[i],target=battle[event.target];
            dealDamage(target,event.amount+passive(battle[event.source],'damageBonus'));log.push(target.name+': 천둥 피해 '+event.amount);
        }
        for(i=0;i<sides.length;i++) {
            f=sides[i];
            if (damage) { f.hp -= damage; log.push(f.name + ": 탈진 피해 " + damage); }
        }
        battle.outcome = outcome(battle);
        if (battle.outcome !== "ongoing") { battle.enemyPlan = []; return; }
        battle.phase='MAIN1';
        refreshPlan(battle, catalog, rng);
    }
    function result(battle,log,removed) {return {outcome:battle.outcome,log:copy(log),turn:battle.turn,phase:battle.phase,pending:!!battle.pendingChoice,removedFromRun:removed || []};}
    function continueResolution(battle,catalog,rng) {
        var r=battle.resolution, sides=[battle.player,battle.enemy], task,entry,effect,i,j,removed;
        while(r.cursor<r.queue.length) {
            task=r.queue[r.cursor++];
            entry=task.hero?{def:sides[task.side].heroPower}:r.groups[task.side][task.card];
            effect=entry.def.effects[task.effect];
            applyEffect(battle,entry,sides[task.side],sides[1-task.side],effect,catalog,rng,r.log);
            if(battle.pendingChoice) {battle.lastLog=copy(r.log);return result(battle,r.log,[]);}
        }
        for(i=0;i<2;i++) for(j=0;j<r.groups[i].length;j++) {
            entry=r.groups[i][j];sides[i][entry.excluded?'excluded':'rest'].push(entry.card);
        }
        battle.history.push({turn:battle.turn,phase:battle.phase,player:record(r.groups[0]),enemy:record(r.groups[1])});
        removed=battle.removedFromRun.slice(r.previousRemovals);
        battle.resolution=null;
        battle.outcome=outcome(battle);
        if(battle.outcome==='ongoing') {
            if(battle.phase==='MAIN1') {battle.phase='MAIN2';refreshPlan(battle,catalog,rng);}
            else {battle.phase='END';nextTurn(battle,catalog,rng,r.log);}
        } else battle.enemyPlan=[];
        battle.lastLog=copy(r.log);return result(battle,r.log,removed);
    }
    function choose(battle,index,catalog,rng) {
        if(!battle.pendingChoice || !battle.resolution) fail('진행 중인 전투 선택지가 없습니다.');
        nonnegative(index,'선택 번호');
        if(index<1 || index>battle.pendingChoice.options.length) fail('선택 번호가 올바르지 않습니다.');
        var option=battle.pendingChoice.options[index-1];
        finishDredge(battle.player,option.uid,catalog,rng,battle.resolution.log);
        battle.pendingChoice=null;
        return continueResolution(battle,catalog,rng);
    }
    function submit(battle, playerUids, catalog, rng, options) {
        var p, e, groups, sides, i, j, k, stage, entry, effect, log = [], queue=[];
        options=options || {};
        if (battle.outcome !== "ongoing") fail("이미 종료된 전투입니다.");
        if(battle.pendingChoice || battle.resolution) fail('먼저 진행 중인 카드 선택을 완료하세요.');
        if (battle.enemyPlanTurn !== battle.turn || battle.enemyPlanPhase!==battle.phase || !Array.isArray(battle.enemyPlan)) fail("저장된 상대 행동이 없습니다. 전투 상태를 확인해야 합니다.");
        p = selections(battle.player, playerUids, catalog,battle.turn,options.heroPower);
        if(battle.enemyPlanDeferred&&!foresees(battle.player,battle.turn)) {
            var known=opponentKnowledge(battle);known.currentPlays=p.cards.map(function(c){return {element:c.def.element,overpower:!!c.def.overpower};});
            battle.enemyPlan=planEnemy(battle.enemy,known,catalog,rng);
        }
        e = selections(battle.enemy, battle.enemyPlan, catalog,battle.turn,false);
        pay(battle.player, p); pay(battle.enemy, e);
        battle.player.playedThisTurn+=p.cards.length; battle.enemy.playedThisTurn+=e.cards.length;
        if(p.heroPower) {battle.player.heroPowerUsedTurn=battle.turn;log.push(battle.player.name+': 영웅 능력 '+battle.player.heroPower.name+' 사용');}
        for (i = 0; i < p.cards.length; i++) for (j = 0; j < e.cards.length; j++) {
            if (COUNTERS[p.cards[i].def.element] === e.cards[j].def.element || ((p.cards[i].def.overpower || e.cards[j].def.vulnerable) && p.cards[i].def.element===e.cards[j].def.element)) {e.cards[j].countered = true;p.cards[i].didCounter=true;}
            if (COUNTERS[e.cards[j].def.element] === p.cards[i].def.element || ((e.cards[j].def.overpower || p.cards[i].def.vulnerable) && p.cards[i].def.element===e.cards[j].def.element)) {p.cards[i].countered = true;e.cards[j].didCounter=true;}
        }
        groups = [p.cards, e.cards]; sides = [battle.player, battle.enemy];
        for (i = 0; i < 2; i++) {
            if (!groups[i].length) log.push(sides[i].name + ": 카드 사용 없음");
            for (j = 0; j < groups[i].length; j++) {
                entry = groups[i][j];
                log.push(sides[i].name + ": " + entry.def.name + (entry.countered ? " [카운터됨]" : " 사용"));
                if (!entry.countered && entry.def.activationText) log.push(String(entry.def.activationText));
            }
        }
         
         
        for (stage = 0; stage < 2; stage++) for (i = 0; i < 2; i++) for (j = 0; j < groups[i].length; j++) {
            entry = groups[i][j];
            if (entry.countered) continue;
            for (k = 0; k < entry.def.effects.length; k++) {
                effect = entry.def.effects[k];
                if ((effect.type === "shield" || effect.type === "heal") !== (stage === 0)) continue;
                if(effect.critical && !entry.didCounter) continue;
                queue.push({side:i,card:j,effect:k});
            }
        }
        if(p.heroPower) {
            for(k=battle.player.heroPower.effects.length-1;k>=0;k--) {
                effect=battle.player.heroPower.effects[k];
                if(effect.type==='heal' || effect.type==='shield') queue.unshift({side:0,hero:true,effect:k});
                else queue.push({side:0,hero:true,effect:k});
            }
        }
        battle.resolution={groups:groups,queue:queue,cursor:0,log:log,previousRemovals:battle.removedFromRun.length};
        return continueResolution(battle,catalog,rng);
    }
    function publicView(battle) {
        var view={ turn: battle.turn,phase:battle.phase, outcome: battle.outcome, player: copy(battle.player),
            enemy: publicFighter(battle.enemy), history: copy(battle.history), lastLog: copy(battle.lastLog) };
        view.enemyReacting=foresees(battle.enemy,battle.turn)&&!foresees(battle.player,battle.turn);
        if(foresees(battle.player,battle.turn)&&!foresees(battle.enemy,battle.turn)) {
            view.enemyReacting=!!battle.enemyPlanDeferred;
            if(!battle.enemyPlanDeferred) view.foreseenCards=battle.enemyPlan.map(function(uid){return copy(battle.enemy.hand.filter(function(c){return c.uid===uid;})[0]);});
        }
        return view;
    }
    function syncPassives(battle, playerPassives) {
        var p = battle.player;
        validatePassives(playerPassives);
        p.passives = copy(playerPassives); p.maxHp = p.baseMaxHp + passive(p, "maxHp");
        if(p.heroPower && p.heroPower.kind==='passive') {p.passives=p.passives.concat(copy(p.heroPower.effects));p.maxHp=p.baseMaxHp+passive(p,'maxHp');}
         
         
        p.hp = Math.min(p.hp, p.maxHp);
    }
    return { create: create, submit: submit, choose:choose, publicView: publicView, syncPassives: syncPassives,
        describeCard: describeCard, planEnemy: planEnemy, maximumMana: maximumMana,
        validateCard: function (instance, catalog) { validateDefinition(describeCard(instance, catalog), catalog); },
        validatePassives: validatePassives,
        validateHeroPower:validateHeroPower,
        fatigue: fatigue, supportedEffects: Object.keys(EFFECTS), supportedPassives: Object.keys(PASSIVES) };
}());

// ---- src/cards-v3.js ----
 



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
    case '태양 작렬':status(ctx,enemy,'solar',{until:now+1,amount:0,burst:up?15:10,sourceSide:side,sourceCard:ctx.copy(card)});break;
    case '화염 장막':status(ctx,side,'flameVeil',{until:now+1,amount:up?5:3,sourceCard:ctx.copy(card)});break;
    case '점화':damage(ctx,enemy,5+(s.ignite||0));s.ignite=(s.ignite||0)+5;break;
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
    case '얼어붙은 버클러':ctx.shield(side,10);later(ctx,now+(up?3:2),'STANDBY','loseShield',{amount:10});break;
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
    case '치유의 손길':ctx.heal(side,up?15:10);break;
    case '먹음직스러운 덥석멜론':[2,3,4,5].forEach(function(cost){draw(ctx,side,1,function(d,c){return ctx.cost(side,c)===cost;});});break;
    case '풍요':ctx.heal(side,up?14:7);draw(ctx,side,2);break;
    case '굽이치는 파도':amount=damage(ctx,enemy,up?8:5);if(typeof amount==='object')amount=amount.amount;ctx.heal(side,typeof amount==='number'?amount:(up?8:5));break;
    case '기적같은 성장':list=draw(ctx,side,Math.max(0,ctx.limit(side)-f.hand.length));amount=list.reduce(function(sum,x){return sum+ctx.cost(side,x);},0);ctx.heal(side,amount*(up?2:1));break;
    case '자연화':draw(ctx,enemy,up?1:2);break;
    case '폭풍 인도기':
      f.deck.slice().forEach(function(x){if(!x.upgraded&&(ctx.catalog.cardPool||ordinary).indexOf(x.cardId)>=0&&isGeneral(ctx,x)){var id=ctx.pick(pool(ctx));x.cardId=id;x.upgraded=true;costDrop(ctx,x,up?2:1,1);}});break;
    case '접붙이기':amount=0;foe.rest.slice().forEach(function(x){amount+=ctx.cost(enemy,x);ctx.move(enemy,x.uid,'excluded');});ctx.heal(side,Math.floor(amount*(up?1:0.5)));break;
    case '찌릿!':damage(ctx,enemy,up?5:3);if(f.hand.some(function(x){return element(ctx,x)==='LIGHTNING';}))draw(ctx,side,1,function(d){return d.element==='LIGHTNING';});break;
    case '선조의 지혜':ctx.overload(side,1);draw(ctx,side,up?3:2);break;
    case '부스터 팩':for(i=0;i<3;i++)randomCard(ctx,side,null,{upgraded:up||i===0});break;
    case '초과 인출':amount=(f.overloadNext||0)+(f.overloadLocked||0);f.overloadNext=0;ctx.mana(side,f.overloadLocked||0,true);f.overloadLocked=0;draw(ctx,side,amount);break;
    case '전선':ids=pool(ctx,function(d){return /발견/.test(d.text);},card.cardId).filter(function(id){return !up||ctx.canAutoCast({cardId:id,upgraded:false});});discover(ctx,side,ids.map(function(id){return option(ctx,id,false);}),up?'generateCast':'generateChoice');break;
    case '믹스테이프':fromZone(ctx,side,enemy,'deck','copyChoice',{discount:up?1:0});break;
    case '전류 공급':draw(ctx,side,1);s.currentStacks++;if(s.currentStacks>=2){s.currentStacks-=2;s.lightningBonus+=2;}break;
    case '긴급 차단':fromZone(ctx,side,enemy,'hand','intercept',{upgraded:up});break;
    case '천둥':for(i=1;i<=3;i++)later(ctx,now+i,'STANDBY','damage',{amount:up?4:2,target:enemy});break;
    case '파지직':ctx.overload(side,1);damage(ctx,enemy,(up?14:7)+Math.floor(ctx.rng()*(up?5:3)));break;
    case '마비':list=(foe.usedThisTurn||[]).filter(function(x){return !x.free;}).map(function(x){return x.def?x.def.element:element(ctx,x.card||x);});status(ctx,enemy,'forbiddenElements',{until:now+3,elements:list});break;
    case '단락':fromZone(ctx,side,side,'deck','shortCircuit');break;
    case '무덤의 지명자':fromZone(ctx,side,enemy,'rest','grave',{upgraded:up});break;
    case '충전':later(ctx,now+1,'STANDBY','charge');break;
    case '번개':lock(ctx,enemy,up?0:1,1);status(ctx,enemy,'immune',{from:now+1,until:now+1});break;
    case '연쇄 번개':if(up)draw(ctx,side,1);count=Math.max(1,s.lightningStreak||1);for(i=0;i<count;i++)damage(ctx,enemy,5);break;
    case '마법공학: 퓨즈':case '마법공학: 니비루': break;  
    case '고철 더미에서':if((f.lastTurnCards||[]).some(function(x){return (x.def?x.def.element:element(ctx,x.card||x))==='LIGHTNING'&&!x.free;})){
      ids=Object.keys(ctx.catalog.treasures).filter(function(id){var d=ctx.catalog.treasures[id];return !d.retired&&(!d.classId||d.classId===f.heroId)&&d.kind==='card'&&d.tier===(up?'high':'low');});
      discover(ctx,side,ids.map(function(id){var x=option(ctx,ctx.catalog.treasures[id].cardId,false);x.treasureId=id;return x;}),'treasureChoice');}break;
    case '두꺼비집':status(ctx,enemy,'elementOverride',{from:now+(up?0:1),until:now+1,element:'LIGHTNING'});break;
    case '기도':ids=pool(ctx,function(d){return d.element==='HOLY';},card.cardId);discover(ctx,side,ids.map(function(id){return option(ctx,id,false);}), 'prayer',{remaining:up?2:1});break;
    case '윤회':draw(ctx,side,up?2:1);fromZone(ctx,side,side,'deck','cycle',{remaining:2});break;
    case '운명':ids=pool(ctx).filter(function(id){return ctx.canAutoCast({cardId:id,upgraded:true});});if(ids.length)ctx.cast(side,{cardId:ctx.pick(ids),upgraded:true},{free:true,copy:true});break;
    case '예지':if(up)fromZone(ctx,side,side,'deck','take',{remaining:1},function(x){return ctx.cost(side,x)===3;});else draw(ctx,side,1,function(d,x){return ctx.cost(side,x)===3;});break;
    case '안도':if(!(s.previousDamage||0)){draw(ctx,side,up?2:1);ctx.heal(side,4);}break;
    case '심판':count=f.rest.filter(function(x){return element(ctx,x)==='HOLY';}).length;damage(ctx,enemy,count*(up?3:2));break;
    case '계시':fromZone(ctx,side,enemy,'hand','revelation',{upgraded:up});break;
    case '배교':damage(ctx,enemy,t.critical?(up?12:6):(up?6:3));break;
    case '황금궤':ids=pool(ctx,null,card.cardId);discover(ctx,side,ids.map(function(id){return option(ctx,id,true);}), 'golden',{delay:up?1:3});break;
    case '필연':ids=pool(ctx).filter(function(id){return ctx.canAutoCast({cardId:id,upgraded:false});});if(ids.length)for(i=0;i<(up?3:2);i++)ctx.cast(side,{cardId:ctx.pick(ids),upgraded:false},{free:true,copy:true});break;
    case '불굴':status(ctx,side,up?'immune':'immuneCards',{until:now});break;
    case '성전':draw(ctx,side,1);lock(ctx,side,0,up?2:1,['HOLY']);lock(ctx,enemy,0,up?2:1,['HOLY']);break;
    case '성지순례':status(ctx,side,'pilgrimage',{amount:up?2:1,sourceCard:ctx.copy(card)});break;
    case '축성':ctx.sample(f.rest.filter(function(x){return !x.upgraded&&(isGeneral(ctx,x)||x.cardId==='crystal_ball'||x.originalCardId==='crystal_ball');}),5).forEach(function(x){ctx.upgrade(x);});if(up)fromZone(ctx,side,side,'rest','take',{remaining:1});else if(f.rest.length)ctx.move(side,ctx.pick(f.rest).uid,'hand');break;
    case '신의 권능: 가속':case '신의 권능: 재생':case '신의 권능: 징벌':case '신의 권능: 성역':case '신의 권능: 응징':break;  
    case '넘치는 마나':draw(ctx,side,up?2:1);break;
    case '혹한':case '고드름':case '저주':break;  
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
    case 'solarBurst':ctx.damage(side,t.target,t.amount,{card:t.card});draw(ctx,side,1);break;
    case 'coldDiscard':if(!t.upgraded)draw(ctx,side,1);draw(ctx,enemy,1);break;
    case 'iceTrap':status(ctx,enemy,'iceTrap',{from:b.turn+1,until:b.turn+1,element:selected.id,all:t.upgraded,sourceSide:side});break;
    case 'hibernate':if(ctx.find(t.owner,selected.uid)){ctx.move(t.owner,selected.uid,t.upgraded?'rest':'deck');if(!t.upgraded)ctx.shuffle(ctx.fighter(t.owner).deck);}break;
    case 'northern':c=movedToHand(ctx,side,t.owner,selected);if(c&&element(ctx,c)==='ICE')lock(ctx,enemy,t.upgraded?0:1,1,['ICE']);break;
    case 'take':
      movedToHand(ctx,side,t.owner,selected);
      if(t.remaining>1)fromZone(ctx,side,t.owner,t.zone,'take',{remaining:t.remaining-1});break;
    case 'dredge':
      c=ctx.remove(side,selected.uid);if(c){f.deck.unshift(c);if(ctx.cost(side,c)<=f.mana)draw(ctx,side,1);}break;
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
        if(x.rule==='신의 권능: 징벌')ctx.damage(side,enemy,5,{card:x.card});
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

// ---- src/treasures-v3.js ----
 
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
    case 'starlight_disassembler': return true;  
    case 'destruction_orb':
      foe.manaGrowth=(foe.manaGrowth||0)-1; foe.maxMana=Math.max(0,foe.maxMana-1); foe.mana=Math.min(foe.mana,foe.maxMana);
      ctx.sample(foe.hand,2).forEach(function(c){ctx.move(enemy,c.uid,'rest');});
      return true;
    case 'roasting_wand':
       
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

// ---- src/bosses-v3.js ----
 
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

// ---- src/keywords.js ----
 
A4.Keywords=(function(){
  'use strict';
  var descriptions={rune:'룬: 발동하면 레스트로 이동하지 않고 효과가 유지됩니다. 캐릭터마다 하나만 유지하며, 다른 룬이 발동하면 기존 룬을 레스트로 보냅니다. 새 룬이 카운터당하면 기존 룬을 유지합니다.',power:'위력: 내 카드의 피해량과 회복량을 고정된 수치만큼 증가시킵니다.',bloodstone:'혈석: 아감마간의 고유 자원입니다. 최대 5개까지 보유하며 스탠바이 페이즈에 회복되지 않고 누적됩니다.',dagger:'단검: 각 단검은 소모되면 피해를 4 주며 최대 5개까지 보유할 수 있습니다.',sunrise:'해오름: 메인 페이즈 1에 추가 효과가 발동합니다.',dusk:'어스름: 메인 페이즈 2에 추가 효과가 발동합니다.',disarm:'무장해제: 이 캐릭터는 방어도를 획득할 수 없습니다.',degrade:'열화: 강화된 카드가 강화되기 전으로 되돌아갑니다.',dredge:'인양: 내 덱 맨 밑에 있는 카드 3장을 미리 봅니다. 1장을 선택해 덱 맨 위에 놓습니다.',unstable:'불안정: 이 카드는 같은 속성의 카드에도 카운터당합니다.',volatile:'휘발성: 이 카드가 손에 있으면 엔드 페이즈시에 게임에서 제외됩니다.',vulnerable:'취약: 이 캐릭터는 피해를 받을 때 50%의 피해를 추가로 입습니다. 소수점은 버립니다.',weakened:'약화: 이 캐릭터는 가하는 피해량이 25% 감소합니다. 소수점은 버립니다.',shock:'감전: 상대의 손에서 최대 마나 이하 비용인 사용 가능한 무작위 카드들을 다음 턴의 엔드 페이즈시까지 사용할 수 없게 만듭니다.',sinking:'침몰: 내 덱에 남은 카드가 0장이 된 적이 있으면, 추가 효과가 발동합니다.',discardBottom:'폐기: 내 덱 맨 아래에서 카드 X장을 레스트로 보냅니다.',execution:'처형: 매 턴의 스탠바이 페이즈시에, 대상의 체력이 처형 중첩보다 낮으면 처형합니다. 처형되지 않으면 처형 중첩이 1 감소합니다.',liberation:'해방: 이 카드는 조건을 만족하기 전까지 사용할 수 없습니다. 손에 있는 동안 조건을 충족하면 해방되며 레스트로 이동하면 초기화됩니다.',orbit:'궤도: 이 카드가 손에 있을 때, 다른 카드를 일정 수만큼 사용했으면 추가 효과가 발동합니다.',awakening:'각성: 내 최대 마나가 5에 도달한 적이 있으면, 추가 효과가 발동합니다.'};
  function observe(f){if(A4.TreasureRules&&A4.TreasureRules.owns(f,'icarus_wings')){f.maxMana=3;f.mana=Math.min(5,f.mana);}f.status=f.status||{};if(!f.deck.length)f.status.deckEmptied=true;if(f.maxMana>=5)f.status.awakened=true;}
  function effects(f){f.status.cards=f.status.cards||{effects:[]};return f.status.cards.effects||(f.status.cards.effects=[]);}
  function active(f,kind,b){return ((f.status.cards||{}).effects||[]).some(function(e){return e.kind===kind&&(e.from===undefined||e.from<=b.turn)&&(e.until===undefined||e.until>=b.turn);});}
  function condition(ctx,side,card,test){
    var f=ctx.fighter(side);observe(f);if(test===true)return true;if(!test)return false;
    if(test.type==='sunrise'||test.type==='dusk')return (ctx.battle.resolution&&ctx.battle.resolution.phase||ctx.battle.phase)===(test.type==='sunrise'?'MAIN1':'MAIN2');
    if(test.type==='sinking')return !!f.status.deckEmptied;
    if(test.type==='awakening')return !!f.status.awakened;
    if(test.type==='turn')return ctx.battle.turn+1>=test.amount;
    if(test.type==='hpBelow')return f.hp<test.amount;
    if(test.type==='played')return f.playedThisTurn>=test.amount;
    if(test.type==='orbit')return (card.orbitCount||0)>=test.amount;
    if(test.all)return test.all.every(function(x){return condition(ctx,side,card,x);});
    if(test.any)return test.any.some(function(x){return condition(ctx,side,card,x);});
    return false;
  }
  function liberated(ctx,side,card,test){if(card.liberationReady)return true;if(test&&(test.type==='heroPowerUsed'||test.type==='played'))return false;if(condition(ctx,side,card,test)){card.liberationReady=true;return true;}return false;}
  function enqueue(ctx,side,list,card){(list||[]).forEach(function(e){ctx.enqueue({kind:'effect',side:side,card:card||null,effect:ctx.copy(e)});});}
  function effect(ctx,t){
    var e=t.effect,side=t.side,other=side==='player'?'enemy':'player',target=e.target==='self'?side:other,f=ctx.fighter(target),b=ctx.battle,n=Math.max(0,Math.floor(e.amount||0)),card;
    if(e.type==='sunrise'||e.type==='dusk'){if(condition(ctx,side,t.card,{type:e.type}))enqueue(ctx,side,e.effects,t.card);return true;}
    if(e.type==='power'){f=ctx.fighter(side);f.status.classes=f.status.classes||{};f.status.classes.powerBonus=(f.status.classes.powerBonus||0)+n;return true;}
    if(e.type==='bloodstone'){f=ctx.fighter(side);f.bloodstones=Math.min(5,(f.bloodstones||0)+n);ctx.runChange({type:'bloodstones',side:side,amount:f.bloodstones});return true;}
    if(e.type==='dagger'){f=ctx.fighter(side);f.daggers=Math.min(5,(f.daggers||0)+n);return true;}
    if(e.type==='consumeDaggers'){f=ctx.fighter(side);var spent=Math.min(f.daggers||0,e.amount===undefined?5:n);f.daggers=(f.daggers||0)-spent;for(var d=0;d<spent;d++)ctx.damage(side,other,4,{card:null,noBonus:true});return true;}
    if(['disarm','vulnerable','weakened'].indexOf(e.type)>=0){if(ctx.modify('harmfulEffect',{side:target,kind:e.type,cancel:false}).cancel)return true;var status={kind:e.type,from:b.turn};if(e.turns!==undefined)status.until=b.turn+Math.max(0,e.turns);effects(f).push(status);return true;}
    if(e.type==='degrade'){
      if(ctx.modify('harmfulEffect',{side:target,kind:'degrade',cancel:false}).cancel)return true;
      var zones=e.zones||['hand'];zones.forEach(function(zone){(f[zone]||[]).forEach(function(x){if(e.uid&&x.uid!==e.uid)return;x.upgraded=false;if(x.originalCardId==='crystal_ball')x.crystalUpgraded=false;delete x.revertUpgradeTurn;});});return true;
    }
    if(e.type==='shock'){
      if(ctx.modify('harmfulEffect',{side:target,kind:'shock',cancel:false}).cancel)return true;
      var available=f.hand.filter(function(x){return A4.Battle.cardAllowed(b,target,ctx.catalog,x)&&ctx.cost(target,x)<=f.maxMana;});
      for(var i=0;i<n&&available.length;i++){card=ctx.pick(available);available.splice(available.indexOf(card),1);card.shockedUntil=Math.max(card.shockedUntil===undefined?-1:card.shockedUntil,b.turn+1);}return true;
    }
    if(e.type==='dredgeKeyword'){var owner=ctx.fighter(side);ctx.choose(side,owner.deck.slice(-3),{module:'keywords',op:'dredge',side:side},{label:'인양',sourceZone:'deck'});return true;}
    if(e.type==='discardBottom'){
      f=ctx.fighter(side);for(var j=0;j<n&&f.deck.length;j++)ctx.move(side,f.deck[f.deck.length-1].uid,'rest');observe(f);return true;
    }
    if(e.type==='execution'){if(ctx.modify('harmfulEffect',{side:target,kind:'execution',cancel:false}).cancel)return true;f.status.execution=(f.status.execution||0)+n;return true;}
    if(e.type==='sinking'||e.type==='awakening'){f=ctx.fighter(side);observe(f);if(e.type==='sinking'?f.status.deckEmptied:f.status.awakened)enqueue(ctx,side,e.effects,t.card);return true;}
    return false;
  }
  function modify(ctx,what,data){
    if(what==='cardUsable'){
      if(data.card.shockedUntil!==undefined&&data.card.shockedUntil>=ctx.battle.turn){data.allowed=false;data.reason='감전으로 사용할 수 없는 카드입니다.';}
      if(data.def.liberation&&!liberated(ctx,data.side,data.card,data.def.liberation)){data.allowed=false;data.reason='해방 조건을 만족하지 않았습니다.';}
    }
  }
  function hook(ctx,e){
    var b=ctx.battle;
    ['player','enemy'].forEach(function(side){var f=ctx.fighter(side);observe(f);
      if(e.type==='standby'&&f.status.execution>0&&f.status.executionTurn!==b.turn){
        f.status.executionTurn=b.turn;
        if(f.hp<f.status.execution){f.hp=0;ctx.note('text',side,0,{text:f.name+' 처형.'});}
        else f.status.execution--;
      }
      if((e.type==='cardUsed'||e.type==='powerUsed')&&e.side===side){f.hand.forEach(function(x){var d=ctx.def(x),rule=d.liberation;if(!rule||x.liberationReady||e.card&&e.card.uid===x.uid)return;if(rule.type==='heroPowerUsed'&&e.type==='powerUsed'||rule.type==='played'&&e.type==='cardUsed'&&!e.free){x.liberationProgress=(x.liberationProgress||0)+1;if(x.liberationProgress>=(rule.amount||1))x.liberationReady=true;}});}
      if(e.type==='cardUsed'&&e.side===side){f.hand.forEach(function(x){if(e.card&&e.card.uid===x.uid)return;var d=ctx.def(x),orbit=d.orbit;if(!orbit||x.orbitTriggered)return;x.orbitCount=(x.orbitCount||0)+1;if(x.orbitCount>=orbit.count){x.orbitTriggered=true;enqueue(ctx,side,orbit.effects,x);}});}
      if(e.type==='afterEnd'){
        f.status.cards=f.status.cards||{effects:[]};f.status.cards.effects=effects(f).filter(function(x){return ['disarm','vulnerable','weakened'].indexOf(x.kind)<0||x.until===undefined||x.until>b.turn;});
        ['hand','deck','rest','excluded','inFlight'].forEach(function(zone){f[zone].forEach(function(x){if(x.shockedUntil!==undefined&&x.shockedUntil<=b.turn)delete x.shockedUntil;});});
      }
    });
  }
  return {run:function(ctx,t){if(t.module!=='keywords'||t.op!=='dredge')return false;var card=ctx.remove(t.side,t.choice.uid);if(card)ctx.fighter(t.side).deck.unshift(card);return true;},descriptions:descriptions,observe:observe,active:active,condition:condition,liberated:liberated,effect:effect,modify:modify,hook:hook};
}());

// ---- src/classes.js ----
 
A4.Classes=(function(){
 'use strict';
 var data=A4.content.classes,definitions={},treasures=[
 ['boar_altar','agamaggan','low','passive','멧돼지 제단','매 턴의 메인 페이즈 1에 영웅 능력이 자동으로 사용되지만, 지불하는 체력이 절반으로 감소합니다.'],
 ['dragon_pendant_card','celeste','low','card','용의 팬던트','내 손에 있는 모든 ‘수정구’를 강화합니다.'],
 ['dragon_pendant_passive','celeste','low','passive','용의 팬던트','‘탐구’가 ‘수정구+’를 가져오지만, 네 턴에 한 번씩 발동합니다.'],
 ['steadfast_soul','thekal','low','passive','굳건한 영혼','매 턴의 엔드 페이즈시에, 내 제단의 체력을 모두 회복시킵니다.'],
 ['loa_wrath','thekal','low','passive','로아의 분노','내 제단이 파괴되면, 카드를 뽑고 상대에게 피해를 6 줍니다.'],
 ['sacred_ritual','thekal','low','passive','신성한 의식','내 제단이 생존한 동안, 내 카드들의 비용이 (1) 감소합니다. 단, (1) 이하로 낮아지진 않습니다.'],
 ['loa_grace','thekal','low','passive','로아의 은총','내 제단이 파괴되면, 내 손에 있는 강화되지 않은 무작위 카드가 강화됩니다.'],
 ['loa_covenant','thekal','high','passive','로아의 서약','내 제단이 3턴이 아닌 2턴만에 부활합니다.'],
 ['majestic_presence','thekal','high','passive','위풍당당한 위용','내 제단이 파괴되면, 내 손에 있는 카드들의 비용이 (1) 감소합니다.'],
 ['grace_harvester','thekal','high','passive','은총 수확자','내 제단이 파괴될 때, 내 손이 가득 찰 때까지 카드를 뽑습니다.'],
 ['eternal_devotion','thekal','high','passive','영원한 헌신','게임이 시작할 때, 내 제단을 복사하여 소환합니다.']];
 function id(x){return 'class:'+x;}
 function state(f){return f.status.classes||(f.status.classes={});}
 function has(f,key){return f.startingTreasureId===key||(f.treasureIds||[]).indexOf(key)>=0||(f.passives||[]).some(function(x){return x.id===key||x.treasureId===key;});}
 function alive(f,key){return (f.shrines||[]).filter(function(x){return x.hp>0&&(!key||x.id===key);});}
 function task(side,op,extra){var t={kind:'class',module:'classes',side:side,op:op};Object.keys(extra||{}).forEach(function(k){t[k]=extra[k];});return t;}
 function pool(c,hero){var h=(c.heroes||[]).filter(function(x){return x.id===hero;})[0];return h?h.classPool||[]:[];}
 function options(c,ids){return ids.map(function(x){return {cardId:x,upgraded:false};});}
 function install(c){
  data.cards.forEach(function(ref){var d=A4.copy(ref),key=id(d.id);delete d.id;d.module='classes';d.rule=key;d.classCard=true;d.effects=[];d.innate=/先天性|선천성/.test(d.text);d.excludeOnUse=/일회용/.test(d.text);d.temporary=/^일시적/.test(d.text);if(d.upgrade){d.upgrade.module='classes';d.upgrade.rule=key;d.upgrade.innate=/선천성/.test(d.upgrade.text);d.upgrade.excludeOnUse=/일회용/.test(d.upgrade.text);d.upgrade.temporary=/^일시적/.test(d.upgrade.text);}c.cards[key]=d;definitions[key]=ref;});
  c.startingTreasures={};data.startingTreasures.forEach(function(x){c.startingTreasures[x.id]=A4.copy(x);});c.shrines={};data.shrines.forEach(function(x){c.shrines[x.id]=A4.copy(x);});
  c.heroes=data.heroes.map(function(x){var h=A4.copy(x);h.cards=h.cards.map(id);h.classPool=h.classPool.map(id);return h;});
  treasures.forEach(function(row){var t={id:row[0],classId:row[1],tier:row[2],kind:row[3],name:row[4],text:row[5]};if(t.kind==='card'){t.cardId=id(row[0]);c.cards[t.cardId]={name:t.name,element:'LIGHTNING',cost:0,text:t.text,treasure:true,treasureId:t.id,rule:t.cardId,module:'classes',effects:[]};definitions[t.cardId]={action:'pendant'};}else t.effects=[{type:'treasurePassive',id:t.id,treasureId:t.id,module:'classes'}];c.treasures[t.id]=t;});
  ['molten_bone','decay_potion'].forEach(function(key){c.treasures[key].classId='silent';});return c;
 }
 function summon(ctx,side,key){var f=ctx.fighter(side),ref=ctx.catalog.shrines[key];if(!ref)return;f.shrineId=key;f.shrines=[{id:key,name:ref.name,hp:ref.maxHp,maxHp:ref.maxHp}];if(has(f,'eternal_devotion'))f.shrines.push(ctx.copy(f.shrines[0]));}
 function copyHand(ctx,side,x,discount){if(!x)return null;return ctx.generate(side,x.cardId,{upgraded:!!x.upgraded,costDelta:(x.costDelta||0)-(discount||0),costFloor:0});}
 function getTreasure(ctx,side,permanent){var f=ctx.fighter(side),ids=Object.keys(ctx.catalog.treasures).filter(function(k){var t=ctx.catalog.treasures[k];return t.tier==='low'&&(!t.classId||t.classId===f.heroId)&&(f.treasureIds||[]).indexOf(k)<0;});var key=ctx.pick(ids);if(!key)return;var t=ctx.catalog.treasures[key];if(t.kind==='card'){var card=ctx.generate(side,t.cardId);if(permanent)ctx.runChange({type:'addTreasure',side:side,treasureId:key,card:card,cardUid:card.uid});}else{f.treasureIds.push(key);f.passives=f.passives.concat(ctx.copy(t.effects));if(permanent)ctx.runChange({type:'addTreasure',side:side,treasureId:key});}}
 function castDeck(ctx,side,zero,n,twice){var f=ctx.fighter(side);ctx.sample(f.deck.filter(function(x){return ctx.canAutoCast(x)&&(!zero||ctx.cost(side,x)===0)&&x.uid!==(ctx.task.card||{}).uid;}),n).forEach(function(x){ctx.move(side,x.uid,'inFlight');ctx.cast(side,x,{copy:false});if(twice)ctx.cast(side,x,{copy:true});});}
 function discard(ctx,side,n){A4.Keywords.effect(ctx,{side:side,effect:{type:'discardBottom',amount:n}});}
 function chooseMove(ctx,side,owner,zone,n){var f=ctx.fighter(owner);if(f[zone].length)ctx.discover(side,f[zone].slice(),task(side,'moveChoice',{owner:owner,zone:zone,remaining:n}),{sourceZone:zone});}
 function run(ctx,t){
  if(t.module!=='classes')return false;
  var b=ctx.battle,s=t.side,f=ctx.fighter(s),o=ctx.other(s),foe=ctx.fighter(o),st=state(f),d=t.def||{},ref=definitions[d.rule||t.op]||{},up=!!d.upgraded,action=t.op||ref.action,x,n;
  if(t.kind==='power')action=t.power.rule;
  if(ref.delegate){var delegated=ctx.copy(t),describe=ctx.def;delegated.module='cards';delegated.def=ctx.copy(d);delegated.def.rule=ref.delegate;delegated.def.module='cards';ctx.def=function(card){var result=describe(card);if(t.card&&card.uid===t.card.uid){result.rule=ref.delegate;result.module='cards';}return result;};try{return A4.CardRules.run(ctx,delegated);}finally{ctx.def=describe;}}
  switch(action){
  case 'strike':ctx.damage(s,o,up?9:6);break;
  case 'guard':ctx.shield(s,up?8:5);break;
  case 'link':ctx.draw(s,up?3:2);break;
  case 'regen':ctx.heal(s,up?4:2);ctx.schedule(b.turn+1,'STANDBY',{kind:'effect',side:s,card:t.card,effect:{type:'heal',amount:up?4:2}});break;
  case 'thunderbolt':ctx.damage(s,o,up?10:8);A4.Keywords.effect(ctx,{side:s,effect:{type:'shock',amount:up?3:2}});break;
  case 'neutralize':ctx.damage(s,o,up?4:3);A4.Keywords.effect(ctx,{side:s,effect:{type:'weakened',turns:up?2:1}});break;
  case 'chain':for(n=0;n<(up?3:2);n++)ctx.damage(s,o,2);break;
  case 'leap':x=options(ctx.catalog,pool(ctx.catalog,f.heroId));if(x.length)ctx.discover(s,x,task(s,'generateChoice'));break;
  case 'generateChoice':if(t.choice)ctx.generate(s,t.choice.cardId,{upgraded:!!t.choice.upgraded});break;
  case 'innervate':ctx.mana(s,up?2:1);break;
  case 'snack':for(n=1;n<=(up?2:1);n++)ctx.schedule(b.turn+n,'STANDBY',{kind:'effect',side:s,card:t.card,effect:{type:'mana',amount:2}});break;
  case 'phytoncide':ctx.draw(s,f.maxMana);break;
  case 'growth':if(f.maxMana<5){f.manaGrowth++;f.maxMana++;A4.Keywords.observe(f);}break;
  case 'entangle':A4.Keywords.effect(ctx,{side:s,effect:{type:'weakened',turns:up?3:2}});break;
  case 'seedbomb':ctx.damage(s,o,foe.status.poison>0?(up?16:8):(up?10:5));break;
  case 'focus':if(st.focusTurn!==b.turn)st.focusCount=0;st.focusTurn=b.turn;st.focusCount=(st.focusCount||0)+1;break;
  case 'invocation':(f.shrines||[]).forEach(function(a){a.maxHp+=up?5:3;});break;
  case 'acolyte':alive(f).forEach(function(a){ctx.damage(s,o,(up?6:3)+a.hp);});break;
  case 'chooseShrine':summon(ctx,s,t.choice.id);ctx.runChange({type:'setShrine',side:s,shrineId:t.choice.id});break;
  case 'loa_call':(f.shrines||[]).forEach(function(a){if(a.hp<=0&&a.reviveTurn>b.turn)a.reviveTurn--;});break;
  case 'bloodcraft':if((f.bloodstones||0)>=5)return true;n=bloodPrice(f,t.bloodCostScale);if(st.nextBloodPayment==='opponent'){foe.hp-=n;if(n)ctx.note('text',o,0,{text:foe.name+'의 체력을 혈석 제작 비용으로 '+n+' 소모했다.'});}else if(st.nextBloodPayment!=='free'){if(f.hp<=n)return true;f.hp-=n;}delete st.nextBloodPayment;f.bloodstones=Math.min(5,(f.bloodstones||0)+1);ctx.runChange({type:'bloodstones',side:s,amount:f.bloodstones});break;
  case 'crescendo':ctx.heal(s,up?8:5);ctx.fatigue(s,o,true);break;
  case 'saturation':ctx.draw(s,up?3:2);break;
  case 'bloodRitual':st.nextBloodPayment=up?'opponent':'free';break;
  case 'anchor_pull':if(f.deck.length)ctx.discover(s,f.deck.slice(),task(s,'anchorChoice'),{sourceZone:'deck'});break;
  case 'anchorChoice':ctx.choose(s,[{id:'top',name:'덱 맨 위'},{id:'bottom',name:'덱 맨 밑'}],task(s,'anchorPosition',{card:t.choice}));break;
  case 'anchorPosition':x=ctx.remove(s,t.card.uid);if(x){if(t.choice.id==='top')f.deck.unshift(x);else f.deck.push(x);}break;
  case 'pendant':f.hand.forEach(function(c){if(c.cardId==='crystal_ball'||c.originalCardId==='crystal_ball')ctx.upgrade(c);});break;
  case 'mimic':x=f.hand.slice().sort(function(a,z){return ctx.cost(s,a)-ctx.cost(s,z);})[0];for(n=0;n<(up?2:1);n++)copyHand(ctx,s,x);break;
  case 'bait':ctx.sample(f.deck.filter(function(c){return c.uid!==t.card.uid&&ctx.cost(s,c)===0&&!c.upgraded&&!!ctx.catalog.cards[c.cardId].upgrade&&!ctx.catalog.cards[c.cardId].treasure;}),up?2:1).forEach(ctx.upgrade);break;
  case 'snow':castDeck(ctx,s,true,up?2:1,!!f.status.deckEmptied);break;
  case 'zeroDraw':ctx.draw(s,ctx.limit(s)-f.hand.length,function(def,c){return ctx.cost(s,c)===0;});break;
  case 'surf':for(n=1;n<=2;n++)ctx.schedule(b.turn+n,'STANDBY',task(s,'surfTick',{discover:up}));break;
  case 'surfTick':x=f.deck.filter(function(c){return ctx.cost(s,c)===0&&ctx.canAutoCast(c);});if(t.discover&&x.length)ctx.discover(s,x,task(s,'deckCastChoice'),{sourceZone:'deck'});else castDeck(ctx,s,true,1,false);break;
  case 'deckCastChoice':if(ctx.find(s,t.choice.uid)){ctx.move(s,t.choice.uid,'inFlight');ctx.cast(s,t.choice,{copy:false});}break;
  case 'discard':discard(ctx,s,up?3:2);break;
  case 'buried':ctx.draw(s,up?2:1);ctx.shield(s,up?10:5);break;
  case 'restSurprise':case 'restPlasma':case 'restAura':case 'restCannon':break;
  case 'anchor':ctx.draw(s,up?4:2);if(!f.status.deckEmptied&&!ctx.modify('harmfulEffect',{side:s,kind:'noDraw',cancel:false}).cancel)st.noDrawTurn=b.turn+1;break;
  case 'stolen':if(f.status.deckEmptied)chooseMove(ctx,s,o,'deck',up?2:1);else for(n=0;n<(up?2:1);n++){x=ctx.pick(foe.deck);if(x)ctx.add(s,ctx.remove(o,x.uid),'hand');}break;
  case 'deepBait':discard(ctx,s,up?6:3);ctx.draw(s,1);break;
  case 'flood':discard(ctx,s,3);f.deck.slice(0,up?5:3).forEach(function(c){c.costDelta=(c.costDelta||0)-1;c.costFloor=0;});break;
  case 'salvage':discard(ctx,s,3);if(f.status.deckEmptied)chooseMove(ctx,s,s,'rest',up?2:1);else for(n=0;n<(up?2:1);n++){x=ctx.pick(f.rest);if(x)ctx.move(s,x.uid,'hand');}break;
  case 'moveChoice':x=ctx.remove(t.owner,t.choice.uid);if(x)ctx.add(s,x,'hand');if(t.remaining>1)chooseMove(ctx,s,t.owner,t.zone,t.remaining-1);break;
  case 'convert':if(f.hand.length)ctx.discover(s,f.hand.slice(),task(s,'discardChoice'),{sourceZone:'hand'});break;
  case 'discardChoice':ctx.move(s,t.choice.uid,'rest');ctx.draw(s,1);break;
  case 'overdrive':n=f.hand.length;f.hand.slice().forEach(function(c){ctx.move(s,c.uid,'rest');});ctx.draw(s,n);break;
  case 'negotiate':discard(ctx,s,3);if(f.hand.length&&foe.hand.length){if(f.status.deckEmptied)ctx.discover(s,f.hand.slice(),task(s,'exchangeOwn'));else exchange(ctx,s,ctx.pick(f.hand),ctx.pick(foe.hand));}break;
  case 'exchangeOwn':ctx.discover(s,foe.hand.slice(),task(s,'exchangeOther',{own:t.choice}));break;
  case 'exchangeOther':exchange(ctx,s,t.own,t.choice);break;
  case 'shrineDestroyed':if(has(f,'loa_wrath')){ctx.draw(s,1);ctx.damage(s,o,6,{card:null});}if(has(f,'loa_grace')){x=ctx.pick(f.hand.filter(function(c){return !c.upgraded&&!!ctx.catalog.cards[c.cardId].upgrade;}));if(x)ctx.upgrade(x);}if(has(f,'majestic_presence'))f.hand.forEach(function(c){c.costDelta=(c.costDelta||0)-1;c.costFloor=0;});if(has(f,'grace_harvester'))ctx.draw(s,ctx.limit(s)-f.hand.length);break;
  default:return false;
  }return true;
 }
 function exchange(ctx,s,a,z){var o=ctx.other(s),left=ctx.remove(s,a.uid),right=ctx.remove(o,z.uid);if(left)ctx.add(o,left,'hand');if(right)ctx.add(s,right,'hand');}
 function absorb(ctx,s,amount){var f=ctx.fighter(s);alive(f).forEach(function(a){var lost=Math.min(a.hp,amount);a.hp-=lost;amount-=lost;if(lost&&a.hp<=0){a.reviveTurn=ctx.battle.turn+(has(f,'loa_covenant')?2:3);ctx.enqueue(task(s,'shrineDestroyed'));}});return amount;}
 function bloodPrice(f,scale){return Math.floor((f.runWins||0)*2*(scale===undefined?1:scale));}
 function bloodUsable(f,scale,available){return (available===undefined?(f.bloodstones||0):available)<5&&((state(f).nextBloodPayment==='free'||state(f).nextBloodPayment==='opponent')||f.hp>bloodPrice(f,scale));}
 function modify(ctx,what,d){var f=d.side?ctx.fighter(d.side):null,st=f?state(f):null;
  if(what==='harmfulEffect'&&has(f,'purification_well')&&(st.purified||0)<2){st.purified=(st.purified||0)+1;d.cancel=true;ctx.note('text',d.side,0,{text:f.name+'의 [🎖️] 정화의 원천이 해로운 효과를 무시했다. ('+st.purified+'/2)'});}
  if(what==='overload'&&alive(f,'kragwa').length)d.value=0;
  if(what==='cardCost'){if(alive(f)&&alive(f).length&&has(f,'sacred_ritual')&&d.value>0)d.value=Math.max(1,d.value-1);if(d.def.action==='buried'&&f.status.deckEmptied)d.value=0;}
  if(what==='drawAllowed'&&st.noDrawTurn===ctx.battle.turn)d.allowed=false;
  if(what==='basicDraw'&&st.noDrawTurn===ctx.battle.turn)d.replace=true;
  if(what==='powerUsable'&&d.power&&d.power.id==='loa_call'&&!(f.shrines||[]).some(function(a){return a.hp<=0;}))d.allowed=false;
  if(what==='powerUsable'&&d.power&&d.power.id==='bloodcraft'&&!bloodUsable(f,undefined,d.bloodAvailable))d.allowed=false;
  if(what==='damage'&&d.card&&!d.noBonus){var own=ctx.fighter(d.sourceSide);d.value+=(state(own).powerBonus||0)+alive(own,'janalai').length*2;}
  if(what==='heal'&&d.card)d.value+=(st.powerBonus||0)+alive(f,'janalai').length*2;
  if(what==='healFinal'&&alive(f,'bwonsamdi').length&&d.value>0){ctx.damage(d.side,ctx.other(d.side),d.value,{card:null,noBonus:true});d.value=0;}
 }
 function hook(ctx,e){var b=ctx.battle;
  ['player','enemy'].forEach(function(s){var f=ctx.fighter(s),o=ctx.other(s),st=state(f),turn=b.turn,x;
   if(e.type==='battleStart'){
    if(f.heroId==='thekal'&&!(f.shrines||[]).length){if(f.shrineId)summon(ctx,s,f.shrineId);else ctx.discover(s,data.shrines.map(function(a){return {id:a.id,name:'[🕯] '+a.name+' | ❤️'+a.maxHp,text:'제단. '+a.text};}),task(s,'chooseShrine'));}
    if(has(f,'snake_ring')&&!st.snakeApplied){st.snakeApplied=true;ctx.draw(s,2,null,{opening:true});}
   }
   if(e.type==='standby'&&st.standbyTurn!==turn){
    st.standbyTurn=turn;
    if(f.heroPower&&f.heroPower.id==='inquiry'&&has(f,'dragon_pendant_passive')&&(turn+1)%4===0)ctx.generate(s,'crystal_ball',{upgraded:true});
    (f.shrines||[]).forEach(function(a){var revived=a.hp<=0&&a.reviveTurn<=turn;if(revived){a.hp=a.maxHp;delete a.reviveTurn;}if(a.hp>0){
      if(has(f,'bound_reliquary'))a.maxHp++;if(revived)a.hp=a.maxHp;
      if(a.id==='akali'&&f.shield)ctx.damage(s,o,f.shield,{card:null});
      if(a.id==='gral')copyHand(ctx,s,ctx.pick(ctx.fighter(o).deck),1);
    }});
   }
   if(e.type==='beforeMain'&&e.phase==='MAIN1'&&has(f,'boar_altar')&&f.heroPower&&f.heroPower.id==='bloodcraft'&&st.boarTurn!==turn&&bloodUsable(f,0.5)){st.boarTurn=turn;ctx.enqueue({kind:'power',module:'classes',side:s,power:ctx.copy(f.heroPower),bloodCostScale:0.5});}
   if(e.type==='powerUsed'&&e.side===s&&e.power&&e.power.id!=='bloodcraft')delete st.nextBloodPayment;
   if(e.type==='shieldGained'&&e.side===s&&e.amount>0&&alive(f,'gonk').length)ctx.mana(s,f.maxMana,true);
   if(e.type==='cardUsed'&&e.side===s){
    if(has(f,'pandaria_codex')&&(e.card.cardId==='crystal_ball'||e.card.originalCardId==='crystal_ball')){st.crystals=(st.crystals||0)+1;if(st.crystals%5===0)st.powerBonus=(st.powerBonus||0)+1;}
    if(st.focusTurn===turn)ctx.damage(s,o,3*(st.focusCount||1),{card:null});
    alive(f,'kragwa').forEach(function(){if(/과부하/.test(e.def.text||''))ctx.damage(s,o,5,{card:null});});
    alive(f,'shirvallah').forEach(function(){var ids=ctx.catalog.cardPool.filter(function(id){return ctx.catalog.cards[id].element==='HOLY';});x=ctx.pick(ids);if(x)ctx.generate(s,x);});
   }
   if(e.type==='cardRest'&&e.side===s){var d=ctx.def(e.card),ref=definitions[d.rule]||{},up=!!e.card.upgraded;
    if(ref.action==='restSurprise'){ctx.damage(s,o,up?16:10);ctx.draw(s,2);}
    if(ref.action==='restPlasma'){A4.Keywords.effect(ctx,{side:s,effect:{type:'shock',amount:up?3:1}});ctx.draw(s,3);}
    if(ref.action==='restCannon'){ctx.damage(s,o,up?10:6);A4.Keywords.effect(ctx,{side:s,effect:{type:'shock',amount:1}});}
    if(ref.action==='restAura')getTreasure(ctx,s,up);
   }
   if(e.type==='end'){
    alive(f,'halazzi').forEach(function(){ctx.damage(s,o,f.playedThisTurn*2,{card:null});});
    if(has(f,'steadfast_soul'))alive(f).forEach(function(a){a.hp=a.maxHp;});
   }
   if(has(f,'bilgewater_tribute')&&f.status.deckEmptied&&!st.tribute){st.tribute=true;getTreasure(ctx,s,false);}
  });
 }
 function evaluate(d,m,own,opp,b,c){var ref=definitions[d.rule]||{},up=!!d.upgraded,action=d.rule==='bloodcraft'?'bloodcraft':ref.action,st=(own.status||{}).classes||{};
  if(ref.delegate){var standard=A4.Opponents.reference(ref.delegate);if(standard){var base=A4.Battle.describeCard({cardId:standard.id,upgraded:up},c),score=A4.AIEvaluation.evaluateCard(base,own,opp,b,c);Object.keys(m).forEach(function(k){if(score[k]!==undefined)m[k]=score[k];});}return;}
  switch(action){
  case 'strike':m.damage=up?9:6;break;case 'guard':m.shield=up?8:5;break;case 'link':m.draw=up?3:2;break;
  case 'regen':m.heal=(up?4:2)*1.7;break;case 'thunderbolt':m.damage=up?10:8;m.control=up?4:3;break;
  case 'neutralize':m.damage=up?4:3;m.control=up?3:2;break;case 'chain':m.damage=up?6:4;m.hits=up?3:2;break;
  case 'leap':m.draw=1;m.value=1;break;case 'innervate':m.mana=up?2:1;break;case 'snack':m.value=up?5:3;break;
  case 'phytoncide':m.draw=own.maxMana;break;case 'growth':m.value=own.maxMana<5?6:0;break;case 'entangle':m.control=up?4:3;break;
  case 'seedbomb':m.damage=(opp.status||{}).poison?(up?16:8):(up?10:5);break;case 'focus':m.value=2;break;
  case 'invocation':m.value=(own.shrines||[]).length*(up?4:2);break;case 'acolyte':m.damage=alive(own).reduce(function(sum,a){return sum+a.hp+(up?6:3);},0);break;
  case 'crescendo':m.heal=up?8:5;m.damage=A4.Battle.fatigueDamage(b.turn+1,opp);m.fatigueDamage=true;m.value+=1;break;
  case 'saturation':m.draw=up?3:2;break;
  case 'bloodRitual':m.value=st.nextBloodPayment?0:(own.runWins||0)*2*(up?2:1)+1;break;
  case 'bloodcraft':var payment=bloodPrice(own),wanted=(own.hand||[]).some(function(x){return c.cards[x.cardId]&&c.cards[x.cardId].bloodCost!==undefined;});m.value=(wanted?5:2)-((st.nextBloodPayment==='free'||st.nextBloodPayment==='opponent')?0:payment*(own.hp<15?1.7:0.8));if(st.nextBloodPayment==='opponent'){m.value+=payment*1.3;if(payment>=opp.hp&&payment>0)m.value+=50;}break;
  case 'mimic':m.draw=own.hand.length>1?(up?2:1):0;break;case 'zeroDraw':m.draw=4;break;case 'discard':m.value=1;break;
  case 'buried':m.draw=up?2:1;m.shield=up?10:5;break;case 'restSurprise':m.damage=up?16:10;m.draw=2;break;
  case 'restPlasma':m.draw=3;m.control=up?4:2;break;case 'restCannon':m.damage=up?10:6;m.control=2;break;
  case 'restAura':m.draw=1;m.value=4;break;case 'anchor':m.draw=up?4:2;m.value=own.status.deckEmptied?0:-2;break;
  case 'stolen':case 'salvage':m.draw=up?2:1;break;case 'deepBait':m.draw=1;break;case 'convert':m.draw=1;m.value=-1;break;
  case 'overdrive':m.draw=own.hand.length-1;m.value=-m.draw;break;default:m.value=1;
  }
 }
 function restoreCrystal(card){if(card.originalCardId!=='crystal_ball')return;card.cardId='crystal_ball';card.upgraded=!!card.crystalUpgraded;['originalCardId','transformed','cost','costDelta','element','noUpgrade','temporaryUntil'].forEach(function(k){delete card[k];});}
 return {evaluate:evaluate,restoreCrystal:restoreCrystal,install:install,run:run,hook:hook,modify:modify,absorb:absorb,has:has,alive:alive,pool:pool,supports:function(rule){return !!definitions[rule];}};
}());

// ---- src/expansion.js ----
 
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
 var allowed='과열|금단의 불꽃|벼려내기|불길|영혼관|마나 연소|불장난|소각|작열통|절멸|점화|제독|태양 작렬|폭발의 룬|화염 장막|화염구|화염포|플레어드라이브|불씨|백드래프트|번아웃|불타는 가위|화염 제단|불안정한 원소|불덩이 작렬|겨울의 뿔피리|아쿠아링|급속 빙결|냉동 캡슐|대 한파|동면|북부 항해|얼어붙은 버클러|얼음 거울|얼음 덫|얼음 방패|완전 빙결|확고한 알리바이|방한 고글|얼음 회오리|칼바람|심호흡|수중 동물 변신|금단의 치유술|광합성|먹음직스러운 덥석멜론|산사태|살아 움직이는 숲|왕성한 진균|이슬 절차|자연의 해독|초고속|흡수|가속|굽이치는 파도|치유의 손길|풍요|강풍|꿈 숨결|기적같은 성장|자연화|폭풍 인도기|살라드라실|궁극의 역병|접붙이기|부스터 팩|선조의 지혜|전선|찌릿!|초과 인출|이건 내 거야!|긴급 차단|단락|마비|무덤의 지명자|믹스테이프|전류 공급|전이|천둥|충전|파지직|송전|볼트태클|두꺼비집|번개|연쇄 번개|고철 더미에서|마법공학: 니비루|마법공학: 아틀라스|마법공학: 퓨즈|기도|안도|예지|윤회|하늘의 선물|계시|배교|불굴|성지순례|심판|운명|축성|필연|황금궤|성전|축복|신의 권능: 가속|신의 권능: 성역|신의 권능: 응징|신의 권능: 재생|신의 권능: 징벌'.split('|');
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

// ---- src/runes.js ----
 
A4.Runes=(function(){
 'use strict';
 function current(f){return (f.runes||[])[0]||null;}
 function definition(card,c){return card.activeRuneDef||A4.Battle.describeCard(card,c);}
 function amount(f,type){var x=current(f),sum=0;if(x)(x.activeRuneDef&&x.activeRuneDef.runeEffects||[]).forEach(function(e){if(e.type===type)sum+=e.amount||0;});return sum;}
 function activate(ctx,t){
  var f=ctx.fighter(t.side),card=ctx.find(t.side,t.card.uid);if(!card)return;
  (f.runes||[]).slice().forEach(function(old){if(old.uid!==card.uid)ctx.move(t.side,old.uid,'rest');});
  f.runeSerial=(f.runeSerial||0)+1;card.runeActivationId=f.runeSerial;card.activeRuneDef=ctx.copy(t.def);ctx.move(t.side,card.uid,'runes');
  ctx.emit('runeActivated',{side:t.side,card:card,def:ctx.copy(t.def)});
 }
 function modify(ctx,what,d){
  var f=ctx.fighter(d.side||d.sourceSide||ctx.side);
  if(what==='move'&&d.from==='runes'&&d.to!=='runes'){
   delete d.card.activeRuneDef;delete d.card.runeActivationId;ctx.emit('runeEnded',{side:d.side,card:d.card});
  }
  if(what==='damage'&&d.card&&!d.noBonus)d.value+=amount(ctx.fighter(d.sourceSide),'damageBonus');
  if(what==='heal'&&d.card&&!d.noBonus)d.value+=amount(f,'healBonus');
  if(what==='damageTaken'&&!d.unblockable)d.value=Math.max(0,d.value-amount(f,'damageReduction'));
  if(what==='cardCost')d.value=Math.max(0,d.value+amount(f,'cardCost'));
  if(what==='powerCost')d.value=Math.max(0,d.value+amount(f,'powerCost'));
 }
 function hook(ctx,e){
  ['player','enemy'].forEach(function(side){var x=current(ctx.fighter(side));if(!x)return;
   (definition(x,ctx.catalog).runeTriggers||[]).forEach(function(trigger){
    if(trigger.event!==e.type)return;
    if(e.side&&trigger.side!=='both'&&(trigger.side==='opponent'?e.side===side:e.side!==side))return;
    if(e.card&&e.card.uid===x.uid&&!trigger.includeSelf)return;
    ctx.enqueue({module:'runes',kind:'runeTrigger',side:side,uid:x.uid,activation:x.runeActivationId,effects:ctx.copy(trigger.effects||[]),displaySource:{side:side,label:definition(x,ctx.catalog)}});
   });
  });
 }
 function run(ctx,t){
  if(t.module!=='runes')return false;
  var x=current(ctx.fighter(t.side));if(!x||x.uid!==t.uid||t.activation!==undefined&&x.runeActivationId!==t.activation)return true;
  (t.effects||[]).forEach(function(e){ctx.enqueue({kind:'effect',side:t.side,card:ctx.copy(x),effect:e,runeSource:{side:t.side,uid:x.uid,activation:x.runeActivationId}});});return true;
 }
 return {activate:activate,modify:modify,hook:hook,run:run,current:current,definition:definition,amount:amount};
}());

// ---- src/combat-v3.js ----
 
A4.Battle = (function () {
  'use strict';
   
  var SIDES=['player','enemy'], ZONES=['hand','deck','rest','excluded','inFlight','runes'];
  var COUNTERS={ICE:'FIRE',FIRE:'NATURE',NATURE:'LIGHTNING',LIGHTNING:'ICE'};
  function clone(v){return v===undefined?undefined:JSON.parse(JSON.stringify(v));}
  function other(s){return s==='player'?'enemy':'player';}
  function label(d){return {name:d.name,element:d.element||'NEUTRAL',displayElement:d.kind==='active'||d.kind==='passive'?'🛟':d.displayElement||null,treasure:!!d.treasure,rune:!!d.rune,rule:d.rule||null};}
  function report(b){return b.report||(b.report={turn:b.turn,phase:b.phase,serial:b.phaseSerial,nodes:[],logs:[]});}
  function node(b,side,d,card,parent){
    if(card&&card.originalCardId==='crystal_ball'&&card.cardId!=='crystal_ball')parent=node(b,side,{name:card.crystalUpgraded?'수정구+':'수정구',element:'COSMIC'},null,parent).id;
    var r=report(b),n={id:r.nodes.length,side:side,label:label(d),uid:card&&card.uid||null,parent:parent===undefined?null:parent,countered:false};r.nodes.push(n);return n;
  }
  function modules(){return [A4.CardRules,A4.TreasureRules,A4.BossRules,A4.Keywords,A4.Classes,A4.Expansion,A4.Runes].filter(function(x){return !!x;});}
  function shuffle(a,rng){for(var i=a.length-1;i>0;i--){var j=Math.floor(rng()*(i+1)),t=a[i];a[i]=a[j];a[j]=t;}return a;}
  function describe(c,catalog){
    var base=catalog.cards[c.cardId]; A4.assert(base,'알 수 없는 카드: '+c.cardId);
    var d=clone(base),k;
    if(c.upgraded&&base.upgrade){for(k in base.upgrade)if(A4.has(base.upgrade,k))d[k]=clone(base.upgrade[k]); d.name=base.name+'+';}
    ['bloodCost','rune','runeEffects','runeTriggers','cost','element','excludeOnUse','temporary','unplayable','overpower','volatile','liberation','orbit','unstable','limited','innate','rule','module'].forEach(function(key){if(c[key]!==undefined)d[key]=c[key];});
    if(c.costDelta)d.cost=Math.max(c.costFloor||0,d.cost+c.costDelta);
    d.overpower=!!d.overpower||/(?:^|[.,]\s*)압도(?:[.,:\s]|$)/.test(d.text||'');
    d.unstable=!!d.unstable||/(?:^|[.,]\s*)불안정(?:[.,:\s]|$)/.test(d.text||'');
    d.volatile=!!d.volatile||/(?:^|[.,]\s*)휘발성(?:[.,:\s]|$)/.test(d.text||'');
    d.uid=c.uid;d.cardId=c.cardId;d.upgraded=!!c.upgraded;d.element=d.element||'NEUTRAL';
    return d;
  }
  function clearCostReduction(card,catalog){
     
     
    var restore=card.treasureCostRestore;
    if(restore){
      if(restore.hasCost)card.cost=restore.cost;else delete card.cost;
      card.costDelta=restore.costDelta||0;card.costFloor=restore.costFloor||0;
      delete card.treasureCostRestore;
    }
    var plain=clone(card);delete plain.cost;delete plain.costDelta;delete plain.costFloor;
    if(card.cost!==undefined&&card.cost<describe(plain,catalog).cost)delete card.cost;
    if(card.costDelta<0){delete card.costDelta;delete card.costFloor;}
  }
  function fighter(spec,catalog,rng){
    var f={name:spec.name,baseMaxHp:spec.maxHp,maxHp:spec.maxHp,hp:spec.maxHp,shield:0,mana:2,maxMana:2,manaGrowth:0,overloadNext:0,
      hand:[],deck:clone(spec.deck||[]),rest:[],excluded:[],inFlight:[],runes:[],passives:clone(spec.passives||[]),treasureIds:clone(spec.treasureIds||[]),
      heroName:spec.heroName||spec.name,heroPower:clone(spec.heroPower||null),heroPowerUsedTurn:-1,heroPowerReadyTurn:0,
      status:{cardLocks:[],foresightTurns:[]},playedThisTurn:0,usedThisTurn:[],lastTurnCards:[],damageTakenThisTurn:0,limitedUsed:{},bossId:spec.bossId||null,heroId:spec.heroId||null,startingTreasureId:spec.startingTreasureId||null,shrineId:spec.shrineId||null,shrines:[],bloodstones:spec.bloodstones||0,fatigueExtra:0,runWins:spec.runWins||0};
    f.passives.forEach(function(p){if(p.type==='maxHp'){f.maxHp+=p.amount;f.hp+=p.amount;}if(p.type==='startingShield')f.shield+=p.amount;});
    if(spec.hp!==undefined){A4.assert(A4.integer(spec.hp,1),'시작 체력이 올바르지 않습니다.');f.hp=Math.min(f.maxHp,spec.hp);}
    shuffle(f.deck,rng); return f;
  }
  function context(b,c,rng,task,spawned){
    var ctx={battle:b,catalog:c,rng:rng,task:task,side:task.side||'player',copy:clone,other:other};
    ctx.fighter=function(s){return b[s];};ctx.self=b[ctx.side];ctx.foe=b[other(ctx.side)];
    ctx.pick=function(a){return a.length?a[Math.floor(rng()*a.length)]:null;};
    ctx.sample=function(a,n){return shuffle(a.slice(),rng).slice(0,n);};ctx.shuffle=function(a){return shuffle(a,rng);};
    ctx.log=function(t){if(b._aiSimulation)return;if(b.lastLog.length<120)b.lastLog.push(String(t));else if(b.lastLog.length===120)b.lastLog.push('이후 반복 효과 로그는 생략합니다.');};
    var ownNode=b.report&&b.report.nodes.slice().reverse().filter(function(n){return n.side===ctx.side&&((task.card&&n.uid===task.card.uid)||(task.kind==='power'&&n.power));})[0];
    if(ownNode&&task.kind!=='cast'){task.displayNode={serial:b.report.serial,id:ownNode.id};task.displaySource={side:ctx.side,label:ownNode.label};}
    if(!task.displaySource&&(task.card||task.power))task.displaySource={side:ctx.side,label:label(task.card?describe(task.card,c):task.power)};
    ctx.withSource=function(side,source,fn){var old=task.displaySource;task.displaySource={side:side,label:label(source)};try{return fn();}finally{task.displaySource=old;}};
    ctx.note=function(type,side,amount,extra){if(b._aiSimulation)return;var r=report(b),source=extra&&extra.source||task.displaySource||null,last=r.logs[r.logs.length-1];if(['gainCard','move','overflow'].indexOf(type)>=0&&last&&last.type===type&&last.side===side&&last.text===(extra&&extra.text||null)&&JSON.stringify(last.source)===JSON.stringify(source)&&!!last.cards===!!(extra&&extra.cards)){last.amount+=amount;if(extra&&extra.cards)last.cards=last.cards.concat(clone(extra.cards));return;}if(r.logs.length>=100){if(!r.omitted){r.omitted=true;r.logs.push({type:'text',text:'반복 효과의 추가 로그는 생략합니다.'});}return;}r.logs.push({type:type,side:side,amount:amount,source:clone(source),blocked:extra&&extra.blocked||0,modified:!!(extra&&extra.modified),text:extra&&extra.text||null,cards:extra&&extra.cards?clone(extra.cards):null});};
    ctx.reveal=function(s,card){return node(b,s,ctx.def(card),card);};
    function inherit(next){if(task.runeSource&&next.kind==='effect'&&!next.runeSource)next.runeSource=clone(task.runeSource);if(task.castTrail&&!next.castTrail)next.castTrail=clone(task.castTrail);if(task.displaySource&&!next.displaySource)next.displaySource=clone(task.displaySource);if(task.displayNode&&!next.displayNode)next.displayNode=clone(task.displayNode);return next;}
    ctx.enqueue=function(t){spawned.push(inherit(clone(t)));};
    ctx.prepend=function(t){var list=Array.isArray(t)?t:[t];for(var i=list.length-1;i>=0;i--)spawned.unshift(inherit(clone(list[i])));};
    ctx.emit=function(type,data){var ev=clone(data||{});ev.type=type;ctx.enqueue({kind:'event',side:ev.side||ctx.side,event:ev});};
    ctx.modify=function(what,data){modules().forEach(function(m){if(m.modify)m.modify(ctx,what,data);});return data;};
    ctx.def=function(card){
      var d=describe(card,c),s=findSide(b,card.uid)||ctx.side;
      var v=ctx.modify('element',{side:s,card:card,def:d,value:d.element});d.element=v.value;return d;
    };
    ctx.limit=function(s){return Math.max(1,Math.floor(ctx.modify('handLimit',{side:s,value:A4.HAND_LIMIT||8}).value));};
    ctx.cost=function(s,card,first){
      var d=ctx.def(card),data={side:s,card:card,def:d,value:d.cost,first:first===undefined?b[s].playedThisTurn===0:!!first};
      return Math.max(0,Math.floor(ctx.modify('cardCost',data).value));
    };
    ctx.powerCost=function(s,power){return Math.max(0,Math.floor(ctx.modify('powerCost',{side:s,power:power||b[s].heroPower,value:(power||b[s].heroPower).cost||0}).value));};
    ctx.find=function(s,uid){return locate(b[s],uid).card||null;};
    ctx.remove=function(s,uid){var l=locate(b[s],uid);if(l.zone==='runes'&&l.card)ctx.modify('move',{side:s,card:l.card,from:'runes',to:null});if(l.zone==='hand'&&A4.Classes&&l.card)A4.Classes.restoreCrystal(l.card);var card=l.card?b[s][l.zone].splice(l.index,1)[0]:null;if(A4.Keywords)A4.Keywords.observe(b[s]);return card;};
    ctx.add=function(s,card,zone,options){
      if(!card)return null;zone=zone||'hand';options=options||{};var overflow=zone==='hand'&&b[s].hand.length>=ctx.limit(s);
      if(overflow&&ctx.modify('handOverflow',{side:s,card:card,draw:!!options.draw,cycleFirst:false}).cycleFirst){var firstCard=b[s].hand[0];if(firstCard)ctx.move(s,firstCard.uid,'deck');overflow=b[s].hand.length>=ctx.limit(s);}
      if(overflow)zone='excluded';
      if(zone==='excluded')zone=ctx.modify('move',{side:s,card:card,from:options.from||null,to:zone,overflow:overflow}).to;
      if(zone==='hand'&&(ctx.def(card).temporary||card.temporaryUntil!==undefined||A4.TreasureRules&&A4.TreasureRules.owns&&A4.TreasureRules.owns(b[s],'time_potion')))card.temporaryUntil=Math.max(card.temporaryUntil||0,b.turn+(b.phase==='END'?1:0));
      if(zone==='rest'||zone==='excluded'||(zone==='deck'&&(options.from==='hand'||options.from==='inFlight')))clearCostReduction(card,c);
      if(zone==='rest'){delete card.liberationReady;delete card.liberationProgress;}
      if(zone==='hand'&&options.from!=='hand'){delete card.orbitCount;delete card.orbitTriggered;}
      if(zone==='runes'){(b[s].runes||[]).slice().forEach(function(old){if(old.uid!==card.uid)ctx.move(s,old.uid,'rest');});if(!card.activeRuneDef)card.activeRuneDef=clone(ctx.def(card));}if(!b[s][zone])b[s][zone]=[];b[s][zone].push(card);if(A4.Keywords)A4.Keywords.observe(b[s]);
      if(task.displaySource&&!options.silent&&!overflow&&zone==='hand')ctx.note('gainCard',s,1);
      if(overflow){ctx.log(ctx.def(card).name+' — 손패 초과로 제외');ctx.note('overflow',s,1,{cards:[label(ctx.def(card))]});}
      if(zone==='excluded')ctx.emit('cardExcluded',{side:s,card:card,previousZone:options.from||null});
      if(zone==='rest')ctx.emit('cardRest',{side:s,card:card,previousZone:options.from||null});
      return card;
    };
    ctx.move=function(s,uid,to,options){
      var l=locate(b[s],uid);if(!l.card)return null;
      var data=ctx.modify('move',{side:s,card:l.card,from:l.zone,to:to});
      var card=b[s][l.zone].splice(l.index,1)[0];if(l.zone==='hand'&&data.to!=='hand'&&A4.Classes)A4.Classes.restoreCrystal(card);if(A4.Keywords)A4.Keywords.observe(b[s]);if(!(options&&options.silent)&&task.displaySource&&(l.zone!=='inFlight'||(options&&options.logEffect))&&to!=='inFlight'&&data.to!=='hand')ctx.note('move',s,1,{text:data.to,cards:options&&options.logEffect?[label(ctx.def(card))]:null});return ctx.add(s,card,data.to,{from:l.zone});
    };
    ctx.generate=function(s,id,options){
      options=options||{};var card={uid:'b'+(++b.generatedCounter),cardId:id,upgraded:!!options.upgraded},k;
      A4.assert(c.cards[id],'생성 카드가 없습니다: '+id);
      for(k in options)if(A4.has(options,k)&&['zone','uid','cardId','runUid','runCardUid','treasureSlot'].indexOf(k)<0)card[k]=clone(options[k]);
      if(ctx.def(card).liberation){delete card.liberationReady;delete card.liberationProgress;}
      if(ctx.def(card).temporary&&card.temporaryUntil===undefined)card.temporaryUntil=b.turn+(b.phase==='END'?1:0);
      return ctx.add(s,card,options.zone||'hand');
    };
    ctx.upgrade=function(card){
      if(card.originalCardId==='crystal_ball'){if(!card.crystalUpgraded){card.crystalUpgraded=true;card.upgraded=true;return true;}return false;}
      var d=c.cards[card.cardId];if(d&&d.upgrade&&!d.treasure&&(!d.exclusive||card.cardId==='crystal_ball')&&(!card.noUpgrade||card.cardId==='crystal_ball')&&!card.upgraded){card.upgraded=true;delete card.noUpgrade;return true;}return false;
    };
    ctx.refill=function(s){if(!b[s].deck.length&&b[s].rest.length){b[s].deck=shuffle(b[s].rest,rng);b[s].rest=[];ctx.emit('refill',{side:s});}};
    ctx.draw=function(s,n,filter,options){
      if(!ctx.modify('drawAllowed',{side:s,allowed:true}).allowed)return [];
      var result=[],f=b[s],i,j,card,d,drawn=0;options=options||{};
      var drawBatch=b.drawBatchSerial=(b.drawBatchSerial||0)+1;
      for(i=0;i<n;i++){
        ctx.refill(s);j=-1;
        for(var k=0;k<f.deck.length;k++){if(!filter||filter(ctx.def(f.deck[k]),f.deck[k])){j=k;break;}}
        if(j<0)break;card=f.deck.splice(j,1)[0];d=ctx.def(card);if(A4.Keywords)A4.Keywords.observe(f);drawn++;if(!options.opening)f.drawnCountThisTurn=(f.drawnCountThisTurn||0)+1;f.lastDrawnCard=clone(card);
        if(options.cost!==undefined)card.cost=options.cost;
        if(options.costDelta!==undefined){card.costDelta=(card.costDelta||0)+options.costDelta;card.costFloor=options.costFloor||0;}
        Object.keys(options).forEach(function(key){if(['cost','costDelta','costFloor','opening','basic'].indexOf(key)<0)card[key]=clone(options[key]);});
        if(d.castOnDraw){
          f.inFlight.push(card);ctx.enqueue({kind:'cast',side:s,card:clone(card),free:true,fromDraw:true});
        }else{
          if(d.temporary&&card.temporaryUntil===undefined)card.temporaryUntil=b.turn+(b.phase==='END'?1:0);
          var overflow=f.hand.length>=ctx.limit(s);ctx.add(s,card,'hand',{silent:true,draw:true});overflow=!f.hand.some(function(x){return x.uid===card.uid;});
          if(!options.opening)ctx.emit('draw',{side:s,card:card,overflow:overflow,drawBatch:drawBatch});if(!overflow)result.push(card);
        }
      }
      if(drawn&&!options.opening&&!options.basic)ctx.note('draw',s,drawn);
      return result;
    };
    ctx.poison=function(source,target,amount,reflected){
      if(amount<=0)return 0;
      var own=b[source],foe=b[target],owns=function(f,id){return A4.TreasureRules&&A4.TreasureRules.owns&&A4.TreasureRules.owns(f,id);};
      if(source!==target&&owns(own,'molten_bone'))amount++;
      if(ctx.modify('harmfulEffect',{side:target,sourceSide:source,kind:'poison',cancel:false}).cancel)return 0;
      foe.status.poison=(foe.status.poison||0)+amount;
      ctx.note('poison',target,amount);
      if(source!==target&&!reflected&&owns(own,'decay_potion'))ctx.poison(source,source,amount,true);
      return amount;
    };
    ctx.damage=function(source,s,n,options){
      options=options||{};var card=options.card===undefined?task.card:options.card;
      var data={sourceSide:source,side:s,card:card||null,value:Math.max(0,n),unblockable:!!options.unblockable,ignoreArmor:!!options.ignoreArmor,noBonus:!!options.noBonus};
      if(card&&!options.noBonus)b[source].passives.forEach(function(p){if(p.type==='damageBonus')data.value+=p.amount;});
      ctx.modify('damage',data);if(A4.Keywords&&!data.unblockable){if(A4.Keywords.active(b[source],'weakened',b))data.value=Math.floor(data.value*0.75);if(A4.Keywords.active(b[s],'vulnerable',b))data.value=Math.floor(data.value*1.5);}ctx.modify('damageTaken',data);var damage=Math.max(0,Math.floor(data.value)),f=b[s],blocked=data.ignoreArmor?0:Math.min(f.shield,damage);
      f.shield-=blocked;var hpDamage=damage-blocked;if(A4.Classes)hpDamage=A4.Classes.absorb(ctx,s,hpDamage);f.hp-=hpDamage;f.damageTakenThisTurn+=damage;
      var reactionDepth=options.reactionDepth===undefined?(task.kind==='event'&&task.event.type==='damage'?(task.event.reactionDepth||0)+1:task.reactionDepth||0):options.reactionDepth;
      ctx.emit('damage',{side:s,sourceSide:source,amount:damage,hpDamage:hpDamage,card:card||null,unblockable:data.unblockable,reactionDepth:reactionDepth,reactiveAllowed:reactionDepth===0||(b.player.hp>0&&b.enemy.hp>0)});
      if(damage||damage!==Math.max(0,n)){ctx.log(f.name+' 피해 '+damage+(blocked?' (방어도 '+blocked+')':''));ctx.note('damage',s,damage,{blocked:blocked,modified:damage!==Math.max(0,n),source:card?{side:source,label:label(ctx.def(card))}:task.displaySource});}return damage;
    };
    ctx.fatigue=function(source,target,advance){var amount=Math.max(1,1+(b.turn+1-20))+(b[target].fatigueExtra||0);var dealt=ctx.damage(source,target,amount,{ignoreArmor:true,unblockable:true,noBonus:true,card:null});if(advance&&dealt>0)b[target].fatigueExtra=(b[target].fatigueExtra||0)+1;return dealt;};
    ctx.heal=function(s,n,options){
      options=options||{};var f=b[s],card=options.card===undefined?task.card:options.card;
      var data=ctx.modify('heal',{side:s,card:card||null,value:Math.max(0,n),noBonus:!!options.noBonus});ctx.modify('healFinal',data);var requested=Math.max(0,Math.floor(data.value)),amount=Math.max(0,Math.min(requested,f.maxHp-f.hp));
      f.hp+=amount;ctx.emit('heal',{side:s,amount:amount,requested:requested,card:card||null});if(amount)ctx.log(f.name+' 회복 '+amount);ctx.note('heal',s,amount,{modified:amount!==Math.max(0,n),source:card?{side:task.displaySource?task.displaySource.side:ctx.side,label:label(ctx.def(card))}:task.displaySource});return amount;
    };
    ctx.shield=function(s,n){if(n>0&&A4.Keywords&&A4.Keywords.active(b[s],'disarm',b))return;b[s].shield=Math.max(0,b[s].shield+n);if(n){ctx.note('shield',s,n);if(n>0)ctx.emit('shieldGained',{side:s,amount:n});}};
    ctx.mana=function(s,n,recover){var current=b[s].mana;if(recover&&n>=0)b[s].mana=Math.max(current,Math.min(b[s].maxMana,current+n));else b[s].mana=Math.max(0,Math.min(5,current+n));if(b[s].mana!==current)ctx.note('mana',s,b[s].mana-current);};
    ctx.overload=function(s,n){n=ctx.modify('overload',{side:s,value:n}).value;if(n>0&&!ctx.modify('harmfulEffect',{side:s,kind:'overload',cancel:false}).cancel){b[s].overloadNext+=n;ctx.emit('overload',{side:s,amount:n});}};
    ctx.schedule=function(turn,phase,t){b.scheduled.push({turn:turn,phase:phase,task:inherit(clone(t))});};
    ctx.canAutoCast=function(card){
      var d=ctx.def(card),rule=d.rule||d.name;
      if(d.liberation&&A4.Keywords&&!A4.Keywords.liberated(ctx,ctx.side,card,d.liberation))return false;
      return !d.unplayable&&['운명','필연','되감기'].indexOf(rule)<0&&!(rule==='전선'&&d.upgraded);
    };
    ctx.cast=function(s,card,options){
      if(!ctx.canAutoCast(card))return;
      options=options||{};var x=clone(card),trail=clone(task.castTrail||[]),key=card.uid?s+':'+card.uid:null;
      if(key&&trail.indexOf(key)>=0){ctx.log('자동 시전 중 같은 카드의 재귀 호출을 멈춥니다.');ctx.note('text',s,0,{text:'자동 시전 중 같은 카드의 재귀 호출을 멈춥니다.'});return;}
      if(key)trail.push(key);
      if(options.copy!==false){x.uid='b'+(++b.generatedCounter);delete x.runUid;delete x.runCardUid;delete x.treasureSlot;}
      ctx.enqueue({kind:'cast',side:s,card:x,free:true,copy:options.copy!==false,castTrail:trail});
    };
    ctx.choose=function(s,options,continuation,settings){
      settings=settings||{};if(!options.length)return false;
      var resume=inherit(clone(continuation));resume.side=resume.side||s;
      ctx.enqueue({kind:'choiceRequest',side:s,options:options,continuation:resume,settings:settings});
      return true;
    };
    ctx.discover=function(s,options,continuation,settings){
      var names={},unique=[];options.forEach(function(o){var key=o.cardId?describe(o,c).name+'|'+describe(o,c).element:(o.id||o.name);if(!names[key]){names[key]=true;unique.push(o);}});
      settings=clone(settings||{});settings.discover=true;return ctx.choose(s,ctx.sample(unique,3),continuation,settings);
    };
    ctx.runChange=function(change){
      change=clone(change);
      if(change.type==='removeCard'){var removed=ctx.find(change.side||'player',change.uid);if(removed&&removed.runUid)change.runUid=removed.runUid;}
      b.runChanges.push(clone(change));
       
       
      var s=change.side||'player',spec=b.restartSpecs&&b.restartSpecs[s],id=change.treasureId||change.id,treasure=c.treasures&&c.treasures[id];if(!spec)return;
      if(change.type==='addCard'){var added=clone(change.card||{cardId:change.cardId,upgraded:!!change.upgraded});added.originUid=added.uid;added.uid='r'+(++b.generatedCounter);spec.deck.push(added);}
      if(change.type==='removeCard')spec.deck=spec.deck.filter(function(x){return x.uid!==(change.runUid||change.uid)&&x.originUid!==change.uid;});
      if(change.type==='upgradeCard')spec.deck.forEach(function(x){if(x.uid===(change.runUid||change.uid)||x.originUid===change.uid)x.upgraded=true;});
      if(change.type==='bloodstones')spec.bloodstones=change.amount;
      if(change.type==='setShrine')spec.shrineId=change.shrineId;
      if(change.type==='setHeroPower')spec.heroPower=clone(change.power);
      if(change.type==='addTreasure'&&treasure){spec.treasureIds=spec.treasureIds||[];spec.treasureIds.push(id);if(treasure.kind==='card')spec.deck.push({uid:'r'+(++b.generatedCounter),originUid:change.cardUid,cardId:treasure.cardId,upgraded:false});else spec.passives=(spec.passives||[]).concat(clone(treasure.effects));}
      if(change.type==='removeTreasure'){spec.treasureIds=(spec.treasureIds||[]).filter(function(x){return x!==id;});spec.passives=(spec.passives||[]).filter(function(x){return x.treasureId!==id&&x.id!==id;});}
    };
    ctx.lock=function(s,from,until,elements){if(ctx.modify('harmfulEffect',{side:s,kind:'lock',cancel:false}).cancel)return;b[s].status.cardLocks.push({from:from,until:until,elements:elements||null,name:task.card?ctx.def(task.card).name:'카드 사용 제한'});};
    return ctx;
  }
  function locate(f,uid){for(var z=0;z<ZONES.length;z++){var zone=ZONES[z],a=f[zone]||[];for(var i=0;i<a.length;i++)if(a[i].uid===uid)return {zone:zone,index:i,card:a[i]};}return {};}
  function findSide(b,uid){for(var i=0;i<SIDES.length;i++)if(locate(b[SIDES[i]],uid).card)return SIDES[i];return null;}
  function usable(ctx,s,card){
    var f=ctx.battle[s],d=ctx.def(card),data={side:s,card:card,def:d,allowed:true,reason:''},turn=ctx.battle.turn;
    if(d.unplayable){data.allowed=false;data.reason='사용불가 카드입니다.';}
    if(d.main1Only&&ctx.battle.phase!=='MAIN1'){data.allowed=false;data.reason='메인 페이즈 1에서만 사용할 수 있습니다.';}
    if(card.availableFrom!==undefined&&card.availableFrom>turn){data.allowed=false;data.reason='아직 사용할 수 없는 카드입니다.';}
    if(d.limited&&f.limitedUsed[card.cardId]===turn){data.allowed=false;data.reason='이번 턴에 이미 사용한 제한 카드입니다.';}
    f.status.cardLocks.forEach(function(l){if(l.from<=turn&&l.until>=turn&&(!l.elements||l.elements.indexOf(d.element)>=0)){data.allowed=false;data.reason='현재 이 카드를 사용할 수 없습니다.';}});
    ctx.modify('cardUsable',data);return data;
  }
  function redactTrapChoices(status,targetSide,viewer){
    ((status.cards||{}).effects||[]).forEach(function(e){
      if(e.kind==='iceTrap'&&(e.sourceSide||other(targetSide))!==viewer){delete e.element;e.hiddenChoice=true;}
    });
    return status;
  }
  function publicFighter(f){return {name:f.name,hp:f.hp,maxHp:f.maxHp,shield:f.shield,mana:f.mana,maxMana:f.maxMana,handCount:f.hand.length,deckCount:f.deck.length,restCount:f.rest.length,excludedCount:f.excluded.length,fatigueExtra:f.fatigueExtra||0,runes:clone(f.runes||[]),heroPower:clone(f.heroPower),heroPowerUsedTurn:f.heroPowerUsedTurn,playedThisTurn:f.playedThisTurn};}
  function basicScore(def,own,opp){
    var a=def.ai||{},d=a.damage||0,h=a.heal||0,draw=a.draw||0,shield=a.shield||0,v=a.value||0,control=a.control||0;
    (def.effects||[]).forEach(function(e){if(e.type==='damage')d+=e.amount||0;if(e.type==='randomDamage')d+=((e.min||0)+(e.max||0))/2;if(e.type==='heal')h+=e.amount||0;if(e.type==='draw')draw+=e.amount||0;if(e.type==='shield')shield+=e.amount||0;if(e.type==='overload')v-=(e.amount||0)*0.65;if(e.type==='scheduledDamage')d+=(e.amount||0)*(e.turns||1)*0.6;if(e.type==='lockCards')control+=3;});
    if(!def.ai&&def.rule&&!(def.effects||[]).some(function(e){return ['damage','heal','draw','randomDamage','shield','scheduledDamage'].indexOf(e.type)>=0;})){
      var text=def.text||'',m=/피해를?\s*(\d+)/.exec(text);if(m)d+=Number(m[1]);
      m=/(?:체력을?\s*)(\d+)\s*회복/.exec(text);if(m)h+=Number(m[1]);
      m=/카드를?\s*(\d+)장\s*(?:뽑|발견)/.exec(text);if(m)draw+=Number(m[1]);else if(/카드를 뽑/.test(text))draw+=1;
      if(/카운터|낼 수 없|차단/.test(text))control+=2;if(/방어도를?\s*10/.test(text))shield+=10;
      if(/승리|경고/.test(text))v+=8;if(/최대 마나/.test(text))v+=own.maxMana<5?5:0;
      if(/무작위.*사용/.test(text))v+=5;if(/비용.*감소/.test(text))v+=1;
    }
    if(d>=opp.hp+opp.shield)v+=35;
    return v+d*0.8+Math.min(h,Math.max(0,own.maxHp-own.hp))*(own.hp<=8?1.25:0.65)+Math.min(draw,Math.max(0,8-own.hand.length+1))*1.65+shield*(own.hp<own.maxHp/2?0.55:0.22)+control;
  }
  function damageEstimate(d){
    var n=d.ai&&d.ai.damage||0;(d.effects||[]).forEach(function(e){if(e.type==='damage')n+=e.amount||0;if(e.type==='randomDamage')n+=((e.min||0)+(e.max||0))/2;});
    if(!n){var m=/피해를?\s*(\d+)/.exec(d.text||'');if(m)n=Number(m[1]);}return n;
  }
  function actionPriority(d){var name=d.name.replace(/\+$/,'');if(name==='과열')return -10;if(name==='급속 성장')return -8;if(/회복|방어도/.test(d.text||''))return -4;if(name==='겨울의 뿔피리')return 4;if(/뽑|발견/.test(d.text||''))return 2;return 0;}
  function comboValue(def,own,foe,b,remainingHand,spent,totalDamage){
    var name=def.name.replace(/\+$/,''),v=0,phase1=b.phase==='MAIN1',text=def.text||'';
    if(/과부하/.test(text))v-=0.5;
    if(name==='과열')v+=remainingHand===0?(phase1?8:3):-4;

    if(name==='금단의 불꽃')v+=(own.mana-spent)*(def.upgraded?6:4)*0.8;
    if(name==='백드래프트')v+=own.deck.length*0.6;
    if(name==='지평선 절단기')v+=own.rest.length*1.4;
    if(name==='심판')v+=own.rest.filter(function(x){return x.element==='HOLY';}).length*1.5;
    if(name==='점화')v+=2.5+(own.status.cards&&own.status.cards.ignite||0)*0.45;
    if(name==='초과 인출')v+=(own.overloadNext+(own.overloadLocked||0))*2-(!own.overloadNext&&!own.overloadLocked?2:0);
    if(name==='급속 성장')v+=own.maxMana<5?4.5:0;
    if(name==='번개 개화'||name==='신비한 동전'||name==='겨울의 뿔피리')v+=phase1?3.5:-2.5;
    if(name==='자연의 모래시계'||name==='가속의 장화')v+=phase1&&remainingHand>=2?7:0;
    if(name==='완전 빙결')v-=b.turn+1>=28?0.5:0;
    if(name==='대한파')v+=phase1&&remainingHand===0?3:phase1?-1:0;
    if(name==='치유의 손길'&&own.hp===own.maxHp)v-=1.5;
    if(name==='밴 해머+++')v+=14;
    if(name==='비활성화')v+=(own.status.boss&&own.status.boss.warnings||own.status.warnings||0)>0?12:-8;
    if(name==='독버섯')v-=damageEstimate(def)*1.8+2;
    if(name==='저주'||name==='고드름')v+=4;
    if(name==='구원의 길')v+=own.status.boss&&own.status.boss.salvation!==undefined?-1:15;
    if(name==='기적같은 성장'||name==='가득 찬 가방')v+=Math.max(0,8-remainingHand)*1.2;
    if(name==='산사태'&&own.hand.some(function(x){return x.cost>=3;}))v+=1;
    if(/발견|훔쳐|가져옵/.test(text))v+=phase1?0.7:0.2;
    if(phase1&&/이번 턴.*비용|이번 턴.*마나|이번 턴.*레스트/.test(text))v+=1.4;
    if(b.turn+1>=20&&own.hp<=1+(b.turn+1-20)&&/회복|방어도/.test(text))v+=/회복/.test(text)?8:-2;
    return v;
  }
  function powerValue(power,own,opp,b,ctx){
    var id=power.rule||power.id,v=basicScore(power,own,opp);
    if((id==='lich_king'||id==='mida')&&opp.restCount===0)return -10;
    if((id==='faceless_manipulator'||id==='black_knight')&&opp.handCount===0)return -10;
    if((id==='boo'||id==='ivysaur')&&A4.AIEvaluation)return A4.AIEvaluation.evaluateCard(power,own,opp,b,ctx.catalog).score;
    if(id==='aviana')return Math.min(4,own.maxHp-own.hp)*(own.hp<8?1.5:0.8);
    if(id==='aurelion_sol')return 3+Math.min(5,own.hand.filter(function(x){return damageEstimate(ctx.def(x))>0;}).length);
    if(id==='extreme_troll'&&!own.deck.length&&!own.rest.length)return opp.deckCount>0?0.8:-2;
    if(id==='patchwerk')return Math.min(12,own.hp*0.45)+Math.min(8,own.maxHp*0.18);
    if(id==='plague_doctor')return 20+(own.status.baptisms||0)*1.2-Math.max(0,opp.maxHp-opp.hp)*0.1;
    if(id==='teemo')return opp.deckCount<8?6.5:4;
    if(id==='mida')return Math.min(3,opp.restCount)*1.8;
    if(id==='lich_king')return own.hand.length<8?5:0;
    if(id==='faceless_manipulator')return opp.handCount>5?1.3:0.5;
    return v===0&&power.rule?2.8:v;
  }
  function bestChoice(options,own,c){
    var best=options[0],v=-Infinity;options.forEach(function(o){var score=o.cardId?basicScore(describe(o,c),own,{hp:30,shield:0}):0;if(score>v){v=score;best=o;}});return best;
  }
  function legacyPlan(b,c,rng,observed){
     

    var publicOpponent=publicFighter(b.player),redacted={rulesVersion:3,turn:b.turn,phase:b.phase,enemy:clone(b.enemy),history:clone(b.history),scheduled:[],lastLog:[],runChanges:[],generatedCounter:0};redacted.player={name:publicOpponent.name,hp:publicOpponent.hp,maxHp:publicOpponent.maxHp,shield:publicOpponent.shield,mana:publicOpponent.mana,maxMana:publicOpponent.maxMana,hand:[],deck:[],rest:[],excluded:[],inFlight:[],runes:clone(b.player.runes||[]),handCount:publicOpponent.handCount,deckCount:publicOpponent.deckCount,restCount:publicOpponent.restCount,passives:[],status:{cardLocks:[],foresightTurns:[]},playedThisTurn:publicOpponent.playedThisTurn,heroPower:publicOpponent.heroPower,fatigueExtra:publicOpponent.fatigueExtra,usedThisTurn:[],lastTurnCards:[]};
    redacted.player.status.poison=(b.player.status||{}).poison||0;
    redacted.player.status.cosmicBonus=(b.player.status||{}).cosmicBonus||0;
    redacted.player.status.cardLocks=clone((b.player.status||{}).cardLocks||[]);
    redacted.player.status.cards={effects:((((b.player.status||{}).cards||{}).effects)||[]).filter(function(e){return ['healScale','forbiddenElements','elementOverride'].indexOf(e.kind)>=0;}).map(clone)};
    redactTrapChoices(redacted.enemy.status,'enemy','enemy');
    var ctx=context(redacted,c,function(){return 0.5;},{side:'enemy'},[]),f=redacted.enemy,eligible=[];
    f.hand.forEach(function(card){var d=ctx.def(card);if(d.rule==='poison_powder'&&f.heroPower&&f.heroPower.id==='ivysaur'&&(b.player.drawnCountThisTurn||0)<2)return;if(A4.AIEvaluation){var evaluation=A4.AIEvaluation.evaluateCard(d,f,redacted.player,redacted,c);if(evaluation.cleanseAllowed===false||evaluation.prayerAllowed===false)return;}if(usable(ctx,'enemy',card).allowed&&(f.hand.length<=1||d.rule!=='불안정한 원소'))eligible.push(card);});
    var history=b.history.slice(-12),freq={};history.forEach(function(h){(h.player||[]).forEach(function(x){var el=x.element||(c.cards[x.cardId]||{}).element;if(el)freq[el]=(freq[el]||0)+1;});});
    if(observed){freq={};observed.forEach(function(x){freq[x.def.element]=(freq[x.def.element]||0)+1;});publicOpponent.knownSubmission=observed.map(function(x){return clone(x.def);});}
    if(!Object.keys(freq).length){Object.keys(COUNTERS).forEach(function(el){freq[el]=1;});}
    var publicPrediction=!observed&&A4.AIEvaluation?A4.AIEvaluation.predict(redacted,c):null;
    if(publicPrediction)freq=publicPrediction.elements;
    var total=Object.keys(freq).reduce(function(n,k){return n+freq[k];},0)||1;
    var best={uids:[],heroPower:false,score:0},power=f.heroPower,powerAllowed=power&&power.kind==='active'&&f.heroPowerUsedTurn!==b.turn&&(f.heroPowerReadyTurn||0)<=b.turn;
    if(power&&power.id==='teemo'&&b.player.deck.filter(function(x){return x.cardId==='poisonous_mushroom';}).length>3)powerAllowed=false;
    if(power&&power.id==='plague_doctor'&&f.heroPowerUsedTurn>=0&&f.heroPowerUsedTurn===b.turn-1)powerAllowed=false;
    if(power&&power.id==='ivysaur'&&((b.player.status||{}).poison||0)>0&&((b.player.status||{}).poison||0)<3)powerAllowed=false;
    var pdata={side:'enemy',power:power,allowed:!!powerAllowed};ctx.modify('powerUsable',pdata);powerAllowed=pdata.allowed;
    var pcost=powerAllowed?ctx.powerCost('enemy',power):100,pscore=powerAllowed?powerValue(power,f,redacted.player,redacted,ctx):0;
    if(powerAllowed&&power.id==='nurture')pscore=f.hand.length?f.hand.filter(function(x){return ctx.def(x).cost>0;}).length/f.hand.length*2:0;
    var max=1<<Math.min(eligible.length,12);
    for(var mask=0;mask<max;mask++)for(var useP=0;useP<=(powerAllowed?1:0);useP++){
      var sum=useP?pcost:0,score=useP?pscore:0,ids=[],seen={},valid=true,selected=[],damageSum=0;
      for(var ci=0;ci<eligible.length;ci++)if(mask&(1<<ci))selected.push(eligible[ci]);
      selected.sort(function(a,z){return actionPriority(ctx.def(a))-actionPriority(ctx.def(z));});
      var batchCost=(useP?pcost:0)+selected.reduce(function(n,card,index){return n+ctx.cost('enemy',card,index===0&&f.playedThisTurn===0);},0);
      if(batchCost>f.mana)continue;
      if(observed){redacted.player.knownSubmission=observed.map(function(x){return clone(x.def);});redacted.player.knownSubmissionTurn=redacted.turn;redacted.player.knownSubmissionPhase=redacted.phase;}
      var batch=A4.AIEvaluation&&A4.AIEvaluation.evaluateBatch(selected.map(function(card,index){return {card:card,def:ctx.def(card),paidCost:ctx.cost('enemy',card,index===0&&f.playedThisTurn===0)};}),f,redacted.player,redacted,c,batchCost);if(batch&&!batch.allowed)continue;
      var prayerOwn=f,prayerFoe=redacted.player;if(f.heroPower&&f.heroPower.id==='yuumi'){prayerOwn=clone(f);prayerFoe=clone(redacted.player);}
      for(var i=0;i<selected.length;i++){
        var card=selected[i],def=ctx.def(card),cost=ctx.cost('enemy',card,ids.length===0&&f.playedThisTurn===0);
        if(def.rule==='salvation_prayer'&&f.heroPower&&f.heroPower.id==='yuumi'&&A4.AIEvaluation){var prayer=A4.AIEvaluation.prayerPolicy(def,prayerOwn,prayerFoe,redacted,c);if(!prayer.allowed){valid=false;break;}prayerOwn.hp+=prayer.selfHeal;prayerFoe.hp+=prayer.otherHeal;if(prayer.otherHeal>0)prayerOwn.status.yuumiHealTurn=b.turn;}
        if((def.limited||def.rule==='금단의 불꽃')&&seen[card.cardId]){valid=false;break;}seen[card.cardId]=true;sum+=cost;ids.push(card.uid);
        var chance=(freq[COUNTERS[def.element]]||0)/total,against=0;
        Object.keys(COUNTERS).forEach(function(el){if(COUNTERS[el]===def.element||(def.unstable&&el===def.element))against+=(freq[el]||0)/total;});
        score+=((def.rule==='금단의 불꽃'||def.rule==='boo_ghost_raider')&&batch?batch.metrics[i].score:basicScore(def,f,publicOpponent))*(1-against*(observed?1:0.45))+chance*(observed?4:publicPrediction&&publicPrediction.constrained?4*(1-publicPrediction.passChance):1.4)-cost*0.15;
        if(A4.AIEvaluation){var evaluation=A4.AIEvaluation.evaluateCard(def,f,redacted.player,redacted,c);score+=(evaluation.cleanseBonus||0)+(evaluation.prayerBonus||0)-(evaluation.fullHealthPenalty||0);}
        damageSum+=((def.rule==='금단의 불꽃'||def.rule==='boo_ghost_raider')&&batch?batch.metrics[i].damage:damageEstimate(def))*(1-against*(observed?1:0.4));
        if(def.unstable)score-=against*0.8;
      }
      if(!valid||sum>f.mana)continue;
      selected.forEach(function(card){if(batch&&ctx.def(card).rule==='금단의 불꽃')return;score+=comboValue(ctx.def(card),f,publicOpponent,b,f.hand.length-selected.length,sum,damageSum);});
      if(damageSum>=publicOpponent.hp+publicOpponent.shield)score+=45;
       
      if(b.phase==='MAIN1')score+=(batch?batch.mana:f.mana-sum)*0.48-Math.max(0,ids.length-2)*0.15;
      if(score>best.score+0.00001){best={uids:ids,heroPower:!!useP,score:score};}
    }
    return best;
  }
  function plan(b,c,rng,observed){return A4.AI?A4.AI.plan(b,c,rng,observed):legacyPlan(b,c,rng,observed);}
  function preparePlan(b,c,rng){if(b._aiSimulation){b.enemyPlan=[];b.enemyPowerPlan=false;b.enemyPlanDeferred=false;return;}var p=plan(b,c,rng);b.enemyPlan=p.uids;b.enemyPowerPlan=p.heroPower;b.enemyPlanTurn=b.turn;b.enemyPlanPhase=b.phase;b.enemyPlanDeferred=b.enemy.status.foresightTurns.indexOf(b.turn)>=0&&b.player.status.foresightTurns.indexOf(b.turn)<0;}
  function event(ctx,e){
    if(e.type==='standby')SIDES.forEach(function(side){var f=ctx.fighter(side),amount=f.status.poison||0;
      if(amount){ctx.withSource(side,{name:'중독',element:'NATURE'},function(){ctx.damage(other(side),side,amount,{card:null,noBonus:true});});
        if(!(A4.TreasureRules&&A4.TreasureRules.owns&&A4.TreasureRules.owns(ctx.fighter(other(side)),'decay_potion')))f.status.poison=Math.max(0,amount-1);
      }
    });
    modules().forEach(function(m){if(m.hook)m.hook(ctx,e);});
  }
  function dispatch(ctx,t){
    var module=t.module==='cards'?A4.CardRules:t.module==='treasures'?A4.TreasureRules:t.module==='boss'?A4.BossRules:t.module==='keywords'?A4.Keywords:t.module==='classes'?A4.Classes:t.module==='expansion'?A4.Expansion:t.module==='runes'?A4.Runes:null;
    if(module&&module.run&&module.run(ctx,t)===true)return true;
    if(!t.module){var list=modules();for(var i=0;i<list.length;i++)if(list[i].run&&list[i].run(ctx,t)===true)return true;}
    return false;
  }
  function cardTask(entry,side,free){var d=entry.def;return {kind:'card',module:d.module||(d.treasure?'treasures':d.exclusive?'boss':'cards'),side:side,card:clone(entry.card),def:clone(d),targets:clone(entry.targets||[]),critical:!!entry.didCounter,free:!!free,fromDraw:!!entry.fromDraw,step:0};}
  function effect(ctx,t){
    var e=t.effect,s=t.side,opp=other(s),targets=e.target==='both'?SIDES:[e.target==='opponent'?opp:s],f=ctx.battle[s];
    if(A4.Keywords&&A4.Keywords.effect(ctx,t))return;
    switch(e.type){
    case 'damage':ctx.damage(s,e.target==='self'?s:opp,e.amount);break;
    case 'discountRandomHand':var discounted=ctx.pick(f.hand.filter(function(x){return ctx.cost(s,x)>0;}));if(discounted){var beforeCost=ctx.cost(s,discounted);discounted.costDelta=(discounted.costDelta||0)-e.amount;discounted.costFloor=0;var afterCost=ctx.cost(s,discounted);ctx.note('discount',s,beforeCost-afterCost,{text:beforeCost+' → '+afterCost,cards:s==='player'?[label(ctx.def(discounted))]:null});}else ctx.note('powerNoTarget',s,0);break;
    case 'randomPoison':ctx.poison(s,opp,e.min+Math.floor(ctx.rng()*(e.max-e.min+1)));break;
    case 'heal':targets.forEach(function(x){ctx.heal(x,e.amount);});break;
    case 'shield':targets.forEach(function(x){ctx.shield(x,e.amount);});break;
    case 'draw':targets.forEach(function(x){ctx.draw(x,e.amount);});break;
    case 'randomDamage':ctx.damage(s,opp,e.min+Math.floor(ctx.rng()*(e.max-e.min+1)));break;
    case 'overload':ctx.overload(s,e.amount);break;
    case 'mana':ctx.mana(s,e.amount,e.recover);break;
    case 'generate':for(var i=0;i<(e.amount||1);i++)ctx.generate(e.target==='opponent'?opp:s,e.cardId,{upgraded:!!e.upgraded,zone:e.zone||'hand'});break;
    case 'growMana':if(f.maxMana<5){f.manaGrowth+=e.amount;f.maxMana=Math.min(5,f.maxMana+e.amount);}else if(e.cardId)ctx.generate(s,e.cardId,{upgraded:!!e.upgraded});break;
    case 'lockCards':ctx.lock(opp,ctx.battle.turn+e.from,ctx.battle.turn+e.until,e.elements);break;
    case 'foresight':f.status.foresightTurns.push(ctx.battle.turn+e.amount);break;
    case 'scheduledDamage':for(var j=1;j<=e.turns;j++)ctx.schedule(ctx.battle.turn+j,'STANDBY',{kind:'effect',side:s,card:t.card,effect:{type:'damage',amount:e.amount}});break;
    case 'excludeSelf':ctx.move(s,t.card.uid,'excluded');break;
    case 'removeFromRun':ctx.move(s,t.card.uid,'excluded');ctx.runChange({type:'removeCard',side:s,uid:t.card.uid});ctx.battle.removedFromRun.push(t.card.uid);break;
    case 'upgradeSelf':var live=ctx.find(s,t.card.uid);if(live)ctx.upgrade(live);break;
    case 'dredge':ctx.discover(s,f.deck.slice(-e.amount),{kind:'coreChoice',side:s,op:'dredge'},{label:'덱 맨 위에 놓을 카드를 선택하세요.',sourceZone:'deck'});break;
    default:A4.assert(false,'처리되지 않은 카드 효과: '+e.type);
    }
  }
  function scheduled(ctx,phase){var b=ctx.battle,remaining=[];b.scheduled.forEach(function(x){if(x.turn===b.turn&&x.phase===phase)ctx.enqueue(x.task);else if(x.turn>=b.turn)remaining.push(x);});b.scheduled=remaining;}
  function core(ctx,t){
    var b=ctx.battle,s=t.side||'player',f=b[s],i,d,card,entries;
    if(t.kind==='effect'&&t.runeSource){var activeRune=A4.Runes.current(b[t.runeSource.side]);if(!activeRune||activeRune.uid!==t.runeSource.uid||t.runeSource.activation!==undefined&&activeRune.runeActivationId!==t.runeSource.activation)return;}
    if(t.kind==='event'){
      if(b.resolution.suppressed&&['draw','cardRest','damage','heal','counter','powerUsed','cardUsed','cardResolved','discovered','overload','refill'].indexOf(t.event.type)>=0)return;
       
       
      if(t.event.card&&t.event.card.uid&&t.event.side){var liveCard=ctx.find(t.event.side,t.event.card.uid);if(liveCard)t.event.card=liveCard;}
      event(ctx,t.event);return;
    }
    if(t.kind==='choiceRequest'){
      var settings=t.settings||{},resume=clone(t.continuation),options=t.options;
      if(s==='enemy'||b._aiSimulation){
        var choiceBattle=b._aiSimulation?b:(A4.AI?A4.AI.publicSnapshot(b,ctx.catalog):b);
        var selected=A4.AIChoices?A4.AIChoices.choose(options,choiceBattle,ctx.catalog,settings,resume):bestChoice(options,b[s],ctx.catalog);resume.choice=clone(selected);resume.options=clone(options);
        if(settings.discover)resume.discoveryEvent={type:'discovered',side:s,choice:clone(selected),options:clone(options),sourceZone:settings.sourceZone||null};
        ctx.enqueue(resume);
      }else{A4.assert(!b.pendingChoice,'동시에 두 선택을 요청할 수 없습니다.');b.pendingChoice={kind:settings.discover?'discovery':'choice',discover:!!settings.discover,label:settings.label||'카드를 선택하세요.',options:clone(options),continuation:resume,sourceZone:settings.sourceZone||null,lamp:!!settings.lamp,lampStage:settings.lamp?'search':null};}
      return;
    }
    if(t.kind==='effect'){effect(ctx,t);return;}
    if(t.kind==='coreChoice'){
      if(t.op==='dredge'){card=ctx.remove(s,t.choice.uid);if(card){f.deck.unshift(card);if(ctx.cost(s,card)<=f.mana)ctx.draw(s,1);}}return;
    }
    if(t.kind==='card'){
      if(b.resolution.suppressed&&t.free&&!t.reflected)return;
      if(t.def.rune&&A4.Runes)A4.Runes.activate(ctx,t);
      if(t.def.rule){A4.assert(dispatch(ctx,t),'카드 구현 누락: '+t.def.name);return;}
      (t.def.effects||[]).forEach(function(e){if(!e.critical||t.critical)ctx.enqueue({kind:'effect',side:s,card:t.card,effect:e});});return;
    }
    if(t.kind==='power'){
      if(t.power.rule||t.power.module){A4.assert(dispatch(ctx,t),'영웅 능력 구현 누락: '+t.power.name);}
      else (t.power.effects||[]).forEach(function(e){ctx.enqueue({kind:'effect',side:s,effect:e});});
      ctx.emit('powerUsed',{side:s,power:t.power});return;
    }
    if(t.kind==='cast'){
      if(b.resolution.suppressed){if(!t.copy&&ctx.find(s,t.card.uid))ctx.enqueue({kind:'finalizeCard',side:s,card:t.card,countered:false});return;}
      card=t.card;d=ctx.def(card);if(t.copy){f.inFlight.push(card);}else if(!ctx.find(s,card.uid))f.inFlight.push(card);
      var parent=t.displayNode&&b.report&&t.displayNode.serial===b.report.serial?t.displayNode.id:null,castNode=node(b,s,d,card,parent);
      t.displayNode={serial:b.report.serial,id:castNode.id};t.displaySource={side:s,label:castNode.label};
      ctx.emit('cardUsed',{side:s,card:card,def:d,free:true,countered:false,critical:false});
      ctx.enqueue(cardTask({card:card,def:d,fromDraw:t.fromDraw},s,true));ctx.emit('cardResolved',{side:s,card:card,def:d,free:true,countered:false,critical:false});ctx.enqueue({kind:'finalizeCard',side:s,card:card,countered:false});return;
    }
    if(t.kind==='finalizeCard'){
      var l=locate(f,t.card.uid);if(!l.card||l.zone!=='inFlight')return;card=l.card;d=ctx.def(card);
      if(card.originalCardId){card.cardId=card.originalCardId;card.upgraded=card.originalCardId==='crystal_ball'?!!card.crystalUpgraded:false;delete card.noUpgrade;delete card.cost;delete card.costDelta;delete card.element;delete card.originalCardId;delete card.transformed;d=ctx.def(card);}
      if(card.swallowedBy)ctx.withSource(card.swallowedBy,A4.BossRules.power('piranha_plant'),function(){ctx.move(s,card.uid,'excluded',{logEffect:true});});
      else ctx.move(s,card.uid,(!t.countered&&d.excludeOnUse)?'excluded':'rest');return;
    }
    if(t.kind==='phase'){
      if(t.op==='opening'){
        SIDES.forEach(function(side){var p=b[side],innate=p.deck.filter(function(x){return ctx.def(x).innate;}).slice(0,4);innate.forEach(function(x){ctx.move(side,x.uid,'hand');});ctx.draw(side,4-p.hand.length,null,{opening:true});});
        b.phase='STANDBY';ctx.emit('battleStart',{});ctx.emit('standby',{opening:true});ctx.emit('beforeDeath',{phase:'STANDBY'});ctx.enqueue({kind:'phase',op:'death',next:'main1'});return;
      }
      if(t.op==='main'){
        b.phase=t.phase;b.phaseSerial++;scheduled(ctx,t.phase);ctx.emit('beforeMain',{phase:t.phase});ctx.emit('beforeDeath',{phase:t.phase});ctx.enqueue({kind:'phase',op:'death',next:'ready'});return;
      }
      if(t.op==='ready'){preparePlan(b,ctx.catalog,ctx.rng);return;}
      if(t.op==='afterCombat'){
        ctx.emit('mainSubmissionResolved',{entries:clone(b.resolution.entries),phase:b.phase});
        ctx.emit('beforeDeath',{phase:b.phase});ctx.enqueue({kind:'phase',op:'death',next:b.phase==='MAIN1'?'main2':'end'});return;
      }
      if(t.op==='death'){
        if(b.restartRequested){
          var changes=clone(b.runChanges),specs=clone(b.restartSpecs),serial=b.phaseSerial,generated=b.generatedCounter;
          changes.forEach(function(change){if(change.type==='removeTreasure'){var id=change.treasureId||change.id,who=change.side||'player';specs[who].treasureIds=(specs[who].treasureIds||[]).filter(function(x){return x!==id;});specs[who].passives=(specs[who].passives||[]).filter(function(x){return x.treasureId!==id&&x.id!==id&&x.rule!==id;});}});
          var restarted=create(specs.player,specs.enemy,ctx.catalog,ctx.rng,b._aiSimulation?{simulation:true,steps:b._aiStepsRemaining}:null),keys=Object.keys(b);keys.forEach(function(k){delete b[k];});Object.keys(restarted).forEach(function(k){b[k]=restarted[k];});b.runChanges=changes;b.phaseSerial=Math.max(serial+1,b.phaseSerial);b.generatedCounter=Math.max(generated,b.generatedCounter);b.lastLog.unshift('귀환석 — 같은 상대와 전투를 다시 시작합니다.');report(b).logs.unshift({type:'text',text:'귀환석으로 같은 상대와 전투를 다시 시작합니다.'});return;
        }
        if(b.preventDeath){b.preventDeath=false;return;}
        if(b.player.hp<=0||b.specialDefeat){b.outcome='defeat';b.resolution.queue=[];return;}
        if(b.enemy.hp<=0||b.specialVictory){b.outcome='victory';b.resolution.queue=[];return;}
        if(t.next==='ready')ctx.enqueue({kind:'phase',op:'ready'});
        if(t.next==='main2')ctx.enqueue({kind:'phase',op:'main',phase:'MAIN2'});
        if(t.next==='end')ctx.enqueue({kind:'phase',op:'end'});
        if(t.next==='standby')ctx.enqueue({kind:'phase',op:'standby'});
        if(t.next==='main1')ctx.enqueue({kind:'phase',op:'main',phase:'MAIN1'});return;
      }
      if(t.op==='end'){
        b.phase='END';scheduled(ctx,'END');ctx.emit('end',{});ctx.enqueue({kind:'phase',op:'cleanup'});return;
      }
      if(t.op==='cleanup'){
        SIDES.forEach(function(side){b[side].hand.slice().forEach(function(x){var def=ctx.def(x);if(def.volatile){ctx.move(side,x.uid,'excluded');return;}if((def.temporary||A4.TreasureRules&&A4.TreasureRules.owns&&A4.TreasureRules.owns(b[side],'time_potion'))&&x.temporaryUntil===undefined)x.temporaryUntil=b.turn;if(x.temporaryUntil!==undefined&&x.temporaryUntil<=b.turn)ctx.move(side,x.uid,'rest');});});
        ctx.emit('afterEnd',{});ctx.enqueue({kind:'phase',op:'clearShields'});ctx.emit('beforeDeath',{phase:'END'});ctx.enqueue({kind:'phase',op:'death',next:'standby'});return;
      }
      if(t.op==='clearShields'){SIDES.forEach(function(side){b[side].shield=0;});return;}
      if(t.op==='standby'){
        b.turn++;b.phase='STANDBY';
        SIDES.forEach(function(side){var p=b[side];p.lastTurnCards=clone(p.usedThisTurn);p.usedThisTurn=[];p.playedThisTurn=0;p.limitedUsed={};p.damageTakenLastTurn=p.damageTakenThisTurn;p.damageTakenThisTurn=0;p.drawnCountThisTurn=0;p.maxMana=Math.max(0,Math.min(5,ctx.modify('maximumMana',{side:side,value:2+Math.floor((b.turn+1)/5)+p.manaGrowth}).value));p.overloadLocked=Math.min(p.maxMana,p.overloadNext);p.mana=Math.max(0,p.maxMana-p.overloadNext);p.overloadNext=0;
          var data=ctx.modify('basicDraw',{side:side,replace:false});if(!data.replace)ctx.draw(side,data.count||1,null,{basic:true});
          p.passives.forEach(function(pass){if(pass.type==='turnDrawBonus')ctx.draw(side,pass.amount);});
        });
        scheduled(ctx,'STANDBY');ctx.emit('standby',{});ctx.enqueue({kind:'phase',op:'fatigue'});return;
      }
      if(t.op==='fatigue'){
        if(b.turn+1>=20)SIDES.forEach(function(side){ctx.fatigue(other(side),side,false);});
        ctx.emit('beforeDeath',{phase:'STANDBY'});ctx.enqueue({kind:'phase',op:'death',next:'main1'});return;
      }
    }
    A4.assert(dispatch(ctx,t),'처리되지 않은 전투 작업: '+(t.op||t.kind));
  }
  function process(b,c,rng){
    while(b.resolution&&b.resolution.queue.length&&!b.pendingChoice&&b.outcome==='ongoing'){
      if(b._aiSimulation){if(A4.AI)A4.AI.checkDeadline();if(--b._aiStepsRemaining<0)throw new Error('AI_SIMULATION_LIMIT');}
      b.resolution.steps=(b.resolution.steps||0)+1;
      if(b.resolution.steps>2000&&!b.resolution.suppressed){b.resolution.suppressed=true;b.lastLog.push('반복 효과가 2,000회를 넘어 추가 연쇄 발동을 멈춥니다. 제출한 카드와 페이즈 처리는 계속됩니다.');report(b).logs.push({type:'text',text:'반복 효과가 2,000회를 넘어 추가 연쇄 발동을 멈춥니다. 제출한 카드와 페이즈 처리는 계속됩니다.'});}
      var t=b.resolution.queue.shift(),spawned=[];if(t.discoveryEvent)t.discoveryEvent.beforeHandUids=b[t.side].hand.map(function(x){return x.uid;});core(context(b,c,rng,t,spawned),t);if(A4.Keywords)SIDES.forEach(function(side){A4.Keywords.observe(b[side]);});
      if(b.escapeRequested){b.resolution=null;b.pendingChoice=null;break;}
      if(t.discoveryEvent){t.discoveryEvent.castUids=spawned.filter(function(x){return x.kind==='cast'&&x.side===t.side;}).map(function(x){return x.card.uid;});spawned.unshift({kind:'event',side:t.side,event:clone(t.discoveryEvent)});}
      if(b.resolution) b.resolution.queue=spawned.concat(b.resolution.queue);
    }
    if(b.resolution&&!b.resolution.queue.length&&!b.pendingChoice)b.resolution=null;
    return {outcome:b.outcome,log:clone(b.lastLog),pending:!!b.pendingChoice,removedFromRun:clone(b.removedFromRun)};
  }
  function create(p,e,c,rng,internalOptions){
    var b={rulesVersion:3,turn:0,phase:'MAIN1',phaseSerial:0,outcome:'ongoing',player:fighter(p,c,rng),enemy:fighter(e,c,rng),enemyPlan:[],enemyPowerPlan:false,enemyPlanTurn:0,enemyPlanPhase:'MAIN1',enemyPlanDeferred:false,history:[],generatedCounter:0,removedFromRun:[],runChanges:[],scheduled:[],pendingChoice:null,lastLog:[],resolution:{queue:[{kind:'phase',op:'opening'}],entries:null},restartSpecs:{player:clone(p),enemy:clone(e)}};
    if(internalOptions&&internalOptions.simulation){b._aiSimulation=true;b._aiStepsRemaining=internalOptions.steps===undefined?400:internalOptions.steps;}
    if(internalOptions&&internalOptions.publicPlayerHistory)b.publicPlayerHistory=clone(internalOptions.publicPlayerHistory);
     
    b.publicPlayerDeck=(p.deck||[]).map(function(card){var known={cardId:card.cardId,upgraded:!!card.upgraded};['cost','costDelta','costFloor','element'].forEach(function(k){if(card[k]!==undefined)known[k]=card[k];});return known;}).sort(function(a,z){return JSON.stringify(a).localeCompare(JSON.stringify(z));});
    process(b,c,rng);return b;
  }
  function validateSubmission(ctx,s,uids,usePower){
    var f=ctx.battle[s],cards=[],seen={},limited={},cost=0,bloodCost=0;var submission=ctx.modify('submission',{side:s,uids:uids,allowed:true});A4.assert(submission.allowed,submission.reason||'제출할 수 없는 행동입니다.');
    uids.forEach(function(uid){A4.assert(!seen[uid],'같은 카드를 중복 제출할 수 없습니다.');seen[uid]=true;var card=f.hand.filter(function(x){return x.uid===uid;})[0];A4.assert(card,'손에 없는 카드입니다.');var u=usable(ctx,s,card);A4.assert(u.allowed,u.reason);var d=ctx.def(card);if(d.limited){A4.assert(!limited[card.cardId],'제한 카드는 한 턴에 한 장만 사용할 수 있습니다.');limited[card.cardId]=true;}var paidCost=ctx.cost(s,card,cards.length===0&&f.playedThisTurn===0),observed=ctx.battle._aiObservedCosts;if(ctx.battle._aiSimulation&&s==='player'&&ctx.battle._aiObservedCostTurn===ctx.battle.turn&&ctx.battle._aiObservedCostPhase===ctx.battle.phase&&observed&&observed[card.uid]!==undefined)paidCost=observed[card.uid];if(d.bloodCost!==undefined)bloodCost+=paidCost;else cost+=paidCost;cards.push({card:card,def:d,paidCost:paidCost,bloodPaid:d.bloodCost!==undefined?paidCost:0,countered:false,didCounter:false,targets:[],side:s});});
    if(usePower){var power=f.heroPower;A4.assert(power&&power.kind==='active','사용형 영웅 능력이 없습니다.');var allowed=f.heroPowerUsedTurn!==ctx.battle.turn&&(f.heroPowerReadyTurn||0)<=ctx.battle.turn;var data=ctx.modify('powerUsable',{side:s,power:power,allowed:allowed,bloodAvailable:(f.bloodstones||0)-bloodCost});A4.assert(data.allowed,'이번 턴에는 영웅 능력을 사용할 수 없습니다.');cost+=ctx.powerCost(s,power);}
    var hpCost=0;if(A4.Classes&&A4.Classes.alive(f,'hireek').length){hpCost=cards.reduce(function(sum,x){return sum+(x.def.bloodCost===undefined?x.paidCost*5:0);},0);cost-=hpCost/5;A4.assert(hpCost<f.hp,'카드 비용으로 지불할 체력이 부족합니다.');}
    A4.assert(cost<=f.mana,'마나가 부족합니다.');A4.assert(bloodCost<=(f.bloodstones||0),'혈석이 부족합니다.');return {cards:cards,cost:cost,hpCost:hpCost,bloodCost:bloodCost,power:!!usePower};
  }
  function submit(b,uids,c,rng,options){
    options=options||{};A4.assert(b.outcome==='ongoing'&&!b.pendingChoice&&!b.resolution,'현재 제출할 수 없습니다.');A4.assert(b.phase==='MAIN1'||b.phase==='MAIN2','메인 페이즈가 아닙니다.');
    var initialTasks=[],ctx=context(b,c,rng,{side:'player'},initialTasks),p=validateSubmission(ctx,'player',uids,options.heroPower);
    if(b.enemyPlanDeferred&&b.player.status.foresightTurns.indexOf(b.turn)<0){var reactive=plan(b,c,rng,p.cards);b.enemyPlan=reactive.uids;b.enemyPowerPlan=reactive.heroPower;}
    var e=validateSubmission(ctx,'enemy',b.enemyPlan||[],b.enemyPowerPlan),groups={player:p.cards,enemy:e.cards};
    b.lastLog=[];b.report={turn:b.turn,phase:b.phase,serial:b.phaseSerial,submitted:true,nodes:[],logs:[]};b.resolution={queue:[],entries:groups,phase:b.phase};
    SIDES.forEach(function(s){var chosen=s==='player'?p:e;if(chosen.power){var pn=node(b,s,b[s].heroPower,null);pn.power=true;}chosen.cards.forEach(function(entry){entry.displayId=node(b,s,entry.def,entry.card).id;});});
    SIDES.forEach(function(s){var chosen=s==='player'?p:e,names=chosen.cards.map(function(x){return x.def.name;});if(chosen.power)names.push('능력: '+b[s].heroPower.name);ctx.log(b[s].name+' 제출 — '+(names.join(', ')||'쉬기'));});
    SIDES.forEach(function(s){var plan=s==='player'?p:e,f=b[s];f.mana-=plan.cost;f.hp-=plan.hpCost||0;if(plan.bloodCost){f.bloodstones-=plan.bloodCost;ctx.runChange({type:'bloodstones',side:s,amount:f.bloodstones});}if(plan.power){f.heroPowerUsedTurn=b.turn;if(f.heroPower.cooldown)f.heroPowerReadyTurn=b.turn+f.heroPower.cooldown;}plan.cards.forEach(function(entry){ctx.move(s,entry.card.uid,'inFlight');f.playedThisTurn++;if(entry.def.limited)f.limitedUsed[entry.card.cardId]=b.turn;f.usedThisTurn.push({cardId:entry.card.cardId,uid:entry.card.uid,upgraded:entry.card.upgraded,element:entry.def.element,card:clone(entry.card),turn:b.turn,phase:b.phase});});});
    p.cards.forEach(function(a){e.cards.forEach(function(z){if(a.def.element!=='CURSE'&&z.def.element!=='CURSE'&&(COUNTERS[a.def.element]===z.def.element||((a.def.overpower||z.def.unstable)&&a.def.element===z.def.element))){z.countered=true;a.didCounter=true;a.targets.push(clone(z.card));}if(a.def.element!=='CURSE'&&z.def.element!=='CURSE'&&(COUNTERS[z.def.element]===a.def.element||((z.def.overpower||a.def.unstable)&&a.def.element===z.def.element))){a.countered=true;z.didCounter=true;z.targets.push(clone(a.card));}});});
    SIDES.forEach(function(s){groups[s].forEach(function(entry){entry.elementCountered=entry.countered;});});
    ctx.modify('beforeCardCounterPower',{entries:groups,powers:{player:p.power,enemy:e.power}});
    SIDES.forEach(function(s){groups[s].forEach(function(entry){entry.counterEligible=!entry.countered;});});
    ctx.modify('beforeCounter',{entries:groups,powers:{player:p.power,enemy:e.power}});
    ctx.modify('afterCounter',{entries:groups,powers:{player:p.power,enemy:e.power}});
    SIDES.forEach(function(s){groups[s].forEach(function(entry){b.report.nodes[entry.displayId].countered=entry.countered;});});
    var queue=b.resolution.queue;initialTasks.forEach(function(t){queue.push(t);});
    SIDES.forEach(function(s){groups[s].forEach(function(entry,index){queue.push({kind:'event',side:s,event:{type:'cardUsed',side:s,card:clone(entry.card),def:clone(entry.def),paidCost:entry.paidCost,manaPaid:entry.def.bloodCost!==undefined||(s==='player'?p:e).hpCost?0:entry.paidCost,bloodPaid:entry.bloodPaid||0,free:false,countered:entry.countered,critical:entry.didCounter,ordinal:b[s].playedThisTurn-groups[s].length+index+1}});if(entry.didCounter)queue.push({kind:'event',side:s,event:{type:'counter',side:s,card:clone(entry.card),targets:clone(entry.targets)}});});});
    SIDES.forEach(function(s){var pl=s==='player'?p:e;if(pl.power)queue.push({kind:'power',module:b[s].heroPower.module||'boss',side:s,power:clone(b[s].heroPower)});groups[s].forEach(function(entry){if(!entry.countered){queue.push(cardTask(entry,entry.reflectedBy||s,!!entry.reflectedBy));queue.push({kind:'event',side:s,event:{type:'cardResolved',side:s,card:clone(entry.card),def:clone(entry.def),free:false,countered:false,critical:entry.didCounter}});}else b.lastLog.push(entry.def.name+' 카운터');});});
    SIDES.forEach(function(s){groups[s].forEach(function(entry){queue.push({kind:'finalizeCard',side:s,card:clone(entry.card),countered:entry.countered});});});
    b.history.push({turn:b.turn,phase:b.phase,player:p.cards.map(function(x){return {cardId:x.card.cardId,upgraded:!!x.card.upgraded,element:x.def.element,countered:x.countered};}),enemy:e.cards.map(function(x){return {cardId:x.card.cardId,upgraded:!!x.card.upgraded,element:x.def.element,countered:x.countered};})});
    queue.push({kind:'phase',op:'afterCombat'});return process(b,c,rng);
  }
  function choiceOptions(p){
    var op=p.continuation&&p.continuation.op;
    if(op!=='iceTrap'&&op!=='elementChoice')return p.options;
    var order=['FIRE','NATURE','LIGHTNING','ICE','HOLY'];
    return p.options.filter(function(x){return order.indexOf(x.id)>=0;}).sort(function(a,b){return order.indexOf(a.id)-order.indexOf(b.id);});
  }
  function choose(b,index,c,rng){
    A4.assert(b.pendingChoice,'선택할 효과가 없습니다.');var p=b.pendingChoice;p.options=choiceOptions(p);A4.assert(index>=0&&index<p.options.length,'선택 번호가 올바르지 않습니다.');var t=clone(p.continuation);t.choice=clone(p.options[index]);t.options=clone(p.options);b.pendingChoice=null;
    if(p.discover)t.discoveryEvent={type:'discovered',side:t.side,choice:clone(t.choice),options:clone(t.options),sourceZone:p.sourceZone};b.resolution.queue.unshift(t);return process(b,c,rng);
  }
  function view(b){var v={turn:b.turn,phase:b.phase,outcome:b.outcome,player:clone(b.player),enemy:publicFighter(b.enemy),history:clone(b.history),lastLog:clone(b.lastLog),enemyReacting:b.enemy.status.foresightTurns.indexOf(b.turn)>=0&&b.player.status.foresightTurns.indexOf(b.turn)<0};redactTrapChoices(v.player.status,'player','player');if(b.player.status.foresightTurns.indexOf(b.turn)>=0&&b.enemy.status.foresightTurns.indexOf(b.turn)<0)v.foreseenCards=b.enemyPlan.map(function(uid){return clone(locate(b.enemy,uid).card);});return v;}
  function sync(b,passives){b.player.passives=clone(passives);}
  function validateCard(card,c){var d=describe(card,c);A4.assert(A4.integer(d.cost,0)&&d.cost<=5,'카드 비용이 올바르지 않습니다.');A4.assert(d.rule||Array.isArray(d.effects),'카드 효과가 없습니다.');if(d.rule){var m=d.module==='expansion'?A4.Expansion:d.module==='classes'?A4.Classes:d.module==='treasures'?A4.TreasureRules:d.module==='boss'?A4.BossRules:A4.CardRules;if(m&&m.supports)A4.assert(m.supports(d.rule),'효과 구현이 없습니다: '+d.rule);}}
  function validatePower(power){A4.assert(power&&power.id&&power.name,'영웅 능력 정의가 필요합니다.');A4.assert(power.kind==='active'||power.kind==='passive','영웅 능력 유형이 올바르지 않습니다.');}
  function canSubmit(b,s,c,card){try{if(b.pendingChoice||b.resolution||b.outcome!=='ongoing'||['MAIN1','MAIN2'].indexOf(b.phase)<0)return false;validateSubmission(context(b,c,function(){return 0.5;},{side:s},[]),s,card?[card.uid]:[],!card);return true;}catch(error){return false;}}
  return {create:create,submit:submit,choose:choose,publicView:view,syncPassives:sync,describeCard:describe,canSubmit:canSubmit,validateSubmission:validateSubmission,legacyPlan:legacyPlan,choiceOptions:choiceOptions,cardAllowed:function(b,s,c,card){return usable(context(b,c,function(){return 0.5;},{side:s},[]),s,card).allowed;},planEnemy:function(b,c,rng){return plan(b,c,rng).uids;},plan:plan,maximumMana:function(turn){return Math.min(5,2+Math.floor(turn/5));},fatigue:function(turn){return turn<20?0:1+(turn-20);},fatigueDamage:function(turn,f){return Math.max(1,1+(turn-20))+(f&&f.fatigueExtra||0);},validateCard:validateCard,validatePassives:function(p){A4.assert(Array.isArray(p),'지속 효과 목록이 필요합니다.');},validateHeroPower:validatePower,context:context,process:process,redactTrapChoices:redactTrapChoices,handLimit:function(b,s,c){return context(b,c,function(){return 0.5;},{side:s},[]).limit(s);},cardCost:function(b,s,card,c){return context(b,c,function(){return 0.5;},{side:s},[]).cost(s,card);},powerCost:function(b,s,c){return context(b,c,function(){return 0.5;},{side:s},[]).powerCost(s);}};
}());
(function(){
  var legacy=A4.Combat;
  A4.LegacyCombat=legacy;
  ['create','submit','choose','publicView','syncPassives','describeCard','planEnemy','validateCard','validateHeroPower'].forEach(function(name){
    var old=legacy[name];A4.Combat[name]=function(){var a=arguments,cat=null,v3=false;
      if(name==='create'){cat=a[2];v3=cat&&cat.config.engineVersion===3;}
      else if(name==='describeCard'||name==='validateCard'||name==='validateHeroPower'){cat=a[1];v3=cat&&cat.config.engineVersion===3;}
      else v3=a[0]&&a[0].rulesVersion===3;
      return (v3?A4.Battle[name]:old).apply(null,a);
    };
  });
  var oldPassives=legacy.validatePassives;A4.Combat.validatePassives=function(p){if((p||[]).some(function(x){return x.type==='treasure'||x.module==='treasures'||x.module==='classes'||x.module==='expansion';}))return A4.Battle.validatePassives(p);return oldPassives(p);};
}());

// ---- src/ai-evaluation.js ----
 




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
   
   
  function cosmicStackValue(f,b){return (10+Math.min(6,(count(f,'hand')+count(f,'deck')+count(f,'rest'))*0.3))*timeWeight(b);}
  function damageBonus(own,def){return (status(own).cosmicBonus||0)+((status(own).classes||{}).powerBonus||0)+(A4.Classes?A4.Classes.alive(own,'janalai').length*2:0)+(owns(own,'archmage_robe')?2:0)+(def.element==='LIGHTNING'?(cardsState(own).lightningBonus||0):0);}
  function damageAfter(own,opp,def,n,b,options){
    options=options||{};
    if(n<=0)return 0;
    if(!options.noBonus)n+=damageBonus(own,def);
    if(options.unblockable)return n;
    if(effects(own,'weakened',b).length)n=Math.floor(n*0.75);
    if(effects(opp,'vulnerable',b).length)n=Math.floor(n*1.5);
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
    case '점화':m.damage=5+number(st.ignite);m.value=5*0.55*timeWeight(b);break;
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
    case '얼어붙은 버클러':m.shield=10;break;
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
    case '치유의 손길':m.heal=up?15:10;break;
    case '먹음직스러운 덥석멜론':for(i=2;i<=5;i++)if(zoneCount(own,'deck',c,function(d){return d.cost===i;}))m.draw++;break;
    case '풍요':m.heal=up?14:7;m.draw=2;break;
    case '굽이치는 파도':m.damage=up?8:5;m.heal=damageAfter(own,opp,def,m.damage,b);break;
    case '기적같은 성장':m.draw=available;m.heal=available*(up?4:2);break;
    case '자연화':m.control=enemyHand?6:0;m.value-=Math.min(up?1:2,Math.max(0,8-enemyHand))*1.2;break;
    case '폭풍 인도기':m.value=zoneCount(own,'deck',c,function(d,x){return !x.upgraded&&!d.treasure&&!d.exclusive&&!d.token;})*(up?1.5:1.1);break;
    case '접붙이기':m.heal=enemyRest*(up?1.6:0.8);m.control=enemyRest*0.7;break;
    case '찌릿!':m.damage=up?5:3;m.draw=zoneCount(own,'hand',c,function(d){return d.element==='LIGHTNING';})>1?1:0;break;
    case '선조의 지혜':m.overload=1;m.draw=up?3:2;break;
    case '부스터 팩':m.draw=3;m.value=up?2:0.7;break;
    case '초과 인출':m.draw=number(own.overloadNext)+number(own.overloadLocked);m.value=number(own.overloadNext)*2;m.mana=number(own.overloadLocked);break;
    case '전선':if(up)m.value=4.5;else m.draw=1.15;break;
    case '믹스테이프':m.draw=count(opp,'deck')?1:0;m.value=up&&m.draw?1:0;break;
    case '전류 공급':m.draw=1;m.value=(number(st.currentStacks)>=1?3:1.4)*timeWeight(b);break;
    case '긴급 차단':m.draw=enemyHand?1:0;m.control=enemyHand?(up?2.5:1):0;break;
    case '천둥':m.delayedDamage=3*(up?4:2)*0.78;break;
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
    case '안도':if(!number(st.previousDamage)){m.draw=up?2:1;m.heal=4;}break;
    case '심판':holy=zoneCount(own,'rest',c,function(d){return d.element==='HOLY';});m.damage=holy*(up?3:2);break;
    case '계시':m.control=enemyHand?(up?4:2.5):0;m.draw=enemyHand?0.5:0;break;
    case '배교':m.damage=(up?6:3)+(up?6:3)*crit;break;
    case '황금궤':m.draw=up?1.2:0.7;break;
    case '필연':m.value=(up?3:2)*3.8;break;
    case '불굴':m.shield=number(opp.mana)*3+1;m.value+=number(own.hp)<8?2:0;break;
    case '성전':m.draw=1;holy=zoneCount(own,'hand',c,function(d){return d.element==='HOLY';});m.control=(holy-Math.max(0,h-holy))*0.6+2;break;
    case '성지순례':m.delayedDamage=(up?2:1)*4*timeWeight(b);break;
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
    default:if(def.module==='classes'&&A4.Classes)A4.Classes.evaluate(def,m,own,opp,b,c);else if(def.module==='expansion'&&A4.Expansion)A4.Expansion.evaluate(def,m,own,opp,b,c);else generic(def,m);
    }
     
     
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
       
       
       
      v-=reserveQuality(opp,c);
      v+=imaginedBurden(opp,b,c,true)-imaginedBurden(own,b,c,false);
    }
     
     
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
     
     
    if(b.phase==='MAIN2')knownCards.forEach(function(x){var spent=history.some(function(h){return h.turn===turn&&h.phase==='MAIN1'&&(h.player||[]).some(function(a){return a.cardId===x.cardId;});});if(spent)x.weight*=0.45;});
    return {elements:elements,passChance:clamp(pass,0,1),meanCards:mean,knownCards:knownCards,historySamples:history.length,phaseSamples:history.filter(function(h){return h.phase===b.phase;}).length,constrained:constrained,forcedElement:forced};
  }
  return {withDefinitionCache:withDefinitionCache,evaluateBatch:evaluateBatch,prayerPolicy:prayerPolicy,evaluateCard:evaluateCard,position:position,predict:predict,damageAfter:damageAfter,healing:healing,owns:owns,count:count};
}());

// ---- src/ai-choices.js ----
 
A4.AIChoices=(function(){
  'use strict';
  var ELEMENTS=['FIRE','NATURE','LIGHTNING','ICE','HOLY'];
  function copy(x){return x===undefined?undefined:JSON.parse(JSON.stringify(x));}
  function opposite(s){return s==='enemy'?'player':'enemy';}
  function count(f,key){return f[key+'Count']===undefined?(f[key]||[]).length:f[key+'Count'];}
  function publicStatus(status){
    status=status||{};var out={cardLocks:copy(status.cardLocks||[]),foresightTurns:copy(status.foresightTurns||[])};
    ['deckEmptied','awakened','execution','executionTurn','warnings','salvation','cosmicBonus','baptisms','poison','directHolyUsedTurn','directHolyCountTurn','directHolyCount','ghostWalkReflectTurn','ghostWalkReflectPhase','cleansedConfession','confession'].forEach(function(key){if(status[key]!==undefined)out[key]=copy(status[key]);});
    if(status.expansion)out.expansion=copy(status.expansion);if(status.classes)out.classes=copy(status.classes);
    if(status.cards){out.cards={};['effects','ignite','currentStacks','lightningBonus','lightningLastTurn','lightningStreak','previousDamage','drawCount','drawCountTurn'].forEach(function(key){if(status.cards[key]!==undefined)out.cards[key]=copy(status.cards[key]);});}
    if(status.treasures){out.treasures={};
       
       
      ['freeMain2Turn','escapeTurn','escapeStacks','escapeStacksTurn','previousFirstElement','main1PaidTurn','main1Paid','receiptTurn','firstElementTurn','firstElement','firstCounteredTurn','firstCounteredUid','elementCountsTurn','elementCounts','twinTriggered','twinTurn','mirrorTurn','echoTurn','savedMana'].forEach(function(key){if(status.treasures[key]!==undefined)out.treasures[key]=copy(status.treasures[key]);});
    }
    return out;
  }
  function publicFighter(f){
    var out={hand:[],deck:[],rest:[],excluded:[],inFlight:[]};
    ['heroId','fatigueExtra','bloodstones','daggers','name','hp','maxHp','shield','mana','maxMana','manaGrowth','overloadNext','overloadLocked','heroPower','heroPowerUsedTurn','heroPowerReadyTurn','playedThisTurn','damageTakenThisTurn','bossId','passives','treasureIds','limitedUsed','usedThisTurn','lastTurnCards'].forEach(function(k){if(f[k]!==undefined)out[k]=copy(f[k]);});
    ['hand','deck','rest','excluded'].forEach(function(k){out[k+'Count']=count(f,k);});
    out.runes=copy(f.runes||[]);out.status=publicStatus(f.status);return out;
  }
  function snapshot(b,side){
    var view={turn:b.turn,phase:b.phase,rulesVersion:3,history:copy(b.history||[]),scheduled:[],lastLog:[],generatedCounter:0,runChanges:[]};
    if(side==='enemy'&&b.publicPlayerDeck)view.publicPlayerDeck=copy(b.publicPlayerDeck);
    view[side]=copy(b[side]);view[opposite(side)]=publicFighter(b[opposite(side)]);['player','enemy'].forEach(function(target){A4.Battle.redactTrapChoices(view[target].status||{},target,side);});return view;
  }
  function definition(card,c){return A4.Battle.describeCard(card,c);}
  function effectiveDefinition(card,b,c,side){return A4.Battle.context(b,c,function(){return 0.5;},{side:side},[]).def(card);}
  function active(e,turn){return (e.from===undefined||e.from<=turn)&&(e.until===undefined||e.until>=turn);}
  function fallback(def,own,opp){
    var result={score:0,damage:0,heal:0,draw:0},a=def.ai||{};
    result.damage=a.damage||0;result.heal=a.heal||0;result.draw=a.draw||0;result.score=a.value||0;
    (def.effects||[]).forEach(function(e){
      if(e.type==='damage')result.damage+=e.amount||0;
      if(e.type==='randomDamage')result.damage+=((e.min||0)+(e.max||0))/2;
      if(e.type==='heal')result.heal+=e.amount||0;
      if(e.type==='draw')result.draw+=e.amount||0;
      if(e.type==='shield')result.score+=(e.amount||0)*0.5;
      if(e.type==='scheduledDamage')result.damage+=(e.amount||0)*(e.turns||1)*0.65;
    });
    result.score+=result.damage+Math.min(result.heal,Math.max(0,own.maxHp-own.hp))*(own.hp<10?1.6:0.9)+Math.min(result.draw,Math.max(0,8-own.hand.length))*2;
    if(result.damage>0&&result.damage>=opp.hp+(opp.shield||0))result.score+=50;
    return result;
  }
  function evaluation(def,own,opp,b,c){
    var result=A4.AIEvaluation&&A4.AIEvaluation.evaluateCard?A4.AIEvaluation.evaluateCard(def,own,opp,b,c):fallback(def,own,opp);
    if(typeof result==='number')return {score:result};return result;
  }
  function metric(def,own,opp,b,c){var r=evaluation(def,own,opp,b,c);return r&&typeof r.score==='number'&&isFinite(r.score)?r.score:0;}
  function manaCost(b,s,card,c){return A4.Battle.cardCost(b,s,card,c);}
  function limit(b,s,c){return A4.Battle.handLimit(b,s,c);}
  function expectedElements(b,c,target,nextTurn){
    var scores={FIRE:1,NATURE:1,LIGHTNING:1,ICE:1,HOLY:0.65},hist=b.history||[],f=b[target],turn=b.turn+(nextTurn?1:0);
    if(target==='player'&&b.publicPlayerDeck)b.publicPlayerDeck.forEach(function(card){var d=definition(card,c);if(scores[d.element]!==undefined)scores[d.element]+=0.3;});
    hist.slice(-16).forEach(function(h,index,entries){
      (h[target]||[]).forEach(function(card){var d=c.cards[card.cardId]||{},el=card.element||d.element;if(scores[el]!==undefined)scores[el]+=0.5+1.5*(index+1)/entries.length;});
    });
    var effects=f.status&&f.status.cards&&f.status.cards.effects||[],override=null;
    effects.forEach(function(e){if(e.kind==='elementOverride'&&active(e,turn))override=e.element;});
    if(override&&scores[override]!==undefined)ELEMENTS.forEach(function(el){scores[el]=el===override?100:0;});
    (f.status&&f.status.cardLocks||[]).forEach(function(lock){if(active(lock,turn))ELEMENTS.forEach(function(el){if(!lock.elements||lock.elements.indexOf(el)>=0)scores[el]=0;});});
    effects.forEach(function(e){if(e.kind==='forbiddenElements'&&active(e,turn))(e.elements||[]).forEach(function(el){scores[el]=0;});});
    return scores;
  }
  function elementValue(option,b,c,side,continuation){
    if(continuation.op==='iceTrap')return expectedElements(b,c,opposite(side),true)[option.id]||0;
    var own=b[side],zone=own.deck.length?own.deck:own.rest,cards=zone.filter(function(card){return effectiveDefinition(card,b,c,side).element===option.id;});
    if(!cards.length)return -1000;
    var values=cards.map(function(card){return acquisition(card,b,c,side,{},{});});
    var discover=(own.treasureIds||[]).indexOf('loaded_dice')>=0;
    var average=values.reduce(function(sum,v){return sum+v;},0)/values.length;
     
     
    return average+(discover?(Math.max.apply(null,values)-average)*0.7:0);
  }
  function acquisition(option,b,c,side,settings,continuation){
    var own=b[side],opp=b[opposite(side)],d=effectiveDefinition(option,b,c,side),op=continuation.op||'',free=op==='generateCast',cost=manaCost(b,side,option,c),cap=limit(b,side,c);
    if(continuation.discount)cost=Math.max(op==='discoverMove'?1:0,cost-continuation.discount);
    if(continuation.zeroUntil!==undefined||continuation.zeroCost||free)cost=0;
    d.cost=cost;
    var value=metric(d,own,opp,b,c),missing=Math.max(0,own.maxHp-own.hp),nextMana=Math.max(0,Math.min(5,own.maxMana)-(own.overloadNext||0));
    if(!free){
      var availableResource=d.bloodCost!==undefined?(own.bloodstones||0):own.mana,reachable=d.bloodCost!==undefined?availableResource:Math.max(own.mana,nextMana),turns=Math.max(0,cost-reachable);
      value=value/(1+turns*0.65)-cost*0.3;
      if(cost<=availableResource&&b.phase==='MAIN1')value+=1.6;
      if(d.temporary&&b.phase==='MAIN2')value*=0.1;
      if(d.unplayable&&!d.rule)value-=8;
      if(option.availableFrom>b.turn)value*=0.6;
      var frequencies=expectedElements(b,c,opposite(side),false),total=0,beatenBy={FIRE:'ICE',NATURE:'FIRE',LIGHTNING:'NATURE',ICE:'LIGHTNING'};
      ELEMENTS.forEach(function(el){total+=frequencies[el]||0;});
      if(value>0&&beatenBy[d.element]&&total>0&&opp.handCount>0)value*=1-0.2*(frequencies[beatenBy[d.element]]||0)/total;
      if(own.hand.length>=cap)value=0;
    }
    if(op==='dredge')value=(cost<=own.mana?value+3:value*0.45);
    if(op==='golden')value/=1+(continuation.delay||1)*0.3;
    if(op==='northern'&&d.element==='ICE'&&opp.handCount>0)value+=4.5;
    if(op==='treasureChoice'||op==='prayer')value+=Math.max(0,metric(d,own,opp,b,c))*0.12;
    if(d.element==='HOLY'&&own.status&&own.status.salvation)value+=2+6/Math.max(1,own.status.salvation.remaining||50);
    if(d.rule==='점화'&&own.bossId==='antonidas')value+=2;
     
     
    if(missing===0&&d.rule==='치유의 손길')value*=0.55;
    return value;
  }
  function opponentValue(option,b,c,side){
    var own=b[opposite(side)],opp=b[side],d=definition(option,c),revealed=copy(own);
     
    revealed.hand=[copy(option)];
    return metric(d,revealed,opp,b,c);
  }
  function score(option,b,c,settings,continuation,side){
    if(!option.cardId)return ELEMENTS.indexOf(option.id)>=0?elementValue(option,b,c,side,continuation):0;
    var op=continuation.op||'',value=acquisition(option,b,c,side,settings,continuation),d=definition(option,c),enemyOwner=continuation.owner===opposite(side);
    var rawValue=op==='cycle'||op==='shortCircuit'?metric(d,b[side],b[opposite(side)],b,c):0;
    if(op==='cycle')return -rawValue;
    if(op==='shortCircuit'){
      var cap=limit(b,side,c),cost=manaCost(b,side,option,c);
      return Math.min(cost,Math.max(0,cap-b[side].hand.length))*2.8-rawValue*0.4;
    }
    if(op==='hibernate'||op==='revelation'||op==='weaknessDiscard'||op==='hookDiscard')return opponentValue(option,b,c,side);
    if(op==='grave')return opponentValue(option,b,c,side)*0.7+(continuation.upgraded?value:0);
    if(op==='stealRest'||op==='intercept'||(op==='take'&&enemyOwner))value+=Math.max(0,opponentValue(option,b,c,side))*0.35;
    return value;
  }
  function choose(options,b,c,settings,continuation){
    if(!options||!options.length)return null;
    settings=settings||{};continuation=continuation||{};
    var side=continuation.side==='player'?'player':'enemy',view=snapshot(b,side),best=options[0],bestScore=-Infinity;
    options.forEach(function(option){if(A4.AI)A4.AI.checkDeadline();var value=score(option,view,c,settings,continuation,side);if(value>bestScore){bestScore=value;best=option;}});
    return best;
  }
  return {choose:choose};
}());

// ---- src/ai-opponent-model.js ----
 

A4.AIOpponentModel=(function(){
  'use strict';
  function copy(x){return x===undefined?undefined:JSON.parse(JSON.stringify(x));}
  function count(f,key){return Math.max(0,f[key+'Count']===undefined?(f[key]||[]).length:f[key+'Count']);}
  function key(card){return card.cardId+'|'+(card.upgraded?1:0);}
  function drawIndex(items,rng,weight){
    var weights=items.map(function(x){return Math.max(0.001,weight(x));}),sum=weights.reduce(function(a,z){return a+z;},0),roll=rng()*sum;
    for(var i=0;i<items.length;i++){roll-=weights[i];if(roll<0)return i;}return items.length-1;
  }
  function sample(snapshot,c,seedIndex,rng,observed){
    var source=snapshot.player,fighter={},zones=['hand','deck','rest','excluded'],sizes={},serial=0,usedUids={};
     
     
    Object.keys(source).forEach(function(field){if(zones.indexOf(field)<0&&field!=='inFlight'&&!/Count$/.test(field))fighter[field]=copy(source[field]);});
    zones.forEach(function(zone){sizes[zone]=count(source,zone);fighter[zone]=[];});fighter.inFlight=[];
    var pool=[],weights={},maxCopies={},upgradedCopies={},lastSeen={},history=(snapshot.publicPlayerHistory||[]).concat(snapshot.history||[]).slice(-48),ordinary=c.cardPool&&c.cardPool.length?c.cardPool:Object.keys(c.cards);
    var prediction=A4.AIEvaluation&&A4.AIEvaluation.predict?A4.AIEvaluation.predict(snapshot,c):{knownCards:[],elements:{}};
    (prediction.knownCards||[]).forEach(function(card){if(c.cards[card.cardId])weights[key(card)]=(weights[key(card)]||0)+card.weight;});
    function add(id,up){if(c.cards[id])pool.push({cardId:id,upgraded:!!up});}
    var hero=(c.heroes||[]).filter(function(h){return h.name===source.heroName||h.id===source.heroId||(h.power&&source.heroPower&&h.power.id===source.heroPower.id);})[0];
    if(snapshot.publicPlayerDeck){snapshot.publicPlayerDeck.forEach(function(card){if(c.cards[card.cardId])pool.push(copy(card));});history=snapshot.history||[];}
    else {
      if(hero)(hero.cards||[]).forEach(function(id){add(id,false);});
      (source.treasureIds||[]).forEach(function(id){var treasure=c.treasures&&c.treasures[id];if(treasure&&treasure.kind==='card')add(treasure.cardId,false);});
    }
    if(snapshot.enemy.bossId==='extreme_troll')for(var forced=0;forced<3;forced++)add('deactivation',false);
    var planted={'서리꽃':{name:'혹한',count:3},'서리 저주':{name:'고드름',count:1},'심해 저주':{name:'저주',count:1}};
    history.forEach(function(phase){(phase.enemy||[]).forEach(function(card){
      if(card.countered)return;var d=c.cards[card.cardId],token=d&&planted[d.rule||d.name];
      if(token&&A4.CardRules)for(var i=0;i<token.count;i++)add(A4.CardRules.nameToId(token.name),card.upgraded);
    });});
    if(snapshot.enemy.heroPower&&snapshot.enemy.heroPower.id==='teemo'&&snapshot.enemy.heroPowerUsedTurn===snapshot.turn)for(var mushroom=0;mushroom<3;mushroom++)add('poisonous_mushroom',false);
    history.forEach(function(phase){
      var counts={},ups={};(phase.player||[]).forEach(function(card){if(!c.cards[card.cardId])return;counts[card.cardId]=(counts[card.cardId]||0)+1;if(card.upgraded)ups[card.cardId]=(ups[card.cardId]||0)+1;lastSeen[card.cardId]=card;});
      Object.keys(counts).forEach(function(id){maxCopies[id]=Math.max(maxCopies[id]||0,counts[id]);});
      Object.keys(ups).forEach(function(id){upgradedCopies[id]=Math.max(upgradedCopies[id]||0,ups[id]);});
    });
    Object.keys(maxCopies).forEach(function(id){
      var existing=pool.filter(function(card){return card.cardId===id;});
      for(var i=existing.length;i<maxCopies[id];i++)add(id,lastSeen[id].upgraded);
       
       
      if(seedIndex%3!==0&&lastSeen[id].upgraded)existing.slice(0,upgradedCopies[id]||1).forEach(function(card){card.upgraded=true;});
    });
    function take(id,up){
      var index=-1;for(var i=0;i<pool.length;i++)if(pool[i].cardId===id&&(up===undefined||pool[i].upgraded===!!up)){index=i;break;}
      if(index<0&&up!==undefined)return take(id);return index<0?null:pool.splice(index,1)[0];
    }
    function stamp(card){var result=copy(card);if(!result.uid||usedUids[result.uid])do{result.uid='ai-player-'+seedIndex+'-'+(++serial);}while(usedUids[result.uid]);usedUids[result.uid]=true;return result;}
    (fighter.runes||[]).forEach(function(card){take(card.cardId,card.upgraded);if(card.uid)usedUids[card.uid]=true;});
    var observedCards=(observed||[]).map(function(entry){var card=entry.card||entry;if(!card.cardId&&entry.def)card={cardId:entry.def.cardId,upgraded:!!entry.def.upgraded};return copy(card);}).filter(function(card){return !!c.cards[card.cardId];});
    observedCards.forEach(function(card){take(card.cardId,card.upgraded);fighter.hand.push(stamp(card));});
    sizes.hand=Math.max(sizes.hand,fighter.hand.length);
    var observedUids=fighter.hand.map(function(card){return card.uid;});
     
     
     
    if(seedIndex%3!==2){
      history.slice().reverse().forEach(function(phase){(phase.player||[]).slice().reverse().forEach(function(card){
        var d=c.cards[card.cardId];if(!d)return;
        if(card.upgraded&&d.upgrade){var upgraded=copy(d);Object.keys(d.upgrade).forEach(function(k){upgraded[k]=d.upgrade[k];});d=upgraded;}
        var zone=!card.countered&&d.excludeOnUse?'excluded':'rest';
        if(fighter[zone].length>=sizes[zone])return;var candidate=take(card.cardId,card.upgraded);if(candidate)fighter[zone].push(stamp(candidate));
      });});
    }
    function likelihood(card){return 1+Math.min(5,weights[key(card)]||0);}
    function unknown(){
      var id=ordinary[drawIndex(ordinary,rng,function(cid){var d=c.cards[cid];if(!d)return 0.001;var cost=d.cost||0,frequency=cost===4?0.5:cost>=5?0.25:1;return frequency*(0.7+(prediction.elements[prediction.forcedElement||d.element]||0));})];
      return {cardId:id,upgraded:false};
    }
    var needed=zones.reduce(function(n,zone){return n+sizes[zone]-fighter[zone].length;},0);
    while(pool.length<needed)pool.push(unknown());
     
     
    ['hand','rest','excluded','deck'].forEach(function(zone){
      while(fighter[zone].length<sizes[zone]){
        var index=drawIndex(pool,rng,zone==='hand'?likelihood:function(){return 1;});
        fighter[zone].push(stamp(pool.splice(index,1)[0]));
      }
    });
     
     
    var drawState=fighter.status&&fighter.status.cards;
    if(drawState&&drawState.drawCountTurn===snapshot.turn){
      drawState.drawnUids=[];
      for(var drawOrdinal=0;drawOrdinal<(drawState.drawCount||0);drawOrdinal++)drawState.drawnUids.push(drawOrdinal<fighter.hand.length?fighter.hand[drawOrdinal].uid:'ai-prior-draw-'+drawOrdinal);
    }
    var confession=fighter.status&&fighter.status.confession;
    var opposingPower=snapshot.enemy.heroPower;
    if(((opposingPower&&opposingPower.id==='meltranix'&&opposingPower.kind==='passive')||(confession&&confession.from<=snapshot.turn&&(confession.until===undefined||confession.until>=snapshot.turn)))&&observedUids.length){
      var shown=fighter.hand.filter(function(x){return observedUids.indexOf(x.uid)>=0;}),others=fighter.hand.filter(function(x){return observedUids.indexOf(x.uid)<0;});
      fighter.hand=shown.length>1?[shown[0]].concat(others,shown.slice(1)):shown.concat(others);
    }
    return {fighter:fighter,observedUids:observedUids};
  }
  return {sample:sample};
}());

// ---- src/ai-planner.js ----
 

A4.AI = (function(){
  'use strict';
  var limits={maxCalculationMs:5000,simulations:24,scenarios:2,rootCandidates:4,phaseCandidates:2,stepsPerSimulation:360,exactCandidates:96,shortlistedCandidates:64,varietyEnabled:true,nearScoreGap:1.5};
  var budget=null;
  function checkDeadline(){if(budget&&Date.now()>=budget.deadline)throw budget.error;}
  function remember(action,score,scenario){
    if(!budget)return;
    var id=key(action),record=budget.records[id];
    if(!record)record=budget.records[id]={uids:action.uids.slice(),heroPower:action.heroPower,scores:[]};
    record.scores[scenario]=score;budget.stats.candidates=Object.keys(budget.records).length;
  }
  function timedBest(){
    var best=null;
    Object.keys(budget.records).forEach(function(id){var record=budget.records[id],scores=record.scores,score=scores[0];
      if(scores[1]!==undefined&&score!==undefined)score=(score*(1-budget.passWeight)+scores[1]*budget.passWeight)*0.85+Math.min(score,scores[1])*0.15;
      if(score!==undefined&&(!best||score>best.score))best={uids:record.uids.slice(),heroPower:record.heroPower,score:score};
    });
    return best||budget.fallback;
  }
  var COUNTERS={FIRE:'NATURE',NATURE:'LIGHTNING',LIGHTNING:'ICE',ICE:'FIRE'};
  function copy(x){return x===undefined?undefined:JSON.parse(JSON.stringify(x));}
  function random(seed){var n=seed>>>0;return function(){n=(Math.imul?Math.imul(n,1664525):n*1664525)+1013904223>>>0;return n/4294967296;};}
  function hash(s){var n=2166136261;for(var i=0;i<s.length;i++)n=((n^s.charCodeAt(i))*16777619)>>>0;return n;}
  function shuffle(a,rng){for(var i=a.length-1;i>0;i--){var j=Math.floor(rng()*(i+1)),x=a[i];a[i]=a[j];a[j]=x;}return a;}
  function scalars(src){var out={};Object.keys(src||{}).forEach(function(k){var x=src[k];if(x===null||typeof x==='number'||typeof x==='boolean'||typeof x==='string')out[k]=x;});return out;}
  function publicStatus(status){
    var out=scalars(status);out.cardLocks=copy(status.cardLocks||[]);out.foresightTurns=copy(status.foresightTurns||[]);
    if(status.classes)out.classes=scalars(status.classes);if(status.expansion)out.expansion=scalars(status.expansion);
    if(status.confession)out.confession=copy(status.confession);
    if(status.salvation)out.salvation=copy(status.salvation);
    if(status.cards){out.cards=scalars(status.cards);out.cards.drawnUids=[];for(var i=0;i<(out.cards.drawCount||0);i++)out.cards.drawnUids.push('ai-prior-draw-'+i);out.cards.effects=(status.cards.effects||[]).map(function(e){var x=scalars(e);if(e.elements)x.elements=copy(e.elements);if(e.sourceCard)x.sourceCard=copy(e.sourceCard);if(e.sourceDef)x.sourceDef=copy(e.sourceDef);if(e.fuseSource)x.fuseSource=copy(e.fuseSource);return x;});}
    if(status.treasures){out.treasures={};['freeMain2Turn','escapeTurn','escapeStacks','escapeStacksTurn','previousFirstElement','main1PaidTurn','main1Paid','receiptTurn','firstElementTurn','firstElement','firstCounteredTurn','firstCounteredUid','elementCountsTurn','twinTurn','mirrorTurn','luckyShovelTurn','echoTurn','savedMana','standbyProcessed','endProcessed'].forEach(function(k){if(status.treasures[k]!==undefined)out.treasures[k]=status.treasures[k];});['elementCounts','twinTriggered'].forEach(function(k){if(status.treasures[k])out.treasures[k]=copy(status.treasures[k]);});}
    return out;
  }
  function publicSnapshot(b,c){
    var p=b.player,player={},fields=['name','heroName','heroId','startingTreasureId','shrineId','runWins','fatigueExtra','bloodstones','daggers','bossId','hp','maxHp','baseMaxHp','shield','mana','maxMana','manaGrowth','overloadNext','overloadLocked','heroPowerUsedTurn','heroPowerReadyTurn','playedThisTurn','damageTakenThisTurn','damageTakenLastTurn','drawnCountThisTurn'];
    fields.forEach(function(k){if(p[k]!==undefined)player[k]=p[k];});
    if(p.runeSerial!==undefined)player.runeSerial=p.runeSerial;player.runes=copy(p.runes||[]);player.shrines=copy(p.shrines||[]);player.heroPower=copy(p.heroPower);player.status=A4.Battle.redactTrapChoices(publicStatus(p.status||{}),'player','enemy');player.passives=copy(p.passives||[]);player.treasureIds=copy(p.treasureIds||[]);
    player.handCount=p.hand.length;player.deckCount=p.deck.length;player.restCount=p.rest.length;player.excludedCount=p.excluded.length;
    if(b.enemy.heroPower&&b.enemy.heroPower.id==='teemo')player.teemoTrapCount=p.deck.filter(function(x){return x.cardId==='poisonous_mushroom';}).length;
    player.hand=[];player.deck=[];player.rest=[];player.excluded=[];player.inFlight=[];
    player.usedThisTurn=copy(p.usedThisTurn||[]);player.lastTurnCards=copy(p.lastTurnCards||[]);player.limitedUsed=copy(p.limitedUsed||{});
    var result={rulesVersion:3,turn:b.turn,phase:b.phase,phaseSerial:b.phaseSerial||0,outcome:'ongoing',player:player,enemy:copy(b.enemy),history:copy(b.history||[]),scheduled:[],generatedCounter:b.generatedCounter||0,lastLog:[],runChanges:[],removedFromRun:[],pendingChoice:null,resolution:null,enemyPlan:[],enemyPowerPlan:false,enemyPlanDeferred:false};
    A4.Battle.redactTrapChoices(result.enemy.status,'enemy','enemy');
    result.publicPlayerHistory=copy(b.publicPlayerHistory||[]);
    if(b.publicPlayerDeck)result.publicPlayerDeck=copy(b.publicPlayerDeck);
     
     
    (b.scheduled||[]).forEach(function(e){var t=e.task||{};
      if(t.side==='enemy'||(t.op==='burnout'&&t.owner==='enemy')){result.scheduled.push(copy(e));return;}
      if(['damage','heal','mana','charge','loseShield','nextWaves','hourglass','boots','capsule'].indexOf(t.op)>=0||t.kind==='effect'){
        var task=scalars(t);if(t.effect)task.effect=copy(t.effect);if(t.card)task.card=copy(t.card);
        result.scheduled.push({turn:e.turn,phase:e.phase,task:task});
      }
    });
    result.enemy.deck.sort(function(a,z){return String(a.uid).localeCompare(String(z.uid));});
    return result;
  }
  function meta(def,own,opp,b,c){return A4.AIEvaluation.evaluateCard(def,own,opp,b,c);}
  function key(a){return a.uids.join(',')+'|'+a.heroPower;}
  function chooseNearBest(ranked,roll){
    if(!ranked.length)return null;
    var ordered=ranked.slice().sort(function(a,z){return Math.abs(z.score-a.score)<0.00001?0:z.score-a.score;}),best=ordered[0],seen={},near=[];
    ordered.forEach(function(a){var identity=a.uids.slice().sort().join(',')+'|'+a.heroPower;
      if(near.length>=3||seen[identity]||best.score-a.score>limits.nearScoreGap||a.outcomes!==best.outcomes)return;
      seen[identity]=true;near.push(a);
    });
    if(!limits.varietyEnabled||near.length<2)return best;
     
    var weights=[60,25,15],total=near.length===2?85:100,point=Math.max(0,Math.min(0.999999999,roll))*total;
    for(var i=0;i<near.length;i++){point-=weights[i];if(point<0)return near[i];}return near[near.length-1];
  }
  function candidates(b,c,side,count){
    checkDeadline();
    var f=b[side],foe=b[side==='enemy'?'player':'enemy'],ctx=A4.Battle.context(b,c,function(){return 0.5;},{side:side},[]),available=[],power=false,pcost=0,pvalue=0,pbonus=0;
    f.hand.forEach(function(x){if(A4.Battle.cardAllowed(b,side,c,x)){var d=ctx.def(x);if(d.rule==='불안정한 원소'&&f.hand.length>1)return;if(d.rule==='poison_powder'&&f.heroPower&&f.heroPower.id==='ivysaur'&&(foe.drawnCountThisTurn||0)<2)return;var evaluation=meta(d,f,foe,b,c);if(evaluation.cleanseAllowed===false||evaluation.prayerAllowed===false)return;available.push({card:x,def:d,first:ctx.cost(side,x,true),cost:ctx.cost(side,x,false),blood:d.bloodCost!==undefined,m:evaluation});}});
     
    var healthCards=!!(A4.Classes&&A4.Classes.alive(f,'hireek').length),spendable=healthCards?Math.floor((f.hp-1)/5):f.mana;
    if(available.length>10)available=available.sort(function(a,z){return z.m.score-a.m.score;}).slice(0,10);
    var teemoBlocked=f.heroPower&&f.heroPower.id==='teemo'&&(foe.teemoTrapCount!==undefined&&!(foe.deck||[]).length?foe.teemoTrapCount:(foe.deck||[]).filter(function(x){return x.cardId==='poisonous_mushroom';}).length)>3;
    if(!teemoBlocked&&f.heroPower&&f.heroPower.kind==='active'&&(f.heroPower.id!=='plague_doctor'||f.heroPowerUsedTurn<0||f.heroPowerUsedTurn!==b.turn-1)&&(f.heroPower.id!=='ivysaur'||!(foe.status||{}).poison||((foe.status||{}).poison||0)>=3)){
      try{A4.Battle.validateSubmission(ctx,side,[],true);power=true;pcost=ctx.powerCost(side);var powerMetric=meta(f.heroPower,f,foe,b,c);pvalue=powerMetric.score;pbonus=powerMetric.cardSavingBonus||0;}catch(ignore){if(budget&&ignore===budget.error)throw ignore;}
    }
    var modelView=side==='enemy'?b:{player:foe,enemy:f,turn:b.turn,phase:b.phase,history:(b.history||[]).map(function(h){return {turn:h.turn,phase:h.phase,player:h.enemy||[],enemy:h.player||[]};})};
    var model=A4.AIEvaluation.predict(modelView,c),freq=model.elements,total=1;
    var ranked=[],batchCache={},handCap=ctx.limit(side),reserveOrder=available.slice().sort(function(a,z){return a.cost-z.cost||z.m.score-a.m.score;});
    function consider(selected,usePower,variant){
      if(selected.length>1&&A4.TreasureRules.owns(f,'velvet_choker'))return;
      checkDeadline();
      var cost=usePower?pcost:0,bloodCost=0,value=usePower?pvalue:0,seen={},ids=[],valid=true,prayerOwn=f,prayerFoe=foe;
      if(f.heroPower&&f.heroPower.id==='yuumi'){prayerOwn=copy(f);prayerFoe=copy(foe);}
      selected.forEach(function(x,i){var paid=i===0&&f.playedThisTurn===0?x.first:x.cost;if(x.blood)bloodCost+=paid;else cost+=paid;});if(bloodCost>(f.bloodstones||0))return;
      var lifeCost=healthCards?(cost-(usePower?pcost:0))*5:0;
      if(healthCards?(lifeCost>=f.hp||usePower&&pcost>f.mana):cost>f.mana)return;
      var batchKey=selected.map(function(x){return x.card.uid;}).join(',')+'|'+cost;
      var batch=batchCache[batchKey];
      if(!batch){batch=A4.AIEvaluation.evaluateBatch(selected.map(function(x,i){return {card:x.card,def:x.def,paidCost:i===0&&f.playedThisTurn===0?x.first:x.cost};}),f,foe,b,c,healthCards?(usePower?pcost:0):cost);batchCache[batchKey]=batch;}if(!batch.allowed)return;
      selected.forEach(function(x,i){if((x.def.limited||x.def.rule==='금단의 불꽃')&&seen[x.card.cardId])valid=false;seen[x.card.cardId]=true;
        if(x.def.rule==='salvation_prayer'&&f.heroPower&&f.heroPower.id==='yuumi'){var prayer=A4.AIEvaluation.prayerPolicy(x.def,prayerOwn,prayerFoe,b,c);if(!prayer.allowed)valid=false;prayerOwn.hp+=prayer.selfHeal;prayerFoe.hp+=prayer.otherHeal;if(prayer.otherHeal>0)prayerOwn.status.yuumiHealTurn=b.turn;}
        ids.push(x.card.uid);
        var risk=0;Object.keys(COUNTERS).forEach(function(el){if(COUNTERS[el]===x.def.element||(x.def.unstable&&el===x.def.element))risk+=(freq[el]||0)/total;});
        if(foe.mana===0)risk*=0.12;if((foe.handCount===undefined?foe.hand.length:foe.handCount)===0)risk=0;
        var counterChance=(freq[COUNTERS[x.def.element]]||0)+(x.def.overpower?(freq[x.def.element]||0):0);
        value+=batch.metrics[i].score*(1-risk*(1-model.passChance)*0.7)+counterChance/total*(model.constrained?4*(1-model.passChance):1.2);
      });
      if(!valid||!healthCards&&cost>f.mana)return;
      if(healthCards)value-=lifeCost*(f.hp<15?1.6:0.8);
      if(b.phase==='MAIN1'&&foe.heroPower&&foe.heroPower.id==='fiora'&&!ids.length)value-=A4.AIEvaluation.evaluateCard({id:'fiora_pressure',kind:'active',effects:[{type:'damage',amount:5}]},foe,f,b,c).damage*1.2;
      if(foe.heroPower&&foe.heroPower.id==='piranha_plant')value-=selected.length*0.35;
      if(b.phase==='MAIN1'&&f.heroPower&&f.heroPower.id==='fiora'&&ids.length)value+=model.passChance*1.5;

      if(usePower&&f.heroPower&&f.heroPower.id==='pikachu')value-=selected.filter(function(x){return x.def.element==='LIGHTNING';}).length*1.25;
      if(b.phase==='MAIN1')value+=batch.mana*0.5;
      value-=cost*0.12;
      if(side==='enemy'&&b.phase==='MAIN2')value+=Math.min(1,selected.reduce(function(sum,x,i){return sum+(batch.metrics[i].score>0&&!x.blood?(i===0&&f.playedThisTurn===0?x.first:x.cost):0);},0)*0.35);
      if(usePower&&selected.length<f.hand.length)value+=pbonus;
      if(side==='enemy'&&f.hand.length<=handCap-3&&!f.hand.some(function(x){return c.cards[x.cardId]&&c.cards[x.cardId].rule==='신의 권능: 징벌';})){
        var spentElements={},savedCardCount=0;selected.forEach(function(x,i){var paid=i===0&&f.playedThisTurn===0?x.first:x.cost;if(paid>0||x.def.temporary||x.card.temporaryUntil!==undefined&&x.card.temporaryUntil<=b.turn)return;savedCardCount++;spentElements[x.def.element]=(spentElements[x.def.element]||0)+1;if(spentElements[x.def.element]>1)value-=5;});
        value-=Math.max(0,savedCardCount-2)*1.2;
      }
      var openingValue=0,earlyDraw=0,reservesPlay=false;
      if(side==='enemy'&&b.phase==='MAIN1'){
        reservesPlay=ids.length>0&&(available.some(function(x){return ids.indexOf(x.card.uid)<0&&!x.def.main1Only&&x.m.score>0&&(x.blood?x.cost<=(f.bloodstones||0)-bloodCost:x.cost<=batch.mana)&&!(x.def.limited&&seen[x.card.cardId]);})||power&&!usePower&&pvalue>0&&pcost<=batch.mana);
         
        if(reservesPlay){
          var reserveMana=batch.mana,reserveBlood=(f.bloodstones||0)-bloodCost,reserveCount=0;
          reserveOrder.forEach(function(x){if(ids.indexOf(x.card.uid)<0&&!x.def.main1Only&&x.m.score>0&&(x.blood?x.cost<=reserveBlood:x.cost<=reserveMana)&&!(x.def.limited&&seen[x.card.cardId])){reserveCount++;if(x.blood)reserveBlood-=x.cost;else reserveMana-=x.cost;}});
           
           
          openingValue+=1.1;
          if(reserveCount)openingValue+=0.7*(1-Math.abs(ids.length-reserveCount)/(ids.length+reserveCount));
        }
        var space=Math.max(0,handCap-f.hand.length+ids.length),supply=f.deck.length+f.rest.length;
        batch.metrics.forEach(function(m,i){var rule=selected[i].def.rule;if(['완전 빙결','황금궤','불장난'].indexOf(rule)<0)earlyDraw+=Math.max(0,m.draw||0);});
        earlyDraw=Math.min(earlyDraw,space,supply);
         
        if(batch.mana>0&&earlyDraw>0&&f.hand.length-ids.length<5)openingValue+=Math.min(1.2,earlyDraw*0.6);
        else earlyDraw=0;
      }
      ranked.push({uids:ids,heroPower:!!usePower,score:value+openingValue,openingValue:openingValue,earlyDraw:earlyDraw,reservesPlay:reservesPlay,variant:variant||0});
      if(budget&&b===budget.snapshot&&(!budget.fallback||value+openingValue>budget.fallback.score))budget.fallback={uids:ids.slice(),heroPower:!!usePower,score:value+openingValue};
    }
     
     
     
    var ordered=available.slice().sort(function(a,z){return (a.m.priority||0)-(z.m.priority||0);}),sets=[];
    function collect(start,selected,cost,value,bloodCost){bloodCost=bloodCost||0;
      checkDeadline();
      sets.push({selected:selected.slice(),cost:cost,value:value});
      for(var i=start;i<ordered.length;i++){
        var x=ordered[i],paid=selected.length===0&&f.playedThisTurn===0?x.first:x.cost;
        if(x.blood?bloodCost+paid>(f.bloodstones||0):cost+paid>spendable)continue;
        if((x.def.limited||x.def.rule==='금단의 불꽃')&&selected.some(function(y){return y.card.cardId===x.card.cardId;}))continue;
        selected.push(x);collect(i+1,selected,cost+(x.blood?0:paid),value+x.m.score,bloodCost+(x.blood?paid:0));selected.pop();
      }
    }
     
    if(budget&&b===budget.snapshot){consider([],false,0);if(power)consider([],true,0);available.forEach(function(x){consider([x],false,0);});}
    collect(0,[],0,0);
    if(sets.length>limits.exactCandidates){
      sets.sort(function(a,z){return z.value-a.value||a.selected.length-z.selected.length;});
      var keep=sets.slice(0,limits.shortlistedCandidates);
      sets.forEach(function(a){
        if(a.selected.length<=2||a.selected.length===3&&a.selected.some(function(x){return x.m.mana>0||x.def.rule==='boo_ghost_raider'||x.def.rule==='과열'||x.def.rule==='금단의 불꽃';})){
          if(keep.indexOf(a)<0)keep.push(a);
        }
      });
       
      var sizes={},elements={};sets.forEach(function(a){var n=a.selected.length;if(!sizes[n]){sizes[n]=true;if(keep.indexOf(a)<0)keep.push(a);}
        a.selected.forEach(function(x){if(!elements[x.def.element]){elements[x.def.element]=true;if(keep.indexOf(a)<0)keep.push(a);}});
      });sets=keep;
    }
    ranked=[];  
    sets.forEach(function(a){consider(a.selected,false,0);if(power&&(healthCards?pcost<=f.mana:a.cost+pcost<=f.mana))consider(a.selected,true,0);});
    ranked.sort(function(a,z){return z.score-a.score||a.uids.length-z.uids.length;});
    var result=[],seenKeys={};
    function add(a){if(a&&!seenKeys[key(a)]){try{A4.Battle.validateSubmission(ctx,side,a.uids,a.heroPower);}catch(error){if(budget&&error===budget.error)throw error;return;}result.push(a);seenKeys[key(a)]=true;}}
    ranked.slice(0,count).forEach(add);
    if(side==='enemy'&&b.phase==='MAIN1'&&available.length){
      var nextView={player:foe,enemy:f,turn:b.turn,phase:'MAIN2',history:b.history||[]},nextModel=A4.AIEvaluation.predict(nextView,c);
      var partial=ranked.filter(function(a){return (a.uids.length>0||a.heroPower)&&(a.uids.length<available.length||power&&!a.heroPower);});
      partial.forEach(function(a){
        var mana=Math.max(0,f.mana-(a.heroPower?pcost:0)),future=0,blood=f.bloodstones||0,left=available.filter(function(x){return a.uids.indexOf(x.card.uid)<0;});
        a.uids.forEach(function(id){var x=available.filter(function(x){return x.card.uid===id;})[0];if(x.blood)blood-=x.cost;else mana-=x.cost;});
        left.sort(function(x,z){return z.m.score/Math.max(1,z.cost)-x.m.score/Math.max(1,x.cost);});
        left.forEach(function(x){if(x.def.main1Only||(x.blood?x.cost>blood:x.cost>mana))return;
          var risk=0;Object.keys(COUNTERS).forEach(function(el){if(COUNTERS[el]===x.def.element||(x.def.unstable&&el===x.def.element))risk+=nextModel.elements[el]||0;});
          future+=Math.max(0,x.m.score)*(1-risk*(1-nextModel.passChance)*0.7);if(x.blood)blood-=x.cost;else mana-=x.cost;
        });
        if(power&&!a.heroPower&&pcost<=mana)future+=Math.max(0,pvalue);
        a.partitionScore=a.score+future;a.phaseSplit=a.reservesPlay||a.earlyDraw>0;
      });
      partial.sort(function(a,z){return z.partitionScore-a.partitionScore||a.uids.length-z.uids.length;});
      var purposeful=partial.filter(function(a){return a.reservesPlay||a.earlyDraw>0;});
      if(!purposeful.length&&partial[0])partial[0].phaseSplit=true;
      add(purposeful[0]||partial[0]);
       
      var drawFirst=purposeful.filter(function(a){return a.earlyDraw>0;}).sort(function(a,z){return a.uids.length-z.uids.length||z.partitionScore-a.partitionScore;});
      var balanced=purposeful.slice().sort(function(a,z){return z.openingValue-a.openingValue||z.partitionScore-a.partitionScore;});
      add(drawFirst[0]||balanced[0]||partial[1]);
    }
     
    if(!result.some(function(x){return x.uids.length===0&&!x.heroPower;}))add({uids:[],heroPower:false,score:b.phase==='MAIN1'?f.mana*0.5:0});
    if(f.heroPower&&f.heroPower.id==='plague_doctor')add(ranked.filter(function(x){return !x.heroPower&&x.uids.length;})[0]);
     
    ranked.slice(0,2).forEach(function(a){if(a.uids.length<2)return;var orders=[a.uids.slice().reverse()];
      if(a.uids.length>2)orders.push(a.uids.slice(1).concat(a.uids[0]));
      orders.forEach(function(ids){try{A4.Battle.validateSubmission(ctx,side,ids,a.heroPower);var before=ranked.length;consider(ids.map(function(id){return available.filter(function(x){return x.card.uid===id;})[0];}),a.heroPower,1);if(ranked.length>before)add(ranked[ranked.length-1]);}catch(ignore){if(budget&&ignore===budget.error)throw ignore;}});
    });
    return result;
  }
  function world(snapshot,c,seed,index,observed){
    var b=copy(snapshot),rng=random(seed+index*7919),sample=A4.AIOpponentModel.sample(snapshot,c,index,rng,observed);
    if(observed){b._aiObservedCosts={};observed.forEach(function(entry,i){if(A4.integer(entry.paidCost,0)&&sample.observedUids[i])b._aiObservedCosts[sample.observedUids[i]]=entry.paidCost;});b._aiObservedCostTurn=b.turn;b._aiObservedCostPhase=b.phase;}
    b.player=sample.fighter;if(b.player.hand.length)b.player.lastDrawnCard=copy(b.player.hand[b.player.hand.length-1]);b._aiObservedUids=sample.observedUids;
    ['player','enemy'].forEach(function(side){((b[side].status.cards||{}).effects||[]).forEach(function(e){if(e.kind==='iceTrap'&&e.hiddenChoice){e.element=['FIRE','NATURE','LIGHTNING','ICE','HOLY'][Math.floor(rng()*5)];}});});
    shuffle(b.enemy.deck,rng);b._aiImagined=true;
    function spec(f){return {name:f.name,heroId:f.heroId,startingTreasureId:f.startingTreasureId,shrineId:f.shrineId,bloodstones:f.bloodstones,runWins:f.runWins,hp:f.hp,maxHp:f.baseMaxHp||f.maxHp,deck:copy(f.hand.concat(f.deck,f.rest)),heroPower:copy(f.heroPower),passives:copy(f.passives),treasureIds:copy(f.treasureIds),bossId:f.bossId};}
    b.restartSpecs={player:spec(b.player),enemy:spec(b.enemy)};
    return b;
  }
  function simulate(b,c,enemy,player,seed,stats){
    checkDeadline();
    if(stats.simulations>=limits.simulations)return null;
    stats.simulations++;var sim=copy(b);sim._aiSimulation=true;sim._aiStepsRemaining=limits.stepsPerSimulation;
    sim.enemyPlan=enemy.uids.slice();sim.enemyPowerPlan=enemy.heroPower;sim.enemyPlanDeferred=false;sim.resolution=null;sim.pendingChoice=null;
    try{A4.Battle.submit(sim,player.uids,c,random(seed),{heroPower:player.heroPower});stats.steps+=limits.stepsPerSimulation-sim._aiStepsRemaining;return sim;}
    catch(error){if(budget&&error===budget.error)throw error;stats.truncated++;if(String(error.message)!=='AI_SIMULATION_LIMIT'){stats.errors=stats.errors||[];if(stats.errors.length<3)stats.errors.push(String(error.message));}return null;}
  }
  function position(b,c){return A4.AIEvaluation.position(b,'enemy',c);}
  function behaviorResponse(b,c,choices,prediction,index){
    if(prediction.phaseSamples<3)return choices[Math.min(index,choices.length-1)];
    var ctx=A4.Battle.context(b,c,function(){return 0.5;},{side:'player'},[]);
    var expectedCount=prediction.meanCards<0.65?0:prediction.meanCards;
    var ranked=choices.map(function(action){var elementMatch=0;
      action.uids.forEach(function(uid){var card=b.player.hand.filter(function(x){return x.uid===uid;})[0];if(card)elementMatch+=prediction.elements[ctx.def(card).element]||0;});
      return {action:action,score:action.score*0.12-Math.abs(action.uids.length-expectedCount)*4+elementMatch*2};
    }).sort(function(a,z){return z.score-a.score;});
    return ranked[0].action;
  }
  function plan(actual,c,unusedRng,observed){
    var snapshot=publicSnapshot(actual,c);if(observed){snapshot.player.knownSubmission=observed.map(function(x){return copy(x.def);});snapshot.player.knownSubmissionTurn=snapshot.turn;snapshot.player.knownSubmissionPhase=snapshot.phase;}
    if(budget)budget.snapshot=snapshot;
    var stats={simulations:0,steps:0,truncated:0,candidates:0,scenarios:0,expanded:false,splitEvaluations:0};if(budget)budget.stats=stats;
    var pool=candidates(snapshot,c,'enemy',snapshot.phase==='MAIN1'?4:3),root=[];
    function add(action){if(action&&!root.some(function(x){return key(x)===key(action);}))root.push(action);}
    add(pool[0]);
    if(snapshot.enemy.heroPower&&snapshot.enemy.heroPower.id==='plague_doctor')add(pool.filter(function(x){return !x.heroPower&&x.uids.length;})[0]);
    else add(pool.filter(function(x){return !x.uids.length&&!x.heroPower;})[0]);
    if(root.length<2)add(pool[1]);
    if(snapshot.phase==='MAIN1')pool.filter(function(a){return a.phaseSplit;}).sort(function(a,z){return z.openingValue-a.openingValue||z.partitionScore-a.partitionScore;}).some(function(a){add(a);return root.length>=limits.rootCandidates;});
     
    if(pool.length===1)return {uids:pool[0].uids.slice(),heroPower:pool[0].heroPower,score:pool[0].score,stats:stats};
    var seed=hash(JSON.stringify(snapshot)),scenarios=[],cache=[],prediction=A4.AIEvaluation.predict(snapshot,c);
    var counterContext=A4.Battle.context(snapshot,c,function(){return 0.5;},{side:'enemy'},[]),rootMetrics={},rootPowerMetric=null;
    function rootMetric(card){if(!rootMetrics[card.uid])rootMetrics[card.uid]=meta(counterContext.def(card),snapshot.enemy,snapshot.player,snapshot,c);return rootMetrics[card.uid];}
    function powerMetric(){if(!rootPowerMetric)rootPowerMetric=meta(snapshot.enemy.heroPower,snapshot.enemy,snapshot.player,snapshot,c);return rootPowerMetric;}
    function scenario(index){
      if(scenarios[index])return scenarios[index];
      var b=world(snapshot,c,seed,index,observed),choices=observed?null:candidates(b,c,'player',4);
      var action=observed?{uids:b._aiObservedUids.slice(),heroPower:false}:behaviorResponse(b,c,choices,prediction,index);
      var passing=index===1&&!observed&&prediction.passChance>=0.35;
      if(passing)action={uids:[],heroPower:false};
      if(budget&&index===1)budget.passWeight=passing?prediction.passChance:0.5;
      stats.scenarios++;
      return scenarios[index]={battle:b,action:action,seed:seed+index*1013,passing:passing};
    }
    function evaluate(ri,si){
      checkDeadline();
      cache[ri]=cache[ri]||[];if(cache[ri][si])return cache[ri][si];
      var action=root[ri],sc=scenario(si),after=simulate(sc.battle,c,action,sc.action,sc.seed,stats),result=after;
      var resultScore=after?position(after,c):null;
      if(after)remember(action,resultScore,si);
      if(after&&snapshot.phase==='MAIN1'&&after.outcome==='ongoing'&&after.phase==='MAIN2'){
        var follows=candidates(after,c,'enemy',2).slice(0,2),responses=candidates(after,c,'player',4),nextPrediction=A4.AIEvaluation.predict({player:after.player,enemy:after.enemy,turn:after.turn,phase:'MAIN2',history:snapshot.history,publicPlayerHistory:snapshot.publicPlayerHistory},c);
        var response=behaviorResponse(after,c,responses,nextPrediction,si);
        if(si===1&&nextPrediction.passChance>=0.35)response={uids:[],heroPower:false};
        var nextBest=null,nextBestScore=-Infinity;
        follows.forEach(function(follow){var trial=simulate(after,c,follow,response,sc.seed+307,stats);stats.splitEvaluations++;
          if(trial){var trialScore=position(trial,c);if(!nextBest||trialScore>nextBestScore){nextBest=trial;nextBestScore=trialScore;remember(action,trialScore,si);}}
        });
        result=nextBest||after;if(nextBest)resultScore=nextBestScore;
      }
      var priority=action.heroPower&&snapshot.enemy.heroPower&&snapshot.enemy.heroPower.id==='plague_doctor'?20:0;
      if(snapshot.phase==='MAIN1'&&after&&after.outcome==='defeat')priority+=6;
      if(snapshot.phase==='MAIN1'&&after&&after.outcome==='ongoing')priority+=(action.openingValue||0)+Math.min(2,action.uids.length)*0.03;
      if(action.heroPower&&snapshot.enemy.heroPower&&snapshot.enemy.heroPower.id==='ivysaur')priority+=powerMetric().ivysaurOpeningBonus||0;
      if(action.heroPower&&action.uids.length<snapshot.enemy.hand.length)priority+=powerMetric().cardSavingBonus||0;
      if(after&&after.outcome==='ongoing'&&snapshot.enemy.hand.length<=counterContext.limit('enemy')-3&&!snapshot.enemy.hand.some(function(x){return c.cards[x.cardId]&&c.cards[x.cardId].rule==='신의 권능: 징벌';})){
        var usedElements={},keptCardCount=0;
        snapshot.enemy.hand.forEach(function(x){if(action.uids.indexOf(x.uid)<0)return;var d=counterContext.def(x);
          var ordinal=action.uids.indexOf(x.uid);
          if(counterContext.cost('enemy',x,ordinal===0&&snapshot.enemy.playedThisTurn===0)>0||d.temporary||x.temporaryUntil!==undefined&&x.temporaryUntil<=snapshot.turn)return;
          keptCardCount++;
          usedElements[d.element]=(usedElements[d.element]||0)+1;
          if(usedElements[d.element]>1)priority-=5;
        });
        priority-=Math.max(0,keptCardCount-2)*1.2;
      }
      if(snapshot.phase==='MAIN2'&&after&&after.outcome==='ongoing'){
        var usefulPaid=0;
        snapshot.enemy.hand.forEach(function(x){var i=action.uids.indexOf(x.uid);if(i>=0&&counterContext.def(x).bloodCost===undefined&&rootMetric(x).score>0)usefulPaid+=counterContext.cost('enemy',x,i===0&&snapshot.enemy.playedThisTurn===0);});
        priority+=Math.min(1,usefulPaid*0.35);
      }
      snapshot.enemy.hand.forEach(function(x){if(action.uids.indexOf(x.uid)>=0){var def=counterContext.def(x),evaluation=rootMetric(x);priority+=(evaluation.cleanseBonus||0)+(evaluation.prayerBonus||0)-(evaluation.fullHealthPenalty||0);
        if(prediction.constrained)priority+=((prediction.elements[COUNTERS[def.element]]||0)+(def.overpower?(prediction.elements[def.element]||0):0))*2*(1-prediction.passChance);
      }});

      var evaluated={score:(result?resultScore:position(sc.battle,c)+action.score*0.35)+priority,outcome:result?result.outcome:null};
      remember(action,evaluated.score,si);return cache[ri][si]=evaluated;
    }
    var first=evaluate(0,0),second=evaluate(1,0);
    var close=Math.abs(first.score-second.score)<6;
    var terminal=first.outcome!=='ongoing'||second.outcome!=='ongoing';
     
    if(close||terminal||stats.truncated||snapshot.phase==='MAIN1'&&root.length>2){
      stats.expanded=true;
      pool.some(function(action){add(action);return root.length>=limits.rootCandidates;});
      root.forEach(function(action,i){evaluate(i,0);evaluate(i,1);});
    }
    stats.candidates=root.length;
    var rankedDecisions=[];
    root.forEach(function(action,i){
      var a=evaluate(i,0).score,score=a;
      if(stats.expanded){var b=evaluate(i,1).score;var passWeight=scenario(1).passing?prediction.passChance:0.5;score=(a*(1-passWeight)+b*passWeight)*0.85+Math.min(a,b)*0.15;}
      rankedDecisions.push({uids:action.uids.slice(),heroPower:action.heroPower,score:score,outcomes:cache[i].map(function(x){return x.outcome;}).join('|')});
    });
     
    var best=chooseNearBest(rankedDecisions,random(hash('variety:'+seed))());
    delete best.outcomes;
    best.stats=stats;return best;
  }
  function cachedPlan(b,c,rng,observed){
    var started=Date.now(),previous=budget,result,elapsed;
    budget={deadline:started+Math.min(5000,Math.max(0,limits.maxCalculationMs)),error:new Error('AI_TIME_LIMIT'),records:{},passWeight:0.5,fallback:{uids:[],heroPower:false,score:0},stats:{simulations:0,steps:0,truncated:0,candidates:0,scenarios:0,expanded:false,splitEvaluations:0}};
    try{
      try{result=A4.AIEvaluation.withDefinitionCache(c,function(){return plan(b,c,rng,observed);});checkDeadline();}
      catch(error){if(error!==budget.error)throw error;result=timedBest();result.stats=budget.stats;result.stats.timeLimited=true;}
    }finally{budget=previous;}
    elapsed=Date.now()-started;
    if(elapsed>=1000)try{if(typeof Log!=='undefined'&&typeof Log.i==='function')Log.i('악질봇4 AI: '+b.enemy.name+' / '+b.phase+' / '+elapsed+'ms / 가상 전투 '+result.stats.simulations+'회'+(result.stats.timeLimited?' / 5초 제한 도달':''));}catch(ignore){if(budget&&ignore===budget.error)throw ignore;}
    return result;
  }
  return {checkDeadline:checkDeadline,plan:cachedPlan,publicSnapshot:publicSnapshot,limits:limits,candidates:candidates,chooseNearBest:chooseNearBest};
}());

// ---- src/live-config.js ----
 
A4.CardRules.install(A4.catalog);
A4.TreasureRules.install(A4.catalog);
A4.BossRules.install(A4.catalog);
A4.Classes.install(A4.catalog);
A4.Expansion.install(A4.catalog);
A4.catalog.config.engineVersion=3;
A4.catalog.config.enabled=true;
A4.catalog.config.rooms={live:['옥랜111','옥랜222'],test:['개발123']};
A4.catalog.config.initialInventory={gold:0,keys:5,stones:0,essence:0};
A4.catalog.config.sessionTimeoutMs=60000;
A4.catalog.config.relicsEnabled=false;
A4.catalog.config.shopEnabled=false;

// ---- src/economy.js ----
A4.Economy = (function () {
  var INTERVAL = 30 * 60 * 1000;
  var GOLD = [[50,50],[50,100],[100,200],[200,400],[200,400],[400,600],[500,800],[600,1000],[1000,1500]];
  function refreshKeys(user, now) {
    var count;
    if (user.run) return;  
    if (now < user.keyUpdatedAt) return;  
    if (user.items.keys >= 5) { user.keyUpdatedAt = now; return; }
    count = Math.floor((now - user.keyUpdatedAt) / INTERVAL);
    if (count <= 0) return;
    user.items.keys = Math.min(5, user.items.keys + count);
    user.keyUpdatedAt = user.items.keys >= 5 ? now : user.keyUpdatedAt + count * INTERVAL;
  }
  function grant(user, reward, now) {
    refreshKeys(user, now);
    user.gold += reward.gold || 0;
    user.items.keys += reward.keys || 0;
    user.items.stones += reward.stones || 0;
    user.items.essence += reward.essence || 0;
    if (user.items.keys >= 5) user.keyUpdatedAt = Math.max(now, user.keyUpdatedAt);
  }
  function reward(wins, rng) {
    A4.assert(A4.integer(wins, 0) && wins <= 8, '잘못된 처치 수입니다.');
    var bounds = GOLD[wins], out = {gold: bounds[0] + 50 * Math.floor(rng() * ((bounds[1] - bounds[0]) / 50 + 1)), keys:0,stones:0,essence:0};
    if (wins === 4) out.keys = rng() < 0.2 ? 1 : 0;
    if (wins === 5) { out.keys = rng() < 0.8 ? 1 : 0; out.stones = rng() < 0.8 ? 0 : 1; }
    if (wins === 6) { out.keys = 1; out.stones = rng() < 0.8 ? 1 : 2; }
    if (wins === 7) { out.keys = 1; out.stones = rng() < 0.6 ? 2 : 3; out.essence = rng() < 0.5 ? 0 : 1; }
    if (wins === 8) { out.keys = 1; out.stones = A4.weighted([{value:3,weight:60},{value:4,weight:30},{value:5,weight:10}],rng); out.essence = A4.weighted([{value:1,weight:70},{value:2,weight:20},{value:3,weight:10}],rng); }
    return out;
  }
  function spend(user, cost) {
    A4.assert(cost && A4.integer(cost.gold, 0) && A4.integer(cost.stones, 0), '비용이 아직 설정되지 않았습니다.');
    A4.assert(user.gold >= cost.gold && user.items.stones >= cost.stones, '코인 또는 강화석이 부족합니다.');
    user.gold -= cost.gold; user.items.stones -= cost.stones;
  }
  function findRelic(user, uid) {
    for (var i = 0; i < user.relics.length; i++) if (user.relics[i].uid === uid) return user.relics[i];
    A4.fail('해당 유물이 없습니다.');
  }
  function passives(user, catalog) {
    var out = [], i, owned, def;
    for (i = 0; i < user.equipped.length; i++) {
      if (!user.equipped[i]) continue;
      owned = findRelic(user, user.equipped[i]); def = catalog.relics[owned.relicId];
      A4.assert(def && def.levels && def.levels[owned.level] && Array.isArray(def.levels[owned.level].effects), '유물 효과 설정이 비어 있습니다: ' + owned.relicId);
      out = out.concat(A4.copy(def.levels[owned.level].effects));
    }
    return out;
  }
  function enhance(user, uid, catalog, rng) {
    var owned = findRelic(user,uid), def = catalog.relics[owned.relicId], rule, equipped, outcome;
    A4.assert(def, '유물 정의가 없습니다.');
    A4.assert(owned.level < 5, '최대 강화는 +5입니다.');
    rule = catalog.enhancement[def.grade] && catalog.enhancement[def.grade][owned.level];
    A4.assert(rule, '이 등급/단계의 강화 비용·확률이 아직 정해지지 않았습니다.');
    A4.assert(['C','B','A','S','SS'].indexOf(def.grade) >= 0, '잘못된 유물 등급입니다.');
    A4.assert((def.grade === 'S' || def.grade === 'SS') || rule.destroy === 0, 'C/B/A 등급 유물은 파괴될 수 없습니다.');
    equipped = user.equipped.indexOf(uid) >= 0;
    if (equipped && user.run && rule.destroy > 0) A4.assert(catalog.config.equippedDestruction === 'unequip', '탐험 중 장착 유물 파괴 시 처리 규칙이 미정입니다.');
    A4.assert(def.levels && def.levels[Math.min(5,owned.level+1)] && def.levels[Math.max(0,owned.level-1)], '강화 전후 유물 효과가 아직 정해지지 않았습니다.');
    outcome = A4.weighted([{value:'success',weight:rule.success},{value:'fail',weight:rule.fail},{value:'down',weight:rule.down},{value:'destroy',weight:rule.destroy}],rng);
    spend(user,rule);
    if (outcome === 'success') owned.level++;
    if (outcome === 'down') owned.level = Math.max(0,owned.level-1);
    if (outcome === 'destroy') {
      user.relics = user.relics.filter(function (r) { return r.uid !== uid; });
      user.equipped = user.equipped.map(function (id) { return id === uid ? null : id; });
    }
    return {outcome:outcome,uid:uid,level:outcome === 'destroy' ? null : owned.level};
  }
  function pull(state, user, id, catalog, rng) {
    var def = catalog.pulls[id], grade, pool = [], key, relic;
    A4.assert(def && A4.integer(def.gold,0) && Array.isArray(def.grades), '뽑기 비용·확률이 아직 정해지지 않았습니다.');
    A4.assert(user.gold >= def.gold,'코인이 부족합니다.');
    def.grades.forEach(function (g) {
      A4.assert(['C','B','A','S','SS'].indexOf(g.value) >= 0, '뽑기 등급 오류');
      if (g.weight > 0) A4.assert(Object.keys(catalog.relics).some(function (rid) { return catalog.relics[rid].grade === g.value; }), '뽑기 대상 유물이 비어 있습니다: '+g.value);
    });
    grade = A4.weighted(def.grades,rng);
    for (key in catalog.relics) if (A4.has(catalog.relics,key) && catalog.relics[key].grade === grade) pool.push(key);
    relic = {uid:A4.id(state,'relic-'),relicId:A4.pick(pool,rng),level:0};
    user.gold -= def.gold; user.relics.push(relic); return relic;
  }
  return {refreshKeys:refreshKeys,grant:grant,reward:reward,spend:spend,findRelic:findRelic,passives:passives,enhance:enhance,pull:pull,keyInterval:INTERVAL};
}());

// ---- src/journey.js ----
 
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

// ---- src/game.js ----
A4.Stats = (function () {
  function empty(){return {version:1,cards:{},elements:{},treasures:{},bots:{}};}
  function bucket(state){return state.stats||(state.stats=empty());}
  function record(map,key){if(!A4.has(map,key))map[key]={offered:0,picked:0,runs:0,totalWins:0,win:0,loss:0};return map[key];}
  function ordinary(id,catalog){return (catalog.cardPool||[]).indexOf(id)>=0||!!(catalog.cards[id]&&catalog.cards[id].classCard&&!catalog.cards[id].treasure);}
  function choice(state,options,picked,catalog,treasure){
    var stats=bucket(state),map=treasure?stats.treasures:stats.cards,seen={};
    function valid(id){return treasure?!!catalog.treasures[id]:ordinary(id,catalog);}
    options.forEach(function(id){if(!valid(id)||seen[id])return;seen[id]=true;record(map,id).offered++;
      if(!treasure)record(stats.elements,catalog.cards[id].element).offered++;
    });
    var selected=Array.isArray(picked)?picked:[picked],selectedSeen={};selected.forEach(function(id){if(valid(id)&&!selectedSeen[id]){selectedSeen[id]=true;record(map,id).picked++;if(!treasure)record(stats.elements,catalog.cards[id].element).picked++;}});
  }
  function finish(state,run,catalog){
    if(run.statsFinished)return;
    var stats=bucket(state),elements={},cards={},treasures={};
    function add(r){r.runs++;r.totalWins+=run.wins;}
    (run.deck||[]).forEach(function(card){cards[card.cardId]=true;});
    Object.keys(run.treasures||{}).forEach(function(slot){treasures[run.treasures[slot]]=true;});
    Object.keys(cards).forEach(function(id){if(!ordinary(id,catalog))return;add(record(stats.cards,id));elements[catalog.cards[id].element]=true;});
    Object.keys(elements).forEach(function(el){add(record(stats.elements,el));});
    Object.keys(treasures).forEach(function(id){if(catalog.treasures[id])add(record(stats.treasures,id));});
    run.statsFinished=true;
  }
  function battle(state,run,won){
    if(!run||run.phase!=='BATTLE'||!run.battle)return;
    var stage=String(run.wins+1),done=run.statsRecordedStages||(run.statsRecordedStages={});
    if(done[stage])return;
    var id=run.enemyId||run.battle.enemy.bossId;
    if(id){var r=record(bucket(state).bots,id);r[won?'win':'loss']++;}
    done[stage]=true;
  }
  function percent(n,d){return (d>0?n/d*100:0).toFixed(1)+'%';}
  function render(stats,catalog){
    stats=stats||empty();
    var icons={FIRE:'🔥',NATURE:'🍃',LIGHTNING:'⚡',ICE:'❄️',HOLY:'🕊️',NEUTRAL:'🌊',COSMIC:'🌌',CURSE:'💔'};
    var names={FIRE:'화염',NATURE:'자연',LIGHTNING:'전기',ICE:'냉기',HOLY:'신성',NEUTRAL:'무속성',COSMIC:'우주'};
    var elements=['FIRE','ICE','NATURE','LIGHTNING','HOLY','NEUTRAL','COSMIC'];
    var lines=['📊 탐험 통계 📊',new Array(1001).join('\u200b'),'','■ 속성별 통계'];
    function get(map,id){return map&&A4.has(map,id)?map[id]:{};}
    function average(r){return (r.runs>0?r.totalWins/r.runs:0).toFixed(2)+'승 ('+(r.runs||0)+'회)';}
    function picked(r){return percent(r.picked||0,r.offered||0)+' ('+(r.picked||0)+'/'+(r.offered||0)+')';}
    function line(name,r){return name+': 선택률 '+picked(r)+' | 평균 승수 '+average(r);}
    elements.filter(function(el){return el!=='NEUTRAL'&&el!=='COSMIC';}).forEach(function(el){lines.push(line(icons[el]+' '+names[el],get(stats.elements,el)));});
    lines.push('','■ 카드별 통계');
    elements.forEach(function(el){
      var ids=(catalog.cardPool||[]).concat(Object.keys(catalog.cards).filter(function(id){return catalog.cards[id].classCard;})).filter(function(id){return catalog.cards[id].element===el;});
      if(!ids.length)return;
      lines.push('',icons[el]+' '+names[el]+' 카드 통계');
      ids.forEach(function(id){lines.push(line('['+icons[el]+'] '+catalog.cards[id].name,get(stats.cards,id)));});
    });
    lines.push('','■ 보물별 통계');
    ['low','high'].forEach(function(tier){['passive','card'].forEach(function(kind){
      lines.push('',(tier==='low'?'✨ 하급':'💫 상급')+' '+(kind==='passive'?'지속형':'카드형')+' 보물 통계');
      Object.keys(catalog.treasures||{}).forEach(function(id){var t=catalog.treasures[id],marker=t.tier==='low'?'✨':'💫',element=t.kind==='card'?icons[catalog.cards[t.cardId].element]||'🌊':'';if(t.tier===tier&&t.kind===kind)lines.push(line('['+marker+element+'] '+t.name,get(stats.treasures,id)));});
    });});
    lines.push('','■ 봇별 격파율');
    Object.keys(catalog.enemies||{}).sort(function(a,b){return (catalog.enemies[a].stages||[0])[0]-(catalog.enemies[b].stages||[0])[0];}).forEach(function(id){
      var r=get(stats.bots,id),win=r.win||0,loss=r.loss||0;
      lines.push(catalog.enemies[id].name+': '+win+'승 '+loss+'패 | 격파율 '+percent(win,win+loss));
    });
    return lines.join('\n');
  }
  return {empty:empty,choice:choice,finish:finish,battle:battle,render:render};
}());

A4.Game = (function () {
  function newUser(state, name, now, catalog) {
    var initial = catalog.config.initialInventory;
    A4.assert(initial && A4.integer(initial.keys,0) && A4.integer(initial.gold,0) && A4.integer(initial.stones,0) && A4.integer(initial.essence,0), '신규 유저 시작 재화가 아직 정해지지 않았습니다.');
    return {id:A4.id(state,'user-'),name:name,createdAt:now,gold:initial.gold,items:{keys:initial.keys,stones:initial.stones,essence:initial.essence},keyUpdatedAt:now,slotCount:1,relics:[],equipped:[],run:null,lastRun:null,session:null,receipts:[]};
  }
  function addCard(state, run, cardId, slot) {
    var item = {uid:A4.id(state,'card-'),cardId:cardId,upgraded:false};
    if (slot) item.treasureSlot = slot;
    run.deck.push(item); return item;
  }
  function combinedPassives(user, catalog) {
    var result = A4.Economy.passives(user,catalog), slot, id, treasure;
    if (user.run) for (slot in user.run.treasures) if (A4.has(user.run.treasures,slot)) {
      id = user.run.treasures[slot]; treasure = catalog.treasures[id];
      A4.assert(treasure,'보물 정의가 없습니다: '+id);
      if (treasure.kind === 'passive') result = result.concat(A4.copy(treasure.effects));
    }
    return result.concat(user.run ? A4.copy(user.run.effects) : []);
  }
  function setTreasure(state, user, slot, id, catalog) {
    var run = user.run, def = catalog.treasures[id], previous = run.treasures[slot];
    
    A4.assert(def,'보물 정의가 없습니다.');
    run.deck = run.deck.filter(function (card) { return card.treasureSlot !== slot; });
    run.treasures[slot] = id;
    if (def.kind === 'card') addCard(state,run,def.cardId,slot);
    
    return previous?{before:previous,after:id}:null;
  }
  function availableTreasures(run, catalog, tier) {
    var held = Object.keys(run.treasures).map(function (slot) { return run.treasures[slot]; });
    return Object.keys(catalog.treasures).filter(function (id) { return !catalog.treasures[id].retired && catalog.treasures[id].tier === tier && (!catalog.treasures[id].excludeHeroes||catalog.treasures[id].excludeHeroes.indexOf(run.hero.id)<0) && (!catalog.treasures[id].classId||catalog.treasures[id].classId===run.hero.id) && held.indexOf(id) < 0; });
  }
  function editableCards(run, catalog, upgrading) {
    var seen = {};
    return run.deck.filter(function (card) {
      var def = catalog.cards[card.cardId], uniqueKey = card.cardId + (card.upgraded ? '+' : '');
      if (!def || def.treasure || card.treasureSlot || (upgrading && (card.upgraded || !def.upgrade || seen[uniqueKey]))) return false;
      seen[uniqueKey] = true; return true;
    });
  }
  function pending(state, run, kind, options, extra) {
    run.phase = 'REWARD';
    run.pending = {id:A4.id(state,'choice-'),kind:kind,options:A4.copy(options),extra:extra || null};
  }
  function nextReward(state, user, catalog, rng) {
    var run = user.run, step, candidates;
    if(catalog.config.engineVersion===3&&A4.Journey&&run.journeyVersion!==2){run.journeyVersion=2;run.gold=run.gold||0;run.queue=run.queue.filter(function(x){return ['low','high','swap','replaceHigh'].indexOf(x)>=0;}).concat(['bundles','camp','event','tavern']);}
    if(A4.Journey&&run.journeyVersion===2&&(A4.Journey.resume(state,user)||A4.Journey.next(state,user,catalog,rng)))return;
    while (run.queue.length) {
      if(A4.Journey&&run.journeyVersion===2&&(A4.Journey.resume(state,user)||A4.Journey.next(state,user,catalog,rng)))return;
      step = run.queue.shift();
      if (step === 'add') {
        var remaining=(catalog.config.engineVersion===3&&run.hero&&run.hero.classPool?run.hero.classPool:catalog.cardPool).slice(),offered=[];
        while(offered.length<4&&remaining.length){
          var elements=[];remaining.forEach(function(id){var el=catalog.cards[id].element;if(elements.indexOf(el)<0)elements.push(el);});
          var element=A4.weightedSample(elements,1,rng,function(el){return el==='HOLY'?0.5:1;})[0];
          var chosen=A4.weightedSample(remaining.filter(function(id){return catalog.cards[id].element===element;}),1,rng,function(id){var cost=catalog.cards[id].cost;return cost===5?1:cost===4?2:4;})[0];
          offered.push(chosen);remaining.splice(remaining.indexOf(chosen),1);
        }
        pending(state,run,'add',offered);return;
      }
      if (step === 'upgrade' || step === 'remove') {
        candidates = editableCards(run,catalog,step === 'upgrade');
        if (!candidates.length && step === 'upgrade') continue;
        if(!candidates.length)continue;
        pending(state,run,step,A4.sample(candidates,4,rng).map(function (x) { return x.uid; })); return;
      }
      if (step === 'low' || step === 'high' || step === 'replaceHigh') {
        candidates = availableTreasures(run,catalog,step === 'low' ? 'low' : 'high');
        A4.assert(candidates.length > 0,'획득 가능한 보물이 없습니다.');
        pending(state,run,'treasure',A4.sample(candidates,4,rng),{slot:step === 'replaceHigh' ? (run.swapSlot||'high') : step});run.swapSlot=null; return;
      }
      if (step === 'offerRemove') { pending(state,run,step,['제거한다','제거하지 않는다']); return; }
      if (step === 'swap') { pending(state,run,step,['하급 보물을 무작위 상급 보물로 교체','상급 보물 4개 중 선택하여 기존 상급 보물 교체','교체하지 않는다']); return; }
      if (step === 'finalEdit') { pending(state,run,step,['2장 제거 후 2장 추가','2장 제거','2장 추가']); return; }
      A4.fail('알 수 없는 보상 단계: '+step);
    }
    run.phase = 'READY'; run.pending = null; user.session = null;
  }
  function encounterResults(run) {
    if(!run.encounterResults)run.encounterResults=[];
     
    for(var stage=1;stage<=run.wins;stage++)if(!run.encounterResults.some(function(x){return x.stage===stage;}))run.encounterResults.push({stage:stage,name:stage+'전투 상대 (이름 기록 없음)',won:true});
    run.encounterResults.sort(function(a,b){return a.stage-b.stage;});
    return run.encounterResults;
  }
  function recordEncounter(run,won) {
    var results=encounterResults(run),enemy=run.battle&&run.battle.enemy||run.enemySpec;
    if(!enemy)return;
    var stage=run.wins+1;
    if(!results.some(function(x){return x.stage===stage;}))results.push({stage:stage,enemyId:run.enemyId||null,name:enemy.name,won:won});
  }
  function finish(state, user, reason, now, rng, catalog) {
    var run = user.run;
    A4.assert(run,'진행 중인 탐험이 없습니다.');
    if(reason!=='clear')A4.Stats.battle(state,run,false);
    A4.Stats.finish(state,run,catalog);
    if(reason!=='clear')recordEncounter(run,false);
    var reward = run.journeyVersion===2?{gold:run.gold||0,keys:0,stones:0,essence:0}:A4.Economy.reward(run.wins,rng);
    A4.Economy.grant(user,reward,now);
    user.lastRun = {id:run.id,wins:run.wins,reason:reason,reward:reward,finishedAt:now,encounterResults:A4.copy(encounterResults(run))};
    user.keyUpdatedAt = Math.max(now, user.keyUpdatedAt);
    user.run = null; user.session = null;
    return user.lastRun;
  }
  function performSwap(state,user,catalog,slot,mode,rng){
    if(mode==='random'){var change=setTreasure(state,user,slot,A4.pick(availableTreasures(user.run,catalog,'high'),rng),catalog);nextReward(state,user,catalog,rng);return {kind:'run',treasureChange:change};}
    else{user.run.swapSlot=slot;user.run.queue.unshift('replaceHigh');nextReward(state,user,catalog,rng);return {kind:'run'};}
  }
  function offerBattle(state,user,catalog,rng) {
    if(catalog.config.engineVersion!==3){beginBattle(state,user,catalog,rng);return;}
    var run=user.run,spec=A4.Opponents.prepare(state,run,catalog);
    run.enemyId=spec.enemyId;run.phase='ENCOUNTER';run.pending=null;run.battle=null;run.turnToken=null;
  }
  function restartEncounter(user,catalog,now,room){
    var run=user.run;
    A4.assert(run&&['BATTLE','ENCOUNTER'].indexOf(run.phase)>=0,'재시작할 진행 중인 전투가 없습니다.');
    A4.assert(catalog.config.engineVersion===3&&run.enemySpec&&run.enemySpec.enemyId===run.enemyId,'재시작할 상대의 저장된 정보가 없습니다.');
    run.enemySpec.maxHp=A4.Opponents.stage(run.wins+1).maxHp;
    run.enemySpec.stage=run.wins+1;
    run.phase='ENCOUNTER';run.pending=null;run.battle=null;run.turnToken=null;
    user.session={room:room,until:now+catalog.config.sessionTimeoutMs};
    return {kind:'run'};
  }
  function beginBattle(state,user,catalog,rng) {
    
    if(catalog.config.engineVersion===3){
      var liveRun=user.run,spec=A4.Opponents.prepare(state,liveRun,catalog);
      liveRun.enemyId=spec.enemyId;
      liveRun.battle=A4.Combat.create({name:user.name,heroName:liveRun.hero.name,heroPower:A4.copy(liveRun.hero.power),heroId:liveRun.hero.id,startingTreasureId:liveRun.hero.startingTreasureId,shrineId:liveRun.shrineId,bloodstones:liveRun.bloodstones,runWins:liveRun.wins,maxHp:catalog.config.playerMaxHpByStage[liveRun.wins],hp:liveRun.hp,deck:A4.copy(liveRun.deck),passives:combinedPassives(user,catalog),treasureIds:Object.keys(liveRun.treasures).map(function(k){return liveRun.treasures[k];})},
        {name:spec.name,bossId:spec.enemyId,startingTreasureId:spec.startingTreasureId,heroPower:A4.BossRules.power(spec.enemyId),maxHp:spec.maxHp,deck:A4.copy(spec.deck),passives:A4.copy(spec.treasurePassives),treasureIds:spec.treasures.map(function(x){return x.treasureId;})},catalog,rng,{publicPlayerHistory:A4.copy(user.aiPublicHistory||[])});
      liveRun.phase='BATTLE';liveRun.pending=null;liveRun.turnToken=A4.id(state,'turn-');
      liveRun.battle.publicPlayerHistory=A4.copy(user.aiPublicHistory||[]);
      applyRunChanges(state,user,catalog);return;
    }
    var run = user.run, enemyId = A4.pick(catalog.encounters[run.wins],rng), enemy = catalog.enemies[enemyId];
    A4.Opponents.rejectBlueprint(enemy);
    run.enemyId = enemyId;
    run.battle = A4.Combat.create({name:user.name,heroName:run.hero.name,heroPower:A4.copy(run.hero.power),maxHp:catalog.config.playerMaxHpByStage[run.wins],hp:run.hp,deck:A4.copy(run.deck),passives:combinedPassives(user,catalog)},
      {name:enemy.name,maxHp:enemy.maxHp,deck:enemy.cards.map(function (id) { return {uid:A4.id(state,'enemy-card-'),cardId:id,upgraded:false}; }),passives:A4.copy(enemy.passives || [])},catalog,rng);
    run.phase = 'BATTLE'; run.pending = null; run.turnToken = A4.id(state,'turn-');
    if (run.battle.outcome && run.battle.outcome !== 'ongoing') A4.fail('전투 시작 직후 종료되었습니다. 초기 체력·지속 효과 설정을 확인하세요.');
  }
  function start(state,user,catalog,now,room,rng) {
    A4.Economy.refreshKeys(user,now);
    if (!user.run) {
      var missing = A4.validateCatalog(catalog);
      A4.assert(!missing.length,'탐험 설정이 비어 있습니다: '+missing.join(', '));
      A4.assert(user.items.keys >= 1,'미궁 열쇠가 부족합니다.');
      user.items.keys--;
      user.run = {id:A4.id(state,'run-'),startedAt:now,wins:0,gold:0,journeyVersion:catalog.config.engineVersion===3?2:1,phase:'HERO',hero:null,deck:[],treasures:{},effects:[],queue:[],pending:null,battle:null};
      user.run.pending = {id:A4.id(state,'choice-'),kind:'hero',options:catalog.heroes.map(function (s) { return s.id; })};
    } else if (user.run.phase === 'READY') offerBattle(state,user,catalog,rng);
    user.session = {room:room,until:now+catalog.config.sessionTimeoutMs};
    return {kind:'run'};
  }
  function select(state,user,catalog,token,index,now,rng) {
    var run = user.run, p, picked, card, choices, treasureChange=null;
    if(run && run.phase==='BATTLE' && run.battle.pendingChoice) {
      A4.assert(run.turnToken===token,'이전 전투 선택입니다. +탐험으로 현재 단계를 확인하세요.');
      A4.assert(!run.battle.pendingChoice.lamp||run.battle.pendingChoice.lampStage==='results','+카드명으로 원하는 카드명을 검색하세요.');
      A4.assert(A4.integer(index,1)&&index<=run.battle.pendingChoice.options.length,'선택 번호가 올바르지 않습니다.');
      return battleResult(state,user,catalog,A4.Combat.choose(run.battle,run.battle.rulesVersion===3?index-1:index,catalog,rng),now,rng);
    }
    A4.assert(run && run.pending,'현재 선택할 보상이 없습니다.'); p = run.pending;
    A4.assert(p.id === token,'이미 처리되었거나 이전 화면의 선택입니다. +탐험으로 현재 단계를 확인하세요.');
    A4.assert(A4.integer(index,1) && index <= p.options.length,'선택 번호가 올바르지 않습니다.'); picked = p.options[index-1];
    
    if (p.kind === 'hero') {
      var hero = catalog.heroes.filter(function (s) { return s.id === picked; })[0];
      A4.assert(hero,'선택한 영웅 정의가 없습니다.');A4.assert(hero.enabled!==false,hero.name+'은 '+(hero.incompleteReason||'준비 중')+'으로 아직 선택할 수 없습니다.'); run.hero=A4.copy(hero);
      hero.cards.forEach(function (id) { addCard(state,run,id); }); offerBattle(state,user,catalog,rng); return {kind:'run'};
    }
    var journeyChoice=A4.Journey&&A4.Journey.choose(state,user,catalog,p,picked,rng);
    if(journeyChoice==='stay')return {kind:'run'};
    if(journeyChoice){}
    else if (p.kind === 'add') {A4.Stats.choice(state,p.options,picked,catalog);addCard(state,run,picked);}
    else if (p.kind === 'upgrade') {
      card = run.deck.filter(function (c) { return c.uid === picked; })[0];
      A4.assert(card && !card.upgraded && !card.treasureSlot && !catalog.cards[card.cardId].treasure,'강화할 수 없는 카드입니다.'); card.upgraded = true;
    } else if (p.kind === 'remove') run.deck = run.deck.filter(function (c) { return c.uid !== picked; });
    else if (p.kind === 'swapTarget') {return performSwap(state,user,catalog,picked,p.extra.mode,rng);}
    else if (p.kind === 'treasure') {A4.Stats.choice(state,p.options,picked,catalog,true);treasureChange=setTreasure(state,user,p.extra.slot,picked,catalog);}
    else if (p.kind === 'offerRemove') { if (index === 1) run.queue.unshift('remove'); }
    else if (p.kind === 'swap') {
      if(index===1||index===2){
        var tier=index===1?'low':'high',targets=Object.keys(run.treasures).filter(function(slot){return catalog.treasures[run.treasures[slot]].tier===tier;});
        A4.assert(targets.length,'교체할 '+(tier==='low'?'하급':'상급')+' 보물이 없습니다. 다른 항목을 선택하세요.');
        if(targets.length>1)pending(state,run,'swapTarget',targets,{mode:index===1?'random':'chosen'});
        else return performSwap(state,user,catalog,targets[0],index===1?'random':'chosen',rng);
        return {kind:'run'};
      }
    } else if (p.kind === 'finalEdit') {
      if (index === 1) run.queue = ['remove','remove','add','add'].concat(run.queue);
      if (index === 2) run.queue = ['remove','remove'].concat(run.queue);
      if (index === 3) run.queue = ['add','add'].concat(run.queue);
    } else A4.fail('알 수 없는 선택 단계입니다.');
    nextReward(state,user,catalog,rng); if(run.journeyClear)return {kind:'finished',record:finish(state,user,'clear',now,rng,catalog)};return {kind:'run',treasureChange:treasureChange};
  }
  function submit(state,user,catalog,token,indices,now,rng,heroPower) {
    var run = user.run, ids = [], battle, result, queues;
    A4.assert(run && run.phase === 'BATTLE','진행 중인 전투가 없습니다.');
    A4.assert(run.turnToken === token,'이미 처리되었거나 이전 턴의 제출입니다. +탐험으로 현재 전투를 확인하세요.');
    battle = run.battle;
    indices.forEach(function (index) { A4.assert(A4.integer(index,1) && index <= battle.player.hand.length,'손패 번호가 올바르지 않습니다.'); ids.push(battle.player.hand[index-1].uid); });
    result = A4.Combat.submit(battle,ids,catalog,rng,{heroPower:!!heroPower});
    return battleResult(state,user,catalog,result,now,rng);
  }
  function battleResult(state,user,catalog,result,now,rng) {
    var run=user.run,queues;
    var b=run.battle;
    user.aiPublicHistory=user.aiPublicHistory||[];
    (b.history||[]).slice(b.aiPublicHistoryCursor||0).forEach(function(h){
      user.aiPublicHistory.push({turn:-1,phase:h.phase,player:(h.player||[]).map(function(card){return {cardId:card.cardId,element:card.element,upgraded:!!card.upgraded,countered:!!card.countered};})});
    });
    user.aiPublicHistory=user.aiPublicHistory.slice(-48);b.aiPublicHistoryCursor=(b.history||[]).length;
    applyRunChanges(state,user,catalog);
    if(run.battle.escapeRequested){
      if(run.battle.escapeRequested.side==='enemy'&&run.enemySpec){
        run.enemySpec.deck=run.enemySpec.deck.filter(function(x){return x.cardId!=='treasure_hearthstone';});
        run.enemySpec.treasures=(run.enemySpec.treasures||[]).filter(function(x){return x.treasureId!=='hearthstone';});
      }
      offerBattle(state,user,catalog,rng);return {kind:'run'};
    }
    var extraMessages=[];
    delete run.battle.pendingDoctorSpeeches;
    if(!run.battle.pendingChoice){extraMessages=(run.battle.pendingPowerAnnouncements||[]).slice();run.battle.pendingPowerAnnouncements=[];}
    var victoryAnnouncement=null,summary=run.battle.rulesVersion===3&&result.outcome!=='ongoing'?A4.BattleUI.summary(run.battle,run.wins+1,catalog):null;
    if (result.removedFromRun && result.removedFromRun.length) run.deck = run.deck.filter(function (c) { return result.removedFromRun.indexOf(c.uid) < 0; });
    if (result.outcome === 'defeat') return {kind:'finished',record:finish(state,user,'defeat',now,rng,catalog),log:result.log,battleSummary:summary,extraMessages:extraMessages};
    if (result.outcome === 'victory') {
      if(run.hero.startingTreasureId==='great_blood'){run.battle.player.hp=Math.min(run.battle.player.maxHp,run.battle.player.hp+12);}
      run.hp=run.battle.player.hp;
      A4.Stats.battle(state,run,true);
      victoryAnnouncement='⚔️ 탐험 - 승리! ⚔️\n'+run.battle.enemy.name+' ✅️';
      recordEncounter(run,true);
      run.wins++; run.battle = null; run.turnToken = null;run.enemySpec=null;
      if (run.wins === 8 && catalog.config.engineVersion!==3) return {kind:'finished',record:finish(state,user,'clear',now,rng,catalog),log:result.log,battleSummary:summary,victoryAnnouncement:victoryAnnouncement,extraMessages:extraMessages};
      queues = {1:['low','add','add'],2:['upgrade','add','add'],3:['offerRemove','add','add'],4:['high','add','add'],5:['upgrade','add','add'],6:['swap','add','add'],7:['finalEdit']};
      if(A4.Journey&&catalog.config.engineVersion===3)A4.Journey.reward(run,catalog,rng);else run.queue=queues[run.wins].slice();nextReward(state,user,catalog,rng);
    } else run.turnToken = A4.id(state,'turn-');
    return {kind:'run',log:result.log,battleSummary:summary,victoryAnnouncement:victoryAnnouncement,extraMessages:extraMessages};
  }
  function applyRunChanges(state,user,catalog){
    var run=user.run,b=run&&run.battle;
    if(!b||!b.runChanges)return;
    
    function instances(callback){['player','enemy'].forEach(function(side){['hand','deck','rest','excluded','inFlight','runes'].forEach(function(zone){(b[side][zone]||[]).forEach(callback);});});}
    function persistCard(source,slot){
      if(!source||!catalog.cards[source.cardId])return;
      var treasureId=catalog.cards[source.cardId].treasureId;
      if(!slot&&treasureId){slot='extra-'+A4.id(state,'treasure-');run.treasures[slot]=treasureId;}
      var c={uid:A4.id(state,'card-'),cardId:source.cardId,upgraded:!!source.upgraded};if(slot)c.treasureSlot=slot;
      run.deck.push(c);instances(function(x){if(x.uid===source.uid||(source.uid&&x.originUid===source.uid))x.runUid=c.uid;});
      return c;
    }
    b.runChanges.forEach(function(change){
      if(change.side==='enemy')return;
      if(change.type==='addCard')persistCard(change.card);
      if(change.type==='removeCard'){
        var uid=change.runUid||change.uid;instances(function(x){if(x.uid===change.uid&&x.runUid)uid=x.runUid;});
        run.deck=run.deck.filter(function(x){return x.uid!==uid;});
      }
      if(change.type==='addTreasure'){
        var id=change.treasureId||change.id,def=catalog.treasures[id];if(!def)return;
        var slot='extra-'+A4.id(state,'treasure-');run.treasures[slot]=id;
        
        if(def.kind==='card'){
          var source=change.card||null;instances(function(x){if(x.uid===change.cardUid)source=x;});
          persistCard(source||{uid:change.cardUid,cardId:def.cardId,upgraded:false},slot);
        }
      }
      if(change.type==='removeTreasure'){
        var target=change.treasureId||change.id,keys=Object.keys(run.treasures),slotToRemove=null;
        keys.some(function(slot){if(run.treasures[slot]===target){slotToRemove=slot;return true;}return false;});
        if(slotToRemove){delete run.treasures[slotToRemove];run.deck=run.deck.filter(function(x){return x.treasureSlot!==slotToRemove;});}
      }
      if(change.type==='setShrine'){run.shrineId=change.shrineId;if(b.restartSpecs)b.restartSpecs.player.shrineId=change.shrineId;}
      if(change.type==='upgradeCard'){var upgradeUid=change.runUid;instances(function(x){if(x.uid===change.uid&&x.runUid)upgradeUid=x.runUid;});run.deck.forEach(function(x){if(x.uid===upgradeUid||x.uid===change.uid)x.upgraded=true;});}
      if(change.type==='bloodstones')run.bloodstones=change.amount;
      if(change.type==='setHeroPower')run.hero.power=A4.copy(change.power);
    });
    b.runChanges=[];
    
    if(b.restartSpecs){
      b.restartSpecs.player.deck=A4.copy(run.deck);b.restartSpecs.player.heroPower=A4.copy(run.hero.power);
      b.restartSpecs.player.passives=combinedPassives(user,catalog);
      b.restartSpecs.player.treasureIds=Object.keys(run.treasures).map(function(k){return run.treasures[k];});
    }
  }
  function equip(user,uid,slot,catalog) {
    A4.assert(!user.run,'진행 중인 탐험이 있으면 유물 장착을 변경할 수 없습니다.');
    A4.assert(A4.integer(slot,1) && slot <= user.slotCount,'사용할 수 없는 장착 슬롯입니다.');
    var item = A4.Economy.findRelic(user,uid), i, other;
    A4.assert(catalog.relics[item.relicId],'유물 정의가 없습니다.');
    for (i = 0; i < user.equipped.length; i++) if (i !== slot-1 && user.equipped[i]) {
      other = A4.Economy.findRelic(user,user.equipped[i]); A4.assert(other.relicId !== item.relicId,'같은 유물을 중복 장착할 수 없습니다.');
    }
    user.equipped[slot-1] = uid;
  }
  function act(state,user,action,catalog,now,room) {
    var rng = A4.random(state), result, slot;
     
    if(user.run){
      var run=user.run;
      Object.keys(run.treasures||{}).forEach(function(slot){
        if(run.treasures[slot]==='hearthstone'&&!run.deck.some(function(x){return x.cardId==='treasure_hearthstone';})){
          var converted={uid:A4.id(state,'card-'),cardId:'treasure_hearthstone',upgraded:false,treasureSlot:slot};run.deck.push(converted);
          if(run.battle){run.battle.player.passives=(run.battle.player.passives||[]).filter(function(x){return x.id!=='hearthstone';});run.battle.player.deck.push(A4.copy(converted));}
        }
      });
      var powers=[run.hero&&run.hero.power],battle=run.battle;
      if(battle)['player','enemy'].forEach(function(side){powers.push(battle[side]&&battle[side].heroPower);if(battle.restartSpecs)powers.push(battle.restartSpecs[side]&&battle.restartSpecs[side].heroPower);});
      powers.forEach(function(power){if(power&&(power.id==='patchwerk'||power.id==='aurelion_sol')){var current=A4.BossRules.power(power.id);power.cooldown=4;power.text=current.text;}});
      powers.forEach(function(power){if(power&&power.id==='inquiry'){var hero=catalog.heroes.filter(function(h){return h.id==='celeste';})[0];if(hero){Object.keys(power).forEach(function(key){delete power[key];});Object.keys(hero.power).forEach(function(key){power[key]=A4.copy(hero.power[key]);});}}});
      powers.forEach(function(power){if(power&&(power.id==='hanar'||power.id==='fiora'||power.id==='yuumi'||power.id==='ivysaur'||power.id==='aviana'))power.text=A4.BossRules.power(power.id).text;});
      powers.forEach(function(power){if(power&&power.id==='boo'){var current=A4.BossRules.power('boo');Object.keys(current).forEach(function(key){power[key]=A4.copy(current[key]);});}});
      powers.forEach(function(power){if(power&&power.id==='meltranix'){var current=A4.BossRules.power('meltranix');Object.keys(current).forEach(function(key){power[key]=A4.copy(current[key]);});}});
      if(battle)['player','enemy'].forEach(function(side){var f=battle[side];if(f&&f.heroPower&&(f.heroPower.id==='patchwerk'||f.heroPower.id==='aurelion_sol')&&f.heroPowerUsedTurn>=0)f.heroPowerReadyTurn=Math.max(f.heroPowerReadyTurn||0,f.heroPowerUsedTurn+4);});
      powers.forEach(function(power){if(power&&power.id==='nurture'&&power.effects&&power.effects.some(function(e){return e.type==='heal';})){power.text='내 손에 있는 무작위 카드의 비용이 (1) 감소합니다.';power.effects=[{type:'discountRandomHand',amount:1}];}});
    }

    if(catalog.config.relicsEnabled===false&&['equip','unequip','expand','enhance'].indexOf(action.type)>=0)A4.fail('유물 시스템은 준비 중입니다.');
    if(catalog.config.shopEnabled===false&&action.type==='pull')A4.fail('상점 시스템은 준비 중입니다.');
    if (action.type === 'explore') {result=start(state,user,catalog,now,room,rng);syncDeadline(user,now);return result;}
    if (action.type === 'encounterResponse') {
      A4.assert(user.run&&user.run.phase==='ENCOUNTER','현재 전투 시작을 기다리고 있지 않습니다.');
      if(!user.session||now>=user.session.until){user.session=null;return {kind:'message',text:'⚔️ 세션 종료: +탐험으로 기존 탐험을 이어갑니다.'};}
      A4.assert(user.session.room===room,'+탐험으로 이 방에서 이어가세요.');
      if(!action.accept){user.session=null;return {kind:'message',text:'⚔️ 세션 종료: +탐험으로 기존 탐험을 이어갑니다.'};}
      beginBattle(state,user,catalog,rng);user.session={room:room,until:now+catalog.config.sessionTimeoutMs};syncDeadline(user,now);return {kind:'run'};
    }
    if (action.type === 'pauseBattle') {
      A4.assert(user.run&&user.run.phase==='BATTLE'&&user.session&&user.session.room===room,'현재 진행 중인 전투가 없습니다.');
      var pausedBattle=user.run.battle;
      if(!canPauseBattle(pausedBattle))return {kind:'message',text:'시간을 신뢰하지 말라. 내가 너를 지도할 것이다.'};
      user.session=null;pausedBattle.mainDeadline=null;
      if(pausedBattle.pendingChoice&&pausedBattle.pendingChoice.lamp)delete pausedBattle.pendingChoice.lampDeadline;
      return {kind:'message',text:'⚔️ 세션 종료: +탐험으로 기존 탐험을 이어갑니다.'};
    }
    if (action.type === 'pauseReward') {
      A4.assert(user.run&&user.run.phase==='REWARD','현재 보상 단계가 아닙니다.');
      user.session=null;
      return {kind:'message',text:'⚔️ 세션 종료: +탐험으로 기존 탐험을 이어갑니다.'};
    }
    if (action.type === 'lampSearch') {
      A4.assert(user.run&&user.run.phase==='BATTLE'&&user.session&&user.session.room===room,'현재 진행 중인 전투가 없습니다.');
      var selection=user.run.battle.pendingChoice;
      A4.assert(selection&&selection.lamp,'현재 램프 검색 단계가 아닙니다.');
      if(action.query===null){selection.lampStage='search';selection.options=[];}
      else {
        var needle=String(action.query||'').replace(/\s/g,'').toLowerCase();
        A4.assert(needle,'+카드명으로 원하는 카드명을 검색하세요.');
        selection.options=catalog.cardPool.filter(function(id){return catalog.cards[id].name.replace(/\s/g,'').toLowerCase().indexOf(needle)>=0;}).sort(function(a,b){var x=catalog.cards[a],y=catalog.cards[b];return x.cost-y.cost||(x.name<y.name?-1:x.name>y.name?1:0);}).map(function(id){return {cardId:id,upgraded:false};});
        selection.lampStage=selection.options.length?'results':'search';
        if(!selection.options.length)return {kind:'message',text:'검색 결과가 없습니다.\n'+A4.BattleUI.controls(user.run.battle,catalog)};
      }
      syncDeadline(user,now);return {kind:'run'};
    }
    if (action.type === 'timeout') {
      A4.assert(user.run&&user.run.phase==='BATTLE'&&user.run.battle.mainDeadline<=now,'만료된 메인 페이즈가 없습니다.');
      if(canPauseBattle(user.run.battle))return act(state,user,{type:'pauseBattle'},catalog,now,room);
      if(user.run.battle.pendingChoice){
        var pendingLamp=user.run.battle.pendingChoice;
        if(pendingLamp.lamp){pendingLamp.options=catalog.cardPool.map(function(id){return {cardId:id,upgraded:false};});pendingLamp.lampStage='results';}
        var options=user.run.battle.pendingChoice.options;
        result=select(state,user,catalog,user.run.turnToken,1+Math.floor(rng()*options.length),now,rng);
      }else result=submit(state,user,catalog,user.run.turnToken,[],now,rng,false);
      if(user.session)user.session.until=now+catalog.config.sessionTimeoutMs;
      syncDeadline(user,now);return result;
    }
    if (action.type === 'choose' || action.type === 'submit' || action.type === 'forfeit') {
      A4.assert(user.run,'진행 중인 탐험이 없습니다.');
      if (action.type !== 'forfeit') A4.assert(user.session && now < user.session.until,'⚔️ 세션 종료: +탐험으로 기존 탐험을 이어갑니다.');
      if (action.type === 'choose') result = select(state,user,catalog,action.token,action.index,now,rng);
      if (action.type === 'submit') result = submit(state,user,catalog,action.token,action.indices,now,rng,action.heroPower);
      if (action.type === 'forfeit') return {kind:'finished',record:finish(state,user,'forfeit',now,rng,catalog)};
      if (user.session) { user.session.room = room; user.session.until = now+catalog.config.sessionTimeoutMs; }
      syncDeadline(user,now);
      return result;
    }
    A4.Economy.refreshKeys(user,now);
    if (action.type === 'stats') return {kind:'stats',stats:A4.copy(state.stats||A4.Stats.empty())};
    if (action.type === 'encyclopedia') return {kind:'encyclopedia',query:action.query||''};
    if (action.type === 'inventory' || action.type === 'relics' || action.type === 'shop' || action.type === 'deck' || action.type === 'help' || action.type === 'rules') return {kind:action.type};
    if (action.type === 'equip') { equip(user,action.uid,action.slot,catalog); return {kind:'relics'}; }
    if (action.type === 'unequip') {
      A4.assert(!user.run,'진행 중인 탐험이 있으면 유물 장착을 변경할 수 없습니다.');
      A4.assert(A4.integer(action.slot,1) && action.slot <= user.slotCount,'잘못된 슬롯입니다.');
      user.equipped[action.slot-1] = null; return {kind:'relics'};
    }
    if (action.type === 'expand') {
      slot = user.slotCount+1; A4.assert(slot <= 3,'유물 슬롯은 최대 3개입니다.');
      A4.Economy.spend(user,catalog.slotCosts[slot]); user.slotCount = slot; return {kind:'relics'};
    }
    if (action.type === 'enhance') {
      result = A4.Economy.enhance(user,action.uid,catalog,rng);
      if (user.run && user.run.battle) {
        A4.Combat.syncPassives(user.run.battle,combinedPassives(user,catalog));
        if (!user.run.battle.resolution && user.run.battle.player.hp <= 0) return {kind:'finished',record:finish(state,user,'defeat',now,rng,catalog)};
      }
      return {kind:'enhancement',result:result};
    }
    if (action.type === 'pull') return {kind:'pull',relic:A4.Economy.pull(state,user,action.id,catalog,rng)};
    A4.fail('알 수 없는 행동입니다.');
  }
  function canPauseBattle(b){return !!b&&!b.mainTimeoutMs&&!['player','enemy'].some(function(side){var power=b[side].heroPower;return power&&power.id==='white_night';});}
  function syncDeadline(user,now){
    var b=user.run&&user.run.battle;
    if(!b||!user.run||user.run.phase!=='BATTLE')return;
    if(b.rulesVersion!==3){b.mainDeadline=null;return;}
    if(b.mainTimeoutMs===15000)b.mainTimeoutMs=20000;
    if(b.pendingChoice&&b.pendingChoice.lamp){
      if(!b.pendingChoice.lampDeadline)b.pendingChoice.lampDeadline=now+120000;
      b.mainDeadline=b.pendingChoice.lampDeadline;b.deadlineSerial='lamp:'+user.run.turnToken;b.deadlineLimit=120000;
      if(user.session)user.session.until=b.mainDeadline;return;
    }
    var limit=b.pendingChoice?150000:(b.mainTimeoutMs||150000);
    var serial=b.pendingChoice?'choice:'+user.run.turnToken:b.phaseSerial;
    if(user.session)user.session.until=now+150000;
    if((b.pendingChoice||!b.resolution)&&b.outcome==='ongoing'){
      if(!b.mainDeadline||b.deadlineSerial!==serial||b.deadlineLimit!==limit){b.mainDeadline=now+limit;b.deadlineSerial=serial;b.deadlineLimit=limit;}
      if(user.session)user.session.until=b.mainDeadline;
    }else b.mainDeadline=null;
  }
  return {restartEncounter:restartEncounter,newUser:newUser,act:act,passives:combinedPassives,syncDeadline:syncDeadline,canPauseBattle:canPauseBattle};
}());

// ---- src/validate.js ----
 
A4.validateState = function (state) {
  function ok(value,message) { A4.assert(value,'저장 데이터 검증 실패: '+message); }
  function object(value) { return value && typeof value === 'object' && !Array.isArray(value); }
  ok(object(state) && state.schemaVersion === 4,'지원하지 않는 버전');
  ok(A4.integer(state.sequence,0) && state.sequence < 9007199254740991,'식별자 순번');
  ok(A4.integer(state.rngState,1) && state.rngState <= 4294967295,'난수 상태');
  ok(object(state.users) && object(state.identities) && object(state.linkCodes),'계정 영역');
  if(state.stats!==undefined){
    ok(object(state.stats)&&state.stats.version===1,'통계 버전');
    ['cards','elements','treasures','bots'].forEach(function(kind){
      ok(object(state.stats[kind]),'통계 영역 '+kind);
      Object.keys(state.stats[kind]).forEach(function(id){var r=state.stats[kind][id];
        ok(object(r),'통계 기록');
        ['offered','picked','runs','totalWins','win','loss'].forEach(function(field){ok(A4.integer(r[field],0),'통계 수치 '+field);});
        ok(r.picked<=r.offered&&r.totalWins<=r.runs*8,'통계 집계 범위');
      });
    });
  }
  if(state.pendingLinks!==undefined){
    ok(object(state.pendingLinks),'연동 확인 영역');
    Object.keys(state.pendingLinks).forEach(function(k){var p=state.pendingLinks[k];ok(p&&state.users[p.owner]&&state.users[p.previousUser]&&typeof p.room==='string'&&typeof p.issuance==='string'&&/^\d{4}$/.test(p.code)&&A4.integer(p.expiresAt,0),'연동 확인 요청');});
  }
  if(state.adminHistory!==undefined){
    ok(Array.isArray(state.adminHistory)&&state.adminHistory.length<=256,'관리자 변경 기록');
    state.adminHistory.forEach(function(e){ok(e&&typeof e.id==='string'&&state.users[e.actorId]&&state.users[e.targetId]&&typeof e.command==='string'&&A4.integer(e.at,0),'관리자 변경 기록 형식');});
  }
  Object.keys(state.identities).forEach(function (key) { ok(typeof state.identities[key] === 'string' && A4.has(state.users,state.identities[key]),'계정 매핑 대상 누락'); });
  Object.keys(state.users).forEach(function (id) {
    var u=state.users[id], seen={}, r;
    ok(object(u) && u.id === id && typeof u.name === 'string','사용자 정보');
    if(u.aiPublicHistory!==undefined){
      ok(Array.isArray(u.aiPublicHistory)&&u.aiPublicHistory.length<=48,'AI 공개 제출 기록');
      u.aiPublicHistory.forEach(function(h){ok(h&&['MAIN1','MAIN2'].indexOf(h.phase)>=0&&Array.isArray(h.player),'AI 공개 페이즈 기록');
        h.player.forEach(function(card){ok(card&&typeof card.cardId==='string'&&typeof card.element==='string'&&typeof card.upgraded==='boolean'&&typeof card.countered==='boolean','AI 공개 카드 기록');});
      });
    }
    if(u.isAdmin!==undefined)ok(typeof u.isAdmin==='boolean','관리자 권한');
    if(u.mergedInto!==undefined)ok(typeof u.mergedInto==='string'&&u.mergedInto!==id&&state.users[u.mergedInto]&&!u.session,'연동된 이전 계정');
    ok(A4.integer(u.gold,0) && object(u.items) && A4.integer(u.items.keys,0) && A4.integer(u.items.stones,0) && A4.integer(u.items.essence,0),'재화');
    ok(A4.integer(u.keyUpdatedAt,0),'열쇠 시간');
    ok(A4.integer(u.slotCount,1) && u.slotCount <= 3 && Array.isArray(u.relics) && Array.isArray(u.equipped) && u.equipped.length <= u.slotCount,'유물 슬롯');
    u.relics.forEach(function (item) { ok(item && typeof item.uid === 'string' && !seen[item.uid] && typeof item.relicId === 'string' && A4.integer(item.level,0) && item.level <= 5,'유물 개체'); seen[item.uid]=item; });
    var equippedTypes={};
    u.equipped.forEach(function (uid) { if (uid === null) return; ok(seen[uid] && !equippedTypes[seen[uid].relicId],'장착 대상 누락 또는 중복'); equippedTypes[seen[uid].relicId]=true; });
    ok(Array.isArray(u.receipts) && u.receipts.length <= 256,'명령 처리 기록');
    u.receipts.forEach(function (receipt) { ok(receipt && typeof receipt.id === 'string' && typeof receipt.text === 'string','명령 처리 기록 형식'); });
    if (u.session) ok(typeof u.session.room === 'string' && A4.integer(u.session.until,0),'세션 시간');
    if (!u.run) return;
    r=u.run;
    if(r.gold!==undefined)ok(A4.integer(r.gold,0),'탐험 골드');
    if(r.bloodstones!==undefined)ok(A4.integer(r.bloodstones,0)&&r.bloodstones<=5,'혈석');
    if(r.shrineId!==undefined)ok(typeof r.shrineId==='string','제단 선택');
    if(r.hp!==undefined)ok(A4.integer(r.hp,1),'탐험 현재 체력');
    ok(typeof r.id === 'string' && A4.integer(r.wins,0) && r.wins <= 8 && ['HERO','ENCOUNTER','BATTLE','REWARD','READY'].indexOf(r.phase) >= 0,'탐험 단계');
    if(r.phase!=='HERO') ok(r.hero && typeof r.hero.id==='string' && r.hero.power,'선택 영웅');
    ok(Array.isArray(r.deck) && Array.isArray(r.queue) && Array.isArray(r.effects) && object(r.treasures),'탐험 덱과 보상 큐');
    seen={};
    r.deck.forEach(function (card) { ok(card && typeof card.uid === 'string' && !seen[card.uid] && typeof card.cardId === 'string' && typeof card.upgraded === 'boolean','탐험 카드 개체'); seen[card.uid]=true; });
    if (r.phase === 'HERO' || r.phase === 'REWARD') ok(r.pending && typeof r.pending.id === 'string' && Array.isArray(r.pending.options) && r.pending.options.length > 0,'보상 선택지');
    if (r.phase === 'ENCOUNTER') ok(!r.battle&&!r.pending&&r.enemySpec&&r.enemySpec.stage===r.wins+1&&r.enemySpec.enemyId===r.enemyId&&typeof r.enemySpec.name==='string'&&A4.integer(r.enemySpec.maxHp,1)&&Array.isArray(r.enemySpec.deck),'전투 시작 대기');
    if (r.phase === 'BATTLE') {
      ok(r.battle && A4.integer(r.battle.turn,0) && r.battle.outcome === 'ongoing' && typeof r.turnToken === 'string','전투 상태');
      var v3=r.battle.rulesVersion===3;
      ok((v3||r.battle.rulesVersion===2) && (v3?['STANDBY','MAIN1','MAIN2','END']:['MAIN1','MAIN2']).indexOf(r.battle.phase)>=0,'전투 규칙 버전·페이즈');
      [r.battle.player,r.battle.enemy].forEach(function (f,sideIndex) {
        var cards={};if(f&&f.fatigueExtra!==undefined)ok(A4.integer(f.fatigueExtra,0),'추가 탈진 피해');if(f&&f.daggers!==undefined)ok(A4.integer(f.daggers,0)&&f.daggers<=5,'단검');
        ok(f && A4.integer(f.hp,r.battle.resolution?-9007199254740991:1) && A4.integer(f.maxHp,1) && f.hp <= f.maxHp && A4.integer(f.mana,0) && A4.integer(f.maxMana,v3?0:1) && f.mana <= 5 && f.maxMana <= 5,'전투 체력·마나');
        ok(A4.integer(f.heroPowerUsedTurn,-1) && A4.integer(f.playedThisTurn,0),'영웅 능력·카드 사용 기록');
        (v3?['deck','hand','rest','excluded','inFlight']:['deck','hand','rest','excluded']).forEach(function (zone) {
          ok(Array.isArray(f[zone]),'전투 카드 영역');
          f[zone].forEach(function (card) { ok(card && typeof card.uid === 'string' && !cards[card.uid] && typeof card.cardId === 'string','전투 카드 중복/누락'); cards[card.uid]=true; });
        });
        ok(!f.runes||Array.isArray(f.runes)&&f.runes.length<=1,'발동 중인 룬 수');
        (f.runes||[]).forEach(function(card){ok(card&&typeof card.uid==='string'&&!cards[card.uid]&&typeof card.cardId==='string','룬 카드 중복/누락');cards[card.uid]=true;});
        (f.shrines||[]).forEach(function(a){ok(typeof a.id==='string'&&A4.integer(a.maxHp,1)&&A4.integer(a.hp,0)&&a.hp<=a.maxHp,'제단 체력');if(a.hp===0)ok(A4.integer(a.reviveTurn,0),'제단 부활 예약');});
        ok(f.hand.length <= (v3?A4.Battle.handLimit(r.battle,sideIndex===0?'player':'enemy',A4.catalog):A4.HAND_LIMIT),'손패 한도');
      });
      ok(Array.isArray(r.battle.enemyPlan) && (r.battle.resolution||r.battle.enemyPlanTurn === r.battle.turn),'상대의 예약 행동');
      ok(r.battle.resolution||r.battle.enemyPlanPhase===r.battle.phase,'상대 행동 페이즈');
      if(r.battle.pendingChoice) ok(r.battle.resolution && Array.isArray(r.battle.pendingChoice.options) && (r.battle.pendingChoice.options.length>0||(r.battle.pendingChoice.lamp===true&&r.battle.pendingChoice.lampStage==='search')),'전투 도중 선택');
    }
  });
  return true;
};

// ---- src/battle-ui.js ----
 
A4.BattleUI = (function () {
  var icons={FIRE:'🔥',ICE:'❄️',NATURE:'🍃',LIGHTNING:'⚡',HOLY:'🕊️',NEUTRAL:'🌊',COSMIC:'🌌',CURSE:'💔'};
  function phase(p){return {MAIN1:'메인 1',MAIN2:'메인 2',STANDBY:'스탠바이',END:'엔드'}[p]||p;}
  function name(d,c){var icon=d.displayElement||icons[d.element]||'🌊';if(d.treasure){var t=c.treasures[d.rule];icon+=t&&t.tier==='high'?'💫':'✨';}if(d.rune&&icon.indexOf('💎')<0)icon+='💎';return '['+icon+'] '+d.name;}
  function duration(e,b){if(e.until===undefined)return '이번 전투';var start=Math.max(b.turn,e.from===undefined?b.turn:e.from),n=Math.max(0,e.until-start+1);return (e.from>b.turn?(e.from===b.turn+1?'다음 턴부터 · ':(e.from+1)+'턴부터 · '):'')+n+'턴';}
  function elements(a){return (a||[]).map(function(e){return icons[e]||e;}).join('·');}
  function states(b,side,c){
    var f=b[side],s=f.status,st=s.cards||{},ts=s.treasures||{},lines=[],pilgrimage=0,extraDraw={},shownEffects={};
    function add(title,text,e,unique){
      var line='• '+title+': '+text+' ('+(e?duration(e,b):'이번 전투')+')';
      if(unique){if(shownEffects[line])return;shownEffects[line]=true;}
      lines.push(line);
    }
    (f.runes||[]).forEach(function(card){lines.push('• '+name(A4.Runes.definition(card,c),c));});
    (st.effects||[]).forEach(function(e){
      if(e.kind==='spent'||(e.until!==undefined&&e.until<b.turn))return;
      if(e.kind==='extraDraw'){var key=JSON.stringify([e.from===undefined||e.from<=b.turn?b.turn:e.from,e.until===undefined?null:e.until]);if(!extraDraw[key])extraDraw[key]={amount:0,from:e.from,until:e.until};extraDraw[key].amount+=e.amount||0;return;}
      if(e.kind==='pilgrimage'){if(e.from===undefined||e.from<=b.turn)pilgrimage+=e.amount||0;return;}
      var info={
        disarm:['무장해제','방어도를 획득할 수 없다.'],
        vulnerable:['취약','받는 피해량이 50% 증가한다.'],
        weakened:['약화','가하는 피해량이 25% 감소한다.'],
        manaBurn:['마나 연소','회복된 마나가 '+e.amount+' 감소한다.'],
        healScale:['작열통',e.value===0?'체력을 회복할 수 없다.':e.value===0.5?'회복 효과가 절반으로 감소한다.':'회복 효과가 '+Math.round((1-e.value)*100)+'% 감소한다.'],
        solar:['태양 작렬','받은 피해 '+(e.amount||0)+'/10. 누적 10에 도달하면 피해를 '+e.burst+' 받는다.'],
        flameVeil:['화염 장막','받는 피해가 '+e.amount+' 감소하고 피해를 받으면 상대에게 '+e.amount+' 피해를 준다.'],
        fireOverpower:['화염 제단','화염 카드가 압도를 얻는다.'],
        iceShield:['얼음 방패','전기 카드 외의 피해를 받지 않는다.'],
        damageCap:['확고한 알리바이','한 번에 받는 피해가 최대 '+e.amount+'이 된다.'],
        capsule:['냉동 캡슐','누적 피해 '+(e.amount||0)+'. 만료되는 엔드 페이즈에 '+(e.multiplier===2?'그 2배만큼':'그만큼')+' 상대에게 피해를 준다.'],
        costIncrease:['칼바람','카드 비용이 '+e.amount+' 증가한다.'],
        forest:['살아 움직이는 숲','카운터할 때마다 상대에게 '+e.damage+' 피해를 준다. 내 카드가 카운터되면 대신 내가 '+e.selfDamage+' 피해를 받는다.'],
        extraDraw:['이슬 절차','스탠바이 페이즈에 카드를 '+e.amount+'장 더 뽑는다.'],
        forbiddenElements:['마비',elements(e.elements)+' 카드를 사용할 수 없다.'],
        immune:['면역','피해를 받지 않는다.'],
        immuneCards:['불굴','상대 카드의 피해를 받지 않는다.'],
        elementOverride:['두꺼비집','카드 속성이 '+elements([e.element])+'로 바뀐다.'],
        iceTrap:['얼음 덫',((e.sourceSide||(side==='player'?'enemy':'player'))==='player'?elements([e.element])+' 카드 ':'비공개 속성의 카드 ')+(e.all?'전부를':'첫 1장을')+' 차단한다.'],
        temporaryUpgrade:['충전','이번 턴에 뽑는 일반 카드가 턴이 끝날 때까지 강화된다.'],
        revelation:['계시','지정된 카드가 차단되면 상대가 카드를 2장 뽑는다.'],
        atlasDiscard:['마법공학: 아틀라스','발견하여 얻는 카드를 레스트로 보낸다.'],
        fuseDiscard:['마법공학: 퓨즈','추가로 뽑는 카드를 레스트로 보낸다.'],
        nibiruDiscard:['마법공학: 니비루','제출한 카드를 차단한다.']
      }[e.kind];
      if(info)add(e.name||info[0],info[1],e,['disarm','vulnerable','weakened','immune','immuneCards','iceShield','damageCap','healScale','fireOverpower','forbiddenElements','elementOverride','temporaryUpgrade'].indexOf(e.kind)>=0);
    });
    Object.keys(extraDraw).forEach(function(key){var e=extraDraw[key];add('이슬 절차','스탠바이 페이즈에 카드를 '+e.amount+'장 더 뽑는다.',e);});
    if(pilgrimage)add('성지순례','엔드 페이즈마다 상대에게 '+pilgrimage+'의 피해를 준다.');
    (s.cardLocks||[]).forEach(function(e){
      if(e.until<b.turn)return;
      if(e.name==='성전'||e.name==='성전+')add('성전','신성 카드만 사용할 수 있다.',e,true);
      else add(e.name||'카드 사용 제한',(e.elements?elements(e.elements)+' 카드를':'카드를')+' 사용할 수 없다.',e,true);
    });
    (s.foresightTurns||[]).filter(function(t){return t>=b.turn&&(b[side==='player'?'enemy':'player'].status.foresightTurns||[]).indexOf(t)<0;}).forEach(function(t){add('예지','상대가 제출할 카드를 확인한다.',{from:t,until:t});});
    if(f.overloadNext)add('과부하','다음 턴에 회복하는 마나가 '+f.overloadNext+' 감소한다.',{from:b.turn+1,until:b.turn+1});
    if(f.overloadLocked)add('과부하','이번 턴의 마나 '+f.overloadLocked+'개가 잠겼다.',{until:b.turn});
    if(s.warnings)add('경고',s.warnings+'/3. 3에 도달하면 추방된다.');
    var opposingPower=b[side==='player'?'enemy':'player'].heroPower;
    if(opposingPower&&opposingPower.id==='meltranix'&&opposingPower.kind==='passive')add('자백','손패의 첫 번째와 마지막 카드만 낼 수 있다.');
    else if(s.confession&&(s.confession.until===undefined||s.confession.until>=b.turn))add('자백','손패의 첫 번째와 마지막 카드만 낼 수 있다.',s.confession);
    (f.shrines||[]).forEach(function(a){lines.push('• [🕯] '+a.name+': ❤️ '+a.hp+'/'+a.maxHp+(a.hp<=0?' (부활까지 '+Math.max(0,a.reviveTurn-b.turn)+'턴)':''));});
    if(s.classes&&s.classes.nextBloodPayment)add('혈석 의식',s.classes.nextBloodPayment==='opponent'?'다음 영웅 능력이 상대의 체력을 비용으로 사용한다.':'다음 영웅 능력이 체력을 소모하지 않는다.');
    if(s.classes&&s.classes.powerBonus)add('위력','카드 피해량·회복량 +'+s.classes.powerBonus);
    if(s.execution)add('처형',String(s.execution));
    if(s.poison)add('중독',String(s.poison));
    if(s.cosmicBonus)add('우주의 균형','카드 피해량과 회복량이 '+s.cosmicBonus+' 증가한다.');
    if(s.salvation)add('구원의 길','매 턴 1 감소하며, 양쪽이 직접 낸 신성 카드마다 추가로 1 감소한다.',{until:b.turn+Math.max(0,s.salvation.remaining)-1});
    if(st.ignite)add('점화','+'+st.ignite);
    if(st.lightningBonus)add('전류 공급','전기 카드 피해량이 '+st.lightningBonus+' 증가한다.');
    if(st.currentStacks)add('전류 공급','다음 피해 증가까지 1회 남았다.');
    if(ts.freeMain2Turn===b.turn&&b.phase==='MAIN2')add('가속의 장화','카드 비용이 0이 된다.',{until:b.turn});
    if(ts.escapeTurn===b.turn)add('비상구 열쇠','내 카드가 레스트에 갈 때마다 카드를 '+(ts.escapeStacks||1)+'장 뽑는다.',{until:b.turn});
     
    var scheduled={};
    (b.scheduled||[]).forEach(function(e){
      var t=e.task;if(t.side!==side||e.turn<b.turn)return;
      var title=t.card?A4.Battle.describeCard(t.card,c).name:t.displaySource&&t.displaySource.label.name;
      var text=t.effect?A4.UI.effects([t.effect]):({hourglass:'메인 페이즈 2 시작 시 마나를 모두 회복하고 카드를 2장 뽑는다.',boots:'메인 페이즈 2에서 카드 비용이 0이 된다.',nextWaves:'스탠바이 페이즈시에 카드를 1장 뽑는다.',restoreMirage:'엔드 페이즈에 원래 손패로 돌아온다.',damage:'스탠바이 페이즈시에 상대에게 피해를 '+t.amount+' 준다.',heal:'스탠바이 페이즈시에 체력을 '+t.amount+' 회복한다.',mana:'스탠바이 페이즈시에 마나를 '+t.amount+' 얻는다.',charge:'스탠바이 페이즈시에 이번 턴 동안 일반 카드들을 강화한다.',burnout:'스탠바이 페이즈시에 지정된 상대 손패를 레스트로 보낸다.',loseShield:'스탠바이 페이즈시에 보호막을 '+t.amount+' 잃는다.',returnRest:'스탠바이 페이즈시에 사용한 카드를 레스트에서 손으로 가져온다.',goldenDelivery:'스탠바이 페이즈시에 선택한 강화 카드를 손으로 가져온다.'}[t.op]);
      if(!text)return;title=title||({nextWaves:'끝없는 파도',hourglass:'자연의 모래시계',boots:'가속의 장화',restoreMirage:'신기루'}[t.op]||'예약 효과');
      var key=title+text;if(!scheduled[key])scheduled[key]={title:title,text:text,until:e.turn};else scheduled[key].until=Math.max(scheduled[key].until,e.turn);
    });
    Object.keys(scheduled).forEach(function(k){var e=scheduled[k];add(e.title,e.text,e);});
    return lines;
  }
  function ending(text){
     
    var value=String(text||'').replace(/\s*[（(][^()（）]*[)）]\s*$/, '').replace(/[^가-힣ㄱ-ㅎㅏ-ㅣA-Za-z0-9]+$/g,''),ch=value.slice(-1),code=value.charCodeAt(value.length-1);
    if(code>=44032&&code<=55203)return (code-44032)%28;
    if(ch==='ㄹ'||/[178]/.test(ch)&&ch)return 8;
    if(/[036]/.test(ch)&&ch)return 1;
    if(/[ㄱ-ㅎ]/.test(ch)&&ch)return 1;
    if(/[lr]/i.test(ch)&&ch)return 8;
    if(/[mn]/i.test(ch)&&ch)return 1;
    return 0;
  }
  function subject(text){return text+(ending(text)?'이':'가');}
  function instrumental(text){var end=ending(text);return text+(end&&end!==8?'으로':'로');}
  function summary(b,stage,c){
    var r=b.report||{turn:b.turn,phase:b.phase,nodes:[],logs:[]},lines=[],ready=b.outcome==='ongoing'&&!b.resolution&&!b.pendingChoice,shownPhase=ready?b.phase:(r.submitted?r.phase:b.phase),shownTurn=ready?b.turn:(r.submitted?r.turn:b.turn);
    lines.push('⚔️ 탐험 '+stage+'/8 · '+((shownTurn+1)+'턴 · '+phase(shownPhase))+' ⚔️');
    function tree(n,depth){if(depth>24)return '…';var children=r.nodes.filter(function(x){return x.parent===n.id;});return name(n.label,c)+(n.countered?' ❌️':'')+(children.length?' ⮕ '+children.map(function(x){return tree(x,depth+1);}).join(', '):'');}
    ['player','enemy'].forEach(function(s){var roots=r.nodes.filter(function(n){return n.side===s&&n.parent===null;});if(r.submitted||roots.length)lines.push(b[s].name+': '+(roots.map(function(n){return tree(n,0);}).join(', ')||'쉬기'));});
    ['player','enemy'].forEach(function(s){var f=b[s];lines.push('','■ '+f.name+': ❤️ '+f.hp+(f.shield?'(+'+f.shield+')':'')+'/'+f.maxHp);lines=lines.concat(states(b,s,c));});
    if(r.logs.length)lines.push('');
    var pilgrimageLogs={},drawLogs={};
    r.logs.forEach(function(e){
      if(e.type==='draw'&&e.source){var drawKey=e.side+':'+e.source.side+':'+e.source.label.name.replace(/\+$/,'');if(!drawLogs[drawKey])drawLogs[drawKey]={amount:0,shown:false};drawLogs[drawKey].amount+=e.amount;}
      if(e.type!=='damage'||!e.source||!/^성지순례\+?$/.test(e.source.label.name))return;
      var key=e.side+':'+e.source.side;
      if(!pilgrimageLogs[key])pilgrimageLogs[key]={amount:0,blocked:0,modified:false,shown:false};
      pilgrimageLogs[key].amount+=e.amount;pilgrimageLogs[key].blocked+=e.blocked||0;pilgrimageLogs[key].modified=pilgrimageLogs[key].modified||!!e.modified;
    });
    r.logs.forEach(function(e){
      var target=e.side==='player'?b.player.name:b.enemy.name,src=e.source,actor=src?(src.side==='player'?b.player.name:b.enemy.name):target,via=src?' '+instrumental(name(src.label,c)):'',text;
      if(e.type==='damage'&&src&&/^성지순례\+?$/.test(src.label.name)){
        var total=pilgrimageLogs[e.side+':'+src.side];if(total.shown)return;total.shown=true;
        text=subject(target)+' [🕊️] 성지순례로 피해를 '+(total.amount>=2||total.modified?'*'+total.amount+'*':total.amount)+' 받았다.'+(total.blocked?' (보호막 흡수 '+total.blocked+')':'');
      }
      else if(e.type==='damage')text=subject(target)+via+' 피해를 '+(e.modified?'*'+e.amount+'*':e.amount)+' 받았다.'+(e.blocked?' (보호막 흡수 '+e.blocked+')':'');
      else if(e.type==='heal')text=subject(actor)+via+' '+(actor===target?'체력을':target+'의 체력을')+' '+(e.modified?'*'+e.amount+'*':e.amount)+' 회복했다.';
      else if(e.type==='draw'){var group=src&&drawLogs[e.side+':'+src.side+':'+src.label.name.replace(/\+$/,'')];if(group&&group.shown)return;if(group)group.shown=true;text=subject(target)+via+' 카드를 '+(group?group.amount:e.amount)+'장 뽑았다.';}
      else if(e.type==='shield')text=subject(target)+via+' 보호막을 '+Math.abs(e.amount)+(e.amount>0?' 얻었다.':' 잃었다.');
      else if(e.type==='mana')text=target+'의 마나가'+via+' '+Math.abs(e.amount)+(e.amount>0?' 증가했다.':' 감소했다.');
      else if(e.type==='overflow')text=target+'의 손패가 가득 차 '+(e.cards&&e.cards.length?e.cards.map(function(d){return name(d,c);}).join(', ')+' ':'')+'카드 '+e.amount+'장이 제외되었다.';
      else if(e.type==='gainCard')text=subject(actor)+via+' '+(actor===target?'손에':target+'의 손에')+' 카드 '+e.amount+'장을 가져왔다.';
      else if(e.type==='move')text=subject(actor)+via+' '+target+'의 '+(e.cards&&e.cards.length?e.cards.map(function(d){return name(d,c);}).join(', ')+' ':'')+'카드 '+e.amount+'장을 '+({rest:'레스트로 보냈다.',deck:'덱으로 옮겼다.',excluded:'제외했다.'}[e.text]||'이동했다.');
      else if(e.type==='poison')text=subject(actor)+via+' '+target+'에게 중독을 '+e.amount+' 부여했다.';
      else if(e.type==='discount')text=subject(actor)+via+' '+(e.cards&&e.cards.length?name(e.cards[0],c):'손에 있는 카드 1장')+'의 비용을 '+e.amount+' 줄였다. (💧'+e.text+')';
      else if(e.type==='doubleHealth')text=subject(actor)+via+' 현재 체력과 최대 체력을 늘렸다. (❤️ '+e.text+')';
      else if(e.type==='powerScaling')text=subject(actor)+via+' 이번 전투의 카드 피해량과 회복량을 1 높였다. (누적 +'+e.text+')';
      else if(e.type==='powerShuffle')text=subject(actor)+via+' '+target+'의 덱에 '+e.text+' '+e.amount+'장을 섞어 넣었다.';
      else if(e.type==='powerCounter')text=subject(actor)+via+' '+target+'의 '+e.cards.map(function(d){return name(d,c);}).join(', ')+' 카드를 카운터했다.';
      else if(e.type==='powerNoTarget')text=subject(actor)+via+' 효과를 적용할 대상이 없어 아무 변화도 일어나지 않았다.';
      else if(e.type==='text')text=e.text;
      if(text)lines.push('• '+text);
    });
    return lines.join('\n');
  }
  function controls(b,c){
    var selection=b.pendingChoice,op=selection&&selection.continuation&&selection.continuation.op;
    if(selection&&selection.lamp){
      var lampLines=['⚔️ 제피르스의 램프 ⚔️',''];
      if(selection.lampStage==='search')lampLines.push('+카드명으로 원하는 카드명을 검색하세요.');
      else {
        selection.options.forEach(function(x,i){lampLines.push((i+1)+'. '+A4.UI.card(x,c).replace(' — ','\n'));});
        lampLines.push('',selection.options.map(function(x,i){return i+1;}).concat(['n']).join(' / '));
      }
      return lampLines.join('\n');
    }
    if(op==='iceTrap'||op==='elementChoice'){
      var elements={FIRE:'[🔥] 화염',NATURE:'[🍃] 자연',LIGHTNING:'[⚡] 전기',ICE:'[❄️] 냉기',HOLY:'[🕊️] 신성'};
      return ['⚔️ 속성 선택 ⚔️',''].concat(A4.Battle.choiceOptions(selection).map(function(x,i){return (i+1)+'. '+elements[x.id];})).join('\n');
    }
    var dredging=b.pendingChoice&&b.pendingChoice.continuation&&b.pendingChoice.continuation.op==='dredge';
    if(b.pendingChoice&&(b.pendingChoice.discover||dredging)){
      var choice=b.pendingChoice,next=choice.continuation||{},source=next.displaySource;
      var sourceName=source&&source.label&&source.label.name;
      if(!sourceName&&next.card)sourceName=A4.Battle.describeCard(next.card,c).name;
      var discovery=['⚔️ '+(dredging?'인양':'발견')+(sourceName?' - '+sourceName:'')+' ⚔️'];
      choice.options.forEach(function(x,i){
        var text=x.cardId?A4.UI.card(x,c):(x.name||x.label)?(x.name||x.label)+(x.text?'\n'+x.text:''):x.text||String(x);
        discovery.push((i+1)+'. '+text.replace(' — ','\n'));
      });
      return discovery.join('\n');
    }
    var ctx=A4.Battle.context(b,c,function(){return 0.5;},{side:'player'},[]),lines=[];
    function mana(f){var m='';for(var i=0;i<Math.max(f.maxMana,f.mana);i++)m+=i<f.mana?'💧':'➖️';return '마나 | '+m+' ('+f.mana+'/'+f.maxMana+')';}
    ['enemy','player'].forEach(function(s){var f=b[s];if(lines.length)lines.push('');lines.push((s==='enemy'?'▶️ 상대':'⏩️ 나의')+' 손패 '+f.hand.length+'/'+ctx.limit(s)+' · 덱 '+f.deck.length+' · 레스트 '+f.rest.length,mana(f));if(f.heroId==='agamaggan'||f.heroPower&&f.heroPower.id==='bloodcraft'||f.bloodstones)lines.push('혈석 | '+new Array((f.bloodstones||0)+1).join('🩸')+' ('+(f.bloodstones||0)+'/5)');if(f.heroId==='silent'||f.daggers)lines.push('단검 | '+new Array((f.daggers||0)+1).join('🗡️ ').trim()+' ('+(f.daggers||0)+'/5)');});
    lines.push('');
    if(b.pendingChoice){lines.push(b.pendingChoice.label||'카드를 선택하세요.');b.pendingChoice.options.forEach(function(x,i){lines.push((i+1)+'. '+(x.cardId?A4.UI.card(x,c):x.name||x.label||x.text||String(x)));});lines.push('번호 하나를 입력하세요.');}
    else {
      var p=b.player.heroPower;
      lines.push('0. '+(p?name({name:p.name,displayElement:'🛟'},c)+' | '+(p.kind==='active'?'💧'+ctx.powerCost('player'):'⏳️'):'영웅 능력 없음')+(p&&p.kind==='active'&&ctx.modify('powerUsable',{side:'player',power:p,allowed:b.player.heroPowerUsedTurn!==b.turn&&(b.player.heroPowerReadyTurn||0)<=b.turn}).allowed?'':' ❌️'));
      b.player.hand.forEach(function(x,i){lines.push((i+1)+'. '+name((function(){var d=ctx.def(x);if(x.originalCardId==='crystal_ball')d.displayElement='🌌'+(d.displayElement||icons[d.element]||'🌊');return d;})(),c)+' | '+(ctx.def(x).bloodCost!==undefined?'🩸'+ctx.cost('player',x):A4.Classes&&A4.Classes.alive(b.player,'hireek').length?'❤️'+ctx.cost('player',x)*5:'💧'+ctx.cost('player',x))+(A4.Battle.cardAllowed(b,'player',c,x)?'':' ❌️'));});
      var v=A4.Battle.publicView(b);if(v.foreseenCards)lines.push('👁 상대의 예정 카드: '+(v.foreseenCards.map(function(x){return name(A4.Battle.describeCard(x,c),c);}).join(', ')||'쉬기'));if(v.enemyReacting)lines.push('👁 상대가 예지 중입니다.');
    }
    if(!b.pendingChoice)lines.push('s / p / gg');
    return lines.join('\n');
  }
  return {summary:summary,controls:controls};
}());

// ---- src/ui.js ----
A4.UI = (function () {
   
  var separator='\u001e';
  function effects(list) {
    var words = {damage:'피해',heal:'회복',shield:'보호막',draw:'드로우',maxHp:'최대 체력',startingShield:'시작 보호막',damageBonus:'피해 증가',turnDrawBonus:'추가 드로우',excludeSelf:'이 카드를 제외',removeFromRun:'탐험 덱에서 이 카드를 제거',upgradeSelf:'이번 전투에서 이 카드를 강화',generate:'카드 생성'};
    return (list || []).map(function (e) { var target=e.target || (e.type === 'damage' ? 'opponent' : 'self'); return ({self:'자신 ',opponent:'상대 ',both:'양쪽 '}[target] || '')+(words[e.type] || e.type) + (e.cardId ? ' '+e.cardId : '') + (e.amount !== undefined ? ' '+e.amount : ''); }).join(', ') || '효과 없음';
  }
  function card(instance, catalog, battle, brief) {
    var def = A4.Combat.describeCard(instance,catalog);
    var description=def.text;
    if (instance.upgraded && catalog.cards[instance.cardId].upgrade && !catalog.cards[instance.cardId].upgrade.text) description=null;
    var icon=def.displayElement||({FIRE:'🔥',ICE:'❄️',NATURE:'🍃',LIGHTNING:'⚡',HOLY:'🕊️',NEUTRAL:'🌊',COSMIC:'🌌',CURSE:'💔'}[def.element]||'🌊');
    if(def.treasure){var t=catalog.treasures[def.rule];icon+=t&&t.tier==='high'?'💫':'✨';}
    if(def.rune&&icon.indexOf('💎')<0)icon+='💎';
    var cost=battle&&battle.rulesVersion===3?A4.Battle.cardCost(battle,'player',instance,catalog):def.cost;
    var healthPayment=battle&&A4.Classes&&A4.Classes.alive(battle.player,'hireek').length>0;
    return '['+icon+'] '+def.name + (instance.upgraded && def.name.slice(-1) !== '+' ? '+' : '') + ' | '+(def.bloodCost!==undefined?'🩸'+cost:healthPayment?'❤️'+cost*5:'💧'+cost)+(brief?'':' — '+(description || effects(def.effects)));
  }
  function deckCard(run, uid) { return run.deck.filter(function (c) { return c.uid === uid; })[0]; }
  function treasure(id,catalog) {
    var t = catalog.treasures[id];
    return '['+(t.tier==='high'?'💫':'✨')+'] '+t.name+' ('+(t.kind === 'card' ? '카드형' : '지속 효과형')+') — '+(t.text || (t.kind === 'card' ? card({cardId:t.cardId,upgraded:false},catalog) : effects(t.effects)));
  }
  function reward(r) { var parts=[];if(r.gold>0)parts.push(r.gold+'C');if(r.keys>0)parts.push('미궁 열쇠 '+r.keys+'개');if(r.stones>0)parts.push('강화석 '+r.stones+'개');if(r.essence>0)parts.push('정수 '+r.essence+'개');return parts.join(' / ')||'없음'; }
  function rewardCard(instance,catalog) { return card(instance,catalog).replace(' — ','\n'); }
  function rewardTreasure(id,catalog) {
    var t=catalog.treasures[id];
    return t.kind==='card'?rewardCard({cardId:t.cardId,upgraded:false},catalog):'['+(t.tier==='high'?'💫':'✨')+'] '+t.name+'\n'+(t.text||effects(t.effects));
  }
  function rewardMenu(r,catalog) {
    var p=r.pending,title,lines=[],labels;
    if(['bundles','camp','forge','event','tavern','shopUpgrade','shopRemove'].indexOf(p.kind)>=0){
      var headings={bundles:'직업 카드 묶음 선택',camp:'휴식 또는 제련',forge:'제련',event:'이벤트',tavern:'선술집',shopUpgrade:'강화권',shopRemove:'카드 제거'};
      lines.push('⚔️ '+headings[p.kind]+' ⚔️','❤️ '+(r.hp===undefined?60:r.hp)+'/60 · 🪙 '+(r.gold||0)+'골드');
      if(p.kind==='bundles'&&r.lastBattleGold)lines.push('전투 골드 +'+r.lastBattleGold.total+' (기본 '+r.lastBattleGold.base+' + 체력 보너스 '+r.lastBattleGold.bonus+')');
      if(p.kind==='event')lines.push('이벤트는 준비 중입니다. 다음 단계로 진행합니다.');
      p.options.forEach(function(x,i){var text;
        if(p.kind==='bundles')text=x.map(function(id){return rewardCard({cardId:id,upgraded:false},catalog);}).join('\n');
        else if(p.kind==='camp')text=x==='rest'?'휴식: 체력 10 회복':'제련: 강화 가능한 카드 최대 3장 중 하나 강화';
        else if(p.kind==='event')text='계속';
        else if(p.kind==='tavern'){
          if(x.leave)text='선술집 나가기 · 이자 +'+Math.min(5,Math.floor((r.gold||0)/10))+'골드';
          else {var item=x.item;text=item.kind==='card'?rewardCard({cardId:item.cardId,upgraded:false},catalog):item.kind==='remove'?'덱에서 카드 1장 제거':item.kind==='potion'?'체력 회복 물약: 체력 '+item.amount+' 회복':'강화권: 최대 3장 중 하나 강화';text+=(item.sold?' [구매 완료]':' · '+item.price+'골드');}
        }else{text=rewardCard(deckCard(r,x),catalog);if(p.kind!=='shopRemove'){var upgraded=A4.copy(deckCard(r,x));upgraded.upgraded=true;text+='\n→ '+rewardCard(upgraded,catalog);}}
        lines.push('',(i+1)+'. '+text);
      });return lines.join('\n');
    }
    if(p.kind==='add')title='카드 추가 ['+(2-(r.queue||[]).filter(function(x){return x==='add';}).length)+'/2]';
    else if(p.kind==='treasure')title=(catalog.treasures[p.options[0]].tier==='high'?'상급':'하급')+' 보물 획득 [1/1]';
    else title={upgrade:'카드 강화 [1/1]',remove:'카드 제거',offerRemove:'카드 제거',swap:'보물 교체',swapTarget:'보물 교체',finalEdit:'덱 수정'}[p.kind];
    lines.push('⚔️ '+title+' ⚔️');
    labels={offerRemove:['제거한다','제거하지 않는다'],swap:['하급 보물을 무작위 상급 보물로 교체','상급 보물을 발견하여 기존 상급 보물 교체','교체하지 않는다'],finalEdit:['내 덱에서 카드 2장을 제거하고 2장을 추가','내 덱에서 카드 2장을 제거','내 덱에 카드 2장을 추가']};
    p.options.forEach(function(x,i){
      var text,before,after;
      if(labels[p.kind])text=labels[p.kind][i];
      else if(p.kind==='add')text=rewardCard({cardId:x,upgraded:false},catalog);
      else if(p.kind==='treasure')text=rewardTreasure(x,catalog);
      else if(p.kind==='swapTarget')text=rewardTreasure(r.treasures[x],catalog);
      else if(p.kind==='remove')text=rewardCard(deckCard(r,x),catalog);
      else if(p.kind==='upgrade'){
        before=deckCard(r,x);after=A4.copy(before);after.upgraded=true;
        text=rewardCard(before,catalog)+'\n→ '+rewardCard(after,catalog);
        if(i)lines.push('');
      }
      lines.push((i+1)+'. '+text);
    });
    return lines.join('\n');
  }
  function sortedDeck(cards,catalog){
    var order=['FIRE','NATURE','LIGHTNING','ICE','HOLY','NEUTRAL','COSMIC','CURSE'];
    return cards.map(function(x,i){return {card:x,index:i,def:A4.Battle.describeCard(x,catalog)};}).sort(function(a,b){return a.def.cost-b.def.cost||order.indexOf(a.def.element)-order.indexOf(b.def.element)||(a.def.treasure?1:0)-(b.def.treasure?1:0)||a.index-b.index;}).map(function(x){return x.card;});
  }
  function deckLines(cards,catalog){
    var groups={},rows=[];
    sortedDeck(cards,catalog).forEach(function(x){
      var text=card(x,catalog,null,true),key=x.cardId+'|'+text;
      if(!A4.has(groups,key)){groups[key]={text:text,count:0};rows.push(groups[key]);}
      groups[key].count++;
    });
    return rows.map(function(row){return 'x'+row.count+' '+row.text;});
  }
  function heroDeck(catalog,query){
    var needle=String(query||'').replace(/\s/g,'').toLowerCase(),all=catalog.heroes.map(function(h){return {name:h.name,hero:h};});
    if(A4.content&&A4.content.opponentDecks)A4.content.opponentDecks.enemies.forEach(function(e){if(catalog.enemies[e.id])all.push({name:e.name,enemy:e});});
    if(needle==='아우솔')needle='아우렐리온솔';
    var exact=all.filter(function(h){return h.name.replace(/\s/g,'').toLowerCase()===needle;});
    var found=exact.length?exact:all.filter(function(h){return h.name.replace(/\s/g,'').toLowerCase().indexOf(needle)>=0;});
    A4.assert(found.length,'일치하는 영웅이나 상대가 없습니다.');
    return found.map(function(entry){
      var h=entry.hero,e=entry.enemy,power=h?h.power:catalog.enemies[e.id].heroPower,cards=[];
      var heading='⚔️ '+(h?'영웅':'상대')+' - '+entry.name+' ⚔️\n[🛟] '+power.name+' | '+(power.kind==='passive'?'⏳️지속':'💧'+power.cost)+'\n'+power.text+'\n\n';
      if(h&&h.startingTreasureId&&catalog.startingTreasures)heading+='[🎖️] '+catalog.startingTreasures[h.startingTreasureId].name+'\n'+catalog.startingTreasures[h.startingTreasureId].text+'\n\n';
      if(h&&h.enabled===false)heading+='준비 중: '+h.incompleteReason+'\n\n';
      if(h)cards=h.cards.map(function(id){return {cardId:id,upgraded:false};});
      else if(e.deckMode==='mirror')return heading+'플레이어의 탐험 덱과 보물을 복제합니다.';
      else (e.cards||[]).forEach(function(x){var ref=x.cardId?A4.Opponents.referenceById(x.cardId):A4.Opponents.reference(x.name);for(var i=0;i<x.count;i++)cards.push({cardId:ref.id,upgraded:!!x.upgraded});});
      var text=heading+deckLines(cards,catalog).join('\n');
      if(e&&e.deckMode==='random')text+='\n\n'+(e.randomPoolElements||[]).map(function(x){return {FIRE:'화염',NATURE:'자연',LIGHTNING:'전기',ICE:'냉기',HOLY:'신성'}[x]||x;}).join('·')+' 일반 카드 무작위 '+e.randomCount+'장';
      return text;
    }).join('\n\n');
  }
  function deck(run,catalog){
    var lines=['⚔️ 탐험 덱 ⚔️'];
    lines=lines.concat(deckLines(run.deck,catalog));
    if(run.hero&&run.hero.startingTreasureId&&catalog.startingTreasures){var startTreasure=catalog.startingTreasures[run.hero.startingTreasureId];lines.push('','[🎖️] '+startTreasure.name+' — '+startTreasure.text);}
    var passives=Object.keys(run.treasures).map(function(k){return catalog.treasures[run.treasures[k]];}).filter(function(t){return t.kind==='passive';});
    if(passives.length){lines.push('','지속 효과형 보물');passives.forEach(function(t){lines.push('['+(t.tier==='high'?'💫':'✨')+'] '+t.name);});}
    return lines.join('\n');
  }
  function encyclopedia(catalog,query){
    var title='⚔️ 탐험 카드 도감 ⚔️',icons={FIRE:'🔥',ICE:'❄️',NATURE:'🍃',LIGHTNING:'⚡',HOLY:'🕊️',NEUTRAL:'🌊',COSMIC:'🌌',CURSE:'💔'};
    var names={FIRE:'화염',ICE:'냉기',NATURE:'자연',LIGHTNING:'전기',HOLY:'신성',NEUTRAL:'무속성',COSMIC:'우주'};
    function entry(id){var d=catalog.cards[id];return {id:id,name:d.name,cost:d.cost,element:d.element};}
    function compare(a,b){return a.cost-b.cost||(a.name<b.name?-1:a.name>b.name?1:0);}
    function normalize(text){return String(text||'').replace(/\s/g,'').toLowerCase();}
    function show(e){
      if(e.startingTreasure)return '[🎖️] '+e.name+'\n'+e.startingTreasure.text;
      if(e.power)return '[🛟] '+e.name+(e.power.kind==='active'?' | 💧'+e.cost:' | ⏳️지속')+'\n'+e.power.text;
      if(e.treasureId)return rewardTreasure(e.treasureId,catalog);
      var text=rewardCard({cardId:e.id,upgraded:false},catalog);
      if(catalog.cards[e.id].upgrade)text+='\n'+rewardCard({cardId:e.id,upgraded:true},catalog);
      return text;
    }
    var entries=catalog.cardPool.concat(Object.keys(catalog.cards).filter(function(id){return catalog.cards[id].classCard;})).map(entry),needle=normalize(query),lines=[title];
    if(needle){
      Object.keys(catalog.cards).forEach(function(id){var d=catalog.cards[id];if((d.token||d.exclusive)&&!d.classCard&&catalog.cardPool.indexOf(id)<0)entries.push(entry(id));});
      Object.keys(catalog.treasures).forEach(function(id){var t=catalog.treasures[id];if(t.retired)return;var d=t.cardId&&catalog.cards[t.cardId];entries.push({treasureId:id,name:t.name,cost:d?d.cost:0});});
      Object.keys(catalog.startingTreasures||{}).forEach(function(id){var t=catalog.startingTreasures[id];entries.push({startingTreasure:t,name:t.name,cost:0});});
      var seenPowers={};
      function addPower(power){
        if(!power)return;
        var key=JSON.stringify([power.name,power.kind,power.cost,power.text]);
        if(seenPowers[key])return;seenPowers[key]=true;
        entries.push({power:power,name:power.name,cost:power.cost||0});
      }
      (catalog.heroes||[]).forEach(function(hero){addPower(hero.power);});
      Object.keys(catalog.enemies||{}).forEach(function(id){addPower(catalog.enemies[id].heroPower);});
      if(A4.BossRules)addPower(A4.BossRules.power('white_night'));
      var exact=entries.filter(function(e){return normalize(e.name)===needle||catalog.cards[e.id]&&catalog.cards[e.id].upgrade&&normalize(e.name+'+')===needle;});
      var matches=exact.length?exact:entries.filter(function(e){return normalize(e.name).indexOf(needle)>=0;});
      if(!matches.length)return title+'\n검색 결과가 없습니다.';
      return title+'\n'+matches.sort(compare).map(show).join('\n\n');
    }
    lines.push(new Array(1001).join('\u200b'),'','• ❄️ → 🔥 → 🍃 → ⚡️ → ❄️');
    ['FIRE','ICE','NATURE','LIGHTNING','HOLY','NEUTRAL','COSMIC','CURSE'].forEach(function(element){
      var group=entries.filter(function(e){return e.element===element;}).sort(compare);
      if(group.length)lines.push('',icons[element]+' '+names[element]+' 속성 카드 목록','',group.map(show).join('\n\n'));
    });
    return lines.join('\n');
  }
  function run(user,catalog) {
    var r = user.run, lines = [], p, b, view, i, option, before, after, mana;
    if (!r) return user.lastRun ? '최근 탐험: '+user.lastRun.wins+'승\n받은 보상: '+reward(user.lastRun.reward)+'\n+탐험으로 새 탐험을 시작하세요.' : '+탐험으로 시작하세요.';
    if (r.phase === 'READY') return '⚔️ '+r.wins+'/8 처치 · 덱 구성 완료 ⚔️\n진행이 저장되었습니다. +탐험으로 계속하세요.';
    if (r.phase === 'ENCOUNTER') {
      var enemy=r.enemySpec,ability=A4.BossRules.power(enemy.enemyId);
      return '⚔️ 탐험 '+(r.wins+1)+'/8 ⚔️\n'+enemy.name+' ❤️ '+enemy.maxHp+'\n[🛟] '+ability.name+(ability.kind==='active'?' | 💧'+ability.cost:' | ⏳️지속')+'\n'+ability.text+'\ny / n';
    }
    if (r.phase === 'BATTLE') {
      if(r.battle.rulesVersion===3){
        if(r.battle.pendingChoice)return A4.BattleUI.controls(r.battle,catalog);
        return A4.BattleUI.summary(r.battle,r.wins+1,catalog)+separator+A4.BattleUI.controls(r.battle,catalog);
      }
      b = r.battle; view = A4.Combat.publicView(b);
      lines.push('⚔️ 탐험 '+(r.wins+1)+'/8 · '+b.turn+'턴 · '+({MAIN1:'메인 1',MAIN2:'메인 2',STANDBY:'스탠바이',END:'엔드'}[b.phase]));
      lines.push('영웅: '+r.hero.name);
      lines.push('■ '+b.player.name+' — ❤️ '+b.player.hp+'/'+b.player.maxHp+' / 보호막 '+b.player.shield);
      mana = ''; for (i=0;i<b.player.maxMana;i++) mana += i < b.player.mana ? '🔵' : '⚪';
      lines.push('마나: '+mana+' ('+b.player.mana+'/'+b.player.maxMana+')');
      if(b.player.mana>b.player.maxMana)lines.push('일시적 마나: +'+(b.player.mana-b.player.maxMana));
      var power=b.player.heroPower;
      if(power) lines.push('[🛟] '+power.name+' · '+(power.kind==='active'?'💧'+(b.rulesVersion===3?A4.Battle.powerCost(b,'player',catalog):power.cost)+' · '+(b.player.heroPowerUsedTurn===b.turn?'이번 턴 사용 완료':b.player.heroPowerReadyTurn>b.turn?'재사용 '+(b.player.heroPowerReadyTurn-b.turn)+'턴 후':'사용 가능'):'지속형')+' — '+power.text);
      lines.push('■ '+b.enemy.name+' — ❤️ '+b.enemy.hp+'/'+b.enemy.maxHp+' / 보호막 '+b.enemy.shield);
      lines.push('상대 손패 '+b.enemy.hand.length+'장 · 마나 '+b.enemy.mana+'/'+b.enemy.maxMana);
      if(b.enemy.heroPower)lines.push('상대 능력: '+b.enemy.heroPower.name+' — '+b.enemy.heroPower.text);
      if(b.rulesVersion===3){
        ['player','enemy'].forEach(function(side){var f=b[side];if(f.status.warnings)lines.push(f.name+' 경고 '+f.status.warnings+'/3');if(f.status.salvation)lines.push(f.name+' 구원의 길 '+Math.max(0,f.status.salvation.remaining)+'턴 남음');});
      }
      if(view.foreseenCards) lines.push('👁 상대의 예정 카드: '+(view.foreseenCards.map(function(c){return card(c,catalog);}).join(', ') || '카드 사용 없음'));
      if(view.enemyReacting) lines.push('👁 상대가 예지 중입니다.');
      if(b.pendingChoice) {
        lines.push(b.pendingChoice.label||'덱 맨 밑에서 맨 위로 올릴 카드를 선택하세요.');
        b.pendingChoice.options.forEach(function(c,index){lines.push((index+1)+'. '+(c.cardId?card(c,catalog):c.name||c.label||c.text||String(c)));});
        lines.push('번호 하나를 입력하세요.'); return lines.join('\n');
      }
      lines.push('');
      lines.push('🃏 손패 '+b.player.hand.length+'/'+(b.rulesVersion===3?A4.Battle.handLimit(b,'player',catalog):A4.HAND_LIMIT)+' · 덱 '+b.player.deck.length+' · 레스트 '+b.player.rest.length+' · 제외 '+b.player.excluded.length);
      for (i=0;i<b.player.hand.length;i++) lines.push((i+1)+'. '+card(b.player.hand[i],catalog,b));
      lines.push('');
      lines.push('일괄 사용: +제출 '+r.turnToken+' [카드 번호들]');
      if(power && power.kind==='active') lines.push('영웅 능력 함께 사용: +제출 '+r.turnToken+' 영웅 [카드 번호들]\n영웅 능력만 사용: +제출 '+r.turnToken+' 영웅');
      lines.push('이번 페이즈 쉬기: +제출 '+r.turnToken+' s');
      lines.push('탐험 포기: gg');
      return lines.join('\n');
    }
    if(r.phase==='REWARD')return rewardMenu(r,catalog);
    p = r.pending; lines.push(r.phase === 'HERO' ? '⚔️ 탐험 - 영웅 선택 ⚔️' : '🎁 '+r.wins+'/8 처치 보상');
    var labels = {add:'덱에 추가할 카드',upgrade:'강화할 카드',remove:'덱에서 제거할 카드',treasure:'보물',offerRemove:'카드 제거 여부',swap:'보물 교체',swapTarget:'교체할 기존 보물',finalEdit:'마지막 덱 구성'};
    if (labels[p.kind]) lines.push(labels[p.kind]);
    for (i=0;i<p.options.length;i++) {
      option = p.options[i];
      if (p.kind === 'hero') {
        var hero = catalog.heroes.filter(function (s) { return s.id === option; })[0];
        option = hero.name+(hero.enabled===false?' (준비 중: '+hero.incompleteReason+')':'')+'\n [🛟] '+hero.power.name+(hero.power.kind==='active'?' | 💧'+hero.power.cost:' | ⏳️지속')+'\n'+hero.power.text+(hero.startingTreasureId&&catalog.startingTreasures?'\n[🎖️] '+catalog.startingTreasures[hero.startingTreasureId].name+'\n'+catalog.startingTreasures[hero.startingTreasureId].text:'');
        if(i>0)lines.push('');
      } else if (p.kind === 'add') option = card({cardId:option,upgraded:false},catalog);
      else if (p.kind === 'treasure') option = treasure(option,catalog);
      else if (p.kind === 'swapTarget') option=treasure(r.treasures[option],catalog);
      else if (p.kind === 'upgrade') {
        before = deckCard(r,option); after = A4.copy(before); after.upgraded = true;
        option = card(before,catalog)+'\n   → '+card(after,catalog);
      } else if (p.kind === 'remove') option = card(deckCard(r,option),catalog);
      lines.push((i+1)+'. '+option);
    }
    if(r.phase!=='HERO')lines.push('번호 하나를 입력하세요.');
    return lines.join('\n');
  }
  function relics(user,catalog) {
    if(catalog.config.relicsEnabled===false)return '🔮 유물 시스템은 준비 중입니다. 강화석과 정수는 인벤토리에 보관됩니다.';
    var lines = ['🔮 유물 · 장착 슬롯 '+user.slotCount+'/3'], i, r, def, slot, next;
    for (i=0;i<user.slotCount;i++) { r = user.equipped[i] ? A4.Economy.findRelic(user,user.equipped[i]) : null; lines.push('슬롯 '+(i+1)+': '+(r ? catalog.relics[r.relicId].name+' +'+r.level : '비어 있음')); }
    if (!user.relics.length) lines.push('보유 유물이 없습니다.');
    user.relics.forEach(function (owned) { def = catalog.relics[owned.relicId]; lines.push(owned.uid+' · ['+def.grade+'] '+def.name+' +'+owned.level+' — '+effects(def.levels[owned.level].effects)); });
    next = catalog.slotCosts[user.slotCount+1];
    if (user.slotCount < 3) lines.push('다음 슬롯: '+(next ? next.gold+'C + 강화석 '+next.stones+'개' : '확장 비용 미정'));
    lines.push('장착: +유물 장착 [유물 ID] [슬롯 번호]\n해제: +유물 해제 [슬롯 번호]\n확장: +슬롯확장\n강화: +강화 [유물 ID]');
    return lines.join('\n');
  }
  function rules(){
    return "⚔️ 탐험 규칙 ⚔️\n"+new Array(1001).join("\u200b")+"\n\n"+"+탐험: 탐험을 새로 시작하거나 진행 중인 탐험을 계속합니다.\n\n가. 카드의 구역\n카드는 덱, 손패, 레스트, 제외 4개의 구역에 놓일 수 있습니다.\n\n1. 덱\n덱에 있는 카드는 스탠바이 페이즈나 카드를 뽑는 효과에 의해 손으로 들어올 수 있습니다.\n\n2. 손패\n손패에 있는 카드는 메인 페이즈 1, 2에 낼 수 있습니다. 카드를 내면 발동 여부와 관계없이 레스트로 이동합니다.\n\n3. 레스트\n사용된 카드와 일부 능력에 의해 레스트에 보관된 카드들은 덱에 뽑을 카드가 없으면 덱으로 모두 이동합니다.\n\n4. 제외\n게임에서 제외된 카드는 게임으로 돌아오지 않습니다.\n\n\n나. 턴의 구조\n\n게임이 시작되면 덱에서 무작위로 4장의 손패를 뽑습니다.\n양쪽 모두 현재 마나 2, 최대 마나 2로 시작합니다.\n턴은 다음과 같은 4개의 페이즈로 구분됩니다.\n\n1. 스탠바이 페이즈\n스탠바이 페이즈에는 각 플레이어가 카드를 1장씩 뽑습니다.\n이때 5턴마다의 스탠바이 페이즈에는 최대 마나가 1 증가하며,\n매 스탠바이 페이즈시에 마나가 모두 회복됩니다.\n\n20턴부터 스탠바이 페이즈시마다 각 플레이어는 탈진 피해를 받습니다. 탈진 피해는 1부터 시작하며 보호막을 무시하고 매 턴마다 1씩 증가합니다.\n\n2. 메인 페이즈 1\n메인 페이즈 1에는 카드를 낼 수 있습니다.\n\n3. 메인 페이즈 2\n메인 페이즈 2에는 카드를 낼 수 있습니다.\n\n4. 엔드 페이즈\n엔드 페이즈는 턴이 마무리되는 페이즈입니다. 손에 있는 일시적인 카드가 레스트로 이동하고, 엔드 페이즈시에 발동하는 효과들이 발동합니다. 엔드 페이즈가 끝날 때 양쪽의 방어도가 모두 사라집니다.\n\n\n다. 카드의 상성\n속성은 화염🔥, 자연🍃, 전기⚡️, 냉기❄️ , 신성🕊️ 5가지가 있습니다.\n기본 4속성은 ❄️ → 🔥 → 🍃 → ⚡️ → ❄️의 상성 관계를 가집니다.\n같은 페이즈시에 상대와 낸 카드가 상성 관계가 있으면 지는 상성의 카드들은 모두 카운터되어 효과가 발동하지 않고 레스트로 이동합니다.\n\n\n라. 키워드\n일부 카드들은 키워드를 가지고 있습니다. 각 키워드는 다음을 의미합니다.\n\n치명타: 이 카드가 상대의 카드를 카운터하면 추가 효과가 발동합니다.\n발견: 제시되는 3개의 선택지 중 하나를 선택합니다.\n압도: 이 카드는 같은 속성의 카드도 카운터합니다.\n불안정: 이 카드는 같은 속성의 카드에도 카운터당합니다.\n선천성: 이 카드는 시작하는 손패에 항상 있습니다.\n\n일시적: 이 카드는 엔드 페이즈시에 레스트로 이동합니다.\n일회용: 이 카드는 효과가 발동하면 레스트로 이동하는 대신 게임에서 제외됩니다. 카운터당하면 레스트로 이동합니다.\n과부하: 다음 턴에 획득하는 마나가 감소합니다.\n제한: 이 카드명의 카드는 1턴에 1번만 사용할 수 있습니다.\n사용불가: 이 카드는 사용할 수 없습니다.\n중독: 중독이 부여된 캐릭터는 매 스탠바이 페이즈시마다 중독만큼 피해를 받고, 중독이 1 감소합니다.\n무장해제: 이 캐릭터는 방어도를 획득할 수 없습니다.\n열화: 강화된 카드가 강화되기 전으로 되돌아갑니다.\n인양: 내 덱 맨 밑에 있는 카드 3장을 미리 봅니다. 1장을 선택해 덱 맨 위에 놓습니다.\n휘발성: 이 카드가 손에 있으면 엔드 페이즈시에 게임에서 제외됩니다.\n취약: 이 캐릭터는 피해를 받을 때 50%의 피해를 추가로 입습니다. 소수점은 버립니다.\n약화: 이 캐릭터는 가하는 피해량이 25% 감소합니다. 소수점은 버립니다.\n감전: 상대의 손에서 최대 마나 이하 비용인 사용 가능한 무작위 카드 n장을 다음 턴의 엔드 페이즈시까지 사용할 수 없게 만듭니다.\n침몰: 내 덱에 남은 카드가 0장이 된 적이 있으면, 추가 효과가 발동합니다.\n폐기: 내 덱 맨 아래에서 카드 X장을 레스트로 보냅니다.\n처형: 매 턴의 스탠바이 페이즈시에, 대상의 체력이 처형 중첩보다 낮으면 처형합니다. 처형되지 않으면 처형 중첩이 1 감소합니다.\n해방: 이 카드는 조건을 만족하기 전까지 사용할 수 없습니다. 손에 있는 동안 조건을 충족하면 해방되며 레스트로 이동하면 초기화됩니다.\n궤도: 이 카드가 손에 있을 때, 다른 카드를 일정 수만큼 사용했으면 추가 효과가 발동합니다.\n각성: 내 최대 마나가 5에 도달한 적이 있으면, 추가 효과가 발동합니다.\n\n\n마. 전투 후 진행\n전투가 끝나면 직업 카드 3장으로 된 묶음 3개 중 하나를 선택하여 덱에 추가합니다. 기본 골드 4~6을 얻으며, 체력이 낮으면 최대 5골드를 추가로 얻습니다.\n휴식은 체력을 10 회복합니다. 제련은 강화할 수 있는 카드 최대 3장 중 하나를 강화합니다.\n이벤트는 준비 중입니다.\n이후 선술집에서 직업 카드 3장, 공용 카드 2장과 카드 제거를 구매할 수 있습니다. 회복 물약과 강화권도 확률적으로 판매합니다.\n선술집을 나가면 보유한 10골드당 이자 1골드를 얻으며, 이자는 최대 5골드입니다.\n카드 가격은 3~6골드이며, 카드 제거 가격은 첫 전투 후 3골드부터 전투마다 2골드씩 올라갑니다.\n1승 하급 보물, 4승 상급 보물, 6승 보물 교체는 유지됩니다.\n\n저주 카드군 [💔]: 상성 상호작용이 없으며 사용불가, 일시적입니다.\n위력: 내 카드의 피해량과 회복량을 고정된 수치만큼 증가시킵니다.\n혈석: 최대 5개까지 보유하며 스탠바이 페이즈에 회복되지 않고 누적됩니다.\n단검: 최대 5개까지 보유하며 각 단검은 소모되면 피해를 4 줍니다.\n해오름: 메인 페이즈 1에 추가 효과가 발동합니다.\n어스름: 메인 페이즈 2에 추가 효과가 발동합니다.\n룬 [💎]: 발동하면 레스트로 가지 않고 효과가 유지됩니다. 캐릭터마다 1개만 유지하며 다른 룬이 발동하면 기존 룬을 레스트로 보내고 효과를 종료합니다. 새 룬이 카운터당하면 기존 룬을 유지합니다.";
  }
  function render(user,result,catalog,now) {
    var text, lines = [], def, rule;
    if (catalog.config.engineVersion!==3 && result.log && result.log.length) lines.push(result.log.join('\n'),'');
    if (result.kind === 'run') text = run(user,catalog);
    else if (result.kind === 'finished') text = ['⚔️ 탐험 - 결과 ⚔️'].concat((result.record.encounterResults||[]).map(function(x){return x.name+' '+(x.won?'✅️':'❌️');})).concat(['보상: '+reward(result.record.reward)]).join('\n');
    else if (result.kind === 'stats') text=A4.Stats.render(result.stats,catalog);
    else if (result.kind === 'rules') text=rules();
    else if (result.kind === 'encyclopedia') text=encyclopedia(catalog,result.query);
    else if (result.kind === 'inventory') {
      var keyIcons=[],inventoryLines=['📓 '+user.name+'의 인벤토리'],keyCount=user.items.keys;
      for(var k=0;k<5;k++)keyIcons.push(k<keyCount?'🔑':'✔️');
      var keyLine=keyIcons.join(' ');
      if(keyCount>5)keyLine+=' (+'+(keyCount-5)+')';
      else if(keyCount<5&&user.run)keyLine+=' [탐험 종료 후 충전]';
      else if(keyCount<5){
        var seconds=Math.max(0,Math.ceil((user.keyUpdatedAt+A4.Economy.keyInterval-now)/1000));
        var minutes=Math.floor(seconds/60),remainder=seconds%60;
        keyLine+=' ['+(minutes<10?'0':'')+minutes+':'+(remainder<10?'0':'')+remainder+']';
      }
      inventoryLines.push(keyLine,'코인: '+user.gold+'C');
      var itemNames={stones:'강화석',essence:'정수'},itemIndex=0;
      Object.keys(user.items).forEach(function(id){
        if(id!=='keys'&&user.items[id]>0)inventoryLines.push('['+(++itemIndex)+'] '+(itemNames[id]||id)+' x'+user.items[id]);
      });
      text=inventoryLines.join('\n');
    } else if (result.kind === 'relics') text = relics(user,catalog);
    else if (result.kind === 'deck') text = user.run ? deck(user.run,catalog) : '진행 중인 탐험이 없습니다.';
    else if (result.kind === 'heroDeck') text=heroDeck(catalog,result.query);
    else if (result.kind === 'shop') text = Object.keys(catalog.pulls).length ? '🛒 유물 뽑기\n'+Object.keys(catalog.pulls).map(function (id) { var p=catalog.pulls[id]; return id+' · '+p.name+' '+p.gold+'C\n'+p.grades.map(function(g){return g.value+' '+g.weight+'%';}).join(', '); }).join('\n')+'\n구매: +뽑기 [상품 ID]' : '상점 상품·가격·확률이 아직 정해지지 않았습니다.';
    else if (result.kind === 'enhancePreview') {
      rule = result.rule; def = catalog.relics[result.relic.relicId];
      text = '🔮 '+def.name+' +'+result.relic.level+' 강화\n비용: '+rule.gold+'C / 강화석 '+rule.stones+'개\n성공 '+rule.success+'% · 실패 '+rule.fail+'% · 하락 '+rule.down+'% · 파괴 '+rule.destroy+'%\n시도: +강화확인 '+result.token;
    } else if (result.kind === 'enhancement') text = '강화 결과: '+({success:'성공',fail:'실패',down:'하락',destroy:'파괴'}[result.result.outcome])+(result.result.level === null ? '' : ' · +'+result.result.level);
    else if (result.kind === 'pull') text = '획득: ['+catalog.relics[result.relic.relicId].grade+'] '+catalog.relics[result.relic.relicId].name+' ('+result.relic.uid+')';
    else if (result.kind === 'message') text = result.text;
    else text = '📓 도움말\n+탐험: 새 탐험을 시작하거나 진행 중인 탐험을 이어서 시작합니다.\n+덱: 보상 단계에서, 현재 내 덱을 봅니다.\n+인벤: 내 인벤토리를 봅니다.\n+도감 [카드명]: 전체 카드 또는 특정 카드 도감을 봅니다.\n+통계: 누적 카드·보물 선택률/평균 승수와 상대별 격파율을 봅니다.\n+규칙: 게임 규칙을 봅니다.\n+연동코드: 연동을 위한 코드를 받습니다.\n+연동 [코드]: 연동된 정보로 현재 내 정보를 덮어씌웁니다.';
    var prefix='';
    if(result.treasureChange){
      var treasureName=function(id){return rewardTreasure(id,catalog).split('\n')[0].split(' | ')[0];};
      prefix=treasureName(result.treasureChange.before)+' 카드가 '+treasureName(result.treasureChange.after)+' 카드로 변신합니다!'+separator;
    }
    lines.push(text); return prefix+(result.battleSummary?result.battleSummary+separator:'')+(result.victoryAnnouncement?result.victoryAnnouncement+separator:'')+lines.join('\n')+(result.extraMessages&&result.extraMessages.length?separator+result.extraMessages.join(separator):'');
  }
  return {render:render,card:card,effects:effects,messages:function(text){return String(text).split(separator);}};
}());

// ---- src/admin.js ----
 
A4.Admin = (function () {
  var MAX=9007199254740991;
  function audit(state,actor,target,command,item,amount,before,after,now){
    if(!state.adminHistory)state.adminHistory=[];
    state.adminHistory.push({id:A4.id(state,'admin-'),actorId:actor.id,targetId:target.id,command:command,item:item,amount:amount,before:before,after:after,at:now});
    if(state.adminHistory.length>256)state.adminHistory.shift();
  }
  function findTarget(state,nickname){
    var users=Object.keys(state.users).map(function(id){return state.users[id];}).filter(function(u){return !u.mergedInto;}),
      exact=users.filter(function(u){return u.name===nickname;}),
      found=exact.length?exact:users.filter(function(u){return u.name.indexOf(nickname)>=0;});
    A4.assert(found.length>0,'해당 닉네임의 유저가 없습니다. 먼저 +인벤 또는 +탐험을 입력해야 합니다.');
    if(found.length>1){
      var candidates=found.slice(0,20).map(function(u){return '• '+u.name;}).join('\n');
      A4.fail((exact.length?'동일한 닉네임의 유저가 여러 명입니다. 닉네임을 구분한 뒤 다시 시도하세요.':'일치하는 유저가 여러 명입니다. 닉네임을 더 길게 입력하세요.')+'\n'+candidates+(found.length>20?'\n외 '+(found.length-20)+'명':''));
    }
    return found[0];
  }
  function inventory(state,actor,args,now){
    A4.assert(actor&&actor.isAdmin===true,'관리자 권한이 필요합니다.');
    var nickname=String(args||'').trim();
    A4.assert(nickname,'사용법: ++인벤 [닉네임]');
    var target=findTarget(state,nickname),view={name:target.name,gold:target.gold,items:A4.copy(target.items),keyUpdatedAt:target.keyUpdatedAt,run:target.run?{}:null};
    A4.Economy.refreshKeys(view,now);
    return view;
  }
  function execute(state,user,action,now,catalog,room){
    if(action.command==='++관리자획득'){
      A4.assert(!action.args,'사용법: ++관리자획득');
      if(user.isAdmin===true)return {kind:'message',text:'이미 관리자 권한이 있습니다.'};
      user.isAdmin=true;audit(state,user,user,action.command,null,0,false,true,now);
      return {kind:'message',text:user.name+'님에게 관리자 권한을 부여했습니다.'};
    }
    A4.assert(user.isAdmin===true,'관리자 권한이 필요합니다.');
    if(action.command==='++재시작'){
      A4.assert(!action.args,'사용법: ++재시작');
      var target=null;
      Object.keys(state.users).some(function(id){var candidate=state.users[id];
        if(!candidate.mergedInto&&candidate.session&&candidate.session.room===room&&candidate.run){target=candidate;return true;}return false;
      });
      if(!target&&user.run&&['BATTLE','ENCOUNTER'].indexOf(user.run.phase)>=0&&(!user.session||user.session.room===room))target=user;
      A4.assert(target,'이 방에 재시작할 진행 중인 전투가 없습니다.');
      var before={phase:target.run.phase,enemyId:target.run.enemyId,maxHp:target.run.enemySpec&&target.run.enemySpec.maxHp};
      var restarted=A4.Game.restartEncounter(target,catalog,now,room);
      audit(state,user,target,action.command,'전투',0,before,{phase:target.run.phase,enemyId:target.run.enemyId,maxHp:target.run.enemySpec.maxHp},now);
      return {kind:'message',text:A4.UI.render(target,restarted,catalog,now)};
    }
    A4.assert(action.command==='++아이템지급'||action.command==='++아이템회수'||action.command==='++돈지급','알 수 없는 관리자 명령어입니다.');
    var money=action.command==='++돈지급',delta;
    if(money){
      var cash=/^(.+)\s+([+-]?\d+)$/.exec(action.args||'');
      A4.assert(cash,'사용법: ++돈지급 [닉네임] [금액]');
      delta=Number(cash[2]);
      A4.assert(isFinite(delta)&&Math.floor(delta)===delta&&Math.abs(delta)<=MAX,'금액은 안전한 정수로 입력하세요.');
    }
    var match=/^(.+)\s+(미궁\s+열쇠|미궁열쇠|강화석|정수|코인|C|c|골드|G|g)\s+(\S+)$/.exec(action.args||'');
    if(!match&&!money)match=/^(.+)\s+(\S+)\s+(\S+)$/.exec(action.args||'');
    if(money)match=[null,cash[1],'코인',String(Math.abs(delta))];
    A4.assert(match,'사용법: '+action.command+' [닉네임] [아이템명] [수량]\n아이템: 코인, 미궁 열쇠, 강화석, 정수');
    var nickname=match[1].trim(),item=match[2].replace(/\s/g,''),quantity=Number(match[3]);
    A4.assert(/^\d+$/.test(match[3])&&A4.integer(quantity,money?0:1)&&quantity<=MAX,'수량은 1 이상의 안전한 정수로 입력하세요.');
    var itemNames=['미궁열쇠','강화석','정수','코인'],itemMatches=itemNames.filter(function(name){return name===item;});
    if(['C','c','G','g','골드','골'].indexOf(item)>=0)item='코인';else {if(!itemMatches.length)itemMatches=itemNames.filter(function(name){return name.indexOf(item)>=0;});A4.assert(itemMatches.length===1,itemMatches.length?'일치하는 아이템이 여러 개입니다: '+itemMatches.join(', '):'일치하는 아이템이 없습니다. 아이템: 코인, 미궁 열쇠, 강화석, 정수');item=itemMatches[0];}
    var target=findTarget(state,nickname),key={미궁열쇠:'keys',강화석:'stones',정수:'essence',코인:'gold'}[item],gold=key==='gold',name={keys:'미궁 열쇠',stones:'강화석',essence:'정수',gold:'코인'}[key];
    A4.Economy.refreshKeys(target,now);
    var before=gold?target.gold:target.items[key],grant=money?delta>=0:action.command==='++아이템지급';
    A4.assert(grant?before<=MAX-quantity:before>=quantity,grant?'보유 수량의 안전한 정수 범위를 초과합니다.':'회수할 수량보다 보유 수량이 적습니다. 현재 '+before+(gold?'C':'개'));
    var after=before+(grant?quantity:-quantity);
    if(gold)target.gold=after;else target.items[key]=after;
    if(key==='keys'&&(before>=5||after>=5))target.keyUpdatedAt=Math.max(now,target.keyUpdatedAt);
    audit(state,user,target,action.command,name,money?delta:quantity,before,after,now);
    return {kind:'message',text:target.name+(grant?'님에게 ':'님에게서 ')+name+' '+quantity+(gold?'C':'개')+(grant?' 지급 완료':' 회수 완료')+'\n현재 보유: '+after+(gold?'C':'개')};
  }
  return {execute:execute,inventory:inventory};
}());

// ---- src/link.js ----
A4.Link = (function () {
  function execute(state,user,action,request){
    var key='identity:'+request.identity,now=request.now,entry,code,pending,source;
    if(!state.pendingLinks)state.pendingLinks={};
    if(action.type==='linkCode'){
      var start=Math.floor(A4.random(state)()*9000);
      for(var i=0;i<9000;i++){code=String(1000+(start+i)%9000);if(!state.linkCodes[code])break;}
      A4.assert(i<9000,'사용 가능한 연동 코드가 없습니다. 잠시 후 다시 시도하세요.');
      state.linkCodes[code]={id:A4.id(state,'link-'),owner:user.id,room:request.room,expiresAt:now+300000};
      return {user:user,text:'연동 코드: '+code+' (5분간 유효)\n다른 방에서 +연동 '+code+' 를 입력하세요.'};
    }
    if(action.type==='linkRequest'){
      entry=state.linkCodes[action.code];source=entry&&state.users[entry.owner];
      A4.assert(/^\d{4}$/.test(action.code||'')&&entry&&entry.id&&entry.expiresAt>now&&source&&!source.mergedInto,'유효하지 않거나 만료된 연동 코드입니다.');
      A4.assert(entry.room!==request.room,'코드를 발급받은 방과 다른 방에서 입력하세요.');
      state.pendingLinks[key]={code:action.code,issuance:entry.id,owner:source.id,previousUser:user.id,room:request.room,expiresAt:entry.expiresAt};
      return {user:user,text:source.name+'의 데이터로 덮어씌울까요? (y/n)'};
    }
    pending=state.pendingLinks[key];
    A4.assert(pending&&pending.room===request.room,'확인할 연동 요청이 없습니다.');
    delete state.pendingLinks[key];
    if(!action.accept)return {user:user,text:'연동을 취소했습니다.'};
    entry=state.linkCodes[pending.code];source=state.users[pending.owner];
    if(pending.expiresAt<=now||!entry||entry.id!==pending.issuance||entry.owner!==pending.owner||!source||source.mergedInto||user.id!==pending.previousUser)return {user:user,text:'연동 요청이 만료되었거나 변경되었습니다. 새 코드를 발급받아 다시 시도하세요.'};
    if(user.id!==source.id){
      Object.keys(state.identities).forEach(function(id){if(state.identities[id]===user.id)state.identities[id]=source.id;});
       
      user.mergedInto=source.id;user.session=null;
      if(user.run&&user.run.battle)user.run.battle.mainDeadline=null;
      Object.keys(state.linkCodes).forEach(function(k){if(state.linkCodes[k].owner===user.id)delete state.linkCodes[k];});
      Object.keys(state.pendingLinks).forEach(function(k){if(state.pendingLinks[k].owner===user.id||state.pendingLinks[k].previousUser===user.id)delete state.pendingLinks[k];});
    }
    delete state.linkCodes[pending.code];
    return {user:source,text:source.name+'의 데이터로 연동했습니다.'};
  }
  return {execute:execute};
}());

// ---- src/app.js ----
A4.App = (function () {
  var aliases={};
  function initials(text){return text.replace(/[가-힣]/g,function(x){return 'ㄱㄲㄴㄷㄸㄹㅁㅂㅃㅅㅆㅇㅈㅉㅊㅋㅌㅍㅎ'.charAt(Math.floor((x.charCodeAt(0)-44032)/588));});}
  ['+통계','+규칙','+도감','+탐험','+선택','+제출','+인벤','+덱','+도움말','+상점','+뽑기','+강화','+강화확인','+슬롯확장','+유물','+연동코드','+연동','+연동승인','++관리자획득','++재시작','++인벤','++아이템지급','++아이템회수','++돈지급'].forEach(function(x){aliases[initials(x)]=x;});
  function command(text){return aliases[text]||text;}
  function parse(text) {
    if (/^[yn]$/i.test(String(text || '').trim())) return {type:'encounterResponse',accept:String(text).trim().toLowerCase()==='y'};
    if (/^\d+(?:\s+\d+)*$/.test(String(text || '').trim())) return {type:'numbers',indices:String(text).trim().split(/\s+/).map(Number)};
    if (String(text || '').trim().toLowerCase() === 's') return {type:'numbers',indices:[],pass:true};
    if (String(text || '').trim().toLowerCase() === 'p') return {type:'pauseBattle'};
    var p = String(text || '').trim().split(/\s+/), rawCommand = p.shift(), cmd = command(rawCommand);
    if(cmd.indexOf('++')===0)return {type:'admin',command:cmd,args:String(text).trim().slice(rawCommand.length).trim()};
    if (cmd === 'gg') return {type:'forfeit'};
    if (cmd === '+탐험') return {type:'explore'};
    if (cmd === '+선택') return {type:'choose',token:p[0],index:Number(p[1])};
    if (cmd === '+제출') {
      A4.assert(p.length >= 2,'제출할 카드 번호, 영웅 또는 s를 입력하세요.');
      var args=p.slice(1).map(function(x){return x==='ㅇㅇ'?'영웅':x==='S'?'s':x;}), powers=args.filter(function(x){return x==='영웅';}), numbers=args.filter(function(x){return x!=='영웅';});
      A4.assert(powers.length<=1,'영웅 능력은 한 번만 제출할 수 있습니다.');
      A4.assert(numbers.indexOf('s')<0 || numbers.length===1,'s와 카드 번호를 함께 제출할 수 없습니다.');
      return {type:'submit',token:p[0],heroPower:powers.length===1,indices:numbers.length===1 && numbers[0]==='s'?[]:numbers.map(Number)};
    }
    if (cmd === '+인벤' || cmd === '+ㅇㅂ') return {type:'inventory'};
    if (cmd === '+통계') return {type:'stats'};
    if (cmd === '+규칙') return {type:'rules'};
    if (cmd === '+도감') return {type:'encyclopedia',query:p.join(' ')};
    if (cmd === '+덱') return p.length?{type:'heroDeck',query:p.join(' ')}:{type:'deck'};
    if (cmd === '+도움말') return {type:'help'};
    if (cmd === '+상점') return {type:'shop'};
    if (cmd === '+뽑기') return {type:'pull',id:p[0]};
    if (cmd === '+강화') return {type:'enhancePreview',uid:p[0]};
    if (cmd === '+강화확인') return {type:'enhanceConfirm',token:p[0]};
    if (cmd === '+슬롯확장') return {type:'expand'};
    if (cmd === '+유물') {
      if (p[0] === '장착' || p[0] === 'ㅈㅊ') return {type:'equip',uid:p[1],slot:Number(p[2])};
      if (p[0] === '해제' || p[0] === 'ㅎㅈ') return {type:'unequip',slot:Number(p[1])};
      return {type:'relics'};
    }
    if (cmd === '+연동코드') return {type:'linkCode'};
    if (cmd === '+연동') return {type:'linkRequest',code:p[0]};
    if (cmd === '+연동승인') return {type:'oldLinkApprove'};
    return null;
  }
  function isCardSearch(request){
    if(request.action)return request.action.type==='encyclopedia'&&!!String(request.action.query||'').trim();
    var parts=String(request.text||'').trim().split(/\s+/);
    return command(parts.shift())==='+도감'&&!!parts.join(' ').trim();
  }
  function timeoutText(b){
    if(b.pendingChoice&&b.pendingChoice.lamp)return '2분이 지나 무작위 카드를 받았습니다.';
    return b.pendingChoice?'2분 30초가 지나 선택지 중 하나를 무작위로 선택했습니다.':(b.mainTimeoutMs?String(b.mainTimeoutMs/1000)+'초':'2분 30초')+'가 지나 해당 페이즈를 쉬었습니다.';
  }
  function saveReceipt(user,id,text){
    user.receipts.push({id:id,text:text});
    if(user.receipts.length>256)user.receipts.shift();
    var budget=65536;
    for(var i=user.receipts.length-1;i>=0;i--){
      var r=user.receipts[i];
      if(i<user.receipts.length-8&&r.text.length>budget)r.text='이미 처리된 입력입니다. +탐험 또는 조회 명령으로 현재 상태를 확인하세요.';
      budget=Math.max(0,budget-r.text.length);
    }
  }
  function create(store,catalog) {
    A4.validateState(store.getState());
    if(A4.TreasureRules.removeRetired&&store.select(function(state){return A4.TreasureRules.removeRetired(state,catalog,false);}))store.transact('remove-retired-treasures',function(state){A4.TreasureRules.removeRetired(state,catalog,true);A4.validateState(state);},{resultOnly:true});
    function roomBlocked(state,request){
      var uid=state.identities['identity:'+request.identity],actor=uid?state.users[uid]:null,owner=null;
      Object.keys(state.users).some(function(id){var u=state.users[id];if(u.run&&u.session&&u.session.room===request.room&&(u.session.until>request.now||(u.run.phase==='BATTLE'&&u.run.battle.mainDeadline))){owner=u;return true;}return false;});
      if(!owner||owner.id===uid)return false;
      if(isCardSearch(request))return false;
      if(!actor||actor.isAdmin!==true)return true;
      var linking=state.pendingLinks&&state.pendingLinks['identity:'+request.identity],confirming=linking&&linking.room===request.room;
      var type=request.action&&request.action.type,text=String(request.text||'').trim(),cmd=command(text.split(/\s+/)[0].toLowerCase());
      if(confirming&&(type==='linkConfirm'||type==='encounterResponse'||/^[yn]$/i.test(text)))return false;
      return ['explore','choose','submit','numbers','encounterResponse','forfeit','timeout','pauseBattle'].indexOf(type)>=0||['+도감','+탐험','+선택','+제출','gg','s','p','y','n'].indexOf(cmd)>=0||/^\d+(?:\s+\d+)*$/.test(text);
    }
    function handle(request) {
       
       
      if(store.select(function(state){return roomBlocked(state,request);}))return null;
      var lampActive=store.select(function(state){var u=state.users[state.identities['identity:'+request.identity]];return !!(u&&u.session&&u.session.room===request.room&&u.run&&u.run.phase==='BATTLE'&&u.run.battle.pendingChoice&&u.run.battle.pendingChoice.lamp);});
      var raw=String(request.text||'').trim();
      var action = request.action || (lampActive&&(/^\+[^+]/.test(raw)||/^n$/i.test(raw))?{type:'lampSearch',query:/^n$/i.test(raw)?null:raw.slice(1)}:parse(request.text));
      if (!action) return null;
      var linkPending=store.select(function(state){return state.pendingLinks&&state.pendingLinks['identity:'+request.identity]||null;});
      if(action.type==='encounterResponse'&&linkPending&&linkPending.room===request.room)action={type:'linkConfirm',accept:action.accept};
      A4.assert(request.identity && String(request.identity).trim(),'안정적인 유저 식별값을 얻지 못했습니다. 닉네임만으로 계정을 합치지 않습니다.');
      A4.assert(A4.integer(request.now,0),'요청 시간이 올바르지 않습니다.');
      if(action.type==='stats')return A4.UI.render(null,{kind:'stats',stats:store.select(function(state){return state.stats||A4.Stats.empty();})},catalog,request.now);
      if(action.type==='heroDeck')return A4.UI.render(null,{kind:'heroDeck',query:action.query},catalog,request.now);
      if(action.type==='encyclopedia'&&String(action.query||'').trim())return A4.UI.render(null,{kind:'encyclopedia',query:action.query},catalog,request.now);
      if(action.type==='admin'&&action.command==='++인벤'){
        var targetInventory=store.select(function(state){
          var actor=state.users[state.identities['identity:'+request.identity]];
          return A4.Admin.inventory(state,actor,action.args,request.now);
        });
        return A4.UI.render(targetInventory,{kind:'inventory'},catalog,request.now);
      }
      var info=store.select(function(state){
        var uid=state.identities['identity:'+request.identity],u=uid?state.users[uid]:null;
        A4.assert(!uid||u,'계정 매핑의 사용자 데이터가 없습니다. 초기화하지 않고 중단합니다.');
        var receipt=null;
        if(u&&request.eventId)for(var i=u.receipts.length-1;i>=0;i--)if(u.receipts[i].id===request.eventId){receipt=u.receipts[i];break;}
        return {exists:!!u,receipt:receipt,session:u&&u.session||null,run:u&&u.run?{phase:u.run.phase}:null};
      });
      if(info.receipt)return info.receipt.text;
      var readOnly=['inventory','encyclopedia','deck','help','shop','relics','rules'].indexOf(action.type)>=0;
      if(readOnly&&info.exists){
        var view=store.select(function(state){
          var u=state.users[state.identities['identity:'+request.identity]],v={};
          ['id','name','gold','items','keyUpdatedAt','slotCount','equipped','relics'].forEach(function(k){v[k]=u[k];});
          v.run=u.run?(action.type==='deck'?{deck:u.run.deck,treasures:u.run.treasures}:{}):null;
          return v;
        });
        view.name=request.name||view.name;
         
        var savedKeys=view.items.keys;
        A4.Economy.refreshKeys(view,request.now);
        if(view.items.keys===savedKeys)return A4.UI.render(view,{kind:action.type,query:action.query||''},catalog,request.now);
      }
      if(action.type==='numbers'||action.type==='encounterResponse'||action.type==='pauseBattle'){
        var existing=info.exists?info:null;
        var replay=false;
        if(!replay&&(!existing||!existing.run||!existing.session||existing.session.room!==request.room))return null;
        if(!replay&&action.type==='encounterResponse'&&existing.run.phase!=='ENCOUNTER')return null;
      }
      return store.transact('command:'+action.type,function (state) {
        A4.validateState(state);
        if(roomBlocked(state,request))return null;
        var key = 'identity:'+request.identity, uid = state.identities[key], user = uid ? state.users[uid] : null, result, output, receipt, i, code, entry, relic, def, rule, pending;
        A4.assert(!uid || user,'계정 매핑의 사용자 데이터가 없습니다. 초기화하지 않고 중단합니다.');
        if (user && request.eventId) for (i=user.receipts.length-1;i>=0;i--) if (user.receipts[i].id === request.eventId) return user.receipts[i].text;
        if (action.type === 'numbers') {
           
          if (!user || !user.run || !user.session || user.session.room !== request.room) return null;
          A4.assert((user.run.phase==='BATTLE'&&user.run.battle.mainDeadline)||request.now < user.session.until,'⚔️ 세션 종료: +탐험으로 기존 탐험을 이어갑니다.');
          var run=user.run, choosing=run.pending || (run.battle && run.battle.pendingChoice);
          if(action.pass&&run.phase==='REWARD'){
            action={type:'pauseReward'};
          } else if (choosing) {
            A4.assert(!action.pass && action.indices.length===1,'선택할 번호 하나만 입력하세요.');
            action={type:'choose',token:run.pending?run.pending.id:run.turnToken,index:action.indices[0]};
          } else if (run.phase === 'BATTLE') {
            A4.assert(action.indices.filter(function(n){return n===0;}).length<=1,'영웅 능력은 한 번만 제출할 수 있습니다.');
            action={type:'submit',token:run.turnToken,heroPower:action.indices.indexOf(0)>=0,indices:action.indices.filter(function(n){return n!==0;})};
          } else return null;
        }
        Object.keys(state.linkCodes).forEach(function (k) { if (state.linkCodes[k].expiresAt <= request.now) delete state.linkCodes[k]; });
        if (!user) { user = A4.Game.newUser(state,request.name || '탐험가',request.now,catalog); state.users[user.id]=user; state.identities[key]=user.id; }
        user.name = request.name || user.name;
        if (user.session && request.now >= user.session.until && !(user.run&&user.run.phase==='BATTLE'&&user.run.battle.mainDeadline)) {user.session = null;if(user.run&&user.run.battle)user.run.battle.mainDeadline=null;}
        A4.Economy.refreshKeys(user,request.now);
        if(catalog.config.relicsEnabled===false&&['enhancePreview','enhanceConfirm'].indexOf(action.type)>=0)A4.fail('유물 시스템은 준비 중입니다.');
        var due=user.run&&user.run.battle;
        if(user.session&&due&&due.mainDeadline&&request.now>=due.mainDeadline&&['submit','choose','explore','lampSearch'].indexOf(action.type)>=0){
          var notice=due.pendingChoice&&!A4.Game.canPauseBattle(due)?timeoutText(due):null;
          result=A4.Game.act(state,user,{type:'timeout'},catalog,request.now,request.room);
          output=(notice?'⌛ '+notice+'\n':'')+A4.UI.render(user,result,catalog,request.now);
          if(request.eventId){saveReceipt(user,request.eventId,output);}
          A4.validateState(state);return output;
        }
        if (action.type === 'admin') result=A4.Admin.execute(state,user,action,request.now,catalog,request.room);
        else if (['linkCode','linkRequest','linkConfirm'].indexOf(action.type)>=0) {
          var linked=A4.Link.execute(state,user,action,request);user=linked.user;result={kind:'message',text:linked.text};
        } else if(action.type==='oldLinkApprove') {
          result={kind:'message',text:'다른 방에서 +연동 [코드] 입력 후 y로 확인하세요.'};
        } else if (action.type === 'enhancePreview') {
          relic=A4.Economy.findRelic(user,action.uid); def=catalog.relics[relic.relicId];
          A4.assert(relic.level < 5,'최대 강화는 +5입니다.');
          rule=def && catalog.enhancement[def.grade] && catalog.enhancement[def.grade][relic.level];
          A4.assert(rule,'이 강화 단계의 비용·확률이 아직 정해지지 않았습니다.');
          user.pendingEnhancement={id:A4.id(state,'enhance-'),uid:relic.uid,level:relic.level,rule:JSON.stringify(rule)};
          result={kind:'enhancePreview',relic:relic,rule:rule,token:user.pendingEnhancement.id};
        } else if (action.type === 'enhanceConfirm') {
          pending=user.pendingEnhancement;
          A4.assert(pending && pending.id === action.token,'이미 처리되었거나 오래된 강화 확인입니다.');
          relic=A4.Economy.findRelic(user,pending.uid); def=catalog.relics[relic.relicId]; rule=catalog.enhancement[def.grade][relic.level];
          A4.assert(pending.level === relic.level && pending.rule === JSON.stringify(rule),'강화 설정이 변경되었습니다. +강화 명령으로 다시 확인하세요.');
          result=A4.Game.act(state,user,{type:'enhance',uid:pending.uid},catalog,request.now,request.room); user.pendingEnhancement=null;
        } else result=A4.Game.act(state,user,action,catalog,request.now,request.room);
        output=A4.UI.render(user,result,catalog,request.now);
        if (request.eventId) { saveReceipt(user,request.eventId,output); }
        A4.validateState(state);
        return output;
      },{resultOnly:true}).result;
    }
    function tick(now){
      var ids=store.select(function(state){return Object.keys(state.users).filter(function(id){var u=state.users[id],b=u.run&&u.run.battle;return u.session&&(u.session.until<=now||(b&&b.mainDeadline&&b.mainDeadline<=now));});});
      if(!ids.length)return [];
      return store.transact('session-tick',function(state){
        var messages=[];
        ids.forEach(function(id){
          var u=state.users[id],room=u.session.room,result,b=u.run&&u.run.battle;
          if(b&&b.mainDeadline&&b.mainDeadline<=now){
            var notice=b.pendingChoice&&!A4.Game.canPauseBattle(b)?timeoutText(b):null;
            result=A4.Game.act(state,u,{type:'timeout'},catalog,now,room);
            messages.push({room:room,text:(notice?'⏳ '+u.name+' · '+notice+'\n':'')+A4.UI.render(u,result,catalog,now)});
          }else if(u.session.until<=now){u.session=null;if(b)b.mainDeadline=null;messages.push({room:room,text:'⚔️ 세션 종료: +탐험으로 기존 탐험을 이어갑니다.'});}
        });
        A4.validateState(state);return messages;
      },{resultOnly:true}).result;
    }
    function suspendSessions(){
      if(!store.select(function(state){return Object.keys(state.users).some(function(id){return !!state.users[id].session;});}))return;
      store.transact('restart-pause',function(state){Object.keys(state.users).forEach(function(id){var u=state.users[id];u.session=null;if(u.run&&u.run.battle)u.run.battle.mainDeadline=null;});A4.validateState(state);},{resultOnly:true});
    }
    return {handle:handle,tick:tick,suspendSessions:suspendSessions,close:function () { store.close(); }};
  }
  return {create:create,parse:parse};
}());

// ---- src/runtime.js ----
 
A4.Runtime = (function () {
  function identity(msg) {
    var author = msg && msg.author, value;
    if (author) {
      if (author.hash !== undefined && author.hash !== null) value = author.hash;
      else if (author.userHash !== undefined && author.userHash !== null) value = author.userHash;
      else if (author.id !== undefined && author.id !== null) value = author.id;
    }
    if (value === undefined && msg && msg.senderHash !== undefined) value = msg.senderHash;
    if (value === undefined && msg && msg.userHash !== undefined) value = msg.userHash;
    return value === undefined || value === null || String(value).trim() === '' ? null : String(value);
  }
  function startupLog(text) {
    try { if(typeof Log!=='undefined'&&typeof Log.i==='function')Log.i('악질봇4 초기화: '+text); }catch(ignore){}
  }
  function start(globalObject) {
    startupLog('기존 실행 종료 확인');
    if (globalObject.__AKJILBOT4_RUNTIME__) globalObject.__AKJILBOT4_RUNTIME__.shutdown();
    if (!A4.catalog.config.enabled) return null;
    var catalog = A4.catalog, rooms = catalog.config.rooms.live.concat(catalog.config.rooms.test), seen = {}, i;
    A4.assert(rooms.length === 3 && catalog.config.rooms.live.length === 2 && catalog.config.rooms.test.length === 1,'운영 방 2개와 테스트 방 1개를 설정해야 합니다.');
    for (i=0;i<rooms.length;i++) { A4.assert(typeof rooms[i] === 'string' && rooms[i].trim() && !seen['room:'+rooms[i]],'서로 다른 방 이름 3개가 필요합니다.'); seen['room:'+rooms[i]]=true; }
    startupLog('게임 설정 검증');
    var missing = A4.validateCatalog(catalog);
    A4.assert(!missing.length,'운영 시작 전 설정이 필요합니다: '+missing.join(', '));
    var bot = BotManager.getCurrentBot(), lock = new java.util.concurrent.locks.ReentrantLock(), alive=true;
     
     
    var delivered=globalObject.__AKJILBOT4_DELIVERED__||(globalObject.__AKJILBOT4_DELIVERED__={ids:{},order:[],messages:[]});
    function rememberDelivery(id,msg){
      if(id&&!delivered.ids[id]){delivered.ids[id]=true;delivered.order.push(id);if(delivered.order.length>1024)delete delivered.ids[delivered.order.shift()];}
      delivered.messages.push(msg);if(delivered.messages.length>64)delivered.messages.shift();
    }
    startupLog('저장 폴더 열기');
    var store = A4.Store.create(A4.Store.javaIO(catalog.config.dataPath),{latestSnapshotOnly:true}), app, shutdownEvent, timer=null;
    try { startupLog('최신 저장본 복구'); store.load(A4.newState(Date.now())); startupLog('유저 데이터 검증'); app=A4.App.create(store,catalog); startupLog('이전 세션 정리'); app.suspendSessions(); }
    catch (error) { store.close(); throw error; }
    function sendMessages(result,send) {
       
      var previous=null;
      A4.UI.messages(result).forEach(function(text,index){
        if(index>0)java.lang.Thread.sleep(previous.indexOf('⚔️ 탐험 - 승리! ⚔️\n')===0?2000:150);
        send(text);
        previous=text;
      });
    }
    function onMessage(msg) {
      if (!alive || rooms.indexOf(String(msg.room || '')) < 0) return;
      var content=String(msg.content || '').trim(), result, eventId=null, value;
      var receivedAt=Date.now(),lockedAt=receivedAt,handledAt=null,savingMs=0,timingStarted=false;
      [msg.logId,msg.messageId,msg.id].some(function(candidate){if(candidate!==undefined&&candidate!==null&&String(candidate).trim()){value=candidate;return true;}return false;});
      if (value !== undefined && value !== null && String(value)) eventId=JSON.stringify([String(msg.room),identity(msg),String(value)]);
      lock.lock();lockedAt=Date.now();
      try {
        if (!alive || (eventId&&delivered.ids[eventId]) || delivered.messages.indexOf(msg)>=0) return;
        store.resetTiming();timingStarted=true;
        result=app.handle({identity:identity(msg),name:msg.author && msg.author.name ? String(msg.author.name) : '탐험가',room:String(msg.room),now:Date.now(),eventId:eventId,text:content});
        handledAt=Date.now();
        if (result !== null) {sendMessages(result,function(text){msg.reply(text);});rememberDelivery(eventId,msg);}  
      } catch (error) {
        handledAt=Date.now();
        try {
          if (store.isBlocked()) msg.reply('저장을 확인할 수 없어 추가 진행을 중단했습니다. 데이터를 초기화하지 말고 봇을 재시작하여 마지막 기록을 복구하세요.');
          else msg.reply(String(error.message || error));
          rememberDelivery(eventId,msg);
        } catch(replyError) {   }
        try { if (typeof Log !== 'undefined') Log.e('악질봇4: '+String(error.message || error)); } catch(logError) {}
      } finally {
        if(timingStarted)savingMs=store.getTiming().savingMs;
        if(handledAt===null)handledAt=Date.now();
        var finishedAt=Date.now();lock.unlock();
        if(finishedAt-receivedAt>=1000){
          try{if(typeof Log!=='undefined'&&typeof Log.i==='function')Log.i('악질봇4 응답 시간: 대기 '+(lockedAt-receivedAt)+'ms / 처리 '+Math.max(0,handledAt-lockedAt-savingMs)+'ms / 저장 '+savingMs+'ms / 전송 '+Math.max(0,finishedAt-Math.max(handledAt,lockedAt))+'ms');}catch(ignored){}
        }
      }
    }
    function shutdown() {
       
      if(!lock.tryLock(3000,java.util.concurrent.TimeUnit.MILLISECONDS)){
        throw new Error('기존 봇 작업이 종료되지 않았습니다. 봇 앱을 강제 종료한 뒤 다시 실행하세요. 저장 데이터는 삭제하지 마세요.');
      }
      try {
        if (!alive) return; alive=false;
        if(timer!==null){clearInterval(timer);timer=null;}
        if (typeof bot.removeListener === 'function') {
          bot.removeListener(Event.MESSAGE,onMessage);
          if (shutdownEvent !== undefined) bot.removeListener(shutdownEvent,shutdown);
        }
        store.close();
      } finally { lock.unlock(); }
    }
    try {
      bot.addListener(Event.MESSAGE,onMessage);
      timer=setInterval(function(){
        lock.lock();
        var tickStarted=Date.now(),tickHandled=null,tickTiming=false;
        try{
          if(!alive||store.isBlocked())return;
          store.resetTiming();tickTiming=true;
          var messages=app.tick(Date.now());tickHandled=Date.now();
          messages.forEach(function(message){try{sendMessages(message.text,function(text){bot.send(message.room,text);});}catch(sendError){ }});
        }catch(error){try{if(typeof Log!=='undefined')Log.e('악질봇4 시간 처리: '+String(error.message||error));}catch(ignored){}}
        finally{
          var tickFinished=Date.now(),saved=tickTiming?store.getTiming().savingMs:0;lock.unlock();
          if(tickTiming&&tickFinished-tickStarted>=1000)try{if(typeof Log!=='undefined'&&typeof Log.i==='function')Log.i('악질봇4 타이머: 처리 '+Math.max(0,(tickHandled===null?tickFinished:tickHandled)-tickStarted-saved)+'ms / 저장 '+saved+'ms / 전송 '+(tickHandled===null?0:tickFinished-tickHandled)+'ms');}catch(ignore){}
        }
      },1000);
      if (Event.START_COMPILE !== undefined) { shutdownEvent=Event.START_COMPILE; bot.addListener(shutdownEvent,shutdown); }
      else if (Event.DESTROY !== undefined) { shutdownEvent=Event.DESTROY; bot.addListener(shutdownEvent,shutdown); }
    } catch (error) { shutdown(); throw error; }
    startupLog('준비 완료');
    globalObject.__AKJILBOT4_RUNTIME__={shutdown:shutdown,store:store};
    return globalObject.__AKJILBOT4_RUNTIME__;
  }
  return {start:start,identity:identity};
}());

return A4;
}());
if (typeof module !== "undefined" && module.exports) module.exports = A4;
if (typeof BotManager !== "undefined" && typeof java !== "undefined" && typeof Event !== "undefined") {
  A4.Runtime.start(typeof globalThis !== "undefined" ? globalThis : this);
}

// ---- 방 이름 보정: 카카오톡 26.7.0 알림 대응 ----
if (typeof BotManager !== "undefined" && typeof Java !== "undefined" && typeof Event !== "undefined") {
var bot = BotManager.getCurrentBot();
 


const ActivityThreadForRoomName = Java.type("android.app.ActivityThread");
const RankingForRoomName = Java.type("android.service.notification.NotificationListenerService$Ranking");

const ROOM_NAME_KAKAOTALK_PACKAGE = "com.kakao.talk";
const ROOM_NAME_LISTENER_CLASS = "android.service.notification.NotificationListenerService";
const ROOM_NAME_CACHE_TTL_MS = 15000;
const ROOM_NAME_CACHE_MAX_SIZE = 256;

const _roomNameUsesMessageEvent = bot.listeners(Event.MESSAGE).length > 0;
const _roomNameUsesCommandEvent = bot.listeners(Event.COMMAND).length > 0;

const _roomNameByLogId = new Map();
const _roomNameByChannelId = new Map();
let _roomNameNotificationListener = null;




 


 





function _roomNameIsInstanceOf(value, expectedClassName) {
    if (!value || typeof value.getClass !== "function") return false;

    let currentClass = value.getClass();
    while (currentClass) {
        if (String(currentClass.getName()) === expectedClassName) return true;
        currentClass = currentClass.getSuperclass();
    }
    return false;
}

 



function _getRoomNameNotificationListener() {
    if (_roomNameNotificationListener) return _roomNameNotificationListener;

    const activityThread = ActivityThreadForRoomName.currentActivityThread();
    if (!activityThread) return null;

    const servicesField =
        ActivityThreadForRoomName.class.getDeclaredField("mServices");
    servicesField.setAccessible(true);

    const services = servicesField.get(activityThread);
    if (!services) return null;

    const iterator = services.values().iterator();
    while (iterator.hasNext()) {
        const service = iterator.next();
        if (_roomNameIsInstanceOf(service, ROOM_NAME_LISTENER_CLASS)) {
            _roomNameNotificationListener = service;
            return service;
        }
    }
    return null;
}

 




function _getShortcutRoomName(sbn) {
    const listener = _getRoomNameNotificationListener();
    if (!listener) return "";

    const rankingMap = listener.getCurrentRanking();
    if (!rankingMap) return "";

    const ranking = new RankingForRoomName();
    if (!rankingMap.getRanking(sbn.getKey(), ranking)) return "";

    const shortcut = ranking.getConversationShortcutInfo();
    if (!shortcut) return "";

    const longLabel = shortcut.getLongLabel();
    if (longLabel !== null && String(longLabel).trim()) {
        return String(longLabel).trim();
    }

    const shortLabel = shortcut.getShortLabel();
    return shortLabel === null ? "" : String(shortLabel).trim();
}

 
function _pruneRoomNameCache() {
    const now = Date.now();

    for (const [key, item] of _roomNameByLogId) {
        if ((now - item.savedAt) > ROOM_NAME_CACHE_TTL_MS) {
            _roomNameByLogId.delete(key);
        }
    }
    for (const [key, item] of _roomNameByChannelId) {
        if ((now - item.savedAt) > ROOM_NAME_CACHE_TTL_MS) {
            _roomNameByChannelId.delete(key);
        }
    }
    while (_roomNameByLogId.size > ROOM_NAME_CACHE_MAX_SIZE) {
        _roomNameByLogId.delete(_roomNameByLogId.keys().next().value);
    }
    while (_roomNameByChannelId.size > ROOM_NAME_CACHE_MAX_SIZE) {
        _roomNameByChannelId.delete(_roomNameByChannelId.keys().next().value);
    }
}

 




function _cacheRoomNameFromNotification(sbn, roomName) {
    const notification = sbn.getNotification();
    const extras = notification.extras;
    const shortcutId = notification.getShortcutId();
    const savedAt = Date.now();
    const item = { roomName, savedAt };

    if (shortcutId !== null) {
        _roomNameByChannelId.set(String(shortcutId), item);
    }

    if (extras) {
        const chatLogId = extras.get("chatLogId");
        if (chatLogId !== null) {
            _roomNameByLogId.set(String(chatLogId), item);
        }
    }

    _pruneRoomNameCache();
}
 




function _findCachedRoomName(event) {
    _pruneRoomNameCache();

    if (event.logId !== undefined && event.logId !== null) {
        const exact = _roomNameByLogId.get(String(event.logId));
        if (exact) return exact;
    }

    if (event.channelId !== undefined && event.channelId !== null) {
        const byChannel = _roomNameByChannelId.get(String(event.channelId));
        if (byChannel) return byChannel;
    }
    return null;
}

 



function _correctRoomNameBeforeListeners(event) {
    const cached = _findCachedRoomName(event);
    if (!cached) return;
    event.room = cached.roomName;
}




 


 



function onNoti(sbn) {
    if (!sbn || sbn.getPackageName() !== ROOM_NAME_KAKAOTALK_PACKAGE) return;
    if (sbn.getNotification().getShortcutId() === null) return;

    try {
        const roomName = _getShortcutRoomName(sbn);
        if (roomName) _cacheRoomNameFromNotification(sbn, roomName);
    } catch (e) {
        Log.e(`${e.name}\n${e.message}\n${e.stack}`);
    }
}




 


if (_roomNameUsesMessageEvent || _roomNameUsesCommandEvent) {
    bot.addListener(Event.NOTIFICATION_POSTED, onNoti);
}
if (_roomNameUsesMessageEvent) {
    bot.prependListener(Event.MESSAGE, _correctRoomNameBeforeListeners);
}
if (_roomNameUsesCommandEvent) {
    bot.prependListener(Event.COMMAND, _correctRoomNameBeforeListeners);
}
// [출처] 카톡 26.7.0 알림 구조 변경 대응 소스 (카카오톡 봇 커뮤니티 : 카카오톡 오픈채팅방 챗봇 구현) | 작성자 헤히
}
