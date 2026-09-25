const status = document.getElementById("status");

document
  .getElementById("checkText")
  .addEventListener("click", () => {
    status.textContent = "โหมดตรวจข้อความ — กำลังพัฒนา";
  });

document
  .getElementById("checkImage")
  .addEventListener("click", () => {
    status.textContent = "โหมดตรวจรูปภาพ — กำลังพัฒนา";
  });
