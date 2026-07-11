// Lesen content (§14.2). Data only — no logic, no DOM.
//
// Canonical item order for the box digit string (§9.2): packs in this array's
// order, items in theirs. NEVER reorder or delete an entry — append only, or
// every child's Leitner boxes shift under her.
//
// Authoring rules (enforced by tests/lesen-content.test.js):
//  - every word has ONE unambiguous, mainstream emoji; inside a pack, words
//    and emoji are unique, and no two emoji are near-twins (🐶 vs 🐺 is fine,
//    🐶 vs 🐕 is a bug) — distractors are drawn from the same pack (§14.3);
//  - a sentence pair shares its subject and roughly its length, so truth is
//    never guessable from the sentence's shape — only from reading it;
//  - sentences are present tense, end with ".", stay ≤ 60 characters, and the
//    silly variant is funny, never scary.
//
// German only for now; an English set is a later milestone (§14.6) and slots
// in as a second key beside `de`.
export const CONTENT = {
  de: {
    packs: [
      // --- Leicht: short frequent words, 1–2 syllables, 10 each ---
      { key: "tiere", diff: 0, items: [
        { w: "Hund", e: "🐶" },
        { w: "Katze", e: "🐱" },
        { w: "Maus", e: "🐭" },
        { w: "Fisch", e: "🐟" },
        { w: "Vogel", e: "🐦" },
        { w: "Pferd", e: "🐴" },
        { w: "Kuh", e: "🐮" },
        { w: "Schwein", e: "🐷" },
        { w: "Frosch", e: "🐸" },
        { w: "Ente", e: "🦆" },
      ] },
      { key: "essen", diff: 0, items: [
        { w: "Brot", e: "🍞" },
        { w: "Apfel", e: "🍎" },
        { w: "Eis", e: "🍦" },
        { w: "Käse", e: "🧀" },
        { w: "Pizza", e: "🍕" },
        { w: "Banane", e: "🍌" },
        { w: "Ei", e: "🥚" },
        { w: "Milch", e: "🥛" },
        { w: "Keks", e: "🍪" },
        { w: "Honig", e: "🍯" },
      ] },
      { key: "zuhause", diff: 0, items: [
        { w: "Bett", e: "🛏️" },
        { w: "Buch", e: "📖" },
        { w: "Tür", e: "🚪" },
        { w: "Uhr", e: "🕐" },
        { w: "Lampe", e: "💡" },
        { w: "Schere", e: "✂️" },
        { w: "Stuhl", e: "🪑" },
        { w: "Seife", e: "🧼" },
        { w: "Besen", e: "🧹" },
        { w: "Schlüssel", e: "🔑" },
      ] },
      { key: "natur", diff: 0, items: [
        { w: "Baum", e: "🌳" },
        { w: "Sonne", e: "☀️" },
        { w: "Mond", e: "🌙" },
        { w: "Stern", e: "🌟" },
        { w: "Blume", e: "🌸" },
        { w: "Wolke", e: "☁️" },
        { w: "Feuer", e: "🔥" },
        { w: "Berg", e: "⛰️" },
        { w: "Pilz", e: "🍄" },
        { w: "Blatt", e: "🍁" },
      ] },
      // --- Mittel: compounds & consonant clusters, 10 each ---
      { key: "tierwelt", diff: 1, items: [
        { w: "Schmetterling", e: "🦋" },
        { w: "Eichhörnchen", e: "🐿️" },
        { w: "Schildkröte", e: "🐢" },
        { w: "Elefant", e: "🐘" },
        { w: "Pinguin", e: "🐧" },
        { w: "Krokodil", e: "🐊" },
        { w: "Marienkäfer", e: "🐞" },
        { w: "Papagei", e: "🦜" },
        { w: "Delfin", e: "🐬" },
        { w: "Känguru", e: "🦘" },
      ] },
      { key: "unterwegs", diff: 1, items: [
        { w: "Fahrrad", e: "🚲" },
        { w: "Feuerwehrauto", e: "🚒" },
        { w: "Flugzeug", e: "✈️" },
        { w: "Straßenbahn", e: "🚋" },
        { w: "Hubschrauber", e: "🚁" },
        { w: "Traktor", e: "🚜" },
        { w: "Rakete", e: "🚀" },
        { w: "Polizeiauto", e: "🚓" },
        { w: "Segelboot", e: "⛵" },
        { w: "Krankenwagen", e: "🚑" },
      ] },
      { key: "kueche", diff: 1, items: [
        { w: "Schokolade", e: "🍫" },
        { w: "Erdbeere", e: "🍓" },
        { w: "Spiegelei", e: "🍳" },
        { w: "Geburtstagskuchen", e: "🎂" },
        { w: "Wassermelone", e: "🍉" },
        { w: "Brezel", e: "🥨" },
        { w: "Pfannkuchen", e: "🥞" },
        { w: "Kartoffel", e: "🥔" },
        { w: "Zitrone", e: "🍋" },
        { w: "Karotte", e: "🥕" },
      ] },
      { key: "draussen", diff: 1, items: [
        { w: "Regenbogen", e: "🌈" },
        { w: "Gewitter", e: "⛈️" },
        { w: "Schneemann", e: "⛄" },
        { w: "Schneeflocke", e: "❄️" },
        { w: "Drachen", e: "🪁" },
        { w: "Zelt", e: "⛺" },
        { w: "Fußball", e: "⚽" },
        { w: "Luftballon", e: "🎈" },
        { w: "Sonnenblume", e: "🌻" },
        { w: "Regenschirm", e: "☔" },
      ] },
      // --- Schwer: sentence pairs, 12 each. `ok` is true, `no` is Quatsch. ---
      { key: "quatschTiere", diff: 2, items: [
        { ok: "Ein Elefant hat einen langen Rüssel.", no: "Ein Elefant schläft im Kühlschrank." },
        { ok: "Die Katze putzt sich mit der Zunge.", no: "Die Katze fährt mit dem Bus zur Schule." },
        { ok: "Ein Fisch schwimmt im Wasser.", no: "Ein Fisch klettert auf den Baum." },
        { ok: "Der Hund wedelt mit dem Schwanz.", no: "Der Hund backt sich eine Pizza." },
        { ok: "Eine Kuh frisst gern Gras.", no: "Eine Kuh putzt sich die Zähne." },
        { ok: "Ein Vogel baut ein Nest.", no: "Ein Vogel liest die Zeitung." },
        { ok: "Der Hase hat lange Ohren.", no: "Der Hase fährt Motorrad." },
        { ok: "Eine Biene fliegt von Blume zu Blume.", no: "Eine Biene spielt Fußball." },
        { ok: "Das Schwein wälzt sich im Matsch.", no: "Das Schwein fliegt zum Mond." },
        { ok: "Die Ente schwimmt auf dem Teich.", no: "Die Ente kauft sich neue Schuhe." },
        { ok: "Ein Pferd kann schnell galoppieren.", no: "Ein Pferd sitzt gern im Kino." },
        { ok: "Die Eule ist nachts wach.", no: "Die Eule föhnt sich die Federn." },
      ] },
      { key: "quatschEssen", diff: 2, items: [
        { ok: "Eis schmeckt kalt und süß.", no: "Eis brennt heiß wie Feuer." },
        { ok: "Brot wird aus Mehl gebacken.", no: "Brot wächst auf Bäumen." },
        { ok: "Eine Banane ist gelb.", no: "Eine Banane bellt laut." },
        { ok: "Nudeln kocht man in Wasser.", no: "Nudeln wachsen im Blumentopf." },
        { ok: "Ein Apfel wächst am Baum.", no: "Ein Apfel wohnt in einer Höhle." },
        { ok: "Milch kommt von der Kuh.", no: "Milch kommt aus dem Wasserhahn." },
        { ok: "Pizza kommt heiß aus dem Ofen.", no: "Pizza schwimmt gern im Schwimmbad." },
        { ok: "Honig machen die Bienen.", no: "Honig fällt als Regen vom Himmel." },
        { ok: "Eine Zitrone schmeckt sauer.", no: "Eine Zitrone singt ein Lied." },
        { ok: "Ein Keks schmeckt süß und knusprig.", no: "Ein Keks hüpft aus der Dose davon." },
        { ok: "Suppe isst man mit dem Löffel.", no: "Suppe isst man mit der Schere." },
        { ok: "Ein Ei hat eine harte Schale.", no: "Ein Ei trägt einen Schlafanzug." },
      ] },
      { key: "quatschAlltag", diff: 2, items: [
        { ok: "Nachts schlafen wir im Bett.", no: "Nachts schlafen wir im Briefkasten." },
        { ok: "Zum Duschen brauche ich Wasser.", no: "Zum Duschen brauche ich Ketchup." },
        { ok: "Schuhe zieht man an die Füße.", no: "Schuhe zieht man an die Ohren." },
        { ok: "Mit der Schere schneidet man Papier.", no: "Mit der Schere kämmt man die Haare." },
        { ok: "Ein Auto fährt auf der Straße.", no: "Ein Auto klettert die Treppe hoch." },
        { ok: "Im Winter tragen wir eine Jacke.", no: "Im Winter tragen wir Badehosen im Schnee." },
        { ok: "Zähne putzt man mit Zahnpasta.", no: "Zähne putzt man mit Marmelade." },
        { ok: "Ein Buch hat viele Seiten.", no: "Ein Buch kann laut niesen." },
        { ok: "Die Lampe macht das Zimmer hell.", no: "Die Lampe isst gern Spaghetti." },
        { ok: "Beim Regen hilft ein Regenschirm.", no: "Beim Regen hilft ein Nudelsieb." },
        { ok: "Der Bäcker backt frische Brötchen.", no: "Der Bäcker backt Autoreifen." },
        { ok: "Mit dem Besen kehrt man den Boden.", no: "Mit dem Besen putzt man sich die Nase." },
      ] },
      { key: "quatschNatur", diff: 2, items: [
        { ok: "Die Sonne wärmt uns am Tag.", no: "Die Sonne hüpft von Wolke zu Wolke." },
        { ok: "Der Schnee ist kalt und weiß.", no: "Der Schnee schmeckt nach Schokolade." },
        { ok: "Blumen brauchen Wasser und Licht.", no: "Blumen trinken am liebsten Kakao." },
        { ok: "Der Mond ist nachts am Himmel.", no: "Der Mond ist ein großer Käse." },
        { ok: "Im Herbst fallen die Blätter.", no: "Im Herbst fallen Gummibärchen vom Baum." },
        { ok: "Ein Baum hat Wurzeln und Äste.", no: "Ein Baum geht abends spazieren." },
        { ok: "Regen fällt aus den Wolken.", no: "Regen fällt von unten nach oben." },
        { ok: "Ein Berg ist hoch und aus Stein.", no: "Ein Berg ist weich wie ein Kissen." },
        { ok: "Der Wind bewegt die Blätter.", no: "Der Wind kitzelt die Fische im Meer." },
        { ok: "Ein Fluss fließt ins Meer.", no: "Ein Fluss fließt den Berg hinauf." },
        { ok: "Sterne funkeln in der Nacht.", no: "Sterne kann man mit dem Kescher fangen." },
        { ok: "Ein Regenbogen hat viele Farben.", no: "Ein Regenbogen schmeckt nach Erdbeere." },
      ] },
    ],
  },
};

// How many items a language holds — the length of its box digit string (§14.5).
export function itemCount(lang = "de") {
  return CONTENT[lang].packs.reduce((n, p) => n + p.items.length, 0);
}
