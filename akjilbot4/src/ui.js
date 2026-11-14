A4.UI = (function () {
  // Stored as one receipt, delivered as separate chat messages after commit.
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
      if(e.skill)return '[🌕] '+e.name+' | 스킬\n'+e.skill.text;
      if(e.startingTreasure)return '[🎖️] '+e.name+'\n'+e.startingTreasure.text;
      if(e.power)return '[🛟] '+e.name+(e.power.kind==='active'?' | 💧'+e.cost:' | ⏳️지속')+'\n'+e.power.text;
      if(e.treasureId)return rewardTreasure(e.treasureId,catalog);
      var text=rewardCard({cardId:e.id,upgraded:false},catalog);
      if(catalog.cards[e.id].upgrade)text+='\n'+rewardCard({cardId:e.id,upgraded:true},catalog);
      return text;
    }
    var entries=catalog.cardPool.concat(Object.keys(catalog.cards).filter(function(id){return catalog.cards[id].classCard;})).map(entry),needle=normalize(query),lines=[title];
    if(needle){
      Object.keys(catalog.minionSkills||{}).forEach(function(id){var skill=catalog.minionSkills[id];entries.push({skill:skill,name:skill.name,cost:0});});
      Object.keys(catalog.cards).forEach(function(id){var d=catalog.cards[id];if((d.token||d.exclusive||d.botOnly)&&!d.classCard&&catalog.cardPool.indexOf(id)<0)entries.push(entry(id));});
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
