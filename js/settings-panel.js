// 設定パネル（Googleログイン・プレイリストインポートの起点）の開閉を管理する。
(function () {
  var settingsButton = document.getElementById('settingsButton');
  var panel = document.getElementById('settingsPanel');
  var backdrop = document.getElementById('settingsBackdrop');
  var closeButton = document.getElementById('settingsClose');

  function open() {
    if (panel) panel.classList.remove('hidden');
  }

  function close() {
    if (panel) panel.classList.add('hidden');
  }

  if (settingsButton) {
    settingsButton.addEventListener('click', function (e) {
      e.stopPropagation();
      open();
    });
  }
  if (closeButton) {
    closeButton.addEventListener('click', function (e) {
      e.stopPropagation();
      close();
    });
  }
  if (backdrop) {
    backdrop.addEventListener('click', function (e) {
      e.stopPropagation();
      close();
    });
  }

  window.settingsPanel = { open: open, close: close };
})();
