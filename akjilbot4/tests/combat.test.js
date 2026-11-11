"use strict";
var assert = require("assert"), fs = require("fs"), path = require("path"), vm = require("vm"), test = require("node:test");
var context = { A4: {} };
vm.createContext(context);
vm.runInContext(fs.readFileSync(path.join(__dirname, "../src/base.js"), "utf8"), context);
vm.runInContext(fs.readFileSync(path.join(__dirname, "../src/combat.js"), "utf8"), context);
var Combat = context.A4.Combat;
function clone(v) { return JSON.parse(JSON.stringify(v)); }
function rng() { return 0.5; }
function catalog() {
    return { cards: {
        fire: { name: "화염구", element: "FIRE", cost: 1, effects: [{ type: "damage", amount: 2 }], upgrade: { effects: [{ type: "damage", amount: 4 }] } },
        ice: { name: "얼음창", element: "ICE", cost: 1, effects: [{ type: "damage", amount: 2 }] },
        physical: { name: "타격", element: "NATURE", cost: 1, effects: [{ type: "damage", amount: 2 }] },
        lightning: { name: "감전", element: "LIGHTNING", cost: 1, effects: [{ type: "damage", amount: 2 }] },
        blank: { name: "빈 카드", cost: 0, effects: [] },
        draw: { name: "통찰", element: "NEUTRAL", cost: 0, effects: [{ type: "draw", amount: 2 }] },
        exclude: { name: "제외", cost: 0, effects: [{ type: "excludeSelf" }] },
        exfire: { name: "한 번뿐인 불꽃", element: "FIRE", cost: 1, excludeOnUse: true, effects: [{ type: "damage", amount: 4 }] },
        remove: { name: "탐험 제거", cost: 0, effects: [{ type: "removeFromRun" }] },
        generate: { name: "생성", cost: 0, effects: [{ type: "generate", cardId: "blank", amount: 10 }] },
        shield: { name: "방패", cost: 1, effects: [{ type: "shield", amount: 3 }] },
        lethal: { name: "파괴", cost: 1, effects: [{ type: "damage", amount: 100 }] }
    } };
}
function deck(ids, prefix) { return ids.map(function (id, i) { return { uid: prefix + i, cardId: id, upgraded: false }; }); }
function spec(ids, name) { return { name: name, maxHp: 100, deck: deck(ids, name), passives: [] }; }
function setup(p, e, cat) { return Combat.create(spec(p, "p"), spec(e || ["blank"], "e"), cat || catalog(), rng); }
function plan(b, uids) { b.enemyPlan = uids || []; b.enemyPlanTurn = b.turn; b.enemyPlanPhase=b.phase; }
function emptyTurn(b,cat) { plan(b);Combat.submit(b,[],cat,rng); if(b.outcome==='ongoing' && b.phase==='MAIN2') {plan(b);return Combat.submit(b,[],cat,rng);} return {outcome:b.outcome}; }
function uid(b, id, side) { return b[side || "player"].hand.filter(function (c) { return c.cardId === id; })[0].uid; }

