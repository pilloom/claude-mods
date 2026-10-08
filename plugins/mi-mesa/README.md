# mi-mesa

Un panel con **tu mesa de trabajo** —los tickets abiertos agrupados por hilo—
y debajo **los últimos mensajes que le pasaste a Claude Code**.

```
 MI MESA · BACKEND_LANZADERA
12 tickets · 5 hilos · generada 2026-10-08

origen-lan-2501 (3) — hoy
▶ LAN-2754 ALTA  La mesa no afirma dónde están los sin etiqueta
· LAN-2762 med   Revisar la simetría del contrato del latido
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

Un `docs/MI-MESA.md` en la raíz del repositorio de la sesión, que es el fichero
que **genera** el guion de la mesa de cada repo (`scripts/qa/listar-mi-mesa.js`
en los de Node, `tool/listar_mi_mesa.dart` en los de Flutter). El mod **no lo
genera**: solo lo lee. En un repo que no lo tenga, el panel lo dice con el
nombre del repo en lugar de salir en blanco.

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

## El reparto de la pantalla

Tres cuartos para la mesa, uno para los mensajes. El alto lo da
`e.props.scroll.bodyRows`, que es el del cuerpo del propio panel; el del
viewport es el de la pantalla entera y además no redibuja al cambiar, así que no
sirve para partir. Por debajo de 12 filas de cuerpo —o en una superficie que no
mande esas props— **no parte**: las dos secciones van seguidas y la de abajo no
desaparece.

El ancho de la barra del título y de la línea divisoria es `bodyColumns`, no el
del viewport: con el panel acoplado al lado del transcript el viewport mide más
y la línea se pasaba de ancho y envolvía.

## Colores

El título de arriba va con `inverse` sobre `cyan`; la línea y el rótulo de abajo
van en **negro**, que es lo que contrasta en un tema claro. **En un tema oscuro
las dos se verían apagadas**: están en un solo sitio cada una, al final de
`hooks/register.tsx`, y se cambian por el color del tema que prefieras.

## Desarrollo

```bash
claude plugin validate .            # manifiesto y módulo, como los lee el motor
claude plugin test .                # 10 tests
```

Para los tipos hace falta que el motor haya cargado el mod alguna vez desde su
carpeta: entonces escribe `.claude-plugin/types/` (gitignorado, es la API de esa
build) y el `tsconfig.json` de aquí lo extiende.

```bash
CLAUDE_CODE_PLUGIN_DIRS=/ruta/a/plugins/mi-mesa claude   # cargarlo desde disco
pnpm exec tsc -p .                                       # una vez haya tipos
```

En una sesión interactiva la carpeta se vigila: al guardar, el módulo se recarga
—`register` corre otra vez y los temporizadores del anterior se tiran—. Lo que
vive en `$.state` lo guarda el host y **sobrevive** a la recarga; las variables
del módulo empiezan de cero.
