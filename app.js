'use strict';
const KEY = 'karate-memo-v1';
const COLORS = ['#e8590c', '#1c7ed6', '#2f9e44', '#ae3ec9', '#d6336c', '#0c8599'];
const BASE = '基本・その他';
const $ = id => document.getElementById(id);
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
const today = () => { const d = new Date(); return new Date(d - d.getTimezoneOffset() * 6e4).toISOString().slice(0, 10); };

function initial() {
  const children = [], katas = [];
  ['子供1', '子供2', '子供3'].forEach((name, i) => {
    const id = uid();
    children.push({ id, name, color: COLORS[i], order: i });
    katas.push({ id: uid(), childId: id, name: BASE, order: 0, base: true });
  });
  return { children, katas, notes: [], last: { child: children[0].id, kata: null } };
}
let S;
try { S = JSON.parse(localStorage.getItem(KEY)) || initial(); } catch (e) { S = initial(); }
const save = () => localStorage.setItem(KEY, JSON.stringify(S));

const child = () => S.children.find(c => c.id === S.last.child) || S.children[0];
const katasOf = cid => S.katas.filter(k => k.childId === cid).sort((a, b) => a.order - b.order);
function kata() {
  const ks = katasOf(child().id);
  return ks.find(k => k.id === S.last.kata) || ks[0];
}

function render() {
  const c = child(), k = kata();
  S.last.child = c.id; S.last.kata = k.id;
  document.documentElement.style.setProperty('--c', c.color);
  document.querySelector('meta[name=theme-color]').content = c.color;

  const ct = $('childTabs'); ct.innerHTML = '';
  S.children.slice().sort((a, b) => a.order - b.order).forEach(x => {
    const b = document.createElement('button');
    b.textContent = x.name; b.className = x.id === c.id ? 'on' : '';
    b.onclick = () => { S.last.child = x.id; S.last.kata = null; save(); render(); };
    ct.appendChild(b);
  });

  const kt = $('kataTabs'); kt.innerHTML = '';
  katasOf(c.id).forEach(x => {
    const b = document.createElement('button');
    b.textContent = x.name; b.className = x.id === k.id ? 'on' : '';
    b.onclick = () => { S.last.kata = x.id; save(); render(); };
    kt.appendChild(b);
  });
  const add = document.createElement('button');
  add.textContent = '＋'; add.className = 'add'; add.setAttribute('aria-label', '形を追加');
  add.onclick = () => {
    const name = (prompt('追加する形の名前') || '').trim();
    if (!name) return;
    const ks = katasOf(c.id);
    const nk = { id: uid(), childId: c.id, name, order: ks.length };
    S.katas.push(nk); S.last.kata = nk.id; save(); render();
  };
  kt.appendChild(add);

  const list = $('list'); list.innerHTML = '';
  const notes = S.notes.filter(n => n.kataId === k.id)
    .sort((a, b) => (b.pinned - a.pinned) || b.date.localeCompare(a.date) || b.createdAt - a.createdAt);
  if (!notes.length) list.innerHTML = '<p class="empty">まだメモがありません<br>右下の＋で書きましょう</p>';
  notes.forEach(n => {
    const d = document.createElement('div');
    d.className = 'note' + (n.pinned ? ' pinned' : '');
    d.innerHTML = '<div class="d"></div><div class="body"></div><button class="star"></button>';
    d.querySelector('.d').textContent = n.date.replace(/-/g, '/');
    d.querySelector('.body').textContent = n.body;
    const st = d.querySelector('.star');
    st.textContent = n.pinned ? '★' : '☆';
    st.setAttribute('aria-label', '自主練ピン');
    st.onclick = e => { e.stopPropagation(); n.pinned = !n.pinned; n.updatedAt = Date.now(); save(); render(); };
    d.onclick = () => openEditor(n);
    list.appendChild(d);
  });
}

/* ---- editor ---- */
let cur = null, isNew = false, timer;
function openEditor(n) {
  isNew = !n;
  cur = n || { id: uid(), kataId: kata().id, body: '', date: today(), pinned: false, createdAt: Date.now(), updatedAt: Date.now() };
  $('edBody').value = cur.body; $('edDate').value = cur.date;
  $('edPin').textContent = cur.pinned ? '★' : '☆';
  $('edSaved').textContent = '';
  $('edDel').hidden = isNew;
  $('sheet').hidden = false;
  if (isNew) $('edBody').focus();
}
function persistNote() {
  if (!cur) return;
  cur.body = $('edBody').value;
  cur.date = $('edDate').value || today();
  cur.updatedAt = Date.now();
  if (isNew) {
    if (!cur.body.trim()) return;
    S.notes.push(cur); isNew = false; $('edDel').hidden = false;
  }
  save();
  $('edSaved').textContent = '保存しました';
}
const autosave = () => { clearTimeout(timer); timer = setTimeout(persistNote, 300); };
$('edBody').oninput = autosave;
$('edDate').onchange = autosave;
$('edPin').onclick = () => { cur.pinned = !cur.pinned; $('edPin').textContent = cur.pinned ? '★' : '☆'; persistNote(); };
$('edClose').onclick = () => { clearTimeout(timer); persistNote(); cur = null; $('sheet').hidden = true; render(); };
$('edDel').onclick = () => {
  if (!confirm('このメモを削除しますか？')) return;
  clearTimeout(timer);
  S.notes = S.notes.filter(n => n.id !== cur.id); save();
  cur = null; $('sheet').hidden = true; render();
};
$('fab').onclick = () => openEditor(null);

