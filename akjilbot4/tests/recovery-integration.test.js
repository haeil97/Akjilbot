"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const A4 = require("../../악질봇4.0.0.js");
const makeCatalog = require("./fixtures.js");

const copy = value => JSON.parse(JSON.stringify(value));
const IDENTITY = "stable-test-user";
const NOW = 1800000000000;

function memoryIO(existing) {
    const files = copy(existing || {});
    return {
        files,
        list: () => Object.keys(files),
        read: key => {
            if (!Object.hasOwn(files, key)) throw new Error("missing file");
            return files[key];
        },
        writeNewDurable: (key, value) => {
            if (Object.hasOwn(files, key)) throw new Error("EEXIST");
            files[key] = value;
        }
    };
}

function open(io, catalog) {
    const store = A4.Store.create(io);
    store.load(A4.newState(123456789));
    return {io, catalog, store, app: A4.App.create(store, catalog)};
}

function fresh(catalog = makeCatalog(A4)) {
    return open(memoryIO(), catalog);
}

let eventSequence = 0;
function request(text, extra) {
    return Object.assign({
        identity: IDENTITY,
        name: "복구 시험 사용자",
        room: "TEST_LIVE_1",
        now: NOW,
        eventId: "recovery-test-event-" + (++eventSequence),
        text
    }, extra || {});
}

function user(harness) {
    const state = harness.store.getState();
    return state.users[state.identities["identity:" + IDENTITY]];
}

function beginBattle(harness) {
    harness.app.handle(request("+탐험"));
    harness.app.handle(request("+선택 " + user(harness).run.pending.id + " 1"));
    assert.equal(user(harness).run.phase, "BATTLE");
}

function attackCommand(harness) {
    const run = user(harness).run;
    const index = run.battle.player.hand.findIndex(card => {
        const definition = A4.Combat.describeCard(card, harness.catalog);
        return definition.cost <= run.battle.player.mana && definition.effects.some(effect => effect.type === "damage" && effect.amount > 0);
    });
    return "+제출 " + run.turnToken + " " + (index >= 0 ? index + 1 : "s");
}

/* Compare a faulted commit with an identical uninterrupted branch, including
 * RNG state, all card zones, frozen enemy intent, choices, rewards and receipt.
 * The first snapshot publication succeeds; its mirror write is interrupted.
 */
function interruptMirror(harness, command) {
    const before = harness.store.getState();
    const baseline = open(memoryIO(harness.io.files), harness.catalog);
    const expectedReply = baseline.app.handle(command);
    const expected = baseline.store.getState();
    const failing = open(memoryIO(harness.io.files), harness.catalog);
    const write = failing.io.writeNewDurable;
    failing.io.writeNewDurable = (key, value) => {
        if (key.endsWith("-b.json")) throw new Error("simulated shutdown before mirror publish");
        write(key, value);
    };
    assert.throws(() => failing.app.handle(command), error => error.code === "SAVE_BLOCKED");
    assert.deepEqual(failing.store.getState(), before, "uncertain commit must not publish memory or a success reply");
    assert.equal(failing.store.isBlocked(), true);
    failing.io.writeNewDurable = write;
    failing.store.close();
    const recovered = open(failing.io, harness.catalog);
    assert.deepEqual(recovered.store.getState(), expected, "restart must recover the complete durable game transition");
    assert.equal(recovered.app.handle(command), expectedReply, "redelivered event must replay its persisted response");
    assert.deepEqual(recovered.store.getState(), expected, "receipt replay must not reroll or apply rewards twice");
    return {recovered, expected, reply: expectedReply};
}

test("new run interrupted before first publish does not consume a key or register a partial account", () => {
    const harness = fresh(), before = harness.store.getState(), command = request("+탐험");
    const baseline = open(memoryIO(harness.io.files), harness.catalog);
    const expectedReply = baseline.app.handle(command);
    const write = harness.io.writeNewDurable;
    harness.io.writeNewDurable = () => {
        harness.io.files[".pending-9999999999999999"] = '{"format":';
        throw new Error("shutdown before atomic publication");
    };
    assert.throws(() => harness.app.handle(command), error => error.code === "SAVE_BLOCKED");
    harness.io.writeNewDurable = write;
    const recovered = open(harness.io, harness.catalog);
    assert.deepEqual(recovered.store.getState(), before);
    assert.equal(recovered.app.handle(command), expectedReply);
    assert.deepEqual(recovered.store.getState(), baseline.store.getState());
    assert.equal(user(recovered).items.keys, 4);
    assert.equal(user(recovered).run.phase, "HERO");
});

test("starter choice interrupted after commit restores opening hand, enemy plan and exact turn token", () => {
    const harness = fresh();
    harness.app.handle(request("+탐험"));
    const command = request("+선택 " + user(harness).run.pending.id + " 1");
    const {recovered, expected} = interruptMirror(harness, command);
    const run = user(recovered).run;
    assert.equal(run.phase, "BATTLE");
    assert.equal(run.battle.turn, 0);
    assert.equal(run.battle.player.hand.length, 4);
    assert.equal(run.battle.enemyPlanTurn, 0);
    const plan = copy(run.battle.enemyPlan), token = run.turnToken, rng = expected.rngState;
    recovered.app.handle(request("+탐험", {room: "TEST_LIVE_2", now: NOW + 5 * 60000}));
    assert.deepEqual(user(recovered).run.battle.enemyPlan, plan);
    assert.equal(user(recovered).run.turnToken, token);
    assert.equal(recovered.store.getState().rngState, rng);
});

