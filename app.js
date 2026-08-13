f/* Simple e-wardrobe demo app
   - localStorage used for accounts, clothes, and history
   - overlay placement implemented with canvas and basic transform controls
   - photo capture via <input type=file accept=image/* capture>
*/

// Utilities
const $ = id => document.getElementById(id);
const STORAGE_KEY = 'ewardrobe:v1';

function getState(){
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY)) || { users: {}, sessions: {} } }
  catch(e){ return { users: {}, sessions: {} } }
}
function setState(s){ localStorage.setItem(STORAGE_KEY, JSON.stringify(s)) }

// Initial setup
const state = getState();
let currentUser = null;

// UI elements
const authSection = $('auth-section');
const appSection = $('app-section');
const currentUserSpan = $('current-user');
const logoutBtn = $('logout-btn');

// Sign up / Login
$('signup-btn').addEventListener('click', ()=>{
  const u = $('signup-username').value.trim();
  const p = $('signup-password').value;
  if(!u||!p) return alert('enter username and password');
  if(state.users[u]) return alert('username exists');
  state.users[u] = { password: p, clothes: {}, history: [] };
  setState(state);
  alert('Account created. Please login.');
});
$('login-btn').addEventListener('click', ()=>{
  const u = $('login-username').value.trim();
  const p = $('login-password').value;
  if(!u||!p) return alert('enter username and password');
  const user = state.users[u];
  if(!user || user.password !== p) return alert('invalid');
  currentUser = u;
  showAppForUser(u);
});
logoutBtn.addEventListener('click', ()=>{ currentUser=null; saveStateToStorage(); showAuth(); });

function showAuth(){ authSection.classList.remove('hidden'); appSection.classList.add('hidden'); }
function showAppForUser(u){ authSection.classList.add('hidden'); appSection.classList.remove('hidden'); currentUserSpan.textContent = u; loadUserData(); }

// Canvas and images
const canvas = $('canvas');
const ctx = canvas.getContext('2d');
let personImg = null;
let overlayImg = null;
let overlay = { x: canvas.width/2, y: canvas.height/2, scale:1, rotate:0, opacity:0.95 };

function fitCanvas(){ // maintain internal resolution same as element size
  const rect = canvas.getBoundingClientRect();
  canvas.width = Math.max(240, Math.round(rect.width));
  canvas.height = Math.max(320, Math.round(rect.height));
}

window.addEventListener('resize', ()=>{ fitCanvas(); renderCanvas(); });
fitCanvas();

function clearCanvas(){ ctx.clearRect(0,0,canvas.width,canvas.height); }

function renderCanvas(){
  clearCanvas();
  if(personImg) {
    // draw person centered and scaled to fit
    const pw = personImg.width, ph = personImg.height;
    const scale = Math.min(canvas.width/pw, canvas.height/ph);
    const w = pw*scale, h = ph*scale;
    const dx = (canvas.width-w)/2, dy=(canvas.height-h)/2;
    ctx.drawImage(personImg, 0,0,pw,ph, dx,dy,w,h);
  }
  if(overlayImg){
    ctx.save();
    ctx.globalAlpha = overlay.opacity;
    ctx.translate(overlay.x, overlay.y);
    ctx.rotate(overlay.rotate * Math.PI/180);
    const ow = overlayImg.width * overlay.scale;
    const oh = overlayImg.height * overlay.scale;
    ctx.drawImage(overlayImg, -ow/2, -oh/2, ow, oh);
    ctx.restore();
  }
}

// Person photo input
$('person-file').addEventListener('change', async (e)=>{
  const f = e.target.files && e.target.files[0];
  if(!f) return;
  const data = await fileToDataURL(f);
  loadPersonFromDataURL(data);
});

function loadPersonFromDataURL(dataURL){
  const img = new Image();
  img.onload = ()=>{ personImg = img; renderCanvas(); };
  img.src = dataURL;
}

async function fileToDataURL(file){ return await new Promise(r=>{ const fr=new FileReader(); fr.onload=e=>r(e.target.result); fr.readAsDataURL(file); }) }

// Clothes management
$('add-cloth-btn').addEventListener('click', async ()=>{
  const fileInput = $('clothe-file');
  const f = fileInput.files && fileInput.files[0];
  const name = $('clothe-name').value.trim() || 'Unnamed';
  const size = $('clothe-size').value.trim() || '';
  if(!f) return alert('choose an image for the cloth');
  const data = await fileToDataURL(f);
  const id = 'c_'+Date.now();
  const user = state.users[currentUser];
  user.clothes[id] = { id, name, size, img: data, createdAt: Date.now() };
  setState(state);
  fileInput.value=''; $('clothe-name').value=''; $('clothe-size').value='';
  loadUserData();
});

