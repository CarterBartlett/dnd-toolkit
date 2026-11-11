const SECTIONS = ["condition", "stat", "counters"]
let CURRENT_SECTION = SECTIONS[0];

console.log('Loaded main.js');

function switchSection(section) {
    console.log(`Switching to section: ${section}`);
    SECTIONS.forEach(sec => {
        const el = document.getElementById(`${sec}-section`);
        if (el) {
            el.style.display = sec === section ? 'block' : 'none';
        }
    });
    CURRENT_SECTION = section;
}

// ---- Character Condition table ----

const CHARACTERS_STORAGE_KEY = 'characters';

// Adds a row to the table. `data` is optional ({ name, currentHP, maxHP }).
function addCharacter(data = {}) {
    const template = document.getElementById('character-row-template');
    const row = template.content.firstElementChild.cloneNode(true);
    row.querySelector('.character-name').value = data.name ?? '';
    row.querySelector('.current-hp').value = data.currentHP ?? '';
    row.querySelector('.max-hp').value = data.maxHP ?? '';
    document.getElementById('character-rows').appendChild(row);
    updateRowCondition(row);
    saveCharacters();
    return row;
}

// Works out the condition name and display colours from HP.
function getCondition(currentHP, maxHP) {
    if (maxHP <= 0) return { condition: '', colour: '', outline: 'transparent' };

    const percentHP = (currentHP / maxHP) * 100;
    if (currentHP <= -maxHP) return { condition: 'Dead',               colour: '#000000',   outline: 'white' };
    if (percentHP <= 0)      return { condition: 'Unconscious',        colour: '#636363ff', outline: 'white' };
    if (percentHP <= 10)     return { condition: 'Critically Injured', colour: '#dc3545',   outline: 'black' };
    if (percentHP <= 25)     return { condition: 'Severely Injured',   colour: '#e5533c',   outline: 'black' };
    if (percentHP <= 50)     return { condition: 'Bloodied',           colour: '#ff8c00',   outline: 'black' };
    if (percentHP <= 75)     return { condition: 'Injured',            colour: '#ffc107',   outline: 'black' };
    if (percentHP < 100)     return { condition: 'Minor Injuries',     colour: '#9acd32',   outline: 'black' };
    return                          { condition: 'Healthy',            colour: '#5cb85c',   outline: 'black' };
}

// Refreshes the condition label and meter for one row.
function updateRowCondition(row) {
    const currentHP = parseInt(row.querySelector('.current-hp').value) || 0;
    const maxHP = parseInt(row.querySelector('.max-hp').value) || 0;
    const { condition, colour, outline } = getCondition(currentHP, maxHP);

    const label = row.querySelector('.condition-label');
    label.innerText = condition;
    label.style.color = colour;
    label.style.textShadow = `-1px -1px 0 ${outline}, 1px -1px 0 ${outline}, -1px 1px 0 ${outline}, 1px 1px 0 ${outline}`;

    const percentHP = maxHP > 0 ? (currentHP / maxHP) * 100 : 0;
    const meter = row.querySelector('.condition-meter');
    meter.value = Math.max(0, Math.min(100, percentHP));
    meter.style.setProperty('--condition-colour', colour || 'transparent');
}

// Save characters to localStorage
function saveCharacters() {
    const rows = document.querySelectorAll('#character-rows tr');
    const characters = Array.from(rows, row => ({
        name: row.querySelector('.character-name').value,
        currentHP: row.querySelector('.current-hp').value,
        maxHP: row.querySelector('.max-hp').value,
    }));
    try {
        localStorage.setItem(CHARACTERS_STORAGE_KEY, JSON.stringify(characters));
    } catch (e) {
        console.warn('Could not save characters', e);
    }
}

// Load characters from localStorage
function loadCharacters() {
    let characters = [];
    try {
        characters = JSON.parse(localStorage.getItem(CHARACTERS_STORAGE_KEY)) || [];
    } catch (e) {
        console.warn('Could not load characters', e);
    }
    if (!Array.isArray(characters) || characters.length === 0) {
        characters = [{}]; // start with one blank row
    }
    characters.forEach(character => addCharacter(character));
}

// ---- Stat Roller ----

