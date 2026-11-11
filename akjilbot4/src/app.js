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
      // Check before parsing and receipt replay: blocked messages are silent and
      // cannot create accounts, claim admin rights or replay another room UI.
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
        // Queries do not save unless key regeneration actually grants currency.
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
          // Ordinary chat numbers outside the current session are not commands.
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
