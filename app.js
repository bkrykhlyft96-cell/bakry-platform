// ========================================
// منصة مستر بكرى خليفة
// إدارة الكورسات والشروحات والامتحانات
// ========================================

let supabaseClient = null;
let currentTeacher = null;
let currentStudent = null;
let courses = [];
let lessons = [];
let exams = [];
let activeExam = null;

// ----------------------------------------
// 1. الاتصال بـ Supabase
// ----------------------------------------

if (window.supabase && window.SUPABASE_URL && window.SUPABASE_ANON_KEY) {
  if (window.supabase && window.SUPABASE_URL && window.SUPABASE_ANON_KEY) {
    supabaseClient = window.supabase.createClient(
      window.SUPABASE_URL,
      window.SUPABASE_ANON_KEY,
    );
  }
}
// ----------------------------------------
// 2. أدوات مساعدة
// ----------------------------------------

function element(id) {
  return document.getElementById(id);
}

function showMessage(id, message, isError = false) {
  const box = element(id);
  if (!box) return;

  box.textContent = message;
  box.style.color = isError ? "#c62828" : "#087b50";
}

function escapeHTML(value) {
  return String(value ?? "").replace(/[&<>"']/g, function (char) {
    return {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#039;",
    }[char];
  });
}

function validHttpUrl(value) {
  if (!value) return "";

  try {
    const url = new URL(value);
    return ["http:", "https:"].includes(url.protocol) ? url.href : "";
  } catch {
    return "";
  }
}

function setHidden(id, hidden) {
  const box = element(id);
  if (box) box.classList.toggle("hidden", hidden);
}
function setHidden(id, hidden) {
  const box = element(id);
  if (!box) return;

  box.classList.toggle("hidden", hidden);
}
// ----------------------------------------
// 3. التحقق من المدرس
// ----------------------------------------

async function checkTeacher() {
  if (!supabaseClient) return false;

  const {
    data: { user },
    error,
  } = await supabaseClient.auth.getUser();

  if (error || !user) {
    currentTeacher = null;
    return false;
  }

  const { data, error: teacherError } = await supabaseClient
    .from("teacher_accounts")
    .select("user_id")
    .eq("user_id", user.id)
    .maybeSingle();

  if (teacherError || !data) {
    currentTeacher = null;
    return false;
  }

  currentTeacher = user;
  return true;
}

async function updateTeacherView() {
  const isTeacher = await checkTeacher();

  setHidden("teacherSection", !isTeacher);
  setHidden("teacherLogin", isTeacher);
  setHidden("teacherDashboard", !isTeacher);

  if (isTeacher) {
    await loadAdminData();
  }
}
// إظهار نموذج دخول المدرس عند الضغط على الزر
const openTeacherLogin = element("openTeacherLogin");

if (openTeacherLogin) {
  openTeacherLogin.addEventListener("click", async function () {
    const isTeacher = await checkTeacher();

    if (isTeacher) {
      await updateTeacherView();
    } else {
      setHidden("teacherSection", false);
      setHidden("teacherLogin", false);
      setHidden("teacherDashboard", true);
    }
  });
}
// ----------------------------------------
// 4. تسجيل دخول المدرس
// ----------------------------------------

const teacherLoginForm = element("teacherLoginForm");

if (teacherLoginForm) {
  teacherLoginForm.addEventListener("submit", async function (event) {
    event.preventDefault();

    if (!supabaseClient) {
      showMessage("loginMessage", "تحققي من إعدادات config.js", true);
      return;
    }

    const email = element("teacherEmail").value.trim();
    const password = element("teacherPassword").value;
    const button = element("teacherLoginButton");

    button.disabled = true;
    showMessage("loginMessage", "جارٍ تسجيل الدخول...");

    try {
      const { error } = await supabaseClient.auth.signInWithPassword({
        email,
        password,
      });

      if (error) throw error;

      const isTeacher = await checkTeacher();

      if (!isTeacher) {
        await supabaseClient.auth.signOut();
        throw new Error("هذا الحساب غير مسجل كمدرس في المنصة.");
      }

      showMessage("loginMessage", "تم تسجيل الدخول بنجاح.");

      await updateTeacherView();
    } catch (error) {
      console.error(error);
      showMessage("loginMessage", error.message, true);
    } finally {
      button.disabled = false;
    }
  });
}

// ----------------------------------------
// 5. تسجيل الخروج
// ----------------------------------------

const logoutButton = element("logoutButton");

if (logoutButton) {
  logoutButton.addEventListener("click", async function () {
    await supabaseClient.auth.signOut();
    currentTeacher = null;

    setHidden("teacherSection", true);
    setHidden("teacherLogin", false);
    setHidden("teacherDashboard", true);

    showMessage("loginMessage", "تم تسجيل الخروج.");
  });
}

// ----------------------------------------
// 6. تحميل الكورسات
// ----------------------------------------

