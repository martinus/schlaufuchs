* Update CLAUDE.md mit lessons-learned dieser session: e.g. schreibe immer einen test, spätestens wenn ein bug gefunden wurde, um regressionen so gut wie möglich abfangen zu können
* Eine Inkonsistenz: Auf der Karte ist ein "Pokalraum", aber in diesem steht "Stickeralbum". Baue das Stickeralbum um, wie wäre es wenn das einfach "Trophäen" heist? Eventuell auch die Seite anpassen damit es wie Ein Trophäenraum wirkt...

------

Zu den Pokalregeln, ist das fairer?
* Jeder neue Stern gibt einen Punkt (soll motivieren alle Aufgaben zu lösen)
* Meistern einer Aufgabe (3 Sterne) gibt 2 Punkte
* Fehlerfreie Runde gibt 1 Punkt auf leicht, 2 auf mittel, 3 auf schwer
* gemeisterte Levels sollen angezeigt werden (vielleicht leicht ausgegraut?) Ich hätte die regeln gerne irgendwie visuell ersichtlich, die kinder sollen intuitiv sehen dass sie mehr von den schweren und ungelösten Aufgaben bekommen. Zumindest möchte ich die Kinder motivieren eher die nicht gemachten Levels zu machen, kein Mensch wird die Regeln lesen wenn man sie im Pokalraum genau beschreibt.
* Ich finde die Levelsteigerung auf 30 zu schwer, es soll schon gut möglich sein alles zu schaffen. Arbeite am balancing.

------

Die Sprauchauswahl im  Menü ist nicht intuitiv, zeige statdessn alle Sprachen an die verfügbar sind, und die momentan ausgewählte hervorgehoben (vielleicht kommt z.b. spanisch oder Französisch noch dazu, idealerweise mit einer Flagge)

-------

wie bekommt man den 2. Stern? Ich habe auf mittel bei einer session 9 von 10 richtig (hatte da vorher einen Stern bekommen) und mir erwartet jetzt den 2. stern zu bekommen

------

* Man kann mehr als einen Pokal pro Runde gewinnen, zeig alle gewonnenen Pokale an, nicht nur den letzten
* Bau irgendwo einen Link auf einen Disclaimer ein (in den Einstellungen? oder ganz unten?) Im Disclaimer kommt cookie disclaimer. Ich werde noch google analytics einbauen, brauch ich da einen cookie consent auch?
* Erzeuge eine eltern view mit statistiken zum Lernerfolg, so dass Eltern gut wissen wieviel Zeit mit welchen Aufgaben verbracht wird und wo es Probleme/Bedarf gibt, vor alle auch wo Eltern noch helfen sollten
* Zeichne die Spiele die noch nicht verfügbar sind auf der Karte hinter einer Nebelschwades (oder anders visuell), so dass man jedenfalls sieht dass es noch nicht erreichbar ist
* Die anzahl der Sterne die noch zu holen sind könnten bei einer Runde beim Weg des Fuchses im angezeigt werden. Hier eine Idee zur visualisierung, bevor du das baust möchte ich dazu dein Feedback: Z.b. als Sterne in einem Korb? Bei jedem Fehler wackelt der Korb und es fallen Sterne heraus, im Korb sieht man immer wieviele Sterne noch zu holen sind, daneben liegen die verlorenen. Ist das motivierend oder eher demotivierend? Ich möchte nicht dass Kinder deswegen eine Runde gleich abbrechen wenn sie gleich zu Beginn einen Fehler machen. Oder man gibt ihnen gleich einen Retry knopf (Zurück zum Start?)


----
* Mir gefällt die Schrift beim Korb und die Anzeige nicht. Die schrift ist zu klein und scheint nicht die richtige Schriftart zu sein. Entferne die Feuer-logik und die anzeige, das ist zuviel. Ausserdem soll angezeigt werden wieviel Sterne wirklich noch zu holen sind, wenn man eine Aufgabe schon fertig gesammelt hat dann soll auch gezeigt werden dass man keine Sterne mehr bekommen kann.

