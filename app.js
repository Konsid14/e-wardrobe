// E-Wardrobe
// Local account, wardrobe and outfit storage.

const $ = (id) => document.getElementById(id);
const STORAGE_KEY = 'ewardrobe:v2';
const ACTIVE_USER_KEY = 'ewardrobe:active-user';

function defaultState() {
  return { users: {}, sessions: {} };
}

function getState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY) || localStorage.getItem('ewardrobe:v1');
    const parsed = raw ? JSON.parse(raw) : defaultState();
    return { users: parsed.users || {}, sessions: parsed.sessions || {} };
  } catch {
    return defaultState();
  }
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#039;');
}

function fileToDataURL(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

const state = getState();
let currentUser = null;
let authMode = 'login';
let personImg = null;
let overlayImg = null;
let overlay = { x: 240, y: 320, scale: 1, rotate: 0, opacity: 0.95 };
let dragging = false;
let dragOffset = { x: 0, y: 0 };

const authSection = $('auth-section');
const appSection = $('app-section');
const authForm = $('auth-form');
const authUsername = $('auth-username');
const authPassword = $('auth-password');
const authConfirm = $('auth-confirm');
const authMessage = $('auth-message');
const authTitle = $('auth-title');
const authSubtitle = $('auth-subtitle');
const authSubmit = $('auth-submit');
const confirmWrap = $('confirm-wrap');
const confirmLabel = $('confirm-label');
const loginTab = $('login-tab');
const signupTab = $('signup-tab');
const currentUserSpan = $('current-user');
const canvas = $('canvas');
const ctx = canvas.getContext('2d');
const canvasEmpty = $('canvas-empty');

function setAuthMessage(message = '', error = true) {
  authMessage.textContent = message;
  authMessage.style.color = error ? '#d24b72' : '#4a8c72';
}

function setAuthMode(mode) {
  authMode = mode;
  const signup = mode === 'signup';
  loginTab.classList.toggle('active', !signup);
  signupTab.classList.toggle('active', signup);
  confirmWrap.classList.toggle('hidden', !signup);
  confirmLabel.classList.toggle('hidden', !signup);
  authTitle.textContent = signup ? 'Create your wardrobe' : 'Welcome back';
  authSubtitle.textContent = signup ? 'Create an account in a few seconds.' : 'Log in to open your wardrobe.';
  authSubmit.textContent = signup ? 'Create account' : 'Log in';
  authPassword.autocomplete = signup ? 'new-password' : 'current-password';
  authConfirm.required = signup;
  setAuthMessage('');
}

loginTab.addEventListener('click', () => setAuthMode('login'));
signupTab.addEventListener('click', () => setAuthMode('signup'));

$('toggle-password').addEventListener('click', () => {
  const hidden = authPassword.type === 'password';
  authPassword.type = hidden ? 'text' : 'password';
  $('toggle-password').textContent = hidden ? '○' : '◉';
});

authForm.addEventListener('submit', (event) => {
  event.preventDefault();
  const username = authUsername.value.trim();
  const password = authPassword.value;

  if (username.length < 3) return setAuthMessage('Use at least 3 characters for your username.');
  if (password.length < 4) return setAuthMessage('Use at least 4 characters for your password.');

  if (authMode === 'signup') {
    if (state.users[username]) return setAuthMessage('That username is already in use.');
    if (password !== authConfirm.value) return setAuthMessage('The passwords do not match.');
    state.users[username] = { password, clothes: {}, history: [] };
    state.sessions[username] = {};
    saveState();
    setActiveUser(username);
    currentUser = username;
    authForm.reset();
    showApp();
    return;
  }

  const user = state.users[username];
  if (!user || user.password !== password) return setAuthMessage('Username or password is incorrect.');
  currentUser = username;
  setActiveUser(username);
  authForm.reset();
  showApp();
});

$('logout-btn').addEventListener('click', () => {
  persistPersonSnapshot(true);
  clearActiveUser();
  currentUser = null;
  personImg = null;
  overlayImg = null;
  showAuth();
});

function setActiveUser(username) {
  localStorage.setItem(ACTIVE_USER_KEY, username);
}

function getActiveUser() {
  return localStorage.getItem(ACTIVE_USER_KEY);
}

function clearActiveUser() {
  localStorage.removeItem(ACTIVE_USER_KEY);
}

function showAuth() {
  authSection.classList.remove('hidden');
  appSection.classList.add('hidden');
  setAuthMode('login');
}

function showApp() {
  authSection.classList.add('hidden');
  appSection.classList.remove('hidden');
  currentUserSpan.textContent = currentUser;
  ensureUserShape();
  loadUserData();
  restoreSession();
}

function ensureUserShape() {
  const user = state.users[currentUser];
  if (!user.clothes) user.clothes = {};
  if (!user.history) user.history = [];
  if (!state.sessions[currentUser]) state.sessions[currentUser] = {};
}

function fitCanvas() {
  const rect = canvas.getBoundingClientRect();
  canvas.width = Math.max(280, Math.round(rect.width));
  canvas.height = Math.max(360, Math.round(rect.height));
  if (!overlayImg) {
    overlay.x = canvas.width / 2;
    overlay.y = canvas.height / 2;
  }
  renderCanvas(false);
}

function clearCanvas() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
}

