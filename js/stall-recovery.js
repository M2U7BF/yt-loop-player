// バッファリング停滞（グルグル）の自動復旧
// 再生位置が一定時間進まない場合に「先にスキップ → 動画再ロード → ページ再読み込み」と段階的に復旧する
(function () {
  // ===== 定数 =====
  var TICK_MS = 1000;                  // 監視間隔
  var STALL_TIMEOUT_MS = 3000;         // この時間進捗がなければ停滞と判定
  var NETWORK_PROBE_TIMEOUT_MS = 2500; // ネットワーク疎通確認のタイムアウト
  var HEALTHY_RESET_MS = 30000;        // この時間正常再生が続いたらレベルをリセット
  var PROGRESS_EPSILON = 0.05;         // 再生位置の変化とみなす最小秒数
  var SKIP_AHEAD_SEC = 10;             // レベル0で先にスキップする秒数
  var RELOAD_GUARD_MAX = 2;            // リロードループ防止: 窓内の上限回数
  var RELOAD_GUARD_WINDOW_MS = 600000; // リロード回数のカウント窓（10分）
  var RESTORE_EXPIRE_MS = 120000;      // リロード後の位置復元の有効期限（2分）
  var RESTORE_KEY = 'ytStallRestore';
  var RELOAD_COUNT_KEY = 'ytStallReloadCount';

  // ===== 状態 =====
  var lastTime = null;             // 前回tickの再生位置
  var lastFraction = 0;            // 前回tickのバッファ読み込み割合
  var lastProgressAt = Date.now(); // 最後に進捗を確認した時刻
  var lastActionAt = 0;            // 最後に復旧アクションを実行した時刻
  var recoveryLevel = 0;           // 0:先にシーク / 1:動画再ロード / 2:ページ再読み込み
  var healthySince = null;         // 正常再生が続いている開始時刻
  var probing = false;             // ネットワーク疎通確認中フラグ
  var pendingRestore = loadPendingRestore(); // リロード後の復元情報

  // リロード前に保存した復元情報を読み出す（読み出したら即削除）
  function loadPendingRestore() {
    try {
      var raw = sessionStorage.getItem(RESTORE_KEY);
      sessionStorage.removeItem(RESTORE_KEY);
      if (!raw) return null;
      var data = JSON.parse(raw);
      if (!data || Date.now() - data.ts > RESTORE_EXPIRE_MS) return null;
      return data;
    } catch (e) {
      return null;
    }
  }

  function getCurrentVideoId() {
    var data = typeof player.getVideoData === 'function' ? player.getVideoData() : null;
    if (data && data.video_id) return data.video_id;
    // フォールバック: 入力欄のURLから抽出
    var url = document.getElementById('youtubeUrl').value;
    return typeof extractVideoId === 'function' ? extractVideoId(url) : null;
  }

  // PLAYING（位置が凍結）と BUFFERING のみ停滞候補。PAUSED/CUED/UNSTARTED/ENDED は対象外
  function isStallCandidateState(state) {
    return state === YT.PlayerState.PLAYING || state === YT.PlayerState.BUFFERING;
  }

  function reloadGuardExceeded(now) {
    try {
      var raw = sessionStorage.getItem(RELOAD_COUNT_KEY);
      if (!raw) return false;
      var data = JSON.parse(raw);
      if (!data || now - data.since > RELOAD_GUARD_WINDOW_MS) return false;
      return data.count >= RELOAD_GUARD_MAX;
    } catch (e) {
      return false;
    }
  }

  function bumpReloadCount(now) {
    var data = { count: 1, since: now };
    try {
      var prev = JSON.parse(sessionStorage.getItem(RELOAD_COUNT_KEY));
      if (prev && now - prev.since <= RELOAD_GUARD_WINDOW_MS) {
        data = { count: prev.count + 1, since: prev.since };
      }
    } catch (e) { /* 破損時は初期値のまま */ }
    try { sessionStorage.setItem(RELOAD_COUNT_KEY, JSON.stringify(data)); } catch (e) { }
  }

  function clearReloadCount() {
    try { sessionStorage.removeItem(RELOAD_COUNT_KEY); } catch (e) { }
  }

  function buildReloadUrl() {
    var params = new URLSearchParams(window.location.search);
    var url = document.getElementById('youtubeUrl').value;
    // main.jsがdecodeURIComponentで二重デコードするため、二重エンコードしておく
    params.set('url', encodeURIComponent(url));
    return window.location.pathname + '?' + params.toString();
  }

  // 停滞の原因がネットワークかどうかをYouTubeへの疎通で確認する
  // 疎通あり = プレイヤー側の問題 → 復旧アクション / 疎通なし = ネットワークが原因 → 待機
  function probeNetwork(callback) {
    var controller = new AbortController();
    var timer = setTimeout(function () { controller.abort(); }, NETWORK_PROBE_TIMEOUT_MS);
    fetch('https://www.youtube.com/favicon.ico', { mode: 'no-cors', cache: 'no-store', signal: controller.signal })
      .then(function () { clearTimeout(timer); callback(true); })
      .catch(function () { clearTimeout(timer); callback(false); });
  }

  function reportStall(level) {
    if (typeof gtag === 'function') {
      gtag('event', 'stall_recovery', { level: level });
    }
  }

  // ページ再読み込み後、再生が始まったら保存しておいた位置へ1回だけ復元する
  function applyPendingRestore() {
    if (!pendingRestore) return;
    if (Date.now() - pendingRestore.ts > RESTORE_EXPIRE_MS) {
      pendingRestore = null;
      return;
    }
    if (player.getPlayerState() !== YT.PlayerState.PLAYING) return;
    if (pendingRestore.isPlaylist) {
      var index = player.getPlaylistIndex();
      if (typeof pendingRestore.playlistIndex === 'number' && index !== pendingRestore.playlistIndex) {
        if (pendingRestore.jumped) {
          // インデックス移動に失敗 → 諦める
          pendingRestore = null;
          return;
        }
        pendingRestore.jumped = true;
        player.playVideoAt(pendingRestore.playlistIndex);
        return; // 次のtick以降で位置を復元する
      }
    } else {
      var data = typeof player.getVideoData === 'function' ? player.getVideoData() : null;
      if (!data || data.video_id !== pendingRestore.videoId) return;
    }
    if (typeof pendingRestore.time === 'number' && pendingRestore.time > 0) {
      player.seekTo(pendingRestore.time, true);
    }
    pendingRestore = null;
  }

  function doRecovery(now, currentTime) {
    lastActionAt = now;
    var level = recoveryLevel;
    if (level >= 2 && reloadGuardExceeded(now)) {
      level = 1; // リロード回数上限に達したらレベル1の再試行に留める
    }
    reportStall(level);
    if (level === 0) {
      // レベル0: 少し先にスキップして読み込みを蹴り直す
      console.log('[stall-recovery] レベル0: ' + SKIP_AHEAD_SEC + '秒先へスキップ');
      player.seekTo(currentTime + SKIP_AHEAD_SEC, true);
      player.playVideo();
      recoveryLevel = 1;
    } else if (level === 1) {
      if (isPlaylist) {
        // プレイリストは次の動画へ進む
        console.log('[stall-recovery] レベル1: 次の動画へ');
        player.nextVideo();
      } else {
        // 単一動画は同じ位置から再ロード
        console.log('[stall-recovery] レベル1: 動画を再ロード');
        player.loadVideoById({ videoId: getCurrentVideoId(), startSeconds: currentTime });
        player.unMute();
      }
      recoveryLevel = 2;
    } else {
      // レベル2: ページごと再読み込み（既存の ?url= 自動再生パスに乗せる）
      console.log('[stall-recovery] レベル2: ページを再読み込み');
      bumpReloadCount(now);
      try {
        sessionStorage.setItem(RESTORE_KEY, JSON.stringify({
          videoId: getCurrentVideoId(),
          time: currentTime,
          playlistIndex: isPlaylist ? player.getPlaylistIndex() : null,
          isPlaylist: !!isPlaylist,
          ts: now
        }));
      } catch (e) { }
      window.location.replace(buildReloadUrl());
    }
  }

  function tick() {
    if (!window.player || typeof player.getPlayerState !== 'function') return;
    var now = Date.now();
    applyPendingRestore();

    var state = player.getPlayerState();
    var t = player.getCurrentTime();
    var frac = typeof player.getVideoLoadedFraction === 'function' ? player.getVideoLoadedFraction() : 0;
    var hasTime = typeof t === 'number' && isFinite(t);

    // 進捗チェック: 再生位置の変化（ループのシーク戻りも進捗とみなすため前後どちらでも）
    // またはバッファ読み込み割合の増加（広告中・低速回線での誤検知防止）
    var progressed = false;
    if (hasTime) {
      if (lastTime === null || Math.abs(t - lastTime) >= PROGRESS_EPSILON) progressed = true;
      lastTime = t;
    }
    if (typeof frac === 'number') {
      if (frac - lastFraction > 0.001) progressed = true;
      lastFraction = frac;
    }
    if (progressed) {
      lastProgressAt = now;
    }

    // PLAYING/BUFFERING以外は停滞扱いしない
    if (!isStallCandidateState(state)) {
      lastProgressAt = now;
      healthySince = null;
      return;
    }

    // 何もロードされていない（停止中など）なら対象外
    if (!getCurrentVideoId()) {
      lastProgressAt = now;
      return;
    }

    // 正常再生が一定時間続いたらレベルとリロード回数をリセット
    if (state === YT.PlayerState.PLAYING && progressed) {
      if (healthySince === null) healthySince = now;
      if (now - healthySince >= HEALTHY_RESET_MS) {
        recoveryLevel = 0;
        clearReloadCount();
      }
    } else if (!progressed) {
      healthySince = null;
    }

    // 停滞判定 → ネットワークが原因なら待機、プレイヤー側の問題なら段階的復旧
    if (now - lastProgressAt >= STALL_TIMEOUT_MS && now - lastActionAt >= STALL_TIMEOUT_MS && !probing) {
      if (navigator.onLine === false) return; // 明らかにオフライン → 回線復帰を待つ
      probing = true;
      var stalledTime = hasTime ? t : 0;
      probeNetwork(function (ok) {
        probing = false;
        if (!ok) {
          // ネットワークが原因 → 復旧アクションはせず、そのまま回線回復を待つ
          console.log('[stall-recovery] ネットワーク疎通なし: 回線回復を待機');
          lastActionAt = Date.now(); // 次の疎通確認まで間隔を空ける
          return;
        }
        // 疎通確認中に再生が進んでいたら何もしない
        if (Date.now() - lastProgressAt < STALL_TIMEOUT_MS) return;
        doRecovery(Date.now(), stalledTime);
      });
    }
  }

  // バックグラウンドタブ復帰直後・回線復帰直後の誤発火を防ぐ（1停滞期間の猶予を与える）
  document.addEventListener('visibilitychange', function () {
    if (!document.hidden) {
      lastProgressAt = Date.now();
      lastActionAt = Date.now();
    }
  });
  window.addEventListener('online', function () {
    lastProgressAt = Date.now();
    lastActionAt = Date.now();
  });

  setInterval(tick, TICK_MS);
})();