* Ich hätte die Anzeige der gesammelten Sterne gerne viel besser: Z.b. ein Himmel oben der die verfügbaren Sterne anzeigt, und die Sterne grau wenn man sie schon eingesammelt hat. Darunter einen größeren Korb in einer Wiese. Wenn man sich einen oder mehr Sterne verdient hat, sollen die in einer Animation zum Korb fliegen und oben im Himmel grau werden. Bau den Fuchs weg in die Grafik ein.  Das ganze soll möglichst ohne Text auskommen.

-----
Committe jede Änderung separat. Hier kommen viele teils aufwändige Aufgaben.

* Nimm die 360x640 Spec-Änderung in einem neuen commit.

Zur neuen Himmelgrafik, ein paar Vorschläge:
* Der Korb soll am Ende der Reise angezeit werden, statt der Glocke, und etwas höher damit er voll zu sehen ist. Der Fuchs endet dann genau beim Korb in der letzten Runde.
* Bei Mittel/Schwer sind ja mehr Sterne zu holen, das soll auch so am Himmen angezeigt werden? Am besten als Sternengruppe, weil dann bekommt man ja bis zu 3 auf einmal
* Verteile die Sterne besser oben am den Himmel, nicht einfach so nebeneinander
Die ganze Grafik kann ruhig etwas höher sein denke ich

Weitere Änderungen:
* Erstelle sowas wie ein Impressum / About Me. Das soll kurz Informationen zu mir beinhalten: Martin Leitner-Ankerl, email martin.ankerl@gmail.com, Das ich Software entwickler bin, und ein Link auf Keto-calculator und meine anderen Projekte.

* Ich denke Level für den Fuchs ist unnötig, die Sterne reichen. Oder gibt das eventuell zusätzliche Motivation? Ich glaube vereinfachen ist wichtiger. Ausserdem kann man die Fuchs + Sterne Ansicht nicht klicken, es wird aber auf der Karte und im Spiel wie ein Button angezeigt.

* Baue alle tools die dir helfen, wie im letzten Handoff beschrieben.

* Mit dem frontend-design skill: Stelle sicher dass überall die richtige Schriftart verwendet wird und alle Seitendesigns gut aussehen und konsistent sind. Mach die Zeile mit "Deine Fortschritte werden nur..." kleiner. Hier reicht der Link auf Datenschutz und "Über mich".


----
Weitere Aufgaben:

* Entferne die Zeile "Deine Fortshritte werden nur auf diesem Gerät gespeichert", das steht eh im Datenschutz und macht den Bereich kleiner.

* Ich denke es ist besser im Spiel den Button für das Level aus der Top reihe rauszunehmen und über dem Bild zu platzieren und so breit wie der Himmelsweg zu sein. Das wirkt passender, quasi wie eine Überschrift. Oben der Fuchs und die Sterne sollte zentriert sein

* Die Karte und die Spiele sollen die gleiche Topleiste haben  (Kartenbutton, Fuchstatus, Einstellungen). Einziger Unterschied: Im Kartenansicht ist der Kartenbutton flach weil nicht klickbar.

* Bei der Levelauswahl schreib bei Mittel 2xStern, bei Schwer 3xStern damit klarer ist dass es dafür mehr Sterne gibt. Entferne dafür die grünen +12 etc. Zahlen. Stattdessen zeige überall 3 Sterne , als Gelb oder Grau je nachdem wieviele man davon schnon hat (So wie beim Himmel). Damit das logisch passt, mach die Sterne linear; also der erste, zweite, und letzte Stern bringt gleich viel Punkte (Also bei leicht: 1, 1, 2; bei mittel: 2, 2, 2; bei schwer: 3, 3, 3). Berechne dazu das Balancing neu damit es einem Kind möglich ist alle Pokale zu sammeln

