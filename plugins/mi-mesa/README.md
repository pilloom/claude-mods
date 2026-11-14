# mi-mesa

Un panel con **tu mesa de trabajo** —los tickets abiertos agrupados por hilo y
**el marcador de la semana**, lo que se abre contra lo que se cierra, y al pie
**la carrera del Team**—, arriba **el post-it de `NOTAS.md`** y debajo **los
últimos mensajes que le pasaste a Claude Code**. Y un **sonido** cuando Claude
acaba de contestar.

```
 NOTAS
× • Pedir las claves de staging a
    Marta antes del jueves
× • El deploy del viernes no va
 MI MESA v1.7.1 · BACKEND_LANZADERA
12 tickets · 5 hilos · 1-5/22 · generada 2026-10-08          ▲ ▼
SEMANA MAR-LUN  + 64 ▏- 57 ▏▼7 ▏tú 18 · 2.º/9

origen-lan-2501 (3) — hoy
▶ 🐞 LAN-2754 ALTA  La mesa no afirma dónde están los sin etiqueta
· ✅ LAN-2762 med   Revisar la simetría del contrato del latido
────────────────────────────────────────────────────────────────
  21      18 (Tú)             11         7          3
  ▼       ▼                   ▼          ▼          ▼
🏁🐇──────🐢──────────────────🐢─────────🐢─────────🐢────────🚦
────────────────────────────────────────────────────────────────
Últimos mensajes (4)
12:31 una linea normal y el titulo de otro color
12:11 quiero agregar algo al mod, has de cuenta que se divide…
```

## Instalar

```
/plugin install mi-mesa --marketplace pilloom/claude-mods
```

## Qué necesita

Nada obligatorio salvo para la mesa: el post-it y el sonido se añaden solos
donde haya con qué.

Un `docs/MI-MESA.md` en la raíz del repositorio de la sesión, que es el fichero
que **genera** el guion de la mesa de cada repo (`scripts/qa/listar-mi-mesa.js`
en los de Node, `tool/listar_mi_mesa.dart` en los de Flutter). El mod no lo
escribe él: lo lee, y la **`↻`** del panel corre ese guion por ti. En un repo
que no lo tenga, el panel lo dice con el nombre del repo en lugar de salir en
blanco.

El panel se abre solo al empezar la sesión, y a mano con `/mi-mesa`.

## Cómo lee lo que lee

**La mesa** sale de `docs/MI-MESA.md` del **repositorio de la sesión**, no de uno
fijo: el título lleva el nombre de esa carpeta, así que en cada repo ves la tuya.
Se relee cada 15 segundos y solo si el fichero cambió de fecha de modificación,
porque el generador lo reescribe entero.

Las claves de ticket se leen con el prefijo que traigan (`LAN-`, `REN-`, …) y no
con uno fijo. La primera versión pedía `LAN-\d+`, y en un repo con claves `REN-`
no casaba ninguna línea: el panel salía **en blanco teniendo la mesa delante**,
bien generada. Un panel vacío no distingue «no hay nada» de «no entendí nada».

**De qué es cada ticket** lo dice el emoji entre la marca de estado y la clave
—`🐞` error, `✅` tarea o subtarea, `📖` historia, `❔` un tipo que el guion no
conoce—, y lo escribe la **mesa**, no el mod: el panel pinta el emoji que venga,
sin tabla propia. Así un tipo nuevo en Jira no obliga a tocar el mod, y lo que
no puede pasar —que una línea con un emoji desconocido deje de entenderse y el
ticket **desaparezca** del panel— no pasa.

La columna es **opcional** y se lee igual sin ella, porque los guiones
generadores viven en cada repositorio y se portan de uno en uno: la mesa que
todavía no la escribe se pinta como siempre, sin hueco.