async function loadCourses() {
  const { data, error } = await supabaseClient
    .from("courses")
    .select("id, title, description")
    .order("id", { ascending: false });

  if (error) throw error;

  courses = data || [];

  renderCourses();
  fillCourseSelects();
}

function renderCourses() {
  const box = element("coursesList");
  if (!box) return;

  if (!courses.length) {
    box.innerHTML = "<p>لا توجد كورسات حاليًا.</p>";
    return;
  }

  box.innerHTML = courses
    .map(
      (course) => `
    <article class="card course-card">
      <div class="course-icon">📚</div>
      <span class="course-level">مسار تعليمي</span>
      <h3>${escapeHTML(course.title)}</h3>
      <p>${escapeHTML(course.description || "ابدأ رحلتك التعليمية معنا.")}</p>

      <a href="#lessons"
         class="course-link"
         onclick="showCourseLessons(${Number(course.id)}); return false;">
        استكشف الشروحات
        <span>←</span>
      </a>
    </article>
  `,
    )
    .join("");
}

window.selectedCourseId = null;

window.showCourseLessons = function (courseId) {
  window.selectedCourseId = Number(courseId);

  renderLessons();

  const lessonsSection = document.getElementById("lessons");
  if (lessonsSection) {
    lessonsSection.scrollIntoView({ behavior: "smooth" });
  }
};

function fillCourseSelects() {
  ["lessonCourse", "examCourse"].forEach((id) => {
    const select = element(id);
    if (!select) return;

    const previousValue = select.value;

    select.innerHTML =
      '<option value="">اختاري الكورس</option>' +
      courses
        .map(
          (course) => `
        <option value="${course.id}">
          ${escapeHTML(course.title)}
        </option>
      `,
        )
        .join("");

    if (previousValue) select.value = previousValue;
  });
}

// ----------------------------------------
// 7. إضافة كورس جديد
// ----------------------------------------

const courseForm = element("courseForm");

if (courseForm) {
  courseForm.addEventListener("submit", async function (event) {
    event.preventDefault();

    if (!currentTeacher) {
      showMessage("courseMessage", "يجب تسجيل دخول المدرس أولًا.", true);
      return;
    }

    const title = element("courseTitle").value.trim();
    const description = element("courseDescription").value.trim();

    try {
      const { error } = await supabaseClient
        .from("courses")
        .insert([{ title, description }]);

      if (error) throw error;

      courseForm.reset();
      showMessage("courseMessage", "تم إضافة الكورس بنجاح.");

      await loadCourses();
    } catch (error) {
      console.error(error);
      showMessage("courseMessage", error.message, true);
    }
  });
}

// ----------------------------------------
// 8. تحميل الشروحات
// ----------------------------------------

async function loadLessons() {
  const { data, error } = await supabaseClient
    .from("lessons")
    .select("id, course_id, title, content, video_url, pdf_url, image_urls")
    .order("id", { ascending: false });

  if (error) throw error;

  lessons = data || [];

  renderLessons();
  renderAdminLessons();
}

function renderLessons() {
  const box = element("lessonsList");
  if (!box) return;

  const selectedCourse = courses.find(
    (course) => Number(course.id) === Number(window.selectedCourseId),
  );

  const visibleLessons = window.selectedCourseId
    ? lessons.filter(
        (lesson) =>
          Number(lesson.course_id) === Number(window.selectedCourseId),
      )
    : lessons;

  const courseHeader = selectedCourse
    ? `
      <div class="lessons-course-header">
        <h3>شروحات كورس: ${escapeHTML(selectedCourse.title)}</h3>
        <button type="button" onclick="showAllLessons()">
          عرض جميع الشروحات
        </button>
      </div>
    `
    : "";

  if (!visibleLessons.length) {
    box.innerHTML =
      courseHeader + "<p>لا توجد شروحات مضافة لهذا الكورس حتى الآن.</p>";
    return;
  }

  box.innerHTML =
    courseHeader +
    visibleLessons
      .map((lesson) => {
        const video = validHttpUrl(lesson.video_url);
        const pdf = validHttpUrl(lesson.pdf_url);

        return `
      <article class="card lesson-card">
        <div class="lesson-icon">🎥</div>
        <h3>${escapeHTML(lesson.title)}</h3>

        <button type="button"
          onclick="showLesson(${Number(lesson.id)})">
          عرض الشرح
        </button>

        ${
          video
            ? `
          <p>
            <a href="${escapeHTML(video)}"
               target="_blank"
               rel="noopener noreferrer">
              مشاهدة الفيديو
            </a>
          </p>
        `
            : ""
        }

        ${
          pdf
            ? `
          <p>
            <a href="${escapeHTML(pdf)}"
               target="_blank"
               rel="noopener noreferrer">
              فتح ملف PDF
            </a>
          </p>
        `
            : ""
        }
      </article>
    `;
      })
      .join("");
}

window.showAllLessons = function () {
  window.selectedCourseId = null;
  renderLessons();
};