Mir gefallen die Kosmetika am Fuchs nicht, entferne alle und auch die Logik dazu. Oben die Anzeige soll nur den Fuchs, die Sterne, und die Anzahl der Pokale anzeigen. Das soll so auf Karte und im Spiel gleich aussehen.
--------

Es ist Zeit für ein großes cleanup. Analysiere die gesamte codebasis und mach ein großes Refactoring. Ziel ist es den Code zu vereinfachen, duplizierungen zu verringern, teile wiederverwenden wo möglich: Z.b. sollen Spiele und Karte den gleichen Header verwenden, das könnte eine Codebasis sein. Schau auch dass der Code modern und testbar ist, finde Lücken und unsicherheiten und bessere nach. 

-------
Ich habe das Spiel an meiner 8 Jährigen Tochter Mara getested, das Resultat war schon ernüchternd. Getestet habe ich allerdings nicht am Handy sondern im Develoment Ansicht am PC, Einstellung "Iphone 17" (402x874). Es gab sehr viele Usability probleme und unklarheiten. Ich habe versucht möglichst nichts zu sagen und sie einfach spielen lassen. Hier ist das Ergebnis. Leite daraus einen neuen Plan ab und versuche sämtliche Punkte viel intuitiver zu gestalten. Meine Ideen sind allesamt nur Ideen, wenn du bessere Ideen hast dann immer her damit! Ich bin kein Usability experte, durchdenke alles kritisch.

* Mara weiß nicht worauf sie auf der Karte klicken kann. Sie hat sämtliche Nebel geklickt, aber nicht auf die Häuser in der Mitte und wusste dann nicht was sie tun soll. Sie hat praktisch nichs gelesen und einfach nur auf die Buttons gedruckt, daher hat sie auch die Hinweise bei den fehlenden Spielen nicht gelesen und wuste nicht dass sie auf die Häuser klicken kann.

* Sie wusste nicht wie man aus dem Pokalraum wieder raus kommt, bzw was das ist. Sie hat keinen Text gelesen. Nachdem sie nach unten gescrollt hat wusste Sie auch nicht wie sie wieder rauf kommt (ok, sie hat im browserfenster in der Handysimulation gespielt, am Handy hätte sie das vielleicht gewusst.)

* Ich habe sie darauf hingewiesen, dass sie auf die Häuser klicken muss um das Einmaleins zu spielen. Daraufhin hat sie genau zwischen die Häuser geklickt und es ist nichts passiert.

* Im Spiel: weiß nicht wie man Level wechselt oder dass es so eine Einstellung überhaupt gibt
 
* Nach Spielende ist sie verwundert über das Bild mit der Schulglocke (der erste Pokal), sie weiß nicht dass das ein Pokal ist den sie da gewonnen hat, und auch nicht dass der Pokal dann im Pokalraum zu finden ist oder wie sie dahin kommt.
Meine Idee zur Verbesserung: Zeige das grafisch viel besser an. die Bilder sollen auch immer quadratisch sein und so aussehen wie im Pokalraum. Die Pokale müssen deutlich zu sehen sein. Vielleicht zeig auf jedem Bild auch einen wirklichen Pokal an? Also das Emoji vom Pokal, und darauf dann das Symbol das quasi im Pokal liegt. Das soll dann auch im Pokalraum genauso aussehen.

* Mara weiß nicht wie man Spiel anderes einstellt so dass andere Reihen kommen. Sie hat versucht während der Anzeige des Endes auf den button am Spielfeld der auf dem gerade stand "Leicht * 2er" zu drücken was aber nicht geht weil sie ja in dem modalen Fenster ist. Die buttons im modalen Fenster hat sie nicht gedrückt und auch deren Text nicht gelesen.
Meine Idee zur Verbesserung: Wenn das Spiel zu ende ist, Zeig nur einen "Ok" button, oder "Super!" oder vielleicht eine andere zufällige Gratulation. Kein Buttons.. Nach Drücken auf den Button kann eh die Level geändert werden und auf die Karte geklickt werden. Es soll genau einen Einstellbutton geben, und der soll der über dem Himmel sein. Der muss aber klarer sein dass man hier was umstellen kann.

