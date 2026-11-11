"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const A4 = require("../../악질봇4.0.0.js");
const makeCatalog = require("./fixtures");
const INTERVAL = 30 * 60 * 1000;
const clone = value => JSON.parse(JSON.stringify(value));

function setup() {
    const catalog = makeCatalog(A4), state = A4.newState(12345);
    const user = A4.Game.newUser(state, "경제 테스트", 0, catalog);
    state.users[user.id] = user;
    return { catalog, state, user };
}
function rolls(values) {
    let next = 0;
    return () => next < values.length ? values[next++] : 0;
}
function owned(user, relicId, level = 0, uid = "test-relic-1") {
    const relic = { uid, relicId, level };
    user.relics.push(relic);
    return relic;
}
function forcedRule(catalog, grade, level, outcome) {
    catalog.enhancement[grade][level] = {
        gold: 100, stones: 1, success: 0, fail: 0, down: 0, destroy: 0,
        [outcome]: 100
    };
}
function memoryIO() {
    const files = {};
    return {
        files,
        list: () => Object.keys(files),
        read: key => files[key],
        writeNewDurable: (key, value) => {
            assert.equal(Object.hasOwn(files, key), false);
            files[key] = value;
        }
    };
}
function appSetup() {
    const catalog = makeCatalog(A4), io = memoryIO(), store = A4.Store.create(io);
    store.load(A4.newState(2468));
    const app = A4.App.create(store, catalog);
    function send(action, now = 0) {
        return app.handle({ identity: "economic-account", name: "경제 테스트", room: "TEST_LIVE_1", now, action });
    }
    send({ type: "inventory" });
    const uid = store.getState().identities["identity:economic-account"];
    return { catalog, io, store, app, send, uid, user: () => store.getState().users[uid] };
}

test("keys recover exactly at 30 minutes and preserve an incomplete offline interval", () => {
    const { user } = setup();
    user.items.keys = 0;
    A4.Economy.refreshKeys(user, INTERVAL - 1);
    assert.equal(user.items.keys, 0);
    assert.equal(user.keyUpdatedAt, 0);
    A4.Economy.refreshKeys(user, INTERVAL);
    assert.equal(user.items.keys, 1);
    A4.Economy.refreshKeys(user, INTERVAL * 3.5);
    assert.equal(user.items.keys, 3);
    assert.equal(user.keyUpdatedAt, INTERVAL * 3);
    A4.Economy.refreshKeys(user, INTERVAL * 4 - 1);
    assert.equal(user.items.keys, 3);
    A4.Economy.refreshKeys(user, INTERVAL * 4);
    assert.equal(user.items.keys, 4);
});

test("offline automatic keys stop at five while awarded keys can exceed five", () => {
    const { user } = setup();
    user.items.keys = 1;
    A4.Economy.refreshKeys(user, 100 * INTERVAL);
    assert.equal(user.items.keys, 5);
    A4.Economy.grant(user, { gold: 0, keys: 3 }, 101 * INTERVAL);
    assert.equal(user.items.keys, 8);
    A4.Economy.refreshKeys(user, 200 * INTERVAL);
    assert.equal(user.items.keys, 8);
    assert.equal(user.keyUpdatedAt, 200 * INTERVAL);
});

test("starting a run after a long full-cap period does not bank automatic keys", () => {
    const { user, state, catalog } = setup(), now = 100 * INTERVAL;
    A4.Game.act(state, user, { type: "explore" }, catalog, now, "TEST_LIVE_1");
    assert.equal(user.items.keys, 4);
    assert.equal(user.keyUpdatedAt, now);
    A4.Economy.refreshKeys(user, now + INTERVAL - 1);
    assert.equal(user.items.keys, 4);
    A4.Economy.refreshKeys(user, now + INTERVAL);
    assert.equal(user.items.keys, 4);
    A4.Game.act(state, user, { type: "explore" }, catalog, now + INTERVAL, "TEST_LIVE_2");
    assert.equal(user.items.keys, 4, "resuming a starter choice must not spend another key");
});

test("backward wall clock neither creates keys nor rewinds the saved interval", () => {
    const { user } = setup();
    user.items.keys = 1;
    user.keyUpdatedAt = 10 * INTERVAL;
    const before = clone(user);
    A4.Economy.refreshKeys(user, 5 * INTERVAL);
    assert.deepEqual(user, before);
    A4.Economy.refreshKeys(user, 11 * INTERVAL - 1);
    assert.equal(user.items.keys, 1);
    A4.Economy.refreshKeys(user, 11 * INTERVAL);
    assert.equal(user.items.keys, 2);
});

