function cleanLetter(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z]/g, "")
    .slice(0, 1);
}

export function normalizeSegmentedWord(word) {
  return String(word || "")
    .trim()
    .toLowerCase();
}

export function isSupportedSegmentedWord(word) {
  const normalized = normalizeSegmentedWord(word);
  return !!normalized && /^[a-z]+$/.test(normalized);
}

export function createSegmentedSpellingModel(word) {
  const normalizedWord = normalizeSegmentedWord(word);
  const wordLength = normalizedWord.length;
  const letters = Array.from({ length: wordLength }, () => "");
  let activeIndex = 0;

  function clampIndex(index) {
    if (!wordLength) return 0;
    const next = Number(index);
    if (!Number.isFinite(next)) return activeIndex;
    return Math.max(0, Math.min(wordLength - 1, Math.trunc(next)));
  }

  function setActive(index) {
    activeIndex = clampIndex(index);
    return activeIndex;
  }

  function moveActive(delta) {
    return setActive(activeIndex + Number(delta || 0));
  }

  function insertChar(raw) {
    const letter = cleanLetter(raw);
    if (!letter || !wordLength) return false;
    letters[activeIndex] = letter;
    if (activeIndex < wordLength - 1) {
      activeIndex += 1;
    }
    return true;
  }

  function backspace() {
    if (!wordLength) return false;
    if (letters[activeIndex]) {
      letters[activeIndex] = "";
      return true;
    }
    if (activeIndex > 0) {
      activeIndex -= 1;
      letters[activeIndex] = "";
      return true;
    }
    return false;
  }

  function deleteCurrent() {
    if (!wordLength || !letters[activeIndex]) return false;
    letters[activeIndex] = "";
    return true;
  }

  function pasteText(raw) {
    const chars = String(raw || "")
      .toLowerCase()
      .replace(/[^a-z]/g, "")
      .split("");
    if (!chars.length || !wordLength) return false;

    let writeIndex = activeIndex;
    for (const char of chars) {
      if (writeIndex >= wordLength) break;
      letters[writeIndex] = char;
      writeIndex += 1;
    }

    const nextEmpty = letters.findIndex((value, index) => index >= writeIndex && !value);
    if (nextEmpty >= 0) {
      activeIndex = nextEmpty;
    } else {
      activeIndex = Math.max(0, Math.min(wordLength - 1, writeIndex - 1));
    }
    return true;
  }

  function clear() {
    for (let i = 0; i < letters.length; i += 1) letters[i] = "";
    activeIndex = 0;
  }

  return {
    word: normalizedWord,
    letters,
    wordLength,
    get activeIndex() {
      return activeIndex;
    },
    setActive,
    moveActive,
    insertChar,
    backspace,
    deleteCurrent,
    pasteText,
    clear,
    get answer() {
      return letters.join("");
    },
    get isComplete() {
      return letters.every(Boolean);
    },
  };
}