* Bei Spielende hat sie auf den gewonnen Pokal geklickt aber nichts ist passiert

* Beim Umstellen des Levels war ihr nicht klar dass sie zuerst auf Leicht, Mittel, Schwer klicken sollte. Ihr war auch nicht klar dass sie da überhaupt klicken kann. Das Feld am Schluss mit "Alle" hat sie nie gesehen weil sie nicht so viel liest. Nachdem ich sie darauf hingewiesen habe war ihr auch nicht klar was das bedeutet, aber sie hat es rausgefunden.

* Auf der Kartenansicht hat sie den Pokalraum dann nicht gefunden, sie hat nur ein Haus gesehen. Es ist nicht klar dass das der Pokalraum ist, und sie wusste nicht dass man drauf drücken kann.weiß nicht dass man drauf drücken kann.
Meine Idee zur Verbesserung: bei Spielende muss klar sein dass die Pokale in den Pokalraum wandern. Zeichne z.b. eine Animation wo man sieht dass der Fuchs die Pokale mit dem Emoji in das Pokalhaus bringt. Das Pokalhaus soll auch ganz klar ein oder mehrer große Pokale zeigen, nicht den mini Pokal am Dach. 

* Im Pokalraum ist unklar was z.b. 20x oder 62x bedeutet (die Anzahl der Sterne um diesen Pokal zu bekommen)
Meine Idee zur Verbesserung: Schreib von Anfang in jedes Feld mit Pokal wieviel Sterne dazu notwendig sind, also schreib unten z.b. ⭐ 20, ⭐ 62 (ausgegrauter Stern wenn noch nicht erreicht)

* Im Spiel beim ändern der Schwierigkeit: Mara ist nicht klar dass es bei Mittel oder Schwer auch mehr Sterne gibt (das x2 oder x3 ist auch unklar oder wurde übersehen)

* Im Spiel, bei Schwer: Mara kennt das Division symbol nicht, in der Schriftart wird zwischen Doppelpunkt ein strich gemacht, das kennt sie nicht. In der Schule ist das nur ein Doppelpunkt

* Sie hat nicht verstanden dass sie einen Fehler gemacht hat, sie hat dann einfach auf "Verstanden" geklickt und wusste nicht wiesso sie das tun soll.
Meine Idee zur Verbesserung: Es soll auch angezeigt werden was sie angegeben hat (rot hinterlegt), und darunter soll die richtige Lösung stehen. Das Fenster soll Modal sein, also es soll offensichtlich sein dass das sowas wie ein Popup ist, und das Spiel im Hintergrund nicht klickbar ist. Vielleicht sollte sie hier auch die richtige Lösung extra eintippen müssen um wieder ins Spiel kommen zu können

------
Die Änderungen sind super, hier noch ein paar Wünsche:

* Man sieht die Sterne schlecht bei der Level Auswahl, vielleicht die Farben grün, gelb, rot dunkler machen?
* Die Symbole sollten oberhalb des Pokals sein, wie wenn sie darin liegen würden; und größer so dass man sie auch gut erkennen kann
* Im Pokalraum entferne die Anzeige "X von 60 Pokalen"
* Auf der Karte entferne die Anzeige von der Anzahl der Pokale unter dem Pokalraum, stattdessen zeig die Anzahl über dem großen Pokal an der am Haus dargestellt ist
* Wenn ich in der Karte auf z.b. den Pokalraum klicke oder auf das Zahlendorf, dann soll der fuchs auch wirklich dorthin wandern, in einer kleinen Animation. Erst wenn der Fuchs dort ist soll es sich öffnen. Wenn man dann wieder auf die Karte geht, soll der Fuchs auch vor dem Bereich stehen in dem man gerade war, und wenn man woanders klickt dorthin wandern.
* Benenne das Zahlendorf um in Einmaleins, wie das Spiel. Ich möchte dass das einheitlich ist. Im Einmaleins zeig auch das jeweilige Symbol an, also die Häuser oder im Pokalraum das Symbol vom Pokalraum. Entferne den Text vom Pokalraum, liest eh keiner; es soll intuitiv erkennbar sein was das ist.
* Im Pokalraum: Bei klick auf einenm Pokal zeig diesen ganz groß, und lass Konfetti regnen, es soll beeindruckend sein, der Fuchs soll auch daneben huepfen, Sterne sollen blinken, so dass das Kind das stolz herzeigen moechte

