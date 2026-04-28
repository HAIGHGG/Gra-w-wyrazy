import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";
import express from "express";
import { Server } from "socket.io";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, "..");
const distDir = path.join(rootDir, "dist");
const wordsPath = path.join(rootDir, "public", "sjp-growy.txt");
const prefixesPath = path.join(rootDir, "src", "data", "prefixes.json");

const PORT = Number(process.env.PORT) || 4173;
const SCORE_PER_LETTER = 10;
const DEFAULT_ROUND_SECONDS = 60;
const MIN_ROUND_SECONDS = 10;
const MAX_ROUND_SECONDS = 300;
const ROOM_CODE_LENGTH = 5;

const words = fs.readFileSync(wordsPath, "utf8").split(/\r?\n/).filter(Boolean);
const prefixes = JSON.parse(fs.readFileSync(prefixesPath, "utf8"));
const prefixLengths = [...new Set(prefixes.map((prefix) => prefix.length))];
const dictionaryByPrefix = new Map(prefixes.map((prefix) => [prefix, new Set()]));
const rooms = new Map();

for (const word of words) {
  for (const length of prefixLengths) {
    if (word.length >= length) {
      const prefix = word.slice(0, length);

      if (dictionaryByPrefix.has(prefix)) {
        dictionaryByPrefix.get(prefix).add(word);
      }
    }
  }
}

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: true,
  },
});

app.use(express.static(distDir));
app.get(/.*/, (req, res) => {
  res.sendFile(path.join(distDir, "index.html"));
});

function clampRoundDuration(value) {
  const duration = Math.floor(Number(value));

  if (!Number.isFinite(duration)) {
    return DEFAULT_ROUND_SECONDS;
  }

  return Math.min(MAX_ROUND_SECONDS, Math.max(MIN_ROUND_SECONDS, duration));
}

function normalizeRoomCode(value) {
  return String(value || "").trim().toUpperCase();
}

function normalizePlayerName(value) {
  const name = String(value || "").trim();

  return name.slice(0, 24) || "Gracz";
}

function normalizeWord(value) {
  return String(value || "").trim().toLocaleLowerCase("pl-PL");
}

function createRoomCode() {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";

  do {
    code = "";

    for (let index = 0; index < ROOM_CODE_LENGTH; index += 1) {
      code += alphabet[Math.floor(Math.random() * alphabet.length)];
    }
  } while (rooms.has(code));

  return code;
}

function randomPrefix(excludedPrefix) {
  const availablePrefixes = prefixes.filter((prefix) => prefix !== excludedPrefix);
  const source = availablePrefixes.length > 0 ? availablePrefixes : prefixes;

  return source[Math.floor(Math.random() * source.length)] || "";
}

function createPlayer(socket, name) {
  return {
    id: socket.id,
    name: normalizePlayerName(name),
    score: 0,
    wordCount: 0,
    words: [],
    usedWords: new Set(),
  };
}

function serializePlayer(player, hostId) {
  return {
    id: player.id,
    name: player.name,
    score: player.score,
    wordCount: player.wordCount,
    words: player.words.slice(0, 12),
    isHost: player.id === hostId,
  };
}

function serializeRoom(room) {
  return {
    code: room.code,
    state: room.state,
    duration: room.duration,
    endsAt: room.endsAt,
    serverNow: Date.now(),
    prefix: room.state === "running" ? room.currentPrefix : "",
    players: [...room.players.values()]
      .map((player) => serializePlayer(player, room.hostId))
      .sort((a, b) => b.score - a.score || a.name.localeCompare(b.name, "pl")),
  };
}

function emitRoomState(room) {
  const publicState = serializeRoom(room);

  io.to(room.code).emit("online:roomState", publicState);

  for (const player of room.players.values()) {
    io.to(player.id).emit("online:playerState", {
      prefix: room.state === "running" ? room.currentPrefix : "",
      score: player.score,
      wordCount: player.wordCount,
      isHost: player.id === room.hostId,
    });
  }
}

function finishRoom(room) {
  if (room.timer) {
    clearTimeout(room.timer);
    room.timer = null;
  }

  room.state = "finished";
  room.endsAt = null;
  emitRoomState(room);
}

function resetRoomScores(room) {
  for (const player of room.players.values()) {
    player.score = 0;
    player.wordCount = 0;
    player.words = [];
    player.usedWords = new Set();
  }

  room.currentPrefix = randomPrefix(room.currentPrefix);
}

function startRoom(room) {
  if (room.timer) {
    clearTimeout(room.timer);
  }

  resetRoomScores(room);
  room.state = "running";
  room.endsAt = Date.now() + room.duration * 1000;
  room.timer = setTimeout(() => finishRoom(room), room.duration * 1000);
  emitRoomState(room);
}

