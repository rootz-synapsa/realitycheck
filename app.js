const statusCard = document.getElementById("status");

const modeLabels = {
  video: "ตรวจวิดีโอ",
  image: "ตรวจรูปภาพ",
  text: "ตรวจข้อความ",
};

document.querySelectorAll("[data-mode]").forEach((button) => {
  button.addEventListener("click", () => {
    const mode = button.dataset.mode;

    statusCard.classList.remove("hidden");
    statusCard.innerHTML = `
      <strong>${modeLabels[mode]}</strong><br>
      โหมดนี้กำลังอยู่ระหว่างการพัฒนา
    `;
  });
});