test("ongoing battle submit interrupted after commit restores card zones and next precommitted enemy action", () => {
    const catalog = makeCatalog(A4);
    catalog.enemies.enemy1.maxHp = 100;
    catalog.enemies.enemy1.cards = ["fire", "ice", "shield", "physical"];
    const harness = fresh(catalog);
    beginBattle(harness);
    const oldToken = user(harness).run.turnToken;
    const {recovered} = interruptMirror(harness, request(attackCommand(harness)));
    const run = user(recovered).run;
    assert.equal(run.phase, "BATTLE");
    assert.equal(run.battle.turn, 0);
    assert.equal(run.battle.phase, 'MAIN2');
    assert.equal(run.battle.enemyPlanTurn, 0);
    assert.notEqual(run.turnToken, oldToken);
    assert.equal(run.battle.player.hand.length + run.battle.player.deck.length + run.battle.player.rest.length + run.battle.player.excluded.length, 4);
    assert.throws(() => recovered.app.handle(request("+제출 " + oldToken + " s")), /이미 처리되었거나 이전 턴/);
});

test("winning submit interrupted after commit keeps first treasure options and does not pay early", () => {
    const harness = fresh();
    beginBattle(harness);
    const goldBefore = user(harness).gold;
    const {recovered} = interruptMirror(harness, request(attackCommand(harness)));
    const account = user(recovered);
    assert.equal(account.run.wins, 1);
    assert.equal(account.run.phase, "REWARD");
    assert.equal(account.run.pending.kind, "treasure");
    assert.equal(new Set(account.run.pending.options).size, 3);
    assert.equal(account.gold, goldBefore);
    assert.equal(account.run.battle, null);
});

test("reward selection interrupted after commit preserves acquired treasure and next random card offer", () => {
    const harness = fresh();
    beginBattle(harness);
    harness.app.handle(request(attackCommand(harness)));
    const offered = user(harness).run.pending;
    const index = offered.options.indexOf("low_card") + 1;
    assert.ok(index > 0);
    const {recovered} = interruptMirror(harness, request("+선택 " + offered.id + " " + index));
    const run = user(recovered).run;
    assert.equal(run.treasures.low, "low_card");
    assert.equal(run.deck.filter(card => card.treasureSlot === "low").length, 1);
    assert.equal(run.pending.kind, "add");
    assert.equal(new Set(run.pending.options).size, 4);
    assert.throws(() => recovered.app.handle(request("+선택 " + offered.id + " " + index)), /이미 처리되었거나 이전 화면/);
});

test("eight-win settlement interrupted after commit restores the exact random payout once", () => {
    const harness = fresh();
    beginBattle(harness);
    let guard = 0;
    while (!(user(harness).run.phase === "BATTLE" && user(harness).run.wins === 7)) {
        assert.ok(++guard < 200, "fixture exploration should reach final encounter");
        const run = user(harness).run;
        if (run.phase === "BATTLE") harness.app.handle(request(attackCommand(harness)));
        else if (run.phase === "REWARD") harness.app.handle(request("+선택 " + run.pending.id + " 1"));
        else if (run.phase === "READY") harness.app.handle(request("+탐험"));
        else assert.fail("unexpected phase " + run.phase);
    }
    /* A harmless card-only opening may need a draw before the winning move. */
    while (attackCommand(harness).endsWith(" s")) harness.app.handle(request(attackCommand(harness)));
    const before = user(harness);
    const {recovered} = interruptMirror(harness, request(attackCommand(harness)));
    const after = user(recovered), reward = after.lastRun.reward;
    assert.equal(after.run, null);
    assert.equal(after.lastRun.reason, "clear");
    assert.equal(after.lastRun.wins, 8);
    assert.equal(after.gold, before.gold + reward.gold);
    assert.ok(reward.gold >= 1000 && reward.gold <= 1500 && reward.gold % 50 === 0);
    assert.equal(after.items.keys, before.items.keys + 1);
    assert.equal(after.items.stones, before.items.stones + reward.stones);
    assert.equal(after.items.essence, before.items.essence + reward.essence);
    assert.throws(() => recovered.app.handle(request("gg")), /진행 중인 탐험이 없습니다/);
});

test("a transport reply failure leaves a committed purchase intact and its event can replay after restart", () => {
    const harness = fresh();
    harness.app.handle(request("+인벤"));
    const before = user(harness), command = request("+뽑기 low");
    const response = harness.app.handle(command);
    assert.throws(() => { throw new Error("chat transport disconnected while sending " + response); }, /chat transport/);
    const committed = harness.store.getState();
    const recovered = open(harness.io, harness.catalog);
    assert.equal(recovered.app.handle(command), response);
    assert.deepEqual(recovered.store.getState(), committed);
    assert.equal(user(recovered).gold, before.gold - harness.catalog.pulls.low.gold);
    assert.equal(user(recovered).relics.length, before.relics.length + 1);
});

test("checksummed state with dangling identity mapping is rejected without creating or replacing an account", () => {
    const io = memoryIO(), store = A4.Store.create(io), damaged = A4.newState(123);
    damaged.identities["identity:" + IDENTITY] = "user-missing";
    store.load(damaged);
    const filesBefore = copy(io.files);
    assert.throws(() => A4.App.create(store, makeCatalog(A4)), /저장 데이터 검증 실패.*계정 매핑 대상 누락/);
    assert.deepEqual(store.getState(), damaged);
    assert.deepEqual(io.files, filesBefore);
});
