let time = 600;
let defaultTime = 600;
let interval = null;

const timerEl = document.getElementById("timer");
const startBtn = document.getElementById("startBtn");
const pauseBtn = document.getElementById("pauseBtn");
const resetBtn = document.getElementById("resetBtn");
const presetBtns = document.querySelectorAll(".presetBtn");

function updateDisplay() {
  const minutes = Math.floor(time / 60);
  const seconds = time % 60;
  timerEl.textContent = `${minutes}:${String(seconds).padStart(2, "0")}`;
}

function startTimer() {
  if (interval !== null) return;

  interval = setInterval(() => {
    if (time > 0) {
      time -= 1;
      updateDisplay();
    } else {
      clearInterval(interval);
      interval = null;
    }
  }, 1000);
}

function pauseTimer() {
  if (interval !== null) {
    clearInterval(interval);
    interval = null;
  }
}

function resetTimer() {
  pauseTimer();
  time = defaultTime;
  updateDisplay();
}

function setTime(seconds) {
  pauseTimer();
  time = seconds;
  defaultTime = seconds;
  updateDisplay();
}

startBtn.addEventListener("click", startTimer);
pauseBtn.addEventListener("click", pauseTimer);
resetBtn.addEventListener("click", resetTimer);

presetBtns.forEach((btn) => {
  btn.addEventListener("click", () => {
    const seconds = Number(btn.dataset.seconds);
    setTime(seconds);
  });
});

updateDisplay();
