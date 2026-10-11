"use strict";

// ==========================================================
// PRODUCER360 · PULZUS V3 · ROLI TESZTBUILD
// Kör vizuál · 4 ütéses count-in · sikerhez kötött nehezítés
// manuális következő kör · választható groove
// ==========================================================

// ---------- DOM ----------
const practiceCard = document.getElementById("practice-card");
const startBtn = document.getElementById("start-btn");
const nextBtn = document.getElementById("next-btn");
const stopBtn = document.getElementById("stop-btn");
const tapBtn = document.getElementById("tap-btn");
const soundEnabled = document.getElementById("sound-enabled");
const volumeSlider = document.getElementById("volume");
const grooveMode = document.getElementById("groove-mode");
const grooveNote = document.getElementById("groove-note");

const dailyTitle = document.getElementById("daily-title");
const blockStatusLabel = document.getElementById("block-status-label");
const stageDisplay = document.getElementById("stage-display");
const beatProgress = document.getElementById("beat-progress");
const dailyStatus = document.getElementById("daily-status");
const bpmDisplay = document.getElementById("bpm-display");
const dailySteps = [...document.querySelectorAll(".daily-step")];

const modeTitle = document.getElementById("mode-title");
const modeCopy = document.getElementById("mode-copy");
const assistChip = document.getElementById("assist-chip");
const circleStage = document.getElementById("circle-stage");
const orbitHand = document.getElementById("orbit-hand");
const circleBpm = document.getElementById("circle-bpm");
const countIn = document.getElementById("count-in");
const countInNumber = document.getElementById("count-in-number");

const timing = document.getElementById("timing");
const accuracy = document.getElementById("accuracy");
const scoreDisplay = document.getElementById("score");
const streakDisplay = document.getElementById("streak");
const avgErrorDisplay = document.getElementById("avg-error");
const driftDisplay = document.getElementById("drift");

const roundResult = document.getElementById("round-result");
const resultTitle = document.getElementById("result-title");
const roundPointsDisplay = document.getElementById("round-points");
const roundHitsDisplay = document.getElementById("round-hits");
const roundAverageDisplay = document.getElementById("round-average");
const roundBestDisplay = document.getElementById("round-best");
const progressionNote = document.getElementById("progression-note");

const blockSummary = document.getElementById("block-summary");
const summaryKicker = document.getElementById("summary-kicker");
const summaryTitle = document.getElementById("summary-title");
const summarySubtitle = document.getElementById("summary-subtitle");
const summaryBadge = document.getElementById("summary-badge");
const summaryScore = document.getElementById("summary-score");
const summaryAccuracy = document.getElementById("summary-accuracy");
const summaryAverage = document.getElementById("summary-average");
const summaryDrift = document.getElementById("summary-drift");
const evaluationBtn = document.getElementById("evaluation-btn");
const continueBtn = document.getElementById("continue-btn");
const evaluationPanel = document.getElementById("evaluation-panel");
const adviceHeadline = document.getElementById("advice-headline");
const adviceTrend = document.getElementById("advice-trend");
const adviceAnalysis = document.getElementById("advice-analysis");
const adviceFocus = document.getElementById("advice-focus");
const adviceGoal = document.getElementById("advice-goal");
const comparisonNote = document.getElementById("comparison-note");
const continueFromEval = document.getElementById("continue-from-eval");

const bestScoreDisplay = document.getElementById("best-score");
const bestStreakDisplay = document.getElementById("best-streak");

// ---------- JÁTÉKSZABÁLYOK ----------
const BEATS_PER_ROUND = 8;
const ROUNDS_PER_BLOCK = 5;
const COUNT_IN_BEATS = 4;
const START_CUE_BEATS = 1;
const INPUT_WINDOW_MS = 140;
const LOOKAHEAD_MS = 25;
const SCHEDULE_AHEAD = 0.12;
const STORAGE_KEY = "producer360PulseV3Roli";
const MAX_BPM = 120;

// A nehézség NEM a körszámmal nő. Csak sikeres kör után lép tovább.
const LEVELS = [
    {
        name: "STABILITÁS",
        bpm: [60, 72],
        visual: 1,
        targetMs: 90,
        passAvgMs: 75,
        ghost: false,
        copy: "Kövesd a körön haladó jelölőt. Akkor koppints, amikor felér a célponthoz."
    },
    {
        name: "KONTROLL",
        bpm: [68, 82],
        visual: .82,
        targetMs: 75,
        passAvgMs: 65,
        ghost: false,
        copy: "A vizuál még stabil kapaszkodó. A cél, hogy már ne reakcióból, hanem előre érezve koppints."
    },
    {
        name: "PONTOSSÁG",
        bpm: [76, 90],
        visual: .62,
        targetMs: 60,
        passAvgMs: 55,
        ghost: false,
        copy: "A vizuális segítség halványabb. Tartsd a pulzust inkább a füleddel és a testeddel."
    },
    {
        name: "FÓKUSZ",
        bpm: [82, 98],
        visual: .38,
        targetMs: 52,
        passAvgMs: 50,
        ghost: false,
        copy: "Kevés vizuális segítség marad. Ne üldözd a jelölőt: tarts egyenletes belső pulzust."
    },
    {
        name: "BELSŐ ÓRA",
        bpm: [64, 84],
        visual: 0,
        targetMs: 48,
        passAvgMs: 48,
        ghost: true,
        copy: "Az első scoring kör még látható, utána a vizuál eltűnik. A click is időnként elhallgat."
    }
];

