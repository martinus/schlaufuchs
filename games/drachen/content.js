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
//
// SHAPE. Every story is a LAYERED DAG: the start node, then layers of scenes,
// then exactly three endings — and every path from the start to an ending has
// the same number of scenes (`depth`). That is what lets the round's scene draw
// a fixed path, so the fox reaches the basket exactly as the ending appears.
// Choices always go one layer forward, never sideways and never back. The
// skeleton is the same for every story of a depth (s0 → a1/b1 → a2/b2/c2 → …),
// which is what keeps the no-lock-out property below true by construction.
//
// NO LOCK-OUT. From every scene except the last choice, all three endings are
// still reachable; on the last choice each scene still offers two. So early
// choices change WHICH scenes she reads — real variety, real reason to replay —
// and no early choice ever quietly puts the ending she is hunting out of reach.
// tests/drachen-content.test.js proves both, per story.
//
// EDITORIAL RULES, none of them machine-checkable:
//   • Funny and exciting, never frightening. The dragon is a character, never a
//     threat: nothing attacks, nothing is lost, nobody is hurt (§8).
//   • Each story has two lovely endings and one FUNNY MISHAP — something that
//     goes comically sideways. It is never a failure and never a punishment: it
//     pays exactly the same star as the other two, and the child laughs with the
//     dragon, not at herself.
//   • The three endings must be tellable apart from their names alone, or the
//     "???" on the summary's ending strip is no tease at all.
//   • Choices are ACTIONS she takes ("Leise hinterherschleichen"), never
//     opinions about herself ("Sei mutig").
//   • The scene emoji sets the scene; it never gives away which ending is
//     coming (§14.2).
//   • She is "du". She is the one in the story, not a character she watches.