const STAT_ROLLER_STORAGE_KEY = 'stat-roller';
const MAX_STATS = 9;
const MAX_AVERAGE_FOR_THRESHOLD = 15; // threshold can't exceed 15 per stat, so rerolling stays feasible
const MAX_ROLL_ATTEMPTS = 100000;
const DEFAULT_STAT_SETTINGS = { count: 6, method: 'standard', threshold: 75, guarantee16: false };

// stats[i] is { total, rolls (sorted high to low), dropped (how many of the lowest dice were dropped) } or null.
// assignments[i] is an ability value ('str', 'dex', ...) or ''.
let statState = { settings: { ...DEFAULT_STAT_SETTINGS }, stats: [], assignments: [] };

function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
}

function toModifier(stat) {
    const modifier = Math.floor((stat - 10) / 2);
    return (modifier >= 0 ? '+' : '') + modifier;
}

function maxThreshold(count) {
    return count * MAX_AVERAGE_FOR_THRESHOLD;
}

function rollDie() {
    return Math.floor(Math.random() * 6) + 1;
}

// Rolls one stat. Standard = 4d6 drop the lowest, Classic = 3d6.
function rollStat(method) {
    const diceCount = method === 'classic' ? 3 : 4;
    const dropped = method === 'classic' ? 0 : 1;
    const rolls = Array.from({ length: diceCount }, rollDie).sort((a, b) => b - a);
    const total = rolls.slice(0, diceCount - dropped).reduce((sum, r) => sum + r, 0);
    return { total, rolls, dropped };
}

// Rerolls the whole set until it meets the minimum total (and has a 16+ if required).
function rollStats() {
    const { count, method, threshold, guarantee16 } = statState.settings;
    let stats;
    let attempts = 0;
    let success = false;

    while (attempts < MAX_ROLL_ATTEMPTS) {
        attempts++;
        stats = Array.from({ length: count }, () => rollStat(method));
        const total = stats.reduce((sum, s) => sum + s.total, 0);
        if (total >= threshold && (!guarantee16 || stats.some(s => s.total >= 16))) {
            success = true;
            break;
        }
    }

    if (!success) {
        alert(`Couldn't meet the settings after ${MAX_ROLL_ATTEMPTS.toLocaleString()} attempts. ` +
              `Showing the last roll; try a lower minimum stat total.`);
    }

    statState.stats = stats;
    statState.assignments = new Array(count).fill(''); // new numbers, so clear old assignments
    renderStats();
    saveStatRoller();
}

// Pads or trims stats/assignments to match the number of stats.
function fitStatsToCount(count) {
    const fit = (arr, filler) => Array.from({ length: count }, (_, i) => arr[i] ?? filler);
    statState.stats = fit(statState.stats, null);
    statState.assignments = fit(statState.assignments, '');
}

// Reads the settings inputs, clamping anything out of range.
function readStatSettings() {
    const count = clamp(parseInt(document.getElementById('number-of-stats').value) || DEFAULT_STAT_SETTINGS.count, 1, MAX_STATS);
    const method = document.getElementById('rolling-method').value === 'classic' ? 'classic' : 'standard';
    const threshold = parseInt(document.getElementById('minimum-stat-threshold').value) || 0;
    const guarantee16 = document.getElementById('guarantee-16').checked;
    return { count, method, threshold, guarantee16 };
}

// Writes the current settings back into the inputs.
function applyStatSettingsToInputs() {
    const { count, method, threshold, guarantee16 } = statState.settings;
    document.getElementById('number-of-stats').value = count;
    document.getElementById('rolling-method').value = method;
    const thresholdInput = document.getElementById('minimum-stat-threshold');
    thresholdInput.max = maxThreshold(count);
    thresholdInput.value = threshold;
    document.getElementById('guarantee-16').checked = guarantee16;
}

function onStatSettingsChange(event) {
    const oldCount = statState.settings.count;
    const settings = readStatSettings();

    // Rescale the minimum total in proportion to the new number of stats (e.g. 75 at 6 -> 100 at 8).
    if (event.target.id === 'number-of-stats' && settings.count !== oldCount) {
        settings.threshold = Math.round(settings.threshold * settings.count / oldCount);
    }
    settings.threshold = clamp(settings.threshold, 0, maxThreshold(settings.count));

    statState.settings = settings;
    applyStatSettingsToInputs();
    if (settings.count !== oldCount) {
        fitStatsToCount(settings.count);
        renderStats();
    }
    saveStatRoller();
}