// ---------- ÁLLAPOT ----------
let audioContext = null;
let masterGain = null;
let scheduleTimer = null;
let animationId = null;
let sessionToken = 0;

let active = false;
let countingIn = false;
let roundRunning = false;
let waitingForNext = false;
let awaitingBlockDecision = false;

let blockNumber = 1;
let roundInBlock = 1;
let completedRoundsInBlock = 0;
let difficultyIndex = 0;
let pendingDifficultyIndex = 0;

let bpm = 66;
let beatSeconds = 60 / bpm;
let beatMs = 60000 / bpm;
let firstBeatAudioTime = 0;
let firstBeatPerfTime = 0;
let countInStartPerfTime = 0;
let startCuePerfTime = 0;
let nextScheduleStep = -(COUNT_IN_BEATS + START_CUE_BEATS);
let nextBeatToJudge = 1;

let beatResults = new Map();
let tappedBeats = new Set();
let currentGroove = "off";

let score = 0;
let streak = 0;
let bestStreakSession = 0;
let allErrors = [];
let roundStartScore = 0;
let roundErrors = [];
let roundHits = 0;
let roundBest = Infinity;

let bestScore = 0;
let bestStreak = 0;
let blockStats = null;
let previousBlockSummary = null;
let currentBlockSummary = null;

// ---------- SEGÉDEK ----------
function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
}

function mean(values) {
    return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;
}

function randomInt(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

function signedMs(value) {
    const rounded = Math.round(value);
    return `${rounded > 0 ? "+" : ""}${rounded} ms`;
}

function currentLevel() {
    return LEVELS[difficultyIndex];
}

function chooseBpm(level) {
    const min = Math.min(level.bpm[0], MAX_BPM);
    const max = Math.min(level.bpm[1], MAX_BPM);
    return randomInt(min, Math.max(min, max));
}

function createBlockStats() {
    return {
        startScore: score,
        errors: [],
        hits: 0,
        misses: 0,
        early: 0,
        late: 0,
        centered: 0,
        ghostErrors: [],
        audibleErrors: [],
        bestStreak: 0,
        roundsPassed: 0,
        roundsRepeated: 0
    };
}

function loadStored() {
    try {
        const data = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
        bestScore = Number(data.bestScore) || 0;
        bestStreak = Number(data.bestStreak) || 0;
    } catch (error) {
        console.warn("A PULZUS rekordjai nem tölthetők be.", error);
    }
    bestScoreDisplay.textContent = bestScore;
    bestStreakDisplay.textContent = bestStreak;
}

function saveStored() {
    bestScore = Math.max(bestScore, score);
    bestStreak = Math.max(bestStreak, bestStreakSession);
    bestScoreDisplay.textContent = bestScore;
    bestStreakDisplay.textContent = bestStreak;
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify({ bestScore, bestStreak }));
    } catch (error) {
        console.warn("A PULZUS rekordjai nem menthetők.", error);
    }
}

// ---------- GROOVE ----------
function weightedChoice(entries) {
    const total = entries.reduce((sum, entry) => sum + entry.weight, 0);
    let roll = Math.random() * total;
    for (const entry of entries) {
        roll -= entry.weight;
        if (roll <= 0) return entry.value;
    }
    return entries[entries.length - 1].value;
}

function chooseAutoGroove(level) {
    // Kikapcsolt és szinkópás ritkább; basic / nokick a fő játékélmény.
    if (level.ghost) {
        return weightedChoice([
            { value: "off", weight: 1 },
            { value: "basic", weight: 5 },
            { value: "nokick", weight: 5 },
            { value: "syncopated", weight: 1 }
        ]);
    }
    return weightedChoice([
        { value: "off", weight: 1 },
        { value: "basic", weight: 6 },
        { value: "nokick", weight: 5 },
        { value: "syncopated", weight: 1 }
    ]);
}

function grooveLabel(mode) {
    return ({
        off: "Kikapcsolva",
        basic: "Basic beat",
        nokick: "Kick nélküli groove",
        syncopated: "Szinkópás groove"
    })[mode] || "Kikapcsolva";
}

function prepareGroove(level) {
    currentGroove = grooveMode.value === "auto" ? chooseAutoGroove(level) : grooveMode.value;
    if (grooveMode.value === "auto") {
        grooveNote.textContent = `AUTO erre a körre: ${grooveLabel(currentGroove)}.`;
    } else {
        grooveNote.textContent = `Kézi választás: ${grooveLabel(currentGroove)}.`;
    }
}