function formatLessonContent(content) {
  const lines = String(content || "لا يوجد محتوى لهذا الدرس.")
    .replace(/\r\n/g, "\n")
    .split("\n");

  let html = "";
  let paragraph = [];
  let list = [];
  let code = [];
  let inCode = false;

  const flushParagraph = () => {
    if (paragraph.length) {
      html += `<p>${paragraph.map(escapeHTML).join("<br>")}</p>`;
      paragraph = [];
    }
  };

  const flushList = () => {
    if (list.length) {
      html +=
        "<ul>" +
        list.map((item) => `<li>${escapeHTML(item)}</li>`).join("") +
        "</ul>";
      list = [];
    }
  };

  for (const line of lines) {
    const trimmed = line.trim();

    if (trimmed.startsWith("```")) {
      flushParagraph();
      flushList();

      if (inCode) {
        html += `<pre class="lesson-code"><code>${escapeHTML(code.join("\n"))}</code></pre>`;
        code = [];
        inCode = false;
      } else {
        inCode = true;
      }
      continue;
    }

    if (inCode) {
      code.push(line);
      continue;
    }

    if (!trimmed) {
      flushParagraph();
      flushList();
      continue;
    }

    if (trimmed.startsWith("## ")) {
      flushParagraph();
      flushList();
      html += `<h3>${escapeHTML(trimmed.slice(3))}</h3>`;
      continue;
    }

    if (trimmed.startsWith("# ")) {
      flushParagraph();
      flushList();
      html += `<h2>${escapeHTML(trimmed.slice(2))}</h2>`;
      continue;
    }

    if (trimmed.startsWith("- ") || trimmed.startsWith("• ")) {
      flushParagraph();
      list.push(trimmed.slice(2));
      continue;
    }

    flushList();
    paragraph.push(trimmed);
  }

  flushParagraph();
  flushList();

  if (inCode) {
    html += `<pre class="lesson-code"><code>${escapeHTML(code.join("\n"))}</code></pre>`;
  }

  return html;
}

window.showLesson = function (id) {
  const lesson = lessons.find((item) => Number(item.id) === Number(id));

  const box = element("lessonContent");
  if (!lesson || !box) return;

  const course = courses.find(
    (item) => Number(item.id) === Number(lesson.course_id),
  );
  window.openLessonImage = function (src) {
    const url = validHttpUrl(src);

    if (url) {
      window.open(url, "_blank", "noopener,noreferrer");
    }
  };
  const video = validHttpUrl(lesson.video_url);
  const pdf = validHttpUrl(lesson.pdf_url);
  // تجهيز صور الشرح
  const imageUrls = Array.isArray(lesson.image_urls) ? lesson.image_urls : [];

  const imagesHTML = imageUrls.length
    ? `
    <section class="lesson-images-section">
      <h3>الصور التوضيحية</h3>

      <div class="lesson-images">
        ${imageUrls
          .map((url, index) => {
            const safeUrl = validHttpUrl(url);
            if (!safeUrl) return "";

            return `
            <figure>
              <img
                src="${escapeHTML(safeUrl)}"
                alt="صورة توضيحية ${index + 1}"
                loading="lazy"
                onclick="openLessonImage(this.src)"
              >
              <figcaption>
                صورة توضيحية ${index + 1}
              </figcaption>
            </figure>
          `;
          })
          .join("")}
      </div>
    </section>
  `
    : "";

  // تجهيز مشغل الفيديو
  let videoHTML = "";

  if (video) {
    let youtubeId = null;

    try {
      const videoURL = new URL(video);
      const host = videoURL.hostname.replace(/^www\./, "");

      if (host === "youtu.be") {
        youtubeId = videoURL.pathname.split("/").filter(Boolean)[0];
      } else if (host === "youtube.com" || host === "m.youtube.com") {
        if (videoURL.pathname === "/watch") {
          youtubeId = videoURL.searchParams.get("v");
        } else {
          const parts = videoURL.pathname.split("/").filter(Boolean);
          if (["embed", "shorts"].includes(parts[0])) {
            youtubeId = parts[1];
          }
        }
      }
    } catch (error) {
      console.warn("تعذر تحليل رابط الفيديو", error);
    }

    if (youtubeId && /^[a-zA-Z0-9_-]{11}$/.test(youtubeId)) {
      videoHTML = `
        <div class="lesson-video">
          <iframe
            src="https://www.youtube-nocookie.com/embed/${youtubeId}"
            title="${escapeHTML(lesson.title)}"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
            allowfullscreen
            loading="lazy">
          </iframe>
        </div>
      `;
    } else {
      let isDirectVideo = false;

      try {
        isDirectVideo = /\.(mp4|webm|ogg)$/i.test(new URL(video).pathname);
      } catch (error) {}

      videoHTML = isDirectVideo
        ? `
          <div class="lesson-video">
            <video controls preload="metadata">
              <source src="${escapeHTML(video)}">
              متصفحك لا يدعم تشغيل الفيديو.
            </video>
          </div>
        `
        : `
          <a class="lesson-resource"
             href="${escapeHTML(video)}"
             target="_blank"
             rel="noopener noreferrer">
            ▶ مشاهدة الفيديو في نافذة جديدة
          </a>
        `;
    }
  }

  const contentHTML = escapeHTML(
    lesson.content || "لا يوجد محتوى نصي لهذا الدرس.",
  )
    .replace(/\r\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/\n\n/g, "</p><p>")
    .replace(/\n/g, "<br>");

  const formattedContent = `<p>${contentHTML}</p>`;

  box.innerHTML = `
    <div class="lesson-page-header">
      <div>
        <span class="lesson-breadcrumb">
          ${escapeHTML(course ? course.title : "الشروحات التعليمية")}
        </span>
        <h2>${escapeHTML(lesson.title)}</h2>
      </div>

      <button type="button"
        class="lesson-back-button"
        onclick="backToLessons()">
        ← العودة إلى الشروحات
      </button>
    </div>

    ${
      videoHTML
        ? `
      <section class="lesson-media-section">
        <h3>مشاهدة الدرس</h3>
        ${videoHTML}
      </section>
    `
        : ""
    }

    <section class="lesson-text-section">
      <h3>محتوى الشرح</h3>
      <div class="lesson-reading">${formattedContent}</div>
    </section>
${imagesHTML}
    ${
      pdf
        ? `
      <div class="lesson-download-section">
        <a class="lesson-resource"
           href="${escapeHTML(pdf)}"
           target="_blank"
           rel="noopener noreferrer">
          📄 فتح ملف الشرح PDF
        </a>
      </div>
    `
        : ""
    }
  `;

  box.style.display = "block";
  box.scrollIntoView({ behavior: "smooth", block: "start" });
};
window.openLessonImage = function (src) {
  const url = validHttpUrl(src);
  if (url) {
    window.open(url, "_blank", "noopener,noreferrer");
  }
};
window.backToLessons = function () {
  const box = element("lessonContent");
  if (box) {
    box.style.display = "none";
    box.innerHTML = "";
  }

  const section = element("lessons");
  if (section) {
    section.scrollIntoView({ behavior: "smooth", block: "start" });
  }
};

