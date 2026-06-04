// audio.js - Audio manager

const rightSound = new Audio('/frontend/assets/sounds/Right.mp3');
const wrongSound = new Audio('/frontend/assets/sounds/Wrong.mp3');

let volume = 1.0;

export function playRight() {
  rightSound.currentTime = 0;
  rightSound.volume = volume;
  rightSound.play().catch(e => console.log('Audio play failed', e));
}

export function playWrong() {
  wrongSound.currentTime = 0;
  wrongSound.volume = volume;
  wrongSound.play().catch(e => console.log('Audio play failed', e));
}

export function setVolume(val) {
  volume = Math.max(0, Math.min(1, val));
}
