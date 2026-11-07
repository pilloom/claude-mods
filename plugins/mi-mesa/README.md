# mi-mesa

Un panel con **tu mesa de trabajo** —los tickets abiertos agrupados por hilo—,
arriba **el post-it de `NOTAS.md`** y debajo **los últimos mensajes que le
pasaste a Claude Code**. Y un **sonido** cuando Claude acaba de contestar.

```
 NOTAS
× • Pedir las claves de staging a
    Marta antes del jueves
× • El deploy del viernes no va
 MI MESA · BACKEND_LANZADERA
12 tickets · 5 hilos · 1-9/22 · generada 2026-10-08          ▲ ▼

origen-lan-2501 (3) — hoy
▶ 🐞 LAN-2754 ALTA  La mesa no afirma dónde están los sin etiqueta
· ✅ LAN-2762 med   Revisar la simetría del contrato del latido
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

## Regenerar la mesa

El fichero lo escribe el guion de cada repositorio, y el panel pinta una **`↻`**
en la barra del título, pegada a su borde derecho, para correrlo sin salir de la
sesión:

```
 MI MESA · BACKEND_LANZADERA                        ↻
2 tickets · 2 hilos · generada 2026-10-29
```

Va ahí y no en la línea de la fecha —donde estuvo primero— porque dentro de la
barra sale **en negritas y sobre su fondo**, y se encuentra sin buscarlo; en la
línea de abajo quedaba en gris apagado entre dos cifras. El glifo lleva el fondo
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

Mientras corre, el aviso entra en la propia barra —` MI MESA · BACKEND_LANZADERA
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
claude plugin test .                # 56 tests
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