async function uploadLessonImages(files) {
  const imageUrls = [];
  const allowedTypes = ["image/jpeg", "image/png", "image/webp"];
  const maxSize = 5 * 1024 * 1024;

  for (const file of files) {
    if (!allowedTypes.includes(file.type)) {
      throw new Error("نوع الصورة غير مدعوم: " + file.name);
    }

    if (file.size > maxSize) {
      throw new Error("حجم الصورة أكبر من 5 ميجابايت: " + file.name);
    }

    const extension = file.name.split(".").pop().toLowerCase();
    const filePath = `${Date.now()}-${crypto.randomUUID()}.${extension}`;

    const { error } = await supabaseClient.storage
      .from("lesson-images")
      .upload(filePath, file, {
        cacheControl: "3600",
        upsert: false,
        contentType: file.type,
      });

    if (error) throw error;

    const { data } = supabaseClient.storage
      .from("lesson-images")
      .getPublicUrl(filePath);

    imageUrls.push(data.publicUrl);
  }

  return imageUrls;
}

// ----------------------------------------
// 9. إضافة شرح جديد
// ----------------------------------------

const lessonForm = element("lessonForm");

if (lessonForm) {
  lessonForm.addEventListener("submit", async function (event) {
    event.preventDefault();

    if (!currentTeacher) {
      showMessage("lessonMessage", "يجب تسجيل دخول المدرس أولًا.", true);
      return;
    }

    const courseId = Number(element("lessonCourse").value);
    const title = element("lessonTitle").value.trim();
    const content = element("lessonText").value.trim();
    const video = element("lessonVideo").value.trim();
    const pdf = element("lessonPDF").value.trim();
    const imageFiles = Array.from(element("lessonImages")?.files || []);

    if (!courseId || !title || !content) {
      showMessage("lessonMessage", "أكملي البيانات المطلوبة.", true);
      return;
    }

    if (video && !validHttpUrl(video)) {
      showMessage("lessonMessage", "رابط الفيديو غير صحيح.", true);
      return;
    }

    if (pdf && !validHttpUrl(pdf)) {
      showMessage("lessonMessage", "رابط PDF غير صحيح.", true);
      return;
    }

    try {
      const imageUrls = await uploadLessonImages(imageFiles);
      const { error } = await supabaseClient.from("lessons").insert([
        {
          course_id: courseId,
          title,
          content,
          video_url: video || null,
          pdf_url: pdf || null,
          image_urls: imageUrls,
        },
      ]);

      if (error) throw error;

      lessonForm.reset();
      showMessage("lessonMessage", "تم إضافة الشرح بنجاح.");

      await loadLessons();
    } catch (error) {
      console.error(error);
      showMessage("lessonMessage", error.message, true);
    }
  });
}
// ----------------------------------------
// 10. عرض الشروحات في لوحة المدرس
// ----------------------------------------

