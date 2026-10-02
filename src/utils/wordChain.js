const fs = require('fs');
const path = require('path');

const WORDS_FILE = path.join(__dirname, '../data/words.jsonl');

let WORDS = [];
let WORD_SET = new Set();
let TWO_SYLLABLE_WORDS = [];

function loadWords() {
    try {
        const content = fs.readFileSync(WORDS_FILE, 'utf8');
        const lines = content.split('\n').filter(Boolean);

        WORDS = [];
        WORD_SET = new Set();

        let errors = 0;

        for (const line of lines) {
            try {
                const obj = JSON.parse(line);

                if (!obj.text) {
                    errors++;
                    continue;
                }

                WORDS.push({
                    text: obj.text,
                    source: obj.source || [],
                });
                WORD_SET.add(obj.text.toLowerCase());
            } catch {
                errors++;
            }
        }

        TWO_SYLLABLE_WORDS = WORDS.filter(w => isTwoSyllableWord(w.text));

        console.log(`✅ Loaded ${WORDS.length} words (${errors} lines skipped)`);
        console.log(`✅ Có ${TWO_SYLLABLE_WORDS.length} từ 2 âm tiết`);
    } catch (err) {
        console.error('❌ Lỗi load words:', err.message);
        WORDS = [];
        WORD_SET = new Set();
        TWO_SYLLABLE_WORDS = [];
    }
}

function normalize(text) {
    return text
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9\s]/g, '')
        .trim();
}

// Lấy TỪ CUỐI (từ thứ 2) của cụm
function getLastWord(text) {
    const normalized = text.toLowerCase().trim();
    if (!normalized) return null;

    const words = normalized.split(/\s+/);
    if (words.length < 2) return null;

    return words[words.length - 1];
}

// Lấy TỪ ĐẦU của cụm
function getFirstWord(text) {
    const normalized = text.toLowerCase().trim();
    if (!normalized) return null;

    const words = normalized.split(/\s+/);
    return words[0];
}

function isValidWord(text) {
    return WORD_SET.has(text.toLowerCase());
}

// Nối từ: từ đầu của nextWord = từ cuối của prevWord
function canChain(prevWord, nextWord) {
    const lastWord = getLastWord(prevWord);
    const firstWord = getFirstWord(nextWord);

    if (!lastWord || !firstWord) return false;

    return lastWord === firstWord;
}

function findBotWord(prevWord, usedWords = []) {
    const lastWord = getLastWord(prevWord);
    if (!lastWord) return null;

    const usedSet = new Set(usedWords.map(w => w.toLowerCase()));

    const candidates = WORDS.filter(w => {
        const word = w.text.toLowerCase();
        if (usedSet.has(word)) return false;

        const firstWord = getFirstWord(word);
        return firstWord === lastWord;
    });

    if (candidates.length === 0) return null;

    return candidates[Math.floor(Math.random() * candidates.length)].text;
}

function countSyllables(text) {
    const trimmed = text.trim();
    if (!trimmed) return 0;
    return trimmed.split(/\s+/).length;
}

function isTwoSyllableWord(text) {
    return countSyllables(text) === 2;
}

function getRandomWord() {
    if (TWO_SYLLABLE_WORDS.length === 0) return null;
    const randomIndex = Math.floor(Math.random() * TWO_SYLLABLE_WORDS.length);
    return TWO_SYLLABLE_WORDS[randomIndex].text;
}

loadWords();

function addWord(text) {
    try {
        if (WORD_SET.has(text.toLowerCase())) {
            return { success: false, reason: 'exists' };
        }

        const newWord = {
            text: text,
            source: ['user_added'],
        };

        const line = JSON.stringify(newWord) + '\n';
        fs.appendFileSync(WORDS_FILE, line, 'utf8');

        WORDS.push(newWord);
        WORD_SET.add(text.toLowerCase());

        if (isTwoSyllableWord(text)) {
            TWO_SYLLABLE_WORDS.push(newWord);
        }

        console.log(`✅ Đã thêm từ: "${text}"`);
        return { success: true };
    } catch (err) {
        console.error('❌ Lỗi thêm từ:', err.message);
        return { success: false, reason: 'error', error: err.message };
    }
}

function hasNextWord(currentWord, usedWords = []) {
    const lastWord = getLastWord(currentWord);
    if (!lastWord) return false;

    const usedSet = new Set(usedWords.map(w => w.toLowerCase()));

    for (const w of WORDS) {
        const word = w.text.toLowerCase();
        if (usedSet.has(word)) continue;

        const firstWord = getFirstWord(word);
        if (firstWord === lastWord) {
            return true;
        }
    }

    return false;
}

module.exports = {
    loadWords,
    normalize,
    getLastWord,
    getFirstWord,
    isValidWord,
    canChain,
    findBotWord,
    getWords: () => WORDS,
    countSyllables,
    isTwoSyllableWord,
    getRandomWord,
    addWord,
    hasNextWord, 
};