----
* Positioniere den Doppelpunkt (was ja als Divisionssymbol verwendet wird) etwas hoeher damit er nicht wie ein Doppelpunkt wirkt
* In der Levelauswahl: mach einen weissen Rand um die Sterne, man sieht sie trotzdem sonst sehr schlecht
* Statt in der Himmelansicht bei den Sternen ein x2 oder x3 anzuzeigen, zeichne einfach kleine Gruppen mit 2 oder 3 Sterne (halt etwas kleiner), die dann alle in den Korb fliegen
* Im Fehlerfall soll die Eingabe genauso wie im Spiel funktionieren, also z.b. bei Schwer oder Mittel Zahl eingeben und auch wirklich auf OK drucken muessen
* zeig den Pokal auf den man klickt noch groesser, er soll den Schirm ziemlich ausfuellen.
* Der Pokal: das Symbol soll wirklich noch hoeher ueber dem Pokal sein, das macht den ganzen Pokal mit Symbol groesser, verschiebe ihn dazu etwas nach unten. In etwa wie in dem Bild, aber besser zentriert und text lesbar darunter.

-----

* Das Symbol beim Pokal kann ruhig noch leicht hoeher oben sein.
* Divisionssymbol ist zu hoch, Siehe screenshot @~/Downloads/Screen Shot 2026-07-10 at 09.33.43 division.png
* Entferne den Button "Zur Karte" am Ende des Pokalraums, man hat eh oben das Symbol.
* Bei "Fuer Eltern" , das flammensymbol gibt es nicht mehr. 
* Statt im Pokalraum "Noch 2 Sternebis zum naechsten Pokal" zu schreiben, schreib +2 in den naechsten Pokal den man bekommen kann, unter der Progressbar
* Der Pokal in der Spielende Ansicht ist etwas klein geraten, siehe Screenshot @~/Downloads/Screen Shot 2026-07-10 at 09.43.08 zu klein.png
* Im pokalraum im Einstellungsmenue gibt es kein Zuruecksetzen? Der dialog soll ueberall gleich sein, und den selben Code verwenden! vermeide Duplizierung!!
------

Design: Bei der Großansicht des Pokals soll es staendig Konfetti regnen, die Konfetti sollen aber verschwinden je weiter sie fallen (durchsichtig werden bis sie weg sind). Die blau umrandete Pokalplakette ist vor dem Konfetti und immer gut sichtbar.

Die buttons sind sehr inkonsistent: Es gibt rote buttons, hellbraune buttons mit Schatten, buttons ohne schatten, blaue Buttons, kleine Buttons mit dunkler runder Umrandung (z.B. Zuruecksetzen in den Einstellungen), Buttons mit Icons...
Erstelle ein einheitliches Konzept fuer mehr Koonsistenz. Diese Designentscheidungen sollen auf allen Seiten beruecksichtigt werden.

Die Bewegung des Fuchses zwischen den Levels ist nur linear, auf der Karte macht der Fuchs wirklich kleine Huepfer. Das soll konsistent sein.

-----