test("opening four, turn zero mana and untouched starting deck", function () {
    var cat = catalog(), original = spec(["blank", "fire", "ice", "physical", "lightning", "draw"], "p"), saved = clone(original);
    var b = Combat.create(original, spec(["blank"], "e"), cat, rng);
    assert.equal(b.player.hand.length, 4); assert.equal(b.player.deck.length, 2);
    assert.equal(b.turn, 0); assert.equal(b.player.mana, 1);
    assert.deepStrictEqual(original, saved);
});
test("innate cards still occupy only four opening slots under the eight-card limit", function () {
    var cat = catalog(); cat.cards.blank.innate = true;
    var cards = ["blank", "blank", "blank", "blank", "blank", "blank", "blank", "blank", "blank"];
    var b = setup(cards, cards, cat);
    assert.equal(context.A4.HAND_LIMIT, 8);
    [b.player,b.enemy].forEach(function (f) {
        assert.equal(f.hand.length, 4); assert.equal(f.deck.length, 5); assert.equal(f.excluded.length, 0);
    });
    for (var i = 0; i < 4; i++) emptyTurn(b,cat);
    [b.player,b.enemy].forEach(function (f) { assert.equal(f.hand.length, 8); assert.equal(f.deck.length, 1); });
    emptyTurn(b,cat);
    [b.player,b.enemy].forEach(function (f) { assert.equal(f.hand.length, 8); assert.equal(f.deck.length, 0); assert.equal(f.excluded.length, 1); });
});
test("mana boundaries, refresh, cap and retained hands", function () {
    var b = setup(["blank", "blank", "blank", "blank", "blank", "blank", "blank", "blank", "blank"]), cat = catalog();
    var first = b.player.hand[0].uid, i;
    for (i = 1; i <= 25; i++) {
        b.player.mana = 0; emptyTurn(b,cat);
        assert.equal(b.turn, i); assert.equal(b.player.mana, Math.min(5, 1 + Math.floor(i / 5)));
        assert.ok(b.player.hand.some(function (c) { return c.uid === first; }));
    }
    assert.equal(b.player.hand.length, 8); assert.equal(b.player.deck.length, 0); assert.equal(b.player.excluded.length,1);
});
test("selected cost and duplicate validation do not mutate battle", function () {
    var b = setup(["fire", "ice"]), cat = catalog(), before = JSON.stringify(b), fire = uid(b, "fire");
    assert.throws(function () { Combat.submit(b, [fire, fire], cat, rng); }, /두 번/);
    assert.equal(JSON.stringify(b), before);
    assert.throws(function () { Combat.submit(b, b.player.hand.map(function (c) { return c.uid; }), cat, rng); }, /마나/);
    assert.equal(JSON.stringify(b), before);
    assert.throws(function () { Combat.submit(b, ["missing"], cat, rng); }, /손패/);
    assert.equal(JSON.stringify(b), before);
});
test("all submitted pairs counter even when a countering card itself is countered", function () {
    var b = setup(["fire", "physical"], ["ice", "lightning"]), cat = catalog();
    b.player.mana = 2; b.enemy.mana = 2;
    plan(b, b.enemy.hand.map(function (c) { return c.uid; }));
    Combat.submit(b, b.player.hand.map(function (c) { return c.uid; }), cat, rng);
    assert.equal(b.player.hp, 98); assert.equal(b.enemy.hp, 98);
    assert.equal(b.history[0].player.filter(function (c) { return c.countered; }).length, 1);
    assert.equal(b.history[0].enemy.filter(function (c) { return c.countered; }).length, 1);
    assert.equal(b.player.hand.length, 0); assert.equal(b.player.deck.length, 0);assert.equal(b.player.rest.length,2);
});
test("countered cards consume resources and cancel all ordinary effects", function () {
    var cat = catalog(); cat.cards.fire.effects.push({ type: "draw", amount: 2 }, { type: "heal", amount: 7 });
    var b = setup(["fire", "blank", "blank", "blank", "blank", "blank"], ["ice"], cat);
    var cards = b.player.hand.concat(b.player.deck); b.player.hand = cards.filter(function (c) { return c.cardId === "fire"; });
    b.player.deck = cards.filter(function (c) { return c.cardId !== "fire"; });
    b.player.hp = 50; plan(b, [uid(b, "ice", "enemy")]);
    Combat.submit(b, [uid(b, "fire")], cat, rng);
    assert.equal(b.player.hp, 48); assert.equal(b.player.hand.length, 0); assert.equal(b.enemy.hp, 100);
    assert.equal(b.player.rest.length, 1);
});
test("eight hand draw card frees its own slot and excess draws are excluded", function () {
    var cat = catalog(), b = setup(["draw", "blank", "blank", "blank", "blank", "blank", "blank", "blank", "blank", "blank", "blank"], [], cat);
    var all = b.player.hand.concat(b.player.deck), drawCard = all.filter(function (c) { return c.cardId === "draw"; })[0];
    b.player.hand = [drawCard].concat(all.filter(function (c) { return c !== drawCard; }).slice(0, 7));
    b.player.deck = all.filter(function (c) { return b.player.hand.indexOf(c) < 0; }); plan(b);
    Combat.submit(b, [drawCard.uid], cat, rng);
    assert.equal(b.player.hand.length, 8); assert.equal(b.player.deck.length, 1); assert.equal(b.player.rest.length, 1);assert.equal(b.player.excluded.length,1);
});
test("batch draw cannot redraw current batch; next turn recycles only rest", function () {
    var cat = catalog(), b = setup(["draw", "blank", "blank", "blank"], [], cat), card = uid(b, "draw");
    plan(b); var result = Combat.submit(b, [card], cat, rng);
    assert.ok(result.log.indexOf("p: 0장 드로우") >= 0);
    assert.equal(b.player.hand.length,3); assert.equal(b.player.rest.length,1);plan(b);Combat.submit(b,[],cat,rng);
    assert.equal(b.player.hand.length, 4); assert.equal(b.player.rest.length, 0); assert.equal(b.player.deck.length, 0);
    assert.equal(b.player.hand.filter(function (c) { return c.uid === card; }).length, 1);
});
test("draw crosses deck to shuffled rest without refilling held cards", function () {
    var cat = catalog(), b = setup(["draw"], [], cat);
    b.player.deck = deck(["blank"], "d"); b.player.rest = deck(["fire", "ice"], "r"); plan(b);
    Combat.submit(b, [uid(b, "draw")], cat, rng);
    assert.equal(b.player.hand.length, 2); assert.equal(b.player.rest.length, 1); assert.equal(b.player.deck.length, 1);
    var seen = {}; b.player.hand.forEach(function (c) { assert.ok(!seen[c.uid]); seen[c.uid] = true; });
});
test("excluded cards never recycle, including countered excludeOnUse cards", function () {
    var cat = catalog(), b = setup(["exclude", "exfire"], ["ice"], cat);
    plan(b, [uid(b, "ice", "enemy")]); Combat.submit(b, b.player.hand.map(function (c) { return c.uid; }), cat, rng);
    assert.equal(b.player.excluded.length, 2); assert.equal(b.player.hand.length, 0); assert.equal(b.player.deck.length, 0); assert.equal(b.player.rest.length, 0);
});
test("run removal is explicit and card generation respects eight-card cap", function () {
    var cat = catalog(), b = setup(["remove", "generate"], [], cat), removal = uid(b, "remove"); plan(b);
    var result = Combat.submit(b, b.player.hand.map(function (c) { return c.uid; }), cat, rng);
    assert.deepStrictEqual(clone(result.removedFromRun), [removal]); assert.equal(b.player.excluded.length, 3);
    assert.equal(b.player.hand.length, 8); assert.equal(b.player.rest.length, 1);
    var seen = {}; b.player.hand.forEach(function (c) { assert.ok(!seen[c.uid]); seen[c.uid] = true; });
});
test("generation into either hand excludes only cards beyond eight and conserves card instances", function () {
    var cat = catalog(); cat.cards.generate.effects[0].target = "both";
    var b = setup(["generate"], [], cat); plan(b);
    Combat.submit(b,[uid(b,"generate")],cat,rng);
    var seen = {};
    [b.player,b.enemy].forEach(function (f) {
        assert.equal(f.hand.length,8); assert.equal(f.excluded.length,2);
        f.hand.concat(f.excluded).forEach(function (c) { assert.ok(!seen[c.uid]); seen[c.uid] = true; });
    });
    assert.equal(Object.keys(seen).length,20); assert.equal(b.player.rest.length,1);
});
test("simultaneous lethal is defeat and shields resolve before either attack", function () {
    var cat = catalog(), b = setup(["lethal"], ["lethal"], cat); plan(b, [uid(b, "lethal", "enemy")]);
    assert.equal(Combat.submit(b, [uid(b, "lethal")], cat, rng).outcome, "defeat");
    assert.equal(b.player.hp, 0); assert.equal(b.enemy.hp, 0);
    b = setup(["shield"], ["fire"], cat); plan(b, [uid(b, "fire", "enemy")]);
    Combat.submit(b, [uid(b, "shield")], cat, rng); assert.equal(b.player.hp, 100); assert.equal(b.player.shield, 1);
});
test("fatigue begins turn30, rises each turn, ignores shields, simultaneous death fails", function () {
    var cat = catalog(), b = setup([], [], cat), i;
    b.player.shield = 100; b.enemy.shield = 100;
    for (i = 1; i <= 29; i++) { emptyTurn(b,cat); }
    assert.equal(b.player.hp, 100);
    emptyTurn(b,cat); assert.equal(b.turn, 30); assert.equal(b.player.hp, 99);
    for (i = 31; i <= 34; i++) { emptyTurn(b,cat); }
    assert.equal(b.player.hp, 85);
    emptyTurn(b,cat); assert.equal(b.player.hp, 79); assert.equal(b.player.shield, 100);
    b.player.hp = 1; b.enemy.hp = 1; plan(b);
    assert.equal(emptyTurn(b,cat).outcome, "defeat");
});
test("AI API observes own hand and public stats/history only, committed plan survives JSON restart", function () {
    var cat = catalog(), b = setup(["fire", "ice"], ["fire", "ice", "physical", "lightning"], cat), reloaded = clone(b);
    var savedPlan = clone(b.enemyPlan), knowledge = { hp: 100, maxHp: 100, shield: 0, mana: 1, handCount: 2, plays: [] };
    Object.defineProperty(knowledge, "hand", { get: function () { throw new Error("hidden hand leak"); } });
    Object.defineProperty(knowledge, "deck", { get: function () { throw new Error("hidden deck leak"); } });
    assert.deepStrictEqual(clone(Combat.planEnemy(b.enemy, knowledge, cat, rng)), clone(Combat.planEnemy(b.enemy, knowledge, cat, rng)));
    Combat.submit(reloaded, [], cat, rng);
    assert.deepStrictEqual(clone(reloaded.history[0].enemy.map(function (c) { return c.cardId; })), savedPlan.map(function (id) { return b.enemy.hand.filter(function (c) { return c.uid === id; })[0].cardId; }));
    var view = Combat.publicView(b);
    assert.equal(view.enemyPlan, undefined); assert.equal(view.enemy.hand, undefined); assert.equal(view.enemy.deck, undefined);
    assert.equal(view.enemy.rest, undefined);
});
test("public player hidden zone permutations do not change next enemy plan", function () {
    var cat = catalog(), b = setup(["fire", "fire", "fire", "fire"], ["ice", "fire", "lightning", "physical"], cat), other = clone(b);
    other.player.hand.forEach(function (c) { c.cardId = "ice"; });
    Combat.submit(b, [], cat, rng); Combat.submit(other, [], cat, rng);
    assert.deepStrictEqual(clone(b.enemyPlan), clone(other.enemyPlan));
});
test("passive strengthening updates live bonuses without replaying starts or changing plan", function () {
    var cat = catalog(), b = setup(["fire"], [], cat), planBefore = clone(b.enemyPlan);
    b.player.hp = 50;
    Combat.syncPassives(b, [{ type: "maxHp", amount: 10 }, { type: "startingShield", amount: 10 }, { type: "damageBonus", amount: 3 }]);
    assert.equal(b.player.maxHp, 110); assert.equal(b.player.hp, 50); assert.equal(b.player.shield, 0);
    assert.deepStrictEqual(clone(b.enemyPlan), planBefore);
    Combat.submit(b, [uid(b, "fire")], cat, rng); assert.equal(b.enemy.hp, 95);
});
test("upgraded cards resolve stronger effect and unsupported content fails loudly", function () {
    var cat = catalog(), p = spec(["fire"], "p"); p.deck[0].upgraded = true;
    var b = Combat.create(p, spec([], "e"), cat, rng); Combat.submit(b, [b.player.hand[0].uid], cat, rng);
    assert.equal(b.enemy.hp, 96); assert.equal(b.history[0].player[0].name, "화염구+");
    cat.cards.fire.effects = [{ type: "notImplemented" }];
    assert.throws(function () { setup(["fire"], [], cat); }, /지원하지 않는/);
});
test("battle-local upgrade preserves owned UID and does not modify the run deck", function () {
    var cat = catalog(), p = spec(["fire"], "p");
    cat.cards.fire.effects.push({ type: "upgradeSelf" });
    var b = Combat.create(p, spec([], "e"), cat, rng), originalUid = p.deck[0].uid;
    Combat.submit(b, [originalUid], cat, rng);
    assert.equal(b.player.rest[0].uid, originalUid); assert.equal(b.player.rest[0].upgraded, true);
    assert.equal(p.deck[0].upgraded, false);
});
test("content validation rejects unknown elements, unsupported upgrades and passives", function () {
    var cat = catalog(); cat.cards.fire.element = "TYPO";
    assert.throws(function () { Combat.validateCard({ cardId: "fire" }, cat); }, /속성/);
    cat.cards.fire.element = "FIRE"; cat.cards.fire.upgrade.effects = [{ type: "unimplemented" }];
    assert.throws(function () { Combat.validateCard({ cardId: "fire", upgraded: true }, cat); }, /지원하지 않는/);
    assert.throws(function () { Combat.validatePassives([{ type: "unsupported", amount: 1 }]); }, /지원하지 않는/);
    assert.throws(function () { Combat.validatePassives(null); }, /배열/);
});
test("AI target-aware utility does not reward healing the opponent or harming itself", function () {
    var cat = catalog();
    cat.cards.badHeal = { name: "상대 회복", cost: 0, effects: [{ type: "heal", amount: 50, target: "opponent" }] };
    cat.cards.badHit = { name: "자해", cost: 0, effects: [{ type: "damage", amount: 50, target: "self" }] };
    var b = setup([], ["badHeal", "badHit"], cat);
    var info = { hp: 50, maxHp: 100, shield: 0, mana: 1, handCount: 0, deckCount: 0, restCount: 0, plays: [] };
    assert.deepStrictEqual(clone(Combat.planEnemy(b.enemy, info, cat, rng)), []);
});