**Los mensajes** salen de `~/.claude/history.jsonl`, que es donde Claude Code
apunta lo que escribes en el prompt, filtrado por el repositorio de la sesión.
Se lee de ahí y no de los mensajes de la conversación porque un `/clear` vacía
la conversación y **no** el historial: el panel sigue enseñando lo último que
pasaste aunque acabes de limpiar el contexto. Lo que escribes aparece al
instante y además se confirma contra el historial en el ciclo de 15 s.

Dos cosas que **no** entran: las barras (`/clear`, `/continuar`), que son órdenes
al host y no mensajes, y los mensajes de otros repos. El filtro por repositorio
es **exacto, no por prefijo**: `backend_lanzadera` es prefijo de
`backend_lanzadera_driver`, y filtrar por prefijo mezclaría dos de los repos.

## El marcador de la semana

Una fila debajo de la cuenta con **lo que entra contra lo que sale**:

```
12 tickets · 5 hilos · 1-9/22 · generada 2026-11-07          ▲ ▼
SEMANA MAR-LUN  + 64 ▏- 57 ▏▼7 ▏tú 18 · 2.º/9
```

Contesta de un vistazo lo único que mueve a cerrar —si se cierra más de lo que
se abre— sin abrir Jira.

**Un `+` lo que entra y un `-` lo que se termina**, no las palabras: dos glifos
de una columna que se leen sin leerlos, y son **el mismo par**, así que el ojo
los empareja sin que nada se lo explique. El guion es el de teclado y no el menos
tipográfico `−`: es el par exacto del `+` y está en todas las monoespaciadas,
mientras que el `−` se pinta como un cuadrito en las que no lo traen.

El neto es una **flecha con su color**: `▲16` verde cuando se cierra más de lo
que entra, `▼7` rojo cuando no. Flecha y no el signo del neto porque los dos
signos ya están ocupados a su izquierda: un `−7` detrás de un `+ 64 ▏- 57` es el
tercer signo de la fila.

🔴 **Las subtareas no se pintan**, aunque la mesa las cuente. Siguen fuera de las
dos cifras que se comparan —contarlas premia a quien desglosa— y quedan en el
fichero, en `subtareas`, para quien lo abra. En la fila eran un tercer número que
había que explicar cada vez, y la fila existe para no tener que explicar nada.

⚠️ **Y la palomita que se pediría primero, `✔️`, no sirve.** Son **dos**
caracteres —`✔` más un selector de variación invisible— y el selector no cambia
la tabla de anchos: solo le pide al terminal que lo pinte como emoji de color.
Así que el recorte dice 1 columna, el motor que monta la fila dice 1 y el
terminal pinta **2**. Esa columna de desacuerdo no se arregla desde el mod,
porque quien rellena y recorta la fila es el motor. El `✓` no tiene el problema
—los tres cuentan 1— y el `✅` tampoco —la tabla lo marca ancho y los tres
cuentan 2—, pero ese choca con el emoji de tipo que la mesa ya pinta en las
líneas de ticket.

Es **flujo, no existencias**: `abren` son los tickets *creados* en el tramo y
`cierran` los *cerrados* en ese mismo tramo. No son los 12 que hay encima de la
mesa —esa es la línea de arriba—, que es la confusión natural y la que haría
inútil el marcador: contra una existencia no se sabe si vas ganando.

**Las subtareas no entran en la cuenta que compara**, van a su lado como
`+31 subt.`. Sin esa resta el marcador premia a quien desglosa: en LAN, 9 de
cada 10 cierres recientes son subtareas de una misma persona, y un tablero que
se ve enseña rápido a partir el trabajo en nueve trozos. No se esconden —cerrar
una subtarea es trabajo— pero no compiten con un error cerrado.

Las cifras son del **Team entero y sin nombres**. Lo tuyo sale aparte y tu sitio
como un número, `tú 18 · 2.º/9`: la comparación motiva y la lista de quién va
último señala, y para subir no hace falta saber quién está debajo.

⚠️ «Quién lo cerró» es el **asignado al cerrarse**, que es lo único que Jira
guarda: no hay campo de quién resolvió. Si alguien cierra un ticket tuyo te lo
cuenta a ti, y si te lo reasignan el último día se lo lleva el último. Es un
proxy bueno, pero es un proxy.