Zum Rechenberg, es gibt dazu ja schon einen PR #58. Ich möchte aber die Rechnungen komplett umgestalten, ich habe ein Übungsheft für meine 8 jährige Tochter bekommen und daraus möchte ich Ideen nehmen. Erstelle damit motivierende Aufgaben die wieder zum Pokale sammeln anregen. Ergebnis soll ein Umsetzungsplan sein dass das Opus model autonom abarbeiten kann. Entscheide selbst ob du den PR #58 dazu nutzen möchtest oder besser verwerfen. Achte besonders auf gutes balancing und auf motivierende Lerneffekt. Hier was im Übungsheft steht:

* Addition & Subtraktion: 27+60=?. 81+10=?, 12+40=?, 99-55=?, 88-22=?, 91-36=?, 26-0=?, 75-10=?, 100-14=?, 22+38=?, 11+19=?, 82-?=10, 33-?=8, 31-13=?, 85+13=?

* Addition, rechne schriftlich. Es gibt zwei verschi9edene Möglichkeiten (2 Beispiele wie man die Zahlen in mehrere Rechnungen aufteilt):
55+27=
---------
50+20=
 5+ 7=
 
Andere Aufteilung:
54+26=
---------
54+20=
64+ 6=

Das Kind muss das dann sebst aufteilen und ausrchnen, z.b. mit diesen Vorgaben:
16+39=
---------
  +  =
  +  =

oder
49+32=
---------
  +  =
  +  =

  
* Selbes mit Subtraktion, soll so aussehen:
35-26= 9
---------
35-20=15
15- 6= 9

Und dazu die zu befüllende Aufgaben:
54-26=
---------
  -  =
  -  =

oder
49-32=
---------
  -  =
  -  =


* Addition und Subtraktion mit Zehnerübergang: 54+9=?, 11+9=?, 73+8=?, 80-4=?, 50-1=?, 65-9=?, 35+6=?
  25+32=?, 64-41=?, 84-34=?, 73+17=?, 72-54=?
  
* Addition und Subtraktion, rechne aus. Das kind bekommt ein Quadrat und muss alle leeren Felder befüllen. z.b. 55+15=70, oder das freie Feld oben 73-62=11

  +|  |15|19|23
---+------------
 55|  |  |  |
 77|  |  |  |
 52|  |  |  |
 62|73|  |  |
 68|  |  |  |
 22|  |  |  |

Selbes mit subtraktion:
  -| 8|18|  |19
---+------------
 84|  |  |  |
 62|  |  |  |
 45|  |  |  |
 55|  |  |46|
 95|  |  |  |
 72|  |  |  |

* schreibe zur Malaufgabe die passende Plusaufgabe und löse:
 Malaufgabe: 3*6=?, Plusaufgabe: 6+6+6=18
 Malaufgabe: 2*7=?, Plusaufgabe: 7+7=14
 
* Multiplikation, rechne aus (ein rechteck wie oben):
  *| 2|  | 7| 2
---+------------
  9|  |  |  |
  8|  |  |  |
  4|  |  |  |
  5|  |20|  |
  3|  |  |  |
  0|  |  |  |

* Division: 8:2=?, 18:6=?, 20:4=?, ...

* Multiplikation und Division: 8:2=?, 28:7=?, 3*2=?, 9*5=?

* Division mit Rest: 49:5=? R ?, 77:8=? R ?, 54:7=? R ?

* Rechenmauern: das sind Pyramiden, mit 3 Reihen mit 1, 2, 3 Feldern, oben ist jeweils die Summe der 2 Felder darunter. Z.B. so:
   76
 29|?
18|? | ?

Dann kann man z.b. 29-18=11 rechnen und hat das Feld mitte unten. 76-29=47 2. Reihe rechts. Resultat sieht so aus:
   76
 29|47
18|11|36

Ganz schwer, hier  muss man so eine Rechenmauer selbst zusammensetzen. Vorgaben sind zahlen und eine leere Pyramide, eine Zahl bleibt über:
10, 16, 18, 34, 44, 62, 96


