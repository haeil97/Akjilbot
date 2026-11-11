/* ES5, no IO. Appended inside the A4 bundle closure.
 * Resolution: validate -> pay/remove every submitted card -> all-pairs counters ->
 * shield/heal -> other effects in submitted order (player, enemy) -> rest/excluded ->
 * phase death check -> MAIN2 or END/STANDBY -> next phase enemy plan.
 * Dredge suspends with a serializable effect cursor; costs/power usage are paid once.
 * Played cards cannot be drawn again during their own batch. Shields persist during
 * one battle. Fatigue bypasses shields. These implementation defaults are documented.
 * Effects: damage/heal/shield/draw {amount,target?:self|opponent|both}; generate
 * {cardId,amount?:1,zone?:hand|deck|rest,target?}; excludeSelf/removeFromRun/upgradeSelf
 * refer only to the submitted instance. excludeOnUse is an unconditional card rule;
 * an excludeSelf effect, like all ordinary effects, is canceled by a counter.
 * AI receives only enemy-owned cards plus opponent name/hp/maxHp/shield/mana/
 * maxMana, zone counts and previously revealed plays. It never receives player
 * hidden zones, the current submission, or unrevealed generated cards.
 */
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
    /* Exhaustive affordable subsets (at most 256); utility is an explicit heuristic,
     * not a proof of optimal strategy. Only the enemy's own cards and a sanitized
     * public opponent snapshot reach this function. No access to player hand/deck.
     */
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
                score += value * (1 - probability) - 0.03; // Keep useless cards instead of emptying the hand.
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
        // Both sides receive defensive effects before attacks; all submitted effects
        // finish before lethal evaluation, permitting an actual simultaneous defeat.
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
        // No free healing or repeated startingShield on reinforcement. Lowered max
        // health clamps current health; enemy's already committed action is retained.
        p.hp = Math.min(p.hp, p.maxHp);
    }
    return { create: create, submit: submit, choose:choose, publicView: publicView, syncPassives: syncPassives,
        describeCard: describeCard, planEnemy: planEnemy, maximumMana: maximumMana,
        validateCard: function (instance, catalog) { validateDefinition(describeCard(instance, catalog), catalog); },
        validatePassives: validatePassives,
        validateHeroPower:validateHeroPower,
        fatigue: fatigue, supportedEffects: Object.keys(EFFECTS), supportedPassives: Object.keys(PASSIVES) };
}());