### Lo que el guion tiene que escribir

El panel **no habla con Jira**: lee ficheros. Las cifras las escribe el guion
generador de cada repositorio en una sección `## Pulso` de `docs/MI-MESA.md`,
con un `clave: valor` por línea:

````markdown
## Pulso de la semana

```
tramo: MAR-LUN
abren: 62
cierran: 57
subtareas: 31
tuyos: 18
puesto: 2
personas: 9
```
````

Solo `abren` y `cierran` son obligatorias, y **la mesa que no traiga la sección
se pinta como siempre, sin hueco**: es la regla de todas las columnas que se han
ido portando de un repositorio a otro, porque los guiones viven en cada repo y
se tocan de uno en uno. Media cifra tampoco es un marcador: un «cierran 57»
solo no contesta la pregunta, así que sin las dos no se pinta la fila.

Las cifras se leen **solo dentro de esa sección**, que acaba donde empieza la
siguiente `##`. Leyendo por clave en todo el fichero, cualquier `tuyos: 3` de la
prosa se convertiría en un dato del marcador. Y una cifra imposible —un
`abren: -3`, un `puesto: 0`— se descarta en vez de pintarse: un marcador que
enseña un dato que no puede ser se cree igual.

### La semana va de martes a lunes

Porque **el lunes es el día de las revisiones**: lo que se cierra ese día es la
cosecha de la semana que acaba, no el arranque de la siguiente. Con el corte en
lunes —o en domingo— esos cierres se le apuntaban a la semana nueva y las dos
salían mal: la que acababa parecía floja y la que empezaba, disparada.

El `tramo` lo escribe el guion y el panel lo pinta tal cual, sin calendario
propio: un jueves es `MAR-JUE` y la semana acabada es `MAR-LUN`. Quien sabe por
dónde va es quien consultó Jira — **y por eso cambiar el día en que abre la
semana no toca el mod**, solo el guion de cada repositorio. Va en tres letras y
no en una porque en estas mesas el miércoles es `X` justamente porque `M` ya es
martes: `MAR-JUE` no se puede leer de dos maneras.

⚠️ Lo que el guion **no** debe usar es el `startOfWeek()` de Jira. El primer día
de la semana es un **ajuste de la instancia**, no una constante —y ninguna
instancia abre la semana en martes—; valía ya cuando el corte coincidía con uno
posible, porque el día que alguien lo mueva el marcador cuenta otro tramo y nada
lo delata. Se comprobó, y el experimento salió **empatado**: `startOfWeek()` y la
fecha escrita dieron las dos 64 porque ese domingo se crearon 0 tickets, que es
justo la clase de empate que esconde el fallo hasta el primer fin de semana con
trabajo. El guion calcula el día que abre y pasa la fecha:

```
created >= "2026-11-03"
```

### Las dos líneas de cifras van en negritas

La de la cuenta y la del marcador, las dos. Con una en gris apagado y la otra en
color no se leían como el par que son: son lo que se mira de un vistazo debajo
del título, y lo que distingue una cifra de otra es **el color, no el peso** —
ámbar el `+` de lo que entra, verde el `-` de lo que se termina, la flecha del
neto del color de su sentido, y lo tuyo sin color, que es lo único de la línea
que habla de ti—.

El rótulo y los separadores van en negritas y **sin color**, que es lo que los
deja detrás de las cifras sin apagarlos: `bold` y `dimColor` se pelean —uno baja
la intensidad y el otro la sube— y cada terminal resuelve ese par a su manera,
así que en el panel **no se usan juntos en ninguna parte**. Por eso la flecha que
no puede moverse **pierde las negritas** en lugar de ganar un apagado: dice lo
mismo quitando peso.

### Lo que le cuesta a la mesa

Una fila, y la mesa la paga: el reparto la cuenta en la cabecera de la sección,
así que la ventana pasa de `1-10/17` a `1-9/17`. Contarla de menos corría la
ventana y la última línea se perdía por debajo del corte sin que nada lo dijera.