function renderAdminLessons() {
  const box = element("adminLessonsList");
  if (!box) return;

  if (!lessons.length) {
    box.textContent = "لا توجد شروحات.";
    return;
  }

  box.innerHTML = lessons
    .map(
      (lesson) => `
    <div class="item-row">
      <strong>${escapeHTML(lesson.title)}</strong>
      <button class="danger-button" type="button"
        onclick="deleteLesson(${Number(lesson.id)})">
        حذف الشرح
      </button>
    </div>
  `,
    )
    .join("");
}

window.deleteLesson = async function (id) {
  if (!currentTeacher) return;
  if (!confirm("هل تريدين حذف هذا الشرح؟")) return;

  const { error } = await supabaseClient.from("lessons").delete().eq("id", id);

  if (error) {
    alert(error.message);
    return;
  }

  await loadLessons();
};

// ========================================
// 11. إنشاء الامتحانات وإضافة الأسئلة
// ========================================

function getExamQuestions() {
  const questions = [];
  const boxes = document.querySelectorAll(".question-box");

  boxes.forEach((box) => {
    const question = box.querySelector(".question-text")?.value.trim();
    const options = Array.from(box.querySelectorAll(".question-option"))
      .map((input) => input.value.trim())
      .filter(Boolean);

    const correct = Number(box.querySelector(".correct-answer")?.value);

    if (
      question &&
      options.length >= 2 &&
      Number.isInteger(correct) &&
      correct >= 0 &&
      correct < options.length
    ) {
      questions.push({ question, options, correct });
    }
  });

  return questions;
}

// إضافة سؤال جديد
const addQuestionButton = element("addQuestionButton");

if (addQuestionButton) {
  addQuestionButton.addEventListener("click", function () {
    const container = element("newExamQuestions");
    if (!container) return;

    const box = document.createElement("div");
    box.className = "question-box";

    box.innerHTML = `
      <label>السؤال</label>
      <textarea class="question-text" required></textarea>

      <label>الاختيار الأول</label>
      <input class="question-option" required>

      <label>الاختيار الثاني</label>
      <input class="question-option" required>

      <label>الاختيار الثالث</label>
      <input class="question-option">

      <label>الاختيار الرابع</label>
      <input class="question-option">

      <label>رقم الإجابة الصحيحة (يبدأ من صفر)</label>
      <select class="correct-answer">
        <option value="0">الاختيار الأول</option>
        <option value="1">الاختيار الثاني</option>
        <option value="2">الاختيار الثالث</option>
        <option value="3">الاختيار الرابع</option>
      </select>

      <button type="button" class="remove-question danger-button">
        حذف السؤال
      </button>
    `;

    box.querySelector(".remove-question").addEventListener("click", () => {
      box.remove();
    });

    container.appendChild(box);
  });
}

// ========================================
// 12. حفظ امتحان جديد
// ========================================

const examCreateForm = element("examCreateForm");

if (examCreateForm) {
  examCreateForm.addEventListener("submit", async function (event) {
    event.preventDefault();

    if (!currentTeacher) {
      showMessage("examCreateMessage", "يجب تسجيل دخول المدرس أولًا.", true);
      return;
    }

    const title = element("newExamTitle").value.trim();
    const courseId = Number(element("examCourse").value);
    const questions = getExamQuestions();

    if (!title || !courseId || questions.length === 0) {
      showMessage(
        "examCreateMessage",
        "أدخلي عنوان الامتحان واختاري الكورس وأضيفي سؤالًا واحدًا على الأقل.",
        true,
      );
      return;
    }

    try {
      const { error } = await supabaseClient.from("exams").insert([
        {
          title,
          course_id: courseId,
          questions,
        },
      ]);

      if (error) throw error;

      examCreateForm.reset();
      element("newExamQuestions").innerHTML = "";

      showMessage("examCreateMessage", "تم حفظ الامتحان بنجاح.");

      await loadExams();
    } catch (error) {
      console.error(error);
      showMessage("examCreateMessage", error.message, true);
    }
  });
}

// ========================================
// 13. تحميل الامتحانات
// ========================================

async function loadExams() {
  const { data, error } = await supabaseClient
    .from("exams")
    .select("id, title, questions, course_id, created_at")
    .order("id", { ascending: false });

  if (error) throw error;

  exams = data || [];

  renderExams();
  renderAdminExams();
}

function renderExams() {
  const box = element("examsList");
  if (!box) return;

  if (!exams.length) {
    box.innerHTML = "<p>لا توجد امتحانات حاليًا.</p>";
    return;
  }

  box.innerHTML = exams
    .map(
      (exam) => `
    <article class="card">
      <h3>${escapeHTML(exam.title)}</h3>
      <p>عدد الأسئلة: ${(exam.questions || []).length}</p>
      <button type="button"
        onclick="startExam(${Number(exam.id)})">
        بدء الامتحان
      </button>
    </article>
  `,
    )
    .join("");
}

