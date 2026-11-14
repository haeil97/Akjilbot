/* Presentation only: never exposes the enemy hand, draw pile or committed plan. */
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
    // Scheduled effects remain visible even after their source card leaves play.
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
    // Ignore upgrade marks, trailing decorations and nickname annotations.
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
    ['player','enemy'].forEach(function(s){var f=b[s];lines.push('','■ '+f.name+': ❤️ '+f.hp+(f.shield?'(+'+f.shield+')':'')+'/'+f.maxHp);lines=lines.concat(states(b,s,c));
      (f.minions||[]).filter(function(m){return m.hp>0;}).forEach(function(m){lines.push('','□ '+m.name+': ❤️ '+m.hp+(m.shield?'(+'+m.shield+')':'')+'/'+m.maxHp);if(m.preparedSkill)lines.push('》\''+m.preparedSkill.name+'\'을 준비한다.');(m.status.cards.effects||[]).filter(function(e){return e.until===undefined||e.until>=b.turn;}).forEach(function(e){var info={vulnerable:'취약: 받는 피해가 50% 증가한다.',weakened:'약화: 가하는 피해가 25% 감소한다.'}[e.kind];if(info)lines.push('• '+info+' ('+duration(e,b)+')');});});
    });
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
      if(e.minionUid){var victim=A4.Minions.find(b,e.side,e.minionUid);if(victim)target=victim.name;}if(src&&src.minionUid){var acting=A4.Minions.find(b,src.side,src.minionUid);if(acting)actor=acting.name;}
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
    if(!b.pendingChoice){if(A4.Minions&&A4.Minions.alive(b.enemy).length)lines.push('대상: '+A4.Minions.targets(b,'enemy').map(function(m,i){return (i+1)+'. '+m.name;}).join(' / '),'카드번호+대상번호로 제출 (예: 12). 대상 생략 시 본체.');lines.push('s / p / gg');}
    return lines.join('\n');
  }
  return {summary:summary,controls:controls};
}());
