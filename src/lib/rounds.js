import prefixConfig from "@/data/prefixes.json";
import suffixConfig from "@/data/suffixes.json";
import sjpDictionary from "@/data/sjpDictionary.json";

let dictionaryPromise;
const affixCache = new Map();
const affixIndexPromises = new Map();

const randomItem = (items) => items[Math.floor(Math.random() * items.length)];

const modeConfigs = {
  classic: {
    affixes: prefixConfig,
    getAffix: (word, length) => word.slice(0, length),
  },
  reverse: {
    affixes: suffixConfig,
    getAffix: (word, length) => word.slice(-length),
  },
};

function getModeConfig(mode = "classic") {
  return modeConfigs[mode] || modeConfigs.classic;
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
