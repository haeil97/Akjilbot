/* Region progression uses total wins; already committed encounters stay immutable. */
A4.Regions=(function(){
 'use strict';
 var design=A4.content.regionDesign;
 function enabled(run){return !!(run&&run.regionVersion===1);}
 function limit(run){return enabled(run)?design.regions.length*design.battlesPerRegion:8;}
 function progress(run,completed){
  var total=run.wins||0,n=design.battlesPerRegion,index=Math.min(design.regions.length-1,Math.floor(Math.max(0,total-(completed?1:0))/n)),region=design.regions[index];
  return {regionIndex:index,regionNumber:index+1,regionId:region.id,regionName:region.name,regionCount:design.regions.length,battle:completed?((Math.max(1,total)-1)%n)+1:(total%n)+1,totalWins:total,totalBattles:limit(run),completedRegions:Math.floor(total/n)};
 }
 function stage(run){return enabled(run)?(run.wins%design.battlesPerRegion)+1:run.wins+1;}
 function info(run){var p=progress(run,false);p.battle=stage(run);p.isBoss=p.battle===design.battlesPerRegion;return p;}
 function candidates(run){var p=info(run),r=design.regions[p.regionIndex];return (p.isBoss?r.bosses:r.enemies).slice();}
 function playerHp(run,c){var i=enabled(run)?Math.min(7,run.wins%8):Math.min(7,run.wins);return c.config.playerMaxHpByStage[i];}
 function label(run,completed){if(!enabled(run))return (completed?run.wins:run.wins+1)+'/8';var p=completed?progress(run,true):info(run);return p.regionNumber+'/'+p.regionCount+'지역 · '+p.regionName+' · '+p.battle+'/8'+(p.battle===8?' 보스':'');}
 function battleLabel(b,totalStage){if(!b.region)return totalStage+'/8';var p=b.region;return p.regionNumber+'/'+p.regionCount+'지역 · '+p.regionName+' · '+p.battle+'/8'+(p.isBoss?' 보스':'');}
 function validate(c){
  var errors=[],ids={};if(design.regions.length!==4||design.battlesPerRegion!==8)errors.push('지역 4개·각 8전투가 필요합니다.');
  design.regions.forEach(function(r){if(!r.id||ids[r.id])errors.push('지역 ID가 없거나 중복됩니다.');ids[r.id]=true;var available=r.enemies.filter(function(id){return c.enemies[id]&&c.enemies[id].encounterEnabled!==false;});if(available.filter(function(id,i){return available.indexOf(id)===i;}).length<7)errors.push(r.name+'의 일반 상대가 7종보다 적습니다.');if(!r.bosses.length)errors.push(r.name+'의 보스가 없습니다.');r.enemies.concat(r.bosses).forEach(function(id){if(!c.enemies[id]||c.enemies[id].encounterEnabled===false)errors.push(r.name+'의 상대 정의가 없거나 비활성화 상태입니다: '+id);});if(r.bosses.some(function(id){return r.enemies.indexOf(id)>=0;}))errors.push(r.name+'의 보스가 일반 풀에 섞였습니다.');});return errors;
 }
 return {enabled:enabled,limit:limit,stage:stage,info:info,progress:progress,candidates:candidates,playerHp:playerHp,label:label,battleLabel:battleLabel,validate:validate};
}());
