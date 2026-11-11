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
      // Retain the replaced account for audit/history, but never as a live user.
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
