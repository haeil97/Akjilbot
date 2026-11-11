/* Runs only inside App's durable transaction; accounts are identified by ID. */
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