test("all nine gold ranges include every 50G step and both endpoints", () => {
    const bounds = [[50, 50], [50, 100], [100, 200], [200, 400], [200, 400], [400, 600], [500, 800], [600, 1000], [1000, 1500]];
    for (let wins = 0; wins <= 8; wins++) {
        const [minimum, maximum] = bounds[wins], count = (maximum - minimum) / 50 + 1;
        const actual = [];
        for (let index = 0; index < count; index++) {
            const reward = A4.Economy.reward(wins, rolls([(index + 0.5) / count]));
            actual.push(reward.gold);
            assert.equal(reward.gold % 50, 0);
        }
        assert.deepEqual(actual, Array.from({ length: count }, (_, index) => minimum + index * 50));
        assert.equal(A4.Economy.reward(wins, rolls([0])).gold, minimum);
        assert.equal(A4.Economy.reward(wins, rolls([1 - Number.EPSILON])).gold, maximum);
    }
});

test("zero through three wins give no items and invalid victory counts are rejected", () => {
    for (let wins = 0; wins <= 3; wins++) {
        const reward = A4.Economy.reward(wins, () => 0.5);
        assert.deepEqual({ keys: reward.keys, stones: reward.stones, essence: reward.essence }, { keys: 0, stones: 0, essence: 0 });
    }
    for (const wins of [-1, 9, 1.5, NaN, "8"]) assert.throws(() => A4.Economy.reward(wins, () => 0.5), /처치 수/);
});

test("four through seven wins obey the exact independent material probability boundaries", () => {
    const cases = [
        [4, [0.2 - 1e-12], [1, 0, 0]], [4, [0.2], [0, 0, 0]],
        [5, [0.8 - 1e-12, 0.8 - 1e-12], [1, 0, 0]],
        [5, [0.8, 0.8], [0, 1, 0]],
        [5, [0, 0.99], [1, 1, 0]], [5, [0.99, 0], [0, 0, 0]],
        [6, [0.8 - 1e-12], [1, 1, 0]], [6, [0.8], [1, 2, 0]],
        [7, [0.6 - 1e-12, 0.5 - 1e-12], [1, 2, 0]],
        [7, [0.6, 0.5], [1, 3, 1]],
        [7, [0, 0.99], [1, 2, 1]], [7, [0.99, 0], [1, 3, 0]]
    ];
    for (const [wins, random, expected] of cases) {
        const result = A4.Economy.reward(wins, rolls([0, ...random]));
        assert.deepEqual([result.keys, result.stones, result.essence], expected, `${wins} wins, ${random}`);
    }
});

test("eight-win stones are 60/30/10 and essence is 70/20/10 with one guaranteed key", () => {
    const stoneCases = [[0, 3], [0.6 - 1e-12, 3], [0.6, 4], [0.9 - 1e-12, 4], [0.9, 5], [1 - Number.EPSILON, 5]];
    const essenceCases = [[0, 1], [0.7 - 1e-12, 1], [0.7, 2], [0.9 - 1e-12, 2], [0.9, 3], [1 - Number.EPSILON, 3]];
    for (const [stoneRoll, stones] of stoneCases) for (const [essenceRoll, essence] of essenceCases) {
        const result = A4.Economy.reward(8, rolls([0, stoneRoll, essenceRoll]));
        assert.deepEqual(result, { gold: 1000, keys: 1, stones, essence });
    }
});

test("every relic grade strengthens one level per success and stops at plus five", () => {
    for (const grade of ["C", "B", "A", "S", "SS"]) {
        const { catalog, user } = setup(), relic = owned(user, "relic_" + grade);
        for (let level = 1; level <= 5; level++) {
            const result = A4.Economy.enhance(user, relic.uid, catalog, () => 0.99);
            assert.equal(result.outcome, "success");
            assert.equal(relic.level, level, "success must never grant a great-success +2");
        }
        const before = clone(user);
        assert.throws(() => A4.Economy.enhance(user, relic.uid, catalog, () => 0), /최대 강화/);
        assert.deepEqual(user, before);
        assert.equal(user.gold, 9500);
        assert.equal(user.items.stones, 95);
    }
});

test("failed and downgraded enhancements still consume costs; level zero cannot become negative", () => {
    for (const [outcome, beforeLevel, expectedLevel] of [["fail", 2, 2], ["down", 2, 1], ["down", 0, 0]]) {
        const { catalog, user } = setup(), relic = owned(user, "relic_A", beforeLevel);
        forcedRule(catalog, "A", beforeLevel, outcome);
        const result = A4.Economy.enhance(user, relic.uid, catalog, () => 0.5);
        assert.equal(result.outcome, outcome);
        assert.equal(relic.level, expectedLevel);
        assert.equal(user.gold, 9900);
        assert.equal(user.items.stones, 99);
    }
});

