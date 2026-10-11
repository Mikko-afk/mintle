'use strict';

(() => {
  const WORD_LENGTH = 5;
  const MAX_GUESSES = 6;
  const STORAGE_PREFIX = 'mintle:v1:';

  // Answers are intentionally a curated subset; the accepted dictionary is larger.
  const ANSWER_WORDS_RAW = `about above abuse actor acute admit adopt adult after again agent agree ahead alarm album alert alien align alike alive allow alone along alter amber amend among anger angle angry apart apple apply arena argue arise armor arrow aside asset audio audit avoid awake award aware awful bacon badge badly baker bases basic basin basis beach began begin begun being below bench berry berth birth black blade blame blank blast blaze bleak blend bless blind block blood bloom blown board boast bonus boost booth bound brain brake brand brass brave bread break breed brick bride brief bring broad broke brown brush build built cable cabin cache candy carry carve catch cause cease chain chair chalk charm chart chase cheap check cheek chest chief child chill china choir choose civic civil claim class clean clear clerk click climb clock close cloth cloud clown coach coast color comic coral couch could count court cover craft crash cream crime crisp cross crowd crown crude cruel crush curve cycle daily dairy dance dealt death debut decade delay depth devil diary dirty doubt dozen draft drain drama drawn dream dress drift drill drink drive drove drunk eagle early earth eight elbow elder elect elite empty enemy enjoy enter entry equal error essay event every exact exist extra faith false fancy fault feast fence fever fewer fiber field fifth fifty fight final fixed flame flash fleet flesh floor floral flour focus force forge forth found frame frank fraud fresh front frost fruit fully funny giant given glass globe glory going grace grade grain grand grant grass great green greet grief grind gross group grown guard guess guest guide habit happy harsh heart heavy hence hobby honey honor horse hotel house human humor ideal image imply index inner input issue ivory joint judge known label labor large laser later laugh layer learn lease least leave legal lemon level light limit linen liver local logic loose lower lucky lunch magic major maker march match maybe mayor metal might minor model money month moral motor mount mouse mouth movie music naive naked nerve never newly night noble noise north noted novel nurse occur ocean offer often olive onset orbit order other ought owner paint panel panic paper party peace peach penny phase phone photo piece pilot pitch place plain plane plant plate plenty point pound power press price pride prime print prior prize proof proud prove pulse queen query quick quiet quite radio raise range rapid ratio reach react ready realm rebel refer relax rely renew reply reset resin retro rhyme right rinse rival river robot rocky romance rough round route royal ruler rural sadly safer salad scale scare scene scent scope score scout scrap screw sense serve seven shade shake shall shame shape share sharp sheet shelf shell shift shine shirt shock shore short shown sight silly since skill sleep slice slide slope small smart smell smoke solid solve sorry sound south space speak speed spell spend spice spicy spill split spoke sport spray staff stage stain stair stand start state steam steel steep stick still stock stone store storm story strip stuck study style sugar suite sunny super sweet table taken taste teach teeth thank their theme there thick thing think third those three threw throw tiger tight timer tired title today token topic total touch tough tower track trade train treat trend trial tribe trick tried truck truly trust truth twice uncle under union unity until upper upset urban usage usual vague valid value video view voice waste watch water wheel where which while white whole whose woman women world worry worse worst worth would write wrong wrote youth zebra`.split(/\s+/);

  const ANSWER_WORDS = [...new Set(ANSWER_WORDS_RAW.filter(isWord))];
  const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');
  const KEY_ROWS = ['QWERTYUIOP'.split(''), 'ASDFGHJKL'.split(''), ['ENTER', ...'ZXCVBNM'.split(''), 'BACKSPACE']];
  const STATUS_RANK = { absent: 0, present: 1, correct: 2 };
  const $ = (selector) => document.querySelector(selector);

  const boardEl = $('#board');
  const keyboardEl = $('#keyboard');
  const messageEl = $('#game-message');
  const toastEl = $('#toast');
  const backdropEl = $('#modal-backdrop');
  const modalIds = ['help-modal', 'stats-modal', 'settings-modal'];

  let dailyState;
  let practiceState;
  let activeMode = 'daily';
  let isAnimating = false;
  let toastTimer = null;
  let activeModal = null;
  let lastFocusedElement = null;
  let highContrast = false;
  let hardMode = false;

  function isWord(word) {
    return typeof word === 'string' && /^[a-z]{5}$/.test(word);
  }

  function todayKey(date = new Date()) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  function displayDate(date = new Date()) {
    return new Intl.DateTimeFormat('en-US', { weekday: 'long', month: 'long', day: 'numeric' }).format(date).toUpperCase();
  }

  function dayNumber(dateString = todayKey()) {
    const [year, month, day] = dateString.split('-').map(Number);
    return Math.floor(Date.UTC(year, month - 1, day) / 86400000);
  }

  function dailyAnswer(dateString = todayKey()) {
    // A deterministic date hash keeps one answer stable for each local calendar day.
    let hash = 2166136261;
    for (const char of dateString) {
      hash ^= char.charCodeAt(0);
      hash = Math.imul(hash, 16777619);
    }
    const index = (hash >>> 0) % ANSWER_WORDS.length;
    return ANSWER_WORDS[index];
  }

  function safeRead(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      return raw === null ? fallback : JSON.parse(raw);
    } catch (error) {
      console.warn(`MINTLE could not read saved data for ${key}.`, error);
      return fallback;
    }
  }

  function safeWrite(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
      return true;
    } catch (error) {
      console.warn(`MINTLE could not save data for ${key}.`, error);
      showToast('Could not save progress in this browser.');
      return false;
    }
  }

  function newState(mode, answer, date = todayKey()) {
    return {
      mode,
      date,
      answer,
      guesses: [],
      currentInput: '',
      completed: false,
      won: false,
      statsRecorded: false,
      gameId: mode === 'daily' ? `daily:${date}` : `practice:${Date.now()}:${Math.random().toString(36).slice(2, 7)}`
    };
  }

  function validateState(raw, mode, expectedDate) {
    if (!raw || typeof raw !== 'object' || raw.mode !== mode || !isWord(raw.answer)) return null;
    if (mode === 'daily' && raw.date !== expectedDate) return null;
    if (!Array.isArray(raw.guesses) || raw.guesses.length > MAX_GUESSES) return null;
    const guesses = [];
    for (const item of raw.guesses) {
      if (!item || typeof item.word !== 'string' || !/^[a-z]{5}$/.test(item.word)) return null;
      const result = evaluateGuess(item.word, raw.answer);
      guesses.push({ word: item.word, result });
    }
    const completed = Boolean(raw.completed) || guesses.some((item) => item.word === raw.answer) || guesses.length >= MAX_GUESSES;
    const won = guesses.some((item) => item.word === raw.answer);
    return {
      mode, date: mode === 'daily' ? expectedDate : (typeof raw.date === 'string' ? raw.date : expectedDate),
      answer: raw.answer, guesses,
      currentInput: typeof raw.currentInput === 'string' ? raw.currentInput.toLowerCase().replace(/[^a-z]/g, '').slice(0, WORD_LENGTH) : '',
      completed, won, statsRecorded: Boolean(raw.statsRecorded),
      gameId: typeof raw.gameId === 'string' ? raw.gameId : (mode === 'daily' ? `daily:${expectedDate}` : `practice:${Date.now()}`)
    };
  }

  function loadDailyState() {
    const date = todayKey();
    const key = `${STORAGE_PREFIX}daily:${date}`;
    const saved = validateState(safeRead(key, null), 'daily', date);
    dailyState = saved || newState('daily', dailyAnswer(date), date);
    saveState(dailyState);
    if (dailyState.completed) recordDailyStatsIfNeeded(dailyState);
  }

  function loadPracticeState() {
    const saved = safeRead(`${STORAGE_PREFIX}practice`, null);
    practiceState = validateState(saved, 'practice', todayKey());
    if (!practiceState) practiceState = makePracticeState();
    saveState(practiceState);
  }

  function makePracticeState() {
    const previous = practiceState?.answer;
    const todays = dailyAnswer(todayKey());
    let options = ANSWER_WORDS.filter((word) => word !== todays && word !== previous);
    if (!options.length) options = ANSWER_WORDS.filter((word) => word !== todays);
    const answer = options[Math.floor(Math.random() * options.length)] || ANSWER_WORDS[0];
    return newState('practice', answer);
  }

  function saveState(state = currentState()) {
    if (!state) return;
    const key = state.mode === 'daily' ? `${STORAGE_PREFIX}daily:${state.date}` : `${STORAGE_PREFIX}practice`;
    safeWrite(key, state);
  }

  function currentState() { return activeMode === 'daily' ? dailyState : practiceState; }

  function evaluateGuess(guess, answer) {
    const result = Array(WORD_LENGTH).fill('absent');
    const remaining = {};
    for (let i = 0; i < WORD_LENGTH; i += 1) {
      if (guess[i] === answer[i]) result[i] = 'correct';
      else remaining[answer[i]] = (remaining[answer[i]] || 0) + 1;
    }
    for (let i = 0; i < WORD_LENGTH; i += 1) {
      if (result[i] === 'correct') continue;
      if (remaining[guess[i]] > 0) {
        result[i] = 'present';
        remaining[guess[i]] -= 1;
      }
    }
    return result;
  }

  function letterStatuses(state = currentState()) {
    const statuses = {};
    for (const guess of state.guesses) {
      guess.word.split('').forEach((letter, index) => {
        const status = guess.result[index];
        if (!(letter in statuses) || STATUS_RANK[status] > STATUS_RANK[statuses[letter]]) statuses[letter] = status;
      });
    }
    return statuses;
  }

  function checkHardMode(guess, state) {
    if (!hardMode || state.guesses.length === 0) return null;
    const requiredPositions = {};
    const minimumCounts = {};
    for (const prior of state.guesses) {
      const countsThisGuess = {};
      prior.word.split('').forEach((letter, index) => {
        if (prior.result[index] === 'correct') requiredPositions[index] = letter;
        if (prior.result[index] === 'correct' || prior.result[index] === 'present') {
          countsThisGuess[letter] = (countsThisGuess[letter] || 0) + 1;
        }
      });
      for (const [letter, count] of Object.entries(countsThisGuess)) {
        minimumCounts[letter] = Math.max(minimumCounts[letter] || 0, count);
      }
    }
    for (const [indexText, letter] of Object.entries(requiredPositions)) {
      const index = Number(indexText);
      if (guess[index] !== letter) return `Keep ${letter.toUpperCase()} in position ${index + 1}.`;
    }
    const counts = {};
    for (const letter of guess) counts[letter] = (counts[letter] || 0) + 1;
    for (const [letter, minimum] of Object.entries(minimumCounts)) {
      if ((counts[letter] || 0) < minimum) return `Your guess must include ${letter.toUpperCase()} at least ${minimum} ${minimum === 1 ? 'time' : 'times'}.`;
    }
    return null;
  }

  function buildBoard() {
    boardEl.replaceChildren();
    for (let row = 0; row < MAX_GUESSES; row += 1) {
      for (let col = 0; col < WORD_LENGTH; col += 1) {
        const tile = document.createElement('div');
        tile.className = 'tile';
        tile.setAttribute('role', 'gridcell');
        tile.dataset.row = String(row);
        tile.dataset.col = String(col);
        tile.setAttribute('aria-label', `Row ${row + 1}, column ${col + 1}, empty`);
        boardEl.append(tile);
      }
    }
  }

  function buildKeyboard() {
    keyboardEl.replaceChildren();
    KEY_ROWS.forEach((rowLetters) => {
      const row = document.createElement('div');
      row.className = 'keyboard-row';
      rowLetters.forEach((letter) => {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'key';
        button.dataset.key = letter;
        if (letter === 'ENTER' || letter === 'BACKSPACE') {
          button.classList.add('key-wide');
          button.textContent = letter === 'BACKSPACE' ? '⌫' : 'ENTER';
          button.setAttribute('aria-label', letter === 'BACKSPACE' ? 'Backspace' : 'Enter guess');
        } else {
          button.textContent = letter;
          button.setAttribute('aria-label', `Enter ${letter}`);
        }
        button.addEventListener('click', () => handleKey(letter));
        row.append(button);
      });
      keyboardEl.append(row);
    });
  }

  function renderBoard(animationRow = -1) {
    const state = currentState();
    const cells = boardEl.querySelectorAll('.tile');
    cells.forEach((tile) => {
      const row = Number(tile.dataset.row);
      const col = Number(tile.dataset.col);
      const guess = state.guesses[row];
      tile.className = 'tile';
      tile.style.removeProperty('--reveal-delay');
      let letter = '';
      let status = '';
      if (guess) {
        letter = guess.word[col].toUpperCase();
        status = guess.result[col];
        tile.classList.add(`state-${status}`);
        if (row === animationRow) {
          tile.classList.add('is-revealing');
          tile.style.setProperty('--reveal-delay', `${col * 95}ms`);
        }
      } else if (row === state.guesses.length && !state.completed) {
        letter = state.currentInput[col]?.toUpperCase() || '';
        if (letter) tile.classList.add('has-letter');
      }
      tile.textContent = letter;
      const stateLabel = status ? `, ${status.replace('-', ' ')}` : (letter ? ', entered' : ', empty');
      tile.setAttribute('aria-label', `Row ${row + 1}, column ${col + 1}${letter ? `, ${letter}` : ''}${stateLabel}`);
    });
    boardEl.setAttribute('aria-label', `Game board. ${state.guesses.length} of ${MAX_GUESSES} guesses used.`);
  }

  function renderKeyboard() {
    const statuses = letterStatuses();
    keyboardEl.querySelectorAll('.key').forEach((button) => {
      button.classList.remove('state-correct', 'state-present', 'state-absent');
      const letter = button.dataset.key;
      if (statuses[letter]) button.classList.add(`state-${statuses[letter]}`);
      button.disabled = currentState().completed || isAnimating;
    });
  }

  function setMessage(text, kind = '') {
    messageEl.textContent = text;
    messageEl.classList.remove('message-win', 'message-loss');
    if (kind) messageEl.classList.add(`message-${kind}`);
  }

  function renderStatus() {
    const state = currentState();
    $('#daily-mode').classList.toggle('is-active', activeMode === 'daily');
    $('#daily-mode').setAttribute('aria-pressed', String(activeMode === 'daily'));
    $('#practice-mode').classList.toggle('is-active', activeMode === 'practice');
    $('#practice-mode').setAttribute('aria-pressed', String(activeMode === 'practice'));
    $('#mode-caption').textContent = activeMode === 'daily' ? "TODAY'S PUZZLE" : 'PRACTICE FILE';
    $('#game-number').textContent = String(dayNumber(state.date || todayKey()) % 1000).padStart(3, '0');
    if (state.completed) {
      if (state.won) setMessage(activeMode === 'daily' ? 'Nicely done. Today’s word is yours.' : 'Lovely work. One more for the road?', 'win');
      else setMessage(`The word was ${state.answer.toUpperCase()}. Tomorrow is another page.`, 'loss');
    } else if (state.guesses.length > 0) {
      setMessage(`${MAX_GUESSES - state.guesses.length} ${MAX_GUESSES - state.guesses.length === 1 ? 'guess' : 'guesses'} left. Trust your next hunch.`);
    } else if (activeMode === 'practice') {
      setMessage('Practice file open. Try a word and see what turns up.');
    } else {
      setMessage('Six tries. A little bit of word detective work.');
    }
    $('#new-practice-button').textContent = activeMode === 'practice' && state.completed ? 'Another round ↗' : 'New practice ↗';
    $('#footer-year').textContent = String(new Date().getFullYear());
  }

  function render() {
    renderStatus();
    renderBoard();
    renderKeyboard();
  }

  function handleKey(key) {
    const state = currentState();
    if (isAnimating || state.completed || activeModal) return;
    if (key === 'ENTER') {
      submitGuess();
      return;
    }
    if (key === 'BACKSPACE' || key === '⌫') {
      state.currentInput = state.currentInput.slice(0, -1);
      saveState(state);
      renderBoard();
      return;
    }
    if (/^[A-Z]$/.test(key) && state.currentInput.length < WORD_LENGTH) {
      state.currentInput += key.toLowerCase();
      saveState(state);
      renderBoard();
      const activeTile = boardEl.querySelector(`.tile[data-row="${state.guesses.length}"][data-col="${state.currentInput.length - 1}"]`);
      if (activeTile) {
        activeTile.classList.remove('has-letter');
        void activeTile.offsetWidth;
        activeTile.classList.add('has-letter');
      }
    }
  }

  function shakeBoard() {
    boardEl.classList.remove('is-shaking');
    void boardEl.offsetWidth;
    boardEl.classList.add('is-shaking');
    window.setTimeout(() => boardEl.classList.remove('is-shaking'), 380);
  }

  function submitGuess() {
    const state = currentState();
    if (isAnimating || state.completed) return;
    if (state.currentInput.length !== WORD_LENGTH) {
      setMessage('Not quite five letters yet.');
      showToast('A guess needs five letters.');
      shakeBoard();
      return;
    }
    const guess = state.currentInput.toLowerCase();
    // Open-guess mode: do not block a five-letter guess just because the bundled
    // answer list is small. This avoids false rejections of uncommon valid words.
    if (!isWord(guess)) {
      setMessage('Use five letters from A to Z.');
      showToast('A guess needs five letters A–Z.');
      shakeBoard();
      return;
    }
    const hardModeError = checkHardMode(guess, state);
    if (hardModeError) {
      setMessage(hardModeError);
      showToast(hardModeError);
      shakeBoard();
      return;
    }

    const guessResult = evaluateGuess(guess, state.answer);
    state.guesses.push({ word: guess, result: guessResult });
    state.currentInput = '';
    const solved = guess === state.answer;
    state.completed = solved || state.guesses.length >= MAX_GUESSES;
    state.won = solved;
    saveState(state);
    isAnimating = true;
    renderStatus();
    renderBoard(state.guesses.length - 1);
    renderKeyboard();
    const motionPreference = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    const duration = motionPreference ? 0 : (WORD_LENGTH - 1) * 95 + 560;
    window.setTimeout(() => {
      isAnimating = false;
      render();
      if (state.completed) {
        if (state.mode === 'daily') recordDailyStatsIfNeeded(state);
        if (state.won) {
          showToast(state.guesses.length === 1 ? 'First try! What a read.' : 'You got it. Nicely played.');
        } else {
          showToast(`The answer was ${state.answer.toUpperCase()}.`);
        }
        if (activeMode === 'daily') updateStatsModal();
      }
    }, duration);
  }

  function defaultStats() {
    return { gamesPlayed: 0, wins: 0, currentStreak: 0, maxStreak: 0, distribution: [0, 0, 0, 0, 0, 0], recordedGames: [], lastPlayedDate: null };
  }

  function loadStats() {
    const stored = safeRead(`${STORAGE_PREFIX}stats`, null);
    if (!stored || typeof stored !== 'object') return defaultStats();
    const stats = defaultStats();
    stats.gamesPlayed = Number.isFinite(stored.gamesPlayed) && stored.gamesPlayed >= 0 ? Math.floor(stored.gamesPlayed) : 0;
    stats.wins = Number.isFinite(stored.wins) && stored.wins >= 0 ? Math.floor(stored.wins) : 0;
    stats.currentStreak = Number.isFinite(stored.currentStreak) && stored.currentStreak >= 0 ? Math.floor(stored.currentStreak) : 0;
    stats.maxStreak = Number.isFinite(stored.maxStreak) && stored.maxStreak >= 0 ? Math.floor(stored.maxStreak) : 0;
    if (Array.isArray(stored.distribution) && stored.distribution.length === MAX_GUESSES) {
      stats.distribution = stored.distribution.map((value) => Number.isFinite(value) && value >= 0 ? Math.floor(value) : 0);
    }
    stats.recordedGames = Array.isArray(stored.recordedGames) ? stored.recordedGames.filter((id) => typeof id === 'string').slice(-500) : [];
    stats.lastPlayedDate = typeof stored.lastPlayedDate === 'string' ? stored.lastPlayedDate : null;
    return stats;
  }

  function recordDailyStatsIfNeeded(state) {
    if (!state?.completed || state.mode !== 'daily') return;
    const stats = loadStats();
    if (stats.recordedGames.includes(state.gameId)) {
      state.statsRecorded = true;
      saveState(state);
      return;
    }
    stats.gamesPlayed += 1;
    if (state.won) {
      stats.wins += 1;
      stats.distribution[Math.max(0, Math.min(MAX_GUESSES - 1, state.guesses.length - 1))] += 1;
      const yesterday = shiftDate(state.date, -1);
      stats.currentStreak = stats.lastPlayedDate === yesterday ? stats.currentStreak + 1 : 1;
      stats.maxStreak = Math.max(stats.maxStreak, stats.currentStreak);
    } else {
      stats.currentStreak = 0;
    }
    stats.lastPlayedDate = state.date;
    stats.recordedGames.push(state.gameId);
    stats.recordedGames = stats.recordedGames.slice(-500);
    safeWrite(`${STORAGE_PREFIX}stats`, stats);
    state.statsRecorded = true;
    saveState(state);
  }

  function shiftDate(dateString, amount) {
    const [year, month, day] = dateString.split('-').map(Number);
    const date = new Date(year, month - 1, day + amount);
    return todayKey(date);
  }

  function updateStatsModal() {
    const stats = loadStats();
    $('#stat-played').textContent = stats.gamesPlayed;
    $('#stat-winrate').textContent = `${stats.gamesPlayed ? Math.round((stats.wins / stats.gamesPlayed) * 100) : 0}%`;
    $('#stat-current-streak').textContent = stats.currentStreak;
    $('#stat-max-streak').textContent = stats.maxStreak;
    const distributionEl = $('#guess-distribution');
    distributionEl.replaceChildren();
    const maximum = Math.max(1, ...stats.distribution);
    stats.distribution.forEach((count, index) => {
      const row = document.createElement('div');
      row.className = 'distribution-row';
      const number = document.createElement('span');
      number.textContent = String(index + 1);
      const wrap = document.createElement('div');
      wrap.className = 'distribution-bar-wrap';
      const bar = document.createElement('div');
      bar.className = `distribution-bar${count === 0 ? ' is-empty' : ''}`;
      bar.style.width = `${Math.max(count === 0 ? 8 : 20, (count / maximum) * 100)}%`;
      bar.textContent = String(count);
      wrap.append(bar);
      row.append(number, wrap);
      distributionEl.append(row);
    });
  }

  function shareText(state) {
    const attempts = state.won ? `${state.guesses.length}/${MAX_GUESSES}` : `X/${MAX_GUESSES}`;
    const dateCode = (state.date || todayKey()).replace(/-/g, '');
    const lines = state.guesses.map((guess) => guess.result.map((result) => ({ correct: '🟩', present: '🟨', absent: '⬜' }[result])).join(''));
    return [`MINTLE ${dateCode} ${attempts}${state.mode === 'practice' ? ' · Practice' : ''}`, '', ...lines].join('\n');
  }

  async function shareResult() {
    const state = currentState();
    if (!state.completed) {
      showToast('Finish this round before sharing your result.');
      return;
    }
    const text = shareText(state);
    if (navigator.share) {
      try {
        await navigator.share({ title: 'My MINTLE result', text });
        return;
      } catch (error) {
        if (error?.name === 'AbortError') return;
      }
    }
    try {
      if (navigator.clipboard?.writeText && window.isSecureContext) {
        await navigator.clipboard.writeText(text);
      } else {
        const temporary = document.createElement('textarea');
        temporary.value = text;
        temporary.setAttribute('readonly', '');
        temporary.style.position = 'fixed';
        temporary.style.opacity = '0';
        document.body.append(temporary);
        temporary.select();
        const copied = document.execCommand('copy');
        temporary.remove();
        if (!copied) throw new Error('Clipboard copy was not successful.');
      }
      showToast('Result copied. Ready to share.');
    } catch (error) {
      console.error('MINTLE could not copy the result.', error);
      showToast('Sharing is unavailable in this browser.');
    }
  }

  function openModal(id) {
    const modal = document.getElementById(id);
    if (!modal) return;
    lastFocusedElement = document.activeElement;
    modalIds.forEach((modalId) => { document.getElementById(modalId).hidden = modalId !== id; });
    backdropEl.hidden = false;
    activeModal = modal;
    if (id === 'stats-modal') updateStatsModal();
    const focusTarget = modal.querySelector('button, input, [tabindex="0"]');
    window.setTimeout(() => focusTarget?.focus(), 0);
  }

  function closeModal() {
    if (!activeModal) return;
    backdropEl.hidden = true;
    modalIds.forEach((id) => { document.getElementById(id).hidden = true; });
    activeModal = null;
    if (lastFocusedElement instanceof HTMLElement) lastFocusedElement.focus();
  }

  function showToast(message) {
    toastEl.textContent = message;
    toastEl.classList.add('is-visible');
    window.clearTimeout(toastTimer);
    toastTimer = window.setTimeout(() => toastEl.classList.remove('is-visible'), 2100);
  }

  function switchMode(mode) {
    if (mode !== 'daily' && mode !== 'practice') return;
    if (isAnimating) { showToast('One moment—let the letters settle first.'); return; }
    activeMode = mode;
    render();
  }

  function startNewPractice() {
    if (isAnimating) { showToast('One moment—let the letters settle first.'); return; }
    practiceState = makePracticeState();
    activeMode = 'practice';
    saveState(practiceState);
    render();
    showToast('A fresh practice word, just for you.');
  }

  function loadSettings() {
    const settings = safeRead(`${STORAGE_PREFIX}settings`, {});
    highContrast = Boolean(settings?.highContrast);
    hardMode = Boolean(settings?.hardMode);
    document.body.classList.toggle('high-contrast', highContrast);
    $('#contrast-toggle').checked = highContrast;
    $('#hardmode-toggle').checked = hardMode;
  }

  function saveSettings() {
    safeWrite(`${STORAGE_PREFIX}settings`, { highContrast, hardMode });
  }

  function setupEvents() {
    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape' && activeModal) {
        closeModal();
        return;
      }
      if (activeModal) {
        if (event.key === 'Tab') trapModalFocus(event);
        return;
      }
      if (event.ctrlKey || event.altKey || event.metaKey) return;
      if (event.key === 'Enter') {
        event.preventDefault();
        handleKey('ENTER');
      } else if (event.key === 'Backspace') {
        event.preventDefault();
        handleKey('BACKSPACE');
      } else if (/^[a-zA-Z]$/.test(event.key)) {
        handleKey(event.key.toUpperCase());
      }
    });
    $('#help-button').addEventListener('click', () => openModal('help-modal'));
    $('#stats-button').addEventListener('click', () => openModal('stats-modal'));
    $('#settings-button').addEventListener('click', () => openModal('settings-modal'));
    backdropEl.addEventListener('click', (event) => { if (event.target === backdropEl) closeModal(); });
    document.querySelectorAll('.modal-close').forEach((button) => button.addEventListener('click', closeModal));
    $('#daily-mode').addEventListener('click', () => switchMode('daily'));
    $('#practice-mode').addEventListener('click', () => switchMode('practice'));
    $('#new-practice-button').addEventListener('click', startNewPractice);
    $('#share-button').addEventListener('click', shareResult);
    $('#contrast-toggle').addEventListener('change', (event) => {
      highContrast = event.target.checked;
      document.body.classList.toggle('high-contrast', highContrast);
      saveSettings();
    });
    $('#hardmode-toggle').addEventListener('change', (event) => {
      hardMode = event.target.checked;
      saveSettings();
      showToast(hardMode ? 'Hard mode is on for your next guesses.' : 'Hard mode is off.');
    });
  }

  function trapModalFocus(event) {
    const focusable = [...activeModal.querySelectorAll('button:not(:disabled), input:not(:disabled), [href], [tabindex]:not([tabindex="-1"])')];
    if (!focusable.length) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault(); last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault(); first.focus();
    }
  }

  function init() {
    $('#date-label').textContent = displayDate();
    buildBoard();
    buildKeyboard();
    loadSettings();
    loadDailyState();
    loadPracticeState();
    setupEvents();
    render();
  }

  // Expose small pure functions for optional automated tests; gameplay remains encapsulated.
  window.MINTLE_TESTS = Object.freeze({ evaluateGuess, dailyAnswer, todayKey, isWord, get answerCount() { return ANSWER_WORDS.length; }, guessPolicy: 'open-five-letter' });
  init();
})();
