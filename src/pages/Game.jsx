import React, { useState, useCallback, useEffect, useRef } from "react";
import { Loader2, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { createRoundForPrefix, getKnownPrefixes, isKnownPrefix } from "@/lib/rounds";
import PrefixDisplay from "../components/game/PrefixDisplay";
import WordInput from "../components/game/WordInput";
import StatusToast from "../components/game/StatusToast";
import ProgressCounter from "../components/game/ProgressCounter";
import LevelProgress from "../components/game/LevelProgress";
import PrefixList from "../components/game/PrefixList";
import WordList from "../components/game/WordList";
import MissingWords from "../components/game/MissingWords";

const STORAGE_KEY = "gra-w-wyrazy:game-state";
const XP_PER_LETTER = 5;
const PREFIXES = getKnownPrefixes();
const DEFAULT_PREFIX = PREFIXES[0] || "";
const BACKGROUND_VIDEO_URL =
  "https://www.youtube.com/embed/zZ7AimPACzc?autoplay=1&mute=1&loop=1&playlist=zZ7AimPACzc&controls=0&modestbranding=1&playsinline=1&rel=0";

function getWordXp(word) {
  return Math.max(5, word.length * XP_PER_LETTER);
}

function getXpForLevel(level) {
  return 120 + (level - 1) * 60;
}

function getLevelState(totalXp) {
  let level = 1;
  let currentXp = Math.max(0, Math.floor(totalXp));
  let xpForNext = getXpForLevel(level);

  while (currentXp >= xpForNext) {
    currentXp -= xpForNext;
    level += 1;
    xpForNext = getXpForLevel(level);
  }

  return {
    level,
    currentXp,
    xpForNext,
    percent: xpForNext > 0 ? Math.round((currentXp / xpForNext) * 100) : 0,
    totalXp: Math.max(0, Math.floor(totalXp)),
  };
}

function normalizeFoundWords(words, prefix) {
  if (!Array.isArray(words)) return [];

  return [
    ...new Set(
      words
        .filter((word) => typeof word === "string")
        .map((word) => word.toLocaleLowerCase("pl-PL").trim())
        .filter((word) => !prefix || word.startsWith(prefix))
    ),
  ];
}

function createEmptyPrefixProgress() {
  return PREFIXES.reduce((acc, prefix) => {
    acc[prefix] = {
      foundWords: [],
      revealedMissing: false,
    };
    return acc;
  }, {});
}

function normalizeTotalXp(value) {
  return typeof value === "number" && Number.isFinite(value)
    ? Math.max(0, Math.floor(value))
    : 0;
}

function normalizeSavedProgress(saved) {
  const progressByPrefix = createEmptyPrefixProgress();

  if (saved?.prefixes && typeof saved.prefixes === "object") {
    Object.entries(saved.prefixes).forEach(([prefix, progress]) => {
      if (!isKnownPrefix(prefix) || !progress || typeof progress !== "object") return;

      progressByPrefix[prefix] = {
        foundWords: normalizeFoundWords(progress.foundWords, prefix),
        revealedMissing: Boolean(progress.revealedMissing),
      };
    });

    return {
      activePrefix: isKnownPrefix(saved.activePrefix) ? saved.activePrefix : DEFAULT_PREFIX,
      progressByPrefix,
      totalXp: normalizeTotalXp(saved.totalXp),
    };
  }

  if (
    saved &&
    typeof saved.prefix === "string" &&
    Array.isArray(saved.foundWords) &&
    isKnownPrefix(saved.prefix)
  ) {
    const prefix = saved.prefix.toLocaleLowerCase("pl-PL").trim();
    progressByPrefix[prefix] = {
      foundWords: normalizeFoundWords(saved.foundWords, prefix),
      revealedMissing: false,
    };

    return {
      activePrefix: prefix,
      progressByPrefix,
      totalXp: normalizeTotalXp(saved.totalXp),
    };
  }

  return null;
}

function readSavedGame() {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;

    return normalizeSavedProgress(JSON.parse(raw));
  } catch {
    return null;
  }
}

function saveGame(activePrefix, progressByPrefix, totalXp) {
  try {
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        version: 2,
        activePrefix,
        prefixes: progressByPrefix,
        totalXp,
      })
    );
  } catch {
    // localStorage can be unavailable in private mode or when storage is full.
  }
}