function refreshGrooveNote() {
    if (active && (countingIn || roundRunning)) return;
    if (grooveMode.value === "auto") {
        grooveNote.textContent = "AUTO módban a program körönként választ groove-ot. A választást két kör között bármikor átírhatod.";
    } else {
        grooveNote.textContent = `Kézi választás: ${grooveLabel(grooveMode.value)}.`;
    }
}

// ---------- UI ----------
function setFeedback(title, body, cls = "") {
    const box = timing.parentElement;
    box.classList.remove("good", "bad");
    if (cls) box.classList.add(cls);
    timing.textContent = title;
    accuracy.textContent = body;
}

function updateStats() {
    scoreDisplay.textContent = score;
    streakDisplay.textContent = streak;
    const abs = allErrors.map(Math.abs);
    avgErrorDisplay.textContent = abs.length ? `${Math.round(mean(abs))} ms` : "—";
    driftDisplay.textContent = allErrors.length ? signedMs(mean(allErrors)) : "—";
    bestScoreDisplay.textContent = Math.max(bestScore, score);
    bestStreakDisplay.textContent = Math.max(bestStreak, bestStreakSession);
}

function updateProgress(completedBeats = 0) {
    const level = currentLevel();
    dailyTitle.textContent = blockNumber === 1 ? "NAPI RUTIN" : `${blockNumber}. EDZÉSBLOKK`;
    blockStatusLabel.textContent = blockNumber === 1 ? "NAPI ÁLLAPOT" : "BLOKK ÁLLAPOT";
    stageDisplay.textContent = waitingForNext
        ? `${roundInBlock} / 5 · ${level.name} KÉSZ`
        : `${roundInBlock} / 5 · ${level.name}`;
    beatProgress.textContent = `${completedBeats} / ${BEATS_PER_ROUND}`;
    dailyStatus.textContent = `${completedRoundsInBlock} / ${ROUNDS_PER_BLOCK}`;
    bpmDisplay.textContent = bpm;
    circleBpm.textContent = bpm;

    dailySteps.forEach((step, index) => {
        step.classList.toggle("completed", index < completedRoundsInBlock);
        step.classList.toggle("active", index === completedRoundsInBlock && !awaitingBlockDecision && !waitingForNext);
    });

    modeTitle.textContent = level.name;
    modeCopy.textContent = level.copy;
    assistChip.textContent = level.ghost ? "GHOST" : `VIZUÁL ${Math.round(level.visual * 100)}%`;

    circleStage.classList.remove("visual-low", "visual-hidden");
    if (level.visual <= 0) circleStage.classList.add("visual-hidden");
    else if (level.visual < .7) circleStage.classList.add("visual-low");
}

function setControls() {
    startBtn.hidden = active;
    nextBtn.hidden = !waitingForNext;
    stopBtn.disabled = !active;
    tapBtn.disabled = !roundRunning;
    grooveMode.disabled = countingIn || roundRunning;
}

function flashCircle(cls) {
    circleStage.classList.remove("hit-good", "hit-ok", "hit-bad");
    if (!cls) return;
    circleStage.classList.add(cls === "good" ? "hit-good" : cls === "ok" ? "hit-ok" : "hit-bad");
    setTimeout(() => circleStage.classList.remove("hit-good", "hit-ok", "hit-bad"), 180);
}

// ---------- AUDIO ----------
function ensureAudio() {
    if (!audioContext) {
        audioContext = new (window.AudioContext || window.webkitAudioContext)();
        masterGain = audioContext.createGain();
        masterGain.connect(audioContext.destination);
    }
    const volume = Number(volumeSlider.value) / 100;
    masterGain.gain.setTargetAtTime(volume, audioContext.currentTime, .02);
    return audioContext.resume();
}

function tone(time, frequency, duration, gainValue, type = "sine") {
    const osc = audioContext.createOscillator();
    const gain = audioContext.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(frequency, time);
    gain.gain.setValueAtTime(Math.max(.0001, gainValue), time);
    gain.gain.exponentialRampToValueAtTime(.0001, time + duration);
    osc.connect(gain);
    gain.connect(masterGain);
    osc.start(time);
    osc.stop(time + duration + .02);
}

function noiseHit(time, duration, gainValue, highpass = 5000) {
    const length = Math.max(1, Math.floor(audioContext.sampleRate * duration));
    const buffer = audioContext.createBuffer(1, length, audioContext.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < length; i++) data[i] = Math.random() * 2 - 1;
    const source = audioContext.createBufferSource();
    const filter = audioContext.createBiquadFilter();
    const gain = audioContext.createGain();
    source.buffer = buffer;
    filter.type = "highpass";
    filter.frequency.value = highpass;
    gain.gain.setValueAtTime(gainValue, time);
    gain.gain.exponentialRampToValueAtTime(.0001, time + duration);
    source.connect(filter);
    filter.connect(gain);
    gain.connect(masterGain);
    source.start(time);
    source.stop(time + duration);
}