function loadUserData(){
  const user = state.users[currentUser];
  // populate clothes list
  const list = $('clothes-list'); list.innerHTML='';
  const select = $('select-cloth'); select.innerHTML='<option value="">-- none --</option>';
  for(const id in user.clothes){
    const c = user.clothes[id];
    const li = document.createElement('li');
    const img = document.createElement('img'); img.src = c.img;
    const meta = document.createElement('div'); meta.style.flex='1'; meta.innerHTML = `<strong>${escapeHtml(c.name)}</strong><br><small>Size: ${escapeHtml(c.size)}</small>`;
    const btn = document.createElement('button'); btn.textContent='Use'; btn.addEventListener('click', ()=>{ select.value = id; selectClothById(id); });
    const del = document.createElement('button'); del.textContent='Delete'; del.addEventListener('click', ()=>{ if(confirm('Delete cloth?')){ delete user.clothes[id]; setState(state); loadUserData(); }});
    li.appendChild(img); li.appendChild(meta); li.appendChild(btn); li.appendChild(del);
    list.appendChild(li);

    const opt = document.createElement('option'); opt.value = id; opt.textContent = `${c.name} (${c.size})`; select.appendChild(opt);
  }
  loadHistoryList();
}

function selectClothById(id){
  if(!id){ overlayImg=null; renderCanvas(); return }
  const c = state.users[currentUser].clothes[id];
  if(!c) return;
  const img = new Image(); img.onload = ()=>{ overlayImg = img; // reset overlay
    overlay = { x: canvas.width/2, y: canvas.height/2, scale:1, rotate:0, opacity: parseFloat($('overlay-opacity').value) };
    renderCanvas(); };
  img.src = c.img;
}

$('select-cloth').addEventListener('change', (e)=>{ selectClothById(e.target.value); });

// overlay controls
$('overlay-opacity').addEventListener('input', e=>{ overlay.opacity = parseFloat(e.target.value); renderCanvas(); });
$('overlay-scale').addEventListener('input', e=>{ overlay.scale = parseFloat(e.target.value); renderCanvas(); });
$('overlay-rotate').addEventListener('input', e=>{ overlay.rotate = parseFloat(e.target.value); renderCanvas(); });

// Drag overlay with mouse / touch
let dragging=false, dragOffset={x:0,y:0};
canvas.addEventListener('pointerdown', (e)=>{
  const p = getCanvasPoint(e);
  if(!overlayImg) return;
  // check if pointer is on overlay bounding box
  const dx = p.x - overlay.x, dy = p.y - overlay.y;
  const w = overlayImg.width * overlay.scale, h = overlayImg.height * overlay.scale;
  const dist = Math.sqrt(dx*dx+dy*dy);
  if(Math.abs(dx) <= w/2 && Math.abs(dy) <= h/2){ dragging=true; dragOffset.x = dx; dragOffset.y = dy; canvas.setPointerCapture(e.pointerId); }
});
canvas.addEventListener('pointermove', (e)=>{ if(!dragging) return; const p=getCanvasPoint(e); overlay.x = p.x - dragOffset.x; overlay.y = p.y - dragOffset.y; renderCanvas(); });
canvas.addEventListener('pointerup', (e)=>{ dragging=false; try{ canvas.releasePointerCapture(e.pointerId) }catch{} });

function getCanvasPoint(evt){ const rect = canvas.getBoundingClientRect(); return { x: (evt.clientX-rect.left) * (canvas.width/rect.width), y: (evt.clientY-rect.top) * (canvas.height/rect.height) } }

// Save outfit to history
$('save-outfit').addEventListener('click', ()=>{
  if(!overlayImg) return alert('select a cloth first');
  // find selected cloth id
  const cid = $('select-cloth').value; if(!cid) return alert('select a cloth in the selector');
  const user = state.users[currentUser];
  const c = user.clothes[cid];
  // snapshot: combine person + overlay into dataURL
  const snapshot = canvas.toDataURL('image/jpeg', 0.9);
  const entry = { id: 'h_'+Date.now(), clothId: cid, clothName: c.name, size: c.size, when: Date.now(), snapshot };
  user.history.unshift(entry);
  setState(state);
  loadHistoryList();
});

function loadHistoryList(){
  const user = state.users[currentUser];
  const h = $('history-list'); h.innerHTML='';
  (user.history||[]).forEach(item=>{
    const li = document.createElement('li');
    const d = new Date(item.when).toLocaleString();
    li.innerHTML = `<div style="display:flex;gap:8px;align-items:center"><img src="${item.snapshot}" style="width:80px;height:80px;object-fit:cover;border:1px solid #ccc"><div style="flex:1"><strong>${escapeHtml(item.clothName)}</strong> <small>(${escapeHtml(item.size)})</small><br><small>${d}</small></div><button data-id="${item.id}">Delete</button></div>`;
    li.querySelector('button').addEventListener('click', e=>{ const id=e.target.dataset.id; if(confirm('delete history item?')){ user.history = user.history.filter(x=>x.id!==id); setState(state); loadHistoryList(); } });
    h.appendChild(li);
  })
}

