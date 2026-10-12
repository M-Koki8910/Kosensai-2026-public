// =========================
// お知らせ投稿ログイン
// =========================

document.addEventListener("DOMContentLoaded", () => {

    const form = document.getElementById("loginForm");

    if (!form) return;

    form.addEventListener("submit", login);

});

async function login(e) {

    e.preventDefault();

    const username =
        document.getElementById("loginUsername").value.trim();

    const password =
        document.getElementById("loginPassword").value;

    if (!username || !password) {

        showLoginMessage(
            "ユーザー名とパスワードを入力してください。",
            "error"
        );

        return;
    }

    try {

        // -------------------------
        // ログイン
        // -------------------------

        const response =
            await fetch("/api/login", {

                method: "POST",

                headers: {
                    "Content-Type": "application/json"
                },

                body: JSON.stringify({
                    username,
                    password,
                    purpose: "announcement"
                })

            });

        const data =
            await response.json();

        if (!data.ok) {

            showLoginMessage(
                data.error || "ログインに失敗しました。",
                "error"
            );

            return;
        }

        // -------------------------
        // 投稿権限確認
        // -------------------------

        const check =
            await fetch(
                "/api/auth/check-announcement-access"
            );

        const permission =
            await check.json();

        if (!permission.ok) {

            if (check.status === 403) {

                showLoginMessage(
                    "お知らせ投稿権限がありません。",
                    "error"
                );

            } else {

                showLoginMessage(
                    permission.error || "認証エラー",
                    "error"
                );

            }

            return;
        }

        // -------------------------
        // 投稿ページへ
        // -------------------------

        showLoginMessage(
            "ログインしました。移動します...",
            "success"
        );

        setTimeout(() => {

            location.href =
                "./announcements-post.html";

        }, 500);

    }

    catch (err) {

        console.error(err);

        showLoginMessage(
            "通信エラーが発生しました。",
            "error"
        );

    }

}

function showLoginMessage(text, type) {

    const message =
        document.getElementById("loginMessage");

    if (!message) return;

    message.textContent = text;

    message.className =
        `login-message show ${type}`;

}