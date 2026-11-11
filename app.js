'use strict';
const scene = document.querySelector('a-scene');
const portrait = document.querySelector('#portrait');
const video = document.querySelector('#art-video');
const welcome = document.querySelector('#welcome');
const toolbar = document.querySelector('#toolbar');
const start = document.querySelector('#start');
const message = document.querySelector('#message');
const status = document.querySelector('#status');
const sound = document.querySelector('#sound');
const play = document.querySelector('#play');
let active = false;
let visible = false;
let ar;
video.muted = true;

function ready() {
  ar = scene.systems['mindar-image-system'];
  if (!ar) return;
  start.disabled = false;
  start.textContent = 'Start AR';
  message.textContent = 'Ready when you are.';
}
if (scene.hasLoaded) ready();
else scene.addEventListener('loaded', ready, { once: true });

function finish(text) {
  active = false;
  visible = false;
  video.pause();
  if (ar) ar.stop();
  welcome.hidden = false;
  toolbar.hidden = true;
  play.hidden = true;
  start.disabled = !ar;
  start.textContent = 'Start AR';
  message.textContent = text;
}
async function playVideo() {
  if (!active || !visible || document.hidden) return;
  try {
    await video.play();
    // Tracking may have been lost while the browser was starting playback.
    if (!active || !visible || document.hidden) video.pause();
    play.hidden = true;
  } catch (error) {
    play.hidden = false;
    status.textContent = 'Portrait found — tap Play video.';
  }
}
start.addEventListener('click', async () => {
  if (!ar || active) return;
  if (!window.isSecureContext) {
    message.textContent = 'Open the HTTPS GitHub Pages link to use the camera.';
    return;
  }
  if (!navigator.mediaDevices?.getUserMedia) {
    message.textContent = 'Open this link in Chrome on your Android phone to use the camera.';
    return;
  }
  start.disabled = true;
  message.textContent = 'Checking target data…';
  try {
    const response = await fetch('assets/targets.mind');
    if (!response.ok) throw new Error('missing-target');
    // A web host may return an HTML error page with status 200.
    if ((response.headers.get('content-type') || '').includes('text/html')) throw new Error('missing-target');
    active = true;
    visible = false;
    video.currentTime = 0;
    video.muted = true;
    sound.textContent = 'Sound: off';
    sound.setAttribute('aria-pressed', 'false');
    message.textContent = 'Allow camera access when asked…';
    video.load();
    await ar.start();
  } catch (error) {
    const missing = error.message === 'missing-target';
    finish(missing
      ? 'One setup step remains: compile assets/target.png and save the result as assets/targets.mind. See START-HERE.txt.'
      : 'Could not start AR. Check camera permission and your internet connection, then try again.');
    console.error(error);
  }
});
scene.addEventListener('arReady', () => {
  if (!active) { ar?.stop(); return; }
  welcome.hidden = true;
  toolbar.hidden = false;
  status.textContent = 'Point at the flower portrait';
});
scene.addEventListener('arError', () => {
  finish('Camera could not start. Allow camera access for this website in Chrome, then try again.');
});
portrait.addEventListener('targetFound', () => {
  visible = true;
  status.textContent = 'Portrait found — keep it in view';
  playVideo();
});
portrait.addEventListener('targetLost', () => {
  visible = false;
  video.pause();
  play.hidden = true;
  status.textContent = 'Point back at the flower portrait to continue';
});
sound.addEventListener('click', () => {
  video.muted = !video.muted;
  sound.textContent = video.muted ? 'Sound: off' : 'Sound: on';
  sound.setAttribute('aria-pressed', String(!video.muted));
  playVideo();
});
play.addEventListener('click', playVideo);
document.querySelector('#stop').addEventListener('click', () => finish('Camera stopped.'));
document.addEventListener('visibilitychange', () => {
  if (document.hidden && active) finish('Camera paused. Tap Start AR to continue.');
});
video.addEventListener('error', () => {
  if (active) status.textContent = 'Video could not load. Check your connection and reload the page.';
});
setTimeout(() => {
  if (!ar) message.textContent = 'AR has not loaded. Check your internet connection and reload. The page needs access to aframe.io and cdn.jsdelivr.net.';
}, 20000);
