# Changelog

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
