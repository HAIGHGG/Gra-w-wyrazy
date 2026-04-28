import React, { useState, useCallback, useEffect, useRef } from "react";
import { Check, Globe2, Loader2, RotateCcw, Timer, Trash2, Trophy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { createRoundForPrefix, getKnownPrefixes, getPrefixCounts, isKnownPrefix } from "@/lib/rounds";
import PrefixDisplay from "../components/game/PrefixDisplay";
import WordInput from "../components/game/WordInput";
import StatusToast from "../components/game/StatusToast";
import ProgressCounter from "../components/game/ProgressCounter";
import LevelProgress from "../components/game/LevelProgress";
import PrefixList from "../components/game/PrefixList";
import WordList from "../components/game/WordList";
import MissingWords from "../components/game/MissingWords";
import OnlineGame from "../components/game/OnlineGame";

const STORAGE_KEY = "gra-w-wyrazy:game-state";
const SHARED_XP_STORAGE_KEY = `${STORAGE_KEY}:xp`;
const XP_PER_LETTER = 5;
const DEFAULT_TIME_ATTACK_SECONDS = 30;
const MIN_TIME_ATTACK_SECONDS = 10;
const MAX_TIME_ATTACK_SECONDS = 300;
const QUICK_ROUND_DURATIONS = [30, 60, 90, 120];
const SCORE_PER_LETTER = 10;
const WORD_MODES = {
  classic: {
    id: "classic",
    label: "prefiks",
    listTitle: "Prefiksy",
    storageKey: STORAGE_KEY,
    affixes: getKnownPrefixes("classic"),
    matchWord: (word, prefix) => word.startsWith(prefix),
  },
  reverse: {
    id: "reverse",
    label: "końcówka",
    listTitle: "Końcówki",
    storageKey: `${STORAGE_KEY}:reverse`,
    affixes: getKnownPrefixes("reverse"),
    matchWord: (word, prefix) => word.endsWith(prefix),
  },
};
const PREFIXES = WORD_MODES.classic.affixes;
const DEFAULT_PREFIX = PREFIXES[0] || "";
const BACKGROUND_VIDEO_URL =
  "https://www.youtube.com/embed/zZ7AimPACzc?autoplay=1&mute=1&loop=1&playlist=zZ7AimPACzc&controls=0&modestbranding=1&playsinline=1&rel=0";

function getWordXp(word) {
  return Math.max(5, word.length * XP_PER_LETTER);
}

function getWordScore(word) {
  return word.length * SCORE_PER_LETTER;
}

function clampRoundDuration(value) {
  const duration = Math.floor(Number(value));

  if (!Number.isFinite(duration)) {
    return DEFAULT_TIME_ATTACK_SECONDS;
  }

  return Math.min(MAX_TIME_ATTACK_SECONDS, Math.max(MIN_TIME_ATTACK_SECONDS, duration));
}

function getWordModeConfig(mode = "classic") {
  return WORD_MODES[mode] || WORD_MODES.classic;
}

function getWordModeFromGameMode(gameMode) {
  return gameMode === "reverse" ? "reverse" : "classic";
}

function getDefaultPrefix(mode = "classic") {
  return getWordModeConfig(mode).affixes[0] || "";
}

function matchesWordMode(word, prefix, mode = "classic") {
  return getWordModeConfig(mode).matchWord(word, prefix);
}

function getRandomPrefix(excludedPrefix, mode = "classic") {
  const prefixes = getWordModeConfig(mode).affixes;
  const availablePrefixes = prefixes.filter((prefix) => prefix !== excludedPrefix);
  const source = availablePrefixes.length > 0 ? availablePrefixes : prefixes;

  return source[Math.floor(Math.random() * source.length)] || getDefaultPrefix(mode);
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

function normalizeFoundWords(words, prefix, mode = "classic") {
  if (!Array.isArray(words)) return [];

  return [
    ...new Set(
      words
        .filter((word) => typeof word === "string")
        .map((word) => word.toLocaleLowerCase("pl-PL").trim())
        .filter((word) => !prefix || matchesWordMode(word, prefix, mode))
    ),
  ];
}

function createEmptyPrefixProgress(mode = "classic") {
  return getWordModeConfig(mode).affixes.reduce((acc, prefix) => {
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

function normalizeSavedProgress(saved, mode = "classic") {
  const progressByPrefix = createEmptyPrefixProgress(mode);
  const defaultPrefix = getDefaultPrefix(mode);

  if (saved?.prefixes && typeof saved.prefixes === "object") {
    Object.entries(saved.prefixes).forEach(([prefix, progress]) => {
      if (!isKnownPrefix(prefix, mode) || !progress || typeof progress !== "object") return;

      progressByPrefix[prefix] = {
        foundWords: normalizeFoundWords(progress.foundWords, prefix, mode),
        revealedMissing: Boolean(progress.revealedMissing),
      };
    });

    return {
      activePrefix: isKnownPrefix(saved.activePrefix, mode) ? saved.activePrefix : defaultPrefix,
      progressByPrefix,
    };
  }

  if (
    saved &&
    typeof saved.prefix === "string" &&
    Array.isArray(saved.foundWords) &&
    isKnownPrefix(saved.prefix, mode)
  ) {
    const prefix = saved.prefix.toLocaleLowerCase("pl-PL").trim();
    progressByPrefix[prefix] = {
      foundWords: normalizeFoundWords(saved.foundWords, prefix, mode),
      revealedMissing: false,
    };

    return {
      activePrefix: prefix || defaultPrefix,
      progressByPrefix,
    };
  }

  return null;
}

function readSavedGame(mode = "classic") {
  try {
    const raw = window.localStorage.getItem(getWordModeConfig(mode).storageKey);
    if (!raw) return null;

    return normalizeSavedProgress(JSON.parse(raw), mode);
  } catch {
    return null;
  }
}

function readLegacyTotalXp(mode = "classic") {
  try {
    const raw = window.localStorage.getItem(getWordModeConfig(mode).storageKey);
    if (!raw) return 0;

    return normalizeTotalXp(JSON.parse(raw)?.totalXp);
  } catch {
    return 0;
  }
}

function readSharedTotalXp() {
  try {
    const raw = window.localStorage.getItem(SHARED_XP_STORAGE_KEY);

    if (raw) {
      return normalizeTotalXp(JSON.parse(raw)?.totalXp);
    }
  } catch {
    // Fall back to legacy per-mode XP below.
  }

  return Math.max(readLegacyTotalXp("classic"), readLegacyTotalXp("reverse"));
}

function saveSharedTotalXp(totalXp) {
  try {
    window.localStorage.setItem(
      SHARED_XP_STORAGE_KEY,
      JSON.stringify({
        version: 1,
        totalXp: normalizeTotalXp(totalXp),
      })
    );
  } catch {
    // localStorage can be unavailable in private mode or when storage is full.
  }
}

function saveGame(activePrefix, progressByPrefix, mode = "classic") {
  try {
    window.localStorage.setItem(
      getWordModeConfig(mode).storageKey,
      JSON.stringify({
        version: 2,
        mode,
        activePrefix,
        prefixes: progressByPrefix,
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

function TimeAttackGame() {
  const [prefix, setPrefix] = useState(DEFAULT_PREFIX);
  const [allWords, setAllWords] = useState([]);
  const [foundEntries, setFoundEntries] = useState([]);
  const [score, setScore] = useState(0);
  const [roundDuration, setRoundDuration] = useState(DEFAULT_TIME_ATTACK_SECONDS);
  const [timeLeft, setTimeLeft] = useState(DEFAULT_TIME_ATTACK_SECONDS);
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(false);
  const [roundState, setRoundState] = useState("idle");
  const statusTimerRef = useRef(null);
  const statusIdRef = useRef(0);

  const showStatus = useCallback((nextStatus) => {
    statusIdRef.current += 1;
    setStatus({ id: statusIdRef.current, ...nextStatus });

    if (statusTimerRef.current) {
      clearTimeout(statusTimerRef.current);
    }

    statusTimerRef.current = setTimeout(() => setStatus(null), 1800);
  }, []);

  const loadRandomPrefix = useCallback(async (excludedPrefix) => {
    const nextPrefix = getRandomPrefix(excludedPrefix);

    setLoading(true);
    const result = await createRoundForPrefix(nextPrefix);
    const cleanPrefix = result.prefix.toLocaleLowerCase("pl-PL").trim();
    const cleanWords = [
      ...new Set(
        result.words
          .map((word) => word.toLocaleLowerCase("pl-PL").trim())
          .filter((word) => word.startsWith(cleanPrefix))
      ),
    ];

    setPrefix(cleanPrefix);
    setAllWords(cleanWords);
    setLoading(false);
  }, []);

  const startRound = useCallback(async () => {
    const nextDuration = clampRoundDuration(roundDuration);

    setRoundDuration(nextDuration);
    setFoundEntries([]);
    setScore(0);
    setTimeLeft(nextDuration);
    setStatus(null);
    setRoundState("running");
    await loadRandomPrefix(prefix);
  }, [loadRandomPrefix, prefix, roundDuration]);

  useEffect(() => {
    return () => {
      if (statusTimerRef.current) {
        clearTimeout(statusTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (roundState !== "running") return undefined;

    const timerId = setInterval(() => {
      setTimeLeft((currentTime) => Math.max(0, currentTime - 1));
    }, 1000);

    return () => clearInterval(timerId);
  }, [roundState]);

  useEffect(() => {
    if (roundState === "running" && timeLeft === 0) {
      setRoundState("finished");
      setLoading(false);
      showStatus({ type: "success", message: `Koniec czasu. Wynik: ${score}` });
    }
  }, [roundState, score, showStatus, timeLeft]);

  const handleSubmitWord = async (word) => {
    if (roundState !== "running" || loading) return;

    if (!word.startsWith(prefix)) {
      showStatus({ type: "error", message: `Słowo musi zaczynać się od "${prefix}"` });
      return;
    }

    if (foundEntries.some((entry) => entry.word === word)) {
      showStatus({ type: "duplicate", message: "To słowo już padło w tej rundzie" });
      return;
    }

    if (!allWords.includes(word)) {
      showStatus({ type: "error", message: "SJP nie podaje takiego słowa dla tego prefiksu" });
      return;
    }

    const points = getWordScore(word);
    setFoundEntries((entries) => [{ word, prefix, points }, ...entries]);
    setScore((currentScore) => currentScore + points);
    showStatus({ type: "success", message: `+${points} pkt` });

    if (timeLeft > 0) {
      await loadRandomPrefix(prefix);
    }
  };

  const isRunning = roundState === "running";
  const latestEntries = foundEntries.slice(0, 18);
  const displayedTime = isRunning || roundState === "finished" ? timeLeft : roundDuration;

  const handleRoundDurationChange = (value) => {
    if (isRunning) return;

    const nextDuration = clampRoundDuration(value);
    setRoundDuration(nextDuration);
    setTimeLeft(nextDuration);
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-5 gap-6 lg:gap-8">
      <div className="lg:col-span-2 space-y-6">
        <div className="rounded-lg border border-border bg-card p-5 space-y-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <span className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
                Tryb na czas
              </span>
              <div className="mt-1 text-3xl font-bold tabular-nums text-foreground">
                {displayedTime}s
              </div>
            </div>
            <div className="text-right">
              <span className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
                Wynik
              </span>
              <div className="mt-1 text-3xl font-bold tabular-nums text-accent">
                {score}
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between gap-3">
              <span className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
                Czas rundy
              </span>
              <div className="flex items-center gap-2">
                <Input
                  type="number"
                  min={MIN_TIME_ATTACK_SECONDS}
                  max={MAX_TIME_ATTACK_SECONDS}
                  step="5"
                  value={roundDuration}
                  onChange={(event) => handleRoundDurationChange(event.target.value)}
                  disabled={isRunning}
                  className="h-9 w-20 text-right font-semibold tabular-nums"
                />
                <span className="text-sm font-medium text-muted-foreground">s</span>
              </div>
            </div>

            <div className="grid grid-cols-4 gap-1.5">
              {QUICK_ROUND_DURATIONS.map((duration) => (
                <Button
                  key={duration}
                  type="button"
                  variant={roundDuration === duration ? "default" : "outline"}
                  size="sm"
                  onClick={() => handleRoundDurationChange(duration)}
                  disabled={isRunning}
                  className="h-8 px-2 tabular-nums"
                >
                  {duration}s
                </Button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2 text-sm">
            <div className="rounded-md border border-border bg-background/60 px-3 py-2">
              <span className="block text-xs font-medium uppercase tracking-widest text-muted-foreground">
                Słowa
              </span>
              <span className="text-lg font-bold tabular-nums">{foundEntries.length}</span>
            </div>
            <div className="rounded-md border border-border bg-background/60 px-3 py-2">
              <span className="block text-xs font-medium uppercase tracking-widest text-muted-foreground">
                Punkty
              </span>
              <span className="text-lg font-bold tabular-nums">{SCORE_PER_LETTER}/litera</span>
            </div>
          </div>

          <Button type="button" onClick={startRound} disabled={loading} className="h-11 w-full gap-2">
            {roundState === "idle" ? (
              <Timer className="h-4 w-4" />
            ) : (
              <RotateCcw className="h-4 w-4" />
            )}
            {roundState === "idle" ? "Start" : "Nowa runda"}
          </Button>
        </div>

        <PrefixDisplay prefix={prefix} />

        <WordInput onSubmit={handleSubmitWord} disabled={!isRunning || loading} />

        <StatusToast status={status} />
      </div>

      <div className="lg:col-span-3 space-y-6">
        {roundState === "finished" && (
          <div className="rounded-lg border border-accent/25 bg-accent/10 p-5">
            <div className="flex items-center gap-3">
              <Trophy className="h-7 w-7 text-accent" />
              <div>
                <span className="text-xs font-medium uppercase tracking-widest text-accent">
                  Twój wynik
                </span>
                <div className="text-3xl font-bold tabular-nums text-foreground">{score}</div>
              </div>
            </div>
          </div>
        )}

        <div className="bg-card border border-border rounded-lg p-5 space-y-5">
          <div className="flex items-baseline justify-between">
            <span className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
              Ostatnie trafienia
            </span>
            <span className="text-sm font-semibold tabular-nums text-muted-foreground">
              {foundEntries.length}
            </span>
          </div>

          {latestEntries.length === 0 ? (
            <div className="flex items-center justify-center py-12 text-muted-foreground text-sm">
              Uruchom rundę i wpisz pierwsze słowo
            </div>
          ) : (
            <div className="flex flex-wrap gap-1.5">
              {latestEntries.map((entry) => (
                <span
                  key={`${entry.prefix}:${entry.word}`}
                  className="inline-flex items-center gap-1 px-2.5 py-1 bg-accent/10 text-accent border border-accent/20 rounded-md text-sm font-medium"
                >
                  <Check className="w-3 h-3" />
                  <span>
                    <span className="font-bold">{entry.prefix}</span>
                    {entry.word.slice(entry.prefix.length)}
                  </span>
                  <span className="text-xs font-bold tabular-nums text-muted-foreground">
                    +{entry.points}
                  </span>
                </span>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function Game() {
  const [gameMode, setGameMode] = useState(() =>
    new URLSearchParams(window.location.search).has("room") ? "online" : "classic"
  );
  const [prefix, setPrefix] = useState(DEFAULT_PREFIX);
  const [allWords, setAllWords] = useState([]);
  const [prefixProgress, setPrefixProgress] = useState(() => createEmptyPrefixProgress());
  const [wordCounts, setWordCounts] = useState({});
  const [totalXp, setTotalXp] = useState(readSharedTotalXp);
  const [lastXpGain, setLastXpGain] = useState(null);
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(false);
  const [initialized, setInitialized] = useState(false);
  const [loadedWordMode, setLoadedWordMode] = useState("classic");
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

  const loadPrefixWords = useCallback(async (nextPrefix, mode = "classic") => {
    if (!nextPrefix) return;

    setLoading(true);
    setStatus(null);
    setLastXpGain(null);

    const result = await createRoundForPrefix(nextPrefix, mode);
    const cleanPrefix = result.prefix.toLocaleLowerCase("pl-PL").trim();
    const cleanWords = result.words
      .map((word) => word.toLocaleLowerCase("pl-PL").trim())
      .filter((word) => matchesWordMode(word, cleanPrefix, mode));
    const uniqueWords = [...new Set(cleanWords)];

    setPrefix(cleanPrefix);
    setAllWords(uniqueWords);
    setWordCounts((prev) => ({ ...prev, [cleanPrefix]: uniqueWords.length }));
    setLoading(false);
  }, []);

  const loadPrefixCounts = useCallback(async (mode = "classic") => {
    setWordCounts(await getPrefixCounts(mode));
  }, []);

  useEffect(() => {
    return () => {
      if (statusTimerRef.current) {
        clearTimeout(statusTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    const initialWordMode = getWordModeFromGameMode(gameMode);
    const savedGame = readSavedGame(initialWordMode);
    const fallbackPrefix = getDefaultPrefix(initialWordMode);

    if (!["classic", "reverse"].includes(gameMode)) return;

    setInitialized(false);

    if (savedGame) {
      setPrefix(savedGame.activePrefix);
      setPrefixProgress(savedGame.progressByPrefix);
      loadPrefixWords(savedGame.activePrefix, initialWordMode).then(() => {
        setLoadedWordMode(initialWordMode);
        setInitialized(true);
      });
    } else {
      setPrefix(fallbackPrefix);
      setPrefixProgress(createEmptyPrefixProgress(initialWordMode));
      loadPrefixWords(fallbackPrefix, initialWordMode).then(() => {
        setLoadedWordMode(initialWordMode);
        setInitialized(true);
      });
    }

    loadPrefixCounts(initialWordMode);
  }, [gameMode, loadPrefixCounts, loadPrefixWords]);

  useEffect(() => {
    if (
      !initialized ||
      !prefix ||
      loading ||
      !["classic", "reverse"].includes(gameMode) ||
      loadedWordMode !== getWordModeFromGameMode(gameMode)
    ) return;

    saveGame(prefix, prefixProgress, getWordModeFromGameMode(gameMode));
  }, [gameMode, initialized, loadedWordMode, loading, prefix, prefixProgress]);

  useEffect(() => {
    saveSharedTotalXp(totalXp);
  }, [totalXp]);

  const currentWordMode = getWordModeFromGameMode(gameMode);
  const currentWordModeConfig = getWordModeConfig(currentWordMode);
  const currentPrefixes = currentWordModeConfig.affixes;
  const currentProgress = prefixProgress[prefix] || {
    foundWords: [],
    revealedMissing: false,
  };
  const foundWords = currentProgress.foundWords;
  const isCurrentPrefixLocked = currentProgress.revealedMissing;
  const totalFoundWords = currentPrefixes.reduce(
    (sum, currentPrefix) => sum + (prefixProgress[currentPrefix]?.foundWords.length || 0),
    0
  );
  const totalAvailableWords = currentPrefixes.reduce(
    (sum, currentPrefix) => sum + (typeof wordCounts[currentPrefix] === "number" ? wordCounts[currentPrefix] : 0),
    0
  );
  const allAffixesProgressLabel = currentWordMode === "reverse"
    ? "Postęp wszystkich końcówek"
    : "Postęp wszystkich prefiksów";
  const currentAffixProgressLabel = currentWordMode === "reverse"
    ? "Postęp końcówki"
    : "Postęp prefiksu";

  const handleSelectPrefix = (nextPrefix) => {
    if (nextPrefix === prefix || loading) return;

    loadPrefixWords(nextPrefix, currentWordMode);
  };

  const handleResetGame = async () => {
    try {
      window.localStorage.removeItem(currentWordModeConfig.storageKey);
    } catch {
      // localStorage can be unavailable in private mode.
    }

    const defaultPrefix = getDefaultPrefix(currentWordMode);

    setPrefixProgress(createEmptyPrefixProgress(currentWordMode));
    setLastXpGain(null);
    await loadPrefixWords(defaultPrefix, currentWordMode);
    showStatus({ type: "success", message: "Postęp trybu zresetowany. XP zostaje wspólne." });
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
      message: currentWordMode === "reverse"
        ? "Brakujące słowa odkryte. Ta końcówka jest teraz zablokowana."
        : "Brakujące słowa odkryte. Ten prefiks jest teraz zablokowany.",
    });
  };

  const handleSubmitWord = (word) => {
    if (isCurrentPrefixLocked) {
      showStatus({
        type: "error",
        message: `Ta ${currentWordModeConfig.label} jest zablokowana po odkryciu brakujących słów.`,
      });
      return;
    }

    if (!matchesWordMode(word, prefix, currentWordMode)) {
      showStatus({
        type: "error",
        message: currentWordMode === "reverse"
          ? `Słowo musi kończyć się na "${prefix}"`
          : `Słowo musi zaczynać się od "${prefix}"`,
      });
      return;
    }

    if (foundWords.includes(word)) {
      showStatus({ type: "duplicate", message: "To słowo już jest na liście" });
      return;
    }

    if (!allWords.includes(word)) {
      showStatus({
        type: "error",
        message: currentWordMode === "reverse"
          ? "SJP nie podaje takiego słowa dla tej końcówki"
          : "SJP nie podaje takiego słowa dla tego prefiksu",
      });
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

  if (["classic", "reverse"].includes(gameMode) && !initialized) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-3 text-muted-foreground">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
        <span className="text-sm font-medium">
          {currentWordMode === "reverse" ? "Przygotowywanie końcówek..." : "Przygotowywanie prefiksów..."}
        </span>
      </div>
    );
  }

  return (
    <div className="relative min-h-screen bg-background">
      <BackgroundVideo />

      <header className="relative z-10 border-b border-border bg-card">
        <div className="max-w-5xl mx-auto px-4 py-2 sm:px-6 min-h-14 flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-lg font-bold text-foreground tracking-tight">
            Gra w rzeczowniki
          </h1>
          <div className="flex flex-wrap items-center justify-end gap-2">
            <Button
              type="button"
              variant={gameMode === "classic" ? "default" : "outline"}
              size="sm"
              onClick={() => setGameMode("classic")}
              className="h-9 gap-2"
            >
              Klasyczny
            </Button>
            <Button
              type="button"
              variant={gameMode === "reverse" ? "default" : "outline"}
              size="sm"
              onClick={() => setGameMode("reverse")}
              className="h-9 gap-2"
            >
              <RotateCcw className="h-4 w-4" />
              Odwrotny
            </Button>
            <Button
              type="button"
              variant={gameMode === "time" ? "default" : "outline"}
              size="sm"
              onClick={() => setGameMode("time")}
              className="h-9 gap-2"
            >
              <Timer className="h-4 w-4" />
              Czas
            </Button>
            <Button
              type="button"
              variant={gameMode === "online" ? "default" : "outline"}
              size="sm"
              onClick={() => setGameMode("online")}
              className="h-9 gap-2"
            >
              <Globe2 className="h-4 w-4" />
              Online
            </Button>
            {["classic", "reverse"].includes(gameMode) && (
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
            )}
          </div>
        </div>
      </header>

      <main className="relative z-10 max-w-5xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
        {gameMode === "online" ? (
          <OnlineGame />
        ) : gameMode === "time" ? (
          <TimeAttackGame />
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-6 lg:gap-8">
          <div className="lg:col-span-2 space-y-6">
            <PrefixDisplay prefix={prefix} mode={currentWordMode} />

            <LevelProgress
              levelState={getLevelState(totalXp)}
              lastGain={lastXpGain}
            />

            <div className="rounded-lg border border-border bg-card p-4">
              <ProgressCounter
                found={totalFoundWords}
                total={totalAvailableWords}
                label={allAffixesProgressLabel}
              />
            </div>

            <WordInput
              onSubmit={handleSubmitWord}
              disabled={loading || isCurrentPrefixLocked}
            />

            {isCurrentPrefixLocked && (
              <div className="rounded-lg border border-yellow-500/25 bg-yellow-500/10 px-3 py-2 text-sm font-medium text-yellow-700">
                {currentWordMode === "reverse"
                  ? "Ta końcówka jest zablokowana, bo pokazano brakujące słowa."
                  : "Ten prefiks jest zablokowany, bo pokazano brakujące słowa."}
              </div>
            )}

            <StatusToast status={status} />

            <PrefixList
              prefixes={currentPrefixes}
              activePrefix={prefix}
              progressByPrefix={prefixProgress}
              wordCounts={wordCounts}
              onSelect={handleSelectPrefix}
              disabled={loading}
              title={currentWordModeConfig.listTitle}
            />
          </div>

          <div className="lg:col-span-3 space-y-6">
            <div className="bg-card border border-border rounded-lg p-5 space-y-5">
              <ProgressCounter
                found={foundWords.length}
                total={allWords.length}
                label={currentAffixProgressLabel}
              />

              <div className="border-t border-border pt-4">
                <span className="text-xs font-medium uppercase tracking-widest text-muted-foreground mb-3 block">
                  Znalezione
                </span>
                <WordList words={foundWords} prefix={prefix} mode={currentWordMode} />
              </div>

              <div className="border-t border-border pt-4">
                <MissingWords
                  words={allWords}
                  prefix={prefix}
                  foundWords={foundWords}
                  revealed={isCurrentPrefixLocked}
                  onReveal={handleRevealMissing}
                  mode={currentWordMode}
                />
              </div>
            </div>
          </div>
        </div>
        )}
      </main>
    </div>
  );
}