test("C/B/A destruction settings are rejected without consuming anything", () => {
    for (const grade of ["C", "B", "A"]) {
        const { catalog, user } = setup(), relic = owned(user, "relic_" + grade);
        forcedRule(catalog, grade, 0, "destroy");
        const before = clone(user);
        assert.throws(() => A4.Economy.enhance(user, relic.uid, catalog, () => 0), /파괴될 수 없습니다/);
        assert.deepEqual(user, before);
    }
});

test("S/SS destruction removes only the chosen instance and preserves other slot positions", () => {
    for (const grade of ["S", "SS"]) {
        const { catalog, user } = setup();
        const target = owned(user, "relic_" + grade, 0, "target"), duplicate = owned(user, "relic_" + grade, 1, "duplicate");
        const survivor = owned(user, "relic_C", 0, "survivor");
        user.slotCount = 3; user.equipped = [target.uid, null, survivor.uid];
        forcedRule(catalog, grade, 0, "destroy");
        const result = A4.Economy.enhance(user, target.uid, catalog, () => 0.5);
        assert.equal(result.outcome, "destroy");
        assert.equal(result.level, null);
        assert.deepEqual(user.equipped, [null, null, "survivor"]);
        assert.deepEqual(user.relics.map(item => item.uid), [duplicate.uid, survivor.uid]);
        assert.deepEqual(A4.Economy.passives(user, catalog), []);
    }
});

test("unresolved equipped destruction during an active run rejects the entire attempt", () => {
    const { catalog, user, state } = setup(), relic = owned(user, "relic_S");
    user.equipped = [relic.uid]; catalog.config.equippedDestruction = null;
    A4.Game.act(state, user, { type: "explore" }, catalog, 0, "TEST_LIVE_1");
    forcedRule(catalog, "S", 0, "destroy");
    const before = clone(user);
    assert.throws(() => A4.Economy.enhance(user, relic.uid, catalog, () => 0), /처리 규칙이 미정/);
    assert.deepEqual(user, before);
});

test("invalid enhancement probability totals fail before charging costs", () => {
    const { catalog, user } = setup(), relic = owned(user, "relic_C"), before = clone(user);
    catalog.enhancement.C[0].success = 99;
    assert.throws(() => A4.Economy.enhance(user, relic.uid, catalog, () => 0.5), /확률 합계/);
    assert.deepEqual(user, before);
});

test("repeated pulls own separate copies, but Game rejects equipping two copies together", () => {
    const { catalog, user, state } = setup();
    const first = A4.Economy.pull(state, user, "low", catalog, () => 0);
    const second = A4.Economy.pull(state, user, "low", catalog, () => 0);
    assert.equal(first.relicId, second.relicId);
    assert.notEqual(first.uid, second.uid);
    assert.equal(user.relics.length, 2);
    user.slotCount = 2;
    A4.Game.act(state, user, { type: "equip", uid: first.uid, slot: 1 }, catalog, 0, "TEST_LIVE_1");
    const before = clone(user);
    assert.throws(() => A4.Game.act(state, user, { type: "equip", uid: second.uid, slot: 2 }, catalog, 0, "TEST_LIVE_1"), /중복 장착/);
    assert.deepEqual(user, before);
    A4.Game.act(state, user, { type: "unequip", slot: 1 }, catalog, 0, "TEST_LIVE_1");
    A4.Game.act(state, user, { type: "equip", uid: second.uid, slot: 2 }, catalog, 0, "TEST_LIVE_1");
    assert.deepEqual(user.equipped, [null, second.uid]);
    assert.deepEqual(A4.Economy.passives(user, catalog), []);
});

test("missing pull candidates or incorrect probability totals do not spend gold", () => {
    for (const mode of ["missing", "sum"]) {
        const { catalog, user, state } = setup(), before = clone(user), beforeState = clone(state);
        if (mode === "missing") delete catalog.relics.relic_C;
        else catalog.pulls.low.grades[0].weight = 99;
        assert.throws(() => A4.Economy.pull(state, user, "low", catalog, () => 0.5), /유물이 비어|확률 합계/);
        assert.deepEqual(user, before);
        assert.deepEqual(state, beforeState);
    }
});