En un panel estrecho lo que no cabe se cae **por la derecha y por grupos
enteros** —las dos cifras que se comparan, el neto que resume, lo tuyo—, que es
lo que deja la línea sin un `▏` colgando apuntando a un dato que no está. Donde
no cabe ni la primera cifra no se pinta la fila: ocuparía una fila de la mesa
para no decir nada.

El `✅` se mide como **dos columnas**, que es lo que ocupa en el terminal aunque
para JavaScript sea un carácter. Midiendo por caracteres la fila se pasa de
ancho justo en el panel acoplado, y una fila que envuelve descuadra la ventana
de la mesa entera, que reparte filas contando una por ticket: es el mismo fallo
que ya costó la columna del tipo.

## La carrera de la semana

Al pie de la mesa, justo encima de los mensajes, **los cierres de cada persona
del Team como una carrera**: una sola pista, un animal por persona, y encima de
cada uno su flecha y su cifra.

```
────────────────────────────────────────────────────────────────
  21   19 18 (Tú)             11         7×2        3
  ▼    ▼  ▼                   ▼          ▼          ▼
🏁🐇───🐢─🐢──────────────────🐢─────────🐢─────────🐢────────🚦
```

Cuenta **lo mismo que el marcador**: el mismo tramo de martes a lunes, sin
subtareas y por asignado al cerrarse. Cada animal va a la distancia de la meta
que le toca **en proporción al líder**, que llega a ella. La liebre es del
líder —y de todos los que empaten en cabeza—; el resto, tortugas.

🔑 **Sin nombres, salvo el tuyo.** Es la misma decisión que el marcador: la
comparación motiva y la lista de quién va último señala. Ves a cuánto estás del
líder y cuántos llevas detrás sin que la pista diga quién es nadie. Y no es que
el panel los esconda: **el guion ni los escribe**, así que no están en el
fichero.

🔑 **La pista va al revés —meta a la izquierda, salida a la derecha— por los
emojis.** 🐇 y 🐢 miran a la izquierda en la fuente de emojis de macOS, y un
terminal no puede voltear un glifo: así corren hacia donde miran. 🏁 marca la
meta y 🚦 la salida.

**Tú vas siempre donde te toca**, y quien te pisa se aparta:

- Los que van **detrás** de ti, y los que **empatan contigo** —como el empate
  con la banca—, retroceden hacia la salida hasta que su cifra deja de pisar la
  tuya.
- Los que van **delante** se apartan hacia la meta: retrocederlos los pondría
  detrás de ti con más cierres, y la carrera mentiría.
- Los demás que empatan entre sí son **una sola tortuga**, con `7×2`.
- Pegada a la salida, tu etiqueta crece hacia la meta y se lee `(Tú) 0`, para
  que la flecha siga cayendo debajo de la cifra.
- Si alguien no cabe al apartarse, pierde su cifra antes que pisar la tuya.

Ocupa **cuatro filas** —la raya que la separa de la mesa, como la de los
mensajes, y sus tres— y las paga la mesa, no los mensajes. Se queda **fija al
fondo** mientras la ventana se desplaza: es el pie de la mesa, no una fila más.
**La mesa manda**: si no le quedan tres filas de tickets, la carrera no se pinta
—entera, nunca a medias—, y tampoco en un panel tan estrecho que la pista no
mida 20 columnas. Los emojis se cuentan a dos columnas, y ninguna fila pasa de
`ancho - 1`.

### Lo que el guion tiene que escribir

Una línea más en la sección `## Pulso`: **una cifra por persona**, la tuya
incluida, en cualquier orden.

```
tuyos: 18
carrera: 21 18 11 7 3
```

Sin `carrera` o sin `tuyos` no hay carrera, y la mesa se pinta como antes, sin
hueco. Si no cerraste nada y el guion no te puso, el panel te añade con `0`: lo
tuyo ya lo dice `tuyos`. Una línea con algo que no sea un número —un nombre— no
se lee.