// Helper to escape small html
function escapeHtml(s){ return (s+'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;') }

// Persist state when leaving
function saveStateToStorage(){ setState(state); }
window.addEventListener('beforeunload', saveStateToStorage);

// File helper: allow loading person/clothes from persisted state (optional auto-load)
// When logging in, try to load last profile photo if user has "profile" stored in session
function loadPersonFromUserSession(){
  const sess = state.sessions[currentUser];
  if(sess && sess.lastPerson) loadPersonFromDataURL(sess.lastPerson);
}

// On save we will persist last person image too (so returning will show it)
function persistPersonToSession(){
  if(!personImg) return;
  try{ state.sessions[currentUser] = state.sessions[currentUser] || {}; state.sessions[currentUser].lastPerson = canvas.toDataURL('image/jpeg',0.9); setState(state); }catch(e){}
}

// When user logs in, load their last session and clothes
function loadUserData(){
  const user = state.users[currentUser];
  // optional: load last person snapshot to canvas
  if(state.sessions[currentUser] && state.sessions[currentUser].lastPerson){ const img = new Image(); img.onload=()=>{ personImg = img; renderCanvas(); }; img.src = state.sessions[currentUser].lastPerson; }
  loadUserDataAfterPerson();
}
function loadUserDataAfterPerson(){
  // populate clothes etc
  const user = state.users[currentUser];
  if(!user.clothes) user.clothes = {};
  if(!user.history) user.history = [];
  loadUserData(); // careful: avoid infinite; but ok because loadUserData loads session then calls this which sets clothes/history and then calls loadUserData which will then find session and call image load - to avoid recursion we'll instead do simpler:
}

// Fix above recursion by replacing loadUserData implementation
function loadUserData(){
  const user = state.users[currentUser];
  if(!user.clothes) user.clothes = {};
  if(!user.history) user.history = [];
  // load person snapshot if any
  if(state.sessions[currentUser] && state.sessions[currentUser].lastPerson){ const img = new Image(); img.onload=()=>{ personImg = img; renderCanvas(); }; img.src = state.sessions[currentUser].lastPerson; }
  // populate clothes list and history
  const list = $('clothes-list'); list.innerHTML='';
  const select = $('select-cloth'); select.innerHTML='<option value="">-- none --</option>';
  for(const id in user.clothes){
    const c = user.clothes[id];
    const li = document.createElement('li');
    const img = document.createElement('img'); img.src = c.img;
    const meta = document.createElement('div'); meta.style.flex='1'; meta.innerHTML = `<strong>${escapeHtml(c.name)}</strong><br><small>Size: ${escapeHtml(c.size)}</small>`;
    const btn = document.createElement('button'); btn.textContent='Use'; btn.addEventListener('click', ()=>{ select.value = id; selectClothById(id); });
    const del = document.createElement('button'); del.textContent='Delete'; del.addEventListener('click', ()=>{ if(confirm('Delete cloth?')){ delete user.clothes[id]; setState(state); loadUserData(); }});
    li.appendChild(img); li.appendChild(meta); li.appendChild(btn); li.appendChild(del);
    list.appendChild(li);

    const opt = document.createElement('option'); opt.value = id; opt.textContent = `${c.name} (${c.size})`; select.appendChild(opt);
  }
  loadHistoryList();
}

// small helper: autosave person image when it's changed (call after rendering)
const originalRender = renderCanvas;
function renderCanvas(){
  clearCanvas();
  if(personImg) {
    const pw = personImg.width, ph = personImg.height;
    const scale = Math.min(canvas.width/pw, canvas.height/ph);
    const w = pw*scale, h = ph*scale;
    const dx = (canvas.width-w)/2, dy=(canvas.height-h)/2;
    ctx.drawImage(personImg, 0,0,pw,ph, dx,dy,w,h);
  }
  if(overlayImg){
    ctx.save();
    ctx.globalAlpha = overlay.opacity;
    ctx.translate(overlay.x, overlay.y);
    ctx.rotate(overlay.rotate * Math.PI/180);
    const ow = overlayImg.width * overlay.scale;
    const oh = overlayImg.height * overlay.scale;
    ctx.drawImage(overlayImg, -ow/2, -oh/2, ow, oh);
    ctx.restore();
  }
  // persist a low-res snapshot to session so next login sees it
  try{ if(currentUser){ state.sessions[currentUser] = state.sessions[currentUser] || {}; state.sessions[currentUser].lastPerson = canvas.toDataURL('image/jpeg',0.45); setState(state); } }catch(e){}
}

// Start state: show auth
showAuth();

// small helper to avoid CSP when opening file URLs in some hosts
document.addEventListener('DOMContentLoaded', ()=>{ fitCanvas(); });
