var player = null;
var ws = null;

// youtube player のスクリプトの準備ができた時
function onYouTubeIframeAPIReady() {
  player = new YT.Player('player', {
    height: '360',
    width: '640',
    videoId: 'M7lc1UVf-VE',
    events: {
      'onReady': onPlayerReady,
      'onStateChange': onPlayerStateChange
    }
  });
}

function onPlayerReady(event) {
  // event.target.playVideo();
  // player.loadVideoById("194gT3-jiNc");
  player.playVideo();
  setInterval(() => {
    var url = parseYouTubeUrl(player.getVideoUrl());
    var videoId = url.v;

    var status = {
      state: getStateString(player.getPlayerState()),
      currentTime: player.getCurrentTime(),
      quality: player.getPlaybackQuality(),
      videoId: videoId,
    };
    // console.log(status);
    if (ws !== null) {
      sendCommand("PLAYER_STATUS", status);
    }
  }, 3000);
}

var pausedTime = 0;
var pausedTriggerHandler = 0;
function onPlayerStateChange(event) {
  // if (event.data == YT.PlayerState.PLAYING && !done) {
  //   setTimeout(stopVideo, 6000);
  // }
  if (event.data === YT.PlayerState.PAUSED){
    pausedTime = nowSeconds();
    if (pausedTriggerHandler !== 0){
      clearTimeout(pausedTriggerHandler);
    }
    pausedTriggerHandler = setTimeout(()=>{
      var diff = (nowSeconds() - pausedTime);
      if ((diff >= 100) && (pausedTime !== 0)){
        onPlayerPaused();
      }
      pausedTriggerHandler = 0;
    }, 100);
  }
  else if (event.data === YT.PlayerState.BUFFERING){
    var diff = (nowSeconds() - pausedTime)
    if (diff < 100){
      onPlayerSeeked(event)
    }
    pausedTime = 0;
  }
  else if (event.data === YT.PlayerState.PLAYING) {
    onPlayerPlayed();
  }
  console.log("status", getStateString(event.data));
}

function onPlayerSeeked(event) {
  // モバイルでのseek がつかめない
  console.log("user seek");
  sendCommand("SEEK", player.getCurrentTime());
}

function onPlayerPaused() {
  console.log("user paused");
  sendCommand("PAUSE");
}

function onPlayerPlayed() {
  sendCommand("PLAY");
}


var ws_connect = function () {
  var host = location.host;
  if (host == "") host = "localhost:8888";
  var path = location.pathname || "/";
  if (!path.endsWith("/")) { path += "/" }
  ws = new WebSocket("ws:" + host + path + "websocket");

  ws.onopen = function () {
    console.log("WebSocket connected.")
    setTimeout(sendPing, pingInterval, ws);

    var waitPlayerReady = function () {
      if (player === null) {
        console.log("player not ready yet");
        setTimeout(() => { waitPlayerReady() }, 100);
        return;
      }
    }
    waitPlayerReady();
  }

  ws.onmessage = function (evt) {
    var data = JSON.parse(evt.data);
    var command = data.command;
    var payload = data.payload
    console.info('[WS]', command);

    switch (command) {

      case "PONG":
        console.log('PONG');
        setTimeout(sendPing, pingInterval);
        break;

      case "SYNC":
        console.log('SYNC', data.payload);
        var url = parseYouTubeUrl(player.getVideoUrl());
        var videoId = url.v;
        var status = {
          state: player.getPlayerState(),
          currentTime: player.getCurrentTime(),
          quality: player.getPlaybackQuality(),
          videoId: videoId,
        };
        if (Math.abs(status.currentTime - payload.currentTime) > 1) {
          player.seekTo(Math.min(status.currentTime, payload.currentTime));
        }

        if (status.videoId !== payload.videoId) {
          player.loadVideoById({
            videoId: payload.videoId,
            startSeconds: payload.currentTime,
          });
        }

        break;

      case "SEEK":
        if (Math.abs(player.getCurrentTime() - payload) > 1) {
          player.seekTo(payload);
        }
        break;

      case "PAUSE":
        player.pauseVideo();
        break;

      case "PLAY":
        player.playVideo();
        break;

      case "VIDEO_CHANGE":
        player.loadVideoById(payload);

      default:
        console.log('unknown command: ' + command);
        break;
    }
  }

}


var pingInterval = 30 * 1000;

var sendCommand = function (command, payload) {
  var data = {
    command: command,
    payload: payload
  };
  ws.send(JSON.stringify(data));
}

function sendPing() {
  var data = {
    command: "PING",
  };
  ws.send(JSON.stringify(data));
}

var parseYouTubeUrl = function (url) {
  var parser = document.createElement('a');
  parser.href = url;

  if (parser.pathname !== "/watch") {
    throw new Error("url unsupport. " + JSON.stringify(parser));
  }
  var params = parser.search.substring(1).split("&");

  var kv = {};
  for (var itr in params) {
    var s = params[itr];
    var a = s.split("=");
    kv[a[0]] = a[1];
  }

  return kv;
};

var YTStateStrings = {};
function getStateString(state){
  if (Object.keys(YTStateStrings).length == 0){
    for (var key in YT.PlayerState){
      YTStateStrings[YT.PlayerState[key]] = key;
    }
  }
  return YTStateStrings[state];
}

var nowSeconds = function(){
  return (new Date()).getTime();
}

var changeVideo = function(videoId){
  player.loadVideoById(videoId);
  sendCommand("VIDEO_CHANGE", videoId);
}

$(function () {
  ws_connect();

  $("#jpop").click(function () {
    changeVideo("194gT3-jiNc");
  });
  $("#marshmallow").click(function () {
    changeVideo("ALZHF5UqnU4");
  });
  $("#ShapeOfYou").click(function () {
    changeVideo("_dK2tDK9grQ");
  });

  $("#postUrl").click(function(){
    var url = $("#url").val();
    var videoId = parseYouTubeUrl(url).v;
    changeVideo(videoId);
  });
});
