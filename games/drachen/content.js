// Drachengeschichten content (§21) — German only, like lesen's (§14.6): the UI
// chrome is bilingual, the stories are not. A story is a work, not a category;
// translating its title would promise an English story that does not exist.
//
// APPEND-ONLY, twice over:
//   • A story's position within its difficulty is its slot in that difficulty's
//     ending-mask string in localStorage. Reordering or removing a story shifts
//     every child's found endings onto the wrong story.
//   • A node's `end` value (0, 1, 2) is its BIT in that mask. Renumbering an
//     ending makes a child's collection wrong.
// Node `id`s are free — they live only in the round mirror, which is per tab.
//
// THE TILE COUNT IS FROZEN AT THREE PER DIFFICULTY. It is the denominator of
// MAX_POINTS.drachen, which regionState/starBadgeTier/pave() measure a child's
// progress against: adding a fourth story would demote a child who had already
// mastered the cave, and her cobbled road would turn back into a dirt track.
// (`depth` is NOT frozen — a story may grow longer without touching a star.)
//
// ── WHAT THESE ARE ─────────────────────────────────────────────────────────
//
// Text adventures. THE PLACE IS THE PUZZLE: she arrives somewhere real, finds a
// way in, finds something worth having, and something is pressing — water
// coming back, ice working, a mountain settling, a sleeper who must not wake.
// There is real tension, and there are no jokes.
//
// The first draft of this file was whimsy — washing clouds, a book that writes
// back, a dragon with a toothache — and it failed for one reason worth writing
// down: **an idea is not an adventure.** Nothing was at stake, nothing was
// hidden, and there was no reason to read the next scene. Whatever is added
// here later has to answer three questions on its first screen: where am I,
// what do I want, and what is running out?
//
// ── THE SHAPE, AND WHY IT IS ALWAYS THE SAME ────────────────────────────────
//
// Every story is the same layered graph: a start scene, then layers of three
// scenes, then three endings — and every path from the start to an ending has
// the same number of scenes (`depth`). That is what lets the round's scene draw
// a fixed path, so the fox reaches the basket exactly as the ending appears.
//
// The three scenes of a layer are three COLUMNS, and a column is a WAY THROUGH
// THE PLACE:
//
//     a = VOR       — deeper, forward, straight at the thing she came for
//     b = VERSTEHEN — the marks, the log, the tally, the voice: what happened here
//     c = UMWEG     — the side passage, the tool, the way round the back
//
// Every scene offers exactly two choices, ALWAYS in this order:
//     1st choice — stay in this column
//     2nd choice — step one column onward (a→b, b→c, c→a)
// so the ending she reaches is simply the column she comes out on:
//
//     a → ending 0 — she gets what she came for
//     b → ending 1 — she comes out with the truth, or with whoever was in there
//     c → ending 2 — she finds another way out, and something nobody was after
//
// All three are real, and none is a joke or a failure.
// tests/drachen-content.test.js pins this skeleton for every story, which is
// also what PROVES the no-lock-out rule: all three endings stay reachable until
// the last choice, and each last scene still offers two of them.
//
// THE RULE THAT MAKES IT READ. A scene can be walked into from two different
// earlier scenes, so **a scene may only mention what is true on every path into
// it.** It describes its own situation and never refers back to a particular
// earlier action, a place she might not have been, or an object she might not
// have picked up. Every scene reads fine on its own; only the JOIN between two
// of them can be nonsense, and no test can catch that — read the joins with
// `node tools/read-story.js` and check every one.
//
// ── WHY ONE READS ON ───────────────────────────────────────────────────────
//
// The second draft had good places and no pull, and the reason is worth the
// space, because the rule right above is what caused it: if a scene may not
// mention anything she did, then nothing she does can have a consequence — and
// a reader feels that immediately. Nothing carries over, so nothing matters.
// Five rules buy the pull back without breaking coherence:
//
//   1. SHE WANTS SOMETHING, AND IT IS HERS. Scene one is not "here is a place".
//      It is "this is mine, and it is about to be gone": a grandfather who never
//      came out, a family name on a wreck, a dead great-aunt's last sentence.
//      A place with no claim on her is a place she can walk away from.
//   2. EVERYTHING SHE CARRIES IS HANDED TO HER IN SCENE ONE. The lamp, the
//      lantern, the chalk. Then any later scene may use it without knowing
//      which way she came.
//   3. THE CLOCK TICKS BY DEPTH, NOT BY PATH. Blasting at six: layer 3 a motor
//      starts outside, layer 4 the drill, layer 5 the siren. The pressure is a
//      function of the LAYER, so it is identical on every path — it escalates
//      and the coherence rule still holds. This is the trick that makes the two
//      compatible; without it a story can only mention its clock once, and a
//      clock mentioned once is forgotten by the next screen.
//   4. EVERY SCENE IS AN EVENT, NOT A VIEW. Something changes in it: the
//      knocking goes from three to four, a crack opens that was not there, her
//      own name is on the wall. "Der Gang wird enger" is a photograph. Eighteen
//      photographs are not a story.
//   5. A CHOICE COSTS SOMETHING. "Die Lampe kleiner drehen" — see less, be seen
//      less. "Weitergehen / stehen bleiben" is not a choice, it is a menu.
//   6. A CHOICE MAY ONLY NAME WHAT ITS OWN SCENE SHOWS. This is the coherence
//      rule again, and it is the one that keeps being forgotten, because a
//      choice is WRITTEN by someone who knows where it leads and READ by a child
//      who only knows where she stands. The mine's door scene once offered "Die
//      Tür lassen und dem Wasser folgen" — and on that path no water had ever
//      appeared. "Welchem Wasser?" So: the second choice of a scene, the one
//      that steps into another column, is phrased as a DIRECTION or an ACTION,
//      never as the name of the place it leads to. German makes the slip
//      machine-checkable — a definite article before a noun claims the noun is
//      known — and tests/drachen-content.test.js checks exactly that.
//
// And one question is planted in scene one and answered only in the endings.
//
// EDITORIAL RULES, none of them machine-checkable:
//   • Real danger, always coming out well. The dark, a roof that settles, water
//     that rises, a sleeper who must not wake. Nothing ever attacks her and
//     nothing is ever lost — §8's "no losing" is about the GAME, and it holds:
//     no ending is a failure and no choice costs a star. Tension inside the
//     prose is not the same thing, and an eight-year-old who reads dragon books
//     can take it.
//   • The dragon is a creature with weight, not comic relief. It may be old,
//     asleep, frightened, blind or enormous. It is never silly.
//   • The three endings must be tellable apart from their names alone, or the
//     "???" on the summary's ending strip is no tease at all — and each must
//     answer the question scene one asked.
//   • Choices are ACTIONS she takes ("Den Balken wegschieben"), never opinions
//     about herself ("Sei mutig").
//   • The scene emoji sets the scene; it never gives away which ending is
//     coming (§14.2).
//   • She is "du". She is the one in the story, not a character she watches.

