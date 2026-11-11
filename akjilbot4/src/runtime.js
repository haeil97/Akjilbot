/* MessengerBotR/Android adapter. No old 3.x data or handlers are imported. */
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
    // Delivery deduplication also covers queries that never create saved receipts.
    // Keep this small cache through recompilation in the same runtime context.
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
      // Keep each committed reply batch ordered, including timer-driven replies.
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
        if (result !== null) {sendMessages(result,function(text){msg.reply(text);});rememberDelivery(eventId,msg);} /* commit before either reply */
      } catch (error) {
        handledAt=Date.now();
        try {
          if (store.isBlocked()) msg.reply('저장을 확인할 수 없어 추가 진행을 중단했습니다. 데이터를 초기화하지 말고 봇을 재시작하여 마지막 기록을 복구하세요.');
          else msg.reply(String(error.message || error));
          rememberDelivery(eventId,msg);
        } catch(replyError) { /* A committed action remains recoverable through +탐험. */ }
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
      // A compile callback must not wait forever for an old message/timer task.
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
          messages.forEach(function(message){try{sendMessages(message.text,function(text){bot.send(message.room,text);});}catch(sendError){/* State is durable; +탐험 renders it again. */}});
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
