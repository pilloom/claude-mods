# Changelog

## [1.3.0] — 2026-10-29

### Una `↻` para regenerar la mesa

- El panel pinta un botón en la barra del título, pegado a su borde derecho,
  que corre el guion de la mesa de ese repositorio y la relee al momento. Va
  ahí y no en la línea de la fecha —donde estuvo primero— porque dentro de la
  barra sale en negritas y sobre su fondo, y se encuentra sin buscarlo; abajo
  quedaba en gris apagado entre dos cifras. El glifo va como hijo `Text` del
  botón y no como su `label`, que es la única manera de que lleve el fondo de
  la barra en vez de abrir un hueco del color del panel, y va `plain`, sin los
  corchetes que el terminal le dibuja por su cuenta. Mientras corre, el aviso
  entra en la propia barra y se queda con el sitio del botón: dos clics no
  lanzan dos guiones.
  Un guion que falla deja su primera línea de error debajo, en rojo, y la mesa
  de antes puesta: lo que falló es la generación, no la lectura.
- **No hay que configurar el comando.** El fichero generado se autodeclara en
  su cabecera y `parseMesa` ya leía esa línea para sacar la fecha; ahora saca
  también el guion. Antes de la primera generación no hay cabecera que leer
  —que es justo cuando más falta hace el botón—, así que se prueba la
  convención de la casa: `scripts/qa/listar-mi-mesa.js` y
  `tool/listar_mi_mesa.dart`. Y `/config` lleva un **Guion que regenera la
  mesa** para el repositorio que lo tenga en otro sitio. Sin ninguno de los
  tres no se pinta el botón: un control que no puede hacer nada sobra.
- **Pregunta antes de correr**, con el comando entero delante
  (`¿Regenerar la mesa con «node scripts/qa/listar-mi-mesa.js»?`). Solo la
  opción de regenerar cuenta como un sí: «Dejarlo», el texto libre del *Other*
  y el escape dejan todo como estaba, y en un `-p` —donde no hay a quién
  preguntar— no corre nada. Las tres fases van en un campo y no en dos
  banderas, así que no existe el estado de estar preguntando y corriendo a la
  vez.
- La ruta sale de un fichero **versionado**, así que no se ejecuta lo que diga
  la cabecera sino lo que pasa un filtro cerrado: `argv` y nunca `sh -c`, el
  intérprete puesto por la extensión y no por el fichero (`.js` → `node`,
  `.dart` → `dart run`; un `.sh` o un `.py` no), ruta relativa sin `..` ni
  caracteres raros, que exista en disco, `cwd` en la raíz y un minuto de tope.
  Lo peor que puede pasar al pulsar es que corra un guion del repositorio, que
  es el que ya se corre a mano, y antes de eso hay que decir que sí.

### Lo demás

- El `tsconfig.json` deja fuera `claude-code-mcp`, el d.ts con los esquemas de
  todas las herramientas MCP conectadas al guardar el mod. En una máquina con
  varios servidores la unión de `tool.call` se comía el tope de instanciaciones
  de `tsc`: salía un `TS2589` en el primer `$.tool.call` del programa —un error
  que no habla de nada de esto y que se movía de fichero según cuántos
  servidores hubiera esa vez—. El chequeo baja de 10,3 M de instanciaciones a
  0,3 M, y la herramienta del propio mod sigue tipada por la ampliación de
  `McpToolInputs` de `types/index.d.ts`.

## [1.2.1] — 2026-10-25

### Una equis para quitar la nota

- Cada nota del post-it lleva su `×` delante, y al pulsarla se quita del
  fichero y del panel. Apagada en reposo y en rojo al pasar por encima de la
  nota entera, que es el ámbito del hover: el glifo solo es un blanco de un
  carácter en un terminal.
- Quita **por el sitio y no por el texto** (`quitarNotaN`): la equis señala
  una nota con el dedo y no hay duda que resolver, así que dos notas iguales
  —que `quitar` por texto se niega a tocar, y con razón— se distinguen sin
  problema. Lleva además el texto que el panel tenía pintado, y si el fichero
  cambió por debajo desde el último redibujado no se quita nada: se relee y se
  enseña lo que hay, en vez de borrar la de al lado.
- Se quita en un clic y sin preguntar, y el fichero no guarda historia. Es una
  nota de una línea; preguntar por cada una cansa más de lo que salva.

### La nota se lee entera

- Una nota más ancha que el panel se recortaba a una fila con un `…`, y había
  que abrir `NOTAS.md` para leer lo que uno mismo había dictado, que es justo
  lo que el post-it viene a ahorrar. Ahora se envuelve en las filas que
  necesite, cortando por los espacios y sangrando las siguientes bajo el texto
  y no bajo la viñeta; una palabra más larga que la fila se parte por donde
  toque. La mesa sigue recortando, que ahí sí es lo que se quiere.