test("failed app enhancement rolls back saved resources, RNG, pending confirmation, and disk", () => {
    for (const insufficient of ["gold", "stones"]) {
        const env = appSetup();
        env.store.transact("seed-test-relic", state => {
            const user = state.users[env.uid];
            owned(user, "relic_C");
            if (insufficient === "gold") user.gold = 99;
            else user.items.stones = 0;
        });
        env.send({ type: "enhancePreview", uid: "test-relic-1" });
        const before = env.store.getState(), diskBefore = clone(env.io.files), revision = env.store.getRevision();
        const token = env.user().pendingEnhancement.id;
        assert.throws(() => env.send({ type: "enhanceConfirm", token }), /부족/);
        assert.deepEqual(env.store.getState(), before);
        assert.deepEqual(env.io.files, diskBefore);
        assert.equal(env.store.getRevision(), revision);
        assert.equal(env.store.isBlocked(), false);
        env.store.close();
    }
});

test("failed app pulls and slot expansion leave the entire saved account unchanged", () => {
    for (const action of [{ type: "pull", id: "low" }, { type: "expand" }]) {
        const env = appSetup();
        env.store.transact("insufficient-funds", state => { state.users[env.uid].gold = 0; });
        const before = env.store.getState(), diskBefore = clone(env.io.files);
        assert.throws(() => env.send(action), /부족/);
        assert.deepEqual(env.store.getState(), before);
        assert.deepEqual(env.io.files, diskBefore);
        env.store.close();
    }
});

test("live enhancement updates equipped damage and max HP without replaying healing or start bonuses", () => {
    const { catalog, user, state } = setup();
    catalog.relics.relic_hp.levels.forEach((level, index) => level.effects.push({ type: "startingShield", amount: index + 1 }));
    const hp = owned(user, "relic_hp", 0, "hp"), damage = owned(user, "relic_damage", 0, "damage");
    user.slotCount = 2; user.equipped = [hp.uid, damage.uid];
    A4.Game.act(state, user, { type: "explore" }, catalog, 0, "TEST_LIVE_1");
    A4.Game.act(state, user, { type: "choose", token: user.run.pending.id, index: 1 }, catalog, 0, "TEST_LIVE_1");
    const battle = user.run.battle, enemyPlan = clone(battle.enemyPlan);
    battle.player.hp = 10;
    assert.equal(battle.player.maxHp, 21);
    assert.equal(battle.player.shield, 1);
    A4.Game.act(state, user, { type: "enhance", uid: hp.uid }, catalog, 0, "TEST_LIVE_1");
    assert.equal(battle.player.maxHp, 22);
    assert.equal(battle.player.hp, 10);
    assert.equal(battle.player.shield, 1, "enhancement must not replay the starting shield");
    assert.deepEqual(battle.enemyPlan, enemyPlan);
    A4.Game.act(state, user, { type: "enhance", uid: damage.uid }, catalog, 0, "TEST_LIVE_1");
    assert.equal(battle.player.passives.find(effect => effect.type === "damageBonus").amount, 2);
    battle.player.hp = 22;
    forcedRule(catalog, "S", 1, "down");
    A4.Game.act(state, user, { type: "enhance", uid: hp.uid }, catalog, 0, "TEST_LIVE_1");
    assert.equal(battle.player.maxHp, 21);
    assert.equal(battle.player.hp, 21, "downgrade clamps current HP to the new maximum");
    assert.throws(() => A4.Game.act(state, user, { type: "unequip", slot: 1 }, catalog, 0, "TEST_LIVE_1"), /장착을 변경/);
});


test("active expeditions pause recharge across inventory reads and restart, then forfeit starts a fresh interval", () => {
    const h = appSetup();
    h.send({ type: "explore" }, 100);
    const end = 5 * INTERVAL;
    assert.match(h.send({ type: "inventory" }, end - 1), /탐험 종료 후 충전/);
    assert.equal(h.user().items.keys, 4);
    h.store.close();
    const restored = A4.Store.create(h.io);
    restored.load(A4.newState(2468));
    const app = A4.App.create(restored, h.catalog);
    const send = (action, now) => app.handle({identity:"economic-account",name:"경제 테스트",room:"TEST_LIVE_1",now,action});
    assert.match(send({type:"inventory"}, end), /탐험 종료 후 충전/);
    assert.equal(restored.getState().users[h.uid].items.keys, 4);
    send({type:"forfeit"}, end);
    assert.equal(restored.getState().users[h.uid].keyUpdatedAt, end);
    assert.match(send({type:"inventory"}, end), /\[30:00\]/);
    send({type:"inventory"}, end + INTERVAL - 1);
    assert.equal(restored.getState().users[h.uid].items.keys, 4);
    send({type:"inventory"}, end + INTERVAL);
    assert.equal(restored.getState().users[h.uid].items.keys, 5);
    restored.close();
});
