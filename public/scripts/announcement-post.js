const AnnouncementPost = (() => {

    const API =
        "/api/announcements";

    function init() {

        checkPermission();

        const form =
            document.getElementById(
                "announcementForm"
            );

        form?.addEventListener(
            "submit",
            submit
        );

        document
            .getElementById("announcementContent")
            ?.addEventListener(
                "input",
                updateCounter
            );

    }