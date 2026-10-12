const Announcements = (() => {

    const API = "/api/announcements";
    const interval = 30000;

    function init() {

        load();

        setInterval(load, interval);

    }

    async function load() {

        const container =
            document.getElementById(
                "announcementsContainer"
            );

        if (!container) return;

        try {

            const res =
                await fetch(API);

            const data =
                await res.json();

            if (!data.ok) {

                container.innerHTML =
                    "<p>読み込みに失敗しました。</p>";

                return;
            }

            const list =
                data.announcements ?? [];

            if (list.length === 0) {

                container.innerHTML =
                    "<p>現在お知らせはありません。</p>";

                return;
            }

            const groups = {

                urgent: [],
                important: [],
                normal: []

            };

            list.forEach(item => {

                if (groups[item.importance]) {

                    groups[item.importance].push(item);

                }

            });

            container.innerHTML = "";

            appendSection(
                container,
                "緊急",
                groups.urgent
            );

            appendSection(
                container,
                "重要",
                groups.important
            );

            appendSection(
                container,
                "通常",
                groups.normal
            );

        }

        catch {

            container.innerHTML =
                "<p>通信エラー</p>";

        }

    }

    function appendSection(
        parent,
        title,
        list
    ) {

        if (!list.length) return;

        const section =
            document.createElement("section");

        section.innerHTML =

        `
        <h3>${title}</h3>
        ${list.map(render).join("")}
        `;

        parent.appendChild(section);

    }

    function render(item) {

        return `
        <div class="announcement-item ${item.importance}">

            <h4>${escapeHtml(item.title)}</h4>

            <p>${escapeHtml(item.content)}</p>

            <small>

                ${item.always_publish ? "常時公開" : `${formatDate(item.published_at)} ～ ${formatDate(item.expires_at)}`}

            </small>

        </div>
        `;

    }

    return {
        init
    };

})();

document.addEventListener(
    "DOMContentLoaded",
    Announcements.init
);