- La viñeta sale del texto y pasa a ser el margen de la primera fila: dentro,
  el espacio que lleva detrás era el último hueco de la fila para una nota que
  empieza por un enlace, y la primera fila salía con la viñeta sola.
- El post-it no se queda con el panel: además de las cinco notas de siempre,
  no pasa de media altura del cuerpo. La nota que no entra entera no se pinta
  a medias, se cuenta en el rótulo. Una nota sola más larga que ese tope se
  pinta igual, porque dejarlo en blanco teniendo algo escrito es peor.

### La herramienta escribía bien y contestaba error

- El hook de `tool.call` devolvía `{ result: { content: [{ type: 'text', … }] } }`,
  y una herramienta registrada por un mod no declara esquema de salida: el que
  el núcleo le pone admite `string`, lista de bloques o nada. La nota se
  escribía entera y la llamada contestaba `invalid_union`, que es el peor
  resultado posible aquí —quien lee el error da por hecho que no se guardó,
  repite la llamada y acaba con la nota duplicada—. Las tres acciones estaban
  igual, así que `listar` tampoco servía para comprobar el estado y había que
  abrir el fichero a mano, que es justo lo que la herramienta viene a evitar.
  Ahora el `result` es la frase pelada.
- El test leía `result.content[0].text`, la forma que el motor rechaza, y
  pasaba: el banco de pruebas no valida el esquema de salida. Ahora exige que
  el resultado sea una cadena, que es lo que sujeta la forma.

### El post-it es de quien lo escribe, y deja de subirse

- Cambia la decisión de 1.1.0: `NOTAS.md` **no** lo versiona el repositorio.
  Son las notas de una persona, como la mesa, y lo que alguien apunta para sí
  mismo no viaja en una rama ni sale en un PR. Antes quedaba como fichero sin
  seguir en la raíz, y un `git add -A` se lo llevaba dentro sin que se notara.
- El mod lo apunta solo: al leer el post-it escribe `/NOTAS.md` en
  `.git/info/exclude`, los ignores del clon. Ahí y no en el `.gitignore`, que
  es del equipo y no tiene por qué llevar una línea de esto; un `.gitignore`
  que ya lo ignore se respeta y no se duplica, y sin `.git/info` —un worktree,
  un submódulo, una carpeta que no es un clon— no se apunta nada y el post-it
  sigue igual.
- `exclude` no desversiona lo ya versionado, así que un repositorio donde
  alguien lo commiteó antes sigue publicando esas notas. Eso se avisa donde se
  ve: el rótulo pasa a ` NOTAS · SE SUBE A GIT: git rm --cached NOTAS.md ` y lo
  dice hasta que se haga. Las dos comprobaciones de git cuelgan de la relectura
  y no del ciclo: solo corren cuando el post-it cambia.
- El `mtime` de los mocks pasa a ser de cada fichero y no un contador
  compartido: con uno solo, escribir en los ignores del clon haría releer el
  post-it, que en el disco de verdad no pasa. De 30 a 34 tests.

## [1.2.0] — 2026-10-24

### Poner y quitar notas sin saberse nada

- Una herramienta registrada (`mcp__mi-mesa__nota`) con las tres operaciones:
  añadir, quitar y listar. Con eso «crea una nota en mi mesa» funciona en
  cualquier repositorio del equipo, sin documentar un formato ni añadir líneas
  a ningún `CLAUDE.md`: la descripción de la herramienta se explica sola, y
  dice además que `docs/MI-MESA.md` no se toca porque es generado.
- Va **no diferida**: diferida, el modelo solo ve el nombre y tiene que pedir
  el esquema, y lo que se quiere es que la alcance sin pensarlo.
- Comando `/nota <texto>`, `/nota --quitar <texto>` y `/nota` a secas, que
  lista. Determinista y sin gastar un turno del modelo en tres palabras.
- Las dos entradas pasan por la misma función, así que escriben el mismo
  formato, y las dos relean al escribir: la nota sale en el panel al momento.
- Quitar exige que no haya duda: se busca sin tildes ni mayúsculas, y con cero
  o con varias candidatas no se toca el fichero y se dice con cuáles casó.
  Borrar la nota equivocada es peor que no borrar ninguna.
- Añadir no reescribe: `NOTAS.md` lo escribe una persona y puede tener lo que
  quiera dentro, así que solo se toca el final. Un fichero que no existe nace
  con su cabecera, y la viñeta no se duplica cuando quien dicta la nota repite
  la `•` que está viendo en el panel.
- La herramienta se declara en el contrato del mod (`McpToolInputs`): los tipos
  que escribe el motor solo conocen las herramientas de la build y las de los
  servidores MCP conectados, y sin eso el matcher de `tool.call` no la admite.
- Los mocks de ficheros de los tests pasan a ser un disco en memoria con el
  `mtime` subiendo en cada escritura, que es la condición con la que el panel
  decide releer. De 19 a 30 tests.