function renderCanvas(savePerson = false) {
  clearCanvas();

  if (personImg) {
    const scale = Math.min(canvas.width / personImg.width, canvas.height / personImg.height);
    const w = personImg.width * scale;
    const h = personImg.height * scale;
    ctx.drawImage(personImg, (canvas.width - w) / 2, (canvas.height - h) / 2, w, h);
  }

  if (overlayImg) {
    ctx.save();
    ctx.globalAlpha = overlay.opacity;
    ctx.translate(overlay.x, overlay.y);
    ctx.rotate(overlay.rotate * Math.PI / 180);
    const w = overlayImg.width * overlay.scale;
    const h = overlayImg.height * overlay.scale;
    ctx.drawImage(overlayImg, -w / 2, -h / 2, w, h);
    ctx.restore();
  }

  canvasEmpty.classList.toggle('hidden', Boolean(personImg));
  if (savePerson) persistPersonSnapshot(true);
}

function loadPersonFromDataURL(dataURL) {
  const img = new Image();
  img.onload = () => {
    personImg = img;
    renderCanvas(true);
  };
  img.src = dataURL;
}

$('person-file').addEventListener('change', async (event) => {
  const file = event.target.files?.[0];
  if (!file || !currentUser) return;
  try {
    const data = await fileToDataURL(file);
    loadPersonFromDataURL(data);
    event.target.value = '';
  } catch {
    alert('Could not load that image.');
  }
});

$('add-cloth-btn').addEventListener('click', async () => {
  const file = $('clothe-file').files?.[0];
  if (!file) return alert('Choose an image first.');
  const name = $('clothe-name').value.trim() || 'Clothing item';
  const size = $('clothe-size').value.trim();

  try {
    const data = await fileToDataURL(file);
    const id = `c_${Date.now()}`;
    state.users[currentUser].clothes[id] = { id, name, size, img: data, createdAt: Date.now() };
    saveState();
    $('clothe-file').value = '';
    $('clothe-name').value = '';
    $('clothe-size').value = '';
    loadUserData();
  } catch {
    alert('Could not add that item.');
  }
});

function loadUserData() {
  ensureUserShape();
  const user = state.users[currentUser];
  const list = $('clothes-list');
  const select = $('select-cloth');
  list.innerHTML = '';
  select.innerHTML = '<option value="">Select an item</option>';

  Object.values(user.clothes).sort((a, b) => b.createdAt - a.createdAt).forEach((item) => {
    const li = document.createElement('li');
    li.innerHTML = `
      <img src="${item.img}" alt="">
      <div class="item-meta"><strong>${escapeHtml(item.name)}</strong><small>${escapeHtml(item.size || 'No size')}</small></div>
      <button class="item-action use" type="button">Use</button>
      <button class="item-action delete" type="button">Delete</button>`;
    li.querySelector('.use').addEventListener('click', () => {
      select.value = item.id;
      selectClothById(item.id);
    });
    li.querySelector('.delete').addEventListener('click', () => {
      if (!confirm(`Delete ${item.name}?`)) return;
      delete user.clothes[item.id];
      if (select.value === item.id) {
        select.value = '';
        overlayImg = null;
      }
      saveState();
      loadUserData();
      renderCanvas(false);
    });
    list.appendChild(li);

    const option = document.createElement('option');
    option.value = item.id;
    option.textContent = item.size ? `${item.name} · ${item.size}` : item.name;
    select.appendChild(option);
  });

  renderHistory();
}

function selectClothById(id) {
  if (!id) {
    overlayImg = null;
    renderCanvas(false);
    return;
  }
  const item = state.users[currentUser].clothes[id];
  if (!item) return;
  const img = new Image();
  img.onload = () => {
    overlayImg = img;
    overlay = {
      x: canvas.width / 2,
      y: canvas.height / 2,
      scale: 1,
      rotate: 0,
      opacity: Number($('overlay-opacity').value)
    };
    $('overlay-scale').value = '1';
    $('overlay-rotate').value = '0';
    renderCanvas(false);
  };
  img.src = item.img;
}