// ========================================
// 14. فتح الامتحان وعرض الأسئلة
// ========================================

window.startExam = function (id) {
  const exam = exams.find((item) => Number(item.id) === Number(id));

  if (!exam) {
    alert("لم يتم العثور على الامتحان.");
    return;
  }

  const area = element("examArea");
  const questionsBox = element("questions");
  const titleBox = element("activeExamTitle");
  const form = element("examForm");

  if (!area || !questionsBox || !titleBox || !form) {
    alert("تأكدي من وجود عناصر الامتحان في index.html.");
    return;
  }

  activeExam = exam;

  titleBox.textContent = exam.title;

  const questions = exam.questions || [];

  if (!questions.length) {
    alert("هذا الامتحان لا يحتوي على أسئلة.");
    return;
  }

  questionsBox.innerHTML = questions
    .map(
      (question, index) => `
      <div class="question-card">
        <h3>${index + 1}. ${escapeHTML(question.question)}</h3>

        ${(question.options || [])
          .map(
            (option, optionIndex) => `
            <label class="answer-option">
              <input
                type="radio"
                name="answer-${index}"
                value="${optionIndex}"
                required
              >
              <span>${escapeHTML(option)}</span>
            </label>
          `,
          )
          .join("")}
      </div>
    `,
    )
    .join("");

  if (currentStudent) {
    element("studentName").value = currentStudent.name;
  }

  element("examMessage").textContent = "";

  area.classList.remove("hidden");
  area.style.display = "block";

  area.scrollIntoView({ behavior: "smooth" });
};

// ========================================
// 15. تسليم الامتحان وحفظ النتيجة
// ========================================

const studentExamForm = element("examForm");

if (studentExamForm) {
  studentExamForm.addEventListener("submit", async function (event) {
    event.preventDefault();

    if (!activeExam) {
      showMessage("examMessage", "اختاري امتحانًا أولًا.", true);
      return;
    }

    if (!currentStudent) {
      try {
        const {
          data: { user },
          error,
        } = await supabaseClient.auth.getUser();
        console.log("بيانات جلسة الطالب:", {
          user,
          error,
        });
        if (error) throw error;

        if (user) {
          await showStudentDashboard(user);
        }
      } catch (error) {
        console.error("Student session restore error:", error);
      }

      if (!currentStudent) {
        showMessage(
          "examMessage",
          "انتهت جلسة الطالب. يرجى تسجيل الدخول مرة أخرى.",
          true,
        );
        return;
      }
    }

    const questions = activeExam.questions || [];
    let score = 0;

    for (let i = 0; i < questions.length; i++) {
      const selected = studentExamForm.querySelector(
        `input[name="answer-${i}"]:checked`,
      );

      if (selected && Number(selected.value) === Number(questions[i].correct)) {
        score++;
      }
    }

    const total = questions.length;

    const submitButton = element("submitExam");
    if (submitButton) submitButton.disabled = true;

    showMessage(
      "examMessage",
      `انتهى الامتحان. درجتك ${score} من ${total}. جارٍ حفظ النتيجة...`,
    );

    try {
      const { error } = await supabaseClient.from("منصة تعليمية").insert([
        {
          "اسم الطالب": currentStudent.name,
          "درجة الطالب": score,
          "تاريخ الامتحان": new Date().toISOString().slice(0, 10),
          user_id: currentStudent.id,
        },
      ]);

      if (error) throw error;

      showMessage(
        "examMessage",
        `تم تسليم الامتحان بنجاح. درجتك ${score} من ${total}.`,
      );

      studentExamForm.querySelectorAll("input").forEach((input) => {
        input.disabled = true;
      });

      await loadStudentResults();
    } catch (error) {
      console.error("Exam result error:", error);

      showMessage(
        "examMessage",
        "تم التصحيح لكن تعذر حفظ النتيجة: " + error.message,
        true,
      );
    } finally {
      if (submitButton) submitButton.disabled = false;
    }
  });
}

// ========================================
// 16. إدارة الامتحانات
// ========================================

function renderAdminExams() {
  const box = element("adminExamsList");
  if (!box) return;

  if (!exams.length) {
    box.textContent = "لا توجد امتحانات.";
    return;
  }

  box.innerHTML = exams
    .map(
      (exam) => `
    <div class="item-row">
      <strong>${escapeHTML(exam.title)}</strong>
      <button type="button"
        class="danger-button"
        onclick="deleteExam(${Number(exam.id)})">
        حذف الامتحان
      </button>
    </div>
  `,
    )
    .join("");
}

window.deleteExam = async function (id) {
  if (!currentTeacher) return;

  if (!confirm("هل تريدين حذف هذا الامتحان؟")) return;

  const { error } = await supabaseClient.from("exams").delete().eq("id", id);

  if (error) {
    alert(error.message);
    return;
  }

  await loadExams();
};

