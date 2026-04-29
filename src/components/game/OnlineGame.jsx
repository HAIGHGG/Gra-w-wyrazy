import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Check, Copy, Lightbulb, Link2, LogOut, Play, Radio, RotateCcw, Trophy, Users } from "lucide-react";
import { io } from "socket.io-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import PrefixDisplay from "./PrefixDisplay";
import StatusToast from "./StatusToast";
import WordInput from "./WordInput";

const DEFAULT_DURATION = 60;
const MIN_DURATION = 10;
const MAX_DURATION = 300;
const QUICK_DURATIONS = [30, 60, 90, 120];

function clampDuration(value) {
  const duration = Math.floor(Number(value));

  if (!Number.isFinite(duration)) {
    return DEFAULT_DURATION;
  }

  return Math.min(MAX_DURATION, Math.max(MIN_DURATION, duration));
}

function sortPlayers(players) {
  return [...players].sort((a, b) => b.score - a.score || a.name.localeCompare(b.name, "pl"));
}

function getInitialRoomCode() {
  return new URLSearchParams(window.location.search).get("room")?.trim().toUpperCase() || "";
}

export default function OnlineGame({ onAcceptedWord, onWordAttempt }) {
  const [socket, setSocket] = useState(null);
  const [connected, setConnected] = useState(false);
  const [name, setName] = useState(() => window.localStorage.getItem("gra-w-wyrazy:online-name") || "");
  const [roomCodeInput, setRoomCodeInput] = useState(getInitialRoomCode);
  const [duration, setDuration] = useState(DEFAULT_DURATION);
  const [room, setRoom] = useState(null);
  const [playerState, setPlayerState] = useState({
    prefix: "",
    score: 0,
    wordCount: 0,
    isHost: false,
    hint: "",
    hintCount: 0,
    maxHints: 0,
  });
  const [timeLeft, setTimeLeft] = useState(0);
  const [status, setStatus] = useState(null);
  const statusTimerRef = useRef(null);
  const statusIdRef = useRef(0);
  const serverClockOffsetRef = useRef(0);

  const showStatus = useCallback((nextStatus) => {
    statusIdRef.current += 1;
    setStatus({ id: statusIdRef.current, ...nextStatus });

    if (statusTimerRef.current) {
      clearTimeout(statusTimerRef.current);
    }

    statusTimerRef.current = setTimeout(() => setStatus(null), 2200);
  }, []);

  useEffect(() => {
    const nextSocket = io({
      transports: ["websocket", "polling"],
    });

    setSocket(nextSocket);

    nextSocket.on("connect", () => setConnected(true));
    nextSocket.on("disconnect", () => setConnected(false));
    nextSocket.on("online:roomState", (nextRoom) => {
      if (typeof nextRoom.serverNow === "number") {
        serverClockOffsetRef.current = nextRoom.serverNow - Date.now();
      }

      setRoom(nextRoom);
      setDuration(nextRoom.duration);
    });
    nextSocket.on("online:playerState", (nextPlayerState) => {
      setPlayerState(nextPlayerState);
    });

    return () => {
      nextSocket.disconnect();

      if (statusTimerRef.current) {
        clearTimeout(statusTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (!room?.endsAt || room.state !== "running") {
      setTimeLeft(0);
      return undefined;
    }

    const updateTimeLeft = () => {
      const serverNow = Date.now() + serverClockOffsetRef.current;
      const secondsLeft = Math.ceil((room.endsAt - serverNow) / 1000);

      setTimeLeft(Math.min(room.duration, Math.max(0, secondsLeft)));
    };

    updateTimeLeft();
    const timerId = setInterval(updateTimeLeft, 250);

    return () => clearInterval(timerId);
  }, [room?.endsAt, room?.state]);

  const currentPlayer = useMemo(() => {
    if (!socket || !room) return null;

    return room.players.find((player) => player.id === socket.id) || null;
  }, [room, socket]);

  const isHost = Boolean(currentPlayer?.isHost || playerState.isHost);
  const isRunning = room?.state === "running";
  const isFinished = room?.state === "finished";
  const players = room?.players || [];
  const rankedPlayers = sortPlayers(players);

  const handleNameChange = (value) => {
    setName(value);
    window.localStorage.setItem("gra-w-wyrazy:online-name", value);
  };

  const handleDurationChange = (value) => {
    if (isRunning) return;

    const nextDuration = clampDuration(value);
    setDuration(nextDuration);

    if (socket && room && isHost) {
      socket.emit("online:setDuration", { duration: nextDuration });
    }
  };

  const emitWithAck = (event, payload) =>
    new Promise((resolve) => {
      socket.emit(event, payload, resolve);
    });

  const createRoom = async () => {
    if (!socket || !connected) return;

    const response = await emitWithAck("online:createRoom", {
      name,
      duration,
    });

    if (!response?.ok) {
      showStatus({ type: "error", message: response?.error || "Nie udało się utworzyć pokoju." });
      return;
    }

    setRoom(response.room);
    setPlayerState((state) => ({ ...state, ...response.player, isHost: true }));
    showStatus({ type: "success", message: "Pokój utworzony." });
  };

  const joinRoom = async () => {
    if (!socket || !connected) return;

    const response = await emitWithAck("online:joinRoom", {
      name,
      code: roomCodeInput,
    });

    if (!response?.ok) {
      showStatus({ type: "error", message: response?.error || "Nie udało się dołączyć." });
      return;
    }

    setRoom(response.room);
    setPlayerState((state) => ({ ...state, ...response.player }));
    setRoomCodeInput("");
    showStatus({ type: "success", message: "Dołączono do pokoju." });
  };

  const startRound = async () => {
    if (!socket || !room || !isHost) return;

    const response = await emitWithAck("online:startRound", {});

    if (!response?.ok) {
      showStatus({ type: "error", message: response?.error || "Nie udało się rozpocząć rundy." });
    }
  };

  const leaveRoom = () => {
    socket?.emit("online:leaveRoom");
    setRoom(null);
    setPlayerState({ prefix: "", score: 0, wordCount: 0, isHost: false, hint: "", hintCount: 0, maxHints: 0 });
    setTimeLeft(0);
  };

  const copyRoomCode = async () => {
    if (!room?.code) return;

    try {
      await navigator.clipboard.writeText(room.code);
      showStatus({ type: "success", message: "Kod pokoju skopiowany." });
    } catch {
      showStatus({ type: "duplicate", message: `Kod pokoju: ${room.code}` });
    }
  };

  const copyRoomLink = async () => {
    if (!room?.code) return;

    const inviteUrl = `${window.location.origin}${window.location.pathname}?room=${room.code}`;

    try {
      await navigator.clipboard.writeText(inviteUrl);
      showStatus({ type: "success", message: "Link zaproszenia skopiowany." });
    } catch {
      showStatus({ type: "duplicate", message: inviteUrl });
    }
  };

  const submitWord = async (word) => {
    if (!socket || !room || !isRunning) return;

    onWordAttempt?.(word, playerState.prefix, "classic");

    const response = await emitWithAck("online:submitWord", { word });

    if (!response?.ok) {
      showStatus({ type: "error", message: response?.error || "Nie przyjęto słowa." });
      return;
    }

    showStatus({ type: "success", message: `+${response.points} pkt` });
    onAcceptedWord?.();
  };

  const requestHint = async () => {
    if (!socket || !room || !isRunning) return;

    const response = await emitWithAck("online:requestHint", {});

    if (!response?.ok) {
      showStatus({ type: "error", message: response?.error || "Nie udało się pobrać podpowiedzi." });
      return;
    }

    if (response.hintCount >= response.maxHints) {
      showStatus({ type: "duplicate", message: "Odkryto wszystkie litery podpowiedzi." });
    } else {
      showStatus({ type: "duplicate", message: "Dodano podpowiedź." });
    }
  };

  if (!room) {
    return (
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6 lg:gap-8">
        <div className="lg:col-span-2 space-y-6">
          <div className="rounded-lg border border-border bg-card p-5 space-y-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <span className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
                  Online
                </span>
                <h2 className="mt-1 text-2xl font-bold text-foreground">Pokój gry</h2>
              </div>
              <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
                <Radio className={connected ? "h-4 w-4 text-accent" : "h-4 w-4 text-destructive"} />
                {connected ? "połączono" : "łączenie"}
              </span>
            </div>

            <div className="space-y-2">
              <span className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
                Nick
              </span>
              <Input
                value={name}
                onChange={(event) => handleNameChange(event.target.value)}
                placeholder="Twój nick"
                maxLength={24}
                className="h-11"
              />
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between gap-3">
                <span className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
                  Czas rundy
                </span>
                <div className="flex items-center gap-2">
                  <Input
                    type="number"
                    min={MIN_DURATION}
                    max={MAX_DURATION}
                    step="5"
                    value={duration}
                    onChange={(event) => handleDurationChange(event.target.value)}
                    className="h-9 w-20 text-right font-semibold tabular-nums"
                  />
                  <span className="text-sm font-medium text-muted-foreground">s</span>
                </div>
              </div>
              <div className="grid grid-cols-4 gap-1.5">
                {QUICK_DURATIONS.map((option) => (
                  <Button
                    key={option}
                    type="button"
                    variant={duration === option ? "default" : "outline"}
                    size="sm"
                    onClick={() => handleDurationChange(option)}
                    className="h-8 px-2 tabular-nums"
                  >
                    {option}s
                  </Button>
                ))}
              </div>
            </div>

            <Button type="button" onClick={createRoom} disabled={!connected} className="h-11 w-full gap-2">
              <Users className="h-4 w-4" />
              Utwórz pokój
            </Button>
          </div>

          <StatusToast status={status} />
        </div>

        <div className="lg:col-span-3">
          <div className="bg-card border border-border rounded-lg p-5 space-y-4">
            <span className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
              {roomCodeInput ? "Zaproszenie" : "Dołącz kodem"}
            </span>
            <div className="flex flex-col gap-2 sm:flex-row">
              <Input
                value={roomCodeInput}
                onChange={(event) => setRoomCodeInput(event.target.value.toUpperCase())}
                placeholder="Kod pokoju"
                maxLength={5}
                className="h-11 font-mono text-lg font-bold uppercase tracking-widest"
              />
              <Button
                type="button"
                onClick={joinRoom}
                disabled={!connected || roomCodeInput.trim().length < 5}
                className="h-11 shrink-0"
              >
                Dołącz
              </Button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-5 gap-6 lg:gap-8">
      <div className="lg:col-span-2 space-y-6">
        <div className="rounded-lg border border-border bg-card p-5 space-y-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <span className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
                Pokój
              </span>
              <div className="mt-1 font-mono text-3xl font-bold tracking-widest text-foreground">
                {room.code}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button type="button" variant="outline" size="icon" onClick={copyRoomCode} aria-label="Kopiuj kod">
                <Copy className="h-4 w-4" />
              </Button>
              <Button type="button" variant="outline" size="icon" onClick={copyRoomLink} aria-label="Kopiuj link">
                <Link2 className="h-4 w-4" />
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2 text-sm">
            <div className="rounded-md border border-border bg-background/60 px-3 py-2">
              <span className="block text-xs font-medium uppercase tracking-widest text-muted-foreground">
                Czas
              </span>
              <span className="text-lg font-bold tabular-nums">
                {isRunning ? `${timeLeft}s` : `${room.duration}s`}
              </span>
            </div>
            <div className="rounded-md border border-border bg-background/60 px-3 py-2">
              <span className="block text-xs font-medium uppercase tracking-widest text-muted-foreground">
                Gracze
              </span>
              <span className="text-lg font-bold tabular-nums">{players.length}</span>
            </div>
          </div>

          {isHost && !isRunning && (
            <div className="space-y-2">
              <div className="flex items-center justify-between gap-3">
                <span className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
                  Czas rundy
                </span>
                <div className="flex items-center gap-2">
                  <Input
                    type="number"
                    min={MIN_DURATION}
                    max={MAX_DURATION}
                    step="5"
                    value={duration}
                    onChange={(event) => handleDurationChange(event.target.value)}
                    className="h-9 w-20 text-right font-semibold tabular-nums"
                  />
                  <span className="text-sm font-medium text-muted-foreground">s</span>
                </div>
              </div>
              <div className="grid grid-cols-4 gap-1.5">
                {QUICK_DURATIONS.map((option) => (
                  <Button
                    key={option}
                    type="button"
                    variant={duration === option ? "default" : "outline"}
                    size="sm"
                    onClick={() => handleDurationChange(option)}
                    className="h-8 px-2 tabular-nums"
                  >
                    {option}s
                  </Button>
                ))}
              </div>
            </div>
          )}

          <div className="flex gap-2">
            {isHost && (
              <Button type="button" onClick={startRound} disabled={isRunning || players.length === 0} className="h-10 flex-1 gap-2">
                {isFinished ? <RotateCcw className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                {isFinished ? "Nowa runda" : "Start"}
              </Button>
            )}
            <Button type="button" variant="outline" onClick={leaveRoom} className="h-10 gap-2">
              <LogOut className="h-4 w-4" />
              Wyjdź
            </Button>
          </div>
        </div>

        {isRunning && playerState.prefix ? (
          <PrefixDisplay prefix={playerState.prefix} />
        ) : (
          <div className="rounded-lg border border-border bg-card p-5">
            <span className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
              Prefiks
            </span>
            <div className="mt-2 text-sm font-medium text-muted-foreground">
              Pojawi się po starcie rundy.
            </div>
          </div>
        )}
        {isRunning && playerState.prefix && (
          <div className="rounded-lg border border-border bg-card p-4 space-y-3">
            <div className="flex items-center justify-between gap-3">
              <div>
                <span className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
                  Podpowiedź
                </span>
                <div className="mt-1 font-mono text-lg font-bold text-foreground">
                  {playerState.hint ? `${playerState.prefix}${playerState.hint}` : "brak"}
                </div>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={requestHint}
                disabled={!isRunning || playerState.hintCount >= playerState.maxHints}
                className="h-9 gap-2"
              >
                <Lightbulb className="h-4 w-4" />
                Litera
              </Button>
            </div>
            <div className="text-xs font-medium text-muted-foreground">
              {playerState.hintCount} / {playerState.maxHints} użytych
            </div>
          </div>
        )}
        <WordInput onSubmit={submitWord} disabled={!isRunning || !playerState.prefix} />
        <StatusToast status={status} />
      </div>

      <div className="lg:col-span-3 space-y-6">
        {isFinished && (
          <div className="rounded-lg border border-accent/25 bg-accent/10 p-5">
            <div className="flex items-center gap-3">
              <Trophy className="h-7 w-7 text-accent" />
              <div>
                <span className="text-xs font-medium uppercase tracking-widest text-accent">
                  Wynik końcowy
                </span>
                <div className="text-3xl font-bold tabular-nums text-foreground">
                  {rankedPlayers[0]?.score || 0}
                </div>
              </div>
            </div>
          </div>
        )}

        <div className="bg-card border border-border rounded-lg p-5 space-y-4">
          <div className="flex items-center justify-between gap-3">
            <span className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
              Wyniki
            </span>
            <span className="text-xs font-semibold text-muted-foreground">
              {isRunning ? "runda trwa" : isFinished ? "koniec rundy" : "lobby"}
            </span>
          </div>

          <div className="space-y-2">
            {rankedPlayers.map((player, index) => {
              const displayedWords = isFinished ? player.words : player.words.slice(0, 6);

              return (
                <div
                  key={player.id}
                  className="rounded-md border border-border bg-background/60 px-3 py-2"
                >
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="w-6 text-sm font-bold tabular-nums text-muted-foreground">
                        #{index + 1}
                      </span>
                      <span className="truncate font-semibold text-foreground">
                        {player.name}
                      </span>
                      {player.isHost && (
                        <span className="rounded bg-primary/10 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-primary">
                          host
                        </span>
                      )}
                    </div>
                    <div className="mt-1 text-xs font-medium text-muted-foreground">
                      {player.wordCount} słów
                    </div>
                  </div>
                  <span className="text-xl font-bold tabular-nums text-accent">
                    {player.score}
                  </span>
                </div>

                {displayedWords.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1">
                    {displayedWords.map((entry) => (
                      <span
                        key={`${player.id}:${entry.prefixIndex}:${entry.prefix}:${entry.word}`}
                        className="inline-flex items-center gap-1 rounded border border-accent/20 bg-accent/10 px-2 py-0.5 text-xs font-medium text-accent"
                      >
                        <Check className="h-3 w-3" />
                        {entry.hidden ? (
                          <span>
                            <span className="font-bold">{entry.prefix}</span>
                            {"***"}
                          </span>
                        ) : (
                          <span>
                            <span className="font-bold">{entry.prefix}</span>
                            {entry.word.slice(entry.prefix.length)}
                          </span>
                        )}
                        {entry.hintsUsed > 0 && !entry.hidden && (
                          <span className="font-bold tabular-nums text-yellow-700 dark:text-yellow-300">
                            <Lightbulb className="inline h-3 w-3" />
                            {entry.hintsUsed}
                          </span>
                        )}
                        <span className="font-bold tabular-nums text-muted-foreground">+{entry.points}</span>
                      </span>
                    ))}
                  </div>
                )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
