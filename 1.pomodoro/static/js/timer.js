document.addEventListener("DOMContentLoaded", () => {
    const startButton = document.getElementById("start-btn");
    const resetButton = document.getElementById("reset-btn");
    const timeDisplay = document.querySelector(".time-display");

    let timer = null;
    let remainingTime = 25 * 60; // 25 minutes in seconds

    function updateDisplay() {
        const minutes = Math.floor(remainingTime / 60);
        const seconds = remainingTime % 60;
        timeDisplay.textContent = `${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;
    }

    function startTimer() {
        if (timer) return; // Prevent multiple intervals

        timer = setInterval(() => {
            if (remainingTime > 0) {
                remainingTime--;
                updateDisplay();
            } else {
                clearInterval(timer);
                timer = null;
                alert("Time's up!");
            }
        }, 1000);
    }

    function resetTimer() {
        clearInterval(timer);
        timer = null;
        remainingTime = 25 * 60;
        updateDisplay();
    }

    startButton.addEventListener("click", startTimer);
    resetButton.addEventListener("click", resetTimer);

    updateDisplay(); // Initialize display
});