export const STORIES = {
  de: [
    // ---- Leicht: seven scenes. Clock: layer 3 · layer 4 · layer 5 ---------
    {
      key: "stollen",
      diff: 0,
      depth: 7,
      e: "⛏️",
      title: "Der Stollen",
      nodes: [
        { id: "s0", e: "⛏️", t: "Morgen um sechs sprengen sie den Hang. Seit drei Nächten klopft es aus dem alten Stollen: drei kurze, Pause, drei kurze. So klopfte Großvater, bevor er nicht mehr herauskam. Du nimmst seine Lampe.", c: [
          { a: "Zum Stollen hinauf", to: "a1" },
          { a: "Erst in Großvaters Schuppen", to: "b1" },
        ] },
        { id: "a1", e: "🪵", t: "Der Eingang ist vernagelt, aber die Bretter sind morsch. Sie splittern, und die kalte Luft schlägt dir die Lampe fast aus. Drinnen liegt Staub auf allem — bis auf einen Streifen in der Mitte.", c: [
          { a: "Dem Streifen nach", to: "a2" },
          { a: "Die Lampe kleiner drehen", to: "b2" },
        ] },
        { id: "b1", e: "🔦", t: "Hier hing die Lampe. Daneben ein zweiter Haken, leer. Und an der Wand, mit Kreide: drei Striche, Pause, drei Striche. Die Kreide staubt noch.", c: [
          { a: "Zum Stollen und hinein", to: "b2" },
          { a: "Fragen, wer heute Kreide gekauft hat", to: "c2" },
        ] },
        { id: "a2", e: "👟", t: "Der Streifen führt tiefer. Auf halbem Weg liegt ein Schuh, ausgetreten und viel zu klein für einen Bergmann. Daneben ein Pfeil, in den Staub gemalt. Er zeigt nach vorn.", c: [
          { a: "Dem Pfeil nach", to: "a3" },
          { a: "Selbst einen Pfeil zurückmalen", to: "b3" },
        ] },
        { id: "b2", e: "🌑", t: "Mit halbem Licht siehst du weniger — und merkst mehr. Weit vorn, wo der Gang biegt, liegt ein Schimmer auf dem Wasser. Der kommt nicht von deiner Lampe.", c: [
          { a: "Auf den Schimmer zu", to: "b3" },
          { a: "Warten, ob er sich bewegt", to: "c3" },
        ] },
        { id: "c2", e: "🪨", t: "„Kreide? Heute früh“, sagt der Krämer. „So ein kleiner Kerl, ganz dreckig. Hat mit dem hier bezahlt.“ Er legt es auf den Tresen: eine Schuppe, grün. Und sie ist warm.", c: [
          { a: "Die Schuppe mitnehmen", to: "c3" },
          { a: "Damit sofort zum Stollen", to: "a3" },
        ] },
        { id: "a3", e: "🔊", t: "Der Gang knickt nach unten. Von da kommt das Klopfen so nah, dass der Fels es an deine Hand weitergibt. Drei kurze. Pause. Drei kurze. Und dann, zum ersten Mal: vier.", c: [
          { a: "Vier zurückklopfen", to: "a4" },
          { a: "Erst hinunterleuchten", to: "b4" },
        ] },
        { id: "b3", e: "💧", t: "Der Schimmer bewegt sich nicht. Es ist Wasser, und darin steht ein Grubenlicht, brennend, auf einem Stein. Jemand hat es hingestellt, damit man es sieht.", c: [
          { a: "Es aufheben", to: "b4" },
          { a: "Nachsehen, wer es hingestellt hat", to: "c4" },
        ] },
        { id: "c3", e: "🚜", t: "Ein Motor springt an, dann noch einer. Der Berg gibt das Brummen weiter, bis in die letzte Ecke. Sie fangen früher an als angeschlagen.", c: [
          { a: "Schneller weiter", to: "c4" },
          { a: "Tiefer, solange es noch geht", to: "a4" },
        ] },
        { id: "a4", e: "🚪", t: "Der Gang endet an einer Tür aus Bohlen, von innen verriegelt. Über dir setzt ein Bohrer ein, und der Staub rieselt in Fäden. Dann klopft es gegen die Tür. Einmal, ganz schwer.", c: [
          { a: "Den Riegel aufbrechen", to: "a5" },
          { a: "Die Tür lassen und weiter bergab", to: "b5" },
        ] },
        { id: "b4", e: "✍️", t: "Im Licht liegt ein Stein, und darauf steht ein Name in Kreide. Es ist deiner. Darunter, kleiner: „Sie kommt. Sag ihr nichts vom Wasser.“ Über dir setzt ein Bohrer ein.", c: [
          { a: "Nach dem Wasser sehen", to: "b5" },
          { a: "Nach oben leuchten", to: "c5" },
        ] },
        { id: "c4", e: "🕳️", t: "Über dir bohrt jetzt etwas. Der Staub rieselt in Fäden, und die Fäden zittern im Takt. Neben dir öffnet sich ein Riss im Fels, der vorhin noch nicht da war.", c: [
          { a: "In den Riss", to: "c5" },
          { a: "Zurück, wo der Gang breiter war", to: "a5" },
        ] },
        { id: "a5", e: "🔧", t: "Der Riegel sitzt, aber das Holz ist morsch. Draußen heult die Sirene: fünf Minuten. Hinter der Tür atmet jemand, schnell und flach, wie einer, der Angst hat.", c: [
          { a: "Aufbrechen", to: "e0" },
          { a: "Sagen, wer du bist", to: "e1" },
        ] },
        { id: "b5", e: "🌊", t: "Das Wasser steht höher als vorhin, und darin liegt ein zweiter Schuh. Dahinter ein Loch in der Wand, gerade groß genug für jemanden, der klein ist. Draußen heult die Sirene.", c: [
          { a: "Hineinrufen", to: "e1" },
          { a: "Hineinkriechen", to: "e2" },
        ] },
        { id: "c5", e: "🌫️", t: "Über dir geht ein Riss schräg nach oben. Ganz oben ist ein Fleck, der heller wird. Draußen heult die Sirene. Fünf Minuten, und du stehst unter der Sprengung.", c: [
          { a: "Nach oben", to: "e2" },
          { a: "Zurück zur Tür", to: "e0" },
        ] },
        { id: "e0", e: "🔑", end: 0, name: "Hinter der Tür", t: "Der Riegel bricht zwei Minuten vor der Sprengung. Dahinter kauert ein junger Drache, grün und dreckig. An der Klaue trägt er einen viel zu kleinen Schuh. Hinter ihm liegt der verschüttete Gang, an dem sechzig Jahre lang gegraben wurde. Von beiden Seiten." },
        { id: "e1", e: "🐉", end: 1, name: "Wer da klopft", t: "„Ich heiße Nell“, rufst du durch die Tür. Es wird still. Dann kommt eine Stimme, ganz langsam, in einer Sprache, die sie von Menschen hat. „Dann bist du seine.“ Der Klopfer ist kein Bergmann. Er hat sechzig Jahre gewartet, dass wieder einer antwortet." },
        { id: "e2", e: "🌄", end: 2, name: "Der zweite Eingang", t: "Der enge Weg führt schräg nach oben. Du kommst über dem Steinbruch heraus, als die Sirene abbricht. Von hier siehst du, was von unten keiner sieht. Ein zweiter Stolleneingang, offen, mit frischen Spuren. Du hast genau so viel Vorsprung, wie du brauchst." },
      ],
    },
    {
      key: "wrack",
      diff: 0,
      depth: 7,
      e: "🚢",
      title: "Das Wrack im Watt",
      nodes: [
        { id: "s0", e: "🌊", t: "Auf dem Rumpf steht euer Name. Die SEEMÖWE gehörte deiner Großmutter, und sie kam als Einzige zurück. Heute liegt das Wrack drei Stunden trocken. Sie gibt dir ihre Laterne und sagt nichts.", c: [
          { a: "Sofort hinaus zum Wrack", to: "a1" },
          { a: "Großmutter noch einmal fragen", to: "b1" },
        ] },
        { id: "a1", e: "🪜", t: "Im Schlick bleibt ein Schuh stecken, und du lässt ihn stecken. An der Bordwand hängt eine Strickleiter. Als du sie anfasst, reißt oben eine Sprosse ab und fällt in den Schlick.", c: [
          { a: "Trotzdem hinauf", to: "a2" },
          { a: "Erst am Rumpf entlang", to: "b2" },
        ] },
        { id: "b1", e: "🚪", t: "Sie sieht nicht auf. „Geh nicht unter Deck“, sagt sie. Und als du schon an der Tür bist, noch einmal, viel leiser: „Die siebte Kiste. Lass sie liegen.“", c: [
          { a: "Trotzdem hinaus zum Wrack", to: "b2" },
          { a: "Im Dorf nach der siebten Kiste fragen", to: "c2" },
        ] },
        { id: "a2", e: "🛞", t: "Auf dem Deck hat der Schlick eine Luke halb freigelegt. Ein Balken liegt darauf, mit einem Tau festgezurrt. Der Knoten sitzt außen. Von innen kann das keiner gemacht haben.", c: [
          { a: "Das Tau lösen", to: "a3" },
          { a: "Die Kreidestriche daneben lesen", to: "b3" },
        ] },
        { id: "b2", e: "⚓", t: "Am Rumpf steht euer Name. Darunter hat jemand mit dem Messer eine Zahl ins Holz geritzt. Eine Sieben. Das Holz in der Kerbe ist noch hell.", c: [
          { a: "An Deck", to: "b3" },
          { a: "Am Rumpf entlang nach achtern", to: "c3" },
        ] },
        { id: "c2", e: "🧓", t: "„Die siebte?“ Der alte Fischer wird schmal um die Augen. „Die haben sie nie gelöscht. Und deine Großmutter ist allein zurückgerudert. Mit leeren Händen.“ Pause. „Angeblich.“", c: [
          { a: "Hinaus und achtern nachsehen", to: "c3" },
          { a: "Hinaus zum Wrack", to: "a3" },
        ] },
        { id: "a3", e: "🪤", t: "Die Luke steht offen, und in demselben Moment füllt sich draußen der erste Priel. Man hört es durch den Rumpf: ein Ziehen, wie wenn jemand tief Luft holt.", c: [
          { a: "Hinunter", to: "a4" },
          { a: "Erst hinunterhorchen", to: "b4" },
        ] },
        { id: "b3", e: "✏️", t: "Neben der Luke stehen Kreidestriche in Fünfergruppen. Achtzehn. Jemand hat sie gestrichen und daneben geschrieben: „siebzehn“. Zweimal nachgezogen.", c: [
          { a: "Nachzählen", to: "b4" },
          { a: "Nach achtern gehen", to: "c4" },
        ] },
        { id: "c3", e: "💧", t: "Achtern läuft ein Priel unter dem Rumpf durch, und er läuft schneller als vorhin. In der Strömung dreht sich etwas Helles einmal um sich selbst und verschwindet.", c: [
          { a: "Ihm nach", to: "c4" },
          { a: "Zurück und an Deck", to: "a4" },
        ] },
        { id: "a4", e: "📦", t: "Durch die Luke geht es hinunter. Im Laderaum stehst du bis zu den Knöcheln. Und während du hinschaust, steht es darüber. Ringsum Kisten, alle mit Nummern.", c: [
          { a: "Die Nummern absuchen", to: "a5" },
          { a: "Nach hinten horchen", to: "b5" },
        ] },
        { id: "b4", e: "🔢", t: "Siebzehn Kisten stehen unten in Reihen, und die Reihe hat eine Lücke. Genau dort, wo die siebte stehen müsste, ist der Boden trocken. Als hätte bis eben etwas darauf gestanden.", c: [
          { a: "Zu der Lücke hinunter", to: "b5" },
          { a: "Nach achtern, wo es zieht", to: "c5" },
        ] },
        { id: "c4", e: "🐟", t: "Im Priel schiebt sich etwas gegen die Strömung. Grau, geschuppt, so lang wie dein Arm. Es hält an, dreht den Kopf zu dir — und wartet.", c: [
          { a: "Ihm folgen", to: "c5" },
          { a: "Zurück an Bord und hinunter", to: "a5" },
        ] },
        { id: "a5", e: "🧭", t: "Die siebte Kiste steht ganz hinten, offen und leer bis auf ein Bündel Öltuch. Darin ein Kompass, und seine Nadel zeigt nicht nach Norden. Vom Ufer bläst das Horn.", c: [
          { a: "Den Kompass mitnehmen", to: "e0" },
          { a: "Der Nadel folgen", to: "e1" },
        ] },
        { id: "b5", e: "🕯️", t: "Auf dem trockenen Fleck liegt eine Decke, ein Napf, ein Häufchen Schuppen. Und ein Schuh, klein wie ein Kinderschuh. Vom Ufer bläst das Horn.", c: [
          { a: "Rufen", to: "e1" },
          { a: "Der Spur nach hinten folgen", to: "e2" },
        ] },
        { id: "c5", e: "🏝️", t: "Der Priel mündet unter einer Sandbank, und auf der Bank steht eine Kiste. Nur eine. Vom Ufer bläst das Horn, und das Wasser geht dir schon bis zu den Waden.", c: [
          { a: "Zur Sandbank", to: "e2" },
          { a: "Zurück zur siebten Kiste", to: "e0" },
        ] },
        { id: "e0", e: "🧭", end: 0, name: "Der Kompass des Kapitäns", t: "Du bist an Land, bevor der Priel zugeht. Die Nadel dreht sich und zeigt aufs Watt zurück. Großmutter nimmt sie in die Hand. Endlich sagt sie einen Satz: „Wir haben da nichts verloren. Wir haben was dagelassen.“" },
        { id: "e1", e: "🐉", end: 1, name: "Der blinde Passagier", t: "Aus dem Dunkel kommt er, grau wie Schlick und kaum größer als ein Hund. An der Vorderklaue: ein Kinderschuh. Er wartet an der Luke, bis du nachkommst. Großmutter erkennt ihn sofort und setzt sich hin." },
        { id: "e2", e: "🐚", end: 2, name: "Die siebte Kiste", t: "Auf der Sandbank steht sie, die nie gelöscht wurde. Voller Bernstein, und obenauf eine Schuppe, groß wie eine Hand. Hierher führt kein Weg außer dem Priel. Deine Großmutter kannte ihn." },
      ],
    },
    {
      key: "kammer",
      diff: 0,
      depth: 7,
      e: "🏰",
      title: "Die Kammer",
      nodes: [
        { id: "s0", e: "🏰", t: "Nächste Woche reißen sie den Turm ab. Großtante Wilma wohnte darin. Ihr letzter Satz war: „Das Zimmer, das es nicht gibt, muss offen bleiben.“ Von außen hat der Turm fünf Fenster, von innen vier.", c: [
          { a: "Mit Wilmas Schlüssel hinein", to: "a1" },
          { a: "Erst von unten die Fenster zählen", to: "b1" },
        ] },
        { id: "a1", e: "🧱", t: "Im zweiten Stock steht eine Wand, wo keine hingehört. Der Putz ist heller als sonst überall. Und als du dagegen tippst, rieselt er dir schon in die Hand.", c: [
          { a: "Weiter aufkratzen", to: "a2" },
          { a: "Erst ringsum abklopfen", to: "b2" },
        ] },
        { id: "b1", e: "🪟", t: "Vier Fenster stehen in einer Reihe. Das fünfte sitzt schief dazwischen. Und während du zählst, geht dahinter etwas vorbei. Kurz, dunkel. Dann ist es wieder still.", c: [
          { a: "Hinauf und die Wand suchen", to: "b2" },
          { a: "Am Efeu hinaufklettern", to: "c2" },
        ] },
        { id: "a2", e: "🔨", t: "Unter dem Putz kommt Holz zum Vorschein. Eine Tür, zugenagelt mit Nägeln, die jemand krumm geschlagen hat. In Eile.", c: [
          { a: "Die Nägel herausziehen", to: "a3" },
          { a: "Unten nach alten Papieren suchen", to: "b3" },
        ] },
        { id: "b2", e: "📐", t: "Es klingt überall gleich — bis auf eine Stelle in Kopfhöhe. Da klingt es nicht hohl, sondern dumpf. Als läge etwas dicht dahinter. Etwas Weiches.", c: [
          { a: "An dieser Stelle aufkratzen", to: "b3" },
          { a: "Nach draußen und außen hinauf", to: "c3" },
        ] },
        { id: "c2", e: "🌿", t: "Der Efeu hält. Auf halber Höhe kommst du an dem schiefen Fenster vorbei. Es ist zugemauert, bis auf einen Spalt oben. Aus dem Spalt kommt Wärme.", c: [
          { a: "Durch den Spalt schauen", to: "c3" },
          { a: "Doch drinnen weitersuchen", to: "a3" },
        ] },
        { id: "a3", e: "⚙️", t: "Die Nägel geben nach, einer nach dem anderen. Draußen fährt ein Bagger auf den Hof und stellt den Motor ab. Männer steigen aus und schauen am Turm hoch.", c: [
          { a: "Weitermachen", to: "a4" },
          { a: "Zurück und Wilmas Papiere lesen", to: "b4" },
        ] },
        { id: "b3", e: "🖋️", t: "Auf dem alten Plan sind fünf Zimmer, und über eines hat jemand ein Kreuz gemacht. Daneben, in Wilmas Schrift: „Zugemacht. Nicht heizen. Sie schläft.“ Draußen fährt ein Bagger auf den Hof.", c: [
          { a: "Wilmas Schrift weiterlesen", to: "b4" },
          { a: "Von außen nachsehen", to: "c4" },
        ] },
        { id: "c3", e: "🔥", t: "Durch den Spalt siehst du einen runden Raum ohne Tür. In der Mitte liegt ein Stein, groß wie ein Brotlaib, und er glüht. Draußen fährt ein Bagger auf den Hof.", c: [
          { a: "Den losen Stein herausdrücken", to: "c4" },
          { a: "Zurück nach drinnen", to: "a4" },
        ] },
        { id: "a4", e: "🚪", t: "Die Tür geht auf, und dahinter ist kein Zimmer. Ein Kamin: rußig, eng, nach oben und unten offen. Draußen schlägt der erste Hammer gegen die Hofmauer.", c: [
          { a: "In den Kamin steigen", to: "a5" },
          { a: "Erst hineinhorchen", to: "b5" },
        ] },
        { id: "b4", e: "🕰️", t: "„Solange der Stein glüht, ist sie da“, steht auf der Rückseite. „Wer ihn nimmt, muss bleiben.“ Draußen schlägt der erste Hammer gegen die Hofmauer, und der Turm zittert mit.", c: [
          { a: "Nach dem Stein suchen", to: "b5" },
          { a: "Außen am Turm hinauf", to: "c5" },
        ] },
        { id: "c4", e: "🪨", t: "Der lose Stein kippt heraus und schlägt unten auf. Durch das Loch fällt Licht in den runden Raum. An der Wand bewegt sich etwas, das eben noch ein Schatten war.", c: [
          { a: "Hineinklettern", to: "c5" },
          { a: "Zurück nach drinnen", to: "a5" },
        ] },
        { id: "a5", e: "💨", t: "Der Kamin führt in den runden Raum. Der Stein liegt in der Mitte, und die Wärme steht darüber wie über einem Ofen. Draußen rufen sie deinen Namen. Sie wollen anfangen.", c: [
          { a: "Den Stein nehmen", to: "e0" },
          { a: "Zur Wand schauen", to: "e1" },
        ] },
        { id: "b5", e: "🐲", t: "„Zweihundert Jahre“, sagt eine Stimme im Turm, alt und ganz ruhig. „Und Wilma hat immer nachgelegt.“ Eine Pause. „Sie kommt nicht mehr, oder?“ Draußen rufen sie deinen Namen.", c: [
          { a: "Antworten", to: "e1" },
          { a: "Fragen, was über dem Zimmer liegt", to: "e2" },
        ] },
        { id: "c5", e: "🪟", t: "Über dem runden Raum tut sich noch einer auf. Klein, hell, mit einem Fenster nach Osten. Auf dem Plan war er nicht. Draußen rufen sie deinen Namen. Sie wollen anfangen.", c: [
          { a: "Hinaufklettern", to: "e2" },
          { a: "Hinunter in den runden Raum", to: "e0" },
        ] },
        { id: "e0", e: "🔥", end: 0, name: "Der Wärmestein", t: "Der Stein ist warm wie ein Tier. Du trägst ihn hinaus, und der Bagger wartet, bis du durch bist. Zweihundert Jahre hat er gewärmt, was in diesem Turm gewohnt hat. Jetzt steht er bei euch am Fenster, und im Winter kommt das halbe Dorf vorbei." },
        { id: "e1", e: "🐉", end: 1, name: "Die alte Wächterin", t: "An der Wand hängt sie, grau und faltig und kaum größer als ein Hund. „Nein“, sagst du. „Sie kommt nicht mehr.“ Sie ist lange still. Dann klettert sie dir auf die Schulter. Ihr geht zusammen hinaus, bevor der erste Stein fällt." },
        { id: "e2", e: "🪺", end: 2, name: "Das Zimmer über der Kammer", t: "Der kleine Raum ist voller Federn und trockenem Gras: ein Nest, so alt wie der Turm. In der Mitte liegt eine kalte, leere Schale. An der Wand steht ein Strich für jedes Jahr, in dem Wilma nachgelegt hat. Es sind hundert." },
      ],
    },
    // ---- Mittel: nine scenes. Clock: layer 3 · layer 5 · layer 7 ----------
    {
      key: "wasserfall",
      diff: 1,
      depth: 9,
      e: "💦",
      title: "Hinter dem Wasserfall",
      nodes: [
        { id: "s0", e: "💦", t: "Der alte Zeichenschläger ist letzte Woche gestorben. In seiner Werkstatt lag ein Meißel und ein Zettel: „Sie kann nicht sehen. Jemand muss weitermachen.“ Wer „sie“ ist, steht nirgends. Und mittags schwillt der Fall an, dann ist das Sims weg.", c: [
          { a: "Mit dem Meißel auf das Sims", to: "a1" },
          { a: "Erst seine Werkstatt durchsuchen", to: "b1" },
        ] },
        { id: "a1", e: "🪨", t: "Das Wasser trommelt dir auf die Schulter. Nach zwanzig Schritten hört es auf — du stehst in einem Gang, und hinter dir hängt der Fall wie ein Vorhang. Auf dem Boden liegt ein zweiter Meißel, abgebrochen.", c: [
          { a: "In den Gang hinein", to: "a2" },
          { a: "Die Wand hier abtasten", to: "b2" },
        ] },
        { id: "b1", e: "🧰", t: "In der Werkstatt liegen dreißig Meißel, alle stumpf. Und ein Heft, in dem er nachgehalten hat, wie oft er drin war: 412 Striche. Der letzte ist von vorletzter Woche.", c: [
          { a: "Zum Wasserfall aufbrechen", to: "b2" },
          { a: "Im Heft nach dem ersten Strich suchen", to: "c2" },
        ] },
        { id: "a2", e: "🔦", t: "Der Gang steigt an. Der Lärm bleibt zurück, und in der Stille hörst du etwas anderes: ein langsames, tiefes Atmen. Es geht nicht im Takt mit deinem, und das merkt man sofort.", c: [
          { a: "Weitergehen", to: "a3" },
          { a: "Die Wand im Licht ansehen", to: "b3" },
        ] },
        { id: "b2", e: "✒️", t: "Die Wand ist über und über mit Zeichen bedeckt. Keine Schrift — Striche in Gruppen, tief in den Fels geschlagen. Ganz unten, in Kniehöhe, sind die Kanten scharf. Die sind von diesem Jahr.", c: [
          { a: "Den Zeichen nach hinein", to: "b3" },
          { a: "Nach einem zweiten Eingang suchen", to: "c3" },
        ] },
        { id: "c2", e: "📓", t: "Der erste Strich ist siebenundvierzig Jahre alt. Daneben steht ein einziger Satz, den er nie wieder geschrieben hat: „Sie hat mich gehen lassen. Also gehe ich wieder hin.“", c: [
          { a: "Das Heft mitnehmen", to: "c3" },
          { a: "Sofort zum Fall", to: "a3" },
        ] },
        { id: "a3", e: "🌡️", t: "Der Fels wird wärmer, Schritt für Schritt. Und hinter dir wird der Fall lauter — nicht viel, aber hörbar. Die Sonne steht jetzt auf dem Schnee da oben, und das Wasser weiß es schon.", c: [
          { a: "Der glatten Spur nach", to: "a4" },
          { a: "Die Zeichen hier lesen", to: "b4" },
        ] },
        { id: "b3", e: "5️⃣", t: "Die Zeichen laufen mit dir: immer fünf Striche, dann eine Lücke. Und alle paar Meter ein anderes, quer darüber. Hinter dir wird der Fall lauter. Nicht viel, aber hörbar.", c: [
          { a: "Weiterlesen", to: "b4" },
          { a: "Dorthin, wo die Zeichen aufhören", to: "c4" },
        ] },
        { id: "c3", e: "🫧", t: "Unter dem Fall ist ein Loch im Fels, halb unter Wasser, und es zieht kalt daraus. Als du hineinleuchtest, drückt der Fall dir Gischt in den Nacken. Er ist lauter als vorhin.", c: [
          { a: "In das Loch hinein", to: "c4" },
          { a: "Doch auf das Sims und hinein", to: "a4" },
        ] },
        { id: "a4", e: "🕳️", t: "Vor dir öffnet sich eine Halle, so hoch, dass dein Licht die Decke nicht findet. In der Mitte hebt und senkt sich etwas. Bei jedem Atemzug streicht warme Luft über dein Gesicht.", c: [
          { a: "Am Rand entlang", to: "a5" },
          { a: "Am Rand entlang den Zeichen nach", to: "b5" },
        ] },
        { id: "b4", e: "📏", t: "Die Zeichen zählen keine Tage, sondern Schritte: alle fünf Striche eines für „Biegung“, „Wasser“, „Loch im Boden“. Das ist ein Wegweiser für jemanden, der nichts sieht.", c: [
          { a: "Dem Wegweiser folgen", to: "b5" },
          { a: "Nachsehen, wo er anfängt", to: "c5" },
        ] },
        { id: "c4", e: "🌊", t: "Der Wasserlauf drückt dich vorwärts und wird dabei kräftiger. Nach ein paar Metern kannst du stehen: eine Rinne im Fels, glatt wie eine Rutsche, und sie fällt in die Tiefe.", c: [
          { a: "Der Rinne folgen", to: "c5" },
          { a: "Hinauf zum warmen Gang", to: "a5" },
        ] },
        { id: "a5", e: "🐉", t: "Sie ist so lang wie drei Wagen und liegt auf einem Hügel aus Sand. Die Augen sind offen — beide — und sie sehen nichts. Sie ist blind. Und sie schläft nicht. Draußen dröhnt der Fall.", c: [
          { a: "Ganz leise weitergehen", to: "a6" },
          { a: "Am Rand bleiben und zusehen", to: "b6" },
        ] },
        { id: "b5", e: "🧭", t: "Der Wegweiser führt an drei Löchern vorbei, die du im Dunkeln nie gesehen hättest. Am dritten steht ein Zeichen mehr als sonst, dreimal nachgeschlagen. Draußen dröhnt der Fall.", c: [
          { a: "Dem Wegweiser weiter", to: "b6" },
          { a: "Den Krallenspuren an der Wand nach", to: "c6" },
        ] },
        { id: "c5", e: "❄️", t: "Wo die Zeichen aufhören, fällt der Boden weg. Eine Rinne endet an einem Becken mit stillem Wasser, und auf dem Grund liegt etwas Helles. Über allem dröhnt der Fall, lauter als vorhin.", c: [
          { a: "In das Becken greifen", to: "c6" },
          { a: "Zur großen Halle hinüber", to: "a6" },
        ] },
        { id: "a6", e: "✨", t: "Am hinteren Ende der Halle liegt etwas im Sand, das dein Licht zurückwirft. Nicht gelb wie Gold, in allen Farben zugleich. Zwischen dir und ihm liegt sie, und sie hebt gerade den Kopf.", c: [
          { a: "Am Rand entlang darauf zu", to: "a7" },
          { a: "Zurück in den Gang am Rand", to: "b7" },
        ] },
        { id: "b6", e: "🪶", t: "Der Wegweiser endet an einer Nische: eine Decke, ein Wasserschlauch, ein Stück Kreide. Und ein Zettel, so oft gefaltet, dass er an den Kanten durch ist.", c: [
          { a: "Den Zettel lesen", to: "b7" },
          { a: "Der Wand nach oben folgen", to: "c7" },
        ] },
        { id: "c6", e: "🧗", t: "An der Wand gehen Krallenspuren einen Kamin hinauf, Griff für Griff. Als wären sie für jemanden gemacht, der klettern lernen musste. Unten im Gang läuft jetzt Wasser über den Boden.", c: [
          { a: "Hinaufklettern", to: "c7" },
          { a: "Erst wieder hinunter", to: "a7" },
        ] },
        { id: "a7", e: "🤫", t: "Du bist so nah, dass du die Wärme spürst, die von ihr aufsteigt. Ihr Atem geht in langen Zügen, und dazwischen ist eine Pause, in der man drei Schritte weit kommt. Vier nicht.", c: [
          { a: "In den Pausen weitergehen", to: "e0" },
          { a: "Sie ansprechen", to: "e1" },
        ] },
        { id: "b7", e: "📜", t: "„Wenn du das liest, bist du weit gekommen“, steht da. „Sie ist blind, nicht böse. Die Zeichen sind für sie, nicht für dich. Und sie hört alles.“ Darunter eine Hand, mit Kreide nachgezogen.", c: [
          { a: "Die Hand auf die Wand legen", to: "e1" },
          { a: "Dem Zug nach oben folgen", to: "e2" },
        ] },
        { id: "c7", e: "🏞️", t: "Oben wird der Kamin eng, dann hörst du Vögel. Zwischen zwei Felsplatten fällt Tageslicht herein, und dahinter steht Gras. Über dir liegt der halbe Berg — und trotzdem: Gras.", c: [
          { a: "Dich hinausschieben", to: "e2" },
          { a: "Noch einmal hinunter", to: "e0" },
        ] },
        { id: "e0", e: "💠", end: 0, name: "Der Regenbogenstein", t: "Drei Schritte, warten. Drei Schritte, warten. Dann liegt er in deiner Hand: ein Stein, klar wie Wasser, der jedes Licht in Farben zerlegt. Draußen ist das Sims schon weg, und du musst durch den Fall. Dann hältst du ihn in die Sonne, und der halbe Wald steht in Regenbogen." },
        { id: "e1", e: "🐲", end: 1, name: "Was die Zeichen sagen", t: "„Da bist du ja“, sagt sie, ohne den Kopf zu heben. „Ich höre dich, seit du im Wasser warst.“ Und dann, nach einer langen Pause: „Der Alte kommt nicht mehr, oder?“ Siebenundvierzig Jahre lang hat ein Mensch für sie Wege in den Fels geschlagen. Du schlägst den nächsten." },
        { id: "e2", e: "🌳", end: 2, name: "Die eingeschlossene Wiese", t: "Zwischen den Felsplatten liegt eine Wiese, rundherum von Wänden eingeschlossen. In der Mitte ein Baum, darunter ein Nest aus Gras, so groß wie ein Bett, mit drei kalten Schalen. Hier ist sie geschlüpft, als der Berg noch offen war. Seitdem hat hier niemand gestanden." },
      ],
    },
    {
      key: "karte",
      diff: 1,
      depth: 9,
      e: "🗺️",
      title: "Die halbe Karte",
      nodes: [
        { id: "s0", e: "🗺️", t: "Die Kartenhälfte lag in Großvaters Buch, sauber durchgerissen. Heute Morgen hat ein Junge aus dem Nachbardorf nach der Klosterruine gefragt. Mit einem Papier in der Hand. Er ist eine Stunde vor dir. Und es zieht zu.", c: [
          { a: "Sofort los zur Ruine", to: "a1" },
          { a: "Erst Großvaters Buch durchblättern", to: "b1" },
        ] },
        { id: "a1", e: "🏚️", t: "Vom Kloster steht der Torbogen und ein Stück Mauer. Quer über den Hof führt eine Spur durch das nasse Gras, und sie ist so frisch, dass die Halme sich noch aufrichten.", c: [
          { a: "Der Spur nach", to: "a2" },
          { a: "Den Hof mit der Karte vergleichen", to: "b2" },
        ] },
        { id: "b1", e: "📖", t: "Zwischen den letzten Seiten klebt ein zweiter Zettel, in Großvaters Schrift: „Nie allein hinunter. Und nie bei Regen.“ Draußen fängt es an zu tröpfeln.", c: [
          { a: "Trotzdem los", to: "b2" },
          { a: "Erst ein Seil holen", to: "c2" },
        ] },
        { id: "a2", e: "👣", t: "Die Spur läuft zum Turm, im Bogen zurück und dann schnurstracks auf eine Kellertreppe zu. Vor der Treppe steht sie still: Da hat er lange überlegt. Dann geht sie hinunter.", c: [
          { a: "Ihm nach in den Keller", to: "a3" },
          { a: "Erst den Hof genau abgehen", to: "b3" },
        ] },
        { id: "b2", e: "📐", t: "Der Hof auf deiner Hälfte hat vier Ecken. Der Hof vor dir hat fünf. Die fünfte fehlt auf dem Papier — genau da, wo der Riss durchgeht, und genau da steht auch das Kreuz.", c: [
          { a: "Zur fünften Ecke", to: "b3" },
          { a: "Außen um die Ruine herum", to: "c3" },
        ] },
        { id: "c2", e: "🪢", t: "In der Scheune hängt ein Seil. Daneben klebt ein Zettel in derselben Schrift wie im Buch: „Wenn du das liest, geh nicht allein.“ Er hängt da seit Jahren.", c: [
          { a: "Seil mitnehmen und los", to: "c3" },
          { a: "Ohne Seil, dafür schneller", to: "a3" },
        ] },
        { id: "a3", e: "🪜", t: "Die Kellertreppe ist voller Schutt, aber begehbar. Unten steht Staub in der Luft, aufgewirbelt. Und über dir, oben im Hof, fängt der Regen richtig an: Er trommelt auf die Steine.", c: [
          { a: "In den Gang hinein", to: "a4" },
          { a: "Auf Geräusche warten", to: "b4" },
        ] },
        { id: "b3", e: "🧱", t: "Die fünfte Ecke ist ein niedriger Anbau mit eingefallenem Dach. Unter dem Schutt zeichnet sich etwas Rundes ab: ein Deckel aus Stein. Der Regen fängt richtig an und läuft schon hinein.", c: [
          { a: "Den Deckel freilegen", to: "b4" },
          { a: "Die Mauer außen absuchen", to: "c4" },
        ] },
        { id: "c3", e: "🚴", t: "Hinter der Mauer liegt ein Fahrrad im Brennnesselfeld, und darüber klafft ein Loch in der Mauer. Der Regen fängt richtig an, und durch das Loch zieht es kalt heraus.", c: [
          { a: "Durch das Loch", to: "c4" },
          { a: "Über den Hof und hinunter", to: "a4" },
        ] },
        { id: "a4", e: "🕯️", t: "Am Ende des Gangs brennt eine Kerze auf einem Stein. Daneben ein Rucksack, offen. Und aus der Dunkelheit dahinter kommt ein Kratzen, wie von einem Schuh auf Sand, viel zu schnell.", c: [
          { a: "In die Dunkelheit hinein", to: "a5" },
          { a: "Hinter der Kerze warten", to: "b5" },
        ] },
        { id: "b4", e: "🕳️", t: "Der Deckel gibt nach, und darunter geht es senkrecht hinunter. Von unten kommt kalte Luft und eine Stimme, die mit sich selbst redet. Sie klingt nicht besonders mutig.", c: [
          { a: "Hinunterrufen", to: "b5" },
          { a: "Ringsum weitersuchen", to: "c5" },
        ] },
        { id: "c4", e: "🧤", t: "Hinter dem Loch liegt ein Raum, den der Schutt verschont hat. Ein Handschuh, ein Stück Kreide. Und an der Wand eine Zeichnung: dieselben Linien wie auf deiner Karte, nur ganz.", c: [
          { a: "Die Zeichnung abgehen", to: "c5" },
          { a: "Dem Gang nach unten folgen", to: "a5" },
        ] },
        { id: "a5", e: "😮", t: "Er ist so alt wie du und erschrickt schlimmer. In der Hand ein Papier mit frischer Risskante. Hinter ihm endet der Gang an glatten Steinen — und unter der Tür läuft Wasser durch.", c: [
          { a: "Zur Wand hinüber", to: "a6" },
          { a: "Fragen, woher er seine Hälfte hat", to: "b6" },
        ] },
        { id: "b5", e: "🗣️", t: "Die Stimme verstummt. Dann, vorsichtig: „Bist du oben? Ich komm hier nicht mehr rauf, der Schutt ist nachgerutscht.“ Pause. „Und es läuft Wasser rein.“", c: [
          { a: "Ihm die Hand hinunterreichen", to: "b6" },
          { a: "Nach einem zweiten Zugang suchen", to: "c6" },
        ] },
        { id: "c5", e: "🖍️", t: "Die Zeichnung zeigt, was die Karte verschweigt: Der Keller hat zwei Gänge. Der zweite endet nicht, er läuft unter dem Hof durch und weiter. Über dir gluckert es in den Steinen.", c: [
          { a: "Den zweiten Gang suchen", to: "c6" },
          { a: "In den ersten Gang hinunter", to: "a6" },
        ] },
        { id: "a6", e: "🧩", t: "Die glatten Steine sind kein Mauerrest, sondern eine Tür. In der Mitte eine Vertiefung, rechteckig, genau so groß wie eine ganze Karte. Das Wasser steht dir schon über den Schuhen.", c: [
          { a: "Deine Hälfte hineinlegen", to: "a7" },
          { a: "Ihn um seine Hälfte bitten", to: "b7" },
        ] },
        { id: "b6", e: "🤝", t: "Er setzt sich hin, und dabei fällt ihm die Erschöpfung aus dem Gesicht. „Ich such das seit dem Sommer“, sagt er. „Und ich hab die falsche Hälfte.“ Das Wasser steht über den Schuhen.", c: [
          { a: "Die Hälften nebeneinanderlegen", to: "b7" },
          { a: "Ihn nach dem zweiten Gang fragen", to: "c7" },
        ] },
        { id: "c6", e: "🚇", t: "Der zweite Gang ist niedrig und trocken und läuft schnurgerade. Nach fünfzig Schritten ist über dir kein Kloster mehr, sondern Wurzelwerk. Hinter dir hörst du das Wasser kommen.", c: [
          { a: "Bis zum Ende gehen", to: "c7" },
          { a: "Umkehren zur steinernen Tür", to: "a7" },
        ] },
        { id: "a7", e: "🚪", t: "Deine Hälfte passt in die Vertiefung wie ein Deckel in einen Topf — aber nur halb. Die andere Hälfte bleibt leer, und die Tür rührt sich keinen Millimeter. Das Wasser steigt.", c: [
          { a: "Mit aller Kraft drücken", to: "e0" },
          { a: "Die zweite Hälfte holen", to: "e1" },
        ] },
        { id: "b7", e: "📄", t: "Riss an Riss passen die Hälften zusammen. Erst jetzt ergibt die Zeichnung einen Sinn: Das Kreuz steht nicht auf dem Hof, sondern darunter. Und ein Pfeil zeigt auf die Tür im Keller.", c: [
          { a: "Zusammen hinunter zur Tür", to: "e1" },
          { a: "Dem Pfeil andersherum folgen", to: "e2" },
        ] },
        { id: "c7", e: "🌱", t: "Der Gang endet unter einer Steinplatte, und die Platte lässt sich heben. Du steckst den Kopf heraus: Regen, Wiese, und die Ruine liegt zweihundert Schritte hinter dir.", c: [
          { a: "Nachsehen, was hier oben steht", to: "e2" },
          { a: "Zurück zur steinernen Tür", to: "e0" },
        ] },
        { id: "e0", e: "🏺", end: 0, name: "Die Kammer unter dem Hof", t: "Die Tür gibt einen Finger breit nach, dann eine Hand, dann ganz — und das Wasser läuft mit dir hinein. Dahinter eine Kammer voller Krüge, alle versiegelt und beschriftet. In der letzten Reihe stehen drei, die keinen Wein enthalten, sondern Schuppen. Sortiert nach Farbe." },
        { id: "e1", e: "🤝", end: 1, name: "Die zweite Hälfte", t: "Zu zweit geht die Tür auf, weil zwei Hälften hineinpassen und weil vier Hände drücken. Ihr steht in der Kammer, bis zu den Knien im Wasser, und sagt eine Weile gar nichts. Danach zerreißt ihr die Karte nicht wieder — ihr klebt sie zusammen." },
        { id: "e2", e: "🌳", end: 2, name: "Was die Karte nicht zeigt", t: "Über der Steinplatte steht eine Eiche, älter als das Kloster. In ihrem Stamm klafft eine Höhlung, groß genug für dich. Innen ist sie ausgebrannt, glatt und trocken — und warm. Hier hat lange etwas gewohnt, das Feuer machen kann, und der Regen hat es nie gestört." },
      ],
    },
    {
      key: "gletscher",
      diff: 1,
      depth: 9,
      e: "🧊",
      title: "Der Gletscherspalt",
      nodes: [
        { id: "s0", e: "🧊", t: "Dreißig Meter tief im Spalt leuchtet seit einer Woche etwas Rot. Dein Onkel führt hier seit zwanzig Jahren und sagt „da unten ist nichts“. Jedes Mal ein bisschen zu schnell. Heute ist der wärmste Tag des Jahres, morgen ist der Spalt zu.", c: [
          { a: "Sofort abseilen", to: "a1" },
          { a: "Erst den Rand des Spalts abgehen", to: "b1" },
        ] },
        { id: "a1", e: "🪢", t: "Du legst das Seil um den Felsblock. Die Wände sind blau und glatt, aber alle paar Meter springt eine Kante vor. Als du dich hineinlehnst, knirscht der Block. Nur einmal.", c: [
          { a: "Trotzdem hinunter", to: "a2" },
          { a: "Prüfen, worauf der Block steht", to: "b2" },
        ] },
        { id: "b1", e: "🎒", t: "Fünfzig Schritte weiter läuft der Spalt aus. Im Eis steckt ein Rucksack, eingeschlossen wie eine Fliege im Bernstein. Er ist nicht alt. Und er hat das Zeichen der Bergführer.", c: [
          { a: "Zurück zur breiten Stelle", to: "b2" },
          { a: "Am flachen Ende hineinsteigen", to: "c2" },
        ] },
        { id: "a2", e: "🔵", t: "Zehn Meter tiefer ist das Licht blau und der Lärm weg. Es tropft. Überall tropft es — und vor einer Woche, sagt dein Onkel, hat es hier oben noch gefroren.", c: [
          { a: "Weiter hinunter", to: "a3" },
          { a: "Stehen bleiben und horchen", to: "b3" },
        ] },
        { id: "b2", e: "🪨", t: "Der Felsblock steht nicht auf Fels. Er steht auf blankem Eis, und rundherum hat das Schmelzwasser eine Rinne gezogen, fingertief. Heute Morgen war sie das noch nicht.", c: [
          { a: "Trotzdem hinunterklettern", to: "b3" },
          { a: "Einen sichereren Weg suchen", to: "c3" },
        ] },
        { id: "c2", e: "🚪", t: "Am flachen Ende kommst du ohne Seil hinein. Nach ein paar Metern wird der Spalt zum Tunnel — und der Tunnel ist rund. Nicht gerissen. Geschmolzen, von etwas Warmem.", c: [
          { a: "In den Tunnel", to: "c3" },
          { a: "Doch am Seil in den Spalt", to: "a3" },
        ] },
        { id: "a3", e: "📉", t: "Zwanzig Meter. Das Rote ist näher und größer, als es von oben aussah — keine Fläche, eher eine Wand. Über dir löst sich Wasser aus der Kante und fällt an dir vorbei. Es tropft nicht mehr. Es läuft.", c: [
          { a: "Die letzten Meter hinunter", to: "a4" },
          { a: "Die Eiswand vor dir ansehen", to: "b4" },
        ] },
        { id: "b3", e: "👂", t: "Das Eis knackt in Wellen: erst weit weg, dann näher, dann direkt neben deinem Ohr. Und über dir läuft jetzt Wasser über die Kante, wo vorhin nur Tropfen hingen.", c: [
          { a: "Zwischen den Wellen weiter", to: "b4" },
          { a: "Quer hinüber, wo es warm zieht", to: "c4" },
        ] },
        { id: "c3", e: "🫧", t: "Der Tunnel führt schräg nach unten. Im Eis stecken Luftblasen in langen Ketten, und dazwischen etwas Dunkles, Langes. Von oben läuft Wasser herein und sucht sich denselben Weg.", c: [
          { a: "Der dunklen Kante folgen", to: "c4" },
          { a: "Quer hinüber zum Spalt", to: "a4" },
        ] },
        { id: "a4", e: "🔴", t: "Unten stehst du auf Geröll, und die Wand vor dir ist nicht blau, sondern rot. Es ist kein Stein. Es sind Schuppen, eine neben der anderen, jede so groß wie dein Kopf.", c: [
          { a: "Die Wand entlanggehen", to: "a5" },
          { a: "Die Eiswand daneben absuchen", to: "b5" },
        ] },
        { id: "b4", e: "🧣", t: "In der Eiswand steckt der Rucksack aus der Nähe. Daneben, tiefer drin: ein Ärmel, ein Handschuh — und eine Hand darin, die ein Stück Kreide hält. Sie liegt seit vielen Jahren so.", c: [
          { a: "Die Kreidezeichen suchen", to: "b5" },
          { a: "Dem geschmolzenen Tunnel folgen", to: "c5" },
        ] },
        { id: "c4", e: "🦴", t: "Die dunkle Kante ist ein Rückgrat, und es hört nicht auf. Zwanzig Schritte gehst du daran entlang, und es geht weiter. Hinter dir löst sich ein Eisblock und schlägt unten auf.", c: [
          { a: "Bis zum Ende gehen", to: "c5" },
          { a: "Zur roten Wand hinüber", to: "a5" },
        ] },
        { id: "a5", e: "🫀", t: "Du legst die Hand auf die Schuppen. Sie sind nicht kalt. Und alle paar Sekunden hebt sich die Wand einen Fingerbreit und senkt sich wieder. Das hier atmet. Sehr, sehr langsam.", c: [
          { a: "Der Wand nach oben folgen", to: "a6" },
          { a: "An der Wand daneben nachsehen", to: "b6" },
        ] },
        { id: "b5", e: "✍️", t: "An der Eiswand steht eine Reihe Kreidezeichen, halb verwischt: Zahlen, Tiefen. Und ganz am Ende ein einziges Wort, groß und dreimal nachgezogen. „Lebt.“", c: [
          { a: "Nachsehen, worauf das Wort zeigt", to: "b6" },
          { a: "Dorthin, wo es warm zieht", to: "c6" },
        ] },
        { id: "c5", e: "💨", t: "Der Tunnel wird zu einer Höhle, und in der Höhle ist es warm. Aus einer Öffnung im Eis strömt Luft, so warm wie Atem — weil es Atem ist. Draußen kracht etwas Großes und rutscht.", c: [
          { a: "In die warme Öffnung", to: "c6" },
          { a: "Zurück an der roten Wand hinauf", to: "a6" },
        ] },
        { id: "a6", e: "🧗", t: "Die Wand aus Schuppen steigt an, und du steigst mit. Der Spalt wird enger — merklich enger als vorhin. Vor dir liegt etwas Rundes und Glattes im Eis, groß wie ein Wagenrad.", c: [
          { a: "Den Schnee davon wegräumen", to: "a7" },
          { a: "Von hier aus rufen", to: "b7" },
        ] },
        { id: "b6", e: "👁️", t: "An der Eiswand schimmert etwas Helles. Als dein Licht darauffällt, wird das Schimmern schmaler, dann wieder breiter. Es ist ein Lid.", c: [
          { a: "Ihr Guten Tag sagen", to: "b7" },
          { a: "Zur warmen Öffnung", to: "c7" },
        ] },
        { id: "c6", e: "🌫️", t: "Hinter der Öffnung ist eine Kammer, die sich das Warme selbst geschmolzen hat. Der Boden ist trocken, an den Wänden hängt Raureif in Federn. In der Mitte liegt ein Kreis aus flachem Kies.", c: [
          { a: "Den Kieskreis untersuchen", to: "c7" },
          { a: "Hinauf zur roten Wand", to: "a7" },
        ] },
        { id: "a7", e: "🥁", t: "Unter dem Schnee ist es kein Stein. Es ist ein Auge, geschlossen, groß wie ein Wagenrad. Unter dem Lid bewegt sich etwas hin und her, wie bei einem, der träumt. Der Spalt knirscht.", c: [
          { a: "Mit der flachen Hand daraufklopfen", to: "e0" },
          { a: "Dich davorsetzen und warten", to: "e1" },
        ] },
        { id: "b7", e: "🗣️", t: "Deine Stimme kommt vom Eis dreifach zurück. Dann verschiebt sich tief unter dir etwas so Großes, dass die Wand knirscht — und das Lid im Eis geht einen Spalt auf.", c: [
          { a: "Sitzen bleiben und weiterreden", to: "e1" },
          { a: "Zurückweichen, wo es warm war", to: "e2" },
        ] },
        { id: "c7", e: "⭕", t: "In der warmen Kammer liegt ein Kreis aus flachem Kies, gelegt Stein für Stein, in drei Ringen. In der Mitte eine Mulde, in der der Kies angeschmolzen und wieder erstarrt ist.", c: [
          { a: "In die Mulde greifen", to: "e2" },
          { a: "Hinauf an der roten Wand", to: "e0" },
        ] },
        { id: "e0", e: "☄️", end: 0, name: "Das rote Auge", t: "Beim dritten Klopfen geht das Lid auf. Ein Auge so groß wie ein Wagenrad sieht dich an: ruhig, uralt, gar nicht überrascht. Dann schließt es sich wieder. Am Abend rutscht der ganze Gletscher zehn Meter talwärts, und dein Onkel sagt kein Wort — aber er sieht dich an." },
        { id: "e1", e: "🐉", end: 1, name: "Der Schläfer im Eis", t: "Du sitzt bis zum Abend da und erzählst, was es oben Neues gibt: zwanzig Jahre in einer Stunde. Als du aufstehst, ist der Spalt eine Handbreit enger. „Komm wieder“, knirscht das Eis. „Dein Onkel kommt seit zwanzig Jahren. Er traut sich nur nie herunter.“" },
        { id: "e2", e: "🥚", end: 2, name: "Der Kieskreis", t: "In der warmen Kammer liegt in der Mitte eine Mulde, und darin Scherben, dünn wie Porzellan und innen perlmuttern. Ein Nest, vom Eis überholt und mitgenommen. Wer hier geschlüpft ist, ist längst irgendwo groß geworden — und ist irgendwann zurückgekommen und liegen geblieben." },
      ],
    },
    // ---- Schwer: eleven scenes. Clock: layer 3 · 5 · 7 · 9 ----------------
    {
      key: "stadt",
      diff: 2,
      depth: 11,
      e: "🌒",
      title: "Die versunkene Stadt",
      nodes: [
        { id: "s0", e: "🌒", t: "Einmal im Jahr fällt der See um zwölf Meter und gibt die Stadt zurück: Gassen, Dächer, den Turm, das große Haus am Markt. Auf der Tafel am Brunnen stehen sieben Namen unter „Geblieben“, und der siebte ist eurer. Deine Mutter redet nicht darüber. Der Fährmann leiht dir sein Boot: „Sechs Stunden.“", c: [
          { a: "Die Hauptgasse hinunter", to: "a1" },
          { a: "Erst zur Tafel am Brunnen", to: "b1" },
        ] },
        { id: "a1", e: "🏚️", t: "Die Gasse ist knöcheltief mit Schlamm gefüllt. In einem Fensterloch hängt ein Laden schief in der Angel, und als du vorbeigehst, schlägt er einmal zu. Von allein. Wind ist keiner.", c: [
          { a: "Weiter zum Marktplatz", to: "a2" },
          { a: "In das Haus mit dem Laden", to: "b2" },
        ] },
        { id: "b1", e: "🪧", t: "Sieben Namen. Sechs sind später durchgestrichen worden, jeder mit einem anderen Werkzeug. Eurer nicht. Er steht ganz unten und ist am tiefsten eingeschlagen, als hätte jemand lange daran gearbeitet.", c: [
          { a: "Zum großen Haus am Markt", to: "b2" },
          { a: "Am Ufer entlangschauen", to: "c2" },
        ] },
        { id: "a2", e: "⛲", t: "Der Marktplatz ist eine flache Schüssel aus Schlamm, und quer hindurch führt eine Spur. Keine Fußspur. Eine Schleifspur, breit wie ein Tisch, und sie ist neuer als der Schlamm.", c: [
          { a: "Der Schleifspur folgen", to: "a3" },
          { a: "Zurück in die Gasse", to: "b3" },
        ] },
        { id: "b2", e: "🪟", t: "Im Erdgeschoss steht der Schlamm hoch, aber die Treppe hält. Oben ein Zimmer, trockener als alles hier: Tisch, Stuhl, ein Bett aus Brettern. Auf dem Tisch liegt Kreide, und sie ist nicht nass geworden.", c: [
          { a: "Das Zimmer durchsuchen", to: "b3" },
          { a: "Von oben über die Dächer schauen", to: "c3" },
        ] },
        { id: "c2", e: "⛵", t: "Am Stadtrand liegt ein zweites Boot — nicht gestrandet, festgemacht. Das Tau geht hinauf zu einem Dachbalken und ist so gebunden, dass man es von oben löst. Jemand ankert hier oben, nicht unten.", c: [
          { a: "Das Boot untersuchen", to: "c3" },
          { a: "Über den Markt zum großen Haus", to: "a3" },
        ] },
        { id: "a3", e: "🚪", t: "Die Schleifspur endet an zwei Türflügeln aus Eichenholz, schwarz und schwer wie Stein. Sie sind zu. Und draußen bläst der Fährmann zum ersten Mal ins Horn: die Hälfte der Zeit ist herum.", c: [
          { a: "Ein Fenster daneben suchen", to: "a4" },
          { a: "Die Inschrift über der Tür lesen", to: "b4" },
        ] },
        { id: "b3", e: "✍️", t: "Auf dem Tisch liegt unter der Kreide ein Zettel, und die Schrift ist dieselbe wie auf der Tafel am Brunnen. „Er zählt die Jahre nicht mit“, steht da. Draußen bläst der Fährmann ins Horn.", c: [
          { a: "Weiterlesen", to: "b4" },
          { a: "Von hier aus die Dächer absuchen", to: "c4" },
        ] },
        { id: "c3", e: "🏘️", t: "Von oben sieht man, dass die Stadt nicht aufhört: Weiter draußen, wo das Wasser steht, ragen Schornsteine heraus. Eine zweite Reihe, die auch heute nicht trockenfällt. Draußen bläst der Fährmann ins Horn.", c: [
          { a: "Einen Weg über die Dächer suchen", to: "c4" },
          { a: "Hinunter zum großen Haus", to: "a4" },
        ] },
        { id: "a4", e: "🕯️", t: "Innen hallt es. Der Schlamm reicht dir bis zu den Knöcheln, und darin stehen Bänke in Reihen, alle in dieselbe Richtung — bis auf eine. Die steht quer und ist mit Seilen an einer Säule festgemacht.", c: [
          { a: "Die Treppe nach oben", to: "a5" },
          { a: "Die festgebundene Bank ansehen", to: "b5" },
        ] },
        { id: "b4", e: "📓", t: "„Sechs sind gestorben, und jedes Mal hat einer den Namen durchgestrichen“, steht auf der Rückseite. „Meinen streicht keiner mehr durch. Es ist keiner mehr da.“ Kein Datum, keine Unterschrift.", c: [
          { a: "Nach dem suchen, der das schrieb", to: "b5" },
          { a: "Nach dem Turm der Stadt", to: "c5" },
        ] },
        { id: "c4", e: "🧗", t: "Die Dächer stehen dicht genug, um von einem zum nächsten zu steigen, wenn man sich traut. Ein Ziegel löst sich unter dir und schlägt unten in den Schlamm. Sie führen zum Turm mit dem Glockenstuhl.", c: [
          { a: "Über die Dächer zum Turm", to: "c5" },
          { a: "Hinunter und ins große Haus", to: "a5" },
        ] },
        { id: "a5", e: "🪜", t: "Oben liegt der Staub gleichmäßig — bis auf eine Spur vom Treppenkopf zu einer Tür am Ende des Ganges und zurück. Und während du hinschaust, dreht draußen das Wasser: Man hört es durch die Wände.", c: [
          { a: "Der Spur zur Tür folgen", to: "a6" },
          { a: "Die Zimmer nebenan öffnen", to: "b6" },
        ] },
        { id: "b5", e: "🛏️", t: "Unter der festgebundenen Bank liegt, in Wachstuch gewickelt, ein Buch. Wer hier geschlafen hat, wollte nicht wegschwimmen, wenn das Wasser kommt. Und draußen dreht das Wasser gerade.", c: [
          { a: "Das Buch aufschlagen", to: "b6" },
          { a: "Zum Turm der Stadt hinüber", to: "c6" },
        ] },
        { id: "c5", e: "🔔", t: "Der Turm ist innen hohl. Über dir hängt die Glocke, grün und riesig, und der Klöppel ist mit einem Tuch umwickelt — damit sie nicht läutet, wenn der Wind geht. Draußen dreht das Wasser.", c: [
          { a: "Die Leiter hinauf", to: "c6" },
          { a: "Hinunter zum großen Haus", to: "a6" },
        ] },
        { id: "a6", e: "🗝️", t: "Die Tür am Ende des Ganges ist die einzige mit einem Schloss, und im Schloss steckt kein Schlüssel. Das Holz ist aufgequollen und kracht, wenn man drückt. Dahinter ist es vollkommen still.", c: [
          { a: "Mit der Schulter dagegen", to: "a7" },
          { a: "Im Gang nach dem Schlüssel suchen", to: "b7" },
        ] },
        { id: "b6", e: "🖋️", t: "Die ersten Seiten sind Rechnungen: Säcke, Fässer, Namen. Ab der Mitte ändert sich die Schrift und wird größer. „Sie sind heute los“, steht da. „Alle bis auf uns sieben.“", c: [
          { a: "Ab der Mitte weiterlesen", to: "b7" },
          { a: "Das Buch mitnehmen, zum Turm", to: "c7" },
        ] },
        { id: "c6", e: "🪟", t: "Neben der Glocke steht eine Luke im Turmdach offen. Von hier oben liegt die Stadt unter dir wie ein Plan — und in den unteren Gassen glänzt jetzt Wasser, wo vorhin Schlamm war.", c: [
          { a: "Durch die Luke aufs Dach", to: "c7" },
          { a: "Hinunter und ins große Haus", to: "a7" },
        ] },
        { id: "a7", e: "💥", t: "Beim dritten Mal gibt der Rahmen nach. Dahinter ein langer Saal, ein Tisch in der Mitte, und darauf ein Kasten aus Glas und Messing. Das Glas ist heil. Unten in der Gasse steht schon Wasser.", c: [
          { a: "Zum Kasten", to: "a8" },
          { a: "Erst den Saal absuchen", to: "b8" },
        ] },
        { id: "b7", e: "🐲", t: "„Er liegt unter dem Ratssaal, seit vor der Stadt“, steht auf der nächsten Seite. „Solange er atmet, hält der Damm. Wenn keiner mehr da ist, der ihn im Winter weckt, steigt der See über alles.“", c: [
          { a: "Den Weg unter den Ratssaal suchen", to: "b8" },
          { a: "Hinaus zum Damm", to: "c8" },
        ] },
        { id: "c7", e: "🌅", t: "Auf dem Turmdach steht der Wind. Unter dir die Stadt, weiter draußen die Schornsteine — und dazwischen, das sieht man nur von hier, ein gerader dunkler Strich quer durch den Schlamm. Ein Damm.", c: [
          { a: "Den Strich mit den Augen verfolgen", to: "c8" },
          { a: "Hinunter zum großen Haus", to: "a8" },
        ] },
        { id: "a8", e: "🔒", t: "Im Kasten liegt auf verblasstem Samt ein Reif aus dunklem Gold, ohne Steine. Eingeschlagen ist ein Muster: Schuppen, rundherum. Der Schlüssel steckt außen. Und in der Gasse gurgelt es jetzt.", c: [
          { a: "Aufschließen", to: "a9" },
          { a: "Nachsehen, was unter dem Boden liegt", to: "b9" },
        ] },
        { id: "b8", e: "🕳️", t: "Unter dem Ratssaal gibt es keinen Keller, sondern eine Öffnung im Boden, so groß wie ein Tisch. Darunter ist es nicht schwarz, sondern schwach rot, wie unter einer Aschedecke. In der Gasse gurgelt es.", c: [
          { a: "Hinunterrufen", to: "b9" },
          { a: "Der Wärme nach hinaus", to: "c9" },
        ] },
        { id: "c8", e: "〰️", t: "Der Strich läuft schnurgerade vom Ufer bis zu den Schornsteinen. Kein Fluss macht das. Und kurz vor der zweiten Häuserreihe ist er unterbrochen, als hätte jemand ein Stück herausgenommen. In der Gasse gurgelt es.", c: [
          { a: "Dorthin hinaus", to: "c9" },
          { a: "Zurück ins große Haus", to: "a9" },
        ] },
        { id: "a9", e: "👑", t: "Der Schlüssel dreht sich leicht, das Glas hebt sich, der Reif liegt frei. Er ist schwerer, als Gold sein dürfte, und er ist warm. Draußen läuft das Wasser jetzt in die Gassen, hörbar, von allen Seiten.", c: [
          { a: "Den Reif nehmen und hinaus", to: "e0" },
          { a: "Ihn zurücklegen und darunter nachsehen", to: "e1" },
        ] },
        { id: "b9", e: "🗣️", t: "Aus der Öffnung kommt keine Antwort, nur Wärme — und dann ein Ton, so tief, dass du ihn in den Rippen spürst. Er wiederholt sich zweimal, langsamer. Draußen läuft das Wasser in die Gassen.", c: [
          { a: "Antworten", to: "e1" },
          { a: "Hinaus, solange es noch geht", to: "e2" },
        ] },
        { id: "c9", e: "🧱", t: "Die Lücke im Damm ist kein Schaden. Die Steine liegen ordentlich zur Seite geräumt, und dahinter geht eine Rampe schräg unter das Wasser. Ein Weg für etwas sehr Großes, das trotzdem leise kommen will.", c: [
          { a: "Die Rampe hinunter", to: "e2" },
          { a: "Zurück in die Stadt, das Wasser steigt", to: "e0" },
        ] },
        { id: "e0", e: "👑", end: 0, name: "Der Reif aus dem Ratssaal", t: "Du bist im Boot, als das Wasser die Hauptgasse nimmt. Am Ufer legt der Fährmann den Reif auf die Hand und wird ganz still. „Das ist kein Schmuck“, sagt er. „Das ist ein Halsband, und es ist zu groß für jeden Hals, den ich kenne.“ Deine Mutter sieht es an und setzt sich hin." },
        { id: "e1", e: "📖", end: 1, name: "Warum sie geblieben sind", t: "Du antwortest, und unten wird es still. Dann kommt der Ton noch einmal, und diesmal ist es kein Ton, sondern ein Name — eurer. Sieben Menschen sind hier geblieben, um einmal im Jahr an eine Luke zu klopfen. Sechs sind gestorben. Der siebte wartet noch. Ab jetzt seid ihr zwei." },
        { id: "e2", e: "🌊", end: 2, name: "Die Rampe im Damm", t: "Die Rampe führt unter das Wasser und wieder heraus, in eine Halle, die der Damm trocken hält. Der Boden ist warm und in der Mitte glatt gelegen. Von hier führt eine zweite Rampe hinaus in den See, und darauf, im Schlamm, ein Abdruck — breiter als das Boot, das dich hergebracht hat." },
      ],
    },
    {
      key: "hort",
      diff: 2,
      depth: 11,
      e: "💰",
      title: "Der Hort",
      nodes: [
        { id: "s0", e: "💰", t: "Auf dem Foto am Kaminsims trägt deine Urgroßmutter einen flachen grauen Stein mit einem Loch um den Hals. Der Stein ist seit sechzig Jahren fort. „Er zählt“, sagt der Alte am Feuer, „und ihm fehlt eins.“ Draußen fallen die ersten Flocken. Wenn er fertig zählt, geht er suchen.", c: [
          { a: "Sofort hinein", to: "a1" },
          { a: "Den Alten weiter ausfragen", to: "b1" },
        ] },
        { id: "a1", e: "🕯️", t: "Der Gang ist hoch genug für einen Wagen und glatt wie poliert. Nach der zweiten Biegung wird es hell, und die Helligkeit kommt nicht von Feuer. Aus der Tiefe kommen Zahlen: eine, Pause, die nächste.", c: [
          { a: "Um die Biegung", to: "a2" },
          { a: "Auf dem Boden nachsehen", to: "b2" },
        ] },
        { id: "b1", e: "🧓", t: "„Zweimal ist einer zurückgekommen“, sagt der Alte. „Der eine hatte nichts dabei.“ Er sieht ins Feuer. „Der andere hatte was dabei und hat es wieder hingelegt. Das war eine Frau, und das ist sechzig Jahre her.“", c: [
          { a: "Hinein", to: "b2" },
          { a: "Nach einem zweiten Eingang fragen", to: "c2" },
        ] },
        { id: "a2", e: "🪙", t: "Die Halle ist so groß wie eine Kirche, und der Boden ist kein Boden: Gold, Silber, Kupfer, Glas, meterhoch bis in die Ecken. Mitten darin liegt er wie ein Hügel im Hügel und zählt weiter.", c: [
          { a: "Am Rand entlang", to: "a3" },
          { a: "Die Stücke am Rand ansehen", to: "b3" },
        ] },
        { id: "b2", e: "👣", t: "Der Boden ist glatt gelaufen, aber nicht gleichmäßig: In der Mitte eine breite Rinne, da geht etwas Großes. Am Rand ein schmaler Streifen, eine Schuhbreite. Da ist jemand gegangen, oft.", c: [
          { a: "Auf dem schmalen Streifen weiter", to: "b3" },
          { a: "Nachsehen, wo der Streifen anfängt", to: "c3" },
        ] },
        { id: "c2", e: "🌲", t: "„Hinter dem Wasserfall im Nordhang“, sagt der Alte langsam. „Für ihn ist der zu eng, deshalb schaut er da nie nach.“ Er sieht dich an. „Und deshalb geht da auch sonst keiner rein.“", c: [
          { a: "Zum Nordhang", to: "c3" },
          { a: "Doch den breiten Weg nehmen", to: "a3" },
        ] },
        { id: "a3", e: "😴", t: "Aus der Nähe sieht man die Schuppen einzeln, jede so groß wie ein Wagenrad. Bei jedem Ausatmen klirrt es im ganzen Saal. Und am Eingang, weit hinter dir, liegt jetzt eine dünne weiße Linie: Der Schnee kommt herein.", c: [
          { a: "Weiter am Rand entlang", to: "a4" },
          { a: "Zurück an den Rand", to: "b4" },
        ] },
        { id: "b3", e: "🔢", t: "Die Stücke liegen in Reihen, und auf jedem steht unten eine Zahl. Du drehst drei um: 4471, 4472, 4473. Alles hier ist gezählt. Am Eingang liegt jetzt eine dünne weiße Linie.", c: [
          { a: "Die Reihe entlanggehen", to: "b4" },
          { a: "Nachsehen, wo die Reihe endet", to: "c4" },
        ] },
        { id: "c3", e: "💦", t: "Hinter dem Wasserfall musst du dich seitwärts durch den Spalt schieben. Dahinter ist es trocken, und an der Wand hängt eine Lampe an einem Haken — alt, aber voll Öl. Draußen fällt der Schnee dichter.", c: [
          { a: "Die Lampe nehmen und weiter", to: "c4" },
          { a: "Zum großen Eingang hinüber", to: "a4" },
        ] },
        { id: "a4", e: "🏔️", t: "Du gehst an ihm entlang, und du gehst lange. Sein Rücken ist ein Hügelkamm, sein Schwanz verschwindet in einem Seitengang. Und die Zahlen kommen jetzt schneller. Die Pausen dazwischen werden kürzer.", c: [
          { a: "Bis zum Kopf weitergehen", to: "a5" },
          { a: "An den Rand zurückgehen", to: "b5" },
        ] },
        { id: "b4", e: "📏", t: "Zwischen zwei Reihen liegt ein Brett mit einer Kerbe für jedes Hundert. Ganz am Ende, hinter der letzten, steht eine einzelne Kerbe für sich allein. Und die Zahlen kommen jetzt schneller.", c: [
          { a: "Die einzelne Kerbe untersuchen", to: "b5" },
          { a: "Nachsehen, wohin das Brett zeigt", to: "c5" },
        ] },
        { id: "c4", e: "🔦", t: "Der schmale Gang läuft neben der Halle her, und durch Ritzen fällt ihr Licht herein. Dann steht der Gang voller Sachen: ein Tisch, ein Hocker, Regale — alles klein und für Menschenhände gemacht.", c: [
          { a: "Die Regale ansehen", to: "c5" },
          { a: "Durch eine Ritze in die Halle", to: "a5" },
        ] },
        { id: "a5", e: "👁️", t: "Sein Kopf liegt auf den Vorderklauen, groß wie ein Haus. Ein Auge ist zu, das andere steht einen Spalt offen und bewegt sich nicht. Und mitten im Zählen macht er einen Fehler und fängt die Reihe noch einmal an.", c: [
          { a: "Ganz langsam weitergehen", to: "a6" },
          { a: "Am Rand nachsehen", to: "b6" },
        ] },
        { id: "b5", e: "0️⃣", t: "Die einzelne Kerbe hat keine Zahl. Sie hat ein Wort, klein und ordentlich ins Holz geritzt: „fehlt“. Daneben ein leerer Platz auf dem Boden, staubfrei, genau so groß wie eine Handfläche.", c: [
          { a: "Den leeren Platz ansehen", to: "b6" },
          { a: "Nach einem schmalen Weg suchen", to: "c6" },
        ] },
        { id: "c5", e: "📚", t: "In den Regalen stehen über hundert Bücher, alle gleich gebunden, auf jedem Rücken eine Jahreszahl. Du ziehst das oberste heraus: Seite für Seite Zahlen in Spalten, in einer sehr ordentlichen Handschrift.", c: [
          { a: "Das neueste Buch aufschlagen", to: "c6" },
          { a: "Durch eine Ritze nach nebenan", to: "a6" },
        ] },
        { id: "a6", e: "🪨", t: "Vor seinem Maul liegt ein Stück, das nicht wie das andere ist: kein Gold, kein Silber. Ein flacher grauer Stein mit einem Loch in der Mitte, glatt geschliffen. Er liegt allein, mit Abstand zu allem übrigen.", c: [
          { a: "Nach dem Stein greifen", to: "a7" },
          { a: "Ihn erst betrachten", to: "b7" },
        ] },
        { id: "b6", e: "🖐️", t: "Rundherum liegt der Staub von Jahrzehnten, und in der Mitte liegt gar keiner. Da hat etwas gelegen, und zwar bis vor kurzem. Nicht bis vor sechzig Jahren. Bis vor kurzem.", c: [
          { a: "Ringsum danach suchen", to: "b7" },
          { a: "Nach nebenan wechseln", to: "c7" },
        ] },
        { id: "c6", e: "✒️", t: "In der schmalen Kammer bricht im neuesten Buch die Handschrift auf halber Seite ab. Darunter geht es weiter: größer, schiefer, mit Klauen geschrieben. Er zählt selbst, seit der Zähler nicht mehr kommt.", c: [
          { a: "Ganz zu Ende lesen", to: "c7" },
          { a: "Hinüber zu ihm", to: "a7" },
        ] },
        { id: "a7", e: "🫸", t: "Der Stein ist kühl und wiegt nichts, und durch das Loch passt ein Finger. Als du ihn anhebst, hören die Zahlen auf. Nicht leiser. Sie hören einfach auf, mitten in einer.", c: [
          { a: "Ihn festhalten und dich umdrehen", to: "a8" },
          { a: "Ihn zurücklegen", to: "b8" },
        ] },
        { id: "b7", e: "🔎", t: "Du gehst die Reihen ab und suchst ein Stück ohne Zahl. Es gibt keins — bis auf einen flachen grauen Stein mit einem Loch, der vorn beim Kopf liegt, ganz allein. Und die Zahlen hören auf.", c: [
          { a: "Zu dem Stein hinüber", to: "b8" },
          { a: "Erst nebenan nachsehen", to: "c8" },
        ] },
        { id: "c7", e: "📝", t: "Die letzte Zeile ist von heute, und sie ist keine Zahl. „Immer noch eins zu wenig“, steht da. „Wenn ich fertig bin, gehe ich es holen. Ich weiß, wo es ist.“ Draußen hört der Schnee auf.", c: [
          { a: "Das Buch mitnehmen", to: "c8" },
          { a: "Hinüber zu ihm", to: "a8" },
        ] },
        { id: "a8", e: "😳", t: "Das offene Auge ist jetzt ganz offen und sieht auf deine Hand. Er hebt den Kopf nicht und sagt nichts. Er wartet nur, so ruhig, wie ein Berg wartet, und die Stille geht bis in die letzte Ecke der Halle.", c: [
          { a: "Ihm den Stein zeigen", to: "a9" },
          { a: "Ihn fragen, was fehlt", to: "b9" },
        ] },
        { id: "b8", e: "🕯️", t: "Aus der Nähe sieht man es: Der Stein ist von Händen glatt geworden, nicht von Wasser. So glatt wird etwas nur, wenn es jemand jahrzehntelang in der Tasche hatte und immer wieder anfasste.", c: [
          { a: "Ihn dorthin zurücklegen", to: "b9" },
          { a: "In den schmalen Gang zurück", to: "c9" },
        ] },
        { id: "c8", e: "🚪", t: "Am Ende des schmalen Gangs ist eine kleine Tür in den Fels geschlagen, mit einem Riegel von innen. Dahinter Stufen, und die Stufen gehen nicht in die Halle. Sie gehen nach oben, aus dem Berg heraus.", c: [
          { a: "Die Stufen hinauf", to: "c9" },
          { a: "Doch noch einmal in die Halle", to: "a9" },
        ] },
        { id: "a9", e: "🤲", t: "Du hältst den grauen Stein hoch, so dass er ihn sehen kann. Etwas geht durch das große Auge, das man bei einem Menschen sofort verstehen würde. Dann senkt er den Kopf, bis das Maul auf Höhe deiner Hand ist.", c: [
          { a: "Den Stein behalten", to: "e0" },
          { a: "Die Hand öffnen", to: "e1" },
        ] },
        { id: "b9", e: "🗣️", t: "„Eins“, sagt er, und die Halle brummt davon. „Von 4806. Seit sechzig Jahren.“ Eine Pause, so lang, dass du das Wasser im Fels hörst. „Es war nie ein Schatz. Es war ihrs.“", c: [
          { a: "Fragen, wer sie war", to: "e1" },
          { a: "Nach der kleinen Tür fragen", to: "e2" },
        ] },
        { id: "c9", e: "🪜", t: "Die Stufen sind ausgetreten, hunderte Male begangen. Oben eine Falltür, und darauf liegt Laub. Wer hier gewohnt hat, ist jeden Tag hinein- und hinausgegangen, und er hat es nie gemerkt.", c: [
          { a: "Die Falltür aufstoßen", to: "e2" },
          { a: "Umkehren und zu ihm", to: "e0" },
        ] },
        { id: "e0", e: "🪨", end: 0, name: "Das eine Stück", t: "Du gehst mit dem grauen Stein hinaus, und niemand hält dich auf. Erst draußen siehst du, dass durch das Loch ein Lederband gehört und dass innen eine Zahl steht: 4806. Er zählt jetzt vollständig. Und auf dem Foto am Kaminsims trägt deine Urgroßmutter genau das, was jetzt dir um den Hals hängt." },
        { id: "e1", e: "🐲", end: 1, name: "Der Zähler", t: "Du legst den Stein in das riesige Maul, und er nimmt ihn so vorsichtig, wie man ein Küken nimmt. „Sie hat sechzig Jahre für mich gezählt“, sagt er. „Dann ist sie nicht mehr gekommen, und ich wusste nicht, ob ich sie suchen darf.“ Von da an zählt ihr zu zweit, einmal im Winter." },
        { id: "e2", e: "🏚️", end: 2, name: "Die Falltür im Laub", t: "Über der Falltür steht ein Haus, in das seit sechzig Jahren niemand geht: ein Bett, ein Ofen, ein Stuhl am Fenster. Auf dem Tisch ein angefangener Brief an einen Drachen — und daneben eine Kerbe im Holz für jeden Tag, an dem die Schreiberin nicht mehr hinunterkam." },
      ],
    },
    {
      key: "sternwarte",
      diff: 2,
      depth: 11,
      e: "🔭",
      title: "Die Sternwarte im Fels",
      nodes: [
        { id: "s0", e: "🔭", t: "Auf dem Messingschild an Großvaters Fernrohr steht: „Zweite Kuppel — nur zur Sonnenwende.“ Zweite Kuppel gibt es nicht, sagen alle. Aber in der Nordwand sitzt ein grüner Buckel aus Kupfer mit einem Schlitz nach Osten. Und heute ist Sonnenwende.", c: [
          { a: "Zur Kuppel hinaufsteigen", to: "a1" },
          { a: "Erst die Wand darunter absuchen", to: "b1" },
        ] },
        { id: "a1", e: "🚪", t: "Unter der Kuppel sitzt eine Tür aus Eisen im Fels, ohne Griff und ohne Schloss. In der Mitte ein Rad mit Zähnen am Rand. Es geht schwer — und als du es anfasst, ist es warm von der Sonne, aber nur oben.", c: [
          { a: "Das Rad drehen", to: "a2" },
          { a: "Die Zeichen um das Rad ansehen", to: "b2" },
        ] },
        { id: "b1", e: "🪜", t: "Der Fels unter der Kuppel ist gemauert, nicht gewachsen, und aus der Mauer stehen eiserne Sprossen. Manche fehlen. In einer steckt noch eine Schraube mit einem frischen Kratzer.", c: [
          { a: "Zur Tür hinaufsteigen", to: "b2" },
          { a: "An der Mauer um die Schulter", to: "c2" },
        ] },
        { id: "a2", e: "⚙️", t: "Das Rad rastet eine Vierteldrehung weiter ein. Hinter der Tür klackt es, als spränge etwas Großes einen Zahn weiter. Dann steht alles still. Und die Tür ist immer noch zu.", c: [
          { a: "Weiterdrehen", to: "a3" },
          { a: "Auf das Klacken dahinter horchen", to: "b3" },
        ] },
        { id: "b2", e: "✴️", t: "Rund um das Rad sind Zeichen ins Eisen geschlagen: Punkte in Gruppen, mit dünnen Linien verbunden. Wer je nachts nach oben geschaut hat, erkennt sie sofort. Es sind Sternbilder.", c: [
          { a: "Die Sternbilder abzählen", to: "b3" },
          { a: "Am Fels nach demselben Zeichen suchen", to: "c3" },
        ] },
        { id: "c2", e: "🌬️", t: "Um die Bergschulter wird der Wind schneidend und der Steig kaum eine Fußbreite. Dahinter, im Windschatten, klafft ein Spalt, aus dem trockene warme Luft kommt. Und die Sonne steht schon hoch.", c: [
          { a: "In den Spalt", to: "c3" },
          { a: "Zurück zur eisernen Tür", to: "a3" },
        ] },
        { id: "a3", e: "🔁", t: "Vier Vierteldrehungen, vier Klacks — beim vierten fährt die Tür einen Spalt auf und bleibt stehen. Genau in dem Moment kippt oben das Licht in den Schlitz. Es hat angefangen.", c: [
          { a: "Hindurch", to: "a4" },
          { a: "Erst hineinleuchten", to: "b4" },
        ] },
        { id: "b3", e: "🧮", t: "Zwölf Sternbilder, und eines ist doppelt eingeschlagen, tiefer als der Rest: ein Bogen aus sieben Punkten, mit zweien dicht beieinander am Ende. Und oben kippt das Licht in den Schlitz.", c: [
          { a: "Das Rad darauf stellen", to: "b4" },
          { a: "Am Fels nach demselben Bogen suchen", to: "c4" },
        ] },
        { id: "c3", e: "🕯️", t: "Der Spalt wird zum Gang, und der Gang ist gemauert. An der Wand ein Kerzenhalter mit einem Stummel, an dem vor sehr langer Zeit zum letzten Mal ein Streichholz war. Oben kippt das Licht in den Schlitz.", c: [
          { a: "Dem Gang folgen", to: "c4" },
          { a: "Zurück und durch die eiserne Tür", to: "a4" },
        ] },
        { id: "a4", e: "🌑", t: "Drinnen hallt es hoch, und dein Licht findet keine Wand — nur Boden. Der Boden ist eine Scheibe aus Messing mit eingelegten Linien, und quer darüber liegt ein einziger heller Streifen aus dem Dach.", c: [
          { a: "Über die Scheibe zur Mitte", to: "a5" },
          { a: "Den Linien mit dem Licht folgen", to: "b5" },
        ] },
        { id: "b4", e: "🎯", t: "Beim eingestellten Zeichen läuft es anders: kein Klacken, sondern ein langes Rollen, das erst unter dir und dann über dir vorbeigeht. Etwas sehr Großes hat sich gedreht. Und die Tür steht offen.", c: [
          { a: "Hineingehen", to: "b5" },
          { a: "Nachsehen, was sich gedreht hat", to: "c5" },
        ] },
        { id: "c4", e: "🧱", t: "Der Gang endet an einer Wand, aber es ist eine Rückseite: Man sieht die Steine von hinten, und in der Mitte fehlt einer. Durch das Loch fällt ein Streifen Licht — und er wandert.", c: [
          { a: "Durch das Loch schauen", to: "c5" },
          { a: "Nach der eisernen Tür suchen", to: "a5" },
        ] },
        { id: "a5", e: "🧭", t: "In der Mitte der Scheibe steht ein Gerät aus Messing und Glas, so hoch wie du: ein Rohr in drei Ringen. Alle drei sind eingerostet. Der helle Streifen hat inzwischen die erste Linie erreicht.", c: [
          { a: "Die Ringe losdrehen", to: "a6" },
          { a: "Die Linien am Boden lesen", to: "b6" },
        ] },
        { id: "b5", e: "📐", t: "Die Linien laufen alle auf die Mitte zu, und dazwischen stehen Zahlen: Winkel. Das ist keine Zeichnung, das ist eine Uhr. Und der Streifen aus dem Dach hat die erste Linie erreicht.", c: [
          { a: "Dem Streifen folgen", to: "b6" },
          { a: "Der hellsten Linie nach an den Rand", to: "c6" },
        ] },
        { id: "c5", e: "☀️", t: "Durch das Loch siehst du in die Kuppel: eine runde Halle, und quer hindurch ein einziger Lichtstreifen aus dem Dachschlitz. Er wandert über den Boden, langsam, wie ein Zeiger — und er ist schon bei der ersten Linie.", c: [
          { a: "Dem Streifen mit den Augen folgen", to: "c6" },
          { a: "Einen Weg in die Halle suchen", to: "a6" },
        ] },
        { id: "a6", e: "🔧", t: "Der äußere Ring gibt nach, der zweite auch. Der dritte sitzt, bis du beide Hände nimmst — dann fährt er herum, und das Rohr richtet sich auf, genau auf den Schlitz. Der Streifen ist schon über der Mitte.", c: [
          { a: "Durch das Rohr schauen", to: "a7" },
          { a: "Nachsehen, worauf es zeigt", to: "b7" },
        ] },
        { id: "b6", e: "⏳", t: "Der Streifen wandert über die Linien, eine nach der anderen. Alle liegen gleich weit auseinander — bis auf zwei ganz am Rand. Er ist schon über der Mitte.", c: [
          { a: "Zu den beiden engen Linien", to: "b7" },
          { a: "Am Rand entlanggehen", to: "c7" },
        ] },
        { id: "c6", e: "🪞", t: "Wo der Streifen die Wand trifft, ist keine Wand, sondern eine Scheibe aus poliertem Metall. Sie wirft das Licht quer durch die Halle auf eine zweite, und von dort weiter. Er ist schon über der Mitte.", c: [
          { a: "Dem gespiegelten Licht folgen", to: "c7" },
          { a: "In die Mitte der Halle", to: "a7" },
        ] },
        { id: "a7", e: "✨", t: "Im Rohr ist es nicht dunkel. Obwohl draußen Mittag ist, stehen im Glas Sterne: hunderte, gestochen scharf. Dazwischen eine Linie aus sieben, mit zweien dicht beieinander am Ende.", c: [
          { a: "Das Rohr auf die sieben stellen", to: "a8" },
          { a: "Nachsehen, wo die sieben am Boden stehen", to: "b8" },
        ] },
        { id: "b7", e: "📍", t: "Zwischen den beiden engen Linien ist das Messing abgegriffen: Hier hat jemand gestanden, immer wieder, an derselben Stelle. Und im Boden ist ein flacher Abdruck, so groß wie ein Buch.", c: [
          { a: "Sich genau dorthin stellen", to: "b8" },
          { a: "Dem gespiegelten Licht folgen", to: "c8" },
        ] },
        { id: "c7", e: "🔦", t: "Von Scheibe zu Scheibe wandert das Licht durch die Halle und wird jedes Mal schmaler und heller. Der letzte Strahl ist dünn wie ein Bleistift und zeigt auf eine Stelle in der Wand, an der nichts ist.", c: [
          { a: "Zu der Stelle in der Wand", to: "c8" },
          { a: "In die Mitte zu dem Rohr", to: "a8" },
        ] },
        { id: "a8", e: "🌌", t: "Als das Rohr auf dem Bogen aus sieben steht, rastet unter dir etwas ein, und die ganze Messingscheibe dreht sich eine Handbreit. Aus dem Boden hebt sich ein Kasten. Der Streifen ist bei der vorletzten Linie.", c: [
          { a: "Den Kasten öffnen", to: "a9" },
          { a: "Zu der abgegriffenen Stelle im Messing", to: "b9" },
        ] },
        { id: "b8", e: "👣", t: "Von hier aus laufen die Linien nicht durcheinander, sondern von deinen Füßen weg wie Speichen. Von jedem anderen Punkt sieht es aus wie Gekritzel. Der Streifen ist bei der vorletzten Linie.", c: [
          { a: "Von hier aus alles betrachten", to: "b9" },
          { a: "Dem dünnen Strahl an die Wand folgen", to: "c9" },
        ] },
        { id: "c8", e: "🕳️", t: "An der Stelle, auf die der Strahl zeigt, ist die Wand einen Fingerbreit heller. Als du dagegen drückst, gibt sie nach: keine Wand, eine Platte. Dahinter ist es dunkel und kühl. Der Streifen ist bei der vorletzten Linie.", c: [
          { a: "Die Platte aufschieben", to: "c9" },
          { a: "Zurück in die Mitte", to: "a9" },
        ] },
        { id: "a9", e: "📜", t: "Im Kasten liegt, in Leinen geschlagen, ein Bogen aus dünnem Leder, gefaltet wie ein Brief. Außen steht ein Wort in einer Schrift, die du nicht kennst. Der Streifen erreicht die letzte Linie.", c: [
          { a: "Ihn auseinanderfalten", to: "e0" },
          { a: "Warten, bis das Licht darauffällt", to: "e1" },
        ] },
        { id: "b9", e: "🌠", t: "Von deinem Punkt aus ist es kein Gekritzel: Es ist ein Bild. Ein Tier mit langem Hals und ausgebreiteten Flügeln, quer über den halben Boden, aus lauter geraden Linien. Der Streifen erreicht die letzte Linie.", c: [
          { a: "Dem Umriss mit den Augen folgen", to: "e1" },
          { a: "Zu der hellen Stelle an der Wand", to: "e2" },
        ] },
        { id: "c9", e: "🌒", t: "Hinter der Platte ist eine Kammer ohne Fenster, kaum größer als ein Schrank — die einzige Stelle hier, die das Licht nie erreicht. Genau deshalb hat jemand sie gebaut. Der Streifen erreicht die letzte Linie.", c: [
          { a: "Hineingehen", to: "e2" },
          { a: "Zurück in die Mitte", to: "e0" },
        ] },
        { id: "e0", e: "⭐", end: 0, name: "Die Drachenkarte", t: "Der Bogen ist größer als du. Sterne, hunderte, und dazwischen mit feinem Strich die Wege: von Berg zu Berg, von Insel zu Insel, quer über das ganze Blatt. Es ist keine Sternkarte. Es ist eine Karte für jemanden, der oben fliegt und sich unten nicht auskennt. Großvaters Schild meinte diesen Raum." },
        { id: "e1", e: "🔭", end: 1, name: "Der letzte Sternseher", t: "Als der Streifen den Umriss erreicht, glüht er von einem Ende zum anderen auf, und einen Atemzug lang wird es warm in der Halle. Wer das gebaut hat, hat nicht die Sterne beobachtet. Er hat einem Freund über den Wolken gesagt: Ich sehe dich, und ich weiß, wo du bist. Großvater war der Letzte." },
        { id: "e2", e: "🥚", end: 2, name: "Die Kammer ohne Licht", t: "In der dunklen Kammer steht ein Gestell aus Eisen, und darauf liegt, in Wolle gebettet, ein Ei: grau, kalt, groß wie ein Kürbis. Daneben ein Krug, ein Löffel und eine Decke, ordentlich zusammengelegt. Jemand hat hier gewartet, sehr lange — und ist dann gegangen und nicht wiedergekommen." },
      ],
    },
  ],
};