function BackgroundVideo() {
  return (
    <div className="fixed bottom-3 left-3 z-0 w-[min(42vw,360px)] aspect-video overflow-hidden rounded-lg border border-border/40 opacity-70 pointer-events-none shadow-lg sm:bottom-5 sm:left-5">
      <iframe
        className="h-full w-full"
        src={BACKGROUND_VIDEO_URL}
        title="Film w tle"
        allow="autoplay; encrypted-media; picture-in-picture"
        referrerPolicy="strict-origin-when-cross-origin"
      />
    </div>
  );
}

export default function Game() {
  const [prefix, setPrefix] = useState(DEFAULT_PREFIX);
  const [allWords, setAllWords] = useState([]);
  const [prefixProgress, setPrefixProgress] = useState(() => createEmptyPrefixProgress());
  const [wordCounts, setWordCounts] = useState({});
  const [totalXp, setTotalXp] = useState(0);
  const [lastXpGain, setLastXpGain] = useState(null);
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(false);
  const [initialized, setInitialized] = useState(false);
  const statusTimerRef = useRef(null);
  const statusIdRef = useRef(0);
  const xpGainIdRef = useRef(0);

  const showStatus = (nextStatus) => {
    statusIdRef.current += 1;
    setStatus({ id: statusIdRef.current, ...nextStatus });

    if (statusTimerRef.current) {
      clearTimeout(statusTimerRef.current);
    }

    statusTimerRef.current = setTimeout(() => setStatus(null), 2500);
  };

  const loadPrefixWords = useCallback(async (nextPrefix) => {
    if (!nextPrefix) return;

    setLoading(true);
    setStatus(null);
    setLastXpGain(null);

    const result = await createRoundForPrefix(nextPrefix);
    const cleanPrefix = result.prefix.toLocaleLowerCase("pl-PL").trim();
    const cleanWords = result.words
      .map((word) => word.toLocaleLowerCase("pl-PL").trim())
      .filter((word) => word.startsWith(cleanPrefix));
    const uniqueWords = [...new Set(cleanWords)];

    setPrefix(cleanPrefix);
    setAllWords(uniqueWords);
    setWordCounts((prev) => ({ ...prev, [cleanPrefix]: uniqueWords.length }));
    setLoading(false);
  }, []);

  const loadPrefixCounts = useCallback(async () => {
    const entries = await Promise.all(
      PREFIXES.map(async (knownPrefix) => {
        const result = await createRoundForPrefix(knownPrefix);
        return [knownPrefix, new Set(result.words).size];
      })
    );

    setWordCounts(Object.fromEntries(entries));
  }, []);

  useEffect(() => {
    return () => {
      if (statusTimerRef.current) {
        clearTimeout(statusTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    const savedGame = readSavedGame();

    if (savedGame) {
      setPrefix(savedGame.activePrefix);
      setPrefixProgress(savedGame.progressByPrefix);
      setTotalXp(savedGame.totalXp);
      loadPrefixWords(savedGame.activePrefix).then(() => setInitialized(true));
    } else {
      loadPrefixWords(DEFAULT_PREFIX).then(() => setInitialized(true));
    }

    loadPrefixCounts();
  }, [loadPrefixCounts, loadPrefixWords]);

  useEffect(() => {
    if (!initialized || !prefix || loading) return;

    saveGame(prefix, prefixProgress, totalXp);
  }, [initialized, loading, prefix, prefixProgress, totalXp]);

  const currentProgress = prefixProgress[prefix] || {
    foundWords: [],
    revealedMissing: false,
  };
  const foundWords = currentProgress.foundWords;
  const isCurrentPrefixLocked = currentProgress.revealedMissing;

  const handleSelectPrefix = (nextPrefix) => {
    if (nextPrefix === prefix || loading) return;

    loadPrefixWords(nextPrefix);
  };

  const handleResetGame = async () => {
    try {
      window.localStorage.removeItem(STORAGE_KEY);
    } catch {
      // localStorage can be unavailable in private mode.
    }

    setPrefixProgress(createEmptyPrefixProgress());
    setTotalXp(0);
    setLastXpGain(null);
    await loadPrefixWords(DEFAULT_PREFIX);
    showStatus({ type: "success", message: "Gra zresetowana. Możesz zacząć od nowa." });
  };

  const handleRevealMissing = () => {
    setPrefixProgress((prev) => ({
      ...prev,
      [prefix]: {
        ...(prev[prefix] || { foundWords: [] }),
        revealedMissing: true,
      },
    }));
    showStatus({
      type: "duplicate",
      message: "Brakujące słowa odkryte. Ten prefiks jest teraz zablokowany.",
    });
  };

  const handleSubmitWord = (word) => {
    if (isCurrentPrefixLocked) {
      showStatus({
        type: "error",
        message: "Ten prefiks jest zablokowany po odkryciu brakujących słów.",
      });
      return;
    }

    if (!word.startsWith(prefix)) {
      showStatus({ type: "error", message: `Słowo musi zaczynać się od "${prefix}"` });
      return;
    }

    if (foundWords.includes(word)) {
      showStatus({ type: "duplicate", message: "To słowo już jest na liście" });
      return;
    }

    if (!allWords.includes(word)) {
      showStatus({ type: "error", message: "SJP nie podaje takiego słowa dla tego prefiksu" });
      return;
    }

    const xpGain = getWordXp(word);
    const previousLevel = getLevelState(totalXp).level;
    const nextTotalXp = totalXp + xpGain;
    const nextLevel = getLevelState(nextTotalXp).level;
    const leveledUp = nextLevel > previousLevel;

    setPrefixProgress((prev) => ({
      ...prev,
      [prefix]: {
        ...(prev[prefix] || { revealedMissing: false }),
        foundWords: [word, ...(prev[prefix]?.foundWords || [])],
      },
    }));
    setTotalXp(nextTotalXp);
    xpGainIdRef.current += 1;
    setLastXpGain({
      id: xpGainIdRef.current,
      amount: xpGain,
      leveledUp,
      level: nextLevel,
    });
    showStatus({
      type: "success",
      message: leveledUp ? `Awans na LVL ${nextLevel}! +${xpGain} XP` : `Dodano! +${xpGain} XP`,
    });
  };

  if (!initialized) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-3 text-muted-foreground">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
        <span className="text-sm font-medium">Przygotowywanie prefiksów...</span>
      </div>
    );
  }

  return (
    <div className="relative min-h-screen bg-background">
      <BackgroundVideo />

      <header className="relative z-10 border-b border-border bg-card">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between gap-3">
          <h1 className="text-lg font-bold text-foreground tracking-tight">
            Gra w wyrazy by toti
          </h1>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleResetGame}
            disabled={loading}
            className="h-9 gap-2"
          >
            <Trash2 className="h-4 w-4" />
            Reset
          </Button>
        </div>
      </header>

      <main className="relative z-10 max-w-5xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6 lg:gap-8">
          <div className="lg:col-span-2 space-y-6">
            <PrefixDisplay prefix={prefix} />

            <LevelProgress
              levelState={getLevelState(totalXp)}
              lastGain={lastXpGain}
            />

            <WordInput
              onSubmit={handleSubmitWord}
              disabled={loading || isCurrentPrefixLocked}
            />

            {isCurrentPrefixLocked && (
              <div className="rounded-lg border border-yellow-500/25 bg-yellow-500/10 px-3 py-2 text-sm font-medium text-yellow-700">
                Ten prefiks jest zablokowany, bo pokazano brakujące słowa.
              </div>
            )}

            <StatusToast status={status} />

            <PrefixList
              prefixes={PREFIXES}
              activePrefix={prefix}
              progressByPrefix={prefixProgress}
              wordCounts={wordCounts}
              onSelect={handleSelectPrefix}
              disabled={loading}
            />
          </div>

          <div className="lg:col-span-3 space-y-6">
            <div className="bg-card border border-border rounded-lg p-5 space-y-5">
              <ProgressCounter found={foundWords.length} total={allWords.length} />

              <div className="border-t border-border pt-4">
                <span className="text-xs font-medium uppercase tracking-widest text-muted-foreground mb-3 block">
                  Znalezione
                </span>
                <WordList words={foundWords} prefix={prefix} />
              </div>

              <div className="border-t border-border pt-4">
                <MissingWords
                  words={allWords}
                  prefix={prefix}
                  foundWords={foundWords}
                  revealed={isCurrentPrefixLocked}
                  onReveal={handleRevealMissing}
                />
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
