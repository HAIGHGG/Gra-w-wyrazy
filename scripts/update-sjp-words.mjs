import fs from "node:fs/promises";
import path from "node:path";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { fileURLToPath } from "node:url";
import AdmZip from "adm-zip";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, "..");
const sourcePageUrl = "https://sjp.pl/sl/growy/";
const metadataOutputPath = path.join(rootDir, "src", "data", "sjpDictionary.json");
const prefixesOutputPath = path.join(rootDir, "src", "data", "prefixes.json");
const suffixesOutputPath = path.join(rootDir, "src", "data", "suffixes.json");
const wordsOutputPath = path.join(rootDir, "public", "sjp-growy.txt");
const morfeuszFilterPath = path.join(__dirname, "filter-nouns-with-morfeusz.py");

const allowedWordPattern = /^[a-z\u0105\u0107\u0119\u0142\u0144\u00f3\u015b\u017a\u017c]+$/u;
const prefixLengths = [2, 3, 4];
const minimumWordsPerPrefix = 50;
const suffixLengths = [3, 4];
const minimumWordsPerSuffix = 100;

async function fetchBuffer(url) {
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`Could not download ${url}: ${response.status} ${response.statusText}`);
  }

  return Buffer.from(await response.arrayBuffer());
}

async function getLatestZipUrl() {
  const response = await fetch(sourcePageUrl);

  if (!response.ok) {
    throw new Error(`Could not download SJP page: ${response.status} ${response.statusText}`);
  }

  const html = await response.text();
  const match = html.match(/href="([^"]*sjp-\d+\.zip)"/);

  if (!match) {
    throw new Error("Could not find sjp-*.zip link on SJP page.");
  }

  return new URL(match[1], sourcePageUrl).toString();
}

function normalizeWord(word) {
  return word.trim().toLocaleLowerCase("pl-PL");
}

function shouldUseWord(word) {
  return word.length > 1 && allowedWordPattern.test(word);
}

async function filterNounsWithMorfeusz(words) {
  const pythonCommand = process.env.MORFEUSZ_PYTHON || process.env.PYTHON || "python";
  const child = spawn(pythonCommand, [morfeuszFilterPath], {
    env: {
      ...process.env,
      PYTHONIOENCODING: "utf-8",
    },
    stdio: ["pipe", "pipe", "inherit"],
  });

  const chunks = [];

  child.stdout.on("data", (chunk) => {
    chunks.push(chunk);
  });

  const writeWords = async () => {
    for (const word of words) {
      if (!child.stdin.write(`${word}\n`, "utf8")) {
        await once(child.stdin, "drain");
      }
    }

    child.stdin.end();
  };

  await Promise.all([
    writeWords(),
    once(child, "close").then(([code]) => {
      if (code !== 0) {
        throw new Error(
          `Morfeusz noun filter failed with exit code ${code}. ` +
            `Set MORFEUSZ_PYTHON if morfeusz2 is installed in a different Python environment.`,
        );
      }
    }),
  ]);

  const lemmas = Buffer.concat(chunks)
    .toString("utf8")
    .split(/\r?\n/)
    .filter(Boolean);

  return [...new Set(lemmas)].sort((a, b) => a.localeCompare(b, "pl"));
}

function generatePrefixes(words) {
  const counts = new Map();

  for (const word of words) {
    for (const length of prefixLengths) {
      if (word.length >= length) {
        const prefix = word.slice(0, length);
        counts.set(prefix, (counts.get(prefix) || 0) + 1);
      }
    }
  }

  return [...counts.entries()]
    .filter(([, count]) => count > minimumWordsPerPrefix)
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], "pl"))
    .map(([prefix]) => prefix);
}

function generateSuffixes(words) {
  const counts = new Map();

  for (const word of words) {
    for (const length of suffixLengths) {
      if (word.length >= length) {
        const suffix = word.slice(-length);
        counts.set(suffix, (counts.get(suffix) || 0) + 1);
      }
    }
  }

  return [...counts.entries()]
    .filter(([, count]) => count >= minimumWordsPerSuffix)
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], "pl"))
    .map(([suffix]) => suffix);
}

async function main() {
  const words = new Set();
  const zipUrl = await getLatestZipUrl();
  const zip = new AdmZip(await fetchBuffer(zipUrl));
  const wordsEntry = zip.getEntry("slowa.txt");

  if (!wordsEntry) {
    throw new Error("SJP package does not contain slowa.txt.");
  }

  const lines = wordsEntry.getData().toString("utf8").split(/\r?\n/);

  for (const line of lines) {
    const word = normalizeWord(line);

    if (word && shouldUseWord(word)) {
      words.add(word);
    }
  }

  const candidates = [...words].sort((a, b) => a.localeCompare(b, "pl"));
  const sortedWords = await filterNounsWithMorfeusz(candidates);
  const prefixes = generatePrefixes(sortedWords);
  const suffixes = generateSuffixes(sortedWords);
  const metadata = {
    source: sourcePageUrl,
    zipUrl,
    wordsFile: "/sjp-growy.txt",
    wordCount: sortedWords.length,
    candidateWordCount: candidates.length,
    filter: "Morfeusz 2 noun lemmas",
    nounTags: ["subst", "depr"],
    prefixLengths,
    minimumWordsPerPrefix,
    suffixLengths,
    minimumWordsPerSuffix,
    license: "SJP.PL game word list, available under GPL 2 or CC BY 4.0",
  };

  await fs.mkdir(path.dirname(wordsOutputPath), { recursive: true });
  await fs.writeFile(wordsOutputPath, `${sortedWords.join("\n")}\n`, "utf8");
  await fs.writeFile(prefixesOutputPath, `${JSON.stringify(prefixes, null, 2)}\n`, "utf8");
  await fs.writeFile(suffixesOutputPath, `${JSON.stringify(suffixes, null, 2)}\n`, "utf8");
  await fs.writeFile(metadataOutputPath, `${JSON.stringify(metadata, null, 2)}\n`, "utf8");

  console.log(
    `Saved ${sortedWords.length} SJP noun lemmas, ${prefixes.length} prefixes, ${suffixes.length} suffixes ` +
      `and ${candidates.length} candidates.`,
  );
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
