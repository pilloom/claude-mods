# Changelog

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
