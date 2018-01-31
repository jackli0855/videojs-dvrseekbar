import videojs from 'video.js';
// Default options for the plugin.
const defaults = {
  startTime: 0
};

const seconds2time = (seconds) => {
    var originSd = seconds;
    if (seconds < 0) {
      seconds = Math.abs(seconds);
    }
    var hours   = Math.floor(seconds / 3600);
    var minutes = Math.floor((seconds - (hours * 3600)) / 60);
    var seconds = seconds - (hours * 3600) - (minutes * 60);
    var time = "";

    if (hours != 0) {
      time = hours+":";
    }
    if (minutes != 0 || time !== "") {
      minutes = (minutes < 10 && time !== "") ? "0"+minutes : String(minutes);
      time += minutes+":";
    }
    if (time === "") {
      time = seconds+"s";
    }
    else {
      time += (seconds < 10) ? "0"+seconds : String(seconds);
    }
    if (originSd < 0) {
      time = "-"+time;
    }
    return time;
}

const Slider = videojs.getComponent('Slider');

Slider.prototype.update = function update() {
  // In VolumeBar init we have a setTimeout for update that pops and update to the end of the
  // execution stack. The player is destroyed before then update will cause an error
  if (!this.el_) {
    return;
  }

  // If scrubbing, we could use a cached value to make the handle keep up with the user's mouse.
  // On HTML5 browsers scrubbing is really smooth, but some flash players are slow, so we might want to utilize this later.
  // var progress =  (this.player_.scrubbing()) ? this.player_.getCache().currentTime / this.player_.duration() : this.player_.currentTime() / this.player_.duration();
  let progress = this.getPercent();
  let bar = this.bar;

  // If there's no bar...
  if (!bar) {
    return;
  }

  // Protect against no duration and other division issues
  if (typeof progress !== 'number' || progress !== progress || progress < 0 || progress === Infinity) {
    progress = 0;
  }

  // Convert to a percentage for setting
  let percentage = (progress * 100).toFixed(2) + '%';

  // Set the new bar width or height
  if(progress != 0) {
    if (this.vertical()) {
      bar.el().style.height = percentage;
    } else {
      bar.el().style.width = percentage;
    }
  }
};


const SeekBar = videojs.getComponent('SeekBar');

SeekBar.prototype.dvrTotalTime = function(player) {
  let time = player.seekable();

  return time && time.length ? time.end(0) - time.start(0) : 0;
};

SeekBar.prototype.handleMouseMove = function(e) {
  let bufferedTime;
  let newTime;

  bufferedTime = newTime = this.player_.seekable();

  if (bufferedTime && bufferedTime.length) {
    let progress = this.calculateDistance(e) * this.dvrTotalTime(this.player_);

    newTime = bufferedTime.start(0) + progress;
    for (; newTime >= bufferedTime.end(0);) {
      newTime -= 0.1;
    }

    this.player_.currentTime(newTime);
  }
};

SeekBar.prototype.updateAriaAttributes = function() {
  const seekableRanges = this.player_.seekable() || [];

  if (seekableRanges.length) {
    const lastSeekableTime = seekableRanges.end(0);
    const cachedCTime = this.player_.getCache().currentTime;
    const currentTime = this.player_.scrubbing ? cachedCTime : this.player_.currentTime();
    let timeToLastSeekable;

    // Get difference between last seekable moment and current time
    timeToLastSeekable = lastSeekableTime - currentTime;
    if (timeToLastSeekable < 0) {
      timeToLastSeekable = 0;
    }

    // Update current time control
    const formattedTime = videojs.formatTime(timeToLastSeekable, lastSeekableTime);
    const formattedPercentage = Math.round(100 * this.getPercent(), 2);

    this.el_.setAttribute('aria-valuenow', formattedPercentage);
    this.el_.setAttribute('aria-valuetext', (currentTime ? '' : '-') + formattedTime);
  }
};

/**
 * Function to invoke when the player is ready.
 *
 * This is a great place for your plugin to initialize itself. When this
 * function is called, the player will have its DOM and child components
 * in place.
 *
 * @function onPlayerReady
 * @param    {Player} player
 * @param    {Object} [options={}]
 */
