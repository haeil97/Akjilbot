"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const vm = require("node:vm");
const crypto = require("node:crypto");
const context = vm.createContext({A4: {}, require});
vm.runInContext(fs.readFileSync(path.join(__dirname, "../src/store.js"), "utf8"), context);
const Store = context.A4.Store;
const plain = value => JSON.parse(JSON.stringify(value));
const name = (revision, side) => `revision-${String(revision).padStart(16, "0")}-${side}.json`;

test('transaction timing separates reducer work from both durable saves, including failed saves',()=>{
    let now=0;
    const sandbox=vm.createContext({A4:{},Date:{now:()=>now}});
    vm.runInContext(fs.readFileSync(path.join(__dirname,'../src/store.js'),'utf8'),sandbox);
    const io=memoryIO(),store=sandbox.A4.Store.create(io);store.load({value:0});
    const write=io.writeNewDurable;
    io.writeNewDurable=(key,value)=>{now+=30;write(key,value);};
    store.transact('timed',draft=>{now+=70;draft.value++;});
    assert.deepEqual(plain(store.getTiming()),{processingMs:70,savingMs:60});
    store.resetTiming();assert.deepEqual(plain(store.getTiming()),{processingMs:0,savingMs:0});
    io.writeNewDurable=()=>{now+=40;throw Error('disk failure');};
    assert.throws(()=>store.transact('failed',()=>{now+=10;}),/저장 실패/);
    assert.deepEqual(plain(store.getTiming()),{processingMs:10,savingMs:40});
});

