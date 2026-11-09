import { expect, test } from 'claude-code/testing'

import {
  anadirNota,
  comandoDe,
  envolver,
  parseHistory,
  parseMesa,
  parseNotas,
  parsePulso,
  quitarNota,
  trozosDePulso,
} from './parse'

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

/**
 * La mesa que **sí** escribe el tipo del ticket, con la columna entre la marca
 * de estado y la clave. Copiada de `backend_lanzadera`, que es la
 * implementación de referencia y el primer repositorio que la escribe.
 */
const CON_TIPO = `# Mi mesa de trabajo

> 🤖 **Generado** por \`scripts/qa/listar-mi-mesa.js\` el 2026-11-02, para **Alguien**.

## en curso (2) — hoy

\`\`\`
▶  🐞 LAN-2669  ALTA La limpieza de tokens FCM muertos borra en auth y el…  +token-fcm
·  ✅ LAN-2670  med  El sondeo mantiene vivo a un conductor que ya no está  → sin asignar
🚧 📖 LAN-2678  baja Mandar positionAgeMs en el probe-ack
·  ❔ LAN-2700  med  De un tipo que esta tabla no conoce
\`\`\`
`

test('lee el tipo del ticket cuando la mesa escribe esa columna', () => {
  const tickets = parseMesa(CON_TIPO, 1).hilos[0]?.tickets ?? []

  expect(tickets.map(t => [t.tipo, t.key, t.priority])).toEqual([
    ['🐞', 'LAN-2669', 'ALTA'],
    ['✅', 'LAN-2670', 'med'],
    ['📖', 'LAN-2678', 'baja'],
    ['❔', 'LAN-2700', 'med'],
  ])
  // Y la columna nueva no se come ninguna de las de al lado.
  expect(tickets[0]).toEqual({
    mark: '▶',
    tipo: '🐞',
    key: 'LAN-2669',
    priority: 'ALTA',
    summary: 'La limpieza de tokens FCM muertos borra en auth y el…',
    otherThreads: '+token-fcm',
  })
  expect(tickets[1]?.owner).toBe('sin asignar')
  expect(tickets[2]?.mark).toBe('🚧')
})

/**
 * El emoji del tipo **no se compara contra ninguna lista**: es lo que hace que
 * un tipo nuevo en Jira salga en el panel con el emoji que le ponga el guion en
 * vez de borrar el ticket de la mesa, que es lo que pasaría con un patrón que
 * enumerase los emojis aceptados.
 */
test('un emoji de tipo que el mod no conoce se lee igual', () => {
  const mesa = parseMesa(CON_TIPO.replace('🐞', '🦄'), 1)

  expect(mesa.hilos[0]?.tickets[0]?.tipo).toBe('🦄')
  expect(mesa.hilos[0]?.tickets).toHaveLength(4)
})

/** La mesa sin esa columna se lee como siempre y no gana un campo vacío. */
test('la mesa que no escribe el tipo no gana el campo', () => {
  const t = parseMesa(SAMPLE, 1).hilos[0]?.tickets[0]

  expect(t?.key).toBe('LAN-2669')
  expect(t?.priority).toBe('ALTA')
  expect(t && 'tipo' in t).toBe(false)
})

/**
 * Lo que la columna opcional NO puede traerse por delante: una línea que
 * empieza por la marca y no lleva clave sigue fuera del panel. Con el tipo
 * leído como «lo que esté delante de la clave», el riesgo es aceptar como
 * ticket cualquier línea que empiece por `·`.
 */
