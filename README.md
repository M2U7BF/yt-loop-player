# youtube動画を自動リピートするツール

## 今すぐ使う
下記URLをクリック。<br>
https://m2u7bf.github.io/yt-loop-player/index.html

## 用途
* 作業用BGMの無限リピート再生

## 使い方
１） ページの表示
<img src="https://github.com/M2U7BF/yt-loop-player/blob/main/readme/Screenshot%20from%202025-11-11%2014-45-51.png" width="500px">

２）URLの入力
<img src="https://github.com/M2U7BF/yt-loop-player/blob/main/readme/Screenshot%20from%202025-11-11%2014-50-02.png width="500px">

３）再生ボタンを押す
<img src="https://github.com/M2U7BF/yt-loop-player/blob/main/readme/Screenshot%20from%202025-11-11%2014-50-39.png width="500px">

## 注意点
* 動画の停止は停止ボタンから行ってください。簡易的にバックグラウンド再生に対応した関係でiframeのクリックでは停止できません。

## 機能
* `url`クエリに指定のURLを入れてページを表示すると、jsでそれを読み込み、URL入力欄に自動入力する。
* ブラウザを開くだけなので、pc,モバイルの双方に対応。
* モバイルの対応ブラウザ（Chrome等）でのバックグラウンド再生

## 開発経緯
* 作業BGMで無限再生するツールがほしかった。
* 便利ツールサイトで同様のサイトがあったが、無限自動再生が有料だった。
* Youtube, Youtube musicで自動再生を無限にやろうとする場合、有料プランへの参加が必要。
  * 無料プランだと定期的に「視聴してますか？」と問うようなポップアップが表示され、再生停止される
* 