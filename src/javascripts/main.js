/********************************************************
Copyright 2016 Google Inc. All Rights Reserved.

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
*********************************************************/

'use strict';

window.isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
  navigator.userAgent
);
window.isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
window.isAndroid = /Android/.test(navigator.userAgent) && !window.MSStream;

window.requestAnimFrame = (function() {
  return (
    window.requestAnimationFrame ||
    window.webkitRequestAnimationFrame ||
    window.mozRequestAnimationFrame ||
    function(callback) {
      window.setTimeout(callback, 1000 / 60);
    }
  );
})();

// -~-~-~-~-~-~-~-~-~-~-~-~-~-~-~-~-~-~-~-~
var spec3D = require('./UI/spectrogram');
// -~-~-~-~-~-~-~-~-~-~-~-~-~-~-~-~-~-~-~-~

$(function() {
  var parseQueryString = function() {
    var q = window.location.search.slice(1).split('&');
    for (var i = 0; i < q.length; ++i) {
      var qi = q[i].split('=');
      q[i] = {};
      q[i][qi[0]] = qi[1];
    }
    return q;
  };

  var getLocalization = function() {
    var q = parseQueryString();
    var lang = 'en';
    for (var i = 0; i < q.length; i++) {
      if (q[i].ln != undefined) {
        lang = q[i].ln;
      }
    }
    var url =
      'https://gweb-musiclab-site.appspot.com/static/locales/' +
      lang +
      '/locale-music-lab.json';
    $.ajax({
      url: url,
      dataType: 'json',
      async: true,
      success: function(response) {
        $.each(response, function(key, value) {
          var item = $("[data-name='" + key + "']");
          if (item.length > 0) {
            console.log('value.message', value.message);
            item.attr('data-name', value.message);
          }
        });
      },
      error: function(err) {
        console.warn(err);
      },
    });
  };

  var startup = function() {
    var source = null; // global source for user dropped audio

    getLocalization();
    window.parent.postMessage('ready', '*');

    var emitter = new EventTarget();

    var sp = spec3D;
    sp.attached(function onStop() {
      emitter.dispatchEvent(new Event('stop'));
    });
    // --------------------------------------------
    $('.music-box__tool-tip').hide(0);
    $('#loadingSound').hide(0);

    var killSound = function() {
      sp.startRender();
      var wasPlaying = sp.isPlaying();
      sp.stop();
      sp.drawingMode = false;
      $('.music-box__buttons__button').removeClass('selected');
    };

    var decodeBuffer = function(file) {
      // Credit: https://github.com/kylestetz/AudioDrop && https://ericbidelman.tumblr.com/post/13471195250/web-audio-api-how-to-playing-audio-based-on-user
      var AudioContext = window.AudioContext || window.webkitAudioContext;
      var context = new AudioContext();
      // var source = null;
      var audioBuffer = null;
      var fileReader = new FileReader();

      fileReader.onload = function(fileEvent) {
        var data = fileEvent.target.result;

        context.decodeAudioData(
          data,
          function(buffer) {
            // audioBuffer is global to reuse the decoded audio later.
            audioBuffer = buffer;
            source = context.createBufferSource();
            source.buffer = audioBuffer;
            source.loop = false;
            source.connect(context.destination);

            // Visualizer
            sp.startRender();
            // sp.loopChanged(false);
            sp.userAudio(source);
            $('#loadingSound')
              .delay(500)
              .fadeOut()
              .hide(0);
          },
          function(e) {
            console.log('Error decoding file', e);
          }
        );
      };

      fileReader.readAsArrayBuffer(file);
    };

    var queue = [];
    function addToQueue(files) {
      queue.push.apply(queue, files);

      emitter.addEventListener('stop', function() {
        if (queue.length > 0) {
          decodeBuffer(queue.shift());
        }
      });
    }

    var fileDrop = function() {
      var $fileDrop = $('#fileDrop');
      var $description = $('.file-overlay-description');

      $(window).on({
        dragover: function(e) {
          e.preventDefault();
          e.stopPropagation();

          $description.text('Drop your sound file here.');
          $fileDrop.addClass('active');
        },
        dragleave: function(e) {
          e.preventDefault();
          e.stopPropagation();

          $fileDrop.removeClass('active');
        },
        drop: function(e) {
          e.preventDefault();
          e.stopPropagation();

          $fileDrop.addClass('pointer-events');

          var droppedFiles = e.originalEvent.dataTransfer;
          if (
            droppedFiles &&
            droppedFiles.files.length &&
            droppedFiles.items[0] &&
            droppedFiles.items[0].type !== 'audio/midi'
          ) {
            addToQueue(
              Array.from(droppedFiles.files).filter(function(file) {
                return file.type.indexOf('audio') > -1;
              })
            );
            // Stop other sounds
            killSound();
            $fileDrop.removeClass('active');
            $fileDrop.removeClass('pointer-events');
          } else {
            $description.text('Only sound files will work here.');
          }
        },
      });

      $fileDrop.on('click', function() {
        $fileDrop.removeClass('active');
        $fileDrop.removeClass('pointer-events');
      });
    };

    fileDrop();
  };

  var elm = $('#iosButton');
  if (!window.isIOS) {
    elm.addClass('hide');
    startup();
    console.log(2);
  } else {
    window.parent.postMessage('loaded', '*');
    elm[0].addEventListener(
      'touchend',
      function(e) {
        elm.addClass('hide');
        startup();
      },
      false
    );
  }
});