function kick(time, gainValue = .15) {
    const osc = audioContext.createOscillator();
    const gain = audioContext.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(150, time);
    osc.frequency.exponentialRampToValueAtTime(48, time + .09);
    gain.gain.setValueAtTime(gainValue, time);
    gain.gain.exponentialRampToValueAtTime(.0001, time + .12);
    osc.connect(gain);
    gain.connect(masterGain);
    osc.start(time);
    osc.stop(time + .14);
}

function playMetronome(time, accent = false) {
    if (!soundEnabled.checked) return;
    tone(time, accent ? 1450 : 1050, .055, accent ? .18 : .12, "sine");
}

function playGrooveBeat(beatIndex, beatTime) {
    const mode = currentGroove;
    if (mode === "off") return;
    const position = beatIndex % 4;
    const eighth = beatSeconds / 2;

    if (mode === "basic") {
        if (position === 0 || position === 2) kick(beatTime, .13);
        if (position === 1 || position === 3) noiseHit(beatTime, .05, .065, 1800);
        noiseHit(beatTime, .022, .028, 6500);
        noiseHit(beatTime + eighth, .02, .022, 7000);
    } else if (mode === "nokick") {
        if (position === 1 || position === 3) noiseHit(beatTime, .055, .06, 1800);
        noiseHit(beatTime + eighth, .022, .03, 7000);
        tone(beatTime + eighth * .8, position % 2 === 0 ? 110 : 82.4, .12, .045, "triangle");
    } else if (mode === "syncopated") {
        if (position === 0) kick(beatTime, .1);
        noiseHit(beatTime + eighth, .02, .03, 7200);
        tone(beatTime + eighth * 1.35, position % 2 ? 146.8 : 110, .09, .035, "square");
        if (position === 3) noiseHit(beatTime + eighth * .55, .04, .045, 2200);
    }
}

function isGhostSilentBeat(level, beatNumber) {
    if (!level.ghost) return false;
    // 1-4 hallható, 5-6 néma, 7-8 visszatér.
    return beatNumber === 5 || beatNumber === 6;
}

function schedule() {
    if (!active || !audioContext || (!countingIn && !roundRunning)) return;
    const now = audioContext.currentTime;
    const horizon = now + SCHEDULE_AHEAD;
    const level = currentLevel();

    while (true) {
        const beatTime = firstBeatAudioTime + nextScheduleStep * beatSeconds;
        if (beatTime > horizon) break;

        if (beatTime >= now) {
            if (nextScheduleStep < 0) {
                // -5..-2 = 4,3,2,1 count-in. -1 = START cue.
                // Végig tiszta metronóm szól, groove még nincs.
                const isFirstCount = nextScheduleStep === -(COUNT_IN_BEATS + START_CUE_BEATS);
                const isStartCue = nextScheduleStep === -1;
                playMetronome(beatTime, isFirstCount || isStartCue);
            } else if (nextScheduleStep < BEATS_PER_ROUND) {
                const beatNumber = nextScheduleStep + 1;
                const silentGhost = isGhostSilentBeat(level, beatNumber);
                if (!silentGhost) playMetronome(beatTime, beatNumber === 1 || beatNumber === 5);
                playGrooveBeat(nextScheduleStep, beatTime);
            }
        }

        nextScheduleStep++;
        if (nextScheduleStep >= BEATS_PER_ROUND) break;
    }
}

function stopScheduler() {
    if (scheduleTimer !== null) {
        clearInterval(scheduleTimer);
        scheduleTimer = null;
    }
}

// ---------- TIMING / PONTOZÁS ----------
function timingEvaluation(error, level) {
    const abs = Math.abs(error);
    if (abs <= 12) return { label: "TÖKÉLETES", points: 100, cls: "good" };
    if (abs <= level.targetMs * .55) return { label: "NAGYSZERŰ", points: 80, cls: "good" };
    if (abs <= level.targetMs) return { label: "JÓ", points: 55, cls: "ok" };
    if (abs <= level.targetMs * 1.7) return { label: "TŰRHETŐ", points: 25, cls: "ok" };
    return { label: "KICSÚSZTÁL", points: 0, cls: "bad" };
}

function registerHit() {
    if (!roundRunning) return;
    const now = performance.now();
    const elapsed = now - firstBeatPerfTime;
    const beatNumber = Math.round(elapsed / beatMs) + 1;

    if (beatNumber < 1 || beatNumber > BEATS_PER_ROUND) return;
    if (beatNumber < nextBeatToJudge) return;
    if (tappedBeats.has(beatNumber)) return;

    const targetTime = firstBeatPerfTime + (beatNumber - 1) * beatMs;
    const error = now - targetTime;
    if (Math.abs(error) > INPUT_WINDOW_MS) return;

    const level = currentLevel();
    const evaluation = timingEvaluation(error, level);
    beatResults.set(beatNumber, { error, ...evaluation });
    tappedBeats.add(beatNumber);

    setFeedback(
        evaluation.label,
        `${error < 0 ? "KORÁN" : error > 0 ? "KÉSŐN" : "PONTOSAN"}: ${Math.round(Math.abs(error))} ms`,
        evaluation.cls === "good" ? "good" : evaluation.cls === "bad" ? "bad" : ""
    );
    flashCircle(evaluation.cls);
}

