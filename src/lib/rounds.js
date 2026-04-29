import prefixConfig from "@/data/prefixes.json";
import suffixConfig from "@/data/suffixes.json";
import middleConfig from "@/data/middleAffixes.json";
import sjpDictionary from "@/data/sjpDictionary.json";

let dictionaryPromise;
const affixCache = new Map();
const affixIndexPromises = new Map();
const MIDDLE_AFFIX_SEPARATOR = "|";

const randomItem = (items) => items[Math.floor(Math.random() * items.length)];

const modeConfigs = {
  classic: {
    affixes: prefixConfig,
    getAffix: (word, length) => word.slice(0, length),
    matchesWord: (word, affix) => word.startsWith(affix),
  },
  reverse: {
    affixes: suffixConfig,
    getAffix: (word, length) => word.slice(-length),
    matchesWord: (word, affix) => word.endsWith(affix),
  },
  middle: {
    affixes: middleConfig,
    matchesWord: (word, affix) => {
      const { start, end } = parseMiddleAffix(affix);

      return (
        word.length >= start.length + end.length &&
        word.startsWith(start) &&
        word.endsWith(end)
      );
    },
  },
};

function getModeConfig(mode = "classic") {
  return modeConfigs[mode] || modeConfigs.classic;
}

export function parseMiddleAffix(affix) {
  const [start = "", end = ""] = String(affix).split(MIDDLE_AFFIX_SEPARATOR);

  return { start, end };
}

export function formatAffixLabel(affix, mode = "classic") {
  if (mode !== "middle") return affix;

  const { start, end } = parseMiddleAffix(affix);

  return `${start}...${end}`;
}

export function matchesAffixWord(word, affix, mode = "classic") {
  return getModeConfig(mode).matchesWord(word, affix);
}

async function loadDictionary() {
  if (!dictionaryPromise) {
    dictionaryPromise = fetch(sjpDictionary.wordsFile)
      .then((response) => {
        if (!response.ok) {
          throw new Error(`Nie udało się wczytać słownika SJP: ${response.status}`);
        }

        return response.text();
      })
      .then((text) => text.split(/\r?\n/).filter(Boolean));
  }

  return dictionaryPromise;
}

async function loadAffixIndex(mode = "classic") {
  const config = getModeConfig(mode);

  if (!affixIndexPromises.has(mode)) {
    affixIndexPromises.set(mode, loadDictionary().then((dictionary) => {
      const affixSets = new Map(config.affixes.map((affix) => [affix, []]));

      if (config.getAffix) {
        const affixLengths = [...new Set(config.affixes.map((affix) => affix.length))];

        for (const word of dictionary) {
          for (const length of affixLengths) {
            if (word.length >= length) {
              const affix = config.getAffix(word, length);

              if (affixSets.has(affix)) {
                affixSets.get(affix).push(word);
              }
            }
          }
        }
      } else {
        for (const word of dictionary) {
          for (const affix of config.affixes) {
            if (config.matchesWord(word, affix)) {
              affixSets.get(affix).push(word);
            }
          }
        }
      }

      for (const [affix, words] of affixSets) {
        affixCache.set(`${mode}:${affix}`, words);
      }

      return affixSets;
    }));
  }

  return affixIndexPromises.get(mode);
}

export async function createRound(mode = "classic") {
  const config = getModeConfig(mode);
  const prefix = randomItem(config.affixes);

  return createRoundForPrefix(prefix, mode);
}

export async function createRoundForPrefix(prefix, mode = "classic") {
  const cacheKey = `${mode}:${prefix}`;

  if (!affixCache.has(cacheKey)) {
    await loadAffixIndex(mode);
  }

  const words = affixCache.get(cacheKey);

  return {
    prefix,
    words: [...(words || [])].sort(() => Math.random() - 0.5),
  };
}

export async function getPrefixCounts(mode = "classic") {
  const prefixIndex = await loadAffixIndex(mode);

  return Object.fromEntries(
    [...prefixIndex.entries()].map(([prefix, words]) => [prefix, words.length])
  );
}

export function getKnownPrefixes(mode = "classic") {
  return [...getModeConfig(mode).affixes];
}

export function isKnownPrefix(prefix, mode = "classic") {
  return getModeConfig(mode).affixes.includes(prefix);
}
