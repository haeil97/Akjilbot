/* Akjilbot 4 durable store. ES5; this file is concatenated inside the A4 scope.
 * Every committed revision is a complete snapshot, stored twice. Old revisions
 * are deliberately retained as backups. Never replace a failed save with an
 * empty state. Adapters must publish new files atomically, without overwrite.
 */
(function () {
    "use strict";
    var FORMAT = "akjilbot4.snapshot.v1";
    var FILE_RE = /^revision-(\d{16})-([ab])\.json$/;

    function fail(code, message, cause) {
        var error = new Error(message);
        error.code = code;
        if (cause) error.cause = cause;
        return error;
    }

    function clone(value) {
        var encoded = JSON.stringify(value);
        if (typeof encoded !== "string") throw fail("INVALID_JSON", "저장할 값이 JSON이 아닙니다.");
        return JSON.parse(encoded);
    }

    /* SHA-256 over UTF-8. Hash the exact payload string, not a reserialized map. */
    function sha256(value) {
        var bytes = unescape(encodeURIComponent(value));
        var words = [], length = bytes.length, i, j, t, a, b, c, d, e, f, g, h;
        var w = [], out = [], H = [1779033703, 3144134277, 1013904242, 2773480762,
            1359893119, 2600822924, 528734635, 1541459225];
        var K = [1116352408,1899447441,3049323471,3921009573,961987163,1508970993,2453635748,2870763221,
            3624381080,310598401,607225278,1426881987,1925078388,2162078206,2614888103,3248222580,
            3835390401,4022224774,264347078,604807628,770255983,1249150122,1555081692,1996064986,
            2554220882,2821834349,2952996808,3210313671,3336571891,3584528711,113926993,338241895,
            666307205,773529912,1294757372,1396182291,1695183700,1986661051,2177026350,2456956037,
            2730485921,2820302411,3259730800,3345764771,3516065817,3600352804,4094571909,275423344,
            430227734,506948616,659060556,883997877,958139571,1322822218,1537002063,1747873779,
            1955562222,2024104815,2227730452,2361852424,2428436474,2756734187,3204031479,3329325298];
        function rotate(x, n) { return (x >>> n) | (x << (32 - n)); }
        for (i = 0; i < length; i++) words[i >> 2] = (words[i >> 2] || 0) | bytes.charCodeAt(i) << (24 - (i % 4) * 8);
        words[length >> 2] = (words[length >> 2] || 0) | 128 << (24 - (length % 4) * 8);
        var end = (((length + 8) >> 6) + 1) * 16;
        words[end - 2] = Math.floor(length / 536870912);
        words[end - 1] = (length * 8) | 0;
        for (i = 0; i < end; i += 16) {
            a=H[0]; b=H[1]; c=H[2]; d=H[3]; e=H[4]; f=H[5]; g=H[6]; h=H[7];
            for (j = 0; j < 64; j++) {
                if (j < 16) w[j] = words[i + j] | 0;
                else {
                    var x = w[j - 15], y = w[j - 2];
                    w[j] = (w[j - 16] + (rotate(x,7)^rotate(x,18)^(x>>>3)) + w[j - 7] + (rotate(y,17)^rotate(y,19)^(y>>>10))) | 0;
                }
                t = (h + (rotate(e,6)^rotate(e,11)^rotate(e,25)) + ((e&f)^((~e)&g)) + K[j] + w[j]) | 0;
                var t2 = ((rotate(a,2)^rotate(a,13)^rotate(a,22))+((a&b)^(a&c)^(b&c))) | 0;
                h=g; g=f; f=e; e=(d+t)|0; d=c; c=b; b=a;
                a=(t+t2)|0;
            }
            H[0]=(H[0]+a)|0; H[1]=(H[1]+b)|0; H[2]=(H[2]+c)|0; H[3]=(H[3]+d)|0;
            H[4]=(H[4]+e)|0; H[5]=(H[5]+f)|0; H[6]=(H[6]+g)|0; H[7]=(H[7]+h)|0;
        }
        for (i = 0; i < 8; i++) out.push(("00000000" + (H[i] >>> 0).toString(16)).slice(-8));
        return out.join("");
    }

    function fileName(revision, side) {
        return "revision-" + ("0000000000000000" + revision).slice(-16) + "-" + side + ".json";
    }

    function encode(revision, previous, label, state, result, digestFn) {
        var payload = JSON.stringify({revision: revision, previous: previous, label: String(label), state: state, result: result});
        var digest = (digestFn || sha256)(payload);
        return {checksum: digest, text: JSON.stringify({format: FORMAT, checksum: digest, payload: payload})};
    }

    function decode(text, revision, digestFn) {
        var envelope = JSON.parse(text);
        if (!envelope || envelope.format !== FORMAT || typeof envelope.payload !== "string" || (digestFn || sha256)(envelope.payload) !== envelope.checksum) {
            throw fail("CORRUPT_STORE", "저장 파일의 체크섬이 일치하지 않습니다.");
        }
        var body = JSON.parse(envelope.payload);
        if (!body || body.revision !== revision || !Object.prototype.hasOwnProperty.call(body, "state") ||
                (revision === 0 ? body.previous !== null : typeof body.previous !== "string")) {
            throw fail("CORRUPT_STORE", "저장 파일의 버전 또는 내용이 잘못되었습니다.");
        }
        return {body: body, checksum: envelope.checksum};
    }

    function create(io, options) {
        options = options || {};
        var state, revision = -1, checksum = null, loaded = false, blocked = false, closed = false, busy = false;
        var warnings = [], release = null, timing = {processingMs:0,savingMs:0};

        function readIndex() {
            var names = io.list(), index = {}, revisions = [], i, match, number;
            for (i = 0; i < names.length; i++) {
                match = FILE_RE.exec(String(names[i]));
                if (!match) continue; /* .pending files have never been committed. */
                number = Number(match[1]);
                if (number > 9007199254740991) throw fail("CORRUPT_STORE", "저장 버전 범위를 초과했습니다.");
                if (!index[number]) { index[number] = {}; revisions.push(number); }
                index[number][match[2]] = String(names[i]);
            }
            revisions.sort(function (a,b) { return a-b; });
            return {index: index, revisions: revisions};
        }

        function readPair(number, pair, reportWarnings) {
            var candidates = [], sides = ["a", "b"], i, name;
            for (i = 0; i < sides.length; i++) {
                name = pair[sides[i]];
                if (!name) continue;
                var raw = io.read(name); /* I/O errors must not masquerade as corruption or absence. */
                try { candidates.push(decode(raw, number, io.sha256)); }
                catch (error) { if (reportWarnings) warnings.push("손상된 사본: " + name); }
            }
            if (!candidates.length) throw fail("CORRUPT_STORE", "버전 " + number + "의 유효한 사본이 없습니다. 데이터를 초기화하지 않았습니다.");
            if (candidates.length === 2 && candidates[0].checksum !== candidates[1].checksum) {
                throw fail("CONFLICTING_REVISION", "같은 버전에 서로 다른 저장 내용이 존재합니다: " + number);
            }
            if (reportWarnings && candidates.length < 2) warnings.push("버전 " + number + "을 남아 있는 사본에서 복구했습니다.");
            return candidates[0];
        }

        function recover() {
            var found = readIndex(), previous = null, last = null, i, number;
            if (options.latestSnapshotOnly && found.revisions.length) {
                // Every revision contains the complete state. Do not deserialize
                // the entire archive on Android startup; keep full audit mode available.
                for (i = 0; i < found.revisions.length; i++) {
                    if (found.revisions[i] !== i) throw fail("CORRUPT_STORE", "저장 이력에 누락된 버전이 있습니다. 데이터를 초기화하지 않았습니다.");
                }
                number = found.revisions[found.revisions.length - 1];
                last = readPair(number, found.index[number], true);
                if (number > 0) {
                    previous = readPair(number - 1, found.index[number - 1], true);
                    if (last.body.previous !== previous.checksum) throw fail("CORRUPT_STORE", "저장 이력의 연결이 손상되었습니다.");
                }
                return last;
            }
            for (i = 0; i < found.revisions.length; i++) {
                number = found.revisions[i];
                if (number !== i) throw fail("CORRUPT_STORE", "저장 이력에 누락된 버전이 있습니다. 데이터를 초기화하지 않았습니다.");
                last = readPair(number, found.index[number], true);
                if (last.body.previous !== previous) throw fail("CORRUPT_STORE", "저장 이력의 연결이 손상되었습니다.");
                previous = last.checksum;
            }
            return last;
        }

        function assertUnchanged() {
            // The Android adapter holds an OS writer lock for the entire lifetime.
            // Atomic publish still rejects an existing target revision.
            if (release && io.hasExclusiveLock && io.hasExclusiveLock()) return;
            var found = readIndex(), latest = found.revisions.length ? found.revisions[found.revisions.length - 1] : -1;
            if (latest !== revision) throw fail("STALE_WRITER", "다른 실행 인스턴스가 저장소를 변경했습니다. 재시작이 필요합니다.");
            if (latest >= 0 && readPair(latest, found.index[latest], false).checksum !== checksum) {
                throw fail("STALE_WRITER", "현재 저장 버전이 메모리와 다릅니다. 재시작이 필요합니다.");
            }
        }

        function commit(label, next, result, resultOnly) {
            var nextRevision = revision + 1, record = encode(nextRevision, checksum, label, next, result, io.sha256);
            try {
                assertUnchanged();
                /* The first atomic publish is the commit point. If the mirror
                 * fails, recovery still sees this commit, but the live instance
                 * blocks without returning a success message. Never retry here. */
                io.writeNewDurable(fileName(nextRevision, "a"), record.text);
                io.writeNewDurable(fileName(nextRevision, "b"), record.text);
            } catch (error) {
                blocked = true;
                throw fail("SAVE_BLOCKED", "저장 실패로 변경을 중단했습니다. 일부 변경은 이미 저장됐을 수 있으므로 재시작 후 확인해야 합니다.", error);
            }
            state = next;
            revision = nextRevision;
            checksum = record.checksum;
            return resultOnly ? {result: clone(result), revision: revision} : {state: clone(state), result: clone(result), revision: revision};
        }

        function ready() {
            if (closed) throw fail("STORE_CLOSED", "저장소가 닫혔습니다.");
            if (blocked) throw fail("SAVE_BLOCKED", "저장 오류가 발생했습니다. 재시작 전에는 변경할 수 없습니다.");
            if (!loaded) throw fail("STORE_NOT_LOADED", "먼저 저장소를 불러와야 합니다.");
        }

        return {
            load: function (initialState) {
                if (closed || loaded || blocked) throw fail("INVALID_LOAD", "새 저장소 인스턴스에서 한 번만 불러올 수 있습니다.");
                try {
                    if (io.acquireLock) release = io.acquireLock();
                    var restored = recover();
                    if (restored) {
                        state = clone(restored.body.state);
                        revision = restored.body.revision;
                        checksum = restored.checksum;
                    } else commit("initialize", clone(initialState), null);
                    loaded = true;
                    return clone(state);
                } catch (error) {
                    blocked = true;
                    /* A failed startup must not leave an OS lock held. The
                     * original read/save failure remains the reported error. */
                    if (release) {
                        var unlock = release;
                        release = null;
                        try { unlock(); } catch (closeError) { error.closeError = closeError; }
                    }
                    throw error;
                }
            },
            transact: function (label, reducer, transactionOptions) {
                ready();
                if (busy) throw fail("REENTRANT_TRANSACTION", "중첩 저장 트랜잭션은 허용되지 않습니다.");
                busy = true;
                var started=Date.now(),savingAt=null;
                timing={processingMs:0,savingMs:0};
                try {
                    var draft = clone(state), result = reducer(draft);
                    if (typeof result === "undefined") result = null;
                    /* Serialization failures/reducer exceptions occur before disk writes. */
                    draft = clone(draft); result = clone(result);
                    savingAt=Date.now();timing.processingMs=savingAt-started;
                    return commit(label, draft, result, transactionOptions && transactionOptions.resultOnly);
                } finally { if(savingAt!==null)timing.savingMs=Date.now()-savingAt;else timing.processingMs=Date.now()-started;busy = false; }
            },
            getTiming: function () { return {processingMs:timing.processingMs,savingMs:timing.savingMs}; },
            resetTiming: function () { timing={processingMs:0,savingMs:0}; },
            getState: function () { if (!loaded) throw fail("STORE_NOT_LOADED", "저장소가 아직 로드되지 않았습니다."); return clone(state); },
            // Internal read-only selectors must not mutate state; their return value
            // is copied so callers can never modify committed objects afterwards.
            select: function (selector) { ready(); return clone(selector(state)); },
            getRevision: function () { return revision; },
            getWarnings: function () { return warnings.slice(); },
            isBlocked: function () { return blocked; },
            close: function () {
                closed = true;
                if (release) { var unlock = release; release = null; unlock(); }
            }
        };
    }

    function safeName(name) {
        if (!/^[A-Za-z0-9._-]+$/.test(name)) throw fail("INVALID_PATH", "잘못된 저장 파일 이름입니다.");
        return name;
    }

    function nodeIO(basePath, requireFn) {
        var req = requireFn || (typeof require === "function" ? require : null);
        if (!req) throw fail("NO_NODE", "Node require 함수를 전달해야 합니다.");
        var fs = req("fs"), path = req("path"), proc = req("process"), root = path.resolve(basePath), sequence = 0;
        function directorySync(directory) {
            var fd;
            try { fd = fs.openSync(directory || root, "r"); fs.fsyncSync(fd); }
            catch (error) {
                /* Windows does not expose directory fsync through Node. Files
                 * are still fsynced and published atomically with hard links. */
                if (!(proc.platform === "win32" && ["EPERM","EISDIR","EINVAL","EACCES"].indexOf(error.code) >= 0)) throw error;
            } finally { if (typeof fd === "number") fs.closeSync(fd); }
        }
        /* fsync'ing a new folder alone does not persist its entry in its parent.
         * Create missing ancestors individually and persist every parent entry. */
        var missing = [], cursor = root, parent, directory;
        while (!fs.existsSync(cursor)) {
            missing.push(cursor); parent = path.dirname(cursor);
            if (parent === cursor) throw fail("CREATE_DIRECTORY_FAILED", "저장 폴더 상위 경로가 없습니다.");
            cursor = parent;
        }
        if (!fs.statSync(cursor).isDirectory()) throw fail("CREATE_DIRECTORY_FAILED", "저장 경로가 폴더가 아닙니다.");
        while (missing.length) {
            directory = missing.pop();
            try { fs.mkdirSync(directory); }
            catch (error) { if (error.code !== "EEXIST" || !fs.statSync(directory).isDirectory()) throw error; }
            directorySync(path.dirname(directory));
        }
        directorySync(root);
        return {
            list: function () { return fs.readdirSync(root); },
            read: function (name) { return fs.readFileSync(path.join(root, safeName(name)), "utf8"); },
            writeNewDurable: function (name, content) {
                var target = path.join(root, safeName(name));
                var temp = path.join(root, ".pending-" + proc.pid + "-" + Date.now() + "-" + (++sequence) + "-" + Math.random().toString(16).slice(2));
                var fd, published = false;
                try {
                    fd = fs.openSync(temp, "wx");
                    fs.writeFileSync(fd, content, "utf8");
                    fs.fsyncSync(fd);
                    fs.closeSync(fd); fd = undefined;
                    /* link() cannot replace an existing revision; concurrent
                     * writers cannot both commit the same version. */
                    fs.linkSync(temp, target); published = true;
                    directorySync();
                } finally {
                    if (typeof fd === "number") fs.closeSync(fd);
                    if (published) { fs.unlinkSync(temp); directorySync(); }
                    /* Unpublished .pending files are harmless crash evidence. */
                }
            },
            durability: proc.platform === "win32" ? "file-fsync+atomic-no-replace (directory fsync unavailable on Windows)" : "file-fsync+directory-fsync+atomic-no-replace"
        };
    }

    function javaIO(basePath) {
        if (typeof java === "undefined") throw fail("NO_JAVA", "Android Java 실행 환경이 필요합니다.");
        var root = new java.io.File(String(basePath)).getCanonicalFile();
        var ownsLock = false, activeLock = null;
        function file(name) { return new java.io.File(root, safeName(name)); }
        function directorySync(directory) {
            var Os = Packages.android.system.Os, constants = Packages.android.system.OsConstants, descriptor = null;
            try {
                descriptor = Os.open(String((directory || root).getAbsolutePath()), constants.O_RDONLY | constants.O_DIRECTORY, 0);
                Os.fsync(descriptor);
            } finally { if (descriptor !== null) Os.close(descriptor); }
        }
        var missing = [], cursor = root, directory;
        while (cursor !== null && !cursor.exists()) { missing.push(cursor); cursor = cursor.getParentFile(); }
        if (cursor === null || !cursor.isDirectory()) throw fail("CREATE_DIRECTORY_FAILED", "저장 경로가 폴더가 아닙니다.");
        while (missing.length) {
            directory = missing.pop();
            if (!directory.mkdir() && !directory.isDirectory()) throw fail("CREATE_DIRECTORY_FAILED", "저장 폴더를 만들 수 없습니다.");
            directorySync(directory.getParentFile());
        }
        /* Do not silently weaken durability on Android filesystems that reject
         * directory fsync. Startup fails with the actual platform error. */
        directorySync(root);
        return {
            sha256: function (value) {
                var digest = java.security.MessageDigest.getInstance("SHA-256");
                var bytes = digest.digest(new java.lang.String(String(value)).getBytes("UTF-8")), hex = [], i;
                for(i=0;i<bytes.length;i++)hex.push(("0"+(bytes[i]&255).toString(16)).slice(-2));
                return hex.join("");
            },
            hasExclusiveLock: function () { return ownsLock && activeLock !== null && activeLock.isValid(); },
            acquireLock: function () {
                var handle = new java.io.RandomAccessFile(file(".writer.lock"), "rw"), channel = handle.getChannel(), lock;
                try {
                    lock = channel.tryLock();
                    if (lock === null) throw fail("STORE_LOCKED", "다른 봇 실행 인스턴스가 저장소를 사용 중입니다.");
                    ownsLock = true; activeLock = lock;
                } catch (error) { try { channel.close(); } finally { handle.close(); } throw error; }
                return function () { ownsLock = false; activeLock = null; try { lock.release(); } finally { try { channel.close(); } finally { handle.close(); } } };
            },
            list: function () {
                var names = root.list(), output = [], i;
                if (names === null) throw fail("READ_DIRECTORY_FAILED", "저장 폴더를 읽을 수 없습니다.");
                for (i = 0; i < names.length; i++) output.push(String(names[i]));
                return output;
            },
            read: function (name) {
                var reader = new java.io.InputStreamReader(new java.io.FileInputStream(file(name)), "UTF-8");
                var buffer = java.lang.reflect.Array.newInstance(java.lang.Character.TYPE, 8192), count;
                var output = new java.lang.StringBuilder();
                try { while ((count = reader.read(buffer)) !== -1) output.append(buffer, 0, count); }
                finally { reader.close(); }
                return String(output.toString());
            },
            writeNewDurable: function (name, content) {
                if (!ownsLock) throw fail("STORE_LOCKED", "저장소 잠금이 없습니다.");
                var target = file(name), temp = java.io.File.createTempFile(".pending-", ".json", root);
                var stream = new java.io.FileOutputStream(temp), writer = new java.io.OutputStreamWriter(stream, "UTF-8");
                try { writer.write(String(content)); writer.flush(); stream.getFD().sync(); }
                finally { try { writer.close(); } finally { stream.close(); } }
                if (target.exists()) throw fail("STALE_WRITER", "저장 버전이 이미 존재합니다.");
                /* The lifetime FileChannel lock makes rename's existence check
                 * safe. There is deliberately no direct-write fallback. */
                if (!temp.renameTo(target)) throw fail("ATOMIC_PUBLISH_FAILED", "저장 파일 이름 변경에 실패했습니다.");
                directorySync();
            },
            durability: "file-fsync+directory-fsync+exclusive-filechannel-lock"
        };
    }

    A4.Store = {create: create, nodeIO: nodeIO, javaIO: javaIO, sha256: sha256};
}());
