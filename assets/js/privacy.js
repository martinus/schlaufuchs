// The privacy page (§3.5). Static prose — it only needs its strings and its
// icons. No state is read here: a page that explains the cookie must not need
// the cookie to render.

import { initI18n } from "./i18n.js";
import { applyIcons } from "./graphics.js";

initI18n();
applyIcons(document);
