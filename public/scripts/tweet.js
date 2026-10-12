
// =========================
// 掲示板・アナウンス　共通ユーティリティ
// =========================

function escapeHtml(text) {
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
}

function formatDate(dateStr) {
  return new Date(dateStr).toLocaleString("ja-JP");
}

// =========================
// 掲示板機能
// =========================

const BulletinBoard = (() => {
  const API = "/api/posts";
  const interval = 10000;

  function ensureProcessingStyles() {
    if (document.getElementById("bulletin-processing-styles")) return;

    const style = document.createElement("style");
    style.id = "bulletin-processing-styles";
    style.textContent = `
      #bulletin-processing-overlay {
        position: fixed;
        inset: 0;
        z-index: 9999;
        display: flex;
        align-items: center;
        justify-content: center;
        background: rgba(15, 23, 42, 0.18);
        backdrop-filter: blur(6px);
        -webkit-backdrop-filter: blur(6px);
      }

      #bulletin-processing-spinner {
        width: 72px;
        height: 72px;
        border-radius: 50%;
        border: 5px solid rgba(255, 255, 255, 0.35);
        border-top-color: #f59e0b;
        border-right-color: #fbbf24;
        animation: bulletin-processing-spin 0.9s linear infinite;
        box-shadow: 0 0 0 1px rgba(255,255,255,0.3), 0 12px 30px rgba(0,0,0,0.22);
      }

      @keyframes bulletin-processing-spin {
        from { transform: rotate(0deg); }
        to { transform: rotate(360deg); }
      }
    `;
    document.head.appendChild(style);
  }

  function showProcessingOverlay() {
    ensureProcessingStyles();

    const existing = document.getElementById("bulletin-processing-overlay");
    if (existing) return;

    const overlay = document.createElement("div");
    overlay.id = "bulletin-processing-overlay";
    overlay.setAttribute("role", "status");
    overlay.setAttribute("aria-live", "polite");
    overlay.innerHTML = `
      <div id="bulletin-processing-spinner" aria-label="処理中"></div>
    `;

    document.body.appendChild(overlay);
  }

  function hideProcessingOverlay() {
    const overlay = document.getElementById("bulletin-processing-overlay");
    if (overlay) overlay.remove();
  }

  function init() {
    const form = document.getElementById("postForm");
    const input = document.getElementById("postContent");

    if (!form || !input) return;

    input.addEventListener("input", () => {
      document.getElementById("charCount").textContent = input.value.length;
    });

    form.addEventListener("submit", submitPost);

    loadPosts();
    setInterval(loadPosts, interval);
  }

  async function submitPost(e) {
    e.preventDefault();

    const content = document.getElementById("postContent").value.trim();
    if (!content) return showMessage("入力してください", "error");

    showProcessingOverlay();

    try {
      const res = await fetch(API, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content })
      });

      const data = await res.json();

      if (data.ok) {
        showMessage("投稿されました", "success");
        document.getElementById("postContent").value = "";
        document.getElementById("charCount").textContent = "0";
      } else {
        showMessage(data.error || "失敗", "error");
      }
    } catch (err) {
      showMessage("通信エラー", "error");
    } finally {
      hideProcessingOverlay();
    }
  }

  async function loadPosts() {
    const container = document.getElementById("postContainer");
    if (!container) return;

    try {
      const res = await fetch(`${API}?status=published&limit=30`);
      const data = await res.json();

      if (!data.ok) {
        container.innerHTML = "<p>読み込み失敗</p>";
        return;
      }

      container.innerHTML = "";
      (data.posts || []).forEach(post => {
        container.appendChild(render(post));
      });

    } catch {
      container.innerHTML = "<p>通信エラー</p>";
    }
  }

  function render(post) {
    const div = document.createElement("div");
    div.className = "post-item";

    div.innerHTML = `
      <div class="post-body">
        <div class="post-header">
          <span>${formatDate(post.created_at)}</span>
          <span class="post-status">${post.status}</span>
        </div>
        <div class="post-content"></div>
        <div class="post-reactions">
          <button type="button" class="reaction-btn thumbs-up ${post.reacted_thumbs_up ? "active" : ""}" data-reaction="thumbs_up">
            👍 <span class="reaction-count">${post.thumbs_up_count || 0}</span>
          </button>
          <button type="button" class="reaction-btn heart ${post.reacted_heart ? "active" : ""}" data-reaction="heart">
            ❤ <span class="reaction-count">${post.heart_count || 0}</span>
          </button>
        </div>
      </div>
    `;

    div.querySelector(".post-content").textContent = post.content;

    div.querySelectorAll(".reaction-btn").forEach(button => {
      button.addEventListener("click", () => {
        sendReaction(post.id, button.dataset.reaction);
      });
    });

    return div;
  }

  async function sendReaction(postId, reactionType) {
    try {
      const res = await fetch(`${API}/${postId}/reactions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reaction_type: reactionType })
      });

      const data = await res.json();

      if (!data.ok) {
        showMessage(data.error || "リアクションに失敗しました", "error");
        return;
      }

      if (data.toggled_off) {
        showMessage("リアクションを取り消しました", "success");
      } else {
        showMessage("リアクションしました", "success");
      }
      loadPosts();
    } catch (err) {
      showMessage("通信エラー", "error");
    }
  }

  function showMessage(text, type) {
    const el = document.getElementById("message");
    if (!el) return;

    el.textContent = text;
    el.className = `message show ${type}`;

    if (type === "success") {
      setTimeout(() => el.classList.remove("show"), 3000);
    }
  }

  return { init };
})();

// =========================
// アナウンス機能
// =========================

const Announcements = (() => {
  const API = "/api/announcements";
  const interval = 30000;

  function init() {
    load();
    setInterval(load, interval);
  }

  async function load() {
    const container = document.getElementById("announcementsContainer");
    if (!container) return;

    try {
      const res = await fetch(API);
      const data = await res.json();

      if (!data.ok) {
        container.innerHTML = "<p>読み込み失敗</p>";
        return;
      }

      const list = data.announcements || [];

      if (!list.length) {
        container.innerHTML = "<p>お知らせなし</p>";
        return;
      }

      const grouped = group(list);

      container.innerHTML = `
        ${renderSection("緊急", grouped.urgent)}
        ${renderSection("重要", grouped.important)}
        ${renderSection("通常", grouped.normal)}
      `;

    } catch {
      container.innerHTML = "<p>通信エラー</p>";
    }
  }

  function group(list) {
    return {
      urgent: list.filter(a => a.importance === "urgent"),
      important: list.filter(a => a.importance === "important"),
      normal: list.filter(a => a.importance === "normal")
    };
  }

  function renderSection(title, items) {
    if (!items.length) return "";

    return `
      <h3>${title}</h3>
      ${items.map(renderItem).join("")}
    `;
  }

  function renderItem(a) {
    return `
      <div class="announcement-item ${a.importance}">
        <h4>${escapeHtml(a.title)}</h4>
        <p>${escapeHtml(a.content)}</p>
            <small>${a.always_publish ? "常時公開" : `${formatDate(a.published_at)} ～ ${formatDate(a.expires_at)}`}</small>
      </div>
    `;
  }

  return { init };
})();

document.addEventListener("DOMContentLoaded", () => {
    loadTicker();
});

async function loadTicker() {
    const normalTicker = document.querySelector('.ticker-content[data-ticker-type="normal"]') || document.getElementById("ticker-content");
    const importantTicker = document.querySelector('.ticker-content[data-ticker-type="important"]') || document.querySelector(".warning-ticker .ticker-content");

    if (importantTicker) {
        startTicker(importantTicker, [
            "履歴の削除、Cookieの削除は行わないください。記録が消失する可能性があります。"
        ]);
    }

    if (!normalTicker) {
        return;
    }

    let messages = ["📢 現在のお知らせはありません"];

    try {
        const response = await fetch("/api/announcements");
        const data = await response.json();

        if (data.ok && Array.isArray(data.announcements) && data.announcements.length > 0) {
            const tickerItems = data.announcements.filter(item => item && item.title);

            if (tickerItems.length > 0) {
              messages = tickerItems.map(item => {
                const emoji = {
                  normal: "ℹ️",
                  important: "⚠️",
                  urgent: "🚨"
                }[item.importance] || "ℹ️";

                return `${emoji} ${item.title}`;
              });
            }
        }
    } catch (error) {
        console.error("お知らせ取得エラー", error);
    }

    startTicker(normalTicker, messages);
}

function startTicker(ticker, messages) {
    if (!ticker || !Array.isArray(messages) || messages.length === 0) return;

    let index = 0;

    async function showNext() {
        const text = messages[index];
        ticker.textContent = text;

        await new Promise(resolve => requestAnimationFrame(resolve));

        const containerWidth = ticker.parentElement ? ticker.parentElement.offsetWidth : ticker.offsetWidth;
        const textWidth = ticker.scrollWidth;

        if (textWidth <= 0) {
            index = (index + 1) % messages.length;
            setTimeout(showNext, 1200);
            return;
        }

        const startX = containerWidth + 20;
        const endX = -(textWidth + 20);
        const speed = 120;
        const duration = Math.max(4000, ((startX - endX) / speed) * 1000);

        ticker.animate(
            [
                { transform: `translate(${startX}px, 0)` },
                { transform: `translate(${endX}px, 0)` }
            ],
            {
                duration,
                easing: "linear"
            }
        );

        await new Promise(resolve => setTimeout(resolve, duration));
        index = (index + 1) % messages.length;
        showNext();
    }

    showNext();
}
// =========================
// アナウンス投稿機能
// =========================

const AnnouncementPost = (() => {

  const API = "/api/announcements";
  const ADMIN_API = "/api/admin/announcements";
  let initialized = false;

  function updatePublicationInputs() {
    const alwaysPublish = document.getElementById("announcementAlwaysPublish");
    const publishedAt = document.getElementById("announcementPublishedAt");
    const expiresAt = document.getElementById("announcementExpiresAt");
    if (!alwaysPublish || !publishedAt || !expiresAt) return;

    const disabled = alwaysPublish.checked;
    publishedAt.disabled = disabled;
    expiresAt.disabled = disabled;
    publishedAt.required = !disabled;
    expiresAt.required = !disabled;
  }

  function init() {

    const form = document.getElementById("announcementForm");
    if (!form || initialized) return;
    initialized = true;

    const content = document.getElementById("announcementContent");

    content?.addEventListener("input", () => {
      document.getElementById("charCount").textContent =
        content.value.length;
    });

    form.addEventListener("submit", submitAnnouncement);

    const alwaysPublish = document.getElementById("announcementAlwaysPublish");
    alwaysPublish?.addEventListener("change", updatePublicationInputs);
    updatePublicationInputs();

    loadAnnouncements();
  }

  async function submitAnnouncement(e) {

    e.preventDefault();

    const title =
      document.getElementById("announcementTitle").value.trim();

    const content =
      document.getElementById("announcementContent").value.trim();

    const importance =
      document.getElementById("announcementImportance").value;

    const published_at =
      document.getElementById("announcementPublishedAt").value;

    const expires_at =
      document.getElementById("announcementExpiresAt").value;

    const always_publish =
      document.getElementById("announcementAlwaysPublish")?.checked || false;

    if (
      !title ||
      !content ||
      (!always_publish && (!published_at || !expires_at))
    ) {

      showMessage(
        "すべて入力してください",
        "error"
      );

      return;
    }

    if (!always_publish && new Date(published_at) >= new Date(expires_at)) {
      showMessage("公開終了日時は公開開始日時より後にしてください", "error");
      return;
    }

    try {

      const res = await fetch(API, {

        method: "POST",

        headers: {
          "Content-Type": "application/json"
        },

        body: JSON.stringify({

          title,
          content,
          importance,
          published_at,
          expires_at,
          always_publish

        })

      });

      const data = await res.json();

      if (!data.ok) {

        showMessage(
          data.error || "投稿に失敗しました",
          "error"
        );

        return;
      }

      showMessage(
        "投稿しました",
        "success"
      );

      e.target.reset();

      updatePublicationInputs();

      document.getElementById("charCount").textContent = "0";

      loadAnnouncements();

    }

    catch {

      showMessage(
        "通信エラー",
        "error"
      );

    }

  }

  async function loadAnnouncements() {

    const container =
      document.getElementById(
        "announcementManageContainer"
      );

    if (!container) return;

    try {

      const res =
        await fetch(ADMIN_API);

      const data =
        await res.json();

      if (!data.ok) {

        container.innerHTML =
          "<p>読み込み失敗</p>";

        return;
      }

      const list =
        data.announcements || [];

      if (!list.length) {

        container.innerHTML =
          "<p>投稿はありません</p>";

        return;
      }

      container.innerHTML = "";

      list.forEach(a => {

        const div =
          document.createElement("div");

        div.className = "manage-item";

        div.innerHTML = `
          <h4>${escapeHtml(a.title)}</h4>

          <div class="manage-meta">
            ${a.always_publish ? "常時公開" : `${formatDate(a.published_at)} ～ ${formatDate(a.expires_at)}`}
          </div>

          <p>${escapeHtml(a.content)}</p>

          <div class="manage-actions">

            <button
              class="btn btn-edit"
              data-id="${a.id}">
              編集
            </button>

            <button
              class="btn btn-delete"
              data-id="${a.id}">
              削除
            </button>

          </div>
        `;

        container.appendChild(div);

      });

    }

    catch {

      container.innerHTML =
        "<p>通信エラー</p>";

    }

  }

  function showMessage(text, type) {

    const el =
      document.getElementById("message");

    if (!el) return;

    el.textContent = text;

    el.className =
      `message show ${type}`;

    if (type === "success") {

      setTimeout(() => {

        el.classList.remove("show");

      }, 3000);

    }

  }

  return {
    init
  };

})();

// =========================
// 初期化
// =========================

document.addEventListener("DOMContentLoaded", () => {
  BulletinBoard.init();
  Announcements.init();
  AnnouncementPost.init();
});