## Regenerar la mesa

El fichero lo escribe el guion de cada repositorio, y el panel pinta una **`↻`**
en la barra del título, pegada a su borde derecho, para correrlo sin salir de la
sesión:

```
 MI MESA v1.7.1 · BACKEND_LANZADERA                 ↻
2 tickets · 2 hilos · generada 2026-10-29
```

Va ahí y no en la línea de la fecha —donde estuvo primero— porque dentro de la
barra sale **en negritas y sobre su fondo**, y se encuentra sin buscarlo; en la
línea de abajo quedaba en gris apagado entre dos cifras —esa línea va **en
negritas desde la 1.6.0**, pero el motivo de la barra no era solo el contraste:
dentro de ella el glifo es parte del título—. El glifo lleva el fondo
de la barra porque va como hijo `Text` del botón y no como su `label`: un
`Button` no tiene `inverse` ni `color` propios. Y va `plain`, sin los corchetes
que el terminal le dibuja por su cuenta, que dentro de la barra se ven como un
botón pegado encima del título en vez de parte de él.

Antes de ejecutar nada **pregunta**, con el comando entero delante:

```
¿Regenerar la mesa con «node scripts/qa/listar-mi-mesa.js»?
  Regenerar · Dejarlo
```

Solo «Regenerar» corre el guion; «Dejarlo», el texto libre del *Other* y el
escape dejan todo como estaba. Y en un `-p`, donde no hay nadie a quien
preguntar, no corre: eso es lo que se quiere antes de ejecutar algo que nadie va
a ver.

Mientras corre, el aviso entra en la propia barra —` MI MESA v1.7.1 · BACKEND_LANZADERA
· REGENERANDO… `— y se queda con el sitio del botón: un control que se deja
pulsar y no hace nada se pulsa tres veces. Al acabar, la mesa se relee en el
momento. Si el guion falla, su primera línea de error sale debajo en
rojo y la mesa de antes se queda puesta: lo que falló es la generación, no la
lectura.

**El guion no hay que configurarlo**: el fichero generado se autodeclara en su
cabecera —«🤖 **Generado** por `scripts/qa/listar-mi-mesa.js` el …»—, y de ahí
sale. Tres fuentes, en este orden:

1. Lo que se haya puesto en `/config` (**Guion que regenera la mesa**), para el
   repositorio que lo tenga en otro sitio.
2. La cabecera de `docs/MI-MESA.md`, que es lo normal.
3. La convención: `scripts/qa/listar-mi-mesa.js` o `tool/listar_mi_mesa.dart`.
   Es lo que hace que el botón salga **antes de la primera generación**, que es
   cuando no hay cabecera que leer y cuando más falta hace.

La primera que exista en disco es la que queda. Si no hay ninguna, **no hay
botón**: en un repositorio sin guion, un control que no puede hacer nada sobra.

### Lo que el botón no ejecuta

La ruta sale de un fichero **versionado**, así que quien pueda commitear
`docs/MI-MESA.md` elegiría lo que corre al pulsar. Por eso no se ejecuta lo que
diga la cabecera, sino lo que pasa un filtro cerrado (`comandoDe`):

- `argv` y **nunca** `sh -c`: no hay shell que interprete nada.
- El **intérprete lo pone la extensión**, no el fichero: `.js` → `node`,
  `.dart` → `dart run`. Un `.sh`, un `.py` o algo sin extensión no se ejecutan.
- Ruta **relativa**, sin `..` y sin caracteres raros: una absoluta apunta a
  cualquier sitio de la máquina.
- Tiene que **existir** en disco, y se corre con `cwd` en la raíz del repo y un
  minuto de tope.

Lo peor que puede pasar al pulsar es que corra un guion del propio repositorio,
que es el que ya se corre a mano —y antes de eso hay que decir que sí—.

## El post-it

