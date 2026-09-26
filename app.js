const views = {
  home: document.getElementById("homeView"),
  upload: document.getElementById("uploadView"),
  processing: document.getElementById("processingView"),
  result: document.getElementById("resultView")
};

const bottomNav =
  document.getElementById("bottomNav");

const videoButton =
  document.getElementById("videoButton");

const urgentButton =
  document.getElementById("urgentButton");

const videoInput =
  document.getElementById("videoInput");

const fileCard =
  document.getElementById("fileCard");

const fileName =
  document.getElementById("fileName");

const fileMeta =
  document.getElementById("fileMeta");

const removeFile =
  document.getElementById("removeFile");

const startCheckButton =
  document.getElementById("startCheckButton");

const progressBar =
  document.getElementById("progressBar");

const step1 =
  document.getElementById("step1");

const step2 =
  document.getElementById("step2");

const step3 =
  document.getElementById("step3");

const resultDuration =
  document.getElementById("resultDuration");

const resultResolution =
  document.getElementById("resultResolution");

const resultFileStatus =
  document.getElementById("resultFileStatus");

const checkAnotherButton =
  document.getElementById("checkAnotherButton");

const homeButton =
  document.getElementById("homeButton");

const toast =
  document.getElementById("toast");


let selectedFile = null;

let selectedMetadata = {
  duration: null,
  width: null,
  height: null
};


/* -------------------------
   VIEW ROUTER
------------------------- */

function showView(name) {

  Object.values(views).forEach(view => {
    if (view) {
      view.classList.remove("active");
    }
  });

  if (views[name]) {
    views[name].classList.add("active");
  }

  if (bottomNav) {
    bottomNav.style.display =
      name === "home"
        ? "grid"
        : "none";
  }

  window.scrollTo({
    top: 0,
    behavior: "auto"
  });
}


/* -------------------------
   TOAST
------------------------- */

function showToast(message) {

  if (!toast) return;

  toast.textContent = message;

  toast.classList.add("show");

  clearTimeout(showToast.timer);

  showToast.timer =
    setTimeout(() => {

      toast.classList.remove("show");

    }, 2600);
}


/* -------------------------
   FORMAT
------------------------- */

function formatBytes(bytes) {

  if (!bytes) {
    return "0 B";
  }

  const units =
    ["B", "KB", "MB", "GB"];

  const index =
    Math.min(
      Math.floor(
        Math.log(bytes) /
        Math.log(1024)
      ),
      units.length - 1
    );

  const value =
    bytes /
    Math.pow(1024, index);

  return (
    value.toFixed(
      index === 0 ? 0 : 1
    ) +
    " " +
    units[index]
  );
}


function formatDuration(seconds) {

  if (
    !Number.isFinite(seconds)
  ) {
    return "อ่านไม่ได้";
  }

  const minutes =
    Math.floor(seconds / 60);

  const remaining =
    Math.round(seconds % 60);

  return (
    `${minutes}:` +
    `${remaining
      .toString()
      .padStart(2, "0")} นาที`
  );
}


/* -------------------------
   RESET VIDEO
------------------------- */

function resetVideoSelection() {

  selectedFile = null;

  selectedMetadata = {
    duration: null,
    width: null,
    height: null
  };

  if (videoInput) {
    videoInput.value = "";
  }

  if (fileCard) {
    fileCard.classList.add("hidden");
  }

  if (startCheckButton) {
    startCheckButton.disabled = true;
  }
}


/* -------------------------
   READ VIDEO METADATA
------------------------- */

function readVideoMetadata(file) {

  return new Promise(resolve => {

    const video =
      document.createElement("video");

    const objectUrl =
      URL.createObjectURL(file);

    video.preload =
      "metadata";


    video.onloadedmetadata = () => {

      const metadata = {

        duration:
          video.duration,

        width:
          video.videoWidth,

        height:
          video.videoHeight
      };

      URL.revokeObjectURL(
        objectUrl
      );

      resolve(metadata);
    };


    video.onerror = () => {

      URL.revokeObjectURL(
        objectUrl
      );

      resolve({
        duration: null,
        width: null,
        height: null
      });
    };


    video.src =
      objectUrl;
  });
}


/* -------------------------
   HOME
------------------------- */

if (videoButton) {

  videoButton.addEventListener(
    "click",
    () => {

      resetVideoSelection();

      showView("upload");
    }
  );
}


document
  .querySelectorAll(
    "[data-back='home']"
  )
  .forEach(button => {

    button.addEventListener(
      "click",
      () => {

        resetVideoSelection();

        showView("home");
      }
    );
  });


document
  .querySelectorAll(
    "[data-coming-soon]"
  )
  .forEach(button => {

    button.addEventListener(
      "click",
      () => {

        const feature =
          button.dataset.comingSoon;

        showToast(
          `ตรวจ${feature} — กำลังพัฒนา`
        );
      }
    );
  });