function registerMiss(beatNumber) {
    streak = 0;
    blockStats.misses++;
    setFeedback("KIHAGYOTT ÜTEM", `${beatNumber}. ütés · tartsd tovább a pulzust`, "bad");
    flashCircle("bad");
}

function judgeBeat(beatNumber) {
    const result = beatResults.get(beatNumber);
    const level = currentLevel();

    if (result) {
        score += result.points;
        roundHits++;
        streak++;
        bestStreakSession = Math.max(bestStreakSession, streak);
        roundBest = Math.min(roundBest, Math.abs(result.error));
        roundErrors.push(result.error);
        allErrors.push(result.error);
        blockStats.errors.push(result.error);
        blockStats.hits++;
        blockStats.bestStreak = Math.max(blockStats.bestStreak, streak);

        if (result.error < -8) blockStats.early++;
        else if (result.error > 8) blockStats.late++;
        else blockStats.centered++;

        if (level.ghost && isGhostSilentBeat(level, beatNumber)) blockStats.ghostErrors.push(result.error);
        else blockStats.audibleErrors.push(result.error);
    } else {
        registerMiss(beatNumber);
    }

    beatResults.delete(beatNumber);
    updateStats();
    updateProgress(beatNumber);
}

function processCompletedBeats(now) {
    if (!roundRunning) return;
    while (nextBeatToJudge <= BEATS_PER_ROUND) {
        const targetTime = firstBeatPerfTime + (nextBeatToJudge - 1) * beatMs;
        if (now < targetTime + INPUT_WINDOW_MS) break;
        judgeBeat(nextBeatToJudge);
        nextBeatToJudge++;
        if (nextBeatToJudge > BEATS_PER_ROUND) {
            finishRound();
            break;
        }
    }
}

// ---------- VIZUÁL / COUNT-IN ----------
function updateCountIn(now) {
    const relative = now - countInStartPerfTime;
    const index = Math.floor(relative / beatMs);
    if (index < 0) return;

    if (index < COUNT_IN_BEATS) {
        // Szándékosan 4 → 3 → 2 → 1. Közben a kör még áll.
        const number = COUNT_IN_BEATS - index;
        countIn.hidden = false;
        countIn.classList.remove("is-start");
        countInNumber.textContent = String(number);
        setFeedback("ELŐSZÁMOLÁS", `${number} · csak hallgasd a metronómot`, "");
    } else if (index === COUNT_IN_BEATS) {
        // A START egy teljes negyedet kap. Ekkor indul el a kör,
        // de csak a KÖVETKEZŐ érkezés lesz az első pontozott ütés.
        countIn.hidden = false;
        countIn.classList.add("is-start");
        countInNumber.textContent = "START";
        setFeedback("START", "A kör elindult · a következő érkezésre koppints!", "good");
    } else {
        countIn.hidden = true;
        countIn.classList.remove("is-start");
    }
}

function updateVisualAssistance(now) {
    const level = currentLevel();
    circleStage.classList.remove("visual-low", "visual-hidden");

    if (level.visual <= 0) {
        // Ghost szinten az első scoring kör még teljesen látható.
        const hideAfter = firstBeatPerfTime + beatMs;
        if (now >= hideAfter) circleStage.classList.add("visual-hidden");
    } else if (level.visual < .7) {
        circleStage.classList.add("visual-low");
    }
}

function animate() {
    if (!active || (!countingIn && !roundRunning)) return;
    const now = performance.now();

    updateCountIn(now);
    updateVisualAssistance(now);

    // 4 → 3 → 2 → 1 alatt a kör TELJESEN ÁLL.
    // A START pillanatában indul el, és egy teljes fordulat után érkezik
    // az első pontozott ütéshez.
    if (now < startCuePerfTime) {
        orbitHand.style.transform = "rotate(0deg)";
    } else {
        const phase = (((now - firstBeatPerfTime) % beatMs) + beatMs) % beatMs;
        const progress = phase / beatMs;
        orbitHand.style.transform = `rotate(${progress * 360}deg)`;
    }

    if (countingIn && now >= firstBeatPerfTime - INPUT_WINDOW_MS) {
        countingIn = false;
        roundRunning = true;
        countIn.hidden = true;
        countIn.classList.remove("is-start");
        setControls();
        setFeedback(currentLevel().ghost ? "BELSŐ ÓRA" : "ELSŐ ÜTÉS", "Most már koppints, amikor a jelölő felér a célponthoz.", "");
    }

    processCompletedBeats(now);
    if (active && (countingIn || roundRunning)) animationId = requestAnimationFrame(animate);
}

