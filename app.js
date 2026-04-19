let time = 600;
let interval = null;

function updateDisplay() {
  let minutes = Math.floor(time / 60);
  let seconds = time % 60;
  document.getElementById("timer").innerText =
    `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

function startTimer() {
  if (interval) return;

  interval = setInterval(() => {
    if (time > 0) {
      time--;
      updateDisplay();
    }
  }, 1000);
}

function pauseTimer() {
  clearInterval(interval);
  interval = null;
}

function resetTimer() {
  pauseTimer();
  time = 600;
  updateDisplay();
}

function setTime(seconds) {
  time = seconds;
  updateDisplay();
}

updateDisplay();
