import { expect, test } from 'claude-code/testing'

import { parseHistory, parseMesa, parseNotas } from './parse'

const SAMPLE = `# Mi mesa de trabajo

> 🤖 **Generado** por \`scripts/qa/listar-mi-mesa.js\` el 2026-10-07, para **Alguien**.

**3 tickets** en **2 hilos** con actividad en los últimos 14 días.

Columnas: \`▶\` ya empezado · \`·\` sin empezar · \`🚧\` bloqueado · clave · prioridad · resumen · \`+\` otros hilos.

## origen-qa-conductor-20261004 (1 de 4) — hoy

\`\`\`
▶  LAN-2669  ALTA La limpieza de tokens FCM muertos borra en auth y el…  +token-fcm-dos-almacenes
\`\`\`

## bucle-sondeo-sin-latido (2) — hace 2 días

\`\`\`
·  LAN-2670  med  El sondeo mantiene vivo y asignable a un conductor que…
🚧 LAN-2678  baja Mandar positionAgeMs en el probe-ack (bloqueado hasta…  +medicion-04oct2026
\`\`\`

## Lo que NO está aquí

\`\`\`
·  LAN-9999  med  esto no es la mesa
\`\`\`
`

test('lee solo los tickets de la mesa, por hilo, y para en «Lo que NO está aquí»', () => {
  const mesa = parseMesa(SAMPLE, 1)

  expect(mesa.generated).toBe('2026-10-07')
  expect(mesa.hilos.map(h => h.tickets.map(t => t.key))).toEqual([
    ['LAN-2669'],
    ['LAN-2670', 'LAN-2678'],
  ])
  expect(mesa.hilos[0]?.tickets[0]).toEqual({
    mark: '▶',
    key: 'LAN-2669',
    priority: 'ALTA',
    summary: 'La limpieza de tokens FCM muertos borra en auth y el…',
    otherThreads: '+token-fcm-dos-almacenes',
  })
  expect(mesa.hilos[1]?.tickets[1]?.mark).toBe('🚧')
})

/**
 * La mesa de otro repositorio, con otro prefijo de proyecto y con la columna de
 * quién lo tiene.
 *
 * Es el caso que no funcionaba: el patrón pedía `LAN-\d+`, así que en
 * `renovatio` no casaba ninguna línea y el panel salía vacío con la mesa
 * delante. Va con el texto tal cual lo escribe
 * `scripts/qa/listar-mi-mesa.js` de ese repositorio, copiado el 08/10/2026,
 * incluidos los tres espacios de las claves cortas y la columna `→`.
 */
const RENOVATIO = `# Mi mesa de trabajo

> 🤖 **Generado** por \`scripts/qa/listar-mi-mesa.js\` el 2026-10-08, para **Jose Antonio Barcelo**, Team **Renovatio**.

**14 tickets** en **2 hilos** con actividad en los últimos 14 días.

## archivos-en-cloudinary (4) — hoy

\`\`\`
·  REN-205   med  El borrado de archivos acepta cualquier public_id de la…  → sin asignar
▶  REN-186   med  Un comprobante en PDF o un vídeo no se pueden borrar de…
\`\`\`

## docs-un-ticket-por-platica (10) — hoy

\`\`\`
·  REN-201   baja npm run lint no mira scripts/, y ahí hay 106 errores
\`\`\`
`

test('lee la mesa de un repositorio con otro prefijo de proyecto', () => {
  const mesa = parseMesa(RENOVATIO, 1)

  expect(mesa.generated).toBe('2026-10-08')
  expect(mesa.hilos.map(h => h.title)).toEqual([
    'archivos-en-cloudinary (4) — hoy',
    'docs-un-ticket-por-platica (10) — hoy',
  ])
  expect(mesa.hilos.map(h => h.tickets.map(t => t.key))).toEqual([
    ['REN-205', 'REN-186'],
    ['REN-201'],
  ])
})

test('separa quién lo tiene en lugar de dejarlo pegado al resumen', () => {
  const [sinAsignar, mio] = parseMesa(RENOVATIO, 1).hilos[0]?.tickets ?? []

  expect(sinAsignar).toEqual({
    mark: '·',
    key: 'REN-205',
    priority: 'med',
    summary: 'El borrado de archivos acepta cualquier public_id de la…',
    otherThreads: '',
    owner: 'sin asignar',
  })
  // Y el que es mío no gana el campo: la mesa no escribe la columna.
  expect(mio?.owner).toBeUndefined()
  expect(mio?.summary).toBe('Un comprobante en PDF o un vídeo no se pueden borrar de…')
})

const BACK = '/Users/x/lanzadera/backend_lanzadera'
const DRIVER = '/Users/x/lanzadera/backend_lanzadera_driver'
const HISTORY = [
  JSON.stringify({ display: 'el más viejo', timestamp: 1, project: BACK }),
  JSON.stringify({ display: 'de otro repo', timestamp: 2, project: DRIVER }),
  JSON.stringify({ display: '/clear', timestamp: 3, project: BACK }),
  JSON.stringify({ display: 'con\nsalto\tdentro', timestamp: 4, project: BACK }),
  '{"display":"una linea a medias, sin cerr',
  JSON.stringify({ display: '   ', timestamp: 5, project: BACK }),
  JSON.stringify({ display: 'el más nuevo', timestamp: 6, project: BACK }),
].join('\n')

test('el historial da los últimos mensajes del repo, del más nuevo al más viejo', () => {
  expect(parseHistory(HISTORY, BACK, 5)).toEqual([
    { text: 'el más nuevo', at: 6 },
    { text: 'con salto dentro', at: 4 },
    { text: 'el más viejo', at: 1 },
  ])
})

test('el tope corta por el final, que es lo reciente', () => {
  expect(parseHistory(HISTORY, BACK, 1)).toEqual([{ text: 'el más nuevo', at: 6 }])
})

// `lanzadera/backend_lanzadera` es prefijo de `lanzadera/backend_lanzadera_driver`:
// filtrar por prefijo mezclaría los mensajes de dos de los cuatro repos hermanos.
test('un repo cuyo nombre empieza igual no cuela sus mensajes', () => {
  expect(parseHistory(HISTORY, DRIVER, 5)).toEqual([{ text: 'de otro repo', at: 2 }])
})

test('el post-it deja las líneas que hay, sin cabeceras ni rayas', () => {
  const { lines, mtimeMs } = parseNotas(
    ['# Notas', '', '## Para el lunes', '- llamar al banco', '* y al gestor', '1. firmar', '', '---', '> ojo con esto', 'suelta'].join('\n'),
    7,
  )
  expect(lines).toEqual(['• llamar al banco', '• y al gestor', '• firmar', 'suelta'])
  expect(mtimeMs).toEqual(7)
})

test('un fichero de solo adornos cuenta como no tener notas', () => {
  expect(parseNotas('# Notas\n\n===\n\n', 7).lines).toEqual([])
})