// ---------- KÖR INDÍTÁS ----------
async function startRound() {
    if (!active || awaitingBlockDecision) return;
    const token = sessionToken;
    const level = currentLevel();

    waitingForNext = false;
    countingIn = false;
    roundRunning = false;
    stopScheduler();
    if (animationId !== null) cancelAnimationFrame(animationId);
    animationId = null;

    bpm = chooseBpm(level);
    beatSeconds = 60 / bpm;
    beatMs = 60000 / bpm;
    prepareGroove(level);

    beatResults.clear();
    tappedBeats.clear();
    nextBeatToJudge = 1;
    nextScheduleStep = -(COUNT_IN_BEATS + START_CUE_BEATS);
    roundErrors = [];
    roundHits = 0;
    roundBest = Infinity;
    roundStartScore = score;

    roundResult.hidden = true;
    blockSummary.hidden = true;
    evaluationPanel.hidden = true;

    updateProgress(0);
    setControls();

    // Telefonon a játékteret hozza a képernyőre, mielőtt elindul a count-in.
    if (window.matchMedia("(max-width: 700px)").matches) {
        practiceCard.scrollIntoView({ behavior: "smooth", block: "start" });
    }

    setFeedback("FELKÉSZÜLÉS", `${bpm} BPM · 4 → 3 → 2 → 1 · utána START`, "");

    try {
        await ensureAudio();
    } catch (error) {
        console.error("AudioContext hiba:", error);
    }

    if (!active || token !== sessionToken) return;

    const leadSeconds = .45;
    // 4 count-in click + 1 START cue + utána jön az első pontozott beat.
    firstBeatAudioTime = audioContext.currentTime + leadSeconds + (COUNT_IN_BEATS + START_CUE_BEATS) * beatSeconds;
    firstBeatPerfTime = performance.now() + leadSeconds * 1000 + (COUNT_IN_BEATS + START_CUE_BEATS) * beatMs;
    startCuePerfTime = firstBeatPerfTime - beatMs;
    countInStartPerfTime = firstBeatPerfTime - (COUNT_IN_BEATS + START_CUE_BEATS) * beatMs;

    countingIn = true;
    setControls();
    schedule();
    scheduleTimer = setInterval(schedule, LOOKAHEAD_MS);
    animationId = requestAnimationFrame(animate);
}

// ---------- TELJESÍTMÉNYALAPÚ NEHEZÍTÉS ----------
function roundPassed(level, average) {
    return roundHits >= 6 && average !== null && average <= level.passAvgMs;
}

function finishRound() {
    if (!roundRunning) return;
    roundRunning = false;
    countingIn = false;
    stopScheduler();
    if (animationId !== null) cancelAnimationFrame(animationId);
    animationId = null;
    countIn.hidden = true;
    orbitHand.style.transform = "rotate(0deg)";

    const level = currentLevel();
    const abs = roundErrors.map(Math.abs);
    const average = abs.length ? mean(abs) : null;
    const passed = roundPassed(level, average);
    const roundPoints = score - roundStartScore;

    completedRoundsInBlock++;
    if (passed) {
        blockStats.roundsPassed++;
        pendingDifficultyIndex = Math.min(difficultyIndex + 1, LEVELS.length - 1);
    } else {
        blockStats.roundsRepeated++;
        pendingDifficultyIndex = difficultyIndex;
    }

    resultTitle.textContent = level.name;
    roundPointsDisplay.textContent = roundPoints;
    roundHitsDisplay.textContent = `${roundHits} / ${BEATS_PER_ROUND}`;
    roundAverageDisplay.textContent = average === null ? "—" : `${Math.round(average)} ms`;
    roundBestDisplay.textContent = Number.isFinite(roundBest) ? `${Math.round(roundBest)} ms` : "—";

    progressionNote.className = `progression-note ${passed ? "pass" : "repeat"}`;
    if (passed && difficultyIndex < LEVELS.length - 1) {
        progressionNote.textContent = `✓ Megvan a stabilitás. A következő körben jöhet: ${LEVELS[pendingDifficultyIndex].name}.`;
    } else if (passed) {
        progressionNote.textContent = "✓ Stabil teljesítmény a legnehezebb szinten is. A következő kör ugyanitt folytatódik.";
    } else {
        progressionNote.textContent = `↻ Még nem nehezítünk. A következő kör is ${level.name} lesz, hogy legyen időd megszilárdítani a tempót.`;
    }

    roundResult.hidden = false;
    saveStored();

    if (completedRoundsInBlock >= ROUNDS_PER_BLOCK) {
        updateProgress(BEATS_PER_ROUND);
        finishBlock();
        return;
    }

    waitingForNext = true;
    updateProgress(BEATS_PER_ROUND);
    nextBtn.textContent = passed && pendingDifficultyIndex !== difficultyIndex
        ? `▶ KÖVETKEZŐ KÖR · ${LEVELS[pendingDifficultyIndex].name}`
        : `▶ KÖVETKEZŐ KÖR · ${level.name}`;
    setFeedback("KÖR KÉSZ", "Nézd meg az eredményt, majd te indítod a következő kört.", passed ? "good" : "");
    setControls();
}