$('select-cloth').addEventListener('change', (event) => selectClothById(event.target.value));
$('overlay-opacity').addEventListener('input', (e) => { overlay.opacity = Number(e.target.value); renderCanvas(false); });
$('overlay-scale').addEventListener('input', (e) => { overlay.scale = Number(e.target.value); renderCanvas(false); });
$('overlay-rotate').addEventListener('input', (e) => { overlay.rotate = Number(e.target.value); renderCanvas(false); });

canvas.addEventListener('pointerdown', (event) => {
  if (!overlayImg) return;
  const point = getCanvasPoint(event);
  const dx = point.x - overlay.x;
  const dy = point.y - overlay.y;
  const w = overlayImg.width * overlay.scale;
  const h = overlayImg.height * overlay.scale;
  if (Math.abs(dx) <= w / 2 && Math.abs(dy) <= h / 2) {
    dragging = true;
    dragOffset = { x: dx, y: dy };
    canvas.setPointerCapture(event.pointerId);
  }
});
canvas.addEventListener('pointermove', (event) => {
  if (!dragging) return;
  const point = getCanvasPoint(event);
  overlay.x = point.x - dragOffset.x;
  overlay.y = point.y - dragOffset.y;
  renderCanvas(false);
});
canvas.addEventListener('pointerup', stopDragging);
canvas.addEventListener('pointercancel', stopDragging);
function stopDragging() { dragging = false; }
function getCanvasPoint(event) {
  const rect = canvas.getBoundingClientRect();
  return {
    x: (event.clientX - rect.left) * (canvas.width / rect.width),
    y: (event.clientY - rect.top) * (canvas.height / rect.height)
  };
}

$('save-outfit').addEventListener('click', () => {
  const clothId = $('select-cloth').value;
  if (!personImg) return alert('Add your photo first.');
  if (!clothId || !overlayImg) return alert('Choose a clothing item first.');
  const item = state.users[currentUser].clothes[clothId];
  state.users[currentUser].history.unshift({
    id: `h_${Date.now()}`,
    clothId,
    clothName: item.name,
    size: item.size,
    when: Date.now(),
    snapshot: canvas.toDataURL('image/jpeg', 0.88)
  });
  saveState();
  renderHistory();
});

function renderHistory() {
  const user = state.users[currentUser];
  const history = $('history-list');
  const empty = $('history-empty');
  history.innerHTML = '';
  empty.classList.toggle('hidden', Boolean(user.history.length));

  user.history.forEach((item) => {
    const li = document.createElement('li');
    li.innerHTML = `
      <img src="${item.snapshot}" alt="Saved outfit">
      <div class="history-info">
        <strong>${escapeHtml(item.clothName)}</strong>
        <small>${escapeHtml(item.size || 'No size')} · ${new Date(item.when).toLocaleDateString()}</small>
        <br><button type="button">Remove</button>
      </div>`;
    li.querySelector('button').addEventListener('click', () => {
      user.history = user.history.filter((entry) => entry.id !== item.id);
      saveState();
      renderHistory();
    });
    history.appendChild(li);
  });
}

function persistPersonSnapshot(save = true) {
  if (!currentUser || !personImg) return;
  try {
    state.sessions[currentUser] ||= {};
    const temp = document.createElement('canvas');
    temp.width = 360;
    temp.height = 480;
    const tctx = temp.getContext('2d');
    const scale = Math.min(temp.width / personImg.width, temp.height / personImg.height);
    const w = personImg.width * scale;
    const h = personImg.height * scale;
    tctx.drawImage(personImg, (temp.width - w) / 2, (temp.height - h) / 2, w, h);
    state.sessions[currentUser].lastPerson = temp.toDataURL('image/jpeg', .72);
    if (save) saveState();
  } catch {
    // Ignore storage failures so a photo cannot break the session.
  }
}

function restoreSession() {
  if (!currentUser) return;
  const snapshot = state.sessions[currentUser]?.lastPerson;
  if (snapshot) loadPersonFromDataURL(snapshot);
}

function restoreActiveLogin() {
  const username = getActiveUser();
  if (!username || !state.users[username]) {
    clearActiveUser();
    showAuth();
    return;
  }
  currentUser = username;
  showApp();
}

window.addEventListener('resize', () => fitCanvas());
window.addEventListener('pagehide', () => persistPersonSnapshot(true));
window.addEventListener('beforeunload', () => persistPersonSnapshot(true));

// Start: keep the user signed in on app reloads.
restoreActiveLogin();
fitCanvas();
