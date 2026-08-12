// 設定パネル（Googleログイン・プレイリストインポートの起点）の開閉を管理する。
import { ensureGoogleIdentityLoaded } from './drive-sync.js';

const settingsButton = document.getElementById('settingsButton');
const panel = document.getElementById('settingsPanel');
const backdrop = document.getElementById('settingsBackdrop');
const closeButton = document.getElementById('settingsClose');

function open() {
  if (panel) panel.classList.remove('hidden');
  ensureGoogleIdentityLoaded();
}

function close() {
  if (panel) panel.classList.add('hidden');
}

if (settingsButton) {
  settingsButton.addEventListener('click', (e) => {
    e.stopPropagation();
    open();
  });
}
if (closeButton) {
  closeButton.addEventListener('click', (e) => {
    e.stopPropagation();
    close();
  });
}
if (backdrop) {
  backdrop.addEventListener('click', (e) => {
    e.stopPropagation();
    close();
  });
}

window.settingsPanel = { open, close };