function startNextRound() {
    if (!waitingForNext || !active) return;
    difficultyIndex = pendingDifficultyIndex;
    roundInBlock++;
    waitingForNext = false;
    updateProgress(0);
    startRound();
}

// ---------- BLOKKÖSSZEGZÉS ----------
function summarizeBlock() {
    const abs = blockStats.errors.map(Math.abs);
    const accuracyPct = Math.round((blockStats.hits / (ROUNDS_PER_BLOCK * BEATS_PER_ROUND)) * 100);
    return {
        blockNumber,
        score: score - blockStats.startScore,
        hits: blockStats.hits,
        misses: blockStats.misses,
        accuracyPct,
        avgAbs: abs.length ? mean(abs) : null,
        drift: blockStats.errors.length ? mean(blockStats.errors) : null,
        early: blockStats.early,
        late: blockStats.late,
        centered: blockStats.centered,
        ghostAvg: blockStats.ghostErrors.length ? mean(blockStats.ghostErrors.map(Math.abs)) : null,
        audibleAvg: blockStats.audibleErrors.length ? mean(blockStats.audibleErrors.map(Math.abs)) : null,
        bestStreak: blockStats.bestStreak,
        roundsPassed: blockStats.roundsPassed,
        roundsRepeated: blockStats.roundsRepeated
    };
}

function renderSummary(summary) {
    summaryKicker.textContent = blockNumber === 1 ? "NAPI BEMELEGÍTÉS KÉSZ" : "EDZÉSBLOKK KÉSZ";
    summaryTitle.textContent = "5 KÖR TELJESÍTVE";
    summarySubtitle.textContent = `${summary.roundsPassed} kör hozott szintlépést, ${summary.roundsRepeated} körben ugyanazon a nehézségen maradtál.`;
    summaryBadge.textContent = `${blockNumber}. BLOKK`;
    summaryScore.textContent = summary.score;
    summaryAccuracy.textContent = `${summary.accuracyPct}%`;
    summaryAverage.textContent = summary.avgAbs === null ? "—" : `${Math.round(summary.avgAbs)} ms`;
    summaryDrift.textContent = summary.drift === null ? "—" : signedMs(summary.drift);
    blockSummary.hidden = false;
}

function buildAdvice(summary) {
    const totalDirectional = summary.early + summary.late + summary.centered;
    const earlyRatio = totalDirectional ? summary.early / totalDirectional : 0;
    const lateRatio = totalDirectional ? summary.late / totalDirectional : 0;

    let headline = "Stabil alap";
    let trend = "Az ütéseid kiegyensúlyozottak a click körül.";
    let analysis = summary.avgAbs === null
        ? "Kevés értékelhető találat volt."
        : `Az átlagos timinghibád ${Math.round(summary.avgAbs)} ms, a találati arányod ${summary.accuracyPct}%.`;
    let focus = "Próbáld a következő ütést előre érezni, ne a clickre reagálj.";
    let goal = "Tarts legalább 6/8 találatot stabil, kis timinghibával.";

    if (earlyRatio > .55) {
        headline = "Ne siess az ütem elé";
        trend = `A mérhető ütéseid ${Math.round(earlyRatio * 100)}%-a korai volt.`;
        focus = "Lazíts a kézen. Ne előzd meg a clicket; hagyd, hogy a pulzus természetesen érkezzen.";
    } else if (lateRatio > .55) {
        headline = "Érezd előre a következő ütést";
        trend = `A mérhető ütéseid ${Math.round(lateRatio * 100)}%-a késői volt.`;
        focus = "Ne reakcióként koppints a hangra. A következő negyed helyét már előtte tartsd fejben.";
    }

    if (summary.avgAbs !== null && summary.avgAbs < 35 && summary.accuracyPct >= 85) {
        headline = "Nagyon stabil pulzus";
        analysis = `Erős blokk: ${Math.round(summary.avgAbs)} ms átlagos hiba és ${summary.accuracyPct}% találati arány.`;
        goal = "Tartsd ezt a pontosságot akkor is, amikor a vizuál halványul vagy a click elhallgat.";
    } else if (summary.avgAbs !== null && summary.avgAbs > 70) {
        goal = "Először 70 ms alá vidd az átlagos hibát; a rendszer addig nem kényszerít magasabb nehézségre.";
    }

    if (summary.ghostAvg !== null && summary.audibleAvg !== null && summary.ghostAvg > summary.audibleAvg + 18) {
        analysis += ` A néma ghost ütésekben az átlag ${Math.round(summary.ghostAvg)} ms-re nőtt.`;
        focus = "Amikor eltűnik a click, ne állj meg belül. Finom testmozgással vagy belső számolással tartsd tovább a negyedeket.";
    }

    return { headline, trend, analysis, focus, goal };
}

