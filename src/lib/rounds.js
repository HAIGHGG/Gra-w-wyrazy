import prefixConfig from "@/data/prefixes.json";
import sjpDictionary from "@/data/sjpDictionary.json";

let dictionaryPromise;
const prefixCache = new Map();
let prefixIndexPromise;

const randomItem = (items) => items[Math.floor(Math.random() * items.length)];

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

async function loadPrefixIndex() {
  if (!prefixIndexPromise) {
    prefixIndexPromise = loadDictionary().then((dictionary) => {
      const prefixSets = new Map(prefixConfig.map((prefix) => [prefix, []]));
      const prefixLengths = [...new Set(prefixConfig.map((prefix) => prefix.length))];

      for (const word of dictionary) {
        for (const length of prefixLengths) {
          if (word.length >= length) {
            const prefix = word.slice(0, length);

            if (prefixSets.has(prefix)) {
              prefixSets.get(prefix).push(word);
            }
          }
        }
      }

      for (const [prefix, words] of prefixSets) {
        prefixCache.set(prefix, words);
      }

      return prefixSets;
    });
  }

  return prefixIndexPromise;
}

export async function createRound() {
  const prefix = randomItem(prefixConfig);

  return createRoundForPrefix(prefix);
}

export async function createRoundForPrefix(prefix) {
  if (!prefixCache.has(prefix)) {
    await loadPrefixIndex();
  }

  const words = prefixCache.get(prefix);

  return {
    prefix,
    words: [...words].sort(() => Math.random() - 0.5),
  };
}

export async function getPrefixCounts() {
  const prefixIndex = await loadPrefixIndex();

  return Object.fromEntries(
    [...prefixIndex.entries()].map(([prefix, words]) => [prefix, words.length])
  );
}

export function getKnownPrefixes() {
  return [...prefixConfig];
}

export function isKnownPrefix(prefix) {
  return prefixConfig.includes(prefix);
}