export const STORIES = {
  de: [
    // ---- Leicht: short sentences, everyday words, five scenes -------------
    {
      key: "ei",
      diff: 0,
      depth: 5,
      e: "🥚",
      title: "Das gestohlene Ei",
      nodes: [
        { id: "s0", e: "🥚", t: "Im Nest der Drachenmutter fehlt ein Ei. Eine glitzernde Spur führt ins Gras. „Bitte hilf mir!“, schnauft die Drachenmutter.", c: [
          { a: "Der Glitzerspur folgen", to: "a1" },
          { a: "Zuerst das leere Nest ansehen", to: "b1" },
        ] },
        { id: "a1", e: "💧", t: "Die Spur führt zum Bach. Zwischen den Steinen klemmt eine schwarze Feder.", c: [
          { a: "Die Feder mitnehmen", to: "a2" },
          { a: "Über den Bach springen", to: "b2" },
        ] },
        { id: "b1", e: "📄", t: "Im Nest liegt ein winziger Zettel. Jemand hat einen Vogel darauf gekritzelt.", c: [
          { a: "Den Zettel einstecken", to: "b2" },
          { a: "Nach oben in die Bäume schauen", to: "c2" },
        ] },
        { id: "a2", e: "🐸", t: "Am Bach sitzt ein Frosch mit dicken Backen. Er zeigt mit dem Fuß nach oben.", c: [
          { a: "Den Frosch fragen", to: "a3" },
          { a: "Auf den Baum klettern", to: "b3" },
        ] },
        { id: "b2", e: "🌳", t: "Über dem Bach hängt ein alter Baum voller Nester. Etwas blitzt darin.", c: [
          { a: "Leise hinaufklettern", to: "b3" },
          { a: "Von unten hinaufrufen", to: "c3" },
        ] },
        { id: "c2", e: "🐦‍⬛", t: "Ganz oben schaukelt ein Nest. Eine Elster sitzt darauf und putzt sich.", c: [
          { a: "Der Elster zuwinken", to: "c3" },
          { a: "Um den Baum herumschleichen", to: "a3" },
        ] },
        { id: "a3", e: "✨", t: "Die Elster hat das Ei. Sie hält es fest wie ihren größten Schatz.", c: [
          { a: "Ihr etwas Glitzerndes anbieten", to: "e0" },
          { a: "Ganz sanft nach dem Ei greifen", to: "e1" },
        ] },
        { id: "b3", e: "🪺", t: "Das Ei liegt warm im Nest. Es wackelt. Da drinnen klopft jemand!", c: [
          { a: "Das Ei vorsichtig halten", to: "e1" },
          { a: "Am Ei horchen", to: "e2" },
        ] },
        { id: "c3", e: "🤲", t: "Die Elster erschrickt und lässt los. Du fängst das Ei mit beiden Armen.", c: [
          { a: "Am Ei horchen", to: "e2" },
          { a: "Der Elster hinterherschauen", to: "e0" },
        ] },
        { id: "e0", e: "💎", end: 0, name: "Der Elsternschatz", t: "Die Elster tauscht. Sie gibt das Ei her und zeigt dir ihr Versteck. Darin: Löffel, Ringe, ein Knopf aus Gold. Die Drachenmutter darf sich etwas aussuchen." },
        { id: "e1", e: "🐣", end: 1, name: "Das kleine Küken", t: "Das Ei knackt in deinen Armen. Ein winziger Drache purzelt heraus, blinzelt dich an und piepst: „Mama?“ Du lachst. „Fast!“" },
        { id: "e2", e: "😅", end: 2, name: "Rußnase", t: "Du hältst das Ei ans Ohr. Da niest der kleine Drache — mitten durch die Schale. Ruß! Du bist schwarz von oben bis unten." },
      ],
    },
    {
      key: "bruecke",
      diff: 0,
      depth: 5,
      e: "😴",
      title: "Der Brückendrache",
      nodes: [
        { id: "s0", e: "😴", t: "Ein Drache ist auf der Dorfbrücke eingeschlafen. Niemand kommt mehr vorbei. Sein Schnarchen klingt wie ein Gewitter.", c: [
          { a: "Ihn ganz vorsichtig antippen", to: "a1" },
          { a: "Erst um ihn herumgehen", to: "b1" },
        ] },
        { id: "a1", e: "👂", t: "Der Drache brummt und dreht sich um. Ein Ohr klappt auf wie ein Tor.", c: [
          { a: "In das Ohr flüstern", to: "a2" },
          { a: "Am Schwanz ziehen", to: "b2" },
        ] },
        { id: "b1", e: "🎒", t: "Auf der anderen Seite liegt ein Rucksack. Darin stecken eine Trompete und eine Tüte Tee.", c: [
          { a: "Die Trompete herausnehmen", to: "b2" },
          { a: "Die Teetüte herausnehmen", to: "c2" },
        ] },
        { id: "a2", e: "💤", t: "Du flüsterst: „Aufwachen!“ Der Drache murmelt: „Noch fünf Minuten.“", c: [
          { a: "Lauter rufen", to: "a3" },
          { a: "Ihn kitzeln", to: "b3" },
        ] },
        { id: "b2", e: "🫃", t: "Der Drache zuckt. Sein Bauch gluckert laut. Er hat wohl Bauchweh.", c: [
          { a: "Nach etwas Beruhigendem suchen", to: "b3" },
          { a: "Ein lautes Geräusch machen", to: "c3" },
        ] },
        { id: "c2", e: "🌼", t: "Der Tee riecht nach Kamille. Daneben liegt ein Zettel: „Gegen Bauchweh.“", c: [
          { a: "Wasser vom Bach holen", to: "c3" },
          { a: "Am Kopf des Drachen nachsehen", to: "a3" },
        ] },
        { id: "a3", e: "🏘️", t: "Das halbe Dorf steht jetzt hinter dir. Der Bäcker hat die Trompete, die Wirtin eine Kanne.", c: [
          { a: "Alle zusammen Musik machen lassen", to: "e0" },
          { a: "Erst die Kanne aufsetzen", to: "e1" },
        ] },
        { id: "b3", e: "👃", t: "Der Drachenbauch gluckert immer lauter. Seine Nase zittert.", c: [
          { a: "Ihm den Tee unter die Nase halten", to: "e1" },
          { a: "Die zitternde Nase kitzeln", to: "e2" },
        ] },
        { id: "c3", e: "🪶", t: "Du hältst eine Feder in der Hand und hörst hinter dir die Trompete.", c: [
          { a: "Mit der Feder an die Nase", to: "e2" },
          { a: "Der Trompete ein Zeichen geben", to: "e0" },
        ] },
        { id: "e0", e: "🎺", end: 0, name: "Das Weckkonzert", t: "Das ganze Dorf spielt los: Trompete, Töpfe, Deckel. Der Drache springt auf, klatscht Beifall und tanzt über die Brücke davon." },
        { id: "e1", e: "🫖", end: 1, name: "Kamillentee für Kalle", t: "Der Drache schnuppert, öffnet ein Auge und trinkt die ganze Kanne aus. „Ich heiße Kalle“, seufzt er, „und mir geht es viel besser.“" },
        { id: "e2", e: "🤧", end: 2, name: "Der Kitzelnieser", t: "Die Nase zittert, zittert — und dann: HATSCHI! Der Drache pustet dich mitten ins Heu. Danach entschuldigt er sich sehr höflich." },
      ],
    },
    {
      key: "post",
      diff: 0,
      depth: 5,
      e: "📜",
      title: "Die Drachenpost",
      nodes: [
        { id: "s0", e: "📜", t: "Der Briefträger traut sich nicht. „Ein Brief für den Drachen auf dem Turm“, sagt er. Dann drückt er ihn dir in die Hand.", c: [
          { a: "Die Turmtreppe hochsteigen", to: "a1" },
          { a: "Erst den Brief anschauen", to: "b1" },
        ] },
        { id: "a1", e: "🏰", t: "Zweihundert Stufen. Oben pfeift der Wind, und eine große Klappe steht offen.", c: [
          { a: "Durch die Klappe schauen", to: "a2" },
          { a: "Anklopfen und warten", to: "b2" },
        ] },
        { id: "b1", e: "✉️", t: "Auf dem Umschlag steht: „An Ruby, sehr dringend.“ Er riecht nach Zimt.", c: [
          { a: "Am Umschlag schnuppern", to: "b2" },
          { a: "Nach hinten in den Turmgarten gehen", to: "c2" },
        ] },
        { id: "a2", e: "🍽️", t: "Drinnen sitzt eine Drachendame vor einem leeren Teller und schaut traurig.", c: [
          { a: "Ihr den Brief geben", to: "a3" },
          { a: "Fragen, was los ist", to: "b3" },
        ] },
        { id: "b2", e: "👀", t: "Es klappert. Ruby steckt den Kopf heraus: „Ein Brief? Für mich?“", c: [
          { a: "Sie erst einmal beruhigen", to: "b3" },
          { a: "Ihr den Brief hinhalten", to: "c3" },
        ] },
        { id: "c2", e: "🍪", t: "Im Turmgarten steht ein Backofen. Darin liegt ein Blech mit Zimtkeksen.", c: [
          { a: "Die Kekse mit hochnehmen", to: "c3" },
          { a: "Zurück zur Treppe laufen", to: "a3" },
        ] },
        { id: "a3", e: "😊", t: "Ruby liest und strahlt. „Meine Schwester kommt zu Besuch! Über den Wolken!“", c: [
          { a: "Fragen, ob du mitfliegen darfst", to: "e0" },
          { a: "Beim Tischdecken helfen", to: "e1" },
        ] },
        { id: "b3", e: "🌬️", t: "Ruby ist aufgeregt. Sie schnauft, und der Brief flattert dir aus der Hand.", c: [
          { a: "Schnell danach greifen", to: "e1" },
          { a: "Dem Brief hinterherschauen", to: "e2" },
        ] },
        { id: "c3", e: "😮", t: "Du stehst mit dem Blech Kekse da. Ruby hat den Umschlag schon halb im Mund.", c: [
          { a: "„Nicht essen!“ rufen", to: "e2" },
          { a: "Mit ihr aufs Dach klettern", to: "e0" },
        ] },
        { id: "e0", e: "🌈", end: 0, name: "Der Regenbogenflug", t: "Ruby nimmt dich auf den Rücken. Ihr steigt durch eine Wolke. Plötzlich steht ein Regenbogen quer über dem Turm. Ihr fliegt mitten hindurch." },
        { id: "e1", e: "🍰", end: 1, name: "Kekse für drei", t: "Ihr deckt den Tisch, und die Zimtkekse sind noch warm. Rubys Schwester landet krachend im Garten — und isst neun Stück am Stück." },
        { id: "e2", e: "😳", end: 2, name: "Post im Bauch", t: "Zu spät. Ruby schluckt. „Ups“, sagt sie. „Was stand denn drin?“ Ihr müsst den ganzen Brief noch einmal neu schreiben. Auswendig." },
      ],
    },

    // ---- Mittel: longer sentences, six scenes ------------------------------
    {
      key: "markt",
      diff: 1,
      depth: 6,
      e: "🏺",
      title: "Der Drachenmarkt",
      nodes: [
        { id: "s0", e: "🏺", t: "Einmal im Jahr kommt der Drachenmarkt ins Dorf. Zwischen den Ständen stehen Kisten voller Schuppen, Krallen und alter Bücher. Der Marktmeister ruft: „Wer den goldenen Zahn findet, darf sich etwas wünschen!“", c: [
          { a: "Bei den Bücherkisten anfangen", to: "a1" },
          { a: "Zwischen den Schuppenständen suchen", to: "b1" },
        ] },
        { id: "a1", e: "📕", t: "In einer Kiste liegt ein Buch ohne Titel. Auf der ersten Seite ist eine Karte des Marktes gezeichnet, und ein einziger Stand ist rot eingekringelt.", c: [
          { a: "Den eingekringelten Stand suchen", to: "a2" },
          { a: "Das Buch weiterblättern", to: "b2" },
        ] },
        { id: "b1", e: "🟡", t: "Die Schuppen glitzern in allen Farben. Eine davon ist warm — richtig warm, als hätte sie eben noch jemand getragen.", c: [
          { a: "Die warme Schuppe mitnehmen", to: "b2" },
          { a: "Fragen, wem sie gehört", to: "c2" },
        ] },
        { id: "a2", e: "🪥", t: "Der rote Kringel führt zu einem Stand mit Zahnbürsten, groß wie Besen. Ein sehr großer Drache sitzt davor und hält sich die Backe.", c: [
          { a: "Ihn nach dem goldenen Zahn fragen", to: "a3" },
          { a: "Ihm eine Zahnbürste reichen", to: "b3" },
        ] },
        { id: "b2", e: "✍️", t: "Auf der letzten Seite steht in krakeliger Schrift: „Der goldene Zahn tut weh. Sucht den, der nicht lacht.“", c: [
          { a: "Nach jemandem suchen, der nicht lacht", to: "b3" },
          { a: "Das Buch dem Marktmeister zeigen", to: "c3" },
        ] },
        { id: "c2", e: "⛺", t: "„Die gehört Bodo“, sagt die Händlerin und zeigt hinter ihr Zelt. „Er verliert seit Tagen Schuppen. Und er sagt kein Wort mehr.“", c: [
          { a: "Hinter das Zelt gehen", to: "c3" },
          { a: "Doch lieber nach Zahnbürsten fragen", to: "a3" },
        ] },
        { id: "a3", e: "😬", t: "Bodo macht den Mund auf. Ganz hinten blitzt es golden — und der Zahn wackelt bei jedem Atemzug ein Stückchen mit.", c: [
          { a: "Ganz vorsichtig daran wackeln", to: "a4" },
          { a: "Erst etwas Kaltes holen", to: "b4" },
        ] },
        { id: "b3", e: "💨", t: "Bodo brummt und dreht den Kopf weg. Aus seiner Nase kringelt sich ein dünnes Rauchwölkchen nach oben.", c: [
          { a: "Sich neben ihn setzen und warten", to: "b4" },
          { a: "Ihm die warme Schuppe hinhalten", to: "c4" },
        ] },
        { id: "c3", e: "🍎", t: "Hinter dem Zelt sitzt Bodo im Schatten. Vor ihm liegt ein Berg verlorener Schuppen und ein Apfel, von dem er einmal abgebissen hat.", c: [
          { a: "Den Apfel wegräumen", to: "c4" },
          { a: "Ihn nach seinem Zahn fragen", to: "a4" },
        ] },
        { id: "a4", e: "🦷", t: "Der goldene Zahn löst sich mit einem leisen Klick. Bodo macht große Augen und atmet zum ersten Mal seit Tagen ohne zu zucken.", c: [
          { a: "Den Zahn dem Marktmeister bringen", to: "e0" },
          { a: "Bodo den Zahn schenken", to: "e1" },
        ] },
        { id: "b4", e: "🌫️", t: "Du sitzt neben Bodo. Er lehnt sich an dich, und der Rauch aus seiner Nase wird dicker und dicker.", c: [
          { a: "Den Zahn festhalten und ziehen", to: "e1" },
          { a: "Ihm direkt ins Gesicht schauen", to: "e2" },
        ] },
        { id: "c4", e: "🔥", t: "Bodo schnappt nach der warmen Schuppe, verfehlt sie und holt Luft. Sein Hals leuchtet innen kurz orange.", c: [
          { a: "Ganz nah heran und nachschauen", to: "e2" },
          { a: "Zurückspringen und rufen", to: "e0" },
        ] },
        { id: "e0", e: "🪙", end: 0, name: "Die goldene Schuppe", t: "Der Marktmeister wiegt den Zahn und pfeift. „Ein Wunsch für dich!“ Du wünschst dir, dass Bodo einen eigenen Stand bekommt. Am nächsten Morgen steht er da: Bodos Zahnbürsten." },
        { id: "e1", e: "🐉", end: 1, name: "Ein Freund mit Zahnweh", t: "„Behalt ihn“, sagst du. Bodo hält den goldenen Zahn wie einen Schatz. Dann lächelt er, und es ist sein erstes Lächeln seit Tagen. Ab jetzt begleitet er dich über jeden Markt." },
        { id: "e2", e: "😆", end: 2, name: "Angesengte Augenbrauen", t: "Du schaust genau in dem Moment hinein, in dem Bodos Niesen kommt. FFFFT! Deine Augenbrauen sind weg. Bodo entschuldigt sich hundertmal und malt dir mit Ruß neue auf." },
      ],
    },
    {
      key: "wolken",
      diff: 1,
      depth: 6,
      e: "☁️",
      title: "Die Wolkenwäsche",
      nodes: [
        { id: "s0", e: "☁️", t: "Über dem Tal hängt eine Wolke fest. Sie ist grau und schief und sieht aus, als wäre sie ewig nicht gewaschen worden. Ein Drache mit einer Wäscheklammer im Maul winkt dich zu sich.", c: [
          { a: "Auf seinen Rücken klettern", to: "a1" },
          { a: "Erst fragen, was er vorhat", to: "b1" },
        ] },
        { id: "a1", e: "🛏️", t: "Ihr steigt in die Höhe. Von oben sieht die Wolke aus wie ein riesiges Bettlaken — und darin hängen lauter Sachen fest.", c: [
          { a: "Nach den Sachen greifen", to: "a2" },
          { a: "Einmal um die Wolke fliegen", to: "b2" },
        ] },
        { id: "b1", e: "🧺", t: "„Ich bin Wolkenwäscher“, brummt er. „Aber meine Leine ist gerissen, und jetzt hängt alles im Grau fest.“", c: [
          { a: "Nach der Leine suchen", to: "b2" },
          { a: "Nach seiner Wäsche fragen", to: "c2" },
        ] },
        { id: "a2", e: "🧦", t: "Du ziehst — und heraus kommt eine Socke. Dann noch eine. Dann ein ganzer Strumpf, so lang wie ein Gartenzaun.", c: [
          { a: "Weiterziehen", to: "a3" },
          { a: "Die Socke gut festhalten", to: "b3" },
        ] },
        { id: "b2", e: "➰", t: "Auf der Rückseite der Wolke hängt die gerissene Leine. Ein Ende flattert im Wind, das andere steckt tief im Grau.", c: [
          { a: "Am flatternden Ende ziehen", to: "b3" },
          { a: "Die beiden Enden verknoten", to: "c3" },
        ] },
        { id: "c2", e: "🧣", t: "„Zwei Socken, ein Handtuch und mein Sonntagsschal“, zählt er auf. „Und der Regen. Der hängt auch fest.“", c: [
          { a: "Nach dem Regen fragen", to: "c3" },
          { a: "Nach den Socken suchen", to: "a3" },
        ] },
        { id: "a3", e: "🏞️", t: "Die Wolke wird immer dünner, je mehr du herausziehst. Unten im Tal bleiben die Leute stehen und schauen nach oben.", c: [
          { a: "Noch fester ziehen", to: "a4" },
          { a: "Kurz innehalten und hinunterschauen", to: "b4" },
        ] },
        { id: "b3", e: "🫧", t: "Etwas Schweres rutscht. Die Wolke schwappt wie eine Badewanne, und weißer Schaum quillt über den Rand.", c: [
          { a: "Dich am Drachen festhalten", to: "b4" },
          { a: "In den Schaum greifen", to: "c4" },
        ] },
        { id: "c3", e: "🪣", t: "„Der Regen sitzt ganz unten“, sagt der Drache und schaut dich an. „Da müsste jemand hinein, der klein genug ist.“", c: [
          { a: "Dich nach unten abseilen lassen", to: "c4" },
          { a: "Ihn erst die Leine spannen lassen", to: "a4" },
        ] },
        { id: "a4", e: "⛰️", t: "Die Leine hängt straff zwischen zwei Bergspitzen. Die Wolke wackelt darauf wie ein nasses Laken im Wind.", c: [
          { a: "Die Wolke kräftig ausschütteln", to: "e0" },
          { a: "Die Socken ordentlich aufhängen", to: "e1" },
        ] },
        { id: "b4", e: "🔔", t: "Du hängst am Drachenhals. Unter dir wogt der Schaum, und irgendwo darin klingelt etwas ganz leise.", c: [
          { a: "Nach dem Klingeln greifen", to: "e1" },
          { a: "Loslassen", to: "e2" },
        ] },
        { id: "c4", e: "🙃", t: "Kopfüber steckst du bis zu den Ohren im Wolkenschaum. Es kitzelt, es piekst, und es riecht nach frischer Wäsche.", c: [
          { a: "Noch tiefer tauchen", to: "e2" },
          { a: "Nach oben rufen", to: "e0" },
        ] },
        { id: "e0", e: "🌦️", end: 0, name: "Der erste Regen", t: "Ihr schüttelt die Wolke aus wie ein Bettlaken, und der Regen fällt endlich. Im ganzen Tal rennen die Leute mit Töpfen und Eimern hinaus und tanzen dabei." },
        { id: "e1", e: "🥾", end: 1, name: "Die Wolkensocken", t: "Was da klingelte, waren zwei Socken aus reiner Wolke. Der Drache schenkt sie dir. Wer sie anzieht, macht keinen einzigen Schritt mehr laut." },
        { id: "e2", e: "🛁", end: 2, name: "Kopfüber im Schaum", t: "Du lässt los und plumpst mitten hinein. Als der Drache dich herauszieht, bist du weiß von oben bis unten und riechst drei Tage lang nach Seife." },
      ],
    },
    {
      key: "buecherei",
      diff: 1,
      depth: 6,
      e: "📚",
      title: "Die Höhlenbücherei",
      nodes: [
        { id: "s0", e: "📚", t: "Tief im Berg liegt eine Bücherei. Die Regale reichen bis unter die Decke, und dazwischen schnarcht ein Drache mit einer Brille auf der Nase. Auf seinem Bauch liegt ein aufgeschlagenes Buch.", c: [
          { a: "Das Buch vorsichtig nehmen", to: "a1" },
          { a: "Sich zwischen den Regalen umsehen", to: "b1" },
        ] },
        { id: "a1", e: "🖋️", t: "Kaum hast du es in der Hand, blättert es von allein um. Auf der neuen Seite steht dein Name.", c: [
          { a: "Weiterlesen", to: "a2" },
          { a: "Das Buch zuklappen", to: "b2" },
        ] },
        { id: "b1", e: "🔖", t: "In den Regalen stehen tausend Bücher — und eines steht falsch herum. Sein Rücken zeigt nach hinten.", c: [
          { a: "Das falsche Buch herausziehen", to: "b2" },
          { a: "Die Reihe entlanggehen", to: "c2" },
        ] },
        { id: "a2", e: "👁️", t: "„Du stehst in einer Höhle“, liest du. „Vor dir schnarcht ein Drache.“ Du schaust auf. Der Drache hat ein Auge geöffnet.", c: [
          { a: "Ihn ansprechen", to: "a3" },
          { a: "Weiterlesen, was jetzt passiert", to: "b3" },
        ] },
        { id: "b2", e: "🕳️", t: "Hinter dem Buch klafft ein Loch im Regal. Darin steckt eine Kerze, die noch warm ist.", c: [
          { a: "Die Kerze anzünden", to: "b3" },
          { a: "In das Loch hineingreifen", to: "c3" },
        ] },
        { id: "c2", e: "⚠️", t: "Am Ende der Reihe hängt ein Schild: „Bitte nicht laut lesen.“ Darunter hat jemand gekritzelt: „Es liest zurück.“", c: [
          { a: "Trotzdem laut lesen", to: "c3" },
          { a: "Zum schnarchenden Drachen zurückgehen", to: "a3" },
        ] },
        { id: "a3", e: "🥱", t: "„Endlich“, gähnt der Drache. „Seit vierhundert Jahren liest mir keiner mehr vor. Meine Augen sind zu alt geworden.“", c: [
          { a: "Ihm vorlesen", to: "a4" },
          { a: "Nach seiner Brille schauen", to: "b4" },
        ] },
        { id: "b3", e: "🔤", t: "Die Buchstaben auf der Seite verrutschen. Sie ordnen sich neu und bilden einen einzigen Satz: „Wer bist du?“", c: [
          { a: "Antworten", to: "b4" },
          { a: "Die Seite umdrehen", to: "c4" },
        ] },
        { id: "c3", e: "🗣️", t: "Deine Stimme hallt durch den ganzen Berg. Von allen Regalen antwortet ein Flüstern — tausend Bücher lesen mit.", c: [
          { a: "Leiser werden", to: "c4" },
          { a: "Zum Drachen laufen", to: "a4" },
        ] },
        { id: "a4", e: "🐕", t: "Der Drache legt den Kopf auf die Pfoten wie ein Hund. Über euch wird es dunkel, und nur noch eine Kerze brennt.", c: [
          { a: "Bis zur letzten Seite vorlesen", to: "e0" },
          { a: "Die Kerze näher schieben", to: "e1" },
        ] },
        { id: "b4", e: "⏩", t: "Das Buch schreibt weiter, schneller als du lesen kannst. Gerade erzählt es, wie du das Buch umdrehst.", c: [
          { a: "Das Buch zumachen", to: "e1" },
          { a: "Es tatsächlich umdrehen", to: "e2" },
        ] },
        { id: "c4", e: "🌀", t: "Das Flüstern wird zu einem Chor. Alle Bücher erzählen dieselbe Geschichte — nur von hinten nach vorn.", c: [
          { a: "Rückwärts mitlesen", to: "e2" },
          { a: "Zum Drachen zurückrennen", to: "e0" },
        ] },
        { id: "e0", e: "📖", end: 0, name: "Das Buch, das zurückliest", t: "Du liest bis zur letzten Seite. Dort steht nur: „Danke.“ Der Drache schnarcht wieder, diesmal lächelnd. Und ganz langsam erscheint ein neuer Satz: „Kommst du morgen wieder?“" },
        { id: "e1", e: "🕯️", end: 1, name: "Die Leselampe", t: "Der alte Drache pustet ganz leise in die Kerze, und sie brennt heller als jede Lampe. „Nimm sie mit“, sagt er. „Wer sie anzündet, kann jede Schrift lesen. Auch die allerkleinste.“" },
        { id: "e2", e: "🤸", end: 2, name: "Verkehrt herum", t: "Du drehst das Buch um. Sofort steht alles auf dem Kopf: die Regale, der Drache, du. Es dauert bis zum Abend, bis der Drache aufhört zu lachen und dich wieder umdreht." },
      ],
    },

    // ---- Schwer: longer scenes, seven of them ------------------------------
    {
      key: "berg",
      diff: 2,
      depth: 7,
      e: "🌋",
      title: "Der Drache im Berg",
      nodes: [
        { id: "s0", e: "🌋", t: "Seit drei Tagen bebt der Berg. Die Töpfe klirren, die Hühner legen keine Eier mehr, und im Dorf packen die Ersten ihre Sachen. Der alte Schmied hält dir eine Laterne hin. „Da drin wohnt etwas“, sagt er. „Und es ist nicht der Berg.“", c: [
          { a: "Durch den alten Stollen hineingehen", to: "a1" },
          { a: "Zuerst am Berg entlanggehen und lauschen", to: "b1" },
        ] },
        { id: "a1", e: "🏮", t: "Der Stollen riecht nach Rauch und Regen. Alle zwölf Sekunden zittert der Boden, und von der Decke rieselt Staub. Zwölf Sekunden — jedes Mal genau zwölf.", c: [
          { a: "Die Zeit zwischen den Beben zählen", to: "a2" },
          { a: "Dem Rauchgeruch nachgehen", to: "b2" },
        ] },
        { id: "b1", e: "💨", t: "An der Nordseite ist der Fels warm. Aus einer Spalte zieht ein dünner Faden Dampf, und aus der Tiefe kommt ein Geräusch: nicht wie Donner, eher wie ein sehr großes Hicksen.", c: [
          { a: "In die Spalte hineinrufen", to: "b2" },
          { a: "Die Spalte größer machen", to: "c2" },
        ] },
        { id: "a2", e: "✒️", t: "Genau zwölf Sekunden. Kein Erdbeben ist so pünktlich. Du hältst die Laterne an die Wand und siehst Kratzspuren, die jemand in den Fels gezählt hat: Strich für Strich, hunderte davon.", c: [
          { a: "Die Striche zählen", to: "a3" },
          { a: "Der Kratzspur weiter folgen", to: "b3" },
        ] },
        { id: "b2", e: "🕳️", t: "Der Rauch führt dich in eine Halle, so groß wie das ganze Dorf. In der Mitte liegt ein Drache zusammengerollt. Bei jedem Hicksen hebt sich die Halle einen halben Meter.", c: [
          { a: "Näher gehen", to: "b3" },
          { a: "Erst nach einem Ausweg schauen", to: "c3" },
        ] },
        { id: "c2", e: "💧", t: "Die Spalte gibt nach, und du rutschst in einen Gang voller Wasser. In den Pfützen schwimmen Schuppen, so groß wie Teller — und jede einzelne hat einen Sprung.", c: [
          { a: "Eine Schuppe mitnehmen", to: "c3" },
          { a: "Dem Wasser bergauf folgen", to: "a3" },
        ] },
        { id: "a3", e: "🔢", t: "Vierhundertzwölf Striche. Jemand liegt hier seit vierhundertzwölf Tagen und zählt. Beim letzten Strich hat der Kratzer aufgehört — mitten im Strich.", c: [
          { a: "Nach dem rufen, der gezählt hat", to: "a4" },
          { a: "Am letzten Strich weiterkratzen", to: "b4" },
        ] },
        { id: "b3", e: "👁️", t: "Der Drache öffnet ein Auge, so groß wie ein Wagenrad. „Bitte“, sagt er leise, „nicht erschrecken. Ich habe alles versucht. Es hilft nicht.“ HICKS. Die ganze Halle hebt sich.", c: [
          { a: "Fragen, seit wann das so geht", to: "b4" },
          { a: "Etwas zu trinken für ihn suchen", to: "c4" },
        ] },
        { id: "c3", e: "🐚", t: "Du hältst eine gesprungene Schuppe ins Licht. Innen ist sie hohl, und darin klingt es wie Wasser in einer Flasche. Alle zwölf Sekunden klingt sie mit.", c: [
          { a: "Die Schuppe ans Ohr halten", to: "c4" },
          { a: "Zurück in die große Halle", to: "a4" },
        ] },
        { id: "a4", e: "🪨", t: "Er heißt Grimm und liegt hier fest: Ein Felsbrocken klemmt zwischen seinen Flügeln. Vom Hicksen ist er immer tiefer gerutscht. „Vierhundertzwölf Tage“, sagt er. „Ich zähle nicht weiter.“", c: [
          { a: "Den Felsbrocken untersuchen", to: "a5" },
          { a: "Ihm versprechen wiederzukommen", to: "b5" },
        ] },
        { id: "b4", e: "🍎", t: "„Seit ich das Herz des Berges verschluckt habe“, brummt Grimm. „Ein Stein, so groß wie dein Kopf. Ich dachte, es wäre ein Apfel.“ HICKS. Von der Decke fällt ein Brocken.", c: [
          { a: "Nach dem Herz des Berges fragen", to: "b5" },
          { a: "Ihn erschrecken wollen", to: "c5" },
        ] },
        { id: "c4", e: "📣", t: "Aus der Schuppe hörst du eine zweite Stimme, ganz weit weg: „Hallo? Ist da wer?“ Irgendwo im Berg wartet noch jemand — und zählt vielleicht auch mit.", c: [
          { a: "Zurückrufen", to: "c5" },
          { a: "Der Stimme entgegengehen", to: "a5" },
        ] },
        { id: "a5", e: "🪵", t: "Der Brocken sitzt fest, aber darunter liegt eine Fuge. Mit einem Hebel und einem guten Moment wäre er zu bewegen — und der beste Moment kommt alle zwölf Sekunden.", c: [
          { a: "Beim nächsten Hicksen hebeln", to: "e0" },
          { a: "Grimm bitten mitzuhelfen", to: "e1" },
        ] },
        { id: "b5", e: "🌩️", t: "Grimm hält die Luft an, so lange er kann. Sein Hals wird dick, seine Augen werden schmal, und in seinem Bauch grummelt es wie ein Gewitter, das sich nicht entscheiden kann.", c: [
          { a: "Ihn ganz ruhig weiteratmen lassen", to: "e1" },
          { a: "Laut BUH rufen", to: "e2" },
        ] },
        { id: "c5", e: "🪣", t: "Die zweite Stimme kommt näher. Es ist ein kleiner Drache mit einem Eimer Wasser. „Ich hole ihm seit vierhundert Tagen Wasser“, sagt er. „Geholfen hat es noch nie.“", c: [
          { a: "Es trotzdem noch einmal versuchen", to: "e2" },
          { a: "Die beiden gemeinsam ziehen lassen", to: "e0" },
        ] },
        { id: "e0", e: "💎", end: 0, name: "Das Herz des Berges", t: "Beim nächsten Hicksen hebelt ihr, und der Brocken kippt. Grimm streckt sich zum ersten Mal seit vierhundert Tagen, hustet, und ein glatter roter Stein rollt heraus. Der Berg wird still. Der Stein liegt heute im Dorfbrunnen und wärmt das Wasser." },
        { id: "e1", e: "🤝", end: 1, name: "Der Pakt", t: "Ihr atmet zusammen: ein, aus, ein, aus. Beim siebten Mal bleibt das Hicksen aus. Grimm sieht dich lange an. „Ein Pakt“, sagt er. „Du kommst wieder, und ich bebe nie mehr ohne Vorwarnung.“ Ihr gebt euch Pfote und Hand." },
        { id: "e2", e: "😆", end: 2, name: "Eine Woche Schluckauf", t: "Dein BUH hallt durch die Halle. Grimm erschrickt so sehr, dass er einmal richtig tief einatmet — und dich dabei gleich mit. Als er dich wieder auspustet, hast du selbst Schluckauf. Eine ganze Woche lang, alle zwölf Sekunden." },
      ],
    },
    {
      key: "flug",
      diff: 2,
      depth: 7,
      e: "🏁",
      title: "Das Wettfliegen",
      nodes: [
        { id: "s0", e: "🏁", t: "Einmal im Jahrhundert fliegen die Drachen um den Windpokal: dreimal um den Berg, einmal durch die Schlucht. Am Morgen des Rennens fehlt eine. Nuri, die Jüngste, sitzt hinter dem Stall und weint. Ihre linke Flügelfeder ist ab.", c: [
          { a: "Nuri fragen, was passiert ist", to: "a1" },
          { a: "Den kaputten Flügel ansehen", to: "b1" },
        ] },
        { id: "a1", e: "🚪", t: "„Ich habe geübt“, schluchzt Nuri. „Jede Nacht. Und heute Morgen lag die Feder einfach da.“ Sie schaut zum Stall hinüber, und ihr Blick bleibt an einer Tür hängen, die offen steht.", c: [
          { a: "Zu der offenen Tür gehen", to: "a2" },
          { a: "Nuri fragen, wer sonst noch übt", to: "b2" },
        ] },
        { id: "b1", e: "✂️", t: "Die Feder ist nicht gebrochen — sie ist abgeschnitten. Der Schnitt ist gerade wie mit einer Schere, und am Rand klebt etwas, das nach Honig riecht.", c: [
          { a: "Dem Honiggeruch nachgehen", to: "b2" },
          { a: "Die Feder einstecken", to: "c2" },
        ] },
        { id: "a2", e: "🍯", t: "Im Stall steht ein Eimer Honig, und daneben liegt eine Schere, so groß wie dein Arm. Über den Boden führt eine klebrige Spur nach draußen — genau bis zur Startlinie.", c: [
          { a: "Der klebrigen Spur folgen", to: "a3" },
          { a: "Die Schere mitnehmen", to: "b3" },
        ] },
        { id: "b2", e: "🫙", t: "Der Honig steht in Töpfen entlang der ganzen Startlinie. „Damit die Flügel glänzen“, sagt der Wettkampfmeister. „Alle nehmen davon. Alle außer Nuri. Sie war zu spät.“", c: [
          { a: "Fragen, wer als Erster da war", to: "b3" },
          { a: "In die Töpfe schauen", to: "c3" },
        ] },
        { id: "c2", e: "🌡️", t: "Du steckst die Feder ein, und da fällt es dir auf: Sie ist warm. Nicht sonnenwarm — handwarm. Jemand hat sie eben noch in der Hand gehalten.", c: [
          { a: "Nach warmen Händen suchen", to: "c3" },
          { a: "Zu Nuri zurückgehen", to: "a3" },
        ] },
        { id: "a3", e: "🥇", t: "Die Spur endet an Startplatz eins. Dort putzt Baron Bramm seine Flügel, der größte Drache im Tal. An seiner Kralle klebt Honig, und daneben liegt eine einzelne fremde Feder.", c: [
          { a: "Ihn direkt darauf ansprechen", to: "a4" },
          { a: "Erst die fremde Feder aufheben", to: "b4" },
        ] },
        { id: "b3", e: "🤫", t: "„Bramm“, sagt der Meister. „Er ist immer als Erster da. Und er hat noch nie verloren.“ Er sagt es leise, und dabei schaut er nicht zur Startlinie, sondern weg.", c: [
          { a: "Den Meister weiterfragen", to: "b4" },
          { a: "Selbst zu Bramm gehen", to: "c4" },
        ] },
        { id: "c3", e: "🔍", t: "In einem der Honigtöpfe schwimmt eine winzige Feder — dieselbe Farbe wie Nuris. Und ganz unten am Boden klemmt ein zweiter Schnipsel. Es waren also zwei.", c: [
          { a: "Beide Schnipsel herausfischen", to: "c4" },
          { a: "Zu Startplatz eins gehen", to: "a4" },
        ] },
        { id: "a4", e: "😔", t: "Bramm wird ganz still. „Ich wollte ihr nicht wehtun“, sagt er endlich. „Ich wollte nur gewinnen. Ein letztes Mal.“ Er ist alt. Man sieht es erst, wenn er die Flügel hängen lässt.", c: [
          { a: "Fragen, warum es das letzte Mal ist", to: "a5" },
          { a: "Ihm sagen, dass er sich entschuldigen muss", to: "b5" },
        ] },
        { id: "b4", e: "⏳", t: "Der Meister seufzt. „Bramm fliegt seit hundert Jahren. Dieses Jahr ist sein letztes, danach ist er zu alt. Er hat Angst, als Verlierer aufzuhören.“", c: [
          { a: "Nach einer Lösung für beide suchen", to: "b5" },
          { a: "Das Rennen anhalten lassen", to: "c5" },
        ] },
        { id: "c4", e: "🪶", t: "Zwei Schnipsel, zwei Federn — eine von Nuri und eine von Bramm. Er hat sich also auch selbst eine abgeschnitten. Warum tut jemand so etwas?", c: [
          { a: "Bramm danach fragen", to: "c5" },
          { a: "Nuri die zweite Feder bringen", to: "a5" },
        ] },
        { id: "a5", e: "🧩", t: "„Weil ich sie brauchte“, sagt Bramm und legt die zweite Feder auf den Tisch. „Ihre passt in mein Loch. Meine passt in ihres. Ich wollte tauschen — und habe mich nicht getraut zu fragen.“", c: [
          { a: "Die beiden tauschen lassen", to: "e0" },
          { a: "Nuri holen und sie entscheiden lassen", to: "e1" },
        ] },
        { id: "b5", e: "📯", t: "Die Hörner blasen. Alle Drachen stehen an der Startlinie, und Nuri sitzt immer noch hinter dem Stall. Dir bleibt genau ein Startsignal Zeit.", c: [
          { a: "Nuri an die Startlinie ziehen", to: "e1" },
          { a: "Selbst auf Nuris Rücken springen", to: "e2" },
        ] },
        { id: "c5", e: "👂", t: "Bramm senkt den Kopf bis auf den Boden. „Sag du es ihr“, flüstert er. „Ich kann nicht.“ Hinter dir hörst du Schritte: Nuri hat längst alles gehört.", c: [
          { a: "Nichts sagen und abwarten", to: "e2" },
          { a: "Beide zusammen an den Start schicken", to: "e0" },
        ] },
        { id: "e0", e: "🏆", end: 0, name: "Der Windpokal", t: "Die Federn passen. Nuri und Bramm starten nebeneinander, dreimal um den Berg, einmal durch die Schlucht — und kommen Flügel an Flügel ins Ziel. Zum ersten Mal seit hundert Jahren wird der Windpokal geteilt. Er passt genau in die Mitte ihres Nestes." },
        { id: "e1", e: "🤍", end: 1, name: "Die geliehene Feder", t: "Nuri hört sich alles an, schaut Bramm lange an und sagt dann: „Geliehen. Nicht getauscht.“ Sie fliegt mit seiner Feder und wird Dritte. Bramm sitzt am Ziel und klatscht so laut, dass die Schlucht wackelt." },
        { id: "e2", e: "😂", end: 2, name: "Rückwärts durchs Ziel", t: "Du springst auf Nuris Rücken, und mit dem Gewicht und der kurzen Feder dreht sich alles: Ihr fliegt die komplette Runde rückwärts. Ihr werdet Letzte. Aber ihr seid die Einzigen, die dabei die ganze Zeit lachen." },
      ],
    },
    {
      key: "winter",
      diff: 2,
      depth: 7,
      e: "🍂",
      title: "Der Winterdrache",
      nodes: [
        { id: "s0", e: "🍂", t: "Es ist Ende November, und der Winter kommt nicht. Die Bäume wissen nicht, ob sie ihre Blätter behalten sollen, und die Igel gehen nicht schlafen. Die alte Wetterfrau zeigt nach Norden. „Der Winterdrache“, sagt sie. „Er ist nicht aufgewacht.“", c: [
          { a: "Nach Norden aufbrechen", to: "a1" },
          { a: "Die Wetterfrau nach ihm fragen", to: "b1" },
        ] },
        { id: "a1", e: "🥾", t: "Nach zwei Tagen endet der Weg an einem See, der nicht zufriert. Am Ufer liegt eine Schaufel, größer als eine Tür, und daneben ein Paar Fußspuren. Sie führen ins Wasser und nicht wieder heraus.", c: [
          { a: "Den Spuren bis ans Wasser folgen", to: "a2" },
          { a: "Die Schaufel untersuchen", to: "b2" },
        ] },
        { id: "b1", e: "🔔", t: "„Jeden November“, sagt sie, „steigt er aus dem See und atmet einmal über das Tal. Dann schneit es. Dieses Jahr blieb der See glatt.“ Sie legt dir eine kleine Glocke in die Hand. „Nimm die mit. Er hört sie.“", c: [
          { a: "Die Glocke einstecken und losgehen", to: "b2" },
          { a: "Fragen, warum ausgerechnet eine Glocke", to: "c2" },
        ] },
        { id: "a2", e: "🫧", t: "Das Wasser ist klar bis auf den Grund. Ganz unten liegt etwas Weißes und Langes, zusammengerollt wie ein schlafender Hund. Es bewegt sich nicht. Aber alle paar Minuten steigt eine einzelne Blase auf.", c: [
          { a: "Warten und die Blasen zählen", to: "a3" },
          { a: "Ins Wasser steigen", to: "b3" },
        ] },
        { id: "b2", e: "🗒️", t: "Die Schaufel ist eiskalt, und der Griff ist ganz abgegriffen. Jemand hat sie hundert Winter lang benutzt. Im Blatt klemmt ein Zettel, steif gefroren: „Wecken um Mitternacht. Nicht früher.“", c: [
          { a: "Bis Mitternacht warten", to: "b3" },
          { a: "Den Zettel umdrehen", to: "c3" },
        ] },
        { id: "c2", e: "🤫", t: "„Weil er nichts hört außer Glocken“, sagt die Wetterfrau. „Sein Gehör ist so fein, dass laute Geräusche ihm wehtun. Darum schläft er im Wasser. Da unten ist es still.“", c: [
          { a: "Nach dem leisesten Weg fragen", to: "c3" },
          { a: "Sofort zum See laufen", to: "a3" },
        ] },
        { id: "a3", e: "🌑", t: "Alle sieben Minuten eine Blase. Sieben Minuten sind lang für einen Atemzug und kurz für hundert Jahre Schlaf. Die Sonne geht unter, und der See wird schwarz.", c: [
          { a: "Die Glocke über dem Wasser läuten", to: "a4" },
          { a: "Noch eine Blase abwarten", to: "b4" },
        ] },
        { id: "b3", e: "🧊", t: "Das Wasser ist so kalt, dass es an den Beinen brennt. Nach drei Schritten hört der Grund auf. Unter dir, ganz weit unten, öffnet sich ein Auge: hellblau, so groß wie ein Wagenrad.", c: [
          { a: "Ihm zuwinken", to: "b4" },
          { a: "Wieder ans Ufer gehen", to: "c4" },
        ] },
        { id: "c3", e: "💗", t: "Auf der Rückseite steht in derselben Schrift: „Falls er nicht kommt: Er wartet auf ein Feuer am Ufer. Er friert nämlich auch.“ Darunter ist ein kleines Herz gemalt.", c: [
          { a: "Holz für ein Feuer sammeln", to: "c4" },
          { a: "Zurück zum Wasser gehen", to: "a4" },
        ] },
        { id: "a4", e: "〰️", t: "Die Glocke klingt klein über dem großen See. Beim dritten Läuten zieht ein Kreis über das Wasser, dann noch einer. Etwas kommt herauf, sehr langsam, damit es nicht platscht.", c: [
          { a: "Ganz still stehen bleiben", to: "a5" },
          { a: "Ihm entgegengehen", to: "b5" },
        ] },
        { id: "b4", e: "🐋", t: "Das Auge folgt dir. Dann taucht ein Kopf auf, weiß wie Raureif, und eine Stimme sagt so leise, dass du sie fast nur fühlst: „Ist es schon Zeit?“", c: [
          { a: "Ihm die Wahrheit sagen", to: "b5" },
          { a: "Fragen, warum er noch schläft", to: "c5" },
        ] },
        { id: "c4", e: "🪵", t: "Am Ufer brennt bald ein Feuer. Es knistert laut — viel zu laut für so ein feines Gehör. Aber es wärmt, und draußen im Schwarzen bewegt sich etwas.", c: [
          { a: "Das Feuer kleiner machen", to: "c5" },
          { a: "Zum Wasser gehen und läuten", to: "a5" },
        ] },
        { id: "a5", e: "🏔️", t: "Der Winterdrache steht bis zum Bauch im See und schaut über das Tal. „Hundert Jahre“, sagt er. „Und jedes Jahr fürchte ich mich vor dem ersten Atemzug. Er ist so schrecklich laut.“", c: [
          { a: "Ihm sagen, dass alle auf ihn warten", to: "e0" },
          { a: "Ihm vom Feuer am Ufer erzählen", to: "e1" },
        ] },
        { id: "b5", e: "😢", t: "„Es ist längst Zeit“, sagst du. Er senkt den Kopf. „Ich weiß. Aber ich bin allein hier oben, und allein zu frieren ist etwas ganz anderes als allein zu schlafen.“", c: [
          { a: "Ihm versprechen zu bleiben", to: "e1" },
          { a: "Ihn zum Trost anfassen", to: "e2" },
        ] },
        { id: "c5", e: "👅", t: "Das Feuer brennt jetzt klein und ruhig. Der Drache kommt bis auf drei Schritte heran und streckt die Zunge nach der Wärme aus — eine Zunge aus lauter kleinen Eiszapfen.", c: [
          { a: "Ihn ganz nah ans Feuer lassen", to: "e2" },
          { a: "Ihm die Glocke schenken", to: "e0" },
        ] },
        { id: "e0", e: "❄️", end: 0, name: "Der erste Schnee", t: "Er atmet einmal aus, ganz langsam, über das ganze Tal. Es dauert einen Herzschlag, dann fällt der erste Schnee seit zwei Jahren. Unten im Dorf gehen alle Türen auf. Die Igel schlafen noch in derselben Nacht ein." },
        { id: "e1", e: "🔥", end: 1, name: "Ein Feuer für alle", t: "Ihr baut das Feuer neu, direkt am Wasser, und du bleibst, bis er einschläft. Seitdem brennt dort jeden November ein Feuer, und jedes Jahr geht jemand aus dem Dorf hinauf und setzt sich dazu. Der Winter kommt seither pünktlich." },
        { id: "e2", e: "🥶", end: 2, name: "Festgefrorene Zunge", t: "Er streckt die Zungenspitze ins Feuer — und sie klebt fest. Am Holzscheit. Ihr braucht bis zum Morgen und drei Eimer warmes Wasser. Er entschuldigt sich achtzehnmal, und du sagst achtzehnmal, dass das das Lustigste war, was du je gesehen hast." },
      ],
    },
  ],
};