function showEvaluation() {
    if (!currentBlockSummary) return;
    const advice = buildAdvice(currentBlockSummary);
    adviceHeadline.textContent = advice.headline;
    adviceTrend.textContent = advice.trend;
    adviceAnalysis.textContent = advice.analysis;
    adviceFocus.textContent = advice.focus;
    adviceGoal.textContent = advice.goal;

    if (previousBlockSummary && previousBlockSummary.avgAbs !== null && currentBlockSummary.avgAbs !== null) {
        const delta = Math.round(previousBlockSummary.avgAbs - currentBlockSummary.avgAbs);
        comparisonNote.hidden = false;
        comparisonNote.textContent = delta > 0
            ? `Az előző blokkhoz képest ${delta} ms-mal javult az átlagos timingod.`
            : delta < 0
                ? `Az előző blokkhoz képest ${Math.abs(delta)} ms-mal nőtt az átlagos timinghiba.`
                : "Az átlagos timingod megegyezik az előző blokkéval.";
    } else {
        comparisonNote.hidden = true;
    }

    evaluationPanel.hidden = false;
}

function finishBlock() {
    waitingForNext = false;
    awaitingBlockDecision = true;
    roundResult.hidden = true;
    currentBlockSummary = summarizeBlock();
    renderSummary(currentBlockSummary);
    dailySteps.forEach(step => {
        step.classList.remove("active");
        step.classList.add("completed");
    });
    dailyStatus.textContent = "5 / 5";
    setFeedback("BLOKK KÉSZ", "Most jöhet a kiértékelés, vagy egy újabb 5 kör.", "good");
    setControls();
}

function startNextBlock() {
    if (!active || !awaitingBlockDecision) return;
    previousBlockSummary = currentBlockSummary;
    currentBlockSummary = null;

    // Minden új 5 körös blokk újra STABILITÁS szintről indul.
    // A nehézség ezen a blokkon belül ismét csak sikeres körök után nő.
    // Így a játékos nem ragad bent ghost módban: minden blokkban újra
    // felépíti a nehézséget a saját teljesítménye alapján.
    difficultyIndex = 0;
    pendingDifficultyIndex = 0;

    blockNumber++;
    roundInBlock = 1;
    completedRoundsInBlock = 0;
    awaitingBlockDecision = false;
    waitingForNext = false;
    blockStats = createBlockStats();
    blockSummary.hidden = true;
    evaluationPanel.hidden = true;
    roundResult.hidden = true;
    updateProgress(0);
    setControls();
    startRound();
}

// ---------- JÁTÉK INDÍTÁS / LEÁLLÍTÁS ----------
function startGame() {
    if (active) return;
    sessionToken++;
    active = true;
    countingIn = false;
    roundRunning = false;
    waitingForNext = false;
    awaitingBlockDecision = false;
    blockNumber = 1;
    roundInBlock = 1;
    completedRoundsInBlock = 0;
    difficultyIndex = 0;
    pendingDifficultyIndex = 0;
    score = 0;
    streak = 0;
    bestStreakSession = 0;
    allErrors = [];
    previousBlockSummary = null;
    currentBlockSummary = null;
    blockStats = createBlockStats();

    roundResult.hidden = true;
    blockSummary.hidden = true;
    evaluationPanel.hidden = true;
    updateStats();
    updateProgress(0);
    setControls();
    startRound();
}

function stopGame() {
    if (!active) return;
    sessionToken++;
    active = false;
    countingIn = false;
    roundRunning = false;
    waitingForNext = false;
    awaitingBlockDecision = false;
    stopScheduler();
    if (animationId !== null) cancelAnimationFrame(animationId);
    animationId = null;
    countIn.hidden = true;
    orbitHand.style.transform = "rotate(0deg)";
    saveStored();
    setFeedback("EDZÉS LEÁLLÍTVA", `Elmentett pontszám: ${score}`, "");
    setControls();
    refreshGrooveNote();
}

// ---------- ESEMÉNYEK ----------
startBtn.addEventListener("click", startGame);
nextBtn.addEventListener("click", startNextRound);
stopBtn.addEventListener("click", stopGame);
continueBtn.addEventListener("click", startNextBlock);
continueFromEval.addEventListener("click", startNextBlock);
evaluationBtn.addEventListener("click", showEvaluation);

tapBtn.addEventListener("pointerdown", event => {
    event.preventDefault();
    registerHit();
});

document.addEventListener("keydown", event => {
    if (event.code !== "Space" || event.repeat || !roundRunning) return;
    const tag = event.target.tagName;
    if (tag === "INPUT" || tag === "SELECT" || tag === "TEXTAREA" || event.target.isContentEditable) return;
    event.preventDefault();
    registerHit();
});

volumeSlider.addEventListener("input", () => {
    if (masterGain && audioContext) {
        const volume = Number(volumeSlider.value) / 100;
        masterGain.gain.setTargetAtTime(volume, audioContext.currentTime, .02);
    }
});

grooveMode.addEventListener("change", refreshGrooveNote);

// ---------- KEZDŐÁLLAPOT ----------
loadStored();
blockStats = createBlockStats();
updateStats();
updateProgress(0);
setControls();
refreshGrooveNote();
