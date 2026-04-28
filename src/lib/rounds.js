import prefixConfig from "@/data/prefixes.json";
import sjpDictionary from "@/data/sjpDictionary.json";

let dictionaryPromise;
const prefixCache = new Map();

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

export async function createRound() {
  const prefix = randomItem(prefixConfig);

  return createRoundForPrefix(prefix);
}

export async function createRoundForPrefix(prefix) {
  if (!prefixCache.has(prefix)) {
    const dictionary = await loadDictionary();
    prefixCache.set(prefix, dictionary.filter((word) => word.startsWith(prefix)));
  }

  const words = prefixCache.get(prefix);

  return {
    prefix,
    words: [...words].sort(() => Math.random() - 0.5),
  };
}

export function getKnownPrefixes() {
  return [...prefixConfig];
}

export function isKnownPrefix(prefix) {
  return prefixConfig.includes(prefix);
}
