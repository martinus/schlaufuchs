// The privacy page (§3.5). Static prose — it only needs its strings, its icons
// and the bar. No state is read here: a page that explains the cookie must not
// need the cookie to render.

import { initI18n } from "./i18n.js";
import { initTopBar } from "./chrome.js";

initI18n();
initTopBar({ back: "./", title: "privacyTitle" });