test('una línea que empieza por la marca y no es un ticket se descarta', () => {
  const mesa = parseMesa(
    `## hilo (1) — hoy

\`\`\`
·  esto no es un ticket, solo una frase que empieza igual
·  LAN-1   med  este sí
\`\`\`
`,
    1,
  )

  expect(mesa.hilos[0]?.tickets.map(t => t.key)).toEqual(['LAN-1'])
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

test('la nota se añade al final, y un fichero que no existe nace con cabecera', () => {
  expect(anadirNota('', 'la primera')).toEqual('# Notas\n\n- la primera\n')
  expect(anadirNota('# Notas\n\n- una\n', 'otra')).toEqual('# Notas\n\n- una\n- otra\n')
})

test('la viñeta no se duplica ni la pone quien dicta la nota', () => {
  // Quien la dicta mirando el panel repite la `•` que está viendo.
  expect(anadirNota('', '• ya con viñeta')).toEqual('# Notas\n\n- ya con viñeta\n')
  expect(anadirNota('', '- y con guion')).toEqual('# Notas\n\n- y con guion\n')
  expect(anadirNota('', '  dos   espacios  dentro ')).toEqual('# Notas\n\n- dos espacios dentro\n')
})

test('quitar casa sin tildes ni mayúsculas y deja el resto intacto', () => {
  const { texto, quitada } = quitarNota('# Notas\n\n- Llamar al Banco Sabadell\n- firmar\n', 'banco sabadell')
  expect(quitada).toEqual('Llamar al Banco Sabadell')
  expect(texto).toEqual('# Notas\n\n- firmar\n')
})

test('quitar con cero o con varias candidatas no toca el fichero', () => {
  const antes = '# Notas\n\n- llamar al banco\n- volver a llamar al banco\n'
  const varias = quitarNota(antes, 'banco')
  expect(varias.quitada).toBeUndefined()
  expect(varias.texto).toEqual(antes)
  expect(varias.candidatas).toEqual(['llamar al banco', 'volver a llamar al banco'])

  const ninguna = quitarNota(antes, 'hacienda')
  expect(ninguna.quitada).toBeUndefined()
  expect(ninguna.texto).toEqual(antes)
  expect(ninguna.candidatas).toEqual([])
})

test('quitar no casa contra las cabeceras del fichero', () => {
  // `Notas` está en la cabecera, no en ninguna nota: no hay candidata.
  expect(quitarNota('# Notas\n\n- una cosa\n', 'notas').candidatas).toEqual([])
})

test('una nota corta se queda en su fila, como estaba', async () => {
  expect(envolver('• una nota corta', 30)).toEqual(['• una nota corta'])
  // Justo del ancho tampoco se parte: el corte es por pasarse, no por llegar.
  expect(envolver('• doce chars', 12)).toEqual(['• doce chars'])
})

test('una nota larga se enseña entera, partida por los espacios y sangrada', async () => {
  expect(envolver('• pedir las claves de staging a Marta antes del jueves', 30)).toEqual([
    '• pedir las claves de staging',
    '  a Marta antes del jueves',
  ])
})

test('una palabra más larga que la fila se parte en vez de dejarla en blanco', async () => {
  // La viñeta sale del texto: dentro, el espacio que lleva detrás sería el
  // último hueco de la fila y la primera saldría con la viñeta sola.
  expect(envolver('• https://ejemplo.test/un/enlace/larguisimo', 20)).toEqual([
    '• https://ejemplo.te',
    '  st/un/enlace/largu',
    '  isimo',
  ])
})

test('una línea sin viñeta se parte sin inventarse una sangría', async () => {
  expect(envolver('cuatro cinco seis siete', 12)).toEqual(['cuatro cinco', 'seis siete'])
})

test('la cabecera del fichero dice qué guion lo generó, y de ahí sale el comando', () => {
  // La mesa se autodeclara, así que el botón de regenerar no necesita que nadie
  // configure nada: cada repositorio nombra el suyo en su propia cabecera.
  expect(parseMesa(SAMPLE, 1).generador).toBe('scripts/qa/listar-mi-mesa.js')
  expect(comandoDe('scripts/qa/listar-mi-mesa.js')).toEqual([
    'node',
    'scripts/qa/listar-mi-mesa.js',
  ])
  expect(comandoDe('tool/listar_mi_mesa.dart')).toEqual(['dart', 'run', 'tool/listar_mi_mesa.dart'])
})

test('una mesa sin cabecera no trae guion en vez de traer uno inventado', () => {
  expect(parseMesa('## hilo\n\n▶  LAN-1  ALTA algo\n', 1).generador).toBeUndefined()
})

/**
 * Lo que `comandoDe` no acepta, que es lo que acota el riesgo del botón.
 *
 * La ruta sale de un fichero versionado: quien pueda commitear `docs/MI-MESA.md`
 * elige lo que correría al pulsar. Por eso solo pasa una ruta relativa de dentro
 * del repositorio con una extensión de la lista, y lo demás no se ejecuta aunque
 * la cabecera lo nombre.
 */
test('una ruta que apunta fuera, o a lo que no es un guion, no se ejecuta', () => {
  for (const ruta of [
    '/usr/bin/curl',
    '~/malo.js',
    '../../fuera/malo.js',
    'scripts/../../malo.js',
    'scripts/malo.sh',
    'scripts/malo.py',
    'scripts/sin-extension',
    'scripts/malo.js; rm -rf /',
    'scripts/$(whoami).js',
    '',
    '   ',
  ]) {
    expect(comandoDe(ruta)).toBeUndefined()
  }
})

const PULSO = [
  '## Pulso de la semana',
  '',
  '```',
  'tramo: MAR-LUN',
  'abren: 62',
  'cierran: 57',
  'subtareas: 31',
  'tuyos: 18',
  'puesto: 2',
  'personas: 9',
  '```',
].join('\n')

test('parsePulso lee las cifras de su sección', () => {
  expect(parsePulso(PULSO)).toEqual({
    abren: 62,
    cierran: 57,
    subtareas: 31,
    tuyos: 18,
    puesto: 2,
    personas: 9,
    tramo: 'MAR-LUN',
  })
})

test('parsePulso solo pide abren y cierran; el resto es opcional', () => {
  expect(parsePulso('## Pulso\nabren: 4\ncierran: 9\n')).toEqual({ abren: 4, cierran: 9 })
})

/**
 * Es la regla de todas las columnas que se han portado de un repositorio a
 * otro: la mesa cuyo guion todavía no escribe la sección se lee igual, y el
 * panel decide por la ausencia que ahí no pinta nada.
 */
test('una mesa sin la sección del pulso no gana un marcador en blanco', () => {
  expect(parsePulso('# Mi mesa\n\n## un-hilo (1) — hoy\n\n·  LAN-1 med Algo\n')).toBeUndefined()
  // Media cifra no es un marcador: «cierran 88» solo no dice si vamos ganando.
  expect(parsePulso('## Pulso\ncierran: 88\n')).toBeUndefined()
  expect(parseMesa('## Pulso\nabren: 1\ncierran: 2\n', 1).pulso).toEqual({ abren: 1, cierran: 2 })
  expect(parseMesa('## un-hilo (0) — hoy\n', 1).pulso).toBeUndefined()
})

/**
 * Las cifras se leen **solo** dentro de su sección: leer por clave en todo el
 * fichero convertiría cualquier frase de la prosa en un dato del marcador.
 */
test('parsePulso no lee cifras de fuera de su sección', () => {
  expect(parsePulso('## Otra cosa\nabren: 9\ncierran: 9\n')).toBeUndefined()
  // Y la sección acaba donde empieza la siguiente.
  expect(parsePulso('## Pulso\nabren: 1\ncierran: 2\n\n## Otra\ntuyos: 7\n')?.tuyos).toBeUndefined()
})

/** Un `abren: -3` es un guion roto, y un marcador que enseña lo imposible se cree. */
test('parsePulso descarta las cifras imposibles en vez de pintarlas', () => {
  expect(parsePulso('## Pulso\nabren: -3\ncierran: 2\n')).toBeUndefined()
  expect(parsePulso('## Pulso\nabren: 3\ncierran: 2\npuesto: 0\n')?.puesto).toBeUndefined()
})

test('la línea del marcador se escribe de izquierda a derecha', () => {
  const linea = trozosDePulso(parsePulso(PULSO)!, 80)
    .map(t => t.text)
    .join('')
  expect(linea).toBe('SEMANA MAR-LUN  + 62 ▏- 57 ▏▼5 ▏tú 18 · 2.º/9')
  // 🔴 Las subtareas se cuentan y **no se pintan**: están en el fichero para
  // quien lo abra, y en la fila eran un tercer número que explicar.
  expect(linea).not.toContain('subt')
  // Cerrando más de lo que entra, la flecha y el color cambian de sentido.
  const gana = trozosDePulso({ abren: 10, cierran: 26 }, 80)
  expect(gana.map(t => t.text).join('')).toBe('SEMANA  + 10 ▏- 26 ▏▲16')
  expect(gana.some(t => t.tono === 'gana')).toBe(true)
  expect(trozosDePulso({ abren: 10, cierran: 10 }, 80).some(t => t.tono === 'gana')).toBe(true)
})

/**
 * Lo que no cabe se cae por la derecha y por grupos enteros: un corte a mitad
 * de grupo deja un `▏` colgando, apuntando a un dato que no está. Y una fila
 * que se pasa de ancho envuelve, que descuadra la ventana de la mesa entera.
 */
test('el marcador se recorta por grupos y nunca se pasa de ancho', () => {
  const p = parsePulso(PULSO)!
  for (let width = 10; width <= 80; width++) {
    const linea = trozosDePulso(p, width)
      .map(t => t.text)
      .join('')
    // Se mide como se pinta: un emoji es un carácter y dos columnas. Hoy la
    // línea no lleva ninguno —son todos glifos de una columna—, y la cuenta se
    // queda para el día que alguien meta uno.
    const columnas = linea.length + (linea.match(/[✅⚠]/gu)?.length ?? 0)
    expect(columnas).toBeLessThanOrEqual(width)
    expect(linea.endsWith('▏')).toBe(false)
  }
  // 🔴 Y ningún glifo de la línea puede ser de los que miden distinto a como se
  // pintan: `✔️` es el caso —dos caracteres, y el selector de variación no
  // cambia la tabla de anchos, solo le pide al terminal que lo pinte como
  // emoji—, así que esta cuenta diría 1 y el terminal pintaría 2.
  expect(trozosDePulso(p, 80).map(t => t.text).join('')).not.toContain('\uFE0F')
  // Donde no cabe ni la primera cifra no hay fila: ocuparía una de la mesa
  // para no decir nada.
  expect(trozosDePulso(p, 12)).toEqual([])
})
