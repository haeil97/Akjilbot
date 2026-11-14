'use strict';
// Development-time only. The result is embedded in the single Android script.
const fs = require('node:fs');
const path = require('node:path');
const elements = {'🔥':'FIRE','❄️':'ICE','🍃':'NATURE','⚡':'LIGHTNING','🕊️':'HOLY','🌊':'NEUTRAL'};
const existingIds = {
    '수중 동물 변신':'aquatic_form', '급속 성장':'wild_growth', '치유의 손길':'healing_touch',
    '급속 빙결':'flash_freeze', '초고속':'foresight', '선조의 지혜':'ancestral_knowledge',
    '천둥':'thunder', '파지직':'crackle', '넘치는 마나':'excess_mana'
};
const tokenNames = ['혹한','고드름','저주','넘치는 마나'];

function parseCards(raw) {
    const blocks = [], corrections = [];
    let current = null;
    for (const [index, line] of raw.split(/\r?\n/).entries()) {
        const header = line.match(/^\s*(?:\d+\.\s*)*\[([^\]]+)\]\s*(.+?)\s*\|\s*💧(\d+)\s*$/u);
        if (header) {
            if (!elements[header[1]]) throw new Error('알 수 없는 카드 속성: '+header[1]);
            current = {name:header[2].trim(), element:elements[header[1]], cost:Number(header[3]), text:[], notes:[], sourceLine:index+1};
            blocks.push(current);
        } else if (current && line.trim() && !/^\s*\S+ 카드 \(/u.test(line)) {
            if (line.trim().startsWith('//')) current.notes.push(line.trim().slice(2).trim());
            else current.text.push(line.trim());
        }
    }
    if (!blocks.length || blocks.length % 2) throw new Error('카드는 기본/강화 쌍이어야 합니다: '+blocks.length);
    const cards = [], tokens = [], names = new Set();
    for (let i = 0; i < blocks.length; i += 2) {
        const base = blocks[i], upgrade = blocks[i+1], expected = base.name+'+';
        if (upgrade.name !== expected) {
            const knownTypo = (base.name === '절멸' && upgrade.name === '절멸') ||
                (base.name === '고철 더미에서' && upgrade.name === '고철 더미에서') ||
                (base.name === '심판' && upgrade.name === '계시+');
            if (!knownTypo) throw new Error('원문의 기본/강화 카드 쌍을 확인하세요: '+base.name+' / '+upgrade.name);
            corrections.push({sourceLine:upgrade.sourceLine,from:upgrade.name,to:expected});
            upgrade.name = expected;
        }
        if (names.has(base.name)) throw new Error('중복 카드 이름: '+base.name);
        names.add(base.name);
        base.id = existingIds[base.name] || 'general:'+base.name;
        base.text = base.text.join(' '); upgrade.text = upgrade.text.join(' ');
        base.upgrade = upgrade;
        base.token = tokenNames.includes(base.name);
        base.implementationStatus = 'reference-only';
        (base.token ? tokens : cards).push(base);
    }
    if (tokens.length !== 4) throw new Error('토큰 4종이 필요합니다.');
    return {generalCards:cards,tokens,sourceCorrections:corrections};
}

function compileContent() {
    const read = file => fs.readFileSync(path.join(__dirname,'content',file),'utf8').replace(/^\uFEFF/,'');
    const cardReference = parseCards(read('일반카드-원고.txt'));
    const neutralRevision=JSON.parse(read('중립-개편.json'));
    cardReference.generalCards.forEach(card=>{const ref=neutralRevision.cards.find(ref=>ref.id===card.id);if(ref){card.cost=ref.cost;card.text=ref.text;card.upgrade.cost=ref.upgrade.cost;card.upgrade.text=ref.upgrade.text;card.botOnly=!!ref.botOnly;}});
    return Object.assign({version:1,revision:'expansion-2026-10-06',
        description:'카드 원문과 상대 설계 자료입니다. 아직 구현되지 않은 효과의 실행 정의가 아닙니다.',
        stageHp:[15,20,25,35,40,50,60,70],
        opponentDecks:JSON.parse(read('상대-덱-초안.json')),
        opponentAbilities:JSON.parse(read('상대-능력.json')),
        classes:JSON.parse(read('직업-설계.json')),
        guffRevision:JSON.parse(read('거프-개편.json')),
        neutralRevision,
        minionDesign:JSON.parse(read('하수인-설계.json'))
    },cardReference);
}

module.exports = {compileContent,parseCards};
