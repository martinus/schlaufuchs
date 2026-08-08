// Drachengeschichten strings (§6.1): one object per language in the same file so
// a missing translation is visible in review. UI chrome ONLY — the stories the
// child reads are German content (games/drachen/content.js, §14.6), and so are
// their titles and the names of their endings: a story is a work, not a
// category, and there is no English story to name.
export default {
  de: {
    drachenPickTitle: "Geschichte & Schwierigkeit",
    // The one button under an ending scene. The summary comes after it, so she
    // decides herself when she has finished reading (§21).
    drachenNext: "Weiter",
    drachenChoose: "Wie geht es weiter?",
    drachenNewEnding: "Neues Ende!",
    drachenKnownEnding: "Dieses Ende kanntest du schon",
    drachenFound: "{n} von {total} Enden gefunden",
    drachenLeft1: "Noch 1 Ende versteckt!",
    drachenLeft: "Noch {n} Enden versteckt!",
    drachenAll: "Du hast alle Enden gefunden!",
    drachenHidden: "Noch nicht gefunden",
  },
  en: {
    drachenPickTitle: "Story & difficulty",
    drachenNext: "Carry on",
    drachenChoose: "What happens next?",
    drachenNewEnding: "New ending!",
    drachenKnownEnding: "You already knew this ending",
    drachenFound: "{n} of {total} endings found",
    drachenLeft1: "1 ending still hidden!",
    drachenLeft: "{n} endings still hidden!",
    drachenAll: "You have found every ending!",
    drachenHidden: "Not found yet",
  },
};
