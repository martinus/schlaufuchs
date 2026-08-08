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
//     "???" on the summary's ending strip is no tease at all.
//   • Choices are ACTIONS she takes ("Den Balken wegschieben"), never opinions
//     about herself ("Sei mutig").
//   • The scene emoji sets the scene; it never gives away which ending is
//     coming (§14.2).
//   • She is "du". She is the one in the story, not a character she watches.

export const STORIES = {
  de: [
    // ---- Leicht: seven scenes — one place, one find, one way out ----------
    {
      key: "stollen",
      diff: 0,
      depth: 7,
      e: "⛏️",
      title: "Der Stollen",
      nodes: [
        { id: "s0", e: "⛏️", t: "Der Regen hat den Hang aufgerissen. Dahinter ein Stollen, mit Brettern vernagelt, die Bretter morsch. Aus dem Spalt kommt kalte Luft — und ein Geräusch. Kratz. Kratz.", c: [
          { a: "Die Bretter wegreißen", to: "a1" },
          { a: "Ansehen, was der Hang freigelegt hat", to: "b1" },
        ] },
        { id: "a1", e: "🕯️", t: "Die Bretter geben nach. Gleich hinter dem Eingang hängt eine Lampe an einem Nagel. Sie ist nicht verrostet. Jemand hat sie aufgehängt und ist nicht zurückgekommen.", c: [
          { a: "Die Lampe nehmen und hineingehen", to: "a2" },
          { a: "Nagel und Lampe genauer ansehen", to: "b2" },
        ] },
        { id: "b1", e: "🪨", t: "Im Geröll steckt ein Brett mit Schrift: „Schacht 4 — nicht allein.“ Daneben ein Blechnapf, eine Schaufel und Schuhe. Zwei Paar.", c: [
          { a: "Nach dem Eingang suchen", to: "b2" },
          { a: "Die Schaufel mitnehmen", to: "c2" },
        ] },
        { id: "a2", e: "🚃", t: "Der Gang mündet in eine Kammer. Auf Schienen steht eine umgekippte Lore, ein Rad noch in der Luft. Es dreht sich. Ganz langsam.", c: [
          { a: "Weiter dem Gang nach", to: "a3" },
          { a: "Warten, bis das Rad steht", to: "b3" },
        ] },
        { id: "b2", e: "❄️", t: "Drinnen ist die Luft kalt und riecht nach nassem Stein. Der Boden fällt leicht ab. Alle paar Sekunden tropft es, und weiter unten antwortet das Kratzen.", c: [
          { a: "Auf das Kratzen hören", to: "b3" },
          { a: "Den Schienen folgen", to: "c3" },
        ] },
        { id: "c2", e: "🛤️", t: "Neben dem Hauptgang läuft ein schmalerer, halb verschüttet. Über ihm liegen Balken kreuz und quer. Jemand hat ihn absichtlich zugemacht.", c: [
          { a: "Sich durch die Balken zwängen", to: "c3" },
          { a: "Doch den breiten Gang nehmen", to: "a3" },
        ] },
        { id: "a3", e: "💧", t: "Der Gang wird enger, der Boden nasser. Deine Schuhe stehen im Wasser. Vor dir ist es schwarz, und das Kratzen ist jetzt ganz nah.", c: [
          { a: "Weitergehen", to: "a4" },
          { a: "Stehen bleiben und lauschen", to: "b4" },
        ] },
        { id: "b3", e: "👂", t: "Es kratzt nicht die ganze Zeit. Drei kurze, dann eine Pause. Wieder drei. Das ist kein Tier, das gräbt. Das ist jemand, der klopft.", c: [
          { a: "Zurückklopfen", to: "b4" },
          { a: "An der Wand entlang zur Quelle tasten", to: "c4" },
        ] },
        { id: "c3", e: "🪵", t: "Der schmale Gang endet an einer Wand aus Bohlen — kein Fels, Holz. Und im Holz eine Ritze, aus der Licht kommt. Warmes Licht.", c: [
          { a: "Durch die Ritze schauen", to: "c4" },
          { a: "Gegen die Bohlen drücken", to: "a4" },
        ] },
        { id: "a4", e: "🚪", t: "Eine Tür aus dicken Bohlen, und sie ist verriegelt. Von innen. Der Riegel ist so groß wie dein Arm. Jemand hat ihn zugeschoben und nicht mehr aufbekommen.", c: [
          { a: "Den Riegel aufhebeln", to: "a5" },
          { a: "Klopfen und fragen, wer da ist", to: "b5" },
        ] },
        { id: "b4", e: "🗣️", t: "Drei Schläge zurück. Sofort wird es still. Dann, ganz vorsichtig, drei Schläge zurück zu dir. Und dann eine Stimme, sehr jung und sehr heiser.", c: [
          { a: "Antworten", to: "b5" },
          { a: "Fragen, ob es einen zweiten Weg gibt", to: "c5" },
        ] },
        { id: "c4", e: "🔥", t: "Durch die Ritze siehst du eine Kammer. Auf dem Boden glimmt Glut. Daneben liegt etwas Grünes mit Schuppen, eingerollt und so groß wie ein Hund.", c: [
          { a: "Die Bohle lockern", to: "c5" },
          { a: "Um die Kammer herumsuchen", to: "a5" },
        ] },
        { id: "a5", e: "🔧", t: "Der Riegel sitzt fest, aber das Holz um ihn herum ist morsch. Mit einem Hebel und einem guten Moment wäre er zu bewegen. Über dir knirscht der Berg.", c: [
          { a: "Den Riegel herausbrechen", to: "e0" },
          { a: "Erst durch die Tür sprechen", to: "e1" },
        ] },
        { id: "b5", e: "🐲", t: "„Ich hab mich eingeschlossen“, sagt die Stimme. „Als das Dach kam. Und jetzt geht der Riegel nicht mehr auf.“ Eine Pause. „Bist du groß?“", c: [
          { a: "Sagen, dass du ihn herausholst", to: "e1" },
          { a: "Nach dem alten Fluchtschacht fragen", to: "e2" },
        ] },
        { id: "c5", e: "🕳️", t: "Hinter der Kammer geht es weiter. Ein Schacht, senkrecht nach oben, mit eisernen Sprossen. Der Fluchtweg der Bergleute. Weit oben ein heller Punkt.", c: [
          { a: "Hinaufsteigen", to: "e2" },
          { a: "Zurück zur Tür", to: "e0" },
        ] },
        { id: "e0", e: "💎", end: 0, name: "Die Silberader", t: "Der Riegel bricht. Heraus kriecht ein junger Drache, kaum größer als ein Hund. Hinter ihm liegt der Gang, den er tagelang gekratzt hat. Er endet an einer Wand aus Silber, die keiner je gefunden hat." },
        { id: "e1", e: "🐉", end: 1, name: "Der Eingeschlossene", t: "Durch die Tür findet ihr gemeinsam heraus, wohin der Riegel muss. Er drückt, du ziehst. Er ist viel kleiner als seine Stimme. Seitdem zeigt er dir, wo im Berg man gehen darf und wo nicht." },
        { id: "e2", e: "🪜", end: 2, name: "Der Fluchtschacht", t: "Oben kommst du auf der anderen Seite des Berges heraus. Das Tal dort hat keinen Weg. Von dort findest du den zweiten Eingang seiner Kammer und lässt ein Seil hinunter." },
      ],
    },
    {
      key: "wrack",
      diff: 0,
      depth: 7,
      e: "🚢",
      title: "Das Wrack im Watt",
      nodes: [
        { id: "s0", e: "🌊", t: "Das Meer ist weiter draußen als je zuvor. Im Schlick steht ein Schiff, schief, mit gebrochenem Mast. „Drei Stunden“, sagt der Fischer. „Dann kommt das Wasser zurück, und es kommt schnell.“", c: [
          { a: "Sofort hinauslaufen", to: "a1" },
          { a: "Den Schlick um das Wrack ansehen", to: "b1" },
        ] },
        { id: "a1", e: "🪜", t: "Der Schlick zieht an deinen Schuhen. Am Rumpf hängt eine Strickleiter, halb verfault. Über dir liegt das Deck schräg wie ein Dach.", c: [
          { a: "Hinaufklettern", to: "a2" },
          { a: "Erst den Rumpf abgehen", to: "b2" },
        ] },
        { id: "b1", e: "🥾", t: "Im Schlick liegt ein Stiefel, ein Tauende, ein Brett mit Buchstaben. SEEMÖ, dann fehlt der Rest. Alles liegt in einer Linie, vom Schiff weg.", c: [
          { a: "Der Linie zum Schiff folgen", to: "b2" },
          { a: "Der Linie nach draußen folgen", to: "c2" },
        ] },
        { id: "a2", e: "🛞", t: "Auf dem Deck steht Wasser in den Ritzen. In der Mitte eine Luke, mit einem Balken beschwert. Jemand wollte nicht, dass sie aufgeht.", c: [
          { a: "Den Balken wegschieben", to: "a3" },
          { a: "Die Kreidezeichen daneben lesen", to: "b3" },
        ] },
        { id: "b2", e: "⚓", t: "Am Rumpf steht der Name ganz: SEEMÖWE, und darunter eine Jahreszahl. Vierzig Jahre liegt das Schiff hier. Die Farbe ist noch da.", c: [
          { a: "An Deck gehen", to: "b3" },
          { a: "Am Rumpf entlang nach hinten", to: "c3" },
        ] },
        { id: "c2", e: "🕳️", t: "Die Linie endet an einem Loch im Schlick, aus dem Wasser sickert. Es ist rund und glatt — kein Loch, das der Schlick gemacht hat.", c: [
          { a: "In das Loch hineinleuchten", to: "c3" },
          { a: "Doch erst an Deck gehen", to: "a3" },
        ] },
        { id: "a3", e: "🪤", t: "Der Balken rutscht. Unter der Luke geht es senkrecht hinunter, und unten steht Wasser. Es riecht nach Salz und nach etwas Warmem.", c: [
          { a: "Hinuntersteigen", to: "a4" },
          { a: "Erst hinunterrufen", to: "b4" },
        ] },
        { id: "b3", e: "✏️", t: "Neben der Luke stehen Striche in Kreide, in Fünfergruppen. Achtzehn. Und darunter, mit dem Finger in den Ruß: „Wir kommen wieder.“", c: [
          { a: "Die Striche zählen", to: "b4" },
          { a: "Nach hinten zum Ruder gehen", to: "c4" },
        ] },
        { id: "c3", e: "💧", t: "Achtern läuft ein Priel unter dem Rumpf durch, knietief und klar. Er führt vom Schiff weg, hinaus, und er ist so gerade, als hätte ihn jemand gegraben.", c: [
          { a: "Dem Priel folgen", to: "c4" },
          { a: "Zurück und an Deck", to: "a4" },
        ] },
        { id: "a4", e: "📦", t: "Durch die Luke geht es hinunter. Im Laderaum stehst du bis zu den Knien, und ringsum stehen Kisten mit Nummern. Und das Wasser ist höher als eben. Es steigt, während du hinschaust.", c: [
          { a: "Die oberste Kiste aufmachen", to: "a5" },
          { a: "Die Nummern lesen", to: "b5" },
        ] },
        { id: "b4", e: "🔢", t: "Unten stehen die Kisten in Reihen, jede mit einer Nummer. Du zählst zweimal. Beim zweiten Mal fällt es auf: Die siebte fehlt.", c: [
          { a: "Nach der siebten Kiste suchen", to: "b5" },
          { a: "Nachsehen, wohin der Priel führt", to: "c5" },
        ] },
        { id: "c4", e: "🐟", t: "Achtern, unter dem Ruder, bewegt sich etwas im Priel gegen die Strömung. Ein Rücken, grau und geschuppt, so lang wie dein Arm.", c: [
          { a: "Ihm folgen", to: "c5" },
          { a: "Zurück in den Laderaum", to: "a5" },
        ] },
        { id: "a5", e: "🧭", t: "In der obersten Kiste liegt, in Öltuch gewickelt, ein Kompass. Die Nadel zeigt nicht nach Norden. Sie zeigt nach unten, in den Laderaum hinein, und sie zittert dabei.", c: [
          { a: "Den Kompass mitnehmen", to: "e0" },
          { a: "Der Nadel folgen", to: "e1" },
        ] },
        { id: "b5", e: "🕯️", t: "Die siebte Kiste steht ganz hinten, offen und leer. Daneben eine Decke, ein Napf und ein Häufchen Schuppen. Hier hat lange jemand gewohnt.", c: [
          { a: "Rufen", to: "e1" },
          { a: "Der Spur der Schuppen folgen", to: "e2" },
        ] },
        { id: "c5", e: "🏝️", t: "Der Priel wird tiefer und mündet unter einer Sandbank. Auf der Bank liegt Holz, Tauwerk — und Kisten. Sechs Stück, in einer Reihe.", c: [
          { a: "Zur Sandbank hinüber", to: "e2" },
          { a: "Zurück zum Schiff und die Kiste öffnen", to: "e0" },
        ] },
        { id: "e0", e: "🧭", end: 0, name: "Der Kompass des Kapitäns", t: "Du bist draußen, bevor das Wasser das Deck erreicht. Am Ufer dreht sich die Nadel und bleibt stehen: Sie zeigt auf den Berg. „Kein Kompass für Norden“, sagt der Fischer leise. „Einer für Drachen.“" },
        { id: "e1", e: "🐉", end: 1, name: "Der blinde Passagier", t: "Aus dem Dunkel kommt ein junger Seedrache, grau wie Schlick. Er drückt sich an dein Bein. Er kennt den Weg hinaus besser als du — und wartet an der Luke, bis du nachkommst." },
        { id: "e2", e: "🐚", end: 2, name: "Die sechs Kisten", t: "Auf der Sandbank steht die Ladung, die nie gelöscht wurde. Sechs Kisten voller Bernstein, vom Wasser blank gewaschen. Hierher führt kein Weg außer dem Priel — und den kennst jetzt du." },
      ],
    },
    {
      key: "kammer",
      diff: 0,
      depth: 7,
      e: "🏰",
      title: "Die Kammer",
      nodes: [
        { id: "s0", e: "🏰", t: "Von außen hat der Turm fünf Fenster. Von innen sind es vier Zimmer. Ein Fenster gehört zu nichts. Es sitzt genau zwischen dem zweiten und dem dritten Stock.", c: [
          { a: "Die Treppe hinauf und nachmessen", to: "a1" },
          { a: "Von unten die Fenster zählen", to: "b1" },
        ] },
        { id: "a1", e: "🧱", t: "Im zweiten Stock steht eine Wand, wo keine sein müsste. Der Putz darauf ist heller als sonst überall und ganz glatt. Wie eine Tür, die jemand glatt verputzt hat.", c: [
          { a: "Gegen den Putz klopfen", to: "a2" },
          { a: "Den Putz genauer anschauen", to: "b2" },
        ] },
        { id: "b1", e: "🪟", t: "Vier Fenster stehen in einer Reihe. Das fünfte sitzt schief dazwischen und ist kleiner. Der Efeu wächst rundherum, aber nicht darüber. Als würde er ausweichen.", c: [
          { a: "Hinaufgehen und die Wand suchen", to: "b2" },
          { a: "Den Efeu anfassen", to: "c2" },
        ] },
        { id: "a2", e: "🔨", t: "Es klingt hohl, aber nur an einer Stelle, kaum breiter als du. Der Putz bröckelt schon von allein. Dahinter ist kein Stein, sondern kalte Luft.", c: [
          { a: "Den Putz aufbrechen", to: "a3" },
          { a: "Im Treppenhaus nach einem Plan suchen", to: "b3" },
        ] },
        { id: "b2", e: "📐", t: "Im Treppenhaus hängt ein alter Plan des Turms, fleckig hinter Glas. Fünf Zimmer sind eingezeichnet. Über eines hat jemand mit Tinte ein Kreuz gemacht.", c: [
          { a: "Den Plan abnehmen", to: "b3" },
          { a: "Nach draußen zum Efeu", to: "c3" },
        ] },
        { id: "c2", e: "🌿", t: "Der Efeu ist alt und so dick wie dein Arm. Er hält, wenn du dich daran hängst. Und er führt genau an dem schiefen Fenster vorbei.", c: [
          { a: "Hinaufklettern", to: "c3" },
          { a: "Doch drinnen die Wand suchen", to: "a3" },
        ] },
        { id: "a3", e: "🕳️", t: "Hinter dem Putz ist kein Zimmer, sondern ein Schacht. Eng, rußig, und er geht nach oben und nach unten. Ein Kamin, den seit langem niemand benutzt hat.", c: [
          { a: "In den Schacht steigen", to: "a4" },
          { a: "Zurück und den Plan im Treppenhaus holen", to: "b4" },
        ] },
        { id: "b3", e: "🖋️", t: "Unter dem Kreuz steht in derselben Tinte: „Zugemacht im Winter. Sie schläft. Nicht wecken, nicht heizen.“ Die Schrift zittert.", c: [
          { a: "Nachlesen, wer das geschrieben hat", to: "b4" },
          { a: "Von außen nachsehen", to: "c4" },
        ] },
        { id: "c3", e: "🧗", t: "Auf halber Höhe bist du auf gleicher Höhe mit dem schiefen Fenster. Es ist zugemauert — bis auf einen Spalt ganz oben, wo ein Stein fehlt.", c: [
          { a: "Durch den Spalt schauen", to: "c4" },
          { a: "Am Efeu weiter nach oben", to: "a4" },
        ] },
        { id: "a4", e: "🌬️", t: "Im Schacht ist es enger, als es aussah, und wärmer. Aus einer Öffnung in der Seitenwand kommt Luft, die nach Rauch riecht. Nach frischem Rauch.", c: [
          { a: "Durch die Öffnung", to: "a5" },
          { a: "Erst durch die Öffnung horchen", to: "b5" },
        ] },
        { id: "b4", e: "🕰️", t: "Der Turmwart hat es geschrieben, vor zweihundert Jahren. Auf der Rückseite steht noch ein Satz: „Der Stein hält die Wärme. Solange er glüht, ist sie da.“", c: [
          { a: "Nach dem Stein fragen", to: "b5" },
          { a: "Über das Dach zum Fenster", to: "c5" },
        ] },
        { id: "c4", e: "🔥", t: "Durch den Spalt siehst du einen runden Raum ohne Tür. In der Mitte liegt ein Stein, so groß wie ein Brotlaib, und er glüht. Nach zweihundert Jahren.", c: [
          { a: "Den losen Stein herausdrücken", to: "c5" },
          { a: "Zurück und durch den Kamin", to: "a5" },
        ] },
        { id: "a5", e: "💨", t: "Die Öffnung führt in den runden Raum. Der Stein liegt in der Mitte, und die Wärme steht darüber wie über einem Ofen. An der Wand bewegt sich etwas.", c: [
          { a: "Den Stein nehmen", to: "e0" },
          { a: "Zur Wand schauen", to: "e1" },
        ] },
        { id: "b5", e: "🐲", t: "„Zweihundert Jahre“, sagt eine Stimme im Turm, alt und ganz ruhig. „Und keiner hat nachgelegt. Nur der Stein. Bist du das, die da klopft?“", c: [
          { a: "Antworten", to: "e1" },
          { a: "Fragen, was über dem Zimmer liegt", to: "e2" },
        ] },
        { id: "c5", e: "🪟", t: "Am schiefen Fenster fehlt oben ein Stein, und die Mauer dahinter gibt nach. Über dem runden Raum tut sich noch einer auf. Klein, hell, mit einem Fenster nach Osten.", c: [
          { a: "Hineinklettern", to: "e2" },
          { a: "Erst hinunter zum glühenden Stein", to: "e0" },
        ] },
        { id: "e0", e: "🔥", end: 0, name: "Der Wärmestein", t: "Der Stein ist warm wie ein Tier. Zweihundert Jahre hat er ein Ei gewärmt, das längst geschlüpft ist. Jetzt wärmt er dein Zimmer, und im Winter kommt das halbe Dorf vorbei." },
        { id: "e1", e: "🐉", end: 1, name: "Die alte Wächterin", t: "An der Wand hängt sie, grau und faltig und kaum größer als ein Hund. Sie hat sich selbst einmauern lassen, damit niemand den Stein holt. „Jetzt“, sagt sie, „darf ich wohl raus.“" },
        { id: "e2", e: "🪺", end: 2, name: "Das Nest über der Kammer", t: "Der kleine Raum ist voller Federn und trockenem Gras — ein Nest, so alt wie der Turm. Und in der Mitte, kalt und leer, eine Schale. Vor zweihundert Jahren ist daraus jemand geschlüpft." },
      ],
    },
    // ---- Mittel: nine scenes — a place with a history ---------------------
    {
      key: "wasserfall",
      diff: 1,
      depth: 9,
      e: "💦",
      title: "Hinter dem Wasserfall",
      nodes: [
        { id: "s0", e: "💦", t: "Der Wasserfall stürzt so laut, dass man sein eigenes Rufen nicht hört. Aber hinter dem Vorhang aus Wasser läuft ein Sims am Fels entlang, gerade breit genug für einen Fuß. Und am Ende des Simses ist es dunkel.", c: [
          { a: "Auf das Sims hinaus", to: "a1" },
          { a: "Erst den Kolk unter dem Fall absuchen", to: "b1" },
        ] },
        { id: "a1", e: "🪨", t: "Das Wasser trommelt dir auf die Schulter, kalt wie Schnee. Nach zwanzig Schritten hört es auf: Du stehst in einem Gang, und hinter dir hängt der Fall wie ein Vorhang aus Glas.", c: [
          { a: "In den Gang hinein", to: "a2" },
          { a: "Die Wände am Eingang abtasten", to: "b2" },
        ] },
        { id: "b1", e: "🌀", t: "Im Kolk dreht sich das Wasser. Am Rand hat es ausgespült, was der Fall über die Jahre heruntergebracht hat. Knochen, ein Eimer, eine Kette — und Schuppen, groß wie Handflächen.", c: [
          { a: "Auf das Sims und hinein", to: "b2" },
          { a: "Unter den Fall tauchen", to: "c2" },
        ] },
        { id: "a2", e: "🔦", t: "Der Gang steigt an und wird trockener. Der Lärm bleibt hinter dir zurück, und in der Stille hörst du etwas anderes: ein langsames, tiefes Atmen. Weit weg, aber groß.", c: [
          { a: "Weitergehen", to: "a3" },
          { a: "Die Wand im Licht ansehen", to: "b3" },
        ] },
        { id: "b2", e: "✒️", t: "Die Wand am Eingang ist über und über mit Zeichen bedeckt. Keine Schrift — Striche, in Gruppen, tief in den Fels geritzt. Manche sind frisch. Die meisten sind uralt.", c: [
          { a: "Den Zeichen in den Gang folgen", to: "b3" },
          { a: "Nach einem zweiten Eingang suchen", to: "c3" },
        ] },
        { id: "c2", e: "🫧", t: "Unter dem Fall reißt dich das Wasser fast um, aber dahinter ist ein Loch im Fels, halb unter Wasser. Von dort zieht es kalt — es geht weiter, tief hinein.", c: [
          { a: "In das Loch hinein", to: "c3" },
          { a: "Doch auf das Sims und in den Gang", to: "a3" },
        ] },
        { id: "a3", e: "🌡️", t: "Der Gang wird wärmer, Schritt für Schritt. Nach der nächsten Biegung ist der Fels so warm wie ein Ofenrohr. Der Boden ist glatt gescheuert von etwas, das hier oft entlanggeht.", c: [
          { a: "Der glatten Spur nach", to: "a4" },
          { a: "Die Zeichen an dieser Stelle lesen", to: "b4" },
        ] },
        { id: "b3", e: "5️⃣", t: "Die Zeichen laufen mit dir. Immer fünf Striche, dann eine Lücke, dann wieder fünf. Und alle paar Meter ein größeres Zeichen quer darüber, wie ein Strich unter einer Rechnung.", c: [
          { a: "Weiterlesen", to: "b4" },
          { a: "Dort nachschauen, wo die Zeichen aufhören", to: "c4" },
        ] },
        { id: "c3", e: "🌊", t: "Der Wasserlauf drückt dich vorwärts. Nach ein paar Metern kannst du wieder stehen: eine Rinne im Fels, glatt wie eine Rutsche, und sie fällt in die Tiefe.", c: [
          { a: "Der Rinne folgen", to: "c4" },
          { a: "Hinauf zum warmen Gang klettern", to: "a4" },
        ] },
        { id: "a4", e: "🕳️", t: "Vor dir öffnet sich eine Halle, so hoch, dass dein Licht die Decke nicht findet. Und in der Mitte hebt und senkt sich etwas. Bei jedem Atemzug streicht warme Luft über dein Gesicht.", c: [
          { a: "Am Rand der Halle entlang", to: "a5" },
          { a: "Am Rand entlang den Zeichen nach", to: "b5" },
        ] },
        { id: "b4", e: "📏", t: "Die Zeichen zählen keine Tage. Sie zählen Schritte: Alle fünf Striche steht ein Zeichen für „Biegung“, „Wasser“, „Loch im Boden“. Das hier ist ein Wegweiser für jemanden, der nichts sieht.", c: [
          { a: "Dem Wegweiser folgen", to: "b5" },
          { a: "Zurück zur Rinne im Fels", to: "c5" },
        ] },
        { id: "c4", e: "❄️", t: "Wo die Zeichen aufhören, fällt der Boden weg. Eine Rinne, glatt wie eine Rutsche, endet an einem Becken mit stillem Wasser. Auf dem Grund liegt etwas Helles.", c: [
          { a: "Den Krallenspuren nach oben", to: "c5" },
          { a: "Zur großen Halle hinüber", to: "a5" },
        ] },
        { id: "a5", e: "🐉", t: "Sie ist so lang wie drei Wagen und liegt auf einem Hügel aus Sand. Die Augen sind offen — beide — und sie sehen nichts. Sie ist blind. Und sie schläft nicht.", c: [
          { a: "Ganz leise weitergehen", to: "a6" },
          { a: "Warten und sie beobachten", to: "b6" },
        ] },
        { id: "b5", e: "🧭", t: "Der Wegweiser führt sicher an drei Löchern vorbei, die du im Dunkeln nie gesehen hättest. Wer die Zeichen geschlagen hat, kannte den Weg auswendig und wollte, dass ihn noch jemand kennt.", c: [
          { a: "Bis zum Ende des Wegweisers", to: "b6" },
          { a: "Den Krallenspuren an der Wand folgen", to: "c6" },
        ] },
        { id: "c5", e: "🧗", t: "An der Wand über dem Becken gehen Krallenspuren einen Kamin hinauf, Griff für Griff. Als wären sie für jemanden gemacht, der klettern lernen musste.", c: [
          { a: "Hinaufklettern", to: "c6" },
          { a: "Erst zur Halle hinunter", to: "a6" },
        ] },
        { id: "a6", e: "✨", t: "Am hinteren Ende der Halle liegt etwas im Sand, das dein Licht zurückwirft. Nicht gelb wie Gold, sondern in allen Farben zugleich. Zwischen dir und ihm liegt sie.", c: [
          { a: "Am Rand entlang zu dem Funkeln", to: "a7" },
          { a: "Auf ihr Atmen achten", to: "b7" },
        ] },
        { id: "b6", e: "🪶", t: "Der Wegweiser endet an einer Nische. Darin liegt ein Bündel: eine Decke, ein Wasserschlauch, ein Stück Kreide. Und ein Zettel, viele Male gefaltet und wieder aufgefaltet.", c: [
          { a: "Den Zettel lesen", to: "b7" },
          { a: "Nachsehen, wohin der Kamin führt", to: "c7" },
        ] },
        { id: "c6", e: "🌤️", t: "Oben wird der Kamin eng, und dann hörst du Vögel. Zwischen zwei Felsplatten fällt Tageslicht herein, und dahinter steht Gras. Über dir liegt der halbe Berg — und trotzdem: Gras.", c: [
          { a: "Dich hinausschieben", to: "c7" },
          { a: "Doch noch einmal hinunter", to: "a7" },
        ] },
        { id: "a7", e: "🤫", t: "Du bist so nah, dass du die Wärme spürst, die von ihr aufsteigt. Ihr Atem geht in langen Zügen: ein, aus, und dazwischen eine Pause, in der man drei Schritte weit kommt.", c: [
          { a: "In den Pausen weitergehen", to: "e0" },
          { a: "Sie ansprechen", to: "e1" },
        ] },
        { id: "b7", e: "📜", t: "„Wenn du das liest, bist du weit gekommen“, steht da. „Sie ist blind, nicht böse. Die Zeichen sind für sie. Lass sie stehen, wenn du gehst.“ Darunter eine Hand, mit Kreide nachgezogen.", c: [
          { a: "Die Hand auf die Wand legen", to: "e1" },
          { a: "Dem Licht im Kamin nachgehen", to: "e2" },
        ] },
        { id: "c7", e: "🏞️", t: "Zwischen den Felsplatten liegt eine Wiese, rundherum von Wänden eingeschlossen. Kein Weg führt herein und keiner hinaus. In der Mitte steht ein einzelner Baum, und darunter etwas Weißes.", c: [
          { a: "Zu dem Baum", to: "e2" },
          { a: "Zurück in die Halle", to: "e0" },
        ] },
        { id: "e0", e: "💠", end: 0, name: "Der Regenbogenstein", t: "Drei Schritte, warten. Drei Schritte, warten. Dann liegt er in deiner Hand: ein Stein, klar wie Wasser, der jedes Licht in Farben zerlegt. Draußen hältst du ihn in die Sonne, und der halbe Wald steht in Regenbogen." },
        { id: "e1", e: "🐲", end: 1, name: "Was die Zeichen sagen", t: "„Da bist du ja“, sagt sie, ohne den Kopf zu heben. „Ich höre dich, seit du im Wasser warst.“ Sie ist blind seit dem Steinschlag, und die Zeichen an den Wänden hat ein Mensch für sie geschlagen. Du schlägst die nächsten." },
        { id: "e2", e: "🌳", end: 2, name: "Die eingeschlossene Wiese", t: "Unter dem Baum liegt ein Nest aus Gras, so groß wie ein Bett, und darin drei kalte Schalen. Hier ist sie geschlüpft, als der Berg noch offen war. Seitdem hat niemand hier gestanden. Jetzt weißt du den Weg." },
      ],
    },
    {
      key: "karte",
      diff: 1,
      depth: 9,
      e: "🗺️",
      title: "Die halbe Karte",
      nodes: [
        { id: "s0", e: "🗺️", t: "Das Papier lag zwischen zwei Ziegeln der alten Klostermauer: die rechte Hälfte einer Karte, sauber durchgerissen. Ein Turm, ein Hof, ein Kreuz. Die linke Hälfte fehlt — und die Risskante ist frisch.", c: [
          { a: "Sofort zur Ruine aufbrechen", to: "a1" },
          { a: "Die Risskante genauer ansehen", to: "b1" },
        ] },
        { id: "a1", e: "🏚️", t: "Von der Ruine steht noch der Torbogen und ein Stück Mauer. Im Hof wächst Gras zwischen den Platten — und quer hindurch führt eine Spur von zertretenem Gras. Jemand war vor kaum einer Stunde hier.", c: [
          { a: "Der Spur folgen", to: "a2" },
          { a: "Den Hof mit der Karte vergleichen", to: "b2" },
        ] },
        { id: "b1", e: "🔍", t: "Der Riss ist nicht alt: Die Fasern stehen noch hell. Und auf der Rückseite, halb abgeschnitten, steht eine Schrift. Das Wenige, was übrig ist, liest sich wie: „…nicht allein hinunter.“", c: [
          { a: "Zur Ruine aufbrechen", to: "b2" },
          { a: "Fragen, wer heute schon dort war", to: "c2" },
        ] },
        { id: "a2", e: "👣", t: "Die Spur führt quer über den Hof zum Turm und dort im Bogen wieder zurück. Wer immer hier war, hat gesucht und nichts gefunden — und ist dann in den Keller hinunter.", c: [
          { a: "Hinunter in den Keller", to: "a3" },
          { a: "Erst den Turm ansehen", to: "b3" },
        ] },
        { id: "b2", e: "📐", t: "Der Hof auf deiner Hälfte hat vier Ecken. Der Hof vor dir hat fünf. Die fünfte Ecke ist auf der Karte abgerissen — genau dort, wo das Kreuz steht.", c: [
          { a: "Zur fünften Ecke gehen", to: "b3" },
          { a: "Außen um die Mauer herum", to: "c3" },
        ] },
        { id: "c2", e: "🚲", t: "„Ein Junge“, sagt die Frau am Feldweg. „Mit einem Fahrrad und einem Papier in der Hand. Vor einer Stunde. Er hat gefragt, wo der Keller ist.“ Sie zeigt auf die Ruine.", c: [
          { a: "Nach dem Fahrrad suchen", to: "c3" },
          { a: "Schnell in den Hof", to: "a3" },
        ] },
        { id: "a3", e: "🪜", t: "Die Kellertreppe ist voller Schutt, aber begehbar. Unten liegt ein Gang, und darin steht Staub in der Luft, aufgewirbelt. Jemand ist hier gegangen, und zwar gerade eben.", c: [
          { a: "Weiter in den Gang", to: "a4" },
          { a: "Auf Geräusche warten", to: "b4" },
        ] },
        { id: "b3", e: "🧱", t: "Die fünfte Ecke ist keine Ecke, sondern ein Vorbau: ein niedriger Anbau mit einem eingefallenen Dach. Unter dem Schutt zeichnet sich etwas Rundes ab. Ein Deckel aus Stein.", c: [
          { a: "Den Deckel freilegen", to: "b4" },
          { a: "Erst die Mauer außen absuchen", to: "c4" },
        ] },
        { id: "c3", e: "🚴", t: "Das Fahrrad liegt hinter der Mauer im Brennnesselfeld. Darüber klafft ein Loch in der Mauer, dort, wo die Steine herausgefallen sind. Ein zweiter Weg hinein.", c: [
          { a: "Durch das Loch", to: "c4" },
          { a: "Über den Hof zum Keller", to: "a4" },
        ] },
        { id: "a4", e: "🕯️", t: "Am Ende des Gangs brennt eine Kerze auf einem Stein, ganz neu angezündet. Daneben liegt ein Rucksack. Und aus der Dunkelheit dahinter kommt ein Kratzen, wie von einem Schuh auf Sand.", c: [
          { a: "In die Dunkelheit hineingehen", to: "a5" },
          { a: "Hinter der Kerze warten", to: "b5" },
        ] },
        { id: "b4", e: "🕳️", t: "Der Deckel gibt nach, und darunter geht es senkrecht hinunter. Von unten kommt kalte Luft und, ganz leise, eine Stimme. Sie redet mit sich selbst und klingt nicht besonders mutig.", c: [
          { a: "Hinunterrufen", to: "b5" },
          { a: "Um den Vorbau herum weitersuchen", to: "c5" },
        ] },
        { id: "c4", e: "🧤", t: "Hinter dem Loch liegt ein Raum, den der Schutt verschont hat. Auf dem Boden: ein Handschuh und ein Stück Kreide. An der Wand eine Zeichnung — dieselben Linien wie auf deiner Karte, nur ganz.", c: [
          { a: "Die ganze Zeichnung abgehen", to: "c5" },
          { a: "Dem Gang zum Keller folgen", to: "a5" },
        ] },
        { id: "a5", e: "😮", t: "Er ist etwa so alt wie du und erschrickt schlimmer als du. In der Hand hält er ein Stück Papier mit einer frischen Risskante. Hinter ihm endet der Gang an einer Wand aus glatten Steinen.", c: [
          { a: "Zur Wand hinüber", to: "a6" },
          { a: "Ihn fragen, wo er die Hälfte her hat", to: "b6" },
        ] },
        { id: "b5", e: "🗣️", t: "Die Stimme verstummt sofort. Dann, vorsichtig: „Bist du oben? Ich komme hier nicht mehr rauf. Der Schutt ist nachgerutscht.“ Eine Pause. „Und meine Karte hilft mir kein bisschen.“", c: [
          { a: "Ihm ein Seil hinunterlassen", to: "b6" },
          { a: "Nach einem zweiten Zugang suchen", to: "c6" },
        ] },
        { id: "c5", e: "🖍️", t: "Die Zeichnung an der Wand zeigt, was die Karte verschweigt: Der Keller hat zwei Gänge, und der zweite endet nicht. Er läuft unter dem Hof durch und weiter, aus der Ruine heraus.", c: [
          { a: "Den zweiten Gang suchen", to: "c6" },
          { a: "In den ersten Gang hinunter", to: "a6" },
        ] },
        { id: "a6", e: "🧩", t: "Die glatten Steine sind kein Mauerrest. Sie sind eine Tür, und in der Mitte ist eine Vertiefung, in der Form eines Rechtecks. Genau so groß wie eine Karte. Wie eine ganze Karte.", c: [
          { a: "Deine Hälfte hineinlegen", to: "a7" },
          { a: "Ihn um seine Hälfte bitten", to: "b7" },
        ] },
        { id: "b6", e: "🪢", t: "Er setzt sich hin und schaut dich an, und dabei fällt ihm die Erschöpfung aus dem Gesicht. „Ich such das seit dem Sommer“, sagt er. „Und ich hab die falsche Hälfte.“", c: [
          { a: "Die Hälften nebeneinanderlegen", to: "b7" },
          { a: "Ihn nach dem zweiten Gang fragen", to: "c7" },
        ] },
        { id: "c6", e: "🚇", t: "Der zweite Gang ist niedrig und trocken und läuft schnurgerade. Nach fünfzig Schritten ist über dir kein Kloster mehr, sondern Wurzelwerk. Der Gang führt aus der Ruine hinaus.", c: [
          { a: "Bis zum Ende gehen", to: "c7" },
          { a: "Umkehren zur steinernen Tür", to: "a7" },
        ] },
        { id: "a7", e: "🚪", t: "Deine Hälfte passt in die Vertiefung wie ein Deckel in einen Topf — aber nur halb. Die andere Hälfte der Vertiefung bleibt leer, und die Tür rührt sich keinen Millimeter.", c: [
          { a: "Mit aller Kraft drücken", to: "e0" },
          { a: "Die zweite Hälfte holen", to: "e1" },
        ] },
        { id: "b7", e: "📄", t: "Die beiden Hälften passen zusammen, Riss an Riss. Erst jetzt ergibt die Zeichnung einen Sinn: Das Kreuz steht nicht auf dem Hof. Es steht darunter, und ein Pfeil zeigt auf die Tür im Keller.", c: [
          { a: "Gemeinsam hinunter zur Tür", to: "e1" },
          { a: "Dem Pfeil in die andere Richtung folgen", to: "e2" },
        ] },
        { id: "c7", e: "🌱", t: "Der Gang endet unter einer Steinplatte, und die Platte lässt sich heben. Du steckst den Kopf heraus: Wiese, Sonne, und die Ruine liegt zweihundert Schritte hinter dir.", c: [
          { a: "Nachsehen, was hier oben liegt", to: "e2" },
          { a: "Zurück zur steinernen Tür", to: "e0" },
        ] },
        { id: "e0", e: "🏺", end: 0, name: "Die Kammer unter dem Hof", t: "Die Tür gibt einen Finger breit nach, dann eine Hand, dann ganz. Dahinter liegt eine Kammer voller Krüge, alle versiegelt und beschriftet. In der letzten Reihe stehen drei, die keinen Wein enthalten, sondern Schuppen. Sortiert nach Farbe." },
        { id: "e1", e: "🤝", end: 1, name: "Die zweite Hälfte", t: "Zu zweit geht die Tür auf, weil zwei Hälften hineinpassen und weil vier Hände drücken. Ihr steht in der Kammer und sagt eine Weile gar nichts. Danach zerreißt ihr die Karte nicht wieder — ihr klebt sie zusammen." },
        { id: "e2", e: "🌳", end: 2, name: "Was die Karte nicht zeigt", t: "Über der Steinplatte steht eine Eiche, älter als das Kloster. In ihrem Stamm klafft eine Höhlung, groß genug für dich. Innen ist sie ausgebrannt, glatt und warm. Hier hat lange etwas gewohnt, das Feuer machen kann." },
      ],
    },
    {
      key: "gletscher",
      diff: 1,
      depth: 9,
      e: "🧊",
      title: "Der Gletscherspalt",
      nodes: [
        { id: "s0", e: "🧊", t: "Der Spalt ist neu — vorletzte Woche war hier noch glattes Eis. Er ist so breit wie eine Tür und so tief, dass du den Grund nicht siehst. Aber dreißig Meter unten leuchtet etwas Rotes.", c: [
          { a: "An der Kante hinunterschauen", to: "a1" },
          { a: "Den Rand des Spalts abgehen", to: "b1" },
        ] },
        { id: "a1", e: "🪢", t: "Die Wände sind blau und glatt, aber alle paar Meter springt eine Kante vor, breit genug zum Stehen. Mit einem Seil um den Felsblock oben wäre der Abstieg zu machen. Ohne nicht.", c: [
          { a: "Das Seil festmachen und hinunter", to: "a2" },
          { a: "Erst prüfen, wie fest der Block sitzt", to: "b2" },
        ] },
        { id: "b1", e: "🥾", t: "Fünfzig Schritte weiter läuft der Spalt aus. Dort im Eis, eingeschlossen wie eine Fliege im Bernstein, steckt ein Rucksack. Er ist nicht alt. Und er ist einen Meter tief drin.", c: [
          { a: "Zurück zur breiten Stelle", to: "b2" },
          { a: "Am auslaufenden Ende hinuntersteigen", to: "c2" },
        ] },
        { id: "a2", e: "🔵", t: "Zehn Meter tiefer ist das Licht blau und der Lärm weg. Es tropft. Überall tropft es. Vor zwei Wochen hat es hier nicht getropft — der Sommer ist zu warm, und der Gletscher arbeitet.", c: [
          { a: "Weiter hinunter", to: "a3" },
          { a: "Auf das Knacken hören", to: "b3" },
        ] },
        { id: "b2", e: "🪨", t: "Der Felsblock steht auf blankem Eis, und rundherum hat das Schmelzwasser eine Rinne gezogen. Er sitzt fest — aber er sitzt fest auf etwas, das schmilzt.", c: [
          { a: "Am Seil hinunter", to: "b3" },
          { a: "Nach einem sicheren Weg suchen", to: "c3" },
        ] },
        { id: "c2", e: "🚪", t: "Am flachen Ende kann man ohne Seil hinein. Nach ein paar Metern wird der Spalt zum Tunnel, und der Tunnel ist rund — nicht gerissen, sondern geschmolzen. Von etwas Warmem.", c: [
          { a: "In den Tunnel", to: "c3" },
          { a: "Doch am Seil in den Spalt", to: "a3" },
        ] },
        { id: "a3", e: "📉", t: "Zwanzig Meter. Das Rote ist jetzt näher und größer, als es von oben aussah — kein Stein, eher eine Fläche. Und über dir ist der Streifen Himmel nur noch ein heller Faden.", c: [
          { a: "Die letzten Meter hinunter", to: "a4" },
          { a: "Die Eiswand vor dir ansehen", to: "b4" },
        ] },
        { id: "b3", e: "👂", t: "Das Eis knackt nicht zufällig. Es knackt in Wellen: erst weit weg, dann näher, dann direkt neben deinem Ohr. Dazwischen ist es so still, dass du dein eigenes Blut hörst.", c: [
          { a: "Zwischen den Wellen weiterklettern", to: "b4" },
          { a: "In den geschmolzenen Tunnel wechseln", to: "c4" },
        ] },
        { id: "c3", e: "🫧", t: "Der Tunnel führt schräg nach unten. Im Eis der Wände stecken Luftblasen in langen Ketten. Dazwischen etwas Dunkles, Langes — eine Kante, die sich mit dem Tunnel hinabzieht.", c: [
          { a: "Der Kante folgen", to: "c4" },
          { a: "Quer hinüber zum Spalt", to: "a4" },
        ] },
        { id: "a4", e: "🔴", t: "Unten stehst du auf Geröll, und vor dir ist die Wand nicht blau, sondern rot. Es ist keine Fläche und kein Stein. Es sind Schuppen, eine neben der anderen, jede so groß wie dein Kopf.", c: [
          { a: "Die Wand entlanggehen", to: "a5" },
          { a: "Die Eiswand daneben absuchen", to: "b5" },
        ] },
        { id: "b4", e: "🧣", t: "In der Eiswand vor dir steckt der Rucksack aus der Nähe. Daneben, tiefer im Eis: ein Ärmel, ein Handschuh — und eine Hand darin, die eine Kreide hält. Sie liegt seit vielen Jahren so.", c: [
          { a: "Die Kreidezeichen an der Wand suchen", to: "b5" },
          { a: "Dem Tunnel folgen, den jemand geschmolzen hat", to: "c5" },
        ] },
        { id: "c4", e: "🦴", t: "Die dunkle Kante im Eis ist ein Rückgrat, und es hört nicht auf. Du gehst zwanzig Schritte daran entlang, und noch immer geht es weiter, tiefer in den Berg aus Eis hinein.", c: [
          { a: "Bis zum Ende gehen", to: "c5" },
          { a: "Zur roten Wand hinüber", to: "a5" },
        ] },
        { id: "a5", e: "🫀", t: "Du legst die Hand auf die Schuppen. Sie sind nicht kalt. Und alle paar Sekunden hebt sich die Wand einen Fingerbreit und senkt sich wieder. Das hier atmet. Sehr, sehr langsam.", c: [
          { a: "Der Wand nach oben folgen", to: "a6" },
          { a: "Ganz still stehen bleiben", to: "b6" },
        ] },
        { id: "b5", e: "✍️", t: "An der Eiswand steht eine Reihe Kreidezeichen, halb verwischt. Es sind Zahlen — Tiefen — und ganz am Ende ein einziges Wort, groß und dreimal nachgezogen: „Lebt.“", c: [
          { a: "Nachsehen, worauf das Wort zeigt", to: "b6" },
          { a: "In den warmen Tunnel wechseln", to: "c6" },
        ] },
        { id: "c5", e: "💨", t: "Am Ende des Rückgrats ist der Tunnel zu Ende und wird zu einer Höhle, und in der Höhle ist es warm. Aus einer Öffnung im Eis strömt Luft, so warm wie Atem. Weil es Atem ist.", c: [
          { a: "In die warme Öffnung", to: "c6" },
          { a: "Zurück an der roten Wand hinauf", to: "a6" },
        ] },
        { id: "a6", e: "🧗", t: "Die Wand aus Schuppen steigt an, und du steigst mit. Der Spalt wird enger, das Licht von oben stärker. Dann liegt vor dir etwas Rundes und Glattes im Eis, groß wie ein Wagenrad.", c: [
          { a: "Den Schnee davon wegräumen", to: "a7" },
          { a: "Von hier aus rufen", to: "b7" },
        ] },
        { id: "b6", e: "👁️", t: "Das Wort zeigt auf eine Stelle im Eis, an der etwas Helles schimmert. Als dein Licht darauf fällt, verändert sich das Schimmern. Es wird schmaler, dann wieder breiter. Es ist ein Lid.", c: [
          { a: "Ihr Guten Tag sagen", to: "b7" },
          { a: "Zur warmen Öffnung im Eis", to: "c7" },
        ] },
        { id: "c6", e: "🌫️", t: "Hinter der Öffnung ist eine Kammer, die sich das Warme selbst geschmolzen hat. Der Boden ist trocken. An den Wänden hängt Raureif in Federn, und in der Mitte liegt ein Kreis aus flachem Kies.", c: [
          { a: "Den Kieskreis untersuchen", to: "c7" },
          { a: "Hinauf zur roten Wand", to: "a7" },
        ] },
        { id: "a7", e: "🥁", t: "Unter dem Schnee ist es kein Stein. Es ist ein Auge, geschlossen, so groß wie ein Wagenrad. Unter dem Lid bewegt sich etwas, ganz langsam, hin und her. Wie bei einem, der träumt.", c: [
          { a: "Mit der flachen Hand daraufklopfen", to: "e0" },
          { a: "Dich davorsetzen und warten", to: "e1" },
        ] },
        { id: "b7", e: "🗣️", t: "Deine Stimme kommt vom Eis zurück, dreifach. Dann, tief unter dir, verschiebt sich etwas so Großes, dass die ganze Wand knirscht. Und das Lid im Eis geht einen Spalt auf.", c: [
          { a: "Sitzen bleiben und weiterreden", to: "e1" },
          { a: "In die warme Kammer zurückweichen", to: "e2" },
        ] },
        { id: "c7", e: "⭕", t: "Der Kieskreis ist kein Zufall. Er ist gelegt, Stein für Stein, in drei Ringen. Und in der Mitte ist eine Mulde, in der der Kies angeschmolzen und wieder erstarrt ist. Hier hat etwas gelegen. Lange.", c: [
          { a: "In die Mulde greifen", to: "e2" },
          { a: "Hinauf zum runden Ding im Eis", to: "e0" },
        ] },
        { id: "e0", e: "☄️", end: 0, name: "Das rote Auge", t: "Beim dritten Klopfen geht das Lid auf. Ein Auge so groß wie ein Wagenrad sieht dich an: ruhig, uralt, gar nicht überrascht. Dann schließt es sich wieder. Am Abend rutscht der ganze Gletscher zehn Meter talwärts, und du bist die Einzige, die weiß, warum." },
        { id: "e1", e: "🐉", end: 1, name: "Der Schläfer im Eis", t: "Du sitzt bis zum Abend da und erzählst, was es oben Neues gibt: zweihundert Jahre in einer Stunde. Als du aufstehst, ist der Spalt hinter dir eine Handbreit enger geworden. „Komm wieder“, knirscht das Eis. „Ich höre gut.“" },
        { id: "e2", e: "🥚", end: 2, name: "Der Kieskreis", t: "In der Mulde liegen Scherben, dünn wie Porzellan und innen perlmuttern. Ein Nest, vom Eis überholt und mitgenommen. Wer hier geschlüpft ist, ist längst irgendwo groß — und ist irgendwann zurückgekommen und liegen geblieben." },
      ],
    },

    // ---- Schwer: eleven scenes — a place with a clock ---------------------
    {
      key: "stadt",
      diff: 2,
      depth: 11,
      e: "🌒",
      title: "Die versunkene Stadt",
      nodes: [
        { id: "s0", e: "🌒", t: "Einmal im Jahr, in der Nacht des tiefsten Wassers, fällt der See um zwölf Meter und gibt zurück, was er verschluckt hat: Gassen, Dächer, einen Turm. Sechs Stunden bleiben, sagt der Fährmann. Dann steht alles wieder unter Wasser, und zwar für ein Jahr.", c: [
          { a: "Die Hauptgasse hinunter", to: "a1" },
          { a: "Erst die Hafenmauer ansehen", to: "b1" },
        ] },
        { id: "a1", e: "🏚️", t: "Die Gasse ist knöcheltief mit Schlamm gefüllt und riecht nach Fluss. Links und rechts stehen die Häuser bis zum ersten Stock, die Fensterlöcher schwarz. In einem hängt noch ein Laden schief in der Angel und schlägt bei jedem Schritt.", c: [
          { a: "Weiter zum Marktplatz", to: "a2" },
          { a: "In das Haus mit dem Laden", to: "b2" },
        ] },
        { id: "b1", e: "📏", t: "In die Hafenmauer sind Striche geschlagen, einer über dem anderen, mit Jahreszahlen daneben. Jeder Strich ist ein Jahr, in dem das Wasser gefallen ist. Der unterste ist frisch geschlagen und liegt tiefer als alle davor.", c: [
          { a: "Die Gasse hinunter zum Markt", to: "b2" },
          { a: "Am Ufer entlangschauen", to: "c2" },
        ] },
        { id: "a2", e: "⛲", t: "Der Marktplatz ist eine flache Schüssel aus Schlamm. In der Mitte steht ein Brunnen, dessen Rand noch heil ist. Dahinter das größte Haus der Stadt: zwei Türflügel, hoch wie drei Menschen, und sie sind zu.", c: [
          { a: "Zu den Türflügeln", to: "a3" },
          { a: "Die Tafel neben dem Brunnen lesen", to: "b3" },
        ] },
        { id: "b2", e: "🪟", t: "Im Erdgeschoss steht der Schlamm hoch, aber die Treppe hält. Oben ist ein Zimmer, das trockener ist als alles hier: ein Tisch, ein Stuhl, ein Bett aus Brettern. Auf dem Tisch liegt Kreide.", c: [
          { a: "Weiter zum Marktplatz", to: "b3" },
          { a: "Aus dem Fenster über die Dächer schauen", to: "c3" },
        ] },
        { id: "c2", e: "⛵", t: "Am Rand der Stadt liegt ein Boot — nicht gestrandet, sondern festgemacht. Das Tau geht hinauf zu einem Dachbalken und ist so gebunden, dass man es von oben lösen kann. Jemand hat hier oben geankert, nicht unten.", c: [
          { a: "Das Boot untersuchen", to: "c3" },
          { a: "Über den Markt zum großen Haus", to: "a3" },
        ] },
        { id: "a3", e: "🚪", t: "Die Türflügel sind aus Eichenholz, vom Wasser schwarz und schwer wie Stein. Sie geben keinen Finger breit nach. Aber daneben, in Kopfhöhe, ist ein Fensterloch, aus dem das Gitter gerostet ist.", c: [
          { a: "Durch das Fensterloch klettern", to: "a4" },
          { a: "Die Inschrift über der Tür lesen", to: "b4" },
        ] },
        { id: "b3", e: "🪧", t: "Die Tafel am Brunnen ist Stein und hat gehalten. Es ist eine Liste mit zwei Spalten und vielen Namen. Über der linken Spalte steht „Gegangen“, über der rechten „Geblieben“. Die rechte Spalte ist kurz.", c: [
          { a: "Die rechte Spalte lesen", to: "b4" },
          { a: "Von hier aus die Dächer absuchen", to: "c4" },
        ] },
        { id: "c3", e: "🏘️", t: "Von oben sieht man, dass die Stadt nicht endet. Weiter draußen, wo das Wasser noch steht, ragen Schornsteine heraus — eine zweite Reihe Häuser, die auch heute nicht trocken fällt. Dort war noch nie jemand.", c: [
          { a: "Einen Weg über die Dächer suchen", to: "c4" },
          { a: "Hinunter zum großen Haus", to: "a4" },
        ] },
        { id: "a4", e: "🕯️", t: "Innen ist es dunkel und hallt. Der Schlamm reicht dir bis zu den Knöcheln, und darin stehen Bänke in Reihen, alle in dieselbe Richtung. Vorne führt eine breite Treppe nach oben, ins Trockene.", c: [
          { a: "Die Treppe hinauf", to: "a5" },
          { a: "Die Bänke abgehen", to: "b5" },
        ] },
        { id: "b4", e: "✍️", t: "Sieben Namen stehen unter „Geblieben“, und sechs davon sind später durchgestrichen worden, jeder mit einem anderen Werkzeug. Der siebte ist nicht durchgestrichen. Er steht ganz unten und ist am tiefsten eingeschlagen.", c: [
          { a: "Den siebten Namen behalten", to: "b5" },
          { a: "Nach dem Turm der Stadt suchen", to: "c5" },
        ] },
        { id: "c4", e: "🧗", t: "Die Dächer stehen so dicht, dass man von einem zum nächsten steigen kann, wenn man sich traut. Sie führen in einem Bogen zum einzigen Bauwerk, das ganz aus dem Wasser ragt: dem Turm mit dem Glockenstuhl.", c: [
          { a: "Über die Dächer zum Turm", to: "c5" },
          { a: "Hinunter und ins große Haus", to: "a5" },
        ] },
        { id: "a5", e: "🪜", t: "Oben ist der Boden trocken und staubig, und der Staub liegt gleichmäßig. Bis auf eine Spur, die vom Treppenkopf zu einer Tür am Ende des Ganges führt und zurück. Sie ist nicht alt.", c: [
          { a: "Der Spur zur Tür folgen", to: "a6" },
          { a: "Die Zimmer nebenan öffnen", to: "b6" },
        ] },
        { id: "b5", e: "🛏️", t: "Zwischen den Bänken steht eines quer: ein Bettgestell, hierher geschleppt und mit Seilen an einer Säule festgemacht. Wer hier geschlafen hat, wollte nicht wegschwimmen, wenn das Wasser kommt.", c: [
          { a: "Das Bettgestell untersuchen", to: "b6" },
          { a: "Zum Turm der Stadt hinüber", to: "c6" },
        ] },
        { id: "c5", e: "🔔", t: "Der Turm ist innen hohl, und eine Leiter führt Sprosse für Sprosse hinauf. Über dir hängt die Glocke, grün und riesig, und der Klöppel ist mit einem Tuch umwickelt. Damit sie nicht läutet, wenn der Wind geht.", c: [
          { a: "Die Leiter hinauf", to: "c6" },
          { a: "Hinunter und zum großen Haus", to: "a6" },
        ] },
        { id: "a6", e: "🗝️", t: "Die Tür am Ende des Ganges ist die einzige im Haus, die ein Schloss hat, und im Schloss steckt kein Schlüssel. Das Holz ist vom Wasser aufgequollen und sitzt so fest im Rahmen, dass es kracht, wenn man drückt.", c: [
          { a: "Mit der Schulter dagegen", to: "a7" },
          { a: "Im Gang nach dem Schlüssel suchen", to: "b7" },
        ] },
        { id: "b6", e: "📓", t: "In Wachstuch gewickelt liegt ein Buch, gut versteckt und trocken geblieben. Die ersten Seiten sind Rechnungen — Säcke, Fässer, Namen. Ab der Mitte ändert sich die Schrift, und es sind keine Rechnungen mehr.", c: [
          { a: "Ab der Mitte lesen", to: "b7" },
          { a: "Es einstecken und zum Turm", to: "c7" },
        ] },
        { id: "c6", e: "🪟", t: "Neben der Glocke ist eine Luke im Turmdach, und die Luke steht offen. Von hier oben liegt die ganze Stadt unter dir wie ein Plan, und man sieht auf einen Blick, was von unten niemand sieht.", c: [
          { a: "Durch die Luke aufs Dach", to: "c7" },
          { a: "Hinunter und ins große Haus", to: "a7" },
        ] },
        { id: "a7", e: "💥", t: "Beim dritten Mal gibt der Rahmen nach und die Tür schwingt auf. Dahinter liegt ein langer Saal mit einem Tisch in der Mitte, und auf dem Tisch steht ein Kasten aus Glas und Messing. Das Glas ist heil.", c: [
          { a: "Zum Kasten", to: "a8" },
          { a: "Erst den Saal absuchen", to: "b8" },
        ] },
        { id: "b7", e: "🖋️", t: "„Sie sind heute los“, steht da. „Alle bis auf uns sieben. Der See steigt jedes Jahr, und irgendwann steigt er das letzte Mal. Wir bleiben, solange einer bleibt, der aufpasst. Er kann nicht weg.“", c: [
          { a: "Weiterlesen, wer „er“ ist", to: "b8" },
          { a: "Zum Turm hinüber", to: "c8" },
        ] },
        { id: "c7", e: "🌅", t: "Auf dem Turmdach steht der Wind. Unter dir die trockene Stadt, weiter draußen die Schornsteine im Wasser. Und dazwischen, das sieht man nur von hier: ein gerader dunkler Strich quer durch den Schlamm. Ein Damm.", c: [
          { a: "Den Strich mit den Augen verfolgen", to: "c8" },
          { a: "Hinunter zum großen Haus", to: "a8" },
        ] },
        { id: "a8", e: "🔒", t: "Im Kasten liegt auf verblasstem Samt ein Reif aus dunklem Gold, ohne Steine. Eingeschlagen ist ein Muster: Schuppen, eine neben der anderen, rundherum. Der Kasten ist verschlossen, und der Schlüssel steckt außen.", c: [
          { a: "Aufschließen", to: "a9" },
          { a: "Das Muster genauer ansehen", to: "b9" },
        ] },
        { id: "b8", e: "🐲", t: "„Er liegt unter dem Ratssaal, seit vor der Stadt“, steht auf der nächsten Seite. „Solange er atmet, hält der Damm. Wenn keiner mehr da ist, der ihn weckt, wenn der Winter kommt, dann steigt der See über alles.“", c: [
          { a: "Nach dem Weg unter den Ratssaal suchen", to: "b9" },
          { a: "Zum Damm hinaus", to: "c9" },
        ] },
        { id: "c8", e: "〰️", t: "Der Strich läuft schnurgerade vom Ufer bis weit hinaus zu den Schornsteinen. Kein Fluss macht so etwas. Und an einer Stelle, kurz vor der zweiten Häuserreihe, ist er unterbrochen — als hätte etwas ein Stück herausgenommen.", c: [
          { a: "Zu der Lücke hinaus", to: "c9" },
          { a: "Zurück ins große Haus", to: "a9" },
        ] },
        { id: "a9", e: "👑", t: "Der Schlüssel dreht sich leicht, das Glas hebt sich, und der Reif liegt frei. Er ist schwerer, als Gold sein dürfte, und er ist warm. Draußen wird das Licht anders: Das Wasser hat gedreht.", c: [
          { a: "Den Reif nehmen und hinaus", to: "e0" },
          { a: "Ihn zurücklegen und nachsehen, was darunter ist", to: "e1" },
        ] },
        { id: "b9", e: "🕳️", t: "Unter dem Ratssaal gibt es keinen Keller, sondern eine Öffnung im Boden, so groß wie ein Tisch. Darunter ist es nicht schwarz, sondern rot glühend, ganz schwach, wie unter einer Aschedecke.", c: [
          { a: "Hinunterrufen", to: "e1" },
          { a: "Der Wärme nach hinaus zum Damm", to: "e2" },
        ] },
        { id: "c9", e: "🧱", t: "Die Lücke im Damm ist kein Schaden. Die Steine liegen ordentlich zur Seite geräumt, und dahinter geht eine Rampe schräg hinunter, unter das Wasser. Ein Weg für etwas, das sehr groß ist und trotzdem leise kommen will.", c: [
          { a: "Die Rampe hinunter", to: "e2" },
          { a: "Zurück in die Stadt, das Wasser steigt", to: "e0" },
        ] },
        { id: "e0", e: "👑", end: 0, name: "Der Reif aus dem Ratssaal", t: "Du bist im Boot, als das Wasser die Gasse nimmt, und der Reif liegt schwer in deiner Tasche. Am Ufer legt der Fährmann ihn auf die Hand und wird ganz still. „Das ist kein Schmuck“, sagt er. „Das ist ein Halsband. Und es ist zu groß für jeden Hals, den ich kenne.“" },
        { id: "e1", e: "📖", end: 1, name: "Warum sie geblieben sind", t: "Aus der Öffnung kommt keine Stimme, nur Wärme — und ein Ton, so tief, dass du ihn in den Rippen spürst. Sieben Menschen sind hier geblieben, um einmal im Jahr an eine Luke zu klopfen. Sechs sind gestorben. Der siebte wartet noch. Ab jetzt seid ihr zwei." },
        { id: "e2", e: "🌊", end: 2, name: "Die Rampe im Damm", t: "Die Rampe führt unter das Wasser und wieder heraus, in eine Halle, die der Damm trocken hält. Der Boden ist warm und in der Mitte glatt gelegen. Von hier führt eine zweite Rampe hinaus in den See — und darauf, im Schlamm, ein Abdruck, breiter als das Boot, das dich hergebracht hat." },
      ],
    },
    {
      key: "hort",
      diff: 2,
      depth: 11,
      e: "💰",
      title: "Der Hort",
      nodes: [
        { id: "s0", e: "💰", t: "„Er zählt“, sagt der Alte am Feuer. „Jeden Winter zählt er alles durch, Stück für Stück, und er kommt immer auf dieselbe Zahl. Wer etwas mitnimmt, den holt er. Nicht weil er böse ist. Weil er weiß, dass eines fehlt.“ Draußen liegt der Eingang zum Hort, offen wie eine Tür.", c: [
          { a: "Hineingehen", to: "a1" },
          { a: "Den Alten weiter ausfragen", to: "b1" },
        ] },
        { id: "a1", e: "🕯️", t: "Der Gang ist hoch genug für einen Wagen und so glatt, als wäre er poliert. Nach der zweiten Biegung wird es hell, und die Helligkeit kommt nicht von Feuer. Sie kommt von etwas, das das Licht deiner Lampe zurückwirft. Viel davon.", c: [
          { a: "Um die Biegung", to: "a2" },
          { a: "Auf dem Boden nachsehen", to: "b2" },
        ] },
        { id: "b1", e: "🧓", t: "„Zweimal ist einer zurückgekommen“, sagt der Alte. „Der eine hatte nichts dabei. Der andere hatte etwas dabei und hat es wieder hingelegt, bevor er ging.“ Er sieht ins Feuer. „Der Zweite hat mir das erzählt. Vor sechzig Jahren.“", c: [
          { a: "Hineingehen", to: "b2" },
          { a: "Fragen, ob es einen zweiten Eingang gibt", to: "c2" },
        ] },
        { id: "a2", e: "🪙", t: "Die Halle ist so groß wie eine Kirche, und der Boden ist kein Boden. Er ist Gold, Silber, Kupfer, Glas, meterhoch, bis in die Ecken. Und mitten darin, wie ein Hügel im Hügel, liegt er und atmet.", c: [
          { a: "Am Rand entlang", to: "a3" },
          { a: "Die Stücke am Rand ansehen", to: "b3" },
        ] },
        { id: "b2", e: "👣", t: "Der Boden des Ganges ist glatt gelaufen, aber nicht überall gleich. In der Mitte ist die Rinne breit und tief — da geht etwas Großes. Am Rand läuft ein schmaler Streifen, gerade eine Schuhbreite. Da ist jemand gegangen, oft.", c: [
          { a: "Auf dem schmalen Streifen weiter", to: "b3" },
          { a: "Nachsehen, wo der Streifen anfängt", to: "c3" },
        ] },
        { id: "c2", e: "🌲", t: "„Es gibt einen“, sagt der Alte langsam. „Hinter dem Wasserfall im Nordhang. Aber der ist für ihn zu eng, und deshalb schaut er da nie nach.“ Er sieht dich an. „Und deshalb geht da auch keiner rein.“", c: [
          { a: "Zum Nordhang", to: "c3" },
          { a: "Doch durch den großen Eingang", to: "a3" },
        ] },
        { id: "a3", e: "😴", t: "Aus der Nähe ist er kein Hügel. Man sieht die Schuppen einzeln, jede so groß wie ein Wagenrad, und die Rippen, die sich heben und senken. Bei jedem Ausatmen klirrt es leise im ganzen Saal.", c: [
          { a: "Weiter am Rand entlang", to: "a4" },
          { a: "Ihm ins Gesicht sehen", to: "b4" },
        ] },
        { id: "b3", e: "🔢", t: "Die Stücke am Rand liegen nicht wild. Sie liegen in Reihen, und auf jedem Stück, in die Unterseite gekratzt, steht eine Zahl. Du drehst drei um: 4471. 4472. 4473. Alles hier ist gezählt und nummeriert.", c: [
          { a: "Die Reihe entlanggehen", to: "b4" },
          { a: "Nachsehen, wo die Reihe endet", to: "c4" },
        ] },
        { id: "c3", e: "💦", t: "Hinter dem Wasserfall ist der Spalt so eng, dass du seitwärts hindurchmusst. Dahinter wird er größer, und der Boden ist trocken. An der Wand hängt eine Lampe an einem Haken, alt, aber voll Öl.", c: [
          { a: "Die Lampe nehmen und weiter", to: "c4" },
          { a: "Zum großen Eingang hinüber", to: "a4" },
        ] },
        { id: "a4", e: "🏔️", t: "Du gehst an ihm entlang, und du gehst lange. Sein Rücken ist ein Hügelkamm, sein Schwanz verschwindet in einem Seitengang. Erst jetzt siehst du, wie viel von ihm überhaupt nicht in diese Halle passt.", c: [
          { a: "Bis zum Kopf weitergehen", to: "a5" },
          { a: "Zurück zu den Reihen am Rand", to: "b5" },
        ] },
        { id: "b4", e: "📏", t: "Zwischen zwei Reihen liegt ein Brett mit einer Kerbe für jedes Hundert. Und ganz am Ende des Bretts, hinter der letzten Kerbe, steht eine einzelne Kerbe für sich allein, tiefer als alle anderen.", c: [
          { a: "Die einzelne Kerbe untersuchen", to: "b5" },
          { a: "Nachsehen, wohin das Brett zeigt", to: "c5" },
        ] },
        { id: "c4", e: "🔦", t: "Der schmale Gang läuft neben der großen Halle her; durch Ritzen im Fels fällt ihr Licht herein. Und dann steht der Gang plötzlich voller Sachen: ein Tisch, ein Hocker, Regale, alles klein und für Menschenhände gemacht.", c: [
          { a: "Die Regale ansehen", to: "c5" },
          { a: "Durch eine Ritze in die Halle", to: "a5" },
        ] },
        { id: "a5", e: "👁️", t: "Sein Kopf liegt auf den Vorderklauen, so groß wie ein Haus. Ein Auge ist zu. Das andere steht einen Spalt offen, und es bewegt sich nicht. Du weißt nicht, ob es dich sieht. Du weißt nicht einmal, ob es sehen kann.", c: [
          { a: "Ganz langsam weitergehen", to: "a6" },
          { a: "Zu dem freien Platz am Rand zurück", to: "b6" },
        ] },
        { id: "b5", e: "0️⃣", t: "Die einzelne Kerbe hat keine Zahl daneben. Sie hat ein Wort, in das Holz geritzt, klein und ordentlich: „fehlt“. Daneben liegt ein leerer Platz auf dem Boden, staubfrei und genau so groß wie eine Handfläche.", c: [
          { a: "Den leeren Platz ansehen", to: "b6" },
          { a: "Nach der schmalen Kammer suchen", to: "c6" },
        ] },
        { id: "c5", e: "📚", t: "In den Regalen stehen Bücher, alle gleich gebunden, und auf jedem Rücken eine Jahreszahl. Es sind über hundert. Du ziehst das oberste heraus: Seite für Seite Zahlen, in Spalten, in derselben Handschrift wie das Brett.", c: [
          { a: "Das neueste Buch aufschlagen", to: "c6" },
          { a: "Zurück durch die Ritze in die Halle", to: "a6" },
        ] },
        { id: "a6", e: "🪨", t: "Vor seinem Maul liegt ein Stück, das nicht wie das andere ist: kein Gold, kein Silber. Ein flacher grauer Stein, glatt geschliffen, mit einem Loch in der Mitte. Er liegt allein, mit Abstand zu allem übrigen.", c: [
          { a: "Nach dem Stein greifen", to: "a7" },
          { a: "Ihn erst betrachten", to: "b7" },
        ] },
        { id: "b6", e: "🖐️", t: "Der leere Platz ist nicht leer geräumt worden. Rundherum liegt der Staub von Jahrzehnten, und in der Mitte liegt gar keiner. Da hat etwas gelegen, bis vor kurzem. Nicht bis vor hundert Jahren — bis vor kurzem.", c: [
          { a: "In der Halle danach suchen", to: "b7" },
          { a: "In den schmalen Gang wechseln", to: "c7" },
        ] },
        { id: "c6", e: "✒️", t: "In der schmalen Kammer stehen die Bücher im Regal. Im neuesten bricht die Handschrift auf halber Seite ab, und darunter geht es weiter: größer, schiefer, mit Klauen geschrieben. Er zählt selbst, seit der Zähler nicht mehr kommt.", c: [
          { a: "Bis zur letzten Zeile lesen", to: "c7" },
          { a: "In die Halle zu ihm", to: "a7" },
        ] },
        { id: "a7", e: "🫸", t: "Der Stein ist kühl und wiegt nichts. Durch das Loch in der Mitte passt ein Finger. Und als du ihn anhebst, hört das Atmen hinter dir auf. Nicht lauter. Es hört einfach auf.", c: [
          { a: "Ihn festhalten und dich umdrehen", to: "a8" },
          { a: "Ihn zurücklegen", to: "b8" },
        ] },
        { id: "b7", e: "🔎", t: "Du gehst die Reihen ab und suchst nach einem Stück ohne Zahl. Es gibt keins. Alles hier trägt seine Nummer — bis auf einen flachen grauen Stein mit einem Loch, der vorn beim Kopf liegt und ganz allein.", c: [
          { a: "Zu dem Stein hinüber", to: "b8" },
          { a: "Erst in die schmale Kammer", to: "c8" },
        ] },
        { id: "c7", e: "📝", t: "Die letzte Zeile ist von heute. Sie lautet nicht wie die anderen. Sie ist keine Zahl. Sie lautet: „Immer noch eins zu wenig. Ich zähle weiter, bis es wieder da ist. Ich habe Zeit.“", c: [
          { a: "Das Buch mitnehmen", to: "c8" },
          { a: "In die Halle zu ihm", to: "a8" },
        ] },
        { id: "a8", e: "😳", t: "Das offene Auge ist jetzt ganz offen, und es sieht auf deine Hand. Er hebt den Kopf nicht. Er sagt nichts. Er wartet nur, so ruhig, wie ein Berg wartet, und die Stille geht bis in die letzte Ecke der Halle.", c: [
          { a: "Ihm den Stein zeigen", to: "a9" },
          { a: "Ihn fragen, was fehlt", to: "b9" },
        ] },
        { id: "b8", e: "🕯️", t: "Aus der Nähe sieht man es: Der graue Stein ist von Händen glatt geworden, nicht von Wasser. So glatt wird etwas nur, wenn es sechzig Jahre lang jemand in der Tasche hatte und immer wieder anfasste.", c: [
          { a: "Ihn dorthin legen, wo der Platz frei ist", to: "b9" },
          { a: "In den schmalen Gang zurück", to: "c9" },
        ] },
        { id: "c8", e: "🚪", t: "Am Ende des schmalen Gangs ist eine Tür in den Fels geschlagen, klein und mit einem Riegel — von innen. Dahinter Stufen, und die Stufen gehen nicht in die Halle. Sie gehen nach oben, aus dem Berg heraus.", c: [
          { a: "Die Stufen hinauf", to: "c9" },
          { a: "Doch noch einmal in die Halle", to: "a9" },
        ] },
        { id: "a9", e: "🤲", t: "Du hältst den grauen Stein hoch, so dass er ihn sehen kann. Etwas geht durch das große Auge, das man bei einem Menschen sofort verstehen würde. Dann senkt er den Kopf, ganz langsam, bis das Maul auf gleicher Höhe ist wie deine Hand.", c: [
          { a: "Den Stein behalten", to: "e0" },
          { a: "Die Hand öffnen", to: "e1" },
        ] },
        { id: "b9", e: "🗣️", t: "„Eins“, sagt er, und die Halle brummt davon. „Von 4806. Seit sechzig Jahren.“ Eine Pause, so lang, dass du das Wasser im Fels hörst. „Es war kein Schatz. Es war seins.“", c: [
          { a: "Fragen, wem es gehört hat", to: "e1" },
          { a: "Nach der kleinen Tür fragen", to: "e2" },
        ] },
        { id: "c9", e: "🪜", t: "Die Stufen sind ausgetreten, hunderte Male begangen. Oben ist eine Falltür, und über der Falltür liegt Laub. Wer hier gewohnt hat, ist jeden Tag hinein- und hinausgegangen, und der Drache hat es nie gemerkt.", c: [
          { a: "Die Falltür aufstoßen", to: "e2" },
          { a: "Umkehren in die Halle", to: "e0" },
        ] },
        { id: "e0", e: "🪨", end: 0, name: "Das eine Stück", t: "Du gehst mit dem grauen Stein hinaus, und niemand hält dich auf. Erst draußen im Licht siehst du, dass durch das Loch ein Lederband gehört und dass innen eine Zahl steht: 4806. Der Drache zählt jetzt vollständig — und du trägst das Stück, das ihm die ganze Zeit gefehlt hat, um den Hals." },
        { id: "e1", e: "🐲", end: 1, name: "Der Zähler", t: "Du legst den Stein in das riesige Maul, und er nimmt ihn so vorsichtig, wie man ein Küken nimmt. „Er hat sechzig Jahre für mich gezählt“, sagt er. „Und dann ist er nicht mehr gekommen, und ich wusste nicht, ob ich ihn suchen darf.“ Von da an zählt ihr zu zweit, einmal im Jahr." },
        { id: "e2", e: "🏚️", end: 2, name: "Die Falltür im Laub", t: "Über der Falltür steht ein Haus, in das seit sechzig Jahren niemand geht: ein Bett, ein Ofen, ein Stuhl am Fenster. Auf dem Tisch liegt ein angefangener Brief an einen Drachen. Daneben eine Kerbe im Holz für jeden Tag, an dem der Schreiber nicht mehr hinunterkam." },
      ],
    },
    {
      key: "sternwarte",
      diff: 2,
      depth: 11,
      e: "🔭",
      title: "Die Sternwarte im Fels",
      nodes: [
        { id: "s0", e: "🔭", t: "Auf halber Höhe der Nordwand sitzt eine Kuppel im Fels, aus Kupfer und grün angelaufen. Vom Tal aus sieht sie aus wie ein Buckel. Von hier oben sieht man, dass sie einen Schlitz hat — und dass der Schlitz genau nach Osten zeigt.", c: [
          { a: "Zur Kuppel hinaufsteigen", to: "a1" },
          { a: "Erst den Fels darunter absuchen", to: "b1" },
        ] },
        { id: "a1", e: "🚪", t: "Unter der Kuppel ist eine Tür in den Fels gesetzt, aus Eisen, ohne Griff und ohne Schloss. In der Mitte sitzt ein Rad, so groß wie ein Wagenrad, mit Zähnen am Rand. Es lässt sich drehen, und es geht schwer.", c: [
          { a: "Das Rad drehen", to: "a2" },
          { a: "Die Zeichen um das Rad ansehen", to: "b2" },
        ] },
        { id: "b1", e: "🪜", t: "Der Fels unter der Kuppel ist nicht gewachsen, sondern gemauert, und aus der Mauer stehen eiserne Sprossen heraus, eine über der anderen. Manche fehlen. Die, die da sind, halten.", c: [
          { a: "Zur Tür hinaufsteigen", to: "b2" },
          { a: "An der Mauer entlang um den Berg", to: "c2" },
        ] },
        { id: "a2", e: "⚙️", t: "Das Rad dreht sich eine Vierteldrehung und rastet ein. Hinter der Tür klackt es, als würde etwas Großes einen Zahn weiterspringen. Dann steht alles still, und die Tür ist immer noch zu.", c: [
          { a: "Weiterdrehen", to: "a3" },
          { a: "Auf das Klacken dahinter horchen", to: "b3" },
        ] },
        { id: "b2", e: "✴️", t: "Rund um das Rad sind Zeichen in das Eisen geschlagen: kein Alphabet, sondern Punkte in Gruppen, mit dünnen Linien verbunden. Wer schon einmal nachts nach oben geschaut hat, erkennt sie sofort. Es sind Sternbilder.", c: [
          { a: "Die Sternbilder abzählen", to: "b3" },
          { a: "Nach demselben Zeichen am Fels suchen", to: "c3" },
        ] },
        { id: "c2", e: "🌬️", t: "Um die Bergschulter herum wird der Wind schneidend, und der Steig ist kaum eine Fußbreite. Aber dahinter, im Windschatten, klafft ein Spalt im Fels, aus dem trockene, warme Luft kommt.", c: [
          { a: "In den Spalt", to: "c3" },
          { a: "Zurück zur eisernen Tür", to: "a3" },
        ] },
        { id: "a3", e: "🔁", t: "Vier Vierteldrehungen, vier Klacks — und beim vierten fährt die Tür einen Spalt auf und bleibt stehen. Dahinter ist es dunkel und riecht nach kaltem Metall und Staub. Der Spalt ist gerade breit genug für dich.", c: [
          { a: "Hindurch", to: "a4" },
          { a: "Erst hineinleuchten", to: "b4" },
        ] },
        { id: "b3", e: "🧮", t: "Es sind zwölf Sternbilder, und eines ist doppelt eingeschlagen, tiefer als die anderen. Es ist keines, das du kennst: ein langer Bogen aus sieben Punkten, mit zwei Punkten dicht beieinander am einen Ende.", c: [
          { a: "Das Rad auf dieses Zeichen stellen", to: "b4" },
          { a: "Am Fels nach demselben Bogen suchen", to: "c4" },
        ] },
        { id: "c3", e: "🕯️", t: "Der Spalt wird zum Gang, und der Gang ist gemauert. An der Wand steckt ein Kerzenhalter, und in ihm ein Kerzenstummel, an dem jemand vor sehr langer Zeit zum letzten Mal ein Streichholz gehalten hat.", c: [
          { a: "Dem Gang folgen", to: "c4" },
          { a: "Zurück und durch die eiserne Tür", to: "a4" },
        ] },
        { id: "a4", e: "🌑", t: "Drinnen ist es stockdunkel und hallt hoch. Dein Licht findet keine Wand, nur Boden — und der Boden ist eine Scheibe aus Messing, in die Linien eingelegt sind, so weit dein Schein reicht.", c: [
          { a: "Über die Scheibe zur Mitte", to: "a5" },
          { a: "Den Linien mit dem Licht folgen", to: "b5" },
        ] },
        { id: "b4", e: "🎯", t: "Beim eingestellten Zeichen läuft es hinter der Tür anders: kein Klacken, sondern ein langes Rollen, das erst unter dir und dann über dir vorbeigeht. Etwas sehr Großes hat sich gedreht. Und dann steht die Tür offen.", c: [
          { a: "Hineingehen", to: "b5" },
          { a: "Nachsehen, was sich über dir gedreht hat", to: "c5" },
        ] },
        { id: "c4", e: "🧱", t: "Der Gang endet an einer Wand, aber die Wand ist eine Rückseite: Man sieht die Mauersteine von hinten, und in der Mitte fehlt einer. Durch das Loch fällt ein Streifen Licht, der sich langsam bewegt.", c: [
          { a: "Durch das Loch schauen", to: "c5" },
          { a: "Nach der eisernen Tür suchen", to: "a5" },
        ] },
        { id: "a5", e: "🧭", t: "In der Mitte der Scheibe steht ein Gerät aus Messing und Glas, so hoch wie du: ein Rohr in einem Ring, in einem zweiten Ring, in einem dritten. Alle drei lassen sich drehen, und alle drei sind eingerostet.", c: [
          { a: "Die Ringe losdrehen", to: "a6" },
          { a: "Die Linien am Boden lesen", to: "b6" },
        ] },
        { id: "b5", e: "📐", t: "Die Linien im Boden laufen alle auf die Mitte zu, und zwischen ihnen stehen Zahlen — Winkel. Es ist keine Zeichnung. Es ist eine Uhr, und der Zeiger fehlt. Oder der Zeiger ist etwas, das noch kommt.", c: [
          { a: "Auf den Zeiger warten", to: "b6" },
          { a: "Der hellsten Linie nach an den Rand", to: "c6" },
        ] },
        { id: "c5", e: "☀️", t: "Durch das Loch siehst du in die Kuppel hinein: eine runde Halle, und quer hindurch fällt ein einziger Lichtstreifen aus dem Schlitz im Dach. Er wandert über den Boden, langsam, wie ein Zeiger.", c: [
          { a: "Dem Streifen mit den Augen folgen", to: "c6" },
          { a: "Einen Weg in die Halle suchen", to: "a6" },
        ] },
        { id: "a6", e: "🔧", t: "Der äußere Ring gibt nach, der zweite auch. Der dritte sitzt fest, bis du beide Hände nimmst — dann fährt er herum, und das Rohr richtet sich auf. Es zeigt jetzt schräg nach oben, genau auf den Schlitz.", c: [
          { a: "Durch das Rohr schauen", to: "a7" },
          { a: "Nachsehen, worauf das Rohr zeigt", to: "b7" },
        ] },
        { id: "b6", e: "⏳", t: "Der Lichtstreifen aus dem Dachschlitz wandert über die Linien, eine nach der anderen. Er ist der Zeiger. Und alle Linien sind gleich weit auseinander — bis auf zwei ganz am Rand, die dicht beieinander liegen.", c: [
          { a: "Zu den beiden engen Linien", to: "b7" },
          { a: "Am Rand entlanggehen", to: "c7" },
        ] },
        { id: "c6", e: "🪞", t: "Wo der Lichtstreifen die Wand trifft, ist keine Wand, sondern eine Scheibe aus poliertem Metall. Sie wirft das Licht zurück und quer durch die Halle, auf eine zweite Scheibe, und von dort weiter.", c: [
          { a: "Dem gespiegelten Licht folgen", to: "c7" },
          { a: "In die Mitte der Halle", to: "a7" },
        ] },
        { id: "a7", e: "✨", t: "Im Rohr ist es nicht dunkel. Obwohl es hellichter Tag ist, stehen im Glas Sterne: hunderte, gestochen scharf. Dazwischen eine Linie aus sieben, mit zwei dicht beieinander am Ende.", c: [
          { a: "Das Rohr auf die sieben stellen", to: "a8" },
          { a: "Nachsehen, wo die sieben am Boden stehen", to: "b8" },
        ] },
        { id: "b7", e: "📍", t: "Zwischen den beiden engen Linien ist die Messingscheibe abgegriffen — hier hat jemand gestanden, immer wieder, an derselben Stelle. Und im Messing ist ein flacher Abdruck, so groß wie ein Buch.", c: [
          { a: "Sich genau dorthin stellen", to: "b8" },
          { a: "Dem gespiegelten Licht folgen", to: "c8" },
        ] },
        { id: "c7", e: "🔦", t: "Von Scheibe zu Scheibe wandert das Licht durch die ganze Halle und wird jedes Mal schmaler und heller. Der letzte Strahl ist dünn wie ein Bleistift und zeigt auf eine Stelle in der Wand, an der nichts ist.", c: [
          { a: "Zu der Stelle in der Wand", to: "c8" },
          { a: "In die Mitte zu dem Rohr", to: "a8" },
        ] },
        { id: "a8", e: "🌌", t: "Als das Rohr auf den Bogen aus sieben Sternen steht, rastet unter dir etwas ein, und die ganze Messingscheibe dreht sich eine Handbreit weiter. Aus dem Boden hebt sich, mitten in der Halle, ein Kasten aus Messing.", c: [
          { a: "Den Kasten öffnen", to: "a9" },
          { a: "Erst um den Kasten herumgehen", to: "b9" },
        ] },
        { id: "b8", e: "👣", t: "Auf der abgegriffenen Stelle stehst du genau richtig. Von hier aus laufen die Linien am Boden nicht durcheinander, sondern von deinen Füßen weg wie Speichen. Von jedem anderen Punkt sieht es aus wie Gekritzel.", c: [
          { a: "Von hier aus alles betrachten", to: "b9" },
          { a: "Dem dünnen Strahl an die Wand folgen", to: "c9" },
        ] },
        { id: "c8", e: "🕳️", t: "An der Stelle, auf die der Strahl zeigt, ist die Wand einen Fingerbreit heller als überall sonst. Und als du dagegen drückst, gibt sie nach — kein Stein, sondern eine Platte, hinter der es dunkel und kühl ist.", c: [
          { a: "Die Platte aufschieben", to: "c9" },
          { a: "In die Mitte zum Kasten", to: "a9" },
        ] },
        { id: "a9", e: "📜", t: "Im Kasten liegt, in Leinen geschlagen, ein Bogen aus dünnem Leder, größer als der Deckel — er ist zusammengefaltet wie ein Brief. Auf der Außenseite steht ein einziges Wort in einer Schrift, die du nicht kennst.", c: [
          { a: "Ihn auseinanderfalten", to: "e0" },
          { a: "Warten, bis das Licht darauf fällt", to: "e1" },
        ] },
        { id: "b9", e: "🌠", t: "Von deinem Punkt aus ist es kein Gekritzel und keine Uhr. Es ist ein Bild: ein Tier mit langem Hals und ausgebreiteten Flügeln, quer über den halben Boden gelegt, aus lauter geraden Linien. Man sieht es nur von hier.", c: [
          { a: "Dem Umriss mit den Augen folgen", to: "e1" },
          { a: "Zu der hellen Stelle an der Wand", to: "e2" },
        ] },
        { id: "c9", e: "🌒", t: "Hinter der Platte ist eine Kammer ohne Fenster, kaum größer als ein Schrank. Es ist die einzige Stelle in der ganzen Sternwarte, die das Licht nie erreicht — und genau deshalb hat jemand sie gebaut.", c: [
          { a: "Hineingehen", to: "e2" },
          { a: "Zurück in die Mitte", to: "e0" },
        ] },
        { id: "e0", e: "⭐", end: 0, name: "Die Drachenkarte", t: "Der Bogen ist größer als du. Sterne, hunderte, und dazwischen mit feinem Strich die Wege eingezeichnet: von Berg zu Berg, von Insel zu Insel, quer über das ganze Blatt. Es ist keine Sternkarte. Es ist eine Karte für jemanden, der oben fliegt und sich unten nicht auskennt." },
        { id: "e1", e: "🔭", end: 1, name: "Der letzte Sternseher", t: "Als der Lichtstreifen den Umriss erreicht, glüht er von einem Ende zum anderen auf, und in der Halle wird es einen Atemzug lang warm. Wer das gebaut hat, hat nicht die Sterne beobachtet. Er hat einem Freund, der über den Wolken flog, gesagt: Ich sehe dich, und ich weiß, wo du bist." },
        { id: "e2", e: "🥚", end: 2, name: "Die Kammer ohne Licht", t: "In der dunklen Kammer steht ein Gestell aus Eisen, und darauf liegt, in Wolle gebettet, ein Ei — grau, kalt und so groß wie ein Kürbis. Daneben ein Krug, ein Löffel und eine Decke, ordentlich zusammengelegt. Jemand hat hier gewartet, sehr lange, und ist dann gegangen." },
      ],
    },
  ],
};