// Builds the stat boxes from the template, then refreshes the breakdown table.
function renderStats() {
    const container = document.getElementById('stats');
    const template = document.getElementById('stat-template');
    container.replaceChildren();

    statState.stats.forEach((stat, i) => {
        const box = template.content.firstElementChild.cloneNode(true);
        box.dataset.index = i;
        box.querySelector('.modifier').textContent = stat ? toModifier(stat.total) : '';
        const valueEl = box.querySelector('.stat-value');
        valueEl.textContent = stat ? stat.total : '–';
        valueEl.classList.toggle('roll-min', stat?.total === 3);
        valueEl.classList.toggle('roll-max', stat?.total === 18);

        // Show every die, with the dropped one(s) struck through.
        const rollsEl = box.querySelector('.rolls');
        if (stat) {
            stat.rolls.forEach((roll, j) => {
                if (j > 0) rollsEl.append(', ');
                const span = document.createElement('span');
                span.textContent = roll;
                if (j >= stat.rolls.length - stat.dropped) span.classList.add('dropped');
                if (roll === 1) span.classList.add('roll-min');
                if (roll === 6) span.classList.add('roll-max');
                rollsEl.append(span);
            });
        }

        box.querySelector('.stat-select').value = statState.assignments[i] || '';
        container.append(box);
    });

    updateAllocationOptions();
    renderStatBreakdown();
}

// Disables abilities in each dropdown that another stat already has.
function updateAllocationOptions() {
    const used = statState.assignments;
    document.querySelectorAll('#stats .stat-select').forEach((select, i) => {
        for (const option of select.options) {
            option.disabled = option.value !== '' && used.includes(option.value) && used[i] !== option.value;
        }
    });
}

function renderStatBreakdown() {
    const rolled = statState.stats.filter(Boolean);
    const set = (id, text) => { document.getElementById(id).textContent = text; };

    if (rolled.length === 0) {
        ['stat-total', 'stat-lowest', 'stat-highest', 'stat-average', 'stat-luck-factor'].forEach(id => set(id, '–'));
        return;
    }

    const totals = rolled.map(s => s.total);
    const total = totals.reduce((sum, t) => sum + t, 0);
    const lowest = Math.min(...totals);
    const highest = Math.max(...totals);
    // Luck factor: where the total sits between the worst (all 3s) and best (all 18s) possible sets.
    const minTotal = 3 * totals.length;
    const maxTotal = 18 * totals.length;
    const luck = (total - minTotal) / (maxTotal - minTotal) * 100;

    set('stat-total', total);
    set('stat-lowest', `${lowest} (${toModifier(lowest)})`);
    set('stat-highest', `${highest} (${toModifier(highest)})`);
    set('stat-average', (total / totals.length).toFixed(2));
    set('stat-luck-factor', `${luck.toFixed(1)}%`);
}

function saveStatRoller() {
    try {
        localStorage.setItem(STAT_ROLLER_STORAGE_KEY, JSON.stringify(statState));
    } catch (e) {
        console.warn('Could not save stat roller', e);
    }
}

function loadStatRoller() {
    let saved = null;
    try {
        saved = JSON.parse(localStorage.getItem(STAT_ROLLER_STORAGE_KEY));
    } catch (e) {
        console.warn('Could not load stat roller', e);
    }

    if (saved && typeof saved === 'object') {
        const settings = { ...DEFAULT_STAT_SETTINGS, ...saved.settings };
        settings.count = clamp(parseInt(settings.count) || DEFAULT_STAT_SETTINGS.count, 1, MAX_STATS);
        settings.method = settings.method === 'classic' ? 'classic' : 'standard';
        settings.threshold = clamp(parseInt(settings.threshold) || 0, 0, maxThreshold(settings.count));
        settings.guarantee16 = Boolean(settings.guarantee16);
        statState = {
            settings,
            stats: Array.isArray(saved.stats) ? saved.stats : [],
            assignments: Array.isArray(saved.assignments) ? saved.assignments : [],
        };
    }

    fitStatsToCount(statState.settings.count);
    applyStatSettingsToInputs();
    renderStats();
}

// ---- Synced Counters ----

const COUNTERS_STORAGE_KEY = 'synced-counters';

