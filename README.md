# YouTube動画を自動リピートするツール

## 今すぐ使う
下記URLをクリック。<br>
https://m2u7bf.github.io/yt-loop-player/index.html

## 用途
* YouTube動画の無限リピート再生
* 作業用BGMのプレイヤーとして使えます。

## 使い方
１） ページの表示<br>
<img src="https://github.com/M2U7BF/yt-loop-player/blob/main/readme/Screenshot%20from%202025-11-11%2014-45-51.png" width="500px">

２）URLの入力<br>
<img src="https://github.com/M2U7BF/yt-loop-player/blob/main/readme/Screenshot%20from%202025-11-11%2014-50-02.png" width="500px">

３）再生ボタンを押す<br>
<img src="https://github.com/M2U7BF/yt-loop-player/blob/main/readme/Screenshot%20from%202025-11-11%2014-50-39.png" width="500px">

## 注意点
* 動画の停止は停止ボタンから行ってください。簡易的にバックグラウンド再生に対応した関係でiframeのクリックでは停止できません。

## 機能
* YouTube動画の無限再生
* URLクエリパラメータを使用可能
  * `url`というパラメータに任意のYouTube URLを入れてアクセスすると、jsでそれを読み込み、URL入力欄に自動入力します。
* PC、モバイルの双方で利用可能
* バックグラウンド再生
* 入力履歴の保持（最大20件）
  * 新しい履歴ほど上に表示されます。

## 開発経緯
* 作業BGM用にYouTubeの動画を無限再生するツールがほしかった。
* 無料で実現したかった。
  * 便利ツールサイトで同様のサイトがあったが、無限自動再生が有料だった。
  * Youtube, Youtube musicで自動再生を無限にやろうとする場合、有料プランへの参加が必要だった。
* YouTubeの無料プランだと、定期的に「視聴してますか？」と問うようなポップアップが表示され、再生停止されてしまい無限再生ができなかった。