**Las notas** salen de un `NOTAS.md` en la **raíz** del repositorio, no en
`docs/`: es lo que tienes encima de la mesa en ese repositorio y se quiere ver
al entrar, sin bajar a ninguna carpeta. Se relee con el mismo trato que la
mesa, cada 15 s y solo si cambió la fecha.

**El post-it es tuyo y no se sube.** Son las notas de una persona —como la
mesa—, y lo que alguien apunta para sí mismo no tiene por qué viajar en una
rama ni salir en un PR. El mod lo protege solo: al leerlo apunta `/NOTAS.md` en
**`.git/info/exclude`**, los ignores del clon de quien lo usa. Ahí y no en el
`.gitignore` del repositorio, que es un fichero del equipo y no hace falta
meterle una línea a todo el mundo para esto; un `.gitignore` que ya lo ignore
se respeta y no se duplica. En un worktree, un submódulo o una carpeta que no
es un clon, simplemente no se apunta nada y el post-it sigue funcionando.

⚠️ `exclude` **no desversiona** lo ya versionado: en un repositorio donde
alguien commiteó `NOTAS.md` antes, el fichero sigue dentro y sus recordatorios
salen en el siguiente PR. De ahí solo se sale a mano, así que el rótulo lo dice
con la orden escrita —` NOTAS · SE SUBE A GIT: git rm --cached NOTAS.md `—
hasta que se haga.

La sección **solo existe cuando hay notas**: sin fichero, o con un fichero que
no deja ninguna línea útil, no se pinta ni el rótulo y el panel sale como
siempre. No hay formato que cumplir —no es la mesa—: se quitan las cabeceras,
las rayas y las citas, las viñetas se unifican en una sola y las líneas en
blanco se tiran.

**La nota se lee entera.** Una que no cabe en el ancho del panel se envuelve en
las filas que necesite, cortando por los espacios y sangrando las siguientes
bajo el texto, no bajo la viñeta —así se ve dónde empieza una y dónde sigue la
de arriba—. Una palabra más larga que la fila (un enlace, una ruta) se parte por
donde toque. Antes se recortaba a una fila con un `…`, y una nota de dos
renglones —que es la nota normal— había que ir a leerla al fichero, que es justo
lo que el panel ahorra.

Caben **cinco notas**, y como mucho **media altura del cuerpo**: con notas
largas el post-it se para ahí para no quedarse con el panel. La que no entra
entera no se pinta a medias; el rótulo dice cuántas quedan (` NOTAS · +2 `) y el
fichero se abre para verlas. Una nota sola más larga que ese tope se pinta
igual: dejar el post-it en blanco teniendo algo escrito es peor.

Es **un** post-it, no un tablero: la idea es la nota de encima de la mesa, lo
que no quieres que se te pase esta semana. Para más de eso está la mesa.

## Poner y quitar notas

Por tres sitios: pidiéndoselo al modelo, tecleando `/nota`, o con la equis del
propio panel. Los tres pasan por el mismo código y escriben el mismo formato.

Pidiéndolo, en cualquier repositorio y sin saberse nada:

```
> crea una nota en mi mesa: el deploy del viernes no va
> quita la nota del deploy
```

El mod registra una herramienta (`mcp__mi-mesa__nota`) que el modelo alcanza con
eso. Va **no diferida** a propósito: diferida, el modelo solo ve el nombre y
tiene que pedir el esquema, y lo que se quiere es que la coja sin pensarlo. El
esquema en el prompt cuesta unos cien tokens por sesión; que no acierte cuesta
que alguien edite a mano `docs/MI-MESA.md`, que es generado y se reescribe.

Su descripción se lo dice al modelo con todas las letras: las notas van en
`NOTAS.md`, no se edita con Write ni con Edit, y `docs/MI-MESA.md` no se toca.
Por eso **no hay que documentarle nada al equipo ni añadir líneas a ningún
`CLAUDE.md`**: instalan el mod y la herramienta se explica sola.