if (urgentButton) {

  urgentButton.addEventListener(
    "click",
    () => {

      showToast(
        "หากกำลังถูกขอให้โอนเงิน อย่าเพิ่งโอน และควรยืนยันกับบุคคลหรือองค์กรนั้นผ่านช่องทางอื่นที่คุณหาเอง"
      );
    }
  );
}


/* -------------------------
   FILE SELECTION
------------------------- */

if (videoInput) {

  videoInput.addEventListener(
    "change",
    async event => {

      const file =
        event.target.files?.[0];

      if (!file) {
        return;
      }


      if (
        file.type &&
        !file.type.startsWith(
          "video/"
        )
      ) {

        showToast(
          "กรุณาเลือกไฟล์วิดีโอ"
        );

        resetVideoSelection();

        return;
      }


      selectedFile =
        file;


      if (fileName) {

        fileName.textContent =
          file.name;
      }


      if (fileMeta) {

        fileMeta.textContent =
          `${formatBytes(file.size)} · กำลังอ่านข้อมูล...`;
      }


      if (fileCard) {

        fileCard.classList.remove(
          "hidden"
        );
      }


      if (startCheckButton) {

        startCheckButton.disabled =
          false;
      }


      selectedMetadata =
        await readVideoMetadata(
          file
        );


      const durationText =
        selectedMetadata.duration
          ? formatDuration(
              selectedMetadata.duration
            )
          : "ไม่ทราบความยาว";


      if (fileMeta) {

        fileMeta.textContent =
          `${formatBytes(file.size)} · ${durationText}`;
      }
    }
  );
}


/* -------------------------
   REMOVE FILE
------------------------- */

if (removeFile) {

  removeFile.addEventListener(
    "click",
    event => {

      event.preventDefault();

      resetVideoSelection();
    }
  );
}


/* -------------------------
   PROCESSING
------------------------- */

function wait(ms) {

  return new Promise(resolve =>
    setTimeout(resolve, ms)
  );
}


if (startCheckButton) {

  startCheckButton.addEventListener(
    "click",
    async () => {

      if (!selectedFile) {
        return;
      }


      showView(
        "processing"
      );


      progressBar.style.width =
        "15%";


      step1.className =
        "processing-step active-step";

      step1
        .querySelector("span")
        .textContent = "✓";


      step2.className =
        "processing-step";

      step2
        .querySelector("span")
        .textContent = "○";


      step3.className =
        "processing-step";

      step3
        .querySelector("span")
        .textContent = "○";


      await wait(500);


      progressBar.style.width =
        "45%";


      step2.className =
        "processing-step active-step";

      step2
        .querySelector("span")
        .textContent = "✓";


      await wait(600);


      progressBar.style.width =
        "78%";


      step3.className =
        "processing-step active-step";

      step3
        .querySelector("span")
        .textContent = "✓";


      await wait(650);


      progressBar.style.width =
        "100%";


      await wait(300);


      populateResult();


      showView(
        "result"
      );
    }
  );
}


/* -------------------------
   RESULT
------------------------- */

function populateResult() {

  if (resultFileStatus) {

    resultFileStatus.textContent =
      selectedFile
        ? "อ่านได้"
        : "ไม่พบไฟล์";
  }


  if (resultDuration) {

    resultDuration.textContent =
      selectedMetadata.duration
        ? formatDuration(
            selectedMetadata.duration
          )
        : "อ่านไม่ได้";
  }


  if (resultResolution) {

    resultResolution.textContent =
      (
        selectedMetadata.width &&
        selectedMetadata.height
      )
        ? `${selectedMetadata.width} × ${selectedMetadata.height}`
        : "อ่านไม่ได้";
  }
}


/* -------------------------
   RESULT ACTIONS
------------------------- */

if (checkAnotherButton) {

  checkAnotherButton.addEventListener(
    "click",
    () => {

      resetVideoSelection();

      showView(
        "upload"
      );
    }
  );
}


if (homeButton) {

  homeButton.addEventListener(
    "click",
    () => {

      resetVideoSelection();

      showView(
        "home"
      );
    }
  );
}


/* -------------------------
   BOTTOM NAV
------------------------- */

document
  .querySelectorAll(
    "[data-nav]"
  )
  .forEach(button => {

    button.addEventListener(
      "click",
      () => {

        const nav =
          button.dataset.nav;


        if (nav === "home") {

          showView("home");

          return;
        }


        if (
          nav === "knowledge"
        ) {

          showToast(
            "ความรู้ป้องกันมิจฉาชีพ — กำลังพัฒนา"
          );

          return;
        }


        if (
          nav === "about"
        ) {

          showToast(
            "RealityCheck — เช็กก่อนเชื่อ ก่อนโอน ก่อนให้ข้อมูล"
          );
        }
      }
    );
  });


/* -------------------------
   START
------------------------- */

showView("home");
