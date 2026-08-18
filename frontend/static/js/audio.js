/* audio.js — Sound effects */
const soundRight = new Audio('/static/Right.mp3');
// const soundWrong = new Audio('/static/Wrong.mp3'); // Removed unused

// Initialize volume
soundRight.volume = 0.5;
// soundWrong.volume = 0.0; // Muted by default/removed

function updateVolume(val) {
    soundRight.volume = val;
}
