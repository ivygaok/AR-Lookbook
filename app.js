'use strict';
const $ = (selector) => document.querySelector(selector);
const scene = $('a-scene');
const welcome = $('#welcome');
const toolbar = $('#toolbar');
const start = $('#start');
const message = $('#message');
const status = $('#status');
const sound = $('#sound');
const play = $('#play');
const scanAnother = $('#scan-another');
const help = $('#targets-help');
const guide = $('#target-guide');
const TARGET_FILE = 'assets/targets-flower.mind';
let startupTimer;
let dismissPopup = false;
let popupVisible = false;
const experiences = [
  { target: $('#portrait'), media: $('#art-video'), label: 'Artist portrait' },
  { target: $('#popup-page'), media: $('#page-audio'), label: 'Popup soundscape', keepPlaying: false }
];
let ar;
let active = false;
let starting = false;
let current = null;
let muted = false;
let context;
let session = 0;
let playback = 0;

for (const item of experiences) {
  item.media.muted = true;
  item.media.volume = 1;
}
function updateSound() {
  for (const item of experiences) item.media.muted = muted;
  sound.textContent = muted ? 'Sound: off' : 'Sound: on';
  sound.setAttribute('aria-pressed', String(!muted));
}
function silence(item) {
  if (item.gate) item.gate.gain.value = 0;
  item.media.pause();
}
function silenceAll() { experiences.forEach(silence); }

// Called from the Start AR click before any awaited work. Both media elements
// are primed through silent gates so neither clip is heard before recognition.
function unlockAudio() {
  muted = false;
  updateSound();
  const Context = window.AudioContext || window.webkitAudioContext;
  if (!Context) return Promise.resolve();
  if (!context) {
    context = new Context();
    for (const item of experiences) {
      item.gate = context.createGain();
      item.gate.gain.value = 0;
      context.createMediaElementSource(item.media).connect(item.gate);
      item.gate.connect(context.destination);
    }
  }
  for (const item of experiences) item.gate.gain.value = 0;
  const attempts = [context.resume()];
  for (const item of experiences) attempts.push(item.media.play());
  return Promise.allSettled(attempts).then(() => {
    for (const item of experiences) {
      if (current !== item) {
        silence(item);
        item.media.currentTime = 0;
      }
    }
  });
}
function ready() {
  ar = scene.systems['mindar-image-system'];
  if (!ar) return;
  start.disabled = false;
  start.textContent = 'Start AR';
  message.textContent = 'Ready. Start AR enables sound for both pages.';
}
if (scene.hasLoaded) ready();
else scene.addEventListener('loaded', ready, { once: true });