function memoryIO() {
    const files = {};
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

test("SHA-256 matches Node for ASCII, Korean, emoji, and multi-block payloads", () => {
    for (const text of ["", "abc", "한글 🔵 미궁", "abc".repeat(10000)]) {
        assert.equal(Store.sha256(text), crypto.createHash("sha256").update(text).digest("hex"));
    }
});

test("state and result are published only after both durable writes", () => {
    const io = memoryIO(), store = Store.create(io);
    store.load({gold: 50, run: {phase: "rewards", choices: [3, 2, 1]}});
    const original = io.writeNewDurable;
    const seen = [];
    io.writeNewDurable = (key, value) => {
        seen.push(store.getState().gold);
        original(key, value);
    };
    const result = store.transact("settle", draft => { draft.gold += 100; return {reply: "150G"}; });
    assert.deepEqual(seen, [50, 50]);
    assert.deepEqual(plain(result), {state: {gold: 150, run: {phase: "rewards", choices: [3, 2, 1]}}, result: {reply: "150G"}, revision: 1});
    result.state.gold = 999;
    assert.equal(store.getState().gold, 150);
    assert.equal(Store.create(io).load({gold: 0}).gold, 150);
});

test("a reducer exception leaves state and disk unchanged without blocking", () => {
    const io = memoryIO(), store = Store.create(io);
    store.load({gold: 50});
    assert.throws(() => store.transact("bad", draft => { draft.gold = 0; throw new Error("bad reducer"); }), /bad reducer/);
    assert.equal(store.getState().gold, 50);
    assert.equal(store.getRevision(), 0);
    assert.equal(Object.keys(io.files).length, 2);
    assert.equal(store.isBlocked(), false);
});

test("crash before publish leaves old revision and ignores interrupted temp data", () => {
    const io = memoryIO(), store = Store.create(io);
    store.load({gold: 50});
    io.writeNewDurable = () => {
        io.files[".pending-interrupted"] = '{"format":"';
        throw new Error("power loss before rename");
    };
    assert.throws(() => store.transact("settle", draft => { draft.gold += 100; }), error => error.code === "SAVE_BLOCKED");
    assert.equal(store.getState().gold, 50);
    assert.equal(store.isBlocked(), true);
    assert.throws(() => store.transact("retry", () => {}), error => error.code === "SAVE_BLOCKED");
    assert.equal(Store.create(io).load({gold: 0}).gold, 50);
});

test("crash after first publish recovers committed state without replaying rewards", () => {
    const io = memoryIO(), store = Store.create(io);
    store.load({gold: 50, run: {settled: false}});
    const original = io.writeNewDurable;
    io.writeNewDurable = (key, value) => {
        if (key.endsWith("-b.json")) throw new Error("crash while mirroring");
        original(key, value);
    };
    assert.throws(() => store.transact("reward", draft => {
        draft.gold += 100;
        draft.run.settled = true;
    }), error => error.code === "SAVE_BLOCKED");
    assert.equal(store.getState().gold, 50);
    const restart = Store.create(io);
    assert.deepEqual(plain(restart.load({gold: 0})), {gold: 150, run: {settled: true}});
    assert.equal(restart.getRevision(), 1);
    assert.ok(restart.getWarnings().length > 0);
});

test("corrupt primary is recovered from mirror; both corrupt fail closed", () => {
    const io = memoryIO(), store = Store.create(io);
    store.load({gold: 50});
    store.transact("gain", draft => { draft.gold = 100; });
    io.files[name(1, "a")] = "{truncated";
    assert.equal(Store.create(io).load({gold: 0}).gold, 100);
    io.files[name(1, "b")] = "{}";
    const broken = Store.create(io);
    assert.throws(() => broken.load({gold: 0}), error => error.code === "CORRUPT_STORE");
    assert.equal(broken.isBlocked(), true);
    assert.equal(Object.keys(io.files).length, 4);
});

test("valid JSON with modified payload does not pass checksum validation", () => {
    const io = memoryIO();
    Store.create(io).load({gold: 50});
    for (const side of ["a", "b"]) {
        const envelope = JSON.parse(io.files[name(0, side)]);
        envelope.payload = envelope.payload.replace('"gold":50', '"gold":999');
        io.files[name(0, side)] = JSON.stringify(envelope);
    }
    assert.throws(() => Store.create(io).load({gold: 0}), error => error.code === "CORRUPT_STORE");
});

test("conflicting copies with valid checksums fail instead of picking a winner", () => {
    const a = memoryIO(), b = memoryIO();
    Store.create(a).load({gold: 50});
    Store.create(b).load({gold: 100});
    a.files[name(0, "b")] = b.files[name(0, "b")];
    assert.throws(() => Store.create(a).load({gold: 0}), error => error.code === "CONFLICTING_REVISION");
});

test("missing history revisions and mismatched history links fail closed", () => {
    const io = memoryIO(), store = Store.create(io);
    store.load({gold: 0});
    store.transact("one", draft => { draft.gold = 50; });
    store.transact("two", draft => { draft.gold = 100; });
    delete io.files[name(1, "a")];
    delete io.files[name(1, "b")];
    assert.throws(() => Store.create(io).load({gold: 0}), error => error.code === "CORRUPT_STORE");

    const first = memoryIO(), other = memoryIO();
    Store.create(first).load({gold: 0});
    const different = Store.create(other);
    different.load({gold: 50});
    different.transact("one", draft => { draft.gold = 100; });
    first.files[name(1, "a")] = other.files[name(1, "a")];
    first.files[name(1, "b")] = other.files[name(1, "b")];
    assert.throws(() => Store.create(first).load({gold: 0}), error => error.code === "CORRUPT_STORE");
});

test("a high-number orphan temp never creates a committed revision or blocks the next save", () => {
    const io = memoryIO(), first = Store.create(io);
    first.load({gold: 50});
    io.files[".pending-revision-9999999999999999-a.json"] = "partial";
    const restored = Store.create(io);
    restored.load({gold: 0});
    restored.transact("gain", draft => { draft.gold += 50; });
    assert.equal(restored.getRevision(), 1);
    assert.equal(restored.getState().gold, 100);
});

test("startup releases the writer lock on corrupt data or initial write failure", () => {
    for (const corrupt of [true, false]) {
        const io = memoryIO();
        let held = false, releases = 0;
        io.acquireLock = () => {
            if (held) throw new Error("locked");
            held = true;
            return () => { held = false; releases++; };
        };
        if (corrupt) io.files[name(0, "a")] = "broken";
        else io.writeNewDurable = () => { throw new Error("disk full"); };
        const store = Store.create(io);
        assert.throws(() => store.load({gold: 0}));
        assert.equal(held, false);
        assert.equal(releases, 1);
        store.close();
        assert.equal(releases, 1);
    }
});

test("uncertain failure after publishing both mirrors recovers once and releases startup locks", () => {
    const io = memoryIO(), original = io.writeNewDurable;
    io.writeNewDurable = (key, value) => {
        original(key, value);
        if (key.endsWith("-b.json")) throw new Error("directory fsync acknowledgment failed");
    };
    assert.throws(() => Store.create(io).load({gold: 50}), error => error.code === "SAVE_BLOCKED");
    const restart = Store.create(io);
    assert.equal(restart.load({gold: 0}).gold, 50);
    assert.equal(restart.getRevision(), 0);
});

test("stale instance cannot overwrite a newer commit", () => {
    const io = memoryIO(), first = Store.create(io), second = Store.create(io);
    first.load({gold: 0});
    second.load({gold: 0});
    first.transact("first", draft => { draft.gold = 100; });
    assert.throws(() => second.transact("second", draft => { draft.gold = 999; }), error => error.code === "SAVE_BLOCKED" && error.cause.code === "STALE_WRITER");
    assert.equal(Store.create(io).load({gold: 0}).gold, 100);
});

test("nested transactions are rejected before state mutation", () => {
    const io = memoryIO(), store = Store.create(io);
    store.load({gold: 0});
    assert.throws(() => store.transact("outer", draft => {
        draft.gold = 50;
        store.transact("inner", inner => { inner.gold = 100; });
    }), error => error.code === "REENTRANT_TRANSACTION");
    assert.equal(store.getState().gold, 0);
    assert.equal(store.getRevision(), 0);
});

test("Node disk adapter survives restart, preserves backups, and refuses overwrite", t => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "akjilbot4-store-test-"));
    t.after(() => {
        const relative = path.relative(path.resolve(os.tmpdir()), path.resolve(root));
        assert.ok(relative.startsWith("akjilbot4-store-test-") && !relative.includes(path.sep));
        fs.rmSync(root, {recursive: true, force: true});
    });
    const io = Store.nodeIO(root, require), store = Store.create(io);
    store.load({gold: 50, choices: ["화염구", "방어"]});
    store.transact("reward", draft => { draft.gold = 100; });
    store.close();
    const second = Store.create(Store.nodeIO(root, require));
    assert.deepEqual(plain(second.load({})), {gold: 100, choices: ["화염구", "방어"]});
    assert.equal(fs.readdirSync(root).filter(value => value.startsWith("revision-")).length, 4);
    assert.throws(() => io.writeNewDurable(name(1, "a"), "overwrite"), /EEXIST/);
    assert.equal(Store.create(Store.nodeIO(root, require)).load({}).gold, 100);
});