/* ---- menu ---- */
$('menuBtn').onclick = () => { $('menu').hidden = false; };
$('menu').onclick = e => {
  if (e.target === $('menu')) $('menu').hidden = true;
  const act = e.target.dataset && e.target.dataset.act;
  if (!act) return;
  $('menu').hidden = true;
  const c = child(), k = kata();
  if (act === 'search') { $('search').hidden = false; $('seInput').value = ''; $('seList').innerHTML = ''; $('seInput').focus(); }
  if (act === 'renameChild') {
    const name = (prompt('名前', c.name) || '').trim();
    if (name) c.name = name;
    const col = prompt('色番号を選んでください\n' + COLORS.map((_, i) => (i + 1) + ': ' + ['オレンジ', '青', '緑', '紫', 'ピンク', '水色'][i]).join('\n'), COLORS.indexOf(c.color) + 1);
    const i = parseInt(col, 10);
    if (i >= 1 && i <= COLORS.length) c.color = COLORS[i - 1];
    save(); render();
  }
  if (act === 'renameKata') {
    if (k.base) return alert('「' + BASE + '」の名前は変更できません');
    const name = (prompt('形の名前', k.name) || '').trim();
    if (name) { k.name = name; save(); render(); }
  }
  if (act === 'left' || act === 'right') {
    const ks = katasOf(c.id), i = ks.indexOf(k), j = i + (act === 'left' ? -1 : 1);
    if (k.base || j < 1 || j >= ks.length) return;
    [ks[i], ks[j]] = [ks[j], ks[i]];
    ks.forEach((x, n) => x.order = n); save(); render();
  }
  if (act === 'delKata') {
    if (k.base) return alert('「' + BASE + '」は削除できません');
    const cnt = S.notes.filter(n => n.kataId === k.id).length;
    if (!confirm('形「' + k.name + '」を削除しますか？\n中のメモ' + cnt + '件も消えます。')) return;
    S.notes = S.notes.filter(n => n.kataId !== k.id);
    S.katas = S.katas.filter(x => x.id !== k.id);
    katasOf(c.id).forEach((x, n) => x.order = n);
    S.last.kata = null; save(); render();
  }
  if (act === 'export') {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([JSON.stringify(S, null, 1)], { type: 'application/json' }));
    a.download = 'karate-memo-' + today() + '.json'; a.click();
  }
  if (act === 'import') $('file').click();
};
$('file').onchange = e => {
  const f = e.target.files[0]; e.target.value = '';
  if (!f) return;
  const r = new FileReader();
  r.onload = () => {
    try {
      const d = JSON.parse(r.result);
      if (!Array.isArray(d.children) || !Array.isArray(d.katas) || !Array.isArray(d.notes)) throw 0;
      if (!confirm('いまのデータを、読み込んだデータで置き換えます。よろしいですか？')) return;
      S = d; S.last = S.last || {}; save(); render();
    } catch (x) { alert('読み込めませんでした。バックアップのファイルを選んでください。'); }
  };
  r.readAsText(f);
};

/* ---- search ---- */
const esc = s => s.replace(/[&<>]/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[m]));
$('seInput').oninput = () => {
  const q = $('seInput').value.trim().toLowerCase();
  const out = $('seList'); out.innerHTML = '';
  if (!q) return;
  S.notes.filter(n => n.body.toLowerCase().includes(q))
    .sort((a, b) => b.date.localeCompare(a.date)).forEach(n => {
      const k = S.katas.find(x => x.id === n.kataId); if (!k) return;
      const c = S.children.find(x => x.id === k.childId);
      const d = document.createElement('div'); d.className = 'hit';
      const re = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
      d.innerHTML = '<small>' + esc(c.name) + ' › ' + esc(k.name) + ' · ' + n.date.replace(/-/g, '/') + '</small>' +
        esc(n.body).replace(re, m => '<mark>' + m + '</mark>');
      d.onclick = () => {
        $('search').hidden = true; S.last.child = c.id; S.last.kata = k.id; save(); render(); openEditor(n);
      };
      out.appendChild(d);
    });
  if (!out.children.length) out.innerHTML = '<p class="empty">見つかりませんでした</p>';
};
$('seClose').onclick = () => { $('search').hidden = true; };

render();
if ('serviceWorker' in navigator && location.protocol.startsWith('http')) navigator.serviceWorker.register('sw.js');
