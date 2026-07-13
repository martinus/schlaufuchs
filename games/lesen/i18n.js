// Lesen strings (§6.1): one object per language in the same file so a missing
// translation is visible in review. UI chrome only — the words and sentences
// the child reads are *content*, not translation, and live in content.js.
export default {
  de: {
    lesenPickTitle: "Thema & Schwierigkeit",
    // The pack tiles' names, looked up as lesenPack<Key> from content.js keys.
    // tests/lesen-content.test.js holds the two sides together.
    lesenPackTiere: "Tiere",
    lesenPackEssen: "Essen",
    lesenPackZuhause: "Zuhause",
    lesenPackNatur: "Natur",
    lesenPackTierwelt: "Tierwelt",
    lesenPackUnterwegs: "Unterwegs",
    lesenPackKueche: "Küche",
    lesenPackDraussen: "Draußen",
    lesenPackLeseTiere: "Tiere",
    lesenPackLeseAlltag: "Alltag",
    lesenPackLeseNatur: "Natur",
    lesenPackLeseAbenteuer: "Abenteuer",
    lesenMixed: "Alle",
    // The Mittel verdict buttons (§14.1) and the aid's answer line (§8.1).
    lesenTrue: "Stimmt!",
    lesenFalse: "Blödsinn!",
    lesenIsTrue: "Das stimmt wirklich!",
    lesenIsFalse: "Das ist Blödsinn!",
    // What a screen reader hears once the blitz has hidden the word (§14.2).
    lesenCardHidden: "Das Wort hat sich versteckt",
    // The "ready" cover the child taps to start a word's blitz (§14.2): the
    // visible cue and its screen-reader label.
    lesenReady: "Bereit? Tippen",
    lesenTapReady: "Tippen, um das Wort zu sehen",
  },
  en: {
    lesenPickTitle: "Topic & difficulty",
    lesenPackTiere: "Animals",
    lesenPackEssen: "Food",
    lesenPackZuhause: "At Home",
    lesenPackNatur: "Nature",
    lesenPackTierwelt: "Wildlife",
    lesenPackUnterwegs: "On the Go",
    lesenPackKueche: "Kitchen",
    lesenPackDraussen: "Outdoors",
    lesenPackLeseTiere: "Animals",
    lesenPackLeseAlltag: "Everyday",
    lesenPackLeseNatur: "Nature",
    lesenPackLeseAbenteuer: "Adventure",
    lesenMixed: "All",
    lesenTrue: "True!",
    lesenFalse: "Nonsense!",
    lesenIsTrue: "That is really true!",
    lesenIsFalse: "That is nonsense!",
    lesenCardHidden: "The word is hiding",
    lesenReady: "Ready? Tap",
    lesenTapReady: "Tap to see the word",
  },
};