function leaveCurrentRoom(socket) {
  const roomCode = socket.data.roomCode;
  if (!roomCode) return;

  const room = rooms.get(roomCode);
  socket.leave(roomCode);
  socket.data.roomCode = null;

  if (!room) return;

  room.players.delete(socket.id);

  if (room.players.size === 0) {
    if (room.timer) {
      clearTimeout(room.timer);
    }

    rooms.delete(roomCode);
    return;
  }

  if (room.hostId === socket.id) {
    room.hostId = room.players.keys().next().value;
  }

  emitRoomState(room);
}

function acknowledge(callback, payload) {
  if (typeof callback === "function") {
    callback(payload);
  }
}

io.on("connection", (socket) => {
  socket.on("online:createRoom", ({ name, duration } = {}, callback) => {
    leaveCurrentRoom(socket);

    const code = createRoomCode();
    const player = createPlayer(socket, name);
    const room = {
      code,
      hostId: socket.id,
      duration: clampRoundDuration(duration),
      state: "idle",
      endsAt: null,
      timer: null,
      currentPrefix: "",
      players: new Map([[socket.id, player]]),
    };

    rooms.set(code, room);
    socket.join(code);
    socket.data.roomCode = code;
    acknowledge(callback, { ok: true, room: serializeRoom(room), player: { prefix: "" } });
    emitRoomState(room);
  });

  socket.on("online:joinRoom", ({ name, code } = {}, callback) => {
    const roomCode = normalizeRoomCode(code);
    const room = rooms.get(roomCode);

    if (!room) {
      acknowledge(callback, { ok: false, error: "Nie znaleziono pokoju." });
      return;
    }

    if (room.state === "running") {
      acknowledge(callback, { ok: false, error: "Runda już trwa." });
      return;
    }

    leaveCurrentRoom(socket);

    const player = createPlayer(socket, name);
    room.players.set(socket.id, player);
    socket.join(roomCode);
    socket.data.roomCode = roomCode;
    acknowledge(callback, { ok: true, room: serializeRoom(room), player: { prefix: room.state === "running" ? room.currentPrefix : "" } });
    emitRoomState(room);
  });

  socket.on("online:setDuration", ({ duration } = {}, callback) => {
    const room = rooms.get(socket.data.roomCode);

    if (!room || room.hostId !== socket.id || room.state === "running") {
      acknowledge(callback, { ok: false });
      return;
    }

    room.duration = clampRoundDuration(duration);
    acknowledge(callback, { ok: true, duration: room.duration });
    emitRoomState(room);
  });

  socket.on("online:startRound", (_payload, callback) => {
    const room = rooms.get(socket.data.roomCode);

    if (!room || room.hostId !== socket.id) {
      acknowledge(callback, { ok: false, error: "Tylko host może rozpocząć rundę." });
      return;
    }

    startRoom(room);
    acknowledge(callback, { ok: true });
  });

  socket.on("online:submitWord", ({ word } = {}, callback) => {
    const room = rooms.get(socket.data.roomCode);
    const player = room?.players.get(socket.id);

    if (!room || !player || room.state !== "running") {
      acknowledge(callback, { ok: false, error: "Runda nie jest aktywna." });
      return;
    }

    if (room.endsAt && Date.now() >= room.endsAt) {
      finishRoom(room);
      acknowledge(callback, { ok: false, error: "Czas minął." });
      return;
    }

    const cleanWord = normalizeWord(word);

    if (!cleanWord.startsWith(room.currentPrefix)) {
      acknowledge(callback, { ok: false, error: `Słowo musi zaczynać się od "${room.currentPrefix}".` });
      return;
    }

    if (player.usedWords.has(cleanWord)) {
      acknowledge(callback, { ok: false, error: "To słowo już padło w tej rundzie." });
      return;
    }

    if (!dictionaryByPrefix.get(room.currentPrefix)?.has(cleanWord)) {
      acknowledge(callback, { ok: false, error: "SJP nie podaje takiego słowa dla tego prefiksu." });
      return;
    }

    const previousPrefix = room.currentPrefix;
    const points = cleanWord.length * SCORE_PER_LETTER;

    player.usedWords.add(cleanWord);
    player.score += points;
    player.wordCount += 1;
    player.words.unshift({ word: cleanWord, prefix: previousPrefix, points });
    player.words = player.words.slice(0, 30);
    room.currentPrefix = randomPrefix(previousPrefix);

    acknowledge(callback, { ok: true, points, prefix: room.currentPrefix });
    emitRoomState(room);
  });

  socket.on("online:leaveRoom", () => {
    leaveCurrentRoom(socket);
  });

  socket.on("disconnect", () => {
    leaveCurrentRoom(socket);
  });
});

server.listen(PORT, "0.0.0.0", () => {
  console.log(`Server listening on port ${PORT}`);
});