test("fast startup reads only latest and previous snapshot pairs without altering archives", () => {
    const io=memoryIO(),store=Store.create(io);store.load({gold:0});
    for(let i=1;i<=40;i++)store.transact('earn',s=>{s.gold=i;});
    const files=Object.assign({},io.files),read=io.read,reads=[];
    io.read=n=>{reads.push(n);return read(n);};
    const recovered=Store.create(io,{latestSnapshotOnly:true});
    assert.equal(recovered.load({gold:0}).gold,40);
    assert.equal(reads.length,4);assert.ok(reads.every(n=>n.includes('0000000000000040')||n.includes('0000000000000039')));
    assert.deepEqual(io.files,files);
    recovered.transact('next',s=>{s.gold++;});assert.equal(Store.create(io).load({}).gold,41);
});
test("fast startup recovers a single surviving latest copy and rejects corruption without rollback",()=>{
    const io=memoryIO(),store=Store.create(io);store.load({gold:0});store.transact('earn',s=>{s.gold=100;});
    io.files[name(1,'a')]='broken';
    assert.equal(Store.create(io,{latestSnapshotOnly:true}).load({gold:0}).gold,100);
    io.files[name(1,'b')]='broken';
    assert.throws(()=>Store.create(io,{latestSnapshotOnly:true}).load({gold:0}),/유효한 사본/);
});
test("fast startup still rejects mismatched latest links and missing revisions",()=>{
    const io=memoryIO(),store=Store.create(io);store.load({gold:0});store.transact('earn',s=>{s.gold=1;});
    const envelope=JSON.parse(io.files[name(1,'a')]),body=JSON.parse(envelope.payload);body.previous='wrong';
    envelope.payload=JSON.stringify(body);envelope.checksum=Store.sha256(envelope.payload);
    io.files[name(1,'a')]=io.files[name(1,'b')]=JSON.stringify(envelope);
    assert.throws(()=>Store.create(io,{latestSnapshotOnly:true}).load({}),/연결/);
    delete io.files[name(0,'a')];delete io.files[name(0,'b')];
    assert.throws(()=>Store.create(io,{latestSnapshotOnly:true}).load({}),/누락/);
});

test("selectors isolate returned data and result-only transactions do not expose committed state",()=>{
    const io=memoryIO(),store=Store.create(io);store.load({users:{one:{gold:1}}});
    const selected=store.select(s=>s.users.one);selected.gold=999;
    assert.equal(store.select(s=>s.users.one.gold),1);
    let retained;const result=store.transact('change',s=>{retained=s;s.users.one.gold=2;return {ok:true};},{resultOnly:true});
    assert.equal(Object.hasOwn(result,'state'),false);retained.users.one.gold=500;
    assert.equal(store.getState().users.one.gold,2);assert.deepEqual(plain(result.result),{ok:true});
});
test("exclusive adapter avoids archive reads on commit but still rejects duplicate revision publication",()=>{
    const io=memoryIO();let locked=false;
    io.acquireLock=()=>{assert.equal(locked,false);locked=true;return ()=>{locked=false;};};
    io.hasExclusiveLock=()=>locked;
    let hashes=0;io.sha256=text=>{hashes++;return crypto.createHash('sha256').update(text).digest('hex');};
    const store=Store.create(io);store.load({gold:1});
    let reads=0,lists=0;const read=io.read,list=io.list;
    io.read=n=>{reads++;return read(n);};io.list=()=>{lists++;return list();};
    store.transact('earn',s=>{s.gold++;},{resultOnly:true});
    assert.equal(reads,0);assert.equal(lists,0);assert.ok(hashes>0);
    io.files[name(2,'a')]='another writer';
    assert.throws(()=>store.transact('blocked',s=>{s.gold++;}),e=>e.code==='SAVE_BLOCKED');
    assert.equal(store.getState().gold,2);store.close();assert.equal(locked,false);
});