// ----------------------------------------
// 17. عرض نتائج الطلاب
// ----------------------------------------

const loadResultsButton = element("loadResultsButton");

if (loadResultsButton) {
  loadResultsButton.addEventListener("click", async function () {
    if (!currentTeacher) return;

    const box = element("studentResults");
    box.textContent = "جارٍ تحميل النتائج...";

    try {
      const { data, error } = await supabaseClient
        .from("منصة تعليمية")
        .select("*")
        .order("تاريخ الامتحان", { ascending: false });

      if (error) throw error;

      if (!data || !data.length) {
        box.textContent = "لا توجد نتائج حتى الآن.";
        return;
      }

      box.innerHTML = data
        .map(
          (result) => `
        <div class="item-row">
          <strong>${escapeHTML(result["اسم الطالب"])}</strong>
          <p>الدرجة: ${escapeHTML(result["درجة الطالب"])}</p>
          <p>تاريخ الامتحان: ${escapeHTML(result["تاريخ الامتحان"])}</p>
        </div>
      `,
        )
        .join("");
    } catch (error) {
      console.error(error);
      box.textContent = "تعذر تحميل النتائج: " + error.message;
    }
  });
}

// 18. تحميل بيانات المنصة عند فتح الموقع
// ----------------------------------------

async function loadAdminData() {
  try {
    await loadCourses();
    await loadLessons();
    await loadExams();
  } catch (error) {
    console.error("Loading Error:", error);
  }
}

async function initializePlatform() {
  if (!supabaseClient) {
    console.error("Supabase is not configured. Check config.js");
    return;
  }

  try {
    await loadCourses();
    await loadLessons();
    await loadExams();
    await updateTeacherView();
    await restoreStudentSession();
  } catch (error) {
    console.error("Platform Error:", error);
  }
}
// ========================================
// حساب الطالب
// ========================================

async function showStudentDashboard(user) {
  const { data: student, error } = await supabaseClient
    .from("student_accounts")
    .select("user_id, student_name")
    .eq("user_id", user.id)
    .maybeSingle();

  if (error) throw error;

  if (!student) {
    throw new Error("هذا الحساب غير مسجل كطالب في المنصة.");
  }

  currentStudent = {
    id: user.id,
    name: student.student_name,
  };

  const dashboard = element("studentDashboard");
  dashboard.hidden = false;

  dashboard.innerHTML = `
    <h3>مرحباً ${escapeHTML(student.student_name)}</h3>
    <p>يمكنك مشاهدة الكورسات والامتحانات من الصفحة.</p>
    <h3>نتائجي السابقة</h3>
    <div id="myStudentResults">جارٍ تحميل النتائج...</div>
    <button type="button" id="studentLogoutButton">تسجيل الخروج</button>
  `;

  await loadStudentResults();

  element("studentLogoutButton").addEventListener("click", async () => {
    const { error } = await supabaseClient.auth.signOut();

    if (error) {
      showMessage("studentMessage", error.message, true);
      return;
    }

    currentStudent = null;
    dashboard.hidden = true;
    dashboard.innerHTML = "";
    showMessage("studentMessage", "تم تسجيل الخروج بنجاح.");
  });
}

async function loadStudentResults() {
  const box = element("myStudentResults");
  if (!box || !currentStudent) return;

  const { data, error } = await supabaseClient
    .from("منصة تعليمية")
    .select('"اسم الطالب", "درجة الطالب", "تاريخ الامتحان"')
    .eq("user_id", currentStudent.id)
    .order("تاريخ الامتحان", { ascending: false });

  if (error) throw error;

  if (!data || data.length === 0) {
    box.textContent = "لا توجد نتائج سابقة حتى الآن.";
    return;
  }

  box.innerHTML = data
    .map(
      (result) => `
        <div class="item-row">
          <strong>${escapeHTML(result["اسم الطالب"])}</strong>
          <p>الدرجة: ${escapeHTML(result["درجة الطالب"])}</p>
          <p>التاريخ: ${escapeHTML(result["تاريخ الامتحان"])}</p>
        </div>
      `,
    )
    .join("");
}

// ========================================
// 19. حساب الطالب بالاسم وكود الدخول
// ========================================

// حفظ جلسة الطالب التي ترجع من Edge Function
async function saveStudentSession(session) {
  if (!session?.access_token || !session?.refresh_token) {
    throw new Error("لم تصل بيانات جلسة الدخول بشكل صحيح.");
  }

  const { data, error } = await supabaseClient.auth.setSession({
    access_token: session.access_token,
    refresh_token: session.refresh_token,
  });

  if (error) throw error;
  return data.user;
}

// إنشاء حساب طالب جديد وإظهار كود الدخول مرة واحدة
const studentRegisterButton = element("studentRegisterButton");

