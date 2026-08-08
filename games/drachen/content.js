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
// ── THE SHAPE, AND WHY IT IS ALWAYS THE SAME ────────────────────────────────
//
// Every story is the same layered graph: a start scene, then layers of three
// scenes, then three endings — and every path from the start to an ending has
// the same number of scenes (`depth`). That is what lets the round's scene draw
// a fixed path, so the fox reaches the basket exactly as the ending appears.
//
// The three scenes of a layer are three COLUMNS, and a column is a temperament:
//
//     a = MUTIG      — you walk up to it, you speak first, you take hold
//     b = BEHUTSAM   — you wait, you watch, you go gently
//     c = SCHLAU     — you try a trick, and the trick is what goes comically
//                      sideways at the end
//
// Every scene offers exactly two choices, ALWAYS in this order:
//     1st choice — stay in this column
//     2nd choice — step one column onward (a→b, b→c, c→a)
// so the ending she reaches is simply the column she finishes in: a → ending 0,
// b → ending 1, c → ending 2 (the funny mishap). tests/drachen-content.test.js
// pins this skeleton for every story, which is also what PROVES the no-lock-out
// rule: all three endings stay reachable until the last choice, and each last
// scene still offers two of them.
//
// THE RULE THAT MAKES IT READ. A scene can be walked into from two different
// earlier scenes, so **a scene may only mention what is true on every path into
// it.** It describes its own situation and never refers back to a particular
// earlier action, a place she might not have been, or an object she might not
// have picked up. This is the defect the first draft had everywhere ("Den Zettel
// einstecken" → "Über dem Bach hängt ein alter Baum"): every scene read fine on
// its own, and only the JOIN between two of them was nonsense. No test can catch
// that — read the joins with `node tools/read-story.js` and check every one.
//
// EDITORIAL RULES, none of them machine-checkable:
//   • Funny and exciting, never frightening. The dragon is a character, never a
//     threat: nothing attacks, nothing is lost, nobody is hurt (§8).
//   • Two lovely endings and one FUNNY MISHAP (always the `c` column) — never a
//     failure and never a punishment: it pays exactly the same star as the other
//     two, and the child laughs with the dragon, not at herself.
//   • The three endings must be tellable apart from their names alone, or the
//     "???" on the summary's ending strip is no tease at all.
//   • Choices are ACTIONS she takes ("Leise hinaufklettern"), never opinions
//     about herself ("Sei mutig").
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
        { id: "s0", e: "🥚", t: "Im Nest der Drachenmutter fehlt ein Ei. Eine glitzernde Spur führt zum alten Baum am Bach. „Bitte hilf mir!“, schnauft sie.", c: [
          { a: "Sofort losrennen", to: "a1" },
          { a: "Erst die Spur genau anschauen", to: "b1" },
        ] },
        { id: "a1", e: "🏃", t: "Du rennst los. Am Bach steht der alte Baum. Ganz oben zwischen den Ästen blitzt etwas in der Sonne.", c: [
          { a: "Gleich den Stamm hochklettern", to: "a2" },
          { a: "Erst einmal stehen bleiben", to: "b2" },
        ] },
        { id: "b1", e: "🔍", t: "In der Spur liegen glänzende Sachen. Ein Löffel, ein Knopf, eine schwarze Feder. Alle zeigen zum Baum am Bach.", c: [
          { a: "Leise zum Baum gehen", to: "b2" },
          { a: "Der Feder nachgehen", to: "c2" },
        ] },
        { id: "a2", e: "🌳", t: "Die Rinde ist rissig genug für deine Schuhe. Nach zehn Griffen sitzt du zwischen den Ästen. Über dir schaukelt ein Nest.", c: [
          { a: "Weiterklettern bis zum Nest", to: "a3" },
          { a: "Sitzen bleiben und zuschauen", to: "b3" },
        ] },
        { id: "b2", e: "👂", t: "Du stehst unter dem Baum und rührst dich nicht. Über dir raschelt es. Dann klappert ein Schnabel. Oben ist jemand zu Hause.", c: [
          { a: "Noch länger warten", to: "b3" },
          { a: "Gegen den Stamm klopfen", to: "c3" },
        ] },
        { id: "c2", e: "🪜", t: "Auf der Rückseite hängt ein Ast fast bis zum Boden. Von dort führen die Äste nach oben wie eine krumme Treppe.", c: [
          { a: "Den Ast wippen lassen", to: "c3" },
          { a: "Über die Astreppe hinauf", to: "a3" },
        ] },
        { id: "a3", e: "🐦‍⬛", t: "Im Nest sitzt eine Elster auf einem Haufen glitzernder Sachen. Unter ihrem Bauch schaut etwas Weißes hervor.", c: [
          { a: "Sie um das Ei bitten", to: "e0" },
          { a: "Ganz sanft danach greifen", to: "e1" },
        ] },
        { id: "b3", e: "🪺", t: "Nach einer Weile fliegt die Elster davon. Du kletterst hinauf. Im Nest liegt das Ei zwischen Löffeln und Ringen. Es wackelt.", c: [
          { a: "Das Ei vorsichtig herausheben", to: "e1" },
          { a: "Das Ohr an das Ei legen", to: "e2" },
        ] },
        { id: "c3", e: "🤲", t: "Der Baum wackelt. Oben kreischt es. Etwas Weißes rutscht über den Nestrand. Du fängst es mit beiden Armen.", c: [
          { a: "Das Ohr an das Ei legen", to: "e2" },
          { a: "Nach oben rufen und um Erlaubnis bitten", to: "e0" },
        ] },
        { id: "e0", e: "💎", end: 0, name: "Der Elsternschatz", t: "Die Elster legt den Kopf schief. Dann hüpft sie zur Seite und zeigt dir alles. Löffel, Ringe, ein kleiner Spiegel. Das Ei darfst du mitnehmen." },
        { id: "e1", e: "🐣", end: 1, name: "Das kleine Küken", t: "Du hältst das Ei ganz ruhig. Es knackt. Ein winziger Drache purzelt heraus, blinzelt dich an und piepst: „Mama?“ Du lachst. „Fast!“" },
        { id: "e2", e: "😅", end: 2, name: "Rußnase", t: "Drinnen holt jemand tief Luft — und niest, mitten durch die Schale. Ruß! Du bist schwarz von oben bis unten und musst lachen." },
      ],
    },
    {
      key: "bruecke",
      diff: 0,
      depth: 5,
      e: "😴",
      title: "Der Brückendrache",
      nodes: [
        { id: "s0", e: "😴", t: "Ein Drache ist auf der Dorfbrücke eingeschlafen. Neben ihm liegt sein Rucksack. Eine Trompete schaut heraus, und eine Tüte Tee.", c: [
          { a: "Ihn laut ansprechen", to: "a1" },
          { a: "Erst einmal zuschauen", to: "b1" },
        ] },
        { id: "a1", e: "📣", t: "„Hallo!“, rufst du. Der Drache brummt, dreht sich um und murmelt: „Noch fünf Minuten.“ Dann schnarcht er weiter.", c: [
          { a: "Noch lauter rufen", to: "a2" },
          { a: "Dich neben ihn setzen", to: "b2" },
        ] },
        { id: "b1", e: "🫃", t: "Du setzt dich auf den Brückenrand. Sein Bauch gluckert bei jedem Atemzug. Die Falten um die Augen zucken.", c: [
          { a: "Weiter zuschauen", to: "b2" },
          { a: "Die Teetüte aufmachen", to: "c2" },
        ] },
        { id: "a2", e: "🏘️", t: "Vom Rufen wacht er nicht auf — aber das halbe Dorf. Der Bäcker bringt einen Topf, die Wirtin einen Deckel, einer die Trompete.", c: [
          { a: "Alle mitmachen lassen", to: "a3" },
          { a: "Erst um Ruhe bitten", to: "b3" },
        ] },
        { id: "b2", e: "💤", t: "Du wartest. Sein Schnarchen wird leiser, dann lauter, dann wieder leiser. Zwischendurch seufzt er, als träumte er etwas Trauriges.", c: [
          { a: "Noch länger warten", to: "b3" },
          { a: "Etwas an seine Nase halten", to: "c3" },
        ] },
        { id: "c2", e: "🌼", t: "Der Tee riecht nach Kamille und warmer Wiese. Auf der Tüte steht in krakeliger Schrift: „Gegen Bauchweh. Nicht vergessen!“", c: [
          { a: "Ihm die Tüte unter die Nase halten", to: "c3" },
          { a: "Ins Dorf laufen und Hilfe holen", to: "a3" },
        ] },
        { id: "a3", e: "🎺", t: "Das halbe Dorf steht auf der Brücke: Töpfe, Deckel, Löffel, die Trompete. Alle schauen dich an und warten auf ein Zeichen.", c: [
          { a: "Das Zeichen geben", to: "e0" },
          { a: "Erst Wasser aufsetzen lassen", to: "e1" },
        ] },
        { id: "b3", e: "😪", t: "Er öffnet ein Auge, nur einen Spalt. „Bauchweh“, seufzt er. „Seit gestern. Deshalb schlafe ich hier.“ Dann fällt es wieder zu.", c: [
          { a: "Ihm einen Kamillentee kochen", to: "e1" },
          { a: "Ihn an der Nase kitzeln", to: "e2" },
        ] },
        { id: "c3", e: "👃", t: "Seine Nasenlöcher zittern. So nah an eine Drachennase zu kommen ist keine besonders gute Idee. Aber es sieht sehr lustig aus.", c: [
          { a: "Noch näher heranhalten", to: "e2" },
          { a: "Um Hilfe rufen, so laut du kannst", to: "e0" },
        ] },
        { id: "e0", e: "🎺", end: 0, name: "Das Weckkonzert", t: "Erst die Trompete. Dann Töpfe, Deckel, Löffel. Das halbe Dorf steht auf der Brücke und macht Krach. Der Drache springt auf und tanzt davon." },
        { id: "e1", e: "🫖", end: 1, name: "Kamillentee für Kalle", t: "Er schnuppert an der Kanne. Dann öffnet er beide Augen und trinkt sie leer. „Ich heiße Kalle“, seufzt er. „Und mir geht es viel besser.“" },
        { id: "e2", e: "🤧", end: 2, name: "Der Kitzelnieser", t: "Die Nase zittert, zittert — und dann: HATSCHI! Der Drache pustet dich mitten ins Heu. Danach entschuldigt er sich achtmal, sehr höflich." },
      ],
    },
    {
      key: "post",
      diff: 0,
      depth: 5,
      e: "📜",
      title: "Die Drachenpost",
      nodes: [
        { id: "s0", e: "📜", t: "„Ein Brief für Ruby, den Drachen auf dem Turm.“ Der Briefträger drückt ihn dir in die Hand. Der Umschlag riecht nach Zimt.", c: [
          { a: "Sofort die Turmtreppe hoch", to: "a1" },
          { a: "Erst um den Turm herumgehen", to: "b1" },
        ] },
        { id: "a1", e: "🏰", t: "Zweihundert Stufen. Oben pfeift der Wind durch eine offene Klappe. Drinnen klappert jemand mit Tellern.", c: [
          { a: "Durch die Klappe rufen", to: "a2" },
          { a: "Anklopfen und warten", to: "b2" },
        ] },
        { id: "b1", e: "🍪", t: "Hinter dem Turm steht ein Backofen. Darin liegt ein Blech Zimtkekse, noch warm. Von oben hört man jemanden seufzen.", c: [
          { a: "Nach oben gehen und klopfen", to: "b2" },
          { a: "Das Blech mitnehmen", to: "c2" },
        ] },
        { id: "a2", e: "👀", t: "„Post!“, rufst du. Sofort schiebt sich ein grüner Kopf heraus. Zwei Augen so groß wie Teller schauen dich an. „Für mich?“", c: [
          { a: "Ihr den Brief in die Klaue drücken", to: "a3" },
          { a: "Ihn ihr langsam hinhalten", to: "b3" },
        ] },
        { id: "b2", e: "🚪", t: "Du klopfst. Drinnen wird es still. Dann geht die Tür einen Spalt auf. Eine Drachendame schaut heraus, mit roten Augen vom Weinen.", c: [
          { a: "Sie erst einmal trösten", to: "b3" },
          { a: "Ihr den Brief zuwerfen", to: "c3" },
        ] },
        { id: "c2", e: "🥧", t: "Mit dem Blech in den Händen kommst du oben an. Der Zimtduft zieht durch die Klappe. Drinnen schnuppert jemand ganz laut.", c: [
          { a: "Den Brief zu den Keksen legen", to: "c3" },
          { a: "Laut „Post!“ rufen", to: "a3" },
        ] },
        { id: "a3", e: "😊", t: "Ruby reißt den Umschlag auf und liest. Dann strahlt sie. „Meine Schwester kommt zu Besuch! Heute noch! Über den Wolken!“", c: [
          { a: "Fragen, ob du mitfliegen darfst", to: "e0" },
          { a: "Beim Tischdecken helfen", to: "e1" },
        ] },
        { id: "b3", e: "🌬️", t: "„Ich bekomme nie Post“, sagt sie leise. „Seit vierzig Jahren nicht.“ Sie hält den Umschlag fest und traut sich nicht, ihn zu öffnen.", c: [
          { a: "Ihr vorlesen", to: "e1" },
          { a: "Sie kitzeln, damit sie lacht", to: "e2" },
        ] },
        { id: "c3", e: "😮", t: "Ruby schnappt zu. Jetzt hat sie den Umschlag halb im Maul und schaut dich erschrocken an. Es riecht nach Zimt und nach Papier.", c: [
          { a: "„Nicht schlucken!“ rufen", to: "e2" },
          { a: "Ihr auf den Rücken klettern", to: "e0" },
        ] },
        { id: "e0", e: "🌈", end: 0, name: "Der Regenbogenflug", t: "Ruby steigt mit dir durch eine Wolke. Plötzlich steht ein Regenbogen quer über dem Turm. Oben wartet schon jemand: ihre Schwester." },
        { id: "e1", e: "🍰", end: 1, name: "Kekse für drei", t: "Ihr deckt den Tisch, und die Zimtkekse sind noch warm. Am Abend landet Rubys Schwester krachend im Garten und isst neun Stück." },
        { id: "e2", e: "😳", end: 2, name: "Post im Bauch", t: "Ruby schnappt nach Luft — und schluckt. „Ups“, sagt sie. „Was stand denn drin?“ Ihr müsst den ganzen Brief neu schreiben. Auswendig." },
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
          { a: "Gleich losfragen", to: "a1" },
          { a: "Erst in Ruhe umschauen", to: "b1" },
        ] },
        { id: "a1", e: "🗣️", t: "Du fragst dich durch die Reihen. „Goldener Zahn?“ Alle lachen und zeigen weiter. Erst der Bücherhändler wird ernst: „Such den, der nicht lacht.“", c: [
          { a: "Sofort nach ihm suchen", to: "a2" },
          { a: "Fragen, wie er das meint", to: "b2" },
        ] },
        { id: "b1", e: "🟡", t: "In einer Kiste liegen Schuppen in allen Farben. Eine davon ist warm — richtig warm, als hätte sie eben noch jemand getragen. Und sie hat einen Sprung.", c: [
          { a: "Die Händlerin nach ihr fragen", to: "b2" },
          { a: "Am Obststand vorbeigehen", to: "c2" },
        ] },
        { id: "a2", e: "🔎", t: "Du gehst die Reihen ab und schaust in jedes Gesicht. Alle lachen, alle handeln, alle rufen. Nur ganz hinten, im Schatten hinter einem Zelt, sitzt jemand still.", c: [
          { a: "Hingehen und ihn ansprechen", to: "a3" },
          { a: "Von weitem zuschauen", to: "b3" },
        ] },
        { id: "b2", e: "💬", t: "„Das ist Bodo“, sagt die Händlerin und wird leise. „Er verliert seit Tagen Schuppen und sagt kein Wort mehr. Früher hat er den ganzen Markt zum Lachen gebracht.“", c: [
          { a: "Fragen, wo er sitzt", to: "b3" },
          { a: "Ihm etwas zu essen besorgen", to: "c3" },
        ] },
        { id: "c2", e: "🍎", t: "Am Obststand kaufst du einen Apfel. „Für Bodo?“, fragt der Händler und schüttelt den Kopf. „Der beißt seit Tagen einmal ab und legt ihn wieder hin.“", c: [
          { a: "Den Apfel hinter das Zelt bringen", to: "c3" },
          { a: "Ihn selbst suchen gehen", to: "a3" },
        ] },
        { id: "a3", e: "🐲", t: "Hinter dem Zelt sitzt ein großer Drache im Schatten, den Kopf auf den Pfoten. Vor ihm liegt ein Berg verlorener Schuppen. Er schaut dich an und sagt nichts.", c: [
          { a: "Ihn nach dem goldenen Zahn fragen", to: "a4" },
          { a: "Dich einfach danebensetzen", to: "b4" },
        ] },
        { id: "b3", e: "👀", t: "Aus der Ferne siehst du ihn: Bei jedem Atemzug zuckt er kurz zusammen. Immer an derselben Stelle, immer an der rechten Backe. Und immer wieder schaut er zum Markt hinüber.", c: [
          { a: "Langsam näher gehen", to: "b4" },
          { a: "Etwas Kaltes vom Eisstand holen", to: "c4" },
        ] },
        { id: "c3", e: "🧊", t: "Du legst es neben ihn und trittst zurück. Er schaut es lange an. Dann schiebt er es mit einer Kralle weg und hält sich wieder die rechte Backe.", c: [
          { a: "Etwas Kaltes dagegen halten", to: "c4" },
          { a: "Ihn direkt darauf ansprechen", to: "a4" },
        ] },
        { id: "a4", e: "🦷", t: "„Zahn“, brummt er endlich. Es ist das erste Wort seit Tagen. Dann macht er den Mund auf: Ganz hinten blitzt es golden — und wackelt bei jedem Atemzug ein Stückchen mit.", c: [
          { a: "Beherzt daran wackeln", to: "e0" },
          { a: "Erst fragen, ob du darfst", to: "e1" },
        ] },
        { id: "b4", e: "🌫️", t: "Du bleibst einfach neben ihm sitzen und sagst nichts. Nach einer Weile lehnt er sich an dich. Aus seiner Nase kringelt sich ein dünnes Rauchwölkchen, und es wird dicker.", c: [
          { a: "Ganz ruhig sitzen bleiben", to: "e1" },
          { a: "Ihm in die Nase schauen", to: "e2" },
        ] },
        { id: "c4", e: "🔥", t: "Er schnappt nach Luft, und sein Hals leuchtet innen kurz orange. Bei einem Drachen sieht man ein Niesen lange vorher kommen. Man müsste jetzt eigentlich zurücktreten.", c: [
          { a: "Ganz nah heran und nachschauen", to: "e2" },
          { a: "Zurückspringen und laut rufen", to: "e0" },
        ] },
        { id: "e0", e: "🪙", end: 0, name: "Die goldene Schuppe", t: "Der goldene Zahn springt heraus und rollt über den Boden. Bodo atmet zum ersten Mal seit Tagen ohne zu zucken. Der Marktmeister pfeift: „Ein Wunsch für dich!“ Du wünschst dir einen eigenen Stand für Bodo." },
        { id: "e1", e: "🐉", end: 1, name: "Ein Freund mit Zahnweh", t: "Irgendwann löst sich der Zahn ganz von selbst und fällt in deine Hand. „Behalt ihn“, sagst du und gibst ihn zurück. Bodo lächelt — das erste Lächeln seit Tagen. Ab jetzt begleitet er dich über jeden Markt." },
        { id: "e2", e: "😆", end: 2, name: "Angesengte Augenbrauen", t: "Du schaust genau in dem Moment hinein, in dem das Niesen kommt. FFFFT! Deine Augenbrauen sind weg. Bodo entschuldigt sich hundertmal und malt dir mit Ruß neue auf — schöner als die alten." },
      ],
    },
    {
      key: "wolken",
      diff: 1,
      depth: 6,
      e: "☁️",
      title: "Die Wolkenwäsche",
      nodes: [
        { id: "s0", e: "☁️", t: "Über dem Tal hängt eine Wolke fest. Sie ist grau und schief und sieht aus, als wäre sie seit Jahren nicht gewaschen worden. Ein Drache mit einer Wäscheklammer im Maul winkt dich zu sich.", c: [
          { a: "Auf seinen Rücken klettern", to: "a1" },
          { a: "Erst fragen, was er vorhat", to: "b1" },
        ] },
        { id: "a1", e: "🪂", t: "Ihr steigt so schnell, dass dir die Ohren zugehen. Von oben sieht die Wolke aus wie ein riesiges graues Bettlaken — und darin hängen lauter Sachen fest.", c: [
          { a: "Gleich hineingreifen", to: "a2" },
          { a: "Erst einmal herumfliegen", to: "b2" },
        ] },
        { id: "b1", e: "🧺", t: "„Ich bin Wolkenwäscher“, brummt er. „Aber meine Leine ist gerissen. Jetzt hängt alles im Grau fest: zwei Socken, ein Handtuch, mein Sonntagsschal. Und der Regen.“", c: [
          { a: "Nach der Leine suchen", to: "b2" },
          { a: "Nach dem Regen fragen", to: "c2" },
        ] },
        { id: "a2", e: "🧦", t: "Du ziehst — und heraus kommt eine Socke. Dann noch eine. Dann ein Strumpf, so lang wie ein Gartenzaun. Die Wolke wird dabei dünner und dünner.", c: [
          { a: "Weiterziehen, so fest du kannst", to: "a3" },
          { a: "Vorsichtiger weitermachen", to: "b3" },
        ] },
        { id: "b2", e: "➰", t: "Auf der Rückseite hängt die gerissene Leine. Ein Ende flattert im Wind, das andere steckt tief im Grau. Dazwischen ist die Wolke ganz weich und schwer.", c: [
          { a: "Die beiden Enden verknoten", to: "b3" },
          { a: "Am flatternden Ende hineinrutschen", to: "c3" },
        ] },
        { id: "c2", e: "🪣", t: "„Der Regen sitzt ganz unten“, sagt der Drache und schaut dich von der Seite an. „Ich komme da nicht hin. Da müsste jemand hinein, der klein genug ist.“", c: [
          { a: "Dich hineinlassen", to: "c3" },
          { a: "Die Wolke lieber von oben aufmachen", to: "a3" },
        ] },
        { id: "a3", e: "⛰️", t: "Die Wolke rutscht weg, und ihr müsst sie festhalten. Der Drache hakt sie zwischen zwei Bergspitzen ein. Jetzt hängt sie da wie ein nasses Laken im Wind.", c: [
          { a: "Kräftig daran rütteln", to: "a4" },
          { a: "Erst die Wäsche abnehmen", to: "b4" },
        ] },
        { id: "b3", e: "🫧", t: "Etwas Schweres rutscht in der Wolke nach unten. Sie schwappt wie eine Badewanne, und über den Rand quillt weißer Schaum. Irgendwo darin klingelt es ganz leise.", c: [
          { a: "Dem Klingeln nachhören", to: "b4" },
          { a: "In den Schaum hineingreifen", to: "c4" },
        ] },
        { id: "c3", e: "🌀", t: "Von innen ist die Wolke ein einziges weiches Durcheinander. Es kitzelt, es piekst, und es riecht nach frischer Wäsche. Unter dir gluckert etwas Schweres.", c: [
          { a: "Tiefer hinuntertauchen", to: "c4" },
          { a: "Von innen kräftig treten", to: "a4" },
        ] },
        { id: "a4", e: "💨", t: "Die ganze Wolke wackelt jetzt. Unten im Tal bleiben die Leute stehen und schauen nach oben. Ein paar von ihnen halten schon Eimer in den Händen.", c: [
          { a: "Sie ausschütteln wie ein Bettlaken", to: "e0" },
          { a: "Erst die Wäsche aufhängen", to: "e1" },
        ] },
        { id: "b4", e: "🔔", t: "Das Klingeln kommt von zwei Socken, die niemand nass werden lässt. Sie sind aus reiner Wolke gestrickt. Der Drache schaut zu und sagt kein einziges Wort.", c: [
          { a: "Sie ihm zurückgeben", to: "e1" },
          { a: "Noch tiefer in den Schaum greifen", to: "e2" },
        ] },
        { id: "c4", e: "🙃", t: "Kopfüber steckst du bis zu den Ohren im Wolkenschaum. Über dir ruft der Drache irgendetwas, aber bei dir kommt nur ein fröhliches Blubbern an.", c: [
          { a: "Noch tiefer tauchen", to: "e2" },
          { a: "Dich abstoßen und die Wolke aufreißen", to: "e0" },
        ] },
        { id: "e0", e: "🌦️", end: 0, name: "Der erste Regen", t: "Die Wolke platzt auf wie ein ausgeschütteltes Bettlaken, und der Regen fällt endlich. Im ganzen Tal rennen die Leute mit Töpfen und Eimern hinaus und tanzen dabei." },
        { id: "e1", e: "🥾", end: 1, name: "Die Wolkensocken", t: "Am Ende hängt die Wäsche wieder an der Leine, und der Drache hält dir die zwei Wolkensocken hin. „Für dich.“ Wer sie anzieht, macht keinen einzigen Schritt mehr laut." },
        { id: "e2", e: "🛁", end: 2, name: "Kopfüber im Schaum", t: "Du greifst noch einmal zu — und rutschst mitten hinein. Als der Drache dich herauszieht, bist du weiß von oben bis unten und riechst drei Tage lang nach Seife." },
      ],
    },
    {
      key: "buecherei",
      diff: 1,
      depth: 6,
      e: "📚",
      title: "Die Höhlenbücherei",
      nodes: [
        { id: "s0", e: "📚", t: "Tief im Berg liegt eine Bücherei. Die Regale reichen bis unter die Decke, und dazwischen schnarcht ein alter Drache mit einer Brille auf der Nase. Auf seinem Bauch liegt ein aufgeschlagenes Buch.", c: [
          { a: "Das Buch nehmen", to: "a1" },
          { a: "Dich erst umsehen", to: "b1" },
        ] },
        { id: "a1", e: "🖋️", t: "Kaum hast du es in der Hand, blättert es von allein um. Auf der neuen Seite steht dein Name. Darunter schreibt sich ganz langsam ein einziges Wort: „Endlich.“", c: [
          { a: "Weiterlesen", to: "a2" },
          { a: "Das Buch zuklappen", to: "b2" },
        ] },
        { id: "b1", e: "🔖", t: "In den Regalen stehen tausend Bücher — und eines steht falsch herum, den Rücken nach hinten. Darüber hängt ein Schild: „Bitte nicht laut lesen.“", c: [
          { a: "Das falsche Buch herausziehen", to: "b2" },
          { a: "Trotzdem laut lesen", to: "c2" },
        ] },
        { id: "a2", e: "👁️", t: "„Du stehst in einer Höhle“, liest du. „Vor dir schnarcht ein Drache.“ Du schaust auf. Der Drache hat ein Auge geöffnet und schaut zurück.", c: [
          { a: "Ihn ansprechen", to: "a3" },
          { a: "Ganz still stehen bleiben", to: "b3" },
        ] },
        { id: "b2", e: "🕳️", t: "Hinter dem Buch klafft ein Loch im Regal. Darin steckt eine Kerze, die noch warm ist, und daneben eine zweite Brille, viel zu klein für einen Drachen.", c: [
          { a: "Die Kerze anzünden", to: "b3" },
          { a: "In das Loch hineingreifen", to: "c3" },
        ] },
        { id: "c2", e: "🗣️", t: "Deine Stimme hallt durch den ganzen Berg. Von allen Regalen antwortet ein Flüstern. Tausend Bücher lesen mit — und sie sind schneller als du.", c: [
          { a: "Noch lauter werden", to: "c3" },
          { a: "Zum Drachen laufen", to: "a3" },
        ] },
        { id: "a3", e: "🥱", t: "„Endlich“, gähnt der Drache. „Seit vierhundert Jahren liest mir keiner mehr vor. Meine Augen sind zu alt geworden, und allein ist ein Buch nur Papier.“", c: [
          { a: "Ihm sofort vorlesen", to: "a4" },
          { a: "Erst nach seiner Brille fragen", to: "b4" },
        ] },
        { id: "b3", e: "🔤", t: "Auf der Seite verrutschen die Buchstaben. Ganz langsam bilden sie einen einzigen Satz, als müsste jemand dabei nachdenken. „Wer bist du?“", c: [
          { a: "Antworten", to: "b4" },
          { a: "Die Seite umdrehen", to: "c4" },
        ] },
        { id: "c3", e: "🌀", t: "Aus den Regalen kommt ein Flüstern, erst eines, dann hundert. Alle Bücher erzählen dieselbe Geschichte — nur von hinten nach vorn.", c: [
          { a: "Rückwärts mitlesen", to: "c4" },
          { a: "Den Drachen wecken", to: "a4" },
        ] },
        { id: "a4", e: "🐕", t: "Der Drache legt den Kopf auf die Pfoten wie ein Hund. Über euch wird es dunkel, und nur noch ein einziges Licht brennt. Auf der letzten Seite ist noch Platz.", c: [
          { a: "Bis zum letzten Wort vorlesen", to: "e0" },
          { a: "Ihm das Buch in die Pfoten legen", to: "e1" },
        ] },
        { id: "b4", e: "⏩", t: "Das Buch schreibt weiter, schneller als du lesen kannst. Gerade erzählt es, wie du das Buch umdrehst — und du hast es noch gar nicht getan.", c: [
          { a: "Das Buch zumachen", to: "e1" },
          { a: "Es tatsächlich umdrehen", to: "e2" },
        ] },
        { id: "c4", e: "🙃", t: "Alles steht schon halb auf dem Kopf: die Buchstaben, die Regale, das Licht. Nur du noch nicht. Von irgendwoher kichert ein Buch.", c: [
          { a: "Dich auch umdrehen", to: "e2" },
          { a: "Zum Drachen rennen und vorlesen", to: "e0" },
        ] },
        { id: "e0", e: "📖", end: 0, name: "Das Buch, das zurückliest", t: "Du liest bis zum letzten Wort. Dort steht nur: „Danke.“ Der Drache schnarcht wieder, diesmal lächelnd. Und ganz langsam erscheint darunter ein neuer Satz: „Kommst du morgen wieder?“" },
        { id: "e1", e: "👓", end: 1, name: "Die Drachenbrille", t: "Der alte Drache blinzelt, nimmt seine Brille ab und setzt sie dir auf. Alles wird scharf: die kleinste Schrift, die feinsten Linien. „Behalt sie“, sagt er. „Ich brauche sie nicht mehr — und du liest ja weiter.“" },
        { id: "e2", e: "🤸", end: 2, name: "Verkehrt herum", t: "Ein Ruck — und alles steht auf dem Kopf: die Regale, der Drache, du. Es dauert bis zum Abend, bis der Drache aufhört zu lachen und dich wieder umdreht." },
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
          { a: "Zuerst außen am Berg entlanggehen", to: "b1" },
        ] },
        { id: "a1", e: "🏮", t: "Der Stollen riecht nach Rauch und Regen. Alle zwölf Sekunden zittert der Boden, und von der Decke rieselt Staub. Zwölf Sekunden, jedes Mal genau zwölf — kein Erdbeben ist so pünktlich.", c: [
          { a: "Weiter hinein, dem Zittern nach", to: "a2" },
          { a: "Die Wände mit der Laterne absuchen", to: "b2" },
        ] },
        { id: "b1", e: "💨", t: "An der Nordseite ist der Fels warm. Aus einer Spalte zieht ein dünner Faden Dampf, und aus der Tiefe kommt ein Geräusch: nicht wie Donner, eher wie ein sehr großes Hicksen.", c: [
          { a: "In die Spalte hineinhorchen", to: "b2" },
          { a: "Die Spalte größer machen", to: "c2" },
        ] },
        { id: "a2", e: "🕳️", t: "Der Gang wird breiter und mündet in eine Halle, so groß wie das ganze Dorf. In der Mitte liegt etwas Riesiges zusammengerollt, und bei jedem Hicksen hebt sich der Boden einen halben Meter.", c: [
          { a: "Geradewegs hingehen", to: "a3" },
          { a: "Erst am Rand entlang beobachten", to: "b3" },
        ] },
        { id: "b2", e: "✒️", t: "Im Licht siehst du Kratzspuren im Fels. Jemand hat gezählt: Strich für Strich, hunderte davon. Beim letzten hat der Kratzer mitten im Strich aufgehört, als wäre ihm die Kraft ausgegangen.", c: [
          { a: "Die Striche zählen", to: "b3" },
          { a: "Mit einem Stein dagegen klopfen", to: "c3" },
        ] },
        { id: "c2", e: "💧", t: "Die Spalte gibt nach, und du rutschst in einen Gang voller Wasser. In den Pfützen schwimmen Schuppen, so groß wie Teller — und jede einzelne von ihnen hat einen Sprung.", c: [
          { a: "Eine Schuppe ans Ohr halten", to: "c3" },
          { a: "Dem Wasser in die Tiefe folgen", to: "a3" },
        ] },
        { id: "a3", e: "👁️", t: "Aus der Nähe ist es ein Drache, und er ist wach. Ein Auge so groß wie ein Wagenrad öffnet sich. „Bitte“, sagt er leise, „nicht erschrecken. Ich habe wirklich alles versucht. Es hilft nicht.“ HICKS.", c: [
          { a: "Fragen, was ihm fehlt", to: "a4" },
          { a: "Dich neben ihn setzen", to: "b4" },
        ] },
        { id: "b3", e: "🔢", t: "Vierhundertzwölf. Jemand liegt hier seit vierhundertzwölf Tagen und zählt sie an der Wand mit. Von weiter unten kommt bei jedem Beben ein Seufzen mit herauf, tief und müde.", c: [
          { a: "Dem Seufzen nachgehen", to: "b4" },
          { a: "Zurückseufzen, so laut du kannst", to: "c4" },
        ] },
        { id: "c3", e: "📣", t: "Ganz weit weg antwortet eine Stimme, viel zu klein für diesen Berg: „Hallo? Ist da wer?“ Irgendwo hier unten wartet noch jemand — und zählt vielleicht auch mit.", c: [
          { a: "Zurückrufen", to: "c4" },
          { a: "Der Stimme entgegengehen", to: "a4" },
        ] },
        { id: "a4", e: "🪨", t: "Er heißt Grimm. Zwischen seinen Flügeln klemmt ein Felsbrocken, und vom Hicksen ist er immer tiefer gerutscht. „Vierhundertzwölf Tage“, sagt er. „Ich habe aufgehört zu zählen.“", c: [
          { a: "Den Brocken untersuchen", to: "a5" },
          { a: "Ihm einfach zuhören", to: "b5" },
        ] },
        { id: "b4", e: "🍎", t: "„Seit ich das Herz des Berges verschluckt habe“, brummt eine tiefe Stimme über dir. „Ein Stein, so groß wie dein Kopf. Ich dachte, es wäre ein Apfel.“ HICKS. Von der Decke fällt ein Brocken.", c: [
          { a: "Ihn ruhig weiteratmen lassen", to: "b5" },
          { a: "Ihn erschrecken wollen", to: "c5" },
        ] },
        { id: "c4", e: "🪣", t: "Ein kleiner Drache kommt um die Ecke, mit einem Eimer Wasser in beiden Klauen. „Ich hole ihm seit vierhundert Tagen Wasser“, sagt er. „Geholfen hat es noch nie. Aber irgendwas muss man ja tun.“", c: [
          { a: "Etwas ganz Neues ausprobieren", to: "c5" },
          { a: "Gemeinsam mit ihm anpacken", to: "a5" },
        ] },
        { id: "a5", e: "🪵", t: "Unter dem Felsbrocken liegt eine Fuge, gerade breit genug für einen Hebel. Und der beste Moment zum Hebeln kommt hier unten alle zwölf Sekunden ganz von allein.", c: [
          { a: "Beim nächsten Hicksen hebeln", to: "e0" },
          { a: "Erst erklären, was du vorhast", to: "e1" },
        ] },
        { id: "b5", e: "🌩️", t: "Grimm hält die Luft an, so lange er kann. Sein Hals wird dick, seine Augen werden schmal, und in seinem Bauch grummelt es wie ein Gewitter, das sich nicht entscheiden kann.", c: [
          { a: "Mit ihm zusammen atmen", to: "e1" },
          { a: "Laut BUH rufen", to: "e2" },
        ] },
        { id: "c5", e: "😯", t: "Alles, was man einem Drachen mit Schluckauf antun kann, ist längst versucht worden: Wasser, Luft anhalten, Kopfstand, rückwärts zählen. Übrig bleibt genau ein einziger alter Trick.", c: [
          { a: "Ihn erschrecken", to: "e2" },
          { a: "Doch lieber den Brocken anpacken", to: "e0" },
        ] },
        { id: "e0", e: "💎", end: 0, name: "Das Herz des Berges", t: "Der Brocken kippt. Grimm streckt sich zum ersten Mal seit vierhundert Tagen, hustet — und ein glatter roter Stein rollt heraus. Der Berg wird still. Der Stein liegt heute im Dorfbrunnen und wärmt das Wasser den ganzen Winter." },
        { id: "e1", e: "🤝", end: 1, name: "Der Pakt", t: "Ihr atmet zusammen: ein, aus, ein, aus. Beim siebten Mal bleibt das Hicksen aus. Grimm sieht dich lange an. „Ein Pakt“, sagt er. „Du kommst wieder, und ich bebe nie mehr ohne Vorwarnung.“ Ihr gebt euch Pfote und Hand." },
        { id: "e2", e: "😆", end: 2, name: "Eine Woche Schluckauf", t: "Dein BUH hallt durch den ganzen Berg. Grimm erschrickt so sehr, dass er einmal tief einatmet — und dich dabei gleich mit. Als er dich wieder auspustet, hast du selbst Schluckauf. Eine ganze Woche lang, alle zwölf Sekunden." },
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
          { a: "Erst den Flügel ansehen", to: "b1" },
        ] },
        { id: "a1", e: "🚪", t: "„Ich habe geübt“, schluchzt Nuri. „Jede Nacht. Und heute Morgen lag die Feder einfach da.“ Ihr Blick bleibt an einer Stalltür hängen, die offen steht und im Wind hin und her schlägt.", c: [
          { a: "Zu der offenen Tür gehen", to: "a2" },
          { a: "Sie erst einmal trösten", to: "b2" },
        ] },
        { id: "b1", e: "✂️", t: "Die Feder ist nicht gebrochen — sie ist abgeschnitten. Der Schnitt ist gerade wie mit einer Schere, und am Rand klebt etwas Klebriges, das nach Honig riecht.", c: [
          { a: "Dem Honiggeruch nachgehen", to: "b2" },
          { a: "Die Feder einstecken", to: "c2" },
        ] },
        { id: "a2", e: "🍯", t: "Im Stall steht ein Eimer Honig, und daneben liegt eine Schere, so groß wie dein Arm. Über den Boden führt eine klebrige Spur nach draußen, genau bis zur Startlinie.", c: [
          { a: "Der Spur bis zur Startlinie folgen", to: "a3" },
          { a: "Erst den Wettkampfmeister fragen", to: "b3" },
        ] },
        { id: "b2", e: "🫙", t: "An der Startlinie stehen Honigtöpfe in einer Reihe. „Damit die Flügel glänzen“, sagt der Wettkampfmeister. „Alle nehmen davon. Alle außer Nuri. Sie war heute Morgen zu spät.“", c: [
          { a: "Fragen, wer als Erster da war", to: "b3" },
          { a: "In die Töpfe hineinschauen", to: "c3" },
        ] },
        { id: "c2", e: "🌡️", t: "Die Feder in deiner Tasche ist warm. Nicht sonnenwarm — handwarm. Jemand hat sie eben noch gehalten, und zwar lange, so als hätte er lange überlegt.", c: [
          { a: "Nach warmen Klauen suchen", to: "c3" },
          { a: "Damit zum Wettkampfmeister gehen", to: "a3" },
        ] },
        { id: "a3", e: "🥇", t: "An Startplatz eins putzt Baron Bramm seine Flügel, der größte Drache im Tal. An seiner Kralle klebt Honig, und daneben liegt eine einzelne fremde Feder im Gras.", c: [
          { a: "Ihn sofort darauf ansprechen", to: "a4" },
          { a: "Erst die fremde Feder aufheben", to: "b4" },
        ] },
        { id: "b3", e: "🤫", t: "„Bramm“, sagt der Meister leise. „Er ist immer als Erster da. Und er hat noch nie verloren.“ Dabei schaut er nicht zur Startlinie, sondern weg, hinüber zu den Bergen.", c: [
          { a: "Nachfragen, warum er wegschaut", to: "b4" },
          { a: "Selbst bei Startplatz eins nachsehen", to: "c4" },
        ] },
        { id: "c3", e: "🔍", t: "In einem der Töpfe schwimmt eine winzige Feder — dieselbe Farbe wie Nuris. Und ganz unten am Boden klemmt ein zweiter Schnipsel, in einer anderen Farbe. Es waren also zwei.", c: [
          { a: "Beide Schnipsel herausfischen", to: "c4" },
          { a: "Damit zu Startplatz eins gehen", to: "a4" },
        ] },
        { id: "a4", e: "😔", t: "Bramm wird ganz still. „Ich wollte ihr nicht wehtun“, sagt er endlich. „Ich wollte nur gewinnen. Ein letztes Mal.“ Er ist alt. Man sieht es erst, wenn er die Flügel hängen lässt.", c: [
          { a: "Fragen, warum es das letzte Mal ist", to: "a5" },
          { a: "Ihm einfach zuhören", to: "b5" },
        ] },
        { id: "b4", e: "⏳", t: "„Bramm fliegt seit hundert Jahren“, sagt der Meister hinter dir. „Dieses Jahr ist sein letztes, danach ist er zu alt für die Schlucht. Er hat Angst davor, als Verlierer aufzuhören.“", c: [
          { a: "Nach einer Lösung für beide suchen", to: "b5" },
          { a: "Die abgeschnittenen Federn vergleichen", to: "c5" },
        ] },
        { id: "c4", e: "🪶", t: "Bei Startplatz eins liegen zwei abgeschnittene Federn im Gras: eine kleine und eine, die viel größer ist. Jemand hat sich also auch selbst eine abgeschnitten. Warum denn das?", c: [
          { a: "Die beiden nebeneinanderlegen", to: "c5" },
          { a: "Bramm damit vor die Klauen treten", to: "a5" },
        ] },
        { id: "a5", e: "🧩", t: "„Weil ich sie brauchte“, sagt Bramm und legt die zweite Feder auf den Tisch. „Ihre passt in mein Loch. Meine passt in ihres. Ich wollte tauschen — und habe mich nicht getraut zu fragen.“", c: [
          { a: "Beide zusammen an den Start schicken", to: "e0" },
          { a: "Nuri holen und sie entscheiden lassen", to: "e1" },
        ] },
        { id: "b5", e: "📯", t: "Die Hörner blasen. Alle Drachen stehen an der Startlinie, und Nuri sitzt immer noch hinter dem Stall. Dir bleibt genau ein Startsignal Zeit, um dich zu entscheiden.", c: [
          { a: "Nuri holen und sie entscheiden lassen", to: "e1" },
          { a: "Selbst auf Nuris Rücken springen", to: "e2" },
        ] },
        { id: "c5", e: "🔁", t: "Die beiden Federn passen ineinander wie zwei Puzzleteile — nur andersherum als gedacht. Wer sie so anlegt, fliegt garantiert nicht geradeaus. Aber fliegen würde er.", c: [
          { a: "Sie trotzdem so anlegen", to: "e2" },
          { a: "Sie richtig herum tauschen lassen", to: "e0" },
        ] },
        { id: "e0", e: "🏆", end: 0, name: "Der Windpokal", t: "Nuri und Bramm starten nebeneinander, dreimal um den Berg, einmal durch die Schlucht — und kommen Flügel an Flügel ins Ziel. Zum ersten Mal seit hundert Jahren wird der Windpokal geteilt. Er passt genau in die Mitte ihres Nestes." },
        { id: "e1", e: "🤍", end: 1, name: "Die geliehene Feder", t: "Nuri hört sich alles an, schaut Bramm lange an und sagt dann: „Geliehen. Nicht getauscht.“ Sie fliegt mit seiner Feder und wird Dritte. Bramm sitzt am Ziel und klatscht so laut, dass die Schlucht wackelt." },
        { id: "e2", e: "😂", end: 2, name: "Rückwärts durchs Ziel", t: "Irgendetwas stimmt mit der Balance überhaupt nicht: Ihr fliegt die komplette Runde rückwärts. Ihr werdet Letzte. Aber ihr seid die Einzigen, die dabei die ganze Zeit lachen." },
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
          { a: "Sofort nach Norden aufbrechen", to: "a1" },
          { a: "Die Wetterfrau nach ihm fragen", to: "b1" },
        ] },
        { id: "a1", e: "🥾", t: "Nach zwei Tagen endet der Weg an einem See, der nicht zufriert. Am Ufer liegt eine Schaufel, größer als eine Tür, und ein Paar Fußspuren führt ins Wasser und nicht wieder heraus.", c: [
          { a: "Den Spuren bis ans Wasser folgen", to: "a2" },
          { a: "Erst die Schaufel untersuchen", to: "b2" },
        ] },
        { id: "b1", e: "🔔", t: "„Jeden November steigt er aus dem See und atmet einmal über das Tal. Dann schneit es. Dieses Jahr blieb der See glatt.“ Sie legt dir eine kleine Glocke in die Hand. „Er hört nichts außer Glocken.“", c: [
          { a: "Fragen, warum ausgerechnet Glocken", to: "b2" },
          { a: "Die Glocke einstecken und losgehen", to: "c2" },
        ] },
        { id: "a2", e: "🫧", t: "Das Wasser ist klar bis auf den Grund. Ganz unten liegt etwas Weißes und Langes, zusammengerollt wie ein schlafender Hund. Alle sieben Minuten steigt eine einzelne Blase auf.", c: [
          { a: "Ins Wasser steigen", to: "a3" },
          { a: "Warten und die Blasen zählen", to: "b3" },
        ] },
        { id: "b2", e: "🗒️", t: "Die Schaufel ist eiskalt, der Griff ganz abgegriffen. Jemand hat sie hundert Winter lang benutzt. Im Blatt klemmt ein Zettel, steif gefroren: „Wecken um Mitternacht. Nicht früher.“", c: [
          { a: "Bis Mitternacht warten", to: "b3" },
          { a: "Mit dem Finger an die Schaufel klopfen", to: "c3" },
        ] },
        { id: "c2", e: "🤫", t: "Am Ufer ist es so still, dass du dein eigenes Herz hörst. „Sein Gehör ist so fein, dass laute Geräusche ihm wehtun“, hat die Wetterfrau gesagt. „Darum schläft er im Wasser.“", c: [
          { a: "Die Glocke ganz leise anschlagen", to: "c3" },
          { a: "Trotzdem ins Wasser steigen", to: "a3" },
        ] },
        { id: "a3", e: "🧊", t: "Das Wasser ist so kalt, dass es an den Beinen brennt. Nach drei Schritten hört der Grund auf. Unter dir, ganz weit unten, öffnet sich ein Auge: hellblau, so groß wie ein Wagenrad.", c: [
          { a: "Ihm zuwinken", to: "a4" },
          { a: "Ganz still stehen bleiben", to: "b4" },
        ] },
        { id: "b3", e: "🌑", t: "Die Sonne geht unter, und der See wird schwarz. Alle sieben Minuten eine Blase. Sieben Minuten sind lang für einen Atemzug und sehr kurz für hundert Jahre Schlaf.", c: [
          { a: "Weiter warten", to: "b4" },
          { a: "Am Ufer Holz sammeln", to: "c4" },
        ] },
        { id: "c3", e: "🌊", t: "Ein heller Ton läuft über das Wasser. Ein Kreis zieht sich, dann noch einer. Etwas kommt herauf, sehr langsam, damit es nicht platscht — und bleibt auf halbem Weg stehen.", c: [
          { a: "Ihm etwas Warmes anbieten", to: "c4" },
          { a: "Ihm entgegengehen", to: "a4" },
        ] },
        { id: "a4", e: "🐋", t: "Ein Kopf taucht auf, weiß wie Raureif, mit Eiszapfen an den Ohren. Eine Stimme sagt so leise, dass du sie fast nur fühlst: „Ist es schon Zeit?“", c: [
          { a: "Ihm die Wahrheit sagen", to: "a5" },
          { a: "Erst fragen, wie es ihm geht", to: "b5" },
        ] },
        { id: "b4", e: "😢", t: "Er kommt bis zum Bauch aus dem Wasser und schaut über das Tal. „Hundert Jahre“, sagt er. „Und jedes Jahr fürchte ich mich vor dem ersten Atemzug. Er ist so schrecklich laut.“", c: [
          { a: "Ihm sagen, dass alle auf ihn warten", to: "b5" },
          { a: "Ihm etwas Warmes anbieten", to: "c5" },
        ] },
        { id: "c4", e: "🪵", t: "Am Ufer brennt bald ein kleines Feuer. Es knistert — viel zu laut für so ein feines Gehör. Aber es wärmt, und draußen im Schwarzen bewegt sich etwas näher heran.", c: [
          { a: "Das Feuer noch kleiner machen", to: "c5" },
          { a: "Ihn zu dir herüberrufen", to: "a5" },
        ] },
        { id: "a5", e: "🏔️", t: "Er steht jetzt ganz da und schaut über ein Tal, in dem seit zwei Jahren kein Schnee gefallen ist. „Wenn ich ausatme“, sagt er, „hört das ganze Tal es. Und dann schauen alle her.“", c: [
          { a: "Sagen, dass genau darauf alle warten", to: "e0" },
          { a: "Ihm versprechen zu bleiben", to: "e1" },
        ] },
        { id: "b5", e: "🤝", t: "„Ich bin allein hier oben“, sagt er. „Und allein zu frieren ist etwas ganz anderes als allein zu schlafen.“ Er schaut zum Ufer hinüber, wo es dunkel ist und nichts auf ihn wartet.", c: [
          { a: "Ihm versprechen zu bleiben", to: "e1" },
          { a: "Ein Feuer für ihn anzünden", to: "e2" },
        ] },
        { id: "c5", e: "👅", t: "Am Ufer brennt ein kleines, ruhiges Feuer. Der Drache kommt bis auf drei Schritte heran und streckt die Zunge nach der Wärme aus — eine Zunge aus lauter kleinen Eiszapfen.", c: [
          { a: "Ihn ganz nah heranlassen", to: "e2" },
          { a: "Ihn bitten, endlich auszuatmen", to: "e0" },
        ] },
        { id: "e0", e: "❄️", end: 0, name: "Der erste Schnee", t: "Er atmet einmal aus, ganz langsam, über das ganze Tal. Es dauert einen Herzschlag, dann fällt der erste Schnee seit zwei Jahren. Unten im Dorf gehen alle Türen auf. Die Igel schlafen noch in derselben Nacht ein." },
        { id: "e1", e: "🔥", end: 1, name: "Ein Feuer für alle", t: "Du bleibst, bis er einschläft, und vorher baut ihr noch ein Feuer direkt am Wasser. Seitdem brennt dort jeden November eines, und jedes Jahr geht jemand aus dem Dorf hinauf und setzt sich dazu. Der Winter kommt seither pünktlich." },
        { id: "e2", e: "🥶", end: 2, name: "Festgefrorene Zunge", t: "Er streckt die Zungenspitze ins Feuer — und sie klebt fest. Am Holzscheit. Ihr braucht bis zum Morgen und drei Eimer warmes Wasser. Er entschuldigt sich achtzehnmal, und du sagst achtzehnmal, dass das das Lustigste war, was du je gesehen hast." },
      ],
    },
  ],
};