// Each counter is { id, name, value, start, linked }. `start` is the last value typed in, used by "Reset All".
// `linked` counters are the only ones changed by the page-wide -1/+1 Linked buttons.
// `id` only links a card to its counter while the page is open; it isn't saved.
let counterState = { counters: [], removeOnExpire: false };
let nextCounterId = 1;

function makeCounter(data = {}) {
    const value = parseInt(data.value) || 0;
    return {
        id: nextCounterId++,
        name: typeof data.name === 'string' ? data.name : '',
        value,
        start: Number.isFinite(parseInt(data.start)) ? parseInt(data.start) : value,
        linked: data.linked !== false, // on by default (and for counters saved before this setting existed)
    };
}

// Shows a card's link button as on or off.
function renderLinkButton(button, linked) {
    button.classList.toggle('unlinked', !linked);
    button.setAttribute('aria-pressed', linked);
    button.title = linked
        ? 'Linked: affected by -1/+1 Linked (click to unlink)'
        : 'Unlinked: not affected by -1/+1 Linked (click to link)';
}

function findCounter(card) {
    return counterState.counters.find(c => c.id === Number(card.dataset.id));
}

// Adds `delta` to a counter. Returns true if that counted it down to 0 and it should be removed.
function stepCounter(counter, delta) {
    counter.value += delta;
    return delta < 0 && counterState.removeOnExpire && counter.value <= 0;
}

function removeCounter(counter) {
    counterState.counters = counterState.counters.filter(c => c !== counter);
}

function renderCounters() {
    const container = document.getElementById('counters-container');
    const template = document.getElementById('counter-template');
    container.replaceChildren();

    counterState.counters.forEach(counter => {
        const card = template.content.firstElementChild.cloneNode(true);
        card.dataset.id = counter.id;
        card.querySelector('.counter-name').value = counter.name;
        card.querySelector('.counter-value').value = counter.value;
        renderLinkButton(card.querySelector('.toggle-link'), counter.linked);
        container.append(card);
    });
}

// Changes every linked counter by `delta` (the page-wide -1 / +1 Linked buttons).
function stepAllCounters(delta) {
    const expired = counterState.counters.filter(counter => counter.linked && stepCounter(counter, delta));
    expired.forEach(removeCounter);
    renderCounters();
    saveCounters();
}

// Puts counters back to their start values (Reset Linked / Reset All).
function resetCounters(onlyLinked) {
    counterState.counters
        .filter(counter => !onlyLinked || counter.linked)
        .forEach(counter => { counter.value = counter.start; });
    renderCounters();
    saveCounters();
}

function saveCounters() {
    const data = {
        removeOnExpire: counterState.removeOnExpire,
        counters: counterState.counters.map(({ name, value, start, linked }) => ({ name, value, start, linked })),
    };
    try {
        localStorage.setItem(COUNTERS_STORAGE_KEY, JSON.stringify(data));
    } catch (e) {
        console.warn('Could not save counters', e);
    }
}

function loadCounters() {
    let saved = null;
    try {
        saved = JSON.parse(localStorage.getItem(COUNTERS_STORAGE_KEY));
    } catch (e) {
        console.warn('Could not load counters', e);
    }

    if (saved && typeof saved === 'object') {
        counterState.removeOnExpire = Boolean(saved.removeOnExpire);
        counterState.counters = Array.isArray(saved.counters) ? saved.counters.map(makeCounter) : [];
    }

    document.getElementById('remove-counter-on-expire').checked = counterState.removeOnExpire;
    renderCounters();
}

