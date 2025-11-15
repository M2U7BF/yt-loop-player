const input = document.getElementById("youtubeUrl");
const historyList = document.getElementById("historyList");

const STORAGE_KEY = "ytHistory";
const MAX_HISTORY = 5;

// 履歴を取得
function loadHistory() {
  return JSON.parse(localStorage.getItem(STORAGE_KEY)) || [];
}

// 履歴を保存
function saveHistory(history) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(history));
}

async function fetchYoutubeTitle(url) {
  try {
    const api = `https://www.youtube.com/oembed?url=${encodeURIComponent(url)}&format=json`;
    const res = await fetch(api);
    if (!res.ok) return null; // URL不正など
    const data = await res.json();
    return data.title;
  } catch {
    return null;
  }
}

// 入力を履歴に追加（重複排除・新しいものを先頭へ）
async function addHistory(url) {
  if (!url || !extractVideoId(url)) return;

  let history = loadHistory();

  // 既存項目削除（URL一致で重複扱い）
  history = history.filter(item => item.url !== url);

  // タイトル取得
  const title = await fetchYoutubeTitle(url) || "（タイトル取得失敗）";

  // 新しい履歴を追加（最新を先頭）
  history.unshift({ url, title });

  // 5件まで
  history = history.slice(0, MAX_HISTORY);

  saveHistory(history);
}

// 履歴を描画
function renderHistory() {
  const history = loadHistory();
  if (history.length === 0) {
    historyList.classList.add("hidden");
    return;
  }

  historyList.innerHTML = "";
  history.forEach(item => {
    const li = document.createElement("li");
    li.textContent = item.title;  // タイトル表示

    li.addEventListener("click", () => {
      input.value = item.url;   // URLをinputにセット
      historyList.classList.add("hidden");
      // 再生開始
      document.getElementById('playButton').click();
    });

    historyList.appendChild(li);
  });

  historyList.classList.remove("hidden");
}

// 入力確定時（Enter または blur）に履歴追加
input.addEventListener("change", () => {
  const urlText = input.value.trim();
  if (urlText) {
    addHistory(urlText);
  }
});

// focus 時に履歴を表示
input.addEventListener("focus", () => {
  renderHistory();
});

function hiddenHistory() {
  historyList.classList.add("hidden");
}

// input 以外をクリックしたら履歴を閉じる
document.addEventListener("click", (e) => {
  if (!input.contains(e.target) && !historyList.contains(e.target)) {
    historyList.classList.add("hidden");
  }
});
