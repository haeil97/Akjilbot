'use strict';
// Put the requested event first without depending on the size of the eligible pool.
// Production eligibility and the event chance roll still apply.
module.exports=function(A,state,user,catalog,eventId,chanceRoll=0){
 const original=A.content.regionEvents;
 A.content.regionEvents=original.filter(e=>e.id===eventId).concat(original.filter(e=>e.id!==eventId));
 try{let calls=0;return A.Journey.next(state,user,catalog,()=>calls++===0?chanceRoll:0);}
 finally{A.content.regionEvents=original;}
};
