// YouTube APIスクリプトの読み込み
var tag = document.createElement('script');
tag.src = "https://www.youtube.com/iframe_api";
var firstScriptTag = document.getElementsByTagName('script')[0];
firstScriptTag.parentNode.insertBefore(tag, firstScriptTag);

var player; // playerオブジェクトをグローバルで保持
var enablePause = false;

function inputUrlFromQuery() {
  var urlParams = new URLSearchParams(window.location.search);
  var urlFromParam = urlParams.get('url'); // 'url'パラメータの値を取得
  var urlInput = document.getElementById('youtubeUrl');

  if (urlInput.value) {
    return false;
  }
  if (urlFromParam) {
    // デコードして入力欄にセット
    urlInput.value = decodeURIComponent(urlFromParam);
    return true;
  }
  return false;
}

function manageEnablePauseFromQuery() {
  var urlParams = new URLSearchParams(window.location.search);
  var urlFromParam = urlParams.get('pause');

  enablePause = urlFromParam === 'true' ? true : false;
}

// 2. API準備完了時にプレーヤーを初期化
function onYouTubeIframeAPIReady() {
  player = new YT.Player('player', {
    height: '100%',
    width: '100%',
    playerVars: {
      'controls': 1,
      'rel': 0,
      'showinfo': 0,
      'iv_load_policy': 3,
      'playsinline': 1
    },
    events: {
      'onReady': onPlayerReady,
      'onStateChange': onPlayerStateChange
    }
  });
}

function onPlayerReady(event) {
  if (inputUrlFromQuery()) {
    document.getElementById('playButton').click();
  }
  manageEnablePauseFromQuery();
}

// 3. 動画の状態変化を監視（リピート再生のため）
function onPlayerStateChange(event) {
  if (event.data == -1) {
    var url = document.getElementById('youtubeUrl').value;
    addHistory(url);
  }
  else if (event.data == YT.PlayerState.PLAYING) {
    updateButtonDisplay(true);
  }
  else if (event.data == YT.PlayerState.ENDED || (!enablePause && event.data == YT.PlayerState.PAUSED)) {
    player.playVideo(); // 再び再生（ループ）
  }
  hiddenHistory();
}

// ボタンの表示切り替え
function updateButtonDisplay(isPlaying) {
  var playButton = document.getElementById('playButton');
  var stopButton = document.getElementById('stopButton');
  var pauseButton = document.getElementById('pauseButton');
  if (isPlaying) {
    playButton.classList.add("hidden");
    stopButton.classList.remove("hidden");
    if (enablePause) pauseButton.classList.remove("hidden");
  } else {
    playButton.classList.remove("hidden");
    stopButton.classList.add("hidden");
    if (enablePause) pauseButton.classList.add("hidden");
  }
}

// 4. 再生開始ボタンのクリックイベント
document.getElementById('playButton').addEventListener('click', function () {
  var url = document.getElementById('youtubeUrl').value;
  var videoId = extractVideoId(url);

  if (player && player.getPlayerState() == YT.PlayerState.PAUSED)
  {
    player.playVideo();
  }
  else if (videoId) {
    player.loadVideoById(videoId);
    player.unMute();
  } else {
    alert("有効なYouTubeのURLを入力してください。");
  }
});
document.getElementById('stopButton').addEventListener('click', function () {
  if (player) {
    player.stopVideo();
  }
  updateButtonDisplay(false);
});
document.getElementById('pauseButton').addEventListener('click', function () {
  if (player) {
    // enablePause = true;
    player.pauseVideo();
  }
  updateButtonDisplay(false);
});
document.getElementById('youtubeUrl').addEventListener('keydown', function (event) {
  if (event.key === 'Enter') {
    document.getElementById('playButton').click();
  }
});

// 5. URLからYouTube動画IDを抽出する関数
function extractVideoId(url) {
  var regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/;
  var match = url.match(regExp);
  if (match && match[2].length == 11) {
    return match[2];
  } else {
    return null;
  }
}