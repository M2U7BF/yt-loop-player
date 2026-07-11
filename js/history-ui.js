// 履歴パネルの描画、タブ切り替え、スワイプ削除などDOM操作を担う。
import { extractPlaylistId } from './youtube-url.js';
import { loadHistory, deleteHistoryItem, addHistory } from './history-store.js';

const input = document.getElementById('youtubeUrl');
export const historyPanel = document.getElementById('historyPanel');
const historyList = document.getElementById('historyList');

let currentTab = 'solo';

function isPlaylistItem(item) {
  return !!extractPlaylistId(item.url);
}

export function hideHistoryPanel() {
  historyPanel.classList.add('hidden');
}

function attachSwipeToDelete(li, content, item) {
  const SWIPE_THRESHOLD = 80;
  const MOVE_TOLERANCE = 6;
  let startX = 0;
  let startY = 0;
  let currentDx = 0;
  let dragging = false;
  let horizontal = false;
  let moved = false;

  const setX = (x) => {
    content.style.transform = `translateX(${x}px)`;
  };

  const begin = (x, y) => {
    startX = x;
    startY = y;
    currentDx = 0;
    dragging = true;
    horizontal = false;
    moved = false;
    content.style.transition = 'none';
  };

  const update = (x, y) => {
    if (!dragging) return;
    const dx = x - startX;
    const dy = y - startY;
    if (!horizontal) {
      if (Math.abs(dx) < MOVE_TOLERANCE && Math.abs(dy) < MOVE_TOLERANCE) return;
      if (Math.abs(dy) > Math.abs(dx)) {
        dragging = false;
        return;
      }
      horizontal = true;
    }
    moved = true;
    currentDx = Math.min(0, dx);
    setX(currentDx);
  };

  const finish = () => {
    if (!dragging) return;
    dragging = false;
    content.style.transition = 'transform 0.2s ease';
    if (currentDx < -SWIPE_THRESHOLD) {
      setX(-li.offsetWidth);
      li.style.height = `${li.offsetHeight}px`;
      requestAnimationFrame(() => {
        li.classList.add('removing');
        li.style.height = '0px';
      });
      li.addEventListener(
        'transitionend',
        () => {
          deleteHistoryItem(item.url);
          renderHistory();
        },
        { once: true }
      );
    } else {
      setX(0);
    }
  };

  li.addEventListener('touchstart', (e) => {
    const t = e.touches[0];
    begin(t.clientX, t.clientY);
  }, { passive: true });
  li.addEventListener('touchmove', (e) => {
    const t = e.touches[0];
    update(t.clientX, t.clientY);
  }, { passive: true });
  li.addEventListener('touchend', finish);
  li.addEventListener('touchcancel', finish);

  li.addEventListener('mousedown', (e) => {
    begin(e.clientX, e.clientY);
    const onMove = (ev) => update(ev.clientX, ev.clientY);
    const onUp = () => {
      finish();
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
    };
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  });

  content.addEventListener('click', (e) => {
    if (moved) {
      e.stopPropagation();
      e.preventDefault();
      return;
    }
    input.value = item.url;
    hideHistoryPanel();
    document.getElementById('playButton').click();
  });
}

/** 現在のタブに応じて履歴パネルを再描画する。 */
export function renderHistory() {
  const history = loadHistory();
  if (history.length === 0) {
    hideHistoryPanel();
    return;
  }

  const filtered = history.filter((item) =>
    currentTab === 'list' ? isPlaylistItem(item) : !isPlaylistItem(item)
  );

  historyList.innerHTML = '';

  if (filtered.length === 0) {
    const empty = document.createElement('li');
    empty.className = 'history-empty';
    empty.textContent = '履歴がありません';
    historyList.appendChild(empty);
  }

  filtered.forEach((item) => {
    const li = document.createElement('li');

    const bg = document.createElement('div');
    bg.className = 'history-item-bg';
    bg.innerHTML = '<span class="material-symbols-outlined">delete</span>';

    const content = document.createElement('div');
    content.className = 'history-item-content';
    content.textContent = item.title;

    li.appendChild(bg);
    li.appendChild(content);
    attachSwipeToDelete(li, content, item);

    historyList.appendChild(li);
  });

  historyPanel.classList.remove('hidden');
}

document.querySelectorAll('.history-tab').forEach((tab) => {
  tab.addEventListener('click', (e) => {
    e.stopPropagation();
    currentTab = tab.dataset.tab;
    document.querySelectorAll('.history-tab').forEach((t) => t.classList.toggle('active', t === tab));
    renderHistory();
  });
});

input.addEventListener('change', () => {
  const urlText = input.value.trim();
  if (urlText) {
    addHistory(urlText);
  }
});

input.addEventListener('focus', () => {
  renderHistory();
});

document.addEventListener('click', (e) => {
  if (!input.contains(e.target) && !historyPanel.contains(e.target)) {
    hideHistoryPanel();
  }
});