**Con el ratón**, cuando la nota ya no hace falta: cada una lleva su **`×`**
delante. Al pulsarla se quita del fichero y del panel en el momento. Está
apagada mientras no la apuntes y se enciende en rojo al pasar por encima de la
nota —de la nota entera, no del glifo, que en un terminal es un blanco de un
carácter—.

La equis quita **la nota que señala**, por su sitio y no por su texto, así que
dos notas iguales se distinguen sin problema; `quitar` por texto se sigue
negando con dos candidatas, que ahí sí hay duda. Y si el fichero cambió desde
que se pintó el panel —a mano, desde otra sesión—, la equis **no quita nada**:
se relee y se enseña lo que hay, en vez de borrar la de al lado por un
redibujado tarde.

⚠️ Se quita **en un clic, sin preguntar**, y `NOTAS.md` no guarda historia. Es
una nota de una línea y preguntar por cada una cansa más de lo que salva, pero
conviene saberlo.

Tecleando, cuando no quieres gastar un turno del modelo en tres palabras:

```
/nota el deploy del viernes no va      # la añade
/nota --quitar deploy                  # la quita
/nota                                  # lista las que hay
```

Las entradas pasan por el mismo código y escriben el mismo formato, así que no
acaban siendo dos post-its distintos según por dónde entres. Y todas relean el
fichero al escribir: el panel se entera en el momento, sin esperar el ciclo de
15 s.

**Quitar exige que no haya duda.** Se busca sin tildes ni mayúsculas, como se
busca a mano, y si el texto casa con dos notas —o con ninguna— no se toca el
fichero: se dice con cuáles casó. Borrar la nota equivocada es peor que no
borrar ninguna, y acertando a medias no hay manera de saber cuál era.

Añadir **no reescribe** el fichero: `NOTAS.md` lo escribes tú y puede tener lo
que quieras dentro, así que lo único que se toca es el final.

## El sonido

Al acabar un turno suena un clip corto (`sounds/listo.wav`, un fichero del
propio mod). Suena **solo al contestar**: una interrupción, un error de la API o
un rechazo callan, porque el aviso es de «ya está» y no de «pasó algo». Y solo
en el bucle principal: un turno que levanta cinco subagentes termina seis veces,
y sin filtrar por `agentId` sonaría seis.

⚠️ `$.audio.play` toca el clip con `afplay`, así que **suena en macOS**; en un
terminal de Linux o de Windows el motor no tiene reproductor y no suena nada
—sin fallar—. El clip se lanza sin esperarlo y con el fallo tragado: ni retrasa
ni rompe la respuesta.

Se apaga desde `/config`, en la fila **Sonido al acabar el turno** del mod, que
es lo que una máquina compartida o una videollamada quieren callar sin
desinstalar nada.

## El reparto de la pantalla

El post-it se queda las filas que necesite —las que ocupen las notas ya
envueltas al ancho menos la equis, más la del rótulo, y como mucho media altura
del cuerpo— y lo que
sobra se reparte **tres cuartos para la mesa y uno para los mensajes**.
Sin notas no ocupa nada. El alto lo da
`e.props.scroll.bodyRows`, que es el del cuerpo del propio panel; el del
viewport es el de la pantalla entera y además no redibuja al cambiar, así que no
sirve para partir. Por debajo de 12 filas de cuerpo —o en una superficie que no
mande esas props— **no parte**: las dos secciones van seguidas y la de abajo no
desaparece.

El ancho de la barra del título y de la línea divisoria es `bodyColumns`, no el
del viewport: con el panel acoplado al lado del transcript el viewport mide más
y la línea se pasaba de ancho y envolvía.

### La mesa que no cabe se desplaza