function finish(text) {
  clearTimeout(startupTimer);
  dismissPopup = false;
  popupVisible = false;
  scanAnother.hidden = true;
  if (guide.open) guide.close();
  help.setAttribute('aria-expanded', 'false');
  session += 1;
  playback += 1;
  active = false;
  starting = false;
  current = null;
  silenceAll();
  ar?.stop();
  welcome.hidden = false;
  toolbar.hidden = true;
  play.hidden = true;
  start.disabled = !ar;
  start.textContent = 'Start AR';
  message.textContent = text;
}
async function playCurrent() {
  const item = current;
  if (!active || !item || document.hidden) return;
  const request = ++playback;
  try {
    if (context && context.state !== 'running' && !muted) {
      await context.resume();
      if (context.state !== 'running') throw new Error('audio-blocked');
    }
    if (request !== playback || current !== item || !active || document.hidden) return;
    if (item.gate) item.gate.gain.value = 1;
    await item.media.play();
    if (current !== item || !active || document.hidden) {
      silence(item);
      return;
    }
    if (request !== playback) return;
    play.hidden = true;
    status.textContent = item.keepPlaying ? 'Enjoy the soundscape.' : 'Portrait found — keep it in view';
  } catch (error) {
    if (request !== playback || current !== item || !active) return;
    silence(item);
    play.hidden = false;
    status.textContent = item.label + ' found — tap Play media.';
  }
}
start.addEventListener('click', async () => {
  if (!ar || active || starting) return;
  if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) {
    message.textContent = 'Open the HTTPS website in Chrome on your Android to use the camera.';
    return;
  }
  starting = true;
  start.disabled = true;
  const request = ++session;
  current = null;
  dismissPopup = false;
  popupVisible = false;
  scanAnother.hidden = true;
  silenceAll();
  for (const item of experiences) item.media.currentTime = 0;
  message.textContent = 'Enabling sound…';
  try {
    await unlockAudio();
    if (request !== session) return;
    message.textContent = 'Checking target data…';
    const controller = new AbortController();
    const fetchTimer = setTimeout(() => controller.abort(), 15000);
    let response;
    try {
      response = await fetch(TARGET_FILE, { method: 'HEAD', cache: 'no-store', signal: controller.signal });
    } finally {
      clearTimeout(fetchTimer);
    }
    if (request !== session) return;
    if (!response.ok || (response.headers.get('content-type') || '').includes('text/html')) {
      throw new Error('missing-target');
    }
    active = true;
    message.textContent = 'Starting camera… Allow camera access when asked.';
    startupTimer = setTimeout(() => {
      if (request === session) finish('AR is taking too long to load. Check your connection, then try again.');
    }, 45000);
    await ar.start();
    if (request === session) starting = false;
  } catch (error) {
    if (request !== session) return;
    finish(error.message === 'missing-target'
      ? 'Target file missing. Upload targets-flower.mind inside assets, then wait for GitHub to publish. See START-HERE.txt.'
      : error.name === 'AbortError'
        ? 'Target check timed out. Check your connection and try Start AR again.'
        : 'Could not start AR. Check camera permission and your connection, then try again.');
    console.error(error);
  }
});
scene.addEventListener('arReady', () => {
  clearTimeout(startupTimer);
  if (!active) { ar?.stop(); return; }
  welcome.hidden = true;
  toolbar.hidden = false;
  status.textContent = 'Point at a flower.';
});
scene.addEventListener('arError', () => {
  finish('Could not start the camera. Allow camera access in Chrome, then try again.');
});
for (const item of experiences) {
  item.target.addEventListener('targetFound', () => {
    if (!active) return;
    if (item.keepPlaying) {
      popupVisible = true;
      if (dismissPopup) return;
    }
    if (current === item) return;
    playback += 1;
    silenceAll();
    current = item;
    scanAnother.hidden = !item.keepPlaying;
    play.hidden = true;
    status.textContent = item.label + ' found';
    playCurrent();
  });
  item.target.addEventListener('targetLost', () => {
    if (item.keepPlaying) {
      popupVisible = false;
      dismissPopup = false;
    }
    if (current !== item) return;
    // The popup triggers an audio experience that can continue off camera.
    if (item.keepPlaying) return;
    playback += 1;
    current = null;
    silence(item);
    play.hidden = true;
    status.textContent = 'Point back at either target to continue';
  });
  item.media.addEventListener('error', () => {
    if (active && current === item) status.textContent = 'Could not load ' + item.label + '. Check the connection and reload.';
  });
}
sound.addEventListener('click', () => {
  muted = !muted;
  updateSound();
  playCurrent();
});
play.addEventListener('click', playCurrent);
scanAnother.addEventListener('click', () => {
  playback += 1;
  silenceAll();
  current = null;
  dismissPopup = popupVisible;
  scanAnother.hidden = true;
  play.hidden = true;
  status.textContent = 'Point at another flower.';
});
help.addEventListener('click', () => {
  if (!guide.open) guide.showModal();
  help.setAttribute('aria-expanded', 'true');
});
$('#close-guide').addEventListener('click', () => guide.close());
guide.addEventListener('close', () => help.setAttribute('aria-expanded', 'false'));
$('#stop').addEventListener('click', () => finish('Camera stopped.'));
document.addEventListener('visibilitychange', () => {
  if (document.hidden && (active || starting)) finish('Camera paused. Tap Start AR to continue.');
});
setTimeout(() => {
  if (!ar) message.textContent = 'AR has not loaded. Check your internet connection and reload.';
}, 20000);
