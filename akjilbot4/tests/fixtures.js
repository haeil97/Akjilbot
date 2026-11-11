"use strict";

/* Synthetic test fixtures only. These names, values, room names, probabilities,
 * and destruction policy are NOT approved 4.0.0 content or production defaults.
 * The production catalog remains empty and disabled; each call returns a copy.
 */
function makeCatalog(A4) {
    var catalog = JSON.parse(JSON.stringify(A4.catalog)), i, grade;
    var grades = ["C", "B", "A", "S", "SS"];
    function attack(name, element, cost) {
        return {
            name: "[TEST] " + name,
            element: element,
            cost: cost,
            effects: [{ type: "damage", amount: 1 }],
            upgrade: { effects: [{ type: "damage", amount: 2 }] }
        };
    }
    function emptyLevels() {
        var list = [], level;
        for (level = 0; level <= 5; level++) list.push({ effects: [] });
        return list;
    }
    function scalingLevels(type) {
        var list = [], level;
        for (level = 0; level <= 5; level++) list.push({ effects: [{ type: type, amount: level + 1 }] });
        return list;
    }

    catalog.config.enabled = true;
    catalog.config.engineVersion = 2;
    catalog.config.relicsEnabled = true;
    catalog.config.shopEnabled = true;
    catalog.config.dataPath = "TEST_ONLY_DO_NOT_DEPLOY";
    catalog.config.rooms = {
        live: ["TEST_LIVE_1", "TEST_LIVE_2"],
        test: ["TEST_ROOM_1", "TEST_ROOM_2", "TEST_ROOM_3"]
    };
    catalog.config.initialInventory = { gold: 10000, keys: 5, stones: 100, essence: 0 };
    catalog.config.sessionTimeoutMs = 60000;
    catalog.config.playerMaxHpByStage = [20,20,20,20,20,20,20,20];
    catalog.config.equippedDestruction = "unequip";

    catalog.cards = {
        fire: attack("화염 시험 카드", "FIRE", 0),
        ice: attack("냉기 시험 카드", "ICE", 1),
        physical: attack("자연 시험 카드", "NATURE", 0),
        lightning: attack("전기 시험 카드", "LIGHTNING", 1),
        draw: {
            name: "[TEST] 드로우 시험 카드", element: "NEUTRAL", cost: 0,
            effects: [{ type: "draw", amount: 1 }],
            upgrade: { effects: [{ type: "draw", amount: 2 }] }
        },
        shield: {
            name: "[TEST] 보호막 시험 카드", element: "NEUTRAL", cost: 1,
            effects: [{ type: "shield", amount: 1 }],
            upgrade: { effects: [{ type: "shield", amount: 2 }] }
        },
        harmless: {
            name: "[TEST] 상대의 무효과 카드", element: "NEUTRAL", cost: 0,
            effects: [], upgrade: { effects: [] }
        },
        treasure_low: {
            name: "[TEST] 하급 카드형 보물", element: "NEUTRAL", cost: 0,
            treasure: true, effects: [{ type: "damage", amount: 1 }]
        },
        treasure_high: {
            name: "[TEST] 상급 카드형 보물", element: "NEUTRAL", cost: 0,
            treasure: true, effects: [{ type: "damage", amount: 2 }]
        }
    };
    catalog.cardPool = ["fire", "ice", "physical", "lightning", "draw", "shield"];
    catalog.heroes = [{
        id: "test-hero", name: "[TEST] 영웅",
        cards: ["fire", "ice", "physical", "lightning"],
        power: {id:'test-heal',name:'[TEST] 회복',kind:'active',cost:1,usesPerTurn:1,text:'체력 3 회복',effects:[{type:'heal',amount:3}]}
    }];
    catalog.enemies = {};
    catalog.encounters = [];
    for (i = 1; i <= 8; i++) {
        catalog.enemies["enemy" + i] = {
            name: "[TEST] 상대 " + i,
            maxHp: 1,
            cards: ["harmless", "harmless", "harmless", "harmless"],
            passives: []
        };
        catalog.encounters.push(["enemy" + i]);
    }
    catalog.treasures = {
        low_card: { name: "[TEST] 하급 카드 보물", tier: "low", kind: "card", cardId: "treasure_low" },
        low_hp: { name: "[TEST] 하급 체력 보물", tier: "low", kind: "passive", effects: [{ type: "maxHp", amount: 1 }] },
        low_shield: { name: "[TEST] 하급 보호막 보물", tier: "low", kind: "passive", effects: [{ type: "startingShield", amount: 1 }] },
        high_card: { name: "[TEST] 상급 카드 보물", tier: "high", kind: "card", cardId: "treasure_high" },
        high_hp: { name: "[TEST] 상급 체력 보물", tier: "high", kind: "passive", effects: [{ type: "maxHp", amount: 2 }] },
        high_damage: { name: "[TEST] 상급 피해 보물", tier: "high", kind: "passive", effects: [{ type: "damageBonus", amount: 1 }] },
        high_draw: { name: "[TEST] 상급 드로우 보물", tier: "high", kind: "passive", effects: [{ type: "turnDrawBonus", amount: 1 }] }
    };

    catalog.relics = {};
    catalog.enhancement = {};
    for (i = 0; i < grades.length; i++) {
        grade = grades[i];
        catalog.relics["relic_" + grade] = { name: "[TEST] " + grade + " 유물", grade: grade, levels: emptyLevels() };
        catalog.enhancement[grade] = {};
        for (var level = 0; level < 5; level++) {
            catalog.enhancement[grade][level] = {
                gold: 100, stones: 1, success: 100, fail: 0, down: 0, destroy: 0
            };
        }
    }
    catalog.relics.relic_damage = { name: "[TEST] 피해 증가 유물", grade: "A", levels: scalingLevels("damageBonus") };
    catalog.relics.relic_hp = { name: "[TEST] 최대 체력 유물", grade: "S", levels: scalingLevels("maxHp") };
    catalog.slotCosts = { 2: { gold: 100, stones: 1 }, 3: { gold: 100, stones: 1 } };
    catalog.pulls = {
        low: { name: "[TEST] 저가 뽑기", gold: 100, grades: [{ value: "C", weight: 100 }] },
        high: { name: "[TEST] 고가 뽑기", gold: 500, grades: [{ value: "SS", weight: 100 }] }
    };
    return catalog;
}

module.exports = makeCatalog;