## [1.1.0] — 2026-10-24

### El post-it de las notas

- Una sección nueva arriba del todo con lo que haya escrito en `NOTAS.md` de la
  raíz del repositorio: en la raíz y no en `docs/`, porque es un fichero que
  escribes tú y que el repositorio versiona, para que la nota viaje con la rama.
- **Solo aparece cuando hay notas**: sin fichero, o con un fichero que no deja
  ninguna línea útil, no se pinta ni el rótulo.
- Sin formato que cumplir: fuera cabeceras, rayas, citas y líneas en blanco, y
  las viñetas se unifican en una sola. Caben cinco líneas; de ahí para arriba el
  rótulo dice cuántas quedan (` NOTAS · +2 `).
- Se relee con el mismo trato que la mesa: cada 15 s y solo si cambió el
  `mtime`. Un post-it ilegible no tira el panel.
- Rótulo **negro sobre amarillo**, con los dos colores dichos: con `inverse`
  sobre amarillo el texto sale del color del fondo del tema —blanco en un tema
  claro— y blanco sobre amarillo no se lee. Las notas, en negritas y en
  `warning`, el ámbar del tema de quien lo usa: `yellow` a secas salía deslavado
  sobre el gris del fondo, y un hex clavado se apagaría en uno de los dos temas.
- Se queda las filas que necesite y el resto se reparte 3/4 y 1/4 como antes.

### El sonido al acabar el turno

- Un clip corto (`sounds/listo.wav`, del propio mod) cuando Claude acaba de
  contestar, con un hook de `turn.complete`.
- Solo con `reason: 'answer'`: interrupción, error de la API y rechazo callan.
  Y solo en el bucle principal, filtrando por `agentId`: un turno con cinco
  subagentes termina seis veces y sonaría seis.
- Se apaga desde `/config` (`userConfig.sonido`), sin desinstalar nada.
- Solo suena en macOS, donde el motor tiene `afplay`; en Linux y Windows no
  suena nada y no falla. Se lanza sin `await` y con el fallo tragado: ni retrasa
  ni rompe la respuesta.

### Tests

- Los mocks de ficheros de `pane.test.ts` contestan **por ruta**: con un
  `fs.exists` que decía `true` a todo, NOTAS.md recibía el Markdown de la mesa y
  el post-it salía con los tickets dentro.
- De 10 a 19 tests: post-it presente, ausente, truncado y vacío; el sonido al
  contestar, callado en los otros casos, apagado por config y fallando el clip.

## [1.0.0] — 2026-10-08

Primera versión publicada. Las anteriores (0.1.0 a 0.7.0) solo existieron en la
carpeta de mods de una máquina y no se instalaron en ninguna otra parte, así que
no tienen entrada propia: lo que sigue es lo que hay en esta.

### El panel de la mesa

- Lee `docs/MI-MESA.md` del repositorio de la sesión y pinta los tickets
  agrupados por hilo, con su marca (`▶` empezado, `·` sin empezar, `🚧`
  bloqueado), clave, prioridad, resumen, otros hilos y, donde la mesa escribe esa
  columna, quién lo tiene.
- Comando `/mi-mesa`, y se abre solo al empezar la sesión.
- Relee cada 15 s, y solo si cambió la fecha de modificación.
- Las claves se leen con el prefijo que traigan, no con uno fijo: con `LAN-\d+`
  un repo de claves `REN-` daba un panel en blanco con la mesa bien generada.
- La columna de quién lo tiene se separa del resumen: pegada, el nombre se comía
  el final del título.

### Los últimos mensajes

- Un cuarto de abajo con los últimos 10 mensajes que escribiste en ese
  repositorio, con su hora.
- Salen de `~/.claude/history.jsonl` y no de la conversación, para que un
  `/clear` no los borre; lo que escribes aparece al instante y se confirma
  contra el historial en el ciclo de 15 s.
- Fuera las barras (`/clear`, `/continuar`) y los mensajes de otros repos, con
  filtro exacto por repositorio: por prefijo se mezclarían `backend_lanzadera` y
  `backend_lanzadera_driver`.
- El hook de `prompt.submit` no espera ni deja escapar su fallo: está en el
  camino del prompt y lo que apunta es decorativo.

### Presentación

- Reparto 3/4 para la mesa y 1/4 para los mensajes, por el alto del cuerpo del
  panel (`scroll.bodyRows`) y no por el del viewport, que es el de la pantalla y
  no redibuja al cambiar. Por debajo de 12 filas no parte.
- Título en barra de ancho completo (`inverse` sobre `cyan`); línea divisoria
  fina y rótulo en negro y negritas.
- El ancho de las dos es `bodyColumns`: con el del viewport la línea se pasaba y
  envolvía cuando el panel va acoplado al lado del transcript.