if (studentRegisterButton) {
  studentRegisterButton.addEventListener("click", async function () {
    if (!supabaseClient) {
      showMessage("studentMessage", "تحققي من إعدادات Supabase.", true);
      return;
    }

    const nameInput = element("studentLoginName");
    const name = nameInput ? nameInput.value.trim() : "";

    if (name.length < 2) {
      showMessage("studentMessage", "اكتب اسم الطالب بشكل صحيح.", true);
      return;
    }

    studentRegisterButton.disabled = true;

    try {
      showMessage("studentMessage", "جارٍ إنشاء حساب الطالب...");

      const { data, error } = await supabaseClient.functions.invoke(
        "student-access",
        {
          body: {
            action: "register",
            name,
          },
        },
      );
      console.log("Student login response:", {
        success: data?.success,
        error: data?.error,
        hasSession: !!data?.session,
      });
      if (error) throw error;
      if (!data?.success || !data?.session || !data?.code) {
        throw new Error(data?.error || "تعذر إنشاء الحساب.");
      }

      const user = await saveStudentSession(data.session);
      await showStudentDashboard(user);

      // لا نضع الكود في Console أو في التخزين المحلي.
      // يظهر للطالب على الصفحة ليحتفظ به بنفسه.
      showMessage(
        "studentMessage",
        "تم إنشاء الحساب بنجاح. كود الدخول الخاص بك: " +
          data.code +
          " — احتفظ به في مكان آمن، فلن يظهر مرة أخرى.",
      );

      const loginForm = element("studentLoginForm");
      if (loginForm) loginForm.reset();
    } catch (error) {
      console.error("Student registration error:", error);
      showMessage(
        "studentMessage",
        error.message || "حدث خطأ أثناء إنشاء الحساب.",
        true,
      );
    } finally {
      studentRegisterButton.disabled = false;
    }
  });
}

// تسجيل دخول الطالب بالاسم وكود الدخول
const studentLoginForm = element("studentLoginForm");

if (studentLoginForm) {
  studentLoginForm.addEventListener("submit", async function (event) {
    event.preventDefault();

    if (!supabaseClient) {
      showMessage("studentMessage", "تحققي من إعدادات Supabase.", true);
      return;
    }

    const nameInput = element("studentLoginName");
    const codeInput = element("studentLoginCode");
    const name = nameInput ? nameInput.value.trim() : "";
    const code = codeInput ? codeInput.value.trim() : "";
    const submitButton = studentLoginForm.querySelector(
      'button[type="submit"]',
    );

    if (!name || !code) {
      showMessage("studentMessage", "اكتب اسم الطالب وكود الدخول.", true);
      return;
    }

    if (submitButton) submitButton.disabled = true;

    try {
      showMessage("studentMessage", "جارٍ تسجيل الدخول...");

      const { data, error } = await supabaseClient.functions.invoke(
        "student-access",
        {
          body: {
            action: "login",
            name,
            code,
          },
        },
      );

      if (error) throw error;
      if (!data?.success || !data?.session) {
        throw new Error(data?.error || "الاسم أو كود الدخول غير صحيح.");
      }

      const user = await saveStudentSession(data.session);

      // التأكد أن الحساب طالب وليس مدرسًا
      const { data: teacher, error: teacherError } = await supabaseClient
        .from("teacher_accounts")
        .select("user_id")
        .eq("user_id", user.id)
        .maybeSingle();

      if (teacherError) throw teacherError;

      if (teacher) {
        await supabaseClient.auth.signOut();
        throw new Error("هذا حساب مدرس، استخدم صفحة دخول المدرس.");
      }

      await showStudentDashboard(user);
      studentLoginForm.reset();
      showMessage("studentMessage", "تم تسجيل الدخول بنجاح.");
    } catch (error) {
      console.error("Student login error:", error);

      if (error.context) {
        const details = await error.context.json();
        console.error("Student login details:", details);
      }
      showMessage(
        "studentMessage",
        error.message || "حدث خطأ أثناء تسجيل الدخول.",
        true,
      );
    } finally {
      if (submitButton) submitButton.disabled = false;
    }
  });
}

// استعادة جلسة الطالب عند إعادة فتح الصفحة
async function restoreStudentSession() {
  const {
    data: { user },
    error: authError,
  } = await supabaseClient.auth.getUser();

  if (authError || !user) return;

  const { data: teacher, error: teacherError } = await supabaseClient
    .from("teacher_accounts")
    .select("user_id")
    .eq("user_id", user.id)
    .maybeSingle();

  if (teacherError) throw teacherError;
  if (teacher) return;

  const { data: student, error: studentError } = await supabaseClient
    .from("student_accounts")
    .select("user_id")
    .eq("user_id", user.id)
    .maybeSingle();

  if (studentError) throw studentError;

  if (student) {
    await showStudentDashboard(user);
  }
}

// تشغيل المنصة بعد تعريف جميع الدوال
initializePlatform();