// Event Listeners
document.addEventListener('DOMContentLoaded', function() {
    switchSection(SECTIONS[0]);

    // One listener on the table body handles every row, including ones added later.
    const characterRows = document.getElementById('character-rows');
    characterRows.addEventListener('click', function(event) {
        if (event.target.closest('.remove-character')) {
            event.target.closest('tr').remove();
            saveCharacters();
        }
        if (event.target.closest('.reset-hp')) {
            const row = event.target.closest('tr');
            const currentHP = row.querySelector('.current-hp');
            currentHP.value = row.querySelector('.max-hp').value;
            // Reuse the 'input' listener to refresh the condition and save.
            currentHP.dispatchEvent(new Event('input', { bubbles: true }));
        }
    });
    characterRows.addEventListener('input', function(event) {
        updateRowCondition(event.target.closest('tr'));
        saveCharacters();
    });

    // Scroll wheel over a focused HP field steps it up/down by 1.
    characterRows.addEventListener('wheel', function(event) {
        const input = event.target;
        if (!input.matches('.current-hp, .max-hp') || document.activeElement !== input) return;
        if (event.deltaY === 0) return; // ignore horizontal scrolling

        event.preventDefault(); // stop the page scrolling (and any built-in wheel handling)
        if (event.deltaY < 0) {
            // Don't let scrolling push Current HP above Max HP (no limit if Max HP is blank).
            if (input.matches('.current-hp')) {
                const maxHP = parseInt(input.closest('tr').querySelector('.max-hp').value);
                if (!isNaN(maxHP) && (parseInt(input.value) || 0) >= maxHP) return;
            }
            input.stepUp();
        } else {
            input.stepDown();
        }
        // Reuse the 'input' listener above to refresh the condition and save.
        input.dispatchEvent(new Event('input', { bubbles: true }));
    }, { passive: false });

    loadCharacters();

    // Stat Roller
    document.getElementById('roll-button').addEventListener('click', rollStats);
    document.getElementById('remove-stat-allocations').addEventListener('click', function() {
        statState.assignments = statState.assignments.map(() => '');
        renderStats();
        saveStatRoller();
    });
    document.querySelector('.stat-settings').addEventListener('change', onStatSettingsChange);
    document.getElementById('stats').addEventListener('change', function(event) {
        const select = event.target.closest('.stat-select');
        if (!select) return;
        statState.assignments[select.closest('.stat').dataset.index] = select.value;
        updateAllocationOptions();
        saveStatRoller();
    });

    loadStatRoller();

    // Synced Counters: page-wide buttons
    document.getElementById('add-counter').addEventListener('click', function() {
        const counter = makeCounter();
        counterState.counters.push(counter);
        renderCounters();
        saveCounters();
        // Jump straight to naming the new counter.
        document.querySelector(`.counter[data-id="${counter.id}"] .counter-name`).focus();
    });
    document.getElementById('remove-all-counters').addEventListener('click', function() {
        if (counterState.counters.length === 0) return;
        if (!confirm('Remove all counters? This can\'t be undone.')) return;
        counterState.counters = [];
        renderCounters();
        saveCounters();
    });
    document.getElementById('reset-linked-counters').addEventListener('click', () => resetCounters(true));
    document.getElementById('reset-all-counters').addEventListener('click', () => resetCounters(false));
    document.getElementById('decrement-all-counters').addEventListener('click', () => stepAllCounters(-1));
    document.getElementById('increment-all-counters').addEventListener('click', () => stepAllCounters(1));
    document.getElementById('remove-counter-on-expire').addEventListener('change', function() {
        counterState.removeOnExpire = this.checked;
        saveCounters();
    });

    // Synced Counters: one set of listeners on the container handles every card.
    const countersContainer = document.getElementById('counters-container');
    countersContainer.addEventListener('click', function(event) {
        const card = event.target.closest('.counter');
        if (!card) return;
        const counter = findCounter(card);

        if (event.target.closest('.remove-counter')) {
            removeCounter(counter);
            card.remove();
        } else if (event.target.closest('.toggle-link')) {
            counter.linked = !counter.linked;
            renderLinkButton(card.querySelector('.toggle-link'), counter.linked);
        } else if (event.target.closest('.increment-counter, .decrement-counter')) {
            const delta = event.target.closest('.increment-counter') ? 1 : -1;
            if (stepCounter(counter, delta)) {
                removeCounter(counter);
                card.remove();
            } else {
                // Update just this card so keyboard focus stays on the button.
                card.querySelector('.counter-value').value = counter.value;
            }
        } else {
            return;
        }
        saveCounters();
    });
    countersContainer.addEventListener('input', function(event) {
        const card = event.target.closest('.counter');
        if (!card) return;
        const counter = findCounter(card);
        if (event.target.matches('.counter-name')) {
            counter.name = event.target.value;
        } else if (event.target.matches('.counter-value')) {
            counter.value = parseInt(event.target.value) || 0;
        }
        saveCounters();
    });
    // When a typed value is committed (Enter or leaving the box), it becomes the "Reset All" value.
    countersContainer.addEventListener('change', function(event) {
        if (!event.target.matches('.counter-value')) return;
        const counter = findCounter(event.target.closest('.counter'));
        counter.start = counter.value;
        saveCounters();
    });

    loadCounters();
});