Lo que la mesa no puede enseñar de una vez **ya no se queda fuera**: la sección
de tickets es una **ventana** sobre la lista, y se mueve con la **rueda** del
ratón apuntando al panel, con las **flechas** del teclado cuando el panel lo
tiene (`ctrl+x tab`) y con las dos flechas **▲ ▼** que salen en la línea de la
cuenta, pegadas a su borde derecho como la `↻` del título —la línea se rellena
hasta el borde, que si no las flechas bailan de sitio cada vez que cambia el
número de tickets o la fecha—, y que mueven una ventana menos una fila —la última que leíste sigue ahí
arriba después del salto—. La línea de la cuenta dice por dónde va, un
`12-24/31`, y va antes de la fecha: en un panel acoplado la línea se recorta por
la derecha, y de las dos cosas la que se mira es esta. La mesa que cabe entera
no gana ni flechas ni indicador.

La ventana es **del mod y no del motor**: la sección se dibuja con
`overflow: hidden`, así que el motor nunca ve un árbol más alto que el cuerpo
del panel y no tiene nada que desplazar. El mod engancha `ui.scroll` del panel,
mueve su propia ventana y contesta `{}` sin llamar a `next`, de modo que el
cuerpo del panel se queda quieto y el post-it y los mensajes **no se van de la
pantalla** al bajar por la mesa. Para cortar por filas, la mesa se aplana a una
fila por línea —el rótulo de cada hilo, sus tickets y una fila en blanco entre
hilos— en lugar de una caja por hilo: con cajas, un hilo largo o entraba entero
o no entraba.

Una mesa recién regenerada vuelve arriba; el ciclo de 15 s, que relee sin que el
fichero haya cambiado, no toca la ventana.

## Colores

El rótulo del post-it va **negro sobre amarillo**, con los dos colores dichos y
no con `inverse`: `inverse` pinta el texto del color del **fondo** del tema, que
en un tema claro es blanco, y blanco sobre amarillo no se lee. Negro sobre
amarillo es el contraste del post-it de verdad, y el mismo en los dos temas.

Las notas van en negritas y en **`warning`**, que es el ámbar del tema de quien
lo usa y no un hex clavado en el código: así contrasta con el gris del fondo del
panel en tema claro y en oscuro, mientras un hex fijo se apagaría en uno de los
dos. `yellow` a secas salía deslavado sobre ese gris.

El título de la mesa va con `inverse` sobre `cyan`; la línea y el rótulo de
abajo van en **negro**, que es lo que contrasta en un tema claro. **En un tema oscuro
las dos se verían apagadas**: están en un solo sitio cada una, al final de
`hooks/register.tsx`, y se cambian por el color del tema que prefieras.

## Desarrollo

```bash
claude plugin validate .            # manifiesto y módulo, como los lee el motor
claude plugin test .                # 90 tests
```

Para los tipos hace falta que el motor haya cargado el mod alguna vez desde su
carpeta: entonces escribe `.claude-plugin/types/` (gitignorado, es la API de esa
build) y el `tsconfig.json` de aquí lo extiende.

```bash
CLAUDE_CODE_PLUGIN_DIRS=/ruta/a/plugins/mi-mesa claude   # cargarlo desde disco
pnpm exec tsc -p .                                       # una vez haya tipos
```

El `tsconfig.json` de aquí **deja fuera `claude-code-mcp`**, que es uno de los
tres d.ts que escribe el motor: el de los esquemas de todas las herramientas MCP
que hubiera conectadas al guardar el mod. En una máquina con varios servidores
—trescientas y pico herramientas— la unión de `tool.call` se come el tope de
instanciaciones de `tsc`, y lo que sale es un **`TS2589`** en el primer
`$.tool.call` del programa, que no habla de nada de esto y se mueve de fichero
según cuántos servidores hubiera esa vez. Con él fuera, el chequeo baja de
**10,3 M de instanciaciones a 0,3 M** y no se pierde nada: la herramienta del
propio mod la declara `types/index.d.ts` ampliando `McpToolInputs` —por eso está
ahí— y el mod no llama a las de otros servidores.

En una sesión interactiva la carpeta se vigila: al guardar, el módulo se recarga
—`register` corre otra vez y los temporizadores del anterior se tiran—. Lo que
vive en `$.state` lo guarda el host y **sobrevive** a la recarga; las variables
del módulo empiezan de cero.