const onPlayerReady = (player, options) => {
  player.addClass('vjs-dvrseekbar');
  player.controlBar.addClass('vjs-dvrseekbar-control-bar');

  if (player.controlBar.progressControl) {
    player.controlBar.progressControl.addClass('vjs-dvrseekbar-progress-control');
  }

  // ADD Live Button:
  let btnLiveEl = document.createElement('div');
  let newLink = document.createElement('a');

  btnLiveEl.className = 'vjs-live-button vjs-control';

  var pre_innerHTML = '<span class="live-control-indicator"><i class="fa fa-circle"></i></span>';
  var delayTime = '<span class="live-control-delay"></span>';
  newLink.innerHTML = pre_innerHTML + document.getElementsByClassName('vjs-live-display')[0].innerHTML + delayTime;
  newLink.id = 'liveButton';

  if (!player.paused()) {
    newLink.className = 'vjs-live-label onair';
    // newLink.className = 'live-control-indicator inactive';
  }

  let clickHandler = function(e) {
    player.pause();
    player.currentTime(player.seekable().end(0));
    let indicatorEl = document.getElementsByClassName('live-control-indicator')[0];
    player.play();
  };

  if (newLink.addEventListener) {
    // DOM method
    newLink.addEventListener('click', clickHandler, false);
  } else if (newLink.attachEvent) {
    // this is for IE, because it doesn't support addEventListener
    newLink.attachEvent('onclick', function() {
      return clickHandler.apply(newLink, [ window.event ]);
    });
  }

  btnLiveEl.appendChild(newLink);

  let controlBar = document.getElementsByClassName('vjs-control-bar')[0];
  let insertBeforeNode = document.getElementsByClassName('vjs-progress-control')[0];

  controlBar.insertBefore(btnLiveEl, insertBeforeNode);

  videojs.log('dvrSeekbar Plugin ENABLED!', options);
};

const onTimeUpdate = (player, e) => {
  let time = player.seekable();
  let btnLiveEl = document.getElementById('liveButton');
  let delayTimeEl = document.getElementsByClassName('live-control-delay')[0];
  let indicatorEl = document.getElementsByClassName('live-control-indicator')[0];
    
  // When any tech is disposed videojs will trigger a 'timeupdate' event
  // when calling stopTrackingCurrentTime(). If the tech does not have
  // a seekable() method, time will be undefined
  if (!time || !time.length) {
    return;
  }

  player.duration(player.seekable().end(0));
  let delayTimeSd = parseInt(player.currentTime() - time.end(0));
  // console.log("delayTimeSd:"+delayTimeSd);
  if (delayTimeSd < -20) {
    delayTimeEl.innerHTML = seconds2time(delayTimeSd);
    // btnLiveEl.className = 'label inactive';
    indicatorEl.className = 'live-control-indicator inactive';
    // newLink.innerHTML = newLink.innerHTML + delayTimeEl;
  } else {
    // btnLiveEl.className = 'label active';
    indicatorEl.className = 'live-control-indicator active';
    delayTimeEl.innerHTML = '';
  }

  // if (delayTimeSd < 30) {
  //   btnLiveEl.className = 'label onair';
  // } else {
  //   btnLiveEl.className = 'label';
  // }

  player.duration(player.seekable().end(0));
};

/**
 * A video.js plugin.
 *
 * In the plugin function, the value of `this` is a video.js `Player`
 * instance. You cannot rely on the player being in a "ready" state here,
 * depending on how the plugin is invoked. This may or may not be important
 * to you; if not, remove the wait for "ready"!
 *
 * @function dvrseekbar
 * @param    {Object} [options={}]
 *           An object of options left to the plugin author to define.
 */
const dvrseekbar = function(options) {
  if (!options) {
    options = defaults;
  }

  this.on('timeupdate', (e) => {
    onTimeUpdate(this, e);
  });

  this.on('play', (e) => {});

  this.on('pause', (e) => {
    // let btnLiveEl = document.getElementById('liveButton');

    // btnLiveEl.className = 'vjs-live-label';
    let delayTimeEl = document.getElementsByClassName('live-control-indicator')[0];
    delayTimeEl.className = 'live-control-indicator inactive';
  });

  this.ready(() => {
    onPlayerReady(this, videojs.mergeOptions(defaults, options));
  });
};

// Register the plugin with video.js.
videojs.plugin('dvrseekbar', dvrseekbar);

// Include the version number.
dvrseekbar.VERSION = '__VERSION__';

export default dvrseekbar;
